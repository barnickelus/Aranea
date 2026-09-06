# Aranea

*a web strung to a scale — the spider knows one song*

A single-page, dependency-free instrument. An orb web is spun into the canvas, and
then it is measured. No pitch is ever assigned: every strand sounds what its own length
makes it sound, `f = C/L`, exactly as a stopped string does — so the ratio between any
two strands *is* the interval between them, and the shape of the web is its tuning.
Strands that happen to land on a scale tone are drawn bright; the rest sit dim between
them. A web spans four to five octaves, nearly gapless, so a full compass is playable
off the silk.

Open [`index.html`](index.html) — no build step, no packages.

## Playing it

- **Brush the silk.** Drag across the web; each strand you touch is plucked and rings visibly.
- **Hold a strand** and it sings on — after ~0.3s the note opens into a drone, and every
  other thread tuned to the same pitch shivers in sympathy.
- **The spider** walks a fixed melody through the web on its own. `hush the spider` stops it;
  while loops are playing it follows and answers them instead of leading.
- **new web** respins everything from a fresh seed — new key, scale, tempo, voice and geometry.
- **spin it true** re-lays the same web as an instrument — it shapes the geometry so the
  lengths it contains come out as a playable compass. A chord across a wedge is
  `2r·sin(w/2)` long, and length is pitch here, so the wedge angles *are* the intervals
  around a ring: the twelve wedges are solved so their chords sweep one chromatic octave
  and still close the circle, which makes a clockwise lap of any ring a rising chromatic
  run. Radii climb geometrically, so each ring outward is a fixed three semitones down —
  that is the register axis. Together they give roughly five octaves at 92–96% gapless
  semitone coverage, with all twelve pitch classes present.
  The geometry stays crooked while it does this, and nothing about the crookedness is
  random — every irregularity is a fact about the key read out as shape. Wedge angles come
  from the scale: in-key directions open to about 45 degrees, the chromatic steps squeeze
  to 19 between them. Spoke reach comes from consonance — the Tenney height of each pitch
  class's just ratio to the root, so the unison runs longest, then the fifth and the fourth,
  while the tritone at 45/32 barely reaches at all. Orientation is the root's seat on the
  circle of fifths. The hub then sits wherever centres that shape in the frame, so it lands
  off-centre by exactly how lopsided the key is. The only non-musical term is a 22% downward
  stretch, because every orb web hangs longer below its hub than above.

  Because length is pitch, the reach profile is a musical statement and not only a shape:
  the consonant quarters carry the long strands, so that is where the bass lives, while the
  tritone side runs short and bright. Register is laid out around the hub by consonance.

  Two webs in the same key and scale are identical: the seed picks the key, and the key
  does the rest. All 21 key-and-scale combinations give 21 distinct layouts.
- **octave** shifts the whole web ±2 octaves; the geometry retunes with it (higher webs draw
  tighter and vibrate faster).
- **loops** — tap a track to arm it, then play; the first note starts recording and the take
  closes on a beat-quantized loop length. Tap again to mute, `×` to clear. Up to four tracks,
  all sharing one loop clock.
- **keep this web / kept webs** — snapshots the seed, octave and all four loop tracks to
  `localStorage`, up to 24 of them. Falls back to in-memory storage when localStorage is blocked.

## How it works

- **Web** — a seeded PRNG (mulberry32) places 13–15 spokes × 9 rings, drops a few spiral
  segments for irregularity, and casts 5–7 anchor threads to the viewport edges. The same seed
  always spins the same web, which is what makes a snapshot a single 32-bit number. Spun true
  it drops to 12 spokes — one per pitch class — and every node sits at `reach[spoke] ×
  scale[ring]`: the ring proportions are shared, the reach is not. Rings bow out to the arc
  their wedge would cut, tapering taut toward the rim.
- **Tuning** — one pass over the finished geometry sets every pitch from `f = C/L`, where
  `C` only chooses the register (the longest strand is pinned two octaves under the root).
  Each result rounds to the nearest semitone of the key's grid so the web stays playable,
  and whether a strand reads as in-key is discovered, not decided.
- **Sound** — Web Audio, built per voice: Karplus–Strong plucks rendered into cached buffers
  (`dew silk`, a driven `electric silk` with waveshaper and tempo-synced delay, a detuned
  `twelve-strand`), additive `glass bells`, and a filtered-saw `analog moth`. Everything runs
  through a per-voice chain into a procedural convolution reverb, panned by where the strand
  sits on screen.
- **Motion** — struck segments vibrate as a standing wave on their quadratic curve; the
  spider's eight legs are IK-ish targets lerped in two alternating gait groups, and it routes
  between threads with Dijkstra over the web graph.

Audio starts only after the opening tap — browsers require a gesture before an AudioContext
will run.
