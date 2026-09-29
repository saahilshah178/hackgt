"use client";

// loads R3F's JSX intrinsic elements (<mesh>, <group>, …) for every kit file
import type {} from "@react-three/fiber";
import { createContext, useContext } from "react";
import type { ComposedWorld, Quality } from "../core/compose";
import type { LightRig } from "../core/moods";

/*
 * What every kit component can read without prop drilling: the composed world, the quality tier and the light rig.
 * Provided by <WorldScene>; the game host (src/game/world3d) and the /dev/kit3d gallery both render inside it.
 */

export interface WorldKit {
  composed: ComposedWorld;
  quality: Quality;
  rig: LightRig;
  /** landmark ids whose seal/gate/bridge has been opened (the moment's `opens` was solved) */
  opened: ReadonlySet<string>;
  /** reduced motion: no camera sway, no flyovers, calmer particles */
  reducedMotion: boolean;
}

export const WorldKitContext = createContext<WorldKit | null>(null);

export function useWorldKit(): WorldKit {
  const kit = useContext(WorldKitContext);
  if (!kit) throw new Error("useWorldKit() must be used inside <WorldScene>");
  return kit;
}
