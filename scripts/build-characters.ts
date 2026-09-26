/**
 * scripts/build-characters.ts — `pnpm chars:build`: an alias for the rig step, which runs inside the art build
 * (`pnpm art:build --ns shared`, docs/design/20 §5.2 step 9, §5.5).
 */
import { spawnSync } from "node:child_process";

const r = spawnSync(process.execPath, ["--import", "tsx", "scripts/build-art.ts", "--ns", "shared", ...process.argv.slice(2)], { stdio: "inherit" });
process.exit(r.status ?? 1);
