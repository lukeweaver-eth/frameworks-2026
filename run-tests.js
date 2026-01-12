// Node.js script to run the tests and output results
const fs = require('fs');

// Load the core modules
const coreCode = fs.readFileSync('./src/core.js', 'utf8');
const paletteCode = fs.readFileSync('./src/palette.js', 'utf8');
const commandsCode = fs.readFileSync('./src/commands.js', 'utf8');

// Store original console
const originalConsole = console;

// Create a minimal environment
global.console = {
    log: (...args) => originalConsole.log(...args)
};

// Execute core code
eval(coreCode);
eval(paletteCode);
eval(commandsCode);

console.log('=== ORTHOGONALITY TEST ===\n');

// Create framework
const fw = new Framework();
const palette = new PaletteManager();
const executor = new CommandExecutor(fw, palette, null);

function checkOrthogonality(frames, stepName) {
    console.log(`\n--- ${stepName} ---`);

    if (frames.length < 3) {
        console.log('Not enough frames');
        return;
    }

    const f0 = frames[0];
    const f1 = frames[1];
    const f2 = frames[2];

    const n0 = { x: f0.ihat, y: f0.jhat, z: f0.khat };
    const n1 = { x: f1.ihat, y: f1.jhat, z: f1.khat };
    const n2 = { x: f2.ihat, y: f2.jhat, z: f2.khat };

    console.log(`Frame 0 normal: (${n0.x.toFixed(4)}, ${n0.y.toFixed(4)}, ${n0.z.toFixed(4)}), roll: ${f0.roll.toFixed(4)}`);
    console.log(`Frame 1 normal: (${n1.x.toFixed(4)}, ${n1.y.toFixed(4)}, ${n1.z.toFixed(4)}), roll: ${f1.roll.toFixed(4)}`);
    console.log(`Frame 2 normal: (${n2.x.toFixed(4)}, ${n2.y.toFixed(4)}, ${n2.z.toFixed(4)}), roll: ${f2.roll.toFixed(4)}`);

    // Calculate dot products
    const dot01 = n0.x * n1.x + n0.y * n1.y + n0.z * n1.z;
    const dot02 = n0.x * n2.x + n0.y * n2.y + n0.z * n2.z;
    const dot12 = n1.x * n2.x + n1.y * n2.y + n1.z * n2.z;

    console.log('\nDot products (should be ~0.0):');
    console.log(`  n0 · n1 = ${dot01.toFixed(6)} ${Math.abs(dot01) < 0.01 ? '✓' : '✗'}`);
    console.log(`  n0 · n2 = ${dot02.toFixed(6)} ${Math.abs(dot02) < 0.01 ? '✓' : '✗'}`);
    console.log(`  n1 · n2 = ${dot12.toFixed(6)} ${Math.abs(dot12) < 0.01 ? '✓' : '✗'}`);

    // Calculate angles
    const angle01 = Math.acos(Math.max(-1, Math.min(1, dot01))) * 180 / Math.PI;
    const angle02 = Math.acos(Math.max(-1, Math.min(1, dot02))) * 180 / Math.PI;
    const angle12 = Math.acos(Math.max(-1, Math.min(1, dot12))) * 180 / Math.PI;

    console.log('\nAngles between normals:');
    console.log(`  ∠(n0, n1) = ${angle01.toFixed(2)}° ${Math.abs(angle01 - 90) < 1 ? '✓' : '✗'}`);
    console.log(`  ∠(n0, n2) = ${angle02.toFixed(2)}° ${Math.abs(angle02 - 90) < 1 ? '✓' : '✗'}`);
    console.log(`  ∠(n1, n2) = ${angle12.toFixed(2)}° ${Math.abs(angle12 - 90) < 1 ? '✓' : '✗'}`);

    const isOrthogonal = Math.abs(dot01) < 0.01 && Math.abs(dot02) < 0.01 && Math.abs(dot12) < 0.01;

    if (isOrthogonal) {
        console.log('\n✓ ORTHOGONAL');
    } else {
        console.log('\n✗ NOT ORTHOGONAL');
    }

    return isOrthogonal;
}

// Test 1: Initial creation
console.log('\n=== TEST 1: Initial Creation (1fp5fpp2fppp) ===');
executor.executeCommandString('1fp5fpp2fppp');
checkOrthogonality(fw.frames, 'Initial State');

// Test 2: Eight 45° rotations around Z
console.log('\n\n=== TEST 2: Eight 45° rotations around Z axis ===');
fw.frames = [];
fw.cursor.snapToOrigin();
executor.executeCommandString('1fp5fpp2fppp');

for (let i = 1; i <= 8; i++) {
    executor.executeKey('R');
    if (i === 1 || i === 2 || i === 4 || i === 8) {
        checkOrthogonality(fw.frames, `After ${i} × 45° rotation around Z`);
    }
}

// Test 3: Eight 45° rotations around Y
console.log('\n\n=== TEST 3: Eight 45° rotations around Y axis ===');
fw.frames = [];
fw.cursor.snapToOrigin();
executor.executeCommandString('1fp5fpp2fppp');
executor.executeKey('5'); // Switch to view 5

for (let i = 1; i <= 8; i++) {
    executor.executeKey('R');
    if (i === 1 || i === 2 || i === 4 || i === 8) {
        checkOrthogonality(fw.frames, `After ${i} × 45° rotation around Y`);
    }
}

// Test 4: User's exact sequence
console.log('\n\n=== TEST 4: User\'s Exact Sequence ===');
fw.frames = [];
fw.cursor.snapToOrigin();

executor.executeCommandString('1fp5fpp2fppp');
checkOrthogonality(fw.frames, 'Initial');

executor.executeCommandString('5'); // Switch to view 5
for (let i = 1; i <= 8; i++) {
    executor.executeKey('R');
}
checkOrthogonality(fw.frames, 'After 8 × 45° around Y');

executor.executeCommandString('1R');
checkOrthogonality(fw.frames, 'After final 45° around Z');

console.log('\n\n=== CONCLUSION ===');
console.log('If normals remain orthogonal throughout all tests,');
console.log('but frames LOOK wrong visually, the issue is in');
console.log('the SHADER rendering, not the data model.');
