/** Human-readable form of a widget's input, for the consequence overlay ("your answer vs. the truth"). */
export function describeAnswer(mode: string, view: unknown, input: unknown): string | undefined {
  try {
    if (mode === "oscillator" || mode === "formula") return String((input as { value: number }).value.toFixed(2));
    if (mode === "number_line") return (input as { value: number }).value.toPrecision(4);
    if (mode === "mimic") {
      const v = view as { chests: { statementIndex: number; text: string }[] };
      const i = (input as { statementIndex: number }).statementIndex;
      return v.chests.find((c) => c.statementIndex === i)?.text;
    }
    if (mode === "predict_reveal") {
      const v = view as { options: { optionIndex: number; text: string }[] };
      const i = (input as { optionIndex: number }).optionIndex;
      return v.options.find((o) => o.optionIndex === i)?.text;
    }
    if (mode === "linear" || mode === "cycle" || mode === "rank") {
      const v = view as { planks: { key: string; text: string }[] };
      const keys = (input as { keys: string[] }).keys;
      return keys.map((k) => v.planks.find((p) => p.key === k)?.text ?? k).join(" -> ");
    }
    if (mode === "bins") {
      const v = view as { items: { key: string; text: string }[]; bins: { id: string; label: string }[] };
      const assignments = (input as { assignments: { itemKey: string; binId: string }[] }).assignments;
      return assignments
        .map((a) => `${v.items.find((it) => it.key === a.itemKey)?.text ?? a.itemKey} -> ${v.bins.find((b) => b.id === a.binId)?.label ?? a.binId}`)
        .join(", ");
    }
    if (mode === "type_match") {
      const v = view as { categories: { id: string; label: string }[] };
      const answers = (input as { answers: { waveIndex: number; categoryId: string }[] }).answers;
      return answers.map((a) => v.categories.find((c) => c.id === a.categoryId)?.label ?? a.categoryId).join(", ");
    }
    if (mode === "pairs") {
      const v = view as { lefts: { key: string; text: string }[]; rights: { key: string; text: string }[] };
      const links = (input as { links: { leftKey: string; rightKey: string }[] }).links;
      return links
        .map((l) => `${v.lefts.find((x) => x.key === l.leftKey)?.text ?? l.leftKey} = ${v.rights.find((x) => x.key === l.rightKey)?.text ?? l.rightKey}`)
        .join(", ");
    }
    if (mode === "chain") {
      const v = view as { nodes: { key: string; text: string }[] };
      const edges = (input as { edges: { fromKey: string; toKey: string }[] }).edges;
      return edges.map((e) => `${v.nodes.find((n) => n.key === e.fromKey)?.text ?? e.fromKey} -> ${v.nodes.find((n) => n.key === e.toKey)?.text ?? e.toKey}`).join(", ");
    }
    if (mode === "elimination") {
      const v = view as { hypotheses: { id: string; text: string }[] };
      const id = (input as { hypothesisId: string }).hypothesisId;
      return v.hypotheses.find((h) => h.id === id)?.text;
    }
    if (mode === "plane") {
      const { x, y } = input as { x: number; y: number };
      return `(${x.toPrecision(3)}, ${y.toPrecision(3)})`;
    }
    if (mode === "limit") {
      const { kind, value } = input as { kind: string; value: number | null };
      return kind === "value" ? String(value?.toFixed(2)) : kind;
    }
    if (mode === "equation") {
      const ops = (input as { ops: { op: string; value: string }[] }).ops;
      return ops.map((o) => `${o.op} ${o.value}`).join(", ") || "(no operations)";
    }
    if (mode === "chem_equation") {
      return (input as { coefficients: number[] }).coefficients.join(", ");
    }
    if (mode === "ledger") {
      const values = (input as { values: { flowKey: string; value: number }[] }).values;
      return values.map((v) => `${v.flowKey} = ${v.value}`).join(", ");
    }
    if (mode === "encode") {
      return (input as { output: string[] }).output.join(" ");
    }
    if (mode === "function_machine") {
      const v = view as { ruleOptions: { ruleIndex: number; text: string }[] };
      const { value, ruleIndex } = input as { value: number | null; ruleIndex: number | null };
      if (ruleIndex !== null) return v.ruleOptions.find((r) => r.ruleIndex === ruleIndex)?.text ?? String(ruleIndex);
      return value === null ? undefined : String(value);
    }
    if (mode === "trace") {
      const v = view as { options: { optionIndex: number; text: string }[] };
      const i = (input as { optionIndex: number }).optionIndex;
      return v.options.find((o) => o.optionIndex === i)?.text;
    }
    if (mode === "rapid") {
      const v = view as { prompts: { itemIndex: number; prompt: string }[] };
      const answers = (input as { answers: { itemIndex: number; text: string }[] }).answers;
      return answers
        .map((a) => `${v.prompts.find((p) => p.itemIndex === a.itemIndex)?.prompt ?? a.itemIndex}: ${a.text}`)
        .join(", ");
    }
    if (mode === "teach_back") {
      const text = (input as { text: string }).text.trim();
      return text.length > 160 ? `${text.slice(0, 157)}…` : text;
    }
    if (mode === "cloze") {
      return (input as { text: string }).text;
    }
    if (mode === "slope") {
      const inp = input as { sign?: string; concavity?: string; x?: number; xs?: number[] };
      if (inp.sign !== undefined) return inp.sign;
      if (inp.concavity !== undefined) return inp.concavity;
      if (inp.x !== undefined) return `x ≈ ${inp.x.toFixed(2)}`;
      if (inp.xs !== undefined) return inp.xs.map((x) => x.toFixed(2)).join(", ");
    }
  } catch {
    return undefined;
  }
  return undefined;
}
