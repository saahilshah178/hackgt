"use client";

import { useCallback } from "react";
import type { Npc } from "../../../contracts/world3d";
import type { SceneRefs } from "../scene/refs";
import { useStore } from "../store";

/*
 * Name tags and barks over the world's characters, as one plain DOM layer above the canvas. React renders what they
 * say (which changes rarely); the scene (scene/Npcs.tsx) moves each label to its npc's head every frame through the
 * `labels` registry, so a tag never lags the character and no React root is created inside the WebGL scene.
 */

export function NpcLabels({ refs, npcs, leads, hidden }: { refs: SceneRefs; npcs: readonly Npc[]; leads: ReadonlyMap<string, "lead" | "done">; hidden: boolean }) {
  const ui = useStore(refs.live, (s) => s.npcUi);
  const targetId = useStore(refs.live, (s) => (s.target?.kind === "npc" ? s.target.id : null));
  const register = useCallback(
    (id: string) => (el: HTMLDivElement | null) => {
      if (el) refs.labels.set(id, el);
      else refs.labels.delete(id);
    },
    [refs],
  );
  return (
    <div className="w3-labels" aria-hidden style={{ display: hidden ? "none" : undefined }}>
      {npcs.map((n) => {
        const state = ui[n.id];
        const lead = leads.get(n.id) === "lead";
        const show = lead || state?.near;
        return (
          <div key={n.id} ref={register(n.id)} className="w3-label" style={{ visibility: "hidden" }} data-testid={`npc-tag-${n.id}`}>
            {state?.bark && <div className="w3-bark w3-fade-in">{state.bark}</div>}
            <div className={`w3-nametag${targetId === n.id ? " is-target" : ""}${show ? "" : " is-hidden"}`}>
              {lead && (
                <span className="w3-nametag-mark" aria-hidden>
                  ◆
                </span>
              )}
              <span className="w3-nametag-name">{n.name}</span>
              {state?.near && <span className="w3-nametag-role">{n.role}</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
