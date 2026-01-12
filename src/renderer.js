// frameworks-renderer-v3.0.js
// Three.js renderer for Frameworks V3

/**
 * Three.js renderer for visualizing frames
 */
class FrameworksRenderer {
    constructor(framework, containerId = 'container') {
        this.framework = framework;
        this.container = document.getElementById(containerId);

        // Three.js objects
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.frameMeshes = new Map(); // frame.count -> mesh

        // Rendering settings
        this.backgroundColor = 0x1a1a1a;
        this.lineWidth = 2;
        this.lineExtension = 0.125; // Extension beyond frame corners

        this.init();
    }

    /**
     * Initialize Three.js scene
     */
    init() {
        // Scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(this.backgroundColor);

        // Camera (orthographic for now, matching V2 front view)
        const aspect = window.innerWidth / window.innerHeight;
        const frustumSize = 10;
        this.camera = new THREE.OrthographicCamera(
            frustumSize * aspect / -2,
            frustumSize * aspect / 2,
            frustumSize / 2,
            frustumSize / -2,
            0.1,
            1000
        );
        this.camera.position.set(0, 0, 10);
        this.camera.lookAt(0, 0, 0);

        // Renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.container.appendChild(this.renderer.domElement);

        // Lights
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.4);
        directionalLight.position.set(5, 5, 5);
        this.scene.add(directionalLight);

        // Grid helper (optional)
        const gridHelper = new THREE.GridHelper(20, 20, 0x444444, 0x222222);
        gridHelper.rotation.x = Math.PI / 2; // Rotate to XY plane
        this.scene.add(gridHelper);

        // Handle window resize
        window.addEventListener('resize', () => this.onWindowResize());
    }

    /**
     * Render a single frame as 4 extended lines
     */
    createFrameMesh(frame) {
        const group = new THREE.Group();
        const corners = frame.getCorners();
        const color = new THREE.Color(frame.color);

        // Calculate extension vectors
        const halfSize = frame.size / 2;
        const ext = this.lineExtension * frame.size;

        // Create 4 lines: top, bottom, left, right
        const lines = [
            // Top: from top-left to top-right
            [
                [corners[0][0] - ext, corners[0][1], corners[0][2]],
                [corners[1][0] + ext, corners[1][1], corners[1][2]]
            ],
            // Bottom: from bottom-left to bottom-right
            [
                [corners[2][0] - ext, corners[2][1], corners[2][2]],
                [corners[3][0] + ext, corners[3][1], corners[3][2]]
            ],
            // Left: from top-left to bottom-left
            [
                [corners[0][0], corners[0][1] - ext, corners[0][2]],
                [corners[2][0], corners[2][1] + ext, corners[2][2]]
            ],
            // Right: from top-right to bottom-right
            [
                [corners[1][0], corners[1][1] - ext, corners[1][2]],
                [corners[3][0], corners[3][1] + ext, corners[3][2]]
            ]
        ];

        // Create line geometry for each edge
        lines.forEach(([start, end]) => {
            const points = [
                new THREE.Vector3(...start),
                new THREE.Vector3(...end)
            ];
            const geometry = new THREE.BufferGeometry().setFromPoints(points);
            const material = new THREE.LineBasicMaterial({
                color: color,
                linewidth: this.lineWidth
            });
            const line = new THREE.Line(geometry, material);
            group.add(line);
        });

        // Add selection glow if selected
        if (frame.selected) {
            const glowMaterial = new THREE.LineBasicMaterial({
                color: color,
                linewidth: this.lineWidth * 2,
                transparent: true,
                opacity: 0.3
            });

            lines.forEach(([start, end]) => {
                const points = [
                    new THREE.Vector3(...start),
                    new THREE.Vector3(...end)
                ];
                const geometry = new THREE.BufferGeometry().setFromPoints(points);
                const glowLine = new THREE.Line(geometry, glowMaterial);
                group.add(glowLine);
            });
        }

        return group;
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
        // Clear existing frame meshes
        this.frameMeshes.forEach((mesh) => {
            this.scene.remove(mesh);
        });
        this.frameMeshes.clear();

        // Add frame meshes
        this.framework.frames.forEach(frame => {
            if (frame.visible) {
                const mesh = this.createFrameMesh(frame);
                this.scene.add(mesh);
                this.frameMeshes.set(frame.count, mesh);
            }
        });

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
        const frustumSize = 10;

        this.camera.left = frustumSize * aspect / -2;
        this.camera.right = frustumSize * aspect / 2;
        this.camera.top = frustumSize / 2;
        this.camera.bottom = frustumSize / -2;
        this.camera.updateProjectionMatrix();

        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    /**
     * Animation loop
     */
    animate() {
        requestAnimationFrame(() => this.animate());
        this.update();
        this.render();
    }

    /**
     * Start rendering
     */
    start() {
        this.animate();
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { FrameworksRenderer };
}
