import { describe, expect, it } from "vitest";
import { LABEL_PRIORITY, layoutLabels, type LabelBox } from "./label-layout";

const box = (id: string, kind: LabelBox["kind"], sx: number, sy: number, w = 120, h = 34): LabelBox => ({ id, kind, sx, sy, w, h });
const top = (b: LabelBox, dy: number) => b.sy - b.h + dy;
const bottom = (b: LabelBox, dy: number) => b.sy + dy;

describe("label layout (w1a fix 8)", () => {
  it("leaves labels that do not touch where they are", () => {
    const r = layoutLabels([box("a", "chip", 100, 100), box("b", "pin", 400, 100), box("c", "npc_name", 100, 300)]);
    expect([...r.values()]).toEqual([
      { dy: 0, hidden: false },
      { dy: 0, hidden: false },
      { dy: 0, hidden: false },
    ]);
  });

  it("the interact prompt wins over an NPC nameplate: the name moves up out of its way", () => {
    const prompt = box("interact", "interact", 500, 400, 360, 42);
    const name = box("npc:otis", "npc_name", 480, 396, 90, 28);
    const r = layoutLabels([name, prompt]); // input order must not matter for different priorities
    expect(r.get("interact")).toEqual({ dy: 0, hidden: false });
    const n = r.get("npc:otis");
    expect(n?.hidden).toBe(false);
    expect(bottom(name, n?.dy ?? 0)).toBeLessThanOrEqual(top(prompt, 0) - 4);
  });

  it("a rail pin moves off a live chip, never the other way round", () => {
    const chip = box("chip:e1:1", "chip", 700, 300, 150, 36);
    const pin = box("pin:e1:3", "pin", 690, 310, 80, 30);
    const r = layoutLabels([pin, chip]);
    expect(r.get("chip:e1:1")?.dy).toBe(0);
    const p = r.get("pin:e1:3");
    expect(p?.hidden).toBe(false);
    const dy = p?.dy ?? 0;
    const clear = bottom(pin, dy) <= top(chip, 0) - 4 || top(pin, dy) >= bottom(chip, 0) + 4;
    expect(clear).toBe(true);
  });

  it("moves up first; goes down only when there is no room above (the stage top or maxShift)", () => {
    const high = box("high", "chip", 300, 200, 200, 40);
    const low = box("low", "pin", 300, 228, 100, 30); // mostly below the chip: up still wins
    expect(layoutLabels([high, low]).get("low")?.dy).toBeLessThan(0);
    // near the stage top: up would leave the stage, so it goes below the chip
    const nearTop = box("chip", "chip", 300, 50, 200, 40);
    const under = box("pin", "pin", 300, 60, 100, 30);
    const r = layoutLabels([nearTop, under]);
    expect(r.get("pin")?.dy).toBeGreaterThan(0);
    expect(top(under, r.get("pin")?.dy ?? 0)).toBeGreaterThanOrEqual(bottom(nearTop, 0) + 4);
  });

  it("stacks past several blockers and hides a label with no free slot within maxShift", () => {
    const a = box("a", "chip", 300, 300);
    const b = box("b", "chip", 300, 262);
    const c = box("c", "chip", 300, 338);
    const pin = box("pin", "pin", 300, 300);
    const r = layoutLabels([a, b, c, pin], { maxShift: 200 });
    expect(r.get("pin")?.hidden).toBe(false);
    expect(Math.abs(r.get("pin")?.dy ?? 0)).toBeGreaterThan(60);
    const tight = layoutLabels([a, b, c, pin], { maxShift: 40 });
    expect(tight.get("pin")).toEqual({ dy: 0, hidden: true });
  });

  it("keeps the input order among equal priorities (a chip stack does not reorder)", () => {
    const first = box("chip:0", "chip", 200, 200);
    const second = box("chip:1", "chip", 200, 210);
    const r = layoutLabels([first, second]);
    expect(r.get("chip:0")?.dy).toBe(0);
    expect(r.get("chip:1")?.dy).not.toBe(0);
  });

  it("a nudged label keeps last frame's slot while it is free (no flicker), and returns home once the way clears", () => {
    const chip = box("chip", "chip", 400, 300, 160, 36);
    const pin = box("pin", "pin", 400, 300, 80, 30);
    const f1 = layoutLabels([chip, pin]);
    const up = f1.get("pin")?.dy ?? 0;
    expect(up).toBe(300 - 36 - 4 - 300);
    // the chip slid down 10 px: the nearest slot above is now 10 px lower, but last frame's slot is still free: keep it
    const chip2 = { ...chip, sy: 310 };
    const f2 = layoutLabels([chip2, pin], { previous: f1 });
    expect(f2.get("pin")?.dy).toBe(up);
    expect(layoutLabels([chip2, pin]).get("pin")?.dy).toBe(up + 10);
    // the chip is gone: back to the anchor
    const f3 = layoutLabels([pin], { previous: f2 });
    expect(f3.get("pin")?.dy).toBe(0);
  });

  it("orders every label kind", () => {
    const kinds = Object.keys(LABEL_PRIORITY);
    expect(kinds.sort()).toEqual(["chip", "emote", "flap", "interact", "label_swap", "npc_name", "pin", "plaque_title", "prompt"]);
    expect(LABEL_PRIORITY.interact).toBeGreaterThan(LABEL_PRIORITY.chip);
    expect(LABEL_PRIORITY.chip).toBeGreaterThan(LABEL_PRIORITY.pin);
    expect(LABEL_PRIORITY.pin).toBeGreaterThan(LABEL_PRIORITY.npc_name);
  });
});
