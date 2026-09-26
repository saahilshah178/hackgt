# 30 · Completeness critique of the design set

**Status:** critic pass, 2026-09-26. **Read:** `00-runtime-map.md`, `01-variant-design-bible.md`,
`02-assets-and-art-pipeline.md`, `10-game-trig.md`, `11-game-cell-transport.md`, `12-game-civil-rights.md`,
`20-expedition-architecture.md`, and reference frames `3.png` … `10.png`. Facts were checked against the repo:
fixture `characters`, encounter modes, `answerVars`, and the Kenney pose list in
`.data/asset-scratch/toon-characters.zip`.

**Verdict in one paragraph.** The three game documents are strong. Each one gives every encounter a machine, a
live world link, a visible misconception, a named Verify, a success timeline and a traversal payoff. Each has a
guide with a voice, side content, and 120–134 authored lines. The problem is that they were written **against
three different engine APIs**, and none of them matches `20-expedition-architecture.md`. The architecture is the
only one that is implementable as written (pure metas, a controller, a typed overlay, a phase machine), but its
contract cannot yet express about a third of what the games need:
- the extra speakers;
- exploration scrubbers;
- time-driven simulations;
- hint-driven world actions;
- per-encounter authored data (claim traces, ghosts, item metadata, pins);
- NPC state and quests;
- ambient triggers;
- vertical camera and coordinates;
- jumps and climbs.

Two decisions also work against the user's actual complaint ("the most you do is press A and D"):
- architecture decision 9, "no jump physics", with no replacement explore verbs;
- an art plan of about 630 hand-authored SVG files for a demo on 2026-09-27.

**Do not start the plan until amendments 1–12 are folded into 20-architecture and the three game docs are
re-pointed at it.**

---

## 1 · Contradictions between the architecture and the game docs

### 1.1 Three incompatible contraption/engine APIs

| Concern | 20-architecture | 10-trig | 11-cell | 12-civil |
|---|---|---|---|---|
| Live input type | `Draft {encounterId, modeKey, input, complete, focus, seq}` | `LiveDraft = value \| aim \| order \| probe` | `onDraft(Partial<Input>)` + `HostHandle.setDraft` + `setLiveValue(number)` for scrubbers | `LiveMsg = cursor \| draft \| hint \| verdict` over `setLiveValue(unknown)` |
| Contraption shape | pure `ContraptionMeta` (pose/lerp/describe/panelStatic/panelLive) + Phaser `PoseView` + `Dom` | `ContraptionDef.create → setDraft/setAidTier/playVerdict/setSolved/setDormant` | `model.ts` with `pose(draft, scrub, simState)` and `step(simState, dt, scrub)` | `pose(view, draft, meta, t)` + `failure(focus)` + `success(solution)`; lint on `pose.ts` imports |
| Verdict detail | `diagnose()` in `src/world` → `Diagnosis {wrongKeys, nearMiss, feedback}` | `Verdict` built in GameClient; contraption compares `input` and `solution` inside `playVerdict` | new `firstMiss(params, input)` **exported from each mode file** (mechanics change) | new `Grade.focus?: string[]` **added to 7 modes' `grade()`** (mechanics change) |
| Aid tiers | none | tiers 0/1/2 unlock cards and overlays | hint ≥ 1 turns on Pip's water lens | hint rungs move Wick, open shutters, add hint pins |

The architecture says mechanics are out of scope, while cell and civil each propose a different mechanics
change for the same need. Pick **one**: `diagnose()` in `src/world` (no mode edits), with a parity test (see
Amendment 11). Then rewrite each game doc's "extensions" table against the architecture's types.

### 1.2 Schema fields the games need that `WorldOverlay` lacks

