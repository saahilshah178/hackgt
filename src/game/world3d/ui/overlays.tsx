"use client";

import { useEffect, useRef, useState } from "react";
import type { GameSpec } from "../../../contracts/gamespec";
import type { ArchStyle, NpcLook, World3D } from "../../../contracts/world3d";
import type { Quality } from "../../../world3d/core/compose";
import { CLOTH_HEX } from "../../../world3d/kit/materials";
import type { MomentInfo } from "../model";
import { toRoman } from "./hud";

/*
 * Full-screen panels over the world: the opening title card (with a choice of how the player looks), the journal
 * (the story so far, relics with their facts, the people you've met), and the pause menu with settings. Each traps
 * nothing fancy: Escape closes, the first control takes focus, and the world stays visible behind a dimmed backdrop.
 */

export interface Settings {
  quality: Quality | "auto";
  sensitivity: number;
  invertY: boolean;
  textScale: number;
  reducedMotion: boolean;
  arrowsTurn: boolean;
  sound: boolean;
}

export const DEFAULT_SETTINGS: Settings = { quality: "auto", sensitivity: 1, invertY: false, textScale: 1, reducedMotion: false, arrowsTurn: false, sound: true };

/** Four player looks per architectural style: the apprentice/traveller of that world. */
export function playerLooks(style: ArchStyle): NpcLook[] {
  const base = (over: Partial<NpcLook>): NpcLook => ({ skin: "tone4", outfit: "tunic", color: "linen", accent: "ochre", headwear: "none", held: "none", height: 1, ...over });
  switch (style) {
    case "ancient_egypt":
      return [
        base({ skin: "tone5", outfit: "kilt", color: "linen", accent: "gold", headwear: "none", held: "scroll" }),
        base({ skin: "tone6", outfit: "dress", color: "linen", accent: "teal", headwear: "none", held: "tablet" }),
        base({ skin: "tone4", outfit: "robe", color: "cream", accent: "crimson", headwear: "scarf", held: "none" }),
        base({ skin: "tone7", outfit: "kilt", color: "linen", accent: "indigo", headwear: "headdress", held: "staff" }),
      ];
    case "classical":
      return [
        base({ skin: "tone3", outfit: "toga", color: "linen", accent: "crimson", headwear: "wreath" }),
        base({ skin: "tone4", outfit: "dress", color: "cream", accent: "sky" }),
        base({ skin: "tone5", outfit: "tunic", color: "terracotta", accent: "gold", held: "scroll" }),
        base({ skin: "tone2", outfit: "cloak", color: "indigo", accent: "gold" }),
      ];
    case "modern":
    case "futuristic":
    case "industrial":
      return [
        base({ skin: "tone3", outfit: "coat", color: "crimson", accent: "charcoal", headwear: "cap", held: "tablet" }),
        base({ skin: "tone6", outfit: "lab_coat", color: "linen", accent: "sky", held: "tablet" }),
        base({ skin: "tone2", outfit: "uniform", color: "sky", accent: "charcoal", headwear: style === "futuristic" ? "helmet" : "none" }),
        base({ skin: "tone8", outfit: "work_clothes", color: "ochre", accent: "charcoal", headwear: "hard_hat", held: "tool" }),
      ];
    default:
      return [
        base({ skin: "tone3", outfit: "tunic", color: "emerald", accent: "brown", headwear: "hood" }),
        base({ skin: "tone5", outfit: "dress", color: "indigo", accent: "cream" }),
        base({ skin: "tone2", outfit: "cloak", color: "crimson", accent: "gold", held: "staff" }),
        base({ skin: "tone7", outfit: "work_clothes", color: "olive", accent: "brown", headwear: "wide_hat", held: "lantern" }),
      ];
  }
}

