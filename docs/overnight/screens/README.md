# Screenshots

Captured by `e2e/golden-path.spec.ts` (upload → intake → forge → play → debrief → library) at 1440×900,
full-page, in mock mode (`LLM_MODE=mock`, `STORAGE_DRIVER=local`, `AUDIO_MODE=off`). Re-run with:

```
pnpm exec playwright test e2e/golden-path.spec.ts --reporter=line
```

| File | Page | What it shows |
|---|---|---|
| `01-home.png` | `/` | Upload panel (drop zone / paste / topic tabs), the "How it works" strip, and the four showcase cards (Trigonometry, Cell transport, Civil rights history, Wave-2 proving ground) with genre and concept count read live from their fixtures. |
| `02-intake.png` | `/intake/[sourceId]` | Concepts found per unit with page ranges (per-concept and unit-overall), confidence sliders, goal/length/genre setup, and the 3-question pre-check. |
| `03-forge.png` | `/forge/[jobId]` | One fixed-height card per pipeline agent (status, elapsed time, latest note), the "Enter the game" button on completion, verifier catches, and the mechanic wishlist. |
| `04-play.png` | `/play/[gameId]` | The Dungeon host mid-game (trig fixture), reached via `window.__GAME_DEBUG__.autoSolve()`. |
| `05-end-screen.png` | `/play/[gameId]` (end state) | The in-game end screen: score bars and "what you just did" lines before linking to the debrief. |
| `06-debrief.png` | `/debrief/[gameId]` | Pre → post score, per-concept mastery bars, "what you just did" cards, and the Replay / Regenerate / Focus-on-weak-spots actions. |
| `07-library.png` | `/library` | The 316-card teaching-mechanic catalog, paginated to 48 cards per page with a "Show more" link, plus the family × genre adapter matrix. |

All pages run with the dark theme (projector-grade contrast) and the "Mock mode" banner, since no paid
API keys are used in this build.
