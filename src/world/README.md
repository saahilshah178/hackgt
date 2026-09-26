# src/world — the pure Expedition library

W0 (item M0 of docs/design/20-expedition-architecture.md §7.2, revision 3) created this directory. It is the **pure**
half of the Expedition layer: contracts in use, contraption metas and configs, sims, drafts, geometry, the asset
index and the rev-3 seams. Validators, the pipeline, Vitest (node), React and Phaser all import it.

## Rules every lane follows here

- **Pure.** No Phaser, no React, no Next, not even as types (ESLint `@typescript-eslint/no-restricted-imports` on
  `src/world/**`). Relative imports only. No `fs`, no DOM, no `Math.random`, no `Date.now` in library code.
- **Metas never see params or solutions at runtime** (§2.5.6). `src/world/contraptions/**` and `src/world/sandboxes/**`
  may not import mechanics modes, the mechanics registry or `src/world/library.ts` at runtime (type imports are
  fine; `src/mechanics/util.ts` is allowed for `evalExact` / `evalExactAt`). Only `validateConfig`,
  `defaultConfig` and `fromWriterConfig` receive a `ConfigCtx` with the solution, and they run only in validators,
  the pipeline and tests.
- **Main-only files** (§7.0): `types.ts`, `library.ts`, `draft-inputs.ts`, `contraptions/config-parts.ts`,
  `contraptions/*.config.ts`, `sandboxes/*.config.ts`, `sims/index.ts`, `asset-index/index.ts`. A lane that needs a
  change there reports the exact diff to main. `writer-kit.ts`, `skin-kit.ts` and `placeholder.ts` are W0 helpers
  (main-owned too); `placeholder.ts` disappears once every meta is native.
