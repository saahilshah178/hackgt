# Quest Forge

**Turn any chapter into a game where the concept is the rules.** Upload a PDF, paste notes, or type a topic. After a
60-second intake, Quest Forge generates a playable educational game built around what you are shaky on: you tune a
gate's period to open the door, balance the equation to stop the leak, or walk the number line to find the limit.
You never answer trivia between jumps.

Built for HackGT 13. Next.js 16 · React 19 · TypeScript · Phaser 4 · AI SDK v7 · zod.

## How a session works

1. **Upload** a PDF (a chapter or a whole textbook; there is no page cap), pasted text, or a topic name.
2. **Intake** shows the concepts the pipeline extracted, with page ranges (a long book is read in section-sized parts). You tick
   the concepts to play (a chapter starts fully ticked, a book starts empty), set a confidence slider per unit, a goal
   (learn / review / test), a length (5, 10, or 15 minutes), a genre, and answer a 3-question pre-check
   ("Not sure yet" is allowed).
3. **Forge** streams one live card per AI agent while the game is generated and verified (about 60 to 90 seconds live,
   instant in mock mode).
4. **Play** in a genre host: a Phaser **Dungeon**, a Phaser **Platformer**, or a DOM **Mystery** board. Every encounter is
   a teaching mechanic from a 316-card library, graded by code, with three tiers of hints and a mastery meter.
5. **Debrief** asks the post-check, shows pre vs post, per-concept mastery and "what you just did", and offers Replay,
   Regenerate as another genre, or Focus on my weak spots.

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

Try the showcase games:

| Game | URL |
|---|---|
| Trigonometry (Dungeon) | http://localhost:3000/play/fixture-trig |
| Cell transport (Dungeon) | http://localhost:3000/play/fixture-cell-transport |
| Civil rights history (Mystery) | http://localhost:3000/play/fixture-civil-rights-mystery |
| Trigonometry (Platformer) | http://localhost:3000/play/fixture-trig-platformer |
| Wave-2 proving ground (nine mechanics) | http://localhost:3000/play/fixture-wave2 |
| Mechanic library browser | http://localhost:3000/library |

Then upload `samples/cell-transport.pdf` on the home page and walk the whole flow. In mock mode every upload maps to the
closest recorded sample (trig, cell transport, civil rights).

Controls: arrow keys or WASD to move, Space to jump in the Platformer, E or Enter at an obstacle to open its
challenge, Tab to reach every widget. Add `?debug=1` to a play URL to expose `window.__GAME_DEBUG__` (state, autoSolve).

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
- **Hosts** (`src/game/hosts/*`): Dungeon and Platformer on Phaser 4 (WebGL, client-only), Mystery on the DOM, and a
  DOM fallback that plays any spec when WebGL is missing.
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
