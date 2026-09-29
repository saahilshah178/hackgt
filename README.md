# EduXPert

**Don't just study. Discover, explore, experiment.**

Try it live at **[eduxpert.tech](https://eduxpert.tech)**.

EduXPert turns your own course material into a game that teaches you the ideas and then has you use them. Upload a
chapter, paste notes, or name a topic. After a few questions you get a game that both teaches and tests you on the
material you brought, built around the concepts you picked. You sort, order, link, tune and explain the ideas yourself
to move the game forward, so the challenges are the concepts themselves, not trivia questions dropped between levels.

**Learn first, then play it.** A guide character teaches every idea before the game asks you to use it, and the Field
guide keeps the key facts, formulas and common mistakes one keypress away.

Built for HackGT 13. Next.js 16 · React 19 · TypeScript · Phaser 4 · AI SDK v7 · zod.

## How it works for a learner

1. **Upload**: a PDF (a chapter or a whole textbook), pasted notes, or just a topic name.
2. **Pick**: tick the concepts to cover (with page ranges) and choose a length of 5, 10 or 15 minutes, which covers up to
   4, 7 or 10 concepts. An optional quick check asks which statements sound true, lets you choose a genre instead of
   "Pick for me", and asks 3 pre-check questions for the debrief. Skipping any of it is fine.
3. **Generate**: EduXPert builds the game from your own material while a loading screen shows fun facts.
4. **Learn & play**: before the first challenge on each concept, the guide teaches it (the idea, key facts cited to your
   pages, the formula, a worked example, the classic mistake). Every challenge comes from a 316-card library of teaching
   mechanics, is graded by code, and offers three tiers of hints and a mastery meter.
5. **Debrief**: your before and after scores, mastery per concept, and what to review next, with Replay, Regenerate as
   another genre, or Focus on my weak spots.

New games come in four genres: a point-and-click investigation, a cozy management sim, a top-down explorer, and a
narrative adventure. Every game is checked to be winnable before you see it.

Games are data, not generated code. The agents produce a zod-validated `GameSpec` JSON; hand-built hosts and mechanic
families render and grade it, so a bad model output can never crash the game.

## Quick start (no API keys)

Everything runs in **mock mode** by default: recorded agent responses, local file storage, audio off. No account and no
paid API calls are needed.

Prerequisites: Node.js 22.12 or newer and pnpm 12.

```bash
pnpm install
pnpm run doctor          # checks Node, pnpm and the selected modes ("pnpm doctor" alone is pnpm's own command)
pnpm dev                 # http://localhost:3000
```

Upload `samples/cell-transport.pdf` on the home page (or paste notes, or type a topic) and walk the whole flow. In
mock mode every upload maps to the closest recorded sample. http://localhost:3000/library browses the teaching-mechanic
library.

Controls: click or Tab through the game board, arrow keys or WASD to move where there is an avatar, E or Enter at an
obstacle to open its challenge, G for the Field guide. Add `?debug=1` to a play URL to expose `window.__GAME_DEBUG__`
(state, autoSolve).

## Going live

Copy the example env file and add keys one service at a time. `FIRST_RUN.md` has the click-by-click version of each
step, the expected output, and a troubleshooting table.

```bash
cp .env.example .env.local
```

| Variable | Purpose | Default |
|---|---|---|
| `LLM_MODE` | `mock` or `live` (OpenAI via the AI SDK) | `mock` |
| `OPENAI_API_KEY` | required when `LLM_MODE=live`; server only | |
| `SMART_MODEL` / `FAST_MODEL` | model ids for the reasoning and fast tiers | `gpt-6-sol` / `gpt-6-luna` |
| `CODER_MODEL` | the World Architect ("Astra") that designs 3D open worlds (genre `world3d`) | `gpt-6-astra` |
| `CRITIC_MODEL` | optional: the 3D world's story and world critics; unset uses `SMART_MODEL` | |
| `NPC_CHAT` | `on` or `off`: free chat with 3D-world characters (FAST tier; mock mode answers from the lessons) | `on` |
| `STORAGE_DRIVER` | `local` (`.data/` folder) or `supabase` | `local` |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` | Supabase project; schema in `supabase/schema.sql` | |
| `AUDIO_MODE` | `off` or `live` (ElevenLabs voice, SFX, music) | `off` |
| `ELEVENLABS_API_KEY` | required when `AUDIO_MODE=live`; server only | |

Smoke tests confirm each service with a single call before you run a full game:

```bash
pnpm smoke:openai        # one Director call against the strict schema
pnpm smoke:elevenlabs    # one short line of speech
pnpm smoke:supabase      # one row and one blob round trip
pnpm try:pdf samples/trig-notes.pdf   # ingest + curriculum + matcher on any PDF
```

API keys are read only on the server (`src/server/env.ts` validates them and names the missing variable). Nothing
secret goes in a `NEXT_PUBLIC_*` variable.

## How it works

```
PDF / text / topic
  → S0 ingest (unpdf, page split)         → S1 gatekeeper (is this teachable?)
  → S2 curriculum (knowledge map, quotes verified against the pages)
  → S3 intake + pre-check                 → S4 matcher (retrieval over 316 teaching-mechanic cards)
  → S6 Director (picks genre, encounters, boss)   → S7 challenge writers ×N, narrative, assessment, audio
  → S8 assemble (code derives every answer, seeded shuffles, prefab layout)
  → S9 verifier (structural → referential → semantic → self-solve → blind-solve → routed repair → fallback)
  → GameSpec v2 JSON → genre host + widgets → telemetry → mastery → debrief
```

- **Mechanic families** (`src/mechanics/families/*`): 14 families (tuner, truth_finder, sequencer, mapper, sorter,
  linker, investigator, function_world, balance, transformer, recall, simulator, accumulator, builder) with 61 modes.
  Each mode declares a params schema and implements `check`, `resolve`, `present`, `grade`, and a blind solver. The
  model writes primitives; code computes the answer; feedback never contains it (a generic test proves this for every
  mode).
- **Library** (`src/library/catalog/*`): the 316 teaching-mechanic cards from `docs/LIBRARY.md`, 303 playable today,
  plus genre sockets, chunks, and the retrieval scorer. `pnpm library:report` prints the coverage.
- **Hosts**: the four offered genres (casefile investigation, cozy sim, explorer, story) plus the logic board live in
  `src/game/genre/hosts/*`. The older Dungeon and Platformer hosts run on Phaser 4 (WebGL, client-only) in
  `src/game/hosts/*`, next to a DOM fallback that plays any spec when WebGL is missing.
- **Verification**: the pipeline self-solves every encounter, a second model blind-solves it, disagreements are
  repaired or replaced with a known-good Mimic Chest, so every shipped game is winnable.
- **Mock mode** adapts recorded Director blueprints to the live intake (length, genre, card menu), so the whole product
  is demoable with zero keys and the byte-identical fixture tests keep the recorded games honest.

## Repository layout

| Path | Contents |
|---|---|
| `src/contracts/` | zod contracts: knowledge map, intake, GameSpec v2, telemetry, storage, LLM slice schemas |
| `src/library/` | teaching-mechanic catalog, genres, retrieval |
| `src/mechanics/` | mechanic families and modes, registry, exact-math helpers |
| `src/pipeline/` | LLM agents, orchestrator, mock models, assembly, validation, audio |
| `src/server/` | env validation, storage drivers (local, Supabase), PDF ingest |
| `src/app/` | Next.js App Router pages (`/`, `/intake`, `/forge`, `/play`, `/debrief`, `/library`) and API routes |
| `src/components/` | shadcn/ui-based flow components |
| `src/game/` | Phaser hosts, React widgets, HUD systems, debug hook |
| `fixtures/` | knowledge maps, agent mocks, encounter fixtures, showcase GameSpec JSON |
| `samples/` | three sample PDFs and their markdown sources |
| `scripts/` | doctor, smoke tests, try-pdf, fixture and sample builders, library report |
| `tests/`, `e2e/` | Vitest unit tests and Playwright end-to-end specs |
| `docs/` | `LIBRARY.md` (genre and mechanic design library), `overnight/` (mode contracts, screenshots) |

## Scripts

| Command | What it does |
|---|---|
| `pnpm dev` / `pnpm build` / `pnpm start` | Next.js development server, production build, production server |
| `pnpm typecheck` | `tsc --noEmit` (strict) |
| `pnpm test` | Vitest unit suite (contracts, every mode, pipeline, storage, API routes) |
| `pnpm e2e` | Playwright: starts its own dev server on port 3100 and runs the golden path, flows, and play smokes |
| `pnpm lint` | ESLint |
| `pnpm run doctor` | environment check for the selected modes |
| `pnpm library:report` | catalog coverage and validation |
| `pnpm fixtures:build` | rebuilds `fixtures/*.json` from the slice files (a drift test fails if they diverge) |
| `pnpm samples:build` | rebuilds the sample PDFs from `samples/*.md` |
| `pnpm try:pdf <file>` | runs the ingest half of the pipeline on a PDF and prints the result |
| `pnpm audio:library` | generates the music and SFX library once (needs ElevenLabs) |

## HTTP API

The pages talk to the server through a small JSON API documented in `instructions.md` section 9: `POST /api/sources`
(upload), `GET /api/sources/:id/intake`, `POST /api/games` (start a job), `GET /api/jobs/:id/stream` (Server-Sent
Events), `POST /api/games/:id/regenerate`, `POST /api/games/:id/postcheck`, and telemetry.

## Deploying

A generation job runs for 60 to 90 seconds and streams SSE, so deploy to a long-running Node service (Railway, Render, or
similar) rather than a short-timeout serverless platform. Build with `pnpm install --frozen-lockfile && pnpm build`,
start with `pnpm start`, and set the variables from the table above. With `STORAGE_DRIVER=local` the `.data/` folder
is ephemeral on redeploy; use Supabase for persistence. Details in `FIRST_RUN.md` section 8.

## More documentation

- `FIRST_RUN.md`: zero-key check, then OpenAI, ElevenLabs, Supabase, deploy, troubleshooting.
- `instructions.md`: architecture, module ownership, generation rules, conventions, API contract.
- `docs/LIBRARY.md`: the genre and teaching-mechanic design library the catalog encodes.
- `docs/overnight/wave1-modes.md`: the binding param, solution, input, and view contracts per mode.
- `MORNING_REPORT.md` and `DECISIONS.md`: how the initial build went and why things are the way they are.

## Credits

Tiles from the Kenney 1-Bit Pack (CC0). Sample PDFs are rendered with DejaVu Sans. Math is evaluated with mathjs in a
sandboxed instance; PDFs are read with unpdf.
