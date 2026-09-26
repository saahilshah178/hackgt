# Wave-1 mode contracts (P4)

Main-session design for the ten wave-1 modes that don't exist yet. Implementers follow the seed plugin contract
(`src/mechanics/types.ts`: `paramsSchema`, `check`, `resolve`, `templateVars`, `answerVars`, `present`, `grade`,
`solutionInput`, `blind`) and these shapes exactly, so fixtures, widgets and the verifier agree by construction.
Existing references: `tuner/oscillator.ts`, `truth_finder/mimic.ts`, `sequencer/linear.ts`, `mapper/number_line.ts`.

Rules for every mode:
- `paramsSchema` is strict-mode legal (root object, every field required, `.nullable()` not `.optional()`, no `z.record`,
  `z.union` not `z.discriminatedUnion`, single-value `z.enum` not `z.literal`, no string length/regex, bounded ints).
- The model writes primitives only: exact mathjs expressions for numbers, texts, booleans. Code derives every answer,
  shuffle (seeded via `shuffleNotIdentity` / `seededShuffle` from `util.ts`) and displayed number.
- Anything shown to the player that would leak the key must be opaque: shuffled items get keys `k0..kN` in DISPLAY
  order, and `grade()` recomputes the same shuffle from `(params, seed)`; therefore `present(params, seed)` and
  `grade(params, input)` must share a deterministic helper `layout(params, seed)`. Since `grade` receives no seed,
  inputs carry the ORIGINAL indices/ids (as in `sequencer/linear`: keys `s0..`/`d0..` are identities), and the blind
  solver maps display positions → identities in `blind.toInput`. Keep that convention.
- `grade()` feedback is informative and never states the answer (LIBRARY §4 "Informative failure" per family).
- `templateVars` exposes only safe values plus clearly named answer vars listed in `answerVars`.
- `check()` returns actionable sentences; `resolve()` may throw only on params `check()` would have rejected.
- Unit tests per mode: valid params → `check` is `[]`; bad params → specific problems; `grade(solutionInput)` is
  correct; one wrong input gives informative feedback; `present` is deterministic for a seed; blind solver round-trip.
- One fixture encounter per mode in `fixtures/wave1.encounters.ts` (a `ChallengeSlice` + the card id it plays), and a
  `tests/wave1.test.ts` that assembles each into a one-encounter-plus-boss mini spec via `assembleGameSpec` and
  `validateGameSpec` and autoSolves it with `EncounterRunner`.

## tuner · formula (dial)  — cards: gear_ratio_gate, percent_shop, arc_builder, formula_engine ★, …
```ts
params = {
  expression: string,          // mathjs, e.g. "F / m"; the OUTPUT the player must hit
  outputName: string, outputUnit: string,
  inputs: [{ name, unit, min: number, max: number }] (1–4),  // every symbol in expression except constants
  controlled: string,          // the input the player dials
  fixed: [{ name, value: string }] (0–3),   // exact expressions for every non-controlled input
  solution: string,            // exact expression: the controlled value that hits the target
}
solution = { target: number, targetLabel, controlled: number, controlledLabel, values: Record<string, number> }
input = { value: number }
view = { expression, outputName, outputUnit, fixed: [{name, value, unit}], dial: {name, unit, min, max, step, ticks[]}, target: number, targetLabel }
```
`check`: every input appears in the expression; `controlled` is an input not in `fixed`; every other input is fixed;
`solution` inside [min, max]; expression evaluates; the output is monotonic in the controlled input over [min, max]
(sample 50 points) so the target has one preimage; `looksApproximated` on every expression. Tolerance: 3% of the
controlled input's range. Feedback: "the output came out too high/low; <direction the input must move>".
`templateVars`: expression, target, targetUnit, every fixed value by name, `controlled` (answer). `answerVars: ["controlled"]`.
Not blind-solvable.

