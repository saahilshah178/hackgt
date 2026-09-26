"use client";

import { useId } from "react";
import type { CardModel } from "@/world/types";
import { useElementSize } from "../metrics";
import { CardFrame, FN_VAR } from "./CardFrame";

export type SchematicCardModel = Extract<CardModel, { kind: "schematic" }>;

/** SchematicCard (§3.2): draws SchematicPrim[] (pump cross-section, span socket row, membrane fold) in its viewBox. */
export function SchematicCard({ model }: { model: SchematicCardModel }) {
  const [ref, size] = useElementSize<HTMLDivElement>({ w: 640, h: 220 });
  const uid = useId().replace(/:/g, "");
  const [vw, vh] = model.viewBox;
  const pad = 16;
  const scale = Math.max(0.05, Math.min((size.w - 2 * pad) / Math.max(1, vw), (size.h - 2 * pad) / Math.max(1, vh)));
  const minText = 18 / scale; // text prims never render below the 18 px floor
  return (
    <CardFrame ref={ref} kind="schematic" tab={model.title}>
      {size.measured ? (
      <svg role="img" aria-labelledby={`${uid}-t ${uid}-d`} width={size.w} height={size.h} viewBox={`${-pad / scale} ${-pad / scale} ${size.w / scale} ${size.h / scale}`} focusable="false">
          <title id={`${uid}-t`}>{model.title}</title>
          <desc id={`${uid}-d`}>{model.sr}</desc>
          <g aria-hidden>
            {model.prims.map((p, i) => {
              const c = FN_VAR[p.color];
              switch (p.p) {
                case "line":
                  return <line key={i} x1={p.x1} y1={p.y1} x2={p.x2} y2={p.y2} stroke={c} strokeWidth={p.w} strokeDasharray={p.dash ? `${p.w * 3} ${p.w * 2}` : undefined} strokeLinecap="round" />;
                case "poly":
                  return <polygon key={i} points={p.points.map(([x, y]) => `${x},${y}`).join(" ")} fill={p.fill ? c : "none"} fillOpacity={p.fill ? 0.35 : undefined} stroke={c} strokeWidth={p.w} strokeLinejoin="round" />;
                case "circle":
                  return <circle key={i} cx={p.cx} cy={p.cy} r={p.r} fill={p.fill ? c : "none"} stroke={c} strokeWidth={2 / scale} />;
                case "arc": {
                  const x0 = p.cx + p.r * Math.cos(p.a0);
                  const y0 = p.cy - p.r * Math.sin(p.a0);
                  const x1 = p.cx + p.r * Math.cos(p.a1);
                  const y1 = p.cy - p.r * Math.sin(p.a1);
                  const large = Math.abs(p.a1 - p.a0) > Math.PI ? 1 : 0;
                  return <path key={i} d={`M${x0} ${y0} A ${p.r} ${p.r} 0 ${large} ${p.a1 > p.a0 ? 0 : 1} ${x1} ${y1}`} fill="none" stroke={c} strokeWidth={p.w} strokeLinecap="round" />;
                }
                case "rect":
                  return <rect key={i} x={p.x} y={p.y} width={p.w} height={p.h} fill={p.fill ? c : "none"} fillOpacity={p.fill ? 0.35 : undefined} stroke={c} strokeWidth={2 / scale} />;
                case "text":
                  return (
                    <text key={i} className="xp-svg-text" x={p.x} y={p.y} fontSize={Math.max(p.size, minText)} textAnchor={p.anchor} fill={c}>
                      {p.text}
                    </text>
                  );
              }
            })}
          </g>
        </svg>
      ) : null}
    </CardFrame>
  );
}
