/**
 * One valid `paramsSchema`-shaped params object per implemented mode (key = "family.mode", matching
 * `mechanics/registry.ts`'s `modeKey()`), used only by coverage.test.ts to call `mode.present(params, 1)`
 * and check the resulting view against `widgetFor()`. These are hand-written directly from each mode's
 * `Params` zod schema (src/mechanics/families/<family>/<mode>.ts) rather than pulled from `fixtures/*` or
 * `tests/*.test.ts`, because most of the modes this checkpoint adds widgets for (accumulator, tuner.curve,
 * simulator.intervene/reach_state/sample, the function_world piecewise modes, every builder mode, …) don't
 * yet have a wave fixture or an existing test with usable params. They are NOT guaranteed to pass each
 * mode's `check()` (authoring-quality checks); they only need to be schema-valid enough for `present()` to
 * run without throwing.
 */
export const COVERAGE_PARAMS: Record<string, unknown> = {
  // ---------------------------------------------------------------- truth_finder
  "truth_finder.mimic": {
    statements: [
      { text: "Water is wet.", isTrue: true, explanation: "Yes." },
      { text: "The sky is green.", isTrue: false, explanation: "The sky is blue." },
      { text: "Ice is frozen water.", isTrue: true, explanation: "Yes." },
    ],
  },
  "truth_finder.predict_reveal": {
    scenario: "A ball is dropped from a tower.",
    options: [
      { text: "It falls straight down.", isCorrect: true, explanation: "Gravity pulls it down." },
      { text: "It floats.", isCorrect: false, explanation: "Gravity always wins here." },
    ],
    reveal: "It falls straight down and lands at the base.",
    revealSource: "computed",
  },
  "truth_finder.error_hunt": {
    title: "a worked solution of 2x + 3 = 11",
    lines: [
      { text: "2x + 3 = 11", isWrong: false, explanation: "Given." },
      { text: "2x = 9", isWrong: true, explanation: "Should be 2x = 8." },
      { text: "x = 4", isWrong: false, explanation: "Follows if 2x = 8." },
    ],
    fixedLine: "2x = 8",
  },
  "truth_finder.counterexample": {
    rule: "Every promise is a contract.",
    cases: [
      { text: "A written agreement to sell a car for $500.", breaksRule: false, explanation: "Has consideration; it's a contract." },
      { text: "A promise to give a gift with nothing in return.", breaksRule: true, explanation: "No consideration, so not a contract." },
      { text: "A signed lease.", breaksRule: false, explanation: "It's a contract." },
    ],
  },

  // ---------------------------------------------------------------- sequencer
  "sequencer.linear": { steps: ["Mix flour and water.", "Knead the dough.", "Let it rise.", "Bake it."], decoys: [] },
  "sequencer.cycle": { stages: ["Inhale", "Gas exchange", "Exhale", "Pause"], decoys: [] },
  "sequencer.timeline": {
    events: [
      { text: "Event A", date: "1900", dateLabel: "1900" },
      { text: "Event B", date: "1920", dateLabel: "1920" },
      { text: "Event C", date: "1950", dateLabel: "1950" },
    ],
    decoys: [],
  },
  "sequencer.rank": {
    property: "atomic radius",
    direction: "ascending",
    items: [
      { text: "Helium", value: "0.31", label: "0.31 Å" },
      { text: "Lithium", value: "1.52", label: "1.52 Å" },
      { text: "Sodium", value: "1.86", label: "1.86 Å" },
    ],
  },

  // ---------------------------------------------------------------- tuner
  "tuner.oscillator": { wave: "sin", amplitude: 2, b: "1", c: "0", d: 0, ask: "period" },
  "tuner.formula": {
    expression: "F / m",
    outputName: "acceleration",
    outputUnit: "m/s^2",
    inputs: [
      { name: "F", unit: "N", min: 0, max: 100 },
      { name: "m", unit: "kg", min: 1, max: 20 },
    ],
    controlled: "F",
    fixed: [{ name: "m", value: "5" }],
    solution: "25",
  },
  "tuner.curve": {
    template: "linear",
    target: [
      { name: "m", value: "2" },
      { name: "b", value: "1" },
    ],
    ranges: [
      { name: "m", min: -5, max: 5 },
      { name: "b", min: -5, max: 5 },
    ],
    xMin: "-10",
    xMax: "10",
  },
  "tuner.optimize": { objective: "-(x-4)^2 + 20", goal: "max", xMin: "-10", xMax: "10", inputName: "x", outputName: "output" },

  // ---------------------------------------------------------------- mapper
  "mapper.number_line": { scale: "linear", min: "0", max: "10", target: "6", landmarkStep: "2", labels: "decimal" },
  "mapper.plane": {
    xMin: "-10",
    xMax: "10",
    yMin: "-10",
    yMax: "10",
    gridStep: "1",
    labels: "decimal",
    targetX: "3",
    targetY: "4",
    xLabel: "x",
    yLabel: "y",
    overlay: "",
  },
  "mapper.search": { min: "0", max: "100", hidden: "42", maxProbes: 8, thingName: "number" },

  // ---------------------------------------------------------------- sorter
  "sorter.bins": {
    bins: [
      { id: "a", label: "A", feature: "is an A" },
      { id: "b", label: "B", feature: "is a B" },
    ],
    items: [
      { text: "item1", binId: "a", why: "because" },
      { text: "item2", binId: "b", why: "because" },
      { text: "item3", binId: "a", why: "because" },
      { text: "item4", binId: "b", why: "because" },
    ],
  },
  "sorter.venn": {
    sets: [
      { id: "mammal", label: "Mammal", feature: "has fur, warm-blooded" },
      { id: "aquatic", label: "Aquatic", feature: "lives in water" },
    ],
    items: [
      { text: "Dolphin", setIds: ["mammal", "aquatic"], why: "A mammal that lives in water." },
      { text: "Dog", setIds: ["mammal"], why: "A mammal, not aquatic." },
      { text: "Shark", setIds: ["aquatic"], why: "Aquatic, not a mammal." },
      { text: "Rock", setIds: [], why: "Neither." },
    ],
  },
  "sorter.hierarchy": {
    levels: ["Kingdom", "Phylum", "Class"],
    items: [
      { text: "Animalia", level: "Kingdom", why: "A kingdom." },
      { text: "Chordata", level: "Phylum", why: "A phylum." },
      { text: "Mammalia", level: "Class", why: "A class." },
    ],
  },
  "sorter.type_match": {
    categories: [
      { id: "hypertonic", label: "Hypertonic" },
      { id: "hypotonic", label: "Hypotonic" },
    ],
    waves: [
      { text: "Cell A", categoryId: "hypertonic", why: "..." },
      { text: "Cell B", categoryId: "hypotonic", why: "..." },
      { text: "Cell C", categoryId: "hypertonic", why: "..." },
      { text: "Cell D", categoryId: "hypotonic", why: "..." },
    ],
    secondsPerWave: 6,
  },

  // ---------------------------------------------------------------- linker
  "linker.pairs": {
    pairs: [
      { left: "Mitochondria", right: "ATP production", why: "..." },
      { left: "Nucleus", right: "DNA storage", why: "..." },
      { left: "Ribosome", right: "Protein synthesis", why: "..." },
    ],
    decoyRights: [],
  },
  "linker.chain": { nodes: ["Sunlight hits leaf", "Photosynthesis occurs", "Glucose is produced", "Glucose is used for energy"], decoys: [] },
  "linker.network": {
    relation: "reports to",
    directed: true,
    nodes: [
      { id: "a", label: "Alice" },
      { id: "b", label: "Bob" },
      { id: "c", label: "Cara" },
    ],
    edges: [
      { from: "b", to: "a", why: "Bob reports to Alice." },
      { from: "c", to: "a", why: "Cara reports to Alice." },
    ],
  },
  "linker.path": {
    nodes: [
      { id: "a", label: "A" },
      { id: "b", label: "B" },
      { id: "c", label: "C" },
    ],
    edges: [
      { from: "a", to: "b", weight: "2" },
      { from: "b", to: "c", weight: "3" },
      { from: "a", to: "c", weight: "10" },
    ],
    directed: false,
    start: "a",
    goal: "c",
    ask: "shortest",
    costName: "distance",
  },

  // ---------------------------------------------------------------- investigator
  "investigator.elimination": {
    question: "Who caused the outage?",
    hypotheses: [
      { id: "h0", text: "A power surge" },
      { id: "h1", text: "A software bug" },
      { id: "h2", text: "Scheduled maintenance" },
    ],
    clues: [
      { text: "It happened at 3am, outside maintenance hours.", eliminates: ["h2"] },
      { text: "Logs show no surge in voltage.", eliminates: ["h0"] },
    ],
  },
  "investigator.argument": {
    claim: "The policy reduced emissions.",
    evidence: [
      { text: "Emissions dropped 10% the year after.", role: "supports", why: "Direct measured effect." },
      { text: "A recession also occurred that year.", role: "counter", why: "Confounding factor." },
      { text: "The agency issued a press release.", role: "weak", why: "Not evidence of effect." },
      { text: "The report was 40 pages long.", role: "irrelevant", why: "Length isn't evidence." },
    ],
  },
  "investigator.perspective": {
    actors: [
      { id: "a1", name: "The Landlord", motive: "wants rent paid on time" },
      { id: "a2", name: "The Tenant", motive: "wants repairs made" },
    ],
    accounts: [
      { text: "\"They never fixed the heater all winter.\"", actorId: "a2", why: "Complains about repairs." },
      { text: "\"They're three months behind on rent.\"", actorId: "a1", why: "Complains about payment." },
      { text: "\"I asked for the heater to be fixed twice.\"", actorId: "a2", why: "Complains about repairs again." },
    ],
  },
  "investigator.source_eval": {
    question: "How reliable is each source on this event?",
    sources: [
      { text: "A contemporary newspaper report.", reliability: 4, cues: "close in time, but partisan press" },
      { text: "A memoir written 40 years later.", reliability: 2, cues: "long after the fact, self-interested" },
      { text: "An official government record.", reliability: 5, cues: "contemporaneous, procedural" },
    ],
  },
  "investigator.weigh": {
    question: "What caused the Voting Rights Act to pass in 1965?",
    causes: [
      { text: "Selma marches", weight: "5", why: "Direct catalyst." },
      { text: "Presidential push", weight: "3", why: "Political will." },
      { text: "Court rulings", weight: "1", why: "Minor factor." },
    ],
  },

  // ---------------------------------------------------------------- function_world
  "function_world.limit": {
    pieces: [{ expr: "x^2", from: "-inf", to: "inf", openLeft: true, openRight: true }],
    overrides: [],
    a: "2",
    side: "both",
    xMin: "-5",
    xMax: "5",
  },
  "function_world.continuity": {
    pieces: [{ expr: "x^2", from: "-inf", to: "inf", openLeft: true, openRight: true }],
    overrides: [],
    xMin: "-5",
    xMax: "5",
    ask: "classify",
    a: "2",
  },
  "function_world.asymptote": {
    pieces: [{ expr: "1/x", from: "-inf", to: "inf", openLeft: true, openRight: true }],
    direction: "pos_inf",
    xMin: "-10",
    xMax: "10",
  },
  "function_world.slope": {
    pieces: [{ expr: "x^2", from: "-inf", to: "inf", openLeft: true, openRight: true }],
    xMin: "-5",
    xMax: "5",
    ask: "sign_at",
    a: "2",
  },
  "function_world.secant": {
    pieces: [{ expr: "x^2", from: "-inf", to: "inf", openLeft: true, openRight: true }],
    a: "2",
    windows: ["2", "1", "1/2"],
    xMin: "-5",
    xMax: "5",
    quantity: "position (m)",
  },
  "function_world.roots": { pieces: [{ expr: "x^2 - 4", from: "-inf", to: "inf", openLeft: true, openRight: true }], xMin: "-5", xMax: "5" },

  // ---------------------------------------------------------------- balance
  "balance.equation": { left: "3*x + 5", right: "20" },
  "balance.chem_equation": { reactants: ["H2", "O2"], products: ["H2O"] },
  "balance.ledger": {
    nodes: [
      { id: "spring", label: "Spring" },
      { id: "lake", label: "Lake" },
    ],
    flows: [
      { from: null, to: "spring", label: "rainfall", value: "10" },
      { from: "spring", to: "lake", label: "outflow", value: null },
    ],
  },
  "balance.torque": {
    fixed: [
      { mass: "4", position: "-2" },
      { mass: "2", position: "3" },
    ],
    movable: { mass: "3" },
    pivot: "0",
    ask: "position",
    rangeMin: "-10",
    rangeMax: "10",
    unit: "m",
  },
  "balance.ratio": {
    recipe: [
      { name: "flour", amount: "2", unit: "cups" },
      { name: "sugar", amount: "1", unit: "cups" },
    ],
    available: [
      { name: "flour", amount: "10" },
      { name: "sugar", amount: "3" },
    ],
    product: { name: "cookies", perBatch: "12", unit: "cookies" },
    ask: "limiting",
  },

  // ---------------------------------------------------------------- simulator
  "simulator.intervene": {
    system: {
      variables: [
        { name: "temp", initial: "20", unit: "C", min: 0, max: 100 },
        { name: "control", initial: "0", unit: "", min: 0, max: 5 },
      ],
      rules: [
        { target: "temp", expr: "temp + control - 1" },
        { target: "control", expr: "control" },
      ],
      ticks: 10,
    },
    control: { variable: "control", min: "0", max: "5", step: "1" },
    target: { variable: "temp", low: "15", high: "25" },
    ticks: 10,
    budget: 3,
  },
  "simulator.reach_state": {
    system: {
      variables: [{ name: "pop", initial: "10", unit: "", min: 0, max: 1000 }],
      rules: [{ target: "pop", expr: "pop * 1.1" }],
      ticks: 5,
    },
    control: { variable: "pop", min: "1", max: "50", step: "1" },
    target: { variable: "pop", value: "16", tolerance: "1" },
    atTick: 5,
  },
  "simulator.predict": {
    system: {
      variables: [{ name: "size", initial: "5", unit: "", min: 0, max: 1000 }],
      rules: [{ target: "size", expr: "size * 1.2" }],
      ticks: 10,
    },
    scenario: "A population grows each generation.",
    watch: "size",
    question: "What happens to the population?",
    options: [
      { text: "It grows.", asserts: "increases", explanation: "Correct." },
      { text: "It stays flat.", asserts: "stays", explanation: "Incorrect." },
    ],
    comparison: "increases",
    threshold: "0",
  },
  "simulator.sample": {
    system: {
      variables: [{ name: "x", initial: "0", unit: "", min: 0, max: 1 }],
      rules: [{ target: "x", expr: "rand()" }],
      ticks: 2,
    },
    watch: "x",
    trials: 200,
    statistic: "mean",
    threshold: "0.5",
    question: "What is the average value of x?",
    options: [
      { text: "About 0.5", isCorrect: true, explanation: "x is uniform on [0,1]." },
      { text: "About 0.9", isCorrect: false, explanation: "Too high." },
    ],
    ranges: [
      { optionIndex: 0, low: "0.4", high: "0.6" },
      { optionIndex: 1, low: "0.8", high: "1" },
    ],
  },

  // ---------------------------------------------------------------- builder
  "builder.molecule": {
    atoms: [
      { element: "H", count: 4 },
      { element: "C", count: 1 },
    ],
    target: "CH4",
  },
  "builder.circuit": {
    inputs: ["A", "B"],
    target: [
      { inputs: [false, false], output: false },
      { inputs: [false, true], output: false },
      { inputs: [true, false], output: false },
      { inputs: [true, true], output: true },
    ],
    gates: ["AND", "OR", "NOT"],
    maxGates: 3,
  },
  "builder.program": {
    grid: ["S..G"],
    commands: ["forward", "left", "right"],
    maxBlocks: 6,
    mustCollectGems: false,
  },
  "builder.sentence": {
    tiles: ["The", "cat", "sat"],
    accepted: [["The", "cat", "sat"]],
    rules: ["subject before verb"],
  },
  "builder.genetics": {
    trait: "flower color",
    dominantAllele: "B",
    recessiveAllele: "b",
    dominantPhenotype: "purple flowers",
    recessivePhenotype: "white flowers",
    parent1: "Bb",
    parent2: "Bb",
    ask: "square",
  },
  "builder.electron_config": { element: "Carbon", atomicNumber: 6 },
  "builder.tiles": {
    rows: 1,
    cols: 3,
    pieces: [{ id: "q", label: "Quarter note", cells: 1 }],
    rules: [{ kind: "total_equals", value: "3" }],
    target: "",
  },

  // ---------------------------------------------------------------- transformer
  "transformer.function_machine": {
    rule: "2*x + 3",
    examples: ["1", "2", "5"],
    ask: "output",
    query: "10",
    ruleOptions: [],
    inputLabel: "input",
    outputLabel: "output",
  },
  "transformer.composition": {
    kind: "numeric",
    machines: [
      { id: "double", label: "Double", expr: "2*x", consumes: [], produces: [] },
      { id: "add_one", label: "+1", expr: "x + 1", consumes: [], produces: [] },
    ],
    input: "3",
    target: "7",
  },
  "transformer.encode": {
    tableName: "codon table",
    table: [
      { from: "AUG", to: "Met" },
      { from: "UUU", to: "Phe" },
    ],
    input: ["AUG", "UUU"],
    direction: "forward",
    tokenLabel: "codon",
    outputLabel: "amino acid",
    showTable: true,
  },
  "transformer.trace": {
    program: ["x = 3", "y = x * 2 + 1", "print y"],
    ask: "output",
    variable: "",
    options: ["7", "6", "8"],
  },

  // ---------------------------------------------------------------- accumulator
  "accumulator.riemann": { expr: "x^2", a: "0", b: "4", n: 4, method: "left", ask: "estimate" },
  "accumulator.area": { expr: "x", a: "0", target: "8", bMin: "1", bMax: "10" },
  "accumulator.signed": { expr: "x", a: "-2", b: "2", ask: "net" },
  "accumulator.rate_total": { rateExpr: "2", t0: "0", t1: "5", initial: "10", quantityName: "water", unit: "L" },
  "accumulator.average_value": { expr: "x^2", a: "0", b: "3" },

  // ---------------------------------------------------------------- recall
  "recall.rapid": {
    items: [
      { prompt: "casa", answers: ["house"], hint: "Where you live." },
      { prompt: "perro", answers: ["dog"], hint: "A common pet." },
      { prompt: "gato", answers: ["cat"], hint: "Another common pet." },
    ],
    secondsPerItem: 6,
    direction: "Spanish -> English",
  },
  "recall.cloze": {
    sentence: "Water moves toward the side with the higher ___ concentration.",
    answers: ["solute"],
    wordBank: ["solute", "solvent", "pressure"],
    hint: "Think about what's dissolved.",
  },

  // ---------------------------------------------------------------- explainer
  "explainer.teach_back": {
    listener: "a new lab apprentice",
    question: "Why does a cell swell in fresh water?",
    ideas: [
      { label: "where the dissolved stuff is", keywords: ["hypotonic", "more solute inside"], followUp: "Is the inside different from the pond?", exemplar: "Fresh water is hypotonic." },
      { label: "what crosses and which way", keywords: ["osmosis", "water moves in"], followUp: "What crosses, and which way?", exemplar: "Water moves in by osmosis." },
    ],
    required: 2,
    misconceptions: [{ keywords: ["salt moves in"], correction: "Can the dissolved particles get through?" }],
    wordBank: ["osmosis", "hypotonic", "membrane"],
  },
};
