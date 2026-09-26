# MEGAPROMPT: overnight build of the AI educational game generator (HackGT 13)

You are the lead engineer on an unattended overnight build. I'm asleep and will read `MORNING_REPORT.md` at about 8 AM Saturday. The demo is Sunday.

Read this entire file before doing anything. Then read `docs/LIBRARY.md` completely, and after it `seed/gamespec-starter/README.md` and its source. Then execute the phases in section 9, in order, without asking me anything.

---

## 0. Non-negotiable rules

1. **Git.**
   - Never run `git commit`, `git push`, `merge`, `rebase`, `reset`, `stash`, `checkout -- <files>`, `restore`, `clean`, or `tag`.
   - Never add co-author trailers.
   - `git init` (only if there is no repo yet) and read-only commands (`status`, `diff`, `log`, `show`) are fine.
   - `.claude/settings.json` denies the dangerous commands; the rule applies even where it doesn't.
2. **Models and subagents (cost control).**
   - The main session runs on Opus. It is pinned in `.claude/settings.json`.
   - Delegate only to the project subagents in `.claude/agents/`:
     - `architect` (opus)
     - `reviewer` (opus)
     - `engine-dev`, `mechanics-dev`, `pipeline-dev`, `ui-dev` (sonnet)
     - `Explore` (sonnet, read-only)
   - On every Agent call, pass `model` explicitly: `"opus"` for architect and reviewer, `"sonnet"` for all others.
   - Never request `fable`, `haiku`, or `inherit`.
   - Never spawn forks, the built-in Plan agent, or the general-purpose agent.
   - At most 3 subagents may run at once. Subagents cannot spawn subagents; depth is capped at 1.
   - Delegate a task when it is self-contained, has clear file ownership, and would take more than about 30 minutes or flood your context.
   - Keep contracts, integration, cross-cutting debugging, and checkpoints in the main session.
3. **Never ask me anything or wait for input.**
   - When something is ambiguous, choose what best fits this file, log it in `DECISIONS.md` (one line of decision, one line of alternative), and continue.
   - When blocked:
     1. Write the blocker to `BLOCKERS.md`.
     2. Stub the piece behind its interface with a `TODO(overnight)` comment.
     3. Checkpoint.
     4. Move on.
   - Timebox: if a step takes more than twice its estimate, stub it and move on.
4. **Spend nothing.**
   - Make no calls to paid APIs tonight: OpenAI, ElevenLabs, Supabase, and Google. The keys won't exist.
   - Everything must run in mock mode (`LLM_MODE=mock`, `STORAGE_DRIVER=local`, `AUDIO_MODE=off`).
   - Network access is fine for npm, official docs, GitHub, and downloading the CC0 Kenney asset pack.
5. **Instruction file.**
   - Create and maintain `instructions.md` at the repo root. Never create `CLAUDE.md` or `AGENTS.md`.
   - Claude Code does not auto-load `instructions.md`, so:
     - Re-read it at the start of every phase and after any context compaction.
     - Tell every subagent to read it first.
6. **Checkpoints, not commits.**
   - Run a checkpoint when a phase or sizable sub-step is green: `pnpm typecheck` and `pnpm test` pass, plus `pnpm build` where the phase says so.
   - Command: `bash .overnight/checkpoint.sh <slug> "<proposed commit message>"`
   - It snapshots the working tree into a git tree object without committing, saves a patch, and logs to `.overnight/CHECKPOINTS.md`. I replay the checkpoints as commits myself in the morning.
   - Never run `.overnight/replay-checkpoints.sh`.
   - Keep each checkpoint reviewable: one phase or sub-step, and split anything over about 1,500 changed lines.
   - Commit messages: imperative mood, ≤ 72 characters, no co-author lines.
7. **Keep going.**
   - Create `.overnight/ENABLED` in P0. While it exists, a Stop hook nudges you to continue.
   - Keep `PROGRESS.md` current: every phase and step as `[ ]`, `[x]`, or `[~] blocked: reason`, plus the time.
   - Update `MORNING_REPORT.md` at every checkpoint so it's useful even if the run dies midway.
   - When all phases are done or blocked:
     1. Finalize `FIRST_RUN.md` and `MORNING_REPORT.md`.
     2. Put `STATUS: COMPLETE` on the first line of `PROGRESS.md`.
     3. Delete `.overnight/ENABLED`.
   - If a usage limit pauses you, resume from `PROGRESS.md`.
8. **Verify; don't trust memory.**
   - Before using any package, check the current version with `npm view <pkg> version` and read its current docs with WebFetch.
   - This covers Next.js, Phaser 4, AI SDK v7 (`ai`), `@ai-sdk/openai`, zod 4, unpdf, the ElevenLabs JS SDK, `@supabase/supabase-js`, shadcn/ui, Tailwind, Vitest, and Playwright.
   - Pin exact versions. Several of these postdate your training data.
9. **Quality bar.**
   - TypeScript strict. No `any` in contracts.
   - Unit tests for every checker, grader, and resolver.
   - API keys are read only on the server; nothing secret goes in `NEXT_PUBLIC_*`.
   - No real API calls in tests.
   - Every page usable by keyboard and legible on a projector.

