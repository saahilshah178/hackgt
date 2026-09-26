# Learning Game Forge — instructions for every coding agent

Read this before touching the repo. Next.js here is v16: read `node_modules/next/dist/docs/` for anything you are unsure of.

## Product
A student uploads a PDF or pastes text. We read it, show what we found, and turn the concepts into a game where the ideas are the rules. Games are NOT generated as code: model calls produce structured JSON validated by zod; hand-built genre runtimes and a library of learning mechanics render it.

## Folder map
- `src/contracts/`  zod schemas shared by pipeline, verifier and runtime — the single source of truth
- `src/pipeline/`   model calls and the steps that use them (server only)
- `src/storage/`    JSON-on-disk records under `data/` (swap for a DB later; nothing else should care)
- `src/components/` React components, grouped by screen
- `src/app/`        routes and route handlers
- `src/mechanics/`  learning-mechanic registry (step 3)
- `src/game/`       Phaser runtime, genre hosts, overlay widgets (step 4)
- `fixtures/`       hand-written specs and sample PDFs so everything can be built without model calls
- `scripts/`        one-off scripts run with `pnpm <name>`

## Conventions
- Every model call goes through `runAgent` in `src/pipeline/llm.ts` (AI SDK v7: `generateText` + `Output.object`). Never call a provider directly. Model names live only in `src/pipeline/models.ts`.
- No agent frameworks. Each pipeline agent is an async function from typed input to typed output; the orchestrator is plain `Promise.all` with the concurrency cap in `llm.ts`.
- Schemas the model must fill (`*Out` in `src/contracts`) are shape-only: types, required-ness, descriptions. Every limit — ranges, lengths, enum words, counts — is enforced by a normalise function in code (clamp, trim, map, drop), never by rejecting the model's answer. Stored shapes (`Concept`, `KnowledgeMap`, `GateResult`) stay strict because normalise produces them.
- Numeric answers are computed with mathjs, never trusted from a model.
- The app must run with no API key (mock mode) so the UI and tests never block on credits.
- Keep the architecture boring: App Router, plain React, Tailwind, no clever abstractions.

## Working rules
- Never run `git commit`; never add co-author trailers. Work in checkpoints: stop, list changed files, propose a commit message.
- `pnpm typecheck`, `pnpm lint` and `pnpm test` must pass at every checkpoint.
- Every checkpoint ends with a plain-English note: what was built, how to check it in the browser, what is still stubbed.
