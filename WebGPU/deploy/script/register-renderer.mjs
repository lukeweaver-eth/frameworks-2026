/**
 * register-renderer.mjs
 *
 * Registers the deployed FrameworksRendererV4 contract on a Mint collection.
 * Parses the NewRenderer event to extract the assigned renderer index,
 * which you then paste into the builder's Collection Config panel.
 *
 * Usage:
 *   RENDERER_ADDRESS=0x... COLLECTION_ADDRESS=0x... node script/register-renderer.mjs
 *
 * Required env vars:
 *   PRIVATE_KEY          — deployer/owner private key
 *   ETH_RPC_URL          — RPC endpoint
 *   RENDERER_ADDRESS     — deployed FrameworksRendererV4 address
 *   COLLECTION_ADDRESS   — your Mint collection contract address
 */

import { ethers } from 'ethers';

const MINT_ABI = [
  'function owner() view returns (address)',
  'function registerRenderer(address renderer) returns (uint256)',
  'function renderers(uint256) view returns (address)',
  'event NewRenderer(uint256 indexed index, address indexed renderer)',
];

async function main() {
  const privateKey        = process.env.PRIVATE_KEY;
  const rpcUrl            = process.env.ETH_RPC_URL;
  const rendererAddress   = process.env.RENDERER_ADDRESS;
  const collectionAddress = process.env.COLLECTION_ADDRESS;

  if (!privateKey)        throw new Error('PRIVATE_KEY env var required');
  if (!rpcUrl)            throw new Error('ETH_RPC_URL env var required');
  if (!rendererAddress)   throw new Error('RENDERER_ADDRESS env var required');
  if (!collectionAddress) throw new Error('COLLECTION_ADDRESS env var required');

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const signer   = new ethers.Wallet(privateKey.startsWith('0x') ? privateKey : '0x' + privateKey, provider);

  const network = await provider.getNetwork();
  console.log(`Network: ${network.name} (chainId ${network.chainId})`);
  console.log(`Deployer: ${signer.address}`);

  const mint = new ethers.Contract(collectionAddress, MINT_ABI, signer);

  // Verify ownership
  const owner = await mint.owner();
  if (owner.toLowerCase() !== signer.address.toLowerCase()) {
    throw new Error(`Signer (${signer.address}) is not the collection owner (${owner})`);
  }
  console.log(`Collection owner verified: ${owner}`);

  // Verify renderer address looks right
  if (!ethers.isAddress(rendererAddress)) {
    throw new Error(`Invalid renderer address: ${rendererAddress}`);
  }
  console.log(`Registering renderer: ${rendererAddress}`);

  // Send transaction
  const tx = await mint.registerRenderer(rendererAddress);
  console.log(`tx: ${tx.hash}`);
  const receipt = await tx.wait();
  console.log(`gas used: ${receipt.gasUsed.toLocaleString()}`);

  // Parse NewRenderer event to get the assigned index
  const iface = mint.interface;
  let rendererIndex = null;
  for (const log of receipt.logs) {
    try {
      const parsed = iface.parseLog(log);
      if (parsed && parsed.name === 'NewRenderer') {
        rendererIndex = parsed.args.index;
        break;
      }
    } catch (_) {}
  }

  if (rendererIndex === null) {
    console.warn('Could not parse NewRenderer event — check receipt manually.');
  } else {
    console.log(`\nRenderer registered at index: ${rendererIndex}`);
    console.log('Paste this into the builder\'s Collection Config > Renderer Index field.');
  }

  // Verify it round-trips
  if (rendererIndex !== null) {
    const stored = await mint.renderers(rendererIndex);
    if (stored.toLowerCase() === rendererAddress.toLowerCase()) {
      console.log('Verified: renderers(' + rendererIndex + ') == ' + stored);
    } else {
      console.warn(`Mismatch: renderers(${rendererIndex}) = ${stored}`);
    }
  }
}

main().catch(e => { console.error(e.message || e); process.exit(1); });
