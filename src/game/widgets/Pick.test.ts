import { describe, expect, it } from "vitest";
import { chestsToInput, isOptionsView, isWavesView, optionsToInput, wavesToInput } from "./Pick";

describe("Pick.chestsToInput / optionsToInput", () => {
  it("wraps the picked chest index", () => {
    expect(chestsToInput(2)).toEqual({ statementIndex: 2 });
  });
  it("wraps the picked option index", () => {
    expect(optionsToInput(1)).toEqual({ optionIndex: 1 });
  });
});

describe("Pick.wavesToInput", () => {
  it("passes through the per-wave answers gathered so far, timeouts simply absent", () => {
    const answers = [
      { waveIndex: 0, categoryId: "hypotonic" },
      { waveIndex: 2, categoryId: "isotonic" },
    ];
    expect(wavesToInput(answers)).toEqual({ answers });
  });
});

describe("Pick view-shape detection", () => {
  it("distinguishes chests, waves, and options views", () => {
    const chests = { chests: [] };
    const waves = { categories: [], waves: [], secondsPerWave: 5 };
    const options = { scenario: "", options: [] };
    expect(isWavesView(chests)).toBe(false);
    expect(isWavesView(waves)).toBe(true);
    expect(isOptionsView(options)).toBe(true);
    expect(isOptionsView(chests)).toBe(false);
  });
});
