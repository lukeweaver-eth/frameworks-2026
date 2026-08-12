#!/usr/bin/env python3
"""
derive-viewer.py

Derives frameworks-v4-viewer.html from frameworks-v4-mint.html by:
  1. Removing ethers CDN script tag
  2. Removing Mint panel CSS (/* Mint panel */ ... end of #img-compress block)
  3. Removing Mint panel HTML (<!-- Mint Panel --> div)
  4. Removing Mint button in command bar
  5. Replacing capture infrastructure in resize() with simple version
  6. Removing o/O key handlers
  7. Removing MINT PANEL LOGIC section
  8. Stripping mint-only state vars and logic from render loop
  9. Replacing doRenderPass refactor with simple inline render pass
 10. Adding IIFE wrap around the script
 11. Adjusting autoExecuteCommand block (remove mintCommandString refs)
 12. Removing buildPaletteGrid from paletteEditContext.onPaletteChanged

Usage:
  python3 deploy/script/derive-viewer.py

Output: frameworks-v4-viewer.html (in repo root, next to mint file)
"""

import re
import sys
from pathlib import Path

ROOT = Path(__file__).parent.parent.parent
SRC  = ROOT / 'frameworks-v5-mint.html'
DST  = ROOT / 'frameworks-v5-viewer.html'

lines = SRC.read_text(encoding='utf-8').splitlines(keepends=True)
out = []

i = 0
total = len(lines)

def line_stripped(idx):
    return lines[idx].strip()

def startswith(idx, s):
    return lines[idx].strip().startswith(s)

def contains(idx, s):
    return s in lines[idx]

# ---- pass through lines with selective removal / replacement ----

skip_until = None   # a string that must appear to resume output
skip_count = 0      # skip exactly N more lines after current

