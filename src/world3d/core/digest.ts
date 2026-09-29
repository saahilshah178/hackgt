import type { GameSpec } from "../../contracts/gamespec";
import type { World3D } from "../../contracts/world3d";
import { BIOMES } from "./biomes";
import { STRUCTURES } from "./catalog";
import type { ComposedWorld } from "./compose";
import { anchorPoint, JOG_SPEED, type SpatialReport } from "./spatial-checks";

/*
 * The World Critic's eyes (docs/design/60 §2.5): a composed world turned into text an LLM can judge. An ASCII top-down
 * map (north up), a legend of every landmark and character, the numbers the spatial checks measured (sightline to the
 * goal, reachability, the walk the story asks for), what the renderer will draw (scatter, wildlife, pieces), and every
 * string the HUD shows with its length against the UI budget. Pure: no three.js, no DOM.
 */

/** HUD text budgets (characters) that stay readable at 1280×720 and on a projector. */
export const HUD_BUDGET = { objective: 70, name: 24, line: 180, title: 48 } as const;

/** Characters per map edge. */
export const DIGEST_GRID = 60;

/** Slope (degrees) above which the map marks ground as steep; the controller's hard limit is 38. */
const STEEP_SLOPE = 30;

const LANDMARK_LETTERS = "ABCDEFHIJKLMNOPQRTUVWXYZabcdefghijklmnopqrstuvwxyz";

const round = (v: number) => Math.round(v);
const fmtPoint = (p: { x: number; z: number }) => `(${round(p.x)}, ${round(p.z)})`;

export interface AsciiMap {
  rows: string[];
  /** map character → what it marks (landmarks, npcs, spawn, goal) */
  legend: string[];
  /** metres per character */
  cell: number;
}

/** A top-down map of the composed world: north (−z) up, east (+x) right. */
export function asciiMap(c: ComposedWorld, n = DIGEST_GRID): AsciiMap {
  const w = c.world;
  const size = c.hf.size;
  const half = size / 2;
  const cell = size / n;
  const grid: string[][] = Array.from({ length: n }, () => Array.from({ length: n }, () => " "));
  const toCell = (x: number, z: number) => ({ col: clampIdx(Math.floor((x + half) / cell), n), row: clampIdx(Math.floor((z + half) / cell), n) });
  const centre = (row: number, col: number) => ({ x: -half + (col + 0.5) * cell, z: -half + (row + 0.5) * cell });

  // ground: high, steep, water, paths (later marks win)
  const level = c.hf.waterLevel;
  const base = level ?? percentile(c.hf.heights, 0.1);
  const highLine = BIOMES[w.biome].highLine;
  const res = c.hf.res;
  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) {
      const { x, z } = centre(row, col);
      let ch = " ";
      if (c.hf.height(x, z) - base > highLine) ch = "^";
      if (c.hf.slope(x, z) > STEEP_SLOPE) ch = ":";
      if (c.hf.waterDepth(x, z) > 0.3) ch = "~";
      const ix = clampIdx(Math.round((x + half) / c.hf.cell), res);
      const iz = clampIdx(Math.round((z + half) / c.hf.cell), res);
      if (c.pathMask[iz * res + ix] > 100) ch = ".";
      grid[row][col] = ch;
    }
  }
  // fields and quarries, then structure footprints
  for (const s of c.specials) stampDisc(grid, n, cell, half, s.x, s.z, Math.hypot(s.halfW, s.halfD) * 0.8, '"');
  for (const p of [...c.pieces, ...c.landmarks]) stampDisc(grid, n, cell, half, p.x, p.z, p.radius, "#");
  for (const col of c.collectibles) {
    const at = toCell(col.x, col.z);
    grid[at.row][at.col] = "*";
  }

  const legend: string[] = [];
  c.npcs.forEach((npc, i) => {
    const mark = i < 9 ? String(i + 1) : i === 9 ? "0" : "@";
    const at = toCell(npc.x, npc.z);
    grid[at.row][at.col] = mark;
    const src = w.npcs.find((x) => x.id === npc.id);
    legend.push(`${mark}  npc ${npc.id} "${src?.name ?? npc.id}" (${src?.role ?? "?"}) at ${fmtPoint(npc)}, ${src?.behavior ?? "idle"}`);
  });
  let letter = 0;
  for (const p of c.landmarks) {
    const isGoal = c.goal?.id === p.id;
    const mark = isGoal ? "G" : (LANDMARK_LETTERS[letter++] ?? "?");
    const at = toCell(p.x, p.z);
    grid[at.row][at.col] = mark;
    const src = w.landmarks.find((l) => l.id === p.id);
    legend.push(
      `${mark}  ${p.id}: ${p.kind} "${src?.name ?? p.name ?? p.id}", role ${p.role}, scale ${p.scale.toFixed(2)}, ${p.material} ${p.style}, at ${fmtPoint(p)}, footprint r ${round(p.radius)} m, height ${round(p.height)} m`,
    );
  }
  const spawnCell = toCell(c.spawn.x, c.spawn.z);
  grid[spawnCell.row][spawnCell.col] = "S";
  legend.unshift(`S  spawn at ${fmtPoint(c.spawn)}, facing ${round(((c.spawn.facing * 180) / Math.PI + 360) % 360)}° (0 = south, 180 = north)`);

  const border = `+${"-".repeat(n)}+`;
  return { rows: [border, ...grid.map((r) => `|${r.join("")}|`), border], legend, cell };
}

