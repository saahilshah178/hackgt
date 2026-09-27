# instructions.md — Quest Forge (HackGT 13)

**Read this first.** Claude Code does not auto-load this file. Re-read it at the start of every phase, after any
context compaction, and before delegating. Every subagent brief says "Read instructions.md first".
The authoritative plan is `MEGAPROMPT.md`; the design library is `docs/LIBRARY.md`; the working starter we grew
from is `seed/gamespec-starter/` (read-only reference now; its code lives in `src/`).

## 1. Product

A student uploads a PDF, pastes text, or types a topic. A 60-second intake (confidence per unit, goal, length,
genre, 3-question pre-check) plus 60–90 s of generation yields a playable educational game built for what they're
weak at. **The concept becomes the rules of the game**: the player tunes a gate's period to open a door or
approaches a missing tile from both sides to find a limit; they never answer trivia between jumps.
**Games are data, not generated code.** LLM agents produce a zod-validated `GameSpec`; hand-built genre hosts
(Phaser 4) and mechanic families (TypeScript) render and grade it. The app name lives in one constant,
`APP_NAME` in `src/config.ts` (placeholder "Quest Forge").

## 2. Repo map and ownership

| Path | What lives there | Owner (may edit) |
|---|---|---|
| `src/contracts/` | zod contracts: single source of truth; inferred types exported | **main / architect only** |
| `src/library/` | `catalog/<domain>.ts` (teaching-mechanic cards), `genres.ts` (sockets, chunks, adapter matrix), `retrieval.ts`, `index.ts` | mechanics-dev |
| `src/mechanics/` | `families/<family>/<mode>.ts` + `index.ts`; `registry.ts`; shared `util.ts` | mechanics-dev |
| `src/pipeline/` | `llm.ts`, `models.ts`, `mock/`, `agents/`, `orchestrator.ts`, `assemble.ts`, `layout.ts`, `events.ts`, `validate/`, `audio/` | pipeline-dev |
| `src/server/` | `env.ts` (zod env), `storage/` (local, supabase), `ingest/` (unpdf, quote verification) | pipeline-dev |
| `src/app/api/` | route handlers: sources, sources/[id]/intake, games, jobs/[id]/stream (SSE), games/[id]/regenerate, blobs/[...path] | pipeline-dev |
| `src/app/` (pages) + `src/components/` | `/`, `/intake/[id]`, `/forge/[id]`, `/play/[id]`, `/debrief/[id]`, `/library`; styles | ui-dev |
| `src/game/` | `engine/` (Phaser helpers), `hosts/<genre>/` (side-view), `genre/` (board genres: GenreClient, ChallengePanel, `hosts/{puzzle,cozy,casefile,explorer,story}`), `widgets/` (React overlays), `systems/`, `runner/` (EncounterRunner, free-order `progression.ts`), `debug.ts` | engine-dev |
| `public/assets/` | Kenney 1-Bit Pack tiles (CC0) | engine-dev |
| `fixtures/` | knowledge maps, agent mock responses, GameSpecs per sample | mechanics-dev (encounters), pipeline-dev (agent mocks) |
| `samples/` | `trig-notes.pdf`, `cell-transport.pdf`, `civil-rights-history.pdf` + their `.md` sources | pipeline-dev |
| `scripts/` | doctor, smoke-*, try-pdf, build-samples, library-report, audio-library, build-fixtures | pipeline-dev |
| `supabase/schema.sql` | tables + buckets | pipeline-dev |
| `tests/` | Vitest unit tests | owner of the code under test |
| `e2e/` | Playwright: `play*.spec.ts` (engine-dev), flow specs (ui-dev) | see left |
| root docs (`instructions.md`, `FIRST_RUN.md`, `PROGRESS.md`, `DECISIONS.md`, `BLOCKERS.md`, `MORNING_REPORT.md`) | | main |
| `reviewer` | read-only report; edits nothing | — |

If you need a change outside your paths (especially `src/contracts/`), stop and report the exact change.
Run parallel subagents only when their owned paths don't overlap.

## 3. Data flow (MEGAPROMPT §3)