export function IntroCard({
  spec,
  world,
  looks,
  look,
  onLook,
  onBegin,
  flying,
  onSkipFlight,
}: {
  spec: GameSpec;
  world: World3D;
  looks: readonly NpcLook[];
  look: number;
  onLook(i: number): void;
  onBegin(): void;
  flying: boolean;
  onSkipFlight(): void;
}) {
  const begin = useRef<HTMLButtonElement>(null);
  useEffect(() => begin.current?.focus({ preventScroll: true }), [flying]);
  if (flying) {
    // during the flyover: a lower third, so the world is the star
    return (
      <div className="w3-overlay is-clear is-flying" data-testid="w3-intro" data-flying="true">
        <div className="w3-lowerthird w3-fade-in">
          <div>
            <p className="w3-caption">{world.opening.caption}</p>
            <h1>{spec.title}</h1>
          </div>
          <button ref={begin} type="button" className="w3-cta is-ghost" style={{ color: "#fff", borderColor: "rgba(255,255,255,0.7)" }} onClick={onSkipFlight}>
            Skip ›
          </button>
        </div>
      </div>
    );
  }
  return (
    <div className="w3-overlay is-clear" data-testid="w3-intro">
      <div className="w3-card w3-intro w3-fade-in" role="dialog" aria-modal="true" aria-labelledby="w3-intro-title">
        <p className="w3-caption">{world.opening.caption}</p>
        <h1 id="w3-intro-title">{spec.title}</h1>
        <p className="w3-premise">{spec.premise}</p>
        <p className="w3-goalline">
          <span aria-hidden>▲</span> Your goal: {world.quest.goal.title}
        </p>
        <div className="w3-looks" role="group" aria-label="Choose how you look">
          {looks.map((l, i) => (
            <button
              key={i}
              type="button"
              className="w3-look"
              aria-pressed={i === look}
              aria-label={`Look ${i + 1}: ${l.outfit.replace("_", " ")}`}
              style={{ background: `linear-gradient(135deg, ${CLOTH_HEX[l.color]} 55%, ${CLOTH_HEX[l.accent]} 55%)` }}
              onClick={() => onLook(i)}
            />
          ))}
        </div>
        <div className="w3-intro-actions">
          <button ref={begin} type="button" className="w3-cta" onClick={onBegin} data-testid="w3-begin">
            Begin the journey
          </button>
        </div>
        <div className="w3-keys" aria-label="Controls">
          <span>
            <kbd>WASD</kbd> move
          </span>
          <span>
            <kbd>Shift</kbd> sprint
          </span>
          <span>
            <kbd>Space</kbd> jump
          </span>
          <span>
            <kbd>Drag</kbd> look around
          </span>
          <span>
            <kbd>E</kbd> talk · examine
          </span>
          <span>
            <kbd>G</kbd> field guide
          </span>
          <span>
            <kbd>M</kbd> map
          </span>
        </div>
      </div>
    </div>
  );
}

function useEscape(onClose: () => void, extraKey?: string) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || (extraKey && e.key.toLowerCase() === extraKey)) {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose, extraKey]);
}

export interface JournalData {
  acts: World3D["quest"]["acts"];
  moments: ReadonlyMap<string, MomentInfo>;
  solved: ReadonlySet<string>;
  available: ReadonlySet<string>;
  debrief: ReadonlyMap<string, string>;
  relics: { id: string; title: string; fact: string; found: boolean }[];
  relicLabel: string;
  people: { id: string; name: string; role: string; met: boolean; color: string }[];
}

