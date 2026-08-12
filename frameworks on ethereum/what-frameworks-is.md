# What Frameworks is

*An explanation from zero. No prior context assumed.*

---

## The one-sentence version

Frameworks is a system where you type a short string of characters, run it
through a command set, and get a structure of frames in space — and both the
string and the command set are things that live on Ethereum, so structures can
contain each other, cite each other, and be paid for.

Everything below unpacks that sentence.

---

## 1. A frame

A frame is the atomic unit:

| Property | What it is |
|---|---|
| **account** | Its identity — a token id |
| **called** | Its name |
| **contents** | The information it holds, as a content hash |
| **components** | Other frames contained inside it |
| **coordinates** | Where it sits — position (xyz) and angle (ijk) |
| **color** | Its position in color space |
| **size** | Its scale |

The first four are what a frame *is*. The last three are where it *sits* — and
those are not absolute. A frame's coordinates are expressed in the space of the
frame that contains it. There is no world. §3 covers this properly; it's the
hinge the whole system turns on.

Visually, a frame is drawn as two sets of intersecting parallel lines — a
crosshatch, like the symbol `#`. Four lines making a window. But that's how it
*renders*, not what it *is*.

## 2. A framework

A framework is a frame that contains other frames. There's no separate type.

> **Everything is a framework. Frameworks are made of frames. It's frameworks
> all the way down.**

A frame with no components is a leaf — it just holds contents. A frame with
components is a framework — its meaning comes from what's inside it and how
those things relate. The same object, viewed at different depths.

This recursion is not decorative. It's the mechanism. A framework can contain a
framework can contain a framework, and at every level the thing you're looking
at is a frame with the same four properties.

---

## 3. Where space comes from

Here is the part that's easy to miss and that everything else depends on.

### Coordinates are relative to the container

A frame has coordinates — position `xyz` and angle `ijk`. But those values are
expressed **in the space of the frame that contains it**. Not in a world. There
is no world.

Every frame is two things at once:

- a thing sitting at coordinates inside its container
- a space, in which its own components sit at their coordinates

So the containment tree is a tree of coordinate systems. To find out where
something actually appears on screen, you compose the transforms down the chain
— frame in frame in frame — until you reach the top. Nothing has an absolute
position; position is always *with respect to* something.

This is why wrapping matters. When you `f` to wrap frames into a new containing
frame, you aren't just grouping them — you're **creating a space**. The wrapped
frames now have coordinates inside the wrapper. Move the wrapper, rotate it,
scale it, and the interior comes along unchanged, because the interior's
coordinates never referred to anything outside it.

It's also why copying is safe. When you pull someone's framework into
yours, it arrives as a component with coordinates in *your* space. Its interior
is untouched and untouchable — your string cannot name the frames inside it,
because their coordinates are relative to a frame whose interior isn't yours.
Compositional independence isn't a rule anyone enforces. It falls out of
coordinates being relative.

### The values come from the string

The coordinates exist, but nothing hands them to you. You get them by running a
**command string** through a **command set**.

```
command string  +  command set  →  frames, with coordinates, in a container
```

A command string is a sequence of single characters — `1fp5fpp2fppp` is a real
one. Each character is an operation. The command set is what says what those
characters mean.

Run the string through the set and it **casts** frames into the framework: it
creates them, gives them coordinates in the container's space, colors them,
names them, writes their contents. Creation and transformation are the same
act. There is no step where frames exist and then get arranged. The string is
what brings them into being *and* what sets their values.

So a container holds two things that together produce its interior: the string,
and the set the string was written for. Run them and the components appear,
positioned relative to that container and to nothing else.

### Why this matters

Because the string is passed *through* a command set, the set determines
everything. The same string through a different set casts a different structure
— not a different view of the same frames, genuinely different frames.

This is what makes command sets valuable and sellable. You are not selling a
filter over someone's art. You are selling the medium that structures get made
of. A better command set means fewer characters to express a given structure,
which means everyone building through it builds more easily.

---

## 4. Contexts

A **context** is a lens — a way of interpreting. There are two kinds, and
they're not peers.

### The command context

The parser. It maps characters to operations. This is the command set described
above. There is one active at a time, and it is what makes a string mean
anything.

### Value contexts

The spaces those operations write into. Each one is a dimension the structure
can move through:

| Context | What moving through it does |
|---|---|
| **coordinate** | Position and angle within the containing frame |
| **color** | Which color a frame is |
| **camera** | How the structure is projected to a flat image |

