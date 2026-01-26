// Rendering module for drawing frames
// Adapted from formula-main's rendering approach
import { projectToScreen } from './projection.js';

const BACKGROUND = "#101010";
const DEFAULT_FOREGROUND = "#50FF50";

class Renderer {
    constructor(canvas, camera) {
        this.canvas = canvas;
        this.ctx = canvas.getContext("2d");
        this.width = canvas.width;
        this.height = canvas.height;
        this.camera = camera;
    }

    clear() {
        this.ctx.fillStyle = BACKGROUND;
        this.ctx.fillRect(0, 0, this.width, this.height);
    }

    // Draw a line between two 3D points
    drawLine(p1, p2, color = DEFAULT_FOREGROUND, width = 2) {
        // Transform to camera space
        const cp1 = this.camera.transform(p1);
        const cp2 = this.camera.transform(p2);

        const sp1 = projectToScreen(cp1, this.width, this.height);
        const sp2 = projectToScreen(cp2, this.width, this.height);

        this.ctx.lineWidth = width;
        this.ctx.strokeStyle = color;
        this.ctx.beginPath();
        this.ctx.moveTo(sp1.x, sp1.y);
        this.ctx.lineTo(sp2.x, sp2.y);
        this.ctx.stroke();
    }

    // Draw a point at a 3D location
    drawPoint(p, color = DEFAULT_FOREGROUND, size = 8) {
        const cp = this.camera.transform(p);
        const sp = projectToScreen(cp, this.width, this.height);
        this.ctx.fillStyle = color;
        this.ctx.fillRect(sp.x - size/2, sp.y - size/2, size, size);
    }

    // Draw a single frame (# shape)
    drawFrame(frame) {
        // Get frame lines in world space
        const lines = frame.getLines();
        const color = frame.chosen ? "#FFFF50" : frame.color;
        const width = frame.chosen ? 3 : 2;

        // Draw each line (transform happens in drawLine)
        lines.forEach(line => {
            this.drawLine(line.p1, line.p2, color, width);
        });
    }

    // Draw the cursor
    drawCursor(cursor) {
        const cursorSize = 6;
        this.drawPoint(cursor, "#FF5050", cursorSize);
    }

    // Draw entire framework
    drawFramework(framework, cursor) {
        this.clear();

        // Draw view indicator
        this.drawViewIndicator();

        // Draw all frames
        framework.forEach(frame => {
            this.drawFrame(frame);
        });

        // Draw cursor
        if (cursor) {
            this.drawCursor(cursor);
        }
    }

    // Draw text content (for frame contents/names)
    drawText(text, p, color = DEFAULT_FOREGROUND) {
        const cp = this.camera.transform(p);
        const sp = projectToScreen(cp, this.width, this.height);
        this.ctx.fillStyle = color;
        this.ctx.font = "12px monospace";
        this.ctx.fillText(text, sp.x + 10, sp.y - 10);
    }

    // Draw view indicator
    drawViewIndicator() {
        this.ctx.fillStyle = "#50FF50";
        this.ctx.font = "14px monospace";
        this.ctx.fillText(`View: ${this.camera.getViewName()}`, 10, 20);
    }

    // Resize canvas
    resize(width, height) {
        this.canvas.width = width;
        this.canvas.height = height;
        this.width = width;
        this.height = height;
    }
}

export { Renderer };