function clampIdx(i: number, n: number): number {
  return Math.max(0, Math.min(n - 1, i));
}

function stampDisc(grid: string[][], n: number, cell: number, half: number, x: number, z: number, r: number, ch: string) {
  const c0 = clampIdx(Math.floor((x - r + half) / cell), n);
  const c1 = clampIdx(Math.floor((x + r + half) / cell), n);
  const r0 = clampIdx(Math.floor((z - r + half) / cell), n);
  const r1 = clampIdx(Math.floor((z + r + half) / cell), n);
  for (let row = r0; row <= r1; row++) {
    for (let col = c0; col <= c1; col++) {
      const cx = -half + (col + 0.5) * cell;
      const cz = -half + (row + 0.5) * cell;
      if (Math.hypot(cx - x, cz - z) <= Math.max(r, cell * 0.5)) grid[row][col] = ch;
    }
  }
  const col = clampIdx(Math.floor((x + half) / cell), n);
  const row = clampIdx(Math.floor((z + half) / cell), n);
  grid[row][col] = ch;
}

function percentile(values: Float32Array, q: number): number {
  const sample: number[] = [];
  for (let i = 0; i < values.length; i += 13) sample.push(values[i]);
  sample.sort((a, b) => a - b);
  return sample[Math.floor((sample.length - 1) * q)] ?? 0;
}

// ---------------------------------------------------------------- HUD text

export interface HudString {
  what: string;
  text: string;
  budget: number;
  over: boolean;
}

/** Every string the HUD, dialogue box and journal show, with its budget. */
export function hudStrings(w: World3D): HudString[] {
  const out: HudString[] = [];
  const add = (what: string, text: string, budget: number) => out.push({ what, text, budget, over: text.length > budget });
  add("goal title", w.quest.goal.title, HUD_BUDGET.title);
  add("goal description", w.quest.goal.description, 240);
  add("opening caption", w.opening.caption, 120);
  add("collectibles label", w.collectibles.label, HUD_BUDGET.name);
  w.quest.acts.forEach((a) => add(`act ${a.id} title`, a.title, HUD_BUDGET.title));
  w.moments.forEach((m) => add(`objective ${m.encounterId}`, m.objective, HUD_BUDGET.objective));
  w.landmarks.forEach((l) => add(`landmark ${l.id} name`, l.name, HUD_BUDGET.name));
  w.npcs.forEach((n) => {
    add(`npc ${n.id} name`, n.name, HUD_BUDGET.name);
    add(`npc ${n.id} role`, n.role, 60);
    add(`npc ${n.id} greeting`, n.greeting, HUD_BUDGET.line);
    n.barks.forEach((b, i) => add(`npc ${n.id} bark ${i + 1}`, b, 120));
  });
  w.moments.forEach((m) => {
    m.approach.forEach((l, i) => add(`${m.encounterId} approach ${i + 1} (${l.speaker})`, l.text, HUD_BUDGET.line));
    m.success.forEach((l, i) => add(`${m.encounterId} success ${i + 1} (${l.speaker})`, l.text, HUD_BUDGET.line));
    add(`${m.encounterId} reward name`, m.reward.name, HUD_BUDGET.name);
  });
  w.collectibles.items.forEach((c) => add(`collectible ${c.id} title`, c.title, HUD_BUDGET.name));
  return out;
}

// ---------------------------------------------------------------- the digest

