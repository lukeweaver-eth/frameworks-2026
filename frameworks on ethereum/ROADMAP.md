# Roadmap — from substrate to the full system

Where `Frameworks.sol` is now, and the stages to what
`what-frameworks-is.md` and `frameworks-onchain-layers-spec.md` describe.

Read `ASSESSMENT.md` first — this is the plan against that gap list.

**Infrastructure already live on Sepolia** (nothing to deploy):

```
ERC-6551 Registry   0x000000006551c19487814612e58FE06813775758
EAS                 0xC2679fBD37d54388Ce493F1DB75320D236e1815e
EthFS FileStore     0xFe1411d6864592549AdE050215482e4385dFa0FB
```

---

## The shape of the work

Four stages. Each is independently shippable and leaves a working system.

| Stage | What it adds | Unblocks |
|---|---|---|
| **1. Frames are tokens** | ERC-721 + 6551 | ownership, containment, transfer, display |
| **2. Copy costs something** | ERC-1155 receipts + splits | the whole economic model |
| **3. Frames are visible** | on-chain preview, enumeration | wallets, marketplaces, discovery |
| **4. Contexts do more than draw** | statechart context | the "systems as structures" claim |

Stage 1 is the unblocker. Stages 2–4 each depend on it and are otherwise
independent of each other.

---

## Stage 1 — Frames are tokens

**Goal:** a frame is an ERC-721 with a token-bound account. Containment is
ownership. This single change fixes gaps (a), (b), the parent-pointer problem,
and the unauthorized-`attach` bug at once.

### What changes

```solidity
contract Frameworks is ERC721 {
    mapping(uint256 => bytes32) public contents;
    mapping(uint256 => mapping(uint256 => uint256)) public contexts;
    mapping(uint256 => string)  public chars;
    // _components is GONE — components are what the TBA owns
}
```

- `mint(within)` mints a 721 to `tbaOf(within)`, or to `msg.sender` if
  `within == 0`.
- **Containment becomes `ownerOf`.** A contained frame is owned by its
  container's account. `ownerOf(46)` returns frame 45's TBA. The parent
  pointer exists for free, in the direction that was missing.
- **`attach` becomes a transfer.** Moving a frame into a container means
  transferring the token to that container's TBA — which requires the child's
  owner to authorize it. The consent bug disappears by construction.
- **Multi-parent becomes impossible.** A token has one owner. "Coordinates
  relative to *the* container" is now well-defined.
- `author` is replaced by `ownerOf`, except for authorship credit — see
  Stage 2, where the two must be kept apart.

### Components without an array

`_components` goes away, which means `componentAt(id, i)` needs a replacement.
Three options, in order of preference:

1. **`ERC721Enumerable` + `tokenOfOwnerByIndex(tba, i)`** — ordered, on-chain,
   costs gas on every mint and transfer.
2. **Index `Transfer` events off-chain** — free, but the renderer can't use it,
   and `frameNames()` currently reads components on-chain.
3. **Keep a lightweight ordered index** alongside ownership, maintained in
   `_beforeTokenTransfer`.

Option 1 is the honest one and the renderer keeps working unchanged. Take the
gas hit; revisit if it bites.

### Decisions to make first

- **6551 implementation and salt** — fixed per contract, or per mint? The spec
  flags this as open. Recommendation: fixed, one shared implementation. Custom
  account logic can come later via a new implementation address; making it
  configurable now adds a parameter nobody will use.
- **Does `compose` still mint children directly?** Yes, but into the
  composition's TBA rather than an array.
- **Migration.** Frames 1–51 on the current contract can't be upgraded — there
  is no proxy. Either redeploy genesis on the new contract, or treat the
  current deployment as v0 and keep it as a reference. Recommendation:
  redeploy. Genesis is 44 mints and one transaction.

### Done when

- `ownerOf(46)` returns frame 45's TBA
- Transferring frame 45 moves the whole subtree with it (its TBA still owns 46–48)
- `Gaps.t.sol` fails — all three gaps closed
- The renderer's `frameNames(45)` still returns `["ART","NETWORK","KNOWLEDGE"]`
- `browse.html` walks containment via `ownerOf` instead of `componentAt`

---

## Stage 2 — Copy costs something

**Goal:** the boundary rule from `what-frameworks-is.md` — free inside your
own work, paid across an authorship boundary — actually enforced.

### The pieces

**Authorship roots.** Each frame carries `isAuthorshipRoot` and
`authorshipRoot`, set at mint and **never reassignable**. This is what the
split cascade anchors to, and it must be independent of `ownerOf` — otherwise
selling a framework silently reassigns credit for everything inside it. The
spec flags this as an open item; it is the single subtlest thing in Stage 2.

**Receipts (ERC-1155).**

```solidity
id = keccak256(abi.encode(citedFrameContract, citedTokenId))

transclude(citingContract, citingId, citedContract, citedId) payable
  1. citingTBA = tbaOf(citingContract, citingId)
  2. if balanceOf(citingTBA, id) > 0  → free, already licensed
  3. else → take payment, run the cascade, mint 1 to citingTBA
```

