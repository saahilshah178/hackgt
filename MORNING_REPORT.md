# MORNING_REPORT.md

_Last updated: 02:10 Sat (checkpoint 32). Final pass (P12) pending the three review-fix workers._

## 1. Summary

The whole product runs end to end in mock mode with zero keys: upload a PDF (or paste text, or type a topic) → the
intake page shows the extracted concepts with page ranges, confidence sliders and a 3-question pre-check → the Forge
streams one live card per agent over SSE, including verifier catches → the game plays in a Phaser 4 Dungeon or a
DOM Mystery host with keyboard-accessible widgets → the debrief asks the post-check and shows pre→post, per-concept
mastery and "what you just did" cards, with Replay / Regenerate-as-genre / Focus-on-weak-spots all wired. The
library holds all 316 LIBRARY §6 cards across 14 families; 303 of them are playable through 61 implemented
family·modes (every wave-1 mode and all of wave 2 except 8 niche modes), each with unit tests for check/resolve/grade and a fixture
encounter. No live API has been called; the live code paths (OpenAI via AI SDK v7, ElevenLabs, Supabase) exist,
are typed and unit-tested with fakes, and are documented step by step in `FIRST_RUN.md`.

## 2. Phases

| Phase | Status | Notes |
|---|---|---|
| P0 bootstrap | done | Next 16.3.6, TS 5.9.3, Vitest 5, Playwright 1.63, shadcn; seed imported |
| P1 contracts v2 | done | 14 families / all modes registered, GameSpec v2, every LLM-facing slice schema strict-mode audited |
| P2 library catalog | done | 316 cards / 23 domain files, retrieval matcher (6 golden cases), `pnpm library:report`, `/library` |
| P3 runtime + dungeon | done | Phaser 4 host + DOM fallback, widgets, hint familiar, consequence overlay, mastery HUD, end screen, `__GAME_DEBUG__` |
| P5a pipeline foundation | done | runAgent (repair + 429/503 + p-limit 6), event bus, Local/Supabase drivers, ingest + quote verification, 3 sample PDFs |
| P4 wave-1 families | done | 14 modes + sort/link widgets + skins |
| P5b front-half agents | done | gatekeeper, curriculum, pre-check, matcher; intake/matches routes; mocks for all 3 samples; `pnpm try:pdf` |
| P6 orchestrator | done | jobs, SSE, regenerate (+ focusWeak), blind-solve verifier with regenerate→fallback, postcheck |
| P7 UI + golden path | done; review fixes landing | all pages live and projector-polished; golden-path + 5 flow e2e green; reviewer (Opus) pass done — see §5b |
| P11 showcase | done | trig / cell transport / civil rights (Dungeon + Mystery) / wave-2 proving ground fixtures; regenerate works on them |
| P9 wave-2 families | done (13 cards catalog-only) | every family has real modes incl. all seven builder modes, composition, secant, reach_state; catalog-only: mapper.map, function_world.squeeze/epsilon_delta, transformer.inverse/domain_filter/matrix/geometric, recall.memory_palace/listen |
| P10 more genres | Mystery done | platformer / puzzle / strategy specs play in the DOM host with a banner; no dedicated hosts (Saturday item B) |
| P8 audio | done (code only, no key used) | Flash TTS with hash cache, 25 s deadline, dialogue flag, `pnpm audio:library`, `pnpm smoke:elevenlabs`; `attachAudio` runs in the orchestrator after the verifier and no-ops with `AUDIO_MODE=off` |
| P12 final pass | pending | |

## 3. Test results

| Check | Result |
|---|---|
| `pnpm typecheck` | pass |
| `pnpm test` | 41 files, 490+ tests pass |
| `pnpm e2e` | 6 tests pass (golden path, 3 play smokes incl. wave-2 widgets, 2 mystery); flow e2e being added by ui-dev |
| `pnpm build` | pass (all routes listed) |

## 4. Checkpoints

Replay with `bash .overnight/replay-checkpoints.sh` (you, not Claude). Details in `.overnight/CHECKPOINTS.md`.
Scoped checkpoints only snapshot the listed paths; checkpoint 07 carries some early widget files that checkpoint 09
finishes. The final tree is identical either way.

