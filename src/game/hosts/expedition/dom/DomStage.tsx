"use client";
/**
 * dom/DomStage.tsx (H1) — the reduced DOM fallback's zone (docs/design/20 §2.2, amendment 31): `<img>`/background
 * layers placed in world units inside one transformed world div (the host's rAF loop writes the camera transform and
 * the parallax offsets `translate(camX·(1 − factor), camY·(1 − factorY))`), the ground and platforms as SVG, props,
 * the hub, façades, plaques, pickups, blockers, and each station as a static Snapshot (dormant, or solved).
 */
import type { Zone } from "../../../../contracts/world";
import type { ResolvedWorld } from "../../../../world/types";
import type { SilBounds, SilTone } from "../contraptions/silhouettes";
import { Snapshot } from "../contraptions/Snapshot";
import type { SurfaceModel } from "../scene/surfaces";
import { heightAt } from "../scene/surfaces";
import { DEPTH } from "../scene/zone-builder";
import { domLayerAlpha } from "./layer-style";
import type { StubUrlCache } from "./stub-urls";

const TILE_PAD = 2600;

export interface DomStageProps {
  world: ResolvedWorld;
  zone: Zone;
  model: SurfaceModel;
  solved: ReadonlySet<string>;
  collected: ReadonlySet<string>;
  art: StubUrlCache;
  colors: { top: string; body: string; plat: string };
  /** biome tones for the stations' code-drawn silhouettes, and each station's frame bounds (w1a fix 5) */
  tones: Readonly<Record<SilTone, string>>;
  frames: ReadonlyMap<string, SilBounds | null>;
  registerLayer: (i: number, el: HTMLDivElement | null, meta: { set: string; sf: number; sfy: number; alpha: number }) => void;
  registerFacade: (id: string, el: HTMLImageElement | null) => void;
}

