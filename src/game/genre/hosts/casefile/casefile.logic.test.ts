import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { GameSpec } from "../../../../contracts/gamespec";
import { buildProgression, unlockedIds, type Progression } from "../../../runner/progression";
import {
  buildCasefile,
  cluesLeftIn,
  combine,
  dossierFor,
  effectiveFound,
  goalOf,
  effectiveLeads,
  hotspotCount,
  looseClues,
  nameVariants,
  newlyRevealedLocation,
  objectiveAsNote,
  placeName,
  revealedClueIds,
  revealedEncounters,
  sanitizeEvidence,
  searchHotspot,
  type Casefile,
} from "./casefile.logic";

const FIXTURE_DIR = new URL("../../../../../fixtures/", import.meta.url);
const FIXTURES: GameSpec[] = readdirSync(FIXTURE_DIR)
  .filter((f) => f.endsWith(".json"))
  .map((f) => GameSpec.safeParse(JSON.parse(readFileSync(new URL(f, FIXTURE_DIR), "utf8"))))
  .filter((r) => r.success)
  .map((r) => r.data!);
const CASE = FIXTURES.find((s) => s.id === "cell_casefile_001") ?? FIXTURES.find((s) => s.title === "The Case of the Burst Cell")!;

function build(spec: GameSpec): { p: Progression; cf: Casefile } {
  const p = buildProgression(spec);
  return { p, cf: buildCasefile(spec, p) };
}

/** a spec with `n` encounters cloned from the showcase (the last one keeps role boss when `boss`) */
function sized(n: number, boss = true): GameSpec {
  const src = CASE.encounters;
  const encounters = Array.from({ length: n }, (_, i) => {
    const e = src[i % (src.length - 1)];
    return { ...e, id: `x${i + 1}`, role: boss && i === n - 1 ? ("boss" as const) : e.role === "boss" ? ("teach" as const) : e.role };
  });
  return { ...CASE, encounters, narrative: { ...CASE.narrative, beats: [] } };
}

const EDGE_SPECS = () => [sized(1), sized(1, false), sized(2), sized(5, false), sized(20), sized(20, false)];

/** Plays a whole case in spec-available order, searching everything and combining each encounter's own pair. */
function playThrough(spec: GameSpec) {
  const { p, cf } = build(spec);
  const solved = new Set<string>();
  const found = new Set<string>();
  const formed = new Set<string>();
  for (let guard = 0; guard < 100 && solved.size < spec.encounters.length; guard++) {
    const available = unlockedIds(p, solved);
    const revealed = revealedClueIds(cf, p, solved);
    // both clues of every available encounter are revealed, and searching every hotspot finds them
    for (const id of available) for (const c of cf.cluesOf.get(id) ?? []) expect(revealed.has(c), `${spec.id}: ${c} revealed when ${id} is available`).toBe(true);
    for (const loc of cf.locations) for (const h of loc.hotspots) for (const c of searchHotspot(cf, h.id, revealed, found)) found.add(c);
    const id = available[0];
    const pair = cf.cluesOf.get(id);
    if (pair) {
      expect(found.has(pair[0]) && found.has(pair[1])).toBe(true);
      const r = combine(cf, p, pair[0], pair[1], available, solved);
      expect(r).toEqual({ kind: "lead", encounterId: id });
      formed.add(id);
    }
    solved.add(id);
  }
  return { solved, found, formed, cf, p };
}

