"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { DomHost } from "./dom/DomHost";
import { MysteryHost } from "./mystery/MysteryHost";
import type { HostHandle, HostProps } from "./types";

function webglAvailable(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return !!(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

/**
 * Boots the Phaser Dungeon host when WebGL is available, otherwise (or on any boot failure) renders
 * the DOM fallback host. Both paths expose the same HostHandle, so GameClient never needs to know
 * which one is live (MEGAPROMPT P3.6).
 */
export const PlayHost = forwardRef<HostHandle, HostProps>(function PlayHost(props, ref) {
  const { spec } = props;
  const isDungeon = spec.genre === "dungeon";
  const isPlatformer = spec.genre === "platformer";
  const isPhaserGenre = isDungeon || isPlatformer;
  const sceneKey = isPlatformer ? "PlatformerScene" : "DungeonScene";
  const [mode, setMode] = useState<"checking" | "phaser" | "dom">("checking");
  const gameRef = useRef<import("phaser").Game | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const bridgeRef = useRef<HostHandle | null>(null);
  // Fallback host handle: the DOM host for dungeon (no WebGL) or an unimplemented genre, or the
  // Mystery host for genre "mystery". Named generically because which component it points at
  // depends on `spec.genre`, decided in the render below.
  const fallbackRef = useRef<HostHandle | null>(null);
  const propsRef = useRef(props);
  propsRef.current = props;

  useEffect(() => {
    // Dungeon and Platformer boot Phaser (LIBRARY §1: mystery is "mostly UI"; puzzle/strategy aren't
    // built yet). Every other genre goes straight to a DOM fallback host.
    if (!isPhaserGenre) {
      setMode("dom");
      return;
    }
    if (!webglAvailable()) {
      setMode("dom");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [{ default: Phaser }, sceneModule] = await Promise.all([
          import("phaser"),
          isPlatformer ? import("./platformer/PlatformerScene") : import("./dungeon/DungeonScene"),
        ]);
        if (cancelled || !containerRef.current) return;
        const SceneClass = isPlatformer
          ? (sceneModule as typeof import("./platformer/PlatformerScene")).createPlatformerScene(Phaser)
          : (sceneModule as typeof import("./dungeon/DungeonScene")).createDungeonScene(Phaser);
        const game = new Phaser.Game({
          type: Phaser.WEBGL,
          width: 800,
          height: 480,
          parent: containerRef.current,
          backgroundColor: "#000000",
          physics: isPlatformer ? { default: "arcade", arcade: { gravity: { x: 0, y: 1500 }, debug: false } } : undefined,
          scene: [SceneClass],
        });
        const canvas = game.canvas;
        if (!canvas || !(canvas.getContext("webgl2") ?? canvas.getContext("webgl"))) {
          game.destroy(true);
          if (!cancelled) setMode("dom");
          return;
        }
        gameRef.current = game;
        game.scene.start(sceneKey, {
          rooms: propsRef.current.rooms,
          palette: propsRef.current.palette,
          onReachSocket: (id: string) => propsRef.current.onReachSocket(id),
          onReady: (bridge: HostHandle & { playerX?: () => number }) => {
            bridgeRef.current = bridge;
            // P10.2 e2e hook: window.__GAME_DEBUG__ (src/game/debug.ts, owned by GameClient) has no
            // "host" field, so we attach one directly here rather than editing files outside our
            // paths. Purely additive; every other genre's debug handle is untouched.
            if (isPlatformer && typeof bridge.playerX === "function" && typeof window !== "undefined") {
              const w = window as unknown as { __GAME_DEBUG__?: { host?: { playerX: () => number } } };
              if (w.__GAME_DEBUG__) w.__GAME_DEBUG__.host = { playerX: bridge.playerX };
            }
          },
        });
        if (!cancelled) setMode("phaser");
      } catch (err) {
        console.error("Phaser failed to boot; falling back to the DOM host.", err);
        gameRef.current?.destroy(true);
        gameRef.current = null;
        if (!cancelled) setMode("dom");
      }
    })();
    return () => {
      cancelled = true;
      gameRef.current?.destroy(true);
      gameRef.current = null;
    };
    // isPhaserGenre/isPlatformer/sceneKey derive from spec.genre, which never changes for a mounted
    // GameClient; propsRef.current is read live inside the async body for everything else.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the live Phaser scene's "frozen" flag in sync without re-booting the game.
  useEffect(() => {
    const scene = gameRef.current?.scene.getScene(sceneKey) as { setFrozen?: (v: boolean) => void } | null;
    scene?.setFrozen?.(props.frozen);
  }, [props.frozen, sceneKey]);

  useImperativeHandle(ref, () => ({
    warpTo(encounterId) {
      if (mode === "phaser") bridgeRef.current?.warpTo(encounterId);
      else fallbackRef.current?.warpTo(encounterId);
    },
    setLiveValue(value) {
      if (mode === "phaser") bridgeRef.current?.setLiveValue?.(value);
      else fallbackRef.current?.setLiveValue?.(value);
    },
    celebrate(encounterMode) {
      if (mode === "phaser") bridgeRef.current?.celebrate?.(encounterMode);
      else fallbackRef.current?.celebrate?.(encounterMode);
    },
  }));

  if (!isPhaserGenre) {
    // Mystery and every genre without a Phaser host never attempt to boot Phaser at all.
    if (spec.genre === "mystery") return <MysteryHost ref={fallbackRef} {...props} />;
    // Genre host not built yet (puzzle/strategy): play as a DOM room strip, clearly labeled.
    return (
      <div className="flex flex-col gap-2">
        <div
          role="status"
          data-testid="unimplemented-genre-banner"
          className="rounded-lg border-2 border-dashed p-2 text-center text-base"
          style={{ fontSize: 16 }}
        >
          This genre&apos;s host isn&apos;t built yet; playing as a room strip.
        </div>
        <DomHost ref={fallbackRef} {...props} />
      </div>
    );
  }

  if (mode === "dom") return <DomHost ref={fallbackRef} {...props} />;
  return (
    <div className="flex flex-col gap-2">
      <div ref={containerRef} data-testid="phaser-host" className="mx-auto overflow-hidden rounded-xl" style={{ width: 800, height: 480 }} />
      {mode === "checking" && <p className="text-center text-sm opacity-70">Loading the crypt…</p>}
    </div>
  );
});
