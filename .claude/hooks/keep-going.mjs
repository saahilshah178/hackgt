#!/usr/bin/env node
// Overnight auto-continue. When Claude tries to stop, tell it to continue with the next
// unfinished phase, up to a hard cap. Active only while .overnight/ENABLED exists, and never
// after PROGRESS.md starts with "STATUS: COMPLETE". Delete .overnight/ENABLED to turn it off.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const dir = join(root, ".overnight");
const MAX = Number(process.env.OVERNIGHT_MAX_CONTINUES || 40);

let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => (input += chunk));
process.stdin.on("end", () => {
  if (!existsSync(join(dir, "ENABLED"))) process.exit(0);
  const progressPath = join(root, "PROGRESS.md");
  const progress = existsSync(progressPath) ? readFileSync(progressPath, "utf8") : "";
  if (/^\s*STATUS:\s*COMPLETE/i.test(progress)) process.exit(0);

  const countPath = join(dir, "continues");
  const n = existsSync(countPath) ? Number(readFileSync(countPath, "utf8")) || 0 : 0;
  if (n >= MAX) process.exit(0);
  writeFileSync(countPath, String(n + 1));

  const reason = [
    `Overnight run not finished (auto-continue ${n + 1}/${MAX}). Do not ask questions; the user is asleep.`,
    "Re-read instructions.md and PROGRESS.md, then continue with the next unchecked item in MEGAPROMPT.md section 9.",
    "If the current item is blocked: log it in BLOCKERS.md, stub it behind its interface, checkpoint, and move on.",
    "When every phase is done or blocked: finalize FIRST_RUN.md and MORNING_REPORT.md, put 'STATUS: COMPLETE' on line 1 of PROGRESS.md, and delete .overnight/ENABLED.",
  ].join(" ");
  process.stdout.write(JSON.stringify({ decision: "block", reason }));
});
