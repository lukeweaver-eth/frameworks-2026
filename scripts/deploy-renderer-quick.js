// deploy-renderer-quick.js
// Quick deployment of FrameworksRendererV3 with combined file

const hre = require('hardhat');

const VERSION = 'v3.1.0';
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

  console.log('='.repeat(60));
  console.log('DEPLOYMENT COMPLETE');
  console.log('='.repeat(60));
  console.log();
  console.log('Contract Address:', renderer.address);
  console.log('ETHFS File:', ETHFS_FILENAME);
  console.log();
  console.log('⚠️  IMPORTANT: Update contract to use this filename!');
  console.log(`   Change line 114 in FrameworksRendererV3.sol to:`);
  console.log(`   bodyTags[3].name = "${ETHFS_FILENAME}";`);
  console.log();
  console.log('Next steps:');
  console.log('1. Register renderer in Mint protocol (if needed)');
  console.log('2. Mint test token: npx hardhat run scripts/mint-quick.js --network sepolia');
  console.log();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
