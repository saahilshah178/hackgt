import { Info } from "lucide-react";

/**
 * Shown on every page while LLM_MODE=mock. Server component: reads the env on the server only.
 * The value is a public fact about the deployment, never a secret.
 */
export function MockBanner() {
  const mode = process.env.LLM_MODE ?? "mock";
  if (mode !== "mock") return null;
  return (
    <div role="status" className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm text-amber-900">
      <Info className="mr-1.5 inline size-4 -translate-y-px" aria-hidden />
      <strong>Mock mode.</strong> No model calls are made: any upload maps to the trig sample and games come from recorded
      fixtures. See <code className="rounded bg-amber-100 px-1">FIRST_RUN.md</code> step 3 to go live.
    </div>
  );
}
