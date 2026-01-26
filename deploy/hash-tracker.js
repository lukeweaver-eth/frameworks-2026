// hash-tracker.js
// File change detection using SHA-256 hashing

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

/**
 * Compute SHA-256 hash of a file
 * @param {string} filePath - Absolute path to file
 * @returns {string} - Hex hash string
 */
function computeFileHash(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Get file size in bytes
 * @param {string} filePath - Absolute path to file
 * @returns {number} - File size in bytes
 */
function getFileSize(filePath) {
    const stats = fs.statSync(filePath);
    return stats.size;
}

/**
 * Get file last modified timestamp
 * @param {string} filePath - Absolute path to file
 * @returns {string} - ISO timestamp
 */
function getLastModified(filePath) {
    const stats = fs.statSync(filePath);
    return stats.mtime.toISOString();
}

/**
 * Compute hashes for all components
 * @param {object} config - Configuration object with component paths
 * @param {string} baseDir - Base directory (frameworks-v3/)
 * @returns {object} - Map of component name → {hash, size, lastModified, path}
 */
function computeAllHashes(config, baseDir) {
    const hashes = {};

    for (const [componentName, relativePath] of Object.entries(config.components)) {
        const absolutePath = path.join(baseDir, relativePath);

        try {
            hashes[componentName] = {
                hash: computeFileHash(absolutePath),
                size: getFileSize(absolutePath),
                lastModified: getLastModified(absolutePath),
                path: absolutePath
            };
        } catch (error) {
            console.error(`Error hashing ${componentName} at ${absolutePath}:`, error.message);
            hashes[componentName] = {
                hash: null,
                size: 0,
                lastModified: null,
                path: absolutePath,
                error: error.message
            };
        }
    }

    return hashes;
}

/**
 * Detect which components have changed
 * @param {object} currentHashes - Current hash map
 * @param {object} previousVersions - Previous versions.json component data
 * @returns {object} - {changed: [...], unchanged: [...], details: {...}}
 */
function detectChanges(currentHashes, previousVersions) {
    const changed = [];
    const unchanged = [];
    const details = {};

    for (const [componentName, currentData] of Object.entries(currentHashes)) {
        const previousData = previousVersions[componentName];

        if (!previousData || !previousData.hash) {
            // Component never deployed before
            changed.push(componentName);
            details[componentName] = {
                status: 'new',
                reason: 'Never deployed',
                oldHash: null,
                newHash: currentData.hash
            };
        } else if (currentData.hash !== previousData.hash) {
            // Hash changed - file modified
            changed.push(componentName);
            details[componentName] = {
                status: 'modified',
                reason: 'Content changed',
                oldHash: previousData.hash,
                newHash: currentData.hash,
                oldSize: previousData.size,
                newSize: currentData.size,
                oldVersion: previousData.version
            };
        } else {
            // No change
            unchanged.push(componentName);
            details[componentName] = {
                status: 'unchanged',
                reason: 'Hash matches',
                hash: currentData.hash,
                version: previousData.version
            };
        }
    }

    return {
        changed,
        unchanged,
        details
    };
}

/**
 * Print change detection report
 * @param {object} changeReport - Result from detectChanges()
 */
function printChangeReport(changeReport) {
    console.log('\n=== CHANGE DETECTION REPORT ===\n');

    if (changeReport.changed.length === 0) {
        console.log('✓ No changes detected. All components up to date.');
        return;
    }

    console.log(`${changeReport.changed.length} component(s) changed:`);
    changeReport.changed.forEach(name => {
        const detail = changeReport.details[name];
        console.log(`  • ${name}: ${detail.status} - ${detail.reason}`);
        if (detail.oldHash) {
            console.log(`    Old hash: ${detail.oldHash.slice(0, 12)}...`);
            console.log(`    New hash: ${detail.newHash.slice(0, 12)}...`);
        }
    });

    console.log(`\n${changeReport.unchanged.length} component(s) unchanged:`);
    changeReport.unchanged.forEach(name => {
        const detail = changeReport.details[name];
        console.log(`  • ${name}: v${detail.version} (${detail.hash.slice(0, 12)}...)`);
    });

    console.log('');
}

module.exports = {
    computeFileHash,
    getFileSize,
    getLastModified,
    computeAllHashes,
    detectChanges,
    printChangeReport
};
