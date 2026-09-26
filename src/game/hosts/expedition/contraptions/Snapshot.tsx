"use client";
/**
 * contraptions/Snapshot.tsx (H1) — the generic DOM snapshot of a station (docs/design/20 §2.5.5, amendment 31): the
 * skin's dormant parts (saturate 0.6) or solved parts (saturated, glow drop-shadow), positioned from the station
 * anchor. No per-prefab DOM code; animated behaviour is tested on the WebGL project.
 */
import type { SnapshotProps } from "./types";

export function Snapshot({ station, solved, assetUrl, scale }: SnapshotProps) {
  const skin = station.meta.skins.find((s) => s.id === station.skin) ?? station.meta.skins[0];
  const parts = skin ? (solved ? skin.snapshot.solved : skin.snapshot.dormant) : [];
  return (
    <div
      data-testid={`snapshot-${station.encounterId}`}
      data-solved={solved ? "true" : "false"}
      aria-label={`${station.objectNoun}${solved ? " (restored)" : ""}`}
      role="img"
      style={{ position: "absolute", left: 0, top: 0, width: 0, height: 0, filter: solved ? "drop-shadow(0 0 18px rgba(159,230,242,0.85))" : "saturate(0.6)" }}
    >
      {parts.map((p, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={`${p.asset}:${i}`}
          src={assetUrl(p.asset)}
          alt=""
          draggable={false}
          style={{
            position: "absolute",
            left: p.dx * scale,
            top: p.dy * scale,
            transform: `translate(-50%, -50%)${p.rotateDeg ? ` rotate(${p.rotateDeg}deg)` : ""}`,
            opacity: p.alpha ?? 1,
            maxWidth: "none", // Tailwind preflight caps images at the (zero-width) parent
            pointerEvents: "none",
          }}
        />
      ))}
    </div>
  );
}