Minted to the *citing frame's TBA*, not the wallet, so the license travels
with the work rather than the person. Pay once per (citing, cited) pair;
re-cite free.

**Split cascade.** On first copy of a given frame, route a fraction upstream
to `authorshipRoot`, recursively via 0xSplits. Because the root is soulbound,
a reference chain can't be laundered by inserting a fake upstream claim.

### The correction this repo already made

`frameworks-onchain-layers-spec.md` §5 says deep duplicate walks every node
and fires the cascade **per node**. That contradicts `what-frameworks-is.md`,
which prices per *authorship boundary crossed*.

Resolve in favor of boundary-crossing, and amend §5. Reasons: it matches the
storage model (only `f` frames exist, so there is no node to charge for), it
keeps `d` a free keystroke while composing, and cost scales with how much of
other people's work you pulled in — which is what "amount of authored content
recreated" was reaching for.

Two documents in the same directory currently disagree about this. Fix before
implementing.

### Decisions to make first

- **Who sets the price?** Spec leaves it open. Keep it in a swappable policy
  contract so fixed-price / author-set / free are all reachable without
  redeploying the receipt contract.
- **What fraction routes upstream?** Needs a number. Suggest starting flat and
  simple.

### Done when

- Copying your own frame is free; copying another author's takes payment
- A second copy of the same (citing, cited) pair is free
- Selling a composition does not change who its frames' payments route to
- An event exists that an indexer can use to build "who has copied me"

---

## Stage 3 — Frames are visible

**Goal:** wallets, marketplaces, and humans can see a composition without
running a script.

**On-chain preview image.** `uri()` currently has no `image`, so nothing
displays. Options:

1. **SVG rendered on-chain from the composition.** Cast the string in
   Solidity, project to 2D, emit `<line>` elements. Correct and expensive; the
   projection math is the same problem the WebGPU renderer solves.
2. **A static SVG identity mark** — frame count, name, command-set id, drawn
   as type. Cheap, honest, communicates that this is a Frameworks composition
   without pretending to be a render.
3. **Off-chain capture** stored at mint, like the V4 postcard.

Recommendation: **2 now, 1 later.** Option 3 reintroduces exactly the
stored-image dependency this design removed.

**Enumeration.** `browse.html` classifies heuristically ("has chars" =
composition). That doesn't scale. Add either an on-chain type tag or a
documented event schema plus an indexer.

**Citation via EAS** (free layer). Cheap once frames have stable
`(contract, tokenId)` identity. Register the schema once:

```
address fromFrame, uint256 fromTokenId,
address toFrame,   uint256 toTokenId, uint8 linkType
```

Backlinks = query EAS for attestations where `(toFrame, toTokenId)` matches.
Trust-weighted resolution — reader picks an attester set, walks only those
edges — is a client concern, not a contract one.

### Done when

- A composition shows something in a wallet
- The full set of compositions is listable without scanning every id
- `browse.html` reads a real index rather than guessing

---

## Stage 4 — Contexts do more than draw

**Goal:** support the claim that this is a medium for thinking about systems,
which is currently the least evidenced part of `what-frameworks-is.md`.

**The statechart context.** A framework holds P, R, Q; a statechart context
changes their *contents* as state advances. Structure static, behavior moving
through it — "thinking about dynamic things as if they were static," discharged.

This fits the existing architecture exactly, and it fills a real asymmetry:
contexts currently govern coordinates, color, and camera. **Contents is the
one frame property with no context governing it.** `w`/`W` write it by hand;
a statechart context writes it as a function of state.

| Context | Writes |
|---|---|
| coordinate | position and angle |
| color | palette index |
| camera | projection |
| **statechart** | **contents** |

Constraint worth keeping: a statechart writes contents, it does not create or
move frames. If behavior could restructure, the structure stops being the
trustworthy static thing and you're back to watching a simulation.

**The worked example.** One real system, structured in Frameworks, where the
nesting shows something a document wouldn't. This is what would move the
project from "coherent system" to "obviously worth using," and no amount of
further architecture substitutes for it.

---

## Cross-cutting, do these anywhere

- **Reproducible builds.** Neither deployed contract can be rebuilt from this
  repo (different projects, different solc). Fix before mainnet — see
  `DEPLOYMENT.md`.
- **Reconcile the two specs.** §5 of the layers spec vs. the boundary rule.
- **Name compositions.** `compose` has no name param and no path to one.
- **Contents > 32 bytes.** Decide where the bytes behind a hash live.
- **`CTX_CHAR`.** Either use it or delete it; it is declared and never bound.
- **Artifact command sets.** The derived viewer pins genesis bindings, so
  `recast` changes metadata but not the embedded viewer. Either bundle a
  minimal RPC read or document the pin as intended.

---

## Suggested order

1. Reconcile the two specs — it changes what Stage 2 implements
2. Stage 1, on a fresh deploy, with genesis reminted
3. Stage 3's preview image — cheap, and makes everything else demonstrable
4. Stage 2
5. Stage 4, or Stage 4's worked example much earlier if the argument matters
   more than the infrastructure

Stage 1 is the only hard dependency. If the goal is to show someone why this
matters rather than to complete the spec, do Stage 4's worked example first —
it needs nothing that isn't already deployed.
