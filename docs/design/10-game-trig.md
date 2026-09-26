# 10 · Game Design Document: The Clockwork Crypt, "The Orrery Terraces" (trigonometry)

| | |
|---|---|
| **Spec** | `fixtures/trig-dungeon.json` (`id: trig_demo_001`, `source.sourceId: src_trig_ch4`, genre `dungeon`). The same six encounter ids appear in `fixtures/trig-platformer.json` ("The Clockwork Run"), so one overlay serves both. |
| **Overlay key** | `spec.id = trig_demo_001` first, then `(src_trig_ch4, dungeon)` and `(src_trig_ch4, platformer)`, per `00-runtime-map.md` §3.3. Per-encounter entries are keyed by encounter id (`e1_radians` … `e6_boss`). The fixture JSON is **not** edited; everything here lives in the side-car `WorldOverlay`. |
| **Biome id** | `orrery_terraces`, with assets in `public/assets/expedition/orrery_terraces/` (manifest format from `02-assets-and-art-pipeline.md` §d) |
| **Guide** | Cog, the astronomer's brass owl (`characters[0]`, `cheerful_sidekick`) |
| **Boss** | The Warden (`characters[1]`, `gruff_guard`) |
| **Reads with** | `01-variant-design-bible.md` (tokens, anatomy, checklist), `00-runtime-map.md` (seams, defects D1–D9), `docs/overnight/wave1-modes.md` and the mode sources (`tuner/oscillator.ts`, `mapper/number_line.ts`, `truth_finder/mimic.ts`, `sequencer/linear.ts`) |
| **Audience** | artist agents (§7), engine agents (§5, §6), content agents (§4, §6), and pipeline designers (§9) |

**Conventions used throughout.**
- **H** is the protagonist's height: **170 px** at the 1920×1080 base canvas, about 15.7 % of screen height (bible §5.1).
- World coordinates are in px at 1080p, with y pointing down.
- Angles are in radians. On-screen rotation is counter-clockwise-positive in the maths and flipped for screen space where noted.
- "Panel" is the React instrument panel. "Bar" is the dialogue bar. "World" is the Phaser side view.
- **f / g / h** colours follow the bible: f `#F5F8F8` white, g `#6FD98E` green, h `#4F92E6` blue.
- Orange `#E2892C` is reserved for player input.
- **Grading is always the mode's `grade()`.** Nothing in this document changes a mode's params, solution, tolerance or feedback. Contraptions only *visualize* the input and replay the verdict.

---

## 1 · Pitch and purpose

### 1.1 Pitch (3 sentences)

*The Orrery Terraces* is a painterly side-view adventure up a canyon temple where every gate, wheel, bridge and
guardian is driven by a sine wave. As Wren, a young courier with a brass sighting staff, travelling with Cog,
the astronomer's clockwork owl, you climb the terraces by setting the angles, periods and solution steps the
machines run on, and you watch each machine swing, lap and lock live as you tune it. Restore the six rhythms,
out-time the clockwork Warden and wake the Orrery before the evening star Vesper sets.

### 1.2 What is broken

At the top of the canyon stands **the Orrery**, a sky-clock the size of a tower. Its turning rings do three jobs:
- They keep time for the valley.
- They drive the **Tidewheels**, which lift water from terrace to terrace.
- They send **starlight** down a network of beams into the crystal groves, which light the canyon at night.

The astronomer **Ilse Vantor** kept the Orrery for forty years. When she left, she sealed her **Star Chart**, the
one instrument that can re-phase the machine, in the Warden's Dome. She set every mechanism on the way to open
only for someone who could read its rhythm. Without her the Orrery slipped out of phase:
- The gates froze mid-turn at wrong angles.
- The Tidewheels stalled and the canals went still.
- The crystal groves are fading from blue to grey.

In art this is literal: dormant machines are desaturated by −40 % (bible §5.3).

### 1.3 What is at stake

Tonight Vesper, the evening star, rises. The Orrery can only be re-phased by setting the Star Chart into its
lens **under Vesper's light**. If the beam network isn't carrying starlight when Vesper sets, the groves go dark
until next year's rising. That means a year with no night light, no water on the upper terraces and no calendar.

### 1.4 What the player restores

There are **six Rhythm Seals**, one per encounter. Each restored seal:
1. repairs the machine in front of you, which becomes the path forward;
2. sends a cyan beam up to the Orrery, where it is visible in the far parallax layer;
3. re-saturates that scene's palette.

By the end:
- the Tidewheels turn and the canals fill terrace by terrace;
- the crystal groves glow;
- the Orrery's rings spin;
- the dome's star map lights one constellation per seal.

### 1.5 Why the concepts are the only way through

The builders, called **the Measurers**, made every mechanism move on `y = A·sin(b·t + c) + d`, and they measured
every bearing as an arc of the sky, in radians. **Brass cannot be forced. It can only be moved in step with the
wave it runs on.** So each obstacle *is* a concept:

| Seal | What's broken in the world | The only fix | Concept (fixture) |
|---|---|---|---|
| 1 · Vesper Dial (`e1_radians`) | The dial doesn't know where Vesper rises, so no starlight can enter the network | Swing its carriage along the rail to the bearing, which is written only in radians: 5π/6 | Radian measure (`c_radians`) |
| 2 · Tidewheel Gate (`e2_period`) | The gate's latch fires at the wrong moment, the ring never comes home and the canal stays dry | Set the latch to fire after exactly one period of `sin(2t)` | Period of `sin(bx)` (`c_period`) |
| 3 · Echo Choir (`e3_amplitude`) | A mimic hides among the singing automata and jams the lift | Compare each singer's trace to the reference wave and expose the one that measures amplitude wrong | Amplitude (`c_amplitude`) |
| 4 · Solving Span (`e4_solve`) | The bridge over the chasm only exists as the steps of a solution | Lay the steps of solving `2sin(x) = 1` in order. The span anchors on **two** pylons, one per solution | Solving `sin x = k` (`c_solve`) |
| 5 · Chime Treasury (`e5_period_review`) | The treasury singers remember the Tidewheel wrong, and one is a mimic | Check each claimed period bracket: a true period holds exactly one cycle | Period review (`c_period`) |
| 6 · Warden's Shield (`e6_boss`) | The Warden bars the Star Door with a shield swinging on `3sin((π/2)t)` | Tune your counter-pendulum's period to the shield's. The big swing is the trap | Period vs amplitude (`c_period`, `c_amplitude`) |

**Rules that follow from this purpose.**
- There is never a quiz screen. Every graded input is a physical setting of a machine.
- Every success is traversal: a stair, a doorway, a lift, a bridge, a stair again, a door.
- Every failure is the machine visibly doing the wrong thing. It never punishes you and never tells you the answer.

---

## 2 · World and biome

### 2.1 Biome summary

A **canyon temple of ancient tech** in the Variant base palette, used almost 1:1. It is built from:
- cream sandstone terraces with gold trim and navy inlay bands;
- concentric-ring machines;
- grey-teal cliffs;
- groves of **blue crystal trees**, with salmon and rust foliage between them;
- turquoise canals with gold flecks.

It is warm, airy and quiet: the valley has been asleep for years. The circle repeats everywhere. Dials, rings,
nodes, lenses, emblems, the objective ring and the scrubber knob all rhyme (bible §5.4). The subject-specific
motif is the **sine wave**, and it appears as:
- engraved wave bands on ring rims;
- wave-shaped balustrade tops;
- lantern flames that rise and fall;
- a wave-crest canal edge.

### 2.2 Palette adaptation (trig-specific tokens on top of the bible §2)

| Token | Hex | Use in this game |
|---|---|---|
| `orrery.beam` | `#6ED2F2` core `#FFFFFF` | starlight beams (bible `crystal.base`), network lines in L1 |
| `orrery.dormant` | ColorMatrix saturation −0.4, brightness −0.06 | every unsolved scene's L3/L4 layers and its contraption |
| `orrery.brass` | `#C99A4A` / hi `#EBC57A` / deep `#8E6428` | Cog, the Warden's joints, gauges (a warmer, more metallic sibling of `gold.base`) |
| `orrery.engrave` | `#B89C78` @ 70 % | engraved wave bands and landmark numerals on stone (= `stone.deep`) |
| `orrery.fog` | `#EDE6F2` @ 85 % → 0 | the fog band that hides Vesper's lens in S1 |
| `vesper.star` | `#FFF4D6` + glow `#F6D27A` | the evening star, the Star Chart |
| `dome.violet` | `#5B4B8A` / `#7E6A9E` / `#B7A2D9` | dusk dome interior, far cliffs in zone 3 |
| `wisp.indigo` | `#6A6CF0` | insight wisps (bible) |
| Chip/pin/UI | bible §2.3 unchanged | the panel is identical in all three games |

### 2.3 Zones and time of day

The level is one continuous climb from the canyon floor to the rim. The sun sinks as you climb, so colour
temperature marks your progress (bible §5.3).

| Zone | Scenes | Time | Sky gradient (L0, top → horizon) | Haze | Mood |
|---|---|---|---|---|---|
| **Z1 Sunward Terrace** | S0, S1, S2 | late morning | `#D8D4CF` → `#E8DCD2` → `#F4E7DA` (bible "day plaza") | white 25 % | calm, bright, pollen in the air |
| **Z2 Crystal Stair** | S3, S4, S5 | late afternoon | `#E9C9C0` → `#F2D8C8` → `#FAE9D8` ("crystal cliffs") | peach 20 % | warm, glittering, long shadows |
| **Z3 Warden's Dome** | S6, S7 | dusk | `#9E86D8` → `#C9A0DE` → `#F2B8D4` (adapted "dusk sea"; no sea) | pink 30 % | hushed, the first stars, Vesper low in the west |

### 2.4 Parallax layers (per zone; factors from bible §5.2)

All layers are SVG rasterized at load (`load.svg(key, url, {scale: devicePixelRatio})`). Tileable layers are
drawn twice and wrapped. Shapes are described left to right as they tile.

**L0 · Sky (factor 0.0).**
- A 3-stop gradient from the zone table, with a 1 px noise dither.
- Two soft **cloud bands**: long horizontal lozenges, white at 35 % with lavender `#E6DDEA` undersides, drifting at 6 px/s and 9 px/s.
- In Z3, a **star field** fades in with top-down alpha 0 → 1 across S6.
- **Vesper** is a 14 px `vesper.star` point with a 90 px soft gold glow. It sits low over the western rim (screen right), visible from S5 on, and its glow pulses at 0.2 Hz.

**L1 · Far canyon (factor 0.15).**
- Mesa silhouettes: flat-topped buttes with vertical fluting, in a single colour per zone (Z1 `#8FA6A0`, Z2 `#C9A99E`, Z3 `#7E6A9E`) plus 40 % haze toward the sky.
- On the far right rim stands the **Orrery tower**: a stepped cream tower (3 tiers, navy bands) crowned by three tilted gold rings (ellipses at 20°, 35° and 50° tilt) around a dome cap. It is dormant (grey) until seals light it.
- **Beam lines**, one per restored seal, are drawn in code. Each is a 2 px `orrery.beam` line from that scene's beam pylon position (projected to L1) up to the tower's crown, animated with a travelling bright dash.
- In Z1 an aqueduct of 6 arches runs along the far cliffs.

**L2 · Mid-far (factor 0.35).**
- **Crystal fields**: clusters of tall turquoise prismatic spires, each 3-tone (`crystal.hi` / `base` / `shade`) with lighter facets toward the upper-left sun, 20 % haze.
- **Tree masses**: rounded canopy blobs in `foliage.blue` `#5A95D6` / hi `#8CC0EE` alternating with `foliage.salmon` `#E48C5E` / hi `#F4AE80`.
- **Distant arch ruins**: cream arches with navy capitals, half-buried.
- A **thin far waterfall** with a mist puff at its base (Z1, Z2).

**L3 · Mid (factor 0.6).**
- **Cliff walls** of stacked grey-teal blocks (`rock.base` `#5F7B7A`, lit tops `#8FA6A0`, shadowed undersides `#3F5857`) with crystal clusters growing from the cracks, as in 10.png.
- **Terrace retaining walls**: cream stone, a 14 px navy band 40 px below the cap, a gold cap line and round medallions every 320 px.
- **Colonnades** with salmon vines hanging from their lintels.
- A **main waterfall** in S5 whose two scrolling bands animate the flow.
- In Z3, the dome's inner wall: ribs converging upward and a ceiling star map (A22).

**L4 · Play (factor 1.0).**
- Ground strips: cream polygon paving with a gold lip, teal grass edges overhanging the paving, sand paths and canal channels.
- Stairs, ledges, consoles, contraptions, NPCs, the player and pickups.
- Contact shadows under everything: a blurred ellipse, `#6E7F9A` at 30 % multiply.

**L5 · Foreground (factor 1.3, 2 px blur, 70 % alpha, darker by 15 %).**
- Grass clumps, salmon and blue leaf clumps, a cream **balustrade** with a navy rail cap and wave-crest top, emblem posts, and a blurred crystal shard.
- At least one L5 element crosses the bottom edge in every scene. It never overlaps a contraption's bounding box (the host checks this and culls any overlap).

**L6 · Light (factor 1.0, screen-space).**
- A **leaf-dapple** multiply overlay (blue-grey, 25 %) drifting at 4 px/s in Z1 and Z2.
- **God rays**: 3 additive gradient quads from the upper-left at 12 % in Z1 and 18 % in Z2.
- A dusk **vignette** at 20 % in Z3.

### 2.5 Weather, particles and ambient motion

| Zone | Particles (emitter settings at 1080p) | Ambient motion |
|---|---|---|
| Z1 | **pollen motes**: 16 px soft dots, `#FFF4D6` @ 60 %, 12 alive, drifting up-right at 10–20 px/s with sine wobble. **salmon leaves** (A74): 3 alive, falling at 40 px/s with 0.6 Hz rotation wobble, from any salmon tree in view | L5 foliage sways ±2° at 0.3 Hz. Canal highlights scroll at 18 px/s. Cloud bands drift. Crystal glints: a random crystal gets a 0.4 s additive sparkle every 3–5 s |
| Z2 | **crystal dust**: 4-point sparkles (A72), 20 alive, near crystal clusters, 1.2 s life. **Waterfall mist**: 4 mist sprites looping at the falls' base | Crystals hum. Lanterns on the Crystal Stair have flames whose height is `10 + 4·sin(2π·t/1.5)` px, a period-and-amplitude joke Lumen points out |
| Z3 | **star motes**: 1–3 px points rising slowly from the dome floor, 30 alive, `#FFFFFF` @ 50 %. **Fireflies**: 6 `glow_radial_gold` dots on Lissajous paths `(sin 0.7t, sin 1.1t)` | Rim Gantry gears swing on visible periods (see S6). The star field twinkles (per-star alpha `0.6 + 0.4 sin(ω_i t)`) |

Solved scenes gain 2× crystal sparkles and a slow blue glow on the groves. Dormant scenes run particles at 50 %.

### 2.6 Level profile and camera

```
 y (px)          S6 Rim Gantry ─┬─ S6 Warden's Dome ─[Star Door]→ S7 (outro)
  1100 ─────────────────────────┘  x 17600 ─────────── 23000
                         S5 stair extends (e5) ↗
  1500            S5 Treasury ───┘ x 16000–17600
                 ↗ Crystal Stair climb (built steps exist from start, 0.5H each)
  2100    S4 ledge ═[chasm 900px: Solving Span e4]═ far ledge → S5  (x 11200–14000)
          ↑ Echo Lift (e3)
  2600  S2 Tidewheel Gate (e2) ─── S3 Hall of Echoes ─┘ (x 5600–11200)
        ↑ spoke-stair (e1)
  3000  S0 Sunward Landing ── S1 Vesper Court ─┘  (x 0–5600)
```

- **Camera:** it follows the player with a horizontal deadzone of 30 % × 20 %, lerp 0.08, zoom 1.0. When the panel opens, the camera tweens (280 ms, ease-out cubic) so the contraption's anchor sits at the centre of the visible world area: 0.295 × width in Scrub mode, 0.225 × width in Board mode.
- **Movement:**

  | Verb | Input | Value |
  |---|---|---|
  | Walk | A / D or arrows | 280 px/s |
  | Run | Shift | 420 px/s |
  | Jump | Space | height 1.1 H = 187 px; horizontal reach about 330 px |
  | Interact | E | |
  | Map | M | |
  | Info | I | |

- **Obstacles are real colliders until solved** (fixes D7). Each payoff is the *only* way on:

  | Payoff | Obstacle it gets past |
  |---|---|
  | S1 spoke-stair | a 400 px (2.35 H) rise |
  | S2 gate | a wall |
  | S3 lift | a 500 px (2.9 H) rise |
  | S4 span | a 900 px (5.3 H) gap |
  | S5 stair extension | a 400 px rise |
  | S6 Star Door | a wall |

- **World state is derived from runner progress** (`solvedEncounterIds`, fixes D3). On load or after `skipTo`/`autoSolve`, every solved contraption is posed in its solved state, with no animation.

### 2.7 Scenes (8)

Each scene lists its layout chunk(s) from `spec.layout.chunks`, so the overlay maps 1:1 onto the fixture.

#### S0 · Sunward Landing *(chunk `d_start`, Z1, x 0–3200, floor y 3000)*
- **Sees:** the canyon floor at late morning.
  - A cable-gondola platform (cream, gold rail) at x 200, where the intro gondola docks.
  - A turquoise canal (still, no flow) runs along the back of the play strip.
  - A blue crystal tree at x 900 and salmon trees at x 1500 and 2400.
  - A dormant **beam pylon** at x 2800: a cream pylon, 3 H, with a grey orb socket.
  - At x 1200, a **Sighting Telescope** points at the far Orrery tower.
- **Contraption:** none. It is the tutorial space.
- **NPCs:** **Cog**, wound down on the beam pylon's capital (the intro "wind the key" interaction).
- **Side content:**
  - **Journal Page 1** "The Builders' Measure", on a lectern by the gondola.
  - The **Plaque of the Measurers** at x 600 (lore, §6.3).
  - The telescope's first look: the tower dark, 0 of 6 beams.
- **Traversal teach:** a 0.9 H step-up at x 1800 (teaches jump) and stepping stones across a dry canal channel at x 2200.
- **Exit:** walk right into S1.

#### S1 · Vesper Court *(chunk `d_altar_room`, `e1_radians`, Z1, x 3200–5600, floor y 3000 → upper terrace y 2600)*
- **Sees:** a sunken court with a **huge upright stone dial**, the Vesper Dial (3.3 H diameter), set into a cream retaining wall.
  - A gold rail rings the dial.
  - The **upper terrace** runs above it: its edge is 400 px higher, and nothing on the ground reaches it.
  - A **fog band** (`orrery.fog`) hangs across the canyon rim above and to the upper-left of the dial.
  - The console stands at x 4300, 1.2 H left of the dial.
  - **Brasswick**, a gardener automaton, waters a crystal tree at x 3700 with an arm that swings in and out on a period that is visibly too short.
- **Contraption:** **Vesper Dial** (§5.1).
- **NPCs:** Brasswick (micro-quest §6.4), plus Cog.
- **Side content:**
  - **Insight Wisp 1** floats behind the crystal tree at x 3550, on a 1 H ledge.
  - **Journal Page 2** "Vesper's Bearing" appears on the upper terrace after the stair forms.
- **Payoff:** the dial rotates and five gold **spoke-ledges** slide out of its rim into a spiral stair up to the terrace (§5.1).

#### S2 · The Tidewheel Gate *(chunk `d_door_room_a`, `e2_period`, Z1, x 5600–8000, floor y 2600)*
- **Sees:** an upper terrace with a dry canal leading to a massive **ring gate** at x 7400.
  - The gate is set in a cream-and-gold wall with vertical navy grooves (the 5.png wall).
  - A **counterweight** hangs on a bronze track beside the gate.
  - The dry canal bed runs under the gate.
  - A **tally wheel** sits above the gate's keystone fin.
  - The console stands at x 6900.
  - Salmon trees behind the wall; the blue grove visible over it.
