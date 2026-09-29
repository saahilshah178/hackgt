import type { Issue } from "../../contracts/common";
import type { GameSpec } from "../../contracts/gamespec";
import { World3D } from "../../contracts/world3d";
import { composeWorld, type ComposedWorld } from "../../world3d/core/compose";
import { JOG_SPEED, spatialChecks, type SpatialReport } from "../../world3d/core/spatial-checks";
import { validateWorld3D } from "../../world3d/core/validate";

/*
 * The code checks every world goes through before it ships (docs/design/60 §2.5 step 2): compose it (the composer snaps
 * placements, adds bridges and records each fix), then the referential rules (validateWorld3D) and the spatial rules
 * (spatialChecks) on the corrected copy. Issues are the World Architect's to repair; composer fixes are kept in the
 * stored world and listed in provenance.fixes. Shared by the Architect's repair loop and the fallback composer.
 */

/** Map edge length from the game length: 5 → 420 m, 10 → 560 m, 15 → 700 m. */
export function mapSizeFor(minutes: number): number {
  if (minutes <= 5) return 420;
  if (minutes <= 10) return 560;
  return 700;
}

/** Straight-line metres of walking a game this long affords (spatialChecks allows 40% of the time at jogging pace; paths wind by 1.25). */
export function walkBudgetMetres(minutes: number): number {
  return Math.round((minutes * 0.4 * 60 * JOG_SPEED) / 1.25);
}

export type CheckedSpec = Pick<GameSpec, "genre" | "encounters" | "concepts" | "characters" | "targetMinutes">;

export interface WorldCheck {
  /** the composed world (heightfield, placements, nav grid); scatter only when requested */
  composed: ComposedWorld;
  /** the corrected world: every composer fix applied */
  world: World3D;
  issues: Issue[];
  warnings: Issue[];
  report: SpatialReport;
}

/** Composes a world and runs every rule on the corrected copy. `withScatter` also scatters (the critic's digest counts it). */
export function checkWorld(spec: CheckedSpec, world: World3D, opts: { withScatter?: boolean } = {}): WorldCheck {
  const composed = composeWorld(world, { skipScatter: !opts.withScatter, quality: "high" });
  const corrected = composed.world;
  const structural = World3D.safeParse(corrected);
  const schemaIssues: Issue[] = structural.success
    ? []
    : structural.error.issues.map((i) => ({
        path: ["world3d", ...i.path.map((p) => (typeof p === "symbol" ? String(p) : p))],
        message: i.message,
        owner: "world_architect" as const,
      }));
  const ref = validateWorld3D(spec, corrected);
  const report = spatialChecks(spec, composed);
  return {
    composed,
    world: corrected,
    issues: [...schemaIssues, ...ref.issues, ...report.issues],
    warnings: [...ref.warnings, ...report.warnings],
    report,
  };
}

/** Issues as repair-note lines ("moments.3.anchor: unknown npc "x""), de-duplicated and capped. */
export function issueLines(issues: readonly Issue[], max = 20): string[] {
  const lines = issues.map((i) => `${i.path.slice(1).join(".") || "world"}: ${i.message}`);
  return [...new Set(lines)].slice(0, max);
}
