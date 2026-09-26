"use client";
/**
 * labels/WorldLabelLayer.tsx (H1) — the DOM world-text layer (docs/design/20 decision 7, §2.2): a pool of absolutely
 * positioned divs (chips, pins, the interact diamond + verb, NPC names, plaque titles, label_swap texts, emotes)
 * transformed from the LabelStore each requestAnimationFrame. It never re-renders React. `aria-hidden`: screen-reader
 * text lives in the dialogue and panel live regions. Projector floor: ≥ 20 px text, high contrast.
 */
import { useEffect, useRef } from "react";
import type { Label, LabelStore } from "./label-store";

const FN: Readonly<Record<string, string>> = { f: "#F5F8F8", g: "#6FD98E", h: "#4F92E6", accent: "#E2892C", gold: "#F6D27A" };

const BASE: Partial<CSSStyleDeclaration> = {
  position: "absolute",
  left: "0",
  top: "0",
  whiteSpace: "nowrap",
  pointerEvents: "none",
  willChange: "transform",
  color: "#FFFFFF",
  fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
  lineHeight: "1.15",
  textShadow: "0 1px 2px rgba(0,0,0,0.55)",
};
function styleFor(l: Label): Partial<CSSStyleDeclaration> {
  switch (l.kind) {
    case "chip":
      return { fontSize: "22px", fontWeight: "600", padding: "4px 10px", background: "rgba(15,42,51,0.88)", borderLeft: `4px solid ${FN[l.color ?? "f"] ?? "#F5F8F8"}`, borderRadius: "6px", fontVariantNumeric: "tabular-nums" };
    case "pin":
      return { fontSize: "20px", fontWeight: "600", padding: "2px 8px", background: "rgba(38,92,106,0.86)", borderRadius: "999px", border: "2px solid #FFFFFF" };
    case "interact":
      return { fontSize: "22px", fontWeight: "700", padding: "6px 12px", background: "rgba(15,42,51,0.9)", border: "2px solid #9FE6F2", borderRadius: "8px" };
    case "prompt":
      return { fontSize: "22px", fontWeight: "700", padding: "6px 12px", background: "rgba(226,137,44,0.92)", borderRadius: "8px" };
    case "npc_name":
      return { fontSize: "20px", fontWeight: "700", letterSpacing: "0.08em", textTransform: "uppercase", padding: "2px 8px", background: "rgba(15,42,51,0.7)", borderRadius: "4px" };
    case "plaque_title":
      return { fontSize: "22px", fontFamily: "Georgia, 'EB Garamond', serif", padding: "4px 10px", background: "rgba(15,42,51,0.85)", borderRadius: "4px" };
    case "label_swap":
    case "flap":
      return { fontSize: "20px", fontWeight: "700", letterSpacing: "0.06em", padding: "2px 8px", background: "rgba(27,49,80,0.9)", borderRadius: "3px", fontFamily: "ui-monospace, Menlo, monospace" };
    case "emote":
      return { fontSize: "40px", fontWeight: "800", color: "#F6D27A" };
  }
}
function textFor(l: Label): string {
  if (l.kind === "interact") return `◆ ${l.text}`;
  if (l.kind === "pin" && l.glyph) return l.text ? `${l.glyph} ${l.text}` : l.glyph;
  return l.text;
}

export function WorldLabelLayer({ store, className }: { store: LabelStore; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const nodes = new Map<string, { el: HTMLDivElement; key: string }>();
    let raf = 0;
    let lastVersion = -1;
    let lastView = "";
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const root = ref.current;
      if (!root) return;
      const v = store.view;
      const viewKey = `${v.viewX.toFixed(2)}|${v.viewY.toFixed(2)}|${v.zoom.toFixed(4)}|${store.hidden}`;
      if (store.version === lastVersion && viewKey === lastView) return;
      lastVersion = store.version;
      lastView = viewKey;
      const seen = new Set<string>();
      for (const l of store.hidden ? [] : store.all()) {
        seen.add(l.id);
        let node = nodes.get(l.id);
        const styleKey = `${l.kind}|${l.color ?? ""}|${l.glyph ?? ""}|${l.text}`;
        if (!node) {
          const el = document.createElement("div");
          Object.assign(el.style, BASE);
          if (l.kind === "interact") el.setAttribute("data-testid", "interact-prompt");
          el.dataset.kind = l.kind;
          root.appendChild(el);
          node = { el, key: "" };
          nodes.set(l.id, node);
        }
        if (node.key !== styleKey) {
          Object.assign(node.el.style, styleFor(l));
          node.el.textContent = textFor(l);
          node.key = styleKey;
        }
        const p = store.project(l);
        node.el.style.transform = `translate(${p.sx.toFixed(1)}px, ${p.sy.toFixed(1)}px) translate(-50%, -100%)`;
      }
      for (const [id, n] of nodes) {
        if (!seen.has(id)) {
          n.el.remove();
          nodes.delete(id);
        }
      }
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      for (const n of nodes.values()) n.el.remove();
      nodes.clear();
    };
  }, [store]);
  return <div ref={ref} aria-hidden="true" className={className} data-testid="world-labels" style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden", zIndex: 2 }} />;
}
