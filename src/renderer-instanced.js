// frameworks-renderer-instanced-v3.0.js
// High-performance instanced renderer for Frameworks V3

/**
 * Instanced renderer using Three.js for maximum performance
 * Can handle 100,000+ frames at 60 FPS
 */
class FrameworksInstancedRenderer {
    constructor(framework, containerId = 'container') {
        this.framework = framework;
        this.container = document.getElementById(containerId);

        // Three.js objects
        this.scene = null;
        this.perspectiveCamera = null;
        this.orthographicCamera = null;
        this.camera = null; // Active camera (will be set by view mode)
        this.controls = null; // Orbit controls for spatial view
        this.renderer = null;
        this.instancedMesh = null;
        this.cursorMesh = null;
        this.referenceCube = null;

        // Instance data buffers
        this.maxFrames = 100000; // Pre-allocate for max expected frames
        this.offsets = null;
        this.rotations = null;
        this.scales = null;
        this.colors = null;
        this.selected = null;

        // Rendering settings
        this.backgroundColor = 0x0a0a0a;

        this.init();
    }

    /**
     * Initialize Three.js scene with instanced geometry
     */
    init() {
        // Scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(this.backgroundColor);

        // Perspective camera for spatial view (view 0)
        this.perspectiveCamera = new THREE.PerspectiveCamera(
            75,
            window.innerWidth / window.innerHeight,
            0.1,
            10000
        );
        this.perspectiveCamera.position.set(50, 50, 50);
        this.perspectiveCamera.lookAt(0, 0, 0);

        // Orthographic camera for flat views (views 1-6)
        const aspect = window.innerWidth / window.innerHeight;
        const frustumSize = 10;
        this.orthographicCamera = new THREE.OrthographicCamera(
            frustumSize * aspect / -2,
            frustumSize * aspect / 2,
            frustumSize / 2,
            frustumSize / -2,
            0.1,
            1000
        );

        // Start in spatial view (view 0)
        this.camera = this.perspectiveCamera;

        // Renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.container.appendChild(this.renderer.domElement);

        // Lights
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.4);
        directionalLight.position.set(50, 50, 50);
        this.scene.add(directionalLight);

        // Orbit controls (for spatial view only)
        this.controls = this.createOrbitControls(this.perspectiveCamera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.minDistance = 10;
        this.controls.maxDistance = 500;

        // Create reference cube
        this.createReferenceCube();

        // Create instanced geometry
        this.createInstancedGeometry();

        // Handle window resize
        window.addEventListener('resize', () => this.onWindowResize());
    }

    /**
     * Create simple orbit controls for spatial view
     */
    createOrbitControls(camera, domElement) {
        const controls = {
            camera: camera,
            domElement: domElement,
            enabled: true,
            enableDamping: true,
            dampingFactor: 0.05,
            minDistance: 10,
            maxDistance: 500,

            // Internal state
            spherical: new THREE.Spherical(50, Math.PI / 4, Math.PI / 4),
            target: new THREE.Vector3(0, 0, 0),
            rotating: false,
            lastMouse: { x: 0, y: 0 },

            update: function() {
                if (this.enableDamping && this.enabled) {
                    // Update camera position from spherical coordinates
                    const pos = new THREE.Vector3();
                    pos.setFromSpherical(this.spherical);
                    pos.add(this.target);
                    this.camera.position.copy(pos);
                    this.camera.lookAt(this.target);
                }
            }
        };

        // Mouse event handlers
        domElement.addEventListener('mousedown', (e) => {
            if (!controls.enabled) return;
            controls.rotating = true;
            controls.lastMouse = { x: e.clientX, y: e.clientY };
        });

        domElement.addEventListener('mousemove', (e) => {
            if (!controls.enabled || !controls.rotating) return;

            const deltaX = e.clientX - controls.lastMouse.x;
            const deltaY = e.clientY - controls.lastMouse.y;

            controls.spherical.theta -= deltaX * 0.01;
            controls.spherical.phi -= deltaY * 0.01;

            // Clamp phi to avoid gimbal lock
            controls.spherical.phi = Math.max(0.1, Math.min(Math.PI - 0.1, controls.spherical.phi));

            controls.lastMouse = { x: e.clientX, y: e.clientY };
        });

        domElement.addEventListener('mouseup', () => {
            controls.rotating = false;
        });

        domElement.addEventListener('mouseleave', () => {
            controls.rotating = false;
        });

        // Scroll for zoom
        domElement.addEventListener('wheel', (e) => {
            if (!controls.enabled) return;
            e.preventDefault();

            controls.spherical.radius += e.deltaY * 0.05;
            controls.spherical.radius = Math.max(
                controls.minDistance,
                Math.min(controls.maxDistance, controls.spherical.radius)
            );
        }, { passive: false });

        return controls;
    }

