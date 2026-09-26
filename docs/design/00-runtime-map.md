# 00 — Runtime map (play runtime, as of 2026-09-26)

Audience: the architecture and implementation teams building the "Variant-grade" showcase games
(painterly 2.5D world on the left, hex-grid instrument panel on the right, guide dialogue, live
contraptions). This document describes **what exists today**, with `path:line` references, and marks
every seam, constraint and trap the new work has to respect. Recommendations are labelled
**[REC]**; defects found while mapping are labelled **[BUG]**.

Everything here was read from source on 2026-09-26 (Phaser 4.2.1, zod 4.6.5, Next 16.3.6, React 19.3.0,
verified from `node_modules/*/package.json`).

---

## 0. The ten facts to remember

1. The runtime is **one React component (`GameClient`) + one pure class (`EncounterRunner`) + one
   host (Phaser or DOM) + one widget at a time**. The host only reports "the player reached socket X"; the
   runner only grades; the widget only collects input. Nothing else talks to anything else.
2. Phases are `walking → widget → consequence → (walking | widget | finished)`, held in `GameClient`
   state (`src/game/GameClient.tsx:25`, `:148`).
3. Live values flow **widget → `GameClient.onWidgetLive` → `hostRef.current.setLiveValue` → `PlayHost` →
   scene bridge** (`GameClient.tsx:197-200`, `PlayHost.tsx:121-124`). The type is `number` on the widget
   side (`Dial.tsx:247`) and `unknown` on the host side (`hosts/types.ts:30`).
4. Only **3 of the 10 modes used by the showcase fixtures emit live values today**: `tuner.oscillator`
   and `tuner.formula` (via `BaseDial`, `Dial.tsx:652-655`) and `mapper.number_line` (via `NumberLinePlace`,
   `Place.tsx:714-717`). Pick, Order, Sort and Link emit nothing.
5. Both Phaser scenes treat the live value the same way: a generic ring rotates around the player
   (`DungeonScene.ts:177-184`, `PlatformerScene.ts:206-213`). Nothing in the world is bound to the
   mechanic.
6. The Phaser canvas is a **fixed 800×480** box (`PlayHost.tsx:62-64`, `:153`) and the widget renders
   **below it** in a centred `max-w-3xl` card (`GameClient.tsx:256-274`). The consequence overlay is a
   full-screen modal (`ConsequenceOverlay.tsx:28`). There is no side-by-side layout today.
7. `GameSpec` is a plain `z.object` (`src/contracts/gamespec.ts:79`). **zod 4 strips unknown keys** (verified:
   `z.object({a}).parse({a:1, extra:2})` returns `{a:1}`), so a `world` key added to fixture JSON is silently
   dropped by `validateGameSpec` unless the contract changes.
8. Six fixture JSONs are pinned by equality tests against `assembleGameSpec(slices)`, and
   `trig-dungeon.json` is also pinned against the **mock LLM pipeline's** output (`tests/mock-models.test.ts:21-33`,
   `tests/pipeline-mock.test.ts:88-94`). **[REC]** Keep the world overlay out of `GameSpec` for the
   showcase (a side-car file). See §3.
9. Art today is one Kenney 1-bit tilesheet that is loaded but never drawn (`DungeonScene.ts:119`; no
   `this.add.image/sprite("tiles"…)` anywhere). Every visible thing is a tinted rectangle, circle or line.
   `public/audio/` is empty.
10. e2e depends on `window.__GAME_DEBUG__` (`state/skipTo/autoSolve/events/mastery`), on the `end-screen`
    test id, on an `<h1>`, and for the mystery spec on `mystery-host`, `scene-arrival`,
    `scene-cross_exam` and `widget-first-option`. A new host must keep these or update the specs (§5).

---

## 1. Phase flow and every callback

### 1.1 Component tree (mount order)

```
/play/[id]  (server)                       src/app/play/[id]/page.tsx:44
 └─ loadAndValidate(id) → validateGameSpec  page.tsx:23-41
 └─ <PlayClient spec>  ("use client")       src/app/play/[id]/PlayClient.tsx:20
     └─ next/dynamic(GameClient, ssr:false) PlayClient.tsx:11-18
         └─ <GameClient spec>               src/game/GameClient.tsx:140
             ├─ new EncounterRunner(spec) in a ref       GameClient.tsx:141-143
             ├─ <MasteryHud>                              GameClient.tsx:250
             ├─ <PlayHost ref=hostRef …>                  GameClient.tsx:254
             │    ├─ Phaser Game + DungeonScene | PlatformerScene   PlayHost.tsx:50-99
             │    ├─ <MysteryHost>  (genre "mystery")              PlayHost.tsx:133
             │    └─ <DomHost>      (no WebGL / boot failure / puzzle|strategy)  PlayHost.tsx:135-150
             ├─ phase "widget":      <Widget> + <HintPanel>          GameClient.tsx:256-274
             ├─ phase "consequence": <ConsequenceOverlay>            GameClient.tsx:276-284
             └─ phase "finished":    <EndScreen> (replaces everything) GameClient.tsx:235-238
```

### 1.2 Phase state machine

`type Phase = "walking" | "widget" | "consequence" | "finished"` (`GameClient.tsx:25`). Initial `"walking"` (`:148`).
Host input is frozen whenever `phase !== "walking"` (`:254`, `frozen={phase !== "walking"}`).

| From | Trigger | Code | To | Side effects |
|---|---|---|---|---|
| walking | host calls `onReachSocket(id)` and `id === runner.current().encounter.id` | `GameClient.tsx:162-168` | widget | `setLastHint(null)`. Ignored silently if `id` is not the current encounter or the runner is finished. |
| widget | widget calls `onSubmit(input)` | `:170-177` | consequence | `runner.submit(input)` grades, logs telemetry, updates mastery, and **advances the runner index if correct**. `bump()`. Stores `{correct, feedback, yourAnswer: describeAnswer(...), mode}`. |
| widget | "Ask for a hint" | `:191-195` | widget | `runner.hint()` returns the next of 3 hints (`encounter-runner.ts:87-91`), `setLastHint`, `bump()` |
| consequence | Continue (button, Enter or Escape; `ConsequenceOverlay.tsx:32-34`) and was correct | `:179-189` | walking or finished | `hostRef.celebrate(mode)` **then** `hostRef.setLiveValue(undefined)` |
| consequence | Continue and was wrong | `:186-188` | widget | The widget remounts because it was unmounted during `consequence`, so its local state (slider position, placed planks) **resets** |
| any | `__GAME_DEBUG__.skipTo(id)` | `:211-217` | walking or finished | `runner.skipTo` resets attempts and hints; `hostRef.warpTo(id)` |
| any | `__GAME_DEBUG__.autoSolve()` | `:218-227` | walking or finished | `hostRef.warpTo(current)`, then `runner.autoSolve()` (submits `mode.solutionInput(params, resolve(params))`, `encounter-runner.ts:122-127`). **No widget, no consequence and no `celebrate`.** |
| n/a | `runner.finished` becomes true | `:235` | finished (render) | `EndScreen` posts telemetry, stores it in sessionStorage and links to `/debrief/<spec.id>` (`EndScreen.tsx:27-43`, `:92`) |

