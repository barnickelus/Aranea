# Aranea

*a web strung to a scale — the spider knows one song*

A single-page, dependency-free instrument. An orb web is spun into the canvas and
every thread is tuned to a note: the spiral rings climb a pentatonic (or hirajoshi)
scale, the radials cross them, and the long frame threads that reach off-screen run
down into the bass.

Open [`index.html`](index.html) — no build step, no packages.

## Playing it

- **Brush the silk.** Drag across the web; each strand you touch is plucked and rings visibly.
- **Hold a strand** and it sings on — after ~0.3s the note opens into a drone, and every
  other thread tuned to the same pitch shivers in sympathy.
- **The spider** walks a fixed melody through the web on its own. `hush the spider` stops it;
  while loops are playing it follows and answers them instead of leading.
- **new web** respins everything from a fresh seed — new key, scale, tempo, voice and geometry.
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
  always spins the same web, which is what makes a snapshot a single 32-bit number.
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
