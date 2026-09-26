import type { Issue, Owner } from "../../contracts/common";
import { GameSpec } from "../../contracts/gamespec";
import { BOSS_SOCKET, chunkById } from "../../library/genres";
import { getMechanic } from "../../mechanics/registry";

/*
 * Run this (1) at the end of generation, before saving, and (2) whenever /play loads a spec.
 * Layers, cheapest first:
 *   1. structural   - zod parse of the stored schema
 *   2. referential  - every id points at something real; layout places each encounter exactly once
 *   3. semantic     - params valid for their mechanic, mechanic.check() passes, stored solution == resolve(params)
 *   4. self-solve   - grade(solutionInput(...)) is correct, i.e. every encounter is winnable
 * Every issue carries a path and the owning agent, so the pipeline can route repairs.
 */

export type ValidationResult =
  | { ok: true; spec: GameSpec; warnings: Issue[] }
  | { ok: false; issues: Issue[]; warnings: Issue[] };

const DIRECTOR_FIELDS = new Set(["id", "conceptIds", "mechanicId", "socket", "role", "difficulty"]);

export function ownerFor(path: readonly (string | number)[]): Owner {
  const [head, , field] = path;
  switch (head) {
    case "encounters":
      if (field === "solution") return "code";
      return DIRECTOR_FIELDS.has(String(field)) ? "director" : "challenge_writer";
    case "narrative":
      return "narrative";
    case "assessment":
      return "assessment";
    case "title":
    case "theme":
    case "premise":
    case "characters":
      return "director";
    default:
      return "code"; // ids, seed, source, concepts, layout, audio: produced by code
  }
}

