"use client";

import type { ReactNode } from "react";
import type { World3DSocket } from "../../../contracts/world3d";

/*
 * The challenge as a sheet at the right of the screen, skinned by the world's HUD theme (a papyrus header in Egypt,
 * glass on a moon base), while the camera frames the character or landmark in the open left part of the view. The
 * body is the shared ChallengePanel: the same lessons, widgets, hints and code grading as every other genre.
 */

const KICKER: Record<World3DSocket, string> = {
  conversation: "Conversation",
  inscription: "Inscription",
  artifact: "Artifact",
  device: "Instrument",
  vista: "Vista",
  seal: "Sealed way",
  finale: "The goal",
};

export function ChallengeSheet({ socket, place, objective, onClose, children }: { socket: World3DSocket; place: string; objective: string; onClose(): void; children: ReactNode }) {
  return (
    <aside className="w3-sheet w3-fade-in" aria-label={`${KICKER[socket]}: ${place}`} data-testid="w3-sheet">
      <div className="w3-sheet-head">
        <div>
          <p className="w3-kicker">
            {KICKER[socket]} · {place}
          </p>
          <h2>{objective}</h2>
        </div>
        <button type="button" className="w3-close" onClick={onClose} aria-label="Step away (Escape)">
          Step away
        </button>
      </div>
      <div className="w3-sheet-body">{children}</div>
    </aside>
  );
}