while i < total:
    raw = lines[i]
    stripped = raw.strip()

    # ----------------------------------------------------------------
    # 1. Remove ethers CDN <script> tag (single line)
    # ----------------------------------------------------------------
    if 'cdnjs.cloudflare.com' in raw and 'ethers' in raw and raw.strip().startswith('<script'):
        i += 1
        continue

    # ----------------------------------------------------------------
    # 2. Remove Mint panel CSS block
    #    Starts at: /* Mint panel */
    #    Ends at:   closing } that ends #img-compress block
    #    Strategy: find the start comment, then skip until we've seen
    #    the closing } for #img-compress (the last CSS rule before </style>)
    # ----------------------------------------------------------------
    if stripped == '/* Mint panel */':
        # Skip until (and including) the line that is just '}'
        # that closes the #img-compress .compress-stat block.
        # We find it by scanning for </style> — the CSS block ends with
        # the last } before </style>.
        j = i + 1
        # Find the next </style> to know where CSS ends
        while j < total and '</style>' not in lines[j]:
            j += 1
        # Walk back to find last non-empty line which should be '}'
        k = j - 1
        while k > i and lines[k].strip() == '':
            k -= 1
        # Skip from i to k inclusive
        i = k + 1
        continue

    # ----------------------------------------------------------------
    # 3. Remove <!-- Mint Panel --> HTML block
    #    Starts at: <!-- Mint Panel -->
    #    The div that immediately follows is <div id="mint-panel">
    #    We count <div depth to find the matching </div>
    # ----------------------------------------------------------------
    if stripped == '<!-- Mint Panel -->':
        # skip the comment line itself
        i += 1
        # now skip the <div id="mint-panel"> ... </div> block
        # find the opening <div on the next non-blank line
        while i < total and lines[i].strip() == '':
            i += 1
        # count div depth
        depth = 0
        while i < total:
            ln = lines[i]
            # count opening <div tags on this line
            opens = len(re.findall(r'<div\b', ln))
            closes = ln.count('</div>')
            depth += opens - closes
            i += 1
            if depth <= 0:
                break
        continue

    # ----------------------------------------------------------------
    # 4. Remove "Mint ▸" button in command bar
    # ----------------------------------------------------------------
    if 'btn-mint-toggle' in raw:
        i += 1
        continue

    # ----------------------------------------------------------------
    # 5. In the script: replace capture vars + resize() with simple version
    #    The block is:
    #      let depthTex, msaaTex, captureTex, captureBuf, captureW, captureH;
    #      function resize() {
    #        ...
    #      }  ← closing brace on its own line
    #    Replace with a simple resize() that only manages depthTex/msaaTex.
    # ----------------------------------------------------------------
    if stripped == 'let depthTex, msaaTex, captureTex, captureBuf, captureW, captureH;':
        # emit replacement
        out.append('  let depthTex, msaaTex;\n')
        i += 1
        # skip until the line after the closing brace of resize()
        # find 'function resize()' line
        while i < total and 'function resize()' not in lines[i]:
            i += 1
        # now skip the whole function body
        depth = 0
        while i < total:
            ln = lines[i]
            opens = ln.count('{')
            closes = ln.count('}')
            depth += opens - closes
            i += 1
            if depth <= 0:
                break
        # emit simple resize
        out.append('  function resize() {\n')
        out.append('    const dpr = window.devicePixelRatio || 1;\n')
        out.append('    canvas.width = canvas.clientWidth * dpr;\n')
        out.append('    canvas.height = canvas.clientHeight * dpr;\n')
        out.append('    labelCanvas.width = canvas.width;\n')
        out.append('    labelCanvas.height = canvas.height;\n')
        out.append('    if (depthTex) depthTex.destroy();\n')
        out.append('    if (msaaTex) msaaTex.destroy();\n')
        out.append('    depthTex = device.createTexture({ size: [canvas.width, canvas.height], format: depthFormat, sampleCount: SAMPLE_COUNT, usage: GPUTextureUsage.RENDER_ATTACHMENT });\n')
        out.append('    msaaTex = device.createTexture({ size: [canvas.width, canvas.height], format: fmt, sampleCount: SAMPLE_COUNT, usage: GPUTextureUsage.RENDER_ATTACHMENT });\n')
        out.append('  }\n')
        continue

    # ----------------------------------------------------------------
    # 6. Remove o / O key handlers
    #    The 'o' block: if (e.key === 'o') { ... return; }
    #    The 'O' block: if (e.key === 'O') { ... return; }
    #    Each spans multiple lines; skip brace-counted blocks.
    # ----------------------------------------------------------------
    if stripped == "if (e.key === 'o') {":
        depth = 0
        while i < total:
            ln = lines[i]
            depth += ln.count('{') - ln.count('}')
            i += 1
            if depth <= 0:
                break
        continue

    if stripped == "if (e.key === 'O') {":
        depth = 0
        while i < total:
            ln = lines[i]
            depth += ln.count('{') - ln.count('}')
            i += 1
            if depth <= 0:
                break
        continue

    # ----------------------------------------------------------------
    # 7. Remove MINT PANEL LOGIC section
    #    Starts at: // MINT PANEL LOGIC
    #    Ends at: the closing } on its own that closes main()
    #    (The section is the last thing inside main(), from the comment
    #     to the closing `}` of main() just before main().catch)
    #    We skip from the comment line to (not including) main().catch
    # ----------------------------------------------------------------
    if stripped == '// MINT PANEL LOGIC':
        # skip everything until (not including) the line "main().catch"
        i += 1
        while i < total and 'main().catch' not in lines[i]:
            i += 1
        # The line just before main().catch should be `}` (closing main).
        # We want to keep that closing brace. Back up one line in out:
        # Actually we never emitted the `}` — it was inside the skipped block.
        # We need to emit one `}` to close main().
        out.append('}\n')
        out.append('\n')
        continue

    # ----------------------------------------------------------------
    # 8. Remove capture state vars from render loop section
    #    Lines: let pendingCapture = false;
    #           let captureInFlight = false;
    # ----------------------------------------------------------------
    if stripped in ('let pendingCapture = false;', 'let captureInFlight = false;'):
        i += 1
        continue

    # ----------------------------------------------------------------
    # 9. Replace doRenderPass refactor + pendingCapture branch
    #    with simple inline render pass.
    #
    #    The block starts at: function doRenderPass(resolveTarget) {
    #    and ends after the else { doRenderPass(tv); } block.
    #
    #    We detect this by: "function doRenderPass(resolveTarget) {"
    #    and replace the whole doRenderPass function + the
    #    if (pendingCapture ...) { ... } else { doRenderPass(tv); }
    #    with a simple inline render pass.
    # ----------------------------------------------------------------
    if stripped == 'function doRenderPass(resolveTarget) {':
        # Skip doRenderPass function definition
        depth = 0
        while i < total:
            ln = lines[i]
            depth += ln.count('{') - ln.count('}')
            i += 1
            if depth <= 0:
                break

        # Now skip:  const tv = ctx.getCurrentTexture().createView();
        while i < total and 'getCurrentTexture' not in lines[i]:
            i += 1
        i += 1  # consume the const tv line

        # Skip: if (pendingCapture && !captureInFlight) { ... } else { doRenderPass(tv); }
        # Find the if line
        while i < total and 'pendingCapture' not in lines[i]:
            i += 1
        # skip the whole if/else block
        depth = 0
        while i < total:
            ln = lines[i]
            depth += ln.count('{') - ln.count('}')
            i += 1
            if depth <= 0:
                break

        # Emit simple inline render pass
        out.append('\n')
        out.append('    const tv = ctx.getCurrentTexture().createView();\n')
        out.append('    const rp = enc.beginRenderPass({\n')
        out.append('      colorAttachments: [{\n')
        out.append('        view: msaaTex.createView(),\n')
        out.append('        resolveTarget: tv,\n')
        out.append('        clearValue: { r:0.071, g:0.078, b:0.102, a:1 },\n')
        out.append('        loadOp:\'clear\', storeOp:\'discard\',\n')
        out.append('      }],\n')
        out.append('      depthStencilAttachment: { view: depthTex.createView(), depthClearValue: 1, depthLoadOp:\'clear\', depthStoreOp:\'discard\' },\n')
        out.append('    });\n')
        out.append('    if (n > 0) {\n')
        out.append('      rp.setPipeline(framePipeline);\n')
        out.append('      rp.setBindGroup(0, renderBG);\n')
        out.append('      rp.setVertexBuffer(0, frameVB);\n')
        out.append('      rp.setIndexBuffer(frameIB, \'uint16\');\n')
        out.append('      rp.drawIndexedIndirect(indirectBuf, 0);\n')
        out.append('    }\n')
        out.append('    if (showUI) {\n')
        out.append('      rp.setPipeline(cursorPipeline);\n')
        out.append('      rp.setBindGroup(0, renderBG);\n')
        out.append('      rp.setVertexBuffer(0, curVB);\n')
        out.append('      rp.setIndexBuffer(curIB, \'uint16\');\n')
        out.append('      rp.drawIndexed(curIdxCount, 1);\n')
        out.append('    }\n')
        out.append('    rp.end();\n')
        out.append('\n')
        continue

    # ----------------------------------------------------------------
    # 10. Remove GPU readback / capture completion block
    #     Starts at: if (captureInFlight) {
    #     Skip entire block
    # ----------------------------------------------------------------
    if stripped == 'if (captureInFlight) {':
        depth = 0
        while i < total:
            ln = lines[i]
            depth += ln.count('{') - ln.count('}')
            i += 1
            if depth <= 0:
                break
        continue

    # ----------------------------------------------------------------
    # 11. Fix autoExecuteCommand block — remove mintCommandString ref
    #     The line: mintCommandString = autoExecuteCommand;
    # ----------------------------------------------------------------
    if stripped == 'mintCommandString = autoExecuteCommand;':
        i += 1
        continue

    # ----------------------------------------------------------------
    # 12. Remove "let mintCommandString = '';" declaration
    # ----------------------------------------------------------------
    if stripped == "let mintCommandString = '';":
        i += 1
        continue

    # ----------------------------------------------------------------
    # 13. Remove buildPaletteGrid from paletteEditContext.onPaletteChanged
    #     The line: buildPaletteGrid(palette);
    #     Only the one inside onPaletteChanged (there's also one at init
    #     and in btnExecute — we remove ALL occurrences as buildPaletteGrid
    #     depends on mint panel DOM).
    # ----------------------------------------------------------------
    if stripped == 'buildPaletteGrid(palette);':
        i += 1
        continue

    # ----------------------------------------------------------------
    # 14. Remove buildPaletteGrid function definition
    #     Starts at: // Build palette grid
    #     followed by: function buildPaletteGrid(pal) {
    # ----------------------------------------------------------------
    if stripped == '// Build palette grid':
        # skip the comment and the function
        i += 1
        while i < total and 'function buildPaletteGrid' not in lines[i]:
            i += 1
        depth = 0
        while i < total:
            ln = lines[i]
            depth += ln.count('{') - ln.count('}')
            i += 1
            if depth <= 0:
                break
        continue

    # ----------------------------------------------------------------
    # 15. Remove mint panel refs in command bar / btnExecute
    #     - buildPaletteGrid(palette); already handled above
    #     - mintCommandString = cmd; in btnExecute
    #     - if (mintPanel.classList.contains('active')) updateMintCommand();
    #     - mintPanel variable declaration
    #     - btnMintToggle variable declaration
    # ----------------------------------------------------------------
    if stripped == 'mintCommandString = cmd;':
        i += 1
        continue

    if "mintPanel.classList.contains('active')" in raw and 'updateMintCommand' in raw:
        i += 1
        continue

    if stripped == "const mintPanel = document.getElementById('mint-panel');":
        i += 1
        continue

    if stripped == "const btnMintToggle = document.getElementById('btn-mint-toggle');":
        i += 1
        continue

    # ----------------------------------------------------------------
    # 16. Remove the mint-panel hide line in showUI toggle (? key)
    #     Line: document.getElementById('mint-panel').classList.remove('active');
    # ----------------------------------------------------------------
    if "mint-panel" in raw and "classList.remove" in raw:
        i += 1
        continue

    # ----------------------------------------------------------------
    # 17. Remove origExportHandler line (dead code after mint removal)
    # ----------------------------------------------------------------
    if 'origExportHandler' in raw:
        i += 1
        continue

    # ----------------------------------------------------------------
    # 18. IIFE wrap — inject (function() { after <script> opening tag
    #     and inject })(); just before main().catch
    # ----------------------------------------------------------------
    if stripped == '<script>':
        out.append(raw)
        out.append('(function() {\n')
        i += 1
        continue

    if stripped == 'main().catch(e => {':
        # main().catch goes INSIDE the IIFE so terser can't eliminate the IIFE body.
        # Consume main().catch block, then emit it before closing the IIFE.
        block = []
        depth = 0
        while i < total:
            ln = lines[i]
            block.append(ln)
            depth += ln.count('{') - ln.count('}')
            i += 1
            if depth <= 0:
                break
        for ln in block:
            out.append(ln)
        out.append('})();\n')
        continue

    # ----------------------------------------------------------------
    # Default: keep the line as-is
    # ----------------------------------------------------------------
    out.append(raw)
    i += 1