| Need | Where the games use it | Architecture today | Consequence |
|---|---|---|---|
| **Speakers outside `spec.characters`** | trig: brasswick, lumen, quill, mimic, ilse, narrator. Cell: sucra, poro, kay, ferryman, narrator. Civil: otis, hattie, dolores, theo | R2: every `speakerId` ∈ `spec.characters` ∪ {"player"}. `Cast.speakers[].characterId` must be a spec character. Each fixture has exactly 2 characters and is byte-pinned | **About 60 authored lines fail validation.** NPC lines, the mimic voice, Ilse's finale and every narrator card are unrepresentable |
| **Exploration scrubbers** (ungraded orange input with physical units) | cell e1 `d` nm, e3 `a` mM, e4 `s` %, e7 `r` ATP/s, e8 stage `k`, e10 playback `k`. The civil **year cursor on all 12 panels**. The trig `x` probe on e3/e4/e5 | the Scrubber has a "probe rail mode (integer stops)" only; `Draft.input` is the mode's Input | checklist ★21 is unmeetable for 7 of 10 modes as designed |
| **Time-driven simulation** | trig e6 real-time shield + sync thread, and e2 "release replay". Cell e3 random walk, e4 osmotic cell, e7 pump flume. Civil verlet cords and catenary settle | `pose()` is a pure function of `(view, draft, config)`; `PoseView.update(dt)` is "idle animation" only | the sims have nowhere to live that is testable, seeded and resettable |
| Per-encounter authored data | trig `claimTraces`, `stepEffects`, `feedbackNouns`, `probes`. Cell `ghosts`, `simId`, per-item `{glyph, polar, charged, from, to, vehicle}`, per-wave visuals + `showFate`, cartridge semantics, per-step `stageId`. Civil `itemMeta.{printedDate, madeYear, footprint}`, `cursorWindow`, `pinsEarned`, `hintPins`, `misconceptionHeadline` | only `config: z.record(z.string(), z.unknown())`, parsed by `meta.configSchema`, which no meta defines yet | this can work, but only if every meta's `configSchema` is specified **now**, keyed by original index or key (never display order), with validators (see Amendment 13) |
| Dialogue slots | `tutorial`; `hint1–3` (guide-voiced, per rung); `fail.*` by direction (short/past/long); `success2` (the payoff line); fail and success lines spoken by the **boss** rather than the guide | `StationDialogue` = approach / instruction / insight / success / nearMiss / after. The (i) button shows raw fixture hints | the guide never voices hints, and the boss can't taunt on failure |
| Ambient positional lines | trig `s0.01–03`, `s3.01`, `g.01–03`. Cell `s1_walk*`, `zB_arrive`, `zC_arrive`. Civil X01–X10 scene arrivals | NPC lines, approach lines and zone-entry cutscenes only | explore mode goes silent |
| NPC state and quests | Brasswick's arm syncs after e2. Quill rides the satchel. Sucra is escorted across 3 scenes. Kay's 3 lanterns. Theo's thought bubble. Hattie prints front pages | `Npc {x, lines, repeatable}`, static | every micro-quest is unimplementable |
| Purpose meters | cell Gradient Meter 12 → 100 % (it also drives the ambient particle counts). Civil Record Strip earned pins, wall of front pages, 12 Engine lenses. Trig L1 beam lines + 7 dome constellations | ObjectiveRing + `hub` state + `props[].restoredBy` | cell and civil "purpose on screen" collapses to a ring |
| Scenes within zones | each game has **8 scenes**. Civil has 5 lighting zones Z1–Z5, interiors with a cutaway façade, and film-seam wipes. Cell zone C mixes an interior (S5) and an exterior dusk (S6) | `zones` 1–4, one sky/ambient each, entered one at a time | civil can't express its city, and cell's zone C has one sky |
| Coordinates | trig: cumulative x up to 22 300, floor y 3000 → 1100 in one level. Cell: cumulative x up to 29 200. Civil: per-scene x, ground y 900 | `X ≤ 20 000` measured from the zone's left edge; "the world view is 1080 tall"; `frameFor → {scrollX, zoom}` (no scrollY) | the schema rejects cell and trig coordinates, and vertical lifts or rides can't be framed |
| Station geometry | the trig anchor (dial centre) is separate from the console x. The civil Record Lens rail is an accessory on every station | `Station.x` is the console x; "the prefab places the contraption relative to it" | the prefab can't know "the dial sits 500 px right and 300 px up, in the wall" |
| Cutscene verbs | trig intro: the player **winds Cog** mid-cutscene. Civil intro: the player walks down the stair mid-cutscene. Trig finale: the camera pans down the **whole canyon** (every zone). Civil finale: a dawn skyline pull-out | `fade/title/enter_zone/pan/walk/say/wait/station/hub/ride/sfx` | no interactive step, and no cross-zone vista |
| Sandbox interactions | trig Music Box (2 scrubbers, WebAudio). Cell Plant Cell Garden (salt scrub). Civil Darkroom (drag negatives) | none (stations are 1:1 with encounters, R4) | all three "secrets" are unimplementable |
| Map and journal | trig Orrery Map (M) with Terraces/Journal/Mastery tabs. Cell Cell Chart + Logbook + Shards. Civil Record Line map + Clipping Case | Journal (J) = MasteryHud + shards + plaques | the maps are missing |
| Mimic noun | trig: display-only `feedbackNouns` ("chest" → "singer"). Cell: a new `noun` template var in `mimic.ts` (a mode change) | none | pick the display map |

### 1.3 Contraptions a game invents that the library lacks, and binding mismatches

Architecture §4.1 claims to be "the binding the world JSON must encode", but it disagrees with every game doc.
**The game docs are richer and should win**, with the library extended to match.

