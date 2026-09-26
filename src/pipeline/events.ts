import type { JobDone, ProgressEvent } from "../contracts/progress";

/*
 * In-memory event bus feeding the SSE job stream (GET /api/jobs/[id]/stream, P6). One bus per jobId,
 * bounded history so a late subscriber (a browser tab that opens after generation started) still sees
 * everything so far, plus best-effort persistence through the storage driver when one is configured.
 */

const MAX_HISTORY = 500;

type Listener = (event: ProgressEvent) => void;
type CloseListener = (done: JobDone) => void;

interface JobBus {
  history: ProgressEvent[];
  listeners: Set<Listener>;
  closeListeners: Set<CloseListener>;
  closed?: JobDone;
}

const buses = new Map<string, JobBus>();

function busFor(jobId: string): JobBus {
  let bus = buses.get(jobId);
  if (!bus) {
    bus = { history: [], listeners: new Set(), closeListeners: new Set() };
    buses.set(jobId, bus);
  }
  return bus;
}

/** What callers pass to emit(): a ProgressEvent without jobId/at, which are filled in here. */
export type ProgressInput = Omit<ProgressEvent, "jobId" | "at"> & { at?: string };

/** Records an event in the job's history, notifies live subscribers, and persists it best-effort. */
export function emit(jobId: string, event: ProgressInput): ProgressEvent {
  const full: ProgressEvent = { ...event, jobId, at: event.at ?? new Date().toISOString() };
  const bus = busFor(jobId);
  bus.history.push(full);
  if (bus.history.length > MAX_HISTORY) bus.history.splice(0, bus.history.length - MAX_HISTORY);
  for (const listener of bus.listeners) listener(full);
  void persist(jobId, full);
  return full;
}

async function persist(jobId: string, event: ProgressEvent): Promise<void> {
  try {
    const { getStorage } = await import("../server/storage");
    await getStorage().appendEvents(jobId, [event]);
  } catch {
    // Best-effort only: no storage driver configured (e.g. plain unit tests) is not an error here.
  }
}

/** Subscribes to a job's events; the callback first replays history, then gets live events. Returns an unsubscribe. */
export function subscribe(jobId: string, cb: Listener): () => void {
  const bus = busFor(jobId);
  for (const event of bus.history) cb(event);
  bus.listeners.add(cb);
  return () => {
    bus.listeners.delete(cb);
  };
}

/** A snapshot of everything emitted for a job so far (bounded to the last MAX_HISTORY events). */
export function history(jobId: string): ProgressEvent[] {
  return [...busFor(jobId).history];
}

/** Marks a job's stream as finished; late onClose subscribers still get the terminal message. */
export function close(jobId: string, done: JobDone): void {
  const bus = busFor(jobId);
  bus.closed = done;
  for (const cb of bus.closeListeners) cb(done);
  bus.closeListeners.clear();
}

/** Registers a callback for when a job closes; fires immediately if it already has. Returns an unsubscribe. */
export function onClose(jobId: string, cb: CloseListener): () => void {
  const bus = busFor(jobId);
  if (bus.closed) {
    cb(bus.closed);
    return () => {};
  }
  bus.closeListeners.add(cb);
  return () => {
    bus.closeListeners.delete(cb);
  };
}