describe("casefile: building the case", () => {
  it("loads the showcase and the other fixtures", () => {
    expect(CASE).toBeDefined();
    expect(CASE.genre).toBe("mystery");
    expect(FIXTURES.length).toBeGreaterThanOrEqual(5);
  });

  it("is deterministic for a spec", () => {
    for (const spec of [...FIXTURES, ...EDGE_SPECS()]) {
      const a = build(spec).cf;
      const b = build(spec).cf;
      expect(a.locations).toEqual(b.locations);
      expect(a.clues).toEqual(b.clues);
      expect(a.edges).toEqual(b.edges);
      expect([...a.boardPos]).toEqual([...b.boardPos]);
    }
  });

  it("gives every non-boss encounter exactly two clues (a tag and an evidence) in its track's scene, in different props", () => {
    for (const spec of [...FIXTURES, ...EDGE_SPECS()]) {
      const { p, cf } = build(spec);
      const regular = spec.encounters.filter((e) => e.id !== p.bossId);
      expect(cf.clues).toHaveLength(regular.length * 2);
      for (const e of regular) {
        const mine = cf.clues.filter((c) => c.encounterId === e.id);
        expect(mine.map((c) => c.kind).sort()).toEqual(["evidence", "tag"]);
        const loc = cf.locations[cf.locationOf.get(e.id)!];
        expect(loc.kind).toBe("scene");
        expect(loc.track).toBe(p.byId.get(e.id)!.track);
        const hotIds = new Set(loc.hotspots.map((h) => h.id));
        for (const c of mine) expect(hotIds.has(c.hotspotId)).toBe(true);
        expect(mine[0].hotspotId).not.toBe(mine[1].hotspotId);
        for (const c of mine) expect(loc.hotspots.find((h) => h.id === c.hotspotId)!.clueIds).toContain(c.id);
      }
      if (p.bossId) expect(cf.clues.some((c) => c.encounterId === p.bossId)).toBe(false);
    }
  });

  it("writes readable clue text: never empty, no template husks, no 'undefined'", () => {
    for (const spec of [...FIXTURES, ...EDGE_SPECS()]) {
      const { cf } = build(spec);
      for (const c of cf.clues) {
        expect(c.text.trim().length, c.id).toBeGreaterThan(0);
        expect(c.label.trim().length).toBeGreaterThan(0);
        for (const s of [c.text, c.label, c.sub]) {
          expect(s).not.toContain("{{");
          expect(s).not.toContain("}}");
          expect(s).not.toMatch(/undefined/i);
        }
      }
    }
  });

  it("keeps the concept's own name out of its evidence", () => {
    for (const spec of FIXTURES) {
      const { cf } = build(spec);
      for (const c of cf.clues.filter((x) => x.kind === "evidence")) {
        const e = spec.encounters.find((x) => x.id === c.encounterId)!;
        for (const cid of e.conceptIds) {
          const name = spec.concepts.find((x) => x.id === cid)?.name;
          if (name) expect(c.text.toLowerCase(), `${c.id} names ${name}`).not.toContain(name.toLowerCase());
        }
      }
    }
  });

  it("gives each scene its own room style, and the showcase case different furniture where a slot has alternatives", () => {
    for (const spec of FIXTURES) {
      const scenes = build(spec).cf.locations.filter((l) => l.kind === "scene");
      // at most three scenes, and the styles cycle study → bench → archive, so no two rooms share a shell
      expect(new Set(scenes.map((s) => s.style)).size).toBe(scenes.length);
    }
    const scenes = build(CASE).cf.locations.filter((l) => l.kind === "scene");
    expect(scenes.map((s) => s.style)).toEqual(["study", "bench", "archive"].slice(0, scenes.length));
    // the rooms are named for what they show, with the track's concept as the topic
    expect(scenes.map((s) => s.title)).toEqual(["Office", "Lab bench", "Archive"].slice(0, scenes.length));
    for (const s of scenes) expect(s.topic.length).toBeGreaterThan(0);
    for (const slot of ["tallR", "deskL"] as const) {
      const kinds = scenes.map((s) => s.props.find((p) => p.slot === slot)!.kind);
      expect(new Set(kinds).size, `${slot}: ${kinds.join(",")}`).toBe(kinds.length);
    }
  });

  it("the dossier teaches every scene's concepts up front (primer, facts, pitfalls) and adds the proof once a lead is cracked", () => {
    expect(goalOf("The student can predict the direction of water movement.")).toBe("predict the direction of water movement");
    const { cf } = build(CASE);
    const before = dossierFor(CASE, cf, new Set());
    expect(before.length).toBe(cf.locations.filter((l) => l.kind === "scene").length);
    for (const s of before) {
      expect(s.entries.length).toBeGreaterThan(0);
      for (const en of s.entries) {
        expect(en.primer.length).toBeGreaterThan(20);
        expect(en.primer).not.toMatch(/^The student can/);
        expect(en.facts.length).toBeGreaterThanOrEqual(3);
        expect(en.pitfalls.length).toBeGreaterThan(0);
        expect(en.proved).toEqual([]);
        expect(en.solved).toBe(false);
      }
    }
    const first = cf.locations[0].encounterIds[0];
    const after = dossierFor(CASE, cf, new Set([first]));
    const enc = CASE.encounters.find((e) => e.id === first)!;
    const entry = after[0].entries.find((en) => en.conceptId === enc.conceptIds[0])!;
    expect(entry.proved).toEqual([enc.debriefLine]);
    expect(entry.solved).toBe(true);
  });

  it("builds 1–3 scenes of 4–8 hotspots, plus the accusation room when there is a boss", () => {
    for (const spec of [...FIXTURES, ...EDGE_SPECS()]) {
      const { p, cf } = build(spec);
      const scenes = cf.locations.filter((l) => l.kind === "scene");
      expect(scenes.length).toBeGreaterThanOrEqual(1);
      expect(scenes.length).toBeLessThanOrEqual(3);
      for (const s of scenes) {
        expect(s.hotspots.length).toBeGreaterThanOrEqual(4);
        expect(s.hotspots.length).toBeLessThanOrEqual(8);
        expect(s.hotspots.some((h) => h.slot === "desk")).toBe(true);
        expect(s.name).not.toMatch(/undefined|\{\{/);
        expect(new Set(s.props.map((x) => x.kind)).size).toBe(s.props.length);
      }
      expect(new Set(scenes.map((s) => s.title)).size).toBe(scenes.length);
      if (p.bossId) {
        expect(cf.accusationIndex).toBe(cf.locations.length - 1);
        expect(cf.locations[cf.accusationIndex].kind).toBe("accusation");
        expect(cf.locationOf.get(p.bossId)).toBe(cf.accusationIndex);
      } else {
        expect(cf.accusationIndex).toBe(-1);
      }
    }
  });

  it("names the partner and the suspect from the cast", () => {
    const { cf } = build(CASE);
    expect(cf.partnerId).toBe(CASE.characters[0].id);
    expect(cf.suspectId).toBe("gatekeeper");
    const solo = { ...CASE, characters: [CASE.characters[0]] };
    expect(build(solo).cf.suspectId).toBeNull();
  });

  it("names the showcase's places from the theme", () => {
    const { cf } = build(CASE);
    expect(cf.place).toBe("The Hospital Lab");
    expect(cf.locations[0].name.startsWith("The Hospital Lab — ")).toBe(true);
  });
});

describe("casefile: reveal, search and combine", () => {
  it("plays every fixture and edge spec to the end by searching and combining", () => {
    for (const spec of [...FIXTURES, ...EDGE_SPECS()]) {
      const { solved, cf } = playThrough(spec);
      expect(solved.size, spec.id).toBe(spec.encounters.length);
      expect(cf.clues.every((c) => c.text.length > 0)).toBe(true);
    }
  });

  it("reveals only available or one-away encounters at the start, and more as leads are cracked", () => {
    const { p, cf } = build(CASE);
    const start = revealedEncounters(cf, p, new Set());
    const available = unlockedIds(p, new Set());
    for (const id of available) if (id !== p.bossId) expect(start.has(id)).toBe(true);
    for (const id of start) expect(p.byId.get(id)!.requires.length).toBeLessThanOrEqual(1);
    // the three track heads and the step after each: six of the ten leads to start with
    expect([...start].sort()).toEqual(["e1_bilayer", "e2_selectivity", "e3_diffusion", "e4_osmosis", "e7_active", "e8_pump"]);
    const before = revealedClueIds(cf, p, new Set());
    const after = revealedClueIds(cf, p, new Set([available[0]]));
    expect(after.size).toBeGreaterThanOrEqual(before.size);
    for (const c of before) expect(after.has(c)).toBe(true);
  });

  it("reports where newly revealed clues landed", () => {
    const { p, cf } = build(CASE);
    const solved = new Set<string>(["e3_diffusion"]);
    const before = revealedClueIds(cf, p, new Set());
    const after = revealedClueIds(cf, p, solved);
    expect(before.has("e5_tonicity__tag")).toBe(false);
    expect(after.has("e5_tonicity__tag")).toBe(true);
    const loc = newlyRevealedLocation(cf, before, after);
    expect(loc).toBe(cf.locationOf.get("e5_tonicity"));
    expect(newlyRevealedLocation(cf, after, after)).toBe(-1);
  });

  it("searching finds only revealed, unfound clues in that prop", () => {
    const { p, cf } = build(CASE);
    const revealed = revealedClueIds(cf, p, new Set());
    const found = new Set<string>();
    for (const loc of cf.locations)
      for (const h of loc.hotspots) {
        const got = searchHotspot(cf, h.id, revealed, found);
        for (const c of got) {
          expect(revealed.has(c)).toBe(true);
          expect(h.clueIds).toContain(c);
          found.add(c);
        }
        expect(searchHotspot(cf, h.id, revealed, found)).toEqual([]);
      }
    expect(found).toEqual(revealed);
    for (const loc of cf.locations) expect(cluesLeftIn(cf, loc.index, revealed, found)).toBe(0);
    expect(searchHotspot(cf, "nope", revealed, found)).toEqual([]);
  });

  it("combines: own pair → lead; locked → blocked with the missing requirement; other encounters → mismatch", () => {
    const { p, cf } = build(CASE);
    const solved = new Set<string>();
    const available = unlockedIds(p, solved);
    const [t1, e1] = cf.cluesOf.get("e1_bilayer")!;
    expect(combine(cf, p, t1, e1, available, solved)).toEqual({ kind: "lead", encounterId: "e1_bilayer" });
    expect(combine(cf, p, e1, t1, available, solved)).toEqual({ kind: "lead", encounterId: "e1_bilayer" });
    const [t2, e2] = cf.cluesOf.get("e2_selectivity")!;
    expect(combine(cf, p, t2, e2, available, solved)).toEqual({ kind: "blocked", encounterId: "e2_selectivity", missing: ["e1_bilayer"] });
    expect(combine(cf, p, t1, e2, available, solved)).toEqual({ kind: "mismatch" });
    expect(combine(cf, p, t1, t2, available, solved)).toEqual({ kind: "same_kind", clueKind: "tag" });
    expect(combine(cf, p, e1, e2, available, solved)).toEqual({ kind: "same_kind", clueKind: "evidence" });
    expect(combine(cf, p, t1, t1, available, solved)).toEqual({ kind: "same" });
    solved.add("e1_bilayer");
    expect(combine(cf, p, t1, e1, unlockedIds(p, solved), solved)).toEqual({ kind: "solved", encounterId: "e1_bilayer" });
  });

  it("treats tags for the same concept as interchangeable (osmosis teach and review)", () => {
    const { p, cf } = build(CASE);
    const [osmosisTag] = cf.cluesOf.get("e4_osmosis")!;
    const [, reviewEvidence] = cf.cluesOf.get("e9_osmosis_review")!;
    const solved = new Set(CASE.encounters.filter((e) => !["e9_osmosis_review", "e11_boss"].includes(e.id)).map((e) => e.id));
    expect(combine(cf, p, osmosisTag, reviewEvidence, unlockedIds(p, solved), solved)).toEqual({ kind: "lead", encounterId: "e9_osmosis_review" });
  });

  it("derives found clues and leads from solved and open encounters (debug paths)", () => {
    const { cf } = build(CASE);
    const found = effectiveFound(cf, new Set(), new Set(["e1_bilayer"]), "e3_diffusion");
    for (const c of [...cf.cluesOf.get("e1_bilayer")!, ...cf.cluesOf.get("e3_diffusion")!]) expect(found.has(c)).toBe(true);
    const leads = effectiveLeads(new Set(["e7_active"]), new Set(["e1_bilayer"]), "e3_diffusion");
    expect([...leads].sort()).toEqual(["e1_bilayer", "e3_diffusion", "e7_active"]);
    expect(looseClues(cf, found, leads)).toEqual([]);
    const loose = looseClues(cf, new Set(cf.cluesOf.get("e2_selectivity")!), new Set());
    expect(loose.map((c) => c.encounterId)).toEqual(["e2_selectivity", "e2_selectivity"]);
  });
});

describe("casefile: case board", () => {
  it("strings every non-boss requirement, and ties each track's tail to the boss", () => {
    for (const spec of [...FIXTURES, ...EDGE_SPECS()]) {
      const { p, cf } = build(spec);
      for (const n of p.nodes) {
        if (n.isBoss) continue;
        for (const r of n.requires) expect(cf.edges).toContainEqual({ from: r, to: n.id });
      }
      if (p.bossId && p.nodes.length > 1) expect(cf.edges.some((e) => e.to === p.bossId)).toBe(true);
      for (const e of cf.edges) {
        expect(cf.boardPos.has(e.from)).toBe(true);
        expect(cf.boardPos.has(e.to)).toBe(true);
      }
      expect(cf.boardPos.size).toBe(spec.encounters.length);
      for (const pos of cf.boardPos.values()) {
        expect(pos.x).toBeGreaterThan(0);
        expect(pos.x).toBeLessThan(1);
        expect(pos.y).toBeGreaterThan(0);
        expect(pos.y).toBeLessThan(1);
      }
    }
  });
});

describe("casefile: text helpers", () => {
  it("blanks concept names case-insensitively and falls back when nothing is left", () => {
    expect(sanitizeEvidence("Facilitated diffusion uses channel or carrier proteins.", ["Facilitated diffusion"])).toBe("… uses channel or carrier proteins.");
    expect(sanitizeEvidence("Each cycle of the sodium-potassium pump moves three ions.", ["The sodium-potassium pump"])).toBe("Each cycle of … moves three ions.");
    expect(sanitizeEvidence("Osmosis.", ["Osmosis"])).toBeNull();
    expect(sanitizeEvidence("{{answer}} {{x}}", [])).toBeNull();
    expect(nameVariants("Tonicity: hypotonic, isotonic, hypertonic")).toContain("Tonicity");
    expect(sanitizeEvidence("Tonicity decides whether a cell swells or shrinks in a solution.", ["Tonicity: hypotonic, isotonic, hypertonic"])).toBe("… decides whether a cell swells or shrinks in a solution.");
  });

  it("turns learning objectives into notes and settings into places", () => {
    expect(objectiveAsNote("The student can explain diffusion.")).toBe("Explain diffusion.");
    expect(placeName("A hospital lab at night: a ruptured red blood cell")).toBe("The Hospital Lab");
    expect(placeName("A rain-soaked newspaper morgue where a retired editor's last case file waits")).toBe("The Newspaper Morgue");
    expect(placeName("")).toBe("The Scene");
    expect(hotspotCount(0)).toBe(4);
    expect(hotspotCount(40)).toBe(8);
  });

  it("uses the objective, then the prompt, when the quote is only the concept name", () => {
    const spec: GameSpec = {
      ...CASE,
      encounters: CASE.encounters.map((e) => (e.id === "e3_diffusion" ? { ...e, sourceRef: { page: 2, quote: "Diffusion" } } : e)),
    };
    const { cf } = build(spec);
    const ev = cf.clueById.get("e3_diffusion__ev")!;
    expect(ev.label).toBe("Scribbled note");
    expect(ev.text.toLowerCase()).not.toContain("diffusion");
    expect(ev.text.length).toBeGreaterThan(10);
  });
});
