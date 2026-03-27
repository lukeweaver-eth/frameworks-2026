// ============================================================
// FRAME SELECTION MODULE — Frameworks V4
//
// Integration:
//   1. Add the FrameStore methods to the FrameStore class
//   2. Replace the FrameSelectionContext class
//   3. Replace handleSelectionContextNavigation in CommandExecutor
// ============================================================


// ============================================================
// PART 1: ADD THESE METHODS TO FrameStore
// ============================================================

// --- Add to FrameStore class body ---

    /**
     * Get the index-based bounds of the current selection.
     * Returns { lo, hi, count } where lo/hi are array indices
     * of the lowest/highest selected frame, and count is total selected.
     * Returns { lo: -1, hi: -1, count: 0 } if nothing selected.
     */
    getSelectionBoundsIdx() {
        let lo = -1, hi = -1, count = 0;
        for (let i = 0; i < this.count; i++) {
            if (this.u32[this._o(i) + U.FLAGS] & FLAG_SELECTED) {
                if (lo === -1) lo = i;
                hi = i;
                count++;
            }
        }
        return { lo, hi, count };
    }

    /**
     * Move the selected frames one position toward higher indices.
     * The frame just above the selection drops to just below it.
     * Selection flags follow the frames. Spatial positions unchanged.
     * No-op if the top of the selection is already at count-1.
     */
    moveSelectedUp() {
        const { lo, hi, count } = this.getSelectionBoundsIdx();
        if (count === 0 || hi >= this.count - 1) return;

        // Save the frame at hi+1
        const savedO = this._o(hi + 1);
        const savedData = new Uint32Array(FLOATS_PER_INSTANCE);
        for (let j = 0; j < FLOATS_PER_INSTANCE; j++) savedData[j] = this.u32[savedO + j];
        const savedMeta = this.metadata[hi + 1];

        // Shift frames [lo..hi] each up by 1
        for (let i = hi; i >= lo; i--) {
            const src = this._o(i), dst = this._o(i + 1);
            for (let j = 0; j < FLOATS_PER_INSTANCE; j++) this.u32[dst + j] = this.u32[src + j];
            this.metadata[i + 1] = this.metadata[i];
        }

        // Place saved frame at lo
        const loO = this._o(lo);
        for (let j = 0; j < FLOATS_PER_INSTANCE; j++) this.u32[loO + j] = savedData[j];
        this.metadata[lo] = savedMeta;

        this._markRangeDirty(lo, hi + 1 - lo + 1);
    }

    /**
     * Move the selected frames one position toward lower indices.
     * The frame just below the selection moves to just above it.
     * No-op if the bottom of the selection is already at 0.
     */
    moveSelectedDown() {
        const { lo, hi, count } = this.getSelectionBoundsIdx();
        if (count === 0 || lo <= 0) return;

        // Save the frame at lo-1
        const savedO = this._o(lo - 1);
        const savedData = new Uint32Array(FLOATS_PER_INSTANCE);
        for (let j = 0; j < FLOATS_PER_INSTANCE; j++) savedData[j] = this.u32[savedO + j];
        const savedMeta = this.metadata[lo - 1];

        // Shift frames [lo..hi] each down by 1
        for (let i = lo; i <= hi; i++) {
            const src = this._o(i), dst = this._o(i - 1);
            for (let j = 0; j < FLOATS_PER_INSTANCE; j++) this.u32[dst + j] = this.u32[src + j];
            this.metadata[i - 1] = this.metadata[i];
        }

        // Place saved frame at hi
        const hiO = this._o(hi);
        for (let j = 0; j < FLOATS_PER_INSTANCE; j++) this.u32[hiO + j] = savedData[j];
        this.metadata[hi] = savedMeta;

        this._markRangeDirty(lo - 1, hi - lo + 2);
    }

    /**
     * Invert the selection: toggle every frame's selected state.
     */
    invertSelection() {
        for (let i = 0; i < this.count; i++) {
            this.u32[this._o(i) + U.FLAGS] ^= FLAG_SELECTED;
            this._markDirty(i);
        }
    }


// ============================================================
// PART 2: REPLACE FrameSelectionContext CLASS
// ============================================================

class FrameSelectionContext {
    constructor(store) {
        this.store = store;
        this.active = false;
        this.bracketInputActive = false;
    }

    enter() {
        this.active = true;
    }

    exit() {
        this.active = false;
        this.closeBracketInput();
    }

    // ── ijkl: Selection window ──────────────────────────────

    /**
     * l — Extend top: select one more frame at the high end.
     * From empty: selects frame 0.
     */
    extendTop() {
        const { lo, hi, count } = this.store.getSelectionBoundsIdx();
        if (count === 0) {
            if (this.store.count > 0) this.store.setSelected(0, true);
            return;
        }
        if (hi < this.store.count - 1) this.store.setSelected(hi + 1, true);
    }

    /**
     * j — Extend bottom: select one more frame at the low end.
     * From empty: selects last frame.
     */
    extendBottom() {
        const { lo, hi, count } = this.store.getSelectionBoundsIdx();
        if (count === 0) {
            if (this.store.count > 0) this.store.setSelected(this.store.count - 1, true);
            return;
        }
        if (lo > 0) this.store.setSelected(lo - 1, true);
    }

