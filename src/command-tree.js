// command-tree.js
// 2D navigable command history system for undo/redo/fork/replay

/**
 * CommandTree manages a 2D array of command histories
 * - Horizontal (j/l): Navigate backward/forward in current branch
 * - Vertical (i/k): Navigate between different forked branches
 * - New commands at non-head positions create forks (new rows)
 */
class CommandTree {
    constructor() {
        // 2D array: each row is a branch, each element is a command character
        this.branches = [[]];  // Start with one empty branch

        // Current position in the tree
        this.currentRow = 0;      // Which branch we're on
        this.currentCol = -1;     // Position in that branch (-1 = before first command)

        // Mode tracking
        this.inCommandContext = false;
    }

    /**
     * Add a command to the current position
     * If we're not at the head of the current branch, this creates a fork
     */
    addCommand(char) {
        const currentBranch = this.branches[this.currentRow];
        const atHead = (this.currentCol === currentBranch.length - 1);

        if (atHead || currentBranch.length === 0) {
            // We're at the head of the current branch - just append
            currentBranch.push(char);
            this.currentCol++;
        } else {
            // We're in the middle of a branch - create a fork
            this.createFork(char);
        }
    }

    /**
     * Create a new fork from the current position
     * Copies all commands up to current position, then adds the new command
     * New branch goes BELOW, pushing current branch UP in the display
     */
    createFork(char) {
        const sourceBranch = this.branches[this.currentRow];

        // Copy commands from start up to and including current position
        const newBranch = sourceBranch.slice(0, this.currentCol + 1);

        // Add the new command
        newBranch.push(char);

        // Insert new branch BELOW current branch (higher index = lower in display)
        this.branches.splice(this.currentRow + 1, 0, newBranch);

        // Move to the new branch at the new command position
        this.currentRow++;
        this.currentCol = newBranch.length - 1;

        console.log(`Created fork at row ${this.currentRow}, column ${this.currentCol}`);
    }

    /**
     * Navigate backward in current branch (undo direction)
     * Returns false if already at the start
     */
    moveBack() {
        if (this.currentCol > -1) {
            this.currentCol--;
            console.log(`Moved back to position ${this.currentCol} in branch ${this.currentRow}`);
            return true;
        }
        console.log('Already at start of branch');
        return false;
    }

    /**
     * Navigate forward in current branch (redo direction)
     * Returns false if already at the end
     */
    moveForward() {
        const currentBranch = this.branches[this.currentRow];
        if (this.currentCol < currentBranch.length - 1) {
            this.currentCol++;
            console.log(`Moved forward to position ${this.currentCol} in branch ${this.currentRow}`);
            return true;
        }
        console.log('Already at end of branch');
        return false;
    }

    /**
     * Navigate to an older branch (up in the UI)
     * Returns false if already at the first branch
     */
    moveUp() {
        if (this.currentRow > 0) {
            this.currentRow--;
            // Clamp column to valid range in new branch
            const newBranch = this.branches[this.currentRow];
            this.currentCol = Math.min(this.currentCol, newBranch.length - 1);
            console.log(`Moved up to branch ${this.currentRow}, position ${this.currentCol}`);
            return true;
        }
        console.log('Already at first branch');
        return false;
    }

    /**
     * Navigate to a newer branch (down in the UI)
     * Returns false if already at the last branch
     */
    moveDown() {
        if (this.currentRow < this.branches.length - 1) {
            this.currentRow++;
            // Clamp column to valid range in new branch
            const newBranch = this.branches[this.currentRow];
            this.currentCol = Math.min(this.currentCol, newBranch.length - 1);
            console.log(`Moved down to branch ${this.currentRow}, position ${this.currentCol}`);
            return true;
        }
        console.log('Already at last branch');
        return false;
    }

    /**
     * Get the current command sequence (from start to current position)
     * This is what should be replayed to reconstruct the current state
     */
    getCurrentCommandSequence() {
        const currentBranch = this.branches[this.currentRow];
        return currentBranch.slice(0, this.currentCol + 1);
    }

    /**
     * Get the full current branch (for display purposes)
     */
    getCurrentBranch() {
        return this.branches[this.currentRow];
    }

    /**
     * Get all branches (for display purposes)
     */
    getAllBranches() {
        return this.branches;
    }

    /**
     * Get current position info
     */
    getPosition() {
        return {
            row: this.currentRow,
            col: this.currentCol,
            totalRows: this.branches.length,
            totalCols: this.branches[this.currentRow].length
        };
    }

    /**
     * Check if the next command in the current branch matches the given character
     * Used to detect if we should fork or continue
     */
    peekNextCommand() {
        const currentBranch = this.branches[this.currentRow];
        const nextCol = this.currentCol + 1;

        if (nextCol < currentBranch.length) {
            return currentBranch[nextCol];
        }
        return null;  // At the end of the branch
    }

    /**
     * Toggle command context mode
     */
    toggleCommandContext() {
        this.inCommandContext = !this.inCommandContext;
        console.log('Command context:', this.inCommandContext ? 'ACTIVE' : 'INACTIVE');
        return this.inCommandContext;
    }

    /**
     * Enter command context mode explicitly
     */
    enterCommandContext() {
        this.inCommandContext = true;
        console.log('Entered command context mode');
    }

    /**
     * Exit command context mode explicitly
     */
    exitCommandContext() {
        this.inCommandContext = false;
        console.log('Exited command context mode');
    }

    /**
     * Format the tree for display
     * Returns an array of strings showing each branch with position indicator
     */
    formatForDisplay() {
        return this.branches.map((branch, rowIdx) => {
            let display = `Row ${rowIdx}: `;

            branch.forEach((cmd, colIdx) => {
                if (rowIdx === this.currentRow && colIdx === this.currentCol) {
                    display += `[${cmd}] `;  // Current position
                } else {
                    display += `${cmd} `;
                }
            });

            // Show position marker if we're at this row
            if (rowIdx === this.currentRow) {
                display += ' ← YOU ARE HERE';
            }

            return display;
        });
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CommandTree };
}
