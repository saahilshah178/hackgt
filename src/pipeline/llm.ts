import { APICallError, generateText, NoObjectGeneratedError, NoOutputGeneratedError, Output, type LanguageModel } from "ai";
import pLimit from "p-limit";
import type { z } from "zod";
import type { ProgressStatus } from "../contracts/progress";
import { emit } from "./events";
import { getModel, tierOptions, type Tier } from "./models";
import { repairNote } from "./prompts";

/*
 * Every LLM call in the pipeline goes through runAgent(): generateText + Output.object, one repair
 * retry (or maxRepairs) on a zod/check failure, 429/503 retry honoring Retry-After, a global
 * concurrency cap of 6, and progress events through the event bus (MEGAPROMPT §3).
 */

export class AgentError extends Error {
  constructor(
    readonly agent: string,
    readonly problems: string[],
  ) {
    super(`${agent} failed after repairs: ${problems.join("; ")}`);
  }
}

/** What runAgent reports per attempt, mirroring the shape callers have used since the seed. */
export interface Progress {
  agent: string;
  status: ProgressStatus;
  ms?: number;
  note?: string;
}

export type Sleep = (ms: number) => Promise<void>;
const defaultSleep: Sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** One global limiter shared by every runAgent call in the process (MEGAPROMPT §3: concurrency cap of 6). */
const globalLimit = pLimit(6);

const MAX_RATE_LIMIT_RETRIES = 3;
const RATE_LIMIT_CAP_MS = 20_000;
const RATE_LIMIT_DEFAULT_MS = 2_000;

/** Parses a Retry-After header: seconds (`"2"`) or an HTTP date. Returns undefined if unparsable. */
export function parseRetryAfterMs(value: string | undefined | null): number | undefined {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const at = Date.parse(value);
  if (!Number.isNaN(at)) return Math.max(0, at - Date.now());
  return undefined;
}

export interface RunAgentOptions<T> {
  jobId: string;
  agent: string;
  tier: "smart" | "fast";
  /** Overrides the tier's model (tests inject MockLanguageModelV4 here). */
  model?: LanguageModel;
  schema: z.ZodType<T>;
  system: string;
  prompt: string;
  check?: (out: T) => string[];
  maxRepairs?: number;
  /** Legacy-shaped callback some callers still use alongside the event bus. */
  onProgress?: (p: Progress) => void;
  /** Injectable for tests that make a fake model throw 429/503 and assert on backoff timing. */
  sleep?: Sleep;
}

async function generateWithRetry<T>(o: RunAgentOptions<T>, model: LanguageModel, notes: string, sleep: Sleep): Promise<T> {
  const providerOptions = tierOptions(o.tier);
  let backoff = RATE_LIMIT_DEFAULT_MS;
  for (let retry = 0; ; retry++) {
    try {
      const { output } = await generateText({
        model,
        system: o.system,
        prompt: o.prompt + notes,
        output: Output.object({ schema: o.schema, name: o.agent.replace(/[^a-zA-Z0-9_-]/g, "_") }),
        ...(providerOptions ? { providerOptions } : {}),
      });
      return output as T;
    } catch (err) {
      const retryable = APICallError.isInstance(err) && (err.statusCode === 429 || err.statusCode === 503);
      if (!retryable || retry >= MAX_RATE_LIMIT_RETRIES) throw err;
      const retryAfter = parseRetryAfterMs(err.responseHeaders?.["retry-after"]);
      const wait = Math.min(retryAfter ?? backoff, RATE_LIMIT_CAP_MS);
      await sleep(wait);
      backoff *= 2;
    }
  }
}

async function runAgentUnlimited<T>(o: RunAgentOptions<T>): Promise<T> {
  const model = o.model ?? getModel(o.tier);
  const sleep = o.sleep ?? defaultSleep;
  const report = (status: ProgressStatus, extra: Partial<Progress> = {}) => {
    const p: Progress = { agent: o.agent, status, ...extra };
    o.onProgress?.(p);
    emit(o.jobId, p);
  };

  let notes = "";
  let problems: string[] = [];
  const attempts = (o.maxRepairs ?? 1) + 1;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const t0 = Date.now();
    report(attempt === 1 ? "start" : "repair", { note: problems[0] });
    let output: T;
    try {
      output = await generateWithRetry(o, model, notes, sleep);
    } catch (err) {
      // The model's JSON didn't parse or didn't match the zod schema: feed the error back and retry.
      if (NoObjectGeneratedError.isInstance(err) || NoOutputGeneratedError.isInstance(err)) {
        problems = [`your answer did not match the required JSON schema: ${err.message}`];
        notes = repairNote(problems);
        continue;
      }
      throw err; // network/auth/rate-limit-exhausted errors: let the caller decide
    }
    problems = o.check?.(output) ?? [];
    if (problems.length === 0) {
      report("done", { ms: Date.now() - t0 });
      return output;
    }
    notes = repairNote(problems, output);
  }
  report("failed", { note: problems[0] });
  throw new AgentError(o.agent, problems);
}

/** The one entry point every LLM call in the pipeline goes through. */
export function runAgent<T>(o: RunAgentOptions<T>): Promise<T> {
  return globalLimit(() => runAgentUnlimited(o));
}
