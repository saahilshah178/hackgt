STATUS: COMPLETE
# PROGRESS (overnight build, HackGT 13)

Times are local (America/New_York). `[ ]` todo · `[x]` done · `[~] blocked: reason`.

## P0 — Orient & bootstrap (checkpoint: bootstrap)
- [x] 1. git init (already a repo) + `.overnight/ENABLED` — 23:21
- [x] 2. PROGRESS.md, DECISIONS.md, BLOCKERS.md — 23:23
- [x] 3. Verify package versions (rule 8)
- [x] 4. Scaffold Next.js (pnpm, non-interactive, temp folder + merge)
- [x] 5. Install deps; Vitest + Playwright (chromium)
- [x] 6. Import the seed into src/, fixtures/, tests/, scripts/; 27 seed tests green
- [x] 7. instructions.md
- [x] 8. .env.example, .gitignore, src/server/env.ts
- [x] 9. FIRST_RUN.md draft
- [x] 10. scripts/doctor.ts
- [x] Accept: typecheck + test + build pass, doctor runs → checkpoint `bootstrap` (checkpoint 01)

## P1 — Contracts v2 (checkpoint: contracts-v2) — done 00:05
- [x] 1. Section 5 contracts (enums, KnowledgeMap, Intake, TeachingMechanic, MechanicFamily, MatchResult, Blueprint, GameSpec v2, Telemetry, Mastery, ProgressEvent, StorageDriver)
- [x] 2. Migrate 4 seed mechanics into families/modes
- [x] 3. Trig fixture rebuilt to v2 from slices
- [x] 4. Strict-schema audit green
- [x] 5. Mock pipeline test reproduces v2 fixture exactly

