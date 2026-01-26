# Command Interface System

## Overview

The Frameworks V3 command interface provides a **text-editor-style command history** with automatic compaction, real-time editing, and intelligent pattern detection. Commands are displayed in a readable, editable format in a left sidebar textarea.

---

## Core Architecture

### Command Chunks Array (`commandChunks[]`)

- Stores command sequences as strings
- Each chunk typically represents one line in the textarea
- Can be: single keys, sequences, or compound notation

### Three-Layer Tracking System

1. **Wrapped execution functions** - Capture all commands as they execute
2. **Smart compaction logic** - Process commands in real-time using pattern detection and accumulation
3. **Textarea display** - Shows readable, editable result with intelligent line grouping

---

## Automatic Compaction Strategies

### 1. IJKL Accumulator (with Cancellation)

Tracks **net movements** across i/j/k/l keys with automatic cancellation.

**Cancellation Rules:**
- `i` and `k` cancel each other (vertical: up/down)
- `j` and `l` cancel each other (horizontal: left/right)
- Uppercase variants (I/K, J/L) use same rules

**Output Format:** `t(i,6)(l,3)` notation

**Examples:**
```
tilililil     → t(i,4)(l,4)
tiikkjj       → t (all movements cancel)
vJJJJJJJJJJ   → v(J,10)
tiiiii        → t(i,5)
```

**Context-Aware Behavior:**
- Normal context: Full cancellation applies
- Frame selection context: Different cancellation rules (TBD)

### 2. Repeating Pattern Detection

Automatically detects and compacts consecutive repeating sequences.

**Features:**
- Finds shortest repeating unit (e.g., `dR` not `dRdR`)
- Requires minimum 2 repetitions to compact
- Supports prefixes: `fdRdRdR` → `f(dR,3)`
- Incremental updates as you continue typing the pattern

**Examples:**
```
dRdRdR        → (dR,3)
fdRdRdR       → f(dR,3)
dRdRRRRR      → (dR,2)(R,4)
```

**Pattern Continuation:**
- Type `dR` → displays: `dR`
- Type `dR` again → displays: `(dR,2)`
- Type `dR` again → displays: `(dR,3)`
- Continue typing `dR` → keeps incrementing: `(dR,4)`, `(dR,5)`, etc.

**Suffix Handling:**
When a pattern breaks (e.g., typing `f` after `dRdRdR`):
- Attempts to split non-matching suffixes to new chunks
- Pattern stays compacted: `(dR,3)` on one line, `f` on next line

### 3. 'n' Key Repeat Conversion

The `n` key converts repeated executions into nested compound notation instead of duplicating commands.

**How It Works:**
1. Press `/` and enter `d(R2R1,23)` → displays: `d(R2R1,23)`
2. Press `n` once → displays: `(d(R2R1,23),2)`
3. Press `n` again → displays: `(d(R2R1,23),3)`
4. Press `n` 8 more times → displays: `(d(R2R1,23),11)`

**Benefits:**
- Compact representation of repeated operations
- Editable count - change `11` to `20` in the textarea
- Each `n` executes the base command once and increments counter

---

## Text Editor Interface

### Visual Layout

**Left Sidebar:**
- Text editor-style textarea
- Commands appear on separate lines
- Monospace font with syntax-style coloring
- Auto-scrolling as commands are added

**Top Input Box:**
- Paste full command strings
- Press Enter to rebuild entire structure
- Useful for sharing/loading command sequences

### Line Grouping Logic

**Commands grouped intelligently:**
- Compound commands: `(dR,5)` on own line
- IJKL sequences: `t(i,6)(l,3)` stay together on one line
- Pattern breaks create new lines
- Non-ijkl commands typically start new lines

**Examples of Display:**
```
f
t(i,6)(l,3)
(dR,5)
x
v(J,10)
```

### Editing Workflow

1. **Click into textarea** - Focus on command list
2. **Edit any command line** - Modify text directly
3. **Click out (blur)** - Triggers full rebuild from edited commands
4. **Structure updates** - Real-time visual feedback in 3D view

**Editing Features:**
- Full text editing capabilities (cut, paste, select all, etc.)
- Multi-line editing supported
- Undo/redo through browser (Cmd+Z/Cmd+Shift+Z)
- Commands execute in order from top to bottom on rebuild

---

## Execution Tracking System