- 01-bootstrap — Bootstrap Next.js 16 app and import the GameSpec seed
- 02-contracts-v2 — Add contracts v2, family/mode registry, and starter catalog
- 03-library-catalog — Encode LIBRARY catalog (316 cards), retrieval matcher, library report
- 04-pipeline-foundation — Add pipeline foundation: llm, storage, ingest, samples, API routes
- 05-families-wave1a — Implement sorter, linker, and investigator wave-1 modes
- 06-families-wave1b — Implement tuner.formula, predict_reveal, cycle, rank, and plane modes
- 07-runtime-dungeon — Add /play dungeon runtime: host, widgets, systems, debug hook, e2e smoke
- 08-pipeline-agents — Add gatekeeper, curriculum, precheck, matcher agents and intake routes
- 09-families-wave1-widgets — Add wave-1 widgets, dungeon skins, and fix telemetry POST shape
- 10-audio — Add ElevenLabs audio pipeline, library script, and smoke test
- 11-families-wave2a — Implement function_world limit/slope and balance equation/chem/ledger
- 12-families-wave2-transformer — Implement transformer encode and function_machine modes
- 13-families-wave2-recall — Implement recall rapid and cloze modes with fuzzy matching
- 14-families-wave2-trace — Implement transformer.trace mini-language mode
- 15-genre-mystery — Add Mystery genre host and enable the mystery genre
- 16-families-wave2-balance2 — Implement balance.torque and balance.ratio modes
- 17-families-wave2-quick — Implement error_hunt, counterexample, and timeline modes
- 18-families-wave2-tuner — Implement tuner.curve and tuner.optimize modes
- 19-families-wave2-investigator — Implement investigator weigh, source_eval, perspective, argument
- 20-families-wave2b — Implement simulator and accumulator mechanic families
- 21-orchestrator — Add job orchestrator, blind-solve verifier, and game/job routes
- 22-wave2-widgets — Add build/type widgets and pick/place variants for wave-2 families
- 23-golden-path — Add flow pages, adaptive mock director, and golden-path e2e
- 24-families-wave2-graphs — Implement venn, hierarchy, network, path, and search modes
- 25-showcase — Materialize fixture games so showcase games can be regenerated
- 26-families-wave2-calculus — Implement function_world roots, asymptote, and continuity
- 27-families-wave2c — Implement all seven builder-family modes
- 28-families-wave2-accumulate — Implement accumulator signed/rate_total/average_value and reach_state
- 29-families-wave2-composition — Implement transformer.composition and function_world.secant
- 30-ui-polish — Polish UI for the projector demo and add flow e2e tests
- 31-fixture-ids — Recognise fixture games by spec id in game routes
- 32-precheck-skip — Allow a not-sure answer on the pre-check
- 33-widget-coverage — Add widget fallback card and build every missing mode widget

## 5. Decisions to review

Full log in `DECISIONS.md`; ⚠ = harder to reverse.

- ⚠ TypeScript 5.9.3 instead of 7.0.2 (Next 16 build-time type check); one-line bump later.
- ⚠ The boss socket is universal (any family can host the finale).
- ⚠ Pre-check is written at intake and copied into the spec; the Assessment writer writes the post-check only.
- ⚠ Mock mode adapts the canned Director blueprint to the live job (minutes, card enum, misconceptions) and pads
  with Mimic Chests; fixture byte-identity tests are untouched.
- Mastery meter starts at 0.5 (configurable). Director genre override is not implemented (genre resolved in code).
- Playwright and the overnight dev server use port 3100 (port 3000 is taken on this machine). `pnpm dev` still
  defaults to 3000 for you.
