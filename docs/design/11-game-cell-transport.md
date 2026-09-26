# 11 · Game Design Document: **The Living Gate** (cell transport)

> Showcase fixture: `fixtures/cell-transport-dungeon.json` (`id: cell_demo_001`, `source.sourceId: src_cell_transport`,
> genre `dungeon`, title "The Membrane Vault", 11 encounters, seed 3341558849).
> Fidelity target: Triseum *Variant: Limits* (frames `images/3.png` … `images/10.png`), as translated in
> `docs/design/01-variant-design-bible.md` (the **bible**). Runtime seams: `docs/design/00-runtime-map.md` (the **map**).
> Art pipeline: `docs/design/02-assets-and-art-pipeline.md` (**02**). Contract, host, panel, library and waves:
> `docs/design/20-expedition-architecture.md` (**20**). Critique: `docs/design/30-critique.md` (**30**).
>
> **Status:** revision 2 (2026-09-26, evening). Re-pointed at 20 revision 2. **20 wins** on every API, type, key, layout
> width, asset path and coordinate convention; this document is authoritative for *content*: nouns, lines, poses,
> formulas, success timelines, and the exact data the side-car carries.
>
> **The player-facing title is "The Living Gate".** The fixture's `title` ("The Membrane Vault") stays as it is; the
> side-car `fixtures/worlds/cell-transport.world.json` carries the display title (20 §1.2). Nothing in this document
> changes a fixture byte, a mode file, a mode's `grade()`, or a contract in `src/contracts/`. Failure detail comes from
> `src/world/diagnose/**` (20 §2.5.4); there is no `firstMiss` export and no `noun` template var.

**Who implements from this doc:**
(Lanes and windows are 20 §7, which is authoritative.)
- **C0 (L9, T0 + 2 → 6) then C2 (L4, T0 + 6.5 → 15)** author `fixtures/worlds/cell-transport.world.json` from §2.5
  (zones), §3.5 (cast), §4.2 (cutscenes), §4.3 (every line with its slot), §5.x (the station JSON of every encounter)
  and §6 (side content), and the palette `src/game/art/palettes/living_gate.ts`. Every value is given; nothing needs
  inventing. C2 also draws the zone-A heroes, the landmarks and the `specimen_pods`, `membrane_router` and
  `endocytosis_lift` hero parts (22 files).
- **A2 (L5, art)**: the kit layer sets from §2 and a kit entry for every skin slot (§7).
- **KB (L7, engine)**: §5 (live bindings, pose formulas, success and failure timelines, hint actions) for the skins
  `specimen_pods`, `membrane_router`, `carrier_lanes`, `gatekeeper_maws`, `tonicity_sluices`, `pump_rewiring`,
  `endocytosis_lift`, the five biology sims, and the hero parts of `tonicity_sluices`, `carrier_lanes`,
  `pump_rewiring`, `gatekeeper_maws` (14 files).

---

## CHANGELOG (revision 2)

Every amendment of 30 §4 that names this document (or names "all three game docs"), and every place 20 revision 2
needed the cell content re-pointed. "§" numbers are this document's.

| # | Amendment (short) | Folded into | What changed |
|---|---|---|---|
| 1 | Speakers outside `spec.characters` | §3.5 `cast.extras`, §4.3 `speakerId` column | Sucra, Poro, Kay and the Ferryman are `cast.extras`; every line carries a `speakerId` ∈ `{pilot, gatekeeper}` ∪ extras ∪ `{narrator, player}`. |
| 2 | Traversal links replace jump physics | §2.6 (new), §2.5 zone JSON `links`, §3.1 | Every non-walk move is a `Zone.links` entry (`hop`, `climb`, `ladder`, `drop`, `ride`); the old "jump height 1.1 H" and crouch-walk are gone; keys defer to 20 §3.5. |
| 3 | Probe channel | §5.0 R4, every scrub station's `config.probe` / `config.stages` | The six exploration scrubbers (d, a, s, r, k, k) are `ProbeSpec`s inside the contraption config; the old `setLiveValue` path is retired. |
| 4 | Time and simulation | §5.0 R7, §5.1, §5.3, §5.4, §5.7 | Measurable state lives in the pure sims `bilayer_probe`, `diffusion_tank`, `osmotic_cell`, `pump_flume`, `membrane_fold` (20 §4.2); cosmetic particles stay in the prefab. |
| 5 | Bindings rewritten; new archetypes and skins | §0, §5.x binding tables | e1/e3/e4/e7 `claim_holders` / `specimen_pods` (scrub); e2 `membrane_router`; e6 `carrier_lanes`; e11 `gatekeeper_maws`; e5/e9 `sluice_waves` / `tonicity_sluices`; e8 `stage_machine` / `pump_rewiring`; e10 `step_bridge` / `endocytosis_lift`. |
| 6 | Generalized payoff | §1.3, §5.x `payoff` | Every payoff is `{kind, vertical, anim, noun}` from `PAYOFF_KIND_OF`: `ramp_forms` ×2, `barrier_lifts`, `water_rises` ×2, `steps_emerge`, `door_carries`, `lift_moves`, `gate_lifts`, `vesicle_carries` (down), `vault_opens`. |
| 8 | Station geometry, accessories, framing, boss | §5.x station JSON | `consoleX` + `anchor` (per zone), `consoleSurface` (`pump_deck`, `pit_ledge`), `frameZoom` (e10 0.85, e11 0.75), `boss` on e11. |
| 9 | Dialogue slots | §4.3 (rewritten), §4.5 | Lines now fill `approach`, `instruction`, `tutorial`, `insight` (pre-success truth, new), `hints[3]`, `fail {default, byKey}`, `success` (the old "insight" lines), `payoffLine` (the old "success" lines), `after`. |
| 10 | Hints act in the world | §5.0 R11, "Hints in the world" in every §5.x | `aidTier` gates Pip's water lens (`lensTier: 1`); every station lists its `hintTargets` per rung. |
| 11 | `diagnose()` is the only failure source | §5.0 R5, every §5.x failure plan | R5/X3 (`firstMiss`) and X8 (`noun` var) are dropped; failure plans act on `Diagnosis.wrongKeys[0]` / `failKey`; misconception probes are `station.probes`. |
| 12 | Demo cut | §0.1 (new) | P0 / P1 / P2 per item; zone A full art with 14 heroes, 36 P0 heroes game-wide; express timing. |
| 13 | Every `configSchema` now | §5.x "Station JSON" | Exact config values for all 11 stations, keyed by `statementIndex`, item key, wave index or left/right key. |
| 14 | Procedural kit | §0.1.2, §7 | Every asset re-tagged `hero` or `kit:<generator>`; hand-authored files drop from 182 to 36 at P0 (40 at P1). |
| 15 | Ambient triggers | §6.3 `triggers` | `s1_walk*`, `s1_roots` (hint), `s1_node`, `zB_arrive`, `zC_arrive`, `s7_walk*`, `s7_viewpoint`. |
| 16 | NPC states and quests | §6.3 `npcs`, `quests` | Sucra's escort is five `NpcState`s across four zones; Kay's Lanterns is a `quest` (talk → touch ×3). |
| 17 | Sandbox | §6.5 | The Plant Cell Garden is a `plant_garden` sandbox (skin `plant_pool`) with goal `plasmolysed`. |
| 18 | Gatekeeper staged as a boss | §5.11, §4.3 e11 rows | `boss.phases` `[i0, i1]`, `[i2, i3]`, `[i4, i5, i6]`, each with a Gatekeeper line; `taunts.fail` ×2 and `taunts.byKey` ×3; arena cutscene `e11_arena`; maws open on focus, the eye-ring tracks the focused cargo, the ATP pipe surges with the projected spend. One `Input`, one `grade()`. |
| 19 | One recoloured Kenney rig | §3.1 | The Diver is `shared.char.diver` (female_adventurer, recoloured) with three costume overlays on rig anchors. |
| 20 | Per-zone coordinates | §2.5, every x and y | Cumulative x up to 29 200 becomes four zones (7400 / 8400 / 7800 / 5600 wide) with `y` down from each zone's top; the conversion table is §2.5.1. |
| 21 | Glyphs by text-to-path | §7 conventions | "Phaser text on blank plates" is gone: dynamic labels are DOM (`WorldLabelLayer`); fixed wordmarks are `<text data-engrave>`. |
| 22 | One naming table | §7 (every key) | `cell.*` ids become `living_gate.<group>.<name>`; part keys are `living_gate.part.<skin>_<slot>`; old ids survive as `legacyId`. |
| 24 | Purpose meter, progress, map, journal | §6.2, §6.4 | `story.meter` "GRADIENT" 12 → 100 % drives the HUD bar and the ambient motes; 11 `hub_socket` effects on the Nuclear Pore (P0); conduits and seal nodes (P1); Cell Chart map and Logbook (P2). |
| 25 | Cutscene verbs | §4.2 | Eight cutscenes as `CutsceneStep` lists (intro, four rides and carries, arena, finale). |
| 26 | Leaks before Verify | §5.8 | The e8 "?" glyph is gone: a cartridge in a socket of another kind shows a neutral **"loaded: 1 ATP"** label, and only the stage playback shows what it does. |
| 28 | Traversal beat sheets | §2.6 (new) | Each zone lists ≥ 2 non-walk verbs besides its payoffs, with positions; S7 becomes the gulf **ride** plus the **viewpoint detour** (climb, drop, trigger). |
| 29 | Game-feel items 37–41 | §8 | Scored alongside 1–36. |
| 30 | Per-game performance plan | §2.4.1 (new) | Static bilayer strip + a pooled window of 60 jittering head sprites (±900 units of the camera centre); parting and gel only near e1; motes ≤ 120 from the meter. |
| 31 | DOM fallback = snapshots | §5.0 R8 | The DOM host draws each skin's dormant or solved snapshot; no per-contraption DOM code. |
| 32 | Framing | §5.10, §5.11 | `frameZoom` 0.85 (the pit, collar and sub) and 0.75 (the 6 H Gatekeeper). |
| 33 | Controls | §5.0 R9, §5.5, §5.9 | No `sluice` layout: e5/e9 are `scrub` with a `WaveControl` (Verify after the last wave, answers preselected on retry). |
| 34 | R8 token matching | §4.4 | The line check runs the banned values of each station (the mimic statement for e1/e3/e4/e7, the first step for e10) against the non-exempt slots. |
| 35 | Synth cue bank | §6.7 (new) | Every cue id used here maps to a 20 §2.12 recipe. |
| 36 | `feedbackNouns` | §9.3 root JSON | `chest → pod`, `chests → pods` for e1, e3, e4, e7 (display only); X8 dropped. |
| 37 | Quiz-voiced and fourth-wall lines; varied quarantines | §4.3, §5.P | `e4_approach`, `e9_approach` and `in09` rewritten; every question-form line is now a statement; the four quarantines differ (ridge thaw, tank dilate, raft-lock flood, lanterns ignite) and so do their Verify labels. |
| 40 | One overlay location | header, §9.3 | `fixtures/worlds/cell-transport.world.json`, `appliesTo: {specIds: [cell_demo_001], sources: [{src_cell_transport, dungeon}]}`. |
| 20 §1.4 | Keys, widths, line limits, insight | §3.1, §4.3, §5.0 R9–R10 | One key map (20 §3.5); panel widths from 20 §3.1 (scrub 42vw, board 55vw); every line ≤ 140 characters and ≤ 24 words; `insight` = pre-success truth, `success` = post-success concept. |

**Content decisions made while re-pointing** (logged here so C2 does not re-open them):
- **Plaque P4 moved behind e8.** "Three Na⁺ out, two K⁺ in, one ATP" stood on the pump deck *before* e8 and gave its
  answer away. It now `requires: {solved: e8_pump}`.
- **The Plant Garden stair moved to the trench's far wall.** A heightfield has one height per x, so an alcove cannot sit
  under the road; the side stair now climbs from the Threshold road (x 6660) to an alcove platform at y 1043.
- **Rides that land on a platform** (e7 gantry → `pump_deck`, e9 barge → `pit_ledge`) use the `ride` step's
  `toSurface` (20 §1.3, A8). The revision-2 fade + `enter_zone` workaround is gone.
- **Sheer edges.** A ground change larger than `maxStepUp` within 8 units is a sheer edge, and per 20 §2.4.1 (A8) it
  blocks walking in both directions (the e4 raft ledge, the e5 trench, the S7 gulf), so a `drop` link is the way
  down.
- **The e3 "a = 0 at success" ad-lib is dropped.** A station line cannot depend on the probe value at success.
- **Speakers without a body at P0.** Sucra, Kay and the Ferryman are P1 puppets, so their lines move out of station
  slots into their `NpcState`s (P1). Poro's two lines stay in e5's `approach`/`after` at P0, because his statue is the
  zone B hero landmark.

---

## 0 · At a glance

| | |
|---|---|
| Host | The **Expedition** host (20 §2): full-bleed painterly side view, right-side instrument panel (20 §3), dialogue bar, HUD with the Gradient meter. `?host=legacy` still plays the dungeon host |
| Biome | `living_gate`, **the Membrane Frontier**: the outer surface of cell V-7. The ground is a literal cross-section of the phospholipid bilayer, the sky is extracellular fluid, and the cytoplasm glows under your boots. After e10 the player is carried inside, and the sky becomes the amber **cytoplasm sky** |
| Protagonist | **The Diver** of the shrunken submarine *Halcyon*: `shared.char.diver` (the shared Kenney rig, recoloured) with a bubble helmet, tide scarf and probe-staff |
| Guide | **Pilot Ora** (fixture character `pilot`, `cheerful_sidekick`), speaking from the *Halcyon*; in-world companion **Pip**, a teardrop mini-sub (`living_gate.companion.pip`) |
| Boss | **The Gatekeeper** (fixture character `gatekeeper`, `gruff_guard`), the oldest pump protein in the cell, squatting on the road to the nucleus |
| Purpose | The **Stillness** has frozen every transport protein, and the cell's gradients are draining toward equilibrium, which for a cell means death. Restart all 11 gates, push the **Gradient** meter from 12 % to 100 %, and open the Nuclear Pore |
| Zones | 4 zones, 8 scenes: `zone_a` Glycocalyx Shore (S1–S2) → `zone_b` Tide Basins (S3–S4) → `zone_c` Pump Hall (S5–S6) → `zone_d` Cytoplasm (S7–S8) |
| Stations | 11, in fixture order. Scrub layout: e1, e3, e4, e7 (`claim_holders`), e5, e9 (`sluice_waves`), e8 (`stage_machine`), e10 (`step_bridge`). Board layout: e2, e6, e11 (`router_lanes`) |
| Orange input | Every station: the mode's control drives the world, and six stations add an ungraded **probe** (`d` nm, `a` mM, `s` %, `r` ATP/s, pump stage `k`, playback `k`) that moves a world object |
| Cards | `graph` (gradient cards with live dots), `bars` (solute gauges, volume sparkline, charge ledger), `schematic` (pump and pit cross-sections), `link_board`, `claims`, `slot_rail`, `energy_cells` (ATP) |
| Colour law | **white = outside** (extracellular), **green = inside** (cytoplasm), **blue = water / volume**, **gold = ATP**, **orange = your input, nowhere else** |
| Art | P0: **36 hand-authored hero SVGs** (14 of them in zone A) + about 120 kit entries + the recoloured rig; P1: 40 heroes (§0.1, §7) |

---

## 0.1 · P0 demo cut (2026-09-27)

Priorities follow 20 §0.1: P1 starts only when P0 is green on both Playwright projects; P2 only after P1. The
architecture already supports every P1/P2 item; the cut only decides what C2 and the art agents author first.

### 0.1.1 P0: must ship

| Item | P0 content | Where |
|---|---|---|
| Stations | **All 11 playable** (native archetype, live link, probe where listed, Verify, diagnosis-driven failure, success animation, payoff traversal, every dialogue slot, aid-tier hint actions) | §5.1–§5.11 |
| Boss | e11 staged: arena trigger at x 3000, `e11_arena` cutscene, 3 presentation phases (2 + 2 + 3) each with a Gatekeeper line, taunts on failure (2 cycled + 3 by probe key), maws open on focus, eye-ring tracks the focused cargo, ATP pipe surges with the projected spend | §5.11 |
| Intro | `intro`: pull up through the bilayer → title card → *Halcyon* settles → Pip chirps → Ora on comms → pan to the Colonnade Rise → control | §4.2 |
| Finale | `finale`: the pore turns (`hub restored`) → walk in → Gradient 100 % → outro lines → fade | §4.2 |
| Full-art zone | **Zone A, Glycocalyx Shore** (S1 + S2, e1 + e2): every layer, the ground, props, the finish stack (20 §5.6), all e1/e2 parts; **14 heroes** | §0.1.2 |
| Kit zones | Zone B: kit layers + **Poro statue** (landmark) + the sluice trench (kit `ground.trench`) · Zone C: kit layers + **the Pump Hall vault wall** (`layer.hall_vault`) · Zone D: kit layers + **the Nuclear Pore** (`prop.nuclear_pore`) and the zone-D nucleus dome; plus every station hero part in each zone | §0.1.3 |
| Traversal | Zone A: `hop` ×2 (root ledge, root hump) + `climb` (stud ledge). Critical-path links in other zones: `drop` into the drained trench (B), `ladder` off the pump deck (C). Every payoff traversal (ramp, ramp, boom, raft ride, steps, carrying door, gantry ride, gate, barge ride, vesicle descent, pore) | §2.6 |
| HUD | objective ring (`GATES n/11`), objective line, **Gradient meter** (drives ambient motes), key legend, mute, dialogue bar with emblems, (i) Brief + Hints sheet, journal = MasteryHud | §6.2 |
| Plaques | P1 "The Two Faces" and P2 "Why Oil Says No" (they reward the two zone-A side links) | §6.1 |
| Sound | every cue id mapped to a synth recipe | §6.7 |
| Express | `?express=1` completes all 11 stations and the finale in about 12 minutes | §0.1.5 |
| DOM fallback | each skin's dormant or solved snapshot + the full panel | §5.0 R8 |

### 0.1.2 Zone A full art: the hero files (by key)

Zone A is the only zone with full hand-authored art at P0. Its **14 hero files** (all `source: "hero"`):

| # | Key | Use in zone A | Old id | Kit fallback (declared in `biome.json`) |
|---|---|---|---|---|
| 1 | `living_gate.part.endocytosis_lift_halcyon` | S1 dock (intro prop at x 300); reused by e10 | #135 | `compose(plate, ringStack)` |
| 2 | `living_gate.prop.stiff_ridge` | e1 blocker (`payoff.blocker.asset`) | #33 | `bilayerTile gel` hump |
| 3 | `living_gate.part.specimen_pods_pod` | e1 pods (pedestal + capsule; reused e3, e4, e7) | #73 + #74 | `compose(column, plate)` |
| 4 | `living_gate.part.specimen_pods_probe_emitter` | e1 aimer (reused e3, e4, e7) | #78 | `compose(column, glowSprite)` |
| 5 | `living_gate.part.specimen_pods_needle` | e1 probe needle | #79 | `linkStrip rod` |
| 6 | `living_gate.part.specimen_pods_mimic_mote` | the Mimic Mote in every quarantine | #77 | `glowSprite puff` |
| 7 | `living_gate.part.membrane_router_crossing_gate` | e2 gate body (arch + ring tube) | #80 | `compose(arch, ringStack)` |
| 8 | `living_gate.part.membrane_router_gate_fin` | e2 keystone fins (right = `flipX`) | #83/#84 | `crystalCluster spire` |
| 9 | `living_gate.part.membrane_router_carrier_rocker` | e2 payoff ramp | #86 | `plate slab` |
| 10 | `living_gate.costume.diver_helmet` | protagonist overlay (anchor `head`) | #174 | `ringStack` bubble |
| 11 | `living_gate.costume.diver_scarf` | protagonist overlay (anchor `back`, spring) | #175 | `plate` segment |
| 12 | `living_gate.costume.probe_staff` | protagonist overlay (anchor `hand_r`) | #176 | `linkStrip rod` |
| 13 | `living_gate.companion.pip` | companion (every zone) | #177 | `molecule drop` |
| 14 | `living_gate.companion.ora_bust` | dialogue portrait in cutscenes | #179 | `ringStack` emblem |

Everything else in zone A is kit (§7): the sky swirls, `tissue_far`, `glycan_forest`, `cyto_glimpse`,
`colonnade_rise`, `glycan_fronds`, caustics and god rays, the bilayer ground and pooled heads, cholesterol studs,
the seal node, the console, the cargo glyphs, the gate rings, the Oil Road plate, plaque posts, and the root and stud
ledges.

**The P0 hero budget, game-wide: 36** (≤ 40 per 02 §3a, ≤ 60 per 20 §5.8). The other 22 are the zone B–D station
parts and landmarks:

| # | Key | Zone | Use | Old id | Kit fallback |
|---|---|---|---|---|---|
| 15 | `living_gate.part.specimen_pods_balance_beam` | B | e3 Balance Lock beam (the boom) | #90 | `plate` + `linkStrip rod` |
| 16 | `living_gate.part.specimen_pods_test_cell` | B | e4 test cell (ring + fill, scaled live) | #94 + #95 | `bilayerTile ring` + `molecule cell` |
| 17 | `living_gate.part.tonicity_sluices_valve_wheel` | B | e5/e9 valve wheel | #100 | `ringStack` spokes |
| 18 | `living_gate.part.tonicity_sluices_cell_rbc` | B | e5/e9 red blood cell | #106 | `molecule cell` |
| 19 | `living_gate.part.tonicity_sluices_cell_plant` | B | e5 plant cell wall | #107 | `molecule cell` |
| 20 | `living_gate.part.tonicity_sluices_cell_potato` | C | e9 potato cell | #110 | `molecule cell` |
| 21 | `living_gate.part.carrier_lanes_carrier_door` | B | e6 revolving Carrier Door | #112 | `ringStack` drum |
| 22 | `living_gate.part.carrier_lanes_pump_gate` | B | e6 Pump Gate | #115 | `compose(plate, ringStack)` |
| 23 | `living_gate.npc.poro` | B | **zone B landmark** (statue prop at P0; NPC at P1) | #186 | `compose(column, arch)` |
| 24 | `living_gate.layer.hall_vault` | C | **zone C landmark**: the ribbed vault wall with ring windows (L1) | #9 | `compose(ashlarWall, ringStack)` |
| 25 | `living_gate.part.specimen_pods_flume_pump` | C | e7 flume pump (with its piston group) | #120 | `compose(plate, column)` |
| 26 | `living_gate.part.pump_rewiring_pump_housing` | C | e8 pump housing (3.5 H) | #125 | `compose(ashlarWall, ringStack)` |
| 27 | `living_gate.part.pump_rewiring_drum` | C | e8 inner drum | #128 | `ringStack` with 6 sockets |
| 28 | `living_gate.part.pump_rewiring_jaw_upper` | C | e8 upper jaw (the lower jaw is kit) | #126 | `plate` |
| 29 | `living_gate.part.endocytosis_lift_dynamin_collar` | C | e10 dynamin collar | #137 | `ringStack` helix |
| 30 | `living_gate.layer.nucleus_dome` | D | zone D L1 nucleus + finale (2600×900, dome in the right half) | #11 | `ridgeBand dome` |
| 31 | `living_gate.prop.nuclear_pore` | D | **zone D landmark**: the Nuclear Pore hub (outer ring, spokes, 11 sockets) | #149 | `ringStack` (8 spokes, 11 sockets) |
| 32 | `living_gate.part.gatekeeper_maws_gatekeeper_body` | D | e11 Gatekeeper body (6 H) | #142 | `compose(ashlarWall, column)` |
| 33 | `living_gate.part.gatekeeper_maws_maw_oil` | D | e11 Oil Maw | #145 | `bilayerTile ring` |
| 34 | `living_gate.part.gatekeeper_maws_maw_channel` | D | e11 Channel Maw | #146 | `ringStack` |
| 35 | `living_gate.part.gatekeeper_maws_maw_pump` | D | e11 Pump Maw | #147 | `plate` teeth |
| 36 | `living_gate.part.gatekeeper_maws_eye_ring` | D | e11 eye-ring | #143 | `ringStack` broken rings |

**P1 adds 4** (`living_gate.companion.ora_bust_focus`, `living_gate.npc.sucra`, `living_gate.npc.kay`,
`living_gate.npc.ferryman`): **40 total**, inside both caps. 20 §4.3 tags `jaw_lower`, `cell_generic`, the cargo
glyphs and the molecule glyphs as heroes; this document authors them with kit generators (`plate`, `molecule`) to stay
at 40, and they may be upgraded later without changing a key.

### 0.1.3 Kit zones (B, C, D): layers + one hero landmark

| Zone | Layer set(s) (all kit) | Hero landmark | Station heroes in the zone |
|---|---|---|---|
| `zone_b` Tide Basins | `basins`: `swirl_basins`, `tide_cliffs`, `dormant_towers`, `cyto_glimpse`, `basin_walls` (with the tide falls), `bubbles`, `caustics` | `living_gate.npc.poro` (statue prop at x 5080) beside the kit `ground.trench` | balance beam, test cell, valve wheel, RBC and plant cells, carrier door, pump gate |
| `zone_c` Pump Hall | `hall`: `hall_ribs`, **`hall_vault`** (hero), `hall_pillars`, `hall_rails`, `hall_balustrade` · `pit`: `swirl_pit`, `tide_cliffs_dusk`, `dormant_towers`, `pit_rim`, `glycan_fronds` | `living_gate.layer.hall_vault` (the ribbed vault wall with ring windows) | flume pump, pump housing, drum, upper jaw, dynamin collar, potato cell (e9) |
| `zone_d` Cytoplasm | `vault_road`: `swirl_cytoplasm`, `organelles`, **`nucleus_dome`** (hero), `cytoskeleton`, `ceiling_band`, `actin` · `vault`: `vault_glints`, `envelope`, `nucleus_dome`, `vault_court`, `ceiling_band`, `actin` | `living_gate.prop.nuclear_pore` (the hub) | Gatekeeper body, 3 maws, eye-ring |

If a zone's layers are late, A1's default kit zone preset for `living_gate` renders it (20 §0.1.6 fallback ladder).

### 0.1.4 P1 and P2

| Priority | Item | Section |
|---|---|---|
| **P1** | Traversal beat sheets for zones B–D (W2 clean): B `hop` down off the raft ledge, `climb` to the garden alcove, `drop` back; C `hop` to the pipe run, `hop` to the rail perch, `drop` down; D the **gulf ride** (ground profile swap), the strut `climb` to the high rail, the viewpoint trigger, the rail `drop` | §2.6 |
| P1 | **Kay's Lanterns** quest (talk → touch ×3) | §6.3 |
| P1 | **Plant Cell Garden** sandbox (`plant_garden`, goal `plasmolysed`) | §6.5 |
| P1 | NPC bodies and states: Sucra (5 states), Poro (2), Kay (2), the Ferryman (1); the extras' station lines move into states | §6.3 |
| P1 | Ambient, hint and arrival triggers (10) | §6.3 |
| P1 | Progress effects beyond the pore sockets: 11 conduit segments, 3 seal nodes, the Nerve Beacon, the side stair | §6.2 |
| P1 | Plaques P3–P5; Ora's focus bust; outro lines `out04` (Sucra) and `out05` (Kay) | §6.1, §4.2 |
| **P2** | The **Cell Chart** map (`story.map`, style `cell_rings`), the **Logbook** journal reader, 3 insight shards, the bin-card art, the Gradient bar skin, drifting vesicles, the `ride` landing polish (§CHANGELOG) | §6.4, §6.6 |

### 0.1.5 Express timing (`?express=1`)

Express walks to each console at 2× speed, plays every payoff traversal, and trims each cutscene after its first `say`
(the finale is not trimmed). First-try solves: 11 stations × about 55 s (panel open → Verify → 1.2–2.5 s success → payoff
traversal) + 4 zone transitions + the finale ≈ **12 minutes**, matching 20 §0.1.5.

### 0.1.6 Fallback per station (20 §0.1.6 step 3)

If an archetype is not native by the P0 freeze, its stations play on `console_slate` (the existing widget in a lectern
slate) with the same dialogue, payoff and traversal. Risk order, highest first: e8 (`stage_machine`), e10 (`step_bridge`
with `bays: stage_rail`), e5/e9 (`sluice_waves`), e11 (boss phases), then the four `claim_holders` sims. The station
JSON in §5 stays valid either way: `console_slate` ignores `config`.

---

## 1 · Pitch and purpose

### 1.1 Pitch (3 sentences)
*The Living Gate* is a painterly side-view expedition across the surface of a living cell. You are the Diver of the
shrunken submarine *Halcyon*, walking a landscape made of the phospholipid bilayer itself while the cytoplasm glows
through the ground beneath your boots. Every gate in this membrane is an ancient transport machine that the Stillness
has frozen. You restart each one by setting it to its true rule (which molecules it admits, which way they flow, and
what it costs) and watch the world move under your hands. Then you ride the membrane itself into the cell and outwit
the oldest pump alive to wake the nucleus.

### 1.2 What is broken and what is at stake
- **Broken.** A living cell survives *because its inside is different from its outside*: more K⁺ inside, more Na⁺
  outside, the right amount of water and fuel in the right places. Those differences are **gradients**, and transport
  proteins maintain them. The **Stillness** has seized every gate in cell V-7. Its pumps have stopped, its channels have
  locked, and a stretch of its membrane has even frozen rigid.
- **At stake.** Without working pumps the gradients slowly dissipate. This is the fixture's own boss source quote
  (e11 `sourceRef`, p. 3): *"If a cell runs out of ATP, its pumps stop and the gradients they maintain slowly
  dissipate."* When the Gradient meter reaches 0 %, inside equals outside. **Equilibrium sounds calm, but for a cell it is
  the end.** The nucleus has sealed itself behind the Gatekeeper to wait it out.
- **What the player restores.** Each gate the player restarts re-establishes one flow and lights one **gradient
  conduit**, a glowing line running along the membrane toward the Nuclear Pore (the Variant beam network, frame 3). In
  data: one `hub_socket` progress effect per station on the pore (P0) and one conduit segment `prop_state` (P1). The
  Gradient meter climbs from **12 % to 100 %** (§6.2). The world visibly re-saturates, and the ambient particles
  separate again: coral Na⁺ motes crowd the sky and violet K⁺ motes crowd the cytoplasm below. At the end the Nuclear
  Pore's rings turn open.

### 1.3 Why the concepts are the only way through (the education *is* the mechanism)

No gate asks a question. Each gate is a machine whose working state is the concept, so knowing the concept is simply
knowing how to set the machine. A wrong idea never costs points. It makes the machine do the wrong physical thing, in
plain view.

| Enc | What is physically blocking the way | Why only the concept moves it | Traversal payoff | `payoff` (kind / vertical / anim) |
|---|---|---|---|---|
| e1_bilayer | A **Stiff Ridge**: membrane frozen rigid (gel-phase) into a wall | The ridge thaws only when the Mimic's "rigid wall with holes" story is quarantined. Proving the membrane is fluid makes it flow | The ridge melts into a ramp; walk over it | terrain / up / `ramp_forms` |
| e2_selectivity | The **Crossing Gate's** arch is shut | The gate cycles only when every molecule is routed by polarity and charge (oil road vs protein gate) | The arch opens and a carrier rocker tilts into a ramp up to the next terrace | terrain / up / `ramp_forms` |
| e3_diffusion | The **Balance Lock**, a gold beam barrier weighed by the dye tank | The beam levels only at equilibrium, which random motion alone produces once the purposeful-particle lie is gone | The beam lifts like a boom barrier | remove_blocker / none / `barrier_lifts` |
| e4_osmosis | The upper ledge is 2 H up, with a dry raft lock | Water rises into the raft lock only by osmosis toward the salted side, and salt never moves | Ride the raft up | ride / up / `water_rises` |
| e5_tonicity | A flooded **sluice trench** | It drains only when each lock's bath is labelled by solute relative to the cell | Drop into the drained trench, climb the emerged steps | terrain / up / `steps_emerge` |
| e6_facilitated | The Pump Hall's revolving **Carrier Door** | The door turns only when cargo is split by gradient direction, not by protein presence | The door carries you inside | carry / none / `door_carries` |
| e7_active | A dark hall with an unpowered gantry | The lanterns ignite once the "pumps only speed up downhill flow" lie is gone | Ride the gantry lift up | ride / up / `lift_moves` |
| e8_pump | The **Hall Gate** is chained to a dead Na⁺/K⁺ pump | The pump cycles only when it is wired 3 Na⁺ out, 2 K⁺ in, 1 ATP. Its crank lifts the gate | Ladder down, walk under the lifted gate | remove_blocker / none / `gate_lifts` |
| e9_osmosis_review | A barge sits in a low canal | The lock fills only when every cell's water direction is called right | The barge rises to the Endocytosis Pit | ride / up / `water_rises` |
| e10_bulk | No channel is big enough for the *Halcyon* | The membrane must swallow you: touch → fold → pinch → carry, in order | **You are the cargo**: ride the vesicle into the cell | carry / down / `vesicle_carries` |
| e11_boss | The **Gatekeeper** sits in front of the Nuclear Pore | His three maws accept only cargo sorted by direction and polarity | He turns aside; the pore opens; the finale | remove_blocker / none / `vault_opens` |

Zones A, B and C each have a vertical payoff (W1). Zone D's only station payoff is `vault_opens` (vertical `none`), so
W1 fires one expected warning for `zone_d`; its vertical beats are the e10 descent into it and, at P1, the gulf ride.

---

## 2 · World and biome

### 2.1 The biome concept: the membrane is the ground

The side-view camera looks at a **cross-section of the membrane**. The walkable surface is the top of the outer leaflet: a
rolling cobbled road of round cream **lipid heads**. Below it, the band shows each phospholipid as a tiny pillar with
**twin gold tails**, the bible's "membrane colonnade" read sideways. At the band's centre a navy inlay line (the
**oil seam**, the hydrophobic core) runs the length of the world, and the inner leaflet mirrors the outer one beneath it.
Below the band, the warm amber cytoplasm glows, with the silhouette of the nucleus far away: **the destination is always
in view, under your feet.**

- **Sky (zones A–C):** extracellular fluid, called "the Tide": pale aqua to cream, with drifting solute motes and
  sun-caustics.
- **Big architecture:** transport proteins drawn as the bible's "ancient tech", with cream stone bodies, gold trim,
  navy inlay bands, concentric rings, and gates *set into the ground band* that span the bilayer from above to below.
- **Zone D (after e10):** the player is inside. The camera now shows the membrane as a luminous **ceiling** band at the top
  of the frame (`layer.ceiling_band`, y 0), and the sky becomes the **cytoplasm sky** (coral-amber), with organelles as
  distant domes and cliffs.

**Vertical composition** (coordinates are per zone, y down from the zone's top, 1 unit = 1 px of a 1080-px view;
20 §1.3):

| Band | Zone A | Zones B, C | Zone D |
|---|---|---|---|
| Walk line (top of the heads) | **y 983** | **y 1213** | **y 1113** (causeway top) |
| Bilayer band (outer heads 44 · outer tails 56 · oil seam 8 · inner tails 56 · inner heads 44 = 208) | 983 – 1191 | 1213 – 1421 | ceiling band 0 – 208 |
| Cytoplasm glimpse (`layer.cyto_glimpse`, 160 tall) | 1190 – 1350 | 1420 – 1580 | — |
| Raised surfaces | e2 terrace 813, root ledge 833, stud ledge 643 | raft ledge 873, garden alcove 1043, trench floor 1468; `pump_deck` and `pit_ledge` 873 | P1: `high_rail` 773, gulf floor 1480 |

The protagonist's height **1 H ≈ 170** (20 §1.3; the rig renders at 16 % of the view), about 4 lipid heads tall. Scale
ladder (bible §5.1): console 0.7 H, pod 1.1 H, Crossing Gate 2.2 H, Carrier Door 2.4 H, Na⁺/K⁺ pump 3.5 H, Gatekeeper
6 H, Nuclear Pore 5.5 H (it bleeds off the top of the frame).

**Scientific stylization notes** (these go on the credits/lore screen so teachers aren't surprised):
- Lipid heads are drawn about 4× larger relative to the protagonist than true scale.
- **Cholesterol** is drawn as teal crystal studs among the heads. Real cholesterol is not crystalline in membranes; the
  shape is stylized, but its position (wedged between lipids) is right.
- The Gatekeeper is a fictional pump. Real nuclear pores are different gates, and Ora says so in line `s7_walk3`.

### 2.2 Palette: the bible palette adapted to the cell

The UI palette is the bible's §2.3, **unchanged** (`UI_TOKENS`). The world tokens below re-map the bible's §2.1 to
biology and live in **`src/game/art/palettes/living_gate.ts`** (owned by C0, then C2; 20 §7.3). Token paths are the names
in the first column (`{{lipid.head.lit}}` in SVG source). The rule holds: there is no pure black. The darkest world colours are the Pump Hall ceiling `#3E3240` and the seam
shadow `#22385A`; both sit at the same relative luminance as 20 §5.3's floor `#2B3A44` (≈ 0.04). If the art lint
compares luminance strictly, lift them to `#433748` and `#27405F`. Orange never appears on a world surface except on bound values.

| Token | Hex | Bible source | Used for |
|---|---|---|---|
| `lipid.head.lit` | `#FBF1DE` | stone.lit | lit upper-left of each head |
| `lipid.head` | `#F2E3C6` | stone.base | head body |
| `lipid.head.shade` | `#D9C3A0` | stone.shade | head underside, contact shade |
| `lipid.tail.hi` | `#F6D27A` | gold.hi | tail highlight stripe |
| `lipid.tail` | `#D9A441` | gold.base | tail body |
| `lipid.tail.deep` | `#A8782E` | gold.deep | tail shadow side |
| `oil.seam` | `#27466A` | inlay.navy | the hydrophobic midline, inlay bands on proteins |
| `oil.seam.dark` | `#22385A` | inlay.navy.dark, lifted | seam shadow (lifted from the bible's `#1B3150`) |
| `protein.stone` | `#F2E3C6` / `#D9C3A0` | stone | transport-protein bodies |
| `protein.ring` | `#6E4A2E` | bronze.ring | pore rings, node rings, sockets |
| `gel.frost` | `#DCE8EA` | new | frozen (gel-phase) heads, desaturated plus a frost rim |
| `glycan.blue` / hi | `#5A95D6` / `#8CC0EE` | foliage.blue | sugar-chain trees (glycocalyx) |
| `glycan.salmon` / hi | `#E48C5E` / `#F4AE80` | foliage.salmon | sugar-chain trees, warm variety |
| `glycan.rust` | `#C4643C` | foliage.rust | bead tufts |
| `cholesterol` hi/base/shade | `#C9F3FF` / `#6ED2F2` / `#2E8FC0` | crystal.* | cholesterol studs among the heads |
| `tide.shallow` | `#8FE0EA` | water.shallow | basin water highlights |
| `tide.deep` | `#4CB6D0` | water.deep | basin water body |
| `cyto.glow` | `#F6C48E` | new | cytoplasm glimpse under the band |
| `cyto.deep` | `#D98A6A` | new | cytoplasm shadow, organelle silhouettes |
| `mito.coral` | `#E7836F` | new | mitochondria domes (zone D) |
| `atp.gold` | `#F6D27A` core `#FFF6D8` | gold.hi | ATP sparks, energy cards, lit gold rails |
| `wisp.indigo` | `#6A6CF0` | wisp.indigo | insight shards (collectibles only) |

**Molecule colours** (fixed across the world and the panel tokens, so a glyph is recognisable everywhere):

| Molecule | Colour | Glyph | Glyph id (`ItemMeta.glyph`) |
|---|---|---|---|
| O₂ | `#8CC0EE` sky blue | two fused circles | `o2` |
| CO₂ | `#A9C3BF` grey-teal | three fused circles, dark centre | `co2` |
| Na⁺ | `#EE8A9A` coral pink | sphere with a white "+" | `na` |
| K⁺ | `#9C82E0` violet | larger sphere with a white "+" | `k` |
| Cl⁻ | `#7FD6B0` mint | sphere with a white "−" | `cl` |
| H⁺ (proton) | `#F7F0A0` pale yellow | tiny sphere with a "+" | `h` |
| Glucose | `#F6E3B4` cream, `#D9A441` outline | hexagon ring with a tail bead | `glucose` |
| Steroid hormone | `#E6B85C` amber | four fused rings (3 hexagons and a pentagon) | `steroid` |
| Water | `#4F92E6` (= `fn.h` blue) | teardrop droplet | `water` |
| Dye | `#D46BA8` magenta-rose | soft dot | (e3 sim particle) |
| Salt | `#FFFFFF` @ 85 % | small cube, lit top face | (e4 sim particle) |
| ATP | `#F6D27A` with a white core | four-point spark | (`fx.atp_spark`) |

> **Deviation from bible §7.2, recorded on purpose.** The bible puts the ATP gauge in `ui.accent` orange. Orange is
> reserved for player input (bible §2.3 rules), and ATP is spent by the machine, not chosen by the player. So ATP is
> **gold** everywhere: in the world (gold rails glow when ATP flows) and in the panel (the `energy_cells` card is gold).
> That also gives "ancient tech gold trim" a meaning in this biome: **gold is energy.**

### 2.3 Parallax layers (per zone)

Scroll factors follow bible §5.2 and 20 §2.3 (L1 0.15, L2 0.35, L3 0.6, L5 1.3, L6 1.0). Every tiling layer is a kit
strip 2048 wide with seamless edges (02 §3c). The exact `LayerSet` entries are in each zone's JSON (§2.5.3).

| Layer (depth) | Factor | Zone A: Shore (S1–S2) | Zone B: Tide Basins (S3–S4) | Zone C: Pump Hall (S5–S6) | Zone D: Cytoplasm (S7–S8) |
|---|---|---|---|---|---|
| **Sky** (segment `sky`, code gradient) + swirl strip (`L1_far` 0.05) | 0 / 0.05 | 4-stop gradient `#CFE9EC` → `#DCEFEA` → `#EAF2E6` → `#F4EEDF`, soft lighter cloud bands of fluid swirl at 8 % white | `#BFE3E6` → `#D7EBE2` → `#EFE3D0` → `#F2D9C2` (afternoon peach haze) | S5 interior: vault ceiling gradient `#3E3240` → `#5A4146` → `#7A5646`, gold light pooling from below. S6 exterior pit-dusk: `#A9C9D6` → `#C7C6D4` → `#E6C9C2` → `#F2D2B8` | S7 cytoplasm: `#E9A98E` → `#F0BC98` → `#F3C7A2` → `#FAE3C2`. S8 nuclear vault: `#7E6AB8` → `#A488D0` → `#C9A0DE` → `#F2B8D4` |
| **L1 far** | 0.15 | **Tissue horizon**: neighbouring cells as huge pale rounded domes (`#B9D6D3` at 60 % haze toward sky), with collagen **fibre cables** crossing the sky as thin white-cyan lines (the Variant beam lines, frame 6) | **Tide cliffs**: rounded stacked-dome cliffs `#A9CFCB`, glycan groves as blurred blobs, collagen cables | Interior: a great **ribbed vault wall** with three ring windows (concentric bronze rings, glass `#F6C48E` glow) | **Organelle skyline**: nucleus dome (right, huge, `#C98BB0` with ring pores), a stacked Golgi of curved cream plates, capsule mitochondria (`mito.coral`) with navy cristae stripes, and ER ribbon cliffs |
| **L2 mid-far** | 0.35 | **Glycan forest** silhouettes: sugar-chain trees (a trunk of stacked beads, branching into hexagon-bead crowns) in `glycan.blue` and `glycan.salmon`, two-tone lit/shade, 20 % haze | **Dormant channel towers**: ruined protein towers, desaturated, with dark ring tops | Hall pillars (cream, navy capitals) and the far **Nerve Beacon** tower (a stylized neuron: a star-shaped soma with a long axon cable; a P1 prop) | **Cytoskeleton arches**: microtubule aqueducts (cream tubes with navy ring bands) arching across |
| **L3 mid** | 0.6 | **Colonnade Rise**: the membrane swelling into a hill (the bilayer band curving up), **cholesterol studs** (teal crystal wedges) poking up between the heads, glycan saplings | Basin walls (cream stone, gold rims), waterfalls of tide water (composed into the strip) | Gold ATP rails, pipes and gauge-dials on the hall walls | Vesicle traffic (small bubbles drifting along rails), a ribosome cluster (bead pairs); the membrane **ceiling band** at scroll 1.0 |
| **L4 play** | 1.0 | ground: the bilayer road (a Rope along the heightfield, `ground.bilayer`); contraptions; consoles; NPCs; player | same + basins / sluice trench | hall floor; the `pump_deck` mezzanine (`ground.hall_deck`) | microtubule causeway (`ground.causeway`) |
| **L5 fore** | 1.3 | glycan fronds and floating sugar beads, 2 px blur, 70 % alpha, darker `#4F8F85` | bubbles strip, reed-like glycan fronds | hall balustrade (cream posts, navy rail cap, round emblem post) | fine actin filaments (thin salmon lines), drifting vesicles |
| **L6 light** | 1.0 | water **caustics** overlay (add 12 %), slow drift. **God rays** from the upper left | caustics, warmer | gold **lantern pools** (additive radial) that turn on as the hall re-powers | warm motes; the finish-stack vignette tinted by `ambient.grade` |
| Keys | | `swirl_shore`, `tissue_far`, `glycan_forest`, `cyto_glimpse`, `colonnade_rise`, `glycan_fronds`, `caustics`, `godrays` | `swirl_basins`, `tide_cliffs`, `dormant_towers`, `cyto_glimpse`, `basin_walls`, `bubbles`, `caustics` | `hall_ribs`, `hall_vault`, `hall_pillars`, `hall_rails`, `hall_balustrade` · `swirl_pit`, `tide_cliffs_dusk`, `dormant_towers`, `pit_rim`, `glycan_fronds` | `swirl_cytoplasm`, `organelles`, `nucleus_dome`, `cytoskeleton`, `ceiling_band`, `actin` · `vault_glints`, `envelope`, `vault_court` |

All keys are `living_gate.layer.<name>` (§7).

### 2.4 Time of day, weather, particles, ambient motion

- **Time of day** = **tide-light**, a progression of colour temperature (bible §5.3), carried by each segment's
  `ambient.light`: Shore `aqua` (bright morning), Basins `peach` (afternoon), the Pump Hall `interior` (lantern-lit), the
  Pit `dusk`, the Cytoplasm `amber`, and the Nuclear Vault `dusk` with a violet grade (`ambient.grade.hue −6`). The
  colour shift is the progress bar you feel.
- **Weather** = currents: `Segment.weather: "current"` in zones A–C. Every 20–40 s a soft **tide current** passes: L5
  fronds lean +6° for 2 s, motes streak, and glycan trees sway ±3°. Inside (zone D) the weather is `"streaming"`:
  cytoplasmic streaming, a slow conveyor drift of motes along the rails.
- **The ambient particle system *is* the Gradient meter.** `story.meter.drives` includes `ambient_particles`, so the host
  scales mote count and alpha by `G = value / 100` (20 §2.6). The biome's `motes` preset splits them:
  - motes above the ground: Na⁺ `n = round(30·(1 + 0.8·G))`, K⁺ `round(30·(1 − 0.8·G))`;
  - motes in the cytoplasm glimpse: the same counts with Na⁺ and K⁺ swapped;
  - mote random-walk step σ = `1.2 + 1.8·G` px/frame, alpha `0.35 + 0.5·G`.
  `particleCount: 120` is the cap at G = 1 (20 §2.11). At the start (G = 0.12) the two sides look almost the same and
  the motes are dim and sluggish. At the end they are crowded, bright and restless.
- **Ambient motion** (always on, cheap): lipid heads jitter ±1.5 px at 2 Hz with per-head phase, which is the membrane's
  fluidity made visible (except on the Stiff Ridge, which is dead still). Pip bobs (`bobPx: 6`). Dormant gates don't
  move. Restored gates idle-rotate their rings at 4°/s. Conduits (P1) pulse (alpha 0.6 → 1.0 at 0.8 Hz), with a light
  packet running along them every 3 s toward the Nuclear Pore.
- **Dormancy.** Every unsolved contraption is desaturated −40 % by the runtime ColorMatrix (20 §5.7) with no glow.
  Solving it re-saturates it over 600 ms. That is bible checklist item 6.

#### 2.4.1 Performance plan (amendment 30; enforced by the E3 fps capture, 20 §7.2)

| Hot spot | Plan | Budget |
|---|---|---|
| Lipid heads across 29 200 units of membrane (about 650 heads, 1 300 tails) | The bilayer is a **static tiled strip** (`ground.bilayer`, kit `bilayerTile`) drawn as the ground Rope. The jitter is a **pooled window of 60 `ground.head` sprites** laid over the strip's head slots within ±900 units of the camera centre (`fx/pooled-strip.ts`), re-bound to tile slots as the camera moves | 60 sprites |
| Fluid parting, gel frost | only the e1 prefab: 24 head sprites + 24 `ground.tailpair` sprites in the 400-unit probe well; the Stiff Ridge is one hero sprite (dead still) | 49 objects, zone A only |
| Motes | one emitter per zone, count from the meter, ≤ 120 | 1 emitter |
| e3 dye tank | the `diffusion_tank` sim holds ≤ 100 particle positions (measurable state: counts, flux, tracer path); the prefab draws them as one pooled batch of `fx.mol_dye` | ≤ 100 sprites, only while the e3 panel is open or its pose is live |
| e4 salt cubes, e7 motes | pooled, ≤ 80 and ≤ 64; stepped only while that station is open | — |
| Draw objects per zone | layers 5–8 + ground + ≤ 4 stations × ≤ 20 parts + actors + pools | ≤ 150 (20 §2.11) |
| Sims | only the open station's sim steps (`fixedDt` 1/30, ≤ 4 steps a frame) | ≤ 1.5 ms per frame |

### 2.5 Zones and scenes

#### 2.5.1 Coordinate conversion (from revision 1's cumulative strip)

Revision 1 laid the eight scenes on one strip, x 0 – 29 200, walk line y 713. Revision 2 uses four zones (20 §4.1):

| Zone | Scenes | Width × height | x (zone) | y (zone) | Segments | Enters by | Leaves by |
|---|---|---|---|---|---|---|---|
| `zone_a` Glycocalyx Shore | S1, S2 | 7400 × 1350 | `x_doc` | `y_doc + 270` (walk line 713 → 983) | `shore_morning` [0, 7400] | intro | exit `a_to_b` at x 7390 → `zone_b` x 60, `walk`, requires e2 |
| `zone_b` Tide Basins | S3, S4 | 8400 × 1600 | `x_doc − 7400` | `y_doc + 500` (→ 1213) | `basins_afternoon` [0, 8400] | exit `a_to_b` | the e6 carry (`e6_carry` → `zone_c` x 300) |
| `zone_c` Pump Hall | S5, S6 | 7800 × 1600 | `x_doc − 15800` | `y_doc + 500` (→ 1213) | `hall_interior` [0, 4200] (`interior`), `pit_dusk` [4200, 7800] | the e6 carry | the e10 carry (`e10_vesicle` → `zone_d` x 300, down 4 H) |
| `zone_d` Cytoplasm | S7, S8 | 5600 × 1500 | `x_doc − 23600` | `y_doc + 400` (→ 1113) | `vault_road_amber` [0, 2600], `vault_violet` [2600, 5600] | the e10 carry | the finale |

#### 2.5.2 Stations at a glance (per-zone coordinates)

| Enc | Zone | consoleX (surface) | anchor | Blocker x | Doc x (rev. 1) |
|---|---|---|---|---|---|
| e1_bilayer | a | 4300 (ground) | (4500, 983) | 4600 (the Stiff Ridge) | 4300 |
| e2_selectivity | a | 6300 (ground) | (6700, 983) | 6640 (the gate arch) | 6300 |
| e3_diffusion | b | 1100 (ground) | (1500, 1213) | 1900 (the boom) | 8500 |
| e4_osmosis | b | 3100 (ground) | (3500, 1213) | — (the raft-lock cliff at 3884 is a sheer rise) | 10500 |
| e5_tonicity | b | 5200 (ground) | (5600, 1213) | 5400 (the flooded trench) | 12600 |
| e6_facilitated | b | 7500 (ground) | (7900, 1213) | 7800 (the Carrier Door) | 14900 |
| e7_active | c | 900 (ground) | (1400, 1213) | — (the deck is reachable only by the gantry) | 16700 |
| e8_pump | c | 2900 (`pump_deck`) | (3300, 873) | 4020 (the Hall Gate, on the floor) | 18700 |
| e9_osmosis_review | c | 5000 (ground) | (5300, 1213) | — (`pit_ledge` is reachable only by the barge) | 20800 |
| e10_bulk | c | 7100 (`pit_ledge`) | (7300, 873) | — (the zone ends; the vesicle carries you out) | 22900 |
| e11_boss | d | 3800 (ground) | (4200, 1113) | 4450 (the Gatekeeper) | 27400 |

`(zoneIndex, consoleX)` strictly increases in encounter order (R4). Every blocker lies between its console and the next
console in the zone (R6).

#### 2.5.3 Zone JSON (paste into `world.zones`, in this order)

`"camera": {}` fills the 20 §1.3 defaults. Links marked P1 in §2.6 are **omitted** here; §2.6 lists them for Q1.

**`zone_a`** (P0 complete):

```json
{
  "id": "zone_a",
  "name": "Glycocalyx Shore",
  "width": 7400,
  "height": 1350,
  "layerSets": [
    {
      "id": "shore",
      "layers": [
        {"asset": "living_gate.layer.swirl_shore", "depth": "L1_far", "scrollFactor": 0.05, "y": 120, "blurPx": 0},
        {"asset": "living_gate.layer.tissue_far", "depth": "L1_far", "scrollFactor": 0.15, "y": 283},
        {"asset": "living_gate.layer.glycan_forest", "depth": "L2_midfar", "scrollFactor": 0.35, "y": 383},
        {"asset": "living_gate.layer.cyto_glimpse", "depth": "L2_midfar", "scrollFactor": 0.35, "y": 1190},
        {"asset": "living_gate.layer.colonnade_rise", "depth": "L3_mid", "scrollFactor": 0.6, "y": 463},
        {
          "asset": "living_gate.layer.glycan_fronds",
          "depth": "L5_fore",
          "scrollFactor": 1.3,
          "y": 1090,
          "alpha": 0.7,
          "blurPx": 2
        },
        {
          "asset": "living_gate.layer.caustics",
          "depth": "L6_light",
          "scrollFactor": 1.0,
          "y": 0,
          "blend": "add",
          "alpha": 0.12,
          "driftPxPerSec": 6
        },
        {
          "asset": "living_gate.layer.godrays",
          "depth": "L6_light",
          "scrollFactor": 0.2,
          "y": 0,
          "blend": "add",
          "alpha": 0.15,
          "repeatX": false
        }
      ]
    }
  ],
  "segments": [
    {
      "id": "shore_morning",
      "x0": 0,
      "x1": 7400,
      "layerSet": "shore",
      "sky": {
        "stops": [
          {"at": 0, "color": "#CFE9EC"}, {"at": 0.35, "color": "#DCEFEA"}, {"at": 0.7, "color": "#EAF2E6"},
          {"at": 1, "color": "#F4EEDF"}
        ],
        "haze": {"color": "#EAF2E6", "alpha": 0.3}
      },
      "ambient": {
        "light": "aqua",
        "particles": "motes",
        "particleCount": 120,
        "shadowColor": "#6E7F9A",
        "dapple": null,
        "grade": {"saturation": 0.05}
      },
      "weather": "current",
      "music": "curious",
      "runEnabled": true,
      "variants": []
    }
  ],
  "interiors": [],
  "ground": {
    "points": [
      [0, 983], [2140, 983], [2150, 853], [2270, 853], [2280, 983], [4560, 983], [4620, 745], [5260, 745], [5320, 983],
      [6850, 983], [6860, 813], [7400, 813]
    ],
    "surface": "living_gate.ground.bilayer",
    "underside": null,
    "maxStepUp": 102
  },
  "platforms": [
    {
      "id": "root_ledge",
      "points": [[1340, 833], [1540, 833]],
      "asset": "living_gate.prop.root_ledge",
      "requires": null
    },
    {
      "id": "stud_ledge",
      "points": [[6880, 643], [7140, 643]],
      "asset": "living_gate.prop.stud_ledge",
      "requires": null
    }
  ],
  "links": [
    {
      "kind": "hop",
      "id": "a_root_ledge",
      "from": {"surface": "ground", "x": 1290},
      "to": {"surface": "root_ledge", "x": 1380},
      "requires": null,
      "apex": 120,
      "twoWay": true
    },
    {
      "kind": "hop",
      "id": "a_root_hump",
      "from": {"surface": "ground", "x": 2120},
      "to": {"surface": "ground", "x": 2300},
      "requires": null,
      "apex": 150,
      "twoWay": true
    },
    {
      "kind": "climb",
      "id": "a_stud_climb",
      "from": {"surface": "ground", "x": 6900},
      "to": {"surface": "stud_ledge", "x": 6920},
      "requires": {"solved": "e2_selectivity"},
      "twoWay": true
    }
  ],
  "exits": [
    {
      "id": "a_to_b",
      "x": 7390,
      "surface": "ground",
      "toZoneId": "zone_b",
      "toX": 60,
      "toSurface": "ground",
      "transition": "walk",
      "requires": {"solved": "e2_selectivity"},
      "cutsceneId": null
    }
  ],
  "hub": null,
  "entry": {"x": 420, "surface": "ground"},
  "entryCutsceneId": null,
  "camera": {}
}
```

**`zone_b`** (P0; P1 adds the `garden_alcove` platform and `b_ledge_hop`, `b_garden_climb`, `b_alcove_drop` from §2.6):

```json
{
  "id": "zone_b",
  "name": "Tide Basins",
  "width": 8400,
  "height": 1600,
  "layerSets": [
    {
      "id": "basins",
      "layers": [
        {"asset": "living_gate.layer.swirl_basins", "depth": "L1_far", "scrollFactor": 0.05, "y": 140},
        {"asset": "living_gate.layer.tide_cliffs", "depth": "L1_far", "scrollFactor": 0.15, "y": 513},
        {"asset": "living_gate.layer.dormant_towers", "depth": "L2_midfar", "scrollFactor": 0.35, "y": 593},
        {"asset": "living_gate.layer.cyto_glimpse", "depth": "L2_midfar", "scrollFactor": 0.35, "y": 1420},
        {"asset": "living_gate.layer.basin_walls", "depth": "L3_mid", "scrollFactor": 0.6, "y": 713},
        {
          "asset": "living_gate.layer.bubbles",
          "depth": "L5_fore",
          "scrollFactor": 1.3,
          "y": 1300,
          "alpha": 0.7,
          "blurPx": 2
        },
        {
          "asset": "living_gate.layer.caustics",
          "depth": "L6_light",
          "scrollFactor": 1.0,
          "y": 0,
          "blend": "add",
          "alpha": 0.12,
          "driftPxPerSec": 6
        }
      ]
    }
  ],
  "segments": [
    {
      "id": "basins_afternoon",
      "x0": 0,
      "x1": 8400,
      "layerSet": "basins",
      "sky": {
        "stops": [
          {"at": 0, "color": "#BFE3E6"}, {"at": 0.35, "color": "#D7EBE2"}, {"at": 0.7, "color": "#EFE3D0"},
          {"at": 1, "color": "#F2D9C2"}
        ],
        "haze": {"color": "#EFE3D0", "alpha": 0.3}
      },
      "ambient": {
        "light": "peach",
        "particles": "motes",
        "particleCount": 120,
        "shadowColor": "#6E7F9A",
        "dapple": null,
        "grade": {}
      },
      "weather": "current",
      "music": "playful",
      "runEnabled": true,
      "variants": []
    }
  ],
  "interiors": [],
  "ground": {
    "points": [
      [0, 1213], [3880, 1213], [3884, 873], [4700, 873], [4760, 930], [4820, 987], [4880, 1043], [4940, 1100],
      [5000, 1156], [5060, 1213], [5396, 1213], [5400, 1468], [6596, 1468], [6600, 1213], [8400, 1213]
    ],
    "surface": "living_gate.ground.bilayer",
    "underside": null,
    "maxStepUp": 102
  },
  "platforms": [],
  "links": [
    {
      "kind": "drop",
      "id": "b_trench_drop",
      "from": {"surface": "ground", "x": 5390},
      "to": {"surface": "ground", "x": 5470},
      "requires": {"solved": "e5_tonicity"}
    }
  ],
  "exits": [],
  "hub": null,
  "entry": {"x": 60, "surface": "ground"},
  "entryCutsceneId": null,
  "camera": {}
}
```

**`zone_c`** (P0; P1 adds the `pipe_run` and `rail_perch` platforms and `c_pipe_hop`, `c_rail_hop`, `c_rail_drop`):

```json
{
  "id": "zone_c",
  "name": "Pump Hall",
  "width": 7800,
  "height": 1600,
  "layerSets": [
    {
      "id": "hall",
      "layers": [
        {"asset": "living_gate.layer.hall_ribs", "depth": "L1_far", "scrollFactor": 0.05, "y": 0},
        {"asset": "living_gate.layer.hall_vault", "depth": "L1_far", "scrollFactor": 0.15, "y": 453},
        {"asset": "living_gate.layer.hall_pillars", "depth": "L2_midfar", "scrollFactor": 0.35, "y": 413},
        {"asset": "living_gate.layer.hall_rails", "depth": "L3_mid", "scrollFactor": 0.6, "y": 613},
        {
          "asset": "living_gate.layer.hall_balustrade",
          "depth": "L5_fore",
          "scrollFactor": 1.3,
          "y": 1380,
          "alpha": 0.7,
          "blurPx": 2
        }
      ]
    },
    {
      "id": "pit",
      "layers": [
        {"asset": "living_gate.layer.swirl_pit", "depth": "L1_far", "scrollFactor": 0.05, "y": 140},
        {"asset": "living_gate.layer.tide_cliffs_dusk", "depth": "L1_far", "scrollFactor": 0.15, "y": 513},
        {"asset": "living_gate.layer.dormant_towers", "depth": "L2_midfar", "scrollFactor": 0.35, "y": 593},
        {"asset": "living_gate.layer.pit_rim", "depth": "L3_mid", "scrollFactor": 0.6, "y": 473},
        {
          "asset": "living_gate.layer.glycan_fronds",
          "depth": "L5_fore",
          "scrollFactor": 1.3,
          "y": 1340,
          "alpha": 0.7,
          "blurPx": 2
        }
      ]
    }
  ],
  "segments": [
    {
      "id": "hall_interior",
      "x0": 0,
      "x1": 4200,
      "layerSet": "hall",
      "sky": {
        "stops": [{"at": 0, "color": "#3E3240"}, {"at": 0.5, "color": "#5A4146"}, {"at": 1, "color": "#7A5646"}],
        "haze": {"color": "#7A5646", "alpha": 0.2}
      },
      "ambient": {
        "light": "interior",
        "particles": "motes",
        "particleCount": 90,
        "shadowColor": "#6E7F9A",
        "dapple": null,
        "grade": {"brightness": -0.08}
      },
      "weather": "clear",
      "music": "tense",
      "runEnabled": true,
      "variants": []
    },
    {
      "id": "pit_dusk",
      "x0": 4200,
      "x1": 7800,
      "layerSet": "pit",
      "sky": {
        "stops": [
          {"at": 0, "color": "#A9C9D6"}, {"at": 0.35, "color": "#C7C6D4"}, {"at": 0.7, "color": "#E6C9C2"},
          {"at": 1, "color": "#F2D2B8"}
        ],
        "haze": {"color": "#E6C9C2", "alpha": 0.3}
      },
      "ambient": {
        "light": "dusk",
        "particles": "motes",
        "particleCount": 120,
        "shadowColor": "#6E7F9A",
        "dapple": null,
        "grade": {}
      },
      "weather": "current",
      "music": "calm",
      "runEnabled": true,
      "variants": []
    }
  ],
  "interiors": [],
  "ground": {
    "points": [[0, 1213], [7800, 1213]],
    "surface": "living_gate.ground.bilayer",
    "underside": null,
    "maxStepUp": 102
  },
  "platforms": [
    {
      "id": "pump_deck",
      "points": [[1750, 873], [3960, 873]],
      "asset": "living_gate.ground.hall_deck",
      "requires": null
    },
    {
      "id": "pit_ledge",
      "points": [[5480, 873], [7800, 873]],
      "asset": "living_gate.prop.pit_terrace",
      "requires": null
    }
  ],
  "links": [
    {
      "kind": "ladder",
      "id": "c_deck_ladder",
      "from": {"surface": "pump_deck", "x": 3940},
      "to": {"surface": "ground", "x": 3950},
      "requires": {"solved": "e8_pump"},
      "asset": "living_gate.prop.deck_ladder",
      "twoWay": true
    }
  ],
  "exits": [],
  "hub": null,
  "entry": {"x": 300, "surface": "ground"},
  "entryCutsceneId": null,
  "camera": {}
}
```

**`zone_d`** (P0: a flat causeway; P1 swaps in the gulf profile of §2.6):

```json
{
  "id": "zone_d",
  "name": "Cytoplasm",
  "width": 5600,
  "height": 1500,
  "layerSets": [
    {
      "id": "vault_road",
      "layers": [
        {"asset": "living_gate.layer.swirl_cytoplasm", "depth": "L1_far", "scrollFactor": 0.05, "y": 120},
        {"asset": "living_gate.layer.organelles", "depth": "L1_far", "scrollFactor": 0.15, "y": 353},
        {
          "asset": "living_gate.layer.nucleus_dome",
          "depth": "L1_far",
          "scrollFactor": 0.15,
          "y": 213,
          "repeatX": false
        },
        {"asset": "living_gate.layer.cytoskeleton", "depth": "L2_midfar", "scrollFactor": 0.35, "y": 413},
        {"asset": "living_gate.layer.ceiling_band", "depth": "L3_mid", "scrollFactor": 1.0, "y": 0},
        {
          "asset": "living_gate.layer.actin",
          "depth": "L5_fore",
          "scrollFactor": 1.3,
          "y": 1200,
          "alpha": 0.6,
          "blurPx": 2
        }
      ]
    },
    {
      "id": "vault",
      "layers": [
        {"asset": "living_gate.layer.vault_glints", "depth": "L1_far", "scrollFactor": 0.05, "y": 0},
        {"asset": "living_gate.layer.envelope", "depth": "L1_far", "scrollFactor": 0.15, "y": 213},
        {
          "asset": "living_gate.layer.nucleus_dome",
          "depth": "L1_far",
          "scrollFactor": 0.15,
          "y": 213,
          "repeatX": false
        },
        {"asset": "living_gate.layer.vault_court", "depth": "L3_mid", "scrollFactor": 0.6, "y": 513},
        {"asset": "living_gate.layer.ceiling_band", "depth": "L3_mid", "scrollFactor": 1.0, "y": 0},
        {
          "asset": "living_gate.layer.actin",
          "depth": "L5_fore",
          "scrollFactor": 1.3,
          "y": 1200,
          "alpha": 0.6,
          "blurPx": 2
        }
      ]
    }
  ],
  "segments": [
    {
      "id": "vault_road_amber",
      "x0": 0,
      "x1": 2600,
      "layerSet": "vault_road",
      "sky": {
        "stops": [
          {"at": 0, "color": "#E9A98E"}, {"at": 0.35, "color": "#F0BC98"}, {"at": 0.7, "color": "#F3C7A2"},
          {"at": 1, "color": "#FAE3C2"}
        ],
        "haze": {"color": "#F3C7A2", "alpha": 0.3}
      },
      "ambient": {
        "light": "amber",
        "particles": "motes",
        "particleCount": 120,
        "shadowColor": "#6E7F9A",
        "dapple": null,
        "grade": {"hue": 4}
      },
      "weather": "streaming",
      "music": "calm",
      "runEnabled": true,
      "variants": []
    },
    {
      "id": "vault_violet",
      "x0": 2600,
      "x1": 5600,
      "layerSet": "vault",
      "sky": {
        "stops": [
          {"at": 0, "color": "#7E6AB8"}, {"at": 0.35, "color": "#A488D0"}, {"at": 0.7, "color": "#C9A0DE"},
          {"at": 1, "color": "#F2B8D4"}
        ],
        "haze": {"color": "#C9A0DE", "alpha": 0.25}
      },
      "ambient": {
        "light": "dusk",
        "particles": "motes",
        "particleCount": 120,
        "shadowColor": "#6E7F9A",
        "dapple": null,
        "grade": {"saturation": 0.05, "hue": -6}
      },
      "weather": "streaming",
      "music": "tense",
      "runEnabled": true,
      "variants": []
    }
  ],
  "interiors": [],
  "ground": {
    "points": [[0, 1113], [5600, 1113]],
    "surface": "living_gate.ground.causeway",
    "underside": null,
    "maxStepUp": 102
  },
  "platforms": [],
  "links": [],
  "exits": [],
  "hub": {
    "asset": "living_gate.prop.nuclear_pore",
    "x": 4900,
    "y": null,
    "depth": "L4_back",
    "label": "Nuclear Pore",
    "sockets": 11,
    "restoredLine": {
      "speakerId": "pilot",
      "text": "The pore's turning! Every conduit you lit is pouring into it.",
      "mood": "excited"
    }
  },
  "entry": {"x": 300, "surface": "ground"},
  "entryCutsceneId": null,
  "camera": {}
}
```

#### 2.5.4 P0 props

Dressing props (cholesterol studs, glycan saplings, plaque posts, basin plaques, gauge dials) are scattered by C2 from
the kit entries in §7 outside every station's footprint and frame bounds (W3). The props the story depends on (pivots follow 02 §3.0: `sluice_steps` is a `stairs` strip placed by its bottom-left corner; the pore's
inner ring and plug are rotating parts placed by their centre at y 633):

```json
[
  {
    "id": "halcyon",
    "zoneId": "zone_a",
    "asset": "living_gate.part.endocytosis_lift_halcyon",
    "x": 300,
    "layer": "L4_back"
  },
  {
    "id": "seal_a",
    "zoneId": "zone_a",
    "asset": "living_gate.prop.seal_node",
    "x": 2900,
    "layer": "L4_back",
    "restoredBy": "e2_selectivity"
  },
  {"id": null, "zoneId": "zone_b", "asset": "living_gate.npc.poro", "x": 5080, "layer": "L4_play"},
  {
    "id": "sluice_steps",
    "zoneId": "zone_b",
    "asset": "living_gate.prop.sluice_steps",
    "x": 6360,
    "y": 1468,
    "layer": "L4_play",
    "states": [{"state": "hidden", "asset": null}, {"state": "revealed", "asset": null}]
  },
  {"id": null, "zoneId": "zone_b", "asset": "living_gate.prop.hall_facade", "x": 8000, "layer": "L4_back"},
  {"id": null, "zoneId": "zone_d", "asset": "living_gate.prop.pore_inner", "x": 4900, "y": 633, "layer": "L4_back"},
  {"id": null, "zoneId": "zone_d", "asset": "living_gate.prop.pore_plug", "x": 4900, "y": 633, "layer": "L4_back"}
]
```

#### 2.5.5 The eight scenes

**Every contraption physically blocks the path until solved** (map D7): a blocker, a sheer edge, or a surface reachable
only through its payoff.

##### S1 · Glycocalyx Shore (intro, `zone_a` x 0 – 3200)
- **What the player sees.** The *Halcyon* (a brass-and-cream teardrop submarine with a round porthole, 2.2 H long) sits
  docked on a mooring of sugar-chain roots at x 300. The ground is the bilayer road. **Glycan trees** (2–4 H, blue and
  salmon, their crowns made of hexagon sugar beads) line the path. Far off to the right, the **Colonnade Rise** swells up.
  Beneath the ground, the cytoplasm glows, and the nucleus silhouette sits on the far lower right (in `cyto_glimpse`).
  Three **dark conduits** run along the seam line toward it. Motes drift dimly.
- **Traversal.** A small glycan-root ledge (`root_ledge`, y 833) at x 1340–1540 holds lore plaque **P1 "The Two Faces"**
  (hop `a_root_ledge`). A knee-high **root hump** at x 2150–2270 (130 units: above `maxStepUp`) crosses the road; the
  player must hop it (`a_root_hump`), the zone's hop tutorial.
- **Contraptions.** None. There is one dormant **seal node** at x 2900 (a bronze ring with a grey glass core). At P1 it is
  a `touch` prop that lights after e2; at P2 E on it opens the **Cell Chart** (§6.4).
- **NPCs.** Ora, on comms and in the dialogue bar. Pip detaches from the sub in the intro (§4.2).
- **Exit.** The path runs on to S2.

##### S2 · The Colonnade Rise (`zone_a` x 3200 – 7400)
- **What the player sees.** The bilayer road rises into a hill (the L3 `colonnade_rise`), with cholesterol studs
  glinting teal between the heads. At x 4600 the road is blocked by the **Stiff Ridge**, a 1.4 H hump of membrane frozen
  into a hex-packed, frosted, dead-still block (`gel.frost`, no jitter; ground 983 → 745 over x 4560–5320). Beside it,
  three **Specimen Pods** stand on pedestals with the console (x 4300). Past the ridge is the **Crossing Yard**. There,
  the **Crossing Gate** (a channel protein, its arch 2.2 H above ground and its ring body continuing down through the
  bilayer band) spans the path at x 6700. The **Oil Road**, a patch of bare heads ringed by a navy inlay circle, sits to
  its left. Molecules drift above in the tide.
- **Contraptions.** e1 **Specimen Pods at the Stiff Ridge** (§5.1), then e2 **Membrane Router at the Crossing Gate**
  (§5.2).
- **NPCs (P1).** **Sucra** (glucose courier) is at the Crossing Yard (x 6000), knocking on the heads. After e2 she rides
  the Crossing Gate and waits on the terrace; she reappears in S4.
- **Side content.** Lore plaque **P2 "Why Oil Says No"** hides behind the Crossing Gate, on the cholesterol-stud ledge
  (`stud_ledge`, y 643), reached by `a_stud_climb` from the terrace, which only exists after the carrier-ramp payoff.
- **Exit.** The carrier-rocker ramp climbs to the upper terrace (y 813, +1 H), and exit `a_to_b` at x 7390 leads into
  zone B.

##### S3 · The Dye Flats (`zone_b` x 0 – 4400)
- **What the player sees.** Flat basin country. At x 1500 the **Dye Tank**, a long glass tank (4.5 H × 1.8 H) split by a
  membrane window, sits in a basin. The **Balance Lock**, a gold beam on a cream pillar, is chained to floats in each
  chamber and lies across the path like a boom barrier (blocker x 1900). Past it is the **Osmometer Basin** (x 3500): a
  glass basin holding the round **Test Cell** in a salt bath, next to the dry **Raft Lock** shaft (3 H tall) at x 3780,
  with a raft at its floor. The shaft's far wall is a sheer 2 H cliff (x 3884); the **raft ledge** (ground, y 873) runs
  from there to x 4700 and descends by a carved basin stair (x 4700–5060, six 57-unit steps) back to the road.
- **Contraptions.** e3 **Specimen Pods + Dye Tank / Balance Lock** (§5.3), then e4 **Specimen Pods + Osmometer Basin /
  Raft Lock** (§5.4).
- **NPCs.** None. This is the "science bench" zone, and Ora is at her most talkative here.
- **Side content (P1).** Lore plaque **P3 "The Jittering Grains"** sits on the raft ledge (x 4300); `b_ledge_hop` lets
  the player hop back down to the Dye Flats.

##### S4 · The Tonicity Sluices & Threshold Yard (`zone_b` x 4400 – 8400)
- **What the player sees.** The road meets a **flooded sluice trench** (x 5400–6600, 1.5 H deep: floor y 1468). A canal
  runs across the scene with one **Label Lock** (a lock chamber with a big bronze valve wheel above it) and three
  **holding basins** labelled HYPO / ISO / HYPER on cream plaques (DOM labels), plus an unlabelled **Eddy**. **Poro**,
  the aquaporin keeper (an hourglass-waisted stone statue with sleepy eye-glyphs), stands at x 5080. At the far end
  (x 7100–8400) is the **Threshold Yard**: the Pump Hall's great revolving **Carrier Door** (2.4 H, x 7900) set in the
  hall façade, flanked by the **Glide Gate** at the foot of a downhill ramp and the small gold **Pump Gate** atop an
  uphill ramp.
- **Contraptions.** e5 **Tonicity Sluices** (§5.5), then e6 **Threshold Router / Carrier Door** (§5.6).
- **NPCs.** Poro (a statue prop at P0, an NPC with lore at P1). Sucra (P1) returns at the Threshold Yard and rides the
  Carrier Door with the player.
- **Side content.** The **secret: the Plant Cell Garden** (§6.5, P1). When the trench drains, a narrow side stair
  appears on the trench's far wall; it climbs from the Threshold road (x 6660) to a hidden alcove behind a glycan curtain
  (`garden_alcove`, y 1043, x 6640–6900).
- **Exit.** The Carrier Door turns and carries the player into S5 (`e6_carry`).

##### S5 · The Pump Hall (`zone_c` x 0 – 4200, interior)
- **What the player sees.** A long vaulted interior inside a giant protein complex. It is dark except for dormant gold
  rails, with ribbed walls, ring windows, and the far **Nerve Beacon** visible through the windows. The **Uphill Flume**
  (e7) sits on the floor at x 1400: a **Low Tank** on the left and a **High Tank** on the right, 1.2 H higher, with a
  pump between them and a leak channel. Twelve dark **ATP lanterns** line the walls, and a **gantry lift** waits on gold
  rails at x 1840. On the **pump deck** (a mezzanine platform, y 873, x 1750–3960) stands the **Na⁺/K⁺ pump**, 3.5 H
  tall, spanning the deck floor (anchor x 3300). Its cable sockets have been pulled, and its crank is chained to the
  **Hall Gate** on the floor below (x 4020). A ladder (`c_deck_ladder`, x 3940) drops from the deck's end once the gate
  is up.
- **Contraptions.** e7 **Specimen Pods + Uphill Flume** (§5.7), then e8 **Pump Rewiring** (§5.8).
- **NPCs (P1).** **Kay**, the K⁺ lamplighter, with the lantern quest (§6.3).
- **Side content (P1).** Three hidden dark lanterns (Kay's quest). Lore plaque **P4 "The Lopsided Engine"** on the pump
  deck appears after e8.
- **Exit.** Down the ladder and under the lifted Hall Gate, out to S6.

##### S6 · The Return Sluice & Endocytosis Pit (`zone_c` x 4200 – 7800, exterior dusk)
- **What the player sees.** Back outside at dusk: the sky is pink-grey and the conduits glow brighter against it. There
  is a low canal quay (ground, y 1213) with the **Barge Lock** and the second **Label Lock** (x 5300). Above it, on a
  membrane terrace on pylons (`pit_ledge`, y 873, x 5480–7800), sits the **Endocytosis Pit** (x 7300): a shallow dimple in
  the membrane ringed by a lattice of cream-and-gold **clathrin triskelions**, with a gold **dynamin collar** hanging
  above it from a cream gantry. The *Halcyon* descends from the sky and settles into the pit. The **Clathrin Ferryman**
  (P1) stands at the Lift's frame (x 6900).
- **Contraptions.** e9 **Return Sluice** (§5.9), then e10 **Endocytosis Lift** (§5.10).
- **Side content (P1).** Lore plaque **P5 "Doors Made of Door"** stands at the pit rim (x 6700).
- **Exit.** **The vesicle carries the player down through the membrane into the cell** (`e10_vesicle`: the camera
  descends 4 H and the sky crossfades to the cytoplasm sky).

##### S7 · The Vault Road (`zone_d` x 0 – 2600)
- **What the player sees.** Inside the cell. The membrane is now a luminous ceiling band (heads pointing down), with the
  conduits the player lit shining *through* it from above. The **cytoplasm sky** is amber and coral. Mitochondria domes,
  Golgi stacks and ER cliffs sit in parallax, and the **nucleus** is huge on the right. The floor is a **microtubule
  causeway** of cream tubes with navy bands.
- **Traversal (P1).** A **gulf** in the causeway (x 1000–1800) drops to the cytoplasm below; a **vesicle car** on a
  microtubule rail carries the player up 2 H and across (`d_gulf_ride`). Past it, a microtubule strut climbs to the
  **high rail** (`high_rail`, y 773), whose far end is the **viewpoint**: the camera rises with the player and the whole
  organelle skyline fills the frame (the "wow" frame for the demo), with a trigger line and, at P2, insight shard 3. At
  P0 the causeway is continuous and flat (§2.6).
- **NPCs (P1).** Sucra waves from a passing vesicle (`sucra_4`).
- **Exit.** The Nuclear Vault courtyard.

##### S8 · The Nuclear Vault (`zone_d` x 2600 – 5600, finale)
- **What the player sees.** A cream stone courtyard under a violet sky. The **Nuclear Pore** (5.5 H, x 4900) is the hub
  gate (Variant frame 3): an eight-spoked outer ring, a counter-rotating inner ring and a central plug, with 11 conduit
  sockets around its rim, lit or dark according to the gates restored (`hub.sockets: 11`). In front of it sits **the
  Gatekeeper** (6 H, anchor x 4200), with three maws at chest height, a great eye-ring, and a gold ATP pipe running up
  his back. Cargo floats in an eddy before him. Crossing x 3000 wakes him (the arena).
- **Contraptions.** e11 **The Gatekeeper** (§5.11), then the finale (§4.2).
- **Exit.** Walk into the pore, then the EndScreen.

### 2.6 Traversal beat sheets (amendment 28)

The verbs are 20 §2.4.2's authored links. "Beyond payoffs" counts link kinds, sandboxes and quest touches other than the
station payoffs (W2). Keys are 20 §3.5's (Space hop, W climb or board, S drop); prompts come from the interact glyph.

**Zone A (P0 complete; 2 verbs beyond payoffs: hop, climb).**

| Beat | x (zone) | Surface | Verb | Link / object | Requires | P | Purpose |
|---|---|---|---|---|---|---|---|
| 1 | 420 | ground | walk | entry after the intro | — | P0 | control handed over at the *Halcyon* |
| 2 | 1290 → 1380 | ground → `root_ledge` | **hop** | `a_root_ledge` (apex 120, two-way) | — | P0 | reach plaque P1 on the root ledge |
| 3 | 2120 → 2300 | ground → ground | **hop** | `a_root_hump` (apex 150, two-way) | — | P0 | the hop tutorial: the root hump blocks walking |
| 4 | 4300 | ground | station | e1 → ridge thaws into a ramp | — | P0 | payoff (terrain, up) |
| 5 | 6300 | ground | station | e2 → rocker ramp to the terrace (y 813) | — | P0 | payoff (terrain, up) |
| 6 | 6900 → 6920 | ground (terrace) → `stud_ledge` | **climb** | `a_stud_climb` (two-way) | e2 solved | P0 | reach plaque P2 behind the gate |
| 7 | 7390 | ground | exit | `a_to_b` → zone B | e2 solved | P0 | |

**Zone B (P0: 1 verb beyond payoffs; P1: drop, hop, climb + a sandbox).**

| Beat | x (zone) | Surface | Verb | Link / object | Requires | P | Purpose |
|---|---|---|---|---|---|---|---|
| 1 | 1100 | ground | station | e3 → the boom lifts | — | P0 | payoff (remove_blocker) |
| 2 | 3100 | ground | station | e4 → **raft ride** up to the raft ledge (y 873) | — | P0 | payoff (ride, up; auto-boards after 6 s) |
| 3 | 3900 → 3620 | ground (ledge) → ground (flats) | **hop** | `b_ledge_hop` (one-way, down across the flooded lock, apex 60) | e4 solved | P1 | return to the Dye Flats; the raft can be re-ridden up |
| 4 | 4300 | ground (ledge) | read | plaque P3 | — | P1 | lore |
| 5 | 5200 | ground | station | e5 → steps emerge on the trench's far wall | — | P0 | payoff (terrain, up) |
| 6 | 5390 → 5470 | ground → ground (trench floor) | **drop** | `b_trench_drop` (one-way) | e5 solved | P0 | into the drained trench (critical path) |
| 7 | 6360 → 6600 | ground | walk | the emerged steps | e5 solved | P0 | out of the trench |
| 8 | 6660 → 6680 | ground → `garden_alcove` | **climb** | `b_garden_climb` (two-way) | e5 solved | P1 | the side stair to the secret |
| 9 | 6760 | `garden_alcove` | **sandbox** | `garden` (`plant_garden`) | e5 solved | P1 | scrub the pool's salt |
| 10 | 6890 → 6950 | `garden_alcove` → ground | **drop** | `b_alcove_drop` (one-way) | — | P1 | back to the Threshold Yard |
| 11 | 7500 | ground | station | e6 → the Carrier Door **carries** you into zone C | — | P0 | payoff (carry) |

The P1 additions to `zone_b` (append to its `platforms` / `links`):

```json
{
  "platforms": [
    {
      "id": "garden_alcove",
      "points": [[6640, 1043], [6900, 1043]],
      "asset": "living_gate.prop.garden_alcove",
      "requires": null
    }
  ],
  "links": [
    {
      "kind": "hop",
      "id": "b_ledge_hop",
      "from": {"surface": "ground", "x": 3900},
      "to": {"surface": "ground", "x": 3620},
      "requires": {"solved": "e4_osmosis"},
      "apex": 60,
      "twoWay": false
    },
    {
      "kind": "climb",
      "id": "b_garden_climb",
      "from": {"surface": "ground", "x": 6660},
      "to": {"surface": "garden_alcove", "x": 6680},
      "requires": {"solved": "e5_tonicity"},
      "twoWay": true
    },
    {
      "kind": "drop",
      "id": "b_alcove_drop",
      "from": {"surface": "garden_alcove", "x": 6890},
      "to": {"surface": "ground", "x": 6950},
      "requires": null
    }
  ]
}
```

**Zone C (P0: 1 verb beyond payoffs; P1: 3 kinds + 3 quest touches).**

| Beat | x (zone) | Surface | Verb | Link / object | Requires | P | Purpose |
|---|---|---|---|---|---|---|---|
| 1 | 300 | ground | arrive | from the Carrier Door | — | P0 | |
| 2 | 400 → 440 | ground → `pipe_run` (y 1063) | **hop** | `c_pipe_hop` (two-way) | — | P1 | lantern 1 on the pipe run behind the Low Tank (replaces rev. 1's crouch-walk) |
| 3 | 560 | `pipe_run` | **quest touch** | `lantern_1` | flag `kay_met` | P1 | Kay's Lanterns |
| 4 | 900 | ground | station | e7 → **gantry ride** up to `pump_deck` | — | P0 | payoff (ride, up) |
| 5 | 1790 → 1680 | `pump_deck` → `rail_perch` (y 723) | **hop** | `c_rail_hop` (two-way) | — | P1 | lantern 2 atop the gantry rails |
| 6 | 1640 | `rail_perch` | **quest touch** | `lantern_2` | flag `kay_met` | P1 | |
| 7 | 1570 → 1500 | `rail_perch` → ground | **drop** | `c_rail_drop` (one-way) | — | P1 | a shortcut back to the floor |
| 8 | 2900 | `pump_deck` | station | e8 → the Hall Gate lifts | — | P0 | payoff (remove_blocker) |
| 9 | 3900 | `pump_deck` | **quest touch** | `lantern_3` (deck back railing) | flag `kay_met` | P1 | |
| 10 | 3940 → 3950 | `pump_deck` → ground | **ladder** | `c_deck_ladder` (two-way) | e8 solved | P0 | down to the floor, under the gate (critical path) |
| 11 | 5000 | ground (quay) | station | e9 → **barge ride** up to `pit_ledge` | — | P0 | payoff (ride, up; auto-boards after 3 s) |
| 12 | 7100 | `pit_ledge` | station | e10 → the vesicle **carries** you down into zone D | — | P0 | payoff (carry, down) |

The P1 additions to `zone_c`:

```json
{
  "platforms": [
    {"id": "pipe_run", "points": [[420, 1063], [680, 1063]], "asset": "living_gate.prop.pipe_run", "requires": null},
    {"id": "rail_perch", "points": [[1560, 723], [1700, 723]], "asset": null, "requires": null}
  ],
  "links": [
    {
      "kind": "hop",
      "id": "c_pipe_hop",
      "from": {"surface": "ground", "x": 400},
      "to": {"surface": "pipe_run", "x": 440},
      "requires": null,
      "apex": 110,
      "twoWay": true
    },
    {
      "kind": "hop",
      "id": "c_rail_hop",
      "from": {"surface": "pump_deck", "x": 1790},
      "to": {"surface": "rail_perch", "x": 1680},
      "requires": null,
      "apex": 120,
      "twoWay": true
    },
    {
      "kind": "drop",
      "id": "c_rail_drop",
      "from": {"surface": "rail_perch", "x": 1570},
      "to": {"surface": "ground", "x": 1500},
      "requires": null
    }
  ]
}
```

**Zone D (P0: flat; P1: ride, climb, drop and the viewpoint).** The P1 delta replaces `ground`, adds `high_rail` and
three links (the gulf is a sheer fall, so the ride is the only way across):

```json
{
  "ground": {
    "points": [[0, 1113], [996, 1113], [1000, 1480], [1796, 1480], [1800, 1113], [5600, 1113]],
    "surface": "living_gate.ground.causeway",
    "underside": null,
    "maxStepUp": 102
  },
  "platforms": [
    {
      "id": "high_rail",
      "points": [[2080, 773], [2620, 773]],
      "asset": "living_gate.prop.microtubule_rail",
      "requires": null
    }
  ],
  "links": [
    {
      "kind": "ride",
      "id": "d_gulf_ride",
      "from": {"surface": "ground", "x": 940},
      "to": {"surface": "ground", "x": 1860},
      "requires": null,
      "vehicle": "living_gate.prop.rail_vesicle",
      "path": [[940, 1113], [1100, 980], [1400, 773], [1700, 980], [1860, 1113]],
      "ms": 3200,
      "twoWay": true
    },
    {
      "kind": "climb",
      "id": "d_strut_climb",
      "from": {"surface": "ground", "x": 2100},
      "to": {"surface": "high_rail", "x": 2120},
      "requires": null,
      "twoWay": true
    },
    {
      "kind": "drop",
      "id": "d_rail_drop",
      "from": {"surface": "high_rail", "x": 2610},
      "to": {"surface": "ground", "x": 2680},
      "requires": null
    }
  ]
}
```

| Beat | x (zone) | Surface | Verb | Link / object | Requires | P | Purpose |
|---|---|---|---|---|---|---|---|
| 1 | 300 | ground | arrive | from the vesicle | — | P0 | |
| 2 | 940 → 1860 | ground → ground | **ride** | `d_gulf_ride`: a vesicle car on a microtubule rail rises 2 H over the gulf (3.2 s, two-way) | — | P1 | the Vault Road crossing (replaces rev. 1's "moving rail platforms") |
| 3 | 2100 → 2120 | ground → `high_rail` | **climb** | `d_strut_climb` (two-way) | — | P1 | the viewpoint detour |
| 4 | 2500 | `high_rail` | trigger | `s7_viewpoint` (arrival, sets `saw_skyline`) | — | P1 | the skyline frame; shard 3 at x 2560 (P2) |
| 5 | 2610 → 2680 | `high_rail` → ground | **drop** | `d_rail_drop` (one-way) | — | P1 | back to the road |
| 6 | 3000 | ground | arena | `boss.arenaTriggerX` → `e11_arena` | — | P0 | the Gatekeeper wakes |
| 7 | 3800 | ground | station | e11 → the pore opens → finale | — | P0 | payoff (remove_blocker) |

The viewpoint has no scripted pan: the camera's y-follow (`yDeadzone` 260) lifts the view with the player on the high
rail, which is enough to fill the frame with L1 and L2. A scripted pan would need a `Trigger.cutsceneId`, which the
contract does not have; this document does not rely on one.

---

## 3 · Characters

### 3.1 Protagonist: the Diver
- **Who.** The *Halcyon*'s diver. The Diver is the only crew member who leaves the sub, and never speaks (the player's
  voice, speaker id `player`, is unused here). The display name is `cast.protagonist.name` "Diver". The protagonist is
  **shared across all three showcase games** (bible §6.3): one Kenney rig, re-costumed per biome.
- **Base art (20 §5.5, 02 §3b).** `shared.char.diver`: the Kenney `toon-characters` **female_adventurer** body,
  recoloured at build time from `Vector/character_femaleAdventurer.svg` by `pnpm chars:build` into an HD atlas (45
  frames, 25 used) with per-frame rig anchors. Proposed recolour (02 §3b.4): skin `#C68B5E` / `#A06E48`, hair `#3A2A24`,
  suit `stone.base` / `#E6D5B5` / `stone.shade`, trousers `inlay.navy`, boots `bronze.ring`. No `setTint`.
- **Biome costume** (hero overlays in the `costume` group, on rig anchors; `cast.protagonist.look.costume`):
  - **Bubble helmet** `living_gate.costume.diver_helmet` (anchor `head`, dy −6, rigid, front): a clear sphere, 88 px,
    fill `#C9F3FF` @ 22 %, a lit rim arc `#FFFFFF` @ 70 % at the upper left, a gold `#D9A441` neck ring 6 px, and a
    small navy `#27466A` air-valve nub on the back.
  - **Tide scarf** `living_gate.costume.diver_scarf` (anchor `back`, dx −8, dy 4, `follow: spring`, behind): an aqua
    `#4CB6D0` scarf with a `#8FE0EA` stripe, trailing 3 segments that lag behind the motion (the runtime spring chain,
    so the silhouette reads as moving, as in frame 5).
  - **Probe-staff** `living_gate.costume.probe_staff` (anchor `hand_r`, rigid, front): a 1.1 H cream staff with a gold
    ferrule and a glass bulb at its tip. The bulb glows `#6ED2F2` while a panel is open, and turns orange `#E2892C` only
    while the player is dragging the scrubber (it is literally their input).
- **Animation set** (pose names from the rig; 20 §2.2 `actors/protagonist.ts` plays them):

| Anim | Frames | Rate | Notes |
|---|---|---|---|
| idle | `idle` + a breathing tween (scaleY 1.0 ↔ 1.02, 2.4 s) | — | the scarf drifts |
| walk | `walk0`…`walk7` | 12 fps | 300 units/s (20 §2.4.1) |
| run | `run0`…`run2` | 14 fps | Shift, 460 units/s |
| hop / drop | `jump` (rising), `fall` (descending), 6 % land squash + dust puff (`fx.dust_puff`) | — | scripted arcs from the zone's `links` (20 §2.4.2); Space with no link in range plays the 0.3 H cosmetic hop |
| climb / ladder | `climb0`, `climb1` | 8 fps | `climb` and `ladder` links |
| ride | `idle` locked to the vehicle's top | — | raft, gantry, barge, vesicle, the Carrier Door, the S7 vesicle car |
| interact | `interact` → `switch0` → `switch1` | 10 fps, holds on `switch1` | at consoles; the staff bulb lights |
| talk / think | `talk`, `think` | — | when an NPC line addresses the player, or on a hint |
| celebrate | `cheer0`, `cheer1` ×2 | 8 fps | on every success, 0.8 s, then idle |
| hurt (never used) | — | — | **no damage in this game**: failure is the machine's, never the Diver's |

### 3.2 Guide: Pilot Ora (+ Pip)
- **Fixture id.** `pilot`, role "the submarine's guide", voice archetype **`cheerful_sidekick`**. `cast.guide.characterId`.
- **Look (for the intro, the outro and the portrait).** Early twenties, brown skin, a cloud of dark curls held back by a
  brass headset, round aviator goggles pushed up, and an aqua `#4CB6D0` jumpsuit with cream piping and a gold `#D9A441`
  *Halcyon* patch (a teardrop sub in a ring). Drawn as `living_gate.companion.ora_bust` (`cast.guide.portrait`) inside
  a bronze porthole frame with 8 rivets (`living_gate.ui.porthole_frame`, kit). In gameplay only her **emblem** shows.
  P1 adds the focused sibling `ora_bust_focus` (brows in, used on hints and failed Verifies).
- **Personality.** Quick, warm, nautical slang ("hull", "aye", "steady"), and a joke per scene at most. She never
  lectures longer than two lines, she believes the player can do it, and she frames escalation ("Biggest machine on
  this membrane").
- **Voice.** Sentences of 5–15 words. Instruction lines are imperative and name the world object. She **never** says
  "correct", "wrong", "question" or "answer", never asks the player a quiz question, and never names a key or a button
  (the interact glyph and the key legend do that).
- **Emblem (`cast.guide.emblem`).** `{glyph: "cell", ring: "#E8F6F8", accent: "#8FE0EA", gaps: 2}`: a dark disc and
  three concentric broken rings with a ring of 16 dots with twin tick-tails pointing inward between the outer and middle
  rings, which reads as a circular bilayer. It pulses `#8FE0EA` when she speaks (20 §2.7).
- **Pip (`cast.guide.companion`).** `living_gate.companion.pip`: a teardrop mini-sub drone, 38 px long, cream hull, gold
  ring around a round glass porthole (`#6ED2F2` glow), a tiny navy propeller (drawn by the companion actor). Offset
  `[-40, -150]`, `lagSec 0.35`, `bobPx 6`. It pulses when Ora speaks. It has two jobs:
  1. **Hint flights.** On each hint rung it flies to the station's `meta.hintTargets(rung)` anchor and circles, lands or
     hovers there (§5.0 R11). In router stations its lens cone (`fx`, ADD) reveals **hydration shells** while
     `aidTier ≥ lensTier` (1).
  2. **Scanner.** At lore plaques Pip's porthole flashes and the plaque text opens in the bar in document style.

### 3.3 The Gatekeeper (boss)
- **Fixture id.** `gatekeeper`, role "an ancient pump protein guarding the last vault", voice **`gruff_guard`**.
  `boss.speakerId` of e11.
- **Look.** A colossal pump protein, 6 H, seated on the road. The body is cream stone with navy inlay bands and gold
  phosphate studs (round gold bosses) along the shoulders. At chest height are **three maws**: the Oil Maw (left, lined
  with lipid heads), the Channel Maw (centre, a bronze selectivity ring that can spin) and the Pump Maw (right, gold
  phosphate "teeth" and an ATP intake pipe that climbs his back). He has **one great eye-ring**: concentric broken rings
  like Ora's emblem but bronze and gold, with a slowly turning pupil-ring. He is a machine, not a person or an animal.
- **Voice.** Short, heavy sentences, and "Hrrm." He is fair: he never mocks, only states.
- **Emblem (`cast.speakers[0]`).** `{glyph: "maws", ring: "#D9A441", accent: "#6E4A2E", gaps: 3}`: a bronze disc, three
  gold rings and three small notches at the bottom (the maws). When he speaks his emblem replaces Ora's in the bar.

### 3.4 Minor NPCs (4; `cast.extras`, bodies and states P1)

| NPC (extra id) | Where | Look (asset, hero puppet) | Voice | Micro-quest / lore |
|---|---|---|---|---|
| **Sucra**, glucose courier (`sucra`) | S2, S4, S5, S7 | `living_gate.npc.sucra`: a walking **hexagon ring** (cream `#F6E3B4`, gold outline) on two short legs, carrying a satchel with a tag; 0.6 H | `nervous_scholar` (polite, fussy, over-precise) | **Escort.** She can't cross the bilayer ("they simply will not let a glucose through"). After e2 she rides the Crossing Gate; at e6 she rides the Carrier Door with the player; in S7 she passes on a vesicle. Lore: polar molecules need proteins, and a carrier is a door, not an engine |
| **Poro**, aquaporin keeper (`poro`) | S4 | `living_gate.npc.poro`: an **hourglass-waisted stone statue** (1.6 H) with two sleepy eye-glyphs and a single-file groove down its waist; water droplets trickle through it continuously. **P0 as a statue prop** (the zone B landmark) | `wise_mentor` (slow, "Mm.") | Lore: water crosses in single file through channels like him, billions per second (`poro_ledger`, P1) |
| **Kay**, K⁺ lamplighter (`kay`) | S5 | `living_gate.npc.kay`: a **violet sphere** (0.5 H) with a white "+" badge, stubby arms, carrying a long cream lamp pole with a gold hook | `gruff_guard` (grumbly, but proud of the pump) | **Kay's Lanterns** (§6.3): touch 3 dark ATP lanterns with the probe-staff. Reward: his secret line (nerve cells spend a large share of their ATP on the pump) |
| **The Clathrin Ferryman** (`ferryman`) | S6 | `living_gate.npc.ferryman`: a **triskelion** (three curved cream-and-gold legs from a hub, 1.2 H) that rolls on its legs; a small gold dynamin ring hangs from its hub like a lantern | `narrator` (formal, measured) | Operates the Endocytosis Lift; voices e10's `fail.byKey` lines (`order`, `decoy`) at P0 from the Lift frame. Lore: exocytosis is the same trip in reverse |

Emblems: Sucra `hexagon`, Poro `hourglass`, Kay `plus`, the Ferryman `triskelion` (§3.5).

### 3.5 Cast JSON (`world.cast`)

```json
{
  "protagonist": {
    "name": "Diver",
    "look": {
      "atlas": "shared.char.diver",
      "costume": [
        {
          "asset": "living_gate.costume.diver_helmet",
          "anchor": "head",
          "dx": 0,
          "dy": -6,
          "follow": "rigid",
          "layer": "front"
        },
        {
          "asset": "living_gate.costume.diver_scarf",
          "anchor": "back",
          "dx": -8,
          "dy": 4,
          "follow": "spring",
          "layer": "behind"
        },
        {
          "asset": "living_gate.costume.probe_staff",
          "anchor": "hand_r",
          "dx": 0,
          "dy": 0,
          "follow": "rigid",
          "layer": "front"
        }
      ],
      "scale": 1
    }
  },
  "guide": {
    "characterId": "pilot",
    "emblem": {"glyph": "cell", "ring": "#E8F6F8", "accent": "#8FE0EA", "gaps": 2},
    "portrait": "living_gate.companion.ora_bust",
    "companion": {"asset": "living_gate.companion.pip", "offset": [-40, -150], "lagSec": 0.35, "bobPx": 6}
  },
  "speakers": [
    {
      "characterId": "gatekeeper",
      "emblem": {"glyph": "maws", "ring": "#D9A441", "accent": "#6E4A2E", "gaps": 3},
      "portrait": null
    }
  ],
  "extras": [
    {
      "id": "sucra",
      "name": "Sucra",
      "role": "glucose courier",
      "voiceArchetype": "nervous_scholar",
      "emblem": {"glyph": "hexagon", "ring": "#F6E3B4", "accent": "#D9A441", "gaps": 2},
      "portrait": null
    },
    {
      "id": "poro",
      "name": "Poro",
      "role": "aquaporin keeper",
      "voiceArchetype": "wise_mentor",
      "emblem": {"glyph": "hourglass", "ring": "#F2E3C6", "accent": "#8FE0EA", "gaps": 2},
      "portrait": null
    },
    {
      "id": "kay",
      "name": "Kay",
      "role": "K+ lamplighter",
      "voiceArchetype": "gruff_guard",
      "emblem": {"glyph": "plus", "ring": "#9C82E0", "accent": "#F6D27A", "gaps": 2},
      "portrait": null
    },
    {
      "id": "ferryman",
      "name": "The Clathrin Ferryman",
      "role": "keeper of the Endocytosis Lift",
      "voiceArchetype": "narrator",
      "emblem": {"glyph": "triskelion", "ring": "#F2E3C6", "accent": "#D9A441", "gaps": 2},
      "portrait": null
    }
  ]
}
```

---

## 4 · Story arc and dialogue

### 4.1 Structure

| Act | Scenes | Encounters | Role (fixture) | Gradient after |
|---|---|---|---|---|
| **Prologue: Shrink** | S1 | none | — | 12 % |
| **Act I: The Wall That Flows** (the membrane) | S2 | e1_bilayer, e2_selectivity | teach, teach | 26 % |
| **Act II: The Tide Always Goes Somewhere** (passive transport) | S3, S4 | e3_diffusion, e4_osmosis, e5_tonicity, e6_facilitated | teach ×4 | 56 % |
| **Act III: Paying to Climb** (active transport) | S5 | e7_active, e8_pump | teach, teach | 78 % |
| **Crossing** (review + bulk) | S6 | e9_osmosis_review, e10_bulk | **review**, teach | 90 % |
| **Finale: The Gatekeeper** | S7, S8 | e11_boss | **boss** (c_active_transport + c_facilitated) | 100 % |

Teach → review → boss maps exactly onto the fixture's roles: e9 reviews osmosis (e4/e5) under a new framing, and e11
combines the two weakest concepts in the intake (passive, confidence 2, and active, confidence 2).

### 4.2 Cutscenes (`world.cutscenes`)

**Intro camera beats** (the `intro` cutscene below encodes them; the bar is full-width in cutscenes, with Ora's bust at
its left edge):

| Beat | Camera / action | Steps |
|---|---|---|
| C1 | Black → a fade-in on the **cytoplasm glimpse**: amber, with slow motes. Pull up through the bilayer band (the heads pass the camera) into the Tide sky. Title card "THE LIVING GATE" in cream serif caps, letter-spaced | `camera` y 1250 → `fade clear` → `camera` y 540 → `title` |
| C2 | A wide shot of the Shore; the *Halcyon* settles onto the glycan mooring | `say in01` → `sfx halcyon_settle` |
| C3 | The Diver steps out (walk → idle). Pip pops out with a two-tone chirp | `walk player → 520` → `emote companion ♪` → `sfx pip_chirp` → `say in02–in04` |
| C4 | The camera pans right along the dark conduits to the Colonnade Rise | `pan x 5600, zoom 0.8` → `say in05–in07` |
| C5 | Back to the Diver. The HUD fades in (objective ring, GATES 0/11, GRADIENT 12 %) and control is handed over | `pan x 700` → `say in08, in09` → `music curious` |

The **rides and carries** (`e4_raft`, `e6_carry`, `e7_gantry`, `e9_barge`, `e10_vesicle`) are the payoffs'
`rideCutsceneId`s; `e11_arena` is `boss.arenaCutsceneId`; `finale` is `story.finaleCutsceneId`. At P1 add `out04`
(Sucra) and `out05` (Kay) to the finale's third `say`, after `out03`. Express keeps each cutscene's first `say` and
trims the rest, except the finale.

```json
[
  {
    "id": "intro",
    "skippable": true,
    "steps": [
      {"do": "enter_zone", "zoneId": "zone_a", "x": 420, "surface": "ground"},
      {"do": "camera", "x": 700, "y": 1250, "zoom": 1.3, "ms": 0},
      {"do": "fade", "to": "clear", "ms": 900},
      {"do": "camera", "x": 700, "y": 540, "zoom": 1, "ms": 2200, "ease": "in_out_sine"},
      {"do": "title", "text": "THE LIVING GATE", "sub": "Cell V-7 · the outer membrane", "ms": 2400},
      {
        "do": "say",
        "lines": [
          {
            "speakerId": "narrator",
            "text": "Cell V-7, deep in living tissue. Its gates have gone still, and its gradients are draining away.",
            "mood": "solemn"
          }
        ]
      },
      {"do": "sfx", "cue": "halcyon_settle"},
      {"do": "walk", "actor": "player", "toX": 520},
      {"do": "emote", "actor": "companion", "glyph": "♪"},
      {"do": "sfx", "cue": "pip_chirp"},
      {
        "do": "say",
        "lines": [
          {
            "speakerId": "pilot",
            "text": "Hull's holding at seven nanometres, all hands dry. Welcome to the outside of a living cell, Diver.",
            "mood": "excited"
          },
          {
            "speakerId": "pilot",
            "text": "Shrink complete. That wall ahead is the membrane. Nothing gets through it without a reason."
          },
          {
            "speakerId": "pilot",
            "text": "Bad news first: the Stillness hit this cell. Pumps stopped, gates locked, gradients flattening out.",
            "mood": "worried"
          }
        ]
      },
      {"do": "pan", "x": 5600, "y": null, "zoom": 0.8, "ms": 2600},
      {
        "do": "say",
        "lines": [
          {
            "speakerId": "pilot",
            "text": "When inside matches outside, a cell goes quiet for good. Equilibrium sounds calm. For a cell, it's the end.",
            "mood": "solemn"
          },
          {
            "speakerId": "pilot",
            "text": "Good news: every gate here is a machine, and machines restart. Set each one to its true rule and it runs.",
            "mood": "excited"
          },
          {
            "speakerId": "pilot",
            "text": "What crosses, how, and at what cost. Get those right at every gate and we reach the nucleus."
          }
        ]
      },
      {"do": "pan", "x": 700, "y": null, "zoom": 1, "ms": 1600},
      {
        "do": "say",
        "lines": [
          {
            "speakerId": "pilot",
            "text": "I'll hold the Halcyon's helm. Pip goes with you. Pip, say hello. ...Pip says hello.",
            "mood": "wry"
          },
          {
            "speakerId": "pilot",
            "text": "Gradient Meter reads twelve percent. Let's make it a hundred. Pip will blink at anything worth a closer look."
          }
        ]
      },
      {"do": "music", "cue": "curious"}
    ]
  },
  {
    "id": "e4_raft",
    "skippable": true,
    "steps": [
      {"do": "sfx", "cue": "raft_flood"},
      {
        "do": "ride",
        "vehicle": "living_gate.prop.raft",
        "toZoneId": "zone_b",
        "toX": 3960,
        "ms": 2200,
        "path": [[3780, 1213], [3780, 873]]
      }
    ]
  },
  {
    "id": "e6_carry",
    "skippable": true,
    "steps": [
      {"do": "walk", "actor": "player", "toX": 7880},
      {"do": "sfx", "cue": "door_turn"},
      {"do": "fade", "to": "black", "ms": 350},
      {"do": "enter_zone", "zoneId": "zone_c", "x": 300, "surface": "ground"},
      {"do": "fade", "to": "clear", "ms": 450},
      {"do": "title", "text": "THE PUMP HALL", "sub": null, "ms": 1600}
    ]
  },
  {
    "id": "e7_gantry",
    "skippable": true,
    "steps": [
      {"do": "sfx", "cue": "lift_hum"},
      {
        "do": "ride",
        "vehicle": "living_gate.prop.gantry_platform",
        "toZoneId": "zone_c",
        "toX": 1900,
        "toSurface": "pump_deck",
        "ms": 1400,
        "path": [[1840, 1213], [1840, 873]]
      }
    ]
  },
  {
    "id": "e9_barge",
    "skippable": true,
    "steps": [
      {"do": "sfx", "cue": "water_rush"},
      {
        "do": "ride",
        "vehicle": "living_gate.part.tonicity_sluices_barge",
        "toZoneId": "zone_c",
        "toX": 5520,
        "toSurface": "pit_ledge",
        "ms": 1800,
        "path": [[5390, 1213], [5390, 873], [5470, 873]]
      }
    ]
  },
  {
    "id": "e10_vesicle",
    "skippable": true,
    "steps": [
      {"do": "sfx", "cue": "vesicle_pinch"},
      {"do": "camera", "x": 7300, "y": 1300, "zoom": 1, "ms": 1500, "ease": "in_out_sine"},
      {
        "do": "ride",
        "vehicle": "living_gate.part.endocytosis_lift_vesicle",
        "toZoneId": "zone_d",
        "toX": 300,
        "ms": 1800,
        "path": [[7300, 873], [7300, 1250], [7300, 1580]]
      },
      {"do": "fade", "to": "white", "ms": 200},
      {"do": "fade", "to": "clear", "ms": 300},
      {"do": "title", "text": "THE VAULT ROAD", "sub": "inside cell V-7", "ms": 1600}
    ]
  },
  {
    "id": "e11_arena",
    "skippable": true,
    "steps": [
      {"do": "music", "cue": "boss"},
      {"do": "camera", "x": 4300, "y": 640, "zoom": 0.7, "ms": 1400, "ease": "out_cubic"},
      {"do": "station", "encounterId": "e11_boss", "anim": "wake"},
      {"do": "sfx", "cue": "gatekeeper_rumble"},
      {
        "do": "say",
        "lines": [
          {
            "speakerId": "gatekeeper",
            "text": "I have pumped for a billion years. Show me you know what costs energy.",
            "mood": "solemn"
          },
          {
            "speakerId": "gatekeeper",
            "text": "Three maws. Oil, Channel, Pump. Feed each cargo to the right one. Waste my ATP and the vault stays shut."
          }
        ]
      },
      {"do": "camera", "x": null, "y": null, "zoom": 1, "ms": 800, "ease": "out_cubic"}
    ]
  },
  {
    "id": "finale",
    "skippable": true,
    "steps": [
      {
        "do": "say",
        "lines": [
          {
            "speakerId": "gatekeeper",
            "text": "The pore turns. Go. And tell the nucleus the pumps are running again.",
            "mood": "solemn"
          }
        ]
      },
      {"do": "hub", "zoneId": "zone_d", "state": "restored"},
      {"do": "sfx", "cue": "pore_open"},
      {"do": "camera", "x": 4900, "y": 560, "zoom": 0.65, "ms": 1800, "ease": "in_out_sine"},
      {"do": "walk", "actor": "player", "toX": 4900},
      {
        "do": "say",
        "lines": [
          {
            "speakerId": "pilot",
            "text": "The nucleus! You got the whole crew through by knowing what crosses, how, and at what cost.",
            "mood": "excited"
          },
          {
            "speakerId": "pilot",
            "text": "Gradient Meter: one hundred percent. Inside and outside are different again. That difference is what alive means."
          },
          {
            "speakerId": "pilot",
            "text": "Oxygen through the oil, glucose on a carrier, water through Poro, sodium uphill for ATP. You rebuilt a cell's rules."
          },
          {
            "speakerId": "pilot",
            "text": "Bring Pip home, Diver. And, er... the cell next door is looking a little still, too.",
            "mood": "wry"
          }
        ]
      },
      {"do": "fade", "to": "white", "ms": 1200},
      {"do": "fade", "to": "black", "ms": 600}
    ]
  }
]
```

### 4.3 Dialogue (every line, with its slot and speaker)

Rules (checked by the §4.4 script):
- Every line is **≤ 140 characters and ≤ 24 words** (R9), no question marks, no key or button names, no "review",
  "level" or "player"; Ora never says "correct", "wrong", "question" or "answer".
- **`speakerId`** ∈ `spec.characters` (`pilot`, `gatekeeper`) ∪ `cast.extras` (`sucra`, `poro`, `kay`, `ferryman`) ∪
  `{narrator}`. Station `LineSlot`s write the speaker explicitly (null would also mean the guide).
- **Slot semantics (20 §2.7):** `approach` plays once on entering `approachRadius` (500); `instruction` is pinned while
  the panel is open; `tutorial` is line 2 on the first open only; `insight` is line 2 afterwards, the **pre-success**
  hint-free truth of the world; `hints[0..2]` are the guide-voiced rungs of the fixture's `hints[]` with the same meaning
  (the Brief tab still shows the fixture text verbatim); `fail.default` / `fail.byKey` play after a failed Verify, keyed
  by probe key, then near-miss key, then fail key, with `grade()` feedback as the margin note; `success` replaces the
  instruction when the badge shows: the **post-success** concept statement; `payoffLine` toasts while the payoff
  animates; `after` plays in explore after the payoff.
- **R8.** No line in `approach`, `instruction`, `tutorial`, `insight`, `hints[0]`, `hints[1]`, any `fail` or any taunt
  contains the station's banned value (the mimic statement for e1/e3/e4/e7; the first step for e10; the bins, waves and
  pairs modes have none). `hints[2]`, `success`, `payoffLine` and `after` are exempt.
- **P** is the demo-cut priority: P1 lines live in NPC states, triggers, quests and the sandbox (§6), whose bodies are P1.
- The slot column is the exact overlay path: `station.dialogue.<slot>` unless it starts with `cutscene:`, `trigger:`,
  `npc:`, `quest:`, `sandbox:`, `boss.`, `prop:` or a zone path. §5.1 shows one station's assembled `dialogue` object.

#### Prologue and zone A explore (S1)

| id | slot (WorldOverlay path) | speakerId | line | len | P |
|---|---|---|---|---|---|
| `in01` | `cutscene:intro` | `narrator` | Cell V-7, deep in living tissue. Its gates have gone still, and its gradients are draining away. | 96 | P0 |
| `in02` | `cutscene:intro` | `pilot` | Hull's holding at seven nanometres, all hands dry. Welcome to the outside of a living cell, Diver. | 98 | P0 |
| `in03` | `cutscene:intro` | `pilot` | Shrink complete. That wall ahead is the membrane. Nothing gets through it without a reason. | 91 | P0 |
| `in04` | `cutscene:intro` | `pilot` | Bad news first: the Stillness hit this cell. Pumps stopped, gates locked, gradients flattening out. | 99 | P0 |
| `in05` | `cutscene:intro` | `pilot` | When inside matches outside, a cell goes quiet for good. Equilibrium sounds calm. For a cell, it's the end. | 107 | P0 |
| `in06` | `cutscene:intro` | `pilot` | Good news: every gate here is a machine, and machines restart. Set each one to its true rule and it runs. | 105 | P0 |
| `in07` | `cutscene:intro` | `pilot` | What crosses, how, and at what cost. Get those right at every gate and we reach the nucleus. | 92 | P0 |
| `in08` | `cutscene:intro` | `pilot` | I'll hold the Halcyon's helm. Pip goes with you. Pip, say hello. ...Pip says hello. | 83 | P0 |
| `in09` | `cutscene:intro` | `pilot` | Gradient Meter reads twelve percent. Let's make it a hundred. Pip will blink at anything worth a closer look. | 109 | P0 |
| `s1_walk1` | `trigger:s1_walk1` | `pilot` | Those branching trees are the glycocalyx: sugar chains on the cell's surface. Think of them as its name tag. | 108 | P1 |
| `s1_walk2` | `trigger:s1_walk2` | `pilot` | The ground under you is the membrane itself. Round heads on top, oily tails underneath. Mind your step. | 103 | P1 |
| `s1_roots` | `trigger:s1_roots (hint)` | `pilot` | Glycan roots, knee-high to a Diver. Hop them; the membrane on the far side is solid. | 84 | P1 |
| `s1_node` | `trigger:s1_node` | `pilot` | A seal node, dark as a cave. Every gate you restart lights a conduit to one of these. That's our map. | 101 | P1 |

> `in03` is the fixture's `narrative.intro[0]`, verbatim. `in09` is rewritten (30 §2.6): the controls now come from the
> interact glyph ("Space · Hop") and the key legend, not from Ora.

#### Act I: e1_bilayer · Specimen Pods at the Stiff Ridge (S2)

| id | slot (WorldOverlay path) | speakerId | line | len | P |
|---|---|---|---|---|---|
| `e1_approach` | `approach` | `pilot` | The Stillness froze this stretch of membrane solid. Three specimen pods here, and one of them holds a Mimic. | 108 | P0 |
| `e1_instr` | `instruction` | `pilot` | Push the probe into the membrane and watch it. Then quarantine the pod whose claim the membrane disproves. | 106 | P0 |
| `e1_tut` | `tutorial` | `pilot` | Your depth dial drives the needle. My readouts track how polar the membrane is at its tip, and what that costs an ion. | 118 | P0 |
| `e1_insight` | `insight` | `pilot` | Healthy membrane parts around the needle and closes behind it. Only the frozen ridge stays stiff. | 97 | P0 |
| `e1_h1` | `hints[0]` | `pilot` | Forget the textbook diagram. Watch what the heads do while the needle goes in; that's what this ground is made of. | 114 | P0 |
| `e1_h2` | `hints[1]` | `pilot` | Lipids with oily tails make a layer that flows around the probe and closes behind it. That's no wall. | 101 | P0 |
| `e1_h3` | `hints[2]` | `pilot` | The Mimic's claim: "The membrane is a rigid wall with fixed holes in it." | 73 | P0 |
| `e1_fail` | `fail.default` | `pilot` | That pod's claim held up against the real membrane. Push again, and watch which claim the heads keep breaking. | 110 | P0 |
| `e1_success` | `success` | `pilot` | A membrane is not a wall. It's a film that flows, and only proteins give it doors. | 82 | P0 |
| `e1_payoff` | `payoffLine` | `pilot` | Mimic quarantined! And look at the ridge. It's melting back into a path. | 72 | P0 |

#### Act I: e2_selectivity · Membrane Router at the Crossing Gate (S2)

| id | slot (WorldOverlay path) | speakerId | line | len | P |
|---|---|---|---|---|---|
| `sucra_1` | `npc:sucra.s2_knock` | `sucra` | Pardon! Excuse me! I've knocked on these heads for an hour. They simply will not let a glucose through. | 103 | P1 |
| `e2_approach` | `approach` | `pilot` | Watch the small ones. Small doesn't mean welcome. | 49 | P0 |
| `e2_instr` | `instruction` | `pilot` | Route each molecule: straight through the bilayer on the Oil Road, or through the Crossing Gate's ring. | 103 | P0 |
| `e2_tut` | `tutorial` | `pilot` | Pick a molecule, then a lane. It queues where you send it; nothing crosses until the whole cargo is routed. | 107 | P0 |
| `e2_insight` | `insight` | `pilot` | The oily core between the heads is the real border. Size gets a molecule noticed; chemistry gets it through. | 108 | P0 |
| `e2_h1` | `hints[0]` | `pilot` | Size is a clue, not the rule. Pip's water lens is on now: see which molecules drag a shell of water with them. | 110 | P0 |
| `e2_h2` | `hints[1]` | `pilot` | Check whether each one is polar or charged. The oily core between the heads turns away anything with a charge. | 110 | P0 |
| `e2_h3` | `hints[2]` | `pilot` | Na+ is smaller than O2 and still can't cross alone. Charge beats size, every time. | 82 | P0 |
| `e2_fail` | `fail.default` | `pilot` | The road refused one. Check its charge and polarity before its size, then reroute it. | 85 | P0 |
| `e2_fail_small` | `fail.byKey:small_passes` | `pilot` | Size fooled you there. Even the smallest ion on this yard bounces off the oil. | 78 | P0 |
| `e2_fail_size` | `fail.byKey:size_rule` | `pilot` | Size isn't what the heads check. An oily visitor slips through them whatever its size. | 86 | P0 |
| `e2_success` | `success` | `pilot` | Oil lets the oily through. Charged and polar visitors need a protein door, however small they are. | 98 | P0 |
| `e2_payoff` | `payoffLine` | `pilot` | Every molecule took the right road! The Crossing Gate is spinning up. | 69 | P0 |
| `sucra_2` | `after` | `sucra` | A carrier! It takes me in, turns around, lets me out. No shoving, no fuel. Marvellous. | 86 | P1 |

> `e2_approach` is the fixture beat for e2 (`when: before`), verbatim.

#### Act II: e3_diffusion · Specimen Pods at the Dye Tank (S3)

| id | slot (WorldOverlay path) | speakerId | line | len | P |
|---|---|---|---|---|---|
| `zB_arrive` | `trigger:zB_arrive (arrival)` | `pilot` | The Tide Basins. Everything here is about water, and water always has somewhere it wants to be. | 95 | P1 |
| `e3_approach` | `approach` | `pilot` | The Balance Lock only opens when both sides of this tank are even. Right now the dye is piled on the left. | 106 | P0 |
| `e3_instr` | `instruction` | `pilot` | Set the dye load and watch the tank. Then quarantine the pod whose story about the dye is a lie. | 96 | P0 |
| `e3_tut` | `tutorial` | `pilot` | The dye dial refills the left chamber. On my top readout the white dot is the left side now, the green dot the right. | 117 | P0 |
| `e3_insight` | `insight` | `pilot` | Watch the ringed tracer. It wanders, doubles back, and never once checks where the crowd is. | 92 | P0 |
| `e3_h1` | `hints[0]` | `pilot` | Follow the tracer, the one with the white ring. Watch whether it ever seems to know where the crowd is. | 103 | P0 |
| `e3_h2` | `hints[1]` | `pilot` | Each particle wanders at random. More start on the crowded side, so more happen to cross from there. | 100 | P0 |
| `e3_h3` | `hints[2]` | `pilot` | The Mimic's claim: "The dye particles head for the empty side on purpose." | 74 | P0 |
| `e3_fail` | `fail.default` | `pilot` | That pod's story matched the tank. Watch the tracer's trail for a while before you choose again. | 96 | P0 |
| `e3_success` | `success` | `pilot` | No particle has a plan. Diffusion is just what a crowd of random steps adds up to. | 82 | P0 |
| `e3_payoff` | `payoffLine` | `pilot` | Mimic quarantined. The tank's evening out, and the Balance Lock is levelling off. | 81 | P0 |

#### Act II: e4_osmosis · Specimen Pods at the Osmometer Basin (S3)

| id | slot (WorldOverlay path) | speakerId | line | len | P |
|---|---|---|---|---|---|
| `e4_approach` | `approach` | `pilot` | A test cell in a salt bath, and a raft stuck in a dry lock. It won't float until something crosses that window. | 111 | P0 |
| `e4_instr` | `instruction` | `pilot` | Salt the bath and watch the test cell. Then quarantine the pod whose story about what moves doesn't hold. | 105 | P0 |
| `e4_tut` | `tutorial` | `pilot` | The salt dial sets the bath. Below two percent the pods go quiet: their claims are about a salty bath. | 102 | P0 |
| `e4_insight` | `insight` | `pilot` | Those salt cubes have been bouncing off the cell all morning. The membrane is fussy about what it lets in. | 106 | P0 |
| `e4_h1` | `hints[0]` | `pilot` | Two things could cross: the water or the dissolved salt. Only one of them gets through a bilayer. | 97 | P0 |
| `e4_h2` | `hints[1]` | `pilot` | Osmosis is water moving toward the side with more solute. Watch where the blue droplets go. | 91 | P0 |
| `e4_h3` | `hints[2]` | `pilot` | The Mimic's claim: "Salt rushes into the cell until both sides match." | 70 | P0 |
| `e4_fail` | `fail.default` | `pilot` | That pod was honest. Crank the salt up and down, and watch what the white salt cubes actually do. | 97 | P0 |
| `e4_success` | `success` | `pilot` | Salt stays where it is. Water goes where the solute is, and it'll lift a raft to get there. | 91 | P0 |
| `e4_payoff` | `payoffLine` | `pilot` | Quarantined! Now I'm salting the raft lock. Water will follow the salt in and float you up. Step aboard! | 104 | P0 |

> `e4_approach` is rewritten (30 §2.6): revision 1 ended "Something here has to move. What?", a quiz question.

#### Act II: e5_tonicity · Tonicity Sluices (S4)

| id | slot (WorldOverlay path) | speakerId | line | len | P |
|---|---|---|---|---|---|
| `poro_1` | `approach` | `poro` | Mm. Visitors. I am Poro. Water passes through my waist in single file, and nothing else. Now, the sluices. | 106 | P0 |
| `e5_approach` | `approach` | `pilot` | Cells are drifting down the sluice canal. Each lock needs a label before its cell passes. Quick hands, Diver. | 109 | P0 |
| `e5_instr` | `instruction` | `pilot` | Label each lock's bath before its cell drifts past: hypotonic, isotonic, or hypertonic. | 87 | P0 |
| `e5_tut` | `tutorial` | `pilot` | Each cell gives you eight seconds at the Label Lock. One that drifts past unlabelled spins into the Eddy and counts as a miss. | 126 | P0 |
| `e5_insight` | `insight` | `pilot` | Poro's basins have sorted cells for a billion years. Swell, shrink, or hold steady: the bath decides which. | 107 | P0 |
| `e5_h1` | `hints[0]` | `pilot` | The label describes the bath around the cell, not the cell itself. | 66 | P0 |
| `e5_h2` | `hints[1]` | `pilot` | Hyper means more solute outside, so water leaves. Hypo means less solute outside, so water comes in. | 100 | P0 |
| `e5_h3` | `hints[2]` | `pilot` | A swelling cell means water came in, so its bath had less solute than the cell. | 79 | P0 |
| `e5_fail` | `fail.default` | `pilot` | One lock's label doesn't fit its bath. Compare the dots inside that cell with the dots around it. | 97 | P0 |
| `e5_fail_hyper` | `fail.byKey:hyper_more_water` | `pilot` | Hyper means more solute, not more water. A bath that's nearly all water is the one with the fewest dots. | 104 | P0 |
| `e5_success` | `success` | `pilot` | Tonicity always compares the bath with the cell. Hyper outside, water leaves. Hypo outside, water arrives. | 106 | P0 |
| `e5_payoff` | `payoffLine` | `pilot` | The sluice is draining! Steps are coming up out of the water, and that's our way up. | 84 | P0 |
| `poro_2` | `after` | `poro` | Mm. Well sorted. The water will remember you. Take my ledger; it is heavy with droplets. | 88 | P0 |

> The old `e5_timeout` line is folded into `e5_tut` (the WaveControl timer is explained before the first wave, which
> needs no new slot).

#### Act II: e6_facilitated · Threshold Router at the Carrier Door (S4)

| id | slot (WorldOverlay path) | speakerId | line | len | P |
|---|---|---|---|---|---|
| `sucra_s4` | `npc:sucra.s4_wait` | `sucra` | Oh, it's you! The Carrier Door takes two, you know. I have been practising my boarding. | 87 | P1 |
| `e6_approach` | `approach` | `pilot` | The Pump Hall doors. More cargo waiting, and two gates: the Glide Gate, and the Pump Gate that burns ATP. | 105 | P0 |
| `e6_instr` | `instruction` | `pilot` | Route each cargo: passive, down its slope for free, or active, uphill through the pump at a cost. | 97 | P0 |
| `e6_tut` | `tutorial` | `pilot` | Each cargo floats over its own ramp; the dense end is the crowded side. My ATP readout shows what the Pump Gate would spend. | 124 | P0 |
| `e6_insight` | `insight` | `pilot` | Plenty of proteins in this yard, and most of them never touch a spark of ATP. | 77 | P0 |
| `e6_h1` | `hints[0]` | `pilot` | Ignore whether a protein is involved. Look at the slope under each cargo, and which way it has to go. | 101 | P0 |
| `e6_h2` | `hints[1]` | `pilot` | Downhill is always passive, protein or not. A carrier is a door, not an engine. | 79 | P0 |
| `e6_h3` | `hints[2]` | `pilot` | Only the cargo heading toward the more crowded side costs ATP. | 62 | P0 |
| `e6_fail` | `fail.default` | `pilot` | One cargo went to a gate that won't take it. Check its slope: rolling down on its own, or being pushed up. | 106 | P0 |
| `e6_fail_protein` | `fail.byKey:protein_costs_atp` | `pilot` | A protein on the route doesn't mean a fuel bill. Downhill cargo rides a door for free. | 86 | P0 |
| `e6_success` | `success` | `pilot` | A protein can open a door without paying a thing. Energy is only spent when the cargo climbs. | 93 | P0 |
| `e6_payoff` | `payoffLine` | `pilot` | Threshold open! The Carrier Door is turning. Everybody into the pocket! | 71 | P0 |
| `sucra_3` | `after` | `sucra` | Told you. A carrier is a door, not an engine. I am going to write that on something. | 84 | P1 |

#### Act III: e7_active · Specimen Pods at the Uphill Flume (S5)

| id | slot (WorldOverlay path) | speakerId | line | len | P |
|---|---|---|---|---|---|
| `zC_arrive` | `trigger:zC_arrive (arrival)` | `pilot` | The Pump Hall. Those gold rails used to carry ATP to every pump in the wall. Dark as a hold in here. | 100 | P1 |
| `kay_1` | `npc:kay.dark_hall` | `kay` | Oi. Mind the lanterns. Kay, K-plus, lamplighter. Nothing's been lit since the pumps went quiet. | 95 | P1 |
| `kay_quest` | `npc:kay.dark_hall` | `kay` | Three lanterns in here are still dark. Touch 'em with that probe of yours and I'll tell you a secret. | 101 | P1 |
| `e7_approach` | `approach` | `pilot` | Two tanks, one high and one low, and a pump between them. Three pods argue about what that pump does. | 101 | P0 |
| `e7_instr` | `instruction` | `pilot` | Feed the pump ATP and watch the tanks. Then quarantine the pod that has pumps backwards. | 88 | P0 |
| `e7_tut` | `tutorial` | `pilot` | The ATP dial feeds the pump. On my readouts white is the high tank, green the low one, and gold is what you're spending. | 120 | P0 |
| `e7_insight` | `insight` | `pilot` | At zero feed the gap between those tanks bleeds away down the leak trough. That's the Stillness in miniature. | 109 | P0 |
| `e7_h1` | `hints[0]` | `pilot` | A cell spends ATP on moving things for a reason. Try the feed at zero and watch the tanks. | 90 | P0 |
| `e7_h2` | `hints[1]` | `pilot` | If everything only ran downhill, nobody would ever need to pay for it. | 70 | P0 |
| `e7_h3` | `hints[2]` | `pilot` | The Mimic's claim: "Transport always runs down the gradient, so pumps just speed it up." | 88 | P0 |
| `e7_fail` | `fail.default` | `pilot` | That pod told the truth. Take the feed to zero, then up again, and watch which way the gap between the tanks goes. | 114 | P0 |
| `e7_success` | `success` | `pilot` | A pump is a climber. It carries cargo uphill, from low to high, and ATP pays for every step. | 92 | P0 |
| `e7_payoff` | `payoffLine` | `pilot` | Quarantined, and the lanterns are catching! The gantry has power. Up you go. | 76 | P0 |

#### Act III: e8_pump · Pump Rewiring (S5)

| id | slot (WorldOverlay path) | speakerId | line | len | P |
|---|---|---|---|---|---|
| `e8_approach` | `approach` | `pilot` | There it is: the sodium-potassium pump. Biggest machine on this membrane, and someone pulled its cables. | 104 | P0 |
| `e8_instr` | `instruction` | `pilot` | Rewire the pump: link each socket to its value cartridge. Step the stage dial to test a cycle. | 94 | P0 |
| `e8_tut` | `tutorial` | `pilot` | Each cartridge loads exactly what its label says. Step the stage dial and the drum runs a cycle on what you loaded. | 115 | P0 |
| `e8_insight` | `insight` | `pilot` | Every beat of a nerve starts with this machine. The charge ledger shows what one cycle leaves behind. | 101 | P0 |
| `e8_h1` | `hints[0]` | `pilot` | The counts aren't equal. That lopsidedness is the whole point of this machine. | 78 | P0 |
| `e8_h2` | `hints[1]` | `pilot` | More positive charge leaves than comes in each cycle. Count which ion leaves, and how many. | 91 | P0 |
| `e8_h3` | `hints[2]` | `pilot` | Three sodium out, two potassium in, one ATP. | 44 | P0 |
| `e8_fail` | `fail.default` | `pilot` | The pump jammed at one stage. Find the socket whose cable won't hold and rethink that link. | 91 | P0 |
| `e8_fail_equal` | `fail.byKey:equal_counts` | `pilot` | Two out and two in moves no charge at all. The ledger needle never leaned; a balanced pump builds nothing. | 106 | P0 |
| `e8_success` | `success` | `pilot` | Three out and two in leaves the inside a little negative. That lopsided pump is why nerves can fire. | 100 | P0 |
| `e8_payoff` | `payoffLine` | `pilot` | It's cycling! Three out, two in, one spark of ATP, again and again. The Hall Gate is lifting. | 93 | P0 |
| `kay_2` | `npc:kay.after_pump` | `kay` | Three out, two in. Lopsided, I always said. Lopsided's what keeps the lights on. | 80 | P1 |
| `kay_reward` | `quest:kay_lanterns.reward` | `kay` | Secret is, a nerve cell spends a big share of all its ATP just running pumps like that one. Worth every spark. | 110 | P1 |

#### Crossing: e9_osmosis_review · Return Sluice (S6)

| id | slot (WorldOverlay path) | speakerId | line | len | P |
|---|---|---|---|---|---|
| `e9_approach` | `approach` | `pilot` | Four cells coming down the Return Sluice, and our barge is sitting on the mud. | 78 | P0 |
| `e9_instr` | `instruction` | `pilot` | For each lock, set the water flow before the cell drifts past: in, out, or no net movement. | 91 | P0 |
| `e9_tut` | `tutorial` | `pilot` | Same Label Lock, new valves. Hover one and ghost arrows show the flow it claims. Eight seconds per cell. | 104 | P0 |
| `e9_insight` | `insight` | `pilot` | Solute dots never leave their side of a membrane. Only the water gets to travel. | 80 | P0 |
| `e9_h1` | `hints[0]` | `pilot` | Compare the solute dots inside and outside each cell. | 53 | P0 |
| `e9_h2` | `hints[1]` | `pilot` | Water goes toward the side with more solute. | 44 | P0 |
| `e9_h3` | `hints[2]` | `pilot` | Equal solute on both sides means no net movement at all. | 56 | P0 |
| `e9_fail` | `fail.default` | `pilot` | One flow call was off. The salt doesn't move, so ask which side the water is heading toward. | 92 | P0 |
| `e9_fail_salt` | `fail.byKey:salt_moves` | `pilot` | Salt never makes the trip across. Watch the dots stay put, and let the water do the travelling. | 95 | P0 |
| `e9_success` | `success` | `pilot` | You never have to watch the salt. Find where the solute is crowded, and the water's already on its way. | 103 | P0 |
| `e9_payoff` | `payoffLine` | `pilot` | Every call right. The locks are filling, and the barge is rising to the Endocytosis Pit. | 88 | P0 |

> `e9_approach` is rewritten (30 §2.6): revision 1's "Review time, and a barge to catch" broke the fiction.

#### Crossing: e10_bulk · Endocytosis Lift (S6)

| id | slot (WorldOverlay path) | speakerId | line | len | P |
|---|---|---|---|---|---|
| `ferry_1` | `npc:ferryman.lift` | `ferryman` | Passage inward is by vesicle only. The membrane will carry you, if you tell it how. In order. | 93 | P1 |
| `e10_approach` | `approach` | `pilot` | No channel in this cell is big enough for the Halcyon. So the membrane is going to swallow us. On purpose. | 106 | P0 |
| `e10_instr` | `instruction` | `pilot` | Set the four stage plates in the order that brings us into the cell. One plate doesn't belong. | 94 | P0 |
| `e10_tut` | `tutorial` | `pilot` | The playback dial runs the membrane through your plates, slot by slot. Scrub it and watch the pit try each step. | 112 | P0 |
| `e10_insight` | `insight` | `pilot` | Nothing this big fits through a protein. The membrane will have to do the carrying itself, and that costs ATP. | 110 | P0 |
| `e10_h1` | `hints[0]` | `pilot` | Something too big for any protein channel has to be wrapped up. | 63 | P0 |
| `e10_h2` | `hints[1]` | `pilot` | The membrane does the wrapping first, then closes the pocket. | 61 | P0 |
| `e10_h3` | `hints[2]` | `pilot` | Start at the moment of contact and end with the vesicle moving. | 63 | P0 |
| `e10_fail` | `fail.default` | `pilot` | The Lift stalled partway. Scrub through your plates and find the step that can't happen yet. | 92 | P0 |
| `ferry_hold` | `fail.byKey:order` | `ferryman` | Hold. The membrane cannot do that yet. | 38 | P0 |
| `ferry_dissolve` | `fail.byKey:decoy` | `ferryman` | Nothing this size dissolves through us. The membrane must carry it, and carrying costs. | 87 | P0 |
| `e10_success` | `success` | `pilot` | Big cargo can't pass through a door, so the membrane becomes the door. Folding and pinching both cost ATP. | 106 | P0 |
| `e10_payoff` | `payoffLine` | `pilot` | We're folding in... pinching off... and we're in! Welcome to the cytoplasm, Diver. | 82 | P0 |
| `ferry_2` | `after` | `ferryman` | Outward is the same voyage, reversed. A vesicle meets the membrane, joins it, and opens to the world. | 101 | P1 |

#### Finale: the Vault Road and the Gatekeeper (S7–S8)

| id | slot (WorldOverlay path) | speakerId | line | len | P |
|---|---|---|---|---|---|
| `s7_walk1` | `trigger:s7_walk1 (arrival)` | `pilot` | Look up, Diver. That's the membrane from the inside. Those glowing domes are organelles, and the big one is the nucleus. | 120 | P1 |
| `s7_walk2` | `trigger:s7_walk2` | `pilot` | Every conduit you lit is feeding the Nuclear Pore. It needs one last push, and I think I know who's in the way. | 111 | P1 |
| `s7_view` | `trigger:s7_viewpoint (arrival)` | `pilot` | That's the whole skyline: Golgi, mitochondria, the ER, and the nucleus. Every one of them is waiting on that pore. | 114 | P1 |
| `s7_walk3` | `trigger:s7_walk3` | `pilot` | Real nuclear pores are their own kind of gate. This old pump just parked itself on the road when the Stillness hit. | 115 | P1 |
| `sucra_4` | `npc:sucra.s7_vesicle` | `sucra` | Carried! Politely! By a vesicle! I am having the most educational day. | 70 | P1 |
| `gk_1` | `cutscene:e11_arena` | `gatekeeper` | I have pumped for a billion years. Show me you know what costs energy. | 70 | P0 |
| `gk_2` | `cutscene:e11_arena` | `gatekeeper` | Three maws. Oil, Channel, Pump. Feed each cargo to the right one. Waste my ATP and the vault stays shut. | 104 | P0 |
| `e11_instr` | `instruction` | `pilot` | Sort every cargo into a maw: simple diffusion, facilitated diffusion, or active transport. | 90 | P0 |
| `e11_tut` | `tutorial` | `pilot` | Cargo comes in three batches. Each maw opens as you pick it, and my ATP readout shows the Pump Maw's bill. | 106 | P0 |
| `e11_insight` | `insight` | `pilot` | Every crossing in this cell comes down to two things: which way the cargo is headed, and whether it dissolves in oil. | 117 | P0 |
| `gk_p1` | `boss.phases[0].line` | `gatekeeper` | Hrrm. Two cargo to start. Show me you can tell a slope from a shove. | 68 | P0 |
| `gk_p2` | `boss.phases[1].line` | `gatekeeper` | Two more. My pump maw is hungry, and it hates waste. | 52 | P0 |
| `gk_p3` | `boss.phases[2].line` | `gatekeeper` | The last three. A billion years of pumping rides on these. | 58 | P0 |
| `e11_h1` | `hints[0]` | `pilot` | Check two things per cargo: which way it's headed on its gradient, and whether it can dissolve through lipid alone. | 115 | P0 |
| `e11_h2` | `hints[1]` | `pilot` | Uphill is always active. Downhill with a protein is facilitated. | 64 | P0 |
| `e11_h3` | `hints[2]` | `pilot` | Only small nonpolar molecules cross alone. | 42 | P0 |
| `e11_fail` | `boss.taunts.fail[0]` | `gatekeeper` | Hrrm. That one came back up. Direction first. Then ask whether it can pass through oil. | 87 | P0 |
| `e11_fail2` | `boss.taunts.fail[1]` | `gatekeeper` | Hrrm. My maws do not argue. They spit. Look at the slope under what I spat. | 75 | P0 |
| `gk_protein` | `boss.taunts.byKey:protein_costs_atp` | `gatekeeper` | A door is not an engine. My pump maw will not pay for a downhill trip. | 70 | P0 |
| `gk_downhill` | `boss.taunts.byKey:always_downhill` | `gatekeeper` | Downhill only, you think. Then nothing would ever climb, and my pump maw has climbed for a billion years. | 105 | P0 |
| `gk_small` | `boss.taunts.byKey:small_passes` | `gatekeeper` | Small is not welcome. Charge sinks in my oil maw like a stone. | 62 | P0 |
| `e11_guide_fail` | `fail.default` | `pilot` | One came back up. Take it from the top: the way it's headed first, then whether oil lets it through. | 100 | P0 |
| `e11_success` | `success` | `pilot` | Oil for the small and nonpolar, a protein door for the rest, and ATP only for the climb. That's every crossing. | 111 | P0 |
| `e11_payoff` | `payoffLine` | `gatekeeper` | Sorted true. Pass, molecule-wise crew. | 38 | P0 |
| `gk_3` | `cutscene:finale` | `gatekeeper` | The pore turns. Go. And tell the nucleus the pumps are running again. | 69 | P0 |
| `pore_restored` | `zone_d.hub.restoredLine` | `pilot` | The pore's turning! Every conduit you lit is pouring into it. | 61 | P0 |

> `gk_1` is the fixture's e11 `before` beat and `e11_payoff` its `after` beat, both verbatim. Boss fail order
> (20 §2.5.4 `failLines`): the Gatekeeper's taunt first (`taunts.byKey[key]`, else `taunts.fail[attempt % 2]`), then
> Ora's `fail.default`.

#### Outro (the `finale` cutscene)

| id | slot (WorldOverlay path) | speakerId | line | len | P |
|---|---|---|---|---|---|
| `out01` | `cutscene:finale` | `pilot` | The nucleus! You got the whole crew through by knowing what crosses, how, and at what cost. | 91 | P0 |
| `out02` | `cutscene:finale` | `pilot` | Gradient Meter: one hundred percent. Inside and outside are different again. That difference is what alive means. | 113 | P0 |
| `out03` | `cutscene:finale` | `pilot` | Oxygen through the oil, glucose on a carrier, water through Poro, sodium uphill for ATP. You rebuilt a cell's rules. | 116 | P0 |
| `out04` | `cutscene:finale` | `sucra` | For the record: I was carried, politely, by a protein. Carried! | 63 | P1 |
| `out05` | `cutscene:finale` | `kay` | Lanterns lit. Pumps thumping. Don't let anyone tell you lopsided is a flaw. | 75 | P1 |
| `out06` | `cutscene:finale` | `pilot` | Bring Pip home, Diver. And, er... the cell next door is looking a little still, too. | 84 | P0 |

> `out01` is the fixture's `narrative.outro[0]`, verbatim.

#### Side content (NPC states, sandbox, touch props)

| id | slot (WorldOverlay path) | speakerId | line | len | P |
|---|---|---|---|---|---|
| `poro_ledger` | `npc:poro.thanks` | `poro` | Mm. My kind lets water through in single file, billions of molecules each second. Only water. I am very strict. | 111 | P1 |
| `garden_open` | `sandbox:garden.lines.open` | `pilot` | A plant cell in fresh water, and it isn't bursting. Its wall pushes back. That's turgor. Plants like it firm. | 109 | P1 |
| `garden_idle` | `sandbox:garden.lines.idle` | `pilot` | Try salting the pool past two percent and watch the green wall. | 63 | P1 |
| `garden_reward` | `sandbox:garden.reward` | `pilot` | There: the protoplast lets go of the wall. Back to fresh water and it presses firm again. | 89 | P1 |
| `seal_lit` | `prop:seal_node.touch` | `pilot` | This node's awake. Two conduits feed it now, and the Crossing Gate is humming on the other end. | 95 | P1 |

#### Lore plaques (Pip scans; `world.plaques`, document style)

| id | Title | Text | Where | P |
|---|---|---|---|---|
| p1 | The Two Faces | Each lipid has a head that loves water and two tails that flee it. Tails hide inside; heads face out. | zone A, `root_ledge` x 1440 | P0 |
| p2 | Why Oil Says No | A charge wants water around it. The bilayer's oily core has none, so ions are turned away. | zone A, `stud_ledge` x 7040 | P0 |
| p3 | The Jittering Grains | In 1827 Robert Brown saw tiny grains from pollen jitter in water. Nothing pushed them but water. | zone B, raft ledge x 4300 | P1 |
| p4 | The Lopsided Engine | Three Na+ out, two K+ in, one ATP. More plus leaves than enters, so the inside turns negative. | zone C, `pump_deck` x 3700, **after e8** | P1 |
| p5 | Doors Made of Door | Cells swallow large cargo by folding membrane around it. Exocytosis runs the same trip outward. | zone C, `pit_ledge` x 6700 | P1 |

### 4.4 Line count and length check

- **172 lines** in §4.3 (13 prologue + zone A, 10 e1, 14 e2, 11 e3, 10 e4, 13 e5, 13 e6, 13 e7, 13 e8, 11 e9, 14 e10, 26 e11 + zone D, 6 outro, 5 side content), plus 5 plaques. 144 are P0; the rest belong to P1 bodies, triggers, the quest and the sandbox.
- **Every line is ≤ 140 characters and ≤ 24 words.** The longest is 126 characters (`e5_tut`); the most words in a line is 24. Every `speakerId` is `pilot`, `gatekeeper`, `sucra`, `poro`, `kay`, `ferryman` or `narrator`.

The check C2 runs after any edit (it parses the §4.3 tables of this file; the R8 banned values are the fixture's mimic
statements and e10's first step):

```bash
python3 - <<'PY'
import json, re
doc = open("docs/design/11-game-cell-transport.md").read()
s = doc[doc.index("### 4.3"):doc.index("### 4.4")]
fx = json.load(open("fixtures/cell-transport-dungeon.json"))
enc = {e["id"]: e for e in fx["encounters"]}
ban = {e: [p["params"]["statements"][p["solution"]["mimicIndex"]]["text"]] for e, p in enc.items() if p["mode"] == "mimic"}
ban["e10_bulk"] = [enc["e10_bulk"]["params"]["steps"][0]]
exempt = ("hints[2]", "success", "payoffLine", "after")
norm = lambda t: " " + re.sub(r"[^a-z0-9]+", " ", t.lower()).strip() + " "
speakers = {"pilot", "gatekeeper", "sucra", "poro", "kay", "ferryman", "narrator", "player"}
bad, n, cur = [], 0, None
for row in s.splitlines():
    m = re.match(r"#### .*?(e\d+_\w+)", row)
    if row.startswith("#### "): cur = m.group(1) if m else None
    c = [x.strip() for x in row.split("|")]
    if len(c) < 7 or not c[1].startswith("`"): continue
    n += 1
    slot, spk, text = c[2].strip("`"), c[3].strip("`"), c[4].replace("\\|", "|")
    if len(text) > 140 or len(text.split()) > 24: bad.append(("length", c[1]))
    if spk not in speakers: bad.append(("speaker", c[1]))
    if "?" in text: bad.append(("question", c[1]))
    if spk == "pilot" and re.search(r"\b(correct|wrong|question|answer)s?\b", text, re.I): bad.append(("voice", c[1]))
    if re.search(r"\b(Space|press|click|keys?|review|level|player)\b", text): bad.append(("fourth wall", c[1]))
    if cur in ban and not slot.startswith(exempt):
        if any(norm(b) in norm(text) for b in ban[cur]): bad.append(("R8", c[1]))
print(n, "lines;", bad or "clean")
PY
```

Expected output: `172 lines; clean`.

### 4.5 Beats outside dialogue (engine hooks)

| Moment | What plays | Mechanism (20) |
|---|---|---|
| Entering a station's `approachRadius` (500) | `approach` lines, once, as toasts | §2.7 station slot flow |
| Panel opens | `instruction` pinned; `tutorial` on the first open, `insight` afterwards | §2.7 |
| Hint rung r | `hints[r − 1]`; Pip flies to `hintTargets(r)`; `aidTier` updates | §2.5.3, §2.7 |
| Failed Verify | boss taunt (e11) → `fail.byKey[key]` or `fail.default`; the `grade()` feedback (after `feedbackNouns`) as the margin note | §2.5.4 |
| Correct Verify | `success` replaces the instruction; the badge; `payoffLine` toasts during the payoff; `after` in explore | §2.7 |
| After-beats | Poro's `poro_2` after e5 (P0); Sucra's `sucra_2` / `sucra_3`, Kay's `kay_2` and the Ferryman's `ferry_2` live in NPC states (P1) | §2.4.4 |
| Arena | crossing x 3000 in zone D → `e11_arena` (wake, `gk_1`, `gk_2`, music `boss`), then the camera clamps to `arenaBounds` [2800, 5600] | §2.8 |
| Boss phases | each batch of cargo appears with its `phases[i].line`; the next batch appears when the previous one is placed | §3.2 `InstrumentPanel` |
| Finale | e11 payoff → `finale` (`gk_3`, the pore turns, walk in, `out01–out03`, `out06`) → EndScreen | §2.8, §2.9 (D2) |
| Fixture beats, verbatim | `in03` (intro), `e2_approach` (e2 before), `gk_1` (e11 before), `e11_payoff` (e11 after), `out01` (outro) | — |

---

## 5 · Contraptions (one per encounter)

### 5.0 Shared rules for every contraption in this game

**R1 · The five-part grammar** (bible §4): console → control → live link → Verify → payoff. Each block below fills all
five. The console is `living_gate.prop.console` (kit `lectern`) unless the station sets `consoleAsset` (e11: the kiosk).

**R2 · Claim renders vs verdicts (20 §2.5.6, the live-reveal rule).** The live link renders **what the player's current
input claims**, through the physics of the world: a molecule floats to the lane you chose, a bath fills to the density
your label implies, a pump loads the counts you wired, a ghost shows what a pod's claim predicts. **Verdicts** (bounce vs
pass, jam vs cycle, fate vs no fate) wait for **Verify**, and then reveal exactly what `grade()` feedback reveals: the
first miss in `grade()`'s own order and nothing about the other items. A contraption never shows a count of correct
items, a per-item tick, or a capacity that implies the answer (no "3 slots" on a bin). Probes and sims are continuous
and may show how the world responds; that is the lesson, not a verdict. Specific gates in this game: e8's neutral
"loaded: …" label (§5.8); lane chips show counts only; a hovered valve renders the claimed bath, never water arrows
(e5); fates play live only when the wave text states them (e5 `showFate: true`, e9 `false`).

**R3 · Drafts (20 §2.5.1, §3.3).** Every control emits a `Draft` whose `input` is a `DraftInputs` shape, plus the UI
channels. No mode file changes; `toSubmitInput` builds the mode's exact `Input` at Verify.

| Mode | Control | `draft.input` | Other channels | Verify enables when |
|---|---|---|---|---|
| `truth_finder.mimic` (e1, e3, e4, e7) | `AimControl` | `{statementIndex}` (the **original** index) | `hover`, `focus` (a hovered claim previews its ghost), `probe` | one pod chosen |
| `sorter.bins` (e2, e6, e11) | `RouterControl` | `{assignments: [{itemKey, binId}]}` (partial) | `focus` (item key or bin) | every item assigned (e11: every visible batch; Verify needs all 7) |
| `sorter.type_match` (e5, e9) | `WaveControl` | `{answers: [{waveIndex, categoryId}]}` | `wave {index, secondsLeft, secondsPerWave}`, `hover` | after the last wave (answered or timed out) |
| `linker.pairs` (e8) | `CableControl` | `{links: [{leftKey, rightKey}]}` (partial) | `focus`, `probe` (the stage `k`) | every left linked |
| `sequencer.linear` (e10) | `SlotRailControl` | `{slots: (key \| null)[]}` | `probe` (playback `k`) | every slot filled |

**R4 · Probes (20 amendment 3).** Six stations add an **ungraded** orange scrubber, declared in the station's config
(`config.probe`, or `config.stages` for e8). The Scrubber binds to it because none of these modes has a scalar input;
its value travels as `draft.probe` and **never reaches `grade()`**. It is how a mode with no numeric input still gets
Variant's "one orange input drives the world" (checklist ★21).

**R5 · Failure detail comes from `diagnose()` (20 §2.5.4).** After a wrong Verify, `src/world/diagnose/**` returns
`failKey`, `wrongKeys` (`[0]` = the item `grade()` names), `prefix` and `probeKeys`. Every failure plan below acts on
`wrongKeys[0]` / `failKey` only. Misconception probes (`station.probes`) are evaluated only after Verify; a matched probe
key picks the `fail.byKey` line. The orders are `grade()`'s:
- mimic: `honest`, `wrongKeys = [String(statementIndex)]`;
- bins: `incomplete` (any unplaced), else `wrong_bin` with the first wrong key in `i0, i1, …` order;
- type_match: `wrong_wave`, the first wave index missing or wrong (`w<i>`);
- pairs: `incomplete`, else `wrong_link` with the first wrong left in `l0, l1, …` order;
- linear: `incomplete`, then `decoy` (the decoy key), then `order` with `prefix` = the first wrong slot.
The mimic feedback says "chest"; `feedbackNouns` shows it as "pod" in e1, e3, e4 and e7 (display only).

**R6 · Easing and chips.** The controller eases every part toward `meta.pose()` with `1 − e^(−dt/110 ms)` (95 % in about
330 ms, the bible's visible lag), unless a sim gives a physical time constant (listed per station). World chips come
from `meta.describe()` in the format `"<symbol>: <value> <unit>"` (`C_L: 4.1 mM`, `V: 74%`, `ATP: 7/s`, `d: 2.4 nm`) and
ride the part they label; panel chips ride the card's left edge at the current value (`PanelLive.chips`). All labels are
DOM (`WorldLabelLayer`).

**R7 · Pure metas and sims.** Each archetype's maths lives in `src/world/contraptions/<id>.meta.ts`; measurable state
lives in the seeded sims `src/world/sims/{bilayer-probe, diffusion-tank, osmotic-cell, pump-flume, membrane-fold}.ts`
(seed `spec.seed ^ hash32(encounterId)`). `pose()` sees the view, the draft, the probe, the clock, the aid tier and the
sim state, **never params or the solution**. Cosmetic particles (dye dots, salt cubes, motes, bubbles) live in the prefab
(20 F6).

**R8 · World state follows progress (map D3; 20 amendment 31).** On load, `skipTo`, `autoSolve` or re-entry, each solved
station renders `meta.solvedPose` (opened, drained, lifted) with no animation; the payoff terrain is merged and blockers
drop. The DOM fallback draws each skin's dormant or solved `snapshot` parts plus the full panel.

**R9 · Layouts (20 §3.1).** **Scrub** (panel 42vw; the world frames in the left 58 %) for e1, e3, e4, e5, e7, e8, e9,
e10. **Board** (55vw; world in the left 45 %) for e2, e6 and e11. There is no `sluice` layout: e5 and e9 are scrub with a
`WaveControl`. On open the camera tweens to `frameFor(meta.frameBounds, safeRect, …, station.frameZoom)` over 280 ms;
the panel slides in. **The back tab** closes the panel without grading and keeps the draft (the client caches it per
encounter), and the contraption settles back toward its dormant pose.

**R10 · Keyboard.** One key map: 20 §3.5. In the panel: ←/→ step the scrubber (Shift ×10, PgUp/PgDn a major tick,
Home/End), 1–9 quick-select claims, valves, bins and cartridges, E/Enter activates, I is a hint rung (Shift+I the
Brief sheet), Esc is back. Phaser key capture is released while a panel is focused (map D4).

**R11 · Hints act in the world (20 amendment 10).** `aidTier = min(2, max(hintsUsed, failedVerifies > 0 ? 1 : 0))`
reaches `pose`, `panelStatic` and `panelLive`; each hint rung also sends Pip to `meta.hintTargets(rung)` (an anchor from
the skin and an action: circle, land, hover or ride). Each station lists its targets and tier effects. The router skins
turn on Pip's water lens at `lensTier` 1.

**R12 · Sound.** Every cue id in this section is mapped to a synth recipe in §6.7 (20 §2.12).

### 5.P · Kit: **Specimen Pods** (`claim_holders` / `specimen_pods`; e1, e3, e4, e7)

- **In-world object.** Three pods on a low stone dais beside the console.
  - Each pod (`part.specimen_pods_pod`, hero) is 1.1 H tall: a cream pedestal with a navy band and a gold rim, a glass
    capsule (`#C9F3FF` @ 30 %) in a bronze collar, and a swirl of dormant specimen haze inside.
  - A small round **letter plate** (`part.specimen_pods_letter_plate`, kit; the letter is DOM) sits on the pedestal.
    **Letters follow display order** (`view.chests` order), never statement order.
  - A **probe emitter** (`part.specimen_pods_probe_emitter`, hero: a coiled cream stem with a cyan orb) is mounted on the
    console and aims a beam at the chosen pod (`aimer: probe_emitter`).
- **Reference apparatus.** Each encounter adds its own **reference apparatus** (the real phenomenon, running live on its
  `referenceSim`) next to the pods. That is what the ghosts are compared against.
- **Control (graded).** A **claims** card (tab "claims"): three claim rows in display order (letter + full text). Choose
  one with click or keys 1–3. **Hover and focus preview** the beam and ghost without committing (20 amendment 33).
- **Live link.** On hover or select:
  - The beam swings to that pod: emitter angle = `atan2(pod.y − e.y, pod.x − e.x)`, eased. The beam is the 20 §2.2
    three-line recipe (core 2, inner 6, outer 18, ±8 % shimmer).
  - The pod glows (`crystal.base` halo 30 %).
  - The pod projects its **claim ghost** onto the reference apparatus: a white-cyan hologram at 45 % alpha with a 1 px
    scanline shimmer at 12 Hz. The ghost is **the claim's prediction rendered faithfully** (`holders[].ghost`, from the
    sim's ghost registry, 20 §4.2). Ghost honesty is validated: the mimic's ghost is tagged `contradicts`, the others
    `matches`.
  - The real apparatus keeps running underneath, so the player compares prediction with reality.
- **Verify.** Enabled once a pod is chosen → `grade({statementIndex})`: correct iff `statementIndex === mimicIndex`.
  The Verify label names the apparatus, so the four stations differ: QUARANTINE · THAW RIDGE (e1), QUARANTINE · LEVEL
  LOCK (e3), QUARANTINE · FLOOD LOCK (e4), QUARANTINE · LIGHT HALL (e7). Badge: MIMIC QUARANTINED.
- **Success: the quarantine (0–900 ms, `config.quarantineAnim`, success-only), then the scene payoff.** Each quarantine
  acts out the concept its apparatus teaches (30 §2.6):

| t (ms) | `ridge_thaw` (e1) | `tank_dilate` (e3) | `raft_lock_flood` (e4) | `lanterns_ignite` (e7) |
|---|---|---|---|---|
| 0 | The chosen pod's glass frosts from the rim inward in hex facets (`gel.frost`). sfx `pod_fog` | The pod's bronze collar irises open, like the tank's membrane window dilating. sfx `pod_fog` | Blue water rises in the chosen capsule from its base. sfx `raft_flood` | The capsule dims; a gold ATP spark climbs the pod's collar. sfx `atp_spark` |
| 250 | The **Mimic Mote** inside (`part.specimen_pods_mimic_mote`, a jelly blob that imitates its claim) stiffens into a grey slab with evenly spaced holes: its own claim, literally | The Mote's dots march in formation toward the open collar (its claim) and lose step: each dot begins to jitter | The Mote, shaped like the salt cubes it claims crossed, stays pinned against the capsule wall while the water climbs around it | The Mote, drifting *downhill* inside the capsule (its claim), is caught by the spark and lifted *up* out of the top vent |
| 400 | The slab cracks along its holes and shatters into 12 `fx.frost_sparkle`. sfx `pod_crack`, `mote_pop` | The dots spill out evenly on all sides and fade. sfx `mote_pop` | It crenates (a scalloped outline) and pops into `fx.bubble_pop` bubbles. sfx `mote_pop` | It bursts into a gold lantern pool above the pod (`fx.lantern_pool`). sfx `lantern_lit` |
| 400 | The two honest pods hum, their rings rotating 30° with a teal glow | same | same | same |
| 900 | Badge; the ridge thaws (§5.1) | Badge; the tank evens out, the boom lifts (§5.3) | Badge; the raft lock floods (§5.4) | Badge; the 12 lanterns ignite (§5.7) |

- **Failure (non-punitive, ≤ 1.2 s; `failKey: honest`, `wrongKeys[0]` = the picked `statementIndex`).** The picked pod
  is honest:
  1. It holds bright (`hold_bright`) and its ghost snaps into perfect register with the real apparatus (alpha 45 → 80 %,
     then fades over 1.2 s). The alignment itself says "this claim matches reality".
  2. The pod chimes once (`bell_honest`) and the beam retracts.
  3. The bar shows `fail.default`, then the `grade()` feedback as the margin note ("That pod was honest: …").
  Nothing else is revealed.
- **Aid tiers (all four).** Tier ≥ 1 (`secondaryTier`): the apparatus's key feature gets a white highlight ring (e1 the
  ion at the head/tail boundary, e3 the tracer, e4 the salt cubes at the membrane, e7 the High Tank's fill line). Tier 2
  (`overlayTier`): one card annotation (listed per station). Neither depends on which pod is the Mimic.

---

### 5.1 · e1_bilayer · `truth_finder.mimic` · **Specimen Pods at the Stiff Ridge** (zone A, console x 4300, scrub)

| Binding | |
|---|---|
| Archetype / skin | `claim_holders` / `specimen_pods`; layout `scrub`; `AimControl` → `{statementIndex}` |
| Probe | `d` "probe depth", 0–5 nm, step 0.1, initial 0; `probeWorld: needle` |
| Reference sim | `bilayer_probe` (readout: tip depth, ion held 0/1, ΔG) |
| Verify / badge | QUARANTINE · THAW RIDGE / MIMIC QUARANTINED |
| Payoff | terrain / up / `ramp_forms` "thawed ridge"; blocker x 4600 with asset `living_gate.prop.stiff_ridge` |
| Parts | pods ×3, letter plates, probe emitter, `specimen_pods_needle` (hero), `specimen_pods_ion` (kit), the probe well (the pooled heads of §2.4.1), mimic mote |

- **In-world object.**
  - The three pods, and the **Probe Well**: a 400-unit stretch of healthy bilayer in front of the console with the
    **probe needle** above it (a cream-and-gold piston, 1.4 H, ending in a fine gold tip).
  - An **Na⁺ ion** (with its hydration shell) sits on the needle's tip.
  - Behind them is the **Stiff Ridge** (gel-phase membrane, 1.4 H hump, blocking the road at x 4600).
- **Graded control.** The claims card. Statements, in original index order:
  - s0 "double layer of phospholipids" (true)
  - s1 "rigid wall with fixed holes" (**mimic**, index 1)
  - s2 "interior nonpolar, blocks most ions" (true)
- **Probe.** Tab **"d"**, "probe depth", 0–5 nm, step 0.1, ruler labels 0–5. The ruler background tints the regions:
  head zones 0–1 and 4–5 in `lipid.head` at 15 %, the core 1–4 in `oil.seam` at 20 %.
- **LIVE BINDING** (px/nm = 208 / 5 = **41.6**; y_s = the anchor's y, 983):

| Source | Target | Formula |
|---|---|---|
| `draft.probe` d | needle tip y | `tipY = y_s + 41.6·d` (eased) |
| d | head *i* lateral push (fluid parting) | `Δx_i = sgn(x_i − x_n)·22·min(d,1)·exp(−(x_i − x_n)²/(2·36²))`, `Δy_i = −4·min(d,1)·exp(…)`. The heads pile up around the needle and **reseal** behind it as d decreases |
| d | tail *i* bend | `θ_i = 0.4·Δx_i/22` rad |
| d (sim `bilayer_probe`) | Na⁺ ion y | rides the tip while `d ≤ 0.9`. For `d > 0.9` it is held at the head/tail boundary (`y_s + 37`), its shell compressed 20 %, and it springs back to the surface (k = 0.2) with a small ripple each time the tip passes 0.9 nm: **the ion cannot enter the oily core** |
| time | head jitter (fluidity) | ±1.5 px at 2 Hz on every healthy head, **0** on the Stiff Ridge |
| `draft.input` / `draft.hover` statementIndex | beam + ghost | per the ghost table |
| sim readout | world chips | `d: 2.4 nm` on the needle; `ΔG: 36` on the ion |

| Ghost (`holders[i].ghost`) | What it renders | Versus reality |
|---|---|---|
| s0 `bilayer_outline` | an outline of two rows of heads and tails, exactly over the band | matches, and flows with it |
| s1 **`rigid_holed_slab`** | a rigid grey-white slab with evenly spaced round holes, drawn over the band | **stays rigid while the real heads part and reseal through it**; its holes line up with nothing. The misconception, made visible |
| s2 `core_blocks_ion` | the core band shaded "no charge" and a ghost ion bouncing off the head/tail boundary | matches the real ion's bounce |

- **Panel (scrub).**
  - Slot 0, `graph` **"polar(d)"** (white f): `P(d) = σ(8·(1−d)) + σ(8·(d−4))` (σ = logistic), high at the heads and ~0
    in the core; y ticks 0, 0.5, 1; chip "polar 0.04".
  - Slot 1, `graph` **"ΔG ion(d)"** (green g): `ΔG(d) = 40·(1 − P(d))` kJ/mol (caption "illustrative scale"); y ticks 0,
    20, 40; chip "ΔG 38".
  - Slot 2, `claims`: the three claim rows.
  - The Scrubber on the probe, tab "d", readout "2.4 nm"; the orange line crosses slots 0 and 1.
- **Success (quarantine `ridge_thaw` 900 ms, then the payoff; total ≈ 2.4 s).**
  - The probe retracts.
  - The Stiff Ridge **thaws**: a wave runs left → right over 900 ms, and each frozen head's hex-packed pose tweens into
    the fluid row, with the frost rim fading and jitter resuming.
  - The ridge tweens from 1.4 H to a 0.3 H ramp (the `payoff.terrain` points merge into the heightfield).
  - Saturation −40 % → 0 %. Pore socket 0 lights (`hub_socket`); at P1 conduit 1 lights and sends a light packet
    toward the horizon. sfx `ridge_thaw`, `conduit_on`.
  - Gradient 12 → 18 %. The player walks over the ramp.
- **Failure.** The 5.P failure; the Stiff Ridge also shivers once (`wobble`, ±2 px, 200 ms).
- **Hints in the world.** Rung 1: Pip circles `apparatus` (the probe well), 2 s. Rung 2: Pip hovers at `ghost_origin`
  (where the ghosts project). Rung 3: Pip lands on `apparatus`. Tier 1: highlight ring on the ion at the
  boundary. Tier 2: the polar card shades the head zones (`shade` annotations 0–1 and 4–5).
- **Visible misconception.** "The membrane is a solid wall with holes": the s1 ghost slab stays rigid while the real
  membrane flows through it, and the Stiff Ridge itself is what "rigid" looks like (broken, blocking, lifeless).

**Station JSON, complete with its `dialogue` object** (the worked example of assembling §4.3 rows into slots; the other
ten stations print `"dialogue"` as a pointer to their §4.3 rows):

```json
{
  "encounterId": "e1_bilayer",
  "zoneId": "zone_a",
  "consoleX": 4300,
  "consoleSurface": "ground",
  "consoleAsset": null,
  "anchor": {"x": 4500, "y": 983},
  "approachRadius": 500,
  "contraption": "claim_holders",
  "skin": "specimen_pods",
  "config": {
    "holders": [
      {"statementIndex": 0, "trace": null, "ghost": "bilayer_outline", "footprint": null},
      {"statementIndex": 1, "trace": null, "ghost": "rigid_holed_slab", "footprint": null},
      {"statementIndex": 2, "trace": null, "ghost": "core_blocks_ion", "footprint": null}
    ],
    "reference": null,
    "referenceSim": {"id": "bilayer_probe", "params": {}},
    "probe": {
      "symbol": "d",
      "label": "probe depth",
      "min": 0,
      "max": 5,
      "step": 0.1,
      "unit": "nm",
      "format": "number",
      "initial": 0,
      "stops": [],
      "window": null,
      "playback": false
    },
    "probeWorld": "needle",
    "scenarioMin": null,
    "hintPins": [],
    "fileDates": [],
    "aimer": "probe_emitter",
    "quarantineAnim": "ridge_thaw",
    "secondaryTier": 1,
    "overlayTier": 2
  },
  "objectNoun": "Specimen Pods",
  "partNouns": ["probe", "pod", "needle", "Stiff Ridge"],
  "pins": [],
  "accessories": [],
  "frameZoom": null,
  "probes": [],
  "panel": {
    "layout": "scrub",
    "inputSymbol": null,
    "verifyLabel": "QUARANTINE · THAW RIDGE",
    "successBadge": "MIMIC QUARANTINED",
    "cards": [
      {
        "slot": 0,
        "title": "polar(d)",
        "x": {"min": 0, "max": 5, "unit": "nm", "label": "d"},
        "y": {"min": 0, "max": 1, "unit": "number", "label": null},
        "hidden": false
      },
      {
        "slot": 1,
        "title": "ΔG ion(d)",
        "x": {"min": 0, "max": 5, "unit": "nm", "label": "d"},
        "y": {"min": 0, "max": 40, "unit": "number", "label": "kJ/mol"},
        "hidden": false
      }
    ]
  },
  "dialogue": {
    "approach": [
      {
        "speakerId": "pilot",
        "text": "The Stillness froze this stretch of membrane solid. Three specimen pods here, and one of them holds a Mimic.",
        "mood": "worried"
      }
    ],
    "instruction": {
      "speakerId": "pilot",
      "text": "Push the probe into the membrane and watch it. Then quarantine the pod whose claim the membrane disproves."
    },
    "tutorial": {
      "speakerId": "pilot",
      "text": "Your depth dial drives the needle. My readouts track how polar the membrane is at its tip, and what that costs an ion."
    },
    "insight": {
      "speakerId": "pilot",
      "text": "Healthy membrane parts around the needle and closes behind it. Only the frozen ridge stays stiff."
    },
    "hints": [
      {
        "speakerId": "pilot",
        "text": "Forget the textbook diagram. Watch what the heads do while the needle goes in; that's what this ground is made of."
      },
      {
        "speakerId": "pilot",
        "text": "Lipids with oily tails make a layer that flows around the probe and closes behind it. That's no wall."
      },
      {"speakerId": "pilot", "text": "The Mimic's claim: \"The membrane is a rigid wall with fixed holes in it.\""}
    ],
    "fail": {
      "default": {
        "speakerId": "pilot",
        "text": "That pod's claim held up against the real membrane. Push again, and watch which claim the heads keep breaking."
      },
      "byKey": []
    },
    "success": {
      "speakerId": "pilot",
      "text": "A membrane is not a wall. It's a film that flows, and only proteins give it doors."
    },
    "payoffLine": {
      "speakerId": "pilot",
      "text": "Mimic quarantined! And look at the ridge. It's melting back into a path.",
      "mood": "excited"
    },
    "after": []
  },
  "payoff": {
    "kind": "terrain",
    "vertical": "up",
    "anim": "ramp_forms",
    "noun": "thawed ridge",
    "blocker": {"x": 4600, "surface": "ground", "asset": "living_gate.prop.stiff_ridge"},
    "terrain": [{"surface": "ground", "points": [[4540, 983], [4800, 932], [5060, 932], [5320, 983]]}],
    "rideCutsceneId": null,
    "autoBoardMs": null,
    "feedsHub": true
  },
  "boss": null
}
```

---

### 5.2 · e2_selectivity · `sorter.bins` · **Membrane Router at the Crossing Gate** (zone A, console x 6300, board)

| Binding | |
|---|---|
| Archetype / skin | `router_lanes` / `membrane_router`; layout `board`; `RouterControl` → `{assignments}` |
| Probe | none (the choice itself moves the world) |
| Verify / badge | ROUTE CARGO / CARGO ROUTED |
| Payoff | terrain / up / `ramp_forms` "carrier rocker"; blocker x 6640 (the gate arch) |
| Parts | `crossing_gate` (hero), `gate_ring_outer`, `gate_ring_inner` (kit, requested slots), `gate_fin` (hero, requested slot), `oil_road`, `lane_mouth`, `carrier_rocker` (hero), molecule glyphs `mol_*` (kit) |

- **In-world object.** The **Crossing Yard**, which has two lanes.
  - **The Oil Road** (bin `diffuses`, "Crosses the bilayer alone", `laneId: oil_road`) is a 300-unit stretch of bare heads
    ringed by a navy inlay circle plate.
  - **The Crossing Gate** (bin `protein`, "Needs a transport protein", `laneId: crossing_gate`) is a channel protein. Its
    arch stands 2.2 H above ground and its ring body continues down through the bilayer band. It has an **outer ring**
    and an **inner selectivity ring** with 6 notches, and gold keystone fins that split to open the arch.
  - Six molecules drift in the tide above the yard.
  - At P1, Sucra paces by the Oil Road.
- **Graded control.** Sort six tokens into two bins. Items (keys by original index): i0 O₂ → diffuses, i1 CO₂ → diffuses,
  i2 Na⁺ → protein, i3 glucose → protein, i4 steroid → diffuses, i5 Cl⁻ → protein.
- **LIVE BINDING.**

| Source | Target | Formula |
|---|---|---|
| unassigned item *k* (display order) | drift in the tide | `x = X_yard − 450 + 150·k + 20·sin(0.6t + k)`, `y = y_s − 300 + 16·sin(0.9t + 2k)` |
| assigned to bin *b*, queue position *q* of *n_b* | queue above the lane mouth | `x = X_lane[b] + 56·(q − (n_b − 1)/2)`, `y = y_s − 90`, eased. X_lane: Oil Road centre (`lane_diffuses`), gate ring centre (`lane_protein`) |
| `draft.focus` on a token | world highlight | a white ring (r = 1.3× the molecule) + a name chip (`meta.label`) on that molecule |
| n_b | lane chips | `OIL ROAD: 3`, `GATE: 2`: **counts only, no capacity** (R2) |
| `aidTier ≥ lensTier` (1) | **Pip's water lens** | a cone from Pip. Every item with `polar` or `charged` true shows a **hydration shell**: 6–8 blue `#4F92E6` droplets orbiting at 1.4× its radius, 0.3 rev/s. Nonpolar molecules show none |
| any assignment | gate "listening" | the inner ring turns 10° toward the newest queued molecule (a claim render, not a verdict) |

- **Panel (board).**
  - The RouterControl palette: six molecule tokens (the glyph inside an orb, the name below).
  - Two bin cards: **"OIL ROAD · crosses the bilayer alone"** and **"CROSSING GATE · needs a transport protein"** (P2
    art: `ui.bin_bilayer`, `ui.bin_channel`). Tokens snap into a row inside the card.
  - A legend strip under the bins: +/− = charge; the droplet ring = polar shell, shown only at tier ≥ 1.
- **Success (≈ 2.2 s).**

| t (ms) | What happens |
|---|---|
| 0 | Badge **CARGO ROUTED** |
| 0–600 | Oil Road molecules sink through the heads: the heads part (the same Gaussian as e1), the molecule wobbles through the tails and emerges into the cytoplasm glimpse below with a soft green flash. sfx `slip` |
| 300–1100 | Gate molecules pass one by one: the inner ring rotates 60° per molecule and a flash shows in the pore. The glucose rides a carrier pocket (`vehicle: carrier`, success-only); at P1 **Sucra hops in with it** |
| 1100–2000 | The keystone fins split ±28° and the arch doors part. A light shaft spills out. Pore socket 1 lights. sfx `gate_open` |
| 2000 | Beyond the arch the **carrier rocker** (a big cream see-saw protein) tilts 22° and becomes the ramp to the terrace (y 813). Gradient 18 → 26 % |

- **Failure (`wrong_bin`; only `wrongKeys[0]` acts).** All molecules hold; the item `grade()` names:
  - if it is polar or charged and on the Oil Road, it drops, **bounces off the heads** (`bounce`: the heads flash
    `lipid.head.lit`, ripple, sfx `boing_soft`) and drifts back to the tide;
  - if it is nonpolar and at the gate, the selectivity ring flashes its notches, **refuses it** (`eject`: a 1-notch
    rotation back) and it drifts back.
  - The panel keeps every placement. Line: `fail.byKey[small_passes | size_rule]` when a probe matched, else
    `fail.default`; then the feedback, which names that item's bin and its feature. `incomplete` cannot occur (Verify
    needs all six).
- **Hints in the world.** Rung 1: Pip flies to `gate_ring` and turns its lens on (tier 1). Rung 2: Pip hovers over
  `lane_diffuses`. Rung 3: Pip circles `lane_protein`. Tier 1: the lens. Tier 2: the legend strip labels the shell glyph
  "polar".
- **Visible misconception.** "Anything small passes freely": Na⁺ (drawn smaller than O₂) visibly bounces off the Oil Road
  on failure, and its hydration shell (tier 1) explains why.

**Station JSON** (`world.stations[]`):

```json
{
  "encounterId": "e2_selectivity",
  "zoneId": "zone_a",
  "consoleX": 6300,
  "consoleSurface": "ground",
  "consoleAsset": null,
  "anchor": {"x": 6700, "y": 983},
  "approachRadius": 500,
  "contraption": "router_lanes",
  "skin": "membrane_router",
  "config": {
    "items": [
      {
        "key": "i0",
        "meta": {"glyph": "o2", "label": "O₂"},
        "polar": false,
        "charged": false,
        "from": null,
        "to": null,
        "vehicle": "none"
      },
      {
        "key": "i1",
        "meta": {"glyph": "co2", "label": "CO₂"},
        "polar": false,
        "charged": false,
        "from": null,
        "to": null,
        "vehicle": "none"
      },
      {
        "key": "i2",
        "meta": {"glyph": "na", "label": "Na⁺"},
        "polar": false,
        "charged": true,
        "from": null,
        "to": null,
        "vehicle": "channel"
      },
      {
        "key": "i3",
        "meta": {"glyph": "glucose", "label": "glucose"},
        "polar": true,
        "charged": false,
        "from": null,
        "to": null,
        "vehicle": "carrier"
      },
      {
        "key": "i4",
        "meta": {"glyph": "steroid", "label": "steroid"},
        "polar": false,
        "charged": false,
        "from": null,
        "to": null,
        "vehicle": "none"
      },
      {
        "key": "i5",
        "meta": {"glyph": "cl", "label": "Cl⁻"},
        "polar": false,
        "charged": true,
        "from": null,
        "to": null,
        "vehicle": "channel"
      }
    ],
    "lanes": [
      {"binId": "diffuses", "laneId": "oil_road", "year": null},
      {"binId": "protein", "laneId": "crossing_gate", "year": null}
    ],
    "lens": "hydration",
    "lensTier": 1,
    "energy": null,
    "shutters": false,
    "stamp": "none",
    "eventsBand": null,
    "eventsBandTier": 1,
    "probe": null,
    "probeWorld": "none"
  },
  "objectNoun": "Crossing Gate",
  "partNouns": ["molecule", "Oil Road", "lane", "ring"],
  "pins": [{"anchor": "gate_ring", "text": "GATE 2", "glyph": "door"}],
  "accessories": [],
  "frameZoom": null,
  "probes": [
    {"predicate": "assignedTo", "itemKey": "i2", "binId": "diffuses", "key": "small_passes"},
    {"predicate": "assignedTo", "itemKey": "i5", "binId": "diffuses", "key": "small_passes"},
    {"predicate": "assignedTo", "itemKey": "i4", "binId": "protein", "key": "size_rule"}
  ],
  "panel": {
    "layout": "board",
    "inputSymbol": null,
    "verifyLabel": "ROUTE CARGO",
    "successBadge": "CARGO ROUTED",
    "cards": []
  },
  "dialogue": "§4.3 rows for this encounter (slot column = path)",
  "payoff": {
    "kind": "terrain",
    "vertical": "up",
    "anim": "ramp_forms",
    "noun": "carrier rocker",
    "blocker": {"x": 6640, "surface": "ground", "asset": null},
    "terrain": [{"surface": "ground", "points": [[6720, 983], [6860, 813]]}],
    "rideCutsceneId": null,
    "autoBoardMs": null,
    "feedsHub": true
  },
  "boss": null
}
```

---

### 5.3 · e3_diffusion · `truth_finder.mimic` · **Specimen Pods at the Dye Tank / Balance Lock** (zone B, console x 1100, scrub)

| Binding | |
|---|---|
| Archetype / skin | `claim_holders` / `specimen_pods`; layout `scrub`; `AimControl` → `{statementIndex}` |
| Probe | `a` "dye load", 0–10 mM, step 0.5, initial 5; `probeWorld: dye_load` |
| Reference sim | `diffusion_tank` `{p: 0.3, sigma: 5}` (readout: `cL`, `cR`, flux `J`, tracer path) |
| Verify / badge | QUARANTINE · LEVEL LOCK / MIMIC QUARANTINED |
| Payoff | remove_blocker / none / `barrier_lifts` "Balance Lock boom"; blocker x 1900 |
| Parts | pods, emitter, `dye_tank` (kit), `tank_window` (kit), `balance_pillar` (kit), `balance_beam` (hero), `balance_float` ×2, `chain` |

- **In-world object.** The pods, the **Dye Tank** and the **Balance Lock**.
  - **Dye Tank:** a glass tank 780×310 in a cream frame with gold corners. It has two chambers split by a **membrane
    window**, a vertical bilayer strip with 5 pore gaps.
  - **Balance Lock:** a gold beam, 5 H long, on a cream pivot pillar that crosses the road as a boom barrier. Its ends
    hang by chains to floats in each chamber.
- **Graded control.** The claims: s0 random motion (true); s1 "head for the empty side on purpose" (**mimic**, index 1);
  s2 net high → low (true).
- **Probe.** Tab **"a"**, "dye load", 0–10 mM, step 0.5, labels 0–10.
- **Simulation (`diffusion_tank`, seeded; measurable state only).**
  - A change of *a* reloads the left chamber with `N = round(10·a)` dye particles (max 100). The right chamber empties
    and the clock resets (`sim.resetOn: probe_change`).
  - Each particle random-walks: dt = 1/30 s, Gaussian step σ = 5, reflecting walls. At the window a particle passes
    with p = 0.3 per contact.
  - Concentrations: `C_L = N_L/10`, `C_R = N_R/10` (mM). Measured net flux: `J = (crossings L→R − crossings R→L) / 2 s`
    over a sliding 2 s window.
  - **Tracer:** particle #0 has a white ring and a 60-point fading trail (it visibly doubles back toward the crowd).
- **LIVE BINDING.**

| Source | Target | Formula |
|---|---|---|
| `draft.probe` a | left chamber refill | `N = round(10a)` |
| sim `cL − cR` | Balance beam tilt | `θ = clamp(2.2°·(C_L − C_R), −18°, 18°)`, eased. Chains follow the beam ends |
| sim | floats | each chamber's float sinks ∝ C (`Δy = 6·C`) |
| sim readout | world chips | `C_L: 4.1 mM`, `C_R: 0.9 mM`, `J: +1.8/s` (arrow on the window, length `12·|J|`), `tracer` |
| statementIndex (input or hover) | ghost | the ghost table |

| Ghost | Render | Versus reality |
|---|---|---|
| s0 `random_walk` | jitter trails on 6 ghost particles, same statistics | matches |
| s1 **`purposeful_march`** | ghost particles **march in straight lines** in formation from left to right, with arrowheads, and **all stop** once the right side fills | contradicts: the real particles jitter, the tracer wanders back left, and at equilibrium the real particles keep moving |
| s2 `net_flux_arrow` | one big ghost arrow sized by the predicted `J₀ = 0.35·(C_L − C_R)` | matches the measured J chip in sign and magnitude |

- **Panel (scrub).** All three graph cards share the x-axis *a* (0–10 mM), so the orange line crosses all three.
  - Slot 0 **"C_L start"** (white f): the line y = a; chip "5.0 mM".
  - Slot 1 **"C_eq"** (green g): the line y = a/2; chip "2.5 mM".
  - Slot 2 **"J₀"** (blue h, unit "/s"): the line y = 0.35·a; chip "1.8/s".
  - **Live dots** (`live_dot` annotations) on the scrub line: on slot 0 a white dot slides from *a* down toward *a/2* as
    C_L(t) falls, and on slot 1 a green dot rises from 0 to *a/2*. The lines are the start and the destination; the
    dots are now.
  - The claims card sits under the stack.
- **Success (quarantine `tank_dilate` 900 ms, then ≈ 1.6 s).**
  - The window **dilates** (p → 1) and the sim runs at 3× until `|C_L − C_R| < 0.2`, capped at 1.2 s.
  - The beam levels to 0°, the latch clicks (sfx `latch`), and the beam lifts 85° like a boom barrier (500 ms).
  - Pore socket 2 lights; Gradient 26 → 32 %.
- **Failure.** The 5.P failure; the tracer's trail also flashes white for 1 s ("look here").
- **Hints in the world.** Rung 1: Pip circles the tracer (`apparatus`). Rung 2: Pip hovers at the window (`ghost_origin`).
  Rung 3: Pip lands on `apparatus`. Tier 1: highlight ring on the tracer. Tier 2: a dashed `hline` at y = a/2 on slot 0
  ("where it's headed").
- **Visible misconception.** "Particles move toward empty space on purpose": the s1 formation ghost against the
  wandering tracer, and the ghost stops at equilibrium while the real dye never does.

**Station JSON** (`world.stations[]`):

```json
{
  "encounterId": "e3_diffusion",
  "zoneId": "zone_b",
  "consoleX": 1100,
  "consoleSurface": "ground",
  "consoleAsset": null,
  "anchor": {"x": 1500, "y": 1213},
  "approachRadius": 500,
  "contraption": "claim_holders",
  "skin": "specimen_pods",
  "config": {
    "holders": [
      {"statementIndex": 0, "trace": null, "ghost": "random_walk", "footprint": null},
      {"statementIndex": 1, "trace": null, "ghost": "purposeful_march", "footprint": null},
      {"statementIndex": 2, "trace": null, "ghost": "net_flux_arrow", "footprint": null}
    ],
    "reference": null,
    "referenceSim": {"id": "diffusion_tank", "params": {"p": 0.3, "sigma": 5}},
    "probe": {
      "symbol": "a",
      "label": "dye load",
      "min": 0,
      "max": 10,
      "step": 0.5,
      "unit": "mM",
      "format": "number",
      "initial": 5,
      "stops": [],
      "window": null,
      "playback": false
    },
    "probeWorld": "dye_load",
    "scenarioMin": null,
    "hintPins": [],
    "fileDates": [],
    "aimer": "probe_emitter",
    "quarantineAnim": "tank_dilate",
    "secondaryTier": 1,
    "overlayTier": 2
  },
  "objectNoun": "Balance Lock",
  "partNouns": ["pod", "tank", "dye", "Dye Tank"],
  "pins": [],
  "accessories": [],
  "frameZoom": null,
  "probes": [],
  "panel": {
    "layout": "scrub",
    "inputSymbol": null,
    "verifyLabel": "QUARANTINE · LEVEL LOCK",
    "successBadge": "MIMIC QUARANTINED",
    "cards": [
      {
        "slot": 0,
        "title": "C_L start",
        "x": {"min": 0, "max": 10, "unit": "mM", "label": "a"},
        "y": {"min": 0, "max": 10, "unit": "mM", "label": null},
        "hidden": false
      },
      {
        "slot": 1,
        "title": "C_eq",
        "x": {"min": 0, "max": 10, "unit": "mM", "label": "a"},
        "y": {"min": 0, "max": 10, "unit": "mM", "label": null},
        "hidden": false
      },
      {
        "slot": 2,
        "title": "J₀",
        "x": {"min": 0, "max": 10, "unit": "mM", "label": "a"},
        "y": {"min": 0, "max": 4, "unit": "rate", "label": "/s"},
        "hidden": false
      }
    ]
  },
  "dialogue": "§4.3 rows for this encounter (slot column = path)",
  "payoff": {
    "kind": "remove_blocker",
    "vertical": "none",
    "anim": "barrier_lifts",
    "noun": "Balance Lock boom",
    "blocker": {"x": 1900, "surface": "ground", "asset": null},
    "terrain": [],
    "rideCutsceneId": null,
    "autoBoardMs": null,
    "feedsHub": true
  },
  "boss": null
}
```

---

### 5.4 · e4_osmosis · `truth_finder.mimic` · **Specimen Pods at the Osmometer Basin / Raft Lock** (zone B, console x 3100, scrub)

| Binding | |
|---|---|
| Archetype / skin | `claim_holders` / `specimen_pods`; layout `scrub`; `AimControl` → `{statementIndex}` |
| Probe | `s` "bath salt", 0–10 %, step 0.1, initial 6; `probeWorld: bath_salt`; `scenarioMin: 2.5` |
| Reference sim | `osmotic_cell` `{cIn: 2, b: 0.3}` (readout: `V/V₀`, water flux sign) |
| Verify / badge | QUARANTINE · FLOOD LOCK / MIMIC QUARANTINED |
| Payoff | ride / up / `water_rises` "raft"; `rideCutsceneId: e4_raft`, `autoBoardMs: 6000`; no blocker (the raft-lock cliff at x 3884 is a sheer rise) |
| Parts | pods, emitter, `basin` (kit), `test_cell` (hero), `raft_lock` (kit); the raft vehicle `prop.raft` |

- **In-world object.** The pods, the **Osmometer Basin** and the **Raft Lock**.
  - **Osmometer Basin:** a glass basin (620×300) holding the **Test Cell**. The cell is 1.6 H across, with a membrane
    ring of tiny heads, peach cytoplasm, a nucleus dot, and **inside salt fixed at 2 %** (4 white cubes inside) in a bath
    of salt water.
  - **Raft Lock:** a 3 H shaft next to the basin (x 3780), separated from it by a **membrane window**. It is dry, with a
    cream raft on its floor at road level, and the raft ledge sits 2 H above (y 873).
- **Graded control.** The claims: s0 water leaves toward the saltier side (true); s1 "salt rushes in until both match"
  (**mimic**, index 1); s2 the cell shrinks (true).
- **Probe.** Tab **"s"**, "bath salt", 0–10 %, step 0.1, labels 0–10. The claims card carries the scenario line "Claims
  are about a SALTY bath (s > 2 %)". Ghosts project only when `s > scenarioMin` (2.5). Below that the pods dim and read
  "outside the claim's scenario", which is itself a lesson in conditions. A static pin "ISO 2%" (glyph `drop`) marks the
  isotonic point on the basin.
- **LIVE BINDING** (C_in = 2 %, b = 0.3 osmotically inactive fraction; sim `osmotic_cell`):

| Source | Target | Formula |
|---|---|---|
| `draft.probe` s | cell volume | `V/V₀ = b + (1 − b)·C_in / max(s, 0.3)`, clamp [0.55, 1.6]; radius `r = r₀·√(V/V₀)`; the sim's own time constant (osmosis looks deliberate, ≤ 0.4 s) |
| V | cell surface | V < 0.8: **crenation**, a scalloped outline with amplitude `6·(0.8 − V)/0.25`, 14 lobes. V > 1.3: a strained highlight ring and a faint `#FFFFFF` stretch sheen |
| s | water droplets | droplets cross the cell membrane at `w = 6·(s − C_in)` per s. Positive → outward (arrows out), negative → inward. `fn.h` blue |
| s | salt cubes outside | count `8·s` (max 80), random walk, **reflect off the cell membrane with a tiny spark** (they never cross) |
| sim readout | world chips | `salt: 6.0%` on the bath, `V: 74%` on the cell, `water: out` beside the droplet stream |
| statementIndex | ghost | the table below |

| Ghost | Render | Versus reality |
|---|---|---|
| s0 `water_out_arrows` | blue ghost arrows pointing out of the cell | matches for s > 2 |
| s1 **`salt_inflow`** | ghost salt cubes **streaming into** the cell, and a ghost inside-salt level rising to meet the bath | contradicts: the real cubes bounce off every time, and the inside stays at 4 cubes |
| s2 `shrink_outline` | a smaller ghost outline | matches the eased real radius |

- **Panel (scrub).** Shared x = s (0–10 %).
  - Slot 0 **"salt outside"** (white f): the line; chip "6.0%".
  - Slot 1 **"salt inside"** (green g): a flat line at 2; chip "2.0%".
  - Slot 2 **"V/V₀(s)"** (blue h): the decreasing curve; chip "0.74".
  - The claims card.
- **Success (quarantine `raft_lock_flood` 900 ms, then the ride; ≈ 2.4 s + the ride).**
  - `payoffLine` "…Step aboard!"; the raft glows. The payoff waits for the player to step on it for at most 6 s
    (`autoBoardMs`); after that Pip tows them on automatically and `e4_raft` runs.
  - Salt cubes pour into the Raft Lock (40 cubes, 400 ms).
  - Blue droplets stream from the basin through the membrane window **toward the salt** (osmosis, 1.6 s).
  - The lock's water level rises 0 → 2 H and the raft (with the player locked to it) floats up to the ledge (x 3960).
  - Pore socket 3 lights; Gradient 32 → 40 %.
- **Failure.** The 5.P failure; three bath cubes also flash as they bounce.
- **Hints in the world.** Rung 1: Pip circles the salt cubes at the membrane (`apparatus`). Rung 2: Pip hovers at the
  window (`ghost_origin`). Rung 3: Pip lands on `apparatus`. Tier 1: highlight ring on the bouncing cubes. Tier 2: a
  dashed `vline` at s = 2 labelled "isotonic" on slots 0 and 2.
- **Visible misconception.** "Salt crosses instead of water": every salt cube bounces, and the s1 ghost streams them in.

**Station JSON** (`world.stations[]`):

```json
{
  "encounterId": "e4_osmosis",
  "zoneId": "zone_b",
  "consoleX": 3100,
  "consoleSurface": "ground",
  "consoleAsset": null,
  "anchor": {"x": 3500, "y": 1213},
  "approachRadius": 500,
  "contraption": "claim_holders",
  "skin": "specimen_pods",
  "config": {
    "holders": [
      {"statementIndex": 0, "trace": null, "ghost": "water_out_arrows", "footprint": null},
      {"statementIndex": 1, "trace": null, "ghost": "salt_inflow", "footprint": null},
      {"statementIndex": 2, "trace": null, "ghost": "shrink_outline", "footprint": null}
    ],
    "reference": null,
    "referenceSim": {"id": "osmotic_cell", "params": {"cIn": 2, "b": 0.3}},
    "probe": {
      "symbol": "s",
      "label": "bath salt",
      "min": 0,
      "max": 10,
      "step": 0.1,
      "unit": "%",
      "format": "number",
      "initial": 6,
      "stops": [],
      "window": null,
      "playback": false
    },
    "probeWorld": "bath_salt",
    "scenarioMin": 2.5,
    "hintPins": [],
    "fileDates": [],
    "aimer": "probe_emitter",
    "quarantineAnim": "raft_lock_flood",
    "secondaryTier": 1,
    "overlayTier": 2
  },
  "objectNoun": "Osmometer Basin",
  "partNouns": ["pod", "test cell", "bath", "raft"],
  "pins": [{"anchor": "apparatus", "text": "ISO 2%", "glyph": "drop"}],
  "accessories": [],
  "frameZoom": null,
  "probes": [],
  "panel": {
    "layout": "scrub",
    "inputSymbol": null,
    "verifyLabel": "QUARANTINE · FLOOD LOCK",
    "successBadge": "MIMIC QUARANTINED",
    "cards": [
      {
        "slot": 0,
        "title": "salt outside",
        "x": {"min": 0, "max": 10, "unit": "percent", "label": "s"},
        "y": {"min": 0, "max": 10, "unit": "percent", "label": null},
        "hidden": false
      },
      {
        "slot": 1,
        "title": "salt inside",
        "x": {"min": 0, "max": 10, "unit": "percent", "label": "s"},
        "y": {"min": 0, "max": 10, "unit": "percent", "label": null},
        "hidden": false
      },
      {
        "slot": 2,
        "title": "V/V₀(s)",
        "x": {"min": 0, "max": 10, "unit": "percent", "label": "s"},
        "y": {"min": 0, "max": 1.6, "unit": "number", "label": null},
        "hidden": false
      }
    ]
  },
  "dialogue": "§4.3 rows for this encounter (slot column = path)",
  "payoff": {
    "kind": "ride",
    "vertical": "up",
    "anim": "water_rises",
    "noun": "raft",
    "blocker": null,
    "terrain": [],
    "rideCutsceneId": "e4_raft",
    "autoBoardMs": 6000,
    "feedsHub": true
  },
  "boss": null
}
```

---

### 5.5 · e5_tonicity · `sorter.type_match` · **Tonicity Sluices** (zone B, console x 5200, scrub + waves)

| Binding | |
|---|---|
| Archetype / skin | `sluice_waves` / `tonicity_sluices`; layout `scrub`; `WaveControl` → `{answers}` (+ `wave`, `hover`) |
| Probe | none (the wave timer is the continuous element) |
| Verify / badge | DRAIN THE SLUICE / SLUICE DRAINED |
| Payoff | terrain / up / `steps_emerge` "carved steps"; blocker x 5400 (the flooded trench); the drop link `b_trench_drop` requires e5 |
| Parts | `label_lock`, `lock_leaf` (requested slot), `valve_wheel` (hero), `basin` ×3, `eddy`, `cell_rbc` / `cell_plant` / `cell_potato` (hero), `cell_generic` / `cell_protoplast` (kit), `barge` (e9 only); the emerged steps are the prop `sluice_steps` (state `revealed`) |

- **In-world object.** The **sluice trench** (x 5400–6600), flooded 1.5 H deep.
  - A canal crosses it with one **Label Lock**: a stone chamber with gates at both ends and a big bronze **valve wheel**
    above, three spokes each ending in a plaque (HYPO / ISO / HYPER, DOM labels).
  - Downstream are three **holding basins** and the **Eddy**, an unlabelled swirl basin for timeouts.
  - Cells drift in from the left canal mouth. Poro watches from x 5080.
- **Graded control.** Three **valves** (Hypotonic / Isotonic / Hypertonic; keys 1–3), **one wave at a time**,
  `secondsPerWave = 8`. The `WaveControl` enables Verify only after the last wave; a timed-out wave counts as a miss
  (the same semantics as `WavesPick`); after a failed Verify the waves replay **with the previous answers preselected**
  (Enter confirms each), so a retry is five keypresses, not 40 s of waiting.
- **Waves** (`config.waves`, keyed by `waveIndex`; the text is the view's):

| wave | text (view) | `cell`, `inDots`, `outDots` | `fate` (stated in the text, so animated live; `showFate: true`) |
|---|---|---|---|
| w0 | RBC in pure water, swelling | `rbc`, 10, 0 | `swell` `ΔV = +0.45` |
| w1 | cell in seawater, shrivelling | `generic`, 10, 30 | `shrink` `ΔV = −0.30`, crenate |
| w2 | cell in a matching solution, unchanged | `generic`, 10, 10 | `steady` |
| w3 | plant cell in salty soil water, losing turgor | `plant`, 10, 28 | `plasmolysis`: the protoplast pulls away from the rigid wall, inner `ΔV = −0.3` |
| w4 | cell in a dilute drink, about to burst | `generic`, 10, 2 | `strain`: swell `ΔV = +0.55` with a strain ring |

- **LIVE BINDING.**

| Source | Target | Formula |
|---|---|---|
| `draft.wave.secondsLeft` (T = 8) | cell position | `x = X_in + (1 − secondsLeft/T)·(X_out − X_in)`, continuous (interpolated between ticks) |
| wave time | cell volume (stated fate) | `V(t) = 1 + ΔV·(1 − secondsLeft/T)` |
| `draft.hover` / focus of valve c | lock bath (claim render) | the lock bath's solute dot density `ρ_out = ρ_in·k_c` with `valves[c].densityK` = hypo 0.25, iso 1, hyper 2.5 (dots fade in and out over 200 ms). The valve wheel rotates to −60°, 0° or +60° |
| hover c | `bars` card | f bar = the claimed outside level, g bar = the wave's `inDots`. **No water arrows on hover** (`arrows: none`; arrows would do the reasoning, R2) |
| commit c | lock | the plaque for c slides down onto the cell's tag, the downstream gate opens, and the cell floats into basin c |
| timeout | lock | the cell drifts into the **Eddy** (it spins slowly) |

- **Panel (scrub).**
  - A **wave queue** strip at the top: 5 cell tokens (the current one highlighted; answered ones carry their chosen tag).
  - Slot 0 `bars` **"solute outside"** (the claim, white); slot 1 `bars` **"solute inside"** (given, green); slot 2 `bars`
    **"volume V(t)"** (blue): a sparkline over the wave's 8 s with a thin **white** timer line (not orange: the timer is
    not input).
  - A timer ring around the valve cluster; three big valve buttons.
- **Success (≈ 2.2 s).**
  - Badge **SLUICE DRAINED**.
  - The basin gates open and each cell drifts out, completing its fate.
  - The trench water drains (level −1.5 H over 1.4 s, with a whirlpool at the drain grate; sfx `sluice_drain`).
  - This reveals the **carved steps** on the far wall (`payoff.terrain` merges; `sluice_steps` → `revealed`) and, at P1,
    the **side stair** to the garden alcove (`side_stair` → `revealed`).
  - Poro opens his eyes fully (`poro_2`). Pore socket 4 lights; Gradient 40 → 48 %. The player drops in and climbs out.
- **Failure (`wrong_wave`; only `wrongKeys[0]` = `w<i>` acts).** That wave's cell floats back into the Label Lock and its
  tag blinks. Line: `fail.byKey[hyper_more_water]` when the probe matched, else `fail.default`; then the feedback, which
  names that wave's category and why, so the world may now show that cell's correct bath density (`disclosed`).
- **Hints in the world.** Rung 1: Pip hovers over `lock` (the bath). Rung 2: Pip circles the current cell (`lock`).
  Rung 3: Pip lands on `valve`. Tier 1: the bars card labels its two bars "bath" and "cell". Tier 2: an `hline` at the
  cell's inside level on slot 0.
- **Visible misconception.** "Hypertonic means more water": on hover, HYPER floods the lock with **more solute dots, not
  more water**, and the f bar towers over the g bar.

**Station JSON** (`world.stations[]`):

```json
{
  "encounterId": "e5_tonicity",
  "zoneId": "zone_b",
  "consoleX": 5200,
  "consoleSurface": "ground",
  "consoleAsset": null,
  "anchor": {"x": 5600, "y": 1213},
  "approachRadius": 500,
  "contraption": "sluice_waves",
  "skin": "tonicity_sluices",
  "config": {
    "waves": [
      {"waveIndex": 0, "cell": "rbc", "inDots": 10, "outDots": 0, "fate": "swell", "showFate": true},
      {"waveIndex": 1, "cell": "generic", "inDots": 10, "outDots": 30, "fate": "shrink", "showFate": true},
      {"waveIndex": 2, "cell": "generic", "inDots": 10, "outDots": 10, "fate": "steady", "showFate": true},
      {"waveIndex": 3, "cell": "plant", "inDots": 10, "outDots": 28, "fate": "plasmolysis", "showFate": true},
      {"waveIndex": 4, "cell": "generic", "inDots": 10, "outDots": 2, "fate": "strain", "showFate": true}
    ],
    "valves": [
      {"categoryId": "hypotonic", "densityK": 0.25, "arrows": "none"},
      {"categoryId": "isotonic", "densityK": 1, "arrows": "none"},
      {"categoryId": "hypertonic", "densityK": 2.5, "arrows": "none"}
    ]
  },
  "objectNoun": "Label Lock",
  "partNouns": ["lock", "valve", "bath", "cell"],
  "pins": [],
  "accessories": [],
  "frameZoom": null,
  "probes": [
    {"predicate": "assignedTo", "itemKey": "w0", "binId": "hypertonic", "key": "hyper_more_water"},
    {"predicate": "assignedTo", "itemKey": "w4", "binId": "hypertonic", "key": "hyper_more_water"}
  ],
  "panel": {
    "layout": "scrub",
    "inputSymbol": null,
    "verifyLabel": "DRAIN THE SLUICE",
    "successBadge": "SLUICE DRAINED",
    "cards": [
      {"slot": 0, "title": "solute outside", "x": null, "y": null, "hidden": false},
      {"slot": 1, "title": "solute inside", "x": null, "y": null, "hidden": false},
      {
        "slot": 2,
        "title": "volume V(t)",
        "x": {"min": 0, "max": 8, "unit": "seconds", "label": "t"},
        "y": {"min": 0, "max": 1.6, "unit": "number", "label": null},
        "hidden": false
      }
    ]
  },
  "dialogue": "§4.3 rows for this encounter (slot column = path)",
  "payoff": {
    "kind": "terrain",
    "vertical": "up",
    "anim": "steps_emerge",
    "noun": "carved steps",
    "blocker": {"x": 5400, "surface": "ground", "asset": null},
    "terrain": [
      {
        "surface": "ground",
        "points": [[6360, 1468], [6400, 1426], [6440, 1383], [6480, 1340], [6520, 1298], [6560, 1255], [6600, 1213]]
      }
    ],
    "rideCutsceneId": null,
    "autoBoardMs": null,
    "feedsHub": true
  },
  "boss": null
}
```

---

### 5.6 · e6_facilitated · `sorter.bins` · **Threshold Router at the Carrier Door** (zone B, console x 7500, board)

| Binding | |
|---|---|
| Archetype / skin | `router_lanes` / `carrier_lanes`; layout `board`; `RouterControl` → `{assignments}` |
| Probe | none |
| Verify / badge | OPEN THE THRESHOLD / THRESHOLD OPEN |
| Payoff | carry / none / `door_carries` "Carrier Door" → `zone_c` (`rideCutsceneId: e6_carry`); blocker x 7800 |
| Parts | `carrier_door` (hero), `glide_gate` (kit), `pump_gate` (hero), `ramp_wedge` (kit), cargo glyphs (`membrane_router_mol_*`, `fx.mol_water`), the ATP pipe; façade `prop.hall_facade` (kit) |

- **In-world object.** The **Threshold Yard**.
  - The Pump Hall's **Carrier Door**: a revolving cream drum 2.4 H tall with one cargo pocket and gold hinge rings, set
    into the hall's façade (navy bands, three ring windows).
  - To its left, the **Glide Gate** (bin `passive`, `laneId: glide_gate`): a channel ring and a small carrier rocker at
    the foot of a **downhill ramp**.
  - To its right, the **Pump Gate** (bin `active`, `laneId: pump_gate`): a compact gold-trimmed pump with an **ATP pipe**
    at the top of an **uphill ramp**.
  - Five cargo items float, each over its own little **gradient ramp** (`ramp_wedge`; the dense-dot end is the crowded
    side).
- **Graded control.** Sort five cards into two bins: i0 glucose via carrier, high → low (passive); i1 water via
  aquaporin (passive); i2 Na⁺ pumped out, against (active); i3 K⁺ leaking out via channel, high → low (passive); i4 H⁺
  into an acidic compartment (active).
- **LIVE BINDING.**

| Source | Target | Formula |
|---|---|---|
| item `{from, to}` (config) | gradient ramp under the cargo | slope `m = (C_to − C_from)/10`, drawn 120 wide, rising where the cargo goes toward more crowding. It shows the text's stated direction (the concept visualised, not the answer). i1's text states no direction, so its `from`/`to` are null and it floats over a flat plinth |
| assignment → bin | cargo position | glides to its gate's queue (the e2 queue formula) |
| n_active | `energy_cells` card (claim render) | the reserve of 10 gold cells (`energy.reserve`); `n_active` cells hatched as "would spend" |
| n_active | Pump Gate intake glow | alpha `0.2 + 0.15·n_active` |
| `draft.focus` | cargo highlight | a white ring + a chip with the cargo's short name (`meta.label`) |

- **Panel (board).**
  - The palette holds 5 cargo cards (a mini ramp icon + text).
  - Bins: **"GLIDE GATE · passive, no ATP"** (P2 art `ui.bin_carrier`) and **"PUMP GATE · active, costs ATP"** (P2 art
    `ui.bin_pump`).
  - Slot 0 `energy_cells` **"ATP"** (gold): 10 cells, the projected-spend hatch, chip "−2".
- **Success (≈ 2.5 s, then the carry).**
  - Badge **THRESHOLD OPEN**.
  - The passive cargo slides **down** its ramp through the Glide Gate: water beads through the channel in single file,
    K⁺ through the channel, and glucose rides the carrier rocker (a 180° rock) **with no spark** (`vehicle`,
    success-only).
  - The active cargo is lifted **up** its ramp by the pump, each with a gold ATP spark. The ATP card spends 2 cells.
  - The **Carrier Door** revolves 180° with the player (and, at P1, Sucra) in its pocket; `e6_carry` fades into zone C.
  - Pore socket 5 lights; Gradient 48 → 56 %.
- **Failure (`wrong_bin`; only `wrongKeys[0]` acts).**
  - A passive cargo in the Pump Gate: the pump fires an ATP spark that **fizzles** (`spark`), and the cargo rolls away
    down its own ramp. Energy is wasted on something that would have gone downhill anyway.
  - An active cargo in the Glide Gate: it creeps up its ramp, stalls, and **slides back** (`stall`).
  - Line: `fail.byKey[protein_costs_atp]` when a probe matched, else `fail.default`; then the feedback.
- **Hints in the world.** Rung 1: Pip circles the Glide Gate's ramp (`lane_passive`). Rung 2: Pip hovers at `atp_port`.
  Rung 3: Pip lands on `lane_active`. Tier 1: every ramp shows a white arrow along its slope. Tier 2: the ATP card
  captions "spent only uphill".
- **Visible misconception.** "A protein means energy": the glucose carrier and the aquaporin visibly move cargo **with
  zero sparks**, and the ATP card drains only for uphill cargo.

**Station JSON** (`world.stations[]`):

```json
{
  "encounterId": "e6_facilitated",
  "zoneId": "zone_b",
  "consoleX": 7500,
  "consoleSurface": "ground",
  "consoleAsset": null,
  "anchor": {"x": 7900, "y": 1213},
  "approachRadius": 500,
  "contraption": "router_lanes",
  "skin": "carrier_lanes",
  "config": {
    "items": [
      {
        "key": "i0",
        "meta": {"glyph": "glucose", "label": "glucose"},
        "polar": null,
        "charged": null,
        "from": 8,
        "to": 2,
        "vehicle": "carrier"
      },
      {
        "key": "i1",
        "meta": {"glyph": "water", "label": "water"},
        "polar": null,
        "charged": null,
        "from": null,
        "to": null,
        "vehicle": "channel"
      },
      {
        "key": "i2",
        "meta": {"glyph": "na", "label": "Na⁺"},
        "polar": null,
        "charged": null,
        "from": 2,
        "to": 8,
        "vehicle": "pump"
      },
      {
        "key": "i3",
        "meta": {"glyph": "k", "label": "K⁺"},
        "polar": null,
        "charged": null,
        "from": 8,
        "to": 2,
        "vehicle": "channel"
      },
      {
        "key": "i4",
        "meta": {"glyph": "h", "label": "H⁺"},
        "polar": null,
        "charged": null,
        "from": 2,
        "to": 8,
        "vehicle": "pump"
      }
    ],
    "lanes": [
      {"binId": "passive", "laneId": "glide_gate", "year": null},
      {"binId": "active", "laneId": "pump_gate", "year": null}
    ],
    "lens": "none",
    "lensTier": 1,
    "energy": {"reserve": 10},
    "shutters": false,
    "stamp": "none",
    "eventsBand": null,
    "eventsBandTier": 1,
    "probe": null,
    "probeWorld": "none"
  },
  "objectNoun": "Carrier Door",
  "partNouns": ["cargo", "pump", "Glide Gate", "Pump Gate"],
  "pins": [],
  "accessories": [],
  "frameZoom": null,
  "probes": [
    {"predicate": "assignedTo", "itemKey": "i0", "binId": "active", "key": "protein_costs_atp"},
    {"predicate": "assignedTo", "itemKey": "i1", "binId": "active", "key": "protein_costs_atp"},
    {"predicate": "assignedTo", "itemKey": "i3", "binId": "active", "key": "protein_costs_atp"}
  ],
  "panel": {
    "layout": "board",
    "inputSymbol": null,
    "verifyLabel": "OPEN THE THRESHOLD",
    "successBadge": "THRESHOLD OPEN",
    "cards": [{"slot": 0, "title": "ATP", "x": null, "y": null, "hidden": false}]
  },
  "dialogue": "§4.3 rows for this encounter (slot column = path)",
  "payoff": {
    "kind": "carry",
    "vertical": "none",
    "anim": "door_carries",
    "noun": "Carrier Door",
    "blocker": {"x": 7800, "surface": "ground", "asset": null},
    "terrain": [],
    "rideCutsceneId": "e6_carry",
    "autoBoardMs": null,
    "feedsHub": true
  },
  "boss": null
}
```

---

### 5.7 · e7_active · `truth_finder.mimic` · **Specimen Pods at the Uphill Flume** (zone C, console x 900, scrub)

| Binding | |
|---|---|
| Archetype / skin | `claim_holders` / `specimen_pods`; layout `scrub`; `AimControl` → `{statementIndex}` |
| Probe | `r` "ATP feed", 0–10 ATP/s, step 0.5, initial 0; `probeWorld: atp_feed` |
| Reference sim | `pump_flume` (readout: `cHigh`, `cLow`, stroke phase) |
| Verify / badge | QUARANTINE · LIGHT HALL / MIMIC QUARANTINED |
| Payoff | ride / up / `lift_moves` "gantry lift" (`rideCutsceneId: e7_gantry`, to `pump_deck`); no blocker (the deck is reachable only by the gantry) |
| Parts | pods, emitter, `low_tank`, `high_tank` (kit), `flume_pump` (hero), `lantern` ×12 (kit), the ATP pipe; vehicle `prop.gantry_platform` |

- **In-world object.** The pods, and the **Uphill Flume** (anchor x 1400).
  - **Low Tank:** left, on the floor. **High Tank:** right, raised 1.2 H on a cream plinth.
  - Between them a gold-trimmed **pump** with an **ATP feed pipe** from the ceiling rail, plus a **leak channel** (a
    passive return trough from high to low).
  - Na⁺ motes fill both tanks. Twelve dark **ATP lanterns** line the walls, and the **gantry lift** waits on gold rails
    at x 1840.
- **Graded control.** The claims: s0 against the gradient (true); s1 costs ATP (true); s2 "always downhill, pumps just
  speed it up" (**mimic**, index 2).
- **Probe.** Tab **"r"**, "ATP feed", 0–10 ATP/s, step 0.5.
- **Model (`pump_flume`).** `ΔC_ss(r) = 0.96·r` mM (clamp 9.6), `C_high,ss = 5 + ΔC/2`, `C_low,ss = 5 − ΔC/2`. Tanks
  relax toward the steady state with τ = 1.2 s. The pump moves `0.8·r` motes/s uphill, each with a gold spark. The leak
  returns `0.35·(C_high − C_low)` motes/s down the trough. **At r = 0 the gap collapses**: this is the Stillness, shown in
  miniature.
- **LIVE BINDING.**

| Source | Target | Formula |
|---|---|---|
| `draft.probe` r | pump piston | stroke frequency `0.4·r` Hz, a gold spark per stroke |
| r | ATP pipe | glow alpha `0.15 + 0.08·r`, with light packets flowing down the pipe at speed ∝ r |
| sim readout | tank fills | mote counts `= 8·C`, fill-level lines + chips `C_high: 8.6 mM`, `C_low: 1.4 mM` |
| r | chip | `ATP: 7/s` on the pipe |
| statementIndex | ghost | the table below |

| Ghost | Render | Versus reality |
|---|---|---|
| s0 `uphill_arrow` | a ghost arrow low → high through the pump | matches when r > 0 |
| s1 `atp_sparks` | ghost gold sparks at the pump, one per stroke | matches |
| s2 **`downhill_boost`** | ghost motes **pushed from High to Low** faster as r rises, and a **ghost curve** (`ghost` plot style) on slot 0 that **falls** with r | contradicts: the real High Tank climbs with r, and the real curve rises |

- **Panel (scrub).** Shared x = r (0–10 ATP/s).
  - Slot 0 **"C_high(r)"** (white f): rising, y 0–10 mM.
  - Slot 1 **"C_low(r)"** (green g): falling.
  - Slot 2 **"ATP spent/s"** (gold, in the h position): a gold line.
  - Chips and the claims card.
- **Success (quarantine `lanterns_ignite` 900 ms, then ≈ 1.5 s + the ride).**
  - The 12 **lanterns ignite** in sequence (80 ms apart, gold additive pools on the walls), and the hall re-saturates.
  - The gold rails light, and the **gantry lift** powers: `e7_gantry` raises its platform 2 H to the pump deck with the
    player aboard (1.4 s).
  - Pore socket 6 lights; Gradient 56 → 64 %. At P1 Kay cheers.
- **Failure.** The 5.P failure; the flume also stutters once (the piston skips a stroke, `stall`).
- **Hints in the world.** Rung 1: Pip circles the tanks (`apparatus`). Rung 2: Pip hovers at the leak trough
  (`ghost_origin`). Rung 3: Pip lands on `apparatus`. Tier 1: highlight ring on the High Tank's fill line. Tier 2: a
  `marker` at r = 0 on slot 0 labelled "the Stillness".
- **Visible misconception.** "Transport always goes down the gradient": set r = 0 and the gradient collapses. Only
  paying ATP holds cargo uphill.

**Station JSON** (`world.stations[]`):

```json
{
  "encounterId": "e7_active",
  "zoneId": "zone_c",
  "consoleX": 900,
  "consoleSurface": "ground",
  "consoleAsset": null,
  "anchor": {"x": 1400, "y": 1213},
  "approachRadius": 500,
  "contraption": "claim_holders",
  "skin": "specimen_pods",
  "config": {
    "holders": [
      {"statementIndex": 0, "trace": null, "ghost": "uphill_arrow", "footprint": null},
      {"statementIndex": 1, "trace": null, "ghost": "atp_sparks", "footprint": null},
      {"statementIndex": 2, "trace": null, "ghost": "downhill_boost", "footprint": null}
    ],
    "reference": null,
    "referenceSim": {"id": "pump_flume", "params": {}},
    "probe": {
      "symbol": "r",
      "label": "ATP feed",
      "min": 0,
      "max": 10,
      "step": 0.5,
      "unit": "ATP/s",
      "format": "number",
      "initial": 0,
      "stops": [],
      "window": null,
      "playback": false
    },
    "probeWorld": "atp_feed",
    "scenarioMin": null,
    "hintPins": [],
    "fileDates": [],
    "aimer": "probe_emitter",
    "quarantineAnim": "lanterns_ignite",
    "secondaryTier": 1,
    "overlayTier": 2
  },
  "objectNoun": "Uphill Flume",
  "partNouns": ["pod", "pump", "tanks", "feed"],
  "pins": [],
  "accessories": [],
  "frameZoom": null,
  "probes": [],
  "panel": {
    "layout": "scrub",
    "inputSymbol": null,
    "verifyLabel": "QUARANTINE · LIGHT HALL",
    "successBadge": "MIMIC QUARANTINED",
    "cards": [
      {
        "slot": 0,
        "title": "C_high(r)",
        "x": {"min": 0, "max": 10, "unit": "rate", "label": "r"},
        "y": {"min": 0, "max": 10, "unit": "mM", "label": null},
        "hidden": false
      },
      {
        "slot": 1,
        "title": "C_low(r)",
        "x": {"min": 0, "max": 10, "unit": "rate", "label": "r"},
        "y": {"min": 0, "max": 10, "unit": "mM", "label": null},
        "hidden": false
      },
      {
        "slot": 2,
        "title": "ATP spent/s",
        "x": {"min": 0, "max": 10, "unit": "rate", "label": "r"},
        "y": {"min": 0, "max": 10, "unit": "rate", "label": null},
        "hidden": false
      }
    ]
  },
  "dialogue": "§4.3 rows for this encounter (slot column = path)",
  "payoff": {
    "kind": "ride",
    "vertical": "up",
    "anim": "lift_moves",
    "noun": "gantry lift",
    "blocker": null,
    "terrain": [],
    "rideCutsceneId": "e7_gantry",
    "autoBoardMs": null,
    "feedsHub": true
  },
  "boss": null
}
```

---

### 5.8 · e8_pump · `linker.pairs` · **Pump Rewiring** (zone C, console x 2900 on `pump_deck`, scrub)

| Binding | |
|---|---|
| Archetype / skin | `stage_machine` / `pump_rewiring`; layout `scrub`; `CableControl` → `{links}` |
| Probe | `config.stages`: `k` "pump stage", 0–6, integer stops (rest · bind Na⁺ · ATP · flip out · swap · drop P · flip in); `probeWorld` is the stage itself |
| Verify / badge | RUN ONE CYCLE / PUMP CYCLING |
| Payoff | remove_blocker / none / `gate_lifts` "Hall Gate"; blocker x 4020 on the floor; `c_deck_ladder` requires e8 |
| Parts | `pump_housing`, `drum`, `jaw_upper` (hero), `jaw_lower` (kit), `socket` ×4, `cartridge` ×5, `beacon_tower`, `hall_gate` (kit); plinth and rack props |

- **In-world object.** **The Na⁺/K⁺ pump**, 3.5 H, spanning the deck's bilayer floor from above ground to below.
  - An **outer housing** (cream stone, navy bands, gold rim) with an **upper jaw** (opens outward to the extracellular
    side) and a **lower jaw** (opens to the cytoplasm).
  - An **inner drum** (rotates in 60° steps) carrying **Na⁺ sockets** (coral) and **K⁺ sockets** (violet).
  - An **ATP port** (gold), fed by a rail pipe.
  - A **control plinth** at left with **4 cable sockets** (the lefts), and a **cartridge rack** at right with **5 value
    cartridges** (the rights + decoy, in display order; labels are DOM).
  - The pump's crank is chained to the **Hall Gate** on the floor below.
  - The **Nerve Beacon** (a neuron-shaped tower in L2, seen through the ring window) is dark.
- **Graded control.** Link each socket to a cartridge (click a socket then a cartridge; ↑/↓ to choose a socket, 1–5 for a
  cartridge). The pairs: l0 Na⁺ per cycle → r0 "3, out of the cell"; l1 K⁺ per cycle → r1 "2, into the cell"; l2 energy
  → r2 "1 ATP"; l3 dependents → r3 "Nerve and muscle cells"; decoy x0 "2, out of the cell".
- **Stage probe.** Tab **"k"**, readout "stage 3 · flip out":

| k | Stage |
|---|---|
| 0 | rest |
| 1 | bind Na⁺ |
| 2 | ATP |
| 3 | flip out |
| 4 | swap |
| 5 | drop P |
| 6 | flip in |

- **Cartridge semantics** (`config.rights`, by right key): r0 `{count, n 3, out}`, r1 `{count, n 2, in}`, r2 `{atp, n 1}`,
  r3 `{beacon}`, x0 `{count, n 2, out}`. Socket kinds (`config.lefts`): l0 `ion` Na at stage 1, l1 `ion` K at stage 4,
  l2 `energy` at stage 2, l3 `beacon` at stage 6. **A cartridge linked to a socket of another kind loads exactly what it
  says and shows a neutral label**, for example **"loaded: 1 ATP"** on the Na⁺ socket (20 §2.5.6). There is no "?"
  glyph and no dimming: the socket looks the same as any other loaded socket, and only the stage playback shows what the
  load does (an ATP spark arriving where ions should bind binds nothing, and the drum turns empty).
- **LIVE BINDING (`pose(k, links)`).**

| Source | Target | Formula |
|---|---|---|
| `draft.probe` k | drum angle | `φ = 60°·k`, eased |
| k | conformation | inward-open for k ∈ {0, 1, 2, 6}: the lower jaw opens 35°. Outward-open for k ∈ {3, 4, 5}: the upper jaw opens 35° |
| link(l0) = count `{n, dir}` | Na⁺ sockets | `n` sockets on the drum show "loaded". At k ≥ 1, n Na⁺ ions snap in from the cytoplasm side. At k = 4 they release toward `dir` (up = out, down = in) |
| link(l1) = count `{n, dir}` | K⁺ sockets | `n` sockets. At k = 4, n K⁺ bind from the side opposite `dir`; at k = 6 they release toward `dir` |
| link(l2) = atp `{n}` | ATP port | at k = 2, `n` gold sparks enter the port |
| link(l3) | Nerve Beacon | its plaque shows the linked cartridge's text. At k = 6 the beacon pulses with brightness ∝ the net charge moved |
| links | `bars` **charge ledger** | `q = n_Na,out − n_K,in` (signed by the linked directions). A needle "inside − / +" leans `−30°·clamp(q, −1, 1)` |
| cables | visuals | each link draws a gold-cored cable from socket to cartridge (catenary sag 40); the focused socket glows; seated lamps are **white**, never cyan, before Verify |

- **Panel (scrub).**
  - Slot 0 `link_board` **"wiring"**: 4 sockets on the left in fixed order, 5 cartridges on the right in display order,
    the cables between them.
  - Slot 1 `schematic` **"pump"**: the pump cross-section at stage k, with ions per the links.
  - Slot 2 `bars` **"charge"**: a white bar "Na⁺ out", a green bar "K⁺ in", and a net chip "q = +1".
  - The stage Scrubber (orange, labelled detents at each stop).
- **Success (≈ 2.4 s).**
  - Badge **PUMP CYCLING**.
  - Two full automatic cycles (k 0 → 6 at 170 ms per stage, ×2). Each cycle: 3 coral Na⁺ jet up into the tide, 2 violet
    K⁺ are drawn down into the cytoplasm, and one gold spark.
  - The ledger ticks q = +1 per cycle, and the crank lifts the **Hall Gate** 0.5 H per cycle (then the gate locks open).
  - The **Nerve Beacon fires** (P1 prop state `lit`): a light pulse races along its axon cable across L2.
  - Pore socket 7 lights; Gradient 64 → 78 % (the biggest jump: this machine *is* the gradient).
- **Failure (`wrong_link`; only `wrongKeys[0]` acts).** A stage-by-stage run (170 ms per stage) **jams at the stage of the
  first wrong left's socket** (key order l0 → l3; `grind`, sfx `clunk`):
  - l0 wrong → jams at k = 1: the drum loads the wrong count and grinds (a 3 px shake).
  - l1 wrong → jams at k = 4.
  - l2 wrong → k = 2: the spark misfires.
  - l3 wrong → the cycle completes but the Beacon's plaque flickers and stays dark.
  - Other sockets show nothing extra. Line: `fail.byKey[equal_counts]` when the decoy sits in l0, else `fail.default`;
    then the feedback (it quotes the clue `why`).
- **Hints in the world.** Rung 1: Pip circles the charge-ledger needle (`drum`). Rung 2: Pip hovers at `socket_0`.
  Rung 3: Pip lands on `atp_port`. Tier 1: the ledger card labels its needle "inside charge". Tier 2: the schematic card
  captions each stage.
- **Visible misconception.** "Equal numbers each way": wire the decoy "2, out" into Na⁺ and the ledger reads **q = 0**,
  the needle stays upright, and at k = 6 the Beacon barely glows. A balanced pump builds no charge difference.

**Station JSON** (`world.stations[]`):

```json
{
  "encounterId": "e8_pump",
  "zoneId": "zone_c",
  "consoleX": 2900,
  "consoleSurface": "pump_deck",
  "consoleAsset": null,
  "anchor": {"x": 3300, "y": 873},
  "approachRadius": 500,
  "contraption": "stage_machine",
  "skin": "pump_rewiring",
  "config": {
    "lefts": [
      {"key": "l0", "stage": 1, "socketKind": "ion", "ion": "Na"},
      {"key": "l1", "stage": 4, "socketKind": "ion", "ion": "K"},
      {"key": "l2", "stage": 2, "socketKind": "energy", "ion": null},
      {"key": "l3", "stage": 6, "socketKind": "beacon", "ion": null}
    ],
    "rights": [
      {"key": "r0", "semantic": {"kind": "count", "n": 3, "dir": "out"}},
      {"key": "r1", "semantic": {"kind": "count", "n": 2, "dir": "in"}},
      {"key": "r2", "semantic": {"kind": "atp", "n": 1}},
      {"key": "r3", "semantic": {"kind": "beacon"}},
      {"key": "x0", "semantic": {"kind": "count", "n": 2, "dir": "out"}}
    ],
    "stages": {
      "symbol": "k",
      "label": "pump stage",
      "min": 0,
      "max": 6,
      "step": 1,
      "unit": "",
      "format": "stage",
      "initial": 0,
      "stops": [
        {"v": 0, "label": "rest"}, {"v": 1, "label": "bind Na⁺"}, {"v": 2, "label": "ATP"},
        {"v": 3, "label": "flip out"}, {"v": 4, "label": "swap"}, {"v": 5, "label": "drop P"},
        {"v": 6, "label": "flip in"}
      ],
      "window": null,
      "playback": false
    },
    "ledger": "charge"
  },
  "objectNoun": "sodium-potassium pump",
  "partNouns": ["socket", "cartridge", "stage dial", "pump", "drum"],
  "pins": [],
  "accessories": [],
  "frameZoom": null,
  "probes": [{"predicate": "linkedTo", "fromKey": "l0", "toKey": "x0", "key": "equal_counts"}],
  "panel": {
    "layout": "scrub",
    "inputSymbol": null,
    "verifyLabel": "RUN ONE CYCLE",
    "successBadge": "PUMP CYCLING",
    "cards": [
      {"slot": 0, "title": "wiring", "x": null, "y": null, "hidden": false},
      {"slot": 1, "title": "pump", "x": null, "y": null, "hidden": false},
      {"slot": 2, "title": "charge", "x": null, "y": null, "hidden": false}
    ]
  },
  "dialogue": "§4.3 rows for this encounter (slot column = path)",
  "payoff": {
    "kind": "remove_blocker",
    "vertical": "none",
    "anim": "gate_lifts",
    "noun": "Hall Gate",
    "blocker": {"x": 4020, "surface": "ground", "asset": null},
    "terrain": [],
    "rideCutsceneId": null,
    "autoBoardMs": null,
    "feedsHub": true
  },
  "boss": null
}
```

---

### 5.9 · e9_osmosis_review · `sorter.type_match` · **Return Sluice / Barge Lock** (zone C, console x 5000, scrub + waves)

| Binding | |
|---|---|
| Archetype / skin | `sluice_waves` / `tonicity_sluices` (dusk); layout `scrub`; `WaveControl` → `{answers}` |
| Probe | none |
| Verify / badge | FILL THE LOCK / LOCK FILLED |
| Payoff | ride / up / `water_rises` "barge" (`rideCutsceneId: e9_barge`, `autoBoardMs: 3000`, lands on `pit_ledge`); no blocker (`pit_ledge` is reachable only by the barge) |
| Parts | the §5.5 set, re-lit by the `pit_dusk` segment, plus `barge` |

- **In-world object.** The same kit as §5.5, re-skinned at dusk.
  - A **Label Lock** whose valve plaques read IN / OUT / NONE.
  - Three holding basins.
  - The **Barge Lock**: a low canal with a cream barge moored beside the console (x 5390). The player stands at the quay;
    the barge rises with them after success.
- **Graded control.** Three valves (Water moves in / Water moves out / No net movement), 4 waves, 8 s each, the same
  `WaveControl` rules as e5.
- **Waves.** Here **the fate is not stated in the text**, so `showFate: false` and `fate: null`: the fate is a verdict
  and waits for Verify (R2).

| wave | text | `cell`, `inDots`, `outDots` |
|---|---|---|
| w0 | 2 % inside, 10 % bath | `generic`, 8, 40 |
| w1 | 2 % inside, distilled water | `generic`, 8, 0 |
| w2 | 0.9 % in 0.9 % saline | `rbc`, 4, 4 |
| w3 | potato cells in sugar syrup | `potato` (starch granules as cream ovals), 10, 45 (sugar hexagons, `fx.mol_sugar`, instead of cubes) |

- **LIVE BINDING.** Cell position vs time is the same as e5; volume stays at 1 (fate hidden).
  - Solute dots inside and outside are drawn from the config, since the text states them.
  - **Hovering a valve draws ghost water arrows for that claim** (`valves[].arrows`: in → inward arrows; out → outward;
    none → arrows both ways, equal and balanced). This renders the claim. Judging it against the dot densities is the
    reasoning.
  - The `bars` cards show f = the outside bar and g = the inside bar, and slot 2 **"claimed flow"** = an arrow gauge.
- **Panel (scrub).** As §5.5.
- **Success (≈ 2.3 s, then the ride).**
  - Badge **LOCK FILLED**.
  - All four cells animate their true fates at once in their basins: w0 shrinks, w1 swells, w2 steady, and w3's potato
    protoplast pulls from its wall.
  - The Barge Lock fills +2 H; `e9_barge` lifts the barge (and the player) to the pit ledge.
  - Pore socket 8 lights; Gradient 78 → 84 %.
- **Failure (`wrong_wave`).** The first missed wave's cell returns to the lock. After the feedback names its category,
  the world may animate that one cell's true fate (the same information, `disclosed`). Line: `fail.byKey[salt_moves]`
  when a probe matched, else `fail.default`. Retry with answers preselected.
- **Hints in the world.** Rung 1: Pip hovers over `lock`. Rung 2: Pip circles the current cell. Rung 3: Pip lands on
  `valve`. Tier 1: the salt dots get a white outline (they never move). Tier 2: the "claimed flow" gauge captions "toward
  more solute".
- **Visible misconception.** "Salt crosses instead of water": the salt dots stay perfectly put through every animation,
  and only blue droplets cross.

**Station JSON** (`world.stations[]`):

```json
{
  "encounterId": "e9_osmosis_review",
  "zoneId": "zone_c",
  "consoleX": 5000,
  "consoleSurface": "ground",
  "consoleAsset": null,
  "anchor": {"x": 5300, "y": 1213},
  "approachRadius": 500,
  "contraption": "sluice_waves",
  "skin": "tonicity_sluices",
  "config": {
    "waves": [
      {"waveIndex": 0, "cell": "generic", "inDots": 8, "outDots": 40, "fate": null, "showFate": false},
      {"waveIndex": 1, "cell": "generic", "inDots": 8, "outDots": 0, "fate": null, "showFate": false},
      {"waveIndex": 2, "cell": "rbc", "inDots": 4, "outDots": 4, "fate": null, "showFate": false},
      {"waveIndex": 3, "cell": "potato", "inDots": 10, "outDots": 45, "fate": null, "showFate": false}
    ],
    "valves": [
      {"categoryId": "in", "densityK": null, "arrows": "in"}, {"categoryId": "out", "densityK": null, "arrows": "out"},
      {"categoryId": "none", "densityK": null, "arrows": "both"}
    ]
  },
  "objectNoun": "Barge Lock",
  "partNouns": ["lock", "valve", "barge", "cell"],
  "pins": [],
  "accessories": [],
  "frameZoom": null,
  "probes": [
    {"predicate": "assignedTo", "itemKey": "w0", "binId": "in", "key": "salt_moves"},
    {"predicate": "assignedTo", "itemKey": "w3", "binId": "in", "key": "salt_moves"}
  ],
  "panel": {
    "layout": "scrub",
    "inputSymbol": null,
    "verifyLabel": "FILL THE LOCK",
    "successBadge": "LOCK FILLED",
    "cards": [
      {"slot": 0, "title": "solute outside", "x": null, "y": null, "hidden": false},
      {"slot": 1, "title": "solute inside", "x": null, "y": null, "hidden": false},
      {"slot": 2, "title": "claimed flow", "x": null, "y": null, "hidden": false}
    ]
  },
  "dialogue": "§4.3 rows for this encounter (slot column = path)",
  "payoff": {
    "kind": "ride",
    "vertical": "up",
    "anim": "water_rises",
    "noun": "barge",
    "blocker": null,
    "terrain": [],
    "rideCutsceneId": "e9_barge",
    "autoBoardMs": 3000,
    "feedsHub": true
  },
  "boss": null
}
```

---

### 5.10 · e10_bulk · `sequencer.linear` · **Endocytosis Lift** (zone C, console x 7100 on `pit_ledge`, scrub + plank rail)

| Binding | |
|---|---|
| Archetype / skin | `step_bridge` / `endocytosis_lift` (`bays: stage_rail`); layout `scrub`; `SlotRailControl` → `{slots}` |
| Probe | `k` "playback", 0–4, step 0.05, `playback: true`, stops flat · slot 1 … slot 4; `probeWorld: playback` |
| Stage physics | `membrane_fold` (20 §4.2): `{depth, wrap, neck, detached, travel, bounced}` per stage |
| Verify / badge | LAUNCH THE LIFT / VESICLE LAUNCHED |
| Payoff | carry / down / `vesicle_carries` "vesicle" → `zone_d` (−4 H; `rideCutsceneId: e10_vesicle`); `frameZoom: 0.85` |
| Parts | `clathrin_cell` (kit), `dynamin_collar` (hero), `halcyon` (hero, shared with the intro), `stage_lamp` ×4, `vesicle` (kit); the membrane path is code-drawn |

- **In-world object.** The **Endocytosis Pit** (anchor x 7300 on the pit ledge).
  - A 700-unit membrane dimple ringed by a **clathrin lattice**: hexagon/pentagon cage cells made of cream triskelions
    with gold joints, lying flat and dormant.
  - A gold **dynamin collar** (a coiled ring) hangs from a cream gantry above the pit's centre.
  - The ***Halcyon*** rests in the pit, with **the Diver aboard** (after the approach line the player walks into the sub;
    the camera keeps the sub centred).
  - Four **stage lamps** (round bronze-framed plates) sit on the Lift frame beside the Ferryman's post.
- **Graded control.** Place plates into 4 slots from 5 shuffled planks: s0 touch; s1 fold inward; s2 pinch off; s3
  vesicle carries; d0 (decoy) "dissolves through the bilayer on its own".
- **Probe.** Tab **"k"**, "playback", 0–4, continuous, labels at the stops. It plays **the player's own sequence** through
  the membrane physics, and during the success timeline it auto-plays 0 → 4 (`playback: true`).
- **Stage physics** (pure, cumulative; `stages[key].stageId`). State `S = {depth D, wrap ω, neck n, detached, travel,
  bounced}` starts flat: `{0, 0°, 1, false, 0, false}`. `S_k = apply(step in slot k, S_{k−1})`:

| Step (`stageId`) | Requires | Effect if the requirement is met | Effect if it isn't (the visible trap) |
|---|---|---|---|
| s0 `touch` | — | the sub settles, `Dy = −0.05 H`, receptor glyphs on the heads light cyan | — |
| s1 `fold` | touched | `D → 1.3 H`, `ω → 300°`, `n → 0.6`, the clathrin lattice curves into a basket | without contact, the membrane dimples slightly (D 0.2 H) and relaxes: nothing to fold around |
| s2 `pinch` | `ω ≥ 270°` | `n → 0`, `detached = true`, a gold spark at the dynamin collar, the vesicle closes around the sub | **an empty micro-vesicle** (0.3 H) pinches off the flat membrane and floats away, and the sub stays outside |
| s3 `carry` | detached | `travel → 1`: the vesicle rides a microtubule rail down 4 H into the cytoplasm | the rail lights, but nothing is on it |
| d0 `dissolve_bounce` | — | the sub presses into the heads, compressing them 20 %, and **springs back** 0.2 H (`bounced`) | — |

  The pose at a fractional k blends `S_⌊k⌋ → S_⌈k⌉` (ease-in-out). Empty slots are skipped. `validateConfig` proves that
  only the solution order ends `detached && travel = 1`.
- **LIVE BINDING.**
  - k → the full pose above (membrane path points, lattice curvature, collar radius, sub y).
  - Each filled slot lights its **stage lamp** with that plank's icon (`living_gate.ui.plank_*`) and label chip.
  - World chips: `stage: 2.4` on the collar and `depth: 1.1 H` on the pit.
  - The ATP card ticks a gold cell each time a fold or pinch pose is **entered** (a claim render of cost).
- **Panel (scrub).**
  - The plank palette (5 plates, icon + text).
  - Slot 0 `slot_rail` **"stage rail"**: 4 slots joined by dot-ended trace lines.
  - Slot 1 `schematic` **"pit"**: the pose, schematically.
  - Slot 2 `energy_cells` **"ATP"** (gold).
  - The playback Scrubber.
- **Success (≈ 2.4 s, then the descent).**
  - Badge **VESICLE LAUNCHED**. Automatic playback 0 → 4 (0.5 s per stage) with the correct physics.
  - `e10_vesicle`: the camera follows the vesicle down 4 H through the bilayer band (the heads close over it) while the
    sky crossfades from pit-dusk to the cytoplasm sky; a 200 ms white bloom at dock; zone D.
  - The vesicle docks on the Vault Road, **uncoats** (clathrin cells drift off as sparkles) and pops open. The player
    steps out, and Pip follows.
  - Pore socket 9 lights (at P1 conduit 10 lights **in the ceiling band above**); Gradient 84 → 90 %.
- **Failure.**
  - `decoy` → playback runs to the decoy's slot, the sub bounces off the heads, and the Ferryman's
    `fail.byKey[decoy]` line plays, then the feedback ("… isn't part of this process").
  - `order` → playback runs to the first wrong slot (`prefix`), the trap in the table plays (an empty micro-vesicle, a
    rail with nothing on it), `fail.byKey[order]` (the Ferryman's "Hold."), then the feedback ("Slot k is out of
    place…").
  - The slots keep their plates.
- **Hints in the world.** Rung 1: Pip circles `pit_center`. Rung 2: Pip hovers at `collar`. Rung 3: Pip lands on `sub`.
  Tier 1: the stage lamps show each plank's requirement glyph. Tier 2: the schematic card shows the wrap angle ω.
- **Visible misconception.** "Vesicle transport is passive": the ATP card ticks at fold and pinch, and the dynamin spark
  is gold (the energy colour).

**Station JSON** (`world.stations[]`):

```json
{
  "encounterId": "e10_bulk",
  "zoneId": "zone_c",
  "consoleX": 7100,
  "consoleSurface": "pit_ledge",
  "consoleAsset": null,
  "anchor": {"x": 7300, "y": 873},
  "approachRadius": 500,
  "contraption": "step_bridge",
  "skin": "endocytosis_lift",
  "config": {
    "bays": "stage_rail",
    "items": [
      {"key": "s0", "meta": {"glyph": "plank_touch", "label": "touch"}},
      {"key": "s1", "meta": {"glyph": "plank_fold", "label": "fold inward"}},
      {"key": "s2", "meta": {"glyph": "plank_pinch", "label": "pinch off"}},
      {"key": "s3", "meta": {"glyph": "plank_carry", "label": "vesicle carries"}},
      {"key": "d0", "meta": {"glyph": "plank_dissolve", "label": "dissolve"}}
    ],
    "stepEffects": [],
    "stages": [
      {"key": "s0", "stageId": "touch", "icon": "plank_touch"},
      {"key": "s1", "stageId": "fold", "icon": "plank_fold"},
      {"key": "s2", "stageId": "pinch", "icon": "plank_pinch"},
      {"key": "s3", "stageId": "carry", "icon": "plank_carry"},
      {"key": "d0", "stageId": "dissolve_bounce", "icon": "plank_dissolve"}
    ],
    "anchors": 0,
    "relief": null,
    "probe": {
      "symbol": "k",
      "label": "playback",
      "min": 0,
      "max": 4,
      "step": 0.05,
      "unit": "",
      "format": "stage",
      "initial": 0,
      "stops": [
        {"v": 0, "label": "flat"}, {"v": 1, "label": "slot 1"}, {"v": 2, "label": "slot 2"},
        {"v": 3, "label": "slot 3"}, {"v": 4, "label": "slot 4"}
      ],
      "window": null,
      "playback": true
    },
    "probeWorld": "playback",
    "dayCounter": null,
    "bayLampsTier": 1,
    "pageOrderHeading": null
  },
  "objectNoun": "Endocytosis Lift",
  "partNouns": ["stage plates", "plate", "pit", "collar"],
  "pins": [],
  "accessories": [],
  "frameZoom": 0.85,
  "probes": [],
  "panel": {
    "layout": "scrub",
    "inputSymbol": null,
    "verifyLabel": "LAUNCH THE LIFT",
    "successBadge": "VESICLE LAUNCHED",
    "cards": [
      {"slot": 0, "title": "stage rail", "x": null, "y": null, "hidden": false},
      {"slot": 1, "title": "pit", "x": null, "y": null, "hidden": false},
      {"slot": 2, "title": "ATP", "x": null, "y": null, "hidden": false}
    ]
  },
  "dialogue": "§4.3 rows for this encounter (slot column = path)",
  "payoff": {
    "kind": "carry",
    "vertical": "down",
    "anim": "vesicle_carries",
    "noun": "vesicle",
    "blocker": null,
    "terrain": [],
    "rideCutsceneId": "e10_vesicle",
    "autoBoardMs": null,
    "feedsHub": true
  },
  "boss": null
}
```

---

### 5.11 · e11_boss · `sorter.bins` · **The Gatekeeper** (zone D, console x 3800, board; boss)

| Binding | |
|---|---|
| Archetype / skin | `router_lanes` / `gatekeeper_maws`; layout `board`; `RouterControl` → `{assignments}` with **boss phases** |
| Probe | none |
| Verify / badge | OPEN THE VAULT / VAULT OPEN |
| Payoff | remove_blocker / none / `vault_opens` "Nuclear Pore"; blocker x 4450 (the Gatekeeper's body) → finale |
| Boss | `speakerId: gatekeeper`, `arenaTriggerX: 3000`, `arenaCutsceneId: e11_arena`, `arenaBounds: [2800, 5600]`, phases `[i0, i1]`, `[i2, i3]`, `[i4, i5, i6]`, taunts (2 cycled + 3 by probe key), music `boss` |
| Parts | `gatekeeper_body`, `maw_oil`, `maw_channel`, `maw_pump`, `eye_ring` (hero), `eye_pupil` (kit, requested slot), `atp_pipe` (kit), cargo glyphs; console `prop.kiosk`; `frameZoom: 0.75` |

- **In-world object.** The **Gatekeeper** (6 H) and his three maws:
  - **Oil Maw** (bin `simple`, `laneId: oil_maw`), lined with lipid heads.
  - **Channel Maw** (bin `facilitated`, `laneId: channel_maw`), with a bronze selectivity ring.
  - **Pump Maw** (bin `active`, `laneId: pump_maw`), with gold teeth and an ATP pipe up his back.

  His **eye-ring** tracks the action. Behind him is the **Nuclear Pore** (the zone hub, 5.5 H): an 8-spoke outer ring, an
  inner ring and a plug, with 11 conduit sockets around its rim (10 lit by now, the 11th dark). Seven cargo items float
  in the eddy, each over a gradient ramp. The console is a cream kiosk with a round emblem panel (frame 10's kiosk).
- **Staging (amendment 18; presentation only).** Crossing x 3000 plays `e11_arena`: the boss music, a camera pull-back,
  `station wake` (the eye-ring lights from the bottom up, sfx `gatekeeper_rumble`), then `gk_1` (the fixture beat) and
  `gk_2`. The camera then clamps to the arena. In the panel the seven cargo arrive in **three batches**:

| Phase | Item keys | Gatekeeper line (spoken when the batch appears) |
|---|---|---|
| `p1` | i0 O₂, i1 glucose | `gk_p1` "Hrrm. Two cargo to start. Show me you can tell a slope from a shove." |
| `p2` | i2 Na⁺, i3 water | `gk_p2` "Two more. My pump maw is hungry, and it hates waste." |
| `p3` | i4 CO₂, i5 K⁺, i6 Cl⁻ | `gk_p3` "The last three. A billion years of pumping rides on these." |

  A batch appears when every cargo of the previous batch is placed. Placements can still be moved. Verify needs all
  seven; there is **one `Input` and one `grade()`**, and no batch is judged on its own.
- **Graded control.** Sort 7 cards into 3 bins: i0 O₂ into a cell that has used up its oxygen (simple); i1 glucose via
  carrier, high → low (facilitated); i2 Na⁺ pumped against (active); i3 water via aquaporin (facilitated); i4 CO₂ leaving
  (simple); i5 K⁺ pumped into a cell with lots of K⁺ (active); i6 Cl⁻ via channel, high → low (facilitated).
- **LIVE BINDING.**

| Source | Target | Formula |
|---|---|---|
| assignment | cargo | floats to the maw's queue in front of his chest (the e2 queue formula, `y = y_s − 1.8 H`); **the maw reacts as a claim render**: the Oil Maw's heads ripple, the Channel Maw's ring turns 30°, the Pump Maw's intake pipe glows and the ATP card hatches a cell. No verdict |
| `draft.focus` on a token | eye-ring | the pupil ring rotates to face that cargo: `angle = atan2(c.y − eye.y, c.x − eye.x)`, eased |
| `draft.focus` on a bin | maw | that maw opens 12° (the jaw plates part) and glows faintly |
| n_active | `energy_cells` card + back pipe | projected spend hatched on 12 gold cells (`energy.reserve: 12`); the pipe **surges**: glow `0.2 + 0.1·n_active` with a packet per new active cargo |
| `aidTier ≥ 1` | Pip's water lens | hydration shells on the polar and charged cargo, as in e2 |
| item `{from, to}` | gradient ramps | as in e6 (i3's text states no direction: a flat plinth) |

- **Panel (board).**
  - The palette (7 cargo cards, shown by batch).
  - Three bins: **"OIL MAW · simple diffusion"**, **"CHANNEL MAW · facilitated diffusion"**, **"PUMP MAW · active
    transport"** (P2 art `ui.bin_bilayer`, `ui.bin_channel`, `ui.bin_pump`).
  - Slot 0 `energy_cells` **"ATP"** (reserve 12).
  - When the Gatekeeper speaks, **his emblem replaces Ora's** in the dialogue bar.
- **Success (≈ 2.5 s, then the finale).**

| t (ms) | What happens |
|---|---|
| 0 | Badge **VAULT OPEN**; `payoffLine` `e11_payoff` (the Gatekeeper, the fixture's after-beat) |
| 0–1400 | Each maw swallows its cargo in turn (200 ms apart): Oil Maw cargo **dissolve** through its head lining; Channel Maw cargo **spin** through the ring (no spark); Pump Maw cargo are pushed **up** the ramp with a gold spark (the ATP card spends 2) |
| 1400 | The eye-ring turns gold. The Gatekeeper **rotates aside** 90° on his base (a 600 ms ground shake, 3 px), turning his profile to open the road (the blocker drops) |
| 2000 | Three beams from his maws + pore socket 10 light the last rim socket. **All 11 sockets** glow |
| 2500 | → the `finale` cutscene (map D2): `gk_3`; `hub restored` (the pore's outer ring rotates +90°, the inner ring (`prop.pore_inner`) −135°, the plug (`prop.pore_plug`) retracts, and white-gold light floods out); the player walks in; `out01`–`out03`, `out06`; Gradient 90 → 100 %; the world re-saturates and the ambient motes separate vividly; fade to the EndScreen |

- **Failure (`wrong_bin`; only `wrongKeys[0]` acts).** The first mis-sorted cargo is **spat back** out of its maw
  (`spit_back`) with a puff of bubbles, and the Gatekeeper rumbles (a 4 px, 200 ms camera shake: gentle). Lines, in
  order: his taunt (`taunts.byKey` for a matched probe key, else `taunts.fail` cycled by attempt), then Ora's
  `fail.default`, then the feedback (it names the correct category and feature for that one item).
- **Hints in the world.** Rung 1: Pip flies to `eye` and turns its lens on (tier 1). Rung 2: Pip hovers at `maw_active`.
  Rung 3: Pip circles `pipe_top`. Tier 1: the lens. Tier 2: every ramp shows its slope arrow.
- **Visible misconception.** "Transport always goes down the gradient": Pump Maw cargo visibly climbs its ramp, paying a
  gold spark per climb, and nothing in the other two maws ever sparks.

**Station JSON** (`world.stations[]`):

```json
{
  "encounterId": "e11_boss",
  "zoneId": "zone_d",
  "consoleX": 3800,
  "consoleSurface": "ground",
  "consoleAsset": "living_gate.prop.kiosk",
  "anchor": {"x": 4200, "y": 1113},
  "approachRadius": 500,
  "contraption": "router_lanes",
  "skin": "gatekeeper_maws",
  "config": {
    "items": [
      {
        "key": "i0",
        "meta": {"glyph": "o2", "label": "O₂"},
        "polar": false,
        "charged": false,
        "from": 8,
        "to": 2,
        "vehicle": "none"
      },
      {
        "key": "i1",
        "meta": {"glyph": "glucose", "label": "glucose"},
        "polar": true,
        "charged": false,
        "from": 8,
        "to": 2,
        "vehicle": "carrier"
      },
      {
        "key": "i2",
        "meta": {"glyph": "na", "label": "Na⁺"},
        "polar": false,
        "charged": true,
        "from": 2,
        "to": 8,
        "vehicle": "pump"
      },
      {
        "key": "i3",
        "meta": {"glyph": "water", "label": "water"},
        "polar": true,
        "charged": false,
        "from": null,
        "to": null,
        "vehicle": "channel"
      },
      {
        "key": "i4",
        "meta": {"glyph": "co2", "label": "CO₂"},
        "polar": false,
        "charged": false,
        "from": 8,
        "to": 2,
        "vehicle": "none"
      },
      {
        "key": "i5",
        "meta": {"glyph": "k", "label": "K⁺"},
        "polar": false,
        "charged": true,
        "from": 2,
        "to": 8,
        "vehicle": "pump"
      },
      {
        "key": "i6",
        "meta": {"glyph": "cl", "label": "Cl⁻"},
        "polar": false,
        "charged": true,
        "from": 8,
        "to": 2,
        "vehicle": "channel"
      }
    ],
    "lanes": [
      {"binId": "simple", "laneId": "oil_maw", "year": null},
      {"binId": "facilitated", "laneId": "channel_maw", "year": null},
      {"binId": "active", "laneId": "pump_maw", "year": null}
    ],
    "lens": "hydration",
    "lensTier": 1,
    "energy": {"reserve": 12},
    "shutters": false,
    "stamp": "none",
    "eventsBand": null,
    "eventsBandTier": 1,
    "probe": null,
    "probeWorld": "none"
  },
  "objectNoun": "Gatekeeper",
  "partNouns": ["maw", "cargo", "Oil Maw", "Channel Maw", "Pump Maw"],
  "pins": [],
  "accessories": [],
  "frameZoom": 0.75,
  "probes": [
    {"predicate": "assignedTo", "itemKey": "i1", "binId": "active", "key": "protein_costs_atp"},
    {"predicate": "assignedTo", "itemKey": "i3", "binId": "active", "key": "protein_costs_atp"},
    {"predicate": "assignedTo", "itemKey": "i6", "binId": "active", "key": "protein_costs_atp"},
    {"predicate": "assignedTo", "itemKey": "i2", "binId": "facilitated", "key": "always_downhill"},
    {"predicate": "assignedTo", "itemKey": "i5", "binId": "facilitated", "key": "always_downhill"},
    {"predicate": "assignedTo", "itemKey": "i2", "binId": "simple", "key": "small_passes"}
  ],
  "panel": {
    "layout": "board",
    "inputSymbol": null,
    "verifyLabel": "OPEN THE VAULT",
    "successBadge": "VAULT OPEN",
    "cards": [{"slot": 0, "title": "ATP", "x": null, "y": null, "hidden": false}]
  },
  "dialogue": "§4.3 rows for this encounter (slot column = path)",
  "payoff": {
    "kind": "remove_blocker",
    "vertical": "none",
    "anim": "vault_opens",
    "noun": "Nuclear Pore",
    "blocker": {"x": 4450, "surface": "ground", "asset": null},
    "terrain": [],
    "rideCutsceneId": null,
    "autoBoardMs": null,
    "feedsHub": true
  },
  "boss": {
    "speakerId": "gatekeeper",
    "arenaTriggerX": 3000,
    "arenaCutsceneId": "e11_arena",
    "arenaBounds": {"x0": 2800, "x1": 5600},
    "phases": [
      {
        "id": "p1",
        "itemKeys": ["i0", "i1"],
        "line": {
          "speakerId": "gatekeeper",
          "text": "Hrrm. Two cargo to start. Show me you can tell a slope from a shove."
        }
      },
      {
        "id": "p2",
        "itemKeys": ["i2", "i3"],
        "line": {"speakerId": "gatekeeper", "text": "Two more. My pump maw is hungry, and it hates waste."}
      },
      {
        "id": "p3",
        "itemKeys": ["i4", "i5", "i6"],
        "line": {
          "speakerId": "gatekeeper",
          "text": "The last three. A billion years of pumping rides on these.",
          "mood": "solemn"
        }
      }
    ],
    "taunts": {
      "approach": [],
      "fail": [
        {
          "speakerId": "gatekeeper",
          "text": "Hrrm. That one came back up. Direction first. Then ask whether it can pass through oil."
        },
        {
          "speakerId": "gatekeeper",
          "text": "Hrrm. My maws do not argue. They spit. Look at the slope under what I spat."
        }
      ],
      "byKey": [
        {
          "key": "protein_costs_atp",
          "line": {
            "speakerId": "gatekeeper",
            "text": "A door is not an engine. My pump maw will not pay for a downhill trip."
          }
        },
        {
          "key": "always_downhill",
          "line": {
            "speakerId": "gatekeeper",
            "text": "Downhill only, you think. Then nothing would ever climb, and my pump maw has climbed for a billion years."
          }
        },
        {
          "key": "small_passes",
          "line": {"speakerId": "gatekeeper", "text": "Small is not welcome. Charge sinks in my oil maw like a stone."}
        }
      ]
    },
    "music": "boss"
  }
}
```

---

## 6 · Side content and purpose systems

### 6.1 Lore plaques (`world.plaques`; P1–P2 at P0, P3–P5 at P1)
Plaques are cream stone posts (0.8 H, `living_gate.prop.plaque_post`, kit) with a round navy emblem plate. E opens the
text in the bar in document style (20 §2.4.7) while Pip's porthole flashes (the scan); the Logbook (P2) files each one,
and each plaque read adds its line to the debrief's "What you found" list.

| id | Scene / spot | Access | Teaches (in context) |
|---|---|---|---|
| p1 The Two Faces | S1, `root_ledge` x 1440 | hop `a_root_ledge` | amphipathic lipids, which explains the ground under your feet |
| p2 Why Oil Says No | S2, `stud_ledge` x 7040 | climb `a_stud_climb` after e2 | why charge is blocked (the e2 rule, deepened after the fact) |
| p3 The Jittering Grains | S3, raft ledge x 4300 | the e4 raft | Brownian motion as the engine of diffusion (history + concept) |
| p4 The Lopsided Engine | S5, `pump_deck` x 3700 | appears after e8 | 3 : 2 : 1 and the negative interior (reinforces e8 without spoiling it) |
| p5 Doors Made of Door | S6, `pit_ledge` x 6700 | before e10 | endocytosis/exocytosis symmetry (primes e10) |

Poro's ledger (rev. 1's "P3b") is now his P1 `thanks` state line `poro_ledger`.

```json
[
  {
    "id": "p1",
    "zoneId": "zone_a",
    "x": 1440,
    "surface": "root_ledge",
    "asset": "living_gate.prop.plaque_post",
    "kind": "plaque",
    "title": "The Two Faces",
    "text": "Each lipid has a head that loves water and two tails that flee it. Tails hide inside; heads face out.",
    "sourceRef": null,
    "requires": null
  },
  {
    "id": "p2",
    "zoneId": "zone_a",
    "x": 7040,
    "surface": "stud_ledge",
    "asset": "living_gate.prop.plaque_post",
    "kind": "plaque",
    "title": "Why Oil Says No",
    "text": "A charge wants water around it. The bilayer's oily core has none, so ions are turned away.",
    "sourceRef": null,
    "requires": null
  },
  {
    "id": "p3",
    "zoneId": "zone_b",
    "x": 4300,
    "surface": "ground",
    "asset": "living_gate.prop.plaque_post",
    "kind": "plaque",
    "title": "The Jittering Grains",
    "text": "In 1827 Robert Brown saw tiny grains from pollen jitter in water. Nothing pushed them but water.",
    "sourceRef": null,
    "requires": null
  },
  {
    "id": "p4",
    "zoneId": "zone_c",
    "x": 3700,
    "surface": "pump_deck",
    "asset": "living_gate.prop.plaque_post",
    "kind": "plaque",
    "title": "The Lopsided Engine",
    "text": "Three Na+ out, two K+ in, one ATP. More plus leaves than enters, so the inside turns negative.",
    "sourceRef": null,
    "requires": {"solved": "e8_pump"}
  },
  {
    "id": "p5",
    "zoneId": "zone_c",
    "x": 6700,
    "surface": "pit_ledge",
    "asset": "living_gate.prop.plaque_post",
    "kind": "plaque",
    "title": "Doors Made of Door",
    "text": "Cells swallow large cargo by folding membrane around it. Exocytosis runs the same trip outward.",
    "sourceRef": null,
    "requires": null
  }
]
```

### 6.2 Objective HUD, the Gradient meter, progress effects (`world.story`)
- **Objective ring** (20 §2.6). The 55 px double ring fills clockwise per restored gate **in the current zone**: zone A 2
  arcs, B 4, C 4 (e7–e10), D 1. On zone change it re-segments with a 400 ms sweep. Tooltip and SR: "Restart the gates
  and wake the nucleus · 3 of 11 gates".
- **Objective line**: `GATES 3/11` (`objectiveLabel` + counts).
- **MeterBar**: `GRADIENT 32%` (`story.meter`), animated 600 ms per change; it also drives the ambient motes (§2.4). A
  bilayer-styled bar skin (two rows of tiny heads whose white and green fills pull apart as G rises) is P2.
- **Gradient progression:**

| after | e1 | e2 | e3 | e4 | e5 | e6 | e7 | e8 | e9 | e10 | e11 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| G % | 18 | 26 | 32 | 40 | 48 | 56 | 64 | 78 | 84 | 90 | 100 |

- **Progress effects.** P0: one `hub_socket` per station on the Nuclear Pore (sockets 0–10), so arriving in S8 shows ten
  lit sockets and one dark. P1: 11 conduit segments along the seam (`prop_state` `conduit_1…11` → `lit`), the seal nodes
  (`seal_a` after e2, `seal_b` after e6, `seal_c` after e10), the Nerve Beacon after e8, and the garden side stair
  after e5 (§6.3 JSON). The hall's 12 lanterns are e7's own skin parts and light in its success plan.

```json
{
  "logline": "The Stillness has frozen every gate in cell V-7. Restart each one by its true rule before the cell's gradients drain away.",
  "objective": "Restart the gates and wake the nucleus",
  "objectiveLabel": "GATES",
  "restoredNoun": "gate",
  "introCutsceneId": "intro",
  "finaleCutsceneId": "finale",
  "meter": {
    "id": "gradient",
    "label": "GRADIENT",
    "unit": "percent",
    "start": 12,
    "perEncounter": [
      {"encounterId": "e1_bilayer", "value": 18}, {"encounterId": "e2_selectivity", "value": 26},
      {"encounterId": "e3_diffusion", "value": 32}, {"encounterId": "e4_osmosis", "value": 40},
      {"encounterId": "e5_tonicity", "value": 48}, {"encounterId": "e6_facilitated", "value": 56},
      {"encounterId": "e7_active", "value": 64}, {"encounterId": "e8_pump", "value": 78},
      {"encounterId": "e9_osmosis_review", "value": 84}, {"encounterId": "e10_bulk", "value": 90},
      {"encounterId": "e11_boss", "value": 100}
    ],
    "drives": ["hud_bar", "ambient_particles"]
  },
  "progressEffects": [
    {"kind": "hub_socket", "encounterId": "e1_bilayer", "zoneId": "zone_d", "socket": 0},
    {"kind": "hub_socket", "encounterId": "e2_selectivity", "zoneId": "zone_d", "socket": 1},
    {"kind": "hub_socket", "encounterId": "e3_diffusion", "zoneId": "zone_d", "socket": 2},
    {"kind": "hub_socket", "encounterId": "e4_osmosis", "zoneId": "zone_d", "socket": 3},
    {"kind": "hub_socket", "encounterId": "e5_tonicity", "zoneId": "zone_d", "socket": 4},
    {"kind": "hub_socket", "encounterId": "e6_facilitated", "zoneId": "zone_d", "socket": 5},
    {"kind": "hub_socket", "encounterId": "e7_active", "zoneId": "zone_d", "socket": 6},
    {"kind": "hub_socket", "encounterId": "e8_pump", "zoneId": "zone_d", "socket": 7},
    {"kind": "hub_socket", "encounterId": "e9_osmosis_review", "zoneId": "zone_d", "socket": 8},
    {"kind": "hub_socket", "encounterId": "e10_bulk", "zoneId": "zone_d", "socket": 9},
    {"kind": "hub_socket", "encounterId": "e11_boss", "zoneId": "zone_d", "socket": 10}
  ],
  "map": null,
  "journal": {"title": "Logbook", "style": "logbook"},
  "recordStrip": null
}
```

### 6.3 NPCs, quests, triggers and P1 props (`world.npcs`, `quests`, `triggers`, `props`; all P1)
- **Escort Sucra (S2 → S4 → S5 → S7).** No fail state. Five states; the active one is the last whose `requires` holds:
  knocking at the Crossing Yard; on the terrace after e2; waiting at the Threshold Yard once zone B's arrival trigger has
  set `zone_b_reached`; inside the Pump Hall after e6 (she rode the Carrier Door with you); on a passing vesicle in S7
  after e10 (`pose: ride`). Her lines tell the "carrier is a door" story that e6 and e11 test.
- **Poro (S4).** `awake` (the approach line, repeatable) and `thanks` after e5 (`poro_2` + his ledger lore).
- **Kay's Lanterns (S5).** Talking to Kay sets `kay_met`, which un-hides the `touch` on three dark ATP lanterns:
  1. on the pipe run behind the Low Tank (`c_pipe_hop`; revision 1's crouch-walk is gone);
  2. on the gantry rail perch (`c_rail_hop` from the risen deck);
  3. on the pump deck's back railing (x 3900).
  Touching each with the probe-staff lights it (`fx.lantern_pool`, chime). The quest completes on the third touch: flag
  `kay_lanterns_done`, `kay_reward`, and a debrief line; at P2 it also grants shard 2. Optional; it never blocks.
- **The Ferryman (S6).** One state at the Lift frame (`ferry_1`); his `fail.byKey` lines on e10 are P0 (spoken from the
  frame even before his puppet lands).
- **Triggers.** `s1_walk1`, `s1_walk2`, `s1_node` (ambient toasts), `s1_roots` (a hint toast after 20 s idle by the root
  hump), `zB_arrive` (sets `zone_b_reached`), `zC_arrive`, `s7_walk1` (arrivals), `s7_walk2`, `s7_walk3` (ambient),
  `s7_viewpoint` (arrival on the high rail, sets `saw_skyline`). Express mode disables ambient and hint triggers.

The P1 `props` list below holds full objects: its `seal_a` **replaces** the P0 `seal_a` entry of §2.5.4 (it adds the
`lit` state and the `touch`).

```json
{
  "npcs": [
    {
      "id": "sucra",
      "name": "Sucra",
      "speakerId": "sucra",
      "look": null,
      "asset": "living_gate.npc.sucra",
      "states": [
        {
          "id": "s2_knock",
          "requires": null,
          "zoneId": "zone_a",
          "x": 6000,
          "lines": [
            {
              "speakerId": "sucra",
              "text": "Pardon! Excuse me! I've knocked on these heads for an hour. They simply will not let a glucose through.",
              "mood": "worried"
            }
          ],
          "pose": "work"
        },
        {
          "id": "s2_ride",
          "requires": {"solved": "e2_selectivity"},
          "zoneId": "zone_a",
          "x": 7100,
          "lines": [
            {
              "speakerId": "sucra",
              "text": "A carrier! It takes me in, turns around, lets me out. No shoving, no fuel. Marvellous.",
              "mood": "excited"
            }
          ],
          "pose": "cheer",
          "repeatable": true
        },
        {
          "id": "s4_wait",
          "requires": {"flag": "zone_b_reached"},
          "zoneId": "zone_b",
          "x": 7300,
          "lines": [
            {
              "speakerId": "sucra",
              "text": "Oh, it's you! The Carrier Door takes two, you know. I have been practising my boarding.",
              "mood": "excited"
            }
          ],
          "pose": "idle",
          "repeatable": true
        },
        {
          "id": "s5_inside",
          "requires": {"solved": "e6_facilitated"},
          "zoneId": "zone_c",
          "x": 520,
          "lines": [
            {
              "speakerId": "sucra",
              "text": "Told you. A carrier is a door, not an engine. I am going to write that on something.",
              "mood": "wry"
            }
          ],
          "pose": "talk",
          "repeatable": true
        },
        {
          "id": "s7_vesicle",
          "requires": {"solved": "e10_bulk"},
          "zoneId": "zone_d",
          "x": 1400,
          "lines": [
            {
              "speakerId": "sucra",
              "text": "Carried! Politely! By a vesicle! I am having the most educational day.",
              "mood": "excited"
            }
          ],
          "pose": "ride"
        }
      ]
    },
    {
      "id": "poro",
      "name": "Poro",
      "speakerId": "poro",
      "look": null,
      "asset": "living_gate.npc.poro",
      "states": [
        {
          "id": "awake",
          "requires": null,
          "zoneId": "zone_b",
          "x": 5080,
          "lines": [
            {
              "speakerId": "poro",
              "text": "Mm. Visitors. I am Poro. Water passes through my waist in single file, and nothing else. Now, the sluices.",
              "mood": "solemn"
            }
          ],
          "pose": "idle",
          "repeatable": true
        },
        {
          "id": "thanks",
          "requires": {"solved": "e5_tonicity"},
          "zoneId": "zone_b",
          "x": 5080,
          "lines": [
            {
              "speakerId": "poro",
              "text": "Mm. Well sorted. The water will remember you. Take my ledger; it is heavy with droplets.",
              "mood": "solemn"
            },
            {
              "speakerId": "poro",
              "text": "Mm. My kind lets water through in single file, billions of molecules each second. Only water. I am very strict.",
              "mood": "solemn"
            }
          ],
          "pose": "talk",
          "repeatable": true
        }
      ]
    },
    {
      "id": "kay",
      "name": "Kay",
      "speakerId": "kay",
      "look": null,
      "asset": "living_gate.npc.kay",
      "states": [
        {
          "id": "dark_hall",
          "requires": null,
          "zoneId": "zone_c",
          "x": 620,
          "lines": [
            {
              "speakerId": "kay",
              "text": "Oi. Mind the lanterns. Kay, K-plus, lamplighter. Nothing's been lit since the pumps went quiet."
            },
            {
              "speakerId": "kay",
              "text": "Three lanterns in here are still dark. Touch 'em with that probe of yours and I'll tell you a secret."
            }
          ],
          "pose": "idle",
          "setFlag": "kay_met"
        },
        {
          "id": "after_pump",
          "requires": {"solved": "e8_pump"},
          "zoneId": "zone_c",
          "x": 3500,
          "surface": "pump_deck",
          "lines": [
            {
              "speakerId": "kay",
              "text": "Three out, two in. Lopsided, I always said. Lopsided's what keeps the lights on.",
              "mood": "wry"
            }
          ],
          "pose": "cheer",
          "repeatable": true
        }
      ]
    },
    {
      "id": "ferryman",
      "name": "The Clathrin Ferryman",
      "speakerId": "ferryman",
      "look": null,
      "asset": "living_gate.npc.ferryman",
      "states": [
        {
          "id": "lift",
          "requires": null,
          "zoneId": "zone_c",
          "x": 6900,
          "surface": "pit_ledge",
          "lines": [
            {
              "speakerId": "ferryman",
              "text": "Passage inward is by vesicle only. The membrane will carry you, if you tell it how. In order.",
              "mood": "solemn"
            }
          ],
          "pose": "idle",
          "repeatable": true
        }
      ]
    }
  ],
  "quests": [
    {
      "id": "kay_lanterns",
      "title": "Kay's Lanterns",
      "giverNpcId": "kay",
      "steps": [
        {"kind": "talk", "npcId": "kay", "stateId": "dark_hall"},
        {"kind": "touch", "propIds": ["lantern_1", "lantern_2", "lantern_3"]}
      ],
      "reward": {
        "flag": "kay_lanterns_done",
        "lines": [
          {
            "speakerId": "kay",
            "text": "Secret is, a nerve cell spends a big share of all its ATP just running pumps like that one. Worth every spark."
          }
        ],
        "collectibleId": null,
        "cosmetic": null,
        "debriefLine": "Kay's secret: a nerve cell spends a large share of its ATP just running Na+/K+ pumps."
      }
    }
  ],
  "props (P1 additions)": [
    {
      "id": "conduit_1",
      "zoneId": "zone_a",
      "asset": "living_gate.prop.conduit_segment",
      "x": 4300,
      "y": 1087,
      "layer": "L4_back",
      "states": [{"state": "lit", "asset": null}]
    },
    {
      "id": "conduit_2",
      "zoneId": "zone_a",
      "asset": "living_gate.prop.conduit_segment",
      "x": 6300,
      "y": 1087,
      "layer": "L4_back",
      "states": [{"state": "lit", "asset": null}]
    },
    {
      "id": "conduit_3",
      "zoneId": "zone_b",
      "asset": "living_gate.prop.conduit_segment",
      "x": 1100,
      "y": 1317,
      "layer": "L4_back",
      "states": [{"state": "lit", "asset": null}]
    },
    {
      "id": "conduit_4",
      "zoneId": "zone_b",
      "asset": "living_gate.prop.conduit_segment",
      "x": 3100,
      "y": 1317,
      "layer": "L4_back",
      "states": [{"state": "lit", "asset": null}]
    },
    {
      "id": "conduit_5",
      "zoneId": "zone_b",
      "asset": "living_gate.prop.conduit_segment",
      "x": 5200,
      "y": 1317,
      "layer": "L4_back",
      "states": [{"state": "lit", "asset": null}]
    },
    {
      "id": "conduit_6",
      "zoneId": "zone_b",
      "asset": "living_gate.prop.conduit_segment",
      "x": 7500,
      "y": 1317,
      "layer": "L4_back",
      "states": [{"state": "lit", "asset": null}]
    },
    {
      "id": "conduit_7",
      "zoneId": "zone_c",
      "asset": "living_gate.prop.conduit_segment",
      "x": 900,
      "y": 1317,
      "layer": "L4_back",
      "states": [{"state": "lit", "asset": null}]
    },
    {
      "id": "conduit_8",
      "zoneId": "zone_c",
      "asset": "living_gate.prop.conduit_segment",
      "x": 2900,
      "y": 1317,
      "layer": "L4_back",
      "states": [{"state": "lit", "asset": null}]
    },
    {
      "id": "conduit_9",
      "zoneId": "zone_c",
      "asset": "living_gate.prop.conduit_segment",
      "x": 5000,
      "y": 1317,
      "layer": "L4_back",
      "states": [{"state": "lit", "asset": null}]
    },
    {
      "id": "conduit_10",
      "zoneId": "zone_c",
      "asset": "living_gate.prop.conduit_segment",
      "x": 7100,
      "y": 1317,
      "layer": "L4_back",
      "states": [{"state": "lit", "asset": null}]
    },
    {
      "id": "conduit_11",
      "zoneId": "zone_d",
      "asset": "living_gate.prop.conduit_segment",
      "x": 3800,
      "y": 104,
      "layer": "L4_back",
      "states": [{"state": "lit", "asset": null}]
    },
    {
      "id": "lantern_1",
      "zoneId": "zone_c",
      "asset": "living_gate.part.specimen_pods_lantern",
      "x": 560,
      "surface": "pipe_run",
      "layer": "L4_play",
      "glow": false,
      "touch": {
        "requires": {"flag": "kay_met"},
        "litAsset": "living_gate.fx.lantern_pool",
        "lines": [],
        "cue": "lantern_lit"
      }
    },
    {
      "id": "lantern_2",
      "zoneId": "zone_c",
      "asset": "living_gate.part.specimen_pods_lantern",
      "x": 1640,
      "surface": "rail_perch",
      "layer": "L4_play",
      "glow": false,
      "touch": {
        "requires": {"flag": "kay_met"},
        "litAsset": "living_gate.fx.lantern_pool",
        "lines": [],
        "cue": "lantern_lit"
      }
    },
    {
      "id": "lantern_3",
      "zoneId": "zone_c",
      "asset": "living_gate.part.specimen_pods_lantern",
      "x": 3900,
      "surface": "pump_deck",
      "layer": "L4_play",
      "glow": false,
      "touch": {
        "requires": {"flag": "kay_met"},
        "litAsset": "living_gate.fx.lantern_pool",
        "lines": [],
        "cue": "lantern_lit"
      }
    },
    {
      "id": "seal_a",
      "zoneId": "zone_a",
      "asset": "living_gate.prop.seal_node",
      "x": 2900,
      "layer": "L4_back",
      "restoredBy": "e2_selectivity",
      "states": [{"state": "lit", "asset": null}],
      "touch": {
        "requires": {"solved": "e2_selectivity"},
        "litAsset": null,
        "lines": [
          {
            "speakerId": "pilot",
            "text": "This node's awake. Two conduits feed it now, and the Crossing Gate is humming on the other end."
          }
        ],
        "cue": "conduit_on"
      }
    },
    {
      "id": "seal_b",
      "zoneId": "zone_b",
      "asset": "living_gate.prop.seal_node",
      "x": 7200,
      "layer": "L4_back",
      "restoredBy": "e6_facilitated",
      "states": [{"state": "lit", "asset": null}]
    },
    {
      "id": "seal_c",
      "zoneId": "zone_c",
      "asset": "living_gate.prop.seal_node",
      "x": 7560,
      "surface": "pit_ledge",
      "layer": "L4_back",
      "restoredBy": "e10_bulk",
      "states": [{"state": "lit", "asset": null}]
    },
    {
      "id": "side_stair",
      "zoneId": "zone_b",
      "asset": "living_gate.prop.side_stair",
      "x": 6640,
      "y": 1213,
      "layer": "L4_play",
      "states": [{"state": "hidden", "asset": null}, {"state": "revealed", "asset": null}]
    },
    {
      "id": "nerve_beacon",
      "zoneId": "zone_c",
      "asset": "living_gate.prop.nerve_beacon",
      "x": 3300,
      "y": 420,
      "layer": "L3_mid",
      "states": [{"state": "lit", "asset": "living_gate.fx.nerve_beacon_glow"}]
    }
  ],
  "triggers": [
    {
      "id": "s1_walk1",
      "zoneId": "zone_a",
      "x": 900,
      "kind": "ambient",
      "lines": [
        {
          "speakerId": "pilot",
          "text": "Those branching trees are the glycocalyx: sugar chains on the cell's surface. Think of them as its name tag."
        }
      ]
    },
    {
      "id": "s1_walk2",
      "zoneId": "zone_a",
      "x": 1800,
      "kind": "ambient",
      "lines": [
        {
          "speakerId": "pilot",
          "text": "The ground under you is the membrane itself. Round heads on top, oily tails underneath. Mind your step."
        }
      ]
    },
    {
      "id": "s1_roots",
      "zoneId": "zone_a",
      "x": 2100,
      "radius": 200,
      "kind": "hint",
      "lines": [
        {
          "speakerId": "pilot",
          "text": "Glycan roots, knee-high to a Diver. Hop them; the membrane on the far side is solid."
        }
      ]
    },
    {
      "id": "s1_node",
      "zoneId": "zone_a",
      "x": 2900,
      "kind": "ambient",
      "lines": [
        {
          "speakerId": "pilot",
          "text": "A seal node, dark as a cave. Every gate you restart lights a conduit to one of these. That's our map."
        }
      ]
    },
    {
      "id": "zB_arrive",
      "zoneId": "zone_b",
      "x": 200,
      "kind": "arrival",
      "lines": [
        {
          "speakerId": "pilot",
          "text": "The Tide Basins. Everything here is about water, and water always has somewhere it wants to be."
        }
      ],
      "setFlag": "zone_b_reached"
    },
    {
      "id": "zC_arrive",
      "zoneId": "zone_c",
      "x": 500,
      "kind": "arrival",
      "lines": [
        {
          "speakerId": "pilot",
          "text": "The Pump Hall. Those gold rails used to carry ATP to every pump in the wall. Dark as a hold in here."
        }
      ]
    },
    {
      "id": "s7_walk1",
      "zoneId": "zone_d",
      "x": 600,
      "kind": "arrival",
      "lines": [
        {
          "speakerId": "pilot",
          "text": "Look up, Diver. That's the membrane from the inside. Those glowing domes are organelles, and the big one is the nucleus."
        }
      ]
    },
    {
      "id": "s7_walk2",
      "zoneId": "zone_d",
      "x": 1900,
      "kind": "ambient",
      "lines": [
        {
          "speakerId": "pilot",
          "text": "Every conduit you lit is feeding the Nuclear Pore. It needs one last push, and I think I know who's in the way."
        }
      ]
    },
    {
      "id": "s7_viewpoint",
      "zoneId": "zone_d",
      "x": 2500,
      "surface": "high_rail",
      "radius": 120,
      "kind": "arrival",
      "lines": [
        {
          "speakerId": "pilot",
          "text": "That's the whole skyline: Golgi, mitochondria, the ER, and the nucleus. Every one of them is waiting on that pore.",
          "mood": "excited"
        }
      ],
      "setFlag": "saw_skyline"
    },
    {
      "id": "s7_walk3",
      "zoneId": "zone_d",
      "x": 2750,
      "kind": "ambient",
      "lines": [
        {
          "speakerId": "pilot",
          "text": "Real nuclear pores are their own kind of gate. This old pump just parked itself on the road when the Stillness hit."
        }
      ]
    }
  ],
  "sandboxes": [
    {
      "id": "garden",
      "zoneId": "zone_b",
      "consoleX": 6760,
      "surface": "garden_alcove",
      "anchor": {"x": 6820, "y": 1043},
      "contraption": "plant_garden",
      "skin": "plant_pool",
      "config": {
        "salt": {
          "symbol": "s",
          "label": "pool salt",
          "min": 0,
          "max": 5,
          "step": 0.1,
          "unit": "%",
          "format": "number",
          "initial": 0,
          "stops": [],
          "window": null,
          "playback": false
        },
        "cIn": 2,
        "wallRigid": true
      },
      "title": "Plant Cell Garden",
      "objectNoun": "garden pool",
      "requires": {"solved": "e5_tonicity"},
      "lines": {
        "open": [
          {
            "speakerId": "pilot",
            "text": "A plant cell in fresh water, and it isn't bursting. Its wall pushes back. That's turgor. Plants like it firm."
          }
        ],
        "idle": [{"speakerId": "pilot", "text": "Try salting the pool past two percent and watch the green wall."}]
      },
      "goal": "plasmolysed",
      "reward": {
        "flag": "garden_explored",
        "lines": [
          {
            "speakerId": "pilot",
            "text": "There: the protoplast lets go of the wall. Back to fresh water and it presses firm again.",
            "mood": "excited"
          }
        ],
        "cosmetic": null,
        "debriefLine": "Plant cells like a hypotonic world: the wall turns swelling into firmness."
      },
      "frameZoom": 1.1
    }
  ],
  "story.progressEffects (P1 additions)": [
    {"kind": "prop_state", "encounterId": "e2_selectivity", "propId": "seal_a", "state": "lit"},
    {"kind": "prop_state", "encounterId": "e5_tonicity", "propId": "side_stair", "state": "revealed"},
    {"kind": "prop_state", "encounterId": "e6_facilitated", "propId": "seal_b", "state": "lit"},
    {"kind": "prop_state", "encounterId": "e8_pump", "propId": "nerve_beacon", "state": "lit"},
    {"kind": "prop_state", "encounterId": "e10_bulk", "propId": "seal_c", "state": "lit"},
    {"kind": "prop_state", "encounterId": "e1_bilayer", "propId": "conduit_1", "state": "lit"},
    {"kind": "prop_state", "encounterId": "e2_selectivity", "propId": "conduit_2", "state": "lit"},
    {"kind": "prop_state", "encounterId": "e3_diffusion", "propId": "conduit_3", "state": "lit"},
    {"kind": "prop_state", "encounterId": "e4_osmosis", "propId": "conduit_4", "state": "lit"},
    {"kind": "prop_state", "encounterId": "e5_tonicity", "propId": "conduit_5", "state": "lit"},
    {"kind": "prop_state", "encounterId": "e6_facilitated", "propId": "conduit_6", "state": "lit"},
    {"kind": "prop_state", "encounterId": "e7_active", "propId": "conduit_7", "state": "lit"},
    {"kind": "prop_state", "encounterId": "e8_pump", "propId": "conduit_8", "state": "lit"},
    {"kind": "prop_state", "encounterId": "e9_osmosis_review", "propId": "conduit_9", "state": "lit"},
    {"kind": "prop_state", "encounterId": "e10_bulk", "propId": "conduit_10", "state": "lit"},
    {"kind": "prop_state", "encounterId": "e11_boss", "propId": "conduit_11", "state": "lit"}
  ]
}
```

### 6.4 Map: **the Cell Chart** (P2; M, or click the objective ring)
- `story.map` with `style: "cell_rings"`, drawn by the generic `MapOverlay` (20 §2.6): panel material, 70 % × 80 %, the
  world dimmed 40 % and paused.
- **The chart is a cross-section of cell V-7 drawn as concentric rings**: the membrane ring (a dotted bilayer), the
  cytoplasm fill, and the nucleus ring with 8 pore notches. The route S1 → S8 is a dotted trace from the outer shore along
  the membrane arc to the pit, then inward to the nucleus.
- Four nodes (one per zone) carry their stations as seal glyphs: grey when dormant, cyan when restored. The current
  position is a white pin. Tabs: map, journal (the **Logbook**: plaques found), mastery, shards (`SHARDS n/3`).
- No fast travel. Keyboard: ←/→ for the tabs, Esc to close.

### 6.5 The secret: **the Plant Cell Garden** (P1 sandbox `garden`)
- **Access.** When the e5 sluice drains, a narrow side stair appears on the trench's far wall (`side_stair` →
  `revealed`). `b_garden_climb` climbs from the Threshold road (x 6660) to a hidden alcove behind a glycan curtain
  (`garden_alcove`, y 1043); the L5 fronds part as you walk in. `b_alcove_drop` returns you to the road.
- **Inside.** A small pool of fresh water holding a big **turgid plant cell** (a rigid green-cream wall, a swollen
  protoplast pressed against it, a central vacuole as a blue bubble). The sandbox console (x 6760) opens the panel in
  **sandbox layout** (scrub geometry, no Verify, the back tab reads DONE): one probe scrubber `s` "pool salt" 0–5 %.
  Above about 2 % the protoplast shrinks away from the wall (plasmolysis); at 0 % it swells, **but the wall holds**. The
  `plant_garden` meta reuses the `osmotic_cell` sim with `cIn: 2`, `wallRigid: true`.
- **Goal and reward.** Goal `plasmolysed` (the first time the protoplast leaves the wall): flag `garden_explored`,
  `garden_reward`, and the debrief line "Plant cells like a hypotonic world: the wall turns swelling into firmness."
  `lines.open` is `garden_open` (the turgor line); `lines.idle` nudges after 20 s. At P2 the flag also reveals shard 1.
- **Why it's here.** It deepens tonicity (the one concept that appears twice) and pays off the "about to burst" wave
  with its counterpart. Nothing it does reaches telemetry or mastery.

### 6.6 Insight shards and the map (P2; `wisp.indigo` collectibles)
1. The Plant Cell Garden (after `garden_explored`).
2. Kay's Lanterns (after `kay_lanterns_done`).
3. The S7 viewpoint on the high rail.

Each shard floats (±6 px bob, an indigo additive halo, sparkles). The Cell Chart shows `SHARDS n/3`. Each shard adds
one insight line to the debrief. They have no gameplay effect: purpose without pressure.

```json
{
  "collectibles": [
    {
      "id": "shard_1",
      "kind": "shard",
      "zoneId": "zone_b",
      "x": 6860,
      "surface": "garden_alcove",
      "asset": "living_gate.prop.wisp_shard",
      "title": "Turgor",
      "text": "A plant cell's wall turns the water pushing in into firmness. In fresh water, plants stand up straight.",
      "conceptId": "c_tonicity",
      "requires": {"flag": "garden_explored"}
    },
    {
      "id": "shard_2",
      "kind": "shard",
      "zoneId": "zone_c",
      "x": 700,
      "surface": "ground",
      "asset": "living_gate.prop.wisp_shard",
      "title": "The Pump's Bill",
      "text": "Neurons spend a large share of their ATP keeping the Na+/K+ pump running.",
      "conceptId": "c_sodium_potassium",
      "requires": {"flag": "kay_lanterns_done"}
    },
    {
      "id": "shard_3",
      "kind": "shard",
      "zoneId": "zone_d",
      "x": 2560,
      "surface": "high_rail",
      "asset": "living_gate.prop.wisp_shard",
      "title": "The Skyline",
      "text": "Many organelles are compartments wrapped in membranes of their own, each with its own gates.",
      "conceptId": "c_bilayer",
      "requires": null
    }
  ],
  "story.map": {
    "style": "cell_rings",
    "title": "Cell Chart",
    "tabs": ["map", "journal", "mastery", "shards"],
    "nodes": [
      {
        "id": "shore",
        "label": "Glycocalyx Shore",
        "sub": "Zone A",
        "zoneId": "zone_a",
        "stations": ["e1_bilayer", "e2_selectivity"],
        "at": [0.12, 0.2]
      },
      {
        "id": "basins",
        "label": "Tide Basins",
        "sub": "Zone B",
        "zoneId": "zone_b",
        "stations": ["e3_diffusion", "e4_osmosis", "e5_tonicity", "e6_facilitated"],
        "at": [0.55, 0.08]
      },
      {
        "id": "hall",
        "label": "Pump Hall",
        "sub": "Zone C",
        "zoneId": "zone_c",
        "stations": ["e7_active", "e8_pump", "e9_osmosis_review", "e10_bulk"],
        "at": [0.88, 0.45]
      },
      {
        "id": "nucleus",
        "label": "Nuclear Vault",
        "sub": "Zone D",
        "zoneId": "zone_d",
        "stations": ["e11_boss"],
        "at": [0.5, 0.55]
      }
    ]
  }
}
```

### 6.7 Sound cue ids (20 §2.12 `CUE_MAP`)

| Cue id | Recipe | Where |
|---|---|---|
| `halcyon_settle` | `thunk` | intro |
| `pip_chirp` | `select` | intro, Pip hint arrivals |
| `pod_fog` | `whoosh` (pitch 0.6) | quarantines |
| `pod_crack`, `mote_pop`, `boing_soft`, `vesicle_pinch` | `pop` | quarantines, e2 bounce, e10 |
| `spit_back` | `pop` (repeat 3) | e11 failure |
| `bell_honest` | `bell` | every honest-pod failure |
| `ridge_thaw` | `chime` (pitch 0.8) | e1 payoff |
| `conduit_on`, `lantern_lit`, `beacon_fire` | `chime` | payoffs, Kay's quest, e8 |
| `slip` | `whoosh` | e2 success |
| `gate_open` | `clunk` | e2 success |
| `latch` | `latch` | e3 boom |
| `raft_flood`, `water_rush`, `sluice_drain` | `water` | e4, e9, e5 |
| `door_turn`, `clunk` | `grind` | e6 carry, e8 jam |
| `lift_hum` | `whoosh` (pitch 0.5) | e7 gantry |
| `atp_spark` | `spark` | e6, e7, e11 sparks |
| `current_hum` | `hum` (loop; pitch ∝ r or the ATP pipe glow) | e7 live, e11 pipe |
| `gatekeeper_rumble` | `rumble` | arena, e11 failure |
| `pore_open` | `chord` | finale |

Suggested skin cues (`ContraptionSkin.cues`, set by the KB lane): `specimen_pods` `{live: current_hum, succeed: chord_true,
fail: bell_honest}`; `membrane_router` / `carrier_lanes` / `gatekeeper_maws` `{live: null, succeed: gate_open, fail:
boing_soft}`; `tonicity_sluices` `{live: null, succeed: sluice_drain, fail: boing_soft}`; `pump_rewiring` `{live:
current_hum, succeed: chord_true, fail: clunk}`; `endocytosis_lift` `{live: null, succeed: vesicle_pinch, fail:
clunk}`.

---

## 7 · Art asset list

**Conventions (20 §5, 02 §3.0).**
- **Keys** are `living_gate.<group>.<name>` with the groups of 20 §5.1 (`layer`, `ground`, `prop`, `part`, `costume`,
  `companion`, `npc`, `fx`, `ui`, `vista`). Contraption part keys are `living_gate.part.<skin>_<slot>` (20 §4.3). Every
  entry in `art/living_gate/biome.json` carries its revision-1 id as `legacyId` (`cell.prop.nak_drum` …).
- **Source.** `hero` = a hand-authored SVG in its 20 §5.1 fragment directory (`art/living_gate/parts/<skin>/`,
  `landmarks/` or `cast/`; counted against the hero cap); `kit:<gen>` = a seeded kit entry in the matching `*.kit.json`
  fragment (generator names from 02 §3a.2; revision-2 names are mapped in 20 §5.4).
  Every hero declares a kit fallback (§0.1.2). The Diver's body is the recoloured rig `shared.char.diver` built by
  `pnpm chars:build`, not an authored file.
- **Sizes** are design units at 1080p (1 unit = 1 px of a 1080-tall view). Textures rasterize at
  `rasterScale × min(dpr, 1.5)` (layers ≤ 1, parts 1.5).
- **Tokens only** (§2.2); no plain `<text>`: fixed wordmarks are `<text data-engrave>` (converted to paths at build) and
  every dynamic label (chips, plaque letters, cartridge labels, basin labels) is DOM through `WorldLabelLayer`.
- **Pivots** are fractions of width and height (`data-pivot`); anchors are `<circle id="anchor-<name>" r="0">` markers
  for every anchor 20 §4.3 lists for the skin.
- **P** is the demo-cut priority. `retired`, `data`, `code` and `DOM` rows have no file.
- The descriptions below are unchanged from revision 1 unless the note says otherwise.

### 7.1 L0 sky swirls (the gradients are segment data)
| # | Key | Source | P | Size | Description | Note |
|---|---|---|---|---|---|---|
| 1 | `living_gate.layer.swirl_shore` | kit:cloudBand swirl | P0 | 2048×520, tileable (swirl bands only) | A 4-stop vertical gradient `#CFE9EC` → `#DCEFEA` (35 %) → `#EAF2E6` (70 %) → `#F4EEDF`. Three soft horizontal "fluid swirl" bands: blurred white ellipses @ 8 %, 1600×120, at y 180/340/470, offset x. A sun-glow radial at (300, 120), r 380, white 30 % → 0. 1 px noise dither @ 3 % | the gradient itself is `segments[shore_morning].sky` (data); legacyId `cell.sky.shore` |
| 2 | `living_gate.layer.swirl_basins` | kit:cloudBand swirl | P0 | 2048×520, tileable (swirl bands only) | `#BFE3E6` → `#D7EBE2` → `#EFE3D0` → `#F2D9C2`. The same swirl bands but warmer (`#FBEFE0` @ 10 %). Sun-glow at (1800, 160), peach | gradient = `segments[basins_afternoon].sky`; legacyId `cell.sky.basins` |
| 3 | `living_gate.layer.hall_ribs` | kit:compose(arch) | P0 | 2048×1080, tileable (rib arcs only) | Interior: `#3E3240` → `#5A4146` → `#7A5646`. Six faint cream rib arcs (stroke 18 px, `#F2E3C6` @ 10 %) spanning the width like a vault ceiling. A warm floor-glow band at the bottom 20 %, `#F6C48E` @ 25 % | gradient = `segments[hall_interior].sky`; legacyId `cell.sky.hall` |
| 4 | `living_gate.layer.swirl_pit` | kit:cloudBand swirl | P0 | 2048×520, tileable (swirl bands only) | Dusk: `#A9C9D6` → `#C7C6D4` → `#E6C9C2` → `#F2D2B8`. Two long salmon cloud-swirls `#F4AE80` @ 18 % at the horizon | gradient = `segments[pit_dusk].sky`; legacyId `cell.sky.pit` |
| 5 | `living_gate.layer.swirl_cytoplasm` | kit:cloudBand swirl | P0 | 2048×520, tileable (swirl bands only) | `#E9A98E` → `#F0BC98` → `#F3C7A2` → `#FAE3C2`. Large soft coral blobs `#E7836F` @ 10 % (streaming currents), plus a warm bloom near the right where the nucleus sits | gradient = `segments[vault_road_amber].sky`; legacyId `cell.sky.cytoplasm` |
| 6 | `living_gate.layer.vault_glints` | kit:scatter(glowSprite mote) | P0 | 2048×1080, tileable (glints only) | `#7E6AB8` → `#A488D0` → `#C9A0DE` → `#F2B8D4`. Scattered 2–4 px specks `#FFFFFF` @ 30 % (nucleoplasm glints). Violet haze at the bottom | gradient = `segments[vault_violet].sky`; legacyId `cell.sky.vault` |

### 7.2 L1 Far (factor 0.15)
| # | Key | Source | P | Size | Description | Note |
|---|---|---|---|---|---|---|
| 7 | `living_gate.layer.tissue_far` | kit:compose(ridgeBand cell_dome, linkStrip cable) | P0 | 2048×700, tileable | **Neighbour cells**: three overlapping huge ellipse domes (w 900 / 1200 / 1400) in `#B9D6D3`, each with a double rim line (2 px `#D6E8E4`, 6 px gap: a membrane seen far off), lit upper-left `#CFE4E0`, 40 % haze to sky. **Collagen cables**: 4 thin lines, 2 px `#E8F6F8` @ 55 %, crossing at shallow diagonals with small node dots (r 4) at the ends | legacyId `cell.far.tissue` |
| 8 | `living_gate.layer.tide_cliffs` | kit:ridgeBand | P0 | 2048×700, tileable | Rounded stacked-dome cliffs `#A9CFCB` / shade `#8DB7B3`, glycan groves as blurred blobs `#8CC0EE` @ 35 % and `#F4AE80` @ 30 %, two collagen cables | + `living_gate.layer.tide_cliffs_dusk` (same params, pit palette); legacyId `cell.far.tidecliffs` |
| 9 | `living_gate.layer.hall_vault` | hero | P0 | 2048×760, tileable | A ribbed interior wall `#4E3C44`, vertical ribs every 256 px (cream `#D9C3A0` @ 35 %, 24 px wide). One **ring window** per tile (a concentric bronze double ring `#6E4A2E` of r 150/120, glass fill `#F6C48E` @ 40 %) | zone C hero landmark (the Pump Hall vault shell); legacyId `cell.far.hallwall` |
| 10 | `living_gate.layer.organelles` | kit:compose(plate, ridgeBand, molecule) | P0 | 2048×760, tileable | A **Golgi stack**: 5 curved cream plates (`#F2E3C6`, each 300×30, bowed). Two **mitochondria**: capsules 360×150 in `mito.coral` with a lighter rim and 5 navy wavy cristae stripes. An **ER ribbon cliff**: folded ribbon layers `#E9B9A0` with bead dots (ribosomes) `#B89C78`. 30 % haze to the sky | legacyId `cell.far.organelles` |
| 11 | `living_gate.layer.nucleus_dome` | hero | P0 | 2600×900 (the dome, 1400×900, at x 1200) | The landmark, non-tiling. A huge dome `#C98BB0`, lit upper-left `#E2B3CC`, a double rim line (the envelope). 7 visible **pore rings** (bronze r 28 with a glowing centre `#F6D27A`, which lights up as gates restore: an additive overlay per ring) | zone D L1 (`repeatX: false`) and the finale; authored 2600×900 with the dome in its right half (x 1200–2600), because a ParallaxLayer has no x; legacyId `cell.far.nucleus_dome` |
| 12 | `living_gate.layer.envelope` | kit:compose(ashlarWall, ringStack) | P0 | 2048×900, tileable | The S8 back wall: the nuclear envelope as a double cream wall with navy seam lines and pore niches every 512 px (a shallow ring relief) | legacyId `cell.far.envelope` |

### 7.3 L2 Mid-far (factor 0.35)
| # | Key | Source | P | Size | Description | Note |
|---|---|---|---|---|---|---|
| 13 | `living_gate.layer.glycan_forest` | kit:scatter(canopy bead_tree) | P0 | 2048×600, tileable | Silhouettes of 7 **sugar-chain trees**: trunks of stacked beads (circles r 10–14), branching 2–3 times, crowns of hexagon beads (r 16–22) clustered. Alternating `glycan.blue` and `glycan.salmon`, two-tone (lit left +15 % lightness), 20 % haze | legacyId `cell.midfar.glycan_forest` |
| 14 | `living_gate.layer.dormant_towers` | kit:scatter(column broken) | P0 | 2048×620, tileable | 3 ruined channel-protein towers (cream bodies with navy bands, broken ring crowns, dark cores `#3F5857`), desaturated −40 %, 20 % haze | legacyId `cell.midfar.dormant_towers` |
| 15 | `living_gate.layer.hall_pillars` | kit:compose(column) | P0 | 2048×800, tileable | Hall pillars (cream shafts 90 px, lit left strip, navy capital bands ×2, gold trim), 3 per tile, and gold rail brackets between them | legacyId `cell.midfar.hall_pillars` |
| 16 | `living_gate.prop.nerve_beacon` | kit:compose(crystalCluster, linkStrip) | P1 | 600×700 | A stylized **neuron tower**: a star-shaped soma (cream, 5 dendrite spurs with gold tips) on a cream plinth, with a long **axon cable** (navy with cream myelin beads) running off-right to the tile edge. There is a separate glow overlay (#17) | a prop (L3_mid) with state `lit` (progress effect of e8); legacyId `cell.midfar.nerve_beacon` |
| 17 | `living_gate.fx.nerve_beacon_glow` | kit:glowSprite | P1 | 600×700 | An additive overlay for the beacon: a soma halo `#F6D27A` → 0 and a 12 px bright line along the axon (animated by UV scroll / mask) | the beacon's `lit` state asset; legacyId `cell.midfar.nerve_beacon_glow` |
| 18 | `living_gate.layer.cytoskeleton` | kit:compose(linkStrip microtubule, arch) | P0 | 2048×700, tileable | Microtubule **aqueduct arches**: cream tubes (30 px) with navy ring bands every 40 px, arching tile-to-tile, and small vesicle bubbles on some | legacyId `cell.midfar.cytoskeleton` |
| 19 | `living_gate.layer.cyto_glimpse` | kit:compose(skyWash, ridgeBand dome, molecule) | P0 | 2048×160, tileable | The amber band below the bilayer (zones A–C): a `cyto.glow` → `cyto.deep` vertical gradient, with faint organelle silhouettes (a mitochondrion capsule and Golgi arcs) @ 25 % and violet K⁺ specks | carries the far nucleus silhouette in zones A–C; legacyId `cell.midfar.cyto_glimpse` |

### 7.4 L3 Mid (factor 0.6)
| # | Key | Source | P | Size | Description | Note |
|---|---|---|---|---|---|---|
| 20 | `living_gate.layer.colonnade_rise` | kit:lipidColonnade | P0 | 2048×520, tileable | A **membrane hill**: the bilayer band (§7.5 style, scaled 0.6) bending up into a broad swell, glycan saplings on top, soft AO at the base | legacyId `cell.mid.colonnade_rise` |
| 21 | `living_gate.prop.cholesterol_a` | kit:crystalCluster stud | P0 | 60×140 | A cholesterol stud: a tall 3-facet crystal wedge (`cholesterol` hi/base/shade), base buried in heads | legacyId `cell.mid.cholesterol_a` |
| 22 | `living_gate.prop.cholesterol_b` | kit:crystalCluster cluster | P0 | 110×90 | A cluster of 3 short wedges | legacyId `cell.mid.cholesterol_b` |
| 23 | `living_gate.prop.cholesterol_c` | kit:crystalCluster fan | P0 | 150×70 | A fan of 4 low shards | legacyId `cell.mid.cholesterol_c` |
| 24 | `living_gate.layer.basin_walls` | kit:compose(ashlarWall, ringStack, waterBand falls) | P0 | 2048×500, tileable | Cream stone basin walls with gold rims, navy inlay bands and round drain rings (bronze) | the tide falls (#25) are composed into this strip; legacyId `cell.mid.basin_walls` |
| 25 | `living_gate.layer.basin_walls` | kit:waterBand falls | P0 | 256×600, tileable vertically | Two waterfall bands `tide.shallow` / `tide.deep`, with foam dashes. UV-scrolled in engine | composed into `basin_walls` (a ParallaxLayer has no x); legacyId `cell.mid.tide_falls` |
| 26 | `living_gate.layer.hall_rails` | kit:compose(linkStrip rail, gauge) | P0 | 2048×600, tileable | Gold ATP rails (3 horizontal, 10 px, `gold.base` with `gold.hi` top edge), pipe elbows, and small round gauge-dials (a navy face, cream needle) | legacyId `cell.mid.hall_rails` |
| 27 | `living_gate.layer.pit_rim` | kit:lipidColonnade | P0 | 2048×400, tileable | Rolling membrane rim, clathrin-cell patterns faint on the ground, dusk colouring | dusk palette; legacyId `cell.mid.pit_rim` |
| 28 | `living_gate.layer.vault_court` | kit:compose(ashlarWall, column) | P0 | 2048×600, tileable | Cream courtyard walls with navy bands, round emblem posts (bible frame 10 kiosk motif), and violet-tinted shadows | legacyId `cell.mid.vault_court` |

### 7.5 L4 Ground and play-layer terrain (factor 1.0)
| # | Key | Source | P | Size | Description | Note |
|---|---|---|---|---|---|---|
| 29 | `living_gate.ground.bilayer` | kit:bilayerTile fluid | P0 | 512×208, tileable | **The signature tile.** Top row: 11.6 heads per tile (r 22, `lipid.head` body, `lipid.head.lit` upper-left crescent, `lipid.head.shade` underside, 1 px `#D9C3A0` contact shadow). Each head drops **two tails** (8 px wide, 56 px long, `lipid.tail` with a `lipid.tail.hi` left stripe; one tail has a slight kink at 60 %). The **oil seam**: an 8 px `oil.seam` band with a 1 px `#4A6A8A` highlight. The mirrored inner leaflet has tails up and heads down, with the inner heads 10 % darker. Heads are separate sprites in engine (for jitter/parting); this tile is the static fallback + LOD | `Ground.surface` in zones A–C; the ground Rope follows the heightfield; legacyId `cell.ground.bilayer` |
| 30 | `living_gate.ground.head` | kit:molecule | P0 | 44×44 | A single lipid head sprite (for animated rows). The same shading as #29 | the pooled jitter window (§2.4.1); legacyId `cell.ground.head` |
| 31 | `living_gate.ground.tailpair` | kit:bilayerTile strip_vertical | P0 | 22×60 | A single tail-pair sprite, pivot (0.5, 0) | near-e1 parting only; legacyId `cell.ground.tailpair` |
| 32 | `living_gate.ground.bilayer_gel` | kit:bilayerTile gel | P0 | 512×208, tileable | The frozen variant: heads **hex-packed** (tighter, r 20), tails dead straight, the whole tile `gel.frost` with white frost rims on the top edges, desaturated. Used for the Stiff Ridge body | legacyId `cell.ground.bilayer_gel` |
| 33 | `living_gate.prop.stiff_ridge` | hero | P0 | 760×300 | The ridge hump: a gel-bilayer mass bulging 1.4 H with ice-like facets on the top, frost sparkles, and a shadowed cavity at its foot. It tweens to a ramp (engine mask + the #29 rows) | e1 `payoff.blocker.asset`; legacyId `cell.ground.stiff_ridge` |
| 34 | — | retired | — | 512×320 | A 12° up-slope transition of the bilayer (the rows follow a curve) | the ground Rope bends the strip along the heightfield; legacyId `cell.ground.slope` |
| 35 | `living_gate.ground.hall_deck` | kit:bilayerTile hall_deck | P0 | 512×208, tileable | The bilayer with a navy inlay stripe inset on the heads' top and gold studs every 128 px (the hall floor) | `pump_deck` platform asset; legacyId `cell.ground.hall_deck` |
| 36 | `living_gate.ground.trench` | kit:compose(ashlarWall, waterBand trench) | P0 | 512×360, tileable | Sluice trench: cream stone walls, a gold rim, a tide-water line mark, and a floor of wet stone `#B89C78` with blue caustic spots | drawn over the heightfield dip x 5400–6600; legacyId `cell.ground.trench` |
| 37 | `living_gate.ground.causeway` | kit:groundStrip causeway | P0 | 512×160, tileable | The microtubule causeway (zone D floor): 3 bundled cream tubes with navy bands, gold clamps every 256 px | `Ground.surface` in zone D; legacyId `cell.ground.causeway` |
| 38 | `living_gate.layer.ceiling_band` | kit:bilayerTile ceiling | P0 | 512×208, tileable | The membrane seen from inside (zone D ceiling): #29 flipped, inner leaflet facing down, with a soft white-cyan glow from above (the conduits shining through), `#E8F6F8` @ 25 % | L3_mid at scrollFactor 1.0, y 0; legacyId `cell.ground.ceiling_band` |

### 7.6 L5 Foreground (factor 1.3) and L6 Light
| # | Key | Source | P | Size | Description | Note |
|---|---|---|---|---|---|---|
| 39 | `living_gate.layer.glycan_fronds` | kit:canopy frond | P0 | 2048×260, tileable | Dark foreground fronds `#4F8F85` / `#3F6E8C`: bead-chain stalks with hexagon tips. Rendered with 2 px blur + 70 % alpha in engine. Tall clumps only at tile edges (never over a contraption) | legacyId `cell.fore.glycan_fronds` |
| 40 | `living_gate.layer.bubbles` | kit:cloudBand puff | P0 | 2048×300, tileable | A few large soft bubbles (r 20–60, white rim 2 px @ 60 %, fill 5 %) | legacyId `cell.fore.bubbles` |
| 41 | `living_gate.layer.hall_balustrade` | kit:railing balustrade | P0 | 1024×220, tileable | Cream balusters, a navy rail cap, one square post with a round emblem (bible frame 3) | legacyId `cell.fore.hall_balustrade` |
| 42 | `living_gate.layer.actin` | kit:canopy vine_drape | P0 | 2048×300, tileable | Thin salmon filament lines `#E48C5E` @ 60 % (zone D), gently curving | salmon; legacyId `cell.fore.actin` |
| 43 | `living_gate.fx.drift_vesicles` | kit:bilayerTile ring | P2 | 256×96 | Sprite strip: 3 drifting vesicles (r 18/28/42), cream rim with an inner `cyto.glow` fill | legacyId `cell.fore.vesicles` |
| 44 | `living_gate.layer.caustics` | kit:grainTile caustics | P0 | 1024×1024, tileable | Water caustic web (white lines on transparent), used add @ 12 % + multiply-blue @ 20 % | legacyId `cell.light.caustics` |
| 45 | `living_gate.layer.godrays` | kit:glowSprite shaft | P0 | 1920×1080 | 5 diagonal soft rays from the upper left, white → 0, add @ 15 % | legacyId `cell.light.godrays` |
| 46 | `living_gate.fx.lantern_pool` | kit:glowSprite radial | P0 | 512×512 | A radial gold pool `#F6D27A` → 0 for lanterns and ATP light, add | legacyId `cell.light.lantern_pool` |
| 47 | — | retired | — | 1920×1080 | A soft vignette `#D98A6A` @ 25 % at the corners (zone D) | the finish-stack vignette (20 §5.6) + `ambient.grade` in zone D; legacyId `cell.light.vignette_warm` |
| 48 | `living_gate.fx.mote` | kit:glowSprite mote | P0 | 32×32 | A soft round mote (white core → 0), tinted per ion in engine | tinted per ion; legacyId `cell.fx.mote` |

### 7.7 Molecules and FX glyphs
| # | Key | Source | P | Size | Description | Note |
|---|---|---|---|---|---|---|
| 49 | `living_gate.part.membrane_router_mol_o2` | kit:molecule | P0 | 56×36 | Two fused circles `#8CC0EE` with a lit rim and a 1 px darker outline `#5A95D6` | cargo glyphs are keyed under `membrane_router` and reused by `carrier_lanes` and `gatekeeper_maws`; legacyId `cell.mol.o2` |
| 50 | `living_gate.part.membrane_router_mol_co2` | kit:molecule | P0 | 76×32 | Three fused circles, outer `#A9C3BF`, centre `#5F7B7A` | legacyId `cell.mol.co2` |
| 51 | `living_gate.part.membrane_router_mol_na` | kit:molecule | P0 | 36×36 | A sphere `#EE8A9A` with a lit crescent, and a white "+" path 12 px | charge sign drawn as paths; legacyId `cell.mol.na` |
| 52 | `living_gate.part.membrane_router_mol_k` | kit:molecule | P0 | 44×44 | A sphere `#9C82E0` with a white "+" | legacyId `cell.mol.k` |
| 53 | `living_gate.part.membrane_router_mol_cl` | kit:molecule | P0 | 42×42 | A sphere `#7FD6B0` with a white "−" | legacyId `cell.mol.cl` |
| 54 | `living_gate.part.membrane_router_mol_h` | kit:molecule | P0 | 22×22 | A tiny sphere `#F7F0A0` with a "+" | legacyId `cell.mol.h` |
| 55 | `living_gate.part.membrane_router_mol_glucose` | kit:molecule hex_ring | P0 | 64×58 | A hexagon ring (stroke 6, `#D9A441`) filled `#F6E3B4`, with a single tail bead top-right | legacyId `cell.mol.glucose` |
| 56 | `living_gate.part.membrane_router_mol_steroid` | kit:molecule fused_rings | P0 | 96×60 | Four fused rings (3 hexagons + a pentagon) `#E6B85C` fill, darker outline | legacyId `cell.mol.steroid` |
| 57 | `living_gate.fx.mol_water` | kit:molecule drop | P0 | 18×24 | A teardrop `#4F92E6` with a white highlight | also the e6/e11 `water` cargo glyph; legacyId `cell.mol.water` |
| 58 | `living_gate.fx.mol_dye` | kit:molecule dot | P0 | 14×14 | A soft dot `#D46BA8` | e3 prefab particles; legacyId `cell.mol.dye` |
| 59 | `living_gate.fx.mol_salt` | kit:molecule cube | P0 | 16×16 | A cube in 3/4 view: white top, `#E8F6F8` side, `#C9DDE2` side | e4 prefab particles; legacyId `cell.mol.salt` |
| 60 | `living_gate.fx.mol_sugar` | kit:molecule | P0 | 18×16 | A small hexagon `#F6E3B4` (syrup solute) | e9 potato wave; legacyId `cell.mol.sugar` |
| 61 | `living_gate.fx.atp_spark` | kit:glowSprite spark4 | P0 | 48×48 | A four-point spark `#F6D27A`, white core, thin rays. Used additively | legacyId `cell.fx.atp_spark` |
| 62 | — | retired | — | 256×256 | A generic radial glow (white → 0), tinted in engine | the shared glow radii (`shared.fx.*`); legacyId `cell.fx.glow_soft` |
| 63 | `living_gate.fx.bubble_pop` | kit:glowSprite ring_pop | P0 | 64×64 | A 4-frame strip: a bubble ring expanding and fading (for the mote dissolve, spit-back) | 4 frames; legacyId `cell.fx.bubble_pop` |
| 64 | `living_gate.fx.frost_sparkle` | kit:glowSprite spark4 | P0 | 24×24 | A 4-point white sparkle for the gel ridge | legacyId `cell.fx.frost_sparkle` |
| 65 | `living_gate.fx.dust_puff` | kit:glowSprite puff | P0 | 96×64 | A soft cream puff (for the lock/latch and the Gatekeeper's ground shake) | legacyId `cell.fx.dust_puff` |

### 7.8 Props (shared and per contraption)
| # | Key | Source | P | Size | Description | Note |
|---|---|---|---|---|---|---|
| 66 | `living_gate.prop.console` | kit:lectern lectern | P0 | 120×125 (0.7 H) | A lectern (bible frame 5): cream body, gold rim, a slanted **slate** face (`#0F2A33`, lit cyan edge `#6ED2F2` @ 60 %) showing a tiny cross-section icon, and a navy band at its foot | every cell skin's `console` field points here; legacyId `cell.prop.console` |
| 67 | `living_gate.prop.kiosk` | kit:lectern kiosk | P0 | 180×200 | The boss console: a cream kiosk with a round emblem panel (concentric rings) and navy trim (bible frame 10) | e11 `consoleAsset`; legacyId `cell.prop.kiosk` |
| 68 | — | retired | — | 70×96 | A teardrop pin: `#0F2A33` fill, 3 px white stroke, a white chevron below, and a centre plate for DOM label | shared map pin (20 §2.6); legacyId `cell.prop.map_pin` |
| 69 | `living_gate.prop.plaque_post` | kit:compose(column, plate) | P0 | 70×140 | A lore post: cream, a round navy plate with a gold ring, a small cap | labels are DOM; legacyId `cell.prop.plaque_post` |
| 70 | `living_gate.prop.wisp_shard` | kit:crystalCluster stud | P2 | 48×48 | An insight shard: an indigo `#6A6CF0` faceted diamond with a white core (halo via #62) | `wisp.indigo`; legacyId `cell.prop.wisp_shard` |
| 71 | `living_gate.prop.seal_node` | kit:ringStack | P0 | 120×120 | A hub node: a bronze double ring with a glass core (dormant `#8FA6A0`). The lit state = the core `#C9F3FF` + the #62 halo | state `lit` at P1; legacyId `cell.prop.seal_node` |
| 72 | — | retired | — | 56×56 | A diamond with inner vertical lines (bible frame 4), white @ 80 % | shared interact diamond (`shared.ui.*`); legacyId `cell.prop.interact_glyph` |
| 73 | `living_gate.part.specimen_pods_pod` | hero | P0 | 150×80 | Pod base: cream, navy band, gold rim, round letter plate (blank) on its front | one file with #74 (pedestal + capsule); legacyId `cell.prop.pod_pedestal` |
| 74 | `living_gate.part.specimen_pods_pod` | hero | P0 | 120×150 | A glass capsule (`#C9F3FF` @ 30 %, white rim highlight left), bronze collar at the base, faint haze swirl inside | same file as #73; legacyId `cell.prop.pod_capsule` |
| 75 | `living_gate.fx.pod_fog` | kit:glowSprite puff | P0 | 120×150 | A white fog fill (for quarantine), soft edges | legacyId `cell.prop.pod_fog` |
| 76 | — | code | P0 | 120×150 | Crack lines (white 2 px, branching), drawn on reveal via mask | crack lines are code-drawn by the prefab; legacyId `cell.prop.pod_crack` |
| 77 | `living_gate.part.specimen_pods_mimic_mote` | hero | P0 | 160×60 | A 2-frame strip: a translucent jelly blob `#E8F6F8` @ 70 % with two dot "eyes", squished / stretched | requested slot (§9.5); legacyId `cell.prop.mimic_mote` |
| 78 | `living_gate.part.specimen_pods_probe_emitter` | hero | P0 | 60×150 | A pedestal emitter (bible frame 9): a coiled cream stem, a gold base ring, a cyan orb on top (pivot 0.5, 0.1) | legacyId `cell.prop.probe_emitter` |
| 79 | `living_gate.part.specimen_pods_needle` | hero | P0 | 60×240 | e1: a cream-and-gold piston with a thin gold tip, pivot at the top | legacyId `cell.prop.probe_needle` |
| 80 | `living_gate.part.membrane_router_crossing_gate` | hero | P0 | 520×620 | e2 Crossing Gate body: a cream arch 2.2 H above ground, whose ring body continues down through the bilayer band (a tube with navy bands). Dark interior mask where the doors open | legacyId `cell.prop.gate_socket` |
| 81 | `living_gate.part.membrane_router_gate_ring_outer` | kit:ringStack | P0 | 380×380 | e2: a cream ring with a gold rim and 8 navy grooves (pivot centre) | requested slot (§9.5); legacyId `cell.prop.gate_ring_outer` |
| 82 | `living_gate.part.membrane_router_gate_ring_inner` | kit:ringStack | P0 | 260×260 | e2: a bronze selectivity ring with 6 notches (pivot centre) | requested slot (§9.5); legacyId `cell.prop.gate_ring_inner` |
| 83 | `living_gate.part.membrane_router_gate_fin` | hero | P0 | 90×300 | e2: the left gold keystone fin half (bible frame 3's split fin) | requested slot (§9.5); the right fin is `flipX`; legacyId `cell.prop.gate_fin_left` |
| 84 | `living_gate.part.membrane_router_gate_fin` | hero | P0 | 90×300 | e2: the right half, mirrored | same file, `flipX`; legacyId `cell.prop.gate_fin_right` |
| 85 | `living_gate.part.membrane_router_oil_road` | kit:ringStack | P0 | 320×60 | e2: an elliptical navy inlay ring set in the heads, with 3 gold studs | ellipse 0.3; legacyId `cell.prop.oil_road_plate` |
| 86 | `living_gate.part.membrane_router_carrier_rocker` | hero | P0 | 560×200 | e2 payoff: a cream see-saw protein with a navy band and a cradle pocket (pivot centre bottom) | legacyId `cell.prop.carrier_rocker` |
| 87 | `living_gate.part.specimen_pods_dye_tank` | kit:compose (recipe `glass_tank`) | P0 | 780×310 | e3: a glass tank in a cream frame with gold corners, a slight blue tint, highlight streaks | the `glass_tank` recipe of 20 §5.4 / 02 §3a.1 (`plate` frame + `bilayerTile` strip_vertical + `waterBand` pool); legacyId `cell.prop.dye_tank` |
| 88 | `living_gate.part.specimen_pods_tank_window` | kit:bilayerTile strip_vertical | P0 | 40×300 | e3: a vertical bilayer strip (mini heads and tails) with 5 gaps | legacyId `cell.prop.tank_window` |
| 89 | `living_gate.part.specimen_pods_balance_pillar` | kit:column | P0 | 140×420 | e3: a cream pivot pillar, navy capital, gold hub (the beam's pivot at 0.5, 0.08) | legacyId `cell.prop.balance_pillar` |
| 90 | `living_gate.part.specimen_pods_balance_beam` | hero | P0 | 860×60 | e3: a gold beam with navy inlay and hooks at the ends (pivot centre) | legacyId `cell.prop.balance_beam` |
| 91 | `living_gate.part.specimen_pods_balance_float` | kit:plate | P0 | 70×90 | e3: a cream float bulb with a bronze hook | legacyId `cell.prop.balance_float` |
| 92 | `living_gate.part.specimen_pods_chain` | kit:linkStrip chain | P0 | 16×32, tileable vertically | a bronze chain link pair | legacyId `cell.prop.chain` |
| 93 | `living_gate.part.specimen_pods_basin` | kit:compose(plate, ashlarWall) | P0 | 620×300 | e4: a glass basin in a cream stone frame, a membrane window on its right wall | legacyId `cell.prop.osmo_basin` |
| 94 | `living_gate.part.specimen_pods_test_cell` | hero | P0 | 280×280 | e4: a ring of tiny heads (a circular bilayer) with a subtle gold inner line (scaled live) | one file with #95 (they scale together); legacyId `cell.prop.test_cell_ring` |
| 95 | `living_gate.part.specimen_pods_test_cell` | hero | P0 | 280×280 | e4: peach cytoplasm `#F6C48E` @ 80 %, a nucleus dot `#C98BB0`, 3 organelle specks (scaled live) | same file as #94; legacyId `cell.prop.test_cell_fill` |
| 96 | `living_gate.part.specimen_pods_raft_lock` | kit:compose(ashlarWall, plate) | P0 | 300×520 | e4: a stone shaft, a glass front, a gold rim, a water-level line guide, and a membrane window on the left | legacyId `cell.prop.raft_lock` |
| 97 | `living_gate.prop.raft` | kit:plate raft | P0 | 240×50 | e4: a cream raft with gold edging and two bronze cleats | the `e4_raft` vehicle; legacyId `cell.prop.raft` |
| 98 | `living_gate.part.tonicity_sluices_label_lock` | kit:compose(ashlarWall, waterBand pool) | P0 | 420×300 | e5/e9: a lock chamber with stone walls and bronze gates at both ends (the gate leaves are separate: #99) | legacyId `cell.prop.label_lock` |
| 99 | `living_gate.part.tonicity_sluices_lock_leaf` | kit:plate | P0 | 40×220 | a bronze gate leaf (pivot at the top hinge) | requested slot (§9.5); legacyId `cell.prop.lock_gate_leaf` |
| 100 | `living_gate.part.tonicity_sluices_valve_wheel` | hero | P0 | 220×220 | a bronze wheel, 3 spokes each ending in a small blank plaque (pivot centre) | legacyId `cell.prop.valve_wheel` |
| 101 | `living_gate.prop.basin_plaque` | kit:plate | P0 | 160×50 | a cream plaque with a gold border (blank; DOM label HYPO/ISO/HYPER, IN/OUT/NONE) | HYPO/ISO/HYPER, IN/OUT/NONE are DOM labels; legacyId `cell.prop.basin_plaque` |
| 102 | `living_gate.part.tonicity_sluices_basin` | kit:waterBand pool | P0 | 300×160 | a stone basin with a water surface (the water rendered in engine) | legacyId `cell.prop.holding_basin` |
| 103 | `living_gate.part.tonicity_sluices_eddy` | kit:waterBand pool | P0 | 300×160 | the basin with a spiral swirl pattern (rotated slowly) | legacyId `cell.prop.eddy` |
| 104 | `living_gate.prop.sluice_steps` | kit:stairs carved_wet | P0 | 360×260 | e5 payoff: carved cream steps with navy step-edges, wet sheen | prop with states hidden → revealed (e5 payoff art); legacyId `cell.prop.sluice_steps` |
| 105 | `living_gate.prop.side_stair` | kit:stairs carved_wet | P1 | 200×300 | e5: the narrow stair to the secret, half hidden by fronds | revealed by the e5 progress effect; on the trench's far wall (§2.5); legacyId `cell.prop.side_stair` |
| 106 | `living_gate.part.tonicity_sluices_cell_rbc` | hero | P0 | 160×90 | a red blood cell in 3/4 view: a biconcave disc `#E77A7A`, a lighter rim `#F4A3A0`, a darker dimple centre. No nucleus | legacyId `cell.prop.cell_rbc` |
| 107 | `living_gate.part.tonicity_sluices_cell_plant` | hero | P0 | 170×170 | a plant cell: a rigid rounded-square wall `#9ED6A0`/`#6FB78A` (6 px), a protoplast inside (peach, a separate layer #108), a blue vacuole bubble | the wall; the protoplast is #108; legacyId `cell.prop.cell_plant` |
| 108 | `living_gate.part.tonicity_sluices_cell_protoplast` | kit:molecule cell | P0 | 150×150 | the plant protoplast layer (scaled for plasmolysis) | requested slot (§9.5); legacyId `cell.prop.cell_protoplast` |
| 109 | `living_gate.part.tonicity_sluices_cell_generic` | kit:molecule cell | P0 | 160×160 | a round cell: a bilayer ring (mini heads), peach fill, a nucleus dot, 3 dots of solute | 20 §4.3 tags it H(small); kit keeps the hero count at 36; legacyId `cell.prop.cell_generic` |
| 110 | `living_gate.part.tonicity_sluices_cell_potato` | hero | P0 | 170×170 | a plant-cell variant with 5 cream starch ovals inside | legacyId `cell.prop.cell_potato` |
| 111 | `living_gate.part.tonicity_sluices_barge` | kit:compose(plate raft, railing) | P0 | 360×80 | e9: a cream barge with a gold rail and the console bolted mid-deck | the `e9_barge` vehicle; legacyId `cell.prop.barge` |
| 112 | `living_gate.part.carrier_lanes_carrier_door` | hero | P0 | 420×415 | e6: a revolving cream drum (2.4 H), one deep cargo pocket, gold hinge rings, navy bands (pivot centre) | legacyId `cell.prop.carrier_door` |
| 113 | `living_gate.prop.hall_facade` | kit:facade hall_ring_windows | P0 | 1200×700 | e6: the Pump Hall façade: cream stone, a navy band frieze, three ring windows, the door niche | zone B, x 7600–8400; legacyId `cell.prop.hall_facade` |
| 114 | `living_gate.part.carrier_lanes_glide_gate` | kit:compose(ringStack, stairs) | P0 | 300×260 | e6: a channel ring + a small carrier rocker at the foot of a ramp | legacyId `cell.prop.glide_gate` |
| 115 | `living_gate.part.carrier_lanes_pump_gate` | hero | P0 | 260×300 | e6: a compact pump: a cream body, gold trim, an ATP intake port on top | legacyId `cell.prop.pump_gate` |
| 116 | `living_gate.part.carrier_lanes_ramp_wedge` | kit:stairs | P0 | 120×40 | e6/e11: a stone wedge (slope set by scaleY and flip), dense dots at the high end | reused by `gatekeeper_maws`; legacyId `cell.prop.gradient_ramp` |
| 117 | `living_gate.part.gatekeeper_maws_atp_pipe` | kit:linkStrip pipe | P0 | 40×128, tileable vertically | a gold pipe with a navy band every 64 px | reused by e6/e7; legacyId `cell.prop.atp_pipe` |
| 118 | `living_gate.part.specimen_pods_low_tank` | kit:compose(plate slate, waterBand) | P0 | 300×260 | e7: a glass tank in a cream frame with a fill-line groove | legacyId `cell.prop.flume_tank_low` |
| 119 | `living_gate.part.specimen_pods_high_tank` | kit:compose(plate slate, waterBand, column) | P0 | 300×260 | e7: the same tank on a 1.2 H plinth with navy trim | legacyId `cell.prop.flume_tank_high` |
| 120 | `living_gate.part.specimen_pods_flume_pump` | hero | P0 | 200×260 | e7: a pump body with a piston (the piston a separate child in the same SVG group id `piston`), gold feed port | legacyId `cell.prop.flume_pump` |
| 121 | `living_gate.prop.leak_trough` | kit:stairs | P0 | 400×80 | e7: a sloped stone trough, high → low | legacyId `cell.prop.leak_trough` |
| 122 | `living_gate.part.specimen_pods_lantern` | kit:compose(ringStack, glowSprite) | P0 | 60×110 | a bronze lantern cage with a dark glass core (lit = #46 pool + the core tinted `#FFF6D8`) | also Kay's three `lantern_*` touch props (P1); legacyId `cell.prop.atp_lantern` |
| 123 | `living_gate.prop.gantry_platform` | kit:plate | P0 | 360×60 | e7: a cream platform with a gold edge and rail clamps | the `e7_gantry` vehicle; legacyId `cell.prop.gantry_platform` |
| 124 | `living_gate.prop.gantry_rail` | kit:linkStrip rail | P0 | 40×128, tileable vertically | a gold rail with navy ties | legacyId `cell.prop.gantry_rail` |
| 125 | `living_gate.part.pump_rewiring_pump_housing` | hero | P0 | 600×620 | e8: the Na⁺/K⁺ pump outer housing (3.5 H): cream stone, 2 navy bands, a gold rim, a circular drum bay, jaw slots top and bottom, an ATP port on the right shoulder | legacyId `cell.prop.nak_housing` |
| 126 | `living_gate.part.pump_rewiring_jaw_upper` | hero | P0 | 300×120 | e8: the upper jaw plate (pivot at the left hinge) | legacyId `cell.prop.nak_jaw_upper` |
| 127 | `living_gate.part.pump_rewiring_jaw_lower` | kit:plate | P0 | 300×120 | e8: the lower jaw plate (pivot at the left hinge) | 20 §4.3 tags it H; kit at P0 (hero count); legacyId `cell.prop.nak_jaw_lower` |
| 128 | `living_gate.part.pump_rewiring_drum` | hero | P0 | 320×320 | e8: the inner drum: a cream disc, a gold rim, 6 radial socket bays (pivot centre) | legacyId `cell.prop.nak_drum` |
| 129 | `living_gate.part.pump_rewiring_socket` | kit:ringStack | P0 | 40×40 | e8: a coral-rimmed socket cup | one slot; coral or violet rim tinted by the prefab; legacyId `cell.prop.socket_na` |
| 130 | `living_gate.part.pump_rewiring_socket` | kit:ringStack | P0 | 46×46 | e8: a violet-rimmed socket cup | same key as #129; legacyId `cell.prop.socket_k` |
| 131 | `living_gate.prop.cable_plinth` | kit:compose(plate, ringStack) | P0 | 160×240 | e8: a control plinth with 4 round cable sockets (bronze rings) | legacyId `cell.prop.cable_plinth` |
| 132 | `living_gate.part.pump_rewiring_cartridge` | kit:plate cartridge | P0 | 110×60 | e8: a blank value cartridge (a cream body, gold contacts, a label window for DOM label) | labels are DOM; legacyId `cell.prop.cartridge` |
| 133 | `living_gate.prop.cartridge_rack` | kit:shelving rack_bays | P0 | 220×360 | e8: a rack with 5 bays | legacyId `cell.prop.cartridge_rack` |
| 134 | `living_gate.part.pump_rewiring_hall_gate` | kit:compose(railing, ringStack) | P0 | 500×520 | e8: a portcullis-like gate (cream bars with navy bands, gold ring medallion), lifted by a chain | legacyId `cell.prop.hall_gate` |
| 135 | `living_gate.part.endocytosis_lift_halcyon` | hero | P0 | 380×170 | the *Halcyon*: a brass-and-cream teardrop submarine, a round porthole (gold ring, cyan glass), a navy stripe, a small tail fin and propeller, 4 rivets per panel | also the intro prop at zone A x 300; legacyId `cell.prop.halcyon` |
| 136 | `living_gate.part.endocytosis_lift_clathrin_cell` | kit:molecule hex_ring | P0 | 64×56 | e10: one lattice cell (a hexagon of 3 triskelion legs, cream with gold joints). Tiled along the curve in engine | legacyId `cell.prop.clathrin_cell` |
| 137 | `living_gate.part.endocytosis_lift_dynamin_collar` | hero | P0 | 180×70 | e10: a coiled gold ring (a helix wrap) that tightens (scaleX) | legacyId `cell.prop.dynamin_collar` |
| 138 | `living_gate.prop.lift_frame` | kit:column | P0 | 220×520 | e10: a cream gantry with a navy band and 4 round stage-lamp bays | legacyId `cell.prop.lift_frame` |
| 139 | `living_gate.part.endocytosis_lift_stage_lamp` | kit:ringStack | P0 | 90×90 | e10: a bronze-framed round plate (a blank face for the plank icon) | legacyId `cell.prop.stage_lamp` |
| 140 | `living_gate.part.endocytosis_lift_vesicle` | kit:bilayerTile ring | P0 | 420×420 | e10: a vesicle: a circular bilayer ring (mini heads outward and inward) with a translucent fill | the `e10_vesicle` vehicle; legacyId `cell.prop.vesicle_shell` |
| 141 | `living_gate.prop.microtubule_rail` | kit:linkStrip microtubule | P0 | 256×40, tileable | e10/S7: a single microtubule tube with navy bands | also the `high_rail` platform asset (P1); legacyId `cell.prop.microtubule_rail` |
| 142 | `living_gate.part.gatekeeper_maws_gatekeeper_body` | hero | P0 | 900×1040 | e11: the **Gatekeeper** (6 H): a massive seated cream-stone protein body, navy inlay bands, gold phosphate bosses on the shoulders, three maw openings at chest height (dark interiors), and a back ridge where the ATP pipe mounts. Soft violet shadows | legacyId `cell.prop.gk_body` |
| 143 | `living_gate.part.gatekeeper_maws_eye_ring` | hero | P0 | 260×260 | e11: the eye-ring's outer concentric broken rings (bronze + gold) | legacyId `cell.prop.gk_eye_outer` |
| 144 | `living_gate.part.gatekeeper_maws_eye_pupil` | kit:ringStack | P0 | 140×140 | e11: the inner pupil-ring (rotates; a gold notch marks its facing) | requested slot (§9.5); legacyId `cell.prop.gk_eye_pupil` |
| 145 | `living_gate.part.gatekeeper_maws_maw_oil` | hero | P0 | 220×180 | e11: the Oil Maw lining (a ring of lipid heads around the opening) | legacyId `cell.prop.gk_maw_oil` |
| 146 | `living_gate.part.gatekeeper_maws_maw_channel` | hero | P0 | 180×180 | e11: a bronze selectivity ring with 6 notches (pivot centre) | legacyId `cell.prop.gk_maw_channel` |
| 147 | `living_gate.part.gatekeeper_maws_maw_pump` | hero | P0 | 220×180 | e11: gold phosphate "teeth" plates around the opening (upper and lower plates in groups for opening) | legacyId `cell.prop.gk_maw_pump` |
| 148 | `living_gate.part.gatekeeper_maws_atp_pipe` | kit:linkStrip pipe | P0 | 80×700 | e11: a thick gold pipe with navy clamps up the back | same key as #117, longer instance; legacyId `cell.prop.gk_atp_pipe` |
| 149 | `living_gate.prop.nuclear_pore` | hero | P0 | 960×960 | S8 hub gate outer ring: cream, a gold rim, **8 spokes** (the nuclear pore complex's eightfold symmetry), 11 conduit sockets around the rim (bronze cups), and a gold fin at the top that splits (bible frame 3). Pivot centre | zone D hub asset (`hub.asset`); zone D hero landmark; legacyId `cell.prop.pore_outer` |
| 150 | `living_gate.prop.pore_inner` | kit:ringStack | P0 | 620×620 | the inner ring: navy grooves, gold notch (counter-rotates) | counter-rotates in the finale; legacyId `cell.prop.pore_inner` |
| 151 | `living_gate.prop.pore_plug` | kit:ringStack | P0 | 300×300 | the central plug: a cream disc with concentric rings (retracts on open) | retracts in the finale; legacyId `cell.prop.pore_plug` |

### 7.9 Characters
| # | Key | Source | P | Size | Description | Note |
|---|---|---|---|---|---|---|
| 152–173 | `shared.char.diver` | rig (`pnpm chars:build`) | P0 | 192×256 frames | Kenney `toon-characters` **female_adventurer**, recoloured from `Vector/character_femaleAdventurer.svg` (§3.1); 25 poses used: `idle, walk0–7, run0–2, jump, fall, climb0/1, interact, switch0/1, talk, think, cheer0/1, show, hold`. CC0 | replaces rev. 1's 22 tinted PNG frames (`setTint` is dropped) |
| 174 | `living_gate.costume.diver_helmet` | hero | P0 | 88×88 | A clear bubble helmet overlay (§3.1), anchored to the head point per frame | overlay on rig anchor `head`; legacyId `cell.char.diver_helmet` |
| 175 | `living_gate.costume.diver_scarf` | hero | P0 | 40×18 | One scarf segment (aqua with a stripe). 3 instances in a spring chain | anchor `back`, `follow: spring`; legacyId `cell.char.diver_scarf` |
| 176 | `living_gate.costume.probe_staff` | hero | P0 | 24×190 | A cream staff, gold ferrule, glass bulb (the bulb is tinted in engine: cyan / orange) | anchor `hand_r`; bulb tint is runtime; legacyId `cell.char.probe_staff` |
| 177 | `living_gate.companion.pip` | hero | P0 | 38×26 | Pip: a cream teardrop mini-sub, gold porthole ring, cyan glass | `cast.guide.companion.asset`; legacyId `cell.char.pip_hull` |
| 178 | — | code | P0 | 12×12 | A 2-frame propeller blur strip | the propeller blur is drawn by the companion actor; legacyId `cell.char.pip_prop` |
| 179 | `living_gate.companion.ora_bust` | hero | P0 | 220×220 | Ora in the comms porthole (§3.2): head and shoulders, headset, goggles up, aqua jumpsuit, **grinning** | `cast.guide.portrait`; legacyId `cell.char.ora_portrait` |
| 180 | `living_gate.companion.ora_bust_focus` | hero | P1 | 220×220 | The same pose, **focused** (brows in, tongue-in-cheek concentration) | the `<asset>_<pose>` sibling; legacyId `cell.char.ora_portrait_focus` |
| 181 | `living_gate.ui.porthole_frame` | kit:ringStack | P0 | 240×240 | A bronze ring with 8 rivets and a glass glare arc (frames the portraits) | legacyId `cell.char.porthole_frame` |
| 182 | `living_gate.npc.sucra` | hero | P1 | 100×104 | Sucra: a hexagon-ring body (cream, gold outline), two short legs, a satchel with a tag, round eye dots in the ring's centre | one puppet file; walk and talk are code motion; legacyId `cell.char.sucra_idle` |
| 183 | `living_gate.npc.sucra` | hero | P1 | 100×104 | walk frame A | folded into the puppet; legacyId `cell.char.sucra_walk0` |
| 184 | `living_gate.npc.sucra` | hero | P1 | 100×104 | walk frame B | folded into the puppet; legacyId `cell.char.sucra_walk1` |
| 185 | `living_gate.npc.sucra` | hero | P1 | 100×104 | talk (one leg lifted, satchel swinging) | folded into the puppet; legacyId `cell.char.sucra_talk` |
| 186 | `living_gate.npc.poro` | hero | P0 | 180×280 | Poro: an hourglass-waisted stone statue (cream with navy bands, a single-file groove down the waist), two eye-glyph slots | zone B hero landmark (a static statue prop at P0, the NPC asset at P1); legacyId `cell.char.poro` |
| 187 | `living_gate.fx.poro_eyes` | kit:glowSprite | P1 | 80×24 | A 2-frame strip: eyes half-closed (sleepy) / open (glowing `#8FE0EA`) | legacyId `cell.char.poro_eyes` |
| 188 | `living_gate.npc.kay` | hero | P1 | 90×170 | Kay: a violet sphere body with a white "+" badge, stubby arms, holding a cream lamp pole with a gold hook | one puppet file; legacyId `cell.char.kay_idle` |
| 189 | `living_gate.npc.kay` | hero | P1 | 90×170 | Kay raising the lamp pole | folded into the puppet; legacyId `cell.char.kay_raise` |
| 190 | `living_gate.npc.kay` | hero | P1 | 90×170 | Kay with arms up, the pole overhead | folded into the puppet; legacyId `cell.char.kay_cheer` |
| 191 | `living_gate.npc.ferryman` | hero | P1 | 210×210 | The Ferryman: a triskelion of three curved cream legs with gold joints, a hub with a hanging small gold ring. Roll frame A | one puppet file; the roll is code motion; legacyId `cell.char.ferryman_0` |
| 192 | `living_gate.npc.ferryman` | hero | P1 | 210×210 | Roll frame B (rotated 40°, legs flexed) | folded into the puppet; legacyId `cell.char.ferryman_1` |

### 7.10 UI (biome-specific; the shared panel kit is listed in the shared UI doc, not here)
| # | Key | Source | P | Size | Description | Note |
|---|---|---|---|---|---|---|
| 193 | — | data | P0 | 64×64 | Ora's emblem (§3.2): a dark disc, 3 broken rings, a ring of 16 dots with inward twin ticks | `cast.guide.emblem` {glyph `cell`}; legacyId `cell.ui.emblem_ora` |
| 194 | — | data | P0 | 64×64 | A bronze disc, 3 gold rings, 3 notches at the bottom | `cast.speakers[gatekeeper].emblem` {glyph `maws`}; legacyId `cell.ui.emblem_gatekeeper` |
| 195 | `living_gate.ui.bin_bilayer` | kit:compose(bilayerTile, stairs) | P1 | 240×90 | Bin-card art: a bare bilayer strip with a dotted straight-through path (e2 Oil Road, e11 Oil Maw) | CSS background of the RouterControl bin card; legacyId `cell.ui.bin_bilayer` |
| 196 | `living_gate.ui.bin_channel` | kit:compose(bilayerTile, ringStack) | P1 | 240×90 | A bilayer strip with a channel ring and a dotted path through it (e2 gate, e11 Channel Maw) | legacyId `cell.ui.bin_channel` |
| 197 | `living_gate.ui.bin_carrier` | kit:compose(bilayerTile, stairs) | P1 | 240×90 | A strip with a carrier rocker and a downhill arrow (e6 Glide Gate) | legacyId `cell.ui.bin_carrier` |
| 198 | `living_gate.ui.bin_pump` | kit:compose(bilayerTile, glowSprite) | P1 | 240×90 | A strip with a pump, a gold spark and an uphill arrow (e6 Pump Gate, e11 Pump Maw) | legacyId `cell.ui.bin_pump` |
| 199 | `living_gate.ui.icon_charge` | kit:molecule | P2 | 32×32 | A "±" legend glyph | legacyId `cell.ui.icon_charge` |
| 200 | `living_gate.ui.icon_shell` | kit:molecule | P2 | 32×32 | A hydration-shell legend glyph (a dot inside a ring of droplets) | legacyId `cell.ui.icon_shell` |
| 201 | — | code | P0 | 7×(48×48) strip | e8 stage icons: rest, bind Na⁺, ATP, flip out, swap, drop P, flip in (white line art) | the e8 stage names are ProbeSpec `stops` labels; the schematic card draws the pose; legacyId `cell.ui.stage_icons` |
| 202 | `living_gate.ui.plank_touch` … | kit:plate (5 entries) | P0 | 5×(48×48) strip | e10 plank icons: touch, fold, pinch, carry, dissolve (white line art) | `plank_touch`, `plank_fold`, `plank_pinch`, `plank_carry`, `plank_dissolve`: the ids in e10 `stages[].icon`; legacyId `cell.ui.plank_icons` |
| 203 | — | data | P2 | 900×900 | The map (§6.4): concentric cell rings (a dotted bilayer ring, cytoplasm fill `#F6C48E` @ 20 %, a nucleus ring with 8 notches), a dotted route trace, and 11 gate-icon bays. Panel-card style (`ui.card` fill, `ui.line` strokes) | `story.map` style `cell_rings`, drawn by MapOverlay; legacyId `cell.ui.cell_chart` |
| 204 | — | DOM | P0 | 220×24 | The HUD gradient bar frame: two rows of 12 tiny heads (fills driven by G) | MeterBar (20 §2.6); a bilayer CSS skin is P2; legacyId `cell.ui.gradient_bar` |

### 7.10b New kit entries (revision 2)

Keys the zone, station and side-content JSON reference that revision 1 did not list. All are kit entries in
`art/living_gate/biome.json`.

| Key | Source | P | Size | Use |
|---|---|---|---|---|
| `living_gate.layer.tide_cliffs_dusk` | kit:ridgeBand | P0 | 2048×700, tileable | `pit` layer set (the #8 params in the pit palette) |
| `living_gate.prop.root_ledge` | kit:compose(canopy bead_tree, groundStrip ledge_cap) | P0 | 200×150 | zone A `root_ledge` platform art (plaque P1) |
| `living_gate.prop.stud_ledge` | kit:compose(crystalCluster stud, groundStrip ledge_cap) | P0 | 260×120 | zone A `stud_ledge` platform art (plaque P2) |
| `living_gate.prop.pit_terrace` | kit:compose(bilayerTile fluid, column pylon) | P0 | 2320×340 | zone C `pit_ledge` platform: a membrane terrace on pylons over the quay |
| `living_gate.prop.deck_ladder` | kit:linkStrip ladder | P0 | 40×340 | `c_deck_ladder` |
| `living_gate.part.specimen_pods_letter_plate` | kit:plate | P0 | 40×40 | 20 §4.3 slot; the letter is DOM |
| `living_gate.part.specimen_pods_ion` | kit:molecule | P0 | 60×60 | e1 Na⁺ with its hydration shell (20 §4.3 slot `ion`) |
| `living_gate.part.membrane_router_lane_mouth` | kit:ringStack | P0 | 160×60 | 20 §4.3 slot; queue origin for each lane |
| `living_gate.part.pump_rewiring_beacon_tower` | kit:compose(column, glowSprite) | P0 | 120×300 | 20 §4.3 slot (the plinth-side beacon lamp; the far Nerve Beacon is the P1 prop) |
| `living_gate.ui.plank_touch`, `plank_fold`, `plank_pinch`, `plank_carry`, `plank_dissolve` | kit:plate | P0 | 48×48 each | the e10 `stages[].icon` / `items[].meta.glyph` ids (white line art on a blank plate) |
| `living_gate.prop.garden_alcove` | kit:compose(ashlarWall, canopy frond) | P1 | 260×200 | zone B `garden_alcove` platform art |
| `living_gate.prop.pipe_run` | kit:linkStrip pipe | P1 | 260×40 | zone C `pipe_run` platform art (lantern 1) |
| `living_gate.prop.rail_vesicle` | kit:bilayerTile ring | P1 | 180×180 | the `d_gulf_ride` vehicle |
| `living_gate.prop.conduit_segment` | kit:linkStrip tube_window | P1 | 600×12 | the 11 `conduit_*` props on the seam line, state `lit` |


### 7.11 Count

| Kind | Unique keys | Notes |
|---|---|---|
| Hand-authored heroes, P0 | **36** | 14 in zone A (§0.1.2) |
| Hand-authored heroes, P1 | +4 (**40**) | Ora focus bust, Sucra, Kay, the Ferryman |
| Kit entries from these rows | 118 unique keys | + `tide_cliffs_dusk`, `ui.plank_*` ×5, the zone props (`root_ledge`, `stud_ledge`, `garden_alcove`, `pit_terrace`, `pipe_run`, `deck_ladder`, `rail_vesicle`, `conduit_*`) ≈ 120 kit entries in `biome.json` |
| Rig | 1 | `shared.char.diver` (A1 builds it in W1) |
| Retired / data / code / DOM | 12 rows | no file |

Revision 1 planned 182 authored SVGs and 22 PNG frames. The budget (02 §3f) is ≤ 1.2 MB of SVG source and ≤ 135 MB
resident VRAM per zone at dpr 1.5 (zone B, four stations, is the peak).

---

## 8 · Fidelity mapping (bible §9 checklist, 44 items, 14 ★; 20 §8.3)

The rubric is bible §9 (44 items, 14 ★: 1, 2, 9, 11, 15, 18, 21, 27, 30, 34, 35, 38, 40, 42), scored per 20 §8.3:
**P0 pass = all ★ + ≥ 36/44** with items 37, 43 and 44 scored on zone A only; **full pass = all ★ + ≥ 39/44**.

| # | Item | How *The Living Gate* satisfies it |
|---|---|---|
| 1 ★ | Painterly parallax, ≥ 5 layers | Every layer set has 5–8 layers across L1 (0.05 swirl, 0.15 far), L2 (0.35), L3 (0.6), L4 play (1.0), L5 (1.3) and L6 light, plus the segment sky gradient (§2.3, §2.5.3) |
| 2 ★ | No 1-bit tiles | Everything is from §7; the Expedition host never loads the Kenney 1-bit sheet |
| 3 | Sky gradient ≥ 3 stops | Six segment skies of 3–4 stops (§2.5.3) |
| 4 | Architecture vocabulary | Every play screen has rings (gates, pore, drum, pods), gold trim (= ATP), navy inlay (the oil seam runs through every frame), and pillars (the lipid colonnade itself) |
| 5 | Soft coloured light, no pure black | The darkest world tokens sit at the 20 §5.3 floor (§2.2); shadows are `#6E7F9A` multiply, from the upper-left key light |
| 6 | Glow = live; dormant desaturated | Unsolved contraptions at −40 % ColorMatrix with no glow; solved ones re-saturate over 600 ms (§2.4); the Pump Hall is dark until e7 |
| 7 | Foreground framing ≥ 50 % of frames | L5 fronds, bubbles, balustrade and actin in every layer set, culled away from stations (W3) |
| 8 | Biome identity from a thumbnail | The cream-and-gold **bilayer band across the lower third**, with an aqua sky or amber cytoplasm |
| 9 ★ | Articulated protagonist, 14–18 % height, walk/idle/interact | The Diver on the shared rig at 16 %, 8-frame walk, idle breath, interact → switch, hop/fall/climb poses, helmet, scarf and staff overlays (§3.1) |
| 10 | Scale ladder | Nuclear Pore 5.5 H, Gatekeeper 6 H, pump 3.5 H, consoles 0.7 H (§2.1) |
| 11 ★ | Guide emblem in the bar + a companion near the player | Ora's `cell` emblem in every bar line; **Pip** at the shoulder, pulsing when she speaks and flying to hint targets |
| 12 | Objective ring shows restoration | The zone ring fills per gate, plus `GATES n/11` and the Gradient meter (§6.2) |
| 13 | Instruction + insight per encounter, in world terms | Every station has an `instruction` naming its object or part (R9) and an `insight` stated as a world truth, then a `success` concept statement (§4.3) |
| 14 | Sensitivity (history only) | n/a. The stylization notes in §2.1 cover scientific honesty instead |
| 15 ★ | World ≥ 45 % visible, undimmed | Scrub layout 58 %, board 45 % (20 §3.1); no dim except the finale flood |
| 16 | Panel material | The shared panel (20 §3.1): `rgba(38,92,106,.86)` + blur + hex grid |
| 17 | Circuit-trace terminals ≥ 3 | The panel rail, the dialogue divider, the Verify flank lines, the e10 slot rail's dot-ended connectors |
| 18 ★ | Graph/gauge cards, bordered, tabbed, ticks + grid | `graph` cards in e1, e3, e4 and e7 with labelled ticks, grids, live dots and annotations; `bars` in e5/e8/e9; `schematic` in e8/e10; `energy_cells` (gold) in e6/e10/e11 |
| 19 | Axis units | nm (e1), mM (e3, e7), % (e4), ATP/s (e7), stage (e8, e10), seconds (e5/e9) |
| 20 | Function colours consistent | **white = outside, green = inside, blue = water/volume, gold = ATP**, in the panel and in world chips |
| 21 ★ | Orange scrubber through all cards, tab + readout | e1 "d", e3 "a", e4 "s", e7 "r" (shared x across 3 cards), e8 "k" (stage), e10 "k" (playback) (R4) |
| 22 | Value chips on the card edge with units | "2.4 nm", "5.0 mM", "0.74", "C_high 8.6 mM", "q = +1", "−2" |
| 23 | Back arrow | Every panel (R9); it closes without grading and keeps the draft |
| 24 | Verify named for the machine, disabled until complete | QUARANTINE · THAW RIDGE / LEVEL LOCK / FLOOD LOCK / LIGHT HALL, ROUTE CARGO, DRAIN THE SLUICE, OPEN THE THRESHOLD, RUN ONE CYCLE, FILL THE LOCK, LAUNCH THE LIFT, OPEN THE VAULT |
| 25 | Success badge with brackets | MIMIC QUARANTINED, CARGO ROUTED, SLUICE DRAINED, THRESHOLD OPEN, PUMP CYCLING, LOCK FILLED, VESICLE LAUNCHED, VAULT OPEN |
| 26 | Board tokens from a palette, snapping, keyboard-operable | Molecule and cargo tokens (e2, e6, e11), cartridges (e8) and plates (e10); keyboard per R10 |
| 27 ★ | Bar anatomy: emblem, i, text | Emblem (Ora, the Gatekeeper or an extra), the (i) button voices the guide rungs, typewriter at 45 cps |
| 28 | Sentence style ≤ 2 lines | All 172 lines ≤ 140 characters and ≤ 24 words (§4.4) |
| 29 | Legibility ≥ 28 px, contrast ≥ 7:1 | White on the panel (≈ 8.9:1); 20 §3.5's projector floor |
| 30 ★ | Live reaction with ≥ 3 intermediate poses | Needle and head parting (e1); molecules gliding to lanes (e2); dye sim + beam tilt (e3); the cell swelling and shrinking (e4); the cell drifting and the bath filling (e5/e9); the ATP hatch + intake glow (e6); tanks and piston (e7); drum, jaws and ions (e8); membrane fold playback (e10); eye-ring and maws (e11) |
| 31 | World chips on driven parts; pins on targets | Chips per R6 on every driven part; pins "GATE 2" on the Crossing Gate and "ISO 2%" on the basin |
| 32 | Eased physicality, lag ≤ 0.4 s | The controller's 110 ms time constant (≈ 330 ms to 95 %); osmosis ≤ 0.4 s; the tank τ = 1.2 s is the *simulation* |
| 33 | Partial feedback near/far, no answer | The beam tilt (e3); cell volume vs isotonic (e4); the ledger q (e8); lane counts; first-miss-only verdicts (R2, R5) |
| 34 ★ | In-world success animation 1.2–2.5 s with sound hook | Every §5 block has a timeline of 2.2–2.5 s with cue ids mapped in §6.7 |
| 35 ★ | Payoff is traversal | Ramp (e1), rocker ramp (e2), boom lifts (e3), **raft ride** (e4), steps emerge (e5), **door carries you** (e6), **gantry ride** (e7), gate lifts (e8), **barge rises** (e9), **the vesicle carries you into the cell** (e10), pore opens (e11) |
| 36 | Visible misconception | Every §5 block has a "Visible misconception" tied to the fixture's `targetMisconception` |
| 37 | ≥ 2 non-walk verbs per zone | Zone A at P0 (hop, climb); zones B, C, D at P1 (§2.6); W2 clean at P1 |
| 38 ★ | The orange input moves a world object in every encounter | Probes on e1, e3, e4, e7, e8, e10; the aim beam (hover) on the mimic pods; queues on e2, e6, e11; the wave cell and valve wheel on e5, e9 |
| 39 | The boss has staged presentation | e11: arena cutscene, three batches with lines, taunts, maw reactions, eye tracking, pipe surge (§5.11) |
| 40 ★ | Hints act in the world | Every station lists Pip's flights and its tier effects; Pip's water lens at tier 1 on e2 and e11 (R11) |
| 41 | First world reaction ≤ 150 ms after panel input | `bind` is synchronous and the next frame applies the eased pose (20 §2.5.3) |
| 42 ★ | Payoff is used, not shown | Every payoff of item 35 is the only route on (blockers + sheer edges); rides and carries move the player through it |
| 43 | Explore never silent (≤ 20 s) | P0: intro lines, the plaques and station approach lines in zone A; P1: the §6 arrival and walk triggers in every zone |
| 44 | Sandbox or quest touch per zone | P1: Kay's Lanterns (touch ×3), the Plant Cell Garden; at P0 zone A has no ungraded touch yet, an expected P0 miss inside the ≥ 36/44 margin |

**Self-score (design intent): 44/44** at full, with item 14 not applicable (counted as a pass). The implementation is scored from
screenshots by the critic (R, 20 §7.2, §8.3).

---

## 9 · Generalization notes

### 9.1 Reusable archetypes (any game whose encounter has that `familyId.mode`)

| Archetype (skins used here) | Mode | Reusable because | What a PDF game's World Writer fills (20 §4.4 writer schema) |
|---|---|---|---|
| `claim_holders` (`specimen_pods`) | `truth_finder.mimic` | Any three claims about any phenomenon: the pods, beam, quarantine and failure sequence are generic; only the reference sim and ghost ids vary | `holders[].ghost` from the domain's ghost registry, `referenceSim`, `probe`; code fills the aimer and quarantine animation from the biome kit |
| `router_lanes` (`membrane_router`, `carrier_lanes`, `gatekeeper_maws`) | `sorter.bins` | 2–4 lanes with queues, first-miss bounce, count chips, optional energy card and boss phases | per item `{printedDate, madeYear, polar, charged, from, to}` |
| `sluice_waves` (`tonicity_sluices`) | `sorter.type_match` | Timed waves through one lock into category basins; hover renders the claim; Verify at the end | per wave `{cell, inDots, outDots, fate, showFate}` |
| `stage_machine` (`pump_rewiring`) | `linker.pairs` | Sockets ↔ cartridges with a stage scrubber and a first-wrong-stage jam | per left `{stage, socketKind, ion}`, per right `{kind, n, dir}`; never auto-picked (it needs authored semantics) |
| `step_bridge` (`endocytosis_lift`) | `sequencer.linear` | Any process whose steps have physical preconditions: a wrong order meets the physics | per step `{printedDate, glyph}`; `stages` come from a stage-pose library (`membrane_fold` today) |

The **biology sims** (`src/world/sims/`) are reusable across any biology PDF that touches gradients: `bilayer_probe`
(e1; the ground itself), `diffusion_tank` (e3), `osmotic_cell` (e4; also the garden), `pump_flume` (e7), `membrane_fold`
(e10). They are keyed by concept type, not by this fixture, and each carries its ghost registry with honesty tags.

### 9.2 What is subject-specific (hand-written here, written by the pipeline later)
- **Biome kit** `living_gate`: palette tokens (§2.2), layer sets and zone presets (§2.3), the molecule glyphs, the hero
  parts (§0.1.2). A PDF game in a biology domain reuses this kit through `rankBiomes` (20 §6.4).
- **Story overlay**: title, the Stillness framing, the Gradient meter, zone names, the extras roster, and every line in §4.3.
- **Per-encounter config**: which sim, which ghosts, probe ranges and units, per-item properties, cartridge semantics,
  wave fates (§5.x station JSON).
- **Geometry and traversal**: zones, heightfields, platforms, links, cutscenes (§2.5, §2.6, §4.2): code-derived from the
  kit's zone presets and traversal templates for generated games (20 §6.2).

### 9.3 The side-car (`fixtures/worlds/cell-transport.world.json`)

The contract is 20 §1.3 (`WorldFile`, `WorldOverlay`, `worldVersion: 2`, strict objects). The root, with pointers to
the sections that hold each array:

```json
{
  "appliesTo": {"specIds": ["cell_demo_001"], "sources": [{"sourceId": "src_cell_transport", "genre": "dungeon"}]},
  "world": {
    "worldVersion": 2,
    "biome": "living_gate",
    "title": "The Living Gate",
    "subtitle": "Cell V-7 · a membrane expedition",
    "cast": "§3.5",
    "story": "§6.2",
    "zones": ["§2.5 zone_a", "zone_b", "zone_c", "zone_d"],
    "stations": ["§5.1 … §5.11, encounter order"],
    "props": "§2.5.4 (P0) + §6.3 (P1)",
    "npcs": "§6.3",
    "quests": "§6.3",
    "triggers": "§6.3",
    "sandboxes": "§6.3 JSON (design in §6.5)",
    "collectibles": "§6.6 (P2)",
    "plaques": "§6.1",
    "cutscenes": "§4.2",
    "feedbackNouns": [
      {"from": "chests", "to": "pods", "stations": ["e1_bilayer", "e3_diffusion", "e4_osmosis", "e7_active"]},
      {"from": "chest", "to": "pod", "stations": ["e1_bilayer", "e3_diffusion", "e4_osmosis", "e7_active"]}
    ]
  }
}
```

`validateWorld` expectations for this side-car (20 §1.5): zero errors; warnings: W1 for `zone_d` (§1.3), and at P0 W2
for zones B, C and D (their second verbs are P1; W2 is clean at P1).

### 9.4 Checks the content agent must run
- The §4.4 line check prints `172 lines; clean`.
- `validateWorld(spec, world)` returns no issues (`tests/world-sidecars.test.ts` resolves the side-car for
  `cell_demo_001` and for a mock-generated cell spec).
- `pnpm art:build --ns living_gate --check` is clean, `heroCount` is 36 at P0 (40 at P1), and every hero has a
  `kitFallback`.
- **No fixture, mode or contract changes.** Every item here is side-car data, art, or a meta/prefab detail owned by
  the KB lane; `grade()` stays the single source of truth.

### 9.5 What revision 1's extensions became, and the slot requests

| Rev. 1 | Was | Now |
|---|---|---|
| X1 | `onDraft` + `HostHandle.setDraft` | `Draft` / `DraftInputs` → `host.bindDraft` (20 §2.5.1, §3.4) |
| X2 | exploration scrubber over `setLiveValue` | `ProbeSpec` in the config + `Draft.probe` (20 amendment 3) |
| X3 | `firstMiss(params, input)` exported per mode | dropped: `src/world/diagnose/**` (20 §2.5.4) |
| X4 | sluice panel: Verify after the last wave + preselected retry | `WaveControl` (20 §3.3) |
| X5 | after-beat capture, `finale` phase, progress-derived world state | the phase machine (20 §2.9) |
| X6 | `disableGlobalCapture`, memoized view | 20 §2.2 `input/controller.ts`, §3.4 |
| X7 | `WorldOverlay` side-car | 20 §1.2–§1.3 (`fixtures/worlds/`) |
| X8 | `noun` template var for mimic feedback | dropped: `feedbackNouns` (§9.3) |

**Skin slot requests** (one line each in the skin's `parts` list; all folded into 20 §4.3 in revision 3; the KB lane owns every cell skin file). Every other
key in this document is already a 20 §4.3 slot, a prop, a layer or a vehicle:

| Skin | Slot | Source | Why |
|---|---|---|---|
| `specimen_pods` | `mimic_mote` | hero | the Mote that plays each quarantine (§5.P) |
| `membrane_router` | `gate_fin` | hero (`flipX` for the right fin) | the keystone fins split on success |
| `membrane_router` | `gate_ring_outer`, `gate_ring_inner` | kit `ringStack` | the selectivity ring turns toward the newest queued molecule |
| `tonicity_sluices` | `cell_protoplast`, `lock_leaf` | kit | plasmolysis (w3) needs the protoplast separate from the wall; the lock gates open on commit |
| `gatekeeper_maws` | `eye_pupil` | kit `ringStack` | the pupil ring tracks the focused cargo inside the eye-ring |
