# 40 · Implementation plan: Variant-fidelity showcase games

> **Superseded for lanes, item ids, windows and owned paths by `20-expedition-architecture.md` §7 (revision 3:
> 10 lanes L1–L10, items M0, V1, H1–H3, P1, S1, A1–A3, KA, KB, KC, C0–C3, E1–E3, Gate V, R, F).** The wave table and
> the B1/B2/K1–K3/V/C1a ids below are the revision-2 plan; dispatch from 20 §7.1–§7.3. The goal and definition of done
> (§1) still hold.

_Owner: main session. Written 2026-09-26 13:10 from docs 00–31. The engineering spec is
`20-expedition-architecture.md` (rev 2, reconciled); this document is the execution plan: what runs, in what order,
by whom, and what "done" means at each gate. Item ids (M0, H1, P1, A1, B1, B2, K1–K3, A2, C1–C3, E1, R, F, S1, Q1,
A3, U1, Q2) are the ones in architecture §7.2._

## 1. Goal and definition of done

The three showcase games (`trig_demo_001` The Orrery Terraces, `cell_demo_001` The Living Gate,
`history_mystery_001` The Archive of Voices) play as painterly 2.5D side-view adventures at the fidelity of Triseum's
*Variant: Limits*: a protagonist and a guide with dialogue, a world with a purpose, every encounter a contraption in
the world that moves live with the instrument panel, Verify graded by the existing mechanic mode, success as an
in-world animation whose payoff is traversal. **Done** = every station of every game passes the bible §9 rubric
(≥ 39/44 with all 14 mandatory items, P0 rule: items 37/43/44 scored on zone 1 only), `pnpm typecheck`, `pnpm test`,
`pnpm lint` and `pnpm e2e` (webgl + dom projects) green, and `docs/ADVANCED_GAMES.md` explains how each game was
elevated and how the pipeline will do the same for uploaded PDFs.

The demo is 2026-09-27. P0 (architecture §0.1.2) ships first and freezes 2 h before the demo slot; P1/P2 layer on top
only after P0 is green. The fallback ladder (§0.1.6) is applied, in order, to anything not ready.

## 2. Non-negotiables

- The six byte-pinned fixtures never change; worlds are side-cars in `fixtures/worlds/*.world.json`.
- Grading stays in the mechanic modes; failure detail comes only from `src/world/diagnose/**`; feedback never leaks the
  answer (R8 + the generic no-leak tests).
- No paid APIs; art is the procedural SVG kit + ≤ 40 hand-authored hero SVGs per biome + one recoloured CC0 Kenney rig.
- Keyboard-usable and projector-legible; `?host=legacy`, `?renderer=dom`, `?express=1`, `?mute=1` always work.
- History game: R10 sensitivity rules and a reviewer sign-off before P0 freeze.
- Agents never run git write commands; the user commits at the stage boundaries listed in §6.

## 3. How the work runs

Every wave is one Workflow run. Lanes inside a wave own disjoint files (architecture §7.3); a lane that needs a change
outside its files reports the exact diff instead of making it. Each lane ends with `pnpm typecheck`, its tests and
`pnpm lint` green on its paths, and a verifier agent re-runs the whole suite before the wave is accepted. Models:
architecture, contracts, verification and critique on Opus; drawing, content and mechanical lanes on Opus or Sonnet as
listed. One dev server on port 3100 is shared for visual checks.

| Wave | Lanes (concurrent) | Ends with | Gate |
|---|---|---|---|
| **W0** (running) | M0 architect + reviewer | contracts, types, registries, real configSchemas, stub metas/prefabs, skeleton side-cars, scripts, tests | suite green, fixtures untouched |
| **W1** | H1 host core · P1 panel/cards/controls · A1 art pipeline + kit + rig + shared set + trig zone 1 · B1 world library/validate/diagnose/state · B2 client/machine/dialogue/HUD/audio/express · K1 continuous archetypes (emitter_rail, ring_gate, pendulum_sync, console_slate, tumbler_vault) · K2 claims/sequences (claim_holders, oracle_ticker, step_bridge + biology sims) · K3 routers/waves/links (router_lanes, sluice_waves, switchboard, stage_machine, cause_tubes) · C1a trig `world.json` zone 1 (vertical slice content) · V verifier | the dev world boots on webgl and dom; every control grades; every meta's §7.4 tests; `art:build --check` clean; trig side-car validates | **Gate V**: trig S1–S2 (e1, e2) playable end to end on both projects, zone-1 art with the finish stack, critic scores 3 shots with no ★ failure except art polish. Hard stop midday 2026-09-27. |
| **W2** | A2 cell/civil zone 1 + kit zones + landmarks · C1 trig (rest) · C2 cell · C3 civil (content + parts) · I integration fixes (main-dispatched F slot) · R reviewer (sensitivity + code review) | three side-cars with zero `validateWorld` errors; express run completes every station on both projects | all 29 stations playable |
| **W3** | E1 e2e/capture/perf · critic rounds (per game, ≤ 3) · F fix agents grouped by owner path · docs (ADVANCED_GAMES.md, README, instructions ownership rows) | rubric target met per game; e2e green; docs written | **P0 freeze** |
| **W4** (P1) | S1 sandboxes · Q1 side content · A3 remaining hero art | §0.1.3 rows | 30 min before demo |
| **W5** (P2) | U1 map + journal · Q2 secrets · polish | §0.1.4 | if time remains |
| **W6** (post-demo) | World Writer (S7.5) + `autoWorld` | §6 | — |

