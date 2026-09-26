# Overnight kit: how to launch

This kit contains:

| Path | What it's for |
|---|---|
| `MEGAPROMPT.md` | The instructions Claude Code executes |
| `docs/LIBRARY.md` | The genre and mechanic library |
| `seed/gamespec-starter/` | Tested code to start from |
| `.claude/settings.json` | Pins the main session to Opus and denies git writes |
| `.claude/agents/` | The six Opus/Sonnet subagents and a Sonnet Explore override |
| `.claude/hooks/keep-going.mjs` | The Stop hook that keeps the run going |
| `.overnight/` | Checkpoint tools |

## 1. Put the kit in your repo root
```bash
cd ~/code/your-hackgt-repo          # or: mkdir -p ~/code/hackgt && cd ~/code/hackgt
unzip ~/Downloads/hackgt-overnight-kit.zip -d /tmp/kit
cp -R /tmp/kit/hackgt-overnight-kit/. .
ls -a    # you should see MEGAPROMPT.md, docs/, seed/, .claude/, .overnight/
```
If the repo already has a `.claude/settings.json`, merge the `model`, `env`, `permissions.deny`, and `hooks` blocks into it.

## 2. Keep the laptop awake and plugged in
On macOS, run this in a separate terminal tab and leave it running:
```bash
caffeinate -dimsu
```

## 3. Launch Claude Code
Start it in auto mode on Opus:
```bash
claude --model opus --permission-mode auto
```
- **Accept the folder-trust prompt.** The Stop hook only runs in a trusted folder.
- **Check the model.** The header or `/model` should say Opus. The project settings also pin Opus.

Auto mode runs without permission prompts; a classifier blocks risky actions instead. If your plan doesn't offer auto mode, run inside a container or VM with `--permission-mode bypassPermissions`. Deny rules still apply in every mode. With neither option, the run will stall at the first permission prompt.

## 4. Paste this and go to sleep
```
Read MEGAPROMPT.md and execute it now. I'm asleep; don't ask me anything.
```

To check that subagents are running on Sonnet or Opus, run `/tasks`; each row shows its model.

If a usage limit pauses the run, type `continue` after the reset. It resumes from `PROGRESS.md`.

## 5. In the morning
1. Read `MORNING_REPORT.md`, then follow `FIRST_RUN.md` to set up keys and run the first live test.
2. Turn off the auto-continue hook if it's still on: `rm -f .overnight/ENABLED`
3. Review `.overnight/CHECKPOINTS.md`.
4. Replay the checkpoints as separate commits authored by you:
   ```bash
   bash .overnight/replay-checkpoints.sh
   ```
   It prompts once per checkpoint: `c` commit, `e` edit the message, `s` skip, `q` quit. It never modifies your working tree, and it refuses to run through an agent.