export function Journal({ data, onClose }: { data: JournalData; onClose(): void }) {
  const [tab, setTab] = useState<"story" | "relics" | "people">("story");
  useEscape(onClose, "j");
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => close.current?.focus({ preventScroll: true }), []);
  return (
    <div className="w3-overlay" data-testid="w3-journal" onClick={onClose}>
      <div className="w3-card w3-panel-card w3-fade-in" role="dialog" aria-modal="true" aria-labelledby="w3-journal-title" onClick={(e) => e.stopPropagation()}>
        <header>
          <h2 id="w3-journal-title">Journal</h2>
          <button ref={close} type="button" className="w3-close" onClick={onClose}>
            Close <kbd aria-hidden>J</kbd>
          </button>
        </header>
        <div className="w3-tabs" role="tablist">
          {(["story", "relics", "people"] as const).map((t) => (
            <button key={t} type="button" role="tab" className="w3-tab" aria-selected={tab === t} onClick={() => setTab(t)}>
              {t === "story" ? "The story so far" : t === "relics" ? data.relicLabel : "People"}
            </button>
          ))}
        </div>
        <div className="w3-panel-body" role="tabpanel">
          {tab === "story" &&
            data.acts.map((act, i) => (
              <section key={act.id} className="w3-entry">
                <p className="w3-kicker">Act {toRoman(i + 1)}</p>
                <h3>{act.title}</h3>
                <p style={{ opacity: 0.85 }}>{act.summary}</p>
                <ul style={{ margin: "8px 0 0", paddingLeft: 20 }}>
                  {act.encounterIds.map((id) => {
                    const m = data.moments.get(id);
                    if (!m) return null;
                    const done = data.solved.has(id);
                    const open = data.available.has(id);
                    return (
                      <li key={id} style={{ opacity: done || open ? 1 : 0.55, margin: "4px 0" }}>
                        {done ? "✓ " : open ? "◆ " : "· "}
                        {done ? (data.debrief.get(id) ?? m.moment.objective) : open ? m.moment.objective : "Not yet discovered"}
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          {tab === "relics" &&
            (data.relics.length === 0 ? (
              <p>There are none in this world.</p>
            ) : (
              data.relics.map((r) => (
                <div key={r.id} className={`w3-entry${r.found ? "" : " is-locked"}`}>
                  <h3>{r.found ? r.title : "Not found yet"}</h3>
                  <p>{r.found ? r.fact : "Keep exploring: they glint in the light."}</p>
                </div>
              ))
            ))}
          {tab === "people" &&
            data.people.map((p) => (
              <div key={p.id} className={`w3-entry${p.met ? "" : " is-locked"}`} style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <span className="w3-portrait" style={{ background: p.color, width: 40, height: 40, fontSize: 18 }} aria-hidden>
                  {p.name[0]}
                </span>
                <div>
                  <h3>{p.met ? p.name : "Someone you haven't met"}</h3>
                  <p>{p.met ? p.role : "Explore to find them."}</p>
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

/** "Built by … · reviewed by …": the world's provenance in one line per source, for the pause menu. */
export function provenanceLines(p: World3D["provenance"]): string[] {
  if (!p) return [];
  const who = p.source === "astra" ? `Designed by the World Architect (${p.model ?? "Astra"})` : p.source === "fixture" ? "Hand-authored demo world" : "Composed by code from your game";
  const reviews = p.reviews.map((r) => {
    const mean = r.scores.length ? r.scores.reduce((a, b) => a + b.score, 0) / r.scores.length : 0;
    return `${r.critic === "story" ? "Story" : r.critic === "world" ? "World & UI" : "Vision"} critic: ${mean.toFixed(1)}/5${r.pass ? ", passed" : ", shipped with notes"}${r.rounds ? ` after ${r.rounds} revision${r.rounds === 1 ? "" : "s"}` : ""}`;
  });
  const fixes = p.fixes.length ? [`${p.fixes.length} placement fix${p.fixes.length === 1 ? "" : "es"} by code`] : [];
  return [who, ...reviews, ...fixes];
}

export function PauseMenu({ settings, onChange, onResume, onQuit, fps, about = [] }: { settings: Settings; onChange(s: Settings): void; onResume(): void; onQuit(): void; fps: number; about?: readonly string[] }) {
  useEscape(onResume);
  const first = useRef<HTMLButtonElement>(null);
  useEffect(() => first.current?.focus({ preventScroll: true }), []);
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => onChange({ ...settings, [k]: v });
  return (
    <div className="w3-overlay" data-testid="w3-pause" onClick={onResume}>
      <div className="w3-card w3-menu w3-fade-in" role="dialog" aria-modal="true" aria-labelledby="w3-pause-title" onClick={(e) => e.stopPropagation()}>
        <h2 id="w3-pause-title">Paused</h2>
        <button ref={first} type="button" className="w3-cta" onClick={onResume}>
          Resume
        </button>
        <label className="w3-setting">
          Graphics quality
          <select value={settings.quality} onChange={(e) => set("quality", e.target.value as Settings["quality"])}>
            <option value="auto">Auto</option>
            <option value="low">Low (fastest)</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </label>
        <label className="w3-setting">
          Mouse sensitivity
          <input type="range" min={0.3} max={2.5} step={0.1} value={settings.sensitivity} onChange={(e) => set("sensitivity", Number(e.target.value))} />
        </label>
        <label className="w3-setting">
          Text size
          <select value={settings.textScale} onChange={(e) => set("textScale", Number(e.target.value))}>
            <option value={1}>Normal</option>
            <option value={1.15}>Large</option>
            <option value={1.3}>Extra large</option>
          </select>
        </label>
        <label className="w3-setting">
          Invert camera up/down
          <input type="checkbox" checked={settings.invertY} onChange={(e) => set("invertY", e.target.checked)} />
        </label>
        <label className="w3-setting">
          Arrow keys turn the camera
          <input type="checkbox" checked={settings.arrowsTurn} onChange={(e) => set("arrowsTurn", e.target.checked)} />
        </label>
        <label className="w3-setting">
          Reduce motion
          <input type="checkbox" checked={settings.reducedMotion} onChange={(e) => set("reducedMotion", e.target.checked)} />
        </label>
        <label className="w3-setting">
          Sound
          <input type="checkbox" checked={settings.sound} onChange={(e) => set("sound", e.target.checked)} />
        </label>
        {about.length > 0 && (
          <details style={{ fontSize: 15, fontFamily: "var(--font-jakarta), sans-serif" }}>
            <summary style={{ cursor: "pointer", fontWeight: 700 }}>About this world</summary>
            <ul style={{ margin: "6px 0 0", paddingLeft: 18, lineHeight: 1.5 }} data-testid="w3-about">
              {about.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          </details>
        )}
        <p style={{ margin: "4px 0 0", fontSize: 14, opacity: 0.75, textAlign: "center", fontFamily: "var(--font-jakarta), sans-serif" }}>{fps > 0 ? `${fps} fps` : ""}</p>
        <button type="button" className="w3-cta is-ghost" onClick={onQuit}>
          Leave the game
        </button>
      </div>
    </div>
  );
}
