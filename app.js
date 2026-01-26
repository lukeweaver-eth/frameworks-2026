// Main application - orchestrates all modules
import { createFramework } from './frame.js';
import { CommandSystem } from './commands.js';
import { Renderer } from './render.js';
import { Camera } from './camera.js';
import { rotateXY } from './transforms.js';

class FrameworksApp {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.canvas.width = 800;
        this.canvas.height = 800;

        this.framework = createFramework();
        this.camera = new Camera();
        this.commands = new CommandSystem(this.framework, this.camera);
        this.renderer = new Renderer(this.canvas, this.camera);

        this.angle = 0;
        this.animating = false;
        this.FPS = 60;

        // Drag state
        this.dragging = false;
        this.draggedFrames = [];
        this.dragStart = { x: 0, y: 0 };
        this.dragStartPositions = [];

        this.setupEventListeners();
        this.start();
    }

    setupEventListeners() {
        // Keyboard input
        document.addEventListener('keydown', (e) => {
            e.preventDefault();
            this.handleKeypress(e.key);
        });

        // Mouse input for drag
        this.canvas.addEventListener('mousedown', (e) => {
            this.handleMouseDown(e);
        });

        this.canvas.addEventListener('mousemove', (e) => {
            this.handleMouseMove(e);
        });

        this.canvas.addEventListener('mouseup', (e) => {
            this.handleMouseUp(e);
        });

        // Prevent context menu on right click
        this.canvas.addEventListener('contextmenu', (e) => {
            e.preventDefault();
        });
    }

    handleKeypress(key) {
        console.log('Key pressed:', key);

        // Ignore modifier keys
        if (['Shift', 'Control', 'Alt', 'Meta', 'CapsLock'].includes(key)) {
            return;
        }

        // Handle special keys
        if (key === 'm') {
            this.animating = !this.animating;
            return;
        }

        // Handle camera views (1-6)
        if (['1', '2', '3', '4', '5', '6'].includes(key)) {
            this.camera.setView(parseInt(key));
            this.render();
            return;
        }

        // Execute command
        this.commands.execute(key);

        // Update framework reference (in case delete modified it)
        this.framework = this.commands.framework;

        this.render();
    }

    handleMouseDown(e) {
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        // Check if clicking on a chosen frame
        const chosen = this.framework.filter(f => f.chosen);
        if (chosen.length > 0) {
            this.dragging = true;
            this.draggedFrames = chosen;
            this.dragStart = { x: mouseX, y: mouseY };
            // Store initial positions
            this.dragStartPositions = chosen.map(f => ({ x: f.x, y: f.y, z: f.z }));
        }
    }

    handleMouseMove(e) {
        if (!this.dragging) return;

        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        // Calculate delta in screen space
        const dx = mouseX - this.dragStart.x;
        const dy = mouseY - this.dragStart.y;

        // Convert screen delta to world space
        // Screen coordinates: 0..800, World coordinates: -1..1 after projection
        const worldDx = (dx / this.canvas.width) * 2;
        const worldDy = -(dy / this.canvas.height) * 2; // Negative because screen Y is inverted

        // Update frame positions
        this.draggedFrames.forEach((frame, i) => {
            const startPos = this.dragStartPositions[i];
            frame.x = startPos.x + worldDx * startPos.z; // Scale by z for perspective
            frame.y = startPos.y + worldDy * startPos.z;
        });

        this.render();
    }

    handleMouseUp(e) {
        if (this.dragging) {
            this.dragging = false;
            this.draggedFrames = [];
            this.dragStartPositions = [];
        }
    }

    render() {
        this.renderer.drawFramework(this.framework, this.commands.cursor);
    }

    frame() {
        if (this.animating) {
            const dt = 1 / this.FPS;
            this.angle += Math.PI * dt;

            // Apply rotation to all frames
            this.framework.forEach(frame => {
                const rotated = rotateXY({ x: frame.x, y: frame.y, z: frame.z }, dt * Math.PI);
                frame.x = rotated.x;
                frame.y = rotated.y;
                frame.z = rotated.z;
            });
        }

        this.render();
        setTimeout(() => this.frame(), 1000 / this.FPS);
    }

    start() {
        console.log('Frameworks started');
        this.render();
        this.frame();
    }

    // Export command log for blockchain storage
    exportCommands() {
        return this.commands.getCommandLog();
    }
}

export { FrameworksApp };
