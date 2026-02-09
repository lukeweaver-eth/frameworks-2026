// build-combined.js
// Combines modular components into a single minified file for ETHFS deployment

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Load and increment version
function getNextVersion() {
  const versionPath = path.join(__dirname, '..', 'version.json');
  const versionData = JSON.parse(fs.readFileSync(versionPath, 'utf8'));

  // Parse current version
  const [major, minor, patch] = versionData.current.split('.').map(Number);

  // Increment patch version
  const nextVersion = `${major}.${minor}.${patch + 1}`;

  return { current: versionData.current, next: nextVersion, versionPath, versionData };
}

const { current, next, versionPath, versionData } = getNextVersion();
const VERSION = next;

// Module load order (dependencies first)
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

async function main() {
  console.log('\n' + '='.repeat(60));
  console.log(`BUILDING COMBINED FRAMEWORKS`);
  console.log('='.repeat(60));
  console.log(`\nCurrent version: ${current}`);
  console.log(`New version: ${VERSION}\n`);

  const srcDir = path.join(__dirname, '..', 'src');
  const outputFile = path.join(srcDir, `frameworks-${VERSION}-combined.js`);
  const minifiedFile = path.join(srcDir, `frameworks-${VERSION}-combined.min.js`);

  // Combine all modules
  console.log('Combining modules in dependency order...\n');
  let combined = '';
  let totalSize = 0;

  for (const module of modules) {
    const filepath = path.join(srcDir, module);
    if (!fs.existsSync(filepath)) {
      console.error(`❌ Module not found: ${filepath}`);
      process.exit(1);
    }

    const content = fs.readFileSync(filepath, 'utf8');
    const size = content.length;
    totalSize += size;

    console.log(`  ✓ ${module.padEnd(30)} ${(size / 1024).toFixed(2)} KB`);
    combined += `// === ${module} ===\n${content}\n\n`;
  }

  // Write combined file
  fs.writeFileSync(outputFile, combined);
  console.log(`\n✅ Combined file written: ${(totalSize / 1024).toFixed(2)} KB`);
  console.log(`   ${outputFile}\n`);

  // Minify using terser
  console.log('Minifying combined file...');
  try {
    execSync(`npx terser "${outputFile}" -c -m -o "${minifiedFile}"`, {
      stdio: 'inherit'
    });

    const minifiedSize = fs.statSync(minifiedFile).size;
    const compression = ((1 - minifiedSize / totalSize) * 100).toFixed(1);

    console.log(`\n✅ Minified: ${(minifiedSize / 1024).toFixed(2)} KB (${compression}% smaller)`);
    console.log(`   ${minifiedFile}\n`);

    // Update version.json
    versionData.current = VERSION;
    fs.writeFileSync(versionPath, JSON.stringify(versionData, null, 2));

    console.log('='.repeat(60));
    console.log('BUILD COMPLETE');
    console.log('='.repeat(60));
    console.log(`\n✅ Version updated: ${current} → ${VERSION}`);
    console.log(`Output: frameworks-${VERSION}-combined.min.js`);
    console.log(`Size: ${(minifiedSize / 1024).toFixed(2)} KB`);
    console.log('\nNext steps:');
    console.log('1. Test locally: Open test-combined.html in browser');
    console.log(`2. Upload to ETHFS: npx hardhat run scripts/upload-combined-to-ethfs.js --network sepolia`);
    console.log('3. Deploy renderer: npx hardhat run scripts/deploy-renderer-quick.js --network sepolia');
    console.log();

  } catch (error) {
    console.error('❌ Minification failed:', error.message);
    process.exit(1);
  }
}

main().catch(console.error);