## truth_finder · predict_reveal (pick) — cards: free_fall_drop, frictionless_arena, disturb_the_reactor, weather_fronts, credit_card_trap, oracle_of_consequence, …
```ts
params = {
  scenario: string,                                   // what is about to happen, under 200 chars
  options: [{ text, isCorrect: boolean, explanation }] (2–4, exactly one correct),
  reveal: string,                                     // what actually happens, shown after the pick (sourced or computed by the writer)
  revealSource: "sourced" | "computed",
}
solution = { correctIndex }
input = { optionIndex }
view = { scenario, options: [{ optionIndex, text }] (shuffled), }
```
Blind: `{ option: int 0–3, why }` by display position. `templateVars: { correct: options[correctIndex].text }`, `answerVars: ["correct"]`.

## sequencer · cycle (order) — cards: cycle_wheel, krebs_wheel, rock_cycle_wheel, water_cycle_wheel, business_cycle_wheel, fifths_wheel
```ts
params = { stages: string[] (3–8, in cycle order), decoys: string[] (0–2) }
solution = { order: string[] }   // keys s0..sN
input = { keys: string[] }       // any rotation of the cycle is correct; direction must match; decoys fail
view = { slots, planks: [{ key, text }] (shuffled), circular: true }
```
Feedback names the first stage whose successor is wrong. Blind like `linear` (positions in cycle order, any start).

## sequencer · rank (order) — cards: spread_field, periodic_landscape, escape_energy, strata_xray, big_o_race, memory_distance
```ts
params = {
  property: string, direction: "ascending" | "descending",
  items: [{ text, value: string, label: string | null }] (3–7),   // value: exact mathjs; label: shown after grading (e.g. "1.2 nm")
}
solution = { order: string[] (keys i0..iN sorted by value/direction), values: number[] }
input = { keys: string[] }
view = { property, direction, slots, planks: [{ key, text }] (shuffled) }   // values hidden until graded
```
`check`: values evaluate and are distinct. Feedback: first out-of-place slot; `grade` on success reveals labels in feedback.
`templateVars: { property, first, last }` (first/last = item texts; both answer vars). Blind by positions.

## mapper · plane (place) — cards: intersection_hunt, allowed_region, coordinate_treasure, circular_navigator, vector_winds, component_split, charge_navigator, phase_diagram_pin, earthquake_triangulation, moon_phase_orbit, lat_long_navigator, vanishing_point
```ts
params = {
  xMin, xMax, yMin, yMax: string (exact), gridStep: string (exact), labels: "decimal" | "pi",
  targetX, targetY: string (exact),
  xLabel: string, yLabel: string,
  overlay: string | null,   // one line describing what the host draws (two lines, a circle...); no geometry data tonight
}
solution = { x, y, tolerance: number (fraction of range, 0.03), label: "(x, y)" }
input = { x: number, y: number }
view = { xMin, xMax, yMin, yMax, gridStep, xLabel, yLabel, labels, overlay, target: "the requested point in words" }
```
`check`: target strictly inside; gridStep gives 2–12 lines per axis; target not on a grid intersection unless
`gridStep` is coarser than needed (allow on grid when both coordinates are multiples: many targets are lattice points —
so NO landmark rule here). Feedback: which axis is off and in which direction. `templateVars: { x, y }` both answer vars.

## sorter · bins (sort) — cards: membrane_router, congruence_stamp, reaction_type_sorter, polarity_sorter, plate_boundary_sorter, evidence_lab, era_sorter, branch_router, climate_zone_sorter, gdp_sorter, policy_levers, conditioning_lab, experiment_designer, ethics_lenses, appeal_sorter, gender_gates, movement_sorter
```ts
params = {
  bins: [{ id: string, label: string, feature: string }] (2–4),      // feature = the defining rule, shown on a miss
  items: [{ text, binId: string, why: string }] (4–10),
}
solution = { assignments: Record<itemKey, binId> }   // itemKey = "i<index>"
input = { assignments: [{ itemKey: string, binId: string }] }
view = { bins: [{id,label}], items: [{ key, text }] (shuffled) }
```
`check`: bin ids unique + snake_case, every item's binId exists, ≥ 1 item per bin, texts distinct. Grade: all items
placed and correct; feedback names the FIRST wrong item's correct category and that bin's `feature` (LIBRARY F7).
`templateVars: { binCount, itemCount }`. Blind: `{ assignments: [{ item: int, bin: string }] }` by display position.

