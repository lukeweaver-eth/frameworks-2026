# Frameworks: containment, citation, transclusion — interface sketch

> **Superseded in part.** §3–§5 below describe a *licensing* model: receipts
> minted to the citing frame's account, a split cascade routing a fraction
> upstream via 0xSplits, and a per-node walk on deep duplicate. None of that
> is the model.
>
> The system is **citation, not licensing.** Every frame carries a cost, and
> you pay at the level you grab — copy a framework, pay its cost, get
> everything inside it; copy one component, pay that component's cost instead.
> One payment, straight to that frame's author. No summing, no walk, no
> splitting. Receipts belong to the buyer's wallet and cover the cited frame's
> whole subtree, so a paid citation is theirs to reuse anywhere, forever.
> Default cost is a flat 0.00001 ETH. Changing a cost is never retroactive,
> and zero cost is allowed.
>
> See `ROADMAP.md` § Stage 2 for the current model and the three specific
> corrections. §1, §2, and the collision argument in §3 stand unchanged.

Three separable layers. Each owns a distinct piece of state and a distinct
relationship. They compose but never merge.

| Layer | Standard | Relationship | Cardinality |
|---|---|---|---|
| Containment | ERC-721 + ERC-6551 | frame → container | single parent |
| Citation | EAS attestation | frame → frame | many-to-many |
| Transclusion | ERC-1155 | citing frame → cited frame | one receipt per citing frame |

Content hashes are not a layer with ownership semantics — they're the leaf
payload a frame wraps. Multiple frames can wrap the same hash independently;
that's not a conflict, it's two authorship claims that happen to collide in
content (see "collision case" below).

---

## 1. Frame (ERC-721 + 6551 TBA)

```solidity
interface IFrame is IERC721 {
    struct FrameData {
        bytes32 contentHash;   // set only if this frame is a leaf; else 0x0
        bool isAuthorshipRoot; // true only for the original mint of this
                                // specific authored expression
        address authorshipRoot; // frame contract of the root, if this is
                                 // a paid duplicate/transclusion-derived mint
    }

    function mint(address to, bytes32 contentHash) external returns (uint256 tokenId);

    function frameData(uint256 tokenId) external view returns (FrameData memory);

    // TBA address for this frame — from ERC-6551 Registry.account(),
    // deterministic from (implementation, chainId, address(this), tokenId, salt)
    function tbaOf(uint256 tokenId) external view returns (address);
}
```

Notes:
- `contentHash` is set for leaf frames only. A frame with children (a
  "framework" from the top) has `contentHash == 0x0` and its meaning comes
  entirely from what's held in its TBA.
- Container is never stored explicitly on the frame — it's just "whoever
  currently owns this tokenId," which for a contained frame is another
  frame's TBA address. Query via standard `ownerOf(tokenId)`.
- Contents/components are never stored explicitly either — query via
  `IERC721Enumerable` or an indexer watching `Transfer` events into a given
  TBA. No custom tree data structure needed; 6551 gives you the tree for free.

---

## 2. Link / citation (EAS schema)

Registered once, instantiated per link. This is the free, inert,
declaration-only layer — no payment implied, revocable, many-to-many.

```
schema: "address fromFrame, uint256 fromTokenId, address toFrame,
         uint256 toTokenId, uint8 linkType"
revocable: true
```

`linkType` is an enum you define (cites, critiques, extends, replies-to,
etc). Backlinks for a given frame = query EAS for all attestations where
`(toFrame, toTokenId)` matches — no indexer-side reconstruction needed,
unlike Ethereum's native call graph, because the attester opted in to
declaring the edge explicitly at write time.

Trust-weighted graph resolution (perspectival, no global coordinate system):
a reader picks a trust set (root frame + weighted attesters), walks
attestation edges within that set, renders only the resolved subgraph. Two
readers, same attestation pool, different rendered graphs.

---

## 3. Transclusion receipt (ERC-1155)

