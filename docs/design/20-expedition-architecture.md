# 20 · Expedition architecture

**Status:** design, revision 2 (2026-09-26, afternoon). Revision 1 was the morning draft; revision 2 folds every
high- and medium-impact amendment of `30-critique.md` that targets this document, plus the cheap low-impact ones.
**This document is the single implementable source of truth** for the Expedition layer. Where a game document
(`10-`, `11-`, `12-`) disagrees with it on an API, a type, a key, a layout width, an asset path or a coordinate
convention, this document wins; the game documents stay authoritative for *content* (nouns, lines, poses,
formulas, success timelines) and are re-pointed at the types defined here.

**Audience:** the main session, the architect, and every implementation agent in the Variant-fidelity waves.

**Inputs:** `00-runtime-map.md` (seams, defects D1–D9), `01-variant-design-bible.md` (target look, patterns
P1–P8, the 36-item checklist), `02-assets-and-art-pipeline.md` (Kenney `toon-characters`, SVG via `load.svg`),
`10-game-trig.md`, `11-game-cell-transport.md`, `12-game-civil-rights.md` (§2 scenes, §5 contraptions, §9
generalization), `30-critique.md` (amendments 1–40, risks F1–F12), and the runtime sources they cite. Reference
frames 3–10 are described in bible §1. Facts about the repo (fixture ids, characters, mode `View`/`Input` shapes,
`answerVars`, the Kenney pack layout, the zod 4.6.5 `.default` behaviour) were re-checked on 2026-09-26.

**Scope:** the **Expedition layer**:
- a painterly side-view world with a protagonist, a guide companion, NPCs with state, authored traversal verbs,
  live contraptions, sandboxes and ambient triggers (Phaser 4);
- a right-side instrument panel, a dialogue bar, a HUD with a purpose meter, a map and a journal (React);
- a procedural WebAudio cue bank (no audio files);
- a world-overlay contract that makes the three showcase games Variant-grade now, and lets PDF-generated games get
  the same treatment later (the World Writer, §6).

**Out of scope:** 3D; recorded audio assets (the synth bank in §2.12 covers every cue); and the mechanics
themselves. **Modes, `grade()`, `EncounterRunner` and every fixture byte stay exactly as they are.** No mode file is
edited: there is no `Grade.focus`, no exported `firstMiss`, no mimic `noun` template var (§2.5.4 replaces all three).

---

## CHANGELOG (revision 2)

Every amendment from `30-critique.md` §4 that targets this document, with the section that now carries it.
"Also" names secondary sections the change touches.

| # | Amendment (short) | Folded into | What changed |
|---|---|---|---|
| 1 | Speakers outside `spec.characters` | §1.3 `Cast.extras`, §1.5 R2, §2.7 `speakers.ts` | `cast.extras[] {id, name, voiceArchetype, emblem, portrait, role}`; `speakerId` resolves against `spec.characters ∪ cast.extras ∪ {player, narrator}`. |
| 2 | Traversal verbs replace "no jump physics" | §0 decision 9, §1.3 `Zone.platforms/links`, §2.4, §3.5 | Authored links `hop \| climb \| drop \| ladder \| timed_hop \| ride` over a surface model (ground heightfield + platforms); scripted arcs, no physics engine; one published key map. |
| 3 | Probe channel | §1.3 `ProbeSpec`, §2.5.1 `Draft.probe`/`PoseInput.probe`, §3.3, §3.4 | Ungraded orange scrubber declared in each contraption's config; the Scrubber binds to it whenever the mode `Input` is not scalar. |
| 4 | Time and simulation | §2.5.1 `PoseInput.t`, `SimSpec`, §2.5.3 controller | Resettable clock `t`; optional pure, seeded `sim {init, step, readout}` whose state `pose()` receives. |
| 5 | Rewrite §4.1 bindings; new archetypes and skins | §4, §4.1, §4.3 | `pendulum_sync` and `stage_machine` added; skins `vesper_dial`, `witness_projector`, `walking_road`, `timeline_bridge`, `relay_line`, `broadcast_relay`, `switchboard`, `filing_cabinets`, `provenance_drawers`, `big_board`, `tumbler_vault`, `specimen_pods`, `membrane_router`, `tonicity_sluices`, `pump_rewiring`, `endocytosis_lift`, `gatekeeper_maws`; civil zones = its 8 scenes. |
| 6 | Generalized payoff | §1.3 `Payoff`, §1.5 W1 | `{kind: terrain \| ride \| remove_blocker \| carry, vertical: up \| down \| none, noun, anim}` with a fixed `PAYOFF_KIND_OF` table; new anims `ramp_forms`, `steps_emerge`, `stairwell_opens` (the critique's "descend"), `water_rises`, `door_carries`, `gate_lifts`, `barrier_lifts`, `vault_opens`; `lift_rises` becomes `lift_moves` (up or down by `vertical`). W1 uses `vertical`. |
| 7 | Card kinds + GraphCard annotations | §2.5.2 `CardModel`, §3.2 | Kinds `unit_circle`, `bars`, `schematic`, `link_board`, `claims`, `slot_rail`, `matrix`, `energy_cells`; `GraphCard` annotations (brackets, shaded regions, period markers, dashed/ghost plots, live dots, caption). `gradient` → `bars`, `energy` → `energy_cells`. |
| 8 | Station geometry, accessories, framing, boss | §1.3 `Station`, `BossStaging`, `Accessory` | `consoleX` + `anchor {x, y}` replace `x`; `accessories[]` (civil `record_lens`); `frameZoom`; `boss {arenaTriggerX, arenaCutsceneId, phases[], taunts, speakerId}`. |
| 9 | Dialogue slots, line limit, noun rule, insight vs success | §1.3 `StationDialogue`, §1.5 R8/R9, §2.7 | `tutorial`, `hints[3]` (guide-voiced), `fail {default, byKey[]}`, `payoffLine`, per-slot `speakerId`; instruction ≤ 140; R9 accepts `objectNoun`, a skin noun or a declared `partNouns` entry; `insight` = pre-success hint-free truth, `success` = post-success concept statement. `nearMiss[]` folded into `fail.byKey`. |
| 10 | Hints act in the world | §2.5.1 `aidTier`/`hintsUsed`, `meta.hintTargets`, §2.10 `HostHandle.onHint`, §2.7 | `aidTier = min(2, max(hintsUsed, failedVerifies > 0 ? 1 : 0))` in `PoseInput`, `panelStatic` and `panelLive`; the companion flies to `hintTargets(rung)` anchors. |
| 11 | `diagnose.ts` single source of wrong keys; overlay probes | §2.5.4, §1.3 `MisconceptionProbe`, §8.1 parity test | `src/world/diagnose/**` computes `wrongKeys`, `failKey`, `prefix`, `probeKeys` from params + input + solution; parity test against `grade().feedback`; `probes[] {predicate: nearValue \| keyInSlot \| decoyPresent \| aimedIndex \| linkedTo \| assignedTo}` evaluated only after Verify. |
| 12 | Demo cut, express mode, earlier gate | §0.1 (new), §7 (rewritten), §2.13 | P0/P1/P2 per game; `?express=1`; vertical-slice gate "trig S1–S2 by midday". |
| 13 | Every showcase `configSchema` now; writer schemas; validators | §4.2, §4.4, §6.2 | Full zod configs keyed by `statementIndex` / item key / wave index; strict-mode `writerConfigSchema` per archetype; `validateConfig` (ghost honesty, printed dates present, expressions evaluate, footprints honest). |
| 14 | Procedural SVG kit | §5.4 (new), §5.2, §5.8 | `art/kit/*.ts` seeded, token-coloured generators run by `art:build`; hand-authored SVG capped at about 60 hero parts per biome. |
| 15 | Ambient triggers | §1.3 `Trigger`, §2.4.5 | `triggers[] {zoneId, x, radius, lines, once, requires, kind, setFlag}` for explore lines and scene arrivals. |
| 16 | NPC state and quests | §1.3 `Npc.states`, `Quest`, §2.4.6, `src/world/state/**` | `states[] {requires, zoneId, x, lines, pose, follow}`; `quests[] {steps: talk \| collect \| touch \| afterSeal \| visit, reward}`. |
| 17 | Sandbox interactable | §1.3 `Sandbox`, §2.4b (new), §2.5.5 `SandboxMeta` | A contraption-like meta with no runner, no Verify and no grade (Music Box, Plant Cell Garden, Darkroom). W2 warns when a zone has no sandbox, quest touch or second verb. |
| 18 | Gatekeeper staged as a boss (mirror) | §1.3 `BossStaging.phases`, §4.1 cell e11 | Presentation batches 2 + 2 + 3 by item key; one `Input`, one `grade()`. |
| 19 | One recoloured Kenney rig with costume anchors | §5.5 (new), §1.3 `CharacterLook`, §1.3 manifest `atlas` entries | Kenney `Vector/character_*.svg` recoloured per character at build time, rendered to an HD atlas, per-frame anchors; Wren's puppet is post-demo. |
| 20 | Per-zone coordinates, heights, vertical camera | §1.3 `X`/`Y`/`Zone.height`/`Zone.camera`, §2.2 framing, §2.3, §4.1 conversion tables | Coordinates are per zone; `frameFor → {scrollX, scrollY, zoom}`; Y-follow deadzone; lifts, rides and the vesicle are zone transitions with vertical camera tweens. |
| 21 | Glyphs by text-to-path | §5.3, §5.2 step 4 | `<text data-engrave>` becomes paths at build time via `opentype.js` 2.0.0 and one bundled OFL font; every dynamic label goes through `WorldLabelLayer`. |
| 22 | One naming table | §5.1 | Namespaces `orrery_terraces`, `living_gate`, `archive_of_voices`; keys `ns.group.name`; pivots as fractions; raster `rasterScale × min(dpr, 1.5)`; retired `variant/`, `cell/`, `archive-city`, `cr.*`, `cell.*`, `A###`. |
| 23 | Scenes within zones | §1.3 `Zone.segments/layerSets/interiors`, zone max 8 | Segments with a 1 s crossfade, interiors with a cutaway façade; up to 8 zones (civil uses 8). |
| 24 | Purpose meter, progress effects, map, journal | §1.3 `Story.meter/progressEffects/map/journal/recordStrip`, `Collectible.kind`, §2.6 | Meter (also drives ambient particles), progress effects, generic `MapOverlay` + `JournalReader`. |
| 25 | Cutscene verbs | §1.3 `CutsceneStep`, §2.8 | `await_interact`, `control_until`, `vista`, `set_state`, `camera` (+ cheap `emote`, `music`). |
| 26 | Leaks before Verify | §2.5.6 live-reveal rule, §4.2 (`bayLampsTier`, stage_machine neutral "loaded" label), §8.1 | e9 bay-lamp sweep gated at aid tier 1; e8 "?" glyph replaced by "loaded: …"; the no-leak test covers `describe()`, `panelLive()` and world lamps. |
| 27 | Trig probe moves the world (mirror) | §4.1 trig e3/e4/e5 `probeWorld` | `trace_slate` (Tuning Lens projects the trace + playhead, bell pitch ∝ \|f(x)\|) and `relief_marker` (chasm-lip relief + crossing glints). |
| 29 | Game-feel checklist items 37–41 | §8.3 | Scored alongside 1–36. |
| 30 | Per-game performance plans | §2.11 | Pooled lipid heads (60 sprites), half-resolution reflections in 2 civil scenes at 15 Hz, rain 120, trig star field baked ≤ 140 points. |
| 31 | DOM fallback = static snapshots | §2.2, §2.5.5 `SnapshotProps`, §2.5.1 `ContraptionSkin.snapshot` | One generic snapshot component draws each skin's dormant or solved parts; animated e2e runs on the swiftshader WebGL project. |
| 32 | Framing giant contraptions | §2.5.1 `meta.frameBounds`, §1.3 `Station.frameZoom`, §4.2 `boardWidth ≤ 1100` | Big Board ≤ 1100 wide; the mast frames the focused station + lift; the bridge frames the crown bays. |
| 33 | Controls | §3.3 | `AimControl` drafts on hover/focus; `WaveControl` Verify-after-last-wave + preselected retry; `MatrixControl` (UI-only marks) replaces `TumblerControl`; no `sluice` layout. |
| 34 | R8 token-boundary matching | §1.5 R8, `src/world/answer-leak.ts` | Math-run tokenizer; exemptions `hints[2]`, `success`, `payoffLine`, `after`; negative test on trig `e2.approach`. |
| 35 | Synth cue bank | §2.12 (new) | `src/game/expedition/audio/{synth,cues,bus}.ts`, about 20 recipes, mapped from every game-doc cue id; muted by `EXPEDITION_SFX=off` (tests) and a HUD toggle. |
| 36 | `feedbackNouns` | §1.3 root `feedbackNouns[]`, §2.5.4 | Display-only substitution applied to `grade()` feedback text; cell X8 (mode `noun` var) is dropped. |
| 38 | Post-demo archetypes | §4 | `counterweight_lift`, `beam_table`, `glyph_ring`, `pillar_staircase` marked `status: "post_demo"`; `console_slate` covers their modes. |
| 39 | `autoWorld` fills config defaults | §6.3, §2.5.1 `meta.defaultConfig` | Text-only ghosts, evidence cards from `sourceRef.quote`, item dates parsed from item text, history year windows. |
| 40 | One overlay location + keying test | §1.2, §8.1 `tests/world-sidecars.test.ts` | `fixtures/worlds/*.world.json` is the only overlay location; a test resolves all side-cars for fixture ids, sibling fixtures and mock-generated specs. |
| F2 | Painterly finish stack | §5.6 (new) | Grain, baked AO, rim light, haze, blur, per-zone ColorMatrix grade, glow sprites, vignette; locked on the vertical slice. |
| F6 | Sims hold measurable state only | §2.5.1 `SimSpec` | Cosmetic particles, cords and trails live in prefabs, seeded from `spec.seed`. |
| F9 | Keyboard e2e per control type | §8.2 | One WebGL keyboard test per control kind, not per game. |
| F12 | Sensitivity lint | §1.5 R10 | NPC/extra names must not match people named in the spec; violent text only on `document` or `photo_withheld` plates. |
| §1.4 | Keys, layout widths, line limits, insight semantics | §3.5 key map, §3.1 (authoritative widths), §1.5 R9 | One key map; the game docs' 0.59/0.45 fractions defer to §3.1. |

**Not folded here** (they target other documents; this document provides the types they need):
- **28** traversal beat sheets (game docs §2.x): content. This document supplies the verbs (§2.4) and the W2 warning.
- **37** quiz-voiced line rewrites (cell §4.3, civil §4.4): content. §4.1 proposes distinct cell quarantine Verify
  labels and animations so the rewrite has a target.
- The game-doc halves of 2, 3, 11, 19, 20, 21, 22 (re-pointing the three game documents at these types, renaming
  asset ids, converting cumulative coordinates) and the bible/02 halves of 14, 19, 22, 29. §4.1 gives the exact
  coordinate conversions and §5.1 the renaming rule so that work is mechanical.

---

## 0 · The decisions, in one table

| # | Decision | Why |
|---|---|---|
| 1 | **`WorldOverlay` is a new contract** in `src/contracts/world.ts`. It is carried **two ways**: (a) a side-car file `fixtures/worlds/<game>.world.json` for the three showcase games now, and (b) an optional `GameSpec.world` field, empty until the World Writer lands. | Side-cars change zero fixture bytes, so all six drift/equality tests stay green. The optional field costs nothing today and is the landing pad for generated games (§1.4, §6). |
| 2 | **Resolution order:** side-car by `spec.id` → side-car by `(source.sourceId, genre)` (only if it validates against this spec) → `spec.world` → `autoWorld(spec)` (behind `EXPEDITION_AUTO=on` until W8) → legacy host. | Mock-generated games reuse the fixture encounter ids, so the golden path gets the showcase world too. `wave2_smoke_001` shares `(src_trig_ch4, dungeon)` but not the encounter ids, so it fails validation and falls through (tested, §8.1). Nothing ever *fails* to play. |
| 3 | **Contraptions are split into a pure "meta" and a Phaser "prefab".** The meta holds the config schema, the writer schema and validators, `pose`, `lerp`, `describe`, the panel model, the probe, the optional sim, hint targets, failure and success plans, skins. It lives in `src/world/contraptions/*.meta.ts` with no Phaser and no React. The prefab is `create(scene) → applyPose/playSucceed/playFail`. | Validators, the pipeline and Vitest (node env, `*.test.ts` only) import metas. All maths, all sims and every "what reacts to this failure" decision is unit-tested. |
| 4 | A **shared `ContraptionController`** in the host does bind → sim step → ease → apply → publish labels → audio params for every prefab. It owns the clock `t`, the aid tier and the probe value. | Easing, chips, SR text, sim stepping and `debugState` are written once. Prefab authors only draw. |
| 5 | **Canvas is always full-bleed**. The panel is a translucent overlay (`backdrop-filter`) on the right, and the camera frames the active contraption (its `frameBounds`) inside the *visible safe rect*, in x **and y**. The canvas is never resized on phase change. | Matches the reference ("world ghosts through the panel"), avoids resize thrash and layout shift, and keeps the boot effect's `[]` deps. |
| 6 | **Live input is a typed `Draft`**: the mode's `Input` (possibly partial) plus `complete`, `focus`, `hover`, `probe`, `settled`, `wave`, `marks` and `seq`. It flows `control → ExpeditionClient (ref, no setState) → host.bindDraft`. | Fixes D5 and generalizes the number-only `onLive` to every mode, the probe channel and the UI-only notations. |
| 7 | **World text (chips, pins, prompts, NPC names, plaque titles, split-flap characters) is DOM**, drawn by a `WorldLabelLayer` that projects scene anchors each frame. **Static engraving** (π labels, numerals, wordmarks) is converted to SVG paths at build time. | Text stays crisp on a projector and readable by screen readers. Agents never hand-write glyph outlines. |
| 8 | **Phase machine** (`loading → intro → explore ⇄ panel/sandbox/cutscene → resolving → payoff → … → finale → finished`) as a pure reducer. | Fixes D1, D2, D3 and D9; gives rides, arenas and sandboxes a frozen, testable phase. |
| 9 | **Authored traversal, no physics engine.** The walkable world is a ground heightfield plus named platforms. **Links** (`hop`, `climb`, `ladder`, `drop`, `timed_hop`, `ride`) move the player between surfaces with scripted arcs. Puzzles still *add terrain* or *start rides* as their payoff. Space with no link in range plays a cosmetic in-place hop. | Replaces revision 1's "no jump physics" (which made every zone an A/D corridor). Deterministic, testable, no arcade tuning; secrets and collectibles sit behind hops and climbs, as the game docs designed. |
| 10 | **Art = token-templated SVG + a procedural SVG kit.** `pnpm art:build` runs `art/kit/*.ts` generators, substitutes palette tokens, converts `<text data-engrave>` to paths, and writes `public/assets/expedition/<ns>/**` plus a manifest and a per-namespace asset index. Hand-authored SVG is capped at about 60 hero parts per biome. **Characters** are one Kenney `toon-characters` rig, recoloured per character from `Vector/character_*.svg` at build time into an HD atlas with per-frame costume anchors. | About 560 agent-authored SVGs are not feasible for 2026-09-27; about 180 hero parts plus generators are. Recolouring fixes the skin tones `setTint` cannot produce. |
| 11 | **Every implemented mode plays in Expedition**: 12 native archetypes plus `console_slate`, the universal fallback that wraps the existing widget. Four revision-1 archetypes are post-demo. | Keeps `coverage.test.ts`'s promise and makes `autoWorld` total. |
| 12 | Escape hatches: `?host=legacy` forces the old hosts, `?renderer=dom` forces the DOM fallback, `?express=1` opens each panel on arrival and trims explore and cutscenes (rehearsal), `?mute=1` silences the synth. | Deterministic e2e for both render paths, a safe demo rollback, and a fast rehearsal path. |
| 13 | **`src/world/diagnose/**` is the only source of per-item failure detail** (`wrongKeys`, `failKey`, `prefix`), computed from params + input + solution **after** `grade()`; a parity test pins it to `grade().feedback`. | One code path, zero mode edits (the cell and civil docs proposed two different mode changes for the same need). |
| 14 | **Speakers** are `spec.characters ∪ cast.extras ∪ {"player", "narrator"}`. | About 60 authored lines (NPCs, mimics, Ilse, narrator cards) become representable. |
| 15 | **Coordinates are per zone** (x from the zone's left edge, y down from the zone's top, `Zone.height` ≥ 1080). A game has up to 8 zones; a zone has lighting **segments** and **interiors**. Rides and lifts that change zone are cutscene transitions with vertical camera tweens. | Fits the trig canyon, the cell descent and the civil city without one giant strip. |
| 16 | **Hints are world actions.** `aidTier = min(2, max(hintsUsed, failedVerifies > 0 ? 1 : 0))` reaches `pose`, `panelStatic` and `panelLive`; the companion flies to `meta.hintTargets(rung)`. | All three game docs designed hint rungs as world reactions. |
| 17 | **Side content is data**: triggers, NPC states, quests, sandboxes, collectibles and plaques in the overlay; world state (flags, collected, touched) is a pure reducer in `src/world/state/**`. | Every micro-quest in the game docs becomes expressible and testable without host code per quest. |
| 18 | **Sound is a procedural WebAudio cue bank** (about 20 recipes) mapped from every cue id in the game docs. | Costs no bytes, satisfies the ★34 sound hook, and adds more feel than any single art item. |
| 19 | **`fixtures/worlds/*.world.json` is the only overlay location** (not `src/game/worlds/*.ts`). | One loader, one validator path, one keying test (amendment 40). |
| 20 | **The DOM fallback renders static snapshots** (dormant or solved parts per skin) plus the full panel; animated behaviour is tested on the swiftshader WebGL project. | Saves about 1,800 lines of per-prefab DOM code with no loss of e2e coverage. |

---

## 0.1 · Demo cut (2026-09-27)

The architecture supports full fidelity. The **demo cut** decides what ships first. Priorities are cumulative:
P1 starts only after P0 is green on both Playwright projects; P2 only after P1.

### 0.1.1 Definitions

- **Full art** (a zone): every parallax layer of every segment, the ground and underside, props dressing, the hub,
  every contraption part, the companion, NPC looks, and the finish stack (§5.6). Hand-authored hero parts where the
  bible's scale ladder puts them (hub, gates, bosses), kit generators for everything else.
- **Kit art** (a zone): every layer and the ground generated by `art/kit` presets with the biome palette, plus
  **one hero landmark** (listed below), plus every contraption part its stations need (hero or kit).
- **Playable station**: the native archetype and skin from §4.1 with live link, probe (when listed), Verify,
  diagnosis-driven failure plan, success animation, payoff traversal, all dialogue slots, and aid-tier hint actions.

### 0.1.2 P0 · must ship for the demo

| Item | Trig: The Orrery Terraces | Cell: The Living Gate | Civil: The Archive of Voices |
|---|---|---|---|
| Stations (all playable) | e1–e6 (6) | e1–e11 (11) | e1–e12 (12) |
| Bosses staged (§1.3 `BossStaging`) | e6 Warden: arena trigger, wake, taunts on fail, common-start reset | e11 Gatekeeper: arena trigger, 3 presentation phases (2 + 2 + 3), taunts, maw reactions | e12 Tumbler Vault: arena trigger (vault lift), Editor voice taunts, matrix |
| Intro cutscene | S0 gondola arrival → wind Cog (`await_interact`) → telescope pan | S1 Halcyon dock → Pip detaches → Ora on comms | S1 stair descent (`control_until`) → breaker (`await_interact`) → Engine wakes |
| Finale cutscene | Warden kneels → Star Door → **vista** `orrery_terraces.vista.canyon` pan → Ilse's star figure | Pore opens → walk in → gradient 100 % | Vault opens → press-organ → **vista** `archive_of_voices.vista.dawn` pull-out |
| Full-art zone | Z1 Sunward Terrace (S0–S2) | Zone A Glycocalyx Shore (S1–S2) | S2 Courthouse Square (first zone with stations) **and** the Record Engine hero in S1 (the intro room) |
| Kit zones + hero landmark | Z2: Crystal Stair waterfall cliff · Z3: Warden's Dome interior + Star Door | B: sluice trench + Poro statue · C: Pump Hall vault shell (interior segment) · D: Nuclear Pore hub | S1: Record Engine (full, above) · S3: high school façade · S4: five-and-dime + terminal façades · S5: church rose window · S6: memorial colonnade · S7: steel arch bridge (a contraption part) · S8: vault door (a contraption part) |
| Traversal | host supports every link kind (P0 code); zone 1 content authors ≥ 2 non-walk verbs (hop + ladder/climb); every payoff traversal in every zone | same | same (S2: cornice climb + flagpole hop) |
| HUD | objective ring, objective line, key legend, mute toggle, dialogue bar with emblems, (i) hint sheet (Brief + Hints tabs), journal = MasteryHud | + Gradient **meter** (drives ambient motes) | + Record Strip (panel) and earned pins |
| Sound | synth cue bank on, every cue id mapped | same | same |
| Express | `?express=1` works end to end | same | same |
| DOM fallback | static snapshots + full panel | same | same |

### 0.1.3 P1 · after P0 is green (first to cut if time runs short)

| Item | Trig | Cell | Civil |
|---|---|---|---|
| One side quest (NPC states + quest) | Brasswick: talk → `afterSeal e2_period` → return → Page 3 | Kay's Lanterns: `touch` ×3 → shard 2 | Theo's spill: talk → `afterSeal e10_sources` → talk → debrief line |
| One sandbox (§2.4b) | Astronomer's Music Box (S5 grotto; P1 unlock: `requires.solved = e5_period_review`; P2: the 3 wisps) | Plant Cell Garden (S4 alcove) | Editor's Darkroom (S8; unlock: 5 negatives) |
| Remaining hero art | Z2 and Z3 full art | zones B, C, D full art | S3–S8 full art, interiors with cutaway façades |
| Traversal beat sheets | ≥ 2 non-walk verbs in every zone (W2 clean) | same (S7 ride links + viewpoint detour) | same (S4 rafters, S5 mast climb) |
| Ambient triggers and all NPC states | `s0.*`, `s3.01`, `g.*` | `s1_walk*`, `zB_arrive`, `zC_arrive` | X01–X10 arrivals |
| Progress effects | L1 beam lines to the Orrery | conduits + packets | record-light beams, Engine lens pips, wall of front pages |

### 0.1.4 P2 · polish

Maps (Orrery Map, Cell Chart, Record Line) with `MapOverlay`; journal readers (pages, logbook, clipping case);
collectibles and secrets (wisps, shards, negatives, telescopes); puddle reflections and rain polish; the e6
"time × 0.5" toggle; reduced-motion extras; debrief bonus lines. **Post-demo:** Wren's 18-part puppet, the four
post-demo archetypes, the World Writer (W8).

### 0.1.5 Express mode (`?express=1`, rehearsal and judging)

| Behaviour | Rule |
|---|---|
| Panel on arrival | After `ASSETS_READY` and after every `PAYOFF_DONE`, the client calls `host.walkTo(currentStation.consoleX)` at 2× walk speed (it plays the payoff traversal first: climbs, crossings and rides still animate), then dispatches `INTERACT_STATION`. |
| Explore trimmed | Ambient triggers, NPC approach lines, quests and sandboxes are disabled. Links needed on the critical path are auto-used by `walkTo`. |
| Cutscenes | Each cutscene plays until its first `say` line completes, then `skip()` applies the end state. The finale is not trimmed. |
| Everything else | Grading, hints, failures and payoff animations are unchanged. |

Timing target with express: trig ≈ 7 min, cell ≈ 12 min, civil ≈ 12 min (first-try solves).

### 0.1.6 Gates, clock and fallback ladder

`T0` is the moment W0 starts (§7). Estimates in §7 are agent wall-clock hours.

| Gate | Condition | Target | Hard stop |
|---|---|---|---|
| **V · vertical slice** | trig S1–S2 (e1, e2) playable end to end in `webgl` and `dom`, zone-1 art with the finish stack, scored by the critic on 3 shots with no ★ failure except art polish | T0 + 10.5 h | **midday (12:00) on 2026-09-27** |
| **P0 freeze** | every §0.1.2 row green; `pnpm typecheck`, `pnpm test`, `pnpm e2e` green; express run of each game recorded | T0 + 24 h | 2 h before the demo slot |
| **P1** | per row, only if P0 froze early | after P0 freeze | 30 min before the demo slot |

**Compression levers** when the demo slot is earlier than T0 + 26 h (apply in order): W5 runs only the express and
keyboard specs plus one critic round; C1–C3 ship kit art for landmarks that are not contraption parts; W3's A2 stops
after cell and civil zone 1 (other zones use their biome's default kit zone preset, which A1 generates in W1).

**Fallback ladder** (applied in order, logged in `DECISIONS.md` and `MORNING_REPORT.md`):
1. A hero part not ready → its kit generator stand-in (every hero key has a kit fallback declared in `biome.json`).
2. A zone's full art not ready → kit art + its hero landmark.
3. An archetype not native by P0 freeze → its stations use `console_slate` (R5 accepts it; the stations are listed).
4. The WebGL path failing on the demo machine → `?renderer=dom` (static snapshots + full panel).
5. Anything else broken → `?host=legacy`.

---

## 1 · Contract

### 1.1 The choice: side-car now, spec field later (both from one schema)

| Option | Fixture bytes | Mock-pipeline tests (`mock-models`, `pipeline-mock`) | Generalizes to PDFs | Verdict |
|---|---|---|---|---|
| World only on `GameSpec` | trig/cell/civil JSON must change → `assembleGameSpec` must emit it → `generateGame` must produce it → needs a recorded World Writer before any showcase work | break until W8 | yes | too much coupling for the showcase sprint |
| Side-car only | untouched | untouched | no (a generated game has no file) | good now, dead end later |
| **Both, one schema (chosen)** | untouched | untouched | yes (W8 fills `spec.world`) | the side-car is the *hand-polished* instance of the same contract the LLM path will write |

Adding `world: WorldOverlay.optional()` to `GameSpec` is safe today:
- zod 4 leaves an absent optional key absent.
- `assembleGameSpec` never emits it.
- `toEqual` against the fixture JSON is unaffected.
- `validateGameSpec` gains a branch that only runs when `spec.world` exists.

Hand-authored overlays use `z.strictObject`, so a typo in JSON is an error. The zod-4 stripping trap from
runtime map §0.7 cannot bite us silently.

### 1.2 Files and keying

**Decision (amendment 40): `fixtures/worlds/*.world.json` is the only overlay location.** No overlay lives in
`src/game/worlds/*.ts` (civil Appendix A13 is superseded). One loader, one validator path, one keying test.

```
fixtures/worlds/                     <- SUBDIRECTORY: findFixtureSpecById() only scans top-level *.json
  trig.world.json                    appliesTo: specIds ["trig_demo_001", "trig_platformer_001"],
                                                sources [{src_trig_ch4, dungeon}, {src_trig_ch4, platformer}]
  cell-transport.world.json          appliesTo: ["cell_demo_001"], [{src_cell_transport, dungeon}]
  civil-rights.world.json            appliesTo: ["history_mystery_001", "history_demo_001"],
                                                [{src_civil_rights, mystery}, {src_civil_rights, dungeon}]
src/contracts/world.ts               WorldOverlay, WorldFile, AssetManifest, ProbeSpec, DateString (architect-owned)
src/server/worlds.ts                 loadWorldFor(spec): reads fixtures/worlds/*.world.json, picks, validates
tests/world-sidecars.test.ts         the keying test (§8.1)
```

`src/app/play/[id]/page.tsx` calls `loadWorldFor(spec)` after `validateGameSpec`. It passes
`world: WorldOverlay | null`, `worldSource` and `sfx: "synth" | "off"` (from `EXPEDITION_SFX`, read in
`src/server/env.ts`) through `PlayClient` to `GameClient`. Only plain JSON crosses the RSC boundary: metas contain
functions, so the client rebuilds the resolved form with `resolveWorld`. A side-car that fails validation against the
spec is **skipped** with a server-side `console.warn`, never a client `console.error`, because e2e asserts zero
console errors. The next source in the order is then tried. `wave2_smoke_001` shares `(src_trig_ch4, dungeon)` with
trig; its encounter ids differ, so R4 fails and it plays on the legacy host (asserted by the keying test).

### 1.3 The zod schema (full)

Conventions that the schema relies on:
- **Coordinates are per zone** (amendment 20): x from the zone's left edge, y **down** from the zone's top edge,
  1 unit = 1 px of a 1080-px-tall view, protagonist H ≈ 170. Game-doc cumulative coordinates convert per §4.1.
- **Keys, never display order**: anything per claim, per item, per wave or per plank is keyed by
  `statementIndex`, `optionIndex`, item key (`i0`, `s2`, `d0`, `l1`, `r3`, `x0`, `n4`), `waveIndex` or hypothesis id.
- **zod 4 defaults**: `.default(x)` returns `x` verbatim without parsing it, so an object default whose fields
  carry their own defaults uses `.prefault({})` (verified on zod 4.6.5: `.default({})` yields `{}`,
  `.prefault({})` yields the filled object).

```ts
// src/contracts/world.ts — STORED schema (fixtures/worlds, GameSpec.world). Never sent to a model:
// the World Writer writes a strict-mode WorldSlice (src/contracts/slices.ts, §6) and code assembles this.
import { z } from "zod";
import { Genre, Id, SourceRef, VoiceArchetype } from "./common";

export const WORLD_VERSION = 2 as const;

/** "<namespace>.<group>.<name>[.<variant>]"; namespace = "shared" or a biome id (§5.1). Checked against the asset index. */
export const AssetKey = z.string().regex(/^[a-z][a-z0-9_]*(\.[a-z0-9_]+){2,3}$/, 'asset keys look like "orrery_terraces.part.ring_outer"');
export type AssetKey = z.infer<typeof AssetKey>;
export const HexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, "colors are #rrggbb");

// ---------------------------------------------------------------- coordinates (PER ZONE)
export const X = z.number().min(0).max(12_000);
export const Y = z.number().min(-400).max(4_320);             // −400: crowns that bleed off the top
export const Ms = z.number().int().min(0).max(30_000);
export const Point = z.tuple([X, Y]);
export type Point = z.infer<typeof Point>;
/** A walkable surface: the zone heightfield ("ground") or a platform id in the same zone. */
export const SurfaceRef = z.union([z.literal("ground"), Id]);
export type SurfaceRef = z.infer<typeof SurfaceRef>;

/** An availability gate. Every set condition must hold. */
export const Requirement = z.strictObject({
  solved: Id.nullable().default(null),          // this encounter is solved
  flag: Id.nullable().default(null),            // this world flag is set (quests, triggers, NPC states, sandboxes, cutscenes)
  notFlag: Id.nullable().default(null),         // ...and this one is NOT set
  collected: z.array(Id).max(8).default([]),    // all of these collectibles are held
});
export type Requirement = z.infer<typeof Requirement>;

// ---------------------------------------------------------------- dates, probes (shared with contraption configs, §4.2)
/** Calendar dates as "YYYY", "YYYY-MM" or "YYYY-MM-DD". Year probes use fractional years (1965.167 = Mar 1965). */
export const DateString = z.string().regex(/^\d{4}(-(0[1-9]|1[0-2])(-(0[1-9]|[12]\d|3[01]))?)?$/, "dates are YYYY, YYYY-MM or YYYY-MM-DD");
export const ProbeFormat = z.enum(["number", "pi", "integer", "stage", "percent", "year", "month_year"]);
export type ProbeFormat = z.infer<typeof ProbeFormat>;
/** The ungraded orange scrubber (amendment 3). Declared in a contraption's config; never reaches grade(). */
export const ProbeSpec = z.strictObject({
  symbol: z.string().min(1).max(8),                   // input tab: "x", "d", "a", "s", "r", "k", "YEAR"
  label: z.string().min(1).max(24),                   // "probe depth", "dye load", "pump stage"
  min: z.number(),
  max: z.number(),
  step: z.number().positive(),                        // ←/→ step; Shift = 10 steps
  unit: z.string().max(12).default(""),               // "nm", "mM", "%", "ATP/s", ""
  format: ProbeFormat.default("number"),
  initial: z.number().nullable().default(null),       // null = min
  stops: z.array(z.strictObject({ v: z.number(), label: z.string().min(1).max(16) })).max(16).default([]),   // stage names (cell e8)
  window: z.strictObject({ start: z.number(), end: z.number() }).nullable().default(null),                    // Record Strip window (history)
  playback: z.boolean().default(false),               // auto-plays min → max during the success timeline (cell e10)
});
export type ProbeSpec = z.infer<typeof ProbeSpec>;
export const EarnedPin = z.strictObject({
  date: DateString,
  precision: z.enum(["day", "month", "year"]),
  label: z.string().min(1).max(40),
  lane: Id,                                           // a RecordStrip lane id
  spanTo: DateString.nullable().default(null),        // bands (the 381-day boycott)
});

// ---------------------------------------------------------------- lines & speakers (amendments 1, 9)
/** speakerId ∈ spec.characters ∪ cast.extras ∪ {PLAYER_SPEAKER, NARRATOR_SPEAKER} (R2). */
export const PLAYER_SPEAKER = "player";
export const NARRATOR_SPEAKER = "narrator";
export const Mood = z.enum(["neutral", "excited", "worried", "solemn", "wry"]);
export const WorldLine = z.strictObject({
  speakerId: Id,
  text: z.string().min(1).max(240),                   // R9: authored lines ≤ 140 characters
  mood: Mood.default("neutral"),
});
export type WorldLine = z.infer<typeof WorldLine>;
/** A station dialogue slot. speakerId null = the guide (cast.guide.characterId). */
export const LineSlot = z.strictObject({
  speakerId: Id.nullable().default(null),
  text: z.string().min(1).max(240),
  mood: Mood.default("neutral"),
});
export type LineSlot = z.infer<typeof LineSlot>;

// ---------------------------------------------------------------- cast
export const EmblemGlyph = z.enum([
  "labyrinth", "orrery", "gear", "owl", "cell", "wave", "quill", "lantern", "star", "leaf", "flame", "nib",
  "slit", "crab", "reel", "slug", "maws", "triskelion", "hexagon", "hourglass", "plus", "headset", "eyeshade", "flashlight",
]);
export const Emblem = z.strictObject({
  glyph: EmblemGlyph,
  ring: HexColor,
  accent: HexColor,
  gaps: z.number().int().min(0).max(4).default(2),    // broken-ring gaps (bible §3.9)
});
export const RigAnchor = z.enum(["head", "face", "torso", "back", "hand_l", "hand_r", "feet"]);
/** A human character on the one Kenney rig (§5.5): a recoloured body atlas + costume overlays on per-frame anchors. */
export const CharacterLook = z.strictObject({
  atlas: AssetKey,                                    // "shared.char.wren": kind "atlas" in the shared manifest
  costume: z.array(z.strictObject({
    asset: AssetKey,                                  // "orrery_terraces.costume.scarf_teal"
    anchor: RigAnchor,
    dx: z.number().min(-80).max(80).default(0),
    dy: z.number().min(-80).max(80).default(0),
    follow: z.enum(["rigid", "spring"]).default("rigid"),   // spring: scarf tails lag behind motion
    layer: z.enum(["behind", "front"]).default("front"),
  })).max(4).default([]),
  scale: z.number().min(0.7).max(1.3).default(1),
});
export type CharacterLook = z.infer<typeof CharacterLook>;
/** A speaker that is not a spec character: NPCs, mimics, the recorded astronomer, the narrator voice (amendment 1). */
export const Speaker = z.strictObject({
  id: Id,                                             // unique across spec.characters, extras, "player", "narrator"
  name: z.string().min(1).max(32),
  role: z.string().min(1).max(60),
  voiceArchetype: VoiceArchetype,
  emblem: Emblem,
  portrait: AssetKey.nullable().default(null),        // porthole portrait; sensitive biomes: *.doc.* / *.silhouette.* only
});
export const Cast = z.strictObject({
  protagonist: z.strictObject({ name: z.string().min(1).max(24), look: CharacterLook }),
  guide: z.strictObject({
    characterId: Id,                                  // a spec.characters id; the dialogue bar's default emblem
    emblem: Emblem,
    portrait: AssetKey.nullable().default(null),
    companion: z.strictObject({                       // Cog the brass owl, Pip the mini-sub, Wick the lantern
      asset: AssetKey,                                // idle pose; "<asset>_<pose>" siblings are used when present
      offset: z.tuple([z.number().min(-200).max(200), z.number().min(-300).max(0)]).default([-40, -150]),
      lagSec: z.number().min(0.05).max(1).default(0.35),
      bobPx: z.number().min(0).max(12).default(4),
    }),
  }),
  /** emblems for the other spec.characters (bosses); speakers without an entry use the guide's emblem desaturated */
  speakers: z.array(z.strictObject({ characterId: Id, emblem: Emblem, portrait: AssetKey.nullable().default(null) })).max(4).default([]),
  extras: z.array(Speaker).max(10).default([]),
});

// ---------------------------------------------------------------- story, purpose (amendment 24)
export const Meter = z.strictObject({
  id: Id,
  label: z.string().min(1).max(16),                   // "GRADIENT"
  unit: z.enum(["percent", "count"]),
  start: z.number().min(0).max(100),
  perEncounter: z.array(z.strictObject({ encounterId: Id, value: z.number().min(0).max(100) })).max(20),  // value AFTER that solve
  drives: z.array(z.enum(["hud_bar", "ambient_particles", "saturation"])).max(3).default(["hud_bar"]),
});
export const ProgressEffect = z.discriminatedUnion("kind", [
  // a code-drawn 3-line beam in a far layer (trig L1 beams to the Orrery, civil record-light beams)
  z.strictObject({ kind: z.literal("beam_line"), encounterId: Id, zoneId: Id, from: Point, to: Point,
                   depth: z.enum(["L1_far", "L2_midfar", "L3_mid"]).default("L1_far") }),
  // a prop changes state (uses PropPlacement.states alternates)
  z.strictObject({ kind: z.literal("prop_state"), encounterId: Id, propId: Id, state: z.enum(["restored", "lit", "revealed", "hidden"]) }),
  // a DOM label on a prop anchor swaps text (civil wall of front pages); after null = the encounter's debriefLine
  z.strictObject({ kind: z.literal("label_swap"), encounterId: Id, propId: Id, anchor: Id,
                   before: z.string().min(1).max(60), after: z.string().min(1).max(160).nullable().default(null) }),
  // one hub socket lights (cell pore sockets, civil Engine lenses, trig dome constellations)
  z.strictObject({ kind: z.literal("hub_socket"), encounterId: Id, zoneId: Id, socket: z.number().int().min(0).max(19) }),
]);
export const MapOverlay = z.strictObject({
  style: z.enum(["terraces_profile", "cell_rings", "transit_line"]),
  title: z.string().min(1).max(32),
  nodes: z.array(z.strictObject({
    id: Id,
    label: z.string().min(1).max(32),
    sub: z.string().min(1).max(24).nullable().default(null),       // "1957", "Zone B"
    zoneId: Id,
    stations: z.array(Id).max(4).default([]),                     // encounter ids shown as seal glyphs
    at: z.tuple([z.number().min(0).max(1), z.number().min(0).max(1)]),  // position on the map card
  })).min(2).max(12),
  tabs: z.array(z.enum(["map", "journal", "mastery", "shards"])).min(1).max(4),
});
export const JournalSpec = z.strictObject({
  title: z.string().min(1).max(24),                   // "Journal", "Logbook", "Clipping Case"
  style: z.enum(["parchment", "logbook", "clippings"]),
});
/** History games: the RECORD card's lanes and the pins each solve earns (civil §5.0.2). */
export const RecordStrip = z.strictObject({
  lanes: z.array(z.strictObject({ id: Id, label: z.string().min(1).max(20) })).min(1).max(4),
  pins: z.array(z.strictObject({ encounterId: Id, pin: EarnedPin })).max(40),
});
export const Story = z.strictObject({
  logline: z.string().min(1).max(200),
  objective: z.string().min(1).max(80),               // "Restore the orrery's starlight"
  objectiveLabel: z.string().min(1).max(20),          // ring label: "RHYTHMS", "GATES", "RECORD RESTORED"
  restoredNoun: z.string().min(1).max(24),            // "rhythm", "gate", "record"
  introCutsceneId: Id,
  finaleCutsceneId: Id,
  meter: Meter.nullable().default(null),
  progressEffects: z.array(ProgressEffect).max(60).default([]),
  map: MapOverlay.nullable().default(null),
  journal: JournalSpec.default({ title: "Journal", style: "parchment" }),
  recordStrip: RecordStrip.nullable().default(null),
});

// ---------------------------------------------------------------- zones (amendments 2, 20, 23)
export const Sky = z.strictObject({
  stops: z.array(z.strictObject({ at: z.number().min(0).max(1), color: HexColor })).min(3).max(6),
  haze: z.strictObject({ color: HexColor, alpha: z.number().min(0).max(0.6) }),
});
export const Depth = z.enum(["L1_far", "L2_midfar", "L3_mid", "L5_fore", "L6_light"]);
export const ParallaxLayer = z.strictObject({
  asset: AssetKey,
  depth: Depth,
  scrollFactor: z.number().min(0).max(1.6),           // bible §5.2: L1 0.15, L2 0.35, L3 0.6, L5 1.25–1.4, L6 1.0
  scrollFactorY: z.number().min(0).max(1.6).nullable().default(null),   // null = same as x (vertical parallax in tall zones)
  y: Y,                                               // top edge of the layer
  repeatX: z.boolean().default(true),
  alpha: z.number().min(0).max(1).default(1),
  blend: z.enum(["normal", "multiply", "add", "screen"]).default("normal"),
  blurPx: z.number().min(0).max(8).default(0),
  driftPxPerSec: z.number().min(-60).max(60).default(0),
});
export const LayerSet = z.strictObject({ id: Id, layers: z.array(ParallaxLayer).min(3).max(10) });
export const AmbientLight = z.enum(["day", "peach", "dusk", "night", "interior", "aqua", "amber", "dawn"]);
export const Ambient = z.strictObject({
  light: AmbientLight,
  particles: z.enum(["none", "dust", "motes", "pollen", "spores", "bubbles", "rain", "embers", "stars", "scraps"]).default("none"),
  particleCount: z.number().int().min(0).max(120).default(24),          // §2.11 caps
  shadowColor: HexColor.default("#6E7F9A"),                             // coloured, never black (bible §5.3)
  dapple: AssetKey.nullable().default(null),
  grade: z.strictObject({                                               // camera ColorMatrix (finish stack §5.6)
    saturation: z.number().min(-1).max(1).default(0),
    brightness: z.number().min(-0.5).max(0.5).default(0),
    hue: z.number().min(-30).max(30).default(0),
  }).prefault({}),
});
export const Weather = z.enum(["clear", "rain_heavy", "rain_light", "paper_drift", "current", "streaming", "mist", "drip"]);
export const MusicCue = z.enum(["curious", "tense", "playful", "noir", "boss", "calm", "solemn"]);
/** A lighting/look span of a zone. Segments are contiguous, ordered and cover [0, zone.width]; 1 s crossfade at boundaries. */
export const Segment = z.strictObject({
  id: Id,
  x0: X,
  x1: X,
  layerSet: Id,
  sky: Sky,
  ambient: Ambient,
  weather: Weather.default("clear"),
  music: MusicCue.nullable().default(null),
  runEnabled: z.boolean().default(true),              // false on the civil S7 bridge crossing
  /** the last variant whose requirement holds overrides these fields (civil S7: the rain stops after e9) */
  variants: z.array(z.strictObject({
    requires: Requirement,
    sky: Sky.nullable().default(null),
    weather: Weather.nullable().default(null),
    music: MusicCue.nullable().default(null),
  })).max(2).default([]),
});
/** A cutaway interior: while the player's x is in [x0, x1] the façade fades to 20 % over 300 ms (civil §2.4). */
export const Interior = z.strictObject({
  id: Id,
  x0: X,
  x1: X,
  facade: AssetKey,
  facadeAt: Point,                                    // façade top-left
  segment: Id.nullable().default(null),               // lighting segment used while inside
});
export const Ground = z.strictObject({
  points: z.array(Point).min(2).max(96),              // heightfield: x strictly ascending, spans [0, zone.width]
  surface: AssetKey,
  underside: AssetKey.nullable().default(null),
  maxStepUp: z.number().min(40).max(140).default(102),   // 0.6 H: a rise above this blocks walking (walls, ledges)
});
export const Platform = z.strictObject({
  id: Id,
  points: z.array(Point).min(2).max(24),              // walkable polyline, x strictly ascending
  asset: AssetKey.nullable().default(null),           // null: an invisible surface over drawn art (cornice, rafters)
  requires: Requirement.nullable().default(null),     // absent (not walkable, not drawn) until met
});
export const LinkEnd = z.strictObject({ surface: SurfaceRef.default("ground"), x: X });
const LinkBase = {
  id: Id,
  from: LinkEnd,
  to: LinkEnd,
  requires: Requirement.nullable().default(null),
};
/** Authored traversal (amendment 2). Scripted arcs; no physics engine. §2.4.2 gives the arc maths. */
export const TraversalLink = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("hop"), ...LinkBase, apex: z.number().min(20).max(400).default(120), twoWay: z.boolean().default(true) }),
  z.strictObject({ kind: z.literal("climb"), ...LinkBase, twoWay: z.boolean().default(true) }),      // fire escapes, rigging, trusses
  z.strictObject({ kind: z.literal("ladder"), ...LinkBase, asset: AssetKey.nullable().default(null), twoWay: z.boolean().default(true) }),
  z.strictObject({ kind: z.literal("drop"), ...LinkBase }),                                          // one way (S / ↓)
  z.strictObject({
    kind: z.literal("timed_hop"), ...LinkBase,
    periodSec: z.number().min(0.5).max(12),
    phase: z.number().min(0).max(1).default(0),       // cycle fraction at zone entry
    open: z.tuple([z.number().min(0).max(1), z.number().min(0).max(1)]),   // hop succeeds when the cycle fraction ∈ [open[0], open[1])
    missTo: LinkEnd,                                  // a mistimed hop lands here (no damage, "!" emote)
    driverPropId: Id.nullable().default(null),        // the swinging prop: x-offset = amplitude · sin(2π(t / periodSec + phase))
    amplitude: z.number().min(0).max(400).default(120),
  }),
  z.strictObject({
    kind: z.literal("ride"), ...LinkBase,
    vehicle: AssetKey,
    path: z.array(Point).min(2).max(16),              // vehicle anchor path; the player stands on its top
    ms: Ms,
    twoWay: z.boolean().default(false),
  }),
]);
export type TraversalLink = z.infer<typeof TraversalLink>;
export const ZoneExit = z.strictObject({
  id: Id,
  x: X,                                               // walking past x (rightward) on `surface` leaves the zone
  surface: SurfaceRef.default("ground"),
  toZoneId: Id,
  toX: X,
  toSurface: SurfaceRef.default("ground"),
  transition: z.enum(["walk", "film_seam", "fade", "vertical_up", "vertical_down"]).default("walk"),
  requires: Requirement.nullable().default(null),
  cutsceneId: Id.nullable().default(null),            // optional transition cutscene (civil X-lines)
});
export const Hub = z.strictObject({
  asset: AssetKey,
  x: X,
  y: Y.nullable().default(null),                      // null: sits on the ground at x
  depth: z.enum(["L3_mid", "L4_back"]).default("L3_mid"),
  label: z.string().min(1).max(40),
  sockets: z.number().int().min(0).max(20).default(0),   // lit by hub_socket progress effects
  restoredLine: WorldLine,
});
export const ZoneCamera = z.strictObject({
  xDeadzone: z.number().min(0.1).max(0.5).default(0.3),  // fraction of the view width
  yDeadzone: z.number().min(80).max(540).default(260),   // design units of vertical freedom before the camera follows
  lerp: z.number().min(0.04).max(0.3).default(0.12),
  minZoom: z.number().min(0.5).max(1).default(0.6),
  maxZoom: z.number().min(1).max(1.5).default(1.15),
});
export const Zone = z.strictObject({
  id: Id,
  name: z.string().min(1).max(40),
  width: z.number().min(1920).max(12_000),
  height: z.number().min(1080).max(4_320),
  layerSets: z.array(LayerSet).min(1).max(4),
  segments: z.array(Segment).min(1).max(6),
  interiors: z.array(Interior).max(4).default([]),
  ground: Ground,
  platforms: z.array(Platform).max(24).default([]),
  links: z.array(TraversalLink).max(32).default([]),
  exits: z.array(ZoneExit).max(4).default([]),
  hub: Hub.nullable().default(null),                  // the zone's big machine (5–6 H); null for a transit zone
  entry: z.strictObject({ x: X, surface: SurfaceRef.default("ground") }),
  entryCutsceneId: Id.nullable().default(null),
  camera: ZoneCamera.prefault({}),
});
export type Zone = z.infer<typeof Zone>;

// ---------------------------------------------------------------- stations (one per encounter)
export const LayoutMode = z.enum(["scrub", "board", "vault"]);     // no "sluice" (amendment 33): sluice stations use scrub
export type LayoutMode = z.infer<typeof LayoutMode>;
export const PayoffKind = z.enum(["terrain", "ride", "remove_blocker", "carry"]);
export const PayoffVertical = z.enum(["up", "down", "none"]);
export const PayoffAnim = z.enum([
  "stairs_rise", "bridge_forms", "ramp_forms", "steps_emerge", "stairwell_opens",                     // terrain
  "lift_moves", "water_rises", "tram_departs",                                                       // ride (board with E/W after success)
  "door_opens", "gate_lifts", "barrier_lifts", "barrier_dissolves", "beam_restores", "vault_opens",  // remove_blocker
  "door_carries", "vesicle_carries",                                                                 // carry (plays automatically)
]);
export type PayoffAnim = z.infer<typeof PayoffAnim>;
export const PAYOFF_KIND_OF: Readonly<Record<PayoffAnim, z.infer<typeof PayoffKind>>> = {
  stairs_rise: "terrain", bridge_forms: "terrain", ramp_forms: "terrain", steps_emerge: "terrain", stairwell_opens: "terrain",
  lift_moves: "ride", water_rises: "ride", tram_departs: "ride",
  door_opens: "remove_blocker", gate_lifts: "remove_blocker", barrier_lifts: "remove_blocker",
  barrier_dissolves: "remove_blocker", beam_restores: "remove_blocker", vault_opens: "remove_blocker",
  door_carries: "carry", vesicle_carries: "carry",
};
export const Payoff = z.strictObject({
  kind: PayoffKind,                                   // must equal PAYOFF_KIND_OF[anim] (R6)
  vertical: PayoffVertical,                           // W1 counts payoffs with vertical ≠ "none"
  anim: PayoffAnim,                                   // ∈ meta.payoffs (R5)
  noun: z.string().min(1).max(32),                    // "spoke stair", "Echo Lift", "vesicle" (SR text, HUD)
  /** the wall/gap the player cannot pass until this station is solved (null: nothing blocks) */
  blocker: z.strictObject({ x: X, surface: SurfaceRef.default("ground"), asset: AssetKey.nullable().default(null) }).nullable(),
  /** terrain: walkable segments added on success (merged into the ground heightfield, or activating a platform) */
  terrain: z.array(z.strictObject({ surface: SurfaceRef.default("ground"), points: z.array(Point).min(2).max(32) })).max(3).default([]),
  /** ride: E/W on the vehicle after success runs it; carry: runs automatically after the success animation */
  rideCutsceneId: Id.nullable().default(null),
  autoBoardMs: Ms.nullable().default(null),           // ride: auto-board after this long (cell e4 raft: 6000)
  feedsHub: z.boolean().default(true),
});

export const AxisUnit = z.enum(["number", "pi", "year", "month", "percent", "mM", "nm", "count", "seconds", "rate", "stage"]);
export type AxisUnit = z.infer<typeof AxisUnit>;
export const Axis = z.strictObject({
  min: z.number(), max: z.number(), unit: AxisUnit,
  label: z.string().min(1).max(16).nullable().default(null),
});
/** Presentation overrides only: card DATA always comes from the contraption meta + the encounter view. */
export const CardOverride = z.strictObject({
  slot: z.number().int().min(0).max(3),
  title: z.string().min(1).max(16).nullable().default(null),
  x: Axis.nullable().default(null),
  y: Axis.nullable().default(null),
  hidden: z.boolean().default(false),
});
export const PanelOverride = z.strictObject({
  layout: LayoutMode.nullable().default(null),        // null -> the contraption's default
  inputSymbol: z.string().min(1).max(8).nullable().default(null),   // "T", "θ", "year", "item"
  verifyLabel: z.string().min(1).max(24),             // "LOCK THE RINGS"
  successBadge: z.string().min(1).max(28),            // "RINGS LOCKED"
  cards: z.array(CardOverride).max(4).default([]),
});

/** Misconception probes (amendment 11): evaluated ONLY after a failed Verify, against the submitted Input. */
export const MisconceptionProbe = z.discriminatedUnion("predicate", [
  z.strictObject({ predicate: z.literal("nearValue"), value: z.string().min(1).max(40), tolFactor: z.number().min(0.25).max(4).default(1), key: Id }),   // exact mathjs expr
  z.strictObject({ predicate: z.literal("keyInSlot"), itemKey: z.string().min(1).max(8), slot: z.number().int().min(0).max(11).nullable().default(null), key: Id }),
  z.strictObject({ predicate: z.literal("decoyPresent"), itemKey: z.string().min(1).max(8).nullable().default(null), key: Id }),
  z.strictObject({ predicate: z.literal("aimedIndex"), index: z.number().int().min(0).max(11), key: Id }),           // statementIndex / optionIndex
  z.strictObject({ predicate: z.literal("linkedTo"), fromKey: z.string().min(1).max(8), toKey: z.string().min(1).max(8), key: Id }),   // pairs lN→rM, chain nA→nB
  z.strictObject({ predicate: z.literal("assignedTo"), itemKey: z.string().min(1).max(8), binId: Id, key: Id }),
]);
export type MisconceptionProbe = z.infer<typeof MisconceptionProbe>;

export const PinGlyph = z.enum(["bell", "metronome", "star", "door", "drop", "key", "chord", "lap"]);
export const PinPlacement = z.strictObject({
  anchor: Id,                                         // a prefab anchor ("tally", "pylon_a", "doorway")
  text: z.string().min(1).max(12).nullable().default(null),   // R8 applies; a view target, a count, never an ask answer
  glyph: PinGlyph.nullable().default(null),
});
export const Accessory = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("record_lens"),                   // civil: a brass carriage on a rail, driven by the station's year probe
    rail: z.array(Point).min(2).max(24),              // polyline (e9 follows the arch)
    carriage: AssetKey,
    cone: z.strictObject({ target: Point, asset: AssetKey }).nullable().default(null),
  }),
]);
/** Boss staging (amendments 8, 18). Presentation only: one Input, one grade(). */
export const BossStaging = z.strictObject({
  speakerId: Id,                                      // the boss voice: a spec character (warden, gatekeeper, editor)
  arenaTriggerX: X,                                   // crossing it (same zone) plays the arena cutscene once
  arenaCutsceneId: Id.nullable().default(null),
  arenaBounds: z.strictObject({ x0: X, x1: X }).nullable().default(null),   // camera clamp while in the arena
  phases: z.array(z.strictObject({                    // board modes: batches of item keys revealed in the panel in order
    id: Id,
    itemKeys: z.array(z.string().min(1).max(8)).min(1).max(8),
    line: WorldLine.nullable().default(null),         // spoken when the batch appears
  })).max(4).default([]),                             // non-empty ⇒ partitions the view's item keys (R15)
  taunts: z.strictObject({
    approach: z.array(WorldLine).max(3).default([]),
    fail: z.array(WorldLine).max(4).default([]),      // cycled by attempt when byKey has no match
    byKey: z.array(z.strictObject({ key: Id, line: WorldLine })).max(6).default([]),
  }).prefault({}),
  music: MusicCue.default("boss"),
});
export const StationDialogue = z.strictObject({
  approach: z.array(WorldLine).max(3).default([]),    // once, on entering approachRadius (explore, non-blocking)
  instruction: LineSlot,                              // line 1 while the panel is open: imperative, names a noun (R9), ≤ 140
  tutorial: LineSlot.nullable().default(null),        // line 2 on the FIRST panel open only
  insight: LineSlot.nullable().default(null),         // line 2 afterwards: the PRE-success, hint-free truth (R8 applies)
  hints: z.tuple([LineSlot, LineSlot, LineSlot]).nullable().default(null),   // guide-voiced rungs; null = fixture hints verbatim
  fail: z.strictObject({
    default: LineSlot,
    byKey: z.array(z.strictObject({ key: Id, line: LineSlot })).max(10).default([]),   // probe keys, near-miss keys, fail keys
  }),
  success: LineSlot,                                  // the POST-success concept statement; replaces the instruction (may state the answer)
  payoffLine: LineSlot.nullable().default(null),      // toast while the payoff animates (trig "success2")
  after: z.array(WorldLine).max(3).default([]),       // explore, after the payoff
});
export const Station = z.strictObject({
  encounterId: Id,
  zoneId: Id,
  consoleX: X,                                        // the lectern/kiosk the player walks to (amendment 8)
  consoleSurface: SurfaceRef.default("ground"),
  consoleAsset: AssetKey.nullable().default(null),    // null: the skin's default console part
  anchor: z.strictObject({ x: X, y: Y }),             // contraption origin in zone units (dial centre, ring centre, chasm centre)
  approachRadius: z.number().min(150).max(1500).default(500),
  contraption: Id,                                    // key in CONTRAPTION_LIBRARY
  skin: Id,                                           // one of that contraption's skins
  config: z.record(z.string(), z.unknown()).default({}),   // parsed by meta.configSchema (§4.2)
  objectNoun: z.string().min(1).max(40),              // "Tidewheel Gate"
  partNouns: z.array(z.string().min(1).max(32)).max(6).default([]),   // "carriage", "latch timer", "probe" (R9)
  pins: z.array(PinPlacement).max(4).default([]),
  accessories: z.array(Accessory).max(2).default([]),
  frameZoom: z.number().min(0.5).max(1.5).nullable().default(null),   // overrides the zoom frameFor computes (amendment 32)
  probes: z.array(MisconceptionProbe).max(6).default([]),
  panel: PanelOverride,
  dialogue: StationDialogue,
  payoff: Payoff,
  boss: BossStaging.nullable().default(null),
});
export type Station = z.infer<typeof Station>;

// ---------------------------------------------------------------- dressing & side content (amendments 15, 16, 17, 24)
export const PropPlacement = z.strictObject({
  id: Id.nullable().default(null),                    // required when referenced (touch, progress effects, timed_hop driver)
  zoneId: Id,
  asset: AssetKey,
  x: X,
  y: Y.nullable().default(null),                      // null: sits on `surface` at x
  surface: SurfaceRef.default("ground"),
  layer: z.enum(["L3_mid", "L4_back", "L4_play", "L5_fore"]).default("L4_back"),
  scale: z.number().min(0.1).max(4).default(1),
  flipX: z.boolean().default(false),
  sway: z.boolean().default(false),
  glow: z.boolean().default(false),
  restoredBy: Id.nullable().default(null),            // dormant (desaturated, glow off) until this encounter is solved
  states: z.array(z.strictObject({ state: z.enum(["restored", "lit", "revealed", "hidden"]), asset: AssetKey.nullable().default(null) })).max(3).default([]),
  touch: z.strictObject({                             // quest "touch" targets (Kay's lanterns)
    requires: Requirement.nullable().default(null),
    litAsset: AssetKey.nullable().default(null),
    lines: z.array(WorldLine).max(2).default([]),
    cue: Id.nullable().default(null),
  }).nullable().default(null),
});
export const NpcPose = z.enum(["idle", "talk", "think", "work", "wave", "cheer", "sit", "ride", "hidden"]);
export const NpcState = z.strictObject({
  id: Id,
  requires: Requirement.nullable().default(null),     // the LAST state whose requirement holds is the active one
  zoneId: Id,
  x: X,
  surface: SurfaceRef.default("ground"),
  lines: z.array(WorldLine).min(1).max(6),
  pose: NpcPose.default("idle"),
  follow: z.enum(["none", "player", "satchel"]).default("none"),   // Sucra escorts; Quill rides the satchel
  repeatable: z.boolean().default(false),
  setFlag: Id.nullable().default(null),               // set when this state's lines finish
  anim: Id.nullable().default(null),                  // a named part animation on the NPC puppet ("arm_sync")
});
export const Npc = z.strictObject({
  id: Id,
  name: z.string().min(1).max(32),
  speakerId: Id,                                      // a spec character or a cast.extras id
  look: CharacterLook.nullable().default(null),       // human NPCs on the Kenney rig ...
  asset: AssetKey.nullable().default(null),           // ... or a machine/creature puppet; exactly one of the two (R12)
  states: z.array(NpcState).min(1).max(6),
});
export const QuestStep = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("talk"), npcId: Id, stateId: Id.nullable().default(null) }),
  z.strictObject({ kind: z.literal("collect"), ids: z.array(Id).min(1).max(8) }),
  z.strictObject({ kind: z.literal("touch"), propIds: z.array(Id).min(1).max(8) }),
  z.strictObject({ kind: z.literal("afterSeal"), encounterId: Id }),
  z.strictObject({ kind: z.literal("visit"), triggerId: Id }),
]);
export const Quest = z.strictObject({
  id: Id,
  title: z.string().min(1).max(40),
  giverNpcId: Id.nullable().default(null),
  steps: z.array(QuestStep).min(1).max(6),            // completed in order
  reward: z.strictObject({
    flag: Id,                                         // set on completion
    lines: z.array(WorldLine).max(3).default([]),
    collectibleId: Id.nullable().default(null),
    cosmetic: AssetKey.nullable().default(null),      // e.g. gold scarf trim overlay
    debriefLine: z.string().min(1).max(160).nullable().default(null),
  }),
});
export const Trigger = z.strictObject({
  id: Id,
  zoneId: Id,
  x: X,
  surface: SurfaceRef.default("ground"),
  radius: z.number().min(40).max(1500).default(240),
  kind: z.enum(["ambient", "arrival", "hint"]).default("ambient"),   // ambient = toast; arrival = bar, story priority; hint = after 20 s idle
  lines: z.array(WorldLine).min(1).max(4),
  once: z.boolean().default(true),
  requires: Requirement.nullable().default(null),
  setFlag: Id.nullable().default(null),
  cue: Id.nullable().default(null),
});
export const Collectible = z.strictObject({
  id: Id,
  kind: z.enum(["shard", "page", "negative"]),        // wisps are "shard"s with the biome's wisp sprite
  zoneId: Id,
  x: X,
  y: Y.nullable().default(null),
  surface: SurfaceRef.default("ground"),
  asset: AssetKey.nullable().default(null),           // null: the kind's shared sprite
  title: z.string().min(1).max(40),
  text: z.string().min(1).max(320),
  conceptId: Id.nullable().default(null),
  sourceRef: SourceRef.nullable().default(null),      // pages and negatives quote verified text
  requires: Requirement.nullable().default(null),
});
export const Plaque = z.strictObject({                // readable lore; history plaques quote verified sources
  id: Id,
  zoneId: Id,
  x: X,
  surface: SurfaceRef.default("ground"),
  asset: AssetKey,
  kind: z.enum(["plaque", "document", "photo_withheld"]).default("plaque"),
  title: z.string().min(1).max(48),
  text: z.string().min(1).max(320),
  sourceRef: SourceRef.nullable().default(null),
  requires: Requirement.nullable().default(null),
});
/** A contraption-like interactable with no runner, no Verify and no grade (amendment 17, §2.4b). */
export const Sandbox = z.strictObject({
  id: Id,
  zoneId: Id,
  consoleX: X,
  surface: SurfaceRef.default("ground"),
  anchor: z.strictObject({ x: X, y: Y }),
  contraption: Id,                                    // a SANDBOX_LIBRARY id: music_box, plant_garden, darkroom
  skin: Id,
  config: z.record(z.string(), z.unknown()).default({}),
  title: z.string().min(1).max(40),
  objectNoun: z.string().min(1).max(40),
  requires: Requirement.nullable().default(null),     // hidden until met
  lines: z.strictObject({
    open: z.array(WorldLine).max(3).default([]),
    idle: z.array(WorldLine).max(2).default([]),      // after 20 s without input
  }).prefault({}),
  goal: Id.nullable().default(null),                  // one of meta.goals; null = no reward
  reward: z.strictObject({
    flag: Id.nullable().default(null),
    lines: z.array(WorldLine).max(3).default([]),
    cosmetic: AssetKey.nullable().default(null),
    debriefLine: z.string().min(1).max(160).nullable().default(null),
  }).nullable().default(null),
  frameZoom: z.number().min(0.5).max(1.5).nullable().default(null),
});

// ---------------------------------------------------------------- cutscenes (data, run by the host; amendment 25)
export const InteractRef = z.strictObject({ kind: z.enum(["npc", "prop", "station", "sandbox"]), id: Id });
export const StateTarget = z.strictObject({ kind: z.enum(["prop", "npc", "station", "hub", "flag"]), id: Id });
export const CameraShot = z.strictObject({ x: z.number(), y: z.number(), zoom: z.number().min(0.3).max(2) });
export const CutsceneStep = z.discriminatedUnion("do", [
  z.strictObject({ do: z.literal("fade"), to: z.enum(["black", "clear", "white"]), ms: Ms }),
  z.strictObject({ do: z.literal("title"), text: z.string().min(1).max(60), sub: z.string().min(1).max(80).nullable().default(null), ms: Ms }),
  z.strictObject({ do: z.literal("enter_zone"), zoneId: Id, x: X, surface: SurfaceRef.default("ground") }),
  z.strictObject({ do: z.literal("pan"), x: X, y: Y.nullable().default(null), zoom: z.number().min(0.5).max(2).default(1), ms: Ms }),
  z.strictObject({ do: z.literal("camera"), x: X.nullable().default(null), y: Y.nullable().default(null),
                   zoom: z.number().min(0.5).max(2).nullable().default(null), ms: Ms,
                   ease: z.enum(["linear", "out_cubic", "in_out_sine"]).default("out_cubic") }),   // vertical tweens
  z.strictObject({ do: z.literal("walk"), actor: Id, toX: X }),                  // "player" | "companion" | an npc id
  z.strictObject({ do: z.literal("say"), lines: z.array(WorldLine).min(1).max(6) }),
  z.strictObject({ do: z.literal("emote"), actor: Id, glyph: z.enum(["!", "?", "♪", "…", "♥"]) }),
  z.strictObject({ do: z.literal("wait"), ms: Ms }),
  z.strictObject({ do: z.literal("station"), encounterId: Id, anim: z.enum(["wake", "succeed", "settle"]) }),
  z.strictObject({ do: z.literal("hub"), zoneId: Id, state: z.enum(["dormant", "partial", "restored"]) }),
  z.strictObject({ do: z.literal("ride"), vehicle: AssetKey, toZoneId: Id, toX: X, ms: Ms,
                   path: z.array(Point).max(16).default([]) }),                  // path in the CURRENT zone before the swap
  z.strictObject({ do: z.literal("sfx"), cue: Id }),                             // §2.12 cue bank
  z.strictObject({ do: z.literal("music"), cue: MusicCue.nullable() }),
  // interactive steps: the timeline pauses until the player acts; skip() applies their end state
  z.strictObject({ do: z.literal("await_interact"), target: InteractRef, prompt: z.string().min(1).max(40),
                   timeoutMs: Ms.nullable().default(null) }),                    // trig intro: wind Cog
  z.strictObject({ do: z.literal("control_until"), x: X, surface: SurfaceRef.default("ground"),
                   prompt: z.string().min(1).max(40).nullable().default(null),
                   timeoutMs: Ms.default(20_000) }),                             // civil intro: walk down the stair; auto-walks on timeout
  // a composed image across zones (trig canyon, civil dawn skyline), drawn over everything while it plays
  z.strictObject({ do: z.literal("vista"), asset: AssetKey, from: CameraShot, to: CameraShot, ms: Ms, holdMs: Ms.default(1_500) }),
  z.strictObject({ do: z.literal("set_state"), target: StateTarget, state: Id }),   // flag: state "on" | "off"
]);
export type CutsceneStep = z.infer<typeof CutsceneStep>;
export const Cutscene = z.strictObject({ id: Id, skippable: z.boolean().default(true), steps: z.array(CutsceneStep).min(1).max(60) });

// ---------------------------------------------------------------- root
/** Display-only nouns applied to grade() feedback text (amendment 36): "chest" → "singer". Grading is untouched. */
export const FeedbackNoun = z.strictObject({
  from: z.string().min(1).max(24),
  to: z.string().min(1).max(24),
  stations: z.array(Id).max(20).nullable().default(null),   // null = every station
});
export const WorldOverlay = z.strictObject({
  worldVersion: z.literal(WORLD_VERSION),
  biome: Id,                                          // key in BIOME_KITS (src/world/biomes.ts)
  title: z.string().min(1).max(40),                   // "The Orrery Terraces"
  subtitle: z.string().min(1).max(60).nullable().default(null),
  cast: Cast,
  story: Story,
  zones: z.array(Zone).min(1).max(8),
  stations: z.array(Station).min(1).max(20),
  props: z.array(PropPlacement).max(600).default([]),
  npcs: z.array(Npc).max(16).default([]),
  quests: z.array(Quest).max(8).default([]),
  triggers: z.array(Trigger).max(40).default([]),
  sandboxes: z.array(Sandbox).max(4).default([]),
  collectibles: z.array(Collectible).max(16).default([]),
  plaques: z.array(Plaque).max(24).default([]),
  cutscenes: z.array(Cutscene).min(2).max(24),
  feedbackNouns: z.array(FeedbackNoun).max(8).default([]),
});
export type WorldOverlay = z.infer<typeof WorldOverlay>;
export type WorldOverlayInput = z.input<typeof WorldOverlay>;

/** Side-car wrapper: which specs this overlay dresses. Not part of GameSpec.world. */
export const WorldFile = z.strictObject({
  appliesTo: z.strictObject({
    specIds: z.array(z.string().min(1)).max(8),
    sources: z.array(z.strictObject({ sourceId: z.string().min(1), genre: Genre })).max(4),
  }),
  world: WorldOverlay,
});
export type WorldFile = z.infer<typeof WorldFile>;

// ---------------------------------------------------------------- asset manifest (public/assets/expedition/<ns>/manifest.json)
const Pivot = z.tuple([z.number().min(0).max(1), z.number().min(0).max(1)]);   // fractions of width/height (§5.1)
const ManifestAnchor = z.strictObject({ name: Id, x: z.number(), y: z.number() });   // design units, from <* id="anchor-<name>">
/** Kenney pose names are camelCase ("walk0", "behindBack"). */
export const PoseName = z.string().regex(/^[a-z][A-Za-z0-9]{0,23}$/);
export const ManifestEntry = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("svg"), key: AssetKey, file: z.string().min(1),
    width: z.number().int().min(1).max(8192), height: z.number().int().min(1).max(4096),
    /** texture size = design size × rasterScale × min(devicePixelRatio, 1.5); layers use ≤ 1 (§5.7) */
    rasterScale: z.number().min(0.25).max(2).default(1),
    tileWidth: z.number().int().min(256).max(2048).nullable().default(null),   // split wide layers into tiles
    pivot: Pivot.default([0.5, 1]),
    anchors: z.array(ManifestAnchor).max(32).default([]),
    source: z.enum(["hero", "kit"]),                   // hand-authored vs generated (§5.4); the hero cap counts "hero"
  }),
  z.strictObject({
    kind: z.literal("atlas"), key: AssetKey,           // one recoloured Kenney body (§5.5): an HD PNG + Phaser JSON-hash frames
    image: z.string().min(1),
    frames: z.string().min(1),
    frameWidth: z.literal(192),
    frameHeight: z.literal(256),
    poses: z.array(PoseName).min(1).max(45),
    pivot: Pivot.default([0.5, 1]),
    anchors: z.array(z.strictObject({
      pose: PoseName,
      points: z.array(z.strictObject({ name: RigAnchor, x: z.number(), y: z.number(), rot: z.number().default(0) })).max(7),
    })).max(45).default([]),
  }),
]);
export const AssetManifest = z.strictObject({
  namespace: Id,
  paletteId: Id,
  entries: z.array(ManifestEntry).max(800),
  totalBytes: z.number().int().min(0),
  vramEstimateMb: z.number().min(0),
  heroCount: z.number().int().min(0),                  // §5.8: ≤ 60 per biome namespace
});
export type AssetManifest = z.infer<typeof AssetManifest>;
```


The only edits to existing contracts:

```ts
// src/contracts/gamespec.ts (append to the GameSpec object)
  // ---- World Writer + code (optional; absent in every fixture until W8) ----
  world: WorldOverlay.optional(),

// src/contracts/common.ts
export type Owner = "director" | "challenge_writer" | "narrative" | "assessment" | "world_writer" | "code";

// src/contracts/index.ts
export * from "./world";
```

### 1.4 Why the six pinned tests stay green

| Test | Why it's unaffected |
|---|---|
| `fixtures-drift.test.ts` (5), `gamespec.test.ts:21` (trig) | Fixture JSON is not touched (side-cars live in `fixtures/worlds/`). `assembleGameSpec` doesn't emit `world`. `toEqual` compares the same objects. |
| `mock-models.test.ts`, `pipeline-mock.test.ts` | `generateGame` doesn't produce `world` until W8, which regenerates the fixtures and the mock recordings in one change (§6.5). |
| `gamespec.test.ts:15-19` (zero issues and warnings) | `validateWorld` only runs when `spec.world` exists. Side-cars are validated by separate tests. |
| `findFixtureSpecById`, `/play/fixture-<name>` | Both scan `fixtures/*.json` at the top level only. `worlds/` is a directory, and the name regex forbids dots. |

### 1.5 `validateWorld`: referential and semantic rules

`src/world/validate-world.ts` exports
`validateWorld(spec: GameSpec, world: WorldOverlay): { issues: Issue[]; warnings: Issue[] }`, the same split
`validateGameSpec` already uses (rules marked "warning" go to `warnings`; everything else to `issues`).

It is called by `validateGameSpec` when `spec.world` exists (paths start with `["world", …]`; both arrays are
appended to its own) and by `loadWorldFor` for side-cars (issues skip the side-car; warnings are logged server-side
only).

**Owner routing (`ownerFor`, `validate-gamespec.ts`):** a new `case "world"`.
- Fields the writer produces go to `world_writer`: `story.{logline, objective, objectiveLabel, restoredNoun}`,
  `cast.*.name`, `cast.extras`, `stations.*.{objectNoun, partNouns, pins, panel.verifyLabel, panel.successBadge,
  dialogue, config}`, and texts under `npcs`, `triggers`, `collectibles`, `plaques` and `cutscenes.*.steps.*.lines`.
- Everything geometric or structural goes to `code`: `zones`, `layers`, `ground`, `platforms`, `links`, station
  `consoleX`/`anchor`, `payoff`, `props`, `boss.arenaTriggerX`, `accessories`.

| # | Rule |
|---|---|
| R1 | **Assets.** `biome ∈ BIOME_KITS`. Every `AssetKey` exists in `ASSET_INDEX` (`src/world/asset-index/index.ts`, which merges the per-namespace generated files `{key → {ns, kind, width, height, anchors, source}}`), so there is no fs access. Its namespace is `shared` or the world's biome. Vista steps use keys in group `vista`; companions in group `companion`; `CharacterLook.atlas` keys are `kind: "atlas"`. |
| R2 | **Speakers** (amendment 1). `cast.guide.characterId` and every `cast.speakers[].characterId` ∈ `spec.characters`. `cast.extras[].id` are unique and disjoint from `spec.characters` ids and from `"player"`/`"narrator"`. Every `speakerId` (`WorldLine`, `LineSlot`, `Npc.speakerId`, `BossStaging.speakerId`) ∈ `spec.characters ∪ cast.extras ∪ {"player", "narrator"}`. |
| R3 | **Zones.** Zone ids unique; ≤ 8 zones. Segments ordered, contiguous, cover `[0, width]`; each `layerSet` exists in the zone. Interiors lie inside the zone and don't overlap. Exits point at existing zones and `toX` inside them. Zones may have no station (hubs, transit), but the boss station is in the last zone that has stations, and a warning fires when more than two consecutive zones have none. |
| R4 | **Stations are 1:1 with `spec.encounters` and follow encounter order**: `(zoneIndex, consoleX)` strictly increases with the encounter index. The runner is linear, so the world must be too. Sandboxes are not stations. |
| R5 | **Contraption compatibility.** `contraption ∈ CONTRAPTION_LIBRARY` and its meta's `modes` includes `` `${familyId}.${mode}` ``. `skin` ∈ the meta's skins and allows this biome. `config` parses with `meta.configSchema`, then `meta.validateConfig(config, ctx)` returns no errors (§4.4). `panel.layout`, if set, ∈ `meta.layouts`. `payoff.anim ∈ meta.payoffs`. Every `accessories[].kind ∈ meta.accessories`. Every `dialogue.fail.byKey[].key ∈ meta.nearMissKeys ∪ failKeysFor(mode) ∪ station.probes[].key` (§2.5.4). A meta with `status: "post_demo"` is a warning. |
| R6 | **Geometry.** Ground x strictly ascending from 0 to `width`, y ∈ `[0, height]`; platforms inside the zone. `consoleX`, `anchor` and `meta.frameBounds(config, view)` (translated to the anchor) lie inside the zone (frame: warning). `payoff.kind === PAYOFF_KIND_OF[payoff.anim]`. `payoff.blocker.x` lies between this station's `consoleX` and the next station's `consoleX` in the same zone (or the zone's right edge). `payoff.terrain` lies inside the zone. Ride and carry cutscenes end in a later zone, or later in the same zone. |
| R7 | **Cutscenes.** Ids unique. `story.introCutsceneId`, `story.finaleCutsceneId`, `zone.entryCutsceneId`, `exit.cutsceneId`, `payoff.rideCutsceneId` and `boss.arenaCutsceneId` exist. Step references resolve: `enter_zone`/`ride` zone ids, `station` encounter ids, `walk`/`emote` actors (`player`, `companion` or an npc id), `await_interact` targets, `set_state` targets (flags must be declared by R12), `vista` assets. Interactive steps (`await_interact`, `control_until`) only appear in skippable cutscenes (skip applies their end state). |
| R8 | **Answer leaks, token-boundary matching** (amendment 34). For each station, `bannedValues = answerVarsFor(mode, params).map(k => mode.templateVars(params, solution)[k])`. Each banned value and each checked text is normalized (NFKC, lower-case words, `π` and the word `pi` → `π`, `−` → `-`, whitespace collapsed) and **tokenized** by `src/world/answer-leak.ts`: a *math run* `(?:\d+(?:\.\d+)?\|π)(?:[/*^×]?(?:\d+(?:\.\d+)?\|π))*` is one token (`2π`, `5π/6`, `π/2`, `4.00`), words are `[a-z]+`, anything else is a single-character token. A banned value matches when its token sequence appears contiguously; two pure decimals match by numeric value (`4.00` = `4`). So `spin` never matches `π`, `2π/\|b\|` never matches `π`, `40` never matches `4`. **Station-scoped texts are errors**: `approach`, `instruction`, `tutorial`, `insight`, `hints[0]`, `hints[1]`, every `fail` line, `pins[].text`, `boss.taunts.approach/fail/byKey`. **Exempt**: `hints[2]`, `success`, `payoffLine`, `after`. **World-scoped texts** (triggers, NPC states, plaques, collectibles, non-finale cutscene lines, quest rewards) are checked against the banned values of every station not implied solved by their `requires.solved`, as **warnings**. Negative tests: trig `e2.approach` ("…y = sin(2t)…") and `e2.before` ("Those rings spin…") pass; "Set the timer to π." fails; e6 "4 seconds" fails and "40 spans" passes. |
| R9 | **Text budgets** (amendment 9). Every authored line ≤ **140 characters** (error) and ≤ 24 words (warning for side-cars, error for World Writer output). `instruction` contains, as whole tokens, `objectNoun`, a noun from the skin's `nouns`, or a `partNouns` entry. `verifyLabel` ≤ 24 characters in caps; `successBadge` ≤ 28. |
| R10 | **History sensitivity** (checklist #14, F12). If the biome kit is `sensitive: true`: human NPC looks use bodies from the kit's `fictionalStaff`; no asset key contains `portrait` unless it is a document or silhouette asset (`*.doc.*`, `*.silhouette.*`); **no NPC `name` and no `cast.extras[].name` matches (whole-token, case-insensitive) a person named in the spec** (capitalized multi-word names extracted from encounter params, prompts, `sourceRef.quote`s and narrative, plus the kit's `protectedNames`); every plaque or collectible whose text matches the kit's `violenceLexicon` is `kind: "document"` or `"photo_withheld"`; every station skin is flagged `sensitiveSafe` (no shake, burst or strike fx). |
| R11 | **Traversal links** (amendment 2). Link ends reference existing surfaces of the zone at x inside that surface's span. `ladder` ends are within 40 units of each other horizontally. `timed_hop` has `open[0] < open[1]` and a `missTo` on an existing surface. `ride.path` lies inside the zone. **No link bypasses a blocker**: a link whose ends straddle an unsolved station's `blocker.x` must require that station (or a later one) solved. |
| R12 | **Side content.** Ids unique per kind. Every `requires` references existing encounters, collectibles and declared flags. A flag is *declared* when something can set it: a quest reward, a trigger or NPC-state `setFlag`, a sandbox reward, or a cutscene `set_state {kind: "flag"}`. Quest steps reference existing NPCs (and their states), collectibles, props with `touch`, encounters and triggers. `Npc` has exactly one of `look` and `asset`; every state's `zoneId` exists. Sandboxes reference a `SANDBOX_LIBRARY` meta; their config parses and `goal ∈ meta.goals`. |
| R13 | **Purpose.** `meter.perEncounter` names each encounter at most once, values are non-decreasing in encounter order, percent values ≤ 100. `progressEffects` reference existing encounters, zones and props with ids. `map.nodes[].zoneId` and `stations[]` exist. `recordStrip.pins[].pin.lane ∈ lanes` and each pin's date appears in that encounter's params, prompt or `sourceRef.quote` (§4.4 date rule). `feedbackNouns[].from` appears in at least one applicable station's `grade()` feedback space (warning). |
| R14 | **Accessories.** `record_lens` requires the station's probe (from its config) to have `format ∈ {year, month_year}` and a `window`; the rail lies inside the zone. |
| R15 | **Boss.** The boss encounter (role `boss`, last) has `boss` set (warning when missing); no other station does. `arenaTriggerX < consoleX`. Non-empty `phases` partition the view's item keys exactly (every key in one batch) and are only allowed for board layouts. |
| R16 | **Cue ids.** Every cue id used in cutscene `sfx` steps, triggers, props and metas' success/failure plans ∈ `CUE_MAP` (§2.12) (warning: an unmapped cue is silent). |
| W1 (warning) | Every zone with stations has at least one station payoff with `vertical !== "none"` (anti-goal §10, amendment 6). |
| W2 (warning) | Every zone offers at least two non-walk verbs **other than its payoffs**: distinct link kinds, a sandbox, or a quest touch (game-feel item 37, amendment 17). |
| W3 (warning) | Props and L5 layers don't overlap a station's `meta.footprint` or `frameBounds`. |

`resolveWorld(spec, overlay, source) → ResolvedWorld` is pure, lives in `src/world/resolve-world.ts`, and runs on
the client:

```ts
export interface ResolvedStation extends Station {
  index: number;               // encounter index
  zoneIndex: number;
  modeKey: ModeKey;
  meta: ContraptionMeta;       // from the library (functions; client-only object)
  parsedConfig: unknown;       // meta.configSchema.parse(config)
  layout: LayoutMode;          // override ?? meta.defaultLayout
  probe: ProbeSpec | null;     // meta.probe(parsedConfig, view)
}
export interface ResolvedSandbox extends Sandbox { meta: SandboxMeta; parsedConfig: unknown }
export interface ResolvedWorld {
  overlay: WorldOverlay;
  source: "sidecar_id" | "sidecar_source" | "spec" | "auto";
  zones: readonly Zone[];
  stations: readonly ResolvedStation[];              // encounter order
  stationByEncounter: ReadonlyMap<string, ResolvedStation>;
  sandboxes: readonly ResolvedSandbox[];
  speakers: SpeakerDirectory;                        // id -> {name, emblem, portrait, voiceArchetype}
  flagsDeclared: ReadonlySet<string>;
  feedbackNouns: (encounterId: string) => readonly { from: string; to: string }[];
  namespaces: readonly string[];                     // ["shared", biome]: manifests to load
}
```

---

## 2 · Host: `src/game/hosts/expedition/`

### 2.1 Screen and component tree

```
GameClient({spec, world, sfx})                   world ? dynamic(ExpeditionClient) : <LegacyGameClient/>   (?host=legacy forces legacy)
 └ ExpeditionClient                               src/game/expedition/client/ExpeditionClient.tsx
    ├ useRunner(spec)                             EncounterRunner in a ref + memoized view per index (fixes D5)
    ├ machine = useReducer(expeditionReducer)     pure phase machine (§2.9)
    ├ worldState = useReducer(reduceWorldState)   flags / collected / touched / talked / fired triggers (src/world/state)
    ├ dialogue = DialogueEngine (external store)  §2.7
    ├ sfx = AudioBus (external store)             §2.12
    ├ <ExpeditionLayout>                          CSS: full-bleed stage + overlay regions (§3.1)
    │   ├ <PlayHost world=… progress=… layout=… worldState=… express=…>  → <ExpeditionHost> (Phaser) | <ExpeditionDomHost>
    │   ├ <WorldLabelLayer store>                 DOM chips, pins, interact glyph + verb, NPC names, plaque titles, label_swap text
    │   ├ <Hud>                                   <h1> zone title, ObjectiveRing, objective line, MeterBar, counters, mute toggle, key legend
    │   ├ <InstrumentPanel> (panel|resolving|payoff|sandbox)  cards + control + probe scrubber + Verify + badge + Back tab
    │   ├ <DialogueBar>                           emblem, (i) hint button → BriefSheet, typewriter text, aria-live
    │   ├ <MapOverlay> / <JournalReader>          M / J overlays (pause the host)
    │   └ <TouchPad> (coarse pointer only)        ◀ ▶ ▲ ▼ E ⤒ buttons
    └ <EndScreen> (phase finished)                unchanged component, testid end-screen
```

### 2.2 Module list (responsibilities and size)

All paths are under `src/game/hosts/expedition/` unless stated. Files marked (pure) take relative imports only
and have a `*.test.ts` beside them.

| Module | Responsibility | ~Lines |
|---|---|---|
| `ExpeditionHost.tsx` | Boots Phaser once (deps `[]`) with `type: WEBGL`, `scale: {mode: RESIZE, parent}`, `input: {keyboard: {capture: []}}`, and `backgroundColor` from the entry segment's sky. Pushes prop changes into the scene through effects: `frozen`, `progress`, `layout`, `worldState`, `express`. Exposes `HostHandle` (§2.10). Attaches `__GAME_DEBUG__.host.playerX` and `.expedition`. Falls back to the DOM host on any boot failure **without `console.error`** (it uses `console.warn`). | 300 |
| `ExpeditionScene.ts` | `createExpeditionScene(Phaser)` factory. `init` receives `SceneData`. `preload` → manifest loader with a progress bar. `create` builds the systems below and enters the current zone. `update(dt)` runs input → traversal → actors → triggers and proximity → contraption controllers (sim step, ease, apply) → camera → label publish → audio params. | 420 |
| `loader/manifest-loader.ts` | Fetches `manifest.json` per namespace (`load.json`, then chained loads). `svg` entries: `load.svg(key, url, {width, height})` at `design × rasterScale × min(dpr, 1.5)`, tiles split by `tileWidth`. `atlas` entries: `load.atlas(key, image, frames)`. Emits progress. | 190 |
| `scene/zone-builder.ts` | Builds or destroys one zone: per segment its layer set (crossfade 1 s at boundaries by alpha on both sets), the sky gradient, the ground strip (a Rope along the heightfield, or tiled `surface`) and underside, platforms, props (with `states` alternates and `touch`), interiors (façade sprite at depth 45 that fades to 20 % while inside), the hub, NPC actors, collectibles, plaques, ladders, exits, and the finish stack (§5.6). Texture keys stay loaded across zones. | 380 |
| `scene/surfaces.ts` (pure) | The surface model (§2.4.1): `buildSurfaces(zone, solvedIds, worldState, stations)` merges payoff terrain into the ground or activates platforms; `heightAt(surfaces, surface, x)`, `spanOf(surface)`, `surfaceBelow(surfaces, x, y)`. | 200 |
| `scene/terrain.ts` (pure) | `blockers(stations, solvedIds)` (the unsolved current station's blocker plus every later one), `stepBlocked(surface, x0, x1)` (rises above `maxStepUp`), `clampX(...)`. | 140 |
| `scene/traversal.ts` (pure) | `linksInRange(links, pos, worldCtx)` (range 70 units on the `from` surface; two-way links also from `to`), arc functions `hopArc`, `dropArc`, `climbPath`, `timedHopPath`, `ridePath`, `cosmeticHop`, and `timedHopOpen(link, tSec)` (§2.4.2). | 240 |
| `scene/segments.ts` (pure) | `segmentAt(zone, x)`, crossfade weights, variant resolution against `Requirement`s. | 90 |
| `scene/proximity.ts` (pure) | `nearest(interactables, pos, radius)` returns the interact target with hysteresis (enter 90, leave 130 units). Kinds: `station`, `sandbox`, `npc`, `plaque`, `collectible`, `touch`, `vehicle`, `link`, `exit`. | 110 |
| `scene/framing.ts` (pure) | `frameFor(targetBounds, safeRect, viewport, zone, frameZoom) → {scrollX, scrollY, zoom}`. Keeps the contraption's `frameBounds` and the player inside the visible world area (explore: 100 %; scrub: left 58 %; board: left 45 %; vault: centred behind the modal), zoom = `frameZoom ?? clamp(fit, camera.minZoom, 1)` × `viewportHeight / 1080`. | 120 |
| `scene/triggers.ts` (pure) | `firingTriggers(triggers, pos, worldState, solvedIds)`. | 80 |
| `scene/camera-director.ts` | Follows with an x deadzone and a **y deadzone** (`zone.camera`). On a layout change, tweens `scrollX`, `scrollY` and zoom to `frameFor(…)` over 280 ms ease-out cubic. Arena bounds clamp while a boss arena is active. Executes cutscene `pan`, `camera` and `vista` shots. Clamps to zone bounds. | 180 |
| `actors/protagonist.ts` | Sprite on the character atlas (§5.5) with a pose-swap animator: `idle`, `walk0-7` at 12 fps, `run0-2` at 14 fps, `jump`, `fall`, `climb0/1`, `interact`, `switch0/1`, `talk`, `think`, `cheer0/1`, `show`, `hold`. Costume overlays follow per-frame anchors (spring-follow for scarves). Plays traversal arcs from `traversal.ts`. Soft contact shadow ellipse (multiply). 16 % of view height. | 260 |
| `actors/companion.ts` | The guide's puppet. Follows over the shoulder (`cast.guide.companion`), bobs, flies to a station when its instruction is given, and **flies to `meta.hintTargets(rung)` anchors on hints** (circle, land, hover, ride-along). Pulses its glow while its speaker's line types. | 180 |
| `actors/npc.ts` | NPC actor: the active `NpcState` (position, pose, visibility), follow modes (`player`: walks 120 units behind on the same surfaces and puffs across links; `satchel`: attached to the protagonist's `back` anchor), name-label anchor, named part animations. | 160 |
| `input/keymap.ts` (pure) | The key map of §3.5 as data plus `actionFor(code, ctx)`. | 80 |
| `input/controller.ts` | Reads keys each frame and dispatches actions. **Fix for D4:** it calls `keyboard.disableGlobalCapture()` whenever `frozen` or when `document.activeElement` is inside `[data-panel]`, and `enableGlobalCapture()` otherwise. It ignores keys whose event target is an input, textarea or `[role=slider]`. | 170 |
| `contraptions/registry.ts` | `PREFABS: Record<string, ContraptionPrefab>`, one line per prefab (pre-filled in W0 with every id). `prefabFor(id)` falls back to `console_slate`. | 60 |
| `contraptions/controller.ts` | One per station (§2.5.3): clock, sim, aid tier, probe, draft → target pose, ease, `applyPose`, states `dormant/awake/active/solved`, chips and pins to the label store, throttled SR text, audio params, failure and success plans, `debugState`. | 320 |
| `contraptions/sandbox-controller.ts` | The same loop for a sandbox (no runner, no Verify; goals and rewards). | 140 |
| `contraptions/Snapshot.tsx` | The generic DOM snapshot (§2.5.5): draws a skin's dormant or solved parts from `skin.snapshot`. | 90 |
| `contraptions/prefabs/<id>/prefab.ts` | Each archetype's drawing (§4). No per-prefab DOM component. | 300–450 each |
| `fx/glow.ts`, `fx/beam.ts`, `fx/particles.ts`, `fx/dormancy.ts`, `fx/finish.ts`, `fx/pooled-strip.ts`, `fx/reflection.ts` | Baked radial glows (ADD); beams = three stacked lines (core 2, inner 6, outer 18) plus an end-cap glow and ±8 % shimmer; emitter presets; desaturate/re-saturate tween (ColorMatrix); the finish stack (grain, ColorMatrix grade, vignette); the pooled sprite window for dense animated strips; the half-resolution reflection RenderTexture (§2.11). | 520 |
| `cutscene/timeline.ts` (pure) | `compile(cutscene) → TimedStep[]` (walk time from distance ÷ speed; say and interactive steps = until resolved). `endState(cutscene)` produces the final world state (zone, positions, station anims, flags, prop states, camera). `expressTrim(steps)` cuts after the first completed `say`. | 170 |
| `cutscene/runner.ts` | Executes compiled steps against scene systems, including `await_interact`, `control_until`, `vista`, `camera`, `set_state`, `emote` and `music`. Returns a promise. `skip()` applies `endState`. A `warpTo` or debug call cancels it. | 320 |
| `labels/label-store.ts` (pure) | A mutable `{id → Label}` map plus version. The scene writes it per frame. The React layer reads it in rAF. No React state. | 70 |
| `labels/WorldLabelLayer.tsx` | A pool of absolutely positioned divs (chips, pins, interact diamond + verb, NPC names, plaque titles, `label_swap` texts, split-flap characters). Applies `transform` from the store each rAF. `aria-hidden` (SR text lives in the dialogue and panel live regions). | 170 |
| `bridge.ts` | Typed scene↔React bridge: `SceneApi` (what React calls) and `SceneEvents` (what the scene emits). Replaces the duck-typed `setFrozen` lookup. | 150 |
| `dom/ExpeditionDomHost.tsx` + `dom/DomStage.tsx` + `dom/DomActor.tsx` | **Reduced DOM fallback** (amendment 31): the same zone drawn as `<img>` layers with CSS `translate(-camX × factor, -camY × factorY)`, protagonist frames as a CSS sprite of the atlas, each station as a **static snapshot** (dormant, or solved when solved), traversal arcs as CSS transitions, the same `surfaces`/`traversal`/`proximity`/`framing` pure modules and the full panel. Same `HostHandle`. testid `dom-host`. | 360 |
| `src/game/hosts/PlayHost.tsx` (edit) | `if (props.world) return <ExpeditionHost …/>` before the genre switch. `?renderer=dom` → `ExpeditionDomHost`. | +25 |

Host-core total is about 5,500 lines plus about 4,800 for the 13 prefabs (§4).

### 2.3 Scene structure (per zone)

| Depth band | Phaser objects | scrollFactor | Notes |
|---|---|---|---|
| 0 sky | `Gradient` (or a baked 1×256 texture stretched) per segment | 0 | 3–6 stops from the segment's `sky`; haze quad over L1/L2; crossfades at segment boundaries |
| 10 L1 far | Image / TileSprite tiles | 0.15 | 40 % haze toward the sky colour, baked by the kit; Phaser Blur 1 px; beam-line progress effects draw here |
| 20 L2 mid-far | Image tiles | 0.35 | crystal fields, rowhouses, organelles; Blur 0.5 px |
| 30 L3 mid | Image tiles + L3 props + hub | 0.6 | cliff walls, façades, ruins, hub (hubs can sit in L3 at 0.85 for scale) |
| 40 L4 back props | Images | 1.0 | behind the path: pillars, shelves, colonnade |
| 45 interior façades | Images | 1.0 | fade to 20 % while the player is inside the interior's span |
| 50 ground + platforms | Rope/TileSprite along the heightfield + underside; platform strips; ladders | 1.0 | merges payoff terrain when solved |
| 60 contraptions | per-station Containers | 1.0 | glow sprites ADD |
| 70 actors | NPCs, companion, protagonist, contact shadows | 1.0 | protagonist depth 75 |
| 80 L5 fore | Images, blur 2 px, alpha 0.7 | 1.25–1.4 | never over a station's footprint or frame bounds (W3) |
| 90 L6 light | dapple (multiply 25 %), god rays (add), particles, grain | 1.0 | drift |
| 95 finish | camera ColorMatrix grade + vignette (camera filters) | — | per segment `ambient.grade` |
| 100 fade/title/vista | full-screen rect + vista image; the `title` step renders in React | 0 | |

Zones are **entered one at a time**. `enterZone(id, x, surface)` destroys the previous zone's objects (textures stay)
and builds the next. Zone changes happen only through cutscene `enter_zone`/`ride` steps, zone exits, carry
payoffs, or `warpTo`. Vertical transitions (`vertical_up`/`vertical_down` exits, lifts and the vesicle) tween
`scrollY` by the zone-height offset over 900 ms while fading the layer sets, so the player reads the climb or the
descent (amendment 20).

### 2.4 Character controller, traversal, interaction, NPCs, triggers and quests

#### 2.4.1 Movement and surfaces

- **Surfaces.** The player stands on exactly one surface: `"ground"` (the heightfield, merged with solved payoff
  terrain) or an active platform. `y = heightAt(surface, x)`.
- **Walking.** A/D or ←/→ at 300 units/s, **Shift** to run at 460 units/s (disabled where the segment has
  `runEnabled: false`), 90 ms acceleration, walk cycle at 12 fps. Rises of at most `ground.maxStepUp` (0.6 H) are
  auto-stepped; higher rises block, which is how walls and ledges are expressed without colliders.
- **Blockers.** The player is clamped by `blockers(stations, solvedIds)`. The blocker is drawn by the station's
  prefab (closed door, gap, membrane, wireframe steps), so the world shows *why* you can't pass.
- **Edges.** Walking off the end of a platform drops the player to `surfaceBelow(x, y)` with the drop arc.

#### 2.4.2 Traversal links (amendment 2)

| Verb | Key | Link kind | Arc (pure, `traversal.ts`) | Frames |
|---|---|---|---|---|
| Hop | Space | `hop` | `x(u) = x0 + Δx·u`, `y(u) = (1−u)·y0 + u·y1 − h·4u(1−u)` with `h = apex + \|y0 − y1\|/2`; duration `clamp(0.38 + 0.0004·\|Δx\|, 0.38, 0.9)` s | `jump` rising, `fall` descending, 6 % land squash for 100 ms + dust puff |
| Climb | W / ↑ (S / ↓ back on two-way links) | `climb` | straight segment at 220 units/s | `climb0/1` at 8 fps |
| Ladder | W / ↑, S / ↓ | `ladder` | straight vertical segment at 220 units/s; the ladder asset is drawn between the ends | `climb0/1` |
| Drop | S / ↓ (or walking off an edge) | `drop` | `y(u) = y0 + (y1 − y0)·u²`, x drifts 40 units in the facing direction, duration `sqrt(2·Δy / 1800)` s | `fall` |
| Timed hop | Space | `timed_hop` | cycle fraction `c(t) = frac(t / periodSec + phase)`; at the press, if `open[0] ≤ c < open[1]` the path is two hop arcs A → driver prop top (its position 0.35 s later) → `to`; otherwise one hop arc to `missTo` plus a "!" emote. No damage. | as hop |
| Ride | W / ↑ or E | `ride` | the vehicle tweens along `path` over `ms` (ease in-out sine); the player is locked to its top anchor | `idle` or `ride` |
| Cosmetic hop | Space with no link in range | — | apex 51 units (0.3 H), 0.36 s, never changes surface | as hop |

- **Prompts.** When a link is in range (70 units of an end on the player's surface), the interact glyph shows its
  verb: "Space · Hop", "W · Climb", "S · Drop", "E · Board". `requires` hides links until met.
- **Determinism.** No physics engine, no randomness: `__GAME_DEBUG__.expedition.useLink(id)` runs a link exactly as a
  key press does, so e2e and the capture script can reach every ledge.
- **Trig gantry** (S6): three `timed_hop` links with `periodSec` 1.5, 2.5 and 3.0 whose driver props are the gear
  platforms (their plaques read "T = 1.5" …); `missTo` is the lower walkway, which has a `ladder` back up.

#### 2.4.3 Interaction

- `proximity.nearest` sets the **interact glyph** (the diamond from bible §3.10) on the target's anchor through the
  label store. The text changes by kind: "E · Use the Tidewheel Gate console", "E · Talk to Brasswick", "E · Read",
  "E · Open the Music Box", "E · Light the lantern".
- The station console opens the panel **only** for the current encounter. A solved station replays its `success`
  and `after` lines, which acts as a review. A future station is unreachable because of the blocker.
- The companion is not interactable. It speaks only through the dialogue engine.
- **Express mode** (§0.1.5) drives the same interaction path through `walkTo` + `INTERACT_STATION`.

#### 2.4.4 NPCs and their states (amendment 16)

- The active state is the **last** `NpcState` whose `requires` holds (`activeNpcState`, `src/world/state/npc-state.ts`).
  A state with `pose: "hidden"` hides the NPC. States may move the NPC between zones (Sucra: S2 → S4 → S7).
- Entering proximity shows the name; E queues the state's `lines` on the bar (story priority, non-blocking). When the
  lines finish, `setFlag` is set and a `talk` world event is recorded (`npcId:stateId`).
- `follow: "player"` makes the NPC walk 120 units behind; `follow: "satchel"` attaches it to the protagonist's `back`
  anchor (Quill). `anim` plays a named part animation on the puppet (Brasswick's arm swinging on the corrected period).

#### 2.4.5 Triggers (amendment 15)

`firingTriggers` runs each frame: a trigger fires when the player is within `radius` on its surface, its `requires`
holds and (if `once`) it has not fired. `ambient` lines are non-blocking toasts, `arrival` lines are bar lines at
story priority (civil X-lines, cell zone arrivals), and `hint` lines toast after 20 s of idle inside the radius.
`setFlag` and `cue` apply when it fires. Express mode disables `ambient` and `hint` triggers.

#### 2.4.6 World state and quests

`src/world/state/world-state.ts` (pure):

```ts
export interface WorldState {
  flags: ReadonlySet<string>;
  collected: ReadonlySet<string>;          // collectible ids
  touched: ReadonlySet<string>;            // prop ids with `touch`
  talked: ReadonlySet<string>;             // "npcId:stateId"
  fired: ReadonlySet<string>;              // trigger ids
  sandboxGoals: ReadonlySet<string>;       // "sandboxId:goal"
  cosmetics: readonly string[];            // AssetKeys added to the protagonist costume
}
export type WorldStateEvent =
  | { type: "flag"; id: string; on: boolean }
  | { type: "collect"; id: string }
  | { type: "touch"; id: string }
  | { type: "talk"; npcId: string; stateId: string }
  | { type: "trigger"; id: string }
  | { type: "sandbox_goal"; sandboxId: string; goal: string }
  | { type: "cosmetic"; asset: string };
export interface ReqCtx { solvedIds: ReadonlySet<string>; state: WorldState }
export function reduceWorldState(s: WorldState, e: WorldStateEvent): WorldState;
export function requirementMet(req: Requirement | null, ctx: ReqCtx): boolean;
export function activeNpcState(npc: Npc, ctx: ReqCtx): NpcState | null;                   // npc-state.ts
export function questStatus(q: Quest, ctx: ReqCtx): { step: number; done: boolean };      // quests.ts
/** After every event or solve: events for newly completed quests (flag, collect, cosmetic) + their reward lines. */
export function settleQuests(quests: readonly Quest[], ctx: ReqCtx): { events: WorldStateEvent[]; say: WorldLine[]; debrief: string[] };
```

World state is **not** persisted across reloads (the runner is not either), so it can never disagree with runner
progress. Collectibles and quest debrief lines are mirrored to `sessionStorage["expedition:bonus:<specId>"]` for the
debrief only.

#### 2.4.7 Collectibles, plaques, vehicles and exits

- **Collectibles** (shards, pages, negatives): E shows `title`/`text` in the bar ("document" style when a
  `sourceRef` is present), records a `collect` event, files it in the journal.
- **Plaques:** E opens the bar in "document" style with `text` plus the `sourceRef` page line. `photo_withheld`
  plaques render a sepia blur, a camera glyph and the caption only.
- **Vehicles:** after a `ride` payoff the vehicle is interactable and E/W runs `rideCutsceneId`; `autoBoardMs`
  boards automatically. `carry` payoffs run their cutscene as part of the payoff phase.
- **Exits:** walking past an exit's x on its surface runs its transition (and optional cutscene) into the next zone.

### 2.4b Sandbox interactables (amendment 17)

A sandbox is a contraption-like meta (`SandboxMeta`, §2.5.5) placed in the world with a console. It has **no runner,
no Verify and no grade**; nothing it does reaches telemetry or mastery.

| Step | Behaviour |
|---|---|
| Open | E at the console (when `requires` holds) → machine `sandbox` phase → the panel opens in **sandbox layout** (scrub proportions; controls from `meta.inputs(config)`: one or two probe scrubbers, or a token tray; cards from `panelStatic`/`panelLive`; no Verify button; the back tab reads DONE). `lines.open` play. |
| Live | The `SandboxController` runs the same loop as a station controller: draft → sim step → pose → ease → apply → labels → audio params (the Music Box tone: `220·b` Hz, gain `0.2·A/3`, via the synth bus; a visual pulse ring replaces it when muted). |
| Goal | `meta.goalMet(goal, history)` is evaluated on every draft; the first time it holds, `sandbox_goal` is recorded and `reward` applies once (flag, lines, cosmetic, debrief line). |
| Close | Back tab or Esc → `explore`. The sandbox keeps its last pose. |

Showcase sandboxes (P1): `music_box` (trig S5 grotto: scrubbers A ∈ [0.5, 3], b ∈ [0.5, 4]; one graph card
`y = A·sin(b t)` over [0, 4π]; goal `explored` = both scrubbers moved and 5 s of play), `plant_garden` (cell S4
alcove: salt scrubber 0–5 %; the protoplast pulls from the wall above 2 %; goal `plasmolysed` then `turgid`),
`darkroom` (civil S8: token tray of held negatives → developing trays; goal `all_developed`).

### 2.5 Contraption prefab system (full interfaces)

#### 2.5.1 Pure side: `src/world/types.ts` (no Phaser, no React)

```ts
import type { z } from "zod";
import type { Domain, FamilyId } from "../contracts/common";
import type { Encounter } from "../contracts/gamespec";
import type { AxisUnit, LayoutMode, MisconceptionProbe, PayoffAnim, ProbeFormat, ProbeSpec } from "../contracts/world";

export type ModeKey = `${FamilyId}.${string}`;           // "tuner.oscillator"
export type AidTier = 0 | 1 | 2;
export type HintsUsed = 0 | 1 | 2 | 3;
/** src/world/aid-tier.ts: the one definition (amendment 10) */
export function aidTierOf(hintsUsed: HintsUsed, failedVerifies: number): AidTier;   // min(2, max(hintsUsed, failedVerifies > 0 ? 1 : 0))

/** Draft-input shapes per mode: what a control holds while the player works (possibly partial). */
export interface DraftInputs {
  "tuner.oscillator": { value: number };
  "tuner.formula": { value: number };
  "mapper.number_line": { value: number };
  "truth_finder.mimic": { statementIndex: number | null };
  "truth_finder.predict_reveal": { optionIndex: number | null };
  "sequencer.linear": { slots: readonly (string | null)[] };            // one entry per slot, null = empty
  "sorter.bins": { assignments: readonly { itemKey: string; binId: string }[] };
  "sorter.type_match": { answers: readonly { waveIndex: number; categoryId: string }[] };
  "linker.pairs": { links: readonly { leftKey: string; rightKey: string }[] };
  "linker.chain": { edges: readonly { fromKey: string; toKey: string }[] };
  "investigator.elimination": { hypothesisId: string | null };
}
/** Live, possibly partial player input plus the UI-only channels. */
export interface Draft<D = unknown> {
  encounterId: string;
  modeKey: ModeKey;
  input: D;                                  // a DraftInputs[...] shape (other modes: whatever the widget emits)
  complete: boolean;                         // toSubmitInput() would produce an Input grade() accepts → enables Verify
  focus: string | null;                      // keyboard/pointer focus: item key, statementIndex as string, socket key...
  hover: string | null;                      // hovered-but-not-chosen target (AimControl previews)
  probe: number | null;                      // the probe channel (amendment 3), ProbeSpec units
  settled: boolean;                          // pointer up, or 300 ms since the last key
  wave: { index: number; secondsLeft: number; secondsPerWave: number } | null;   // WaveControl
  marks: readonly { clueIndex: number; hypothesisId: string }[] | null;          // MatrixControl (UI-only)
  seq: number;                               // strictly increasing per encounter
}
/** src/world/draft-inputs.ts: control state → the mode's exact Input, reusing the widgets' converters. Throws unless complete. */
export function toSubmitInput(modeKey: ModeKey, input: unknown): unknown;

export interface PoseInput<Config, Sim = null> {
  view: unknown;               // mode.present(params, seed + index), memoized per encounter index. NEVER params or solution.
  draft: Draft | null;         // null = nothing touched yet (idle pose)
  config: Config;
  probe: number | null;        // draft?.probe ?? probeSpec.initial ?? probeSpec.min; null without a probe
  t: number;                   // seconds on the station clock (amendment 4); resets per meta.clock.resetOn
  aidTier: AidTier;
  hintsUsed: HintsUsed;        // rung-3-only world actions
  sim: Sim | null;             // current sim state, null when the meta has no sim
  solved: boolean;             // true only after a correct Verify, or when settled solved (warp, autoSolve, re-entry)
  reducedMotion: boolean;
}
export type StaticInput<Config> = Pick<PoseInput<Config>, "view" | "config" | "aidTier" | "hintsUsed" | "reducedMotion">;

export interface SimCtx { draft: Draft | null; probe: number | null; t: number; aidTier: AidTier }
/** Pure, seeded, fixed-step simulation (amendment 4). Holds MEASURABLE state only (F6): concentrations, flux,
    tracer path, phases. Cosmetic particles, cords and trails live in the prefab, seeded from the same seed. */
export interface SimSpec<Config, State> {
  init(seed: number, config: Config, view: unknown, ctx: SimCtx): State;   // seed = spec.seed ^ hash32(encounterId)
  step(state: State, dt: number, ctx: SimCtx): State;                       // called at fixedDt, ≤ 4 steps per frame
  fixedDt: number;                                                          // 1 / 30
  resetOn: readonly ("open" | "probe_change" | "draft_change" | "settle")[];
  readout(state: State): Readonly<Record<string, number>>;                  // e.g. { cL: 4.1, cR: 0.9, flux: 1.8 }
}

export type FnColor = "f" | "g" | "h" | "accent" | "gold";
export interface ChipSpec { anchor: string; text: string; color: FnColor }      // "g(T): 1.7π" at anchor "inner_hub"
export interface PinSpec { anchor: string; text: string | null; glyph: string | null }
export interface Described {
  chips: readonly ChipSpec[];
  pins: readonly PinSpec[];
  /** one-sentence world state for screen readers: "The inner notch is 40° from the doorway." */
  srText: string;
  /** a meta.nearMissKeys entry when the pose shows a known misconception state, else null (shown only after a failed Verify) */
  nearMiss: string | null;
}

export interface SnapshotPart { asset: string; dx: number; dy: number; rotateDeg?: number; alpha?: number }
export interface ContraptionSkin {
  id: string;                  // "vesper_dial"
  name: string;                // "Vesper Dial"
  biomes: readonly string[] | "any";
  nouns: readonly string[];    // accepted object nouns for R9
  parts: readonly { slot: string; asset: string; hero: boolean }[];   // the art contract (§4.3); all preloaded
  console: string;             // default console asset key
  snapshot: { dormant: readonly SnapshotPart[]; solved: readonly SnapshotPart[] };   // DOM fallback (amendment 31)
  sensitiveSafe: boolean;      // no shake, burst or strike fx (R10)
  cues: { live: string | null; succeed: string; fail: string };                     // §2.12 cue ids
}

export interface HintTarget { anchor: string; action: "circle" | "land" | "hover" | "ride"; holdMs: number }

export type FailAction =
  | "wobble" | "tip" | "sink" | "bounce" | "spark" | "jam" | "eject" | "dim" | "flash" | "unseat"
  | "grind" | "stall" | "scatter" | "snap" | "chevrons" | "hold_bright" | "spit_back";
export interface FailBeat { atMs: number; anchor: string; action: FailAction; params?: Readonly<Record<string, number | string>> }
export interface FailurePlan { beats: readonly FailBeat[]; durationMs: number; cue: string }        // 600–1600 ms, non-punitive
export type SuccessAction =
  | "lock" | "spin" | "open" | "ignite" | "print" | "stamp" | "flood" | "drain" | "rise" | "lower"
  | "swallow" | "cycle" | "light_sequence" | "dissolve" | "ride";
export interface SuccessBeat { atMs: number; anchor: string; action: SuccessAction; params?: Readonly<Record<string, number | string>> }
export interface SuccessPlan {
  beats: readonly SuccessBeat[];
  cardEffects: readonly { atMs: number; slot: number; effect: string; key: string | null }[];   // trig e4 stepEffects replay
  durationMs: number;                                                                          // 1200–2500 (★34)
  cue: string;
}

export interface ConfigCtx {
  modeKey: ModeKey;
  encounter: Encounter;        // prompt, hints, sourceRef, targetMisconception
  params: unknown;             // validators and defaults MAY read params and solution (server / tests only)
  solution: unknown;
  view: unknown;
  texts: readonly string[];    // every string in params + prompt + hints + sourceRef.quote (date/number honesty checks)
  biome: string;
}
export interface WriterCtx { modeKey: ModeKey; view: unknown; itemKeys: readonly string[]; domain: Domain }
export interface ConfigIssue { path: (string | number)[]; message: string; severity: "error" | "warning" }
export interface AudioParam { cue: string; pitch?: number; gain?: number }                 // continuous loops (bell hum ∝ |f(x)|)

export type ControlKind = "scrub" | "aim" | "slots" | "bins" | "waves" | "cables" | "tubes" | "matrix" | "widget";

/** The PURE half of a contraption. Imported by validators, the pipeline, tests, React and Phaser alike. */
export interface ContraptionMeta<Config = unknown, Pose = unknown, Sim = null> {
  id: string;
  name: string;
  modes: readonly ModeKey[];
  tier: "native" | "fallback";
  status: "demo" | "post_demo";                              // amendment 38
  reusable: "any_subject" | readonly Domain[];
  layouts: readonly LayoutMode[];
  defaultLayout: LayoutMode;
  payoffs: readonly PayoffAnim[];
  nearMissKeys: readonly string[];
  accessories: readonly "record_lens"[];
  skins: readonly ContraptionSkin[];
  control: ControlKind;
  // ---- configuration (§4.2, §4.4)
  configSchema: z.ZodType<Config>;
  validateConfig(config: Config, ctx: ConfigCtx): readonly ConfigIssue[];     // honesty and presence checks
  defaultConfig(ctx: ConfigCtx): Config;                                      // autoWorld (amendment 39)
  writerConfigSchema(ctx: WriterCtx): z.ZodType<unknown> | null;              // strict-mode, LLM-facing; null = nothing to write
  fromWriterConfig(w: unknown, ctx: ConfigCtx): Config;
  // ---- geometry
  footprint(config: Config): { left: number; right: number; height: number };        // around the console
  frameBounds(config: Config, view: unknown): { x: number; y: number; w: number; h: number };   // relative to station.anchor (amendment 32)
  // ---- live
  probe(config: Config, view: unknown): ProbeSpec | null;                    // scalar modes return null: the Scrubber IS the input
  clock: { resetOn: readonly ("open" | "settle" | "probe_change" | "arena")[] } | null;
  sim: SimSpec<Config, Sim> | null;
  pose(input: PoseInput<Config, Sim>): Pose;
  lerp(from: Pose, to: Pose, t: number): Pose;                               // t in [0,1]; discrete fields snap at t ≥ 0.5
  describe(pose: Pose, input: PoseInput<Config, Sim>): Described;
  panelStatic(input: StaticInput<Config>): PanelStatic;                      // memoized per (encounter, aidTier, hintsUsed)
  panelLive(stat: PanelStatic, input: PoseInput<Config, Sim>): PanelLive;
  hintTargets(rung: 1 | 2 | 3, input: StaticInput<Config>): readonly HintTarget[];
  audio(pose: Pose, input: PoseInput<Config, Sim>): readonly AudioParam[];
  // ---- outcomes (pure; prefabs only play them)
  failurePlan(d: Diagnosis, input: PoseInput<Config, Sim>): FailurePlan;     // acts ONLY on d.wrongKeys / d.failKey
  successPlan(input: PoseInput<Config, Sim>, anim: PayoffAnim): SuccessPlan; // input.draft = the solution draft, solved = true
  solvedPose(input: PoseInput<Config, Sim>): Pose;                           // settled solved state (warp, autoSolve, re-entry): D3
  debug(pose: Pose): Record<string, number | string | boolean>;             // e.g. { ringAngle: 3.14, aligned: false }
}
```

#### 2.5.2 Panel models (pure, `src/world/types.ts`)

```ts
export interface Tick { v: number; label: string | null; major: boolean }
export interface AxisModel { min: number; max: number; unit: AxisUnit; ticks: readonly Tick[]; label: string | null }
export interface PlotModel {
  id: string;
  color: FnColor;
  style: "solid" | "dashed" | "ghost";                  // ghost = 25 % alpha copy (the faint f behind g)
  segments: readonly (readonly [number, number])[][];   // split at NaN, ±∞ and jumps (graph-math.sample)
  endpoints: readonly { x: number; y: number; open: boolean }[];
}
/** GraphCard annotations (amendment 7). */
export type GraphAnnotation =
  | { kind: "bracket"; x0: number; y0: number; x1: number; y1: number; label: string; color: FnColor; orient: "vertical" | "horizontal" }
  | { kind: "shade"; x0: number; x1: number; y0: number | null; y1: number | null; color: FnColor; alpha: number; label: string | null }
  | { kind: "period_marker"; x: number; y: number; color: FnColor }      // hollow circle: the trace is home, moving the same way
  | { kind: "live_dot"; x: number; y: number; color: FnColor }           // "the lines are start and destination; the dots are now"
  | { kind: "hline"; y: number; label: string | null; style: "solid" | "dashed"; color: FnColor }   // midline, y = 1/2, targets
  | { kind: "vline"; x: number; label: string | null; style: "solid" | "dashed"; color: FnColor }
  | { kind: "caption"; text: string }                                    // "sin(x) = 1/2" typed during a success replay
  | { kind: "marker"; x: number; y: number; label: string | null; focusable: boolean };   // points of interest, orb targets
export type SchematicPrim =
  | { p: "line"; x1: number; y1: number; x2: number; y2: number; color: FnColor; w: number; dash: boolean }
  | { p: "poly"; points: readonly (readonly [number, number])[]; color: FnColor; fill: boolean; w: number }
  | { p: "circle"; cx: number; cy: number; r: number; color: FnColor; fill: boolean }
  | { p: "arc"; cx: number; cy: number; r: number; a0: number; a1: number; color: FnColor; w: number }
  | { p: "rect"; x: number; y: number; w: number; h: number; color: FnColor; fill: boolean }
  | { p: "text"; x: number; y: number; text: string; size: number; color: FnColor; anchor: "start" | "middle" | "end" };
export type CardModel =
  | { kind: "graph"; slot: number; title: string; tab: string; x: AxisModel; y: AxisModel; plots: readonly PlotModel[];
      annotations: readonly GraphAnnotation[]; columns: readonly { id: string; x0: number; x1: number; state: "obscured" | "revealed" | "chosen" }[];
      targetLine: { y: number; label: string } | null; empty: boolean; sr: string }
  | { kind: "timeline"; slot: number; title: string; tab: string; from: number; to: number; unit: "year" | "month";
      lanes: readonly { id: string; label: string }[];
      pins: readonly { key: string; at: number; label: string; lane: string | null; style: "earned" | "hint" | "draft" | "focus" | "dim"; spanTo: number | null }[];
      bands: readonly { from: number; to: number; label: string; color: FnColor }[];
      arrows: readonly { fromKey: string; toKey: string }[]; axisBreak: { from: number; to: number } | null; sr: string }
  | { kind: "unit_circle"; slot: number; title: string; landmarks: readonly { angle: number; label: string }[];
      hairlineStep: number | null; point: { angle: number } | null; arc: { from: number; to: number; color: FnColor } | null;
      drops: { sin: boolean; cos: boolean }; level: number | null; shadeUpperHalf: boolean; mirror: { from: number; to: number } | null; sr: string }
  | { kind: "bars"; slot: number; title: string; bars: readonly { id: string; label: string; value: number; max: number; color: FnColor }[];
      sparkline: { points: readonly number[]; max: number; color: FnColor } | null; timer: { fraction: number } | null;
      arrow: "in" | "out" | "both" | "none" | null; sr: string }
  | { kind: "schematic"; slot: number; title: string; viewBox: readonly [number, number]; prims: readonly SchematicPrim[]; sr: string }
  | { kind: "link_board"; slot: number; title: string; lefts: readonly { key: string; label: string }[];
      rights: readonly { key: string; label: string; sub: string | null }[];
      links: readonly { leftKey: string; rightKey: string; state: "draft" | "seated" | "focus" }[]; sr: string }
  | { kind: "claims"; slot: number; title: string; scenario: string | null;
      items: readonly { key: string; letter: string; text: string; glyph: string | null; state: "idle" | "hover" | "aimed" | "honest" | "struck" }[]; sr: string }
  | { kind: "slot_rail"; slot: number; title: string; heading: string | null;
      slots: readonly { index: number; key: string | null; label: string | null; lamp: "off" | "on" }[]; anchorsRight: number; sr: string }
  | { kind: "matrix"; slot: number; title: string; clues: readonly { index: number; text: string; date: string | null }[];
      hypotheses: readonly { id: string; text: string }[]; marks: readonly { clueIndex: number; hypothesisId: string }[];
      accused: string | null; shadeCounts: boolean; sr: string }
  | { kind: "energy_cells"; slot: number; title: string; total: number; spent: number; projected: number; sr: string }
  | { kind: "document"; slot: number; title: string; body: string; stamp: string | null; sr: string }
  | { kind: "cause_graph"; slot: number; title: string; nodes: readonly { key: string; label: string; x: number; y: number }[];
      edges: readonly { fromKey: string; toKey: string; state: "draft" | "focus" }[]; sr: string };
export interface PanelStatic {
  cards: readonly CardModel[];
  /** the scalar input (scalar modes) — the Scrubber is the mode control */
  input: { symbol: string; min: number; max: number; step: number; unit: AxisUnit; format: ProbeFormat; ticks: readonly Tick[] } | null;
  /** the probe (non-scalar modes with a probe) — the Scrubber is the probe */
  probe: ProbeSpec | null;
}
export interface PanelLive {
  scrubX: number | null;                          // orange line: the input value or the probe value
  readout: string | null;                         // "0.83π", "π/2 < θ < π", "MAR 1965", "stage 3 · flip out"
  chips: readonly { slot: number; value: number; text: string; color: FnColor }[];   // ride the card's left edge
  highlights: readonly { slot: number; key: string; state: "focus" | "hover" | "placed" | "struck" }[];
  liveCards: readonly CardModel[];                // replace the static card of the same slot (live dots, aimed trace, ledgers)
}
```

The revision-1 kinds `gradient` and `energy` are subsumed by `bars` and `energy_cells`.

#### 2.5.3 Controller behaviour (`contraptions/controller.ts`, written once for all prefabs)

- **State.** `{draft, probe, t, aidTier, hintsUsed, sim, eased, target, state: dormant | awake | active | solved}`.
- **`bind(draft)`** stores the draft. When `draft.settled` flips false → true and `meta.clock.resetOn` has
  `"settle"`, `t = 0` (trig e2 release replay, e6 common-start reset). A probe change resets `t` if `"probe_change"`
  is listed. The sim re-initializes per `meta.sim.resetOn`.
- **Each frame:** `t += dt × timeScale` (1, or 0.5 with the e6 slow-time toggle); the sim steps at `fixedDt` with an
  accumulator (≤ 4 steps); `target = meta.pose(input)`; `eased = meta.lerp(eased, target, 1 − e^(−dt/110 ms))`
  (95 % in about 330 ms, the bible's visible lag; reduced motion uses `t = 1`); `view.applyPose(eased)`;
  `describe(eased)` feeds chips and pins into the label store; `srText` goes to the panel live region at most once a
  second and only when it changes; `meta.audio(eased)` updates loop parameters on the audio bus.
- **Game-feel budget:** `bind` is synchronous and the next rAF applies the first eased frame, so the first visible
  world reaction lands within 150 ms of panel input (item 41).
- **`setAidTier(tier, hintsUsed)`** updates the pose input; the client recomputes `panelStatic` (memo key includes
  both). **`onHint(rung)`** also sends the companion to `meta.hintTargets(rung)`.
- **`fail(diagnosis)`**: `plan = meta.failurePlan(diagnosis, input)`; `view.playFail(plan)`; the pose returns to the
  draft pose. The client shows `failLines(...)` and the display feedback (§2.5.4).
- **`succeed()`**: `plan = meta.successPlan({...input, draft: solutionDraft, solved: true}, payoff.anim)`;
  `view.playSucceed(plan)`; ends in `meta.solvedPose`. The solution draft is built by the client from
  `mode.solutionInput(params, solution)` through `DraftInputs`.
- **`nearMiss`** is exposed to the client only after a failed Verify (live near-miss text would turn the game into
  hot-and-cold guessing).
- **`debugState()`** = `{...meta.debug(eased), target: meta.debug(target), state, seq, t, aidTier, probe, ...sim readout}`.

#### 2.5.4 Diagnosis: the single source of failure detail (amendment 11)

`src/world/diagnose/index.ts` + one file per mode. It runs **after** `runner.submit()` returned, with the params
and solution the runner already holds. No mode file changes. Metas' `failurePlan`s act only on what it returns.

```ts
export type FailKey =
  | "over" | "under"                       // scalar modes: submitted value above / below the answer
  | "honest" | "wrong_option"              // mimic, predict_reveal
  | "incomplete" | "decoy" | "order"       // linear (and chain's decoy)
  | "wrong_bin" | "wrong_wave" | "wrong_link" | "wrong_hypothesis";
export interface Diagnosis {
  correct: boolean;
  feedback: string;                        // grade().feedback, verbatim
  displayFeedback: string;                 // after feedbackNouns (display only; amendment 36)
  failKey: FailKey | null;
  wrongKeys: readonly string[];            // [0] = the item grade() names; never more than grade() discloses
  prefix: number | null;                   // ordered modes: length of the correct prefix
  disclosed: Readonly<Record<string, string | number>>;   // facts the feedback already states: { bin: "protein" }, { clueIndex: 2 }
  nearMiss: string | null;                 // meta.describe(pose(submitted draft)).nearMiss
  probeKeys: readonly string[];            // MisconceptionProbes matched by the submitted input
}
export function diagnose(args: {
  modeKey: ModeKey; params: unknown; view: unknown; solution: unknown; input: unknown;
  grade: { correct: boolean; feedback: string };
  probes: readonly MisconceptionProbe[];
  nearMiss: string | null;
  feedbackNouns: readonly { from: string; to: string }[];
}): Diagnosis;
export function failKeysFor(modeKey: ModeKey): readonly FailKey[];   // R5
```

| Mode | Mirrors `grade()` order | `failKey` | `wrongKeys` | `prefix` / `disclosed` | Parity needle (must appear in `grade().feedback`) |
|---|---|---|---|---|---|
| `mapper.number_line` | fraction off > tolerance | `over` / `under` | `[]` | — | "past" / "short of" |
| `tuner.oscillator` | \|value − answer\| > tol | `over` / `under` | `[]` | — | the mode's high / low direction word |
| `truth_finder.mimic` | picked ≠ mimic | `honest` | `[String(statementIndex)]` | — | the picked statement's `explanation` |
| `truth_finder.predict_reveal` | picked ≠ correct | `wrong_option` | `[String(optionIndex)]` | — | the picked option's `explanation` |
| `sequencer.linear` | length → decoy → first wrong slot | `incomplete` / `decoy` / `order` | `[]` / `[decoyKey]` / `[keys[wrongAt]]` | `prefix = wrongAt` | "Fill all" / the decoy text / `Slot ${wrongAt + 1}` |
| `sorter.bins` | any unplaced → first wrong key in `i0, i1…` order | `incomplete` / `wrong_bin` | `[]` / `[itemKey]` | `{ bin: item.binId }` | "Place all" / the item text |
| `sorter.type_match` | first wave missing or wrong | `wrong_wave` | `[w${i}]` | `{ category: wave.categoryId }` | the wave text |
| `linker.pairs` | any unlinked → first wrong left in `l0, l1…` order | `incomplete` / `wrong_link` | `[]` / `[leftKey]` | `{ given: rightKey }` | "Link all" / the left text |
| `linker.chain` | decoy edge → first solution edge not given | `decoy` / `wrong_link` / `incomplete` | `[decoyKey]` / `[from]` / `[]` | `prefix = index of that edge` | the decoy text / the `from` node text |
| `investigator.elimination` | accused ≠ survivor | `wrong_hypothesis` | `[hypothesisId, clue:${i}]` | `{ clueIndex: i }` | clue `i`'s text |

**Parity test** (`src/world/diagnose/diagnose.test.ts`): for each of the 10 showcase modes, ≥ 50 wrong inputs are
sampled (seeded) from the three fixtures' encounters; for each, `diagnose(...).correct === grade().correct` and the
needle derived from `failKey`/`wrongKeys` appears in `grade().feedback`. A change to a mode's `grade()` order fails
this test, not a demo.

**Misconception probes** (`src/world/probes.ts`): evaluated only on failed Verifies. `nearValue` uses the mode's
own tolerance (`number_line`: `solution.tolerance × (max − min)`; `oscillator`: `0.03 × (dial.max − dial.min)`,
the same constant the mode uses, pinned by the parity test) times `tolFactor`.

**Fail lines** (`src/world/fail-line.ts`, pure):

```ts
/** Lines for a failed Verify: [boss taunt?, guide line]. Line 2 of the bar shows d.displayFeedback as a margin note. */
export function failLines(st: Station, d: Diagnosis, attempt: number): WorldLine[];
// key = d.probeKeys[0] ?? d.nearMiss ?? d.failKey
// guide = st.dialogue.fail.byKey[key] ?? st.dialogue.fail.default
// boss  = st.boss && (st.boss.taunts.byKey[key] ?? st.boss.taunts.fail[attempt % n])   (spoken by st.boss.speakerId)
```

**Feedback nouns** (`src/world/feedback-nouns.ts`): whole-word, case-preserving replacement, longest `from` first,
applied only to display text ("That chest was honest" → "That singer was honest"). Grading, telemetry and the debrief
keep the original text.

#### 2.5.5 Phaser side: `src/game/hosts/expedition/contraptions/types.ts`

```ts
import type Phaser from "phaser";
import type { Encounter } from "@/contracts/gamespec";
import type { ContraptionMeta, Diagnosis, Draft, FailurePlan, SuccessPlan, AidTier, HintsUsed, HintTarget } from "@/world/types";
import type { ResolvedStation, ResolvedSandbox } from "@/world/resolve-world";

export interface PrefabProps<Config> {
  station: ResolvedStation;          // consoleX, anchor, skin, parsedConfig as Config, payoff, objectNoun
  encounter: Encounter;
  view: unknown;
  groundY: number;                   // heightAt(consoleSurface, consoleX)
  palette: BiomePalette;             // src/game/art/palette.ts
  fx: FxKit;                         // glow(), beam(), burst(), dormancy(), pooledStrip()
  tex: (assetKey: string) => string; // asset key -> loaded texture key (throws in dev if missing)
  anchorsOf: (assetKey: string) => Readonly<Record<string, { x: number; y: number }>>;
  seed: number;                      // spec.seed ^ hash32(encounterId): cosmetic randomness only
  reducedMotion: boolean;
}

/** What a prefab author writes. The host wraps it in a ContraptionInstance (below). */
export interface PoseView<Pose> {
  root: Phaser.GameObjects.Container;                  // positioned at station.anchor
  /** named world points (container-local) used for chips, pins, hint targets, the console and the camera */
  anchors: Readonly<Record<string, { x: number; y: number }>> & { console: { x: number; y: number } };
  applyPose(pose: Pose): void;                         // every frame, with the EASED pose
  setState(state: "dormant" | "awake" | "active" | "solved"): void;
  playSucceed(plan: SuccessPlan, pose: Pose): Promise<void>;   // 1.2–2.5 s, ends in the solved pose
  playFail(plan: FailurePlan, pose: Pose): Promise<void>;      // ≤ 1.6 s, ends back in the draft pose
  update?(dtMs: number): void;                         // cosmetic idle motion (shimmer, particles, cords)
  destroy(): void;
}
export interface ContraptionPrefab<Config = unknown, Pose = unknown, Sim = null> {
  meta: ContraptionMeta<Config, Pose, Sim>;
  create(scene: Phaser.Scene, phaser: typeof Phaser, props: PrefabProps<Config>): PoseView<Pose>;
}
export function definePrefab<Config, Pose, Sim>(p: ContraptionPrefab<Config, Pose, Sim>): ContraptionPrefab<Config, Pose, Sim> { return p; }

/** What the host sees per station (built by ContraptionController around a PoseView). */
export interface ContraptionInstance {
  readonly encounterId: string;
  bind(draft: Draft | null): void;                     // live updates; eases toward meta.pose(...)
  setAidTier(tier: AidTier, hintsUsed: HintsUsed): void;
  hint(rung: 1 | 2 | 3): readonly HintTarget[];        // returns the companion's flight plan
  succeed(): Promise<void>;
  fail(diagnosis: Diagnosis): Promise<void>;
  settleSolved(): void;                                // instant solved state (warp, autoSolve, re-entry): D3
  setState(state: "dormant" | "awake" | "active" | "solved"): void;
  frameBounds(): { x: number; y: number; w: number; h: number };   // world units, for framing
  update(dtMs: number): void;
  debugState(): Record<string, number | string | boolean>;
  destroy(): void;
}

/** DOM fallback (amendment 31): no per-prefab component. Snapshot.tsx draws skin.snapshot parts at the anchor:
    dormant parts with `filter: saturate(0.6)`, solved parts saturated with a glow drop-shadow. */
export interface SnapshotProps { station: ResolvedStation; solved: boolean; assetUrl: (key: string) => string; scale: number }
```

**Sandbox metas** (`src/world/sandboxes/*.meta.ts`, amendment 17):

```ts
export type SandboxInput =
  | { kind: "probe"; id: string; spec: ProbeSpec }
  | { kind: "tokens"; id: string; tokens: readonly { key: string; label: string; icon: string | null }[];
      targets: readonly { key: string; label: string }[] };
export interface SandboxDraft { values: Readonly<Record<string, number>>; placed: Readonly<Record<string, string>>; settled: boolean; seq: number }
export interface SandboxHistory {
  drafts: number;                                      // input changes so far
  secondsActive: number;
  moved: ReadonlySet<string>;                          // input ids touched
  ranges: Readonly<Record<string, readonly [number, number]>>;   // min/max visited per probe
  placedAll: boolean;
}
export interface SandboxPoseInput<Config, Sim> { config: Config; draft: SandboxDraft | null; t: number; sim: Sim | null; reducedMotion: boolean }
export interface SandboxMeta<Config = unknown, Pose = unknown, Sim = null> {
  id: string; name: string; tier: "sandbox";
  skins: readonly ContraptionSkin[];
  configSchema: z.ZodType<Config>;
  validateConfig(config: Config): readonly ConfigIssue[];
  inputs(config: Config): readonly SandboxInput[];
  goals: readonly string[];                            // "explored", "plasmolysed", "turgid", "all_developed"
  goalMet(goal: string, h: SandboxHistory, pose: Pose): boolean;
  sim: SimSpec<Config, Sim> | null;
  pose(input: SandboxPoseInput<Config, Sim>): Pose;
  lerp(from: Pose, to: Pose, t: number): Pose;
  describe(pose: Pose, input: SandboxPoseInput<Config, Sim>): Described;
  panelStatic(config: Config): PanelStatic;
  panelLive(stat: PanelStatic, input: SandboxPoseInput<Config, Sim>): PanelLive;
  audio(pose: Pose, input: SandboxPoseInput<Config, Sim>): readonly AudioParam[];   // the Music Box tone
  footprint(config: Config): { left: number; right: number; height: number };
  frameBounds(config: Config): { x: number; y: number; w: number; h: number };
  debug(pose: Pose): Record<string, number | string | boolean>;
}
```

Sandbox prefabs use the same `ContraptionPrefab` shape (`meta` typed as `SandboxMeta`) and live in
`contraptions/prefabs/<sandbox id>/`.

#### 2.5.6 Live-reveal rule (anti brute force; amendment 26)

- **Continuous modes** (`scrub` control on a scalar input) may show *how close* the world is to the target, as
  Variant does (beam near the node, notch 40° short, sync thread brightness).
- **Discrete modes** (`aim/slots/bins/waves/cables/tubes/matrix`) show *what your choice does* (the beam swings to
  that holder, the molecule queues at that lane, the plank rises into that bay, the cartridge loads its count) but
  correctness appears **only** after Verify, through `Diagnosis`.
- **Metas never see params or solutions** at runtime: `PoseInput` carries the view only. `validateConfig`,
  `defaultConfig` and `fromWriterConfig` receive `ConfigCtx` (with the solution) and run only in validators, the
  pipeline and tests. An ESLint `no-restricted-imports` rule forbids runtime imports from `src/mechanics/**` in
  `src/world/contraptions/**` (types only).
- **Specific gates:**
  - civil e9 bay lamps: the cursor-driven left-to-right sweep in the **world** runs only at `aidTier ≥ 1`
    (`bayLampsTier`); before that, lamps light at their printed dates on the FILE card only, without bay mapping;
  - cell e8 cartridges: a cartridge in a socket of another kind shows a neutral "loaded: 1 ATP" label; the stage
    playback reveals the physics (no "?" glyph);
  - bins chips show counts only, never capacities; hover renders the claim only (no water arrows on e5 hover).
- **The no-leak test** (§8.1) covers `describe()`, `panelLive()` and the world lamp and socket fields of every
  discrete meta's pose.

#### 2.5.7 Example pose (Ring Gate, `tuner.oscillator`, `ask: period`)

- The mechanism runs for the dialled time T. The outer ring turns by the wave's phase advance `b·T` and must come
  back to its notch; the inner disc rocks by the wave's value.
- The player sweeps T upward and *sees the first alignment*. That is the fundamental period. On knob release the
  rings replay 0 → T in `max(0.6, T/π)` s (the clock resets on `settle`).
- Larger multiples also align, so the pose carries a lap tally: the near-miss `aligned_multiple` and the bible's
  visible misconception (#36).

```ts
// src/world/contraptions/ring-gate.meta.ts (excerpt)
export interface RingPose { outerAngle: number; innerAngle: number; turns: number; tally: number; aligned: boolean; replay: number; doorOpen: number }
clock: { resetOn: ["open", "settle"] },
pose({ view, draft, t, config }) {
  const v = view as OscillatorView;                       // {wave, amplitude, b, c, d, dial}
  const inp = draft?.input as { value?: number } | undefined;
  const T = typeof inp?.value === "number" ? inp.value : v.dial.min;
  const replay = config.replayOnSettle && draft?.settled ? Math.min(1, t / Math.max(0.6, T / Math.PI)) : 1;
  const tt = T * replay;                                  // you watch the machine run for exactly the time you set
  const phase = Math.abs(v.b) * tt;
  const turns = phase / (2 * Math.PI);
  const off = Math.abs(turns - Math.round(turns));        // 0 when the pattern has repeated
  return {
    outerAngle: -(phase % (2 * Math.PI)),
    innerAngle: (Math.PI / 2) * Math.sin(v.b * tt + v.c),
    turns, tally: Math.floor(turns + 0.03), replay,
    aligned: replay === 1 && off < 0.015 && turns >= 0.5, doorOpen: 0,
  };
},
describe(p) {
  return {
    chips: [{ anchor: "inner_hub", text: `y: ${fmt2(Math.sin(p.innerAngle))}`, color: "f" }],
    pins: [{ anchor: "tally", text: "I", glyph: null }],
    srText: p.aligned ? "The notches line up: the doorway is clear." : `The notch is ${deg(wrap(p.outerAngle))}° from home; the tally reads ${roman(p.tally)}.`,
    nearMiss: p.aligned && p.turns > 1.5 ? "aligned_multiple" : p.turns < 1 ? "short_of_cycle" : null,
  };
},
```


### 2.6 Objectives and HUD (DOM, `src/game/expedition/hud/`)

| Element | Behaviour | testid |
|---|---|---|
| `<h1>` zone title (top-left, 20 px caps, 70 % white) | the zone name. flows.spec asserts an `<h1>` exists and isn't "can't be played" | `zone-title` |
| **ObjectiveRing** (55 px double ring) | the arc fills per solved station in the current zone (re-segments with a 400 ms sweep on zone change). Tooltip and SR: "Restore the orrery's starlight · 2 of 3 rhythms" (`story.objective`, `restoredNoun`). It pulses when a station is restored. Click or M opens the map when `story.map` exists | `objective-ring` |
| Objective line (under the ring, 16 px caps) | `${story.objectiveLabel} ${solved}/${total}`, shown for 4 s on zone entry and on J | `objective-text` |
| **MeterBar** (amendment 24) | `story.meter`: label + value, animated 600 ms per change; when `drives` includes `ambient_particles` the host scales mote counts and alpha by `value / 100` (cell §2.4 formulas) | `meter` |
| Counters | "Pages 2/5 · Wisps 1/3" for 3 s after a pickup | `counters` |
| Journal (J) | P0: MasteryHud (kept, testid `mastery-hud`) + collected items list. P2: `JournalReader` with `story.journal.style` tabs (pages, logbook, clipping case) | `journal` |
| Map (M) | P2: `MapOverlay` (panel material, 70 % × 80 %, world dimmed 40 %, pause). Nodes from `story.map.nodes`: seal glyphs grey/cyan, a white "you are here" pin (never orange), tabs per `story.map.tabs`. No fast travel | `map-overlay` |
| Key legend (H or ?) | the §3.5 key map as a card | `key-legend` |
| Mute toggle (N) | toggles the audio bus (§2.12); persisted in `localStorage` | `mute-toggle` |
| Zone title card | a cutscene `title` step: large centred serif, fades | `title-card` |
| Interact glyph | WorldLabelLayer (projected), shows the verb | `interact-prompt` (DOM label) |
| Brief sheet ((i) button) | two tabs: **Brief** = the fixture `prompt` verbatim + the console plaque text; **Hints** = the guide-voiced rungs unlocked so far, then the fixture `hints[]` verbatim | `brief-sheet` |

### 2.7 Dialogue engine (full API)

The pure core, `src/game/expedition/dialogue/engine.ts`, is tested in node. React only renders it.

```ts
export type DialogueKind =
  | "line" | "instruction" | "tutorial" | "insight" | "success" | "payoff" | "near_miss" | "probe"
  | "hint" | "feedback" | "taunt" | "arrival" | "ambient" | "narration" | "document";
export type Channel = "bar" | "toast";
export type Priority = "ambient" | "story" | "instruction" | "critical";   // ascending

export interface DialogueLine {
  id: string;                  // stable: `${source}:${index}` so replays dedupe
  speakerId: string;           // spec character, cast.extras id, "player" or "narrator"
  text: string;
  kind: DialogueKind;
  mood: "neutral" | "excited" | "worried" | "solemn" | "wry";
}
export interface SayRequest {
  lines: readonly DialogueLine[];
  channel: Channel;
  priority: Priority;
  /** blocking: host input frozen until the last line is advanced (intro, finale, arena, taunts) */
  blocking: boolean;
  /** "cutscene:intro" | "station:e2_period" | "npc:brasswick" | "trigger:s0_01" ... used by skipAll(source) and dedupe */
  source: string;
}
export interface ActiveLine { line: DialogueLine; request: SayRequest; startedAt: number; visibleChars: number; typing: boolean }
export interface DialogueSnapshot {
  active: ActiveLine | null;
  /** panel-open pinned lines: line 1 (instruction or success) and line 2 (tutorial/insight/near-miss/probe/feedback) */
  pinned: { primary: { kind: DialogueKind; text: string; speakerId: string } | null; secondary: { kind: DialogueKind; text: string } | null };
  queued: number;
  blocking: boolean;
  version: number;
}
export interface DialogueEngineOptions { cps?: number /* 45 */; now: () => number; minToastMs?: number /* 2500 */ }

export class DialogueEngine {
  constructor(opts: DialogueEngineOptions);
  say(req: SayRequest): Promise<void>;        // resolves when its last line is dismissed or skipped
  advance(): void;                            // typing -> complete the line; complete -> next line
  skipAll(source?: string): void;             // cutscene skip, warp, autoSolve, express trim
  pin(p: Partial<DialogueSnapshot["pinned"]>): void;
  clearPins(): void;
  tick(now: number): void;                    // updates visibleChars; auto-dismisses toasts
  snapshot(): DialogueSnapshot;
  subscribe(fn: () => void): () => void;      // for useSyncExternalStore
}

// pure helpers (unit-tested)
export function visibleChars(text: string, elapsedMs: number, cps: number): number;   // grapheme-safe (Intl.Segmenter)
export function toastDurationMs(text: string, minMs: number): number;                   // max(min, words / 3.3 s)
export function preempts(incoming: Priority, current: Priority): boolean;               // critical > instruction > story > ambient
```

The rules:
- A higher-priority request interrupts. The interrupted request's remaining lines go back to the queue front,
  except ambient lines, which are dropped.
- Toasts never block.
- `pinned` lines render in the bar while the panel is open, and queued bar lines render above them.

**Station slot flow** (`src/game/expedition/client/station-dialogue.ts`, pure, tested):

| Moment | What is said or pinned |
|---|---|
| Player enters `approachRadius` (explore, once) | `approach` lines, toast, story priority |
| Boss arena trigger | `boss.taunts.approach`, bar, blocking, then the arena cutscene |
| Panel opens | pin primary = `instruction`; pin secondary = `tutorial` on the first open, otherwise `insight` |
| Boss board phase appears | `boss.phases[i].line`, bar, instruction priority |
| (i) hint rung r | `hints[r − 1]` (or the fixture hint text in the guide's voice when `hints` is null), kind `hint`; `host.onHint(encId, r)`; aid tier updates |
| Failed Verify | `failLines(station, diagnosis, attempt)` (§2.5.4), kind `taunt`/`probe`/`near_miss`/`line`; pin secondary = `diagnosis.displayFeedback` (kind `feedback`, margin-note style) |
| Correct Verify | pin primary = `success` (kind `success`); `payoffLine` as a toast during the payoff; `after` lines in explore |

**Insight vs success, defined once:** `insight` is the pre-success, hint-free truth of the world (R8 applies; it never
states the answer). `success` is the post-success concept statement; it replaces the instruction when the badge
shows and may state the answer.

`DialogueBar.tsx` (about 240 lines) follows bible §3.9:
- **Emblem:** a 64 px SVG, concentric broken rings coloured from the speaker's `Emblem` (`gaps`), with the centre
  glyph from `emblem-glyphs.ts` (one ≤ 12-line path per `EmblemGlyph`). The speaker name is a 14 px caps label
  above the text (fixes D6). `narrator` lines use the caption style: no emblem, italic, the game's title emblem.
- **(i) button** (`data-testid="hint-button"`, kept): calls `runner.hint()` (telemetry semantics unchanged), then
  the hint flow above, and opens the Brief sheet on long-press / Shift+I.
- **Text:** `clamp(22px, 1.6vw, 32px)`, two lines at most, typewriter at 45 cps.
- **Keyboard:** Space or Enter advances when the bar has focus, or globally when a blocking line is active and no
  input is focused.
- **Screen readers:** a visually hidden `<div aria-live="polite">` receives the **full** line when it starts.
  Critical, taunt and feedback lines use `aria-live="assertive"`. The typing span is `aria-hidden`.
- **Reduced motion:** `prefers-reduced-motion` shows lines instantly.

`speakers.ts` (`src/world/speakers.ts`, pure) builds the `SpeakerDirectory` from `spec.characters` (name, voice),
`cast.speakers` (emblems), `cast.extras` (amendment 1), the guide, `"player"` (the protagonist's name, no emblem)
and `"narrator"`.

### 2.8 Scene transitions and cutscenes

- **Intro:** `story.introCutsceneId` (phase `intro`). Typical steps: `fade clear` → `title` → `pan`/`camera` across the
  dormant hub → `say` (guide, blocking) → an interactive step (`await_interact` "Wind Cog" / `control_until` "the
  stair") → `station wake`.
- **Zone entry:** `entryCutsceneId` (optional) plays a title card and a `pan` to the zone hub (phase `cutscene`).
- **Exits and rides:** `ride` tweens the vehicle and the player along `path`, then swaps zones under a fade;
  vertical transitions tween `scrollY` (§2.3). Carry payoffs (`door_carries`, `vesicle_carries`) run their
  `rideCutsceneId` as part of the payoff.
- **Arena:** crossing `boss.arenaTriggerX` runs `boss.arenaCutsceneId` (wake, taunts, music `boss`), then clamps the
  camera to `arenaBounds`.
- **Finale:** `story.finaleCutsceneId` (phase `finale`). Steps: `station succeed` on the boss → `hub restored` →
  `vista` (cross-zone composed image; trig canyon, civil dawn) → `say` (the finale lines, then `spec.narrative.outro`)
  → `fade black`. The client then shows `EndScreen`.
- **Interactive steps:** `await_interact` pauses the timeline and shows the interact glyph on its target until the
  player presses E (or `timeoutMs` elapses); `control_until` unfreezes movement until the player reaches `x` (after
  `timeoutMs` the player auto-walks). `skip()` applies both end states.
- **Skipping:** any skippable cutscene ends on Esc or on a "Skip" button (`data-testid="cutscene-skip"`), and
  `timeline.endState` applies the final state. `warpTo`, `skipTo` and `autoSolve` always cancel. **Express** trims
  every cutscene except the finale after its first completed `say` line.

### 2.9 Phase machine (pure reducer, fixes D1, D2, D3, D9)

```ts
// src/game/expedition/client/machine.ts
export type Phase =
  | { kind: "loading" }
  | { kind: "intro"; cutsceneId: string }
  | { kind: "explore" }
  | { kind: "cutscene"; cutsceneId: string; purpose: "zone" | "exit" | "ride" | "arena" }
  | { kind: "panel"; encounterId: string }
  | { kind: "resolving"; encounterId: string; correct: boolean }           // world success/fail animation playing
  | { kind: "payoff"; encounterId: string }                                // badge + success line, panel slides out, carry cutscene
  | { kind: "sandbox"; sandboxId: string }
  | { kind: "finale"; cutsceneId: string; clearedId: string }
  | { kind: "finished" };

export type MachineEvent =
  | { type: "ASSETS_READY"; introId: string | null }
  | { type: "CUTSCENE_START"; cutsceneId: string; purpose: "zone" | "exit" | "ride" | "arena" }
  | { type: "CUTSCENE_DONE" }
  | { type: "INTERACT_STATION"; encounterId: string; isCurrent: boolean }
  | { type: "INTERACT_SANDBOX"; sandboxId: string }
  | { type: "BACK" }                                                        // back tab / Esc: close panel or sandbox without grading
  | { type: "VERIFIED"; encounterId: string; correct: boolean }            // after runner.submit (cleared id captured here: D1)
  | { type: "RESOLVE_DONE" }
  | { type: "PAYOFF_DONE"; runnerFinished: boolean; finaleId: string }
  | { type: "DEBUG_SYNC"; runnerFinished: boolean };                       // skipTo / autoSolve

export function reduce(phase: Phase, e: MachineEvent): Phase;
export const hostFrozen = (p: Phase, dialogueBlocking: boolean, overlayOpen: boolean) =>
  p.kind !== "explore" || dialogueBlocking || overlayOpen;
```

Transitions:
- `explore —INTERACT_STATION(current)→ panel`; `panel —BACK→ explore`.
- `explore —INTERACT_SANDBOX→ sandbox —BACK→ explore`.
- `explore —CUTSCENE_START→ cutscene —CUTSCENE_DONE→ explore` (zone entries, exits, rides, arenas).
- `panel —VERIFIED(false)→ resolving(false) —RESOLVE_DONE→ panel`. The control is **not remounted**; the client caches
  the draft per encounter (the old reset-on-wrong is gone).
- `panel —VERIFIED(true)→ resolving(true) —RESOLVE_DONE→ payoff —PAYOFF_DONE→ explore`. A carry payoff plays its
  cutscene inside `payoff` before `PAYOFF_DONE`. When the boss was cleared, `PAYOFF_DONE` goes to `finale → finished`
  instead (D2).

`DEBUG_SYNC` from any phase goes to `explore` or `finished` and cancels cutscenes and dialogue. World state always
comes from the `progress` prop (`{solvedIds, currentId}`) derived from the runner, so `autoSolve` is consistent even
though it never animates (D3). Express mode is a client policy on top of the reducer (§0.1.5), not a phase.

### 2.10 `HostProps` / `HostHandle` extensions (`src/game/hosts/types.ts`)

```ts
import type { ResolvedWorld } from "../../world/resolve-world";
import type { AidTier, Diagnosis, Draft, HintsUsed, SandboxDraft } from "../../world/types";
import type { WorldState } from "../../world/state/world-state";
import type { SayRequest } from "../expedition/dialogue/types";

export interface ExpeditionProgress { solvedIds: readonly string[]; currentId: string | null }
export interface SafeRect { x: number; y: number; w: number; h: number }          // CSS px of the visible world area
export interface LayoutState {
  mode: "explore" | "scrub" | "board" | "vault" | "sandbox";
  safeRect: SafeRect;
  focus: { kind: "station"; encounterId: string } | { kind: "sandbox"; sandboxId: string } | null;
}

export type InteractTarget =
  | { kind: "station"; encounterId: string }
  | { kind: "sandbox"; sandboxId: string }
  | { kind: "npc"; npcId: string; stateId: string }
  | { kind: "plaque"; plaqueId: string }
  | { kind: "collectible"; collectibleId: string }
  | { kind: "touch"; propId: string }
  | { kind: "vehicle"; encounterId: string }
  | { kind: "link"; linkId: string; verb: "hop" | "climb" | "ladder" | "drop" | "timed_hop" | "ride" }
  | { kind: "exit"; exitId: string };

export type HostEvent =
  | { type: "ready" }
  | { type: "load_progress"; fraction: number }
  | { type: "zone_entered"; zoneId: string }
  | { type: "near"; target: InteractTarget | null }
  | { type: "approach"; encounterId: string }                                    // first entry into approachRadius
  | { type: "arena"; encounterId: string }                                       // boss arena trigger crossed
  | { type: "trigger"; triggerId: string }
  | { type: "link_used"; linkId: string; landed: "to" | "missTo" }
  | { type: "cutscene"; id: string; state: "start" | "end" }
  | { type: "back" };                                                            // Esc pressed in-canvas

export interface HostProps {
  spec: GameSpec;
  rooms: RoomPlacement[];
  palette: Palette;
  frozen: boolean;
  onReachSocket: (encounterId: string) => void;                  // legacy hosts; Expedition routes stations through onInteract
  onReachEnd?: () => void;
  // ---- Expedition (present only when a world resolved) ----
  world?: ResolvedWorld;
  progress?: ExpeditionProgress;
  layout?: LayoutState;
  worldState?: WorldState;                                       // flags, collected, touched (NPC states, platforms, links, props)
  meterValue?: number | null;                                    // drives ambient particles when the meter asks for it
  express?: boolean;
  onInteract?: (target: InteractTarget) => void;
  onSay?: (req: SayRequest) => void;                             // host asks the dialogue engine to speak (NPCs, triggers, cutscenes)
  onHostEvent?: (e: HostEvent) => void;
}

export interface HostHandle {
  warpTo: (encounterId: string | null) => void;                 // Expedition: enters that station's zone, settles earlier stations
  setLiveValue?: (value: unknown) => void;                      // legacy hosts only
  celebrate?: (mode: string) => void;                           // legacy hosts only
  // ---- Expedition ----
  bindDraft?: (encounterId: string, draft: Draft | null) => void;
  setAidTier?: (encounterId: string, tier: AidTier, hintsUsed: HintsUsed) => void;
  onHint?: (encounterId: string, rung: 1 | 2 | 3) => void;      // amendment 10: companion flight + meta world reaction
  resolveEncounter?: (encounterId: string, diagnosis: Diagnosis) => Promise<void>;   // success or fail animation
  openSandbox?: (sandboxId: string) => void;
  bindSandboxDraft?: (sandboxId: string, draft: SandboxDraft | null) => void;
  closeSandbox?: () => void;
  playCutscene?: (id: string) => Promise<void>;
  skipCutscene?: () => void;
  walkTo?: (x: number, surface?: string) => Promise<void>;       // express + debug; uses links on the way
  useLink?: (linkId: string) => Promise<void>;                   // debug + e2e
  debug?: () => ExpeditionHostDebug;
}

export interface ExpeditionHostDebug {
  ready: boolean; zoneId: string; segmentId: string;
  playerX: number; playerY: number; surface: string;
  cameraX: number; cameraY: number; zoom: number;
  near: InteractTarget | null;
  links: readonly { id: string; kind: string; inRange: boolean; open: boolean | null }[];
  contraption: (encounterId?: string) => Record<string, number | string | boolean> | null;
  cutscene: string | null; fps: number; drawObjects: number;
}
```

`__GAME_DEBUG__` gains an optional `expedition` object, added in `debug.ts` as an optional field on
`GameDebugHandle`, so existing specs are unaffected:

```ts
expedition?: {
  host(): ExpeditionHostDebug | null;
  phase(): Phase["kind"];
  dialogue(): { speakerId: string; text: string; typing: boolean } | null;
  worldState(): { flags: string[]; collected: string[]; touched: string[] };
  interact(): void;                        // same as pressing E
  walkTo(x: number, surface?: string): Promise<void>;   // drives the controller (not a teleport) until x or a blocker
  useLink(id: string): Promise<void>;      // runs a traversal link as a key press would
  openPanel(): void;                       // warp to the current station and open its panel
  applySolutionDraft(): void;              // sets the open control to mode.solutionInput(...) THROUGH the control API
  setProbe(value: number): void;           // moves the probe scrubber through its control API
  hint(): void;                            // same as pressing (i)
  openSandbox(id: string): void;
  express(on: boolean): void;
  skipCutscene(): void;
  freeze(on: boolean): void;               // pause tweens/typewriter/particles/clocks for deterministic screenshots
}
```

### 2.11 Performance guardrails

| Budget | Value | Enforced by |
|---|---|---|
| Frame | 60 fps at 1920×1080 on an integrated GPU; ≤ 150 draw objects per zone; ≤ 3 active particle emitters | `fps` and `drawObjects` in debug; the fidelity capture records both; e2e fails below 45 fps median on the webgl project |
| Textures | ≤ 180 MB VRAM per loaded biome (layers at rasterScale ≤ 1 and tiled to ≤ 2048 wide; props ≤ 1.5× dpr cap) | `scripts/build-art.ts` writes `vramEstimateMb`; `tests/world-assets.test.ts` fails above budget |
| Load | first zone interactive in ≤ 3 s on localhost; the next zone's textures are already loaded (one biome = one manifest) | loader progress event; e2e timeout |
| React | no `setState` per draft tick; the label layer never re-renders React (rAF + refs) | review checklist; lint rule `set-state-in-effect` already on |
| Sims | ≤ 1.5 ms per frame for all active sims (only the open station's and the open sandbox's sims step) | `debugState` timing; unit benchmark in the sim tests |

**Per-game plans** (amendment 30):

| Game | Hot spot | Plan |
|---|---|---|
| Trig | star field in Z3 (hundreds of twinkling points) | ≤ 140 stars **baked into one texture**; twinkle is 12 additive sprites re-positioned every 2 s; fireflies 6 sprites |
| Cell | lipid heads across about 29 000 world units (about 650 heads, 1 300 tails) | the bilayer is a **static tiled strip** (kit `bilayerTile`); jittering heads are a **pooled window of 60 sprites** within ±900 units of the camera centre (`fx/pooled-strip.ts`), re-bound to tile slots as the camera moves; gel/frost and needle parting only near e1; mote counts from the meter capped at 120 |
| Civil | rain, puddle reflections, grain | rain ≤ **120** streak particles (Z2), 60 (Z3); reflections in **2 scenes only** (S4 Main Street, S7 bridge) via a **half-resolution RenderTexture** of L3/L4 flipped, updated at **15 Hz** (`fx/reflection.ts`); grain is one tiled texture on L6 |

### 2.12 Sound: the procedural WebAudio cue bank (amendment 35)

Files: `src/game/expedition/audio/cues.ts` (pure: the recipe table and `CUE_MAP`), `synth.ts` (WebAudio renderer,
about 150 lines), `bus.ts` (external store: enabled, muted, master gain, loop registry).

| Recipe | Synthesis | Used by (examples of mapped game-doc cue ids) |
|---|---|---|
| `tick` | 1.8 kHz sine, 25 ms, exp decay | `ui_knob_tick`, `stud_tick`, `tally_click`, `relay_click` |
| `select` | two sines 660 → 990 Hz, 60 ms | `ui_select`, `cord_seat` |
| `verify` | triangle 440 Hz + 880 Hz, 140 ms | `ui_verify` |
| `badge` | major triad (C5 E5 G5) arpeggio, 90 ms steps | `ui_badge`, `success-badge` |
| `whoosh` | band-passed noise, centre sweep 400 → 2 kHz, 280 ms | `ui_panel_in`, `ui_panel_out`, `tube_whoosh`, `sfx.beam_rise` |
| `hum` (loop) | sine + 2nd harmonic at 10 %, pitch and gain params | `beam_hum`, `bell_hum`, `sync_hum`, `current_hum` |
| `bell` | FM: carrier f, modulator 3.5 f, index 4 → 0, 1.2 s | `bell_honest`, `chord_true` (×3), `mb_tone` |
| `chord` | three bells, a major chord | `chord_true`, `resonance_lock` |
| `clunk` | 90 Hz sine drop + low-passed noise, 180 ms | `latch_clack`, `stone_lock_thunk`, `drawer_thunk`, `bolt_slide` |
| `thunk` | 60 Hz sine, 120 ms | `sfx.slab_set`, `warden_bow_rumble` (×3) |
| `latch` | click + 40 ms delayed click | `latch_click`, `latch_slip` (double) |
| `spark` | high-passed noise burst, 70 ms | `beam_scatter`, `thread_snap`, `sfx.fuse_pop` |
| `water` | low-passed noise swell, 1.2 s | `water_rush`, `raft_flood`, `sluice_drain` |
| `stamp` | noise transient + 150 Hz body | `stamp`, `sfx.press_roll` |
| `teletype` | 14 Hz train of `tick`s, 1 s | `sfx.teletype` |
| `page` | short filtered noise flutter | `ui_page_turn`, `pickup_page` |
| `rumble` | 40 Hz sine + noise, 800 ms | `gatekeeper_rumble`, `warden_bow_rumble` |
| `pop` | 400 → 900 Hz sine blip, 50 ms | `mote_pop`, `pod_crack`, `boing_soft` |
| `chime` | 1.3 kHz + 2.6 kHz bells, 600 ms | `node_ignite`, `lantern_lit`, `beacon_ignite` |
| `grind` | sawtooth 70 Hz through a comb filter, 400 ms | `stone_grind`, `tumbler_grind`, `clunk` |

- `CUE_MAP: Record<string, { recipe: RecipeId; pitch?: number; gain?: number; repeat?: number }>` maps **every cue id
  listed in the three game docs** (trig §6.8, cell §5 `sfx` ids, civil §5.0.6 list) and the skins' `cues`. A test
  asserts coverage of every cue id used by side-cars (R16) and metas' plans.
- **Enabling:** on unless `EXPEDITION_SFX=off` (server env, passed as the `sfx` prop; Playwright's `webServer.env`
  sets it), `?mute=1`, or the HUD mute toggle (N). The `AudioContext` is created on the first user gesture.
  `AUDIO_MODE` (the ElevenLabs pipeline flag) is unrelated and stays `off`.
- **Continuous params:** `meta.audio(pose)` returns loop params each frame (bell hum pitch ∝ |f(x)| on trig e3/e5,
  `sync_hum` ∝ B on e6); the bus smooths them over 50 ms. When muted, the Music Box shows a visual pulse ring.

### 2.13 Express mode and rehearsal

`?express=1` (or `__GAME_DEBUG__.expedition.express(true)`) applies §0.1.5. Implementation: `client/express.ts`
(pure policy: `nextExpressAction(phase, progress, world) → {walkTo} | {interact} | {skipAfterFirstLine} | null`),
consumed by `ExpeditionClient`. Express never changes grading, hints, failures or payoff animations; it only removes
walking and waiting. It is the rehearsal path for the demo and the fastest e2e path (`e2e/expedition-express.spec.ts`).

---

## 3 · Panel (React overlay)

### 3.1 Layout

**This section is authoritative for panel geometry.** The game docs' "world 0–0.59 / panel 0.59–0.975" and
"world 45 % / panel 55 %" fractions describe the same regions and defer to it.

```
┌──────────────────────── ExpeditionLayout (100vw × 100vh, position: relative, overflow hidden) ───────────────────────┐
│ STAGE: PlayHost canvas, absolute inset 0 (always full-bleed; Phaser Scale.RESIZE follows window size only)            │
│ ┌ HUD (top-left) ┐                                         ┌──────────── PANEL (scrub: 42vw; board: 55vw) ─────────┐ │
│ │ ◎ h1 zone      │     WorldLabelLayer (chips, pins, E)     │ ← back tab     [card f(x)]  [card g(x)]  [card h(x)]   │ │
│ │ GRADIENT ▭▭▭   │                                         │ chips ride the left edge   orange scrub line across all │ │
│ └────────────────┘                                         │ [f(a)|0.83π][ruler 0 … 10 ▲]   ─•  VERIFY GATE  •─      │ │
│                                                   ┌────────┴──────────────────────────────────────────────────────────┤ │
│                                                   │ ◉ emblem  Rotate the wheels to form a doorway.                    │ │
│                                                   │ (i)       A single input can produce more than one output…        │ │
└───────────────────────────────────────────────────┴───────────────────────────────────────────────────────────────────┘
explore: panel hidden, dialogue bar = toast strip bottom-centre.   vault: centred modal 80×85 % over a 55 % dim, brief column left.
sandbox: scrub geometry, no Verify, back tab reads DONE.
phone (< 768 px or portrait): panel = bottom sheet 60vh, dialogue bar at the sheet's top; camera safeRect = top 40 %.
```

- The panel slides in over 280 ms ease-out cubic. On the same frame the client sends `layout.safeRect`, and the
  camera tweens `scrollX`, `scrollY` and zoom to `frameFor(meta.frameBounds, …, station.frameZoom)`. Nothing resizes,
  so there is no layout shift.
- **Framing giant contraptions** (amendment 32): `frameBounds` is what must stay visible; `frameZoom` overrides the
  computed zoom (≥ 0.5). Civil Big Board ≤ 1100 wide frames whole at zoom ≈ 0.8 in board mode; the Broadcast mast
  frames the focused station plus the lift cage (the camera follows `focus` vertically); the Timeline Bridge frames the
  four crown bays only.
- Material: background `rgba(38,92,106,.86)` with `backdrop-filter: blur(6px)`. A hex grid is drawn as an SVG
  `<pattern>`, and frame lines end in dot or hollow-circle terminals (`TraceLine`).
- If `backdrop-filter` is unsupported, or fps drops below 45 for 2 s, switch to an opaque `#1F4B57`.
- CSS tokens live in `panel/theme.css` as custom properties from bible §2.3. They are the same in every game;
  `tests/ui-tokens.test.ts` pins them to `UI_TOKENS` in `src/game/art/palette.ts`.

### 3.2 Components (`src/game/expedition/panel/`)

| Component | Anatomy (bible ref) | ~Lines |
|---|---|---|
| `InstrumentPanel.tsx` | frame, layout mode (scrub/board/vault/sandbox), back tab (`data-testid="panel-back"`), card stack, control slot, probe scrubber slot, verify row, badge, SR live region (contraption `srText`); `data-panel` attribute (the D4 keyboard guard); `data-testid="instrument-panel"`; boss phase batches (reveals the next batch's tokens when the previous batch is placed) | 300 |
| `primitives/HexGrid.tsx`, `TraceLine.tsx`, `BackTab.tsx` | §3.2 frame, circuit-trace terminals | 160 |
| `cards/GraphCard.tsx` | §3.3: SVG in a card slot; label tab top-right; axes with arrowheads; π/number/year tick labels (only major ticks labelled, bold 20–24 px at 1920 w); major/minor grid; plots 3 px round caps in f/g/h colours, `dashed` and `ghost` styles; open/closed endpoint circles r 7; **annotations** (amendment 7): brackets with end caps and labels, shaded regions, period markers (hollow circles), live dots, h/v reference lines (midline, `y = 1/2`), caption line, focusable markers; **interval columns** with dark hex gutters; orange **target line** with `[ ]` caps; **scrub line**; empty cards still drawn; `<title>`/`<desc>` from `sr` | 420 |
| `cards/TimelineCard.tsx` | RECORD / FILE cards (civil §5.0.2): years or months axis, labelled lanes on y, earned pins (white), hint pins (dashed), draft pins (green / blue), bands, causal arrows, axis break (`1896 ≈`), orange year cursor | 260 |
| `cards/UnitCircleCard.tsx` | square card: circle, axes ±1.2, landmark labels, hairlines every `hairlineStep`, the point, the orange input arc, green sin drop and blue cos drop (dashed), `level` line (`y = 1/2`), upper-half shade, π/6 mirror | 200 |
| `cards/BarsCard.tsx` | gauges (solute outside/inside, charge ledger), a sparkline with a **white** timer line (timers are not input), net-flow arrow | 180 |
| `cards/SchematicCard.tsx` | draws `SchematicPrim[]` (pump cross-section, span socket row, membrane fold) | 110 |
| `cards/LinkBoardCard.tsx` | sockets left, cartridges/roles right, cables (draft white, seated white, focus glow) | 170 |
| `cards/ClaimsCard.tsx` | claim column: letter glyph, text (3 lines max), aim socket (hollow; aimed = orange ring), states; the interactive surface of `AimControl` | 150 |
| `cards/SlotRailCard.tsx` | numbered slots joined by dot-ended trace lines, pylon glyphs on the right, heading ("AS PRINTED IN CH. 21") | 150 |
| `cards/MatrixCard.tsx` | clue columns × hypothesis rows, strike toggles, ACCUSE sockets, optional struck-count shading (H3) | 190 |
| `cards/EnergyCellsCard.tsx` | N gold cells: spent (dark), projected (hatched), chip "−2" | 90 |
| `cards/DocumentCard.tsx`, `cards/CauseGraphCard.tsx` | document with stamp; node/arrow board (the `TubeControl` surface) | 300 |
| `ValueChip.tsx` | §3.5: dark box, 2 px border in the fn colour, 30–34 px, positioned at `y(value)` clamped to the card, `left: -50%` overhanging into the world | 70 |
| `Scrubber.tsx` | §3.4: ruler (ticks from the `AxisModel` or `ProbeSpec`; stage `stops` as labelled detents), orange teardrop knob, 6 px line spanning the card stack, orange input tab (`inputSymbol` or `probe.symbol`), dark readout box 36 px (`probe.format`: "0.83π", "MAR 1965", "2.4 nm", "stage 3 · flip out"). `role="slider"`, `aria-valuemin/max/now/valuetext`; ←/→ one step, Shift×10, PgUp/PgDn one major tick, Home/End; emits `settled` 300 ms after the last key or on pointer up. **Two modes:** the mode input (scalar modes) or the **probe** (non-scalar modes with a `ProbeSpec`, amendment 3); a station never has both | 300 |
| `VerifyButton.tsx`, `SuccessBadge.tsx` | §3.8: machine-named caps; trace lines ending in dots; disabled (`ui.text.dim`) until `draft.complete`; `data-testid="widget-submit"` (kept); badge with bracket connectors, 1.6 s, `data-testid="success-badge"` | 150 |
| `BriefSheet.tsx` | Brief and Hints tabs (§2.6) | 120 |
| `OrbPalette.tsx`, `ColumnSliders.tsx` | §3.6/§3.7: 5 glyph fills, pencil button; −/+ columns (for function_world modes, post-demo) | 280 |
| `graph-math.ts` (pure, in `src/world/graph-math.ts`) | `niceTicks`, `formatTick(v, unit)` ("2π", "π/2", "1957", "MAR 1965", "40 %"), `formatProbe(v, spec)`, `sample(fn, x0, x1, n)` → segments split at NaN, ±∞ and jumps > 25 % of the y-range, `chipY`, `project(x, y, box)`, `fracYear(date)` / `dateOfFracYear(v)` | 280 |
| `fn-source.ts` | `closure` sources from view numbers (oscillator: `A·sin(b t + c) + d` built in JS); `expr` sources via `evalExactAt(expr, scope)` (`src/mechanics/util.ts`, added in W0) for claim traces and reliefs; samples memoized per view | 80 |

### 3.3 Controls: the input surface

`controlFor(meta.control, view)` returns an **instrument control** for native contraptions. For `console_slate`, or
any view a control's `supports()` rejects, it returns `WidgetControl`, which mounts the **existing widget**
(`widgetFor`) inside the panel. The widget gets the instrument CSS theme through `[data-panel] .widget` token
overrides and emits `onDraft`. Every control produces **exactly** the mode's `Input` through
`toSubmitInput(modeKey, draftInput)`, which reuses the widget files' exported converters (`chestsToInput`,
`optionsToInput`, `placedToInput`, `assignmentsToInput`, `wavesToInput`, plus the Link equivalents), so grading paths
are shared. Each control's state logic is a pure `controls/<name>.logic.ts` with `toDraftInput(state)`,
`complete(state)` and `fromDraftInput(d)` (cached drafts restore on reopen).

| Control | Modes | Draft `input` (+ channels) | `complete` when | World link | ~Lines |
|---|---|---|---|---|---|
| `ScrubControl` | tuner.oscillator, tuner.formula, mapper.number_line | `{value}` (+ `settled`) | always | continuous pose | 180 |
| `AimControl` | truth_finder.mimic, truth_finder.predict_reveal | `{statementIndex}` / `{optionIndex}` (+ `hover`, `focus`) | one chosen | **emits a draft on hover and on focus** (not only on select; amendment 33): the beam, lamp or knob previews the hovered holder; selecting commits `input` | 220 |
| `SlotRailControl` | sequencer.linear | `{slots}` (partial) | every slot filled | the placed plank flies to its bay/socket and hovers; slabs rise; decks slide in | 260 |
| `RouterControl` | sorter.bins | `{assignments}` (partial) (+ `focus`) | every item assigned (every **visible** batch item for boss phases; Verify needs all) | the item queues at the chosen lane/maw/drawer (no correctness) | 280 |
| `WaveControl` | sorter.type_match | `{answers}` (+ `wave`, `hover`) | **after the last wave** (answered or timed out); then **Verify** enables (amendment 33) | the cell drifts to the lock; hovering a valve renders the claim; committing sends it to the basin | 280 |
| `CableControl` | linker.pairs (switchboard, stage_machine) | `{links}` (partial) (+ `focus`) | every left linked | a cable/cord seats between sockets; lamps light white (seated, not correct) | 260 |
| `TubeControl` | linker.chain | `{edges}` (partial) (+ `focus`) | `edgeCount` reached | a wire/tube grows between the two housings; a completion gauge fills | 240 |
| `MatrixControl` | investigator.elimination | `{hypothesisId}` (+ `marks`, UI-only) | one hypothesis accused | struck hypotheses rotate their tumblers; the last unstruck one glows (from the player's own marks) | 240 |
| `WidgetControl` | every other mode | whatever the widget emits via `onDraft` (else `null`) | the widget's own submit | the console slate mirrors the widget | 80 |

**WaveControl rules** (cell e5/e9): the waves run on the same timer semantics as `WavesPick` (`secondsPerWave`), a
missing answer counts wrong; Verify replaces the auto-submit; after a failed Verify the waves replay **with the
previous answers preselected** (Enter confirms each, so a retry is five keypresses).
**MatrixControl rules** (civil e12): strike toggles are the player's notation and live only in `draft.marks`; they
never reach `grade()` and are never checked against the eliminations. There is no `sluice` layout (amendment 33):
sluice stations use the scrub layout with a `WaveControl`.

The existing widgets gain `onDraft?: (d: { input: unknown; complete: boolean; focus: string | null }) => void` in
`WidgetProps`. It is emitted from the same effects that hold their local state (`BinsSort` assignments, `Order`
placed, and so on). `onLive` stays, marked deprecated, so the legacy hosts are untouched. This is about 15 lines per
widget file. A widget's own "Lock in" stays its submit button, restyled as Verify through CSS.

### 3.4 Live value flow

```
control state change
  → onDraft({input, complete, focus, hover, probe, settled, wave, marks})       (panel)
  → ExpeditionClient.onDraft: draftRef[encId] = {...d, encounterId, modeKey, seq: ++seq}   (ref only: no re-render)
      → hostRef.current.bindDraft(encId, draft)             → ContraptionController.bind → sim/clock → eased pose → applyPose + labels + audio
      → panelLiveRef.current(draft)                          → panel recomputes meta.panelLive (local state inside the panel only)
probe scrubber change → same path with draft.probe (never reaches grade())
(i) hint → runner.hint() → rung r → dialogue hint line → host.onHint(encId, r) + host.setAidTier(encId, tier, hintsUsed)
                                                         → panelStatic recomputed for the new (aidTier, hintsUsed)
Verify → runner.submit(toSubmitInput(draft)) → grade → diagnosis = diagnose(...)   (src/world/diagnose, pure)
      → machine VERIFIED → await host.resolveEncounter(encId, diagnosis) → RESOLVE_DONE
      → failedVerifies++ → aidTier = aidTierOf(hintsUsed, failedVerifies) → host.setAidTier(...)
```

`view` is memoized per encounter index inside `useRunner`, which fixes D5. `panelStatic` (sampled plots) is computed
once per `(encounter, aidTier, hintsUsed)`.

### 3.5 Keyboard and screen-reader behaviour

**One key map** (`input/keymap.ts`; the game docs defer to it):

| Key | Explore | Panel / sandbox | Cutscene |
|---|---|---|---|
| A / D, ← / → | walk | (focused control: step) | — |
| Shift | run (hold) | ×10 step modifier | — |
| Space | hop / timed hop; cosmetic hop with no link in range | advance the bar when it has focus | advance the line |
| W / ↑ | climb, ladder up, board a vehicle, enter a portal | (control: previous item) | — |
| S / ↓ | drop, ladder down | (control: next item) | — |
| E / Enter | interact (console, NPC, plaque, pickup, touch, sandbox) | activate the focused control element; Verify when focused | `await_interact` |
| 1–9 | — | quick-select claim, valve, bin, socket, stage | — |
| I | — | hint rung (the (i) button); Shift+I opens the Brief sheet | — |
| M | map (when `story.map`) | — | — |
| J | journal | — | — |
| H or ? | key legend | key legend | — |
| N | mute toggle | mute toggle | mute toggle |
| Esc | close map/journal | back (close without grading) | skip |

- **Opening the panel:** focus moves to the panel's first control (the knob, first claim, first plank or first
  item). Tab order is back tab → cards (only interactive markers) → control → probe scrubber → Verify → (i). Esc or
  the back tab closes the panel and returns focus to the canvas container.
- **Phaser capture:** released while the panel, the map or the journal is open (D4). The controller ignores keys
  whose target is inside `[data-panel]`.
- **Screen readers:**
  - Every control has `aria-describedby` pointing at the pinned instruction line.
  - The panel live region announces the contraption's `srText` (throttled), for example "The beam is 0.4 units left
    of the middle node."
  - Verify outcomes are announced assertively: the badge text or the display feedback.
  - Cards carry `role="img"` with an `sr` summary ("f of x, sine wave, amplitude 3, orange cursor at t equals 2").
- **Projector legibility floor at 1280×720:** dialogue ≥ 22 px, readout ≥ 28 px, chips ≥ 22 px, tick labels
  ≥ 16 px, contrast ≥ 7:1 (white on `#0F2A33` is about 14:1).

---

## 4 · Contraption library (13 for the demo)

**R** means reusable across subjects (the skin changes, the maths does not). All 13 demo archetypes are needed by
the three showcase fixtures (amendment 5). Status `post_demo` archetypes stay in the table for the generalization
roadmap; `console_slate` covers their modes until then (amendment 38).

| # | id | Modes | Control → binds | World visuals (live) | Success | Failure (visible, never the answer) | Layout | Skins | Status |
|---|---|---|---|---|---|---|---|---|---|
| 1 | `ring_gate` | tuner.oscillator (alt: tuner.formula for angular quantities) | scrub T | two notched rings in a wall: the outer ring turns by b·T, the inner disc rocks by the wave's value; a lap tally ratchets; release replay 0 → T; ghost card `f(t + T)`; amplitude/midline asks use a counterweight variant | pawl drops, rings lap once more and lock, fin splits, light shaft, the flow (water) surges through | pawl strikes the rim (spark) or slips on tooth II; the misalignment arc pulses; near-miss `aligned_multiple` | scrub | `ring_gate` (Tidewheel) | demo · R |
| 2 | `emitter_rail` | mapper.number_line (alt: mapper.plane 1-D) | scrub value | a carriage rides a rail (arc when the view is a 2π π-labelled line, straight otherwise, log for log scales); its beam sweeps; landmark studs; detents; sin/cos gauges on arc skins; the target hidden in fog/dark/water | beam surge, fog dissolves, node ignites, the disc turns by the set angle, the payoff forms | beam scatter at its end; gold chevrons show direction and distance band (1/2/3), never the target | scrub | `vesper_dial`, `radian_rail`, `year_rail`, `thermo_tower` | demo · R |
| 3 | `pendulum_sync` **(new)** | tuner.oscillator (ask period, frequency) | scrub T | a guardian swings in real time (sim phase); the player's counter-pendulum runs at the dialled T; the sync thread's brightness `½(1 + cos Δ)` beats at `\|1/T₀ − 1/T\|`; common-start reset on open and on settle | the thread turns gold, the guardian's swing decays in lockstep, it kneels, the door opens | the thread snaps with a spark; the guardian taunts (`boss.taunts`); probes flash the span tiles | scrub | `wardens_shield` | demo · R |
| 4 | `claim_holders` | truth_finder.mimic | aim → statementIndex (hover previews) + optional probe | 3–4 holders (singers, pods, witness lenses) with plaques; an aimer (lens, emitter, arc or pendant lamp) swings its beam; **claim renders**: trace slates (math), ghosts over a live reference sim (science), footprints on the FILE card (history) | the quarantine animation of the skin/config (mimic crab, ridge thaw, tank dilates, raft lock floods, lanterns ignite, RETRACTED stamp) | the picked holder is honest: it holds bright, its ghost snaps into register, one calm chime | board (trig), scrub (cell, civil) | `resonance_pillars`, `treasury_pillars`, `specimen_pods`, `witness_projector` | demo · R |
| 5 | `oracle_ticker` | truth_finder.predict_reveal | aim → optionIndex + optional year probe | a machine "prints" the scenario; a selector knob points at the option; the conduit hums | prints the sourced reveal with a date slug; the conduit glows; payoff lamps light one by one | prints the reveal plus "NOT WHAT HAPPENED" on the forecast line; the selector unlocks | scrub | `wire_ticker` | demo · R |
| 6 | `step_bridge` | sequencer.linear (alt: sequencer.rank post-demo) | slots → keys + optional probe | placed planks fly to bays: floating sockets, slabs rise from water, deck sections slide in, or a stage rail whose probe plays the player's own order through cumulative stage physics (`membrane-fold` sim) | bays lock left → right with the `stepEffects` card replay; bridge/steps terrain; vesicle carries | prefix locks; slot n tips and sinks; a decoy crumbles or dissolves; stage playback runs to the trap (empty micro-vesicle) | board; scrub for `endocytosis_lift` | `floating_steps`, `walking_road`, `timeline_bridge`, `endocytosis_lift` | demo · R |
| 7 | `router_lanes` | sorter.bins | bins → assignments (+ boss phases) | items drift, then queue at the chosen lane/maw/drawer; counts only; the hydration lens at aid tier ≥ 1; ATP projection; feature shutters (history) | items pass by their lane's physics; drawers slam; cabinets roll apart; maws swallow | only the first miss acts: it bounces off the heads, fizzles, slides back, bounces out of the drawer (the shutter opens) or is spat back | board | `membrane_router`, `carrier_lanes`, `gatekeeper_maws`, `filing_cabinets`, `provenance_drawers` | demo · R |
| 8 | `sluice_waves` | sorter.type_match | waves → answers | one cell per wave drifts to the lock; hovering a valve renders the claimed bath (solute density) or claimed flow; committing floods the lock and sends the cell to a basin; timeout → the eddy | the lock drains or fills; every cell plays its true fate | the first missed wave's cell floats back, its tag blinks; retry with answers preselected | scrub | `tonicity_sluices` | demo · R |
| 9 | `switchboard` | linker.pairs | cables → links + optional year probe | verlet cords seat between jacks; jack and step lamps light **white** (seated, not correct); a document's lines fill | lamps turn cyan in sequence; the document prints; the steps solidify | the focus cord unseats and drops; its jack flickers amber; the clue prints as a margin note | board | `switchboard` | demo · R |
| 10 | `stage_machine` **(new)** | linker.pairs | cables → links + a stage probe k | a machine with typed sockets; linked cartridges load their counts (neutral "loaded: …" labels); the stage scrubber plays the cycle through what you loaded; a ledger card sums the effect | two automatic cycles; ions jet; the gate lifts; the beacon fires | stage playback jams at the first wrong link's stage (grind); other sockets show nothing extra | scrub | `pump_rewiring` | demo · R |
| 11 | `cause_tubes` | linker.chain | tubes → edges + optional year probe | wires or tubes grow between housings placed by **display** index (catenary, vertical, or Manhattan ≤ 2 bends); a completion gauge; receiving dishes turn to face their source | a current or capsule runs the chain in causal order; lamps light; the gate/lift/bolt moves | a decoy's fuse pops; the focus box sparks and its outgoing wire goes slack; nothing flows | board | `relay_line`, `broadcast_relay`, `big_board` | demo · R |
| 12 | `tumbler_vault` | investigator.elimination | matrix → hypothesisId (+ UI-only marks) | a vault door with hypothesis tumblers that rotate by the player's own strikes; the last unstruck tumbler glows and slides toward the bolt channel | the tumbler aligns, bolts retract in sequence, rings counter-rotate, the door swings, the press prints | the accused tumbler grinds; the eliminating clue card slides beside its row | vault | `tumbler_vault` | demo · R |
| 13 | `console_slate` | **any implemented mode** (fallback) | `WidgetControl` (existing widget) | a lectern whose slate mirrors the widget; the gate behind it is dormant | the gate lifts; a beam restores | the slate flashes the feedback | board | `lectern_slate` (any biome) | demo · R (universal) |
| 14 | `counterweight_lift` | tuner.formula | scrub the controlled input | a lift whose height = the output; a pin at the target height | the lift locks at the ledge | stops short or over | scrub | — | **post_demo** |
| 15 | `beam_table` | mapper.plane | board: orb → {x, y} | a star chart; the orb's beam hits a wall grid point | the node ignites | the beam hits off-target | board | — | **post_demo** |
| 16 | `glyph_ring` | sequencer.cycle | slots (circular) | a rotating glyph ring | the ring seals | the first wrong successor flickers | board | — | **post_demo** |
| 17 | `pillar_staircase` | sequencer.rank | slots | pillars rise to their rank and become stairs (P8) | the staircase completes | a misranked pillar sinks | board | — | **post_demo** |

**Sandbox metas** (P1, `src/world/sandboxes/`): `music_box` (skin `astronomer_box`), `plant_garden` (skin
`plant_pool`, reusing the `osmotic_cell` sim), `darkroom` (skin `darkroom_trays`).

That covers 10 of 10 showcase modes natively, plus formula, plane, cycle and rank post-demo, plus the universal
fallback. The Variant-native function_world contraptions (`orb_limiter` for limits, `function_stairs` for g/h
staircases, `bridge_patch` for f·g) are the next wave; their panel primitives (OrbPalette, ColumnSliders, interval
columns, target line) ship with the panel, so they only need metas and prefabs.

### 4.1 Showcase bindings (all 29 encounters)

**This table is the binding the three world JSON files encode.** It was rewritten from the game docs (§2 scenes, §5
contraptions), which stay authoritative for nouns, lines, formulas and timelines. Coordinates are **per zone**; each
zone table gives the exact conversion from the game doc's cumulative coordinates. Verify labels and badges are
`panel.verifyLabel` / `panel.successBadge`.

#### Trig · "The Orrery Terraces" · biome `orrery_terraces` · guide `cog` (companion Cog) · boss `warden`

`cast.extras`: `brasswick` (nervous_scholar), `lumen` (wise_mentor), `quill` (narrator), `mimic` (sly_villain),
`ilse` (wise_mentor, star-figure portrait). Protagonist Wren on `shared.char.wren` (scarf, satchel, sighting staff
overlays). `story.objectiveLabel` "RHYTHMS"; no meter; progress effects: 6 `beam_line`s to the Orrery tower on L1
(P1) and 7 dome constellations as `hub_socket`s (P1).

| Zone | Scenes | width × height | Conversion (doc → zone) | Segments (= layer sets) | Exits | P0 art |
|---|---|---|---|---|---|---|
| `z1_sunward` Sunward Terrace | S0, S1, S2 | 8000 × 1600 | `x = x_doc`; `y = y_doc − 1560` (floor 3000 → 1440; upper terrace 2600 → 1040; dial centre (4800, 1140); ring centre (7400, 836)) | `sunward_day` [0, 8000] | `x 7990` → `z2_crystal` x 60, `walk`, requires `e2_period` solved | **full** |
| `z2_crystal` Crystal Stair | S3, S4, S5 | 9600 × 2400 | `x = x_doc − 8000`; `y = y_doc − 700` (2600 → 1900, 2100 → 1400, 1500 → 800, 1100 → 400) | `hall_peach` [0, 3200], `stair_peach` [3200, 9600] | platform `rim_top` x 9590 → `z3_dome` x 60, `vertical_up`, requires `e5_period_review` | kit + Crystal Stair waterfall cliff |
| `z3_dome` Warden's Dome | S6 (+ S7 finale) | 5400 × 1400 | `x = x_doc − 17600`; `y = y_doc + 100` (floor 1100 → 1200; lower walkway 1370) | `gantry_dusk` [0, 2400], `dome_interior` [2400, 5400] | — | kit + dome interior and Star Door |

P0 traversal in `z1_sunward`: `hop` at x 1800 (a 0.9 H step-up), `hop` ×2 across the dry-canal stepping stones at
x 2150–2350, `hop` to the wisp ledge at x 3550, `drop` from the upper terrace at x 5250. P1: `z2` Echo Lift is a
payoff; colonnade-lintel `hop` at x 1300; `z3` gantry `timed_hop` ×3 (T = 1.5, 2.5, 3.0) with the lower walkway as
`missTo` and a `ladder` back up.

| Enc | Scene · zone @ consoleX (anchor) | Archetype / skin | Layout | Control | Probe · world binding | Config (keyed by) | Payoff | Verify / Badge |
|---|---|---|---|---|---|---|---|---|
| e1_radians | S1 · z1 @ 4300 (4800, 1140) | emitter_rail / vesper_dial | scrub | Scrub → `{value}` θ | — (scalar input) | `rail: arc`, `radius: 310`, `gauges: [sin, cos]`, `hiddenTarget: fog`, `detent: "pi/12"`, `readout: bracket`, `cards.unitCircle` | terrain / up / `stairs_rise` · "spoke stair" (5 × 80) | ALIGN THE DIAL / VESPER ALIGNED |
| e2_period | S2 · z1 @ 6900 (7400, 836) | ring_gate / ring_gate | scrub | Scrub → `{value}` T | — | `flow: water`, `tally`, `replayOnSettle`, `ghostCard`, `lapsCardTier: 2`, `startMarkerTier: 1` | remove_blocker / none / `door_opens` · "Tidewheel doorway" | LOCK THE RINGS / RINGS LOCKED |
| e3_amplitude | S3 · z2 @ 1500 (2000, 1900) | claim_holders / resonance_pillars | board | Aim → `{statementIndex}` | `x` ∈ [0, 2π], step π/48, `pi` · **`trace_slate`**: the Tuning Lens projects the aimed claim's trace + playhead at x onto the singer's chest slate; bell hum pitch ∝ \|f(x)\| (amendment 27) | `holders[statementIndex].trace` (claim traces), `reference: 3*sin(x)`, `aimer: tuning_lens`, `quarantineAnim: mimic_crab` | ride / up / `lift_moves` · "Echo Lift" (+500) | EXPOSE THE MIMIC / MIMIC EXPOSED |
| e4_solve | S4 · z2 @ 3900 (4650, 1400) | step_bridge / floating_steps | board | SlotRail → `{slots}` | `x` ∈ [0, 2π] · **`relief_marker`**: a plumb marker rides the `2 sin x` relief carved along the chasm lip; its crossings with the `y = 1` water line glint as the probe passes (amendment 27) | `items[key].meta.glyph`, `stepEffects[key]`, `anchors: 2`, `relief: {expr: "2*sin(x)", line: "1"}`, `bays: floating` | terrain / none / `bridge_forms` · "Solving Span" (900 gap) | LAY THE SPAN / SPAN LOCKED |
| e5_period_review | S5 · z2 @ 8500 (8800, 800) | claim_holders / treasury_pillars | board | Aim → `{statementIndex}` | `x` ∈ [0, 4π] · `trace_slate` | `holders[].trace`, `reference: sin(x)` on [0, 4π], `aimer: tuning_lens`, `quarantineAnim: mimic_crab` | terrain / up / `stairs_rise` · "rim stair" (5 × 80) | EXPOSE THE MIMIC / MIMIC EXPOSED |
| e6_boss | S6 · z3 @ 3550 (4700, 1200) | pendulum_sync / wardens_shield | scrub | Scrub → `{value}` T | — | `spanUnitPx: 94`, `armPx: 300`, `shieldArmPx: 442`, `swingDeg: 14`, `spanTiles: 7`, `driftCardTier: 1`, `peakDotsTier: 2`, `slowTimeToggle` | remove_blocker / none / `door_opens` · "Star Door" → finale | MATCH THE RHYTHM / RESONANCE LOCKED |

Boss (e6): `speakerId: warden`, `arenaTriggerX: 3000` (doc 20600), `arenaCutsceneId: e6_arena` (wake from the feet
up, `e6.warden1` (fixture) + `e6.warden2`), `arenaBounds: {x0: 2400, x1: 5400}`, `taunts.byKey`: `over` →
`e6.fail.long`, `under` → `e6.fail.short`; guide `fail.default` = `e6.fail.cog`. Probes: `nearValue 3` and
`nearValue 6` → `reach`, `nearValue 2` → `half`. `feedbackNouns`: `chest → singer` for e3 and e5.

#### Cell · "The Living Gate" · biome `living_gate` · guide `pilot` (companion Pip) · boss `gatekeeper`

`cast.extras`: `sucra` (nervous_scholar), `poro` (wise_mentor), `kay` (gruff_guard), `ferryman` (narrator).
Protagonist the Diver on `shared.char.diver` (bubble helmet, tide scarf, probe-staff). `story.objectiveLabel`
"GATES"; **meter** `gradient` "GRADIENT", percent, start 12, after e1…e11: 18, 26, 32, 40, 48, 56, 64, 78, 84, 90,
100, `drives: [hud_bar, ambient_particles]`; progress effects: 11 conduit `hub_socket`s on the Nuclear Pore.

| Zone | Scenes | width × height | Conversion (doc → zone) | Segments | Exits | P0 art |
|---|---|---|---|---|---|---|
| `zone_a` Glycocalyx Shore | S1, S2 | 7400 × 1350 | `x = x_doc`; `y = y_doc + 270` (surface 713 → 983; e2 terrace 813) | `shore_morning` [0, 7400] | `x 7390` → `zone_b` x 60, `walk`, requires `e2_selectivity` | **full** |
| `zone_b` Tide Basins | S3, S4 | 8400 × 1600 | `x = x_doc − 7400`; `y = y_doc + 500` (surface → 1213; raft ledge 873; trench floor 1468) | `basins_afternoon` [0, 8400] | none: the e6 Carrier Door (carry) enters `zone_c` | kit + sluice trench and Poro |
| `zone_c` Pump Hall | S5, S6 | 7800 × 1600 | `x = x_doc − 15800`; `y = y_doc + 500` (surface 1213; pump deck and pit ledge 873) | `hall_interior` [0, 4200] (light `interior`), `pit_dusk` [4200, 7800] | none: the e10 vesicle (carry, down) enters `zone_d` | kit + Pump Hall vault shell |
| `zone_d` Cytoplasm | S7, S8 | 5600 × 1500 | `x = x_doc − 23600`; `y = y_doc + 400` (surface 1113; high rail 773) | `vault_road_amber` [0, 2600], `vault_violet` [2600, 5600] | — | kit + Nuclear Pore hub |

P0 traversal in `zone_a`: `hop` up the glycan-root ledge to plaque P1 (x 1400), `hop` across glycan roots (x 2200,
the jump tutorial), `climb` to the cholesterol-stud ledge behind the Crossing Gate (x 6900, requires e2). P1: S5
Kay's lantern ledges (`hop` from the risen gantry, a `drop` behind the Low Tank), S7 `ride` links on vesicle rail
platforms (+2 H) and the viewpoint detour.

| Enc | Scene · zone @ consoleX (anchor) | Archetype / skin | Layout | Control | Probe · world binding | Config (keyed by) | Payoff | Verify / Badge |
|---|---|---|---|---|---|---|---|---|
| e1_bilayer | S2 · a @ 4300 (4500, 983) | claim_holders / specimen_pods | scrub | Aim → `{statementIndex}` | `d` probe depth 0–5 nm, step 0.1 · **`needle`**: tip y = y_s + 41.6·d; heads part and reseal; the Na⁺ ion is held at the head/tail boundary past 0.9 nm | `holders[statementIndex].ghost` (`bilayer_outline`, `rigid_holed_slab`, `core_blocks_ion`), `referenceSim: bilayer_probe`, `aimer: probe_emitter`, `quarantineAnim: ridge_thaw` | terrain / up / `ramp_forms` · "thawed ridge" (1.4 H hump → 0.3 H ramp) | QUARANTINE · THAW RIDGE / MIMIC QUARANTINED |
| e2_selectivity | S2 · a @ 6300 (6700, 983) | router_lanes / membrane_router | board | Router → `{assignments}` | — | `items[i0…i5]` `{glyph, polar, charged}`, `lanes`: `diffuses → oil_road`, `protein → crossing_gate`, `lens: hydration` | terrain / up / `ramp_forms` · "carrier rocker" (+1 H), blocker = the gate arch | ROUTE CARGO / CARGO ROUTED |
| e3_diffusion | S3 · b @ 1100 (1500, 1213) | claim_holders / specimen_pods | scrub | Aim | `a` dye load 0–10 mM, step 0.5 · **`dye_load`**: reloads the left chamber (N = round(10a)); the Balance Lock tilts with `C_L − C_R` | ghosts `random_walk` / `purposeful_march` / `net_flux_arrow`, `referenceSim: diffusion_tank {p: 0.3, sigma: 5}`, `quarantineAnim: tank_dilate` | remove_blocker / none / `barrier_lifts` · "Balance Lock boom" | QUARANTINE · LEVEL LOCK / MIMIC QUARANTINED |
| e4_osmosis | S3 · b @ 3100 (3500, 1213) | claim_holders / specimen_pods | scrub | Aim | `s` bath salt 0–10 %, step 0.1 · **`bath_salt`**: cell volume, crenation, droplet flow, bouncing cubes; ghosts project only when s > 2.5 | ghosts `water_out_arrows` / `salt_inflow` / `shrink_outline`, `referenceSim: osmotic_cell {cIn: 2, b: 0.3}`, `scenarioMin: 2.5`, `quarantineAnim: raft_lock_flood` | ride / up / `water_rises` · "raft" (+2 H), `autoBoardMs: 6000` | QUARANTINE · FLOOD LOCK / MIMIC QUARANTINED |
| e5_tonicity | S4 · b @ 5200 (5600, 1213) | sluice_waves / tonicity_sluices | scrub | Wave → `{answers}` | — (the wave timer is the continuous element) | `waves[waveIndex]` `{cell, inDots, outDots, fate, showFate: true}`, `valves[categoryId]` `{densityK: 0.25 / 1 / 2.5, arrows: none}` | terrain / up / `steps_emerge` · "carved steps" (drain 1.5 H) | DRAIN THE SLUICE / SLUICE DRAINED |
| e6_facilitated | S4 · b @ 7500 (7900, 1213) | router_lanes / carrier_lanes | board | Router | — | `items[i0…i4]` `{glyph, from, to, vehicle}`, `lanes`: `passive → glide_gate`, `active → pump_gate`, `energy: {reserve: 10}` | carry / none / `door_carries` · "Carrier Door" → `zone_c` | OPEN THE THRESHOLD / THRESHOLD OPEN |
| e7_active | S5 · c @ 900 (1400, 1213) | claim_holders / specimen_pods | scrub | Aim | `r` ATP feed 0–10 ATP/s, step 0.5 · **`atp_feed`**: piston rate, pipe glow, tank levels (`pump_flume` sim) | ghosts `uphill_arrow` / `atp_sparks` / `downhill_boost`, `referenceSim: pump_flume`, `quarantineAnim: lanterns_ignite` | ride / up / `lift_moves` · "gantry lift" (+2 H) | QUARANTINE · LIGHT HALL / MIMIC QUARANTINED |
| e8_pump | S5 · c @ 2900 on `pump_deck` (3300, 873) | stage_machine / pump_rewiring | scrub | Cable → `{links}` | `k` pump stage 0–6, integer stops rest · bind Na⁺ · ATP · flip out · swap · drop P · flip in · **`stage`**: drum 60°·k, jaws, loaded ions move | `lefts[l0…l3]` `{stage, socketKind}`, `rights[r0…r3, x0]` `{semantic}`, `ledger: charge` | remove_blocker / none / `gate_lifts` · "Hall Gate" | RUN ONE CYCLE / PUMP CYCLING |
| e9_osmosis_review | S6 · c @ 5000 (5300, 1213) | sluice_waves / tonicity_sluices | scrub | Wave | — | `waves[]` `{showFate: false, fate: null}`, `valves` in/out/none with claim arrows on hover | ride / up / `water_rises` · "barge" (+2 H) | FILL THE LOCK / LOCK FILLED |
| e10_bulk | S6 · c @ 7100 on `pit_ledge` (7300, 873) | step_bridge / endocytosis_lift | scrub | SlotRail → `{slots}` | `k` playback 0–4, continuous, `playback: true` · **`playback`**: the player's own order through the membrane-fold stage physics | `stages[key]` `{stageId, requires, icon}`, `bays: stage_rail` | carry / down / `vesicle_carries` · "vesicle" → `zone_d` (−4 H) | LAUNCH THE LIFT / VESICLE LAUNCHED |
| e11_boss | S8 · d @ 3800 (4200, 1113) | router_lanes / gatekeeper_maws | board | Router (3 phases) | — | `items[i0…i6]` `{glyph, from, to, polar, charged}`, `lanes`: `simple → oil_maw`, `facilitated → channel_maw`, `active → pump_maw`, `energy: {reserve: 12}`, `lens: hydration` | remove_blocker / none / `vault_opens` · "Nuclear Pore" → finale | OPEN THE VAULT / VAULT OPEN |

Boss (e11, amendment 18): `speakerId: gatekeeper`, `arenaTriggerX: 3000`, `arenaCutsceneId: e11_arena` (`gk_1`, the
fixture beat), `phases`: `[i0, i1]`, `[i2, i3]`, `[i4, i5, i6]`, each with a Gatekeeper line; maws open on focus,
the eye-ring tracks the focused cargo, the ATP pipe surges with the projected spend; `taunts.fail: [e11_fail]`. One
`Input`, one `grade()`. `feedbackNouns`: `chest → pod` for e1, e3, e4, e7 (cell X8 is dropped).

#### Civil rights · "The Archive of Voices" · biome `archive_of_voices` (sensitive) · guide `archivist` (companion Wick) · boss voice `editor`

`cast.extras`: `otis` (gruff_guard), `hattie` (wise_mentor), `dolores` (cheerful_sidekick), `theo`
(nervous_scholar); all fictional present-day archive staff (R10). Protagonist Nell on `shared.char.nell` (satchel,
scarf overlays); Ida in person in S1 on `shared.char.ida` (female_person body). `story.objectiveLabel` "RECORD
RESTORED"; `recordStrip` lanes `origins`, `direct_action`, `legislation` with the earned pins of civil §5.0.2;
progress effects (P1): record-light `beam_line`s, 12 Engine lens `hub_socket`s, 12 wall-of-front-pages
`label_swap`s. Every station except e12 (vault mode, with its own mini strip) carries a `record_lens` accessory. The intro
sets the flag `engine_awake` with a `set_state` step right after the breaker's `await_interact`.

| Zone | Scene | width × height | Conversion (doc → zone) | Segments | Interiors | Exits | P0 art |
|---|---|---|---|---|---|---|---|
| `s1_morgue` | The Morgue | 3840 × 1400 | `y = y_doc + 320` (floor 900 → 1220; the street-door landing 720) | `morgue_interior` (light `interior`, `drip`) | — | x 3830 → `s2_courthouse`, `film_seam`, requires flag `engine_awake` | Record Engine hero + kit |
| `s2_courthouse` | Courthouse Square | 5760 × 1080 | identity (ground 900) | `late_afternoon` | — | → `s3_schoolhouse`, `film_seam`, requires e2 | **full** |
| `s3_schoolhouse` | Schoolhouse Hill | 3840 × 1080 | identity (hill 900 → 820, terrace 700) | `dusk_begins` | — | → `s4_main_street`, requires e3 | kit + school façade |
| `s4_main_street` | Main Street | 5760 × 1080 | identity | `dusk_rain` (`rain_heavy`) | `lunch_counter` [600, 2000], `terminal` [2600, 4500] | → `s5_church_mast` from the overpass, requires e5 | kit + five-and-dime and terminal façades |
| `s5_church_mast` | Church Square and the Mast | 4800 × 2000 | `y = y_doc + 920` (ground 1820; relay stations 1680…1040; rooftops 1040) | `night_rain` | — | rooftop platform → `s6_memorial`, requires e6 | kit + church rose window |
| `s6_memorial` | Memorial Steps and Filing Hall | 5760 × 1300 | identity (walkway 640; stairwell bottom 1150) | `blue_hour` [0, 3000], `hall` [3000, 5760] | `filing_hall` [3000, 5200] | stairwell bottom → `s7_selma`, requires e8 | kit + memorial colonnade |
| `s7_selma` | The Bridge at Selma | 5760 × 1080 | identity | `river_road` [0, 1300], `bridge` [1300, 4300] (`runEnabled: false`; variant after e9: `clear`, music `solemn`), `far_bank` [4300, 5760] | — | streetcar `ride` link at x 5200 → cutscene `ride_home` → `s8_stacks_vault`, requires e9 | kit + the bridge (a contraption part) |
| `s8_stacks_vault` | Morgue Stacks and the Editor's Vault | 6720 × 2000 | `y = y_doc + 500` (floor 1400; gallery 1020; vault level 1900) | `stacks` [0, 4700], `vault` [4700, 6720] | — | — (finale vista `dawn`) | kit + the vault door (a contraption part) |

P0 traversal in `s2_courthouse`: `climb` the flagpole plinth to the cornice ledge (x 2500, requires e1), `hop` to the
awning from the last Walking Road slab (x 5300, requires e2). P1: S4 rafters `climb` (requires e5), S5 mast-top
`climb`, S8 `ladder` to the gallery (requires e10).

| Enc | Scene @ consoleX (anchor) | Archetype / skin | Layout | Control | Probe · world binding | Config (keyed by) | Payoff | Verify / Badge |
|---|---|---|---|---|---|---|---|---|
| e1_brown | S2 @ 900 (1700, 900) | claim_holders / witness_projector | scrub | Aim → `{statementIndex}` | YEAR 1950–1960 (`month_year`, step 1/12, axis break 1896) · **`record_lens`** on the cornice rail | `holders[statementIndex].footprint` (pin 1954 / band 1954–1955 "claimed: desegregated" / arrow 1896 → 1954), `hintPins: [{rung: 2, date: 1957, "Little Rock"}]`, `aimer: arc_lamp`, `quarantineAnim: retract_stamp` | terrain / up / `stairs_rise` · "courthouse steps" | RETRACT SLIDE / SLIDE RETRACTED |
| e2_montgomery | S2 @ 3800 (4700, 900) | step_bridge / walking_road | board | SlotRail → `{slots}` | YEAR NOV 1955–FEB 1957 · **`day_counter`** `DAY = clamp(round((year − 1955.917)·365.25), 0, 381)` | `items[key].meta.printedDate` (s0 "1955-12-01"), `bays: flat_road`, `dayCounter: {epoch: "1955-12", max: 381}` | terrain / none / `bridge_forms` · "Walking Road" | LIGHT THE ROUTE / ROUTE RESTORED |
| e3_little_rock | S3 @ 1450 (1300, 900) | oracle_ticker / wire_ticker | scrub | Aim → `{optionIndex}` | YEAR 1954–1958 · `record_lens` on the telegraph wire | `fileDates: [{1957-09, "Guard posted"}]`, `conduit: telegraph_wire`, `payoffLamps: 9` | remove_blocker / none / `barrier_dissolves` · "school doors" | SEND TO THE WIRE / WIRE CONFIRMED |
| e4_sit_ins | S4 @ 900 (1450, 520) | claim_holders / witness_projector | scrub | Aim | YEAR 1959–1961 · `record_lens` | no footprints (all-or-none rule), `fileDates: [{1960-02-01, "Greensboro"}]`, `aimer: pendant_lamp`, `quarantineAnim: retract_stamp` | remove_blocker / none / `door_opens` · "swing door" | RETRACT SLIDE / SLIDE RETRACTED |
| e5_freedom_rides | S4 @ 2900 (3650, 520) | cause_tubes / relay_line | board | Tube → `{edges}` | YEAR 1960–1962 · `record_lens` on the canopy rail | `nodes[key].meta.printedDate`, `connector: catenary`, `layout: canopy_row`, `carrier: current` | remove_blocker / none / `gate_lifts` · "rolling gate" | CLOSE THE CIRCUIT / CIRCUIT CLOSED |
| e6_birmingham | S5 @ 3350 (3600, 1820) | cause_tubes / broadcast_relay | board | Tube | YEAR 1962–1964 · `record_lens` on the bandstand roofline | `connector: vertical_wire`, `layout: mast` (heights by display index), `frameZoom: 0.7` (focused station + lift) | ride / up / `lift_moves` · "mast lift" (+780) | CLOSE THE CIRCUIT / CIRCUIT CLOSED |
| e7_march | S6 @ 900 (900, 900) | switchboard / switchboard | board | Cable → `{links}` | YEAR 1962.5–1964 · `record_lens` on the attic band | `document: {title: "MARCH ON WASHINGTON FOR JOBS AND FREEDOM · AUGUST 28, 1963"}`, `stepLamps`, `cord: verlet`, `decoyDimRung: 3` | terrain / up / `stairs_rise` · "memorial steps" | CONNECT THE PROGRAM / PROGRAM CONNECTED |
| e8_cra | S6 @ 3250 (4200, 900) | router_lanes / filing_cabinets | board | Router | YEAR 1963.5–1966 · `record_lens` on the hall cornice | `items[key].meta.printedDate`, `lanes`: `cra_1964 {year: 1964.5}`, `vra_1965 {year: 1965.5}`, `shutters` | terrain / down / `stairwell_opens` · "stairwell" | SEAL THE CABINETS / FILES SEALED |
| e9_selma | S7 @ 1100 (2800, 900) | step_bridge / timeline_bridge | board | SlotRail | YEAR JUN 1964–SEP 1965 · **`bay_lamps`** (the world sweep only at aid tier ≥ 1, amendment 26) + `record_lens` along the arch | `items[key].meta.printedDate`, `bays: arch`, `bayLampsTier: 1`, `pageOrderHeading: "AS PRINTED IN CH. 21"` | terrain / none / `bridge_forms` · "bridge deck" | LOCK THE SPAN / SPAN LOCKED |
| e10_sources | S8 @ 1450 (1800, 1400) | router_lanes / provenance_drawers | board | Router | YEAR 1950–2025 (step 1 year) · `record_lens` along the shelving | `items[key].meta.madeYear`, `lanes`: `primary`, `secondary`, `eventsBand: {1954, 1965}` (aid tier ≥ 1), `stamp: made_year`, `shutters` | terrain / up / `stairs_rise` · "rolling ladder" | SEAL THE STACKS / FILES SEALED |
| e11_causation | S8 @ 2900 on `gallery` (3700, 1020) | cause_tubes / big_board | board | Tube | YEAR 1963–1966 · `record_lens` | `connector: tube`, `layout: ring`, `carrier: capsule`, `boardWidth: 1100` | ride / down / `lift_moves` · "vault lift" (−500) | SEND THE CAPSULE / CIRCUIT CLOSED |
| e12_boss | S8 @ 5100 on `vault_level` (5700, 1900) | tumbler_vault / tumbler_vault | vault | Matrix → `{hypothesisId}` (+ marks) | YEAR 1954–1966 on the mini Record Strip | `clues[index].date`, `bolts: 4`, `miniStrip: {start: 1954, end: 1967}` | remove_blocker / none / `vault_opens` · "Editor's Vault" → finale | OPEN THE VAULT / STORY PRINTED |

Boss (e12): `speakerId: editor` (voice only; the vault grille glows), `arenaTriggerX: 4900` (after the vault lift
lands), `arenaCutsceneId: e12_arena` (X09), `taunts.fail: [e12.F]`. `feedbackNouns`: `chest → slide` for e1 and e4.
Sensitivity (R10): every node or plate describing violence (Anniston, Birmingham dogs and hoses, Bloody Sunday) is a
`document` or `photo_withheld` plaque; stools and walk lamps are memorial payoffs with no figures.

### 4.2 Config schemas for every showcase meta (amendment 13)

Every per-claim, per-item, per-wave or per-plank entry is **keyed** (`statementIndex`, `optionIndex`, item key,
`waveIndex`, clue index), never by display order; `validateConfig` requires every key exactly once. Fields marked
**success-only** may be read by `successPlan` only; the no-leak test (§8.1) permutes them and asserts `pose`,
`describe` and `panelLive` are unchanged.

```ts
// src/world/contraptions/config-parts.ts (W0, main) — shared config primitives
import { z } from "zod";
import { Id } from "../../contracts/common";
import { DateString, ProbeSpec } from "../../contracts/world";

export const Tier = z.union([z.literal(0), z.literal(1), z.literal(2)]);   // the aid tier that unlocks a card or overlay
export const Expr = z.string().min(1).max(80);                             // exact mathjs expression; `x` is the only free symbol
export const ItemKey = z.string().regex(/^[a-z]\d{1,2}$/);                 // i0, s2, d0, l1, r3, x0, n4
export const ClaimTrace = z.strictObject({
  fns: z.array(z.strictObject({
    expr: Expr,
    style: z.enum(["solid", "dashed", "ghost"]).default("solid"),
    color: z.enum(["f", "g", "h"]).default("g"),
  })).min(1).max(3),
  brackets: z.array(z.strictObject({ x0: Expr, y0: Expr, x1: Expr, y1: Expr, label: z.string().min(1).max(24) })).max(3).default([]),
  markers: z.array(z.strictObject({ x: Expr, y: Expr, kind: z.enum(["period", "peak", "cross"]) })).max(8).default([]),
});
export const Footprint = z.strictObject({                  // a claim drawn on the FILE card (history)
  kind: z.enum(["pin", "band", "arrow"]),
  from: DateString,
  to: DateString.nullable().default(null),
  label: z.string().min(1).max(32),
});
export const ItemMeta = z.strictObject({
  printedDate: DateString.nullable().default(null),        // must appear in the item's own text
  madeYear: z.number().int().min(1000).max(2100).nullable().default(null),   // must appear in the item's own text
  glyph: Id.nullable().default(null),                      // content glyph (what the step SAYS, never whether it belongs)
  label: z.string().min(1).max(24).nullable().default(null),   // short world-chip name
});
export const HintPin = z.strictObject({ rung: z.union([z.literal(1), z.literal(2), z.literal(3)]), date: DateString, label: z.string().min(1).max(32) });
export const FileDate = z.strictObject({ date: DateString, label: z.string().min(1).max(40) });
```

```ts
// src/world/contraptions/ring-gate.meta.ts
export const RingGateConfig = z.strictObject({
  flow: z.enum(["water", "light", "air", "none"]).default("water"),
  tally: z.boolean().default(true),
  replayOnSettle: z.boolean().default(true),
  ghostCard: z.boolean().default(true),                    // g card = f(t + T) over a faint f
  lapsCardTier: Tier.default(2),
  startMarkerTier: Tier.default(1),
  variant: z.enum(["notch", "counterweight"]).default("notch"),   // counterweight ⇔ ask ∈ {amplitude, midline}
});

// src/world/contraptions/emitter-rail.meta.ts
export const EmitterRailConfig = z.strictObject({
  rail: z.enum(["arc", "straight", "log"]).default("straight"),   // arc ⇒ view labels π and max − min = 2π
  radius: z.number().min(120).max(600).default(310),
  gauges: z.array(z.enum(["sin", "cos"])).max(2).default([]),
  hiddenTarget: z.enum(["fog", "dark", "water", "none"]).default("none"),
  detent: Expr.nullable().default(null),                   // "pi/12": every stud equally sticky
  readout: z.enum(["bracket", "value"]).default("bracket"),
  chevrons: z.boolean().default(true),
  cards: z.strictObject({
    unitCircle: z.boolean().default(false),
    cosTier: Tier.default(1),
    sixthsTier: Tier.default(2),
  }).prefault({}),
});

// src/world/contraptions/pendulum-sync.meta.ts
export const PendulumSyncConfig = z.strictObject({
  spanUnitPx: z.number().min(40).max(200).default(94),     // one "span" on the floor tiles
  armPx: z.number().min(150).max(500).default(300),
  shieldArmPx: z.number().min(200).max(700).default(442),
  swingDeg: z.number().min(4).max(30).default(14),
  spanTiles: z.number().int().min(0).max(9).default(7),
  driftCardTier: Tier.default(1),
  peakDotsTier: Tier.default(2),
  slowTimeToggle: z.boolean().default(true),
});

// src/world/contraptions/claim-holders.meta.ts
export const RefSimId = z.enum(["bilayer_probe", "diffusion_tank", "osmotic_cell", "pump_flume"]);
export const ClaimHoldersConfig = z.strictObject({
  holders: z.array(z.strictObject({
    statementIndex: z.number().int().min(0).max(5),
    trace: ClaimTrace.nullable().default(null),            // math: the claim drawn literally (trig claimTraces)
    ghost: Id.nullable().default(null),                    // science: a ghost id from the referenceSim's registry
    footprint: Footprint.nullable().default(null),         // history: all holders or none
  })).min(2).max(6),
  reference: z.strictObject({
    expr: Expr, xMin: Expr, xMax: Expr, yMin: z.number(), yMax: z.number(), xUnit: z.enum(["pi", "number"]),
  }).nullable().default(null),
  referenceSim: z.strictObject({ id: RefSimId, params: z.record(z.string(), z.number()).default({}) }).nullable().default(null),
  probe: ProbeSpec.nullable().default(null),
  probeWorld: z.enum(["none", "trace_slate", "needle", "dye_load", "bath_salt", "atp_feed", "record_lens"]).default("none"),
  scenarioMin: z.number().nullable().default(null),        // ghosts project only when probe > scenarioMin
  hintPins: z.array(HintPin).max(3).default([]),
  fileDates: z.array(FileDate).max(4).default([]),
  aimer: z.enum(["tuning_lens", "probe_emitter", "arc_lamp", "pendant_lamp"]),
  quarantineAnim: z.enum(["mimic_crab", "ridge_thaw", "tank_dilate", "raft_lock_flood", "lanterns_ignite", "retract_stamp"]),   // success-only
  secondaryTier: Tier.default(1),                          // midline labels, second card
  overlayTier: Tier.default(2),                            // |y| card, period markers
});

// src/world/contraptions/oracle-ticker.meta.ts
export const OracleTickerConfig = z.strictObject({
  options: z.array(z.strictObject({ optionIndex: z.number().int().min(0).max(5), footprint: Footprint.nullable().default(null) })).max(6).default([]),
  probe: ProbeSpec.nullable().default(null),
  probeWorld: z.enum(["none", "record_lens"]).default("none"),
  fileDates: z.array(FileDate).max(4).default([]),
  conduit: z.enum(["telegraph_wire", "pipe", "beam"]).default("telegraph_wire"),
  payoffLamps: z.number().int().min(0).max(12).default(0),  // success-only (the nine walk lamps)
});

// src/world/contraptions/step-bridge.meta.ts
export const StageId = z.enum(["touch", "fold", "pinch", "carry", "dissolve_bounce"]);   // membrane-fold stage library
export const StepBridgeConfig = z.strictObject({
  bays: z.enum(["floating", "flat_road", "arch", "stage_rail"]),
  items: z.array(z.strictObject({ key: ItemKey, meta: ItemMeta.prefault({}) })).max(12).default([]),
  stepEffects: z.array(z.strictObject({
    key: ItemKey,
    effect: z.enum(["scaleEquation", "markAngle", "shadeQuadrants", "markSolutions", "missCircle"]),
  })).max(12).default([]),                                 // success-only card replay (trig e4)
  stages: z.array(z.strictObject({ key: ItemKey, stageId: StageId, icon: Id })).max(12).default([]),   // bays = stage_rail
  anchors: z.number().int().min(0).max(4).default(0),      // far-bank pylons (trig e4: 2, "two solutions")
  relief: z.strictObject({ expr: Expr, line: Expr }).nullable().default(null),   // chasm-lip relief (trig e4)
  probe: ProbeSpec.nullable().default(null),
  probeWorld: z.enum(["none", "relief_marker", "day_counter", "playback", "bay_lamps", "record_lens"]).default("none"),
  dayCounter: z.strictObject({ epoch: DateString, max: z.number().int().min(1).max(9999) }).nullable().default(null),
  bayLampsTier: Tier.default(1),                           // amendment 26: world sweep only at this tier
  pageOrderHeading: z.string().min(1).max(32).nullable().default(null),
});

// src/world/contraptions/router-lanes.meta.ts
export const RouterLanesConfig = z.strictObject({
  items: z.array(z.strictObject({
    key: ItemKey,
    meta: ItemMeta.prefault({}),
    polar: z.boolean().nullable().default(null),           // the hydration lens (aid tier ≥ lensTier)
    charged: z.boolean().nullable().default(null),
    from: z.number().min(0).max(10).nullable().default(null),   // gradient-ramp crowding at the start, as the item text states
    to: z.number().min(0).max(10).nullable().default(null),
    vehicle: z.enum(["carrier", "channel", "pump", "none"]).default("none"),   // success-only
  })).min(1).max(12),
  lanes: z.array(z.strictObject({ binId: Id, laneId: Id, year: z.number().nullable().default(null) })).min(2).max(4),
  lens: z.enum(["hydration", "none"]).default("none"),
  lensTier: Tier.default(1),
  energy: z.strictObject({ reserve: z.number().int().min(1).max(20) }).nullable().default(null),
  shutters: z.boolean().default(false),                    // feature plates: open at aid tier ≥ 1, or for the disclosed bin on a miss
  stamp: z.enum(["made_year", "none"]).default("none"),
  eventsBand: z.strictObject({ from: DateString, to: DateString, label: z.string().min(1).max(32) }).nullable().default(null),
  eventsBandTier: Tier.default(1),
  probe: ProbeSpec.nullable().default(null),
  probeWorld: z.enum(["none", "record_lens"]).default("none"),
});

// src/world/contraptions/sluice-waves.meta.ts
export const SluiceWavesConfig = z.strictObject({
  waves: z.array(z.strictObject({
    waveIndex: z.number().int().min(0).max(9),
    cell: z.enum(["rbc", "generic", "plant", "potato"]),
    inDots: z.number().int().min(0).max(60),
    outDots: z.number().int().min(0).max(80),
    fate: z.enum(["swell", "shrink", "steady", "plasmolysis", "strain"]).nullable().default(null),   // null when showFate is false
    showFate: z.boolean(),                                 // true only when the wave text states the fate
  })).min(1).max(10),
  valves: z.array(z.strictObject({
    categoryId: Id,
    densityK: z.number().min(0).max(5).nullable().default(null),   // hover claim render: ρ_out = ρ_in · k (e5)
    arrows: z.enum(["in", "out", "both", "none"]).default("none"), // hover claim render: ghost water arrows (e9)
  })).min(2).max(4),
});

// src/world/contraptions/switchboard.meta.ts
export const SwitchboardConfig = z.strictObject({
  document: z.strictObject({ title: z.string().min(1).max(80) }).nullable().default(null),
  stepLamps: z.boolean().default(true),
  cord: z.enum(["verlet", "catenary"]).default("verlet"),
  decoyDimRung: z.union([z.literal(3), z.null()]).default(null),   // only when the fixture's hints[2] names the decoy
  probe: ProbeSpec.nullable().default(null),
  probeWorld: z.enum(["none", "record_lens"]).default("none"),
});

// src/world/contraptions/stage-machine.meta.ts
export const StageMachineConfig = z.strictObject({
  lefts: z.array(z.strictObject({
    key: ItemKey,
    stage: z.number().int().min(0).max(12),                // the stage at which this socket acts
    socketKind: z.enum(["ion", "energy", "beacon"]),       // never a direction (that is the cartridge's claim)
    ion: z.enum(["Na", "K"]).nullable().default(null),
  })).min(1).max(6),
  rights: z.array(z.strictObject({
    key: ItemKey,                                          // r0…, x0… (decoys included)
    semantic: z.discriminatedUnion("kind", [
      z.strictObject({ kind: z.literal("count"), n: z.number().int().min(0).max(9), dir: z.enum(["in", "out"]) }),
      z.strictObject({ kind: z.literal("atp"), n: z.number().int().min(0).max(9) }),
      z.strictObject({ kind: z.literal("beacon") }),
    ]),
  })).min(1).max(8),
  stages: ProbeSpec,                                       // the stage scrubber: format "stage", integer stops with names
  ledger: z.enum(["charge", "none"]).default("charge"),
});

// src/world/contraptions/cause-tubes.meta.ts
export const CauseTubesConfig = z.strictObject({
  nodes: z.array(z.strictObject({ key: ItemKey, meta: ItemMeta.prefault({}) })).max(10).default([]),
  connector: z.enum(["catenary", "vertical_wire", "tube"]),
  layout: z.enum(["canopy_row", "mast", "ring"]),          // placement by DISPLAY index, never causal order
  carrier: z.enum(["current", "capsule"]),
  gauge: z.boolean().default(true),                        // completion only
  boardWidth: z.number().min(600).max(1100).default(1100), // amendment 32
  probe: ProbeSpec.nullable().default(null),
  probeWorld: z.enum(["none", "record_lens"]).default("none"),
});

// src/world/contraptions/tumbler-vault.meta.ts
export const TumblerVaultConfig = z.strictObject({
  clues: z.array(z.strictObject({ index: z.number().int().min(0).max(9), date: DateString.nullable().default(null) })).max(10).default([]),
  bolts: z.number().int().min(2).max(8).default(4),
  miniStrip: z.strictObject({ start: z.number(), end: z.number() }).nullable().default(null),
  shadeCountsRung: z.union([z.literal(3), z.null()]).default(3),
  probe: ProbeSpec.nullable().default(null),
});

// src/world/contraptions/console-slate.meta.ts
export const ConsoleSlateConfig = z.strictObject({ slateTitle: z.string().min(1).max(32).nullable().default(null) });

// src/world/sandboxes/*.meta.ts (P1)
export const MusicBoxConfig = z.strictObject({ amplitude: ProbeSpec, rate: ProbeSpec, baseHz: z.number().min(110).max(880).default(220), xMax: Expr.default("4*pi") });
export const PlantGardenConfig = z.strictObject({ salt: ProbeSpec, cIn: z.number().min(0.5).max(5).default(2), wallRigid: z.boolean().default(true) });
export const DarkroomConfig = z.strictObject({ negatives: z.array(Id).min(1).max(8), trays: z.number().int().min(1).max(5).default(3) });
```

**Sims and ghost registry** (`src/world/sims/`, pure, seeded):

| Sim id | Measurable state (readout) | Ghosts (id → tag) |
|---|---|---|
| `bilayer_probe` | tip depth, ion held (0/1), ΔG | `bilayer_outline` matches · `rigid_holed_slab` contradicts · `core_blocks_ion` matches |
| `diffusion_tank` | `cL`, `cR`, flux `J` (2 s window), tracer path (60 points) | `random_walk` matches · `purposeful_march` contradicts · `net_flux_arrow` matches |
| `osmotic_cell` | `V/V₀`, water flux sign | `water_out_arrows` matches · `salt_inflow` contradicts · `shrink_outline` matches |
| `pump_flume` | `cHigh`, `cLow`, stroke phase | `uphill_arrow` matches · `atp_sparks` matches · `downhill_boost` contradicts |
| `membrane_fold` (stage physics, not time-stepped) | `{depth, wrap, neck, detached, travel, bounced}` per stage | — |
| `pendulum_beat` | `φp`, `φs`, sync brightness `B`, beat Hz | — |

### 4.3 Skins and the art contract

Each skin lists its **part slots** (the asset keys a prefab draws; `H` = hand-authored hero, `K` = kit-generated),
the anchors the prefab needs (from `id="anchor-<name>"` markers), and its snapshot parts. Asset keys follow §5.1:
`<ns>.part.<skin>_<slot>`. A missing hero part falls back to its kit stand-in (§0.1.6).

| Skin (ns) | Part slots | Required anchors |
|---|---|---|
| `vesper_dial` (orrery_terraces) | disc H, rail_ring K(`ringStack`), carriage H, beam cap (shared), plumb_gauge K, slide_gauge K, fog_band K(`cloudBand`), vesper_lens H, spoke_ledge K(`stairs`), console K | `center`, `spoke_0…4`, `beam_origin`, `bob`, `marker`, `pin`, `console` |
| `ring_gate` (orrery_terraces) | gate_wall H, outer_ring H, inner_disc H, fin_l H, fin_r H, tally_wheel K, pawl K, canal K, skiff K, console K | `ring_center`, `doorway`, `tally`, `pawl_tip`, `fin_split`, `inner_hub`, `console` |
| `wardens_shield` (orrery_terraces) | warden_body H, warden_arm H, shield H, visor H, star_door_l H, star_door_r H, counter_pylon K(`column`), pendulum_arm K, bob K, span_tile K, console K | `shoulder`, `shield_boss`, `bob`, `pylon_pivot`, `door_center`, `visor`, `console` |
| `resonance_pillars` / `treasury_pillars` (orrery_terraces) | automaton_a/b/c H (shared), bell K, slate K(`panelBox`), plaque K, lens_pedestal H, lens_head H, echo_lift K, lift_chain K, mimic_crab H; treasury: chest_body H, chest_lid H, rim_step K | `holder_0…2`, `slate_0…2`, `lens`, `lift`, `chest_hinge`, `console` |
| `floating_steps` (orrery_terraces) | socket K(`ringStack`), stone K, glyph icons ×5 H(small), cradle K, pylon K(`column` + `crystalCluster`), chasm_edge K(`ashlarWall`), relief K | `socket_0…3`, `cradle_0…4`, `pylon_a`, `pylon_b`, `lip_relief`, `console` |
| `specimen_pods` (living_gate) | pod H, letter_plate K, probe_emitter H; per reference sim: probe_well + needle H, ion K / dye_tank K(`glassTank`) + balance_beam H / basin K + test_cell H + raft_lock K / low_tank K + high_tank K + flume_pump H + lantern K | `pod_0…2`, `emitter`, `apparatus`, `ghost_origin`, `console` |
| `membrane_router` (living_gate) | crossing_gate H, oil_road K, molecule glyphs ×6 H(small), carrier_rocker H, lane_mouth K | `lane_diffuses`, `lane_protein`, `gate_ring`, `rocker_pivot`, `console` |
| `carrier_lanes` (living_gate) | carrier_door H, glide_gate K, pump_gate H(small), ramp_wedge K, cargo glyphs H(small) | `lane_passive`, `lane_active`, `door_pocket`, `atp_port`, `console` |
| `gatekeeper_maws` (living_gate) | gatekeeper_body H, maw_oil H, maw_channel H, maw_pump H, eye_ring H, atp_pipe K, cargo glyphs (shared) | `maw_simple`, `maw_facilitated`, `maw_active`, `eye`, `pipe_top`, `console` |
| `tonicity_sluices` (living_gate) | label_lock K, valve_wheel H, basin K, eddy K, cell_rbc/generic/plant/potato H(small), barge K | `lock`, `basin_0…2`, `eddy`, `valve`, `barge_deck`, `console` |
| `pump_rewiring` (living_gate) | pump_housing H, drum H, jaw_upper H, jaw_lower H, cartridge K, socket K, beacon_tower K, hall_gate K | `socket_0…3`, `cartridge_0…4`, `drum`, `atp_port`, `beacon`, `crank`, `console` |
| `endocytosis_lift` (living_gate) | clathrin_cell K, dynamin_collar H, halcyon H (shared with the intro), stage_lamp K, vesicle K; the membrane path is code-drawn | `pit_center`, `collar`, `lamp_0…3`, `sub`, `console` |
| `witness_projector` (archive_of_voices) | arc_lamp H, pendant_lamp H, witness_lens K, projection_panel K, retract_stamp K, steps K(`stairs`), menu_board K | `lamp_pivot`, `panel_0…2`, `lens_0…2`, `steps`, `console` |
| `walking_road` (archive_of_voices) | slab K, city_bus H, bus_stop K, day_counter H(small), flood_band K | `bay_0…3`, `day_counter`, `route_sign`, `console` |
| `wire_ticker` (archive_of_voices) | kiosk K, teletype H(small), selector H(small), telegraph_pole K, school_barrier K, walk_lamp K | `teletype`, `knob`, `wire_start`, `wire_end`, `lamps`, `console` |
| `relay_line` (archive_of_voices) | junction_box K(`panelBox`), departures_board K, divider_rail K, rolling_gate K | `box_0…5`, `board`, `gate`, `gauge`, `console` |
| `broadcast_relay` (archive_of_voices) | mast K(`latticeTruss`), relay_dish H(small), lift_cage K | `station_0…5`, `lift`, `top`, `console` |
| `switchboard` (archive_of_voices) | switchboard_cabinet H, jack K, plug K, program_sheet K, step_lamp K | `left_0…3`, `right_0…4`, `sheet`, `steps`, `console` |
| `filing_cabinets` / `provenance_drawers` (archive_of_voices) | cabinet K(`cabinet`), meter K, shutter K, slip K, pneumatic_drop K / documents ×6 H(small), compact_shelving K, crank K | `drawer_0…1`, `meter_0…1`, `shutter_0…1`, `table`, `console` |
| `timeline_bridge` (archive_of_voices) | arch_bridge H, deck_section K, bay_lamp K, lectern K, streetcar H | `bay_0…3`, `arch_rail`, `crown`, `console` |
| `big_board` (archive_of_voices) | board_wall K, canister H(small), launcher K; tubes are code-drawn | `canister_0…6`, `launcher`, `console` |
| `tumbler_vault` (archive_of_voices) | vault_door H, tumbler H, bolt K, handwheel K, voice_grille K, press_organ H | `tumbler_0…3`, `bolt_0…3`, `grille`, `hub`, `console` |
| `lectern_slate` (shared) | lectern K, slate K, gate K | `slate`, `gate`, `console` |

Snapshot parts (DOM fallback) default to the skin's `H` parts at rest transforms (dormant) and the same parts with
the solved offsets from `meta.solvedPose` baked into `skin.snapshot.solved` by a unit test that fails when they
drift.

### 4.4 Writer schemas, validators and defaults (amendments 13 and 39)

**Writer schemas** (`meta.writerConfigSchema(ctx)`, strict-mode legal per `instructions.md` §4: root object, every
field required, `.nullable()` never `.optional()`, no `z.record`, `z.union` not `discriminatedUnion`, single-value
enums, no string length/regex rules, bounded integers). Shared helpers live in
`src/world/contraptions/writer-kit.ts`:

```ts
import { z } from "zod";
import { asTuple } from "../../contracts/slices";               // existing helper (directorSchema uses it)
export const wExpr = () => z.string().describe("An exact mathjs expression in x, e.g. 3*sin(x). Never a decimal approximation");
export const wDate = () => z.string().describe("YYYY, YYYY-MM or YYYY-MM-DD, copied from the item's own text");
export const wProbe = () => z.object({
  symbol: z.string().describe("1-4 characters shown on the orange tab"),
  label: z.string().describe("2-3 words naming what the probe measures"),
  min: z.number(), max: z.number(), step: z.number(),
  unit: z.string().describe("unit label or empty string"),
  format: z.enum(["number", "pi", "integer", "percent", "year", "month_year"]),
}).nullable().describe("An UNGRADED orange scrubber that moves something in the world; null for none");
export const wEnumOrNull = (values: readonly string[], name: string) =>
  values.length ? z.enum(asTuple(values, name)).nullable() : z.null();
```

```ts
// claim_holders
writerConfigSchema: (ctx) => z.object({
  holders: z.array(z.object({
    statementIndex: z.number().int().min(0).max(5),
    trace: z.object({
      fns: z.array(z.object({ expr: wExpr(), style: z.enum(["solid", "dashed"]) })).min(1).max(2),
      brackets: z.array(z.object({ x0: wExpr(), y0: wExpr(), x1: wExpr(), y1: wExpr(), label: z.string() })).min(0).max(2),
    }).nullable().describe("Math claims only: draw literally what the claim says. Never style the false claim differently"),
    ghost: wEnumOrNull(ghostIdsForDomain(ctx.domain), "ghosts"),
    footprint: z.object({ kind: z.enum(["pin", "band", "arrow"]), from: wDate(), to: wDate().nullable(), label: z.string() })
      .nullable().describe("History claims: where the claim puts itself on the timeline. Give every holder one, or none"),
  })).min(ctx.itemKeys.length).max(ctx.itemKeys.length),
  referenceSim: wEnumOrNull(simIdsForDomain(ctx.domain), "sims"),
  probe: wProbe(),
}),

// step_bridge
writerConfigSchema: (ctx) => z.object({
  items: z.array(z.object({
    key: z.enum(asTuple(ctx.itemKeys, "plank keys")),
    printedDate: wDate().nullable(),
    glyph: z.enum(asTuple(GLYPH_LIBRARY, "glyphs")).nullable().describe("What the step SAYS, never whether it belongs"),
  })).min(ctx.itemKeys.length).max(ctx.itemKeys.length),
  stepEffects: z.array(z.object({ key: z.enum(asTuple(ctx.itemKeys, "plank keys")), effect: z.enum(["scaleEquation", "markAngle", "shadeQuadrants", "markSolutions", "missCircle"]) })).min(0).max(8),
  probe: wProbe(),
}),

// router_lanes
writerConfigSchema: (ctx) => z.object({
  items: z.array(z.object({
    key: z.enum(asTuple(ctx.itemKeys, "item keys")),
    printedDate: wDate().nullable(),
    madeYear: z.number().int().min(1000).max(2100).nullable(),
    polar: z.boolean().nullable(), charged: z.boolean().nullable(),
    from: z.number().int().min(0).max(10).nullable(), to: z.number().int().min(0).max(10).nullable(),
  })).min(ctx.itemKeys.length).max(ctx.itemKeys.length),
  probe: wProbe(),
}),

// cause_tubes
writerConfigSchema: (ctx) => z.object({
  nodes: z.array(z.object({ key: z.enum(asTuple(ctx.itemKeys, "node keys")), printedDate: wDate().nullable() }))
    .min(ctx.itemKeys.length).max(ctx.itemKeys.length),
  probe: wProbe(),
}),
```

The remaining archetypes' writer schemas follow the same pattern: `sluice_waves` → `waves[] {waveIndex, cell, inDots,
outDots, fate (nullable), showFate}`; `stage_machine` → `lefts[] {key, stage, socketKind, ion (nullable)}` +
`rights[] {key, kind: enum(count, atp, beacon), n (nullable), dir (nullable)}` (a flat object, since writer schemas
cannot use discriminated unions); `switchboard` → `{documentTitle (nullable), probe}`; `oracle_ticker` → `{fileDates[],
probe}`; `tumbler_vault` → `{clues[] {index, date (nullable)}}`; `emitter_rail`, `ring_gate`, `pendulum_sync`,
`console_slate` → `null` (their configs derive entirely from the view and the biome). `fromWriterConfig` maps each to
the stored config and fills skin-specific fields (aimer, quarantine animation, connector, layout) from the biome kit.

**Validators** (`meta.validateConfig`, all in the meta file; shared helpers in `src/world/config-validators.ts` and
`src/world/date-parse.ts`):

| Archetype | Errors | Warnings |
|---|---|---|
| `claim_holders` | holders cover every `statementIndex` exactly once; each trace expression evaluates (via `evalExactAt`) at ≥ 90 % of 64 samples over the reference domain; brackets lie inside the card range; ghost ids exist in the reference sim's registry; **ghost honesty**: the mimic statement's ghost is tagged `contradicts` and every other ghost `matches` (the validator reads `solution.mimicIndex`); footprints are all-or-none; every footprint year appears in the encounter texts (±1 year for "within the year"); `probe.min < probe.max` | holders share one trace style set (a lone style can read as a tell) |
| `oracle_ticker` | options, if given, cover every `optionIndex`; `fileDates` appear in the prompt or scenario | — |
| `step_bridge` | item keys ⊆ view keys; `printedDate` appears in the item text (year digits, plus the month name for month precision, plus the day for day precision); `stepEffects` keys exist; with `bays: stage_rail`, every key has a stage, `membraneFold(solution.order)` ends `detached && travel = 1`, no other permutation does, and every decoy's stage is `dissolve_bounce`; `dayCounter` requires a year probe with a window | `relief` expressions evaluate |
| `router_lanes` | items cover every item key; lanes cover every bin id exactly once; `printedDate`/`madeYear` appear in the item text; `eventsBand` dates appear in the encounter texts | `from`/`to` agree with the text's direction words ("high → low", "down its gradient" ⇒ `from > to`; "against", "pumped", "uphill" ⇒ `from < to`) |
| `sluice_waves` | waves cover every `waveIndex`; `showFate: false` ⇒ `fate: null`; valves cover every category id | `showFate: true` ⇒ a fate word appears in the wave text |
| `switchboard` | `decoyDimRung` set only when the fixture's `hints[2]` mentions the decoy's text | — |
| `stage_machine` | lefts cover every left key; rights cover every right and decoy key; `count.n` appears as a digit in the right's text and `dir` as "out"/"in"/"into"; `atp.n` appears; `stages.format` is `stage` with integer stops covering min…max | — |
| `cause_tubes` | node keys ⊆ view keys; `printedDate` appears in the node text; `boardWidth ≤ 1100` | — |
| `tumbler_vault` | clue indices exist; clue dates appear in the clue text | — |
| `emitter_rail` | `rail: arc` ⇒ the view is π-labelled and spans 2π; `gauges` only on arc rails | — |
| `ring_gate` | `variant: counterweight` ⇔ `view.ask ∈ {amplitude, midline}` | — |
| `pendulum_sync` | `view.ask ∈ {period, frequency}` | — |

**Defaults** (`meta.defaultConfig(ctx)`, used by `autoWorld`; amendment 39):

| Archetype | Default config |
|---|---|
| `claim_holders` | every statement a holder with no trace, ghost or footprint (**text-only claims**); when `encounter.sourceRef` exists, slot 1 is an **evidence card** (`document` with `sourceRef.quote`); history domains get a year probe whose window spans the years found in the texts ± 1; aimer and quarantine animation from the biome kit |
| `step_bridge` | `bays` from the biome kit; each item's `printedDate` = the first date `parseDates(text)` finds; a year probe when ≥ 2 items are dated |
| `router_lanes` | `lanes[binId].laneId = binId`; `printedDate`/`madeYear` parsed from item texts; `shutters` in sensitive biomes |
| `cause_tubes` | connector and layout from the biome kit; node dates parsed; a year probe when ≥ 2 nodes are dated |
| `sluice_waves` | every wave `{cell: generic, inDots: 10, outDots: 10, fate: null, showFate: false}`; valves without renders |
| `oracle_ticker`, `switchboard`, `tumbler_vault` | dates parsed from texts; year probe when dated |
| `emitter_rail`, `ring_gate`, `pendulum_sync`, `console_slate` | derived from the view (arc rail for π-labelled 2π lines; counterweight for amplitude/midline asks) |

`autoWorld` picks archetypes by mode: oscillator → `ring_gate` (`pendulum_sync` for the boss role), number_line →
`emitter_rail`, mimic → `claim_holders`, predict_reveal → `oracle_ticker`, linear → `step_bridge`, bins →
`router_lanes`, type_match → `sluice_waves`, pairs → `switchboard`, chain → `cause_tubes`, elimination →
`tumbler_vault`, anything else → `console_slate`. `stage_machine` is never auto-picked (it needs authored semantics).

---

## 5 · Art

### 5.1 Naming table and directory convention (amendment 22)

| Concern | Rule |
|---|---|
| Namespaces | `shared`, `orrery_terraces`, `living_gate`, `archive_of_voices` (the biome ids; they match the `Id`/`AssetKey` regex) |
| Keys | `ns.group.name[.variant]`, lower snake case. Groups: `layer`, `ground`, `prop`, `part`, `costume`, `char`, `companion`, `npc`, `fx`, `ui`, `vista`, `doc`, `silhouette`, `kit` |
| Part keys | `<ns>.part.<skin>_<slot>` (§4.3), e.g. `orrery_terraces.part.ring_gate_outer_ring` |
| Source | `art/<ns>/{biome.json, layers/, props/, parts/<skin>/, costume/, companion/, npc/, vista/}`; `art/shared/{biome.json, ui/, fx/, characters/}`; `art/kit/*.ts`; `art/fonts/` |
| Output | `public/assets/expedition/<ns>/<group>/<name>.svg` (or `.png` + `.json` for atlases) and `public/assets/expedition/<ns>/manifest.json` |
| Asset index | `src/world/asset-index/<ns>.generated.ts` per namespace (so art owners never touch each other's files) + a static `src/world/asset-index/index.ts` that merges them |
| Pivot | fractions of width and height (`data-pivot="0.5,1"` default; rotating parts `0.5,0.5`) |
| Raster | texture size = design size × `rasterScale` × `min(devicePixelRatio, 1.5)`; layers `rasterScale ≤ 1`, parts and characters 1.5 |
| Retired | `public/assets/variant/`, `cell/`, `archive-city` (the hyphen fails the regex), the `cr.*`, `cell.*` and `A###` ids. Each `biome.json` entry may carry a `legacyId` (e.g. `"A76"`, `"cr.lamp.arc"`) so the game docs' lists stay traceable |

```
art/                                  SOURCE (palette tokens only)                        owner: the art agent of each namespace
  README.md                           authoring rules (§5.3), kit catalogue (§5.4)
  fonts/engrave.ttf + OFL.txt         the one OFL font used for build-time engraving (§5.3)
  kit/*.ts                            procedural SVG generators (§5.4)                    owner: A1 (W1), frozen after
  shared/
    biome.json                        manifest source: key, file | kit, size, rasterScale, tileWidth, pivot, legacyId, kitFallback
    ui/ fx/                           orbs, pins, interact glyph, glow sprites, beam caps, grain, vignette
    characters/
      bodies.json                     body → Kenney source (female_adventurer, female_person, male_adventurer, male_person)
      characters.json                 character id → {body, recolor fill map, poses}
      anchors.toon.json               per-pose rig anchors, authored once for the toon layout (§5.5)
  orrery_terraces/  living_gate/  archive_of_voices/
    biome.json
    layers/  props/  parts/<skin>/  costume/  companion/  npc/  vista/
src/game/art/palette.ts               UI_TOKENS + re-exports; the ONLY place colours are defined, with…
src/game/art/palettes/<ns>.ts         …one token file per biome (owned by that biome's art agent)
scripts/build-art.ts                  `pnpm art:build [--ns <ns>] [--check]`
scripts/build-characters.ts           `pnpm chars:build`: recolour + render the character atlases (§5.5)
scripts/art-contact-sheet.ts          renders every SVG / atlas frame to PNG for the critic
public/assets/expedition/<ns>/        GENERATED
src/world/asset-index/<ns>.generated.ts  GENERATED: { key: { ns, kind, width, height, anchors, source } } for validators (no fs)
```

### 5.2 Build pipeline (`scripts/build-art.ts`, about 420 lines, pipeline-agnostic node script)

For each namespace (or only `--ns <ns>`):
1. Read `biome.json` and validate it with a zod `BiomeArtSource` schema (entries are `{file}` or `{kit: {gen, args,
   seed}}`, plus `rasterScale`, `tileWidth`, `pivot`, `legacyId`, `kitFallback`).
2. **Run kit generators** for `kit` entries (§5.4): each returns an SVG string with tokens, deterministic from
   `(gen, args, seed)`.
3. Substitute `{{token.path}}` from `palettes/<ns>.ts`. An unknown token, or a raw `#hex` outside `<!-- raw-ok -->`,
   fails the build.
4. **Engrave** (amendment 21): every `<text data-engrave …>` element is converted to a `<path>` with `opentype.js`
   2.0.0 and `art/fonts/engrave.ttf` (size, anchor, letter-spacing and fill token from its attributes). A glyph
   missing from the font fails the build. Any other `<text>` fails the lint.
5. Lint (§5.3).
6. Extract `data-pivot` and `id="anchor-*"` elements into the manifest, then strip them.
7. Minify: collapse whitespace and round numbers to 1 decimal.
8. Write `public/assets/expedition/<ns>/<group>/<name>.svg`.
9. Emit `manifest.json` (parsed with `AssetManifest`, with `source` per entry, `heroCount`, `totalBytes`,
   `vramEstimateMb`) and `src/world/asset-index/<ns>.generated.ts`.
10. Print sizes, the VRAM estimate and the hero count. The build fails over budget (§5.8).

`--check` rebuilds in memory and diffs against the committed output, like `fixtures:build`. `theme.css` tokens are
pinned by `tests/ui-tokens.test.ts` instead of being generated (no cross-owner writes).

### 5.3 Deterministic SVG authoring rules (hero parts)

- **Size.** The root `<svg>` has `viewBox="0 0 W H"` and `width="W" height="H"` equal to the design size in world
  units. The world view is 1080 tall and the protagonist H is about 170 (bible §5.1 ladder: console 120, pillar
  520–600, wheel door 340–400, hub 900–1000).
- **Ground and pivot.** The ground contact line is y = H for grounded props, and `data-pivot` defaults to `0.5,1`.
  Rotating parts are separate files, each with its pivot at the hub (`data-pivot="0.5,0.5"`).
- **Structure.** Groups are named for the depth/part they represent: `<g id="lit">`, `<g id="shade">`,
  `<g id="trim">`, `<g id="glow">` (glow is exported as its own asset when it must be ADD-blended).
- **Anchors.** Zero-size markers `<circle id="anchor-console" cx cy r="0"/>`, required for every anchor §4.3 lists
  for that part.
- **Colour.** Palette tokens only (`fill="{{stone.lit}}"`). At most 3 gradient stops per shape. Filters are limited
  to `feGaussianBlur` (soft shadows and glows).
- **Text.** Static engraving only, as `<text data-engrave font-size="26" text-anchor="middle" fill="{{orrery.engrave}}">π/2</text>`
  (converted to paths at build). Every dynamic label (plaque text, chips, date chips, split-flap characters, tape,
  headlines) goes through `WorldLabelLayer` (amendment 21). Game-doc mentions of "Phaser text" are superseded.
- **Banned.** Plain `<text>`, `<image>`, external `href`, `<style>` and `class`, `<script>`, event attributes.
- **Budgets.** At most 60 KB per file (layers at most 120 KB). A full biome is at most 1.2 MB of SVG source.
- **Look.** A low sun from the upper left: lit faces use `*.lit` and shadow faces `*.shade`. Shadows are separate
  multiply shapes in `{{shadow}}` at 30 %. The darkest world colour is `#2B3A44` or lighter.
- **Layers.** Parallax layers are wide horizontally tileable strips (left and right edges match), cut into
  `tileWidth` pieces at build time. Layers are kit output unless a zone's P0 art is "full" and the layer is a hero.
- **Review.** Every new SVG is rendered by `scripts/art-contact-sheet.ts` (Playwright to PNG) so the critic can look
  at parts in isolation.

### 5.4 The procedural SVG kit (`art/kit/*.ts`, amendment 14)

Generators are pure functions `(args, rng) → KitSvg` with a seeded `mulberry32` (the same helper as
`src/mechanics/util.ts`), emitting token-coloured SVG that the build then treats like a hand-authored file.

```ts
// art/kit/types.ts
export interface KitSvg { svg: string; width: number; height: number; anchors: Readonly<Record<string, readonly [number, number]>>; pivot: readonly [number, number] }
export interface KitFinish { ao: boolean; rim: boolean; haze: number /* 0..0.6 toward the sky token */; grain: boolean }
export type KitGen<A> = (args: A & { tokens: string /* token prefix, e.g. "stone" */; finish?: Partial<KitFinish> }, rng: () => number) => KitSvg;
```

| Generator | Args (beyond `tokens`, `finish`) | Used for |
|---|---|---|
| `skyline(w, h, blocks, towers, windows)` | building count, heights, window density | civil L1/L2, cell organelle skyline |
| `mesaBand(w, h, buttes, fluting)` | butte count, flute spacing | trig L1 |
| `cloudBand(w, h, lobes)` | lobe count, underside tint | skies, trig fog band |
| `canopyBlob(r, lobes)` / `crystalCluster(n, h)` | lobe/shard counts | foliage, crystal fields |
| `column(h, flutes, capital)` / `arch(w, h, voussoirs)` / `ringStack(r, rings, gaps)` | proportions | pillars, arcades, sockets, rail rings |
| `ashlarWall(w, h, course)` / `brickWall(w, h, bond)` | course height, bond | cliffs, retaining walls, storefronts |
| `stairs(steps, rise, run)` / `railing(w, posts)` / `window(w, h, mullions)` / `awning(w, stripes)` | counts | stairs, balustrades, façades |
| `bilayerTile(w, heads)` / `lipidRow(n)` | head count | cell ground and colonnade |
| `glassTank(w, h, divider)` / `panelBox(w, h, lamp)` / `cabinet(w, h, drawers)` / `latticeTruss(w, h, bays)` / `pipe(len, bends)` / `consoleLectern(style)` | proportions | generic contraption parts |
| `grain(size)` / `vignette()` | — | finish stack |

Every generator applies the finish defaults: a baked **ambient-occlusion** gradient at the base (`ao`), a 2 px
**rim-light** stroke on upper-left edges in the `*.hi` token (`rim`), and **haze** toward the sky token for far
layers. Hand-authored SVG is capped at **about 60 hero parts per biome** (`manifest.heroCount`); everything else is
`source: "kit"`. Each game doc's asset list is re-tagged `kit:<generator>` or `hero` by its content owner.

### 5.5 Characters: one recoloured Kenney rig (amendment 19)

The Kenney `toon-characters` pack ships, per body, `Vector/character_<body>.svg` (864 × 640: a 9 × 5 grid of 96 × 128
cells, the same layout as `Tilesheet/character_<body>_sheet.xml`) and the HD atlas XML (`_sheetHD.xml`, 192 × 256
cells). Verified in `.data/asset-scratch/toon-characters.zip`. `scripts/build-characters.ts` (about 220 lines):

1. For each character in `art/shared/characters/characters.json`, read its body's vector sheet.
2. Print the body's fill palette (every distinct `fill`/`stop-color`); the character's `recolor` map must cover
   every fill the build lists (skin light/shade, hair, top, trousers, boots…), or the build fails. Skin tones such as
   Wren `#A8714F` / `#8A5A3E` and Ida's deep brown are exact, which `setTint` cannot produce.
3. Render the recoloured SVG in Playwright's Chromium at `deviceScaleFactor: 2` → a 1728 × 1280 PNG whose cells match
   the HD XML exactly.
4. Convert the HD XML to a Phaser JSON-hash atlas and write `public/assets/expedition/shared/char/<id>.{png,json}` plus
   the manifest `atlas` entry (`shared.char.<id>`) with the per-pose anchors from `anchors.toon.json`, and the
   pack's `License.txt`.

| Character | Game | Body | Costume overlays (biome `costume` group, on anchors) | Priority |
|---|---|---|---|---|
| `wren` | trig | female_adventurer | teal scarf (back, spring), satchel (back), sighting staff (hand_r), gold bun pin (head) | P0 |
| `diver` | cell | female_adventurer | bubble helmet (head), tide scarf (back, spring), probe-staff (hand_r; bulb glows orange while dragging) | P0 |
| `nell` | civil | female_adventurer | salmon scarf (back, spring), satchel strap (torso) | P0 |
| `ida` | civil (S1, outro) | female_person | bun + cat-eye glasses chain (head), long cardigan (torso) | P0 |
| `otis` | civil (S1, S8) | male_person | watch cap (head), flashlight (hand_r, ADD cone) | P0 |
| `hattie`, `dolores` | civil | female_person | eyeshade / headset (head) | P1 |
| `theo` | civil | male_person | school cap (head), textbook (hand_l) | P1 |

- **One rig, shared protagonist:** every human uses the same 45-pose toon layout and one anchor table
  (`anchors.toon.json`: `head`, `face`, `torso`, `back`, `hand_l`, `hand_r`, `feet` for the 25 poses the host uses:
  `idle`, `walk0–7`, `run0–2`, `jump`, `fall`, `climb0/1`, `interact`, `switch0/1`, `talk`, `think`, `cheer0/1`,
  `show`, `hold`). The contact sheet overlays anchors on every body for review. The three protagonists are the same
  rig re-costumed per biome, so "shared protagonist" (bible §6.3) holds.
- Machines and creatures (Cog, Pip, Wick, the Warden, the Gatekeeper, Brasswick, Lumen, Quill, the mimic crab, Sucra,
  Poro, Kay, the Ferryman) are SVG puppets in their biome's `companion`/`npc`/`part` groups (hero parts).
- **Post-demo:** Wren's 18-part SVG puppet (trig §7.13).

### 5.6 The painterly finish stack (F2)

Applied to every zone and **locked on the vertical slice** before art scales:
1. baked AO gradients at object bases and rim-light strokes (kit defaults, §5.4);
2. haze baked into L1 (40 %) and L2 (20 %) toward the segment's sky;
3. Phaser Blur: L1 1 px, L2 0.5 px, L5 2 px (`filters.internal.addBlur`);
4. a tiled grain texture over the play area at 6–8 % multiply (`shared.fx.grain`);
5. the camera ColorMatrix grade per segment (`ambient.grade`: saturation, brightness, hue);
6. additive glow sprites for live parts only (glow = information, bible §5.3);
7. a soft vignette (20 % in dusk and night segments).

### 5.7 Loader and palette

- **Loader.** `manifest-loader.ts` computes `k = rasterScale × min(devicePixelRatio, 1.5)`, calls
  `load.svg(key, url, {width: round(w × k), height: round(h × k)})`, then `sprite.setScale(1 / k)`. Layers use
  `rasterScale ≤ 1` (they are hazed or blurred). Contraption parts use 1.5. Atlases load with `load.atlas` at 2×
  and display at 0.5 × the world scale factor. Only the shared entries the overlay references (its characters,
  companions and UI parts) are loaded.
- **Tiles.** A `tileWidth` entry becomes N sub-textures `key#i`, laid side by side as Images (or one TileSprite when
  `repeatX`).
- **Palette.** `palette.ts` exports `BIOME_PALETTES: Record<BiomeId, BiomePalette>` (assembled from
  `palettes/<ns>.ts`: world tokens from bible §2.1–2.2 and each game doc's palette section) and `UI_TOKENS` (bible
  §2.3, shared). The Phaser side reads numeric colours for tints, glows and beams.
- **Dormancy.** Dormant machines use a runtime ColorMatrix at −40 % saturation (−60 % and 40 % alpha with scanlines
  in `archive_of_voices`), not a second texture.

### 5.8 Size budget per game

| Item | Budget |
|---|---|
| Hand-authored hero SVG | ≤ 60 per biome namespace (`heroCount`, build fails above) |
| Biome SVG source (layers + props + parts + companions + NPC puppets) | ≤ 1.2 MB (gzip about 0.3 MB) |
| Shared (UI, fx, emblems) | ≤ 0.3 MB |
| Character atlases | about 240 KB PNG each; a game loads ≤ 5 (≈ 1.2 MB) |
| JS: expedition chunk (host + metas + panel + controls + synth), dynamically imported | ≤ 200 KB gzip on top of the existing Phaser chunk |
| VRAM at load | ≤ 180 MB per biome (atlases 8.8 MB each at 1728 × 1280) |

---

## 6 · Generalization: the World Writer (S7.5) and `autoWorld`

### 6.1 Where it runs

```
S6 Director (Blueprint) → S7 fan-out: challenge writers ×N | narrative | assessment
                        → S7.5 World Writer (FAST, one call, needs the rendered prompts + narrative) → S8 assemble (+ assembleWorld)
                        → S9 verifier (validateGameSpec now also runs validateWorld) → store
```

The World Writer runs after S7 because good instruction lines name the world object *and* match the challenge
prompt, and because per-archetype writer configs need each encounter's view (item keys, statement counts). It is a
single FAST call of about 6 s. A failure never fails the job: after one repair round, `autoWorld` supplies the text
and `meta.defaultConfig` supplies the configs.

### 6.2 Strict-mode schema (`src/contracts/slices.ts`, architect)

```ts
export interface WorldSlice {
  biome: string;
  guideCharacterId: string;
  /** fixed slots extra_1..extra_3: the writer names them; unused slots are dropped by code (amendment 1) */
  extras: { slot: "extra_1" | "extra_2" | "extra_3"; name: string; role: string; voiceArchetype: VoiceArchetype }[];
  story: { title: string; logline: string; objective: string; objectiveLabel: string; restoredNoun: string };
  zones: { name: string; firstEncounterId: string; arrival: { speakerId: string; text: string } | null }[];
  intro: { speakerId: string; text: string }[];
  finale: { speakerId: string; text: string }[];
  stations: {
    encounterId: string; contraption: string; skin: string;
    objectNoun: string; partNouns: string[];
    instruction: string; tutorial: string | null; insight: string | null;
    hints: [string, string, string];
    fail: { default: string; byKey: { key: string; text: string }[] };
    success: string; payoffLine: string | null;
    probes: { predicate: string; value: string | null; itemKey: string | null; slot: number | null; index: number | null;
              toKey: string | null; binId: string | null; key: string }[];
    verifyLabel: string; successBadge: string; payoffAnim: string;
    approach: { speakerId: string; text: string }[]; after: { speakerId: string; text: string }[];
    config: unknown;                              // the chosen contraption's writerConfigSchema output (or null)
  }[];
  npcs: { name: string; speakerSlot: string | null; lines: { speakerId: string; text: string }[] }[];
  collectibles: { title: string; text: string; conceptId: string }[];
}

export interface WorldMenuStation {
  encounterId: string;
  /** contraptions whose meta.modes include this encounter's mode, native first (from src/world/library.ts) */
  contraptions: readonly {
    id: string; skins: readonly string[]; payoffs: readonly string[];
    failKeys: readonly string[];                  // meta.nearMissKeys ∪ failKeysFor(mode)
    writerConfig: z.ZodType<unknown> | null;      // meta.writerConfigSchema(ctx) for this encounter
  }[];
}

export function worldWriterSchema(args: {
  biomeIds: readonly string[];            // top 3 kits for the knowledge map's domain (biomes.ts ranking)
  characterIds: readonly string[];
  conceptIds: readonly string[];
  stations: readonly WorldMenuStation[];
  minZones: number; maxZones: number;     // 5–7 encounters: 2; 8–12: 3; 13+: 4
}): z.ZodType<WorldSlice> {
  const speakers = [...args.characterIds, "extra_1", "extra_2", "extra_3", "player", "narrator"];
  const speaker = z.enum(asTuple(speakers, "speakers"));
  const line = z.object({ speakerId: speaker, text: z.string().describe("Spoken line, 20 words max. Never state an answer") });
  const encounterIds = args.stations.map((s) => s.encounterId);
  // One variant per (encounter, legal contraption), each with ITS skins, payoffs, fail keys and writer config:
  // an incompatible contraption, skin or config for a mode is unrepresentable (same trick as directorSchema).
  const variants = args.stations.flatMap((s) => s.contraptions.map((c) =>
    z.object({
      encounterId: z.enum([s.encounterId]),
      contraption: z.enum([c.id]),
      skin: z.enum(asTuple(c.skins, `${c.id} skins`)),
      objectNoun: z.string().describe("2-4 words naming the in-world machine, e.g. 'Tidewheel Gate'"),
      partNouns: z.array(z.string().describe("1-2 words: a part the player manipulates, e.g. 'latch timer'")).min(0).max(3),
      instruction: z.string().describe("Imperative, under 120 characters, names the machine or a part; never the answer. {{placeholders}} allowed"),
      tutorial: z.string().nullable().describe("First-open second line: how to read the instruments; never the answer"),
      insight: z.string().nullable().describe("One declarative truth about the concept, phrased as a truth of the world; never the answer"),
      hints: z.array(z.string().describe("The guide's voice for the fixture hint of the same rung; rung 3 may be as specific as the fixture's hint 3")).min(3).max(3),
      fail: z.object({
        default: z.string().describe("What the guide says after a wrong Verify; never the answer"),
        byKey: z.array(z.object({ key: z.enum(asTuple([...c.failKeys, ...PROBE_KEY_SLOTS], "fail keys")), text: z.string() })).min(0).max(4),
      }),
      success: z.string().describe("Shown after success: the concept stated outright as a truth of the world"),
      payoffLine: z.string().nullable().describe("A short line while the path forms"),
      probes: z.array(z.object({
        predicate: z.enum(["nearValue", "keyInSlot", "decoyPresent", "aimedIndex", "linkedTo", "assignedTo"]),
        value: z.string().nullable(), itemKey: z.string().nullable(), slot: z.number().int().min(0).max(11).nullable(),
        index: z.number().int().min(0).max(11).nullable(), toKey: z.string().nullable(), binId: z.string().nullable(),
        key: z.enum(asTuple(PROBE_KEY_SLOTS, "probe keys")),
      })).min(0).max(3).describe("Misconception probes: the input a student holding the target misconception would submit"),
      verifyLabel: z.string().describe("2-3 words, caps, names the machine: 'LOCK THE RINGS'"),
      successBadge: z.string().describe("2-3 words, caps: 'RINGS LOCKED'"),
      payoffAnim: z.enum(asTuple(c.payoffs, `${c.id} payoffs`)),
      approach: z.array(line).min(0).max(2),
      after: z.array(line).min(0).max(2),
      config: c.writerConfig ?? z.null(),
    })));
  const station = variants.length === 1 ? variants[0] : z.union(variants as unknown as [z.ZodTypeAny, z.ZodTypeAny]);
  return z.object({
    biome: z.enum(asTuple(args.biomeIds, "biomes")),
    guideCharacterId: z.enum(asTuple(args.characterIds, "characters")),
    extras: z.array(z.object({
      slot: z.enum(["extra_1", "extra_2", "extra_3"]),
      name: z.string().describe("A fictional name; never a person named in the source"),
      role: z.string(), voiceArchetype: VoiceArchetype,
    })).min(0).max(3),
    story: z.object({
      title: z.string().describe("World name, under 32 characters"),
      logline: z.string().describe("1 sentence: the broken world and why restoring it matters"),
      objective: z.string().describe("HUD objective, under 60 characters, starts with a verb"),
      objectiveLabel: z.string().describe("1-2 words, caps, for the progress ring: 'GATES'"),
      restoredNoun: z.string().describe("What one solved machine restores: 'beam', 'gate', 'record'"),
    }),
    zones: z.array(z.object({
      name: z.string(),
      firstEncounterId: z.enum(asTuple(encounterIds, "encounters")),
      arrival: line.nullable(),
    })).min(args.minZones).max(args.maxZones),
    intro: z.array(line).min(1).max(3),
    finale: z.array(line).min(1).max(3),
    stations: z.array(station).min(args.stations.length).max(args.stations.length),
    npcs: z.array(z.object({ name: z.string(), speakerSlot: z.enum(["extra_1", "extra_2", "extra_3"]).nullable(), lines: z.array(line).min(1).max(3) })).min(0).max(3),
    collectibles: z.array(z.object({
      title: z.string(), text: z.string().describe("A surprising true fact from the source, under 200 characters"),
      conceptId: z.enum(asTuple(args.conceptIds, "concepts")),
    })).min(0).max(3),
  }) as unknown as z.ZodType<WorldSlice>;
}
// PROBE_KEY_SLOTS = ["probe_a", "probe_b", "probe_c"]: probe keys are slots; their lines live in fail.byKey.
```

The schema follows `instructions.md` §4: a root object, every field required (`nullable` is used, `optional` never),
no records, `z.union` rather than a discriminated union, single-value enums, no string length rules, bounded
integers. `tests/strict-schemas.test.ts` gains a `worldWriterSchema` case built from each of the three fixtures.

**The model writes nouns, lines, choices and per-archetype content data. Code writes everything else:**
- geometry: zone widths and heights, ground, platforms, consoles, anchors, blockers and payoff terrain (from the
  biome kit's zone presets and each meta's default offsets);
- traversal links from the kit's traversal templates (at least one hop and one climb or drop per zone, so W2 holds);
- parallax layer sets and segments; props (seeded scatter from the kit's prop sets, excluding station footprints and
  frame bounds);
- cutscenes (templates: intro, zone entry, rides, carries, arena, finale with the kit's vista);
- plaques: for sourced games, code turns each encounter's verified `sourceRef.quote` into a plaque (`document` kind
  in sensitive kits);
- skin-specific config fields (aimer, quarantine animation, connector, layout) from the biome kit.

### 6.3 Checks, assembly, validation

- `checkWorldSlice(slice, ctx)` (in `src/pipeline/validate/checks.ts`) enforces:
  - every encounter appears exactly once;
  - `firstEncounterId`s are strictly increasing in encounter order, and the first is `encounters[0]`;
  - the skin belongs to the chosen contraption and to the chosen biome;
  - lines are ≤ 140 characters and ≤ 24 words; `instruction` contains `objectNoun` or a `partNouns` entry;
  - **answer leaks** with the R8 token matcher (`src/world/answer-leak.ts`) on instruction, tutorial, insight,
    hints[0], hints[1], fail lines and approach; allowed in hints[2], success, payoffLine and after;
  - probes carry the fields their predicate needs, and keys reference real item keys;
  - `meta.fromWriterConfig` + `meta.validateConfig` pass (ghost honesty, dates present, expressions evaluate);
  - extras' names are not people named in the spec (R10's extractor), for every domain;
  - problems become repair notes (one routed repair, `owner: "world_writer"`).
- `assembleWorld(slice, spec, kit, seed) → WorldOverlay` lives in `src/world/assemble-world.ts` (pure, deterministic
  from `spec.seed`). It renders `{{placeholders}}` with `mode.templateVars`, maps `extra_n` slots to ids
  (`snake(name)`), and applies the code-owned fields above.
- `validateWorld(spec, world)` runs in S9 via `validateGameSpec`.
- If issues remain after the repair round, each failing station's text is replaced with `autoWorld` text and its
  config with `meta.defaultConfig`. The world is never dropped and the job never fails.
- `autoWorld(spec)` (`src/world/auto-world.ts`) is `assembleWorld(templateSlice(spec), …)` with no model call. It
  derives:
  - the biome from the domain ranking;
  - the archetype by the mode table in §4.4, else `console_slate`;
  - **configs from `meta.defaultConfig(ctx)`** (amendment 39): text-only claims, evidence cards from
    `sourceRef.quote`, item dates parsed from item text, history year windows;
  - `objectNoun` from the skin's default noun; the instruction from `encounter.prompt` trimmed to one sentence;
    `hints` = the fixture hints; `fail.default` = `encounter.wrongFeedback` (already leak-checked by `checkChallenge`);
  - success from the card's `learningInsight`; intro and finale from `spec.narrative.intro/outro`.

  This is the quality floor that makes **every** generated game an Expedition, and it is gated by
  `EXPEDITION_AUTO=on` until it has passed the fidelity loop once.

### 6.4 Biome kits (`src/world/biomes.ts`)

```ts
export interface BiomeKit {
  id: string; name: string; domains: readonly Domain[]; sensitive: boolean;
  paletteId: string;                          // key into BIOME_PALETTES
  zonePresets: readonly {
    light: AmbientLight; layerSet: LayerSet; sky: Sky; ambient: Ambient; ground: GroundTemplate;
    propSets: readonly string[]; heroLandmark: string | null;
  }[];
  traversalTemplates: readonly { kind: TraversalLink["kind"]; dx: number; dy: number; apex?: number }[];
  companionDefault: string; emblemDefault: Emblem;
  vehicles: { lift: string; tram: string | null; vesicle: string | null };
  vista: string | null;                       // composed finale vista (group "vista")
  skinDefaults: { aimer: string; quarantineAnim: string; connector: string; layout: string; bays: string };
  sims: readonly string[];                    // reference sims whose ghosts suit this biome's domains
  fictionalStaff: readonly string[];          // bodies/looks allowed for human NPCs when sensitive
  protectedNames: readonly string[];          // extra names the R10 lint treats as real people
  violenceLexicon: readonly string[];         // words that force document / photo_withheld plates (R10)
}
export const BIOME_KITS: Record<string, BiomeKit>;   // orrery_terraces (math, physics, engineering, earth_space, cs),
                                                     // living_gate (biology, chemistry, health),
                                                     // archive_of_voices (history, civics, law, literature, writing, economics…; sensitive)
export function rankBiomes(domain: Domain): string[];  // exact domain match first, then the 'general' ordering
```

New kits (forest observatory, harbour, desert) are art (mostly kit presets plus about 60 heroes) and one entry here.
Nothing else changes.

### 6.5 Mock mode and the fixture migration (W8)

1. Record `fixtures/world-writer/{trig,cell,civil}.json`, the WorldSlice mock responses served by
   `MockLanguageModelV4` keyed by the agent's system-prompt prefix. They are **extracted from the showcase
   side-cars** by `scripts/extract-world-slice.ts`, so the mock pipeline produces the side-car's words with
   code-derived geometry.
2. Add `world?: WorldSlice` to `Slices`. `assembleGameSpec` emits `world` only when it is present.
3. `pnpm fixtures:build` regenerates the five pinned fixtures. `mock-models` and `pipeline-mock` now both produce
   `world` from the same recorded slice. Update all four equality tests in the **same** change.
4. Side-cars by `spec.id` still win for the showcase (hand-polished geometry, traversal and cutscenes), so the demo
   does not change.

### 6.6 What the Director menu needs to know

The Director does **not** pick contraptions (the World Writer and code do). Two cheap signals move it toward
playable worlds:
1. **Menu lines.** `DirectorMenuFamily` gains a prompt-only `worldHint` per card, generated from the library:
   "tuner.oscillator → Ring Gate (live dial, door payoff)" or "fallback console" when no native contraption exists.
   The schema is unchanged.
2. **Retrieval bias.** The matcher's shortlist gives `tier: "native"` modes a +0.5 score bonus (mechanics-dev,
   `retrieval.ts`). The Director rules add one sentence: "prefer at least one encounter per 3 whose card has a native
   contraption with a vertical payoff (stairs, lift); write each designNote naming the in-world machine."

---

## 7 · Work breakdown (rewritten for the 2026-09-27 demo)

### 7.0 Rules

- At most **3 concurrent subagents** (instructions §6.2). Dev roles run on sonnet with `model` passed explicitly; the
  architect and reviewer on opus. Depth 1. The main session keeps contracts, registries, integration, V content,
  cross-cutting debugging and checkpoints.
- **Non-overlapping ownership.** Every item lists the paths it **owns** for the duration of its wave; every other path
  is read-only for that agent. A needed change outside is reported to main with the exact diff (instructions §2).
  Ownership returns to main at the end of each wave; the next wave's items re-assign it explicitly.
- **Stubs first.** W0 creates every file that two agents might otherwise both create (meta stubs, prefab stubs,
  registries, the per-namespace asset-index files), so no two agents ever add the same path.
- **Main-only files:** `src/contracts/**`, `src/world/types.ts`, `src/world/library.ts`,
  `src/world/draft-inputs.ts`, `src/world/contraptions/config-parts.ts`, `src/world/asset-index/index.ts`,
  `src/game/hosts/types.ts`, `src/game/hosts/expedition/contraptions/{types,registry}.ts`, `package.json`,
  `eslint.config.*`, `instructions.md`, `DECISIONS.md`, `PROGRESS.md`, `MORNING_REPORT.md`.
- Every item ends green on `pnpm typecheck`, `pnpm test` and `pnpm lint` for its paths (plus the e2e specs it owns).
  Main runs `.overnight/checkpoint.sh` at each wave end when the three are green (instructions §6.6). No git writes.
- Timebox: 2× an item's estimate → stub behind the interface with `TODO(overnight)`, log in `BLOCKERS.md`, and apply
  the fallback ladder (§0.1.6).

### 7.1 Schedule

| Wave | Window (T0 + h) | Agents in flight | Ends with |
|---|---|---|---|
| **W0** | 0 → 1.5 | main | contracts, stubs, registries, skeleton side-cars |
| **W1** | 1.5 → 6.5 | H1 host core · P1 panel · A1 art pipeline + trig zone 1 | host boots the dev world; controls grade; `art:build --check` clean |
| **W2** | 6.5 → 10.5 | B1 world library · B2 client · K1 continuous archetypes (+ main: trig zone-1 content) | trig e1–e2 playable end to end |
| **Gate V** | 10.5 | main + reviewer | **vertical slice: trig S1–S2**, hard stop midday 2026-09-27 (§0.1.6) |
| **W3** | 10.5 → 16 | K2 claims and sequences · K3 routers, waves and links · A2 art (cell/civil zone 1, kit zones, landmarks) | all 12 native archetypes built |
| **W4** | 16 → 21 | C1 trig · C2 cell · C3 civil (content + remaining biome art) | three side-cars validate with zero errors |
| **W5** | 21 → 24 | E1 e2e/capture/perf · R reviewer (critic) · F fix slot | **P0 freeze** |
| W6 (P1) | after P0 freeze | S1 sandboxes · Q1 side content (all three side-cars) · A3 remaining hero art | P1 rows of §0.1.3 |
| W7 (P2) | if time remains | U1 map + journal readers · Q2 secrets and collectibles · polish | P2 |
| W8 | post-demo | World Writer + `autoWorld` (pipeline-dev + architect) | §6 |

Critical path: W0 → H1 → B2 → V → K2/K3 → C1–C3 → E1. Art runs beside code: prefabs draw with placeholder
rectangles and kit stand-ins until the biome parts land, parts are referenced by asset key, and missing keys fall
back to a debug texture **only in dev** (the validator forbids missing keys in side-cars).

### 7.2 Items

#### W0 · M0 "Contracts, seams and stubs" (main, about 1,700 lines, 1.5 h)

- **Owns:** `src/contracts/world.ts` (all of §1.3), `src/contracts/gamespec.ts` (`world` optional),
  `src/contracts/common.ts` (`Owner`), `src/contracts/index.ts`; `src/world/types.ts` (§2.5.1–2.5.2, `Diagnosis`,
  `FailKey`), `src/world/draft-inputs.ts` (`DraftInputs`, `toSubmitInput`), `src/world/aid-tier.ts` (+ test),
  `src/world/ease.ts`, `src/world/geom.ts`, `src/world/contraptions/config-parts.ts`, **stubs** for the 13
  `src/world/contraptions/<id>.meta.ts` and 3 `src/world/sandboxes/<id>.meta.ts` (each exporting a placeholder meta
  that `console_slate` semantics satisfy), `src/world/library.ts` (`CONTRAPTION_LIBRARY`, `SANDBOX_LIBRARY`,
  `contraptionFor`), `src/world/asset-index/index.ts` + 4 empty `<ns>.generated.ts`, `src/game/hosts/types.ts`
  (§2.10), `src/game/hosts/expedition/contraptions/{types,registry}.ts` + 16 stub `prefabs/<id>/prefab.ts` (a
  labelled box), `src/game/expedition/dialogue/types.ts`, `src/mechanics/util.ts` (`evalExactAt(expr, scope)` only,
  sandboxed like `evalExact`) + a case in `tests/eval-exact.test.ts`, skeleton `fixtures/worlds/*.world.json`,
  `tests/world-contract.test.ts`, `eslint.config.*` (`no-restricted-imports` for `src/world/**`), `package.json`
  (scripts `art:build`, `art:check`, `chars:build`; devDependency `opentype.js` pinned at 2.0.0 after `npm view`),
  `instructions.md` §2 ownership rows (`src/world/`, `art/`, `fixtures/worlds/`, the new scripts), `DECISIONS.md`
  (the 20 decisions and the fallback ladder).
- **Acceptance:** typecheck, test and lint green; the six pinned tests untouched; `WorldFile.parse` accepts the
  skeletons; `tests/world-contract.test.ts` proves strict objects reject unknown keys and `.prefault` fills nested
  defaults; every meta and prefab stub is registered; importing `src/world/library.ts` in a node test pulls no Phaser
  or React.

#### W1 · H1 "Host core" (engine-dev, about 5,500 lines, 5 h)

- **Owns:** `src/game/hosts/expedition/**` except `contraptions/{types,registry}.ts` and `contraptions/prefabs/**`;
  `src/game/hosts/PlayHost.tsx` (the Expedition branch only); a typed dev world in
  `src/game/hosts/expedition/__fixtures__/dev-world.ts` (two zones, every link kind, one station per control kind
  using stub prefabs).
- **Deliverables:** every module of §2.2 except prefabs; §2.3 depth bands; §2.4 movement, links, interaction, NPC
  actors, triggers; the cutscene runner with every step kind; the reduced DOM host with `Snapshot.tsx`.
- **Acceptance:** boots in Chromium on the `webgl` project and the `dom` project with the dev world; ≥ 5 parallax
  layers scroll at different rates; segments crossfade; interior façades fade; walk, run, cosmetic hop, and each link
  kind by key and by `useLink` (timed hop both outcomes); blockers follow progress and payoff terrain merges; camera
  x/y deadzones, `frameFor` per layout including `frameZoom`, vertical transitions; the D4 keyboard test (ArrowRight in
  a panel slider changes its value with Phaser mounted); `endState(cutscene)` equals the full-play end state for
  every step kind; `__GAME_DEBUG__.expedition.host()` complete; no `console.error` on a forced boot failure; the pure
  modules (`surfaces`, `terrain`, `traversal`, `segments`, `proximity`, `framing`, `triggers`, `keymap`, `timeline`,
  `label-store`) at ≥ 90 % line coverage.

#### W1 · P1 "Panel, cards, controls, widget drafts" (ui-dev, about 5,200 lines, 5 h)

- **Owns:** `src/game/expedition/panel/**` (components, `controls/*.tsx`, `controls/*.logic.ts` + tests,
  `BriefSheet.tsx`, `theme.css`), `src/world/graph-math.ts` (+ test), `src/game/widgets/*.tsx` (`onDraft` emission
  only) and `src/game/widgets/*.test.ts` (converter parity with `draft-inputs.ts`), `src/app/dev/panel/page.tsx`
  (dev-only gallery of every card and control on the three fixtures' views).
- **Acceptance:** `graph-math` tests (π ticks "π/2", "2π"; sampling splits at jumps and NaN; chip clamping;
  `formatProbe` for every `ProbeFormat`; `fracYear` round-trip); for every showcase encounter of the three fixtures,
  the control logic's solution state → `toSubmitInput` → `mode.grade` is correct; `WaveControl` enables Verify only
  after the last wave and preselects answers on retry; `MatrixControl` never puts marks in the submitted input;
  `AimControl` emits hover and focus drafts; the Scrubber is a keyboard `role=slider` with `settled`; card models
  render without runtime errors in the dev gallery; `coverage.test.ts` green; testids `widget-submit`,
  `widget-first-option`, `success-badge`, `panel-back`, `instrument-panel` kept.

#### W1 · A1 "Art pipeline, kit, characters, shared set, trig zone 1" (engine-dev art, about 3,400 lines + about 30 hero SVG, 5 h)

- **Owns:** `art/README.md`, `art/kit/**`, `art/fonts/**`, `art/shared/**`, `art/orrery_terraces/**`,
  `scripts/{build-art,build-characters,art-contact-sheet}.ts`, `src/game/art/palette.ts`,
  `src/game/art/palettes/*.ts` (all four initial token files, from bible §2 and each game doc's palette section),
  `public/assets/expedition/{shared,orrery_terraces}/**`, `src/world/asset-index/{shared,orrery_terraces}.generated.ts`,
  `tests/world-assets.test.ts`, `tests/ui-tokens.test.ts`, `tests/art-kit.test.ts`.
- **Deliverables:** §5.2 pipeline (tokens, kit, engraving, lint, anchors, manifests, per-namespace index, VRAM, hero
  count, `--ns`, `--check`); every §5.4 generator; §5.5 character build with atlases for `wren`, `diver`, `nell`, `ida`,
  `otis` and anchors for the 25 used poses; the shared set (5 orbs, pin, interact diamond, 3 glow radii, beam cap,
  grain, vignette); trig zone 1 **full art** (layer set `sunward_day`: L1 mesa band + Orrery tower hero, L2 crystal
  fields and trees, L3 retaining walls and colonnade, L5 balustrade and grass, L6 dapple; ground and underside);
  `vesper_dial` and `ring_gate` parts (§4.3); beam pylon; gondola; Cog (3 poses); Wren's costume overlays; the §5.6
  finish presets; one **default kit zone preset** per biome (a generic 5-depth layer set + ground) so any zone can
  render before its own presets land.
- **Acceptance:** `pnpm art:build --check` clean; the lint rejects plain `<text>`, raw hex and external refs; an
  engraving test (`π/2` becomes paths; a missing glyph fails); generators are byte-deterministic per seed; `pnpm
  chars:build` yields 5 atlases of 45 frames with anchors for 25 poses; VRAM < 180 MB and `heroCount ≤ 60` per
  namespace; contact sheets render.

#### W2 · B1 "World library, validation, diagnosis, world state" (mechanics-dev, about 3,600 lines, 4 h)

- **Owns:** `src/world/{validate-world,resolve-world,answer-leak,probes,fail-line,feedback-nouns,config-validators,date-parse,speakers,biomes}.ts`
  (+ tests), `src/world/diagnose/**` (+ the parity test), `src/world/state/**` (+ tests), `src/server/worlds.ts`,
  `src/pipeline/validate/validate-gamespec.ts` (the `world` branch and the `ownerFor` case only),
  `tests/world-validate.test.ts`, `tests/world-resolve.test.ts`, `tests/world-sidecars.test.ts`.
- **Acceptance:** R1–R16 and W1–W3 each have one negative test; R8's tokenizer passes trig `e2.approach` and
  `e2.before` and fails "Set the timer to π." and e6 "4 seconds"; diagnose parity for all 10 modes (≥ 50 seeded wrong
  inputs each); probes' `nearValue` tolerance equals each mode's; `failLines` precedence (probe > near-miss > fail key
  > default; boss taunt first); feedback nouns are whole-word and case-preserving; world-state reducer, requirements,
  NPC state selection and `settleQuests` tests; `loadWorldFor` keying: `trig_demo_001`, `trig_platformer_001`,
  `cell_demo_001`, `history_mystery_001`, `history_demo_001` and a mock-generated trig spec resolve their side-car;
  `wave2_smoke_001` is skipped with a warning and plays legacy.

#### W2 · B2 "Client, machine, dialogue, HUD, audio, express" (engine-dev, about 3,400 lines, 4 h)

- **Owns:** `src/game/expedition/{client,dialogue,hud,audio,map,journal}/**` (+ tests), `src/game/GameClient.tsx`,
  `src/game/debug.ts` (the optional `expedition` field), `src/app/play/[id]/page.tsx` and `PlayClient.tsx` (`world`,
  `worldSource`, `sfx` props), `src/server/env.ts` (`EXPEDITION_SFX` only; pipeline-dev is notified).
- **Acceptance:** machine tests for every transition, including cutscene, sandbox and carry payoffs, and the D1/D2/D3
  regressions; dialogue engine tests (typewriter grapheme count at 45 cps, advance, preemption, toasts, `skipAll`,
  pins); station-slot flow tests (tutorial on first open only, insight after, hint rungs, fail lines + display
  feedback, success replaces instruction); `CUE_MAP` covers every cue id in the three game docs; express policy
  tests; the dev world plays intro → explore → panel → wrong (draft kept) → right → payoff → finale → EndScreen; the
  legacy path under `?host=legacy` is byte-for-byte the old behaviour; all existing e2e green.

#### W2 · K1 "Continuous and fallback archetypes" (engine-dev, about 3,800 lines, 4 h)

- **Owns:** `src/world/contraptions/{emitter-rail,ring-gate,pendulum-sync,console-slate,tumbler-vault}.meta.ts`
  (+ tests), `src/world/sims/pendulum-beat.ts` (+ test),
  `src/game/hosts/expedition/contraptions/prefabs/{emitter_rail,ring_gate,pendulum_sync,console_slate,tumbler_vault}/**`.
- **Acceptance:** the §7.4 tests for these modules; each prefab shows ≥ 3 intermediate poses while scrubbing (the ★30
  capture); success 1.2–2.5 s, failure ≤ 1.6 s; skin snapshots render in the DOM host; `console_slate` hosts every
  implemented mode (a test iterates `contraptionFor` over the registry).

#### W2 · main "Vertical-slice content" (main, about 500 JSON lines)

`fixtures/worlds/trig.world.json` (main-owned in W2): `z1_sunward` at full detail (S0–S2, e1–e2, the intro cutscene
with `await_interact` on Cog, Brasswick state 0, P0 traversal links, pins, probes, dialogue slots from trig §4.4),
plus kit-art `z2`/`z3` with e3–e6 on `console_slate` so the file validates. Handed to C1 in W4.

#### Gate V (main + reviewer, 0.5 h)

The critic scores three shots (trig e1 mid-scrub, e2 panel open, a z1 establishing shot) against bible §9 A–E, the
finish stack and game-feel items 37–41. Result: proceed, or a fix list dispatched as F-slot items (≤ 1 h) before W3.

#### W3 · K2 "Claims and sequences" (engine-dev, about 4,600 lines, 5.5 h)

- **Owns:** `src/world/contraptions/{claim-holders,oracle-ticker,step-bridge}.meta.ts` (+ tests),
  `src/world/sims/{bilayer-probe,diffusion-tank,osmotic-cell,pump-flume,membrane-fold,index}.ts` (+ tests),
  `prefabs/{claim_holders,oracle_ticker,step_bridge}/**`.
- **Acceptance:** the §7.4 tests for these modules, including ghost honesty, the no-leak test, the e9 bay-lamp gate
  and the stage physics table; every skin (`resonance_pillars`, `treasury_pillars`, `specimen_pods` with the four
  reference apparatus, `witness_projector` with both aimers, `wire_ticker`, `floating_steps`, `walking_road`,
  `timeline_bridge`, `endocytosis_lift`) renders its live link, success and failure on the dev world.

#### W3 · K3 "Routers, waves and links" (engine-dev, about 4,800 lines, 5.5 h)

- **Owns:** `src/world/contraptions/{router-lanes,sluice-waves,switchboard,stage-machine,cause-tubes}.meta.ts`
  (+ tests), `prefabs/{router_lanes,sluice_waves,switchboard,stage_machine,cause_tubes,_cables}/**`.
- **Acceptance:** the §7.4 tests for these modules, including boss phase batching, the neutral "loaded" label, counts
  without capacities and first-miss-only failure plans; every skin (`membrane_router`, `carrier_lanes`,
  `gatekeeper_maws`, `filing_cabinets`, `provenance_drawers`, `tonicity_sluices`, `switchboard`, `pump_rewiring`,
  `relay_line`, `broadcast_relay`, `big_board`) renders on the dev world.

#### W3 · A2 "Cell and civil zone 1, kit zones, landmarks" (engine-dev art, about 45 hero SVG + about 40 kit entries, 5.5 h)

- **Owns:** `art/{orrery_terraces,living_gate,archive_of_voices}/**`,
  `public/assets/expedition/{orrery_terraces,living_gate,archive_of_voices}/**`,
  `src/world/asset-index/{orrery_terraces,living_gate,archive_of_voices}.generated.ts`,
  `src/game/art/palettes/{orrery_terraces,living_gate,archive_of_voices}.ts`.
- **Deliverables:** cell `zone_a` full art; civil `s1_morgue` Record Engine hero and `s2_courthouse` full art; kit
  layer sets for every other zone of the three games; the non-part hero landmarks of §0.1.2 (trig Crystal Stair
  waterfall cliff and dome interior; cell trench + Poro, Pump Hall shell, Nuclear Pore; civil school, five-and-dime,
  terminal, church rose window, memorial colonnade); parts for `specimen_pods` (e1 apparatus), `membrane_router`,
  `witness_projector`, `walking_road`; Pip and Wick; costumes for the Diver, Nell, Ida and Otis; vistas
  `orrery_terraces.vista.canyon` and `archive_of_voices.vista.dawn` composed from kit layers.
- **Acceptance:** `art:build --check` clean for the three namespaces; `heroCount ≤ 60` each; contact sheets reviewed
  by the critic; every P0 kit zone shows ≥ 5 depth layers.

#### W4 · C1 / C2 / C3 "Content + remaining biome art" (one agent per game: mechanics-dev content with art duties, about 1,400 JSON lines + 15–25 hero SVG each, 5 h)

| Item | Owns | Deliverables |
|---|---|---|
| **C1 trig** | `fixtures/worlds/trig.world.json`, `art/orrery_terraces/**`, its public output, index file and palette file | all 6 stations per §4.1 (e3–e6 replace the slates), dialogue slots from trig §4.4, probes, pins, boss staging, cutscenes (intro, `e6_arena`, finale with the canyon vista), exits, extras, P0 traversal; parts for `resonance_pillars`/`treasury_pillars`, `floating_steps`, `wardens_shield` (the Warden hero); Brasswick |
| **C2 cell** | `fixtures/worlds/cell-transport.world.json`, `art/living_gate/**`, its public output, index and palette | all 11 stations, the Gradient meter, boss phases 2 + 2 + 3, cutscenes (intro, e6 carry, e10 vesicle carry, `e11_arena`, finale), extras, P0 traversal; parts for the remaining `specimen_pods` apparatus, `carrier_lanes`, `gatekeeper_maws` (the Gatekeeper hero), `tonicity_sluices`, `pump_rewiring` (the pump hero), `endocytosis_lift` (the Halcyon); Sucra |
| **C3 civil** | `fixtures/worlds/civil-rights.world.json`, `art/archive_of_voices/**`, its public output, index and palette | all 12 stations, `recordStrip` pins, `record_lens` accessories, the 8 zones with interiors, cutscenes (intro with `control_until` + `await_interact`, arenas, the streetcar ride, finale with the dawn vista), extras, P0 traversal; parts for `wire_ticker`, `relay_line`, `broadcast_relay`, `switchboard`, `filing_cabinets`, `provenance_drawers`, `timeline_bridge` (the bridge hero), `big_board`, `tumbler_vault` (the vault door and press-organ); **reviewer (opus) sensitivity sign-off** |

- **Acceptance (each):** `validateWorld` returns zero errors (warnings listed in `PROGRESS.md`); an express run
  completes every station and the finale on `webgl` and `dom`; R8/R9 clean; `heroCount ≤ 60`; dialogue lines are the
  game doc's, re-pointed to slots, each ≤ 140 characters.

#### W5 · E1 "e2e, capture, performance" (engine-dev, about 1,200 lines, 3 h) + R reviewer + one F slot

- **Owns:** `e2e/expedition-{trig,cell,civil,express,keyboard}.spec.ts`, `e2e/play-mystery.spec.ts` (its second test
  moves to `?host=legacy`), `playwright.config.ts` (projects `webgl` and `dom`; `webServer.env.EXPEDITION_SFX=off`),
  `scripts/capture-scenes.ts`, `docs/design/fidelity/shots.json`.
- **Acceptance:** §8.2 green on both projects for the three games; one keyboard-only test per control kind on
  `webgl`; the capture produces the shot list per game with fps and draw-object counts.
- **R (reviewer, read-only):** fidelity critic rounds (§8.3) and the sensitivity pass. **F slot:** main groups the
  critic's findings by `ownerPath` and dispatches one fix agent owning exactly those paths; P0 freeze at the end.

#### W6 (P1) and W7 (P2)

| Item | Owns | Deliverables |
|---|---|---|
| **S1 sandboxes** (engine-dev) | `src/world/sandboxes/**` (+ tests), `prefabs/{music_box,plant_garden,darkroom}/**` | the three sandbox metas and prefabs; goals; the Music Box tone via the synth bus |
| **Q1 side content** (mechanics-dev) | the three `fixtures/worlds/*.world.json` | one quest per game (§0.1.3), all NPC states, all triggers, the three sandboxes placed, progress effects, traversal beat sheets for every zone (W2 clean) |
| **A3 remaining hero art** (engine-dev art) | `art/{orrery_terraces,living_gate,archive_of_voices}/**` and outputs | the P1 full-art zones; Lumen, Quill, Poro, Kay, the Ferryman, Hattie, Dolores and Theo looks and puppets |
| **U1 map and journal** (ui-dev, P2) | `src/game/expedition/{map,journal}/**` | `MapOverlay` styles and `JournalReader` tabs |
| **Q2 secrets and collectibles** (mechanics-dev, P2) | the three side-cars | wisps, shards, negatives, pages, telescopes, the darkroom unlock |

### 7.3 Ownership matrix (who may write what, per wave)

| Path | W0 | W1 | W2 | W3 | W4 | W5 | W6 |
|---|---|---|---|---|---|---|---|
| `src/contracts/**`, registries, `types.ts` files, `package.json` | main | main | main | main | main | main | main |
| `src/game/hosts/expedition/**` (not prefabs) | main (stubs) | **H1** | main | main | main | F slot | main |
| `src/game/hosts/expedition/contraptions/prefabs/<id>/**` | main (stubs) | — | **K1** (5 ids) | **K2** (3), **K3** (5 + `_cables`) | — | F slot | **S1** (sandboxes) |
| `src/world/contraptions/<id>.meta.ts` | main (stubs) | — | **K1** | **K2**, **K3** | — | F slot | — |
| `src/world/sims/**` | — | — | **K1** (`pendulum-beat`) | **K2** (the rest + `index`) | — | F slot | — |
| `src/world/{validate,resolve,…}`, `diagnose/**`, `state/**`, `src/server/worlds.ts` | — | — | **B1** | main | main | F slot | — |
| `src/world/graph-math.ts`, `src/game/expedition/panel/**`, `src/game/widgets/*.tsx` | — | **P1** | main | main | main | F slot | — |
| `src/game/expedition/{client,dialogue,hud,audio}/**`, `GameClient.tsx`, `debug.ts`, play page | — | — | **B2** | main | main | F slot | — |
| `art/kit/**`, `art/shared/**`, `scripts/build-*.ts`, `src/game/art/palette.ts` | — | **A1** | main | main | main | main | main |
| `art/orrery_terraces/**` (+ outputs) | — | **A1** | — | **A2** | **C1** | F slot | **A3** |
| `art/living_gate/**`, `art/archive_of_voices/**` (+ outputs) | — | — | — | **A2** | **C2**, **C3** | F slot | **A3** |
| `fixtures/worlds/trig.world.json` | main | — | main | — | **C1** | F slot | **Q1** |
| `fixtures/worlds/{cell-transport,civil-rights}.world.json` | main | — | — | — | **C2**, **C3** | F slot | **Q1** |
| `e2e/**`, `playwright.config.ts`, `scripts/capture-scenes.ts` | — | — | — | — | — | **E1** | main |

### 7.4 Pure modules and their unit tests (the explicit list)

| Module | Owner | Tests (what they prove) |
|---|---|---|
| `src/world/contraptions/emitter-rail.meta.ts` | K1 | arc carriage at θ = 0, π/2, π equals `C + r(cos θ, −sin θ)`; straight/log rail mapping; `bracket()` for 20 values; detents snap within 0.05 rad to π/12 studs; the carriage chip never prints a decimal; **parity**: beam-locked pose ⟺ `grade().correct` over 400 samples; chevron count from the diagnosis distance band |
| `src/world/contraptions/ring-gate.meta.ts` | K1 | angles at 0, π/2, π, 2π; `tally(2π) = 2`; **parity**: aligned ⟺ \|T − π\| ≤ 0.1885 ⟺ grade correct (400 samples); ghost coincidence `max\|f(t) − f(t + T)\| < 1e−9` at T = π; release replay progress resets on settle; near-miss `aligned_multiple` at 2π and `short_of_cycle` below π |
| `src/world/contraptions/pendulum-sync.meta.ts` + `src/world/sims/pendulum-beat.ts` | K1 | `syncBrightness(T = 4, τ ≤ 30 s) ≥ 0.99`; `beatHz(T) = \|1/4 − 1/T\|`; the common-start reset on open and settle zeroes both phases; seeded determinism; **parity** (400 samples); the failure plan snaps the thread; `sync_hum` pitch ∝ B |
| `src/world/contraptions/console-slate.meta.ts` | K1 | `contraptionFor` returns a meta covering every implemented mode; snapshot parts exist |
| `src/world/contraptions/tumbler-vault.meta.ts` | K1 | struck ⇒ 90° rotation; the last-unstruck glow comes only from `marks`; `marks` never reach `toSubmitInput`; the failure plan uses `wrongKeys = [id, clue:i]`; count shading only at `hintsUsed = 3` |
| `src/world/contraptions/claim-holders.meta.ts` | K2 | aim angle per holder; display order → holder slot stable for the seed; hover previews without committing; `trace_slate` playhead and bell pitch ∝ \|f(x)\|; `validateConfig`: traces evaluate, brackets in range, **ghost honesty** (swapped tags → error), footprints all-or-none, footprint years present; **no-leak**: `pose`/`describe`/`panelLive` unchanged when `quarantineAnim` is permuted and for solution-swapped params with an identical view; aid-tier gates (midline at 1, \|y\| card at 2); `scenarioMin` gating; the failure plan holds `wrongKeys[0]` bright |
| `src/world/contraptions/oracle-ticker.meta.ts` | K2 | knob angle per display position; tape retypes on change; no reveal text in `panelLive` before Verify; `payoffLamps` success-only |
| `src/world/contraptions/step-bridge.meta.ts` + `src/world/sims/membrane-fold.ts` | K2 | socket and bay positions; the stage table for 6 orders (pinch before fold → empty micro-vesicle; decoy → bounce); only the solution order reaches `travel = 1`; **e9 gate**: world `bayLamps` all off at aid tier 0 for every draft and cursor; FILE-card lamps at printed dates; the day-counter formula; relief crossings where `2 sin x = 1`; the failure plan locks the prefix, tips the slot of `wrongKeys[0]`, crumbles a decoy |
| `src/world/sims/{bilayer-probe,diffusion-tank,osmotic-cell,pump-flume,index}.ts` | K2 | seeded determinism; `cL`/`cR` converge and `J` has the sign of `cL − cR`; `V/V₀ = b + (1 − b)·C_in / max(s, 0.3)` clamped; steady state `ΔC = 0.96 r`; ghost registry tags |
| `src/world/contraptions/router-lanes.meta.ts` | K3 | the queue formula; chips carry counts only (no capacity text); lens at `lensTier`; ATP projection; **boss phases**: later batches hidden until the previous batch is placed, `complete` only when all are placed; maw opens on focus; eye angle; the failure plan acts on `wrongKeys[0]` only and opens only the disclosed bin's shutter; `vehicle` success-only |
| `src/world/contraptions/sluice-waves.meta.ts` | K3 | cell x vs `secondsLeft`; hover render `ρ_out = ρ_in·k`; `showFate: false` keeps V = 1 before Verify; retry preselection; the failure plan returns only the wave in `wrongKeys` |
| `src/world/contraptions/switchboard.meta.ts` | K3 | seated lamps white, never cyan, before Verify; program lines by left key; decoy dim only at `hintsUsed = 3` and only when configured; the failure plan unseats `wrongKeys[0]` |
| `src/world/contraptions/stage-machine.meta.ts` | K3 | drum angle 60°·k; conformation by k; cartridges load by semantic; the **neutral "loaded: …" label** (never "?"); ledger `q`; the failure plan jams at the stage of `wrongKeys[0]`'s socket |
| `src/world/contraptions/cause-tubes.meta.ts` | K3 | catenary and vertical sag formulas; Manhattan routes with ≤ 2 bends; gauge = edges / edgeCount; dishes face their source; placement by display index; `boardWidth ≤ 1100`; decoy pop and focus spark plans |
| `src/world/sandboxes/{music-box,plant-garden,darkroom}.meta.ts` | S1 | goals; tone `220·b` Hz, gain `0.2·A/3`; plasmolysis above 2 %; `all_developed` |
| `src/world/aid-tier.ts`, `src/world/draft-inputs.ts` | M0 (+ P1 parity) | the tier table; `toSubmitInput` equals the widget converters for every mode |
| `src/world/graph-math.ts` | P1 | ticks, π and month-year formatting, sampling splits, chip clamping, `fracYear` |
| `src/world/answer-leak.ts` | B1 | math-run tokenizer; R8 positives and negatives (§1.5) |
| `src/world/diagnose/**` | B1 | the **parity test** for 10 modes; `prefix` and `disclosed` values |
| `src/world/probes.ts`, `fail-line.ts`, `feedback-nouns.ts`, `date-parse.ts`, `config-validators.ts`, `speakers.ts` | B1 | predicate matches and tolerance parity; line precedence; whole-word replacement; `parseDates` / `dateAppears`; expression sampling; the speaker directory with extras and narrator |
| `src/world/validate-world.ts`, `resolve-world.ts`, `state/**` | B1 | R1–R16 and W1–W3 negatives; keying; requirements, NPC state selection, `settleQuests` |
| host pure modules (`surfaces`, `terrain`, `traversal`, `segments`, `proximity`, `framing`, `triggers`, `keymap`, `cutscene/timeline`, `labels/label-store`) | H1 | heightfield merge after payoff; blockers per progress; arc endpoints and durations; timed-hop windows; crossfade weights; hysteresis; framing keeps `frameBounds` in the safe rect for each layout and zoom override; key map; skip end state = full-play end state |
| client pure modules (`machine`, `station-dialogue`, `express`, `dialogue/engine`, `audio/cues`) | B2 | every transition; slot flow; express actions; typewriter and priorities; cue coverage |
| panel control logic (`controls/*.logic.ts`) | P1 | `toDraftInput`, `complete`, `fromDraftInput`, solution round-trip through `grade()` |

### 7.5 Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| The calendar (demo on 2026-09-27) | P0 incomplete | the demo cut (§0.1), the gate at T0 + 10.5 with a hard stop at midday, the fallback ladder, `console_slate` completeness, express rehearsal |
| Headless Chromium has no WebGL | e2e can't see the Phaser path | two Playwright projects: `webgl` (`--use-gl=angle --use-angle=swiftshader`) and `dom` (`?renderer=dom`), both required green; the DOM path is static snapshots + the full panel |
| Boot failure logs `console.error` | fails every zero-error assertion | `console.warn` for handled fallbacks; loader errors prevented by the manifest ↔ file test and the asset-index validator |
| Many SVG textures: decode time and VRAM | slow load, GPU pressure | rasterScale ≤ 1 for layers, tiles ≤ 2048, one biome per game, only referenced shared atlases, the build-time VRAM gate, a loader progress bar |
| `load.svg` rendering differences | wrong look | only feGaussianBlur and simple gradients; engraving is paths; contact sheets through the same Chromium path |
| Kenney toon style vs the painterly world | style clash | recoloured palettes per character, key-light tint in day zones, soft contact shadows, a 2 px outline glow in dusk zones (doc 02 §3b) |
| Agent-authored SVG volume | art late | the procedural kit, the 60-hero cap, kit fallbacks for every hero key |
| Traversal feel without physics | stiff movement | arc easing and squash/stretch tuned on the dev world in W1; cosmetic hops; the critic scores item 37 |
| Sim cost | frame drops | only the open station's sims step; measurable state only; ≤ 1.5 ms budget in tests |
| Phaser keyboard capture (D4) | panel keys dead | `disableGlobalCapture` while frozen or panel-focused, plus one WebGL keyboard e2e per control kind |
| Per-tick React re-renders (D5) | jank while scrubbing | drafts through refs; rAF label layer; memoized views; panel live state local to the panel |
| Brute-forcing discrete contraptions | pedagogy loss | the live-reveal rule, success-only fields, aid-tier gates, the no-leak test |
| Parity drift between `diagnose` and `grade()` | wrong failure animation | the parity test fails first |
| History sensitivity | reputational | R10 (fictional staff only, name lint, violence lexicon → documents or withheld photos, `sensitiveSafe` skins), reviewer sign-off in C3 |
| Two agents writing one file | lost work | stubs in W0, the ownership matrix (§7.3), per-namespace generated files |
| Legacy regressions | broken non-showcase games | `?host=legacy`; the legacy path is untouched when `world` is null; all existing e2e stay in CI |

---

## 8 · Testing

### 8.1 Unit (Vitest, node, `*.test.ts`)

| Suite | What it proves |
|---|---|
| `tests/world-contract.test.ts` | the 3 side-cars parse (`WorldFile`); strict objects reject unknown keys; the defaults and `.prefault`s fill; every `CutsceneStep`, `TraversalLink`, `ProgressEffect`, `QuestStep` and `MisconceptionProbe` variant parses |
| `tests/world-validate.test.ts` | the 3 side-cars have **zero** errors against their fixture specs (from W4); one negative test per rule R1–R16 and W1–W3 (unknown encounter, out-of-order station, contraption without the mode, bad skin, config failure, missing asset key, unknown speaker, extras colliding with a character id, cutscene reference, the R8 cases below, > 140 characters, sensitive NPC named like a person, violent text on a plain plaque, a link bypassing a blocker, an undeclared flag, a non-partitioning boss phase, an unmapped cue) |
| `tests/world-sidecars.test.ts` (amendment 40) | `fixtures/worlds/*.world.json` is the only overlay location (a glob finds no `src/game/worlds`); every `appliesTo` entry resolves: `trig_demo_001`, `trig_platformer_001`, `cell_demo_001`, `history_mystery_001`, `history_demo_001` by id, and a mock-generated trig spec (new id, same `(src_trig_ch4, dungeon)`) by source; `wave2_smoke_001` is skipped with a server warning |
| `tests/world-assets.test.ts` | every manifest entry's file exists and is within budget; every asset key the overlays use is in the index; `heroCount ≤ 60` and VRAM ≤ 180 MB per namespace; the SVG lint on generated output; `art:build --check` has no drift |
| `tests/world-resolve.test.ts` | resolution order (by id; by source only when valid; `spec.world`; auto flag) |
| `tests/ui-tokens.test.ts`, `tests/art-kit.test.ts` | `theme.css` equals `UI_TOKENS`; kit generators are byte-deterministic per seed and emit only tokens |
| `src/world/answer-leak.test.ts` (amendment 34) | trig `e2.approach` ("…y = sin(2t)…") and `e2.before` ("Those rings spin…") pass for banned `π`; "Set the timer to π." fails; `2π/\|b\|` and `π/2` pass; e6 banned `4`: "4 seconds" and "4.00" fail, "40 spans" and "0.4" pass; a mimic statement's full text matches as a token sequence |
| `src/world/diagnose/diagnose.test.ts` (amendment 11) | the **parity test**: ≥ 50 seeded wrong inputs per showcase mode; `correct` agrees with `grade()`; the needle from `failKey`/`wrongKeys` appears in `grade().feedback`; `prefix` values for linear and chain |
| `src/world/contraptions/*.test.ts` (13) + `src/world/sims/*.test.ts` + `src/world/sandboxes/*.test.ts` | the §7.4 list, including the **no-leak test** (amendment 26): for every discrete meta and every showcase station, `describe(pose(d))`, `panelLive(...)` and the pose's world lamp/socket fields are unchanged under permutations of success-only fields and under solution-swapped params with an identical view; e9 bay lamps off at aid tier 0; the e8 label is never "?" |
| `src/world/{probes,fail-line,feedback-nouns,date-parse,config-validators,speakers,aid-tier,draft-inputs}.test.ts`, `src/world/state/*.test.ts` | §7.4 |
| `src/world/graph-math.test.ts` | π tick labels, sampling splits, chip clamping, year and month-year formatting |
| `src/game/hosts/expedition/scene/*.test.ts`, `input/keymap.test.ts`, `cutscene/timeline.test.ts`, `labels/label-store.test.ts` | §7.4 host rows |
| `src/game/expedition/{client,dialogue,audio}/*.test.ts` | §7.4 client rows, including the D1/D2/D3 regressions and cue coverage |
| `src/game/expedition/panel/controls/*.logic.test.ts` | each control's `toDraftInput` + `complete`; the `grade(solution)` round-trip |
| `tests/strict-schemas.test.ts` (W8) | `worldWriterSchema` and every `meta.writerConfigSchema` pass the audit |
| existing `coverage.test.ts` + new `expedition-coverage.test.ts` | every implemented mode resolves to a contraption (native or `console_slate`) and a control |

### 8.2 Playwright (`e2e/expedition-<game>.spec.ts`, projects `webgl` and `dom`)

Shared helpers wait for `__GAME_DEBUG__.expedition.host()?.ready` and collect console and page errors. Every test
ends with `expect(errors).toEqual([])`. The web server runs with `EXPEDITION_SFX=off`.

| Step | Assertion (trig shown; cell and civil follow the same shape with their first continuous or discrete station) |
|---|---|
| 1 load `/play/fixture-trig?debug=1` | `phaser-host` (webgl) or `dom-host` (dom); `h1` = zone title; `title-card` visible |
| 2 intro | the dialogue bar shows Cog's line; the `await_interact` step shows the interact glyph on Cog; `interact()` resumes; `cutscene-skip` ends it; `phase() === "explore"` |
| 3 walk and traverse | hold `D` → `playerX` increases; `useLink("z1_step_hop")` changes `playerY` and `surface`; the player stops at e1's blocker (`playerX < blocker.x`) |
| 4 approach and interact | entering the approach radius toasts the approach line; `near.kind === "station"`; `E` → `instrument-panel` visible; the pinned instruction contains a noun from R9 |
| 5 live binding | focus the scrubber (`role=slider`), ArrowRight ×10 → `contraption().carriageAngle` strictly increases across 3 samples and the readout text changes |
| 6 hint in the world | press `I` → the hint line shows; `host().contraption().aidTier === 1`; the companion's position moves toward the hint anchor |
| 7 wrong verify | Verify → `resolving` → back to `panel`; the bar shows a fail line and the display feedback; the scrubber value is unchanged |
| 8 correct verify | `applySolutionDraft()` → Verify → `success-badge` → `phase` returns to explore; `contraption().state === "solved"` |
| 9 traversal payoff | hold `D`/`W` → `playerX > blocker.x` or `surface` is the terrace (the stair formed) |
| 10 probe (cell e1, trig e3) | `setProbe(v)` changes `contraption().probe` and a world field (`needleTipY`, `slatePlayhead`); the submitted input is unaffected |
| 11 zone change (cell e10, civil film seam) | after solving, the carry/exit runs → `host().zoneId` changes; `cameraY` tweened for vertical transitions |
| 12 boss | trig: crossing the arena trigger plays `e6_arena`; cell: the Gatekeeper's phase batches reveal in order; a wrong Verify shows the boss taunt before the guide line |
| 13 finish | `autoSolve` to the boss; solve it → the **finale cutscene** plays (`phase() === "finale"`, the vista step runs) → `end-screen` visible |
| express (`expedition-express.spec.ts`) | `?express=1` completes each game from load to `end-screen` with `applySolutionDraft` + Verify only (no manual walking) |
| keyboard (`expedition-keyboard.spec.ts`, webgl, F9) | one station per control kind (scrub, aim, slots, bins, waves, cables, tubes, matrix) completed with Tab/arrows/digits/Enter only |
| regression | `play-smoke`, `play-platformer`, `golden-path` (mock-generated trig → side-car by source → expedition), `flows`, and `play-mystery` (arrival test on `?host=legacy`) all green |

### 8.3 Visual fidelity loop (W5)

1. **Shots.** `docs/design/fidelity/shots.json` lists per game about 14 deterministic shots:
   - an establishing shot per P0 zone (explore, companion visible);
   - each layout mode with the panel open *mid-scrub* (draft set through the control API);
   - one probe shot (the world object the probe moves);
   - one failed-verify state and one hint-in-the-world state;
   - one success-badge frame and one payoff traversal frame;
   - a boss staging frame;
   - a dialogue close-up; the finale vista;
   - one 1280×720 legibility shot.
2. **Capture.** `scripts/capture-scenes.ts` (Playwright, 1920×1080, `webgl` project) drives each shot through
   `__GAME_DEBUG__` (`skipTo`, `openPanel`, set draft, `setProbe`, `hint`, `freeze(true)`) and writes
   `docs/design/fidelity/<game>/round-<n>/<shot>.png`. It also records a 3-frame strip while scrubbing (★30), the
   input-to-first-reaction latency (item 41), fps and draw objects.
3. **Critique.** The **critic** (reviewer role, opus, read-only) reads the shots, the reference images
   `3.png`–`10.png`, bible §9 and this doc. It scores items 1–36 **and the game-feel items 37–41** (amendment 29):

   | # | Game-feel item | Pass |
   |---|---|---|
   | 37 | ≥ 2 non-walk verbs per zone besides its payoffs (hop, climb, ladder, drop, timed hop, ride, sandbox, quest touch) | W2 clean for P0 zones (all zones in P1) and a capture of each verb |
   | 38 | the orange input moves a world object in every encounter (mode input or probe) | a strip per station shows a world change while scrubbing or aiming |
   | 39 | the boss has staged presentation (arena, taunts, phases or real-time motion) | the boss frame and a fail taunt capture |
   | 40 | hints act in the world (companion flight, overlay, shutter, lens) | the hint shot shows a world change |
   | 41 | the first world reaction lands within 150 ms of panel input | measured latency ≤ 150 ms at the median |

   It writes `docs/design/fidelity/<game>/round-<n>/score.json`:

   ```json
   { "game": "trig", "round": 1, "total": 29, "starFails": [21], "feel": { "total": 4, "fails": [37] },
     "items": [ { "n": 21, "score": 0, "shot": "e2_scrub", "why": "scrub line stops at card 2", "fix": "extend line to stack top", "ownerPath": "src/game/expedition/panel/Scrubber.tsx" } ] }
   ```
4. **Fix.** Main groups the fixes by `ownerPath` and dispatches them to an F-slot agent owning exactly those paths.
   They re-capture.
5. **Stop.** The loop ends when the score is ≥ 32/36 with all 11 ★ items and ≥ 4/5 game-feel items, or after 3
   rounds (1 round when the clock is past T0 + 22). Remaining gaps go to `BLOCKERS.md` with screenshots. The score
   history is kept, so the docs can show before and after.

---

## Appendix A · New file tree (summary)

```
src/contracts/world.ts
src/world/{types,library,draft-inputs,aid-tier,ease,geom,graph-math,biomes,speakers}.ts
src/world/{resolve-world,validate-world,answer-leak,probes,fail-line,feedback-nouns,config-validators,date-parse}.ts
src/world/diagnose/{index,<mode>}.ts   src/world/state/{world-state,npc-state,quests,requirements}.ts
src/world/contraptions/{config-parts,writer-kit}.ts + <13 ids>.meta.ts (+ .test.ts)
src/world/sandboxes/{music-box,plant-garden,darkroom}.meta.ts (+ .test.ts)
src/world/sims/{index,bilayer-probe,diffusion-tank,osmotic-cell,pump-flume,membrane-fold,pendulum-beat}.ts (+ .test.ts)
src/world/asset-index/{index,shared,orrery_terraces,living_gate,archive_of_voices}.ts (4 generated)
src/world/{assemble-world,auto-world}.ts                         (W8)
src/server/worlds.ts
src/game/art/palette.ts + palettes/<ns>.ts
src/game/hosts/expedition/{ExpeditionHost.tsx,ExpeditionScene.ts,bridge.ts}
src/game/hosts/expedition/{loader,scene,actors,input,fx,cutscene,labels,dom,__fixtures__}/…
src/game/hosts/expedition/contraptions/{types,registry,controller,sandbox-controller}.ts + Snapshot.tsx + prefabs/<id>/prefab.ts
src/game/expedition/client/{ExpeditionClient.tsx,ExpeditionLayout.tsx,machine.ts,station-dialogue.ts,express.ts,useRunner.ts}
src/game/expedition/dialogue/{types,engine,emblem-glyphs}.ts + DialogueBar.tsx
src/game/expedition/hud/{ObjectiveRing,ZoneTitle,MeterBar,Counters,KeyLegend,MuteToggle,TouchPad}.tsx
src/game/expedition/{map/MapOverlay.tsx, journal/JournalReader.tsx}
src/game/expedition/audio/{cues,synth,bus}.ts
src/game/expedition/panel/{InstrumentPanel.tsx,BriefSheet.tsx,Scrubber.tsx,theme.css,fn-source.ts} + primitives/ cards/ controls/
src/app/dev/panel/page.tsx                                       (dev-only gallery)
art/{README.md,fonts,kit,shared,orrery_terraces,living_gate,archive_of_voices}/…
scripts/{build-art,build-characters,art-contact-sheet,capture-scenes,extract-world-slice}.ts
fixtures/worlds/{trig,cell-transport,civil-rights}.world.json
public/assets/expedition/<ns>/… (generated)
e2e/expedition-{trig,cell,civil,express,keyboard}.spec.ts
docs/design/fidelity/…
```

## Appendix B · What does not change

`EncounterRunner`, **every mechanic mode and its `grade()`** (no `Grade.focus`, no exported `firstMiss`, no mimic
`noun` var), `GameSpec` fields other than the optional `world`, the six fixture JSONs, the legacy Dungeon,
Platformer, Mystery and DOM hosts, `EndScreen`, telemetry, the debrief, `AUDIO_MODE`, and the `__GAME_DEBUG__` core
shape (`state/skipTo/autoSolve/events/mastery`).
