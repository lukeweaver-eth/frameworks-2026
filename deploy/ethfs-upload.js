// ethfs-upload.js
// ETHFS upload integration using FileStore contract
// Uploads files to ETHFS and returns SSTORE2 pointer addresses

const fs = require('fs');
const { ethers } = require('ethers');

// FileStore contract ABI (only methods we need)
const FILE_STORE_ABI = [
    "function createFile(string memory filename, string memory contents) public returns (address pointer, tuple(uint256 size, tuple(address pointer, uint32 start, uint32 end)[] slices) file)",
    "function createFileFromChunks(string memory filename, string[] memory chunks) public returns (address pointer, tuple(uint256 size, tuple(address pointer, uint32 start, uint32 end)[] slices) file)",
    "function fileExists(string memory filename) public view returns (bool)",
    "function getFile(string memory filename) public view returns (tuple(uint256 size, tuple(address pointer, uint32 start, uint32 end)[] slices))"
];

// ETHFS FileStore address (same across all networks)
const FILE_STORE_ADDRESS = '0xFe1411d6864592549AdE050215482e4385dFa0FB';

/**
 * Upload a file to ETHFS FileStore
 * @param {string} filePath - Local file path
 * @param {string} filename - Filename to use on ETHFS
 * @param {object} config - Configuration (network, signer, gas settings)
 * @returns {Promise<object>} - {success: boolean, pointer: string, filename: string, txHash: string}
 */
async function uploadToETHFS(filePath, filename, config) {
    console.log(`[ETHFS] Uploading ${filename}...`);

    // Read file content
    const content = fs.readFileSync(filePath, 'utf8');
    const sizeKB = (content.length / 1024).toFixed(2);

    console.log(`  File size: ${sizeKB} KB`);

    // Dry run mode - don't actually upload
    if (config.dryRun) {
        console.log(`  [DRY RUN] Would upload to ETHFS as ${filename}`);
        return {
            success: true,
            filename: filename,
            pointer: '0x0000000000000000000000000000000000000000',
            txHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
            gasUsed: 0,
            dryRun: true
        };
    }

    // Get signer from config
    if (!config.signer) {
        throw new Error('No signer provided in config. Set config.signer with ethers.Wallet or similar');
    }

    // Connect to FileStore contract
    const fileStore = new ethers.Contract(
        FILE_STORE_ADDRESS,
        FILE_STORE_ABI,
        config.signer
    );

    try {
        // Check if file already exists
        const exists = await fileStore.fileExists(filename);
        if (exists) {
            console.log(`  ⚠️  File ${filename} already exists on ETHFS`);
            if (!config.force) {
                throw new Error(`File ${filename} already exists. Use --force to overwrite`);
            }
            console.log(`  Force flag set, will overwrite existing file`);
        }

        // Choose upload method based on file size
        // FileStore.createFile() auto-chunks at 24KB (0x6000 - 1)
        // For very large files, we could pre-chunk, but auto-chunking is simpler
        const CHUNK_SIZE = 24575; // 0x6000 - 1 bytes
        const needsChunking = content.length > CHUNK_SIZE;

        let tx;
        if (needsChunking) {
            console.log(`  File requires chunking (${Math.ceil(content.length / CHUNK_SIZE)} chunks)`);

            // Pre-chunk the file for better control
            const chunks = [];
            for (let i = 0; i < content.length; i += CHUNK_SIZE) {
                chunks.push(content.slice(i, i + CHUNK_SIZE));
            }

            // Upload with chunks
            tx = await fileStore.createFileFromChunks(filename, chunks, {
                gasLimit: config.ethfsUploadConfig?.gasLimit || 10000000
            });
        } else {
            // Upload as single file (FileStore will still chunk it, but simpler)
            tx = await fileStore.createFile(filename, content, {
                gasLimit: config.ethfsUploadConfig?.gasLimit || 5000000
            });
        }

        console.log(`  Transaction sent: ${tx.hash}`);
        console.log(`  Waiting for confirmation...`);

        const receipt = await tx.wait();
        console.log(`  ✓ Confirmed in block ${receipt.blockNumber}`);
        console.log(`  Gas used: ${receipt.gasUsed.toString()}`);

        // Extract pointer address from logs
        // FileCreated event: FileCreated(string indexed filename, address indexed pointer, ...)
        const fileCreatedEvent = receipt.logs.find(log => {
            try {
                const parsed = fileStore.interface.parseLog(log);
                return parsed.name === 'FileCreated';
            } catch {
                return false;
            }
        });

        let pointer;
        if (fileCreatedEvent) {
            const parsed = fileStore.interface.parseLog(fileCreatedEvent);
            pointer = parsed.args.pointer;
        } else {
            // Fallback: query the file to get pointer
            const file = await fileStore.getFile(filename);
            pointer = file.slices[0].pointer; // First slice pointer
        }

        console.log(`  SSTORE2 pointer: ${pointer}`);

        return {
            success: true,
            filename: filename,
            pointer: pointer,
            txHash: tx.hash,
            gasUsed: receipt.gasUsed.toString(),
            blockNumber: receipt.blockNumber
        };

    } catch (error) {
        console.error(`  ✗ Upload failed:`, error.message);
        throw error;
    }
}

