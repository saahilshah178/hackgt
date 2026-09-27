/**
 * scene/draw-count.ts (pure, H3) — the §2.11 "≤ 150 draw objects per zone" metric for `debug().drawObjects`. The
 * scene's display list holds Containers (every contraption, the zone's layer sets), so counting top-level children
 * hid most of what the GPU draws. This walks containers and counts the visible, non-transparent leaves.
 */
export interface DrawNode {
  visible?: boolean;
  alpha?: number;
  /** Phaser Containers (and Layers) expose their children as `list` */
  list?: readonly DrawNode[];
}

/** Visible leaves under `nodes` (a hidden or fully transparent container hides its subtree). */
export function countDrawn(nodes: readonly DrawNode[] | undefined): number {
  if (!nodes) return 0;
  let n = 0;
  for (const o of nodes) {
    if (o.visible === false || (typeof o.alpha === "number" && o.alpha <= 0)) continue;
    n += Array.isArray(o.list) ? countDrawn(o.list) : 1;
  }
  return n;
}
