#!/usr/bin/env node
// ============================================================
// Register FrameworksRendererV4 on a Mint collection contract
//
// Usage:
//   PRIVATE_KEY=0x... \
//   RPC_URL=https://... \
//   COLLECTION_ADDRESS=0x... \
//   RENDERER_ADDRESS=0x... \
//   node script/register-renderer.mjs
// ============================================================

import { ethers } from "ethers";

const PRIVATE_KEY        = process.env.PRIVATE_KEY;
const RPC_URL            = process.env.RPC_URL || "https://eth.llamarpc.com";
const COLLECTION_ADDRESS = process.env.COLLECTION_ADDRESS;
const RENDERER_ADDRESS   = process.env.RENDERER_ADDRESS;

const MINT_ABI = [
  "function registerRenderer(address renderer) returns (uint256)",
  "function renderers(uint256) view returns (address)",
  "function owner() view returns (address)",
  "function latestTokenId() view returns (uint256)",
];

const RENDERER_ABI = [
  "function name() view returns (string)",
  "function version() view returns (uint256)",
];

async function main() {
  if (!PRIVATE_KEY || !COLLECTION_ADDRESS || !RENDERER_ADDRESS) {
    console.error("Required env vars: PRIVATE_KEY, COLLECTION_ADDRESS, RENDERER_ADDRESS");
    console.error("\nUsage:");
    console.error("  PRIVATE_KEY=0x... \\");
    console.error("  RPC_URL=https://... \\");
    console.error("  COLLECTION_ADDRESS=0x... \\");
    console.error("  RENDERER_ADDRESS=0x... \\");
    console.error("  node script/register-renderer.mjs");
    process.exit(1);
  }

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
  const network = await provider.getNetwork();

  console.log(`\nChain:      ${network.chainId}`);
  console.log(`Wallet:     ${wallet.address}`);
  console.log(`Collection: ${COLLECTION_ADDRESS}`);
  console.log(`Renderer:   ${RENDERER_ADDRESS}\n`);

  // Verify the renderer contract
  const renderer = new ethers.Contract(RENDERER_ADDRESS, RENDERER_ABI, provider);
  try {
    const name = await renderer.name();
    const version = await renderer.version();
    console.log(`Renderer name:    ${name}`);
    console.log(`Renderer version: ${version}`);
  } catch (e) {
    console.error("⚠  Could not read renderer name/version. Is the address correct?");
    console.error("   Error:", e.message);
  }

  // Verify ownership
  const mint = new ethers.Contract(COLLECTION_ADDRESS, MINT_ABI, wallet);
  try {
    const owner = await mint.owner();
    if (owner.toLowerCase() !== wallet.address.toLowerCase()) {
      console.error(`\n⚠  You (${wallet.address}) are not the owner of this collection.`);
      console.error(`   Owner is: ${owner}`);
      console.error("   Only the collection owner can register renderers.");
      process.exit(1);
    }
    console.log(`Owner:            ${owner} ✓ (matches wallet)\n`);
  } catch (e) {
    console.warn("⚠  Could not verify ownership:", e.message);
  }

  // Register
  console.log("Registering renderer...");
  const tx = await mint.registerRenderer(RENDERER_ADDRESS);
  console.log(`  Tx: ${tx.hash}`);

  const receipt = await tx.wait();
  console.log(`  Gas: ${receipt.gasUsed.toString()} — confirmed ✓`);

  // Parse the NewRenderer event to get the index
  // event NewRenderer(address indexed renderer, uint256 indexed index)
  let rendererIndex = null;
  for (const log of receipt.logs) {
    try {
      // NewRenderer event topic
      const topic = ethers.id("NewRenderer(address,uint256)");
      if (log.topics[0] === topic) {
        rendererIndex = BigInt(log.topics[2]);
        break;
      }
    } catch (e) { /* continue */ }
  }

  if (rendererIndex !== null) {
    console.log(`\n✓ Renderer registered at index: ${rendererIndex}`);
  } else {
    // Fallback: read renderers array to find it
    console.log("\n✓ Renderer registered. Scanning for index...");
    for (let i = 0; i < 20; i++) {
      try {
        const addr = await mint.renderers(i);
        if (addr.toLowerCase() === RENDERER_ADDRESS.toLowerCase()) {
          rendererIndex = i;
          console.log(`  Found at index: ${i}`);
          break;
        }
      } catch (e) { break; }
    }
  }

  console.log(`\n════════════════════════════════════════`);
  console.log(`  RENDERER INDEX: ${rendererIndex}`);
  console.log(`════════════════════════════════════════`);
  console.log(`\nUse this index when minting tokens.`);
  console.log(`In the builder mint panel, set "Renderer Index" to ${rendererIndex}`);
  console.log(`Or when calling create() directly:`);
  console.log(`  mint.create(name, desc, artifact, ${rendererIndex}, 0)\n`);
}

main().catch(err => {
  console.error("\nFatal error:", err.message);
  process.exit(1);
});