There is no transition from `widget` back to `walking`: the player cannot close a widget and walk away.

### 1.3 Sequence: one encounter, happy path (Phaser host)

```
Phaser update()  ──checkRoom()──▶ cfg.onReachSocket(encId)                 DungeonScene.ts:191-197 / PlatformerScene.ts:221-227
  └▶ PlayHost propsRef.current.onReachSocket(encId)                         PlayHost.tsx:80
      └▶ GameClient.onReachSocket → setPhase("widget")                      GameClient.tsx:162-168
          └▶ PlayHost effect: scene.setFrozen(true)                          PlayHost.tsx:111-114
          └▶ render <Widget view={current.view} onSubmit onLive>             GameClient.tsx:263
              └▶ widget useEffect([value]) → onLive(value)                   Dial.tsx:652-655
                  └▶ GameClient.onWidgetLive → setLiveValueState + hostRef.setLiveValue(v)   GameClient.tsx:197-200
                      └▶ PlayHost.setLiveValue → bridgeRef.setLiveValue(v)   PlayHost.tsx:121-124
                          └▶ scene.setLiveValue: ring.rotation = v*0.6       DungeonScene.ts:177-184
              └▶ "Lock in" → onSubmit(input) → runner.submit → phase "consequence"
  ConsequenceOverlay Continue → hostRef.celebrate(mode); setPhase("walking"); hostRef.setLiveValue(undefined)
          └▶ PlayHost effect: scene.setFrozen(false) → ring hidden           DungeonScene.ts:186-189
```

### 1.4 Callback and handle inventory

| Callback / method | Declared | Caller → callee | Payload | Notes |
|---|---|---|---|---|
| `HostProps.onReachSocket(encounterId)` | `hosts/types.ts:20` | host → GameClient | encounter id | Hosts fire on **room change** only (`DungeonScene.ts:192-193`), so standing still after a correct answer doesn't re-fire. The platformer skips segments already solved (`PlatformerScene.ts:226`). DomHost and MysteryHost fire from `useEffect([roomIndex])` (`DomHost.tsx:81-85`, `MysteryHost.tsx:359-363`). |
| `HostProps.onReachEnd?()` | `hosts/types.ts:22` | host → GameClient | none | Declared; **no host calls it and GameClient never passes it.** |
| `HostProps.frozen` | `hosts/types.ts:18` | GameClient → host | boolean | Phaser: pushed imperatively via `scene.setFrozen` (`PlayHost.tsx:111-114`); DOM hosts read the prop directly. |
| `HostHandle.warpTo(id \| null)` | `hosts/types.ts:28` | GameClient (debug only) → host | encounter id | Only called by `skipTo`/`autoSolve`. |
| `HostHandle.setLiveValue?(v)` | `hosts/types.ts:30` | GameClient → host | `unknown` (number today; `undefined` = reset) | Implemented only by the two Phaser scenes. DomHost and MysteryHost ignore it. |
| `HostHandle.celebrate?(mode)` | `hosts/types.ts:32` | GameClient → host | mode string (e.g. `"oscillator"`) | Dungeon pulses the room icon and bursts particles (`DungeonScene.ts:278-300`). Platformer mutates the world (bridge appears, gate lifts: `PlatformerScene.ts:230-290`). Mystery shows a flourish (`MysteryHost.tsx:341-346`). DomHost scales the marker. |
| scene `onReady(bridge)` | `DungeonScene.ts:20`, `PlatformerScene.ts:30` | scene `create()` → PlayHost | `{warpTo, setLiveValue, celebrate, playerX?}` | PlayHost stores it in `bridgeRef` (`PlayHost.tsx:81-90`). |
| scene `setFrozen(v)` | `DungeonScene.ts:186`, `PlatformerScene.ts:215` | PlayHost effect → scene | boolean | Looked up with `game.scene.getScene(sceneKey)` and duck-typed. |
| `WidgetProps.onSubmit(input)` | `Dial.tsx:245` | widget → GameClient | the mode's `Input` shape | Must match `mode.grade()`'s input exactly. |
| `WidgetProps.onLive?(value: number)` | `Dial.tsx:247` | widget → GameClient | **number only** | See §1.5. |
| `WidgetProps.disabled?` | `Dial.tsx:248` | GameClient → widget | boolean | **Never passed** by GameClient. |
| `HintPanel.onRequestHint` | `systems/HintPanel.tsx:12` | panel → GameClient | none | |
| `ConsequenceOverlay.onContinue` | `systems/ConsequenceOverlay.tsx:12` | overlay → GameClient | none | |
| `EncounterRunner.opts.onEvent` | `encounter-runner.ts:53` | runner → caller | `TelemetryEvent` | GameClient doesn't pass it; telemetry is read at the end via `runner.telemetry()`. |

`EncounterRunner` public surface (`src/game/runner/encounter-runner.ts`): `current()` (`:70`, calls
`mode.present(params, spec.seed + index)` **on every call**, `:80`), `hint()` (`:87`), `hintsUsedOnCurrent`
(`:93`), `submit(input)` (`:97`), `autoSolve()` (`:122`), `skipTo(id)` (`:129`), `telemetry()` (`:136`),
`mastery()` (`:140`), `debrief()` (`:145`), `finished` (`:66`). `Current` carries `index, encounter, mode, card,
view, before[], after[]` (`:8-17`); `before`/`after` are this encounter's `narrative.beats` (`:81-82`).

### 1.5 Live values today, by showcase mode