- **Stubs are seams, not decoys.** Every file below exists so no two lanes create the same path. When your lane owns
  a stub (a meta's live half, a sim, `record-strip.ts`, `residency.ts`, `hint-targets.ts`), keep its exported names
  and signatures; everything else is yours to rewrite.

## Who owns what after W0 (§7.3)

| Path | Owner from T0 + 2 |
|---|---|
| `contraptions/{claim-holders,step-bridge,emitter-rail,ring-gate,pendulum-sync}.meta.ts`, `sims/pendulum-beat.ts` | KA (L6) |
| `contraptions/{router-lanes,sluice-waves,stage-machine}.meta.ts`, `sims/{bilayer-probe,diffusion-tank,osmotic-cell,pump-flume,membrane-fold}.ts` | KB (L7) |
| `contraptions/{oracle-ticker,cause-tubes,switchboard,tumbler-vault}.meta.ts`, `record-strip.ts` | KC (L8) |
| `contraptions/console-slate.meta.ts` | H1 (L2) |
| `hint-targets.ts` (+ `validate-world`, `resolve-world`, `diagnose/**`, `probes`, `fail-line`, `feedback-nouns`, `config-validators`, `date-parse`, `speakers`, `biomes`) | V1 (L1) |
| `state/**` | S1 (L4) |
| `residency.ts` | A1 (L5) |
| `graph-math.ts` | P1 (L3) |
| `sandboxes/*.meta.ts` | SB (after the P0 freeze) |
| everything else here | main |

## What a meta lane does with its stub

Each `<id>.meta.ts` already exports the **real** configuration half: the skins (§4.3, incl. the rev-3 slots), the
compatibility lists (modes, layouts, payoffs, near-miss keys, accessories, control), `configSchema` (from
`<id>.config.ts`, §4.2 verbatim), `validateConfig` (§4.4 table; all 33 station configs copied from the game docs pass
it with zero issues, see `tests/world-doc-configs.json`), `defaultConfig`, `writerConfigSchema` (strict-mode audited in
`tests/strict-schemas.test.ts`) and `fromWriterConfig`. The live half (`pose`, `lerp`, `describe`, panels, hint
targets, audio, plans, `solvedPose`, `debug`, `probe`, `clock`, `sim`, `footprint`, `frameBounds`) is
`...slateLive(SKINS, probeOf)` from `placeholder.ts`. Replace that spread with the real functions, redefine the
exported `<X>Pose` type (skins import it by name), and keep every other export.

## Doc shorthands

- Civil `"probe": "YEAR(min, max)"` expands to `{symbol: "YEAR", label: "record year", min, max, step: 0.0833333333,
  unit: "", format: "month_year", initial: null, stops: [], window: {start: min, end: max}, playback: false}` (civil §5,
  "How to read the station sections"); `contraptions/config-parts.ts` `yearProbeFor(years)` builds the same shape.

## Export index (generated from the source; every export a lane can rely on)

### Core types, drafts, math

#### `aid-tier.ts` (23 lines)

| Export | Kind | Purpose |
|---|---|---|
| `aidTierOf` | function | The one definition of the aid tier (docs/design/20 §2.5.1, amendment 10): |
| `toHintsUsed` | function | Clamps any count to the HintsUsed range (the runner's hint counter can be read as a plain number). |
| `tierUnlocked` | function | True when a card or overlay gated at tier is unlocked at current. |

#### `draft-inputs.ts` (307 lines)

| Export | Kind | Purpose |
|---|---|---|
| `DRAFT_MODE_KEYS` | const | the 11 modes with a native DraftInputs shape |
| `isDraftMode` | function | type guard for DRAFT_MODE_KEYS |
| `modeKeyOf` | function | "tuner.oscillator" from an encounter's familyId and mode. |
| `DraftIncompleteError` | class | Thrown by toSubmitInput when the draft cannot yet be graded (Verify must stay disabled). |
| `dialToInput` | function | = Dial.dialToInput |
| `numberLineToInput` | function | = Place.numberLineToInput |
| `chestsToInput` | function | = Pick.chestsToInput |
| `optionsToInput` | function | = Pick.optionsToInput |
| `placedToInput` | function | = Order.placedToInput |
| `assignmentsToInput` | function | = Sort.assignmentsToInput (item → bin map, insertion order) |
| `wavesToInput` | function | = Pick.wavesToInput (a wave with no answer is simply left out) |
| `pairsToInput` | function | = Link.pairsToInput (left → right map, insertion order) |
| `chainToInput` | function | = Link.chainToInput (from → to map, insertion order) |
| `eliminationToInput` | function | = Link.eliminationToInput |
| `toSubmitInput` | function | The mode's exact Input from a control's draft input. |
| `isDraftComplete` | function | View-aware completeness for the draft modes (what enables Verify). |
| `fromSubmitInput` | function | The inverse of toSubmitInput for the draft modes: |
| `emptyDraftInput` | function | The untouched control state for a draft mode (scalar modes start at the dial/line minimum from the view). |
| `makeDraft` | function | A Draft with every UI channel at rest; |

#### `ease.ts` (79 lines)

| Export | Kind | Purpose |
|---|---|---|
| `CONTROLLER_TAU_MS` | const | Easing and interpolation helpers shared by metas (lerp), the ContraptionController (eased poses) and cutscenes. |
| `EaseName` | type | type: easing curve names |
| `EASE` | const | easing curve table |
| `clamp` | function | clamp to [lo, hi] |
| `clamp01` | function | clamp to [0, 1] |
| `ease` | function | Eased progress in [0, 1] (input clamped). |
| `lerp` | function | linear interpolation |
| `lerpAngle` | function | Shortest-path angle interpolation (radians). |
| `snap` | function | Discrete fields snap to to once t ≥ threshold (ContraptionMeta.lerp contract). |
| `smoothingFactor` | function | Per-frame smoothing factor 1 − e^(−dt/τ); |
| `approach` | function | Moves from toward to by one smoothing step. |
| `lerpRecord` | function | Generic pose lerp for flat records: |

#### `geom.ts` (128 lines)

| Export | Kind | Purpose |
|---|---|---|
| `Vec2` | type | Small, pure geometry helpers in zone units (x right, y DOWN, docs/design/20 §1.3 conventions). |
| `Rect` | type | type: {x, y, w, h} |
| `PolyPoint` | type | type: [x, y] |
| `vec` | function | make a Vec2 |
| `add` | function | Vec2 add |
| `sub` | function | Vec2 subtract |
| `dist` | function | Vec2 distance |
| `deg` | function | radians → degrees |
| `rad` | function | degrees → radians |
| `wrapAngle` | function | Wraps an angle into (−π, π]. |
| `pointOnCircle` | function | Point on a circle with y DOWN: |
| `rect` | function | make a Rect |
| `rectRight` | function | x + w |
| `rectBottom` | function | y + h |
| `rectCenter` | function | centre point |
| `translateRect` | function | move a Rect |
| `inflateRect` | function | grow a Rect |
| `rectUnion` | function | bounding Rect of two |
| `rectContainsPoint` | function | point-in-rect |
| `rectContainsRect` | function | True when inner lies entirely inside outer (edges may touch). |
| `rectsIntersect` | function | rect overlap |
| `isStrictlyAscending` | function | True when the polyline's x values strictly increase (heightfields, platforms). |
| `polylineSpan` | function | [first x, last x] of a polyline, or null when empty. |
| `polylineYAt` | function | y on an x-ascending polyline at x (linear interpolation); |
| `pointAlong` | function | Point at arc-length fraction u ∈ [0, 1] along a polyline (record_lens rails, ride paths). |

#### `types.ts` (710 lines)

| Export | Kind | Purpose |
|---|---|---|
| `HintTarget` | re-export | re-export from ../contracts/world |
| `ModeKey` | type | "tuner.oscillator": |
| `AidTier` | type | 0 | 1 | 2 |
| `HintsUsed` | type | 0 | 1 | 2 | 3 |
| `HintRung` | type | 1 | 2 | 3 |
| `OscillatorView` | type | Metas read views only through these shapes; |
| `FormulaView` | type | view mirror: tuner.formula |
| `NumberLineView` | type | view mirror: mapper.number_line |
| `MimicView` | type | view mirror: truth_finder.mimic |
| `PredictRevealView` | type | view mirror: truth_finder.predict_reveal |
| `LinearView` | type | view mirror: sequencer.linear |
| `BinsView` | type | view mirror: sorter.bins |
| `TypeMatchView` | type | view mirror: sorter.type_match |
| `PairsView` | type | view mirror: linker.pairs |
| `ChainView` | type | view mirror: linker.chain |
| `EliminationView` | type | view mirror: investigator.elimination |
| `ShowcaseViews` | type | mode key → view mirror |
| `DraftInputs` | type | Draft-input shapes per mode: |
| `DraftModeKey` | type | The modes with a native DraftInputs shape (every other implemented mode drafts through its widget). |
| `Draft` | type | Live, possibly partial player input plus the UI-only channels. |
| `PoseInput` | type | ================================================================ pose inputs, sims |
| `StaticInput` | type | the static half of PoseInput + skinId + record (panelStatic/hintTargets input) |
| `SimParams` | type | Numeric parameters a reference sim takes from its station config (ClaimHoldersConfig.referenceSim.params). |
| `SimCtx` | type | sim step context |
| `SimSpec` | type | Pure, seeded, fixed-step simulation (amendment 4). |
| `FnColor` | type | ================================================================ describe, skins, plans |
| `ChipSpec` | type | "g(T): |
| `PinSpec` | type | world pin |
| `Described` | type | describe() output: chips, pins, srText, nearMiss |
| `SnapshotPart` | type | DOM snapshot part |
| `HintTargetTable` | type | One list of companion targets per hint rung (index 0 = rung 1). |
| `SkinPart` | type | one skin part slot |
| `ContraptionSkin` | type | a skin: parts, anchors, console, snapshot, cues, hintTargets |
| `FailAction` | type | failure beat actions |
| `FailBeat` | type | one failure beat |
| `FailurePlan` | type | failure plan (600–1600 ms) |
| `SuccessAction` | type | success beat actions |
| `SuccessBeat` | type | one success beat |
| `SuccessPlan` | type | success plan (1200–2500 ms) |
| `ConfigCtx` | type | validator/default context (reads params+solution; server/tests only) |
| `WriterCtx` | type | writer-schema context |
| `ConfigIssue` | type | a validateConfig issue |
| `AudioParam` | type | continuous loops (bell hum ∝ /f(x)/) |
| `ControlKind` | type | panel control kind per meta |
| `ClockResetOn` | type | station clock reset events |
| `Footprint2D` | type | footprint around the console |
| `Bounds` | type | frame bounds relative to the anchor |
| `ContraptionMeta` | type | The PURE half of a contraption. |
| `AnyContraptionMeta` | type | eslint-disable-next-line @typescript-eslint/no-explicit-any |
| `Tick` | type | ================================================================ panel models (§2.5.2) |
| `AxisModel` | type | card axis model |
| `PlotModel` | type | card plot model |
| `GraphAnnotation` | type | GraphCard annotations (amendment 7). |
| `SchematicPrim` | type | schematic card primitive |
| `CardModel` | type | the 12 panel card models |
| `CardKind` | type | type: card kind |
| `PanelStatic` | type | panel static model (cards, input, probe, recordPins) |
| `PanelLive` | type | panel live model (scrubX, readout, chips, highlights, liveCards) |
| `PanelContext` | type | What the client tells the panel about the whole game (A6). |
| `FailKey` | type | ================================================================ diagnosis (§2.5.4, amendment 11) |
| `FAIL_KEYS` | const | every FailKey |
| `Diagnosis` | type | the single source of failure detail |
| `DiagnoseArgs` | type | diagnose() arguments (B1/V1 implements) |
| `SandboxInput` | type | ================================================================ sandboxes (§2.5.5, amendment 17) |
| `SandboxDraft` | type | sandbox draft |
| `SandboxHistory` | type | sandbox goal history |
| `SandboxPoseInput` | type | sandbox pose input |
| `SandboxMeta` | type | the pure half of a sandbox |
| `AnySandboxMeta` | type | eslint-disable-next-line @typescript-eslint/no-explicit-any |
| `WorldSource` | type | ================================================================ resolved world (§1.5; |
| `SpeakerInfo` | type | a resolved speaker |
| `SpeakerDirectory` | type | id → speaker; |
| `ResolvedStation` | type | Station + index, meta, parsedConfig, layout, probe |
| `ResolvedSandbox` | type | Sandbox + meta + parsedConfig |
| `ResolvedWorld` | type | the client-side resolved world (V1's resolveWorld builds it) |
| `WorldState` | type | ================================================================ world state (§2.4.6; |
| `WorldStateEvent` | type | world-state reducer events |
| `ReqCtx` | type | requirement context |
| `WorldStateApi` | type | Signatures S1 implements (state/world-state.ts, npc-state.ts, quests.ts, requirements.ts). |
| `GroundTemplate` | type | ================================================================ biome kits (§6.4; |
| `BiomeKit` | type | a biome kit (V1's BIOME_KITS implements; successPose) |
| `WORLD_RULE_IDS` | const | ================================================================ validateWorld rule ids (§1.5; |
| `WorldRuleId` | type | type: R1…R16, W1…W3 |
| `WORLD_RULES` | const | One line per rule; |
| `ValidateWorldResult` | type | validateWorld(spec, world) returns the same split validateGameSpec uses; |

### Library and seams

#### `hint-targets.ts` (17 lines)

| Export | Kind | Purpose |
|---|---|---|
| `hintTargetsFor` | function | the one resolution rule: st.hintTargets?.[rung − 1] ?? meta.hintTargets(rung, input) |

#### `library.ts` (161 lines)

| Export | Kind | Purpose |
|---|---|---|
| `ARCHETYPE_IDS` | const | The 13 demo archetype ids, in §4 table order. |
| `ArchetypeId` | type | type: the 13 archetype ids |
| `SANDBOX_IDS` | const | The 3 sandbox ids (§2.4b). |
| `SandboxId` | type | type: the 3 sandbox ids |
| `POST_DEMO_ARCHETYPE_IDS` | const | §4 rows 14–17: |
| `implementedModeKeys` | function | Every implemented family·mode key, from the mechanics registry. |
| `CONTRAPTION_LIBRARY` | const | archetype id → meta (console_slate carries every implemented mode) |
| `SANDBOX_LIBRARY` | const | sandbox id → SandboxMeta |
| `isArchetypeId` | function | type guard |
| `isSandboxId` | function | type guard |
| `getContraption` | function | meta by id (undefined when unknown) |
| `getSandbox` | function | sandbox meta by id |
| `skinOf` | function | a meta's skin by id |
| `allSkins` | function | Every skin of every contraption and sandbox (art contract listings, asset tests). |
| `contraptionsForMode` | function | Contraptions whose meta.modes include the mode: |
| `AUTO_ARCHETYPE_BY_MODE` | const | autoWorld's archetype per mode (§4.4). |
| `contraptionFor` | function | The contraption autoWorld and the fallback ladder use for a mode: |
| `configCtxFor` | function | ConfigCtx for one encounter of a spec (validators, defaults, fromWriterConfig; |
| `writerCtxFor` | function | WriterCtx for one encounter (the World Writer menu, §6.2). |

#### `record-strip.ts` (57 lines)

| Export | Kind | Purpose |
|---|---|---|
| `TimelineCard` | type | type: the timeline CardModel variant |
| `recordCard` | function | RECORD = the earned pins of solved encounters (spanTo → a band) + the meta's recordPins; |
| `lensTarget` | function | Where the record_lens carriage sits on its rail for a probe value inside the window (fractional years). |

#### `residency.ts` (89 lines)

| Export | Kind | Purpose |
|---|---|---|
| `assetsForZone` | function | Every asset key the zone references: |

### Contraption helpers

#### `contraptions/config-parts.ts` (319 lines)

| Export | Kind | Purpose |
|---|---|---|
| `Tier` | const + type | ---------------------------------------------------------------- §4.2 primitives |
| `Expr` | const + type | exact mathjs expression; |
| `ItemKey` | const + type | i0, s2, d0, l1, r3, x0, n4 |
| `ClaimTrace` | const + type | zod: a claim drawn literally (fns, brackets, markers) |
| `Footprint` | const + type | zod: a history claim's FILE-card footprint |
| `ItemMeta` | const + type | zod: per-item printedDate/madeYear/glyph/label |
| `HintPin` | const + type | zod: a RECORD hint pin per rung |
| `FileDate` | const + type | zod: a FILE-card date |
| `ProbeSpec` | re-export | re-export from  |
| `err` | function | ---------------------------------------------------------------- issues |
| `warn` | function | ConfigIssue helper (warning) |
| `hasErrors` | function | true when any ConfigIssue is an error |
| `coverExactlyOnce` | function | Every expected key exactly once in got (keyed configs, §4.2: |
| `subsetOf` | function | Every key in got exists in allowed (subsets are fine). |
| `probeRangeIssues` | function | ProbeSpec sanity checks (min<max, initial, window) |
| `exprValue` | function | ---------------------------------------------------------------- expressions (evalExactAt, §4.4) |
| `exprSampleRatio` | function | Fraction of n evenly spaced samples over [x0, x1] where expr (free symbol x) is a finite number. |
| `exprEvaluatesOver` | function | True when expr evaluates at ≥ minRatio of 64 samples over [x0, x1] (claim traces: |
| `MONTH_NAMES` | const | ---------------------------------------------------------------- dates in texts (§4.4 date rule) |
| `DateParts` | type | type: {year, month, day} |
| `dateParts` | function | parse a DateString |
| `datePrecision` | function | year | month | day of a DateString |
| `fracYearOf` | function | Fractional year: |
| `dateAppearsIn` | function | The §4.4 date rule: |
| `yearAppearsIn` | function | The year (±slack, for "within the year" footprints) appears in some text. |
| `findYears` | function | Four-digit years 1000–2099 mentioned in a text, in order of appearance, de-duplicated. |
| `findDates` | function | Dates a text states, most precise form first per mention: |
| `yearProbeFor` | function | A year probe (history stations) whose window spans the given years ± 1. |
| `viewRows` | function | Keyed rows of a view list: |
| `statementIndicesOf` | const | view reader: mimic statement indices |
| `optionIndicesOf` | const | view reader: predict_reveal option indices |
| `plankKeysOf` | const | view reader: linear plank keys |
| `itemKeysOf` | const | view reader: bins item keys |
| `binIdsOf` | const | view reader: bins bin ids |
| `waveIndicesOf` | const | view reader: type_match wave indices |
| `categoryIdsOf` | const | view reader: type_match category ids |
| `leftKeysOf` | const | view reader: pairs left keys |
| `rightKeysOf` | const | view reader: pairs right keys (decoys x*) |
| `nodeKeysOf` | const | view reader: chain node keys |
| `hypothesisIdsOf` | const | view reader: elimination hypothesis ids |
| `clueIndicesOf` | const | view reader: elimination clue indices |
| `viewTextOf` | function | The display text for a keyed row in any of the showcase views ("" when absent). |
| `clueTextOf` | function | view reader: clue text by index |
| `writerItemKeys` | function | The item keys a writer schema enumerates and probes reference, per mode (WriterCtx.itemKeys): |
| `stringsIn` | function | Every string inside a value (params walk for ConfigCtx.texts). |
| `encounterTexts` | function | ConfigCtx.texts for an encounter: |

#### `contraptions/placeholder.ts` (108 lines)

| Export | Kind | Purpose |
|---|---|---|
| `SlatePose` | type | The console-slate pose: |
| `SLATE_FOOTPRINT` | const | placeholder footprint |
| `SLATE_FRAME` | const | placeholder frame bounds |
| `slatePose` | function | placeholder pose from a PoseInput |
| `slateDescribe` | function | placeholder describe() |
| `EMPTY_PANEL_STATIC` | const | PanelStatic with no cards |
| `EMPTY_PANEL_LIVE` | const | PanelLive with nothing live |
| `slateLive` | function | The live half of a meta with console-slate behaviour. |

#### `contraptions/skin-kit.ts` (71 lines)

| Export | Kind | Purpose |
|---|---|---|
| `PartSpec` | type | [slot, "H" hero / "K" kit, optional asset key override for parts shared with another skin or namespace]. |
| `SkinSpec` | type | input shape of defineSkin |
| `partKey` | function | "<ns>.part.<skin>_<slot>" |
| `expandAnchors` | function | "spoke_0…4" → spoke_0, spoke_1, …, spoke_4. |
| `defaultHintTable` | function | a 3-rung HintTarget table from three anchors |
| `defineSkin` | function | build a ContraptionSkin from the §4.3 row |

#### `contraptions/writer-kit.ts` (69 lines)

| Export | Kind | Purpose |
|---|---|---|
| `wExpr` | const | writer: exact expression string |
| `wDate` | const | writer: date string |
| `W_PROBE_FORMATS` | const | writer probe formats |
| `wProbe` | const | writer: nullable probe object |
| `wEnumOrNull` | const | writer: enum or null (z.null when empty) |
| `WriterProbe` | type | Writer output of wProbe(). |
| `probeFromWriter` | function | Stored ProbeSpec from a writer probe (clipped to the stored limits; |
| `GLYPH_LIBRARY` | const | Content glyphs a writer may put on a plank, item or node: |
| `GlyphId` | type | type: a GLYPH_LIBRARY id |
| `PROBE_KEY_SLOTS` | const | Probe-key slots the World Writer fills (their lines live in dialogue.fail.byKey). |

### Contraption configs (main-owned, frozen)

#### `contraptions/cause-tubes.config.ts` (17 lines)

| Export | Kind | Purpose |
|---|---|---|
| `CauseTubesConfig` | const + type | zod: cause_tubes config (§4.2) |

#### `contraptions/claim-holders.config.ts` (50 lines)

| Export | Kind | Purpose |
|---|---|---|
| `RefSimId` | const + type | zod: the 4 reference sims |
| `Aimer` | const + type | zod: claim aimer enum |
| `QuarantineAnim` | const + type | zod: quarantine animation enum (success-only) |
| `ClaimHoldersConfig` | const + type | zod: claim_holders config (§4.2) |
| `CLAIM_HOLDERS_SUCCESS_ONLY` | const | Fields only successPlan may read (the no-leak test permutes them, §8.1). |

#### `contraptions/console-slate.config.ts` (7 lines)

| Export | Kind | Purpose |
|---|---|---|
| `ConsoleSlateConfig` | const + type | zod: console_slate config (§4.2) |

#### `contraptions/emitter-rail.config.ts` (23 lines)

| Export | Kind | Purpose |
|---|---|---|
| `EmitterRailConfig` | const + type | zod: emitter_rail config (§4.2) |

#### `contraptions/oracle-ticker.config.ts` (19 lines)

| Export | Kind | Purpose |
|---|---|---|
| `OracleTickerConfig` | const + type | zod: oracle_ticker config (§4.2) |
| `ORACLE_TICKER_SUCCESS_ONLY` | const | config fields only successPlan may read (payoffLamps) |

#### `contraptions/pendulum-sync.config.ts` (17 lines)

| Export | Kind | Purpose |
|---|---|---|
| `PendulumSyncConfig` | const + type | zod: pendulum_sync config (§4.2) |

#### `contraptions/ring-gate.config.ts` (16 lines)

| Export | Kind | Purpose |
|---|---|---|
| `RingGateConfig` | const + type | zod: ring_gate config (§4.2) |

#### `contraptions/router-lanes.config.ts` (37 lines)

| Export | Kind | Purpose |
|---|---|---|
| `RouterLanesConfig` | const + type | zod: router_lanes config (§4.2) |
| `ROUTER_LANES_SUCCESS_ONLY` | const | items[].vehicle is success-only (the no-leak test permutes it). |

#### `contraptions/sluice-waves.config.ts` (36 lines)

| Export | Kind | Purpose |
|---|---|---|
| `SluiceCell` | const + type | zod: sluice cell kind enum |
| `SluiceFate` | const + type | zod: sluice fate enum |
| `SluiceWavesConfig` | const + type | zod: sluice_waves config (§4.2) |

#### `contraptions/stage-machine.config.ts` (37 lines)

| Export | Kind | Purpose |
|---|---|---|
| `StageSemantic` | const + type | zod: count | atp | beacon cartridge semantic |
| `StageMachineConfig` | const + type | zod: stage_machine config (§4.2) |

#### `contraptions/step-bridge.config.ts` (27 lines)

| Export | Kind | Purpose |
|---|---|---|
| `StageId` | const + type | membrane-fold stage library |
| `StepEffect` | const + type | zod: step_bridge card replay effect enum |
| `StepBridgeConfig` | const + type | zod: step_bridge config (§4.2) |
| `STEP_BRIDGE_SUCCESS_ONLY` | const | config fields only successPlan may read (stepEffects) |

#### `contraptions/switchboard.config.ts` (15 lines)

| Export | Kind | Purpose |
|---|---|---|
| `SwitchboardConfig` | const + type | zod: switchboard config (§4.2) |

#### `contraptions/tumbler-vault.config.ts` (15 lines)

| Export | Kind | Purpose |
|---|---|---|
| `TumblerVaultConfig` | const + type | zod: tumbler_vault config (§4.2) |

### Contraption metas (lane-owned after W0)

#### `contraptions/cause-tubes.meta.ts` (134 lines)

| Export | Kind | Purpose |
|---|---|---|
| `CauseTubesConfig` | re-export | re-export from ./cause-tubes.config |
| `CAUSE_TUBES_SKINS` | const | skins relay_line, broadcast_relay, big_board |
| `CauseTubesPose` | type | The archetype's pose. |
| `causeTubesMeta` | const | ContraptionMeta for cause_tubes (real config half, slate live half) |

#### `contraptions/claim-holders.meta.ts` (286 lines)

| Export | Kind | Purpose |
|---|---|---|
| `ClaimHoldersConfig` | re-export | re-export from ./claim-holders.config |
| `CLAIM_HOLDERS_SUCCESS_ONLY` | re-export | re-export from ./claim-holders.config |
| `RefSimId` | re-export | re-export from ./claim-holders.config |
| `CLAIM_HOLDERS_SKINS` | const | ---------------------------------------------------------------- skins (§4.3 + the round-2 slots) |
| `validateClaimHolders` | function | claim_holders validateConfig (coverage, traces, ghosts + honesty, footprints, probe) |
| `claimHoldersWriterSchema` | function | claim_holders strict-mode writer schema (§4.4) |
| `ClaimHoldersPose` | type | The archetype's pose. |
| `claimHoldersMeta` | const | ContraptionMeta for claim_holders |

#### `contraptions/console-slate.meta.ts` (52 lines)

| Export | Kind | Purpose |
|---|---|---|
| `ConsoleSlateConfig` | re-export | re-export from ./console-slate.config |
| `CONSOLE_SLATE_SKINS` | const | skin lectern_slate (shared, any biome) |
| `ConsoleSlatePose` | type | The archetype's pose. |
| `consoleSlateMeta` | const | console_slate meta WITHOUT modes (use CONTRAPTION_LIBRARY.console_slate) |

#### `contraptions/emitter-rail.meta.ts` (75 lines)

| Export | Kind | Purpose |
|---|---|---|
| `EmitterRailConfig` | re-export | re-export from ./emitter-rail.config |
| `EMITTER_RAIL_SKINS` | const | skin vesper_dial |
| `isTwoPiLine` | function | π-labelled and spanning exactly 2π (the arc rail's precondition). |
| `EmitterRailPose` | type | The archetype's pose. |
| `emitterRailMeta` | const | ContraptionMeta for emitter_rail |

#### `contraptions/oracle-ticker.meta.ts` (85 lines)

| Export | Kind | Purpose |
|---|---|---|
| `OracleTickerConfig` | re-export | re-export from ./oracle-ticker.config |
| `ORACLE_TICKER_SUCCESS_ONLY` | re-export | re-export from ./oracle-ticker.config |
| `ORACLE_TICKER_SKINS` | const | skin wire_ticker |
| `OracleTickerPose` | type | The archetype's pose. |
| `oracleTickerMeta` | const | ContraptionMeta for oracle_ticker |

#### `contraptions/pendulum-sync.meta.ts` (58 lines)

| Export | Kind | Purpose |
|---|---|---|
| `PendulumSyncConfig` | re-export | re-export from ./pendulum-sync.config |
| `PENDULUM_SYNC_SKINS` | const | skin wardens_shield |
| `PendulumSyncPose` | type | The archetype's pose. |
| `pendulumSyncMeta` | const | ContraptionMeta for pendulum_sync |

#### `contraptions/ring-gate.meta.ts` (69 lines)

| Export | Kind | Purpose |
|---|---|---|
| `RingGateConfig` | re-export | re-export from ./ring-gate.config |
| `RING_GATE_SKINS` | const | skin ring_gate (Tidewheel Gate) |
| `RingGatePose` | type | The archetype's pose. |
| `ringGateMeta` | const | ContraptionMeta for ring_gate |

#### `contraptions/router-lanes.meta.ts` (208 lines)

| Export | Kind | Purpose |
|---|---|---|
| `RouterLanesConfig` | re-export | re-export from ./router-lanes.config |
| `ROUTER_LANES_SUCCESS_ONLY` | re-export | re-export from ./router-lanes.config |
| `ROUTER_LANES_SKINS` | const | skins membrane_router, carrier_lanes, gatekeeper_maws, filing_cabinets, provenance_drawers |
| `validateRouterLanes` | function | router_lanes validateConfig |
| `routerLanesWriterSchema` | function | router_lanes writer schema |
| `RouterLanesPose` | type | The archetype's pose. |
| `routerLanesMeta` | const | ContraptionMeta for router_lanes |

#### `contraptions/sluice-waves.meta.ts` (106 lines)

| Export | Kind | Purpose |
|---|---|---|
| `SluiceCell` | re-export | re-export from ./sluice-waves.config |
| `SluiceFate` | re-export | re-export from ./sluice-waves.config |
| `SluiceWavesConfig` | re-export | re-export from ./sluice-waves.config |
| `SLUICE_WAVES_SKINS` | const | skin tonicity_sluices |
| `SluiceWavesPose` | type | The archetype's pose. |
| `sluiceWavesMeta` | const | ContraptionMeta for sluice_waves |

#### `contraptions/stage-machine.meta.ts` (139 lines)

| Export | Kind | Purpose |
|---|---|---|
| `StageMachineConfig` | re-export | re-export from ./stage-machine.config |
| `StageSemantic` | re-export | re-export from ./stage-machine.config |
| `STAGE_MACHINE_SKINS` | const | skin pump_rewiring |
| `validateStageMachine` | function | stage_machine validateConfig |
| `StageMachinePose` | type | The archetype's pose. |
| `stageMachineMeta` | const | ContraptionMeta for stage_machine |

#### `contraptions/step-bridge.meta.ts` (191 lines)

| Export | Kind | Purpose |
|---|---|---|
| `StageId` | re-export | re-export from ./step-bridge.config |
| `StepBridgeConfig` | re-export | re-export from ./step-bridge.config |
| `StepEffect` | re-export | re-export from ./step-bridge.config |
| `STEP_BRIDGE_SUCCESS_ONLY` | re-export | re-export from ./step-bridge.config |
| `STEP_BRIDGE_SKINS` | const | skins floating_steps, walking_road, timeline_bridge, endocytosis_lift |
| `validateStepBridge` | function | step_bridge validateConfig |
| `stepBridgeWriterSchema` | function | step_bridge writer schema |
| `StepBridgePose` | type | The archetype's pose. |
| `stepBridgeMeta` | const | ContraptionMeta for step_bridge |

#### `contraptions/switchboard.meta.ts` (107 lines)

| Export | Kind | Purpose |
|---|---|---|
| `SwitchboardConfig` | re-export | re-export from ./switchboard.config |
| `SWITCHBOARD_SKINS` | const | skin switchboard |
| `hintNamesDecoy` | function | True when hint 3 names a decoy right (docs/design/20 §4.4): |
| `SwitchboardPose` | type | The archetype's pose. |
| `switchboardMeta` | const | ContraptionMeta for switchboard |

#### `contraptions/tumbler-vault.meta.ts` (78 lines)

| Export | Kind | Purpose |
|---|---|---|
| `TumblerVaultConfig` | re-export | re-export from ./tumbler-vault.config |
| `TUMBLER_VAULT_SKINS` | const | skin tumbler_vault |
| `TumblerVaultPose` | type | The archetype's pose. |
| `tumblerVaultMeta` | const | ContraptionMeta for tumbler_vault |

### Sandboxes

#### `sandboxes/darkroom.config.ts` (8 lines)

| Export | Kind | Purpose |
|---|---|---|
| `DarkroomConfig` | const + type | zod: darkroom sandbox config (§4.2) |

#### `sandboxes/darkroom.meta.ts` (50 lines)

| Export | Kind | Purpose |
|---|---|---|
| `DarkroomConfig` | re-export | re-export from ./darkroom.config |
| `DARKROOM_SKINS` | const | skin darkroom_trays |
| `DarkroomPose` | type | The sandbox's pose. |
| `darkroomMeta` | const | SandboxMeta for darkroom |

#### `sandboxes/music-box.config.ts` (9 lines)

| Export | Kind | Purpose |
|---|---|---|
| `MusicBoxConfig` | const + type | zod: music_box sandbox config (§4.2) |

#### `sandboxes/music-box.meta.ts` (48 lines)

| Export | Kind | Purpose |
|---|---|---|
| `MusicBoxConfig` | re-export | re-export from ./music-box.config |
| `MUSIC_BOX_SKINS` | const | skin astronomer_box |
| `MusicBoxPose` | type | The sandbox's pose. |
| `musicBoxMeta` | const | SandboxMeta for music_box |

#### `sandboxes/placeholder.ts` (38 lines)

| Export | Kind | Purpose |
|---|---|---|
| `SandboxSlatePose` | type | placeholder sandbox pose |
| `sandboxSlateLive` | function | placeholder live half for sandbox metas |

#### `sandboxes/plant-garden.config.ts` (8 lines)

| Export | Kind | Purpose |
|---|---|---|
| `PlantGardenConfig` | const + type | zod: plant_garden sandbox config (§4.2) |

#### `sandboxes/plant-garden.meta.ts` (49 lines)

| Export | Kind | Purpose |
|---|---|---|
| `PlantGardenConfig` | re-export | re-export from ./plant-garden.config |
| `PLASMOLYSIS_THRESHOLD` | const | Salt above this (percent) plasmolyses the protoplast (§2.4b). |
| `PLANT_GARDEN_SKINS` | const | skin plant_pool |
| `PlantGardenPose` | type | The sandbox's pose. |
| `plantGardenMeta` | const | SandboxMeta for plant_garden |

### Sims

#### `sims/bilayer-probe.ts` (21 lines)

| Export | Kind | Purpose |
|---|---|---|
| `BilayerProbeState` | type | type: bilayer_probe state |
| `bilayerProbe` | const | SimSpec stub (KB1) |

#### `sims/diffusion-tank.ts` (21 lines)

| Export | Kind | Purpose |
|---|---|---|
| `DiffusionTankState` | type | type: diffusion_tank state |
| `diffusionTank` | const | SimSpec stub (KB1) |

#### `sims/index.ts` (55 lines)

| Export | Kind | Purpose |
|---|---|---|
| `bilayerProbe` | re-export | re-export from ./bilayer-probe |
| `BilayerProbeState` | re-export | re-export from ./bilayer-probe |
| `diffusionTank` | re-export | re-export from ./diffusion-tank |
| `DiffusionTankState` | re-export | re-export from ./diffusion-tank |
| `osmoticCell` | re-export | re-export from ./osmotic-cell |
| `OsmoticCellState` | re-export | re-export from ./osmotic-cell |
| `pumpFlume` | re-export | re-export from ./pump-flume |
| `PumpFlumeState` | re-export | re-export from ./pump-flume |
| `FOLD_START` | re-export | re-export from ./membrane-fold |
| `foldStage` | re-export | re-export from ./membrane-fold |
| `membraneFold` | re-export | re-export from ./membrane-fold |
| `FoldState` | re-export | re-export from ./membrane-fold |
| `beatHz` | re-export | re-export from ./pendulum-beat |
| `pendulumBeat` | re-export | re-export from ./pendulum-beat |
| `syncBrightness` | re-export | re-export from ./pendulum-beat |
| `PendulumBeatState` | re-export | re-export from ./pendulum-beat |
| `SIM_IDS` | const | the 6 sim ids |
| `SimId` | type | type: a sim id |
| `REF_SIMS` | const | eslint-disable-next-line @typescript-eslint/no-explicit-any |
| `REF_SIM_GHOSTS` | const | ghost id → whether it MATCHES or CONTRADICTS the reference sim's physics (ghost honesty, §4.4). |
| `REF_SIM_IDS` | const | the 4 reference sim ids |
| `simIdsForDomain` | function | Reference sims a writer may pick for a domain (claim_holders writer schema, §4.4). |
| `ghostIdsForDomain` | function | Ghost ids a writer may pick for a domain. |
| `ghostTag` | function | "matches" / "contradicts" for a ghost of a sim, or null when the ghost is not in that sim's registry. |

#### `sims/membrane-fold.ts` (34 lines)

| Export | Kind | Purpose |
|---|---|---|
| `FoldState` | type | type: membrane state per stage |
| `FOLD_START` | const | the unfolded membrane |
| `foldStage` | function | One stage applied to a membrane state. |
| `membraneFold` | function | The cumulative states after each stage of an order: |

#### `sims/osmotic-cell.ts` (21 lines)

| Export | Kind | Purpose |
|---|---|---|
| `OsmoticCellState` | type | type: osmotic_cell state |
| `osmoticCell` | const | SimSpec stub (KB1) |

#### `sims/pendulum-beat.ts` (37 lines)

| Export | Kind | Purpose |
|---|---|---|
| `PendulumBeatState` | type | type: pendulum_beat state |
| `syncBrightness` | function | Sync-thread brightness for a phase difference Δφ: |
| `beatHz` | function | Beat frequency between the guardian period t0 and the dialled period t (seconds): |
| `pendulumBeat` | const | STUB: |

#### `sims/pump-flume.ts` (21 lines)

| Export | Kind | Purpose |
|---|---|---|
| `PumpFlumeState` | type | type: pump_flume state |
| `pumpFlume` | const | SimSpec stub (KB1) |

### Asset index

#### `asset-index/archive_of_voices.generated.ts` (5 lines)

| Export | Kind | Purpose |
|---|---|---|
| `ASSET_INDEX_ARCHIVE_OF_VOICES` | const | GENERATED asset index (empty until art:build) |

#### `asset-index/index.ts` (45 lines)

| Export | Kind | Purpose |
|---|---|---|
| `AssetIndex` | re-export | re-export from ./types |
| `AssetIndexEntry` | re-export | re-export from ./types |
| `ASSET_INDEX_BY_NAMESPACE` | const | namespace → generated index |
| `ASSET_INDEX` | const | merged index of all namespaces (R1) |
| `namespaceOf` | function | "orrery_terraces" from "orrery_terraces.part.ring_gate_outer_ring". |
| `groupOf` | function | "part" from "orrery_terraces.part.ring_gate_outer_ring". |
| `assetEntry` | function | index entry by key |
| `assetExists` | function | key in index |
| `assetAnchor` | function | Anchor (design px) of an asset, or null when the asset or anchor is unknown. |

#### `asset-index/living_gate.generated.ts` (5 lines)

| Export | Kind | Purpose |
|---|---|---|
| `ASSET_INDEX_LIVING_GATE` | const | GENERATED asset index (empty until art:build) |

#### `asset-index/orrery_terraces.generated.ts` (5 lines)

| Export | Kind | Purpose |
|---|---|---|
| `ASSET_INDEX_ORRERY_TERRACES` | const | GENERATED asset index (empty until art:build) |

#### `asset-index/shared.generated.ts` (5 lines)

| Export | Kind | Purpose |
|---|---|---|
| `ASSET_INDEX_SHARED` | const | GENERATED asset index (empty until art:build) |

#### `asset-index/types.ts` (16 lines)

| Export | Kind | Purpose |
|---|---|---|
| `AssetIndexEntry` | type | Entry shape of the per-namespace generated asset index (docs/design/20 §5.1, R1): |
| `AssetIndex` | type | type: key → AssetIndexEntry |

## Seams outside src/world that lanes rely on

- `src/contracts/world.ts` — the stored schema (§1.3, verified equal to the doc's code block, 86 schemas), re-exported
  from `src/contracts/index.ts`; `GameSpec.world` is `WorldOverlay.optional()`; `Owner` gains `"world_writer"`.
- `src/game/hosts/types.ts` — `HostProps` / `HostHandle` Expedition fields (§2.10), `ExpeditionHostDebug.textures`.
- `src/game/hosts/expedition/bridge.ts` — `SceneApi`, `SceneEvents`, `CutsceneStage` (what the S1 runner drives),
  `CutsceneEndState`, `ExpeditionSceneData`.
- `src/game/hosts/expedition/contraptions/types.ts` — `PrefabProps`, `PoseView`, `ContraptionPrefab`, `SkinPrefab`,
  `SandboxPrefab`, `SandboxSkinPrefab`, `ContraptionInstance`, `SandboxInstance`, `FxKit`, `BeamHandle`,
  `BiomePalette`, `SnapshotProps`; `registry.ts` — `PREFABS`, `SANDBOX_PREFABS`, `prefabFor`, `sandboxPrefabFor`;
  `prefabs/<id>/{prefab,shared}.ts` + `skins/{index,<skin>}.ts` for 13 archetypes and 3 sandboxes.
- `src/game/expedition/dialogue/types.ts` — `DialogueLine`, `SayRequest`, `DialogueSnapshot`, `DialogueEngineApi`.
- `src/mechanics/util.ts` — `evalExactAt(expr, scope)`.
- `src/game/art/palettes/<ns>.ts` — seeded token maps; `art/<ns>/biome.json` + empty fragments (§5.1).