The important idea: **color is a space you move through, not an attribute you
set.** There's a palette of 80 colors, and the color command navigates it the
same way the translate command navigates xyz. You don't pick `#ff0000`; you
move to a position in color space. Same for camera — you don't set a view, you
move a viewpoint.

### Contexts as atmosphere

Contexts aren't decoration layered on top of frames. They're the medium a
framework has to be in to be perceptible at all.

A frame's coordinates are numbers. They only become a *place* through the
coordinate context, which says what those numbers mean relative to the
container. Its color is an index; it only becomes a color through the color
context. Its position becomes an image only through the camera context. Change
the context and the same values resolve differently — same frame, different
place, different color, different projection.

That's why a framework without contexts is meaningless. Not ugly. *Meaningless*
— the values have nothing to mean anything with respect to.

---

## 5. The command language

Commands are single characters, case-sensitive. Lowercase and uppercase do
related but different things — usually "this frame" vs. "the whole structure."

**Making structure**
```
f / F     frame / reframe — wrap what's selected into a new containing frame
d / D     duplicate
```

**Moving through coordinate space**
```
t / T     translate frame / translate cursor
s / S     scale frame / scale structure
r / R     rotate 90° / rotate 45°
e / E     reflect horizontal / vertical
z / Z     snap cursor to center / snap structure to cursor
```

**Moving through color space**
```
p / P     change palette / select specific index
```

**Moving through camera space**
```
v / V     zoom / perspective
1-0       camera presets (front, right, back, left, top, bottom, orbits)
```

**Writing**
```
w / W     name / contents
```

**Selecting**
```
a / A     select all of color / select all
#         frame selection with modifiers
```

**Repetition**
```
n / N     repeat command / repeat N times
m / M     toggle animation / change interpolation
```

Within any context, the keys `i j k l` are the directional controls — the
context decides what direction means. In coordinate context they move a frame.
In color context they navigate the palette grid. In camera context they orbit.

A string like `1fp5fpp2fppp` reads as a construction: make a frame, change
color, make another, and so on. Read left to right, it's a recording of how a
structure came to be. `(dR,3)` means "duplicate-and-rotate, three times."

The string is minimal by design. It is the smallest way to express a structure,
which is why it's the thing that goes on-chain.

---

## 6. What lives on Ethereum

Three separable layers. Each owns a distinct relationship. They compose but
never merge.

| Layer | Standard | Relationship |
|---|---|---|
| **Containment** | ERC-721 + ERC-6551 | framework → what it holds |
| **Citation** | EAS attestation | framework → framework, declarative |
| **Copy** | ERC-1155 | reader → frame, paid once, covers the subtree |

### Containment

Each framework is an NFT. Each NFT gets an account of its own (this is what
ERC-6551 provides — a "token bound account," a wallet owned by a token rather
than a person).

Containment is then just ownership. A framework contained inside another
framework is *owned by that framework's account*. There is no custom tree data
structure. To ask what's inside something, you ask what its account holds. To
ask what something is inside of, you ask who owns it.

This is why the recursion works cleanly: an account can hold tokens, and those
tokens have accounts, which can hold tokens.

### Citation

Free, declarative, revocable, many-to-many. A citation says "this framework
references that one" — nothing is paid, nothing is copied. It's an assertion
made by the author, recorded as an attestation.

Because citations are declared explicitly rather than inferred, backlinks are
free to query: ask for every attestation pointing at a given framework.

Notably, there's no global truth here. A reader picks whose citations they
trust and walks only those edges. Two readers with the same pool of
attestations see different graphs. The structure is perspectival by design.

### Copy

The paid layer. Copying is pulling someone else's framework *into* yours — not
a reference to it, an inclusion of it.

It's the same act as the `d` key. `d` copies a framework you're holding into
the space you're working in. When what you're copying is your own, that's free.
When it's someone else's, you pay. One verb, one gesture, and the price depends
only on whose work it is.

### It's citation, not licensing

This is the part that decides everything else about how copying works.

A licence is permission you need. A citation is a link you *want*, because the
connection is the value. Nobody cites a paper to obtain permission — they cite
it because being connected to that work is worth something.

Which is why it doesn't matter that **you could always just retype the content
yourself**. If this were licensing, that would be a hole in the scheme. It
isn't. Retyping gives you the same words and none of the connection. The frame
you copied is *someone's*, and the link says so.

The fee isn't payment for access. It's the cost of making the edge real — a
tip, a token, attribution having a price so that it means something. Scientific
papers cite studies; nobody is buying a licence.

### What it costs

**Every frame has a cost, and you pay at the level you grab.**

Copy a whole framework and you pay that framework's cost — and you get
everything inside it. Copy one component from within it and you pay that
component's cost instead. There's no adding up, no per-frame tally. One price
for the thing you took.