/** The full text the World Critic reads. */
export function worldDigest(spec: Pick<GameSpec, "title" | "targetMinutes" | "encounters">, c: ComposedWorld, report: SpatialReport): string {
  const w = c.world;
  const map = asciiMap(c);
  const s = report.stats;
  const out: string[] = [];

  out.push(`# World digest: ${spec.title}`);
  out.push(
    `Setting: ${w.setting.era}; ${w.setting.place}; style ${w.setting.style}. Biome ${w.biome}; mood ${w.atmosphere.mood}, weather ${w.atmosphere.weather}, fog ${w.atmosphere.fog}, wind ${w.atmosphere.wind}. HUD theme ${w.ui.hudTheme}, accent ${w.ui.accent}; ambience ${w.audio.ambience}.`,
  );
  const water = w.terrain.water;
  out.push(
    `Map ${w.terrain.size} m square (x east, z south, origin at the centre); relief ${w.terrain.relief}; water ${water.kind}${water.kind === "river" ? ` (${water.width} m wide)` : water.kind === "ocean" ? ` along the ${water.coast} edge` : ""}; features: ${w.terrain.features.map((f) => `${f.kind} at ${fmtPoint(f.at)} r ${round(f.radius)} h ${round(f.height)}`).join("; ") || "none"}.`,
  );

  out.push("", `## Top-down map (north up, 1 character = ${map.cell.toFixed(1)} m)`);
  out.push('Legend: "~" water, "^" high ground, ":" steep (over 30°; over 38° is unclimbable), "." path, "#" structure footprint, \'"\' fields/quarry, letters = landmarks, digits = npcs, "S" spawn, "G" goal, "*" collectible.');
  out.push(...map.rows);
  out.push("", "## Legend", ...map.legend);

  out.push("", "## Measured by code");
  const goal = c.goal;
  out.push(`- goal visible from the spawn: ${s.goalVisibleFromSpawn ? "yes" : "NO"}${goal ? `; the goal is ${round(Math.hypot(goal.x - c.spawn.x, goal.z - c.spawn.z))} m from the spawn and ${round(goal.height)} m tall` : "; no goal landmark"}`);
  out.push(`- reachable on foot from the spawn: ${s.reachablePercent}% of the walkable ground`);
  out.push(`- smallest gap between landmark footprints: ${s.minLandmarkGap} m`);
  const budget = spec.targetMinutes * 0.4;
  out.push(`- the story's walk (spawn → every moment in act order): ${s.tourMetres} m, about ${s.tourMinutes} min at jogging pace (${JOG_SPEED} m/s); budget ${budget.toFixed(1)} min (40% of a ${spec.targetMinutes}-minute game)`);
  out.push("- moments in act order (metres from the spawn; hop = straight line from the previous stop):");
  const actOf = new Map(w.quest.acts.flatMap((a) => a.encounterIds.map((id) => [id, a.id] as const)));
  let prev = { x: c.spawn.x, z: c.spawn.z };
  for (const d of s.anchorDistances) {
    const m = w.moments.find((x) => x.encounterId === d.encounterId);
    const a = m ? anchorPoint(c, m.anchor) : null;
    const hop = a ? round(Math.hypot(a.x - prev.x, a.z - prev.z)) : 0;
    if (a) prev = { x: a.x, z: a.z };
    const socket = spec.encounters.find((e) => e.id === d.encounterId)?.socket ?? "?";
    out.push(`  ${actOf.get(d.encounterId) ?? "no act"} · ${d.encounterId} (${socket}) at ${d.anchor}: ${d.metres} m from spawn, hop ${hop} m${hop > 120 ? " (LONG)" : ""}${d.reachable ? "" : ", UNREACHABLE"}`);
  }
  if (report.issues.length > 0) out.push("- blocking problems:", ...report.issues.map((i) => `  ${i.message}`));
  if (report.warnings.length > 0) out.push("- warnings:", ...report.warnings.slice(0, 12).map((i) => `  ${i.message}`));
  if (c.fixes.length > 0) out.push("- code fixed while composing:", ...c.fixes.slice(0, 12).map((f) => `  ${f}`));

  out.push("", "## What the renderer draws");
  const roles = ["goal", "hub", "poi", "decor"].map((r) => `${w.landmarks.filter((l) => l.role === r).length} ${r}`).join(", ");
  out.push(`- landmarks: ${w.landmarks.length} (${roles}); cluster pieces: ${c.pieces.length} from ${w.clusters.length} clusters (${w.clusters.map((k) => `${k.kind} ×${k.count}`).join(", ") || "none"}); fields/quarries: ${c.specials.length}`);
  out.push(`- npcs: ${w.npcs.length}; collectibles: ${w.collectibles.items.length} "${w.collectibles.label}"; paths routed: ${c.paths.length} of ${w.paths.length}`);
  const scatterTotal = c.scatter.reduce((sum, b) => sum + b.count, 0);
  out.push(`- scatter instances: ${scatterTotal} (${c.scatter.map((b) => `${b.kind} ${b.count}`).join(", ") || "none"})`);
  out.push(`- wildlife: ${w.wildlife.map((x) => `${x.kind} ×${x.count} (${x.zone}${x.landmarkId ? ` ${x.landmarkId}` : ""})`).join(", ") || "none"}`);
  const solidTrees = c.scatter.filter((b) => ["palm", "conifer", "broadleaf", "birch", "dead_tree", "cactus", "boulder", "crystal", "ice_shard"].includes(b.kind)).reduce((sum, b) => sum + b.count, 0);
  out.push(`- solid props (trees, boulders): ${solidTrees}; structures total: ${c.landmarks.length + c.pieces.length}`);
  const bigKinds = w.landmarks.filter((l) => STRUCTURES[l.kind].radius * l.scale >= 30).map((l) => `${l.id} (${l.kind})`);
  if (bigKinds.length > 0) out.push(`- large structures: ${bigKinds.join(", ")}`);

  out.push("", `## HUD text (length/budget; "!" = over budget)`);
  for (const h of hudStrings(w)) out.push(`${h.over ? "!" : " "} ${h.what} (${h.text.length}/${h.budget}): ${JSON.stringify(h.text)}`);
  return out.join("\n");
}