- **Contraption:** **Tidewheel Gate** (§5.2).
- **NPCs:** Cog. Brasswick's line carries over when the water returns (he's visible back in S1 through a window arch).
- **Side content:** **Journal Page 3** "The Tidewheel Log", given by Brasswick after e2 (the player walks back down the spoke-stair; it's a short trip).
- **Payoff:**
  - The ring laps once and the notch locks at 6 o'clock, which opens a 0.9 H × 1.3 H doorway.
  - The keystone fin splits and water floods through into the canal.
  - A floating **canal skiff** now bobs in the doorway canal. The player walks through the doorway along the canal edge; the skiff is scenery that rides alongside.

#### S3 · Hall of Echoes *(chunks `d_hall` + `d_treasury`, `e3_amplitude`, Z2 begins, x 8000–11200, floor y 2600 → 2100)*
- **Sees:** the light turns peach.
  - A long colonnade hall (L3 colonnade with hanging salmon vines) opens into a round court.
  - Three **Echo Automata** stand there: bell-chested choir automata on low plinths, about 2.5 H tall. Each has a brass plaque and a small slate on its chest.
  - A **Tuning Lens** pedestal emitter sits in front of them.
  - The **Echo Lift**, a brass platform on chains, sits at the court's right end. Its gear is jammed and the platform rests on the floor. The ledge above (y 2100) is out of reach.
  - **Quill**, a scribe-beetle, sits on a stack of stone tablets at x 8600.
- **Contraption:** **Echo Choir** (§5.3).
- **NPCs:** Quill (collector micro-quest §6.4); the **Mimic** (revealed on success).
- **Side content:**
  - **Insight Wisp 2** sits on top of the colonnade lintel, reached by jumping from a plinth at x 9300.
  - Quill's lore line about Ilse.
- **Payoff:** the exposed mimic scuttles out of the gear housing and the lift rises. The player rides it up (y 2600 → 2100).

#### S4 · The Chasm of Two Answers *(chunk `d_door_room_b`, `e4_solve`, Z2, x 11200–14000, floor y 2100)*
- **Sees:** a cliff ledge ending at a **900 px chasm**. Mist rises from below and blue crystal roots cling to both cliff edges.
  - Four elliptical **span sockets** float over the chasm, dormant, in a gentle arc.
  - On the far bank stand **two anchor pylons** with dark beacon crystals. They carry pins **"x₁"** and **"x₂"**, which state that two anchors are needed.
  - A brass **plank cradle** holding five glyph stones stands beside the console at x 12000.
  - Far below (L3), the Tidewheel canal's water now glints, a visible link to seal 2.
- **Contraption:** **Solving Span** (§5.4).
- **NPCs:** Cog.
- **Side content:** **Journal Page 4** "Two Doors", on the far bank beside pylon x₂ (reachable only after crossing).
- **Payoff:** the span locks and both pylons ignite. The player walks across.

#### S5 · Crystal Stair and Chime Treasury *(chunks `d_hall` + `d_treasury`, `e5_period_review`, Z2, x 14000–17600, floor y 2100 → 1500 → 1100)*
- **Sees:** a grand stair of built steps (0.5 H each) climbs up through a crystal grove, lit by **Lumen**'s lanterns.
  - A **waterfall** falls down the cliff at x 15000. Behind it is a hidden grotto, sealed until all three wisps are found.
  - At the top (floor 1500) is the round **Chime Treasury**: three more Echo Automata in treasury livery (gold-leaf bells), a Tuning Lens, and a great **Treasury Chest** on a dais.
  - Behind the dais, the **rim stair** is retracted into the cliff. Its steps are visible as flush slots. The rim is 400 px up.
  - Vesper appears low in the western sky from here on.
- **Contraption:** **Echo Choir, Treasury variant** (§5.5).
- **NPCs:** Lumen (lamplighter, micro-quest §6.4); the second Mimic.
- **Side content:**
  - **Insight Wisp 3** is behind a lantern at x 14600.
  - **Journal Page 5** "Reach and Rhythm" is in the Treasury Chest.
  - The **secret grotto**: the Astronomer's Music Box (§6.6).
- **Payoff:** the chest opens (the Warden's key-stone and Page 5) and the rim stair slides out step by step. The player climbs to the rim.

#### S6 · Rim Gantry and the Warden's Dome *(chunk `d_boss_hall`, `e6_boss`, Z3, x 17600–23000, floor y 1100)*
- **Sees:** the Rim Gantry first (x 17600–20000). This is the idea folded in from `trig-platformer.json`, "a crumbling clockwork gantry racing along the observatory's outer rim".
  - It is a non-graded platforming stretch.
  - Three **swinging gear-platforms** hang on arms whose horizontal offset follows `x = 120·sin(2π·t/Tᵢ)` with periods 1.5 s, 2.5 s and 3.0 s.
  - Their periods are shown on small brass plaques ("T = 1.5", "T = 2.5", "T = 3"), so timing jumps literally means reading periods. None of them is 4: the gantry must not give away the boss's answer.
  - A missed jump drops the player onto the gantry's lower walkway, 1 H down, with a ladder back up. There is no damage and no death.
- Then the **Warden's Dome** (x 20000–23000), a cathedral-like dome interior at dusk with the unlit star map on its ceiling:
  - **The Warden**, a 5.5 H clockwork sentinel, stands before the **Star Door**.
  - Its **shield**, 2.4 H across, swings left and right across the door on a pendulum arm, in real time.
  - At the console stands a gold **counter-pendulum** pylon: the player's instrument.
- **Contraption:** **Warden's Shield** (§5.6).
- **NPCs:** the Warden (boss) and Cog.
- **Side content:** none in the arena, which keeps the focus. The gantry has one optional ledge with a view of all six beams reaching the Orrery tower. This is the "sighting" moment before the boss.
- **Payoff:** the Warden kneels, the shield freezes open and the Star Door opens.

#### S7 · The Orrery Wakes *(outro, no chunk; the finale phase, see §4.5)*
- **Sees:** a scripted camera sequence.
  - Wren carries the Star Chart through the Star Door onto the Orrery platform under Vesper.
  - The chart slots into the great lens.
  - The six beams converge on the lens and the rings spin up.
  - The camera pulls back and down the whole canyon: canals fill terrace by terrace, groves re-saturate and the dome's constellations light.
  - Ilse's recorded voice plays from the chart as a constellation-line projection. She is shown as an outline of stars, not a portrait.
- The EndScreen follows (keep its `end-screen` test id and `<h1>`).

---

## 3 · Characters

### 3.1 Protagonist: Wren (courier-apprentice)

**Look (side view, 1 H = 170 px):**
- **Body:** slim; medium-brown skin (`#A8714F`, shade `#8A5A3E`); dark hair (`#2B2A33`) tied in a short high bun with a gold pin; large dark eyes.
- **Clothing:**
  - a cream tunic (`#F2E3C6`) under a navy vest (`inlay.navy` `#27466A`) with a gold buckle;
  - a long teal scarf (`#4FA3A0`, hi `#7CC7C0`) that trails 0.4 H behind in two tails;
  - dark-teal trousers (`#2F5A5E`) and tan boots (`#C69A6B`);
  - a brown leather satchel (`#8A5A3E`) on the back hip.
- **Tool:** the **sighting staff**, a brass rod (`#C99A4A`) 1.1 H long carried diagonally, topped with a small astrolabe ring (two concentric gold rings). The ring glows cyan when a console is in range and spins on celebrate.
- **Silhouette test:** the bun, the scarf tails and the diagonal staff must read at 1 H against the busy L3.

**Rig:** an SVG puppet with named pivots (18 parts, §7.13). If the puppet slips, the fallback is Kenney `toon-characters` "Female adventurer" pose PNGs, tinted with a scarf overlay sprite (02 doc).

| Animation | Frames / method | Duration | Notes |
|---|---|---|---|
| `idle` | part tweens | loop 2.4 s | breath scale 1.00 → 1.02 on the torso; scarf tails sway ±6°; blink every 3–5 s (2 frames) |
| `walk` | 8-key cycle | 0.8 s | leg swing ±28°, arm counter-swing ±18°, staff bob ±3 px, scarf trails +15° |
| `run` | 6-key cycle | 0.55 s | lean 8°, scarf fully horizontal |
| `jump` | anticipate / rise / apex / fall / land | 0.12 / var / 0.1 / var / 0.14 s | knees tuck at apex; land squash 6 % with a dust puff |
| `climb_step` | 2 keys | 0.35 s per step | used on built stairs and spoke-ledges (auto-step up to 0.6 H) |
| `interact` | 3 keys | 0.4 s, then hold | reaches the staff toward the console; the astrolabe ring glows; holds while the panel is open |
| `think` | 2 keys | hold | hand to chin; plays while the hint panel is open or after a failed Verify (1.2 s) |
| `celebrate` | 4 keys | 1.2 s | staff raised overhead, ring spins 2 turns with a cyan flash, small hop; plays after every success badge |
| `ride` | 1 key | hold | knees bent 10°, for the lift and the finale platform |
| `wind` | 3 keys | 1.5 s | intro only: winds Cog's key (hands rotate) |

**Voice:** Wren is **silent** and expresses through animation plus small emote bubbles (`!`, `?`, `♪`,
48 px, white on `ui.card.deep`). This keeps the bar for the guide's lessons and avoids a second voice.

### 3.2 Guide: Cog (the astronomer's brass owl)

**Look (0.35 H tall, hovers at Wren's shoulder, offset (−40, −150) px, trailing with lerp 0.1):**
- **Body:** a round brass body (`orrery.brass`) with a **glass belly window** showing two turning gears (they spin faster when he talks).
- **Head:** two big round **lens eyes** (gold rims, cyan glass irises `#6ED2F2`, white catch-light) and ear tufts shaped as three gear teeth each.
- **Wings:** layered brass feather plates with a navy inlay stripe.
- **Feet:** small talons, tucked while flying.
- **Back:** a wind-up key.

**Motion:**
- Wing flap bob ±5 px at 1.6 Hz.
- While speaking, his eyes glow brighter and the belly gears spin 2×.
- He pulses in time with the bar's emblem when a line types on.

**Personality:** fussy, warm and delighted by precision. He is proud of Ilse, fond of the machines and gently
funny ("Hoo!" as punctuation, no more than one owl joke per scene). He never gives the answer before the hint
ladder allows it. After every success he says an **insight line**, one declarative truth about the world.

**Voice archetype:** `cheerful_sidekick` (fixture).

**Emblem (dialogue bar, 64 px):** bible style, three concentric **broken** rings.
- The outer ring is gold `#D9A441` with 2 gaps; the middle ring is white with 3 gaps; the inner ring is white with 1 gap.
- A pair of small filled circles in the centre suggests owl eyes.
- It sits on a `ui.card.deep` disc.

### 3.3 Minor NPCs and other speakers

| Id | Name | Role | Look | Voice | Emblem in bar | Purpose |
|---|---|---|---|---|---|---|
| `warden` | The Warden | clockwork guardian of the chart (fixture, boss) | 5.5 H sentinel. Cream stone plates over brass joints. Domed helmet with a single horizontal visor slit glowing cyan. Column-like legs on a plinth. Right arm holds the pendulum shield. Desaturated until S6's arena trigger | `gruff_guard` | bronze ring with a vertical slit | boss; voices the amplitude trap |
| `brasswick` | Brasswick | gardener automaton (S1) | 0.9 H. Barrel body on treads, a copper watering can on a long jointed arm, a round head with one lens and a tiny straw-hat-shaped cap (cream). Moss on his shoulders | `nervous_scholar` | green-rimmed ring with a leaf gap | period intuition micro-quest; gives Page 3 |
| `lumen` | Lumen | lamplighter automaton (S5) | 1.2 H, slender. A pole-arm with a flame hook; a head that is a glass lantern with a live flame (flame height is itself a sine). Navy coat plates | `wise_mentor` | gold ring with a flame gap | amplitude/period banter; hints the secret |
| `quill` | Quill | scribe-beetle archivist (S3) | 0.3 H beetle with a lacquered navy shell, gold edge, and a quill feather held in its mandibles. Rides on the player's satchel once met | `narrator` | white ring with a nib mark | collects Journal Pages |
| `mimic` | The Mimics | impostors in choir shells (S3, S5) | revealed as 0.6 H clockwork crabs: brass shell, six thin legs, two stalk eyes (cyan), one oversized pincer shaped like a measuring caliper | `sly_villain` | broken ring with a jagged gap | voice the misconception on exposure |
| `ilse` | Ilse Vantor (recorded) | the astronomer, absent | only as a constellation-line figure in S7 (white star points joined by 1 px lines) and as handwriting on Journal Pages | `wise_mentor` | star in a ring | outro closure |
| `narrator` | (narrator) | intro and outro cards | none | `narrator` | the game's title emblem (orrery rings) | frame |

`spec.characters` holds only `cog` and `warden`. The overlay declares a `cast` list for the other speakers.
The bar resolves `speakerId` against `spec.characters` first, then against `overlay.cast` (fixes D6).

---

## 4 · Story arc and dialogue

### 4.1 Structure

| Act | Zone | Encounters (fixture roles) | Dramatic function |
|---|---|---|---|
| Prologue | S0 | none | wake Cog, see the dark Orrery, learn to move and interact |
| **Act I · Teach** | Z1 (S1, S2) | `e1_radians` (teach), `e2_period` (teach) | learn the instruments: a single scrubber drives the world |
| **Act II · Teach + apply** | Z2 (S3, S4) | `e3_amplitude` (teach), `e4_solve` (teach) | compare waves, build procedures; first mimic, first bridge |
| **Act III · Review + Boss** | Z2 → Z3 (S5, S6) | `e5_period_review` (review), `e6_boss` (boss) | recall the Tidewheel lesson under disguise, then face the guardian who combines period and amplitude |
| Epilogue | S7 | none (finale phase) | the world restored; Ilse's thanks; EndScreen |

**Escalation framing:** Cog names it the way Variant does, for example "This is the trickiest singer yet" or
"The Warden trusts only timing".

### 4.2 Line format and triggers

- Every line is at most **140 characters** and at most 2 lines in the bar. Text types on at 45 chars/s; Space or a click completes it.
- Id convention: `<scene|enc>.<slot>`.

| Trigger | Where it shows |
|---|---|
| `explore` | the bar in Explore mode, as a non-blocking 1-line toast that auto-dismisses after `max(3 s, length / 15 s)` |
| `approach` | the player enters the contraption's trigger zone (1.5 H from the console). Plays once |
| `instruction` | the bar's first line when the panel opens. It stays until replaced |
| `tutorial` | the second line, first panel only |
| `hint1..3` | the info button (i), shown in the guide's voice. Content matches the fixture's `hints[]` tier by tier. The fixture hint text stays available verbatim in the brief (§5.0) |
| `probe.*` | a contraption-detected misconception state after a failed Verify (§5.0). Never reveals more than hint 1 |
| `fail.*` | shown with the `grade()` feedback string after a failed Verify |
| `success` | the insight line (bible style) that replaces the instruction when the badge shows |
| `success2` | the payoff line while the world animates |
| `after` | Explore toast after the panel closes |

- **Fixture lines are reused verbatim.** `narrative.intro[0]`, `outro[0]` and all three `beats` are included below and marked **(fixture)**. The fixture's `debriefLine` per encounter stays for the EndScreen debrief.
- **The answer-placeholder ban applies** (LIBRARY §9.3). Lines marked `approach`, `instruction`, `tutorial`, `hint1` and `fail.*` never state the answer. Only `hint3`, `success`, `success2` and `after` may.

### 4.3 Intro cutscene (≈ 35 s, skippable with Esc; the `intro` phase before `walking`)

| Shot | Visual (camera, layers) | Duration | Line |
|---|---|---|---|
| 1 | Black. The title wordmark "The Orrery Terraces" fades in over the Z1 sky gradient; the subtitle "The Clockwork Crypt" sits beneath | 3 s | `intro.01` |
| 2 | Slow pan down the canyon from the rim: the L1 Orrery tower is grey and its rings still; the L2 crystal groves are desaturated; the canal is still | 6 s | `intro.02`, `intro.03` |
| 3 | A gondola glides in on a cable from the left (L4) and docks at S0; Wren steps off; idle | 5 s | `intro.04` |
| 4 | Wren walks to the beam pylon (the player now has control: "E" glyph on Cog). The player presses E: the `wind` animation plays, Cog's eyes flicker on and he flutters down | player-paced | `intro.05`, `intro.06` |
| 5 | Cog hovers and turns toward the telescope; the camera nudges to show the far tower | 6 s | `intro.07` **(fixture)**, `intro.08`, `intro.09`, `intro.10` |
| 6 | The HUD objective ring appears top-left with 6 empty segments and the label "Rhythms 0/6"; the tutorial toast appears | 3 s | `intro.11` |

### 4.4 Dialogue script

Speakers: **Cog** (guide), **Narr** (narrator), **Warden**, **Brasswick**, **Lumen**, **Quill**, **Mimic**, **Ilse**.

#### Prologue (S0)
- `intro.01` · Narr · cutscene · "Above the canyon, the Orrery once turned the sky's rhythms into light, water and time."
- `intro.02` · Narr · cutscene · "Then the astronomer Ilse Vantor sealed her Star Chart away, and the great machine fell out of step."
- `intro.03` · Narr · cutscene · "Gates froze mid-turn. The Tidewheels stalled. The crystal groves began to fade."
- `intro.04` · Narr · cutscene · "Tonight the evening star Vesper rises, and a courier named Wren has come to answer an old letter."
- `intro.05` · Cog · after winding · "Hoo! Hoo... oh! Someone wound me. Nobody has wound me in years."
- `intro.06` · Cog · cutscene · "Cog, at your service: assistant to Astronomer Vantor, measurer of arcs, and very good at owling."
- `intro.07` · Cog · cutscene · "Hoo! The astronomer's crypt runs on rhythm. Read the rhythm, and every door will open." **(fixture)**
- `intro.08` · Cog · cutscene · "Six rhythm seals hold the Orrery still. Each one we restore sends a beam of starlight up to it."
- `intro.09` · Cog · cutscene · "Her Star Chart waits in the Warden's Dome at the top of the canyon. We need it before Vesper sets."
- `intro.10` · Cog · cutscene · "You can't force brass. You move it in step with the wave it runs on. I'll show you how."
- `intro.11` · Cog · explore · "Walk with A and D, jump with Space. When a console glows, press E and its instruments open."
- `s0.01` · Cog · explore (near plaque) · "A Measurers' plaque. Press E to read it. They wrote everything down, bless their gears."
- `s0.02` · Cog · explore (telescope) · "That tower on the rim is the Orrery. Dark as a snuffed lamp. Every beam we light, you'll see arrive."
- `s0.03` · Cog · explore (dry canal) · "This canal should be running. The Tidewheels lift water up the terraces, when they turn."

#### Seal 1 · Vesper Dial (`e1_radians`, S1)
- `e1.approach` · Cog · approach · "The Vesper Dial! It tells the Orrery where the evening star rises. Its carriage is parked at sunrise."
- `e1.approach2` · Cog · approach · "Fog hides the star's lens, so we can't aim by eye. The dial only knows the bearing in radians."
- `e1.instruction` · Cog · instruction · "Swing the carriage along the rail to 5π/6 so Vesper's light can find its lens."
- `e1.tutorial` · Cog · tutorial · "Drag the orange knob or use the arrow keys. Only quarter marks are labelled; count the small studs."
- `e1.hint1` · Cog · hint 1 · "A full lap of the rail is 2π, so π is only halfway round. Hoo, that's the whole trick."
- `e1.hint2` · Cog · hint 2 · "5π/6 is a little less than π. Count the studs in sixths of π, starting from sunrise."
- `e1.hint3` · Cog · hint 3 · "It sits between the top mark, π/2, and the halfway mark, π, closer to halfway."
- `e1.fail.short` · Cog · fail (short) · "The beam hit fog. The carriage stopped short; count the gaps from sunrise again."
- `e1.fail.past` · Cog · fail (past) · "Past it! The light's scattering off the rim. Walk the carriage back and recount the sixths."
- `e1.probe.fullturn` · Cog · probe (θ ≈ 5π/3) · "That's five-sixths of the whole rail. Is π the whole circle, or only half of it?"
- `e1.success` · Cog · success (insight) · "A radian is a walk, not a turn: π carries you exactly halfway round any circle."
- `e1.success2` · Cog · payoff · "Vesper's lens! And the dial is turning its spokes into a stair. Up we go!"
- `e1.after` · Cog · after · "One rhythm restored. See that beam climbing to the rim? The Orrery felt it."

#### Brasswick (S1, micro-quest)
- `bw.01` · Brasswick · talk (before e2) · "Oh! A visitor. Oh dear. My arm swings as far as ever, but it keeps coming back too soon."
- `bw.02` · Brasswick · talk (before e2) · "The Tidewheel used to set my rhythm. Since it stopped, I water the air. The crystals are disappointed."
- `bw.03` · Brasswick · talk (after e2) · "Water! And my arm's in step. It never needed a longer swing, only the right period."
- `bw.04` · Brasswick · talk (after e2) · "The astronomer left this page in my watering can. I didn't read it. I read it twice."

#### Seal 2 · Tidewheel Gate (`e2_period`, S2)
- `e2.approach` · Cog · approach · "The Tidewheel Gate. Its ring runs on y = sin(2t). It must lap once and lock, or the canals stay dry."
- `e2.before` · Cog · approach · "Those rings spin on a sine wave. Watch how fast, not how far." **(fixture)**
- `e2.instruction` · Cog · instruction · "Set the latch timer to one full period, so the ring's notch comes home and the gate locks open."
- `e2.tutorial` · Cog · tutorial · "The ring shows where it'll be when the latch fires. The green ghost is the wave, shifted by your timer."
- `e2.hint1` · Cog · hint 1 · "A period is how long the ring takes to come back to where it started, moving the same way."
- `e2.hint2` · Cog · hint 2 · "For y = sin(b·t), one period lasts 2π/|b|. The 2 in sin(2t) is b."
- `e2.hint3` · Cog · hint 3 · "Here b = 2, so divide 2π by 2."
- `e2.fail.long` · Cog · fail (too long) · "The latch waited too long: the ring kept going past home and the catch slipped. One lap is all it wants."
- `e2.fail.short` · Cog · fail (too short) · "Too soon! The notch hasn't come home. A faster wheel still needs one whole lap."
- `e2.probe.half` · Cog · probe (T ≈ π/2) · "Half a lap: the wave's back at zero, but heading down. A period ends moving the way it began."
- `e2.probe.double` · Cog · probe (T ≈ 2π) · "Two laps! The tally counts two. The gate wants one lap, not the lap of plain old sin(t)."
- `e2.success` · Cog · success (insight) · "Speed up the wheel and every lap gets shorter: double b, and the period halves."
- `e2.success2` · Cog · payoff · "Hoo-hoo! Listen to that water. The Tidewheel's turning again."
- `e2.after` · Cog · after · "Two rhythms. Brasswick's arm should be back in step. He's been waiting on that water."

#### Seal 3 · Echo Choir (`e3_amplitude`, S3)
- `s3.01` · Cog · explore (hall) · "Warmer light up here. The Crystal Stair is close. Keep an ear out: this hall sings."
- `qu.01` · Quill · talk · "Scritch. I file the astronomer's pages. Five were lost when the Orrery stopped. Find them; I'll keep them."
- `qu.02` · Quill · page filed · "Page filed. The margins are full of little circles. She really did like circles."
- `e3.approach` · Cog · approach · "The Echo Choir. Three automata sing the builders' laws of amplitude. One is a mimic in a choir shell."
- `e3.approach2` · Cog · approach · "Mimics love a half-truth. Aim the Tuning Lens at a singer and compare its trace to the reference."
- `e3.instruction` · Cog · instruction · "Aim the Tuning Lens at each singer, compare its trace to the reference wave, and expose the mimic."
- `e3.tutorial` · Cog · tutorial · "White is the astronomer's wave, y = 3sin(x). Green is the singer's claim. Drag the orange probe to measure."
- `e3.hint1` · Cog · hint 1 · "Amplitude is measured from the midline, not across the whole swing."
- `e3.hint2` · Cog · hint 2 · "Peak to trough is twice the amplitude. Check where each singer starts its bracket."
- `e3.hint3` · Cog · hint 3 · "The mimic claims: The amplitude of y = 3sin(x) is 6, peak to trough."
- `e3.fail` · Cog · fail · "An honest bell! That singer's claim holds. Look again at where each bracket starts measuring."
- `e3.mimic` · Mimic · on exposure · "Sss! Six looked so much bigger. Nobody measures from the middle anymore..."
- `e3.success` · Cog · success (insight) · "Amplitude is measured from the middle: swing up to 3 and down to −3, and the amplitude is still 3."
- `e3.success2` · Cog · payoff · "It was jamming the lift gear! The Echo Lift is rising. Hop on, Wren."
- `e3.after` · Cog · after · "Three rhythms. The crystals up here are waking. Hear them humming?"

#### Seal 4 · Solving Span (`e4_solve`, S4)
- `e4.approach` · Cog · approach · "The Chasm of Two Answers. The span holds only if its stones are laid in the order you'd solve 2sin(x) = 1."
- `e4.approach2` · Cog · approach · "Two anchor pylons on the far side. The Measurers never built two pylons for nothing."
- `e4.instruction` · Cog · instruction · "Lay the glyph stones in solving order to build the span. One stone doesn't belong."
- `e4.tutorial` · Cog · tutorial · "Pick a stone, then a socket. Socket 1 is nearest you. Lay the Span once every socket is filled."
- `e4.hint1` · Cog · hint 1 · "Get the sine by itself before anything else."
- `e4.hint2` · Cog · hint 2 · "Which angle in quadrant I has a sine of 1/2? That's your reference angle."
- `e4.hint3` · Cog · hint 3 · "Sine is positive in two quadrants, which is why there are two answers, and two pylons."
- `e4.fail.order` · Cog · fail (order) · "The span held up to a point, then a stone tipped. What has to happen right before that one?"
- `e4.fail.decoy` · Cog · fail (decoy) · "That stone crumbled: no angle has a sine of 2. You can't undo the 2 until the sine stands alone."
- `e4.success` · Cog · success (insight) · "An equation can have two doors: sine is positive twice on every lap, at π/6 and at 5π/6."
- `e4.success2` · Cog · payoff · "Both pylons lit! Isolate, reference angle, quadrants, both solutions. Now let's walk it."
- `e4.after` · Cog · after · "Four rhythms. The Crystal Stair is ahead, and I can hear the Treasury chimes."

#### Crystal Stair (S5 explore) and Lumen
- `lu.01` · Lumen · talk · "Each lantern flame rises and falls on its own wave. Taller flame, same rhythm. Folks mix those up."
- `lu.02` · Lumen · talk (after e3) · "The Choir's honest again, so I can light the stair by their song. Mind the third step; it hums."
- `lu.03` · Lumen · talk (wisps < 3) · "Three indigo wisps sing behind the falls. Gather them all, and the water will part for you."
- `wi.01` · Cog · first wisp · "An insight wisp! It hums a little truth. Collect all three and something behind the falls wakes."
- `wi.02` · Cog · third wisp · "Three wisps! Hear the falls change pitch? Something behind them just unlocked."

#### Seal 5 · Chime Treasury (`e5_period_review`, S5)
- `e5.approach` · Cog · approach · "The Chime Treasury. Its singers remember the Tidewheel Gate, and one of them remembers it wrong."
- `e5.approach2` · Cog · approach · "This is the trickiest choir yet. Every claim sounds like something we've already seen."
- `e5.instruction` · Cog · instruction · "Aim the lens at each singer, count the cycles inside its period bracket, and expose the mimic."
- `e5.hint1` · Cog · hint 1 · "Period = 2π/|b|. Check each claim with it."
- `e5.hint2` · Cog · hint 2 · "A bigger b means a faster wave and a shorter period. A true period bracket holds exactly one cycle."
- `e5.hint3` · Cog · hint 3 · "The mimic claims: y = sin(2x) has period 4π, twice that of sin(x)."
- `e5.fail` · Cog · fail · "Honest! That bracket holds exactly one cycle. Test the others with 2π over b."
- `e5.mimic` · Mimic · on exposure · "Twice the b, twice the period... it sounded so fair. Sss."
- `e5.success` · Cog · success (insight) · "A wave that repeats twice as often waits half as long: sin(2x) comes home every π."
- `e5.success2` · Cog · payoff · "The Treasury chest! The Warden's key-stone, and the rim stair's growing. Hoo, up!"
- `e5.after` · Cog · after · "Five rhythms. One seal left, and it has a guard."

#### Rim Gantry (S6 explore)
- `g.01` · Cog · explore · "The Rim Gantry. Each gear swings on the period written on its plaque. Watch one lap, then jump."
- `g.02` · Cog · explore (first miss) · "No harm done; the walkway catches you. Count the beat: out, back, out again. Then go."
- `g.03` · Cog · explore (ledge view) · "Look back: five beams on the Orrery. One more and she wakes."

#### Seal 6 · The Warden's Shield (`e6_boss`, S6)
- `e6.approach` · Cog · approach · "The Warden. It guards the Star Chart and trusts only one thing: timing."
- `e6.warden1` · Warden · approach · "None pass whose timing is false." **(fixture)**
- `e6.warden2` · Warden · approach · "My shield sweeps three spans either way. Six spans, end to end! Match THAT, little reader."
- `e6.instruction` · Cog · instruction · "Tune the counter-pendulum's period to the shield's rhythm, y = 3sin((π/2)t), and hold the sync thread."
- `e6.tutorial` · Cog · tutorial · "Your pendulum swings with the period you set. When the rhythms match, the thread between them stays bright."
- `e6.hint1` · Cog · hint 1 · "The 3 in front sets how far the shield swings, not how fast."
- `e6.hint2` · Cog · hint 2 · "Period = 2π/|b|, and here b = π/2."
- `e6.hint3` · Cog · hint 3 · "Divide 2π by π/2: the π's cancel."
- `e6.fail.long` · Warden · fail (too long) · "Too slow! You drift behind my every beat."
- `e6.fail.short` · Warden · fail (too short) · "Too quick! You race ahead and fall out of step."
- `e6.probe.reach` · Warden · probe (T ≈ 3 or 6) · "You count my reach, not my rhythm. Reach is how far. Rhythm is how often."
- `e6.probe.half` · Warden · probe (T ≈ 2) · "Zero, yes, but which way do I swing? Half a beat is no beat at all."
- `e6.fail.cog` · Cog · fail (any) · "Don't let the big swing fool you. Watch one full sweep: out, back, and out again the same way."
- `e6.success.warden` · Warden · success · "Your timing is true. Pass, reader of rhythms." **(fixture)**
- `e6.success` · Cog · success (insight) · "How far a thing swings says nothing about how often. Height is A; timing is b."
- `e6.success2` · Cog · payoff · "The shield's open and the Star Chart is right there! Take it to the lens, Wren!"

#### Epilogue (S7 finale)
- `out.01` · Narr · finale · "Under Vesper's light, the Star Chart slid into the Orrery's lens."
- `out.02` · Cog · finale · "Six rhythms, six beams. Hoo, look at them climb!"
- `out.03` · Ilse · finale · "Whoever you are: if you hear this, you read the rhythms. Angles, periods, swings and solutions."
- `out.04` · Ilse · finale · "I sealed the chart so only someone who understood the machines could restart them. Thank you."
- `out.05` · Narr · finale · "The Tidewheels turned. The canals filled terrace by terrace. The groves glowed blue again."
- `out.06` · Cog · finale · "Her star chart! You read every rhythm in the crypt." **(fixture)**
- `out.07` · Cog · finale · "Same time next year? I'll keep the gears oiled. Hoo."

#### Utility lines (any scene)
- `u.page` · Cog · page pickup · "Her handwriting! Press E to read. She hid lessons in her letters."
- `u.quill3` · Quill · all 5 pages · "All five pages, in order. The astronomer would be pleased, and a little embarrassed."
- `u.back` · Cog · panel closed without Verify · "Take your time. The machine will wait; it has waited years."
- `u.tel` · Cog · telescope (any seal lit) · "Count the beams on the tower: every rhythm we restore arrives up there."
- `mb.01` · Cog · secret (Music Box) · "Her music box! Slide b and the note climbs. Slide A and it only gets louder. Pitch is timing."
- `mb.02` · Cog · secret · "No seal here, no lock. She built this one just for play."

**Line count: 120**, all at most 140 characters (checked by the script in §4.6).
- By speaker: Cog 93, Narr 6, Warden 7, Brasswick 4, Lumen 3, Quill 3, Mimic 2, Ilse 2.
- Five of the lines are verbatim fixture lines.

### 4.5 Outro (finale phase)

This fixes D2. After the boss's correct `grade()`, GameClient enters a **`finale`** phase before `EndScreen`.

| Beat | Visual | Duration | Line |
|---|---|---|---|
| 1 | The success animation in §5.6: the Warden kneels and the Star Door opens | 2.5 s | `e6.success.warden`, `e6.success`, `e6.success2` |
| 2 | Wren walks (auto) through the door onto the Orrery platform; Vesper overhead | 4 s | `out.01` |
| 3 | The chart slots into the lens. Six beams converge from below; the rings spin up (L1 tower rings rotate at 3 speeds) | 4 s | `out.02` |
| 4 | Ilse's constellation-figure fades in above the lens (star points, 1 px lines, `vesper.star`) | 7 s | `out.03`, `out.04` |
| 5 | The camera pulls back and pans down the canyon (a 3 s tween through world y 1100 → 3000). Each scene re-saturates in order; canals fill as a travelling water front; the dome's 7 constellations ping on | 6 s | `out.05` |
| 6 | Wren celebrates on the platform; Cog circles | 3 s | `out.06`, `out.07` |
| 7 | Fade to EndScreen (debrief, mastery, post-assessment) | — | — |

The finale is skippable with Esc. `autoSolve` of the boss enters `finale` and the e2e test can press Esc (or the
finale auto-skips when `window.__GAME_DEBUG__` requests it). This keeps `end-screen` reachable with no UI
interaction.

### 4.6 Verification of line lengths

Content agents run the following against this file. The build must print only the count:

```bash
grep -E '^- `[a-z0-9_.]+` · ' docs/design/10-game-trig.md \
  | sed -E 's/.*· "(.*)"( \*\*\(fixture\)\*\*)?$/\1/' \
  | awk '{ n++; if (length($0) > 140) print "TOO LONG: " $0 } END { print n " lines" }'
# expected output: "120 lines"
```

---

## 5 · Contraptions (one per encounter)

### 5.0 Shared rules for all six contraptions

**Five parts** (bible §4): console → control → live link → verify → payoff. Every contraption below fills in all five.

**Engine interface.** This is a sketch for engine-dev. The names are proposals; the pure pose functions live in `.ts` files so vitest can test them.

```ts
// src/game/contraptions/types.ts
export type LiveDraft =
  | { kind: "value"; value: number }                  // dial + number_line (today's onLive(number), wrapped)
  | { kind: "aim"; statementIndex: number | null }    // pick (mimic): the claim currently aimed at
  | { kind: "order"; slots: (string | null)[] }       // order (linear): plank key per slot, null = empty
  | { kind: "probe"; x: number };                     // panel-only measuring probe (never graded)

export interface Verdict {            // built by GameClient AFTER runner.submit() returned
  encounterId: string;                // captured before submit (fixes D1)
  correct: boolean;
  feedback: string;                   // the mode's grade() text, shown verbatim (with display noun map, below)
  input: unknown;                     // what was submitted
  solution: unknown;                  // spec.encounters[i].solution; used ONLY to pick failure visuals after grading
  attempt: number;
}

export interface ContraptionDef<View> {
  id: string;                         // "vesper_dial"
  modes: string[];                    // ["mapper.number_line"]
  layout: "scrub" | "board" | "vault";
  create(scene: Phaser.Scene, anchor: { x: number; y: number }, ctx: { view: View; params: unknown; skin: unknown }): ContraptionInstance;
}
export interface ContraptionInstance {
  setDraft(d: LiveDraft): void;       // eased toward; never computes correctness before Verify
  setAidTier(t: 0 | 1 | 2): void;
  playVerdict(v: Verdict): Promise<void>;   // success payoff or failure feedback
  setSolved(): void;                  // instant solved pose (skipTo/autoSolve/reload; D3)
  setDormant(dormant: boolean): void; // ColorMatrix desaturation + glow off
  destroy(): void;
}
```

**Hard rules.**

1. **Grading stays in the mode.** Verify calls `onSubmit(input)` with exactly the mode's `Input` shape. The contraption receives the `Verdict` and *replays* it.
2. **Tolerance parity.** A contraption's "locked" pose predicate must agree with `grade().correct` for every input. Each contraption ships a vitest that samples ≥ 200 inputs across the control range and asserts `isLockedPose(v) === mode.grade(params, input(v)).correct`.
3. **No pre-verify leaks.** Before Verify, a contraption may show only:
   - the physical consequence of the input: rings turn, a beam points, stones float;
   - things the mode's `view` already shows.

   It must never read `solution` to glow "warmer", except where the physics makes the gap inherently visible. For example, the Tidewheel notch is physically at an angle, and the fixture answer isn't consulted to draw it. `solution` is read only inside `playVerdict`.
4. **Non-punitive failure.**
   - The failure animation lasts 1.2–1.6 s, then the controls re-enable.
   - The panel stays open and the player's input stays where it was.
   - There is no health and no reset.
   - Only the mastery penalty applies (runner).
5. **Success protocol.** This timeline is shared, and each contraption adds its own middle:

   | t | What happens |
   |---|---|
   | 0 | A badge replaces Verify, with bracket connectors (bible §3.8) |
   | 0 | The insight line replaces the instruction |
   | 0–2.5 s | The in-world success animation |
   | 1.6 s | The panel slides out, 280 ms |
   | end | Camera back to follow; Wren `celebrate`; the objective ring segment fills (0.6 s); the L1 beam line draws to the Orrery (1.0 s); the scene re-saturates (ColorMatrix tween, 1.0 s); the payoff collider changes; `success2` plays as a toast |

6. **Aid tiers** (the "instrument reveal ladder"). This keeps the first try a real test while the panel stays Variant-rich:

   | Tier | Unlocked by | Adds |
   |---|---|---|
   | 0 | panel opens | primary cards and all world motion |
   | 1 | the first failed Verify, or opening hint 1 | the secondary card fills in (until then it is drawn empty, as Variant does with unused cards) |
   | 2 | opening hint 2 | an overlay aid (markers or brackets) |

   Tiers never unlock anything beyond what the matching fixture hint already says.
7. **Probes.** After a failed Verify, the contraption may test the submitted input against **misconception probes** authored in the overlay, for example `|θ − 5π/3| ≤ tol`. On a match, the probe line replaces the generic guide fail line. The mode's feedback text still shows in line 2. A probe line never says more than hint 1.
8. **The brief.** The info button opens a two-tab sheet:
   - **Brief**: the fixture `prompt` verbatim plus the console plaque text.
   - **Hints**: the guide-voiced tiers, then the fixture `hints[]` verbatim.

   Opening a hint tier records hint use through the existing runner path.
9. **Display noun map.** `grade()` feedback for the mimic says "chest" because that is the mode's own text. The overlay supplies `feedbackNouns: {"chest": "singer", "That chest": "That singer"}`. It is applied only when rendering, and grading is untouched.
10. **Runtime fixes the contraptions depend on:**
    - D1: capture the encounter before `submit`.
    - D2: add a `finale` phase.
    - D3: world state comes from `solvedEncounterIds`.
    - D4: call `input.keyboard.disableGlobalCapture()` while the panel is open, so the arrow keys drive the scrubber.
    - D5: memoize `view` per encounter index.

**Shared panel components (React, bible §3).**

| Component | Contents |
|---|---|
| `PanelFrame` | hex grid, circuit-trace rail, back-arrow tab |
| `GraphCard` | function colour, label tab, π or numeric ticks, major/minor grid, open/closed endpoints |
| `UnitCircleCard` | the square card: circle, axes, landmark labels, point, arc, projection drops |
| `Scrubber` | ruler, orange teardrop knob, `role="slider"`, input tab and readout |
| `ValueChip` | card-edge chips at the current value's height |
| `ClaimColumn` | the orb-palette analogue for claims |
| `PlankColumn` | the plank palette for sequencer stones |
| `SpanSchematic` | the socket row for the Solving Span |
| `VerifyButton` | label, trace lines, disabled state |
| `SuccessBadge` | the badge with bracket connectors |
| `DialogueBar` | emblem, info button, type-on text |

**Coordinates.** Each contraption's anchor is given in world px. Parts are positioned relative to the anchor. All sizes are at 1× (1080p).

---

### 5.1 Seal 1 · The Vesper Dial (`e1_radians` · `mapper.number_line` · socket `altar`)

| Fixture fact | Value |
|---|---|
| params | `scale: linear, min: 0, max: 2*pi, target: 5*pi/6, landmarkStep: pi/2, labels: pi` |
| view | `{scale, min: 0, max: 2π, target: "5π/6", landmarks: [0, π/2, π, 3π/2, 2π] (with fractions and labels)}` |
| input | `{ value: θ }` |
| solution | `value 2.618, tolerance 0.015 (line fraction), fraction 0.4167, label "5π/6", between "π/2 and π"` |
| tolerance in radians | `0.015 × 2π = 0.0942` |
| grade feedback | correct: "A perfect landing." · wrong: "You landed past/short of 5π/6. Count how many landmark gaps it takes to get there." |
| misconception | "π radians is a full circle", which would put the carriage at 5/6 of a full turn = 5π/3 |

**In-world object** (anchor C = (4800, 2700), the dial's centre, 300 px above the S1 floor at y 3000):
- **Dial disc** (A76): a cream stone disc of radius 280.
  - It is carved with a sun face: concentric rings, a navy inlay ring at r 200, and 8 gold rays.
  - It has 5 dark **spoke slots** on its right rim, from which the ledges emerge on success.
  - It is set in the S1 retaining wall and casts a long soft shadow to the right.
- **Rail ring** (A77): a gold ring of radius 310, 14 px wide.
  - 24 small engraved **studs** every π/12: 4 px navy dots.
  - 4 large **landmark studs** at 0, π/2, π and 3π/2: 12 px gold bosses with engraved labels outside the rail ("0", "π/2", "π", "3π/2"), in `orrery.engrave` 26 px path-text.
  - The 0 stud also carries a small sun glyph: the **sunrise mark**.
- **Carriage** (A78): a brass shoe on the rail with a small cyan-orb emitter, 90×70.
  - Its position is `P(θ) = C + 310·(cos θ, −sin θ)` (screen y down, so the angle increases counter-clockwise, over the top).
- **Beam**: 3 stacked additive lines (bible §6.2). It runs from P outward along the direction `(cos θ, −sin θ)`.
  - For θ ∈ [0.05, π − 0.05] it reaches the fog band at radius 900 and ends in a soft cyan bloom inside the fog, the same at every angle.
  - Otherwise it ends on the wall or floor within 420 px with a small grey-cyan spark.
- **Sine plumb gauge** (A80 + A81): a vertical brass ruler at x = C.x + 390, from C.y − 310 to C.y + 310, with ticks at −1, −0.5, 0, 0.5 and 1 (units of the rail radius).
  - A bob slides to `y = C.y − 310·sin θ`.
  - A dashed green line runs from the carriage horizontally to the bob.
  - World chip (green border): **"sin θ: 0.50"**.
- **Cosine slide gauge** (A82 + A81): a horizontal ruler at y = C.y + 360, with a marker at `x = C.x + 310·cos θ` and a dashed blue line up to the carriage.
  - World chip (blue border): **"cos θ: −0.87"**.
- **Carriage chip** (white border): **"θ: π/2 < θ < π"**. It shows the landmark bracket of the current θ, which is already legible from the labelled studs. When within 0.01 of a landmark it shows **"θ = π"**. It never shows a decimal.
- **Target pin** (A42): 1.3 H above the disc top, reading **"5π/6"**. The pin states the target *value*, not its place.
- **Fog band** (A84): a soft lavender-white band covering the whole upper sky arc from about 10° to 170° as seen from C. **Vesper's Lens** (A83) is hidden inside it, set in the canyon rim at bearing 5π/6 and radius 900. Because the lens is invisible, there is no aim-by-eye shortcut.
- **Console** (A36) at x 4300 on the floor.
- **Dormant state:** −40 % saturation, no beam, carriage parked at θ = 0.

**Live binding (per `onLive` tick; θ = the value).**

| Quantity | Formula |
|---|---|
| Displayed angle | `θd ← θd + (θ − θd)·(1 − e^(−dt/0.1))`, about 0.3 s to 95 %, giving the bible's eased lag |
| Carriage | `P(θd) = C + 310·(cos θd, −sin θd)`; the carriage sprite rotates by `−θd + π/2` so its orb faces outward |
| Beam direction and length | `u = (cos θd, −sin θd)`; `L = 900 − 310` inside the fog arc, else clipped at the first wall hit (≤ 420) |
| Beam shimmer | alpha `0.9 ± 0.08` noise at 12 Hz |
| Plumb bob | `y = C.y − 310·sin θd` |
| Cosine marker | `x = C.x + 310·cos θd` |
| Gold sweep arc on the disc rim | from 0 to θd, 6 px, `gold.hi` at 70 %: "the walk so far". Arc length on the unit circle = θ |
| Chips | `sin θd` and `cos θd` to 2 decimals; the carriage chip is `bracket(θd, view.landmarks)` |
| Detents | when the knob is released within 0.05 rad of a stud (a multiple of π/12), θ eases onto the stud. This feels mechanical, and every stud is equally sticky, so it leaks nothing |
| Sound | `dial_carriage_roll` loop, pitch ∝ \|dθ/dt\|; a `stud_tick` each time a stud is crossed |

**Instrument panel (Scrub mode: world 0–0.59, panel 0.59–0.975, bar 0.50–1.00 × 0.85–1.00).**

```
┌──────────────────────── panel ────────────────────────┐
│ [←]                                        ┌───────┐  │
│   ┌── UNIT CIRCLE (square, 38% h) ─────────┤ θ     │  │  tab "θ"
│   │            π/2                         └───────┘  │
│   │      ╭─────●─────╮   white point P(cosθ, sinθ)    │
│   │   π  │  orange arc 0→θ  │ 0 ←sunrise tick        │
│   │      ╰───────────╯   green drop (sin) · blue (cos)│
│   │            3π/2                                   │
│   └───────────────────────────────────────────────────│
│chip┌── g: sin θ  (19% h) ─────────────────── [sin θ]┐ │
│◀── │  y∈[−1.5,1.5] ticks −1,0,1 · x 0…2π              │ │
│    └──────────────────────────────────────────────────┘ │
│chip┌── h: cos θ  (19% h, tier 1) ──────────── [cos θ]┐ │
│    └──────────────────────────────────────────────────┘ │
│ ┌────┬─────────────┐ ├┼┼┼┼┼┼●┼┼┼┼┼┼┼┼┼┼┼┼┼┼┼┼┼┼┤         │  ruler 0 · π/2 · π · 3π/2 · 2π
│ │ θ  │ π/2 < θ < π │ 0     π/2     π    3π/2   2π       │  hairlines every π/12 (unlabelled)
│ └────┴─────────────┘                                   │
│              ●── [ ALIGN THE DIAL ] ──●                │
└───────────────────────────────────────────────────────┘
```

**Cards.**
- **Unit circle card** (tier 0):
  - axes ±1.2 with arrowheads;
  - the circle is 2 px white;
  - landmark labels at 0, π/2, π and 3π/2 just outside the circle;
  - hairline ticks every π/12 on the circle;
  - the **orange arc** from angle 0 to θ, 4 px (it is the input);
  - the point P as a white filled circle, r 7;
  - a green dashed drop from P to the x-axis (sin θ) and a blue dashed line from P to the y-axis (cos θ).
- **g card, "sin θ"** (tier 0): the green curve `y = sin θ` over [0, 2π]. Its x-axis is shared with the ruler.
- **h card, "cos θ"**: tier 1. At tier 0 it is drawn empty with axes only.
- **Scrubber:** the vertical orange line runs through the g and h cards at x = θ. The unit circle card is not on the shared axis, so the line starts below it.
- **Chips:** the g card's chip shows sin θ (green border) at the y of sin θ; the h card's chip shows cos θ (blue).
- **Readout:**
  - the input tab reads **"θ"** in orange;
  - the readout box shows the **landmark bracket** ("π/2 < θ < π") instead of a number, because the mode's point is locating 5π/6 using coarse landmarks;
  - today's `Place.tsx` decimal readout (`value.toPrecision(4)`) is **not** used in the showcase panel.
- **Tier 2 aid:** the unit circle card labels every π/6 hairline with a small tick (no numerals), making "count in sixths" (hint 2) literal.
- **Keyboard:**

  | Key | Step |
  |---|---|
  | ← / → | π/48 |
  | Shift + ← / → | π/12, the next stud |
  | Home / End | 0 / 2π |
  | Enter | Verify |

**Verify.** The **ALIGN THE DIAL** button calls `onSubmit({ value: θ })` and then `numberLine.grade`.

**Success animation (2.4 s, then payoff).**

| t (s) | World | Panel |
|---|---|---|
| 0.0 | the beam's core widens ×1.5, `beam_surge` | badge **VESPER ALIGNED** |
| 0.0–0.8 | the fog dissolves outward from the beam's end (radial alpha mask 0.85 → 0), revealing **Vesper's Lens** on the rim | insight line types on |
| 0.4 | the lens ignites: node lit state, halo, 12 sparks, `node_ignite` | |
| 0.6–1.0 | a bright starlight pulse travels back down the beam into the disc centre | unit circle card: the arc turns gold |
| 1.0–2.4 | the **disc rotates +5π/6** counter-clockwise (ease-out cubic; the disc turns by the angle you set). The five **spoke-ledges** (A79) slide out of the right-rim slots one after another (0.15 s stagger, `spoke_extend_clunk`) | panel slides out at 1.6 |
| 2.4 | ledge colliders on | — |

**Payoff:** the ledges form a spiral stair rising 80 px per step (5 steps = 400 px) from the S1 floor to the upper terrace. It is the only route up. The L1 beam line draws from the S1 pylon to the Orrery.

**Failure feedback (1.4 s).**
- The beam stays where it points, and a scatter burst appears at its end: 8 grey-cyan sparks and a fog puff, `beam_scatter`.
- Gold **chevrons** appear on the rail beside the carriage and point in the direction to move. The direction comes from `Verdict`: "short of" means counter-clockwise and "past" means clockwise.
- The number of chevrons encodes the distance band:
  - 1 = within one stud (π/12);
  - 2 = within one landmark gap (π/2);
  - 3 = further.

  They fade after 2 s. This is partial feedback that never shows the target position.
- The guide line is `e1.fail.short` or `e1.fail.past`, with the mode's feedback on line 2.
- **Probe** `fullturn`: `|θ − 5π/3| ≤ 0.0942` replaces the guide line with `e1.probe.fullturn`.

**Misconception made visible:** a player who treats π as a full turn places the carriage low on the right (5π/3). The beam then fires into the floor wall and never reaches the fog, which is visibly nowhere near the sky.

**Insight line:** `e1.success`, "A radian is a walk, not a turn: π carries you exactly halfway round any circle."

**Extensions needed:**
- *Input*: none.
- *Live*: `onLive(number)` already exists (`Place.tsx:714`).
- *Panel*: a showcase `NumberLineScrubber` replaces `NumberLinePlace`. It uses `view.landmarks`, `min` and `max` for the ruler and derives hairlines as `landmarkStep / 6` when `labels === "pi"`. This rule is uniform, so it doesn't depend on the target.
- *View*: nothing new.

**Pure tests** (`vesper-dial.test.ts`):
- `pose(0)`, `pose(π/2)` and `pose(π)` carriage positions.
- `bracket()` for 20 values.
- Parity: `isLockedPose(θ) ⟺ grade correct` over 400 samples.
- `probe.fullturn` fires only near 5π/3.

---

### 5.2 Seal 2 · The Tidewheel Gate (`e2_period` · `tuner.oscillator`, ask `period` · socket `door`)

| Fixture fact | Value |
|---|---|
| params | `wave: sin, amplitude: 1, b: "2", c: "0", d: 0, ask: period` |
| view | `{equation: "y = sin(2t)", ask: period, askLabel: "period", wave: sin, amplitude: 1, b: 2, c: 0, d: 0, dial: {min 0, max 2π, step π/12, ticks every π/4 ("0", "π/4", … "2π")}}` |
| input | `{ value: T }` |
| solution | `period π, answer π, answerLabel "π"` |
| tolerance | `0.03 × 2π = 0.1885`, so only the detent T = π passes (neighbours at π ± π/12 are 0.26 away) |
| grade feedback | "A period of X is too long: the rings drift behind" / "too short: the rings race ahead" + "One full cycle of sin(b·t) takes 2π/\|b\|." |
| misconception | "sin(2x) has period 4π" (a bigger b means a longer period) |

**In-world object** (anchor G = (7400, 2396), the ring centre, 1.2 H above the S2 floor at y 2600):
- **Gate wall** (A85): 900×760 cream stone with 5 vertical navy grooves, a gold cap and a dark doorway recess (0.9 H × 1.3 H, arched top) behind the ring's 6 o'clock position.
- **Outer ring** (A86): 2.4 H in diameter (408 px), 34 px wide.
  - Gold rim, cream face, and an engraved **wave band**: a sine wave running round the ring in `orrery.engrave`.
  - A **notch** 150 px wide at its local 6 o'clock.
  - It is bound to the wave's argument.
- **Inner disc** (A87): 340 px in diameter, cream, with a matching doorway **cutout** 150 × 221 px from its bottom edge.
  - Three concentric navy inlay rings.
  - It is bound to the wave's value.
- **Keystone fin** (A88 + A89): two gold half-fins above the ring (the Variant "crown"), closed.
- **Tally wheel** (A90): a small gold escapement wheel above the fin. Its 6 teeth are engraved "0 · I · II · III · IIII · V". It counts completed laps.
- **Latch pawl** (A91): a bronze pawl on the fin's right. It drops toward the notch and the tally at Verify.
- **Canal**: dry, from the gate leftward, using the S2 canal tiles at 0 % water alpha.
- **Console** (A36) at x 6900.
- **Pin** (A42) above the tally wheel: **"I"**, meaning one lap. It states the target count, which is the definition of a period, not its value.

**Live binding.** T is the dial value.

| Part | Formula | Chip |
|---|---|---|
| Outer ring angle (argument) | `φ(T) = b·T = 2T`; the sprite rotates `−φ` (clockwise) about G, eased (τ 0.1 s) | tier 2: blue chip on the ring rim, **"laps: 0.92"** (= φ/2π) |
| Inner disc rock (value) | `ψ(T) = (π/2)·(y(T) − d)/A = (π/2)·sin(2T)`, so it rocks ±90° | white chip **"y: 0.00"** = sin(2T) |
| Tally wheel | `k(T) = floor(φ/2π + 0.03)` teeth advanced (0 → I at one full lap), ratcheting with a `tally_click` | — |
| Notch misalignment | `δ(T) = wrap(φ)` to (−π, π]. A thin navy arc on the wall from the notch to the 6 o'clock mark shows δ as an angle only, with no number | — |
| Release replay | on knob release (pointer up, or 300 ms of key idle), the rings replay the motion from t = 0 to t = T in `max(0.6, T/π)` s: the outer ring sweeps 0 → φ and the inner disc rocks through `sin(2t)`, then holds at pose(T). *You watch the machine run for exactly the time you set* | — |

**Why the tally exists.** At T = 2π the notch is also home, because 2π is a period too, just not the smallest. The mode grades it wrong ("too long"). The tally shows **II** and the pawl slips on tooth II, so the world agrees with the grade: "a period is **one** lap".

**Locked predicate** (parity with grade): `locked(T) ⟺ |2T − 2π| ≤ 2·0.1885 ⟺ |T − π| ≤ 0.1885`.

**Instrument panel (Scrub mode).**

```
┌──────────────────────── panel ────────────────────────┐
│ [←]                                                    │
│chip┌── f: y = sin(2t) ───────────────────────── [f(t)]┐│  white; y∈[−1.5,1.5] ticks −1,0,1
│◀── │   ∿∿∿∿   x: 0 · π/2 · π · 3π/2 · 2π             ││
│    └───────────────────────────────────────────────────┘│
│    ┌── g: ghost f(t + T) ──────────────────── [f(t+T)]┐│  faint white f + green shifted copy
│    └───────────────────────────────────────────────────┘│
│chip┌── h: laps = bt / 2π (tier 2) ─────────────── [laps]┐│  blue line 0→2, floor steps with ●/○ ends
│    └───────────────────────────────────────────────────┘│
│ ┌───┬───────┐ ├──┼──┼──┼──●──┼──┼──┼──┤                  │  ruler = view.dial.ticks
│ │ T │ 0.75π │ 0  π/4 π/2 3π/4 π …   2π                 │
│ └───┴───────┘                                          │
│             ●── [ LOCK THE RINGS ] ──●                 │
└───────────────────────────────────────────────────────┘
```

**Cards.**
- **f card:** `y = A·sin(b t + c) + d` from the view, over [dial.min, dial.max]. The orange line sits at t = T, and the chip shows f(T).
- **g card** (tier 0): a faint white copy of f at 25 %, and the green **ghost** `y = f(t + T)`. When T is a period the two coincide exactly: the "ghost lock" happens at T = π and at 2π.
  - This is the definition of a period, f(t + T) = f(t), drawn.
  - At T = π/2 the ghost is f upside-down, which is the half-period trap made visible.
- **h card** (tier 2): a blue `laps(t) = b·t / 2π` line plus a faint floor step function with filled and hollow ends (the Variant hole motif). The chip shows laps(T).
- **Tier 1 aid:** the f card marks the start state: a hollow circle at t = 0 with a small upward arrow for "rising". The player can then compare the state at T.
- **Scrubber:** the ruler uses `view.dial.ticks`. The readout is in π format ("0.75π"). Keyboard ← / → moves one `dial.step` (π/12); Shift moves π/4.

**Verify.** The **LOCK THE RINGS** button calls `onSubmit({ value: T })` and then `oscillator.grade`.

**Success animation (2.2 s).**

| t (s) | World | Panel |
|---|---|---|
| 0.0 | the pawl drops into the notch and tooth I: `latch_click` | badge **RINGS LOCKED** |
| 0.1–1.3 | both rings spin one more full lap together (ease-out) and stop with the notch and cutout at 6 o'clock: the doorway is open | ghost card flashes green |
| 1.0–1.4 | the keystone fin halves slide ±24 px apart; a light shaft (A93, additive) pours through the doorway | |
| 1.3–2.2 | **water surges** through the doorway: the canal water front travels left at 600 px/s with splash particles (`water_rush`). A canal **skiff** floats into view | panel out at 1.6 |
| 2.2 | the gate collider is off; the L1 beam line draws; S1 and S2 re-saturate (the S1 canal fills too) | — |

**Payoff:** the player walks through the doorway. This is the only way east. Brasswick's arm syncs to the right period (visible through S1's window arch) and unlocks `bw.03`/`bw.04`.

**Failure feedback (1.4 s).**
- The pawl drops.
  - If the notch is not home, it strikes the ring rim: spark, `latch_clack`.
  - If the notch is home but the tally reads ≥ II, it catches tooth II and slips: `latch_slip`, double clack.
- The rings stay at pose(T), and the misalignment arc pulses twice.
- The guide line is `e2.fail.long` or `e2.fail.short`, with the direction taken from comparing `input.value` to `solution.answer` inside `playVerdict`.
- **Probes:**
  - `|T − π/2| ≤ tol` → `e2.probe.half` (the ghost card shows the inverted wave);
  - `|T − 2π| ≤ tol` → `e2.probe.double` (the tally shows II).

**Misconception made visible:** "bigger b means longer period" pushes players toward T > π. Past π the ring over-laps, the tally shows more than one lap and the ghost wave slides out of phase. The world shows that sin(2t) comes home *sooner* than sin(t) would. 4π isn't on the dial (`dial.max = 2π`); the double lap at 2π plays that role.

**Insight line:** `e2.success`, "Speed up the wheel and every lap gets shorter: double b, and the period halves."

**Extensions needed:** none. `onLive(number)` exists (`Dial.tsx:652`), and `view` carries `wave`, `amplitude`, `b`, `c`, `d` and `dial`, which is enough to draw every card and pose every part. The showcase panel replaces BaseDial's range input with the `Scrubber` component.

**Pure tests:**
- `pose(T)` angles at 0, π/2, π and 2π.
- `tally(2π) = 2`.
- Parity over 400 samples.
- The ghost coincidence metric `max|f(t) − f(t + T)| < 1e−9` at T = π.

---

### 5.3 Seal 3 · The Echo Choir (`e3_amplitude` · `truth_finder.mimic` · socket `chest`)

| Fixture fact | Value |
|---|---|
| params.statements | s0 "The amplitude of y = 3sin(x) is 3" (true) · s1 "The amplitude of y = 3sin(x) is 6, peak to trough" (**false**) · s2 "Multiplying sin(x) by 3 leaves its period unchanged" (true) |
| view | `{ chests: [{statementIndex, text}] }`, shuffled by `shuffleNotIdentity(seed)` |
| input | `{ statementIndex }` |
| solution | `mimicIndex: 1` |
| grade feedback | correct: "Mimic exposed. " + explanation · wrong: "That chest was honest: " + explanation (display noun map → "singer") |
| misconception | "Amplitude is the distance from peak to trough" |

**In-world object** (anchor K = (10000, 2600), the court centre on the floor):
- **Three Echo Automata** (A95/A96/A97 bodies, randomized per slot) stand on plinths at K.x − 420, K.x and K.x + 420, **in `view.chests` display order**, left to right.
  - Each is 2.5 H tall: a cream shell with gold bands, a navy faceplate, and a **bell chest** (a gold bell set into the torso).
  - A chest **slate** (A99, 150×100) shows a miniature of its claim trace.
  - A brass **plaque** (A100) on the plinth carries the claim text (Phaser text, 18 px, `inlay.navy` on brass, 2 lines max, same text as the view).
  - There are no tells: the mimic shell uses the same body pool and idle animation.
- **Tuning Lens** (A38 pedestal + A103 lens head) at (K.x, K.y − 20), 1.4 H in front of the plinths.
- **Echo Lift** (A104 platform + A105 chains) at x 10800. It rests on the floor with its **resonator fork** silent. The lift is sound-powered: it rises only to a true chord.
- **Console** (A36) at x 9500.
- **Pin** (A42) above the lift's resonator fork: a **bell glyph**, meaning the target is a true chord. It names the goal, not the singer.
- **World chip** on the Tuning Lens (white border): **"aim: singer B"**. It names the aimed singer by its plinth letter (A/B/C in display order) and updates live.

**Live binding.**

| Draft | World response |
|---|---|
| `aim: i` | The lens head rotates toward automaton i's slate: `α_i = atan2(slate_i.y − lens.y, slate_i.x − lens.x)`, eased (τ 0.12 s). The beam (3-line additive) runs from the lens to the slate. The aimed automaton's bell glows cyan and hums (`bell_hum`, a sustained tone); its slate brightens; the other two dim to 60 %. The camera nudges 40 px toward it |
| `aim: null` | the lens returns to centre and the beam is off |
| `probe: x` | no world change (panel-only measuring) |

**Instrument panel (Board mode: world 0–0.45, panel 0.45–1.00, bar 0.43–1.00 × 0.80–1.00).**

```
┌─────────────────────────── panel ───────────────────────────┐
│ [←]  ┌ SINGERS ┐  ┌── f: reference y = 3sin(x) ──── [ref]┐ │  white; x 0…2π (π labels) · y −4…4
│      │ ◎ bell A │  │   ∿∿    orange probe line at x=a      │ │
│      │  claim…  │  └──────────────────────────────────────┘ │
│      │ ◎ bell B │  ┌── g: claim trace (aimed singer) ─ [claim]┐│  green wave + its measuring bracket
│      │  claim…  │  └──────────────────────────────────────┘ │
│      │ ◎ bell C │  ┌── h: distance from midline (tier 2) ─ [|y|]┐│
│      │  claim…  │  └──────────────────────────────────────┘ │
│      └──────────┘  ┌───┬──────┐ ├──┼──●──┼──┼──┤             │  probe ruler 0 · π/2 · π · 3π/2 · 2π
│                    │ x │ 0.5π │                              │
│                    └───┴──────┘                              │
│                 ●── [ EXPOSE THE MIMIC ] ──●                 │
└──────────────────────────────────────────────────────────────┘
```

**Panel elements.**
- **Claim column** (the orb-palette analogue): three claim cards in display order.
  - Each has an automaton glyph (bell A/B/C icon, 40 px), the claim text in 18 px white (3 lines max) and hollow-circle terminals.
  - Selecting a card (click, keys **1–3**, or ↑/↓) sets `aim`.
  - The aimed card gets a 2 px orange outline, because aiming is input.
- **f card** (reference, white): `y = 3 sin x` from the astronomer's reference slate. The dashed midline y = 0 is at 40 %.
- **g card** (claim trace, green): what the aimed singer claims, drawn literally from the overlay `claimTraces[statementIndex]`.

  | Statement | Trace | Bracket |
  |---|---|---|
  | **s0** | green `3 sin x` | vertical bracket from (π/2, 0) to (π/2, 3) with end caps, labelled **"amplitude 3"** |
  | **s1** (mimic) | green `3 sin x` | vertical bracket from (3π/2, −3) up to the peak level y = 3 (a dashed horizontal guide from the peak at π/2), labelled **"amplitude 6"** |
  | **s2** | green `3 sin x` solid and green `sin x` dashed | under each, a horizontal bracket over [0, 2π] labelled **"period 2π"** |

  Every trace is a *correct drawing of what the claim says*. Only the reader's knowledge of where amplitude is measured tells the lie apart. Nothing is styled "wrong".
- **h card** (tier 2): blue `|3 sin x|`, the distance from the midline, with a peak label "3".
- **Tier 1:** a blue **"midline"** label on the dashed y = 0 of both the f and g cards.
- **Probe scrubber:**
  - The input tab reads **"x"** and the readout is π format. The probe is `{kind: "probe"}` and is never graded.
  - The orange line crosses the f, g and h cards.
  - Chips show f(a) (white), the claim trace value at a (green) and |f(a)| (blue, tier 2).
  - At a = π/2 the f chip reads 3.00; at 3π/2 it reads −3.00. The player can measure the swing.
- **Verify:** **EXPOSE THE MIMIC**. It is disabled until a singer is aimed and calls `onSubmit({ statementIndex })`.

**Success animation (2.4 s).**

| t (s) | World | Panel |
|---|---|---|
| 0.0 | the lens beam turns gold; the mimic's bell cracks with a dissonant clang (`mimic_hiss`) | badge **MIMIC EXPOSED** |
| 0.2–0.6 | its faceplate halves swing open (A98); steam puff | |
| 0.6–1.4 | the **Mimic crab** (A101) drops out, stalk eyes pop up and it speaks `e3.mimic`; then it scuttles right on six legs (A102, 6-frame gait) through a floor drain grate; the empty shell slumps | g card: the false bracket shatters into dots |
| 1.4–2.4 | the two true singers ring a **true chord** (`chord_true`); the lift's resonator fork glows, its chains snap taut and the platform lifts 40 px off the floor and hovers, powered. When the player steps on it, the **Echo Lift rises** 500 px (y 2600 → 2100) in a 2.2 s ride (`lift_chain`, Wren `ride`) | panel out at 1.6 |

**Payoff:** the player stands on the lift, which carries them to the upper ledge (S3 → S4). It is the only way up.

**Failure feedback (1.2 s).**
- The chosen (honest) singer rings a clear bell (`bell_honest`) and its plaque glows gold for 2 s.
- A small gold bell glyph stays over it as a marker, carrying only the information the grade already gave.
- The lens beam flickers and relaxes; the other singers keep idling.
- The guide line is `e3.fail`, with line 2 showing the noun-mapped feedback, e.g. "That singer was honest: Amplitude is |A|, the number in front."

**Misconception made visible:** the mimic's bracket physically spans from the bottom of the swing to the top. The honest bracket starts at the midline. At tier 1 the midline is labelled, so the contrast is on screen.

**Insight line:** `e3.success`, "Amplitude is measured from the middle: swing up to 3 and down to −3, and the amplitude is still 3."

**Extensions needed:**
- *Live*: `Pick` must emit `onLive({kind: "aim", statementIndex})` when a card is focused, hovered or selected, and `null` on blur. The widget change is small; the contraption consumes it.
- *Data*: `claimTraces` is an overlay field keyed by **statementIndex**, never by display position: `{fns: [{expr: "3*sin(x)", style: "solid" | "dashed"}], brackets: [{x0, y0, x1, y1, label}]}`, all as exact mathjs strings. It is authored content, validated in code (the expressions evaluate and brackets lie inside the card range). It needs no mode change, because the mode's `view` stays the text-only claims.
- *Input*: unchanged.

**Pure tests:**
- Lens aim angles.
- Display order → plinth mapping is stable for the seed.
- `claimTraces` evaluate.
- The noun map applies only in display.

---

### 5.4 Seal 4 · The Solving Span (`e4_solve` · `sequencer.linear` · socket `door`)

| Fixture fact | Value |
|---|---|
| params.steps (s0–s3) | "Isolate the sine: sin(x) = 1/2" · "Find the reference angle: sin(π/6) = 1/2" · "Sine is positive in quadrants I and II" · "Write both solutions: x = π/6 and x = 5π/6" |
| params.decoys (d0) | "Take the inverse sine of 2 first" |
| view | `{ slots: 4, planks: [{key, text}] ×5 }` shuffled by `shuffleNotIdentity(seed)` |
| input | `{ keys: string[] }` (4 keys in slot order) |
| solution | `order: [s0, s1, s2, s3]` |
| grade feedback | "Fill all 4 slots." · `"<decoy text>" isn't part of this process.` (checked first) · `Slot N is out of place. What has to happen right before "<text>"?` · correct: "The bridge locks together." |
| misconception | "sin(x) = 1/2 has only one solution on [0, 2π)" |

**In-world object** (anchor B = (12650, 2100), the chasm's centre at ledge height; the chasm runs from x 12200 to 13100):
- **Chasm edges** (A106/A107): grey-teal cliffs with blue crystal roots and mist rising from below (mist sprites, L3).
- **Four span sockets** (A113): glowing elliptical rings, 140×60, floating over the chasm at x = 12290, 12510, 12730 and 12950 on a gentle arc (y 2100, 2092, 2092, 2100). Dormant grey. Socket 1 is nearest the player.
- **Plank cradle** (A114) beside the console at x 12000: a brass rack with 5 bays, each holding a **glyph stone** (A108, 220×70). The stones sit in `view.planks` display order.
  - Each stone shows a content glyph (one of the five icons on sheet A109) and a 3-word engraved label.
  - The glyph reflects what the step *says*, not whether it belongs:

    | Step | Glyph |
    |---|---|
    | isolate | a "÷2" balance |
    | reference angle | an angle wedge |
    | quadrants | a circle with its upper half shaded |
    | both solutions | twin beacons |
    | decoy | "sin⁻¹(2)", an arrow into the circle |

- **Two anchor pylons** (A115 ×2) on the far bank at x 13250 and 13420, with dark beacon crystals. **Pins** (A42) above them read **"x₁"** and **"x₂"**. *Two anchors are a visible claim that the equation has two solutions, before anything is solved.*
- **Console** (A36) at x 11900.

**Live binding (`order` draft: slots[j] = key or null).**

| Change | World |
|---|---|
| a key placed in slot j | its stone lifts from the cradle and flies on a bezier arc (0.45 s, `stone_float`) to socket j, then hovers with a ±4 px bob at 0.5 Hz and a faint cyan underglow. Socket j brightens to "occupied" |
| a key removed | the stone flies back to its cradle bay |
| a key moved between slots | the stone flies socket to socket |
| all 4 filled | the span shows a faint dotted guide-line connecting sockets to the far anchors: "ready", which is not a verdict |

**Instrument panel (Board mode).**

```
┌──────────────────────────── panel ─────────────────────────────┐
│ [←]  ┌ STONES ┐   ┌── SPAN ───────────────────────────────────┐ │
│      │ ▭ glyph │   │ ◯1 ─ ◯2 ─ ◯3 ─ ◯4 ──── ▲x₁   ▲x₂        │ │  socket row mirrors the chasm
│      │  text…  │   └───────────────────────────────────────────┘ │
│      │ ▭ …     │   ┌── unit circle ─────┐ ┌── f: 2sin(x), g: y=1 ─┐│
│      │ ▭ …     │   │  (nothing lit yet) │ │  white curve, green   ││
│      │ ▭ …     │   │                    │ │  dashed line; probe x ││
│      │ ▭ …     │   └────────────────────┘ └───────────────────────┘│
│      └─────────┘   ┌───┬──────┐ ├──┼──●──┼──┤                    │
│                    │ x │ 0.3π │                                   │
│                    └───┴──────┘                                   │
│                    ●── [ LAY THE SPAN ] ──●                       │
└──────────────────────────────────────────────────────────────────┘
```

**Panel elements.**
- **Stone column:** 5 stone cards in display order. Each shows its glyph and the full step text (18 px).
  - Controls: click a stone, then a socket. Keyboard: Tab to a stone, Enter to pick, **1–4** to place, Backspace to return it to the column.
  - Placed stones grey out in the column.
- **Span schematic:** 4 sockets numbered left to right, drawn as hollow circles joined by trace lines, ending at two pylon glyphs.
- **Unit circle card:** circle and axes, dormant at tier 0. **Tier 2:** a faint horizontal line at y = 1/2 (just the "sin = 1/2" level; hint 2 already names it).
- **Graph card:** f = `2 sin x` (white) and g = `y = 1` (green dashed) over [0, 2π], with y from −2.5 to 2.5.
  - The probe scrubber x has chips f(x) and 1.
  - The two crossing points are visible but unmarked. The player can see there are two meetings, which is honest, and the order of steps is still the task.
- **Tier 1:** the graph card shades where f > 1, the two "humps above the line".
- **Verify:** **LAY THE SPAN**. It is disabled until all 4 sockets are filled and calls `onSubmit({ keys })`. The keys are what the view's planks carry, and they reach grading unchanged.

**Success animation (2.5 s).** The solution replays as the bridge locks. Each step is 0.5 s: the stone drops into its socket, `stone_lock_thunk`, a dust puff (A73) and a gold seam glint.

| Step | World | Card animation (the maths *is* the success animation) |
|---|---|---|
| 1 · isolate | stone 1 locks | graph morphs: f `2 sin x → sin x` and g `1 → 1/2` (scale tween); the card caption types "sin(x) = 1/2" |
| 2 · reference angle | stone 2 locks; **x₁ beacon** glows faintly | unit circle: point at π/6 lights, green drop shows height 1/2, white arc 0 → π/6; graph: the first crossing fills at x = π/6 |
| 3 · quadrants | stone 3 locks | unit circle: the upper half (QI, QII) shades blue at 20 % with labels I and II; a dashed mirror across the y-axis carries π/6 → 5π/6 |
| 4 · both solutions | stone 4 locks; **both beacons ignite** (x₁ then x₂, 0.2 s apart, `beacon_ignite`); anchor cables snap taut from the span to both pylons | graph: the second crossing fills at 5π/6; both glow |
| +0.5 | stone seams fuse gold, the span collider turns on, the L1 beam line draws, S4 re-saturates | badge **SPAN LOCKED** (shown from t = 0); panel out at 1.6 |

**Payoff:** the player walks across the span to the far bank (the only route) and finds Journal Page 4 by pylon x₂.

**Failure feedback (1.6 s).** Inside `playVerdict`, the correct prefix is computed by comparing `input.keys` with `solution.order`. This is post-grade presentation, and it matches what the grade's "Slot N" already implies.
- **Correct prefix:** those stones lock (gold seams) and the matching card steps replay. If the prefix includes step 2, the **x₁** beacon glows faintly while **x₂ stays dark** and its anchor cable hangs slack. *One solution is not enough, visibly.*
- **Out of order at slot N:** stone N tilts 20°, grinds (`stone_grind`) and slides back to hover. Stones after N dim to 50 %. The guide line is `e4.fail.order`, with the mode's "Slot N is out of place…" on line 2.
- **Decoy present:** the decoy stone cracks (A116, 4-frame crumble) and falls into the chasm (`stone_crumble`). The unit circle card shows a horizontal line at y = 2, hovering above the circle and missing it, because sine never reaches 2. The guide line is `e4.fail.decoy`. The decoy stone re-forms in its cradle bay after 1.2 s.
- After 1.6 s, unlocked stones return to hovering. The player's arrangement persists so they can edit it.

**Misconception made visible:** the two pins, the slack second cable on partial solves, and both beacons lighting at the end.

**Insight line:** `e4.success`, "An equation can have two doors: sine is positive twice on every lap, at π/6 and at 5π/6."

**Extensions needed:**
- *Live*: `Order` must emit `onLive({kind: "order", slots})` on every placement change.
- *Data*: `stepEffects` is an overlay field keyed by plank key (`s0`…`s3`, `d0`). It names card effects from a fixed vocabulary: `scaleEquation`, `markAngle`, `shadeQuadrants`, `markSolutions`, `missCircle`. The contraption plays effects only in `playVerdict`.
- *Presentation rule:* the key string identifies decoys (`d*`), so **the world and panel must never style a stone by its key before Verify**. Only glyph and text, both derived from content, may differ.
- *Input*: unchanged.

**Pure tests:**
- Socket positions.
- Prefix computation for 6 orders.
- The decoy detection path.
- `stepEffects` keys exist in the params.

---

### 5.5 Seal 5 · The Chime Treasury (`e5_period_review` · `truth_finder.mimic` · socket `chest`)

This is the same contraption as §5.3 (`echo_choir`) with the **treasury skin**, a different reference and different claim traces. It is the review encounter, so the escalation is narrated ("trickiest choir yet") and aids come later.

| Fixture fact | Value |
|---|---|
| params.statements | s0 "y = sin(2x) repeats every π, twice as often as sin(x)" (true) · s1 "y = sin(2x) has period 4π, twice that of sin(x)" (**false**) · s2 "y = cos(x/2) has period 4π, stretched out" (true) |
| solution | `mimicIndex: 1` |
| misconception | "sin(2x) has period 4π" |

**In-world object** (anchor K5 = (16800, 1500)):
- Three treasury automata. They use the same body pool with a gold-leaf bell skin: tint `gold.hi` over the bell and navy plaques.
- A Tuning Lens.
- The **Treasury Chest** (A117 body + A118 lid) on a dais at x 17300, with a gold lock-dial that only turns to a true chord.
- The **rim stair**: 5 flush step slots in the cliff at x 17350–17600, rising to y 1100.

**Live binding:** identical to §5.3 (aim → lens, beam, hum, dimming).

**Panel (Board):** the same layout as §5.3.
- **f card:** the reference `y = sin x` over **[0, 4π]**, with x labels π, 2π, 3π, 4π and y from −1.5 to 1.5.
- **g card:** claim traces from the overlay `claimTraces`.

  | Statement | Trace | Bracket |
  |---|---|---|
  | s0 | green `sin(2x)` | horizontal bracket over [0, π], labelled "period π" |
  | s1 (mimic) | green `sin(2x)` | horizontal bracket over [0, 4π], labelled "period 4π". The bracket visibly contains **four** humps-and-troughs |
  | s2 | green `cos(x/2)` | horizontal bracket over [0, 4π], labelled "period 4π", containing exactly **one** cycle |

- **h card** (tier 2): blue period markers, small hollow circles wherever the aimed trace returns to its starting value moving the same way. sin 2x gets 4 of them inside [0, 4π]; cos(x/2) gets 1 at 4π.
- **Tier 1:** the f card gets a "one cycle" bracket over [0, 2π] for the reference, the Tidewheel memory. Cog references it.
- **Probe:** x ∈ [0, 4π]. The chips show the reference sin a and the trace value.
- **Verify:** **EXPOSE THE MIMIC**.

**Success animation (2.5 s).**
1. The mimic exposure beat is the same as §5.3, compressed to 1.2 s, with the voice line `e5.mimic`.
2. A true chord rings (`chord_true`).
3. The **chest's lock-dial** spins and clicks; the lid rotates −70° about its hinge (0.6 s) and gold light spills out.
4. The **Warden's key-stone** (a gold disc with a wave glyph, A119) and **Journal Page 5** float to Wren (auto-collected).
5. The **rim stair** slides out of the cliff one step at a time (5 steps, 0.15 s stagger, 80 px rises, `spoke_extend_clunk`).
6. The L1 beam line draws and S5 re-saturates.

**Payoff:** the player climbs the rim stair to the Rim Gantry (S6). It is the only way up.

**Failure feedback:**
- The same as §5.3.
- The guide line is `e5.fail`.
- The honest singer's bracket flashes to show "one cycle" (a green dot at each end of its bracket). This is exactly the grade's explanation ("2π/|b| = 2π/2 = π") made visual.

**Misconception made visible:** the mimic's 4π bracket over sin(2x) holds four cycles.

**Insight line:** `e5.success`, "A wave that repeats twice as often waits half as long: sin(2x) comes home every π."

**Extensions needed:** the same as §5.3 (Pick `aim` live draft, `claimTraces`, noun map).

---

### 5.6 Seal 6 · The Warden's Shield (`e6_boss` · `tuner.oscillator`, ask `period` · socket `boss`)

| Fixture fact | Value |
|---|---|
| params | `wave: sin, amplitude: 3, b: "pi/2", c: "0", d: 0, ask: period` |
| view | `{equation: "y = 3sin((π/2)t)", ask: period, amplitude: 3, b: π/2, c: 0, d: 0, dial: {min 0, max 8, step 0.05, ticks 0…8 every 1}}`. The answer 4 is not a π multiple, so the dial is numeric |
| input | `{ value: T }` |
| solution | `period 4, answer 4` |
| tolerance | `0.03 × 8 = 0.24` |
| grade feedback | "A period of X is too long: the rings drift behind" / "too short: the rings race ahead. One full cycle of sin(b·t) takes 2π/\|b\|." |
| misconception (boss) | the big swing: confusing amplitude (3) or peak-to-trough (6) with timing |

**In-world object** (anchor D = (22300, 1100), the Star Door's centre at floor level):
- **Star Door** (A128): two tall cream leaves with gold star inlays, 520×700, in the dome's back wall.
- **The Warden** (A120–A126): a 5.5 H sentinel standing right of the door at x 22750, facing left.
  - Its right shoulder pivot is at **(22620, 386)**, i.e. 1100 − 4.2 H.
  - The arm (upper plus lower, rigid in this fight, length **L = 442 px**) holds the **shield** (A125, 2.4 H across) so that the shield's centre hangs at the door's centre height, y = 1100 − 1.6 H = 828.
- **Span tiles:** 7 engraved floor tiles under the door, labelled −3 … 3 (A131). They make "3 spans either way" measurable, which sets up the Warden's "six spans" taunt.
- **Counter-pendulum** (A127 pylon, A129 arm, A130 bob) beside the console at x 21300: a 3 H gold pylon with a pivot at the top, a 300 px arm and a bronze bob with a cyan core.
- **Sync thread**: a code-drawn beam from the bob to the shield's boss.
- **Pin** (A42) above the shield: a **metronome glyph** (no number). The target is *this rhythm*.
- The shield rim carries its equation as engraved path-text: **"3 sin(π/2 · t)"**.
- **Console** (A36) at x 21150.

**Real-time motion (independent of the panel; τ = seconds since the arena trigger).**
- **Shield displacement in spans:** `s(τ) = 3·sin((π/2)·τ)`. On screen, `x = D.x + s·U` with `U = 0.55 H = 94 px`, so the sweep is ±282 px across the door.
  - The arm angle is `α = asin(s·U / L)`, with L = 442, so α peaks at about ±39.6°.
  - The shield takes 4 real seconds per sweep cycle, so the player *feels* the period before touching anything.
  - `shield_swoosh` peaks at each pass through centre.

**Live binding (T = dial value).**

| Part | Formula |
|---|---|
| Pendulum phase | `φp += 2π·dt / max(T, 0.25)`; angle `β = 14°·sin(φp)`. At T < 0.25 the pendulum shivers in place |
| Shield phase | `φs = (π/2)·τ` |
| Sync thread | `Δ = wrap(φs − φp)`; brightness `B = ½(1 + cos Δ)`; width `2 + 4B` px; alpha `0.25 + 0.75B`. When B < 0.3 the thread sags (a quadratic curve with sag `(1 − B)·60 px`) and throws a spark every 0.5 s. Its pitch (`sync_hum`) follows B |
| Common-start reset | on panel open **and** on each knob release, the shield eases to centre (0.3 s) and **τ and φp restart at 0 together**, so drift is always measured from a shared start. With T ≠ 4 the thread beats at `\|1/4 − 1/T\|` Hz: visibly drifting apart, then briefly realigning |
| World chip | green border, on the pendulum pylon: **"T: 4.00 s"**. The shield carries its engraved equation, not a chip |
| Locked predicate | `\|T − 4\| ≤ 0.24`. There the beat period is ≥ 62 s, so the thread reads as steady, in parity with grade |

**Instrument panel (Scrub mode).**

```
┌──────────────────────── panel ────────────────────────┐
│ [←]                                                    │
│chip┌── f: shield  y = 3sin((π/2)t) ───────── [shield]┐ │  white; t 0…8 · y −4…4 (labels −4,−2,0,2,4)
│◀── │   ⌒   ⌒   (tier 2: peak dots)                  │ │
│    └────────────────────────────────────────────────┘ │
│    ┌── g: pendulum  y = sin(2πt/T) ─────────── [yours]┐│  green, amplitude 1 on the SAME axes;
│    │   faint white copy of f behind                   ││  heights differ, timing may not
│    └────────────────────────────────────────────────┘ │
│chip┌── h: drift = t(1/4 − 1/T) cycles (tier 1) ─ [drift]┐│ blue; y −2…2
│    └────────────────────────────────────────────────┘ │
│ ┌───┬──────┐ ├──┼──┼──┼──●──┼──┼──┼──┤                  │  ruler 0…8 = view.dial.ticks
│ │ T │ 4.00 │ 0  1  2  3  4  5  6  7  8                  │
│ └───┴──────┘                                           │
│            ●── [ MATCH THE RHYTHM ] ──●                 │
└───────────────────────────────────────────────────────┘
```

**Cards.**
- **f card:** the shield wave, drawn from the view. The orange line is at t = T. The chip shows f(T), which reads **0.0 at both T = 2 and T = 4**: the half-period trap, visible on the chip.
- **g card:** the player's pendulum wave, drawn **at amplitude 1** on the f card's axes, over a faint f. The size mismatch is deliberate: the waves can agree in *timing* without agreeing in *height*.
- **h card** (tier 1): the phase drift line, flat at T = 4. The chip shows drift(T) = T/4 − 1.
- **Tier 2:** filled dots at the shield's peaks (t = 1, 5), so the player can read peak-to-peak spacing.
- **Keyboard:** ← / → moves 0.05; Shift moves 0.5.

**Verify.** The **MATCH THE RHYTHM** button calls `onSubmit({ value: T })` and then `oscillator.grade`.

**Boss beats** (still one `grade()` call).

| Phase | Trigger | Content |
|---|---|---|
| A · Wake | the player crosses x 20600 | the Warden re-saturates from the feet up (1.2 s), the visor ignites and the shield begins to swing. Lines: `e6.approach`, `e6.warden1` (fixture), `e6.warden2` |
| B · Tune | panel open | Scrub mode with the Warden and shield in the left 59 % (camera framed on D − 300). Aid tiers as above. Failures loop back here |
| C · Verdict | Verify | success below, or failure with a Warden taunt |

**Success animation (2.5 s, then the `finale` phase, §4.5).**

| t (s) | World | Panel |
|---|---|---|
| 0.0 | the sync thread turns gold and thickens to 8 px; `resonance_lock` | badge **RESONANCE LOCKED** |
| 0.0–1.0 | the shield's swing amplitude decays to 0 (ease-out) while it swings in lockstep with the pendulum. It stops at far right, clear of the door | |
| 1.0–1.8 | the Warden lowers the shield and **kneels**: torso −120 px, head bow 15°, plinth dust; `warden_bow_rumble`. Line `e6.success.warden` (fixture) | insight `e6.success` |
| 1.6–2.4 | the Star Door leaves slide apart (0.8 s); starlight spills out; the first dome constellation pings | panel out |
| 2.5 | the door collider is off; enter the `finale` phase | — |

**Failure feedback (1.6 s).**
- The sync thread **snaps** with a spark and the shield deflects the broken end: `thread_snap`.
- The Warden's visor flares. It speaks `e6.fail.long` or `e6.fail.short`, with the direction from `input.value` against `solution.answer` in `playVerdict`.
- Cog follows with `e6.fail.cog`. The mode feedback shows in line 2.
- **Probes:**
  - `|T − 3| ≤ 0.24` or `|T − 6| ≤ 0.24` → `e6.probe.reach`: the amplitude or peak-to-trough confusion. The span tiles −3 … 3 flash to show that 3 and 6 are *distances*.
  - `|T − 2| ≤ 0.24` → `e6.probe.half`.
- There is no damage and no reset: the pendulum resumes at T.

**Misconception made visible:**
- The shield's sweep is huge and labelled in spans. The Warden shouts "six spans".
- The pendulum's swing is small, yet at T = 4 the two move in perfect lockstep.
- *How far* and *how often* are shown to be independent.

**Insight line:** `e6.success`, "How far a thing swings says nothing about how often. Height is A; timing is b."

**Extensions needed:**
- None for grading or the live value.
- The real-time clock is host-side.
- **Runtime:** the `finale` phase (D2) is mandatory for this contraption's payoff to be seen at all.

**Pure tests:**
- `syncBrightness(T=4, τ)` ≥ 0.99 for τ ≤ 30 s.
- `beatHz(T)` values.
- Parity over 400 samples.
- The probe predicates.

---

### 5.7 Summary: bindings at a glance

| Enc | Contraption | Layout | Control → draft | Live link (world) | Verify label | Badge | Payoff (traversal) |
|---|---|---|---|---|---|---|---|
| e1 | Vesper Dial | Scrub | θ scrubber → `value` | carriage `C + 310(cos θ, −sin θ)`, beam angle θ, sin plumb, cos slide | ALIGN THE DIAL | VESPER ALIGNED | disc turns 5π/6; spoke-stair up 400 px |
| e2 | Tidewheel Gate | Scrub | T scrubber → `value` | outer ring `−2T`, inner disc `(π/2)sin 2T`, tally `⌊2T/2π⌋`, release replay | LOCK THE RINGS | RINGS LOCKED | doorway + water; walk through |
| e3 | Echo Choir | Board | claim select → `aim`; probe → `probe` | lens angle to singer i, beam, hum | EXPOSE THE MIMIC | MIMIC EXPOSED | true chord raises the Echo Lift 500 px |
| e4 | Solving Span | Board | stones → `order` | stones fly to sockets 1–4, hover | LAY THE SPAN | SPAN LOCKED | span + two anchors; walk across 900 px |
| e5 | Chime Treasury | Board | claim select → `aim` | as e3 (treasury skin) | EXPOSE THE MIMIC | MIMIC EXPOSED | chest opens; rim stair up 400 px |
| e6 | Warden's Shield | Scrub | T scrubber → `value` | pendulum `14° sin φp`, `φp += 2π dt/T`, sync thread `½(1 + cos Δ)` vs the real-time shield `3 sin(πτ/2)` | MATCH THE RHYTHM | RESONANCE LOCKED | Warden kneels; Star Door opens → finale |

---

## 6 · Side content and purpose systems

### 6.1 Objective HUD: the Rhythm ring

- **Top-left, 55 px** double ring (white at 60 %, bible §3.10), divided into **6 arc segments** of 60° each, one per seal, clockwise from 12 o'clock in encounter order.
  - An unlit segment is a white 1 px outline.
  - A lit segment has a `gold.base` → `orrery.beam` gradient fill that sweeps in over 0.6 s on success.
- The label to its right reads **"Rhythms 2/6"** (16 px, white, letter-spaced).
- The lit state is derived from `solvedEncounterIds` (D3), so `skipTo`/`autoSolve` light the ring correctly.
- **Zone toast:** on entering a zone, a centred letter-spaced caps title fades in and out over 2 s ("SUNWARD TERRACE", "CRYSTAL STAIR", "THE WARDEN'S DOME").
- **Counters:** on any pickup, a line appears under the ring for 3 s: "Pages 2/5 · Wisps 1/3".
- The ring is also a button: click or **M** opens the map.
- The existing `MasteryHud` moves into the map's Mastery tab. Its data is unchanged.

### 6.2 The Orrery Map (M)

The map is a panel-material overlay (hex grid, circuit traces, back arrow). It covers 70 % × 80 % of the screen with the world dimmed 40 % behind it; it is a pause screen.

| Tab | Contents |
|---|---|
| **Terraces** | A side-profile drawing of §2.6: 8 scene nodes joined by circuit-trace lines. Each node has a **seal glyph** (grey when dormant, cyan when lit), dots for pages found in that scene and a wisp mark. A white "you are here" pin (not orange: orange is input only). The **Orrery tower** at the top right shows one lit beam per seal. Hovering a node shows the scene name and its seal's insight line once solved |
| **Journal** | the 5 Journal Pages (§6.4) in a reader: parchment card inside the panel, Ilse's handwriting face, source footer |
| **Mastery** | the existing mastery meter per concept (Radian measure, Period, Amplitude, Solving sin x = k), restyled as 4 gauges |

The map does not fast-travel.

### 6.3 Plaques (in-world lore, read with E; also the Brief tab)

| Where | Text (≤ 200 chars) |
|---|---|
| S0 Plaque of the Measurers | "We, the Measurers, built these terraces to keep time with the sky. Every wheel here turns on a wave. Read the wave, and the wheel will follow." |
| e1 console | "VESPER DIAL. Set the carriage to the evening star's bearing, measured from sunrise along the rim, in radians." |
| e2 console | "TIDEWHEEL GATE. The latch fires once. Time it to a single lap of the ring: no more, no less." |
| e3 console | "ECHO CHOIR. The lift answers only a true chord. Silence the false singer." |
| e4 console | "SOLVING SPAN. Stones hold in the order of the working. The far bank has two anchors." |
| e5 console | "CHIME TREASURY. The chest opens to a true chord. Its singers remember the Tidewheel." |
| e6 console | "THE WARDEN. It yields to a matched rhythm, and to nothing else." |

### 6.4 Collectibles: Journal Pages (5) and Insight Wisps (3)

**Journal Pages** are Ilse's notes. Each teaches the concept in the context of the machines and cites the fixture's own `sourceRef`, so the lore is grounded. A page is picked up with E (A56: a parchment page with a gold wax seal, glowing softly and bobbing), shown in the reader, then filed by Quill.

| # | Title | Where | Text (≤ 280 chars) | Source (fixture) |
|---|---|---|---|---|
| 1 | The Builders' Measure | S0 lectern by the gondola | "Walk one radius along a circle's rim and you have turned one radian. The Measurers counted arcs, not degrees: half the rim is π, the whole rim is 2π, whatever the circle's size. — I.V." | p.1 "An angle of π radians corresponds to half a revolution." |
| 2 | Vesper's Bearing | S1 upper terrace (after e1) | "Vesper rises at 5π/6, five-sixths of the way from sunrise to the western horizon: one sixth of π short of the half-turn. I have checked it every year for forty years." | p.1 (same) |
| 3 | The Tidewheel Log | from Brasswick (after e2) | "The Tidewheel runs on sin(2t). Double the b and the wheel runs twice as fast, so it comes home every π, not every 2π. Brasswick's arm must keep the same rhythm or he waters the air." | p.3 "The period of y = sin(bx) is 2π/\|b\|." |
| 4 | Two Doors | S4 far bank, by pylon x₂ | "sin(x) = 1/2 opens twice a lap, at π/6 and at π − π/6 = 5π/6. Sine is height, and two points on the circle share every height except the very top and bottom." | p.4 "To solve a trigonometric equation, first isolate the trigonometric function." |
| 5 | Reach and Rhythm | S5 Treasury Chest | "A sets how far; b sets how often. My Warden swings wide to frighten visitors, but the width of a swing has nothing to do with its beat. Count the beat, not the reach." | p.2 "The value of A stretches the graph vertically but leaves the period unchanged." |

All 5 pages trigger `u.quill3` and a "Journal complete" line on the EndScreen debrief.

**Insight Wisps** (A57: indigo `#6A6CF0` wisps, 48 px with a 128 px glow, orbiting their spot at 0.5 Hz) are hidden on off-path ledges, one per zone before the boss. Each hums a one-line truth in the bar when collected:
- **W1** (S1, behind the crystal tree, 1 H ledge): "Every circle is 2π radii around, whatever its size."
- **W2** (S3, on the colonnade lintel): "A wave's midline is where it rests; amplitude is how far it leaves."
- **W3** (S5, behind the third lantern): "Period and frequency are partners: one says how long, the other how often."

Collecting all three plays `wi.02` and unlocks the secret (§6.6). The debrief gets an "Insights" row (overlay-driven text; no mastery effect).

### 6.5 NPC micro-quests (optional, non-graded)

| NPC | Start | Steps | Visible reward |
|---|---|---|---|
| **Brasswick** (S1) | talk: `bw.01`, `bw.02` | restore seal 2 (the Tidewheel), then return to S1 by the spoke-stair | His arm swings on the right period and his crystal tree re-saturates with a sparkle burst. He says `bw.03`, `bw.04` and gives **Page 3** |
| **Quill** (S3) | talk: `qu.01` | find pages; each page is filed with `qu.02` | Quill rides on Wren's satchel from then on (a 0.3 H sprite on the satchel bone). All 5 pages → `u.quill3` |
| **Lumen** (S5) | talk: `lu.01` | after e3, `lu.02`: the stair lanterns light in sequence up the Crystal Stair. If wisps < 3, `lu.03` | Lit lanterns (their flames rise and fall on a visible sine: height `10 + 4 sin(2πt/1.5)`) and the pointer to the secret |

### 6.6 Secret: the Astronomer's Music Box (S5 grotto)

- **Unlock:** all 3 wisps. The S5 waterfall's two halves slide apart (0.8 s, `falls_part`), revealing a crystal grotto at x 15000.
- **Object:** a brass music box on a pedestal, with a miniature ring gate on its lid.
- **Interact:** the panel opens in **Sandbox mode**.
  - It is not an encounter: there is no Verify, no grading and no runner call.
  - It has two scrubbers: **A** from 0.5 to 3 and **b** from 0.5 to 4.
  - One graph card shows `y = A·sin(b t)` over [0, 4π].
  - A WebAudio oscillator plays at `220·b` Hz with gain `0.2·A/3`.
  - The lid's ring spins at rate b.
  - Lines: `mb.01`, `mb.02`.
- **The lesson** is hands-on: pitch follows b (timing), loudness follows A (reach).
- **Reward:** cosmetic gold trim on Wren's scarf (A142/A143 tint), plus a "Secret found" line on the debrief.
- **Accessibility:** it respects the mute setting, and a visual pulse ring replaces the tone when muted.

### 6.7 Sighting Telescopes

There are two: S0 at x 1200, and the S6 gantry ledge.
- **E** pans the camera to the far Orrery tower (a fake zoom: L1 scales 1.6× under a circular vignette mask for 3 s).
- The tower shows one lit beam per seal, which makes progress physical in the world.
- Lines: `s0.02`, `u.tel`, `g.03`.

### 6.8 Sound hooks (ids for the audio agent; WebAudio-synth placeholders until CC0 files exist)

| Group | Cue ids |
|---|---|
| UI | `ui_knob_tick`, `ui_select`, `ui_verify`, `ui_badge`, `ui_panel_in`, `ui_panel_out`, `ui_page_turn` |
| e1 | `dial_carriage_roll` (loop, pitch ∝ speed), `stud_tick`, `beam_hum` (loop), `beam_scatter`, `beam_surge`, `fog_part`, `node_ignite`, `spoke_extend_clunk` |
| e2 | `ring_turn` (loop), `tally_click`, `latch_click`, `latch_clack`, `latch_slip`, `water_rush` |
| e3/e5 | `bell_hum` (loop per singer, 3 pitches), `bell_honest`, `mimic_hiss`, `mimic_scuttle`, `chord_true`, `lift_chain` (loop), `chest_unlock` |
| e4 | `stone_float`, `stone_lock_thunk`, `stone_grind`, `stone_crumble`, `beacon_ignite`, `cable_snap_taut` |
| e6 | `shield_swoosh` (on each centre pass), `pendulum_tick`, `sync_hum` (pitch ∝ B), `thread_snap`, `resonance_lock`, `warden_bow_rumble`, `door_slide` |
| Ambience and music | `amb_canyon_day`, `amb_crystal`, `amb_dome_night`; `music_terrace_day`, `music_crystal_peach`, `music_dome_dusk`, `music_finale` (theme `musicMood: curious`) |

### 6.9 Accessibility

- Every panel control is keyboard-operable (§5 per contraption). The Phaser global capture is released while the panel is open (D4).
- Dialogue is ≥ 28 px at 1920 wide, white on panel, contrast ≥ 7:1.
- g is always **dashed** where it overlays f, so colour is never the only cue.
- **Reduced motion:** no camera nudges; the fog dissolves instantly; particle counts are 25 %; success animations play at the same length but without shake.
- **e6 slow time:** a toggle **"time × 0.5"** in the panel scales τ and φp together. The readout still shows T in the equation's units, and the toggle label makes the scaling explicit.

---

## 7 · Art asset list

### 7.1 Conventions for the artist agents

- **Format:**
  - Hand-authored **SVG**, one file per asset, `viewBox` = its 1× size (1920×1080 base).
  - No text elements: numerals and labels are converted to paths, or drawn by code.
  - No external CSS or filters. Gradients are allowed.
  - They are rasterized at load with `{scale: devicePixelRatio}` (02 doc).
- **Path:** `public/assets/expedition/orrery_terraces/<group>/<id>.svg`, listed in `manifest.json` with key, path, width, height and scrollFactor. Rotating parts declare their pivot in the manifest (`pivot: [x, y]` in px).
- **Palette:** use only bible §2 tokens plus the §2.2 trig tokens.
  - No pure black; the darkest world colour is `#2B3A44`.
  - Lit faces are upper-left and shaded faces lower-right.
  - Soft ambient-occlusion gradients sit at the bases of objects.
- **Dormant states** are made at runtime (ColorMatrix), not drawn separately.
- **Sheets:** "sheet" means several frames laid out horizontally in one SVG at equal widths; the frame count is given.
- **Size budget:** under 1 MB for the whole biome after rasterization caching (02 doc).
- Sizes are **w×h px at 1×**.

### 7.2 L0 · Sky (7)

| # | id | Size | Description |
|---|---|---|---|
| A01 | `sky_day` | 1920×1080 | 3-stop vertical gradient `#D8D4CF` → `#E8DCD2` (45 %) → `#F4E7DA`, with a 1 px noise dither pattern at 3 % |
| A02 | `sky_peach` | 1920×1080 | `#E9C9C0` → `#F2D8C8` → `#FAE9D8`, same dither |
| A03 | `sky_dusk` | 1920×1080 | `#9E86D8` → `#C9A0DE` → `#F2B8D4`, plus a warm band `#F7C9B8` at 85 % height |
| A04 | `cloud_band_a` | 2400×300 | 5 overlapping long lozenge clouds; tops white at 35 %, undersides lavender `#E6DDEA` at 50 %; edges softened with radial gradients |
| A05 | `cloud_band_b` | 2400×260 | as A04, sparser (3 clouds), thinner |
| A06 | `star_field` | 1920×640 | 140 star points (1–3 px circles, white or `#CFEFFF`), denser toward the top; 6 larger 4-point stars (8 px) |
| A07 | `vesper_star` | 180×180 | a 14 px `#FFF4D6` core, a 4-point cross flare (hairlines 70 px) and a radial glow `#F6D27A` 0 % → 45 % |

### 7.3 L1 · Far canyon (6)

| # | id | Size | Description |
|---|---|---|---|
| A08 | `far_mesa_day` | 3840×620, tileable | flat-topped buttes with vertical fluting (4–7 flutes per butte, a lighter left edge), single fill `#8FA6A0`, with a vertical gradient to 40 % sky haze at the base. Heights vary between 180 and 520 |
| A09 | `far_mesa_peach` | 3840×620 | the same silhouette in `#C9A99E` |
| A10 | `far_mesa_dusk` | 3840×620 | the same silhouette in `#7E6A9E`, with the rim-light edge `#B7A2D9` on the upper-left faces |
| A11 | `far_orrery_tower` | 520×900 | a stepped cream tower (3 tiers narrowing upward, `stone.base` with `stone.lit` left faces), navy bands at each tier cap, a dome cap with a lens socket, and an arched window row. Painted with 30 % haze |
| A12 | `far_orrery_rings` | sheet 3 × 460×460 | three thin gold ellipse rings (stroke 10, `gold.base` with a `gold.hi` inner edge) at 20°, 35° and 50° tilt, each its own frame so the finale can spin them |
| A13 | `far_aqueduct` | 2400×420 | a row of 6 cream arches on piers along a cliff line, with navy string-course bands. 35 % haze |

### 7.4 L2 · Mid-far (5)

| # | id | Size | Description |
|---|---|---|---|
| A14 | `midfar_crystal_field` | 3000×700 | 9 clusters of prismatic spires (each spire a tall hexagonal prism drawn as 3 facets: `crystal.hi` `#C9F3FF` left, `crystal.base` `#6ED2F2` middle, `crystal.shade` `#2E8FC0` right), heights 180–640, leaning ±8°, with 20 % haze |
| A15 | `midfar_canopy_blue` | 2800×500 | rounded canopy masses (overlapping circles, 3 tones: `#8CC0EE` highlight caps, `#5A95D6` body, `#3F6FA8` underside) on thin grey trunks |
| A16 | `midfar_canopy_salmon` | 2800×500 | as A15 in `#F4AE80` / `#E48C5E` / `#B8643E` |
| A17 | `midfar_arch_ruins` | 2400×600 | 3 half-buried cream arches with navy capitals and fallen blocks. Two-tone lit/shade, 20 % haze |
| A18 | `midfar_waterfall_thin` | 200×700 | a thin fall: 2 vertical bands (`#EAF8FB` and `#8FE0EA`), a mist puff at the base (white radial blobs) |

### 7.5 L3 · Mid (7)

| # | id | Size | Description |
|---|---|---|---|
| A19 | `mid_cliffwall_a` | 2048×900, tileable | stacked rounded-rectangle blocks (the 10.png cliff): `rock.base` `#5F7B7A` bodies, `rock.light` `#8FA6A0` top faces, `rock.shade` `#3F5857` undersides, 8 px dark-teal seams |
| A20 | `mid_cliffwall_b` | 2048×900 | variant of A19 with 5 crystal clusters growing from the seams (mini A45 style) and blue shrub tufts on ledges |
| A21 | `mid_terrace_wall` | 2048×600, tileable | a cream stone retaining wall in ashlar courses (`stone.base`, joints `stone.deep`), a 14 px navy band 40 px below the cap, a 6 px gold cap line, and round medallions (concentric rings, gold on cream) every 320 px |
| A22 | `mid_dome_interior` | 3000×1080 | a dome inner wall: 9 cream ribs converging upward (perspective), gold rib edges, `dome.violet` panels between the ribs, and a ceiling band with an **unlit star map** (constellation lines in `#B7A2D9` at 30 %; the lit versions are A136) |
| A23 | `mid_colonnade_vines` | 2400×700 | 6 cream pillars (navy capital bands, gold trim) under a continuous lintel, with salmon vines (`foliage.salmon` leaf clusters on thin stems) hanging from the lintel |
| A24 | `mid_waterfall_main` | 360×900, sheet 2 | a main fall with 2 frames of offset vertical streaks (`#EAF8FB`, `#8FE0EA`, `#4CB6D0`) for scrolling; a white foam lip at the top |
| A25 | `mid_gantry_truss` | 2048×600, tileable | the observatory rim's clockwork gantry seen behind the walkway: brass trusses, large idle gears (outlines, `orrery.brass` at 60 %) and navy rivet bands |

### 7.6 L4 · Ground and architecture (10)

| # | id | Size | Description |
|---|---|---|---|
| A26 | `ground_paving` | 512×200, tileable | cream irregular-polygon paving (5–7 sided stones, `stone.base` with `stone.lit` highlights, `stone.deep` joints), a gold 6 px lip on the top edge, the front face darker `stone.shade` |
| A27 | `ground_grass_edge` | 512×160, tileable | teal grass tufts (`grass.light` tips, `grass.base`, `grass.shade` bases) overhanging the paving lip by 40 px; 2 orange flower dots per tile (`foliage.rust`) |
| A28 | `ground_sand_path` | 512×120, tileable | `sand.path` `#EBCFAE` with soft darker ripples |
| A29 | `canal_channel` | 512×180, sheet 2 | frame 0: a dry channel (cream sides, `stone.deep` bed with silt streaks). Frame 1: water body `water.deep` `#4CB6D0` with a `water.shallow` highlight line at 20 % from the top and 6 gold fleck dots |
| A30 | `ledge_cap` | 256×64, tileable | a cream ledge top with a gold trim line and a navy band beneath |
| A31 | `stair_step_block` | 180×90 | a sandstone step (0.53 H): a top face with an engraved ring (bronze outline), a front face with a lit left strip |
| A32 | `cliff_edge_left` | 256×400 | a rock ledge termination facing right: A19 rock language with a grass cap |
| A33 | `cliff_edge_right` | 256×400 | the mirror of A32 with a different block arrangement |
| A34 | `pillar_parts` | sheet 3 (capital 160×120, shaft 120×256 tileable, base 170×90) | the capital has two navy bands and gold edges; the shaft is cream with a lit left strip and 2 shallow flutes; the base is stepped |
| A35 | `beam_pylon` | 140×520 | a cream pylon (3 H) with a navy capital, a gold ring socket at the top holding an orb (grey when dormant; the lit glow is added at runtime) and an emblem disc at mid-height |

### 7.7 Shared props and vegetation (26)

| # | id | Size | Description |
|---|---|---|---|
| A36 | `console_lectern` | 120×120 | a 0.7 H lectern: a cream pedestal with a navy band, a slanted top with a gold rim, and a dark slate screen (`#0F2A33`, the screen's content glow is A37). A small round emblem on the front |
| A37 | `console_slate_glow` | 100×60 | an additive cyan panel glow with 3 faint grid lines and a tiny sine squiggle (a micro-graph) |
| A38 | `pedestal_emitter` | 140×150 | the base disc with a **green ring** (value colour `fn.g`), a coiled bronze stem (3 loops) and an orb cradle on top. Its head is swappable (A103) |
| A39 | `node_ring` | 96×96 | a bronze ring (`bronze.ring` `#6E4A2E`) with 4 rivets and an inner bevel |
| A40 | `node_core_dormant` | 60×60 | a grey glass core `#9AA7AD` with a small highlight |
| A41 | `node_core_lit` | 60×60 | a `crystal.hi` core with a white centre (the halo is added via A71) |
| A42 | `map_pin` | 88×120 | a teardrop pin: fill `#1F4E5A`, 3 px white stroke, a white chevron below. The label is drawn by code |
| A43 | `interact_glyph` | 64×64 | a diamond outline (white) with 3 inner vertical lines (4.png style) |
| A44 | `crystal_tall` | 120×420 | a single 3-facet prismatic spire (see A14 tones) with a pointed tip and a small base cluster |
| A45 | `crystal_cluster` | 260×260 | 5 spires of varying height fanning from one root, 3-tone |
| A46 | `crystal_fan` | 220×200 | 3 wide shards in a fan |
| A47 | `bush_blue_a` | 220×140 | a rounded bush of 7 overlapping leaf-blob circles, 3 blue tones |
| A48 | `bush_blue_b` | 260×170 | a taller variant |
| A49 | `bush_salmon` | 220×150 | salmon tones |
| A50 | `shrub_rust` | 160×120 | spiky rust `#C4643C` shrub with orange tips |
| A51 | `tree_crystal_blue` | 420×620 | a **blue crystal tree**: a pale grey trunk `#B7C4C8` with 3 branches; the canopy is clusters of small blue crystal "leaves" (hexagon shards in `#8CC0EE` / `#5A95D6` / `#2E8FC0`) |
| A52 | `tree_salmon` | 460×600 | a trunk plus a round canopy of salmon leaf blobs; 5 loose falling-leaf shapes on the canopy edge |
| A53 | `tree_rust_small` | 260×340 | a young rust tree |
| A54 | `flower_tuft` | 80×50 | 3 orange-rust flower heads on teal stems |
| A55 | `lantern_post` | 60×220 | a cream post with a navy band and a glass lantern (the flame is A170's sheet; the empty lantern glass is `#F6D27A` at 20 %) |
| A56 | `journal_page` | 64×80 | a parchment page `#F4E7C9` with a curled corner, 3 ink lines, a gold wax seal |
| A57 | `wisp_indigo` | 48×48 | a teardrop wisp: core `#B9BAFF`, body `#6A6CF0`, wispy tail |
| A58 | `sighting_telescope` | 120×200 | a brass telescope on a tripod, with navy leather wraps |
| A59 | `gondola` | 360×280 | the intro gondola: a cream cabin with a gold roof ring, navy window bands, and a cable pulley on top |
| A60 | `lore_plaque_post` | 110×170 | a stone post holding a bronze plaque (the text is read in the UI) |
| A61 | `tablet_stack` | 180×120 | stacked stone tablets with engraved wave lines (Quill's perch) |

### 7.8 L5 · Foreground (7; runtime: 2 px blur, 70 % alpha, −15 % brightness)

| # | id | Size | Description |
|---|---|---|---|
| A62 | `fg_grass_a` | 600×180 | tall grass blades in dark teal `#3E7A70` to `#5FA597`, curving |
| A63 | `fg_grass_b` | 520×160 | as A62, a different rhythm |
| A64 | `fg_leaf_salmon` | 500×300 | a clump of salmon leaf blobs entering from the frame edge |
| A65 | `fg_leaf_blue` | 500×300 | a clump of blue leaf blobs |
| A66 | `fg_balustrade` | 1200×220 | cream balusters every 60 px, a navy rail cap with a **wave-crest** top profile (a sine silhouette, amplitude 6 px) |
| A67 | `fg_emblem_post` | 140×260 | a square cream post with a round emblem (concentric rings, navy dot centre) |
| A68 | `fg_crystal_shard` | 300×500 | one huge 3-facet shard entering from the bottom corner |

### 7.9 L6 · Light and particles (7)

| # | id | Size | Description |
|---|---|---|---|
| A69 | `light_leaf_dapple` | 2048×1024 | irregular leaf-shaped blobs, blue-grey `#6E7F9A`, heavily blurred via radial-gradient fills (used as a multiply at 25 %) |
| A70 | `light_godray` | 600×1080 | a slanted trapezoid, white 0 % → 40 % → 0 % across its width (additive) |
| A71 | `glow_radial` | 256×256 | a white radial gradient 100 % → 0 %, tinted at runtime (cyan, gold, indigo) |
| A72 | `particle_sparkle` | 24×24 | a 4-point star, white |
| A73 | `particle_dust_puff` | 128×128 | a soft cream puff made of 4 blobs |
| A74 | `particle_leaf_salmon` | 32×20 | a single salmon leaf |
| A75 | `particle_mist` | 512×256 | a soft white mist blob |

### 7.10 Contraptions e1 and e2 (19)

| # | id | Size | Pivot | Description |
|---|---|---|---|---|
| A76 | `vesper_disc` | 560×560 | centre | a cream stone disc. Concentric carved rings at r 270, 240 and 200 (navy inlay ring at 200); an 8-ray gold sun in the centre (r 90); 5 dark rectangular **spoke slots** (60×24) on the right rim at angles −30° … 30°. Lit upper-left gradient |
| A77 | `vesper_rail` | 640×640 | centre | a gold ring at r 310, 14 px wide (`gold.base`, `gold.hi` inner edge, `gold.deep` outer). 24 navy stud dots (4 px) every 15°. 4 large bosses (12 px) at 0°, 90°, 180° and 270°, with path-text labels "0" (plus a small sun glyph), "π/2", "π" and "3π/2" outside the ring in `orrery.engrave` 26 px |
| A78 | `vesper_carriage` | 90×70 | (45, 50) | a brass shoe gripping the rail (two roller circles) and a small emitter cup with a cyan orb (glow added) |
| A79 | `vesper_spoke_ledge` | 150×40 | (0, 20) | a gold-trimmed cream ledge with a navy underside band; a 0.47 H step (reused ×5) |
| A80 | `gauge_plumb_ruler` | 60×620 | top | a brass vertical ruler with ticks at 5 levels (−1 … 1) and a longer centre tick; a navy backing strip |
| A81 | `gauge_bob` | 40×40 | centre | a bronze bob / marker with a green-ringed centre (used for the sin bob; tinted blue for the cos marker) |
| A82 | `gauge_slide_ruler` | 620×60 | left | the horizontal twin of A80 |
| A83 | `vesper_lens` | 120×120 | centre | a crystal lens in a bronze rim bracket set into rock: 3-facet crystal disc (`crystal.*`), with the bracket's 3 claws |
| A84 | `fog_band` | 2400×520 | — | an arched band of soft fog: overlapping ellipses `#EDE6F2` at 85 % in the centre, fading to 0 at the edges (mask-friendly) |
| A85 | `ringgate_wall` | 900×760 | — | a cream wall with 5 vertical navy grooves (18 px), a gold cap line, and a dark arched **doorway recess** (153×221, `#2B3A44` → `#3F5857` gradient) centred at the bottom. Two round medallions high on the wall |
| A86 | `ringgate_outer_ring` | 408×408 | centre | a ring (outer r 204, inner r 170): gold rim, cream face band with an engraved **sine wave** running round it (`orrery.engrave`), and a **notch** 150 px wide at 6 o'clock (a clean cut with gold edge caps) |
| A87 | `ringgate_inner_disc` | 340×340 | centre | a cream disc with 3 navy inlay rings and a doorway **cutout** (153×221, arched top) from its bottom edge. A small gold hub boss in the centre |
| A88 | `ringgate_fin_left` | 120×360 | (120, 360) | the left half of the gold keystone "crown" fin: tall and tapered, with an inner navy slot line |
| A89 | `ringgate_fin_right` | 120×360 | (0, 360) | its mirror |
| A90 | `ringgate_tally` | 140×140 | centre | a small gold escapement wheel with 6 teeth; path-text numerals on the face "0 I II III IIII V" |
| A91 | `ringgate_pawl` | 80×120 | (20, 10) | a bronze latch pawl with a hooked tip |
| A92 | `canal_skiff` | 260×110 | — | a small cream-and-gold skiff with a navy stripe and a lantern post |
| A93 | `light_shaft` | 300×700 | — | a warm-white additive trapezoid, brightest near the doorway |
| A94 | `water_front_splash` | sheet 4 × 160×120 | — | the splash crest frames for the travelling water front |

### 7.11 Contraptions e3/e5 and e4 (22)

| # | id | Size | Pivot | Description |
|---|---|---|---|---|
| A95 | `automaton_body_a` | 200×420 | feet | a bell-chested choir automaton: cream shell, gold bands at the waist and shoulders, a navy faceplate with two round cyan eye-lenses, a **gold bell** set in the chest (with a slate slot beneath), tall cylindrical hat |
| A96 | `automaton_body_b` | 200×420 | feet | a variant with a rounded head, collar ruff plates and a longer robe skirt |
| A97 | `automaton_body_c` | 200×420 | feet | a variant with a squat body, broad shoulders and a crest fin on the head |
| A98 | `automaton_faceplate_open` | sheet 2 × 80×120 | hinge | the two faceplate halves swinging open, with a dark interior |
| A99 | `automaton_slate` | 150×100 | — | a chest slate: `#0F2A33` screen with a bronze frame (the mini trace is drawn by code) |
| A100 | `claim_plaque` | 220×80 | — | an engraved brass plaque with bevels (the text is drawn by code) |
| A101 | `mimic_crab` | 180×120 | centre | a clockwork crab: a brass dome shell with rivets, two stalk eyes (cyan), and one oversized **caliper claw** |
| A102 | `mimic_leg` | 60×20 | (0, 10) | a thin jointed leg (reused ×6, animated by rotation) |
| A103 | `tuning_lens_head` | 100×100 | centre | a brass lens housing on a pivot yoke, cyan glass front |
| A104 | `echo_lift_platform` | 360×80 | — | a brass platform with a navy rail, a **resonator fork** (tuning-fork shape) on its right end, and chain anchors |
| A105 | `lift_chain` | 20×512, tileable | — | bronze chain links |
| A106 | `chasm_edge_left` | 400×700 | — | the rock edge facing the gap: A19 language, crystal roots dangling, mist-softened base |
| A107 | `chasm_edge_right` | 400×700 | — | the mirror plus a different crystal arrangement |
| A108 | `glyph_stone` | 220×70 | centre | a sandstone plank-stone with bevelled edges, a gold seam groove along the middle, and a circular glyph recess at its left (the icon comes from A109) |
| A109 | `span_glyphs` | sheet 5 × 64×64 | — | icons in engraved bronze lines: 1 a balance with "÷2"; 2 an angle wedge at 30° with an arc; 3 a circle with its upper half shaded; 4 twin beacons; 5 a "sin⁻¹" arrow pointing into a circle |
| A110 | `chasm_mist_column` | 400×600 | — | rising mist, white at 0 → 35 % |
| A111 | `anchor_cable` | 16×256, tileable | — | braided bronze cable |
| A112 | `chasm_crystal_roots` | 300×260 | — | hanging crystal-root tendrils |
| A113 | `span_socket` | 140×60 | centre | an elliptical ring socket: bronze rim, a cyan inner glow ring (dormant grey by runtime tint) |
| A114 | `plank_cradle` | 300×260 | — | a brass rack with 5 bays and a navy base plinth |
| A115 | `anchor_pylon` | 120×460 | — | a cream pylon with a navy band and a beacon crystal cradle on top (the crystal is dark `#3F5857` until lit) |
| A116 | `stone_crumble` | sheet 4 × 220×120 | — | glyph stone crack → split → 5 fragments → fragments falling apart |

### 7.12 Treasury, boss and gantry (20)

| # | id | Size | Pivot | Description |
|---|---|---|---|---|
| A117 | `treasury_chest` | 220×150 | — | a gold-banded cream chest with a navy panel and a round **lock-dial** (concentric rings) on the front |
| A118 | `treasury_chest_lid` | 220×80 | hinge (0, 80) | a curved lid with gold banding |
| A119 | `warden_keystone` | 90×90 | centre | a gold disc with an engraved wave glyph |
| A120 | `warden_torso` | 520×620 | hips | a stacked cream stone breastplate over brass ribs; navy inlay chevrons; a central round emblem; shoulders as big rounded pauldrons |
| A121 | `warden_head` | 260×240 | neck | a domed helmet with a single horizontal **visor slit**, a gold crest ridge and brass cheek plates |
| A122 | `warden_visor_glow` | 220×40 | — | an additive cyan slit glow |
| A123 | `warden_arm_upper` | 140×360 | shoulder | a brass-jointed stone upper arm |
| A124 | `warden_arm_lower` | 120×320 | elbow | a forearm with a gauntlet gripping the shield bar |
| A125 | `warden_shield` | 420×420 | centre | a round shield: concentric rings (the Variant gate language), gold rim, navy inner band with engraved path-text **"3 sin(π/2 · t)"**, a central boss (the sync-thread anchor) |
| A126 | `warden_plinth` | 700×260 | — | column-legs merged into a stepped plinth; gold trim |
| A127 | `pendulum_pylon` | 140×520 | top pivot | a 3 H gold pylon with a navy band, a bracket arm at the top, and a small engraved "T" plate |
| A128 | `star_door` | sheet 2 × 260×700 | — | two tall cream door leaves with gold star inlays (constellation lines) and a navy frame |
| A129 | `pendulum_arm` | 30×300 | top | a brass rod |
| A130 | `pendulum_bob` | 80×80 | centre | a bronze bob with a cyan core |
| A131 | `span_tiles` | 700×60 | — | 7 engraved floor tiles with path-text numerals −3 … 3, a gold centre tile |
| A132 | `gantry_walkway` | 512×160, tileable | — | a brass-grate walkway with navy side rails |
| A133 | `gantry_gear_platform` | 300×300 | top | a large gear with a flat platform top, hanging from a short arm |
| A134 | `period_plaque` | 90×60 | — | a small brass plaque (T value drawn by code) |
| A135 | `gantry_ladder` | 60×200, tileable | — | brass ladder |
| A136 | `dome_constellations` | sheet 7 × 400×260 | — | 7 lit constellation figures (white points, 1.5 px `#CFEFFF` lines) for the dome ceiling: Ring, Wheel, Owl, Lantern, Span, Bell, Star Door |

### 7.13 Characters (38)

**Wren puppet (18 parts, shared rig with named pivots; 1 H = 170 px).**

| # | id | Size | Description |
|---|---|---|---|
| A137 | `wren_head` | 54×62 | side-profile head, skin `#A8714F` with a `#8A5A3E` jaw shadow, a small nose, an ear |
| A138 | `wren_hair_bun` | 50×44 | dark hair `#2B2A33` cap plus a high bun, with a gold pin |
| A139 | `wren_eyes` | sheet 2 × 20×12 | open eye (dark iris, white catch-light) / blink line |
| A140 | `wren_torso` | 56×70 | a cream tunic with a navy vest overlay and a gold buckle |
| A141 | `wren_scarf_knot` | 40×26 | a teal scarf wrap at the neck, `#4FA3A0` / hi `#7CC7C0` |
| A142 | `wren_scarf_tail_a` | 70×18 | a long tail, pivot at the knot |
| A143 | `wren_scarf_tail_b` | 58×16 | a second tail |
| A144 | `wren_upper_arm_f` | 18×40 | a sleeve in cream |
| A145 | `wren_upper_arm_b` | 18×40 | the far arm, 10 % darker |
| A146 | `wren_forearm_f` | 16×44 | forearm plus hand, skin |
| A147 | `wren_forearm_b` | 16×44 | far, darker |
| A148 | `wren_thigh_f` | 22×44 | dark-teal trousers `#2F5A5E` |
| A149 | `wren_thigh_b` | 22×44 | far, darker |
| A150 | `wren_shin_f` | 20×52 | trouser plus a tan boot `#C69A6B` |
| A151 | `wren_shin_b` | 20×52 | far, darker |
| A152 | `wren_satchel` | 34×30 | a brown satchel `#8A5A3E` with a flap and a buckle |
| A153 | `wren_staff` | 20×190 | a brass rod with a small astrolabe (2 concentric gold rings) at the tip |
| A154 | `emote_bubbles` | sheet 3 × 48×48 | `!`, `?`, `♪` in white on `ui.card.deep` rounded bubbles |

**Cog (7 parts, 0.35 H ≈ 60 px tall).**

| # | id | Size | Description |
|---|---|---|---|
| A155 | `cog_body` | 56×56 | a round brass body with a glass belly window (dark interior) |
| A156 | `cog_belly_gears` | 30×30 | two meshing gears (they rotate) |
| A157 | `cog_head` | 52×40 | a head with two big lens eyes (gold rims, cyan irises, white catch-lights) and gear-tooth ear tufts |
| A158 | `cog_wing_l` | 40×30 | layered brass feather plates with a navy stripe |
| A159 | `cog_wing_r` | 40×30 | mirror |
| A160 | `cog_feet` | 24×12 | small talons |
| A161 | `cog_key` | 18×22 | a wind-up key on the back |

**Brasswick (5 parts, 0.9 H).**

| # | id | Size | Description |
|---|---|---|---|
| A162 | `brasswick_body` | 100×110 | a copper barrel body on 2 treads, moss tufts on the shoulders |
| A163 | `brasswick_head` | 60×50 | a round head with one lens and a cream brimmed cap |
| A164 | `brasswick_arm` | sheet 2 × 90×20 | jointed arm segments |
| A165 | `brasswick_can` | 50×40 | a copper watering can |
| A166 | `water_drop` | 12×16 | a droplet particle |

**Lumen (4 parts, 1.2 H).**

| # | id | Size | Description |
|---|---|---|---|
| A167 | `lumen_body` | 70×150 | a slender body with navy coat plates |
| A168 | `lumen_lantern_head` | 60×70 | a glass lantern head with a brass cap |
| A169 | `lumen_pole` | 14×180 | a pole-arm with a flame hook |
| A170 | `flame` | sheet 3 × 30×50 | flame frames (`#F6D27A` / `#F4A95A` / white core). Used by Lumen, the lantern posts and the Music Box |

**Quill (3 parts, 0.3 H).**

| # | id | Size | Description |
|---|---|---|---|
| A171 | `quill_shell` | 50×32 | a lacquered navy beetle shell with a gold edge |
| A172 | `quill_legs` | sheet 2 × 50×16 | legs, 2 frames |
| A173 | `quill_feather` | 40×12 | a cream quill feather held in the mandibles |

**Ilse (finale, 1).**

| # | id | Size | Description |
|---|---|---|---|
| A174 | `ilse_constellation` | 360×520 | a standing figure drawn only as ~24 star points (white, 3–6 px, with glow) joined by 1 px `#FFF4D6` lines; a long coat silhouette and a raised hand. Deliberately not a portrait |

### 7.14 UI (20; React SVG components or `public/.../ui/*.svg`)

| # | id | Size | Description |
|---|---|---|---|
| A175 | `emblem_cog` | 64×64 | a `ui.card.deep` disc with 3 concentric broken rings (outer gold `#D9A441` with 2 gaps; middle white with 3 gaps; inner white with 1 gap) and 2 small filled circles in the centre (owl eyes) |
| A176 | `emblem_warden` | 64×64 | the same frame, bronze rings, a vertical slit in the centre |
| A177 | `emblem_brasswick` | 64×64 | green-rimmed rings with a leaf-shaped gap |
| A178 | `emblem_lumen` | 64×64 | gold rings with a flame-shaped gap |
| A179 | `emblem_quill` | 64×64 | white rings with a nib mark |
| A180 | `emblem_mimic` | 64×64 | broken rings with one jagged gap |
| A181 | `emblem_ilse` | 64×64 | a ring with a 4-point star |
| A182 | `emblem_narrator` | 64×64 | 3 tilted ellipses (a mini Orrery) |
| A183 | `info_button` | 64×64 | a white "i" in a double ring |
| A184 | `objective_ring` | 55×55 | a double ring with 6 segment masks (the fill is drawn by code) |
| A185 | `hex_pattern` | 44×38 tile | a flat-top hexagon, 1 px `ui.hex` stroke |
| A186 | `back_arrow_tab` | 150×44 | a `ui.card.deep` tab, 1.5 px `ui.line` border, a white left arrow |
| A187 | `verify_frame` | 384×54 + traces | a button frame with trace lines ending in dots on both sides |
| A188 | `badge_frame` | 240×90 | a two-line badge box with bracket connectors above and below (short lines ending in dots) |
| A189 | `scrubber_knob` | 28×36 | an orange teardrop (`ui.accent`, 2 px `ui.accent.deep` outline), pointing up |
| A190 | `singer_icons` | sheet 3 × 40×40 | bell A/B/C glyphs matching the A95–A97 silhouettes, white line art |
| A191 | `map_profile` | 1200×600 | the Orrery Map base drawing: the terrace profile in `ui.line` circuit traces, 8 node circles, the tower at top right with 6 beam slots |
| A192 | `journal_reader` | 700×520 | a parchment card frame inside the panel (parchment `#F4E7C9`, gold corner ornaments, ink `#3A2E2A`) |
| A193 | `title_wordmark` | 900×200 | "THE ORRERY TERRACES" as letter-spaced path-text in `stone.lit`, with a thin gold rule and 3 tilted ellipses behind it; the subtitle "The Clockwork Crypt" smaller |
| A194 | `hud_icons` | sheet 3 × 24×24 | page, wisp and beam icons for the counters and the map |

### 7.15 Drawn by code (no files; listed so nobody draws them)

- Beams: 3 stacked additive lines plus a glow cap.
- Sync thread and its sag.
- The Vesper sweep arc.
- The ring misalignment arc.
- Graph curves, grids, axes and ticks.
- The unit circle card.
- Value chips, readouts, pins' labels and the plaque text.
- The chevrons in e1's failure.
- The fog alpha mask.
- The water front travel (alpha and scroll).
- The dotted guide lines in e4.
- ColorMatrix dormancy.
- The beam lines in L1.
- The star twinkle.
- The mini traces on the automaton slates.

### 7.16 Totals

| Group | Count |
|---|---|
| L0 sky | 7 |
| L1 far | 6 |
| L2 mid-far | 5 |
| L3 mid | 7 |
| L4 ground and architecture | 10 |
| Shared props and vegetation | 26 |
| L5 foreground | 7 |
| L6 light and particles | 7 |
| Contraptions e1 + e2 | 19 |
| Contraptions e3/e5 + e4 | 22 |
| Treasury, boss, gantry | 20 |
| Characters | 38 |
| UI | 20 |
| **Total** | **194 asset files** (some are multi-frame sheets) |

---

## 8 · Fidelity mapping (bible §9 checklist, 36 items)

- The "Verify at" column says what the Wave-4 critic should capture: 1920×1080 screenshots or short captures.
- ★ marks a mandatory item.
- **Expected score: 36/36.** Item 14 is history-only and is scored pass as not-applicable.
- All 11 ★ items are met by construction.

| # | Item | How this game satisfies it | Verify at |
|---|---|---|---|
| 1 ★ | Painterly parallax (≥ 5 layers) | Every scene has L0 sky (0.0), L1 far mesas plus the Orrery tower (0.15), L2 crystal field and canopies (0.35), L3 cliffs, walls and colonnades (0.6), L4 play (1.0) and L5 foreground (1.3), plus L6 light. The factors are in §2.4 | walk S0 left→right; ≥ 4 layers visibly scroll at different rates |
| 2 ★ | No 1-bit tiles | The expedition host loads only `orrery_terraces/manifest.json`. The Kenney tilesheet is not loaded on showcase routes (a host test asserts no texture key `tiles`) | any screen |
| 3 | Sky gradient ≥ 3 stops per biome table | A01–A03, 3 stops each, matching bible §2.2 day, crystal-cliff and dusk rows | S0, S4, S6 |
| 4 | Architecture vocabulary (≥ 3 motifs) | Rings (dials, gates, medallions), gold trim (caps, rims), navy inlay bands (walls, pillars, balustrade) and pillars/pylons in every scene | every scene |
| 5 | Soft lighting | Contact shadows `#6E7F9A` at 30 % multiply, blurred; upper-left key light; the darkest world colour is `#2B3A44` (the doorway recess) | S2 gate close-up |
| 6 | Glow = live | Dormant scenes and contraptions have ColorMatrix −40 % saturation and no glow. Beams, nodes, lenses and consoles glow only when active. Solved scenes re-saturate over 1 s | S1 before and after e1 |
| 7 | Foreground framing | An L5 element (A62–A68) crosses the bottom edge in every scene. The host culls any L5 sprite overlapping a contraption's bounds | 8 scene captures |
| 8 | Biome identity | Cream terraces, blue crystal trees and ring machines: a canyon temple, distinct from the cell colonnade and the archive city | thumbnails of all 3 games |
| 9 ★ | Articulated protagonist, 14–18 % height | Wren is an 18-part SVG puppet, 170 px = 15.7 % of screen height, with idle, walk, run, jump, climb, interact, think, celebrate, ride and wind (§3.1) | walking capture: limbs move |
| 10 | Scale ladder (hub ≥ 4 H, console ≈ 0.7 H) | The Z1 hub is the Tidewheel wall (4.5 H); the Z2 hub is the Echo Lift shaft (4.2 H travel frame); the Z3 hub is the Warden (5.5 H); the Orrery tower dominates L1. Consoles are 0.7 H (A36) | S2, S3, S6 |
| 11 ★ | Guide presence | Cog hovers at Wren's shoulder in Explore, and his emblem A175 sits in the bar | any explore and any panel frame |
| 12 | Purpose on screen | The Rhythm ring (6 segments) plus "Rhythms n/6". It fills after each seal, derived from `solvedEncounterIds` | after e1 |
| 13 | Story beats in world terms | Every encounter has approach, instruction, success (insight), success2 and after lines, each naming the machine (§4.4) | panel frames |
| 14 | Sensitivity (history only) | N/A. Every character is fictional; Ilse appears only as a constellation outline | — |
| 15 ★ | World visible ≥ 45 %, undimmed | Scrub (e1, e2, e6) leaves 59 % world; Board (e3, e4, e5) leaves 45 %. No dimming; the camera re-centres the contraption | any panel frame |
| 16 | Panel material | `PanelFrame`: `ui.panel` rgba(38, 92, 106, 0.86), backdrop blur 6 px, hex grid A185 | panel |
| 17 | Circuit-trace lines (≥ 3 terminals) | The left rail with hollow-circle ends; Verify traces with dots; badge brackets; claim and stone column terminals; the span schematic traces | panel |
| 18 ★ | Graph cards | `GraphCard` with corner tabs (f/g/h or "θ", "sin θ", "cos θ", "ghost", "laps", "shield", "pendulum", "drift", "reference", "claim"), labelled ticks, and a major/minor grid. e1 also has the `UnitCircleCard` | e1, e2, e6 panels |
| 19 | Axis units | π labels on e1, e2, e3, e4 and e5 (0, π/2, π, 3π/2, 2π; e5 up to 4π); e6 is numeric seconds because its answer 4 is not a π multiple (the readout shows "4.00", chip "T: 4.00 s") | panels |
| 20 | Function colours consistent | f white: the reference, shield or main wave. g green: sin θ, the ghost, the claim trace, the pendulum. h blue: cos θ, laps, \|y\|, drift. World chips use the same border colour as their card | e1 world plus panel |
| 21 ★ | Orange input scrubber | e1/e2/e6: the scrubber *is* the control. e3/e4/e5: an orange **probe** scrubber on the cards. Every one has an orange line across all stacked cards, a teardrop knob on a labelled ruler, and an input tab plus readout | all panels |
| 22 | Value chips on the card edge with units | `ValueChip` at the current value's y on each card, formatted "0.50", "−0.87", "0.75π", "4.00" | e1, e2, e6 |
| 23 | Back arrow | `back_arrow_tab` A186 on every panel; it closes without grading (`u.back`) | any panel |
| 24 | Verify named for the machine, trace-flanked, disabled until complete | ALIGN THE DIAL, LOCK THE RINGS, EXPOSE THE MIMIC, LAY THE SPAN, MATCH THE RHYTHM. Disabled until a singer is aimed (e3, e5), all 4 sockets are filled (e4), or the knob has moved at least once (e1, e2, e6) | panels |
| 25 | Success badge | VESPER ALIGNED, RINGS LOCKED, MIMIC EXPOSED, SPAN LOCKED, RESONANCE LOCKED, each with bracket connectors (A188) | success frames |
| 26 | Board tokens from a palette, snap, keyboard | The claim column (keys 1–3, ↑/↓) and the stone column (Tab, Enter, 1–4, Backspace); stones snap to sockets | e3, e4 |
| 27 ★ | Bar anatomy | Emblem (broken concentric rings), the "i" button below it, and text to the right; the emblem changes with the speaker | any panel |
| 28 | Sentence style | Instructions are imperative and name the object ("Swing the carriage…", "Lay the glyph stones…"); insights are single declarative truths | bar |
| 29 | Legibility | ≥ 28 px at 1920 wide, white on the panel, contrast ≥ 7:1 | bar |
| 30 ★ | Live reaction (≥ 3 intermediate poses) | e1: carriage, beam, plumb bob, cosine marker. e2: the outer ring turns, the inner disc rocks, the tally ratchets, plus the release replay. e3/e5: the lens swings, the beam retargets, the bells hum. e4: stones fly to sockets. e6: the pendulum rate changes and the thread's brightness beats | drag captures |
| 31 | World chips and pins | Pins: "5π/6" (e1), "I" (e2), bell (e3/e5), "x₁" and "x₂" (e4), metronome (e6). Chips: θ bracket, sin θ, cos θ (e1); y, laps (e2); aim (e3/e5); T (e6) | world |
| 32 | Eased physicality (lag ≤ 0.4 s) | Every pose eases with τ = 0.1–0.12 s (about 0.3 s to 95 %); stones fly on 0.45 s arcs; nothing teleports | drag capture |
| 33 | Partial feedback without the answer | e1: direction chevrons with distance bands. e2: the misalignment arc plus the tally count. e3/e5: the honest singer is marked. e4: the correct prefix locks, x₁ lights, the x₂ cable hangs slack. e6: the thread beats at \|1/4 − 1/T\| Hz. The mode's feedback shows verbatim | failure frames |
| 34 ★ | In-world success animation, 1.2–2.5 s, with sound hook | e1 2.4 s, e2 2.2 s, e3 2.4 s, e4 2.5 s, e5 2.5 s, e6 2.5 s; every one has named sound cues (§6.8) | success captures |
| 35 ★ | Payoff is traversal (the only route) | e1 spoke-stair (+400 px), e2 doorway, e3 lift (+500 px), e4 span (900 px gap), e5 rim stair (+400 px), e6 Star Door → finale. Jump height is 187 px, so none can be bypassed | walk after each |
| 36 | Visible misconception | e1: "π = full turn" fires the beam into the floor at 5π/3. e2: T > π over-laps and the tally reads II. e3: the mimic's bracket spans trough to peak. e4: the second anchor stays dark. e5: the 4π bracket holds 4 cycles. e6: the huge swing versus the small pendulum in lockstep; the span tiles | failure captures |

---

## 9 · Generalization notes (for PDF-generated games)

### 9.1 Which contraptions are reusable (code; the library keyed by `familyId.mode`)

| Contraption id | Mode(s) | Reusable for any game with that mode? | Derived generically from `view`/`params` | Needs from the overlay (subject-specific) |
|---|---|---|---|---|
| `arc_rail` (Vesper Dial) | `mapper.number_line` | **Yes.** It becomes a **circular rail** when `labels === "pi"` and `max − min = 2π` (sin and cos gauges then turn on automatically), a **straight rail** otherwise, and a **log rail** when `scale === "log"` (studs at powers) | ruler, landmarks, hairlines (`landmarkStep/6`), bracket readout, pose, the parity test | nouns (dial, star, lens), the payoff kind (`stair` \| `door` \| `bridge`), a hidden-target flavour (fog, dark, water), probes |
| `ring_gate` (Tidewheel) | `tuner.oscillator` (any `ask`) | **Yes.** Ring angle = `b·T`. For `ask: phase`, the notch offset is `c` and the ghost shifts by the dial. For `frequency`, the latch fires every `1/f`. For `amplitude`/`midline`, it switches to a **counterweight** variant (inner disc rock scale ∝ A; hub height ∝ d) | all 3 cards (f, ghost, laps), tally, locked predicate | nouns, what flows through when open (water, light, air) |
| `pendulum_sync` (Warden's Shield) | `tuner.oscillator` (period, frequency) | **Yes.** It is a real-time sync against the view's wave; the guardian is a skin | f, g, drift cards, sync-thread maths, beat frequency | guardian look and lines, the engraved equation (from `view.equation`), the span-tile unit |
| `claim_choir` (Echo Choir / Treasury) | `truth_finder.mimic`; also `predict_reveal` (aim = option; the reveal plays on success) | **Yes.** Three to four claim-holders plus an aimable lens and a live comparison card. Without `claimTraces`, the g card becomes an **evidence card**: the aimed claim's text beside the encounter's `sourceRef.quote`, with the same noun map | aim geometry, display order → plinths, noun map | `claimTraces` (math/science claims that can be drawn), holder skin (singers, specimen pods, proof press) |
| `plank_span` (Solving Span) | `sequencer.linear`; `sequencer.cycle` becomes a ring of sockets | **Yes.** Stones fly to sockets; the prefix-lock failure; decoy crumble | sockets from `view.slots`, stones from `view.planks` | `stepEffects` from a fixed vocabulary; stone glyphs picked from a glyph library by keyword; how many anchors (2 here because the concept has two solutions) |

**The generic success grammar** (badge → insight → in-world animation → re-saturate → beam to the hub → traversal)
and **the aid-tier ladder** are code and apply to every contraption.

### 9.2 What is subject-specific, and who writes it ("World Writer" agent)

The **World Writer** is a future pipeline agent that writes the overlay after the challenge slices exist, so it
knows each encounter's mode, params and misconception. It writes **text and data only**, never geometry or
maths. The table shows what it wrote (by hand) for this game:

| Overlay field | This game's value (example) | Constraint enforced in code |
|---|---|---|
| `biomeId` | `orrery_terraces` | enum of existing biome kits (art is hand-built, §7) |
| `title`, `subtitle` | "The Orrery Terraces" / "The Clockwork Crypt" | ≤ 40 chars |
| `purpose.{broken, stakes, restored, whyConcepts}` | §1.2–1.5 | each ≤ 280 chars |
| `objectiveNoun` | "Rhythms" | ≤ 16 chars |
| `guide` | `{characterId: "cog", emblemTint: "gold", companion: "brass_owl"}` | the character exists in the spec; tint and companion from enums |
| `cast[]` | Brasswick, Lumen, Quill, Mimic, Ilse, Narrator with `voiceArchetype` | `VoiceArchetype` enum; ≤ 6 extra |
| `zones[]` | 3 zones with name, sky preset and scene ids | sky preset enum per biome |
| `intro[]`, `outro[]` | shot lists §4.3 and §4.5 (line ids, shot preset) | shot preset enum; lines ≤ 140 chars |
| `scenes[]` | S0–S7: `{sceneId, encounterId \| null, name, chunkIds, contraptionId, skin: {nouns}, npcs[], collectibles[], secrets[]}` | `contraptionId` must list the encounter's `familyId.mode`; chunk ids exist |
| `encounters[id].lines` | approach, approach2, instruction, tutorial, hint1–3, fail variants, success (insight), success2, after | ≤ 140 chars. The **answer-placeholder ban** applies to approach, instruction, tutorial, hint1 and fail (LIBRARY §9.3). hint3 content must not exceed the fixture's `hints[2]` |
| `encounters[id].probes[]` | `{when: {kind: "nearValue", value: "5*pi/3", tolFactor: 1}, lineId}` | predicates from a fixed vocabulary (`nearValue`, `keyInSlot`, `decoyPresent`, `aimedIndex`), and they must derive from `targetMisconception` |
| `encounters[id].pins[]`, `chips[]` | "5π/6", "I", "x₁"/"x₂", a bell glyph, a metronome glyph | a pin may show only the target already in `view` (e.g. `view.target`), a count, or a glyph; never the answer of an `ask` |
| `encounters[id].claimTraces` | per `statementIndex`: `{fns: [{expr, style}], brackets: [{x0, y0, x1, y1, label}]}` | exact mathjs strings that must evaluate and lie inside the card range; keyed by statementIndex |
| `encounters[id].stepEffects` | `{s0: "scaleEquation", s1: "markAngle", s2: "shadeQuadrants", s3: "markSolutions", d0: "missCircle"}` | the keys exist in the params; effects come from the vocabulary |
| `encounters[id].feedbackNouns` | `{"chest": "singer"}` | display-only substitution |
| `plaques[]`, `journal[]` | §6.3 and §6.4 | each journal page cites a `sourceRef` that already exists in the spec (verified quote) |
| `npcQuests[]` | §6.5 | fixed step vocabulary (`talk`, `afterSeal`, `collect`) |

### 9.3 Proposed schema for the architect (strict-mode legal; not implemented)

For the showcase this lives in the side-car `WorldOverlay` (`src/contracts/world.ts`, `00-runtime-map.md` §3.3 A).
For generated games it becomes a `WorldSlice` that the World Writer fills. It follows `instructions.md` §4:
- root object;
- every field required, `.nullable()` never `.optional()`;
- no `z.record` (records become arrays of `{key, value}`);
- `z.union`, not `discriminatedUnion`;
- bounded ints;
- dynamic enums for encounter ids, character ids and contraption ids.

```ts
WorldSlice = {
  biomeId: Enum<BiomeKits>, title: string, subtitle: string | null, objectiveNoun: string,
  purpose: { broken: string, stakes: string, restored: string, whyConcepts: string },
  guide: { characterId: Enum<CharacterIds>, emblemTint: Enum<Tints>, companion: Enum<Companions> },
  cast: { id: string, name: string, role: string, voiceArchetype: VoiceArchetype, emblem: Enum<Emblems> }[],
  zones: { id: string, name: string, skyPreset: Enum<SkyPresets> }[],
  intro: { shot: Enum<ShotPresets>, speakerId: string, text: string }[],
  outro: { shot: Enum<ShotPresets>, speakerId: string, text: string }[],
  scenes: {
    id: string, zoneId: string, name: string, encounterId: Enum<EncounterIds> | null,
    contraptionId: Enum<ContraptionIds> | null,            // validated against the encounter's mode
    nouns: { key: string, value: string }[],               // "machine": "Tidewheel Gate", "flow": "water"
    lines: { slot: Enum<LineSlots>, speakerId: string, text: string }[],
    probes: { predicate: Enum<ProbeKinds>, arg: string, lineSlot: Enum<LineSlots> }[],
    pins: { anchor: Enum<AnchorSlots>, label: string }[],
    claimTraces: { statementIndex: int, fns: { expr: string, style: Enum<"solid", "dashed"> }[],
                   brackets: { x0: string, y0: string, x1: string, y1: string, label: string }[] }[],
    stepEffects: { key: string, effect: Enum<StepEffects> }[],
    feedbackNouns: { from: string, to: string }[],
    collectibles: { kind: Enum<"page", "wisp">, title: string, text: string, sourcePage: int | null }[],
    npcs: { castId: string, questSteps: Enum<QuestSteps>[] }[],
  }[],
}
```

**Code-owned (never the model):**
- contraption geometry, pose functions, tolerance parity;
- aid tiers;
- the success grammar;
- art;
- `LiveDraft` plumbing;
- the choice of skin from nouns;
- validation of all the constraints in §9.2.

**Mock mode:** a recorded World Writer response is needed for `mock-models.test.ts` parity, and it must be added
before `GameSpec` gains the field (`00-runtime-map.md` §3.3 B).

### 9.4 Porting checklist: from a new PDF to this level of fidelity

1. The pipeline makes the spec as today (units, concepts, encounters with modes and misconceptions).
2. Code picks each encounter's **contraption**: the default archetype for its mode (bible §8 table and §9.1 here), with alternates by socket and role (boss → `pendulum_sync` for oscillators, and so on).
3. Code picks a **biome kit** from the subject and `theme` (orrery_terraces for maths and astronomy; the living cell for biology; the archive city for history; others later).
4. The World Writer fills §9.2's fields: story purpose, guide and cast, per-encounter lines, probes, pins, claim traces and step effects, collectibles citing verified quotes.
5. Code validates:
   - the placeholder ban, line length and probe vocabulary;
   - that trace expressions evaluate;
   - that pins only show `view` targets;
   - the parity tests (run per contraption type, independent of content).
6. The host runs the same Explore/Scrub/Board/Vault layouts, bar, HUD, map and finale. Only art, nouns and lines differ.

---

## Appendix A · Overlay excerpt (Tidewheel Gate), as the content agent should author it

```jsonc
{
  "sceneId": "s2_tidewheel",
  "zoneId": "z1_sunward",
  "name": "The Tidewheel Gate",
  "encounterId": "e2_period",
  "chunkIds": ["d_door_room_a"],
  "contraptionId": "ring_gate",
  "nouns": [{ "key": "machine", "value": "Tidewheel Gate" }, { "key": "flow", "value": "water" }],
  "anchor": { "x": 7400, "y": 2396 },
  "console": { "x": 6900 },
  "lines": [
    { "slot": "approach",    "speakerId": "cog", "text": "The Tidewheel Gate. Its ring runs on y = sin(2t). It must lap once and lock, or the canals stay dry." },
    { "slot": "instruction", "speakerId": "cog", "text": "Set the latch timer to one full period, so the ring's notch comes home and the gate locks open." },
    { "slot": "hint1",       "speakerId": "cog", "text": "A period is how long the ring takes to come back to where it started, moving the same way." },
    { "slot": "success",     "speakerId": "cog", "text": "Speed up the wheel and every lap gets shorter: double b, and the period halves." }
  ],
  "probes": [
    { "predicate": "nearValue", "arg": "pi/2",   "lineSlot": "probe.half" },
    { "predicate": "nearValue", "arg": "2*pi",   "lineSlot": "probe.double" }
  ],
  "pins": [{ "anchor": "tally", "label": "I" }],
  "verifyLabel": "LOCK THE RINGS",
  "badge": "RINGS LOCKED",
  "payoff": { "kind": "door", "flow": "water", "opensCollider": "s2_gate_wall" },
  "plaque": "TIDEWHEEL GATE. The latch fires once. Time it to a single lap of the ring: no more, no less.",
  "collectibles": [],
  "npcs": [{ "castId": "brasswick", "questSteps": ["talk", "afterSeal", "talk"] }]
}
```

(The full trig overlay = S0–S7 in this shape, plus `intro`, `outro`, `cast`, `zones`, `journal` from §4 and §6.
Line text comes verbatim from §4.4 by id.)
