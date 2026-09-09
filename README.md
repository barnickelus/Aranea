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
- **The spider** plays a fixed tune, and it hunts for *notes*, not places: for each note it
  finds every strand that sounds it and takes the one cheapest to reach along the silk —
  real walking distance, not distance across the gap. `hush the spider` stops it; while loops
  are playing it follows and answers them instead of leading.
- **new web** respins everything from a fresh seed — new key, scale, tempo, voice and geometry.
- **spin it true** re-lays the same web so the spider's tune becomes an easy walk. A
  pentatonic scale moves in 2s and 3s, so the layout puts a whole tone on the spoke step and
  a minor third on the ring step: every step of the melody is then one move to a strand the
  spider is already touching — sideways for a 2, inward for a 3 — instead of a hike across
  the web.

  Getting that to hold while the spokes stay uneven takes some fretting. A chord across a
  wedge isn't `2r·sin(w/2)` when the two reaches differ; it's the law of cosines. Length is
  pitch here, so that runs backwards: name the chord each wedge must produce, then solve the
  *angle* that produces it, `cos w = (ra² + rb² − chord²) / (2·ra·rb)`, with one scale factor
  found by bisection so the twelve wedges still close the circle. Both endpoints of a ring
  scale together, so the chord stays proportional on every ring and the grid holds all the
  way out. The visible result is a fretboard bent into a circle — the wedges crowd tighter
  toward the treble, the way frets do up a neck.
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

  Measured over a full verse, spun true costs about **2.0 strands per note** against **2.3–3.7
  wild**, with worst case 4–5 hops against up to 8, and a quarter the walking distance. The
  keyline reports the figure for the web you're on, so the toggle shows its own work.

  Two webs in the same key and scale are identical: the seed picks the key, and the key
  does the rest. All 21 key-and-scale combinations give 21 distinct layouts.
- **octave** shifts the whole web ±2 octaves; the geometry retunes with it (higher webs draw
  tighter and vibrate faster).
- **loops** — tap a track to arm it, then play; the first note starts recording and the take
  closes on a beat-quantized loop length. Tap again to mute, `×` to clear. Up to four tracks,
  all sharing one loop clock.
- **keep this web / kept webs** — snapshots the seed, octave and all four loop tracks to
  `localStorage`, up to 24 of them. Falls back to in-memory storage when localStorage is blocked.

## Silk Studio (experimental)

Tap **silk studio** to play the current web's key and scale on 15 large pads, with
three octave rows. Notes climb left to right; the lowest row is the bass. Choose
any of the five existing sounds directly, then use **Register** to move between
low, middle and high ranges. Pad labels show the actual sounding note and octave;
Studio's register is independent of the web's octave setting.

Play chords with several fingers, slide between pads, or hold for a sustained tone.
Each finger releases independently. On a keyboard, use **Q W E R T**, **A S D F G**,
and **Z X C V B** for the upper, middle and lower rows, or focus a pad and hold
Space or Enter. Changing sound or register releases held notes.

The spider and loops pause while Studio is open and resume when you return to the
web or press Escape. Studio notes are a live instrument and are not recorded into
web loops or saved in kept webs; existing loop recordings and web settings stay intact.

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
