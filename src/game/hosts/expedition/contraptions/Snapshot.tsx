"use client";
/**
 * contraptions/Snapshot.tsx (H1, H3) — the generic DOM snapshot of a station (docs/design/20 §2.5.5, amendment 31): the
 * skin's dormant parts (saturate 0.6) or solved parts (saturated, glow drop-shadow), positioned from the station
 * anchor. No per-prefab DOM code; animated behaviour is tested on the WebGL project.
 *
 * H3 (w1a fix 5): when the host says which keys have built art (`hasArt`) and any of the skin's machine parts has
 * none yet, the snapshot draws the archetype's code-drawn SILHOUETTE instead (silhouettes.ts: one labelled machine
 * in the station's frame bounds, in biome tones), never one placeholder disc per missing part.
 */
import type { SnapshotProps } from "./types";
import { needsSilhouette, silhouetteFor, type SilBounds, type SilPrim, type SilTone } from "./silhouettes";

export interface SnapshotExtras {
  /** true when the manifest lists the key; omitted = draw the parts as images (the pre-H3 behaviour) */
  hasArt?: (key: string) => boolean;
  /** tone slot → "#rrggbb" (silhouetteTones(palette)) */
  tones?: Readonly<Record<SilTone, string>>;
  /** the meta's frameBounds for this station (anchor-relative world units) */
  frame?: SilBounds | null;
}

const FALLBACK_TONES: Readonly<Record<SilTone, string>> = { body: "#C69A6B", light: "#F2E6D4", shade: "#8C7B6B", trim: "#E8B658", dark: "#1B3150", glow: "#8FE0EA" };

function paint(tone: SilTone | null, tones: Readonly<Record<SilTone, string>>): string {
  return tone ? tones[tone] : "none";
}

function Prim({ p, tones }: { p: SilPrim; tones: Readonly<Record<SilTone, string>> }) {
  switch (p.p) {
    case "rect":
      return <rect x={p.x} y={p.y} width={p.w} height={p.h} rx={p.r} fill={paint(p.fill, tones)} stroke={paint(p.stroke, tones)} strokeWidth={p.sw} />;
    case "circle":
      return <circle cx={p.cx} cy={p.cy} r={p.r} fill={paint(p.fill, tones)} stroke={paint(p.stroke, tones)} strokeWidth={p.sw} />;
    case "line":
      return <line x1={p.x1} y1={p.y1} x2={p.x2} y2={p.y2} stroke={tones[p.stroke]} strokeWidth={p.sw} strokeLinecap="round" strokeDasharray={p.dash ? `${p.dash} ${p.dash}` : undefined} />;
    case "path":
      return <path d={p.d} fill={paint(p.fill, tones)} stroke={paint(p.stroke, tones)} strokeWidth={p.sw} strokeLinejoin="round" strokeLinecap="round" />;
  }
}

export function Snapshot({ station, solved, assetUrl, scale, hasArt, tones, frame }: SnapshotProps & SnapshotExtras) {
  const skin = station.meta.skins.find((s) => s.id === station.skin) ?? station.meta.skins[0];
  const parts = skin ? (solved ? skin.snapshot.solved : skin.snapshot.dormant) : [];
  const silhouette = needsSilhouette(parts, hasArt);
  const common = {
    "data-testid": `snapshot-${station.encounterId}`,
    "data-solved": solved ? "true" : "false",
    "data-stand-in": silhouette ? "silhouette" : "parts",
    "aria-label": `${station.objectNoun}${solved ? " (restored)" : ""}`,
    role: "img",
  } as const;
  const filter = solved ? "drop-shadow(0 0 18px rgba(159,230,242,0.85))" : "saturate(0.6)";

  if (silhouette) {
    const s = silhouetteFor(station.contraption, frame ?? null, station.objectNoun);
    const t = tones ?? FALLBACK_TONES;
    const pad = s.label.size * 2;
    const vb = { x: s.box.x - pad, y: s.box.y - pad, w: s.box.w + pad * 2, h: s.box.h + pad * 2 + s.label.size * 2 };
    return (
      <div {...common} style={{ position: "absolute", left: 0, top: 0, width: 0, height: 0, filter }}>
        <svg
          aria-hidden="true"
          width={vb.w * scale}
          height={vb.h * scale}
          viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
          style={{ position: "absolute", left: vb.x * scale, top: vb.y * scale, overflow: "visible", pointerEvents: "none", opacity: solved ? 1 : 0.92 }}
        >
          {s.prims.map((p, i) => (
            <Prim key={i} p={p} tones={t} />
          ))}
          <text
            x={s.label.x}
            y={s.label.y}
            textAnchor="middle"
            fontSize={s.label.size}
            fontWeight={700}
            letterSpacing="0.08em"
            fill="#FFFFFF"
            stroke={t.dark}
            strokeWidth={s.label.size * 0.22}
            paintOrder="stroke"
            style={{ textTransform: "uppercase", fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif" }}
          >
            {station.objectNoun}
          </text>
        </svg>
      </div>
    );
  }

  return (
    <div {...common} style={{ position: "absolute", left: 0, top: 0, width: 0, height: 0, filter }}>
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
