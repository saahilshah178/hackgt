"use client";

import dynamic from "next/dynamic";
import type { GameSpec } from "@/contracts/gamespec";

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

export function PlayClient({ spec }: { spec: GameSpec }) {
  return <GameClient spec={spec} />;
}
