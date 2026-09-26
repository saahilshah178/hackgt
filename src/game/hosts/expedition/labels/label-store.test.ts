import { describe, expect, it } from "vitest";
import { LabelStore } from "./label-store";

describe("label store", () => {
  it("keeps labels set this frame, drops the rest, bumps the version only on change", () => {
    const s = new LabelStore();
    s.beginFrame({ viewX: 100, viewY: 50, zoom: 2 });
    s.set({ id: "a", kind: "chip", x: 110, y: 60, text: "y: 0.5", color: "f" });
    s.set({ id: "b", kind: "interact", x: 120, y: 70, text: "E · Read" });
    s.endFrame();
    const v1 = s.version;
    expect(s.all()).toHaveLength(2);
    expect(s.project(s.get("a") as never)).toEqual({ sx: 20, sy: 20 });
    s.beginFrame({ viewX: 100, viewY: 50, zoom: 2 });
    s.set({ id: "a", kind: "chip", x: 110, y: 60, text: "y: 0.5", color: "f" });
    s.endFrame();
    expect(s.get("b")).toBeUndefined();
    expect(s.version).toBe(v1 + 1);
    s.beginFrame({ viewX: 0, viewY: 0, zoom: 1 });
    s.set({ id: "a", kind: "chip", x: 110, y: 60, text: "y: 0.5", color: "f" });
    s.endFrame();
    expect(s.version).toBe(v1 + 1); // unchanged content, no bump
    s.beginFrame({ viewX: 0, viewY: 0, zoom: 1 });
    s.set({ id: "a", kind: "chip", x: 111, y: 60, text: "y: 0.6", color: "f", dy: -10 });
    s.endFrame();
    expect(s.version).toBe(v1 + 2);
    expect(s.byKind("chip")).toHaveLength(1);
    expect(s.project({ x: 10, y: 10, dy: -4 })).toEqual({ sx: 10, sy: 6 });
    s.clear();
    expect(s.all()).toEqual([]);
  });

  it("screen-reader text is deduplicated and fanned out", () => {
    const s = new LabelStore();
    const got: string[] = [];
    const off = s.onSr((k, t) => got.push(`${k}:${t}`));
    s.setSr("e1", "The notch is home.");
    s.setSr("e1", "The notch is home.");
    s.setSr("e2", "Other.");
    off();
    s.setSr("e1", "Changed.");
    expect(got).toEqual(["e1:The notch is home.", "e2:Other."]);
    expect(s.sr("e1")).toBe("Changed.");
    expect(s.sr("zz")).toBeNull();
  });
});
