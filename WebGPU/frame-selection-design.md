# Frame Selection System — Design Document

## Architecture

Selection operates on **array indices** (the dense 0 to count-1 array of
live frames), not frame IDs. IDs are only used in bracket input for
explicit targeting by permanent identity.

## Key Map

```
lowercase = selection window         uppercase = reorder + contract
─────────────────────────            ─────────────────────────
     i  shift window ↑                   I  move frames ↑ in array
     │                                   │
j ───┼─── l                         J ───┼─── L
│         │                         │         │
extend    extend                    contract  contract
bottom    top                       bottom    top
     │                                   │
     k  shift window ↓                   K  move frames ↓ in array
```

### ijkl — Selection Window

| Key | Action | Detail |
|-----|--------|--------|
| `l` | Extend top | Select one more frame at the high end of the range |
| `j` | Extend bottom | Select one more frame at the low end of the range |
| `i` | Shift up | Deselect lowest, select one past highest. Window slides +1 |
| `k` | Shift down | Deselect highest, select one before lowest. Window slides -1 |

### IJKL — Reorder + Contract

| Key | Action | Detail |
|-----|--------|--------|
| `I` | Move frames ↑ | Slide selected frames +1 in array. The frame above drops below. Spatial positions unchanged |
| `K` | Move frames ↓ | Slide selected frames -1 in array. The frame below moves above. Spatial positions unchanged |
| `L` | Contract top | Deselect the highest selected frame |
| `J` | Contract bottom | Deselect the lowest selected frame |

### Reorder Example

```
Array:    [A, B*, C*, D*, E, F]    (* = selected)
Indices:   0   1    2    3   4  5

After I (move up):
Array:    [A, E, B*, C*, D*, F]
Indices:   0  1   2    3    4  5
              ↑
              E dropped into the gap
              Selection now at [2,3,4]

After K from original (move down):
Array:    [B*, C*, D*, A, E, F]
Indices:   0    1    2  3  4  5
                       ↑
                       A pushed up
                       Selection now at [0,1,2]
```

Selected items keep their relative order and spatial positions.
Only their position in the array sequence changes.

### Single-Key Actions

| Key | Action | Detail |
|-----|--------|--------|
| `#` | Exit | Leave selection context |
| `a` | Select by color | Select all frames sharing the color of any selected frame |
| `A` | Select all | Select every frame |
| `x` | Invert | Toggle every frame's selection state |
| `[` | Bracket input | Open text field for explicit ID entry |

### Bracket Input

`#[` opens a text input. Deselects everything, then selects the targets.

| Input | Effect |
|-------|--------|
| `5` | Select frame ID 5 |
| `3:12` | Select frame IDs 3 through 12 |
| `3,7,12` | Select frames with IDs 3, 7, and 12 |

Bracket input uses **frame IDs** (permanent identity), not array indices.

## Edge Behavior

No wrapping. Hitting the boundary is a no-op.

| Operation | At boundary | Behavior |
|-----------|-------------|----------|
| Extend top (`l`) | Top at last frame | No-op |
| Extend bottom (`j`) | Bottom at frame 0 | No-op |
| Shift up (`i`) | Top at last frame | No-op |
| Shift down (`k`) | Bottom at frame 0 | No-op |
| Move up (`I`) | Top at last frame | No-op |
| Move down (`K`) | Bottom at frame 0 | No-op |
| Contract (`J`/`L`) | 1 frame selected | Deselects it → empty selection |
| Extend from empty | No selection | `l` selects frame 0, `j` selects last |

## FrameStore Additions

Three new methods on FrameStore plus a query helper:

| Method | Purpose |
|--------|---------|
| `getSelectionBoundsIdx()` | Returns `{ lo, hi, count }` as array indices |
| `moveSelectedUp()` | Shift selected block +1, displaced frame drops to gap |
| `moveSelectedDown()` | Shift selected block -1, displaced frame fills gap |
| `invertSelection()` | XOR the selected flag on every frame |

## Command String Replay

All actions produce a character in the command sequence.
`#` brackets selection operations:

```
#l         enter, extend top
#jjll#     enter, extend bottom 2×, extend top 2×, exit
#IIl#      enter, move frames up 2×, extend top, exit
```
