// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { ERC721 }           from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import { ERC721Enumerable } from "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";

/// @dev ERC-6551 Registry — canonical address, same on every chain.
interface IERC6551Registry {
    function createAccount(
        address implementation, bytes32 salt, uint256 chainId,
        address tokenContract, uint256 tokenId
    ) external returns (address);

    function account(
        address implementation, bytes32 salt, uint256 chainId,
        address tokenContract, uint256 tokenId
    ) external view returns (address);
}

/// @title  Frameworks V2 — frames are tokens
/// @notice Stage 1 of ROADMAP.md.
///
///         A frame is an ERC-721 with a token-bound account. Containment is
///         ownership: a frame inside another frame is *owned by that frame's
///         account*. There is no components array — the children are whatever
///         the account holds.
///
///         That one change fixes four things at once:
///           - the parent pointer exists (ownerOf, in the missing direction)
///           - attach becomes a transfer, so it needs the child owner's consent
///           - a token has one owner, so multi-parent is impossible and
///             "coordinates relative to THE container" is well-defined
///           - frames can be transferred, sold, and displayed
///
///         What does not change: writing is still the only operation, contexts
///         are still frames, and only `f` frames are stored — everything `d`
///         produces is cast in the browser.
contract FrameworksV2 is ERC721Enumerable {

    // =========================================================================
    // 6551
    // =========================================================================

    IERC6551Registry public constant REGISTRY =
        IERC6551Registry(0x000000006551c19487814612e58FE06813775758);

    /// @notice The account implementation every frame uses.
    /// @dev    Fixed per contract, not per mint. The layers spec leaves this
    ///         open; fixed is the answer until someone needs otherwise, since
    ///         a configurable salt is a parameter nobody would set.
    address public immutable accountImplementation;

    bytes32 public constant SALT = bytes32(0);

    // =========================================================================
    // Frame state
    // =========================================================================

    /// @notice What a frame holds. A number, a hash, a character — the reader
    ///         decides. 0x0 means the frame is pure structure.
    mapping(uint256 => bytes32) public contents;

    /// @notice The frames a frame is read through, by slot. Slot numbering is
    ///         a convention held by readers, not by this contract.
    mapping(uint256 => mapping(uint256 => uint256)) public contexts;

    /// @notice A frame's char string, when it has one.
    mapping(uint256 => string) public chars;

    /// @notice Who made this frame. Distinct from ownerOf, and never changes.
    ///
    /// @dev    This separation is load-bearing. Ownership moves when a
    ///         framework is sold; authorship must not, or selling a framework
    ///         silently reassigns credit — and payment — for everything inside
    ///         it. Stage 2 pays `author`, never `ownerOf`.
    mapping(uint256 => address) public author;

    /// @notice Where a copied frame came from, 0 if original.
    /// @dev    Provenance for enumeration, not a root pointer for splitting.
    ///         There is no cascade to anchor.
    mapping(uint256 => uint256) public copiedFrom;

    uint256 public count;

    /// @dev Reverse index: a frame's account address → that frame's id.
    ///      Written once per mint so `containerOf` is O(1). Without it the
    ///      only way up the tree is scanning every frame, which would make
    ///      Stage 2's ancestor walk cost grow with the size of the system.
    mapping(address => uint256) private _frameOfAccount;

    // Context slots — a reader convention, deliberately unenforced.
    uint256 public constant CTX_CALLED      = 0;
    uint256 public constant CTX_COORDINATES = 1;
    uint256 public constant CTX_COLORS      = 2;
    uint256 public constant CTX_CAMERA      = 3;
    uint256 public constant CTX_COMMAND_SET = 4;
    uint256 public constant CTX_CHAR        = 5;

    // =========================================================================

    event Minted(uint256 indexed id, address indexed author, uint256 indexed within);
    event Wrote(uint256 indexed id, bytes32 value);
    event Bound(uint256 indexed id, uint256 indexed slot, uint256 indexed context);
    event Composed(uint256 indexed id, uint256 indexed commandSet, uint256 frames);

    error NotOwner(uint256 id);
    error NoFrame(uint256 id);

    modifier onlyOwnerOf(uint256 id) {
        _requireOwner(id);
        _;
    }

    /// @dev Authority over a frame is authority over the *root* of the chain
    ///      it sits in.
    ///
    ///      Once containment is ownership, a nested frame is owned by its
    ///      container's account — so its human owner does not appear in
    ///      `ownerOf` at all. Requiring a literal `ownerOf(id) == msg.sender`
    ///      would mean every edit to a nested frame had to be routed as a call
    ///      *through* each account in the chain, and each of those accounts
    ///      would have to be deployed first. Nesting would stop being free,
    ///      and `compose` could not mint a second level.
    ///
    ///      So: walk up to whoever holds the root, and check them. Selling the
    ///      outer frame hands over authority for everything inside it, which
    ///      is what containment already means. Authorship is separate and does
    ///      not move (see `author`).
    function _requireOwner(uint256 id) internal view {
        if (_ownerOf(id) == address(0)) revert NoFrame(id);
        if (rootOwnerOf(id) != msg.sender) revert NotOwner(id);
    }

    /// @notice The human (or contract) at the top of this frame's containment
    ///         chain. For an unnested frame this is just `ownerOf`.
    function rootOwnerOf(uint256 id) public view returns (address) {
        address owner = ownerOf(id);
        uint256 container = _frameOfAccount[owner];
        // Bounded walk — depth, not frame count. 256 is far past any real tree.
        for (uint256 i; container != 0 && i < 256; ++i) {
            owner = ownerOf(container);
            container = _frameOfAccount[owner];
        }
        return owner;
    }

    constructor(address accountImpl) ERC721("Frameworks", "FRAME") {
        accountImplementation = accountImpl;
    }

    // =========================================================================
    // The write surface
    // =========================================================================

    /// @notice Bring a frame into existence.
    /// @param  within  the frame it lands inside, or 0 to stand alone.
    /// @dev    Minting into a container means minting *to that container's
    ///         account*. Containment is ownership; there is nothing else to
    ///         record. Only the container's owner may put frames in it.
    function mint(uint256 within) public returns (uint256 id) {
        id = ++count;
        author[id] = msg.sender;

        address to = msg.sender;
        if (within != 0) {
            _requireOwner(within);
            to = accountOf(within);
        }

        // Record this frame's own account so containerOf() can resolve
        // children of it in O(1) later.
        _frameOfAccount[accountOf(id)] = id;

        // _mint, not _safeMint, when minting into a container.
        //
        // A 6551 account address is deterministic and valid before the
        // account is deployed — that is the point of the registry. But
        // _safeMint calls onERC721Received, and there is no code at an
        // undeployed account to answer, so it reverts. Frames would only be
        // nestable inside containers whose accounts had already been paid to
        // deploy, which defeats containment being free.
        if (within != 0) _mint(to, id);
        else             _safeMint(to, id);

        emit Minted(id, msg.sender, within);
    }

    /// @notice Write a frame's contents.
    /// @dev    Still the only operation. Translating a frame is writing to the
    ///         frame that holds its x.
    function write(uint256 id, bytes32 value) public onlyOwnerOf(id) {
        contents[id] = value;
        emit Wrote(id, value);
    }

    /// @notice Move a frame into a container.
    /// @dev    This is a transfer, which is the whole point: it goes through
    ///         ERC-721 authorization, so it needs the *child's* owner. In V1
    ///         `attach` checked only the parent, and anyone could pull anyone
    ///         else's frame into their composition (see Gaps.t.sol).
    function attach(uint256 parent, uint256 child) public {
        if (_ownerOf(parent) == address(0)) revert NoFrame(parent);
        // Both ends must answer to msg.sender. This is the check V1 lacked:
        // there, `attach` looked only at the parent, so anyone could pull
        // anyone else's frame into their composition (see Gaps.t.sol).
        _requireOwner(parent);
        _requireOwner(child);
        _transfer(ownerOf(child), accountOf(parent), child);
    }

    /// @notice Give a frame a context to be read through.
    function bind(uint256 id, uint256 slot, uint256 ctx) public onlyOwnerOf(id) {
        if (ctx != 0 && _ownerOf(ctx) == address(0)) revert NoFrame(ctx);
        contexts[id][slot] = ctx;
        emit Bound(id, slot, ctx);
    }

    // =========================================================================
    // Composition
    // =========================================================================

    /// @notice Commit a session: mint the composition, mint one frame per `f`,
    ///         store the string, bind the command set.
    /// @dev    `fCount` is passed in rather than counted, because counting
    ///         would require knowing that `f` means frame — which belongs to
    ///         the command set, not to this contract.
    function compose(
        string calldata charString,
        uint256 commandSet,
        uint256 fCount
    ) external returns (uint256 id, uint256[] memory frames) {
        id = mint(0);
        chars[id] = charString;

        if (commandSet != 0) {
            if (_ownerOf(commandSet) == address(0)) revert NoFrame(commandSet);
            contexts[id][CTX_COMMAND_SET] = commandSet;
            emit Bound(id, CTX_COMMAND_SET, commandSet);
        }

        frames = new uint256[](fCount);
        for (uint256 i; i < fCount; ++i) frames[i] = mint(id);

        emit Composed(id, commandSet, fCount);
    }

    /// @notice Name a composition. V1 had no path to this, so every
    ///         composition read as "Framework #n".
    function name(uint256 id, bytes32 called) public onlyOwnerOf(id) {
        uint256 f = mint(id);
        contents[f] = called;
        emit Wrote(f, called);
        contexts[id][CTX_CALLED] = f;
        emit Bound(id, CTX_CALLED, f);
    }

    function recast(uint256 id, uint256 commandSet) external onlyOwnerOf(id) {
        if (commandSet != 0 && _ownerOf(commandSet) == address(0)) revert NoFrame(commandSet);
        contexts[id][CTX_COMMAND_SET] = commandSet;
        emit Bound(id, CTX_COMMAND_SET, commandSet);
    }

    // =========================================================================
    // Batch
    // =========================================================================

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
    // Reads — containment
    // =========================================================================

    /// @notice This frame's token-bound account. Its components are what this
    ///         address owns.
    function accountOf(uint256 id) public view returns (address) {
        return REGISTRY.account(accountImplementation, SALT, block.chainid, address(this), id);
    }

    /// @notice Deploy the account. Not required to receive tokens — the
    ///         address is deterministic — but required before it can act.
    function createAccount(uint256 id) external returns (address) {
        return REGISTRY.createAccount(accountImplementation, SALT, block.chainid, address(this), id);
    }

    /// @notice How many frames are inside this one.
    function componentCount(uint256 id) public view returns (uint256) {
        return balanceOf(accountOf(id));
    }

    /// @notice The i-th frame inside this one.
    /// @dev    Ordered by ERC721Enumerable, which is why this contract pays
    ///         for that extension: the renderer reads components positionally.
    function componentAt(uint256 id, uint256 i) public view returns (uint256) {
        return tokenOfOwnerByIndex(accountOf(id), i);
    }

    /// @notice The frame containing this one, or 0 if it is held by a wallet.
    /// @dev    The direction V1 could not answer at all. Stage 2's "do I hold
    ///         this frame or any ancestor" walk needs exactly this, so it has
    ///         to be O(1) — a scan over all frames would make citation cost
    ///         grow with the size of the whole system.
    ///
    ///         `_frameOfAccount` is maintained on every mint, so the lookup is
    ///         one mapping read regardless of how many frames exist.
    function containerOf(uint256 id) public view returns (uint256) {
        return _frameOfAccount[ownerOf(id)];
    }

    /// @notice Walk up the containment chain. Used by Stage 2 to answer "do I
    ///         hold this frame or any ancestor of it".
    /// @dev    Bounded by depth, not by subtree size or total frame count.
    function ancestorsOf(uint256 id, uint256 maxDepth)
        external view returns (uint256[] memory chain)
    {
        uint256[] memory buf = new uint256[](maxDepth);
        uint256 n;
        uint256 cur = containerOf(id);
        while (cur != 0 && n < maxDepth) {
            buf[n++] = cur;
            cur = containerOf(cur);
        }
        chain = new uint256[](n);
        for (uint256 i; i < n; ++i) chain[i] = buf[i];
    }

    function context(uint256 id, uint256 slot) external view returns (uint256) {
        return contexts[id][slot];
    }
}