### Coordination Flags

**`isRebuilding`**
- Prevents recursive tracking during rebuild operations
- Set when `rebuildFromChunks()` executes
- Ensures edited commands don't create duplicate tracking

**`isExecutingCompound`**
- Prevents tracking individual keys during compound execution
- Set when executing from `/` overlay or `n` repeat
- Ensures `d(R2R1,23)` stays as one chunk, not split into `d`, `(`, `R`, etc.

**`textareaEditInProgress`**
- Disables global keyboard shortcuts while editing textarea
- Set on textarea focus, cleared on blur
- Prevents typing "f" in textarea from creating a frame

**`ijklAccumulator`**
- Tracks net movements for current chunk
- Contains: `chunkIndex`, `prefix`, `iNet`, `jNet`, `INet`, `JNet`
- Flushed when non-ijkl key is pressed

### Wrapped Functions

```javascript
// Track compound commands (from / overlay)
commandExecutor.executeCommandString = function(cmdString) {
    isExecutingCompound = true;
    const result = originalExecuteCommandString(cmdString);
    isExecutingCompound = false;

    if (!isRebuilding) {
        commandChunks.push(cmdString);
        updateCommandListUI();
    }
    return result;
};

// Track individual keys with compaction logic
commandExecutor.executeKey = function(key, shift) {
    const result = originalExecuteKey(key, shift);

    if (!isRebuilding && !isExecutingCompound) {
        if (isIJKLKey(key)) {
            addIJKLToAccumulator(key);
        } else {
            // Flush accumulator, add key, detect patterns
            compactRepeatingPatterns();
        }
        updateCommandListUI();
    }
    return result;
};
```

---

## Implementation Details

### Key Functions

**`groupCommandsIntoLines()`**
- Converts `commandChunks[]` array into display lines
- Handles compound command formatting
- Groups related commands together

**`parseTextareaToChunks(text)`**
- Parses edited textarea back into command chunks
- Splits on newlines, trims whitespace
- Each line becomes a command string to execute

**`rebuildFromChunks()`**
- Clears framework state completely
- Resets palette and accumulator
- Executes each chunk in sequence
- Restores exact structure from command history

**`addIJKLToAccumulator(key)`**
- Updates net movement counters
- Applies cancellation rules
- Converts accumulator to compact notation
- Updates current chunk in place

**`detectRepeatingPattern(str)`**
- Scans string for repeating patterns
- Returns shortest repeating unit
- Requires minimum 2 repetitions
- Used by `compactRepeatingPatterns()`

**`compactRepeatingPatterns()`**
- Detects patterns in last chunk
- Handles pattern continuation
- Splits off non-matching suffixes
- Updates chunk with compact notation

### Pattern Detection Algorithm

```
Input: "dRdRdR"

1. Try pattern length 1: "R"
   - Check if "R" repeats: No (preceding is "d")

2. Try pattern length 2: "dR"
   - Check backwards: "dR", "dR", "dR"
   - Found 3 repetitions!
   - Return: { prefix: "", pattern: "dR", count: 3 }

Output: "(dR,3)"
```

### IJKL Accumulator Algorithm

```
Input: t, i, i, i, l, l, k, j

Chunk: "t"
+ i: t(i,1)
+ i: t(i,2)
+ i: t(i,3)
+ l: t(i,3)(l,1)
+ l: t(i,3)(l,2)
+ k: t(i,2)(l,2)  // k cancels one i
+ j: t(i,2)(l,1)  // j cancels one l

Output: "t(i,2)(l,1)"
```

---

## Current Known Issues

### 1. Chunking Logic Edge Cases
- Pattern detection sometimes unclear about when to start new chunk vs. append
- `(dR,3)` followed by `f` should split reliably, but edge cases exist
- Very short patterns (1 char) vs. longer patterns need better handling

### 2. Pattern Continuation After Compaction
- After compacting to `(dR,3)`, decision to continue pattern based on first character
- Partial matches: If pattern is `dR`, typing `d` continues, but what if pattern is `dRx`?
- Mixed patterns with multiple compactions need refinement

### 3. Suffix Splitting Reliability
- When pattern breaks (e.g., `dRdRf`), should become `(dR,2)` + newline + `f`
- Currently attempts split but not always clean
- Complex suffixes with their own patterns need better detection