    /**
     * i — Shift up: move selection window +1.
     * Deselects lowest, selects one past highest.
     */
    shiftUp() {
        const { lo, hi, count } = this.store.getSelectionBoundsIdx();
        if (count === 0 || hi >= this.store.count - 1) return;
        this.store.setSelected(lo, false);
        this.store.setSelected(hi + 1, true);
    }

    /**
     * k — Shift down: move selection window -1.
     * Deselects highest, selects one before lowest.
     */
    shiftDown() {
        const { lo, hi, count } = this.store.getSelectionBoundsIdx();
        if (count === 0 || lo <= 0) return;
        this.store.setSelected(hi, false);
        this.store.setSelected(lo - 1, true);
    }

    // ── IJKL: Reorder + Contract ────────────────────────────

    /**
     * I — Move selected frames up in array order.
     */
    moveUp() {
        this.store.moveSelectedUp();
    }

    /**
     * K — Move selected frames down in array order.
     */
    moveDown() {
        this.store.moveSelectedDown();
    }

    /**
     * L — Contract top: deselect the highest selected frame.
     */
    contractTop() {
        const { hi, count } = this.store.getSelectionBoundsIdx();
        if (count > 0) this.store.setSelected(hi, false);
    }

    /**
     * J — Contract bottom: deselect the lowest selected frame.
     */
    contractBottom() {
        const { lo, count } = this.store.getSelectionBoundsIdx();
        if (count > 0) this.store.setSelected(lo, false);
    }

    // ── Single-key actions ──────────────────────────────────

    /**
     * a — Select all frames with the same color as any selected frame.
     */
    selectByColor() {
        this.store.selectAllOfColor();
    }

    /**
     * A — Select all frames.
     */
    selectAll() {
        this.store.selectAll();
    }

    /**
     * x — Invert selection.
     */
    invertSelection() {
        this.store.invertSelection();
    }

    // ── Bracket input ───────────────────────────────────────

    openBracketInput() {
        this.bracketInputActive = true;
        const overlay = document.getElementById('bracket-overlay');
        const input = document.getElementById('bracket-input');
        overlay.classList.add('active');
        input.value = '';
        input.focus();
    }

    closeBracketInput() {
        this.bracketInputActive = false;
        document.getElementById('bracket-overlay').classList.remove('active');
    }

    /**
     * Parse bracket input and apply selection.
     *
     * Syntax:
     *   5        → deselect all, select frame ID 5
     *   3:12     → deselect all, select IDs 3 through 12
     *   3,7,12   → deselect all, select IDs 3, 7, 12
     */
    submitBracketInput(text) {
        this.closeBracketInput();
        if (!text || text.trim().length === 0) return;

        text = text.trim();
        this.store.deselectAll();

        const targetIds = new Set();
        const parts = text.split(',').map(p => p.trim()).filter(p => p.length > 0);

        for (const part of parts) {
            if (part.includes(':')) {
                const [startStr, endStr] = part.split(':');
                const start = parseInt(startStr.trim());
                const end = parseInt(endStr.trim());
                if (!isNaN(start) && !isNaN(end)) {
                    const lo = Math.min(start, end);
                    const hi = Math.max(start, end);
                    for (let id = lo; id <= hi; id++) targetIds.add(id);
                }
            } else {
                const id = parseInt(part);
                if (!isNaN(id)) targetIds.add(id);
            }
        }

        for (let i = 0; i < this.store.count; i++) {
            if (targetIds.has(this.store.getFrameId(i))) {
                this.store.setSelected(i, true);
            }
        }
    }
}


// ============================================================
// PART 3: REPLACE handleSelectionContextNavigation
//         IN CommandExecutor CLASS
// ============================================================

    handleSelectionContextNavigation(key, shift = false) {
        const ctx = this.selectionContext;

        // Bracket input active: consume all keys
        if (ctx.bracketInputActive) {
            if (key === 'Enter') {
                const input = document.getElementById('bracket-input');
                ctx.submitBracketInput(input.value);
            } else if (key === 'Escape') {
                ctx.closeBracketInput();
            }
            return;
        }

        // Bracket input trigger
        if (key === '[') {
            ctx.openBracketInput();
            return;
        }

        // Exit
        if (key === '#') {
            ctx.exit();
            this.commandTree.addCommand(key);
            return;
        }

        // ijkl / IJKL
        if (['i','j','k','l','I','J','K','L'].includes(key)) {
            switch (key) {
                case 'l': ctx.extendTop(); break;
                case 'j': ctx.extendBottom(); break;
                case 'i': ctx.shiftUp(); break;
                case 'k': ctx.shiftDown(); break;
                case 'I': ctx.moveUp(); break;
                case 'K': ctx.moveDown(); break;
                case 'L': ctx.contractTop(); break;
                case 'J': ctx.contractBottom(); break;
            }
            this.commandTree.addCommand(key);
            return;
        }

        // Single-key actions
        switch (key) {
            case 'a':
                ctx.selectByColor();
                this.commandTree.addCommand(key);
                return;
            case 'A':
                ctx.selectAll();
                this.commandTree.addCommand(key);
                return;
            case 'x':
                ctx.invertSelection();
                this.commandTree.addCommand(key);
                return;
        }

        // Unrecognized key: exit context and execute normally
        ctx.exit();
        this.mode = 'normal';
        this.executeKeyNormal(key);
        this.commandTree.addCommand(key);
    }
