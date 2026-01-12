# Context System Architecture

## Overview

The Frameworks context system is a **universal navigation framework** that allows users to enter different operational contexts (command history, color palettes, camera positions, etc.) using a consistent interface. All context navigation is recorded in the command history, making the entire system replayable and self-documenting.

## Core Principles

### 1. Char-First Design
Every action, including context navigation, appends characters to the command history. This means:
- `ujjjj` = enter command context, move back 4 steps
- `plll` = enter color context, move right 3 colors
- `1fp5fppujjjRplll` = full command sequence that can be replayed

### 2. Consistent Navigation
The `ijkl` keys maintain spatial meaning across all contexts:
- `i` = up/previous
- `k` = down/next
- `j` = left/back
- `l` = right/forward

### 3. Context Entry Keys
Each context has a designated entry key:
- `u` = Command/Undo context
- `p` = Color Palette context
- `c` = Camera context (proposed)
- `w` = Content/Writing context (proposed)

### 4. Mode Indication
The UI displays the current context mode clearly:
- Normal mode: shows "normal"
- Command context: shows "COMMAND CONTEXT"
- Future contexts will show their mode name

## Implemented Context: Command History

### Entry
- Press `u` to enter command context mode
- Mode resets to normal, enabling `ijkl` navigation

### Navigation
- `j` = Move back in history (undo direction)
- `l` = Move forward in history (redo direction)
- `i` = Move up to older branches
- `k` = Move down to newer branches

### Exit
Two ways to exit:
1. **Implicit**: Press any non-navigation key → fork if different from history
2. **Explicit**: Press `u` again → fork at current position

### Data Structure
```javascript
commandTree.branches = [
  ['f', 't', 'i', 'i', 'i', 'r', 'd'],  // Row 0 (original)
  ['f', 't', 'i', 'i', 'i', 'R'],       // Row 1 (fork from position 5)
]
commandTree.currentRow = 1
commandTree.currentCol = 5
```

### Visual Representation
Command history panel shows:
- All branches with character-by-character highlighting
- Current position marked with cyan background
- Future commands dimmed
- Branch indicator "← HERE"

## Proposed Context: Color Palette

### Entry
- Press `p` to enter color palette context
- Current frame color selection highlights in palette

### Navigation Structure
2D array of hex colors:
```javascript
colorPalette = [
  ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8'],  // Row 0
  ['#F7DC6F', '#BB8FCE', '#85C1E2', '#F8B739', '#52B788'],  // Row 1
  ['#E76F51', '#2A9D8F', '#E9C46A', '#F4A261', '#E63946'],  // Row 2
]
```

### Navigation
- `j` = Previous color (left)
- `l` = Next color (right)
- `i` = Previous row (up)
- `k` = Next row (down)

### Exit
- Press any non-navigation key → apply color and exit
- Or press `p` again → apply current color and exit

### Recording
- `plll` adds "plll" to command history
- On replay: enters color context, moves right 3, exits with new color

## Proposed Context: Camera

### Entry
- Press `c` to enter camera context
- Current view highlights in camera grid

### Navigation Structure
Grid of camera presets:
```javascript
cameraPresets = [
  ['spatial', 'front', 'right', 'back'],     // Row 0
  ['left', 'top', 'bottom', 'custom1'],      // Row 1
  ['custom2', 'custom3', 'custom4', 'orbit'] // Row 2
]
```

### Navigation
- `ijkl` navigates through camera positions
- Each position previews the camera view

### Exit
- Press any key → set camera and exit
- Or press `c` again → set camera at current position

## Proposed Context: Content/Writing

### Entry
- Press `w` to enter content editing context
- Opens text editor for frame.contents or frame.called

### Navigation
- `i/k` = Navigate between frames
- `j/l` = Switch between "called" (title) and "contents" (body)

### Exit
- Press `Escape` or `w` again → save and exit

## Implementation Pattern

All contexts follow this pattern:

```javascript
class Context {
    constructor() {
        this.name = 'context-name';
        this.data = []; // 1D or 2D array
        this.currentPos = { row: 0, col: 0 };
        this.active = false;
    }

    enter() {
        this.active = true;
        // Setup context-specific state
    }

    navigate(key) {
        // Handle ijkl navigation
        // Update currentPos
        // Return new state
    }

    exit(key) {
        this.active = false;
        // Apply context-specific changes
        // Return to normal mode
    }

    getCurrentState() {
        // Return current selection/value
    }
}
```

## Context Manager

A central manager coordinates contexts:

```javascript
class ContextManager {
    constructor() {
        this.contexts = {
            command: new CommandContext(),
            color: new ColorContext(),
            camera: new CameraContext(),
        };
        this.activeContext = null;
    }

    enterContext(name) {
        if (this.activeContext) {
            this.activeContext.exit();
        }
        this.activeContext = this.contexts[name];
        this.activeContext.enter();
    }

    handleKey(key) {
        if (this.activeContext) {
            return this.activeContext.navigate(key);
        }
        return null; // Normal mode
    }
}
```

## Benefits

### 1. Replayability
Entire workflows can be replayed from command strings:
```
1fp5fpp2fppp      # Create frames in views
tiiiiiillllll     # Translate frames
5tiiiiii          # Switch view and translate
RRRRRRRR          # Rotate 8 times
ujjjj             # Undo 4 steps
R                 # Try different rotation
plll              # Change to 4th color
```

### 2. Discoverability
Users learn contexts by exploring with `ijkl`, seeing visual feedback

### 3. Consistency
Same navigation keys work across all contexts

### 4. Extensibility
New contexts can be added without changing core system

### 5. Blockchain Ready
Command strings can be stored on-chain as compact representations of entire frameworks

## Future Contexts

### Component Context
- Navigate through a frame's components (sticky notes)
- `ijkl` to move between components
- Edit content of selected component

### Context Definition Context
- Navigate through available contexts (meta!)
- Create custom contexts
- Map custom key bindings

### Export Context
- Navigate export options (SVG, PNG, JSON, blockchain)
- Preview exports
- Configure export parameters

### Animation Context
- Navigate timeline
- Set keyframes
- Control playback

## Technical Notes

### State Reconstruction
When replaying command strings with context navigation:
1. Parse command string character by character
2. When entering context (e.g., 'p'), activate that context
3. Following `ijkl` keys navigate within context
4. Non-navigation key exits context and applies change
5. Continue parsing remaining commands

### Context Stacking
Currently contexts don't stack (entering one exits others), but future versions could support:
- Nested contexts (e.g., camera context within color context)
- Context history/breadcrumbs
- Quick-switch between recent contexts

### Visual Feedback
Each context should provide:
- Mode indicator in UI (already implemented for command context)
- Visual representation of navigable space
- Current position highlighting
- Preview of selection effect

## Implementation Priority

1. ✅ **Command Context** - Implemented (undo/fork system)
2. **Color Context** - Next priority (extends palette system)
3. **Camera Context** - After color (simple preset grid)
4. **Content Context** - After camera (text editing)
5. **Component Context** - After content (nested frames)

## Related Documentation

- `COORDINATE_SYSTEMS.md` - View system and spatial navigation
- `CHANGELOG.md` - Version history and features
- `README.md` - Usage and commands
- `CLAUDE.md` - Project philosophy and vision
