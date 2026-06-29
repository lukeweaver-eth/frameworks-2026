/**
 * upload-to-ethfs-mainnet.mjs
 *
 * Uploads frameworks_4.0.min.html to EthFS on mainnet.
 *
 * Addresses:
 *   FileStore (same on all networks): 0xFe1411d6864592549AdE050215482e4385dFa0FB
 *
 * Usage:
 *   node script/upload-to-ethfs-mainnet.mjs
 *   (reads PRIVATE_KEY and ETH_RPC_URL from ../.env.enc)
 */

import { readFileSync } from 'fs';
import { ethers } from 'ethers';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createRequire } from 'module';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
require('@chainlink/env-enc').config({ path: join(__dirname, '..', '.env.enc') });

const FILE_STORE_ADDRESS = '0xFe1411d6864592549AdE050215482e4385dFa0FB';
const FILE_NAME = 'frameworks_4.0.min.html';
const CHUNK_SIZE = 20000; // bytes — safely under 24KB SSTORE2 limit

const FILE_STORE_ABI = [
  'function fileExists(string memory filename) view returns (bool)',
  'function createFileFromPointers(string calldata filename, address[] calldata pointers, bytes calldata metadata) external',
];

async function main() {
  const privateKey  = process.env.PRIVATE_KEY;
  const rpcUrl      = process.env.ETH_RPC_URL;

  if (!privateKey) throw new Error('PRIVATE_KEY env var required');
  if (!rpcUrl)     throw new Error('ETH_RPC_URL env var required');

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const signer   = new ethers.Wallet(privateKey.startsWith('0x') ? privateKey : '0x' + privateKey, provider);

  const dryRun = process.argv.includes('--dry-run');

  const network = await provider.getNetwork();
  console.log(`Network: ${network.name} (chainId ${network.chainId})`);
  console.log(`Deployer: ${signer.address}`);
  const balance = await provider.getBalance(signer.address);
  console.log(`Balance: ${ethers.formatEther(balance)} ETH\n`);

  if (network.chainId !== 1n) throw new Error(`Expected mainnet (chainId 1), got ${network.chainId}`);

  // Check if already exists
  const fileStore = new ethers.Contract(FILE_STORE_ADDRESS, FILE_STORE_ABI, signer);
  const exists = await fileStore.fileExists(FILE_NAME);
  if (exists) {
    console.log(`"${FILE_NAME}" already exists on EthFS. EthFS files are immutable — bump FILE_NAME.`);
    process.exit(0);
  }

  // Read HTML
  const htmlPath = join(__dirname, '..', 'viewer', 'frameworks_v4_viewer_v18.min.html');
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
  console.log(`Chunks: ${totalChunks}`);

  // Build initCode for each chunk
  const initCodes = [];
  for (let i = 0; i < totalChunks; i++) {
    const start = i * CHUNK_SIZE;
    const end   = Math.min(start + CHUNK_SIZE, contentBytes.length);
    const chunk = contentBytes.slice(start, end);
    const dataWithPrefix = new Uint8Array(chunk.length + 1);
    dataWithPrefix[0] = 0x00;
    dataWithPrefix.set(chunk, 1);
    const len = dataWithPrefix.length;
    const lenHex = len.toString(16).padStart(4, '0');
    initCodes.push(ethers.concat([
      '0x61' + lenHex, '0x80', '0x600a', '0x3d', '0x39', '0x3d', '0xf3',
      dataWithPrefix,
    ]));
  }

  // Estimate gas
  const feeData = await provider.getFeeData();
  const gasPrice = feeData.gasPrice;
  const ethPrice = 1700; // update if needed
  let totalGas = 0n;
  for (let i = 0; i < totalChunks; i++) {
    const est = await provider.estimateGas({ data: initCodes[i] });
    totalGas += est;
    console.log(`  Chunk ${i + 1} estimated gas: ${est.toLocaleString()}`);
  }
  const registerEst = 250_000n; // conservative estimate based on Sepolia deploys (~217K actual)
  totalGas += registerEst;
  console.log(`  Register estimated gas: ~${registerEst.toLocaleString()} (estimated)`);
  const totalEth = parseFloat(ethers.formatEther(totalGas * gasPrice));
  console.log(`\nGas price: ${ethers.formatUnits(gasPrice, 'gwei')} gwei`);
  console.log(`Total estimated gas: ${totalGas.toLocaleString()}`);
  console.log(`Estimated cost: ${totalEth.toFixed(4)} ETH (~$${(totalEth * ethPrice).toFixed(2)} at $${ethPrice}/ETH)`);

  if (dryRun) {
    console.log('\n--dry-run: no transactions sent.');
    return;
  }

  console.log('\nProceeding with upload...\n');

  // Step 1: Upload each chunk
  const pointers = [];
  for (let i = 0; i < totalChunks; i++) {
    console.log(`Chunk ${i + 1}/${totalChunks}...`);
    const tx = await signer.sendTransaction({ data: initCodes[i] });
    console.log(`  tx: ${tx.hash}`);
    // Fetch raw receipt to avoid ethers address parsing bug on some RPCs
    let contractAddress, gasUsed;
    while (true) {
      const raw = await provider.send('eth_getTransactionReceipt', [tx.hash]);
      if (raw && raw.blockNumber) {
        contractAddress = raw.contractAddress;
        gasUsed = BigInt(raw.gasUsed);
        break;
      }
      await new Promise(r => setTimeout(r, 2000));
    }
    pointers.push(contractAddress);
    console.log(`  pointer: ${contractAddress}  gas: ${gasUsed.toLocaleString()}`);
  }

  // Step 2: Register the file by name
  console.log(`\nRegistering "${FILE_NAME}" with ${pointers.length} pointers...`);
  const tx = await fileStore.createFileFromPointers(FILE_NAME, pointers, '0x', { gasLimit: 500_000 });
  console.log(`tx: ${tx.hash}`);
  const receipt = await tx.wait();
  console.log(`gas: ${receipt.gasUsed.toLocaleString()}`);

  console.log(`\nDone. "${FILE_NAME}" is live on EthFS mainnet.`);
  console.log(`FileStore: ${FILE_STORE_ADDRESS}`);
}

main().catch(e => { console.error(e.message || e); process.exit(1); });
