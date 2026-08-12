#!/usr/bin/env node
/**
 * view.mjs — pull a composition's artifact from chain and open it.
 *
 *   node view.mjs           # composition 45 (ART / NETWORK / KNOWLEDGE)
 *   node view.mjs 45        # explicit
 *   node view.mjs 45 --json # print the metadata instead of opening
 *
 * Nothing local is read. The HTML comes out of the renderer, which reads
 * the command string from Frameworks and the viewer from EthFS.
 *
 * Requires: npm i ethers   (or run from a dir that already has it)
 */
import { ethers } from 'ethers';
import { writeFileSync } from 'fs';
import { execSync } from 'child_process';
import { tmpdir } from 'os';
import { join } from 'path';

const RENDERER = '0x281C60Fafa8eaDCdfa16d58e919a1e3507eFA140';
const RPC      = 'https://ethereum-sepolia-rpc.publicnode.com';

const ABI = [
  'function uri(uint256) view returns (string)',
  'function commandString(uint256) view returns (string)',
  'function frameNames(uint256) view returns (string[])',
];

const id       = Number(process.argv[2] ?? 45);
const jsonOnly = process.argv.includes('--json');

const provider = new ethers.JsonRpcProvider(RPC);
const r = new ethers.Contract(RENDERER, ABI, provider);

console.log(`reading composition ${id} from ${RENDERER}\n`);

const [cmd, names] = await Promise.all([r.commandString(id), r.frameNames(id)]);
console.log('command string :', cmd);
console.log('frame names    :', names.join(', '));

const uri  = await r.uri(id);
const meta = JSON.parse(Buffer.from(uri.split('base64,')[1], 'base64').toString());

console.log('name           :', meta.name);
console.log('attributes     :', meta.attributes.map(a => `${a.trait_type}=${a.value}`).join('  '));

if (jsonOnly) {
  const { animation_url, ...rest } = meta;
  console.log('\n' + JSON.stringify(rest, null, 2));
  process.exit(0);
}

const html = Buffer.from(meta.animation_url.split('base64,')[1], 'base64').toString();
const out  = join(tmpdir(), `frameworks-${id}.html`);
writeFileSync(out, html);

console.log(`\nhtml           : ${(html.length / 1024).toFixed(1)} KB -> ${out}`);
try {
  execSync(`open -a "Google Chrome" "${out}"`);
  console.log('opened in Chrome (WebGPU required — Chrome 113+ / Edge 113+)');
} catch {
  console.log(`open it manually: ${out}`);
}