```
UPLOAD (PDF | text | topic)
  S0 Ingest (code)        unpdf per-page text → sources/pages; topic → unsourced
  S1 Gatekeeper (FAST)    educational? size? outline, followUps
  S2 Curriculum (SMART)   KnowledgeMap; code verifies every quote appears on its page, drops failures
  ├─ S3 Intake (UI+FAST)  confidence/unit, goal, minutes, genre, 3 pre-check MCQs
  ├─ S4 Matcher (code+FAST) per concept: catalog retrieval top-12 → FAST picks 3 (+ wishlist)
  └─ S5 Challenge bank    optional pre-generation
  S6 Director (SMART)     Blueprint (dynamic schema: card/socket/concept enums)
  S7 Builders (parallel)  challenge ×N (SMART) | narrative (FAST) | assessment (FAST) | audio (optional)
  S8 Assemble (code)      resolve(), placeholders, seeded shuffles, prefab layout
  S9 Verifier             structural → referential → semantic → self-solve → blind-solve → routed repair → fallback
  → GameSpec v2 → S10 Runtime (genre host + widgets + EncounterRunner) → telemetry → S11 Debrief
```

Orchestration is plain async TypeScript, `Promise.all`, and an in-memory event bus feeding SSE. No agent frameworks.
Every LLM call goes through `runAgent()` in `src/pipeline/llm.ts`: `generateText` + `Output.object({schema, name})`,
one repair retry on zod/check failure, 429/503 retry honoring Retry-After, global concurrency 6 (p-limit),
`{jobId, agent, status, ms, note}` events. Model ids live only in `src/pipeline/models.ts`, overridable by env.

## 4. Generation rules (non-negotiable; `tests/strict-schemas.test.ts` enforces the schema half)

- **LLM-facing schemas are strict-mode legal.** Root object; every field required (`.nullable()`, never
  `.optional()`/`.default()`); no `z.record`; `z.union` never `z.discriminatedUnion`; single-value `z.enum` never
  `z.literal`; no string length/regex/format; bound every integer; `.describe()` is an instruction to the model.
- **References are dynamic enums** built from the current job (concepts, cards, sockets, characters, encounters).
- **The model writes primitives; code derives everything else.** Numbers from mathjs; answer keys from `resolve()`;
  shuffles from the spec seed; MCQs as `correct` + `distractors`, shuffled by code; computed values only via
  `{{placeholders}}`; answer placeholders banned from `prompt`, `hints[0]`, `wrongFeedback`.
- **Validation and repair.** Layered; each issue carries `path` + `owner`; one routed repair round; a writer that
  fails twice becomes a Mimic Chest from verified facts or is dropped (never the boss); Director/code issues fail fast.
- **Blind solve** for `blindSolvable` modes; disagreement → regenerate once → fallback. Every verifier catch becomes a
  Forge-screen progress note.
- **Director rules:** weight `w = (core?2:1)·(6 − unit confidence)`; 5 min → 5–7 encounters, 10 → 8–12, 15 → 11–14;
  weak concepts 2–3× via different families; one review after ≥ 2 encounters; teach before practice; boss last,
  combining the 2–3 weakest; theme tied to subject; target a listed misconception when the card allows.

## 5. Code conventions

- TypeScript strict. No `any` in contracts. `"type": "module"`; ESM everywhere.
- Library code (`src/contracts`, `src/mechanics`, `src/library`, `src/pipeline`, `src/server`, `src/game/runner`)
  uses **relative imports** so `tsx` scripts and Vitest run without alias tricks. App code (`src/app`,
  `src/components`, `src/game/hosts|widgets`) may use `@/`.
- Unit tests for every checker, grader, resolver, and retrieval function. No real API calls in tests (Vitest sets
  `LLM_MODE=mock` etc.). Playwright starts `pnpm dev` in mock mode.
- Secrets are read only in `src/server/env.ts` (server). Nothing secret in `NEXT_PUBLIC_*`.
- Phaser 4 is **client-only** via `next/dynamic` with `ssr: false`; it is WebGL-only; tint uses
  `setTint()` + `setTintMode()`. Widgets are React overlays above the canvas: keyboard usable, palette-aware,
  projector-legible.
- Every page must be usable by keyboard and legible on a projector (large type, high contrast, no layout shift).
- Ids are lowercase snake_case (`Id` regex in `src/contracts/common.ts`), enforced on stored specs, not LLM schemas.

## 6. Working rules (MEGAPROMPT §0, condensed)

