/**
 * src/world/resolve-world.ts (V1) — the resolution order and the resolved (client-side) world (docs/design/20 §0
 * decision 2, §1.2, §1.5).
 *
 * `selectWorld` applies the resolution order to already-loaded side-car files (pure; src/server/worlds.ts reads them):
 *   side-car by spec.id → side-car by (source.sourceId, genre) → spec.world → autoWorld(spec) (behind a flag) → null
 * Every candidate must validate against the spec (no issues); a failing candidate is skipped (with a reason for the
 * server-side warning) and the next is tried. Nothing ever fails to play: null means the legacy host.
 *
 * `resolveWorld(spec, overlay, source)` is pure and runs on the client: only plain JSON crosses the RSC boundary, so
 * the client rebuilds metas, parsed configs, layouts, probes and the speaker directory here. It never throws: an
 * unknown contraption or a config that no longer parses falls back to the mode's contraption (console_slate last).
 */
import type { Issue } from "../contracts/common";
import type { GameSpec } from "../contracts/gamespec";
import type { WorldFile, WorldOverlay } from "../contracts/world";
import { getMode } from "../mechanics/registry";
import { feedbackNounsFor } from "./feedback-nouns";
import { CONTRAPTION_LIBRARY, contraptionFor, getContraption, getSandbox } from "./library";
import { buildSpeakerDirectory } from "./speakers";
import type { AnyContraptionMeta, ModeKey, ResolvedSandbox, ResolvedStation, ResolvedWorld, ValidateWorldResult, WorldSource } from "./types";

export type { ResolvedSandbox, ResolvedStation, ResolvedWorld, WorldSource } from "./types";

// ---------------------------------------------------------------- selection (resolution order)

export interface NamedWorldFile {
  name: string; // "trig.world.json"
  file: WorldFile;
}
export interface SelectedWorld {
  world: WorldOverlay;
  source: WorldSource;
  /** the side-car file name, when the world came from one */
  file: string | null;
  warnings: Issue[];
}
export interface SelectWorldOptions {
  validate: (spec: GameSpec, world: WorldOverlay, sidecar: boolean) => ValidateWorldResult;
  /** autoWorld(spec) when EXPEDITION_AUTO is on; null/undefined skips the step (TODO(w1): W8 lands autoWorld) */
  auto?: ((spec: GameSpec) => WorldOverlay | null) | null;
  /** called for every skipped candidate (server-side console.warn) */
  onSkip?: (reason: string) => void;
}

export function selectWorld(spec: GameSpec, files: readonly NamedWorldFile[], opts: SelectWorldOptions): SelectedWorld | null {
  const tried = new Set<NamedWorldFile>();
  const attempt = (world: WorldOverlay, source: WorldSource, file: string | null): SelectedWorld | null => {
    let r: ValidateWorldResult;
    try {
      r = opts.validate(spec, world, file !== null);
    } catch (err) {
      opts.onSkip?.(`${file ?? source}: validation threw (${(err as Error).message})`);
      return null;
    }
    if (r.issues.length > 0) {
      const first = r.issues.slice(0, 3).map((i) => i.message).join("; ");
      opts.onSkip?.(`${file ?? source} does not fit spec "${spec.id}" (${r.issues.length} issues: ${first})`);
      return null;
    }
    return { world, source, file, warnings: r.warnings };
  };
  for (const f of files) {
    if (!f.file.appliesTo.specIds.includes(spec.id)) continue;
    tried.add(f);
    const hit = attempt(f.file.world, "sidecar_id", f.name);
    if (hit) return hit;
  }
  for (const f of files) {
    if (tried.has(f)) continue;
    if (!f.file.appliesTo.sources.some((s) => s.sourceId === spec.source.sourceId && s.genre === spec.genre)) continue;
    const hit = attempt(f.file.world, "sidecar_source", f.name);
    if (hit) return hit;
  }
  if (spec.world) {
    const hit = attempt(spec.world, "spec", null);
    if (hit) return hit;
  }
  if (opts.auto) {
    let auto: WorldOverlay | null = null;
    try {
      auto = opts.auto(spec);
    } catch (err) {
      opts.onSkip?.(`autoWorld threw (${(err as Error).message})`);
    }
    if (auto) {
      const hit = attempt(auto, "auto", null);
      if (hit) return hit;
    }
  }
  return null;
}