export function DomStage({ world, zone, model, solved, collected, art, colors, tones, frames, registerLayer, registerFacade }: DomStageProps) {
  const img = (key: string, x: number, y: number, z: number, extra: React.CSSProperties = {}, testId?: string) => {
    const s = art.spec(key);
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        key={`${key}@${x},${y}`}
        src={art.url(key)}
        alt=""
        data-testid={testId}
        draggable={false}
        style={{ position: "absolute", left: x - s.w * s.pivot[0], top: y - s.h * s.pivot[1], width: s.w, height: s.h, maxWidth: "none", zIndex: z, pointerEvents: "none", ...extra }}
      />
    );
  };
  const g = model.ground.points;
  const groundPath = `M ${g[0][0] - 400} ${zone.height + 600} L ${g[0][0] - 400} ${g[0][1]} ${g.map(([x, y]) => `L ${x} ${y}`).join(" ")} L ${g[g.length - 1][0] + 400} ${g[g.length - 1][1]} L ${g[g.length - 1][0] + 400} ${zone.height + 600} Z`;
  const topLine = g.map(([x, y]) => `${x},${y + 10}`).join(" ");
  let layerIndex = 0;
  return (
    <>
      {zone.layerSets.flatMap((ls) =>
        ls.layers.map((l) => {
          const i = layerIndex++;
          const s = art.spec(l.asset);
          const sf = l.scrollFactor;
          const sfy = l.scrollFactorY ?? l.scrollFactor;
          return (
            <div
              key={`layer:${ls.id}:${i}`}
              ref={(el) => registerLayer(i, el, { set: ls.id, sf, sfy, alpha: domLayerAlpha(l.blend, l.alpha) })}
              data-testid="dom-layer"
              style={{
                position: "absolute",
                left: -TILE_PAD,
                top: l.y,
                width: zone.width * Math.max(1, sf) + TILE_PAD * 2,
                height: s.h,
                backgroundImage: `url(${art.url(l.asset)})`,
                backgroundRepeat: l.repeatX ? "repeat-x" : "no-repeat",
                backgroundSize: `${s.w}px ${s.h}px`,
                // no mix-blend-mode: on these moving 13 000 px layers it cost ~30 fps (layer-style.ts); alpha stands in
                zIndex: Math.round(DEPTH[l.depth]),
                opacity: 0,
                pointerEvents: "none",
              }}
            />
          );
        }),
      )}
      <svg aria-hidden="true" width={zone.width} height={zone.height} style={{ position: "absolute", left: 0, top: 0, overflow: "visible", zIndex: DEPTH.ground, pointerEvents: "none" }}>
        <path d={groundPath} fill={colors.body} />
        <polyline points={topLine} fill="none" stroke={colors.top} strokeWidth={22} strokeLinejoin="round" />
        {[...model.platforms.values()].map((p) => (
          <polyline key={p.id} points={p.points.map(([x, y]) => `${x},${y + 9}`).join(" ")} fill="none" stroke={colors.plat} strokeWidth={18} strokeLinecap="round" />
        ))}
        {zone.links
          .filter((l) => l.kind === "ladder")
          .map((l) => {
            const y0 = heightAt(model, l.from.surface ?? "ground", l.from.x) ?? 0;
            const y1 = heightAt(model, l.to.surface ?? "ground", l.to.x) ?? 0;
            const x = (l.from.x + l.to.x) / 2;
            return <rect key={l.id} x={x - 18} y={Math.min(y0, y1) - 10} width={36} height={Math.abs(y1 - y0) + 10} fill="none" stroke={colors.plat} strokeWidth={6} strokeDasharray="6 28" />;
          })}
      </svg>
      {world.overlay.props
        .filter((p) => p.zoneId === zone.id)
        .map((p) => img(p.asset, p.x, p.y ?? heightAt(model, p.surface ?? "ground", p.x) ?? 0, p.layer === "L5_fore" ? DEPTH.L5_fore : p.layer === "L4_play" ? DEPTH.L4_play : DEPTH.L4_back, { opacity: p.layer === "L5_fore" ? 0.7 : 1, filter: p.restoredBy && !solved.has(p.restoredBy) ? "saturate(0.6)" : undefined }))}
      {zone.hub && img(zone.hub.asset, zone.hub.x, zone.hub.y ?? heightAt(model, "ground", zone.hub.x) ?? 0, DEPTH.L3_mid + 2, { filter: world.stations.some((s) => s.zoneId === zone.id && solved.has(s.encounterId)) ? undefined : "saturate(0.6)" })}
      {zone.interiors.map((it) => {
        const s = art.spec(it.facade);
        return (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={it.id} ref={(el) => registerFacade(it.id, el)} src={art.url(it.facade)} alt="" data-testid={`facade-${it.id}`} style={{ position: "absolute", left: it.facadeAt[0], top: it.facadeAt[1], width: s.w, height: s.h, maxWidth: "none", zIndex: DEPTH.facade, pointerEvents: "none" }} />
        );
      })}
      {world.overlay.plaques.filter((p) => p.zoneId === zone.id).map((p) => img(p.asset, p.x, heightAt(model, p.surface ?? "ground", p.x) ?? 0, DEPTH.L4_back + 2))}
      {world.overlay.collectibles
        .filter((c) => c.zoneId === zone.id && !collected.has(c.id))
        .map((c) => img(c.asset ?? `shared.fx.${c.kind}`, c.x, c.y ?? heightAt(model, c.surface ?? "ground", c.x) ?? 0, DEPTH.L4_play + 1))}
      {world.stations
        .filter((s) => s.zoneId === zone.id && s.payoff.blocker?.asset && !solved.has(s.encounterId))
        .map((s) => img(s.payoff.blocker?.asset ?? "", s.payoff.blocker?.x ?? 0, heightAt(model, s.payoff.blocker?.surface ?? "ground", s.payoff.blocker?.x ?? 0) ?? 0, DEPTH.blocker, {}, `blocker-${s.encounterId}`))}
      {world.stations
        .filter((s) => s.zoneId === zone.id)
        .map((s) => (
          <div key={s.encounterId} style={{ position: "absolute", left: s.anchor.x, top: s.anchor.y, zIndex: 60, willChange: "transform" }}>
            <Snapshot station={s} solved={solved.has(s.encounterId)} assetUrl={(k) => art.url(k)} scale={1} hasArt={(k) => art.hasArt(k)} tones={tones} frame={frames.get(s.encounterId) ?? null} />
          </div>
        ))}
      {world.stations
        .filter((s) => s.zoneId === zone.id)
        .map((s) => img(s.consoleAsset ?? (s.meta.skins.find((k) => k.id === s.skin)?.console ?? "shared.part.lectern_slate_console"), s.consoleX, heightAt(model, s.consoleSurface, s.consoleX) ?? 0, 61))}
      {world.sandboxes.filter((s) => s.zoneId === zone.id).map((s) => img(s.meta.skins.find((k) => k.id === s.skin)?.console ?? "shared.part.lectern_slate_console", s.consoleX, heightAt(model, s.surface, s.consoleX) ?? 0, 61))}
    </>
  );
}
