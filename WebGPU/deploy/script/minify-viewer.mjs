/**
 * minify-viewer.mjs
 *
 * Extracts the inline <script> block from frameworks-v4-viewer.html,
 * minifies it with terser, strips HTML comments and collapses whitespace,
 * and writes the result to viewer/frameworks_v4_viewer_v2.min.html.
 *
 * Usage:
 *   node script/minify-viewer.mjs
 *
 * Output file is what gets uploaded to EthFS — not the source HTML.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { minify } from 'terser';

const __dirname = dirname(fileURLToPath(import.meta.url));

const INPUT  = join(__dirname, '..', '..', 'frameworks-v4-viewer.html');
const OUTDIR = join(__dirname, '..', 'viewer');
const OUTPUT = join(OUTDIR, 'frameworks_v4_viewer_v2.min.html');

async function main() {
  console.log('Reading:', INPUT);
  const html = readFileSync(INPUT, 'utf8');

  // Extract inline <script> block (everything between last <script> and </script>)
  const scriptOpen  = html.lastIndexOf('<script>');
  const scriptClose = html.lastIndexOf('</script>');
  if (scriptOpen === -1 || scriptClose === -1) {
    throw new Error('Could not find inline <script>...</script> block');
  }

  const before = html.slice(0, scriptOpen + '<script>'.length);
  const js     = html.slice(scriptOpen + '<script>'.length, scriptClose);
  const after  = html.slice(scriptClose);

  console.log(`JS block: ${(js.length / 1024).toFixed(1)} KB`);

  // Minify JS
  const result = await minify(js, {
    compress: { passes: 2 },
    mangle: true,
    format: { comments: false },
  });

  if (!result.code) throw new Error('Terser returned empty output');
  console.log(`Minified JS: ${(result.code.length / 1024).toFixed(1)} KB`);

  // Strip HTML comments and collapse whitespace in non-script HTML
  const minifyHtml = (str) => str
    .replace(/<!--[\s\S]*?-->/g, '')   // remove HTML comments
    .replace(/\s*\n\s*/g, '\n')        // collapse blank lines
    .replace(/[ \t]+/g, ' ')           // collapse inline whitespace
    .trim();

  const minHtml = minifyHtml(before) + result.code + minifyHtml(after);

  mkdirSync(OUTDIR, { recursive: true });
  writeFileSync(OUTPUT, minHtml, 'utf8');

  const inKB  = (html.length      / 1024).toFixed(1);
  const outKB = (minHtml.length   / 1024).toFixed(1);
  const pct   = (100 - minHtml.length / html.length * 100).toFixed(1);
  console.log(`\nDone.`);
  console.log(`  Input:  ${inKB} KB`);
  console.log(`  Output: ${outKB} KB  (${pct}% reduction)`);
  console.log(`  File:   ${OUTPUT}`);
}

main().catch(e => { console.error(e.message || e); process.exit(1); });
