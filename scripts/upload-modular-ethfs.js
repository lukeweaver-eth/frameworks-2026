// Upload modular Frameworks components to ETHFS with versioning
const fs = require('fs');
const path = require('path');
const hre = require('hardhat');

const VERSION = 'v3.1.0'; // Semantic versioning

const modules = [
  { file: 'core.min.js', ethfsName: `frameworks-${VERSION}-core.min.js` },
  { file: 'palette.min.js', ethfsName: `frameworks-${VERSION}-palette.min.js` },
  { file: 'context-color.min.js', ethfsName: `frameworks-${VERSION}-context-color.min.js` },
  { file: 'context-camera.min.js', ethfsName: `frameworks-${VERSION}-context-camera.min.js` },
  { file: 'context-selection.min.js', ethfsName: `frameworks-${VERSION}-context-selection.min.js` },
  { file: 'command-tree.min.js', ethfsName: `frameworks-${VERSION}-command-tree.min.js` },
  { file: 'commands.min.js', ethfsName: `frameworks-${VERSION}-commands.min.js` },
  { file: 'renderer-instanced.min.js', ethfsName: `frameworks-${VERSION}-renderer-instanced.min.js` }
];

async function main() {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`UPLOADING MODULAR FRAMEWORKS ${VERSION} TO ETHFS`);
  console.log(`${'='.repeat(60)}\n`);

  const ETHFS_FILE_STORE = '0x8FAA1AAb9DA8c75917C43Fb24fDdb513edDC3245'; // Read wrapper
  const ETHFS_CONTENT_STORE = '0xFe1411d6864592549AdE050215482e4385dFa0FB'; // Upload contract

  const [deployer] = await hre.ethers.getSigners();
  console.log("Account:", deployer.address);
  console.log("Balance:", hre.ethers.utils.formatEther(await deployer.getBalance()), "ETH");
  console.log("Network:", hre.network.name, "\n");

  // FileStore ABI (for reading)
  const fileStoreABI = [
    "function getFile(string calldata filename) external view returns (string memory)"
  ];

  // ContentStore ABI (for uploads)
  const contentStoreABI = [
    "function createFileFromPointers(string calldata filename, address[] calldata pointers, bytes calldata metadata) external"
  ];

  const fileStore = await hre.ethers.getContractAt(fileStoreABI, ETHFS_FILE_STORE);
  const contentStore = await hre.ethers.getContractAt(contentStoreABI, ETHFS_CONTENT_STORE);

  const modulesDir = path.join(__dirname, '..', 'src', 'modules');

  // Helper function to upload file using SSTORE2 chunked pattern
  async function uploadFile(ethfsName, content) {
    const contentBytes = hre.ethers.utils.toUtf8Bytes(content);

    // Create SSTORE2 pointer (one chunk for files under 24KB)
    const dataWithPrefix = hre.ethers.utils.concat([
      '0x00', // STOP opcode
      contentBytes
    ]);

    const len = dataWithPrefix.length;
    const lenHex = len.toString(16).padStart(4, '0');

    // Init code that returns the runtime code
    const initCode = hre.ethers.utils.concat([
      '0x61' + lenHex,  // PUSH2 len
      '0x80',           // DUP1
      '0x60', '0x0a',   // PUSH1 0x0a (offset)
      '0x3d',           // RETURNDATASIZE (0)
      '0x39',           // CODECOPY
      '0x3d',           // RETURNDATASIZE (0)
      '0xf3',           // RETURN
      dataWithPrefix
    ]);

    console.log("Creating SSTORE2 pointer...");
    const tx1 = await deployer.sendTransaction({
      data: initCode
    });

    const receipt1 = await tx1.wait();
    const pointer = receipt1.contractAddress;
    console.log(`Pointer: ${pointer}`);
    console.log(`Gas: ${receipt1.gasUsed.toString()}`);

    // Create file from pointer
    console.log("Creating file from pointer...");
    const metadata = hre.ethers.utils.toUtf8Bytes(JSON.stringify({
      type: "application/javascript",
      encoding: "utf-8"
    }));

    const tx2 = await contentStore.createFileFromPointers(ethfsName, [pointer], metadata);
    console.log(`Tx: ${tx2.hash}`);
    const receipt2 = await tx2.wait();
    console.log(`Gas: ${receipt2.gasUsed.toString()}`);

    return receipt1.gasUsed.add(receipt2.gasUsed);
  }

  let totalSize = 0;
  let totalGas = hre.ethers.BigNumber.from(0);
  let uploaded = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < modules.length; i++) {
    const { file, ethfsName } = modules[i];
    const filepath = path.join(modulesDir, file);

    console.log(`\n[${ i + 1}/${modules.length}] ${ethfsName}`);
    console.log('-'.repeat(60));

    // Read file
    const content = fs.readFileSync(filepath, 'utf8');
    const size = content.length;
    totalSize += size;

    console.log(`File: ${file}`);
    console.log(`Size: ${size} bytes (${(size / 1024).toFixed(2)} KB)`);

    // Check if exists
    try {
      const existing = await fileStore.getFile(ethfsName);
      if (existing.length > 0) {
        console.log(`⚠️  Already exists (${existing.length} bytes)`);

        if (existing === content) {
          console.log(`✓ Content matches - skipping upload`);
          skipped++;
          continue;
        } else {
          console.log(`⚠️  Content differs - will overwrite`);
        }
      }
    } catch (e) {
      console.log("File doesn't exist - will upload");
    }

    // Upload
    console.log("Uploading...");
    try {
      const gasUsed = await uploadFile(ethfsName, content);
      totalGas = totalGas.add(gasUsed);

      console.log(`✅ Uploaded! Total gas: ${gasUsed.toString()}`);

      // Verify
      try {
        const retrieved = await fileStore.getFile(ethfsName);
        if (retrieved === content) {
          console.log(`✓ Verified`);
          uploaded++;
        } else {
          console.log(`⚠️  Verification failed!`);
          failed++;
        }
      } catch (verifyError) {
        console.log(`⚠️  Could not verify: ${verifyError.message}`);
        uploaded++; // Still count as uploaded
      }

    } catch (error) {
      console.error(`❌ Upload failed: ${error.message}`);
      failed++;
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log('UPLOAD SUMMARY');
  console.log(`${'='.repeat(60)}`);
  console.log(`Total modules: ${modules.length}`);
  console.log(`Uploaded: ${uploaded}`);
  console.log(`Skipped (already uploaded): ${skipped}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total size: ${totalSize} bytes (${(totalSize / 1024).toFixed(2)} KB)`);
  console.log(`Total gas used: ${totalGas.toString()}`);
  console.log(`\nModules on ETHFS (in load order):`);
  modules.forEach(({ ethfsName }, i) => {
    console.log(`  ${i + 1}. ${ethfsName}`);
  });
  console.log();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
