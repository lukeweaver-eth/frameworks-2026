// 3D projection system adapted from formula-main
// Uses perspective division: x/z, y/z

// Project 3D point to 2D using perspective division
function project({x, y, z}) {
    return {
        x: x/z,
        y: y/z
    };
}

// Convert normalized coordinates (-1..1) to screen pixels
function screen(p, width, height) {
    return {
        x: (p.x + 1)/2 * width,
        y: (1 - (p.y + 1)/2) * height
    };
}

// Full projection pipeline: 3D -> 2D -> screen
function projectToScreen(point3d, width, height) {
    const point2d = project(point3d);
    return screen(point2d, width, height);
}

export { project, screen, projectToScreen };
