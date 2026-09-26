import { z } from "zod";
import { defineMode } from "../../types";
import { seededShuffle } from "../../util";

/*
 * transformer · encode: translate tokens through a lookup table (codon → amino acid, cipher, base
 * conversion, complementary bases). The model writes the table and the input tokens; code computes
 * the output and grades position by position. Cards: protein_factory ★, genome_repair, rna_assembly,
 * cipher_door.
 */

const Params = z.object({
  tableName: z.string().describe('What the table is, e.g. "codon table (mRNA codon → amino acid)"'),
  table: z
    .array(z.object({ from: z.string().describe("input token"), to: z.string().describe("output token") }))
    .min(2)
    .max(64)
    .describe("The lookup. `from` tokens must be unique. Include every token the input uses plus a few distractors"),
  input: z.array(z.string()).min(2).max(12).describe("The tokens to translate, in order; every one must appear as a `from` in the table"),
  direction: z.enum(["forward", "reverse"]).describe("forward: from → to. reverse: the player decodes to → from (then `to` values must be unique)"),
  tokenLabel: z.string().describe('Singular noun for input tokens, e.g. "codon"'),
  outputLabel: z.string().describe('Singular noun for output tokens, e.g. "amino acid"'),
  showTable: z.boolean().describe("true: the table is visible (using it IS the concept). false: recall from memory"),
});
type Params = z.infer<typeof Params>;

interface Solution {
  output: string[];
}
interface Input {
  output: string[];
}
interface View {
  tableName: string;
  table: { from: string; to: string }[];
  input: string[];
  direction: "forward" | "reverse";
  tokenLabel: string;
  outputLabel: string;
  /** every possible output token (the palette), shuffled */
  palette: string[];
}

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

function mapping(p: Params): Map<string, string> {
  const m = new Map<string, string>();
  for (const row of p.table) {
    if (p.direction === "forward") m.set(norm(row.from), row.to);
    else m.set(norm(row.to), row.from);
  }
  return m;
}

function solve(p: Params): Solution {
  const m = mapping(p);
  return {
    output: p.input.map((tok) => {
      const out = m.get(norm(tok));
      if (out === undefined) throw new Error(`transformer.encode: "${tok}" is not in the table`);
      return out;
    }),
  };
}

export const encode = defineMode({
  id: "encode",
  name: "Encode",
  implemented: true,
  blindSolvable: true,
  widget: "build",
  knowledgeTypes: ["procedure", "fact"],
  directorBlurb:
    "Translate a sequence of tokens through a lookup table (codon table, cipher, base pairing, base conversion); the player builds the output token by token. Encoding, decoding, transcription, translation.",
  authoringGuide: [
    "Write the table as from/to rows; every input token must be a `from` (or a `to` when direction is reverse). Add 2-6 distractor rows that the input never uses.",
    "Keep the input to 2-12 tokens so the build fits on screen; use uppercase for codons and bases.",
    "showTable true when reading the table is the skill (translation, ciphers); false only for memorized mappings (A-T, G-C).",
    "Placeholders: {{count}} (input length), {{tableName}}, {{output}} (the answer sequence: last hint and debrief only).",
  ].join("\n"),
  paramsSchema: Params,
  check(p) {
    const problems: string[] = [];
    const froms = p.table.map((r) => norm(r.from));
    if (new Set(froms).size !== froms.length) problems.push("table `from` tokens must be unique");
    if (p.direction === "reverse") {
      const tos = p.table.map((r) => norm(r.to));
      if (new Set(tos).size !== tos.length) problems.push("with direction reverse, table `to` tokens must be unique so decoding is unambiguous");
    }
    const keys = new Set(p.direction === "forward" ? froms : p.table.map((r) => norm(r.to)));
    p.input.forEach((tok, i) => {
      if (!keys.has(norm(tok))) problems.push(`input[${i}] "${tok}" is not in the table`);
    });
    if (p.table.some((r) => !r.from.trim() || !r.to.trim())) problems.push("table tokens must not be empty");
    const used = new Set(p.input.map(norm));
    if (p.table.every((r) => used.has(norm(p.direction === "forward" ? r.from : r.to)))) {
      problems.push("add at least one distractor row the input never uses, so the table isn't just the answer in order");
    }
    return problems;
  },
  resolve: solve,
  templateVars(p, s) {
    return { count: String(p.input.length), tableName: p.tableName, output: s.output.join(" ") };
  },
  answerVars: ["output"],
  present(p, seed): View {
    const outputs = [...new Set(p.table.map((r) => (p.direction === "forward" ? r.to : r.from)))];
    return {
      tableName: p.tableName,
      table: p.showTable ? p.table : [],
      input: p.input,
      direction: p.direction,
      tokenLabel: p.tokenLabel,
      outputLabel: p.outputLabel,
      palette: seededShuffle(outputs, seed),
    };
  },
  grade(p, input: Input) {
    const s = solve(p);
    const got = input.output ?? [];
    if (got.length !== s.output.length) return { correct: false, feedback: `Build all ${s.output.length} ${p.outputLabel}s: one for each ${p.tokenLabel}.` };
    const wrongAt = got.findIndex((g, i) => norm(g) !== norm(s.output[i]));
    if (wrongAt === -1) return { correct: true, feedback: `Every ${p.tokenLabel} translated correctly.` };
    return {
      correct: false,
      feedback: `Position ${wrongAt + 1}: ${p.tokenLabel} "${p.input[wrongAt]}" does not give "${got[wrongAt]}". Look up "${p.input[wrongAt]}" in the ${p.tableName} again.`,
    };
  },
  solutionInput: (_p, s) => ({ output: s.output }),
  blind: {
    schema: z.object({
      output: z.array(z.string()).min(2).max(12).describe("The translated tokens, in order, exactly as they appear in the palette"),
    }),
    describe: (p, view: View) =>
      [
        `${view.tableName}${view.table.length ? ":\n" + view.table.map((r) => `  ${r.from} → ${r.to}`).join("\n") : " (from memory)"}`,
        `Direction: ${view.direction === "forward" ? "from → to" : "to → from (decode)"}`,
        `Input ${p.tokenLabel}s: ${view.input.join(" ")}`,
        `Possible ${p.outputLabel}s: ${view.palette.join(", ")}`,
      ].join("\n"),
    toInput: (_p, _view: View, out) => ({ output: (out as { output: string[] }).output }),
  },
});
