// Frameworks — WebGPU renderer
// Each "frame" = 4 line-quads forming a crosshatch box (64px inner, 80px total, 8px overshoot)

const FRAME_SIZE = 64.0;
const LINE_LEN = 80.0;
const OVERSHOOT = (LINE_LEN - FRAME_SIZE) / 2.0; // 8
const MAX_FRAMES = 1_200_000;
const FRAME_STRIDE = 32; // bytes: vec2 pos(8) + f32 rot(4) + f32 scale(4) + vec4 color(16)

// ─── GPU init ────────────────────────────────────────────────────────────────

async function init() {
  const canvas = document.getElementById('c');
  const errorEl = document.getElementById('error');
  const statsEl = document.getElementById('stats');

  if (!navigator.gpu) { errorEl.style.display = 'block'; return; }
  const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
  if (!adapter) { errorEl.style.display = 'block'; return; }
  const device = await adapter.requestDevice({
    requiredLimits: {
      maxStorageBufferBindingSize: adapter.limits.maxStorageBufferBindingSize,
      maxBufferSize: adapter.limits.maxBufferSize,
    }
  });

  const ctx = canvas.getContext('webgpu');
  const format = navigator.gpu.getPreferredCanvasFormat();
  const dpr = Math.min(window.devicePixelRatio, 2);

  function resize() {
    canvas.width = Math.floor(canvas.clientWidth * dpr);
    canvas.height = Math.floor(canvas.clientHeight * dpr);
    ctx.configure({ device, format, alphaMode: 'opaque' });
  }
  resize();
  window.addEventListener('resize', resize);

  // ─── Quad geometry for one line segment ──────────────────────────────────
  // A thin quad: 2 triangles, 6 verts. The line goes along X from -0.5 to +0.5,
  // with half-width in Y. We'll scale in the shader.
  const quadVerts = new Float32Array([
    -0.5, -0.5,   0.5, -0.5,   0.5,  0.5,
    -0.5, -0.5,   0.5,  0.5,  -0.5,  0.5,
  ]);
  const quadVB = device.createBuffer({
    size: quadVerts.byteLength, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(quadVB, 0, quadVerts);

  // ─── Instance storage buffer ─────────────────────────────────────────────
  const instanceBuf = device.createBuffer({
    size: MAX_FRAMES * FRAME_STRIDE,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });

  // ─── Uniform buffer: camera + time ──────────────────────────────────────
  // layout: mat3x3 but we'll use vec4 packing for std140:
  //   vec2 pan (8) + f32 zoom (4) + f32 time (4) +
  //   vec2 resolution (8) + f32 lineWidth (4) + u32 frameCount (4)
  const uniformBuf = device.createBuffer({
    size: 32, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  const uniformData = new ArrayBuffer(32);
  const uniformF32 = new Float32Array(uniformData);
  const uniformU32 = new Uint32Array(uniformData);

  // ─── Compute: pattern generation ─────────────────────────────────────────
  const computeParamsBuf = device.createBuffer({
    size: 32, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const computeShaderCode = /* wgsl */`
    struct Frame {
      pos: vec2f,
      rot: f32,
      scale: f32,
      color: vec4f,
    }

    struct Params {
      count: u32,
      pattern: u32,
      time: f32,
      seed: f32,
      param0: f32,
      param1: f32,
      param2: f32,
      param3: f32,
    }

    @group(0) @binding(0) var<storage, read_write> frames: array<Frame>;
    @group(0) @binding(1) var<uniform> p: Params;

    // noise helpers
    fn hash(p2: vec2f) -> f32 {
      var p3 = fract(vec3f(p2.x, p2.y, p2.x) * 0.1031);
      p3 += dot(p3, p3.yzx + 33.33);
      return fract((p3.x + p3.y) * p3.z);
    }

    fn noise(p: vec2f) -> f32 {
      let i = floor(p);
      let f = fract(p);
      let u = f * f * (3.0 - 2.0 * f);
      return mix(
        mix(hash(i + vec2f(0,0)), hash(i + vec2f(1,0)), u.x),
        mix(hash(i + vec2f(0,1)), hash(i + vec2f(1,1)), u.x),
        u.y
      );
    }

    fn fbm(pos: vec2f) -> f32 {
      var v = 0.0;
      var a = 0.5;
      var p = pos;
      for (var i = 0; i < 5; i++) {
        v += a * noise(p);
        p *= 2.0;
        a *= 0.5;
      }
      return v;
    }

    // HSV to RGB
    fn hsv2rgb(c: vec3f) -> vec3f {
      let p = abs(fract(vec3f(c.x) + vec3f(0.0, 2.0/3.0, 1.0/3.0)) * 6.0 - vec3f(3.0));
      return c.z * mix(vec3f(1.0), clamp(p - vec3f(1.0), vec3f(0.0), vec3f(1.0)), c.y);
    }

    @compute @workgroup_size(256)
    fn main(@builtin(global_invocation_id) gid: vec3u) {
      let idx = gid.x;
      if (idx >= p.count) { return; }
      let fi = f32(idx);
      let t = p.time;

      var pos = vec2f(0.0);
      var rot = 0.0;
      var scale = 1.0;
      var col = vec3f(1.0);

      switch p.pattern {
        // ── Pattern 0: massive spiral ──
        case 0u: {
          let total = f32(p.count);
          let norm = fi / total;
          let angle = norm * 120.0 + t * 0.3;
          let radius = norm * total * 0.08;
          pos = vec2f(cos(angle), sin(angle)) * radius;
          rot = angle + t * 0.5;
          scale = 0.4 + 0.6 * (1.0 - norm);
          let hue = fract(norm * 3.0 + t * 0.05);
          col = hsv2rgb(vec3f(hue, 0.8, 0.7 + 0.3 * sin(norm * 20.0 + t)));
        }

        // ── Pattern 1: grid deformed by noise ──
        case 1u: {
          let cols = u32(ceil(sqrt(f32(p.count))));
          let row = idx / cols;
          let column = idx % cols;
          let spacing = 80.0;
          let gridX = (f32(column) - f32(cols) / 2.0) * spacing;
          let gridY = (f32(row) - f32(cols) / 2.0) * spacing;

          let nScale = 0.003;
          let nx = fbm(vec2f(gridX * nScale + t * 0.1, gridY * nScale)) * 60.0;
          let ny = fbm(vec2f(gridX * nScale, gridY * nScale + t * 0.1 + 100.0)) * 60.0;
          pos = vec2f(gridX + nx, gridY + ny);

          let n = fbm(vec2f(gridX * nScale * 2.0 + t * 0.05, gridY * nScale * 2.0));
          rot = n * 3.14159;
          scale = 0.3 + 0.4 * n;

          let hue = fract(n + t * 0.02);
          let sat = 0.5 + 0.5 * sin(fi * 0.001);
          col = hsv2rgb(vec3f(hue, sat, 0.4 + 0.5 * n));
        }

        // ── Pattern 2: pixel shade (image-like) ──
        case 2u: {
          // Arrange in a dense grid, shade each frame by a procedural "image"
          let imgW = u32(ceil(sqrt(f32(p.count) * 1.5)));
          let imgH = p.count / imgW + 1u;
          let row = idx / imgW;
          let column = idx % imgW;
          let spacing = 18.0;
          let ox = f32(imgW) * spacing * 0.5;
          let oy = f32(imgH) * spacing * 0.5;
          pos = vec2f(f32(column) * spacing - ox, f32(row) * spacing - oy);

          // Procedural image: overlapping circles + gradient
          let uv = vec2f(f32(column) / f32(imgW), f32(row) / f32(imgH));

          // Face-like pattern: circle with eyes and mouth
          let center = vec2f(0.5, 0.5);
          let d = distance(uv, center);
          let circle = smoothstep(0.45, 0.44, d); // head

          let leftEye = smoothstep(0.06, 0.05, distance(uv, vec2f(0.38, 0.4)));
          let rightEye = smoothstep(0.06, 0.05, distance(uv, vec2f(0.62, 0.4)));

          // Smile arc
          let smileCenter = vec2f(0.5, 0.55);
          let smileDist = distance(uv, smileCenter);
          let smileArc = smoothstep(0.002, 0.0, abs(smileDist - 0.2)) * step(0.55, uv.y) * step(uv.y, 0.72);

          // Animated rings
          let rings = sin(d * 40.0 - t * 2.0) * 0.5 + 0.5;

          let lum = circle * (1.0 - leftEye) * (1.0 - rightEye) * (1.0 - smileArc * 0.8);
          let bg = rings * 0.15 * (1.0 - circle);
          let brightness = lum + bg;

          // Color based on luminance region
          let faceHue = 0.08 + 0.05 * sin(t * 0.5); // warm face
          let bgHue = fract(0.6 + d * 0.5 + t * 0.02);
          let hue = mix(bgHue, faceHue, circle);
          let sat = mix(0.6, 0.4, circle);
          col = hsv2rgb(vec3f(hue, sat, brightness * 0.9 + 0.1));

          rot = 0.0;
          scale = 0.15 + 0.05 * brightness;
        }

        // ── Pattern 3: galaxy / double spiral arms ──
        case 3u: {
          let total = f32(p.count);
          let norm = fi / total;

          // Assign to one of several arms
          let armCount = 5.0;
          let arm = floor(norm * armCount);
          let armNorm = fract(norm * armCount);

          let armAngle = arm * 6.28318 / armCount;
          let spiralAngle = armNorm * 18.0 + armAngle + t * 0.15;
          let radius = armNorm * total * 0.04 + 20.0;

          // Add some scatter
          let scatter = (hash(vec2f(fi, arm)) - 0.5) * radius * 0.25;
          let scatterY = (hash(vec2f(fi + 999.0, arm)) - 0.5) * radius * 0.25;

          pos = vec2f(
            cos(spiralAngle) * radius + scatter,
            sin(spiralAngle) * radius + scatterY
          );

          rot = spiralAngle + t * 0.2;
          scale = 0.2 + 0.5 * (1.0 - armNorm) + 0.1 * sin(t + fi * 0.01);

          let hue = fract(arm / armCount + armNorm * 0.3 + t * 0.01);
          let sat = 0.6 + 0.4 * (1.0 - armNorm);
          let val = 0.3 + 0.7 * (1.0 - armNorm * 0.8);
          col = hsv2rgb(vec3f(hue, sat, val));
        }

        default: {}
      }

      frames[idx].pos = pos;
      frames[idx].rot = rot;
      frames[idx].scale = scale;
      frames[idx].color = vec4f(col, 1.0);
    }
  `;

  const computeModule = device.createShaderModule({ code: computeShaderCode });

  const computeBGL = device.createBindGroupLayout({
    entries: [
      { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
      { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
    ],
  });

  const computePipeline = device.createComputePipeline({
    layout: device.createPipelineLayout({ bindGroupLayouts: [computeBGL] }),
    compute: { module: computeModule, entryPoint: 'main' },
  });

  const computeBG = device.createBindGroup({
    layout: computeBGL,
    entries: [
      { binding: 0, resource: { buffer: instanceBuf } },
      { binding: 1, resource: { buffer: computeParamsBuf } },
    ],
  });

  // ─── Render pipeline ────────────────────────────────────────────────────
  const renderShaderCode = /* wgsl */`
    struct Frame {
      pos: vec2f,
      rot: f32,
      scale: f32,
      color: vec4f,
    }

    struct Uniforms {
      pan: vec2f,
      zoom: f32,
      time: f32,
      resolution: vec2f,
      lineWidth: f32,
      frameCount: u32,
    }

    @group(0) @binding(0) var<storage, read> frames: array<Frame>;
    @group(0) @binding(1) var<uniform> u: Uniforms;

    struct VSOut {
      @builtin(position) pos: vec4f,
      @location(0) color: vec4f,
    }

    // Frame geometry constants
    const FRAME_SIZE: f32 = 64.0;
    const LINE_LEN: f32 = 80.0;
    const HALF_LEN: f32 = LINE_LEN / 2.0;
    const HALF_FRAME: f32 = FRAME_SIZE / 2.0;

    @vertex
    fn vs_main(
      @location(0) quadPos: vec2f,        // -0.5..0.5 unit quad
      @builtin(instance_index) instIdx: u32
    ) -> VSOut {
      // Each frame has 4 line-quads. instance_index = frameIdx * 4 + lineIdx
      let frameIdx = instIdx / 4u;
      let lineIdx = instIdx % 4u;

      if (frameIdx >= u.frameCount) {
        var out: VSOut;
        out.pos = vec4f(0.0, 0.0, -2.0, 1.0); // cull
        out.color = vec4f(0.0);
        return out;
      }

      let frame = frames[frameIdx];

      // Determine line local position and orientation
      // Lines 0,1: horizontal pair (top and bottom)
      // Lines 2,3: vertical pair (left and right)
      var linePos = vec2f(0.0);
      var lineDir = vec2f(1.0, 0.0); // direction along line
      var linePerp = vec2f(0.0, 1.0); // perpendicular

      switch lineIdx {
        case 0u: { // top horizontal
          linePos = vec2f(0.0, HALF_FRAME);
          lineDir = vec2f(1.0, 0.0);
          linePerp = vec2f(0.0, 1.0);
        }
        case 1u: { // bottom horizontal
          linePos = vec2f(0.0, -HALF_FRAME);
          lineDir = vec2f(1.0, 0.0);
          linePerp = vec2f(0.0, 1.0);
        }
        case 2u: { // left vertical
          linePos = vec2f(-HALF_FRAME, 0.0);
          lineDir = vec2f(0.0, 1.0);
          linePerp = vec2f(1.0, 0.0);
        }
        case 3u: { // right vertical
          linePos = vec2f(HALF_FRAME, 0.0);
          lineDir = vec2f(0.0, 1.0);
          linePerp = vec2f(1.0, 0.0);
        }
        default: {}
      }

      // Build local vertex position: scale the unit quad to line dimensions
      let lw = u.lineWidth;
      let localPos = linePos + lineDir * quadPos.x * LINE_LEN + linePerp * quadPos.y * lw;

      // Apply frame transform: scale then rotate then translate
      let s = frame.scale;
      let c = cos(frame.rot);
      let sn = sin(frame.rot);
      let scaled = localPos * s;
      let rotated = vec2f(
        scaled.x * c - scaled.y * sn,
        scaled.x * sn + scaled.y * c
      );
      let worldPos = rotated + frame.pos;

      // Camera: pan and zoom, then project to NDC
      let viewPos = (worldPos - u.pan) * u.zoom;
      let ndc = vec2f(
        viewPos.x / (u.resolution.x * 0.5),
        viewPos.y / (u.resolution.y * 0.5)
      );

      var out: VSOut;
      out.pos = vec4f(ndc, 0.0, 1.0);
      out.color = frame.color;
      return out;
    }

    @fragment
    fn fs_main(@location(0) color: vec4f) -> @location(0) vec4f {
      return color;
    }
  `;

  const renderModule = device.createShaderModule({ code: renderShaderCode });

  const renderBGL = device.createBindGroupLayout({
    entries: [
      { binding: 0, visibility: GPUShaderStage.VERTEX, buffer: { type: 'read-only-storage' } },
      { binding: 1, visibility: GPUShaderStage.VERTEX, buffer: { type: 'uniform' } },
    ],
  });

  const renderPipeline = device.createRenderPipeline({
    layout: device.createPipelineLayout({ bindGroupLayouts: [renderBGL] }),
    vertex: {
      module: renderModule,
      entryPoint: 'vs_main',
      buffers: [{
        arrayStride: 8,
        attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x2' }],
      }],
    },
    fragment: {
      module: renderModule,
      entryPoint: 'fs_main',
      targets: [{ format, blend: {
        color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha' },
        alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' },
      }}],
    },
    primitive: { topology: 'triangle-list' },
  });

  const renderBG = device.createBindGroup({
    layout: renderBGL,
    entries: [
      { binding: 0, resource: { buffer: instanceBuf } },
      { binding: 1, resource: { buffer: uniformBuf } },
    ],
  });

  // ─── Camera state ───────────────────────────────────────────────────────
  let panX = 0, panY = 0, zoom = 0.3;
  let dragging = false, lastMX = 0, lastMY = 0;

  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    const zoomSpeed = 1.08;
    if (e.deltaY < 0) zoom *= zoomSpeed;
    else zoom /= zoomSpeed;
    zoom = Math.max(0.0001, Math.min(zoom, 50));
  }, { passive: false });

  canvas.addEventListener('pointerdown', e => {
    dragging = true; lastMX = e.clientX; lastMY = e.clientY;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', e => {
    if (!dragging) return;
    const dx = e.clientX - lastMX, dy = e.clientY - lastMY;
    lastMX = e.clientX; lastMY = e.clientY;
    panX -= dx * dpr / zoom;
    panY += dy * dpr / zoom;
  });
  canvas.addEventListener('pointerup', () => { dragging = false; });

  // ─── Pattern switching ──────────────────────────────────────────────────
  let currentPattern = 0;
  let frameCount = 500_000;

  const patternConfigs = {
    0: { name: 'spiral',     count: 500_000 },
    1: { name: 'noisy grid', count: 500_000 },
    2: { name: 'pixel shade',count: 500_000 },
    3: { name: 'galaxy',     count: 600_000 },
  };

  window.addEventListener('keydown', e => {
    const n = parseInt(e.key);
    if (n >= 1 && n <= 4) {
      currentPattern = n - 1;
      const cfg = patternConfigs[currentPattern];
      frameCount = cfg.count;
    }
  });

  // ─── Render loop ────────────────────────────────────────────────────────
  let frameNum = 0;
  let lastTime = performance.now();
  let fps = 0;

  function frame(now) {
    requestAnimationFrame(frame);

    // FPS
    frameNum++;
    if (frameNum % 30 === 0) {
      fps = Math.round(1000 / (now - lastTime) * 30);
      lastTime = now;
      const cfg = patternConfigs[currentPattern];
      statsEl.textContent = `${fps} fps · ${(frameCount/1000).toFixed(0)}k frames · ${cfg.name}`;
    }

    const t = now * 0.001;
    const w = canvas.width, h = canvas.height;

    // ── Compute dispatch: generate pattern ──
    const computeParams = new ArrayBuffer(32);
    const cpF32 = new Float32Array(computeParams);
    const cpU32 = new Uint32Array(computeParams);
    cpU32[0] = frameCount;
    cpU32[1] = currentPattern;
    cpF32[2] = t;
    cpF32[3] = 42.0; // seed
    device.queue.writeBuffer(computeParamsBuf, 0, computeParams);

    // ── Update uniforms ──
    uniformF32[0] = panX;
    uniformF32[1] = panY;
    uniformF32[2] = zoom;
    uniformF32[3] = t;
    uniformF32[4] = w;
    uniformF32[5] = h;
    uniformF32[6] = 1.5; // line width in pixels
    uniformU32[7] = frameCount;
    device.queue.writeBuffer(uniformBuf, 0, uniformData);

    const encoder = device.createCommandEncoder();

    // Compute pass
    const cpass = encoder.beginComputePass();
    cpass.setPipeline(computePipeline);
    cpass.setBindGroup(0, computeBG);
    cpass.dispatchWorkgroups(Math.ceil(frameCount / 256));
    cpass.end();

    // Render pass
    const rpass = encoder.beginRenderPass({
      colorAttachments: [{
        view: ctx.getCurrentTexture().createView(),
        loadOp: 'clear',
        storeOp: 'store',
        clearValue: { r: 0.02, g: 0.02, b: 0.03, a: 1 },
      }],
    });
    rpass.setPipeline(renderPipeline);
    rpass.setBindGroup(0, renderBG);
    rpass.setVertexBuffer(0, quadVB);
    // 6 verts per quad, 4 quads per frame, frameCount frames
    rpass.draw(6, frameCount * 4);
    rpass.end();

    device.queue.submit([encoder.finish()]);
  }

  requestAnimationFrame(frame);
}

init().catch(e => {
  console.error(e);
  document.getElementById('error').style.display = 'block';
  document.getElementById('error').textContent = 'Init failed: ' + e.message;
});
