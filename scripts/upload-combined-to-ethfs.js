// upload-combined-to-ethfs.js
// Quick upload of combined minified file to ETHFS using SSTORE2

const fs = require('fs');
const path = require('path');
const hre = require('hardhat');

// Load version from version.json
const versionPath = path.join(__dirname, '..', 'version.json');
const versionData = JSON.parse(fs.readFileSync(versionPath, 'utf8'));
const VERSION = versionData.current;

const ETHFS_FILENAME = `frameworks-${VERSION}-combined.min.js`;
const SOURCE_FILE = `frameworks-${VERSION}-combined.min.js`;

async function main() {
  console.log('\n' + '='.repeat(60));
  console.log(`UPLOADING FRAMEWORKS V${VERSION} TO ETHFS`);
  console.log('='.repeat(60));
  console.log(`\nFile: ${ETHFS_FILENAME}\n`);

  const ETHFS_FILE_STORE = '0x8FAA1AAb9DA8c75917C43Fb24fDdb513edDC3245'; // Read wrapper
  const ETHFS_CONTENT_STORE = '0xFe1411d6864592549AdE050215482e4385dFa0FB'; // Upload contract

  const [deployer] = await hre.ethers.getSigners();
  console.log('Account:', deployer.address);
  console.log('Balance:', hre.ethers.utils.formatEther(await deployer.getBalance()), 'ETH');
  console.log('Network:', hre.network.name, '\n');

  // Read file
  const filepath = path.join(__dirname, '..', 'src', SOURCE_FILE);
  if (!fs.existsSync(filepath)) {
    console.error(`❌ File not found: ${filepath}`);
    console.error('Run: node scripts/build-combined.js first');
    process.exit(1);
  }

  const content = fs.readFileSync(filepath, 'utf8');
  const size = content.length;

  console.log(`Size: ${size} bytes (${(size / 1024).toFixed(2)} KB)\n`);

  // Check if file exists
  const fileStoreABI = [
    "function getFile(string calldata filename) external view returns (string memory)"
  ];
  const contentStoreABI = [
    "function createFileFromPointers(string calldata filename, address[] calldata pointers, bytes calldata metadata) external"
  ];

  const fileStore = await hre.ethers.getContractAt(fileStoreABI, ETHFS_FILE_STORE);
  const contentStore = await hre.ethers.getContractAt(contentStoreABI, ETHFS_CONTENT_STORE);

  console.log('Checking if file exists on ETHFS...');
  try {
    const existing = await fileStore.getFile(ETHFS_FILENAME);
    if (existing.length > 0) {
      console.log(`⚠️  File "${ETHFS_FILENAME}" already exists on ETHFS (${existing.length} bytes)`);
      if (existing === content) {
        console.log('✓ Content matches - file already uploaded!');
        console.log(`\n✅ Ready to deploy renderer with version ${VERSION}`);
        process.exit(0);
      } else {
        console.log('❌  File exists with different content!');
        console.log('This should not happen with auto-versioning.');
        console.log(`Check version.json - current version is ${VERSION}`);
        process.exit(1);
      }
    }
  } catch (e) {
    console.log('✓ File does not exist - proceeding with upload\n');
  }

  // Upload using SSTORE2 with chunking
  console.log('Uploading to ETHFS...');
  console.log('File will be split into chunks (max 24 KB each)\n');

  const contentBytes = hre.ethers.utils.toUtf8Bytes(content);
  const CHUNK_SIZE = 24000; // Just under 24 KB limit
  const totalChunks = Math.ceil(contentBytes.length / CHUNK_SIZE);

  console.log(`Uploading in ${totalChunks} chunks...\n`);

  const pointers = [];
  let totalGas = hre.ethers.BigNumber.from(0);

  // Step 1: Upload each chunk to SSTORE2
  for (let i = 0; i < totalChunks; i++) {
    const start = i * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, contentBytes.length);
    const chunk = contentBytes.slice(start, end);

    console.log(`Chunk ${i + 1}/${totalChunks} (${chunk.length} bytes)`);

    // Create SSTORE2 pointer for this chunk
    const dataWithPrefix = hre.ethers.utils.concat([
      '0x00', // STOP opcode
      chunk
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

    console.log('  Creating SSTORE2 pointer...');
    const tx1 = await deployer.sendTransaction({
      data: initCode
    });

    const receipt1 = await tx1.wait();
    const pointer = receipt1.contractAddress;
    totalGas = totalGas.add(receipt1.gasUsed);

    console.log(`  ✓ Pointer: ${pointer}`);
    console.log(`  Gas: ${receipt1.gasUsed.toString()}\n`);

    pointers.push(pointer);
  }

  // Step 2: Create file from all pointers
  console.log(`Creating file from ${pointers.length} pointers...`);
  const metadata = hre.ethers.utils.toUtf8Bytes(JSON.stringify({
    type: "application/javascript",
    encoding: "utf-8"
  }));

  const tx2 = await contentStore.createFileFromPointers(ETHFS_FILENAME, pointers, metadata);
  console.log(`  Tx: ${tx2.hash}`);
  const receipt2 = await tx2.wait();
  totalGas = totalGas.add(receipt2.gasUsed);
  console.log(`  Gas: ${receipt2.gasUsed.toString()}`);

  // Update version history
  versionData.history = versionData.history || [];
  versionData.history.push({
    version: VERSION,
    ethfsFile: ETHFS_FILENAME,
    pointers: pointers,
    uploadDate: new Date().toISOString().split('T')[0],
    size: size,
    chunks: pointers.length,
    gasUsed: totalGas.toString()
  });
  fs.writeFileSync(versionPath, JSON.stringify(versionData, null, 2));

  console.log('\n' + '='.repeat(60));
  console.log('UPLOAD COMPLETE');
  console.log('='.repeat(60));
  console.log(`\nVersion: ${VERSION}`);
  console.log(`File on ETHFS: ${ETHFS_FILENAME}`);
  console.log(`Size: ${(size / 1024).toFixed(2)} KB`);
  console.log(`Chunks: ${pointers.length}`);
  console.log(`SSTORE2 Pointers:`);
  pointers.forEach((p, i) => console.log(`  ${i + 1}. ${p}`));
  console.log(`\nTotal Gas: ${totalGas.toString()}`);
  console.log('\n✅ Version history updated in version.json');
  console.log('\nNext step:');
  console.log('Deploy renderer: npx hardhat run scripts/deploy-renderer-quick.js --network sepolia');
  console.log();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
