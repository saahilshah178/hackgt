"use client";
/**
 * src/game/expedition/client/SandboxPanel.tsx (H2) — the sandbox layout of the panel (docs/design/20 §2.4b): scrub
 * geometry, no Verify, the back tab reads DONE. Controls come from `meta.inputs(config)`: one or two probe scrubbers,
 * or a token tray. Nothing here is graded; drafts go to the host's SandboxController (sim → pose → goals).
 * TODO(w1): the token tray is a plain list of "place on …" buttons until the Darkroom's art lands (P1 content).
 */
import "../panel/theme.css";
import { useMemo, useRef, useState, type CSSProperties } from "react";
import type { ResolvedSandbox, SandboxDraft, SandboxInput } from "../../../world/types";
import { rangeOfProbe } from "../panel/controls/scrub.logic";
import { BackTab } from "../panel/primitives/BackTab";
import { HexGrid } from "../panel/primitives/HexGrid";
import { Scrubber } from "../panel/Scrubber";

export interface SandboxPanelProps {
  sandbox: ResolvedSandbox;
  onDraft: (d: SandboxDraft) => void;
  onDone: () => void;
  style?: CSSProperties;
}

type ProbeInput = Extract<SandboxInput, { kind: "probe" }>;
type TokenInput = Extract<SandboxInput, { kind: "tokens" }>;

export function SandboxPanel({ sandbox, onDraft, onDone, style }: SandboxPanelProps) {
  const inputs = useMemo<readonly SandboxInput[]>(() => {
    try {
      return sandbox.meta.inputs(sandbox.parsedConfig);
    } catch {
      return [];
    }
  }, [sandbox]);
  const probes = inputs.filter((i): i is ProbeInput => i.kind === "probe");
  const trays = inputs.filter((i): i is TokenInput => i.kind === "tokens");
  const [values, setValues] = useState<Record<string, number>>(() => Object.fromEntries(probes.map((p) => [p.id, p.spec.initial ?? p.spec.min])));
  const [placed, setPlaced] = useState<Record<string, string>>({});
  const seq = useRef(0);

  const emit = (v: Record<string, number>, p: Record<string, string>, settled: boolean) => {
    seq.current += 1;
    onDraft({ values: v, placed: p, settled, seq: seq.current });
  };

  return (
    <>
    <div className="xp-vault-dim" aria-hidden />
    <section
      className="xp-panel"
      style={style}
      data-panel=""
      data-layout="sandbox"
      data-testid="instrument-panel"
      data-sandbox={sandbox.id}
      aria-label={`${sandbox.title} (sandbox: nothing is graded)`}
      tabIndex={-1}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          onDone();
        }
      }}
    >
      <HexGrid />
      <div className="xp-body">
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--xp-gap)", minHeight: 0, height: "100%" }}>
          <div className="xp-head">
            <BackTab onBack={onDone} done />
            <span className="xp-head-title">{sandbox.title}</span>
          </div>
          <div className="xp-main" data-testid="panel-instrument">
            {probes.map((p) => (
              <Scrubber
                key={p.id}
                range={rangeOfProbe(p.spec)}
                value={values[p.id] ?? p.spec.min}
                symbol={p.spec.symbol}
                label={`${p.spec.label} (sandbox)`}
                probe={p.spec}
                onChange={(v, settled) => {
                  const next = { ...values, [p.id]: v };
                  setValues(next);
                  emit(next, placed, settled);
                }}
                testId={`sandbox-${p.id}`}
              />
            ))}
            {trays.map((tray) => (
              <fieldset key={tray.id} style={{ border: "none", margin: 0, padding: 0, display: "grid", gap: 8, fontSize: 20 }}>
                <legend className="xp-sr-only">{tray.id}</legend>
                {tray.tokens.map((tok) => (
                  <div key={tok.key} role="group" aria-label={tok.label} style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                    <span style={{ minWidth: 160 }}>{tok.label}</span>
                    {tray.targets.map((t) => (
                      <button
                        key={t.key}
                        type="button"
                        className="xp-token"
                        aria-pressed={placed[tok.key] === t.key}
                        onClick={() => {
                          const next = { ...placed, [tok.key]: t.key };
                          setPlaced(next);
                          emit(values, next, true);
                        }}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                ))}
              </fieldset>
            ))}
            {probes.length === 0 && trays.length === 0 ? <p className="xp-hint">This sandbox has nothing to adjust yet.</p> : null}
          </div>
        </div>
      </div>
    </section>
    </>
  );
}