The paid layer. Licenses a *specific frame* (not a hash — see collision
case), minted to the *citing frame's TBA* (not the human wallet), paid once
per citing frame.

```solidity
interface ITransclusionReceipt is IERC1155 {
    // id = keccak256(abi.encode(citedFrameContract, citedTokenId))
    // balanceOf(citingFrameTBA, id) > 0  ⇒  already licensed, cite freely
    // balanceOf(citingFrameTBA, id) == 0 ⇒  pay-and-mint gate below

    function transclude(
        address citingFrameContract,
        uint256 citingTokenId,
        address citedFrameContract,
        uint256 citedTokenId
    ) external payable;
}
```

`transclude` logic:
1. Compute `id = hash(citedFrameContract, citedTokenId)`.
2. Compute `citingTBA = tbaOf(citingFrameContract, citingTokenId)`.
3. If `balanceOf(citingTBA, id) > 0` → no-op, already licensed. Free re-cite.
4. Else → require payment, run the split cascade (below), mint 1 unit of
   `id` to `citingTBA`.
5. Emit an event carrying both frame identities — this is what an indexer
   watches to build the "who has transcluded me" view, same job EAS serves
   for plain citation, but this one is payment-gated.

Because the id is keyed on `(citedFrameContract, citedTokenId)` — a specific
minted frame — and not on `contentHash`, two independently-authored frames
that happen to wrap identical bytes get two independent ids, two independent
authorship claims, two independent price points. Citing "the sentence" isn't
a thing; citing frame #1's expression of it and citing frame #2's expression
of it are different, unambiguous, separately payable acts.

---

## 4. Split cascade

Fires inside step 4 above, on first transclusion of a given frame only.

```solidity
interface ISplitCascade {
    // Resolves payment across the reference chain: if the cited frame is
    // itself a duplicate/derivative of some authorshipRoot, a fraction
    // routes upstream automatically via 0xSplits, recursively.
    function routePayment(
        address citedFrameContract,
        uint256 citedTokenId
    ) external payable;
}
```

Each frame's split target is either itself (if `isAuthorshipRoot == true`)
or its `authorshipRoot` frame's TBA, which may itself have a split pointing
further upstream. Soulbound authorship anchors the root of every cascade —
the root can't be reassigned, so a reference chain can't be laundered by
inserting a fake upstream claim.

---

## 5. Deep duplicate = recursive transclusion, not a separate mechanism

Duplicating a composite frame into a new container is not a bespoke bulk-copy
operation. It's a walk of the source subtree where, at every node:

```
for each node in sourceSubtree (top-down):
    newFrame = Frame.mint(to: parentContainerTBA, contentHash: node.contentHash)
    TransclusionReceipt.transclude(
        citingFrameContract: thisFrameContract,
        citingTokenId:       newFrame.tokenId,
        citedFrameContract:  node.frameContract,
        citedTokenId:        node.tokenId
    )
```

Every new frame starts at zero balance for every id it needs, since it has
no history — so the cascade fires in full at every level, cost scaling
directly with subtree size. There's no shortcut path; that's intentional,
since it makes "duplicate a deep structure" honestly reflect the amount of
authored content being recreated and correctly pays everyone in the chain,
not just the top-level author.

---

## Open items to settle before wiring into the renderer

- **6551 `implementation` and `salt` choice** — fixed per Frame721 contract,
  or configurable per mint? Affects whether all frames share one TBA
  implementation or can opt into custom account logic later.
- **Payment currency/amount source** — fixed price per frame set at mint,
  bonding curve, or author-set? Not modeled above; `transclude` is `payable`
  but the price logic is a separate policy contract you'll want to keep
  swappable.
- **Container-authority vs authorship boundary** — whoever holds the outer
  frame's NFT controls its TBA's calls, including moving/rearranging
  contained frames. Authorship credit and the split-cascade target must stay
  pinned to `authorshipRoot`, independent of current container ownership, or
  selling a framework silently reassigns credit it shouldn't.
