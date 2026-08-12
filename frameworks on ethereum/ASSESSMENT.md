# Frameworks.sol — what it is, what it isn't, and what's missing

An assessment of the deployed contract against `what-frameworks-is.md` and
`frameworks-onchain-layers-spec.md`.

Live at `0x5ae53901f5a39528ac4bc8e8cba54deb830b880f` (Sepolia, verified).

---

## 1. What the contract does

Five write functions and one convenience call. That's the whole surface.

```solidity
mint(within)                  → new frame, optionally inside another
write(id, value)              → set contents (bytes32)
attach(parent, child)         → put an existing frame inside another
bind(id, slot, ctx)           → give a frame a context to be read through
setAuthor(id, to)             → hand over write permission

compose(chars, set, fCount)   → mint a composition: store the string, bind the
                                command set, mint one frame per `f`
```

State is four mappings and a counter:

| | |
|---|---|
| `contents[id]` | what a frame holds — a number, a hash, a character. Reader decides. |
| `_components[id]` | the frames inside it, ordered. Position is identity. |
| `contexts[id][slot]` | the frames it's read through |
| `author[id]` | who may write |
| `chars[id]` | the char string, when it has one |

### The ideas that actually landed

**Writing is the only operation.** There is no `translate`. Moving a frame
means writing a value into the frame that holds its x. `rotate`, `scale`,
`color` don't exist either — they're all `write` against different components.
This is the strongest claim in the design and the contract genuinely honors it.

**Contexts are frames.** A command set is a frame whose components are
bindings. Binding one is `bind(id, slot, ctx)` — pointing at a token id. So
"using someone's command set" and "copying their structure" are the same act,
with no separate mechanism.

**The contract never learns what a character means.** `compose` takes `fCount`
as a parameter rather than counting `f`s, because counting would require
knowing that `f` means frame — which is the command set's job. The `CTX_*`
constants are declared and never read. Slot 1 holds coordinates only because
readers agree it does.

**The storage split works.** `f` mints, `w`/`W` write, `d` and the transforms
are cast in the browser. Measured: `"50f(dR,4000)"` is 50 on-chain frames and
~200,000 browser frames for ~2.6M gas. Composition 45 is 36 characters, 3
frames, and renders three orthogonal named frames.

**The bootstrap is not circular.** A deployer called `mint`; afterwards frames
existed. The creating thing was a contract call, not a frame. Genesis is 44
frames minted in one transaction.

---

## 2. Where it falls short

### a. It implements no ERC standard

The layers spec calls for **ERC-721 + ERC-6551**. The contract has none of it:
no `ownerOf`, no `transferFrom`, no `balanceOf`, no `supportsInterface`, no
token-bound accounts.

`author` is a bespoke permission field, not ownership. Consequences:

- Frames can't be sold, transferred through a marketplace, or held in a wallet.
- No wallet or marketplace will display a frame, because nothing recognizes it.
- The spec's model — *containment is ownership, a contained frame is owned by
  its container's TBA* — isn't implemented. Containment is `_components`, a
  plain array.

This is the largest single gap.

### b. Containment is one-directional and unenforced

`_components[parent]` lists children. There is **no parent pointer**. From
frame 46 (ART) there is no way to find frame 45. Any "what contains this"
query requires scanning every frame or indexing `Attached` events off-chain.

Worse, `attach` only checks the *parent's* author:

```solidity
function attach(uint256 parent, uint256 child) public onlyAuthor(parent) {
    if (author[child] == address(0)) revert NoFrame(child);
```

Anyone can attach **anyone else's** frame into their own. There's no double
authorship check, no ownership transfer, no consent. Under the 6551 model this
is impossible by construction — containment means the container's account
*holds* the token, which requires a transfer. Here it's a free pointer.

A frame can also be attached to many parents at once, so "containment" isn't a
tree — it's an arbitrary graph. `what-frameworks-is.md` says a frame's
coordinates are relative to *the* frame that contains it. With multiple
parents, "the" container is undefined.

### c. No copy layer at all

Neither the free citation layer (EAS) nor the paid one (ERC-1155 receipts) is
implemented. There is no payment, no receipt, no split, no authorship root, no
`isAuthorshipRoot`, no `authorshipRoot` pointer.

So the entire economic model from both documents is absent. `d` across an
authorship boundary is currently just... free, and unrecorded. The boundary
rule — free inside your own work, paid across — has nothing enforcing it.

### d. `CTX_CHAR` is declared but never used

`compose` stores the string in the `chars` mapping, not as a bound context
frame. So the char string is the one piece of a composition that **isn't** a
frame — a special-cased field in a contract whose whole thesis is that
everything is a frame.

Defensible for gas (strings exceed `bytes32`), but it's an inconsistency at the
center of the design, and `CTX_CHAR = 5` sitting unused is a loose end.

### e. Compositions can't be named

`compose` mints the frame and returns. There's no name parameter and no path
to setting one afterward, so frame 45 reads as `Framework #45`. Naming is just
`w` — the same gesture as naming anything else — but the composition frame
never gets it.

### f. `contents` is `bytes32` only

Fine for a coordinate, a character, or a hash. Not fine for the "markdown-like
body text" the root CLAUDE.md describes. Contents longer than 32 bytes must be
hashed and stored elsewhere, and the contract has no notion of where. The spec
assumes this (`contentHash`), but nothing resolves a hash to bytes.

### g. No enumeration, no discovery

