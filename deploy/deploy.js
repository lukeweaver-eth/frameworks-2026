#!/usr/bin/env node
// deploy.js
// Main deployment orchestration script

const fs = require('fs');
const path = require('path');
const hashTracker = require('./hash-tracker');
const ethfsUpload = require('./ethfs-upload');
const htmlGenerator = require('./html-generator');

// Paths
const BASE_DIR = path.resolve(__dirname, '..');
const CONFIG_PATH = path.join(__dirname, 'config.json');
const VERSIONS_PATH = path.join(__dirname, 'versions.json');
const TEMPLATE_PATH = path.join(BASE_DIR, 'index-instanced.html');

/**
 * Semantic version increment
 * @param {string} version - Current version (e.g., "1.0.0")
 * @param {string} bump - Type of bump: "major", "minor", "patch"
 * @returns {string} - New version
 */
function incrementVersion(version, bump = 'patch') {
    const parts = version.split('.').map(Number);
    let [major, minor, patch] = parts;

    switch (bump) {
        case 'major':
            major++;
            minor = 0;
            patch = 0;
            break;
        case 'minor':
            minor++;
            patch = 0;
            break;
        case 'patch':
        default:
            patch++;
            break;
    }

    return `${major}.${minor}.${patch}`;
}

/**
 * Parse command line arguments
 * @returns {object} - Parsed arguments
 */
function parseArgs() {
    const args = process.argv.slice(2);
    const options = {
        dryRun: false,
        component: null,
        bump: 'patch',
        network: 'mainnet',
        force: false
    };

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];

        switch (arg) {
            case '--dry-run':
            case '-d':
                options.dryRun = true;
                break;
            case '--component':
            case '-c':
                options.component = args[++i];
                break;
            case '--bump':
            case '-b':
                options.bump = args[++i];
                break;
            case '--network':
            case '-n':
                options.network = args[++i];
                break;
            case '--force':
            case '-f':
                options.force = true;
                break;
            case '--help':
            case '-h':
                printHelp();
                process.exit(0);
                break;
        }
    }

    return options;
}

/**
 * Print help message
 */
function printHelp() {
    console.log(`
Frameworks V3 Deployment Script

Usage:
  node deploy.js [options]

Options:
  -d, --dry-run          Simulate deployment without uploading
  -c, --component NAME   Deploy only specific component
  -b, --bump TYPE        Version bump type: major, minor, patch (default: patch)
  -n, --network NAME     Network: mainnet, sepolia (default: mainnet)
  -f, --force            Force deployment even if no changes detected
  -h, --help             Show this help message

Examples:
  node deploy.js --dry-run
  node deploy.js --component camera --bump minor
  node deploy.js --network sepolia
`);
}

/**
 * Main deployment workflow
 */
