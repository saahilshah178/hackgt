"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import type { KeyboardInput } from "../input";

/*
 * Touch play for tablets (classrooms use them): a virtual joystick at the bottom left feeds the same input as WASD
 * (pushing it to the rim sprints), and an action button stands in for E. Looking around is a drag anywhere on the
 * world, which the camera rig already handles through pointer events. Shown only on coarse pointers.
 */

const coarse = () => typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;
const noop = () => () => {};

export function TouchControls({ input, onAction, actionLabel }: { input: KeyboardInput; onAction(): void; actionLabel: string | null }) {
  const touch = useSyncExternalStore(noop, coarse, () => false);
  const base = useRef<HTMLDivElement>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const pointer = useRef<number | null>(null);
  if (!touch) return null;
  const R = 56;
  const move = (e: React.PointerEvent) => {
    const rect = base.current?.getBoundingClientRect();
    if (!rect) return;
    let dx = e.clientX - (rect.left + rect.width / 2);
    let dy = e.clientY - (rect.top + rect.height / 2);
    const len = Math.hypot(dx, dy);
    if (len > R) {
      dx = (dx / len) * R;
      dy = (dy / len) * R;
    }
    setKnob({ x: dx, y: dy });
    input.virtual = { forward: -dy / R, right: dx / R, sprint: len > R * 0.95 };
  };
  const release = () => {
    pointer.current = null;
    setKnob({ x: 0, y: 0 });
    input.virtual = { forward: 0, right: 0, sprint: false };
  };
  return (
    <>
      <div
        ref={base}
        className="w3-stick"
        aria-label="Move"
        onPointerDown={(e) => {
          pointer.current = e.pointerId;
          e.currentTarget.setPointerCapture(e.pointerId);
          move(e);
        }}
        onPointerMove={(e) => pointer.current === e.pointerId && move(e)}
        onPointerUp={release}
        onPointerCancel={release}
      >
        <span className="w3-stick-knob" style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }} />
      </div>
      {actionLabel && (
        <button type="button" className="w3-action" onClick={onAction} aria-label={actionLabel}>
          <span>{actionLabel}</span>
        </button>
      )}
    </>
  );
}
