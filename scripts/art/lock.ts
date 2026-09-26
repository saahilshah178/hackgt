/**
 * scripts/art/lock.ts — `.data/art-build.lock` (20 §5.1 "Generated files"): generated art is written only by
 * `pnpm art:build` while it holds the lock, so any lane may run the build without two writers racing.
 */
import fs from "node:fs";
import path from "node:path";

const STALE_MS = 15 * 60 * 1000;

function alive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/** Acquire the lock or throw; returns the release function (also released on process exit). */
export function acquireLock(root: string): () => void {
  const file = path.join(root, ".data", "art-build.lock");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      fs.writeFileSync(file, JSON.stringify({ pid: process.pid, started: new Date().toISOString() }), { flag: "wx" });
      let released = false;
      const release = () => {
        if (released) return;
        released = true;
        try {
          const cur = JSON.parse(fs.readFileSync(file, "utf8")) as { pid: number };
          if (cur.pid === process.pid) fs.unlinkSync(file);
        } catch {
          /* already gone */
        }
      };
      process.once("exit", release);
      return release;
    } catch {
      let holder: { pid: number; started: string } | null = null;
      try {
        holder = JSON.parse(fs.readFileSync(file, "utf8")) as { pid: number; started: string };
      } catch {
        holder = null;
      }
      const stale = !holder || !alive(holder.pid) || Date.now() - Date.parse(holder.started) > STALE_MS;
      if (!stale) throw new Error(`another art:build holds .data/art-build.lock (pid ${holder!.pid}, since ${holder!.started}); wait for it or delete the lock if that process is gone`);
      fs.rmSync(file, { force: true });
    }
  }
  throw new Error("could not acquire .data/art-build.lock");
}
