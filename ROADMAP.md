# Frameworks V3 - Development Roadmap

## Current State (v3.1.0-dev)

The system has:
- ✅ Core 6D coordinate system with orthogonal frame rendering
- ✅ GPU-accelerated instanced rendering (100k+ frames at 60 FPS)
- ✅ Command tree with 2D undo/fork navigation
- ✅ Text-editor-style command interface with automatic compaction
- ✅ IJKL accumulator with cancellation
- ✅ Repeating pattern detection
- ✅ Context system architecture (camera, color, selection partially implemented)

**Known Issues:**
- Command interface chunking logic has edge cases (documented in COMMAND_INTERFACE.md)
- Pattern detection sometimes creates wrong line breaks
- IJKL accumulator interaction with patterns needs refinement

---

## Next Steps (Prioritized)

### Option 1: Fix Command Interface Bugs 🔧

**Priority: High**
**Effort: Medium**
**Impact: High - Core editing experience**

#### What
Debug and resolve the chunking/pattern detection issues documented in COMMAND_INTERFACE.md

#### Why
The interface works but has annoying edge cases:
- Commands appearing on wrong lines
- Patterns not compacting reliably
- Suffix splitting inconsistent

#### Specific Fixes Needed

**1. Pattern Continuation Logic**
- **Issue:** After compacting to `(dR,3)`, decision to start new line vs append is unreliable
- **Current behavior:** Checks if next key matches first character of pattern
- **Needed:** Better heuristic for pattern continuation vs break
- **File:** `index-instanced.html` lines ~950-970

**2. Suffix Splitting**
- **Issue:** When pattern breaks (e.g., `dRdRf`), should become `(dR,2)` + newline + `f`
- **Current behavior:** Attempts split but not always clean
- **Needed:** Reliable detection of pattern-breaking suffixes
- **File:** `index-instanced.html` lines ~885-920

**3. IJKL + Pattern Interaction**
- **Issue:** When patterns contain ijkl keys, unclear interaction with accumulator
- **Example:** Should `(til,5)` compact ijkl within the pattern?
- **Needed:** Clear rules for when IJKL accumulator flushes vs continues
- **File:** `index-instanced.html` lines ~890-930

**4. Edge Cases**
- Very short patterns (1 char) vs longer patterns
- Nested compound commands with patterns: `(dR,3)` repeated → `((dR,3),2)`?
- Complex suffixes with their own patterns: `dRdRRRRR` → `(dR,2)(R,4)`

#### Testing Strategy
- Create test sequences covering all edge cases
- Verify each pattern type compacts correctly
- Test pattern breaking at every character position
- Ensure rebuild accuracy (commands → structure → commands should match)

---

### Option 2: Implement Save/Load System 💾

**Priority: High**
**Effort: Low**
**Impact: High - Transforms from toy to tool**

#### What
Export/import command strings as files, making structures persistent and shareable

#### Why
- Command strings already work perfectly
- Just need file I/O wrapper
- Immediate practical value
- Enables version control workflow

#### Features to Implement

**1. Export Command String**
```javascript
// Button/keybinding to export
function exportCommands() {
    const commandString = commandChunks.join('\n');
    const blob = new Blob([commandString], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `frameworks-${Date.now()}.txt`;
    a.click();
}
```

**2. Import Command String**
```javascript
// File input to import
function importCommands(fileContent) {
    commandChunks = fileContent.split('\n').filter(line => line.trim());
    rebuildFromChunks();
}
```

**3. URL Hash Loading**
```javascript
// Load from URL: index.html#fppptiiii
window.addEventListener('load', () => {
    if (window.location.hash) {
        const cmdString = decodeURIComponent(window.location.hash.slice(1));
        commandExecutor.executeCommandString(cmdString);
    }
});
```

**4. LocalStorage Auto-Save**
```javascript
// Save every N seconds or on command change
function autoSave() {
    localStorage.setItem('frameworks-autosave', JSON.stringify({
        commands: commandChunks,
        timestamp: Date.now()
    }));
}

// Restore on load
function autoRestore() {
    const saved = localStorage.getItem('frameworks-autosave');
    if (saved) {
        const { commands, timestamp } = JSON.parse(saved);
        // Prompt user to restore
    }
}
```

#### UI Design
- Add "Export" button to command editor panel
- Add "Import" button with file picker
- Add "Share URL" button that copies URL with hash
- Show auto-save indicator (last saved timestamp)
- Keyboard shortcuts: Cmd+S to save, Cmd+O to open

#### File Format Options
- **Plain text (.txt)**: Simple, human-readable command string
- **JSON (.frameworks)**: Include metadata (name, description, timestamp)
- **URL encoding**: Share via link

---

### Option 3: Three.js Performance Review 🚀

**Priority: Medium**
**Effort: Low-Medium**
**Impact: Variable - Optimization potential**

#### What
Review renderer against Three.js best practices skill, optimize for larger scenes

#### Why
- Ensure following best practices
- Prepare for 100k+ frame scenes
- Identify memory leaks or inefficiencies
- Learn modern Three.js patterns

