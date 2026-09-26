# 31 · Completeness critique, round 2

**Status:** critic pass 2, 2026-09-26 (evening). **Read in full:** `30-critique.md` (round 1),
`20-expedition-architecture.md` (revision 2), `02-assets-and-art-pipeline.md` (revised), `10-game-trig.md`,
`11-game-cell-transport.md`, `12-game-civil-rights.md` (all revision 2) and `01-variant-design-bible.md`.
**Checked against the repo:** fixture character ids and encounter modes (`trig_demo_001` cog/warden,
`cell_demo_001` pilot/gatekeeper, `history_mystery_001` archivist/editor), fixture param keys for e8 pairs, e10/e11
decoys and e12 hypotheses, `mode.solutionInput` (exists in `src/mechanics/types.ts:59`), and the `tsconfig.json` /
`vitest.config.ts` include lists.

## Verdict

The round-1 contract problem is solved. The three game documents now target one API. Every one of the 29 stations
names a 20 §4 archetype and skin, its control, its probe and world binding, and a complete `config` JSON that parses
against 20 §4.2. Every speaker resolves against `spec.characters ∪ cast.extras ∪ {narrator}`. Every zone reaches
≥ 2 non-walk verbs at P1, and every zone 1 reaches it at P0. All three hero lists fit the cap of 40 at P0 (37 / 36 /
35). The P0 cut names the same zone 1 in all four documents. **The game documents are implementation-ready.**

What is not ready is the layer *under* them. Three documents still disagree with each other:
- **02 vs 20** give two naming tables, two character pipelines, two kit catalogues, two hero caps (40 vs 60), two
  font plans and two texture-residency policies. Round-1 amendment 22 ("one naming table") produced two tables.
- **01 vs 20** give two game-feel rubrics (items 37–44, target 39/44 with 14 ★, vs items 37–41, target 32/36 with
  11 ★). Bible §6–§7 still describe revision-1 contraptions, an SVG-puppet protagonist and three zones per game.

Two architecture gaps would also block the civil game's mandatory panel items and every station's hint flights (see
§5, A6 and A7). Finally, **the wave plan does not fit the calendar.** 20 §7 is written for ≤ 3 concurrent agents with a
24.5-hour critical path to P0 freeze, but the demo is on 2026-09-27. The brief assumes about 10 parallel agents, and
`instructions.md` §6.2 allows only 3 at once. That decision has to be made explicitly before W0 starts.

**Recommendation.** **Not ready as-is.** Treat it as a **go after a reconciliation pass of about 2 hours by main or the
architect**, which folds the 13 amendments in §5 into 20, 02 and 01. No game document needs another content pass.
Only A12 asks the game docs' already-documented deviations to be mirrored into 20 §4.1.

---

## 1 · Round-1 amendments: fold audit

✓ = folded (section cited) · ◐ = folded, but the result conflicts with another document · ✗ = not folded.

