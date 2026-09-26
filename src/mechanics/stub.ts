import { z } from "zod";
import type { KnowledgeType, Widget } from "../contracts/common";
import type { AnyFamilyMode } from "./types";

/**
 * A catalog-only mode: registered so cards can reference it (and the wishlist can show it), but the
 * Director never sees it because implemented is false. Replace with a real file in P4/P9.
 */
export function stubMode(def: {
  id: string;
  name: string;
  widget: Widget;
  knowledgeTypes: readonly KnowledgeType[];
  blindSolvable: boolean;
  directorBlurb: string;
}): AnyFamilyMode {
  return {
    ...def,
    implemented: false,
    authoringGuide: "TODO(overnight): this mode is catalog-only until its family lands.",
    paramsSchema: z.object({}),
    check: () => [`mode ${def.id} is not implemented`],
    resolve: () => {
      throw new Error(`mode ${def.id} is not implemented`);
    },
    templateVars: () => ({}),
    answerVars: [],
    present: () => ({}),
    grade: () => ({ correct: false, feedback: `mode ${def.id} is not implemented` }),
    solutionInput: () => ({}),
  };
}
