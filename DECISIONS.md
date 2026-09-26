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
