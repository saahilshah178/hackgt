"use client";

import { createContext, useContext } from "react";
import type { World3D } from "../../../contracts/world3d";
import type { ComposedWorld } from "../../../world3d/core/compose";
import type { KeyboardInput } from "../input";
import type { Body, Physics } from "../physics";
import type { Live, Store } from "../store";
import type { Director } from "./camera";

/*
 * The mutable, per-frame state the scene components share (never React state): the player's body, the camera
 * director, input, physics and the live store the HUD reads. Created once by World3DClient and provided to the scene.
 */

export interface PlayerRef extends Body {
  yaw: number;
  /** horizontal speed, m/s (drives the walk/run cycle) */
  speed: number;
}

export interface SceneRefs {
  world: World3D;
  composed: ComposedWorld;
  physics: Physics;
  input: KeyboardInput;
  director: Director;
  live: Store<Live>;
  player: PlayerRef;
  /** false while a dialogue, challenge, menu or cinematic owns the screen */
  control: { enabled: boolean };
  /** npc id the player is talking to (npcs face the player and gesture), or null */
  talkingTo: { id: string | null };
  /** DOM labels over npcs (name tags, barks), registered by the HUD's NpcLabels; the scene positions them each frame */
  labels: Map<string, HTMLElement>;
}

export const SceneRefsContext = createContext<SceneRefs | null>(null);

export function useSceneRefs(): SceneRefs {
  const r = useContext(SceneRefsContext);
  if (!r) throw new Error("useSceneRefs() must be used inside the world3d scene");
  return r;
}
