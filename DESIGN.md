# Stash landing page — design system

## Brief

- **Subject:** Stash, a no-login file-sharing web app built on temporary rooms (files, synced
  clipboard, screen cast, voice notes).
- **Audience:** people moving a file between their own devices across OS boundaries
  (Android ↔ Windows ↔ iOS), and anyone handing a file to a person nearby without accounts.
- **Job of the page:** get a first-time visitor into a room in one click, and make the product
  feel immediate and friendly rather than technical.
- **Stage:** working product, no monetisation, no usage metrics.
- **Constraint (hard):** every claim must be literally true. A prior audit found the page
  claiming "no cloud", "no size limits ever" and "100% direct device transfer", none of which
  the code does. Real limits: 100 MB/file, 10 files/upload, expiry 1 min–7 days (default 24 h),
  rooms deleted after 24 h, files pass through the server to Supabase, **not** end-to-end
  encrypted.

### Assumptions
- No metrics exist, so the page carries no user counts, testimonials or client logos.
- Positioned as a personal utility, not an enterprise product.

### Direction (chosen by the owner)
Playful and eye-catching, light and bright. An earlier dark "half-life / countdown" concept was
built and rejected as too sassy; it has been fully reverted. Keep the tone warm and physical.

## Concept card

```
Idea:        The page is a desk. Files are physical objects you can grab and throw, and
             throwing one across the page is literally what the product does.
Metaphor:    Tossing something to someone across a room. Weight, arc, catch.
Signature:   A hero playground: file chips sit on the desk with real physics. Grab one and
             fling it, and it arcs, tumbles, and lands on the laptop, which catches it with a
             bounce. Flick-to-send is the product demo and the toy at the same time.
Emotion:     First 3 s: "oh, I can touch that." Approachable, tactile, a bit toy-like.
Motion verb: TOSS. Things get picked up, thrown with weight, and land with a settle.
             Overshoot is allowed here (back.out) because real thrown objects bounce.
Screenshot:  A file chip mid-air between phone and laptop, tilted, with a motion arc behind it
             and the laptop already tipping to catch it.
```

**Anchor:** the product's core act is a two-device handoff; the whole app is "put it here, grab
it there". Swap test: put "Notion" or "Dropbox" in the sentence and it breaks, because their
value is storage, not transit. Portability: 2.

**Genericness test:** a generic model asked for a playful file-sharing page would ship a
centered hero, a blue-violet gradient, three rounded feature cards with icons, and floating
blobs. Changed: the hero is an interactive canvas, not a static headline; no gradient (flat
warm paper); no feature cards (an index list and a physical limits strip); the only recurring
graphic is the file chip, which is the product's own object.

## Art direction

**Archetype:** Warm analog crossed with toy. The reference is a bright desk mat and plastic
label-maker chips, not a SaaS dashboard.

**Palette:**
```
paper    #fbf7f0   warm off-white ground
ink      #14161a   near-black text
muted    #5c6069   secondary text (AA on paper: 7.1:1)
line     #e3ddd1   hairlines on paper
blue     #2f4bff   electric blue: primary action, the catch state
coral    #ff5d3a   the thrown object, accents
sun      #ffc53d   highlights, the third chip colour
```
Three toy colours on warm paper. Not a purple-blue gradient, not cream+terracotta serif, not
acid-green. Colour is flat and blocky; no soft shadows, no glassmorphism.

**Type:**
- **Display:** Geist Variable at weight 800, size up to 13rem, tracking −0.045em, leading 0.85.
  Already self-hosted (`@fontsource-variable/geist`), so no new network cost.
- **Data/labels:** Geist Mono Variable for every number and chip label, tabular figures.
- Two cuts of one superfamily: one download, reads as a single system.

**Grid:** 12 columns, gutter `clamp(1rem, 3vw, 2.5rem)`, max 1760px. Three hanging lines:
col 1 (display + labels), col 7 (body), col 10 (data). Outer margin = gutter.

**Rhythm:** four moods, assigned per section, never uniform: tight 6rem, normal 12rem,
airy 20rem, full 100svh.

**Shape:** 10px radius on chips and buttons (toy-like), 0 on rules and the strip. One rule.

**Motion language:** `expo.out` for arrivals (0.9–1.2 s), `back.out(1.6)` for catches and
presses (things that land), 0.3 s `power3.out` for hovers. Stagger 30–70 ms. One clock via
`gsap.ticker`; the physics loop is a ticker callback, never a private rAF.

**Idle state:** the chips drift and settle very slightly at rest, and the laptop breathes a
few pixels. That is the concept itself moving, not decoration. Pauses off screen, and under
reduced motion the chips are laid out statically with no physics.

### Composition plan (a different layout family per section)

