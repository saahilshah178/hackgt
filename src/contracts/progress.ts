import { z } from "zod";

export const ProgressStatus = z.enum(["start", "repair", "done", "fallback", "failed"]);
export type ProgressStatus = z.infer<typeof ProgressStatus>;

/** One line on the Forge screen. Emitted by runAgent() and by the verifier; streamed over SSE. */
export const ProgressEvent = z.object({
  jobId: z.string().min(1),
  /** e.g. "director", "challenge:e2_period", "verifier" */
  agent: z.string().min(1),
  status: ProgressStatus,
  ms: z.number().int().min(0).optional(),
  note: z.string().optional(),
  at: z.iso.datetime().optional(),
});
export type ProgressEvent = z.infer<typeof ProgressEvent>;

/** Terminal message on the job stream. */
export const JobDone = z.object({ done: z.literal(true), gameId: z.string().nullable(), error: z.string().nullable() });
export type JobDone = z.infer<typeof JobDone>;
