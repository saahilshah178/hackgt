# GameSpec starter

Contracts, mechanic plugins, validator, assembler, generation pipeline, and a headless runtime for the
PDF-to-game generator. Everything here typechecks and `npm test` passes (27 tests) with no API key.

```
npm install
npm test                      # fixture validity, headless play, repair routing, strict-schema audit, mock pipeline
npm run typecheck
npm run build:fixture         # slices -> assemble -> validate -> fixtures/trig-dungeon.json
OPENAI_API_KEY=... npm run smoke:openai   # one real Director call; run this at kickoff
```

## How the pieces fit

```
KnowledgeMap + Intake
  -> Director (1 smart call, dynamic schema)                         src/pipeline/generate.ts
  -> in parallel: challenge writer x N | narrative | assessment      each with its own small schema
     each call: zod parse -> slice checks -> repair note -> retry once
  -> fallback: failed encounter becomes a Mimic Chest from verified facts (or is dropped)
  -> assemble (code): solutions, {{placeholders}}, shuffles, layout  src/pipeline/assemble.ts
  -> validate: structural -> referential -> semantic -> self-solve   src/validate/validate-gamespec.ts
  -> one repair round routed to the owning agent
  -> GameSpec JSON (store as jsonb) -> /play: EncounterRunner + Phaser genre host
```

| Path | What it is |
|---|---|
| `src/contracts/gamespec.ts` | The stored document. Never sent to a model. |
| `src/contracts/slices.ts` | LLM-facing schemas, built per call; ids are enums so references can't dangle. |
| `src/mechanics/*.ts` | One file per mechanic: params schema, check, resolve, grade, present, authoring guide. |
| `src/genres/catalog.ts` | Sockets and prefab chunks per genre host. |
| `src/validate/` | Slice checks (become repair notes) and full-spec validation (issues carry path + owner). |
| `src/game/encounter-runner.ts` | Game logic without Phaser: submit, hints, telemetry, autoSolve, debrief. |
| `fixtures/` | A complete trig dungeon: knowledge map, the slices each agent returns, and the assembled JSON. |

## Adding a mechanic

1. Copy `src/mechanics/phase-gate.ts`, change the params schema and the functions.
2. Add it to `MECHANICS` in `src/mechanics/registry.ts`.
3. `npm test`: the strict-schema audit covers it automatically. Add one fixture slice and a self-solve test.
4. Build its React widget (renders `present()`'s view, returns the `grade()` input) and its Phaser skin per genre.

Rules for LLM-facing schemas (enforced by `tests/strict-schemas.test.ts`): root object; every field required
(`.nullable()`, never `.optional()`); no `z.record`; `z.union`, never `z.discriminatedUnion`; single-value
`z.enum`, never `z.literal`; no string length/regex rules (check those in code); bound every integer.

## Mock mode

`tests/pipeline-mock.test.ts` runs the real pipeline against `MockLanguageModelV4` from `ai/test`.
Wire the same mock into the app behind `MOCK_LLM=1` so UI work never waits on (or pays for) the API.

## Versions (npm latest on Sep 25, 2026)

zod 4.6, ai 7.0 (`generateText` + `Output.object`), @ai-sdk/openai 4.0 (strict JSON schema on by default),
mathjs 15, TypeScript 7, vitest 5. Coding agents: put a pointer to this README in `instructions.md`.
