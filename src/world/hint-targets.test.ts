import { describe, expect, it } from "vitest";
import type { HintTarget } from "../contracts/world";
import { hintTargetsFor } from "./hint-targets";
import type { StaticInput } from "./types";

const input = { view: null, config: {}, aidTier: 0, hintsUsed: 0, reducedMotion: false, skinId: "s", record: false } as StaticInput<unknown>;
const t = (anchor: string): HintTarget => ({ anchor, action: "circle", holdMs: 1500 });
const meta = { hintTargets: (rung: 1 | 2 | 3) => [t(`meta_${rung}`)] };

describe("hintTargetsFor precedence (A7)", () => {
  it("a station override wins for its rung", () => {
    const st = { hintTargets: [[t("a")], [t("b")], [t("c")]] as [HintTarget[], HintTarget[], HintTarget[]] };
    expect(hintTargetsFor(st, meta, 1, input)).toEqual([t("a")]);
    expect(hintTargetsFor(st, meta, 3, input)).toEqual([t("c")]);
  });
  it("falls back to the meta (which starts from the skin's table)", () => {
    expect(hintTargetsFor({ hintTargets: null }, meta, 2, input)).toEqual([t("meta_2")]);
  });
  it("an empty override is an override (the companion stays put)", () => {
    const st = { hintTargets: [[], [t("b")], [t("c")]] as [HintTarget[], HintTarget[], HintTarget[]] };
    expect(hintTargetsFor(st, meta, 1, input)).toEqual([]);
  });
});
