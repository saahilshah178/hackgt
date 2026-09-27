"use client";

import { useState } from "react";
import { INTEREST_SUGGESTIONS, LEARNER_PURPOSES, type LearnerProfile } from "@/contracts/knowledge";
import type { ClarifyProbe, ProbeAnswer } from "@/pipeline/clarify";

/*
 * Step 2 of the intake: a few optional questions. Nothing here is graded or answered back: ticked
 * misconceptions become the game's targets, interests become its theme (src/pipeline/personalize.ts).
 */

const PURPOSE_LABEL: Record<(typeof LEARNER_PURPOSES)[number], string> = {
  exam: "An exam or quiz",
  homework: "Homework",
  class: "Keeping up in class",
  curiosity: "Just curious",
};

const MAX_INTERESTS = 6;

export interface ClarifyState {
  answers: Record<string, ProbeAnswer>;
  interests: string[];
  purpose: LearnerProfile["purpose"];
  note: string;
}

export const EMPTY_CLARIFY: ClarifyState = { answers: {}, interests: [], purpose: null, note: "" };

const chip = (on: boolean) =>
  `rounded-full border-2 px-4 py-2 text-lg transition-colors ${on ? "border-primary bg-primary/15 font-medium" : "border-border hover:border-primary/60"}`;

export function IntakeClarify({ probes, value, onChange }: { probes: ClarifyProbe[]; value: ClarifyState; onChange: (next: ClarifyState) => void }) {
  const [draft, setDraft] = useState("");

  const answerFor = (conceptId: string): ProbeAnswer => value.answers[conceptId] ?? { ticked: [], unsure: false };
  const setAnswer = (conceptId: string, a: ProbeAnswer) => onChange({ ...value, answers: { ...value.answers, [conceptId]: a } });
  const toggleStatement = (conceptId: string, id: string, on: boolean) => {
    const a = answerFor(conceptId);
    setAnswer(conceptId, { ...a, ticked: on ? [...a.ticked, id] : a.ticked.filter((x) => x !== id) });
  };

  const hasInterest = (x: string) => value.interests.some((i) => i.toLowerCase() === x.toLowerCase());
  const toggleInterest = (x: string) => {
    if (hasInterest(x)) onChange({ ...value, interests: value.interests.filter((i) => i.toLowerCase() !== x.toLowerCase()) });
    else if (value.interests.length < MAX_INTERESTS) onChange({ ...value, interests: [...value.interests, x] });
  };
  const addDraft = () => {
    const v = draft.replace(/[#\s]+/g, " ").trim().slice(0, 40);
    if (v && !hasInterest(v) && value.interests.length < MAX_INTERESTS) onChange({ ...value, interests: [...value.interests, v] });
    setDraft("");
  };
  const custom = value.interests.filter((i) => !INTEREST_SUGGESTIONS.some((s) => s === i.toLowerCase()));

  return (
    <div className="flex flex-col gap-12" data-testid="clarify-step">
      <section aria-labelledby="trips-heading">
        <h2 id="trips-heading" className="text-2xl font-semibold">
          What trips you up?
        </h2>
        <p className="mt-1 text-lg text-muted-foreground">
          Tick every statement that sounds true to you. There&apos;s no score here: whatever you tick becomes something your game makes you test for yourself.
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

      <section aria-labelledby="interests-heading">
        <h2 id="interests-heading" className="text-2xl font-semibold">
          What are you into?
        </h2>
        <p className="mt-1 text-lg text-muted-foreground">Pick up to {MAX_INTERESTS}. Your game&apos;s world and characters are built around them.</p>
        <div className="mt-4 flex flex-wrap gap-3" role="group" aria-label="Interests">
          {INTEREST_SUGGESTIONS.map((x) => (
            <button key={x} type="button" aria-pressed={hasInterest(x)} className={chip(hasInterest(x))} onClick={() => toggleInterest(x)} data-testid={`interest-${x}`}>
              {x}
            </button>
          ))}
          {custom.map((x) => (
            <button key={x} type="button" aria-pressed className={chip(true)} onClick={() => toggleInterest(x)} aria-label={`Remove ${x}`}>
              {x} ×
            </button>
          ))}
        </div>
        <form
          className="mt-4 flex max-w-xl gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            addDraft();
          }}
        >
          <label className="sr-only" htmlFor="interest-input">
            Add your own interest
          </label>
          <input
            id="interest-input"
            value={draft}
            maxLength={40}
            onChange={(e) => setDraft(e.target.value)}
            // typed but not "Add"ed still counts: leaving the box (or the step) adds it
            onBlur={addDraft}
            placeholder="Something else? (e.g. skateboarding)"
            className="h-12 flex-1 rounded-md border-2 border-border bg-background px-4 text-lg outline-none focus:border-primary"
            data-testid="interest-input"
          />
          <button
            type="submit"
            disabled={!draft.trim() || value.interests.length >= MAX_INTERESTS}
            className="h-12 rounded-md border-2 border-border px-5 text-lg disabled:opacity-50"
            data-testid="interest-add"
          >
            Add
          </button>
        </form>
      </section>

      <section aria-labelledby="purpose-heading" className="grid gap-8 md:grid-cols-2">
        <fieldset>
          <legend id="purpose-heading" className="text-2xl font-semibold">
            What&apos;s this for?
          </legend>
          <div className="mt-3 flex flex-col gap-2">
            {LEARNER_PURPOSES.map((p) => (
              <label key={p} className={`flex cursor-pointer items-center gap-3 rounded-md border p-3 text-lg ${value.purpose === p ? "border-primary bg-primary/10" : "border-border"}`}>
                <input
                  type="radio"
                  name="purpose"
                  value={p}
                  checked={value.purpose === p}
                  onChange={() => onChange({ ...value, purpose: p })}
                  className="h-5 w-5"
                  data-testid={`purpose-${p}`}
                />
                {PURPOSE_LABEL[p]}
              </label>
            ))}
          </div>
        </fieldset>
        <div>
          <label htmlFor="learner-note" className="text-2xl font-semibold">
            Anything else I should know?
          </label>
          <textarea
            id="learner-note"
            value={value.note}
            maxLength={400}
            rows={6}
            onChange={(e) => onChange({ ...value, note: e.target.value })}
            placeholder="e.g. Test on Friday. I always mix up which graph starts at zero."
            className="mt-3 w-full rounded-md border-2 border-border bg-background p-4 text-lg outline-none focus:border-primary"
            data-testid="learner-note"
          />
          <p className="text-sm text-muted-foreground">{value.note.length}/400</p>
        </div>
      </section>
    </div>
  );
}
