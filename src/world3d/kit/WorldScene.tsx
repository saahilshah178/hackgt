"use client";

import { useEffect, useMemo, type ReactNode } from "react";
import * as THREE from "three";
import { BIOMES } from "../core/biomes";
import type { ComposedWorld, Quality } from "../core/compose";
import { lightRig, sunDirection } from "../core/moods";
import { WorldKitContext, type WorldKit } from "./context";
import { SpecialPiece, Structures } from "./structures";
import { Wildlife, type WildlifeProps } from "./wildlife/Wildlife";

/*
 * <WorldScene>: everything static or ambient in a composed world (sky, light, terrain, water, vegetation, structures,
 * wildlife, weather, post). Render it inside an R3F <Canvas>; the game host adds the player, npcs and interaction
 * markers as children. API (stable):
 *   <WorldScene composed quality opened reducedMotion playerPosition onAnimals>{children}</WorldScene>
 * This file starts as a stub (vertex-coloured terrain, flat water, hemisphere + sun) that the kit replaces piece by piece.
 */

export interface WorldSceneProps {
  composed: ComposedWorld;
  quality?: Quality;
  opened?: ReadonlySet<string>;
  reducedMotion?: boolean;
  playerPosition?: WildlifeProps["playerPosition"];
  onAnimals?: WildlifeProps["onPositions"];
  children?: ReactNode;
}

const EMPTY: ReadonlySet<string> = new Set();

function StubTerrain({ composed }: { composed: ComposedWorld }) {
  const geometry = useMemo(() => {
    const { hf } = composed;
    const g = new THREE.PlaneGeometry(hf.size, hf.size, hf.res - 1, hf.res - 1);
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position as THREE.BufferAttribute;
    const colors = new Float32Array(pos.count * 3);
    const b = BIOMES[composed.world.biome];
    const low = new THREE.Color(b.ground.low.color);
    const high = new THREE.Color(b.ground.high.color);
    const cliff = new THREE.Color(b.ground.cliff.color);
    const shore = new THREE.Color(b.ground.shore.color);
    const path = new THREE.Color(b.ground.path.color);
    const c = new THREE.Color();
    const level = hf.waterLevel ?? -Infinity;
    for (let i = 0; i < pos.count; i++) {
      // PlaneGeometry rotated -90° about x: rows run from z = -size/2 (north) to +size/2, matching the grid
      const ix = i % hf.res;
      const iz = Math.floor(i / hf.res);
      const h = hf.heights[iz * hf.res + ix];
      pos.setY(i, h);
      const { x, z } = hf.toWorld(ix, iz);
      const s = hf.slope(x, z);
      c.copy(low).lerp(high, THREE.MathUtils.smoothstep(h - level, b.highLine * 0.6, b.highLine * 1.4));
      if (h < level + 1.2) c.lerp(shore, 0.7);
      c.lerp(cliff, THREE.MathUtils.smoothstep(s, 24, 40));
      c.lerp(path, composed.pathMask[iz * hf.res + ix] / 255);
      colors.set([c.r, c.g, c.b], i * 3);
    }
    g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    g.computeVertexNormals();
    return g;
  }, [composed]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh geometry={geometry} receiveShadow name="terrain">
      <meshStandardMaterial vertexColors roughness={0.95} />
    </mesh>
  );
}

function StubAtmosphere({ kit }: { kit: WorldKit }) {
  const dir = sunDirection(kit.rig);
  const half = kit.composed.hf.size / 2;
  return (
    <>
      <color attach="background" args={[kit.rig.fog.color]} />
      <fogExp2 attach="fog" args={[kit.rig.fog.color, kit.rig.fog.density]} />
      <hemisphereLight args={[kit.rig.hemisphere.sky, kit.rig.hemisphere.ground, kit.rig.hemisphere.intensity]} />
      <directionalLight
        color={kit.rig.sun.color}
        intensity={kit.rig.sun.intensity}
        position={[dir.x * 400, dir.y * 400, dir.z * 400]}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-half}
        shadow-camera-right={half}
        shadow-camera-top={half}
        shadow-camera-bottom={-half}
        shadow-camera-far={1200}
      />
    </>
  );
}

export function WorldScene({ composed, quality = "high", opened = EMPTY, reducedMotion = false, playerPosition, onAnimals, children }: WorldSceneProps) {
  const w = composed.world;
  const rig = useMemo(() => lightRig(w.atmosphere.mood, w.atmosphere.weather, w.biome, w.atmosphere.fog), [w.atmosphere.mood, w.atmosphere.weather, w.biome, w.atmosphere.fog]);
  const kit = useMemo<WorldKit>(() => ({ composed, quality, rig, opened, reducedMotion }), [composed, quality, rig, opened, reducedMotion]);
  const level = composed.hf.waterLevel;
  return (
    <WorldKitContext.Provider value={kit}>
      <StubAtmosphere kit={kit} />
      <StubTerrain composed={composed} />
      {level !== null && (
        <mesh position={[0, level, 0]} rotation={[-Math.PI / 2, 0, 0]} name="water">
          <planeGeometry args={[composed.hf.size, composed.hf.size]} />
          <meshStandardMaterial color={BIOMES[w.biome].water.shallow} roughness={0.15} metalness={0.2} transparent opacity={0.85} />
        </mesh>
      )}
      <Structures list={[...composed.landmarks, ...composed.pieces]} opened={opened} />
      {composed.specials.map((s) => (
        <SpecialPiece key={s.id} special={s} />
      ))}
      <Wildlife list={composed.wildlife} playerPosition={playerPosition} onPositions={onAnimals} />
      {children}
    </WorldKitContext.Provider>
  );
}