| Fixture mode | Widget (`mode.widget`) | Component path | Emits `onLive`? | What it would need to drive a contraption |
|---|---|---|---|---|
| `tuner.oscillator` (trig e2, e6) | dial | `Dial` → `BaseDial` (`Dial.tsx:258`, `:646`) | **yes**: slider value | already enough (value plus `view.{wave, amplitude, b, c, d, ask}`) |
| `mapper.number_line` (trig e1) | place | `Place` → `NumberLinePlace` (`Place.tsx:247`, `:698`) | **yes**: mapped value | already enough (value plus `view.landmarks/min/max/scale`) |
| `truth_finder.mimic` (trig ×2, cell ×4, civil ×2) | pick | `Pick` → `OneShotPick` (`Pick.tsx:215`, `:349`) | no | the hovered/selected `statementIndex` |
| `sequencer.linear` (trig, cell, civil ×2) | order | `Order` (`Order.tsx:91`) | no | the current `keys[]` (partial order) |
| `sorter.bins` (cell ×3, civil ×2) | sort | `Sort` → `BinsSort` (`Sort.tsx:70`, `:84`) | no | the current `{itemKey → binId}` map |
| `sorter.type_match` (cell ×2) | pick | `Pick` → `WavesPick` (`Pick.tsx:420`, has its own `setTimeout` wave timer `:423-445`) | no | current wave index and answers so far |
| `linker.pairs` (cell, civil) | link | `Link` → `PairsLink` (`Link.tsx:469`) | no | current links |
| `linker.chain` (civil ×3) | link | `Link` → `ChainLink` (`Link.tsx:564`) | no | current edges |
| `truth_finder.predict_reveal` (civil) | pick | `Pick` → `OneShotPick` | no | selected `optionIndex` |
| `investigator.elimination` (civil boss) | link | `Link` → `EliminationLink` (`Link.tsx:629`) | no | struck hypotheses and the current accusation |

Mode View/Input shapes are in `src/mechanics/families/<family>/<mode>.ts` (`interface View`/`Input` near the top
of each file, e.g. `tuner/oscillator.ts:43-54`, `truth_finder/mimic.ts:25-30`, `sorter/bins.ts:28-34`) and in
`docs/overnight/wave1-modes.md`.

