// Build modular minified versions for ETHFS deployment
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const modules = [
  'core.js',
  'palette.js',
  'context-color.js',
  'context-camera.js',
  'context-selection.js',
  'command-tree.js',
  'commands.js',
  'renderer-instanced.js'
];

const srcDir = path.join(__dirname, '..', 'src');
const outputDir = path.join(__dirname, '..', 'src', 'modules');

// Create output directory
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

console.log('Building modular Frameworks components for ETHFS...\n');

modules.forEach((module, index) => {
  const inputPath = path.join(srcDir, module);
  const outputName = module.replace('.js', '.min.js');
  const outputPath = path.join(outputDir, outputName);

  console.log(`${index + 1}/${modules.length} Minifying ${module}...`);

  try {
    // Use terser to minify (with quoted paths for spaces)
    execSync(`npx terser "${inputPath}" -c -m -o "${outputPath}"`, {
      stdio: 'inherit'
    });

    const originalSize = fs.statSync(inputPath).size;
    const minifiedSize = fs.statSync(outputPath).size;
    const savings = ((1 - minifiedSize / originalSize) * 100).toFixed(1);

    console.log(`  ✓ ${originalSize} bytes → ${minifiedSize} bytes (${savings}% reduction)\n`);
  } catch (error) {
    console.error(`  ✗ Failed to minify ${module}:`, error.message);
  }
});

console.log('Done! Minified modules are in src/modules/\n');

// Generate upload list
const uploadList = modules.map(m => {
  const minName = m.replace('.js', '.min.js');
  const ethfsName = `frameworks-v3.1-${m.replace('.js', '')}.min.js`;
  const size = fs.statSync(path.join(outputDir, minName)).size;
  return { file: `src/modules/${minName}`, ethfsName, size };
});

console.log('Files ready for ETHFS upload:');
uploadList.forEach(({ file, ethfsName, size }) => {
  console.log(`  ${file} → ${ethfsName} (${size} bytes)`);
});

const totalSize = uploadList.reduce((sum, { size }) => sum + size, 0);
console.log(`\nTotal size: ${totalSize} bytes (${(totalSize / 1024).toFixed(1)} KB)`);
console.log(`Current monolithic: 46,989 bytes (46.0 KB)`);
console.log(`Savings: ${((1 - totalSize / 46989) * 100).toFixed(1)}%\n`);
