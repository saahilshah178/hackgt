import type { LanguageModel } from "ai";
import { gatekeeperSchema, type GatekeeperSlice } from "../../contracts/slices";
import { runAgent } from "../llm";
import { GATEKEEPER_SYSTEM, gatekeeperPrompt, type GatekeeperSource } from "./gatekeeper.prompt";

/*
 * S1 Gatekeeper (FAST): does this material deserve a game, and how big is it? See MEGAPROMPT §3.
 */

export interface GatekeeperContext {
  /** the source's actual page count (1 for an unpaged topic) */
  pageCount: number;
}

/** outline pages ascending, pageEnd >= pageStart, and within the source's page count. */
export function checkGatekeeper(g: GatekeeperSlice, ctx: GatekeeperContext): string[] {
  const problems: string[] = [];
  let lastStart = 0;
  g.outline.forEach((o, i) => {
    if (o.pageEnd < o.pageStart) problems.push(`outline[${i}] "${o.title}": pageEnd must be >= pageStart`);
    if (ctx.pageCount > 0 && o.pageStart > ctx.pageCount) {
      problems.push(`outline[${i}] "${o.title}": pageStart ${o.pageStart} is beyond the source's ${ctx.pageCount} page(s)`);
    }
    if (ctx.pageCount > 0 && o.pageEnd > ctx.pageCount) {
      problems.push(`outline[${i}] "${o.title}": pageEnd ${o.pageEnd} is beyond the source's ${ctx.pageCount} page(s)`);
    }
    if (o.pageStart < lastStart) {
      problems.push(`outline must be listed in ascending page order; "${o.title}" starts before the previous entry`);
    }
    lastStart = o.pageStart;
  });
  return problems;
}

export interface RunGatekeeperArgs extends GatekeeperSource {
  jobId: string;
  pageCount: number;
  /** Overrides the FAST model (tests inject a mock model here). */
  model?: LanguageModel;
}

export function runGatekeeper(a: RunGatekeeperArgs): Promise<GatekeeperSlice> {
  return runAgent({
    jobId: a.jobId,
    agent: "gatekeeper",
    tier: "fast",
    model: a.model,
    schema: gatekeeperSchema(),
    system: GATEKEEPER_SYSTEM,
    prompt: gatekeeperPrompt({ title: a.title, pages: a.pages }),
    check: (g) => checkGatekeeper(g, { pageCount: a.pageCount }),
    maxRepairs: 1,
  });
}