**[REC]** Widen `onLive` from `(value: number) => void` to a structured, per-mode "draft input" (for example
`onDraft?: (draft: unknown) => void`, where the draft has the mode's `Input` shape even when partial). Then
`HostHandle.setLiveValue(draft)` can drive any contraption, and a contraption can call the mode's own pure
helpers to preview. GameClient's `onWidgetLive` (`GameClient.tsx:197`) is typed `number` and must change with it.

### 1.6 Defects and traps found while mapping (they matter for the redesign)

| # | Kind | Where | What happens | Consequence for the new work |
|---|---|---|---|---|
| D1 | **[BUG]** | `GameClient.tsx:281` | `after={consequence.correct ? current.after : undefined}`, but `runner.submit` already **advanced** (`encounter-runner.ts:117`), so `current` is the **next** encounter. The overlay shows the next encounter's "after" beats (usually none), not the one just cleared. | Dialogue after a success must be captured before `submit` (store the cleared encounter in `ConsequenceState`). |
| D2 | **[BUG]** | `GameClient.tsx:235` | When the boss is answered correctly, `runner.finished` is true on the very next render, so `EndScreen` replaces the page. **The boss consequence overlay, the "after" beats and `celebrate()` never happen.** | The climactic "world restored" moment currently cannot play. The finale needs its own phase (e.g. `"finale"`) before `EndScreen`. |
| D3 | trap | `GameClient.tsx:218-227` | `autoSolve` never calls `celebrate`. In-world state that is changed only in `celebrate` (the platformer's bridges and gates) falls out of sync with the runner during e2e and demo skipping. | **[REC]** Derive world state from runner progress (pass `solvedEncounterIds`/`currentIndex` to the host as props, or add `HostHandle.syncProgress(index)`), and treat `celebrate` as animation only. |
| D4 | trap | Phaser keyboard capture: `DungeonScene.ts:151-152`, `PlatformerScene.ts:139-141`; Phaser `KeyboardManager.onKeyDown` | `createCursorKeys()` and `addKeys("W,A,S,D")` default to `enableCapture=true`, and Phaser listens on **`window`** and calls `preventDefault()` for captured codes (verified in `node_modules/phaser/src/input/keyboard/KeyboardManager.js`, `onKeyDown`). While a Phaser host is mounted, arrow keys on a focused `<input type=range>` and typing w/a/s/d or space into a text input in the widget are suppressed (this follows from the source; it has not been reproduced in a browser). `setFrozen` only stops movement and does not release capture. | A right-side panel with sliders and keyboard scrubbing **must** call `this.input.keyboard.disableGlobalCapture()` (or `clearCaptures()`) when frozen and `enableGlobalCapture()` when unfrozen, or set `input.keyboard.target` to the canvas container in the game config. |
| D5 | trap | `GameClient.tsx:157`, `encounter-runner.ts:80` | `runner.current()` calls `present()` on every render, so `current.view` has a **new identity on every render**. Every `onLive` tick triggers `setLiveValueState` (`:198`), re-renders GameClient and hands the widget a fresh `view`. Content is deterministic (seeded), so it's harmless today, but any `useEffect([view])` in a new panel or contraption re-fires on every slider tick. | Memoize the view per `current.index`. |
| D6 | gap | whole runtime | `spec.narrative.intro` is **never rendered** (grep: no use in `src/game` or `src/app`). `spec.premise` is shown only by MysteryHost (`MysteryHost.tsx:143`). `HintPanel` shows beat text without resolving `speakerId` to a character name (`HintPanel.tsx:21-25`). `spec.characters` is used only by MysteryHost. | There's no dialogue system yet. The guide NPC, portraits and the bottom dialogue bar are all new. |
| D7 | gap | `DungeonScene.ts:126-139`, `:302-312` | Dungeon rooms never block the player: walking right passes through unsolved rooms, which is saved only because the widget opens on entering the current room. There is no gate the player has to open. | The new host needs a real "obstacle blocks until solved" rule (as PlatformerScene does with static walls, `PlatformerScene.ts:159-172`). |
| D8 | contrast | `engine/palettes.ts:54` | `parchment` has a light `background` but `css.text` is hard-coded `#f5f3ee` (`:44`), so it's light on light. None of the showcase fixtures uses it (they use ember, tide, dusk). | A new biome palette must carry its own text/ink colours. |
| D9 | gap | `GameClient.tsx:256-274` | The widget has no close/back and no "Verify" semantics distinct from "Lock in". The hint button is the only secondary action. | Maps directly onto the Variant panel: Verify = `onSubmit`, the info button = hint ladder. |

---

## 2. How a host is mounted, and how a right-side panel fits

### 2.1 Boot path

1. **Server**: `src/app/play/[id]/page.tsx:44-68`. `fixture-<name>` reads `fixtures/<name>.json` or else
   `fixtures/<name>-dungeon.json` (`:12-21`). Any other id loads from storage (`getGameSpecById`, `:35`). Both
   paths run `validateGameSpec` (`:28`, `:40`). Invalid specs render an error page with an `<h1>`
   "This game can't be played" (`:49-65`). Valid ones render `<PlayClient spec>`.
   - Route ↔ file: `/play/fixture-trig` → `trig-dungeon.json`, `/play/fixture-cell-transport` →
     `cell-transport-dungeon.json`, `/play/fixture-civil-rights-mystery` → `civil-rights-mystery.json`.
   - The play page is **not** wrapped in `AppShell` (`src/components/app-shell.tsx`): GameClient owns the full viewport
     under the root layout (`src/app/layout.tsx:17-20`, dark theme always, Geist font).
2. **Client boundary**: `PlayClient.tsx:11-18` uses `next/dynamic(() => import("@/game/GameClient"), { ssr: false })`
   with a "Loading the game…" placeholder. Nothing under `src/game` ever runs on the server.
3. **Host choice** (`PlayHost.tsx:22-157`):

| Condition | Result | Code |
|---|---|---|
| `genre === "mystery"` | `<MysteryHost>` (DOM, never touches Phaser) | `:131-133` |
| `genre ∈ {puzzle, strategy}` | banner (`data-testid="unimplemented-genre-banner"`) plus `<DomHost>` | `:134-147` |
| `genre ∈ {dungeon, platformer}` and `webglAvailable()` is false | `<DomHost>` | `:46-49`, `:150` |
| same, WebGL OK | `Promise.all([import("phaser"), import(scene module)])`, then `createXScene(Phaser)` factory, then `new Phaser.Game({type: WEBGL, width: 800, height: 480, parent, backgroundColor: "#000", physics: arcade (platformer only), scene: [SceneClass]})` | `:50-69` |
| Game created but the canvas has no WebGL context | `game.destroy(true)`, then `<DomHost>` | `:70-75` |
| any exception during boot | `console.error(...)`, then `<DomHost>` | `:93-98` |

   - `webglAvailable()` (`:8-15`) probes `webgl2 ?? webgl` on a scratch canvas.
   - **Note:** the `console.error` on boot failure (`:94`) would fail every e2e "zero console errors" assertion,
     so a new host must not be able to throw at boot in headless Chromium.
   - Scenes are **factories** taking the Phaser namespace (`createDungeonScene(PhaserLib)`,
     `DungeonScene.ts:96`), so `phaser` is only ever a dynamic import. **[REC]** Keep this pattern: a static
     `import Phaser from "phaser"` anywhere under the GameClient import graph would pull Phaser into the
     client bundle's initial chunk (and break if anything is ever evaluated on the server).
   - Scene start: `game.scene.start(sceneKey, {rooms, palette, onReachSocket, onReady})` (`:77-91`). `props` are
     read through `propsRef` so the one-shot boot effect (`:39-108`, deps `[]`) always sees fresh callbacks.
   - Teardown: `game.destroy(true)` on unmount (`:100-104`).
   - `useImperativeHandle` (`:116-129`) routes `warpTo`, `setLiveValue` and `celebrate` to `bridgeRef` (Phaser) or
     `fallbackRef` (DOM hosts) based on `mode`.
4. **Rooms**: `buildRooms(spec, chunkById)` (`hosts/types.ts:35-42`) maps `spec.layout.chunks` to
   `RoomPlacement {index, chunkId, def: ChunkDef, encounter | null}`. Chunks come from `CHUNKS[genre]`
   (`src/library/genres.ts:120-176`); the layout is computed by `layoutFromEncounters` (`src/pipeline/layout.ts:9-30`):
   a start chunk, then one room per encounter, with a connector before every even-indexed encounter after
   the first. Chunk counts: trig 9, cell 17, civil-rights-mystery 18.

### 2.2 Current screen geometry

```
┌───────────────────────────── GameClient root: flex-col gap-4 p-4 min-h-screen ─────────────────────────────┐
│ <h1>{spec.title}</h1>                                           MasteryHud (w-64)      GameClient.tsx:245-252 │
│                  ┌──────────── Phaser canvas 800×480 (mx-auto, fixed px) ────────────┐   PlayHost.tsx:153   │
│                  │ camera follows player; rooms 220 px wide + 40 px gaps               │                     │
│                  └─────────────────────────────────────────────────────────────────────┘                     │
│        ┌──────── phase=widget: card max-w-3xl mx-auto ────────┐                          GameClient.tsx:256   │
│        │ prompt (18 px)                                        │                                              │
│        │ [Widget flex-1]  [HintPanel max-w-sm]  (md:flex-row)  │                                              │
│        └───────────────────────────────────────────────────────┘                                              │
│ phase=consequence: fixed inset-0 z-50 bg-black/60 modal, max-w-lg        ConsequenceOverlay.tsx:28           │
└──────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

At 1920×1080 the widget card starts around y≈560 and fits. At 1280×720 (a common projector resolution) the
widget is below the fold and the world scrolls out of view while the player works. The consequence modal
covers the world entirely.

### 2.3 How a Variant-style split fits **[REC]**

The reference layout (screenshots 4, 5 and 8): the world takes about 45% of the width on the left and stays live.
The instrument panel takes about 55% on the right: hex-grid dark-teal panels, stacked graphs, an orange scrubber
with an `f(a)` readout, Verify. A dialogue bar with the guide's emblem and an info button runs along the bottom
of the panel. Mapping it onto the existing seams:

```
┌──────────────── 100vw × 100vh (GameClient root, CSS grid) ────────────────┐
│ top bar: <h1>title</h1> · objective · MasteryHud (compact)                 │  keep an <h1> (e2e flows.spec.ts:44-46)
├───────────────────────────────┬────────────────────────────────────────────┤
│ WORLD (PlayHost)              │ INSTRUMENT PANEL (phase=widget)            │
│ grid col 1, minmax(0,1fr)     │ grid col 2, clamp(560px, 52vw, 1000px)     │
│ Phaser Scale.RESIZE in parent │ widget/contraption controls, graphs,       │
│ (or FIT at 16:9)              │ scrubber, Verify (= onSubmit)              │
│ contraption reacts to         ├────────────────────────────────────────────┤
│ setLiveValue(draft)           │ DIALOGUE BAR: guide emblem · line · (i)    │
└───────────────────────────────┴────────────────────────────────────────────┘
walking phase: the panel collapses (world spans both columns) or shows the journal/objective.
consequence: render inside the panel/dialogue bar (not a full-screen modal) so the world stays visible.
```

Concrete requirements for that layout:

- **Canvas sizing.** Today the size is hard-coded (`width: 800, height: 480`, `PlayHost.tsx:62-64`, and the
  container `style={{width: 800, height: 480}}`, `:153`). Use `scale: { mode: Phaser.Scale.RESIZE, parent }`
  (1:1 pixels, the scene handles `this.scale.on("resize")`) or `Phaser.Scale.FIT` with a fixed 16:9 base size
  (letterboxed, simpler camera maths). Both are documented in `node_modules/phaser/skills/scale-and-responsive/SKILL.md`.
  If the panel opens and closes with the phase, the world column width changes, and RESIZE handles that
  without a re-boot. **Don't re-create `Phaser.Game` on phase change**: the boot effect's deps are `[]` on purpose.
- **Camera framing.** When the panel opens, the world column narrows. Pan and zoom the camera so the active
  contraption sits in the visible left area (Variant keeps the contraption and the protagonist in frame).
- **Keyboard.** Fix D4 first (release Phaser's global key capture while `frozen`). Panel controls must be
  reachable with Tab and operable with arrows and Enter. Phaser must not steal focus: the canvas is not focusable
  today and should stay that way while the panel is open.
- **DOM fallback.** In headless Chromium without WebGL the DOM fallback carries the run (e2e relies on this).
  The split layout must also work when the left column is `<DomHost>` or a static painted backdrop.
  **[REC]** A new host's DOM fallback can be the same painted SVG layers rendered as DOM `<img>`/`<svg>` with CSS
  parallax, so the fallback still looks like the game.
- **Mystery.** `MysteryHost` is DOM-only and renders the prompt itself in several frames
  (`MysteryHost.tsx:181`, `:253`, `:276`, `:293`, `:316`), so the prompt appears twice today (frame plus
  `encounter-prompt`, `GameClient.tsx:258`). In the split layout the scene frame is the left column and the
  panel is the right one.
- **Z-order.** Keep React overlays above the canvas. The consequence modal (`z-50`, `fixed inset-0`) should
  become a panel state. If a modal is kept for the finale, it must not hide the celebrating world.

### 2.4 Scene internals worth reusing

| Concern | Dungeon | Platformer |
|---|---|---|
| Movement | manual `x += vx·dt`, no physics (`DungeonScene.ts:302-312`) | arcade physics, gravity 1500, jump -560 (`PlatformerScene.ts:33-39`, `:292-317`) |
| Room ↔ x | `ROOM_W 220`, `ROOM_GAP 40`, `roomIndexAt` (`:23-26`, `:164-166`) | `SEGMENT_WIDTH 300`, `GROUND_Y 380` in `platformer/layout.ts:8-12` (pure and unit-tested in `layout.test.ts`) |
| Blocking obstacles | none (D7) | static wall bodies removed in `celebrate` (`:159-172`, `:248-261`); pits with a hidden bridge (`:100-104`, `:238-246`) |
| Per-mode skin | `iconForMode` switch → `drawRoomIcon` shapes (`:48-94`, `:200-275`) | per-socket obstacle (`:41-55`, `:157-192`) |
| Camera | `startFollow(player, true, 0.15, 0.15)`, bounds (`:142-145`) | same (`:121`, `:133`) |
| e2e hook | none | `playerX()` on the bridge, attached to `__GAME_DEBUG__.host` by PlayHost (`PlayHost.tsx:86-89`) |

**[REC]** Keep pure layout and geometry in a `.ts` file next to the scene (as `platformer/layout.ts` does),
because Vitest runs in `environment: "node"` and only picks up `*.test.ts` (`vitest.config.*`:
`include: ["tests/**/*.test.ts", "src/**/*.test.ts"]`). **There are no `.tsx` component tests and no DOM environment.**
Contraption maths (beam angle from value, staircase heights, which bin glows) must be pure functions to be testable.

---

## 3. Spec validation, and adding an optional `world` overlay safely

### 3.1 What `validateGameSpec` does (`src/pipeline/validate/validate-gamespec.ts:43-192`)

1. **Structural**: `GameSpec.safeParse(input)` (`:47`). Issues are routed by `ownerFor(path)` (`:23-41`); unknown heads default to `"code"`.
2. **Referential**: concept→unit, intake units, unique character ids, unique encounter ids (`:62-77`). Per encounter
   (`:79-101`): the card exists, `card.family/mode` equals `encounter.familyId/mode`, the mode is registered and
   `implemented`, the family has a skin for `spec.genre`, the socket is allowed (`socketsFor`), and exactly the
   last encounter is the boss on `BOSS_SOCKET[genre]`. Layout (`:103-124`): chunks exist, chunk 0 is `start`,
   each encounter is placed exactly once in a chunk that provides its socket. Narrative speakers exist and beats
   reference real encounters (`:127-137`). Assessment concepts exist (`:138-143`).
3. **Semantic and self-solve** (`:146-185`): `paramsSchema` parses, locked params are honoured, `mode.check()` is
   empty, the stored `solution` deep-equals `resolve(params)`, `grade(solutionInput(...))` is correct, and there
   are no unrendered `{{…}}` in text.
4. Returns `{ok: true, spec: parsed.data, warnings}`. **`parsed.data` is the stripped copy**, so keys not in
   the zod schema never reach the runtime.

`GameSpec` itself (`src/contracts/gamespec.ts:79-112`) has no `.strict()` and no `.passthrough()`. It uses
`z.unknown()` for `params` and `solution` (`:57`, `:64`), `Line.text ≤ 240` chars (`:37`), `characters` 1-4
(`:99`) and `encounters` 1-20 (`:100`). `checks.ts` (LLM-slice checks) caps narrative lines at 24 words
(`checks.ts:130`) and challenge texts at 220 chars (`:110`). Those limits apply to generated text, not
to a hand-authored overlay.

### 3.2 The tests that pin fixture bytes

| Test | Pins | How |
|---|---|---|
| `tests/fixtures-drift.test.ts:23-41` | cell-transport-dungeon, civil-rights-dungeon, trig-platformer, civil-rights-mystery, wave2-dungeon | `expect(assembleGameSpec(slices)).toEqual(loadJson(file))` |
| `tests/gamespec.test.ts:21-23` | trig-dungeon | `assembleGameSpec(trigSlices)` toEqual the JSON import |
| `tests/mock-models.test.ts:21-33` | trig-dungeon | the **mock LLM pipeline** (`generateGame` + `getModels()` in `LLM_MODE=mock`) must equal the JSON |
| `tests/pipeline-mock.test.ts:88-94` | trig-dungeon | `generateGame` with hand-built mock agents, including repairs, must equal the JSON |
| `tests/gamespec.test.ts:15-19`, others | trig-dungeon | `validateGameSpec(fixture)` has zero issues **and zero warnings** |
| `scripts/build-fixtures.ts:13-32` | all six | `pnpm fixtures:build` regenerates the JSON from slices (never hand-edit the fixture JSON) |

Other readers of fixture JSON: `src/server/fixtures.ts` (`findFixtureSpecById` scans **every top-level
`fixtures/*.json`** and validates each one, `:37-51`), `src/app/debrief/[id]/page.tsx`,
`src/pipeline/mock/trig.ts`, and `tests/{api-sources,audio,blind-solver,storage-local}.test.ts`.

### 3.3 Options for the `world` overlay

| Option | Change | Breaks | Verdict |
|---|---|---|---|
| **A. Side-car overlay (recommended now)** | New contract `src/contracts/world.ts` (`WorldOverlay` zod schema; `src/contracts/` is architect-only). Overlays live **outside the fixture JSON**, e.g. `src/game/worlds/<key>.ts` (typed TS objects, tree-shaken per game via dynamic import) or `fixtures/worlds/<spec.id>.world.json`, which must sit in a **subdirectory** so `findFixtureSpecById` and `/play/fixture-<name>` never see them. Loaded in `page.tsx` (server) or lazily in GameClient, validated, passed as a new optional prop `world?: WorldOverlay` through `PlayClient` to `GameClient` to the host. | nothing: no fixture bytes change and `GameSpec` is untouched | Zero risk to the six pinned fixtures and the two mock-pipeline tests. Missing overlay = today's behaviour or an auto-generated default world. |
| B. Optional field on `GameSpec` | `world: WorldOverlay.optional()` in `gamespec.ts`. `assembleGameSpec` must emit it **only** when `Slices.world` exists (`...(s.world ? { world: s.world } : {})`). Add `case "world"` to `ownerFor` (`validate-gamespec.ts:25`) and referential checks (overlay encounter ids exist, one scene per encounter, speaker ids exist). | If the world is added to `trigSlices`, then `fixtures:build` writes it into `trig-dungeon.json`, `gamespec.test.ts:21` still passes, **but `mock-models.test.ts` and `pipeline-mock.test.ts` fail** because `generateGame` doesn't produce a world. Fixing that needs a recorded mock "world agent" response and a new Slices field. Also, adding keys to fixture JSON without the schema change is a silent no-op (§0.7). | Right target for generated games later (the pipeline writes the overlay), not for the showcase sprint. |
| C. Put it in `theme` or `narrative` | Stretch existing fields | Same byte-identity problem as B, plus the 240-char and 24-word limits | No. |

**Overlay keying [REC].** Games generated in mock mode get a fresh id (`newId("game")`,
`src/pipeline/orchestrator.ts:143`) but the **same encounter ids** as the fixture (e.g. `e1_radians`). Look up an
overlay by `spec.id` first, then by `(spec.source.sourceId, spec.genre)`: `src_trig_ch4`/dungeon,
`src_cell_transport`/dungeon, `src_civil_rights`/mystery. Key per-encounter entries by `encounter.id` and ignore
entries whose encounter is absent. The golden-path e2e (`e2e/golden-path.spec.ts`) then gets the rich world too.

**Generalizing to PDFs later (option B's pipeline half).** An LLM-facing `WorldSlice` must follow
`instructions.md` §4: root object, every field required (`.nullable()`, never `.optional()`), no `z.record`,
`z.union` not `discriminatedUnion`, bounded ints, dynamic enums for encounter, character and contraption ids.
`tests/strict-schemas.test.ts` enforces this for slices. The contraption choice should be **code** (a
library keyed by `familyId.mode` + socket + biome), and the model writes only story, dialogue and labels.

---

## 4. Assets today, and Phaser 4.2.1 texture options

### 4.1 Today

| Asset | Path | Used? |
|---|---|---|
| Kenney 1-Bit Pack tilesheet, 784×352 PNG, 16×16 frames (CC0; `public/assets/1bit/LICENSE.txt`) | `public/assets/1bit/tilesheet.png` | Loaded as spritesheet `"tiles"` in `DungeonScene.preload` (`DungeonScene.ts:118-120`) and **never drawn**. PlatformerScene has no `preload`. |
| Audio | `public/audio/` (empty); `spec.audio.voice[]` is empty in every fixture | MysteryHost has voice plumbing (`MysteryHost.tsx:106-116`, `:371-379`) that is a no-op tonight |
| Everything visible | `this.add.rectangle/circle/line/text` tinted from `Palette` | `engine/palettes.ts:49-56`: six palettes, each `{floor, wall, accent, player, background}` plus `css.*` |

Next serves `public/` at the site root (`/assets/...`). `next.config.ts` has no image, SVG or asset config
(only `agentRules: false`), and Turbopack is the bundler. `import x from "./a.svg"` resolves to a Next static
image object (URL), not a React component: there is no SVGR. **[REC]** Put world art in
`public/assets/worlds/<biome>/*.svg|png` and load it by URL. Put panel and UI art (hex grid, emblems, graph chrome) in
React as inline SVG components.

### 4.2 Phaser 4.2.1 loader API (from `node_modules/phaser/types/phaser.d.ts`)

| Loader call | Signature (line in `phaser.d.ts`) | Use for |
|---|---|---|
| `this.load.svg(key, url, svgConfig?)` | `:90412`; `SVGSizeConfig {width?, height?, scale?}` at `:100696` (scale wins over width and height) | Painterly layered backdrops and props authored as SVG. The file is **rasterized once at load** to a texture of that size, so load at the display size or at `scale: 2` for projector crispness. It is drawn via an `<img>`, so external fonts inside the SVG won't load (convert text to paths); SVG filters and gradients do render in Chromium. The SVG needs `width`/`height` or `viewBox`. |
| `this.load.image(key, url)` | `:89498` | PNG/WebP layers |
| `this.load.spritesheet(key, url, {frameWidth, frameHeight})` | `:90299` | Character walk and idle strips (fixed-size frames) |
| `this.load.atlas(key, textureURL, atlasURL)` | `:88519` | Packed character and prop frames (JSON hash/array) |
| `this.load.multiatlas` / `aseprite` | `:89659` / `:88409` | Larger packed sets / Aseprite exports with tags |
| `this.load.json`, `bitmapFont`, `audio`, `video`, `htmlTexture` | `:89580`, `:88927`, `:88670`, `:90821`, `:89407` | Data, crisp numeric fonts, SFX |
| `this.textures.addBase64(key, dataURI)` | `:135332` | Runtime textures from **generated SVG strings** (`data:image/svg+xml;base64,...`). Asynchronous: wait for the texture manager's `addtexture` event before use. |
| `this.textures.addImage` / `addCanvas` / `addDynamicTexture` | `:135357` / `:135419` / `:135444` | Rasterize an `HTMLImageElement`/canvas you built, or draw into a DynamicTexture |
| `Graphics#generateTexture(key, w, h)` | `:29837` | Bake procedural shapes (gears, beams, orbs) into textures once |

Phaser 4 rendering features relevant to a painterly look (all present in 4.2.1 types):

- **Filters** (Phaser 4 replaces v3 FX and postFX): `gameObject.enableFilters()` (`:13305`), then
  `filters.internal.addGlow(color, outer, inner, …)` (`:18743`), `addBlur` (`:18668`), `addShadow` (`:18963`).
  Cameras have filters without `enableFilters` (`node_modules/phaser/skills/filters-and-postfx/SKILL.md:26-28`),
  which gives depth-of-field blur on far parallax layers and glow on active contraptions.
- **Parallax**: `setScrollFactor(x, y)` on every layer (e.g. `:14020`). `TileSprite` for repeating strata. `Gradient`
  game object (`:28255`) for skies.
- `ParticleEmitter` (`:44787`), `Rope` (`:51558`, bendy beams and vines), `NineSlice` (`:35761`),
  `PointLight` (`:48757`), `RenderTexture` (`:49750`), `Container` (`:20994`).
- Tint in Phaser 4: `setTint(c).setTintMode(Phaser.TintModes.FILL)` (`:14199-14204`; also `instructions.md` §5).
- Phaser ships skill notes in `node_modules/phaser/skills/<topic>/SKILL.md` (loading-assets, filters-and-postfx,
  scale-and-responsive, cameras, particles, v3-to-v4-migration, v4-new-features). Read those before
  guessing at v3 APIs.

**[REC]** Asset budget and loading: preload one biome per game (backdrop layers, protagonist, guide, contraption
parts) in `preload()`, and show a loading bar in the world column. Loader failures log through Phaser.
A missing file emits a `loaderror` and, depending on the file type, may reach `console.error`, which would fail
the e2e zero-console-errors checks. Every referenced asset must exist. A test that walks each overlay's asset
list and `stat`s `public/` would catch this.

---

## 5. e2e and debug conventions a new host must keep

### 5.1 `window.__GAME_DEBUG__` (`src/game/debug.ts`)

- Installed by GameClient's mount effect (`GameClient.tsx:203-233`) whatever host is mounted, when
  `NODE_ENV !== "production"` **or** `?debug=1` (`debug.ts:27-35`). It is removed on unmount if unchanged (`:45-47`).
- Shape `GameDebugHandle` (`debug.ts:11-17`): `state() → {finished, index, encounterId, mastery}`, `skipTo(id)`,
  `autoSolve()`, `events()`, `mastery()`. Deliberately **not** a `declare global` augmentation (`:19-24`),
  because each e2e spec declares its own narrow shape.
- `autoSolve` must keep working **without any UI interaction**: it warps the host, then answers through the runner
  (`GameClient.tsx:218-227`). A new host must tolerate `warpTo` for any encounter at any time,
  including while its own intro cutscene or dialogue is playing. **[REC]** `warpTo` should cancel cutscenes and
  tweens.
- `host.playerX()` is an optional extension used by `e2e/play-platformer.spec.ts:66-80`, attached by PlayHost
  (`PlayHost.tsx:86-89`), not by `debug.ts`. **[REC]** Any new host exposes `playerX()` the same way so
  a movement e2e can be written.

### 5.2 Test ids and selectors the specs rely on

| Selector | Owner | Used by |
|---|---|---|
| `end-screen` | `EndScreen.tsx:46` | `play-smoke.spec.ts:41`, `play-platformer.spec.ts:41`, `play-mystery.spec.ts:39`, `golden-path.spec.ts:61`, `flows.spec.ts:98` |
| `<h1>` on `/play/*` that isn't "can't be played" | `GameClient.tsx:246` | `flows.spec.ts:44-46` (checks all 5 library card links) |
| `phaser-host` / `dom-host` | `PlayHost.tsx:153` / `DomHost.tsx:98` | `play-platformer.spec.ts:52-64` |
| `mystery-host`, `scene-arrival`, `scene-cross_exam` | `MysteryHost.tsx:392`, `:138`, `:244` | `play-mystery.spec.ts:47-55` (focus host, press ArrowRight, cross-exam frame visible) |
| `widget-first-option` | `Pick.tsx:395` | `play-mystery.spec.ts:56` |
| `encounter-prompt`, `widget-root`, `hint-button`, `hint-text`, `consequence-overlay`, `consequence-continue`, `widget-submit`, `mastery-hud`, `end-debrief-link`, `telemetry-status`, `unimplemented-genre-banner`, `widget-fallback(-skip)`, `number-line`, `dial-live-output`, `order-slots`, `sort-bins`, `sort-bin-<id>`, `link-columns`, `chain-edges`, `elimination-clues`, `room-<i>`, `player-marker`, `next-location`, `mystery-breadcrumbs`, `voice-audio`, `scene-*` | GameClient, systems, widgets, hosts | Not all are asserted today. **Keep them all.** They are the only stable handles for the fidelity-loop screenshots and future specs. |

Fixture routes exercised by e2e: `fixture-trig`, `fixture-cell-transport`, `fixture-wave2`
(`play-smoke.spec.ts:46-56`), `fixture-trig-platformer` (`play-platformer.spec.ts`),
`fixture-civil-rights-mystery` (`play-mystery.spec.ts`). Every one asserts **zero console errors and page errors**
(`play-smoke.spec.ts:17-21`, `:43`).

Playwright (`playwright.config.ts`) runs `pnpm dev --port 3100` with `LLM_MODE=mock STORAGE_DRIVER=local
AUDIO_MODE=off`, Desktop Chrome, and a 120 s test timeout. Headless Chromium may or may not have WebGL, and both
paths must pass (see the `gotPhaser` branch in `play-platformer.spec.ts:54-64`).

### 5.3 Widget coverage test

`src/game/widgets/coverage.test.ts` checks that for **every implemented mode**, `widgetFor(mode.widget,
present(COVERAGE_PARAMS[key], 1))` is a real widget and not `Fallback` (`:29-47`). `EXPECTED_FALLBACK` is empty
(`:19`). If contraption panels replace widgets for some modes, keep the registry path working for every
other mode (the fallback DOM widget remains the universal path), or add an equivalent
"every showcase mode has a contraption" test. `widgetFor` (`registry.ts:55-60`) never returns undefined.
An unsupported view renders the `Fallback` card (with a Skip button) instead of crashing.

---

## 6. Constraints

| Constraint | Source | Implication for this work |
|---|---|---|
| TypeScript strict; **no `any` in contracts**; ESM | `tsconfig.json` (`strict: true`), `instructions.md` §5 | `WorldOverlay` is a zod schema with `z.infer` types. `unknown` + narrowing at the edges (the runtime already uses `unknown` for `view`/`input`; `AnyFamilyMode` uses `any` in `src/mechanics/types.ts:71`, which is not a contract). |
| Relative imports in library code (`contracts, mechanics, library, pipeline, server, game/runner`); `@/` allowed in `app`, `components`, `game/hosts`, `game/widgets` | `instructions.md` §5 | Put contraption **maths** in a relative-import module so Vitest and tsx can import it. |
| Ownership: `src/contracts/` is architect/main only; `src/game/**` and `public/assets/` are engine-dev; `e2e/play*.spec.ts` are engine-dev; fixtures are mechanics-dev and pipeline-dev (and **never hand-edit fixture JSON**; use `pnpm fixtures:build`) | `instructions.md` §2, §7 | The world contract is an architect change. Hosts, panel and art are engine-dev work. |
| Phaser client-only via `next/dynamic` `ssr:false`; WebGL-only; `setTint` + `setTintMode` | `instructions.md` §5 | Keep scene factories and the dynamic `import("phaser")`. |
| Widgets are React overlays above the canvas: **keyboard-usable, palette-aware, projector-legible** (large type, high contrast, no layout shift) | `instructions.md` §5 | Existing floor: body text 18 px, headings 24-30 px, secondary 14-16 px (inline `style={{fontSize}}` throughout). Panel readouts (f(a), axis labels) need 18 px or more; dialogue 20 px or more. No layout shift when the panel opens (reserve the column or animate width with the canvas on `Scale.RESIZE`). Fix D4 so keyboard use actually works while Phaser is mounted. |
| Lint: `eslint-config-next` core-web-vitals + typescript (React Compiler rules `react-hooks/refs`, `static-components`, `set-state-in-effect`) | `eslint.config.*`, GameClient's disables at `GameClient.tsx:2-9`, commit b7dd8bc | Don't call `setState` synchronously in effects. Keep component identities static. |
| Tests: Vitest `environment: node`, only `*.test.ts`; no real API calls; mock env vars set in config | `vitest.config.*`, `instructions.md` §5 | No component tests; test pure functions. |
| Git: never `commit/push/merge/rebase/reset/stash/checkout --/restore/clean/tag`; no `replay-checkpoints.sh`; don't read `.env*` | `.claude/settings.json` `permissions.deny`; `instructions.md` §6.1 | Checkpoints go through `bash .overnight/checkpoint.sh` only when the main session says so. |
| Spend nothing: `LLM_MODE=mock`, `STORAGE_DRIVER=local`, `AUDIO_MODE=off`; no OpenAI, ElevenLabs, Supabase or Google calls | `instructions.md` §6.4 | All art is hand-authored (SVG/PNG in repo) or procedurally generated. No image-generation APIs. |
| Never create `CLAUDE.md`/`AGENTS.md` (`next.config.ts` sets `agentRules: false` for this reason) | `instructions.md` §6.5 | n/a |
| Subagents: sonnet for dev roles, opus for architect/reviewer; at most 3 concurrent; depth 1 | `.claude/settings.json` env; `instructions.md` §6.2 | Partition the work by owned paths. |
| Determinism: the runtime is a pure function of the spec, and views are shuffled from `spec.seed + index` | `gamespec.ts:22`, `encounter-runner.ts:80` | Contraption layouts that depend on shuffled view order must use the view as given. Don't reshuffle. |

---

## 7. Seams for the new host, in one table **[REC]**

| Need (from the Variant reference) | Existing seam | Minimal change |
|---|---|---|
| Rich world, protagonist, guide NPC | `PlayHost` genre branch (`PlayHost.tsx:24-27`, `:53-60`) | Add a host (e.g. `hosts/expedition/ExpeditionScene.ts` + a `createExpeditionScene` factory), selected when a `world` overlay is present, whatever the genre. Mystery can keep its DOM frames, or move to the same host with a DOM fallback. |
| World data (biome, scenes, contraptions, dialogue) | none | Side-car `WorldOverlay` (§3.3 A) threaded as `HostProps.world?` and into the panel. |
| Contraption reacts live | `onLive` → `setLiveValue` (§1.3) | Structured draft (§1.5 REC), plus live emitters in Pick, Order, Sort and Link (or new panel components that replace them for showcase modes). |
| World state follows progress | `celebrate(mode)` only | `HostProps.solvedEncounterIds`/`currentIndex` or `HostHandle.syncProgress`, with `celebrate` as animation only (D3). |
| Right-side instrument panel plus dialogue bar | widget card below the canvas (`GameClient.tsx:256-274`) | Grid layout (§2.3). Panel = widget or contraption controls + HintPanel (the info button) + Verify (`onSubmit`). Dialogue bar resolves `speakerId` → `spec.characters`. |
| Story beats, intro and finale | `narrative.intro` unused (D6); boss consequence skipped (D2); `after` beats off by one (D1) | New phases `intro` and `finale`. Capture the cleared encounter before `submit`. |
| Blocking obstacles and purpose | platformer walls/pits; dungeon none (D7) | The host blocks progress at each unsolved contraption. |
| Keyboard in the panel | Phaser global key capture (D4) | `disableGlobalCapture()` while frozen. |
| e2e stays green | §5 | Keep `__GAME_DEBUG__`, `end-screen`, `<h1>`, `phaser-host`/`dom-host`, and the mystery test ids (or update `play-mystery.spec.ts` in the same change). No console errors in either WebGL path. |
