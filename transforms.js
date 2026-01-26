// Spatial transformation functions for frames
// Based on formula-main's transformation approach

// Translate in Z direction
function translateZ(point, dz) {
    return {
        x: point.x,
        y: point.y,
        z: point.z + dz
    };
}

// Translate in XY plane
function translateXY(point, dx, dy) {
    return {
        x: point.x + dx,
        y: point.y + dy,
        z: point.z
    };
}

// Rotate in XZ plane (around Y axis)
function rotateXZ(point, angle) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    return {
        x: point.x * c - point.z * s,
        y: point.y,
        z: point.x * s + point.z * c
    };
}

// Rotate in XY plane (around Z axis)
function rotateXY(point, angle) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    return {
        x: point.x * c - point.y * s,
        y: point.x * s + point.y * c,
        z: point.z
    };
}

// Reflect horizontal (across Y axis)
function reflectH(point) {
    return {
        x: -point.x,
        y: point.y,
        z: point.z
    };
}

// Reflect vertical (across X axis)
function reflectV(point) {
    return {
        x: point.x,
        y: -point.y,
        z: point.z
    };
}

// Apply transformation to a frame
function transformFrame(frame, transformFn) {
    const transformed = transformFn({
        x: frame.x,
        y: frame.y,
        z: frame.z
    });
    frame.x = transformed.x;
    frame.y = transformed.y;
    frame.z = transformed.z;
}

// Duplicate a frame
function duplicateFrame(frame, nextId) {
    const copy = Object.create(Object.getPrototypeOf(frame));
    Object.assign(copy, frame);
    copy.count = nextId;
    copy.chosen = false;
    return copy;
}

export {
    translateZ,
    translateXY,
    rotateXZ,
    rotateXY,
    reflectH,
    reflectV,
    transformFrame,
    duplicateFrame
};
