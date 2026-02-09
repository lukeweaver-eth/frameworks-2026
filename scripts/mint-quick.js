// mint-quick.js
// Quick token minting for testing

const hre = require('hardhat');

// Configuration
const MINT_CONTRACT = '0x452718C9C188da8969B05e34B5031b91906f5264'; // Sepolia Mint
const RENDERER_INDEX = 37; // Update this after registering your renderer
const TEST_COMMAND = 'ftil(dR,8)'; // Default test command

async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('QUICK MINT TEST TOKEN');
  console.log('='.repeat(60) + '\n');

  const [deployer] = await hre.ethers.getSigners();
  console.log('Minting with account:', deployer.address);
  console.log('Balance:', hre.ethers.utils.formatEther(await deployer.getBalance()), 'ETH');
  console.log('Network:', hre.network.name, '\n');

  // Get command from environment or use default
  const command = process.env.COMMAND || TEST_COMMAND;
  console.log('Command:', command);
  console.log('Renderer Index:', RENDERER_INDEX);
  console.log();

  // Mint contract ABI
  const mintABI = [
    "function mint(string memory name, string memory description, address[] memory artifactPointers, uint rendererIndex, uint closeAt) external payable returns (uint tokenId)"
  ];

  const mint = await hre.ethers.getContractAt(mintABI, MINT_CONTRACT);

  // Create artifact data: abi.encode(imageDataURI, commandString)
  const imageDataURI = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iIzIyMiIvPjx0ZXh0IHg9IjUwIiB5PSI1MCIgZmlsbD0iI2ZmZiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZm9udC1mYW1pbHk9Im1vbm9zcGFjZSIgZm9udC1zaXplPSIxMCI+RnJhbWV3b3JrczwvdGV4dD48L3N2Zz4=";

  const artifactData = hre.ethers.utils.defaultAbiCoder.encode(
    ['string', 'string'],
    [imageDataURI, command]
  );

  // Deploy artifact data to SSTORE2
  console.log('Creating artifact pointer...');
  const dataWithPrefix = hre.ethers.utils.concat(['0x00', artifactData]);
  const len = dataWithPrefix.length;
  const lenHex = len.toString(16).padStart(4, '0');

  const initCode = hre.ethers.utils.concat([
    '0x61' + lenHex,
    '0x80',
    '0x60', '0x0a',
    '0x3d',
    '0x39',
    '0x3d',
    '0xf3',
    dataWithPrefix
  ]);

  const tx1 = await deployer.sendTransaction({ data: initCode });
  const receipt1 = await tx1.wait();
  const artifactPointer = receipt1.contractAddress;

  console.log(`  ✓ Artifact pointer: ${artifactPointer}`);
  console.log(`  Gas: ${receipt1.gasUsed.toString()}\n`);

  // Mint token
  console.log('Minting token...');
  const closeAt = Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60); // 1 year

  const tx2 = await mint.mint(
    `Frameworks ${command}`,
    'Generated with Frameworks V3',
    [artifactPointer],
    RENDERER_INDEX,
    closeAt,
    { value: 0 } // Update if mint has a price
  );

  console.log(`  Tx: ${tx2.hash}`);
  console.log('  Waiting for confirmation...');

  const receipt2 = await tx2.wait();

  // Find TokenMinted event to get token ID
  const tokenMintedEvent = receipt2.events?.find(e => e.event === 'TokenMinted');
  const tokenId = tokenMintedEvent?.args?.tokenId?.toString();

  console.log(`  Gas: ${receipt2.gasUsed.toString()}`);

  console.log('\n' + '='.repeat(60));
  console.log('TOKEN MINTED');
  console.log('='.repeat(60));
  console.log(`\nToken ID: ${tokenId || 'Unknown (check transaction)'}`);
  console.log(`Transaction: ${tx2.hash}`);
  console.log(`\nView on Sepolia Etherscan:`);
  console.log(`https://sepolia.etherscan.io/tx/${tx2.hash}`);
  console.log(`\nView token:`);
  console.log(`https://sepolia.networked.art/${deployer.address}/${MINT_CONTRACT}/${tokenId || 'TOKEN_ID'}`);
  console.log('\nTest token:');
  console.log(`TOKEN_ID=${tokenId || 'TOKEN_ID'} npx hardhat run scripts/test-minted-token.js --network sepolia`);
  console.log();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