| Game / enc | 20-architecture §4.1 | Game doc | Fix |
|---|---|---|---|
| trig e1 | `emitter_rail/radian_rail`, `door_opens` | Vesper Dial: arc rail + sin plumb and cos slide gauges + fog + **unit-circle card**; payoff: spoke-ledge spiral **stair** | skin `vesper_dial` with config `{arc: true, gauges: [sin, cos]}`; payoff `stairs_rise`; add a `unit_circle` card |
| trig e4 | `floating_steps`, `stairs_rise` | Solving Span over a 900 px chasm; payoff: **bridge**; card replays via `stepEffects` | `bridge_forms`; `stepEffects` in `step_bridge.configSchema` |
| trig e5 | `treasury_pillars`, `barrier_dissolves` | chest opens + **rim stair** | `stairs_rise` |
| trig e6 | `ring_gate/wardens_shield` (a static-pose skin) | **counter-pendulum sync** against a shield swinging in real time; beat frequency; common-start reset | new archetype `pendulum_sync` (time-driven, §1.2) |
| cell e1, e3, e4, e7 | `claim_holders/specimen_pods`, **board** | Specimen Pods + a **reference apparatus sim** + **ghost overlays** per claim + an exploration scrubber, **scrub** | `claim_holders` gains `referenceSim`, `ghosts[statementIndex]` and `probe`; layout `scrub` |
| cell e8 | `switchboard/pump_rewiring`, board, `lift_rises` | Stepped Machine: link board + **stage scrubber** + charge ledger; jam at the first wrong stage; **gate lifts** | new archetype `stage_machine` (pairs + stage probe), or a `switchboard` config `{stages}`; payoff `door_opens` |
| cell e10 | `step_bridge/endocytosis_lift`, board | Stage Lift: plank rail + **playback scrubber** + cumulative preconditions (`requires`/`effect`) | `step_bridge` config `{stages: [{key, requires, effect}]}` + probe; payoff `vesicle_carries` (down) |
| cell e2, e3, e5, e6, e7, e8, e9 payoffs | `bridge_forms`, `beam_restores`, `door_opens`, `door_opens`, `beam_restores`, `lift_rises`, `barrier_dissolves` | rocker ramp, boom lifts, steps emerge, **door carries you**, gantry lift, gate lifts, barge rises | re-map every row (Amendment 6) |
| cell e5, e9 | layout board | a "Sluice" layout (scrub proportions + valve buttons + timer) | `LayoutMode` has no `sluice`: use `scrub` with a `waves` control |
| civil zones | Morgue e1–e4, Wire Room e5–e8, Stacks e9–e11, Vault e12 | projected **city**: S1 Morgue (no encounters), S2 Courthouse e1–e2, S3 e3, S4 e4–e5, S5 e6, S6 e7–e8, S7 e9, S8 e10–e12 | the architecture table was written from bible §7.3; replace it with the civil doc's scenes |
| civil e1/e4 | `proof_press` | Witness Projector (aimable lamp, projection panels, a pendulum swing variant) | new skin `witness_projector` |
| civil e2, e9 | `timeline_rail` | Walking Road (slabs rise from the flood) / Timeline Bridge (deck bays on an arch, date chips, bay lamps driven by the cursor) | skins `walking_road`, `timeline_bridge`; e9 payoff `bridge_forms` + a streetcar `ride` |
| civil e5, e6, e11 | `pneumatic_board` ×2, `big_board` | Relay Line (catenary wires), Broadcast Relay (**vertical** mast, dishes turn), Big Board (Manhattan tube routing) | three skins of `cause_tubes`; e6 payoff `lift_rises` (up the mast), not `bridge_forms` |
| civil e8, e10 | `tram_departs`, `barrier_dissolves` | the cabinets roll apart onto a stairwell down; the stacks roll apart onto a ladder up | payoffs `descend` / `stairs_rise` |
| civil, every station | one contraption per station | **Record Lens carriage** on a rail, driven by the year cursor, in every scene | `Station.accessories: ["record_lens"]` (Amendment 8) |

### 1.4 Other direct conflicts

- **Jumping.** Architecture decision 9 says "no jump physics; heightfield only". But:
  - trig specifies Space jumps (1.1 H), a jump-tutorial step, wisp ledges reached by jumping, and a Rim
    Gantry of **swinging gear platforms with falls onto a lower walkway**;
  - cell specifies jumps, a crouch-walk and the S7 **moving rail platforms**;
  - civil specifies jump velocity and gravity, and climbs fire escapes, the mast and the rafters to reach the
    negatives.

  Every secret and collectible in the three docs sits behind a jump. The architecture must either restore a
  traversal verb set or the docs must lose their side content (Amendment 2).
- **Characters.**
  - Bible §6.3 says "SVG puppet, shared across games, re-costumed".
  - 02 §3b says Kenney PNG.
  - Trig designs an 18-part **Wren** puppet (A137–A154).
  - Cell uses the **Diver** (Kenney Female adventurer + helmet).
  - Civil uses **Nell** (Kenney Female adventurer + satchel and scarf).

  That is three protagonists on two rigs, against a "shared protagonist" rule. Also, `setTint` multiplies the whole
  sprite, so the specified skin tones (Wren `#A8714F`, Ida "deep brown skin", Ora) **cannot** be produced by
  tinting Kenney frames. The pack ships `Vector/character_*.svg`, so recolour at build time (Amendment 19).
- **World text.**
  - The architecture says all dynamic text is DOM (`WorldLabelLayer`) and bans `<text>` in SVG.
  - Trig says claim plaques are "Phaser text 18 px", and wants π labels, roman numerals and
    "3 sin(π/2 · t)" as **path-text inside SVGs**.
  - Cell says "Phaser text on blank plates".

  Agents cannot hand-write glyph outlines reliably. Use DOM for dynamic text and generate static engraving at
  build time (Amendment 21).
- **Asset namespaces and paths.**

  | Doc | Namespace / keys | Other conventions |
  |---|---|---|
  | bible | `public/assets/variant/` | |
  | 02 and 20 | `public/assets/expedition/<ns>` | 20: keys `ns.group.name`; 02: pivot in px |
  | trig | `orrery_terraces`, ids `A01…` | rasterizes at `{scale: devicePixelRatio}` |
  | cell | `cell.*`, biome `living_cell` | the architecture calls the biome `living_gate` |
  | civil | `archive-city` (**the hyphen fails the `Id`/`AssetKey` regex**), keys `cr.*` | pivot `[x, y]` in px; props rasterized "×2" |
  | 20 | | pivot as a fraction; rasterizes at `min(dpr, 1.5)` |

  Pick one table (Amendment 22).
- **Layout widths.**
  - Bible: scrub panel 40 %, board 55 %.
  - 02: panel 35–40 %.
  - 20: scrub 42vw, board 55vw, full-bleed canvas.
  - 00: grid split.

  The architecture's full-bleed-plus-overlay design is the right one. The game docs quote 0.59 and 0.45
  fractions; they should cite 20 §3.1 instead.