export function validateGameSpec(input: unknown): ValidationResult {
  const warnings: Issue[] = [];

  // 1. structural
  const parsed = GameSpec.safeParse(input);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => {
      const path = i.path.map((p) => (typeof p === "symbol" ? String(p) : p));
      return { path, message: i.message, owner: ownerFor(path) };
    });
    return { ok: false, issues, warnings };
  }
  const spec = parsed.data;
  const issues: Issue[] = [];
  const add = (path: (string | number)[], message: string, encounterId?: string) =>
    issues.push({ path, message, owner: ownerFor(path), ...(encounterId ? { encounterId } : {}) });
  const warn = (path: (string | number)[], message: string) => warnings.push({ path, message, owner: ownerFor(path) });

  // 2. referential
  const conceptIds = new Set(spec.concepts.map((c) => c.id));
  const characterIds = new Set(spec.characters.map((c) => c.id));
  if (characterIds.size !== spec.characters.length) add(["characters"], "character ids must be unique");
  const encounterIndex = new Map<string, number>();
  spec.encounters.forEach((e, i) => {
    if (encounterIndex.has(e.id)) add(["encounters", i, "id"], `duplicate encounter id "${e.id}"`, e.id);
    encounterIndex.set(e.id, i);
  });

  spec.encounters.forEach((e, i) => {
    e.conceptIds.forEach((c, j) => {
      if (!conceptIds.has(c)) add(["encounters", i, "conceptIds", j], `unknown concept "${c}"`, e.id);
    });
    const m = getMechanic(e.mechanicId);
    if (!m) return add(["encounters", i, "mechanicId"], `unknown mechanic "${e.mechanicId}"`, e.id);
    if (!m.implemented) return add(["encounters", i, "mechanicId"], `mechanic "${m.id}" is not implemented yet`, e.id);
    const skin = m.genres[spec.genre];
    if (!skin) return add(["encounters", i, "mechanicId"], `"${m.id}" has no ${spec.genre} skin`, e.id);
    if (!skin.sockets.includes(e.socket)) {
      add(["encounters", i, "socket"], `"${m.id}" can't mount on "${e.socket}" in ${spec.genre}; use ${skin.sockets.join(" or ")}`, e.id);
    }
    const last = i === spec.encounters.length - 1;
    if ((e.role === "boss") !== last) add(["encounters", i, "role"], "exactly the last encounter must be the boss", e.id);
    if (e.role === "boss" && e.socket !== BOSS_SOCKET[spec.genre]) {
      add(["encounters", i, "socket"], `the boss must use socket "${BOSS_SOCKET[spec.genre]}"`, e.id);
    }
  });

  // layout: prefab chunks, each encounter placed exactly once in a chunk that provides its socket
  const placements = new Map<string, number>();
  spec.layout.chunks.forEach((c, i) => {
    const def = chunkById(spec.genre, c.chunkId);
    if (!def) return add(["layout", "chunks", i, "chunkId"], `unknown ${spec.genre} chunk "${c.chunkId}"`);
    if (i === 0 && def.kind !== "start") add(["layout", "chunks", 0], "the first chunk must be a start chunk");
    if (c.encounterId === null) {
      if (def.socket !== null) warn(["layout", "chunks", i], `chunk "${def.id}" has an empty ${def.socket} socket`);
      return;
    }
    const idx = encounterIndex.get(c.encounterId);
    if (idx === undefined) return add(["layout", "chunks", i, "encounterId"], `unknown encounter "${c.encounterId}"`);
    const e = spec.encounters[idx];
    if (def.socket !== e.socket) {
      add(["layout", "chunks", i], `chunk "${def.id}" provides "${def.socket}" but ${e.id} needs "${e.socket}"`);
    }
    placements.set(e.id, (placements.get(e.id) ?? 0) + 1);
  });
  spec.encounters.forEach((e) => {
    const n = placements.get(e.id) ?? 0;
    if (n !== 1) add(["layout"], `encounter "${e.id}" is placed ${n} times; place it exactly once`);
  });

  // narrative + assessment references
  const lines = [
    ...spec.narrative.intro.map((l, i) => ({ l, path: ["narrative", "intro", i] })),
    ...spec.narrative.outro.map((l, i) => ({ l, path: ["narrative", "outro", i] })),
    ...spec.narrative.beats.map((l, i) => ({ l, path: ["narrative", "beats", i] })),
  ];
  lines.forEach(({ l, path }) => {
    if (!characterIds.has(l.speakerId)) add([...path, "speakerId"], `unknown speaker "${l.speakerId}"`);
  });
  spec.narrative.beats.forEach((b, i) => {
    if (!encounterIndex.has(b.encounterId)) add(["narrative", "beats", i, "encounterId"], `unknown encounter "${b.encounterId}"`);
  });
  (["pre", "post"] as const).forEach((set) =>
    spec.assessment[set].forEach((q, i) => {
      if (!conceptIds.has(q.conceptId)) add(["assessment", set, i, "conceptId"], `unknown concept "${q.conceptId}"`);
      if (new Set(q.choices).size !== q.choices.length) add(["assessment", set, i, "choices"], "choices must be distinct");
    }),
  );

  // 3 + 4. mechanic semantics and self-solve
  spec.encounters.forEach((e, i) => {
    const m = getMechanic(e.mechanicId);
    if (!m) return;
    const p = m.paramsSchema.safeParse(e.params);
    if (!p.success) {
      p.error.issues.forEach((iss) =>
        add(["encounters", i, "params", ...iss.path.map((x) => (typeof x === "symbol" ? String(x) : x))], iss.message, e.id),
      );
      return;
    }
    const problems = m.check(p.data);
    problems.forEach((msg) => add(["encounters", i, "params"], msg, e.id));
    if (problems.length > 0) return;

    const solution = m.resolve(p.data);
    if (JSON.stringify(solution) !== JSON.stringify(e.solution)) {
      add(["encounters", i, "solution"], "stored solution differs from mechanic.resolve(params)", e.id);
    }
    const g = m.grade(p.data, m.solutionInput(p.data, solution));
    if (!g.correct) add(["encounters", i, "params"], `not winnable: the computed solution fails grade() (${g.feedback})`, e.id);

    const texts: [string, string][] = [
      ["prompt", e.prompt],
      ["wrongFeedback", e.wrongFeedback],
      ["debriefLine", e.debriefLine],
      ...e.hints.map((h, j): [string, string] => [`hints.${j}`, h]),
    ];
    texts.forEach(([field, text]) => {
      if (/\{\{.*?\}\}/.test(text)) add(["encounters", i, field], `unrendered placeholder in ${field}`, e.id);
    });
  });

  // design warnings: don't block the game, but show up on the Forge screen
  const practiced = new Set(spec.encounters.flatMap((e) => e.conceptIds));
  spec.concepts.filter((c) => !practiced.has(c.id)).forEach((c) => warn(["concepts"], `concept "${c.id}" never appears`));

  return issues.length > 0 ? { ok: false, issues, warnings } : { ok: true, spec, warnings };
}
