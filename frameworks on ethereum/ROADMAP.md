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
| **2. Citation costs something** | ERC-1155 receipts, per (framework, author) | the whole economic model |
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

## Stage 2 — Citation costs something

**Goal:** free inside your own work, paid when you pull in someone else's —
enforced, and priced per author whose work you actually used.

### This is citation, not licensing

The distinction decides the whole design, so state it first.

A licence is permission you need. A citation is a link you *want*, because the
connection is the value. Nobody cites a paper to obtain permission — they cite
it because being connected to that work is worth something to them.

This matters because **you can always just retype the content yourself**. Under
a licensing model that is a hole in the scheme: people route around the fee.
Under a citation model it is the point. Retyping gives you the same bytes and
none of the connection. The frame you copied is *someone's*, and the link says
so.

So the fee is not payment for access. It is the cost of making the edge real —
a tip, a token, the gesture of attribution having a price so that it means
something. Scientific papers cite studies; nobody is buying a licence.

### The rule

**Cost is per (framework, author).**

```
copying a framework costs:
    gas to mint the new tokens                        ← the default
  + cost[author] for each distinct (framework, author)
    pair present in what you copied
```

- Default cost is **the gas to mint those tokens** — the baseline is "you pay
  what it costs to exist," not rent. Authors opt into charging by setting
  `cost`.
- Two frameworks by the same author = two payments. Same author, different
  work, different citation.
- One framework containing three authors' work = three payments, one to each.
  **Not** a fraction split upstream — separate payments, no dilution.
- **Once you have paid for a (framework, author) pair, it is yours.** Use it in
  any composition of yours, any number of times, forever.

The unit is the intersection: what you are citing is *this author's
contribution to this framework*. If their work appears in two frameworks, that
is two things to cite — exactly as citing an author's two papers is two
citations.

### Receipts belong to the buyer, not the work

```solidity
id = keccak256(abi.encode(frameworkContract, frameworkId, author))

cite(frameworkContract, frameworkId) payable
  1. authors = authorSet(frameworkContract, frameworkId)
  2. for each (framework, author) pair not already held by msg.sender:
        require payment of cost[pair]
        pay author directly
        mint 1 receipt of `id` to msg.sender
  3. pairs already held → free
```

Receipts mint to **`msg.sender`'s wallet**, not the citing frame's account.
This follows directly from "once you've paid you can use your own after that":
the citation travels with *you*, not with the work.

This reverses the layers spec, which mints to the citing frame's TBA so the
licence travels with the work. That was the right call for licensing and is the
wrong one here. Consequence to accept: selling a composition transfers no
citations — a buyer who copies further owes on their own account.

### What this collapses

**No split cascade. No 0xSplits. No soulbound authorship root.**

That machinery exists to stop laundering — inserting a fake upstream claim to
divert a percentage. There is no percentage to divert. Each author's cost is
theirs and is paid directly, so there is nothing to route through anyone and
nothing to launder.

What remains is simpler: a copied frame must record **which (framework, author)
pair it came from**, so that a later copy of *your* framework can enumerate
whose work is inside it. Not a root pointer for splitting — a provenance tag
for enumeration.

### Amend the layers spec

`frameworks-onchain-layers-spec.md` needs three corrections, all in §3–§5:

1. **§5's per-node walk** becomes a per-(framework, author) enumeration. Only
   `f` frames exist, so there is no node to charge for; and charging per node
   would make copying a large structure by one author absurdly expensive for no
   reason that maps to authorship.
2. **§4's split cascade** is deleted. Superseded by direct payment per author.
3. **§3's receipt target** changes from citing-frame-TBA to buyer wallet.

The spec's core claim survives intact and is in fact strengthened: receipts key
on a specific minted frame, not a content hash, so two authors who independently
write identical bytes are two independent citations. That is still exactly right.

### The engineering problem: enumerating authors

To sum costs you must know the distinct `(framework, author)` pairs inside what
is being copied. On-chain traversal of an arbitrary subtree is unbounded gas.

**Precompute the author set at mint.** A frame's author set is its own author
plus the union of its children's. Composition is additive-only, so the set is
fixed at creation and cheap to maintain incrementally — no traversal at copy
time, just a stored set to read.

This is the main implementation risk in Stage 2 and worth prototyping before
committing to the rest.

### Decisions still open

- **Setting `cost`.** Per author globally, or per (framework, author)? The rule
  above implies the latter — an author might price two frameworks differently.
- **Changing `cost` after the fact.** Does it affect prior citations? It should
  not — a citation already paid is settled.
- **Zero cost.** Must be expressible; many authors will want reach over income.

### Done when

- Copying your own work is free
- Copying one author's framework charges once; copying a framework containing
  three authors charges three times, each paid directly
- Copying the same (framework, author) pair again is free, in any composition
- Default cost with no `cost` set is the gas to mint the copied tokens
- An event exists that an indexer can use to build "who has cited me"

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
- **Amend the layers spec** — §5's per-node cascade, §4's 0xSplits, and §3's
  receipt target are all superseded by the citation model in Stage 2.
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
