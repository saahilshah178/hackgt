# 10 · Game Design Document: The Clockwork Crypt, "The Orrery Terraces" (trigonometry)

**Status:** revision 2 (2026-09-26, evening). Re-pointed at `20-expedition-architecture.md` revision 2 and
`02-assets-and-art-pipeline.md` (revised 2026-09-26). Where this document and 20 disagree on an API, a type, a key,
a layout width, an asset path or a coordinate convention, **20 wins**; this document is authoritative for content
(nouns, lines, poses, formulas, success timelines, traversal beats) and for the exact values the side-car
`fixtures/worlds/trig.world.json` carries.

| | |
|---|---|
| **Spec** | `fixtures/trig-dungeon.json` (`id: trig_demo_001`, `source.sourceId: src_trig_ch4`, genre `dungeon`). `fixtures/trig-platformer.json` (`trig_platformer_001`, "The Clockwork Run") carries the same six encounter ids, so one overlay serves both. |
| **Side-car** | `fixtures/worlds/trig.world.json` = `WorldFile {appliesTo: {specIds: ["trig_demo_001", "trig_platformer_001"], sources: [{sourceId: "src_trig_ch4", genre: "dungeon"}, {sourceId: "src_trig_ch4", genre: "platformer"}]}, world: WorldOverlay}` (20 §1.2). The fixture JSON is **never** edited. |
| **Biome / namespace** | `orrery_terraces`; art source `art/orrery_terraces/**`, output `public/assets/expedition/orrery_terraces/**` (20 §5.1) |
| **Guide** | `cog` (spec character 0, `cheerful_sidekick`); companion puppet `orrery_terraces.companion.cog` |
| **Boss** | `warden` (spec character 1, `gruff_guard`); station `e6_boss` carries `boss` staging |
| **Reads with** | 20 (contract, host, panel, library §4/§4.1/§4.2, art §5, waves §7), 02 (§3.0 naming, §3a kit, §3b rig, §4.1 trig P0 list), 01 (tokens, checklist), 30 (amendments 2, 19–22, 27, 28), mode sources `tuner/oscillator.ts`, `mapper/number_line.ts`, `truth_finder/mimic.ts`, `sequencer/linear.ts` |
| **Audience** | the 20 §7 lanes: C0 then C1 (trig side-car, palette, zone-1 heroes, landmarks), KA (metas/prefabs for `emitter_rail`, `ring_gate`, `pendulum_sync`, `claim_holders`, `step_bridge` and the other trig skins' heroes), A1/A2 (Wren atlas, kit layers and stand-ins), pipeline designers (§9); §0.5 lists who authors what |

**Conventions used throughout.**
- **H** is the protagonist's height: **170** design units (1 unit = 1 px of a 1080-px-tall view, bible §5.1).
- **Coordinates are per zone** (20 §1.3): x from the zone's left edge, y **down** from the zone's top edge. Every
  coordinate in this document is already converted; the conversion from the revision-1 cumulative coordinates is
  in §2.6.
- Angles are in radians. On-screen rotation is counter-clockwise-positive in the maths and flipped for screen space where noted.
- "Panel" is the React instrument panel (20 §3). "Bar" is the dialogue bar (20 §2.7). "World" is the Phaser side view.
- **f / g / h** colours follow the bible: f `#F5F8F8` white, g `#6FD98E` green, h `#4F92E6` blue. Orange `#E2892C` is reserved for player input (the Scrubber and probe).
- **Grading is always the mode's `grade()`.** Nothing here changes a mode's params, solution, tolerance or
  feedback. Contraptions visualize the draft and replay the verdict through `Diagnosis` (20 §2.5.4).
- **Priority tags:** **P0** ships for the 2026-09-27 demo, **P1** after P0 is green, **P2** polish (20 §0.1).

---

## CHANGELOG (revision 2)

| # | Change | Source | Sections |
|---|---|---|---|
| 1 | **New §0 "P0 demo cut":** zone 1 (`z1_sunward`) is the full-art zone with 16 hand-authored hero assets listed by key; `z2_crystal` and `z3_dome` run on kit layers + one hero landmark each; biome P0 hero count 37 (P1 39, P2 40, inside the one cap of 40, 20 §5.1); P1/P2 side content listed row by row. | 20 §0.1, amendment 12, task brief | §0 |
| 2 | **Coordinates converted to per-zone** (`z1_sunward` 8000 × 1600, `z2_crystal` 9600 × 2400, `z3_dome` 5400 × 1400) with the exact conversions of 20 §4.1. Ground heightfields, platforms, blockers and payoff terrain are now given as the `Zone.ground.points` / `Zone.platforms` / `Payoff.terrain` arrays. The "Jump 1.1 H / real colliders" movement table is replaced by the 20 §3.5 key map and §2.4 surfaces. | amendments 2, 20 | §2.6 |
| 3 | **New §2.7 traversal beat sheets:** every zone lists ≥ 2 non-walk verbs other than its payoffs as `Zone.links` entries (`hop`, `climb`, `drop`, `ladder`, `timed_hop`) with ends, surfaces and priorities, plus the sandbox and quest touches. The Rim Gantry is three `timed_hop` links (T = 1.5, 2.5, 3.0 s) with `missTo` pits and `ladder`s back up. | amendments 2, 17, 28 | §2.7 |
| 4 | **The e3/e5 probe moves the world** (`probeWorld: "trace_slate"`: the Tuning Lens projects the aimed claim's trace and a playhead at x onto the singer's chest slate; the bell hum pitch follows `|f(x)|`). **The e4 probe moves the world** (`probeWorld: "relief_marker"`: a plumb marker rides a `2 sin x` relief carved along the chasm lip; crossings with the `y = 1` water line glint). | amendment 27 | §5.3, §5.4, §5.5 |
| 5 | **Every station now has its exact `config` JSON** (parsed by the meta's `configSchema`, 20 §4.2), its `Station` record (`consoleX`, `anchor`, `skin`, `objectNoun`, `partNouns`, `pins`, `probes`, `panel`, `payoff`, `boss`), its `StationDialogue` slot map and its `hintTargets`. §5.8 indexes the six configs for copy-paste. | amendments 5, 8, 9, 10, 13 | §5.1–§5.8 |
| 6 | **Contraption names re-pointed:** Vesper Dial = `emitter_rail` / skin `vesper_dial`; Tidewheel Gate = `ring_gate` / `ring_gate`; Echo Choir = `claim_holders` / `resonance_pillars`; Solving Span = `step_bridge` / `floating_steps`; Chime Treasury = `claim_holders` / `treasury_pillars`; Warden's Shield = `pendulum_sync` / `wardens_shield`. Revision-1 names (`arc_rail`, `claim_choir`, `plank_span`, `echo_choir`, `LiveDraft`, `Verdict`, `playVerdict`, `onLive`, `isLockedPose`, `claimTraces`, `setDraft`) are retired; the mapping is in §5.0. | amendments 3, 4, 5, 11, 13 | §5.0, §9 |
| 7 | **Dialogue re-slotted to `StationDialogue`** (`approach`, `instruction`, `tutorial`, `insight`, `hints[3]`, `fail {default, byKey}`, `success`, `payoffLine`, `after`), boss lines to `BossStaging.taunts`, intro/finale/arena lines to `Cutscene` `say` steps, NPC lines to `Npc.states`, ambient lines to `triggers`. Every line now carries its `speakerId` (∈ `spec.characters` ∪ `cast.extras` ∪ {`narrator`}). Six new `insight` lines, three new `fail.default` lines, `e6.fail.any`, `lu.04`, `mb.03`, `h.dome` added; `e1.probe.fullturn`, `e4.fail.order`, `e4.hint2`, `e3.tutorial`, `intro.11` rewritten (quiz voice, ordering leak, stale keys); `u.back` dropped (no slot). All 133 lines ≤ 140 characters (§4.6 script). | amendments 1, 9, 34, 37 | §4 |
| 8 | **Cast re-pointed:** the non-spec speakers are `cast.extras` (`brasswick`, `lumen`, `quill`, `mimic`, `ilse`); the narrator is the built-in `narrator` speaker. Wren is the recoloured Kenney rig `shared.char.wren` with four costume overlays; the 18-part Wren puppet (A137–A154) is **post-demo**. | amendments 1, 19 | §3 |
| 9 | **Side content is data:** Brasswick's quest is `quests[brasswick_rhythm]` (P1), the Music Box is `sandboxes[music_box]` (P1, unlocked by `e5_period_review`; P2 by the three wisps), pages and wisps are `collectibles` (P2), ambient lines are `triggers`, the dome constellations and L1 beams are `story.progressEffects` (P1), the Orrery Map is `story.map` (P2). | amendments 15, 16, 17, 24 | §6 |
| 10 | **Art list re-keyed** to `orrery_terraces.<group>.<name>` (20 §5.1; part keys `orrery_terraces.part.<skin>_<slot>` per the 20 §4.3 art contract) and re-tagged `hero` / `kit:<generator>` / `rig` / `code` / `post_demo`. Legacy `A###` ids stay as a column for traceability. `{scale: devicePixelRatio}`, px pivots and "path-text" are retired: static engraving is `<text data-engrave>` converted at build time; every spec-derived label (rail landmarks, the Warden's equation, plaque titles, chips, pins) is DOM through `WorldLabelLayer`. | amendments 14, 21, 22 | §7 |
| 11 | **Fidelity mapping** updated for the rig, the 42vw/55vw panel geometry, the probe world bindings and the game-feel items 37–41. | amendment 29, 20 §3.1 | §8 |
| 12 | **Generalization** re-pointed at the World Writer (20 §6: `WorldSlice`, `writerConfigSchema`, `autoWorld`); the revision-1 proposed schema (§9.3) is superseded. | amendments 13, 39 | §9 |
| 13 | **Appendix A** is now a complete `Station` JSON for `e2_period` in the revised schema, plus the `z1_sunward` zone JSON. | — | Appendix A |

**Deliberate deviations from 20 (for 20's next revision to mirror; logged in `DECISIONS.md` by main):**
- 20 §4.1 lists "`drop` from the upper terrace at x 5250" for `z1_sunward`. The e1 spoke stair occupies x 5098–5400
  and the ground is single-valued there, so a same-x drop is not expressible. This document puts the z1 `drop` on
  the wisp ledge (x 3595) and keeps the terrace → court return on the spoke stair itself.
- 20 §4.1 names the z2 exit surface `rim_top`. This document merges the e5 rim stair into the ground heightfield,
  so the exit is `{x: 9590, surface: "ground"}`; no `rim_top` platform exists.
- 20 §4.3 `resonance_pillars` needs one extra slot, `faceplate` (kit `plate`), for the mimic's faceplate halves;
  `wardens_shield` folds the Warden's head and plinth into `warden_body` + a prop. See §7.

---

## 0 · P0 demo cut (2026-09-27)

### 0.1 What ships at P0 (mirrors 20 §0.1.2, trig column)

| Item | P0 content |
|---|---|
| Stations | all six playable natively (§5): `e1_radians` `emitter_rail`, `e2_period` `ring_gate`, `e3_amplitude` `claim_holders`, `e4_solve` `step_bridge`, `e5_period_review` `claim_holders`, `e6_boss` `pendulum_sync`. Fallback ladder step 3 (`console_slate`) only if an archetype misses P0 freeze. |
| Boss | `e6_boss.boss`: arena trigger x 3000, cutscene `e6_arena` (wake from the feet up, three lines), taunts on fail by key, common-start reset (`clock.resetOn: ["open", "settle"]`) |
| Intro | cutscene `intro`: gondola arrival → `control_until` walk to the pylon → `await_interact` "Wind Cog" → telescope pan (§4.3) |
| Finale | cutscene `finale`: Warden kneels (the e6 success plan) → walk through the Star Door → Ilse's star figure → `vista` `orrery_terraces.vista.canyon` pan down the canyon → outro lines (§4.5) |
| Full-art zone | `z1_sunward` (S0 Sunward Landing, S1 Vesper Court, S2 Tidewheel Gate) with the §5.6 finish stack |
| Kit zones + hero landmark | `z2_crystal`: kit layer sets `hall_peach`, `stair_peach` + hero landmark `orrery_terraces.prop.crystal_falls_cliff` (the Crystal Stair waterfall cliff). `z3_dome`: kit layer set `gantry_dusk` + hero landmark `orrery_terraces.layer.dome_interior` (the dome ribs and star band) and the Star Door (a `wardens_shield` part). Every station part those zones need is built (hero or kit, §7). |
| Traversal | host supports every link kind. `z1_sunward` authors `hop` ×4, `climb` ×1, `drop` ×1 (§2.7.1). Every payoff traversal in every zone (spoke stair, doorway, Echo Lift ride, span, rim stair, Star Door). |
| HUD | objective ring `RHYTHMS`, objective line, key legend, mute toggle, dialogue bar with emblems, (i) Brief sheet (Brief + Hints), journal = MasteryHud. No meter. |
| NPCs | Brasswick state `before` only (§6.5), Ilse's projection (finale). |
| Triggers | `s0_controls` only (teaches Space right before the first hop). |
| Sound | the 20 §2.12 synth cue bank; every cue id in §6.8 mapped |
| Express | `?express=1` end to end: ≈ 7 min with first-try solves |
| DOM fallback | static snapshots of the six skins + the full panel |

### 0.2 Zone 1 hero assets (hand-authored SVG, counted by `heroCount`; 16 of the ≤ 40 cap)

| # | Key | Legacy | Group / use | Notes |
|---|---|---|---|---|
| 1 | `orrery_terraces.layer.orrery_tower` | A11 | L1 landmark, all zones + the finale vista | stepped tower + dome cap, 520 × 900; the three rings are kit (`orrery_terraces.fx.orrery_ring_a/b/c`) |
| 2 | `orrery_terraces.prop.gondola` | A59 | S0 intro vehicle | the cable is kit `linkStrip cable` |
| 3 | `orrery_terraces.part.vesper_dial_disc` | A76 | e1 | 560 × 560, pivot `0.5,0.5` |
| 4 | `orrery_terraces.part.vesper_dial_carriage` | A78 | e1 | 90 × 70 |
| 5 | `orrery_terraces.part.vesper_dial_vesper_lens` | A83 | e1 (revealed by the success plan) | 120 × 120 |
| 6 | `orrery_terraces.part.ring_gate_gate_wall` | A85 | e2 | 900 × 760, anchors `doorway`, `ring_center` |
| 7 | `orrery_terraces.part.ring_gate_outer_ring` | A86 | e2 | 408 × 408, pivot `0.5,0.5` |
| 8 | `orrery_terraces.part.ring_gate_inner_disc` | A87 | e2 | 340 × 340, pivot `0.5,0.5` |
| 9 | `orrery_terraces.part.ring_gate_fin_l` | A88 | e2 | 120 × 360, pivot `1,1` |
| 10 | `orrery_terraces.part.ring_gate_fin_r` | A89 | e2 | the mirror of `fin_l` (authored as a copy under `transform="scale(-1,1)"`), pivot `0,1` |
| 11 | `orrery_terraces.companion.cog` | A155–A161 | guide puppet, all zones | one ≤ 8-part puppet file (02 §3b.5) |
| 12 | `orrery_terraces.costume.wren_hair_bun` | A138 | overlay on `head` | gold pin included |
| 13 | `orrery_terraces.costume.wren_scarf` | A141–A143 | overlay on `back`, `follow: spring`, `layer: behind` | knot + two tails |
| 14 | `orrery_terraces.costume.wren_staff` | A153 | overlay on `hand_r` | astrolabe ring spins on `cheer` |
| 15 | `orrery_terraces.costume.wren_satchel` | A152 | overlay on `back` | |
| 16 | `orrery_terraces.npc.brasswick` | A162–A165 | S1 NPC puppet | named anims `arm_short`, `arm_sync` |

Everything else in zone 1 is kit output (§7.2–§7.10 give the generator per key): the ten `sunward_day` layers,
the ground strip and underside, every decor prop (trees, bushes, crystals, pylons, lanterns, the canal, the
stepping stone, the ledge, the plaque post), and the kit slots of `vesper_dial` (`rail_ring`, `plumb_gauge`,
`slide_gauge`, `fog_band`, `spoke_ledge`, `console`) and `ring_gate` (`tally_wheel`, `pawl`, `canal`, `skiff`,
`console`). Wren's body is the rig atlas `shared.char.wren` (not a hero).

### 0.3 Kit zones: layers + one hero landmark (P0), and the heroes their stations need

| Zone | Kit layer sets | Hero landmark | Station heroes (P0) | P1 upgrade |
|---|---|---|---|---|
| `z2_crystal` (S3–S5) | `hall_peach`, `stair_peach` (§2.4) | `orrery_terraces.prop.crystal_falls_cliff` | `resonance_pillars_automaton_a`, `resonance_pillars_automaton_b`, `resonance_pillars_lens_pedestal`, `resonance_pillars_lens_head`, `resonance_pillars_mimic_crab`, `treasury_pillars_chest_body`, `treasury_pillars_chest_lid`, `floating_steps_glyph_isolate`, `floating_steps_glyph_reference`, `floating_steps_glyph_quadrants`, `floating_steps_glyph_solutions`, `floating_steps_glyph_arcsin` (13 with the landmark) | `resonance_pillars_automaton_c`, `npc.lumen`, full hero dressing (A3) |
| `z3_dome` (S6, S7) | `gantry_dusk`, `dome_interior` | `orrery_terraces.layer.dome_interior` | `wardens_shield_warden_body`, `wardens_shield_warden_arm`, `wardens_shield_shield`, `wardens_shield_visor`, `wardens_shield_star_door_l`, `wardens_shield_star_door_r`, `npc.ilse_stars` (8 with the landmark) | gantry pits + timed hops, dome hub star map |

All keys in this table are `orrery_terraces.part.*` unless they carry another group. **Biome hero count:** P0 = 16
+ 13 + 8 = **37**; P1 adds `automaton_c` and `npc.lumen` (39); P2 adds `npc.quill` (40). `art:build` fails above
`heroCap` 40 (02 §3a); the kit fallback of every hero key is declared in `biome.json` (20 §0.1.6 ladder step 1).

### 0.4 P1 and P2 side content

| Priority | Item | Data (this document) |
|---|---|---|
| P1 | Brasswick's quest: talk → `afterSeal e2_period` → return → Page 3 | `npcs[brasswick].states.after`, `quests[brasswick_rhythm]`, `collectibles[page_3]` (§6.5) |
| P1 | Astronomer's Music Box sandbox in the S5 grotto, `requires.solved = e5_period_review` | `sandboxes[music_box]` (§6.6) |
| P1 | `z2`/`z3` full hero art; Lumen puppet; `automaton_c` | §7, A3 |
| P1 | Traversal beat sheets in `z2_crystal` and `z3_dome` (W2 clean): plinth → lintel hops, lift-shaft ladder, lantern ledge, the gantry's three timed hops, pit ladders, the sighting-ledge climb | §2.7.2, §2.7.3 |
| P1 | Ambient triggers `s0_plaque`, `s0_telescope`, `s0_canal`, `s3_hall`, `g_gantry`, `g_miss_1..3`, `g_ledge`; Lumen states `tending`, `lit`, `falls` | §6.3, §6.5 |
| P1 | Progress effects: six L1 `beam_line`s to the Orrery tower; seven dome `hub_socket`s on the `z3_dome` hub | §6.1 |
| P1 | Console and lore plaques (`plaques[]`) and the gear-period plaques on the gantry | §6.3 |
| P2 | Orrery Map (`story.map`, M), JournalReader (J), pages 1, 2, 4, 5 and Quill's filing quest (`quests[quill_pages]`), Quill puppet | §6.2, §6.4 |
| P2 | Insight wisps ×3, `quests[wisps]`, the Music Box unlock switched to `requires.flag = wisps_all`, Lumen state `wisps` | §6.4, §6.6 |
| P2 | Sighting telescopes (touch props), the e6 "time × 0.5" toggle (`slowTimeToggle: true`), reduced-motion extras, debrief bonus lines | §6.7, §6.9 |
| post-demo | Wren's 18-part SVG puppet (A137–A154); dome constellation figures (A136) | §7.13 |

### 0.5 Who authors what (20 §7; the lane plan there is authoritative)

- **C0 (L9, T0 + 2 → 6):** `fixtures/worlds/trig.world.json` from this document, P0 first: `z1_sunward` complete
  (§2.6.1, §2.7.1 incl. the `s0_canal_in` drop, the `intro` cutscene, Brasswick `before`, trigger `s0_controls`), all
  six stations with their §5.1–§5.6 configs (on W0's stub prefabs until the KA lane lands them), `z2`/`z3`; and the
  palette `src/game/art/palettes/orrery_terraces.ts`.
- **C1 (L9, T0 + 6 → 15):** the zone-1 heroes (`vesper_dial` ×3, `ring_gate` ×5, orrery tower, gondola, the Cog
  puppet, Wren's 4 costumes, the Brasswick puppet) by T0 + 9 for Gate V; then `e6_arena`, `e3_lift_up`, `finale`,
  `z2_entry`, `z3_entry`, exits, extras and the landmarks (crystal falls cliff, dome interior, Ilse's star figure).
- **KA (L6):** the five trig archetypes and the skin heroes of `resonance_pillars`, `treasury_pillars`,
  `floating_steps`, `wardens_shield` (18 files). **A2 (L5):** the kit layer sets (`sunward_day` first) and every
  skin slot's kit entry. **A1 (L5):** the Wren atlas.
- **After P0 freeze:** Q1 (P1) and Q2 / U1 (P2), the §0.4 rows.

---

## 1 · Pitch and purpose

### 1.1 Pitch (3 sentences)

*The Orrery Terraces* is a painterly side-view adventure up a canyon temple where every gate, wheel, bridge and
guardian is driven by a sine wave. As Wren, a young courier with a brass sighting staff, travelling with Cog,
the astronomer's clockwork owl, you climb the terraces by setting the angles, periods and solution steps the
machines run on, and you watch each machine swing, lap and lock live as you tune it. Restore the six rhythms,
out-time the clockwork Warden and wake the Orrery before the evening star Vesper sets.

`story.logline` (≤ 200): "Wake the canyon's great sky-clock by reading the rhythms its machines run on, before
the evening star Vesper sets." `story.objective`: "Restore the orrery's starlight". `story.objectiveLabel`:
"RHYTHMS". `story.restoredNoun`: "rhythm". `title`: "The Orrery Terraces"; `subtitle`: "The Clockwork Crypt".

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

In art this is literal: dormant machines are desaturated by −40 % (bible §5.3; 20 §5.7 dormancy ColorMatrix).

### 1.3 What is at stake

Tonight Vesper, the evening star, rises. The Orrery can only be re-phased by setting the Star Chart into its
lens **under Vesper's light**. If the beam network isn't carrying starlight when Vesper sets, the groves go dark
until next year's rising. That means a year with no night light, no water on the upper terraces and no calendar.

### 1.4 What the player restores

There are **six Rhythm Seals**, one per encounter. Each restored seal:
1. repairs the machine in front of you, which becomes the path forward (its `payoff`);
2. sends a cyan beam up to the Orrery, visible in the far parallax layer (P1 `beam_line` progress effect);
3. re-saturates that machine and its restored props (`PropPlacement.restoredBy`).

By the end:
- the Tidewheels turn and the canals fill terrace by terrace;
- the crystal groves glow;
- the Orrery's rings spin;
- the dome's star map lights one constellation per seal (P1 `hub_socket`s).

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
- Every success is traversal: a stair, a doorway, a lift, a bridge, a stair again, a door (`Payoff`; W1 holds in `z1` and `z2`, and the `z3` Star Door is an accepted W1 warning, §5.7).
- Every failure is the machine visibly doing the wrong thing. It never punishes you and never tells you the answer.
- Every orange input moves a world object (game-feel item 38): the three scalar Scrubbers drive the machines; the three probes drive the lens playhead (e3, e5) and the relief marker (e4).

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
- a wave-crest canal edge;
- the `2 sin x` relief on the chasm lip (e4).

`BIOME_KITS.orrery_terraces` (20 §6.4) is this biome: domains math, physics, engineering, earth_space, cs;
`skinDefaults {aimer: "tuning_lens", quarantineAnim: "mimic_crab", bays: "floating"}`; vehicles `{lift:
"orrery_terraces.part.resonance_pillars_echo_lift", tram: null, vesicle: null}`; vista `orrery_terraces.vista.canyon`.

### 2.2 Palette adaptation (trig-specific tokens on top of the bible §2)

These tokens live in `src/game/art/palettes/orrery_terraces.ts` (20 §5.1; A1 owns it).

| Token | Hex | Use in this game |
|---|---|---|
| `orrery.beam` | `#6ED2F2` core `#FFFFFF` | starlight beams (bible `crystal.base`), network lines in L1 |
| `orrery.dormant` | ColorMatrix saturation −0.4, brightness −0.06 | every unsolved machine and its `restoredBy` props |
| `orrery.brass` | `#C99A4A` / hi `#EBC57A` / deep `#8E6428` | Cog, the Warden's joints, gauges (a warmer, more metallic sibling of `gold.base`) |
| `orrery.engrave` | `#B89C78` @ 70 % | engraved wave bands and static numerals on stone (= `stone.deep`) |
| `orrery.fog` | `#EDE6F2` @ 85 % → 0 | the fog band that hides Vesper's lens in S1 |
| `vesper.star` | `#FFF4D6` + glow `#F6D27A` | the evening star, the Star Chart, Ilse's star figure |
| `dome.violet` | `#5B4B8A` / `#7E6A9E` / `#B7A2D9` | dusk dome interior, far cliffs in zone 3 |
| `wisp.indigo` | `#6A6CF0` | insight wisps (bible) |
| Chip/pin/UI | bible §2.3 unchanged (`UI_TOKENS`) | the panel is identical in all three games |
| `char.wren.*` | skin `#A8714F` / `#8A5A3E`, hair `#2B2A33`, vest `inlay.navy`, tunic `stone.base`, trousers `#2F5A5E`, boots `#C69A6B`, strap `#8A5A3E` | the rig recolour map (02 §3b.4) |

### 2.3 Zones and time of day

The level is a climb from the canyon floor to the rim in three zones (20 §4.1). The sun sinks as you climb, so
colour temperature marks your progress (bible §5.3). Each zone is entered one at a time; the z2 → z3 transition is
a `vertical_up` exit with a vertical camera tween.

| Zone id | Name (`Zone.name`, HUD `<h1>`) | Scenes | width × height | Segments (`id` [x0, x1] → layer set) | Time | Sky stops (`Segment.sky.stops`, top → horizon) | Haze | Mood |
|---|---|---|---|---|---|---|---|---|
| `z1_sunward` | Sunward Terrace | S0, S1, S2 | 8000 × 1600 | `sunward_day` [0, 8000] → `sunward_day` | late morning | `0 #D8D4CF` · `0.45 #E8DCD2` · `1 #F4E7DA` | `#FFFFFF` 0.25 | calm, bright, pollen in the air |
| `z2_crystal` | Crystal Stair | S3, S4, S5 | 9600 × 2400 | `hall_peach` [0, 3200] → `hall_peach`; `stair_peach` [3200, 9600] → `stair_peach` | late afternoon | `0 #E9C9C0` · `0.5 #F2D8C8` · `1 #FAE9D8` | `#F6D3C3` 0.2 | warm, glittering, long shadows |
| `z3_dome` | The Warden's Dome | S6 (+ S7 finale) | 5400 × 1400 | `gantry_dusk` [0, 2400] → `gantry_dusk`; `dome_interior` [2400, 5400] → `dome_interior` | dusk | gantry: `0 #9E86D8` · `0.5 #C9A0DE` · `0.85 #F7C9B8` · `1 #F2B8D4`; dome: `0 #5B4B8A` · `0.6 #7E6A9E` · `1 #B7A2D9` | gantry `#F2B8D4` 0.3; dome `#B7A2D9` 0.2 | hushed, the first stars, Vesper low in the west |

`Segment.ambient` and weather per segment:

| Segment | `light` | `particles` · count | `shadowColor` | `grade` (sat, bright, hue) | `weather` | `music` |
|---|---|---|---|---|---|---|
| `sunward_day` | `day` | `pollen` · 12 | `#6E7F9A` | 0, 0, 0 | `clear` | `curious` |
| `hall_peach` | `peach` | `dust` · 20 | `#6E7F9A` | 0.05, 0, 0 | `clear` | `calm` |
| `stair_peach` | `peach` | `dust` · 20 | `#6E7F9A` | 0.05, 0, 0 | `mist` | `calm` |
| `gantry_dusk` | `dusk` | `stars` · 30 | `#5B4B8A` | 0, −0.04, 0 | `clear` | `tense` |
| `dome_interior` | `interior` | `motes` · 30 | `#5B4B8A` | −0.05, −0.06, 0 | `clear` | null (the arena sets `boss`) |

### 2.4 Parallax layers (per layer set; factors from bible §5.2)

Every layer is a `ParallaxLayer` (20 §1.3). Layers are kit output (`compose`/`scatter` strips, 2048 wide, tileable)
unless tagged **hero**. Raster size is `rasterScale × min(dpr, 1.5)` (20 §5.7): L1/L2/L5 `rasterScale` 0.75,
L3 1.0, clouds and glows 0.5 (02 §3.0). Shapes are described left to right as they tile.

**`sunward_day` (z1, P0 full art):**

| # | Key | depth | scrollFactor | y | repeatX | alpha / blend / blurPx / drift | Source |
|---|---|---|---|---|---|---|---|
| 1 | `orrery_terraces.layer.z1_clouds` | `L1_far` | 0.04 | 60 | true | 1 / normal / 0 / 6 | kit `cloudBand` lozenge |
| 2 | `orrery_terraces.layer.z1_mesa` | `L1_far` | 0.15 | 540 | true | 1 / normal / 0 / 0 | kit `ridgeBand` butte_fluted, haze 0.4 |
| 3 | `orrery_terraces.layer.orrery_tower` | `L1_far` | 0.15 | 260 | false | 1 / normal / 0 / 0 | **hero** |
| 4 | `orrery_terraces.layer.z1_aqueduct` | `L1_far` | 0.15 | 760 | true | 1 / normal / 0 / 0 | kit `arch` arcade, haze 0.35 |
| 5 | `orrery_terraces.layer.z1_crystal_field` | `L2_midfar` | 0.35 | 620 | true | 1 / normal / 0 / 0 | kit `scatter(crystalCluster)`, haze 0.2 |
| 6 | `orrery_terraces.layer.z1_canopy_ruins` | `L2_midfar` | 0.35 | 760 | true | 1 / normal / 0 / 0 | kit `compose(canopy blob_tree blue + salmon, arch buried, waterBand falls thin)` |
| 7 | `orrery_terraces.layer.z1_terrace_wall` | `L3_mid` | 0.6 | 700 | true | 1 / normal / 0 / 0 | kit `compose(ashlarWall band + cap + medallions, column ×6, canopy vine_drape)` |
| 8 | `orrery_terraces.layer.z1_fore` | `L5_fore` | 1.3 | 1380 | true | 0.7 / normal / 2 / 0 | kit `compose(railing navy_cap_wave, canopy bush, crystalCluster shard)` |
| 9 | `orrery_terraces.layer.z1_dapple` | `L6_light` | 1.0 | 0 | true | 0.25 / multiply / 0 / 4 | kit `grainTile` leaf_dapple |
| 10 | `orrery_terraces.layer.z1_godrays` | `L6_light` | 1.0 | 0 | true | 0.12 / add / 0 / 0 | kit `glowSprite` shaft |

**`hall_peach` (z2 [0, 3200], kit):** `z2_clouds` (L1 0.04), `z2_mesa` (L1 0.15, `#C9A99E`), `orrery_tower`
(L1 0.15, hero, shared with z1), `z2_crystal_field` (L2 0.35), `z2_colonnade` (L3 0.6: `compose(column ×6,
canopy vine_drape, arch round)`), `z2_fore` (L5 1.3), `z2_dapple` (L6 multiply 0.25).
**`stair_peach` (z2 [3200, 9600], kit):** `z2_clouds`, `z2_mesa`, `orrery_tower`, `z2_crystal_field`,
`z2_cliffwall` (L3 0.6: `ashlarWall` rounded + crystals), `z2_fore`, `z2_godrays` (L6 add 0.18). The hero landmark
`orrery_terraces.prop.crystal_falls_cliff` is a `PropPlacement` at x 7000, layer `L3_mid` (§2.6.2).
**`gantry_dusk` (z3 [0, 2400], kit):** `z3_stars` (L1 0.02, ≤ 140 baked points, 20 §2.11), `z3_mesa` (L1 0.15,
`#7E6A9E` with `#B7A2D9` rim light), `orrery_tower`, `z3_gantry_truss` (L3 0.6: `truss` gantry + `ringStack`
gears), `z3_fore` (L5 1.3).
**`dome_interior` (z3 [2400, 5400]):** `z3_stars` (L1 0.02), `orrery_terraces.layer.dome_interior` (L3 0.85,
**hero**, repeatX false), `z3_dome_fore` (L5 1.3: `column` stone ×2 + `crystalCluster` shard).

Prose for the painter (unchanged content, now per key):

**Sky (`Segment.sky`, drawn by code).**
- A 3-stop (4 in `gantry_dusk`) gradient per segment, with a 1 px dither.
- Two soft **cloud bands** (`*_clouds`): long horizontal lozenges, white at 35 % with lavender `#E6DDEA` undersides, drifting at 6 px/s and 9 px/s.
- In z3, a **star field** (`z3_stars`) fades in with top-down alpha 0 → 1 across the gantry.
- **Vesper** (`orrery_terraces.fx.vesper_star`) is a 14 px `vesper.star` point with a 90 px soft gold glow. It sits low over the western rim (screen right), visible from S5 on, and its glow pulses at 0.2 Hz.

**L1 · Far canyon (0.15).**
- Mesa silhouettes: flat-topped buttes with vertical fluting, in a single colour per zone (z1 `#8FA6A0`, z2 `#C9A99E`, z3 `#7E6A9E`) plus 40 % haze toward the sky.
- On the far right rim stands the **Orrery tower**: a stepped cream tower (3 tiers, navy bands) crowned by three tilted gold rings (ellipses at 20°, 35° and 50° tilt) around a dome cap. It is dormant (grey) until seals light it.
- **Beam lines** (P1 `beam_line` progress effects), one per restored seal, are drawn in code: three stacked lines from that scene's beam pylon up to the tower's crown, animated with a travelling bright dash.
- In z1 an aqueduct of 6 arches runs along the far cliffs.

**L2 · Mid-far (0.35).**
- **Crystal fields**: clusters of tall turquoise prismatic spires, each 3-tone (`crystal.hi` / `base` / `shade`) with lighter facets toward the upper-left sun, 20 % haze.
- **Tree masses**: rounded canopy blobs in `foliage.blue` `#5A95D6` / hi `#8CC0EE` alternating with `foliage.salmon` `#E48C5E` / hi `#F4AE80`.
- **Distant arch ruins**: cream arches with navy capitals, half-buried.
- A **thin far waterfall** with a mist puff at its base (z1, z2).

**L3 · Mid (0.6).**
- **Cliff walls** of stacked grey-teal blocks (`rock.base` `#5F7B7A`, lit tops `#8FA6A0`, shadowed undersides `#3F5857`) with crystal clusters growing from the cracks, as in 10.png.
- **Terrace retaining walls**: cream stone, a 14 px navy band 40 px below the cap, a gold cap line and round medallions every 320 px.
- **Colonnades** with salmon vines hanging from their lintels.
- A **main waterfall** in S5 (`orrery_terraces.fx.falls_main.a/.b`, kit `waterBand` falls, two scrolling bands) pouring over the hero cliff.
- In z3, the dome's inner wall (hero): ribs converging upward and a ceiling band with the unlit star map.

**Play plane (1.0).**
- Ground strips (`Zone.ground.surface`): cream polygon paving with a gold lip, teal grass edges overhanging the paving, sand paths and canal channels.
- Stairs, ledges, consoles, contraptions, NPCs, the player and pickups.
- Contact shadows under everything: a blurred ellipse, `#6E7F9A` at 30 % multiply.

**L5 · Foreground (1.3, 2 px blur, 70 % alpha, darker by 15 %).**
- Grass clumps, salmon and blue leaf clumps, a cream **balustrade** with a navy rail cap and wave-crest top, emblem posts, and a blurred crystal shard.
- At least one L5 element crosses the bottom edge in every scene. It never overlaps a station's `meta.footprint` or `frameBounds` (W3).

**L6 · Light.**
- A **leaf-dapple** multiply overlay (blue-grey, 25 %) drifting at 4 px/s in z1 and z2.
- **God rays**: additive shafts from the upper-left at 12 % in z1 and 18 % in z2.
- A dusk **vignette** at 20 % in z3 (finish stack, 20 §5.6).

### 2.5 Weather, particles and ambient motion

`Segment.ambient.particles` covers the counts in §2.3; the rest is prefab or `fx` motion.

| Zone | Particles | Ambient motion |
|---|---|---|
| z1 | **pollen motes** (`pollen` · 12): 16 px soft dots, `#FFF4D6` @ 60 %, drifting up-right at 10–20 px/s with sine wobble. **Salmon leaves** (`orrery_terraces.fx.leaf_salmon`): 3 alive, falling at 40 px/s with 0.6 Hz rotation wobble | L5 foliage sways ±2° at 0.3 Hz. Canal highlights scroll at 18 px/s. Cloud bands drift. Crystal glints: a random crystal gets a 0.4 s additive sparkle every 3–5 s |
| z2 | **crystal dust** (`dust` · 20): 4-point sparkles near crystal clusters, 1.2 s life. **Waterfall mist**: 4 mist sprites looping at the falls' base | Crystals hum. Lanterns on the Crystal Stair have flames whose height is `10 + 4·sin(2π·t/1.5)` px, a period-and-amplitude joke Lumen points out |
| z3 | **star motes** (`stars` · 30 on the gantry, `motes` · 30 in the dome): 1–3 px points rising slowly, `#FFFFFF` @ 50 %. **Fireflies**: 6 glow sprites on Lissajous paths `(sin 0.7t, sin 1.1t)` | Rim Gantry gears swing on visible periods (§2.7.3). The star field twinkles with 12 additive sprites re-positioned every 2 s (20 §2.11) |

Solved machines gain 2× crystal sparkles and a slow blue glow on the groves. Dormant scenes run particles at 50 %.

### 2.6 Zones, coordinates, surfaces and camera

**Conversion from revision-1 cumulative coordinates** (20 §4.1): `z1_sunward` `x = x_doc`, `y = y_doc − 1560`
(floor 3000 → 1440, upper terrace 2600 → 1040). `z2_crystal` `x = x_doc − 8000`, `y = y_doc − 700` (2600 → 1900,
2100 → 1400, 1500 → 800, 1100 → 400). `z3_dome` `x = x_doc − 17600`, `y = y_doc + 100` (1100 → 1200, the lower
walkway 1270 → 1370).

```
z1_sunward (8000 × 1600)                                      z2_crystal (9600 × 2400)                                   z3_dome (5400 × 1400)
                                                                                         rim 400 ─┤exit vertical_up→ │ gantry 1200 ═ gears ═══ dome 1200 [Star Door]
                                                                     treasury 800 ──┬──── rim stair (e5)             │ pits 1370 (P1)
 terrace 1040      ┌──── S2 Tidewheel Gate (e2) ──┤exit walk→ │ ledge 1400 ═══ chasm (e4 span) ═══ ┘ crystal stair
                   │ spoke stair (e1)                          │   ↑ Echo Lift (e3, +500)
 floor 1440 ── S0 ─┴── S1 Vesper Court ──                        │ hall 1900 ─ S3 Hall of Echoes ─┘
```

- **Walking:** A/D or ←/→ at 300 units/s, Shift runs at 460 (20 §2.4.1). Rises ≤ `ground.maxStepUp` (102 = 0.6 H)
  auto-step; higher rises block, which is how walls, ledges and pits are expressed. Descents are walked or dropped.
- **Blockers:** each station's `payoff.blocker.x` clamps the player until that station is solved; the prefab draws
  why (the fog-bound stair slots, the closed gate, the silent lift, the chasm, the retracted rim stair, the shield).
- **World state is derived from runner progress** (`progress.solvedIds`, fixes D3): on load, `warpTo`, `skipTo`
  or `autoSolve`, every solved station settles in `meta.solvedPose` and its payoff terrain is merged, with no animation.
- **Camera:** `Zone.camera` defaults (x deadzone 0.3, y deadzone 260, lerp 0.12, zoom 0.6–1.15) except
  `z2_crystal` `yDeadzone: 300`. When the panel opens, `frameFor(meta.frameBounds, safeRect, …, station.frameZoom)`
  frames the contraption in the visible world area (20 §3.1: scrub panel 42vw, board 55vw). `frameZoom` is `null`
  for all six stations.

#### 2.6.1 `z1_sunward`

| Field | Value |
|---|---|
| `ground.points` | `[[0,1440],[1780,1440],[1800,1287],[2118,1287],[2120,1590],[2378,1590],[2380,1287],[2560,1287],[2600,1440],[5380,1440],[5400,1040],[8000,1040]]` |
| `ground.surface` / `underside` / `maxStepUp` | `orrery_terraces.ground.paving` / `orrery_terraces.ground.terrace_underside` / 102 |
| `platforms` | `canal_stone` `[[2220,1300],[2280,1300]]` (asset `orrery_terraces.prop.stepping_stone`); `wisp_ledge` `[[3500,1270],[3600,1270]]` (asset `orrery_terraces.prop.ledge_cap`) |
| `links` | §2.7.1 |
| `exits` | `{id: "z1_to_z2", x: 7990, surface: "ground", toZoneId: "z2_crystal", toX: 60, toSurface: "ground", transition: "walk", requires: {solved: "e2_period"}, cutsceneId: null}` |
| `hub` | `null` (the Orrery tower is an L1 layer; z1's big machine is the Tidewheel wall, a station part) |
| `entry` / `entryCutsceneId` | `{x: 360, surface: "ground"}` / `null` (the `intro` covers it) |
| Scene spans | S0 [0, 3200] (raised plaza [1800, 2560], dry canal [2120, 2380]); S1 [3200, 5600] (floor 1440, the retaining wall at x 5390 rising 400 to the terrace); S2 [5600, 8000] (terrace 1040) |

#### 2.6.2 `z2_crystal`

| Field | Value |
|---|---|
| `ground.points` | `[[0,1900],[2878,1900],[2880,1400],[4198,1400],[4202,2380],[5098,2380],[5102,1400],[7298,1400],[7300,1314],[7378,1314],[7380,1229],[7458,1229],[7460,1143],[7538,1143],[7540,1057],[7618,1057],[7620,971],[7698,971],[7700,886],[7778,886],[7780,800],[9340,800],[9350,400],[9600,400]]` |
| `ground.surface` / `underside` | `orrery_terraces.ground.paving` / `orrery_terraces.ground.cliff_underside` |
| `platforms` (P1) | `hall_plinth` `[[1260,1790],[1340,1790]]` (asset `orrery_terraces.prop.statue_plinth`); `colonnade_lintel` `[[880,1560],[1240,1560]]` (asset `orrery_terraces.prop.colonnade_lintel`); `lantern_ledge` `[[6560,1250],[6680,1250]]` (asset `orrery_terraces.prop.ledge_cap`) |
| `exits` | `{id: "z2_to_z3", x: 9590, surface: "ground", toZoneId: "z3_dome", toX: 60, toSurface: "ground", transition: "vertical_up", requires: {solved: "e5_period_review"}, cutsceneId: null}` |
| `hub` | `null` |
| `entry` / `entryCutsceneId` | `{x: 60, surface: "ground"}` / `z2_entry` |
| Scene spans | S3 [0, 3200] (hall 1900; the Echo Lift at x 2800 rises to the ledge at 1400); S4 [3200, 6000] (ledge 1400, chasm [4200, 5100]); S5 [6000, 9600] (Crystal Stair [7300, 7780] rising 7 × 86 to the treasury at 800; the rim wall at x 9345 rising to 400) |

#### 2.6.3 `z3_dome`

| Field | Value |
|---|---|
| `ground.points` **P0** | `[[0,1200],[5400,1200]]` (the gantry walkway is flat; the gears swing as decor) |
| `ground.points` **P1** | `[[0,1200],[418,1200],[420,1370],[780,1370],[782,1200],[1018,1200],[1020,1370],[1380,1370],[1382,1200],[1618,1200],[1620,1370],[1980,1370],[1982,1200],[5400,1200]]` (three 1 H pits under the gears) |
| `ground.surface` / `underside` | `orrery_terraces.ground.dome_floor` / `orrery_terraces.ground.cliff_underside`; the gantry grate + rails are props `orrery_terraces.prop.gantry_walkway` along [0, 2400] (`L4_play`) |
| `platforms` (P1) | `sighting_ledge` `[[2120,1000],[2320,1000]]` (asset `orrery_terraces.prop.ledge_cap`) |
| `exits` | none (the Star Door leads into the `finale`) |
| `hub` (P1) | `{asset: "orrery_terraces.prop.dome_star_map", x: 3900, y: 60, depth: "L4_back", label: "The dome's star map", sockets: 7, restoredLine: {speakerId: "cog", text: "Every constellation's lit. She mapped each rhythm we fixed."}}` |
| `entry` / `entryCutsceneId` | `{x: 60, surface: "ground"}` / `z3_entry` |
| Scene spans | S6 gantry [0, 2400]; S6 dome [2400, 5400] (arena trigger x 3000, arena bounds [2400, 5400]) |

### 2.7 Traversal beat sheets (per zone, `Zone.links`)

Every zone offers **≥ 2 non-walk verbs other than its payoffs** (W2, game-feel item 37). Link ends name a surface
and an x inside that surface's span (R11); no link straddles an unsolved station's blocker without requiring it.
Keys (20 §3.5): Space hops (timed hops too), W/↑ climbs and ladders up, S/↓ drops and ladders down, E interacts.

#### 2.7.1 `z1_sunward` (P0: hop ×4, climb, drop ×2; payoff: the e1 spoke stair)

| Beat | x | Link (`id` · `kind`) | from → to | Params | Requires | Why it's there | Pri |
|---|---|---|---|---|---|---|---|
| 1 | 1760 | `s0_stepup` · `hop` | `{ground, 1760}` → `{ground, 1840}` | `apex: 120`, `twoWay: true` | — | the 0.9 H step-up onto the plaza teaches Space right after `s0_controls` fires | P0 |
| 2 | 2110 | `s0_stone_in` · `hop` | `{ground, 2110}` → `{canal_stone, 2240}` | `apex: 90`, `twoWay: true` | — | first stepping-stone hop across the dry canal | P0 |
| 3 | 2270 | `s0_stone_out` · `hop` | `{canal_stone, 2270}` → `{ground, 2400}` | `apex: 90`, `twoWay: true` | — | second hop to the far lip | P0 |
| 3b | 2110 | `s0_canal_in` · `drop` | `{ground, 2110}` → `{ground, 2200}` | — | — | the canal bank (x 2118–2120) is a sheer edge that blocks walking (20 §2.4.1, A8), so this is the way into the bed the rungs climb out of | P0 |
| 4 | 2365 | `s0_canal_rungs` · `climb` | `{ground, 2365}` → `{ground, 2392}` | `twoWay: true` | — | rusted rungs out of the canal bed (1590 → 1287) for anyone who walks in | P0 |
| 5 | 3440 | `s1_ledge_up` · `hop` | `{ground, 3440}` → `{wisp_ledge, 3520}` | `apex: 100`, `twoWay: false` | — | the 1 H ledge behind Brasswick's crystal tree (wisp 1 at P2) | P0 |
| 6 | 3595 | `s1_ledge_down` · `drop` | `{wisp_ledge, 3595}` → `{ground, 3625}` | — | — | back down beside Brasswick | P0 |
| 7 | 5098–5400 | payoff (not a link) | e1 `stairs_rise`: five spoke-ledges | `Payoff.terrain` (§5.1) | `e1_radians` | the only way up 400 to the terrace | P0 |
| 8 | 3700 | quest touch (P1) | talk to Brasswick, `afterSeal e2_period`, talk again | `quests[brasswick_rhythm]` | — | the walk back down the spoke stair | P1 |

Distinct non-walk link kinds at P0: `hop`, `climb`, `drop` (W2 clean).

#### 2.7.2 `z2_crystal` (P1; payoffs: the Echo Lift ride, the Solving Span, the rim stair)

| Beat | x | Link (`id` · `kind`) | from → to | Params | Requires | Why it's there | Pri |
|---|---|---|---|---|---|---|---|
| 1 | 1220 | `s3_plinth_up` · `hop` | `{ground, 1220}` → `{hall_plinth, 1290}` | `apex: 60`, `twoWay: true` | — | a statue plinth (110 high) in the colonnade hall | P1 |
| 2 | 1270 | `s3_lintel_up` · `hop` | `{hall_plinth, 1270}` → `{colonnade_lintel, 1220}` | `apex: 100`, `twoWay: false` | — | onto the colonnade lintel (wisp 2 at x 1000, P2) | P1 |
| 3 | 890 | `s3_lintel_down` · `drop` | `{colonnade_lintel, 890}` → `{ground, 870}` | — | — | back into the hall | P1 |
| 4 | 2800 | payoff (not a link) | e3 `lift_moves`: board the Echo Lift, cutscene `e3_lift_up` | `Payoff.rideCutsceneId` | `e3_amplitude` | +500 to the ledge | P0 |
| 5 | 2862 | `s3_shaft_ladder` · `ladder` | `{ground, 2862}` → `{ground, 2896}` | `asset: "orrery_terraces.prop.shaft_ladder"`, `twoWay: true` | `{solved: "e3_amplitude"}` | a maintenance ladder beside the lift shaft for return trips (Quill, the lintel) | P1 |
| 6 | 4198–5102 | payoff | e4 `bridge_forms` | `Payoff.terrain` (§5.4) | `e4_solve` | the only way across the chasm | P0 |
| 7 | 6520 | `s5_lantern_up` · `hop` | `{ground, 6520}` → `{lantern_ledge, 6600}` | `apex: 110`, `twoWay: false` | — | the ledge behind the third lantern (wisp 3 at P2) | P1 |
| 8 | 6670 | `s5_lantern_down` · `drop` | `{lantern_ledge, 6670}` → `{ground, 6700}` | — | — | down to Lumen | P1 |
| 9 | 7000 | sandbox | the Astronomer's Music Box in the grotto behind the falls | `sandboxes[music_box]` (§6.6) | `{solved: "e5_period_review"}` (P2: `{flag: "wisps_all"}`) | a return trip down the Crystal Stair | P1 |
| 10 | 9338–9600 | payoff | e5 `stairs_rise`: the rim stair | `Payoff.terrain` (§5.5) | `e5_period_review` | +400 to the rim exit | P0 |

Distinct non-walk link kinds at P1: `hop`, `drop`, `ladder`, plus the sandbox.

#### 2.7.3 `z3_dome` (P1; payoff: the Star Door)

The **Rim Gantry** is the idea folded in from `trig-platformer.json` ("a crumbling clockwork gantry racing along the
observatory's outer rim"). Each gear platform hangs from an arm whose x offset is `120·sin(2π(t / T + phase))`
(`timed_hop.driverPropId`, `amplitude: 120`); its period is written on a brass plaque beside the gap ("T = 1.5",
"T = 2.5", "T = 3"), so timing a hop literally means reading a period. **None of them is 4:** the gantry must not
give away the boss's answer. A mistimed hop lands in the 1 H pit (`missTo`) with a "!" emote and no damage; a
ladder leads back to the west lip. The open window is the cycle fraction at the press for which the gear is on the
near half of its swing 0.35 s later (`c' ∈ [0.6, 0.9)`, so `open = [0.6 − 0.35/T, 0.9 − 0.35/T)`).

| Beat | x | Link (`id` · `kind`) | from → to | Params | Requires | Pri |
|---|---|---|---|---|---|---|
| 1 | 400 | `g_gear_1` · `timed_hop` | `{ground, 400}` → `{ground, 800}` | `periodSec: 1.5`, `phase: 0`, `open: [0.367, 0.667]`, `missTo: {ground, 600}`, `driverPropId: "gantry_gear_1"`, `amplitude: 120` (window 0.45 s) | — | P1 |
| 2 | 440 | `g_pit_1_ladder` · `ladder` | `{ground, 440}` → `{ground, 412}` | `asset: "orrery_terraces.prop.gantry_ladder"`, `twoWay: true` | — | P1 |
| 3 | 1000 | `g_gear_2` · `timed_hop` | `{ground, 1000}` → `{ground, 1400}` | `periodSec: 2.5`, `phase: 0`, `open: [0.46, 0.76]`, `missTo: {ground, 1200}`, `driverPropId: "gantry_gear_2"`, `amplitude: 120` (window 0.75 s) | — | P1 |
| 4 | 1040 | `g_pit_2_ladder` · `ladder` | `{ground, 1040}` → `{ground, 1012}` | as beat 2 | — | P1 |
| 5 | 1600 | `g_gear_3` · `timed_hop` | `{ground, 1600}` → `{ground, 2000}` | `periodSec: 3.0`, `phase: 0`, `open: [0.483, 0.783]`, `missTo: {ground, 1800}`, `driverPropId: "gantry_gear_3"`, `amplitude: 120` (window 0.9 s) | — | P1 |
| 6 | 1640 | `g_pit_3_ladder` · `ladder` | `{ground, 1640}` → `{ground, 1612}` | as beat 2 | — | P1 |
| 7 | 2150 | `g_ledge_climb` · `climb` | `{ground, 2150}` → `{sighting_ledge, 2160}` | `twoWay: true` | — | P1 |
| 8 | 3000 | arena trigger | `boss.arenaTriggerX` → cutscene `e6_arena` | — | — | P0 |
| 9 | 4400 | payoff | e6 `door_opens`: the Star Door → `finale` | — | `e6_boss` | P0 |

Driver props (P1): `gantry_gear_1` x 600, `gantry_gear_2` x 1200, `gantry_gear_3` x 1800, all `asset:
"orrery_terraces.prop.gantry_gear"`, `y: 1150`, `layer: "L4_play"`. The sighting ledge carries the S6 telescope
(P2) and trigger `g_ledge` (`g.03`, "Look back: five beams on the Orrery…"). Distinct non-walk link kinds at P1:
`timed_hop`, `ladder`, `climb`. At P0 the pits and links are absent (§2.6.3), so the gantry is a flat walk.

### 2.8 Scenes (8)

Each scene lists its layout chunk(s) from `spec.layout.chunks` so the overlay maps 1:1 onto the fixture.
Coordinates are per zone.

#### S0 · Sunward Landing *(chunk `d_start`, `z1_sunward` x 0–3200, floor y 1440)*
- **Sees:** the canyon floor at late morning.
  - A cable-gondola platform (cream, gold rail) at x 200, where the intro gondola docks.
  - A turquoise canal (still, no flow) runs along the back of the play strip; a dry cross-channel cuts the path at x 2120–2380.
  - A blue crystal tree at x 900 and salmon trees at x 1500 and 2400.
  - At x 1000, a **Sighting Telescope** points at the far Orrery tower (P2 touch).
  - A dormant **beam pylon** `beam_pylon_s0` at **x 1500** (moved from 2800 so Cog is met before the first hop): a cream pylon, 3 H, with a grey orb socket.
- **Contraption:** none. It is the tutorial space.
- **NPCs:** **Cog**, wound down on the beam pylon's capital (the intro "wind the key" interaction).
- **Side content:** the **Plaque of the Measurers** at x 600 (P1, §6.3); **Journal Page 1** "The Builders' Measure" on a lectern by the gondola at x 300 (P2).
- **Traversal teach:** `s0_stepup` (0.9 H at x 1800) and the stepping stone across the dry canal (§2.7.1).
- **Exit:** walk right into S1.

#### S1 · Vesper Court *(chunk `d_altar_room`, `e1_radians`, `z1_sunward` x 3200–5600, floor 1440, upper terrace 1040)*
- **Sees:** a sunken court with a **huge upright stone dial**, the Vesper Dial (3.3 H diameter, centre (4800, 1140)), set into a cream retaining wall.
  - A gold rail rings the dial.
  - The **upper terrace** runs behind and above it; its lip is 400 higher at x 5400, and nothing on the ground reaches it.
  - A **fog band** (`orrery.fog`) hangs across the canyon rim above and to the upper-left of the dial.
  - The console stands at x 4300, left of the dial.
  - **Brasswick**, a gardener automaton, waters a crystal tree at x 3700 with an arm that swings in and out on a period that is visibly too short (anim `arm_short`).
- **Contraption:** **Vesper Dial** (§5.1).
- **NPCs:** Brasswick (quest §6.5), plus Cog.
- **Side content:** the wisp ledge behind the crystal tree (§2.7.1; **Insight Wisp 1** at P2); **Journal Page 2** "Vesper's Bearing" on the upper terrace after the stair forms (P2).
- **Payoff:** the dial rotates and five gold **spoke-ledges** slide out of its rim into a stair up to the terrace (§5.1).

#### S2 · The Tidewheel Gate *(chunk `d_door_room_a`, `e2_period`, `z1_sunward` x 5600–8000, terrace 1040)*
- **Sees:** an upper terrace with a dry canal leading to a massive **ring gate** centred at x 7400.
  - The gate is set in a cream-and-gold wall with vertical navy grooves (the 5.png wall).
  - A **counterweight** hangs on a bronze track beside the gate.
  - The dry canal bed runs under the gate.
  - A **tally wheel** sits above the gate's keystone fin.
  - The console stands at x 6900.
  - Salmon trees behind the wall; the blue grove visible over it.
- **Contraption:** **Tidewheel Gate** (§5.2).
- **NPCs:** Cog. Brasswick's state changes when the water returns (he is visible back in S1).
- **Side content:** **Journal Page 3** "The Tidewheel Log", given by Brasswick after e2 (P1 quest; the player walks back down the spoke stair; it's a short trip).
- **Payoff:**
  - The ring laps once and the notch locks at 6 o'clock, which opens a 0.9 H × 1.3 H doorway.
  - The keystone fin splits and water floods through into the canal.
  - A floating **canal skiff** now bobs in the doorway canal. The player walks through the doorway along the canal edge; the skiff is scenery that rides alongside.

#### S3 · Hall of Echoes *(chunks `d_hall` + `d_treasury`, `e3_amplitude`, `z2_crystal` x 0–3200, hall 1900 → ledge 1400)*
- **Sees:** the light turns peach.
  - A long colonnade hall (L3 colonnade with hanging salmon vines) opens into a round court.
  - Three **Echo Automata** stand there: bell-chested choir automata on low plinths, about 2.5 H tall, at x 1580, 2000 and 2420. Each has a brass plaque and a small slate on its chest.
  - A **Tuning Lens** pedestal emitter sits in front of them at (2000, 1880).
  - The **Echo Lift**, a brass platform on chains, sits at x 2800, the court's right end. Its gear is jammed and the platform rests on the floor. The ledge above (y 1400) is out of reach.
  - **Quill**, a scribe-beetle, sits on a stack of stone tablets at x 600 (P2).
- **Contraption:** **Echo Choir** (§5.3).
- **NPCs:** Quill (P2 collector quest); the **Mimic** (revealed on success).
- **Side content:** the plinth → lintel hops (§2.7.2, P1; **Insight Wisp 2** on the lintel at P2); Quill's lore line about Ilse.
- **Payoff:** the exposed mimic scuttles out of the gear housing and the lift rises. The player rides it up (1900 → 1400).

#### S4 · The Chasm of Two Answers *(chunk `d_door_room_b`, `e4_solve`, `z2_crystal` x 3200–6000, ledge 1400)*
- **Sees:** a cliff ledge ending at a **900-unit chasm** (x 4200–5100). Mist rises from below and blue crystal roots cling to both cliff edges.
  - Four elliptical **span sockets** float over the chasm, dormant, in a gentle arc.
  - On the far bank stand **two anchor pylons** (x 5250 and 5420) with dark beacon crystals. They carry pins **"x₁"** and **"x₂"**, which state that two anchors are needed.
  - A brass **plank cradle** holding five glyph stones stands beside the console at x 4000.
  - The near **chasm lip** carries a carved **relief**: the curve `2 sin x` in bronze inlay, with a turquoise **water line** at height 1 (§5.4).
  - Far below (L3), the Tidewheel canal's water now glints, a visible link to seal 2.
- **Contraption:** **Solving Span** (§5.4).
- **NPCs:** Cog.
- **Side content:** **Journal Page 4** "Two Doors", on the far bank beside pylon x₂ (P2, reachable only after crossing).
- **Payoff:** the span locks and both pylons ignite. The player walks across.

#### S5 · Crystal Stair and Chime Treasury *(chunks `d_hall` + `d_treasury`, `e5_period_review`, `z2_crystal` x 6000–9600, 1400 → 800 → rim 400)*
- **Sees:** a grand stair of built steps (0.5 H each, x 7300–7780) climbs up through a crystal grove, lit by **Lumen**'s lanterns.
  - A **waterfall** falls down the hero cliff at x 7000. Behind it is a grotto (the Music Box, P1).
  - At the top (floor 800) is the round **Chime Treasury**: three more Echo Automata in treasury livery (gold-leaf bells), a Tuning Lens, and a great **Treasury Chest** on a dais at x 9300.
  - Behind the dais, the **rim stair** is retracted into the cliff at x 9345. Its steps are visible as flush slots. The rim is 400 up.
  - Vesper appears low in the western sky from here on.
- **Contraption:** **Echo Choir, Treasury variant** (§5.5).
- **NPCs:** Lumen (P1 lamplighter at x 7150); the second Mimic.
- **Side content:** the lantern ledge (§2.7.2; **Insight Wisp 3** at P2); **Journal Page 5** "Reach and Rhythm" in the Treasury Chest (P2); the **grotto**: the Astronomer's Music Box (§6.6, P1).
- **Payoff:** the chest opens (the Warden's key-stone and, at P2, Page 5) and the rim stair slides out step by step. The player climbs to the rim.

#### S6 · Rim Gantry and the Warden's Dome *(chunk `d_boss_hall`, `e6_boss`, `z3_dome` x 0–5400, floor 1200)*
- **Sees:** the Rim Gantry first (x 0–2400): a brass-grate walkway with three swinging gear platforms (§2.7.3). At P0 the walkway is continuous and the gears swing overhead as decor; at P1 the gears span 1 H pits.
- Then the **Warden's Dome** (x 2400–5400), a cathedral-like dome interior at dusk with the unlit star map on its ceiling:
  - **The Warden**, a 5.5 H clockwork sentinel, stands at x 5150 before the **Star Door** (centre x 4700).
  - Its **shield**, 2.4 H across, swings left and right across the door on a pendulum arm, in real time.
  - At the console (x 3550) stands a gold **counter-pendulum** pylon (x 3700): the player's instrument.
- **Contraption:** **Warden's Shield** (§5.6).
- **NPCs:** the Warden (boss) and Cog.
- **Side content:** none in the arena, which keeps the focus. The gantry's sighting ledge (P1) has a view of the beams reaching the Orrery tower: the "sighting" moment before the boss.
- **Payoff:** the Warden kneels, the shield freezes open and the Star Door opens → `finale`.

#### S7 · The Orrery Wakes *(outro, no chunk; cutscene `finale`, §4.5)*
- **Sees:** a scripted sequence.
  - Wren walks through the Star Door under Vesper.
  - Ilse's recorded voice plays as a constellation-line projection (`npcs[ilse]`, shown as an outline of stars, never a portrait).
  - The `vista` `orrery_terraces.vista.canyon` pulls back and pans down the whole canyon: canals fill terrace by terrace, groves re-saturate and the dome's constellations light.
- The EndScreen follows (keep its `end-screen` test id and `<h1>`).

---

## 3 · Characters

### 3.1 Protagonist: Wren (courier-apprentice)

`cast.protagonist`:

```json
{ "name": "Wren",
  "look": { "atlas": "shared.char.wren", "scale": 1,
    "costume": [
      { "asset": "orrery_terraces.costume.wren_scarf",    "anchor": "back",   "dx": 0,   "dy": -6, "follow": "spring", "layer": "behind" },
      { "asset": "orrery_terraces.costume.wren_satchel",  "anchor": "back",   "dx": -8,  "dy": 20, "follow": "rigid",  "layer": "behind" },
      { "asset": "orrery_terraces.costume.wren_staff",    "anchor": "hand_r", "dx": 0,   "dy": -6, "follow": "rigid",  "layer": "front" },
      { "asset": "orrery_terraces.costume.wren_hair_bun", "anchor": "head",   "dx": 0,   "dy": -30, "follow": "rigid", "layer": "front" } ] } }
```

**Look (side view, 1 H = 170):**
- **Body:** slim; medium-brown skin (`#A8714F`, shade `#8A5A3E`); dark hair (`#2B2A33`) tied in a short high bun with a gold pin; large dark eyes.
- **Clothing:**
  - a cream tunic (`#F2E3C6`) under a navy vest (`inlay.navy` `#27466A`) with a gold buckle;
  - a long teal scarf (`#4FA3A0`, hi `#7CC7C0`) that trails 0.4 H behind in two tails (spring follow);
  - dark-teal trousers (`#2F5A5E`) and tan boots (`#C69A6B`);
  - a brown leather satchel (`#8A5A3E`) on the back hip.
- **Tool:** the **sighting staff**, a brass rod (`#C99A4A`) 1.1 H long carried diagonally, topped with a small astrolabe ring (two concentric gold rings). The ring glows cyan when a console is in range and spins on `cheer`.
- **Silhouette test:** the bun, the scarf tails and the diagonal staff must read at 1 H against the busy L3.

**Rig** (amendment 19, 20 §5.5, 02 §3b): the Kenney `toon-characters` **Female adventurer** vector sheet,
recoloured at build time with the `char.wren.*` fill map (§2.2) by `pnpm chars:build`, rendered to the HD atlas
`shared.char.wren` (192 × 256 frames) with per-frame anchors. The 18-part SVG puppet of revision 1 (A137–A154) is
**post-demo**. Animation map (revision-1 name → rig poses the host plays, 20 §2.2 `actors/protagonist.ts`):

| Revision-1 animation | Rig poses | Notes |
|---|---|---|
| `idle` | `idle` | breath via a 1.00 → 1.02 container scale; scarf tails sway through the spring follow |
| `walk` | `walk0–7` at 12 fps | staff bob via the `hand_r` anchor |
| `run` | `run0–2` at 14 fps | scarf fully horizontal (spring) |
| `jump` | `jump` (rising), `fall` (descending) | every `hop`/`timed_hop` arc; 6 % land squash + dust puff (`orrery_terraces.fx.dust_puff`) |
| `climb_step` | `climb0/1` at 8 fps | `climb` and `ladder` links; built stairs auto-step with `walk` |
| `interact` | `interact`, then `hold` while the panel is open | the staff reaches toward the console; the astrolabe ring glows |
| `think` | `think` | after a failed Verify (1.2 s) and while the Brief sheet is open |
| `celebrate` | `cheer0/1` | after every success badge; the staff's ring spins 2 turns with a cyan flash |
| `ride` | `idle` on the vehicle anchor | Echo Lift, gondola |
| `wind` | `switch0/1` | intro only, at the `await_interact` on the pylon |

**Voice:** Wren is **silent** (`player` never speaks) and expresses through animation plus `emote` steps (`!`, `?`,
`♪`). This keeps the bar for the guide's lessons and avoids a second voice.

### 3.2 Guide: Cog (the astronomer's brass owl)

`cast.guide`:

```json
{ "characterId": "cog",
  "emblem": { "glyph": "owl", "ring": "#D9A441", "accent": "#FFFFFF", "gaps": 2 },
  "portrait": null,
  "companion": { "asset": "orrery_terraces.companion.cog", "offset": [-40, -150], "lagSec": 0.35, "bobPx": 5 } }
```

**Look (0.35 H tall, hovers at Wren's shoulder):**
- **Body:** a round brass body (`orrery.brass`) with a **glass belly window** showing two turning gears (they spin faster when he talks).
- **Head:** two big round **lens eyes** (gold rims, cyan glass irises `#6ED2F2`, white catch-light) and ear tufts shaped as three gear teeth each.
- **Wings:** layered brass feather plates with a navy inlay stripe.
- **Feet:** small talons, tucked while flying.
- **Back:** a wind-up key.

**Puppet** (02 §3b.5, ≤ 8 parts: body, belly_gears, head, wing_l, wing_r, feet, key, eye_glow): `idle` bob ±5 at
1.6 Hz with wings ±18°; `talk` eye glow 0.4 → 0.9 and gears ×2 while his line types; `cue` arc-flies to
`meta.hintTargets(rung)` (600 ms), circles at r 60 twice, perches 1.5 s and returns (20 §2.2 `companion.ts`). The
intro **wind** is `cue` with the key spinning 3 turns.

**Personality:** fussy, warm and delighted by precision. He is proud of Ilse, fond of the machines and gently
funny ("Hoo!" as punctuation, no more than one owl joke per scene). He never gives the answer before the hint
ladder allows it. After every success he states the concept outright as a truth of the world (the `success` slot).

**Voice archetype:** `cheerful_sidekick` (fixture).

**Emblem (dialogue bar, 64 px):** three concentric **broken** rings (`gaps: 2`), outer gold `#D9A441`, inner
rings white; the centre glyph `owl` (two small filled circles). Drawn by `DialogueBar` from the `Emblem` data; no
asset file.

### 3.3 Minor NPCs and other speakers

`spec.characters` holds only `cog` and `warden`. Every other speaker is a `cast.extras` entry (amendment 1); the
narrator is the built-in `narrator` speaker. `cast.speakers` gives the Warden its emblem.

```json
"speakers": [
  { "characterId": "warden", "emblem": { "glyph": "slit", "ring": "#6E4A2E", "accent": "#6ED2F2", "gaps": 1 }, "portrait": null } ],
"extras": [
  { "id": "brasswick", "name": "Brasswick", "role": "gardener automaton",        "voiceArchetype": "nervous_scholar", "emblem": { "glyph": "leaf",  "ring": "#6FD98E", "accent": "#F5F8F8", "gaps": 1 }, "portrait": null },
  { "id": "lumen",     "name": "Lumen",     "role": "lamplighter automaton",     "voiceArchetype": "wise_mentor",     "emblem": { "glyph": "flame", "ring": "#D9A441", "accent": "#F6D27A", "gaps": 1 }, "portrait": null },
  { "id": "quill",     "name": "Quill",     "role": "scribe-beetle archivist",   "voiceArchetype": "narrator",        "emblem": { "glyph": "nib",   "ring": "#F5F8F8", "accent": "#27466A", "gaps": 2 }, "portrait": null },
  { "id": "mimic",     "name": "The Mimic", "role": "impostor in a choir shell", "voiceArchetype": "sly_villain",     "emblem": { "glyph": "crab",  "ring": "#C99A4A", "accent": "#6ED2F2", "gaps": 1 }, "portrait": null },
  { "id": "ilse",      "name": "Ilse Vantor", "role": "the astronomer (recorded)", "voiceArchetype": "wise_mentor",   "emblem": { "glyph": "star",  "ring": "#F6D27A", "accent": "#FFF4D6", "gaps": 0 }, "portrait": "orrery_terraces.npc.ilse_stars" } ]
```

| speakerId | Name | Role | Look (asset) | Voice | Emblem | Purpose | Pri |
|---|---|---|---|---|---|---|---|
| `warden` | The Warden | clockwork guardian of the chart (fixture, boss) | 5.5 H sentinel. Cream stone plates over brass joints. Domed helmet with a single horizontal visor slit glowing cyan. Column-like legs on a plinth. Right arm holds the pendulum shield. Desaturated until the arena trigger. Drawn by the `wardens_shield` prefab | `gruff_guard` | bronze ring, slit | boss; voices the amplitude trap | P0 |
| `brasswick` | Brasswick | gardener automaton (S1) | 0.9 H. Barrel body on treads, a copper watering can on a long jointed arm, a round head with one lens and a tiny straw-hat-shaped cap (cream). Moss on his shoulders. `orrery_terraces.npc.brasswick` | `nervous_scholar` | green, leaf | period-intuition quest; gives Page 3 | P0 (state `before`), P1 (quest) |
| `lumen` | Lumen | lamplighter automaton (S5) | 1.2 H, slender. A pole-arm with a flame hook; a head that is a glass lantern with a live flame (flame height is itself a sine). Navy coat plates. `orrery_terraces.npc.lumen` | `wise_mentor` | gold, flame | amplitude/period banter; points at the grotto | P1 |
| `quill` | Quill | scribe-beetle archivist (S3) | 0.3 H beetle with a lacquered navy shell, gold edge, and a quill feather held in its mandibles. Rides on the satchel once met (`follow: "satchel"`). `orrery_terraces.npc.quill` | `narrator` | white, nib | collects Journal Pages | P2 |
| `mimic` | The Mimic | impostors in choir shells (S3, S5) | revealed as 0.6 H clockwork crabs: brass shell, six thin legs, two stalk eyes (cyan), one oversized pincer shaped like a measuring caliper. Drawn by the `resonance_pillars` prefab (`mimic_crab`) | `sly_villain` | brass, crab | voices the misconception on exposure (`payoffLine`) | P0 |
| `ilse` | Ilse Vantor (recorded) | the astronomer, absent | only as a constellation-line figure in the finale (white star points joined by 1 px lines, `orrery_terraces.npc.ilse_stars`) and as handwriting on Journal Pages | `wise_mentor` | gold, star | outro closure | P0 |
| `narrator` | (narrator) | intro and outro cards | none (caption style, the title emblem) | built-in | — | frame | P0 |

R10 (sensitivity) does not apply (`orrery_terraces` is not a sensitive kit); every name is fictional.

---

## 4 · Story arc and dialogue

### 4.1 Structure

| Act | Zone | Encounters (fixture roles) | Dramatic function |
|---|---|---|---|
| Prologue | S0 (`z1_sunward`) | none | wake Cog, see the dark Orrery, learn to walk, hop and interact |
| **Act I · Teach** | `z1_sunward` (S1, S2) | `e1_radians` (teach), `e2_period` (teach) | learn the instruments: a single scrubber drives the world |
| **Act II · Teach + apply** | `z2_crystal` (S3, S4) | `e3_amplitude` (teach), `e4_solve` (teach) | compare waves, build procedures; first mimic, first bridge |
| **Act III · Review + Boss** | `z2_crystal` → `z3_dome` (S5, S6) | `e5_period_review` (review), `e6_boss` (boss) | recall the Tidewheel lesson under disguise, then face the guardian who combines period and amplitude |
| Epilogue | S7 (`finale`) | none | the world restored; Ilse's thanks; EndScreen |

**Escalation framing:** Cog names it the way Variant does, for example "This is the trickiest choir yet" or
"It trusts only one thing: timing".

### 4.2 Line format, slots and triggers

- Every line is at most **140 characters** (R9 error) and at most 24 words (R9 warning), at most 2 lines in the bar,
  typing at 45 cps (20 §2.7).
- Id convention: `<scene|enc>.<slot>`. Each line below is written
  `` `id` · `speakerId` · where it lives · "text" ``; `speakerId` ∈ {`cog`, `warden`} ∪ {`brasswick`, `lumen`,
  `quill`, `mimic`, `ilse`} ∪ {`narrator`}. Station slots use explicit ids; `null` (= the guide) is equivalent for
  Cog's slots.

| Where it lives | Schema field | When it shows (20 §2.7 station slot flow) |
|---|---|---|
| `approach` | `StationDialogue.approach[]` (WorldLine) | once, entering `approachRadius` (500) in explore; toast, story priority |
| `instruction` | `StationDialogue.instruction` | pinned line 1 while the panel is open; must contain `objectNoun` or a `partNouns` entry (R9) |
| `tutorial` | `StationDialogue.tutorial` | pinned line 2 on the **first** panel open only |
| `insight` | `StationDialogue.insight` | pinned line 2 on later opens: the pre-success, hint-free truth of the world (R8 applies) |
| `hints[0..2]` | `StationDialogue.hints` | (i) rung r → `hints[r − 1]`; the companion flies to `meta.hintTargets(r)`; the Brief sheet's Hints tab also shows the fixture `hints[]` verbatim |
| `fail.default` / `fail.byKey[key]` | `StationDialogue.fail` | after a failed Verify: key = `probeKeys[0] ?? nearMiss ?? failKey` (20 §2.5.4 `failLines`); line 2 shows `diagnosis.displayFeedback` |
| `boss.taunts.*` | `BossStaging.taunts` | e6 only: the Warden speaks first on a fail (`byKey[key] ?? fail[attempt % n]`) |
| `success` | `StationDialogue.success` | replaces the instruction when the badge shows: the concept stated outright (may state the answer) |
| `payoffLine` | `StationDialogue.payoffLine` | toast while the payoff animates (revision-1 `success2`, or the mimic's exposure line) |
| `after` | `StationDialogue.after[]` | explore, after the payoff |
| `cutscene <id>` | `Cutscene.steps[].say.lines` | intro, arena, finale |
| `trigger <id>` | `triggers[].lines` | ambient toasts / arrival lines (§6.3) |
| `npc <id>.<state>` | `npcs[].states[].lines` | E on the NPC in that state |
| `sandbox`, `quest reward`, `touch` | `sandboxes[].lines` / `.reward.lines`, `quests[].reward.lines`, `props[].touch.lines` | §6 |

- **Fixture lines are reused verbatim** and marked **(fixture)**: `narrative.intro[0]`, `outro[0]` and the three
  `beats`. The fixture's per-encounter `debriefLine` stays for the EndScreen debrief.
- **Answer leaks (R8, token-boundary matching).** Banned values per station: e1 `between` = "π/2 and π"; e2 `period`
  and `answer` = "π"; e3 `mimic` = the s1 statement text; e4 `first` = "Isolate the sine: sin(x) = 1/2"; e5 `mimic` =
  the s1 statement text; e6 `period` and `answer` = "4". They are errors in `approach`, `instruction`, `tutorial`,
  `insight`, `hints[0]`, `hints[1]`, every `fail` line, `pins[].text` and the boss taunts; `hints[2]`, `success`,
  `payoffLine` and `after` are exempt. Every line below was checked by hand against these token sequences (e.g.
  `e2.hint2`'s "2π" is one math-run token and never matches "π").

### 4.3 Intro cutscene (`intro`, ≈ 35 s, skippable; phase `intro`)

| Shot | Visual (camera, layers) | Duration | Step(s) | Line |
|---|---|---|---|---|
| 1 | The title card "The Orrery Terraces" / "The Clockwork Crypt" over the z1 sky, camera high on the rim | 3 s | `fade`, `title` | — |
| 2 | Slow pan down the canyon from the rim: the L1 Orrery tower is grey and its rings still; the L2 groves are desaturated; the canal is still | 6 s | `camera` (in_out_sine) | `intro.01`–`intro.03` |
| 3 | The gondola glides in on its cable from the left and docks at S0; Wren steps off | 5 s | `ride`, `say` | `intro.04` |
| 4 | The player has control: walk to the beam pylon (prompt "A / D · walk to the beam pylon"), then press E on it: the `wind` poses play, Cog's eyes flicker on and he flutters down | player-paced | `control_until`, `await_interact`, `set_state`, `emote` | `intro.05`–`intro.07` |
| 5 | Cog turns toward the far tower; the camera nudges to show it | 6 s | `pan`, `say`, `pan` | `intro.08`–`intro.10` |
| 6 | The HUD objective ring appears (0 of 2 in this zone); trigger `s0_controls` teaches Space just before the step-up | — | `station e1_radians wake` | `intro.11` (trigger) |

```json
{ "id": "intro", "skippable": true, "steps": [
  { "do": "enter_zone", "zoneId": "z1_sunward", "x": 360, "surface": "ground" },
  { "do": "walk", "actor": "companion", "toX": 1500 },
  { "do": "camera", "x": 7200, "y": 300, "zoom": 0.6, "ms": 0, "ease": "linear" },
  { "do": "fade", "to": "clear", "ms": 800 },
  { "do": "title", "text": "The Orrery Terraces", "sub": "The Clockwork Crypt", "ms": 3000 },
  { "do": "camera", "x": 1000, "y": 1100, "zoom": 1, "ms": 6000, "ease": "in_out_sine" },
  { "do": "say", "lines": ["@intro.01", "@intro.02", "@intro.03"] },
  { "do": "ride", "vehicle": "orrery_terraces.prop.gondola", "toZoneId": "z1_sunward", "toX": 360, "ms": 5000, "path": [[0, 1100], [220, 1440]] },
  { "do": "say", "lines": ["@intro.04"] },
  { "do": "control_until", "x": 1400, "surface": "ground", "prompt": "A / D · walk to the beam pylon", "timeoutMs": 20000 },
  { "do": "await_interact", "target": { "kind": "prop", "id": "beam_pylon_s0" }, "prompt": "Wind Cog", "timeoutMs": null },
  { "do": "sfx", "cue": "cog_wind" },
  { "do": "set_state", "target": { "kind": "flag", "id": "cog_awake" }, "state": "on" },
  { "do": "emote", "actor": "companion", "glyph": "!" },
  { "do": "say", "lines": ["@intro.05", "@intro.06", "@intro.07"] },
  { "do": "pan", "x": 5200, "y": 700, "zoom": 0.8, "ms": 2500 },
  { "do": "say", "lines": ["@intro.08", "@intro.09", "@intro.10"] },
  { "do": "pan", "x": 1500, "y": null, "zoom": 1, "ms": 1200 },
  { "do": "station", "encounterId": "e1_radians", "anim": "wake" } ] }
```

`"@intro.01"` means "the `WorldLine` `{speakerId, text}` of line `intro.01` from §4.4" (the content agent expands
it; JSON carries the full objects). The companion is perched on the pylon from the first frame (the `walk` step);
a dormant-companion pose would need a `Cast.guide.companion` visibility requirement that 20 does not have (not
folded; the perched idle Cog is the P0 look).

### 4.4 Dialogue script

#### Prologue (S0)
- `intro.01` · `narrator` · cutscene intro · "Above the canyon, the Orrery once turned the sky's rhythms into light, water and time."
- `intro.02` · `narrator` · cutscene intro · "Then the astronomer Ilse Vantor sealed her Star Chart away, and the great machine fell out of step."
- `intro.03` · `narrator` · cutscene intro · "Gates froze mid-turn. The Tidewheels stalled. The crystal groves began to fade."
- `intro.04` · `narrator` · cutscene intro · "Tonight the evening star Vesper rises, and a courier named Wren has come to answer an old letter."
- `intro.05` · `cog` · cutscene intro · "Hoo! Hoo... oh! Someone wound me. Nobody has wound me in years."
- `intro.06` · `cog` · cutscene intro · "Cog, at your service: assistant to Astronomer Vantor, measurer of arcs, and very good at owling."
- `intro.07` · `cog` · cutscene intro · "Hoo! The astronomer's crypt runs on rhythm. Read the rhythm, and every door will open." **(fixture)**
- `intro.08` · `cog` · cutscene intro · "Six rhythm seals hold the Orrery still. Each one we restore sends a beam of starlight up to it."
- `intro.09` · `cog` · cutscene intro · "Her Star Chart waits in the Warden's Dome at the top of the canyon. We need it before Vesper sets."
- `intro.10` · `cog` · cutscene intro · "You can't force brass. You move it in step with the wave it runs on. I'll show you how."
- `intro.11` · `cog` · trigger s0_controls · "Hop ledges with Space. When a console glows, press E and its instruments open."
- `s0.01` · `cog` · trigger s0_plaque · "A Measurers' plaque. Press E to read it. They wrote everything down, bless their gears."
- `s0.02` · `cog` · trigger s0_telescope · "That tower on the rim is the Orrery. Dark as a snuffed lamp. Every beam we light, you'll see arrive."
- `s0.03` · `cog` · trigger s0_canal · "This canal should be running. The Tidewheels lift water up the terraces, when they turn."

#### Seal 1 · Vesper Dial (`e1_radians`, S1)
- `e1.approach` · `cog` · e1 approach[0] · "The Vesper Dial! It tells the Orrery where the evening star rises. Its carriage is parked at sunrise."
- `e1.approach2` · `cog` · e1 approach[1] · "Fog hides the star's lens, so we can't aim by eye. The dial only knows the bearing in radians."
- `e1.instruction` · `cog` · e1 instruction · "Swing the carriage along the rail to 5π/6 so Vesper's light can find its lens."
- `e1.tutorial` · `cog` · e1 tutorial · "Drag the orange knob or use the arrow keys. Only quarter marks are labelled; count the small studs."
- `e1.insight` · `cog` · e1 insight · "Each labelled stud marks a quarter lap, and six small studs split every quarter."
- `e1.hint1` · `cog` · e1 hints[0] · "A full lap of the rail is 2π, so π is only halfway round. Hoo, that's the whole trick."
- `e1.hint2` · `cog` · e1 hints[1] · "5π/6 is a little less than π. Count the studs in sixths of π, starting from sunrise."
- `e1.hint3` · `cog` · e1 hints[2] · "It sits between the top mark, π/2, and the halfway mark, π, closer to halfway."
- `e1.fail` · `cog` · e1 fail.default · "The beam hit the rim, not the lens. Recount the studs from sunrise."
- `e1.fail.short` · `cog` · e1 fail.byKey under · "The beam hit fog. The carriage stopped short; count the gaps from sunrise again."
- `e1.fail.past` · `cog` · e1 fail.byKey over · "Past it! The light's scattering off the rim. Walk the carriage back and recount the sixths."
- `e1.probe.fullturn` · `cog` · e1 fail.byKey fullturn · "Five-sixths of the whole rail, and the beam's in the floor. π only walks you halfway round."
- `e1.success` · `cog` · e1 success · "A radian is a walk, not a turn: π carries you exactly halfway round any circle."
- `e1.success2` · `cog` · e1 payoffLine · "Vesper's lens! And the dial is turning its spokes into a stair. Up we go!"
- `e1.after` · `cog` · e1 after[0] · "One rhythm restored. See that beam climbing to the rim? The Orrery felt it."

#### Brasswick (S1, `npcs[brasswick]`)
- `bw.01` · `brasswick` · npc brasswick.before · "Oh! A visitor. Oh dear. My arm swings as far as ever, but it keeps coming back too soon."
- `bw.02` · `brasswick` · npc brasswick.before · "The Tidewheel used to set my rhythm. Since it stopped, I water the air. The crystals are disappointed."
- `bw.03` · `brasswick` · npc brasswick.after · "Water! And my arm's in step. It never needed a longer swing, only the right period."
- `bw.04` · `brasswick` · npc brasswick.after · "The astronomer left this page in my watering can. I didn't read it. I read it twice."

#### Seal 2 · Tidewheel Gate (`e2_period`, S2)
- `e2.approach` · `cog` · e2 approach[0] · "The Tidewheel Gate. Its ring runs on y = sin(2t). It must lap once and lock, or the canals stay dry."
- `e2.before` · `cog` · e2 approach[1] · "Those rings spin on a sine wave. Watch how fast, not how far." **(fixture)**
- `e2.instruction` · `cog` · e2 instruction · "Set the latch timer to one full period, so the ring's notch comes home and the gate locks open."
- `e2.tutorial` · `cog` · e2 tutorial · "The ring shows where it'll be when the latch fires. The green ghost is the wave, shifted by your timer."
- `e2.insight` · `cog` · e2 insight · "Where the green ghost lies exactly on the white wave, the ring is home and heading the same way."
- `e2.hint1` · `cog` · e2 hints[0] · "A period is how long the ring takes to come back to where it started, moving the same way."
- `e2.hint2` · `cog` · e2 hints[1] · "For y = sin(b·t), one period lasts 2π/|b|. The 2 in sin(2t) is b."
- `e2.hint3` · `cog` · e2 hints[2] · "Here b = 2, so divide 2π by 2."
- `e2.fail` · `cog` · e2 fail.default · "The pawl found no notch to catch. Watch the ring come home, moving the way it started."
- `e2.fail.long` · `cog` · e2 fail.byKey over · "The latch waited too long: the ring kept going past home and the catch slipped. One lap is all it wants."
- `e2.fail.short` · `cog` · e2 fail.byKey under · "Too soon! The notch hasn't come home. A faster wheel still needs one whole lap."
- `e2.probe.half` · `cog` · e2 fail.byKey half · "Half a lap: the wave's back at zero, but heading down. A period ends moving the way it began."
- `e2.probe.double` · `cog` · e2 fail.byKey double, aligned_multiple · "Two laps! The tally counts two. The gate wants one lap, not the lap of plain old sin(t)."
- `e2.success` · `cog` · e2 success · "Speed up the wheel and every lap gets shorter: double b, and the period halves."
- `e2.success2` · `cog` · e2 payoffLine · "Hoo-hoo! Listen to that water. The Tidewheel's turning again."
- `e2.after` · `cog` · e2 after[0] · "Two rhythms. Brasswick's arm should be back in step. He's been waiting on that water."

#### Seal 3 · Echo Choir (`e3_amplitude`, S3)
- `s3.01` · `cog` · trigger s3_hall · "Warmer light up here. The Crystal Stair is close. Keep an ear out: this hall sings."
- `qu.01` · `quill` · npc quill.archive · "Scritch. I file the astronomer's pages. Five were lost when the Orrery stopped. Find them; I'll keep them."
- `qu.02` · `quill` · npc quill.riding · "Page filed. The margins are full of little circles. She really did like circles."
- `e3.approach` · `cog` · e3 approach[0] · "The Echo Choir. Three automata sing the builders' laws of amplitude. One is a mimic in a choir shell."
- `e3.approach2` · `cog` · e3 approach[1] · "Mimics love a half-truth. Aim the Tuning Lens at a singer and compare its trace to the reference."
- `e3.instruction` · `cog` · e3 instruction · "Aim the Tuning Lens at each singer, compare its trace to the reference wave, and expose the mimic."
- `e3.tutorial` · `cog` · e3 tutorial · "White is the astronomer's wave; green is the aimed singer's claim. The orange probe walks the lens's playhead."
- `e3.insight` · `cog` · e3 insight · "Listen as the probe walks: the bell sings the distance from the middle, peak or trough alike."
- `e3.hint1` · `cog` · e3 hints[0] · "Amplitude is measured from the midline, not across the whole swing."
- `e3.hint2` · `cog` · e3 hints[1] · "Peak to trough is twice the amplitude. Check where each singer starts its bracket."
- `e3.hint3` · `cog` · e3 hints[2] · "The mimic claims: The amplitude of y = 3sin(x) is 6, peak to trough."
- `e3.fail` · `cog` · e3 fail.default · "An honest bell! That singer's claim holds. Look again at where each bracket starts measuring."
- `e3.mimic` · `mimic` · e3 payoffLine · "Sss! Six looked so much bigger. Nobody measures from the middle anymore..."
- `e3.success` · `cog` · e3 success · "Amplitude is measured from the middle: swing up to 3 and down to −3, and the amplitude is still 3."
- `e3.success2` · `cog` · e3 after[0] · "It was jamming the lift gear! The Echo Lift is rising. Hop on, Wren."
- `e3.after` · `cog` · e3 after[1] · "Three rhythms. The crystals up here are waking. Hear them humming?"

#### Seal 4 · Solving Span (`e4_solve`, S4)
- `e4.approach` · `cog` · e4 approach[0] · "The Chasm of Two Answers. The span holds only if its stones are laid in the order you'd solve 2sin(x) = 1."
- `e4.approach2` · `cog` · e4 approach[1] · "Two anchor pylons on the far side. The Measurers never built two pylons for nothing."
- `e4.instruction` · `cog` · e4 instruction · "Lay the glyph stones in solving order to build the span. One stone doesn't belong."
- `e4.tutorial` · `cog` · e4 tutorial · "Pick a stone, then a socket. Socket 1 is nearest you. Lay the Span once every socket is filled."
- `e4.insight` · `cog` · e4 insight · "The lip relief is carved as 2 sin x, the water line sits at 1, and every glint marks where they meet."
- `e4.hint1` · `cog` · e4 hints[0] · "Get the sine by itself before anything else."
- `e4.hint2` · `cog` · e4 hints[1] · "Find the quadrant-I angle whose sine is 1/2. That's your reference angle."
- `e4.hint3` · `cog` · e4 hints[2] · "Sine is positive in two quadrants, which is why there are two answers, and two pylons."
- `e4.fail` · `cog` · e4 fail.default · "The span won't hold that way. Watch where it tips: the order breaks right there."
- `e4.fail.order` · `cog` · e4 fail.byKey order · "The span held up to a point, then a stone tipped. Something has to happen right before that one."
- `e4.fail.decoy` · `cog` · e4 fail.byKey decoy · "That stone crumbled: no angle has a sine of 2. You can't undo the 2 until the sine stands alone."
- `e4.probe.early` · `cog` · e4 fail.byKey early · "The span reached for both pylons too soon. It needs one more fact about the circle first."
- `e4.success` · `cog` · e4 success · "An equation can have two doors: sine is positive twice on every lap, at π/6 and at 5π/6."
- `e4.success2` · `cog` · e4 payoffLine · "Both pylons lit! Isolate, reference angle, quadrants, both solutions. Now let's walk it."
- `e4.after` · `cog` · e4 after[0] · "Four rhythms. The Crystal Stair is ahead, and I can hear the Treasury chimes."

#### Crystal Stair (S5 explore) and Lumen
- `lu.01` · `lumen` · npc lumen.tending · "Each lantern flame rises and falls on its own wave. Taller flame, same rhythm. Folks mix those up."
- `lu.02` · `lumen` · npc lumen.lit · "The Choir's honest again, so I can light the stair by their song. Mind the third step; it hums."
- `lu.03` · `lumen` · npc lumen.wisps (P2) · "Three indigo wisps sing behind the falls. Gather them all, and the water will part for you."
- `lu.04` · `lumen` · npc lumen.falls · "The falls part for whoever wakes the Treasury. Something of hers still hums behind the water."
- `wi.01` · `cog` · trigger wisp_first (P2) · "An insight wisp! It hums a little truth. Collect all three and something behind the falls wakes."
- `wi.02` · `cog` · quest wisps reward (P2) · "Three wisps! Hear the falls change pitch? Something behind them just unlocked."

#### Seal 5 · Chime Treasury (`e5_period_review`, S5)
- `e5.approach` · `cog` · e5 approach[0] · "The Chime Treasury. Its singers remember the Tidewheel Gate, and one of them remembers it wrong."
- `e5.approach2` · `cog` · e5 approach[1] · "This is the trickiest choir yet. Every claim sounds like something we've already seen."
- `e5.instruction` · `cog` · e5 instruction · "Aim the lens at each singer, count the cycles inside its period bracket, and expose the mimic."
- `e5.insight` · `cog` · e5 insight · "A true period bracket closes exactly where the wave comes home, moving the same way."
- `e5.hint1` · `cog` · e5 hints[0] · "Period = 2π/|b|. Check each claim with it."
- `e5.hint2` · `cog` · e5 hints[1] · "A bigger b means a faster wave and a shorter period. A true period bracket holds exactly one cycle."
- `e5.hint3` · `cog` · e5 hints[2] · "The mimic claims: y = sin(2x) has period 4π, twice that of sin(x)."
- `e5.fail` · `cog` · e5 fail.default · "Honest! That bracket holds exactly one cycle. Test the others with 2π over b."
- `e5.mimic` · `mimic` · e5 payoffLine · "Twice the b, twice the period... it sounded so fair. Sss."
- `e5.success` · `cog` · e5 success · "A wave that repeats twice as often waits half as long: sin(2x) comes home every π."
- `e5.success2` · `cog` · e5 after[0] · "The Treasury chest! The Warden's key-stone, and the rim stair's growing. Hoo, up!"
- `e5.after` · `cog` · e5 after[1] · "Five rhythms. One seal left, and it has a guard."

#### Rim Gantry (S6 explore)
- `g.01` · `cog` · trigger g_gantry · "The Rim Gantry. Each gear swings on the period written on its plaque. Watch one lap, then jump."
- `g.02` · `cog` · trigger g_miss_1..3 · "No harm done; the walkway catches you. Count the beat: out, back, out again. Then go."
- `g.03` · `cog` · trigger g_ledge · "Look back: five beams on the Orrery. One more and she wakes."

#### Seal 6 · The Warden's Shield (`e6_boss`, S6)
- `e6.approach` · `cog` · cutscene e6_arena · "The Warden. It guards the Star Chart and trusts only one thing: timing."
- `e6.warden1` · `warden` · cutscene e6_arena · "None pass whose timing is false." **(fixture)**
- `e6.warden2` · `warden` · cutscene e6_arena · "My shield sweeps three spans either way. Six spans, end to end! Match THAT, little reader."
- `e6.instruction` · `cog` · e6 instruction · "Tune the counter-pendulum's period to the shield's rhythm, y = 3sin((π/2)t), and hold the sync thread."
- `e6.tutorial` · `cog` · e6 tutorial · "Your pendulum swings with the period you set. When the rhythms match, the thread between them stays bright."
- `e6.insight` · `cog` · e6 insight · "The thread stays bright only while the two rhythms agree. It never cares how wide either one swings."
- `e6.hint1` · `cog` · e6 hints[0] · "The 3 in front sets how far the shield swings, not how fast."
- `e6.hint2` · `cog` · e6 hints[1] · "Period = 2π/|b|, and here b = π/2."
- `e6.hint3` · `cog` · e6 hints[2] · "Divide 2π by π/2: the π's cancel."
- `e6.fail.long` · `warden` · e6 boss.taunts.byKey over · "Too slow! You drift behind my every beat."
- `e6.fail.short` · `warden` · e6 boss.taunts.byKey under · "Too quick! You race ahead and fall out of step."
- `e6.probe.reach` · `warden` · e6 boss.taunts.byKey reach · "You count my reach, not my rhythm. Reach is how far. Rhythm is how often."
- `e6.probe.half` · `warden` · e6 boss.taunts.byKey half · "Zero, yes, but which way do I swing? Half a beat is no beat at all."
- `e6.fail.any` · `warden` · e6 boss.taunts.fail[0] · "Out of step, reader. Watch me once more."
- `e6.fail.cog` · `cog` · e6 fail.default · "Don't let the big swing fool you. Watch one full sweep: out, back, and out again the same way."
- `e6.success.warden` · `warden` · e6 payoffLine · "Your timing is true. Pass, reader of rhythms." **(fixture)**
- `e6.success` · `cog` · e6 success · "How far a thing swings says nothing about how often. Height is A; timing is b."
- `e6.success2` · `cog` · cutscene finale · "The shield's open and the Star Chart is right there! Take it to the lens, Wren!"

#### Epilogue (cutscene `finale`)
- `out.01` · `narrator` · cutscene finale · "Under Vesper's light, the Star Chart slid into the Orrery's lens."
- `out.02` · `cog` · cutscene finale · "Six rhythms, six beams. Hoo, look at them climb!"
- `out.03` · `ilse` · cutscene finale; npc ilse.projected · "Whoever you are: if you hear this, you read the rhythms. Angles, periods, swings and solutions."
- `out.04` · `ilse` · cutscene finale · "I sealed the chart so only someone who understood the machines could restart them. Thank you."
- `out.05` · `narrator` · cutscene finale · "The Tidewheels turned. The canals filled terrace by terrace. The groves glowed blue again."
- `out.06` · `cog` · cutscene finale · "Her star chart! You read every rhythm in the crypt." **(fixture)**
- `out.07` · `cog` · cutscene finale · "Same time next year? I'll keep the gears oiled. Hoo."

#### Side content (any scene)
- `u.page` · `cog` · trigger page_1_near (P2) · "Her handwriting! Press E to read. She hid lessons in her letters."
- `u.quill3` · `quill` · quest quill_pages reward (P2) · "All five pages, in order. The astronomer would be pleased, and a little embarrassed."
- `u.tel` · `cog` · touch telescope_s0, telescope_s6 (P2) · "Count the beams on the tower: every rhythm we restore arrives up there."
- `mb.01` · `cog` · sandbox music_box open · "Her music box! Slide b and the note climbs. Slide A and it only gets louder. Pitch is timing."
- `mb.02` · `cog` · sandbox music_box idle · "No seal here, no lock. She built this one just for play."
- `mb.03` · `cog` · sandbox music_box reward · "There: pitch climbed with b, and A only made it louder. Timing is b, even in a song."
- `h.dome` · `cog` · z3_dome hub restoredLine (P1) · "Every constellation's lit. She mapped each rhythm we fixed."

**Line count: 133.** By speaker: `cog` 104, `narrator` 6, `warden` 8, `brasswick` 4, `lumen` 4, `quill` 3,
`mimic` 2, `ilse` 2 (every id ∈ `spec.characters` ∪ `cast.extras` ∪ {`narrator`}). Five lines are verbatim fixture
lines. `out.03` is spoken in the finale `say` step and is also the one line of the `ilse` NPC state (the NPC exists
only to draw the star figure).

### 4.5 Finale (cutscene `finale`, phase `finale`)

This fixes D2: after the boss's correct `grade()`, the payoff phase plays the e6 success plan (the Warden kneels
and the Star Door opens, §5.6), then `PAYOFF_DONE` enters `finale` before `EndScreen`.

| Beat | Visual | Duration | Step(s) | Line |
|---|---|---|---|---|
| 1 | Cog urges Wren on | 2 s | `say` | `e6.success2` |
| 2 | Wren walks (auto) through the door; a white flash | 3 s | `walk`, `fade white` | — |
| 3 | The dome's hub lights (P1: all 7 sockets); the camera settles above the door | 1.5 s | `hub` (P1), `camera`, `fade clear` | — |
| 4 | Six beams converge; the chart slots into the lens | 4 s | `say`, `sfx` | `out.01`, `out.02` |
| 5 | Ilse's constellation-figure fades in above the lens (star points, 1 px lines, `vesper.star`) | 7 s | `set_state` flag `ilse_projected`, `say` | `out.03`, `out.04` |
| 6 | The canyon vista: pull back and pan down from the Orrery to the floor; each terrace re-saturates in order, canals fill as a travelling water front, the dome's constellations ping | 7.5 s | `vista` | — |
| 7 | Narration over the vista's hold; Wren celebrates; Cog circles | 5 s | `say`, `emote`, `say` | `out.05`, `out.06`, `out.07` |
| 8 | Fade to EndScreen (debrief, mastery, post-assessment) | 1 s | `fade black` | — |

```json
{ "id": "finale", "skippable": true, "steps": [
  { "do": "say", "lines": ["@e6.success2"] },
  { "do": "walk", "actor": "player", "toX": 4700 },
  { "do": "fade", "to": "white", "ms": 500 },
  { "do": "hub", "zoneId": "z3_dome", "state": "restored" },
  { "do": "camera", "x": 4700, "y": 600, "zoom": 0.9, "ms": 0, "ease": "linear" },
  { "do": "fade", "to": "clear", "ms": 700 },
  { "do": "say", "lines": ["@out.01", "@out.02"] },
  { "do": "sfx", "cue": "resonance_lock" },
  { "do": "set_state", "target": { "kind": "flag", "id": "ilse_projected" }, "state": "on" },
  { "do": "say", "lines": ["@out.03", "@out.04"] },
  { "do": "vista", "asset": "orrery_terraces.vista.canyon", "from": { "x": 1200, "y": 360, "zoom": 1 }, "to": { "x": 1200, "y": 2600, "zoom": 0.6 }, "ms": 6000, "holdMs": 1500 },
  { "do": "say", "lines": ["@out.05"] },
  { "do": "emote", "actor": "player", "glyph": "♪" },
  { "do": "say", "lines": ["@out.06", "@out.07"] },
  { "do": "fade", "to": "black", "ms": 1000 } ] }
```

At P0 the `hub` step is omitted (`z3_dome.hub` is `null` until P1). The finale is skippable (Esc or
`cutscene-skip`); `autoSolve` of the boss reaches `finished` through `DEBUG_SYNC`, so `end-screen` stays reachable
with no UI interaction. The vista asset `orrery_terraces.vista.canyon` is 2400 × 3200 (kit `compose(skyWash dusk,
ridgeBand ×3 palettes, orrery_tower, beam lines)`); the `from`/`to` shots are in its own coordinates.

Other cutscenes:

```json
[{ "id": "e6_arena", "skippable": true, "steps": [
  { "do": "music", "cue": "boss" },
  { "do": "camera", "x": 4500, "y": 700, "zoom": 0.8, "ms": 900, "ease": "out_cubic" },
  { "do": "station", "encounterId": "e6_boss", "anim": "wake" },
  { "do": "say", "lines": ["@e6.approach", "@e6.warden1", "@e6.warden2"] },
  { "do": "camera", "x": null, "y": null, "zoom": 1, "ms": 600, "ease": "out_cubic" } ] },
{ "id": "e3_lift_up", "skippable": true, "steps": [
  { "do": "sfx", "cue": "lift_chain" },
  { "do": "ride", "vehicle": "orrery_terraces.part.resonance_pillars_echo_lift", "toZoneId": "z2_crystal", "toX": 2960, "ms": 2200, "path": [[2800, 1900], [2800, 1400]] } ] },
{ "id": "z2_entry", "skippable": true, "steps": [ { "do": "title", "text": "Crystal Stair", "sub": null, "ms": 2000 } ] },
{ "id": "z3_entry", "skippable": true, "steps": [ { "do": "title", "text": "The Warden's Dome", "sub": null, "ms": 2000 } ] } ]
```

### 4.6 Verification of line lengths

Content agents run the following against this file. The build must print only the count:

```bash
grep -E '^- `[a-z0-9_.]+` · ' docs/design/10-game-trig.md \
  | sed -E 's/.*· "(.*)"( \*\*\(fixture\)\*\*)?$/\1/' \
  | awk '{ n++; if (length($0) > 140) print "TOO LONG: " $0 } END { print n " lines" }'
# expected output: "133 lines"
```

(`awk length` counts bytes; π and − are multi-byte, so a line that passes here passes R9's character count.)

### 4.7 Line audit (amendments 9, 34, 37)

| Line | Revision 1 | Problem | Fix |
|---|---|---|---|
| `intro.11` | "Walk with A and D, jump with Space…" | "jump" is not a verb any more; A/D is taught by the `control_until` prompt | "Hop ledges with Space. When a console glows, press E…" (trigger `s0_controls`) |
| `e1.probe.fullturn` | "…Is π the whole circle, or only half of it?" | quiz voice | a statement at hint-1 level: "…π only walks you halfway round." |
| `e3.tutorial` | "…Drag the orange probe to measure." | the probe now moves the world | "…The orange probe walks the lens's playhead." |
| `e4.hint2` | "Which angle in quadrant I has a sine of 1/2?…" | quiz voice | imperative: "Find the quadrant-I angle whose sine is 1/2…" (no stone position named: that would leak the order) |
| `e4.fail.order` | "…What has to happen right before that one?" | quiz voice | "…Something has to happen right before that one." |
| `u.back` | "Take your time. The machine will wait…" | no schema slot for a panel closed without Verify | dropped (not folded) |
| new | `e1.insight` … `e6.insight` | 20 splits insight (pre-success) from success (post-success) | six hint-free world truths for re-opens |
| new | `e1.fail`, `e2.fail`, `e4.fail` | `fail.default` is required | generic guide lines at hint-1 level |
| new | `e4.probe.early` | a probe for "both solutions before quadrants" | says no more than hint 1 |
| new | `e6.fail.any` | `taunts.fail` fallback when no key matches | Warden line |
| new | `lu.04`, `mb.03`, `h.dome` | P1 Music Box pointer and reward; the dome hub's restored line | Lumen, Cog |
| all | "success (insight)" | naming clash | revision-1 "insight" lines are now `success`; revision-1 `success2` is `payoffLine` (or `after[0]` where the mimic takes the payoff toast) |

No line addresses the player as a player, names a quiz or a score, or refers to "levels", "review time" or the
UI outside the explicit onboarding lines (`intro.11`, `s0.01`, `e1.tutorial`, `e4.tutorial`, `u.page`).

---

## 5 · Contraptions (one station per encounter)

### 5.0 Shared rules for all six stations

**Five parts** (bible §4): console → control → live link → Verify → payoff. Every station below fills in all five.

**The interfaces are 20's** (§2.5, §3.3, §3.4). Revision-1 names map as follows; nothing in this section defines
new types.

| Revision 1 (retired) | Revision 2 (20) |
|---|---|
| `ContraptionDef`, `create(scene, anchor, ctx)` | `ContraptionPrefab {meta, create(scene, Phaser, PrefabProps)}` → `PoseView` (20 §2.5.5) |
| `LiveDraft {kind: value \| aim \| order \| probe}` | `Draft {input, complete, focus, hover, probe, settled, …}` with `DraftInputs["mapper.number_line" \| "tuner.oscillator" \| "truth_finder.mimic" \| "sequencer.linear"]`; the probe is `Draft.probe` (20 §2.5.1) |
| `onLive(number)`, `Pick` aim events | the panel controls (`ScrubControl`, `AimControl` with hover/focus drafts, `SlotRailControl`) → `ExpeditionClient.onDraft` → `host.bindDraft` (20 §3.4) |
| `Verdict`, `playVerdict(v)` reading `solution` | `Diagnosis` from `src/world/diagnose` (`failKey`, `wrongKeys`, `prefix`, `probeKeys`, `displayFeedback`) → `meta.failurePlan(d, input)` / `meta.successPlan(input, anim)`; metas never see `solution` (20 §2.5.4, §2.5.6) |
| `setDraft`, `setAidTier`, `setSolved`, `setDormant` | `ContraptionInstance.bind`, `setAidTier(tier, hintsUsed)`, `settleSolved`, `setState("dormant" \| "awake" \| "active" \| "solved")` |
| `isLockedPose(v)` parity test | the meta's locked predicate in `debug()` + the §7.4 parity tests; `diagnose` parity against `grade().feedback` |
| `claimTraces` | `ClaimHoldersConfig.holders[].trace` (`ClaimTrace`) |
| `stepEffects` | `StepBridgeConfig.stepEffects[]` |
| "Display noun map" | root `feedbackNouns: [{from: "chest", to: "singer", stations: ["e3_amplitude", "e5_period_review"]}]` |
| `probe.*` lines | `MisconceptionProbe[]` on the station + `dialogue.fail.byKey[key]` (or `boss.taunts.byKey[key]`) |
| socket `altar`/`door`/`chest`/`boss` | irrelevant to the Expedition host (stations bind by encounter id) |
| `PanelFrame`, `ClaimColumn`, `PlankColumn`, `SpanSchematic` | `InstrumentPanel` + primitives, `ClaimsCard` + `AimControl`, `SlotRailControl`, `SlotRailCard` (20 §3.2) |
| "world 0–0.59 / panel 0.59–0.975", "world 45 %" | scrub panel 42vw (world ≈ 58 %), board 55vw (world 45 %), full-bleed canvas (20 §3.1 is authoritative) |

**Hard rules.**

1. **Grading stays in the mode.** Verify calls `runner.submit(toSubmitInput(modeKey, draft.input))` with exactly the mode's `Input`. The station *replays* the verdict through `Diagnosis`.
2. **Locked-pose parity.** A continuous meta's "locked" pose predicate agrees with `grade().correct` for every input (≥ 200 samples per meta test); `diagnose` agrees with `grade()` for ≥ 50 seeded wrong inputs per mode (20 §2.5.4).
3. **Live-reveal rule** (20 §2.5.6). Scrub stations (e1, e2, e6) may show *how close* the world is (beam in the fog arc, notch misalignment, thread brightness). Aim and slot stations (e3, e4, e5) show *what your choice does* (the lens swings, the stone flies to its socket) and correctness appears only after Verify. Metas see the `view`, never `params` or `solution`; e1's distance bands use `view.target`, which the mode already shows.
4. **Non-punitive failure.** The failure plan lasts 600–1600 ms (`FailurePlan.durationMs`), the panel stays open, the control is not remounted and the draft is kept. No health, no reset; only the runner's mastery penalty applies.
5. **Success protocol** (shared; each station adds its middle):

   | t | What happens |
   |---|---|
   | 0 | the badge (`panel.successBadge`) replaces Verify, with bracket connectors (bible §3.8) |
   | 0 | the `success` line replaces the instruction |
   | 0–2.5 s | the in-world success plan (`SuccessPlan.durationMs` 1200–2500) |
   | 1.6 s | the panel slides out (280 ms) |
   | end | camera back to follow; Wren `cheer`; the objective ring arc fills (0.6 s); P1: the L1 `beam_line` draws (1.0 s); the station and its `restoredBy` props re-saturate (1.0 s); the payoff terrain merges or the blocker clears; `payoffLine` toasts |

6. **Aid tiers** (20 decision 16): `aidTier = min(2, max(hintsUsed, failedVerifies > 0 ? 1 : 0))` reaches `pose`, `panelStatic` and `panelLive`.

   | Tier | Unlocked by | Adds |
   |---|---|---|
   | 0 | panel opens | primary cards and all world motion |
   | 1 | the first failed Verify, or rung 1 | the secondary card fills in (drawn empty until then, as Variant does) |
   | 2 | rung 2 | an overlay aid (markers, brackets, labelled sixths) |

   Tiers never unlock anything beyond what the matching fixture hint already says. Each rung also sends Cog to
   `meta.hintTargets(rung)` (listed per station).
7. **Probes.** After a failed Verify, `station.probes` are matched against the submitted input; a matched key
   selects `fail.byKey[key]` (and, on e6, `boss.taunts.byKey[key]`). A probe line never says more than hint 1.
8. **The Brief sheet** ((i) long-press or Shift+I): **Brief** = the fixture `prompt` verbatim + the console plaque
   text (§6.3); **Hints** = the guide rungs unlocked so far, then the fixture `hints[]` verbatim.
9. **Display nouns.** `feedbackNouns` turns "That chest was honest" into "That singer was honest" in display only.
10. **Runtime fixes the stations depend on:** D1 (the cleared id is captured at `VERIFIED`), D2 (`finale` phase),
    D3 (world from `progress.solvedIds`), D4 (keyboard capture released under `[data-panel]`), D5 (`view` memoized
    per encounter index) — all in 20 §2.9–§3.4.

**Coordinates.** Each station's `anchor` is in zone units; parts are positioned relative to it by the prefab.

---

### 5.1 Seal 1 · The Vesper Dial (`e1_radians` · `mapper.number_line`)

| Fixture fact | Value |
|---|---|
| params | `scale: linear, min: 0, max: 2*pi, target: 5*pi/6, landmarkStep: pi/2, labels: pi` |
| view | `{scale, min: 0, max: 2π, target: "5π/6", landmarks: [0, π/2, π, 3π/2, 2π] (value, fraction, label)}` |
| input | `{ value: θ }` |
| solution | `value 2.618, tolerance 0.015 (line fraction), fraction 0.4167, label "5π/6", between "π/2 and π"` |
| tolerance in radians | `0.015 × 2π = 0.0942` |
| grade feedback | correct: "A perfect landing." · wrong: "You landed past/short of 5π/6. Count how many landmark gaps it takes to get there." |
| misconception | "π radians is a full circle", which would put the carriage at 5/6 of a full turn = 5π/3 |

**Station record.**

| Field | Value |
|---|---|
| `zoneId` · `consoleX` · `anchor` | `z1_sunward` · 4300 · `{x: 4800, y: 1140}` (the dial's centre, 300 above the S1 floor) |
| `contraption` · `skin` | `emitter_rail` · `vesper_dial` |
| `objectNoun` · `partNouns` | "Vesper Dial" · `["carriage", "rail"]` |
| `pins` | `[{anchor: "pin", text: "5π/6", glyph: null}]` (the target *value*, already in the view; R8 bans only "π/2 and π") |
| `probes` | `[{predicate: "nearValue", value: "5*pi/3", tolFactor: 1, key: "fullturn"}]` |
| `panel` | `{layout: "scrub", inputSymbol: "θ", verifyLabel: "ALIGN THE DIAL", successBadge: "VESPER ALIGNED", cards: [{slot: 0, title: "UNIT CIRCLE"}, {slot: 1, title: "sin θ"}, {slot: 2, title: "cos θ"}]}` |
| `payoff` | `{kind: "terrain", vertical: "up", anim: "stairs_rise", noun: "spoke stair", blocker: {x: 5380, surface: "ground", asset: null}, terrain: [{surface: "ground", points: [[5098,1440],[5100,1360],[5158,1360],[5160,1280],[5218,1280],[5220,1200],[5278,1200],[5280,1120],[5338,1120],[5340,1040],[5400,1040]]}], rideCutsceneId: null, autoBoardMs: null, feedsHub: true}` |
| dialogue | approach `[e1.approach, e1.approach2]` · instruction `e1.instruction` · tutorial `e1.tutorial` · insight `e1.insight` · hints `[e1.hint1, e1.hint2, e1.hint3]` · fail `{default: e1.fail, byKey: [{key: "under", line: e1.fail.short}, {key: "over", line: e1.fail.past}, {key: "fullturn", line: e1.probe.fullturn}]}` · success `e1.success` · payoffLine `e1.success2` · after `[e1.after]` |
| `hintTargets` | rung 1: `circle` `center` 1500 ms · rung 2: `ride` `beam_origin` 3000 ms (Cog rides the carriage while the player counts sixths) · rung 3: `land` `pin` 1500 ms |
| `boss`, `accessories`, `frameZoom` | `null`, `[]`, `null` |

**`config`** (`EmitterRailConfig`, 20 §4.2):

```json
{ "rail": "arc", "radius": 310, "gauges": ["sin", "cos"], "hiddenTarget": "fog", "detent": "pi/12",
  "readout": "bracket", "chevrons": true, "cards": { "unitCircle": true, "cosTier": 1, "sixthsTier": 2 } }
```

`validateConfig` holds: `rail: arc` ⇔ the view is π-labelled and spans 2π; `gauges` only on arc rails.

**In-world object** (anchor C = (4800, 1140)):
- **Dial disc** (`vesper_dial_disc`, hero): a cream stone disc of radius 280.
  - It is carved with a sun face: concentric rings, a navy inlay ring at r 200, and 8 gold rays.
  - It has 5 dark **spoke slots** on its right rim, from which the ledges emerge on success.
  - It is set in the S1 retaining wall and casts a long soft shadow to the right.
- **Rail ring** (`vesper_dial_rail_ring`, kit `ringStack`): a gold ring of radius 310, 14 wide.
  - 24 small engraved **studs** every π/12: 4-unit navy dots.
  - 4 large **landmark studs** at 0, π/2, π and 3π/2: 12-unit gold bosses. Their labels come from `view.landmarks` and are **DOM** chips through `WorldLabelLayer` (spec-derived text, 20 §5.3), set just outside the rail.
  - The 0 stud also carries a small engraved sun glyph: the **sunrise mark** (static, engraved at build time).
- **Carriage** (`vesper_dial_carriage`, hero): a brass shoe on the rail with a small cyan-orb emitter, 90 × 70.
  - Its position is `P(θ) = C + 310·(cos θ, −sin θ)` (screen y down, so the angle increases counter-clockwise, over the top).
- **Beam**: 3 stacked additive lines plus `shared.fx.beam_cap` (20 §2.2 `fx/beam.ts`). It runs from P outward along `(cos θ, −sin θ)`.
  - For θ ∈ [0.05, π − 0.05] it reaches the fog band at radius 900 and ends in a soft cyan bloom inside the fog, the same at every angle.
  - Otherwise it ends on the wall or floor within 420 with a small grey-cyan spark.
- **Sine plumb gauge** (`vesper_dial_plumb_gauge`, kit `gauge ruler_v`): a vertical brass ruler at x = C.x + 390, from C.y − 310 to C.y + 310, ticks at −1, −0.5, 0, 0.5 and 1 (rail radii).
  - The bob (a code-drawn disc with a green ring at anchor `bob`) slides to `y = C.y − 310·sin θ`.
  - A dashed green line runs from the carriage horizontally to the bob.
  - World chip (green border): **"sin θ: 0.50"**.
- **Cosine slide gauge** (`vesper_dial_slide_gauge`, kit `gauge ruler_h`): set into the paving's front face at y = C.y + 360, with a marker (anchor `marker`, blue ring) at `x = C.x + 310·cos θ` and a dashed blue line up to the carriage.
  - World chip (blue border): **"cos θ: −0.87"**.
- **Carriage chip** (white border): **"θ: π/2 < θ < π"**. It shows the landmark bracket of the current θ, which is already legible from the labelled studs. When within 0.01 of a landmark it shows **"θ = π"**. It never shows a decimal.
- **Target pin** (`shared.ui.pin` at anchor `pin`, 1.3 H above the disc top, y ≈ 639): **"5π/6"**. The pin states the target *value*, not its place.
- **Fog band** (`vesper_dial_fog_band`, kit `cloudBand` fog): a soft lavender-white band covering the whole upper sky arc from about 10° to 170° as seen from C. **Vesper's Lens** (`vesper_dial_vesper_lens`, hero) is hidden inside it at bearing 5π/6 and radius 900. Because the lens is invisible, there is no aim-by-eye shortcut.
- **Console** (`vesper_dial_console`, kit `lectern`) at x 4300.
- **Dormant state:** −40 % saturation, no beam, carriage parked at θ = 0.

**Live binding** (`pose(input)` each frame; θ = `draft.input.value`, eased by the controller: 95 % in ≈ 330 ms).

| Quantity | Formula |
|---|---|
| Carriage | `P(θ) = C + 310·(cos θ, −sin θ)`; the carriage sprite rotates by `−θ + π/2` so its orb faces outward |
| Beam direction and length | `u = (cos θ, −sin θ)`; `L = 900 − 310` inside the fog arc, else clipped at the first wall hit (≤ 420) |
| Beam shimmer | alpha `0.9 ± 0.08` at 12 Hz (prefab `update`) |
| Plumb bob | `y = C.y − 310·sin θ` |
| Cosine marker | `x = C.x + 310·cos θ` |
| Gold sweep arc on the disc rim | from 0 to θ, 6 wide, `gold.hi` at 70 %: "the walk so far". Arc length on the unit circle = θ |
| Chips (`describe().chips`) | `sin θ` and `cos θ` to 2 decimals at anchors `bob`/`marker`; the carriage chip is `bracket(θ, view.landmarks)` |
| Detents (`config.detent: "pi/12"`) | when the knob settles within 0.05 rad of a stud (a multiple of π/12), θ eases onto the stud. Every stud is equally sticky, so it leaks nothing |
| Sound (`meta.audio`) | `dial_carriage_roll` loop, pitch ∝ \|dθ/dt\|; a `stud_tick` each time a stud is crossed |
| `srText` | "The carriage is between π/2 and π on the rail; the beam ends in the fog." (bracket words, never a decimal) |

**Instrument panel (scrub layout, 42vw).**

```
┌──────────────────────── panel ────────────────────────┐
│ [←]                                        ┌───────┐  │
│   ┌── UNIT CIRCLE (slot 0, unit_circle) ───┤ θ     │  │  tab "θ"
│   │            π/2                         └───────┘  │
│   │      ╭─────●─────╮   white point P(cosθ, sinθ)    │
│   │   π  │  orange arc 0→θ  │ 0 ←sunrise tick        │
│   │      ╰───────────╯   green drop (sin) · blue (cos)│
│   │            3π/2                                   │
│   └───────────────────────────────────────────────────│
│chip┌── sin θ (slot 1, graph) ─────────────────── [g]┐ │
│◀── │  y∈[−1.5,1.5] ticks −1,0,1 · x 0…2π              │ │
│    └──────────────────────────────────────────────────┘ │
│chip┌── cos θ (slot 2, graph, tier 1) ─────────── [h]┐ │
│    └──────────────────────────────────────────────────┘ │
│ ┌────┬─────────────┐ ├┼┼┼┼┼┼●┼┼┼┼┼┼┼┼┼┼┼┼┼┼┼┼┼┼┤         │  ruler 0 · π/2 · π · 3π/2 · 2π
│ │ θ  │ π/2 < θ < π │ 0     π/2     π    3π/2   2π       │  hairlines every π/12 (unlabelled)
│ └────┴─────────────┘                                   │
│              ●── [ ALIGN THE DIAL ] ──●                │
└───────────────────────────────────────────────────────┘
```

**Cards** (`panelStatic` / `panelLive`).
- **Slot 0, `unit_circle`** (tier 0): axes ±1.2; landmark labels at 0, π/2, π and 3π/2; `hairlineStep` π/12; the orange input `arc` from 0 to θ (it is the input); `point {angle: θ}`; `drops {sin: true, cos: true}` (green dashed to the x-axis, blue dashed to the y-axis).
- **Slot 1, `graph` "sin θ"** (tier 0): green `y = sin θ` over [0, 2π]; its x-axis is shared with the ruler.
- **Slot 2, `graph` "cos θ"**: `config.cards.cosTier: 1`; drawn empty (axes only) at tier 0.
- **Scrubber** (`ScrubControl`): the orange line runs through slots 1 and 2 at x = θ (the unit circle card is not on the shared axis). Chips: sin θ (green) and cos θ (blue) at their y.
- **Readout:** the input tab reads **"θ"** (`panel.inputSymbol`); the readout shows the **landmark bracket** ("π/2 < θ < π", `config.readout: "bracket"`), never a decimal.
- **Tier 2** (`config.cards.sixthsTier: 2`): the unit circle labels every π/6 hairline with a small tick (no numerals), making "count in sixths" (hint 2) literal.
- **Keyboard:** ← / → π/48 (`step`); Shift + ← / → π/12 (the next stud); Home / End 0 / 2π; Enter on Verify.

**Verify.** **ALIGN THE DIAL** submits `{ value: θ }`; `numberLine.grade`.

**Success plan (2.4 s, then payoff).**

| t (s) | World | Panel |
|---|---|---|
| 0.0 | the beam's core widens ×1.5, `beam_surge` | badge **VESPER ALIGNED** |
| 0.0–0.8 | the fog dissolves outward from the beam's end (radial alpha 0.85 → 0), revealing **Vesper's Lens** on the rim | the `success` line types on |
| 0.4 | the lens ignites: lit core, halo, 12 sparks, `node_ignite` | |
| 0.6–1.0 | a bright starlight pulse travels back down the beam into the disc centre | unit circle: the arc turns gold |
| 1.0–2.4 | the **disc rotates +5π/6** counter-clockwise (ease-out cubic; the disc turns by the angle you set). The five **spoke-ledges** (`vesper_dial_spoke_ledge`) slide out one after another (0.15 s stagger, `spoke_extend_clunk`) | panel slides out at 1.6 |
| 2.4 | `payoff.terrain` merges (the stair is walkable) | — |

**Payoff:** five 80-high treads from the S1 floor (1440) to the terrace (1040), x 5098–5400. It is the only
route up. P1: the S1 `beam_line` draws to the Orrery.

**Failure plan (1.4 s).**
- The beam stays where it points, and a scatter burst appears at its end: 8 grey-cyan sparks and a fog puff, `beam_scatter`.
- Gold **chevrons** (`config.chevrons`) appear on the rail beside the carriage and point in the direction to move: `failKey: "under"` (short of) → counter-clockwise, `"over"` (past) → clockwise.
- The number of chevrons encodes the distance band from `view.target` (the pin already shows it): 1 = within one stud (π/12), 2 = within one landmark gap (π/2), 3 = further. They fade after 2 s. It never shows the target position.
- Lines: `failLines` → `e1.fail.short` / `e1.fail.past`, or `e1.probe.fullturn` when the `fullturn` probe matches (`|θ − 5π/3| ≤ 0.0942`); line 2 shows the mode feedback.

**Misconception made visible:** a player who treats π as a full turn places the carriage low on the right (5π/3).
The beam fires into the floor wall and never reaches the fog, which is visibly nowhere near the sky.

**Pure tests** (`emitter-rail.meta.test.ts`, 20 §7.4): `pose` carriage positions at 0, π/2, π; `bracket()` for 20
values; locked-pose parity over 400 samples; the `fullturn` probe fires only near 5π/3; chevron bands from
`view.target` only.

---

### 5.2 Seal 2 · The Tidewheel Gate (`e2_period` · `tuner.oscillator`, ask `period`)

| Fixture fact | Value |
|---|---|
| params | `wave: sin, amplitude: 1, b: "2", c: "0", d: 0, ask: period` |
| view | `{equation: "y = sin(2t)", ask: period, askLabel: "period", wave: sin, amplitude: 1, b: 2, c: 0, d: 0, dial: {min 0, max 2π, step π/12, ticks every π/4 ("0", "π/4", … "2π")}}` |
| input | `{ value: T }` |
| solution | `period π, answer π, answerLabel "π"` |
| tolerance | `0.03 × 2π = 0.1885`, so only the detent T = π passes (neighbours at π ± π/12 are 0.26 away) |
| grade feedback | "A period of X is too long: the rings drift behind" / "too short: the rings race ahead" + "One full cycle of sin(b·t) takes 2π/\|b\|." |
| misconception | "sin(2x) has period 4π" (a bigger b means a longer period) |

**Station record.**

| Field | Value |
|---|---|
| `zoneId` · `consoleX` · `anchor` | `z1_sunward` · 6900 · `{x: 7400, y: 836}` (the ring centre, 1.2 H above the terrace at 1040) |
| `contraption` · `skin` | `ring_gate` · `ring_gate` |
| `objectNoun` · `partNouns` | "Tidewheel Gate" · `["latch timer", "ring", "notch"]` |
| `pins` | `[{anchor: "tally", text: "I", glyph: null}]` (one lap: the definition of a period, not its value) |
| `probes` | `[{predicate: "nearValue", value: "pi/2", tolFactor: 1, key: "half"}, {predicate: "nearValue", value: "2*pi", tolFactor: 1, key: "double"}]` |
| `panel` | `{layout: "scrub", inputSymbol: "T", verifyLabel: "LOCK THE RINGS", successBadge: "RINGS LOCKED", cards: [{slot: 0, title: "f(t)"}, {slot: 1, title: "f(t + T)"}, {slot: 2, title: "laps"}]}` |
| `payoff` | `{kind: "remove_blocker", vertical: "none", anim: "door_opens", noun: "Tidewheel doorway", blocker: {x: 7330, surface: "ground", asset: null}, terrain: [], rideCutsceneId: null, autoBoardMs: null, feedsHub: true}` |
| dialogue | approach `[e2.approach, e2.before]` · instruction `e2.instruction` · tutorial `e2.tutorial` · insight `e2.insight` · hints `[e2.hint1, e2.hint2, e2.hint3]` · fail `{default: e2.fail, byKey: [{key: "over", line: e2.fail.long}, {key: "under", line: e2.fail.short}, {key: "half", line: e2.probe.half}, {key: "double", line: e2.probe.double}, {key: "aligned_multiple", line: e2.probe.double}]}` · success `e2.success` · payoffLine `e2.success2` · after `[e2.after]` |
| `hintTargets` | rung 1: `circle` `ring_center` 1500 ms · rung 2: `land` `inner_hub` 1500 ms · rung 3: `land` `tally` 2000 ms |
| `boss`, `accessories`, `frameZoom` | `null`, `[]`, `null` |

**`config`** (`RingGateConfig`):

```json
{ "flow": "water", "tally": true, "replayOnSettle": true, "ghostCard": true,
  "lapsCardTier": 2, "startMarkerTier": 1, "variant": "notch" }
```

`meta.clock.resetOn: ["open", "settle"]` (the release replay). `validateConfig`: `variant: notch` because
`view.ask` is `period`.

**In-world object** (anchor G = (7400, 836)):
- **Gate wall** (`ring_gate_gate_wall`, hero): 900 × 760 cream stone (x 6950–7850, top y 280) with 5 vertical navy grooves, a gold cap and a dark doorway recess (0.9 H × 1.3 H, arched top) behind the ring's 6 o'clock position.
- **Outer ring** (`ring_gate_outer_ring`, hero): 2.4 H in diameter (408), 34 wide.
  - Gold rim, cream face, and an engraved **wave band**: a sine wave running round the ring in `orrery.engrave`.
  - A **notch** 150 wide at its local 6 o'clock.
  - It is bound to the wave's argument.
- **Inner disc** (`ring_gate_inner_disc`, hero): 340 in diameter, cream, with a matching doorway **cutout** 150 × 221 from its bottom edge.
  - Three concentric navy inlay rings.
  - It is bound to the wave's value.
- **Keystone fin** (`ring_gate_fin_l` + `ring_gate_fin_r`, hero): two gold half-fins above the ring (the Variant "crown"), closed.
- **Tally wheel** (`ring_gate_tally_wheel`, kit `ringStack` teeth): a small gold escapement wheel above the fin. Its 6 teeth carry the static engraved numerals "0 · I · II · III · IIII · V" (spec-independent, engraved at build time). It counts completed laps.
- **Latch pawl** (`ring_gate_pawl`, kit): a bronze pawl on the fin's right. It drops toward the notch and the tally at Verify.
- **Canal** (`ring_gate_canal`, kit `waterBand` canal): dry, from the gate leftward, at 0 % water alpha.
- **Console** (`ring_gate_console`, kit `lectern`) at x 6900.
- **Pin** (`shared.ui.pin` at anchor `tally`): **"I"**.

**Live binding** (T = `draft.input.value`).

| Part | Formula | Chip |
|---|---|---|
| Outer ring angle (argument) | `φ(T) = b·T = 2T`; the sprite rotates `−φ` (clockwise) about G | tier 2: blue chip on the ring rim, **"laps: 0.92"** (= φ/2π) |
| Inner disc rock (value) | `ψ(T) = (π/2)·(y(T) − d)/A = (π/2)·sin(2T)`, so it rocks ±90° | white chip at `inner_hub`: **"y: 0.00"** = sin(2T) |
| Tally wheel | `k(T) = floor(φ/2π + 0.03)` teeth advanced (0 → I at one full lap), ratcheting with a `tally_click` | — |
| Notch misalignment | `δ(T) = wrap(φ)` to (−π, π]. A thin navy arc on the wall from the notch to the 6 o'clock mark shows δ as an angle only, with no number | — |
| Release replay (`config.replayOnSettle`) | when `draft.settled` flips true (pointer up or 300 ms of key idle), the clock resets and the rings replay t = 0 → T in `max(0.6, T/π)` s: the outer ring sweeps 0 → φ and the inner disc rocks through `sin(2t)`, then holds at pose(T). *You watch the machine run for exactly the time you set* (20 §2.5.7) | — |
| `describe().nearMiss` | `aligned_multiple` when the notch is home after more than one lap; `short_of_cycle` under one lap (shown only after a failed Verify) | — |

**Why the tally exists.** At T = 2π the notch is also home, because 2π is a period too, just not the smallest.
The mode grades it wrong ("too long"). The tally shows **II** and the pawl slips on tooth II, so the world agrees
with the grade: "a period is **one** lap".

**Locked predicate** (parity with grade): `locked(T) ⟺ |2T − 2π| ≤ 2·0.1885 ⟺ |T − π| ≤ 0.1885`.

**Instrument panel (scrub layout).**

```
┌──────────────────────── panel ────────────────────────┐
│ [←]                                                    │
│chip┌── f(t): y = sin(2t) (slot 0) ─────────────── [f]┐│  white; y∈[−1.5,1.5] ticks −1,0,1
│◀── │   ∿∿∿∿   x: 0 · π/2 · π · 3π/2 · 2π             ││
│    └───────────────────────────────────────────────────┘│
│    ┌── f(t + T) ghost (slot 1) ────────────────── [g]┐│  faint white f + green shifted copy
│    └───────────────────────────────────────────────────┘│
│chip┌── laps = bt / 2π (slot 2, tier 2) ─────────── [h]┐│  blue line 0→2, floor steps with ●/○ ends
│    └───────────────────────────────────────────────────┘│
│ ┌───┬───────┐ ├──┼──┼──┼──●──┼──┼──┼──┤                  │  ruler = view.dial.ticks
│ │ T │ 0.75π │ 0  π/4 π/2 3π/4 π …   2π                 │
│ └───┴───────┘                                          │
│             ●── [ LOCK THE RINGS ] ──●                 │
└───────────────────────────────────────────────────────┘
```

**Cards.**
- **Slot 0, `graph` f:** `y = A·sin(b t + c) + d` from the view over [dial.min, dial.max]; the orange line at t = T; the chip shows f(T).
- **Slot 1, `graph` ghost** (tier 0, `config.ghostCard`): a `ghost`-style white copy of f at 25 % and the green **dashed** `y = f(t + T)`. When T is a period the two coincide exactly: the "ghost lock" at T = π and at 2π. This is f(t + T) = f(t), drawn. At T = π/2 the ghost is f upside-down: the half-period trap made visible.
- **Slot 2, `graph` laps** (`config.lapsCardTier: 2`): a blue `laps(t) = b·t / 2π` line plus a faint floor step function with filled and hollow `endpoints` (the Variant hole motif). The chip shows laps(T).
- **Tier 1** (`config.startMarkerTier: 1`): a `period_marker` annotation at t = 0 with a small upward arrow for "rising"; the player compares the state at T.
- **Scrubber:** ruler = `view.dial.ticks`; readout π format ("0.75π"); ← / → one `dial.step` (π/12); Shift π/4.

**Verify.** **LOCK THE RINGS** submits `{ value: T }`; `oscillator.grade`.

**Success plan (2.2 s).**

| t (s) | World | Panel |
|---|---|---|
| 0.0 | the pawl drops into the notch and tooth I: `latch_click` | badge **RINGS LOCKED** |
| 0.1–1.3 | both rings spin one more full lap together (ease-out) and stop with the notch and cutout at 6 o'clock: the doorway is open | the ghost card flashes green |
| 1.0–1.4 | the keystone fin halves slide ±24 apart; a light shaft (`orrery_terraces.fx.light_shaft`, additive) pours through the doorway | |
| 1.3–2.2 | **water surges** through the doorway: the canal water front travels left at 600 units/s with splash particles (`water_rush`). A canal **skiff** (`ring_gate_skiff`) floats into view | panel out at 1.6 |
| 2.2 | the blocker clears; the canal props (`restoredBy: e2_period`) turn to water; P1: the S2 `beam_line` draws | — |

**Payoff:** the player walks through the doorway (the only way east) to the exit at x 7990. Brasswick switches to
state `after` (his arm syncs, anim `arm_sync`), which is the P1 quest's middle step.

**Failure plan (1.4 s).**
- The pawl drops.
  - If the notch is not home, it strikes the ring rim: spark, `latch_clack`.
  - If the notch is home but the tally reads ≥ II, it catches tooth II and slips: `latch_slip`, double clack.
- The rings stay at pose(T), and the misalignment arc pulses twice.
- Lines: `failKey` `over` → `e2.fail.long`, `under` → `e2.fail.short`; probes `half` (`|T − π/2| ≤ 0.1885`, the ghost card shows the inverted wave) → `e2.probe.half`; `double` (`|T − 2π| ≤ 0.1885`, the tally shows II) → `e2.probe.double`.

**Misconception made visible:** "bigger b means longer period" pushes players toward T > π. Past π the ring
over-laps, the tally shows more than one lap and the ghost wave slides out of phase. The world shows that sin(2t)
comes home *sooner* than sin(t) would. 4π isn't on the dial (`dial.max = 2π`); the double lap at 2π plays that role.

**Pure tests:** `pose(T)` angles at 0, π/2, π and 2π; `tally(2π) = 2`; locked parity over 400 samples; the ghost
coincidence metric `max|f(t) − f(t + T)| < 1e−9` at T = π; the release replay resets `t`.

---

### 5.3 Seal 3 · The Echo Choir (`e3_amplitude` · `truth_finder.mimic`)

| Fixture fact | Value |
|---|---|
| params.statements | s0 "The amplitude of y = 3sin(x) is 3" (true) · s1 "The amplitude of y = 3sin(x) is 6, peak to trough" (**false**) · s2 "Multiplying sin(x) by 3 leaves its period unchanged" (true) |
| view | `{ chests: [{statementIndex, text}] }`, shuffled by `shuffleNotIdentity(seed)` |
| input | `{ statementIndex }` |
| solution | `mimicIndex: 1` |
| grade feedback | correct: "Mimic exposed. " + explanation · wrong: "That chest was honest: " + explanation (display noun → "singer") |
| misconception | "Amplitude is the distance from peak to trough" |

**Station record.**

| Field | Value |
|---|---|
| `zoneId` · `consoleX` · `anchor` | `z2_crystal` · 1500 · `{x: 2000, y: 1900}` (the court centre on the floor) |
| `contraption` · `skin` | `claim_holders` · `resonance_pillars` |
| `objectNoun` · `partNouns` | "Echo Choir" · `["Tuning Lens", "singer"]` |
| `pins` | `[{anchor: "lift", text: null, glyph: "bell"}]` (the goal is a true chord; it names no singer) |
| `probes` | `[]` (the grade's own explanation carries the misconception) |
| `panel` | `{layout: "board", inputSymbol: null, verifyLabel: "EXPOSE THE MIMIC", successBadge: "MIMIC EXPOSED", cards: [{slot: 0, title: "SINGERS"}, {slot: 1, title: "reference"}, {slot: 2, title: "claim"}, {slot: 3, title: "|y|"}]}` |
| `payoff` | `{kind: "ride", vertical: "up", anim: "lift_moves", noun: "Echo Lift", blocker: {x: 2870, surface: "ground", asset: null}, terrain: [], rideCutsceneId: "e3_lift_up", autoBoardMs: null, feedsHub: true}` |
| dialogue | approach `[e3.approach, e3.approach2]` · instruction `e3.instruction` · tutorial `e3.tutorial` · insight `e3.insight` · hints `[e3.hint1, e3.hint2, e3.hint3]` · fail `{default: e3.fail, byKey: []}` · success `e3.success` · payoffLine `e3.mimic` · after `[e3.success2, e3.after]` |
| `hintTargets` | rung 1: `circle` `lens` 1500 ms · rung 2: `hover` `slate_0`, `slate_1`, `slate_2` in turn, 700 ms each · rung 3: `land` `lens` 1500 ms (the meta never learns which holder is the mimic, so no rung points at it) |
| `boss`, `accessories`, `frameZoom` | `null`, `[]`, `null` |

**`config`** (`ClaimHoldersConfig`, keyed by `statementIndex`; amendments 13 and 27):

```json
{ "holders": [
    { "statementIndex": 0, "footprint": null, "ghost": null,
      "trace": { "fns": [ { "expr": "3*sin(x)", "style": "solid", "color": "g" }, { "expr": "0", "style": "dashed", "color": "g" } ],
                 "brackets": [ { "x0": "pi/2", "y0": "0", "x1": "pi/2", "y1": "3", "label": "amplitude 3" } ], "markers": [] } },
    { "statementIndex": 1, "footprint": null, "ghost": null,
      "trace": { "fns": [ { "expr": "3*sin(x)", "style": "solid", "color": "g" }, { "expr": "3", "style": "dashed", "color": "g" } ],
                 "brackets": [ { "x0": "3*pi/2", "y0": "-3", "x1": "3*pi/2", "y1": "3", "label": "amplitude 6" } ], "markers": [] } },
    { "statementIndex": 2, "footprint": null, "ghost": null,
      "trace": { "fns": [ { "expr": "3*sin(x)", "style": "solid", "color": "g" }, { "expr": "sin(x)", "style": "dashed", "color": "g" } ],
                 "brackets": [ { "x0": "0", "y0": "-3.6", "x1": "2*pi", "y1": "-3.6", "label": "period 2π" } ], "markers": [] } } ],
  "reference": { "expr": "3*sin(x)", "xMin": "0", "xMax": "2*pi", "yMin": -4, "yMax": 4, "xUnit": "pi" },
  "referenceSim": null,
  "probe": { "symbol": "x", "label": "probe x", "min": 0, "max": 6.283185307179586, "step": 0.06544984694978735,
             "unit": "", "format": "pi", "initial": null, "stops": [], "window": null, "playback": false },
  "probeWorld": "trace_slate",
  "scenarioMin": null, "hintPins": [], "fileDates": [],
  "aimer": "tuning_lens", "quarantineAnim": "mimic_crab",
  "secondaryTier": 1, "overlayTier": 2 }
```

Every trace is a *correct drawing of what its claim says*, and every holder has the same style set (one solid,
one dashed), so no style is a tell (the §4.4 validator warning). The dashed second function is the honest
measuring guide of each claim: the midline for s0, the peak level for s1, plain `sin x` for s2.

**In-world object** (anchor K = (2000, 1900)):
- **Three Echo Automata** (`resonance_pillars_automaton_a` / `_b`, hero; `_c` at P1) stand on plinths at x 1580, 2000 and 2420, **in `view.chests` display order**, left to right (anchors `holder_0…2`).
  - Each is 2.5 H tall: a cream shell with gold bands, a navy faceplate (`resonance_pillars_faceplate`, kit `plate`, two halves), and a **bell chest** (`resonance_pillars_bell`, kit).
  - A chest **slate** (`resonance_pillars_slate`, kit `plate` slate, 150 × 100; anchors `slate_0…2`) is the projection screen of the Tuning Lens.
  - A brass **plaque** (`resonance_pillars_plaque`, kit `plate` brass_plaque) on the plinth; its claim text (the view text, 2 lines max) is **DOM** on the plaque's `label` anchor.
  - There are no tells: the mimic's shell uses the same body pool and idle animation.
- **Tuning Lens** (`resonance_pillars_lens_pedestal` + `resonance_pillars_lens_head`, hero) at (2000, 1880), 1.4 H in front of the plinths (anchor `lens`).
- **Echo Lift** (`resonance_pillars_echo_lift` + `resonance_pillars_lift_chain`, kit) at x 2800 (anchor `lift`). It rests on the floor with its **resonator fork** silent. The lift is sound-powered: it rises only to a true chord.
- **Console** (`resonance_pillars_console`, kit `lectern`) at x 1500.
- **Pin** above the resonator fork: the **bell glyph**.
- **World chip** on the Tuning Lens (white border): **"aim: singer B"** (plinth letter A/B/C in display order), live.

**Live binding.**

| Draft | World response |
|---|---|
| `hover`/`focus`/`input.statementIndex = i` (`AimControl` emits on hover and focus, amendment 33) | The lens head rotates toward automaton i's slate: `α_i = atan2(slate_i.y − lens.y, slate_i.x − lens.x)`. The beam (3-line additive) runs from the lens to the slate. The aimed automaton's bell glows cyan and hums; its slate brightens; the other two dim to 60 %. The camera nudges 40 toward it |
| nothing aimed | the lens returns to centre and the beam is off |
| **`probe` = x** (`probeWorld: "trace_slate"`, amendment 27) | The lens **projects the aimed claim's trace onto the singer's chest slate**: the slate draws `holders[i].trace` over the reference domain [0, 2π] (both functions, same styles as the card), its brackets, and a **bright playhead**: a vertical cyan line at x plus a dot on `fns[0]` at `(x, f(x))`. When the playhead passes a bracket's x, that bracket's end caps flash. The **bell hum pitch follows `|f(x)|`**: `pitchHz = 220 · 2^(|f(x)| / 4)` (4 = `max(|yMin|, |yMax|)` of the reference), gain 0.15, via `meta.audio` → `bell_hum`. Muted: a pulse ring on the bell scales with `|f(x)|`. With nothing aimed, the slates are dark and the hum follows the reference. |
| world chip on the aimed slate | **"\|y\|: 3.00"** = `|f(x)|` (tier 0; the distance from the midline, never "6") |

*What the probe teaches:* sweeping x from π/2 to 3π/2, the bell rings at the **same** pitch on the peak and on the
trough, because it sings the distance from the middle. The mimic's "amplitude 6" bracket spans trough to peak while
the bell never goes higher than it does at 3.

**Instrument panel (board layout, 55vw).**

```
┌─────────────────────────── panel ───────────────────────────┐
│ [←]  ┌ SINGERS ┐  ┌── reference y = 3sin(x) (slot 1) ─ [f]┐ │  white; x 0…2π (π labels) · y −4…4
│      │ ◎ bell A │  │   ∿∿    orange probe line at x         │ │
│      │  claim…  │  └──────────────────────────────────────┘ │
│      │ ◎ bell B │  ┌── claim (slot 2, aimed singer) ── [g]┐ │  green trace + dashed guide + bracket
│      │  claim…  │  └──────────────────────────────────────┘ │
│      │ ◎ bell C │  ┌── |y| (slot 3, tier 2) ──────────── [h]┐ │
│      │  claim…  │  └──────────────────────────────────────┘ │
│      └──────────┘  ┌───┬──────┐ ├──┼──●──┼──┼──┤             │  probe ruler 0 · π/2 · π · 3π/2 · 2π
│                    │ x │ 0.5π │                              │
│                    └───┴──────┘                              │
│                 ●── [ EXPOSE THE MIMIC ] ──●                 │
└──────────────────────────────────────────────────────────────┘
```

**Panel elements.**
- **Slot 0, `claims`** (the `AimControl` surface): three claim items in display order, each with a letter glyph (A/B/C), the claim text (3 lines max) and a hollow aim socket; keys **1–3**, ↑/↓; the aimed socket gets an orange ring (aiming is input).
- **Slot 1, `graph` reference** (white): `y = 3 sin x`; the dashed midline `hline` y = 0.
- **Slot 2, `graph` claim** (green): `holders[aimed].trace` drawn literally: both `fns` and the `bracket` annotations (end caps + label). Nothing is styled "wrong".
- **Slot 3, `graph` |y|** (`overlayTier: 2`): blue `|3 sin x|` with a peak label "3".
- **Tier 1** (`secondaryTier: 1`): a blue **"midline"** label on the dashed y = 0 of slots 1 and 2.
- **Probe Scrubber** (`panelStatic.probe`): input tab **"x"**, π-format readout; the orange line crosses slots 1–3. Chips: f(x) (white), the aimed trace at x (green), |f(x)| (blue, tier 2). At x = π/2 the f chip reads 3.00; at 3π/2 it reads −3.00.
- **Verify:** **EXPOSE THE MIMIC**, disabled until a singer is aimed; submits `{ statementIndex }`.

**Success plan (2.4 s, `quarantineAnim: "mimic_crab"`).**

| t (s) | World | Panel |
|---|---|---|
| 0.0 | the lens beam turns gold; the mimic's bell cracks with a dissonant clang (`mimic_hiss`) | badge **MIMIC EXPOSED** |
| 0.2–0.6 | its faceplate halves swing open; steam puff | |
| 0.6–1.4 | the **Mimic crab** (`resonance_pillars_mimic_crab`, legs code-drawn) drops out, stalk eyes pop up (`payoffLine` `e3.mimic`), then it scuttles right through a floor drain grate (`mimic_scuttle`); the empty shell slumps | slot 2: the false bracket shatters into dots |
| 1.4–2.4 | the two true singers ring a **true chord** (`chord_true`); the lift's resonator fork glows, its chains snap taut and the platform lifts 40 off the floor and hovers, powered | panel out at 1.6 |

**Payoff:** the Echo Lift is now a vehicle: E or W on it runs `e3_lift_up` (a 2.2 s ride, 1900 → 1400, `lift_chain`,
Wren `idle` on the platform) to x 2960 on the ledge. It is the only way up; the P1 `s3_shaft_ladder` serves return
trips.

**Failure plan (1.2 s).**
- `Diagnosis.wrongKeys[0]` is the chosen (honest) singer's statementIndex: it rings a clear bell (`bell_honest`) and its plaque glows gold for 2 s.
- A small gold bell glyph stays over it, carrying only the information the grade already gave.
- The lens beam flickers and relaxes; the other singers keep idling.
- Lines: `e3.fail`; line 2 shows the display feedback, e.g. "That singer was honest: Amplitude is |A|, the number in front."

**Misconception made visible:** the mimic's bracket physically spans from the bottom of the swing to the top; the
honest bracket starts at the midline; the bell rings the same at peak and trough.

**Pure tests:** lens aim angles; display order → plinth mapping is stable for the seed; every trace evaluates at
≥ 90 % of 64 samples (`validateConfig`); the slate playhead and `pitchHz` at x = π/2 and 3π/2 are equal; the no-leak
test (pose/describe/panelLive unchanged when `quarantineAnim` is permuted); feedback nouns apply only in display.

---

### 5.4 Seal 4 · The Solving Span (`e4_solve` · `sequencer.linear`)

| Fixture fact | Value |
|---|---|
| params.steps (s0–s3) | "Isolate the sine: sin(x) = 1/2" · "Find the reference angle: sin(π/6) = 1/2" · "Sine is positive in quadrants I and II" · "Write both solutions: x = π/6 and x = 5π/6" |
| params.decoys (d0) | "Take the inverse sine of 2 first" |
| view | `{ slots: 4, planks: [{key, text}] ×5 }` shuffled by `shuffleNotIdentity(seed)` |
| input | `{ keys: string[] }` (4 keys in slot order) |
| solution | `order: [s0, s1, s2, s3]` |
| grade feedback | "Fill all 4 slots." · `"<decoy text>" isn't part of this process.` (checked first) · `Slot N is out of place. What has to happen right before "<text>"?` · correct: "The bridge locks together." |
| misconception | "sin(x) = 1/2 has only one solution on [0, 2π)" |

**Station record.**

| Field | Value |
|---|---|
| `zoneId` · `consoleX` · `anchor` | `z2_crystal` · 3900 · `{x: 4650, y: 1400}` (the chasm's centre at ledge height; the chasm runs x 4200–5100) |
| `contraption` · `skin` | `step_bridge` · `floating_steps` |
| `objectNoun` · `partNouns` | "Solving Span" · `["glyph stones", "span", "socket"]` |
| `pins` | `[{anchor: "pylon_a", text: "x₁", glyph: null}, {anchor: "pylon_b", text: "x₂", glyph: null}]` (two anchors: a visible claim that the equation has two solutions, before anything is solved) |
| `probes` | `[{predicate: "keyInSlot", itemKey: "s3", slot: 2, key: "early"}]` (both solutions laid before the quadrant step) |
| `panel` | `{layout: "board", inputSymbol: null, verifyLabel: "LAY THE SPAN", successBadge: "SPAN LOCKED", cards: [{slot: 0, title: "SPAN"}, {slot: 1, title: "UNIT CIRCLE"}, {slot: 2, title: "2 sin x = 1"}]}` |
| `payoff` | `{kind: "terrain", vertical: "none", anim: "bridge_forms", noun: "Solving Span", blocker: {x: 4190, surface: "ground", asset: null}, terrain: [{surface: "ground", points: [[4198,1400],[4290,1400],[4510,1392],[4730,1392],[4950,1400],[5102,1400]]}], rideCutsceneId: null, autoBoardMs: null, feedsHub: true}` |
| dialogue | approach `[e4.approach, e4.approach2]` · instruction `e4.instruction` · tutorial `e4.tutorial` · insight `e4.insight` · hints `[e4.hint1, e4.hint2, e4.hint3]` · fail `{default: e4.fail, byKey: [{key: "order", line: e4.fail.order}, {key: "decoy", line: e4.fail.decoy}, {key: "early", line: e4.probe.early}]}` · success `e4.success` · payoffLine `e4.success2` · after `[e4.after]` |
| `hintTargets` | rung 1: `land` `socket_0` 1500 ms · rung 2: `circle` `lip_relief` 2000 ms · rung 3: `hover` `pylon_b` 2000 ms |
| `boss`, `accessories`, `frameZoom` | `null`, `[]`, `null` |

**`config`** (`StepBridgeConfig`, keyed by plank key; amendments 13 and 27):

```json
{ "bays": "floating",
  "items": [
    { "key": "s0", "meta": { "printedDate": null, "madeYear": null, "glyph": "balance_div2",      "label": "isolate" } },
    { "key": "s1", "meta": { "printedDate": null, "madeYear": null, "glyph": "angle_wedge",       "label": "reference angle" } },
    { "key": "s2", "meta": { "printedDate": null, "madeYear": null, "glyph": "upper_half_circle", "label": "quadrants" } },
    { "key": "s3", "meta": { "printedDate": null, "madeYear": null, "glyph": "twin_beacons",      "label": "both solutions" } },
    { "key": "d0", "meta": { "printedDate": null, "madeYear": null, "glyph": "arcsin_arrow",      "label": "inverse sine" } } ],
  "stepEffects": [
    { "key": "s0", "effect": "scaleEquation" }, { "key": "s1", "effect": "markAngle" },
    { "key": "s2", "effect": "shadeQuadrants" }, { "key": "s3", "effect": "markSolutions" },
    { "key": "d0", "effect": "missCircle" } ],
  "stages": [],
  "anchors": 2,
  "relief": { "expr": "2*sin(x)", "line": "1" },
  "probe": { "symbol": "x", "label": "probe x", "min": 0, "max": 6.283185307179586, "step": 0.06544984694978735,
             "unit": "", "format": "pi", "initial": null, "stops": [], "window": null, "playback": false },
  "probeWorld": "relief_marker",
  "dayCounter": null, "bayLampsTier": 1, "pageOrderHeading": null }
```

The glyph and label say what a step *says*, never whether it belongs; the key string identifies decoys (`d*`), so
**the world and panel never style a stone by its key before Verify**. `stepEffects` is success-only for the
solution keys; `d0 → missCircle` is read by `failurePlan` only after a `decoy` diagnosis (post-Verify, outside the
no-leak test's `pose`/`describe`/`panelLive` scope).

**In-world object** (anchor B = (4650, 1400)):
- **Chasm edges** (`floating_steps_chasm_edge`, kit `ridgeBand` chasm_edge, mirrored for the far side): grey-teal cliffs with blue crystal roots (`orrery_terraces.prop.crystal_roots`) and mist rising from below (`orrery_terraces.fx.mist_column`).
- **Four span sockets** (`floating_steps_socket`, kit `ringStack` ellipse 0.4; anchors `socket_0…3`): glowing elliptical rings, 140 × 60, floating over the chasm at x 4290, 4510, 4730 and 4950 on a gentle arc (y 1400, 1392, 1392, 1400). Dormant grey. Socket 1 (`socket_0`) is nearest the player.
- **Plank cradle** (`floating_steps_cradle`, kit `shelving` rack_bays; anchors `cradle_0…4`) beside the console at x 4000: a brass rack with 5 bays, each holding a **glyph stone** (`floating_steps_stone`, kit `plate` slab, 220 × 70) with its content glyph (`floating_steps_glyph_<glyph>`, hero, one of five) and its `label` as a DOM chip. The stones sit in `view.planks` display order.

  | Step | Glyph key |
  |---|---|
  | isolate | `floating_steps_glyph_isolate`: a "÷2" balance |
  | reference angle | `floating_steps_glyph_reference`: an angle wedge at 30° with an arc |
  | quadrants | `floating_steps_glyph_quadrants`: a circle with its upper half shaded |
  | both solutions | `floating_steps_glyph_solutions`: twin beacons |
  | decoy | `floating_steps_glyph_arcsin`: a "sin⁻¹" arrow into the circle |

  (`items[].meta.glyph` ids `balance_div2`, `angle_wedge`, `upper_half_circle`, `twin_beacons`, `arcsin_arrow` map to these five keys in the skin.)
- **Two anchor pylons** (`floating_steps_pylon`, kit `column` + `crystalCluster`; anchors `pylon_a`, `pylon_b`) on the far bank at x 5250 and 5420, with dark beacon crystals and the pins **"x₁"** and **"x₂"**.
- **The lip relief** (`floating_steps_relief`, kit `plate` slab band, anchor `lip_relief` at (3950, 1500), i.e. B + (−700, +100)): a 480 × 200 stone band set into the near cliff face just below the walk line. The curve `config.relief.expr` = `2 sin x` over [0, 2π] is **code-drawn** on it as a bronze inlay (x scale 480/2π per unit, 40 units per y unit), with the **water line** `config.relief.line` = 1 as a turquoise inlay 40 above the relief's midline. The **plumb marker** is a small brass bob hanging on a thread from a rail above the band.
- **Console** (`floating_steps_console`, kit `lectern`) at x 3900.

**Live binding.**

| Draft change | World |
|---|---|
| a key placed in slot j (`SlotRailControl`) | its stone lifts from the cradle and flies on a bezier arc (0.45 s, `stone_float`) to socket j, then hovers with a ±4 bob at 0.5 Hz and a faint cyan underglow. Socket j brightens to "occupied" |
| a key removed | the stone flies back to its cradle bay |
| a key moved between slots | the stone flies socket to socket |
| all 4 filled (`draft.complete`) | a faint dotted guide-line connects the sockets to the far anchors: "ready", not a verdict |
| **`probe` = x** (`probeWorld: "relief_marker"`, amendment 27) | the **plumb marker rides the relief**: the bob slides along the rail to `u = x · 480/2π` and its tip drops to the relief height `2 sin x` (eased like every pose). Where the relief crosses the water line (`2 sin x = 1`, found numerically from `relief.expr` and `relief.line`, never from the solution), a **glint** fires as the marker passes within half a probe step: a 4-point sparkle at the crossing plus `relief_glint`. The glints are a property of the equation shown on the card, independent of the stone order, so they reveal nothing about the task |
| world chip on the marker | **"2 sin x: 1.00"** (white) |

**Instrument panel (board layout).**

```
┌──────────────────────────── panel ─────────────────────────────┐
│ [←]  ┌ STONES ┐   ┌── SPAN (slot 0, slot_rail) ────────────────┐ │
│      │ ▭ glyph │   │ ◯1 ─ ◯2 ─ ◯3 ─ ◯4 ──── ▲x₁   ▲x₂        │ │  socket row mirrors the chasm
│      │  text…  │   └───────────────────────────────────────────┘ │
│      │ ▭ …     │   ┌── UNIT CIRCLE (slot 1) ┐ ┌── 2 sin x = 1 (slot 2) ┐│
│      │ ▭ …     │   │  (nothing lit yet)     │ │  white f, green dashed g ││
│      │ ▭ …     │   │                        │ │  probe line at x         ││
│      └─────────┘   └────────────────────────┘ └──────────────────────────┘│
│                    ┌───┬──────┐ ├──┼──●──┼──┤                    │
│                    │ x │ 0.3π │                                   │
│                    └───┴──────┘                                   │
│                    ●── [ LAY THE SPAN ] ──●                       │
└──────────────────────────────────────────────────────────────────┘
```

**Panel elements.**
- **Stone column** (`SlotRailControl`): 5 stone tokens in display order, each with its glyph and the full step text. Click a stone, then a socket; keyboard Tab to a stone, Enter to pick, **1–4** to place, Backspace to return it. Placed stones grey out in the column.
- **Slot 0, `slot_rail`:** 4 sockets numbered left to right, drawn as hollow circles joined by trace lines, ending at two pylon glyphs (`anchorsRight: 2`).
- **Slot 1, `unit_circle`:** circle and axes, dormant at tier 0. **Tier 2:** `level: 0.5` (a faint horizontal line at y = 1/2; hint 2 already names it).
- **Slot 2, `graph`:** f = `2 sin x` (white) and g = `y = 1` (green dashed) over [0, 2π], y −2.5…2.5. The probe chips show f(x) and 1. The two crossings are visible but unmarked: honest, and the order of steps is still the task.
- **Tier 1:** a `shade` annotation where f > 1 (the two "humps above the line").
- **Probe Scrubber:** tab **"x"**, π-format readout, the orange line through slot 2.
- **Verify:** **LAY THE SPAN**, disabled until all 4 sockets are filled; submits `{ keys }` (the view's plank keys, unchanged).

**Success plan (2.5 s).** The solution replays as the bridge locks (`SuccessPlan.cardEffects` from
`config.stepEffects`). Each step is 0.5 s: the stone drops into its socket, `stone_lock_thunk`, a dust puff and a
gold seam glint.

| Step | World | Card effect (the maths *is* the success animation) |
|---|---|---|
| 1 · isolate (`scaleEquation`) | stone 1 locks | slot 2 morphs f `2 sin x → sin x` and g `1 → 1/2`; a `caption` types "sin(x) = 1/2" |
| 2 · reference angle (`markAngle`) | stone 2 locks; the **x₁** beacon glows faintly | slot 1: the point at π/6 lights, the green drop shows height 1/2, a white arc 0 → π/6; slot 2: the first crossing fills at π/6 |
| 3 · quadrants (`shadeQuadrants`) | stone 3 locks | slot 1: `shadeUpperHalf` (QI, QII at 20 % blue, labels I and II); the dashed `mirror` carries π/6 → 5π/6 |
| 4 · both solutions (`markSolutions`) | stone 4 locks; **both beacons ignite** (x₁ then x₂, 0.2 s apart, `beacon_ignite`); code-drawn anchor cables snap taut to both pylons (`cable_snap_taut`) | slot 2: the second crossing fills at 5π/6; both glow |
| +0.5 | stone seams fuse gold; `payoff.terrain` merges; P1: the S4 `beam_line` draws | badge **SPAN LOCKED** (shown from t = 0); panel out at 1.6 |

**Payoff:** the player walks across the span (the only route) to the far bank.

**Failure plan (1.6 s),** from `Diagnosis` (`failKey`, `prefix`, `wrongKeys`):
- **Correct prefix** (`prefix` = the length the grade's "Slot N" implies): those stones lock with gold seams and their card effects replay. If the prefix covers step 2, the **x₁** beacon glows faintly while **x₂ stays dark** and its cable hangs slack. *One solution is not enough, visibly.*
- **`order` at slot N:** stone N tilts 20°, grinds (`stone_grind`) and slides back to hover. Stones after N dim to 50 %. Line: `e4.fail.order` (or `e4.probe.early` when s3 sits in slot index 2, the third socket); line 2 shows the mode's "Slot N is out of place…".
- **`decoy`:** the decoy stone cracks (P1 crumble frames; P0 a scale-out plus dust) and falls into the chasm (`stone_crumble`). Slot 1 plays `missCircle`: a horizontal line at y = 2 hovering above the circle, missing it, because sine never reaches 2. Line: `e4.fail.decoy`. The stone re-forms in its cradle bay after 1.2 s.
- After 1.6 s, unlocked stones return to hovering. The arrangement persists.

**Misconception made visible:** the two pins, the slack second cable on partial solves, the two relief glints,
and both beacons lighting at the end.

**Pure tests:** socket positions; prefix locks for 6 orders (from `Diagnosis.prefix`); the decoy path; `stepEffects`
keys ⊆ view keys; `relief` expressions evaluate (warning in `validateConfig`) and the numerically found crossings
are π/6 and 5π/6 within 1e−6; the no-leak test permutes `stepEffects`.

---

### 5.5 Seal 5 · The Chime Treasury (`e5_period_review` · `truth_finder.mimic`)

The same archetype as §5.3 (`claim_holders`) with the **`treasury_pillars`** skin, a different reference and
different claim traces. It is the review encounter, so the escalation is narrated ("trickiest choir yet"), there is
no tutorial line, and aids come later.

| Fixture fact | Value |
|---|---|
| params.statements | s0 "y = sin(2x) repeats every π, twice as often as sin(x)" (true) · s1 "y = sin(2x) has period 4π, twice that of sin(x)" (**false**) · s2 "y = cos(x/2) has period 4π, stretched out" (true) |
| solution | `mimicIndex: 1` |
| misconception | "sin(2x) has period 4π" |

**Station record.**

| Field | Value |
|---|---|
| `zoneId` · `consoleX` · `anchor` | `z2_crystal` · 8500 · `{x: 8800, y: 800}` |
| `contraption` · `skin` | `claim_holders` · `treasury_pillars` |
| `objectNoun` · `partNouns` | "Chime Treasury" · `["lens", "singer", "period bracket"]` |
| `pins` | `[{anchor: "chest_hinge", text: null, glyph: "bell"}]` (the chest opens to a true chord) |
| `probes` | `[]` |
| `panel` | `{layout: "board", inputSymbol: null, verifyLabel: "EXPOSE THE MIMIC", successBadge: "MIMIC EXPOSED", cards: [{slot: 0, title: "SINGERS"}, {slot: 1, title: "reference"}, {slot: 2, title: "claim"}, {slot: 3, title: "period marks"}]}` |
| `payoff` | `{kind: "terrain", vertical: "up", anim: "stairs_rise", noun: "rim stair", blocker: {x: 9330, surface: "ground", asset: null}, terrain: [{surface: "ground", points: [[9338,800],[9340,720],[9398,720],[9400,640],[9448,640],[9450,560],[9498,560],[9500,480],[9548,480],[9550,400],[9600,400]]}], rideCutsceneId: null, autoBoardMs: null, feedsHub: true}` |
| dialogue | approach `[e5.approach, e5.approach2]` · instruction `e5.instruction` · tutorial `null` · insight `e5.insight` · hints `[e5.hint1, e5.hint2, e5.hint3]` · fail `{default: e5.fail, byKey: []}` · success `e5.success` · payoffLine `e5.mimic` · after `[e5.success2, e5.after]` |
| `hintTargets` | as §5.3 (rung 1 `circle` `lens`; rung 2 `hover` `slate_0…2`; rung 3 `land` `lens`) |
| `boss`, `accessories`, `frameZoom` | `null`, `[]`, `null` |

**`config`** (`ClaimHoldersConfig`):

```json
{ "holders": [
    { "statementIndex": 0, "footprint": null, "ghost": null,
      "trace": { "fns": [ { "expr": "sin(2*x)", "style": "solid", "color": "g" } ],
                 "brackets": [ { "x0": "0", "y0": "-1.3", "x1": "pi", "y1": "-1.3", "label": "period π" } ],
                 "markers": [ { "x": "pi", "y": "0", "kind": "period" }, { "x": "2*pi", "y": "0", "kind": "period" },
                              { "x": "3*pi", "y": "0", "kind": "period" }, { "x": "4*pi", "y": "0", "kind": "period" } ] } },
    { "statementIndex": 1, "footprint": null, "ghost": null,
      "trace": { "fns": [ { "expr": "sin(2*x)", "style": "solid", "color": "g" } ],
                 "brackets": [ { "x0": "0", "y0": "-1.3", "x1": "4*pi", "y1": "-1.3", "label": "period 4π" } ],
                 "markers": [ { "x": "pi", "y": "0", "kind": "period" }, { "x": "2*pi", "y": "0", "kind": "period" },
                              { "x": "3*pi", "y": "0", "kind": "period" }, { "x": "4*pi", "y": "0", "kind": "period" } ] } },
    { "statementIndex": 2, "footprint": null, "ghost": null,
      "trace": { "fns": [ { "expr": "cos(x/2)", "style": "solid", "color": "g" } ],
                 "brackets": [ { "x0": "0", "y0": "-1.3", "x1": "4*pi", "y1": "-1.3", "label": "period 4π" } ],
                 "markers": [ { "x": "4*pi", "y": "1", "kind": "period" } ] } } ],
  "reference": { "expr": "sin(x)", "xMin": "0", "xMax": "4*pi", "yMin": -1.5, "yMax": 1.5, "xUnit": "pi" },
  "referenceSim": null,
  "probe": { "symbol": "x", "label": "probe x", "min": 0, "max": 12.566370614359172, "step": 0.06544984694978735,
             "unit": "", "format": "pi", "initial": null, "stops": [], "window": null, "playback": false },
  "probeWorld": "trace_slate",
  "scenarioMin": null, "hintPins": [], "fileDates": [],
  "aimer": "tuning_lens", "quarantineAnim": "mimic_crab",
  "secondaryTier": 1, "overlayTier": 2 }
```

The period markers are where each trace returns to its starting value moving the same way; s0 and s1 draw the
same function, so they carry the same markers (no tell). All holders use one solid function.

**In-world object** (anchor K5 = (8800, 800)):
- Three treasury automata at x 8560, 8800 and 9040 (the same body pool; `treasury_pillars` tints the bells `gold.hi` and the plaques navy).
- A Tuning Lens at (8800, 780).
- The **Treasury Chest** (`treasury_pillars_chest_body` + `treasury_pillars_chest_lid`, hero; anchor `chest_hinge`) on a dais at x 9300, with a gold lock-dial that only turns to a true chord.
- The **rim stair**: 5 flush step slots (`treasury_pillars_rim_step`, kit `stairs`) in the cliff at x 9340–9600, rising to 400.

**Live binding:** identical to §5.3 (aim → lens, beam, hum, dimming), and the **probe moves the world the same
way** (`trace_slate`): the aimed slate shows its claim trace over [0, 4π] with a playhead at x; the bell hum pitch
follows `|f(x)|` (`pitchHz = 220 · 2^(|f(x)| / 1.5)`). Sweeping the probe, `sin(2x)` makes the bell warble through
eight swells across [0, 4π] while `cos(x/2)` swells twice: the player *hears* four cycles inside the mimic's 4π
bracket against one inside the honest one.

**Panel (board):** the §5.3 layout.
- **Slot 1 reference:** `y = sin x` over **[0, 4π]**, x labels π, 2π, 3π, 4π, y −1.5…1.5.
- **Slot 2 claim:** the aimed holder's trace and bracket.

  | Statement | Trace | Bracket |
  |---|---|---|
  | s0 | green `sin(2x)` | [0, π], "period π" |
  | s1 (mimic) | green `sin(2x)` | [0, 4π], "period 4π": it visibly contains **four** humps-and-troughs |
  | s2 | green `cos(x/2)` | [0, 4π], "period 4π", containing exactly **one** cycle |

- **Slot 3** (`overlayTier: 2`): blue `period_marker`s at the aimed trace's `markers` (sin 2x gets 4 inside [0, 4π]; cos(x/2) gets 1 at 4π).
- **Tier 1** (`secondaryTier: 1`): the midline labels. (Revision 1 also drew a "one cycle" bracket over [0, 2π] on the reference at tier 1; `ClaimHoldersConfig.reference` has no bracket field, so this is not folded.)
- **Probe:** x ∈ [0, 4π]; chips show sin x and the aimed trace value.
- **Verify:** **EXPOSE THE MIMIC**.

**Success plan (2.5 s).**
1. The mimic exposure beat of §5.3, compressed to 1.2 s (`payoffLine` `e5.mimic`).
2. A true chord rings (`chord_true`).
3. The **chest's lock-dial** spins and clicks (`chest_unlock`); the lid rotates −70° about `chest_hinge` (0.6 s) and gold light spills out.
4. The **Warden's key-stone** (`orrery_terraces.prop.warden_keystone`, kit `ringStack`) floats up and fades toward Wren (P2: Page 5 appears as a collectible on the dais).
5. The **rim stair** slides out of the cliff one step at a time (5 steps, 0.15 s stagger, 80 rises, `spoke_extend_clunk`); `payoff.terrain` merges.
6. P1: the S5 `beam_line` draws.

**Payoff:** the player climbs the rim stair to the exit at x 9590 (`vertical_up` into `z3_dome`).

**Failure plan:** as §5.3; line `e5.fail`; the honest singer's bracket flashes a green dot at each end ("one
cycle"), exactly the grade's explanation ("2π/|b| = 2π/2 = π") made visual.

**Misconception made visible:** the mimic's 4π bracket over sin(2x) holds four cycles, and the bell warbles four
times inside it.

---

### 5.6 Seal 6 · The Warden's Shield (`e6_boss` · `tuner.oscillator`, ask `period`)

| Fixture fact | Value |
|---|---|
| params | `wave: sin, amplitude: 3, b: "pi/2", c: "0", d: 0, ask: period` |
| view | `{equation: "y = 3sin((π/2)t)", ask: period, amplitude: 3, b: π/2, c: 0, d: 0, dial: {min 0, max 8, step 0.05, ticks 0…8 every 1}}`. The answer 4 is not a π multiple, so the dial is numeric |
| input | `{ value: T }` |
| solution | `period 4, answer 4` |
| tolerance | `0.03 × 8 = 0.24` |
| grade feedback | "A period of X is too long: the rings drift behind" / "too short: the rings race ahead. One full cycle of sin(b·t) takes 2π/\|b\|." |
| misconception (boss) | the big swing: confusing amplitude (3) or peak-to-trough (6) with timing |

**Station record.**

| Field | Value |
|---|---|
| `zoneId` · `consoleX` · `anchor` | `z3_dome` · 3550 · `{x: 4700, y: 1200}` (the Star Door's centre at floor level) |
| `contraption` · `skin` | `pendulum_sync` · `wardens_shield` |
| `objectNoun` · `partNouns` | "Warden's Shield" · `["counter-pendulum", "shield", "sync thread"]` |
| `pins` | `[{anchor: "shield_boss", text: null, glyph: "metronome"}]` (the target is *this rhythm*; no number) |
| `probes` | `[{predicate: "nearValue", value: "3", tolFactor: 1, key: "reach"}, {predicate: "nearValue", value: "6", tolFactor: 1, key: "reach"}, {predicate: "nearValue", value: "2", tolFactor: 1, key: "half"}]` |
| `panel` | `{layout: "scrub", inputSymbol: "T", verifyLabel: "MATCH THE RHYTHM", successBadge: "RESONANCE LOCKED", cards: [{slot: 0, title: "shield"}, {slot: 1, title: "pendulum"}, {slot: 2, title: "drift"}]}` |
| `payoff` | `{kind: "remove_blocker", vertical: "none", anim: "door_opens", noun: "Star Door", blocker: {x: 4400, surface: "ground", asset: null}, terrain: [], rideCutsceneId: null, autoBoardMs: null, feedsHub: true}` |
| dialogue | approach `[]` (the arena cutscene speaks) · instruction `e6.instruction` · tutorial `e6.tutorial` · insight `e6.insight` · hints `[e6.hint1, e6.hint2, e6.hint3]` · fail `{default: e6.fail.cog, byKey: []}` · success `e6.success` · payoffLine `e6.success.warden` · after `[]` (the finale follows) |
| `boss` | `{speakerId: "warden", arenaTriggerX: 3000, arenaCutsceneId: "e6_arena", arenaBounds: {x0: 2400, x1: 5400}, phases: [], taunts: {approach: [], fail: [e6.fail.any], byKey: [{key: "over", line: e6.fail.long}, {key: "under", line: e6.fail.short}, {key: "reach", line: e6.probe.reach}, {key: "half", line: e6.probe.half}]}, music: "boss"}` |
| `hintTargets` | rung 1: `circle` `shield_boss` 2000 ms · rung 2: `land` `pylon_pivot` 1500 ms · rung 3: `ride` `bob` 4000 ms (Cog rides the bob through one full swing) |
| `accessories`, `frameZoom` | `[]`, `null` |

**`config`** (`PendulumSyncConfig`):

```json
{ "spanUnitPx": 94, "armPx": 300, "shieldArmPx": 442, "swingDeg": 14, "spanTiles": 7,
  "driftCardTier": 1, "peakDotsTier": 2, "slowTimeToggle": false }
```

`slowTimeToggle` becomes `true` at P2 (the "time × 0.5" toggle, §6.9). `meta.sim` = `pendulum_beat` (20 §4.2:
state `φp`, `φs`, brightness `B`, beat Hz); `meta.clock.resetOn: ["open", "settle"]` plus the shield's own clock
from the arena trigger.

**In-world object** (anchor D = (4700, 1200)):
- **Star Door** (`wardens_shield_star_door_l` + `_star_door_r`, hero; anchor `door_center`): two tall cream leaves with gold star inlays, 260 × 700 each, in the dome's back wall.
- **The Warden** (`wardens_shield_warden_body`, hero, head and torso in one file; the plinth is `orrery_terraces.prop.warden_plinth`, kit `stairs` stepped_plinth): a 5.5 H sentinel standing right of the door at x 5150, facing left.
  - Its right shoulder pivot (anchor `shoulder`) is at **(5020, 486)**, i.e. 1200 − 4.2 H.
  - The arm (`wardens_shield_warden_arm`, hero, rigid in this fight, length **L = 442** = `config.shieldArmPx`) holds the **shield** (`wardens_shield_shield`, hero, 2.4 H across; anchor `shield_boss`) so that the shield's centre hangs at the door's centre height, y = 1200 − 1.6 H = 928.
  - The **visor** (`wardens_shield_visor`, hero, additive) glows in the helmet slit.
- **Span tiles** (`wardens_shield_span_tile` ×7, kit): 7 floor tiles under the door; their numerals −3 … 3 are DOM chips. They make "3 spans either way" measurable (`config.spanTiles: 7`, `spanUnitPx: 94`), which sets up the Warden's "six spans" taunt.
- **Counter-pendulum** (`wardens_shield_counter_pylon`, kit `column`; `wardens_shield_pendulum_arm`, kit `linkStrip` rod; `wardens_shield_bob`, kit `ringStack`) beside the console at x 3700: a 3 H gold pylon with a pivot at the top (`pylon_pivot`), a 300 arm (`armPx`) and a bronze bob with a cyan core (`bob`).
- **Sync thread**: a code-drawn beam from `bob` to `shield_boss`.
- **Pin** above the shield: the **metronome glyph**.
- The shield rim carries its equation **as a DOM label** from `view.equation` ("y = 3sin((π/2)t)"), not engraving (02 §3e).
- **Console** (`wardens_shield_console`, kit `lectern`) at x 3550.

**Real-time motion** (independent of the panel; τ = seconds since the arena trigger, 20 §2.8).
- **Shield displacement in spans:** `s(τ) = 3·sin((π/2)·τ)`. On screen, `x = D.x + s·U` with `U = 94` (0.55 H), so the sweep is ±282 across the door.
  - The arm angle is `α = asin(s·U / L)`, with L = 442, so α peaks at about ±39.6°.
  - The shield takes 4 real seconds per sweep cycle, so the player *feels* the period before touching anything.
  - `shield_swoosh` peaks at each pass through centre.

**Live binding** (T = `draft.input.value`; sim `pendulum_beat`).

| Part | Formula |
|---|---|
| Pendulum phase | `φp += 2π·dt / max(T, 0.25)`; angle `β = 14°·sin(φp)` (`swingDeg`). At T < 0.25 the pendulum shivers in place |
| Shield phase | `φs = (π/2)·τ` |
| Sync thread | `Δ = wrap(φs − φp)`; brightness `B = ½(1 + cos Δ)`; width `2 + 4B`; alpha `0.25 + 0.75B`. When B < 0.3 the thread sags (a quadratic curve with sag `(1 − B)·60`) and throws a spark every 0.5 s. Its pitch (`sync_hum`) follows B |
| Common-start reset | on panel open **and** on each settle, the shield eases to centre (0.3 s) and **τ and φp restart at 0 together**, so drift is always measured from a shared start. With T ≠ 4 the thread beats at `\|1/4 − 1/T\|` Hz: visibly drifting apart, then briefly realigning |
| World chip | green border, on the pendulum pylon: **"T: 4.00 s"** (the live input value) |
| Locked predicate | `\|T − 4\| ≤ 0.24`. There the beat period is ≥ 62 s, so the thread reads as steady, in parity with grade |

**Instrument panel (scrub layout).**

```
┌──────────────────────── panel ────────────────────────┐
│ [←]                                                    │
│chip┌── shield: y = 3sin((π/2)t) (slot 0) ──────── [f]┐ │  white; t 0…8 · y −4…4 (labels −4,−2,0,2,4)
│◀── │   ⌒   ⌒   (tier 2: peak dots)                  │ │
│    └────────────────────────────────────────────────┘ │
│    ┌── pendulum: y = sin(2πt/T) (slot 1) ─────── [g]┐│  green, amplitude 1 on the SAME axes;
│    │   faint white copy of f behind                   ││  heights differ, timing may not
│    └────────────────────────────────────────────────┘ │
│chip┌── drift = t(1/4 − 1/T) cycles (slot 2, tier 1) [h]┐│ blue; y −2…2
│    └────────────────────────────────────────────────┘ │
│ ┌───┬──────┐ ├──┼──┼──┼──●──┼──┼──┼──┤                  │  ruler 0…8 = view.dial.ticks
│ │ T │ 4.00 │ 0  1  2  3  4  5  6  7  8                  │
│ └───┴──────┘                                           │
│            ●── [ MATCH THE RHYTHM ] ──●                 │
└───────────────────────────────────────────────────────┘
```

**Cards.**
- **Slot 0, `graph` shield:** the shield wave from the view; the orange line at t = T; the chip shows f(T), which reads **0.0 at both T = 2 and T = 4**: the half-period trap, visible on the chip.
- **Slot 1, `graph` pendulum:** the player's wave drawn **at amplitude 1** on slot 0's axes, over a `ghost` f. The size mismatch is deliberate: the waves can agree in *timing* without agreeing in *height*.
- **Slot 2, `graph` drift** (`driftCardTier: 1`): the phase drift line, flat at T = 4; the chip shows drift(T) = T/4 − 1.
- **Tier 2** (`peakDotsTier: 2`): `marker`s at the shield's peaks (t = 1, 5) for peak-to-peak spacing.
- **Keyboard:** ← / → 0.05; Shift 0.5.

**Verify.** **MATCH THE RHYTHM** submits `{ value: T }`; `oscillator.grade`.

**Boss beats** (still one `grade()` call).

| Phase | Trigger | Content |
|---|---|---|
| A · Wake | crossing x 3000 (`boss.arenaTriggerX`) | `e6_arena`: music `boss`; the Warden re-saturates from the feet up (1.2 s, `station wake`), the visor ignites and the shield begins to swing; lines `e6.approach`, `e6.warden1` (fixture), `e6.warden2`. The camera clamps to [2400, 5400] |
| B · Tune | panel open | scrub layout with the Warden and shield framed in the left 58 %; aid tiers as above; failures loop back here |
| C · Verdict | Verify | success below, or failure with a Warden taunt first, then Cog |

**Success plan (2.5 s, then `finale`, §4.5).**

| t (s) | World | Panel |
|---|---|---|
| 0.0 | the sync thread turns gold and thickens to 8; `resonance_lock` | badge **RESONANCE LOCKED** |
| 0.0–1.0 | the shield's swing amplitude decays to 0 (ease-out) while it swings in lockstep with the pendulum. It stops at far right, clear of the door | |
| 1.0–1.8 | the Warden lowers the shield and **kneels**: body −120, head bow 15° (a body rotation), plinth dust; `warden_bow_rumble`. `payoffLine` `e6.success.warden` (fixture) | `success` `e6.success` |
| 1.6–2.4 | the Star Door leaves slide apart (0.8 s, `door_slide`); starlight spills out; P1: the first dome constellation pings | panel out |
| 2.5 | the blocker clears; `PAYOFF_DONE` → `finale` | — |

**Failure plan (1.6 s).**
- The sync thread **snaps** with a spark and the shield deflects the broken end: `thread_snap`.
- The Warden's visor flares. It speaks first (`boss.taunts`): `over` → `e6.fail.long`, `under` → `e6.fail.short`, probe `reach` (`|T − 3| ≤ 0.24` or `|T − 6| ≤ 0.24`, the amplitude or peak-to-trough confusion; the span tiles −3 … 3 flash to show that 3 and 6 are *distances*) → `e6.probe.reach`, probe `half` (`|T − 2| ≤ 0.24`) → `e6.probe.half`, otherwise `e6.fail.any`.
- Cog follows with `e6.fail.cog` (`fail.default`). The display feedback shows in line 2.
- No damage and no reset: the pendulum resumes at T.

**Misconception made visible:**
- The shield's sweep is huge and labelled in spans. The Warden shouts "six spans".
- The pendulum's swing is small, yet at T = 4 the two move in perfect lockstep.
- *How far* and *how often* are shown to be independent.

**Pure tests:** `syncBrightness(T = 4, τ)` ≥ 0.99 for τ ≤ 30 s; `beatHz(T)` values; locked parity over 400 samples;
the probe predicates (with the oscillator tolerance `0.03 × 8`); the sim resets on open and settle.

---

### 5.7 Summary: bindings at a glance

| Enc | Station (skin) | Layout | Control → draft | Orange input moves (world) | Verify | Badge | Payoff (`kind` / `vertical` / `anim`) |
|---|---|---|---|---|---|---|---|
| e1 | Vesper Dial (`emitter_rail` / `vesper_dial`) | scrub | `ScrubControl` → `{value}` θ | carriage `C + 310(cos θ, −sin θ)`, beam angle θ, sin plumb, cos slide | ALIGN THE DIAL | VESPER ALIGNED | terrain / up / `stairs_rise`: spoke stair +400 |
| e2 | Tidewheel Gate (`ring_gate` / `ring_gate`) | scrub | `ScrubControl` → `{value}` T | outer ring `−2T`, inner disc `(π/2) sin 2T`, tally `⌊2T/2π⌋`, release replay | LOCK THE RINGS | RINGS LOCKED | remove_blocker / none / `door_opens` + water |
| e3 | Echo Choir (`claim_holders` / `resonance_pillars`) | board | `AimControl` → `{statementIndex}`; probe x | lens → singer i, beam, hum; **probe: slate trace + playhead, bell pitch ∝ \|f(x)\|** | EXPOSE THE MIMIC | MIMIC EXPOSED | ride / up / `lift_moves`: Echo Lift +500 |
| e4 | Solving Span (`step_bridge` / `floating_steps`) | board | `SlotRailControl` → `{slots}`; probe x | stones fly to sockets 1–4; **probe: plumb marker on the `2 sin x` lip relief, glints at `y = 1`** | LAY THE SPAN | SPAN LOCKED | terrain / none / `bridge_forms`: 900 gap |
| e5 | Chime Treasury (`claim_holders` / `treasury_pillars`) | board | `AimControl` → `{statementIndex}`; probe x | as e3 over [0, 4π] | EXPOSE THE MIMIC | MIMIC EXPOSED | terrain / up / `stairs_rise`: rim stair +400 |
| e6 | Warden's Shield (`pendulum_sync` / `wardens_shield`) | scrub | `ScrubControl` → `{value}` T | pendulum `14° sin φp`, `φp += 2π dt/T`, sync thread `½(1 + cos Δ)` vs the real-time shield `3 sin(πτ/2)` | MATCH THE RHYTHM | RESONANCE LOCKED | remove_blocker / none / `door_opens` → finale |

W1 holds: `z1` has e1 (up), `z2` has e3 and e5 (up), `z3` has only e6 (none) — **W1 warns for `z3_dome`**; the
Star Door is a door by design, and the finale's vista carries the "up" beat. Logged as an accepted warning.

### 5.8 The six `config` objects (copy-paste for `fixtures/worlds/trig.world.json`)

| Station | `contraption` / `skin` | `config` |
|---|---|---|
| `e1_radians` | `emitter_rail` / `vesper_dial` | §5.1 |
| `e2_period` | `ring_gate` / `ring_gate` | §5.2 |
| `e3_amplitude` | `claim_holders` / `resonance_pillars` | §5.3 |
| `e4_solve` | `step_bridge` / `floating_steps` | §5.4 |
| `e5_period_review` | `claim_holders` / `treasury_pillars` | §5.5 |
| `e6_boss` | `pendulum_sync` / `wardens_shield` | §5.6 |

The JSON blocks in §5.1–§5.6 are complete: every field of the 20 §4.2 schema is present, including those equal to
their defaults, so `meta.configSchema.parse` is the identity on them. Probe `max`/`step` are the float values of
2π, 4π and π/48 (`ProbeSpec` fields are numbers, not expressions). **Vertical-slice note (20 §7.2):** C0 writes these six
configs into the side-car from T0 + 2; e3–e6 render on W0's stub prefabs until KA3 lands (T0 + 11). `console_slate`
(`skin: "lectern_slate"`, `config: {"slateTitle": null}`, same console x, anchors and dialogue) is only fallback
ladder step 3 (20 §0.1.6).

---

## 6 · Side content and purpose systems

### 6.1 Objective HUD, progress effects and hub

- **ObjectiveRing** (20 §2.6): `story.objectiveLabel` "RHYTHMS"; the arc fills per solved station **in the current
  zone** (z1: 2, z2: 3, z3: 1) and re-segments with a 400 ms sweep on zone change. Tooltip and SR: "Restore the
  orrery's starlight · 2 of 2 rhythms". It pulses when a station is restored and derives from `progress.solvedIds`
  (D3). The objective line reads `RHYTHMS 1/2` for 4 s on zone entry and on J.
- **Zone title card:** the `z2_entry` / `z3_entry` `title` steps ("Crystal Stair", "The Warden's Dome").
- **No meter** (`story.meter: null`): the purpose is the beams and the ring.
- **Progress effects (P1)** (`story.progressEffects`):

  | encounterId | kind | zoneId | from (pylon top) | to (tower crown) / socket |
  |---|---|---|---|---|
  | `e1_radians` | `beam_line` (`L1_far`) | `z1_sunward` | [5560, 900] | [7800, 60] |
  | `e2_period` | `beam_line` | `z1_sunward` | [7900, 520] | [7800, 60] |
  | `e3_amplitude` | `beam_line` | `z2_crystal` | [2960, 1000] | [9000, 0] |
  | `e4_solve` | `beam_line` | `z2_crystal` | [5420, 1000] | [9000, 0] |
  | `e5_period_review` | `beam_line` | `z2_crystal` | [9300, 420] | [9000, 0] |
  | `e6_boss` | `beam_line` | `z3_dome` | [4700, 300] | [5200, 0] |
  | `e1_radians` … `e6_boss` | `hub_socket` | `z3_dome` | — | sockets 0 … 5 (socket 6 lights in the finale `hub restored` step) |

  Beam points are zone units where the pylon stands; the host projects the far end through the L1 scroll factor so
  the beam lands on the tower as the camera moves.
- The existing `MasteryHud` is the P0 journal (J) and becomes the map's Mastery tab at P2.

### 6.2 The Orrery Map (M, P2)

`story.map` (20 `MapOverlay`), `style: "terraces_profile"`, `title: "Orrery Map"`, `tabs: ["map", "journal", "mastery"]`:

| node id | label | sub | zoneId | stations | at |
|---|---|---|---|---|---|
| `s0` | Sunward Landing | null | `z1_sunward` | [] | [0.08, 0.86] |
| `s1` | Vesper Court | null | `z1_sunward` | [`e1_radians`] | [0.22, 0.80] |
| `s2` | Tidewheel Gate | null | `z1_sunward` | [`e2_period`] | [0.36, 0.66] |
| `s3` | Hall of Echoes | null | `z2_crystal` | [`e3_amplitude`] | [0.48, 0.60] |
| `s4` | Chasm of Two Answers | null | `z2_crystal` | [`e4_solve`] | [0.60, 0.48] |
| `s5` | Chime Treasury | null | `z2_crystal` | [`e5_period_review`] | [0.72, 0.34] |
| `s6` | Warden's Dome | null | `z3_dome` | [`e6_boss`] | [0.84, 0.20] |
| `s7` | The Orrery | null | `z3_dome` | [] | [0.94, 0.08] |

Seal glyphs grey/cyan, a white "you are here" pin (never orange), no fast travel. The Journal tab is the
`JournalReader` (`story.journal = {title: "Journal", style: "parchment"}`) listing collected pages.

### 6.3 Triggers and plaques

**Triggers** (`triggers[]`, 20 §2.4.5):

| id | zoneId | x (surface) | radius | kind | lines | requires | once | setFlag | Pri |
|---|---|---|---|---|---|---|---|---|---|
| `s0_controls` | `z1_sunward` | 1600 | 300 | `ambient` | [`intro.11`] | `{flag: "cog_awake"}` | true | null | P0 |
| `s0_plaque` | `z1_sunward` | 600 | 240 | `ambient` | [`s0.01`] | null | true | null | P1 |
| `s0_telescope` | `z1_sunward` | 1000 | 240 | `ambient` | [`s0.02`] | `{flag: "cog_awake"}` | true | null | P1 |
| `s0_canal` | `z1_sunward` | 2250 | 300 | `ambient` | [`s0.03`] | `{flag: "cog_awake"}` | true | null | P1 |
| `s3_hall` | `z2_crystal` | 300 | 400 | `arrival` | [`s3.01`] | null | true | null | P1 |
| `g_gantry` | `z3_dome` | 200 | 300 | `arrival` | [`g.01`] | null | true | null | P1 |
| `g_miss_1` / `g_miss_2` / `g_miss_3` | `z3_dome` | 600 / 1200 / 1800 (the pit bottoms) | 150 | `ambient` | [`g.02`] | `{notFlag: "gantry_missed"}` | true | `gantry_missed` | P1 |
| `g_ledge` | `z3_dome` | 2220 (`sighting_ledge`) | 120 | `ambient` | [`g.03`] | null | true | null | P1 |
| `wisp_first` | `z1_sunward` | 3560 (`wisp_ledge`) | 80 | `ambient` | [`wi.01`] | null | true | null | P2 |
| `page_1_near` | `z1_sunward` | 300 | 200 | `ambient` | [`u.page`] | `{flag: "cog_awake"}` | true | null | P2 |

**Plaques** (`plaques[]`, P1; read with E; the console plaque text also feeds the Brief tab). Asset
`orrery_terraces.prop.plaque_post` (kit `compose(column, plate brass_plaque)`); console plaques stand 120 left of
their console.

| id | zoneId · x | title | text (≤ 320) |
|---|---|---|---|
| `plaque_measurers` | `z1_sunward` · 600 | The Measurers | "We, the Measurers, built these terraces to keep time with the sky. Every wheel here turns on a wave. Read the wave, and the wheel will follow." |
| `plaque_e1` | `z1_sunward` · 4180 | Vesper Dial | "VESPER DIAL. Set the carriage to the evening star's bearing, measured from sunrise along the rim, in radians." |
| `plaque_e2` | `z1_sunward` · 6780 | Tidewheel Gate | "TIDEWHEEL GATE. The latch fires once. Time it to a single lap of the ring: no more, no less." |
| `plaque_e3` | `z2_crystal` · 1380 | Echo Choir | "ECHO CHOIR. The lift answers only a true chord. Silence the false singer." |
| `plaque_e4` | `z2_crystal` · 3780 | Solving Span | "SOLVING SPAN. Stones hold in the order of the working. The far bank has two anchors." |
| `plaque_e5` | `z2_crystal` · 8380 | Chime Treasury | "CHIME TREASURY. The chest opens to a true chord. Its singers remember the Tidewheel." |
| `plaque_e6` | `z3_dome` · 3430 | The Warden | "THE WARDEN. It yields to a matched rhythm, and to nothing else." |
| `gear_plaque_1` / `_2` / `_3` | `z3_dome` · 380 / 980 / 1580 | T = 1.5 / T = 2.5 / T = 3 | "This gear swings out and back once every 1.5 seconds." (2.5, 3 likewise; asset `orrery_terraces.prop.period_plaque`) |

The plaque titles render as DOM labels (`WorldLabelLayer`). None contains a banned token of a station it precedes
(R8 world-scoped check).

### 6.4 Collectibles: Journal Pages (5) and Insight Wisps (3)

`collectibles[]` (20 §1.3). Pages use the shared page sprite (`asset: null`); wisps are `kind: "shard"` with
`asset: "orrery_terraces.fx.wisp"`. Pages cite the fixture's own verified `sourceRef`.

| id | kind | zoneId · x (surface) | title | text (≤ 320) | conceptId | sourceRef | requires | Pri |
|---|---|---|---|---|---|---|---|---|
| `page_1` | page | `z1_sunward` · 300 | The Builders' Measure | "Walk one radius along a circle's rim and you have turned one radian. The Measurers counted arcs, not degrees: the whole rim is 2π radians, whatever the circle's size. — I.V." | `c_radians` | p.1 "An angle of π radians corresponds to half a revolution." | null | P2 |
| `page_2` | page | `z1_sunward` · 5500 | Vesper's Bearing | "Vesper rises at 5π/6: five-sixths of the way from sunrise to the western horizon, one sixth of a half-turn short of it. I have checked it every year for forty years." | `c_radians` | p.1 (same) | `{solved: "e1_radians"}` | P2 |
| `page_3` | page | `z1_sunward` · 3740 | The Tidewheel Log | "The Tidewheel runs on sin(2t). Double the b and the wheel runs twice as fast, so it comes home every π, not every 2π. Brasswick's arm must keep the same rhythm or he waters the air." | `c_period` | p.3 "The period of y = sin(bx) is 2π/\|b\|." | `{solved: "e2_period", flag: "brasswick_done"}` | P1 |
| `page_4` | page | `z2_crystal` · 5460 | Two Doors | "sin(x) = 1/2 opens twice a lap, at π/6 and at π − π/6 = 5π/6. Sine is height, and two points on the circle share every height except the very top and bottom." | `c_solve` | p.4 "To solve a trigonometric equation, first isolate the trigonometric function." | `{solved: "e4_solve"}` | P2 |
| `page_5` | page | `z2_crystal` · 9300 | Reach and Rhythm | "A sets how far; b sets how often. My Warden swings wide to frighten visitors, but the width of a swing has nothing to do with its beat. Count the beat, not the reach." | `c_amplitude` | p.2 "The value of A stretches the graph vertically but leaves the period unchanged." | `{solved: "e5_period_review"}` | P2 |
| `wisp_1` | shard | `z1_sunward` · 3560 (`wisp_ledge`) | Insight Wisp | "Every circle is 2π radii around, whatever its size." | `c_radians` | null | null | P2 |
| `wisp_2` | shard | `z2_crystal` · 1000 (`colonnade_lintel`) | Insight Wisp | "A wave's midline is where it rests; amplitude is how far it leaves." | `c_amplitude` | null | null | P2 |
| `wisp_3` | shard | `z2_crystal` · 6620 (`lantern_ledge`) | Insight Wisp | "Period and frequency are partners: one says how long, the other how often." | `c_period` | null | null | P2 |

Page texts avoid a standalone "π" wherever they are reachable before `e2_period` is solved (R8 world-scoped
warnings against e2's banned "π"). E shows title/text in the bar (document style when a `sourceRef` exists) and
files the item in the journal; the counter line "Pages 2/5 · Wisps 1/3" shows for 3 s.

### 6.5 NPCs and quests

```json
"npcs": [
  { "id": "brasswick", "name": "Brasswick", "speakerId": "brasswick", "look": null, "asset": "orrery_terraces.npc.brasswick",
    "states": [
      { "id": "before", "requires": null, "zoneId": "z1_sunward", "x": 3700, "surface": "ground", "lines": ["@bw.01", "@bw.02"],
        "pose": "work", "follow": "none", "repeatable": true, "setFlag": null, "anim": "arm_short" },
      { "id": "after", "requires": { "solved": "e2_period", "flag": null, "notFlag": null, "collected": [] }, "zoneId": "z1_sunward", "x": 3700,
        "surface": "ground", "lines": ["@bw.03", "@bw.04"], "pose": "cheer", "follow": "none", "repeatable": false, "setFlag": "brasswick_thanked", "anim": "arm_sync" } ] },
  { "id": "lumen", "name": "Lumen", "speakerId": "lumen", "look": null, "asset": "orrery_terraces.npc.lumen",
    "states": [
      { "id": "tending", "requires": null, "zoneId": "z2_crystal", "x": 7150, "lines": ["@lu.01"], "pose": "work" },
      { "id": "lit",     "requires": { "solved": "e3_amplitude" }, "zoneId": "z2_crystal", "x": 7150, "lines": ["@lu.02"], "pose": "wave" },
      { "id": "falls",   "requires": { "solved": "e5_period_review" }, "zoneId": "z2_crystal", "x": 7150, "lines": ["@lu.04"], "pose": "idle" } ] },
  { "id": "ilse", "name": "Ilse Vantor", "speakerId": "ilse", "look": null, "asset": "orrery_terraces.npc.ilse_stars",
    "states": [
      { "id": "projected", "requires": { "flag": "ilse_projected" }, "zoneId": "z3_dome", "x": 4700, "surface": "ground",
        "lines": ["@out.03"], "pose": "idle" } ] } ]
```

(Omitted fields take their defaults.) Priorities: Brasswick `before` P0, `after` P1; Lumen P1; Ilse P0. **P2**
adds Lumen state `wisps` between `lit` and `falls`: `{id: "wisps", requires: {solved: "e3_amplitude", notFlag:
"wisps_all"}, lines: [lu.03]}`, and **Quill**: `{id: "quill", speakerId: "quill", asset:
"orrery_terraces.npc.quill", states: [{id: "archive", zoneId: "z2_crystal", x: 600, lines: [qu.01], setFlag:
"quill_met"}, {id: "riding", requires: {flag: "quill_met"}, zoneId: "z2_crystal", x: 600, lines: [qu.02], follow:
"satchel", repeatable: true}]}`. The Lumen lantern flames rise and fall on a visible sine (height
`10 + 4 sin(2πt/1.5)`); after `lit`, the stair lanterns light in sequence (props with `restoredBy: e3_amplitude`).

```json
"quests": [
  { "id": "brasswick_rhythm", "title": "Brasswick's Rhythm", "giverNpcId": "brasswick",
    "steps": [ { "kind": "talk", "npcId": "brasswick", "stateId": "before" },
               { "kind": "afterSeal", "encounterId": "e2_period" },
               { "kind": "talk", "npcId": "brasswick", "stateId": "after" } ],
    "reward": { "flag": "brasswick_done", "lines": [], "collectibleId": "page_3", "cosmetic": null,
                "debriefLine": "Brasswick's arm swings in step with the Tidewheel again." } } ]
```

P2 quests: `quill_pages` (`giverNpcId: "quill"`, steps `[talk quill archive, collect [page_1 … page_5]]`, reward
`{flag: "pages_all", lines: [u.quill3], debriefLine: "Journal complete: all five of Ilse's pages."}`) and `wisps`
(steps `[collect [wisp_1, wisp_2, wisp_3]]`, reward `{flag: "wisps_all", lines: [wi.02], debriefLine: "Insights:
three wisps found."}`).

Flags declared (R12): `cog_awake`, `ilse_projected` (cutscene `set_state`), `brasswick_thanked` (NPC state),
`brasswick_done`, `pages_all`, `wisps_all` (quest rewards), `gantry_missed` (trigger), `music_box_played` (sandbox).

### 6.6 Sandbox: the Astronomer's Music Box (S5 grotto, P1)

- **Unlock:** P1 `requires: {solved: "e5_period_review"}`; P2 switches to `{flag: "wisps_all"}` and adds the falls
  parting (`orrery_terraces.prop.crystal_falls_cliff` state `revealed`, 0.8 s, `falls_part`).
- **Object:** a brass music box on a pedestal, with a miniature ring gate on its lid (skin `astronomer_box`).
- **It is not an encounter:** no Verify, no grading, no runner call, nothing reaches telemetry or mastery (20 §2.4b).
- **The lesson** is hands-on: pitch follows b (timing), loudness follows A (reach).
- **Accessibility:** it respects the mute toggle; a visual pulse ring replaces the tone when muted.

```json
{ "id": "music_box", "zoneId": "z2_crystal", "consoleX": 7000, "surface": "ground", "anchor": { "x": 7060, "y": 1300 },
  "contraption": "music_box", "skin": "astronomer_box",
  "config": {
    "amplitude": { "symbol": "A", "label": "reach",  "min": 0.5, "max": 3, "step": 0.1, "unit": "", "format": "number",
                   "initial": 1, "stops": [], "window": null, "playback": false },
    "rate":      { "symbol": "b", "label": "rhythm", "min": 0.5, "max": 4, "step": 0.1, "unit": "", "format": "number",
                   "initial": 1, "stops": [], "window": null, "playback": false },
    "baseHz": 220, "xMax": "4*pi" },
  "title": "The Astronomer's Music Box", "objectNoun": "Music Box",
  "requires": { "solved": "e5_period_review" },
  "lines": { "open": ["@mb.01"], "idle": ["@mb.02"] },
  "goal": "explored",
  "reward": { "flag": "music_box_played", "lines": ["@mb.03"], "cosmetic": "orrery_terraces.costume.wren_scarf_gold",
              "debriefLine": "Secret found: the Astronomer's Music Box." },
  "frameZoom": null }
```

Live: one `graph` card `y = A·sin(b t)` over [0, 4π]; the tone is `220·b` Hz at gain `0.2·A/3` through the synth
bus; the lid's ring spins at rate b. Goal `explored` = both scrubbers moved and 5 s of play. Reward: a gold trim
overlay on Wren's scarf (`orrery_terraces.costume.wren_scarf_gold`, a kit recolour of the scarf hero; it replaces
nothing in the 4-slot costume because cosmetics are added by `WorldState.cosmetics`).

### 6.7 Sighting Telescopes (P2)

Two touch props: `telescope_s0` (`z1_sunward` x 1000) and `telescope_s6` (`z3_dome` x 2250 on `sighting_ledge`),
asset `orrery_terraces.prop.sighting_telescope`, `touch: {requires: null, litAsset: null, lines: [u.tel], cue:
"ui_select"}`. The revision-1 fake zoom (L1 scaled 1.6× under a circular mask) has no schema field; the P2 version
is lines only, and the tower's lit beams (P1 progress effects) make progress physical.

### 6.8 Sound hooks (`CUE_MAP`, 20 §2.12)

Every cue id below maps to a synth recipe (R16 requires the mapping; an unmapped cue is silent).

| Cue id | Recipe (params) | Used by |
|---|---|---|
| `ui_knob_tick`, `stud_tick`, `tally_click`, `pendulum_tick` | `tick` | Scrubber, e1 studs, e2 tally, e6 pylon |
| `ui_select`, `ui_verify`, `ui_badge`, `ui_panel_in`, `ui_panel_out`, `ui_page_turn` | `select`, `verify`, `badge`, `whoosh`, `whoosh`, `page` | panel |
| `dial_carriage_roll`, `beam_hum`, `ring_turn`, `bell_hum`, `sync_hum` | `hum` loops (pitch/gain from `meta.audio`) | e1, e2, e3/e5 (pitch ∝ \|f(x)\|), e6 (pitch ∝ B) |
| `beam_scatter`, `mimic_hiss`, `thread_snap` | `spark` | e1, e3/e5, e6 |
| `beam_surge`, `fog_part`, `stone_float`, `shield_swoosh` | `whoosh` | e1, e4, e6 |
| `node_ignite`, `beacon_ignite`, `relief_glint` | `chime` | e1, e4 |
| `spoke_extend_clunk`, `latch_clack`, `stone_lock_thunk` | `clunk` | e1, e5, e2, e4 |
| `latch_click`, `chest_unlock`, `cable_snap_taut` | `latch` | e2, e5, e4 |
| `latch_slip` | `latch` (`repeat: 2`) | e2 |
| `water_rush`, `falls_part` | `water` | e2, the Music Box grotto |
| `bell_honest` | `bell` | e3/e5 |
| `chord_true`, `resonance_lock` | `chord` | e3/e5, e6 |
| `mimic_scuttle` | `tick` (`repeat: 6`) | e3/e5 |
| `lift_chain`, `stone_grind`, `door_slide` | `grind` | e3, e4, e6 |
| `stone_crumble`, `warden_bow_rumble` | `rumble` | e4, e6 |
| `cog_wind` | `tick` (`repeat: 6`, pitch 0.8) | intro |
| `mb_tone` | `hum` loop (220·b Hz) | Music Box |

Revision-1 ambience and music ids (`amb_*`, `music_*`) have no recipe: music is the `Segment.music` cue per
segment (§2.3), rendered by the bus as a quiet pad or silence.

### 6.9 Accessibility

- Every panel control is keyboard-operable (20 §3.5); the Phaser global capture is released under `[data-panel]` (D4).
- The dialogue bar is ≥ 22 px at 1280 × 720 (20 §3.5 floor), white on panel, contrast ≥ 7:1.
- g is always **dashed** where it overlays f, so colour is never the only cue.
- **Reduced motion:** no camera nudges; the fog dissolves instantly; particle counts are 25 %; success plans play at the same length without shake; typed lines appear instantly.
- **e6 slow time (P2):** `config.slowTimeToggle: true` adds a "time × 0.5" toggle that scales τ and φp together; the readout still shows T in the equation's units, and the label makes the scaling explicit.
- Screen readers get each station's `srText` (throttled) and the assertive Verify outcome.

---

## 7 · Art asset list

### 7.1 Conventions (02 §3.0, 20 §5.1–§5.5)

- **Keys:** `orrery_terraces.<group>.<name>` (20 §5.1 groups: `layer`, `ground`, `prop`, `part`, `costume`, `npc`,
  `companion`, `fx`, `vista`), `shared.<group>.<name>` for the shared set, `orrery_terraces.part.<skin>_<slot>` for
  contraption parts (the 20 §4.3 art contract). 02 §4.1 lists the same P0 heroes under its depth-group names
  (`orrery_terraces.far.orrery_tower`, `…part.ringgate_wall`, `…char.wren_*`); **20's keys win** and 02's become
  `legacyId`s (not folded into 02 here).
- **Source column:** **hero** = hand-authored SVG in `art/orrery_terraces/<group>/<name>.svg`, counted against the
  cap of 40 (P0 37); **kit:`gen`** = a `biome.json` kit entry (02 §3a); **rig** = the recoloured Kenney atlas;
  **code** = drawn at runtime (no file); **DOM** = a `WorldLabelLayer` label; **post-demo** = not built.
- **SVG rules** (20 §5.3): `viewBox` = design size (1 H = 170), palette tokens only (`{{stone.lit}}`), pivots as
  fractions (`data-pivot="0.5,0.5"` for rotating parts), anchors as `<circle id="anchor-<name>" r="0">`, no plain
  `<text>` (static engraving is `<text data-engrave>` converted to paths at build time with the one OFL font),
  ≤ 60 KB per file (layers ≤ 120 KB). Every spec-derived label (rail landmarks, the Warden's equation, plaque and
  claim texts, chips, pins, span-tile numerals, gear periods) is **DOM**.
- **Raster:** `rasterScale × min(dpr, 1.5)` (L1/L2/L5 0.75; clouds, glows 0.5; L3, props 1.0; parts ≤ 500 wide and
  puppets 1.5).
- **Look:** no pure black (darkest `#2B3A44`); lit faces upper-left, shade lower-right; soft AO at bases (kit
  finish defaults); dormant states are runtime ColorMatrix, never separate files.
- Sizes are **w × h design units**. Descriptions are unchanged from revision 1.

### 7.2 Sky (7)

| Legacy | Key | Source | Size | Description |
|---|---|---|---|---|
| A01 | — (`sunward_day.sky`) | code | — | 3-stop vertical gradient `#D8D4CF` → `#E8DCD2` (45 %) → `#F4E7DA`, with a 1 px dither at 3 % |
| A02 | — (`hall_peach`/`stair_peach.sky`) | code | — | `#E9C9C0` → `#F2D8C8` → `#FAE9D8`, same dither |
| A03 | — (`gantry_dusk.sky`) | code | — | `#9E86D8` → `#C9A0DE` → `#F2B8D4`, plus a warm band `#F7C9B8` at 85 % height |
| A04 | `orrery_terraces.layer.z1_clouds` (+ `z2_clouds`) | kit:`cloudBand` lozenge | 2400 × 300 | 5 overlapping long lozenge clouds; tops white at 35 %, undersides lavender `#E6DDEA` at 50 %; soft edges |
| A05 | (second band inside the same entry, `count: 3`) | kit:`cloudBand` | 2400 × 260 | as A04, sparser (3 clouds), thinner |
| A06 | `orrery_terraces.layer.z3_stars` | kit:`scatter(glowSprite mote)` | 1920 × 640 | ≤ 140 star points (1–3 px, white or `#CFEFFF`), denser toward the top; 6 larger 4-point stars (8 px), baked into one texture |
| A07 | `orrery_terraces.fx.vesper_star` | kit:`glowSprite` spark4 | 180 × 180 | a 14 px `#FFF4D6` core, a 4-point cross flare (70 px hairlines) and a radial glow `#F6D27A` 0 % → 45 % |

### 7.3 L1 · Far canyon (6)

| Legacy | Key | Source | Size | Description |
|---|---|---|---|---|
| A08 | `orrery_terraces.layer.z1_mesa` | kit:`ridgeBand` butte_fluted | 2048 × 620 tileable | flat-topped buttes with vertical fluting (4–7 flutes per butte, a lighter left edge), single fill `#8FA6A0`, with a vertical gradient to 40 % sky haze at the base. Heights 180–520 |
| A09 | `orrery_terraces.layer.z2_mesa` | kit:`ridgeBand` | 2048 × 620 | the same silhouette in `#C9A99E` |
| A10 | `orrery_terraces.layer.z3_mesa` | kit:`ridgeBand` | 2048 × 620 | the same silhouette in `#7E6A9E`, with the rim-light edge `#B7A2D9` on the upper-left faces |
| A11 | `orrery_terraces.layer.orrery_tower` | **hero** | 520 × 900 | a stepped cream tower (3 tiers narrowing upward, `stone.base` with `stone.lit` left faces), navy bands at each tier cap, a dome cap with a lens socket, and an arched window row. Painted with 30 % haze |
| A12 | `orrery_terraces.fx.orrery_ring_a` / `_b` / `_c` | kit:`ringStack` (ellipse 0.34 / 0.57 / 0.77) | 460 × 460 each | three thin gold ellipse rings (stroke 10, `gold.base` with a `gold.hi` inner edge) at 20°, 35° and 50° tilt, separate so the finale can spin them |
| A13 | `orrery_terraces.layer.z1_aqueduct` | kit:`arch` arcade | 2048 × 420 | a row of 6 cream arches on piers along a cliff line, with navy string-course bands. 35 % haze |

### 7.4 L2 · Mid-far (5)

| Legacy | Key | Source | Size | Description |
|---|---|---|---|---|
| A14 | `orrery_terraces.layer.z1_crystal_field` (+ `z2_crystal_field`) | kit:`scatter(crystalCluster)` | 2048 × 700 | 9 clusters of prismatic spires (3 facets: `crystal.hi` `#C9F3FF` left, `crystal.base` `#6ED2F2` middle, `crystal.shade` `#2E8FC0` right), heights 180–640, leaning ±8°, with 20 % haze |
| A15 | `orrery_terraces.layer.z1_canopy_ruins` (blue half) | kit:`canopy` blob_tree | in the 2048 × 760 compose | rounded canopy masses (3 tones: `#8CC0EE` caps, `#5A95D6` body, `#3F6FA8` underside) on thin grey trunks |
| A16 | (salmon half of the same compose) | kit:`canopy` blob_tree | — | as A15 in `#F4AE80` / `#E48C5E` / `#B8643E` |
| A17 | (arches in the same compose) | kit:`arch` buried + `ashlarWall` | — | 3 half-buried cream arches with navy capitals and fallen blocks. Two-tone lit/shade, 20 % haze |
| A18 | (falls in the same compose) | kit:`waterBand` falls | 200 × 700 | a thin fall: 2 vertical bands (`#EAF8FB` and `#8FE0EA`), a mist puff at the base |

### 7.5 L3 · Mid (7)

| Legacy | Key | Source | Size | Description |
|---|---|---|---|---|
| A19 | `orrery_terraces.layer.z2_cliffwall` | kit:`ashlarWall` rounded | 2048 × 900 tileable | stacked rounded-rectangle blocks (the 10.png cliff): `rock.base` `#5F7B7A` bodies, `rock.light` `#8FA6A0` top faces, `rock.shade` `#3F5857` undersides, 8 px dark-teal seams |
| A20 | (variant seed of the same entry) | kit:`ashlarWall` + `crystalCluster` | 2048 × 900 | with 5 crystal clusters growing from the seams and blue shrub tufts on ledges |
| A21 | `orrery_terraces.layer.z1_terrace_wall` | kit:`compose(ashlarWall, column, canopy vine_drape)` | 2048 × 740 tileable | a cream retaining wall in ashlar courses (`stone.base`, joints `stone.deep`), a 14 px navy band 40 below the cap, a 6 px gold cap line, round medallions every 320 |
| A22 | `orrery_terraces.layer.dome_interior` | **hero** (z3 landmark) | 3000 × 1080 | a dome inner wall: 9 cream ribs converging upward (perspective), gold rib edges, `dome.violet` panels between the ribs, and a ceiling band with an **unlit star map** (constellation lines in `#B7A2D9` at 30 %) |
| A23 | `orrery_terraces.layer.z2_colonnade` (and inside `z1_terrace_wall`) | kit:`compose(column ×6, canopy vine_drape)` | 2048 × 700 | 6 cream pillars (navy capital bands, gold trim) under a continuous lintel, with salmon vines hanging from the lintel |
| A24 | `orrery_terraces.prop.crystal_falls_cliff` + `orrery_terraces.fx.falls_main.a/.b` | **hero** cliff (z2 landmark) + kit:`waterBand` falls | 900 × 1300 + 360 × 900 | the Crystal Stair cliff with its grotto mouth; the main fall has 2 offset streak bands (`#EAF8FB`, `#8FE0EA`, `#4CB6D0`) for UV scroll and a white foam lip |
| A25 | `orrery_terraces.layer.z3_gantry_truss` | kit:`truss` gantry + `ringStack` | 2048 × 600 tileable | the rim's clockwork gantry behind the walkway: brass trusses, large idle gears (outlines, `orrery.brass` at 60 %) and navy rivet bands |

### 7.6 Ground and architecture (10)

| Legacy | Key | Source | Size | Description |
|---|---|---|---|---|
| A26 + A27 | `orrery_terraces.ground.paving` | kit:`groundStrip` polygon_paving (`grassEdge` on) | 512 × 200 tileable | cream irregular-polygon paving (`stone.base`, `stone.lit` highlights, `stone.deep` joints), a 6 px gold lip, the front face `stone.shade`; teal grass tufts overhanging the lip by 40 with 2 orange flower dots per tile |
| A28 | `orrery_terraces.ground.sand` | kit:`groundStrip` sand | 512 × 120 tileable | `sand.path` `#EBCFAE` with soft darker ripples (S0 path decals) |
| A29 | `orrery_terraces.prop.canal` (+ `ring_gate_canal`) | kit:`waterBand` canal + `groundStrip` | 512 × 180, states dry / water | dry: cream sides, `stone.deep` bed with silt streaks. Water: `water.deep` `#4CB6D0` with a `water.shallow` line at 20 % and 6 gold flecks; `restoredBy: e2_period` |
| A30 | `orrery_terraces.prop.ledge_cap` | kit:`groundStrip` ledge_cap | 256 × 64 tileable | a cream ledge top with a gold trim line and a navy band beneath (platform art: `wisp_ledge`, `lantern_ledge`, `sighting_ledge`) |
| A31 | `orrery_terraces.prop.crystal_stair` | kit:`stairs` stone (7 × 86) | 560 × 640 | sandstone steps (0.5 H): top faces with an engraved ring, front faces with a lit left strip |
| A32 / A33 | `orrery_terraces.prop.cliff_edge` (flipX for the right) | kit:`ridgeBand` chasm_edge | 256 × 400 | a rock ledge termination: A19 rock language with a grass cap |
| A34 | `orrery_terraces.prop.pillar` | kit:`column` stone | 170 × 470 | capital with two navy bands and gold edges; cream shaft with a lit left strip and 2 shallow flutes; stepped base |
| A35 | `orrery_terraces.prop.beam_pylon` | kit:`column` pylon (`socket: true`) | 140 × 520 | a cream pylon (3 H) with a navy capital, a gold ring socket holding an orb (grey dormant; lit glow at runtime) and an emblem disc at mid-height. Instances `beam_pylon_s0` (x 1500, the intro `await_interact` target), `beam_pylon_s1` (x 5560), `beam_pylon_s2` (x 7900) |
| new | `orrery_terraces.ground.terrace_underside`, `orrery_terraces.ground.cliff_underside`, `orrery_terraces.ground.dome_floor` | kit:`ashlarWall`, `ashlarWall` rounded, `groundStrip` marble | 512 tiles | ground undersides and the dome floor |
| new | `orrery_terraces.prop.stepping_stone` | kit:`plate` slab | 80 × 30 | the S0 canal stone (platform `canal_stone`) |

### 7.7 Props and vegetation (26)

| Legacy | Key | Source | Size | Description |
|---|---|---|---|---|
| A36 | `orrery_terraces.part.<skin>_console` ×6 | kit:`lectern` | 120 × 120 | a 0.7 H lectern: cream pedestal with a navy band, a slanted top with a gold rim, a dark slate screen (`#0F2A33`), a small round emblem on the front |
| A37 | `orrery_terraces.fx.console_glow` | kit:`glowSprite` | 100 × 60 | an additive cyan panel glow with 3 faint grid lines and a tiny sine squiggle |
| A38 | `orrery_terraces.part.resonance_pillars_lens_pedestal` | **hero** | 140 × 150 | the base disc with a **green ring** (`fn.g`), a coiled bronze stem (3 loops) and a head cradle |
| A39 | `orrery_terraces.prop.node_ring` | kit:`ringStack` | 96 × 96 | a bronze ring (`bronze.ring` `#6E4A2E`) with 4 rivets and an inner bevel |
| A40 / A41 | `orrery_terraces.fx.node_core_dormant` / `_lit` | kit:`glowSprite` | 60 × 60 | grey glass core `#9AA7AD` / `crystal.hi` core with a white centre |
| A42 | `shared.ui.pin` | shared (A1) | 88 × 120 | teardrop pin: fill `#1F4E5A`, 3 px white stroke, a white chevron below; text is DOM |
| A43 | `shared.ui.interact` | shared | 64 × 64 | diamond outline with 3 inner vertical lines (4.png style) |
| A44 / A45 / A46 | `orrery_terraces.prop.crystal_tall` / `crystal_cluster` / `crystal_fan` | kit:`crystalCluster` spire / cluster / fan | 120 × 420 / 260 × 260 / 220 × 200 | 3-facet prismatic spires |
| A47 / A48 / A49 / A50 | `orrery_terraces.prop.bush_blue_a` / `bush_blue_b` / `bush_salmon` / `shrub_rust` | kit:`canopy` bush | 220 × 140 … | rounded bushes of overlapping leaf blobs in 3 tones; a spiky rust `#C4643C` shrub with orange tips |
| A51 | `orrery_terraces.prop.crystal_tree` | kit:`compose(column pole, crystalCluster)` | 420 × 620 | a **blue crystal tree**: a pale grey trunk `#B7C4C8` with 3 branches; a canopy of hexagon-shard "leaves" (`#8CC0EE` / `#5A95D6` / `#2E8FC0`); instance `crystal_tree_s1` has `restoredBy: e2_period` (Brasswick's) |
| A52 / A53 | `orrery_terraces.prop.tree_salmon` / `tree_rust_small` | kit:`canopy` blob_tree | 460 × 600 / 260 × 340 | trunk + round salmon canopy with 5 loose falling-leaf shapes; a young rust tree |
| A54 | `orrery_terraces.prop.flower_tuft` | kit:`canopy` bush (small) | 80 × 50 | 3 orange-rust flower heads on teal stems |
| A55 | `orrery_terraces.prop.lantern_post` | kit:`column` lamp_post | 60 × 220 | a cream post with a navy band and a glass lantern (flame `orrery_terraces.fx.flame`); S5 instances `restoredBy: e3_amplitude` |
| A56 | — (shared page sprite, `Collectible.asset: null`) | shared | 64 × 80 | a parchment page `#F4E7C9` with a curled corner, 3 ink lines, a gold wax seal |
| A57 | `orrery_terraces.fx.wisp` | kit:`glowSprite` mote | 48 × 48 | teardrop wisp: core `#B9BAFF`, body `#6A6CF0`, wispy tail (P2) |
| A58 | `orrery_terraces.prop.sighting_telescope` | kit:`compose(column pole, ringStack, linkStrip rod)` | 120 × 200 | brass telescope on a tripod with navy leather wraps (P2) |
| A59 | `orrery_terraces.prop.gondola` | **hero** | 360 × 280 | cream cabin with a gold roof ring, navy window bands, a cable pulley on top |
| A60 | `orrery_terraces.prop.plaque_post` | kit:`compose(column, plate brass_plaque)` | 110 × 170 | a stone post holding a bronze plaque (text in the bar) |
| A61 | `orrery_terraces.prop.tablet_stack` | kit:`plate` slab ×3 | 180 × 120 | stacked stone tablets with engraved wave lines (Quill's perch, P2) |
| new | `orrery_terraces.prop.statue_plinth`, `orrery_terraces.prop.colonnade_lintel`, `orrery_terraces.prop.shaft_ladder`, `orrery_terraces.prop.gantry_ladder`, `orrery_terraces.prop.gantry_walkway`, `orrery_terraces.prop.gantry_gear`, `orrery_terraces.prop.period_plaque`, `orrery_terraces.prop.warden_plinth`, `orrery_terraces.prop.warden_keystone`, `orrery_terraces.prop.crystal_roots`, `orrery_terraces.prop.dome_star_map` | kit: `stairs` stepped_plinth, `compose(column, plate)`, `linkStrip` ladder ×2, `groundStrip` grate + `railing` brass_rail, `ringStack` teeth + `plate`, `plate` brass_plaque, `stairs` stepped_plinth, `ringStack`, `crystalCluster` hanging_roots, `ringStack` sockets 7 | — | traversal and station dressing (A114 cradle, A119 key-stone, A126 plinth, A112 roots, A132–A135 gantry parts re-homed here) |

### 7.8 L5 · Foreground (7; 2 px blur, 70 % alpha, −15 % brightness)

| Legacy | Key | Source | Description |
|---|---|---|---|
| A62–A68 | `orrery_terraces.layer.z1_fore`, `z2_fore`, `z3_fore`, `z3_dome_fore` | kit:`compose(railing navy_cap_wave, canopy bush + frond, crystalCluster shard, column emblem post)` | tall grass blades (`#3E7A70` → `#5FA597`), salmon and blue leaf clumps entering from the frame edge, a cream balustrade (balusters every 60, a navy rail cap with a wave-crest top, amplitude 6), square emblem posts, one huge blurred 3-facet shard |

### 7.9 L6 · Light and particles (7)

| Legacy | Key | Source | Size | Description |
|---|---|---|---|---|
| A69 | `orrery_terraces.layer.z1_dapple` (+ `z2_dapple`) | kit:`grainTile` leaf_dapple | 512 tile | irregular leaf-shaped blobs, blue-grey `#6E7F9A`, heavily blurred (multiply 25 %) |
| A70 | `orrery_terraces.layer.z1_godrays` (+ `z2_godrays`) | kit:`glowSprite` shaft | 600 × 1080 | a slanted trapezoid, white 0 % → 40 % → 0 % across its width (additive) |
| A71 | `shared.fx.glow_256` | shared | 256 × 256 | a white radial gradient, tinted at runtime (cyan, gold, indigo) |
| A72 | `orrery_terraces.fx.sparkle` | kit:`glowSprite` spark4 | 24 × 24 | a 4-point star, white |
| A73 | `orrery_terraces.fx.dust_puff` | kit:`glowSprite` puff | 128 × 128 | a soft cream puff of 4 blobs |
| A74 | `orrery_terraces.fx.leaf_salmon` | kit:`canopy` frond (single leaf) | 32 × 20 | a single salmon leaf |
| A75 | `orrery_terraces.fx.mist` | kit:`cloudBand` fog | 512 × 256 | a soft white mist blob |

### 7.10 Contraptions e1 and e2 (19 → parts of `vesper_dial` and `ring_gate`)

| Legacy | Key | Source | Size | Pivot | Description |
|---|---|---|---|---|---|
| A76 | `orrery_terraces.part.vesper_dial_disc` | **hero** | 560 × 560 | 0.5, 0.5 | cream stone disc; carved rings at r 270, 240, 200 (navy inlay at 200); an 8-ray gold sun (r 90); 5 dark **spoke slots** (60 × 24) on the right rim at −30° … 30°; lit upper-left gradient. Anchors `center`, `spoke_0…4` |
| A77 | `orrery_terraces.part.vesper_dial_rail_ring` | kit:`ringStack` (studs 24, sockets 4) | 640 × 640 | 0.5, 0.5 | gold ring at r 310, 14 wide (`gold.base`, `gold.hi` inner, `gold.deep` outer); 24 navy studs (4) every 15°; 4 bosses (12) at 0°, 90°, 180°, 270°; the engraved sun glyph at 0°; landmark labels are DOM |
| A78 | `orrery_terraces.part.vesper_dial_carriage` | **hero** | 90 × 70 | 0.5, 0.71 | a brass shoe gripping the rail (two rollers) and an emitter cup with a cyan orb. Anchor `beam_origin` |
| A79 | `orrery_terraces.part.vesper_dial_spoke_ledge` | kit:`stairs` spoke_ledge (1 step) | 150 × 40 | 0, 0.5 | a gold-trimmed cream ledge with a navy underside band; reused ×5 |
| A80 + A81 | `orrery_terraces.part.vesper_dial_plumb_gauge` | kit:`gauge` ruler_v | 60 × 620 | 0.5, 0 | brass vertical ruler, ticks at 5 levels, navy backing; the bob is code-drawn at anchor `bob` |
| A82 | `orrery_terraces.part.vesper_dial_slide_gauge` | kit:`gauge` ruler_h | 620 × 60 | 0, 0.5 | the horizontal twin; the marker is code-drawn at anchor `marker` |
| A83 | `orrery_terraces.part.vesper_dial_vesper_lens` | **hero** | 120 × 120 | 0.5, 0.5 | a crystal lens in a bronze rim bracket set into rock: 3-facet crystal disc, 3 claws |
| A84 | `orrery_terraces.part.vesper_dial_fog_band` | kit:`cloudBand` fog | 2400 × 520 | — | an arched band of fog: overlapping ellipses `#EDE6F2` at 85 %, fading to 0 at the edges (mask-friendly) |
| A85 | `orrery_terraces.part.ring_gate_gate_wall` | **hero** | 900 × 760 | 0.5, 1 | cream wall with 5 vertical navy grooves (18), a gold cap line, a dark arched **doorway recess** (153 × 221, `#2B3A44` → `#3F5857`) centred at the bottom, two round medallions. Anchors `doorway`, `ring_center` |
| A86 | `orrery_terraces.part.ring_gate_outer_ring` | **hero** | 408 × 408 | 0.5, 0.5 | outer r 204, inner r 170: gold rim, cream band with an engraved **sine wave** (`orrery.engrave`), a **notch** 150 wide at 6 o'clock with gold edge caps |
| A87 | `orrery_terraces.part.ring_gate_inner_disc` | **hero** | 340 × 340 | 0.5, 0.5 | cream disc with 3 navy inlay rings, a doorway **cutout** (153 × 221, arched) from its bottom edge, a gold hub boss. Anchor `inner_hub` |
| A88 / A89 | `orrery_terraces.part.ring_gate_fin_l` / `_fin_r` | **hero** ×2 | 120 × 360 | 1, 1 / 0, 1 | the halves of the gold keystone "crown" fin: tall, tapered, an inner navy slot line. Anchor `fin_split` |
| A90 | `orrery_terraces.part.ring_gate_tally_wheel` | kit:`ringStack` (teeth 6, engraved numerals) | 140 × 140 | 0.5, 0.5 | a small gold escapement wheel; the static numerals "0 I II III IIII V" are `<text data-engrave>`. Anchor `tally` |
| A91 | `orrery_terraces.part.ring_gate_pawl` | kit:`compose(linkStrip rod, plate sign_blade)` | 80 × 120 | 0.25, 0.08 | a bronze latch pawl with a hooked tip. Anchor `pawl_tip` |
| A92 | `orrery_terraces.part.ring_gate_skiff` | kit:`compose(plate raft, column lamp_post)` | 260 × 110 | 0.5, 1 | a small cream-and-gold skiff with a navy stripe and a lantern post |
| A93 | `orrery_terraces.fx.light_shaft` | kit:`glowSprite` shaft | 300 × 700 | 0.5, 0 | a warm-white additive trapezoid, brightest near the doorway |
| A94 | `orrery_terraces.fx.water_splash` | kit:`glowSprite` puff (frames 4) | 640 × 120 | 0.5, 0.5 | the splash crest frames for the travelling water front |

### 7.11 Contraptions e3/e5 and e4 (22 → parts of `resonance_pillars`, `treasury_pillars`, `floating_steps`)

| Legacy | Key | Source | Size | Description |
|---|---|---|---|---|
| A95 | `orrery_terraces.part.resonance_pillars_automaton_a` | **hero** | 200 × 420 | a bell-chested choir automaton: cream shell, gold bands at waist and shoulders, a navy faceplate with two round cyan eye-lenses, a gold bell set in the chest (with a slate slot beneath), a tall cylindrical hat |
| A96 | `orrery_terraces.part.resonance_pillars_automaton_b` | **hero** | 200 × 420 | a rounded head, collar ruff plates and a longer robe skirt |
| A97 | `orrery_terraces.part.resonance_pillars_automaton_c` | **hero** (P1) | 200 × 420 | a squat body, broad shoulders and a crest fin on the head |
| A98 | `orrery_terraces.part.resonance_pillars_faceplate` | kit:`plate` slate (half, mirrored) | 80 × 120 | a faceplate half with a dark interior; two instances swing open (a slot 20 §4.3 should add) |
| A99 | `orrery_terraces.part.resonance_pillars_slate` | kit:`plate` slate (`screen: true`) | 150 × 100 | `#0F2A33` screen in a bronze frame; the claim trace and playhead are code-drawn on it. Anchors `slate_0…2` via instances |
| A100 | `orrery_terraces.part.resonance_pillars_plaque` | kit:`plate` brass_plaque | 220 × 80 | engraved brass plaque with bevels; claim text is DOM |
| new | `orrery_terraces.part.resonance_pillars_bell` | kit:`ringStack` | 80 × 80 | the chest bell (tinted `gold.hi` in `treasury_pillars`) |
| A101 + A102 | `orrery_terraces.part.resonance_pillars_mimic_crab` | **hero** | 180 × 120 | a clockwork crab: brass dome shell with rivets, two cyan stalk eyes, one oversized **caliper claw**; the six legs are code-drawn two-segment brass strokes |
| A103 | `orrery_terraces.part.resonance_pillars_lens_head` | **hero** | 100 × 100 | a brass lens housing on a pivot yoke, cyan glass front. Anchor `lens` |
| A104 | `orrery_terraces.part.resonance_pillars_echo_lift` | kit:`compose(plate, railing brass_rail, ringStack fork)` | 360 × 80 | brass platform with a navy rail and a **resonator fork** on its right end, chain anchors. Anchor `lift` |
| A105 | `orrery_terraces.part.resonance_pillars_lift_chain` | kit:`linkStrip` chain | 20 × 512 tileable | bronze chain links |
| A106 / A107 | `orrery_terraces.part.floating_steps_chasm_edge` | kit:`ridgeBand` chasm_edge (flip for the far side) | 400 × 700 | rock edge facing the gap, crystal roots dangling, mist-softened base |
| A108 | `orrery_terraces.part.floating_steps_stone` | kit:`plate` slab | 220 × 70 | a sandstone plank-stone with bevelled edges, a gold seam groove, a circular glyph recess at its left |
| A109 | `orrery_terraces.part.floating_steps_glyph_isolate` / `_reference` / `_quadrants` / `_solutions` / `_arcsin` | **hero** ×5 (small) | 64 × 64 each | engraved bronze-line icons: a balance with "÷2"; an angle wedge at 30° with an arc; a circle with its upper half shaded; twin beacons; a "sin⁻¹" arrow into a circle |
| A110 | `orrery_terraces.fx.mist_column` | kit:`cloudBand` fog | 400 × 600 | rising mist, white 0 → 35 % |
| A111 | — | code | — | braided bronze anchor cables: code-drawn catenaries (slack or taut) |
| A112 | `orrery_terraces.prop.crystal_roots` | kit:`crystalCluster` hanging_roots | 300 × 260 | hanging crystal-root tendrils |
| A113 | `orrery_terraces.part.floating_steps_socket` | kit:`ringStack` (ellipse 0.4) | 140 × 60 | an elliptical ring socket: bronze rim, cyan inner glow ring (dormant grey by runtime ColorMatrix) |
| A114 | `orrery_terraces.part.floating_steps_cradle` | kit:`shelving` rack_bays | 300 × 260 | a brass rack with 5 bays and a navy base plinth. Anchors `cradle_0…4` |
| A115 | `orrery_terraces.part.floating_steps_pylon` | kit:`compose(column, crystalCluster)` | 120 × 460 | cream pylon with a navy band and a beacon crystal cradle (dark `#3F5857` until lit). Anchors `pylon_a`, `pylon_b` via instances |
| new | `orrery_terraces.part.floating_steps_relief` | kit:`plate` slab (band) | 480 × 200 | the lip relief stone; the `2 sin x` inlay, the water line and the plumb marker are code-drawn from `config.relief`. Anchor `lip_relief` |
| A116 | `orrery_terraces.fx.stone_crumble` | kit:`plate` slab fragments (frames 4, P1) | 880 × 120 | glyph stone crack → split → 5 fragments → falling apart |

### 7.12 Treasury, boss and gantry (20)

| Legacy | Key | Source | Size | Description |
|---|---|---|---|---|
| A117 | `orrery_terraces.part.treasury_pillars_chest_body` | **hero** | 220 × 150 | a gold-banded cream chest with a navy panel and a round **lock-dial** (concentric rings) on the front |
| A118 | `orrery_terraces.part.treasury_pillars_chest_lid` | **hero** | 220 × 80 | a curved lid with gold banding; pivot `0, 1`; anchor `chest_hinge` |
| new | `orrery_terraces.part.treasury_pillars_rim_step` | kit:`stairs` stone | 50 × 80 | one retracting rim-stair tread (×5) |
| A119 | `orrery_terraces.prop.warden_keystone` | kit:`ringStack` + engraved wave | 90 × 90 | a gold disc with an engraved wave glyph |
| A120 + A121 | `orrery_terraces.part.wardens_shield_warden_body` | **hero** | 520 × 860 | a stacked cream stone breastplate over brass ribs, navy inlay chevrons, a central emblem, rounded pauldrons, and the domed helmet with its horizontal **visor slit**, gold crest ridge and brass cheek plates. Anchors `shoulder`, `visor` |
| A122 | `orrery_terraces.part.wardens_shield_visor` | **hero** (additive) | 220 × 40 | the cyan slit glow |
| A123 + A124 | `orrery_terraces.part.wardens_shield_warden_arm` | **hero** | 140 × 460 | brass-jointed stone arm with a gauntlet gripping the shield bar; pivot at the shoulder |
| A125 | `orrery_terraces.part.wardens_shield_shield` | **hero** | 420 × 420 | round shield: concentric rings, gold rim, navy inner band (the equation is DOM), a central boss (the sync-thread anchor `shield_boss`) |
| A126 | `orrery_terraces.prop.warden_plinth` | kit:`stairs` stepped_plinth + `column` | 700 × 260 | column-legs merged into a stepped plinth; gold trim |
| A127 | `orrery_terraces.part.wardens_shield_counter_pylon` | kit:`column` pylon | 140 × 520 | 3 H gold pylon with a navy band, a bracket arm at the top (anchor `pylon_pivot`) and an engraved "T" plate |
| A128 | `orrery_terraces.part.wardens_shield_star_door_l` / `_star_door_r` | **hero** ×2 | 260 × 700 each | tall cream door leaves with gold star inlays (constellation lines) and a navy frame. Anchor `door_center` |
| A129 | `orrery_terraces.part.wardens_shield_pendulum_arm` | kit:`linkStrip` rod | 30 × 300 | a brass rod; pivot `0.5, 0` |
| A130 | `orrery_terraces.part.wardens_shield_bob` | kit:`ringStack` | 80 × 80 | a bronze bob with a cyan core. Anchor `bob` |
| A131 | `orrery_terraces.part.wardens_shield_span_tile` | kit:`plate` slab | 100 × 60 | one engraved floor tile (×7, gold centre tile); numerals DOM |
| A132 | `orrery_terraces.prop.gantry_walkway` | kit:`groundStrip` grate + `railing` brass_rail | 512 × 160 tileable | a brass-grate walkway with navy side rails |
| A133 | `orrery_terraces.prop.gantry_gear` | kit:`ringStack` teeth + `plate` | 300 × 300 | a large gear with a flat platform top, hanging from a short arm (timed-hop driver) |
| A134 | `orrery_terraces.prop.period_plaque` | kit:`plate` brass_plaque | 90 × 60 | a small brass plaque; "T = 1.5" is the plaque title (DOM) |
| A135 | `orrery_terraces.prop.gantry_ladder` | kit:`linkStrip` ladder | 60 × 200 tileable | brass ladder (the pit ladders) |
| A136 | — | post-demo | 400 × 260 ×7 | 7 lit constellation figures (Ring, Wheel, Owl, Lantern, Span, Bell, Star Door); P1 hub sockets use glows only |

### 7.13 Characters

| Legacy | Key | Source | Description |
|---|---|---|---|
| A137–A151, A154 | — | **post-demo** (Wren's 18-part puppet) | side-profile head, eyes, torso, limbs; emote bubbles are `emote` steps rendered by the host |
| rig | `shared.char.wren` | rig (Kenney Female adventurer, recoloured) | 45 poses, HD atlas 1728 × 1280, per-frame anchors (02 §3b.3) |
| A138 | `orrery_terraces.costume.wren_hair_bun` | **hero** | dark hair `#2B2A33` cap plus a high bun with a gold pin |
| A141–A143 | `orrery_terraces.costume.wren_scarf` | **hero** | teal scarf wrap at the neck (`#4FA3A0` / hi `#7CC7C0`) with two tails (spring chain at runtime) |
| new | `orrery_terraces.costume.wren_scarf_gold` | kit (recolour of the scarf) | the Music Box reward trim (P1) |
| A152 | `orrery_terraces.costume.wren_satchel` | **hero** | brown satchel `#8A5A3E` with a flap and a buckle |
| A153 | `orrery_terraces.costume.wren_staff` | **hero** | brass rod with a small astrolabe (2 concentric gold rings) at the tip |
| A155–A161 | `orrery_terraces.companion.cog` | **hero** (puppet, 8 parts) | round brass body with a glass belly window and two meshing gears; a head with two big lens eyes (gold rims, cyan irises, white catch-lights) and gear-tooth ear tufts; layered brass wing plates with a navy stripe; small talons; a wind-up key; eye glow (ADD) |
| A162–A165 | `orrery_terraces.npc.brasswick` | **hero** (puppet, 5 parts) | copper barrel body on 2 treads, moss tufts; round head with one lens and a cream brimmed cap; a jointed arm (named anims `arm_short`, `arm_sync`); a copper watering can |
| A166 | `orrery_terraces.fx.water_drop` | kit:`glowSprite` | a droplet particle |
| A167–A169 | `orrery_terraces.npc.lumen` | **hero** (puppet, P1) | slender body with navy coat plates; a glass lantern head with a brass cap; a pole-arm with a flame hook |
| A170 | `orrery_terraces.fx.flame` | kit:`glowSprite` (frames 3) | flame frames (`#F6D27A` / `#F4A95A` / white core), used by Lumen, the lantern posts and the Music Box |
| A171–A173 | `orrery_terraces.npc.quill` | **hero** (puppet, P2) | lacquered navy beetle shell with a gold edge; 2-frame legs; a cream quill feather in the mandibles |
| A174 | `orrery_terraces.npc.ilse_stars` | **hero** | a standing figure drawn only as ~24 star points (white, 3–6, with glow) joined by 1 px `#FFF4D6` lines; a long coat silhouette and a raised hand. Deliberately not a portrait |

### 7.14 UI (no trig files)

The panel, bar and HUD are shared React components styled by `UI_TOKENS` (20 §3). Revision-1 A175–A194 map as
follows: emblems A175–A182 → `Emblem` data (§3.2, §3.3) drawn by `DialogueBar`; A183 info button, A184 objective
ring, A185 hex pattern, A186 back tab, A187 verify frame, A188 badge frame, A189 scrubber knob → shared components
and `shared.ui.*`; A190 singer icons → the `claims` card's letter glyphs (code); A191 map profile → `MapOverlay`
style `terraces_profile` (code, P2); A192 journal reader → `JournalReader` style `parchment` (P2); A193 title
wordmark → the `title` cutscene step (React text); A194 HUD icons → `shared.ui.*`.

### 7.15 Drawn by code (no files; listed so nobody draws them)

- Beams (3 stacked additive lines + `shared.fx.beam_cap`), the L1 beam lines, the sync thread and its sag.
- The Vesper sweep arc, the gauge bob and marker, the ring misalignment arc, the e1 chevrons.
- Graph curves, grids, axes, ticks, annotations; the unit circle card.
- The slate claim traces and playhead (e3/e5), the lip relief inlay, water line and plumb marker (e4), the anchor cables, the mimic's legs.
- Chips, readouts, pin labels, plaque and claim texts, rail landmark labels, span-tile numerals, the Warden's equation (DOM).
- The fog alpha mask, the water front travel, the dotted guide lines in e4, ColorMatrix dormancy, the star twinkle.

### 7.16 Totals

| Tier | Hero files | Kit entries (≈) | Rig / puppets |
|---|---|---|---|
| P0 | 37 (z1 16, z2 13, z3 8) | ≈ 85 | `shared.char.wren`; Cog, Brasswick, the mimic crab, Ilse (heroes above) |
| P1 | 39 (+ `automaton_c`, `npc.lumen`) | ≈ 100 | + Lumen |
| P2 | 40 (+ `npc.quill`) | ≈ 110 | + Quill |
| post-demo | Wren's puppet (15 files), constellations | — | — |

Budget (02 §3f): P0 ≤ 1.2 MB raw / ≤ 350 KB gzip; peak VRAM ≤ 120 MB with one zone resident (z1 ≈ 95 MB at dpr
≥ 1.5), ≤ 180 MB during a swap.

---

## 8 · Fidelity mapping (bible §9 checklist, 44 items, 14 ★; 20 §8.3)

- The "Verify at" column says what the critic (R, 20 §7.2) captures (20 §8.3): 1920 × 1080 screenshots or short captures.
- ★ marks a mandatory item. The rubric is bible §9 (44 items, 14 ★: 1, 2, 9, 11, 15, 18, 21, 27, 30, 34, 35, 38, 40, 42), scored per 20 §8.3: **P0 pass = all ★ + ≥ 36/44** with items 37, 43 and 44 scored on zone 1 only; **full pass = all ★ + ≥ 39/44**. **Design target: 44/44** (item 14 is history-only and scores pass as not applicable).

| # | Item | How this game satisfies it | Verify at |
|---|---|---|---|
| 1 ★ | Painterly parallax (≥ 5 layers) | `sunward_day` has 10 layers across L1 (0.04/0.15), L2 (0.35), L3 (0.6), L5 (1.3), L6; every kit set has ≥ 5 | walk S0 left→right |
| 2 ★ | No 1-bit tiles | the Expedition host loads only the `shared` and `orrery_terraces` manifests | any screen |
| 3 | Sky gradient ≥ 3 stops | `Segment.sky` stops: 3 (z1, z2), 4 (gantry), 3 (dome) | S0, S4, S6 |
| 4 | Architecture vocabulary (≥ 3 motifs) | rings (dials, gates, medallions), gold trim, navy inlay bands, pillars/pylons | every scene |
| 5 | Soft lighting | contact shadows `#6E7F9A` 30 % multiply; kit AO + rim light; darkest colour `#2B3A44` | S2 gate close-up |
| 6 | Glow = live | dormant stations and `restoredBy` props at −40 % saturation, no glow; re-saturate over 1 s on solve | S1 before/after e1 |
| 7 | Foreground framing | an L5 layer crosses the bottom edge in every zone; W3 keeps it off station footprints | 8 scene captures |
| 8 | Biome identity | cream terraces, blue crystal trees, ring machines | thumbnails of all 3 games |
| 9 ★ | Articulated protagonist, 14–18 % height | Wren on the recoloured Kenney rig (`shared.char.wren`), 170 = 15.7 %, walk/run/jump/fall/climb/interact/think/cheer poses + spring scarf | walking capture |
| 10 | Scale ladder | z1: the Tidewheel wall (4.5 H); z2: the Echo Lift frame and the falls cliff; z3: the Warden (5.5 H); the Orrery tower dominates L1; consoles 0.7 H | S2, S3, S6 |
| 11 ★ | Guide presence | Cog's puppet at Wren's shoulder; his emblem in the bar | any frame |
| 12 | Purpose on screen | the RHYTHMS ring per zone; P1 beam lines to the tower | after e1 |
| 13 | Story beats in world terms | every station has approach, instruction, success, payoffLine and after lines naming the machine | panel frames |
| 14 | Sensitivity (history only) | N/A; every character fictional; Ilse only as stars | — |
| 15 ★ | World visible ≥ 45 %, undimmed | scrub (e1, e2, e6) leaves ≈ 58 % (42vw panel); board (e3, e4, e5) leaves 45 % (55vw); `frameFor` frames the contraption | any panel frame |
| 16 | Panel material | 20 §3.1 material, hex grid, backdrop blur | panel |
| 17 | Circuit-trace lines | back tab, Verify traces, badge brackets, claim and stone terminals, the `slot_rail` socket row | panel |
| 18 ★ | Graph cards | `graph`, `unit_circle`, `claims`, `slot_rail` cards with tabs, labelled ticks, grids | e1, e2, e6 |
| 19 | Axis units | π labels on e1–e5 (e5 to 4π); e6 numeric seconds (answer 4 is not a π multiple) | panels |
| 20 | Function colours consistent | f white, g green (sin θ, ghost, claims, pendulum), h blue (cos θ, laps, \|y\|, drift); world chips match | e1 world + panel |
| 21 ★ | Orange input scrubber | e1/e2/e6 the Scrubber is the input; e3/e4/e5 the orange **probe** Scrubber (`ProbeSpec`) | all panels |
| 22 | Value chips on the card edge | `ValueChip`s "0.50", "−0.87", "0.75π", "4.00" | e1, e2, e6 |
| 23 | Back arrow | `panel-back` on every panel; closes without grading | any panel |
| 24 | Verify named, trace-flanked, disabled until complete | ALIGN THE DIAL, LOCK THE RINGS, EXPOSE THE MIMIC, LAY THE SPAN, MATCH THE RHYTHM; `draft.complete` gates them | panels |
| 25 | Success badge | VESPER ALIGNED, RINGS LOCKED, MIMIC EXPOSED, SPAN LOCKED, RESONANCE LOCKED | success frames |
| 26 | Board tokens, snap, keyboard | `AimControl` (1–3, ↑/↓), `SlotRailControl` (Tab, Enter, 1–4, Backspace) | e3, e4 |
| 27 ★ | Bar anatomy | emblem (broken rings), (i) below it, text right; the emblem changes with `speakerId` | any panel |
| 28 | Sentence style | instructions imperative and name a part or the machine (R9); successes are single declarative truths | bar |
| 29 | Legibility | ≥ 22 px at 1280 w, contrast ≥ 7:1 | bar |
| 30 ★ | Live reaction (≥ 3 intermediate poses) | e1 carriage/beam/bob/marker; e2 rings, disc, tally, replay; e3/e5 lens, beam, hum, slate playhead; e4 stones, plumb marker; e6 pendulum rate, thread brightness | drag captures |
| 31 | World chips and pins | pins "5π/6", "I", bell, "x₁"/"x₂", metronome; chips θ bracket, sin θ, cos θ, y, laps, aim, \|y\|, 2 sin x, T | world |
| 32 | Eased physicality (lag ≤ 0.4 s) | controller easing 95 % in ≈ 330 ms; stones on 0.45 s arcs | drag capture |
| 33 | Partial feedback without the answer | e1 chevrons + bands; e2 misalignment arc + tally; e3/e5 the honest singer marked; e4 prefix locks, slack x₂ cable; e6 thread beat | failure frames |
| 34 ★ | In-world success animation 1.2–2.5 s with sound | e1 2.4, e2 2.2, e3 2.4, e4 2.5, e5 2.5, e6 2.5 s; synth cues §6.8 | success captures |
| 35 ★ | Payoff is traversal (the only route) | spoke stair +400, doorway, Echo Lift +500, span 900, rim stair +400, Star Door → finale; blockers + `maxStepUp` make each the only way | walk after each |
| 36 | Visible misconception | e1 beam into the floor at 5π/3; e2 tally II; e3 trough-to-peak bracket, same bell pitch at peak and trough; e4 dark second anchor; e5 four cycles in the 4π bracket; e6 huge swing vs small pendulum in lockstep | failure captures |
| 37 | ≥ 2 non-walk verbs per zone | z1 hop/climb/drop (P0); z2 hop/drop/ladder + sandbox (P1); z3 timed hop/ladder/climb (P1) | per-zone captures |
| 38 ★ | The orange input moves a world object in every encounter | e1/e2/e6 scalar inputs; e3/e5 `trace_slate`; e4 `relief_marker` | probe drag captures |
| 39 | The boss has staged presentation | arena trigger, `e6_arena` wake, real-time shield, taunts by key, common-start reset | S6 captures |
| 40 ★ | Hints act in the world | aid tiers fill cards/overlays; Cog flies to each station's `hintTargets` | hint captures |
| 41 | First world reaction within 150 ms of panel input | `bind` is synchronous; next rAF applies the eased pose | timing capture |
| 42 ★ | Payoff is used, not shown | the same six payoffs as item 35; blockers make each the only route to the next station | walk after each |
| 43 | Explore never silent (≤ 20 s) | P0: intro lines + `s0_controls` + station approach lines in z1; P1: the §6.3 triggers in every zone | 20 s walking capture |
| 44 | Sandbox or quest touch per zone | P1: the Brasswick quest (z1), the Music Box (z2); z3 per §2.7.3. At P0 zone 1 has no ungraded touch yet, so this is an expected P0 miss (inside the ≥ 36/44 margin) | per-zone captures |

---

## 9 · Generalization notes (for PDF-generated games)

### 9.1 Which archetypes are reusable (the library keyed by `familyId.mode`, 20 §4)

| Archetype (this game's skin) | Mode(s) | Reusable for any game with that mode? | Derived generically from `view` | Needs from the World Writer / biome kit |
|---|---|---|---|---|
| `emitter_rail` (`vesper_dial`) | `mapper.number_line` | **Yes.** An arc rail when the view is π-labelled over 2π (sin/cos gauges allowed), straight otherwise, log for log scales | ruler, landmarks, hairlines (`landmarkStep/6`), bracket readout, pose, parity test | nothing (`writerConfigSchema` is `null`); the skin's nouns, the hidden-target flavour from the biome kit |
| `ring_gate` (`ring_gate`) | `tuner.oscillator` | **Yes.** Ring angle = `b·T`; `variant: counterweight` for amplitude/midline asks | all three cards, tally, locked predicate | nothing (`null`); `flow` from the biome |
| `pendulum_sync` (`wardens_shield`) | `tuner.oscillator` (period, frequency) | **Yes.** A real-time sync against the view's wave; `autoWorld` picks it for the boss role | shield, pendulum, drift cards; `pendulum_beat` sim | nothing (`null`); guardian look and taunts are lines |
| `claim_holders` (`resonance_pillars`, `treasury_pillars`) | `truth_finder.mimic` | **Yes.** Without traces, `defaultConfig` gives text-only claims and an evidence card from `sourceRef.quote` | aim geometry, display order → holders, feedback nouns | `holders[].trace` (math claims drawn literally), `probe`; `validateConfig` checks every expression evaluates |
| `step_bridge` (`floating_steps`) | `sequencer.linear` | **Yes.** Stones fly to sockets; prefix locks; decoy crumbles | sockets from `view.slots`, stones from `view.planks` | `items[].glyph` from the glyph library, `stepEffects` from a fixed vocabulary, `probe`; `anchors` and `relief` are code/biome choices |

The success grammar (badge → success line → in-world plan → re-saturate → beam → traversal), the aid-tier ladder,
diagnosis and the hint flights are code and apply to every archetype.

### 9.2 What the World Writer writes for a game like this (20 §6.2 `WorldSlice`)

| `WorldSlice` field | This game's hand-authored value | Checked by code (`checkWorldSlice`, R8, R9, `validateConfig`) |
|---|---|---|
| `biome` | `orrery_terraces` | top-3 kits for the domain |
| `guideCharacterId` | `cog` | a spec character |
| `extras[]` (slots `extra_1..3`) | Brasswick, Lumen, Quill (the mimic and Ilse are code-templated roles in a generated game) | names not people in the source |
| `story` | title, logline, objective, "RHYTHMS", "rhythm" (§1.1) | lengths |
| `zones[]` | Sunward Terrace (first `e1_radians`), Crystal Stair (`e3_amplitude`), The Warden's Dome (`e6_boss`) with arrival lines | increasing `firstEncounterId`s |
| `intro[]`, `finale[]` | 1–3 lines each (the showcase has 10 and 7, hand-cut into cutscenes) | ≤ 140 chars, ≤ 24 words |
| `stations[]` | per encounter: contraption + skin, `objectNoun`, `partNouns`, instruction, tutorial, insight, hints ×3, fail default + byKey, success, payoffLine, probes, Verify label, badge, payoff anim, approach, after, `config` | the answer-leak matcher, the noun rule, probe fields, `fromWriterConfig` + `validateConfig` (traces evaluate; step keys exist) |
| `npcs[]` | Brasswick's two lines (a generated game gets ≤ 3 NPCs, one state each) | speaker slots |
| `collectibles[]` | journal-page facts from verified quotes | `conceptId` enum |

**Code-owned (never the model):** geometry (ground, platforms, blockers, payoff terrain from biome zone presets),
traversal links (from the kit's traversal templates: ≥ 1 hop and 1 climb or drop per zone), layer sets, props,
cutscene templates (intro, zone entry, rides, arena, finale with the kit vista), `ProbeSpec` ranges derived from
the view, aid tiers, tolerance parity, skin-specific config fields (`aimer`, `quarantineAnim`, `bays`), art.

The revision-1 "proposed schema for the architect" (§9.3 of revision 1) is **superseded** by 20 §6.2.

### 9.3 Porting checklist: from a new PDF to this level of fidelity

1. The pipeline makes the spec as today (units, concepts, encounters with modes and misconceptions).
2. `worldWriterSchema` offers each encounter only the archetypes whose `meta.modes` include its mode, with each one's skins, payoffs, fail keys and `writerConfigSchema`.
3. `rankBiomes(domain)` picks the biome kit (`orrery_terraces` for maths and physics; `living_gate` for biology; `archive_of_voices` for history).
4. The World Writer fills the slice; `assembleWorld` adds code-owned geometry, links, cutscenes and plaques from verified quotes.
5. `validateWorld` runs in S9 (R1–R16, W1–W3); failing stations fall back to `autoWorld` text and `meta.defaultConfig` — the world is never dropped.
6. The host runs the same explore/scrub/board/vault layouts, bar, HUD, map and finale. Only art, nouns, lines and configs differ.

---

## Appendix A · `e2_period` Station and the `z1_sunward` Zone, as the side-car carries them

```json
{ "encounterId": "e2_period", "zoneId": "z1_sunward",
  "consoleX": 6900, "consoleSurface": "ground", "consoleAsset": null,
  "anchor": { "x": 7400, "y": 836 }, "approachRadius": 500,
  "contraption": "ring_gate", "skin": "ring_gate",
  "config": { "flow": "water", "tally": true, "replayOnSettle": true, "ghostCard": true,
              "lapsCardTier": 2, "startMarkerTier": 1, "variant": "notch" },
  "objectNoun": "Tidewheel Gate", "partNouns": ["latch timer", "ring", "notch"],
  "pins": [ { "anchor": "tally", "text": "I", "glyph": null } ],
  "accessories": [], "frameZoom": null,
  "probes": [ { "predicate": "nearValue", "value": "pi/2", "tolFactor": 1, "key": "half" },
              { "predicate": "nearValue", "value": "2*pi", "tolFactor": 1, "key": "double" } ],
  "panel": { "layout": "scrub", "inputSymbol": "T", "verifyLabel": "LOCK THE RINGS", "successBadge": "RINGS LOCKED",
             "cards": [ { "slot": 0, "title": "f(t)", "x": null, "y": null, "hidden": false },
                        { "slot": 1, "title": "f(t + T)", "x": null, "y": null, "hidden": false },
                        { "slot": 2, "title": "laps", "x": null, "y": null, "hidden": false } ] },
  "dialogue": {
    "approach": [ { "speakerId": "cog", "text": "The Tidewheel Gate. Its ring runs on y = sin(2t). It must lap once and lock, or the canals stay dry.", "mood": "excited" },
                  { "speakerId": "cog", "text": "Those rings spin on a sine wave. Watch how fast, not how far.", "mood": "neutral" } ],
    "instruction": { "speakerId": "cog", "text": "Set the latch timer to one full period, so the ring's notch comes home and the gate locks open.", "mood": "neutral" },
    "tutorial": { "speakerId": "cog", "text": "The ring shows where it'll be when the latch fires. The green ghost is the wave, shifted by your timer.", "mood": "neutral" },
    "insight": { "speakerId": "cog", "text": "Where the green ghost lies exactly on the white wave, the ring is home and heading the same way.", "mood": "neutral" },
    "hints": [ { "speakerId": "cog", "text": "A period is how long the ring takes to come back to where it started, moving the same way.", "mood": "neutral" },
               { "speakerId": "cog", "text": "For y = sin(b·t), one period lasts 2π/|b|. The 2 in sin(2t) is b.", "mood": "neutral" },
               { "speakerId": "cog", "text": "Here b = 2, so divide 2π by 2.", "mood": "neutral" } ],
    "fail": { "default": { "speakerId": "cog", "text": "The pawl found no notch to catch. Watch the ring come home, moving the way it started.", "mood": "neutral" },
              "byKey": [
                { "key": "over", "line": { "speakerId": "cog", "text": "The latch waited too long: the ring kept going past home and the catch slipped. One lap is all it wants.", "mood": "worried" } },
                { "key": "under", "line": { "speakerId": "cog", "text": "Too soon! The notch hasn't come home. A faster wheel still needs one whole lap.", "mood": "worried" } },
                { "key": "half", "line": { "speakerId": "cog", "text": "Half a lap: the wave's back at zero, but heading down. A period ends moving the way it began.", "mood": "neutral" } },
                { "key": "double", "line": { "speakerId": "cog", "text": "Two laps! The tally counts two. The gate wants one lap, not the lap of plain old sin(t).", "mood": "wry" } },
                { "key": "aligned_multiple", "line": { "speakerId": "cog", "text": "Two laps! The tally counts two. The gate wants one lap, not the lap of plain old sin(t).", "mood": "wry" } } ] },
    "success": { "speakerId": "cog", "text": "Speed up the wheel and every lap gets shorter: double b, and the period halves.", "mood": "excited" },
    "payoffLine": { "speakerId": "cog", "text": "Hoo-hoo! Listen to that water. The Tidewheel's turning again.", "mood": "excited" },
    "after": [ { "speakerId": "cog", "text": "Two rhythms. Brasswick's arm should be back in step. He's been waiting on that water.", "mood": "neutral" } ] },
  "payoff": { "kind": "remove_blocker", "vertical": "none", "anim": "door_opens", "noun": "Tidewheel doorway",
              "blocker": { "x": 7330, "surface": "ground", "asset": null }, "terrain": [],
              "rideCutsceneId": null, "autoBoardMs": null, "feedsHub": true },
  "boss": null }
```

```json
{ "id": "z1_sunward", "name": "Sunward Terrace", "width": 8000, "height": 1600,
  "layerSets": [ { "id": "sunward_day", "layers": [
    { "asset": "orrery_terraces.layer.z1_clouds", "depth": "L1_far", "scrollFactor": 0.04, "scrollFactorY": null, "y": 60, "repeatX": true, "alpha": 1, "blend": "normal", "blurPx": 0, "driftPxPerSec": 6 },
    { "asset": "orrery_terraces.layer.z1_mesa", "depth": "L1_far", "scrollFactor": 0.15, "scrollFactorY": null, "y": 540, "repeatX": true, "alpha": 1, "blend": "normal", "blurPx": 0, "driftPxPerSec": 0 },
    { "asset": "orrery_terraces.layer.orrery_tower", "depth": "L1_far", "scrollFactor": 0.15, "scrollFactorY": null, "y": 260, "repeatX": false, "alpha": 1, "blend": "normal", "blurPx": 0, "driftPxPerSec": 0 },
    { "asset": "orrery_terraces.layer.z1_aqueduct", "depth": "L1_far", "scrollFactor": 0.15, "scrollFactorY": null, "y": 760, "repeatX": true, "alpha": 1, "blend": "normal", "blurPx": 0, "driftPxPerSec": 0 },
    { "asset": "orrery_terraces.layer.z1_crystal_field", "depth": "L2_midfar", "scrollFactor": 0.35, "scrollFactorY": null, "y": 620, "repeatX": true, "alpha": 1, "blend": "normal", "blurPx": 0, "driftPxPerSec": 0 },
    { "asset": "orrery_terraces.layer.z1_canopy_ruins", "depth": "L2_midfar", "scrollFactor": 0.35, "scrollFactorY": null, "y": 760, "repeatX": true, "alpha": 1, "blend": "normal", "blurPx": 0, "driftPxPerSec": 0 },
    { "asset": "orrery_terraces.layer.z1_terrace_wall", "depth": "L3_mid", "scrollFactor": 0.6, "scrollFactorY": null, "y": 700, "repeatX": true, "alpha": 1, "blend": "normal", "blurPx": 0, "driftPxPerSec": 0 },
    { "asset": "orrery_terraces.layer.z1_fore", "depth": "L5_fore", "scrollFactor": 1.3, "scrollFactorY": null, "y": 1380, "repeatX": true, "alpha": 0.7, "blend": "normal", "blurPx": 2, "driftPxPerSec": 0 },
    { "asset": "orrery_terraces.layer.z1_dapple", "depth": "L6_light", "scrollFactor": 1.0, "scrollFactorY": null, "y": 0, "repeatX": true, "alpha": 0.25, "blend": "multiply", "blurPx": 0, "driftPxPerSec": 4 },
    { "asset": "orrery_terraces.layer.z1_godrays", "depth": "L6_light", "scrollFactor": 1.0, "scrollFactorY": null, "y": 0, "repeatX": true, "alpha": 0.12, "blend": "add", "blurPx": 0, "driftPxPerSec": 0 } ] } ],
  "segments": [ { "id": "sunward_day", "x0": 0, "x1": 8000, "layerSet": "sunward_day",
    "sky": { "stops": [ { "at": 0, "color": "#D8D4CF" }, { "at": 0.45, "color": "#E8DCD2" }, { "at": 1, "color": "#F4E7DA" } ], "haze": { "color": "#FFFFFF", "alpha": 0.25 } },
    "ambient": { "light": "day", "particles": "pollen", "particleCount": 12, "shadowColor": "#6E7F9A", "dapple": null, "grade": { "saturation": 0, "brightness": 0, "hue": 0 } },
    "weather": "clear", "music": "curious", "runEnabled": true, "variants": [] } ],
  "interiors": [],
  "ground": { "points": [[0,1440],[1780,1440],[1800,1287],[2118,1287],[2120,1590],[2378,1590],[2380,1287],[2560,1287],[2600,1440],[5380,1440],[5400,1040],[8000,1040]],
              "surface": "orrery_terraces.ground.paving", "underside": "orrery_terraces.ground.terrace_underside", "maxStepUp": 102 },
  "platforms": [ { "id": "canal_stone", "points": [[2220,1300],[2280,1300]], "asset": "orrery_terraces.prop.stepping_stone", "requires": null },
                 { "id": "wisp_ledge", "points": [[3500,1270],[3600,1270]], "asset": "orrery_terraces.prop.ledge_cap", "requires": null } ],
  "links": [
    { "kind": "hop", "id": "s0_stepup", "from": { "surface": "ground", "x": 1760 }, "to": { "surface": "ground", "x": 1840 }, "requires": null, "apex": 120, "twoWay": true },
    { "kind": "hop", "id": "s0_stone_in", "from": { "surface": "ground", "x": 2110 }, "to": { "surface": "canal_stone", "x": 2240 }, "requires": null, "apex": 90, "twoWay": true },
    { "kind": "hop", "id": "s0_stone_out", "from": { "surface": "canal_stone", "x": 2270 }, "to": { "surface": "ground", "x": 2400 }, "requires": null, "apex": 90, "twoWay": true },
    { "kind": "drop", "id": "s0_canal_in", "from": { "surface": "ground", "x": 2110 }, "to": { "surface": "ground", "x": 2200 }, "requires": null },
    { "kind": "climb", "id": "s0_canal_rungs", "from": { "surface": "ground", "x": 2365 }, "to": { "surface": "ground", "x": 2392 }, "requires": null, "twoWay": true },
    { "kind": "hop", "id": "s1_ledge_up", "from": { "surface": "ground", "x": 3440 }, "to": { "surface": "wisp_ledge", "x": 3520 }, "requires": null, "apex": 100, "twoWay": false },
    { "kind": "drop", "id": "s1_ledge_down", "from": { "surface": "wisp_ledge", "x": 3595 }, "to": { "surface": "ground", "x": 3625 }, "requires": null } ],
  "exits": [ { "id": "z1_to_z2", "x": 7990, "surface": "ground", "toZoneId": "z2_crystal", "toX": 60, "toSurface": "ground",
               "transition": "walk", "requires": { "solved": "e2_period", "flag": null, "notFlag": null, "collected": [] }, "cutsceneId": null } ],
  "hub": null,
  "entry": { "x": 360, "surface": "ground" },
  "entryCutsceneId": null,
  "camera": { "xDeadzone": 0.3, "yDeadzone": 260, "lerp": 0.12, "minZoom": 0.6, "maxZoom": 1.15 } }
```

Zone-1 props for the P0 file (`props[]`, all `zoneId: "z1_sunward"`, `surface: "ground"` unless noted):
`gondola_dock` (`orrery_terraces.prop.gondola`, x 200, `L4_play`), `beam_pylon_s0` (`…prop.beam_pylon`, x 1500,
`L4_back`, `glow: true`), `telescope_s0` (P2), `crystal_tree_s0` (`…prop.crystal_tree`, x 900), `tree_salmon_a`
(x 1500, `L4_back`), `tree_salmon_b` (x 2400, `L4_back`), `canal_s0` (`…prop.canal`, x 2250, `L4_back`,
`restoredBy: "e2_period"`), `plaque_post_s0` (x 600), `crystal_tree_s1` (x 3700, `restoredBy: "e2_period"`),
`beam_pylon_s1` (x 5560, surface after the stair: ground at 1040, `restoredBy: "e1_radians"`), `canal_s2`
(x 7000, `restoredBy: "e2_period"`), `beam_pylon_s2` (x 7900, `restoredBy: "e2_period"`), lantern posts at x 3000,
4000, 6200, 7200, bushes and crystals scattered at 600-unit spacing outside the stations' footprints (W3).
