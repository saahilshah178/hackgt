"use client";

import { lazy, Suspense, useState } from "react";
import type { GameSpec } from "../../contracts/gamespec";
import type { World3D } from "../../contracts/world3d";
import { GenreClient } from "../genre/GenreClient";

/*
 * The door into a world3d game. The 3D client is heavy (three.js, the kit, the world), so it loads lazily and only
 * when the browser has WebGL 2; without it, or when a spec has no world yet, the same encounters play in the
 * Narrative adventure host, so a world3d game is always playable.
 */

const World3DClient = lazy(() => import("./World3DClient").then((m) => ({ default: m.World3DClient })));

function hasWebGL2(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return !!canvas.getContext("webgl2");
  } catch {
    return false;
  }
}

export default function World3DEntry({ spec }: { spec: GameSpec }) {
  const [webgl] = useState(() => typeof document !== "undefined" && hasWebGL2());
  if (!spec.world3d || !webgl) {
    return (
      <>
        <p role="note" style={{ margin: 0, padding: "8px 16px", background: "#2a2118", color: "#f6ead0", fontSize: 16 }}>
          {spec.world3d ? "This browser can't show 3D worlds (WebGL 2 is off), so this game plays as a story instead." : "This game's 3D world isn't ready, so it plays as a story instead."}
        </p>
        <GenreClient spec={{ ...spec, genre: "story" }} />
      </>
    );
  }
  return (
    <Suspense
      fallback={
        <div role="status" style={{ position: "fixed", inset: 0, display: "grid", placeItems: "center", background: "#0b0906", color: "#f3e7cf", fontSize: 18 }}>
          Loading the world…
        </div>
      }
    >
      <World3DClient spec={spec as GameSpec & { world3d: World3D }} />
    </Suspense>
  );
}
