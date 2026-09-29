"use client";

import type { ComposedWildlife } from "../../core/compose";

/*
 * Ambient creatures. API (stable): <Wildlife list playerPosition? onInteract? />. Ground animals wander around their
 * home on the heightfield (read it from useWorldKit().composed.hf), flocks circle, swarms hover, fish swim below the
 * surface. `playerPosition` (a ref-like getter) lets animals react (cats come closer, birds scatter). Interactive kinds
 * (WILDLIFE[kind].interactive) expose their live positions through `onPositions` so the host can offer "E · Pet the cat".
 * This file starts as a stub that renders nothing.
 */

export interface WildlifeProps {
  list: readonly ComposedWildlife[];
  playerPosition?: () => { x: number; y: number; z: number } | null;
  /** called every ~250 ms with the interactive animals' positions (id = `${kind}_${index}`) */
  onPositions?: (animals: { id: string; kind: ComposedWildlife["kind"]; x: number; y: number; z: number }[]) => void;
}

export function Wildlife(props: WildlifeProps) {
  void props;
  return null;
}
