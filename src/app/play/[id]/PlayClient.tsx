"use client";

import dynamic from "next/dynamic";
import { useCallback, useMemo, useState } from "react";
import type { GameSpec } from "@/contracts/gamespec";
import type { WorldOverlay } from "@/contracts/world";
import { TrigTutorial } from "@/game/expedition/client/TrigTutorial";
import { TutorialContext, useTutorial } from "@/game/expedition/client/tutorial-context";
import type { WorldSource } from "@/world/types";

/*
 * Phaser is WebGL-only and must never touch the server, so the actual game client is loaded with
 * `ssr: false`. This file is the client boundary `next/dynamic` requires for that (a Server Component
 * cannot pass `ssr: false` itself).
 */
function GameLoading() {
  const { open } = useTutorial();
  if (open) return null;
  return (
    <div className="flex min-h-screen items-center justify-center text-lg" style={{ fontSize: 18 }}>
      Loading the game…
    </div>
  );
}

const GameClient = dynamic(() => import("@/game/GameClient").then((m) => m.GameClient), {
  ssr: false,
  loading: () => <GameLoading />,
});

/**
 * `world`/`worldSource` come from the server's `loadWorldFor` (null: the legacy host); `sfx` is EXPEDITION_SFX ≠ off.
 * `tutorial` opens the Clockwork Crypt how-to-play card. Other games leave it off.
 */
export function PlayClient({
  spec,
  world = null,
  worldSource = null,
  sfx = true,
  tutorial = false,
}: {
  spec: GameSpec;
  world?: WorldOverlay | null;
  worldSource?: WorldSource | null;
  sfx?: boolean;
  tutorial?: boolean;
}) {
  const [open, setOpen] = useState(tutorial && !!world);
  const close = useCallback(() => setOpen(false), []);
  const gate = useMemo(() => ({ open, close }), [open, close]);
  return (
    <TutorialContext.Provider value={gate}>
      <GameClient spec={spec} world={world} worldSource={worldSource} sfx={sfx} />
      {open && world ? <TrigTutorial title={world.title} goal={world.story.logline} onClose={close} /> : null}
    </TutorialContext.Provider>
  );
}