## sorter · type_match (pick) — cards: type_matched_weapon, immune_defense, fallacy_duel, device_hunter
```ts
params = {
  categories: [{ id, label }] (2–4),
  waves: [{ text, categoryId, why }] (4–10),     // enemies appear in this order
  secondsPerWave: int 3–15,
}
solution = { answers: string[] }   // categoryId per wave
input = { answers: [{ waveIndex: number, categoryId: string }] }
view = { categories, waves: [{ waveIndex, text }] (in order, NOT shuffled), secondsPerWave }
```
Grade: every wave answered correctly (a missing/late answer counts wrong); feedback names the first miss's category +
why. Blind: `{ answers: string[] }` category ids in wave order.

## linker · pairs (link) — cards: grapple_anchors, proton_transfer, redox_tracker, shape_docking, organelle_city, boss_anatomy, who_said_it, amendment_match, bias_detector, brain_regions, transition_bridge, precedent_match
```ts
params = { pairs: [{ left, right, why }] (3–6), decoyRights: string[] (0–2) }
solution = { links: Record<leftKey, rightKey> }   // leftKey "l<i>", rightKey "r<i>" / decoy "x<i>"
input = { links: [{ leftKey, rightKey }] }
view = { lefts: [{ key, text }] (in order), rights: [{ key, text }] (shuffled) }
```
Grade: every left linked to its right; feedback highlights the first wrong link and gives the correct partner's
`why` as a clue without naming it. `templateVars: { pairCount }`. Blind: `{ links: [{ left: int, right: int }] }` by display positions.

## linker · chain (link) — cards: domino_engine ★, pointer_chain
```ts
params = { nodes: string[] (3–7, in causal order), decoys: string[] (0–2) }
solution = { edges: [{ from: key, to: key }] }   // consecutive pairs, keys n0..nN / decoys d0..
input = { edges: [{ fromKey, toKey }] }
view = { nodes: [{ key, text }] (shuffled), edgeCount }
```
Grade: the set of edges equals the consecutive pairs (order of the list irrelevant; each node one outgoing edge except the last);
feedback: first edge that doesn't follow ("what does X actually lead to?"). Blind by positions.

## investigator · elimination (pick) — cards: evidence_board ★, hidden_variable_mystery, elements_check
```ts
params = {
  question: string,
  hypotheses: [{ id, text }] (3–5),
  clues: [{ text, eliminates: string[] }] (2–6),   // hypothesis ids each clue rules out
}
solution = { survivorId: string, eliminatedBy: Record<hypothesisId, clueIndex> }
input = { hypothesisId: string }
view = { question, hypotheses: [{ id, text }] (shuffled), clues: [{ index, text }] (in order) }   // the matrix is for the widget to draw; eliminations are NOT sent
```
`check`: exactly one hypothesis survives every clue; every clue eliminates ≥ 1; ids unique. Feedback: the clue that
eliminates the player's pick (quote it). `templateVars: { survivor }` (answer var). Blind: `{ hypothesis: int, why }` by position.

## Widgets to add (engine-dev)
- `sort`: 2–4 labeled bins; items list; keyboard: select item, press 1–4 to bin it; drag optional. Returns `{ assignments }`.
- `link`: two columns (pairs) or node cloud (chain); keyboard: pick left, pick right. Returns `{ links }` / `{ edges }`.
- `pick` gains a timed "waves" variant for type_match (countdown per wave) and a "matrix" variant for elimination (clues panel).
- `order` gains `circular: true` rendering for cycle and a value-reveal for rank.
- `place` gains a 2-D plane with grid, axis labels, and an optional overlay caption.
Dungeon skins per LIBRARY §5: sorter → enemy room (type-matched weapons / category doors); linker → enemy room (chain lightning);
investigator → door room (rooms are hypotheses); mapper.plane → altar (rune grid); sequencer.cycle → door (rotating glyph ring);
tuner.formula → door (catapult / alchemy dials); predict_reveal → chest (the reveal plays after the pick).