// ---------------------------------------------------------------- flags

/** Flags something can set (R12): quest rewards, trigger and NPC-state setFlag, sandbox rewards, cutscene set_state. */
export function declaredFlagsOf(world: WorldOverlay): Set<string> {
  const out = new Set<string>();
  world.quests.forEach((q) => out.add(q.reward.flag));
  world.triggers.forEach((t) => t.setFlag && out.add(t.setFlag));
  world.npcs.forEach((n) => n.states.forEach((s) => s.setFlag && out.add(s.setFlag)));
  world.sandboxes.forEach((s) => s.reward?.flag && out.add(s.reward.flag));
  world.cutscenes.forEach((c) => c.steps.forEach((s) => s.do === "set_state" && s.target.kind === "flag" && out.add(s.target.id)));
  return out;
}

// ---------------------------------------------------------------- resolution

function parseWith(meta: AnyContraptionMeta, config: unknown): { ok: true; value: unknown } | { ok: false } {
  const r = meta.configSchema.safeParse(config);
  return r.success ? { ok: true, value: r.data } : { ok: false };
}

export function resolveWorld(spec: GameSpec, overlay: WorldOverlay, source: WorldSource): ResolvedWorld {
  const zoneIndex = new Map(overlay.zones.map((z, i) => [z.id, i]));
  const stations: ResolvedStation[] = [];
  spec.encounters.forEach((e, index) => {
    const st = overlay.stations.find((s) => s.encounterId === e.id);
    if (!st) return;
    const modeKey = `${e.familyId}.${e.mode}` as ModeKey;
    const mode = getMode(e.familyId, e.mode);
    let view: unknown = null;
    try {
      view = mode ? mode.present(e.params, spec.seed + index) : null;
    } catch {
      view = null;
    }
    const chosen = getContraption(st.contraption);
    const candidates = [chosen, contraptionFor(modeKey, e.role), CONTRAPTION_LIBRARY.console_slate].filter(
      (m): m is AnyContraptionMeta => !!m && m.modes.includes(modeKey),
    );
    let meta: AnyContraptionMeta = CONTRAPTION_LIBRARY.console_slate;
    let parsedConfig: unknown = {};
    for (const m of candidates) {
      const p = parseWith(m, m === chosen ? st.config : {});
      if (p.ok) {
        meta = m;
        parsedConfig = p.value;
        break;
      }
    }
    if (meta !== chosen) {
      const p = parseWith(meta, {});
      parsedConfig = p.ok ? p.value : {};
    }
    const layout = st.panel.layout !== null && meta.layouts.includes(st.panel.layout) ? st.panel.layout : meta.defaultLayout;
    let probe = null;
    try {
      probe = meta.probe(parsedConfig, view);
    } catch {
      probe = null;
    }
    stations.push({
      ...st,
      contraption: meta.id === st.contraption ? st.contraption : meta.id,
      skin: meta === chosen ? st.skin : (meta.skins[0]?.id ?? st.skin),
      index,
      zoneIndex: zoneIndex.get(st.zoneId) ?? 0,
      modeKey,
      meta,
      parsedConfig,
      layout,
      probe,
    });
  });
  const sandboxes: ResolvedSandbox[] = [];
  for (const s of overlay.sandboxes) {
    const meta = getSandbox(s.contraption);
    if (!meta) continue;
    const p = meta.configSchema.safeParse(s.config);
    if (!p.success) continue;
    sandboxes.push({ ...s, meta, parsedConfig: p.data });
  }
  return {
    overlay,
    source,
    zones: overlay.zones,
    stations,
    stationByEncounter: new Map(stations.map((s) => [s.encounterId, s])),
    sandboxes,
    speakers: buildSpeakerDirectory(spec, overlay),
    flagsDeclared: declaredFlagsOf(overlay),
    feedbackNouns: (encounterId: string) => feedbackNounsFor(overlay.feedbackNouns, encounterId),
    namespaces: overlay.biome === "shared" ? ["shared"] : ["shared", overlay.biome],
  };
}