1. **Git:** never `commit`, `push`, `merge`, `rebase`, `reset`, `stash`, `checkout --`, `restore`, `clean`, `tag`.
   No co-author trailers. Read-only git is fine. Checkpoints replace commits.
2. **Subagents:** only `architect`/`reviewer` (opus) and `engine-dev`/`mechanics-dev`/`pipeline-dev`/`ui-dev`/`Explore`
   (sonnet); pass `model` explicitly; ≤ 3 at once; depth 1. Contracts, integration, cross-cutting debugging and
   checkpoints stay in the main session.
3. **Never ask the user.** Ambiguity → pick, log in `DECISIONS.md`. Blocked → `BLOCKERS.md`, stub behind the
   interface with `TODO(overnight)`, checkpoint, move on. Timebox: 2× estimate → stub.
4. **Spend nothing:** no OpenAI/ElevenLabs/Supabase/Google calls. `LLM_MODE=mock`, `STORAGE_DRIVER=local`,
   `AUDIO_MODE=off`. npm, docs, GitHub, Kenney downloads are fine.
5. **Never create `CLAUDE.md` or `AGENTS.md`.** This file is the instruction file.
6. **Checkpoints:** `bash .overnight/checkpoint.sh <slug> "<imperative message ≤ 72 chars>"` when typecheck + test
   (+ build where the phase says) are green. ≤ ~1,500 changed lines each. Never run `replay-checkpoints.sh`.
7. Keep `PROGRESS.md` and `MORNING_REPORT.md` current. `STATUS: COMPLETE` + delete `.overnight/ENABLED` at the end.
8. **Verify, don't trust memory:** `npm view <pkg> version` and current docs before using a package. Pin exact versions.

## 7. Commands

