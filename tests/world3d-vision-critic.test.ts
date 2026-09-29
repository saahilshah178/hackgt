import { MockLanguageModelV4 } from "ai/test";
import { describe, expect, it } from "vitest";
import { CriticReport } from "../src/contracts/world3d";
import {
  buildVisionMessages,
  mockVisionSlice,
  runVisionCritic,
  toVisionReport,
  toVisionVerdict,
  VISION_CRITERIA,
  VISION_CRITIC_SYSTEM,
  visionCriticSchema,
  visionMarkdown,
  type VisionSlice,
} from "../src/pipeline/world3d/vision-critic";

/*
 * The Vision Critic's pure half (src/pipeline/world3d/vision-critic.ts): the rubric, message building, the code-decided
 * verdict, the CriticReport conversion and the markdown. The model call runs against a MockLanguageModelV4 (no API).
 */

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
const shots = [
  { id: "flyover", label: "The opening flyover", png: PNG },
  { id: "explore", label: "Explore at the spawn", png: new Uint8Array(PNG) },
  { id: "map", label: "The full map", png: PNG },
];

function slice(scores: number[], over: Partial<VisionSlice> = {}): VisionSlice {
  return {
    scores: Object.fromEntries(VISION_CRITERIA.map((c, i) => [c, { score: scores[i] ?? 4, note: `note ${c}` }])) as VisionSlice["scores"],
    observations: shots.map((s) => ({ shot: s.id, note: `saw ${s.id}` })),
    issues: [{ shot: "explore", problem: "The quest tracker overlaps the minimap.", fix: "Move the tracker up 40px." }],
    pass: true,
    ...over,
  };
}

describe("vision critic schema and prompt", () => {
  it("names every criterion in the rubric and starts as the Vision Critic", () => {
    expect(VISION_CRITIC_SYSTEM.startsWith("You are the Vision Critic")).toBe(true);
    for (const c of VISION_CRITERIA) expect(VISION_CRITIC_SYSTEM).toContain(`- ${c}:`);
  });

  it("accepts a well-formed verdict and rejects a score out of range or a fractional one", () => {
    const schema = visionCriticSchema();
    expect(schema.safeParse(slice([])).success).toBe(true);
    expect(schema.safeParse(slice([6])).success).toBe(false);
    expect(schema.safeParse(slice([3.5])).success).toBe(false);
    expect(schema.safeParse(slice([], { issues: Array.from({ length: 16 }, () => ({ shot: "all", problem: "p", fix: "f" })) })).success).toBe(false);
  });
});

describe("buildVisionMessages", () => {
  it("makes one user message with one image part per shot plus the rubric-facing text", () => {
    const messages = buildVisionMessages(shots, "Game page: http://x/play/y");
    expect(messages).toHaveLength(1);
    expect(messages[0].role).toBe("user");
    const parts = messages[0].content as { type: string; text?: string; mediaType?: string; data?: { type: string; data: Uint8Array } }[];
    const images = parts.filter((p) => p.type === "file");
    expect(images).toHaveLength(shots.length);
    for (const img of images) {
      expect(img.mediaType).toBe("image/png");
      expect(img.data?.type).toBe("data");
      expect(img.data?.data).toBeInstanceOf(Uint8Array);
      expect(Array.from(img.data!.data)).toEqual(Array.from(PNG));
    }
    const text = parts.filter((p) => p.type === "text").map((p) => p.text).join("\n");
    expect(text).toContain("Game page: http://x/play/y");
    for (const s of shots) expect(text).toContain(`Screenshot "${s.id}": ${s.label}`);
    expect(text).toContain("3 screenshots");
  });
});

describe("verdict and report", () => {
  it("passes when every score is at least 3 and the mean is at least 3.6", () => {
    expect(toVisionVerdict(slice([4, 4, 4, 4, 4, 4, 4, 4])).pass).toBe(true);
    expect(toVisionVerdict(slice([5, 5, 5, 5, 5, 5, 5, 2])).pass).toBe(false); // one score under 3
    expect(toVisionVerdict(slice([3, 3, 3, 3, 3, 3, 3, 3])).pass).toBe(false); // mean 3.0 < 3.6
  });

  it("decides the pass in code, not by the model's own pass flag", () => {
    const v = toVisionVerdict(slice([2, 2, 2, 2, 2, 2, 2, 2], { pass: true }));
    expect(v.modelPass).toBe(true);
    expect(v.pass).toBe(false);
  });

  it("converts to a valid CriticReport with critic 'vision'", () => {
    const v = toVisionVerdict(slice([4, 3, 5, 4, 4, 3, 4, 4]));
    const report = toVisionReport(v, "gpt-x");
    expect(CriticReport.safeParse(report).success).toBe(true);
    expect(report).toMatchObject({ critic: "vision", model: "gpt-x", pass: true, rounds: 0 });
    expect(report.scores.map((s) => s.criterion)).toEqual([...VISION_CRITERIA]);
    expect(report.issues).toEqual(["explore: The quest tracker overlaps the minimap. Fix: Move the tracker up 40px."]);
  });

  it("writes markdown with every criterion, every shot, the issues and the console errors", () => {
    const v = toVisionVerdict(slice([4, 4, 4, 4, 4, 4, 4, 4]));
    const md = visionMarkdown(v, {
      url: "http://localhost:3450/play/x",
      model: "gpt-x",
      mock: false,
      when: "2026-09-29T00:00:00Z",
      shots: shots.map((s, i) => ({ id: s.id, label: s.label, file: `0${i + 1}-${s.id}.png` })),
      consoleErrors: ["Uncaught TypeError: boom"],
    });
    for (const c of VISION_CRITERIA) expect(md).toContain(c);
    for (const s of shots) expect(md).toContain(`![${s.id}]`);
    expect(md).toContain("PASS");
    expect(md).toContain("The quest tracker overlaps the minimap.");
    expect(md).toContain("Uncaught TypeError: boom");
    expect(md).not.toContain("MOCK");
  });

  it("labels a mock run clearly", () => {
    const v = toVisionVerdict(mockVisionSlice(["a"]));
    const md = visionMarkdown(v, { url: "u", model: "mock-vision", mock: true, when: "now", shots: [{ id: "a", label: "A", file: "01-a.png" }], consoleErrors: [] });
    expect(md).toContain("MOCK");
    expect(md).toContain("mock-vision (mock)");
  });
});

describe("runVisionCritic with a mock model", () => {
  it("sends the images and the rubric and parses the structured verdict", async () => {
    let seen: { system: string; images: number } | null = null;
    const model = new MockLanguageModelV4({
      modelId: "mock-vision",
      doGenerate: async (options) => {
        const system = options.prompt.filter((m) => m.role === "system").map((m) => m.content as string).join("\n");
        const images = options.prompt.filter((m) => m.role === "user").flatMap((m) => m.content as { type: string }[]).filter((p) => p.type === "file").length;
        seen = { system, images };
        return {
          content: [{ type: "text" as const, text: JSON.stringify(mockVisionSlice(shots.map((s) => s.id))) }],
          finishReason: { unified: "stop" as const, raw: "stop" },
          usage: { inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 1, text: 1, reasoning: 0 } },
          warnings: [],
        };
      },
    });
    const out = await runVisionCritic(model, shots);
    expect(seen).toEqual({ system: VISION_CRITIC_SYSTEM, images: 3 });
    expect(toVisionVerdict(out).pass).toBe(true);
  });
});