result = ''.join(out)

# ----------------------------------------------------------------
# V5: strip the chain command-set read.
#
# The viewer has no ethers CDN, so fetchCommandSet() can never run here.
# The try/catch means it fails safe, but shipping dead code that always
# throws is worse than not shipping it: the artifact should say plainly
# that it runs on the genesis set baked in at derive time.
#
# The on-chain artifact is immutable, so it pins the command set it was
# built against. Reading a set from chain is a builder capability.
# ----------------------------------------------------------------

# 1. The startup hook -> a comment.
_hook = re.search(
    r'\n  // Fetch the command set from chain.*?\n  \}\)\(\);\n',
    result, re.S)
if _hook:
    result = result.replace(_hook.group(0),
        '\n  // Command set: genesis, baked in at derive time. The builder\n'
        '  // reads this from chain; the artifact pins it.\n')
    _hook_stripped = True
else:
    _hook_stripped = False

# 2. fetchCommandSet() + its ethers.Contract call -> removed entirely.
_fetch = re.search(
    r'\n/// Read a command set frame from chain.*?\n\}\n',
    result, re.S)
if _fetch:
    result = result.replace(_fetch.group(0), '\n')
    _fetch_stripped = True
else:
    _fetch_stripped = False

DST.write_text(result, encoding='utf-8')

