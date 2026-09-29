"use client";

import { AdaptiveDpr } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { useCallback } from "react";
import type { NpcLook } from "../../../contracts/world3d";
import type { Quality } from "../../../world3d/core/compose";
import { RewardBurst } from "../../../world3d/kit/fx";
import { WorldScene } from "../../../world3d/kit/WorldScene";
import type { MomentInfo } from "../model";
import type { Pose, Target } from "../store";
import { CameraRig } from "./CameraRig";
import { Markers } from "./Markers";
import { Npcs } from "./Npcs";
import { Player } from "./Player";
import { SceneRefsContext, type SceneRefs } from "./refs";

/*
 * The WebGL half of a world3d game: the kit's <WorldScene> (sky, terrain, water, vegetation, structures, wildlife,
 * weather, post) plus the game's own actors: the player, the npcs, wayfinding markers and the camera rig. Everything
 * per-frame lives in `refs`; React props change only when the story does (a lead opens, a relic is picked up).
 */

export interface GameCanvasProps {
  refs: SceneRefs;
  quality: Quality;
  reducedMotion: boolean;
  opened: ReadonlySet<string>;
  playerLook: NpcLook;
  leads: readonly MomentInfo[];
  collected: ReadonlySet<string>;
  accent: string;
  /** the landmark the player can press E on (its structure gets a rim highlight) */
  highlightId: string | null;
  /** the last solved moment's anchor: a burst of light there (changes `key` per burst) */
  burst: { key: number; x: number; y: number; z: number } | null;
  findTarget(pose: Pose): Target | null;
}

const DPR: Record<Quality, [number, number]> = { low: [0.75, 1], medium: [1, 1.5], high: [1, 2] };

export function GameCanvas(props: GameCanvasProps) {
  const { refs } = props;
  const playerPosition = useCallback(() => refs.player, [refs]);
  const onAnimals = useCallback((animals: { id: string; kind: string; x: number; y: number; z: number }[]) => refs.live.set({ animals }), [refs]);
  const focus = useCallback(() => refs.player, [refs]);
  return (
    <Canvas
      shadows="percentage"
      dpr={DPR[props.quality]}
      gl={{ antialias: props.quality !== "low", powerPreference: "high-performance", preserveDrawingBuffer: true }}
      camera={{ fov: 58, near: 0.2, far: 5000, position: [refs.player.x, refs.player.y + 3, refs.player.z + 6] }}
      data-testid="world3d-canvas"
      style={{ position: "absolute", inset: 0 }}
    >
      <SceneRefsContext.Provider value={refs}>
        <WorldScene
          composed={refs.composed}
          quality={props.quality}
          opened={props.opened}
          reducedMotion={props.reducedMotion}
          playerPosition={playerPosition}
          onAnimals={onAnimals}
          focus={focus}
          highlightId={props.highlightId}
        >
          <Player look={props.playerLook} findTarget={props.findTarget} />
          <Npcs />
          <Markers leads={props.leads} collected={props.collected} accent={props.accent} />
          {props.burst && <RewardBurst position={props.burst} trigger={props.burst.key} color={props.accent} />}
        </WorldScene>
        <CameraRig reducedMotion={props.reducedMotion} />
        <AdaptiveDpr pixelated={false} />
      </SceneRefsContext.Provider>
    </Canvas>
  );
}
