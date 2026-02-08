const hre = require("hardhat");

async function main() {
  console.log("Deploying FrameworksRendererV3...");

  // Get ArtifactReader library address (should already be deployed)
  const ARTIFACT_READER = "0x4722F16408aF27378a782eda6cE88F46905e5227"; // From ThreeJSRenderer deployment

  // Deploy FrameworksRendererV3 with library linking
  const FrameworksRendererV3 = await hre.ethers.getContractFactory("FrameworksRendererV3", {
    libraries: {
      "@visualizevalue/mint/contracts/contracts/libraries/ArtifactReader.sol:ArtifactReader": ARTIFACT_READER
    }
  });

  console.log("\nDeploying contract...");
  const renderer = await FrameworksRendererV3.deploy();
  await renderer.deployed();

  console.log("\n✅ FrameworksRendererV3 deployed!");
  console.log("Address:", renderer.address);
  console.log("\nContract Details:");
  console.log("  Name:", await renderer.name());
  console.log("  Version:", (await renderer.version()).toString());
  console.log("\nUsing:");
  console.log("  Three.js: three-v0.147.0.min.js.gz");
  console.log("  Frameworks: frameworks-v3.1-instanced.min.js");
  console.log("  ETHFS FileStore: 0x8FAA1AAb9DA8c75917C43Fb24fDdb513edDC3245");
  console.log("\nTo mint with this renderer:");
  console.log("  1. Set artifact data as: abi.encode(imageDataURI, commandString)");
  console.log("  2. Example command: 'ftil(dR,8)'");
  console.log("  3. The renderer will execute the commands on-chain");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