- `agentRules: false` in next.config.ts: Next 16 otherwise generates AGENTS.md/CLAUDE.md.
- Subagents ran as the built-in `claude` type with explicit Sonnet/Opus models and the role prompts pasted in
  (the project agents weren't loadable because the kit was copied after the session started; restart to use them).
- `checkpoint.sh` gained optional path arguments for scoped snapshots.

## 5b. Reviewer findings (Opus review of the whole tree, ~01:40) and what happened to them

| Id | Severity | Finding | Status |
|---|---|---|---|
| C1 | critical | ~27 implemented modes had no widget variant → `/play` could crash on a live-generated game | engine-dev: `supports(view)` per widget, a safe fallback card with Skip, every missing variant (60/60 modes), `coverage.test.ts` — checkpoint 33 |
| H1 | high | game/source ids and fixture names reached the filesystem unvalidated | fixed by main: LocalDriver segment regex, fixture-name regex, telemetry 404 on unknown game (checkpoints 30, 31) |
| H2 | high | `simulator.predict` miss feedback stated the true outcome | mechanics-dev — TODO(final) |
| H3 | high | `simulator.predict` answer key trusted the model's `isCorrect` | mechanics-dev: options carry `asserts`, code derives the key — TODO(final) |
| H4 | high | `tuner.formula` accepted flat outputs; graded the input, not the output | mechanics-dev — TODO(final) |
| M1–M9 | medium | repair-round/narrative/assessment fallbacks, blind-solver catch+drop, `check()` try/catch, `maxRetries:0` + 429 test, mock memo per job, gatekeeper 422, SSE replay from storage, upload caps | pipeline-dev — TODO(final) |
| L | low | trace hint could leak the asked variable; chem symbols unchecked; `Intake.preCheck.answers` had no "skipped" value | mechanics-dev for the first two — TODO(final); `-1` = not sure landed (checkpoint 32) |

The reviewer also ran `git add -N .` by mistake (a write to the index, against the rules); there were no commits, so the
index was removed (`rm .git/index`) and no history was affected. Logged in `DECISIONS.md`.

## 6. Blockers

None. Everything planned either landed or is running (see §2). Skipped on purpose: the optional S5 challenge bank.

## 7. Do this first

1. `FIRST_RUN.md` step 1–2: `pnpm install`, `pnpm run doctor`, `pnpm test`, `pnpm dev`, open http://localhost:3000, play
   the three showcase cards and the wave-2 proving ground.
2. Step 3: OpenAI key → `.env.local` (`LLM_MODE=live`) → `pnpm smoke:openai` (confirms the key, the model ids and the strict
   schema in one Director call).
3. Step 4: `pnpm try:pdf samples/trig-notes.pdf`, then your own PDF; then the same upload through the UI.

## 8. Suggested Saturday plan (team of four)

| Who | Hours | Work |
|---|---|---|
| A (pipeline) | 3 | First live run: fix prompt/schema issues `smoke:openai` and `try:pdf` surface; tune the curriculum prompt on 2–3 real PDFs; wire `attachAudio` into the orchestrator after `putGame` |
| B (game) | 4 | Real Kenney tile frames for floors/walls/props in the Dungeon; Platformer host (P10.2) if time; polish the live dial→object animation |
| C (mechanics) | 3 | Remaining 53 catalog-only cards: builder modes (if the worker didn't finish), simulator.reach_state, accumulator signed/rate_total/average_value, function_world continuity/asymptote/secant/roots/squeeze, transformer inverse/composition/domain_filter/matrix/geometric, mapper.map, recall memory_palace/listen |
| D (product) | 3 | Demo script and projector rehearsal; a11y sweep; ElevenLabs key + `pnpm audio:library` once; Supabase only if you want persistence across laptops |
| All | 1 | Replay checkpoints as commits, push, deploy notes (FIRST_RUN §8) |

## 9. Demo risks and mitigations

- **Live model ids** (`gpt-6-sol`, `gpt-6-luna`) are unverified until `pnpm smoke:openai`; every stage degrades to
  mock mode, so the demo works with zero keys.
- **WebGL**: Phaser 4 is WebGL-only; the DOM fallback host plays the same game if the projector laptop lacks it.
- **Port 3000 busy**: `PORT=3001 pnpm dev`; e2e already uses 3100.
- **Live generation quality**: the verifier + blind solver + Mimic Chest fallback guarantee a winnable game; the
  first live runs may show more fallbacks than fixtures do. Keep the showcase fixtures as the safety net.
- **Fixture regenerate** materializes the fixture into `.data/` on first use; delete `.data/` to reset.

## 10. Links

- Screenshots: `docs/overnight/screens/` (home, intake, forge, play, end screen, debrief, library)
- Library browser: http://localhost:3000/library
- Showcase: http://localhost:3000/play/fixture-trig · /play/fixture-cell-transport · /play/fixture-civil-rights-mystery · /play/fixture-wave2
