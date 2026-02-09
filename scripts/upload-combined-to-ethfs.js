// upload-combined-to-ethfs.js
// Quick upload of combined minified file to ETHFS using SSTORE2

const fs = require('fs');
const path = require('path');
const hre = require('hardhat');

const VERSION = 'v3.1.0';
const FILENAME = `frameworks-${VERSION}-combined.min.js`;

async function main() {
  console.log('\n' + '='.repeat(60));
  console.log(`UPLOADING ${FILENAME} TO ETHFS`);
  console.log('='.repeat(60) + '\n');

  const ETHFS_FILE_STORE = '0x8FAA1AAb9DA8c75917C43Fb24fDdb513edDC3245'; // Read wrapper
  const ETHFS_CONTENT_STORE = '0xFe1411d6864592549AdE050215482e4385dFa0FB'; // Upload contract

  const [deployer] = await hre.ethers.getSigners();
  console.log('Account:', deployer.address);
  console.log('Balance:', hre.ethers.utils.formatEther(await deployer.getBalance()), 'ETH');
  console.log('Network:', hre.network.name, '\n');

  // Read file
  const filepath = path.join(__dirname, '..', 'src', FILENAME);
  if (!fs.existsSync(filepath)) {
    console.error(`❌ File not found: ${filepath}`);
    console.error('Run: node scripts/build-combined.js first');
    process.exit(1);
  }

  const content = fs.readFileSync(filepath, 'utf8');
  const size = content.length;

  console.log(`File: ${FILENAME}`);
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
    const existing = await fileStore.getFile(FILENAME);
    if (existing.length > 0) {
      console.log(`⚠️  File already exists (${existing.length} bytes)`);
      if (existing === content) {
        console.log('✓ Content matches - no upload needed');
        console.log('\nFile ready to use in renderer!');
        process.exit(0);
      } else {
        console.log('⚠️  Content differs - will overwrite\n');
      }
    }
  } catch (e) {
    console.log('File does not exist - will upload\n');
  }

  // Upload using SSTORE2
  console.log('Uploading to ETHFS...');
  console.log('This will take ~2 minutes and cost gas\n');

  const contentBytes = hre.ethers.utils.toUtf8Bytes(content);

  // Create SSTORE2 pointer
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

  console.log('Step 1/2: Creating SSTORE2 pointer...');
  const tx1 = await deployer.sendTransaction({
    data: initCode
  });

  const receipt1 = await tx1.wait();
  const pointer = receipt1.contractAddress;
  console.log(`  ✓ Pointer: ${pointer}`);
  console.log(`  Gas: ${receipt1.gasUsed.toString()}`);

  // Create file from pointer
  console.log('\nStep 2/2: Creating file from pointer...');
  const metadata = hre.ethers.utils.toUtf8Bytes(JSON.stringify({
    type: "application/javascript",
    encoding: "utf-8"
  }));

  const tx2 = await contentStore.createFileFromPointers(FILENAME, [pointer], metadata);
  console.log(`  Tx: ${tx2.hash}`);
  const receipt2 = await tx2.wait();
  console.log(`  Gas: ${receipt2.gasUsed.toString()}`);

  const totalGas = receipt1.gasUsed.add(receipt2.gasUsed);

  console.log('\n' + '='.repeat(60));
  console.log('UPLOAD COMPLETE');
  console.log('='.repeat(60));
  console.log(`\nFile: ${FILENAME}`);
  console.log(`Size: ${(size / 1024).toFixed(2)} KB`);
  console.log(`SSTORE2 Pointer: ${pointer}`);
  console.log(`Total Gas: ${totalGas.toString()}`);
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