| # | Amendment (short) | Status | Where it landed | Residual |
|---|---|---|---|---|
| 1 | Speakers outside `spec.characters` | ✓ | 20 §1.3 `Cast.extras`, §1.5 R2; trig §3.3, cell §3.5, civil §3.5 | — |
| 2 | Traversal links, one key map | ✓ | 20 §0 d9, §1.3 `TraversalLink`, §2.4.2, §3.5; trig §2.7, cell §2.6, civil §2.6.x | descent rule undefined (A8) |
| 3 | Probe channel | ✓ | 20 §1.3 `ProbeSpec`, §2.5.1, §3.3; all 29 configs | — |
| 4 | Time and simulation | ✓ | 20 §2.5.1 `SimSpec`, §2.5.3; §4.2 sim table | — |
| 5 | Rewrite §4.1, new archetypes and skins | ✓ | 20 §4, §4.1, §4.3 | game-doc slot requests not mirrored (A7) |
| 6 | Generalized payoff | ✓ | 20 §1.3 `Payoff` + `PAYOFF_KIND_OF` | e10 civil `terrain: []` (A11) |
| 7 | Card kinds + GraphCard annotations | ✓ | 20 §2.5.2, §3.2 | RECORD card has no data path (A6) |
| 8 | Station geometry, accessories, boss | ✓ | 20 §1.3 `Station`, `BossStaging`, `Accessory` | — |
| 9 | Dialogue slots, 140 chars, R9 nouns | ✓ | 20 §1.3 `StationDialogue`, §1.5 R9, §2.7 | — |
| 10 | Hints act in the world | ✓ | 20 §2.5.1 `aidTier`, `hintTargets`, §2.10 `onHint` | per-skin/per-station targets have no field (A7) |
| 11 | `diagnose()` single source; probes | ✓ | 20 §2.5.4, §1.3 `MisconceptionProbe` | `assignedTo` on type_match undefined (A9) |
| 12 | Demo cut, express, earlier gate | ✓ | 20 §0.1; trig §0, cell §0.1, civil §0.1 | the schedule is infeasible at ≤ 3 lanes (A1) |
| 13 | Every configSchema; writer schemas; validators | ✓ | 20 §4.2, §4.4, §6.2 | — |
| 14 | Procedural kit, hero cap | ◐ | 20 §5.4 (cap 60, `art/kit`, about 20 generators); 02 §3a (cap 40, `src/game/art/kit`, 31 generators) | A2 |
| 15 | Ambient triggers | ✓ | 20 §1.3 `Trigger`, §2.4.5 | — |
| 16 | NPC states and quests | ✓ | 20 §1.3 `Npc.states`, `Quest`, §2.4.4–6 | NPC puppets have no manifest kind (A3) |
| 17 | Sandbox | ✓ | 20 §1.3 `Sandbox`, §2.4b | — |
| 18 | Gatekeeper staged | ✓ | cell §5.11 (phases p1–p3, taunts); 20 §4.1 | — |
| 19 | One recoloured rig | ◐ | 20 §5.5 (PNG atlas, `shared.char.*`, 45 frames, 7 authored anchors); 02 §3b (SVG sheet, `<ns>.char.*`, 28 frames, 4 computed anchors, female_adventurer only); **bible §6.3 not folded** | A3, A13 |
| 20 | Per-zone coordinates, vertical camera | ✓ | 20 §1.3, §2.3; every game doc converted | 4 small §4.1 mismatches (A12) |
| 21 | Glyphs by text-to-path | ◐ | 20 §5.3 (one `engrave.ttf`); 02 §3e (Cinzel + EB Garamond, verified: Cinzel lacks π) | A2 |
| 22 | One naming table | ✗ | two tables: 20 §5.1 (groups `layer/costume/npc/doc/silhouette`, keys `part.<skin>_<slot>`) vs 02 §3.0 (groups `sky/far/midfar/mid/fore/light/char`, keys `part.ringgate_wall`). The game docs follow 20; the bible §6.1 points at 02 | A2 |
| 23 | Segments and interiors | ✓ | 20 §1.3 `Segment`, `Interior`; civil §2.3, §2.6 | — |
| 24 | Meter, progress effects, map, journal | ✓ | 20 §1.3 `Story`; cell §6.2, civil §5.0.2 | A6 |
| 25 | Cutscene verbs | ✓ | 20 §1.3 `CutsceneStep`; trig §4.3/§4.5, civil §4.2/§4.3 | `ride` step lacks a surface (A8) |
| 26 | Leaks before Verify | ✓ | 20 §2.5.6; civil §5.9 `bayLampsTier: 1`; cell §5.8 "loaded" label | — |
| 27 | Trig probe moves the world | ✓ | trig §5.3/§5.4/§5.5 (`trace_slate`, `relief_marker`) | — |
| 28 | Traversal beat sheets | ✓ | trig §2.7, cell §2.6, civil §2.6.1–§2.6.8 | — |
| 29 | Game-feel checklist items | ◐ | bible §9 (37–44, target 39/44, 14 ★) vs 20 §8.3 and every game doc §8 (37–41, target 32/36, 11 ★) | A5 |
| 30 | Per-game performance plans | ✓ | 20 §2.11; cell §2.4.1; civil §2.5 | residency conflict with 02 §3f (A4) |
| 31 | DOM fallback = snapshots | ✓ | 20 §2.2, §2.5.5 | — |
| 32 | Framing giant contraptions | ✓ | 20 `frameBounds`, `frameZoom`; civil e6 0.7, e11 0.8; cell e10 0.85, e11 0.75 | — |
| 33 | Controls | ✓ | 20 §3.3 | — |
| 34 | R8 token matching | ✓ | 20 §1.5 R8, `answer-leak.ts` | — |
| 35 | Synth cue bank | ◐ | 20 §2.12, but `sfx.beam_rise`, `sfx.slab_set`, `sfx.fuse_pop`, `sfx.press_roll`, `sfx.teletype`, `success-badge` are not `Id`-legal; civil §5.0.6 renamed its own | A10 |
| 36 | `feedbackNouns` | ✓ | 20 root; trig, cell, civil | — |
| 37 | Quiz-voiced lines, varied quarantines | ✓ | cell §4.3, §5.P; civil §4.4 | — |
| 38 | Post-demo archetypes | ✓ | 20 §4 rows 14–17 | — |
| 39 | `autoWorld` config defaults | ✓ | 20 §4.4, §6.3 | — |
| 40 | One overlay location + keying test | ✓ | 20 §1.2, §8.1 | — |
| F1–F12 | Risks | ✓ except F3/F4 (◐, via 19/21) | 20 §5.4–§5.6, §2.11, §2.2 | — |

