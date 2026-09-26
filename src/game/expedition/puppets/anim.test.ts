/**
 * src/game/expedition/puppets/anim.test.ts — pure puppet animation sampling (docs/design/20 §5.5, PuppetAnim).
 */
import { describe, expect, it } from "vitest";
import type { PuppetAnim } from "../../../contracts/world";
import { animDone, animTime, keyValue, ONE_PART, proceduralAnims, REST_STATE, sampleAnim } from "./anim";

const parts = [
  { name: "body", frames: 1 },
  { name: "prop", frames: 2 },
  { name: "flame", frames: 3 },
];

describe("sampleAnim", () => {
  it("waves add amp·sin(2π(hz·t + phase)) to the rest value", () => {
    const a: PuppetAnim = { id: "idle", loop: true, ms: 1000, tracks: [{ part: "body", prop: "y", wave: { amp: 4, hz: 1, phase: 0 }, keys: [] }] };
    expect(sampleAnim(a, 0, parts).body.y).toBeCloseTo(0, 9);
    expect(sampleAnim(a, 250, parts).body.y).toBeCloseTo(4, 9);
    expect(sampleAnim(a, 750, parts).body.y).toBeCloseTo(-4, 9);
    expect(sampleAnim(a, 1250, parts).body.y).toBeCloseTo(4, 9); // loops
    expect(sampleAnim(a, 250, parts).prop).toEqual(REST_STATE);
  });
  it("keys interpolate linearly and hold outside their range; waves stack on keys", () => {
    const a: PuppetAnim = {
      id: "cue",
      loop: false,
      ms: 600,
      tracks: [
        { part: "body", prop: "alpha", wave: null, keys: [[100, 0.2], [300, 1]] },
        { part: "body", prop: "scaleX", wave: null, keys: [[0, 1], [300, 1.4]] },
        { part: "body", prop: "scaleX", wave: { amp: 0.1, hz: 0, phase: 0.25 }, keys: [] },
      ],
    };
    expect(sampleAnim(a, 0, parts).body.alpha).toBeCloseTo(0.2, 9);
    expect(sampleAnim(a, 200, parts).body.alpha).toBeCloseTo(0.6, 9);
    expect(sampleAnim(a, 900, parts).body.alpha).toBe(1);
    expect(sampleAnim(a, 150, parts).body.scaleX).toBeCloseTo(1.3, 9);
    expect(animDone(a, 599)).toBe(false);
    expect(animDone(a, 600)).toBe(true);
    expect(animTime(a, 5000)).toBe(600);
  });
  it("frame keys step, frame waves cycle the part's frames, and frames clamp to the part", () => {
    const a: PuppetAnim = {
      id: "talk",
      loop: true,
      ms: 1000,
      tracks: [
        { part: "prop", prop: "frame", wave: null, keys: [[0, 0], [500, 1]] },
        { part: "flame", prop: "frame", wave: { amp: 0, hz: 1, phase: 0 }, keys: [] },
        { part: "body", prop: "frame", wave: null, keys: [[0, 5]] },
      ],
    };
    expect(sampleAnim(a, 499, parts).prop.frame).toBe(0);
    expect(sampleAnim(a, 500, parts).prop.frame).toBe(1);
    expect([0, 340, 680].map((t) => sampleAnim(a, t, parts).flame.frame)).toEqual([0, 1, 2]);
    expect(sampleAnim(a, 0, parts).body.frame).toBe(0);
  });
  it("clamps alpha to [0, 1] and ignores unknown parts", () => {
    const a: PuppetAnim = { id: "x", loop: true, ms: 100, tracks: [{ part: "body", prop: "alpha", wave: { amp: 3, hz: 2.5, phase: 0 }, keys: [] }, { part: "ghost", prop: "x", wave: null, keys: [[0, 9]] }] };
    const s = sampleAnim(a, 100, parts);
    expect(s.body.alpha).toBeLessThanOrEqual(1);
    expect(s.body.alpha).toBeGreaterThanOrEqual(0);
    expect(Object.keys(s)).toEqual(["body", "prop", "flame"]);
  });
  it("keyValue handles unsorted keys and empty tracks", () => {
    expect(keyValue([[200, 2], [0, 0]], 100)).toBeCloseTo(1, 9);
    expect(keyValue([], 5)).toBeNull();
  });
  it("gives svg entries procedural idle / talk / cue on the one part", () => {
    const anims = proceduralAnims(4);
    expect(anims.map((a) => a.id)).toEqual(["idle", "talk", "cue"]);
    const one = [{ name: ONE_PART, frames: 1 }];
    expect(Math.abs(sampleAnim(anims[0], 312, one)[ONE_PART].y)).toBeGreaterThan(3.5);
    expect(sampleAnim(anims[1], 250, one)[ONE_PART].scaleX).toBeCloseTo(1.05, 9);
    expect(sampleAnim(anims[2], 300, one)[ONE_PART].scaleY).toBeCloseTo(1.12, 9);
  });
});
