import { execSync } from "node:child_process";
import { accessSync, constants, existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { APP_NAME } from "../src/config";
import { inspectEnv, loadLocalEnvFile } from "../src/server/env";

/*
 * `pnpm doctor`: prints the active modes, which env vars are missing for each stage, tool versions,
 * and the single next step to take. Never calls the network. Exit code 1 only when the selected
 * modes cannot run.
 */

const ok = (s: string) => `  ✔ ${s}`;
const bad = (s: string) => `  ✘ ${s}`;
const info = (s: string) => `  · ${s}`;

function version(cmd: string): string {
  try {
    return execSync(cmd, { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    return "not found";
  }
}

const loadedEnvFile = loadLocalEnvFile();
const report = inspectEnv();
const lines: string[] = [];
const problems: string[] = [];
let nextStep = "";

lines.push(`${APP_NAME} doctor`);
lines.push("");
lines.push("Modes");
lines.push(info(`LLM_MODE=${report.modes.llm}   STORAGE_DRIVER=${report.modes.storage}   AUDIO_MODE=${report.modes.audio}`));
lines.push(info(loadedEnvFile ? "loaded .env.local" : "no .env.local (fine for mock mode; `cp .env.example .env.local` when you add keys)"));
lines.push("");

lines.push("Tooling");
const node = process.versions.node;
const [major, minor] = node.split(".").map(Number);
const nodeOk = major > 22 || (major === 22 && minor >= 12);
lines.push((nodeOk ? ok : bad)(`node ${node}${nodeOk ? "" : " (need >= 22.12; see FIRST_RUN.md step 1)"}`));
if (!nodeOk) problems.push("Node is too old");
const pnpm = version("pnpm -v");
lines.push((pnpm === "not found" ? bad : ok)(`pnpm ${pnpm}${pnpm === "not found" ? " (npm i -g pnpm; see FIRST_RUN.md step 1)" : ""}`));
if (pnpm === "not found") problems.push("pnpm missing");
const chromium = (() => {
  const home = process.env.HOME ?? "";
  const candidates = [
    resolve(home, "Library/Caches/ms-playwright"),
    resolve(home, ".cache/ms-playwright"),
    resolve(process.env.LOCALAPPDATA ?? "", "ms-playwright"),
  ];
  return candidates.some((p) => existsSync(p));
})();
lines.push((chromium ? ok : info)(`playwright browsers ${chromium ? "installed" : "not found (pnpm exec playwright install chromium; only needed for pnpm e2e)"}`));
lines.push("");

lines.push("Stages");
for (const s of report.stages) {
  const setCount = s.vars.filter((v) => v.set).length;
  const status = s.active ? (setCount === s.vars.length ? ok : bad) : info;
  lines.push(status(`${s.label.padEnd(26)} ${s.active ? "ACTIVE" : "off   "}  ${setCount}/${s.vars.length} vars set  (${s.step})`));
  for (const v of s.vars) if (s.active && !v.set) lines.push(`      missing ${v.name}`);
}
for (const issue of report.issues) {
  lines.push(bad(issue));
  problems.push(issue);
}
for (const warning of report.warnings) lines.push(info(warning)); // non-blocking: never added to `problems`
lines.push("");

lines.push("Storage");
if (report.modes.storage === "local") {
  const dir = resolve(process.cwd(), report.env.DATA_DIR);
  try {
    mkdirSync(dir, { recursive: true });
    accessSync(dir, constants.W_OK);
    lines.push(ok(`local data dir writable: ${dir}`));
  } catch {
    lines.push(bad(`cannot write ${dir}`));
    problems.push("data dir not writable");
  }
} else {
  lines.push(info("supabase driver selected; run `pnpm smoke:supabase` to test the connection"));
}
lines.push("");

if (report.missing.length > 0) {
  problems.push(...report.missing.map((m) => `${m.name} missing`));
  nextStep = `Add ${report.missing.map((m) => m.name).join(", ")} to .env.local (${report.missing[0].step}), or switch the mode back to mock/local/off.`;
} else if (report.modes.llm === "mock") {
  nextStep = "Everything needed for mock mode is present. Run `pnpm test`, then `pnpm dev` and open http://localhost:3000. To go live: FIRST_RUN.md step 3.";
} else {
  nextStep = "Live keys are set. Run `pnpm smoke:openai`, then `pnpm try:pdf samples/trig-notes.pdf` (FIRST_RUN.md step 4).";
}

lines.push(problems.length ? `Problems: ${problems.join("; ")}` : "No problems for the selected modes.");
lines.push("");
lines.push(`Next step: ${nextStep}`);
console.log(lines.join("\n"));
process.exit(problems.length ? 1 : 0);
