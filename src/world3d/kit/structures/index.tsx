"use client";

import { memo } from "react";
import type { Placed, Special } from "../../core/compose";
import { STRUCTURES } from "../../core/catalog";
import { getWorldMaterial } from "../materials";

/*
 * Structure dispatch. API (stable): <Structure placed opened highlight />, <Structures list opened />,
 * <SpecialPiece special />. Each StructureKind gets its own builder in this folder; a builder receives the Placed record
 * (position, yaw, scale, footprint radius, height, material, style, seed) and must stay inside `radius` and reach about
 * `height`, facing local +z. This file starts as a stub that draws a sized placeholder for every kind.
 */

export interface StructureProps {
  placed: Placed;
  /** its seal/gate/bridge has been opened by a solved moment */
  opened?: boolean;
  /** the player is in reach of it (subtle rim light / outline) */
  highlight?: boolean;
}

function Placeholder({ placed }: StructureProps) {
  const info = STRUCTURES[placed.kind];
  const r = placed.radius;
  const h = placed.height;
  const mat = getWorldMaterial(placed.material, { variant: placed.seed % 4 });
  if (placed.kind === "pyramid" || placed.kind === "step_pyramid") {
    return (
      <mesh position={[0, h / 2, 0]} rotation={[0, Math.PI / 4, 0]} material={mat} castShadow receiveShadow>
        <coneGeometry args={[r * Math.SQRT2 * 0.98, h, 4, 1]} />
      </mesh>
    );
  }
  if (info.radius < 4 || placed.kind === "tower" || placed.kind === "lighthouse" || placed.kind === "obelisk") {
    return (
      <mesh position={[0, h / 2, 0]} material={mat} castShadow receiveShadow>
        <cylinderGeometry args={[r * 0.55, r * 0.8, h, 12]} />
      </mesh>
    );
  }
  return (
    <mesh position={[0, h / 2, 0]} material={mat} castShadow receiveShadow>
      <boxGeometry args={[r * 1.4, h, r * 1.4]} />
    </mesh>
  );
}

export const Structure = memo(function Structure(props: StructureProps) {
  const { placed } = props;
  return (
    <group position={[placed.x, placed.y, placed.z]} rotation={[0, placed.rotation, 0]} name={`structure:${placed.id}`}>
      <Placeholder {...props} />
    </group>
  );
});

export function Structures({ list, opened }: { list: readonly Placed[]; opened?: ReadonlySet<string> }) {
  return (
    <>
      {list.map((p) => (
        <Structure key={p.id} placed={p} opened={opened?.has(p.id) ?? false} />
      ))}
    </>
  );
}

export function SpecialPiece({ special }: { special: Special }) {
  const mat = getWorldMaterial(special.kind === "quarry" ? "limestone" : "adobe");
  return (
    <mesh position={[special.x, special.y + 0.05, special.z]} rotation={[-Math.PI / 2, 0, special.rotation]} material={mat} receiveShadow>
      <planeGeometry args={[special.halfW * 2, special.halfD * 2]} />
    </mesh>
  );
}
