"use client";

import { useEffect, useState } from "react";
import type { MomentInfo } from "../model";
import { bearing } from "../model";
import { useStore, type Live, type Store } from "../store";

/*
 * The heads-up display over the 3D view: a compass with the goal and every open lead, the quest tracker (goal, act,
 * progress, nearest leads with direction and distance), the "E ·" interaction prompt, toasts and a first-minute
 * controls hint. Every piece reads the live store through a selector, so the HUD updates at the store's ~12 Hz.
 */

export interface CompassMark {
  id: string;
  label: string;
  x: number;
  z: number;
  goal?: boolean;
}

const TICKS = [
  { a: 0, t: "N", major: true },
  { a: 45, t: "NE" },
  { a: 90, t: "E", major: true },
  { a: 135, t: "SE" },
  { a: 180, t: "S", major: true },
  { a: 225, t: "SW" },
  { a: 270, t: "W", major: true },
  { a: 315, t: "NW" },
];

/** Where a bearing lands on the compass strip (0..1), or null when it is behind the camera. */
function stripPos(bear: number, heading: number, fov = Math.PI * 0.9): number | null {
  const d = Math.atan2(Math.sin(bear - heading), Math.cos(bear - heading));
  if (Math.abs(d) > fov / 2) return null;
  return 0.5 + d / fov;
}

export function Compass({ live, marks }: { live: Store<Live>; marks: readonly CompassMark[] }) {
  const cam = useStore(live, (s) => s.cameraYaw);
  const px = useStore(live, (s) => Math.round(s.player.x));
  const pz = useStore(live, (s) => Math.round(s.player.z));
  // camera yaw is the view direction in three.js terms (0 = +z = south); compass bearing 0 = north
  const heading = Math.atan2(Math.sin(cam), -Math.cos(cam));
  return (
    <div className="w3-compass w3-chip" role="img" aria-label="Compass" data-testid="w3-compass">
      <div className="w3-compass-track">
        {TICKS.map((t) => {
          const pos = stripPos((t.a * Math.PI) / 180, heading);
          return pos === null ? null : (
            <span key={t.t} className={`w3-compass-tick${t.major ? " is-major" : ""}`} style={{ left: `${pos * 100}%` }}>
              {t.t}
            </span>
          );
        })}
        {marks.map((m) => {
          const pos = stripPos(bearing({ x: px, z: pz }, m), heading);
          if (pos === null) return null;
          const dist = Math.round(Math.hypot(m.x - px, m.z - pz));
          return (
            <span key={m.id} className={`w3-compass-mark${m.goal ? " is-goal" : ""}`} style={{ left: `${pos * 100}%` }}>
              <span aria-hidden>{m.goal ? "▲" : "◆"}</span>
              {dist > 12 ? `${dist} m` : ""}
            </span>
          );
        })}
      </div>
      <span className="w3-compass-center" aria-hidden />
    </div>
  );
}

function Arrow({ angle }: { angle: number }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" style={{ transform: `rotate(${angle}rad)` }} aria-hidden>
      <path d="M12 3 L19 20 L12 16 L5 20 Z" fill="currentColor" />
    </svg>
  );
}

