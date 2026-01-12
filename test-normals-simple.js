// Simple test of rotation logic

// Simulate Frame.rotate() method
function rotateNormal(normal, angle, axis) {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    let ihat = normal[0];
    let jhat = normal[1];
    let khat = normal[2];

    switch (axis) {
        case 'x':
            return [
                ihat,
                jhat * cos - khat * sin,
                jhat * sin + khat * cos
            ];

        case 'y':
            return [
                ihat * cos + khat * sin,
                jhat,
                -ihat * sin + khat * cos
            ];

        case 'z':
            return [
                ihat * cos - jhat * sin,
                ihat * sin + jhat * cos,
                khat
            ];
    }
}

function checkOrthogonality(n0, n1, n2, label) {
    console.log(`\n=== ${label} ===`);
    console.log(`n0: (${n0[0].toFixed(4)}, ${n0[1].toFixed(4)}, ${n0[2].toFixed(4)})`);
    console.log(`n1: (${n1[0].toFixed(4)}, ${n1[1].toFixed(4)}, ${n1[2].toFixed(4)})`);
    console.log(`n2: (${n2[0].toFixed(4)}, ${n2[1].toFixed(4)}, ${n2[2].toFixed(4)})`);

    const dot01 = n0[0]*n1[0] + n0[1]*n1[1] + n0[2]*n1[2];
    const dot02 = n0[0]*n2[0] + n0[1]*n2[1] + n0[2]*n2[2];
    const dot12 = n1[0]*n2[0] + n1[1]*n2[1] + n1[2]*n2[2];

    console.log(`Dot products: ${dot01.toFixed(6)}, ${dot02.toFixed(6)}, ${dot12.toFixed(6)}`);

    const angle01 = Math.acos(Math.max(-1, Math.min(1, dot01))) * 180 / Math.PI;
    const angle02 = Math.acos(Math.max(-1, Math.min(1, dot02))) * 180 / Math.PI;
    const angle12 = Math.acos(Math.max(-1, Math.min(1, dot12))) * 180 / Math.PI;

    console.log(`Angles: ${angle01.toFixed(2)}°, ${angle02.toFixed(2)}°, ${angle12.toFixed(2)}°`);

    const isOrthogonal = Math.abs(dot01) < 0.01 && Math.abs(dot02) < 0.01 && Math.abs(dot12) < 0.01;
    console.log(isOrthogonal ? '✓ ORTHOGONAL' : '✗ NOT ORTHOGONAL');

    return isOrthogonal;
}

console.log('Testing Frame Normal Orthogonality During Rotations');
console.log('===================================================\n');

// Initial coordinate system
let n0 = [0, 0, 1]; // +Z (view 1, XY plane)
let n1 = [0, 1, 0]; // +Y (view 5, XZ plane)
let n2 = [1, 0, 0]; // +X (view 2, YZ plane)

checkOrthogonality(n0, n1, n2, 'Initial: 1fp5fpp2fppp');

// Test 1: Rotate all 8 times by 45° around Y axis (view 5)
console.log('\n\n━━━ TEST 1: Eight 45° rotations around Y axis ━━━');
for (let i = 1; i <= 8; i++) {
    n0 = rotateNormal(n0, Math.PI / 4, 'y');
    n1 = rotateNormal(n1, Math.PI / 4, 'y');
    n2 = rotateNormal(n2, Math.PI / 4, 'y');

    if (i === 1 || i === 2 || i === 4 || i === 8) {
        checkOrthogonality(n0, n1, n2, `After ${i} × 45° around Y`);
    }
}

// Reset
n0 = [0, 0, 1];
n1 = [0, 1, 0];
n2 = [1, 0, 0];

// Test 2: Rotate all 8 times by 45° around Z axis (view 1)
console.log('\n\n━━━ TEST 2: Eight 45° rotations around Z axis ━━━');
for (let i = 1; i <= 8; i++) {
    n0 = rotateNormal(n0, Math.PI / 4, 'z');
    n1 = rotateNormal(n1, Math.PI / 4, 'z');
    n2 = rotateNormal(n2, Math.PI / 4, 'z');

    if (i === 1 || i === 2 || i === 4 || i === 8) {
        checkOrthogonality(n0, n1, n2, `After ${i} × 45° around Z`);
    }
}

// Reset
n0 = [0, 0, 1];
n1 = [0, 1, 0];
n2 = [1, 0, 0];

// Test 3: User's sequence - 8 × 45° around Y, then 1 × 45° around Z
console.log('\n\n━━━ TEST 3: User\'s Sequence (8×Y then 1×Z) ━━━');
for (let i = 1; i <= 8; i++) {
    n0 = rotateNormal(n0, Math.PI / 4, 'y');
    n1 = rotateNormal(n1, Math.PI / 4, 'y');
    n2 = rotateNormal(n2, Math.PI / 4, 'y');
}
checkOrthogonality(n0, n1, n2, 'After 8 × 45° around Y');

n0 = rotateNormal(n0, Math.PI / 4, 'z');
n1 = rotateNormal(n1, Math.PI / 4, 'z');
n2 = rotateNormal(n2, Math.PI / 4, 'z');
checkOrthogonality(n0, n1, n2, 'After additional 1 × 45° around Z');

console.log('\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('CONCLUSION');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
console.log('If ALL tests show ORTHOGONAL:');
console.log('  → The rotation math in core.js is CORRECT');
console.log('  → The normals remain orthogonal as expected');
console.log('  → Visual issue must be in SHADER rendering\n');
console.log('If ANY test shows NOT ORTHOGONAL:');
console.log('  → There is a bug in the rotation logic');
console.log('  → Need to fix core.js rotation code');
