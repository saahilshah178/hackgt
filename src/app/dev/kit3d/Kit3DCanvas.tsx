"use client";

import { OrbitControls } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { SKY_MOODS, WEATHERS, type SkyMood, type Weather } from "@/contracts/world3d";
import { composeWorld, type Quality } from "@/world3d/core/compose";
import { SAMPLE_WORLDS } from "@/world3d/core/samples";
import { Humanoid } from "@/world3d/kit/characters/Humanoid";
import { CharacterGallery } from "@/world3d/kit/characters/gallery";
import { QUALITY } from "@/world3d/kit/quality";
import { StructureGallery } from "@/world3d/kit/structures/gallery";
import { WorldScene } from "@/world3d/kit/WorldScene";
import type { Kit3DGalleryProps } from "./Kit3DGallery";

/*
 * The /dev/kit3d canvas: a composed sample world (or a flat stage for the structure/character grids) inside the kit's
 * <WorldScene>, a named camera shot, orbit controls, and a perf overlay (fps, draw calls and triangles for the WHOLE
 * frame, post passes included) that hides with `shot=1` so screenshots are clean.
 */

/** Named camera shots for screenshots: position + target, derived from the composed world. */
function shotFor(cam: string, c: ReturnType<typeof composeWorld>): { pos: [number, number, number]; target: [number, number, number] } {
  const g = c.goal;
  const s = c.spawn;
  // free camera for QA: cam=px,py,pz,tx,ty,tz (metres)
  const nums = cam.split(",").map(Number);
  if (nums.length === 6 && nums.every(Number.isFinite)) return { pos: [nums[0], nums[1], nums[2]], target: [nums[3], nums[4], nums[5]] };
  if (cam === "aerial") return { pos: [c.hf.size * 0.45, c.hf.size * 0.42, c.hf.size * 0.55], target: [0, 0, 0] };
  if (cam === "goal" && g) return { pos: [g.x + g.radius * 1.6, g.y + g.height * 0.55, g.z + g.radius * 2.2], target: [g.x, g.y + g.height * 0.35, g.z] };
  // spawn: over the shoulder, looking toward the goal
  const tx = g ? g.x : 0;
  const tz = g ? g.z : 0;
  const d = Math.hypot(tx - s.x, tz - s.z) || 1;
  const bx = s.x - ((tx - s.x) / d) * 6;
  const bz = s.z - ((tz - s.z) / d) * 6;
  return { pos: [bx, s.y + 3.2, bz], target: [s.x + ((tx - s.x) / d) * 30, s.y + 4, s.z + ((tz - s.z) / d) * 30] };
}

/** A flat, empty stage for the component grids (structures, characters): same sky and light as the chosen world. */
function stageOf(base: (typeof SAMPLE_WORLDS)[string]) {
  return {
    ...base,
    terrain: { size: 320, relief: 0, features: [], water: { kind: "none" as const, level: 0, course: [], width: 10, coast: null } },
    landmarks: base.landmarks.filter((l) => l.role === "goal").map((l) => ({ ...l, at: { x: 140, z: -140 }, scale: 0.2 })),
    clusters: [],
    scatter: [],
    paths: [],
    wildlife: [],
    npcs: base.npcs.slice(0, 1).map((n) => ({ ...n, at: { x: 150, z: 150 } })),
    collectibles: { ...base.collectibles, items: [] },
    spawn: { at: { x: 0, z: 120 }, facing: 180 },
  };
}

interface PerfSample {
  fps: number;
  calls: number;
  triangles: number;
  textures: number;
  geometries: number;
}

/** Reads renderer.info for the whole previous frame (every pass), then resets it; runs before anything renders. */
function PerfProbe({ out }: { out: { current: PerfSample } }) {
  const acc = useRef({ frames: 0, time: 0 });
  useFrame((state, dt) => {
    const info = state.gl.info;
    info.autoReset = false;
    const a = acc.current;
    a.frames++;
    a.time += dt;
    if (a.time >= 0.5) {
      out.current.fps = a.frames / a.time;
      a.frames = 0;
      a.time = 0;
    }
    out.current.calls = info.render.calls;
    out.current.triangles = info.render.triangles;
    out.current.textures = info.memory.textures;
    out.current.geometries = info.memory.geometries;
    info.reset();
    // exposed for scripted QA (draw-call breakdowns); dev page only
    (window as unknown as { __kit3dScene?: unknown; __kit3dCamera?: unknown }).__kit3dScene = state.scene;
    (window as unknown as { __kit3dCamera?: unknown }).__kit3dCamera = state.camera;
  }, -1000);
  return null;
}