Declined items: none. The only "not folded" entry (22) produced two tables, which is worse than one wrong table.

---

## 2 · Game-document conformance to 20

### 2.1 Names, archetypes, skins, controls, asset keys

| Check | Trig | Cell | Civil |
|---|---|---|---|
| Archetype / skin ids ∈ 20 §4 / §4.3 | ✓ 6/6 | ✓ 11/11 | ✓ 12/12 |
| Control per mode = 20 §3.3 | ✓ | ✓ (`WaveControl` e5/e9, `CableControl` e8) | ✓ (`MatrixControl` e12) |
| Field names = 20 §1.3 (`consoleX`, `anchor`, `partNouns`, `probes`, `panel`, `payoff`, `boss`, `accessories`, `frameZoom`) | ✓ (Appendix A full JSON) | ✓ (§5.1 full JSON) | ✓ (station blocks) |
| Asset keys follow **20 §5.1** (`<ns>.<group>.<name>`, groups `layer/costume/npc/companion/part/doc`, part keys `<skin>_<slot>`, characters `shared.char.<id>`) | ✓ | ✓ | ✓ |
| Asset keys follow **02 §3.0** | ✗ (by design: trig §7.1 says 20 wins) | ✗ | ✗ (civil A.2 O9) |
| Deviations from 20 documented | trig CHANGELOG "Deliberate deviations" (z1 drop, z2 exit surface, `faceplate` slot) | cell §9.5 slot requests; "content decisions" (ride landing, sheer edges) | civil A.2 O1–O14 |

### 2.2 `config` legality (against 20 §4.2 and the §4.4 validators)

All 29 configs carry every schema field, and every enum value is legal. They are keyed by `statementIndex`, item key,
`waveIndex` or clue index, never by display order.
- **Trig.** `EmitterRailConfig`, `RingGateConfig`, 2 × `ClaimHoldersConfig` (traces evaluate; one style set per game),
  `StepBridgeConfig` (`relief`, `anchors: 2`, `stepEffects`), and `PendulumSyncConfig`.
