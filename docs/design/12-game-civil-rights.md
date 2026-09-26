# 12 · Game Design Document: *The 1965 Files: The Archive of Voices* (civil rights history, 1954–1965)

**Fixture:** `fixtures/civil-rights-mystery.json` (`history_mystery_001`, genre `mystery`, 12 encounters). That fixture
is pinned by `fixtures-drift.test.ts`, so **none of its bytes change**. Everything here is delivered through the
side-car `WorldOverlay` (runtime map §3.3 A), keyed by `spec.id`, then by (`src_civil_rights`, `mystery`).

**Reads with:** `01-variant-design-bible.md` (tokens, anatomy, checklist), `00-runtime-map.md` (seams, defects
D1–D9), `02-assets-and-art-pipeline.md` (manifest, loaders, budget), `docs/overnight/wave1-modes.md` (mode
contracts).

**Audience:** three kinds of agent build from this doc.
- **Artists** use §2, §3 and §7.
- **Engine and contraption developers** use §5 and Appendix A.
- **Content writers** use §4, §6 and Appendix B.

Nothing here changes a mode's `grade()`. Every "Verify" in §5 calls the existing mode's grade with the existing
`Input` shape.

**Sensitivity rules** (bible §7.3; non-negotiable, and repeated here because every section depends on them):
1. No real person is ever rendered as a sprite, portrait, silhouette cut-out, caricature or playable character.
   Real people appear only as **names typed on documents**.
2. Violence is never animated or depicted. It is **named in dated text** (node cards, tape, headlines). Photo
   plates of violent events are "withheld" frames: a sepia blur, a camera glyph and the caption only.
3. There is no combat, no enemies and no "boss fight" against historical actors. The antagonist is the flood
   damage to the record: the *mimic labels* and *decoy planks*, which are the misconceptions themselves.
4. All in-world signage is either (a) verbatim fixture text, or (b) neutral generic wayfinding ("GATE 4",
   "RECORDS", "HARDWARE"). **No invented quotations** are attributed to real people. No real brand logos: the
   five-and-dime and the coach terminal are generic, and their document plates carry the real names from the
   fixture text.
5. Every fictional character (Nell, Ida, the Editor, Otis, Hattie, Dolores, Theo) works at the archive **in the
   present**. None of them claims to have witnessed a historical event or tells invented anecdotes about one.

---

## 1 · Pitch and purpose

### 1.1 Pitch (3 sentences)
A storm has flooded the newspaper morgue of the *Courier-Ledger*. Its **Record Engine**, a machine of brass rings
and glass lenses that projects the paper's 1954–1965 files as a city you can walk through, now shows a broken
past: steps that end in air, streets with holes in them, and forged labels pasted over the truth. As the
archive's newest archivist, Nell, you walk that projected city with Ida's lantern at your shoulder, and you repair
each projection the way historians do: you read dates, expose false claims, wire causes to their effects and file
sources by who made them. Each repair turns a piece of the city into solid ground you can walk on, until the
Editor's sealed vault opens and the true story of how the movement won its laws goes to press.

### 1.2 What is broken, and what is at stake
- **The damage is the misconceptions.** The flood did not only soak the reels. When the reels were re-spliced in
  a hurry, **mimic labels** and **decoy planks** were pasted into the record. Every one of them is a real
  misconception taken from the fixture's `targetMisconception` fields:
  - "Brown ended school segregation immediately."
  - "Rosa Parks was just a tired seamstress who acted alone."
  - "Nonviolent protest means passive protest."
  - "The federal government led the civil rights movement."
  - "Every event has one cause."
  - "The march was only about King's speech."
  - "The Civil Rights Act of 1964 guaranteed the right to vote."
  - "Events happened in the order the textbook mentions them."
  - "Old means primary."
  - "History is a list of unrelated events."

  The Engine projects a place only when its record is **consistent**. A false label or an out-of-order plank
  leaves that part of the city as a flickering wireframe, too thin to stand on.
- **What is at stake.** At dawn the building's owners haul out every reel that won't play. What survives will be
  the *wall of front pages*, and right now that wall carries the mimic labels. If the record isn't restored by
  dawn, the misremembered version is the only one left. (This is story stakes only. **There is no timer.**)
- **What the player restores:** 12 projections, one per encounter. Each makes one landmark solid:
  - courthouse steps;
  - the walking road;
  - the schoolhouse doors;
  - the lunch counter;
  - the terminal gate;
  - the broadcast mast lift;
  - the memorial steps;
  - the filing hall stair;
  - the Selma bridge;
  - the stacks aisle;
  - the Big Board;
  - the Editor's vault.

  At the end the Engine projects the whole city at dawn, and the Editor's sealed story prints.
- **Why the concepts are the only way through.** The Record Engine is an evidence machine. It accepts exactly
  four historian's operations, and **those operations are the game's verbs**:

  | Historian's operation | Engine operation | Modes |
  |---|---|---|
  | Expose a false claim | **Retract** a slide (the Proof Lamp) | truth_finder.mimic, predict_reveal |
  | Establish chronology | **Lay** planks in time (Walking Road, Timeline Bridge) | sequencer.linear |
  | Establish causation | **Wire** cause to effect (Relay Line, Broadcast Relay, Big Board) | linker.chain |
  | Attribute roles | **Patch** names to roles (Program Switchboard) | linker.pairs |
  | Classify by rule / provenance | **File** documents (Filing Cabinets, Provenance Drawers) | sorter.bins |
  | Infer from evidence | **Strike** hypotheses with dated clues (Tumbler Vault) | investigator.elimination |

  Nothing opens because the player "got a question right". A door opens because the record behind it became
  consistent, and **the player walks across what they rebuilt**.
- **The record helps you reason, and it grows as you restore it.** Every restored encounter adds dated pins to
  the **Record Strip**, the timeline card at the top of every panel (§5.0.2). By the time you reach the Selma
  bridge, the Big Board and the vault, the facts you restored are the evidence you reason with. Chronology is
  learned by *building* the timeline, not by reading it.

---

## 2 · World and biome: "The Archive of Voices"

### 2.1 Biome identity
The Record City is a **stylized mid-century Southern American city and archive**, painted soft and respectful, with
no caricature and no grime-as-menace. It is the bible's Variant vocabulary translated into a 1950s–60s city:
- cream stone (courthouses, memorials);
- warm brick (rowhouses, churches, schools);
- **brass in place of gold** (rails, lamps, jacks, canisters);
- navy inlay (awnings, cornice bands, trims);
- cyan "record light" beams in place of crystal energy.

**The circle motif** repeats everywhere: the Engine's rings, the courthouse clock, the church rose window, the
bridge arch, the switchboard jacks, the vault tumblers, film reels, the objective ring, and Ida's emblem.

**The ancient-tech equivalent is the Record Engine.** It is a 1960s analog machine of rings, lenses, film reels
and pneumatic tubes that projects timelines as places. Where Variant has beams between towers (6.png), we have
**record-light beams**. They run from each restored landmark back to the Engine's **antenna ring** on the
*Courier-Ledger* tower, which is visible on the skyline of every scene.

### 2.2 Palette (biome tokens; UI tokens are the bible's §2.3, unchanged)

| Token | Hex | Use |
|---|---|---|
| `cr.brick.lit` / `base` / `shade` | `#D08A6E` / `#B5654F` / `#7E4038` | rowhouses, church, school |
| `cr.brick.dusk` | `#8E5A6A` (lit `#B07A86`) | L2 brick masses under dusk light |
| `stone.lit` / `base` / `shade` / `deep` | `#FBF1DE` / `#F2E3C6` / `#D9C3A0` / `#B89C78` | courthouse, memorial, Engine plinth (bible) |
| `cr.brass.hi` / `base` / `deep` | `#F6D27A` / `#D9A441` / `#A8782E` | rails, lamps, jacks, canisters (bible gold) |
| `inlay.navy` / `dark` | `#27466A` / `#1B3150` | awnings, bands, cabinet trim (bible) |
| `cr.concrete` / `curb` | `#B9AFC6` / `#8C829E` | sidewalks (lavender-grey, dusk-lit) |
| `cr.asphalt.wet` | `#4A4F66` (sheen `#6D6F8C`) | streets |
| `cr.steel` / `shade` | `#9AA3B8` / `#646C85` | Selma bridge truss, broadcast mast |
| `cr.oak.leaf` / `hi` | `#5A95D6` / `#8CC0EE` | dusk trees (bible foliage.blue) |
| `cr.magnolia` | `#3E5F74` (hi `#6E93A6`) | L5 glossy leaves |
| `cr.autumn` | `#E48C5E` / hi `#F4AE80` | sparse autumn trees in 1957 scenes (bible salmon) |
| `cr.recordlight` | `#6ED2F2` / hi `#C9F3FF` / shade `#2E8FC0` | projection beams, lenses, restored edges (bible crystal) |
| `cr.dormant` | `#A9A3B8` @ 40 % + scanlines | unrestored projections (wireframe state) |
| `cr.lamp` | `#F6D27A` → transparent | street lamps, window light |
| `cr.safelight` | `#C4643C` | darkroom only (bible foliage.rust) |
| `wisp.indigo` | `#6A6CF0` | lost negatives (collectibles) |
| `cr.paper` / `aged` | `#F7F1E3` / `#E9D8B4` | documents; the 1971 textbook deliberately aged `#D9C08E` (the visible trap) |
| `cr.ink` | `#2B3A44` | type on documents; also the darkest world colour (no pure black) |

**Rules:** orange (`ui.accent #E2892C`) never appears in the world except on the **Record Lens carriage chip**
and the **aimed/accused socket rings**, both of which are bound to the player's input. White, green and blue in
the world appear only on chips and lamps bound to panel values (§5.0.2).

### 2.3 Sky zones and time of day
Time of day advances with the record's years: the city gets darker as the story nears 1965, and **dawn arrives
only when the record is whole**.

| Zone | Scenes | Years | Sky gradient (top → 35 % → 65 % → horizon) | Weather | Haze over far layers |
|---|---|---|---|---|---|
| Z1 late afternoon | S2, S3 | 1954–1957 | `#B9A3D6` → `#D9AFCF` → `#E9B8C4` → `#F6D9BE` | dry; drifting paper scraps | peach 20 % |
| Z2 dusk, rain | S4, S5 | 1960–1963 | `#7F6BB8` → `#9E86D8` → `#B58FCB` → `#E8A9C3` | steady rain, puddles, steam from grates | pink 30 % |
| Z3 blue hour → night | S6, S7 | 1963–1965 | `#3E3F74` → `#55508A` → `#6A5A9A` → `#C58BB0` | light rain; **stops** when the Selma bridge locks | violet 25 % |
| Z4 interior | S1, S8 | the present | back wall + `#3B2F3E` → `#4E3C44` → `#5E4A4A` (bible vault) | dripping pipes, puddles, dust motes | warm 15 % |
| Z5 dawn (finale) | finale pull-out | the present | `#8FA8D8` → `#C7B7D8` → `#F2C6B8` → `#FBE7C8` | clear; birds as tiny L1 flecks | white 25 % |

### 2.4 Parallax layers (bible §5.2 factors)

| Layer | Factor | Concrete content (exterior scenes) | Treatment |
|---|---|---|---|
| **L0 Sky** | 0.0 | 4-stop gradient per zone. Two soft cloud bands as stacked 8–15 % white ellipses. In rain zones, a darker rain-cloud band across the top 25 %. | 1 px noise dither to prevent banding. |
| **L1 Far** | 0.15 | City silhouette: water tower on stilts, two church steeples, a courthouse dome with cupola, flat-roofed commercial blocks. At ~70 % x stands the **Courier-Ledger tower** (8 stories, art-deco setbacks) topped by the Engine's **antenna ring** (three concentric brass rings, 90 px; dormant grey, restored cyan). Z3 swaps to an obelisk and a domed capitol (Washington), or to river bluffs and a pine line (Selma). **Record-light beams** (bible 6.png) arc from each restored landmark to the antenna ring. | One fill per silhouette (`#6E5E93` in Z1/Z2, `#3F3A6A` in Z3) + 40 % haze toward the sky; sparse window dots `#F6D27A` @ 60 %. |
| **L2 Mid-far** | 0.35 | Brick rowhouses with porches and gable roofs; taller commercial blocks with neutral painted wall signs; oak and magnolia masses; utility poles with catenary wires. **Window clusters are separate sprites** so the payoffs can light them (S5: the nation watching). | Two-tone lit/shade, 20 % haze; windows `cr.lamp` at 0–100 % alpha. |
| **L3 Mid** | 0.6 | Each scene's landmark and the street wall behind the path: storefront rows (navy/salmon striped awnings, transom windows, recessed doors), fire escapes, the courthouse, school, church, terminal and memorial. | Full palette; soft ambient occlusion at the bases; coloured blurred shadows falling right. |
| **L4 Play** | 1.0 | Sidewalk / brick plaza / marble / wood ground strip, curbs, contraptions, consoles, Nell, Wick, NPCs, lamp heads. | Full detail, contact shadows `#6E7F9A` @ 30 % multiply, blurred 6 px. |
| **L5 Foreground** | 1.3 | Wet iron railings, parking meters, hydrants, twine-tied newspaper bundles, park benches, lamppost bases, glossy magnolia leaf clusters. Never covers a contraption or console. | `#2B3A44`-leaning, 2 px blur (Phaser Blur filter), 70 % alpha. |
| **L6 Light** | 1.0 | Rain streaks (particles), splash rings, lamp glows (ADD), projector cones, puddle reflections (vertically flipped copy of L3/L4, 25 % alpha, ripple displacement), venetian-blind shadow overlay (interiors), film-grain overlay 6 %. | Multiply for shadows, ADD for glows. |

**Interior scenes (S1, S8, the S4 counter, the S6 filing hall)** reuse the same factors:
- L0/L1 = the back wall, with high windows showing the street at knee height (rain on the glass);
- L2 = pipes, shelving silhouettes and arches;
- L3 = the landmark machinery;
- L5 = the edges of the reading desk, and ropes and stanchions.

**Cutaway entry.** A storefront's facade fades to 20 % alpha over 300 ms while Nell is inside (standard 2D
cutaway), so the shop interior stays readable without a scene change.

### 2.5 Ambient motion and particles (all cheap, all looping)
- **Rain:** 220 streak particles in Z2 and 90 in Z3.
  - Angle 12° from vertical, speed 900–1100 px/s.
  - On hitting the ground: a splash ring (scale 0.2 → 1, 250 ms, alpha 0.5 → 0).
  - Puddles ripple at 1.5 Hz.
- **Record scraps:** 12–20 tiny glowing paper scraps (`cr.recordlight` 40 %) drift up from dormant wireframes.
  They stop around restored landmarks, which read as "sealed".
- **Steam:** from street grates in Z2, 1 puff/s, rising at 30 px/s and fading over 2 s.
- **Moths:** 3 moths orbit each lit street lamp (Lissajous orbit, 18–40 px radius).
- **Awnings and bunting:** sway ±1.5° at 0.3 Hz. The wires on L2 utility poles sway ±2 px.
- **Dormant flicker:** projections not yet restored sit at 40 % alpha with 4 px scanlines. They flicker (alpha
  ±15 % at 7 Hz with random dropouts) and are desaturated −60 % (Phaser ColorMatrix). **Restoring** plays a
  0.8 s "printing" sweep: a cyan scanline bar crosses the object left to right, leaving it solid and saturated.
- **Record-light beams:** 3-line beams (bible §6.2), shimmering ±8 % at 12 Hz. Each restored landmark adds one.

### 2.6 Scenes, in order (8)

Coordinates are world px at a 1080-px-high design frame, with the ground at y = 900 and **H = 170 px**
(protagonist height ≈ 16 % of screen). Every scene ends at a **frame seam**: a glowing film-frame edge with
sprocket holes. Nell walks into it, the screen does a 400 ms film-advance wipe, and Wick announces the new
place and year (the X-lines in §4.4).

| # | Scene | Width | Encounters | Zone | Traversal built by the puzzle |
|---|---|---|---|---|---|
| S1 | The Morgue (intro + hub) | 3840 | none (tutorial) | Z4 | the Engine wakes and opens the first frame seam |
| S2 | Courthouse Square | 5760 | e1_brown, e2_montgomery | Z1 | climb the courthouse steps; walk the Walking Road across the flooded street |
| S3 | Schoolhouse Hill | 3840 | e3_little_rock | Z1 (dusk begins) | walk through the unbarred school doors |
| S4 | Main Street: the Lunch Counter and the Coach Terminal | 5760 | e4_sit_ins, e5_freedom_rides | Z2 | the swing door to the alley; the terminal gate lifts onto the platform |
| S5 | Church Square and the Broadcast Mast | 4800 | e6_birmingham | Z2 | ride the mast's service lift to the rooftops (vertical) |
| S6 | The Memorial Steps and the Capitol Filing Hall | 5760 | e7_march, e8_cra | Z3 | climb the memorial steps; the cabinets roll apart to reveal a stairwell down |
| S7 | The Bridge at Selma | 5760 | e9_selma | Z3 | cross the bridge (walk pace); ride the streetcar home |
| S8 | The Morgue Stacks and the Editor's Vault | 6720 | e10_sources, e11_causation, e12_boss | Z4 → Z5 | the stacks roll apart and a ladder leads up; the vault lift goes down; the vault opens |

#### S1 · The Morgue (intro, tutorial, and hub)
- **The player sees:**
  - x 0–600: a brick basement with a curving iron stair down from a street door, rainwater sheeting down it.
  - x 700–1000: an ankle-deep flood across a worn wood floor, with film reels in puddles.
  - x 820: Otis's flashlight beam.
  - x 1200: Ida's reading desk (green banker's lamp, card catalog).
  - x 1500–2700: **the Record Engine** dominates the centre, desaturated and silent.
    - A cream-stone plinth (1000 × 240) with a navy inlay band and gold trim.
    - Three concentric brass rings (outer 860 px diameter). The inner ring carries **12 lens sockets**, one per
      encounter, grouped by act.
    - A projector drum with an iris aperture at the centre.
    - A split gold crown fin above, which bleeds off the top of the frame (**5.8 H**, the scale-ladder hub).
  - x 2750: a locked **DARKROOM** door (the secret).
  - x 2900–3600: **Hattie's proof press** and the **wall of front pages** (12 empty frames; the ones filled with
    mimic headlines are greyed).
  - x 3700: the Engine's projection aperture, where the first frame seam opens.
- **Contraption:** none graded. The tutorial console is the **main breaker**: press E to throw it.
  - The Engine rings spin up (outer +1.5 turns, middle −1 turn, 2.4 s ease-out).
  - The drum's iris opens, and a cone of record light pours right and becomes the frame seam.
  - This teaches the verbs walk / jump / interact.
- **NPCs:** Otis (breaker micro-quest), Ida (at the desk; hands over **Wick**), Hattie (at the press; prints each
  restored headline onto the wall as the game proceeds; this is the ambient progress display).
