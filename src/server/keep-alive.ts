import { after } from "next/server";

/**
 * Keeps a serverless function alive until `work` settles (next/server's after(), which Vercel backs with
 * waitUntil), so a background job is not frozen once the response is sent. Outside a request scope (route
 * handlers called directly from tests) after() throws; the promise is already running, so that is fine.
 */
export function keepAlive(work: Promise<unknown>): void {
  try {
    after(work);
  } catch {
    // Not in a request: nothing to extend.
  }
}