| Command | What |
|---|---|
| `pnpm dev` / `pnpm build` / `pnpm start` | Next.js 16 (Turbopack) |
| `pnpm typecheck` | `tsc --noEmit` (TypeScript 5.9.3) |
| `pnpm test` | Vitest 5 unit tests (`tests/**`, `src/**/*.test.ts`) |
| `pnpm e2e` | Playwright 1.63 (`e2e/**`), starts the app in mock mode |
| `pnpm run doctor` | modes, missing env vars per stage, tool versions, next step (`pnpm doctor` alone is pnpm's own builtin) |
| `pnpm smoke:openai` / `smoke:elevenlabs` / `smoke:supabase` | one real call each; need keys |
| `pnpm try:pdf <path>` | S0–S4 on a PDF, prints verdict, concepts, quotes, matches |
| `pnpm samples:build` | writes `samples/*.pdf` from `samples/*.md` with pdf-lib |
| `pnpm library:report` | catalog counts, flagships, validation errors |
| `pnpm audio:library` | ElevenLabs music loops + SFX (only with a key) |
| `pnpm fixtures:build` | slices → assemble → validate → `fixtures/*.json` (never hand-edit fixture JSON) |

Pinned stack (verified 2026-09-25): next 16.3.6 · react 19.3.0 · phaser 4.2.1 · ai 7.0.116 · @ai-sdk/openai 4.0.78 ·
zod 4.6.5 · mathjs 15.2.0 · unpdf 1.8.1 · p-limit 7.3.3 · @elevenlabs/elevenlabs-js 2.69.0 ·
@supabase/supabase-js 2.117.2 · pdf-lib 1.17.1 · tailwindcss 4.3.3 · vitest 5.0.2 · @playwright/test 1.63.0 ·
typescript 5.9.3 · tsx 4.23.15 · pnpm 12.6.0 · node 26.5.1.

## 8. Mock mode

`LLM_MODE=mock` swaps every model for `MockLanguageModelV4` (from `ai/test`) that serves recorded fixture
responses keyed by agent (system prompt prefix) and, for challenge writers, by `ENCOUNTER_ID`. The real pipeline
code runs (schemas, checks, repairs, assembly, verification); only the network is replaced. Unknown uploads in mock
mode map to the trig sample and the UI shows a "Mock mode" banner. `STORAGE_DRIVER=local` writes JSON under `.data/`
(gitignored), served by `/api/blobs/[...path]`. `AUDIO_MODE=off` makes the audio pipeline a no-op. The whole demo,
every test, and every e2e run works with zero keys.

## 9. HTTP API contract (server routes in `src/app/api/`, consumed by the pages)

All JSON. Errors are `{ error: string, step?: string }` with a 4xx/5xx status; `step` names the FIRST_RUN.md step when a key is missing.

| Route | Body → Response |
|---|---|
| `POST /api/sources` | multipart `file` (PDF ≤ 40 pages) **or** `{ text, title? }` **or** `{ topic }` → `{ sourceId, kind: "pdf"\|"text"\|"topic", title, pageCount }` |
| `GET /api/sources/:id` | → `SourceRecord & { pageCount }` |
| `GET /api/sources/:id/intake` | runs S1 gatekeeper → S2 curriculum (+ quote verification) → FAST pre-check once, caches in storage, starts S4 matcher in the background → `{ source, gatekeeper: GatekeeperSlice, knowledgeMap: KnowledgeMap, dropped: { conceptId, page, quote }[], preCheck: Mcq[3], mock: boolean }` |
| `GET /api/sources/:id/matches` | → `MatchResult[]` (waits for the background matcher; `{ pending: true }` with 202 if still running) |
| `POST /api/games` | `{ sourceId, intake: Intake, sections?: string[] }` → stores the intake, starts S6–S9 as a job → `{ jobId }` (202). `sections` = outline titles the student ticked when the source was too big (optional; the Director may ignore it tonight) |
| `GET /api/jobs/:id` | → `JobRecord` |
| `GET /api/jobs/:id/stream` | SSE: `event: progress` / `data: ProgressEvent` per line, replayed from history for late subscribers; ends with `event: done` / `data: { done: true, gameId, error }` |
| `GET /api/games/:id` | → `GameRecord` (spec inside) |
| `POST /api/games/:id/regenerate` | `{ genre: Genre \| "auto", focusWeak?: boolean }` → reuses the KnowledgeMap, intake and matches → `{ jobId }` |
| `POST /api/games/:id/telemetry` | `TelemetryEvent[]` → `{ ok: true, count }` |
| `POST /api/games/:id/postcheck` | `{ answers: number[] (option index per item, or -1 = "not sure"; -1 never scores) }` → `{ ok: true, pre: number, post: number }` (stores the post-check answers; scores are also computed client-side) |
| `GET /api/games/:id/telemetry` | → `TelemetryEvent[]` |
| `GET /api/games` | → `GameSummary[]` |
| `GET /api/blobs/*path` | the stored blob (LocalDriver) |

Genres: seven, all implemented (`IMPLEMENTED_GENRES`, `src/library/genres.ts`), all pure 2D. Two walk left to right on the
legacy side-view hosts in `src/game/hosts` (dungeon, platformer). Five are **board genres** (`BOARD_GENRES`) that play in
`src/game/genre` on a free-order runner with their own progression verb and, mostly, no avatar: `puzzle` (logic board: rotate
conduit tiles to route power to sealed challenge tiles), `strategy` (cozy management sim: villagers' requests day by day,
coins grow the town), `mystery` (point-and-click: search scenes, combine two clues into a lead, crack it, accuse), `explorer`
(top-down maze: walk a bird's-eye map in any order past patrolling sentries) and `story` (narrative: choose the thread, explain
ideas to characters). `AUTO_GENRES` (everything but platformer) drives `genre: "auto"` from `GENRE_WEIGHTS`, which gives each
knowledge type a non-side-scroller home. `?host=legacy` still reaches the old MysteryHost / DOM fallback. Design notes:
`docs/design/50-board-genres.md`.

Page ids: `/intake/[sourceId]`, `/forge/[jobId]`, `/play/[gameId]` (also `/play/fixture-<name>` in dev), `/debrief/[gameId]`.
Fixture games: `/play/fixture-<name>` loads `fixtures/<name>.json` (or `<name>-dungeon.json`) without storage. The runner's end
screen posts telemetry and links to the debrief under the spec's OWN id (e.g. `trig_demo_001`), so the game routes
(`telemetry`, `regenerate`, `postcheck` via `getGame`) accept either spelling: `src/server/fixtures.ts` resolves both and
materializes the fixture into storage (game + knowledge map + source + intake) on first contact. Unknown ids are 404;
every id is regex-validated before it reaches the filesystem.
Mock mode: `GET /api/sources/:id/intake` returns `mock: true` and every page shows a "Mock mode" banner from `src/components/mock-banner.tsx`.
