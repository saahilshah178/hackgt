"use client";

import { useEffect, useRef, useState } from "react";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import type { DebriefConcept, DebriefLine } from "../runner/encounter-runner";
import type { TelemetryEvent } from "../../contracts/telemetry";

export interface EndScreenProps {
  gameId: string;
  title: string;
  outro: { speakerId: string; text: string }[];
  mastery: DebriefConcept[];
  lines: DebriefLine[];
  telemetry: readonly TelemetryEvent[];
}

/**
 * End screen: score bars + "what you just did" lines from runner.debrief(), posts telemetry (tolerating
 * a missing/failing endpoint) and links to /debrief/[id].
 */
export function EndScreen({ gameId, title, outro, mastery, lines, telemetry }: EndScreenProps) {
  const [posted, setPosted] = useState<"pending" | "ok" | "failed">("pending");
  const sent = useRef(false);

  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    try {
      sessionStorage.setItem(`qf:telemetry:${gameId}`, JSON.stringify(telemetry));
    } catch {
      // sessionStorage can throw (private mode, disabled storage); the debrief page falls back to the server.
    }
    fetch(`/api/games/${gameId}/telemetry`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // The API expects a bare TelemetryEvent[] (instructions.md §9), not { events: [...] }.
      body: JSON.stringify(telemetry),
    })
      .then((r) => setPosted(r.ok ? "ok" : "failed"))
      .catch(() => setPosted("failed"));
  }, [gameId, telemetry]);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 p-6" data-testid="end-screen">
      <h1 className="text-3xl font-bold" style={{ fontSize: 30 }}>
        {title}: run complete
      </h1>
      {outro.map((l, i) => (
        <p key={i} className="text-lg italic" style={{ fontSize: 18 }}>
          &ldquo;{l.text}&rdquo;
        </p>
      ))}

      <Card>
        <CardHeader>
          <CardTitle>Mastery</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {mastery.map((m) => (
            <div key={m.conceptId} className="flex items-center gap-3">
              <span className="w-48 truncate text-base" style={{ fontSize: 16 }}>
                {m.name}
              </span>
              <Progress value={Math.round(m.score * 100)} className="h-2 flex-1" aria-label={`${m.name} mastery`} />
              <span className="w-12 text-right text-sm tabular-nums" style={{ fontSize: 14 }}>
                {Math.round(m.score * 100)}%
              </span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>What you just did</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {lines.map((l) => (
            <p key={l.encounterId} className="text-base" style={{ fontSize: 16 }}>
              {l.text}
            </p>
          ))}
        </CardContent>
      </Card>

      <p className="text-sm opacity-70" style={{ fontSize: 14 }} data-testid="telemetry-status">
        {posted === "pending" ? "Sending telemetry…" : posted === "ok" ? "Telemetry sent." : "Telemetry unavailable (offline)."}
      </p>

      <a href={`/debrief/${gameId}`} className={buttonVariants({ size: "lg" })} data-testid="end-debrief-link">
        See full debrief
      </a>
    </div>
  );
}