    /**
     * Create reference cube showing the 6 cardinal planes
     */
    createReferenceCube() {
        const size = 20; // Cube size
        const halfSize = size / 2;

        // Create a group to hold all cube faces
        const cubeGroup = new THREE.Group();

        // Edge colors for each face
        const edgeColors = {
            front: 0x4ECDC4,  // Front (+Z) - cyan
            back: 0xFF6B6B,   // Back (-Z) - red
            right: 0x95E1D3,  // Right (+X) - light green
            left: 0xFFA07A,   // Left (-X) - orange
            top: 0xF9ED69,    // Top (+Y) - yellow
            bottom: 0xAA96DA  // Bottom (-Y) - purple
        };

        // Create each face with light grey transparent material
        const createFace = (position, rotation) => {
            const geometry = new THREE.PlaneGeometry(size, size);
            const material = new THREE.MeshBasicMaterial({
                color: 0xcccccc,  // Light grey
                transparent: true,
                opacity: 0.1,
                side: THREE.DoubleSide
            });
            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.copy(position);
            mesh.rotation.copy(rotation);
            return mesh;
        };

        // Create colored outline for a face (4 edges)
        const createFaceOutline = (color, position, rotation) => {
            const points = [];
            const h = halfSize;

            // Create square outline
            points.push(new THREE.Vector3(-h, -h, 0));
            points.push(new THREE.Vector3(h, -h, 0));
            points.push(new THREE.Vector3(h, h, 0));
            points.push(new THREE.Vector3(-h, h, 0));
            points.push(new THREE.Vector3(-h, -h, 0)); // Close the loop

            const geometry = new THREE.BufferGeometry().setFromPoints(points);
            const material = new THREE.LineBasicMaterial({
                color: color,
                linewidth: 2
            });
            const line = new THREE.Line(geometry, material);

            line.position.copy(position);
            line.rotation.copy(rotation);

            return line;
        };

        // Front face (+Z) - light grey with cyan outline
        cubeGroup.add(createFace(
            new THREE.Vector3(0, 0, halfSize),
            new THREE.Euler(0, 0, 0)
        ));
        cubeGroup.add(createFaceOutline(
            edgeColors.front,
            new THREE.Vector3(0, 0, halfSize),
            new THREE.Euler(0, 0, 0)
        ));

        // Back face (-Z) - light grey with red outline
        cubeGroup.add(createFace(
            new THREE.Vector3(0, 0, -halfSize),
            new THREE.Euler(0, Math.PI, 0)
        ));
        cubeGroup.add(createFaceOutline(
            edgeColors.back,
            new THREE.Vector3(0, 0, -halfSize),
            new THREE.Euler(0, Math.PI, 0)
        ));

        // Right face (+X) - light grey with light green outline
        cubeGroup.add(createFace(
            new THREE.Vector3(halfSize, 0, 0),
            new THREE.Euler(0, Math.PI / 2, 0)
        ));
        cubeGroup.add(createFaceOutline(
            edgeColors.right,
            new THREE.Vector3(halfSize, 0, 0),
            new THREE.Euler(0, Math.PI / 2, 0)
        ));

        // Left face (-X) - light grey with orange outline
        cubeGroup.add(createFace(
            new THREE.Vector3(-halfSize, 0, 0),
            new THREE.Euler(0, -Math.PI / 2, 0)
        ));
        cubeGroup.add(createFaceOutline(
            edgeColors.left,
            new THREE.Vector3(-halfSize, 0, 0),
            new THREE.Euler(0, -Math.PI / 2, 0)
        ));

        // Top face (+Y) - light grey with yellow outline
        cubeGroup.add(createFace(
            new THREE.Vector3(0, halfSize, 0),
            new THREE.Euler(-Math.PI / 2, 0, 0)
        ));
        cubeGroup.add(createFaceOutline(
            edgeColors.top,
            new THREE.Vector3(0, halfSize, 0),
            new THREE.Euler(-Math.PI / 2, 0, 0)
        ));

        // Bottom face (-Y) - light grey with purple outline
        cubeGroup.add(createFace(
            new THREE.Vector3(0, -halfSize, 0),
            new THREE.Euler(Math.PI / 2, 0, 0)
        ));
        cubeGroup.add(createFaceOutline(
            edgeColors.bottom,
            new THREE.Vector3(0, -halfSize, 0),
            new THREE.Euler(Math.PI / 2, 0, 0)
        ));

        this.referenceCube = cubeGroup;
        this.referenceCube.userData.faceOutlines = {
            1: cubeGroup.children[1],   // Front outline
            2: cubeGroup.children[5],   // Right outline
            3: cubeGroup.children[3],   // Back outline
            4: cubeGroup.children[7],   // Left outline
            5: cubeGroup.children[9],   // Top outline
            6: cubeGroup.children[11]   // Bottom outline
        };
        this.scene.add(this.referenceCube);
    }