- **Keys.**
  - trig: Info = I, Map = M, Run = Shift, Jump = Space.
  - cell: hints on i or H.
  - 20: J journal, H legend, W portal; no map key.

  One key map is needed (fold into Amendment 2).
- **Line limits.**
  - Game docs: ≤ 140 characters per line.
  - 20: `instruction` ≤ 120, R9 ≤ 24 words, plus "`instruction` must contain `objectNoun`".

  Several game instructions name a *part* rather than the noun ("Swing the carriage…", "Push the probe into the
  membrane…"). Set instruction ≤ 140, and let R9 accept any `skin.nouns` entry *or* an overlay-declared part
  noun.
- **Insight semantics.**
  - Bible: insight = optional second line alongside the instruction, *and* after success it replaces the
    instruction.
  - 20: splits this into `insight` (pre-success, banned from containing answers) and `success`.
  - Trig: "success (insight)" is the post-success truth.

  Say this once in the contract doc: `insight` means the pre-success hint-free truth, `success` means the
  post-success concept statement.
- **R8 false positives.** For `e2_period`, `answerVarsFor` returns the period and answer, both `"π"`; for e6 it
  is `"4"`. Normalized **substring** matching would flag any instruction or pin containing π or a 4. R8 needs
  token-boundary matching (Amendment 34).

---

## 2 · Gaps against the user's goal

### 2.1 The explore layer is still thin, and the architecture makes it thinner

The user's complaint is about **play between the puzzles**, not only about art. The game docs answer it partly:
- trig: the gantry of swinging gears, telescopes, the music box;
- cell: Kay's lanterns, the Plant Garden, rides;
- civil: the darkroom, climbs to the negatives, the bridge crossing.

But:
- Architecture decision 9 removes jumping and replaces it with nothing. Without hops, climbs, moving platforms
  or sandboxes, **every zone becomes an A/D corridor with nicer art**, which is exactly what was rejected.
- Several scenes have no contraption and no verb:
  - cell S7 Vault Road: moving rail platforms, which the architecture can't express;
  - civil S1: a hub with a breaker, fine as a tutorial;
  - trig S0.
- No doc has a per-zone **traversal beat sheet** showing at least two non-walking verbs per zone *other than*
  the payoff itself.

**Minimum fix:**
- authored traversal links: `hop`, `climb`, `drop`, and a `timed_hop` whose availability follows a periodic
  function (this keeps trig's "read the period to cross the gantry" without arcade physics);
- `ride` for moving platforms;
- a `sandbox` interactable (a contraption meta running with no runner);
- at least one micro-quest touch per zone.

### 2.2 Bosses

- **Trig (Warden).** Real-time shield, a wake beat, taunts, a common-start reset, a big-swing trap. Good.
- **Civil (Tumbler Vault).** Vault mode, an evidence matrix, tumblers rotating as the player strikes
  hypotheses, bolts, a press-organ. Good.
- **Cell (Gatekeeper).** **This is e2/e6 with a third bin and a bigger sprite.** It is a single-shot sort of 7
  cards; its only boss-specific touches are the maws opening on focus and a spit-back on failure.

**Fix without touching grading:** stage the 7 cargo items in **three presentation waves** of 2, 2 and 3 (the
panel reveals one batch at a time, with a Gatekeeper line per batch). Maws react to each assignment as claim
renders: the Pump Maw's intake pipe glows and the ATP card hatches; no verdict is shown. The final Input is
unchanged and there is still one `grade()`. The architecture also has **no boss concept**:
- no arena trigger;
- no taunt channel on failure (trig and cell give fail lines to the boss);
- no staged phases.

Add `Station.boss`.

### 2.3 Live binding holes

- **Trig e3/e4/e5.** The orange probe scrubber is explicitly "panel-only, no world change". Half of the trig
  game's orange input moves nothing in the world, against bible rule 4.2.1 and the spirit of ★30. Bind it:
  - e3/e5: the Tuning Lens projects the aimed claim's trace onto the singer's chest slate, with a playhead at
    x and a bell-hum pitch ∝ |f(x)|;
  - e4: a plumb marker rides a small `2 sin x` relief carved along the chasm lip, and crossings with the
    `y = 1` water line glint as the probe passes them.
- **Civil.** The mimic, predict and pairs stations move the world only by aiming. That is acceptable, because the
  Record Lens carriage adds a continuous link.
- **Cell.** All covered.

### 2.4 Hints and aid tiers exist only in the game docs

All three docs make hints **world actions**:
- trig: cards fill in and overlays appear at tiers 1 and 2;
- cell: Pip's water lens shows hydration shells;
- civil: Wick flies to evidence, shutters open, hint pins appear.

The architecture routes (i) to `runner.hint()` plus a dialogue line only. Without an `aidTier` in `PoseInput`,
`PanelLive` and the companion, these can't be built. Define the tier once:
`aidTier = max(hintsUsed, failedVerifies > 0 ? 1 : 0)`, capped at 2.

### 2.5 Leaks before Verify (the architecture's own rule, broken by the docs)

- **Civil e9 Timeline Bridge.** Scrubbing the year cursor lights the bay lamps "in a clean left-to-right sweep"
  only when the order is right. That is a correctness oracle before Verify (brute-forceable: shuffle until the
  sweep is clean). Keep the sweep, since it *is* the lesson, but gate it behind aid tier 1 (H1 or the first
  failed Verify). Before that, lamps light at their dates on the **FILE card only**, without bay mapping.
- **Cell e8.** A cartridge of the wrong kind shows a "?" glyph in its socket. That is a partial verdict. Show a
  neutral "loaded: 1 ATP" label instead, and let the stage playback reveal the physics.
- **Trig e2/e6 and cell sims.** Continuous "how close" feedback is allowed for scrub modes (20 §2.5), so these
  are fine.

### 2.6 Dialogue that reads like a quiz or breaks the fiction

| Line | Problem | Rewrite direction |
|---|---|---|
| civil `e3.A` "…What did the President do?" | a quiz question | "The Guard is holding nine students at the door. The ticker's waiting on Washington's move." |
| cell `e4_approach` "…Something here has to move. What?" | a quiz question | "…The raft won't float until something crosses that window." |
| cell `e9_approach` "Review time, and a barge to catch." | meta, breaks the fiction | "Four cells coming down the Return Sluice, and our barge is sitting on the mud." |
| cell `in09` / trig `intro.11` "Space to jump" | contradicts architecture decision 9 unless Amendment 2 lands | keep only if hops exist |
| cell e1–e7 "quarantine the pod" ×4 | four mimic stations share one verb and kit | the reference apparatus differs, which is good; also vary the **quarantine animation** per apparatus (the ridge thaws, the tank dilates, the raft lock floods, lanterns ignite) and the Verify label |

### 2.7 Other missing pieces

- **Express/demo mode.** Civil totals about 27 minutes of play, and cell and trig are similar. The demo needs
  `?express=1`:
  - open the current panel on arrival;
  - skip explore segments;
  - auto-skip cutscenes after the first line.

  Only civil mentions it.
- **Sound.** Every doc lists cue ids, but `public/audio/` is empty and the architecture puts audio out of scope.
  A 20-cue WebAudio synth (clicks, hums, thunks, chords, whooshes) is about 150 lines, costs no bytes, and does
  more for "fun" than any single art item. Trig already assumes WebAudio for the Music Box.
- **Cross-zone vista.** The trig finale (canyon pan) and the civil finale (dawn skyline) need a composed vista
  asset plus a cutscene step, because zones load one at a time.
- **Fidelity loop measures looks, not fun.** The bible §9 checklist has no item for:
  - explore verbs per zone;
  - time from panel-open to first world reaction;
  - boss staging;
  - "orange input moves a world object in every encounter".

  Add a short game-feel rubric.
- **Generalization gap.** Architecture §6 `WorldSlice` lets the World Writer write nouns and lines only. The
  richness in these docs lives in per-contraption **config** (claim traces, ghosts, item metadata, pins, sim
  params). A PDF-generated game would get `console_slate`-level worlds unless each meta exposes a strict-mode
  `writerConfigSchema` with code validators, such as:
  - ghost honesty (cell §9.3);
  - `printedDate` must appear in the item text (civil §9.3);
  - `claimTraces` must evaluate (trig §9.2).

---

## 3 · Feasibility risks (2D Phaser + React, agent-authored SVG) and fidelity-keeping simplifications

| # | Risk | Evidence | Simplification that keeps fidelity |
|---|---|---|---|
| F1 | **Art volume vs calendar.** The demo is 2026-09-27 (tomorrow) | trig 194 files, cell 204 (182 authored), civil 237 (191 authored): **about 560 agent-authored SVGs**, plus the shared UI | **Procedural SVG kit**: `art/kit/*.ts` generator functions with seeded variation, emitting token-coloured SVG at `art:build`. Candidates: `column()`, `arch()`, `ringStack()`, `brickWall()`, `ashlarWall()`, `crystalCluster()`, `canopyBlob()`, `skyline()`, `cloudBand()`, `bilayerTile()`, `lipidRow()`, `stairs()`, `railing()`, `window()`, `awning()`. Hand-author only hero parts: gates, the Warden, the Gatekeeper, the vault door, the Engine, the pump, the characters' costume overlays. Target: about 60 hand-authored hero SVGs per game, with the rest generated |
| F2 | **Painterly look from flat vector** | agent SVG tends toward clip-art | a global "finish" stack: <br>- a per-layer multiply noise or grain texture; <br>- baked AO gradients at object bases (generator default); <br>- rim-light strokes on upper-left edges; <br>- haze gradients baked into L1/L2; <br>- Phaser Blur on L1/L2/L5; <br>- a camera ColorMatrix grade per zone; <br>- additive glow sprites; <br>- a soft vignette. <br>Lock this on the vertical slice before scaling |
| F3 | **Character recolour** | `setTint` can't recolour selectively | recolour Kenney `Vector/character_*.svg` at build time (fill-map per character: skin, hair, top, trousers, boots), slice poses using the atlas XML, rasterize the HD PNGs. Costume overlays follow **per-frame anchors** (a head/torso/hand table authored once per rig). One rig serves every human character; Wren's puppet is post-demo |
| F4 | **Glyph text in SVG** | π labels, numerals, wordmarks, "DAY", "MAIN", split-flap characters | build-time `opentype.js` text-to-path from one bundled OFL font (`<text data-engrave>` in the source becomes a path at build). Everything dynamic is DOM |
| F5 | **Draw-call budget** | cell: animated heads as separate sprites across about 29 000 px (roughly 650 heads and 1 300 tails). Civil: rain 220 + puddle reflections (a flipped copy of L3/L4) + grain. The budget is ≤ 150 objects per zone | cell: animate heads in a pooled window (±900 px of the camera centre, 60 sprites) over the static tile, and use gel/jitter only near stations. Civil: reflections in 2 scenes only, via a half-resolution RenderTexture updated at 15 Hz; rain at 120 particles |
| F6 | **Simulations in pure metas** | random walk (100 particles), verlet cords, beat-frequency threads | the pure `sim.step` holds only the *measurable* state (concentrations, flux, tracer path, phase). Cosmetic particles and cords live in the prefab (not tested), seeded from `spec.seed` |
| F7 | **DOM fallback parity** | 15 prefabs × `Dom.tsx` (about 120 lines each) | DOM fallback = parallax layers + a **static pose snapshot** (dormant or solved) + the full panel. Animated e2e runs on the swiftshader WebGL project, which the architecture already plans. This saves about 1 800 lines |
| F8 | **Framing giant contraptions in board mode** | civil Big Board 1920×900, bridge 2400, mast 1700 tall; cell pore 960; board mode shows about 860 world px at 1920 wide; min zoom 0.5 | `meta.frameBounds(config)` + a per-station `frameZoom`. Shrink the Big Board to about 1100 wide. Frame the mast on the focused station plus the lift; the bridge frames the crown bays only |
| F9 | **Keyboard capture (D4)** with many new controls (matrix, cables, slots) | every game relies on arrow keys in the panel | keep 20's `disableGlobalCapture` rule plus a WebGL keyboard e2e. Add one per control type, not one per game |
| F10 | **Vertical worlds** | trig level profile spans y 3000 → 1100; lifts of 500 px; the cell vesicle descends 4 H; civil mast +780 px | per-zone heights with a camera Y deadzone. Do not model one continuous canyon: split trig Z1/Z2/Z3 into zones whose rides and lifts are `enter_zone` transitions with a vertical camera tween |
| F11 | **Scope of 15 contraptions + 3 new archetypes** | `pendulum_sync`, `stage_machine`, the stage physics in `step_bridge` | the showcase needs 11 archetypes. Drop `counterweight_lift`, `beam_table`, `glyph_ring` and `pillar_staircase` from the demo (they are not in any fixture); `console_slate` covers them |
| F12 | **Sensitivity (civil)** | Kenney person rigs for fictional staff; no real-person sprites | keep R10. Add a lint that no NPC `name` matches any person named in the fixture text (civil §9.3), and that `photo_withheld` is used for every node or plate describing violence |

---

## 4 · Amendments (prioritized by impact; the file and section to change)

1. **20 §1.3 Cast + §1.5 R2.** Add `cast.extras[] {id, name, voiceArchetype, emblem, portrait|null}` and resolve
   `speakerId` against `spec.characters ∪ cast.extras ∪ {player, narrator}`. This unblocks about 60 lines in the
   three docs.
2. **20 §0 decision 9, §1.3 Zone, §2.4.** Replace "no jump physics" with authored **traversal links**:
   - `Zone.links[] {kind: hop|climb|drop|ladder|timed_hop|ride, from, to, requires?, period?}`: Space or W runs a
     scripted arc or climb;
   - `timed_hop` is open only in a phase window (the trig gantry);
   - `ride` replaces moving platforms (cell S7).

   Publish one key map. Update the traversal sections of trig §2.6/§3.1, cell §2.5/§3.1 and civil §2.6/§3.1 to use
   only these verbs.
3. **20 §2.5 + §3.3 + §3.4.** Add the **probe channel**:
   - `ProbeSpec {symbol, label, min, max, step, unit, format, window?}` in the contraption config;
   - `Draft.probe: number|null` and `PoseInput.probe`;
   - the Scrubber binds to the probe whenever the mode Input is not scalar.

   Point cell R4 (the X2 extension), the civil year cursor (A1 `cursor`) and the trig `probe` at it.
4. **20 §2.5 ContraptionMeta.** Add time and simulation:
   - `PoseInput.t` (seconds since the panel opened or the arena was triggered, resettable);
   - optional `sim {init(seed, config), step(state, dt, input, probe)}`, pure and seeded;
   - `pose` receives the sim state.

   Needed by trig e2 replay and e6 shield, and cell e3, e4 and e7.
5. **20 §4 table + §4.1 bindings.** Rewrite §4.1 from the game docs (the §1.3 table above). Add archetypes
   `pendulum_sync` (trig e6) and `stage_machine` (cell e8). Add the skins `vesper_dial`, `witness_projector`,
   `walking_road`, `timeline_bridge`, `relay_line`, `broadcast_relay`, `provenance_drawers` and `stage_lift`.
   Replace the civil zone list with its 8 scenes.
6. **20 §1.3 Payoff.** Generalize `PayoffKind` to `{kind: terrain|ride|remove_blocker|carry, vertical:
   up|down|none, noun}`, or add `ramp_forms`, `descend`, `water_rises` and `door_carries`. Re-map every cell and
   civil payoff, and base the W1 vertical rule on `vertical`.
7. **20 §2.5 CardModel + §3.2 components.** Add card kinds:
   - `unit_circle`;
   - `bars` (gauges + sparkline + timer line);
   - `schematic` (a pose-driven cross-section);
   - `link_board`;
   - `claims` (a claim column with aim sockets);
   - `slot_rail`;
   - `matrix` (the evidence matrix);
   - `energy_cells`.

   Extend `GraphCard` with annotations: brackets, shaded regions, period markers, dashed and ghost plots, live
   dots, a caption.
8. **20 §1.3 Station.** Split `x` into `consoleX` + `anchor {x, y}`. Add `accessories[]` (civil `record_lens`
   rail), `frameZoom|null`, and `boss {arenaTriggerX, arenaCutsceneId, phases[] (presentation batches),
   taunts {approach[], fail[]}}`.
9. **20 §1.3 StationDialogue.** Add `tutorial`, `hints[3]` (guide-voiced; the Brief tab still shows the fixture
   hints verbatim), `fail {default, byKey[]}`, `payoffLine` (trig `success2`), and `speakerId` per slot. Raise
   `instruction` to 140 characters. Relax the R9 noun rule to "`objectNoun`, a skin noun, or a declared part
   noun". Define `insight` vs `success` once.
10. **20 §2.5 PoseInput/PanelLive + §2.7 + HostHandle.** Add hint-driven world actions:
    - `aidTier` in `PoseInput`, `panelStatic` and `panelLive`;
    - `HostHandle.onHint(encId, rung)`;
    - `meta.hintTargets(rung)` so the companion (Cog, Pip, Wick) flies to a named anchor.

    Tier rule: `max(hintsUsed, failedVerify ? 1 : 0)`.
11. **20 §2.5 Diagnosis + cell §5.0 R5/X3/X8 + civil §5.0.1/A3.** Make `src/world/diagnose.ts` the only source of
    `wrongKeys` (no `Grade.focus`, no `firstMiss` export, no mode edits). Add a parity test: for sampled wrong
    inputs, the text of the first wrong item appears in `grade().feedback`. Add overlay `probes[] {predicate:
    nearValue|keyInSlot|decoyPresent|aimedIndex|linkedTo, arg, key}` evaluated only after Verify (trig §5.0.7).
12. **20 §7.1/§7.2 + a new "Demo cut" section.** For 2026-09-27, define per game:
    - **P0**: every station fully built + intro and finale + zone 1 at full art; other zones use kit-generated
      layers and one hero landmark;
    - **P1**: side quests (one per game);
    - **P2**: maps and secrets.

    Add `?express=1`. Move the vertical-slice gate to "trig S1–S2 by midday".
13. **20 §4 + §6.2.** Specify every showcase meta's `configSchema` now, keyed by `statementIndex` or item key
    (never display order):
    - trig `claimTraces`, `stepEffects`;
    - cell `ghosts`, `referenceSim`, `items`, `waves`, `rights`, `stages`;
    - civil `itemMeta`, `footprints`, `pinsEarned`, `hintPins`.

    Give each a strict-mode `writerConfigSchema` and code validators (ghost honesty, printed dates present in the
    text, expressions evaluate), so the World Writer can reach this fidelity on PDF games.
14. **02 §3a + 20 §5.** Add the **procedural SVG kit** (`art/kit/*.ts` generators, seeded, token-coloured,
    emitted by `art:build`). Cap hand-authored SVG at about 60 hero parts per biome. Re-tag each game doc's
    asset list as `kit:<generator>` or `hero`.
15. **20 §1.3 WorldOverlay.** Add `triggers[] {zoneId, x, radius, lines, once, requires?}` for ambient explore
    lines and scene arrivals (trig `s0.*`, `g.*`; cell `s1_walk*`, `zB_arrive`; civil X01–X10).
16. **20 §1.3 Npc + a new `quests[]`.** Add `Npc.states[] {requires {solved?|flag?}, zoneId, x, lines, pose,
    follow?: player|satchel}` and `quests[] {id, steps: talk|collect(ids)|touch(ids)|afterSeal(enc), reward}`.
    Covers Brasswick, Quill, Sucra, Kay, Theo and Hattie.
17. **20 §1.3 + new §2.4b.** Add a `sandbox` interactable: a contraption meta with no runner, no Verify and no
    grade. It covers the Music Box, the Plant Cell Garden and the Darkroom. Require at least one sandbox or quest
    touch per zone.
18. **cell §5.11.** Stage the Gatekeeper as a boss:
    - three presentation waves (2 + 2 + 3 cargo), with a taunt per wave and maw claim-renders;
    - the ATP pipe surges;
    - the eye-ring tracks the cargo.

    One Input and one `grade()`. Mirror this in 20 as `Station.boss.phases`.
19. **02 §3b + bible §6.3 + 20 §5.2 + trig §3.1/§7.13 + cell §3.1 + civil §3.1/§7.10.** Use one human rig:
    Kenney HD frames **recoloured from `Vector/*.svg` at build time** per character, plus per-frame costume
    anchors (`ManifestEntry.frames[].anchors`). Wren's 18-part puppet moves to post-demo, and "shared
    protagonist" stays true across games.
20. **20 §1.3 coordinates + §2.2 framing + camera-director.** Use per-zone coordinates, `Zone.height`,
    `frameFor → {scrollX, scrollY, zoom}` and a Y-follow deadzone. Convert trig §2.6 (cumulative y 3000 → 1100)
    and the cumulative x in cell §2.5 and trig §2.7 into per-zone values. Make lifts, rides and the vesicle
    zone transitions with vertical camera tweens.
21. **20 §5.3 + trig §7/§7.15 + cell §7 + civil §7.** Handle glyphs with build-time `opentype.js`
    text-to-path (`<text data-engrave>`). Every dynamic label (plaque text, chips, split-flap characters, tape)
    goes through `WorldLabelLayer`. Delete "Phaser text" from all three docs.
22. **20 §5.1 + bible §6.1 + trig §7.1 + cell §7 + civil §7.** Use one naming table:
    - namespaces `orrery_terraces`, `living_gate`, `archive_of_voices`;
    - keys `ns.group.name`;
    - pivots as fractions;
    - rasterization `rasterScale × min(dpr, 1.5)`.

    Retire `variant/`, `cell/`, `archive-city` and the `cr.*`, `cell.*` and `A###` ids.
23. **20 §1.3 Zone.** Add `segments[] {x0, x1, sky, ambient, weather, layerSet}` with a 1 s crossfade, plus
    `interiors[] {x0, x1, facadeAsset}` (cutaway), or raise the zone maximum to 8. Required for the civil
    Z1–Z5 lighting and seam wipes, and for the cell S5/S6 split.
24. **20 §1.3 Story + HUD §2.6.** Add `meter {label, start, perEncounter[]}` (cell Gradient; it also feeds the
    ambient-particle driver), `progressEffects` (L1 beam lines, lenses, constellations, the front-page wall), and
    a generic `MapOverlay {style, stations}` + `JournalReader` (trig pages, cell logbook, civil clipping case).
    Add `Collectible.kind`.
25. **20 §1.3 CutsceneStep.** Add `await_interact`, `control_until {x}`, `vista {asset, pan}`,
    `set_state {target, state}` and `camera {y, zoom}`. Needed by the trig intro wind and the civil stair descent
    (interactive steps), and by the finale pull-outs.
26. **civil §5.9 + cell §5.8 + 20 §2.5 live-reveal test.**
    - Gate the e9 bay-lamp sweep behind aid tier 1.
    - Replace e8's "?" glyph with a neutral "loaded" label.
    - Extend the discrete no-leak test from `describe()` to `panelLive()` and the world lamps.
27. **trig §5.3/§5.4/§5.5.** Bind the probe scrubber to the world: the Tuning Lens projects the claim trace and
    playhead onto the singer's slate, with bell pitch ∝ |f(x)|; on e4, the chasm-lip relief marker and crossing
    glints. Without this, 3 of 6 trig encounters have an orange input that moves nothing in the world.
28. **All three game docs, a new §2.x "Traversal beat sheet".** For each zone, list at least two non-walk verbs
    beyond the payoff (hop, climb, ride, timed hop, sandbox, quest touch) and where they sit. Cell S7 becomes
    ride links plus the viewpoint detour; civil S2 and S4 get climb links to the negatives.
29. **bible §9 + 20 §8.3.** Add game-feel checklist items:
    - (37) ≥ 2 non-walk verbs per zone;
    - (38) the orange input moves a world object in every encounter;
    - (39) the boss has staged presentation;
    - (40) hints act in the world;
    - (41) the first world reaction comes within 150 ms of panel input.

    The critic scores these alongside 1–36.
30. **20 §2.11 + cell §2.4/§7.5.** Set per-game performance plans:
    - cell: a pooled lipid-head window (60 sprites) over the static tile;
    - civil: reflections in 2 scenes via a half-resolution RenderTexture, and rain at 120;
    - trig: star field ≤ 140 points baked into one texture.

    Enforce with the fps capture.
31. **20 §2.2 DOM host.** Reduce `Dom.tsx` per prefab to static dormant or solved snapshots plus the full panel,
    and rely on the swiftshader WebGL project for animated e2e.
32. **20 §4 + F8.** Add `meta.frameBounds(config)` and a `Station.frameZoom` override. Resize the civil Big
    Board to ≤ 1100 wide, and frame the mast on the focused station.
33. **20 §3.3 controls.**
    - `AimControl` emits a draft on hover and focus (not only on select).
    - `WaveControl` gets Verify-after-last-wave plus preselected retry (cell X4).
    - Add a `MatrixControl` for elimination whose marks are UI-only (civil e12).
    - Drop `sluice` as a layout (use `scrub`).
34. **20 §1.5 R8.** Use token-boundary matching for short banned values (`π`, `4`), and exempt `hints[2]`,
    `success`, `payoffLine` and `after`. Add a negative test for trig `e2.approach` ("sin(2t)" must pass).
35. **20 §2.6/§2.7 + new `audio/synth.ts`.** Add a procedural WebAudio cue bank (about 20 cues from the game
    docs' ids), muted under `AUDIO_MODE=off` in tests, on in the demo, with a mute toggle. It satisfies the
    "sound hook" in ★34 and adds feel cheaply.
36. **20 §1.3 overlay.** Add `feedbackNouns[] {from, to}` (display-only, as in trig §5.0.9) and drop cell X8 (the
    mode `noun` var).
37. **cell §4.3, civil §4.4.** Rewrite the quiz-voiced and fourth-wall lines (civil `e3.A`; cell `e4_approach`,
    `e9_approach`, and `in09` if hops are cut), and vary the four cell quarantine payoff animations and their
    Verify labels.
38. **20 §4 scope.** Mark `counterweight_lift`, `beam_table`, `glyph_ring` and `pillar_staircase` as
    post-demo; `console_slate` covers their modes. Reassign that effort to `pendulum_sync` and `stage_machine`.
39. **20 §6.3 autoWorld.** Once Amendment 13 lands, `autoWorld` should fill `configSchema` defaults: text-only
    ghosts, evidence cards from `sourceRef.quote`, and item metadata parsed from dates in the item text. Otherwise
    generated games fall back to `console_slate`-level worlds even when a native archetype exists.
40. **00 §3.3 + 20 §1.2.** Record the decision that `fixtures/worlds/*.world.json` is the only overlay location
    (not `src/game/worlds/*.ts` as civil A13 suggests), and add a test that the three side-cars and their
    `appliesTo` keys resolve for both the fixture ids and the mock-generated specs.
