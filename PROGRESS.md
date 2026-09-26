STATUS: IN PROGRESS
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
- [ ] Accept: typecheck + test + build pass, doctor runs → checkpoint `bootstrap`

## P1 — Contracts v2 (checkpoint: contracts-v2) — done 00:05
- [x] 1. Section 5 contracts (enums, KnowledgeMap, Intake, TeachingMechanic, MechanicFamily, MatchResult, Blueprint, GameSpec v2, Telemetry, Mastery, ProgressEvent, StorageDriver)
- [x] 2. Migrate 4 seed mechanics into families/modes
- [x] 3. Trig fixture rebuilt to v2 from slices
- [x] 4. Strict-schema audit green
- [x] 5. Mock pipeline test reproduces v2 fixture exactly

## P2 — Library encoding (checkpoint: library-catalog)
- [ ] 1. Every §6 card + 5 generic §7 cards in src/library/catalog/*.ts with learningInsight
- [ ] 2. genres.ts from §1 and §5
- [ ] 3. retrieval.ts
- [ ] 4. pnpm library:report
- [ ] 5. Tests: catalog validation, golden retrieval, implemented-filtering

## P3 — Runtime + Dungeon host (checkpoint: runtime-dungeon)
- [ ] 1. /play/[id] loads a spec; /play/fixture-trig in dev
- [ ] 2. Dungeon host (prefab rooms, palette tint, freeze at socket, consequence/failure overlay)
- [ ] 3. Widgets: dial, pick, order, place
- [ ] 4. Hint familiar, consequence overlay, mastery HUD, end screen posting telemetry
- [ ] 5. window.__GAME_DEBUG__
- [ ] 6. Playwright smoke: trig fixture autoSolve, zero console errors

## P5a — Pipeline foundation (checkpoint: pipeline-foundation)
- [ ] 1. llm.ts + models.ts incl. mock mode
- [ ] 2. env.ts, event bus, storage drivers (local complete, supabase untested)
- [ ] 3. supabase/schema.sql
- [ ] 4. scripts/build-samples.ts → 3 sample PDFs from markdown notes
- [ ] 5. POST /api/sources (pdf ≤40 pages | text | topic) with unpdf
- [ ] 6. Quote verification utility + tests

## P4 — Wave-1 families (checkpoint: families-wave1)
- [ ] 1. tuner(oscillator, formula), truth_finder(mimic, predict_reveal), sequencer(linear, cycle, rank), mapper(number_line, plane), sorter(bins, type_match), linker(pairs, chain), investigator(elimination)
- [ ] 2. sort + link widgets, Dungeon skins
- [ ] 3. 9 wave-1 flagships playable in Dungeon via fixtures

## P5b — Front-half agents (checkpoint: pipeline-agents)
- [ ] 1. gatekeeper, curriculum (+quote verification), intake endpoint, matcher
- [ ] 2. prompt + schema + checker + mock responses for all 3 samples, per agent
- [ ] 3. Genre-agnostic mock mode + "Mock mode" banner
- [ ] 4. pnpm try:pdf

## P6 — Orchestrator back half (checkpoint: orchestrator)
- [ ] 1. POST /api/games → {jobId}
- [ ] 2. GET /api/jobs/:id/stream (SSE) ending with {done, gameId}
- [ ] 3. Director (dynamic schema), challenge writers ×N, narrative, assessment, assemble, verifier + blind solve, routed repair + fallback
- [ ] 4. POST /api/games/:id/regenerate {genre}
- [ ] 5. Shared context first in every builder prompt
- [ ] 6. Challenge bank (optional)
- [ ] 7. Mock e2e test: sample PDF → validated GameSpec → headless autoSolve

## P7 — UI + golden path (checkpoints: golden-path, review-fixes)
- [ ] 1. Pages: /, /intake/[id], /forge/[id], /play/[id], /debrief/[id], /library
- [ ] 2. Projector-friendly design, no layout shift
- [ ] 3. Playwright e2e golden path + screenshots in docs/overnight/screens/
- [ ] 4. pnpm build passes
- [ ] 5. reviewer pass; fix critical + high

## P11 — Demo insurance (checkpoint: showcase)
- [ ] 1. Three showcase games as fixtures (trig, cell transport, history)
- [ ] 2. Wired to home cards
- [ ] 3. Regenerate-as-genre on showcase games

## P9 — Wave-2 families (one checkpoint per 1–2 families)
- [ ] 1. function_world (limit, slope)
- [ ] 2. balance (equation, chem_equation, ledger)
- [ ] 3. simulator (intervene, sample, predict)
- [ ] 4. builder (circuit, molecule) + build widget
- [ ] 5. transformer (encode, function_machine, trace)
- [ ] 6. accumulator (riemann, area)
- [ ] 7. recall (rapid, cloze) + type widget

## P10 — More genres (one checkpoint per genre)
- [ ] 1. Mystery host
- [ ] 2. Platformer host
- [ ] 3. Puzzle host
- [ ] 4. Strategy (stretch)

## P8 — Audio, code only (checkpoint: audio)
- [ ] scripts/audio-library.ts, src/pipeline/audio/, smoke:elevenlabs, AUDIO_MODE=off no-ops

## P12 — Final pass (checkpoint: overnight-final)
- [ ] 1. typecheck, test, e2e, build
- [ ] 2. Finalize FIRST_RUN.md + MORNING_REPORT.md
- [ ] 3. Checkpoint
- [ ] 4. STATUS: COMPLETE on line 1
- [ ] 5. Delete .overnight/ENABLED
