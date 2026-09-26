/**
 * The keying test (docs/design/20 §1.2, §8.1, amendment 40): fixtures/worlds/*.world.json is the only overlay
 * location, and every appliesTo entry resolves through loadWorldFor. wave2_smoke_001 shares (src_trig_ch4, dungeon)
 * with trig but not its encounter ids, so it is skipped with a server warning and plays on the legacy host.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { GameSpec } from "../src/contracts/gamespec";
import { WorldFile } from "../src/contracts/world";
import { loadWorldFor, readWorldFiles } from "../src/server/worlds";
import { validateWorld } from "../src/world/validate-world";

const load = (f: string) => GameSpec.parse(JSON.parse(readFileSync(path.join(process.cwd(), "fixtures", `${f}.json`), "utf8")));

function findDirs(root: string, name: string, out: string[] = []): string[] {
  for (const e of readdirSync(root, { withFileTypes: true })) {
    if (!e.isDirectory() || e.name === "node_modules" || e.name.startsWith(".")) continue;
    const p = path.join(root, e.name);
    if (e.name === name) out.push(p);
    findDirs(p, name, out);
  }
  return out;
}

describe("overlay location", () => {
  it("fixtures/worlds/*.world.json is the only overlay location", () => {
    expect(existsSync(path.join(process.cwd(), "src", "game", "worlds"))).toBe(false);
    expect(findDirs(path.join(process.cwd(), "src"), "worlds")).toEqual([]);
    const files = readdirSync(path.join(process.cwd(), "fixtures", "worlds")).filter((f) => f.endsWith(".world.json")).sort();
    expect(files).toEqual(["cell-transport.world.json", "civil-rights.world.json", "trig.world.json"]);
    for (const f of files) expect(WorldFile.safeParse(JSON.parse(readFileSync(path.join(process.cwd(), "fixtures", "worlds", f), "utf8"))).success).toBe(true);
  });
  it("readWorldFiles skips unparseable files with a warning and survives a missing directory", async () => {
    expect(await readWorldFiles(path.join(process.cwd(), "fixtures", "no-such-dir"))).toEqual([]);
    const warned: string[] = [];
    const files = await readWorldFiles(path.join(process.cwd(), "fixtures", "worlds"), (m) => warned.push(m));
    expect(files.map((f) => f.name)).toHaveLength(3);
    expect(warned).toEqual([]);
  });
});

describe("keying", () => {
  const cases = [
    ["trig-dungeon", "trig_demo_001", "trig.world.json"],
    ["trig-platformer", "trig_platformer_001", "trig.world.json"],
    ["cell-transport-dungeon", "cell_demo_001", "cell-transport.world.json"],
    ["civil-rights-mystery", "history_mystery_001", "civil-rights.world.json"],
    ["civil-rights-dungeon", "history_demo_001", "civil-rights.world.json"],
  ] as const;
  for (const [fixture, id, file] of cases) {
    it(`${id} resolves by id to ${file}`, async () => {
      const spec = load(fixture);
      expect(spec.id).toBe(id);
      const warned: string[] = [];
      const got = await loadWorldFor(spec, { warn: (m) => warned.push(m) });
      expect(got, warned.join("\n")).not.toBeNull();
      expect(got!.source).toBe("sidecar_id");
      expect(got!.file).toBe(file);
      expect(warned.filter((m) => m.includes("skipped"))).toEqual([]);
    });
  }

  it("a mock-generated trig spec (new id, same source and genre) resolves by source", async () => {
    const trig = load("trig-dungeon");
    const generated = GameSpec.parse({ ...trig, id: "game_mock_7f3a", seed: 12345, createdAt: "2026-09-27T09:00:00.000Z" });
    const got = await loadWorldFor(generated, { warn: () => {} });
    expect(got?.source).toBe("sidecar_source");
    expect(got?.file).toBe("trig.world.json");
  });

  it("wave2_smoke_001 shares (src_trig_ch4, dungeon) but is skipped with a server warning", async () => {
    const wave2 = load("wave2-dungeon");
    expect(wave2.source.sourceId).toBe("src_trig_ch4");
    expect(wave2.genre).toBe("dungeon");
    const warned: string[] = [];
    const got = await loadWorldFor(wave2, { warn: (m) => warned.push(m) });
    expect(got).toBeNull();
    expect(warned.some((m) => m.includes("trig.world.json") && m.includes("wave2_smoke_001"))).toBe(true);
    // the reason: its encounter ids differ (R4)
    const trigWorld = WorldFile.parse(JSON.parse(readFileSync(path.join(process.cwd(), "fixtures", "worlds", "trig.world.json"), "utf8"))).world;
    expect(validateWorld(wave2, trigWorld, { sidecar: true }).issues.some((i) => i.message.startsWith("R4:"))).toBe(true);
  });

  it("a spec with no side-car and no world plays on the legacy host", async () => {
    const trig = load("trig-dungeon");
    const other = GameSpec.parse({ ...trig, id: "elsewhere", source: { ...trig.source, sourceId: "src_other" } });
    expect(await loadWorldFor(other, { warn: () => {} })).toBeNull();
  });
});
