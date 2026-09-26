/**
 * Shown on every page while LLM_MODE=mock. Server component: reads the env on the server only.
 * The value is a public fact about the deployment, never a secret.
 */
export function MockBanner() {
  const mode = process.env.LLM_MODE ?? "mock";
  if (mode !== "mock") return null;
  return (
    <div role="status" className="bg-amber-500/15 px-6 py-2 text-center text-base text-amber-200">
      <strong>Mock mode.</strong> No model calls are made: any upload maps to the trig sample and games come from recorded
      fixtures. See <code>FIRST_RUN.md</code> step 3 to go live.
    </div>
  );
}
