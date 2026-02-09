// deploy-renderer-quick.js
// Quick deployment of FrameworksRendererV3 with combined file

const fs = require('fs');
const path = require('path');
const hre = require('hardhat');

// Load version from version.json
const versionPath = path.join(__dirname, '..', 'version.json');
const versionData = JSON.parse(fs.readFileSync(versionPath, 'utf8'));
const VERSION = versionData.current;
const ETHFS_FILENAME = `frameworks-${VERSION}-combined.min.js`;

async function main() {
  console.log('\n' + '='.repeat(60));
  console.log(`DEPLOYING FRAMEWORKS RENDERER V3 (${VERSION})`);
  console.log('='.repeat(60) + '\n');

  const [deployer] = await hre.ethers.getSigners();
  console.log('Deploying with account:', deployer.address);
  console.log('Account balance:', hre.ethers.utils.formatEther(await deployer.getBalance()), 'ETH');
  console.log('Network:', hre.network.name, '\n');

  // ArtifactReader library address on Sepolia
  const ARTIFACT_READER = "0x4722F16408aF27378a782eda6cE88F46905e5227";

  console.log('Using ArtifactReader library at:', ARTIFACT_READER);
  console.log('ETHFS file:', ETHFS_FILENAME);
  console.log();

  // Deploy with library linking
  console.log('Deploying FrameworksRendererV3...');
  const FrameworksRendererV3 = await hre.ethers.getContractFactory("FrameworksRendererV3", {
    libraries: {
      "@visualizevalue/mint/contracts/contracts/libraries/ArtifactReader.sol:ArtifactReader": ARTIFACT_READER
    }
  });

  const renderer = await FrameworksRendererV3.deploy();
  await renderer.deployed();

  console.log('✅ FrameworksRendererV3 deployed to:', renderer.address);
  console.log();

  // Verify renderer info
  console.log('Verifying renderer...');
  const name = await renderer.name();
  const version = await renderer.version();
  console.log('  Name:', name);
  console.log('  Version:', version.toString());
  console.log();

  // Update version.json with renderer address
  const latestHistory = versionData.history[versionData.history.length - 1];
  if (latestHistory && latestHistory.version === VERSION) {
    latestHistory.renderer = renderer.address;
    latestHistory.deployDate = new Date().toISOString().split('T')[0];
    fs.writeFileSync(versionPath, JSON.stringify(versionData, null, 2));
  }

  console.log('='.repeat(60));
  console.log('DEPLOYMENT COMPLETE');
  console.log('='.repeat(60));
  console.log();
  console.log('Version:', VERSION);
  console.log('Contract Address:', renderer.address);
  console.log('ETHFS File:', ETHFS_FILENAME);
  console.log();
  console.log('⚠️  IMPORTANT: Contract uses hardcoded filename!');
  console.log(`   Current: bodyTags[3].name = "frameworks-v3.1.0-combined.min.js"`);
  console.log(`   Update FrameworksRendererV3.sol line 114 to:`);
  console.log(`   bodyTags[3].name = "${ETHFS_FILENAME}";`);
  console.log();
  console.log('✅ Version history updated with renderer address');
  console.log();
  console.log('Next steps:');
  console.log('1. Recompile and redeploy if filename changed');
  console.log('2. Register renderer with Mint contract owner');
  console.log('3. Update RENDERER_INDEX in scripts/mint-quick.js');
  console.log('4. Mint test token');
  console.log();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