export function QuestTracker({
  live,
  goal,
  act,
  leads,
  solved,
  total,
  relics,
  goalAt,
}: {
  live: Store<Live>;
  goal: { title: string; ready: boolean };
  act: { index: number; title: string; count: number };
  leads: readonly MomentInfo[];
  solved: number;
  total: number;
  relics: { found: number; total: number; label: string };
  goalAt: { x: number; z: number } | null;
}) {
  const px = useStore(live, (s) => Math.round(s.player.x * 2) / 2);
  const pz = useStore(live, (s) => Math.round(s.player.z * 2) / 2);
  const cam = useStore(live, (s) => Math.round(s.cameraYaw * 20) / 20);
  const heading = Math.atan2(Math.sin(cam), -Math.cos(cam));
  const rel = (to: { x: number; z: number }) => bearing({ x: px, z: pz }, to) - heading;
  const gap = (m: MomentInfo) => Math.max(0, Math.hypot(m.x - px, m.z - pz) - m.radius);
  // current act first, then nearest
  const shown = [...leads].sort((a, b) => (a.actIndex === act.index ? 0 : 1) - (b.actIndex === act.index ? 0 : 1) || gap(a) - gap(b)).slice(0, 3);
  return (
    <section className="w3-tracker w3-chip" aria-label="Quest" data-testid="w3-tracker">
      <div>
        <p className="w3-kicker">
          Act {toRoman(act.index + 1)} of {toRoman(act.count)} · {act.title}
        </p>
        <p className="w3-goal-title w3-heading">{goal.title}</p>
      </div>
      <div className="w3-progress" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={solved} aria-label="Challenges solved">
        <span style={{ width: `${(100 * solved) / Math.max(1, total)}%` }} />
      </div>
      <ul className="w3-leads" data-testid="w3-leads">
        {goal.ready && goalAt ? (
          <li className="w3-lead is-goal">
            <span className="w3-lead-arrow">
              <Arrow angle={rel(goalAt)} />
            </span>
            <span>Go to the goal: {goal.title}</span>
            <span className="w3-lead-dist">{Math.round(Math.hypot(goalAt.x - px, goalAt.z - pz))} m</span>
          </li>
        ) : null}
        {shown.map((m) => (
          <li key={m.encounterId} className="w3-lead" data-encounter={m.encounterId}>
            <span className="w3-lead-arrow">
              <Arrow angle={rel(m)} />
            </span>
            <span>{m.moment.objective}</span>
            <span className="w3-lead-dist">{Math.round(gap(m))} m</span>
          </li>
        ))}
        {leads.length > shown.length && <li className="w3-lead-dist">+{leads.length - shown.length} more in the journal (J)</li>}
      </ul>
      <div className="w3-tracker-foot">
        <span>
          {solved} / {total} solved
        </span>
        {relics.total > 0 && (
          <span>
            {relics.label}: {relics.found}/{relics.total}
          </span>
        )}
      </div>
    </section>
  );
}

export function InteractPrompt({ live }: { live: Store<Live> }) {
  const label = useStore(live, (s) => s.target?.label ?? null);
  if (!label) return null;
  return (
    <div className="w3-prompt w3-chip w3-fade-in" role="status" data-testid="w3-prompt">
      <kbd aria-hidden>E</kbd>
      <span>{label}</span>
    </div>
  );
}

export interface Toast {
  id: number;
  icon: string;
  title: string;
  text: string;
}

export function Toasts({ toasts }: { toasts: readonly Toast[] }) {
  return (
    <div className="w3-toasts" aria-live="polite" data-testid="w3-toasts">
      {toasts.map((t) => (
        <div key={t.id} className="w3-toast w3-chip w3-fade-in">
          <span className="w3-toast-icon" aria-hidden>
            {t.icon}
          </span>
          <div>
            <strong>{t.title}</strong>
            <span>{t.text}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

/** The controls, shown for the first 40 s of play (and whenever the player hasn't moved yet). */
export function ControlsHint({ live }: { live: Store<Live> }) {
  const [visible, setVisible] = useState(true);
  const start = useStore(live, (s) => Math.round(s.player.x) * 1000 + Math.round(s.player.z));
  const [origin] = useState(start);
  useEffect(() => {
    const t = setTimeout(() => setVisible(false), 40_000);
    return () => clearTimeout(t);
  }, []);
  if (!visible && start !== origin) return null;
  return (
    <div className="w3-controls w3-chip w3-fade-in" aria-label="Controls">
      <span>
        <kbd>W A S D</kbd>move
      </span>
      <span>
        <kbd>Shift</kbd>sprint
      </span>
      <span>
        <kbd>Space</kbd>jump
      </span>
      <span>
        <kbd>Drag</kbd>look
      </span>
      <span>
        <kbd>E</kbd>interact
      </span>
      <span>
        <kbd>G</kbd>guide
      </span>
      <span>
        <kbd>J</kbd>journal
      </span>
      <span>
        <kbd>M</kbd>map
      </span>
    </div>
  );
}

export function toRoman(n: number): string {
  return ["", "I", "II", "III", "IV", "V", "VI"][n] ?? String(n);
}
