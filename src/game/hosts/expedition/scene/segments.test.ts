import { describe, expect, it } from "vitest";
import {
  crossfadeWeights, hexToInt, interiorAt, layerSetWeights, mixColor, resolveSegmentLook, segmentAt, skyColorAt,
  stepFacadeAlpha, CROSSFADE_WIDTH, FACADE_INSIDE_ALPHA,
} from "./segments";
import { TEST_ZONE } from "./test-zone";

describe("segments", () => {
  it("finds the segment at x (clamped at the ends)", () => {
    expect(segmentAt(TEST_ZONE, 10).id).toBe("s_day");
    expect(segmentAt(TEST_ZONE, 2000).id).toBe("s_dusk");
    expect(segmentAt(TEST_ZONE, 9999).id).toBe("s_dusk");
    expect(segmentAt(TEST_ZONE, -5).id).toBe("s_day");
  });

  it("crossfades linearly across the boundary and weights sum to 1", () => {
    expect([...crossfadeWeights(TEST_ZONE, 500)]).toEqual([["s_day", 1]]);
    const at = crossfadeWeights(TEST_ZONE, 2000);
    expect(at.get("s_dusk")).toBeCloseTo(0.5);
    expect(at.get("s_day")).toBeCloseTo(0.5);
    const before = crossfadeWeights(TEST_ZONE, 2000 - CROSSFADE_WIDTH / 4);
    expect(before.get("s_day")).toBeCloseTo(0.75);
    expect(before.get("s_dusk")).toBeCloseTo(0.25);
    const after = crossfadeWeights(TEST_ZONE, 2000 + CROSSFADE_WIDTH / 4);
    expect(after.get("s_dusk")).toBeCloseTo(0.75);
    for (const x of [1800, 1900, 1990, 2010, 2100, 2200]) {
      const s = [...crossfadeWeights(TEST_ZONE, x).values()].reduce((a, b) => a + b, 0);
      expect(s).toBeCloseTo(1);
    }
    const ls = layerSetWeights(TEST_ZONE, 2000);
    expect(ls.get("day")).toBeCloseTo(0.5);
    expect(ls.get("dusk")).toBeCloseTo(0.5);
    expect(layerSetWeights(TEST_ZONE, 100).get("dusk")).toBe(0);
  });

  it("variants override the look only when their requirement holds", () => {
    const dusk = TEST_ZONE.segments[1];
    expect(resolveSegmentLook(dusk, () => false)).toMatchObject({ weather: "clear", music: null });
    const look = resolveSegmentLook(dusk, () => true);
    expect(look.weather).toBe("rain_light");
    expect(look.music).toBe("calm");
    expect(look.sky).toBe(dusk.sky);
  });

  it("interiors fade the façade to 20 % over 300 ms", () => {
    expect(interiorAt(TEST_ZONE, 2700)?.id).toBe("hall");
    expect(interiorAt(TEST_ZONE, 100)).toBeNull();
    let a = 1;
    for (let t = 0; t < 300; t += 16) a = stepFacadeAlpha(a, true, 16);
    expect(a).toBeCloseTo(FACADE_INSIDE_ALPHA, 1);
    expect(stepFacadeAlpha(a, true, 1000)).toBe(FACADE_INSIDE_ALPHA);
    expect(stepFacadeAlpha(0.2, false, 1000)).toBe(1);
    expect(stepFacadeAlpha(0.2, false, 150)).toBeCloseTo(0.6);
  });

  it("colour helpers", () => {
    expect(hexToInt("#FF8000")).toBe(0xff8000);
    expect(hexToInt("nope")).toBe(0);
    expect(mixColor(0x000000, 0xffffff, 0.5)).toBe(0x808080);
    const sky = TEST_ZONE.segments[0].sky;
    expect(skyColorAt(sky, 0)).toBe(0xd8d4cf);
    expect(skyColorAt(sky, 1)).toBe(0xf4e7da);
    expect(skyColorAt(sky, 2)).toBe(0xf4e7da);
    expect(skyColorAt(sky, 0.25)).toBe(mixColor(0xd8d4cf, 0xe8dcd2, 0.5));
  });
});
