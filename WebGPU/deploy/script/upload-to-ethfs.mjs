/**
 * upload-to-ethfs.mjs
 *
 * Uploads frameworks-v4-mint.html to EthFS using the SSTORE2 chunking pattern:
 * 1. Each chunk is deployed as a raw contract (one tx per chunk)
 * 2. createFileFromPointers() registers the file by name
 *
 * Addresses:
 *   ContentStore (write): 0xFe1411d6864592549AdE050215482e4385dFa0FB
 *   FileStore    (read):  0x8FAA1AAb9DA8c75917C43Fb24fDdb513edDC3245
 *
 * Usage:
 *   PRIVATE_KEY=0x... ETH_RPC_URL=https://... node script/upload-to-ethfs.mjs
 *
 * Bump FILE_NAME (and the matching string in FrameworksRendererV4.sol) on each upload.
 */

import { readFileSync } from 'fs';
import { ethers } from 'ethers';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const FILE_STORE_ADDRESS = '0xFe1411d6864592549AdE050215482e4385dFa0FB';
const FILE_NAME = 'frameworks_v4_viewer_v2.html';
const CHUNK_SIZE = 20000; // bytes — safely under 24KB SSTORE2 limit

const FILE_STORE_ABI = [
  'function fileExists(string memory filename) view returns (bool)',
  'function createFileFromPointers(string calldata filename, address[] calldata pointers, bytes calldata metadata) external',
];

async function main() {
  const privateKey = process.env.PRIVATE_KEY;
  const rpcUrl     = process.env.ETH_RPC_URL;

  if (!privateKey) throw new Error('PRIVATE_KEY env var required');
  if (!rpcUrl)     throw new Error('ETH_RPC_URL env var required');

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const signer   = new ethers.Wallet(privateKey.startsWith('0x') ? privateKey : '0x' + privateKey, provider);

  const network = await provider.getNetwork();
  console.log(`Network: ${network.name} (chainId ${network.chainId})`);
  console.log(`Deployer: ${signer.address}`);
  const balance = await provider.getBalance(signer.address);
  console.log(`Balance: ${ethers.formatEther(balance)} ETH\n`);

  // Check if already exists
  const fileStore = new ethers.Contract(FILE_STORE_ADDRESS, FILE_STORE_ABI, signer);
  const exists = await fileStore.fileExists(FILE_NAME);
  if (exists) {
    console.log(`"${FILE_NAME}" already exists on EthFS. EthFS files are immutable — bump FILE_NAME.`);
    process.exit(0);
  }

  // Read HTML
  const htmlPath = join(__dirname, '..', 'viewer', 'frameworks_v4_viewer_v2.min.html');
  let contents;
  try {
    contents = readFileSync(htmlPath, 'utf8');
  } catch (e) {
    throw new Error(`Could not read ${htmlPath}: ${e.message}`);
  }
  const contentBytes = ethers.toUtf8Bytes(contents);
  console.log(`File: ${FILE_NAME}`);
  console.log(`Size: ${(contentBytes.length / 1024).toFixed(1)} KB`);

  const totalChunks = Math.ceil(contentBytes.length / CHUNK_SIZE);
  console.log(`Chunks: ${totalChunks}\n`);

  // Step 1: Upload each chunk as an SSTORE2 contract
  const pointers = [];
  for (let i = 0; i < totalChunks; i++) {
    const start = i * CHUNK_SIZE;
    const end   = Math.min(start + CHUNK_SIZE, contentBytes.length);
    const chunk = contentBytes.slice(start, end);

    // SSTORE2 init code: STOP opcode prefix + data, deployed via raw contract creation
    const dataWithPrefix = new Uint8Array(chunk.length + 1);
    dataWithPrefix[0] = 0x00; // STOP opcode
    dataWithPrefix.set(chunk, 1);

    const len = dataWithPrefix.length;
    const lenHex = len.toString(16).padStart(4, '0');
    const initCode = ethers.concat([
      '0x61' + lenHex, // PUSH2 len
      '0x80',          // DUP1
      '0x600a',        // PUSH1 0x0a (10 byte offset)
      '0x3d',          // RETURNDATASIZE (0)
      '0x39',          // CODECOPY
      '0x3d',          // RETURNDATASIZE (0)
      '0xf3',          // RETURN
      dataWithPrefix,
    ]);

    console.log(`Chunk ${i + 1}/${totalChunks} (${chunk.length} bytes)...`);
    const tx = await signer.sendTransaction({ data: initCode });
    const receipt = await tx.wait();
    pointers.push(receipt.contractAddress);
    console.log(`  pointer: ${receipt.contractAddress}  gas: ${receipt.gasUsed.toLocaleString()}`);
  }

  // Step 2: Register the file by name
  console.log(`\nRegistering "${FILE_NAME}" with ${pointers.length} pointers...`);
  const tx = await fileStore.createFileFromPointers(FILE_NAME, pointers, '0x', { gasLimit: 500_000 });
  console.log(`tx: ${tx.hash}`);
  const receipt = await tx.wait();
  console.log(`gas: ${receipt.gasUsed.toLocaleString()}`);

  console.log(`\nDone. "${FILE_NAME}" is live on EthFS.`);
  console.log(`FileStore: ${FILE_STORE_ADDRESS}`);
}

main().catch(e => { console.error(e.message || e); process.exit(1); });
