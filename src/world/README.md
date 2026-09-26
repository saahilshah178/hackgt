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
| `aidTierOf` | function | The one definition of the aid tier (docs/design/20 §2.5.1, amendment 10): aidTier = min(2, max(hintsUsed, failedVerifies > 0 ? 1 : 0)). |
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
| `fromSubmitInput` | function | The inverse of toSubmitInput for the draft modes: a mode Input (e.g. |
| `emptyDraftInput` | function | The untouched control state for a draft mode (scalar modes start at the dial/line minimum from the view). |
| `makeDraft` | function | A Draft with every UI channel at rest; controls and tests spread their changes over it. |

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
| `smoothingFactor` | function | Per-frame smoothing factor 1 − e^(−dt/τ); reduced motion passes 1. |
| `approach` | function | Moves from toward to by one smoothing step. |
| `lerpRecord` | function | Generic pose lerp for flat records: numbers interpolate, every other field (booleans, strings, arrays, objects) snaps at t ≥ 0.5. |

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
| `pointOnCircle` | function | Point on a circle with y DOWN: θ = 0 is to the right, θ = π/2 is straight up (C + r(cos θ, −sin θ)). |
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
| `polylineYAt` | function | y on an x-ascending polyline at x (linear interpolation); null outside its span. |
| `pointAlong` | function | Point at arc-length fraction u ∈ [0, 1] along a polyline (record_lens rails, ride paths). |

#### `types.ts` (710 lines)

| Export | Kind | Purpose |
|---|---|---|
| `HintTarget` | re-export | re-export from ../contracts/world |
| `ModeKey` | type | "tuner.oscillator": ${familyId}.${mode}. |
| `AidTier` | type | 0 \| 1 \| 2 |
| `HintsUsed` | type | 0 \| 1 \| 2 \| 3 |
| `HintRung` | type | 1 \| 2 \| 3 |
| `OscillatorView` | type | Metas read views only through these shapes; tests/world-contract.test.ts checks them against the fixtures. |
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
| `DraftInputs` | type | Draft-input shapes per mode: what a control holds while the player works (possibly partial). |
| `DraftModeKey` | type | The modes with a native DraftInputs shape (every other implemented mode drafts through its widget). |
| `Draft` | type | Live, possibly partial player input plus the UI-only channels. |
| `PoseInput` | type | ================================================================ pose inputs, sims |
| `StaticInput` | type | the static half of PoseInput + skinId + record (panelStatic/hintTargets input) |
| `SimParams` | type | Numeric parameters a reference sim takes from its station config (ClaimHoldersConfig.referenceSim.params). |
| `SimCtx` | type | sim step context |
| `SimSpec` | type | Pure, seeded, fixed-step simulation (amendment 4). |
| `FnColor` | type | ================================================================ describe, skins, plans |
| `ChipSpec` | type | "g(T): 1.7π" at anchor "inner_hub" |
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
| `WorldSource` | type | ================================================================ resolved world (§1.5; implemented by V1 in resolve-world.ts) |
| `SpeakerInfo` | type | a resolved speaker |
| `SpeakerDirectory` | type | id → speaker; built by src/world/speakers.ts from spec.characters ∪ cast.extras ∪ {player, narrator}. |
| `ResolvedStation` | type | Station + index, meta, parsedConfig, layout, probe |
| `ResolvedSandbox` | type | Sandbox + meta + parsedConfig |
| `ResolvedWorld` | type | the client-side resolved world (V1's resolveWorld builds it) |
| `WorldState` | type | ================================================================ world state (§2.4.6; implemented by S1 in state/**) |
| `WorldStateEvent` | type | world-state reducer events |
| `ReqCtx` | type | requirement context |
| `WorldStateApi` | type | Signatures S1 implements (state/world-state.ts, npc-state.ts, quests.ts, requirements.ts). |
| `GroundTemplate` | type | ================================================================ biome kits (§6.4; implemented by V1 in biomes.ts) |
| `BiomeKit` | type | a biome kit (V1's BIOME_KITS implements; successPose) |
| `WORLD_RULE_IDS` | const | ================================================================ validateWorld rule ids (§1.5; V1 implements the rules) |
| `WorldRuleId` | type | type: R1…R16, W1…W3 |
| `WORLD_RULES` | const | One line per rule; severity is the default (R9's word budget and a few sub-checks are warnings inside V1). |
| `ValidateWorldResult` | type | validateWorld(spec, world) returns the same split validateGameSpec uses; issue messages start with "R5: …". |

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
| `POST_DEMO_ARCHETYPE_IDS` | const | §4 rows 14–17: kept on the roadmap, not registered; console_slate covers their modes (amendment 38). |
| `implementedModeKeys` | function | Every implemented family·mode key, from the mechanics registry. |
| `CONTRAPTION_LIBRARY` | const | archetype id → meta (console_slate carries every implemented mode) |
| `SANDBOX_LIBRARY` | const | sandbox id → SandboxMeta |
| `isArchetypeId` | function | type guard |
| `isSandboxId` | function | type guard |
| `getContraption` | function | meta by id (undefined when unknown) |
| `getSandbox` | function | sandbox meta by id |
| `skinOf` | function | a meta's skin by id |
| `allSkins` | function | Every skin of every contraption and sandbox (art contract listings, asset tests). |
| `contraptionsForMode` | function | Contraptions whose meta.modes include the mode: native first (library order), console_slate last. |
| `AUTO_ARCHETYPE_BY_MODE` | const | autoWorld's archetype per mode (§4.4). |
| `contraptionFor` | function | The contraption autoWorld and the fallback ladder use for a mode: total over every implemented mode (anything without a native archetype gets console_slate). |
| `configCtxFor` | function | ConfigCtx for one encounter of a spec (validators, defaults, fromWriterConfig; server/tests only — reads the solution). |
| `writerCtxFor` | function | WriterCtx for one encounter (the World Writer menu, §6.2). |

#### `record-strip.ts` (57 lines)

| Export | Kind | Purpose |
|---|---|---|
| `TimelineCard` | type | type: the timeline CardModel variant |
| `recordCard` | function | RECORD = the earned pins of solved encounters (spanTo → a band) + the meta's recordPins; from/to = the probe window, else the pins' span ± 1 year; cursor = the live pr… |
| `lensTarget` | function | Where the record_lens carriage sits on its rail for a probe value inside the window (fractional years). |

#### `residency.ts` (89 lines)

| Export | Kind | Purpose |
|---|---|---|
| `assetsForZone` | function | Every asset key the zone references: its layers, ground, platforms, props, hub, interiors, ladder and ride assets; its stations' skin parts, consoles, accessories and … |

### Contraption helpers

#### `contraptions/config-parts.ts` (319 lines)

| Export | Kind | Purpose |
|---|---|---|
| `Tier` | const + type | zod: aid tier 0\|1\|2 that unlocks a card/overlay |
| `Expr` | const + type | exact mathjs expression; x is the only free symbol |
| `ItemKey` | const + type | i0, s2, d0, l1, r3, x0, n4 |
| `ClaimTrace` | const + type | zod: a claim drawn literally (fns, brackets, markers) |
| `Footprint` | const + type | zod: a history claim's FILE-card footprint |
| `ItemMeta` | const + type | zod: per-item printedDate/madeYear/glyph/label |
| `HintPin` | const + type | zod: a RECORD hint pin per rung |
| `FileDate` | const + type | zod: a FILE-card date |
| `ProbeSpec` | re-export | re-export from  |
| `err` | function | ConfigIssue helper (error) |
| `warn` | function | ConfigIssue helper (warning) |
| `hasErrors` | function | true when any ConfigIssue is an error |
| `coverExactlyOnce` | function | Every expected key exactly once in got (keyed configs, §4.2: "validateConfig requires every key exactly once"). |
| `subsetOf` | function | Every key in got exists in allowed (subsets are fine). |
| `probeRangeIssues` | function | ProbeSpec sanity checks (min<max, initial, window) |
| `exprValue` | function | evalExact of a constant expression (null unless finite) |
| `exprSampleRatio` | function | Fraction of n evenly spaced samples over [x0, x1] where expr (free symbol x) is a finite number. |
| `exprEvaluatesOver` | function | True when expr evaluates at ≥ minRatio of 64 samples over [x0, x1] (claim traces: 90 %). |
| `MONTH_NAMES` | const | january … december (the §4.4 date rule) |
| `DateParts` | type | type: {year, month, day} |
| `dateParts` | function | parse a DateString |
| `datePrecision` | function | year \| month \| day of a DateString |
| `fracYearOf` | function | Fractional year: "1965-03" → 1965.167, "1955-12-01" → 1955.917 (day-of-month ignored below month precision). |
| `dateAppearsIn` | function | The §4.4 date rule: the year's digits appear in one text; month precision also needs that month's name (or its 3-letter abbreviation) in the SAME text; day precision a… |
| `yearAppearsIn` | function | The year (±slack, for "within the year" footprints) appears in some text. |
| `findYears` | function | Four-digit years 1000–2099 mentioned in a text, in order of appearance, de-duplicated. |
| `findDates` | function | Dates a text states, most precise form first per mention: "December 1, 1955" → "1955-12-01", "March 1965" → "1965-03", a bare "1957" → "1957". |
| `yearProbeFor` | function | A year probe (history stations) whose window spans the given years ± 1. |
| `viewRows` | function | Keyed rows of a view list: {key, text} by default, or any other key/text field names. |
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
| `writerItemKeys` | function | The item keys a writer schema enumerates and probes reference, per mode (WriterCtx.itemKeys): mimic → statement indices, predict_reveal → option indices, linear → plan… |
| `stringsIn` | function | Every string inside a value (params walk for ConfigCtx.texts). |
| `encounterTexts` | function | ConfigCtx.texts for an encounter: every string in params + prompt + hints + sourceRef.quote. |

#### `contraptions/placeholder.ts` (108 lines)

| Export | Kind | Purpose |
|---|---|---|
| `SlatePose` | type | The console-slate pose: slate brightness, what the slate mirrors, and the gate behind it. |
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
| `probeFromWriter` | function | Stored ProbeSpec from a writer probe (clipped to the stored limits; year formats get a window = [min, max]). |
| `GLYPH_LIBRARY` | const | Content glyphs a writer may put on a plank, item or node: what the step SAYS, never whether it belongs. |
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
| `StageSemantic` | const + type | zod: count \| atp \| beacon cartridge semantic |
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
| `CLAIM_HOLDERS_SKINS` | const | skins resonance_pillars, treasury_pillars, specimen_pods, witness_projector |
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
| `hintNamesDecoy` | function | True when hint 3 names a decoy right (docs/design/20 §4.4): its full text, or at least two of its non-stopword tokens (civil O8: e7's "signed the act" shares signed, a… |
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
| `membraneFold` | function | The cumulative states after each stage of an order: result[i] = after stages[0..i]. |

#### `sims/osmotic-cell.ts` (21 lines)

| Export | Kind | Purpose |
|---|---|---|
| `OsmoticCellState` | type | type: osmotic_cell state |
| `osmoticCell` | const | SimSpec stub (KB1) |

#### `sims/pendulum-beat.ts` (37 lines)

| Export | Kind | Purpose |
|---|---|---|
| `PendulumBeatState` | type | type: pendulum_beat state |
| `syncBrightness` | function | Sync-thread brightness for a phase difference Δφ: ½(1 + cos Δφ). |
| `beatHz` | function | Beat frequency between the guardian period t0 and the dialled period t (seconds): /1/t0 − 1/t/. |
| `pendulumBeat` | const | STUB: phases stay at the common start; KA3 advances them with the view's period and the draft's T. |

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
| `AssetIndexEntry` | type | Entry shape of the per-namespace generated asset index (docs/design/20 §5.1, R1): what validators need to know about an asset without touching the filesystem. |
| `AssetIndex` | type | type: key → AssetIndexEntry |

## Seams outside src/world that lanes rely on (summary; full export tables below)

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

## Export index: seams outside src/world

`src/game/hosts/types.ts` lists only what W0 added (the legacy `RoomPlacement`, `HostProps` core fields, `HostHandle.warpTo`/`setLiveValue`/`celebrate` and `buildRooms` are unchanged). `src/mechanics/util.ts` gains one export, `evalExactAt(expr, scope)`: the `evalExact` sandbox with at most 8 identifier-named finite numbers, copied into a fresh Map per call.

#### `src/contracts/world.ts` (1000 lines)

| Export | Kind | Purpose |
|---|---|---|
| `WORLD_VERSION` | const | the overlay format version (2); WorldOverlay.worldVersion must equal it |
| `AssetKey` | const + type | "<namespace>.<group>.<name>[.<variant>]"; namespace = "shared" or a biome id (§5.1). |
| `HexColor` | const + type | zod: #rrggbb colour |
| `CueId` | const + type | A §2.12 cue-bank id. |
| `HERO_CAP_PER_NAMESPACE` | const | Hand-authored hero SVG files allowed per namespace (02 §3a; AssetManifest.heroCount enforces it). |
| `ASSET_NAMESPACES` | const | The namespaces the showcase ships (§5.1). |
| `AssetNamespace` | type | type: one of ASSET_NAMESPACES |
| `X` | const | zod: per-zone x (0…12000) |
| `Y` | const | zod: per-zone y, down from the zone top (−400 lets crowns bleed off the top) |
| `Ms` | const | zod: milliseconds (int 0…30000) |
| `Point` | const + type | zod: [x, y] in zone units |
| `SurfaceRef` | const + type | A walkable surface: the zone heightfield ("ground") or a platform id in the same zone. |
| `Requirement` | const + type | An availability gate. |
| `DateString` | const + type | Calendar dates as "YYYY", "YYYY-MM" or "YYYY-MM-DD". |
| `ProbeFormat` | const + type | zod: probe readout format enum |
| `ProbeSpec` | const + type | The ungraded orange scrubber (amendment 3). |
| `ProbeSpecInput` | type | type: ProbeSpec input (defaults optional) |
| `EarnedPin` | const + type | zod: a RECORD pin a solve earns (date, precision, lane, spanTo) |
| `PLAYER_SPEAKER` | const | speakerId ∈ spec.characters ∪ cast.extras ∪ {PLAYER_SPEAKER, NARRATOR_SPEAKER} (R2). |
| `NARRATOR_SPEAKER` | const | speaker id "narrator" |
| `Mood` | const + type | zod: line mood enum |
| `WorldLine` | const + type | zod: a spoken line {speakerId, text, mood} |
| `LineSlot` | const + type | A station dialogue slot. |
| `EmblemGlyph` | const + type | zod: emblem centre glyph enum |
| `Emblem` | const + type | zod: dialogue-bar emblem {glyph, ring, accent, gaps} |
| `PoseName` | const + type | Kenney pose names are camelCase ("walk0", "cheer1"); they name atlas frames (§5.5). |
| `RigAnchor` | const + type | Per-frame rig anchors, COMPUTED by the rig build from the vector's transforms (§5.5; 02 §3b.3): hand_r = 02's handF (the hand painted in front), hand_l = handB; face a… |
| `CharacterLook` | const + type | A human character on the one Kenney rig (§5.5): a recoloured body atlas + costume overlays on per-frame anchors. |
| `Speaker` | const + type | A speaker that is not a spec character: NPCs, mimics, the recorded astronomer, the narrator voice (amendment 1). |
| `Cast` | const + type | zod: protagonist, guide (+ companion with awakeFlag), boss speakers, extras |
| `Meter` | const + type | zod: purpose meter (e.g. GRADIENT) with per-encounter values |
| `ProgressEffect` | const + type | zod: beam_line \| prop_state \| label_swap \| hub_socket progress effects |
| `MapOverlay` | const + type | zod: the M-key map card |
| `JournalSpec` | const + type | zod: journal title + style |
| `RecordStrip` | const + type | History games: the RECORD card's lanes and the pins each solve earns (civil §5.0.2). |
| `Story` | const + type | zod: logline, objective, ring label, intro/finale ids, meter, effects, map, journal, record strip |
| `Sky` | const + type | zod: 3–6 gradient stops + haze |
| `Depth` | const + type | zod: parallax depth enum L1…L6 |
| `ParallaxLayer` | const + type | zod: one parallax strip |
| `LayerSet` | const + type | zod: a named set of ≥ 3 layers |
| `AmbientLight` | const + type | zod: light preset enum |
| `Ambient` | const + type | zod: light, particles, shadow colour, dapple, camera grade (.prefault) |
| `Weather` | const + type | zod: weather enum |
| `MusicCue` | const + type | zod: segment music enum |
| `Segment` | const + type | A lighting/look span of a zone. |
| `Interior` | const + type | A cutaway interior: while the player's x is in [x0, x1] the façade fades to 20 % over 300 ms (civil §2.4). |
| `Ground` | const + type | zod: the zone heightfield + surface art + maxStepUp |
| `Platform` | const + type | zod: a walkable polyline (optionally gated) |
| `LinkEnd` | const + type | zod: {surface, x} end of a traversal link |
| `TraversalLink` | const + type | Authored traversal (amendment 2). |
| `TraversalLinkKind` | type | type: TraversalLink kind |
| `ZoneExit` | const + type | zod: an exit to another zone (transition, requires, cutscene) |
| `Hub` | const + type | zod: the zone's big machine (svg or puppet; anims.partial/restored) |
| `ZoneCamera` | const + type | zod: deadzones, lerp, zoom clamp (.prefault) |
| `Zone` | const + type | zod: one zone: size, layer sets, segments, interiors, ground, platforms, links, exits, hub, entry, camera |
| `LayoutMode` | const + type | zod: panel layout scrub \| board \| vault |
| `PayoffKind` | const + type | zod: terrain \| ride \| remove_blocker \| carry |
| `PayoffVertical` | const + type | zod: up \| down \| none |
| `PayoffAnim` | const + type | zod: the 16 payoff animations |
| `PAYOFF_ANIMS` | const | the PayoffAnim values |
| `PAYOFF_KIND_OF` | const | PayoffAnim → PayoffKind (R6) |
| `Payoff` | const + type | zod: a station payoff (kind, vertical, anim, noun, blocker, terrain, ride) |
| `AxisUnit` | const + type | zod: card axis unit enum |
| `Axis` | const + type | zod: card axis override |
| `CardOverride` | const + type | Presentation overrides only: card DATA always comes from the contraption meta + the encounter view. |
| `PanelOverride` | const + type | zod: layout, input symbol, Verify label, success badge, card overrides |
| `MisconceptionProbe` | const + type | Misconception probes (amendment 11): evaluated ONLY after a failed Verify, against the submitted Input (src/world/probes.ts). |
| `ProbePredicate` | type | type: MisconceptionProbe predicate |
| `PinGlyph` | const + type | zod: pin glyph enum |
| `PinPlacement` | const + type | zod: a pin on a prefab anchor |
| `Accessory` | const + type | zod: record_lens accessory |
| `AccessoryKind` | type | type: accessory kind |
| `HintTarget` | const + type | Where the companion flies on a hint rung (amendment 10, A7). |
| `BossStaging` | const + type | Boss staging (amendments 8, 18). |
| `StationDialogue` | const + type | zod: approach, instruction, tutorial, insight, hints, fail, success, payoffLine, after |
| `Station` | const + type | zod: one station per encounter (console, anchor, contraption, skin, config, nouns, probes, hintTargets, panel, dialogue, payoff, boss) |
| `PropState` | const + type | zod: prop state enum |
| `PropPlacement` | const + type | zod: a placed prop (states, touch target) |
| `NpcPose` | const + type | zod: NPC pose enum |
| `NpcState` | const + type | zod: one NPC state (requires, position, lines, pose, follow, setFlag, anim) |
| `Npc` | const + type | zod: an NPC (look xor asset) with states |
| `QuestStep` | const + type | zod: talk \| collect \| touch \| afterSeal \| visit |
| `Quest` | const + type | zod: a side quest with reward |
| `Trigger` | const + type | zod: ambient/arrival/hint trigger (lines, flag, cue, cutsceneId) |
| `Collectible` | const + type | zod: shard/page/negative pickup |
| `Plaque` | const + type | zod: readable lore plate (plaque/document/photo_withheld) |
| `Sandbox` | const + type | A contraption-like interactable with no runner, no Verify and no grade (amendment 17, §2.4b). |
| `InteractRef` | const + type | zod: await_interact target |
| `StateTarget` | const + type | zod: set_state target |
| `CameraShot` | const + type | zod: {x, y, zoom} |
| `CutsceneStep` | const + type | zod: the 18 cutscene verbs (ride has toSurface) |
| `CutsceneVerb` | type | type: CutsceneStep verb |
| `Cutscene` | const + type | zod: {id, skippable, steps} |
| `FeedbackNoun` | const + type | Display-only nouns applied to grade() feedback text (amendment 36): "chest" → "singer". |
| `WorldOverlay` | const + type | zod: the whole world overlay (root) |
| `WorldOverlayInput` | type | type: WorldOverlay input |
| `WorldFile` | const + type | Side-car wrapper: which specs this overlay dresses. |
| `WorldFileInput` | type | type: WorldFile input |
| `ZoneTag` | const + type | Residency bucket (A4, §5.7): "all" = resident for the whole game; otherwise the zone whose set loads it. |
| `AssetSource` | const + type | "hero" (hand-authored; counts against heroCap), "kit:<generator>" (§5.4) or "rig:<body>" (§5.5). |
| `PuppetAnim` | const + type | A puppet animation (§5.5): per-part tracks of waves or keyframes. |
| `CharacterBody` | const + type | zod: the 4 Kenney bodies |
| `ManifestEntry` | const + type | zod: svg \| puppet \| atlas manifest entry |
| `ManifestEntryKind` | type | type: manifest entry kind |
| `AssetManifest` | const + type | zod: a namespace manifest (hero cap 40, vram per zone, swap peak) |

#### `src/game/hosts/types.ts` (134 lines)

| Export | Kind | Purpose |
|---|---|---|
| `RoomPlacement` | type | One prefab chunk placed in the level, with its definition and (if any) the encounter it hosts. |
| `HostProps` | type | host props (legacy + optional Expedition fields) |
| `HostHandle` | type | Imperative controls GameClient uses regardless of which host (Phaser or DOM) is mounted. |
| `ExpeditionProgress` | type | type |
| `SafeRect` | type | CSS px of the visible world area (the part of the stage the panel does not cover). |
| `LayoutKind` | type | explore \| scrub \| board \| vault \| sandbox |
| `LayoutState` | type | panel layout + safe rect + focus |
| `LinkVerb` | type | traversal verb |
| `InteractTarget` | type | what E would interact with |
| `HostEvent` | type | Esc pressed in-canvas |
| `ExpeditionHostDebug` | type | debug snapshot of the Expedition host (textures added in rev 3) |
| `buildRooms` | function | (unchanged) legacy room placement |

#### `src/game/hosts/expedition/bridge.ts` (104 lines)

| Export | Kind | Purpose |
|---|---|---|
| `EmoteGlyph` | type | cutscene emote glyph |
| `StationAnim` | type | cutscene station anim |
| `HubState` | type | hub state |
| `CameraEase` | type | camera ease |
| `CutsceneEndState` | type | The final world state a cutscene leaves behind (cutscene/timeline.ts endState); skip() applies it at once. |
| `CutsceneStage` | type | The verbs of CutsceneStep (§1.3, §2.8) as scene operations. |
| `SceneApi` | type | What React calls on the running scene. |
| `SceneEvents` | type | What the scene emits. |
| `ExpeditionSceneData` | type | Scene init data (ExpeditionScene init). |

#### `src/game/hosts/expedition/contraptions/types.ts` (173 lines)

| Export | Kind | Purpose |
|---|---|---|
| `ResolvedSandbox` | re-export | re-export from ../../../../world/types |
| `ResolvedStation` | re-export | re-export from ../../../../world/types |
| `XY` | type | type |
| `BiomePalette` | type | Palette tokens for Phaser drawing: token path ("stone.lit", "fn.f", "glow.cyan") → "#rrggbb". |
| `BeamHandle` | type | A beam = three stacked lines (core 2, inner 6, outer 18) plus an end-cap glow and ±8 % shimmer (§2.2 fx/beam.ts). |
| `PooledStripHandle` | type | A window of pooled sprites along a strip (cell lipid heads, §2.11). |
| `FxKit` | type | Shared effects every prefab may use (implemented by H1 in fx/*.ts). |
| `PrefabProps` | type | type |
| `ContraptionState` | type | type |
| `PoseView` | type | What a prefab author writes. |
| `ContraptionPrefab` | type | type |
| `definePrefab` | function | identity helper that types a ContraptionPrefab |
| `SkinPrefab` | type | One file per skin (prefabs/<id>/skins/<skin>.ts): it draws that skin's parts and applies the archetype's Pose. |
| `AnyContraptionPrefab` | type | eslint-disable-next-line @typescript-eslint/no-explicit-any |
| `ContraptionInstance` | type | What the host sees per station (built by ContraptionController around a PoseView). |
| `SandboxPrefabProps` | type | type |
| `SandboxPrefab` | type | Sandbox prefabs use the same PoseView; their meta is a SandboxMeta and they receive SandboxPrefabProps. |
| `defineSandboxPrefab` | function | identity helper that types a SandboxPrefab |
| `SandboxSkinPrefab` | type | A sandbox skin file (prefabs/<sandbox id>/skins/<skin>.ts), dispatched the same way as SkinPrefab. |
| `AnySandboxPrefab` | type | eslint-disable-next-line @typescript-eslint/no-explicit-any |
| `SandboxInstance` | type | type |
| `SnapshotProps` | type | DOM fallback (amendment 31): no per-prefab component. |
| `AnyContraptionMeta` | re-export | re-export from  |
| `AnySandboxMeta` | re-export | re-export from  |

#### `src/game/hosts/expedition/contraptions/registry.ts` (54 lines)

| Export | Kind | Purpose |
|---|---|---|
| `PREFABS` | const | archetype id → ContraptionPrefab (one line per prefab) |
| `SANDBOX_PREFABS` | const | sandbox id → SandboxPrefab |
| `prefabFor` | function | The prefab for a contraption id; unknown ids fall back to console_slate. |
| `sandboxPrefabFor` | function | The prefab for a sandbox id, or null when unknown (the sandbox is then not built). |

#### `src/game/hosts/expedition/contraptions/prefabs/_stub.ts` (83 lines)

| Export | Kind | Purpose |
|---|---|---|
| `StubBoxOptions` | type | stub box options |
| `StubPose` | type | Minimal pose the stub reads: SlatePose and SandboxSlatePose both satisfy it. |
| `stubBox` | function | the W0 labelled-box PoseView |

#### `src/game/expedition/dialogue/types.ts` (71 lines)

| Export | Kind | Purpose |
|---|---|---|
| `DialogueKind` | type | src/game/expedition/dialogue/types.ts (W0, main) — the dialogue engine's public types (docs/design/20 §2.7). |
| `Channel` | type | type |
| `Priority` | type | Ascending: critical > instruction > story > ambient. |
| `PRIORITY_ORDER` | const | dialogue priorities, ascending |
| `DialogueMood` | type | type |
| `DialogueLine` | type | type |
| `SayRequest` | type | type |
| `ActiveLine` | type | type |
| `PinnedLines` | type | type |
| `DialogueSnapshot` | type | type |
| `DialogueEngineOptions` | type | type |
| `DEFAULT_CPS` | const | typewriter speed, 45 characters per second |
| `DEFAULT_MIN_TOAST_MS` | const | minimum toast duration, 2500 ms |
| `DialogueEngineApi` | type | The class S1 writes (export class DialogueEngine implements DialogueEngineApi). |

#### `src/game/art/palettes/shared.ts` (49 lines)

| Export | Kind | Purpose |
|---|---|---|
| `SHARED_PALETTE` | const | src/game/art/palettes/shared.ts — W0 seed (docs/design/20 §5.7; bible §2.3). |

#### `src/game/art/palettes/orrery_terraces.ts` (72 lines)

| Export | Kind | Purpose |
|---|---|---|
| `ORRERY_TERRACES_PALETTE` | const | src/game/art/palettes/orrery_terraces.ts — W0 seed (docs/design/20 §5.7; bible §2.1–2.2; trig §2.2). |

#### `src/game/art/palettes/living_gate.ts` (73 lines)

| Export | Kind | Purpose |
|---|---|---|
| `LIVING_GATE_PALETTE` | const | src/game/art/palettes/living_gate.ts — W0 seed (docs/design/20 §5.7; bible §2.1; cell §2.2). |

#### `src/game/art/palettes/archive_of_voices.ts` (80 lines)

| Export | Kind | Purpose |
|---|---|---|
| `ARCHIVE_OF_VOICES_PALETTE` | const | src/game/art/palettes/archive_of_voices.ts — W0 seed (docs/design/20 §5.7; bible §2.1; civil §2.2). |

#### Prefab stubs (`src/game/hosts/expedition/contraptions/prefabs/`)

Every `prefab.ts` exports `prefab` (the archetype's `ContraptionPrefab` / `SandboxPrefab`, dispatching to `skinPrefabFor(props.station.skin)`) and `default`; every `shared.ts` re-exports `stubBox` / `StubBoxOptions` and exports `ARCHETYPE_ID` (or `SANDBOX_ID`) and `STUB_COLOR`; every `skins/<skin>.ts` exports `skin` (a labelled-box `SkinPrefab` / `SandboxSkinPrefab`) and `default`; every `skins/index.ts` (main-owned) exports `SKIN_IDS`, `DEFAULT_SKIN`, `SKINS` and `skinPrefabFor(skinId)`.

| File | Lines | Exports |
|---|---|---|
| `cause_tubes/prefab.ts` | 14 | `prefab` |
| `cause_tubes/shared.ts` | 9 | `stubBox`, `StubBoxOptions`, `ARCHETYPE_ID`, `STUB_COLOR` |
| `cause_tubes/skins/big_board.ts` | 21 | `skin` |
| `cause_tubes/skins/broadcast_relay.ts` | 21 | `skin` |
| `cause_tubes/skins/index.ts` | 22 | `SKIN_IDS`, `DEFAULT_SKIN`, `SKINS`, `skinPrefabFor` |
| `cause_tubes/skins/relay_line.ts` | 21 | `skin` |
| `claim_holders/prefab.ts` | 14 | `prefab` |
| `claim_holders/shared.ts` | 9 | `stubBox`, `StubBoxOptions`, `ARCHETYPE_ID`, `STUB_COLOR` |
| `claim_holders/skins/index.ts` | 24 | `SKIN_IDS`, `DEFAULT_SKIN`, `SKINS`, `skinPrefabFor` |
| `claim_holders/skins/resonance_pillars.ts` | 21 | `skin` |
| `claim_holders/skins/specimen_pods.ts` | 21 | `skin` |
| `claim_holders/skins/treasury_pillars.ts` | 21 | `skin` |
| `claim_holders/skins/witness_projector.ts` | 21 | `skin` |
| `console_slate/prefab.ts` | 16 | `prefab` |
| `console_slate/shared.ts` | 9 | `stubBox`, `StubBoxOptions`, `ARCHETYPE_ID`, `STUB_COLOR` |
| `console_slate/skins/index.ts` | 18 | `SKIN_IDS`, `DEFAULT_SKIN`, `SKINS`, `skinPrefabFor` |
| `console_slate/skins/lectern_slate.ts` | 21 | `skin` |
| `darkroom/prefab.ts` | 13 | `prefab` |
| `darkroom/shared.ts` | 7 | `stubBox`, `StubBoxOptions`, `SANDBOX_ID`, `STUB_COLOR` |
| `darkroom/skins/darkroom_trays.ts` | 20 | `skin` |
| `darkroom/skins/index.ts` | 17 | `SKIN_IDS`, `DEFAULT_SKIN`, `SKINS`, `skinPrefabFor` |
| `emitter_rail/prefab.ts` | 14 | `prefab` |
| `emitter_rail/shared.ts` | 9 | `stubBox`, `StubBoxOptions`, `ARCHETYPE_ID`, `STUB_COLOR` |
| `emitter_rail/skins/index.ts` | 18 | `SKIN_IDS`, `DEFAULT_SKIN`, `SKINS`, `skinPrefabFor` |
| `emitter_rail/skins/vesper_dial.ts` | 21 | `skin` |
| `music_box/prefab.ts` | 13 | `prefab` |
| `music_box/shared.ts` | 7 | `stubBox`, `StubBoxOptions`, `SANDBOX_ID`, `STUB_COLOR` |
| `music_box/skins/astronomer_box.ts` | 20 | `skin` |
| `music_box/skins/index.ts` | 17 | `SKIN_IDS`, `DEFAULT_SKIN`, `SKINS`, `skinPrefabFor` |
| `oracle_ticker/prefab.ts` | 14 | `prefab` |
| `oracle_ticker/shared.ts` | 9 | `stubBox`, `StubBoxOptions`, `ARCHETYPE_ID`, `STUB_COLOR` |
| `oracle_ticker/skins/index.ts` | 18 | `SKIN_IDS`, `DEFAULT_SKIN`, `SKINS`, `skinPrefabFor` |
| `oracle_ticker/skins/wire_ticker.ts` | 21 | `skin` |
| `pendulum_sync/prefab.ts` | 14 | `prefab` |
| `pendulum_sync/shared.ts` | 9 | `stubBox`, `StubBoxOptions`, `ARCHETYPE_ID`, `STUB_COLOR` |
| `pendulum_sync/skins/index.ts` | 18 | `SKIN_IDS`, `DEFAULT_SKIN`, `SKINS`, `skinPrefabFor` |
| `pendulum_sync/skins/wardens_shield.ts` | 21 | `skin` |
| `plant_garden/prefab.ts` | 13 | `prefab` |
| `plant_garden/shared.ts` | 7 | `stubBox`, `StubBoxOptions`, `SANDBOX_ID`, `STUB_COLOR` |
| `plant_garden/skins/index.ts` | 17 | `SKIN_IDS`, `DEFAULT_SKIN`, `SKINS`, `skinPrefabFor` |
| `plant_garden/skins/plant_pool.ts` | 20 | `skin` |
| `ring_gate/prefab.ts` | 14 | `prefab` |
| `ring_gate/shared.ts` | 9 | `stubBox`, `StubBoxOptions`, `ARCHETYPE_ID`, `STUB_COLOR` |
| `ring_gate/skins/index.ts` | 18 | `SKIN_IDS`, `DEFAULT_SKIN`, `SKINS`, `skinPrefabFor` |
| `ring_gate/skins/ring_gate.ts` | 21 | `skin` |
| `router_lanes/prefab.ts` | 14 | `prefab` |
| `router_lanes/shared.ts` | 9 | `stubBox`, `StubBoxOptions`, `ARCHETYPE_ID`, `STUB_COLOR` |
| `router_lanes/skins/carrier_lanes.ts` | 21 | `skin` |
| `router_lanes/skins/filing_cabinets.ts` | 21 | `skin` |
| `router_lanes/skins/gatekeeper_maws.ts` | 21 | `skin` |
| `router_lanes/skins/index.ts` | 26 | `SKIN_IDS`, `DEFAULT_SKIN`, `SKINS`, `skinPrefabFor` |
| `router_lanes/skins/membrane_router.ts` | 21 | `skin` |
| `router_lanes/skins/provenance_drawers.ts` | 21 | `skin` |
| `sluice_waves/prefab.ts` | 14 | `prefab` |
| `sluice_waves/shared.ts` | 9 | `stubBox`, `StubBoxOptions`, `ARCHETYPE_ID`, `STUB_COLOR` |
| `sluice_waves/skins/index.ts` | 18 | `SKIN_IDS`, `DEFAULT_SKIN`, `SKINS`, `skinPrefabFor` |
| `sluice_waves/skins/tonicity_sluices.ts` | 21 | `skin` |
| `stage_machine/prefab.ts` | 14 | `prefab` |
| `stage_machine/shared.ts` | 9 | `stubBox`, `StubBoxOptions`, `ARCHETYPE_ID`, `STUB_COLOR` |
| `stage_machine/skins/index.ts` | 18 | `SKIN_IDS`, `DEFAULT_SKIN`, `SKINS`, `skinPrefabFor` |
| `stage_machine/skins/pump_rewiring.ts` | 21 | `skin` |
| `step_bridge/prefab.ts` | 14 | `prefab` |
| `step_bridge/shared.ts` | 9 | `stubBox`, `StubBoxOptions`, `ARCHETYPE_ID`, `STUB_COLOR` |
| `step_bridge/skins/endocytosis_lift.ts` | 21 | `skin` |
| `step_bridge/skins/floating_steps.ts` | 21 | `skin` |
| `step_bridge/skins/index.ts` | 24 | `SKIN_IDS`, `DEFAULT_SKIN`, `SKINS`, `skinPrefabFor` |
| `step_bridge/skins/timeline_bridge.ts` | 21 | `skin` |
| `step_bridge/skins/walking_road.ts` | 21 | `skin` |
| `switchboard/prefab.ts` | 14 | `prefab` |
| `switchboard/shared.ts` | 9 | `stubBox`, `StubBoxOptions`, `ARCHETYPE_ID`, `STUB_COLOR` |
| `switchboard/skins/index.ts` | 18 | `SKIN_IDS`, `DEFAULT_SKIN`, `SKINS`, `skinPrefabFor` |
| `switchboard/skins/switchboard.ts` | 21 | `skin` |
| `tumbler_vault/prefab.ts` | 14 | `prefab` |
| `tumbler_vault/shared.ts` | 9 | `stubBox`, `StubBoxOptions`, `ARCHETYPE_ID`, `STUB_COLOR` |
| `tumbler_vault/skins/index.ts` | 18 | `SKIN_IDS`, `DEFAULT_SKIN`, `SKINS`, `skinPrefabFor` |
| `tumbler_vault/skins/tumbler_vault.ts` | 21 | `skin` |