out_lines = result.count('\n')
print(f'Written: {DST}')
print(f'Lines: {out_lines}')

# ---- sanity checks ----
checks = [
    ('IIFE open',          '(function() {' in result),
    ('IIFE close',         '})();' in result),
    ('no ethers CDN',      'cdnjs.cloudflare.com' not in result),
    ('chain hook stripped',   _hook_stripped),
    ('fetchCommandSet gone',  _fetch_stripped),
    ('no ethers refs',        'ethers.' not in result),
    ('genesis set intact',    'GENESIS_COMMAND_SET' in result),
    ('PRIMITIVES intact',     'const PRIMITIVES' in result),
    ('no Mint panel CSS',  '/* Mint panel */' not in result),
    ('no Mint panel HTML', 'id="mint-panel"' not in result),
    ('no Mint button',     'btn-mint-toggle' not in result),
    ('simple resize',      'captureW' not in result),
    ('no doRenderPass fn', 'function doRenderPass' not in result),
    ('simple rp inline',   'rp.drawIndexedIndirect(indirectBuf, 0)' in result),
    ('no o/O handlers',    "e.key === 'o'" not in result),
    ('no MINT LOGIC',      '// MINT PANEL LOGIC' not in result),
    ('autoExecuteCommand', 'autoExecuteCommand' in result),
    ('showUI',             'let showUI = true' in result),
    ('case P paletteEdit', "this.paletteEditContext.enter();" in result),
    ('no mintCommandString decl', "let mintCommandString = '';" not in result),
    ('no buildPaletteGrid fn', 'function buildPaletteGrid' not in result),
]

all_pass = True
for name, ok in checks:
    status = '✓' if ok else '✗'
    if not ok:
        all_pass = False
    print(f'  {status} {name}')

if all_pass:
    print(f'\nAll checks passed. {DST.name} ready for minify.')
else:
    print(f'\nNOT written cleanly — fix issues above.')
    sys.exit(1)
