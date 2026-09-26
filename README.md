# Learning Game Forge

Upload class notes or a textbook chapter, and get a game where the ideas are the rules.
HackGT 13, social good track.

## Run it (one laptop, three commands)

1. Install Node.js 22 or newer from https://nodejs.org (the installer is enough).
2. Open a terminal in this folder and run:

```bash
npm install -g pnpm     # once
pnpm install            # once, and again whenever package.json changes
pnpm dev                # starts the app
```

3. Open http://localhost:3000 in a browser.

Without an API key the app runs in **mock mode**: uploads work, but the subject and grade are rough guesses
and nothing is rejected. To turn the real checks on, copy `.env.example` to `.env`, fill in one provider's key,
and restart `pnpm dev`. `pnpm check:models` proves the key and model names work.

## Try a PDF from the terminal

```bash
pnpm samples                                   # writes four sample PDFs to fixtures/samples
pnpm try:pdf fixtures/samples/trig-notes.pdf   # prints what the student would see
```

## Checks

```bash
pnpm typecheck && pnpm lint && pnpm test
```

## How it is built

See [instructions.md](./instructions.md) for the architecture, folder map and the rules every coding agent follows.
