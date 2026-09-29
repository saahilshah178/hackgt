"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, type ReactNode } from "react";
import * as THREE from "three";
import type { ComposedWorld, Quality } from "../core/compose";
import { lightRig } from "../core/moods";
import { WorldKitContext, type WorldKit } from "./context";
import { setMaterialQuality } from "./materials";
import { GoalBeacon, WeatherFx } from "./fx";
import { PostStack } from "./post/PostStack";
import { qualitySettings } from "./quality";
import { createEnvUniforms, EnvContext } from "./sky/env";
import { SkySystem, skyLook } from "./sky/Sky";
import { SpecialPiece, Structure } from "./structures";
import { Terrain, useSunVisibility } from "./terrain/Terrain";
import { Vegetation } from "./vegetation/Vegetation";
import { Water } from "./water/Water";
import { Wildlife, type WildlifeProps } from "./wildlife/Wildlife";

/*
 * <WorldScene>: everything static or ambient in a composed world (sky, light, terrain, water, vegetation, structures,
 * wildlife, weather, post). Render it inside an R3F <Canvas>; the game host adds the player, npcs and interaction
 * markers as children. API (stable):
 *   <WorldScene composed quality opened reducedMotion playerPosition onAnimals focus? post? beacon? highlightId?>{children}</WorldScene>
 * `focus` (optional) is where the sun's tight shadow box centres each frame (the game passes the player position;
 * default: the spawn). `post` (default true) turns the post-processing chain off for hosts that bring their own;
 * `beacon` (default true) shows the goal beacon; `highlightId` rims the landmark the player can interact with.
 */

export interface WorldSceneProps {
  composed: ComposedWorld;
  quality?: Quality;
  opened?: ReadonlySet<string>;
  reducedMotion?: boolean;
  playerPosition?: WildlifeProps["playerPosition"];
  onAnimals?: WildlifeProps["onPositions"];
  /** the point the sun's shadow box follows (the player); default: the spawn */
  focus?: () => { x: number; y: number; z: number } | null;
  /** post-processing chain (default true; the Low tier never runs it) */
  post?: boolean;
  /** the goal beacon light pillar (default true) */
  beacon?: boolean;
  /** the landmark the player can interact with right now (its structure gets a soft rim highlight) */
  highlightId?: string | null;
  children?: ReactNode;
}

const EMPTY: ReadonlySet<string> = new Set();

/** Renderer state owned by the scene: exposure always; tone mapping only when no composer is running. */
function RendererSettings({ exposure, toneMap }: { exposure: number; toneMap: boolean }) {
  useFrame((state) => {
    const gl = state.gl;
    if (gl.toneMappingExposure !== exposure) gl.toneMappingExposure = exposure;
    if (toneMap && gl.toneMapping !== THREE.AgXToneMapping) gl.toneMapping = THREE.AgXToneMapping;
  }, -10);
  return null;
}

export function WorldScene({ composed, quality = "high", opened = EMPTY, reducedMotion = false, playerPosition, onAnimals, focus, post = true, beacon = true, highlightId = null, children }: WorldSceneProps) {
  const w = composed.world;
  const rig = useMemo(() => lightRig(w.atmosphere.mood, w.atmosphere.weather, w.biome, w.atmosphere.fog), [w.atmosphere.mood, w.atmosphere.weather, w.biome, w.atmosphere.fog]);
  const kit = useMemo<WorldKit>(() => ({ composed, quality, rig, opened, reducedMotion }), [composed, quality, rig, opened, reducedMotion]);
  const q = qualitySettings(quality);
  const env = useMemo(() => createEnvUniforms(), []);
  const look = useMemo(() => skyLook(rig, w.biome, w.atmosphere.weather), [rig, w.biome, w.atmosphere.weather]);
  const structures = useMemo(() => [...composed.landmarks, ...composed.pieces], [composed]);
  useEffect(() => setMaterialQuality(quality), [quality]);
  useEffect(() => {
    env.uWind.value = w.atmosphere.wind;
    env.uCalm.value = reducedMotion ? 1 : 0;
    const half = composed.hf.size / 2;
    env.uGrid.value.set(half, 1 / composed.hf.cell, composed.hf.res, composed.hf.waterLevel ?? -1e4);
    // prevailing wind from the seed, so every world blows its own way
    const a = ((w.seed % 360) * Math.PI) / 180;
    env.uWindDir.value.set(Math.cos(a), Math.sin(a));
  }, [env, w.atmosphere.wind, w.seed, reducedMotion, composed]);
  useSunVisibility(composed, look.sun, q.bakedShadows, env);

  return (
    <WorldKitContext.Provider value={kit}>
      <EnvContext.Provider value={env}>
        <RendererSettings exposure={look.exposure} toneMap={q.post === "none" || !post} />
        <SkySystem focus={focus} />
        <Terrain />
        <Water />
        <Vegetation />
        {structures.map((p) => (
          <Structure key={p.id} placed={p} opened={opened.has(p.id)} highlight={p.id === highlightId} />
        ))}
        {composed.specials.map((s) => (
          <SpecialPiece key={s.id} special={s} />
        ))}
        <Wildlife list={composed.wildlife} playerPosition={playerPosition} onPositions={onAnimals} />
        <WeatherFx />
        {beacon && <GoalBeacon />}
        {children}
        {post && <PostStack rig={rig} settings={q} night={look.mode !== 0} />}
      </EnvContext.Provider>
    </WorldKitContext.Provider>
  );
}