function PerfOverlay({ perf, label }: { perf: { current: PerfSample }; label: string }) {
  const el = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const id = window.setInterval(() => {
      const p = perf.current;
      if (el.current) el.current.textContent = `${label} · ${p.fps.toFixed(0)} fps · ${p.calls} draws · ${(p.triangles / 1000).toFixed(0)}k tris · ${p.textures} tex · ${p.geometries} geo`;
      // exposed for scripted perf runs (pnpm world3d:shot + page.evaluate)
      (window as unknown as { __kit3dPerf?: PerfSample }).__kit3dPerf = { ...p };
    }, 500);
    return () => window.clearInterval(id);
  }, [perf, label]);
  return (
    <div ref={el} data-testid="kit3d-perf" style={{ position: "absolute", top: 12, left: 12, padding: "8px 12px", background: "rgba(0,0,0,0.6)", color: "#fff", borderRadius: 8, fontSize: 14, fontVariantNumeric: "tabular-nums" }}>
      {label}
    </div>
  );
}

export function Kit3DCanvas({ world, mood, weather, quality, cam, shot, view, style, material, kind, anim }: Kit3DGalleryProps) {
  const tier = (["low", "medium", "high"].includes(quality) ? quality : "high") as Quality;
  const composed = useMemo(() => {
    const sample = SAMPLE_WORLDS[world] ?? SAMPLE_WORLDS.nile;
    const base = view === "structures" || view === "characters" ? stageOf(sample) : sample;
    const w = {
      ...base,
      atmosphere: {
        ...base.atmosphere,
        mood: (SKY_MOODS as readonly string[]).includes(mood ?? "") ? (mood as SkyMood) : base.atmosphere.mood,
        weather: (WEATHERS as readonly string[]).includes(weather ?? "") ? (weather as Weather) : base.atmosphere.weather,
      },
    };
    return composeWorld(w, { quality: tier });
  }, [world, mood, weather, tier, view]);
  const grid = view === "structures" || view === "characters";
  const shotView = grid
    ? view === "characters"
      ? { pos: [0, 2.2, 9] as [number, number, number], target: [0, 1, 0] as [number, number, number] }
      : { pos: [0, 90, 190] as [number, number, number], target: [0, 0, 60] as [number, number, number] }
    : shotFor(cam, composed);
  const perf = useRef<PerfSample>({ fps: 0, calls: 0, triangles: 0, textures: 0, geometries: 0 });
  const label = `${composed.world.setting.place} · ${composed.world.atmosphere.mood} · ${composed.world.atmosphere.weather} · ${tier} · fixes ${composed.fixes.length}`;
  return (
    <div style={{ position: "fixed", inset: 0, background: "#000" }} data-testid="kit3d">
      {/* screenshots: hide Next's dev-tools badge too */}
      {shot && <style>{`nextjs-portal{display:none!important}`}</style>}
      <Canvas
        shadows="percentage"
        dpr={QUALITY[tier].dpr}
        gl={{ antialias: tier !== "high", powerPreference: "high-performance", preserveDrawingBuffer: true }}
        camera={{ fov: 55, near: 0.2, far: 5000, position: shotView.pos }}
      >
        <PerfProbe out={perf} />
        <WorldScene composed={composed} quality={tier}>
          {view === "structures" && <StructureGallery style={style as never} material={material as never} kind={kind} />}
          {view === "characters" && <CharacterGallery anim={(anim ?? "all") as never} />}
          {!grid &&
            composed.world.npcs.map((n) => {
              const a = composed.npcs.find((x) => x.id === n.id)!;
              return (
                <group key={n.id} position={[a.x, a.y, a.z]} rotation={[0, a.facing, 0]}>
                  <Humanoid look={n.look} anim="idle" />
                </group>
              );
            })}
        </WorldScene>
        <OrbitControls target={shotView.target} makeDefault />
      </Canvas>
      {!shot && <PerfOverlay perf={perf} label={label} />}
    </div>
  );
}
