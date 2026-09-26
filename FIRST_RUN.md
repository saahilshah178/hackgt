# FIRST_RUN.md — from zero to a live game

Follow this literally, top to bottom. Steps 1–2 need no accounts and no keys. Steps 3+ turn on live services one
at a time. Every command runs from the repo root.

> Status legend used below: **verified** = checked against current docs on 2026-09-25 · **confirm at first run** =
> could not be checked without an account; confirm it when you get there.

---

## 1. Prerequisites

| Tool | Version used tonight | Install |
|---|---|---|
| Node.js | 26.5.1 (any ≥ 22.12 works; Vitest 5 and unpdf need ≥ 22) | https://nodejs.org (LTS) or `brew install node` |
| pnpm | 12.6.0 | `npm install -g pnpm@12.6.0` — or `npm i -g corepack && corepack enable` if your Node ships without corepack (Homebrew's does) |
| git | 2.50.1 | Xcode CLT / `brew install git` |

```bash
pnpm install
pnpm exec playwright install chromium     # ~95 MB, only needed for `pnpm e2e`
```

What you should see: `pnpm install` ends with `Done in …s using pnpm v12.6.0`; Playwright prints
`Chrome Headless Shell … downloaded to …/ms-playwright/…`.

## 2. Zero-key check (mock mode)

Everything below runs with `LLM_MODE=mock`, `STORAGE_DRIVER=local`, `AUDIO_MODE=off` (the defaults when there is
no `.env.local`). No account, no network calls to paid APIs.

| Command | What you should see |
|---|---|
| `pnpm run doctor` | "Modes: LLM_MODE=mock STORAGE_DRIVER=local AUDIO_MODE=off", green ticks for node/pnpm, "No problems for the selected modes", and a Next step line. (`pnpm doctor` without `run` triggers pnpm's own builtin doctor, which is not this.) |
| `pnpm typecheck` | silence (exit 0) |
| `pnpm test` | `Test Files N passed`, `Tests N passed` (the count grows through the night; see MORNING_REPORT.md for the final number) |
| `pnpm dev` then open http://localhost:3000 | The home page with three showcase cards. Click **Trigonometry → Play**: a dungeon loads, walk to the first socket, the widget opens. Press `?` for a hint. Finish → the debrief shows a pre→post score. |
| `pnpm e2e` | Playwright starts the dev server in mock mode, runs the play smoke and the golden-path flow, saves screenshots to `docs/overnight/screens/`, exits 0. |

If `pnpm dev` says the port is busy: `PORT=3001 pnpm dev` and open http://localhost:3001.

## 3. OpenAI (required for live mode)

1. Create an account at https://platform.openai.com and, when asked, an organization. *(confirm at first run)*
2. **Billing:** Settings → Billing → add a payment method or prepaid credits. Without it, every call returns 429
   "insufficient_quota". *(confirm at first run)*
3. **Project + key:** Settings → API keys (https://platform.openai.com/api-keys) → **Create new secret key** →
   choose the project (default project is fine), permission "All" → copy the `sk-…` key once; it is not shown again.
   *(path from OpenAI help center; the help site blocks automated fetches, so confirm at first run)*
4. **Model access.** Open https://platform.openai.com/docs/models and confirm your account can see the model ids we
   default to: `SMART_MODEL=gpt-6-sol`, `FAST_MODEL=gpt-6-luna` (and `CODER_MODEL=gpt-6-astra`, stretch only).
   These ids came from the plan; the AI SDK's OpenAI provider docs list `gpt-6-luna` and `gpt-6-astra` (verified),
   `gpt-6-sol` is unverified. If a model is missing or tier-gated, set the env var to a model you do have
   (e.g. a `gpt-5*` id) — only the ids change; nothing else.
5. Configure:
   ```bash
   cp .env.example .env.local
   # edit .env.local:
   #   LLM_MODE=live
   #   OPENAI_API_KEY=sk-...
   #   (optionally SMART_MODEL / FAST_MODEL)
   ```
6. Smoke test: `pnpm smoke:openai`

   Expected output: the Director's blueprint JSON for the trig fixture, then
   `<model>: <ms> ms; check problems: []`.

   | Failure | Meaning | Fix |
   |---|---|---|
   | `401 … Incorrect API key` | key pasted wrong, or from a different org | recreate the key, paste without quotes/spaces |
   | `404 … model … does not exist` / `model_not_found` | your account can't use that id | change `SMART_MODEL`/`FAST_MODEL` (step 4) |
   | `429 insufficient_quota` | no billing/credits | step 2 |
   | `400 … Invalid schema for response_format` | a schema broke strict mode | run `pnpm test` (`tests/strict-schemas.test.ts` pinpoints it) and report the failing schema |
   | `EnvError: Missing OPENAI_API_KEY` | `.env.local` not loaded or var empty | the file must be at the repo root and named `.env.local` |
7. **Cost per game (rough, confirm at first run):** one 10-minute game is ~1 SMART call (Director, ~6k in / 2k out),
   8–12 SMART challenge calls (~5k in each thanks to the shared cached prefix, ~600 out), and ~6 FAST calls.
   Total on the order of 80–120k input tokens (mostly cache hits) and 10–15k output tokens. At typical flagship
   pricing that is a few tens of cents per game; FAST-only stages (gatekeeper, matcher) are cents. Check
   https://openai.com/api/pricing/ for the live numbers (the page blocks automated fetches).

## 4. Stage-1 test (ingest + curriculum + matcher)

```bash
pnpm try:pdf samples/trig-notes.pdf
pnpm try:pdf ~/Downloads/your-own-notes.pdf
```
Good output looks like:
- **Gatekeeper:** `educational: true, estimatedConcepts: 8–25, tooBig: false, tooSmall: false`.
- **Concepts:** 8–25 rows `id · name · knowledgeType · unit`, importance and difficulty.
- **Quotes:** `verified N / dropped M` — dropped quotes are listed with the page they claimed. A few drops are
  normal (the model paraphrased); many drops mean the PDF text layer is poor (scanned PDF).
- **Matches:** per concept, three picks `card_id (score) — reason — targets: <misconception>` and a wishlist of
  high-scoring cards whose family isn't built yet.

Then the same through the UI: `pnpm dev` → drop the PDF on the home page → the intake page shows the concepts with
page ranges → set confidence sliders → answer the 3 pre-check questions → **Forge** → watch one card per agent →
play → debrief.

## 5. ElevenLabs (optional: voice, music, SFX)

1. Account at https://elevenlabs.io → profile menu → **API keys** → create a key. Give it permissions for
   Text to Speech, Sound Effects, and Music (and Text to Dialogue if you want the two-speaker intro). *(confirm at first run)*
2. `.env.local`: `ELEVENLABS_API_KEY=…` and `AUDIO_MODE=live`.
3. `pnpm smoke:elevenlabs` — synthesizes one short line with `eleven_flash_v2_5` (verified model id) and writes
   `.data/blobs/audio/smoke.mp3`. Expected: `ok: <bytes> bytes in <ms> ms`.
4. `pnpm audio:library` **once**: ~8 music loops by mood and ~25 SFX → `public/audio/` + `public/audio/manifest.json`.
   Credit cost: music and SFX are billed per generated second; expect a few thousand credits for the whole library.
   It skips files that already exist, so re-runs are cheap.
5. If audio isn't done 25 s after generation, the game ships text-only and fills in later.

## 6. Supabase (optional; local storage is the default)

1. https://supabase.com → New project (any region; note the database password).
2. **Settings → API Keys** (verified): copy **Project URL**, the **publishable** key (`sb_publishable_…`) and the
   **secret** key (`sb_secret_…`; server only) into `.env.local`:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
   SUPABASE_SECRET_KEY=sb_secret_...
   STORAGE_DRIVER=supabase
   ```
3. **SQL Editor** → paste `supabase/schema.sql` → Run. It creates `sources`, `pages`, `knowledge_maps`, `matches`,
   `games` (spec jsonb), `events`, and the storage buckets `sources` and `audio`.
4. **Storage** → confirm both buckets exist.
5. `pnpm smoke:supabase` — inserts and reads back one row and one blob. Expected: `ok: round-trip in <ms> ms`.

## 7. Environment variables

| Name | Required for | Where to get it | Format | Secret? |
|---|---|---|---|---|
| `LLM_MODE` | always (default `mock`) | — | `mock` \| `live` | no |
| `STORAGE_DRIVER` | always (default `local`) | — | `local` \| `supabase` | no |
| `AUDIO_MODE` | always (default `off`) | — | `off` \| `live` | no |
| `OPENAI_API_KEY` | `LLM_MODE=live` | step 3 | `sk-…` | **yes** (server) |
| `SMART_MODEL` / `FAST_MODEL` / `CODER_MODEL` | live mode (defaults exist) | step 3.4 | model id | no |
| `ELEVENLABS_API_KEY` | `AUDIO_MODE=live` | step 5 | string | **yes** (server) |
| `NEXT_PUBLIC_SUPABASE_URL` | `STORAGE_DRIVER=supabase` | step 6 | `https://….supabase.co` | no (public) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `STORAGE_DRIVER=supabase` | step 6 | `sb_publishable_…` | no (public) |
| `SUPABASE_SECRET_KEY` | `STORAGE_DRIVER=supabase` | step 6 | `sb_secret_…` | **yes** (server) |
| `GOOGLE_GENERATIVE_AI_API_KEY` | stretch (Gemini curriculum) | https://aistudio.google.com/apikey | string | **yes** (server) |
| `DATA_DIR` | optional | — | path, default `.data` | no |

`src/server/env.ts` validates all of this and names the missing variable and the step above in every error.

## 8. Optional deploy (Railway or Render)

A generation job takes 60–90 s and streams SSE, so avoid short serverless timeouts; a long-running Node service is
the right shape.

- **Build:** `pnpm install --frozen-lockfile && pnpm build` · **Start:** `pnpm start` · Node 22+.
- Env vars: everything from §7 that you use, plus `NEXT_TELEMETRY_DISABLED=1`. With `STORAGE_DRIVER=local` the
  `.data/` folder is ephemeral on redeploy; use Supabase (§6) for persistence.
- Railway: New Project → Deploy from GitHub → set the variables → it detects Next.js. Render: Web Service → Node →
  build/start commands above → set variables. *(confirm at first run)*

## 9. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `pnpm doctor` prints pnpm's own diagnostics | pnpm builtin shadows the script | `pnpm run doctor` |
| `command not found: pnpm` | not installed | `npm i -g pnpm@12.6.0` |
| `Vitest requires Vite >= 6.4.0 and Node >= 22.12.0` | old Node | upgrade Node (step 1) |
| `EnvError: Missing … see FIRST_RUN.md step N` | live mode without its key | add the key or set the mode back to mock/local/off |
| Home page loads but the game canvas is black | WebGL disabled (Phaser 4 is WebGL-only) | enable hardware acceleration / WebGL in the browser |
| `browserType.launch: Executable doesn't exist` | Playwright browser missing | `pnpm exec playwright install chromium` |
| `Error: listen EADDRINUSE :3000` | another dev server | `PORT=3001 pnpm dev` or stop the other server |
| Quotes are all "dropped" for your PDF | scanned/image PDF, no text layer | OCR it first, or paste the text instead |
| `.data/` fills up | local driver keeps every upload | delete `.data/` (it is gitignored) |
| Forge screen never advances | the SSE stream died (proxy buffering) | run locally or on a long-running host (§8) |

## 10. Morning git steps

1. Read `MORNING_REPORT.md`.
2. Review `.overnight/CHECKPOINTS.md` (one entry per checkpoint with its proposed commit message and diff stat).
3. Replay the checkpoints as separate commits authored by **you** (Claude never runs this):
   ```bash
   bash .overnight/replay-checkpoints.sh
   ```
   It prompts per checkpoint: `c` commit · `e` edit message · `s` skip · `q` quit. It loads each snapshot into the
   index and never touches your working tree. Anything after the last checkpoint stays as ordinary uncommitted changes.
4. Turn off the auto-continue hook if it is still on: `rm -f .overnight/ENABLED`.