`count()` gives the total; everything else requires walking ids 1..N and
guessing what things are. `browse.html` classifies heuristically — "has chars"
= composition, "many components, no chars" = command set. There's no on-chain
type, no index of compositions, no way to list a given author's frames.

### h. Frames are permanently derived — by design, with a cost

Because only `f` frames are stored, **no frame produced by `d` has an
address**. You can copy a whole composition; you can never cite one frame
inside one. Citation granularity is set by where you drew boundaries with
`f`/`F`. This is a deliberate choice and it's consistent — but it means the
spec's per-frame citation model can't be expressed.

### i. Reproducibility

Neither deployed contract can currently be rebuilt from this repo. Frameworks
was compiled by a scratch project (solc 0.8.28, no optimizer); the renderer
from `WebGPU/deploy` (pinned 0.8.24). See `DEPLOYMENT.md`.

---

## 3. How it integrates with the renderer

`FrameworksRenderer` at `0x281C60Fafa8eaDCdfa16d58e919a1e3507eFA140` holds an
immutable pointer to Frameworks and reads everything at call time.

```
uri(id)
├── frameworks.chars(id)                       the string
├── frameworks.context(id, CTX_COMMAND_SET)    which set gives it meaning
├── frameworks.componentCount(id)              how many frames
├── frameworks.context(frame, CTX_CALLED)      each frame's name
│   └── frameworks.contents(called)
└── IEthFS.readFile("frameworks_v5_viewer_v1.min.html")
    └── inject `let autoExecuteCommand='…'` before </head>
        └── base64 → data:text/html
```

Nothing is stored in an encoded artifact. The V4 renderer decodes
`abi.encode(image, commandString)` from a Mint token; this one reads live
state. Three properties follow:

- **`recast(id, otherSet)` changes what the renderer returns.** Same string,
  different structure. Verified by test.
- **Cost is independent of composition size.** A 3-frame and a 200k-frame
  composition produce the same size artifact, because the multiplicity is in
  the string.
- **`frameNames(id)` makes it legible without rendering.** Returns
  `["ART","NETWORK","KNOWLEDGE"]` — semantic content readable on-chain, which
  the postcard model could not do.

### Renderer gaps

- **No `image` field.** `uri()` has `name`, `description`, `animation_url`,
  `attributes` — no preview. Wallets and marketplaces will show nothing. Needs
  an on-chain SVG or an off-chain capture.
- **Not `IRenderer`.** Deliberate — Frameworks compositions aren't Mint tokens
  — but it means no existing infrastructure can serve it.
- **`VIEWER` is a hardcoded filename.** A new viewer means a new renderer
  deploy. Fine (EthFS names are immutable) but worth knowing.
- **The artifact pins its command set.** The derive step strips the chain read
  because the viewer has no ethers. So `recast` changes `uri()` metadata but
  the embedded viewer still runs genesis bindings.

---

## 4. What the system needs

Ordered by what unblocks the most.

### Tier 1 — required for either document to be true

**1. ERC-721 + 6551.** Make frames real tokens with token-bound accounts.
Containment becomes ownership: a contained frame is owned by its container's
TBA, queried with `ownerOf`. This fixes (a), (b), and the parent-pointer
problem at once — 6551 gives the tree for free, as the spec says. Everything
below is easier after this.

**2. The copy layer.** ERC-1155 receipts keyed on
`keccak256(citedContract, citedTokenId)`, minted to the *citing frame's TBA*.
Pay once per (citing, cited) pair; re-cite free. This is the entire economic
model and it is currently absent.

**3. Authorship roots.** `isAuthorshipRoot` and `authorshipRoot` on each frame,
soulbound, so the split cascade has an anchor that can't be laundered by
inserting a fake upstream claim.

### Tier 2 — makes it usable

**4. An image in `uri()`.** Without it nothing displays this anywhere.

**5. Naming compositions.** A name param on `compose`, or a documented
follow-up `write`.

**6. Content resolution.** Decide where >32-byte contents live (IPFS? EthFS?
SSTORE2?) and put the pointer convention in the contract or the renderer.

**7. Enumeration.** An index of compositions, or at minimum a documented event
schema so an indexer can build one. `browse.html`'s heuristics don't scale.

### Tier 3 — the arguments not yet made

**8. Citation via EAS.** The free, declarative, revocable layer. Cheap to add
once frames have stable `(contract, tokenId)` identity.

**9. Fix `attach`.** Require the child's author too, or make it a transfer.
Currently anyone can attach anyone's frame.

**10. Decide on multi-parent.** Either enforce single containment (matching
"coordinates are relative to *the* container") or amend the document.

**11. The statechart context.** The sharpest idea in the design discussion and
entirely unbuilt: a framework holding P, R, Q whose contents change as state
advances — structure static, behavior moving through it. This is what would
support the "think about systems as structures" claim, which remains the least
evidenced part of `what-frameworks-is.md`.

---

## 5. Honest summary

The contract is a **correct, minimal, working substrate for the ontology** and
**not yet an implementation of either spec's social or economic layer.**

What's real: writing as the only operation, contexts as frames, the storage
split, the bootstrap, and a renderer that reads live state rather than a
stored blob. Those were the hard conceptual problems and they're solved and
deployed.

What's missing is everything that makes frames *objects in a shared world*
rather than rows in one contract: ownership, transferability, containment as a
real relation, citation, and payment. The layers spec is a three-layer design
and only the bottom half of layer one exists.

The gap is not conceptual. It's a known list of standards to implement against
an ontology that now holds still.