- The default is **0.00001 ETH** — small enough to be a gesture rather than a
  toll. Authors set their own cost when they want one.
- **Zero is allowed**, and will be common. Plenty of people want reach more
  than income. At zero the citation still happens and the link is still real —
  the fee was never what made it mean something.
- **Changing a cost is never retroactive.** A citation already paid is settled.
  Prices are safe to change; no debt appears behind you.
- **Once you've paid for a frame, it's yours** — in any composition, any number
  of times, forever, including the frames inside it. The citation belongs to
  you, not to the piece of work you first put it in.

This makes cost a decision about a *bounded thing*. Setting a price on a frame
prices "this, and everything it contains" — so the boundaries you draw with
`f`/`F` are also your price points. Wrapping something is deciding it's a unit
someone can buy.

And it puts granularity in the reader's hands. Want the whole framework? Pay
the top. Want the one part you actually need? Go in and take that, cheaper.
It's how citation already works: you cite the paper, or you cite one figure
from it, and you don't owe separately for every sentence.

### The boundary rule

Copying inside your own framework is free — you're arranging your own material,
and `d` is one keystroke.

Copying in someone else's framework costs — you're crossing into work that
isn't yours.

This is the whole economic model, and it's why the boundaries you draw with
`f`/`F` matter. The unit of authorship is the framework you bounded and
published. Cost scales with whose work you pulled in, not with how many frames
you made.

---

## 7. Contexts are frames too

A command set is itself a framework. Using someone's command set is the same
act as copying their structure — you point at `(contract, tokenId)` and pay the
same way.

This is the self-hosting claim, and it's concrete rather than rhetorical:

- Frameworks are made of frames.
- Contexts are what make frameworks meaningful.
- Contexts are frames.
- So the tool for building frameworks is built in Frameworks.

Practically it means a framework's identity is a **pair**: the string, and the
command set it was written for. `1fp5fpp2fppp` is meaningless without knowing
which set interprets it. So both go on-chain, and command sets must be
permanent and immutable — a framework whose set disappeared isn't degraded,
it's unreadable.

---

## 8. How you actually use it

You open a canvas. You type. Frames appear.

Every keystroke is recorded — the string accumulates as you work, and it *is*
your document. There's no save format separate from the sequence of things you
did.

You compose by nesting: build something, `f` to wrap it into a frame, keep
building around it. What you wrapped is now a single object you can move,
duplicate, and color as a unit — and its interior is intact.

You can enter a framework you've built and work inside it, then come back out.
Each interior is its own coordinate space with its own camera — going in means
the coordinates you type are now relative to *that* frame. Coming out, the
whole interior collapses back to a single component sitting somewhere in the
frame above.

When you're done you mint. The string goes on-chain. Anyone who loads the token
gets the command set, runs the string through it, and the structure casts
itself in their browser. Nobody stores an image. The picture is recomputed
from the instructions every time.

---

## 9. What it's for

The stated aim:

> Allow thinking about dynamic things as if they were static. Allow thinking
> about systems as if they were structures.

Text forces sequence. Diagrams are flat and dead. Frameworks is a place to put
ideas where nesting is real, where relationships have direction and distance,
and where the thing you built can be entered, contained, cited, and built
upon by someone else.

The economics exist so that building on someone's work is a normal act with a
normal price rather than either theft or a negotiation. The recursion exists so
that the tool can improve itself: a better command set is a framework, minted
like any other, that makes every framework built through it easier to make.

> You build the tool to show the vision of the tool so other people can build a
> tool that better articulates that vision — which inspires the next vision and
> tool.

---

## Glossary

**account** — a frame's identity; its token id, and the wallet that token owns

**called** — a frame's name

**casting** — running a command string through a command set to bring frames
into existence

**command set / command context** — the mapping from characters to operations;
determines what a string means

**components** — the frames contained inside a frame

**containment** — holding; implemented as one framework's account owning
another framework's token

**copy** — pulling a framework into yours; free within your own work, and when
it's someone else's you pay the cost of the frame you grabbed, which covers
everything inside it. Citation, not licensing: once paid, it's yours to reuse
anywhere, forever

**contents** — the information a frame holds, stored as a content hash

**context** — a lens; either the parser (command context) or a value space
(coordinate, color, camera)

**coordinates** — a frame's position (xyz) and angle (ijk), always expressed
relative to the frame that contains it, never absolute

**frame** — the atomic unit: account, called, contents, components

**framework** — a frame containing other frames; the same object one level up

**value context** — a space operations move through: coordinate, color, camera