### 4. IJKL + Pattern Interaction
- When patterns contain ijkl keys: `(til,5)` - should this compact ijkl within?
- IJKL accumulator flushes on non-ijkl, but patterns might interfere
- Context switching (frame selection vs. normal) mid-pattern

### 5. Nested Compound Commands
- Pattern detection on already-compacted commands
- Example: `(dR,3)` repeated should become `((dR,3),2)`?
- Current implementation doesn't handle deep nesting well

---

## Design Philosophy

### Goals

✅ **Readable** - Command strings are human-readable, compact, and clear
✅ **Editable** - Click into any command and modify directly
✅ **Efficient** - Real-time compaction reduces visual clutter
✅ **Accurate** - Rebuilds produce identical results to original execution

### Philosophy

Command history should feel like **code** - editable, version-able, and optimized for human understanding while maintaining execution precision.

**Key Principles:**
- Commands are the source of truth (like source code)
- Compaction preserves semantics (like code optimization)
- Editing is first-class (like a code editor)
- Real-time feedback (like a REPL)

### Future Vision

- **Export/Import** - Save command strings as files
- **Versioning** - Git-style diff/merge of command histories
- **Macros** - Define custom compound commands
- **Optimization** - Suggest more efficient command sequences
- **Undo/Redo** - Full command tree navigation (already partially implemented via `u` command context)

---

## Examples

### Building a Circular Structure

**Commands typed:**
```
f
tilililililil
d
R
d
R
d
R
d
R
```

**Display shows:**
```
f
t(i,6)(l,6)
(dR,4)
```

**What happened:**
1. `f` creates frame
2. IJKL accumulator compacts 6 i's and 6 l's
3. Pattern detector finds `dR` repeating 4 times

### Complex Pattern with Repeat

**Commands typed:**
```
/ (prompt opens)
d(R2R1,23)
(press Enter)
n
n
n
```

**Display shows:**
```
(d(R2R1,23),4)
```

**What happened:**
1. Compound command entered via `/` overlay
2. First `n` converts to `(d(R2R1,23),2)`
3. Each subsequent `n` increments count
4. Final count is original (1) + 3 repeats = 4

### Mixed Commands

**Commands typed:**
```
f
p
i
i
i
x
t
l
l
l
d
d
```

**Display shows:**
```
f
p(i,3)
x
t(l,3)
(d,2)
```

**What happened:**
1. `f` creates frame (new line)
2. `p` enters color context, `iii` compacts to `p(i,3)` (new line)
3. `x` deletes (new line)
4. `t` translate mode, `lll` compacts to `t(l,3)` (new line)
5. `dd` pattern detected as `(d,2)` (new line)

---

## Technical Reference

### File Location
- **Main implementation**: `/index-instanced.html` (lines ~500-1000)
- **Related modules**:
  - `src/commands.js` - Command executor
  - `src/command-tree.js` - 2D undo/fork tree
  - `src/context-*.js` - Context-specific behaviors

### Key Variables
```javascript
let commandChunks = [];              // Array of command strings
let isRebuilding = false;            // Prevent recursive tracking
let isExecutingCompound = false;     // Prevent key tracking during compounds
let textareaEditInProgress = false;  // Textarea focus state

let ijklAccumulator = {
    chunkIndex: -1,
    prefix: '',
    iNet: 0,    // Net i/k movements
    jNet: 0,    // Net j/l movements
    INet: 0,    // Net I/K movements (shift)
    JNet: 0     // Net J/L movements (shift)
};
```

### Integration Points

**Keyboard Handler:**
- Checks `textareaEditInProgress` before executing commands
- Allows normal typing when editing command list

**Command Tree:**
- Commands still tracked in 2D tree for undo/fork (`u` key)
- Tree and chunks are parallel systems
- Both reconstruct state, different use cases

**Context System:**
- IJKL accumulator aware of active context
- Frame selection uses different cancellation rules
- Color context (`p`), camera context (`v`), etc. tracked

---

## Version History

**v3.1.0-dev (Current)**
- Added command interface with textarea editor
- Implemented IJKL accumulator with cancellation
- Added repeating pattern detection
- Added 'n' key repeat conversion
- Known issues with chunking logic (see above)

**v3.0.0**
- Basic command tracking
- Command tree (2D undo/fork navigation)
- Compound command input overlay (`/` key)