#### Areas to Check

**1. Memory Management**
- **Geometry disposal:** Are old geometries properly disposed?
- **Material disposal:** Same for materials when palette changes?
- **Texture cleanup:** Any texture leaks?
- **Buffer management:** Instance buffers reallocated efficiently?

**2. Shader Optimization**
- **Uniform vs attribute:** Are we using the most efficient data passing?
- **Vertex shader complexity:** Any redundant calculations?
- **Fragment shader:** Simple enough for high perf?
- **Precision:** Using correct precision qualifiers?

**3. Render Loop Efficiency**
- **Update checks:** Only update when needed?
- **Render on demand:** Can we skip frames when nothing changes?
- **Buffer updates:** Only update dirty buffers?
- **Matrix calculations:** Cached where possible?

**4. Best Practices Checklist**
- [ ] Geometry reuse (instancing - already doing this ✅)
- [ ] Material reuse across instances
- [ ] Proper disposal patterns
- [ ] Efficient attribute updates
- [ ] Minimal state changes per frame
- [ ] Frustum culling (if applicable)
- [ ] Level of detail (future consideration)

#### Review Process
1. Read through `/Users/lukeweaver/Downloads/Frameworks 2026/.claude/skills/three-best-practices`
2. Compare current implementation against best practices
3. Identify gaps or improvements
4. Implement quick wins first
5. Document any architectural changes needed

---

### Option 4: Complete Context System Features 🎨

**Priority: Medium**
**Effort: Medium-High**
**Impact: Medium - Enhanced capabilities**

#### What
Complete the context system with full UI and navigation for all contexts

#### Why
- Architecture already designed (see CONTEXT_SYSTEM.md)
- Some contexts partially implemented
- Unlocks powerful editing workflows
- Matches original vision

#### Contexts to Complete

**1. Color Palette Context (p key)**

**Current State:**
- Basic color cycling works
- context-color.js exists with navigation logic
- Palette grid renders in lower right

**Needed:**
- Full ijkl navigation in palette grid
- Visual cursor showing current color
- Shift selection to apply color to multiple frames
- Palette editing (add/remove/reorder colors)

**Implementation:**
```javascript
// Already exists in context-color.js:
- navigate(key) with ijkl in 8×10 grid
- getCurrentColor()
- apply() with shift calculation

// Need to add:
- Visual feedback in palette grid (cursor highlight)
- Polish apply() to work smoothly
- Add palette editing mode (P key?)
```

**2. Camera Context (v key)**

**Current State:**
- CameraContext class exists
- Number keys (0-9) snap to presets
- ijkl controls zoom/FOV
- Orthographic toggle (8 key)

**Needed:**
- Better visual feedback when in camera context
- Save custom camera presets
- Smooth camera transitions
- Auto-orbit refinement

**Implementation:**
```javascript
// Already in context-camera.js:
- selectView(viewNum) for 0-9 presets
- navigate(key) for ijkl zoom/FOV
- Auto-orbit mode

// Need to add:
- Preset saving (Shift+number to save?)
- Transition animations
- UI indicator for active context
```

