"use client";

import type { LearnerProfile } from "@/contracts/knowledge";
import type { ClarifyProbe, ProbeAnswer } from "@/pipeline/clarify";

/*
 * The optional quick check's "what trips you up?": nothing here is graded or answered back; ticked misconceptions
 * become the game's targets (src/pipeline/personalize.ts). The intake no longer asks for interests, purpose or a
 * note (less friction); the profile still carries those fields, left empty, for API clients.
 */

export interface ClarifyState {
  answers: Record<string, ProbeAnswer>;
  interests: string[];
  purpose: LearnerProfile["purpose"];
  note: string;
}

export const EMPTY_CLARIFY: ClarifyState = { answers: {}, interests: [], purpose: null, note: "" };

export function IntakeClarify({ probes, value, onChange }: { probes: ClarifyProbe[]; value: ClarifyState; onChange: (next: ClarifyState) => void }) {
  const answerFor = (conceptId: string): ProbeAnswer => value.answers[conceptId] ?? { ticked: [], unsure: false };
  const setAnswer = (conceptId: string, a: ProbeAnswer) => onChange({ ...value, answers: { ...value.answers, [conceptId]: a } });
  const toggleStatement = (conceptId: string, id: string, on: boolean) => {
    const a = answerFor(conceptId);
    setAnswer(conceptId, { ...a, ticked: on ? [...a.ticked, id] : a.ticked.filter((x) => x !== id) });
  };

  return (
    <div className="flex flex-col gap-12" data-testid="clarify-step">
      <section aria-labelledby="trips-heading">
        <h2 id="trips-heading" className="text-2xl font-semibold">
          What trips you up?
        </h2>
        <p className="mt-1 text-lg text-muted-foreground">
          Tick every statement that sounds true to you. There&apos;s no score here: whatever you tick, your game teaches and then has you test for yourself.
        </p>
        {probes.length === 0 ? (
          <p className="mt-4 text-lg text-muted-foreground" data-testid="probes-empty">
            Nothing to ask about the concepts you picked. On to the next part.
          </p>
        ) : (
          <div className="mt-5 grid gap-5 md:grid-cols-2">
            {probes.map((p) => {
              const a = answerFor(p.conceptId);
              return (
                <fieldset key={p.conceptId} className="rounded-lg border border-border/60 bg-card p-5" data-testid={`probe-${p.conceptId}`}>
                  <legend className="px-1 text-xl font-semibold">{p.conceptName}</legend>
                  <div className="mt-2 flex flex-col gap-2">
                    {p.statements.map((s) => (
                      <label
                        key={s.id}
                        className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 text-lg ${a.ticked.includes(s.id) ? "border-primary bg-primary/10" : "border-border"}`}
                      >
                        <input
                          type="checkbox"
                          className="mt-1 h-5 w-5 shrink-0"
                          checked={a.ticked.includes(s.id)}
                          onChange={(e) => toggleStatement(p.conceptId, s.id, e.target.checked)}
                          data-testid={`probe-${p.conceptId}-${s.id}`}
                        />
                        <span>{s.text}</span>
                      </label>
                    ))}
                    <label className={`flex cursor-pointer items-center gap-3 rounded-md border border-dashed p-3 text-lg ${a.unsure ? "border-primary bg-primary/10" : "border-border"}`}>
                      <input
                        type="checkbox"
                        className="h-5 w-5"
                        checked={a.unsure}
                        onChange={(e) => setAnswer(p.conceptId, { ...a, unsure: e.target.checked })}
                        data-testid={`probe-${p.conceptId}-unsure`}
                      />
                      <span className="text-muted-foreground">I&apos;m not sure about this one</span>
                    </label>
                  </div>
                </fieldset>
              );
            })}
          </div>
        )}
      </section>

    </div>
  );
}
