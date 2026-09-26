import { describe, expect, it } from "vitest";
import type { InteractTarget } from "../../types";
import { interactLabel, nearest, targetKey, type Interactable } from "./proximity";

const item = (target: InteractTarget, x: number, surface: string | null = "ground"): Interactable => ({ key: targetKey(target), target, x, y: 0, surface, label: "" });

describe("proximity", () => {
  const a = item({ kind: "station", encounterId: "e1" }, 100);
  const b = item({ kind: "npc", npcId: "otis", stateId: "s1" }, 250);
  const c = item({ kind: "plaque", plaqueId: "p1" }, 180, "ledge");
  const any = item({ kind: "collectible", collectibleId: "c1" }, 400, null);

  it("acquires within 90 and keeps the target until 130 (hysteresis)", () => {
    expect(nearest([a, b], { x: 400, surface: "ground" }, null)).toBeNull();
    expect(nearest([a, b], { x: 170, surface: "ground" }, null)?.key).toBe("station:e1");
    expect(nearest([a, b], { x: 185, surface: "ground" }, "station:e1")?.key).toBe("station:e1"); // b is nearer, not clearly
    expect(nearest([a], { x: 225, surface: "ground" }, "station:e1")?.key).toBe("station:e1"); // held up to 130
    expect(nearest([a, b], { x: 228, surface: "ground" }, "station:e1")?.key).toBe("npc:otis"); // clearly nearer wins
    expect(nearest([a], { x: 231, surface: "ground" }, "station:e1")).toBeNull();
    expect(nearest([a], { x: 50, surface: "ground" }, "gone:x")?.key).toBe("station:e1");
  });

  it("filters by surface; null surfaces match everywhere", () => {
    expect(nearest([c], { x: 180, surface: "ground" }, null)).toBeNull();
    expect(nearest([c], { x: 180, surface: "ledge" }, null)?.key).toBe("plaque:p1");
    expect(nearest([any], { x: 400, surface: "ledge" }, null)?.key).toBe("collectible:c1");
  });

  it("keys and labels for every kind", () => {
    const targets: InteractTarget[] = [
      { kind: "station", encounterId: "e1" },
      { kind: "sandbox", sandboxId: "box" },
      { kind: "npc", npcId: "n", stateId: "s" },
      { kind: "plaque", plaqueId: "p" },
      { kind: "collectible", collectibleId: "c" },
      { kind: "touch", propId: "t" },
      { kind: "vehicle", encounterId: "e2" },
      { kind: "link", linkId: "l", verb: "hop" },
      { kind: "exit", exitId: "x" },
    ];
    expect(targets.map(targetKey)).toEqual(["station:e1", "sandbox:box", "npc:n", "plaque:p", "collectible:c", "touch:t", "vehicle:e2", "link:l", "exit:x"]);
    expect(interactLabel("station", "Tidewheel Gate")).toBe("E · Use the Tidewheel Gate console");
    expect(interactLabel("npc", "Brasswick")).toBe("E · Talk to Brasswick");
    expect(interactLabel("plaque", "x")).toBe("E · Read");
    expect(interactLabel("sandbox", "Music Box")).toBe("E · Open the Music Box");
    expect(interactLabel("touch", "Light the lantern")).toBe("E · Light the lantern");
    expect(interactLabel("collectible", "the page")).toBe("E · Pick up the page");
    expect(interactLabel("vehicle", "lift")).toBe("E · Board the lift");
    expect(interactLabel("link", "Space · Hop")).toBe("Space · Hop");
    expect(interactLabel("exit", "Depths")).toBe("→ Depths");
  });
});
