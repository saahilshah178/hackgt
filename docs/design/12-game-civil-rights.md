# 12 · Game Design Document: *The 1965 Files: The Archive of Voices* (civil rights history, 1954–1965)

**Status:** revision 2 (2026-09-26, evening). Re-pointed at `20-expedition-architecture.md` revision 2 and folded
every `30-critique.md` amendment that names this document. **20 is the contract; this document is content.** Where
the two disagree on a type, field, key, width, asset path or coordinate convention, 20 wins and this document is
wrong. Where they disagree on nouns, lines, poses, dates, success timelines or scene content, this document wins.

## CHANGELOG (revision 2)

| # | Amendment (30-critique §4) | Folded into | What changed |
|---|---|---|---|
| 1 | Speakers outside `spec.characters` | §3.4, §4.4, §6.4 | Otis, Hattie, Dolores and Theo are `cast.extras`. Every line row now carries a `speakerId` and its set (`C` = `spec.characters`, `X` = `cast.extras`, `N` = narrator). |
| 2 | Traversal verbs replace "no jump physics" | §2.6 (every zone), §3.1 | Jump velocity and gravity are gone. Movement is 20 §2.4: a ground heightfield, platforms, and authored `Zone.links` (`hop`, `climb`, `ladder`, `drop`, `ride`). Keys follow 20 §3.5. |
| 3 | Probe channel | §5.0.2, every §5.x config | The Record Strip "year cursor" is the station's `ProbeSpec` (`symbol: "YEAR"`, `format: month_year`/`year`, `window`). `LiveMsg {kind: "cursor"}` is withdrawn. |
| 5 | Bindings and skins | §5.1–§5.13 | Every station names its 20 §4 archetype and skin: `claim_holders/witness_projector`, `step_bridge/walking_road`, `oracle_ticker/wire_ticker`, `cause_tubes/relay_line`, `cause_tubes/broadcast_relay`, `switchboard/switchboard`, `router_lanes/filing_cabinets`, `step_bridge/timeline_bridge`, `router_lanes/provenance_drawers`, `cause_tubes/big_board`, `tumbler_vault/tumbler_vault`. |
| 6 | Generalized payoff | §5.x station blocks, §5.13 | Payoffs are `{kind, vertical, anim, noun, blocker, terrain}` with 20's `PAYOFF_KIND_OF`. e3 and e5 are `vertical: "up"` (they open upward routes), so W1 warns only for S7, where the crossing at walking pace is the scene (§2.6.7). |
| 8 | Station geometry, accessories, framing, boss | §5.x station blocks | `consoleX` + `anchor` replace scene x; the Record Lens is the `record_lens` accessory on e1–e11 with an authored `rail`; `frameZoom` on e6 and e11; e12 has `BossStaging`. |
| 9 | Dialogue slots, 140 chars, noun rule, insight vs success | §4.4 | New slot column: `approach`, `instruction`, `tutorial`, `insight`, `hints[0..2]`, `fail.default`, `fail.byKey`, `success`, `payoffLine`, `after`. Every station gained a tutorial, an insight and a payoff line. Instructions contain `objectNoun` or a declared `partNouns` entry. |
| 10 | Hints act in the world | §5.0.5, every §5.x "Hints" | Rung actions are `meta.hintTargets(rung)` anchors (Wick flies there) plus config-gated overlays keyed to `aidTier` (`shutters`, `eventsBandTier`, `bayLampsTier`, `decoyDimRung`, `shadeCountsRung`, `hintPins`). |
| 11 | `diagnose()` is the only source of wrong keys | §5.0.1, §5.0.4, Appendix A | Withdrawn: `Grade.focus` (old A3), `LiveMsg {kind: "verdict"}`, and the civil lint on `pose.ts`. Failure animations act on `Diagnosis.wrongKeys`/`failKey`; misconception lines use overlay `probes[]`. |
| 12 | Demo cut | §0.1 (new) | P0/P1/P2 per system; zone-1 hero list by key; kit zones with one hero landmark each; express timing. |
| 13 | Every config now | §5.1–§5.12 | Exact `config` JSON per station, keyed by `statementIndex` / item key / clue index, valid against 20 §4.2. |
| 14 | Procedural kit, hero cap | §0.1.2, §7 | Every §7 entry is tagged `H` (hand-authored hero) or `K:<generator>` (02 §3a kit), or `code`/`DOM`/`atlas`. P0 biome heroes: 35 (≤ 40 per 02; ≤ 60 per 20). |
| 15 | Ambient triggers | §6.3 | X06, the cornice view, the darkroom light and others are `triggers[]`. X01–X05, X07, X08 are zone entry cutscenes (§4.2). |
| 16 | NPC states and quests | §6.4 | `npcs[].states[]` for Ida, Otis, Hattie, Dolores, Theo; quests `theo_spill` (P1) and `hattie_program` (P2). |
| 17 | Sandbox | §6.6 | The Darkroom is `sandboxes[0]` (`contraption: "darkroom"`, skin `darkroom_trays`, goal `all_developed`). |
| 19 | One recoloured Kenney rig | §3, §7.10 | Nell (`female_adventurer`), Ida (`female_person`) and Otis (`male_person`) are `shared.char.*` atlases with `archive_of_voices.costume.*` overlays. The Ida bust puppet is dropped. Tinting is gone. |
| 20 | Per-zone coordinates | §2.6, §5.x | All x/y are per zone (20 §4.1 conversions): S1 `y + 320`, S5 `y + 920`, S8 `y + 500`, the rest identity. |
| 21 | Glyphs by text-to-path | §7 | Every dynamic label (slugs, tape, dates, chips, split-flaps, headlines) is DOM through `WorldLabelLayer`; static wordmarks ("MAIN", "DAY", "TERMINAL", the masthead) are `<text data-engrave>`. |
| 22 | One naming table | §7, every key | `archive-city` and every `cr.*` id are retired. Keys are `archive_of_voices.<group>.<name>` per 20 §5.1; part keys are `archive_of_voices.part.<skin>_<slot>` per 20 §4.3. Each §7 row keeps its old id in a "was" column. |
| 23 | Segments and interiors | §2.3, §2.6 | Sky zones Z1–Z4 become per-zone `segments[]`; the lunch counter, terminal and Filing Hall are `interiors[]` with cutaway façades. |
| 24 | Purpose on screen | §6.1, §6.2, §6.7 | `story.recordStrip` (lanes + 12 earned pins), `progressEffects` (beams, Engine lenses, front pages), `map` (the Record Line), `journal` (the Clipping Case). No meter. |
| 25 | Cutscene verbs | §4.2, §4.3 | Intro uses `control_until` (the stair) and `await_interact` (the breaker) then `set_state` flag `engine_awake`; the finale uses `vista` `archive_of_voices.vista.dawn`. |
| 26 | Leaks before Verify | §5.9, §5.2 | **e9: the world bay-lamp sweep runs only at aid tier ≥ 1** (`bayLampsTier: 1`); before that, the FILE card plots placed planks' printed dates with **no bay connectors**. Also fixed: the e9 decoy deck section was drawn short while drafting (a tell); it now shortens only inside the failure plan. |
| 28 | Traversal beat sheets | §2.6.1–§2.6.8 | Every zone lists ≥ 2 non-walk verbs besides its payoffs, with link ids, surfaces, x and `requires`. S2 gets the flagpole-and-cornice climb and the awning climb; S4 gets the rafters climb to the negatives. |
| 30 | Performance plan | §2.5 | Rain 120 streaks (S4, S5) and 60 (S6, S7); half-resolution reflections at 15 Hz in **two scenes only** (S4 Main Street puddles, S7 river). Everywhere else puddles are static sheen sprites. |
| 31 | DOM fallback = static snapshots | Appendix A | A12 now points at 20 §2.2's snapshot host. |
| 32 | Framing giant contraptions | §5.6, §5.11 | Big Board `boardWidth: 1100` with `frameZoom: 0.8`; the Broadcast mast `frameZoom: 0.7` with the camera following the **focused station** and the lift cage; the bridge frames the four crown bays. |
| 33 | Controls | §5.0.1, §5.12 | `AimControl` (hover drafts), `SlotRailControl`, `RouterControl`, `CableControl`, `TubeControl`, `MatrixControl` (UI-only marks). |
| 35 | Synth cue bank | §5.0.6 | Cue ids renamed to `Id`-legal names (the old `sfx.*` ids contain a dot, which `Trigger.cue` and the cutscene `sfx` step reject) with a recipe per id. |
| 36 | `feedbackNouns` | §5.0.4 | `chest → slide` for e1 and e4. |
| 37 | Quiz-voiced and fourth-wall lines | §4.4 | Rewritten: `e3.A` ("What did the President do?"), `e3.H2`, `e12.H2`, `e10.F` (questions), `I10` ("Press E"), `e9.F` ("Scrub"). |
| 40 | One overlay location | header, Appendix A13 | `fixtures/worlds/civil-rights.world.json` is the only overlay location. `src/game/worlds/history_mystery_001.ts` is withdrawn. |
| F12 | Sensitivity lint | header rule 6, §3.4, §6.5 | NPC and extra names pass the R10 name lint; violent texts appear only on `document`/`photo_withheld` plaques; negatives carry non-violent texts (a `Collectible` cannot be a document). |

**Also changed (self-audit against 20 §4.2 validators):**
- e10's hint-gated events band is now `1963–1965`. The old `1954–1965` fails `router_lanes.validateConfig` because no
  e10 text contains 1954. The rule it draws is unchanged: the three primary documents sit inside the band.
- e5's pre-solve FILE marker `1961` is dropped: `cause_tubes` has no `fileDates`, and no e5 node prints a date. The
  `1961` pin still arrives on RECORD when e5 is solved (it appears in the e5 prompt).
- Nell no longer cheers anywhere in this sensitive biome; every success plays `show` (she holds up the restored
  record). This replaces the per-station memorial list, which the schema cannot express.
- The Darkroom and the five negatives move together to P1 (20 §0.1.3 already lists the Darkroom as P1 with a
  five-negative unlock).
- O08 (the Editor's bonus line) moves from the finale, which has no conditional steps, to the Darkroom's reward.

**Not folded here** (other documents own them): 02's naming table differs from 20 §5.1 (layer groups, the hero cap,
generator names); this document follows 20 and lists the gaps in Appendix A.2 for the architect.

---

**Fixtures:** `fixtures/civil-rights-mystery.json` (`history_mystery_001`, genre `mystery`, seed 827188845) and
`fixtures/civil-rights-dungeon.json` (`history_demo_001`, genre `dungeon`, seed 3657066651). Both carry the same 12
encounters with byte-identical `params`; only the seed, and so the display order, differs. They are pinned by
`fixtures-drift.test.ts`, so **none of their bytes change**.

**Overlay location (decision 19 / amendment 40): `fixtures/worlds/civil-rights.world.json` is the only place this
game's world lives.** It is a `WorldFile`:

```json
{ "appliesTo": { "specIds": ["history_mystery_001", "history_demo_001"],
                 "sources": [{ "sourceId": "src_civil_rights", "genre": "mystery" },
                             { "sourceId": "src_civil_rights", "genre": "dungeon" }] },
  "world": { "worldVersion": 2, "biome": "archive_of_voices", "title": "The Archive of Voices",
             "subtitle": "The 1965 Files", "cast": "§3", "story": "§6.1–§6.2", "zones": "§2.6",
             "stations": "§5.1–§5.12", "props": "§2.6 + §6.7", "npcs": "§6.4", "quests": "§6.4",
             "triggers": "§6.3", "sandboxes": "§6.6", "collectibles": "§6.5", "plaques": "§6.5",
             "cutscenes": "§4.2–§4.3", "feedbackNouns": "§5.0.4" } }
```

Every per-item config is keyed by `statementIndex`, `optionIndex`, item key or clue index, never by display order,
so one file serves both seeds.

**Reads with:** `20-expedition-architecture.md` (the contract: §1.3 schema, §2.4 traversal, §2.5 metas, §3 panel,
§4.1–§4.3 bindings, configs and skins, §5 art), `02-assets-and-art-pipeline.md` (§3a kit generators, §3b rig),
`01-variant-design-bible.md` (tokens, anatomy, checklist), `docs/overnight/wave1-modes.md` (mode contracts).

**Audience:**
- **Artists** use §0.1.2, §2 and §7.
- **Engine and contraption developers** use §5 and Appendix A.
- **Content writers** (C3 in 20 §7.2) use §2.6, §4, §5 (station and config JSON) and §6, and write
  `fixtures/worlds/civil-rights.world.json` from them without inventing anything.

Nothing here changes a mode's `grade()`. Every Verify calls the existing mode's grade with the existing `Input`
shape.

**Sensitivity rules** (bible §7.3, 20 R10; non-negotiable, and repeated here because every section depends on them):
1. No real person is ever rendered as a sprite, portrait, silhouette cut-out, caricature or playable character.
   Real people appear only as **names typed on documents**.
2. Violence is never animated or depicted. It is **named in dated text** (node cards, tape, headlines). Photo
   plates of violent events are "withheld" frames: a sepia blur, a camera glyph and the caption only
   (`Plaque.kind: "photo_withheld"`).
3. There is no combat, no enemies and no "boss fight" against historical actors. The antagonist is the flood
   damage to the record: the *mimic labels* and *decoy planks*, which are the misconceptions themselves. The
   Editor's `BossStaging` is a fictional archivist's locked vault, not an opponent.
4. All in-world signage is either (a) verbatim fixture text, or (b) neutral generic wayfinding ("GATE 4",
   "RECORDS", "HARDWARE"). **No invented quotations** are attributed to real people. No real brand logos: the
   five-and-dime and the coach terminal are generic, and their document plates carry the real names from the
   fixture text.
5. Every fictional character (Nell, Ida, the Editor, Otis, Hattie, Dolores, Theo) works at the archive **in the
   present**. None of them claims to have witnessed a historical event or tells invented anecdotes about one.
6. (R10) No NPC `name` and no `cast.extras[].name` matches a person named in the spec. Human NPCs use the
   `archive_of_voices` kit's `fictionalStaff` bodies. Every text matching the kit's `violenceLexicon` sits on a
   `document` or `photo_withheld` plaque. Every station skin is `sensitiveSafe` (no shake, burst or strike fx).

---

## 0 · Conventions used in this document

| Concern | Rule (source) |
|---|---|
| Coordinates | Per zone: x from the zone's left edge, y **down** from the zone's top, 1 unit = 1 px of a 1080-px view, H ≈ 170 (20 §1.3). Every x/y in this document is already converted (20 §4.1 conversions: S1 `y_doc + 320`, S5 `y_doc + 920`, S8 `y_doc + 500`, all other zones identity). |
| Zone ids | `s1_morgue`, `s2_courthouse`, `s3_schoolhouse`, `s4_main_street`, `s5_church_mast`, `s6_memorial`, `s7_selma`, `s8_stacks_vault` (8 zones, the 20 maximum). "S1…S8" in prose are these zones. |
| Asset keys | `archive_of_voices.<group>.<name>` with 20 §5.1 groups (`layer`, `ground`, `prop`, `part`, `costume`, `companion`, `fx`, `ui`, `vista`, `doc`); characters are `shared.char.<id>` atlases; station parts are `archive_of_voices.part.<skin>_<slot>` (20 §4.3); the Record Lens carriage and rail are `archive_of_voices.part.lens_carriage` / `archive_of_voices.part.record_rail`. |
| Tags | `H` = hand-authored hero SVG (counts against the cap); `K:<gen>` = 02 §3a kit generator; `atlas` = 20 §5.5 recoloured rig; `code` = drawn by host or prefab code; `DOM` = React/`WorldLabelLayer`. |
| Speakers | `archivist` (Ida) and `editor` are `spec.characters`; `otis`, `hattie`, `dolores`, `theo` are `cast.extras`; `narrator` is built in. A `LineSlot` with `speakerId: null` is the guide (`archivist`). |
| Palette tokens | `src/game/art/palettes/archive_of_voices.ts`; the old `cr.` token prefix is dropped (`cr.brick.lit` → `brick.lit`). |
| Keys (input) | 20 §3.5: A/D walk, Shift run, Space hop, W climb/ladder up/board, S drop/ladder down, E interact, I hint, M map, J journal, H legend, N mute, Esc back/skip. |
| Tiers | **P0** must ship for the 2026-09-27 demo; **P1** after P0 is green; **P2** polish (20 §0.1). |

---

## 0.1 · P0 demo cut (2026-09-27)

The architecture supports the full game below. The demo cut decides what ships first. Tiers are cumulative: P1
starts only after P0 is green on both Playwright projects (`webgl`, `dom`); P2 only after P1.

### 0.1.1 What ships, by tier

| System | P0 (demo) | P1 | P2 |
|---|---|---|---|
| Stations | **e1–e12 all playable natively** (§5): live link, year probe + Record Lens, Verify, diagnosis-driven failure, success plan, payoff traversal, every dialogue slot, aid-tier hint actions. Fallback ladder (20 §0.1.6): a station whose archetype is not native at P0 freeze runs on `console_slate`. | — | — |
| Boss | e12 `BossStaging`: arena trigger at x 4900 after the vault lift, `e12_arena` cutscene (X09), Editor taunts on failure, `MatrixControl` | — | — |
| Intro | `intro` cutscene (§4.2): stair descent (`control_until`), Ida's desk, breaker (`await_interact`), `set_state` flag `engine_awake`, Engine wakes | exterior crane down the tower (`vista` `archive_of_voices.vista.tower_rain`) | — |
| Finale | `finale` cutscene (§4.3): vault opens, press-organ, `vista` `archive_of_voices.vista.dawn` pull-out, O01–O07 | O08 via the Darkroom reward | — |
| Zone entries | `enter_s2` … `enter_s8`: title card + the X-line (X01–X05, X07, X08) | X06 arrival trigger in the Filing Hall | — |
| Full-art zone | **S2 Courthouse Square** (first zone with stations) **and the Record Engine hub in S1** (§0.1.2) | S3–S8 full art | — |
| Kit zones + one hero landmark | S1 Record Engine (hub heroes) · S3 schoolhouse · S4 five-and-dime and terminal façades (they are the P0 interior façades) · S5 church · S6 memorial colonnade · S7 steel arch bridge (a station part) · S8 vault door (a station part) (§0.1.3) | — | — |
| Traversal | Host supports every link kind. **S1** crate hops; **S2** flagpole hop + cornice climb (after e1) and mailbox hop + awning climb (after e2); S8 rolling ladder + gallery drop; every payoff traversal in every zone | every other zone's beat sheet (S3 pole, S4 bench/board/rafters/fire escape, S5 bandstand/mast top, S6 gallery ladder, S7 riverbank) | — |
| Record Strip | `story.recordStrip` (3 lanes, 12 earned pins), RECORD + FILE cards, hint pin on e1 | — | provenance badges after e10, causal arrows after e11 (need card support, Appendix A.2) |
| HUD | objective ring (12 segments), `RECORD RESTORED n/12`, key legend, mute toggle, dialogue bar with emblems, (i) Brief/Hints sheet, journal = MasteryHud | — | map "The Record Line", `JournalReader` "Clipping Case" |
| Plaques | S2 courthouse plaque, S3 gatepost plate, S4 withheld Anniston plate, S7 far-bank document | S1 Engine plate, S6 hall plaque, S8 provenance card | — |
| NPCs | Ida (S1 desk) and Otis (S1) on the rig | Hattie, Dolores, Theo on the rig; all NPC states | — |
| Side content | — | Theo's spill quest; the Darkroom sandbox **and** the 5 negatives; ambient triggers | Hattie's program quest; contact sheet; Clipping Case SECONDARY stamps |
| Progress effects | — | 12 `beam_line`s, 12 Engine `hub_socket`s (S8), 12 front-page `label_swap`s (S8), the e4 stools and e6 windows (`prop_state` / `restoredBy`) | window wave timing, moths |
| Sound | synth cue bank, every §5.0.6 cue id mapped | — | — |
| Performance | rain 120/60; reflections only in S4 and S7 (half-res, 15 Hz); grain one tile | — | reflection polish |
| Express | `?express=1` end to end (≈ 12 min) | — | — |
| DOM fallback | static snapshots of every skin + full panel | — | — |

### 0.1.2 Zone 1 at full art: hero assets by key

"Zone 1" for this game is the pair 20 §0.1.2 names: **S2 Courthouse Square** (the first zone with stations) and the
**Record Engine** in S1 (the intro room). Full art = every parallax layer, ground, props, the hub, every part its
stations need, the companion, the NPC looks, and the finish stack (20 §5.6). **19 hero files**:

| # | Key | Zone / use | Was (old id / 02 §4.3 #) | Notes |
|---|---|---|---|---|
| 1 | `archive_of_voices.prop.engine_drum` | S1 hub | `cr.set.engine_drum` + `engine_iris_blade` (02 #1) | drum face + one iris blade authored in the file; 8 blades at runtime; anchors `iris`, `lens_socket` |
| 2 | `archive_of_voices.prop.engine_crown` | S1 hub | `engine_crown_l` (`_r` = `flipX`) (02 #2) | split gold crown fin, bleeds off the top (5.8 H hub) |
| 3 | `archive_of_voices.prop.main_breaker` | S1 intro | `main_breaker` + `breaker_lever` (02 #3) | "MAIN" engraved; lever part with pivot `[0.5, 1]`; `await_interact` target |
| 4 | `archive_of_voices.prop.reading_desk` | S1 | 02 #4 | Ida sits behind it |
| 5 | `archive_of_voices.prop.proof_press` | S1 | 02 #5 | Hattie's press |
| 6 | `archive_of_voices.prop.courier_ledger_tower` | L1 of every zone | from `cr.far.city_south` | 8-storey art-deco tower with 3 setbacks; anchor `antenna` for the ring and the beam lines |
| 7 | `archive_of_voices.prop.courthouse` | S2 landmark | 02 #6 | Greek-revival courthouse **without steps**; anchors `panel_0…2`, `door`, `cornice`, `clock` |
| 8 | `archive_of_voices.part.witness_projector_arc_lamp` | e1 | `cr.part.proof_lamp_*` (02 #8) | stand + head in one file; head pivot at (20, 55) |
| 9 | `archive_of_voices.part.walking_road_city_bus` | e2 | 02 #7 | empty 1950s bus, windows dark |
| 10 | `archive_of_voices.part.lens_carriage` | every station (e1–e11) | 02 #10 | the `record_lens` accessory carriage |
| 11 | `archive_of_voices.costume.nell_scarf` | protagonist | 02 #13 | salmon scarf, anchor `back`, `follow: spring`, `layer: behind` |
| 12 | `archive_of_voices.costume.nell_satchel` | protagonist | 02 #12 | satchel strap, anchor `torso` |
| 13 | `archive_of_voices.costume.ida_bun_glasses` | Ida (S1) | replaces the Ida bust (02 #14) | silver low bun + cat-eye glasses chain, anchor `head` |
| 14 | `archive_of_voices.costume.ida_cardigan` | Ida (S1) | `cr.char.ida_overlay` | long teal cardigan hem, anchor `torso` |
| 15 | `archive_of_voices.costume.otis_watch_cap` | Otis (S1, S8) | `cr.char.otis` | anchor `head` |
| 16 | `archive_of_voices.costume.otis_flashlight` | Otis | `cr.char.otis` | anchor `hand_r`; the cone is `archive_of_voices.fx.projector_cone` tinted `lamp` |
| 17 | `archive_of_voices.companion.wick` | guide | `cr.char.wick_body` + `wick_wing` (02 #15) | 5-part puppet (02 §3b.5): lantern body, flame (3 frames), 2 wings, glow |
| 18 | `archive_of_voices.part.witness_projector_pendant_lamp` | e4 (S4) | `cr.set.pendant_lamp` + `pendant_head` | authored with zone 1 because it shares the arc lamp's materials; counted here |
| 19 | `archive_of_voices.prop.schoolhouse` | S3 landmark | 02 #16 | authored in the zone-1 pass so S3 is never empty |

Zone-1 kit entries (no hero cost; 02 §3a signatures): the S2 layer set (§2.6.2), `archive_of_voices.prop.record_engine`
(`K:compose` of `stairs stepped_plinth` + three `ringStack` rings + 12 lens sockets; the hub asset),
`archive_of_voices.prop.engine_ring_outer|mid|inner` (`K:ringStack`), `archive_of_voices.prop.engine_lens`
(`K:ringStack`, 12 instances), `archive_of_voices.prop.basement_stair` (`K:stairs iron` + `railing`),
`archive_of_voices.prop.front_pages_wall` (`K:shelving cork_frames`), the witness-projector kit parts (`witness_lens`,
`projection_panel`, `retract_stamp`, `steps`), the walking-road kit parts (`slab`, `bus_stop`, `day_counter`,
`flood_band`), `archive_of_voices.prop.console_reader` (`K:lectern microfilm`), `archive_of_voices.part.record_rail`
(`K:linkStrip rail`), `archive_of_voices.doc.plaque_bronze` (`K:plate`), and `archive_of_voices.vista.dawn`
(`K:compose`, the finale).

### 0.1.3 Kit zones: kit layers + one hero landmark

| Zone | Hero landmark (P0) | Other P0 heroes (station parts) | Everything else |
|---|---|---|---|
| S1 The Morgue | the Record Engine (#1–#3 above) | — | kit back wall, pipes, shelving, stanchions |
| S3 Schoolhouse Hill | `archive_of_voices.prop.schoolhouse` (#19) | `part.wire_ticker_teletype`, `part.wire_ticker_selector` | kit kiosk, pole, barrier, walk lamps, autumn trees |
| S4 Main Street | `archive_of_voices.prop.dimestore_facade`, `archive_of_voices.prop.terminal_facade` (the two `Interior.facade`s) | `part.witness_projector_pendant_lamp` (#18), `prop.counter_stool` | kit counter, menu board, departures board, junction boxes, gate, rails |
| S5 Church Square | `archive_of_voices.prop.church` | `part.broadcast_relay_relay_dish` | kit mast (`truss lattice_mast`), lift cage, skyline windows |
| S6 Memorial | `archive_of_voices.prop.memorial_colonnade` | `part.switchboard_switchboard_cabinet` | kit steps, pool, hall façade, cabinets, meters, slips |
| S7 Selma | `archive_of_voices.part.timeline_bridge_arch_bridge` | `part.timeline_bridge_streetcar` | kit deck sections, bay lamps, lectern, river, bluffs |
| S8 Stacks and Vault | `archive_of_voices.part.tumbler_vault_vault_door` | `part.tumbler_vault_tumbler`, `part.tumbler_vault_press_organ`, `part.big_board_canister`, `part.provenance_drawers_documents` | kit shelving, cranks, board wall, launcher, bolts, handwheel, grille, gallery, lift |

**Biome hero budget:** P0 = 19 (zone 1) + 16 (other zones: `wire_ticker_teletype`, `wire_ticker_selector`,
`dimestore_facade`, `terminal_facade`, `counter_stool`, `church`, `broadcast_relay_relay_dish`,
`memorial_colonnade`, `switchboard_switchboard_cabinet`, `timeline_bridge_arch_bridge`, `timeline_bridge_streetcar`,
`tumbler_vault_vault_door`, `tumbler_vault_tumbler`, `tumbler_vault_press_organ`, `big_board_canister`,
`provenance_drawers_documents`) = **35**. P1 adds 4 costume overlays (`hattie_eyeshade`, `dolores_headset`,
`theo_cap`, `theo_textbook`) = **39 ≤ 40** (02's cap; 20 allows 60). Every hero key declares a `kitFallback` in
`art/archive_of_voices/biome.json` (fallback ladder step 1).

Changes against 02 §4.3's civil hero list (30 files): `junction_box`, `filing_cabinet`, `surveyor_console` and
`big_board` become kit (20 §4.3 tags them `K`); `console_reader` becomes `K:lectern microfilm`; `day_counter` becomes
`K:plate` with "DAY" engraved (digits DOM); the Ida bust becomes the Ida atlas + two costume overlays; added heroes
are `courier_ledger_tower`, `dimestore_facade`, `memorial_colonnade`, `timeline_bridge_arch_bridge`,
`tumbler_vault_tumbler`, `provenance_drawers_documents`, `witness_projector_pendant_lamp`.

### 0.1.4 Express timing and demo path

`?express=1` (20 §0.1.5) walks to each console at 2× speed, plays each payoff traversal, trims each cutscene after
its first `say`, and never trims the finale. First-try solve times (Appendix A pacing): ≈ 12 min for all 12
stations. For a shorter judge demo: S2 (e1, e2) live, then `skipTo e9_selma` (the bridge, the rain stopping), then
`skipTo e12_boss` and the finale.

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
| `brick.lit` / `base` / `shade` | `#D08A6E` / `#B5654F` / `#7E4038` | rowhouses, church, school |
| `brick.dusk` | `#8E5A6A` (lit `#B07A86`) | L2 brick masses under dusk light |
| `stone.lit` / `base` / `shade` / `deep` | `#FBF1DE` / `#F2E3C6` / `#D9C3A0` / `#B89C78` | courthouse, memorial, Engine plinth (bible) |
| `brass.hi` / `base` / `deep` | `#F6D27A` / `#D9A441` / `#A8782E` | rails, lamps, jacks, canisters (bible gold) |
| `inlay.navy` / `dark` | `#27466A` / `#1B3150` | awnings, bands, cabinet trim (bible) |
| `concrete` / `curb` | `#B9AFC6` / `#8C829E` | sidewalks (lavender-grey, dusk-lit) |
| `asphalt.wet` | `#4A4F66` (sheen `#6D6F8C`) | streets |
| `steel` / `shade` | `#9AA3B8` / `#646C85` | Selma bridge truss, broadcast mast |
| `oak.leaf` / `hi` | `#5A95D6` / `#8CC0EE` | dusk trees (bible foliage.blue) |
| `magnolia` | `#3E5F74` (hi `#6E93A6`) | L5 glossy leaves |
| `autumn` | `#E48C5E` / hi `#F4AE80` | sparse autumn trees in 1957 scenes (bible salmon) |
| `recordlight` | `#6ED2F2` / hi `#C9F3FF` / shade `#2E8FC0` | projection beams, lenses, restored edges (bible crystal) |
| `dormant` | `#A9A3B8` @ 40 % + scanlines | unrestored projections (wireframe state) |
| `lamp` | `#F6D27A` → transparent | street lamps, window light |
| `safelight` | `#C4643C` | darkroom only (bible foliage.rust) |
| `wisp.indigo` | `#6A6CF0` | lost negatives (collectibles) |
| `paper` / `aged` | `#F7F1E3` / `#E9D8B4` | documents; the 1971 textbook deliberately aged `#D9C08E` (the visible trap) |
| `ink` | `#2B3A44` | type on documents; also the darkest world colour (no pure black) |

**Rules:** orange (`ui.accent #E2892C`) never appears in the world except on the **Record Lens carriage chip**
and the **aimed/accused socket rings**, both of which are bound to the player's input. White, green and blue in
the world appear only on chips and lamps bound to panel values (§5.0.2).

### 2.3 Sky zones become segments (time of day)

Time of day advances with the record's years: the city gets darker as the story nears 1965, and **dawn arrives
only when the record is whole**. The old sky zones Z1–Z5 are now `Zone.segments[]` (20 §1.3 `Segment`; 1 s
crossfade at boundaries). Z5 dawn exists only inside the finale vista.

| Old zone | Years | Sky `stops` (`at`: colour) | `haze` | Used by segments |
|---|---|---|---|---|
| Z1 late afternoon | 1954–1957 | 0 `#B9A3D6` · 0.35 `#D9AFCF` · 0.65 `#E9B8C4` · 1 `#F6D9BE` | `#F6D9BE` α 0.20 | `late_afternoon` (S2), `dusk_begins` (S3) |
| Z2 dusk, rain | 1960–1963 | 0 `#7F6BB8` · 0.35 `#9E86D8` · 0.65 `#B58FCB` · 1 `#E8A9C3` | `#E8A9C3` α 0.30 | `dusk_rain` (S4), `night_rain` (S5) |
| Z3 blue hour → night | 1963–1965 | 0 `#3E3F74` · 0.35 `#55508A` · 0.65 `#6A5A9A` · 1 `#C58BB0` | `#6A5A9A` α 0.25 | `blue_hour` (S6), `river_road`, `bridge`, `far_bank` (S7) |
| Z4 interior | the present | 0 `#3B2F3E` · 0.5 `#4E3C44` · 1 `#5E4A4A` (behind back walls) | `#5E4A4A` α 0.15 | `morgue_interior` (S1), `hall` (S6), `stacks`, `vault` (S8) |
| Z5 dawn (finale) | the present | `#8FA8D8` → `#C7B7D8` → `#F2C6B8` → `#FBE7C8`, pale sun disc `#FFF4DC` r 60 at 75 % x / 82 % y | `#FFFFFF` α 0.25 | baked into `archive_of_voices.vista.dawn` |

**Segments (exact values for the world file):**

| Zone | Segment `id` | `x0`–`x1` | `layerSet` | Sky | `ambient` (`light` · `particles` · `particleCount` · `grade` sat/bri/hue) | `weather` | `music` | `runEnabled` | `variants` |
|---|---|---|---|---|---|---|---|---|---|
| `s1_morgue` | `morgue_interior` | 0–3840 | `morgue` | Z4 | `interior` · `dust` · 24 · −0.10/−0.05/0 | `drip` | `noir` | true | — |
| `s2_courthouse` | `late_afternoon` | 0–5760 | `courthouse_square` | Z1 | `peach` · `scraps` · 16 · 0.05/0.02/0 | `paper_drift` | `curious` | true | — |
| `s3_schoolhouse` | `dusk_begins` | 0–3840 | `schoolhouse_hill` | Z1 | `peach` · `scraps` · 12 · 0/−0.04/2 | `paper_drift` | `curious` | true | — |
| `s4_main_street` | `dusk_rain` | 0–5760 | `main_street` | Z2 | `dusk` · `rain` · 120 · −0.05/−0.05/4 | `rain_heavy` | `tense` | true | — |
| `s5_church_mast` | `night_rain` | 0–4800 | `church_square` | Z2 | `night` · `rain` · 120 · −0.08/−0.10/4 | `rain_heavy` | `tense` | true | — |
| `s6_memorial` | `blue_hour` | 0–3000 | `memorial` | Z3 | `night` · `rain` · 60 · −0.10/−0.08/6 | `rain_light` | `calm` | true | — |
| `s6_memorial` | `hall` | 3000–5760 | `filing_hall` | Z4 | `interior` · `dust` · 20 · −0.05/0/0 | `clear` | `calm` | true | — |
| `s7_selma` | `river_road` | 0–1300 | `selma_river` | Z3 | `night` · `rain` · 60 · −0.10/−0.10/6 | `rain_light` | `tense` | true | — |
| `s7_selma` | `bridge` | 1300–4300 | `selma_river` | Z3 | `night` · `rain` · 60 · −0.10/−0.10/6 | `rain_light` | `tense` | **false** | `[{requires: {solved: "e9_selma"}, sky: null, weather: "clear", music: "solemn"}]` |
| `s7_selma` | `far_bank` | 4300–5760 | `selma_river` | Z3 | `night` · `none` · 0 · −0.05/−0.05/4 | `clear` | `solemn` | true | — |
| `s8_stacks_vault` | `stacks` | 0–4700 | `stacks` | Z4 | `interior` · `dust` · 24 · −0.10/−0.05/0 | `drip` | `noir` | true | — |
| `s8_stacks_vault` | `vault` | 4700–6720 | `vault` | Z4 | `amber` · `dust` · 16 · 0/−0.05/−4 | `clear` | `noir` | true | — |

`shadowColor` stays the default `#6E7F9A`; `dapple` is null everywhere. The e12 arena switches music to `noir`
through `BossStaging.music` (§5.12), never to `boss`: the vault is a puzzle, not a fight.

### 2.4 Parallax layers (bible §5.2 factors) and layer sets

| Layer | Factor | Concrete content (exterior scenes) | Treatment |
|---|---|---|---|
| **L0 Sky** | 0.0 | 4-stop gradient per segment (§2.3), drawn by code from `Segment.sky`. Two soft cloud bands (`archive_of_voices.layer.clouds_soft`) as stacked 8–15 % white ellipses. In rain segments, a darker rain-cloud band across the top 25 % (`archive_of_voices.layer.clouds_rain`). | 1 px noise dither to prevent banding. |
| **L1 Far** | 0.15 | City silhouette: water tower on stilts, two church steeples, a courthouse dome with cupola, flat-roofed commercial blocks. At ~70 % x stands the **Courier-Ledger tower** (`archive_of_voices.prop.courier_ledger_tower`, 8 stories, art-deco setbacks) topped by the Engine's **antenna ring** (`archive_of_voices.prop.antenna_ring`: three concentric brass rings, 90 px; dormant grey, restored cyan). S5 uses the industrial variant, S6 swaps to an obelisk and a domed capitol (Washington), S7 to river bluffs and a pine line (Selma). **Record-light beams** (bible 6.png) arc from each restored landmark to the antenna ring (P1 `beam_line` progress effects). | One fill per silhouette (`#6E5E93` in Z1/Z2, `#3F3A6A` in Z3) + 40 % haze toward the sky; sparse window dots `#F6D27A` @ 60 %. |
| **L2 Mid-far** | 0.35 | Brick rowhouses with porches and gable roofs; taller commercial blocks with neutral painted wall signs; oak and magnolia masses; utility poles with catenary wires. **Window clusters are separate sprites** (`archive_of_voices.fx.window_cluster` props) so a payoff can light them (S5: the nation watching). | Two-tone lit/shade, 20 % haze; windows `lamp` at 0–100 % alpha. |
| **L3 Mid** | 0.6 | Each scene's street wall behind the path: storefront rows (navy/salmon striped awnings, transom windows, recessed doors), fire escapes. The landmarks (courthouse, school, church, terminal, memorial) are `props` at `L4_back` so the player stands in front of them at 1.0. | Full palette; soft ambient occlusion at the bases; coloured blurred shadows falling right. |
| **L4 Play** | 1.0 | Ground strip (sidewalk / brick plaza / marble / wood), curbs, contraptions, consoles, Nell, Wick, NPCs, lamp heads. | Full detail, contact shadows `#6E7F9A` @ 30 % multiply, blurred 6 px. |
| **L5 Foreground** | 1.3–1.35 | Wet iron railings, parking meters, hydrants, twine-tied newspaper bundles, park benches, lamppost bases, glossy magnolia leaf clusters. Never covers a station's `footprint` or `frameBounds` (20 W3). | `#2B3A44`-leaning, 2 px blur, 70 % alpha. |
| **L6 Light** | 1.0 | Rain streaks (particles), splash rings, lamp glows (ADD), projector cones, venetian-blind shadow overlay (interiors). Reflections only in S4 and S7 (§2.5). Film grain is the shared finish-stack tile (`shared.fx.grain`, 6 %). | Multiply for shadows, ADD for glows. |

**Interior scenes (S1, S8, the S4 counter and terminal, the S6 Filing Hall)** reuse the same factors:
- L1 = the back wall, with high windows showing the street at knee height (rain on the glass);
- L2 = pipes, shelving silhouettes and arches;
- L3 = the far stacks or machinery;
- L5 = the edges of the reading desk, and ropes and stanchions.

**Cutaway entry** is 20 `Zone.interiors[]`: while Nell's x is inside an interior's span, its `facade` fades to 20 %
alpha over 300 ms and the interior's lighting segment applies. S4 has two interiors and S6 one (§2.6).

**Layer sets** (`Zone.layerSets[]`; each 3–10 `ParallaxLayer`s; `y` is the layer's top edge in zone units; blur
and alpha are the finish-stack defaults unless listed):

| Layer set | Layers (`depth` · `asset` · `scrollFactor` · `y` · extras) |
|---|---|
| `morgue` (S1, 1400 tall) | L1 · `layer.morgue_backwall` · 0.15 · 200 · `scrollFactorY: 0.15`; L2 · `layer.morgue_pipes` · 0.35 · 260; L3 · `layer.stacks_shelving` · 0.6 · 330 · alpha 0.8; L5 · `layer.fore_stanchions` · 1.3 · 1190; L6 · `fx.blinds_shadow` · 1.0 · 200 · `blend: multiply`, alpha 0.2 |
| `courthouse_square` (S2) | L1 · `layer.clouds_soft` · 0.05 · 40 · alpha 0.8, `driftPxPerSec: 6`; L1 · `layer.far_city_south` · 0.15 · 360 · blur 1; L1 · `prop.courier_ledger_tower` · 0.15 · 150 · `repeatX: false`; L2 · `layer.midfar_rowhouses` · 0.35 · 300 · blur 0.5; L2 · `layer.midfar_oaks` · 0.35 · 380; L3 · `layer.mid_storefronts_a` · 0.6 · 150; L5 · `layer.fore_railing` · 1.3 · 840 · blur 2, alpha 0.7; L5 · `layer.fore_magnolia` · 1.35 · 790 · blur 2, alpha 0.7 |
| `schoolhouse_hill` (S3) | L1 · `layer.clouds_soft` · 0.05 · 40; L1 · `layer.far_city_south` · 0.15 · 360; L1 · `prop.courier_ledger_tower` · 0.15 · 150 · `repeatX: false`; L2 · `layer.midfar_autumn_trees` · 0.35 · 360; L2 · `layer.midfar_utility_poles` · 0.35 · 560; L3 · `layer.mid_storefronts_b` · 0.6 · 150; L5 · `layer.fore_magnolia` · 1.35 · 790 |
| `main_street` (S4) | L1 · `layer.clouds_rain` · 0.05 · 0; L1 · `layer.far_city_south` · 0.15 · 360; L1 · `prop.courier_ledger_tower` · 0.15 · 150 · `repeatX: false`; L2 · `layer.midfar_commercial` · 0.35 · 260; L2 · `layer.midfar_utility_poles` · 0.35 · 560; L3 · `layer.mid_storefronts_a` · 0.6 · 150; L3 · `layer.mid_firescape_wall` · 0.6 · 90 · `repeatX: false`; L5 · `layer.fore_railing` · 1.3 · 840 |
| `church_square` (S5, 2000 tall) | L1 · `layer.clouds_rain` · 0.05 · 700 · `scrollFactorY: 0.05`; L1 · `layer.far_city_industrial` · 0.15 · 1200 · `scrollFactorY: 0.15`; L1 · `prop.courier_ledger_tower` · 0.15 · 1000 · `repeatX: false`; L2 · `layer.midfar_rowhouses` · 0.35 · 1140; L3 · `layer.mid_storefronts_b` · 0.6 · 1060; L5 · `layer.fore_railing` · 1.3 · 1760 |
| `memorial` (S6) | L1 · `layer.clouds_rain` · 0.05 · 0 · alpha 0.6; L1 · `layer.far_capital` · 0.15 · 480; L2 · `layer.midfar_oaks` · 0.35 · 480; L3 · `layer.midfar_utility_poles` · 0.6 · 600 · alpha 0.6; L5 · `layer.fore_magnolia` · 1.35 · 1010 |
| `filing_hall` (S6) | L1 · `layer.mid_marble_backwall` · 0.15 · 100; L2 · `layer.hall_arches` · 0.35 · 150; L3 · `layer.stacks_shelving` · 0.6 · 220 · alpha 0.7; L5 · `layer.fore_stanchions` · 1.3 · 1100; L6 · `fx.blinds_shadow` · 1.0 · 0 · `blend: multiply`, alpha 0.2 |
| `selma_river` (S7) | L1 · `layer.clouds_rain` · 0.05 · 0 · alpha 0.7; L1 · `layer.far_river_bluffs` · 0.15 · 420; L1 · `prop.courier_ledger_tower` · 0.15 · 300 · `repeatX: false`; L2 · `layer.midfar_utility_poles` · 0.35 · 560; L3 · `layer.mid_river` · 0.6 · 900; L5 · `layer.fore_railing` · 1.3 · 840 |
| `stacks` (S8, 2000 tall) | L1 · `layer.morgue_backwall` · 0.15 · 700 · `scrollFactorY: 0.15`; L2 · `layer.morgue_pipes` · 0.35 · 760; L3 · `layer.stacks_shelving` · 0.6 · 820; L5 · `layer.fore_stanchions` · 1.3 · 1370; L6 · `fx.blinds_shadow` · 1.0 · 700 · `blend: multiply`, alpha 0.2 |
| `vault` (S8) | L1 · `layer.vault_backwall` · 0.15 · 1000; L2 · `layer.morgue_pipes` · 0.35 · 1100; L3 · `layer.stacks_shelving` · 0.6 · 1250 · alpha 0.5; L5 · `layer.fore_stanchions` · 1.3 · 1870 |

(All keys above are `archive_of_voices.<group>.<name>`; the prefix is omitted in this table for width.)

### 2.5 Ambient motion, particles and the performance plan

- **Rain** (20 §2.11, amendment 30): **120** streak particles in S4 and S5, **60** in S6's `blue_hour` and S7
  (`ambient.particleCount`).
  - Angle 12° from vertical, speed 900–1100 px/s.
  - On hitting the ground: a splash ring (`archive_of_voices.fx.splash_ring`, scale 0.2 → 1, 250 ms, alpha 0.5 → 0).
  - Puddles ripple at 1.5 Hz.
- **Reflections, two scenes only:** S4 Main Street (street puddles) and S7 (the river under the bridge) use
  `fx/reflection.ts`: a **half-resolution RenderTexture** of L3/L4 flipped, 25 % alpha, updated at **15 Hz**. Every
  other puddle is a static sheen sprite (the `street_wet` ground strip's puddle ovals).
- **Record scraps:** 12–20 tiny glowing paper scraps (`archive_of_voices.fx.paper_scrap`, `recordlight` 40 %)
  drift up from dormant wireframes (`particles: scraps`). They stop around restored landmarks, which read as
  "sealed".
- **Steam** (P1): from street grates in S4, 1 puff/s, rising at 30 px/s and fading over 2 s.
- **Moths** (P2): 3 moths orbit each lit street lamp (Lissajous orbit, 18–40 px radius).
- **Awnings and bunting:** sway ±1.5° at 0.3 Hz (`PropPlacement.sway`). The wires on L2 utility poles sway ±2 px.
- **Dormant flicker:** stations not yet restored use the controller's `dormant` state (20 §5.7: −60 % saturation,
  40 % alpha and scanlines in `archive_of_voices`), flickering alpha ±15 % at 7 Hz with random dropouts.
  **Restoring** plays a 0.8 s "printing" sweep inside the success plan: a cyan scanline bar crosses the object
  left to right, leaving it solid and saturated.
- **Record-light beams** (P1): 3-line beams (20 `fx/beam.ts`), shimmering ±8 % at 12 Hz. Each restored landmark
  adds one (`beam_line` progress effects, §6.2).
- **Budget per zone:** ≤ 150 draw objects, ≤ 3 active emitters (rain + splash + scraps), grain one tile.

### 2.6 Zones, in order (8)

Every zone ends at a **frame seam**: a glowing film-frame edge with sprocket holes. Nell walks into it, the exit's
`transition: "film_seam"` plays a 400 ms film-advance wipe, and the next zone's entry cutscene titles the place
and year with Wick's X-line (§4.2).

| Zone id | Scene | `width` × `height` | Encounters (consoleX) | Segments | Interiors | Exit (`x` → zone, transition, requires) | Entry | P0 art |
|---|---|---|---|---|---|---|---|---|
| `s1_morgue` | The Morgue (intro + hub) | 3840 × 1400 | none (tutorial) | `morgue_interior` | — | 3830 → `s2_courthouse` x 80, `film_seam`, flag `engine_awake` | x 60 (intro) | Record Engine heroes + kit |
| `s2_courthouse` | Courthouse Square | 5760 × 1080 | e1 (900), e2 (3800) | `late_afternoon` | — | 5740 → `s3_schoolhouse` x 80, `film_seam`, e2 | x 80, `enter_s2` | **full** |
| `s3_schoolhouse` | Schoolhouse Hill | 3840 × 1080 | e3 (1450) | `dusk_begins` | — | 2720 (terrace) → `s4_main_street` x 80, `film_seam`, e3 | x 80, `enter_s3` | kit + school |
| `s4_main_street` | Main Street: the Lunch Counter and the Coach Terminal | 5760 × 1080 | e4 (900), e5 (2900) | `dusk_rain` | `lunch_counter` [600, 2000], `terminal` [2600, 4500] | 5740 (overpass) → `s5_church_mast` x 80, `film_seam`, e5 | x 80, `enter_s4` | kit + façades |
| `s5_church_mast` | Church Square and the Broadcast Mast | 4800 × 2000 | e6 (3350) | `night_rain` | — | 4790 (rooftops) → `s6_memorial` x 80, `film_seam`, e6 | x 80, `enter_s5` | kit + church |
| `s6_memorial` | The Memorial Steps and the Capitol Filing Hall | 5760 × 1300 | e7 (900), e8 (3250) | `blue_hour`, `hall` | `filing_hall` [3000, 5200] | 5740 (stairwell bottom) → `s7_selma` x 80, `film_seam`, e8 | x 80, `enter_s6` | kit + colonnade |
| `s7_selma` | The Bridge at Selma | 5760 × 1080 | e9 (1100) | `river_road`, `bridge`, `far_bank` | — | 5220 → `s8_stacks_vault` x 300, `fade`, cutscene `ride_home`, e9 | x 80, `enter_s7` | kit + bridge |
| `s8_stacks_vault` | The Morgue Stacks and the Editor's Vault | 6720 × 2000 | e10 (1450), e11 (2900 on `gallery`), e12 (5100) | `stacks`, `vault` | — | — (finale) | x 300, `enter_s8` | kit + vault door |

Camera: every zone uses `ZoneCamera` defaults (`xDeadzone 0.3`, `yDeadzone 260`, `lerp 0.12`, `minZoom 0.6`,
`maxZoom 1.15`) except `s5_church_mast` and `s8_stacks_vault` (`yDeadzone: 200`, so the lift and gallery climbs
pull the camera sooner).

**W2 rule (20 §1.5, game-feel item 37):** every zone lists at least two non-walk verbs **other than its payoffs**
(distinct link kinds, a sandbox, or a quest touch). Each zone's beat sheet below meets it at the tier shown; the
P0 zones for W2 are S1, S2 and S8.

#### 2.6.1 S1 · `s1_morgue` · The Morgue (intro, tutorial, and hub)

- **The player sees:**
  - x 0–620: a brick basement with a curving iron stair down from a street door (landing at y 720), rainwater
    sheeting down it.
  - x 700–1000: an ankle-deep flood across a worn wood floor (floor y 1220), with film reels in puddles and a
    stack of reel crates standing dry in the middle.
  - x 560: Otis's flashlight beam.
  - x 1180: Ida's reading desk (green banker's lamp, card catalog).
  - x 1380: the **main breaker** on the Engine's feed line.
  - x 1600–2600: **the Record Engine** dominates the centre, desaturated and silent (the zone `hub`).
    - A cream-stone plinth (1000 × 240, top at y 980) with a navy inlay band and gold trim.
    - Three concentric brass rings (outer 860 px diameter, centre (2100, 540)). The inner ring carries **12 lens
      sockets**, one per encounter, grouped by act.
    - A projector drum with an iris aperture at the centre.
    - A split gold crown fin above, which bleeds off the top of the frame (**5.8 H**, the scale-ladder hub).
  - x 2750: a locked **DARKROOM** door (decor; the playable darkroom is in S8).
  - x 2900–3600: **Hattie's proof press** and the **wall of front pages** (12 frames, every one a greyed mimic
    headline marked UNVERIFIED).
  - x 3700: the Engine's projection aperture, where the first frame seam opens.
- **Contraption:** none graded. The tutorial console is the **main breaker** (`await_interact` in the intro).
  - The Engine rings spin up (outer +1.5 turns, middle −1 turn, 2.4 s ease-out) on the intro's
    `{do: "hub", zoneId: "s1_morgue", state: "partial"}` step.
  - The drum's iris opens, and a cone of record light pours right and becomes the frame seam.
  - This teaches the verbs walk / hop / interact.
- **NPCs:** Otis (P0), Ida (P0, at the desk; hands over **Wick** in the intro), Hattie (P1, at the press).
- **Side content:** the wall of front pages starts greyed here; the true headlines come back on the S8 wall (P1).

**Geometry (world-file values):**
- `ground`: `points [[0,720],[140,720],[620,1220],[700,1236],[1000,1236],[1060,1220],[3840,1220]]`,
  `surface: archive_of_voices.ground.morgue_floor`, `underside: null`, `maxStepUp: 102`.
- `platforms`: `reel_crate` `[[760,1180],[840,1180]]` asset `archive_of_voices.prop.reel_crate`; `engine_plinth`
  `[[1600,980],[2600,980]]` asset null (drawn by the hub); `pages_gallery` `[[2900,900],[3600,900]]` asset
  `archive_of_voices.prop.gallery_deck`.
- `hub`: `{asset: archive_of_voices.prop.record_engine, x: 2100, y: null, depth: L4_back, label: "Record Engine",
  sockets: 12, restoredLine: {speakerId: archivist, text: "Every lens is lit. The Engine remembers all of it now."}}`.
- `entry`: `{x: 60}` (the intro places Nell on the landing).

**Traversal beat sheet:**

| Verb | Link id | Kind | From (surface, x) | To (surface, x) | `requires` | Tier | Purpose |
|---|---|---|---|---|---|---|---|
| hop | `s1_crate_hop_in` | `hop` (apex 60) | ground, 700 | `reel_crate`, 780 | — | **P0** | keep dry across the flood; the hop tutorial ("Space · Hop") |
| hop | `s1_crate_hop_out` | `hop` (apex 60) | `reel_crate`, 830 | ground, 1040 | — | **P0** | off the crates to Ida's desk |
| interact | (intro `await_interact`) | — | ground, 1340 | `main_breaker` | — | **P0** | wake the Engine |
| climb | `s1_plinth_climb` | `climb` | ground, 1560 | `engine_plinth`, 1620 | flag `engine_awake` | P1 | look into the lens ring (plaque `s1_engine_plate`) |
| ladder | `s1_pages_ladder` | `ladder` (asset `archive_of_voices.prop.rolling_ladder`) | ground, 2880 | `pages_gallery`, 2900 | — | P1 | read the top row of front pages (trigger `s1_front_pages`) |

W2 at P0: hop + the `await_interact` tutorial; at P1: hop + climb + ladder (clean).

#### 2.6.2 S2 · `s2_courthouse` · Courthouse Square (1954 → 1956) · **full art**

- **The player sees:**
  - A brick-herringbone square in late-afternoon light.
  - A Greek-revival **courthouse** (x 1300–2800, `archive_of_voices.prop.courthouse` at `L4_back`): 6 fluted
    columns, a pediment with a round clock, three pale projection panels between the centre columns.
  - Its steps (x 1500–2600) are only **half printed**: cyan wireframe, not solid (the e1 blocker at x 1480).
  - Behind, on L1: the Courier-Ledger tower and its antenna ring. On L2: rowhouses and oaks.
  - Past the courthouse, the ground drops into a **flooded street** (x 2800–3400), too deep to wade out of. The only
    way on is up the courthouse steps and across the raised upper terrace (y 640) to x 3400.
  - There, stairs descend to a **1950s bus stop** (x 3900: cream canopy on navy posts, bench, route sign, and a
    flip-number **DAY counter**). A parked **city bus** (x 3600–4580, cream/teal two-tone, windows dark,
    **empty**) stands behind it.
  - A second flooded gap (x 4200–5200) blocks the street (the e2 blocker at x 4190). Across it, the far corner
    (x 5300–5760) is lit: a mailbox and a corner store with an awning at y 600.
- **Stations:** e1 · Witness Projector (§5.1), console x 900; e2 · Walking Road (§5.2), console x 3800.
- **NPCs:** Wick only. The square is quiet: no crowds, no figures.
- **Side content:** the courthouse plaque (P0) lights after e1 with the e1 `sourceRef` quote; Lost Negative N1 on
  the cornice ledge (P1) and N2 on the corner awning (P1); the cornice view trigger (P0).

**Geometry:**
- `ground`: `points [[0,900],[2800,900],[2810,1040],[3390,1040],[3400,900],[4190,900],[4200,1040],[5190,1040],
  [5200,900],[5760,900]]`, `surface: archive_of_voices.ground.brick_plaza`, `maxStepUp: 102` (a 140-deep flood
  cannot be climbed out of, so the two gaps are real walls).
- e1 payoff terrain merges `[[1500,900],[2600,640],[3400,640],[3700,900]]` (steps, terrace, bus-stop stair); e2
  payoff terrain merges `[[4200,900],[5200,900]]` (the Walking Road).
- `platforms`: `flagpole_plinth` `[[2630,560],[2700,560]]` asset `archive_of_voices.prop.flagpole_plinth`;
  `cornice_ledge` `[[2440,420],[2700,420]]` asset null (drawn by the courthouse); `corner_mailbox`
  `[[5270,800],[5330,800]]` asset `archive_of_voices.prop.mailbox`; `corner_awning` `[[5380,600],[5620,600]]` asset
  null (drawn by `archive_of_voices.prop.corner_store`).
- `props` (P0): `courthouse` at x 2050 (`L4_back`); `courthouse_clock` (id `courthouse_clock`) at (2050, 180);
  `flood_band` at (3100, 1040) and (4700, 1040) (`L4_play`, scale 1); `corner_store` at x 5520 (`L4_back`);
  `lamppost` at x 1000, 3300 (`L5_fore`); `parking_meter` at x 600, 3500 (`L5_fore`); `newspaper_bundle` at x 3960
  (`L5_fore`).

**Traversal beat sheet** (amendment 28: the climb links to the negatives):

| Verb | Link id | Kind | From (surface, x) | To (surface, x) | `requires` | Tier | Purpose |
|---|---|---|---|---|---|---|---|
| hop | `s2_plinth_hop` | `hop` (apex 80) | ground, 2560 (top step) | `flagpole_plinth`, 2650 | solved `e1_brown` | **P0** | reach the flagpole plinth |
| climb | `s2_cornice_climb` | `climb` | `flagpole_plinth`, 2680 | `cornice_ledge`, 2660 | solved `e1_brown` | **P0** | the cornice view (trigger `s2_cornice_view`, P0); Negative N1 (P1) |
| drop | `s2_cornice_drop` | `drop` | `cornice_ledge`, 2450 | ground, 2400 | solved `e1_brown` | **P0** | back down to the steps |
| hop | `s2_mailbox_hop` | `hop` (apex 60) | ground, 5230 (end of the road) | `corner_mailbox`, 5290 | solved `e2_montgomery` | **P0** | onto the mailbox |
| climb | `s2_awning_climb` | `climb` | `corner_mailbox`, 5320 | `corner_awning`, 5400 | solved `e2_montgomery` | **P0** | Negative N2 (P1) on the awning |

No link straddles a blocker (e1 blocker 1480, e2 blocker 4190), and every link requires its station (R11). Payoffs
not counted: the courthouse steps (e1) and the Walking Road (e2). W2 at P0: hop + climb + drop (clean).

#### 2.6.3 S3 · `s3_schoolhouse` · Schoolhouse Hill (September 1957)

- **The player sees:**
  - A street climbing a gentle hill (the ground rises from y 900 to 820). Autumn trees in `autumn`.
  - A **newsstand kiosk** (x 1000–1560) with racks, an awning and bundled papers. Inside: a **teletype Wire
    Ticker** (x 1200) and a brass **Prediction Selector** console (x 1450).
  - A telegraph pole (x 1700) carries a wire up the hill to the school.
  - The **high school** (x 1900–3600) stands on a raised terrace at y 700. It is tan brick with cream stone trim,
    a central entrance tower and four tall arched windows.
  - Its doors (x 2650) are blocked by a translucent grey-lavender **barrier projection**: abstract scanline bars
    over the front walk (the e3 blocker at x 2290). **No soldiers and no figures are shown.**
  - Nine small **walk lamps** line the front walk, unlit.
  - A document plate on the gatepost (x 2250) reads the fixture concept name "Little Rock Nine (1957)".
- **Station:** e3 · Wire Ticker and Prediction Selector (§5.3), console x 1450.
- **NPCs:** none in person. The ticker "speaks" by printing.
- **Side content:** after e3, the nine walk lamps stay lit as a quiet memorial count (the prefab's solved pose);
  the gatepost plate (P0) shows the e3 `sourceRef` quote once e3 is solved.

**Geometry:**
- `ground`: `points [[0,900],[1800,880],[2290,820],[2450,700],[3840,700]]`, `surface:
  archive_of_voices.ground.sidewalk`. The front walk (2290 → 2450) is the upward route the e3 payoff opens.
- `platforms`: `bundle_stack` `[[880,820],[940,820]]` asset `archive_of_voices.prop.newspaper_bundle`;
  `pole_crossarm` `[[1660,440],[1740,440]]` asset null (the pole is `part.wire_ticker_telegraph_pole`).
- `props`: `schoolhouse` at x 2750, y 700 (`L4_back`); `school_doors` (id `school_doors`) at (2650, 700),
  `restoredBy: e3_little_rock`; `lamppost` at x 600 (`L5_fore`).

**Traversal beat sheet:**

| Verb | Link id | Kind | From | To | `requires` | Tier | Purpose |
|---|---|---|---|---|---|---|---|
| hop | `s3_bundle_hop` | `hop` (apex 60) | ground, 840 | `bundle_stack`, 900 | — | P1 | peek over the kiosk racks (ambient line) |
| climb | `s3_pole_climb` | `climb` | ground, 1690 | `pole_crossarm`, 1700 | — | P1 | follow the wire up the hill with the eye; trigger `s3_wire_view` |
| drop | `s3_crossarm_drop` | `drop` | `pole_crossarm`, 1740 | ground, 1790 | — | P1 | back down |

Payoff not counted: the barrier dissolving over the front walk (e3). W2 at P1: hop + climb + drop.

#### 2.6.4 S4 · `s4_main_street` · Main Street: the Lunch Counter and the Coach Terminal (1960–1961)

- **The player sees:**
  - Dusk and steady rain. Wet asphalt reflecting lamp glows (one of the two reflection scenes).
  - A **five-and-dime** storefront (x 600–2000, `archive_of_voices.prop.dimestore_facade`, the `lunch_counter`
    interior's façade) with a big generic "5-10-25¢" sign board and display windows. On entering, it cuts away to
    the **lunch counter**:
    - a long counter (cream top, chrome edge, navy front) with **12 empty chrome stools** and teal vinyl seats;
    - pie cases (P1);
    - a **three-panel menu board** on the back wall (x 1000–1900);
    - a swivel **pendant lamp** over the counter (x 1450);
    - a round-windowed **swing door** to the kitchen (x 1950), which is locked (the e4 blocker at x 1990).
  - Through the kitchen, an alley (x 2100–2600) with a fire escape leads to the side door of a
    streamline-moderne **coach terminal** (x 2600–4500, `archive_of_voices.prop.terminal_facade`): curved corner,
    chrome speed bands, a vertical fin sign "TERMINAL".
  - Inside the terminal:
    - two waiting-room doors separated by a **brass divider rail** (x 2800–3500);
    - a waiting bench (x 3480–3560) and a **split-flap departures board** (x 3600–3820, top at y 640);
    - **6 brass relay junction boxes** mounted along the platform canopy rail (x 3000–4300, y 520);
    - a corrugated **rolling gate** (x 4450) blocking the platform (the e5 blocker at x 4440).
  - Beyond the gate: the platform, and a stair up (x 4700–5100) to a street overpass (y 560) and the frame seam.
- **Stations:** e4 · Witness Projector, menu-board variant (§5.4), console x 900; e5 · Relay Line (§5.5), console
  x 2900.
- **NPCs:** none in person. A framed **withheld photo plate** by the departures board shows only a caption.
- **Secret:** Lost Negative N3 in the terminal rafters (x 4000, y 380), reachable after e5 when the powered canopy
  lights reveal truss handholds.

**Geometry:**
- `ground`: `points [[0,900],[4700,900],[5100,560],[5760,560]]`, `surface: archive_of_voices.ground.street_wet`
  (puddle ovals = the reflection masks).
- `interiors`: `lunch_counter` `{x0: 600, x1: 2000, facade: archive_of_voices.prop.dimestore_facade, facadeAt:
  [600, -50], segment: null}`; `terminal` `{x0: 2600, x1: 4500, facade: archive_of_voices.prop.terminal_facade,
  facadeAt: [2600, -50], segment: null}`.
- `platforms`: `waiting_bench` `[[3480,820],[3560,820]]` asset `archive_of_voices.prop.bench`; `board_top`
  `[[3600,640],[3820,640]]` asset null (drawn by `part.relay_line_departures_board`); `rafters`
  `[[3700,380],[4300,380]]` asset null, `requires: {solved: e5_freedom_rides}`; `fire_escape_landing`
  `[[2180,560],[2420,560]]` asset `archive_of_voices.prop.fire_escape`.
- `props` (P0): `lunch_counter` at x 1300 (`L4_back`); `counter_stool` ×12 with ids `stool_01`…`stool_12` at
  x 700 + 100·(i − 1) (`L4_play`); `swing_door` (id `swing_door`) at x 1950 (the e4 blocker asset);
  `canopy_rail` at (3650, 500); `overpass_stair` at x 4900; `parking_meter` at x 400, 5300 (`L5_fore`);
  `lamppost` at x 2300, 5000 (`L5_fore`).

**Traversal beat sheet** (amendment 28: the climb link to the negative):

| Verb | Link id | Kind | From | To | `requires` | Tier | Purpose |
|---|---|---|---|---|---|---|---|
| ladder | `s4_fire_escape` | `ladder` | ground, 2200 | `fire_escape_landing`, 2210 | — | P1 | overlook Main Street in the rain (trigger `s4_fire_escape_view`) |
| hop | `s4_bench_hop` | `hop` (apex 60) | ground, 3450 | `waiting_bench`, 3500 | — | P1 | up onto the bench |
| hop | `s4_board_hop` | `hop` (apex 100) | `waiting_bench`, 3550 | `board_top`, 3620 | — | P1 | onto the departures board |
| climb | `s4_rafter_climb` | `climb` | `board_top`, 3800 | `rafters`, 3760 | solved `e5_freedom_rides` | P1 | Negative N3 in the rafters |
| drop | `s4_rafter_drop` | `drop` | `rafters`, 4280 | ground, 4320 | solved `e5_freedom_rides` | P1 | back to the platform side of the gate area |

The rafter links sit west of the e5 blocker (4440) and require e5 (R11). Payoffs not counted: the swing door (e4)
and the rolling gate (e5). W2 at P1: ladder + hop + climb + drop.

#### 2.6.5 S5 · `s5_church_mast` · Church Square and the Broadcast Mast (spring 1963)

- **The player sees** (y already converted, ground 1820):
  - Night rain. A brick **church** (x 300–1600, `archive_of_voices.prop.church`): twin square towers with
    pyramidal caps, a central **rose window** (circle motif, lit warm from inside), three arched doors, wide steps.
  - A **park** (x 1700–3200) with an octagonal cream-and-navy **bandstand** (P1; deck at y 1760), empty benches and
    oaks.
  - A lattice-steel **broadcast mast** (x 3600, 1700 px tall, bleeding off the top) with **five relay stations**
    at heights y 1680, 1520, 1360, 1200 and 1040. A sixth, stray station stands on a separate pole (x 3300). The
    mast's **service lift cage** waits at the bottom, dark. The mast's top platform is at y 880.
  - East of the mast, a block of rooftops at y 1040 (x 3690–4800) that the lift reaches; the frame seam is at
    their far end.
  - On L2, the skyline's rowhouse **windows are dark**.
- **Station:** e6 · Broadcast Relay (§5.6), console x 3350.
- **Sensitivity:** the park is empty and still. Nothing depicts the dogs or hoses. They exist only in the node
  card's typed text.
- **Secret:** Lost Negative N4 on the mast's top platform (y 880), reached from the rooftops after e6.

**Geometry:**
- `ground`: `points [[0,1820],[3680,1820],[3690,1040],[4800,1040]]` (the 780 rise at x 3690 is the building face:
  only the lift gets you up), `surface: archive_of_voices.ground.brick_plaza`.
- `platforms`: `bandstand_deck` `[[2000,1760],[2720,1760]]` asset null (drawn by `prop.bandstand`, P1);
  `mast_top` `[[3560,880],[3680,880]]` asset null (drawn by `part.broadcast_relay_mast`).
- `props`: `church` at x 950 (`L4_back`); `rose_window_glow` at (950, 1200), `glow: true`; `rooftop_block` at
  x 4240 (`L4_back`); `bandstand` at x 2360 (P1); `window_cluster` ×10 on L2 with `restoredBy: e6_birmingham`
  (P1); `bench` at x 1900, 3000 (`L5_fore`).

**Traversal beat sheet:**

| Verb | Link id | Kind | From | To | `requires` | Tier | Purpose |
|---|---|---|---|---|---|---|---|
| hop | `s5_bandstand_hop` | `hop` (apex 60) | ground, 1960 | `bandstand_deck`, 2030 | — | P1 | stand where the Record Lens rail runs |
| drop | `s5_bandstand_drop` | `drop` | `bandstand_deck`, 2710 | ground, 2780 | — | P1 | off the far side toward the mast |
| climb | `s5_mast_climb` | `climb` | ground, 3710 (rooftops) | `mast_top`, 3660 | solved `e6_birmingham` | P1 | Negative N4; trigger `s5_mast_view` |

Payoff not counted: the mast lift ride (e6). W2 at P1: hop + drop + climb.

#### 2.6.6 S6 · `s6_memorial` · The Memorial Steps and the Capitol Filing Hall (August 1963 → 1964)

- **The player sees:**
  - Blue hour. A long **reflecting pool** (x 0–2700) mirrors a neoclassical **memorial colonnade**
    (x 800–2700, `archive_of_voices.prop.memorial_colonnade`, 12 columns, attic band) standing on a podium at
    y 640. Its interior shows only a warm glow; **no statue is drawn**.
  - The memorial's broad steps (x 1100–2400) are wireframe (the e7 blocker at x 1090).
  - At the pool's edge (x 900), a 1940s **cord switchboard** on a stand.
  - After the steps solidify, a colonnaded walkway at y 640 leads into the **Capitol Filing Hall** (the
    `filing_hall` interior, x 3000–5200): cream marble with a navy inlay border, arched windows, brass, and a
    gallery at y 380 reached by a library ladder.
    - A **pneumatic delivery tube** drops slips onto a sorting table (x 3300–3500).
    - Two tall oak-and-brass **filing cabinets** stand on floor rails over the head of a hidden stair: "CIVIL
      RIGHTS ACT · 1964" (x 3900) and "VOTING RIGHTS ACT · 1965" (x 4500). Each has a **signal meter** (VU needle)
      and a brass-shuttered **feature plate** under its label. The e8 blocker is x 4140.
- **Stations:** e7 · Program Switchboard (§5.7), console x 900; e8 · Filing Cabinets (§5.8), console x 3250.
- **NPCs:** **Dolores** at the switchboard (P1; tutorial voice for linking).
- **Side content:** after e7, the printed program lies on the switchboard's keyshelf (prop `printed_program`,
  P2 quest touch for Hattie).

**Geometry:**
- `ground`: `points [[0,900],[2400,900],[2410,640],[4800,640],[4810,300],[5760,300]]`, `surface:
  archive_of_voices.ground.marble_floor`. e7 terrain merges `[[1100,900],[2400,640]]` (the steps); e8 terrain
  merges `[[4150,640],[4450,1150],[5760,1150]]` (the stairwell down and the corridor to the exit).
- `interiors`: `filing_hall` `{x0: 3000, x1: 5200, facade: archive_of_voices.prop.hall_facade, facadeAt: [3000,
  100], segment: "hall"}`.
- `platforms`: `hall_gallery` `[[3050,380],[3800,380]]` asset `archive_of_voices.prop.gallery_deck`.
- `props`: `reflecting_pool` at x 1350 (`L4_play`); `memorial_colonnade` at x 1750, y 640 (`L4_back`);
  `floor_rail` at x 4200 (the pneumatic drop's basket and the sorting table are skin parts); `printed_program` (id `printed_program`, P2) at x 950 with `touch: {requires: {solved:
  e7_march}, litAsset: null, lines: [], cue: "page_turn"}`.

**Traversal beat sheet:**

| Verb | Link id | Kind | From | To | `requires` | Tier | Purpose |
|---|---|---|---|---|---|---|---|
| ladder | `s6_gallery_ladder` | `ladder` (asset `archive_of_voices.prop.rolling_ladder`) | ground, 3080 | `hall_gallery`, 3100 | — | P1 | the gallery plaque `s6_hall_plaque` and the view over the cabinets |
| drop | `s6_gallery_drop` | `drop` | `hall_gallery`, 3790 | ground, 3840 | — | P1 | back to the floor |
| quest touch | `printed_program` | touch | ground, 950 | — | solved `e7_march` | P2 | Hattie's program quest |

Payoffs not counted: the memorial steps (e7), the stairwell (e8). W2 at P1: ladder + drop.

#### 2.6.7 S7 · `s7_selma` · The Bridge at Selma (March 1965)

- **The player sees:**
  - Night, light rain. A riverside road with street lamps (x 0–1200).
  - A **steel through-arch bridge** (x 1300–4300, `archive_of_voices.part.timeline_bridge_arch_bridge`) in
    `steel`, its arch a great half-circle of lattice with the crown at (2800, 280). The bridge's **crown section is
    missing four bays** (x 2200–3400, one per 300 units), with the river visible through the gaps (the e9 blocker
    at x 2190). The river runs below (one of the two reflection scenes).
  - A brass **surveyor's lectern** console at the bridge foot (x 1100).
  - The far bank (x 4300–5760): a dated document plate (x 4400), a riverside ledge under the far abutment (y 1010),
    and a **streetcar** (cream/teal, empty) at a stop (x 5200–5760).
- **Station:** e9 · Timeline Bridge (§5.9), console x 1100.
- **Payoff tone:** when the span locks, **the rain stops** (the `bridge` segment's variant). Run is disabled on the
  bridge (`runEnabled: false`) and music drops to `solemn`. The camera pulls wide. The crossing takes about 12 s.
  There are no crowds and no figures; the bridge lamps light as Nell passes (the prefab's solved pose).
- **Secret:** Lost Negative N5 on the riverside ledge (x 4600), reached by the riverbank drop after crossing.

**Geometry:**
- `ground`: `points [[0,900],[2190,900],[2200,1060],[3400,1060],[3410,900],[5760,900]]`, `surface:
  archive_of_voices.ground.sidewalk` (the bridge hero draws its own deck over it). e9 terrain merges
  `[[2200,900],[3400,900]]`.
- `platforms`: `riverside_ledge` `[[4480,1010],[4700,1010]]` asset null.
- `props`: `lamppost` at x 300, 800 (`L5_fore`); `bay_lamp` standards are skin parts; the streetcar is the skin part
  `part.timeline_bridge_streetcar` used as the `ride_home` vehicle.

**Traversal beat sheet:**

| Verb | Link id | Kind | From | To | `requires` | Tier | Purpose |
|---|---|---|---|---|---|---|---|
| drop | `s7_bank_drop` | `drop` | ground, 4470 | `riverside_ledge`, 4520 | solved `e9_selma` | P1 | Negative N5 under the abutment |
| ladder | `s7_bank_ladder` | `ladder` | `riverside_ledge`, 4680 | ground, 4700 | solved `e9_selma` | P1 | back up the riverbank |
| board | (exit `s7_to_s8` + cutscene `ride_home`) | — | ground, 5220 | `s8_stacks_vault`, 300 | solved `e9_selma` | **P0** | the streetcar home |

Payoff not counted: the bridge deck (e9). W2 at P1: drop + ladder. **W1 warning expected** for this zone: its only
payoff (`bridge_forms`) is `vertical: "none"`, because the crossing at walking pace is the scene.

#### 2.6.8 S8 · `s8_stacks_vault` · The Morgue Stacks and the Editor's Vault (the present → dawn)

- **The player sees** (y already converted: floor 1400, gallery 1020, vault level 1900):
  - The streetcar pulls into the Morgue's loading dock (x 0–600), where the **wall of front pages** hangs (x 150–750).
  - The **stacks** (x 800–2600): six closed **compact-shelving units** with wheel cranks, the aisle shut (the e10
    blocker at x 2300).
    - **Theo** stands by a spilled cabinet (x 1000).
    - A **provenance cabinet** has two drawers, "PRIMARY SOURCE" (x 1600) and "SECONDARY SOURCE" (x 2000).
    - A rolling library ladder, locked, leans at x 2760.
  - The **DARKROOM** door (x 2620), dark until Otis unlocks it (P1).
  - Above, a **gallery** at y 1020 (x 2780–4600) holds the **Big Board**: a brass wall **1100 wide** with 7 pneumatic
    **canisters** and tube channels.
  - Through arches on L3, the **Record Engine** in the next hall (the zone `hub`, the same machine seen in S1), its
    lenses lit for every restoration so far (P1 `hub_socket`s).
  - A **vault lift** (x 4720) at the floor's east end goes down 500 to the vault level (the e11 blocker at x 4690).
  - The **Editor's Vault** (x 5000–6400) at the vault level: a round door (1000 px, **5.9 H**) in a cream-stone
    socket with radiating navy grooves:
    - 4 **tumbler wheels** at 12, 3, 6 and 9 o'clock;
    - a central spoked handwheel;
    - four bolts;
    - a brass **voice grille** that glows when the Editor speaks.
- **Stations:** e10 · Provenance Drawers (§5.10), console x 1450; e11 · Big Board (§5.11), console x 2900 on
  `gallery`; e12 · Tumbler Vault (§5.12, vault layout), console x 5100.
- **NPCs:** Theo (P1; the misconception personified, friendly), Otis (P1, at the darkroom), Hattie (P1, at the
  front-page wall on the dock).
- **Finale:** the vault opens onto the **press-organ** (brass pipes, type cases, a big roller) printing the story.
  The camera then rises through the Morgue ceiling to the city at **dawn** (the `vista` step, §4.3), where every
  landmark's record-light beam reaches the antenna ring.

**Geometry:**
- `ground`: `points [[0,1400],[4700,1400],[4710,1900],[6720,1900]]`, `surface:
  archive_of_voices.ground.morgue_floor`. The vault level is the ground east of the lift shaft (20 §4.1's
  "`vault_level`" names this span; it is not a separate platform, because the heightfield is single-valued). The
  e11 blocker keeps Nell off the edge until the lift runs.
- `platforms`: `gallery` `[[2780,1020],[4600,1020]]` asset `archive_of_voices.prop.gallery_deck`.
- `hub`: `{asset: archive_of_voices.prop.record_engine, x: 3700, y: 760, depth: L3_mid, label: "Record Engine",
  sockets: 12, restoredLine: {speakerId: archivist, text: "Every lens is lit. The Engine remembers all of it now."}}`.
- `props`: `front_pages_wall` (id `front_pages_wall`, anchors `page_0`…`page_11`) at x 450 (`L4_back`);
  `darkroom_door` (id `darkroom_door`, `states: [{state: lit, asset: null}]`) at x 2620; `vault_lift` (id
  `vault_lift`) at x 4720 (the e11 ride vehicle); `vault_socket` at (5700, 1900) (`L4_back`); `stanchions` at x 900,
  5000 (`L5_fore`).

**Traversal beat sheet:**

| Verb | Link id | Kind | From | To | `requires` | Tier | Purpose |
|---|---|---|---|---|---|---|---|
| ladder | `s8_rolling_ladder` (asset `archive_of_voices.prop.rolling_ladder`) | `ladder` | ground, 2760 | `gallery`, 2790 | solved `e10_sources` | **P0** | the traversal the e10 payoff builds: up to the Big Board |
| drop | `s8_gallery_drop` | `drop` | `gallery`, 4590 | ground, 4640 | — | **P0** | down from the gallery to the vault lift (after e11) |
| sandbox | `darkroom` | sandbox | ground, 2620 | — | flag `darkroom_unlocked` | P1 | develop the negatives (§6.6) |
| quest touch | `theo_spill` | talk / afterSeal | ground, 1000 | — | — | P1 | Theo's quest (§6.4) |

Payoffs not counted: the rolling ladder rolling into place (e10's `stairs_rise`), the vault lift (e11), the vault
(e12). The e10 payoff's terrain is empty on purpose: its traversal is the `s8_rolling_ladder` link it unlocks
(Appendix A.2). W2 at P0: ladder + drop.

---

## 3 · Characters

### 3.1 Protagonist: **Nell**, junior archivist (silent protagonist)
- **Look:** mid-twenties, practical.
  - A mustard cardigan over a cream blouse, navy trousers rolled at the ankle, rubber boots (the flood).
  - A salmon scarf (`autumn`) that trails when she runs: a readable silhouette.
  - A leather **satchel** across the body. Cotton archivist's gloves on her belt.
  - Readable at 1 H: scarf and satchel strap make a diagonal.
- **Art (20 §5.5, 02 §3b):** the one Kenney `toon-characters` rig, body `female_adventurer`, **recoloured at build
  time** from `Vector/character_femaleAdventurer.svg` into the atlas `shared.char.nell` (02 §3b.4 Nell column: skin
  `#E3B38A`/`#C4946C`, hair `#6E4A2E`, cardigan `#C9A13B`/`#B8912F`/`#A8842C`, trousers `inlay.navy`, rolled cuff
  `stone.base`, rubber boots `#3F5857`, strap `#8A5A3E`). Costume overlays on per-frame anchors:
  `archive_of_voices.costume.nell_scarf` (`back`, `follow: spring`, `layer: behind`) and
  `archive_of_voices.costume.nell_satchel` (`torso`). No tinting; no puppet upgrade in this game.
- **Movement:** 20 §2.4 (walk 300 units/s, Shift run 460, disabled on the S7 bridge; hop, climb, ladder and drop by
  links; cosmetic hop with no link in range). There is no jump velocity or gravity.
- **Animation set** (pose names from the rig; 20 §5.5's 25 used poses):

  | State | Frames | Notes |
  |---|---|---|
  | idle | `idle` | the scarf sways on its spring |
  | walk | `walk0`–`walk7` at 12 fps | 8-frame cycle |
  | run | `run0`–`run2` at 14 fps | disabled on the Selma bridge |
  | hop / drop | `jump` rising, `fall` descending | 6 % land squash + dust puff |
  | climb / ladder | `climb0`, `climb1` at 8 fps | the cornice, the pole, the rafters, the mast, the ladders |
  | interact | `interact` | at consoles, plaques, the breaker |
  | panel open | `think` | while a panel is open (scrub/board/vault) |
  | success | **`show`** (holds up the restored record) for 1.2 s, then `idle` | **every** station; Nell never plays `cheer` in this sensitive biome (it replaces the old per-station memorial list) |
  | talk | `talk` | when an NPC addresses her |

### 3.2 Guide: **Ida the Archivist** (fixture character `archivist`, voice archetype **`wise_mentor`**)
- **Look:** in her late sixties, **deep brown skin**, silver hair in a low bun, cat-eye reading glasses on a beaded
  chain, a long teal cardigan over a cream blouse, archivist's cotton gloves, a brass hurricane lantern.
  - Seen in person only in S1, at her desk (NPC `ida`, §6.4), and in the outro vista.
  - Art: the rig with body `female_person` → atlas `shared.char.ida` (02 §3b.4 Ida column: skin `#6B4330`/`#553423`,
    hair `#C9C9D1`, cardigan `#2F6F73`), plus overlays `archive_of_voices.costume.ida_bun_glasses` (`head`) and
    `archive_of_voices.costume.ida_cardigan` (`torso`). The old bust puppet is dropped.
- **Personality:** precise, warm, dry humour; never lectures past two sentences. She treats the player as a
  colleague, not a pupil. Her praise is specific ("That slab holds."). Her corrections point at evidence, never at
  the answer. She uses archive metaphors: slides, reels, drawers, splices, bylines.
- **Voice (`wise_mentor`):**
  - short declaratives, present tense;
  - addresses the player as "Nell";
  - asks no quiz questions (a hint is a pointer, never a test);
  - never uses "correct"/"wrong";
  - speaks the **instruction** in imperative form, the **insight** as a pre-success truth of the world, and the
    **success** line as the concept stated outright (20 §2.7).
- **Companion in explore mode: Wick, the lantern** (`cast.guide.companion`).
  - A floating brass hurricane lantern (40 × 60 px) with two paper **moth-wings** (fins) and a warm flame core:
    the puppet `archive_of_voices.companion.wick` (02 §3b.5: idle bob ±4 px at 0.5 Hz, wings ±10° at 3 Hz, flame
    at 8 fps).
  - It hovers above and behind Nell's shoulder (`offset: [-40, -170]`, `lagSec: 0.35`, `bobPx: 4`).
  - It carries Ida's voice. **When Ida speaks, the flame brightens** (glow scale 1 → 1.3) and the wings beat
    faster (±16° at 6 Hz).
  - On hint rungs, Wick flies to the station's `meta.hintTargets(rung)` anchors and circles, lands or hovers
    (§5.0.5).
- **Emblem (dialogue bar, 64 px): "the Reel"** = `{glyph: "reel", ring: "#E7A08C", accent: "#FFFFFF", gaps: 2}`.
  - Three concentric rings on a dark fill; the inner two are broken like a labyrinth, the gaps drawn as film-reel
    spoke cut-outs; a tiny lantern keyhole at the centre (the `reel` glyph path in `emblem-glyphs.ts`).
- **Info button:** the bible's white "i" in a double ring, salmon outer ring to match Ida (DOM).

### 3.3 The Editor (fixture character `editor`, voice archetype **`narrator`**)
- **Voice only. Never shown as a person.** He is represented by:
  - the vault's circular brass **voice grille** (`part.tumbler_vault_voice_grille`), which glows `lamp` when he
    speaks;
  - the **press-organ** inside the vault.
- **Emblem** (`cast.speakers[0]`): `{glyph: "slug", ring: "#27466A", accent: "#F2E3C6", gaps: 2}`: a navy ring
  around a single cream **type slug** stamped "E", with the broken-ring detail.
- **Voice (`narrator`):** clipped, newsroom cadence, second person. He speaks only at the vault (X09, the e12
  taunts, e12.S1) and in the finale. He is `BossStaging.speakerId` for e12.

### 3.4 Minor NPCs (fictional archive staff of the present day) = `cast.extras`

| Extra `id` | `name` | `voiceArchetype` | `role` | `emblem` | Look (`Npc.look`) | Tier | Role and micro-quest | Lore delivered |
|---|---|---|---|---|---|---|---|---|
| `otis` | Otis Pell | `gruff_guard` | night watchman | `{glyph: "flashlight", ring: "#6E7F9A", accent: "#F6D27A"}` | `shared.char.otis` (`male_person`) + `costume.otis_watch_cap` (`head`), `costume.otis_flashlight` (`hand_r`) | P0 (S1), P1 (S8) | In the intro he points Nell to the breaker. In S8 he unlocks the darkroom once all five negatives are held. | How the storm flooded the basement and scrambled the reels (the premise, diegetically). |
| `hattie` | Hattie Greer | `wise_mentor` | retired typesetter | `{glyph: "eyeshade", ring: "#4E8A6A", accent: "#F2E3C6"}` | `shared.char.hattie` (`female_person`) + `costume.hattie_eyeshade` (`head`) | P1 | Sets each restored headline on the wall of front pages (the S8 `label_swap`s). P2 quest: bring back the printed program from e7. | That the paper printed front pages as the record; why the 1964 and 1965 acts deserve different front pages. |
| `dolores` | Dolores Vance | `cheerful_sidekick` | volunteer, retired operator | `{glyph: "headset", ring: "#C9A13B", accent: "#FFFFFF"}` | `shared.char.dolores` (`female_person`) + `costume.dolores_headset` (`head`) | P1 | Explains cord boards before e7. | That a march that size ran on phone calls, paper, marshals and buses (fixture: Rustin "coordinated the day's transport, marshals and program"). |
| `theo` | Theo | `nervous_scholar` | student volunteer | `{glyph: "nib", ring: "#2F6F73", accent: "#F7F1E3"}` | `shared.char.theo` (`male_person`) + `costume.theo_cap` (`head`), `costume.theo_textbook` (`hand_l`) | P1 | **The misconception, personified:** he is sure "old means primary". e10 is framed as helping him file the spill; afterwards he corrects himself (quest `theo_spill`). | The e10 lesson restated in a peer's voice. |

Every emblem has `gaps: 2`; every `portrait` is null (sensitive biome: no portraits). R10 name lint: none of "Otis
Pell", "Hattie Greer", "Dolores Vance", "Theo" matches a person named in the fixture (Parks, Faubus, Eisenhower,
Connor, Kennedy, Johnson, Randolph, Rustin, King, Lewis).

### 3.5 `cast` (world-file value)

```json
{
  "protagonist": { "name": "Nell", "look": { "atlas": "shared.char.nell", "scale": 1, "costume": [
    { "asset": "archive_of_voices.costume.nell_scarf", "anchor": "back", "dx": 0, "dy": 0, "follow": "spring", "layer": "behind" },
    { "asset": "archive_of_voices.costume.nell_satchel", "anchor": "torso", "dx": 0, "dy": 0, "follow": "rigid", "layer": "front" } ] } },
  "guide": { "characterId": "archivist",
    "emblem": { "glyph": "reel", "ring": "#E7A08C", "accent": "#FFFFFF", "gaps": 2 }, "portrait": null,
    "companion": { "asset": "archive_of_voices.companion.wick", "offset": [-40, -170], "lagSec": 0.35, "bobPx": 4 } },
  "speakers": [ { "characterId": "editor",
    "emblem": { "glyph": "slug", "ring": "#27466A", "accent": "#F2E3C6", "gaps": 2 }, "portrait": null } ],
  "extras": [
    { "id": "otis", "name": "Otis Pell", "role": "night watchman", "voiceArchetype": "gruff_guard",
      "emblem": { "glyph": "flashlight", "ring": "#6E7F9A", "accent": "#F6D27A", "gaps": 2 }, "portrait": null },
    { "id": "hattie", "name": "Hattie Greer", "role": "retired typesetter", "voiceArchetype": "wise_mentor",
      "emblem": { "glyph": "eyeshade", "ring": "#4E8A6A", "accent": "#F2E3C6", "gaps": 2 }, "portrait": null },
    { "id": "dolores", "name": "Dolores Vance", "role": "volunteer, retired operator", "voiceArchetype": "cheerful_sidekick",
      "emblem": { "glyph": "headset", "ring": "#C9A13B", "accent": "#FFFFFF", "gaps": 2 }, "portrait": null },
    { "id": "theo", "name": "Theo", "role": "student volunteer", "voiceArchetype": "nervous_scholar",
      "emblem": { "glyph": "nib", "ring": "#2F6F73", "accent": "#F7F1E3", "gaps": 2 }, "portrait": null } ]
}
```

---

## 4 · Story arc and every line of dialogue

### 4.1 Act structure mapped onto encounters

| Act | Fixture unit | Zones | Encounters (role) | Arc beat |
|---|---|---|---|---|
| Prologue | — | S1 | none | The flood, the Engine, the stakes, Wick. |
| **I · Rulings are not enough** | u_origins (1954–1957) | S2, S3 | e1 Brown (teach), e2 Montgomery (teach), e3 Little Rock (teach) | A ruling (Brown) is words. People organize (Montgomery). Enforcement needs power (Little Rock). |
| **II · Pressure** | u_direct_action (1960–1963) | S4, S5 | e4 sit-ins (teach), e5 Freedom Rides (teach), e6 Birmingham (teach) | Nonviolent direct action creates confrontation. Confrontation becomes images. Images become pressure. |
| **III · Law** | u_legislation (1963–1965) | S6, S7 | e7 March (teach), e8 CRA vs VRA (teach), e9 Selma (teach, dated review) | Pressure becomes bills. Two laws, one year apart. The dates, not the page order. |
| **IV · The Editor's question** | u_sources + review | S8 | e10 sources (teach), e11 causation (review / synthesis), e12 boss (boss) | Weigh the evidence you restored, connect the causes, answer "why 1965". |

Teach → review → boss: e9 re-uses the ordering verb from e2 with dates. e11 re-uses the wiring verb from e5/e6
at a larger scale, with the whole earned Record Strip as evidence. e12 synthesizes causation, sources and
Selma/VRA.

### 4.2 Intro and zone-entry cutscenes (`cutscenes[]`)

`story.introCutsceneId = "intro"` (skippable; about 60 s; 20 §2.8). Line ids refer to §4.4.

```json
{ "id": "intro", "skippable": true, "steps": [
  { "do": "fade", "to": "black", "ms": 0 },
  { "do": "enter_zone", "zoneId": "s1_morgue", "x": 60, "surface": "ground" },
  { "do": "title", "text": "The Archive of Voices", "sub": "The Courier-Ledger morgue, tonight", "ms": 2500 },
  { "do": "fade", "to": "clear", "ms": 1200 },
  { "do": "camera", "x": 2100, "y": 700, "zoom": 0.7, "ms": 2400, "ease": "in_out_sine" },
  { "do": "camera", "x": 400, "y": 900, "zoom": 1, "ms": 1200, "ease": "out_cubic" },
  { "do": "control_until", "x": 640, "surface": "ground", "prompt": "Walk down the stair", "timeoutMs": 20000 },
  { "do": "say", "lines": ["I01"] },
  { "do": "walk", "actor": "player", "toX": 1100 },
  { "do": "say", "lines": ["I02", "I03", "I04", "I05", "I06"] },
  { "do": "walk", "actor": "companion", "toX": 1100 },
  { "do": "say", "lines": ["I07", "I08"] },
  { "do": "say", "lines": ["N01", "I10"] },
  { "do": "walk", "actor": "player", "toX": 1340 },
  { "do": "await_interact", "target": { "kind": "prop", "id": "main_breaker" }, "prompt": "Throw the main breaker", "timeoutMs": null },
  { "do": "set_state", "target": { "kind": "flag", "id": "engine_awake" }, "state": "on" },
  { "do": "sfx", "cue": "breaker_throw" },
  { "do": "hub", "zoneId": "s1_morgue", "state": "partial" },
  { "do": "sfx", "cue": "engine_spin" },
  { "do": "pan", "x": 3700, "y": null, "zoom": 1, "ms": 1800 },
  { "do": "say", "lines": ["N02", "I09"] },
  { "do": "pan", "x": 1340, "y": null, "zoom": 1, "ms": 900 } ] }
```

(`"lines"` hold full `WorldLine` objects in the world file: `{speakerId, text, mood}` copied from §4.4; ids are
shown here for width.) Beats: the camera crosses the dormant Engine, Nell walks down the iron stair under
`control_until`, Otis's flashlight finds her (I01), Ida speaks at her desk (I02–I08) and Wick rises from the desk to
Nell's shoulder (`walk companion`), Otis points at the breaker (N01), Ida asks Nell to throw it (I10), Nell throws it
(`await_interact`), the flag `engine_awake` opens the S1 exit, the rings spin up and the iris opens (`hub partial`),
the camera follows the cone of record light to the frame seam, Otis and Ida react (N02, I09). The exterior crane
down the rain-streaked tower is P1 (`vista` `archive_of_voices.vista.tower_rain` before the first `enter_zone`).

**Zone entries** (`Zone.entryCutsceneId`; P0; express plays only the title and the line):

| Cutscene id | Zone | Steps |
|---|---|---|
| `enter_s2` | `s2_courthouse` | `title` "Courthouse Square" / "1954 → 1956" (2200 ms); `say` [X01] |
| `enter_s3` | `s3_schoolhouse` | `title` "Schoolhouse Hill" / "September 1957"; `say` [X02] |
| `enter_s4` | `s4_main_street` | `title` "Main Street" / "Greensboro, 1960 · the terminal, 1961"; `say` [X03] |
| `enter_s5` | `s5_church_mast` | `title` "Church Square" / "Birmingham, spring 1963"; `say` [X04] |
| `enter_s6` | `s6_memorial` | `title` "The Memorial Steps" / "Washington, August 1963"; `say` [X05] |
| `enter_s7` | `s7_selma` | `title` "The Bridge at Selma" / "March 1965"; `say` [X07] |
| `enter_s8` | `s8_stacks_vault` | `title` "The Morgue Stacks" / "Tonight"; `say` [X08] |

### 4.3 Finale, arena and ride cutscenes

`story.finaleCutsceneId = "finale"` (not skippable in express; 20 §2.8). It runs in the `finale` phase after the
e12 payoff (fixes runtime-map D2):

```json
{ "id": "finale", "skippable": true, "steps": [
  { "do": "station", "encounterId": "e12_boss", "anim": "settle" },
  { "do": "sfx", "cue": "press_roll" },
  { "do": "say", "lines": ["O01", "O02"] },
  { "do": "hub", "zoneId": "s8_stacks_vault", "state": "restored" },
  { "do": "vista", "asset": "archive_of_voices.vista.dawn",
    "from": { "x": 1920, "y": 1780, "zoom": 1.3 }, "to": { "x": 1920, "y": 760, "zoom": 0.6 }, "ms": 7000, "holdMs": 1500 },
  { "do": "say", "lines": ["O03", "O04"] },
  { "do": "say", "lines": ["O05", "O06", "O07"] },
  { "do": "fade", "to": "black", "ms": 1500 } ] }
```

1. The vault door has already swung open in the e12 success plan; the press-organ rolls and prints (a 4 s paper
   outfeed, `press_roll`). The Editor's fixture after-beat (e12.S1) played as the e12 `payoffLine`; the finale opens
   with O01 (the fixture outro, verbatim) and O02.
2. **Pull-out** (`vista`, a 3840 × 2160 composition): the camera rises from the Morgue ceiling to the city at dawn
   (Z5):
   - each scene's landmark is visible on a composed skyline, restored in order;
   - 12 record-light beams arc into the antenna ring, which lights cyan;
   - the Engine's 12 lenses shine through the tower windows.

   Ida speaks O03 and O04.
3. **The wall of front pages**, now complete: Otis says O05 and Hattie says O06. Ida closes with O07.
4. Then `EndScreen` (keeps `end-screen` and the `<h1>` for e2e). O08 (the Editor, for players who developed the
   negatives) plays as the Darkroom's reward (§6.6), because cutscene steps cannot be conditional.

**Other cutscenes:**

| Id | Runs from | Steps |
|---|---|---|
| `e12_arena` | `stations[e12].boss.arenaCutsceneId` (crossing x 4900) | `music` `noir`; `camera` (5700, 1500, zoom 0.8, 1400 ms, `in_out_sine`); `station` e12 `wake` (the grille glows, the tumblers settle); `say` [X09]; `camera` (null, null, zoom 1, 900 ms) |
| `ride_mast_lift` | `stations[e6].payoff.rideCutsceneId` (E/W at the lift cage after e6) | `sfx` `lift_hum`; `ride` vehicle `archive_of_voices.part.broadcast_relay_lift_cage`, `toZoneId` `s5_church_mast`, `toX` 3720, `ms` 3200, `path` `[[3620,1820],[3620,1040]]` |
| `ride_vault_lift` | `stations[e11].payoff.rideCutsceneId` (E/W at the vault lift after e11) | `sfx` `bolt_slide`; `hub` `s8_stacks_vault` `partial` (the Engine's rings turn through the arches); `ride` vehicle `archive_of_voices.prop.vault_lift`, `toZoneId` `s8_stacks_vault`, `toX` 4800, `ms` 2600, `path` `[[4720,1400],[4720,1900]]` |
| `ride_home` | `zones[s7].exits[s7_to_s8].cutsceneId` | `walk` player to 5300; `sfx` `lamp_chime`; `ride` vehicle `archive_of_voices.part.timeline_bridge_streetcar`, `toZoneId` `s8_stacks_vault`, `toX` 300, `ms` 3000, `path` `[[5480,900],[5760,900]]` |

Cutscene count: 13 (`intro`, `finale`, 7 entries, `e12_arena`, 3 rides) ≤ 24.

### 4.4 Dialogue script

**Rules** (20 §1.5 R8/R9, §2.7; checked by the Appendix C script):
- Every line is **≤ 140 characters** and **≤ 24 words**. No quiz voice (the guide never tests the player; a hint is
  a pointer) and no fourth wall (no keys, buttons, "panel", "player", "level" or "hint" in spoken lines; world
  instruments are named as world objects: the RECORD card, the year cursor, the lamp).
- **`speakerId`** is checked against `spec.characters` ∪ `cast.extras` ∪ {`narrator`}: column **Set** is `C` for
  `spec.characters` (`archivist`, `editor`), `X` for `cast.extras` (`otis`, `hattie`, `dolores`, `theo`). No other ids
  appear.
- **Slot** is the world-file path. For stations, `LineSlot` rows with `speakerId` `archivist` may be written
  `speakerId: null` (the guide); `WorldLine` rows (approach, after, cutscenes, NPC states, triggers, taunts) must
  carry the id.
- **`[fixture]`** marks lines used verbatim from the fixture's `narrative` or `hints`.
- **R8 (answer leaks):** station-scoped slots `approach`, `instruction`, `tutorial`, `insight`, `hints[0]`,
  `hints[1]` and every `fail` line never contain the station's answer values (mimic statement text, the correct
  prediction, the first step, the survivor). `hints[2]`, `success`, `payoffLine` and `after` are exempt.
- **Instruction nouns (R9):** each instruction contains its station's `objectNoun` or a `partNouns` entry as whole
  tokens (listed in each §5 station block).
- **Tiers:** every line is P0 unless its row says P1/P2.

#### Intro (`cutscenes[intro]`)
| ID | Slot | speakerId | Set | Line |
|---|---|---|---|---|
| `I01` | intro · say 1 | `otis` | X | Mind the water. The storm came in through the basement windows and soaked every reel down here. |
| `I02` | intro · say 2 [0] | `archivist` | C | Every vault in here opens for evidence, not for guesses. Read the dates. Follow the causes. `[fixture]` |
| `I03` | intro · say 2 [1] | `archivist` | C | That machine is the Record Engine. It projects the paper's files, 1954 to 1965, as a city you can walk through. |
| `I04` | intro · say 2 [2] | `archivist` | C | The flood scrambled it. Now it shows steps that go nowhere, streets with holes, and false labels over the true ones. |
| `I05` | intro · say 2 [3] | `archivist` | C | At dawn, reels that won't play get hauled out. Then the false labels are all anyone will remember. |
| `I06` | intro · say 2 [4] | `archivist` | C | The Editor sealed his last story in the vault under the Engine. It opens only when the whole record agrees with itself. |
| `I07` | intro · say 3 [0] | `archivist` | C | My knees quit walking the projection years ago. Take Wick. He carries my voice. |
| `I08` | intro · say 3 [1] | `archivist` | C | Start at the courthouse. This story starts with a ruling, and with what people did after it. |
| `N01` | intro · say 4 [0] | `otis` | X | Main breaker's by the Engine. Water got the lower fuses, but the Engine runs on its own line. |
| `I10` | intro · say 4 [1] | `archivist` | C | Throw the main breaker by the Engine, Nell. Let's see what it still remembers. |
| `N02` | intro · say 5 [0] | `otis` | X | There she goes. Haven't seen those rings turn since the week I was hired. |
| `I09` | intro · say 5 [1] | `archivist` | C | If a repair doesn't hold, the Engine shows you where. Read what it shows you, Nell. |

#### Zone arrivals and transitions
| ID | Slot | speakerId | Set | Line |
|---|---|---|---|---|
| `X01` | `enter_s2` · say | `archivist` | C | Courthouse Square, 1954. The steps are only half printed. The record isn't sure what the Court decided. |
| `X02` | `enter_s3` · say | `archivist` | C | Little Rock, September 1957. Three years after Brown, and those school doors are still barred. |
| `X03` | `enter_s4` · say | `archivist` | C | Greensboro, 1960. A lunch counter, and next door a bus terminal. The movement is getting younger and bolder. |
| `X04` | `enter_s5` · say | `archivist` | C | Birmingham, spring 1963. Watch that mast. What happened here mattered because cameras carried it. |
| `X05` | `enter_s6` · say | `archivist` | C | Washington, August 1963. A quarter of a million people, and far more organizing than most people remember. |
| `X06` | `triggers[s6_hall_arrival]` (P1) | `archivist` | C | Two laws, one year apart. Keep them straight and you'll know what each one was for. |
| `X07` | `enter_s7` · say | `archivist` | C | Selma, March 1965. The bridge is in pieces. We'll set them by date, and we'll cross at a walk. |
| `X08` | `enter_s8` · say | `archivist` | C | Back in the stacks. The rest of the record is paper: sources, and the causes that tie them together. |
| `X09` | `e12_arena` · say | `editor` | C | Tell me why 1965. Not what happened. Why. `[fixture beat, before e12]` |
| `X10` | `stations[e11].dialogue.payoffLine` | `archivist` | C | The Big Board's lit and the vault's first bolt just moved. He's waiting for you, Nell. |

#### e1_brown · Witness Projector (`truth_finder.mimic`)
| ID | Slot | speakerId | Set | Line |
|---|---|---|---|---|
| `e1.A` | approach[0] | `archivist` | C | Three slides on the courthouse wall, all about Brown v. Board. The flood spliced one false label in with the true. |
| `e1.I` | instruction | `archivist` | C | Aim the Proof Lamp at the false slide, then retract it. |
| `e1.T` | tutorial | `archivist` | C | The lamp throws whichever slide you aim at. The FILE card pins each claim where it says it happened. |
| `e1.N` | insight | `archivist` | C | A ruling says what the law is. Whether anyone obeys it is a separate story, with its own dates. |
| `e1.H1` | hints[0] | `archivist` | C | A court ruling is a statement, not an enforcement. Keep that in mind as you read. |
| `e1.H2` | hints[1] | `archivist` | C | Think about what happened at Little Rock three years later. I've pinned it to the RECORD card. |
| `e1.H3` | hints[2] | `archivist` | C | The false label reads: Schools across the South desegregated within the year. `[fixture]` |
| `e1.F` | fail.default | `archivist` | C | The lamp holds steady. That slide is honest. Look for the label that assumes the ruling was obeyed at once. |
| `e1.F2` | fail.byKey `plessy_true` | `archivist` | C | That one holds. Brown did overturn separate but equal. The false label is about what came after the ruling. |
| `e1.S` | success | `archivist` | C | A ruling is words on paper. It took years, and federal troops, to carry Brown out of the courtroom. |
| `e1.P` | payoffLine | `archivist` | C | The steps are printing. Climb them, Nell. That terrace is the only way past the flood. |
| `e1.Z` | after[0] | `archivist` | C | The plaque by the door just lit. It quotes the ruling word for word. |

#### e2_montgomery · Walking Road (`sequencer.linear`)
| ID | Slot | speakerId | Set | Line |
|---|---|---|---|---|
| `e2.A` | approach[0] | `archivist` | C | The street past the bus stop is under water. Lay the Montgomery planks across it in order. One never happened. |
| `e2.I` | instruction | `archivist` | C | Lay the planks across the flooded street in the order they happened. |
| `e2.T` | tutorial | `archivist` | C | Each plank rises as a slab where you set it. The DAY counter at the stop runs with the year cursor. |
| `e2.N` | insight | `archivist` | C | Nothing on this road happened by accident. Every one of those days was planned by someone. |
| `e2.H1` | hints[0] | `archivist` | C | Start with the arrest and end with the court. `[fixture]` |
| `e2.H2` | hints[1] | `archivist` | C | Between them is a year of organized walking and carpooling. `[fixture]` |
| `e2.H3` | hints[2] | `archivist` | C | An arrest of one activist became a campaign because leaders were ready to organize. `[fixture]` |
| `e2.F` | fail.default | `archivist` | C | The road won't hold at that slab. Organizing came before 381 days of walking, and the court came at the end. |
| `e2.F2` | fail.byKey `acted_alone` | `archivist` | C | That slab dissolved. Nobody starts a year-long boycott alone; that plank belongs to no real day. |
| `e2.S` | success | `archivist` | C | One arrest became a 381-day boycott because people organized. It ended when the Supreme Court ruled. |
| `e2.P` | payoffLine | `archivist` | C | Walk it. Three hundred and eighty-one days of it, one slab at a time. |
| `e2.Z` | after[0] | `archivist` | C | The bus lights are on. Those seats were the point of all that walking. |

#### e3_little_rock · Wire Ticker (`truth_finder.predict_reveal`)
| ID | Slot | speakerId | Set | Line |
|---|---|---|---|---|
| `e3.A` | approach[0] | `archivist` | C | September 1957. The Guard is holding nine students at the school door. The ticker's waiting on Washington's move. |
| `e3.I` | instruction | `archivist` | C | Turn the Prediction Selector to your forecast, then send it down the wire. |
| `e3.T` | tutorial | `archivist` | C | The ticker types your forecast as you turn the dial. Nothing goes out until you send it. |
| `e3.N` | insight | `archivist` | C | A federal court ordered those doors open. A governor ordered them shut. Both orders can't stand. |
| `e3.H1` | hints[0] | `archivist` | C | A state governor is defying a federal court. Hold on to that. |
| `e3.H2` | hints[1] | `archivist` | C | A court order is being defied. Think about the tools a president holds when that happens. |
| `e3.H3` | hints[2] | `archivist` | C | Think about who outranks a state's National Guard. `[fixture]` |
| `e3.F` | fail.default | `archivist` | C | The wire prints what really happened. Read it, then set the selector to the true outcome and file it. |
| `e3.F2` | fail.byKey `states_rights` | `archivist` | C | The tape says otherwise. Once a state defies a federal court, the decision leaves Little Rock. |
| `e3.S` | success | `archivist` | C | Brown didn't enforce itself. When a governor defied a federal court, it took the President and the Army. |
| `e3.P` | payoffLine | `archivist` | C | Nine lamps. One for each student who walked in. |
| `e3.Z` | after[0] | `archivist` | C | Those doors stay open now. Go on through, Nell. |

#### e4_sit_ins · Witness Projector, menu-board variant (`truth_finder.mimic`)
| ID | Slot | speakerId | Set | Line |
|---|---|---|---|---|
| `e4.A` | approach[0] | `archivist` | C | Someone swapped the menu for three slides about the Greensboro sit-ins. One of them is a mimic. |
| `e4.I` | instruction | `archivist` | C | Swing the counter lamp onto the mimic slide, then retract it. |
| `e4.T` | tutorial | `archivist` | C | The lamp swings to whichever slide you pick. It only retracts one when you say so. |
| `e4.N` | insight | `archivist` | C | Twelve stools, and every one of them was a rule. Breaking a rule on purpose takes planning. |
| `e4.H1` | hints[0] | `archivist` | C | Sitting where you are forbidden to sit is itself a confrontation. `[fixture]` |
| `e4.H2` | hints[1] | `archivist` | C | Nonviolence describes how they answered violence, not whether they provoked a response. `[fixture]` |
| `e4.H3` | hints[2] | `archivist` | C | The mimic claims: Nonviolent meant the students avoided confrontation. `[fixture]` |
| `e4.F` | fail.default | `archivist` | C | That slide is honest. Look for the claim that turns nonviolence into passivity. |
| `e4.F2` | fail.byKey `spread_true` | `archivist` | C | That slide holds. The sit-ins spread, and SNCC came out of them. Look for the claim about how they behaved. |
| `e4.S` | success | `archivist` | C | Nonviolent never meant passive. They broke an unjust rule on purpose, stayed put, and met violence with discipline. |
| `e4.P` | payoffLine | `archivist` | C | The kitchen door's open. The alley runs through to the terminal. |

#### e5_freedom_rides · Relay Line (`linker.chain`)
| ID | Slot | speakerId | Set | Line |
|---|---|---|---|---|
| `e5.A` | approach[0] | `archivist` | C | The terminal's relay line is dead. Six junction boxes, five events of 1961. Wire each cause to what it caused. |
| `e5.I` | instruction | `archivist` | C | Wire each junction box to the event it caused, then close the circuit. |
| `e5.T` | tutorial | `archivist` | C | Draw a wire from a box to what it set off. The gauge only counts wires; it can't tell you if they're right. |
| `e5.N` | insight | `archivist` | C | A ruling on paper changes nothing until somebody tests it in person. |
| `e5.H1` | hints[0] | `archivist` | C | Start with the ruling the riders wanted to test. `[fixture]` |
| `e5.H2` | hints[1] | `archivist` | C | Violence became news; news became pressure. `[fixture]` |
| `e5.H3` | hints[2] | `archivist` | C | The federal enforcement came last, and not by choice. `[fixture]` |
| `e5.F` | fail.default | `archivist` | C | The current stops at that box. Follow the pressure: who tested what, what exposed it, and who acted last. |
| `e5.F2` | fail.byKey `law_first` | `archivist` | C | Congress passed no act in 1961. That box belongs to a later story; the riders didn't wait for a law. |
| `e5.S` | success | `archivist` | C | Riders tested a ruling, violence made headlines, and only then did Washington act. The movement pushed first. |
| `e5.P` | payoffLine | `archivist` | C | The gate's up. Take the stair to the overpass. |

#### e6_birmingham · Broadcast Relay (`linker.chain`)
| ID | Slot | speakerId | Set | Line |
|---|---|---|---|---|
| `e6.A` | approach[0] | `archivist` | C | Five relay stations up the mast and one stray. Link each event in Birmingham to the one it toppled. |
| `e6.I` | instruction | `archivist` | C | Wire the relay stations up the mast, cause to effect, then close the circuit. |
| `e6.T` | tutorial | `archivist` | C | Each dish turns toward whatever you wire into it. The lift at the foot stays dark until the circuit closes. |
| `e6.N` | insight | `archivist` | C | A bill in Washington answers pressure, and pressure has to come from somewhere. |
| `e6.H1` | hints[0] | `archivist` | C | Begin with the marches themselves. `[fixture]` |
| `e6.H2` | hints[1] | `archivist` | C | The images only mattered because they were seen. `[fixture]` |
| `e6.H3` | hints[2] | `archivist` | C | The bill was the last domino, not the first. `[fixture]` |
| `e6.F` | fail.default | `archivist` | C | The signal dies partway up. A bill doesn't come from nowhere; trace what had to be seen before anyone acted. |
| `e6.F2` | fail.byKey `wrong_year_law` | `archivist` | C | That station is from 1965. This mast only carries Birmingham's spring, and what it set moving that June. |
| `e6.S` | success | `archivist` | C | Kennedy's bill had a chain of causes behind it: marches, violence, cameras, opinion. No single push did it. |
| `e6.P` | payoffLine | `archivist` | C | The lift's live. Ride it up to the rooftops. |
| `e6.Z` | after[0] | `archivist` | C | From up here you can see why it mattered. The whole city could see it too. |

#### e7_march · Program Switchboard (`linker.pairs`)
| ID | Slot | speakerId | Set | Line |
|---|---|---|---|---|
| `e7.A` | approach[0] | `archivist` | C | The March's program is scrambled on the switchboard. Four names, five roles. Patch each name to its part. |
| `e7.I` | instruction | `archivist` | C | Patch each name jack to its role jack, then connect the program. |
| `e7.T` | tutorial | `archivist` | C | Patch a cord and both lamps light white. White only means seated. The program fills in as you go. |
| `e7.N` | insight | `archivist` | C | A march that size is a logistics problem long before it is a speech. |
| `e7.H1` | hints[0] | `archivist` | C | The march had organizers as well as a famous speaker. `[fixture]` |
| `e7.H2` | hints[1] | `archivist` | C | Its full name was the March on Washington for Jobs and Freedom. `[fixture]` |
| `e7.H3` | hints[2] | `archivist` | C | The person who signed the act was a president, not a marcher. `[fixture]` |
| `e7.F` | fail.default | `archivist` | C | That cord won't seat. Labor and civil rights veterans built this march; read the clue on the program's margin. |
| `e7.F2` | fail.byKey `king_organizer` | `archivist` | C | King gave the closing speech. The call for this march went out years earlier, from a labor leader. |
| `e7.S` | success | `archivist` | C | A march has architects, and this one demanded jobs as well as freedom. The famous speech was its close, not its whole. |
| `e7.P` | payoffLine | `archivist` | C | The steps are solid. Climb to the colonnade, Nell. |
| `e7.Z` | after[0] | `archivist` | C | The program printed clean. Organizers, marshals, demands, and one speech at the end. |

#### e8_cra · Filing Cabinets (`sorter.bins`)
| ID | Slot | speakerId | Set | Line |
|---|---|---|---|---|
| `e8.A` | approach[0] | `archivist` | C | Two cabinets, two laws, six provisions coming down the tube. File each slip under the act that created it. |
| `e8.I` | instruction | `archivist` | C | File each provision slip in its act's cabinet, then seal the cabinets. |
| `e8.T` | tutorial | `archivist` | C | Each slip flies to the drawer you pick. The meters only count slips; they don't check your filing. |
| `e8.N` | insight | `archivist` | C | Two laws, one year apart. Each one answered a different injustice. |
| `e8.H1` | hints[0] | `archivist` | C | Ask what each provision is about: public life and jobs, or the ballot. `[fixture]` |
| `e8.H2` | hints[1] | `archivist` | C | Anything about registering or voting belongs to 1965. `[fixture]` |
| `e8.H3` | hints[2] | `archivist` | C | The 1964 act's dates and titles are about accommodations and employment. `[fixture]` |
| `e8.F` | fail.default | `archivist` | C | A slip bounced back. The 1964 act targeted segregation and job discrimination; the vote waited for 1965. |
| `e8.F2` | fail.byKey `vote_in_1964` | `archivist` | C | Something about the ballot is sitting with the 1964 act. Read that cabinet's feature plate again. |
| `e8.S` | success | `archivist` | C | The 1964 act opened lunch counters, hotels and workplaces. The ballot needed its own law a year later. |
| `e8.P` | payoffLine | `archivist` | C | The cabinets rolled apart. There's a stair down to the river road. |

#### e9_selma · Timeline Bridge (`sequencer.linear`)
| ID | Slot | speakerId | Set | Line |
|---|---|---|---|---|
| `e9.B` | approach[0] | `archivist` | C | The chapter's order lies. The dates don't. `[fixture beat, before e9]` |
| `e9.A` | approach[1] | `archivist` | C | The bridge deck is in pieces. Set the planks by their dates. One plank belongs to a different story. |
| `e9.I` | instruction | `archivist` | C | Set the bridge planks in date order, then lock the span. |
| `e9.T` | tutorial | `archivist` | C | The planks come in the order the chapter prints them. Each deck section shows the date printed on its plank. |
| `e9.N` | insight | `archivist` | C | A textbook tells events in the order that makes a good chapter. Time keeps its own order. |
| `e9.H1` | hints[0] | `archivist` | C | Dates decide the order, not the page they appear on. `[fixture]` |
| `e9.H2` | hints[1] | `archivist` | C | The 1964 act came before Selma. `[fixture]` |
| `e9.H3` | hints[2] | `archivist` | C | The voting law was signed in the summer after the march. `[fixture]` |
| `e9.F` | fail.default | `archivist` | C | The span tips at that bay. Run the year cursor across the bridge and watch which lamps light as the lens passes. |
| `e9.F2` | fail.byKey `other_story` | `archivist` | C | That plank is dated 1956. It's Montgomery's story, not this bridge's. |
| `e9.S` | success | `archivist` | C | The page order is the author's. The dates are the record's: the 1964 act, Bloody Sunday, the march, the 1965 act. |
| `e9.P` | payoffLine | `archivist` | C | The span holds. Cross at a walk, Nell. The rain's stopping. |
| `e9.Z` | after[0] | `archivist` | C | The plate on the far bank is lit. Read it before the streetcar takes us home. |

#### e10_sources · Provenance Drawers (`sorter.bins`)
| ID | Slot | speakerId | Set | Line |
|---|---|---|---|---|
| `e10.A` | approach[0] | `archivist` | C | Six documents spilled from the cabinet. File each as primary or secondary. Theo thinks old means primary. |
| `e10.I` | instruction | `archivist` | C | File each document in the Primary or Secondary drawer, then seal the stacks. |
| `e10.T` | tutorial | `archivist` | C | Each document gets a date stamp as it lands: the year it was made, printed on its own face. |
| `e10.N` | insight | `archivist` | C | Every source is somebody's view. What matters is when they looked, and from where. |
| `e10.H1` | hints[0] | `archivist` | C | Ask who made it and when, not how old it is. `[fixture]` |
| `e10.H2` | hints[1] | `archivist` | C | A textbook from 1971 is still someone else's later account. `[fixture]` |
| `e10.H3` | hints[2] | `archivist` | C | Words or images from the people who were there are primary, even if recent. `[fixture]` |
| `e10.F` | fail.default | `archivist` | C | That drawer spat it back. Age doesn't decide it. Check who made this, and whether they were there when it happened. |
| `e10.F2` | fail.byKey `old_means_primary` | `archivist` | C | The textbook went in Primary because it looks old. Old isn't the test; being there is. |
| `e10.S` | success | `archivist` | C | A source is primary because of who made it and when, not because it's old. A 1971 textbook is still secondhand. |
| `e10.P` | payoffLine | `archivist` | C | The stacks are rolling apart. The ladder to the gallery is free. |

#### e11_causation · Big Board (`linker.chain`)
| ID | Slot | speakerId | Set | Line |
|---|---|---|---|---|
| `e11.A` | approach[0] | `archivist` | C | The Big Board. Seven canisters, and two belong to an earlier chain. Connect Birmingham to the Voting Rights Act. |
| `e11.I` | instruction | `archivist` | C | Run a tube from each event to the one it caused, then send the capsule. |
| `e11.T` | tutorial | `archivist` | C | Tubes grow along the board as you draw them. Run the year cursor: the RECORD card holds every date you restored. |
| `e11.N` | insight | `archivist` | C | The record you rebuilt is evidence now. Every pin on it is a date you can check a link against. |
| `e11.H1` | hints[0] | `archivist` | C | Start in Birmingham and end with the vote. `[fixture]` |
| `e11.H2` | hints[1] | `archivist` | C | Each law followed a televised crisis. `[fixture]` |
| `e11.H3` | hints[2] | `archivist` | C | 1963 → 1964 → 1965: two crises, two laws. `[fixture]` |
| `e11.F` | fail.default | `archivist` | C | The capsule jammed. Each tube is a cause and its consequence. Check the RECORD card for what came first. |
| `e11.F2` | fail.byKey `earlier_chain` | `archivist` | C | Brown and Montgomery matter, but they closed an earlier circuit. This board runs from Birmingham to the vote. |
| `e11.S` | success | `archivist` | C | Crisis, pressure, law. Birmingham brought the 1964 act and Selma brought the 1965 act. The same circuit closed twice. |
| `X10` | payoffLine | `archivist` | C | (listed above) |

#### e12_boss · Tumbler Vault (`investigator.elimination`)
| ID | Slot | speakerId | Set | Line |
|---|---|---|---|---|
| `X09` | `e12_arena` · say | `editor` | C | (listed above; the fixture's before-beat) |
| `e12.A` | approach[0] | `archivist` | C | Four tumblers, four explanations. Pin each clue to what it rules out. One will be left standing. |
| `e12.I` | instruction | `archivist` | C | Pin clues to the tumblers they rule out, then name the explanation that stands. |
| `e12.T` | tutorial | `archivist` | C | Your strike marks are yours alone; the vault never reads them. It only turns for the explanation you name. |
| `e12.N` | insight | `archivist` | C | A good explanation fits every dated clue at once. One clue against it is enough to strike it. |
| `e12.H1` | hints[0] | `archivist` | C | Check each explanation against the dated clues. `[fixture]` |
| `e12.H2` | hints[1] | `archivist` | C | Hold the 2% registration figure up against each tumbler. It strikes one cleanly. |
| `e12.H3` | hints[2] | `archivist` | C | Only one explanation survives every clue. `[fixture]` |
| `e12.T1` | boss.taunts.fail[0] | `editor` | C | That tumbler won't turn. One of your own clues rules it out. |
| `e12.T2` | boss.taunts.fail[1] | `editor` | C | Dead lead. A dated source already killed that story. |
| `e12.F` | fail.default | `archivist` | C | One of your own clues rules that one out. Find the clue card that slid beside the row. |
| `e12.S1` | payoffLine (`speakerId: editor`) | `editor` | C | That's the story. Print it. `[fixture beat, after e12]` |
| `e12.S2` | success | `archivist` | C | Pressure made law. Selma's televised violence moved a voting bill in days, where eleven years had not. |

#### NPC states, triggers, quests and the sandbox
| ID | Slot | speakerId | Set | Line |
|---|---|---|---|---|
| `N13` | `npcs[ida].states[ida_desk].lines[0]` | `archivist` | C | Courthouse first, Nell. Wick knows the way, and so do the dates. |
| `N14` | `npcs[otis].states[otis_s1].lines[0]` | `otis` | X | I'll keep this floor as dry as I can. You keep that lantern close. |
| `N18` | `triggers[s2_cornice_view]` | `archivist` | C | From up here the square reads like a front page. The flood runs all the way to the bus stop. |
| `N15` | `npcs[hattie].states[hattie_s1].lines[0]` (P1) | `hattie` | X | Every repair you make out there, I set in type for the wall of front pages. |
| `N19` | `triggers[s1_front_pages]` (P1) | `archivist` | C | Those front pages still carry the flood's labels. Every repair you make, Hattie resets one. |
| `N09` | `triggers[s2_negative_hint]` (P1) | `archivist` | C | A lost negative. Keep it in your satchel. The darkroom by the stacks can develop it. |
| `N21` | `triggers[s3_wire_view]` (P1) | `archivist` | C | The wire runs straight up to the school doors. Whatever happens there, the country reads it by morning. |
| `N22` | `triggers[s4_fire_escape_view]` (P1) | `archivist` | C | Main Street in the rain. Every counter on it had its rules, and every rule had a date it ended. |
| `N20` | `triggers[s5_mast_view]` (P1) | `archivist` | C | Every antenna in this city points somewhere. That spring, the whole country was tuned here. |
| `N05` | `npcs[dolores].states[dolores_s6].lines[0]` (P1) | `dolores` | X | I ran a cord board for thirty years. Left jack is who, right jack is what. The lamp tells you it's seated. |
| `N06` | `npcs[dolores].states[dolores_s6].lines[1]` (P1) | `dolores` | X | A march that size ran on phone calls and paper. Somebody planned every bus and every marshal. |
| `N03` | `npcs[hattie].states[hattie_s8].lines[0]` (P1) | `hattie` | X | Brown's set in type again. Every repair you make, I print it on the wall of front pages. |
| `N04` | `npcs[hattie].states[hattie_s8].lines[1]` (P1) | `hattie` | X | Two laws, two front pages. People mix them up, so I set them in different faces. |
| `N07` | `npcs[theo].states[theo_spill].lines[0]` (P1) | `theo` | X | This 1971 textbook is super old, so it's a primary source. Right? It's older than my mom. |
| `N08` | `npcs[theo].states[theo_after].lines[0]` (P1) | `theo` | X | Okay. It's old, but whoever wrote it wasn't there. The 1963 photo is the real witness. |
| `N23` | `quests[theo_spill].reward.lines[0]` (P1) | `archivist` | C | Theo's filing the rest on his own now. That's how a rule sticks: you teach it once. |
| `N10` | `triggers[s8_darkroom_light]` (P1) | `archivist` | C | That's all five. The darkroom light is on. Let's see what the Editor was keeping. |
| `N11` | `npcs[otis].states[otis_s8].lines[0]` (P1) | `otis` | X | He used to lock himself in there with his contact sheets. Said the pictures argued back. |
| `N17` | `sandboxes[darkroom].lines.open[0]` (P1) | `archivist` | C | Slide each negative into a tray and give it a moment. His pictures are still in there. |
| `O08` | `sandboxes[darkroom].reward.lines[0]` (P1) | `editor` | C | You developed my negatives too. Then you know the pictures were never the whole story. The people were. |
| `N12` | `npcs[hattie].states[hattie_s1].lines[1]` (P2) | `hattie` | X | Bring me that printed program when you're done out there. It deserves a frame. |
| `N16` | `quests[hattie_program].reward.lines[0]` (P2) | `hattie` | X | That program goes in a frame, right beside the speech everyone remembers. |

#### Outro (`cutscenes[finale]`)
| ID | Slot | speakerId | Set | Line |
|---|---|---|---|---|
| `O01` | finale · say 1 [0] | `editor` | C | You found the story I sealed: pressure made law, and the evidence proves it. `[fixture outro]` |
| `O02` | finale · say 1 [1] | `editor` | C | I sealed it because people kept telling it as one speech and one signature. It was years of organizing. |
| `O03` | finale · say 2 [0] | `archivist` | C | Look out the window, Nell. Every projection's lit. The city holds its whole shape now, 1954 to 1965. |
| `O04` | finale · say 2 [1] | `archivist` | C | Rulings, a boycott, sit-ins, rides, marches, two laws, each tied to what caused it. That's a record you can defend. |
| `O05` | finale · say 3 [0] | `otis` | X | Sun's up. Nobody's hauling anything out of here today. |
| `O06` | finale · say 3 [1] | `hattie` | X | Front page is set. First edition in ten minutes. |
| `O07` | finale · say 3 [2] | `archivist` | C | Go home and sleep. Tomorrow somebody will ask you what happened. Tell them why. |

**Totals:** 12 intro + 10 transitions + 139 station rows (12 stations × 11–13 slots, fixture beats included) + 22
NPC/trigger/quest/sandbox + 7 outro. P0 lines: every intro, transition (except X06), station and outro row, plus N13,
N14 and N18.

**Rewritten in revision 2** (amendment 37 and the no-quiz/no-fourth-wall rule): `e3.A` (was "…What did the
President do?"), `e3.H2` (was the fixture's question "What tool does a president have…?"; the Brief tab still shows
it verbatim), `e12.H2` (was "What does the 2% registration figure rule out?"), `e10.F` (ended on a question), `I10`
(was "…Press E when you're close."), `e9.F` (was "Scrub the Record Strip…"), `e1.H2` / `e11.F` ("your Record Strip"
→ "the RECORD card"), `e7.Z` and `e4.P` (no longer promise P1 art at P0), N01 (the breaker moved from the stair to
the Engine's feed line so the intro needs no walk back).

**Failure-line rule (all fail lines):** a failure line names *where* to look (a verb, an evidence source), never
*what* the answer is. `e1.F`, `e2.F` and `e8.F` paraphrase the fixture's own `wrongFeedback`, which the fixture
author vetted as non-leaking; the grade's feedback itself shows as the margin note (§5.0.4). Probe-keyed lines
(`fail.byKey`) address the specific misconception the submitted input shows (§5.0.4 probes).

---

## 5 · Contraptions

### 5.0 Shared systems (every station in this game uses them)

#### 5.0.1 Live link: controls, drafts and diagnosis (20 §2.5, §3.3, §3.4)

The old civil-only protocol (`LiveMsg` over `setLiveValue(unknown)`, and `Grade.focus` added to seven modes) is
**withdrawn**. This game uses the architecture's single path:
- The panel control emits a typed `Draft` (`input`, `complete`, `focus`, `hover`, `probe`, `settled`, `marks`) through
  `ExpeditionClient` refs into `host.bindDraft`; the station's `ContraptionController` eases the prefab toward
  `meta.pose(...)`. The year cursor is the **probe channel** (`Draft.probe`), never graded.
- Verify submits `toSubmitInput(draft)` to the runner; the existing `grade()` runs unchanged; then
  `src/world/diagnose` computes a `Diagnosis` (`failKey`, `wrongKeys`, `prefix`, `disclosed`, `probeKeys`) from
  params + input + solution, and the meta's `failurePlan` acts **only** on it.

| Mode (stations) | Control | Draft `input` (+ channels) | `Diagnosis` on a miss (20 §2.5.4) | What the failure plan moves |
|---|---|---|---|---|
| `truth_finder.mimic` (e1, e4) | `AimControl` | `{statementIndex}` (+ `hover`, `focus`: the lamp previews the hovered slide) | `failKey: honest`, `wrongKeys: [statementIndex]` | the picked slide holds bright |
| `truth_finder.predict_reveal` (e3) | `AimControl` | `{optionIndex}` | `failKey: wrong_option`, `wrongKeys: [optionIndex]` | the ticker prints the reveal and stamps the forecast |
| `sequencer.linear` (e2, e9) | `SlotRailControl` | `{slots}` (partial) | `order` / `decoy` (Verify needs every slot, so never `incomplete`); `wrongKeys: [keys[wrongAt]]` or `[decoyKey]`; `prefix = wrongAt` | slots `0…prefix−1` lock; the slot at `prefix` tips; a decoy dissolves |
| `linker.chain` (e5, e6, e11) | `TubeControl` | `{edges}` (partial) | `decoy` / `wrong_link`; `wrongKeys: [decoyKey]` or `[from]` | a decoy's fuse pops; the `from` housing sparks and its outgoing wire goes slack |
| `linker.pairs` (e7) | `CableControl` | `{links}` (partial) | `wrong_link`; `wrongKeys: [leftKey]`, `disclosed: {given}` | that cord unseats |
| `sorter.bins` (e8, e10) | `RouterControl` | `{assignments}` (partial) | `wrong_bin`; `wrongKeys: [itemKey]`, `disclosed: {bin}` | that item bounces back; **only the disclosed bin's** shutter opens |
| `investigator.elimination` (e12) | `MatrixControl` | `{hypothesisId}` (+ `marks`, UI-only) | `wrong_hypothesis`; `wrongKeys: [hypothesisId, "clue:<i>"]`, `disclosed: {clueIndex}` | the accused tumbler grinds; clue card *i* slides beside its row |

**The honesty rule** is 20 §2.5.6: metas see the **view** (never params or solutions) at runtime; discrete modes
show *what your choice does*, never whether it is right, until Verify; fields marked success-only (`quarantineAnim`,
`payoffLamps`, `vehicle`) are read by `successPlan` only. The no-leak test (20 §8.1) covers every civil station,
including the e9 bay lamps (§5.9).

#### 5.0.2 The Record Strip and the year cursor (the orange scrubber for history)

Every panel in this game has, at its top, **two stacked timeline cards** that share one x-axis in **years**, with
**one orange year cursor** crossing both. This is the history translation of the bible's f/g/h stack and orange
f(a) scrubber (checklist items 18, 19, 21, 22). In 20's terms it is three pieces:

1. **The year probe** (`config.probe`, a `ProbeSpec`, amendment 3): `symbol "YEAR"`, `label "record year"`,
   `format "month_year"` (e10: `"year"`), `step 0.0833333333` (one month; e10: 1 year), `window` = the encounter's
   years. The Scrubber shows the orange `YEAR` tab and a readout box (`MAR 1965`); keys ←/→ one month, Shift ×10,
   PgUp/PgDn one year, Home/End the window ends; `role="slider"`, `aria-valuetext="March 1965"`. Fractional years
   follow 20's convention (month *m* = year + (*m* − 1)/12; 1965.1667 = March 1965).
2. **The cards** (`TimelineCard` models from the meta's `panelStatic`/`panelLive`):
   - **Card 1: `RECORD`** (label tab top-right, colour `f` white). Earned pins from `story.recordStrip` for every
     solved encounter, bands for spans, three labelled lanes on y (`ORIGINS`, `DIRECT ACTION`, `LEGISLATION`, the
     fixture's units), unearned slots drawn empty, hint pins dashed (`config.hintPins`).
   - **Card 2: `FILE`** (colour `g` green). The current encounter's dated items (`items[].meta.printedDate`,
     `madeYear`, `fileDates`, claim `footprint`s) and the player's draft plotted in time. For bins it uses `h`
     blue for the second drawer.
   - **Value chips** on each card's left edge, overhanging into the world: RECORD = the nearest earned pin within
     ±2 months of the cursor (`SEP 1957 · LITTLE ROCK`, or `—`); FILE = the draft item under the cursor (`BAY 2 ·
     MAR 7 1965`).
3. **The Record Lens** (the `record_lens` accessory on e1–e11; e12 uses the vault's mini strip). A brass carriage
   (`archive_of_voices.part.lens_carriage`, 160 × 140) hangs from a riveted rail (`archive_of_voices.part.record_rail`,
   drawn along `accessories[0].rail`) that runs over each station like the lintel in 9.png. Its position is driven by
   the probe:
   ```
   u        = clamp((probe − window.start) / (window.end − window.start), 0, 1)
   target   = pointAtArcLength(rail, u · length(rail))            // rails may bend (e3 wire, e9 arch)
   carriage = controller ease toward target (1 − e^(−dt / 110 ms))  // 20 §2.5.3: ~0.33 s to 95 %
   ```
   The lens throws a projector cone (`archive_of_voices.fx.projector_cone`, ADD, `recordlight` 35 %) at
   `accessories[0].cone.target`. When the RECORD chip names a pin, the cone shows that pin's **document plate**
   (a framed headline card with the date and label, DOM through `WorldLabelLayer`, fading in over 200 ms). The
   carriage carries a **world chip** with an orange border (it is bound to input) showing `MAR 1965`.

**`story.recordStrip`** (world-file value; each pin's date appears in that encounter's params, prompt or
`sourceRef.quote`, per R13):

```json
{ "lanes": [ { "id": "origins", "label": "ORIGINS" }, { "id": "direct_action", "label": "DIRECT ACTION" },
             { "id": "legislation", "label": "LEGISLATION" } ],
  "pins": [
    { "encounterId": "e1_brown",         "pin": { "date": "1954",       "precision": "year",  "label": "Brown v. Board",            "lane": "origins",       "spanTo": null } },
    { "encounterId": "e2_montgomery",    "pin": { "date": "1955-12-01", "precision": "day",   "label": "Parks arrested",            "lane": "origins",       "spanTo": null } },
    { "encounterId": "e2_montgomery",    "pin": { "date": "1955-12",    "precision": "month", "label": "Boycott, 381 days",         "lane": "origins",       "spanTo": "1956-12" } },
    { "encounterId": "e3_little_rock",   "pin": { "date": "1957-09-25", "precision": "day",   "label": "Little Rock Nine escorted", "lane": "origins",       "spanTo": null } },
    { "encounterId": "e4_sit_ins",       "pin": { "date": "1960-02-01", "precision": "day",   "label": "Greensboro sit-in",         "lane": "direct_action", "spanTo": null } },
    { "encounterId": "e4_sit_ins",       "pin": { "date": "1960-04",    "precision": "month", "label": "SNCC founded",              "lane": "direct_action", "spanTo": null } },
    { "encounterId": "e5_freedom_rides", "pin": { "date": "1961",       "precision": "year",  "label": "Freedom Rides",             "lane": "direct_action", "spanTo": null } },
    { "encounterId": "e6_birmingham",    "pin": { "date": "1963",       "precision": "year",  "label": "Birmingham, spring",        "lane": "direct_action", "spanTo": null } },
    { "encounterId": "e6_birmingham",    "pin": { "date": "1963-06",    "precision": "month", "label": "Kennedy's bill",            "lane": "legislation",   "spanTo": null } },
    { "encounterId": "e7_march",         "pin": { "date": "1963-08-28", "precision": "day",   "label": "March on Washington",       "lane": "legislation",   "spanTo": null } },
    { "encounterId": "e8_cra",           "pin": { "date": "1964-07-02", "precision": "day",   "label": "Civil Rights Act",          "lane": "legislation",   "spanTo": null } },
    { "encounterId": "e9_selma",         "pin": { "date": "1965-03-07", "precision": "day",   "label": "Bloody Sunday",             "lane": "legislation",   "spanTo": null } },
    { "encounterId": "e9_selma",         "pin": { "date": "1965-03-25", "precision": "day",   "label": "March reaches the capitol", "lane": "legislation",   "spanTo": null } },
    { "encounterId": "e9_selma",         "pin": { "date": "1965-08-06", "precision": "day",   "label": "Voting Rights Act",         "lane": "legislation",   "spanTo": null } } ] }
```

Sources of each date: e1 statement 0 and the `sourceRef`; e2 step s0 ("December 1, 1955"), the band from step s2
("381 days"; its end, December 1956, is also e9's decoy text); e3 `reveal` ("September 25, 1957"); e4 statement 0 and
statement 2's explanation ("April 1960"); e5 prompt ("1961"); e6 prompt ("spring 1963") and node n4 / `sourceRef`
("June 1963"); e7 `sourceRef` ("August 28, 1963"); e8 item i4 ("July 2, 1964"); e9 steps s1–s3. After e10 every pin
gains a provenance badge, and after e11 causal arrows join Birmingham → bill → 1964 act and Selma → 1965 act: both are
P2 and need card support that 20 does not have yet (Appendix A.2).

#### 5.0.3 Projection states (every landmark)

`dormant` (wireframe: 20 §5.7 runtime ColorMatrix −60 % saturation, 40 % alpha, scanlines; drifting scraps) →
`awake` (the approach radius is entered) → `active` (the console is open: the contraption parts saturate to 70 % and
glow only on driven parts; bible "glow = live") → **success plan** (includes the 0.8 s cyan `printing_sweep`) →
`solved` (full colour, the payoff terrain merged, the blocker gone). These are `ContraptionInstance.setState` states
(20 §2.5.5).

**World state derives from runner progress** (fixes runtime-map D3): the host's `progress` prop
(`{solvedIds, currentId}`) decides blockers, merged terrain, links with `requires.solved` and `settleSolved()`, so
`skipTo`/`autoSolve` produce the right world.

#### 5.0.4 Failure grammar (non-punitive, informative, no leak)

On a failed Verify:
1. The world plays the meta's `failurePlan(diagnosis)`: a **mechanical** refusal at the item in `wrongKeys[0]`
   (a lamp holds steady, a slab tips, a fuse pops, a slip bounces, a cord unseats, a tumbler grinds). 600–1600 ms,
   no red flashes, no screen shake (every civil skin is `sensitiveSafe`), no damage.
2. The dialogue bar shows `failLines(station, diagnosis, attempt)`: for e12 the Editor's taunt first, then Ida's
   line. Ida's line is `fail.byKey[key]` where `key = probeKeys[0] ?? nearMiss ?? failKey`, else `fail.default`.
3. The grade's feedback appears as a **margin note** (the dialogue bar's secondary pin, typewriter face on a
   paper-texture strip), after the display-only noun substitution:
   `feedbackNouns: [{ "from": "chest", "to": "slide", "stations": ["e1_brown", "e4_sit_ins"] }]`
   ("That chest was honest: …" reads "That slide was honest: …"; grading and telemetry keep the original).

The draft stays in place (the control is not remounted; 20 §2.9), so the player edits rather than restarts. The
mastery penalty is the runner's; there are no lives or timers.

**Misconception probes** (`stations[].probes`, evaluated only after a failed Verify, 20 §2.5.4):

| Station | Probe | `key` → line |
|---|---|---|
| e1 | `{predicate: "aimedIndex", index: 2}` (the Plessy slide, honest) | `plessy_true` → `e1.F2` |
| e2 | `{predicate: "decoyPresent", itemKey: "d0"}` ("Parks decides on the spot…") | `acted_alone` → `e2.F2` |
| e3 | `{predicate: "aimedIndex", index: 1}` ("Lets Arkansas decide…") | `states_rights` → `e3.F2` |
| e4 | `{predicate: "aimedIndex", index: 2}` (the SNCC slide, honest) | `spread_true` → `e4.F2` |
| e5 | `{predicate: "decoyPresent", itemKey: "d0"}` ("Congress passes the Civil Rights Act") | `law_first` → `e5.F2` |
| e6 | `{predicate: "decoyPresent", itemKey: "d0"}` ("The Voting Rights Act bans literacy tests") | `wrong_year_law` → `e6.F2` |
| e7 | `{predicate: "linkedTo", fromKey: "l2", toKey: "r0"}` (King → "first called for the march") | `king_organizer` → `e7.F2` |
| e8 | `{predicate: "assignedTo", itemKey: "i2", binId: "cra_1964"}` (literacy tests under 1964) | `vote_in_1964` → `e8.F2` |
| e9 | `{predicate: "decoyPresent", itemKey: "d0"}` ("The Montgomery bus boycott ends, December 1956") | `other_story` → `e9.F2` |
| e10 | `{predicate: "assignedTo", itemKey: "i1", binId: "primary"}` (the 1971 textbook as primary) | `old_means_primary` → `e10.F2` |
| e11 | `{predicate: "decoyPresent", itemKey: null}` (Brown or Montgomery in the chain) | `earlier_chain` → `e11.F2` |
| e12 | — (the Editor's taunts cycle by attempt) | — |

#### 5.0.5 Hints are world actions (20 §2.5.1 `aidTier`, `meta.hintTargets`)

The (i) button calls `runner.hint()` (the fixture ladder, telemetry unchanged), shows the rung's guide-voiced line
(`dialogue.hints[r − 1]`), and calls `host.onHint(encounterId, r)` + `host.setAidTier(...)`. With
`aidTier = min(2, max(hintsUsed, failedVerifies > 0 ? 1 : 0))`:

| Rung | Tier effect | Wick (companion) | Config gates that open (per station, §5.x) |
|---|---|---|---|
| 1 (or the first failed Verify) | `aidTier` 1 | flies to `meta.hintTargets(1)` anchors and circles twice | bins `shutters` open (feature plates show); e10 `eventsBand` (tier 1); **e9 world bay-lamp sweep** (`bayLampsTier: 1`) and the FILE-card bay connectors; claim holders' secondary card (`secondaryTier: 1`) |
| 2 | `aidTier` 2 | lands on `meta.hintTargets(2)` | `hintPins` with `rung: 2` appear dashed on RECORD (e1's `1957 · Little Rock`); claim holders' overlay card (`overlayTier: 2`) |
| 3 | `hintsUsed` 3 (tier stays 2) | hovers over `meta.hintTargets(3)` | e7 `decoyDimRung: 3` (the decoy role jack dims to 30 %); e12 `shadeCountsRung: 3` (the matrix shades struck counts) |

The old rung-3 "dashed salmon outline on the item H3 names" is withdrawn: metas never see the solution, and the
fixture's H3 text already names the item where it names one.

#### 5.0.6 Success grammar (1.2–2.5 s, then traversal) and the cue bank

1. Verify → the badge (`panel.successBadge`, bible §3.8) replaces the Verify button for 1.6 s.
2. The meta's `successPlan(input, payoff.anim)` plays the station's own animation (per §5.x), including the
   `printing_sweep` (0.8 s cyan scanline bar) that turns the landmark solid.
3. The `success` line replaces the instruction (primary pin); the `payoffLine` toasts while the payoff animates.
4. The payoff runs: terrain merges and the blocker lifts, or the ride becomes boardable (E/W), or the carry plays.
   Nell plays `show` (she holds up the restored record) and then `idle`.
5. The objective ring gains a segment (`RECORD RESTORED n/12`). P1 adds the landmark's record-light beam to the
   antenna ring and the Engine lens (`progressEffects`, §6.2).
6. The panel slides out (280 ms) and the camera eases back to explore framing. **The path forward is now the thing
   just built.**

**Cue ids** (20 §2.12 synth recipes). The old `sfx.*` ids are renamed because `Trigger.cue`, `PropPlacement.touch.cue`
and the cutscene `sfx` step take an `Id` (no dots). Every id below must be in `CUE_MAP` (R16):

| Cue id | Recipe (pitch, gain) | Used by |
|---|---|---|
| `lamp_swing` | `whoosh` (0.6, 0.4) | e1/e4 lamp aim changes (the skin's `cues.live`) |
| `slide_retract` | `stamp` | e1/e4 RETRACTED stamp (`cues.succeed`) |
| `slab_set` | `thunk` | e2 slabs and e9 deck sections locking |
| `teletype` | `teletype` | e3 ticker typing and printing |
| `relay_click` | `tick` | e5/e6 wire seated, e7 jack touch |
| `current_hum` | `hum` (loop) | e5/e6/e11 current and capsule runs |
| `fuse_pop` | `spark` | chain decoy failures |
| `cord_seat` | `select` | e7 cord seated |
| `drawer_thunk` | `clunk` | e8/e10 drawers |
| `tube_whoosh` | `whoosh` | e8 pneumatic drop, e11 capsule |
| `bolt_slide` | `clunk` (repeat 4) | e12 bolts; the first bolt in `ride_vault_lift` |
| `press_roll` | `stamp` (repeat 3) | the finale press |
| `printing_sweep` | `whoosh` (1.6, 0.3) | every success sweep |
| `beam_rise` | `whoosh` | P1 record-light beams |
| `breaker_throw` | `clunk` | intro breaker |
| `engine_spin` | `rumble` | intro Engine wake |
| `lift_hum` | `hum` | e6 mast lift, e11 vault lift |
| `tumbler_grind` | `grind` | e12 failure |
| `lamp_chime` | `chime` | e3 walk lamps, the streetcar bell |
| `page_turn` | `page` | plaques, the program touch, clippings |

#### 5.0.7 Panel layouts used (widths are 20 §3.1's)

```
SCRUB (e1, e3, e4): panel 42vw, world full-bleed behind it     BOARD (e2, e5–e11): panel 55vw
┌───────────────────────────┬──────────────────────┐            ┌───────────────────────┬───────────────────────────────┐
│ ◯ objective ring          │ ← back               │            │ ◯                      │ ← back                        │
│                           │ [RECORD  ────┃────]  │            │                        │ [RECORD ──────┃──────]         │
│   world: contraption,     │ [FILE    ────┃────]  │            │  world: contraption    │ [FILE   ──────┃──────]         │
│   Record Lens carriage    │ YEAR│MAR 1965│ruler◆ │            │  (camera frames its    │ YEAR│JUL 1964│─────ruler◆──── │
│   (chips hang off panel ◀)│ [SLIDE A] ◯ socket   │            │   frameBounds)         │ ┌palette┐ ┌── mode board ──┐ │
│                           │ [SLIDE B] ◯          │            │                        │ │tokens │ │ slots / nodes / │ │
│                           │ [SLIDE C] ◯          │            │                        │ │  ...  │ │ jacks / drawers │ │
│                           │ •──[ RETRACT SLIDE ]──•│            │                        │ └───────┘ └────────────────┘ │
├─────────────────┬─────────┴──────────────────────┤            │                        │ •────[ CLOSE THE CIRCUIT ]───• │
│                 │ (Reel) Instruction / insight … │            ├───────────────┬────────┴───────────────────────────────┤
│                 │  (i)                     • • ◉ │            │               │ (Reel) line …                (i) • • ◉ │
└─────────────────┴────────────────────────────────┘            └───────────────┴────────────────────────────────────────┘
VAULT (e12): centred modal 80 % × 85 % over the dimmed vault room (brief column left: the Editor's question, emblem, i).
```
- The canvas is always full-bleed (20 decision 5); the camera frames each station's `frameBounds` inside the visible
  safe rect (scrub: left 58 %; board: left 45 %; vault: centred behind the modal).
- Timeline cards are 12 % of screen height each in board layout and 15 % in scrub layout; the mode board fills the
  rest. All card, chip, knob, button, badge, trace-terminal and hex-texture specs are the bible's §3, unchanged.

---

**How to read the station sections.** Each station gives (a) the **station block**: every `Station` field except
`dialogue` (whose slots are the §4.4 rows with that station's prefix) and `config`; (b) the **config**: the exact
JSON the world file carries, valid against 20 §4.2 and its `validateConfig`; then the design (world object, live
binding, verify, success, failure, visible misconception, hints). The year-probe object is written out in full once
(e1) and abbreviated `YEAR(min, max)` afterwards, meaning:

```
{ "symbol": "YEAR", "label": "record year", "min": MIN, "max": MAX, "step": 0.0833333333, "unit": "",
  "format": "month_year", "initial": null, "stops": [], "window": { "start": MIN, "end": MAX }, "playback": false }
```

### 5.1 e1_brown · **Witness Projector** · `claim_holders` / `witness_projector` · `s2_courthouse` · scrub

**Station block:**
```json
{ "encounterId": "e1_brown", "zoneId": "s2_courthouse", "consoleX": 900, "consoleSurface": "ground",
  "consoleAsset": "archive_of_voices.prop.console_reader", "anchor": { "x": 1700, "y": 900 }, "approachRadius": 500,
  "contraption": "claim_holders", "skin": "witness_projector",
  "objectNoun": "Witness Projector", "partNouns": ["Proof Lamp", "slide"], "pins": [],
  "accessories": [ { "kind": "record_lens", "rail": [[1450, 330], [2350, 330]],
                     "carriage": "archive_of_voices.part.lens_carriage",
                     "cone": { "target": [1700, 560], "asset": "archive_of_voices.fx.projector_cone" } } ],
  "frameZoom": null,
  "probes": [ { "predicate": "aimedIndex", "index": 2, "key": "plessy_true" } ],
  "panel": { "layout": "scrub", "inputSymbol": null, "verifyLabel": "RETRACT SLIDE", "successBadge": "SLIDE RETRACTED", "cards": [] },
  "payoff": { "kind": "terrain", "vertical": "up", "anim": "stairs_rise", "noun": "courthouse steps",
              "blocker": { "x": 1480, "surface": "ground", "asset": null },
              "terrain": [ { "surface": "ground", "points": [[1500, 900], [2600, 640], [3400, 640], [3700, 900]] } ],
              "rideCutsceneId": null, "autoBoardMs": null, "feedsHub": true },
  "boss": null }
```

**Config** (`ClaimHoldersConfig`; footprints are all-or-none and every year appears in the e1 texts: 1954 in
statement 0 and the source quote, 1955 is "within the year" of 1954 (±1 rule), 1896 in statement 2's explanation;
the hint pin's 1957 is in statement 1's explanation):
```json
{ "holders": [
    { "statementIndex": 0, "trace": null, "ghost": null, "footprint": { "kind": "pin",   "from": "1954", "to": null,   "label": "ruled 1954" } },
    { "statementIndex": 1, "trace": null, "ghost": null, "footprint": { "kind": "band",  "from": "1954", "to": "1955", "label": "claimed: desegregated" } },
    { "statementIndex": 2, "trace": null, "ghost": null, "footprint": { "kind": "arrow", "from": "1896", "to": "1954", "label": "overturned" } } ],
  "reference": null, "referenceSim": null,
  "probe": { "symbol": "YEAR", "label": "record year", "min": 1950, "max": 1960, "step": 0.0833333333, "unit": "",
             "format": "month_year", "initial": null, "stops": [], "window": { "start": 1950, "end": 1960 }, "playback": false },
  "probeWorld": "record_lens", "scenarioMin": null,
  "hintPins": [ { "rung": 2, "date": "1957", "label": "Little Rock" } ],
  "fileDates": [], "aimer": "arc_lamp", "quarantineAnim": "retract_stamp", "secondaryTier": 1, "overlayTier": 2 }
```

- **In-world object** (S2, x 900–2800):
  - the **Proof Lamp** (`part.witness_projector_arc_lamp`): an arc lamp on a brass swivel stand (0.9 H), its head
    pivoting at (20, 55);
  - three **Witness Lenses** (`part.witness_projector_witness_lens`): lantern-slide projectors on tripods at x 1500,
    1700 and 1900;
  - three pale **projection panels** (`part.witness_projector_projection_panel`) between the courthouse's centre
    columns (220 × 300 each, anchors `panel_0…2`).

  Each lens throws its slide onto its panel. The claim text appears as a typeset newspaper slug (DOM through
  `WorldLabelLayer`): 30 px serif, `ink` on `paper`, 3 lines max. The Record Lens carriage rides the cornice rail.
- **Control:** `AimControl` over a `claims` card: three **SLIDE A/B/C** items (display order = the view's `chests`
  order) with an aim socket each (hollow; aimed = orange ring); click, Enter or keys 1–3 to aim. **Hovering or
  focusing a slide sends a draft**, so the lamp previews it before you commit.
- **Draft:** `{statementIndex}` (`null` until aimed).
- **Live binding** (the meta's `pose`, eased by the controller):
  ```
  k        = display position of (draft.hover ?? draft.input.statementIndex), or null
  θ_target = k == null ? θ_idle(t) : atan2(panel[k].cy − lamp.y, panel[k].cx − lamp.x)
  θ_idle(t)= θ_center + 6° · sin(2π · 0.2 · t)                // slow searching sweep when nothing is aimed
  beam: from the lamp head tip to the nearest panel hit; its length eases like the angle
  panel[i].brightness = i == k ? 1.0 : 0.65 ; panel[i].scale = i == k ? 1.06 : 1.0
  on aim change: the slide's slug re-types at 45 chars/s ("the type lifts", bible §7.3); cue lamp_swing
  ```
- **FILE card (claim footprints):** statement 0 is a pin at `1954`; statement 1 is a band `1954–1955` labelled
  "claimed: desegregated"; statement 2 is an arrow from a broken-axis marker `1896 ≈` to `1954` labelled
  "overturned" (the meta draws the axis break because 1896 lies outside the window). All three claims carry a
  footprint, so the card is not a tell. The aimed claim's footprint is drawn green; the others at 40 %.
- **Year probe:** window `1950–1960`. RECORD is empty at e1, which is the point: this is the first repair. **Rung 2
  adds the dashed hint pin `1957 · Little Rock`.** Once it is there, the 1954–55 band visibly contradicts it on the
  same axis: the IVT-vault feeling of 8.png, made historical.
- **Verify:** `RETRACT SLIDE`, enabled when a slide is aimed. Submits `{statementIndex}` to `mimic.grade`.
- **Success** (2.0 s, success-only `quarantineAnim: retract_stamp`): the lamp flares; the false slide's slug is struck
  through by a rubber stamp **"RETRACTED"** (salmon ink `#C4643C`, rotated −8°); the slide ejects from its lens and
  flutters down. The two true slides merge into one steady projection of the courthouse. The steps run a printing
  sweep from bottom to top and turn solid. Badge **SLIDE RETRACTED**. Payoff: Nell climbs the courthouse steps to
  the upper terrace, the only route past the flooded gutter. The courthouse plaque lights (§6.5).
- **Failure** (`failKey: honest`, `wrongKeys: [picked]`): the aimed slide holds **steady and brighter** ("honest"),
  and its lens gives one calm pulse. Ida says `e1.F` (or `e1.F2` for the Plessy slide); the margin note shows the
  grade feedback with `chest → slide`. The lamp stays aimed so the player can re-aim.
- **Visible misconception** ("Brown ended school segregation immediately"): with the rung-2 pin on RECORD, the
  statement-1 band (1954–55) ends two years before federal troops were needed (1957). The contradiction is *drawn*.
- **Hints in the world:** rung 1: Wick circles the three panels (`panel_0…2`) in display order; rung 2: Wick lands
  on the lamp (`lamp_pivot`) and the `1957 · Little Rock` pin appears on RECORD; rung 3: Wick hovers at the console
  while `e1.H3` names the false label.

### 5.2 e2_montgomery · **Walking Road** · `step_bridge` / `walking_road` · `s2_courthouse` · board

**Station block:**
```json
{ "encounterId": "e2_montgomery", "zoneId": "s2_courthouse", "consoleX": 3800, "consoleSurface": "ground",
  "consoleAsset": "archive_of_voices.prop.console_reader", "anchor": { "x": 4700, "y": 900 }, "approachRadius": 500,
  "contraption": "step_bridge", "skin": "walking_road",
  "objectNoun": "Walking Road", "partNouns": ["planks", "slab"],
  "pins": [ { "anchor": "day_counter", "text": "DAY", "glyph": null } ],
  "accessories": [ { "kind": "record_lens", "rail": [[3700, 520], [5200, 520]],
                     "carriage": "archive_of_voices.part.lens_carriage",
                     "cone": { "target": [4700, 880], "asset": "archive_of_voices.fx.projector_cone" } } ],
  "frameZoom": null,
  "probes": [ { "predicate": "decoyPresent", "itemKey": "d0", "key": "acted_alone" } ],
  "panel": { "layout": "board", "inputSymbol": null, "verifyLabel": "LIGHT THE ROUTE", "successBadge": "ROUTE RESTORED", "cards": [] },
  "payoff": { "kind": "terrain", "vertical": "none", "anim": "bridge_forms", "noun": "Walking Road",
              "blocker": { "x": 4190, "surface": "ground", "asset": null },
              "terrain": [ { "surface": "ground", "points": [[4200, 900], [5200, 900]] } ],
              "rideCutsceneId": null, "autoBoardMs": null, "feedsHub": true },
  "boss": null }
```

**Config** (`StepBridgeConfig`; every key once; only s0 prints a date, "December 1, 1955"):
```json
{ "bays": "flat_road",
  "items": [
    { "key": "s0", "meta": { "printedDate": "1955-12-01", "madeYear": null, "glyph": null, "label": null } },
    { "key": "s1", "meta": { "printedDate": null, "madeYear": null, "glyph": null, "label": null } },
    { "key": "s2", "meta": { "printedDate": null, "madeYear": null, "glyph": null, "label": null } },
    { "key": "s3", "meta": { "printedDate": null, "madeYear": null, "glyph": null, "label": null } },
    { "key": "d0", "meta": { "printedDate": null, "madeYear": null, "glyph": null, "label": null } } ],
  "stepEffects": [], "stages": [], "anchors": 0, "relief": null,
  "probe": "YEAR(1955.8333, 1957.0833)", "probeWorld": "day_counter",
  "dayCounter": { "epoch": "1955-12", "max": 381 }, "bayLampsTier": 1, "pageOrderHeading": null }
```

- **In-world object** (S2, x 3600–5300):
  - the empty 1950s **city bus** (`part.walking_road_city_bus`), parked, lights off;
  - the **bus stop shelter** (`part.walking_road_bus_stop`) with a flip-number **DAY counter**
    (`part.walking_road_day_counter`, 3 digits, digits DOM);
  - a flooded street gap (x 4200–5200, `part.walking_road_flood_band`) with **4 slab bays** (260 × 60 each, anchors
    `bay_0…3`) marked by faint wireframe outlines at y 900, spanning the water.
- **Control:** `SlotRailControl`: a plank palette column (5 plank tokens: 4 steps + 1 decoy, in the view's `planks`
  order) and a `slot_rail` card of 4 numbered slots drawn as the bays; drag, or Tab to a plank, Enter to pick, 1–4
  to drop into a slot, Backspace to return it.
- **Draft:** `{slots: (string | null)[]}` (length 4; keys `s*`/`d*` as in the mode).
- **Live binding:**
  ```
  for bay j: slab[j].state = slots[j] ? "placed" : "empty"
  placed slab: materializes from the water (y 960 → 900, alpha 0 → 0.85, 300 ms ease-out),
               engraved with the plank's first 28 chars (DOM); ALL placed slabs look IDENTICAL (no decoy tell)
  empty bay:   wireframe outline pulses at 0.5 Hz
  shelter "ROUTE" lamp count = number of placed slabs (neutral completion)
  ```
- **Year probe and the DAY counter:** window `NOV 1955 – FEB 1957`. RECORD has `1954 · Brown`. The DAY counter in the
  world is bound to the probe (`probeWorld: day_counter`, `dayCounter.epoch 1955-12`):
  ```
  day = clamp(round((probe − 1955.9167) · 365.25), 0, 381)   // December 1955 = day 0
  ```
  A live world readout (the 381 comes from the plank text, so there is no leak). The FILE card shows the placed
  planks as green markers at slot positions (ordinal; no dates, since only the first plank prints one).
- **Verify:** `LIGHT THE ROUTE`, enabled when all slots are filled. Submits `{keys: slots}` to `linear.grade`.
- **Success** (2.2 s): the slabs lock left to right (120 ms each, `slab_set`). Footprint decals stream across them
  while the DAY counter runs 0 → 381. The last slab locks, the empty bus's interior lights come on (**empty**, no
  figures), and the route sign flips to lit. Badge **ROUTE RESTORED**. Payoff: Nell walks the Walking Road across the
  flood to the far corner.
- **Failure:**
  - `failKey: order` (`prefix = n`): slabs 0…n−1 lock and stay; slab n **tips** 12° and sinks back to the water (its
    plank returns to the palette); later slabs stay placed.
  - `failKey: decoy`: that slab dissolves into scraps, its engraved text floating for 1 s. Ida says `e2.F2`. The
    margin note shows the grade feedback.
- **Visible misconception** ("tired seamstress who acted alone"): the decoy plank ("Parks decides on the spot to
  start a protest movement by herself") has **no bay that can bear it**: with 4 bays and 5 planks, one plank must stay
  on the shore, and the road is only true if the one left behind is the one that never happened. Before Verify every
  slab looks the same; on a miss, the dissolve names the decoy.
- **Hints in the world:** rung 1: Wick lands on bay 0, then bay 3 (start and end: "Start with the arrest and end
  with the court"); rung 2: Wick lands on the DAY counter; rung 3: Wick hovers at the route sign while `e2.H3`
  speaks.

### 5.3 e3_little_rock · **Wire Ticker and Prediction Selector** · `oracle_ticker` / `wire_ticker` · `s3_schoolhouse` · scrub

**Station block:**
```json
{ "encounterId": "e3_little_rock", "zoneId": "s3_schoolhouse", "consoleX": 1450, "consoleSurface": "ground",
  "consoleAsset": null, "anchor": { "x": 1300, "y": 900 }, "approachRadius": 500,
  "contraption": "oracle_ticker", "skin": "wire_ticker",
  "objectNoun": "Wire Ticker", "partNouns": ["Prediction Selector", "wire"], "pins": [],
  "accessories": [ { "kind": "record_lens", "rail": [[1250, 470], [1700, 420], [2600, 560]],
                     "carriage": "archive_of_voices.part.lens_carriage",
                     "cone": { "target": [2650, 640], "asset": "archive_of_voices.fx.projector_cone" } } ],
  "frameZoom": null,
  "probes": [ { "predicate": "aimedIndex", "index": 1, "key": "states_rights" } ],
  "panel": { "layout": "scrub", "inputSymbol": null, "verifyLabel": "SEND TO THE WIRE", "successBadge": "WIRE CONFIRMED", "cards": [] },
  "payoff": { "kind": "remove_blocker", "vertical": "up", "anim": "barrier_dissolves", "noun": "school doors",
              "blocker": { "x": 2290, "surface": "ground", "asset": null }, "terrain": [],
              "rideCutsceneId": null, "autoBoardMs": null, "feedsHub": true },
  "boss": null }
```
(`vertical: "up"`: the barrier stands over the front walk, which climbs from y 820 to the terrace at 700.)

**Config** (`OracleTickerConfig`; the file date is in the prompt, "September 1957"; the Guard is "posted" in the
prompt):
```json
{ "options": [], "probe": "YEAR(1954, 1958)", "probeWorld": "record_lens",
  "fileDates": [ { "date": "1957-09", "label": "Guard posted" } ],
  "conduit": "telegraph_wire", "payoffLamps": 9 }
```

- **In-world object** (S3, x 1000–2700):
  - the **newsstand** (`part.wire_ticker_kiosk`) with a **teletype** (`part.wire_ticker_teletype`; a paper roll
    feeding up out of the body, tape text DOM);
  - a brass **Prediction Selector** console (`part.wire_ticker_selector`, 0.7 H): a rotary dial with three engraved
    positions A/B/C and a pointer knob (anchor `knob`);
  - a telegraph wire (code-drawn) running from the kiosk up the hill to the school (`wire_start` → `wire_end`);
  - the school's barred doors (`part.wire_ticker_school_barrier`), and 9 unlit walk lamps
    (`part.wire_ticker_walk_lamp`, anchor `lamps`).
- **Control:** `AimControl` over a scenario document card (typewriter, from `view.scenario`) and three **FORECAST
  A/B/C** option items (`view.options` order), each with a socket. Hover and focus send drafts.
- **Draft:** `{optionIndex}`.
- **Live binding:**
  ```
  knob.rotation_target = [−40°, 0°, +40°][display position of (hover ?? optionIndex)]
  teletype types "FORECAST: <option text>" on the tape preview line at 45 chars/s, retyped on change (cue teletype)
  telegraph wire vibrates: y_offset(x, t) = 2 px · sin(2π(3t − x/120)) while a forecast is set
  ```
- **Year probe:** window `1954–1958`. RECORD has Brown and Montgomery. The FILE card shows `SEP 1957 · Guard posted`.
  The Record Lens rides the telegraph wire.
- **Verify:** `SEND TO THE WIRE`. Submits `{optionIndex}` to `predict_reveal.grade`.
- **Success** (2.5 s):
  - The ticker chatters and prints the fixture's **`reveal`** (sourced) with a date slug `SEP 25 1957`.
  - The tape feeds up the wire, which glows cyan along its length to the school.
  - The door barrier dissolves into scanlines, and the **nine walk lamps light one at a time** (180 ms each, a quiet
    memorial count; success-only `payoffLamps: 9`, cue `lamp_chime`). The doors open.

  Badge **WIRE CONFIRMED**. Payoff: Nell walks up the front walk and through the doors (the frame seam is the school
  corridor).
- **Failure** (`failKey: wrong_option`): by the mode's design, a wrong prediction still **prints the reveal** plus the
  picked option's explanation (the grade feedback). World: the ticker prints the reveal; the forecast line on the tape
  is stamped **"NOT WHAT HAPPENED"**; the selector unlocks. Ida says `e3.F` (or `e3.F2` for "Lets Arkansas decide").
  The player then files the true outcome (a second submit). This is the one place the answer is shown after a miss,
  which **is** the predict-then-reveal pedagogy; the runner already applies `missPenalty` on the first attempt.
- **Visible misconception** ("Southern states complied with Brown once it was decided"): the RECORD pin for Brown
  (1954) sits three years left of the FILE marker (Sept 1957), and the barred doors are in view the whole time.
- **Hints in the world:** rung 1: Wick circles the barrier at the far end of the wire (`wire_end`); rung 2: Wick
  lands on the selector (`knob`) and its three engravings light; rung 3: Wick hovers over the teletype while `e3.H3`
  speaks (no outline: the fixture H3 names no answer).

### 5.4 e4_sit_ins · **Witness Projector, menu-board variant** · `claim_holders` / `witness_projector` · `s4_main_street` · scrub

**Station block:**
```json
{ "encounterId": "e4_sit_ins", "zoneId": "s4_main_street", "consoleX": 900, "consoleSurface": "ground",
  "consoleAsset": "archive_of_voices.prop.console_reader", "anchor": { "x": 1450, "y": 520 }, "approachRadius": 500,
  "contraption": "claim_holders", "skin": "witness_projector",
  "objectNoun": "Witness Projector", "partNouns": ["counter lamp", "slide", "menu board"], "pins": [],
  "accessories": [ { "kind": "record_lens", "rail": [[900, 300], [1900, 300]],
                     "carriage": "archive_of_voices.part.lens_carriage",
                     "cone": { "target": [1450, 520], "asset": "archive_of_voices.fx.projector_cone" } } ],
  "frameZoom": null,
  "probes": [ { "predicate": "aimedIndex", "index": 2, "key": "spread_true" } ],
  "panel": { "layout": "scrub", "inputSymbol": null, "verifyLabel": "RETRACT SLIDE", "successBadge": "SLIDE RETRACTED", "cards": [] },
  "payoff": { "kind": "remove_blocker", "vertical": "none", "anim": "door_opens", "noun": "swing door",
              "blocker": { "x": 1990, "surface": "ground", "asset": "archive_of_voices.prop.swing_door" }, "terrain": [],
              "rideCutsceneId": null, "autoBoardMs": null, "feedsHub": true },
  "boss": null }
```

**Config** (no footprints: statement 1 prints no date, so drawing footprints for only some holders would be a tell;
the file date is statement 0's "February 1, 1960"):
```json
{ "holders": [
    { "statementIndex": 0, "trace": null, "ghost": null, "footprint": null },
    { "statementIndex": 1, "trace": null, "ghost": null, "footprint": null },
    { "statementIndex": 2, "trace": null, "ghost": null, "footprint": null } ],
  "reference": null, "referenceSim": null, "probe": "YEAR(1959, 1961)", "probeWorld": "record_lens",
  "scenarioMin": null, "hintPins": [], "fileDates": [ { "date": "1960-02-01", "label": "Greensboro" } ],
  "aimer": "pendant_lamp", "quarantineAnim": "retract_stamp", "secondaryTier": 1, "overlayTier": 2 }
```

- **In-world object:**
  - the **menu board**'s three panels (`part.witness_projector_menu_board`, in the lunch-counter interior) are the
    projection surfaces;
  - the **Proof Lamp** is the counter's swivel **pendant lamp** (`part.witness_projector_pendant_lamp`; pivot at the
    ceiling mount; it swings in an arc);
  - there are no separate lenses: the menu board is a slide projector wall (a hidden projector booth behind a
    grille);
  - 12 empty stools (`prop.counter_stool`, ids `stool_01…12`); the locked swing door.
- **Control, draft:** as §5.1 (`AimControl`, `{statementIndex}`, hover drafts).
- **Live binding:** as §5.1, with a swing instead of a turn:
  ```
  pendulum: lamp.rotation_target = asin(clamp((panel[k].cx − pivot.x) / cordLength, −0.9, 0.9))
  the lamp swings with a damped overshoot (spring k 10, damping 0.7) instead of plain easing: it feels hung
  ```
- **FILE card:** `FEB 1 1960 · Greensboro`.
- **Year probe:** window `1959–1961`. RECORD has e1–e3.
- **Verify:** `RETRACT SLIDE`. Submits `{statementIndex}` to `mimic.grade`.
- **Success** (2.2 s): the RETRACTED stamp, and the menu board's panel reverts to the true menu art. The swing door
  unlatches. Badge **SLIDE RETRACTED**. Payoff: through the swing door, the kitchen and the alley to the terminal.
  P1 adds the memorial beat: the **four stools** at the centre of the counter (`stool_05…08`) light from beneath, one
  by one (`prop_state lit` progress effects, §6.2); the stools stay empty.
- **Failure** (`honest`): as §5.1 (the honest slide holds steady and brighter); `e4.F` or `e4.F2`.
- **Visible misconception** ("nonviolent means passive"): the **twelve empty stools and the RESERVED placard**
  (neutral text; there is no segregation sign) make the act of sitting the visible object. The mimic's claim
  "avoided confrontation" is projected directly above the stools it contradicts.
- **Hints in the world:** rung 1: Wick circles the three menu panels; rung 2: Wick lands on the pendant lamp and the
  lamp dims the whole room except the stools (the meta's rung-2 lighting for the `pendant_lamp` aimer); rung 3: Wick
  hovers at the console while `e4.H3` names the mimic.

### 5.5 e5_freedom_rides · **Relay Line** · `cause_tubes` / `relay_line` · `s4_main_street` · board

**Station block:**
```json
{ "encounterId": "e5_freedom_rides", "zoneId": "s4_main_street", "consoleX": 2900, "consoleSurface": "ground",
  "consoleAsset": "archive_of_voices.prop.console_reader", "anchor": { "x": 3650, "y": 520 }, "approachRadius": 500,
  "contraption": "cause_tubes", "skin": "relay_line",
  "objectNoun": "Relay Line", "partNouns": ["junction box", "circuit"], "pins": [],
  "accessories": [ { "kind": "record_lens", "rail": [[3000, 440], [4300, 440]],
                     "carriage": "archive_of_voices.part.lens_carriage",
                     "cone": { "target": [3710, 700], "asset": "archive_of_voices.fx.projector_cone" } } ],
  "frameZoom": null,
  "probes": [ { "predicate": "decoyPresent", "itemKey": "d0", "key": "law_first" } ],
  "panel": { "layout": "board", "inputSymbol": null, "verifyLabel": "CLOSE THE CIRCUIT", "successBadge": "CIRCUIT CLOSED", "cards": [] },
  "payoff": { "kind": "remove_blocker", "vertical": "up", "anim": "gate_lifts", "noun": "rolling gate",
              "blocker": { "x": 4440, "surface": "ground", "asset": null }, "terrain": [],
              "rideCutsceneId": null, "autoBoardMs": null, "feedsHub": true },
  "boss": null }
```
(`vertical: "up"`: the gate opens onto the platform stair that climbs to the overpass.)

**Config** (`CauseTubesConfig`; no e5 node prints a date, so every `printedDate` is null):
```json
{ "nodes": [
    { "key": "n0", "meta": { "printedDate": null, "madeYear": null, "glyph": null, "label": null } },
    { "key": "n1", "meta": { "printedDate": null, "madeYear": null, "glyph": null, "label": null } },
    { "key": "n2", "meta": { "printedDate": null, "madeYear": null, "glyph": null, "label": null } },
    { "key": "n3", "meta": { "printedDate": null, "madeYear": null, "glyph": null, "label": null } },
    { "key": "n4", "meta": { "printedDate": null, "madeYear": null, "glyph": null, "label": null } },
    { "key": "d0", "meta": { "printedDate": null, "madeYear": null, "glyph": null, "label": null } } ],
  "connector": "catenary", "layout": "canopy_row", "carrier": "current", "gauge": true, "boardWidth": 1100,
  "probe": "YEAR(1960, 1962)", "probeWorld": "record_lens" }
```

- **In-world object** (the terminal interior, x 2600–4500):
  - **6 brass junction boxes** (`part.relay_line_junction_box`, 150 × 190, anchors `box_0…5`) along the canopy rail
    at y 520, spaced over `boardWidth` 1100 (x 3100–4200), one per view node (5 + 1 decoy) **in display order**, each
    with its node text on a typed card behind glass (DOM), and an output lamp on top;
  - the **split-flap departures board** (`part.relay_line_departures_board`, anchor `board`; characters DOM);
  - the **brass divider rail** between the two waiting-room doors (`part.relay_line_divider_rail`);
  - the **rolling gate** (`part.relay_line_rolling_gate`, anchor `gate`), closed.
- **Control:** `TubeControl` over a `cause_graph` card: 6 node cards positioned to mirror the world boxes; click a
  card's output terminal (bottom dot), then another card's input terminal (top dot) to draw a directed edge; click
  an edge to delete it; keyboard Tab / Enter / arrows / Enter; an edge counter `3 / 4 WIRES` (from `view.edgeCount`).
- **Draft:** `{edges: {fromKey, toKey}[]}` (partial).
- **Live binding:**
  ```
  each draft edge → a catenary wire between the world boxes (white, uncharged):
     p(t) = lerp(A, B, t) + (0, sag · 4t(1 − t)),  sag = 0.12 · |B.x − A.x| + 24
     the wire "settles": sag overshoots 15 % then eases back (prefab spring) when first drawn
     small arrow ticks every 80 px pointing from → to
  a box with an outgoing wire: output lamp amber-ready (NOT correctness)
  terminal wall gauge ("LINE CHARGE", anchor gauge): needle = edges.length / edgeCount (completion only)
  ```
- **Year probe:** window `1960–1962`. RECORD has e1–e4, including the SNCC pin. The FILE card stays empty (no dated
  nodes; the `1961` pin arrives on RECORD at the solve). The Record Lens rides the canopy rail.
- **Withheld photo plate** (plaque `s4_withheld_anniston`, `photo_withheld`, by the departures board): a framed sepia
  blur, a camera glyph, and the caption only. It lights when the Record Lens passes it. **Nothing burning is ever
  drawn.**
- **Verify:** `CLOSE THE CIRCUIT`, enabled when `edges.length === edgeCount`. Submits `{edges}` to `chain.grade`.
- **Success** (2.4 s):
  - A cyan current pulse (600 px/s, `current_hum`) runs the chain in causal order (the success plan may read the
    solution: it enters at the chain's first node and each box lamp turns cyan as the pulse arrives).
  - The **departures board** flips (split-flap cascade) to show each node caption in causal order.
  - The brass **divider rail between the waiting rooms lifts away** into the ceiling.
  - The **rolling gate** rises.

  Badge **CIRCUIT CLOSED**. Payoff: onto the platform and up the stair to the overpass seam.
- **Failure:**
  - `failKey: decoy`: that box's fuse pops (spark + puff, `fuse_pop`), and its card flutters half out ("isn't part of
    this chain"). Ida says `e5.F2` when the decoy is the Civil Rights Act box.
  - `failKey: wrong_link` (`wrongKeys: [from]`): that box **sparks and its lamp flickers amber**, and the wire
    leaving it goes slack.

  In both cases the margin note shows the grade feedback ("What does X actually lead to?"). No current flows on a
  miss, so nothing beyond the grade's own disclosure is shown.
- **Visible misconception** ("the federal government led the movement"): until everything before it is wired, the
  gate (federal enforcement) has no power to lift. The layout argues that the movement pushed first.
- **Hints in the world:** rung 1: Wick circles the departures board (`board`); rung 2: Wick lands on the charge gauge
  (`gauge`) and the withheld photo plate lights; rung 3: Wick hovers at the gate (`gate`) while `e5.H3` speaks.

### 5.6 e6_birmingham · **Broadcast Relay** · `cause_tubes` / `broadcast_relay` · `s5_church_mast` · board

**Station block:**
```json
{ "encounterId": "e6_birmingham", "zoneId": "s5_church_mast", "consoleX": 3350, "consoleSurface": "ground",
  "consoleAsset": "archive_of_voices.prop.console_reader", "anchor": { "x": 3600, "y": 1820 }, "approachRadius": 600,
  "contraption": "cause_tubes", "skin": "broadcast_relay",
  "objectNoun": "Broadcast Relay", "partNouns": ["relay stations", "mast", "circuit"], "pins": [],
  "accessories": [ { "kind": "record_lens", "rail": [[2000, 1580], [2720, 1580]],
                     "carriage": "archive_of_voices.part.lens_carriage",
                     "cone": { "target": [3600, 1500], "asset": "archive_of_voices.fx.projector_cone" } } ],
  "frameZoom": 0.7,
  "probes": [ { "predicate": "decoyPresent", "itemKey": "d0", "key": "wrong_year_law" } ],
  "panel": { "layout": "board", "inputSymbol": null, "verifyLabel": "CLOSE THE CIRCUIT", "successBadge": "CIRCUIT CLOSED", "cards": [] },
  "payoff": { "kind": "ride", "vertical": "up", "anim": "lift_moves", "noun": "mast lift",
              "blocker": null, "terrain": [], "rideCutsceneId": "ride_mast_lift", "autoBoardMs": null, "feedsHub": true },
  "boss": null }
```

**Config** (only node n4 prints a date, "June 1963"):
```json
{ "nodes": [
    { "key": "n0", "meta": { "printedDate": null, "madeYear": null, "glyph": null, "label": null } },
    { "key": "n1", "meta": { "printedDate": null, "madeYear": null, "glyph": null, "label": null } },
    { "key": "n2", "meta": { "printedDate": null, "madeYear": null, "glyph": null, "label": null } },
    { "key": "n3", "meta": { "printedDate": null, "madeYear": null, "glyph": null, "label": null } },
    { "key": "n4", "meta": { "printedDate": "1963-06", "madeYear": null, "glyph": null, "label": null } },
    { "key": "d0", "meta": { "printedDate": null, "madeYear": null, "glyph": null, "label": null } } ],
  "connector": "vertical_wire", "layout": "mast", "carrier": "current", "gauge": true, "boardWidth": 1100,
  "probe": "YEAR(1962, 1964)", "probeWorld": "record_lens" }
```

- **In-world object:**
  - the **broadcast mast** (`part.broadcast_relay_mast`, `K:truss lattice_mast`) with 5 relay stations (dish + insulator
    bank + typed card window; dishes `part.broadcast_relay_relay_dish`) at y 1680, 1520, 1360, 1200, 1040, and a 6th
    stray station on its own pole (anchors `station_0…5`);
  - the church rose window; the dark L2 skyline windows;
  - the dark **service lift cage** (`part.broadcast_relay_lift_cage`, anchor `lift`) at the mast foot.

  Stations are assigned to heights **by display index** (the view's shuffled order), so height reveals nothing.
- **Framing** (amendment 32): `frameZoom: 0.7`, and in board layout the camera follows the **focused station**
  vertically (`draft.focus`), keeping that station and the lift cage in the safe rect; the whole 1700-tall mast is
  never forced into view at once.
- **Control and draft:** as §5.5 (`TubeControl`, `{edges}`).
- **Live binding:** as §5.5, with the wires strung **vertically** between stations (vertical catenary: the sag is
  lateral, `sag_x = 0.08 · |dy| + 16`). Each drawn edge makes the destination dish **turn to face** the source:
  ```
  dish.rotation_target = atan2(src.y − dst.y, src.x − dst.x)   (eased)
  ```
  The dishes "listen" to what you wired.
- **Year probe:** window `1962–1964`. RECORD has e1–e5. The FILE card shows `JUN 1963` (node n4's printed date). The
  Record Lens rides a rail along the park's bandstand roofline and throws its cone at the mast.
- **Verify:** `CLOSE THE CIRCUIT`. Submits `{edges}` to `chain.grade`.
- **Success** (2.5 s):
  - The current climbs the mast station by station. Each dish flashes.
  - When the "Television and newspapers carry the images" station lights, the camera tilts to the skyline (P1: the
    L2 window clusters light in a wave, left to right over 1.2 s: the nation watching).
  - The top station fires a record-light beam to the antenna ring. The **lift cage** powers.

  Badge **CIRCUIT CLOSED**. Payoff: E/W at the lift runs `ride_mast_lift`; Nell rides 780 up to the rooftops (a
  vertical camera tween follows).
- **Failure:** as §5.5 (spark at the `from` station; its dish droops 20°; the decoy's fuse pops; `e6.F2` for the 1965
  decoy). There is no skyline change on a miss.
- **Visible misconception** ("Every event has one cause"): the lift (the outcome) cannot move until every station
  below it is connected. A single wire from the marches straight to the bill leaves three dishes facing nowhere.
- **Hints in the world:** rung 1: Wick circles the stations bottom to top (`station_0…5`); rung 2: Wick lands on the
  lift cage (`lift`) and the skyline windows flicker once, faintly; rung 3: Wick hovers at the mast top (`top`) while
  `e6.H3` speaks.

### 5.7 e7_march · **Program Switchboard** · `switchboard` / `switchboard` · `s6_memorial` · board

**Station block:**
```json
{ "encounterId": "e7_march", "zoneId": "s6_memorial", "consoleX": 900, "consoleSurface": "ground",
  "consoleAsset": null, "anchor": { "x": 900, "y": 900 }, "approachRadius": 500,
  "contraption": "switchboard", "skin": "switchboard",
  "objectNoun": "Program Switchboard", "partNouns": ["name jack", "role jack", "program"], "pins": [],
  "accessories": [ { "kind": "record_lens", "rail": [[850, 380], [2650, 380]],
                     "carriage": "archive_of_voices.part.lens_carriage",
                     "cone": { "target": [900, 760], "asset": "archive_of_voices.fx.projector_cone" } } ],
  "frameZoom": null,
  "probes": [ { "predicate": "linkedTo", "fromKey": "l2", "toKey": "r0", "key": "king_organizer" } ],
  "panel": { "layout": "board", "inputSymbol": null, "verifyLabel": "CONNECT THE PROGRAM", "successBadge": "PROGRAM CONNECTED", "cards": [] },
  "payoff": { "kind": "terrain", "vertical": "up", "anim": "stairs_rise", "noun": "memorial steps",
              "blocker": { "x": 1090, "surface": "ground", "asset": null },
              "terrain": [ { "surface": "ground", "points": [[1100, 900], [2400, 640]] } ],
              "rideCutsceneId": null, "autoBoardMs": null, "feedsHub": true },
  "boss": null }
```

**Config** (`SwitchboardConfig`; the title's words and date are in the e7 source quote; `decoyDimRung: 3` because
the fixture's `hints[2]`, "The person who signed the act was a president…", names the decoy "Signed the Civil Rights
Act into law"):
```json
{ "document": { "title": "MARCH ON WASHINGTON FOR JOBS AND FREEDOM · AUGUST 28, 1963" },
  "stepLamps": true, "cord": "verlet", "decoyDimRung": 3,
  "probe": "YEAR(1962.5, 1964)", "probeWorld": "record_lens" }
```

- **In-world object:**
  - a 1940s **cord switchboard** on a stand at the pool's edge (`part.switchboard_switchboard_cabinet`): a wooden
    cabinet with a brass jack field, **4 name jacks** on the left (`view.lefts`, in order: names typed on cards,
    **text only**; anchors `left_0…3`), and **5 role jacks** on the right (`view.rights`, shuffled, including the
    decoy "Signed the Civil Rights Act into law"; anchors `right_0…4`);
  - a lamp above each jack (`part.switchboard_jack`);
  - the memorial steps (wireframe; the steps slot, Appendix A.2); 4 unlit **step lamps** (`part.switchboard_step_lamp`)
    on the steps' landing, one per name.
- **Control:** `CableControl` over a `link_board` card: two jack columns mirroring the board; click a name jack, then
  a role jack, to patch a cord (Tab / Enter / arrows / Enter); click a cord to unplug it; plus a `document` card: the
  printed program titled "MARCH ON WASHINGTON FOR JOBS AND FREEDOM · AUGUST 28, 1963", whose lines fill as cords are
  patched.
- **Draft:** `{links: {leftKey, rightKey}[]}` (partial).
- **Live binding:**
  ```
  each link → a cream patch cord with brass plugs between the two world jacks:
     rope physics (prefab, cosmetic): 12-point verlet chain, gravity 900, pinned at both jacks; settles in ~0.5 s
  both jack lamps light WHITE (seated, not correct); step lamp[leftIndex] lights white; cue cord_seat
  program sheet line[leftIndex] types "<name> — <role>" (DOM)
  ```
- **Year probe:** window `1962.5–1964`. RECORD has e1–e6. The FILE card shows `AUG 28 1963`. The Record Lens rides the
  colonnade's attic band.
- **Verify:** `CONNECT THE PROGRAM`, enabled when every left is linked. Submits `{links}` to `pairs.grade`.
- **Success** (2.2 s): all jack lamps turn cyan in sequence; the program prints (a paper outfeed from the
  switchboard's slot); the steps sweep solid; the 4 step lamps glow. Badge **PROGRAM CONNECTED**. Payoff: climb the
  memorial steps to the podium and the colonnade walkway to the Filing Hall. The printed program stays on the
  keyshelf (prop `printed_program`, the P2 quest touch).
- **Failure** (`failKey: wrong_link`, `wrongKeys: [leftKey]`): that cord **unseats** (the plug pops out and the cord
  drops), and its jack lamp flickers amber. The grade's clue (the pair's `why`) prints as a handwritten margin note on
  the program sheet. Ida says `e7.F`, or `e7.F2` when King is patched to "first called for the march".
- **Visible misconception** ("the march was only about King's speech"): the program sheet is a *list of roles*, and
  three of the four lines are not the speech. The step lamps light one per role, so the steps cannot become whole on
  the speech alone.
- **Hints in the world:** rung 1: Wick circles the program sheet (`sheet`); rung 2: Wick lands on the first name jack
  (`left_0`) and the sheet's title line glows; rung 3: the decoy role jack's lamp dims to 30 % (`decoyDimRung: 3`),
  the fixture H3's meaning shown in world terms without naming a pairing.

### 5.8 e8_cra · **Filing Cabinets** · `router_lanes` / `filing_cabinets` · `s6_memorial` · board

**Station block** (the hall floor is the walkway level, y 640, so the anchor is (4200, 640) rather than 20 §4.1's
(4200, 900)):
```json
{ "encounterId": "e8_cra", "zoneId": "s6_memorial", "consoleX": 3250, "consoleSurface": "ground",
  "consoleAsset": "archive_of_voices.prop.console_reader", "anchor": { "x": 4200, "y": 640 }, "approachRadius": 500,
  "contraption": "router_lanes", "skin": "filing_cabinets",
  "objectNoun": "Filing Cabinets", "partNouns": ["provision slip", "cabinets"], "pins": [],
  "accessories": [ { "kind": "record_lens", "rail": [[3100, 60], [4700, 60]],
                     "carriage": "archive_of_voices.part.lens_carriage",
                     "cone": { "target": [4200, 360], "asset": "archive_of_voices.fx.projector_cone" } } ],
  "frameZoom": null,
  "probes": [ { "predicate": "assignedTo", "itemKey": "i2", "binId": "cra_1964", "key": "vote_in_1964" } ],
  "panel": { "layout": "board", "inputSymbol": null, "verifyLabel": "SEAL THE CABINETS", "successBadge": "FILES SEALED", "cards": [] },
  "payoff": { "kind": "terrain", "vertical": "down", "anim": "stairwell_opens", "noun": "stairwell",
              "blocker": { "x": 4140, "surface": "ground", "asset": null },
              "terrain": [ { "surface": "ground", "points": [[4150, 640], [4450, 1150], [5760, 1150]] } ],
              "rideCutsceneId": null, "autoBoardMs": null, "feedsHub": true },
  "boss": null }
```

**Config** (`RouterLanesConfig`; printed dates from items i4 "July 2, 1964" and i5 "March 1965"; lane ids are the
skin's drawer lanes):
```json
{ "items": [
    { "key": "i0", "meta": { "printedDate": null, "madeYear": null, "glyph": null, "label": null }, "polar": null, "charged": null, "from": null, "to": null, "vehicle": "none" },
    { "key": "i1", "meta": { "printedDate": null, "madeYear": null, "glyph": null, "label": null }, "polar": null, "charged": null, "from": null, "to": null, "vehicle": "none" },
    { "key": "i2", "meta": { "printedDate": null, "madeYear": null, "glyph": null, "label": null }, "polar": null, "charged": null, "from": null, "to": null, "vehicle": "none" },
    { "key": "i3", "meta": { "printedDate": null, "madeYear": null, "glyph": null, "label": null }, "polar": null, "charged": null, "from": null, "to": null, "vehicle": "none" },
    { "key": "i4", "meta": { "printedDate": "1964-07-02", "madeYear": null, "glyph": null, "label": null }, "polar": null, "charged": null, "from": null, "to": null, "vehicle": "none" },
    { "key": "i5", "meta": { "printedDate": "1965-03", "madeYear": null, "glyph": null, "label": null }, "polar": null, "charged": null, "from": null, "to": null, "vehicle": "none" } ],
  "lanes": [ { "binId": "cra_1964", "laneId": "drawer_0", "year": 1964.5 },
             { "binId": "vra_1965", "laneId": "drawer_1", "year": 1965.5 } ],
  "lens": "none", "lensTier": 1, "energy": null, "shutters": true, "stamp": "none",
  "eventsBand": null, "eventsBandTier": 1, "probe": "YEAR(1963.5, 1966)", "probeWorld": "record_lens" }
```

- **In-world object** (the Filing Hall):
  - a **pneumatic drop** (`part.filing_cabinets_pneumatic_drop`) that delivers 6 **provision slips**
    (`part.filing_cabinets_slip`, text DOM) onto a sorting table (anchor `table`);
  - two tall **filing cabinets** on floor rails (`part.filing_cabinets_cabinet`, drawn at scale 0.62 so they fit under
    the hall ceiling), labelled with the view's bin labels ("Civil Rights Act of 1964", "Voting Rights Act of 1965"),
    each with an open top drawer (`drawer_0…1`);
  - a **signal meter** (VU needle, `part.filing_cabinets_meter`, `meter_0…1`) per cabinet;
  - a brass **feature shutter** (`part.filing_cabinets_shutter`, `shutter_0…1`) over each cabinet's feature plate
    (closed; the feature text shows at aid tier ≥ 1, or for the disclosed bin on a miss).
- **Control:** `RouterControl`: the slips as a palette (`view.items` order), two drawer targets; drag, or keys 1/2 to
  file the focused slip; Backspace un-files.
- **Draft:** `{assignments: {itemKey, binId}[]}` (partial; + `focus`).
- **Live binding:**
  ```
  on file: slip flies from table to drawer on a quadratic Bézier (apex 180 px above), 450 ms, spins 1 turn
  meter[b].needle_target = −50° + 100° · count(b) / items.length        // completion, never correctness
  cabinet chip (world, border = that bin's colour): "3 FILED"            // counts only, never capacities
  FILE card: a pin per filed slip at its CABINET's lane year (1964.5 green / 1965.5 blue), stacked
  ```
- **Year probe:** window `1963.5–1966`. RECORD has e1–e7 (the August 1963 march is in view at the left edge). The
  Record Lens rides the hall's cornice. Scrubbing across the two lane years shows both acts' pins in the same frame:
  the concept is *two different years for two different laws*.
- **Verify:** `SEAL THE CABINETS`, enabled when all slips are filed. Submits `{assignments}` to `bins.grade`.
- **Success** (2.0 s): the drawers slam shut (`drawer_thunk` ×2); both meters peg and settle; the brass shutters open
  to show both feature plates; the cabinets **roll apart on their floor rails** (600 ms), revealing a stairwell down.
  Badge **FILES SEALED**. Payoff: down the stairwell to the corridor and the Selma seam.
- **Failure** (`failKey: wrong_bin`, `wrongKeys: [itemKey]`, `disclosed: {bin}`): that slip **bounces** out of its
  drawer back to the table; **the disclosed cabinet's feature shutter opens** and shows its feature text (the same
  text the grade feedback quotes). The other slips stay filed. Ida says `e8.F`, or `e8.F2` when the literacy-test slip
  sits under 1964.
- **Visible misconception** ("the 1964 act guaranteed the vote"): filing "Banned literacy tests…" under 1964 puts a
  green pin at 1964.5 on the FILE card, *before* the `1965-03` date printed on the Selma slip in the same pile.
  After e9 the RECORD strip makes this impossible to miss on a replay.
- **Hints in the world:** rung 1: **both feature shutters open** (`shutters: true`: the defining rules become
  visible) and Wick circles them (`shutter_0…1`); rung 2: Wick circles the meters (`meter_0…1`); rung 3: Wick hovers
  over the sorting table while `e8.H3` speaks.

### 5.9 e9_selma · **Timeline Bridge** · `step_bridge` / `timeline_bridge` · `s7_selma` · board

**Station block:**
```json
{ "encounterId": "e9_selma", "zoneId": "s7_selma", "consoleX": 1100, "consoleSurface": "ground",
  "consoleAsset": null, "anchor": { "x": 2800, "y": 900 }, "approachRadius": 500,
  "contraption": "step_bridge", "skin": "timeline_bridge",
  "objectNoun": "Timeline Bridge", "partNouns": ["bridge planks", "span", "deck"], "pins": [],
  "accessories": [ { "kind": "record_lens",
                     "rail": [[1300, 900], [1600, 620], [2000, 420], [2400, 310], [2800, 280], [3200, 310], [3600, 420], [4000, 620], [4300, 900]],
                     "carriage": "archive_of_voices.part.lens_carriage",
                     "cone": { "target": [2800, 900], "asset": "archive_of_voices.fx.projector_cone" } } ],
  "frameZoom": null,
  "probes": [ { "predicate": "decoyPresent", "itemKey": "d0", "key": "other_story" } ],
  "panel": { "layout": "board", "inputSymbol": null, "verifyLabel": "LOCK THE SPAN", "successBadge": "SPAN LOCKED", "cards": [] },
  "payoff": { "kind": "terrain", "vertical": "none", "anim": "bridge_forms", "noun": "bridge deck",
              "blocker": { "x": 2190, "surface": "ground", "asset": null },
              "terrain": [ { "surface": "ground", "points": [[2200, 900], [3400, 900]] } ],
              "rideCutsceneId": null, "autoBoardMs": null, "feedsHub": true },
  "boss": null }
```

**Config** (`StepBridgeConfig`; every plank prints its date; `bayLampsTier: 1` is amendment 26; the heading's "CH. 21"
is the fixture source title "US History Ch. 21"):
```json
{ "bays": "arch",
  "items": [
    { "key": "s0", "meta": { "printedDate": "1964-07-02", "madeYear": null, "glyph": null, "label": null } },
    { "key": "s1", "meta": { "printedDate": "1965-03-07", "madeYear": null, "glyph": null, "label": null } },
    { "key": "s2", "meta": { "printedDate": "1965-03-25", "madeYear": null, "glyph": null, "label": null } },
    { "key": "s3", "meta": { "printedDate": "1965-08-06", "madeYear": null, "glyph": null, "label": null } },
    { "key": "d0", "meta": { "printedDate": "1956-12", "madeYear": null, "glyph": null, "label": null } } ],
  "stepEffects": [], "stages": [], "anchors": 0, "relief": null,
  "probe": "YEAR(1964.4167, 1965.6667)", "probeWorld": "bay_lamps", "dayCounter": null,
  "bayLampsTier": 1, "pageOrderHeading": "AS PRINTED IN CH. 21" }
```

- **In-world object:**
  - the **steel through-arch bridge** (`part.timeline_bridge_arch_bridge`) with **4 missing deck bays** at its crown
    (anchors `bay_0…3`, `crown`);
  - a **bay lamp** (`part.timeline_bridge_bay_lamp`) on a stanchion per bay;
  - the **surveyor's lectern** console (`part.timeline_bridge_lectern`, the skin's console);
  - the Record Lens rail runs **along the arch** itself (`arch_rail`), so the carriage climbs and descends the arch.
- **Control:** `SlotRailControl`: a plank palette (4 dated steps + 1 decoy) under the heading **"AS PRINTED IN CH.
  21"**, a 4-bay `slot_rail` card drawn as the deck, and the Record Strip.
- **Draft:** `{slots}` (partial).
- **Live binding:**
  ```
  placed plank → a deck section (part.timeline_bridge_deck_section) slides in from below its bay (300 ms),
                 with a big WORLD CHIP on its face showing the date PRINTED in the plank's text (DOM), e.g. "MAR 7 1965"
                 every placed section has the SAME length, the decoy's included (no pre-Verify tell)
  slot_rail lamps: "on" = filled, "off" = empty (completion only)
  Record Lens carriage: follows the arch rail by arc length (§5.0.2)
  ```
- **The instrument, gated (amendment 26).** Scrubbing the year cursor from `JUN 1964` to `SEP 1965` makes each bay's
  lamp light **when the cursor passes that plank's printed date**. In the correct order, the world lamps light in a
  clean left-to-right sweep; in a wrong order they light jumbled; the decoy (DEC 1956) lights at once at the window's
  left edge, "from a different story". That sweep is a correctness signal, so:
  - **aid tier 0** (no hint used, no failed Verify): the **world bay lamps stay off** for every draft and every
    cursor position. The FILE card plots the placed planks' printed dates as green markers **with no connectors to
    bay numbers**, so it shows *which* dates are on the deck, never *where*.
  - **aid tier ≥ 1** (rung 1, or after the first failed Verify): the world sweep runs, and the FILE card draws each
    marker's connector to its bay number, so crossed connectors show misorder.

  Every lamp is driven only by dates the player can already read on the planks. After tier 1 the instrument turns
  reading dates into a visible check, which **is** the lesson ("Dates decide the order"): the Variant P8 staircase
  translated, the target is monotone time. The no-leak test (20 §8.1) asserts the world `bayLamps` field is all off
  at aid tier 0.
- **Year probe:** window `JUN 1964 – SEP 1965`. RECORD has e1–e8, including `JUL 2 1964 · Civil Rights Act` (earned in
  e8).
- **Verify:** `LOCK THE SPAN`. Submits `{keys: slots}` to `linear.grade`.
- **Success** (2.5 s): the deck sections lock left to right (steel clank `slab_set`, 150 ms apart); the bay lamps and
  then all the arch lamps light; **the rain stops** (the `bridge` segment's variant: particles fade over 1.5 s). The
  printed dates remain engraved on the deck. Badge **SPAN LOCKED**. **Payoff:** the crossing. Run is disabled, the
  music drops to `solemn`, and the camera pulls wide. Nell walks across (about 12 s). There are no figures and no
  reenactment; the lamps light as she passes. On the far bank, the document plate lights: "The Edmund Pettus Bridge,
  1965" with the e9 `sourceRef` quote. Then the streetcar home (`ride_home`).
- **Failure:**
  - `failKey: order` (`prefix = n`): sections 0…n−1 lock; section n tips out and slides back under the bay.
  - `failKey: decoy`: **only now**, inside the failure plan, the decoy's section visibly shortens (it is a different
    story's plank), fails to reach both bay edges, and slides back into the river, its date chip reading `DEC 1956`.
    Ida says `e9.F2`.

  The first failed Verify raises the aid tier to 1, so the retry has the sweep (`e9.F` tells Nell to use it).
- **Visible misconception** ("events happened in the order the textbook mentions them"): the plank palette lists the
  planks in the (shuffled) "page order" under **"AS PRINTED IN CH. 21"**. At tier 1 the cursor sweep shows that order
  lighting out of time.
- **Hints in the world:** rung 1: Wick **rides** the Record Lens carriage along the arch once, left to right
  (`arch_rail`, action `ride`), and the world sweep switches on; rung 2: Wick lands on the crown (`crown`) and the
  `JUL 2 1964` RECORD pin flashes; rung 3: Wick hovers over the last bay (`bay_3`) while `e9.H3` speaks.

### 5.10 e10_sources · **Provenance Drawers** · `router_lanes` / `provenance_drawers` · `s8_stacks_vault` · board

**Station block** (the payoff's traversal is the `s8_rolling_ladder` link it unlocks, so `terrain` is empty):
```json
{ "encounterId": "e10_sources", "zoneId": "s8_stacks_vault", "consoleX": 1450, "consoleSurface": "ground",
  "consoleAsset": "archive_of_voices.prop.console_reader", "anchor": { "x": 1800, "y": 1400 }, "approachRadius": 500,
  "contraption": "router_lanes", "skin": "provenance_drawers",
  "objectNoun": "Provenance Drawers", "partNouns": ["document", "drawer", "stacks"], "pins": [],
  "accessories": [ { "kind": "record_lens", "rail": [[800, 470], [2600, 470]],
                     "carriage": "archive_of_voices.part.lens_carriage",
                     "cone": { "target": [1800, 1300], "asset": "archive_of_voices.fx.projector_cone" } } ],
  "frameZoom": null,
  "probes": [ { "predicate": "assignedTo", "itemKey": "i1", "binId": "primary", "key": "old_means_primary" } ],
  "panel": { "layout": "board", "inputSymbol": null, "verifyLabel": "SEAL THE STACKS", "successBadge": "FILES SEALED", "cards": [] },
  "payoff": { "kind": "terrain", "vertical": "up", "anim": "stairs_rise", "noun": "rolling ladder",
              "blocker": { "x": 2300, "surface": "ground", "asset": null }, "terrain": [],
              "rideCutsceneId": null, "autoBoardMs": null, "feedsHub": true },
  "boss": null }
```

**Config** (every made year is printed in its own item; the events band's years, 1963 and 1965, appear in items i0
and i2; the old `1954–1965` band is withdrawn because no e10 text contains 1954):
```json
{ "items": [
    { "key": "i0", "meta": { "printedDate": null, "madeYear": 1963, "glyph": "photo_print", "label": null }, "polar": null, "charged": null, "from": null, "to": null, "vehicle": "none" },
    { "key": "i1", "meta": { "printedDate": null, "madeYear": 1971, "glyph": "aged_textbook", "label": null }, "polar": null, "charged": null, "from": null, "to": null, "vehicle": "none" },
    { "key": "i2", "meta": { "printedDate": null, "madeYear": 1965, "glyph": "law_text", "label": null }, "polar": null, "charged": null, "from": null, "to": null, "vehicle": "none" },
    { "key": "i3", "meta": { "printedDate": null, "madeYear": 2019, "glyph": "film_case", "label": null }, "polar": null, "charged": null, "from": null, "to": null, "vehicle": "none" },
    { "key": "i4", "meta": { "printedDate": null, "madeYear": 1965, "glyph": "transcript", "label": null }, "polar": null, "charged": null, "from": null, "to": null, "vehicle": "none" },
    { "key": "i5", "meta": { "printedDate": null, "madeYear": 1988, "glyph": "hardcover", "label": null }, "polar": null, "charged": null, "from": null, "to": null, "vehicle": "none" } ],
  "lanes": [ { "binId": "primary", "laneId": "drawer_0", "year": null },
             { "binId": "secondary", "laneId": "drawer_1", "year": null } ],
  "lens": "none", "lensTier": 1, "energy": null, "shutters": true, "stamp": "made_year",
  "eventsBand": { "from": "1963", "to": "1965", "label": "THE EVENTS · 1963–1965" }, "eventsBandTier": 1,
  "probe": { "symbol": "YEAR", "label": "record year", "min": 1950, "max": 2025, "step": 1, "unit": "", "format": "year",
             "initial": null, "stops": [], "window": { "start": 1950, "end": 2025 }, "playback": false },
  "probeWorld": "record_lens" }
```
(`glyph` values name the six icons of `part.provenance_drawers_documents`: what each document *is*, never which drawer
it belongs in.)

- **In-world object:**
  - a spilled cabinet with **6 distinct documents** on the floor (`part.provenance_drawers_documents`, one hero sheet):
    - a 1963 photograph print;
    - a **yellowed, cracked-spine 1971 textbook**, painted *deliberately older-looking* than anything else (`paper.aged`
      `#D9C08E`: the visible trap);
    - the typed text of the Voting Rights Act;
    - a modern film case (2019 documentary);
    - a typed interview transcript dated 1965;
    - a 1988 hardcover biography;
  - a **provenance cabinet** with two drawers, "PRIMARY SOURCE" and "SECONDARY SOURCE" (`drawer_0…1`), each with a
    brass feature shutter (`shutter_0…1`);
  - the closed compact shelving (`part.provenance_drawers_compact_shelving`, cranks `part.provenance_drawers_crank`);
    **Theo** holding the textbook.
- **Control, draft, live binding:** as §5.8 (slips become documents, each with its icon), plus:
  ```
  on file: a rubber date stamp prints the document's MADE year (config madeYear, the year in its own text) on its
           corner as it enters the drawer — neutral info the player already read (stamp: made_year)
  FILE card: a dot per filed document at its MADE year (green = primary drawer, blue = secondary drawer)
  Theo's think bubble shows the textbook icon until e10 is solved (his NPC state, §6.4)
  ```
- **Year probe:** window `1950–2025` (labels every 10 years). The Record Lens rides the top of the shelving and lights
  the shelf section for the cursor's decade.
- **Hint-gated overlay:** at aid tier 1 (`eventsBandTier: 1`) the FILE card draws a shaded **"THE EVENTS ·
  1963–1965"** band: the years these documents are about. Documents whose made-dot sits inside the band *and* were
  made by someone there are primary. That is the rule, drawn.
- **Verify:** `SEAL THE STACKS`. Submits `{assignments}` to `bins.grade`.
- **Success** (2.0 s): the drawers shut; the shutters show both features; the **compact shelving rolls apart** (the
  crank wheels spin, 6 units, 150 ms apart), opening the aisle; the **rolling ladder** rolls to the gallery and locks
  (`stairs_rise`). Badge **FILES SEALED**. Payoff: the aisle, then the ladder (`s8_rolling_ladder`, now enabled) up to
  the Big Board gallery. Theo's state flips to `theo_after` (N08).
- **Failure** (`wrong_bin`): as §5.8 (the document bounces; the disclosed drawer's shutter opens). Theo's bubble flips
  to a "?". Ida says `e10.F`, or `e10.F2` when the textbook is filed as primary.
- **Visible misconception** ("old means primary"): the oldest-*looking* object is secondary. On the FILE card its
  made-dot (1971) sits *outside* the events band while the pristine-looking 1963 photo sits inside it.
- **Hints in the world:** rung 1: the events band appears and both shutters open; Wick circles the shutters; rung 2:
  Wick circles the spilled documents (`table`); rung 3: Wick hovers at the primary drawer (`drawer_0`) while `e10.H3`
  speaks.

### 5.11 e11_causation · **Big Board** · `cause_tubes` / `big_board` · `s8_stacks_vault` (gallery) · board

**Station block:**
```json
{ "encounterId": "e11_causation", "zoneId": "s8_stacks_vault", "consoleX": 2900, "consoleSurface": "gallery",
  "consoleAsset": "archive_of_voices.prop.console_reader", "anchor": { "x": 3700, "y": 1020 }, "approachRadius": 500,
  "contraption": "cause_tubes", "skin": "big_board",
  "objectNoun": "Big Board", "partNouns": ["tube", "capsule", "canisters"], "pins": [],
  "accessories": [ { "kind": "record_lens", "rail": [[3150, 470], [4250, 470]],
                     "carriage": "archive_of_voices.part.lens_carriage",
                     "cone": { "target": [3700, 800], "asset": "archive_of_voices.fx.projector_cone" } } ],
  "frameZoom": 0.8,
  "probes": [ { "predicate": "decoyPresent", "itemKey": null, "key": "earlier_chain" } ],
  "panel": { "layout": "board", "inputSymbol": null, "verifyLabel": "SEND THE CAPSULE", "successBadge": "CIRCUIT CLOSED", "cards": [] },
  "payoff": { "kind": "ride", "vertical": "down", "anim": "lift_moves", "noun": "vault lift",
              "blocker": { "x": 4690, "surface": "ground", "asset": null }, "terrain": [],
              "rideCutsceneId": "ride_vault_lift", "autoBoardMs": null, "feedsHub": true },
  "boss": null }
```

**Config** (every node prints its date; `boardWidth: 1100`, amendment 32):
```json
{ "nodes": [
    { "key": "n0", "meta": { "printedDate": "1963-05", "madeYear": null, "glyph": null, "label": null } },
    { "key": "n1", "meta": { "printedDate": "1963-06", "madeYear": null, "glyph": null, "label": null } },
    { "key": "n2", "meta": { "printedDate": "1964-07", "madeYear": null, "glyph": null, "label": null } },
    { "key": "n3", "meta": { "printedDate": "1965-03", "madeYear": null, "glyph": null, "label": null } },
    { "key": "n4", "meta": { "printedDate": "1965-08", "madeYear": null, "glyph": null, "label": null } },
    { "key": "d0", "meta": { "printedDate": "1954", "madeYear": null, "glyph": null, "label": null } },
    { "key": "d1", "meta": { "printedDate": "1955", "madeYear": null, "glyph": null, "label": null } } ],
  "connector": "tube", "layout": "ring", "carrier": "capsule", "gauge": true, "boardWidth": 1100,
  "probe": "YEAR(1963, 1966)", "probeWorld": "record_lens" }
```

- **In-world object:**
  - the **Big Board** (`part.big_board_board_wall`, `K:compose`): a brass wall **1100 × 520** (was 1920 × 900;
    amendment 32) standing on the gallery, x 3150–4250, with **7 pneumatic canisters** (`part.big_board_canister`, 5
    nodes + 2 decoys, **display order**, anchors `canister_0…6`) mounted in a loose ring (circle motif);
  - tube channels between mounts (tubes are code-drawn);
  - a **capsule launcher** at the lower left (`part.big_board_launcher`);
  - through the arches beyond, the Record Engine (the S8 hub).
- **Framing:** at `frameZoom: 0.8` the whole 1100-wide board fits the board-layout safe rect (the left 45 % of the
  view); the camera centres on the board's `frameBounds`, not on the console.
- **Control and draft:** as §5.5 (`TubeControl` over a 7-node `cause_graph` card, `{edges}`).
- **Live binding:**
  ```
  each draft edge → a brass tube (thick 18 px path, glass windows every 60 px) extends from source to target
     along an orthogonal route (Manhattan, 2 bends max), "growing" at 900 px/s
  canisters with an outgoing tube: their glass lid rotates open 30° (ready, not correct)
  ```
- **Year probe:** window `1963–1966` (the decoys' 1954/1955 sit behind an axis break on FILE). **RECORD now holds
  every earned pin** (Birmingham, Kennedy's bill, CRA, Bloody Sunday, VRA), so the player can scrub their own
  restored record to check each link's time order. **This is the synthesis: the evidence is what you rebuilt.** The
  FILE card shows the dates printed in the node texts.
- **Verify:** `SEND THE CAPSULE`. Submits `{edges}` to `chain.grade`.
- **Success** (2.5 s): a capsule shoots through the tubes in causal order (`tube_whoosh`; each canister lamp lights as
  the capsule passes). The Record Engine's rings turn (visible through the arches), and the vault's first bolt slides
  (a heavy clunk from below). Badge **CIRCUIT CLOSED**. `payoffLine` X10. Payoff: E/W at the vault lift runs
  `ride_vault_lift` (down 500 to the vault level).
- **Failure:**
  - `failKey: decoy`: the capsule pops out of that canister's lid ("belongs to an earlier chain"); Ida says `e11.F2`;
  - `failKey: wrong_link` (`wrongKeys: [from]`): the capsule **jams** at that canister (a puff of air, the glass fogs).

  The margin note shows the grade feedback.
- **Visible misconception** ("history is a list of unrelated events"): before any tubes are drawn, the canisters hang
  as isolated pins on a wall. The payoff is literally connection.
- **Hints in the world:** rung 1: Wick circles the canisters (`canister_0…6`) in display order; rung 2: Wick lands on
  the launcher (`launcher`) and RECORD flashes its two televised-crisis pins (Birmingham, Bloody Sunday); rung 3: Wick
  hovers at the console while the ruler's 1963/1964/1965 labels glow and `e11.H3` speaks.

### 5.12 e12_boss · **Tumbler Vault** · `tumbler_vault` / `tumbler_vault` · `s8_stacks_vault` · **vault**

**Station block** (`BossStaging` per amendment 8; no `record_lens`: the vault's modal carries its own mini strip):
```json
{ "encounterId": "e12_boss", "zoneId": "s8_stacks_vault", "consoleX": 5100, "consoleSurface": "ground",
  "consoleAsset": null, "anchor": { "x": 5700, "y": 1900 }, "approachRadius": 700,
  "contraption": "tumbler_vault", "skin": "tumbler_vault",
  "objectNoun": "Editor's Vault", "partNouns": ["tumblers", "clues", "vault"],
  "pins": [ { "anchor": "hub", "text": null, "glyph": "key" } ],
  "accessories": [], "frameZoom": null, "probes": [],
  "panel": { "layout": "vault", "inputSymbol": null, "verifyLabel": "OPEN THE VAULT", "successBadge": "STORY PRINTED", "cards": [] },
  "payoff": { "kind": "remove_blocker", "vertical": "none", "anim": "vault_opens", "noun": "Editor's Vault",
              "blocker": { "x": 5760, "surface": "ground", "asset": null }, "terrain": [],
              "rideCutsceneId": null, "autoBoardMs": null, "feedsHub": true },
  "boss": { "speakerId": "editor", "arenaTriggerX": 4900, "arenaCutsceneId": "e12_arena",
            "arenaBounds": { "x0": 4700, "x1": 6720 }, "phases": [],
            "taunts": { "approach": [], "fail": ["e12.T1", "e12.T2"], "byKey": [] }, "music": "noir" } }
```
(`taunts.fail` holds full `WorldLine`s with `speakerId: "editor"`; ids shown for width.)

**Config** (each clue's date is in its own text: clue 0 "early 1965", clue 1 "March 15, 1965", clue 2 "in 1965", clue 3
"between 1957 and 1964", dated by its end):
```json
{ "clues": [ { "index": 0, "date": "1965" }, { "index": 1, "date": "1965-03-15" },
             { "index": 2, "date": "1965" }, { "index": 3, "date": "1964" } ],
  "bolts": 4, "miniStrip": { "start": 1954, "end": 1967 }, "shadeCountsRung": 3, "probe": "YEAR(1954, 1966)" }
```

- **In-world object:** the **Editor's Vault**:
  - a round door (1000 px, `part.tumbler_vault_vault_door`) in a cream socket (`prop.vault_socket`) with radiating
    navy grooves and a gold ring;
  - **4 tumbler wheels** (`part.tumbler_vault_tumbler`, 180 px, anchors `tumbler_0…3`) at 12, 3, 6 and 9 o'clock,
    each engraved with one hypothesis (`view.hypotheses` order; text DOM) on its band;
  - 4 bolts (`part.tumbler_vault_bolt`, `bolt_0…3`); a central spoked handwheel (`part.tumbler_vault_handwheel`,
    `hub`); the brass **voice grille** (`part.tumbler_vault_voice_grille`, `grille`).
- **Boss staging:** crossing x 4900 (right after the vault lift lands at x 4800) plays `e12_arena`: the music turns to
  `noir`, the camera settles on the vault, the grille glows and the Editor speaks X09 (the fixture's before-beat). The
  camera stays inside `arenaBounds` while Nell is in the vault room. A wrong Verify plays the Editor's taunt
  (`e12.T1`, then `e12.T2`, cycling) before Ida's line.
- **Panel (vault layout, bible §3.1; 20 §3.1 centred modal 80 % × 85 %):**
  - The **left brief column (30 %)**: the Editor's emblem; `view.question` ("Why did Congress pass the Voting Rights
    Act in August 1965?"); the info button (salmon ring, as in 8.png).
  - The **right 70 %**: the **Evidence Matrix** (`matrix` card):
    - 4 **clue cards** (`view.clues`, in order; each a dated document on paper texture, its `date` from config) as
      columns;
    - 4 **hypothesis rows** (the tumblers' texts);
    - each cell is a **strike toggle** (the player's own notation);
    - a mini Record Strip across the top (`miniStrip` 1954–1967, all pins earned, the year probe's cursor);
    - an **ACCUSE** socket on each row (orange ring when chosen).
- **Control:** `MatrixControl`.
- **Draft:** `{hypothesisId}` plus `marks: {clueIndex, hypothesisId}[]`. **`marks` is panel-only notation. It never
  reaches `grade()`** and is never checked against the eliminations, because that matrix is deliberately absent from
  the view.
- **Live binding** (world, visible around the modal):
  ```
  struck(h) = any mark with hypothesisId == h
  tumbler[h].rotation_target = struck(h) ? 90° : 0°            (eased; heavy: spring k 6, damping 0.9)
  tumbler[h].lamp = struck(h) ? dim salmon (#C4643C @ 60 %) : white
  if exactly one hypothesis is unstruck: that tumbler's groove glows cyan and slides 8 px toward the bolt channel
                                         (from the player's OWN marks, never from the solution)
  accused tumbler: orange ring (input-bound)
  ```
- **Verify:** `OPEN THE VAULT`, enabled when a hypothesis is accused. Submits `{hypothesisId}` to `elimination.grade`.
- **Success** (the finale's opening):
  - the accused tumbler aligns and locks (clunk);
  - **the 4 bolts retract in sequence** (180 ms each, `bolt_slide`);
  - the door's rings counter-rotate 1.5 turns;
  - the handwheel spins, and the door swings open (1.2 s);
  - the modal slides away; the badge **STORY PRINTED** flashes over the press-organ (`part.tumbler_vault_press_organ`)
    inside; `payoffLine` e12.S1 (the Editor); the `success` line e12.S2 (Ida). Then the finale cutscene (§4.3).
- **Failure** (`failKey: wrong_hypothesis`, `wrongKeys: [id, "clue:i"]`, `disclosed: {clueIndex: i}`): the accused
  tumbler **grinds** (a 4° judder, 3×, `tumbler_grind`); **clue card i lifts out of the matrix and slides beside that
  row** with a brass pointer; its cell lights. The Editor taunts, then Ida says `e12.F`. The margin note shows the
  grade feedback, which quotes the clue. The accusation clears; the player's marks stay.
- **Visible misconception** ("history is a list of unrelated events"): every hypothesis that treats 1965 as unconnected
  ("inevitable after Brown", "the court ordered it", "1964 already fixed voting") is struck by a **dated** clue, and
  the mini strip shows the dates that strike them.
- **Hints in the world:** rung 1: the grille glows and the clue cards' dates brighten (Wick circles `grille`); rung 2:
  Wick lands on the handwheel (`hub`); rung 3: the matrix shades every row's struck-cell count (`shadeCountsRung: 3`).

### 5.13 Contraption summary

| Enc | Mode | Archetype / skin | Layout | Control | Draft → live world | Verify / badge | Payoff (`kind` / `vertical` / `anim` · noun) |
|---|---|---|---|---|---|---|---|
| e1 | mimic | `claim_holders` / `witness_projector` (aimer `arc_lamp`) | scrub | Aim | aim/hover → lamp angle, beam, panel brightness; probe → Record Lens | RETRACT SLIDE / SLIDE RETRACTED | terrain / up / `stairs_rise` · courthouse steps |
| e2 | linear | `step_bridge` / `walking_road` | board | SlotRail | slots → slabs rise from the water; probe → DAY counter | LIGHT THE ROUTE / ROUTE RESTORED | terrain / none / `bridge_forms` · Walking Road |
| e3 | predict_reveal | `oracle_ticker` / `wire_ticker` | scrub | Aim | option → knob angle, tape text, wire hum | SEND TO THE WIRE / WIRE CONFIRMED | remove_blocker / up / `barrier_dissolves` · school doors |
| e4 | mimic | `claim_holders` / `witness_projector` (aimer `pendant_lamp`) | scrub | Aim | aim/hover → pendant swing | RETRACT SLIDE / SLIDE RETRACTED | remove_blocker / none / `door_opens` · swing door |
| e5 | chain | `cause_tubes` / `relay_line` | board | Tube | edges → catenary wires, lamps, charge gauge | CLOSE THE CIRCUIT / CIRCUIT CLOSED | remove_blocker / up / `gate_lifts` · rolling gate |
| e6 | chain | `cause_tubes` / `broadcast_relay` | board | Tube | edges → vertical wires, dishes turn | CLOSE THE CIRCUIT / CIRCUIT CLOSED | ride / up / `lift_moves` · mast lift |
| e7 | pairs | `switchboard` / `switchboard` | board | Cable | links → verlet cords, white jack lamps, program lines | CONNECT THE PROGRAM / PROGRAM CONNECTED | terrain / up / `stairs_rise` · memorial steps |
| e8 | bins | `router_lanes` / `filing_cabinets` | board | Router | assignments → slip flights, meters, FILE pins | SEAL THE CABINETS / FILES SEALED | terrain / down / `stairwell_opens` · stairwell |
| e9 | linear | `step_bridge` / `timeline_bridge` | board | SlotRail | slots → deck sections + date chips; probe → bay lamps **at tier ≥ 1 only** | LOCK THE SPAN / SPAN LOCKED | terrain / none / `bridge_forms` · bridge deck |
| e10 | bins | `router_lanes` / `provenance_drawers` | board | Router | assignments → document flights, made-year stamps, meters | SEAL THE STACKS / FILES SEALED | terrain / up / `stairs_rise` · rolling ladder |
| e11 | chain | `cause_tubes` / `big_board` | board | Tube | edges → growing tubes, lids | SEND THE CAPSULE / CIRCUIT CLOSED | ride / down / `lift_moves` · vault lift |
| e12 | elimination | `tumbler_vault` / `tumbler_vault` | vault | Matrix | marks → tumbler rotation; accused → ring | OPEN THE VAULT / STORY PRINTED | remove_blocker / none / `vault_opens` · Editor's Vault → finale |

W1 (a vertical payoff per zone with stations): S2 e1 up, S3 e3 up, S4 e5 up, S5 e6 up, S6 e7 up and e8 down, S8 e10 up
and e11 down; **S7 warns** (by design).

---

## 6 · Side content and purpose systems

### 6.1 Objective HUD and `story`

- **Objective ring** (top-left, 55 px double ring, white @ 60 %; 20 §2.6): 12 segments, each filled clockwise
  (400 ms) when its station is restored. Its tooltip and SR text read "Restore the Courier-Ledger's record, 1954 to
  1965 · 4 of 12 projections".
- **Objective line** under the ring (16 px caps): **`RECORD RESTORED 4/12`**, shown for 4 s on zone entry and on J.
- **Counters** (P1): "Negatives 2/5" for 3 s after a pickup.
- No meter: the Record Strip is this game's purpose instrument (20 §0.1.2 civil HUD row).

```json
{ "logline": "A storm scrambled the Courier-Ledger's Record Engine. Walk its projected city, 1954 to 1965, and repair every false or broken record before dawn.",
  "objective": "Restore the Courier-Ledger's record, 1954 to 1965",
  "objectiveLabel": "RECORD RESTORED", "restoredNoun": "projection",
  "introCutsceneId": "intro", "finaleCutsceneId": "finale",
  "meter": null, "progressEffects": "§6.2 (P1; [] at P0)", "map": "§6.8 (P2; null at P0)",
  "journal": { "title": "Clipping Case", "style": "clippings" },
  "recordStrip": "§5.0.2" }
```

### 6.2 Progress effects (P1)

Four kinds of `story.progressEffects` (38 entries ≤ 60):

| Kind | Entries |
|---|---|
| `beam_line` (depth `L1_far`) | e1 `s2_courthouse` [2050, 150] → [3400, 60]; e2 `s2_courthouse` [4700, 800] → [3400, 60]; e3 `s3_schoolhouse` [2750, 200] → [2600, 60]; e4 `s4_main_street` [1300, 300] → [3600, 60]; e5 `s4_main_street` [4450, 450] → [3600, 60]; e6 `s5_church_mast` [3600, 950] → [3000, 860]; e7 `s6_memorial` [1750, 200] → [3000, 60]; e8 `s6_memorial` [4200, 100] → [3000, 60]; e9 `s7_selma` [2800, 280] → [4000, 60]; e10 `s8_stacks_vault` [1800, 900] → [3700, 760] (to the Engine through the arches). The `to` points sit on the Courier-Ledger tower's `antenna` anchor as seen from each landmark. |
| `hub_socket` (`zoneId: s8_stacks_vault`) | one per encounter, `socket` 0…11 in encounter order: the Engine's 12 lenses light in S8 (and on the finale vista). |
| `label_swap` (`propId: front_pages_wall`, `anchor: page_<i>`, `after: null` = the encounter's `debriefLine`) | page_0 e1 "SCHOOLS DESEGREGATE AT ONCE · UNVERIFIED"; page_1 e2 "TIRED SEAMSTRESS ACTS ALONE · UNVERIFIED"; page_2 e3 "SOUTH COMPLIES WITH BROWN · UNVERIFIED"; page_3 e4 "SIT-INS AVOID CONFRONTATION · UNVERIFIED"; page_4 e5 "WASHINGTON LEADS THE MOVEMENT · UNVERIFIED"; page_5 e6 "ONE CAUSE, ONE BILL · UNVERIFIED"; page_6 e7 "MARCH WAS ONE SPEECH · UNVERIFIED"; page_7 e8 "1964 ACT GUARANTEES THE VOTE · UNVERIFIED"; page_8 e9 "EVENTS RAN IN CHAPTER ORDER · UNVERIFIED"; page_9 e10 "OLD PAPERS ARE PRIMARY SOURCES · UNVERIFIED"; page_10 e11 "EVENTS UNRELATED, LAWS UNRELATED · UNVERIFIED"; page_11 e12 "1965 LAW WAS INEVITABLE · UNVERIFIED". |
| `prop_state` | e4 → `stool_05`, `stool_06`, `stool_07`, `stool_08` state `lit` (the four students' stools light from beneath and stay empty). |

Also P1, without an effect entry: the S5 skyline `window_cluster` props carry `restoredBy: e6_birmingham` (they wake
when e6 is solved; the left-to-right wave timing is P2).

### 6.3 Ambient triggers (`triggers[]`)

| `id` | Zone | `x` (surface) | `radius` | `kind` | Lines | `requires` | `setFlag` / `cue` | Tier |
|---|---|---|---|---|---|---|---|---|
| `s2_cornice_view` | `s2_courthouse` | 2600 (`cornice_ledge`) | 160 | `ambient` | N18 | solved `e1_brown` | — | **P0** |
| `s2_negative_hint` | `s2_courthouse` | 2620 (`cornice_ledge`) | 200 | `ambient` | N09 | collected `neg_1` | — | P1 |
| `s1_front_pages` | `s1_morgue` | 3200 (ground) | 300 | `ambient` | N19 | flag `engine_awake` | cue `page_turn` | P1 |
| `s3_wire_view` | `s3_schoolhouse` | 1700 (`pole_crossarm`) | 120 | `ambient` | N21 | — | — | P1 |
| `s4_fire_escape_view` | `s4_main_street` | 2300 (`fire_escape_landing`) | 160 | `ambient` | N22 | — | — | P1 |
| `s5_mast_view` | `s5_church_mast` | 3620 (`mast_top`) | 120 | `ambient` | N20 | solved `e6_birmingham` | — | P1 |
| `s6_hall_arrival` | `s6_memorial` | 3050 (ground) | 240 | `arrival` | X06 | solved `e7_march` | — | P1 |
| `s8_darkroom_light` | `s8_stacks_vault` | 2500 (ground) | 300 | `ambient` | N10 | collected `neg_1`…`neg_5` | — | P1 |

All `once: true`. World-scoped lines are R8-checked as warnings against unsolved stations (none of these carries an
answer value).

### 6.4 NPCs (`npcs[]`) and quests (`quests[]`)

Every human NPC uses the rig (`look`, `asset: null`); names pass R10.

| Npc `id` · `name` | `speakerId` | `look` | States (`id`: `requires` → zone @ x, pose, lines, extras) | Tier |
|---|---|---|---|---|
| `ida` · Ida | `archivist` | `shared.char.ida` + `costume.ida_bun_glasses` (`head`), `costume.ida_cardigan` (`torso`) | `ida_desk`: — → `s1_morgue` @ 1180, `sit`, [N13], `repeatable` | **P0** |
| `otis` · Otis Pell | `otis` | `shared.char.otis` + `costume.otis_watch_cap` (`head`), `costume.otis_flashlight` (`hand_r`) | `otis_s1`: — → `s1_morgue` @ 560, `idle`, [N14], `repeatable`; `otis_s8`: solved `e10_sources` + collected `neg_1`…`neg_5` → `s8_stacks_vault` @ 2560, `talk`, [N11], `setFlag: darkroom_unlocked` | P0 (`otis_s1`), P1 (`otis_s8`) |
| `hattie` · Hattie Greer | `hattie` | `shared.char.hattie` + `costume.hattie_eyeshade` (`head`) | `hattie_s1`: — → `s1_morgue` @ 3000, `work`, [N15] (+ N12 at P2); `hattie_s8`: solved `e9_selma` → `s8_stacks_vault` @ 700, `idle`, [N03, N04] | P1 |
| `dolores` · Dolores Vance | `dolores` | `shared.char.dolores` + `costume.dolores_headset` (`head`) | `dolores_s6`: — → `s6_memorial` @ 700, `idle`, [N05, N06] | P1 |
| `theo` · Theo | `theo` | `shared.char.theo` + `costume.theo_cap` (`head`), `costume.theo_textbook` (`hand_l`) | `theo_spill`: — → `s8_stacks_vault` @ 1000, `think`, [N07]; `theo_after`: solved `e10_sources` → `s8_stacks_vault` @ 1100, `talk`, [N08] | P1 |

**Quests:**
```json
[ { "id": "theo_spill", "title": "Theo's Spill", "giverNpcId": "theo",
    "steps": [ { "kind": "talk", "npcId": "theo", "stateId": "theo_spill" },
               { "kind": "afterSeal", "encounterId": "e10_sources" },
               { "kind": "talk", "npcId": "theo", "stateId": "theo_after" } ],
    "reward": { "flag": "theo_corrected", "lines": ["N23"], "collectibleId": null, "cosmetic": null,
                "debriefLine": "You helped Theo see that a 1971 textbook is a later account: who made a source, and when, decides primary." } },
  { "id": "hattie_program", "title": "A Frame for the Program", "giverNpcId": "hattie",
    "steps": [ { "kind": "talk", "npcId": "hattie", "stateId": "hattie_s1" },
               { "kind": "afterSeal", "encounterId": "e7_march" },
               { "kind": "touch", "propIds": ["printed_program"] },
               { "kind": "talk", "npcId": "hattie", "stateId": "hattie_s8" } ],
    "reward": { "flag": "program_framed", "lines": ["N16"], "collectibleId": null, "cosmetic": null,
                "debriefLine": "You brought Hattie the March's printed program: organizers, marshals, and demands for jobs and freedom." } } ]
```
`theo_spill` is P1 (20 §0.1.3's civil quest); `hattie_program` is P2. Reward `lines` are full `WorldLine`s.

### 6.5 Lore: the Lost Negatives (P1) and plaques

**Lost Negatives** (`collectibles[]`, `kind: "negative"`, asset `archive_of_voices.prop.lost_negative`: a film strip
with sprocket holes, bob ±4 px, `wisp.indigo` halo). Each is reachable **only through geometry that a solved station
built** (every `requires.solved` below), so it can never leak an answer. Picking one up files a plate in the
Clipping Case (J). A `Collectible` cannot be a `document`, so (R10) no negative carries violent text: N3 and N5 quote
non-violent fixture lines instead of the Anniston and Bloody Sunday quotes (those two sit on `photo_withheld` and
`document` plaques).

| `id` | Zone @ x (surface) | `title` | `text` (fixture text only) | `sourceRef` | `conceptId` | `requires` |
|---|---|---|---|---|---|---|
| `neg_1` | `s2_courthouse` @ 2620 (`cornice_ledge`) | Negative: the courthouse, 1954 | "Plessy v. Ferguson (1896) had allowed segregation. In Brown v. Board of Education (1954) the Supreme Court ruled unanimously that separate educational facilities are inherently unequal." | e1 (p. 1) | `c_brown` | solved `e1_brown` |
| `neg_2` | `s2_courthouse` @ 5480 (`corner_awning`) | Negative: the bus stop, 1955 | "The boycott lasted 381 days and ended after the Supreme Court affirmed that bus segregation was unconstitutional." | e2 (p. 1) | `c_montgomery` | solved `e2_montgomery` |
| `neg_3` | `s4_main_street` @ 4000 (`rafters`) | Negative: the departures board, 1961 | "Integrated Freedom Riders board buses to test the ruling in the Deep South." | null (e5 node text) | `c_freedom_rides` | solved `e5_freedom_rides` |
| `neg_4` | `s5_church_mast` @ 3620 (`mast_top`) | Negative: the rose window, 1963 | "The images shocked the nation, and in June 1963 President Kennedy proposed a sweeping civil rights bill." | e6 (p. 2) | `c_birmingham` | solved `e6_birmingham` |
| `neg_5` | `s7_selma` @ 4600 (`riverside_ledge`) | Negative: the bridge at night, 1965 | "The Selma-to-Montgomery march reaches the Alabama capitol, March 25, 1965." | null (e9 step text) | `c_selma_vra` | solved `e9_selma` |

**Teaching twist** (P2, needs `JournalReader`): after e10, the Clipping Case stamps every plate **SECONDARY**: the
quotes come from a textbook chapter, a later account. The Case shows one line: "Every clipping in your satchel is
someone's later account. The primary sources are what they were written from."

**Plaques** (`plaques[]`; E reads them in document style with the `sourceRef` page line):

| `id` | Zone @ x (surface) | `asset` | `kind` | `title` | `text` | `requires` | Tier |
|---|---|---|---|---|---|---|---|
| `s2_courthouse_plaque` | `s2_courthouse` @ 1420 | `archive_of_voices.doc.plaque_bronze` | `plaque` | Brown v. Board of Education (1954) | the e1 `sourceRef` quote | solved `e1_brown` | **P0** |
| `s3_gatepost_plate` | `s3_schoolhouse` @ 2250 | `archive_of_voices.doc.document_plate` | `document` | Little Rock Nine (1957) | the e3 `sourceRef` quote | solved `e3_little_rock` | **P0** |
| `s4_withheld_anniston` | `s4_main_street` @ 3900 | `archive_of_voices.doc.photo_withheld` | `photo_withheld` | Anniston, Alabama (1961) | the e5 `sourceRef` quote | — | **P0** |
| `s7_far_bank_plate` | `s7_selma` @ 4400 | `archive_of_voices.doc.document_plate` | `document` | The Edmund Pettus Bridge, 1965 | the e9 `sourceRef` quote | solved `e9_selma` | **P0** |
| `s1_engine_plate` | `s1_morgue` @ 1700 (`engine_plinth`) | `archive_of_voices.doc.plaque_bronze` | `plaque` | The Record Engine | "Projects the Courier-Ledger's files, 1954 to 1965, as a city. It plays only records that agree with themselves." | — | P1 |
| `s6_hall_plaque` | `s6_memorial` @ 3400 (`hall_gallery`) | `archive_of_voices.doc.plaque_bronze` | `plaque` | The Civil Rights Act of 1964 | the e8 `sourceRef` quote | solved `e8_cra` | P1 |
| `s8_provenance_card` | `s8_stacks_vault` @ 1650 | `archive_of_voices.doc.document_plate` | `document` | Primary and Secondary Sources | the e10 `sourceRef` quote | solved `e10_sources` | P1 |

(The S7 plate's old title "MARCH 25, 1965" is replaced: its quote is about March 7, so the title now names the
bridge the quote names.)

### 6.6 The secret: the Editor's Darkroom (`sandboxes[0]`, P1)

- Holding all 5 negatives and opening the stacks (e10) activates Otis's S8 state (N11), which sets
  `darkroom_unlocked`; the red safelight over the **DARKROOM** door (prop `darkroom_door`, state `lit`) comes on and
  Ida says N10 (trigger `s8_darkroom_light`).
- Inside (a small red-lit set drawn by the sandbox prefab; the one place `safelight` is used): trays, a drying line,
  an enlarger. "Developing" is a non-graded token-tray interaction: drag each held negative into a tray and watch it
  bloom into a plate (20 §2.4b; no runner, no Verify, nothing reaches telemetry).
- The plates are five **respectful documentary compositions** (`archive_of_voices.doc.darkroom_plate_1…5`,
  `K:compose` from each zone's kit layers): empty courthouse steps, an empty bus stop, the terminal's departures board,
  the church's rose window, the Selma bridge at night. None of them show people or violence.

```json
{ "id": "darkroom", "zoneId": "s8_stacks_vault", "consoleX": 2620, "surface": "ground",
  "anchor": { "x": 2620, "y": 1400 }, "contraption": "darkroom", "skin": "darkroom_trays",
  "config": { "negatives": ["neg_1", "neg_2", "neg_3", "neg_4", "neg_5"], "trays": 3 },
  "title": "The Editor's Darkroom", "objectNoun": "developing trays",
  "requires": { "solved": null, "flag": "darkroom_unlocked", "notFlag": null, "collected": [] },
  "lines": { "open": ["N17"], "idle": [] },
  "goal": "all_developed",
  "reward": { "flag": "negatives_developed", "lines": ["O08"], "cosmetic": null,
              "debriefLine": "You developed the Editor's five negatives: empty places that once held the record." },
  "frameZoom": null }
```

W2 note: the Darkroom is S8's third non-walk verb at P1.

### 6.7 The wall of front pages (ambient progress)

In S1 the wall (`archive_of_voices.prop.front_pages_wall`, `K:shelving cork_frames`) holds 12 greyed pages whose
headlines are the encounters' **misconceptions**, each marked with a small "UNVERIFIED" slug so it never reads as
history. The same wall hangs on the S8 loading dock (prop id `front_pages_wall`, anchors `page_0…11`); by then Hattie's
press has reprinted each page with the encounter's `debriefLine` as the true headline (P1 `label_swap` effects,
§6.2). Walking past it on the dock is a review of everything restored. Headline text is DOM; the masthead "THE
COURIER-LEDGER" is engraved on `archive_of_voices.prop.front_page` (`K:plate front_page`).

### 6.8 Map and journal (P2)

- **Map: "The Record Line"** (M key, or click the objective ring; `story.map`):
  ```json
  { "style": "transit_line", "title": "The Record Line", "tabs": ["map", "journal", "mastery"],
    "nodes": [
      { "id": "n_s1", "label": "The Morgue",        "sub": "Tonight", "zoneId": "s1_morgue",       "stations": [],                                       "at": [0.06, 0.50] },
      { "id": "n_s2", "label": "Courthouse Square", "sub": "1954",    "zoneId": "s2_courthouse",   "stations": ["e1_brown", "e2_montgomery"],             "at": [0.18, 0.50] },
      { "id": "n_s3", "label": "Schoolhouse Hill",  "sub": "1957",    "zoneId": "s3_schoolhouse",  "stations": ["e3_little_rock"],                        "at": [0.30, 0.44] },
      { "id": "n_s4", "label": "Main Street",       "sub": "1960",    "zoneId": "s4_main_street",  "stations": ["e4_sit_ins", "e5_freedom_rides"],        "at": [0.42, 0.56] },
      { "id": "n_s5", "label": "Church Square",     "sub": "1963",    "zoneId": "s5_church_mast",  "stations": ["e6_birmingham"],                         "at": [0.54, 0.44] },
      { "id": "n_s6", "label": "Memorial Steps",    "sub": "1963",    "zoneId": "s6_memorial",     "stations": ["e7_march", "e8_cra"],                    "at": [0.66, 0.56] },
      { "id": "n_s7", "label": "Selma",             "sub": "1965",    "zoneId": "s7_selma",        "stations": ["e9_selma"],                              "at": [0.78, 0.44] },
      { "id": "n_s8", "label": "The Stacks",        "sub": "Tonight", "zoneId": "s8_stacks_vault", "stations": ["e10_sources", "e11_causation", "e12_boss"], "at": [0.92, 0.50] } ] }
  ```
  A mid-century streetcar line map: cream paper, a navy line, round station markers; restored stations filled cyan,
  the current one pulsing, unreached ones hollow; a white "you are here" pin (never orange). Lost-negative locations
  appear as hollow indigo dots once their zone is restored (a nudge, not a spoiler). **No fast travel**: the map is for
  orientation and review.
- **Journal: "The Clipping Case"** (J; `story.journal = {title: "Clipping Case", style: "clippings"}`): at P0 the
  journal is `MasteryHud` plus the collected list (20 §2.6); at P2 the `JournalReader` shows the negative plates, the
  printed program, and the **Contact Sheet** page (the 12 `debriefLine`s laid out as a contact sheet) once the Darkroom
  goal is met.

---

## 7 · Art asset list

- **Naming and paths (20 §5.1):** keys are `archive_of_voices.<group>.<name>` (groups `layer`, `ground`, `prop`, `part`,
  `costume`, `companion`, `fx`, `ui`, `vista`, `doc`); station parts are `archive_of_voices.part.<skin>_<slot>` (20
  §4.3 slots); characters are `shared.char.<id>` atlases. Sources live in `art/archive_of_voices/{biome.json, layers/,
  props/, parts/<skin>/, costume/, companion/, vista/}`; `pnpm art:build` writes
  `public/assets/expedition/archive_of_voices/<group>/<name>.svg`, the manifest, and
  `src/world/asset-index/archive_of_voices.generated.ts`. `archive-city` and every `cr.*` id are retired; each row keeps
  its old id in the **Was** column (and in `biome.json` as `legacyId`).
- **Sizes** are design sizes in world units at a 1080-px view (H ≈ 170). Textures rasterize at
  `rasterScale × min(devicePixelRatio, 1.5)` (layers ≤ 1, small parts and puppets 1.5, the vault socket 0.75).
- **Pivots are fractions** (`data-pivot="fx,fy"`): grounded art `0.5,1`; rotating parts at their hub. The revision-1
  pixel pivots convert by dividing by the design size (the arc-lamp head's (20, 55) of 140 × 110 is `0.14,0.5`).
- **Style for every SVG (hero or kit):** palette tokens only; at most 3 gradient stops per shape; `feGaussianBlur` is
  the only filter; lit faces upper left, shade right; no colour darker than `ink #2B3A44`; kit finish defaults (AO at
  the base, rim light, haze on far layers).
- **Text (amendment 21):** static, spec-independent wordmarks are `<text data-engrave>` converted to paths at build
  ("MAIN", "DAY", "TERMINAL", "DEPARTURES", "SIGNAL", "RETRACTED", "DARKROOM", "THE COURIER-LEDGER", "5-10-25¢" (DOM if
  the engraving font lacks ¢), the clock's Roman numerals). **Everything spec-derived is DOM** through
  `WorldLabelLayer`: slide slugs, tape, date chips, split-flap characters, headlines, plaque texts, cabinet and drawer
  labels (they come from the view's bin labels), tumbler engravings, "NOT WHAT HAPPENED".
- **Tags:** `H` hand-authored hero (counts toward the cap), `K:<generator>` 02 §3a kit entry, `atlas` recoloured rig
  (20 §5.5), `code`, `DOM`, `shared` (the shared namespace). **Tier** is when the entry must exist.

### 7.1 Sky (7 old rows: gradients are code; clouds are kit)
| Key (`archive_of_voices.` unless shown) | Was | Tag | Tier | Size | Description |
|---|---|---|---|---|---|
| `Segment.sky` (S2, S3) | `cr.sky.z1_afternoon` | code | P0 | 1920×1080 | 4-stop vertical gradient `#B9A3D6` → `#D9AFCF` (35 %) → `#E9B8C4` (65 %) → `#F6D9BE`. Two soft cloud bands of stacked white ellipses at 8–15 % alpha at y 18 % and 30 %. |
| `Segment.sky` (S4, S5) | `cr.sky.z2_dusk_rain` | code | P0 | 1920×1080 | gradient `#7F6BB8` → `#9E86D8` → `#B58FCB` → `#E8A9C3`; the top 25 % overlaid with a darker `#5E4F8E` @ 50 % band with a soft lower edge (rain clouds). |
| `Segment.sky` (S6, S7) + `archive_of_voices.layer.stars_z3` | `cr.sky.z3_bluehour` | code + K:scatter(glowSprite mote) | P0 (stars P1) | 1920×1080 | gradient `#3E3F74` → `#55508A` → `#6A5A9A` → `#C58BB0`; 40 tiny star dots (`#FBF1DE` @ 30–60 %) in the top third only. |
| `Segment.sky` (S1, S6 hall, S8) | `cr.sky.z4_interior` | code | P0 | 1920×1080 | warm vault gradient `#3B2F3E` → `#4E3C44` → `#5E4A4A`, behind interior back walls (seen through high windows and arches). |
| inside `archive_of_voices.vista.dawn` | `cr.sky.z5_dawn` | K:skyWash | P0 | 1920×1080 | gradient `#8FA8D8` → `#C7B7D8` → `#F2C6B8` → `#FBE7C8`, with a pale sun disc `#FFF4DC` (r 60) at 75 % x / 82 % y under a radial glow. |
| `archive_of_voices.layer.clouds_rain` | `cr.sky.clouds_rain` | K:cloudBand | P0 | 2400×400 | horizontally tileable rain-cloud band: 5 overlapping rounded masses in `#6B5C99` / `#7F6BB8`, soft bottom edge with a gradient to 0 alpha. |
| `archive_of_voices.layer.clouds_soft` | `cr.sky.clouds_soft` | K:cloudBand | P0 | 2400×300 | tileable fair-weather cloud streaks in white @ 12 %; long thin ellipses. |

### 7.2 L1 Far (5)
| Key (`archive_of_voices.` unless shown) | Was | Tag | Tier | Size | Description |
|---|---|---|---|---|---|
| `archive_of_voices.layer.far_city_south` | `cr.far.city_south` | K:skyline | P0 | 2400×560 | Tileable low-rise Southern skyline silhouette in a single fill `#6E5E93`: a water tower on 4 stilts (x 10 %), two church steeples (x 25 %, 48 %), a courthouse dome with cupola (x 38 %), flat-roofed commercial blocks, and the **Courier-Ledger tower** (x 70 %: 8 stories, 3 art-deco setbacks, 140 px wide). About 60 sparse window dots `#F6D27A` @ 60 %. A 40 % haze gradient toward the sky at the bottom. |
| `archive_of_voices.layer.far_city_industrial` | `cr.far.city_industrial` | K:skyline | P0 | 2400×560 | The Birmingham variant: the same kit plus 3 blast-furnace stacks and a long mill shed (no smoke) at x 55–80 %; the Courier-Ledger tower at x 20 % (the hub is always visible). |
| `archive_of_voices.layer.far_capital` | `cr.far.capital` | K:skyline | P0 | 2400×560 | Washington variant in `#3F3A6A`: a tall obelisk at x 35 % (thin tapering shaft, pyramidion), a domed capitol at x 78 % (drum, colonnade band, dome, lantern), tree masses, and the Courier-Ledger tower small at x 95 %. |
| `archive_of_voices.layer.far_river_bluffs` | `cr.far.river_bluffs` | K:ridgeBand bluff | P0 | 2400×480 | Selma variant: low river bluffs `#3F3A6A`, a pine-tree line of triangular tops, distant town rooftops and one steeple, and a tiny Courier-Ledger tower at x 90 %. |
| `archive_of_voices.prop.antenna_ring` | `cr.far.antenna_ring` | K:ringStack | P0 | 160×160 | Separate sprite for the Engine's antenna ring atop the tower: three concentric rings (outer 2 px gap-notched) in `brass.base`, placed on the tower top; tinted grey when dormant and cyan when restored, plus a glow sprite. |

### 7.3 L2 Mid-far (6)
| Key (`archive_of_voices.` unless shown) | Was | Tag | Tier | Size | Description |
|---|---|---|---|---|---|
| `archive_of_voices.layer.midfar_rowhouses` | `cr.midfar.rowhouses` | K:scatter(facade brick_row) | P0 | 2400×720 | Tileable two-story brick rowhouses with front porches (thin posts, shed roofs) and gable roofs; two-tone brick `#8E5A6A` / lit `#B07A86`; windows as dark `#4E3C5C` rectangles (light comes from a separate sprite). |
| `archive_of_voices.layer.midfar_commercial` | `cr.midfar.commercial` | K:scatter(facade commercial) | P0 | 2400×720 | Taller 3–4-story commercial blocks with rooftop water tanks, zig-zag fire escapes, and 3 painted wall signs as ghost-lettering shapes (neutral words: HARDWARE, FEED & SEED, RADIO), brick two-tone. |
| `archive_of_voices.fx.window_cluster` | `cr.midfar.window_cluster` | K:glowSprite | P1 | 120×80 | A lit window group (2 × 2 panes, `#F6D27A` → `#E9B864`, soft outer glow). Reused ~40× over L2, with per-instance alpha for the S5 "nation watching" wave. |
| `archive_of_voices.layer.midfar_oaks` | `cr.midfar.oaks` | K:scatter(canopy blob_tree) | P0 | 1200×600 | A mass of live oaks: lumpy canopy of 9–12 overlapping blobs, two-tone `oak.leaf` / hi, darker trunks `#4E3C44`. |
| `archive_of_voices.layer.midfar_autumn_trees` | `cr.midfar.autumn_trees` | K:scatter(canopy blob_tree) | P0 | 1200×600 | The same shapes tinted `autumn` / hi for Z1 scenes. |
| `archive_of_voices.layer.midfar_utility_poles` | `cr.midfar.utility_poles` | K:compose(column pole) | P0 | 2400×300 | Tileable wooden poles every 600 px with crossarms and glass insulators, plus 3 catenary wires (`#3E3550`, 1.5 px). |

### 7.4 L3 Mid backdrops (6)
| Key (`archive_of_voices.` unless shown) | Was | Tag | Tier | Size | Description |
|---|---|---|---|---|---|
| `archive_of_voices.layer.mid_storefronts_a` | `cr.mid.storefronts_a` | K:compose(facade storefront, awning) | P0 | 1920×820 | A row of 5 1950s storefronts: striped awnings (navy/cream, salmon/cream), transom windows, recessed doors, display windows with shelf shapes, neutral sign boards (BAKERY, SHOES, RADIO REPAIR); brick upper floors with sash windows. |
| `archive_of_voices.layer.mid_storefronts_b` | `cr.mid.storefronts_b` | K:compose(facade storefront, awning) | P0 | 1920×820 | Variant row: a diner with a curved corner, a pharmacy (DRUGS), a barber shop without a pole, a hotel entrance canopy. |
| `archive_of_voices.layer.mid_firescape_wall` | `cr.mid.firescape_wall` | K:facade brick_row (fireEscape) | P0 | 1200×900 | Brick wall with a two-level iron fire escape (navy-black `#2B3A44` lattice), drainpipe, and a lit upper window. |
| `archive_of_voices.layer.mid_marble_backwall` | `cr.mid.marble_backwall` | K:compose(ashlarWall, arch) | P0 | 1920×1000 | Filing Hall interior back wall: cream marble panels, fluted pilasters with navy capital bands, 3 tall arched windows showing `sky.z3_bluehour`, brass picture rail. |
| `archive_of_voices.layer.morgue_backwall` | `cr.mid.morgue_backwall` | K:compose(brickWall, arch) | P0 | 1920×1000 | Morgue interior: a brick barrel-vaulted basement wall, overhead pipes, silhouettes of shelving units, and high narrow windows at the top edge with rain streaks and passing car-light sweeps (animated separately). |
| `archive_of_voices.layer.mid_river` | `cr.mid.river` | K:waterBand | P0 | 2400×300 | Tileable river band: gradient `#3E4A78` → `#5E6FA0`, sine highlight strokes `#9FB3E0` @ 40 %, and lamp reflections as vertical streak ovals. |

### 7.5 L4 Ground strips (7)
| Key (`archive_of_voices.` unless shown) | Was | Tag | Tier | Size | Description |
|---|---|---|---|---|---|
| `archive_of_voices.ground.sidewalk` | `cr.ground.sidewalk` | K:groundStrip sidewalk | P0 | 512×200 | Tileable concrete slabs `#B9AFC6` with expansion joints every 128 px, a curb face `#8C829E`, and a wet sheen strip `#D2CBE0` @ 40 % near the curb. |
| `archive_of_voices.ground.street_wet` | `cr.ground.street_wet` | K:groundStrip sidewalk (wet) | P0 | 512×160 | Asphalt `#4A4F66` with 2 puddle ovals `#6D6F8C` (reflection masks) and a faded lane dash. |
| `archive_of_voices.ground.brick_plaza` | `cr.ground.brick_plaza` | K:groundStrip brick_plaza | P0 | 512×200 | Herringbone brick `#B5654F` / `#D08A6E` with a cream stone border course. |
| `archive_of_voices.ground.marble_floor` | `cr.ground.marble_floor` | K:groundStrip marble | P0 | 512×200 | Cream marble tiles with grey veining and a navy inlay border line. |
| `archive_of_voices.ground.morgue_floor` | `cr.ground.morgue_floor` | K:groundStrip wood_floor | P0 | 512×200 | Worn wood planks `#7A5A48` / `#96715A` with 2 water puddles (reflection masks). |
| `archive_of_voices.ground.bridge_deck` | `cr.ground.bridge_deck` | K:groundStrip causeway | P1 | 512×160 | Concrete deck with steel edge girder, rivets, and a low railing base. |
| `archive_of_voices.ground.grass_verge` | `cr.ground.grass_verge` | K:groundStrip | P1 | 512×120 | Teal grass strip (`grass.base` / `grass.light` blade tufts) for the park and hill. |

### 7.6 L5 Foreground (8)
| Key (`archive_of_voices.` unless shown) | Was | Tag | Tier | Size | Description |
|---|---|---|---|---|---|
| `archive_of_voices.layer.fore_railing` | `cr.fg.railing` | K:railing wrought_iron | P0 | 960×260 | Wet wrought-iron railing: square balusters, navy-black cap rail, glints `#9FB3E0` on the tops. |
| `archive_of_voices.prop.parking_meter` | `cr.fg.parking_meter` | K:column | P0 | 90×260 | 1950s single parking meter: dome head, glass window, post. |
| `archive_of_voices.prop.hydrant` | `cr.fg.hydrant` | K:column | P1 | 110×150 | Fire hydrant in faded cream-teal with a wet highlight. |
| `archive_of_voices.prop.newspaper_bundle` | `cr.fg.newspaper_bundle` | K:plate | P0 | 180×110 | Twine-tied stack of newspapers; the top sheet shows unreadable headline bars. |
| `archive_of_voices.prop.bench` | `cr.fg.bench` | K:compose(plate, column) | P0 | 420×180 | Park bench: slatted wood with cast-iron ends. |
| `archive_of_voices.prop.lamppost` | `cr.fg.lamppost_base` | K:column lamp_post | P0 | 140×420 | Fluted cast-iron lamppost base and lower shaft (the lamp head is L4). |
| `archive_of_voices.layer.fore_magnolia` | `cr.fg.magnolia` | K:scatter(canopy magnolia) | P0 | 600×320 | A cluster of glossy magnolia leaves `magnolia` with lighter midribs; one closed cream bud. |
| `archive_of_voices.layer.fore_stanchions` | `cr.fg.stanchions` | K:railing rope_stanchion | P0 | 480×200 | Interior brass stanchions with a velvet rope (navy), for the Morgue and Filing Hall. |

### 7.7 L6 Light and overlays (8)
| Key (`archive_of_voices.` unless shown) | Was | Tag | Tier | Size | Description |
|---|---|---|---|---|---|
| `archive_of_voices.fx.rain_streak` | `cr.light.rain_streak` | K:glowSprite | P0 | 8×64 | Particle: a thin white line with a gradient tail, 35 % alpha. |
| `archive_of_voices.fx.splash_ring` | `cr.light.splash_ring` | K:glowSprite ring_pop | P0 | 48×16 | Particle: a flattened ellipse ring. |
| `archive_of_voices.fx.lamp_glow` | `cr.light.lamp_glow` | K:glowSprite radial | P0 | 256×256 | Radial `#F6D27A` (70 %) → 0, for ADD blending. |
| `archive_of_voices.fx.projector_cone` | `cr.light.projector_cone` | K:glowSprite cone | P0 | 512×256 | Trapezoid, narrow end left, `recordlight` 35 % → 0 along its length, soft edges. |
| `archive_of_voices.fx.beam_glow` | `cr.light.beam_glow` | K:glowSprite radial | P0 | 64×64 | Radial `#C9F3FF` core → `#6ED2F2` → 0 (beam endcaps, lens glints). |
| `archive_of_voices.fx.blinds_shadow` | `cr.light.blinds_shadow` | K:grainTile blinds | P0 | 1920×1080 | Venetian-blind shadow stripes (12 diagonal bands), used at 20 % multiply in interiors. |
| `shared.fx.grain` | `cr.light.film_grain` | shared | P0 | 512×512 | Tileable monochrome noise, used at 6 % overlay. |
| `archive_of_voices.fx.scanlines` | `cr.light.scanlines` | K:grainTile scanlines | P0 | 4×8 | 2 px on / 2 px off tile for dormant projections. |

### 7.8 Landmarks, set pieces and station parts (97)
| Key (`archive_of_voices.` unless shown) | Was | Tag | Tier | Size | Description |
|---|---|---|---|---|---|
| `archive_of_voices.prop.record_engine` (hub; plinth + lens sockets) | `cr.set.engine_plinth` | K:compose(stairs stepped_plinth, ringStack) | P0 | 1000×240 | Record Engine base: 3 stepped cream-stone tiers (`stone.lit` faces, `stone.shade` risers), a navy inlay band along the top tier, gold trim lines, 3 round brass access hatches. |
| `archive_of_voices.prop.engine_ring_outer` | `cr.set.engine_ring_outer` | K:ringStack | P0 | 860×860 | Outer brass ring 60 px thick: gold rim highlight inside and out, 24 rivets, a notch at 12 o'clock. Pivot at the centre. |
| `archive_of_voices.prop.engine_ring_mid` | `cr.set.engine_ring_mid` | K:ringStack | P0 | 660×660 | Middle ring in cream stone with a navy groove line; tick marks every 15°. Pivot at the centre. |
| `archive_of_voices.prop.engine_ring_inner` | `cr.set.engine_ring_inner` | K:ringStack | P0 | 480×480 | Inner brass ring with **12 lens sockets** at 30° steps (dark recesses, r 32); acts marked by 4 small gold chevrons. Pivot at the centre. |
| `archive_of_voices.prop.engine_lens` | `cr.set.engine_lens` | K:ringStack | P0 | 80×80 | Lens: brass bezel with 6 screws and a glass disc (a radial gradient); tinted dormant grey `#8E8AA0` or lit `recordlight`. |
| `archive_of_voices.prop.engine_drum` | `cr.set.engine_drum` | H | P0 | 300×300 | Central projector drum: a brass cylinder face with an **iris aperture** of 8 overlapping blades (the blades are a separate asset). |
| in `archive_of_voices.prop.engine_drum` | `cr.set.engine_iris_blade` | H (same file) | P0 | 120×60 | One iris blade (brass, curved); 8 instances rotate to open or close. |
| `archive_of_voices.prop.engine_crown` | `cr.set.engine_crown_l` | H | P0 | 210×260 | Left half of the split gold crown fin (bible gate fin): tall and tapered, gold with a navy centre line. |
| `archive_of_voices.prop.engine_crown` (flipX) | `cr.set.engine_crown_r` | H (same file) | P0 | 210×260 | Mirror of the left half. |
| `archive_of_voices.prop.main_breaker` | `cr.set.main_breaker` | H | P0 | 120×220 | Wall breaker box: grey-green steel, stencilled "MAIN", with a lever slot. |
| in `archive_of_voices.prop.main_breaker` | `cr.set.breaker_lever` | H (same file) | P0 | 40×90 | Breaker lever with a red-brown handle (pivot at the bottom). |
| `archive_of_voices.prop.basement_stair` | `cr.set.basement_stair` | K:compose(stairs iron, railing) | P0 | 700×600 | Curving iron stair down from a street door, with a handrail and rainwater sheen. |
| `archive_of_voices.prop.reading_desk` | `cr.set.reading_desk` | H | P0 | 480×260 | Ida's oak desk: green banker's lamp, card catalog drawers, a stack of reels, a magnifier. |
| `archive_of_voices.prop.proof_press` | `cr.set.proof_press` | H | P0 | 520×420 | Flatbed proof press: iron frame, big roller with a crank wheel, ink disc, type bed with galley. |
| `archive_of_voices.prop.front_pages_wall` | `cr.set.front_pages_wall` | K:shelving cork_frames | P0 (swaps P1) | 1400×700 | Corkboard wall with 12 frame slots (4 × 3) and brass picture lights above each column. |
| `archive_of_voices.prop.front_page` | `cr.set.front_page` | K:plate front_page | P1 | 200×260 | Newspaper front page template: masthead "THE COURIER-LEDGER" as engraved text (fictional paper), 5 column bars, a photo box; the headline is DOM. Grey variant via tint. |
| `archive_of_voices.prop.darkroom_door` | `cr.set.darkroom_door` | K:compose(arch, plate) | P0 (S1 decor), P1 (S8) | 320×620 | Wooden door with a "DARKROOM" stencil and a red safelight box above (a separate glow sprite); latch. |
| `archive_of_voices.part.provenance_drawers_compact_shelving` | `cr.set.stack_unit` | K:shelving compact_stack | P0 | 420×900 | Compact shelving unit: steel end panel (cream enamel) with a 3-spoke crank wheel (separate asset); shelves of archive boxes and film cans. |
| `archive_of_voices.part.provenance_drawers_crank` | `cr.set.stack_crank` | K:ringStack | P0 | 90×90 | 3-spoke crank wheel with a handle (pivot at the centre). |
| `archive_of_voices.prop.rolling_ladder` | `cr.set.rolling_ladder` | K:stairs ladder | P0 | 180×800 | Library rolling ladder: oak rails, rungs, brass top hook and wheels. |
| `archive_of_voices.part.big_board_board_wall` | `cr.set.big_board` | K:compose (1100 × 520) | P0 | 1920×900 | Big Board wall: brass panel field with 7 round canister mounts in a loose ring, engraved tube channels between them, rivets, and a capsule launcher at the lower left. |
| `archive_of_voices.part.big_board_canister` | `cr.set.canister` | H | P0 | 110×170 | Pneumatic canister: brass bands, glass body showing a card window, domed lid (lid separate), top lamp. |
| in `archive_of_voices.part.big_board_canister` | `cr.set.canister_lid` | H (same file) | P0 | 110×40 | Domed brass lid (pivot at the left hinge). |
| (tubes are code-drawn) | `cr.set.tube_segment` | code | P0 | 64×24 | Tileable brass tube with a glass window strip. |
| `archive_of_voices.prop.vault_socket` | `cr.set.vault_socket` | K:ringStack (rasterScale 0.75) | P0 | 1300×1300 | Round cream-stone recess with 24 radiating navy grooves and a gold ring lip; the dark interior shows around the door's edge. |
| `archive_of_voices.part.tumbler_vault_vault_door` | `cr.set.vault_door` | H | P0 | 1000×1000 | Door leaf: 3 concentric bands (brass / cream / brass), 4 tumbler windows at 12, 3, 6 and 9, rivet rings, and a central hub boss. Pivot at the hinge side for the swing. |
| `archive_of_voices.part.tumbler_vault_tumbler` | `cr.set.vault_tumbler` | H | P0 | 180×180 | Tumbler wheel: knurled brass rim, cream engraved band (text DOM), groove notch, lamp bead. Pivot at the centre. |
| `archive_of_voices.part.tumbler_vault_bolt` | `cr.set.vault_bolt` | K:plate | P0 | 220×60 | Polished steel bolt with a brass collar (slides on x). |
| `archive_of_voices.part.tumbler_vault_handwheel` | `cr.set.vault_handwheel` | K:ringStack | P0 | 300×300 | 6-spoke brass handwheel with a navy hub. Pivot at the centre. |
| `archive_of_voices.part.tumbler_vault_voice_grille` | `cr.set.voice_grille` | K:ringStack | P0 | 200×200 | Circular brass grille: concentric slots, a small type-slug "E" emblem at the centre; the glow is a separate sprite. |
| `archive_of_voices.part.tumbler_vault_press_organ` | `cr.set.press_organ` | H | P0 | 1400×1000 | The Editor's press-organ: brass organ-pipe ranks rising behind a large printing press (type cases as wooden grids, a giant roller, paper outfeed); cream and navy detailing. |
| `archive_of_voices.prop.courthouse` | `cr.set.courthouse` | H | P0 | 1500×1000 | Greek-revival courthouse: 6 fluted columns (`stone.lit` with a shade strip on the right), entablature with a navy inlay band, pediment with a round clock recess, 3 pale projection panels (220×300) between the centre columns, doors. **Without steps.** |
| `archive_of_voices.prop.courthouse_clock` | `cr.set.courthouse_clock` | K:ringStack (engraved numerals) | P0 | 180×180 | Clock face: cream enamel, brass bezel, Roman numerals engraved at build time (text-to-path). |
| in `archive_of_voices.prop.courthouse_clock` | `cr.set.clock_hand_hour` | K:gauge needle | P0 | 20×70 | Hour hand in navy (pivot at the base). |
| in `archive_of_voices.prop.courthouse_clock` | `cr.set.clock_hand_min` | K:gauge needle | P0 | 14×90 | Minute hand in navy (pivot at the base). |
| `archive_of_voices.part.witness_projector_steps` | `cr.set.courthouse_steps` | K:stairs stone | P0 | 1100×260 | 7 wide steps in cream stone with gold nosing lines, cheek walls either side. |
| `archive_of_voices.doc.plaque_bronze` | `cr.set.courthouse_plaque` | K:plate brass_plaque | P0 | 160×110 | Bronze plaque with a raised border (the text is DOM). |
| `archive_of_voices.part.walking_road_bus_stop` | `cr.set.bus_shelter` | K:compose(awning, column, plate) | P0 | 520×420 | 1950s bus stop: cream curved canopy on navy posts, bench, route sign blade. |
| `archive_of_voices.part.walking_road_day_counter` | `cr.set.day_counter` | K:plate ("DAY" engraved; digits DOM) | P0 | 180×240 | Flip-number board on a post: "DAY" header, 3 flap windows (digits by code). |
| `archive_of_voices.part.walking_road_city_bus` | `cr.set.city_bus` | H | P0 | 980×400 | 1950s transit bus: rounded nose, cream-over-teal two-tone, chrome bumper, 7 side windows (dark, **empty**), blank destination blind. |
| `archive_of_voices.fx.bus_lights` | `cr.set.bus_lights` | K:glowSprite | P0 | 980×400 | Overlay: warm window glows plus headlight cones (ADD). |
| `archive_of_voices.part.walking_road_flood_band` (+ prop.flood_band) | `cr.set.flood_band` | K:waterBand flood | P0 | 1200×160 | Floodwater strip: murky violet gradient, floating paper scraps, ripples; tileable. |
| `archive_of_voices.part.walking_road_slab` | `cr.set.walk_slab` | K:plate slab | P0 | 260×60 | Concrete slab with an engraved border (text DOM); wireframe and solid states via tint + scanline mask. |
| `archive_of_voices.prop.schoolhouse` | `cr.set.schoolhouse` | H | P0 | 1700×1050 | Collegiate-gothic high school: tan brick `#C49A7A`, cream stone trim, a central tower with 4 tall arched windows and crenellation, symmetric wings, a wide stair base. Doors are a separate asset. |
| `archive_of_voices.prop.school_doors` | `cr.set.school_doors` | K:compose(arch, plate) | P0 | 260×340 | Tall double doors under a stone arch; open state via 2 leaves (the right leaf is a separate asset). |
| in `archive_of_voices.prop.school_doors` | `cr.set.school_door_leaf` | K | P0 | 130×340 | One door leaf (pivot at the hinge). |
| `archive_of_voices.part.wire_ticker_school_barrier` | `cr.set.barrier_projection` | K:compose(plate) | P0 | 420×300 | Abstract barrier: 7 vertical translucent grey-lavender bars (`dormant`) with scanlines. **No figures.** |
| `archive_of_voices.part.wire_ticker_walk_lamp` | `cr.set.walk_lamp` | K:column lamp_post | P0 | 60×220 | Short cast-iron walk lamp with a globe (the glow is separate). |
| `archive_of_voices.part.wire_ticker_kiosk` | `cr.set.newsstand` | K:facade kiosk | P0 | 560×460 | Kiosk: navy wood, striped awning, magazine racks with abstract cover shapes, a counter opening. |
| `archive_of_voices.part.wire_ticker_teletype` | `cr.set.teletype` | H | P0 | 260×300 | Teletype machine: cream-green enamel body, keyboard, paper platen. |
| in `archive_of_voices.part.wire_ticker_teletype` (tape text DOM) | `cr.set.teletype_paper` | H (same file) | P0 | 120×400 | Paper roll and tape feeding up (the printed text is DOM). |
| `archive_of_voices.part.wire_ticker_selector` | `cr.set.selector_plate` | H | P0 | 180×200 | Brass rotary dial plate on a small lectern: engraved A/B/C at −40°/0°/+40°. |
| in `archive_of_voices.part.wire_ticker_selector` | `cr.set.selector_knob` | H (same file) | P0 | 70×70 | Pointer knob with a navy grip and a brass pointer (pivot at the centre). |
| `archive_of_voices.part.wire_ticker_telegraph_pole` | `cr.set.telegraph_pole` | K:column pole | P0 | 120×900 | Wooden pole with 2 crossarms and glass insulators. |
| `archive_of_voices.prop.dimestore_facade` | `cr.set.dimestore` | H | P0 | 1400×950 | Five-and-dime exterior: big "5-10-25¢" sign board (cream on salmon), display windows, recessed double door, brick upper floor. |
| `archive_of_voices.prop.lunch_counter` | `cr.set.lunch_counter` | K:compose(plate, groundStrip) | P0 | 1500×320 | Counter: cream laminate top, chrome edge, navy front panel with a chrome kick strip. |
| `archive_of_voices.prop.counter_stool` | `cr.set.counter_stool` | H | P0 | 90×170 | Chrome pedestal stool with a teal vinyl seat. Reused ×12; the underglow is `light.lamp_glow` tinted. |
| `archive_of_voices.part.witness_projector_menu_board` | `cr.set.menu_board` | K:plate | P0 | 900×360 | Three-panel menu board: navy frame, brass corners; panels as pale projection surfaces. |
| `archive_of_voices.part.witness_projector_pendant_lamp` | `cr.set.pendant_lamp` | H | P0 | 160×300 | Swivel pendant: ceiling rose, cord, green enamel shade (the head is separate). |
| in `archive_of_voices.part.witness_projector_pendant_lamp` | `cr.set.pendant_head` | H (same file) | P0 | 140×110 | Enamel shade with a bulb (pivot at the cord top). |
| `archive_of_voices.prop.pie_case` | `cr.set.pie_case` | K:compose(plate) | P1 | 260×220 | Domed glass pie case on a stand with 2 pie shapes. |
| `archive_of_voices.prop.swing_door` | `cr.set.swing_door` | K:plate | P0 | 200×320 | Kitchen swing door with a round porthole window (pivot at the hinge). |
| `archive_of_voices.prop.terminal_facade` | `cr.set.terminal` | H | P0 | 1900×950 | Streamline-moderne coach terminal: curved corner, 3 horizontal chrome speed bands, a vertical fin sign "TERMINAL", glass-block windows, cream stucco with navy trim. |
| `archive_of_voices.part.relay_line_departures_board` | `cr.set.departure_board` | K:shelving (flip grid) | P0 | 720×300 | Split-flap departures board: black-navy housing, 6 rows × 20 flap cells, header "DEPARTURES". |
| `archive_of_voices.part.relay_line_split_flap` | `cr.set.split_flap` | K:plate flip_cell (characters DOM) | P0 | 36×52 | One flap cell (the character is DOM). |
| `archive_of_voices.part.relay_line_junction_box` | `cr.set.junction_box` | K:plate (screen) | P0 | 150×190 | Brass relay junction box: a glass card window, top lamp, input terminal (top) and output terminal (bottom), fuse holder. |
| `archive_of_voices.prop.canopy_rail` | `cr.set.canopy_rail` | K:truss gantry | P0 | 1920×80 | Platform canopy edge: steel with insulator mounts every 200 px; tileable. |
| `archive_of_voices.part.relay_line_divider_rail` | `cr.set.divider_rail` | K:railing brass_rail | P0 | 700×120 | Brass waiting-room divider rail on posts (it lifts away on the e5 success). |
| `archive_of_voices.part.relay_line_rolling_gate` | `cr.set.rolling_gate` | K:railing | P0 | 620×420 | Corrugated steel rolling gate (tileable slats) with a roll housing on top. |
| `archive_of_voices.doc.photo_withheld` | `cr.set.photo_withheld` | K:compose(plate, glowSprite) | P0 | 260×200 | Framed photo plate: sepia soft blur (no forms), a small camera glyph, a caption strip (text DOM). |
| `archive_of_voices.prop.church` | `cr.set.church` | H | P0 | 1300×1400 | Brick church: twin square towers with pyramidal caps, a central **rose window** (tracery of 12 petals around a circle), 3 arched doors, wide steps. |
| `archive_of_voices.prop.rose_window_glow` | `cr.set.rose_window_glow` | K:ringStack + glowSprite | P0 | 300×300 | Lit rose window overlay (warm amber and teal glass). |
| `archive_of_voices.prop.bandstand` | `cr.set.bandstand` | K:compose(column, arch, railing) | P1 | 720×520 | Octagonal bandstand: cream posts, navy roof with a finial, a railing. |
| `archive_of_voices.part.broadcast_relay_mast` | `cr.set.broadcast_mast` | K:truss lattice_mast | P0 | 460×1700 | Lattice steel mast (`steel`) with 5 relay platforms, salmon aviation beacons, a service ladder, a lift rail. |
| `archive_of_voices.part.broadcast_relay_relay_dish` (station body K:plate) | `cr.set.relay_station` | H | P0 | 170×150 | Relay station: a small dish (pivot at the centre, separate asset), an insulator bank, a card window, a lamp. |
| in `archive_of_voices.part.broadcast_relay_relay_dish` | `cr.set.relay_dish` | H (same file) | P0 | 90×90 | Parabolic dish with a feed horn (pivot at the centre). |
| `archive_of_voices.part.broadcast_relay_lift_cage` | `cr.set.lift_cage` | K:truss cage | P0 | 180×240 | Service lift cage: steel lattice, a floor plate, a lamp. |
| `archive_of_voices.prop.memorial_colonnade` | `cr.set.memorial` | H | P0 | 1900×900 | Neoclassical memorial: 12 columns, an attic band with a navy inlay line, a warm interior glow and **no statue**; cream stone. |
| `archive_of_voices.part.switchboard_steps` (slot to add, Appendix A.2) | `cr.set.memorial_steps` | K:stairs marble_landing | P0 | 1300×300 | Broad memorial steps in cream stone with landings (4 step-lamp mounts). |
| `archive_of_voices.prop.reflecting_pool` | `cr.set.reflecting_pool` | K:waterBand pool | P0 | 1900×140 | Long pool: a stone lip plus a water surface (the reflection is done by code). |
| `archive_of_voices.part.switchboard_switchboard_cabinet` | `cr.set.switchboard` | H | P0 | 520×420 | Cord switchboard: wooden cabinet, a brass jack field (4 left + 5 right jacks with card holders), a lamp row above, a keyshelf. |
| `archive_of_voices.part.switchboard_jack` | `cr.set.jack_lamp` | K:ringStack | P0 | 24×24 | Jack lamp bead (tinted white / cyan / amber). |
| `archive_of_voices.part.switchboard_plug` | `cr.set.patch_plug` | K:linkStrip rod | P0 | 26×60 | Brass patch plug with a cream sleeve (cord segments are drawn by code). |
| `archive_of_voices.part.switchboard_program_sheet` | `cr.set.program_sheet` | K:plate paper_card | P0 | 300×420 | Printed program document: title band, 5 rule lines, a margin (text DOM). |
| `archive_of_voices.part.filing_cabinets_cabinet` | `cr.set.filing_cabinet` | K:shelving | P0 | 440×920 | Tall oak filing cabinet with brass trim, a label plate slot, a **feature plate** under the label, 4 drawers (the top drawer is a separate asset), floor-rail wheels. |
| `archive_of_voices.part.filing_cabinets_drawer` | `cr.set.filing_drawer` | K:plate | P0 | 380×160 | Drawer front with a brass pull and a card slot (slides on x/y). |
| `archive_of_voices.part.filing_cabinets_shutter` | `cr.set.feature_shutter` | K:plate | P0 | 300×60 | Brass shutter strip (it slides up to reveal the feature plate). |
| `archive_of_voices.part.filing_cabinets_meter` | `cr.set.signal_meter` | K:gauge arc_meter | P0 | 220×160 | VU-meter face: cream dial, black-navy scale arc, "SIGNAL" legend. |
| in `archive_of_voices.part.filing_cabinets_meter` | `cr.set.meter_needle` | K:gauge (needle) | P0 | 8×90 | Needle (pivot at the base). |
| `archive_of_voices.part.filing_cabinets_pneumatic_drop` | `cr.set.pneumatic_drop` | K:linkStrip pipe | P0 | 260×520 | Brass delivery tube descending from the ceiling to a wire basket tray. |
| `archive_of_voices.part.filing_cabinets_slip` | `cr.set.provision_slip` | K:plate paper_card | P0 | 180×110 | Paper slip with a typed-line texture (text DOM). |
| `archive_of_voices.prop.floor_rail` | `cr.set.floor_rail` | K:linkStrip rail | P0 | 900×40 | Recessed steel floor rail. |
| `archive_of_voices.part.timeline_bridge_arch_bridge` | `cr.set.bridge` | H | P0 | 2400×900 | Steel through-arch bridge: the arch truss lattice in `steel`, 2 piers, lamp standards, a deck **with 4 empty bays at the crown**, and a railing. |
| `archive_of_voices.part.timeline_bridge_deck_section` | `cr.set.bridge_plank` | K:plate slab | P0 | 300×70 | Deck section: concrete top, steel edge girder, rivets (the date chip is DOM). A short variant is used for the decoy (`scaleX 0.8`). |
| `archive_of_voices.part.timeline_bridge_bay_lamp` | `cr.set.bay_lamp` | K:column lamp_post | P0 | 50×160 | Bridge stanchion lamp (the globe glow is separate). |
| `archive_of_voices.part.timeline_bridge_lectern` | `cr.set.surveyor_console` | K:lectern transit | P0 | 200×240 | Brass lectern shaped like a surveyor's transit: tripod base, a telescope element, a glowing slate. |
| `archive_of_voices.part.timeline_bridge_streetcar` | `cr.set.streetcar` | H | P0 | 900×380 | 1950s streetcar: cream/teal, a trolley pole, windows (lit, **empty**). |

### 7.9 Shared station parts and FX (16)
| Key (`archive_of_voices.` unless shown) | Was | Tag | Tier | Size | Description |
|---|---|---|---|---|---|
| `archive_of_voices.part.witness_projector_arc_lamp` | `cr.part.proof_lamp_stand` | H | P0 | 120×260 | Arc lamp stand: brass tripod, a vertical post, a yoke. |
| in `archive_of_voices.part.witness_projector_arc_lamp` | `cr.part.proof_lamp_head` | H (same file) | P0 | 140×110 | Arc lamp head: a barrel housing with a front lens and cooling fins (pivot at 20,55). |
| `archive_of_voices.part.witness_projector_witness_lens` | `cr.part.witness_lens` | K:compose(plate, ringStack) | P0 | 110×200 | Lantern-slide projector on a tripod: a boxy brass body, bellows, a front lens. |
| `archive_of_voices.part.witness_projector_projection_panel` | `cr.part.slide_frame` | K:plate slide_mat | P0 | 240×320 | Projected slide frame: bevelled cream mat with brass corners (the slug text is DOM). |
| `archive_of_voices.part.record_rail` | `cr.part.record_rail` | K:linkStrip rail | P0 | 1920×40 | Tileable riveted brass rail with hanger brackets. |
| `archive_of_voices.part.lens_carriage` | `cr.part.lens_carriage` | H | P0 | 160×140 | Record Lens carriage: 4 wheels on top, a brass body, a hanging lens barrel angled down (pivot at the top). |
| `archive_of_voices.prop.console_reader` | `cr.part.console_reader` | K:lectern microfilm | P0 | 190×210 | History console (0.7 H): a microfilm-reader lectern with a hooded glowing screen showing a tiny timeline graphic, and a brass reel on the side. |
| `shared.ui.pin` | `cr.part.map_pin` | shared | P0 | 90×120 | Teardrop map pin: dark teal fill `#0F2A33`, white 3 px stroke, white chevron below (text DOM). |
| (WorldLabelLayer interact diamond) | `cr.part.interact_glyph` | DOM | P0 | 64×64 | Diamond with inner lines (bible 4.png), white @ 80 %. |
| `archive_of_voices.part.big_board_capsule` | `cr.part.capsule` | K:plate | P0 | 60×30 | Pneumatic capsule: brass end caps and a glass body. |
| `shared.fx.spark` | `cr.part.spark` | shared | P0 | 32×32 | Four-point spark star in `#F6D27A`. |
| `shared.fx.puff` | `cr.part.puff` | shared | P0 | 96×64 | Soft grey-lavender puff (dust, fuse, air jam). |
| `archive_of_voices.fx.paper_scrap` | `cr.part.paper_scrap` | K:plate | P0 | 24×16 | A small torn paper scrap, cyan-tinted for record scraps. |
| `archive_of_voices.fx.steam` | `cr.part.steam` | K:glowSprite puff | P1 | 128×128 | Soft steam blob. |
| `archive_of_voices.fx.moth` | `cr.part.moth` | K:glowSprite mote | P2 | 16×12 | Moth silhouette (2 frames via scaleY flip). |
| `archive_of_voices.prop.lost_negative` | `cr.part.lost_negative` | K:compose(plate, glowSprite) | P1 | 90×40 | Film negative strip with sprocket holes and 3 amber-inverted frames; indigo halo is `light.beam_glow` tinted `wisp.indigo`. |

### 7.10 Characters (11 old rows → 6 atlases + 10 costume overlays + 1 puppet)
| Key (`archive_of_voices.` unless shown) | Was | Tag | Tier | Size | Description |
|---|---|---|---|---|---|
| `shared.char.nell` | `cr.char.nell_frames` | atlas (female_adventurer) | P0 | 96×128 (HD 192×256) | The one Kenney `toon-characters` rig, body **Female adventurer**, recoloured at build time to Nell's palette (§3.1) from `Vector/character_femaleAdventurer.svg` and packed as an HD atlas: 28 frames shipped (02 §3b.1), per-frame costume anchors computed from the rig (02 §3b.3). No tinting. |
| `archive_of_voices.costume.nell_satchel` | `cr.char.nell_satchel` | H | P0 | 60×70 | Leather satchel `#8A5A3C` with its strap across the body; anchor `torso` (per-frame anchors from the rig). |
| `archive_of_voices.costume.nell_scarf` | `cr.char.nell_scarf` | H | P0 | 70×50 | Salmon scarf `#E48C5E` with 2 trailing tails; anchor `back`, `follow: spring` (the tails lag behind motion), `layer: behind`. |
| `shared.char.ida` | `cr.char.ida_frames` | atlas (female_person) | P0 | 96×128 | Rig body **Female person**, recoloured to Ida's palette (§3.2): deep brown skin `#6B4330`, silver hair, teal cardigan. Poses used: `idle, talk, think, show, interact, walk0–7`. |
| `archive_of_voices.costume.ida_bun_glasses` + `archive_of_voices.costume.ida_cardigan` | `cr.char.ida_overlay` | H ×2 | P0 | 96×128 | Two overlays: `ida_bun_glasses` (silver low bun, cat-eye glasses on a bead chain; anchor `head`) and `ida_cardigan` (long teal cardigan hem; anchor `torso`). |
| `archive_of_voices.companion.wick` | `cr.char.wick_body` | H (puppet) | P0 | 44×64 | Brass hurricane lantern: a ring handle, glass chimney, flame core (the glow is separate). |
| in `archive_of_voices.companion.wick` | `cr.char.wick_wing` | H (same file) | P0 | 40×30 | Paper moth-wing fin, cream with faint brown veins (mirrored for the second wing; pivot at the root). |
| `shared.char.otis` + `archive_of_voices.costume.otis_watch_cap` + `archive_of_voices.costume.otis_flashlight` | `cr.char.otis` | atlas (male_person) + H ×2 | P0 | 96×128 | Rig body **Male person** recoloured (grey cardigan) + overlays: watch cap (`head`) and flashlight (`hand_r`; its cone is `fx.projector_cone` tinted `lamp`). |
| `shared.char.hattie` + `archive_of_voices.costume.hattie_eyeshade` | `cr.char.hattie` | atlas (female_person) + H | P1 | 96×128 | Rig body **Female person** recoloured (ink apron, sleeve garters) + overlay: green eyeshade visor (`head`). |
| `shared.char.dolores` + `archive_of_voices.costume.dolores_headset` | `cr.char.dolores` | atlas (female_person) + H | P1 | 96×128 | Rig body **Female person** recoloured (cardigan, pencil in hair) + overlay: headset around the neck (`head`). |
| `shared.char.theo` + `archive_of_voices.costume.theo_cap` + `archive_of_voices.costume.theo_textbook` | `cr.char.theo` | atlas (male_person) + H ×2 | P1 | 96×128 | Rig body **Male person** recoloured (backpack) + overlays: school cap (`head`) and the aged textbook prop (`hand_l`). |

(The 46 per-pose Kenney PNGs of revision 1 are gone: each human is one recoloured atlas built by `pnpm chars:build` from the pack's `Vector/character_*.svg` (20 §5.5, 02 §3b). Nell is P0 at 28 frames; the NPC atlases pack the poses the host uses.)

### 7.11 UI (22 old rows: most are now DOM or data)
| Key (`archive_of_voices.` unless shown) | Was | Tag | Tier | Size | Description |
|---|---|---|---|---|---|
| `shared.ui.hex_tile` | `cr.ui.hex_tile` | shared (CSS) | P0 | 88×76 | Flat-top hexagon outline tile, 1 px `rgba(120,190,205,0.14)`, seamless (bible §3.2). |
| cast.guide.emblem (glyph reel) | `cr.ui.emblem_ida` | DOM (data) | P0 | 128×128 | "The Reel": dark `#0B1F27` disc; a salmon `#E7A08C` outer ring (4 px); two white inner rings broken into labyrinth segments shaped like film-reel spoke cut-outs; a tiny lantern keyhole at the centre. |
| cast.speakers[0].emblem (glyph slug) | `cr.ui.emblem_editor` | DOM (data) | P0 | 128×128 | A navy ring `#27466A` with a broken inner white ring and a centre cream type slug stamped "E". |
| cast.extras[].emblem | `cr.ui.emblem_npc` | DOM (data) | P0 | 128×128 | Per-extra emblems (§3.4): double rings with the `flashlight` (Otis), `eyeshade` (Hattie), `headset` (Dolores) and `nib` (Theo) glyphs. |
| (DialogueBar) | `cr.ui.info_button` | DOM | P0 | 128×128 | White "i" in a double ring (bible). |
| (DialogueBar, salmon ring) | `cr.ui.info_button_warm` | DOM | P0 | 128×128 | The same with a salmon outer ring (this game's default). |
| (HUD ObjectiveRing) | `cr.ui.objective_ring` | DOM | P0 | 110×110 | 12-segment double ring (4 arcs of 3 with 6° gaps), white @ 60 % (the fill is drawn by code). |
| (panel BackTab) | `cr.ui.back_arrow` | DOM | P0 | 160×80 | `ui.card.deep` tab with a white left arrow and a 1.5 px border. |
| (Scrubber knob) | `cr.ui.year_knob` | DOM | P0 | 56×64 | Orange teardrop knob `#E2892C`, 2 px `#B8661C` outline, point up. |
| (TraceLine terminal) | `cr.ui.trace_hollow` | DOM | P0 | 16×16 | Hollow circle terminal (r 4, 1.5 px `#E8F6F8`). |
| (TraceLine terminal) | `cr.ui.trace_dot` | DOM | P0 | 12×12 | Filled dot terminal. |
| (SuccessBadge) | `cr.ui.badge_frame` | DOM | P0 | 360×140 | Light-bordered badge box with bracket connectors above and below ending in dots (text DOM). |
| (ClaimsCard / MatrixCard sockets) | `cr.ui.socket` | DOM | P0 | 64×64 | Orb-glyph socket, 3 states in one sprite sheet (192×64): hollow / aimed (orange ring) / struck (salmon slash). |
| `archive_of_voices.ui.plank_token` | `cr.ui.plank_token` | K:plate paper_card | P0 | 320×64 | Board-mode plank card background: paper texture, torn left edge, brass tack. |
| `archive_of_voices.part.provenance_drawers_documents` | `cr.ui.doc_icons` | H | P0 | 576×96 | 6 × 96 px icons: photo print, aged textbook, law text (typed with a seal), film case, interview transcript, hardcover biography. |
| `archive_of_voices.ui.drawer_icon` | `cr.ui.drawer_icon` | K:plate | P0 | 64×64 | A drawer front glyph. |
| `archive_of_voices.ui.jack_icon` | `cr.ui.jack_icon` | K:ringStack | P0 | 40×40 | A jack socket glyph (brass ring). |
| `archive_of_voices.ui.tumbler_icon` | `cr.ui.tumbler_icon` | K:ringStack | P0 | 64×64 | A tumbler wheel glyph. |
| `archive_of_voices.ui.paper_texture` | `cr.ui.paper_texture` | K:grainTile grain | P0 | 512×512 | Tileable typewriter-paper texture `paper` with faint fibres (document cards, margin notes). |
| `archive_of_voices.ui.transit_map` (MapOverlay backdrop) | `cr.ui.transit_map` | K:compose | P2 | 1600×900 | "The Record Line" map: cream paper, a navy line with 8 round stations, city/year labels (DOM), a compass rose, a legend box. |
| `archive_of_voices.ui.clipping_case` (JournalReader frame) | `cr.ui.clipping_case` | K:compose | P2 | 1200×800 | Journal frame: a leather folio with brass corners, 5 negative slots, a plate viewer panel. |
| `archive_of_voices.ui.negative_slot` | `cr.ui.negative_slot` | K:plate | P2 | 200×90 | An empty film-strip slot outline with sprocket holes. |


### 7.12 Added in revision 2 (keys with no revision-1 row)

| Key | Tag | Tier | Size | Description |
|---|---|---|---|---|
| `archive_of_voices.prop.courier_ledger_tower` | H | P0 | 520 × 900 | The *Courier-Ledger* tower on its own: 8 stories, 3 art-deco setbacks, anchor `antenna` (the ring and every beam line). Placed as a non-repeating L1 layer in every exterior layer set. |
| `archive_of_voices.prop.record_engine` | K:compose(stairs stepped_plinth, ringStack) | P0 | 1000 × 880 | The hub asset (S1 and S8): plinth + 12 lens sockets; anchors `ring_center`, `lens_0…11`, `drum`, `crown`. The rings, drum and crown are separate props. |
| `archive_of_voices.prop.reel_crate` | K:compose(plate) | P0 | 120 × 90 | Dry reel crates in the S1 flood (the hop tutorial platform). |
| `archive_of_voices.prop.flagpole_plinth` | K:column | P0 | 90 × 340 | S2 flagpole on a stone plinth beside the courthouse (the hop target). |
| `archive_of_voices.prop.mailbox` | K:column | P0 | 70 × 110 | S2 corner mailbox (the hop to the awning). |
| `archive_of_voices.prop.corner_store` | K:compose(facade storefront, awning) | P0 | 520 × 720 | S2 far-corner store; its awning top is the `corner_awning` platform. |
| `archive_of_voices.prop.overpass_stair` | K:stairs iron | P0 | 420 × 360 | S4 stair from the platform up to the overpass. |
| `archive_of_voices.prop.fire_escape` | K:compose(truss gantry, stairs ladder) | P1 | 280 × 560 | S4 alley fire escape (ladder + landing). |
| `archive_of_voices.prop.rooftop_block` | K:facade commercial | P0 | 1120 × 800 | S5 block east of the mast; its roof line is the rooftops ground at y 1040. |
| `archive_of_voices.prop.hall_facade` | K:compose(ashlarWall, arch) | P0 | 2200 × 1100 | S6 Filing Hall façade (the `filing_hall` interior's cutaway). |
| `archive_of_voices.prop.gallery_deck` | K:groundStrip ledge_cap | P0 | 1820 × 60 | Gallery deck strip (S8 gallery; reused for the S1 and S6 galleries at P1). |
| `archive_of_voices.prop.vault_lift` | K:truss cage | P0 | 200 × 260 | S8 vault lift cage (the e11 ride vehicle). |
| `archive_of_voices.part.big_board_launcher` | K:compose(plate, linkStrip pipe) | P0 | 160 × 200 | Capsule launcher at the Big Board's lower left. |
| `archive_of_voices.part.switchboard_step_lamp` | K:column lamp_post | P0 | 30 × 90 | The four step lamps on the memorial landing. |
| `archive_of_voices.part.filing_cabinets_stairwell` | K:stairs stone | P0 | 300 × 510 | The stairwell the cabinets reveal (slot to add, Appendix A.2). |
| `archive_of_voices.layer.morgue_pipes` | K:compose(linkStrip pipe, shelving) | P0 | 2048 × 700 | Interior L2: overhead pipes and shelving silhouettes. |
| `archive_of_voices.layer.stacks_shelving` | K:scatter(shelving compact_stack) | P0 | 2048 × 900 | Interior L3: far stacks (S1, S6 hall, S8). |
| `archive_of_voices.layer.hall_arches` | K:compose(arch arcade) | P0 | 2048 × 800 | Filing Hall L2: marble arcade. |
| `archive_of_voices.layer.vault_backwall` | K:compose(ashlarWall, ringStack) | P0 | 2048 × 900 | Vault room L1: cream stone with radiating grooves. |
| `archive_of_voices.doc.document_plate` | K:plate paper_card | P0 | 200 × 150 | Document-style plaque (sensitive texts). |
| `archive_of_voices.doc.darkroom_plate_1` … `_5` | K:compose | P1 | 320 × 240 each | The five developed plates: empty courthouse steps, empty bus stop, departures board, rose window, the Selma bridge at night. No people. |
| `archive_of_voices.part.darkroom_trays_tray`, `…_enlarger`, `…_line` | K:plate / K:compose / K:linkStrip | P1 | — | The Darkroom sandbox skin's parts (red-lit set). |
| `archive_of_voices.vista.dawn` | K:compose(skyWash, skyline, cloudBand, ringStack) | P0 | 3840 × 2160 | Finale pull-out: the Morgue ceiling at the bottom, the whole restored city at dawn above, 12 beams into the antenna ring. |
| `archive_of_voices.vista.tower_rain` | K:compose | P1 | 1920 × 2160 | Intro crane down the rain-streaked tower to the basement window. |

### 7.13 Totals and budget

| Measure | P0 | Full |
|---|---|---|
| Hero files (`H`) | **35** (19 zone-1 + 16) | 39 (+ 4 NPC costume overlays) · cap 40 (02) / 60 (20) |
| Kit entries (`K:*`) | ≈ 110 | ≈ 130 |
| Atlases | 3 (`nell` 28 frames, `ida`, `otis`) | 6 (+ `hattie`, `dolores`, `theo` as 8-frame NPC sheets, 02 §3b.6) |
| Puppets | `companion.wick` | same |
| SVG source (02 §3f civil row) | ≤ 1.2 MB raw / ≤ 400 KB gzip | ≤ 2.0 MB / ≤ 650 KB |
| Peak VRAM, one zone resident (dpr ≥ 1.5) | ≤ 140 MB (S8 is the heaviest: vault socket at `rasterScale` 0.75) | ≤ 160 MB |

The 193 revision-1 rows map to: 41 rows onto hero files (35 P0 files at P0, because several old rows fold into one
file), 123 kit rows, 6 atlas rows, 13 DOM or data rows, 5 code rows and 5 shared keys.

---

## 8 · Fidelity mapping (bible §9 checklist, 36 items + game-feel 37–41; ★ = mandatory)

| # | Item | How *The Archive of Voices* satisfies it |
|---|---|---|
| 1 ★ | Painterly parallax (≥ 5 layers) | Exterior layer sets carry 6–8 layers (clouds, skyline, tower, L2 masses, L3 street wall, L5 railings/magnolia) and interiors 5 (§2.4), plus the finish stack (20 §5.6: grain, AO, rim, haze, blur, grade, glows, vignette). |
| 2 ★ | No 1-bit tiles | All art is §7: kit generators, ≤ 40 hero SVGs, recoloured rig atlases. The Kenney 1-bit tilesheet is not loaded by this host. |
| 3 | Sky gradient ≥ 3 stops | Segment skies have 3–4 stops (§2.3). |
| 4 | Architecture vocabulary | Circles (Engine rings, clock, rose window, bridge arch, jacks, tumblers), brass trim, navy inlay bands, columns (courthouse, memorial): at least 3 in every frame. |
| 5 | Soft lighting | Coloured blurred contact shadows `#6E7F9A` @ 30 %; kit AO and rim light; darkest colour `ink #2B3A44`. |
| 6 | Glow = live | Controller states `dormant → awake → active → solved` (§5.0.3): unsolved landmarks are wireframe and desaturated; solved ones are saturated. |
| 7 | Foreground framing | L5 railings, meters, magnolia and stanchions cross the bottom edge; 20 W3 keeps L5 off every station's footprint and frame bounds. |
| 8 | Biome identity | A violet-dusk brick-and-cream city with a brass Engine and cyan beams, distinct from the trig terraces and the cell colonnade by palette and silhouettes (steeples, skyline, arch bridge). |
| 9 ★ | Articulated protagonist, 14–18 % height | Nell at ≈ 170 (16 %) on the recoloured rig: walk, run, hop, climb, ladder, interact, think, `show`; scarf on a spring anchor (§3.1). |
| 10 | Scale ladder | The Record Engine is 5.8 H, the vault door 5.9 H, the mast 10 H; consoles 0.7 H; lamps and lenses 0.9 H. |
| 11 ★ | Guide presence | Ida's Reel emblem in the dialogue bar; **Wick** follows Nell, brightens when Ida speaks, and flies to hint anchors (§3.2). |
| 12 | Purpose on screen | The 12-segment objective ring and `RECORD RESTORED n/12`; the Record Strip's earned pins in every panel; P1 beams, Engine lenses and front pages (§6.1–§6.2). |
| 13 | Story beats in world terms | Every instruction names the machine or a declared part (R9), e.g. "Aim the Proof Lamp…", "Lay the planks across the flooded street…" (§4.4). |
| 14 | Sensitivity | R10 and the header rules: no real person drawn; violence only as dated text on `document`/`photo_withheld` plaques; empty buses, stools and parks; `sensitiveSafe` skins; Nell never cheers. |
| 15 ★ | World stays visible | Full-bleed canvas; scrub panel 42vw, board 55vw (20 §3.1); the vault modal dims the room but shows it around the modal. |
| 16 | Panel material | 20 §3.1 material + the shared hex tile. |
| 17 | Circuit-trace lines | Frame lines with hollow/dot terminals on the Verify row, the badge and the dialogue divider ("• • ◉"). |
| 18 ★ | Graph cards | RECORD and FILE timeline cards: bordered, label tabs top-right, year ticks on x, **unit lanes labelled on y** (ORIGINS / DIRECT ACTION / LEGISLATION), major/minor grid (years/months). |
| 19 | Axis units | Years and months (`MAR 1965`, probe format `month_year`); decades in e10 (`year`). |
| 20 | Function colours | White = RECORD (restored facts), green = FILE/draft and the first bin, blue = the second bin, used identically on world chips (cabinet chips, date chips). |
| 21 ★ | Orange input scrubber | The **YEAR probe** (`ProbeSpec`) in every panel: one orange line through both timeline cards, a teardrop knob on the month/year ruler, a `YEAR` tab and a `MAR 1965` readout (§5.0.2). |
| 22 | Value chips on the card edge | RECORD and FILE chips on each card's left edge, overhanging into the world (`SEP 1957 · LITTLE ROCK`). |
| 23 | Back arrow | `panel-back`: closes the panel without grading; the draft is cached. |
| 24 | Named Verify, flanked by traces, disabled until complete | RETRACT SLIDE, LIGHT THE ROUTE, SEND TO THE WIRE, CLOSE THE CIRCUIT, CONNECT THE PROGRAM, SEAL THE CABINETS, LOCK THE SPAN, SEAL THE STACKS, SEND THE CAPSULE, OPEN THE VAULT; each disabled until `draft.complete`. |
| 25 | Success badge | SLIDE RETRACTED, ROUTE RESTORED, WIRE CONFIRMED, CIRCUIT CLOSED, PROGRAM CONNECTED, FILES SEALED, SPAN LOCKED, STORY PRINTED. |
| 26 | Board tokens, snapping, keyboard | Aim, SlotRail, Router, Cable, Tube and Matrix controls (§5.0.1), each keyboard-complete (20 §3.5). |
| 27 ★ | Dialogue-bar anatomy | The Reel emblem, the salmon-ring "i" below it, and two-line text (§3.2). |
| 28 | Sentence style | Imperative instructions naming world objects; insights are pre-success truths; success lines state the concept (§4.4). |
| 29 | Legibility | 20 §3.5 floor at 1280 × 720 (dialogue ≥ 22 px, readout ≥ 28 px, contrast ≥ 7:1). |
| 30 ★ | Live reaction | Every draft change moves the world: lamp swing (on hover too), slab rise, knob turn, wire catenary, dish turn, verlet cord, slip flight, meter needle, tube growth, tumbler rotation; the YEAR probe moves the Record Lens carriage (≥ 3 intermediate poses by easing). |
| 31 | World chips and pins | The carriage's `MAR 1965` chip, cabinet `3 FILED` chips, bridge date chips; station pins (e2 `DAY`, e12 key). |
| 32 | Eased physicality | The controller's ease (≈ 0.33 s to 95 %) plus prefab springs for cords, wires and pendulum lamps. |
| 33 | Partial feedback | `Diagnosis`-driven refusals (slab n tips, the `from` box sparks, a slip bounces with only the disclosed shutter opening, a cord unseats, a tumbler grinds); the margin note carries the grade's text; e9's sweep after tier 1. |
| 34 ★ | In-world success animation (1.2–2.5 s, sound hook) | Per §5.x: retract stamp + steps printing, slabs lock + DAY counter, ticker + nine lamps, relay current + departures flip + gate, mast climb, program print, cabinets roll, span lock + rain stops, shelving rolls, capsule run + Engine turns, bolts + door swing; cue ids §5.0.6. |
| 35 ★ | Payoff is traversal | §5.13: steps, road, doors, gate, lift, memorial steps, stairwell, bridge, ladder, vault lift, vault; each next area is reachable only through it (blockers + `requires.solved` links). |
| 36 | Visible misconception | A "Visible misconception" entry per station (§5.1–§5.12): the 1954–55 band against the 1957 pin, the decoy with no bay, the aged textbook outside the events band, the jumbled bay lamps. |
| 37 | ≥ 2 non-walk verbs per zone besides payoffs | Beat sheets §2.6.1–§2.6.8: P0 clean in S1, S2, S8; P1 clean in all eight zones. |
| 38 | The orange input moves a world object in every encounter | The YEAR probe moves the Record Lens carriage on e1–e11 (plus the DAY counter on e2, the bay lamps on e9 at tier ≥ 1, the shelf light on e10); on e12 the orange accusation ring sits on the accused tumbler in the world. |
| 39 | Boss staged | e12: arena trigger at the vault lift's landing, `e12_arena` (music, camera, grille, X09), Editor taunts before Ida's line, tumblers that turn with the player's marks. |
| 40 | Hints act in the world | Wick flies to each rung's anchors; rungs open shutters, the events band, the e9 sweep, hint pins, the decoy dim and the matrix shading (§5.0.5). |
| 41 | First world reaction ≤ 150 ms | The controller binds drafts synchronously and applies the first eased frame on the next rAF (20 §2.5.3); hover drafts make aim stations react before the click. |

**Self-score target: 36/36 and 5/5**, with all 11 ★ items covered by design. Risk items for the W5 capture loop:
- #7 (foreground must not cover the S6 switchboard);
- #29 (the typewriter margin-note face must render ≥ 28 px equivalent);
- #15 in vault layout (the room must stay visible around the modal);
- #37 before P1 (S3–S7 are W2-clean only at P1).

---

## 9 · Generalization notes

### 9.1 Reusable archetypes (20 §4; code that works for any game using the mode)

None of these reference civil rights; the skins and configs do.

| Archetype (20 §4 id) | Mode | Civil skins | What a new biome or overlay supplies |
|---|---|---|---|
| `claim_holders` | `truth_finder.mimic` | `witness_projector` (aimers `arc_lamp`, `pendant_lamp`) | holder art, aimer, quarantine animation, and per domain: `footprint`s (history), `trace`s (math), `ghost`s (science) |
| `oracle_ticker` | `truth_finder.predict_reveal` | `wire_ticker` | printer device, selector, conduit, `payoffLamps`, `fileDates` |
| `step_bridge` | `sequencer.linear` | `walking_road`, `timeline_bridge` | bay geometry (`flat_road`, `arch`), `items[].meta.printedDate`, `probeWorld` (`day_counter`, `bay_lamps` gated by `bayLampsTier`), `pageOrderHeading` |
| `cause_tubes` | `linker.chain` | `relay_line`, `broadcast_relay`, `big_board` | connector (`catenary`, `vertical_wire`, `tube`), layout by display index (`canopy_row`, `mast`, `ring`), carrier, `boardWidth ≤ 1100`, node dates |
| `switchboard` | `linker.pairs` | `switchboard` | jack field, cord style, the document that fills, `decoyDimRung` |
| `router_lanes` | `sorter.bins` | `filing_cabinets`, `provenance_drawers` | lanes, `shutters`, `stamp: made_year`, `eventsBand` |
| `tumbler_vault` | `investigator.elimination` | `tumbler_vault` | door art, clue dates, `miniStrip`, `shadeCountsRung` |
| **Record Strip** (a system, not an archetype) | any mode whose items carry dates | — | `story.recordStrip` lanes and pins, each station's YEAR `ProbeSpec`, the `record_lens` accessory rail |

### 9.2 What is subject-specific (hand-made now; the World Writer writes it later)
- **Biome kit (art):** `archive_of_voices` = §7 minus the shared UI. It is reusable for any 20th-century US-history or
  civics upload (it is a kit in `src/world/biomes.ts`, `sensitive: true`, not per-game art).
- **Per-game overlay (text and data, LLM-writable):**
  - the story frame (premise, stakes, what gets restored);
  - zone list and landmark choice;
  - every dialogue line in §4.4;
  - claim footprints, `printedDate`/`madeYear` per item, probe windows;
  - Record Strip lanes and pins, hint pins;
  - NPC roster, states and micro-quests;
  - lore plates;
  - the wall-of-front-pages misconception headlines.

### 9.3 World Writer mapping (the revision-1 proposal is superseded by 20 §6.2)

The civil-only `WorldSlice` proposed here in revision 1 is withdrawn. 20 §6.2's `WorldSlice` plus each archetype's
strict-mode `writerConfigSchema` (20 §4.4) cover it:

| Revision-1 field | Now |
|---|---|
| `itemMeta.printedDate` / `madeYear` | `step_bridge`, `router_lanes`, `cause_tubes` writer configs (`printedDate`, `madeYear`) |
| claim `footprint`s | `claim_holders` writer config (`footprint`, all-or-none) |
| `cursorWindow` | `wProbe()` in each writer config (`format: year / month_year`) |
| lines (approach, instruction, hints, success, failure) | `WorldSlice.stations[]` slots (+ tutorial, insight, payoffLine, after, fail.byKey) |
| `lore` plates from sources | code: plaques from each verified `sourceRef.quote` (`document` kind in sensitive kits) |
| `pinsEarned`, `hintPins`, `misconceptionHeadline` | **not yet in 20 §6.2** (Appendix A.2): code could derive pins from dates found in each encounter's texts (the R13 rule), hint pins from `hints[]` dates, headlines from `targetMisconception` |

**Code-verified invariants** (all now 20 rules or validators): lines ≤ 140 characters and ≤ 24 words (R9); no answer
values in pre-success slots (R8); `printedDate`/`madeYear` present in the item text and footprint years in the
encounter texts (`validateConfig`); earned-pin dates in the encounter texts (R13); no NPC or extra named like a person
in the source and violent text only on document plates (R10).

### 9.4 What must stay hand-built
- Biome kits (art), the archetype code, the panel components, and the Record Strip system.
- The **sensitivity policy** for history kits (withheld photo plates, empty-stage memorial payoffs, no real-person
  sprites, no cheering) is kit behaviour, not LLM behaviour, so the model cannot opt out of it.

---

## Appendix A · Engine requirements this game depends on

### A.1 Revision-1 requirements, re-pointed at 20

| # | Revision-1 requirement | Now | Status |
|---|---|---|---|
| A1 | Structured live messages (`LiveMsg`) over `setLiveValue(unknown)` | 20 §2.5.1 `Draft` + `host.bindDraft`; the probe channel; `onHint`/`setAidTier` | **superseded** |
| A2 | Draft emitters in the widgets or new panel components | 20 §3.3 controls (`AimControl`, `SlotRailControl`, `RouterControl`, `CableControl`, `TubeControl`, `MatrixControl`) + widget `onDraft` | folded (P1 in W1) |
| A3 | `Grade.focus?: string[]` inside 7 modes | 20 §2.5.4 `diagnose()` (no mode edits) + the parity test | **withdrawn** |
| A4 | `finale` phase | 20 §2.9 (`finale` phase, D2) | folded |
| A5 | Capture the cleared encounter before `submit` | 20 §2.9 (`VERIFIED` carries it, D1) | folded |
| A6 | World state from runner progress | 20 §2.9 `progress` prop (D3) | folded |
| A7 | `intro` phase with speaker names | 20 §2.8 intro cutscene + §2.7 speaker names (D6) | folded |
| A8 | `disableGlobalCapture()` while the panel is open | 20 §2.2 `input/controller.ts` (D4) | folded |
| A9 | Memoize the view per encounter index | 20 §3.4 `useRunner` (D5) | folded |
| A10 | The host blocks progress at each unsolved landmark | 20 §2.4.1 blockers from `payoff.blocker` | folded |
| A11 | The mystery genre routes to the side-view host when an overlay exists | 20 §2.2 `PlayHost` Expedition branch; `play-mystery.spec` second test moves to `?host=legacy` (20 §7.2 W5) | folded |
| A12 | DOM fallback | 20 §2.2 reduced DOM host: static skin snapshots + full panel (amendment 31) | folded |
| A13 | Overlay file `src/game/worlds/history_mystery_001.ts` or `fixtures/worlds/…` | **`fixtures/worlds/civil-rights.world.json` only** (20 decision 19, amendment 40); keyed by both spec ids and both `(src_civil_rights, genre)` pairs; `tests/world-sidecars.test.ts` checks it | folded |

### A.2 Open items this document needs from 20 (for the architect)

| # | Item | Why | Fallback if not added |
|---|---|---|---|
| O1 | Hub sub-part motion on a `hub` state change (the Engine's rings spin, the iris opens) | The intro's wake and e11's "rings turn" | the hub swaps dormant → partial with a glow; the ring props stay still |
| O2 | Skin slots: `switchboard.steps` (the memorial steps), `filing_cabinets.stairwell` | the e7 and e8 payoffs draw terrain the skins do not list | draw them as `payoff.blocker.asset` props |
| O3 | Confirm R6 accepts a terrain payoff with `terrain: []` whose traversal is a link gated by the same station (e10's rolling ladder) | the gallery is a platform; a heightfield cannot rise under it | give e10 a no-op terrain entry on the floor |
| O4 | Add the §5.0.6 cue ids to `CUE_MAP`; 20 §2.12 lists dotted `sfx.*` ids that `Id` fields reject | R16 | the cues are silent (a warning) |
| O5 | RECORD card: provenance badges after e10, causal arrows after e11 | `RecordStrip` has lanes and pins only | P2; the card shows pins only |
| O6 | Protagonist success pose per biome (`show` in sensitive kits, never `cheer`) | rule 5 / R10 spirit | the host default `cheer` would play at memorial payoffs: must be fixed before P0 freeze |
| O7 | R13 on `spanTo` (the e2 band ends December 1956, derived from "381 days"; that date is printed only in e9's decoy) | a strict reading may reject the band | drop `spanTo` (the band becomes a pin) |
| O8 | `decoyDimRung` validation must accept e7's paraphrase ("signed the act") of the decoy text | 20 §4.4 | set `decoyDimRung: null` and lose the rung-3 dim |
| O9 | 02 §3.0 vs 20 §5.1 naming (layer groups `far/mid/fore` vs `layer`; `char` vs `costume` for overlays; hero cap 40 vs 60; generator names such as `cabinet`/`panelBox` that 02's `KitName` lacks) | this document follows 20 for keys and 02's `KitName` for generators | — |
| O10 | Per-station hint anchors (`hintAnchors[rung]`) | generic `meta.hintTargets` cannot pick a specific item (e.g. the clue with the 2 % figure) | generic anchors (§5.x) |
| O11 | `fileDates` on `cause_tubes` | e5's pre-solve `1961` FILE marker | e5's FILE card stays empty until the solve |
| O12 | The finale's `say` of `spec.narrative.outro` is authored here (O01); the host must not append it again | 20 §2.8 wording | — |
| O13 | 6 character atlases at P1 (3 at P0) against 20 §5.8's "≤ 5 per game" | the four NPC atlases are 8-frame sheets | Dolores and Hattie share one body recolour |
| O14 | `WorldSlice` fields for record pins, hint pins and front-page headlines | §9.3 | code derivation |

### A.3 Pacing (the showcase build runs longer than the fixture's `targetMinutes: 10`)

| Zone | Explore (s) | Puzzles (s, first try) | Cutscene / payoff (s) |
|---|---|---|---|
| S1 | 40 | — | 60 intro |
| S2 | 45 | 60 + 75 | 8 + 10 |
| S3 | 25 | 50 | 10 |
| S4 | 50 | 55 + 90 | 8 + 10 |
| S5 | 35 | 90 | 15 (lift) |
| S6 | 45 | 70 + 80 | 8 + 8 |
| S7 | 25 | 75 | 20 (crossing + streetcar) |
| S8 | 60 | 70 + 100 + 120 | 10 + 12 + 45 finale |
| **Total** | **≈ 5.4 min** | **≈ 17.3 min** | **≈ 4.3 min** → ≈ 27 min (≈ 12 min with `?express=1`) |

## Appendix B · Fact-check notes for the content owner (fixture is pinned; flag only, do not edit)
1. **e7** "Gave the closing speech remembered as I Have a Dream": King's was the last major address. Afterwards
   Rustin read the demands and Randolph led a pledge. The overlay's lines say "its close, not its whole" and stay
   consistent with the fixture.
2. **e12 clue 1**, "Johnson introduced the voting bill on March 15, 1965": March 15 is the "We Shall Overcome"
   address to a joint session. The bill was formally sent to Congress on March 17. The overlay's S2 line says
   "in days", which is accurate either way.
3. **e12 clue 0**, "Black registration in Selma's county was still under 2%": commonly cited as "about 2 percent"
   for Dallas County. Verify against the source PDF page (`samples/civil-rights-history.pdf`, p. 3/4) before any
   re-record.
4. **e10 item i4** "John Lewis's 1965 hospital interview about Bloody Sunday": confirm that the source text names a
   hospital interview. If not, a future fixture revision could use a documented 1965 statement. The classification
   (primary) is right either way.
5. **e5 node n0**, "The Supreme Court rules segregated interstate bus terminals illegal": this is Boynton v.
   Virginia (December 1960). Fine as written; the overlay never adds the case name, because it is not in the source.
6. The overlay invents **no** dates, names or quotations. Every pin (§5.0.2), plate (§6.5), negative (§6.5) and
   headline (§6.2) draws on fixture text: `params`, `prompt`, `hints`, `explanation`, `reveal`, `sourceRef` or
   `debriefLine`. The only generic in-world texts are neutral wayfinding and the misconception headlines, which are
   marked UNVERIFIED.

## Appendix C · Dialogue check

Every §4.4 row is checked by the script below: the line (with the `[fixture…]` tag stripped) is ≤ 140 characters
and ≤ 24 words, and its `speakerId` is in `spec.characters` ∪ `cast.extras` ∪ {`narrator`}. Rows whose line reads
"(listed above)" are cross-references and are skipped. Re-run after edits:

```bash
python3 - <<'EOF'
import re
ok = {"archivist", "editor", "otis", "hattie", "dolores", "theo", "narrator"}
bad = 0
for n, l in enumerate(open("docs/design/12-game-civil-rights.md"), 1):
    m = re.match(r"^\| `([A-Za-z0-9.]+)` \| [^|]* \| `([a-z_]+)` \| [CXN] \| (.*) \|$", l.rstrip("\n"))
    if not m or m.group(3).startswith("(listed above"):
        continue
    text = re.sub(r"\s*`\[fixture[^`]*\]`", "", m.group(3)).strip()
    words = len(text.split())
    if len(text) > 140 or words > 24 or m.group(2) not in ok:
        bad += 1
        print(n, m.group(1), len(text), words, m.group(2))
print("violations:", bad)
EOF
```