- **Cell.** 4 × `ClaimHoldersConfig` (ghost ids ∈ each sim registry; the mimic's ghost is `contradicts`),
  3 × `RouterLanesConfig` (e11 `energy.reserve: 12`), 2 × `SluiceWavesConfig` (`showFate: false` ⇒ `fate: null` on e9),
  and `StageMachineConfig` (decoy `x0`, stage stops). `StepBridgeConfig` with `bays: stage_rail` gives every key a
  stage, including `d0 → dissolve_bounce`.
- **Civil.** Footprints are all-or-none (e1 all, e4 none). `dayCounter` has a year window. `boardWidth` is 1100.
  `decoyDimRung: 3` (civil flags a validator risk in O8). `TumblerVaultConfig` dates appear in the clue texts.

Notation the C-lanes must expand when they write the JSON (this is not a schema problem):
- trig `"@intro.01"`;
- civil `"I01"` and `"YEAR(min, max)"`;
- cell `"dialogue": "§4.3 rows …"`.

Each document defines its own shorthand.

Two semantics are **not** defined by 20 and are used by the configs (A9):
- cell e5/e9 `assignedTo` probes with `itemKey: "w0"` / `binId: <categoryId>` on `sorter.type_match`;
- boss `taunts.byKey` keys (cell e11, trig e6), which R5 never checks against probe keys.

### 2.3 Speakers

Every `speakerId` resolves:
- **trig:** `cog`, `warden` + extras `brasswick`, `lumen`, `quill`, `mimic`, `ilse` + `narrator` (133 lines);
- **cell:** `pilot`, `gatekeeper` + `sucra`, `poro`, `kay`, `ferryman` + `narrator` (172 lines);
- **civil:** `archivist`, `editor` + `otis`, `hattie`, `dolores`, `theo` + `narrator`.

Speakers with no body at P0 (Poro in e5 `approach`, the Ferryman in e10 `fail.byKey`) are legal: R2 checks ids, not
bodies. A spot check of R8 on the riskiest slots found no leaks (trig `e2.hint2` "2π/|b|" and `e1.instruction` "5π/6";
civil `e3.*` and `e12.H2`; cell `e10_*`).

### 2.4 Non-walk verbs per zone (W2 / checklist 37)

| Game | P0 | P1 |
|---|---|---|
| Trig | `z1` hop, climb, drop ✓ · `z2` 0 · `z3` 0 | `z2` hop, drop, ladder, sandbox ✓ · `z3` timed_hop, ladder, climb ✓ |
| Cell | `zone_a` hop, climb ✓ · `zone_b` drop · `zone_c` ladder · `zone_d` 0 | B hop, climb, drop, sandbox ✓ · C hop, drop, 3 touches ✓ · D ride, climb, drop ✓ |
| Civil | S1 hop (+ `await_interact`, which W2 does not count) · S2 hop, climb, drop ✓ · S8 ladder, drop ✓ · S3–S7 0 | S1, S3, S4, S5, S6, S7 ✓ |

Result: 15/15 zones meet the rule at P1, and each game's zone 1 meets it at P0. That matches 20 §0.1.2's P0 row.
Checklist item 37 can therefore **not** pass at P0 for any game as currently scored (see A5).

---

## 3 · P0 demo cut: consistency across 20, 02 and the game docs

| Concern | 20 §0.1 | 02 §4 | Game doc | Consistent? |
|---|---|---|---|---|
| Trig zone 1 | `z1_sunward` full | Z1 (S0–S2) | trig §0.1 `z1_sunward` | ✓ |
| Cell zone 1 | `zone_a` full | zone A | cell §0.1.1 `zone_a` | ✓ |
| Civil zone 1 | S2 full + Record Engine in S1 | S1 + S2 | civil §0.1.2 (S2 + S1 Engine) | ✓ |
| Hero cap | **60** (§5.4, §5.8, A1/C acceptance) | **40** | trig, cell, civil use 40 | ✗ (A2) |
| P0 hero count | A1 "about 30", A2 "about 45", C "15–25 each" (sums exceed 40 per biome) | 24 / 31 / 30 (different key lists) | **37 / 36 / 35** | ✗ (A1, A2) |
| Kit-zone landmarks | trig: falls cliff, dome + Star Door; cell: trench + Poro, hall vault, pore; civil: school, dimestore + terminal, church, colonnade, bridge, vault door | trig: no falls-cliff hero; civil: no colonnade or dimestore hero | match 20 | 02 is stale (A2) |
| Stations native at P0 | all 29 | — | all 29 (fallback ladder listed) | ✓ |
| Bosses staged | e6 / e11 (2 + 2 + 3) / e12 | — | same | ✓ |
| Intro / finale | as listed | — | same (trig adds `control_until`) | ✓ |
| Express timing | 7 / 12 / 12 min | — | 7 / 12 / 12 min | ✓ |
| NPCs at P0 | "all NPC states" are P1 | Ida is a bust at P0 | trig Brasswick `before`, civil Ida + Otis on the rig | ✗ (A12; 02 Ida is superseded by A3) |
| Plaques / triggers at P0 | not listed (P1 row) | — | cell P1–P2 plaques, civil 4 plaques + N18, trig `s0_controls` | ✗ minor (A12) |
| Progress effects | P1 | — | cell 11 `hub_socket`s at P0 | ✗ minor (A12) |
| Negatives | P2 (§0.1.4) but the darkroom unlock (P1, §0.1.3) needs them | — | civil moves them to P1 | 20 is self-inconsistent (A12) |
| Reflections | "puddle reflections" P2 | — | civil P0 row "reflections only in S4 and S7" | ✗ minor (A12) |
| Sandboxes, quests | P1 | — | P1 | ✓ |
| Maps, journals | P2 | P2 | P2 | ✓ |

---

## 4 · Feasibility: the wave plan against about 10 agents in one day

**As written (20 §7.0–§7.1), it does not fit.**
- 20 §7.0 caps concurrency at **3** (from `instructions.md` §6.2).
- The critical path W0 → H1 → B2 → V → K2/K3 → C1–C3 → E1 is 1.5 + 5 + 4 + 0.5 + 5.5 + 5 + 3 = **24.5 agent-hours
  wall-clock**.
- Gate V's hard stop is 12:00 on 2026-09-27 at T0 + 10.5, which forces T0 ≤ 01:30 on the demo day. P0 freeze at
  T0 + 24 then lands after the demo day.
- The "compression levers" (§0.1.6) cut art and e2e. They do not shorten the code path.

**It can fit with about 10 lanes**, because most of the work is already parallel in the *design*:
- configs are fully specified (§4.2);
- metas are pure;
- content is fully written;
- art has kit fallbacks for every hero.

The blockers to parallelism are sequencing choices:
1. **W0 ships stubs.** W0 creates meta *stubs*, so content lanes cannot validate configs until W3. The §4.2 zod
   configs are already code-ready. W0 should ship them for real, plus `validateConfig` stubs that return `[]`, so C-lanes
   can author and zod-parse all three side-cars from T0 + 2.
2. **A1 carries too much.** One lane carries the pipeline, 31 generators, engraving, the rig build, the shared set and
   16 trig heroes (3,400 lines + 30 SVG in 5 h), and it is on the Gate V path.
3. **A2 also carries too much.** One lane authors about 45 heroes for two biomes.
4. **K2/K3 are strictly after Gate V**, although their metas depend only on W0 types.

A 10-lane schedule that keeps 20's ownership discipline is sketched in A1 (§5). It reaches Gate V at about T0 + 11 and
P0 freeze at about T0 + 15. If `instructions.md` §6.2 stays at 3 concurrent agents (a user rule; agents may not change
it), the P0 cut must shrink instead. For example:
- cell e5/e8/e9/e10 and civil e5/e6/e11 on `console_slate`;
- civil S3–S7 kit-only;
- no sims beyond `pendulum_beat` and `bilayer_probe`.

That shrink should be written into 20 §0.1 now, not discovered at T0 + 20.

---

## 5 · Remaining blocking amendments (13)

Each gives the file and section, the problem, and the fix. They are ordered by impact.

**A1 · Schedule and concurrency.** File: 20 §7.0, §7.1, §7.2, §7.3 (+ a main-owned `instructions.md` §6.2 decision).
- **Problem.** The schedule assumes ≤ 3 lanes and has a 24.5 h critical path, so P0 freeze lands after the demo.
  Lane hero quotas (A1 30, A2 45, C 15–25) contradict the game docs' lists and the cap of 40.
- **Fix.**
  1. Record the concurrency decision in `DECISIONS.md`: 10 lanes if the user allows it, else apply the "P0-lite"
     shrink from §4.
  2. Rewrite §7.1 as 10 lanes:
     - **W0** (0 → 2 h, main): contracts, **real** §4.2 configs, registries, skeleton side-cars, the manifest schema
       after A2/A3.
     - **W1** (2 → 7): H1, P1, A1a (pipeline, kit, rig), A1b (trig z1 heroes on kit stand-ins), B1, B2 (against a
       fake `HostHandle`), K1, K2-meta, K3-meta, C0 (all three side-cars from the docs, zod-parsed).
     - **W2** (7 → 11): Gate V (main), K2/K3 prefabs, A2-cell, A2-civil, A1b (trig z2/z3 heroes), E1 scaffold, and a
       fix slot.
     - **W3** (11 → 15): C1/C2/C3 wiring and the rest of the art, E1, the R critic plus the sensitivity sign-off, and
       2 F slots → **P0 freeze about T0 + 15**.
  3. Set per-lane hero quotas from trig §0.2–§0.3 (16 / 13 / 8), cell §0.1.2 (14 / 22) and civil §0.1.2–§0.1.3
     (19 / 16).
  4. Write T0 and the demo slot as absolute clock times.

**A2 · One naming and pipeline table.** Files: 20 §4.3, §5.1–§5.4, §5.8; 02 §3.0, §3a.2, §3d, §3e, §4; 01 §6.1.
- **Problem.** Amendment 22 produced two tables. They conflict on:
  - groups;
  - part-key spelling (`part.ring_gate_gate_wall` vs `part.ringgate_wall`);
  - character namespace;
  - hero cap (60 vs 40);
  - kit location (`art/kit` vs `src/game/art/kit`; 02's rationale is correct);
  - generator names: 20 §4.3/§5.4 use `panelBox`, `glassTank`, `latticeTruss`, `cabinet`, `consoleLectern`,
    `mesaBand`, `canopyBlob`, which 02's `KitName` lacks, and cell §7 already has to guess;
  - fonts (one `engrave.ttf` vs Cinzel + EB Garamond; Cinzel lacks π);
  - manifest shape (`namespace/paletteId/heroCount` vs `ns/palette/heroCap`; `source: "kit"` vs `"kit:<gen>"`).

  The game docs follow 20 for keys and 02 for generators.
- **Fix.**
  1. Keep **20's keys and groups** (the game docs already use them).
  2. Take **02's** cap of 40, `src/game/art/kit/`, its 31 `KitName`s and its two-font engraving.
  3. Rewrite every `K(...)` in 20 §4.3 with a 02 generator: `panelBox` → `plate`, `latticeTruss` → `truss lattice_mast`,
     `cabinet` → `shelving`, `consoleLectern` → `lectern`, `mesaBand` → `ridgeBand`, `canopyBlob` → `canopy`. Either add
     `glassTank` to 02 or map it to `compose(plate, bilayerTile strip_vertical)`.
  4. Merge the manifest into the one zod `AssetManifest` in 20 §1.3.
  5. Mark **02 §4's hero lists superseded** by the game docs' §0 lists (37 / 36 / 35).
  6. Repoint bible §6.1 at 20 §5.1.

**A3 · Characters and puppets: one contract.** Files: 20 §1.3 (`ManifestEntry`, `CharacterLook`, `RigAnchor`,
`Cast.guide.companion`, `Npc.asset/anim`), §2.2 (`actors/*`), §5.5; 02 §3b.
- **Problem.** There are two rig pipelines:
  - 20: a Playwright PNG atlas with 45 frames, 4 bodies, `shared.char.<id>`, and 7 hand-authored anchor names;
  - 02: an SVG sheet with 28 frames, female_adventurer only, `<ns>.char.<id>`, 4 *computed* anchors
    (`head/torso/handF/handB`), and Ida as a bust.

  There is no **puppet** manifest kind or runtime in 20, yet Cog, Pip, Wick, Brasswick (named anims `arm_short` /
  `arm_sync`), the mimic crab, the Gatekeeper and the Warden are ≤ 8-part puppets in 02 and the game docs. 20 A1 still
  says "Cog (3 poses)", and `Cast.guide.companion` uses `<asset>_<pose>` siblings. The game docs use 20's anchors
  (`back`, `hand_r`, `torso`) and `shared.char.*`.
- **Fix.**
  1. Keep 20's `shared.char.<id>` keys and `RigAnchor` names.
  2. Derive the anchors with 02 §3b.3's transform walk: `handF` → `hand_r`, `handB` → `hand_l`, torso → `torso` +
     `back` offset.
  3. Pick **one** raster path: the PNG atlas (20), with 02's `load.atlasXML` untinted fallback.
  4. Add a `puppet` `ManifestEntry` kind (02 §3b.5 `parts[] {name, frames, rest, pivot, z}`) and
     `src/game/expedition/puppets/Puppet.ts`.
  5. Make `Cast.guide.companion.asset` and `Npc.asset` puppet keys with named animations `idle`, `talk`, `cue` and
     custom `anim` ids.
  6. List P0 atlases per game: trig 1, cell 1, civil 3. Allow ≤ 6 at P1 (civil O13).

**A4 · Texture residency.** Files: 20 §2.2 `manifest-loader.ts`, §2.3 last paragraph, §2.11 "Load" row, §5.7, §5.8;
02 §3d, §3f.
- **Problem.** 20 loads one manifest per biome and keeps every texture across zones ("the next zone's textures are
  already loaded"). 02 measures one zone at about 95 MB (trig Z1, dpr ≥ 1.5) and budgets ≤ 180 MB only for a two-zone
  swap. Whole-biome residency plausibly exceeds 180 MB and hurts the ≤ 3 s first-zone load.
- **Fix.** Adopt 02 §3d: manifest entries carry `zone`, the loader loads `shared` + the current zone behind the
  transition wipe and unloads the previous zone after it. Change the VRAM test to "per zone, and per swap pair".

**A5 · One fidelity rubric.** Files: 01 §9, §11; 20 §8.3, §0.1.6 Gate V; trig §8, cell §8, civil §8.
- **Problem.** The bible scores 44 items (target ≥ 39/44, 14 ★ including 38, 40, 42). 20 and all three game docs score
  41 items (≥ 32/36 + ≥ 4/5, 11 ★), and the score-JSON shapes differ between bible §11 and 20 §8.3. Bible item 39
  ("≥ 2 presentation waves") is unmeetable for trig (a real-time shield) and civil (a vault matrix). Items 37, 43 and
  44 cannot pass at P0 because triggers, sandboxes and later zones' verbs are P1.
- **Fix.**
  1. Adopt the bible's 44 items and 14 ★ as the single list.
  2. Reword 39 to 20's "arena, taunts, phases **or** real-time motion".
  3. Define **P0 scoring**: 37/43/44 are scored on zone 1 only; the P0 target is all ★ plus ≥ 36/44.
  4. Use one JSON shape (bible §11, plus 20's `ownerPath`/`fix` fields).
  5. Update the three game docs' §8 headers.

**A6 · RECORD card data path.** Files: 20 §2.5.1 (`StaticInput`), §2.5.2 (`PanelStatic`), §3.2 (`InstrumentPanel`);
civil §5.0.2.
- **Problem.** Every civil panel has a RECORD timeline card built from `story.recordStrip` and the **solved**
  encounters, plus a FILE card and value chips (★18, ★21, 22). Metas only see `StaticInput {view, config, aidTier,
  hintsUsed}`, with no world, no progress and no probe window, so neither the meta nor the panel has a specified source
  for RECORD pins.
- **Fix.** Add `PanelContext {recordStrip, solvedIds, probeWindow}`, passed by `ExpeditionClient` to `InstrumentPanel`.
  The panel prepends a panel-owned `timeline` card (slot 0, "RECORD") whenever `story.recordStrip` is non-null. The
  meta's `panelStatic` supplies the FILE card at slot 1. Add a P1 test that e1's RECORD shows 0 earned pins and e9's
  shows 11.

**A7 · Skin contract sync: slots, hint targets, accessories.** Files: 20 §4.3, §2.5.1 (`ContraptionSkin`,
`StaticInput`), §1.3 `Station`, §4 table.
- **Problem.**
  1. Skin-slot requests the game docs make are missing from 20 §4.3:
     - trig `resonance_pillars.faceplate`, plus the `wardens_shield` fold;
     - cell `specimen_pods.mimic_mote`, `membrane_router.gate_fin` / `gate_ring_outer` / `gate_ring_inner`,
       `tonicity_sluices.cell_protoplast` / `lock_leaf`, `gatekeeper_maws.eye_pupil`;
     - civil `switchboard.steps`, `filing_cabinets.stairwell`.
  2. Every station tabulates its own `hintTargets` per rung, with anchors that differ per **skin** (for
     `claim_holders`: trig `lens`/`slate_*`, cell `apparatus`/`ghost_origin`, civil `lamp_pivot`/`panel_*`). But
     `meta.hintTargets(rung, StaticInput)` gets no skin id, and `Station` has no field to carry the tables.
  3. No meta lists `accessories: ["record_lens"]`, but civil puts it on six archetypes (R5 would reject them).
- **Fix.**
  1. Add the slots.
  2. Add `ContraptionSkin.hintTargets: [HintTarget[], HintTarget[], HintTarget[]]` (the default) and
     `Station.hintTargets` (a nullable override, typed like `HintTarget` with `anchor`/`action`/`holdMs`). Add `skinId`
     to `StaticInput`.
  3. Set `accessories: ["record_lens"]` on `claim_holders`, `oracle_ticker`, `step_bridge`, `router_lanes`,
     `switchboard` and `cause_tubes`.

**A8 · Traversal semantics the docs depend on.** Files: 20 §2.4.1, §1.3 `CutsceneStep.ride`, R11.
- **Problem.** 20 defines rises above `maxStepUp` (they block) and platform edges (they drop). It does not define a
  **sheer descent on the ground heightfield**, and the docs assume opposite rules:
  - cell (CHANGELOG "Sheer edges"; the e4 ledge, e5 trench, S7 gulf) and civil (S2 floods, S8 lift edge) assume it
    **blocks**;
  - trig S0's canal rungs assume the player can **walk in**.

  The `ride` step also has no landing surface, so cell appends a fade + `enter_zone` hack (e7 gantry → `pump_deck`,
  e9 barge → `pit_ledge`).
- **Fix.**
  1. Rule: "a ground descent > `maxStepUp` within 8 units blocks walking; only a `drop` link crosses it".
  2. Add a `drop` link into the trig canal (`s0_canal_in`, ground 2110 → ground 2200).
  3. Add `toSurface: SurfaceRef` to the `ride` `CutsceneStep`, and delete cell's `enter_zone` workaround.

**A9 · Probe and diagnosis coverage.** Files: 20 §2.5.4 (`probes.ts`), §1.5 R5, R15.
- **Problem.**
  - `assignedTo` is defined for bins only. Cell e5/e9 use it on `sorter.type_match` with `itemKey: "w<i>"` and
    `binId: <categoryId>`.
  - `decoyPresent` with `itemKey: null` (civil e11) is legal, but its semantics are unwritten.
  - R5 validates `dialogue.fail.byKey` keys, but not `boss.taunts.byKey` keys. Trig e6 (`reach`, `half`) and cell e11
    (`protein_costs_atp`, `always_downhill`, `small_passes`) rely on them.
- **Fix.** State the type_match mapping (`w<i>` ↔ `waveIndex i`, `binId` ↔ `categoryId`) and the "any decoy"
  semantics, extend the parity test to them, and extend R5 to taunt keys.

**A10 · Cue ids must be `Id`-legal and complete.** File: 20 §2.12 (`CUE_MAP` table), R16.
- **Problem.** 20 maps `sfx.beam_rise`, `sfx.slab_set`, `sfx.fuse_pop`, `sfx.press_roll`, `sfx.teletype` and
  `success-badge`. `Trigger.cue`, `touch.cue` and the `sfx` step take `Id`, so these can never be referenced. Civil
  renamed its own (§5.0.6).
- **Fix.** Rename them to snake_case. Seed `CUE_MAP` from the union of trig §6.8, cell §6.7 and civil §5.0.6, and have
  B2's coverage test parse those three tables.

**A11 · Civil must-haves that 20 lacks.** Files: 20 §6.4 `BiomeKit`, §2.2 `actors/protagonist.ts`, §1.5 R6,
§2.8 / `hub` step; civil A.2 O1, O3, O6.
- **Problem.**
  1. The protagonist plays `cheer` on every success. Civil (a sensitive kit) requires `show` at memorial payoffs:
     "must be fixed before P0 freeze" (O6).
  2. The e10 payoff `stairs_rise` with `terrain: []`, whose traversal is a ladder link gated by the same station
     (O3), is not stated as legal.
  3. A `hub` state change has no sub-part motion (the Engine rings spin and the iris opens in the intro and e11; O1).
- **Fix.**
  1. Add `BiomeKit.successPose: "cheer" | "show"`, with `archive_of_voices = "show"` and R10 enforcing it.
  2. R6: allow an empty `terrain` when a link with `requires.solved = this station` exists.
  3. `Hub` gains `anims: {partial, restored}`, played by the hub puppet (A3).

**A12 · Sync 20 §4.1 and §0.1 with the game docs.** Files: 20 §4.1, §0.1.2–§0.1.4.
- **Problem.** Known mismatches:
  - trig z1 drop "at x 5250" (not expressible) and z2 exit surface `rim_top` (it is `ground`);
  - civil e12 "on `vault_level`" (it is `ground`);
  - civil e8 anchor y 900 (it is 640);
  - cell e11 `arenaBounds` unlisted.

  The P0 table also omits P0 content the docs rely on:
  - trig Brasswick `before`; civil Ida and Otis NPCs and 4 plaques; cell P0 plaques;
  - cell `hub_socket` progress effects;
  - civil zone-entry cutscenes, interiors and segment variants.

  Negatives are P2 in §0.1.4 but gate a P1 sandbox. The reflection tier is unclear (P0 in civil, P2 in 20).
- **Fix.**
  1. Declare "game-doc JSON is authoritative for coordinates and traversal; §4.1 is an index".
  2. Correct the five cells above.
  3. Add a "P0 content the host must support" row: NPC states, plaques, `hub_socket`, entry cutscenes, interiors,
     segment variants.
  4. Move the negatives to P1.
  5. Put the S4/S7 reflections at P1, with static sheen at P0.

**A13 · Retire the bible's stale sections.** File: 01 §6.1, §6.3, §6.4, §7 (tables 7.1–7.3), §8 table.
- **Problem.** The bible is the first read for art and critic agents, and these sections still say:
  - `load.svg … {scale}`, `setLiveValue` / `celebrate`, "camera centred in the left 60 %" (§6.1);
  - an **SVG-puppet protagonist** (§6.3, amendment 19 not folded);
  - "jump (Space)" and "each game = 3 zones" (§6.4);
  - revision-1 contraptions and payoffs in §7: Radian Rail, Proof Press, a Timeline Rail "tram", "Morgue → Wire Room →
    Vault", ATP in `ui.accent`.
- **Fix.** Replace §6.3 with the one-recoloured-rig rule (20 §5.5 after A3). Replace §6.4 with the 20 §2.4.2 verb
  table. Head §7 and §8 with "superseded for bindings by 20 §4 / §4.1; kept as the pitch-level target". Fix the ATP
  colour note (cell §2.2 deviation).

---

## 6 · Non-blocking notes (fold when convenient)

- 20 §6.2 World Writer: "instruction under 120 characters" vs R9's 140. Align to 140.
- A `Trigger.cutsceneId` would let cell's S7 viewpoint pan (cell §2.6 accepts the lack).
- `Cast.guide.companion` has no visibility requirement (trig perches Cog from frame 1 instead of a dormant pose).
- `await_interact` on a prop without `touch` (trig `beam_pylon_s0`, civil `main_breaker`): state in 20 §2.4.3 that an
  interact target needs no `touch` block.
- The C-lanes will spend time expanding shorthand (`@id`, `YEAR(a, b)`, row pointers). A 100-line
  `scripts/expand-world-doc.ts` that reads the §4 tables would save about an hour per game. This is optional.
- 20 §2.5.1 `aidTierOf` is declared as a function inside a `.ts` interface file listing. W0 should put it in
  `aid-tier.ts` (already planned).
- Civil O8 (`decoyDimRung` paraphrase) and O13 (atlas count) are covered by A3. O5 and O14 are P2.