    /**
     * Create instanced frame geometry and buffers
     */
    createInstancedGeometry() {
        // Create base frame geometry (4 lines with extensions)
        const ext = 0.125; // Extension beyond corners
        const vertices = new Float32Array([
            // Top line (with extensions)
            -0.5 - ext, -0.5, 0,
            0.5 + ext, -0.5, 0,

            // Bottom line
            -0.5 - ext, 0.5, 0,
            0.5 + ext, 0.5, 0,

            // Left line
            -0.5, -0.5 - ext, 0,
            -0.5, 0.5 + ext, 0,

            // Right line
            0.5, -0.5 - ext, 0,
            0.5, 0.5 + ext, 0
        ]);

        const geometry = new THREE.InstancedBufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));

        // Create instance attribute buffers (pre-allocated for maxFrames)
        this.offsets = new Float32Array(this.maxFrames * 3);
        this.rotations = new Float32Array(this.maxFrames);
        this.normals = new Float32Array(this.maxFrames * 3); // î ĵ k̂ normal direction
        this.scales = new Float32Array(this.maxFrames);
        this.colors = new Float32Array(this.maxFrames * 3);
        this.selected = new Float32Array(this.maxFrames);

        // Add instance attributes
        geometry.setAttribute('offset', new THREE.InstancedBufferAttribute(this.offsets, 3));
        geometry.setAttribute('rotation', new THREE.InstancedBufferAttribute(this.rotations, 1));
        geometry.setAttribute('frameNormal', new THREE.InstancedBufferAttribute(this.normals, 3));
        geometry.setAttribute('scale', new THREE.InstancedBufferAttribute(this.scales, 1));
        geometry.setAttribute('instanceColor', new THREE.InstancedBufferAttribute(this.colors, 3));
        geometry.setAttribute('instanceSelected', new THREE.InstancedBufferAttribute(this.selected, 1));

        // Custom shader material
        const vertexShader = `
            attribute vec3 offset;
            attribute float rotation;
            attribute vec3 frameNormal;
            attribute float scale;
            attribute vec3 instanceColor;
            attribute float instanceSelected;

            varying vec3 vColor;
            varying float vSelected;

            // Create rotation matrix to align frame with its normal direction
            // Uses world-relative algorithm to maintain consistent "up" direction
            mat3 createOrientationMatrix(vec3 normal) {
                // Normalize input (should already be normalized, but just in case)
                vec3 n = normalize(normal);

                // Default frame is in XY plane with normal pointing in +Z
                vec3 defaultNormal = vec3(0.0, 0.0, 1.0);

                // If normal is same as default, return identity
                if (length(n - defaultNormal) < 0.001) {
                    return mat3(1.0);
                }

                // Build an orthonormal basis with n as the Z axis
                // Use world +Y as reference "up" direction for consistency
                vec3 worldUp = vec3(0.0, 1.0, 0.0);

                // If normal is parallel to worldUp, use worldRight as reference instead
                vec3 reference;
                if (abs(dot(n, worldUp)) > 0.999) {
                    reference = vec3(1.0, 0.0, 0.0); // Use +X when normal is ±Y
                } else {
                    reference = worldUp;
                }

                // Tangent (right) = perpendicular to both normal and reference
                // This gives us a consistent "right" direction
                vec3 tangent = normalize(cross(reference, n));

                // Bitangent (up) = perpendicular to tangent and normal
                // This is the frame's local "up" direction
                vec3 bitangent = normalize(cross(n, tangent));

                // Build rotation matrix with consistent orientation:
                // - tangent as new X axis (right direction in frame's plane)
                // - bitangent as new Y axis (up direction in frame's plane)
                // - n as new Z axis (normal direction, pointing out of frame)
                return mat3(
                    tangent.x, tangent.y, tangent.z,
                    bitangent.x, bitangent.y, bitangent.z,
                    n.x, n.y, n.z
                );
            }

            // Rodrigues' rotation formula: rotate vector v around axis k by angle theta
            vec3 rotateAroundAxis(vec3 v, vec3 k, float theta) {
                // k must be normalized
                vec3 kn = normalize(k);
                float cosTheta = cos(theta);
                float sinTheta = sin(theta);

                // Rodrigues' formula: v_rot = v*cos(θ) + (k×v)*sin(θ) + k*(k·v)*(1-cos(θ))
                return v * cosTheta + cross(kn, v) * sinTheta + kn * dot(kn, v) * (1.0 - cosTheta);
            }

            void main() {
                // Scale the base geometry
                vec3 pos = position * scale;

                // Apply roll rotation FIRST (in local space, around Z axis)
                // Roll rotates the frame in its own plane before orienting
                if (abs(rotation) > 0.001) {
                    float c = cos(rotation);
                    float s = sin(rotation);
                    // Rotate in XY plane (around Z axis)
                    pos = vec3(
                        pos.x * c - pos.y * s,
                        pos.x * s + pos.y * c,
                        pos.z
                    );
                }

                // Then orient frame to align with its normal direction
                // This transforms from local XY plane to world orientation
                mat3 orientation = createOrientationMatrix(frameNormal);
                pos = orientation * pos;

                // Translate to instance position
                pos += offset;

                // Apply camera transform
                gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);

                // Pass color and selection to fragment shader
                vColor = instanceColor;
                vSelected = instanceSelected;
            }
        `;

        const fragmentShader = `
            varying vec3 vColor;
            varying float vSelected;

            void main() {
                vec3 color = vColor;

                // Add glow for selected frames
                if (vSelected > 0.5) {
                    color = mix(vColor, vec3(1.0), 0.3);
                }

                gl_FragColor = vec4(color, 1.0);
            }
        `;

        const material = new THREE.ShaderMaterial({
            vertexShader: vertexShader,
            fragmentShader: fragmentShader,
        });

        // Create instanced mesh
        this.instancedMesh = new THREE.LineSegments(geometry, material);
        this.instancedMesh.frustumCulled = false;
        this.scene.add(this.instancedMesh);

        // Initialize with 0 instances
        geometry.instanceCount = 0;
    }

    /**
     * Update instance buffers from framework data
     */
    updateInstanceData() {
        const frames = this.framework.frames;
        const count = Math.min(frames.length, this.maxFrames);

        // Update instance count
        this.instancedMesh.geometry.instanceCount = count;

        // Fill instance buffers
        for (let i = 0; i < count; i++) {
            const frame = frames[i];

            // Position
            this.offsets[i * 3] = frame.x;
            this.offsets[i * 3 + 1] = frame.y;
            this.offsets[i * 3 + 2] = frame.z;

            // Rotation (roll angle)
            this.rotations[i] = frame.roll;

            // Normal direction (î ĵ k̂)
            this.normals[i * 3] = frame.ihat;
            this.normals[i * 3 + 1] = frame.jhat;
            this.normals[i * 3 + 2] = frame.khat;

            // Scale
            this.scales[i] = frame.size;

            // Color (convert hex to RGB)
            const color = new THREE.Color(frame.color);
            this.colors[i * 3] = color.r;
            this.colors[i * 3 + 1] = color.g;
            this.colors[i * 3 + 2] = color.b;

            // Selection
            this.selected[i] = frame.selected ? 1.0 : 0.0;
        }

        // Mark attributes as needing update
        this.instancedMesh.geometry.attributes.offset.needsUpdate = true;
        this.instancedMesh.geometry.attributes.rotation.needsUpdate = true;
        this.instancedMesh.geometry.attributes.frameNormal.needsUpdate = true;
        this.instancedMesh.geometry.attributes.scale.needsUpdate = true;
        this.instancedMesh.geometry.attributes.instanceColor.needsUpdate = true;
        this.instancedMesh.geometry.attributes.instanceSelected.needsUpdate = true;
    }

    /**
     * Create cursor visualization
     */
    createCursorMesh() {
        const cursor = this.framework.cursor;
        const size = 0.2;

        // Create small crosshair
        const material = new THREE.LineBasicMaterial({ color: 0xffffff });
        const points = [
            new THREE.Vector3(cursor.x - size, cursor.y, cursor.z),
            new THREE.Vector3(cursor.x + size, cursor.y, cursor.z),
            new THREE.Vector3(cursor.x, cursor.y, cursor.z), // Center
            new THREE.Vector3(cursor.x, cursor.y - size, cursor.z),
            new THREE.Vector3(cursor.x, cursor.y + size, cursor.z)
        ];

        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const line = new THREE.LineSegments(geometry, material);

        return line;
    }

    /**
     * Update scene to match framework state
     */
    update() {
        // Update instanced frame data
        this.updateInstanceData();

        // Update cursor
        if (this.framework.cursor.visible) {
            // Remove old cursor
            const oldCursor = this.scene.getObjectByName('cursor');
            if (oldCursor) {
                this.scene.remove(oldCursor);
            }

            // Add new cursor
            const cursorMesh = this.createCursorMesh();
            cursorMesh.name = 'cursor';
            this.scene.add(cursorMesh);
        }
    }

    /**
     * Render loop
     */
    render() {
        this.renderer.render(this.scene, this.camera);
    }

    /**
     * Handle window resize
     */
    onWindowResize() {
        const aspect = window.innerWidth / window.innerHeight;

        // Update perspective camera
        this.perspectiveCamera.aspect = aspect;
        this.perspectiveCamera.updateProjectionMatrix();

        // Update orthographic camera
        const frustumSize = 10;
        this.orthographicCamera.left = frustumSize * aspect / -2;
        this.orthographicCamera.right = frustumSize * aspect / 2;
        this.orthographicCamera.top = frustumSize / 2;
        this.orthographicCamera.bottom = frustumSize / -2;
        this.orthographicCamera.updateProjectionMatrix();

        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    /**
     * Animation loop
     */
    animate() {
        requestAnimationFrame(() => this.animate());

        // Update orbit controls if enabled
        if (this.controls && this.controls.enabled) {
            this.controls.update();
        }

        this.update();
        this.render();
    }

    /**
     * Start rendering
     */
    start() {
        this.animate();
    }

    /**
     * Set active working plane (highlights corresponding face)
     * 0 = no active plane (all outlines dim)
     * 1 = front (XY plane, +Z normal)
     * 2 = right (YZ plane, +X normal)
     * 3 = back (XY plane, -Z normal)
     * 4 = left (YZ plane, -X normal)
     * 5 = top (XZ plane, +Y normal)
     * 6 = bottom (XZ plane, -Y normal)
     *
     * Camera always stays in spatial view with orbit controls
     */
    setView(viewNumber) {
        // Always use perspective camera
        this.camera = this.perspectiveCamera;
        this.controls.enabled = true;

        if (!this.referenceCube) return;

        // Reset all outlines to dim
        const outlines = this.referenceCube.userData.faceOutlines;
        for (let key in outlines) {
            outlines[key].material.opacity = 0.3;
            outlines[key].material.transparent = true;
        }

        // Highlight active face
        if (viewNumber >= 1 && viewNumber <= 6) {
            outlines[viewNumber].material.opacity = 1.0;
        }

        const viewNames = ['Spatial', 'Front', 'Right', 'Back', 'Left', 'Top', 'Bottom'];
        console.log('Active plane:', viewNames[viewNumber]);
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { FrameworksInstancedRenderer };
}
