import { describe, expect, it } from "vitest";
import { expeditionSfxOn } from "../../../server/env";
import { sfxEnabled } from "../audio/bus";

describe("EXPEDITION_SFX → the client's sfx prop (§2.12)", () => {
  it("is on unless the variable says off", () => {
    expect(expeditionSfxOn({})).toBe(true);
    expect(expeditionSfxOn({ EXPEDITION_SFX: "on" })).toBe(true);
    expect(expeditionSfxOn({ EXPEDITION_SFX: "" })).toBe(true);
    expect(expeditionSfxOn({ EXPEDITION_SFX: "off" })).toBe(false);
    expect(expeditionSfxOn({ EXPEDITION_SFX: "banana" })).toBe(true);
  });
  it("the bus stays silent when the prop is off or the URL says ?mute=1", () => {
    expect(sfxEnabled(expeditionSfxOn({ EXPEDITION_SFX: "off" }), "")).toBe(false);
    expect(sfxEnabled(expeditionSfxOn({}), "?mute=1")).toBe(false);
    expect(sfxEnabled(expeditionSfxOn({}), "?express=1")).toBe(true);
  });
});
