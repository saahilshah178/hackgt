"use client";
/**
 * src/game/expedition/client/ExpeditionEntry.tsx (H2) — the lazy entry GameClient loads when a world resolved: the
 * play page sends the overlay as plain JSON (`world`, `worldSource`), and the client rebuilds the metas with V1's
 * `resolveWorld` (pure, never throws) before mounting ExpeditionClient. Default export for `React.lazy`.
 */
import { useMemo } from "react";
import type { GameSpec } from "../../../contracts/gamespec";
import type { WorldOverlay } from "../../../contracts/world";
import { resolveWorld } from "../../../world/resolve-world";
import type { WorldSource } from "../../../world/types";
import { ExpeditionClient } from "./ExpeditionClient";

export interface ExpeditionEntryProps {
  spec: GameSpec;
  world: WorldOverlay;
  source: WorldSource;
  sfx: boolean;
}

export default function ExpeditionEntry({ spec, world, source, sfx }: ExpeditionEntryProps) {
  const resolved = useMemo(() => resolveWorld(spec, world, source), [spec, world, source]);
  return <ExpeditionClient spec={spec} world={resolved} sfx={sfx} />;
}
