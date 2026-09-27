import { describe, expect, it } from "vitest";
import { ARCHETYPE_IDS } from "../../../../world/library";
import { needsSilhouette, primExtent, SIL_TONE_TOKENS, SILHOUETTE_ARCHETYPES, silhouetteFor, silhouetteTones, type SilBounds } from "./silhouettes";

/** Frame bounds the three side-cars' stations produce (meta.frameBounds, anchor-relative). */
const FRAMES: Readonly<Record<string, SilBounds>> = {
  emitter_rail: { x: -620, y: -760, w: 1370, h: 1130 },
  ring_gate: { x: -620, y: -640, w: 1180, h: 900 },
  claim_holders: { x: -820, y: -500, w: 880, h: 620 },
  step_bridge: { x: -1020, y: -460, w: 1880, h: 740 },
  pendulum_sync: { x: -420, y: -560, w: 840, h: 640 },
  router_lanes: { x: -560, y: -820, w: 1120, h: 920 },
  sluice_waves: { x: -560, y: -560, w: 1650, h: 880 },
  stage_machine: { x: -420, y: -560, w: 840, h: 640 },
  oracle_ticker: { x: -360, y: -640, w: 1800, h: 760 },
  cause_tubes: { x: -360, y: -1080, w: 1020, h: 1260 },
  switchboard: { x: -640, y: -720, w: 1500, h: 820 },
  tumbler_vault: { x: -700, y: -1150, w: 1400, h: 1250 },
  console_slate: { x: -300, y: -500, w: 600, h: 520 },
};

function within(inner: SilBounds, outer: SilBounds, slack: number): boolean {
  return inner.x >= outer.x - slack && inner.y >= outer.y - slack && inner.x + inner.w <= outer.x + outer.w + slack && inner.y + inner.h <= outer.y + outer.h + slack;
}

describe("DOM station silhouettes (w1a fix 5)", () => {
  it("has a dedicated drawing for every demo archetype", () => {
    expect([...SILHOUETTE_ARCHETYPES].sort()).toEqual([...ARCHETYPE_IDS].sort());
  });

  it("each archetype draws several primitives inside its frame bounds, with the noun under the machine", () => {
    for (const id of SILHOUETTE_ARCHETYPES) {
      const frame = FRAMES[id];
      const s = silhouetteFor(id, frame, "Test Machine");
      expect(s.prims.length, id).toBeGreaterThanOrEqual(4);
      for (const p of s.prims) expect(within(primExtent(p), frame, 40), `${id}: ${JSON.stringify(p)}`).toBe(true);
      expect(within(s.box, frame, 0)).toBe(true);
      expect(s.label.text).toBe("Test Machine");
      expect(s.label.y).toBeGreaterThan(s.box.y + s.box.h);
      expect(s.label.size).toBeGreaterThanOrEqual(34);
      for (const p of s.prims) for (const v of Object.values(p)) if (typeof v === "number") expect(Number.isFinite(v), `${id} ${p.p}`).toBe(true);
    }
  });

  it("is deterministic, and distinct per archetype", () => {
    const a = silhouetteFor("ring_gate", FRAMES.ring_gate, "Gate");
    expect(silhouetteFor("ring_gate", FRAMES.ring_gate, "Gate")).toEqual(a);
    const shapes = new Set(SILHOUETTE_ARCHETYPES.map((id) => JSON.stringify(silhouetteFor(id, FRAMES.console_slate, "x").prims)));
    expect(shapes.size).toBe(SILHOUETTE_ARCHETYPES.length);
  });

  it("the dial and the ring gate are centred on the station anchor (their parts rotate about it)", () => {
    for (const id of ["emitter_rail", "ring_gate"]) {
      const s = silhouetteFor(id, FRAMES[id], "x");
      expect(s.prims.some((p) => p.p === "circle" && p.cx === 0 && p.cy === 0), id).toBe(true);
    }
  });

  it("an unknown archetype or a degenerate frame still draws a generic machine", () => {
    const s = silhouetteFor("counterweight_lift", null, "Lift");
    expect(s.prims.length).toBeGreaterThanOrEqual(3);
    expect(s.box.w).toBeGreaterThan(0);
    expect(silhouetteFor("claim_holders", { x: 0, y: 0, w: 0, h: 0 }, "x").box.w).toBeGreaterThan(100);
  });

  it("maps tones to the biome palette, first token found, with hex fallbacks", () => {
    const t = silhouetteTones({ "orrery.brass": "#C69A6B", "stone.lit": "#FFFFFF", "gold.base": "not-a-hex" });
    expect(t.body).toBe("#C69A6B");
    expect(t.light).toBe("#FFFFFF");
    expect(t.trim).toMatch(/^#[0-9A-F]{6}$/i); // the malformed token falls through to the fallback
    for (const tone of Object.keys(SIL_TONE_TOKENS)) expect(silhouetteTones({})[tone as keyof typeof t]).toMatch(/^#[0-9A-F]{6}$/i);
  });

  it("draws the silhouette only when the host reports a machine part without built art", () => {
    const parts = [{ asset: "orrery_terraces.part.vesper_dial_disc" }, { asset: "orrery_terraces.part.vesper_dial_console" }];
    expect(needsSilhouette(parts, undefined)).toBe(false); // no catalog knowledge: draw the parts
    expect(needsSilhouette(parts, () => false)).toBe(true);
    expect(needsSilhouette(parts, (k) => k.endsWith("_disc"))).toBe(false); // the console is drawn by the stage
    expect(needsSilhouette([{ asset: "x.part.a_console" }], () => true)).toBe(true); // only a console: no machine to show
  });
});
