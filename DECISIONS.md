# DECISIONS (overnight build)

Format: one line of decision, one line of the alternative not taken. Newest at the bottom.

- 23:21 **Merged `hackgt-overnight-kit/` into the repo root** (README-FIRST step 1 had not been done); removed the now-empty kit folder. Root `LIBRARY.md` and `MEGAPROMPT.md` were byte-identical to the kit copies; kept `MEGAPROMPT.md` at root (that's where the kit puts it) and left the duplicate root `LIBRARY.md` in place (untracked; safe to delete).
  Alternative: run from inside the kit folder; rejected because every path in MEGAPROMPT.md is root-relative and `.claude/settings.json` only applies at the project root.
- 23:22 **pnpm installed with `npm install -g pnpm`** because neither pnpm nor corepack exist on this machine (Homebrew Node 26.5.1 ships without corepack).
  Alternative: `npm i -g corepack && corepack enable`; FIRST_RUN.md documents both.
- 23:26 **TypeScript pinned to 5.9.3 instead of the seed's 7.0.2.** Next 16.3.6's create-next-app scaffolds `typescript ^5` and its build-time type check is only documented for TS 5; the seed compiles unchanged under 5.9.3.
  Alternative: TS 7 (native) with Next's `useTypeScriptCli`; untested tonight, one-line bump later.
- 23:27 **`"type": "module"` in package.json** so `tsx scripts/*.ts` can use top-level await and `import.meta.url` (the seed scripts do).
  Alternative: CJS with `.mts` scripts; more churn.
- 23:28 **Seed placed into the target layout now** rather than kept flat: `src/genres/catalog.ts` → `src/library/genres.ts`, `src/validate/*` → `src/pipeline/validate/*`, `encounter-runner.ts` → `src/game/runner/`. Mechanics stay flat in `src/mechanics/` until the P1 family migration.
  Alternative: import verbatim and move in P1; would mean touching every import twice.
- 23:30 **Dropped the scaffold's Google Fonts** (`next/font/google` fetches at build time); system-ui stack instead so offline builds and CI work.
  Alternative: self-hosted font files; revisit for the demo look if time allows.
- 23:33 **`pnpm run doctor` documented instead of `pnpm doctor`**: pnpm 12 has a builtin `doctor` that shadows package scripts.
  Alternative: rename the script (would diverge from MEGAPROMPT's script list).
- 23:34 **Playwright e2e uses `pnpm dev` (Turbopack) as its webServer** in mock mode for speed; `pnpm build` is still verified separately at each UI checkpoint.
  Alternative: `pnpm build && pnpm start` per e2e run; slower iteration overnight.
- 23:45 **The boss socket is universal**: `socketsFor(family, genre)` appends the genre's boss socket to every family that has an adapter in that genre. LIBRARY §5 only lists "boss" for tuner/function_world/simulator, which would leave most subjects without a legal boss and break the "boss is never dropped" rule.
  Alternative: restrict bosses to the listed families and force a tuner/function_world boss; rejected as too narrow for history/biology games.
- 23:46 **Pre-check comes from the intake, post-check from the Assessment writer.** GameSpec.assessment.pre is copied from `intake.preCheck.items`; the assessment agent writes `post` only and is told the pre prompts to avoid. The seed wrote both at generation time, but the v2 flow asks the pre-check before the game exists.
  Alternative: keep pre+post in one call; would duplicate the pre-check the student already answered.
- 23:47 **Mastery meter starts at 0.5** (`MasteryConfig.initial`, configurable). LIBRARY §8 gives the deltas (+0.15 / +0.08 / −0.05) but not the starting value; from 0 a 3-encounter concept could never pass 0.45, which reads as failure on the debrief.
  Alternative: start at 0 (literal reading); one constant to flip.
- 23:48 **Director genre override deferred.** Genre is resolved in code before the Director runs (requested genre if its host exists, else LIBRARY §1.1 auto-select); the Director's schema is built for that genre and it cannot override. Logged as TODO(overnight) in generate.ts.
  Alternative: a `genreOverride` field plus a second Director call with a rebuilt schema; not worth a second SMART call tonight.
- 23:49 **Trig fixture: minutes 5, e3 role "teach", pages 1–4.** The v2 encounter counts (10 min → 8–12) don't fit the seed's 6 encounters, the new teach-before-practice check rejects a first-appearance "practice", and the mock curriculum output must cite pages that exist in the 4-page sample PDF (P5a) so quote verification passes in mock mode.
  Alternative: keep the seed's textbook page numbers and skip quote verification in mock mode; rejected because the mock flow should exercise the real verifier.
- 23:58 **All 14 families registered now, unbuilt modes as `stubMode` (implemented: false)** so every LIBRARY §6 card can reference a real family·mode and the wishlist works; P4/P9 replace stubs with real files.
  Alternative: register families only as they are built; the catalog validation would then have to special-case unknown modes.
- 00:02 **TypeScript-facing `answerVars` may be a function of params** (`answerVarsFor()` helper) because tuner.oscillator's answer placeholder depends on `ask`.
  Alternative: a fixed list containing every ask var; would forbid {{amplitude}} in a period prompt even though the equation shows it.
