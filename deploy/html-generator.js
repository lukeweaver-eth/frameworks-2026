// html-generator.js
// Generate HTML file that loads modules from ETHFS

const fs = require('fs');
const path = require('path');

/**
 * Extract CSS from index-instanced.html
 * @param {string} templatePath - Path to index-instanced.html
 * @returns {string} - CSS content
 */
function extractCSS(templatePath) {
    const content = fs.readFileSync(templatePath, 'utf8');

    // Extract content between <style> and </style>
    const styleMatch = content.match(/<style>([\s\S]*?)<\/style>/);

    if (!styleMatch) {
        throw new Error('Could not find <style> tag in template');
    }

    return styleMatch[1].trim();
}

/**
 * Extract HTML body content (divs, UI elements)
 * @param {string} templatePath - Path to index-instanced.html
 * @returns {string} - HTML body content
 */
function extractBodyHTML(templatePath) {
    const content = fs.readFileSync(templatePath, 'utf8');

    // Extract everything between <body> and first <script>
    const bodyMatch = content.match(/<body>([\s\S]*?)<script/);

    if (!bodyMatch) {
        throw new Error('Could not find body content in template');
    }

    return bodyMatch[1].trim();
}

/**
 * Extract initialization code from <script> block
 * @param {string} templatePath - Path to index-instanced.html
 * @returns {string} - Initialization JavaScript
 */
function extractInitScript(templatePath) {
    const content = fs.readFileSync(templatePath, 'utf8');

    // Find the main application script block (after module imports)
    // Look for: <!-- Main application --> followed by <script>
    const initMatch = content.match(/<!-- Main application -->\s*<script>([\s\S]*?)<\/script>/);

    if (!initMatch) {
        throw new Error('Could not find initialization script in template');
    }

    return initMatch[1].trim();
}

/**
 * Generate complete HTML with ETHFS module references
 * @param {object} versions - Component versions from versions.json
 * @param {object} config - Configuration with dependencies
 * @param {string} templatePath - Path to index-instanced.html
 * @returns {string} - Complete HTML document
 */
function generateHTML(versions, config, templatePath) {
    const css = extractCSS(templatePath);
    const bodyHTML = extractBodyHTML(templatePath);
    const initScript = extractInitScript(templatePath);

    // Build script tags for dependencies
    const threeJsPath = versions.dependencies.threejs.ethfsPath;

    // Build script tags for modules in load order
    const modulePaths = config.loadOrder.map(componentName => {
        const component = versions.components[componentName];
        if (!component || !component.ethfsPath) {
            throw new Error(`Component ${componentName} not found or not deployed`);
        }
        return component.ethfsPath;
    });

    // Generate HTML
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Frameworks V3 v${versions.globalVersion}</title>
    <meta name="description" content="Frameworks V3 - Modular spatial content structure tool">
    <meta name="version" content="${versions.globalVersion}">
    <meta name="deployment" content="${versions.lastDeployment || 'unknown'}">
    <style>
${css}
    </style>
</head>
<body>
${bodyHTML}

    <!-- Three.js from ETHFS -->
    <script src="${threeJsPath}"></script>

    <!-- Frameworks modules from ETHFS -->
${modulePaths.map(path => `    <script src="${path}"></script>`).join('\n')}

    <!-- Main application initialization -->
    <script>
${initScript}
    </script>
</body>
</html>`;

    return html;
}

/**
 * Generate HTML and save to file
 * @param {object} versions - Component versions
 * @param {object} config - Configuration
 * @param {string} templatePath - Path to template
 * @param {string} outputPath - Path to save generated HTML
 */
function generateAndSave(versions, config, templatePath, outputPath) {
    try {
        const html = generateHTML(versions, config, templatePath);
        fs.writeFileSync(outputPath, html, 'utf8');
        console.log(`✓ Generated HTML: ${outputPath}`);
        console.log(`  Version: ${versions.globalVersion}`);
        console.log(`  Modules: ${config.loadOrder.length}`);
        return html;
    } catch (error) {
        console.error(`✗ Failed to generate HTML:`, error.message);
        throw error;
    }
}

/**
 * Generate minimal HTML for testing (without ETHFS paths)
 * @param {string} templatePath - Path to template
 * @param {string} outputPath - Path to save
 */
function generateTestHTML(templatePath, outputPath) {
    const css = extractCSS(templatePath);
    const bodyHTML = extractBodyHTML(templatePath);
    const initScript = extractInitScript(templatePath);

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Frameworks V3 - Test Build</title>
    <style>
${css}
    </style>
</head>
<body>
${bodyHTML}

    <!-- Three.js from CDN -->
    <script src="https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js"></script>

    <!-- Frameworks modules (local for testing) -->
    <script src="src/core.js"></script>
    <script src="src/palette.js"></script>
    <script src="src/context-camera.js"></script>
    <script src="src/context-color.js"></script>
    <script src="src/context-selection.js"></script>
    <script src="src/command-tree.js"></script>
    <script src="src/commands.js"></script>
    <script src="src/renderer-instanced.js"></script>

    <!-- Main application -->
    <script>
${initScript}
    </script>
</body>
</html>`;

    fs.writeFileSync(outputPath, html, 'utf8');
    console.log(`✓ Generated test HTML: ${outputPath}`);
}

module.exports = {
    extractCSS,
    extractBodyHTML,
    extractInitScript,
    generateHTML,
    generateAndSave,
    generateTestHTML
};