- **Side content:** the Engine's 12 lenses light as encounters are solved. The wall of front pages replaces a
  greyed mimic headline with the true one (the encounter's `debriefLine`, set in type) whenever Nell passes it.

#### S2 · Courthouse Square (1954 → 1956)
- **The player sees:**
  - A brick-herringbone square in late-afternoon light.
  - A Greek-revival **courthouse** (x 1300–2800): 6 fluted columns, a pediment with a round clock, three pale
    projection panels between the centre columns.
  - Its steps (x 1500–2600) are only **half printed**: cyan wireframe, not solid.
  - Behind, on L1: the Courier-Ledger antenna ring. On L2: rowhouses and oaks.
  - Past the courthouse, the ground drops into a **flooded street** (a water band, x 2800–3400), too wide to jump.
    The only way on is up the courthouse steps and across the raised upper terrace to x 3400.
  - There, stairs descend to a **1950s bus stop** (x 3900: cream canopy on navy posts, bench, route sign, and a
    flip-number **DAY counter**). A parked **city bus** (x 3600–4580, cream/teal two-tone, windows dark,
    **empty**) stands behind it.
  - A second flooded gap (x 4200–5200) blocks the street. Across it, the far corner (x 5300–5760) is lit.
- **Contraptions:**
  - e1 · **Witness Projector** on the courthouse facade (§5.1), with its console at x 900.
  - e2 · **Walking Road** across the second flood (§5.2), with its console at x 3800 by the bus stop.
- **NPCs:** Wick only. The square is quiet: no crowds, no figures.
- **Secrets / side content:**
  - **Lost Negative N1** is on the courthouse cornice ledge (x 2600, y 420). It is reachable only after e1 (jump
    from the top solid step onto the flagpole plinth, then onto the ledge).
  - **Lost Negative N2** is on the awning of the far-corner store (x 5450, y 600). It is reachable only after e2
    (jump from the last slab of the Walking Road).
  - A dated **plaque** by the courthouse door lights after e1 with the e1 `sourceRef` quote.

#### S3 · Schoolhouse Hill (September 1957)
- **The player sees:**
  - A street climbing a gentle hill (the ground rises from y 900 to 820). Autumn trees in `cr.autumn`.
  - A **newsstand kiosk** (x 1000–1560) with racks, an awning and bundled papers. Inside: a **teletype Wire
    Ticker** (x 1200) and a brass **Prediction Selector** console (x 1450).
  - A telegraph pole (x 1700) carries a wire up the hill.
  - The **high school** (x 1900–3600) stands on a raised terrace at y 700. It is tan brick with cream stone trim,
    a central entrance tower and four tall arched windows.
  - Its doors (x 2650) are blocked by a translucent grey-lavender **barrier projection**: abstract scanline bars.
    **No soldiers and no figures are shown.**
  - Nine small **walk lamps** line the front walk, unlit.
  - A document plate on the gatepost reads (verbatim fixture concept name) "Little Rock Nine (1957)".
- **Contraption:** e3 · **Wire Ticker and Prediction Selector** (§5.3).
- **NPCs:** none in person. The ticker "speaks" by printing.
- **Side content:** after e3, the nine walk lamps stay lit as a quiet memorial count. Hovering the gatepost plate
  shows the e3 `sourceRef` quote.

#### S4 · Main Street: the Lunch Counter and the Coach Terminal (1960–1961)
- **The player sees:**
  - Dusk and steady rain. Wet asphalt reflecting lamp glows.
  - A **five-and-dime** storefront (x 600–2000) with a big generic "5-10-25¢" sign board and display windows.
    On entering, it cuts away to the **lunch counter**:
    - a long counter (cream top, chrome edge, navy front) with **12 empty chrome stools** and teal vinyl seats;
    - pie cases;
    - a **three-panel menu board** on the back wall (x 1000–1900);
    - a swivel **pendant lamp** over the counter (x 1450);
    - a round-windowed **swing door** to the kitchen (x 1950), which is locked.
  - Through the kitchen, an alley (x 2100–2600) leads to the side door of a streamline-moderne **coach terminal**
    (x 2600–4500): curved corner, chrome speed bands, a vertical fin sign "TERMINAL".
  - Inside the terminal:
    - two waiting-room doors separated by a **brass divider rail** (x 2800–3500);
    - a **split-flap departures board** (x 3600);
    - **6 brass relay junction boxes** mounted along the platform canopy rail (x 3000–4300, y 520);
    - a corrugated **rolling gate** (x 4450) blocking the platform.
  - Beyond the gate: the platform, and a stair up to a street overpass (x 5200) and the frame seam.
- **Contraptions:**
  - e4 · **Witness Projector (menu-board variant)** (§5.4), with the console at x 900 by the register.
  - e5 · **Relay Line** (§5.5), with the console at x 2900.
- **NPCs:** none in person. A framed **withheld photo plate** by the departures board shows only a caption (§5.5).
- **Secret:** **Lost Negative N3** is in the terminal rafters (x 4000, y 380). It is reachable after e5, when the
  powered canopy lights reveal truss handholds (climb from the top of the departures board).

#### S5 · Church Square and the Broadcast Mast (spring 1963)
- **The player sees:**
  - Night rain. A brick **church** (x 300–1600): twin square towers with pyramidal caps, a central **rose window**
    (circle motif, lit warm from inside), three arched doors, wide steps.
  - A **park** (x 1700–3200) with an octagonal cream-and-navy **bandstand**, empty benches and oaks.
  - A lattice-steel **broadcast mast** (x 3600, 1700 px tall, bleeding off the top) with **five relay stations**
    at heights y 760, 600, 440, 280 and 120. A sixth, stray station stands on a separate pole (x 3300). The
    mast's **service lift cage** waits at the bottom, dark.
  - On L2, the skyline's rowhouse **windows are dark**.
- **Contraption:** e6 · **Broadcast Relay** (§5.6), with the console at x 3350.
- **Sensitivity:** the park is empty and still. Nothing depicts the dogs or hoses. They exist only in the node
  card's typed text.
- **Secret:** **Lost Negative N4** is on the mast's top platform (x 3600, y 80). It is reachable from the lift's
  top stop via a short climb.

#### S6 · The Memorial Steps and the Capitol Filing Hall (August 1963 → 1964)
- **The player sees:**
  - Blue hour. A long **reflecting pool** (x 0–2700) mirrors a neoclassical **memorial colonnade**
    (x 800–2700, 12 columns, attic band). Its interior shows only a warm glow; **no statue is drawn**.
  - The memorial's broad steps (x 1100–2400) are wireframe.
  - At the pool's edge (x 900), a 1940s **cord switchboard** on a stand.
  - After the steps solidify, a colonnaded walkway at y 640 leads into the **Capitol Filing Hall** (cutaway
    interior, x 3000–5200): cream marble with a navy inlay border, arched windows, brass.
    - A **pneumatic delivery tube** drops slips onto a sorting table (x 3300–3500).
    - Two tall oak-and-brass **filing cabinets** stand on floor rails: "CIVIL RIGHTS ACT · 1964" (x 3900) and
      "VOTING RIGHTS ACT · 1965" (x 4500). Each has a **signal meter** (VU needle) and a brass-shuttered
      **feature plate** under its label.
- **Contraptions:**
  - e7 · **Program Switchboard** (§5.7).
  - e8 · **Filing Cabinets** (§5.8), with the console at x 3250.
- **NPCs:** **Dolores** at the switchboard (tutorial for linking).
- **Side content:** after e7, the printed program (a document) goes into the Clipping Case.

#### S7 · The Bridge at Selma (March 1965)
- **The player sees:**
  - Night, light rain. A riverside road with street lamps (x 0–1200).
  - A **steel through-arch bridge** (x 1300–4300) in `cr.steel`, its arch a great half-circle of lattice. The
    bridge's **crown section is missing four bays** (x 2200, 2500, 2800, 3100), with the river visible through
    the gaps.
  - A brass **surveyor's lectern** console at the bridge foot (x 1100).
  - The far bank (x 4300–5760): a dated plate, and a **streetcar** (cream/teal, empty) at a stop (x 5200).
- **Contraption:** e9 · **Timeline Bridge** (§5.9).
- **Payoff tone:** when the span locks, **the rain stops**. Run is disabled on the bridge and music drops to a
  single sustained pad with footsteps and river sound. The camera pulls wide. The crossing takes about 12 s. There
  are no crowds and no figures; the lamps along the bridge light as Nell passes.
- **Secret:** **Lost Negative N5** is under the far abutment on a riverside ledge (x 4500), reached by the
  riverbank stairs after crossing.

#### S8 · The Morgue Stacks and the Editor's Vault (the present → dawn)
- **The player sees:**
  - The streetcar pulls into the Morgue's loading dock (x 0–600).
  - The **stacks** (x 800–2600): six closed **compact-shelving units** with wheel cranks, the aisle shut.
    - **Theo** stands by a spilled cabinet (x 900–1300).
    - A **provenance cabinet** has two drawers, "PRIMARY SOURCE" (x 1600) and "SECONDARY SOURCE" (x 2000).
    - A rolling library ladder, locked.
  - Above, a **gallery** at y 520 (x 2800–4600) holds the **Big Board**: a brass wall with 7 pneumatic
    **canisters** and tube channels.
  - Through arches on L3, the **Record Engine** in the next hall (it is the same machine seen in S1), its lenses
    lit for every restoration so far.
  - A **vault lift** (x 4700) goes down to the vault level.
  - The **Editor's Vault** (x 5000–6400): a round door (1000 px, **5.9 H**) in a cream-stone socket with radiating
    navy grooves:
    - 4 **tumbler wheels** at 12, 3, 6 and 9 o'clock;
    - a central spoked handwheel;
    - four bolts;
    - a brass **voice grille** that glows when the Editor speaks.
  - The **DARKROOM** door (x 2700) glows red once all five negatives are held.
- **Contraptions:**
  - e10 · **Provenance Drawers** (§5.10).
  - e11 · **Big Board** (§5.11).
  - e12 · **Tumbler Vault** (§5.12, Vault mode).
- **NPCs:** Theo (the misconception personified, friendly), Otis (at the darkroom), Hattie (voice from the press
  room upstairs), and the Editor (voice only).
- **Finale:** the vault opens onto the **press-organ** (brass pipes, type cases, a big roller) printing the story.
  The camera then rises through the Morgue ceiling to the city at **dawn** (Z5), where every landmark's
  record-light beam reaches the antenna ring (§4.3).

---

## 3 · Characters

### 3.1 Protagonist: **Nell**, junior archivist (silent protagonist)
- **Look:** mid-twenties, practical.
  - A mustard cardigan over a cream blouse, navy trousers rolled at the ankle, rubber boots (the flood).
  - A salmon scarf (`cr.autumn`) that trails when she runs: a readable silhouette.
  - A leather **satchel** across the body. Cotton archivist's gloves on her belt.
  - Readable at 1 H: scarf and satchel strap make a diagonal.
- **v1 art:** Kenney `toon-characters` **Female adventurer** pose PNGs (CC0, 96×128, with a 2× HD set), tinted
  toward the cardigan palette, plus two SVG overlays (satchel, scarf) that follow the torso anchor.
  **Upgrade path:** the pack's `Parts/` PNGs (head, body, arm, hand, leg, legBend) rigged as the bible §6.3 puppet.
- **Animation set** (frame names from `Female adventurer/PNG/Poses/character_femaleAdventurer_*.png`):

  | State | Frames | Timing | Notes |
  |---|---|---|---|
  | idle | `idle` (+ 2 % breath scale on the torso overlay) | loop 2.4 s | the scarf sways ±3° |
  | walk | `walk0`–`walk7` | 10 fps; 160 px/s | 8-frame cycle |
  | run | `run0`–`run2` | 12 fps; 300 px/s | disabled on the Selma bridge |
  | jump / fall | `jump`, `fall` | jump velocity −620, gravity 1600 | apex ≈ 120 px (0.7 H) |
  | climb | `climb0`, `climb1` | 6 fps | ladders, fire escapes, the mast |
  | interact | `interact` (reach) → `show` (hold up document) | 250 ms + hold | at consoles; while the panel is open she holds `think` |
  | think | `think` | hold | panel open (scrub/board mode) |
  | celebrate | `cheer0`, `cheer1` | 2 loops, 6 fps | **only** on non-memorial payoffs (e1, e2, e5, e7, e8, e10, e11, e12). On e3, e4, e6, e9 she plays `idle` with a slow head-down "respect" beat (`back` for 600 ms, then `idle`) |
  | talk | `talk` | when a minor NPC addresses her | |

### 3.2 Guide: **Ida the Archivist** (fixture character `archivist`, voice archetype **`wise_mentor`**)
- **Look:** in her late sixties, **deep brown skin**, silver hair in a low bun, cat-eye reading glasses on a beaded
  chain, a long teal cardigan over a cream blouse, archivist's cotton gloves, a brass hurricane lantern.
  - Seen in person only in S1, at her desk, and in the outro.
  - v1: Kenney **Female person** poses (`idle`, `talk`, `think`, `show`, `walk0–7`, `interact`) + an SVG
    overlay (bun, glasses chain, cardigan).
- **Personality:** precise, warm, dry humour; never lectures past two sentences. She treats the player as a
  colleague, not a pupil. Her praise is specific ("That slab holds."). Her corrections point at evidence, never at
  the answer. She uses archive metaphors: slides, reels, drawers, splices, bylines.
- **Voice (`wise_mentor`):**
  - short declaratives, present tense;
  - addresses the player as "Nell";
  - asks one question at most per line;
  - never uses "correct"/"wrong";
  - speaks the **instruction** line in imperative form and the **insight** as a single declarative truth
    (bible §3.9).
- **Companion in explore mode: Wick, the lantern.**
  - A floating brass hurricane lantern (40 × 60 px) with two paper **moth-wings** (fins) and a warm flame core.
  - It hovers 40 px above and behind Nell's shoulder: spring follow, k = 6, damping 0.8, bob ±4 px at 0.5 Hz.
  - It carries Ida's voice. **When Ida speaks, the flame brightens** (ADD glow scale 1 → 1.3) and the wings beat
    faster.
  - At hint rungs Wick flies to the relevant world object and circles it (§5.0.5).
- **Emblem (dialogue bar, 64 px): "the Reel".**
  - Three concentric rings on a dark fill. The inner two are **broken like a labyrinth**: the gaps are drawn as
    film-reel spoke cut-outs.
  - The outer ring is **salmon** `#E7A08C` (`ui.info.warm`). The strokes are white. A tiny lantern keyhole sits at
    the centre.
- **Info button:** the bible's white "i" in a double ring. In this game the outer ring is salmon to match Ida.

### 3.3 The Editor (fixture character `editor`, voice archetype **`narrator`**)
- **Voice only. Never shown as a person.** He is represented by:
  - the vault's circular brass **voice grille**, which glows `cr.lamp` when he speaks;
  - the **press-organ** inside the vault.
- **Emblem:** a navy ring (`inlay.navy`) around a single cream **type slug** stamped "E", with the bible's
  broken-ring detail.
- **Voice (`narrator`):** clipped, newsroom cadence, second person. He speaks only at the vault (X09, e12 lines)
  and in the outro.

### 3.4 Minor NPCs (fictional archive staff of the present day; micro-quests or lore)

| NPC | Where | Look (v1 = Kenney pose set + SVG overlay) | Role and micro-quest | Lore delivered |
|---|---|---|---|---|
| **Otis Pell**, night watchman | S1 stair; S8 darkroom | Male person; grey cardigan, watch cap, flashlight (its cone is an ADD sprite) | **Micro-quest (tutorial):** "throw the main breaker" teaches E-interact. In S8 he unlocks the darkroom once all 5 negatives are held (the secret). | How the storm flooded the basement and scrambled the reels (the premise, diegetically). |
| **Hattie Greer**, retired typesetter | S1 proof press (voice later) | Female person; green eyeshade visor, ink apron, sleeve garters | **Ambient progress:** after each restoration she sets the true headline (the encounter's `debriefLine`) on the wall of front pages. **Micro-quest:** Nell brings back the printed program from e7, and Hattie frames it. | That the paper printed front pages as the record; why the 1964 and 1965 acts deserve different front pages. |
| **Dolores Vance**, volunteer (retired operator) | S6 switchboard | Female person; headset around the neck, cardigan, pencil in her hair | **Tutorial for linking:** she explains cord boards before e7. | That a march that size ran on phone calls, paper, marshals and buses (fixture: Rustin "coordinated the day's transport, marshals and program"). |
| **Theo**, student volunteer (teen) | S8 stacks | Male person; school cap, backpack, holding an aged textbook | **The misconception, personified:** he is sure "old means primary". e10 is framed as helping him file the spill. Afterwards he corrects himself. | The e10 lesson restated in a peer's voice. |

---

## 4 · Story arc and every line of dialogue

### 4.1 Act structure mapped onto encounters

| Act | Fixture unit | Scenes | Encounters (role) | Arc beat |
|---|---|---|---|---|
| Prologue | — | S1 | none | The flood, the Engine, the stakes, Wick. |
| **I · Rulings are not enough** | u_origins (1954–1957) | S2, S3 | e1 Brown (teach), e2 Montgomery (teach), e3 Little Rock (teach) | A ruling (Brown) is words. People organize (Montgomery). Enforcement needs power (Little Rock). |
| **II · Pressure** | u_direct_action (1960–1963) | S4, S5 | e4 sit-ins (teach), e5 Freedom Rides (teach), e6 Birmingham (teach) | Nonviolent direct action creates confrontation. Confrontation becomes images. Images become pressure. |
| **III · Law** | u_legislation (1963–1965) | S6, S7 | e7 March (teach), e8 CRA vs VRA (teach), e9 Selma (teach, dated review) | Pressure becomes bills. Two laws, one year apart. The dates, not the page order. |
| **IV · The Editor's question** | u_sources + review | S8 | e10 sources (teach), e11 causation (review / synthesis), e12 boss (boss) | Weigh the evidence you restored, connect the causes, answer "why 1965". |

Teach → review → boss: e9 re-uses the ordering verb from e2 with dates. e11 re-uses the wiring verb from e5/e6
at a larger scale, with the whole earned Record Strip as evidence. e12 synthesizes causation, sources and
Selma/VRA.

### 4.2 Intro cutscene (skippable with Esc; about 70 s)
1. **Exterior, night, rain** (8 s, no dialogue). The camera cranes down the Courier-Ledger tower. The antenna ring
   on top is dark. Down through a rain-streaked basement window, faint cyan light flickers.
2. **Stair descent** (player control begins). Nell walks down the iron stair into the flood. Otis's flashlight
   finds her. Lines I01–I02.
3. **Ida's desk.** Lines I03–I08. Ida hands over Wick (the lantern rises from her desk and takes its place at
   Nell's shoulder; its flame brightens on I07).
4. **The breaker** (tutorial). Line I10. Nell throws the breaker: the rings spin up, the drum iris opens, and a
   cone of record light pours right and becomes the first frame seam. Otis says N02. Ida says I09.

### 4.3 Outro (plays in the new `finale` phase after e12; this fixes runtime-map D2)
1. The vault door swings open. Inside, the press-organ rolls and prints (a 4 s paper outfeed). The Editor says
   the fixture's after-beat (e12.S1), then O01 and O02.
2. **Pull-out.** The camera rises through the Morgue ceiling to the city at dawn (Z5):
   - each scene's landmark is visible on a composed skyline, restored in order;
   - 12 record-light beams arc into the antenna ring, which lights cyan;
   - the Engine's 12 lenses shine through the tower windows.

   Ida speaks O03 and O04.
3. **The wall of front pages**, now complete (12 true headlines). Otis says O05 and Hattie says O06. Ida closes
   with O07. If all 5 negatives were developed, the Editor adds O08.
4. Then `EndScreen` (keeps `end-screen` and the `<h1>` for e2e).

### 4.4 Dialogue script
All lines are at most 140 characters (checked by script; see Appendix C).
- **Speaker ids** match `spec.characters` where they exist (`archivist` = Ida, `editor` = the Editor). The minor
  NPCs are overlay characters.
- **`[fixture]`** marks lines used verbatim from the fixture's `narrative` or `hints`.
- **Per-encounter rows:**
  - **A** = approach (plays when Nell enters the console's range);
  - **I** = instruction (the imperative line that stays in the bar while the panel is open);
  - **H1–H3** = hint rungs (the info button; content mirrors the fixture's `hints[0..2]` one-to-one; H3 names the
    answer exactly as the fixture's H3 does);
  - **S** = success/insight (replaces the instruction after Verify succeeds);
  - **F** = failure (Ida's in-world reaction; the panel also shows the grade's own feedback as a margin note,
    §5.0.4).

#### Intro
| ID | Speaker | Line |
|---|---|---|
| `I01` | Otis | Mind the water. The storm came in through the basement windows and soaked every reel down here. |
| `I02` | Ida | Every vault in here opens for evidence, not for guesses. Read the dates. Follow the causes. `[fixture]` |
| `I03` | Ida | That machine is the Record Engine. It projects the paper's files, 1954 to 1965, as a city you can walk through. |
| `I04` | Ida | The flood scrambled it. Now it shows steps that go nowhere, streets with holes, and false labels over the true ones. |
| `I05` | Ida | At dawn, reels that won't play get hauled out. Then the false labels are all anyone will remember. |
| `I06` | Ida | The Editor sealed his last story in the vault under the Engine. It opens only when the whole record agrees with itself. |
| `I07` | Ida | My knees quit walking the projection years ago. Take Wick. He carries my voice. |
| `I08` | Ida | Start at the courthouse. This story starts with a ruling, and with what people did after it. |
| `I09` | Ida | If a repair doesn't hold, the Engine shows you where. Read what it shows you, Nell. |
| `I10` | Ida | Throw the main breaker by the stair. Press E when you're close. |

#### Scene arrivals and transitions
| ID | Speaker | Line |
|---|---|---|
| `X01` | Ida | Courthouse Square, 1954. The steps are only half printed. The record isn't sure what the Court decided. |
| `X02` | Ida | Little Rock, September 1957. Three years after Brown, and those school doors are still barred. |
| `X03` | Ida | Greensboro, 1960. A lunch counter, and next door a bus terminal. The movement is getting younger and bolder. |
| `X04` | Ida | Birmingham, spring 1963. Watch that mast. What happened here mattered because cameras carried it. |
| `X05` | Ida | Washington, August 1963. A quarter of a million people, and far more organizing than most people remember. |
| `X06` | Ida | Two laws, one year apart. Keep them straight and you'll know what each one was for. |
| `X07` | Ida | Selma, March 1965. The bridge is in pieces. We'll set them by date, and we'll cross at a walk. |
| `X08` | Ida | Back in the stacks. The rest of the record is paper: sources, and the causes that tie them together. |
| `X09` | Editor | Tell me why 1965. Not what happened. Why. `[fixture]` |
| `X10` | Ida | The Big Board's lit and the vault's first bolt just moved. He's waiting for you, Nell. |

#### e1_brown · Witness Projector (truth_finder.mimic)
| ID | Speaker | Line |
|---|---|---|
| `e1.A` | Ida | Three slides on the courthouse wall, all about Brown v. Board. The flood spliced one false label in with the true. |
| `e1.I` | Ida | Aim the Proof Lamp at the false slide, then retract it. |
| `e1.H1` | Ida | A court ruling is a statement, not an enforcement. Keep that in mind as you read. |
| `e1.H2` | Ida | Think about what happened at Little Rock three years later. I've pinned it to your Record Strip. |
| `e1.H3` | Ida | The false label reads: Schools across the South desegregated within the year. `[fixture]` |
| `e1.S` | Ida | A ruling is words on paper. It took years, and federal troops, to carry Brown out of the courtroom. |
| `e1.F` | Ida | The lamp holds steady. That slide is honest. Look for the label that assumes the ruling was obeyed at once. |

#### e2_montgomery · Walking Road (sequencer.linear)
| ID | Speaker | Line |
|---|---|---|
| `e2.A` | Ida | The street past the bus stop is under water. Lay the Montgomery planks across it in order. One never happened. |
| `e2.I` | Ida | Lay the planks across the flooded street in the order they happened. |
| `e2.H1` | Ida | Start with the arrest and end with the court. `[fixture]` |
| `e2.H2` | Ida | Between them is a year of organized walking and carpooling. `[fixture]` |
| `e2.H3` | Ida | An arrest of one activist became a campaign because leaders were ready to organize. `[fixture]` |
| `e2.S` | Ida | One arrest became a 381-day boycott because people organized. It ended when the Supreme Court ruled. |
| `e2.F` | Ida | The road won't hold at that slab. Organizing came before 381 days of walking, and the court came at the end. |

#### e3_little_rock · Wire Ticker (truth_finder.predict_reveal)
| ID | Speaker | Line |
|---|---|---|
| `e3.A` | Ida | September 1957. The state Guard is keeping nine students out of Central High. What did the President do? |
| `e3.I` | Ida | Turn the Prediction Selector to your forecast, then send it down the wire. |
| `e3.H1` | Ida | A state governor is defying a federal court. Hold on to that. |
| `e3.H2` | Ida | What tool does a president have when a court order is defied? `[fixture]` |
| `e3.H3` | Ida | Think about who outranks a state's National Guard. `[fixture]` |
| `e3.S` | Ida | Brown didn't enforce itself. When a governor defied a federal court, it took the President and the Army. |
| `e3.F` | Ida | The wire prints what really happened. Read it, then set the selector to the true outcome and file it. |

#### e4_sit_ins · Witness Projector, menu-board variant (truth_finder.mimic)
| ID | Speaker | Line |
|---|---|---|
| `e4.A` | Ida | Someone swapped the menu for three slides about the Greensboro sit-ins. One of them is a mimic. |
| `e4.I` | Ida | Swing the counter lamp onto the mimic slide, then retract it. |
| `e4.H1` | Ida | Sitting where you are forbidden to sit is itself a confrontation. `[fixture]` |
| `e4.H2` | Ida | Nonviolence describes how they answered violence, not whether they provoked a response. `[fixture]` |
| `e4.H3` | Ida | The mimic claims: Nonviolent meant the students avoided confrontation. `[fixture]` |
| `e4.S` | Ida | Nonviolent never meant passive. They broke an unjust rule on purpose, stayed put, and met violence with discipline. |
| `e4.F` | Ida | That slide is honest. Look for the claim that turns nonviolence into passivity. |

#### e5_freedom_rides · Relay Line (linker.chain)
| ID | Speaker | Line |
|---|---|---|
| `e5.A` | Ida | The terminal's relay line is dead. Six junction boxes, five events of 1961. Wire each cause to what it caused. |
| `e5.I` | Ida | Wire each junction box to the event it caused, then close the circuit. |
| `e5.H1` | Ida | Start with the ruling the riders wanted to test. `[fixture]` |
| `e5.H2` | Ida | Violence became news; news became pressure. `[fixture]` |
| `e5.H3` | Ida | The federal enforcement came last, and not by choice. `[fixture]` |
| `e5.S` | Ida | Riders tested a ruling, violence made headlines, and only then did Washington act. The movement pushed first. |
| `e5.F` | Ida | The current stops at that box. Follow the pressure: who tested what, what exposed it, and who acted last. |

#### e6_birmingham · Broadcast Relay (linker.chain)
| ID | Speaker | Line |
|---|---|---|
| `e6.A` | Ida | Five relay stations up the mast and one stray. Link each event in Birmingham to the one it toppled. |
| `e6.I` | Ida | Wire the relay stations up the mast, cause to effect, then close the circuit. |
| `e6.H1` | Ida | Begin with the marches themselves. `[fixture]` |
| `e6.H2` | Ida | The images only mattered because they were seen. `[fixture]` |
| `e6.H3` | Ida | The bill was the last domino, not the first. `[fixture]` |
| `e6.S` | Ida | Kennedy's bill had a chain of causes behind it: marches, violence, cameras, opinion. No single push did it. |
| `e6.F` | Ida | The signal dies partway up. A bill doesn't come from nowhere; trace what had to be seen before anyone acted. |

#### e7_march · Program Switchboard (linker.pairs)
| ID | Speaker | Line |
|---|---|---|
| `e7.A` | Ida | The March's program is scrambled on the switchboard. Four names, five roles. Patch each name to its part. |
| `e7.I` | Ida | Patch each name jack to its role jack, then connect the program. |
| `e7.H1` | Ida | The march had organizers as well as a famous speaker. `[fixture]` |
| `e7.H2` | Ida | Its full name was the March on Washington for Jobs and Freedom. `[fixture]` |
| `e7.H3` | Ida | The person who signed the act was a president, not a marcher. `[fixture]` |
| `e7.S` | Ida | A march has architects, and this one demanded jobs as well as freedom. The famous speech was its close, not its whole. |
| `e7.F` | Ida | That cord won't seat. Labor and civil rights veterans built this march; read the clue on the program's margin. |

#### e8_cra · Filing Cabinets (sorter.bins)
| ID | Speaker | Line |
|---|---|---|
| `e8.A` | Ida | Two cabinets, two laws, six provisions coming down the tube. File each slip under the act that created it. |
| `e8.I` | Ida | File each provision slip in its act's cabinet, then seal the cabinets. |
| `e8.H1` | Ida | Ask what each provision is about: public life and jobs, or the ballot. `[fixture]` |
| `e8.H2` | Ida | Anything about registering or voting belongs to 1965. `[fixture]` |
| `e8.H3` | Ida | The 1964 act's dates and titles are about accommodations and employment. `[fixture]` |
| `e8.S` | Ida | The 1964 act opened lunch counters, hotels and workplaces. The ballot needed its own law a year later. |
| `e8.F` | Ida | A slip bounced back. The 1964 act targeted segregation and job discrimination; the vote waited for 1965. |

#### e9_selma · Timeline Bridge (sequencer.linear)
| ID | Speaker | Line |
|---|---|---|
| `e9.B` | Ida | The chapter's order lies. The dates don't. `[fixture beat, before]` |
| `e9.A` | Ida | The bridge deck is in pieces. Set the planks by their dates. One plank belongs to a different story. |
| `e9.I` | Ida | Set the bridge planks in date order, then lock the span. |
| `e9.H1` | Ida | Dates decide the order, not the page they appear on. `[fixture]` |
| `e9.H2` | Ida | The 1964 act came before Selma. `[fixture]` |
| `e9.H3` | Ida | The voting law was signed in the summer after the march. `[fixture]` |
| `e9.S` | Ida | The page order is the author's. The dates are the record's: the 1964 act, Bloody Sunday, the march, the 1965 act. |
| `e9.F` | Ida | The span tips at that bay. Scrub the Record Strip across the bridge and read each plank's date as you pass. |

#### e10_sources · Provenance Drawers (sorter.bins)
| ID | Speaker | Line |
|---|---|---|
| `e10.A` | Ida | Six documents spilled from the cabinet. File each as primary or secondary. Theo thinks old means primary. |
| `e10.I` | Ida | File each document in the Primary or Secondary drawer, then seal the stacks. |
| `e10.H1` | Ida | Ask who made it and when, not how old it is. `[fixture]` |
| `e10.H2` | Ida | A textbook from 1971 is still someone else's later account. `[fixture]` |
| `e10.H3` | Ida | Words or images from the people who were there are primary, even if recent. `[fixture]` |
| `e10.S` | Ida | A source is primary because of who made it and when, not because it's old. A 1971 textbook is still secondhand. |
| `e10.F` | Ida | That drawer spat it back. Age doesn't decide it. Who made this, and were they there when it happened? |

#### e11_causation · Big Board (linker.chain)
| ID | Speaker | Line |
|---|---|---|
| `e11.A` | Ida | The Big Board. Seven canisters, and two belong to an earlier chain. Connect Birmingham to the Voting Rights Act. |
| `e11.I` | Ida | Run a tube from each event to the one it caused, then send the capsule. |
| `e11.H1` | Ida | Start in Birmingham and end with the vote. `[fixture]` |
| `e11.H2` | Ida | Each law followed a televised crisis. `[fixture]` |
| `e11.H3` | Ida | 1963, 1964, 1965: two crises, two laws. `[fixture]` |
| `e11.S` | Ida | Crisis, pressure, law. Birmingham brought the 1964 act and Selma brought the 1965 act. The same circuit closed twice. |
| `e11.F` | Ida | The capsule jammed. Each tube is a cause and its consequence. Check your Record Strip for what came first. |

#### e12_boss · Tumbler Vault (investigator.elimination)
| ID | Speaker | Line |
|---|---|---|
| `e12.B` | Editor | Tell me why 1965. Not what happened. Why. `[fixture beat, before; same as X09]` |
| `e12.A` | Ida | Four tumblers, four explanations. Pin each clue to what it rules out. One will be left standing. |
| `e12.I` | Ida | Pin clues to the tumblers they rule out, then name the explanation that stands. |
| `e12.H1` | Ida | Check each explanation against the dated clues. `[fixture]` |
| `e12.H2` | Ida | What does the 2% registration figure rule out? `[fixture]` |
| `e12.H3` | Ida | Only one explanation survives every clue. `[fixture]` |
| `e12.S1` | Editor | That's the story. Print it. `[fixture beat, after]` |
| `e12.S2` | Ida | Pressure made law. Selma's televised violence moved a voting bill in days, where eleven years had not. |
| `e12.F` | Editor | That tumbler won't turn. One of your own clues rules it out. Dated sources decide which explanation survives. |

#### Minor NPCs and collectibles
| ID | Speaker | Line |
|---|---|---|
| `N01` | Otis | Main breaker's by the stair. Water got the lower fuses, but the Engine runs on its own line. |
| `N02` | Otis | There she goes. Haven't seen those rings turn since the week I was hired. |
| `N03` | Hattie | Brown's set in type again. Every repair you make, I print it on the wall of front pages. |
| `N04` | Hattie | Two laws, two front pages. People mix them up, so I set them in different faces. |
| `N05` | Dolores | I ran a cord board for thirty years. Left jack is who, right jack is what. The lamp tells you it's seated. |
| `N06` | Dolores | A march that size ran on phone calls and paper. Somebody planned every bus and every marshal. |
| `N07` | Theo | This 1971 textbook is super old, so it's a primary source. Right? It's older than my mom. |
| `N08` | Theo | Okay. It's old, but whoever wrote it wasn't there. The 1963 photo is the real witness. |
| `N09` | Ida | A lost negative. Keep it in your satchel. The darkroom by the stacks can develop it. |
| `N10` | Ida | That's all five. The darkroom light is on. Let's see what the Editor was keeping. |
| `N11` | Otis | He used to lock himself in there with his contact sheets. Said the pictures argued back. |
| `N12` | Hattie | Bring me that printed program when you're done out there. It deserves a frame. |

#### Outro
| ID | Speaker | Line |
|---|---|---|
| `O01` | Editor | You found the story I sealed: pressure made law, and the evidence proves it. `[fixture]` |
| `O02` | Editor | I sealed it because people kept telling it as one speech and one signature. It was years of organizing. |
| `O03` | Ida | Look out the window, Nell. Every projection's lit. The city holds its whole shape now, 1954 to 1965. |
| `O04` | Ida | Rulings, a boycott, sit-ins, rides, marches, two laws, each tied to what caused it. That's a record you can defend. |
| `O05` | Otis | Sun's up. Nobody's hauling anything out of here today. |
| `O06` | Hattie | Front page is set. First edition in ten minutes. |
| `O07` | Ida | Go home and sleep. Tomorrow somebody will ask you what happened. Tell them why. |
| `O08` | Editor | You developed my negatives too. Then you know the pictures were never the whole story. The people were. |

**Total: 127 lines.** That is 10 intro + 10 transitions + 87 per-encounter + 12 NPC/collectible + 8 outro,
counting the fixture beats inside the encounter tables.

**Failure-line rule (all F lines):** a failure line names *where* to look (a verb, an evidence source), never
*what* the answer is. Three F lines (e2, e8, and e1's second sentence) paraphrase the fixture's own
`wrongFeedback`, which the fixture author already vetted as non-leaking. `wrongFeedback` is not rendered anywhere
at runtime today (grep: no use in `src/game`/`src/app`), so the overlay's F lines are how it reaches the player.

---

## 5 · Contraptions

### 5.0 Shared systems (every contraption in this game uses them)

#### 5.0.1 Live protocol (engine extension; see Appendix A)
`HostHandle.setLiveValue(value: unknown)` already accepts `unknown`. The widget side (`WidgetProps.onLive`, typed
`number`) is widened as runtime map §1.5 recommends. This game sends four message kinds:

```ts
type LiveMsg =
  | { kind: "cursor"; year: number }                                   // Record Strip scrubber (every panel)
  | { kind: "draft"; encounterId: string; draft: unknown }             // partial Input of the current mode (per §5.x)
  | { kind: "hint"; encounterId: string; rung: 1 | 2 | 3 }             // info button pressed: the world reacts
  | { kind: "verdict"; encounterId: string; correct: boolean; focus: string[] }; // after grade(), before consequence
```

**The honesty rule.** A contraption's `pose()` may read only:
- the mode's **view** (what the player sees);
- the player's **draft**;
- the overlay's per-item display metadata (dates *printed on* items, claim footprints);
- after a `verdict`, the grade's `focus`.

It never reads `params`-derived answers (the solution, `isTrue`, `binId`, etc.) **until a correct verdict**, after
which the success animation may use the solution. A lint rule enforces this: files in
`src/game/contraptions/**/pose.ts` may not import from `src/mechanics/**` except types.

**Additive grade field (mechanics-dev, non-breaking).** `Grade.focus?: string[]` names what the feedback is
about. It is computed inside each mode's existing `grade()` from the same variables the feedback string already
uses, so **grading logic is unchanged**:

| Mode | `focus` on a miss |
|---|---|
| mimic | `[String(input.statementIndex)]` (the honest one the player picked) |
| predict_reveal | `[String(input.optionIndex)]` |
| linear | `["slot:<n>", <key at that slot>]`, or `[<decoyKey>]` |
| chain | `[<decoyKey>]`, or `[<wrongFrom.from>]` |
| pairs | `[<wrong leftKey>]` |
| bins | `[<wrong itemKey>, "bin:<correct binId>"]` (the correct bin is already named in the feedback text) |
| elimination | `[input.hypothesisId, "clue:<eliminating index>"]` (the clue is already quoted in the feedback text) |

#### 5.0.2 The Record Strip and the year cursor (the orange scrubber for history)
Every panel in this game has, at its top, **two stacked timeline cards** that share one x-axis in **years**, with
**one orange year cursor** crossing both. This is the history translation of the bible's f/g/h stack and orange
f(a) scrubber (checklist items 18, 19, 21, 22).

- **Card 1: `RECORD`** (label tab top-right, colour `fn.f` white).
  - Earned pins: every fact restored so far (table below), drawn as white pins, with bands for spans.
  - The **y-axis has three labelled lanes**: `ORIGINS`, `DIRECT ACTION`, `LEGISLATION` (the fixture's units).
    A pin sits in its unit's lane, so both axes carry labelled ticks.
  - Unearned slots are empty (like the bible's empty h(x) card, still drawn).
  - After e10, pins gain a provenance badge (`P`/`S`). After e11, causal **arrows** are drawn between the
    Birmingham → bill → 1964 act and Selma → 1965 act pins.
- **Card 2: `FILE`** (label tab, colour `fn.g` green). The current encounter's items that carry a printed date,
  and the player's draft plotted in time (per contraption). For bins it uses a second colour, `fn.h` blue, for
  the second drawer.
- **Ruler row** (bible §3.4):
  - ticks every month, labels every year (e.g. `1955 1956 1957`), window per encounter (below);
  - orange teardrop knob; the vertical orange line crosses both cards;
  - input tab **`YEAR`** in orange with a readout box showing **`MAR 1965`**;
  - keys: ←/→ = 1 month, Shift+←/→ = 1 year, Home/End = window ends; `role="slider"`, `aria-valuetext="March 1965"`.
- **Value chips** (bible §3.5): on the left edge of each card, overhanging into the world.
  - RECORD chip (white border): the label of the nearest earned pin within ±2 months of the cursor, e.g.
    `SEP 1957 · LITTLE ROCK`, or `—` if there is none.
  - FILE chip (green border): the draft item under the cursor, e.g. `BAY 2 · MAR 7 1965`.
- **World link (every scene): the Record Lens carriage.**
  - A brass carriage (160 × 140) hangs from a riveted **record rail** that runs over each contraption like the
    lintel in 9.png.
  - Its x-position is driven by the cursor:
    ```
    u        = clamp((year - win.start) / (win.end - win.start), 0, 1)
    target.x = rail.x0 + u * rail.length
    carriage.x += (target.x - carriage.x) * (1 - 0.75 ** (dt * 60))   // ≈ 0.25/frame; ~0.2 s visible lag
    ```
  - The lens throws a projector cone (`cr.light.projector_cone`, ADD, `cr.recordlight` 35 %) onto the scene's
    projection surface. When the RECORD chip names a pin, the cone shows that pin's **document plate**: a framed
    headline card with the date and label, fading in over 200 ms.
  - The carriage carries a **world chip** with an orange border (it is bound to input) showing `MAR 1965`.
- **Pins earned per restored encounter** (the fixture dates only; nothing invented):

  | Earned by | Pin(s) (date · label · lane) |
  |---|---|
  | e1 | `1954 · Brown v. Board` (Origins) |
  | e2 | `DEC 1 1955 · Parks arrested` + band `DEC 1955–DEC 1956 · Boycott, 381 days` (Origins) |
  | e3 | `SEP 25 1957 · Little Rock Nine escorted` (Origins) |
  | e4 | `FEB 1 1960 · Greensboro sit-in`; `APR 1960 · SNCC founded` (Direct action) |
  | e5 | `1961 · Freedom Rides` (Direct action) |
  | e6 | `SPRING 1963 · Birmingham`; `JUN 1963 · Kennedy's bill` (Direct action → Legislation) |
  | e7 | `AUG 28 1963 · March on Washington` (Legislation) |
  | e8 | `JUL 2 1964 · Civil Rights Act` (Legislation) |
  | e9 | `MAR 7 1965 · Bloody Sunday`; `MAR 25 1965 · March reaches capitol`; `AUG 6 1965 · Voting Rights Act` (Legislation) |
  | e10 | provenance badges on all pins |
  | e11 | causal arrows (see above) |
  | hints | e1.H2 adds a hint-pin `1957 · Little Rock` (drawn dashed, even before e3) |

#### 5.0.3 Projection states (every landmark)
`dormant` (wireframe, −60 % saturation, 40 % alpha, scanlines, drifting scraps) → `live` (the console is open:
the contraption parts saturate to 70 % and glow only on driven parts; bible "glow = live") → `printing` (0.8 s
cyan scanline sweep) → `solid` (full colour, collision on, record-light beam to the antenna ring).

**World state derives from runner progress** (fixes runtime-map D3): `solidFor(encounterId) = index <
runner.currentIndex`. So `skipTo`/`autoSolve` produce the right world; `celebrate()` only plays the animation.

#### 5.0.4 Failure grammar (non-punitive, informative, no leak)
On `verdict.correct === false`:
1. The world plays a **mechanical** refusal at the `focus` object: a lamp flickers amber, a slab tips, a fuse
   pops, a slip bounces, a cord unseats, a tumbler grinds. It takes 600–900 ms, with no red flashes, screen shake,
   or damage.
2. Ida's F line types into the dialogue bar.
3. The grade's feedback string appears as a **margin note** under the Verify button, in a typewriter face on a
   paper-texture strip.

The draft stays in place (except the single refused item where noted), so the player edits rather than restarts.
The mastery penalty is the runner's; there are no lives or timers.

#### 5.0.5 Hints are world actions
The info button calls `runner.hint()` (the fixture ladder) **and** emits `{kind: "hint", rung}`:

| Rung | World action (all encounters) | Plus (per contraption, in §5.x) |
|---|---|---|
| 1 | Wick flies to the concept's evidence object and circles it twice | the brass shutter over a feature plate opens (bins), or a lamp dims to call attention |
| 2 | Wick lands on the console; the RECORD card gains any hint-pin | a guide overlay appears on the FILE card |
| 3 | Wick hovers over the item that H3 names | that item's frame gets a dashed salmon outline (`ui.info.warm`), never orange |

#### 5.0.6 Success grammar (1.2–2.5 s, then traversal)
1. Verify → the badge (bible §3.8) replaces the Verify button for 1.6 s.
2. The contraption's own animation plays (per §5.x).
3. `printing` sweep → `solid`, and a record-light beam lifts from the landmark to the antenna ring (0.9 s arc).
4. The objective ring gains a segment, and the Engine lens for this encounter lights (visible in S1/S8, and as
   a pip on the ring).
5. The insight line (S) replaces the instruction.
6. The panel slides out (280 ms) and the camera eases back to Explore framing. **The path forward is now the
   thing just built.**

Sound hooks (ids for the audio pass, all optional): `sfx.lamp_swing`, `sfx.slide_retract`, `sfx.slab_set`,
`sfx.teletype`, `sfx.relay_click`, `sfx.current_hum`, `sfx.fuse_pop`, `sfx.cord_seat`, `sfx.drawer_thunk`,
`sfx.tube_whoosh`, `sfx.bolt_slide`, `sfx.press_roll`, `sfx.printing_sweep`, `sfx.beam_rise`.

#### 5.0.7 Panel layouts used

```
SCRUB (mimic, predict_reveal): world 60 % | panel 40 %            BOARD (linear, chain, pairs, bins): world 45 % | panel 55 %
┌───────────────────────────┬──────────────────────┐            ┌───────────────────────┬───────────────────────────────┐
│ ◯ objective ring          │ ← back               │            │ ◯                      │ ← back                        │
│                           │ [RECORD  ────┃────]  │            │                        │ [RECORD ──────┃──────]         │
│   world: contraption,     │ [FILE    ────┃────]  │            │  world: contraption    │ [FILE   ──────┃──────]         │
│   Record Lens carriage    │ YEAR│MAR 1965│ruler◆ │            │  (camera centres it)   │ YEAR│JUL 1964│─────ruler◆──── │
│   (chips hang off panel ◀)│ [SLIDE A] ◯ socket   │            │                        │ ┌palette┐ ┌── mode board ──┐ │
│                           │ [SLIDE B] ◯          │            │                        │ │tokens │ │ slots / nodes / │ │
│                           │ [SLIDE C] ◯          │            │                        │ │  ...  │ │ jacks / drawers │ │
│                           │ •──[ RETRACT SLIDE ]──•│            │                        │ └───────┘ └────────────────┘ │
├─────────────────┬─────────┴──────────────────────┤            │                        │ •────[ CLOSE THE CIRCUIT ]───• │
│                 │ (Reel) Instruction / insight … │            ├───────────────┬────────┴───────────────────────────────┤
│                 │  (i)                     • • ◉ │            │               │ (Reel) line …                (i) • • ◉ │
└─────────────────┴────────────────────────────────┘            └───────────────┴────────────────────────────────────────┘
VAULT (e12): centred modal 80 % × 85 % over the dimmed vault room (left brief column 30 %: the Editor's question, emblem, i).
```
- Timeline cards are 12 % of screen height each in Board mode and 15 % in Scrub mode.
- The mode board fills the remaining height.
- All card, chip, knob, button, badge, trace-terminal and hex-texture specs are the bible's §3, unchanged.

---

### 5.1 e1_brown · **Witness Projector** (truth_finder.mimic) · S2 · Scrub mode
- **In-world object** (S2, x 900–2800):
  - the **Proof Lamp**: an arc lamp on a brass swivel stand (0.9 H), with its head pivoting at (20, 55);
  - three **Witness Lenses**: lantern-slide projectors on tripods at x 1500, 1700 and 1900;
  - three pale **projection panels** between the courthouse's centre columns (220 × 300 each).

  Each lens throws its slide onto its panel. The claim text appears as a typeset newspaper slug: 30 px serif,
  `cr.ink` on `cr.paper`, 3 lines max. The Record Lens carriage rides a rail along the courthouse cornice.
- **Control (panel):**
  - three stacked **SLIDE A/B/C** document cards (display order = `view.chests` order), each showing its claim
    text;
  - an **aim socket** (a 60 px orb glyph) on each card's left edge (hollow; aimed = orange ring);
  - click, Enter on a focused card, or keys 1–3 to aim;
  - the Record Strip above.
- **Draft:** `{ statementIndex: number | null }` (the aimed card's `statementIndex`).
- **Live binding:**
  ```
  k        = display position of draft.statementIndex (0..2), or null
  θ_target = k == null ? θ_idle(t) : atan2(panel[k].cy - lamp.y, panel[k].cx - lamp.x)
  θ_idle(t)= θ_center + 6° * sin(2π * 0.2 * t)                 // slow searching sweep when nothing is aimed
  lamp.head.rotation += (θ_target - lamp.head.rotation) * (1 - 0.75 ** (dt*60))
  beam: from lamp.head tip to the nearest panel hit (raycast); length eases like the angle
  panel[i].brightness = i == k ? 1.0 : 0.65 ; panel[i].scale = i == k ? 1.06 : 1.0 (eased)
  on aim change: the slide's slug re-types at 45 chars/s ("the type lifts", bible §7.3)
  ```
- **FILE card (claim footprints, overlay data):**
  - s0 is a pin at `1954`;
  - s1 is a band `1954–1955` labelled "claimed: desegregated";
  - s2 is an arrow from a broken-axis marker `1896 ≈` to `1954` labelled "overturned".

  All three claims carry a footprint, so the card is not a tell. The aimed claim's footprint is drawn in green.
  The others are drawn at 40 %.
- **Year cursor:** window `1950–1960` (with the axis break to show 1896). RECORD is empty at e1, which is the
  point: this is the first repair. **H2 adds the dashed hint-pin `1957 · Little Rock`.** Once it is there, the
  s1 band ending in 1955 visibly contradicts it on the same axis: the IVT-vault feeling of 8.png, made
  historical.
- **Verify:** `RETRACT SLIDE`, enabled when `draft.statementIndex != null`. It submits `{ statementIndex }` to
  `mimic.grade`.
- **Success** (2.0 s): the lamp flares; the false slide's slug is struck through by a rubber stamp
  **"RETRACTED"** (salmon ink `#C4643C`, rotated −8°); the slide ejects from its lens and flutters down. The two
  true slides merge into one steady projection of the courthouse. The steps run a **printing sweep** from bottom
  to top and turn solid. Badge: **SLIDE RETRACTED**. Payoff: Nell climbs the courthouse steps to the upper
  terrace, the only route past the flooded gutter. The plaque by the door lights with the e1 `sourceRef` quote.
- **Failure** (`focus = [picked]`): the aimed slide holds **steady and brighter** ("honest"), and its lens gives
  one calm pulse. Ida says e1.F; the margin note shows the grade feedback (the picked claim's explanation). The
  lamp stays aimed so the player can re-aim.
- **Visible misconception** ("Brown ended school segregation immediately"): with the H2 pin on RECORD, the s1
  footprint band (1954–55) ends two years before federal troops were needed (1957). The contradiction is
  *drawn*.
- **Hints (world):**
  - H1: Wick circles the courthouse doors (the ruling), then drifts to the dark L2 school silhouettes on the
    horizon (enforcement).
  - H2: the hint-pin appears, and the Record Lens swings to project its plate.
  - H3: dashed salmon outline on the named slide.
- **Insight:** e1.S.
- **Extended view/input:** none. The draft is the existing `Input` shape with `null` allowed. Claim footprints are
  overlay data keyed by `statementIndex`.

### 5.2 e2_montgomery · **Walking Road** (sequencer.linear) · S2 · Board mode
- **In-world object** (S2, x 3600–5300):
  - the empty 1950s **city bus**, parked, lights off;
  - the **bus stop shelter** with a flip-number **DAY counter** (3 digits);
  - a flooded street gap (x 4200–5200) with **4 slab bays** (260 × 60 each) marked by faint wireframe outlines at
    y 900, spanning the water.
- **Control (panel):**
  - a **plank palette** column (5 plank tokens: 4 steps + 1 decoy, in `view.planks` order);
  - a **slot rail** of 4 numbered slots drawn as the bays;
  - drag, or keyboard: Tab to a plank, Enter to pick, 1–4 to drop into a slot, Backspace to return it.
- **Draft:** `{ slots: (string | null)[] }` (length `view.slots`; keys `s*`/`d*` as in the mode).
- **Live binding:**
  ```
  for bay j: slab[j].state = slots[j] ? "placed" : "empty"
  placed slab: materializes from the water (y from 960 → 900, alpha 0 → 0.85, 300 ms ease-out),
               engraved with the plank's first 28 chars; all placed slabs look IDENTICAL (no decoy tell)
  empty bay:   wireframe outline pulses at 0.5 Hz
  shelter sign "ROUTE" lamp count = number of placed slabs (neutral completion)
  ```
- **Year cursor:** window `NOV 1955 – FEB 1957`. RECORD has `1954 · Brown`. The **DAY counter** in the world is
  bound to the cursor:
  ```
  day = clamp(round((year - 1955.917) * 365.25), 0, 381)   // Dec 1 1955 = day 0
  ```
  It is a live world readout (the 381 comes from the plank text, so there is no leak). The FILE card shows the
  placed planks as green markers at slot positions (ordinal; no dates, because the planks are undated except the
  first).
- **Verify:** `LIGHT THE ROUTE`, enabled when all slots are filled. It submits `{ keys: slots }` to
  `linear.grade`.
- **Success** (2.2 s): the slabs lock left to right (120 ms each, stone thunk). Footprint decals stream across
  them while the DAY counter runs 0 → 381. The last slab ("Supreme Court affirms…") locks, the empty bus's
  interior lights come on (**empty**, no figures), and the route sign flips to lit. Badge: **ROUTE RESTORED**.
  Payoff: Nell walks the Walking Road across the flood to the far corner.
- **Failure:**
  - `focus` has `slot:n`: slabs 1..n−1 lock and stay; slab n **tips** 12° and sinks back to the water (its plank
    returns to the palette); later slabs stay placed.
  - `focus` is a decoy key: that slab dissolves into scraps, its engraved text floating for 1 s. The margin note
    shows the grade feedback.
- **Visible misconception** ("tired seamstress who acted alone"): the decoy plank ("Parks decides on the spot to
  start a protest movement by herself") has **no bay that can bear it**. When the draft includes it, the road
  cannot reach the far corner (4 slots, 5 planks). On a miss, the dissolve names it.
- **Hints (world):**
  - H1: Wick lands on bay 1, then bay 4 (start and end).
  - H2: a faint dotted "walking and carpooling" path of footprints appears between bays 2 and 3 on the FILE card.
  - H3: dashed salmon outline on the plank about leaders organizing.
- **Insight:** e2.S.
- **Extended view/input:** partial draft `slots: (string|null)[]` (the submit shape is unchanged).

### 5.3 e3_little_rock · **Wire Ticker and Prediction Selector** (truth_finder.predict_reveal) · S3 · Scrub mode
- **In-world object** (S3, x 1000–2700):
  - the **newsstand** with a **teletype** (a paper roll feeding up out of the body);
  - a brass **Prediction Selector** console (0.7 H): a rotary dial with three engraved positions A/B/C and a
    pointer knob;
  - a telegraph wire running from the kiosk up the hill to the school;
  - the school's barred doors, and 9 unlit walk lamps.
- **Control (panel):**
  - a **scenario card** (typewriter, from `view.scenario`);
  - three **FORECAST A/B/C** option cards (`view.options` order), each with a socket;
  - the Record Strip.
- **Draft:** `{ optionIndex: number | null }`.
- **Live binding:**
  ```
  knob.rotation_target = [-40°, 0°, +40°][display position]   (eased as §5.0.2)
  teletype head types "FORECAST: <option text>" on the tape preview line at 45 chars/s, retyped on change
  telegraph wire vibrates: y_offset(x,t) = 2px * sin(2π(3t - x/120)) while a forecast is set
  ```
- **Year cursor:** window `1954–1958`. RECORD has Brown and Montgomery. The FILE card shows `SEP 1957 · Guard
  posted` (from the prompt). The Record Lens rides the telegraph wire.
- **Verify:** `SEND TO THE WIRE`. It submits `{ optionIndex }` to `predict_reveal.grade`.
- **Success** (2.5 s):
  - The ticker chatters and prints the fixture's **`reveal`** (sourced) with a date slug `SEP 25 1957`.
  - The tape feeds up the wire, which glows cyan along its length to the school.
  - The door barrier dissolves into scanlines, and the **nine walk lamps light one at a time** (180 ms each, a
    quiet memorial count). The doors open.

  Badge: **WIRE CONFIRMED**. Payoff: Nell walks up the front walk and through the doors (the frame seam is the
  school corridor).
- **Failure:** by the mode's design, a wrong prediction still **prints the reveal** plus the picked option's
  explanation (grade feedback). World:
  - the ticker prints the reveal;
  - the forecast line on the tape is stamped **"NOT WHAT HAPPENED"**;
  - the selector unlocks.

  Ida says e3.F. The player then files the true outcome (a second submit). This is the one place the answer is
  shown after a miss, which **is** the predict-then-reveal pedagogy. The runner already applies `missPenalty` on
  the first attempt.
- **Visible misconception** ("Southern states complied with Brown once it was decided"): the RECORD pin for
  Brown (1954) sits three years left of the FILE pin (Sept 1957), and the barred doors are in view the whole time.
- **Hints (world):**
  - H1: Wick circles the barrier, then the federal-court document plate.
  - H2: the selector's dial face lights its three engravings.
  - H3: Wick hovers over the kiosk's radio.

  No outline, because the fixture H3 names no answer.
- **Insight:** e3.S.
- **Extended view/input:** none.

### 5.4 e4_sit_ins · **Witness Projector, menu-board variant** (truth_finder.mimic) · S4 · Scrub mode
- **In-world object:**
  - the **menu board**'s three panels (in the lunch-counter cutaway) are the projection surfaces;
  - the **Proof Lamp** is the counter's swivel **pendant lamp** (pivot at the ceiling mount; it swings in an arc);
  - there are no separate lenses: the menu board is a slide projector wall (a hidden projector booth behind a
    grille);
  - 12 empty stools; the locked swing door.
- **Control, draft, live binding:** as in §5.1, with a swing instead of a turn:
  ```
  pendulum: lamp.rotation_target = asin(clamp((panel[k].cx - pivot.x) / cordLength, -0.9, 0.9))
  lamp swings with a damped overshoot (spring k=10, damping 0.7) instead of plain easing: it feels hung
  ```
- **FILE card:** `FEB 1 1960` (from the concept name "Greensboro sit-ins (1960)" and claim s0's printed date).
  No claim footprints this time, because s1 has no date and a footprint would be a tell.
- **Year cursor:** window `1959–1961`. RECORD has e1–e3.
- **Verify:** `RETRACT SLIDE`. It submits `{ statementIndex }` to `mimic.grade`.
- **Success** (2.2 s): the RETRACTED stamp, and the menu board's panel reverts to the true menu art. The **four
  stools** at the centre of the counter light from beneath, one by one (a memorial for the four students; the
  stools stay empty). The swing door unlatches. Badge: **SLIDE RETRACTED**. Payoff: through the swing door, the
  kitchen and the alley to the terminal.
- **Failure:** as in §5.1 (the honest slide holds steady and brighter).
- **Visible misconception** ("nonviolent means passive"): the **twelve empty stools and the RESERVED placard**
  (neutral text; there is no segregation sign) make the act of sitting the visible object. The mimic's claim
  "avoided confrontation" is projected directly above the stools it contradicts.
- **Hints (world):**
  - H1: Wick lands on a stool.
  - H2: the pendant lamp dims the whole room except the stools.
  - H3: dashed outline on the named slide.
- **Insight:** e4.S.
- **Extended view/input:** none.

### 5.5 e5_freedom_rides · **Relay Line** (linker.chain) · S4 · Board mode
- **In-world object** (the terminal, x 2600–4500):
  - **6 brass junction boxes** (150 × 190) along the canopy rail at y 520, one per `view.nodes` entry (5 + 1
    decoy) in display order, each with its node text on a typed card behind glass, and an output lamp on top;
  - the **split-flap departures board**;
  - the **brass divider rail** between the two waiting-room doors;
  - the **rolling gate** (closed).
- **Control (panel):**
  - a **node cloud**: 6 node cards on a board, positioned to mirror the world boxes;
  - click a card's **output terminal** (bottom dot), then another card's **input terminal** (top dot) to draw a
    directed edge; click an edge to delete it;
  - keyboard: Tab to a card, Enter to start, arrows to the target, Enter to connect;
  - an edge counter `3 / 4 WIRES` (from `view.edgeCount`).
- **Draft:** `{ edges: { fromKey, toKey }[] }` (partial).
- **Live binding:**
  ```
  each draft edge → a catenary wire between the world boxes (white, uncharged):
     p(t) = lerp(A, B, t) + (0, sag * 4t(1-t)),  sag = 0.12 * |B.x - A.x| + 24
     wire "settles": sag overshoots 15 % then eases back (spring) when first drawn
     small arrow ticks every 80 px pointing from → to
  a box with an outgoing wire: output lamp amber-ready (NOT correctness)
  terminal wall gauge ("LINE CHARGE"): needle = edges.length / edgeCount (completion only)
  ```
- **Year cursor:** window `1960–1962`. RECORD has e1–e4, plus the SNCC pin. The FILE card shows `1961` (from the
  concept name). The Record Lens rides the canopy rail.
- **Withheld photo plate** (by the departures board): a framed sepia blur, a camera glyph, and the caption only:
  the node text about the Anniston firebombing. It lights when the Record Lens passes it. **Nothing burning is
  ever drawn.**
- **Verify:** `CLOSE THE CIRCUIT`, enabled when `edges.length === edgeCount`. It submits `{ edges }` to
  `chain.grade`.
- **Success** (2.4 s):
  - A cyan current pulse (600 px/s) runs the chain in causal order. Now that the verdict is correct the solution
    may be read, so it enters at n0 and each box lamp turns cyan as the pulse arrives.
  - The **departures board** flips (split-flap cascade) to show each dated caption in order.
  - The brass **divider rail between the waiting rooms lifts away** into the ceiling.
  - The **rolling gate** rises.

  Badge: **CIRCUIT CLOSED**. Payoff: onto the platform and up the stair to the overpass seam.
- **Failure:**
  - `focus` is a decoy: that box's fuse pops (spark + puff), and its card flutters half out ("isn't part of this
    chain").
  - `focus` is `wrongFrom.from`: that box **sparks and its lamp flickers amber**, and the wire leaving it goes
    slack.

  In both cases the margin note shows the grade feedback ("What does X actually lead to?"). No current flows on
  a miss, so nothing beyond the grade's own disclosure is shown.
- **Visible misconception** ("the federal government led the movement"): the Kennedy/ICC box hangs at the far end
  of the canopy, over the gate. Until everything before it is wired, the gate (federal enforcement) has no power
  to lift. The layout argues that the movement pushed first.
- **Hints (world):**
  - H1: Wick circles the box about the Supreme Court ruling.
  - H2: the withheld photo plate lights and the departures board flickers "NEWS".
  - H3: Wick lands on the ICC box.
- **Insight:** e5.S.
- **Extended view/input:** partial draft of `Input.edges`.

### 5.6 e6_birmingham · **Broadcast Relay** (linker.chain) · S5 · Board mode
- **In-world object:**
  - the **broadcast mast** with 5 **relay stations** (dish + insulator bank + typed card window) at increasing
    heights, and a 6th stray station on its own pole;
  - the church rose window;
  - the dark L2 skyline windows;
  - the dark **service lift cage** at the mast foot.

  World station order follows `view.nodes` display order (shuffled). Stations are assigned to heights by display
  index, so height reveals nothing.
- **Control and draft:** as in §5.5.
- **Live binding:** as in §5.5, with the wires strung **vertically** between stations (vertical catenary: the sag
  is lateral, `sag_x = 0.08 * |dy| + 16`). Each drawn edge makes the destination dish **turn to face** the
  source:
  ```
  dish.rotation_target = atan2(src.y - dst.y, src.x - dst.x)   (eased)
  ```
  The dishes "listen" to what you wired.
- **Year cursor:** window `1962–1964`. RECORD has e1–e5. The FILE card shows `SPRING 1963` and `JUN 1963`,
  printed in node text. The Record Lens rides a rail along the park's bandstand roofline.
- **Verify:** `CLOSE THE CIRCUIT`, submitting to `chain.grade`.
- **Success** (2.5 s):
  - The current climbs the mast station by station. Each dish flashes.
  - When the "Television and newspapers carry the images" station lights, **the L2 skyline windows light in a
    wave**, left to right over 1.2 s: the nation watching.
  - The top station fires a record-light beam to the antenna ring. The **lift cage** powers.

  Badge: **CIRCUIT CLOSED**. Payoff: Nell rides the lift 780 px up to the rooftops (vertical traversal), and the
  camera follows.
- **Failure:** as in §5.5 (spark at the focus station; its dish droops 20°). There is no skyline change on a miss.
- **Visible misconception** ("Every event has one cause"): the proposed bill is at the *top* of the mast only after
  success. Before that, the lift (the outcome) cannot move unless every station below is connected. A single
  wire from the marches straight to the bill leaves three dishes facing nowhere.
- **Hints (world):**
  - H1: Wick circles the church steps station.
  - H2: the skyline windows flicker once, faintly.
  - H3: Wick lands on the bill station.
- **Insight:** e6.S.
- **Extended view/input:** as in §5.5.

### 5.7 e7_march · **Program Switchboard** (linker.pairs) · S6 · Board mode
- **In-world object:**
  - a 1940s **cord switchboard** on a stand at the pool's edge: a wooden cabinet with a brass jack field, **4
    name jacks** on the left (`view.lefts`, in order: names typed on cards; **text only**), and **5 role jacks** on
    the right (`view.rights`, shuffled, including the decoy "Signed the Civil Rights Act into law");
  - a lamp above each jack;
  - the memorial steps (wireframe); 4 unlit **step lamps** on the steps' landing, one per name.
- **Control (panel):**
  - two jack columns mirroring the board;
  - click a name jack, then a role jack, to patch a cord (keyboard: Tab / Enter / arrows / Enter); click a cord
    to unplug it;
  - a **program sheet** card: a printed document titled "MARCH ON WASHINGTON FOR JOBS AND FREEDOM · AUGUST 28,
    1963", whose lines fill as cords are patched.
- **Draft:** `{ links: { leftKey, rightKey }[] }`.
- **Live binding:**
  ```
  each link → a cream patch cord with brass plugs between the two world jacks:
     rope physics: 12-point verlet chain, gravity 900, pinned at both jacks; settles in ~0.5 s
  both jack lamps light WHITE (seated, not correct); step lamp[leftIndex] lights white
  program sheet line[leftIndex] types "<name> — <role>"
  ```
- **Year cursor:** window `1962.5–1964`. RECORD has e1–e6. The FILE card shows `AUG 28 1963`. The Record Lens
  rides the colonnade's attic band.
- **Verify:** `CONNECT THE PROGRAM`, enabled when every left is linked. It submits `{ links }` to `pairs.grade`.
- **Success** (2.2 s): all jack lamps turn cyan in sequence; the program prints (a paper outfeed from the
  switchboard's slot); the steps sweep solid; the 4 step lamps glow. Badge: **PROGRAM CONNECTED**. Payoff: climb
  the memorial steps to the podium and the colonnade walkway to the Filing Hall. The printed program goes into the
  Clipping Case (Hattie frames it later).
- **Failure** (`focus = [leftKey]`): that cord **unseats** (the plug pops out and the cord drops, verlet), and its
  jack lamp flickers amber. The grade's clue (the pair's `why`) prints as a handwritten margin note on the program
  sheet.
- **Visible misconception** ("the march was only about King's speech"): the program sheet is a *list of roles*,
  and three of the four lines are not the speech. The step lamps light one per role, so the steps cannot become
  whole on the speech alone.
- **Hints (world):**
  - H1: Wick circles the program sheet's "ORGANIZERS" heading.
  - H2: the sheet's title line glows.
  - H3: the decoy role jack's lamp dims to 30 %. That is the fixture H3's meaning ("…a president, not a
    marcher"), shown in world terms without naming a pairing.
- **Insight:** e7.S.
- **Extended view/input:** partial draft of `Input.links`.

### 5.8 e8_cra · **Filing Cabinets** (sorter.bins) · S6 · Board mode
- **In-world object** (the Filing Hall):
  - a **pneumatic drop** that delivers 6 **provision slips** onto a sorting table;
  - two tall **filing cabinets** on floor rails, labelled with `view.bins` labels ("Civil Rights Act of 1964",
    "Voting Rights Act of 1965"), each with an open top drawer;
  - a **signal meter** (VU needle) per cabinet;
  - a brass **feature shutter** over each cabinet's feature plate (closed; the feature text is revealed only on a
    miss or at H1).
- **Control (panel):**
  - the slips as a palette (`view.items` order);
  - two drawer targets;
  - drag, or keys 1/2 to file the focused slip; Backspace un-files.
- **Draft:** `{ assignments: { itemKey, binId }[] }` (partial).
- **Live binding:**
  ```
  on file: slip flies from table to drawer on a quadratic Bézier (apex 180 px above), 450 ms, spins 1 turn
  meter[b].needle_target = -50° + 100° * count(b) / items.length        // completion, never correctness
  cabinet chip (world, border = that bin's colour): "3 FILED"
  FILE card: a pin per filed slip at its CABINET's year (1964.5 green / 1965.5 blue), stacked
  ```
- **Year cursor:** window `1963.5–1966`. RECORD has e1–e7 (the August 1963 march is in view at the left edge). The
  Record Lens rides the hall's cornice. Scrubbing across the two cabinets' years shows both acts' pins in the same
  frame: the concept is *two different years for two different laws*.
- **Verify:** `SEAL THE CABINETS`, enabled when all slips are filed. It submits `{ assignments }` to `bins.grade`.
- **Success** (2.0 s): the drawers slam shut (thunk ×2); both meters peg and settle; the brass shutters open to show
  both feature plates; the cabinets **roll apart on their floor rails** (600 ms), revealing a stairwell down. Badge:
  **FILES SEALED**. Payoff: down the stairwell to the river road and the Selma seam.
- **Failure** (`focus = [itemKey, bin:X]`): that slip **bounces** out of its drawer back to the table; **cabinet X's
  feature shutter opens** and shows its feature text (the same text the grade feedback quotes). The other slips
  stay filed.
- **Visible misconception** ("the 1964 act guaranteed the vote"): filing "Banned literacy tests…" under 1964 puts
  a green pin at 1964.5 on the FILE card, *before* the Bloody Sunday date (March 1965) that the player will set in
  the very next scene. After e9 the RECORD strip makes this impossible to miss on the replay.
- **Hints (world):**
  - H1: **both feature shutters open** (the defining rules become visible).
  - H2: the 1965 cabinet's meter glows.
  - H3: Wick circles the 1964 cabinet's label plate.
- **Insight:** e8.S.
- **Extended view/input:** partial draft of `Input.assignments`.

### 5.9 e9_selma · **Timeline Bridge** (sequencer.linear) · S7 · Board mode
- **In-world object:**
  - the **steel through-arch bridge** with **4 missing deck bays** at its crown;
  - a **bay lamp** on a stanchion per bay;
  - the **surveyor's lectern** console;
  - the Record Lens rail runs **along the arch** itself, so the carriage climbs and descends the arch curve.
- **Control (panel):** a plank palette (4 dated steps + 1 decoy), a 4-bay slot rail drawn as the deck, and the
  Record Strip.
- **Draft:** `{ slots: (string|null)[] }`.
- **Live binding:**
  ```
  placed plank → a deck section slides in from below the bay (300 ms), with a big WORLD CHIP on its face
               showing the date PRINTED in the plank's text (overlay itemMeta.printedDate), e.g. "MAR 7 1965"
  bay lamps: off until the cursor passes (below)
  Record Lens carriage follows the arch: x from cursor (§5.0.2), y = archY(x) (the arch curve)
  ```
- **The instrument (why this is not a tell).** Scrubbing the year cursor from `JUN 1964` to `SEP 1965` makes each
  bay's lamp light **when the cursor passes that plank's printed date**:
  - in the correct order, the lamps light in a clean left-to-right sweep;
  - in a wrong order, they light jumbled;
  - a decoy dated DEC 1956 lights at once at the window's left edge, "from a different story".

  Every lamp is driven only by dates the player can already read on the planks. The instrument turns reading
  dates into a visible check, which **is** the lesson ("Dates decide the order"). It is the Variant P8 staircase
  translated: the target is monotone time.
- **FILE card:** the placed planks' printed dates as green markers at their date positions, each connected to its
  bay number, so crossed connectors show misorder.
- **Year cursor window:** `JUN 1964 – SEP 1965`. RECORD has e1–e8, including `JUL 2 1964 · Civil Rights Act`,
  earned in e8.
- **Verify:** `LOCK THE SPAN`. It submits `{ keys }` to `linear.grade`.
- **Success** (2.5 s): the deck sections lock left to right (steel clank, 150 ms apart); the bay lamps and then all
  the arch lamps light; **the rain stops** (particles fade over 1.5 s). The printed dates remain engraved on the
  deck. Badge: **SPAN LOCKED**. **Payoff:** the crossing. Run is disabled, the music drops, and the camera pulls
  wide. Nell walks across (about 12 s). There are no figures and no reenactment; the lamps light as she passes.
  On the far bank, the plate lights: "MARCH 25, 1965" with the e9 `sourceRef` quote. Then the streetcar ride
  home.
- **Failure:** as in §5.2 (lock up to slot n−1; slot n's section tips out). The decoy's section **cannot fit the
  bay** (it is visibly shorter, a different story's plank) and slides back into the river, its date chip reading
  `DEC 1956`.
- **Visible misconception** ("events happened in the order the textbook mentions them"): the plank palette lists
  planks in the (shuffled) "page order" under a heading **"AS PRINTED IN CH. 21"**. The cursor sweep shows that
  order lighting out of time.
- **Hints (world):**
  - H1: Wick rides the Record Lens carriage along the arch once, from left to right.
  - H2: the `JUL 2 1964` RECORD pin flashes.
  - H3: the `AUG 6 1965` plank's chip glows.
- **Insight:** e9.S.
- **Extended view/input:** partial draft, plus overlay `itemMeta[key].printedDate` (the date string already in the
  plank text, parsed at authoring time).

### 5.10 e10_sources · **Provenance Drawers** (sorter.bins) · S8 · Board mode
- **In-world object:**
  - a spilled cabinet with **6 distinct documents** on the floor:
    - a 1963 photograph print;
    - a **yellowed, cracked-spine 1971 textbook**, painted *deliberately older-looking* than anything else (the
      visible trap);
    - the typed text of the Voting Rights Act;
    - a modern film case (2019 documentary);
    - a typed interview transcript dated 1965;
    - a 1988 hardcover biography;
  - a **provenance cabinet** with two drawers, "PRIMARY SOURCE" and "SECONDARY SOURCE", each with a brass feature
    shutter;
  - the closed compact shelving; **Theo** holding the textbook.
- **Control, draft, live binding:** as in §5.8 (slips become documents, each with a document icon), plus:
  ```
  on file: a rubber date stamp prints the document's MADE year (from its own text, overlay itemMeta.madeYear)
           on its corner as it enters the drawer — neutral info the player already read
  FILE card: a dot per filed document at its MADE year (green = primary drawer, blue = secondary drawer)
  Theo's "think" bubble shows the textbook icon until e10 is solved
  ```
- **Year cursor:** window `1950–2025` (labels every 10 years). The Record Lens rides the top of the shelving and
  lights the shelf section for the cursor's decade.
- **Hint-gated overlay:** at **H1**, the FILE card draws a shaded **"THE EVENTS · 1954–1965"** band. Documents
  whose made-dot sits inside the band *and* were made by someone there are primary. That is the rule, drawn.
- **Verify:** `SEAL THE STACKS`. It submits `{ assignments }` to `bins.grade`.
- **Success** (2.0 s): the drawers shut; the shutters show both features; the **compact shelving rolls apart**
  (the crank wheels spin, 6 units, 150 ms apart), opening the aisle; the **rolling ladder** unlocks. Theo says N08.
  Badge: **FILES SEALED**. Payoff: the aisle, then the ladder up to the Big Board gallery (vertical).
- **Failure:** as in §5.8 (the document bounces; the correct drawer's shutter opens). Theo's bubble flips to a "?".
- **Visible misconception** ("old means primary"): the oldest-*looking* object is secondary. On the FILE card its
  made-dot (1971) sits *outside* the events band while the pristine-looking 1963 photo sits inside it.
- **Hints (world):**
  - H1: the events band, and both shutters open.
  - H2: Wick circles the textbook.
  - H3: Wick circles the photograph and the transcript.
- **Insight:** e10.S.
- **Extended view/input:** partial draft, plus overlay `itemMeta[key].madeYear` (a year already printed in each
  item's text).

### 5.11 e11_causation · **Big Board** (linker.chain) · S8 · Board mode (panel 55 %, world 45 % showing the whole board)
- **In-world object:**
  - the **Big Board**: a brass wall (1920 × 900) with **7 pneumatic canisters** (5 nodes + 2 decoys, display
    order) mounted in a loose ring (circle motif);
  - tube channels between mounts;
  - a **capsule launcher** at the lower left;
  - through the arches beyond, the Record Engine.
- **Control and draft:** as in §5.5 (node cloud with 7 cards).
- **Live binding:**
  ```
  each draft edge → a brass tube (thick 18 px path, glass windows every 60 px) extends from source to target
     along an orthogonal route (Manhattan, 2 bends max), "growing" at 900 px/s
  canisters with an outgoing tube: their glass lid rotates open 30° (ready)
  ```
- **Year cursor:** window `1963–1966`. **RECORD now holds every earned pin** (Birmingham, Kennedy's bill, CRA,
  Bloody Sunday, VRA), so the player can scrub their own restored record to check each link's time order. **This
  is the synthesis: the evidence is what you rebuilt.** The FILE card shows the dates printed in the node texts.
- **Verify:** `SEND THE CAPSULE`. It submits `{ edges }` to `chain.grade`.
- **Success** (2.5 s): a capsule shoots through the tubes in causal order (whoosh; each canister lamp lights as the
  capsule passes). The RECORD strip draws its causal arrows. **The Record Engine's rings turn** (visible through
  the arches), and the vault's first bolt slides (a heavy clunk from below). Badge: **CIRCUIT CLOSED**. Ida says
  X10. Payoff: the vault lift lowers (vertical down).
- **Failure:**
  - decoy: the capsule pops out of that canister's lid ("belongs to an earlier chain");
  - wrong link: the capsule **jams** at the focus canister (a puff of air, the glass fogs).

  The margin note shows the grade feedback.
- **Visible misconception** ("history is a list of unrelated events"): before any tubes are drawn, the canisters
  hang as isolated pins on a wall. The payoff is literally connection.
- **Hints (world):**
  - H1: Wick circles the Birmingham canister, then the VRA canister.
  - H2: the RECORD strip flashes its two "televised crisis" pins.
  - H3: the year labels 1963/1964/1965 glow on the ruler.
- **Insight:** e11.S.
- **Extended view/input:** as in §5.5.

### 5.12 e12_boss · **Tumbler Vault** (investigator.elimination) · S8 · **Vault mode**
- **In-world object:** the **Editor's Vault**:
  - a round door (1000 px) in a cream socket with radiating navy grooves and a gold ring;
  - **4 tumbler wheels** (180 px) at 12, 3, 6 and 9 o'clock, each engraved with one hypothesis (`view.hypotheses`
    order) on its band;
  - 4 bolts; a central spoked handwheel; the brass **voice grille**.
- **Panel (Vault modal, bible §3.1):**
  - The **left brief column (30 %)**: the Editor's emblem; `view.question` ("Why did Congress pass the Voting
    Rights Act in August 1965?"); the info button (salmon ring, as in 8.png).
  - The **right 70 %**: the **Evidence Matrix**.
    - 4 **clue cards** (`view.clues`, in order; each a dated document on paper texture) as columns.
    - 4 **hypothesis rows** (the tumblers' texts).
    - Each cell is a **strike toggle** (the player's own notation).
    - A mini Record Strip across the top (window `1954–1966`, all pins earned).
    - An **ACCUSE** socket on each row (orange ring when chosen).
- **Draft:** `{ marks: { clueIndex, hypothesisId }[]; accused: string | null }`. **`marks` is panel-only
  notation. It is never sent to `grade()`** and never checked against `clue.eliminates`, because that matrix is
  deliberately absent from the view.
- **Live binding (world, visible through the dimmed room around the modal):**
  ```
  struck(h) = any mark with hypothesisId == h
  tumbler[h].rotation_target = struck(h) ? 90° : 0°            (eased; heavy: spring k=6, damping 0.9)
  tumbler[h].lamp = struck(h) ? dim salmon (#C4643C @ 60 %) : white
  if exactly one hypothesis is unstruck: that tumbler's groove glows cyan and slides 8 px toward the bolt channel
  accused tumbler: orange ring (input-bound)
  ```
- **Verify:** `OPEN THE VAULT`, enabled when `accused != null`. It submits `{ hypothesisId: accused }` to
  `elimination.grade`.
- **Success** (the finale; needs the new `finale` phase, D2):
  - the accused tumbler aligns and locks (clunk);
  - **the 4 bolts retract in sequence** (180 ms each);
  - the door's rings counter-rotate 1.5 turns;
  - the handwheel spins, and the door swings open (1.2 s);
  - the modal slides away; the badge **STORY PRINTED** flashes over the press-organ inside;
  - the press rolls. Then e12.S1, e12.S2, and the §4.3 outro.
- **Failure** (`focus = [id, clue:i]`): the accused tumbler **grinds** (a 4° judder, 3×); **clue card i lifts out of
  the matrix and slides beside that row** with a brass pointer; its cell lights. The Editor says e12.F. The margin
  note shows the grade feedback, which quotes the clue. The accusation clears; the player's marks stay.
- **Visible misconception** ("history is a list of unrelated events"): every hypothesis that treats 1965 as
  unconnected ("inevitable after Brown", "the court ordered it", "1964 already fixed voting") is struck by a
  **dated** clue, and the RECORD strip above shows the Selma → VRA arrow (earned in e11) sitting over the surviving
  row.
- **Hints (world):**
  - H1: the clue cards' dates glow.
  - H2: Wick circles the clue with the 2 % figure.
  - H3: the matrix shades every row's struck-cell count.
- **Insight:** e12.S2.
- **Extended view/input:** the draft includes `marks` (UI-only). No change to `Input` or the view.

### 5.13 Contraption summary

| Enc | Mode | Contraption | Layout | Draft → live world | Verify label | Badge | Payoff (traversal) |
|---|---|---|---|---|---|---|---|
| e1 | mimic | Witness Projector | Scrub | aim → lamp angle, beam, panel brightness | RETRACT SLIDE | SLIDE RETRACTED | climb the courthouse steps |
| e2 | linear | Walking Road | Board | slots → slabs rise from the water | LIGHT THE ROUTE | ROUTE RESTORED | walk across the flood |
| e3 | predict_reveal | Wire Ticker + Selector | Scrub | option → knob angle, tape text, wire hum | SEND TO THE WIRE | WIRE CONFIRMED | through the school doors |
| e4 | mimic | Witness Projector (menu board) | Scrub | aim → pendant swing | RETRACT SLIDE | SLIDE RETRACTED | through the swing door |
| e5 | chain | Relay Line | Board | edges → catenary wires, lamps, charge gauge | CLOSE THE CIRCUIT | CIRCUIT CLOSED | gate lifts to the platform |
| e6 | chain | Broadcast Relay | Board | edges → vertical wires, dishes turn | CLOSE THE CIRCUIT | CIRCUIT CLOSED | mast lift up to the rooftops |
| e7 | pairs | Program Switchboard | Board | links → verlet cords, jack lamps, program lines | CONNECT THE PROGRAM | PROGRAM CONNECTED | climb the memorial steps |
| e8 | bins | Filing Cabinets | Board | assignments → slip flights, meters, FILE pins | SEAL THE CABINETS | FILES SEALED | stairwell behind the cabinets |
| e9 | linear | Timeline Bridge | Board | slots → deck sections + date chips; cursor → bay lamps | LOCK THE SPAN | SPAN LOCKED | cross the bridge (walk) |
| e10 | bins | Provenance Drawers | Board | assignments → doc flights, date stamps, meters | SEAL THE STACKS | FILES SEALED | aisle + ladder up |
| e11 | chain | Big Board | Board | edges → growing tubes, lids | SEND THE CAPSULE | CIRCUIT CLOSED | vault lift down |
| e12 | elimination | Tumbler Vault | Vault | marks → tumbler rotation; accused → ring | OPEN THE VAULT | STORY PRINTED | the vault opens; finale |

---

## 6 · Side content and purpose systems

### 6.1 Objective HUD
- **Objective ring** (top-left, 55 px, double ring, white @ 60 %): **12 segments** in 4 arcs matching the acts
  (3/3/3/3), separated by small gaps. Each solved encounter fills its segment clockwise (400 ms), and the matching
  Engine lens pip lights inside the ring.
- **Objective line** under the ring (16 px caps, `ui.text` @ 80 %): **`RECORD RESTORED 4/12`**, and under it the
  scene's sub-objective, e.g. `Main Street · 1 of 2 projections`.
- **Lost negatives** counter (only after the first is found): a small indigo film-strip glyph with `2/5`.

### 6.2 Map: "The Record Line" (M key; also the back arrow's secondary action in Explore)
- A full-screen overlay styled as a **mid-century streetcar line map**: cream paper, navy line, round station
  markers. There is one station per scene (S1–S8) in order, with city names and years printed beside them.
- Restored stations are filled cyan and show their restored projection count. The current station pulses.
  Stations not yet reached are hollow.
- Lost-negative locations appear as hollow indigo dots once their scene is restored (a nudge, not a spoiler).
- Clicking a restored station shows its headline cards (the `debriefLine`s of that scene's encounters).
  **Fast travel is off** in v1: the map is for orientation and review.

### 6.3 Lore collectibles: **Lost Negatives** (5), which teach in context
Each is a glowing indigo film-negative strip (bob ±4 px, `wisp.indigo` ADD halo). Each is reachable **only through
geometry that a solved contraption built**, so it can never leak an answer. Picking one up plays N09 (first time),
and adds a **plate** to the **Clipping Case** (the journal, J key).

| # | Where (after) | Plate content (all from the fixture's own sourced text) | Provenance stamp (applied after e10) |
|---|---|---|---|
| N1 | courthouse cornice ledge (e1) | "Plessy v. Ferguson (1896) had allowed segregation." + the e1 `sourceRef` quote | SECONDARY (textbook ch. 21, p. 1) |
| N2 | far-corner awning (e2) | the e2 `sourceRef` quote ("The boycott lasted 381 days…") | SECONDARY (textbook, p. 1) |
| N3 | terminal rafters (e5) | the e5 `sourceRef` quote (Anniston) | SECONDARY (textbook, p. 2) |
| N4 | mast top (e6) | the e6 `sourceRef` quote ("The images shocked the nation…") | SECONDARY (textbook, p. 2) |
| N5 | under the Selma abutment (e9) | the e9 `sourceRef` quote (Bloody Sunday, Edmund Pettus Bridge) | SECONDARY (textbook, p. 3) |

**Teaching twist:** after e10, the Clipping Case stamps every plate **SECONDARY**: the quotes come from a textbook
chapter, a later account. The Case shows one line: "Every quote in your satchel is someone's later account. The
primary sources are what they were written from." This applies the e10 rule to the player's own inventory.

### 6.4 The secret: the Editor's Darkroom
- Holding all 5 negatives turns on the **red safelight** over the **DARKROOM** door in S8 (N10). Otis unlocks it
  (N11).
- Inside (a small red-lit interior; the one place `cr.safelight` is used): trays, a drying line, an enlarger.
  "Developing" is a short non-graded interaction: drag each negative into the tray and watch it bloom into a
  plate.
- The plates are the five scene photographs as **respectful documentary compositions**: empty courthouse steps,
  an empty bus stop, the terminal's departures board, the church's rose window, the Selma bridge at night. None of
  them show people or violence.
- **Reward:** the Editor's bonus outro line O08; a **"Contact Sheet"** page in the Clipping Case (the 12
  `debriefLine`s, laid out as a contact sheet); and a bonus debrief line in `/debrief` (via the overlay's
  `bonusDebrief`).

### 6.5 The wall of front pages (ambient progress)
In S1/S8 the wall holds 12 frames. Each starts as a greyed page whose headline is the encounter's
**misconception** (for example "SCHOOLS DESEGREGATE AT ONCE", marked with a small "UNVERIFIED" slug so it never
reads as history). After a solve, Hattie's press reprints it with the encounter's `debriefLine` as the true
headline. Walking past the wall is a review of everything restored.

---

## 7 · Art asset list

- **Paths:** `public/assets/expedition/archive-city/<group>/<name>.svg|png`, loaded by
  `loadBiomeManifest(scene, "archive-city")` (asset doc §3(d)). The manifest key is the asset id.
- **Sizes:** in design px at 1920 × 1080. SVGs are rasterized with `load.svg(key, path, { width, height })` at
  DPR ≥ 2 for props (width × 2).
- **Style for every SVG:**
  - flat fills plus at most 2 linear/radial gradients per part;
  - lit face on the left, shade on the right (upper-left key light);
  - no strokes darker than `cr.ink #2B3A44`;
  - text converted to paths (asset doc: no CSS/fonts in SVG);
  - rotating or sliding parts are separate files with a pivot recorded in the manifest (`pivot: [x, y]`).
- **Characters:** Kenney `toon-characters` PNGs (CC0), tinted per §3.

### 7.1 L0 Sky (7)
| id | size | description |
|---|---|---|
| `cr.sky.z1_afternoon` | 1920×1080 | 4-stop vertical gradient `#B9A3D6` → `#D9AFCF` (35 %) → `#E9B8C4` (65 %) → `#F6D9BE`. Two soft cloud bands of stacked white ellipses at 8–15 % alpha at y 18 % and 30 %. |
| `cr.sky.z2_dusk_rain` | 1920×1080 | gradient `#7F6BB8` → `#9E86D8` → `#B58FCB` → `#E8A9C3`; the top 25 % overlaid with a darker `#5E4F8E` @ 50 % band with a soft lower edge (rain clouds). |
| `cr.sky.z3_bluehour` | 1920×1080 | gradient `#3E3F74` → `#55508A` → `#6A5A9A` → `#C58BB0`; 40 tiny star dots (`#FBF1DE` @ 30–60 %) in the top third only. |
| `cr.sky.z4_interior` | 1920×1080 | warm vault gradient `#3B2F3E` → `#4E3C44` → `#5E4A4A`, behind interior back walls (seen through high windows and arches). |
| `cr.sky.z5_dawn` | 1920×1080 | gradient `#8FA8D8` → `#C7B7D8` → `#F2C6B8` → `#FBE7C8`, with a pale sun disc `#FFF4DC` (r 60) at 75 % x / 82 % y under a radial glow. |
| `cr.sky.clouds_rain` | 2400×400 | horizontally tileable rain-cloud band: 5 overlapping rounded masses in `#6B5C99` / `#7F6BB8`, soft bottom edge with a gradient to 0 alpha. |
| `cr.sky.clouds_soft` | 2400×300 | tileable fair-weather cloud streaks in white @ 12 %; long thin ellipses. |

### 7.2 L1 Far (5)
| id | size | description |
|---|---|---|
| `cr.far.city_south` | 2400×560 | Tileable low-rise Southern skyline silhouette in a single fill `#6E5E93`: a water tower on 4 stilts (x 10 %), two church steeples (x 25 %, 48 %), a courthouse dome with cupola (x 38 %), flat-roofed commercial blocks, and the **Courier-Ledger tower** (x 70 %: 8 stories, 3 art-deco setbacks, 140 px wide). About 60 sparse window dots `#F6D27A` @ 60 %. A 40 % haze gradient toward the sky at the bottom. |
| `cr.far.city_industrial` | 2400×560 | The Birmingham variant: the same kit plus 3 blast-furnace stacks and a long mill shed (no smoke) at x 55–80 %; the Courier-Ledger tower at x 20 % (the hub is always visible). |
| `cr.far.capital` | 2400×560 | Washington variant in `#3F3A6A`: a tall obelisk at x 35 % (thin tapering shaft, pyramidion), a domed capitol at x 78 % (drum, colonnade band, dome, lantern), tree masses, and the Courier-Ledger tower small at x 95 %. |
| `cr.far.river_bluffs` | 2400×480 | Selma variant: low river bluffs `#3F3A6A`, a pine-tree line of triangular tops, distant town rooftops and one steeple, and a tiny Courier-Ledger tower at x 90 %. |
| `cr.far.antenna_ring` | 160×160 | Separate sprite for the Engine's antenna ring atop the tower: three concentric rings (outer 2 px gap-notched) in `cr.brass.base`, placed on the tower top; tinted grey when dormant and cyan when restored, plus a glow sprite. |

### 7.3 L2 Mid-far (6)
| id | size | description |
|---|---|---|
| `cr.midfar.rowhouses` | 2400×720 | Tileable two-story brick rowhouses with front porches (thin posts, shed roofs) and gable roofs; two-tone brick `#8E5A6A` / lit `#B07A86`; windows as dark `#4E3C5C` rectangles (light comes from a separate sprite). |
| `cr.midfar.commercial` | 2400×720 | Taller 3–4-story commercial blocks with rooftop water tanks, zig-zag fire escapes, and 3 painted wall signs as ghost-lettering shapes (neutral words: HARDWARE, FEED & SEED, RADIO), brick two-tone. |
| `cr.midfar.window_cluster` | 120×80 | A lit window group (2 × 2 panes, `#F6D27A` → `#E9B864`, soft outer glow). Reused ~40× over L2, with per-instance alpha for the S5 "nation watching" wave. |
| `cr.midfar.oaks` | 1200×600 | A mass of live oaks: lumpy canopy of 9–12 overlapping blobs, two-tone `cr.oak.leaf` / hi, darker trunks `#4E3C44`. |
| `cr.midfar.autumn_trees` | 1200×600 | The same shapes tinted `cr.autumn` / hi for Z1 scenes. |
| `cr.midfar.utility_poles` | 2400×300 | Tileable wooden poles every 600 px with crossarms and glass insulators, plus 3 catenary wires (`#3E3550`, 1.5 px). |

### 7.4 L3 Mid backdrops (6)
| id | size | description |
|---|---|---|
| `cr.mid.storefronts_a` | 1920×820 | A row of 5 1950s storefronts: striped awnings (navy/cream, salmon/cream), transom windows, recessed doors, display windows with shelf shapes, neutral sign boards (BAKERY, SHOES, RADIO REPAIR); brick upper floors with sash windows. |
| `cr.mid.storefronts_b` | 1920×820 | Variant row: a diner with a curved corner, a pharmacy (DRUGS), a barber shop without a pole, a hotel entrance canopy. |
| `cr.mid.firescape_wall` | 1200×900 | Brick wall with a two-level iron fire escape (navy-black `#2B3A44` lattice), drainpipe, and a lit upper window. |
| `cr.mid.marble_backwall` | 1920×1000 | Filing Hall interior back wall: cream marble panels, fluted pilasters with navy capital bands, 3 tall arched windows showing `cr.sky.z3_bluehour`, brass picture rail. |
| `cr.mid.morgue_backwall` | 1920×1000 | Morgue interior: a brick barrel-vaulted basement wall, overhead pipes, silhouettes of shelving units, and high narrow windows at the top edge with rain streaks and passing car-light sweeps (animated separately). |
| `cr.mid.river` | 2400×300 | Tileable river band: gradient `#3E4A78` → `#5E6FA0`, sine highlight strokes `#9FB3E0` @ 40 %, and lamp reflections as vertical streak ovals. |

### 7.5 L4 Ground strips (7)
| id | size | description |
|---|---|---|
| `cr.ground.sidewalk` | 512×200 | Tileable concrete slabs `#B9AFC6` with expansion joints every 128 px, a curb face `#8C829E`, and a wet sheen strip `#D2CBE0` @ 40 % near the curb. |
| `cr.ground.street_wet` | 512×160 | Asphalt `#4A4F66` with 2 puddle ovals `#6D6F8C` (reflection masks) and a faded lane dash. |
| `cr.ground.brick_plaza` | 512×200 | Herringbone brick `#B5654F` / `#D08A6E` with a cream stone border course. |
| `cr.ground.marble_floor` | 512×200 | Cream marble tiles with grey veining and a navy inlay border line. |
| `cr.ground.morgue_floor` | 512×200 | Worn wood planks `#7A5A48` / `#96715A` with 2 water puddles (reflection masks). |
| `cr.ground.bridge_deck` | 512×160 | Concrete deck with steel edge girder, rivets, and a low railing base. |
| `cr.ground.grass_verge` | 512×120 | Teal grass strip (`grass.base` / `grass.light` blade tufts) for the park and hill. |

### 7.6 L5 Foreground (8)
| id | size | description |
|---|---|---|
| `cr.fg.railing` | 960×260 | Wet wrought-iron railing: square balusters, navy-black cap rail, glints `#9FB3E0` on the tops. |
| `cr.fg.parking_meter` | 90×260 | 1950s single parking meter: dome head, glass window, post. |
| `cr.fg.hydrant` | 110×150 | Fire hydrant in faded cream-teal with a wet highlight. |
| `cr.fg.newspaper_bundle` | 180×110 | Twine-tied stack of newspapers; the top sheet shows unreadable headline bars. |
| `cr.fg.bench` | 420×180 | Park bench: slatted wood with cast-iron ends. |
| `cr.fg.lamppost_base` | 140×420 | Fluted cast-iron lamppost base and lower shaft (the lamp head is L4). |
| `cr.fg.magnolia` | 600×320 | A cluster of glossy magnolia leaves `cr.magnolia` with lighter midribs; one closed cream bud. |
| `cr.fg.stanchions` | 480×200 | Interior brass stanchions with a velvet rope (navy), for the Morgue and Filing Hall. |

### 7.7 L6 Light and overlays (8)
| id | size | description |
|---|---|---|
| `cr.light.rain_streak` | 8×64 | Particle: a thin white line with a gradient tail, 35 % alpha. |
| `cr.light.splash_ring` | 48×16 | Particle: a flattened ellipse ring. |
| `cr.light.lamp_glow` | 256×256 | Radial `#F6D27A` (70 %) → 0, for ADD blending. |
| `cr.light.projector_cone` | 512×256 | Trapezoid, narrow end left, `cr.recordlight` 35 % → 0 along its length, soft edges. |
| `cr.light.beam_glow` | 64×64 | Radial `#C9F3FF` core → `#6ED2F2` → 0 (beam endcaps, lens glints). |
| `cr.light.blinds_shadow` | 1920×1080 | Venetian-blind shadow stripes (12 diagonal bands), used at 20 % multiply in interiors. |
| `cr.light.film_grain` | 512×512 | Tileable monochrome noise, used at 6 % overlay. |
| `cr.light.scanlines` | 4×8 | 2 px on / 2 px off tile for dormant projections. |

### 7.8 Landmarks and set pieces (97)
| id | size | description |
|---|---|---|
| `cr.set.engine_plinth` | 1000×240 | Record Engine base: 3 stepped cream-stone tiers (`stone.lit` faces, `stone.shade` risers), a navy inlay band along the top tier, gold trim lines, 3 round brass access hatches. |
| `cr.set.engine_ring_outer` | 860×860 | Outer brass ring 60 px thick: gold rim highlight inside and out, 24 rivets, a notch at 12 o'clock. Pivot at the centre. |
| `cr.set.engine_ring_mid` | 660×660 | Middle ring in cream stone with a navy groove line; tick marks every 15°. Pivot at the centre. |
| `cr.set.engine_ring_inner` | 480×480 | Inner brass ring with **12 lens sockets** at 30° steps (dark recesses, r 32); acts marked by 4 small gold chevrons. Pivot at the centre. |
| `cr.set.engine_lens` | 80×80 | Lens: brass bezel with 6 screws and a glass disc (a radial gradient); tinted dormant grey `#8E8AA0` or lit `cr.recordlight`. |
| `cr.set.engine_drum` | 300×300 | Central projector drum: a brass cylinder face with an **iris aperture** of 8 overlapping blades (the blades are a separate asset). |
| `cr.set.engine_iris_blade` | 120×60 | One iris blade (brass, curved); 8 instances rotate to open or close. |
| `cr.set.engine_crown_l` | 210×260 | Left half of the split gold crown fin (bible gate fin): tall and tapered, gold with a navy centre line. |
| `cr.set.engine_crown_r` | 210×260 | Mirror of the left half. |
| `cr.set.main_breaker` | 120×220 | Wall breaker box: grey-green steel, stencilled "MAIN", with a lever slot. |
| `cr.set.breaker_lever` | 40×90 | Breaker lever with a red-brown handle (pivot at the bottom). |
| `cr.set.basement_stair` | 700×600 | Curving iron stair down from a street door, with a handrail and rainwater sheen. |
| `cr.set.reading_desk` | 480×260 | Ida's oak desk: green banker's lamp, card catalog drawers, a stack of reels, a magnifier. |
| `cr.set.proof_press` | 520×420 | Flatbed proof press: iron frame, big roller with a crank wheel, ink disc, type bed with galley. |
| `cr.set.front_pages_wall` | 1400×700 | Corkboard wall with 12 frame slots (4 × 3) and brass picture lights above each column. |
| `cr.set.front_page` | 200×260 | Newspaper front page template: masthead "THE COURIER-LEDGER" as path text (fictional paper), 5 column bars, a photo box; the headline is added by code. Grey variant via tint. |
| `cr.set.darkroom_door` | 320×620 | Wooden door with a "DARKROOM" stencil and a red safelight box above (a separate glow sprite); latch. |
| `cr.set.stack_unit` | 420×900 | Compact shelving unit: steel end panel (cream enamel) with a 3-spoke crank wheel (separate asset); shelves of archive boxes and film cans. |
| `cr.set.stack_crank` | 90×90 | 3-spoke crank wheel with a handle (pivot at the centre). |
| `cr.set.rolling_ladder` | 180×800 | Library rolling ladder: oak rails, rungs, brass top hook and wheels. |
| `cr.set.big_board` | 1920×900 | Big Board wall: brass panel field with 7 round canister mounts in a loose ring, engraved tube channels between them, rivets, and a capsule launcher at the lower left. |
| `cr.set.canister` | 110×170 | Pneumatic canister: brass bands, glass body showing a card window, domed lid (lid separate), top lamp. |
| `cr.set.canister_lid` | 110×40 | Domed brass lid (pivot at the left hinge). |
| `cr.set.tube_segment` | 64×24 | Tileable brass tube with a glass window strip. |
| `cr.set.vault_socket` | 1300×1300 | Round cream-stone recess with 24 radiating navy grooves and a gold ring lip; the dark interior shows around the door's edge. |
| `cr.set.vault_door` | 1000×1000 | Door leaf: 3 concentric bands (brass / cream / brass), 4 tumbler windows at 12, 3, 6 and 9, rivet rings, and a central hub boss. Pivot at the hinge side for the swing. |
| `cr.set.vault_tumbler` | 180×180 | Tumbler wheel: knurled brass rim, cream engraved band (text by code), groove notch, lamp bead. Pivot at the centre. |
| `cr.set.vault_bolt` | 220×60 | Polished steel bolt with a brass collar (slides on x). |
| `cr.set.vault_handwheel` | 300×300 | 6-spoke brass handwheel with a navy hub. Pivot at the centre. |
| `cr.set.voice_grille` | 200×200 | Circular brass grille: concentric slots, a small type-slug "E" emblem at the centre; the glow is a separate sprite. |
| `cr.set.press_organ` | 1400×1000 | The Editor's press-organ: brass organ-pipe ranks rising behind a large printing press (type cases as wooden grids, a giant roller, paper outfeed); cream and navy detailing. |
| `cr.set.courthouse` | 1500×1000 | Greek-revival courthouse: 6 fluted columns (`stone.lit` with a shade strip on the right), entablature with a navy inlay band, pediment with a round clock recess, 3 pale projection panels (220×300) between the centre columns, doors. **Without steps.** |
| `cr.set.courthouse_clock` | 180×180 | Clock face: cream enamel, brass bezel, Roman numerals as paths. |
| `cr.set.clock_hand_hour` | 20×70 | Hour hand in navy (pivot at the base). |
| `cr.set.clock_hand_min` | 14×90 | Minute hand in navy (pivot at the base). |
| `cr.set.courthouse_steps` | 1100×260 | 7 wide steps in cream stone with gold nosing lines, cheek walls either side. |
| `cr.set.courthouse_plaque` | 160×110 | Bronze plaque with a raised border (the text is added by code). |
| `cr.set.bus_shelter` | 520×420 | 1950s bus stop: cream curved canopy on navy posts, bench, route sign blade. |
| `cr.set.day_counter` | 180×240 | Flip-number board on a post: "DAY" header, 3 flap windows (digits by code). |
| `cr.set.city_bus` | 980×400 | 1950s transit bus: rounded nose, cream-over-teal two-tone, chrome bumper, 7 side windows (dark, **empty**), blank destination blind. |
| `cr.set.bus_lights` | 980×400 | Overlay: warm window glows plus headlight cones (ADD). |
| `cr.set.flood_band` | 1200×160 | Floodwater strip: murky violet gradient, floating paper scraps, ripples; tileable. |
| `cr.set.walk_slab` | 260×60 | Concrete slab with an engraved border (text by code); wireframe and solid states via tint + scanline mask. |
| `cr.set.schoolhouse` | 1700×1050 | Collegiate-gothic high school: tan brick `#C49A7A`, cream stone trim, a central tower with 4 tall arched windows and crenellation, symmetric wings, a wide stair base. Doors are a separate asset. |
| `cr.set.school_doors` | 260×340 | Tall double doors under a stone arch; open state via 2 leaves (the right leaf is a separate asset). |
| `cr.set.school_door_leaf` | 130×340 | One door leaf (pivot at the hinge). |
| `cr.set.barrier_projection` | 420×300 | Abstract barrier: 7 vertical translucent grey-lavender bars (`cr.dormant`) with scanlines. **No figures.** |
| `cr.set.walk_lamp` | 60×220 | Short cast-iron walk lamp with a globe (the glow is separate). |
| `cr.set.newsstand` | 560×460 | Kiosk: navy wood, striped awning, magazine racks with abstract cover shapes, a counter opening. |
| `cr.set.teletype` | 260×300 | Teletype machine: cream-green enamel body, keyboard, paper platen. |
| `cr.set.teletype_paper` | 120×400 | Paper roll and tape feeding up (the printed text is added by code). |
| `cr.set.selector_plate` | 180×200 | Brass rotary dial plate on a small lectern: engraved A/B/C at −40°/0°/+40°. |
| `cr.set.selector_knob` | 70×70 | Pointer knob with a navy grip and a brass pointer (pivot at the centre). |
| `cr.set.telegraph_pole` | 120×900 | Wooden pole with 2 crossarms and glass insulators. |
| `cr.set.dimestore` | 1400×950 | Five-and-dime exterior: big "5-10-25¢" sign board (cream on salmon), display windows, recessed double door, brick upper floor. |
| `cr.set.lunch_counter` | 1500×320 | Counter: cream laminate top, chrome edge, navy front panel with a chrome kick strip. |
| `cr.set.counter_stool` | 90×170 | Chrome pedestal stool with a teal vinyl seat. Reused ×12; the underglow is `cr.light.lamp_glow` tinted. |
| `cr.set.menu_board` | 900×360 | Three-panel menu board: navy frame, brass corners; panels as pale projection surfaces. |
| `cr.set.pendant_lamp` | 160×300 | Swivel pendant: ceiling rose, cord, green enamel shade (the head is separate). |
| `cr.set.pendant_head` | 140×110 | Enamel shade with a bulb (pivot at the cord top). |
| `cr.set.pie_case` | 260×220 | Domed glass pie case on a stand with 2 pie shapes. |
| `cr.set.swing_door` | 200×320 | Kitchen swing door with a round porthole window (pivot at the hinge). |
| `cr.set.terminal` | 1900×950 | Streamline-moderne coach terminal: curved corner, 3 horizontal chrome speed bands, a vertical fin sign "TERMINAL", glass-block windows, cream stucco with navy trim. |
| `cr.set.departure_board` | 720×300 | Split-flap departures board: black-navy housing, 6 rows × 20 flap cells, header "DEPARTURES". |
| `cr.set.split_flap` | 36×52 | One flap cell (the character is added by code). |
| `cr.set.junction_box` | 150×190 | Brass relay junction box: a glass card window, top lamp, input terminal (top) and output terminal (bottom), fuse holder. |
| `cr.set.canopy_rail` | 1920×80 | Platform canopy edge: steel with insulator mounts every 200 px; tileable. |
| `cr.set.divider_rail` | 700×120 | Brass waiting-room divider rail on posts (it lifts away on the e5 success). |
| `cr.set.rolling_gate` | 620×420 | Corrugated steel rolling gate (tileable slats) with a roll housing on top. |
| `cr.set.photo_withheld` | 260×200 | Framed photo plate: sepia soft blur (no forms), a small camera glyph, a caption strip (text by code). |
| `cr.set.church` | 1300×1400 | Brick church: twin square towers with pyramidal caps, a central **rose window** (tracery of 12 petals around a circle), 3 arched doors, wide steps. |
| `cr.set.rose_window_glow` | 300×300 | Lit rose window overlay (warm amber and teal glass). |
| `cr.set.bandstand` | 720×520 | Octagonal bandstand: cream posts, navy roof with a finial, a railing. |
| `cr.set.broadcast_mast` | 460×1700 | Lattice steel mast (`cr.steel`) with 5 relay platforms, salmon aviation beacons, a service ladder, a lift rail. |
| `cr.set.relay_station` | 170×150 | Relay station: a small dish (pivot at the centre, separate asset), an insulator bank, a card window, a lamp. |
| `cr.set.relay_dish` | 90×90 | Parabolic dish with a feed horn (pivot at the centre). |
| `cr.set.lift_cage` | 180×240 | Service lift cage: steel lattice, a floor plate, a lamp. |
| `cr.set.memorial` | 1900×900 | Neoclassical memorial: 12 columns, an attic band with a navy inlay line, a warm interior glow and **no statue**; cream stone. |
| `cr.set.memorial_steps` | 1300×300 | Broad memorial steps in cream stone with landings (4 step-lamp mounts). |
| `cr.set.reflecting_pool` | 1900×140 | Long pool: a stone lip plus a water surface (the reflection is done by code). |
| `cr.set.switchboard` | 520×420 | Cord switchboard: wooden cabinet, a brass jack field (4 left + 5 right jacks with card holders), a lamp row above, a keyshelf. |
| `cr.set.jack_lamp` | 24×24 | Jack lamp bead (tinted white / cyan / amber). |
| `cr.set.patch_plug` | 26×60 | Brass patch plug with a cream sleeve (cord segments are drawn by code). |
| `cr.set.program_sheet` | 300×420 | Printed program document: title band, 5 rule lines, a margin (text by code). |
| `cr.set.filing_cabinet` | 440×920 | Tall oak filing cabinet with brass trim, a label plate slot, a **feature plate** under the label, 4 drawers (the top drawer is a separate asset), floor-rail wheels. |
| `cr.set.filing_drawer` | 380×160 | Drawer front with a brass pull and a card slot (slides on x/y). |
| `cr.set.feature_shutter` | 300×60 | Brass shutter strip (it slides up to reveal the feature plate). |
| `cr.set.signal_meter` | 220×160 | VU-meter face: cream dial, black-navy scale arc, "SIGNAL" legend. |
| `cr.set.meter_needle` | 8×90 | Needle (pivot at the base). |
| `cr.set.pneumatic_drop` | 260×520 | Brass delivery tube descending from the ceiling to a wire basket tray. |
| `cr.set.provision_slip` | 180×110 | Paper slip with a typed-line texture (text by code). |
| `cr.set.floor_rail` | 900×40 | Recessed steel floor rail. |
| `cr.set.bridge` | 2400×900 | Steel through-arch bridge: the arch truss lattice in `cr.steel`, 2 piers, lamp standards, a deck **with 4 empty bays at the crown**, and a railing. |
| `cr.set.bridge_plank` | 300×70 | Deck section: concrete top, steel edge girder, rivets (the date chip is added by code). A short variant is used for the decoy (`scaleX 0.8`). |
| `cr.set.bay_lamp` | 50×160 | Bridge stanchion lamp (the globe glow is separate). |
| `cr.set.surveyor_console` | 200×240 | Brass lectern shaped like a surveyor's transit: tripod base, a telescope element, a glowing slate. |
| `cr.set.streetcar` | 900×380 | 1950s streetcar: cream/teal, a trolley pole, windows (lit, **empty**). |

### 7.9 Shared contraption parts and FX (16)
| id | size | description |
|---|---|---|
| `cr.part.proof_lamp_stand` | 120×260 | Arc lamp stand: brass tripod, a vertical post, a yoke. |
| `cr.part.proof_lamp_head` | 140×110 | Arc lamp head: a barrel housing with a front lens and cooling fins (pivot at 20,55). |
| `cr.part.witness_lens` | 110×200 | Lantern-slide projector on a tripod: a boxy brass body, bellows, a front lens. |
| `cr.part.slide_frame` | 240×320 | Projected slide frame: bevelled cream mat with brass corners (the slug text is added by code). |
| `cr.part.record_rail` | 1920×40 | Tileable riveted brass rail with hanger brackets. |
| `cr.part.lens_carriage` | 160×140 | Record Lens carriage: 4 wheels on top, a brass body, a hanging lens barrel angled down (pivot at the top). |
| `cr.part.console_reader` | 190×210 | History console (0.7 H): a microfilm-reader lectern with a hooded glowing screen showing a tiny timeline graphic, and a brass reel on the side. |
| `cr.part.map_pin` | 90×120 | Teardrop map pin: dark teal fill `#0F2A33`, white 3 px stroke, white chevron below (text by code). |
| `cr.part.interact_glyph` | 64×64 | Diamond with inner lines (bible 4.png), white @ 80 %. |
| `cr.part.capsule` | 60×30 | Pneumatic capsule: brass end caps and a glass body. |
| `cr.part.spark` | 32×32 | Four-point spark star in `#F6D27A`. |
| `cr.part.puff` | 96×64 | Soft grey-lavender puff (dust, fuse, air jam). |
| `cr.part.paper_scrap` | 24×16 | A small torn paper scrap, cyan-tinted for record scraps. |
| `cr.part.steam` | 128×128 | Soft steam blob. |
| `cr.part.moth` | 16×12 | Moth silhouette (2 frames via scaleY flip). |
| `cr.part.lost_negative` | 90×40 | Film negative strip with sprocket holes and 3 amber-inverted frames; indigo halo is `cr.light.beam_glow` tinted `wisp.indigo`. |

### 7.10 Characters (11 entries; 54 frame uses from 46 unique PNGs + 9 SVG overlays/parts)
| id | size | description |
|---|---|---|
| `cr.char.nell_frames` | 96×128 (HD 192×256) | Kenney `toon-characters` **Female adventurer** poses (23 files): `idle, walk0–7, run0–2, jump, fall, climb0–1, interact, show, think, talk, cheer0–1, back`. Tinted mustard/cream at load. |
| `cr.char.nell_satchel` | 60×70 | SVG overlay: a leather satchel `#8A5A3C` with a strap across the torso (follows the torso anchor per frame via a small offset table). |
| `cr.char.nell_scarf` | 70×50 | SVG overlay: a salmon scarf `#E48C5E` with 2 trailing tails (the tail sway is a code tween). |
| `cr.char.ida_frames` | 96×128 | Kenney **Female person** poses (13 files): `idle, talk, think, show, interact, walk0–7`. |
| `cr.char.ida_overlay` | 96×128 | SVG overlay: a silver low bun, cat-eye glasses with a bead chain, a long teal cardigan hem. |
| `cr.char.wick_body` | 44×64 | Brass hurricane lantern: a ring handle, glass chimney, flame core (the glow is separate). |
| `cr.char.wick_wing` | 40×30 | Paper moth-wing fin, cream with faint brown veins (mirrored for the second wing; pivot at the root). |
| `cr.char.otis` | 96×128 | Kenney **Male person** poses (10 files: `idle, talk, walk0–7`) + SVG overlay (watch cap, grey cardigan, flashlight). |
| `cr.char.hattie` | 96×128 | Kenney **Female person** poses (3 files: `idle, talk, interact`, tinted differently from Ida) + SVG overlay (green eyeshade, ink apron, sleeve garters). |
| `cr.char.dolores` | 96×128 | Kenney **Female person** poses (2 files: `idle, talk`) + SVG overlay (headset around the neck, cardigan, pencil in hair). |
| `cr.char.theo` | 96×128 | Kenney **Male person** poses (3 files: `idle, talk, think`) + SVG overlay (school cap, backpack, an aged-textbook prop). |

(The Kenney pose files for the Female and Male person are shared on disk between Ida/Hattie/Dolores and Otis/Theo
and loaded once. The unique downloads are 23 Female adventurer + 13 Female person + 10 Male person = **46 PNGs**.)

### 7.11 UI (instrument panel, dialogue bar, HUD, journal) (22)
| id | size | description |
|---|---|---|
| `cr.ui.hex_tile` | 88×76 | Flat-top hexagon outline tile, 1 px `rgba(120,190,205,0.14)`, seamless (bible §3.2). |
| `cr.ui.emblem_ida` | 128×128 | "The Reel": dark `#0B1F27` disc; a salmon `#E7A08C` outer ring (4 px); two white inner rings broken into labyrinth segments shaped like film-reel spoke cut-outs; a tiny lantern keyhole at the centre. |
| `cr.ui.emblem_editor` | 128×128 | A navy ring `#27466A` with a broken inner white ring and a centre cream type slug stamped "E". |
| `cr.ui.emblem_npc` | 128×128 | Generic staff emblem: a simple double ring with a small archive-box glyph (all minor NPCs). |
| `cr.ui.info_button` | 128×128 | White "i" in a double ring (bible). |
| `cr.ui.info_button_warm` | 128×128 | The same with a salmon outer ring (this game's default). |
| `cr.ui.objective_ring` | 110×110 | 12-segment double ring (4 arcs of 3 with 6° gaps), white @ 60 % (the fill is drawn by code). |
| `cr.ui.back_arrow` | 160×80 | `ui.card.deep` tab with a white left arrow and a 1.5 px border. |
| `cr.ui.year_knob` | 56×64 | Orange teardrop knob `#E2892C`, 2 px `#B8661C` outline, point up. |
| `cr.ui.trace_hollow` | 16×16 | Hollow circle terminal (r 4, 1.5 px `#E8F6F8`). |
| `cr.ui.trace_dot` | 12×12 | Filled dot terminal. |
| `cr.ui.badge_frame` | 360×140 | Light-bordered badge box with bracket connectors above and below ending in dots (text by code). |
| `cr.ui.socket` | 64×64 | Orb-glyph socket, 3 states in one sprite sheet (192×64): hollow / aimed (orange ring) / struck (salmon slash). |
| `cr.ui.plank_token` | 320×64 | Board-mode plank card background: paper texture, torn left edge, brass tack. |
| `cr.ui.doc_icons` | 576×96 | 6 × 96 px icons: photo print, aged textbook, law text (typed with a seal), film case, interview transcript, hardcover biography. |
| `cr.ui.drawer_icon` | 64×64 | A drawer front glyph. |
| `cr.ui.jack_icon` | 40×40 | A jack socket glyph (brass ring). |
| `cr.ui.tumbler_icon` | 64×64 | A tumbler wheel glyph. |
| `cr.ui.paper_texture` | 512×512 | Tileable typewriter-paper texture `cr.paper` with faint fibres (document cards, margin notes). |
| `cr.ui.transit_map` | 1600×900 | "The Record Line" map: cream paper, a navy line with 8 round stations, city/year labels as paths, a compass rose, a legend box. |
| `cr.ui.clipping_case` | 1200×800 | Journal frame: a leather folio with brass corners, 5 negative slots, a plate viewer panel. |
| `cr.ui.negative_slot` | 200×90 | An empty film-strip slot outline with sprocket holes. |

### 7.12 Totals
| Group | Entries |
|---|---|
| 7.1 L0 Sky | 7 |
| 7.2 L1 Far | 5 |
| 7.3 L2 Mid-far | 6 |
| 7.4 L3 Mid backdrops | 6 |
| 7.5 L4 Ground | 7 |
| 7.6 L5 Foreground | 8 |
| 7.7 L6 Light | 8 |
| 7.8 Landmarks and set pieces | 97 |
| 7.9 Parts and FX | 16 |
| 7.10 Characters | 11 |
| 7.11 UI | 22 |
| **Total asset entries** | **193** |

- **Unique files:** 193 entries. The 182 non-character entries are one SVG each. The 11 character entries expand
  to **46 unique Kenney PNGs** and **9 SVG** overlays/parts. So there are **191 agent-authored SVG files + 46 CC0
  PNGs = 237 files**.
- **Budget** (asset doc §3(e)): ~191 SVGs × ~2.5 KB mean ≈ 480 KB, plus ~46 PNGs × ~2 KB ≈ 90 KB, for about
  **0.57 MB total**, inside the < 1 MB per-biome target.

---

## 8 · Fidelity mapping (bible §9 checklist, 36 items; ★ = mandatory)

| # | Item | How *The Archive of Voices* satisfies it |
|---|---|---|
| 1 ★ | Painterly parallax (≥ 5 layers) | L0 sky, L1 skyline, L2 rowhouses/trees/poles, L3 storefronts and landmarks, L4 play, L5 railings/meters/magnolia, and L6 rain/glows (§2.4) in every exterior scene; interiors use back wall → pipes → machinery → play → stanchions. |
| 2 ★ | No 1-bit tiles | All art comes from §7 (agent SVG + Kenney toon PNGs). The Kenney 1-bit tilesheet is not loaded by this host. |
| 3 | Sky gradient ≥ 3 stops | 4-stop gradients per zone (§2.3, §7.1). |
| 4 | Architecture vocabulary | Circles (Engine rings, clock, rose window, bridge arch, jacks, tumblers), brass trim, navy inlay bands, columns (courthouse, memorial): at least 3 in every frame. |
| 5 | Soft lighting | Coloured blurred contact shadows `#6E7F9A` @ 30 %; darkest colour `cr.ink #2B3A44` (≥ `#1E2A33`). |
| 6 | Glow = live | The dormant → live → printing → solid states (§5.0.3). Unsolved landmarks are wireframe and desaturated; solved ones are saturated, with beams. |
| 7 | Foreground framing | L5 railings, meters, hydrants and magnolia cross the bottom edge in every exterior; stanchions do so in interiors; placement rules keep consoles and contraptions clear. |
| 8 | Biome identity | A violet-dusk brick-and-cream city with a brass Engine and cyan beams: distinguishable from the trig terraces and the cell colonnade by palette and silhouettes (steeples, skyline, arch bridge). |
| 9 ★ | Articulated protagonist, 14–18 % height | Nell at 170 px (≈ 16 %) with the Kenney 8-frame walk, idle, climb, interact and celebrate (§3.1). |
| 10 | Scale ladder | The Record Engine is 5.8 H, the vault door 5.9 H, the mast 10 H; consoles are 0.7 H; lamps and lenses 0.9 H. |
| 11 ★ | Guide presence | Ida's Reel emblem in the dialogue bar; **Wick** follows Nell in Explore and pulses when Ida speaks (§3.2). |
| 12 | Purpose on screen | The objective ring with 12 segments plus `RECORD RESTORED n/12` (§6.1). |
| 13 | Story beats in world terms | Every encounter has A/I/S lines naming the object ("Aim the Proof Lamp…", "Lay the planks across the flooded street…") (§4.4). |
| 14 | Sensitivity | No real person as a sprite; violence only as dated text and withheld photo plates; empty buses, stools and parks; memorial beats (§ preamble, §5.3–5.6, §5.9). |
| 15 ★ | World stays visible | Scrub 60/40 and Board 45/55 leave the world undimmed; the Vault modal dims the room but shows it around the modal (bible allows this). |
| 16 | Panel material | The bible's `ui.panel` + blur + `cr.ui.hex_tile`. |
| 17 | Circuit-trace lines | Frame lines with hollow/dot terminals on the Verify row, the badge and the dialogue divider ("• • ◉"). |
| 18 ★ | Graph cards | RECORD and FILE timeline cards: bordered, label tabs top-right, year ticks on x, **unit lanes labelled on y** (ORIGINS / DIRECT ACTION / LEGISLATION), major/minor grid (years/months). |
| 19 | Axis units | Years and months (`MAR 1965`); decades in e10. |
| 20 | Function colours | White = RECORD (restored facts), green = FILE/draft and the first bin, blue = the second bin, used identically on world chips (cabinet chips, date chips). |
| 21 ★ | Orange input scrubber | The **year cursor** in every panel: one orange line through both timeline cards, a teardrop knob on the month/year ruler, a `YEAR` tab and a `MAR 1965` readout; dragging moves the line across both cards at once (§5.0.2). |
| 22 | Value chips on the card edge | RECORD and FILE chips on each card's left edge, overhanging into the world, showing the value at the cursor (`SEP 1957 · LITTLE ROCK`). |
| 23 | Back arrow | Top-left tab; closes the panel without grading (keeps the draft). |
| 24 | Named Verify, flanked by traces, disabled until complete | RETRACT SLIDE, LIGHT THE ROUTE, SEND TO THE WIRE, CLOSE THE CIRCUIT, CONNECT THE PROGRAM, SEAL THE CABINETS, LOCK THE SPAN, SEAL THE STACKS, SEND THE CAPSULE, OPEN THE VAULT; each disabled until the draft is complete. |
| 25 | Success badge | SLIDE RETRACTED, ROUTE RESTORED, WIRE CONFIRMED, CIRCUIT CLOSED, PROGRAM CONNECTED, FILES SEALED, SPAN LOCKED, STORY PRINTED. |
| 26 | Board tokens, snapping, keyboard | Planks, documents, slips and node cards come from palette columns and snap to slots, drawers or jacks; full keyboard maps per §5.x. |
| 27 ★ | Dialogue-bar anatomy | The Reel emblem, the salmon-ring "i" below it, and two-line text (§3.2, §7.11). |
| 28 | Sentence style | Imperative I-lines naming world objects; S-lines are single declarative truths (§4.4). |
| 29 | Legibility | 30–32 px white on `ui.panel`; contrast ≥ 7:1 (inherited from the bible's UI tokens). |
| 30 ★ | Live reaction | Every draft change moves the world: lamp swing, slab rise, knob turn, wire catenary, dish turn, verlet cord, slip flight, meter needle, tube growth, tumbler rotation; the year cursor moves the Record Lens carriage (≥ 3 intermediate poses by easing). |
| 31 | World chips and pins | The carriage's `MAR 1965` chip, cabinet `3 FILED` chips, bridge date chips; map pins over consoles and targets (the bridge bays, the vault bolt channel). |
| 32 | Eased physicality | All bindings use frame-rate-independent easing or springs (≈ 0.2–0.4 s settle); cords and wires use verlet or springs. |
| 33 | Partial feedback | `focus`-driven refusals (slab n tips, the box at focus sparks, a slip bounces with the correct cabinet's shutter opening, a cord unseats); bridge bay lamps light in a jumbled order when misordered; the margin note carries the grade's informative text. |
| 34 ★ | In-world success animation (1.2–2.5 s, sound hook) | Per §5.x: retract stamp + steps printing, slabs lock + DAY counter, ticker + nine lamps, relay current + departures flip + gate, mast climb + skyline wave, program print, cabinets roll, span lock + rain stops, shelving rolls, capsule run + Engine turns, bolts + door swing; `sfx.*` hooks in §5.0.6. |
| 35 ★ | Payoff is traversal | Steps, walking road, doors, swing door, gate, lift, memorial steps, stairwell, bridge, aisle + ladder, vault lift, vault: each next area is physically reachable only through it (§2.6). |
| 36 | Visible misconception | A "Visible misconception" entry per contraption (§5.1–5.12), for example the 1954–55 footprint versus the 1957 pin, the decoy slab with no bay, the aged textbook outside the events band, the jumbled bay lamps. |

**Self-score target: 36/36**, with all 11 ★ items covered by design. The risk items to verify in the Wave-4
screenshot loop:
- #7 (foreground must not cover the S6 switchboard);
- #29 (the typewriter margin-note face at 22 px must still be ≥ 28 px equivalent; use 28 px);
- #15 in Vault mode (the room must stay visible around the modal).

---

## 9 · Generalization notes

### 9.1 Reusable contraption archetypes (code; work for ANY game using the family.mode)
Each archetype has three parts:
- a pure `pose(view, draft, meta, t)` in `.ts`, unit-testable under Vitest in the node environment;
- a `failure(focus)` animation and a `success(solution)` animation;
- **skin slots** filled by the biome kit and the overlay.

None of these reference civil rights.

| Archetype | family.mode | Skin slots (what a biome/overlay supplies) | Generic parts |
|---|---|---|---|
| **Witness Projector** | truth_finder.mimic | aimer (lamp / emitter / pendant), N projection surfaces, slug typeface, retract stamp word, optional claim footprints | aim easing, beam raycast, surface brightness, retract/eject, honest-hold |
| **Wire Ticker + Selector** | truth_finder.predict_reveal | printer device, selector with N positions, the connecting conduit, the payoff object | knob angle, tape typing, conduit hum, reveal print, "not what happened" stamp |
| **Walking Road / Timeline Bridge** (one archetype, two skins) | sequencer.linear | bay geometry (flat road vs arch), slab/plank art, optional `printedDate` per item | slot materialize, lock-until-n, tip-out, decoy dissolve, optional cursor-driven bay lamps |
| **Relay Line / Broadcast Relay / Big Board** (one archetype, three skins) | linker.chain | node housing (box / dish / canister), connector style (catenary wire / vertical wire / tube), carrier (current / capsule), payoff gate | edge drawing, catenary/tube routing, charge gauge, focus spark, success traversal pulse |
| **Program Switchboard** | linker.pairs | jack field layout, cord style, the document that fills | verlet cord, jack lamps, unseat-on-focus, clue margin note |
| **Filing Cabinets / Provenance Drawers** | sorter.bins | container art (cabinet / drawer / lane), meter style, feature-plate shutter, optional `madeYear`/value stamps | Bézier flight, completion meters, bounce + shutter-open on focus, roll-apart payoff |
| **Tumbler Vault** | investigator.elimination | door art, tumbler engraving, clue document style | player-marks matrix, tumbler rotation, last-standing alignment, bolt sequence, grind + clue slide on focus |
| **Record Strip** (system, not a contraption) | any mode whose items carry dates; every history/humanities game | lanes (units), pins (earned facts), window per encounter, the carriage and rail art | two timeline cards, orange year cursor, chips, carriage easing, earned-pin accumulation, hint-pins |

This extends the bible's §8 mode → archetype table: `truth_finder.mimic` gains Witness Projector,
`predict_reveal` gains Wire Ticker, `sequencer.linear` gains Walking Road, `linker.chain` gains Relay Line and Big
Board, `linker.pairs` gains Program Switchboard, `sorter.bins` gains Filing Cabinets, and
`investigator.elimination` gains Tumbler Vault.

### 9.2 What is subject-specific (hand-made now; the future "World Writer" writes it)
- **Biome kit (art):** "archive-city" = §7 minus the reusable UI. It is reusable for any 20th-century
  US-history/civics upload (it becomes a kit in the library, not per-game art).
- **Per-game overlay (text and metadata, LLM-writable):**
  - the story frame (premise, stakes, what gets restored);
  - scene list and landmark choice;
  - every dialogue line in §4.4;
  - claim footprints;
  - `printedDate`/`madeYear` per item;
  - Record Strip pins, lanes and windows;
  - NPC roster and micro-quests;
  - lore plates;
  - the wall-of-front-pages misconception headlines.

### 9.3 World Writer schema (proposed; architect-owned `src/contracts/world.ts`)
LLM-facing, so it follows `instructions.md` §4 strict-mode rules:
- root object;
- every field required, `.nullable()` never `.optional()`;
- no `z.record` (maps become arrays with key fields);
- dynamic enums for `encounterId`, `speakerId`, `contraptionId` (the archetypes that support that encounter's
  mode), `biomeKitId`, `landmarkId` (from the kit).

```ts
WorldSlice = {
  biomeKitId: enum<BiomeKit>,                 // "archive-city"
  frame: { premiseLine: string, stakes: string, restoredThing: string, objectiveLabel: string },  // "RECORD RESTORED"
  guide: { characterId: enum<CharacterId>, companionKind: enum<"lantern"|"owl"|"drone"|...>, emblemColor: enum<Token> },
  npcs: [{ id, name, role, voiceArchetype: VoiceArchetype, sceneId, microQuest: string | null }],
  zones: [{ id, name, skyZone: enum<SkyZone>, unitIds: enum<UnitId>[] }],
  scenes: [{ id, name, zoneId, landmarkIds: enum<LandmarkId>[], encounterIds: enum<EncounterId>[],
             arrivalLine: LineRef, payoffKind: enum<"climb"|"walk"|"door"|"lift"|"bridge"|"ride"> }],
  encounters: [{
    encounterId: enum<EncounterId>,
    contraptionId: enum<ArchetypeFor<mode>>,  // e.g. "witness_projector" | "wire_ticker" | ...
    objectNouns: { machine: string, token: string, target: string },   // "Proof Lamp", "slide", "courthouse wall"
    verifyLabel: string, badgeLabel: string,
    lines: { approach: string, instruction: string, hints: [string, string, string], success: string, failure: string },
    itemMeta: [{ key: string, printedDate: string | null, madeYear: number | null,
                 footprint: { kind: enum<"pin"|"band"|"arrow">, from: string, to: string | null, label: string } | null }],
    cursorWindow: { start: string, end: string } | null,     // null = no Record Strip for this encounter
    pinsEarned: [{ date: string, precision: enum<"day"|"month"|"year">, label: string, laneUnitId: enum<UnitId> }],
    hintPins: [{ rung: 1|2|3, date: string, label: string }],
    misconceptionHeadline: string,
  }],
  lore: [{ id, afterEncounterId: enum<EncounterId>, sceneId, plateText: string, sourceRefEncounterId: enum<EncounterId> }],
  intro: LineRef[], outro: LineRef[],
}
```

- **Code-verified invariants** (the verifier stage):
  - every `lines.*` ≤ 140 chars;
  - `lines.hints[i]` must semantically match `encounter.hints[i]` (a FAST-model check), and H3 may name the
    answer only if the fixture's H3 does;
  - `failure` lines must not contain any answer var from `mode.answerVars` or any item text the grade would not
    reveal (string check against `templateVars`);
  - `itemMeta.printedDate` must appear in that item's text; `madeYear` must appear in the item text;
  - `pinsEarned` dates must appear in the encounter's params, prompt or `sourceRef`;
  - lore `plateText` must be a quote from a `sourceRef` or explanation in the spec (no new facts);
  - for `domain ∈ {history, civics}`: a **sensitivity lint**: no NPC `name` equal to any person named in the source
    text, no landmark flagged `depictsViolence`.

### 9.4 What must stay hand-built
- Biome kits (art), the archetype code, the panel components, and the Record Strip system.
- The **sensitivity policy** for history kits (withheld photo plates, empty-stage memorial payoffs, no
  real-person sprites) is kit behaviour, not LLM behaviour, so the model cannot opt out of it.

---

## Appendix A · Engine requirements this game depends on

| # | Requirement | Seam | Owner |
|---|---|---|---|
| A1 | Structured live messages (`LiveMsg`, §5.0.1); `WidgetProps.onLive` widened from `number` to `unknown`; `GameClient.onWidgetLive` retyped | runtime map §1.5 REC | engine-dev |
| A2 | Draft emitters in Pick (mimic, predict_reveal), Order (linear), Sort (bins), Link (chain, pairs, elimination + marks), or new panel components replacing them for showcase modes (keeping `data-testid="widget-first-option"` and `widget-submit`) | widgets | engine-dev |
| A3 | `Grade.focus?: string[]`, added inside each of the 7 modes' `grade()`, computed from variables already used by the feedback string; unit tests assert that feedback strings are unchanged | `src/mechanics/types.ts` + modes | mechanics-dev |
| A4 | `finale` phase: the boss success plays its consequence, `celebrate`, after-beats and outro before `EndScreen` | D2 | engine-dev |
| A5 | Capture the cleared encounter before `submit` (after-beats such as `e12.S1`) | D1 | engine-dev |
| A6 | World state derived from `runner.currentIndex` (the solid landmarks) | D3 | engine-dev |
| A7 | `intro` phase rendering `narrative.intro` plus overlay intro lines with speaker names | D6 | engine-dev |
| A8 | `disableGlobalCapture()` while the panel is open (the year cursor uses arrow keys) | D4 | engine-dev |
| A9 | Memoize the view per `current.index` (drafts fire often) | D5 | engine-dev |
| A10 | The host blocks progress at each unsolved landmark (wireframe = no collision) | D7 | engine-dev |
| A11 | The mystery genre routes to the new side-view host when an overlay exists; keep or update the `play-mystery.spec` test ids (`mystery-host`, `scene-arrival`, `scene-cross_exam`) in the same change | runtime map §5.2 | engine-dev |
| A12 | DOM fallback: the same SVG layers as DOM with CSS parallax, the contraption in a static solved/unsolved state, the panel unchanged | runtime map §2.3 | engine-dev |
| A13 | Overlay file `src/game/worlds/history_mystery_001.ts` (or `fixtures/worlds/…`, in a subdirectory), keyed by `spec.id`, then (`src_civil_rights`, `mystery`) | runtime map §3.3 | engine-dev / architect |

**Pacing** (the showcase build runs longer than the fixture's `targetMinutes: 10`; the demo uses `skipTo`, and an
"express" setting opens each panel on arrival):

| Scene | Explore (s) | Puzzles (s, first try) | Cutscene/payoff (s) |
|---|---|---|---|
| S1 | 40 | — | 70 intro |
| S2 | 45 | 60 + 75 | 8 + 10 |
| S3 | 25 | 50 | 10 |
| S4 | 50 | 55 + 90 | 8 + 10 |
| S5 | 35 | 90 | 15 (lift) |
| S6 | 45 | 70 + 80 | 8 + 8 |
| S7 | 25 | 75 | 20 (crossing + streetcar) |
| S8 | 60 | 70 + 100 + 120 | 10 + 12 + 45 finale |
| **Total** | **≈ 5.4 min** | **≈ 17.3 min** | **≈ 4.5 min** → ≈ 27 min (≈ 12 min with `express` + skip) |

## Appendix B · Fact-check notes for the content owner (fixture is pinned; flag only, do not edit)
1. **e7** "Gave the closing speech remembered as I Have a Dream": King's was the last major address. Afterwards
   Rustin read the demands and Randolph led a pledge. The overlay's lines say "its close, not its whole" and stay
   consistent with the fixture.
2. **e12 clue 2**, "Johnson introduced the voting bill on March 15, 1965": March 15 is the "We Shall Overcome"
   address to a joint session. The bill was formally sent to Congress on March 17. The overlay's S2 line says
   "within days", which is accurate either way.
3. **e12 clue 1**, "Black registration in Selma's county was still under 2%": commonly cited as "about 2 percent"
   for Dallas County. Verify against the source PDF page (`samples/civil-rights-history.pdf`, p. 3/4) before any
   re-record.
4. **e10 item** "John Lewis's 1965 hospital interview about Bloody Sunday": confirm that the source text names a
   hospital interview. If not, a future fixture revision could use a documented 1965 statement. The
   classification (primary) is right either way.
5. **e5 node 0**, "The Supreme Court rules segregated interstate bus terminals illegal": this is Boynton v.
   Virginia (December 1960). Fine as written; the overlay never adds the case name, because it is not in the
   source.
6. The overlay invents **no** dates, names or quotations. Every pin (§5.0.2), plate (§6.3) and headline (§6.5)
   draws on fixture text: `params`, `prompt`, `hints`, `explanation`, `reveal`, `sourceRef` or `debriefLine`.

## Appendix C · Dialogue length check
Every §4.4 line was measured with a script over the table rows (third column, with the `[fixture…]` tags
stripped): all lines are ≤ 140 characters. Re-run after edits:

```bash
awk -F'|' '/^\| `(I|X|N|O|e[0-9]+\.)/ { t=$4; sub(/`\[fixture[^]]*\]`/,"",t); gsub(/^ +| +$/,"",t);
  if (length(t) > 140) print length(t) ": " $2 }' docs/design/12-game-civil-rights.md
```
