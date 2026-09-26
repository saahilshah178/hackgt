import type { JobDone, ProgressEvent } from "../../../../../contracts/progress";
import { onClose, subscribe } from "../../../../../pipeline/events";
import { getStorage } from "../../../../../server/storage";

/*
 * GET /api/jobs/[id]/stream: SSE progress for the Forge screen. Replays history (subscribe() does
 * this) then streams live events, a `: heartbeat` comment every 15s, and ends with `event: done`.
 * If the job is already finished when the stream opens, onClose() fires immediately (events.ts), so
 * history + done are still delivered in order. See instructions.md §9.
 */
export const dynamic = "force-dynamic";

const HEARTBEAT_MS = 15_000;

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await context.params;
  const job = await getStorage().getJob(id);
  if (!job) return new Response(JSON.stringify({ error: `No job with id "${id}".` }), { status: 404, headers: { "Content-Type": "application/json" } });

  const encoder = new TextEncoder();
  let unsubscribe = () => {};
  let unclose = () => {};
  let heartbeat: ReturnType<typeof setInterval> | undefined;

  let closed = false;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (event: string, data: ProgressEvent | JobDone) => {
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          // controller already closed (client disconnected); teardown happens in cancel()
        }
      };
      const cleanup = () => {
        closed = true;
        unsubscribe();
        unclose();
        if (heartbeat) clearInterval(heartbeat);
      };
      unsubscribe = subscribe(id, (event) => send("progress", event));
      // If the job already finished, this fires synchronously right here (see events.ts's onClose),
      // so guard the heartbeat setup below with `closed` instead of assuming it always runs after.
      unclose = onClose(id, (done) => {
        send("done", done);
        cleanup();
        try {
          controller.close();
        } catch {
          // already closed
        }
      });
      if (!closed) {
        heartbeat = setInterval(() => {
          try {
            controller.enqueue(encoder.encode(`: heartbeat\n\n`));
          } catch {
            cleanup();
          }
        }, HEARTBEAT_MS);
      }
    },
    cancel() {
      unsubscribe();
      unclose();
      if (heartbeat) clearInterval(heartbeat);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