---

## 1. Product

A student uploads a PDF, pastes text, or types a topic. They answer a 60-second intake, and in about 60–90 seconds they get a playable educational game built for what they're weak at.

**The core claim: the concept becomes the rules of the game.** The student doesn't answer trivia between jumps. They tune a gate's period to get through the door, or approach a missing tile from both sides to find where the limit is.

**Games are data, not generated code.**
- LLM agents produce a **GameSpec**: JSON validated by zod.
- Hand-built **genre hosts** (Phaser) and **mechanic families** (TypeScript) render and grade it.

**Per-game flow:**
1. Upload.
2. "Here's what I found": the concepts, with page ranges.
3. Confidence sliders per unit, goal, length, genre, and a 3-question pre-check.
4. **Forge screen**: one live card per agent, including verifier catches.
5. Play.
6. **Debrief**: post-check, pre→post score, per-concept mastery, and "what you just did" cards.
7. Replay, Regenerate as another genre, or Focus on my weak spots.

**Showcase subjects for the demo:**
- Trigonometry (Dungeon; the seed already has it)
- Cell transport biology (Dungeon, then Platformer)
- A history chapter played as a Mystery

Keep the app name in one constant, `APP_NAME`, with placeholder value `"Quest Forge"`.

---

## 2. Inputs already in this repo

| Path | What it is | How to use it |
|---|---|---|
| `docs/LIBRARY.md` | The final genre + mechanic library: layers, 5 genres, 8 widgets, 14 families with modes, genre adapter matrix, 316 teaching-mechanic cards, flagships, cross-cutting systems, design rules, card schema | Encode it as data (P2) and follow it everywhere |
| `seed/gamespec-starter/` | Earlier working TypeScript starter: 27 passing tests, typechecks | Import it in P0 and evolve it. **Don't rewrite what works.** |
| `.claude/agents/*.md` | The only subagents you may use | See rule 2 |
| `.overnight/checkpoint.sh` | Checkpoint tool | See rule 6 |

The seed contains:
- **Contracts:** zod 4. LLM-facing slice schemas with dynamic enums and strict-mode rules, plus the stored GameSpec.
- **Mechanics:** four plugins with `paramsSchema`, `check`, `resolve`, `templateVars`, `answerVars`, `present`, `grade`, and `solutionInput`: `phase_gate`, `mimic_chest`, `chrono_bridge`, `number_line_leap`.
- **Validator:** structural → referential → semantic → self-solve. Every issue carries a path and an owner so repairs can be routed.
- **Assembler:** deterministic. Computes solutions, fills placeholders, shuffles MCQs, and builds the layout from prefab chunks.
- **Orchestrator:** AI SDK v7 `generateText` + `Output.object`, with a per-agent repair loop, parallel fan-out, fallback to Mimic Chest, and one routed repair round.
- **Runtime:** an engine-agnostic `EncounterRunner` with `submit`, `hint`, `autoSolve`, `skipTo`, telemetry, and debrief.
- **Tests:** a trig fixture plus tests, including a strict-schema audit and a mock-model pipeline test that reproduces the fixture exactly.

---

## 3. Architecture: data flow

```
UPLOAD (PDF | pasted text | topic)
  S0 Ingest (code)                 unpdf per-page text → sources/pages; low-text pages flagged for vision; topic → unsourced
  S1 Gatekeeper (FAST)             {educational, reason, estimatedConcepts, tooBig, tooSmall, outline?, followUps[]}
  S2 Curriculum (SMART)            → KnowledgeMap (units → concepts; knowledgeType, objective, misconceptions, facts+quotes, formulas, keywords, domain)
                                     code verifies every quote appears on its page (normalize case/whitespace); drops failures
  ├─ S3 Intake (UI + FAST pre-check)      confidence per unit, goal, minutes, genre, 3 pre-check MCQs
  ├─ S4 Matcher (code + FAST, background) per concept: catalog retrieval → top-12 → FAST ranks top 3 (reason, misconception targeted)
  └─ S5 Challenge bank (SMART, background, P6 optimization) pre-writes params for each concept's top card
  S6 Director (SMART)              → Blueprint (genre, theme, characters, encounters: teachingMechanicId, socket, role, target misconception)
  S7 Builders (parallel)           Challenge writer ×N (SMART) | Narrative (FAST) | Assessment (FAST) | Audio (code+ElevenLabs, optional)
  S8 Assemble (code)               solutions via family.resolve, placeholders, seeded shuffles, layout from prefab chunks
  S9 Verifier (code + FAST)        structural → referential → semantic → self-solve → blind-solve (blindSolvable modes) → routed repair → fallback
  → GameSpec v2 saved → S10 Runtime (genre host + widgets + EncounterRunner) → telemetry → S11 Debrief
```