## P2 — Library encoding (checkpoint: library-catalog) — done 00:58 (316 cards)
- [x] 1. Every §6 card + 5 generic §7 cards in src/library/catalog/*.ts with learningInsight
- [x] 2. genres.ts from §1 and §5
- [x] 3. retrieval.ts
- [x] 4. pnpm library:report
- [x] 5. Tests: catalog validation, golden retrieval, implemented-filtering

## P3 — Runtime + Dungeon host (checkpoint: runtime-dungeon) — done (checkpoint 07)
- [x] 1. /play/[id] loads a spec; /play/fixture-trig in dev
- [x] 2. Dungeon host (prefab rooms, palette tint, freeze at socket, consequence/failure overlay)
- [x] 3. Widgets: dial, pick, order, place
- [x] 4. Hint familiar, consequence overlay, mastery HUD, end screen posting telemetry
- [x] 5. window.__GAME_DEBUG__
- [x] 6. Playwright smoke: trig fixture autoSolve, zero console errors (dev server on port 3100; port 3000 is taken on this machine)

## P5a — Pipeline foundation (checkpoint: pipeline-foundation) — done 01:08
- [x] 1. llm.ts + models.ts incl. mock mode
- [x] 2. env.ts, event bus, storage drivers (local complete + tested; supabase driver typed but untested against a real project)
- [x] 3. supabase/schema.sql
- [x] 4. scripts/build-samples.ts → 3 sample PDFs from markdown notes
- [x] 5. POST /api/sources (pdf ≤40 pages | text | topic) with unpdf
- [x] 6. Quote verification utility + tests

## P4 — Wave-1 families (checkpoints: families-wave1a, families-wave1b, families-wave1-widgets) — done
- [x] 1. wave-1 modes: sorter.bins/type_match, linker.pairs/chain, investigator.elimination (checkpoint 05); tuner.formula, truth_finder.predict_reveal, sequencer.cycle/rank, mapper.plane (checkpoint 06)
- [x] 2. sort + link widgets, Dungeon skins (checkpoint 09)
- [x] 3. wave-1 flagships playable: phase_gate, number_line_leap, domino_engine, evidence_board, formula_engine + generic mimic_chest/chrono_bridge/type_matched_weapon/grapple_anchors/cycle_wheel (fixtures wave1a/wave1b; cell + history games)

## P5b — Front-half agents (checkpoint: pipeline-agents) — done
- [x] 1. gatekeeper, curriculum (+quote verification), intake endpoint, matcher
- [x] 2. prompt + schema + checker + mock responses for all 3 samples, per agent
- [x] 3. Genre-agnostic mock mode + "Mock mode" banner
- [x] 4. pnpm try:pdf

## P6 — Orchestrator back half (checkpoint: orchestrator) — done (checkpoint 21)
- [x] 1. POST /api/games → {jobId}
- [x] 2. GET /api/jobs/:id/stream (SSE) ending with {done, gameId}
- [x] 3. Director (dynamic schema), challenge writers ×N, narrative, assessment, assemble, verifier + blind solve, routed repair + fallback
- [x] 4. POST /api/games/:id/regenerate {genre}
- [x] 5. Shared context first in every builder prompt
- [~] 6. Challenge bank (optional) — skipped tonight; noted in MORNING_REPORT
- [x] 7. Mock e2e test: sample PDF → validated GameSpec → headless autoSolve

## P7 — UI + golden path (checkpoints: golden-path, review-fixes)
- [x] 1. Pages: /, /intake/[id], /forge/[id], /play/[id], /debrief/[id], /library (live against the mock pipeline; projector polish done, checkpoint 30)
- [x] 2. Projector-friendly design, no layout shift (dark theme default, skeletons, fixed-height forge cards)
- [x] 3. Playwright e2e golden path + screenshots in docs/overnight/screens/ (checkpoint 23)
- [x] 4. pnpm build passes
- [x] 5. reviewer pass done and every finding fixed: C1 widget coverage (checkpoint 33), H1 ids (30, 31), H2–H4 + test gaps (34), M1–M9 pipeline hardening (35), mathjs sandbox + genre flag (final)

## P11 — Demo insurance (checkpoint: showcase)
- [x] 1. Showcase fixtures: trig-dungeon, cell-transport-dungeon, civil-rights-dungeon, civil-rights-mystery (+ wave2-dungeon proving ground), all built by `pnpm fixtures:build`
- [x] 2. Wired to home cards (checkpoint 30)
- [x] 3. Regenerate-as-genre on showcase games (fixture games materialize into storage on first use; checkpoints 25, 31; e2e `flows.spec.ts`)

## P9 — Wave-2 families (one checkpoint per 1–2 families) — done except the modes listed in MORNING_REPORT §2
- [x] 1. function_world limit (main) + slope (worker) — checkpoint 11
- [x] 2. balance (equation, chem_equation, ledger) — checkpoint 11
- [x] 3. simulator (intervene, sample, predict, reach_state) + 6. accumulator (riemann, area, signed, rate_total, average_value) — checkpoints 20, 28
- [x] 4. builder (circuit, molecule, genetics, program, electron_config, tiles, sentence) + build widget — checkpoints 22, 27
- [x] 5. transformer: encode + function_machine (checkpoint 12), trace (checkpoint 14) by main
- [x] 6. accumulator (riemann, area) — checkpoint 20
- [x] 7. recall (rapid, cloze) + type widget — checkpoints 13, 22
- [~] 8. still catalog-only (13 cards): mapper.map, function_world.squeeze/epsilon_delta, transformer.inverse/domain_filter/matrix/geometric, recall.memory_palace/listen — stubbed behind `stubMode`, listed in MORNING_REPORT §8

## P10 — More genres (one checkpoint per genre) — Mystery done; others play in the DOM host with a banner
- [x] 1. Mystery host (checkpoint 15; genre enabled; 4 play e2e tests)
- [x] 2. Platformer host — checkpoint 36 (Phaser arcade physics, 6 socket kinds, `fixtures/trig-platformer`, e2e); playable on request, not auto-selected (DECISIONS 02:30)
- [~] 3. Puzzle host — not started (DOM host fallback)
- [~] 4. Strategy (stretch) — not started (DOM host fallback)

## P8 — Audio, code only (checkpoint: audio) — done by main (checkpoint 10)
- [x] scripts/audio-library.ts, src/pipeline/audio/ (Flash TTS, concurrency 4, hash cache, 25 s deadline, dialogue flag), smoke:elevenlabs, AUDIO_MODE=off no-ops; wired into the orchestrator after the verifier

## P12 — Final pass (checkpoint: overnight-final)
- [x] 1. typecheck, test, e2e, build — all green 02:50 (59 files / 944 tests; 13 e2e; build clean; lint 0 errors)
- [x] 2. Finalize FIRST_RUN.md + MORNING_REPORT.md — 02:55
- [x] 3. Checkpoint — 40-overnight-final
- [x] 4. STATUS: COMPLETE on line 1
- [x] 5. Delete .overnight/ENABLED

## V — Variant-fidelity rebuild of the showcase games (started 2026-09-26 11:30; demo 2026-09-27)
Plan: docs/design/40-implementation-plan.md; spec: docs/design/20-expedition-architecture.md §7 (10 lanes).
- [x] V.0 Design docs 00–31 (runtime map, bible, assets, three game docs, architecture rev 3, two critiques, reconciliation) — 14:55
- [x] V.1 Wave 0: world contract, world library skeleton, real config schemas, prefab stubs, side-car skeletons, tests (63 files / 1063 tests green) — 15:50, commit 5edae8e
- [x] V.2 Wave 1a (15:55–19:25; 15 agents; typecheck 0, 139 files / 1960 tests, e2e 19 passed, build green; all three games boot the Expedition host): V1 validation, H1 host core, P1 panel, S1 story systems, A1 art pipeline, KA1–2 / KB1–2 / KC1–2 contraptions, C0 side-cars, E1 harness, H2 client → verification report docs/design/w1a-report.md
- [ ] V.3 Wave 1b (running 19:35): main fix 20:05 — R1 missing-asset keys are warnings for side-cars (errors only for World Writer output) so all three worlds keep resolving while art lands; H3 integration, A2–A3 kit zones + vistas, KA3–4 / KB3–4 / KC3–4, C1–C3 content + hero art, E2–E3 e2e + captures, Gate V critic, fidelity rounds, P0 freeze report + docs/ADVANCED_GAMES.md
- [ ] V.4 P1/P2 (sandboxes, side quests, remaining art, maps) if time remains