async function deploy() {
    console.log('='.repeat(60));
    console.log('FRAMEWORKS V3 DEPLOYMENT');
    console.log('='.repeat(60));
    console.log('');

    // Parse arguments
    const options = parseArgs();

    if (options.dryRun) {
        console.log('🔍 DRY RUN MODE - No actual uploads will be performed\n');
    }

    // Load configuration
    console.log('📋 Loading configuration...');
    const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    config.dryRun = options.dryRun;
    config.network = options.network;
    config.force = options.force;

    // Setup signer from environment variables (if not dry run)
    if (!options.dryRun) {
        const privateKey = process.env.PRIVATE_KEY;
        const rpcUrl = process.env.RPC_URL || config.networks[options.network].rpcUrl;

        if (!privateKey) {
            throw new Error('PRIVATE_KEY environment variable required for deployment');
        }

        if (!rpcUrl) {
            throw new Error(`RPC_URL not found for network: ${options.network}`);
        }

        console.log(`  Network: ${options.network}`);
        console.log(`  RPC URL: ${rpcUrl}`);

        // Create signer
        config.signer = ethfsUpload.createSigner(privateKey, rpcUrl);
        console.log(`  Signer: ${config.signer.address}`);
    } else {
        console.log(`  Network: ${options.network} (dry run)`);
    }

    console.log(`  Components: ${Object.keys(config.components).length}`);
    console.log('');

    // Load previous versions
    console.log('📦 Loading deployment state...');
    const versions = JSON.parse(fs.readFileSync(VERSIONS_PATH, 'utf8'));
    console.log(`  Current global version: ${versions.globalVersion}`);
    console.log(`  Last deployment: ${versions.lastDeployment || 'never'}`);
    console.log('');

    // Compute current hashes
    console.log('🔍 Computing file hashes...');
    const currentHashes = hashTracker.computeAllHashes(config, BASE_DIR);
    console.log('');

    // Detect changes
    console.log('🔍 Detecting changes...');
    const changeReport = hashTracker.detectChanges(currentHashes, versions.components);
    hashTracker.printChangeReport(changeReport);

    // Filter changed components if specific component requested
    let componentsToUpdate = changeReport.changed;

    if (options.component) {
        if (!componentsToUpdate.includes(options.component)) {
            if (options.force) {
                console.log(`⚠️  Component "${options.component}" unchanged, but forcing deployment`);
                componentsToUpdate = [options.component];
            } else {
                console.log(`✓ Component "${options.component}" has not changed. Use --force to deploy anyway.`);
                return;
            }
        } else {
            componentsToUpdate = [options.component];
            console.log(`\n📦 Deploying only: ${options.component}`);
        }
    }

    if (componentsToUpdate.length === 0 && !options.force) {
        console.log('✓ No changes detected. Nothing to deploy.');
        return;
    }

    // Prepare uploads
    console.log('\n📦 Preparing uploads...');
    const uploads = [];

    for (const componentName of componentsToUpdate) {
        const componentData = versions.components[componentName];
        const currentData = currentHashes[componentName];

        // Increment version
        const oldVersion = componentData.version || '0.0.0';
        const newVersion = incrementVersion(oldVersion, options.bump);

        // Generate filename
        const filename = `frameworks-v3-${componentName}-v${newVersion}.js`;

        uploads.push({
            component: componentName,
            filePath: currentData.path,
            filename,
            oldVersion,
            newVersion,
            size: currentData.size,
            hash: currentData.hash
        });

        console.log(`  ${componentName}: v${oldVersion} → v${newVersion}`);
    }

    // Upload to ETHFS
    console.log('\n📤 Uploading to ETHFS...');
    const uploadResults = await ethfsUpload.uploadMultiple(uploads, config);

    // Update versions.json
    console.log('\n💾 Updating deployment state...');
    const timestamp = new Date().toISOString();

    uploadResults.forEach(result => {
        if (result.success) {
            const upload = uploads.find(u => u.component === result.component);

            versions.components[result.component] = {
                version: upload.newVersion,
                hash: upload.hash,
                filename: result.filename,
                pointer: result.pointer,
                lastModified: timestamp,
                size: upload.size
            };

            console.log(`  ✓ ${result.component}: ${result.filename} → ${result.pointer}`);
        } else {
            console.error(`  ✗ ${result.component}: ${result.error}`);
        }
    });

    // Increment global version
    const newGlobalVersion = incrementVersion(versions.globalVersion, options.bump);
    versions.globalVersion = newGlobalVersion;
    versions.lastDeployment = timestamp;
    versions.deploymentCount++;

    // Add to deployment history
    if (!versions.deploymentHistory) {
        versions.deploymentHistory = [];
    }

    versions.deploymentHistory.push({
        timestamp,
        globalVersion: newGlobalVersion,
        components: uploadResults.map(r => ({
            name: r.component,
            version: uploads.find(u => u.component === r.component).newVersion,
            filename: r.filename,
            pointer: r.pointer
        })),
        network: options.network,
        dryRun: options.dryRun
    });

    // Save versions.json
    if (!options.dryRun) {
        fs.writeFileSync(VERSIONS_PATH, JSON.stringify(versions, null, 2), 'utf8');
        console.log(`\n✓ Saved deployment state to versions.json`);
    } else {
        console.log(`\n[DRY RUN] Would save deployment state to versions.json`);
    }

    // Generate HTML
    console.log('\n🌐 Generating HTML...');
    const outputPath = path.join(BASE_DIR, 'deploy', `frameworks-v3-v${newGlobalVersion}.html`);

    try {
        htmlGenerator.generateAndSave(versions, config, TEMPLATE_PATH, outputPath);

        // Upload HTML to ETHFS
        if (!options.dryRun) {
            console.log('\n📤 Uploading HTML to ETHFS...');
            const htmlFilename = `frameworks-v3-index-v${newGlobalVersion}.html`;
            const htmlUploadResult = await ethfsUpload.uploadToETHFS(outputPath, htmlFilename, config);

            if (htmlUploadResult.success) {
                console.log(`  ✓ HTML uploaded: ${htmlFilename} → ${htmlUploadResult.pointer}`);

                // Update versions.json with HTML metadata
                versions.components.index = {
                    version: newGlobalVersion,
                    hash: hashTracker.computeFileHash(outputPath),
                    filename: htmlFilename,
                    pointer: htmlUploadResult.pointer,
                    lastModified: timestamp,
                    size: hashTracker.getFileSize(outputPath)
                };

                fs.writeFileSync(VERSIONS_PATH, JSON.stringify(versions, null, 2), 'utf8');
            }
        }
    } catch (error) {
        console.error(`✗ Failed to generate HTML:`, error.message);
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('DEPLOYMENT SUMMARY');
    console.log('='.repeat(60));
    console.log(`Global version: v${versions.globalVersion}`);
    console.log(`Components updated: ${uploadResults.length}`);
    console.log(`Timestamp: ${timestamp}`);

    if (options.dryRun) {
        console.log('\n⚠️  This was a dry run. No actual changes were made.');
    } else {
        console.log('\n✅ Deployment complete!');
        console.log(`\nNext steps:`);
        console.log(`1. Deploy FrameworksRenderer.sol contract to ${options.network}`);
        console.log(`2. Test rendered HTML using ETHFS FileStore`);
        console.log(`3. Register renderer with mint protocol Factory`);
        console.log(`\nDeployed files:`);
        uploadResults.forEach(r => {
            if (r.success) {
                console.log(`  - ${r.filename}: ${r.pointer}`);
            }
        });
    }

    console.log('');
}

// Run deployment
deploy().catch(error => {
    console.error('\n❌ Deployment failed:', error);
    process.exit(1);
});
