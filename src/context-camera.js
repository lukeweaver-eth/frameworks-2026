// context-camera.js
// Camera context for Frameworks V3
// Handles view snapping, zoom, FOV, and projection mode

class CameraContext {
    constructor(framework, renderer) {
        this.framework = framework;
        this.renderer = renderer;
        this.active = false;

        // Camera state
        this.currentView = 0; // 0=spatial, 1-6=cardinal, 7=isometric, 9=auto-orbit
        this.orthographic = false; // Toggle for ortho/perspective
        this.autoOrbit = false; // Auto-orbit mode
        this.autoOrbitAngle = 0; // Current angle for auto-orbit

        // Orbit rotation velocities (for v8 mode)
        this.orbitVelocityTheta = 0; // Longitude rotation speed (radians/sec)
        this.orbitVelocityPhi = 0;   // Latitude rotation speed (radians/sec)
        this.orbitTheta = 0;          // Current longitude angle
        this.orbitPhi = Math.PI / 4;  // Current latitude angle

        // Zoom settings
        this.zoomLevel = 50; // Distance from origin
        this.zoomStep = 5; // Normal zoom step
        this.zoomStepLarge = 10; // 2x zoom step
        this.minZoom = 5;
        this.maxZoom = 500;

        // FOV settings
        this.fov = 75; // Default FOV in degrees
        this.fovStep = 5;
        this.fovStepLarge = 10; // Shift for 2x FOV step
        this.minFov = 10;
        this.maxFov = 120;
    }

    /**
     * Enter camera context
     */
    enter() {
        this.active = true;
        // console.log('Entered camera context');
    }

    /**
     * Exit camera context
     */
    exit() {
        this.active = false;
        // console.log('Exited camera context');
    }

    /**
     * Navigate with number keys (view selection)
     * 0 = spatial, 1-6 = cardinal, 7 = isometric, 8 = auto-orbit, 9 = toggle ortho
     */
    selectView(viewNum) {
        switch(viewNum) {
            case 0: // Spatial view (free orbit)
                this.currentView = 0;
                this.autoOrbit = false;
                this.renderer.setCameraView(0, this.orthographic, this.zoomLevel, this.fov);
                break;

            case 1: // Front
            case 2: // Right
            case 3: // Back
            case 4: // Left
            case 5: // Top
            case 6: // Bottom
                this.currentView = viewNum;
                this.autoOrbit = false;
                this.renderer.setCameraView(viewNum, this.orthographic, this.zoomLevel, this.fov);
                break;

            case 7: // Isometric
                this.currentView = 7;
                this.autoOrbit = false;
                this.renderer.setCameraView(7, this.orthographic, this.zoomLevel, this.fov);
                break;

            case 8: // Auto-orbit mode (smooth rotation with IJKL control)
                this.currentView = 8;
                this.autoOrbit = true;

                // Initialize from current camera position
                const currentPos = this.renderer.getCurrentCameraSpherical();
                this.orbitTheta = currentPos.theta;
                this.orbitPhi = currentPos.phi;
                this.zoomLevel = currentPos.radius;

                this.orbitVelocityTheta = 0;  // Reset rotation velocities
                this.orbitVelocityPhi = 0;
                this.renderer.setCameraView(8, this.orthographic, this.zoomLevel, this.fov);
                // Camera is already at current position, no need to set initial position
                // console.log('Auto-orbit mode activated from current position');
                break;

            case 9: // Toggle orthographic/perspective
                this.orthographic = !this.orthographic;
                // console.log('Projection:', this.orthographic ? 'orthographic' : 'perspective');
                this.renderer.setCameraView(this.currentView, this.orthographic, this.zoomLevel, this.fov);
                break;
        }

        // console.log('Camera view:', viewNum);
    }

    /**
     * Navigate with ijkl
     * In auto-orbit mode (v8): IJKL controls rotation velocity (smooth rotation)
     * Otherwise: zoom (i/k) and FOV (j/l)
     */
    navigate(key, shift = false) {
        // Auto-orbit mode: control rotation velocity
        if (this.currentView === 8 && this.autoOrbit) {
            const rotationSpeed = 0.5; // radians per second

            switch(key) {
                case 'J': // Rotate left (longitude) - uppercase
                    this.orbitVelocityTheta = -rotationSpeed;
                    return true;

                case 'L': // Rotate right (longitude) - uppercase
                    this.orbitVelocityTheta = rotationSpeed;
                    return true;

                case 'I': // Rotate up (latitude) - uppercase
                    this.orbitVelocityPhi = -rotationSpeed;
                    return true;

                case 'K': // Rotate down (latitude) - uppercase
                    this.orbitVelocityPhi = rotationSpeed;
                    return true;

                // Lowercase stops rotation in that axis
                case 'j':
                case 'l':
                    this.orbitVelocityTheta = 0;
                    return true;

                case 'i':
                case 'k':
                    this.orbitVelocityPhi = 0;
                    return true;
            }
            return false;
        }

        // Default behavior: zoom and FOV
        switch(key) {
            case 'i': // Zoom in
                const zoomInStep = shift ? this.zoomStepLarge : this.zoomStep;
                this.zoomLevel = Math.max(this.minZoom, this.zoomLevel - zoomInStep);
                this.renderer.setCameraZoom(this.zoomLevel);
                // console.log('Zoom in:', this.zoomLevel);
                return true;

            case 'k': // Zoom out
                const zoomOutStep = shift ? this.zoomStepLarge : this.zoomStep;
                this.zoomLevel = Math.min(this.maxZoom, this.zoomLevel + zoomOutStep);
                this.renderer.setCameraZoom(this.zoomLevel);
                // console.log('Zoom out:', this.zoomLevel);
                return true;

            case 'j': // Widen FOV
                const widenStep = shift ? this.fovStepLarge : this.fovStep;
                this.fov = Math.min(this.maxFov, this.fov + widenStep);
                this.renderer.setCameraFOV(this.fov);
                // console.log('FOV:', this.fov, shift ? '(+10°)' : '(+5°)');
                return true;

            case 'l': // Narrow FOV
                const narrowStep = shift ? this.fovStepLarge : this.fovStep;
                this.fov = Math.max(this.minFov, this.fov - narrowStep);
                this.renderer.setCameraFOV(this.fov);
                // console.log('FOV:', this.fov, shift ? '(-10°)' : '(-5°)');
                return true;
        }
        return false;
    }

    /**
     * Update auto-orbit (called from animation loop)
     * In v8 mode, applies smooth rotation based on IJKL velocity controls
     */
    updateAutoOrbit(deltaTime) {
        if (!this.autoOrbit) return;

        // In v8 mode, apply velocity-based smooth rotation
        if (this.currentView === 8) {
            // Update angles based on velocities
            this.orbitTheta += this.orbitVelocityTheta * deltaTime;
            this.orbitPhi += this.orbitVelocityPhi * deltaTime;

            // No clamping or wrapping - phi can continue indefinitely
            // The spherical-to-cartesian conversion naturally handles continuous rotation
            // When phi > PI, the camera goes over the pole and continues on the other side

            // Update camera position
            this.renderer.setManualOrbitPosition(this.orbitTheta, this.orbitPhi, this.zoomLevel);
            return;
        }

        // Automatic rotation for other auto-orbit scenarios (if any)
        this.autoOrbitAngle += deltaTime * 0.5; // 0.5 radians per second
        this.renderer.setAutoOrbitAngle(this.autoOrbitAngle, this.zoomLevel);
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CameraContext };
}