/**
 * Upload multiple files in sequence
 * @param {Array} files - Array of {filePath, filename, component} objects
 * @param {object} config - Configuration
 * @returns {Promise<Array>} - Array of upload results with pointers
 */
async function uploadMultiple(files, config) {
    const results = [];

    console.log(`\n[ETHFS] Uploading ${files.length} file(s)...\n`);

    for (const file of files) {
        try {
            const result = await uploadToETHFS(file.filePath, file.filename, config);
            results.push({
                component: file.component,
                filename: file.filename,
                ...result
            });

            // Add delay between uploads to avoid nonce conflicts
            if (!config.dryRun && files.indexOf(file) < files.length - 1) {
                const delay = config.ethfsUploadConfig?.retryDelay || 3000;
                console.log(`  Waiting ${delay}ms before next upload...\n`);
                await sleep(delay);
            }
        } catch (error) {
            console.error(`  ✗ Failed to upload ${file.filename}:`, error.message);
            results.push({
                component: file.component,
                filename: file.filename,
                success: false,
                error: error.message
            });
        }
    }

    console.log(`\n[ETHFS] Upload batch complete\n`);
    return results;
}

/**
 * Estimate gas cost for uploading a file
 * @param {string} filePath - Local file path
 * @returns {number} - Estimated gas units
 */
function estimateGas(filePath) {
    const stats = fs.statSync(filePath);
    const sizeKB = stats.size / 1024;

    // Rough estimate: ~20,000 gas per KB
    const estimatedGas = Math.ceil(sizeKB * 20000);

    return estimatedGas;
}

/**
 * Sleep utility
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise}
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Validate SSTORE2 pointer address format
 * @param {string} pointer - SSTORE2 pointer address to validate
 * @returns {boolean}
 */
function validatePointer(pointer) {
    if (!pointer || typeof pointer !== 'string') return false;
    // Check if it's a valid Ethereum address (0x + 40 hex chars)
    return /^0x[a-fA-F0-9]{40}$/.test(pointer);
}

/**
 * Initialize signer from private key and RPC URL
 * @param {string} privateKey - Private key (with or without 0x prefix)
 * @param {string} rpcUrl - RPC URL for the network
 * @returns {ethers.Wallet} - Configured signer
 */
function createSigner(privateKey, rpcUrl) {
    const provider = new ethers.providers.JsonRpcProvider(rpcUrl);

    // Add 0x prefix if missing
    const key = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;

    const wallet = new ethers.Wallet(key, provider);
    return wallet;
}

module.exports = {
    uploadToETHFS,
    uploadMultiple,
    estimateGas,
    validatePointer,
    createSigner,
    FILE_STORE_ADDRESS
};
