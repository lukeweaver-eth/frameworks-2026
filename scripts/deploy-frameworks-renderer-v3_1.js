// deploy-frameworks-renderer-v3_1.js
// Deploy FrameworksRendererV3_1 (modular version)

const hre = require('hardhat');

async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('DEPLOYING FRAMEWORKS RENDERER V3.1 (MODULAR)');
  console.log('='.repeat(60) + '\n');

  const [deployer] = await hre.ethers.getSigners();
  console.log('Deploying with account:', deployer.address);
  console.log('Account balance:', hre.ethers.utils.formatEther(await deployer.getBalance()), 'ETH');
  console.log('Network:', hre.network.name, '\n');

  // ArtifactReader library address on Sepolia
  const ARTIFACT_READER = "0x4722F16408aF27378a782eda6cE88F46905e5227";

  console.log('Using ArtifactReader library at:', ARTIFACT_READER);
  console.log();

  // Deploy FrameworksRendererV3_1 with library linking
  console.log('Deploying FrameworksRendererV3_1...');
  const FrameworksRendererV3_1 = await hre.ethers.getContractFactory("FrameworksRendererV3_1", {
    libraries: {
      "@visualizevalue/mint/contracts/contracts/libraries/ArtifactReader.sol:ArtifactReader": ARTIFACT_READER
    }
  });

  const renderer = await FrameworksRendererV3_1.deploy();
  await renderer.deployed();

  console.log('✅ FrameworksRendererV3_1 deployed to:', renderer.address);
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
  console.log('Renderer Name:', name);
  console.log('Renderer Version:', version.toString());
  console.log();
  console.log('Modular Components Loaded (v3.1.0):');
  console.log('  1. frameworks-v3.1.0-core.min.js');
  console.log('  2. frameworks-v3.1.0-palette.min.js');
  console.log('  3. frameworks-v3.1.0-context-color.min.js');
  console.log('  4. frameworks-v3.1.0-context-camera.min.js');
  console.log('  5. frameworks-v3.1.0-context-selection.min.js');
  console.log('  6. frameworks-v3.1.0-command-tree.min.js');
  console.log('  7. frameworks-v3.1.0-commands.min.js');
  console.log('  8. frameworks-v3.1.0-renderer-instanced.min.js');
  console.log();
  console.log('Next steps:');
  console.log('1. Register renderer in Mint protocol');
  console.log('2. Mint test token with command string');
  console.log('3. Verify modular loading works correctly');
  console.log();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
