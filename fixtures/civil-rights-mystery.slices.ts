import type { BlueprintSlice } from "../src/contracts/slices";
import type { Slices } from "../src/pipeline/assemble";
import { getCard } from "../src/library";
import { historySlices } from "./civil-rights.slices";

/*
 * The civil-rights showcase re-skinned as a Mystery (LIBRARY §5, mystery column): same knowledge map,
 * intake, challenges, narrative and assessment; only the genre and the sockets change. This is what
 * "Regenerate as Mystery" produces in mock mode, and it is the P10 Mystery host's smoke fixture.
 */
const MYSTERY_SOCKET: Record<string, string> = {
  truth_finder: "cross_exam",
  sequencer: "corkboard",
  linker: "corkboard",
  sorter: "evidence",
  investigator: "corkboard",
  tuner: "lab",
  mapper: "conversation",
  function_world: "lab",
};

export const historyMysteryBlueprint: BlueprintSlice = {
  ...historySlices.blueprint,
  genre: "mystery",
  title: "The 1965 Files",
  theme: {
    setting: "A rain-soaked newspaper morgue where a retired editor's last case file waits to be reopened",
    tone: "noir, investigative, respectful of the people in the story",
    paletteId: "dusk",
    musicMood: "noir",
  },
  encounters: historySlices.blueprint.encounters.map((e) => {
    if (e.role === "boss") return { ...e, socket: "accusation" };
    const card = getCard(e.teachingMechanicId)!;
    return { ...e, socket: MYSTERY_SOCKET[card.family] ?? "conversation" };
  }),
};

export const historyMysterySlices: Slices = {
  ...historySlices,
  id: "history_mystery_001",
  createdAt: "2026-09-26T03:45:00.000Z",
  intake: { ...historySlices.intake, genre: "mystery" },
  blueprint: historyMysteryBlueprint,
};
