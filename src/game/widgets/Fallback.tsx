"use client";

import { Button } from "@/components/ui/button";
import type { GameDebugHandle } from "../debug";
import type { WidgetProps } from "./Dial";

/**
 * The "never crash" backstop (reviewer finding C1). Rendered by widgetFor() (src/game/widgets/registry.ts)
 * whenever the mode's `widget` component reports `supports(view) === false` for the shape it was actually
 * given, or when the widget id itself isn't registered. Visible, keyboard-reachable, and lets a live game
 * always continue: Skip calls the host's autoSolve path (window.__GAME_DEBUG__.autoSolve()), the same hook
 * play-smoke's debug harness drives.
 */
export function Fallback({ modeLabel }: WidgetProps<unknown, unknown> & { modeLabel?: string }) {
  const skip = () => {
    if (typeof window === "undefined") return;
    const handle = (window as Window & { __GAME_DEBUG__?: GameDebugHandle }).__GAME_DEBUG__;
    handle?.autoSolve();
  };

  return (
    <div
      className="flex flex-col items-start gap-4 rounded-lg border-2 border-dashed p-4"
      data-testid="widget-fallback"
      role="alert"
    >
      <p className="text-lg font-medium" style={{ fontSize: 18 }}>
        This mechanic&apos;s widget isn&apos;t built yet{modeLabel ? ` (${modeLabel})` : ""}.
      </p>
      <p className="text-base opacity-80" style={{ fontSize: 16 }}>
        Nothing is lost — skip ahead and the run keeps going.
      </p>
      <Button size="lg" autoFocus onClick={skip} data-testid="widget-fallback-skip">
        Skip
      </Button>
    </div>
  );
}

/** Fallback always "supports" anything; it is the catch-all, never itself the thing that's checked. */
export function supports(): boolean {
  return true;
}