Compression levers and the fallback ladder are architecture §0.1.6. If Gate V slips past midday, W2 content lanes
start anyway on `console_slate` stations and kit art (ladder rungs 2–3) so that every station is playable by P0.

## 4. Lane briefs (what each agent is told)

Every brief starts with: read `instructions.md`, then `20-expedition-architecture.md` §0–§0.1 and the sections the
item cites, `02-assets-and-art-pipeline.md` (art lanes), `01-variant-design-bible.md` (visual lanes), the game doc for
content lanes, and `docs/design/w0-report.md` (the export list). Then the item text from §7.2 verbatim, the ownership
row from §7.3, and:

- **H1 host core** (Opus): §2.1–§2.4, §2.6–§2.11; the dev world fixture; both render paths; the D4 keyboard fix;
  `__GAME_DEBUG__.expedition`; pure host modules ≥ 90 % coverage.
- **P1 panel** (Opus): §3; `graph-math`; nine controls with `.logic.ts`; widgets gain `onDraft`; the dev gallery page;
  a11y (`role=slider`, focus order, aria-live); every showcase encounter's control round-trips through `grade()`.
- **A1 art pipeline** (Opus): 02 §3–§5; kit generators (byte-deterministic per seed); engraving; rig build with
  anchors; shared set; trig zone 1 full art; default kit zone preset per biome; contact sheets; VRAM/hero gates.
- **B1 world library** (Sonnet): validate-world R1–R16/W1–W3 with a negative test each; resolve-world keying; diagnose
  parity for all 10 modes; probes, fail-line precedence, feedback nouns, answer-leak tokenizer, world-state reducer.
- **B2 client** (Opus): phase machine (fixes D1/D2/D3/D9); dialogue engine (45 cps, priorities, aria-live); station
  slot flow; HUD (objective ring, meter, key legend, mute); audio cue bank with CUE_MAP coverage; express policy;
  `GameClient`/play page wiring; legacy path byte-identical.
- **K1/K2/K3 archetypes** (Opus each): metas first with the §7.4 tests, then prefabs; ≥ 3 intermediate poses while
  scrubbing; success 1.2–2.5 s; failure ≤ 1.6 s; snapshots for the DOM host; skins listed per item.
- **C1a/C1/C2/C3 content** (Opus each): author `fixtures/worlds/<game>.world.json` from the game doc's paste-ready JSON
  (zones, links, stations with exact config, dialogue slots, cutscenes, triggers, cast, story, meter, record strip),
  draw the contraption parts and hero landmarks the item lists, run `validateWorld` to zero errors, express run on both
  projects.
- **E1 e2e** (Sonnet): per-game specs on webgl + dom, keyboard-only test per control kind, express spec, capture script
  producing the shot list with fps and draw counts.
- **Critic** (Opus, read-only): scores each game's shots with the bible §11 protocol; output JSON; findings grouped by
  owner path for the F slot.
- **Reviewer** (Opus, read-only): contract drift, answer leaks, sensitivity (R10), keyboard access, console errors.

## 5. The fidelity loop (W3)

1. `scripts/capture-scenes.ts` shoots each game: establishing shot per zone, every station in scrub/board mode
   mid-drag with ≥ 3 poses, each payoff moment, the intro and finale, express end screen.
2. A critic agent scores the shots against bible §9 with the §11 JSON output; mandatory failures are listed first.
3. Main groups findings by owner path and dispatches fix agents (each owns exactly those paths), then re-captures.
4. Stop when every game reaches the target or after three rounds; remaining items go to `BLOCKERS.md` with the
   fallback applied.

## 6. Stage boundaries for the user's commits

Agents cannot commit (project settings deny it). At each of these points the tree is green and worth a commit:

1. Design docs (`docs/design/00–40`, README) — now.
2. W0 green (contracts, stubs, side-car skeletons).
3. Gate V (trig vertical slice).
4. W2 (all 29 stations playable).
5. P0 freeze (e2e green, docs).
6. P1, P2 as they land.

Suggested commands at each point: `git add -A && git commit -m "<stage>"` then `git push -u origin main`.

## 7. Risks the plan accepts

The calendar is the main risk; the demo cut, Gate V hard stop and the fallback ladder exist for it. Agent-authored SVG
art quality is the second: the critic loop and kit fallbacks bound it. Headless WebGL: both Playwright projects must be
green. Legacy regressions: `?host=legacy` and the existing e2e stay in CI.