**Orchestration:**
- Plain async TypeScript, `Promise.all`, and an in-memory event bus that feeds a Server-Sent Events stream.
- No agent frameworks.
- Every LLM call goes through `src/pipeline/llm.ts` → `runAgent()`:
  - Uses `generateText` with `output: Output.object({ schema, name })`.
  - On a zod or check failure, retries once with the problems appended as a repair note.
  - Retries HTTP 429 and 503 honoring `Retry-After`.
  - Global concurrency cap of 6 (p-limit).
  - Emits `{jobId, agent, status, ms, note}` events.
  - In mock mode, uses `MockLanguageModelV4` from `ai/test`, serving recorded fixture responses.

**Model tiers:**
- Model ids live only in `src/pipeline/models.ts` and can be overridden by env.
- Defaults: `SMART_MODEL=gpt-6-sol`, `FAST_MODEL=gpt-6-luna`, `CODER_MODEL=gpt-6-astra` (stretch only).
- Note in `FIRST_RUN.md` that the user should confirm these ids against OpenAI's model list at first run.
- Low reasoning effort for FAST.

---

## 4. How the pipeline uses the library

The library layers are described in LIBRARY §0. Where each lives in code:

| Layer | Code location | Kind |
|---|---|---|
| Engine primitives | `src/game/engine/` | Phaser helpers; never visible to the LLM |
| Widgets | `src/game/widgets/` | React overlays: dial, pick, sort, order, place, link, build, type |
| Mechanic families | `src/mechanics/families/<family>/` | One folder per family, one file per mode, `implemented` flag per mode |
| Teaching-mechanic catalog | `src/library/catalog/<domain>.ts` | Data encoded from LIBRARY §6–§7, validated by zod |
| Genre definitions | `src/library/genres.ts` | Sockets, boss socket, prefab chunk catalogs, and the genre-adapter matrix (LIBRARY §1, §5) |
| Cross-cutting systems | `src/game/systems/` | Runtime pieces from LIBRARY §8 |

What each stage reads:

- **Curriculum (S2)** outputs the retrieval keys: `domain`, `knowledgeType`, `keywords`, `misconceptions`. Its system prompt lists the domain enum and the 9 knowledge types with one-line definitions.
- **Matcher (S4)** filters the catalog to cards whose family·mode is implemented and whose family has a socket in the chosen genre, then scores each card against a concept `c`:
  - `3·[domain match]`
  - `+ 2·jaccard(tokens(c.name, summary, keywords, topic), tokens(card.concept, keywords))`
  - `+ 2·[card.knowledgeTypes ∋ c.knowledgeType]`
  - `+ 3·max jaccard(c.misconceptions[i].belief, card.misconception)`
  - `+ 0.5·flagship`

  Tokens are lowercased, stopword-stripped, and have plurals stripped, with a small synonym map.

  The top 12 go to FAST, which picks 3 with a reason and the misconception each targets. In mock mode, or on failure, take the top 3 by score.

  Also return a "wishlist": high-scoring cards whose family isn't built yet. Show it on `/library` and on the Forge screen.
- **Director (S6)** sees:
  - per-concept shortlists (card id, name, playerAction, misconception, family·mode, sockets for the genre)
  - concept weights
  - the genre's sockets

  Its schema is built dynamically:
  - encounter `teachingMechanicId` is an enum of the shortlisted, implemented cards
  - `socket` is restricted per family, using the per-family variant union already used in the seed
  - `conceptIds` is an enum of real concept ids
- **Challenge writer (S7)** gets:
  - the card (concept, playerAction, misconception, lockedParams, authoringNotes)
  - the family mode's `authoringGuide` and `paramsSchema`
  - the concept's facts, misconceptions, and formulas

  `lockedParams` are merged and enforced by code.
- **Assemble (S8)** takes solutions from `family.mode.resolve`, and chunks from the genre adapter's socket.
- **Runtime (S10):**
  - The genre host draws the socket skin from the family's genre adapter.
  - The widget comes from the family.
  - Cross-cutting systems wrap everything.
- **Verifier (S9)** calls `check`, `resolve`, `grade`, and self-solve on each family mode. For `blindSolvable` modes, FAST also answers blind (mock: returns the key).
- **Debrief (S11)** uses the card's `learningInsight` and the encounter's `debriefLine`.

**Golden retrieval tests** (use `includeUnimplemented: true`):

