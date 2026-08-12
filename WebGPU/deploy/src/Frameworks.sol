// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title  Frameworks
/// @notice The minimal write surface.
///
///         A frame has contents, components, and contexts. Nothing else.
///         There are no primitives called "translate" or "rotate" — moving a
///         frame means writing a value into the frame that holds its x.
///         Writing is the only operation. mint / attach / bind exist to make
///         frames, nest them, and give them contexts to be read through.
///
///         Everything above this contract is frames: command sets, palettes,
///         cameras, compositions. This ABI is the one thing that cannot be a
///         frame, because it is what frames are made with.
contract Frameworks {

    // =========================================================================
    // State
    // =========================================================================

    /// @notice What a frame holds. A number, a hash, a character — the reader
    ///         decides. 0x0 means the frame is pure structure.
    mapping(uint256 => bytes32) public contents;

    /// @notice The frames inside a frame, in order. Position is identity here:
    ///         a context knows that component 3 of a coordinates frame is `i`.
    mapping(uint256 => uint256[]) private _components;

    /// @notice The frames a frame is read through, by slot. Slot numbering is
    ///         a convention held by readers, not by this contract — see
    ///         CTX_* below for the genesis convention.
    mapping(uint256 => mapping(uint256 => uint256)) public contexts;

    /// @notice Who may write to a frame. Set at mint, transferable.
    mapping(uint256 => address) public author;

    /// @notice Total frames minted. A frame's count is its id.
    uint256 public count;

    /// @notice A frame's char string, when it has one. Longer than bytes32,
    ///         so it lives beside contents rather than in it.
    mapping(uint256 => string) public chars;

    // =========================================================================
    // Context slots — the genesis convention
    // =========================================================================
    //
    // These are not enforced. Slot 2 holds a coordinates frame only because
    // every reader agrees it does. A different reader, reading the same frames
    // through a different convention, sees something else — which is the point.

    uint256 public constant CTX_CALLED      = 0;
    uint256 public constant CTX_COORDINATES = 1;
    uint256 public constant CTX_COLORS      = 2;
    uint256 public constant CTX_CAMERA      = 3;
    uint256 public constant CTX_COMMAND_SET = 4;
    uint256 public constant CTX_CHAR        = 5;

    // =========================================================================
    // Events — the construction record
    // =========================================================================

    event Minted(uint256 indexed id, address indexed author, uint256 indexed within);
    event Wrote(uint256 indexed id, bytes32 value);
    event Attached(uint256 indexed parent, uint256 indexed child, uint256 at);
    event Bound(uint256 indexed id, uint256 indexed slot, uint256 indexed context);
    event Authored(uint256 indexed id, address indexed to);

    error NotAuthor(uint256 id);
    error NoFrame(uint256 id);

    modifier onlyAuthor(uint256 id) {
        if (author[id] == address(0)) revert NoFrame(id);
        if (author[id] != msg.sender) revert NotAuthor(id);
        _;
    }

    // =========================================================================
    // The write surface
    // =========================================================================

    /// @notice Bring a frame into existence. `within` is the frame it lands
    ///         in, or 0 for a frame that sits in nothing yet.
    /// @dev    This is `f`. It is a call, not a frame — which is why genesis
    ///         needs no seed composition. You call this before any frame
    ///         exists, and afterwards one does.
    function mint(uint256 within) public returns (uint256 id) {
        id = ++count;
        author[id] = msg.sender;

        if (within != 0) {
            if (author[within] == address(0)) revert NoFrame(within);
            if (author[within] != msg.sender) revert NotAuthor(within);
            _components[within].push(id);
            emit Attached(within, id, _components[within].length - 1);
        }

        emit Minted(id, msg.sender, within);
    }

    /// @notice Write a frame's contents.
    /// @dev    This is the only operation. Translating a frame is writing to
    ///         the frame that holds its x. Coloring it is writing to the frame
    ///         that holds its palette index. There is no translate.
    function write(uint256 id, bytes32 value) public onlyAuthor(id) {
        contents[id] = value;
        emit Wrote(id, value);
    }

    /// @notice Put an existing frame inside another.
    /// @dev    Separate from mint because a frame can be composed into a
    ///         container it wasn't born in — this is what copy resolves to.
    function attach(uint256 parent, uint256 child)
        public onlyAuthor(parent) returns (uint256 at)
    {
        if (author[child] == address(0)) revert NoFrame(child);
        at = _components[parent].length;
        _components[parent].push(child);
        emit Attached(parent, child, at);
    }

    /// @notice Give a frame a context to be read through.
    /// @dev    A context is just another frame. Binding one is what turns a
    ///         bare frame into something with a name, a position, a palette.
    ///         A frame with no contexts is complete and entirely mute.
    function bind(uint256 id, uint256 slot, uint256 ctx)
        public onlyAuthor(id)
    {
        if (ctx != 0 && author[ctx] == address(0)) revert NoFrame(ctx);
        contexts[id][slot] = ctx;
        emit Bound(id, slot, ctx);
    }

    /// @notice Hand authorship to someone else.
    function setAuthor(uint256 id, address to) public onlyAuthor(id) {
        author[id] = to;
        emit Authored(id, to);
    }

    // =========================================================================
    // Batch — one gesture, one transaction
    // =========================================================================
    //
    // A keystroke is rarely one write. Translating touches three coordinate
    // frames; a command string touches hundreds. These exist so a gesture
    // costs one transaction instead of one per value.

    function writeMany(uint256[] calldata ids, bytes32[] calldata values) external {
        for (uint256 i; i < ids.length; ++i) write(ids[i], values[i]);
    }

    /// @notice Mint a frame, write it, and put it in a container — the whole
    ///         of `f` followed by `w` in one call.
    function mintWritten(uint256 within, bytes32 value) external returns (uint256 id) {
        id = mint(within);
        contents[id] = value;
        emit Wrote(id, value);
    }

    /// @notice Mint `n` frames into a container and write each. This is what a
    ///         cast command string compiles to.
    function mintMany(uint256 within, bytes32[] calldata values)
        external returns (uint256[] memory ids)
    {
        ids = new uint256[](values.length);
        for (uint256 i; i < values.length; ++i) {
            uint256 id = mint(within);
            contents[id] = values[i];
            emit Wrote(id, values[i]);
            ids[i] = id;
        }
    }

    // =========================================================================
    // Composition — what a session commits
    // =========================================================================
    //
    //   f            makes a frame real          → minted here, on-chain
    //   w / W        gives it name and contents  → write(), on-chain
    //   d + transforms  give it shape            → cast in the browser, never stored
    //
    // A composition holds the string, points at the command set that gives the
    // string meaning, and contains one frame per `f`. The nth `f` in the string
    // is the nth component — the correspondence is positional, so the string
    // needs no syntax for naming frames.
    //
    // Everything `d` produces is a function of these three things. Stamping a
    // 50-frame structure 4,000 times is 50 frames here and 200,000 in the
    // browser, and the string that does it is short.

    event Composed(uint256 indexed id, uint256 indexed commandSet, uint256 frames);

    /// @notice Commit a session: mint the composition, mint one frame per `f`,
    ///         store the string and the set it was written for.
    /// @param  charString  what was typed
    /// @param  commandSet  the set that gives it meaning; 0 for genesis
    /// @param  fCount      how many frames the string makes real
    /// @return id      the composition frame
    /// @return frames  the `f` frames, in the order they appear in the string
    function compose(
        string calldata charString,
        uint256 commandSet,
        uint256 fCount
    ) external returns (uint256 id, uint256[] memory frames) {
        id = mint(0);
        chars[id] = charString;

        if (commandSet != 0) {
            if (author[commandSet] == address(0)) revert NoFrame(commandSet);
            contexts[id][CTX_COMMAND_SET] = commandSet;
            emit Bound(id, CTX_COMMAND_SET, commandSet);
        }

        frames = new uint256[](fCount);
        for (uint256 i; i < fCount; ++i) {
            frames[i] = mint(id);
        }

        emit Composed(id, commandSet, fCount);
    }

    /// @notice Write name and contents into frames a composition made real.
    /// @dev    `w`/`W` after the fact. Frames not written stay blank and real —
    ///         a frame with no contents is still an object.
    function writeComposed(
        uint256[] calldata ids,
        bytes32[] calldata names,
        bytes32[] calldata values
    ) external {
        for (uint256 i; i < ids.length; ++i) {
            if (names[i] != bytes32(0)) {
                uint256 called = mint(ids[i]);
                contents[called] = names[i];
                emit Wrote(called, names[i]);
                contexts[ids[i]][CTX_CALLED] = called;
                emit Bound(ids[i], CTX_CALLED, called);
            }
            if (values[i] != bytes32(0)) write(ids[i], values[i]);
        }
    }

    /// @notice Re-point a composition at a different command set. Same string,
    ///         different meaning — a different structure entirely.
    function recast(uint256 id, uint256 commandSet) external onlyAuthor(id) {
        if (commandSet != 0 && author[commandSet] == address(0)) revert NoFrame(commandSet);
        contexts[id][CTX_COMMAND_SET] = commandSet;
        emit Bound(id, CTX_COMMAND_SET, commandSet);
    }

    // =========================================================================
    // Reads
    // =========================================================================

    function components(uint256 id) external view returns (uint256[] memory) {
        return _components[id];
    }

    function componentCount(uint256 id) external view returns (uint256) {
        return _components[id].length;
    }

    function componentAt(uint256 id, uint256 at) external view returns (uint256) {
        return _components[id][at];
    }

    function context(uint256 id, uint256 slot) external view returns (uint256) {
        return contexts[id][slot];
    }
}
