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
        console.log('Entered camera context');
    }

    /**
     * Exit camera context
     */
    exit() {
        this.active = false;
        console.log('Exited camera context');
    }

    /**
     * Navigate with number keys (view selection)
     * 0 = spatial, 1-6 = cardinal, 7 = isometric, 8 = toggle ortho, 9 = auto-orbit
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

            case 8: // Toggle orthographic/perspective
                this.orthographic = !this.orthographic;
                console.log('Projection:', this.orthographic ? 'orthographic' : 'perspective');
                this.renderer.setCameraView(this.currentView, this.orthographic, this.zoomLevel, this.fov);
                break;

            case 9: // Auto-orbit mode
                this.currentView = 9;
                this.autoOrbit = true;
                this.autoOrbitAngle = 0;
                console.log('Auto-orbit mode activated');
                break;
        }

        console.log('Camera view:', viewNum);
    }

    /**
     * Navigate with ijkl (zoom and FOV)
     */
    navigate(key, shift = false) {
        switch(key) {
            case 'i': // Zoom in
                const zoomInStep = shift ? this.zoomStepLarge : this.zoomStep;
                this.zoomLevel = Math.max(this.minZoom, this.zoomLevel - zoomInStep);
                this.renderer.setCameraZoom(this.zoomLevel);
                console.log('Zoom in:', this.zoomLevel);
                return true;

            case 'k': // Zoom out
                const zoomOutStep = shift ? this.zoomStepLarge : this.zoomStep;
                this.zoomLevel = Math.min(this.maxZoom, this.zoomLevel + zoomOutStep);
                this.renderer.setCameraZoom(this.zoomLevel);
                console.log('Zoom out:', this.zoomLevel);
                return true;

            case 'j': // Widen FOV
                const widenStep = shift ? this.fovStepLarge : this.fovStep;
                this.fov = Math.min(this.maxFov, this.fov + widenStep);
                this.renderer.setCameraFOV(this.fov);
                console.log('FOV:', this.fov, shift ? '(+10°)' : '(+5°)');
                return true;

            case 'l': // Narrow FOV
                const narrowStep = shift ? this.fovStepLarge : this.fovStep;
                this.fov = Math.max(this.minFov, this.fov - narrowStep);
                this.renderer.setCameraFOV(this.fov);
                console.log('FOV:', this.fov, shift ? '(-10°)' : '(-5°)');
                return true;
        }
        return false;
    }

    /**
     * Update auto-orbit (called from animation loop)
     */
    updateAutoOrbit(deltaTime) {
        if (!this.autoOrbit) return;

        // Rotate around Y axis
        this.autoOrbitAngle += deltaTime * 0.5; // 0.5 radians per second
        this.renderer.setAutoOrbitAngle(this.autoOrbitAngle, this.zoomLevel);
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CameraContext };
}
