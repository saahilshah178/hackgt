import { defineFamily } from "../../types";
import { teachBack } from "./teach_back";

/**
 * explainer: progress by explaining the concept well. The player teaches a listener character in their own words;
 * a deterministic rubric (rubric.ts) checks the key ideas landed and no misconception was stated.
 */
export const explainer = defineFamily({
  id: "explainer",
  name: "Explainer",
  widgets: ["explain"],
  knowledgeTypes: ["causal", "system", "procedure", "argument", "category", "fact"],
  genres: {
    dungeon: { sockets: ["altar"], skin: "A spirit at the altar asks why; explain it well and the altar lights the way on" },
    mystery: { sockets: ["conversation", "cross_exam"], skin: "Walk a confused witness through what really happened until the story clicks" },
    platformer: { sockets: ["gate"], skin: "The gatekeeper opens only for someone who can explain it" },
    puzzle: { sockets: ["lock"], skin: "A talking lock turns one tumbler for each idea you explain" },
    strategy: { sockets: ["research_node"], skin: "Brief the council's apprentice; a clear explanation completes the research" },
    explorer: { sockets: ["shrine"], skin: "The shrine keeper listens; each idea you explain lights a lantern" },
    story: { sockets: ["dialogue", "debate"], skin: "Explain it to the character in your own words; convincing them moves the plot forward" },
  },
  modes: {
    teach_back: teachBack,
  },
});
