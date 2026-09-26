/**
 * src/world/state/requirements.ts (S1) — `requirementMet` (docs/design/20 §2.4.6, contract `Requirement`).
 * Every set condition must hold; `null` always holds. Pure.
 */
import type { Requirement } from "../../contracts/world";
import type { ReqCtx } from "../types";

export function requirementMet(req: Requirement | null | undefined, ctx: ReqCtx): boolean {
  if (!req) return true;
  if (req.solved !== null && req.solved !== undefined && !ctx.solvedIds.has(req.solved)) return false;
  if (req.flag !== null && req.flag !== undefined && !ctx.state.flags.has(req.flag)) return false;
  if (req.notFlag !== null && req.notFlag !== undefined && ctx.state.flags.has(req.notFlag)) return false;
  for (const id of req.collected ?? []) if (!ctx.state.collected.has(id)) return false;
  return true;
}
