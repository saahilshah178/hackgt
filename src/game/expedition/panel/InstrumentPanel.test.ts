/**
 * Server-rendered structure of the instrument panel (node env: react-dom/server, no DOM). Proves the kept testids,
 * the D4 guard attribute, the Scrubber's slider semantics, the RECORD card's display slot, the widget fallback, the
 * badge, and the vault and sandbox layouts. Measured SVG geometry renders on the client only (see metrics.tsx).
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import civilFixture from "../../../../fixtures/civil-rights-dungeon.json";
import trigFixture from "../../../../fixtures/trig-dungeon.json";
import wave2Fixture from "../../../../fixtures/wave2-dungeon.json";
import { GameSpec } from "../../../contracts/gamespec";
import { ProbeSpec, RecordStrip } from "../../../contracts/world";
import { getMode } from "../../../mechanics/registry";
import { getContraption } from "../../../world/library";
import type { AnyContraptionMeta, ModeKey, PanelContext } from "../../../world/types";
import { InstrumentPanel, type InstrumentPanelProps } from "./InstrumentPanel";
import type { PanelStation } from "./types";

function station(specRaw: unknown, encId: string) {
  const spec = GameSpec.parse(specRaw);
  const i = spec.encounters.findIndex((e) => e.id === encId);
  const e = spec.encounters[i];
  const view = getMode(e.familyId, e.mode)!.present(e.params, spec.seed + i);
  return { e, view, modeKey: `${e.familyId}.${e.mode}` as ModeKey };
}

const NO_CONTEXT: PanelContext = { recordStrip: null, solvedIds: [], probeWindow: null };

function render(p: Partial<InstrumentPanelProps> & Pick<InstrumentPanelProps, "station" | "meta" | "view">): string {
  return renderToStaticMarkup(
    createElement(InstrumentPanel, {
      context: NO_CONTEXT,
      instruction: "Set the dial.",
      onDraft: () => undefined,
      onVerify: () => undefined,
      onBack: () => undefined,
      ...p,
    }),
  );
}

function panelStation(over: Partial<PanelStation> & Pick<PanelStation, "encounterId" | "modeKey">): PanelStation {
  return {
    layout: "scrub",
    skinId: "",
    objectNoun: "Tidewheel Gate",
    verifyLabel: "LOCK THE RINGS",
    successBadge: "RINGS LOCKED",
    inputSymbol: null,
    cardOverrides: [],
    bossPhases: [],
    config: {},
    probe: null,
    ...over,
  };
}

const count = (html: string, needle: string) => html.split(needle).length - 1;

describe("InstrumentPanel (server markup)", () => {
  const e2 = station(trigFixture, "e2_period");
  const ringGate = getContraption("ring_gate") as AnyContraptionMeta;

  it("keeps the testids and the D4 guard, and the scalar input is a keyboard slider", () => {
    const html = render({ station: panelStation({ encounterId: "e2_period", modeKey: e2.modeKey }), meta: ringGate, view: e2.view });
    expect(html).toContain('data-testid="instrument-panel"');
    expect(html).toContain('data-panel=""');
    expect(html).toContain('data-testid="panel-back"');
    expect(html).toContain('data-testid="widget-submit"');
    expect(html).toContain("LOCK THE RINGS");
    expect(html).toContain('data-control="scrub"');
    expect(html).toMatch(/role="slider"[^>]*aria-valuemin="0"[^>]*aria-valuemax="6.28/);
    expect(html).toMatch(/aria-valuenow="0"/);
    expect(html).toMatch(/aria-valuetext="0"/);
    expect(html).toContain('data-testid="scrubber-tab">T<');
    expect(html).toMatch(/data-testid="card-graph"/); // the view-default f(t) card while ring_gate is a W0 stub
    expect(html).not.toMatch(/data-testid="widget-submit"[^>]*\sdisabled=""/); // scalar drafts are always complete
    expect(count(html, "aria-describedby=")).toBeGreaterThan(1);
  });

  it("the success badge replaces Verify", () => {
    const html = render({ station: panelStation({ encounterId: "e2_period", modeKey: e2.modeKey }), meta: ringGate, view: e2.view, result: "success" });
    expect(html).toContain('data-testid="success-badge"');
    expect(html).toContain("RINGS");
    expect(html).not.toContain('data-testid="widget-submit"');
  });

  it("civil: the RECORD card sits at display slot 0 above the meta's cards; AimControl draws its claims; Verify waits", () => {
    const e1 = station(civilFixture, "e1_brown");
    const strip = RecordStrip.parse({ lanes: [{ id: "origins", label: "ORIGINS" }], pins: [{ encounterId: "e1_brown", pin: { date: "1954", precision: "year", label: "Brown v. Board", lane: "origins", spanTo: null } }] });
    const probe = ProbeSpec.parse({ symbol: "YEAR", label: "record year", min: 1950, max: 1960, step: 1 / 12, format: "month_year", window: { start: 1950, end: 1960 } });
    const meta = getContraption("claim_holders") as AnyContraptionMeta;
    const html = render({
      station: panelStation({ encounterId: "e1_brown", modeKey: e1.modeKey, objectNoun: "Witness Projector", verifyLabel: "RETRACT SLIDE", successBadge: "SLIDE RETRACTED", probe }),
      meta,
      view: e1.view,
      context: { recordStrip: strip, solvedIds: [], probeWindow: probe.window },
    });
    expect(html).toContain('data-display-slot="0" data-meta-slot="record"');
    expect(html).toContain("RECORD");
    expect(html).toContain('data-control="aim"');
    expect(html).toContain('role="radiogroup"');
    expect(html).toContain('data-testid="widget-first-option"');
    expect(count(html, 'role="radio"')).toBe(3);
    expect(html).toMatch(/data-testid="widget-submit"[^>]*\sdisabled=""/);
    expect(html).toContain('data-testid="probe-scrubber"');
    expect(html).toContain('aria-valuetext="JAN 1950"');
    expect(html).toContain(">YEAR<");
  });

  it("any mode without a native instrument mounts its widget (console_slate) and keeps the widget's own submit", () => {
    const w = station(wave2Fixture, "w1_slope");
    const html = render({
      station: panelStation({ encounterId: "w1_slope", modeKey: w.modeKey, layout: "board", objectNoun: "Console Slate", verifyLabel: "VERIFY" }),
      meta: getContraption("console_slate") as AnyContraptionMeta,
      view: w.view,
    });
    expect(html).toContain('data-control="widget"');
    expect(html).toContain('data-testid="widget-control"');
    expect(count(html, 'data-testid="widget-submit"')).toBe(1);
    expect(html).toContain('data-layout="board"');
  });

  it("vault: the dimmed room, the brief column, the matrix; sandbox: DONE and no Verify", () => {
    const e12 = station(civilFixture, "e12_boss");
    const vault = render({
      station: panelStation({ encounterId: "e12_boss", modeKey: e12.modeKey, layout: "vault", objectNoun: "Editor's Vault", verifyLabel: "OPEN THE VAULT" }),
      meta: getContraption("tumbler_vault") as AnyContraptionMeta,
      view: e12.view,
      brief: { prompt: "The Editor's question.", plaque: null, hints: [] },
    });
    expect(vault).toContain("xp-vault-dim");
    expect(vault).toContain('data-testid="brief-sheet"');
    expect(vault).toContain('data-control="matrix"');
    expect(vault).toContain("ACCUSE");
    const sandbox = render({ station: panelStation({ encounterId: "e2_period", modeKey: e2.modeKey, layout: "sandbox" }), meta: ringGate, view: e2.view });
    expect(sandbox).toContain(">DONE<");
    expect(sandbox).not.toContain('data-testid="widget-submit"');
  });

  it("a restored draft reopens where the player left it", () => {
    const html = render({
      station: panelStation({ encounterId: "e2_period", modeKey: e2.modeKey }),
      meta: ringGate,
      view: e2.view,
      initialDraft: { encounterId: "e2_period", modeKey: e2.modeKey, input: { value: Math.PI / 2 }, complete: true, focus: null, hover: null, probe: null, settled: true, wave: null, marks: null, seq: 4 },
    });
    expect(html).toContain('aria-valuetext="π/2"');
  });
});
