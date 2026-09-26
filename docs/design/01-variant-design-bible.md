# 01 · Variant Design Bible

## CHANGELOG

| Date | Change | Source |
|---|---|---|
| 2026-09-26 | **§9 extended.** Added game-feel items (37)–(44) (non-walk verbs per zone, orange input binds the world, staged boss taunts, hints act in the world, 150 ms first reaction, payoff-is-used, explore never silent > 20 s, sandbox/quest touch per zone). Renumbered the mandatory ★ set to add 38, 40, 42 (14 mandatory total). Raised the target to ≥ 39/44 with all mandatory items passing. | critique amendment 29 |
| 2026-09-26 | **§6.1 asset path/naming updated** to match `02-assets-and-art-pipeline.md` §3.0: namespaces `orrery_terraces` / `living_gate` / `archive_of_voices` (+ `shared`), keys `ns.group.name`, output path `public/assets/expedition/<ns>/<group>/<name>.svg`, pivots as fractions. Retires the old `public/assets/variant/<biome>/…` path and px pivots. | critique §1.4 "Asset namespaces", amendment 22 |
| 2026-09-26 | **New §11 "Scoring protocol"** for the fidelity critic: capture inputs, output JSON shape, and the rule that a panel item cannot pass from a screenshot without the panel open. | brief (fidelity critic needs a machine-checkable protocol) |
| 2026-09-26 | **§6.1 repointed** at `20-expedition-architecture.md` §5.1 for asset naming/paths (was §02 §3.0, which round 2 found disagreed with 20); the duplicated namespace/key/path table is removed and left as a one-line pointer. | critique round 2, amendment 2 |
| 2026-09-26 | **§6.3 replaced.** The protagonist is no longer an SVG puppet; it is the **one recoloured Kenney rig** (20 §5.5), one body/pose set reused by all three games and re-costumed per biome (Wren / the Diver / Nell — three costumes). Guide companions (Cog, Pip, Ida's lantern moth/archive drone) stay small SVG puppets, as do bosses. | critique round 2, amendment 19 (via A13) |
| 2026-09-26 | **§6.4 replaced.** "jump (Space)" is retired for the full traversal-verb table of 20 §2.4.2 (hop, climb, ladder, drop, timed hop, ride, cosmetic hop). "3 zones per game" is retired for the actual per-game counts: trig 3, cell transport 4, civil rights 8. | critique round 2, amendments 2, 28 (via A13) |
| 2026-09-26 | **§7 headed** "superseded for bindings by 20 §4 / §4.1; kept as the pitch-level target." §7.1–§7.3's revision-1 per-encounter tables (Radian Rail, Proof Press, "Morgue → Wire Room → Vault", ATP in `ui.accent`) are replaced with a pointer to each game doc's own binding table plus a 6-row sample whose archetype/skin ids are copied verbatim from those tables. | critique round 2, amendment 13 (A13) |
| 2026-09-26 (night) | **Final consistency pass (31 A13 residue).** §6.1's `load.svg {scale}`, `setLiveValue`/`celebrate` and "left 60 %" camera now point at 20 §5.1, §2.10 and §2.2/§3.1; §6.3 gives the atlas frame counts (28 protagonist, 12 NPC) and names Wick; bosses are contraption skins; §7.2's ATP gauge is gold (cell §2.2); §7.3's zones are the eight civil scenes. | 31 A13, A3 |
| 2026-09-26 | **§8 mode table deleted.** §8 now points at `20-expedition-architecture.md` §4 (the 13 demo contraption archetypes) and §6 (the World Writer, S7.5) as the implementable contract; this section stays the pitch-level rationale only. | critique round 2, amendment 13 (A13) |
| 2026-09-26 | **§9 item 39 reworded** from "≥ 2 presentation waves… ≥ 1 taunt on approach and on fail" (unmeetable for a real-time boss like the Warden's Shield) to "the boss is staged: arena, taunts, phases or real-time motion," matching 20 §8.3's item 39. | critique round 2, amendment 5 (A5) |
| 2026-09-26 | **§11 gains a P0 scoring rule**: items 37, 43 and 44 (traversal variety, explore-never-silent, sandbox/quest touch) are scored on **zone 1 only** at P0, since later zones' triggers, sandboxes and traversal beats are P1; the P0 target is all ★ items passing plus ≥ 36/44 (the full-game target stays ≥ 39/44). | critique round 2, amendment 5 (A5) |

**Scope.** This is the visual and interaction target for the three showcase games (The Clockwork Crypt / trig,
The Membrane Vault / cell transport, The 1965 Files / civil rights). It is written so that later a
PDF-generated game can get the same treatment: the pipeline writes a story/dialogue overlay and picks a
**contraption** from a library keyed by mechanic mode (§8).

**Reference.** Eight frames from Triseum's *Variant: Limits* trailer (`images/3.png` … `images/10.png`,
~2000 px wide captures; some include YouTube chrome: the "Play" pill bottom-left, the heart/clock/share/embed
icons top-right, the "Triseum" tag top-left. **Ignore those; they are not part of the game UI**).

**Constraint.** Variant is real-time 3D. We ship **painterly 2.5D side-view with parallax** (Phaser 4 world +
React instrument panel). Everything below is expressed in terms we can build: SVG parts rasterized to
textures, gradients, additive glows, layered parallax, tweened rotations.

**The one-sentence rule.** *The concept is the machine.* The player never answers a question "about" the
world; they set a value on an instrument and **watch the world move because of that value**, then press
Verify and the machine does its job (door opens, bridge closes, beam lands, stair rises), and then **they walk
through / across / up the thing they just built.**

---

## 0 · What we have today vs. what the reference does

| Axis | Quest Forge today | Variant: Limits |
|---|---|---|
| Traversal | A/D walk to the next socket, nothing else | Walk, climb stairs the puzzle created, cross bridges it patched, explore side paths, approach consoles |
| Art | Kenney 1-bit tiles tinted by palette | Soft pastel low-poly: cream stone, gold trim, navy inlay, teal crystals, salmon/blue foliage, long soft shadows |
| Characters | Tinted 1-bit sprite | Readable protagonist (scarf, staff, satchel) + guide voice with an emblem |
| Puzzle UI | Modal React widget over a frozen canvas | Right-side instrument panel; world stays visible and **moves live** with every input |
| Purpose | "Get to the end" | Restore a broken world: power the gate network, patch the bridge, open the solar vault |
| Feedback | Right/wrong text | The machine itself shows how close you are (beam misses the node by 0.4; step is 0.1 too high) |
| Success | Consequence overlay | In-world animation of the contraption + badge ("PATCH SUCCESSFUL") + the path opens |

---

## 1 · Reference study, frame by frame

### 1.1 `3.png` · The Gate Plaza (establishing shot, no panel)
- **Composition:** symmetric plaza. Centre: a giant cream disc-gate (~45 % of screen height) made of
  **concentric rings** (outer ring split top-centre by a vertical gold "keyhole" fin that rises above the disc
  like a crown). Flanking: two smaller **arch doors** with ironwork of circles and crescent hooks, each fronted
  by a cream **pillar** with navy capital bands. Behind: grey-teal cliffs; top-left corner: salmon/orange
  autumn tree.
- **Beam network:** cyan beams run horizontally from pillar emitters (glowing cyan orbs with a white core,
  ~halo 3× core radius) through **nodes** on the gate face to the right pillar. One beam drops diagonally
  to a small **pedestal emitter** (hourglass-shaped stand with an orb) next to the player. A diamond-shaped
  **waypoint glyph** floats above that pedestal.
- **Player:** tiny (≈7 % of screen height, ≈1/6 of gate height), running toward the gate. Scale says "you are
  small; the ancient machine is big".
- **Foreground:** cream balustrade fences with navy rail cap and a square post bearing a round emblem; a
  cream stone plaza floor with dappled leaf shadows (soft, blurred, blue-grey multiply shadows).
- **Midground:** teal grass meadow, orange flower tufts, a turquoise pool with a sand path.
- **UI:** only a thin double-ring **objective indicator** top-left (~55 px, white @ 60 %).
- **Takeaway:** the hub is a *machine you will re-power*. Each puzzle feeds a beam to this gate.

### 1.2 `4.png` · Orb placement on a piecewise graph ("board mode")
- **Split:** world on left 45 %, panel on right 55 %. World shows the player on a cliff edge, a shrine of
  cream pillars with navy slat capitals, a **beam** entering from the left into a glowing orb socket on the
  shrine, turquoise crystal spires behind (tall prismatic shards, lighter faces toward the sky).
- **Panel:** back arrow tab top-left; a narrow **orb palette column** (dark, hex texture, rounded ends marked by
  small hollow circles on the column's top/bottom edge); a square **graph board** −5…5 × −5…5 with arrowheads
  on both axes, labels "5", "−5" only at the ends, 1-unit grid.
- **Graph:** a piecewise linear function: rising line to a hole (hollow circle) at ≈(1,3.4), a filled point
  at (1,4) above it, a peak arm to a hollow circle at (2,1.9), then a descending line. **Orbs** (white ring
  with teal half-fill, different fill patterns mean different claims) are dragged from the palette and dropped
  onto points of interest; one orb is still in the palette, one hovering at the edge.
- **Dialogue bar:** "Find a way to place all Orbs so they describe the points of interest on which they are
  placed." Emblem + **i** button stacked at the bar's left edge, straddling the world/panel seam.
- **Left HUD:** a diamond glyph (tool/ability) at mid-left over the world.

### 1.3 `5.png` · Rotating wheels form a doorway ("scrub mode")
- **Split:** world left ~59 %, panel right ~41 %. Dialogue bar spans from 50 % to the right edge.
- **World:** two massive **half-disc wheels** set into a cream-and-gold wall with vertical navy grooves.
  Each wheel carries a diegetic **angle gauge**: a white arc (f) and a green ring with tick marks (g), each
  tagged by a chip **"f(x): 0.3π"** (white border) and **"g(x): 1.7π"** (green border) with a pointer
  triangle. When both wheels reach the right angle their cut-outs line up into a doorway.
- **Player** stands at a **console** (a lectern with a lit screen and a gold rim; ~0.7× player height),
  holding a staff. A small indigo glowing wisp (collectible / companion) floats to the left.
- **Panel:** three stacked **graph cards** labelled by corner tabs **f(x)**, **g(x)**, **h(x)** (top-right,
  outlined box). y-ticks in π: 2π, π, 0, −π, −2π; x-axis 0…10 with arrow and "10" label. f is white (a
  tent/triangle), g is green (a cosine-like wave), h is empty (just axes; unused cards are still drawn).
- **Scrubber:** one **vertical orange line** crosses all three cards at x = a (≈4.6), ending in an orange
  **teardrop knob** on a ruler (ticks 0…10 labelled, half-ticks unlabelled). Left of the ruler: an orange
  **"f(a)"** tab and a dark readout box **"0.0"**.
- **Value chips:** "0.0pi" (white border) and "2.0pi" (green border) sit **on the left edge of each card at
  the height of the current value**, overhanging the panel edge into the world. They are the live readout
  of f(a), g(a).
- **Dialogue:** "Rotate the wheels to form a doorway." (one imperative line).

### 1.4 `6.png` · The product patch (f·g) bridge
- **World:** purple-to-pink dusk sky, lavender sea with lighter foam blobs, pink cliffs with an arch
  aqueduct, a wooden dock and crates. Thin **white-cyan beam lines** cross the sky between towers (the network
  the player is restoring). Colour temperature shifts per zone (this zone is violet).
- **Panel (board mode, 55 %):** stacked operand tiles **f(x) / × / g(x)** (a formula "stack" at left,
  bracketed by a thin line with dot terminals). A graph 0…10 × 0…10 of **blue** product curve (|…|-shaped
  arcs meeting 0 at x≈3.5 and 6.5) with a **jump at x≈5** (hollow at 4, filled at ~2.7).
- **Columns:** below the graph, three **vertical slider columns** aligned to x≈3.5, 5, 6.5, each with an orb
  knob and **orange "− +" buttons** at the bottom. The orbs mark the x positions of the patch.
- **Badge:** **"PATCH SUCCESSFUL"** rectangle with bracket connectors above and below (lines ending in small
  dots), placed to the left of the columns.
- **Dialogue (insight):** "No matter how vastly different two things may be, nothing brings them together
  like multiplication by zero." That is the guide's *one-line insight* after success: a concept stated as a
  truth about the world.

### 1.5 `7.png` · The complex limiter (orb palette + Verify)
- **Panel nearly full-width** (world squeezed to a sliver on the left: a cream wall edge and grass).
- **Orb palette:** a 3-column grid of 13 orbs in 4–5 **fill patterns** (full teal, ring only, half teal,
  teal with white centre, dot). A **pencil button** (blue filled circle, white pencil) at the bottom creates a
  new orb (i.e., the player can author their own claim).
- **Graph:** 0…15 × 0…4, many features: step segments with filled/hollow ends, a V, a wiggle with holes,
  an isolated point, a tall bump. Placed orbs sit on holes/jumps.
- **VERIFY LIMITER** button centred below the graph, dark with a light border, flanked by horizontal lines
  ending in dots (the "circuit trace" motif). Disabled state = low-contrast grey text.
- **Dialogue:** "This is the most complex Limiter yet. Create and place all Orbs at the points of interest on
  the graph. When all Orbs are placed, click on Verify Limiter." (Instruction + escalation framing.)

### 1.6 `8.png` · The First Solar Vault (IVT, modal mode)
- **Modal** framed panel centred over a darkened interior (the vault room, dusky purple/brown).
- **Left third:** dark text column with the brief: "First Solar Vault: Choose the obscured interval where the
  continuous function attains the indicated value in orange, per the Intermediate Value Theorem (IVT)." The
  **i** button and emblem sit bottom-left (info button here has a **salmon** ring instead of white).
- **Right two-thirds:** a graph with **four interval columns**; between them the curve is **obscured by dark
  gutters** (hex texture). An **orange horizontal target line** y = −1 runs across with bracket end caps
  `[` `]`. The player chooses which column contains the crossing.
- **Takeaway:** "vault" puzzles are rarer, full-focus moments: modal, but the room is still visible around it.

### 1.7 `9.png` · Align the emitter's beam with the middle node
- **World:** a terraced courtyard: grand stair to a portico whose lintel carries **three round nodes**
  (bronze rings with glass cores); a numbered **map pin "2"** marks the middle node. A **pedestal emitter**
  (coiled hourglass stand with a cyan orb and a green ring at its base) shoots a thin beam upward. Canals of
  bright aqua water with gold coin flecks, blue and rust-orange shrubs, pale stone paving in irregular
  polygons.
- **World label:** big **"g(x): 0.0"** chip (green border) anchored to the emitter base.
- **Panel:** f(x) card empty, **g(x)** card shows a green piecewise function (rising to a hole at (5,2), a
  point at (5,4)?, then descending, a hollow at (7.5,2)), h(x) empty. Scrubber a = 5.0, chip "0.0" at the zero
  line on the g card (the function is undefined/jumps here; the readout is the trap).
- **Dialogue:** "Align the Emitter's beam with the middle Node." The beam **angle is g(a)**; scrubbing a
  sweeps the beam across the lintel live.

### 1.8 `10.png` · A single input, two outputs: form a staircase
- **World:** cliff face with stacked grey-teal blocks, blue crystal clusters, a blue tree. Two **tall map pins
  "1.2" and "−1.2"** (dark teal fill, white stroke, white chevron below) float over two **ring sockets** on a
  ledge. Below, three sandstone **blocks** with engraved rings on top form a staircase; the two movable blocks
  carry **height gauges** (thin vertical ruler with ticks) and chips **"g(x): 2.5"** (green) and **"h(x): −2.5"**
  (blue).
- **Panel:** g (green, decreasing cosine-like) and h (blue, increasing) cards; a = 7.0; chips **−2.4** (green)
  and **2.4** (blue) ride the y-axes. World chips show 2.5 / −2.5: the blocks **ease toward** the panel value,
  so world labels lag the panel for ~0.3 s (this is desirable: it reads as physical motion).
- **Dialogue:** "A single input can produce more than one output, depending on the functions. Adjust the
  input to form a staircase." (Insight sentence + instruction sentence.)
- **Player** stands on the upper ledge by a cream kiosk with a round emblem panel.

---

## 2 · Palette (estimated hex values)

All values are sampled by eye from the frames and rounded; treat them as the **Variant base palette**. Each
biome (§6) re-tints a subset but keeps the UI palette identical across all three games (the instrument panel
is our brand; the world is the subject).

### 2.1 World: architecture and nature

| Token | Hex | Where |
|---|---|---|
| `stone.lit` | `#FBF1DE` | sunlit face of cream stone, pillar fronts |
| `stone.base` | `#F2E3C6` | cream stone mid |
| `stone.shade` | `#D9C3A0` | stone in shadow, undersides |
| `stone.deep` | `#B89C78` | recesses, grooves |
| `sand.path` | `#EBCFAE` | paths, plaza floor warm |
| `gold.hi` | `#F6D27A` | gold trim highlight |
| `gold.base` | `#D9A441` | gold trim, gate fin, wheel rims |
| `gold.deep` | `#A8782E` | gold in shadow |
| `inlay.navy` | `#27466A` | navy bands on capitals, rail caps, gate grooves |
| `inlay.navy.dark` | `#1B3150` | navy in shadow |
| `bronze.ring` | `#6E4A2E` | node rings, pipes, stair-socket rings |
| `rock.light` | `#8FA6A0` | cliff highlights |
| `rock.base` | `#5F7B7A` | grey-teal cliffs |
| `rock.shade` | `#3F5857` | cliff shadow |
| `grass.light` | `#9ED6C4` | meadow tips |
| `grass.base` | `#6FB7A6` | teal grass |
| `grass.shade` | `#4F8F85` | grass base/shadow |
| `water.shallow` | `#8FE0EA` | canal highlights |
| `water.deep` | `#4CB6D0` | canal body |
| `crystal.hi` | `#C9F3FF` | crystal lit facet |
| `crystal.base` | `#6ED2F2` | crystal body |
| `crystal.shade` | `#2E8FC0` | crystal dark facet |
| `foliage.blue` | `#5A95D6` / hi `#8CC0EE` | blue shrubs and trees |
| `foliage.salmon` | `#E48C5E` / hi `#F4AE80` | salmon/autumn foliage |
| `foliage.rust` | `#C4643C` | rust shrubs, flower tufts |
| `wisp.indigo` | `#6A6CF0` | floating companion wisp / collectibles |

### 2.2 Skies (vertical gradients, top → horizon)

| Zone | Top | Mid | Horizon | Haze overlay |
|---|---|---|---|---|
| Day plaza (3, 5) | `#D8D4CF` | `#E8DCD2` | `#F4E7DA` | white 25 % over far layers |
| Crystal cliffs (4) | `#E9C9C0` | `#F2D8C8` | `#FAE9D8` | peach 20 % |
| Dusk sea (6) | `#9E86D8` | `#C9A0DE` | `#F2B8D4` | pink 30 %; sea `#B48AE2` → foam `#D9C0F4` |
| Interior vault (8) | `#3B2F3E` | `#4E3C44` | `#5E4A4A` | dim, warm |

### 2.3 UI (identical in all games)

| Token | Hex / rgba | Where |
|---|---|---|
| `ui.panel` | `rgba(38, 92, 106, 0.86)` (`#265C6A`) + `backdrop-filter: blur(6px)` | panel background, dialogue bar |
| `ui.panel.hi` | `#3B7682` | lighter panel wash toward top-right |
| `ui.card` | `#0F2A33` | graph card interior, column interiors, orb palette |
| `ui.card.deep` | `#0B1F27` | back-arrow tab, button fill |
| `ui.hex` | `rgba(120, 190, 205, 0.14)` | hex-grid stroke on panel/cards |
| `ui.grid.major` | `rgba(111, 184, 200, 0.55)` | 1-unit grid lines |
| `ui.grid.minor` | `rgba(111, 184, 200, 0.22)` | half-unit grid lines |
| `ui.line` | `#E8F6F8` | card borders, axes, frame lines (1.5–2 px) |
| `ui.line.glow` | `rgba(159, 230, 242, 0.45)` | 4–6 px outer glow on borders |
| `ui.text` | `#FFFFFF` | dialogue, labels |
| `ui.text.dim` | `#9DB8BE` | disabled button text ("VERIFY LIMITER" before ready) |
| `ui.accent` | `#E2892C` | f(a)/input tab, scrubber line, knob, −/+ buttons, target line |
| `ui.accent.hi` | `#F4A95A` | scrubber core, hover |
| `ui.accent.deep` | `#B8661C` | pressed |
| `ui.info.warm` | `#E7A08C` | salmon ring variant of the i button (vault modal) |
| `fn.f` | `#F5F8F8` | f(x) curve (white) |
| `fn.g` | `#6FD98E` | g(x) curve, green chip borders |
| `fn.h` | `#4F92E6` | h(x) curve, blue chip borders, product curve |
| `orb.fill` | `#3F97B8` | orb teal fill |
| `orb.ring` | `#FFFFFF` | orb rings |
| `pencil.btn` | `#3A8FC4` | create-orb button fill |

**Rules:** the world never uses `ui.accent` orange as a large fill (orange means "your input"). Function colours
white/green/blue are reserved for *values* and repeat in the world only on chips and gauges bound to those
values. This is what makes the panel and the world read as one instrument.

---

## 3 · UI anatomy (measurements as % of a 16:9 viewport)

### 3.1 Layout modes

| Mode | When | World | Panel | Dialogue bar |
|---|---|---|---|---|
| **Explore** | walking | 100 % | hidden | hidden (or 1-line toast at bottom when the guide speaks) |
| **Scrub** (5, 9, 10) | a single input drives the world | left 58–60 % | right 40 % (x 0.59→0.975) | x 0.50→1.00, y 0.85→1.00 |
| **Board** (4, 6, 7) | placement / multi-control puzzles | left 45 % (or a 15 % sliver for the hardest) | right 55 % (x 0.45→1.00) | x 0.43→1.00, y 0.80→1.00 |
| **Vault** (8) | boss / theorem moments | full screen dimmed 55 % behind | centred modal 80 % × 85 % with a left brief column (30 % of modal) | inside modal (brief column) |

Panels **slide in from the right** (280 ms, ease-out cubic) while the camera **pans** so the contraption sits
centred in the remaining world area. The world never dims in Scrub or Board mode.

### 3.2 Panel frame
- Background `ui.panel` with backdrop blur so the world ghosts through; a **hex-grid** texture (flat-top hexes,
  36–44 px across at 1920 w, 1 px `ui.hex`) over the whole panel and dialogue bar.
- **Frame lines** (`ui.line`, 1.5 px): a vertical rail runs down the panel's left edge; the horizontal line
  above the dialogue bar; bracket lines around grouped controls. **Every free line end terminates in a small
  hollow circle** (r = 4 px) or a filled dot (r = 3 px); groups of 2–3 dots at the right end of the dialogue
  divider ("• • ◉"). This circuit-trace motif is what makes it read as ancient tech, not a web form.
- **Back arrow** (top-left of panel): a dark `ui.card.deep` tab, 8 % × 4 % of screen, white left arrow,
  1.5 px border; closes the panel (returns to Explore without grading).

### 3.3 Graph card
- Interior `ui.card`; 2 px `ui.line` border with glow; outer 1 px frame offset 6 px (the card sits in a "slot").
- **Label tab**: top-right, small outlined box with **"f(x)"**/**"g(x)"**/**"h(x)"** in 18 px white; tab sits
  half outside the card top edge.
- **Axes**: white 1.5 px; arrowheads at positive ends (and both ends on a full −5…5 board); **tick labels**
  bold white 20–24 px at 1920 w: numeric (0, 2, 4, −2, −4, 10) or π-formatted (2π, π, 0, −π, −2π). Label only
  every major tick; minor ticks unlabelled.
- **Grid**: major every unit (`ui.grid.major`), minor halves (`ui.grid.minor`).
- **Curves**: 3 px, round caps, coloured by function; open endpoints = hollow circle r 7 px stroke 2.5 px;
  closed endpoints = filled circle r 7 px.
- **Empty card**: still drawn (axes, 0 and 10 labels only) when the function is not used in this puzzle: the
  stack keeps its rhythm.
- Stacked cards: 3 cards × 19 % height, 3.3 % gaps, all sharing one x-axis domain so the scrubber line
  crosses them at one x.

### 3.4 Input scrubber
- **Ruler row** below the stack (6 % height): dark strip, ticks every 0.5, labels at integers 0…10 (bold 22 px).
- **Knob**: orange teardrop (point up into the line), 28 px, `ui.accent` fill with a 2 px darker outline; on
  drag it glows `ui.accent.hi`.
- **Line**: vertical `ui.accent` line (6 px) with a 2 px `ui.accent.hi` core, spanning from the top card to the
  knob, drawn above the cards.
- **Input tab + readout** (left of ruler): orange tab with **"f(a)"** in 36 px white (we label it with the
  input symbol, e.g. "a", "t", "θ", "year"), then a dark box with the value **"7.0"** (36 px). Readout
  formats: one decimal; π-mode shows **"0.83π"**.
- **Keyboard**: ←/→ = 1 small step, Shift = 10×, Home/End = min/max; the knob has `role="slider"`.

### 3.5 Value chips
- Dark `ui.card.deep` box, 2 px border in the function's colour, 30–34 px text, value formatted in the
  card's unit ("2.0pi" / "2.0π", "−2.4").
- Positioned on the **card's left edge at the y of the current value** (clamped to the card), overhanging the
  panel edge by half its width: the chip is literally the bridge between panel and world.
- **World chips**: same style with a pointer triangle, labelled **"g(x): 2.5"**, anchored to the contraption
  part that value drives. World chips ease to the new value (lerp 0.25/frame) and so briefly lag.

### 3.6 Orb palette column (board mode)
- Narrow dark column (≈ 7 % of width) with hex texture, hollow-circle terminals top and bottom.
- Orbs: 60 px, white 3 px outer ring, inner disc `orb.fill`; **fill patterns encode meaning** (see §4.2):
  full, ring-only, left-half, centre-dot, hollow-centre. Grid 3-wide when many (7.png).
- **Pencil button** (blue filled circle, white pencil) at the bottom creates a new orb (the player names what
  it claims).
- Drag orbs onto the graph; keyboard: Tab to orb, Enter to pick, arrow keys snap between points of interest,
  Enter to drop.

### 3.7 Vertical slider columns (6.png)
- Tall narrow columns aligned under x positions of interest; each holds an orb knob that slides vertically,
  and a pair of **orange "−" "+" square buttons** (24 px each, white glyph) at the bottom.

### 3.8 Buttons and badges
- **Verify** (e.g. **"VERIFY LIMITER"**, ours: "VERIFY GATE", "SEAL MEMBRANE", "FILE THE STORY"): 20 % × 5 %,
  `ui.card.deep` fill, 1.5 px `ui.line` border, letter-spaced caps 28 px; **flanked by horizontal trace lines
  ending in dots**. Disabled until the puzzle has a complete input (text `ui.text.dim`).
- **Success badge** (e.g. **"PATCH SUCCESSFUL"**): two-line caps in a light-bordered box, with **bracket
  connectors** above and below (short lines ending in dots). Appears for 1.6 s where the Verify button was,
  then the panel slides out.

### 3.9 Dialogue bar
- Bottom band (15–20 % height) in `ui.panel` + hex texture, top edge = frame line with dot terminals.
- **Guide emblem** (64 px circle): dark fill, white strokes, three concentric rings where the inner rings are
  **broken** like a labyrinth; sits on the bar's left edge, half over the seam.
- **Info button** (64 px): white "i" in a double ring; opens the hint panel (our HintPanel, restyled).
- **Text**: white, 30–32 px at 1920 w (≈1.6 vw), max two lines, left-aligned. Sentence style:
  1. *Instruction* (imperative, names the world object): "Rotate the wheels to form a doorway."
  2. Optional *insight* (a concept stated as a truth of the world): "A single input can produce more than one
     output, depending on the functions."
  3. After success, the insight replaces the instruction ("…nothing brings them together like multiplication
     by zero.").
- Text **types on** at 45 chars/s; click/Space completes it.

### 3.10 HUD over the world
- **Objective ring** top-left (55 px double ring, white 60 %): fills clockwise as the zone's beams are
  restored (our encounter progress). Replaces the MasteryHud's current look.
- **Ability/waypoint glyph** (diamond with inner lines, 4.png left): shows the interact prompt near consoles.
- **Map pins** in world: teardrop pins (dark teal fill, white stroke, white chevron below) with a number or a
  target value ("2", "1.2", "−1.2"). Pins mark **targets**; chips mark **current values**.

---

## 4 · Puzzle-in-world patterns (the grammar)

Every Variant puzzle has the same five parts. We encode each of our contraptions in this exact shape.

| Part | Meaning |
|---|---|
| **Console** | the lectern/kiosk the player walks to; pressing E opens the panel |
| **Control** | what the player manipulates in the panel (scrubber, orb, column, interval, plank) |
| **Live link** | the world object that moves *continuously* with the control (not only on Verify) |
| **Verify** | the check: a named button or an automatic check when the world object hits the target |
| **Payoff** | an in-world animation that changes traversal: door opens → walk through; stair forms → climb it |

### 4.1 The eight reference patterns

| # | Frame | Control | Live world reaction | Verify checks | Success looks like |
|---|---|---|---|---|---|
| P1 | 3 | walk + console | beams flow from restored pillars into the gate's nodes | all nodes powered | gate rings rotate open, gold fin splits, light floods out |
| P2 | 4 | drag orbs onto graph points | the shrine's socket orb brightens as more orbs are correct | each orb's claim matches the point (hole / jump / limit exists) | the beam completes into the shrine, pillar lights |
| P3 | 5 | scrub input a | wheels rotate to f(a), g(a) angles; arcs + chips update | cut-outs align: both angles hit the doorway angle | wheels lock, the doorway is open, player walks through |
| P4 | 6 | −/+ columns at key x's | bridge planks rise/fall to the product value at each x | patch values equal the product's value / limit | bridge segments close; "PATCH SUCCESSFUL"; walk across the sea |
| P5 | 7 | create + place many orbs | limiter device fills its slots | every point of interest has the right orb | limiter powers, beam connects to the next zone |
| P6 | 8 | choose an interval column | the chosen column's shutter lifts, revealing the curve | the curve crosses the target line in that column | the solar vault's sun disc turns, vault opens |
| P7 | 9 | scrub input a | emitter beam angle = g(a); beam sweeps across lintel | beam hits node 2 | node ignites, portico doors open |
| P8 | 10 | scrub input a | two blocks rise/fall to g(a), h(a) | heights match the pinned targets | staircase complete; player climbs to the ledge |

### 4.2 Design rules drawn from them
1. **One control, many consequences.** A single scrubber moves several world objects (P3, P8): that *is* the
   lesson ("one input, several outputs").
2. **The trap is visible.** The world shows the misconception physically (P7: at a = 5 the jump makes the beam
   snap; P3: the wheels pass the right angle twice). Our `targetMisconception` must have a visible failure.
3. **Targets are pinned, values are chipped.** Pins in the world show where it must go; chips show where it is.
4. **Partial success is visible.** Beam lands near the node; one stair is right, one is not. Never binary.
5. **The payoff is traversal.** The thing you built is the path forward. No "correct!" popups.
6. **Escalation is narrated.** "This is the most complex Limiter yet." The guide frames difficulty.
7. **Orb glyphs are a notation.** Encoded fill = encoded meaning; the player learns the notation.

---

## 5 · Composition, scale, light

### 5.1 Scale ladder (heights relative to the protagonist H)
| Element | Height |
|---|---|
| Protagonist | 1 H (≈ 14–18 % of screen height in side view; larger than Variant's 3D shots because side-view needs legibility) |
| Console / lectern | 0.7 H |
| Pedestal emitter | 0.9 H (orb at top) |
| Stair block | 0.45–0.6 H per step |
| Pillar | 3–3.5 H |
| Wheel / ring door | 2–2.4 H diameter |
| Hub gate | 5–6 H (bleeds off the top of the frame in side view) |
| Crystal spire | 2–6 H, clustered |

### 5.2 Layering (side view, back → front)
| Layer | Parallax factor | Content | Treatment |
|---|---|---|---|
| L0 Sky | 0.0 | gradient + soft cloud bands | 4-stop gradient, 1 px noise dither to avoid banding |
| L1 Far | 0.15 | mountain / cliff silhouettes, far towers, beam lines between towers | single colour per layer + 40 % haze toward sky colour |
| L2 Mid-far | 0.35 | crystal fields, distant arches, tree masses | two-tone (lit/shade), 20 % haze |
| L3 Mid | 0.6 | cliff walls behind the path, ruins, waterfalls | full palette, soft ambient occlusion at bases |
| L4 Play | 1.0 | ground strip, contraptions, consoles, player, NPCs | full detail, contact shadows |
| L5 Foreground | 1.25–1.4 | grass blades, balustrade posts, leaf clumps, fence | darker, 2 px blur, 70 % alpha, never covers the contraption |
| L6 Light | 1.0 | leaf-dapple shadow overlay, god rays, dust motes | multiply blue-grey 25 % for shadows; add for rays |

### 5.3 Light and mood
- Key light from **upper-left, low sun**: lit faces `stone.lit`, shadow faces `stone.shade`; **long soft
  shadows** fall right, 1.6× object height, blurred 6–8 px, colour `#6E7F9A` at 30 % multiply (never black).
- **Pastel ambience**: no pure blacks in the world; darkest world colour ≈ `#2B3A44`.
- **Glow is information**: only machine parts that are live (beams, nodes, orbs, crystals near an active
  console) glow. Dormant machines are desaturated −40 % and glow-free; restoring a zone **re-saturates** it.
- **Colour temperature per zone** (warm day plaza → violet dusk sea → dim warm vault) marks progress.

### 5.4 What reads as "ancient tech"
Concentric rings; circles on vertical fins; gold edge trim on cream stone; navy inlaid bands; wheels set in
walls; pedestal emitters with coiled stems; beams that travel between nodes; brass socket rings; lecterns with a
glowing slate; circle-in-circle emblems on posts. **Repetition of the circle** everywhere (gate, wheel, node,
orb, emblem, objective ring, knob-ish teardrop) ties world and UI together.

---

## 6 · Translation to our 2.5D side view

### 6.1 Engine split (recommended)
- **World**: Phaser (the Expedition host, `20-expedition-architecture.md` §2). Replace Kenney tiles with a layer kit:
  parallax `Image`/`TileSprite` layers from SVG rasterized at load (`load.svg(key, url, {width, height})` at the raster
  factor `k` of 20 §5.1, never `{scale}`), contraptions as `Container`s of SVG parts, beams/glows via `Graphics` + pre-baked radial-gradient glow
  textures with `BlendModes.ADD` (verified in `node_modules/phaser`: `SVGFile` supports a `scale`/`width`/`height`
  config, and Phaser 4 ships `src/filters/` Glow, Blur, Shadow, Vignette, ColorMatrix: use Blur for L5
  foreground softness, ColorMatrix for the dormant desaturation, Glow sparingly because baked glow sprites are
  cheaper). Camera follows the player with deadzone; on panel open the camera frames the contraption's
  `frameBounds` inside the visible safe rect of the layout (20 decision 5, §2.2 framing, §3.1 widths).
- **Instrument panel + dialogue bar**: React (restyled widgets), because graphs, sliders and keyboard a11y are
  much easier in DOM/SVG. Live input flows as a typed `Draft` through `HostHandle.bindDraft` and success through the
  phase machine (20 §2.10, §2.9; `setLiveValue` / `celebrate` are retired). Contraption state is a pure function
  `pose(input) → part transforms` (20 §2.5.1) so the same code drives live preview and success animation.
- **Mystery host (civil rights)**: move to the same side-view world (a walkable archive street + interiors);
  the DOM MysteryHost becomes the Board/Vault mode panel content.
- **Assets**: namespaces, keys, directory layout, output paths and pivot conventions are **not repeated here** —
  see `20-expedition-architecture.md` §5.1 ("Naming table and directory convention") for the single, current
  table. In short: hand-authored (hero) and kit-generated SVG live under the namespaces `orrery_terraces` (trig),
  `living_gate` (cell), `archive_of_voices` (civil), plus `shared`; this retires the old `public/assets/variant/<biome>/…`
  path and px pivots.

### 6.2 Element-by-element recipe

| Reference element | Our 2D build |
|---|---|
| **Ring gate / wheel door** (3, 5) | 4 SVG layers: (a) wall socket (static stone + navy grooves); (b) outer ring with a notch; (c) inner ring with a notch, rotating opposite; (d) gold rim + keystone fin overlay (static, above). Rotation = value × (2π / period). Doorway = both notches at 6 o'clock → a 0.9 H × 1.3 H opening revealed by masking the socket's dark interior. Success: rings spin 1.5 turns with ease-out, fin splits (two halves tween ±24 px), light shaft (additive gradient quad) pours out. |
| **Diegetic angle gauge** (5) | `Graphics` arc in the function colour around the wheel hub, 2 px, with 4 tick marks, plus a world chip. Redrawn every live update. |
| **Beam** (3, 9) | 3 stacked lines: core 2 px `#FFFFFF`, inner 6 px `crystal.base` @ 70 %, outer 18 px `crystal.base` @ 18 %, all `ADD` blend; end cap = glow sprite. Beam angle/length computed from value; a raycast against node circles gives the hit test. Beam shimmer: alpha noise ±8 % at 12 Hz. |
| **Node** (9) | bronze ring SVG + glass core; states: dormant (grey core), near (core pulses at distance-proportional rate), lit (core `crystal.hi` + halo + 12 spark particles). |
| **Pedestal emitter** (3, 9) | SVG: base disc with green ring (value colour), coiled stem, orb on top; orb rotates to aim; its base ring colour = the function that drives it. |
| **Crystals** (3, 4, 10) | 3 SVG variants (tall shard, cluster of 5, fan of 3), each 3-tone (hi/base/shade facets) tinted per biome; placed in L2/L3 with 0.8–1.2 random scale and slight hue jitter; near active consoles they get an additive glow sprite at 30 %. |
| **Pillars** (3, 4) | 9-slice SVG: capital (navy bands + gold trim), shaft (cream with a lit left strip), base; emitter socket optional. |
| **Stair blocks** (10) | sandstone block SVG with engraved ring on top + a height-gauge sprite (thin ruler) + chip; y = baseline − value × unitPx, eased. Target sockets above show pins. |
| **Bridge patch** (6) | bridge of N planks over a gap; each plank's height = product value at its x; key planks (at discontinuities) are driven by the −/+ columns; success = planks lock with a dust puff and gold seam glint. |
| **Vault shutters** (8) | interval columns are physical shutters on the vault wall; choosing one lifts it (the curve segment is painted on the stone behind). |
| **Orbs** (4, 7) | 5 SVG orb glyphs (full, ring, left-half, centre-dot, hollow) reused in world sockets and in the panel palette. |
| **Water** (5, 9) | two scrolling gradient bands + a sine-displaced highlight line; gold flecks as tiny particles. |
| **Foliage** (all) | 4 SVG bush shapes, 3 tree shapes, tinted salmon/blue/rust; sway tween ±2° at 0.3 Hz in L5 only. |
| **Leaf-dapple shadows** (3) | one large blurred SVG of leaf blobs, multiply 25 %, drifts slowly. |
| **Fence / balustrade** (3) | foreground L5 strip SVG: cream balusters, navy rail cap, emblem post. |
| **Console / lectern** (5, 9) | SVG with a glowing slate (screen shows a tiny version of the puzzle graph); interact glyph floats above when in range. |
| **Map pin** (9, 10) | SVG teardrop, dark teal fill, white stroke, text centred; bob tween ±4 px. |
| **Objective ring** (all) | DOM SVG top-left; arc fills per restored node. |

### 6.3 Characters
- **Protagonist: one recoloured Kenney rig.** All three protagonists share a single rig — the Kenney
  `toon-characters` pack, one body, recoloured and rendered to one PNG atlas layout (28 frames for protagonists, 12 for NPCs) with one
  anchor table (`shared.char.<id>`; see `20-expedition-architecture.md` §5.5). The "shared protagonist" is literally one rig,
  re-costumed per biome into **three costumes**: Wren (trig: teal scarf, satchel, sighting staff), the Diver
  (cell: bubble helmet, tide scarf, probe-staff), Nell (civil: salmon scarf, satchel strap). This retires the
  revision-1 SVG-puppet protagonist.
- **Guide**: an **emblem** in the dialogue bar (concentric-circle style, recoloured per guide) + a small in-world
  companion built as an **SVG puppet** (≤ 8 parts, not the shared rig) that floats near the player's shoulder:
  Cog the brass owl (trig), Pip, Ora's mini-sub drone (cell), Wick, Ida's lantern (civil). When
  the guide speaks, the companion pulses.
- **Guardians/bosses** are machines drawn as contraption skins (20 §4.3: `wardens_shield`, `gatekeeper_maws`,
  `tumbler_vault`), not people (Warden = clockwork sentinel; Gatekeeper = colossal pump protein; the Editor = the
  vault's press-organ voice).

### 6.4 Explore layer (what you do between puzzles)
- **Traversal verbs** (walk plus the full link table of `20-expedition-architecture.md` §2.4.2, not just "jump
  (Space)"):

  | Verb | Key | What happens |
  |---|---|---|
  | Hop | Space | a parabolic arc between two ends; land squash + dust puff |
  | Climb | W/↑ (S/↓ back on two-way links) | a straight climb segment at 8 fps |
  | Ladder | W/↑, S/↓ | a straight vertical segment; the ladder asset is drawn between the ends |
  | Drop | S/↓, or walking off an edge | an eased fall with a small drift, landing dust |
  | Timed hop | Space | two-arc hop through a cycling driver prop's window, else a miss-hop with a "!" emote; no damage |
  | Ride | W/↑ or E | the player locks to a vehicle that tweens along a path |
  | Cosmetic hop | Space, no link in range | a small non-traversal bounce; never changes surface |

  Interact prompts name the verb ("Space · Hop", "W · Climb", "E · Board"). Every zone offers **≥ 2 non-walk
  verbs other than its own payoffs** (game-feel item 37).
- **Paths branch** lightly: a side ledge with a **collectible** (indigo wisp = "insight shard" that unlocks a
  bonus line in the debrief).
- **Guide beats** play in the dialogue bar while walking (short, never blocking).
- **Zones**: the zone count is **per game**, not a fixed three — trig 3 zones, cell transport 4 zones, civil
  rights 8 zones (see each game doc §2 and `20-expedition-architecture.md` §0.1.2). Each zone ends in a hub node
  that the zone's puzzles power; the boss is the hub of the last zone.

---

## 7 · The three showcase games

All three share the protagonist, the UI, the scrub/board/vault modes and the success grammar. They differ in
biome, guide, contraptions and panel **instrument cards** (a graph card for trig; concentration/energy gauges
for biology; a date-axis timeline card for history).

**Superseded for bindings by `20-expedition-architecture.md` §4 (the contraption library) and §4.1 (all 29
encounters); kept here as the pitch-level target.** Each game doc (`10-`, `11-`, `12-`) owns the authoritative
per-encounter binding table (control, live world, verify, payoff) and its `config` objects; §7.1–§7.3 below point
at those tables and give a 6-row sample whose archetype and skin ids are copied verbatim from them.

### 7.1 The Clockwork Crypt → "The Orrery Terraces" (trig)
- **Biome**: the Variant base palette almost 1:1 (cream stone, gold, navy, teal crystals, salmon trees); zones
  Sunward Terrace (day) → Crystal Stair (peach) → Warden's Dome (dusk violet, star map ceiling).
- **Story**: the astronomer's great orrery stopped; the rings of every gate froze out of phase. Restore the
  rhythms so starlight flows through the beams back to the chart. Guide: **Cog** (brass owl, gold emblem).
- **Instrument**: stacked graph cards in π units; the scrubber input is θ or t.

**Bindings**: see `10-game-trig.md` §5 (per-station write-ups) and §5.7 ("Summary: bindings at a glance") for the
complete, current table of all 6 encounters and §5.8 for their `config` objects. Trig happens to have exactly 6
stations, so the sample below is the full set; archetype/skin ids are copied verbatim from §5.7.

| Enc | Contraption (archetype / skin) | Layout | Verify | Payoff |
|---|---|---|---|---|
| e1_radians | Vesper Dial (`emitter_rail` / `vesper_dial`) | scrub | ALIGN THE DIAL | terrain: spoke stair rises |
| e2_period | Tidewheel Gate (`ring_gate` / `ring_gate`) | scrub | LOCK THE RINGS | blocker removed: door opens |
| e3_amplitude | Echo Choir (`claim_holders` / `resonance_pillars`) | board | EXPOSE THE MIMIC | ride: Echo Lift rises |
| e4_solve | Solving Span (`step_bridge` / `floating_steps`) | board | LAY THE SPAN | terrain: bridge forms over the gap |
| e5_period_review | Chime Treasury (`claim_holders` / `treasury_pillars`) | board | EXPOSE THE MIMIC | terrain: rim stair rises |
| e6_boss | Warden's Shield (`pendulum_sync` / `wardens_shield`) | scrub | MATCH THE RHYTHM | blocker removed: door opens → finale |

### 7.2 The Membrane Vault → "The Living Gate" (cell transport)
- **Biome**: inside a cell rendered as ancient tech: the **membrane is a colonnade** of phospholipid pillars
  (cream spherical heads = `stone.lit`, twin gold tails = `gold.base`), transport proteins are **ring gates**
  set in the colonnade, cytoplasm is aqua water-light, organelles are distant salmon/coral domes. Zones: Outer
  Shore (extracellular, bright aqua) → the Colonnade (membrane) → the Pump Hall (warm, ATP-gold glow) → the
  Nucleus Vault.
- **Story**: the crew's submarine is shrunk and stranded outside a cell whose gates have seized; restore each
  gate by showing what crosses, how, and at what cost; reach the nucleus. Guide: **Pilot Ora** (aqua emblem,
  mini-sub drone).
- **Instrument**: **gradient card** (bars for inside vs outside concentration, arrow of net flow),
  **energy card** (the `energy_cells` ATP gauge in **gold**, not `ui.accent`: orange is reserved for player input;
  `11-game-cell-transport.md` §2.2), and item lists; the scrubber (where used) is concentration.

**Bindings**: see `11-game-cell-transport.md` §5 for the full write-up of all 11 encounters (§5.0–§5.11). The
sample below is one station per distinct contraption archetype the game uses (`claim_holders` reuses the same
skin for e1/e3/e4/e7; `sluice_waves`/`tonicity_sluices` reuses for e9), plus the boss, with archetype/skin ids
copied verbatim from that doc's `config` blocks.

| Enc | Contraption (archetype / skin) | Layout | Live world |
|---|---|---|---|
| e1_bilayer | Specimen Pods (`claim_holders` / `specimen_pods`) | scrub | aim → the chosen pod's sim plays (reused for e3/e4/e7) |
| e2_selectivity | Membrane Router (`router_lanes` / `membrane_router`) | board | assign → each molecule animates its route |
| e5_tonicity | Tonicity Sluices (`sluice_waves` / `tonicity_sluices`) | scrub + waves | label → the cell's fate plays live at its lock (reused for e9) |
| e8_pump | Pump Rewiring (`stage_machine` / `pump_rewiring`) | scrub | link → the drums preview the cycle |
| e10_bulk | Endocytosis Lift (`step_bridge` / `endocytosis_lift`) | scrub + plank rail | order → each step animates the membrane fold |
| e11_boss | The Gatekeeper (`router_lanes` / `gatekeeper_maws`) | board | sort → each item enters its maw with its route |

### 7.3 The 1965 Files → "The Archive of Voices" (civil rights history)
- **Biome**: a rain-washed dusk city of archives (the violet/pink palette of 6.png): brick and cream stone
  stacks, brass pneumatic tubes, printing presses, street lamps, puddle reflections. Zones: eight scenes, S1 The Morgue (the intro and hub) → S2 Courthouse Square → … → S8
  the Morgue Stacks and the Editor's Vault (`12-game-civil-rights.md` §2.6).
- **Story**: the retired editor sealed the story of how the movement won its laws; the archive's machines only
  reassemble it for someone who reads dates, follows causes and weighs sources. Guide: **Ida the Archivist**
  (salmon-ringed emblem; her companion is **Wick**, a lantern).
- **Sensitivity rules (non-negotiable)**: real people and events are shown through **documents, photographs as
  framed silhouettes, headlines and quotations**, never as game sprites, caricatures or playable violence.
  No "boss fight" against historical actors; the antagonist is the sealed archive itself. Violence is referenced
  in text and in the dated headline, not animated.
- **Instrument**: a **timeline card** (x-axis = years 1954–1966, labelled ticks; the orange scrubber is a
  **year cursor**), a **document card**, and a **cause-graph card** (nodes and arrows).

**Bindings**: see `12-game-civil-rights.md` §5 for the full write-up of all 12 encounters (§5.1–§5.12) and §5.13
for the complete binding table. The sample below is one station per distinct contraption archetype (`claim_holders`
reuses for e4 with a different aimer; `step_bridge` reuses for e9; `router_lanes` reuses for e10), plus the boss;
it omits `cause_tubes` (e5/e6/e11) to keep the sample at 6 rows — see §5.13 for those. Archetype/skin ids are
copied verbatim from that doc.

| Enc | Contraption (archetype / skin) | Layout | Live world |
|---|---|---|---|
| e1_brown | Witness Projector (`claim_holders` / `witness_projector`) | scrub | aim → the beam lifts the chosen proof's type (reused for e4) |
| e2_montgomery | Walking Road (`step_bridge` / `walking_road`) | board | slots → slabs rise from the water (reused for e9 as Timeline Bridge) |
| e3_little_rock | Wire Ticker (`oracle_ticker` / `wire_ticker`) | scrub | pick → the tape prints the reveal |
| e7_march | Switchboard (`switchboard` / `switchboard`) | board | link → jack lamps turn cyan, the document prints |
| e8_cra | Filing Cabinets (`router_lanes` / `filing_cabinets`) | board | file → each document flies into its drawer (reused for e10 as Provenance Drawers) |
| e12_boss | Editor's Vault (`tumbler_vault` / `tumbler_vault`) | vault | eliminate → tumblers align, the door opens |

---

## 8 · Generalization: the contraption library (for PDF-generated games)

The pipeline must be able to produce §7-level games for any upload. **Superseded for implementation by
`20-expedition-architecture.md` §4 (the contraption library) and §6 (the World Writer); this section stays the
pitch-level rationale, not the contract.** The design splits cleanly:

1. **Contraption archetypes** (code, hand-built, reusable): 20 §4 defines the 13 demo archetypes, keyed by
   `familyId.mode`. Each archetype declares its *skin slots* (nouns, colours, SVG part set per biome) and a
   `pose(input)` function. The old mode → archetype table that used to live here is retired; 20 §4's table
   (with status, layout and skins per archetype) is the current one.
2. **Biome kits** (art, hand-built): the three showcase kits (orrery terraces, living cell, archive of voices)
   plus `shared`; see 20 §6.4 (`src/world/biomes.ts`) for the kit shape and ranking used by generalized games.
3. **World overlay**: 20 §6 ("Generalization: the World Writer (S7.5) and `autoWorld`") is the implemented
   contract — a single FAST LLM call (`worldWriterSchema`) that writes biome id, guide, zone names, and per
   encounter the contraption/skin choice (from the dynamic enum of archetypes that support its mode), object
   nouns, instruction/insight/success lines and misconception probes, while code derives geometry, traversal
   links, parallax, props, cutscenes and plaques. It lives in `src/contracts/slices.ts` (`WorldSlice`), not as a
   bible proposal.

Rule for new archetypes: it must satisfy all five parts of §4 (console, control, live link, verify, payoff)
and pass the checklist in §9.

---

## 9 · Fidelity checklist (score each 0 / 1; target ≥ 39 / 44 per game, all ★ items mandatory)

Score from a 1920×1080 screenshot or short capture of each showcase game. "Panel" = the instrument panel.

### A · World art
1. ★ **Painterly parallax**: at least 5 distinct depth layers visible (sky, far, mid-far, mid, play; +
   foreground). *Pass*: moving the camera shows at least 4 layers scrolling at different rates.
2. ★ **No 1-bit tiles** on any showcase screen. *Pass*: no Kenney 1-bit sprite visible.
3. **Sky is a gradient** with ≥ 3 stops and matches the biome table. *Pass*: no flat-colour sky.
4. **Architecture vocabulary**: circles/rings, gold trim, inlay bands and pillars appear in every play screen.
   *Pass*: ≥ 3 of those motifs in frame.
5. **Soft lighting**: shadows are coloured and blurred, never pure black; darkest world pixel ≥ `#1E2A33`.
6. **Glow = live**: only interactive/powered parts glow; dormant machines are desaturated. *Pass*: an
   unsolved contraption visibly desaturated; a solved one saturated.
7. **Foreground framing**: an L5 element (grass, fence, foliage) crosses the bottom edge in ≥ 50 % of frames,
   without covering the contraption.
8. **Biome identity**: the three games are distinguishable from a thumbnail by palette and silhouettes
   alone (terraces / colonnade / archive city).

### B · Characters and story
9. ★ **Protagonist** is an articulated character (not a tile) at 14–18 % of screen height, with walk, idle and
   interact animations. *Pass*: limbs move while walking.
10. **Scale ladder**: the zone's hub machine is ≥ 4× protagonist height; consoles ≈ 0.7×.
11. ★ **Guide presence**: the guide's emblem appears in the dialogue bar and a companion is visible near the
    player in explore mode.
12. **Purpose on screen**: the objective ring (top-left) shows restoration progress for the zone. *Pass*: it
    fills after each solved contraption.
13. **Story beats**: every encounter has an instruction line and a success/insight line written in world terms
    (names the object, not "answer the question").
14. **Sensitivity** (history only): no real person rendered as a sprite; events shown as documents, headlines
    or silhouettes.

### C · Instrument panel
15. ★ **World stays visible**: in scrub and board modes the world occupies ≥ 45 % of the width, undimmed.
16. **Panel material**: dark-teal translucent panel with hex-grid texture and backdrop blur.
17. **Circuit-trace lines**: frame lines terminate in hollow circles/dots (≥ 3 terminals visible).
18. ★ **Graph cards** (math; timeline/gauge cards for the others): bordered card, corner label tab
    (f(x)/g(x)/h(x) or named), labelled ticks on both axes, grid with major/minor lines.
19. **Axis units**: tick labels use the subject's unit (π for trig; %/mM for concentration; years for history).
20. **Function colours**: f white, g green, h blue (or the card's assigned colour), used consistently in panel
    and world chips.
21. ★ **Orange input scrubber**: one vertical orange line through all stacked cards with a teardrop knob on a
    labelled ruler, plus an orange input tab and numeric readout. *Pass*: dragging it moves the line across
    all cards at once.
22. **Value chips** ride the card's left edge at the current value's height and show units ("0.83π", "−2.4").
23. **Back arrow** tab top-left of the panel returns to explore without grading.
24. **Verify button** is named for the machine ("VERIFY GATE"), flanked by dot-ended trace lines, disabled
    until the input is complete.
25. **Success badge** in the panel ("GATE ALIGNED", "PATCH SUCCESSFUL") with bracket connectors.
26. **Board-mode tokens** (orbs/cards/documents) come from a palette column and snap to targets; keyboard
    operable.

### D · Dialogue bar
27. ★ **Bar anatomy**: bottom band with guide emblem (concentric broken rings), info "i" button below it,
    and text to the right. *Pass*: all three present.
28. **Sentence style**: ≤ 2 lines; instruction is imperative and names the world object; insight is a single
    declarative truth.
29. **Legibility**: dialogue text ≥ 28 px at 1920 w, white on panel, contrast ≥ 7:1.

### E · Live link and payoff
30. ★ **Live reaction**: a world object moves continuously while the control is dragged (not only on
    Verify). *Pass*: a capture shows ≥ 3 intermediate poses.
31. **World chips and pins**: the driven object carries a chip with the live value; the target carries a pin.
32. **Eased physicality**: world objects ease toward the panel value (visible lag ≤ 0.4 s), no teleporting.
33. **Partial feedback**: a wrong value produces a visibly *near/far* state (beam misses by a distance,
    notches misaligned by an angle, lane bounce) plus informative text that never states the answer.
34. ★ **In-world success animation** of the contraption itself (rings spin open, bridge locks, pump cycles)
    lasting 1.2–2.5 s, with sound hook.
35. ★ **Payoff is traversal**: after success the player uses what they built (walks through the doorway,
    climbs the stair, crosses the bridge, rides the vesicle/tram). *Pass*: the next area is physically
    reachable only through it.
36. **Visible misconception**: each encounter's `targetMisconception` has a world state that shows it failing
    (e.g. doubling the period makes the rings overshoot by a half turn).

### F · Game feel
37. **Traversal variety**: ≥ 2 non-walk verbs per zone (hop, climb, ride, timed hop, sandbox/quest touch),
    beyond the payoff itself. *Pass*: the zone's traversal beat sheet lists 2 distinct verbs and both are
    reachable in play.
38. ★ **Orange input moves the world**: the orange scrubber/control drives a visible world object in every
    encounter, not only the panel. *Pass*: no encounter's live link is "panel-only".
39. **Boss staging**: the boss is staged: arena, taunts, phases or real-time motion. *Pass*: a boss frame showing
    staged presentation (an arena, a phase change or continuous real-time motion) plus a fail-taunt capture.
40. ★ **Hints act in the world**: taking a hint moves or points the guide/companion at the relevant part, not
    only a text panel. *Pass*: the companion's position or pose visibly changes when a hint is opened.
41. **Fast first reaction**: the first visible world change after an input arrives within 150 ms of the input
    event. *Pass*: a frame-stamped capture shows the driven object begins moving within 150 ms.
42. ★ **Payoff is used, not shown**: every contraption's payoff opens a path the player then actually
    traverses, not just an animation. *Pass*: the next station is reachable only through what was just built.
43. **Explore never silent**: while walking in explore mode, no gap exceeds 20 s without a trigger line
    (ambient, guide or NPC). *Pass*: a 20 s walking capture contains at least one line.
44. **Sandbox/quest touch**: every zone has at least one sandbox interactable or quest step that carries no
    grading. *Pass*: one such touch is reachable per zone.

**Scoring note.** Items 1, 2, 9, 11, 15, 18, 21, 27, 30, 34, 35, 38, 40, 42 are ★ (14 mandatory). A game that
fails any ★ item is not at Variant fidelity regardless of score. Target ≥ 39/44 per game, all ★ items passing.

---

## 10 · Anti-goals
- No modal quiz that hides the world (except the rare Vault mode, and even there the room shows around it).
- No "Correct!" / "Wrong!" toasts; the machine says it.
- No walking corridor whose only verb is A/D; every zone has at least one vertical move built by a puzzle.
- No orange on world surfaces except bound values; no pure black; no tile grids.
- No trivia framing ("Question 3 of 12"). Progress is the objective ring and restored beams.

---

## 11 · Scoring protocol (for the fidelity critic)

**Inputs.**
- Screenshots per scene at **1920×1080**, captured in three states: **explore** (mid-walk, panel closed),
  **scrub/board** (panel open, control mid-drag, so the live link is visible), and **payoff** (the moment right
  after Verify succeeds, badge or success animation on screen).
- A short **description of a 10-second clip** from the e2e run (not the raw video), covering one full
  console-to-payoff loop: what the player did, what moved, and how long the first visible reaction took.

**Output.** A single JSON object:
```json
{
  "items": [ { "id": 1, "pass": true, "evidence": "…" }, ... ],
  "score": 0,
  "mandatoryFails": []
}
```
- `items`: one entry per checklist item (1–44), `id` matching the checklist number, `pass` a boolean, and
  `evidence` a one-line pointer to the specific screenshot/state or clip moment that justified the call (never
  a restatement of the checklist text).
- `score`: the count of `pass: true` items (out of 44).
- `mandatoryFails`: the `id`s of any ★ item (1, 2, 9, 11, 15, 18, 21, 27, 30, 34, 35, 38, 40, 42) that failed;
  empty if none did. A non-empty `mandatoryFails` means the game is not at Variant fidelity regardless of `score`.
- The saved file (`20-expedition-architecture.md` §8.3) is this object plus `game`, `round`, `tier` and, per item,
  `shot`, `fix` and `ownerPath` (null when the item passes). That is the one score shape.

**Rule.** A screenshot taken with the instrument panel closed can never pass a **panel** item (15–26) or a
**dialogue bar** item (27–29): those items require the scrub/board (or vault) capture, and the critic marks
them `pass: false` with evidence `"panel not open"` rather than guessing from an explore-mode shot.

**P0 scoring rule.** Items 37 (traversal variety), 43 (explore never silent) and 44 (sandbox/quest touch) are
scored on **zone 1 only** at P0: later zones' triggers, sandboxes and traversal beats are P1 work, so scoring them
game-wide before P1 lands would fail items that cannot yet pass. The P0 target is **all ★ items passing, plus
≥ 36/44**; the full-game target (all zones scored) stays ≥ 39/44 with all ★ items passing.
