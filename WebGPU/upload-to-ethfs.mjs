#!/usr/bin/env node
// ============================================================
// Upload frameworks_v4_viewer.min.js.gz to EthFS
//
// Usage:
//   PRIVATE_KEY=0x... RPC_URL=https://... node script/upload-to-ethfs.mjs
//
// The script:
//   1. Reads the gzipped viewer file
//   2. Splits it into <=24KB chunks
//   3. Uploads each chunk to the EthFS ContentStore
//   4. Creates a File in the FileStore referencing all chunks
// ============================================================

import { ethers } from "ethers";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

// ── Config ──────────────────────────────────────────────────
const PRIVATE_KEY   = process.env.PRIVATE_KEY;
const RPC_URL       = process.env.RPC_URL || "https://eth.llamarpc.com";
const FILE_NAME     = process.env.FILE_NAME || "frameworks_v4_viewer.min.js.gz";
const FILE_PATH     = process.env.FILE_PATH || resolve("viewer/frameworks_v4_viewer.min.js.gz");

// ethfs V2 FileStore (same address on mainnet, Sepolia, Goerli, etc.)
const FILE_STORE    = "0xFe1411d6864592549AdE050215482e4385dFa0FB";
const MAX_CHUNK     = 24_576; // 24KB per content chunk

// ── ABIs ────────────────────────────────────────────────────
const FILE_STORE_ABI = [
  "function createFile(string filename, bytes32[] checksums) returns (tuple(bool exists, uint256 size, bytes32[] checksums) file)",
  "function fileExists(string filename) view returns (bool)",
  "function getFile(string filename) view returns (tuple(bool exists, uint256 size, bytes32[] checksums))",
  "function contentStore() view returns (address)",
];

const CONTENT_STORE_ABI = [
  "function addContent(bytes content) returns (bytes32 checksum, uint256 pointer)",
  "function checksumExists(bytes32 checksum) view returns (bool)",
];

// ── Main ────────────────────────────────────────────────────
async function main() {
  if (!PRIVATE_KEY) {
    console.error("Error: PRIVATE_KEY env var required");
    process.exit(1);
  }

  if (!existsSync(FILE_PATH)) {
    console.error(`Error: File not found: ${FILE_PATH}`);
    console.error("Run 'npm run minify' first to create the gzipped viewer.");
    process.exit(1);
  }

  const fileData = readFileSync(FILE_PATH);
  console.log(`\nFile: ${FILE_NAME}`);
  console.log(`Size: ${fileData.length} bytes (${(fileData.length / 1024).toFixed(1)} KB)`);
  console.log(`RPC:  ${RPC_URL}\n`);

  // Connect
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
  const network = await provider.getNetwork();
  console.log(`Chain:   ${network.chainId}`);
  console.log(`Wallet:  ${wallet.address}`);

  const balance = await provider.getBalance(wallet.address);
  console.log(`Balance: ${ethers.formatEther(balance)} ETH\n`);

  const fileStore = new ethers.Contract(FILE_STORE, FILE_STORE_ABI, wallet);

  // Check if file already exists
  try {
    const exists = await fileStore.fileExists(FILE_NAME);
    if (exists) {
      console.log(`⚠  File "${FILE_NAME}" already exists on EthFS.`);
      console.log("   If you need to re-upload, use a different filename.");
      console.log("   (e.g. frameworks_v4_viewer_v2.min.js.gz)");
      process.exit(0);
    }
  } catch (e) {
    // fileExists may not be available on all versions, continue
  }

  // Get ContentStore address
  const contentStoreAddr = await fileStore.contentStore();
  console.log(`ContentStore: ${contentStoreAddr}`);
  const contentStore = new ethers.Contract(contentStoreAddr, CONTENT_STORE_ABI, wallet);

  // Split into chunks
  const chunks = [];
  for (let i = 0; i < fileData.length; i += MAX_CHUNK) {
    chunks.push(fileData.slice(i, i + MAX_CHUNK));
  }
  console.log(`Chunks: ${chunks.length} (max ${MAX_CHUNK} bytes each)\n`);

  // Upload each chunk to ContentStore
  const checksums = [];
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const chunkHex = ethers.hexlify(chunk);

    // Check if this content already exists (by computing checksum locally)
    // The checksum is keccak256 of the content
    const expectedChecksum = ethers.keccak256(chunkHex);
    let exists = false;
    try {
      exists = await contentStore.checksumExists(expectedChecksum);
    } catch (e) { /* continue */ }

    if (exists) {
      console.log(`  Chunk ${i + 1}/${chunks.length}: ${chunk.length} bytes — already exists ✓`);
      checksums.push(expectedChecksum);
    } else {
      console.log(`  Chunk ${i + 1}/${chunks.length}: ${chunk.length} bytes — uploading...`);
      const tx = await contentStore.addContent(chunkHex);
      console.log(`    Tx: ${tx.hash}`);
      const receipt = await tx.wait();
      console.log(`    Gas: ${receipt.gasUsed.toString()} — confirmed ✓`);

      // Parse the checksum from the return value / events
      // The return value is (bytes32 checksum, uint256 pointer)
      // We can compute it as keccak256 of the content
      checksums.push(expectedChecksum);
    }
  }

  console.log(`\nAll chunks uploaded. Creating file "${FILE_NAME}"...`);

  // Create the file in FileStore
  const createTx = await fileStore.createFile(FILE_NAME, checksums);
  console.log(`  Tx: ${createTx.hash}`);
  const createReceipt = await createTx.wait();
  console.log(`  Gas: ${createReceipt.gasUsed.toString()} — confirmed ✓`);

  console.log(`\n✓ File "${FILE_NAME}" uploaded to EthFS successfully!`);
  console.log(`  FileStore: ${FILE_STORE}`);
  console.log(`  Chunks: ${checksums.length}`);
  console.log(`  Total size: ${fileData.length} bytes`);
  console.log(`\nThe renderer contract references this file by name.`);
  console.log(`Make sure FrameworksRendererV4.sol uses: "${FILE_NAME}"\n`);
}

main().catch(err => {
  console.error("\nFatal error:", err.message);
  if (err.data) console.error("Data:", err.data);
  process.exit(1);
});