```
1 HERO — the playground (family: full-bleed interactive scene)
┌──────────────────────────────────────────────┐
│ ● stash                          open app    │
│                                              │
│  toss it            ╭────╮                   │
│  across.            │IMG │╲                  │
│                     ╰────╯ ╲                 │
│  no account,         [PDF]  ╲   ┌─────────┐  │
│  no install.                 ╲  │ laptop  │  │
│  [ open a room ]    [phone]   ➜ └─────────┘  │
│                                              │
│  grab a chip and throw it →                  │
└──────────────────────────────────────────────┘

2 THREE STEPS — big numerals, asymmetric (family: asymmetric pair)
┌──────────────────────────────────────────────┐
│ 01 ──────────── Drop                          │
│       Drag it in, or paste from clipboard     │
│          02 ──────────── Share                │
│                 Link, QR, or 6 digits         │
│ 03 ──────────── Collect                       │
└──────────────────────────────────────────────┘

3 WHAT A ROOM CARRIES — index list (family: index list)
│ 01  Files        100 MB · 10 per upload     →│
│ 02  Clipboard    last 30 entries            →│
│ 03  Screen       WebRTC cast                →│
│ 04  Voice notes  recorded in browser        →│

4 LIMITS STRIP — one blue band, big numerals (family: data/facts)
┌──────────────────────────────────────────────┐
│ 100 MB │ 10 files │ 24 h │ 6 digits          │
└──────────────────────────────────────────────┘

5 STRAIGHT TALK — two columns, does / does not (family: statement)

6 FOOTER — giant wordmark, real links, honest disclosure (family: finale)
```

## The loader

A fixed 2.5s intro on the landing page: four file chips drop onto a stack while a counter
runs, then the pile is tossed off-screen and the curtain lifts into the hero.

This is a deliberate trade, made at the owner's request. The quality bar caps loaders at 2.6s
and penalises long ones, and a utility page does not normally earn a loader at all. Three
things keep the cost down: a **Skip** control that tweens to the end rather than cutting, a
`sessionStorage` flag so it plays once per tab, and a full bypass under reduced motion.

## The desk

The room's file surface was a grid of cards. It is now a **desk**: files are physical chips
on a cutting-mat surface, coloured by kind, carrying a live expiry countdown. You pick one up
and move it; drag it onto the bin and release to delete. New files drop in from above.

- Positions are **seeded from the file id**, so a chip sits in the same place for everyone in
  the room and never jumps between renders.
- Image chips show the image, behind a scrim that keeps the label legible.
- A **List view** sits behind a toggle and is the default on touch and under reduced motion.
  Dragging is a poor primary interaction there, and the list is what screen readers get: it
  carries a real labelled button per action, including delete.
- The bin is `aria-hidden`; deletion is always reachable from the list.
- Inputs (dropzone, voice) were two 340px-tall cards that pushed the files below the fold.
  They are now a compact row above the desk, because the desk is the room.

## The app shell (rebuilt, not restyled)

The first pass at the app only retuned colour tokens — the 2019 dashboard skeleton survived.
It has now been replaced. What the audit of the old shell found: **eight modals** and a
permanent 260px sidebar, on a product whose pitch is "ten seconds".

- **No sidebar.** Rooms are a switcher pill in the bar. A list of rooms is not worth a
  permanent column on a tool you use for ten seconds.
- **No modals.** Create, join, settings and the room list are inline panels that push content
  down. Nothing traps focus or hides the room behind a scrim. Only two things still float —
  the QR code (you hold a phone up to it) and the unlock prompt (it blocks a download).
- **The room link is always on screen.** Sharing a room is the core act and it used to be two
  clicks deep inside a dialog.
- **Join requests are inline**, because you need to answer them while you keep working.
- **Three modes stay separate.** Files persist, clipboard is a running log, screen share is a
  live stream — they are genuinely different, not three views of one list. They now carry
  live counts, so a clipboard entry arriving is visible while you are on Files.

Removing the modals deleted ~12 pieces of component state and 7 handlers that existed only to
drive them.

## Screen share

Presentation-grade and one-way, deliberately. Added: real resolution readout (read off the
track, not a label), pause, and picture-in-picture for viewers.

Full Zoom-style multi-party was considered and rejected: it needs an SFU and a monthly media
bill to compete with products that are free. See `ROADMAP.md`.

## The app UI

The product shares the landing page's language rather than keeping the stock SaaS theme it
shipped with. Done by redefining the design tokens, not by rewriting ~2,800 lines of markup:
the app is written almost entirely in `slate-*` and `red-500` (≈500 class occurrences), so
those scales were retuned in `@theme` to warm paper greys and the electric blue.

- `slate-400` went from `#90a1b9` (2.51:1, failing AA on nine elements) to `#65625d`
  (5.21:1 on the sidebar's darkest ground).
- `red-500` is now the blue. The token name is kept because ~90 classes depend on it; a
  separate `danger-*` scale carries true warnings.
- Cards took the physical edge: 2px ink border and a hard offset shadow, no soft blur.
- The sidebar wordmark, the room title's display weight and the share button's press
  treatment were aligned to the landing page after a critic read the two halves as
  "two products, and the seam is visible".

## Decisions log
- **No Three.js.** The owner asked for it; I recommended against and they agreed. A 3D scene is
  ~600 KB on a page whose predecessor already measured 5 s mobile LCP against a 2.5 s budget,
  and WPO is a scored area. A 2D canvas with hand-written physics (~15 KB) gives the same
  tactility at 60 fps on a mid-range phone.
- **No loader.** A utility landing page does not earn one; it would only delay the CTA.
  `loaderMs` will be null by design.
- Keeping the existing hand-rolled router in `App.jsx`. Swapping to react-router is out of
  scope and risks the room deep-links.
- Physics is a small bespoke solver (verlet-ish integration, circle-ish collision, floor
  bounce). A physics library would cost more than the whole effect.
