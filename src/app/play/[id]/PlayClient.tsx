"use client";

import dynamic from "next/dynamic";
import type { GameSpec } from "@/contracts/gamespec";
import type { WorldOverlay } from "@/contracts/world";
import type { WorldSource } from "@/world/types";

/*
 * Phaser is WebGL-only and must never touch the server, so the actual game client is loaded with
 * `ssr: false`. This file is the client boundary `next/dynamic` requires for that (a Server Component
 * cannot pass `ssr: false` itself).
 */
const GameClient = dynamic(() => import("@/game/GameClient").then((m) => m.GameClient), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-screen items-center justify-center text-lg" style={{ fontSize: 18 }}>
      Loading the game…
    </div>
  ),
});

/** `world`/`worldSource` come from the server's `loadWorldFor` (null: the legacy host); `sfx` is EXPEDITION_SFX ≠ off. */
export function PlayClient({ spec, world = null, worldSource = null, sfx = true }: { spec: GameSpec; world?: WorldOverlay | null; worldSource?: WorldSource | null; sfx?: boolean }) {
  return <GameClient spec={spec} world={world} worldSource={worldSource} sfx={sfx} />;
}
