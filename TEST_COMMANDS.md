# Command Interface Test Guide

## How to Test

1. Open `frameworks-v3/index.html` in a browser
2. Follow the test steps below

## Test Workflow

### Test 1: Basic Command Logging
1. Press `f` to create a frame
2. Press `t` to enter translate mode
3. Press `i` three times to move up
4. Press `j` three times to move left
5. Check the command history panel:
   - **Raw**: Should show `ftiiijjj`
   - **Condensed**: Should show `ft(i,3)(j,3)`

### Test 2: Condensation Edge Cases
1. Clear the framework (click "Clear Framework" button)
2. Type: `f d d d R R R R R t i i l l l l`
3. Check condensed output:
   - Expected: `f(d,3)(R,5)t(i,2)(l,4)`

### Test 3: Copy/Paste Workflow
1. Build a structure:
   - `f` (create frame)
   - `t i i i i` (translate up 4 times)
   - `d` (duplicate)
   - `t l l l l` (translate right 4 times)
   - `r` (rotate 90°)
2. Click "Copy Condensed" button
3. Open a new browser tab with the same page
4. Paste the command string into the "Paste Commands" textarea
5. Click "Execute" button
6. Verify the same structure appears

### Test 4: Nested Repeat Notation
1. Clear framework
2. In paste textarea, enter: `f(t(i,5),3)`
   - This means: frame, then repeat "translate up 5 times" 3 times total
3. Click "Execute"
4. Should create a frame and move it up 15 grid units total

### Test 5: Console Commands
1. Open browser console (F12)
2. Run: `exportCondensedCommands()`
   - Should print condensed command string
3. Run: `autoExecuteCommand('fd(ti,5)r')`
   - Should create frame, duplicate, translate up-right 5 times, rotate

## Expected Results

✅ Commands are logged as they're typed
✅ Consecutive identical commands are condensed: `iii` → `(i,3)`
✅ Single commands stay as-is: `f` → `f`
✅ Copy button copies to clipboard
✅ Paste + Execute rebuilds exact same structure
✅ Condensed notation can be manually edited
✅ Clear button resets everything

## Implementation Details

### Condensation Algorithm
- Scans command string left-to-right
- Groups consecutive identical characters
- If count = 1: output character as-is
- If count ≥ 2: output `(char,count)`

### Expansion Algorithm (already existed)
- Recursively parses `(command,count)` notation
- Supports nesting: `(d(R,2),3)` = `dRRdRRdRR`
- Expands from inside-out

### UI Components Added
1. **Command History Panel** (bottom-left)
   - Raw command string
   - Condensed command string
   - Copy button (with visual feedback)

2. **Command Input Panel** (bottom-right)
   - Textarea for pasting commands
   - Execute button
   - Clear Framework button

## Files Modified

1. **frameworks-v3/src/commands.js**
   - Added `condenseCommandString()` method (lines 1243-1270)
   - Added `getCondensedCommands()` method (lines 1272-1279)

2. **frameworks-v3/index.html**
   - Updated command history UI (lines 136-157)
   - Added copy/paste event handlers (lines 231-268)
   - Updated UI update loop to show both raw and condensed (lines 203-211)

3. **frameworks-v3/src/core.js**
   - Fixed `clear()` to also reset command history (lines 397-398)
