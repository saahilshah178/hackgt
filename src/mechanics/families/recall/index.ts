import { stubMode } from "../../stub";
import { defineFamily } from "../../types";

const s = (id: string, name: string, blurb: string, widget: "type" | "pick" | "place" = "type") =>
  stubMode({ id, name, widget, knowledgeTypes: ["fact"], blindSolvable: true, directorBlurb: blurb });

export const recall = defineFamily({
  id: "recall",
  name: "Recall",
  widgets: ["type", "pick"],
  knowledgeTypes: ["fact"],
  genres: {
    dungeon: { sockets: ["enemy"], skin: "Spells are flashcards, cooldowns are spacing" },
    mystery: { sockets: ["conversation"], skin: "Riddle-keeper interrogation" },
    platformer: { sockets: ["pickup"], skin: "Type the term to double-jump" },
    puzzle: { sockets: ["tile_board"], skin: "Timed word tiles" },
    strategy: { sockets: ["research_node"], skin: "Quick recall boosts research" },
  },
  modes: {
    rapid: s("rapid", "Rapid recall", "Accepted answers plus fuzzy matching; cooldowns follow spacing intervals."),
    cloze: s("cloze", "Cloze", "Fill a blank in a source sentence."),
    memory_palace: s("memory_palace", "Memory palace", "Items placed in rooms, recalled later.", "place"),
    listen: s("listen", "Listen", "An ElevenLabs TTS cue to identify.", "pick"),
    teach_back: s("teach_back", "Teach back", "An LLM-graded explanation that earns a bonus only (catalog-only)."),
  },
});