| Concept | Must appear in the top 3 |
|---|---|
| Limits, with misconception "the limit always equals f(a)" | `decoy_destination` |
| Photosynthesis inputs/outputs | `photosynthesis_recipe` |
| Causes of WWI | `domino_engine` or `causal_weighting` |
| Supply and demand | `living_marketplace` |
| Primary vs secondary sources | `evidence_lab` |
| Period of sine functions | `phase_gate` (must be ranked #1) |

**Genre auto-select:** use the weights in LIBRARY §1.1, restricted to implemented genres. The Director may override with a logged reason.

---

## 5. Contracts v2

Contracts live in `src/contracts`, which is the single source of truth, and are owned by the main session or `architect`. Extend the seed; bump `schemaVersion` to 2; export inferred types. The strict-mode rules from the seed still apply to every LLM-facing schema (section 6).

**Enums:**
- `KnowledgeType`: `fact | category | sequence | causal | system | quantitative | spatial | procedure | argument`
- `Domain`: `math | physics | chemistry | biology | earth_space | cs | engineering | health | history | civics | geography | economics | finance | psychology | philosophy | literature | writing | language | music | art | business | law | general | other`
- `Genre`: `dungeon | mystery | platformer | puzzle | strategy`
- `Widget`: `dial | pick | sort | order | place | link | build | type`

**KnowledgeMap**
```
{ sourceId, title, subject {domain, topic}, level, unsourced,
  outline[] {title, pageStart, pageEnd},
  units[] {id, name, conceptIds[]},
  concepts[] { id, unitId, name, summary, knowledgeType, learningObjective,
               importance: core|supporting, difficulty 1–3, prerequisites[], keywords[],
               facts[] {statement, sourceRef {page, quote} | null},
               misconceptions[] {belief, correction},
               formulas[] {label, mathjs, variables[] {name, unit, min, max}} } }
```
Use 4–8 units and 8–25 concepts.

**Intake**
```
{ goal: learn|review|test, minutes: 5|10|15, genre: auto|<Genre>,
  confidence: Record<unitId, 1–5>, preCheck {items[3], answers[]} }
```

**TeachingMechanic**: exactly as in LIBRARY §10.

**MechanicFamily** (code): rename and generalize the seed's `MechanicDefinition`.
```
{ id, name, widgets[], knowledgeTypes[],
  genres: Partial<Record<Genre, {sockets[], skin}>>,
  modes: Record<string, FamilyMode> }
```
where `FamilyMode` is the seed plugin contract plus `{ implemented, blindSolvable, widget }`.

Migrate the seed mechanics as follows:

| Seed mechanic | Becomes |
|---|---|
| `phase_gate` | `tuner.oscillator`, with card `phase_gate` locking `ask: "period"` |
| `mimic_chest` | `truth_finder.mimic`, card `mimic_chest` |
| `chrono_bridge` | `sequencer.linear` |
| `number_line_leap` | `mapper.number_line` |

**MatchResult**
```
{ conceptId,
  picks[3] {teachingMechanicId, score, reason, targetsMisconception | null},
  wishlist[] {teachingMechanicId, score} }
```

**Blueprint**
```
{ genre, title, theme {setting, tone, paletteId, musicMood}, premise, characters[],
  encounters[] {id, conceptIds[], teachingMechanicId, socket, role, difficulty,
                targetMisconception | null, designNote} }
```

**GameSpec v2**: the seed spec plus:
- encounters carry `teachingMechanicId`, `familyId`, `mode`, and `targetMisconception`
- concepts carry `learningObjective`
- `mastery` config

**TelemetryEvent**
```
{ gameId, encounterId, conceptIds, teachingMechanicId, attempt, correct, hintsUsed, ms, at }
```

**MasteryState**
```
Record<conceptId, {score 0–1, attempts, firstTryCorrect}>
```
Update rule from LIBRARY §8.

**ProgressEvent**
```
{ jobId, agent, status: start|repair|done|fallback|failed, ms?, note? }
```

**Storage** (`StorageDriver` interface):
```
putSource, getSource, putPages, putKnowledgeMap, getKnowledgeMap,
putMatch, putGame, getGame, listGames, appendEvents, putBlob, blobUrl
```
- `LocalDriver`: JSON and files under `.data/`, which is gitignored, served by a route handler. This is the default.
- `SupabaseDriver`:
  - `supabase/schema.sql` creates tables `sources`, `pages`, `knowledge_maps`, `matches`, `games` (spec jsonb), and `events`, plus buckets `sources` and `audio`.
  - It uses the secret key server-side only.

---

## 6. Generation rules (carried over from the seed; non-negotiable)

- **LLM-facing schemas are strict-mode legal.** `tests/strict-schemas.test.ts` enforces this:
  - The root is an object and every field is required. Use `.nullable()`, never `.optional()` or `.default()`.
  - No `z.record`.
  - Use `z.union`, never `z.discriminatedUnion`, which compiles to `oneOf`.
  - Use a single-value `z.enum`, never `z.literal`, which compiles to `const`.
  - No string length, regex, or format rules. Check those in code.
  - Bound every integer.
  - Treat `.describe()` text as instructions to the model.
- **References are dynamic enums.** Ids the model must reference are enums built from the current job, so a dangling reference is impossible. This covers concepts, cards, sockets, characters, and encounters.
- **The model writes primitives; code derives everything else.**
  - Numbers come from mathjs, and answer keys from `resolve()`.
  - Shuffles come from the spec seed.
  - An MCQ is returned as `correct` plus `distractors`; code shuffles them.
  - Text refers to computed values only through `{{placeholders}}`. Answer placeholders are banned from the prompt, from `hints[0]`, and from `wrongFeedback`.
- **Validation and repair.**
  - Validation runs in layers, and each issue carries a path and an owner.
  - There is one routed repair round.
  - If a challenge writer fails twice, its encounter becomes a Mimic Chest built from verified facts and a listed misconception, or is dropped. A boss is never dropped.
  - Issues owned by the Director or by code fail fast.
- **Blind solve.** For `blindSolvable` modes, FAST answers without the key. On disagreement, regenerate the encounter once, then fall back.
- **Every verifier catch becomes a progress note on the Forge screen.** Example: "Verifier: replaced e4, the blind solver disagreed."
- **Director rules:**
  - Weight each concept by `w = (core?2:1)·(6 − unit confidence)`.
  - Encounter count by length: 5 min → 5–7, 10 min → 8–12, 15 min → 11–14.
  - Weak concepts appear 2–3 times, through different families.
  - Include one review of an earlier concept, placed after at least 2 other encounters.
  - Teach before practice.
  - The boss comes last and combines the 2–3 weakest concepts.
  - Tie the theme to the subject.
  - Target a listed misconception whenever the card allows it.

---

## 7. Stack

Verify each current version, then pin it (rule 8).

| Area | Choice |
|---|---|
| App | pnpm; Next.js App Router with TypeScript strict and `src/`; Tailwind; shadcn/ui |
| Game | Phaser 4, loaded client-only via dynamic import. Widgets are React overlays above the canvas. If Phaser 4 blocks you for more than 45 minutes, pin Phaser 3.90 and log it in `DECISIONS.md`. |
| AI | `ai` v7 plus `@ai-sdk/openai`. The OpenAI provider sends strict JSON schemas by default. `generateObject` is deprecated; use `generateText` + `Output.object`. |
| Schemas, math, PDFs | zod 4, mathjs, unpdf |
| Other runtime deps | p-limit, `@elevenlabs/elevenlabs-js`, `@supabase/supabase-js` |
| Testing | Vitest (unit); Playwright (e2e, with a `webServer` config that starts the app in mock mode) |
| Sample PDFs | `pdf-lib`, generated by `scripts/build-samples.ts` |
| Art | Kenney 1-Bit Pack (CC0), downloaded into `public/assets/1bit/` and tinted per game palette. If the download fails, use procedurally drawn tiles and log it. |
| Hosting | Local demo first. Railway or Render deploy notes go in `FIRST_RUN.md`. Avoid short serverless timeouts; a generation job takes 60–90 seconds. |

---

## 8. Repo layout (target)

```
src/app/                      pages: / , /intake/[id], /forge/[id], /play/[id], /debrief/[id], /library
src/app/api/                  sources, sources/[id]/intake, games, jobs/[id]/stream (SSE), games/[id]/regenerate, blobs/[...path]
src/contracts/                zod contracts (main/architect only)
src/library/                  catalog/<domain>.ts, genres.ts, retrieval.ts, index.ts
src/mechanics/families/       <family>/<mode>.ts + index.ts ; registry.ts
src/pipeline/                 llm.ts, models.ts, mock/, agents/ (gatekeeper, curriculum, matcher, director, challenge, narrative, assessment, verifier), orchestrator.ts, assemble.ts, layout.ts, events.ts, audio/
src/server/                   storage/ (local, supabase), env.ts (zod-validated env), ingest/ (unpdf, quote verification)
src/game/                     engine/, hosts/<genre>/, widgets/, systems/, runner/ (EncounterRunner), debug.ts
fixtures/                     knowledge maps, agent mock responses, GameSpecs (per sample)
samples/                      trig-notes.pdf, cell-transport.pdf, civil-rights-history.pdf (+ their .md sources)
scripts/                      doctor.ts, smoke-openai.ts, smoke-elevenlabs.ts, smoke-supabase.ts, try-pdf.ts, build-samples.ts, library-report.ts, audio-library.ts, build-fixtures.ts
supabase/schema.sql
tests/ (unit), e2e/ (Playwright)
instructions.md, FIRST_RUN.md, PROGRESS.md, DECISIONS.md, BLOCKERS.md, MORNING_REPORT.md, .env.example
```

**`package.json` scripts:**
```
dev, build, start, typecheck, test, e2e, doctor, smoke:openai, smoke:elevenlabs,
smoke:supabase, try:pdf, samples:build, library:report, audio:library, fixtures:build
```

**`.gitignore`** must include: `.env*.local`, `.data/`, `.overnight/`, `node_modules`, `.next`, `playwright-report`, `test-results`.

**`.env.example`** (every variable commented with what it's for):
```
LLM_MODE=mock                 # mock | live
STORAGE_DRIVER=local          # local | supabase
AUDIO_MODE=off                # off | live
OPENAI_API_KEY=
SMART_MODEL=gpt-6-sol
FAST_MODEL=gpt-6-luna
CODER_MODEL=gpt-6-astra
ELEVENLABS_API_KEY=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=   # sb_publishable_...
SUPABASE_SECRET_KEY=                    # sb_secret_... (server only)
GOOGLE_GENERATIVE_AI_API_KEY=           # stretch: Gemini for the curriculum agent
```

`src/server/env.ts` validates env with zod and produces friendly errors that name the missing variable and the `FIRST_RUN.md` step that sets it.

---

## 9. Phase plan

**Priority.** The must-have spine is P0 → P1 → (P2 ∥ P3 ∥ P5a) → P4 → P5b → P6 → P7. After that, in order: P11, P9, P10, P8, P12.

`FIRST_RUN.md` and `MORNING_REPORT.md` are kept current throughout, so P12 is only a final pass.

Estimates are for guidance; apply the timebox from rule 3.

### P0 — Orient & bootstrap (main, ~60 min)

Checkpoint: `bootstrap`.

1. `git init` if needed. `touch .overnight/ENABLED`.
2. Create `PROGRESS.md` (this phase list), `DECISIONS.md`, and `BLOCKERS.md`.
3. Verify versions (rule 8).
4. Scaffold Next.js with pnpm, non-interactively. If the repo root isn't empty, scaffold into a temp folder and merge.
5. Install dependencies and set up Vitest and Playwright (install chromium).
6. Import the seed into `src/`, `fixtures/`, `tests/`, and `scripts/`, adapting paths and imports. All 27 seed tests must pass under the app's config.
7. Write `instructions.md`:
   - product paragraph
   - folder map and ownership table (section 10)
   - conventions (sections 3 and 6)
   - working rules (section 0)
   - commands
   - mock mode explanation
8. Write `.env.example`, `.gitignore`, and `src/server/env.ts`.
9. Draft `FIRST_RUN.md` (section 11).
10. Write `scripts/doctor.ts`. It prints:
    - active modes
    - which env vars are missing for each stage
    - Node and pnpm versions
    - the single next step to take

**Accept when:** `pnpm typecheck`, `pnpm test`, and `pnpm build` all pass, and `pnpm doctor` runs.

### P1 — Contracts v2 (architect → main, ~60 min)

Checkpoint: `contracts-v2`.

1. Implement section 5.
2. Migrate the four seed mechanics into families and modes.
3. Update the trig fixture to v2 by assembling it from slices; never hand-edit the JSON.
4. Keep the strict-schema audit green.
5. Update the mock pipeline test so it still reproduces the v2 fixture exactly.

### P2 — Library encoding (mechanics-dev, ~75 min, parallel with P3 and P5a)

Checkpoint: `library-catalog`.

1. Encode **every** card from LIBRARY §6 and the 5 generic §7 cards into `src/library/catalog/*.ts`. Write a one-sentence `learningInsight` for each.
2. Encode `genres.ts` from LIBRARY §1 and §5.
3. Build `retrieval.ts` (section 4).
4. Write `pnpm library:report`. It prints:
   - counts by domain, family·mode, and implemented status
   - flagship status
   - validation errors: unknown family or mode, duplicate ids, invalid genres
5. Tests:
   - catalog validation
   - the golden retrieval cases
   - implemented-filtering

### P3 — Runtime + Dungeon host (engine-dev, ~120 min, parallel)

Checkpoint: `runtime-dungeon`.

1. `/play/[id]` loads a GameSpec. In dev, load fixtures by name, e.g. `/play/fixture-trig`.
2. Dungeon host:
   - rooms from prefab chunks, one socket per encounter room, boss room last
   - palette tinting
   - freeze movement at a socket and open the family's widget
   - play the in-world consequence or the failure overlay
3. Widgets: dial (can drive an in-world object live), pick, order, place.
4. Hint familiar (3 tiers), consequence overlay, mastery HUD, and an end screen that posts telemetry.
5. `window.__GAME_DEBUG__ = { state(), skipTo(id), autoSolve(), events(), mastery() }`, enabled in dev or with `?debug=1`.
6. Playwright smoke test: load the trig fixture, autoSolve every encounter, and assert the end screen appears with zero console errors.

### P5a — Pipeline foundation (pipeline-dev, ~75 min, parallel)

Checkpoint: `pipeline-foundation`.

1. `llm.ts` and `models.ts` (section 3), including mock mode.
2. `env.ts`, the event bus, and the storage drivers. Local is complete; Supabase is complete but untested.
3. `supabase/schema.sql`.
4. `scripts/build-samples.ts` generates the three sample PDFs from markdown notes you write. Keep them accurate and about 3–4 pages each.
5. `POST /api/sources`:
   - accepts PDF (≤ 40 pages), text, or topic
   - extracts per-page text with unpdf
   - stores the source and pages
6. Quote verification utility with tests.

### P4 — Wave-1 families (mechanics-dev + engine-dev, ~120 min)

Checkpoint: `families-wave1` (split into two if large).

1. Implement these modes, each with tests and at least one fixture encounter:
   - `tuner`: oscillator, formula
   - `truth_finder`: mimic, predict_reveal
   - `sequencer`: linear, cycle, rank
   - `mapper`: number_line, plane
   - `sorter`: bins, type_match
   - `linker`: pairs, chain
   - `investigator`: elimination
2. engine-dev adds the sort and link widgets and the Dungeon skins from LIBRARY §5.
3. The 9 wave-1 flagships must be playable in the Dungeon via fixtures.

### P5b — Front-half agents (pipeline-dev, ~90 min)

Checkpoint: `pipeline-agents`.

1. Agents: gatekeeper, curriculum (with quote verification), intake (`GET /api/sources/:id/intake` returns units, concepts, and the pre-check), and matcher (section 4).
2. Each agent gets:
   - a system prompt in `src/pipeline/agents/<name>.prompt.ts`
   - its schema
   - a checker
   - mock responses for all three samples
3. Genre-agnostic mock mode: an unknown upload in mock mode maps to the trig sample and the UI shows a "Mock mode" banner.
4. `pnpm try:pdf <path>` runs S0–S4 and prints:
   - the gatekeeper verdict
   - concepts with knowledge types
   - verified and dropped quotes
   - matcher picks and wishlist per concept

### P6 — Orchestrator back half (pipeline-dev + main, ~90 min)

Checkpoint: `orchestrator`.

1. `POST /api/games {sourceId, intake}` returns `{jobId}`.
2. `GET /api/jobs/:id/stream` streams SSE progress events, ending with `{done, gameId}`.
3. Implement:
   - Director with the dynamic schema
   - challenge writers ×N in parallel
   - narrative and assessment writers
   - assemble
   - verifier with blind solve
   - routed repair and fallback
4. `POST /api/games/:id/regenerate {genre}` reuses the KnowledgeMap, intake, and matches.
5. Put the shared KnowledgeMap and card text at the **start** of every builder prompt so prompt caching applies.
6. Challenge bank (S5): an optional pre-generation cache, done only if time allows.
7. Mock end-to-end test: a sample PDF becomes a validated GameSpec that the headless runner can autoSolve.

### P7 — UI and the golden path (ui-dev + main, ~120 min)

Checkpoints: `golden-path`, then `review-fixes` after the reviewer pass.

1. Pages:
   - `/`: drop zone, topic box, three showcase cards
   - `/intake/[id]`: concepts with page ranges; an outline checklist if the source is too big; confidence sliders per unit; goal, length, genre; the pre-check
   - `/forge/[id]`: a live card per agent with status, elapsed time, and latest note; auto-navigates when done
   - `/play/[id]`
   - `/debrief/[id]`: post-check, pre→post score, per-concept mastery, "what you just did" cards, and buttons for Replay, Regenerate as genre, and Focus on weak spots
   - `/library`: catalog browser filterable by domain, family, and implemented status, with counts. Judges should see the size of the library here.
2. Design: projector-friendly type, high contrast, no layout shift while streaming.
3. Playwright e2e in mock mode: upload `samples/trig-notes.pdf` → intake → forge → play (autoSolve via the debug hook) → debrief shows a pre→post score.
   - Zero console errors.
   - Save a screenshot of every page to `docs/overnight/screens/`.
4. `pnpm build` must pass.
5. Run `reviewer` (opus) on the whole diff since `bootstrap`. Fix every critical and high item.

### P11 — Demo insurance (main + ui-dev, ~45 min)

Checkpoint: `showcase`.

1. Generate three showcase games through the mock pipeline and save them as fixtures: trig Dungeon, cell transport Dungeon, and a history game (Dungeon until Mystery exists, then regenerate as Mystery).
2. Wire them to the home cards.
3. Regenerate-as-genre must work on the showcase games.

### P9 — Wave-2 families (mechanics-dev + engine-dev)

One checkpoint per 1–2 families. Order:
1. `function_world` (limit and slope first: the calculus showpiece)
2. `balance` (equation, chem_equation, ledger)
3. `simulator` (intervene, sample, predict)
4. `builder` (circuit and molecule, plus the build widget)
5. `transformer` (encode, function_machine, trace)
6. `accumulator` (riemann, area)
7. `recall` (rapid and cloze, plus the type widget)

After each family: flip its `implemented` flags, add fixtures, and add the flagship cards that use it to the showcase checks.

### P10 — More genres (engine-dev)

One checkpoint per genre. Order:
1. Mystery host: dialogue, corkboard, evidence, cross-exam, accusation.
2. Platformer.
3. Puzzle.
4. Strategy is stretch only.

Each host implements its sockets from LIBRARY §1 and its skins from §5, and needs a Playwright autoSolve smoke test.

### P8 — Audio, code only (pipeline-dev, ~45 min)

Checkpoint: `audio`.

- `scripts/audio-library.ts`: about 8 music loops by mood and about 25 SFX through the ElevenLabs Music and Sound Effects APIs, plus `public/audio/manifest.json`. It runs only when a key exists.
- `src/pipeline/audio/`:
  - map `voiceArchetype` to premade voices (configurable)
  - synthesize narrative lines with a Flash model, concurrency 4
  - cache by hash of text + voice id
  - if audio isn't done in 25 seconds, ship the game text-only
  - Text to Dialogue for a 2-speaker intro, behind a flag
- `pnpm smoke:elevenlabs`.
- Everything no-ops cleanly when `AUDIO_MODE=off`.

### P12 — Final pass (main)

Checkpoint: `overnight-final`.

1. Run `typecheck`, `test`, `e2e`, and `build`.
2. Finalize `FIRST_RUN.md` and `MORNING_REPORT.md`.
3. Checkpoint.
4. Put `STATUS: COMPLETE` on line 1 of `PROGRESS.md`.
5. Delete `.overnight/ENABLED`.

### Stretch (only after P12)

- The Gemini provider switch for the curriculum agent (MLH "Best Use of Gemini API").
- Wildcard mechanic in a sandboxed iframe.
- Teach-back totem.
- Law-powered abilities.
- Strategy host.

---

## 10. Subagent ownership (prevents conflicts)

| Agent | Owns (may edit) | Never edits |
|---|---|---|
| main / architect | `src/contracts/`, `instructions.md`, root docs, integration glue | — |
| mechanics-dev | `src/mechanics/`, `src/library/`, `fixtures/` (mechanic encounters), tests for those | `src/contracts/` (report needed changes instead) |
| engine-dev | `src/game/`, `public/assets/`, `e2e/play*` | contracts, pipeline |
| pipeline-dev | `src/pipeline/`, `src/server/`, `src/app/api/`, `scripts/`, `supabase/`, `samples/`, `fixtures/` (agent mocks) | contracts, game |
| ui-dev | `src/app/` (pages, excluding `api/`), `src/components/`, styles, `e2e/` (flows) | contracts, pipeline internals |
| reviewer | nothing (read-only report) | everything |

Delegation brief template. Every Agent call includes:
- the goal
- owned paths
- the acceptance tests to run
- relevant contract types, pasted in
- "Read instructions.md first"
- "Do not run git commit or any git write command"
- the required report format: files changed, commands run with results, gaps, and a one-line proposed commit message

Run parallel subagents only when their owned paths don't overlap.

---

## 11. `FIRST_RUN.md`: what it must contain

The user will follow it literally, starting from zero.

1. **Prerequisites** with exact verified versions: Node LTS, pnpm via `corepack enable`, and git. Then `pnpm install` and `pnpm exec playwright install chromium`.
2. **Zero-key check** (mock mode):
   - `pnpm doctor`
   - `pnpm test`
   - `pnpm dev`, then open http://localhost:3000, click a showcase game, and play it
   - `pnpm e2e`
   - For each step, what the user should see.
3. **OpenAI (required for live mode).**
   - Create an account and organization at platform.openai.com.
   - Add billing or credits.
   - Create a project and a secret key: the exact dashboard path, verified with WebFetch.
   - Confirm the account has access to the SMART and FAST model ids, and what to set if not.
   - `cp .env.example .env.local`, then paste `OPENAI_API_KEY=sk-...` and set `LLM_MODE=live`.
   - Run `pnpm smoke:openai`. Show its expected output and the meaning of each failure (401, model not found, schema rejected).
   - A rough cost estimate per game.
4. **Stage-1 test.** Stage 1 means ingestion + curriculum + matcher.
   - `pnpm try:pdf samples/trig-notes.pdf`, then the user's own PDF.
   - What good output looks like.
   - Then run the same flow through the UI.
5. **ElevenLabs** (optional).
   - The account, where the API key lives, and which permissions it needs.
   - Paste `ELEVENLABS_API_KEY` and set `AUDIO_MODE=live`.
   - Run `pnpm smoke:elevenlabs`, then `pnpm audio:library` once, with its credit cost.
6. **Supabase** (optional; local storage is the default).
   - Create a project.
   - Settings → API Keys: copy the Project URL, the publishable key (`sb_publishable_…`), and the secret key (`sb_secret_…`) into `.env.local`.
   - SQL Editor: run `supabase/schema.sql`.
   - Confirm the buckets exist.
   - Set `STORAGE_DRIVER=supabase` and run `pnpm smoke:supabase`.
7. **Env var table:** name, required for which stage, where to get it, format, and whether it's secret or public.
8. **Optional deploy** to Railway or Render: build and start commands, and which env vars to set.
9. **Troubleshooting table.**
10. **Morning git steps:** review `.overnight/CHECKPOINTS.md`, then run `bash .overnight/replay-checkpoints.sh` yourself (Claude never runs it). It turns each checkpoint into its own commit, authored by you. Then `rm .overnight/ENABLED` if it still exists.

---

## 12. `MORNING_REPORT.md`: what it must contain

1. A three-sentence summary: what works end to end right now, in mock mode.
2. A phase table: done, partial, or blocked, with one-line notes.
3. Test results: unit counts, e2e counts, and build status.
4. The checkpoint list with proposed commit messages.
5. **Decisions I should review.** Pull these from `DECISIONS.md` and flag any that are hard to reverse.
6. Blockers, and what would unblock each.
7. **Do this first:** the shortest path to a live stage-1 test, pointing to the `FIRST_RUN.md` step numbers.
8. A suggested Saturday plan: remaining phases in priority order, with hour estimates for a team of four.
9. Demo risks and mitigations.
10. Links to the page screenshots and to `/library`.

Begin now with P0. Don't stop until `STATUS: COMPLETE` or every remaining item is blocked.