**3. Selection Context (# key)**

**Current State:**
- FrameSelectionContext class exists
- Bracket notation [1,5,9] works
- ijkl expand/contract selection
- Wraparound navigation

**Needed:**
- Visual preview during bracket input
- Named selection sets
- Selection history/stack
- Boolean operations (union, intersect, subtract)

**Implementation:**
```javascript
// Already in context-selection.js:
- Bracket parsing and application
- Navigation with wraparound

// Need to add:
- Visual selection preview overlay
- Named sets: @name to save, #@name to load
- Stack operations for complex selections
```

**4. Writing Context (w key) - NEW**

**Not Yet Implemented**

**Purpose:**
- Edit frame.called (name/title)
- Edit frame.contents (body text)
- Navigate between text fields with ijkl

**Design:**
```javascript
class WritingContext {
    constructor(framework) {
        this.framework = framework;
        this.active = false;
        this.editingField = 'called'; // or 'contents'
    }

    enter() {
        // Show text editor overlay
        // Focus on selected frame's text
    }

    navigate(key) {
        // i/k to switch between called/contents
        // j/l to navigate between selected frames
    }

    exit() {
        // Save changes
        // Close overlay
    }
}
```

**UI:**
- Modal overlay with text inputs
- Markdown preview for contents
- Syntax highlighting for contexts

---

### Option 5: Enhanced Testing & Validation ✅

**Priority: Medium**
**Effort: Medium**
**Impact: Medium - Quality assurance**

#### What
Build comprehensive test suite and edge case coverage

#### Why
- Catch bugs before users hit them
- Document expected behavior
- Enable confident refactoring
- Verify command compaction correctness

#### Test Areas

**1. Command Compaction Tests**

```javascript
// Test IJKL accumulator
assert('tilililil' compacts to 't(i,4)(l,4)');
assert('tiikkjjll' compacts to 't');
assert('vJJJJJ' compacts to 'v(J,5)');

// Test pattern detection
assert('dRdRdR' compacts to '(dR,3)');
assert('fdRdRdR' compacts to 'f(dR,3)');
assert('dRdRf' becomes ['(dR,2)', 'f']);

// Test 'n' repeat
assert('(R,3)' + 'n' → '(R,4)');
assert('fdR' + 'n' → '(fdR,2)');
```

**2. Coordinate System Tests**

```javascript
// Test orthogonality preservation
const f1 = createFrame(0, 0, 0, 1, 0, 0); // +X normal
const f2 = createFrame(0, 0, 0, 0, 1, 0); // +Y normal
rotateFrames([f1, f2], Math.PI/4, 'z');
assert(dotProduct(f1.normal, f2.normal) < 0.0001); // Still orthogonal
```

**3. Rebuild Accuracy Tests**

```javascript
// Test command → structure → command round-trip
const originalCommands = ['f', 't(i,5)', 'd', 'R', 'R'];
executeCommands(originalCommands);
const rebuiltCommands = extractCommands();
assert(rebuiltCommands equals originalCommands);
```

**4. Context Navigation Tests**

```javascript
// Test color context
enterContext('color');
navigate('i'); // Up in palette
assert(currentColorIndex === previousIndex - 8);

// Test camera context
enterContext('camera');
navigate('i'); // Zoom in
assert(cameraZoom === previousZoom - zoomStep);
```

**5. Edge Case Tests**

```javascript
// Test empty states
assert(deleteAllFrames() → commandChunks.length === 0);

// Test maximum counts
assert(createFrames(100000) → renders without crash);

// Test invalid input
assert(parseCommands('invalid!!!') → graceful error);
```

#### Testing Framework
- **Unit tests:** Pure functions (pattern detection, parsing, etc.)
- **Integration tests:** Command execution → state changes
- **Visual tests:** Rendering correctness (screenshot comparison?)
- **Performance tests:** Frame rate with large scenes

#### Test Runner
```bash
# Option 1: Browser-based
open test/index.html

# Option 2: Node.js
node test/run-tests.js

# Option 3: Automated CI
npm test
```

---

## Long-Term Vision

### Phase 1: Foundation (Current - v3.1.0-dev)
- ✅ Core coordinate system
- ✅ Command interface
- ⏳ Bug fixes and polish
- ⏳ Save/load functionality

### Phase 2: Productivity (v3.2.0)
- Complete context system
- Named selections and presets
- Macro/template system
- Keyboard shortcut customization

### Phase 3: Content (v3.3.0)
- Writing context with markdown
- Component frames (nested content)
- Rich text editing
- Media embedding

### Phase 4: Sharing (v3.4.0)
- Export to SVG/PNG with quality controls
- Animation system with timeline
- Collaborative editing (multi-cursor?)
- Gallery/showcase integration

### Phase 5: Platform (v4.0.0)
- Blockchain integration for command storage
- NFT minting of frameworks
- On-chain verification
- Decentralized hosting

---

## Decision Framework

When choosing what to work on next, consider:

1. **User Impact:** Does this solve a pain point or unlock new workflows?
2. **Technical Debt:** Does this fix bugs or improve code quality?
3. **Vision Alignment:** Does this move toward the long-term goals?
4. **Effort/Reward:** What's the return on time invested?
5. **Dependencies:** Does this unblock other work?

**Current Recommendation:**
1. **Save/Load** (Option 2) - Quick win, high impact
2. **Bug Fixes** (Option 1) - Essential quality work
3. **Three.js Review** (Option 3) - If performance matters
4. **Contexts** (Option 4) - If expanding capabilities
5. **Testing** (Option 5) - Continuous background work

---

## Contributing

If you're picking up this project:

1. Read COMMAND_INTERFACE.md to understand the compaction system
2. Read CONTEXT_SYSTEM.md to understand navigation architecture
3. Review current issues in this document
4. Pick a task that matches your interest/expertise
5. Test thoroughly with edge cases
6. Document any new patterns or decisions

**Questions?** Check CLAUDE.md for design philosophy and vision.

**Found a bug?** Document it with:
- Input sequence (commands typed)
- Expected behavior
- Actual behavior
- Screenshot if visual

---

## Version Planning

**v3.1.1** (Bug fix release)
- Fix command interface chunking issues
- Improve pattern detection reliability
- Resolve IJKL + pattern interaction

**v3.2.0** (Save/Load)
- File export/import
- URL hash loading
- LocalStorage auto-save
- Share functionality

**v3.3.0** (Context completion)
- Polish color palette context
- Complete camera preset system
- Implement writing context
- Enhanced selection context

**v3.4.0** (Testing & Quality)
- Comprehensive test suite
- Performance benchmarks
- Three.js optimization
- Documentation polish

---

## Resources

- **Three.js Best Practices:** `/Users/lukeweaver/Downloads/Frameworks 2026/.claude/skills/three-best-practices`
- **Documentation:** All .md files in project root
- **Code:** `index-instanced.html` (main app) + `src/` modules
- **Design Philosophy:** CLAUDE.md

---

Last Updated: 2026-01-25
