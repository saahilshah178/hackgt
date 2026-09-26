# Genre and Mechanic Library (final, v2)

This is the design library the generator selects from. It merges everything in the project notes: the original five-step plan, the "instructional-game compiler" review (primitives, five genres, concept weighting), the teaching-mechanic cards review (concept-specific mechanics, misconception targeting, three layers), and the GameSpec plan (data not code, four genres, 46 elements, starter eight).

## 0. How the library is layered

```
CONCEPT (from the KnowledgeMap)      "A limit can exist when f(a) doesn't"  + misconception + knowledge type
   │  retrieval: domain, keywords, knowledge type, misconception
   ▼
TEACHING MECHANIC (catalog data)     decoy_destination: nearby paths converge on one platform, the tile at a teleports elsewhere
   │  every card names exactly one family + mode
   ▼
MECHANIC FAMILY (engine code)        function_world · limit   (params schema, check, resolve, present, grade)
   │  family's genre adapter picks the socket + skin
   ▼
GENRE HOST (engine code)             Platformer: missing platform · Dungeon: rune track · Mystery: sensor log · Puzzle: track tiles
   │
   ▼
WIDGET + ENGINE PRIMITIVES           dial / place overlay · movement, interpolation, trigger zones, plotter, meters
```

- **Families are code.** 14 families, each with a few modes. Only families marked implemented are offered to the Director.
- **Teaching mechanics are data.** About 300 cards across every subject. All cards are visible to the LLM as design knowledge, and adding one costs no engine work if its family and mode exist.
- **Genre is a wrapper.** The same card plays in any genre whose adapter lists a socket for its family.
- **Misconceptions drive selection.** The curriculum agent extracts the misconceptions in the material, and the matcher prefers cards built to break one of them.

## 1. Genres

| id | Genre | Core loop | Sockets (encounter mount points) | Boss socket | Best at | Build tier |
|---|---|---|---|---|---|---|
| `dungeon` | Dungeon crawler (top-down roguelite arena) | Room by room: fight, loot, open the way. A failed run restarts, reweighted toward what you missed. | door, altar, chest, enemy, forge, shop, boss | boss | categories, facts, quantities, procedures; universal | 1 (build first) |
| `mystery` | Investigation adventure | Talk, collect evidence, deduce, accuse | conversation, evidence, corkboard, cross_exam, archive, lab, accusation | accusation | history, literature, civics, law, biology, arguments | 2 (mostly UI; shows off voice) |
| `platformer` | Side-view obstacle course | Run and jump to the exit | gap, gate, moving_platform, switch, pickup, boss | boss | functions, physics, magnitudes, sequences | 3 (physics tuning eats hours) |
| `puzzle` | Grid puzzle / escape room | Turn-based moves on tiles | tile_board, pipe_board, beam_board, conveyor, lock, goal_pad, boss | boss | procedures, logic, transformations, CS | 4 |
| `strategy` | Management sim (factory, colony, economy) | Build and run a system over turns | production_line, market, policy_dial, research_node, event_card, ledger, crisis | crisis | economics, ecology, stoichiometry, systems | 5 (stretch) |

**Levels are built from prefab chunks.** Each genre host ships a catalog of hand-built chunks. Every chunk has a kind (start, connector, room, boss) and provides zero or one socket. Layout is computed in code from the encounter list, so every level is solvable by construction.

### 1.1 Auto-genre selection
Weight each concept by the Director's weight (section 8), sum those weights per knowledge type, then score each implemented genre with the table below. The Director may override the result, but must log a reason.

| Knowledge type | dungeon | mystery | platformer | puzzle | strategy |
|---|---|---|---|---|---|
| fact | 3 | 2 | 1 | 1 | 0 |
| category | 3 | 2 | 2 | 2 | 1 |
| sequence | 2 | 2 | 2 | 3 | 1 |
| causal | 1 | 3 | 1 | 1 | 2 |
| system | 1 | 1 | 1 | 1 | 3 |
| quantitative | 2 | 0 | 3 | 2 | 2 |
| spatial | 2 | 1 | 3 | 3 | 1 |
| procedure | 2 | 1 | 1 | 3 | 1 |
| argument | 0 | 3 | 0 | 1 | 1 |

## 2. Widgets (input layer, built once as React overlays)

| Widget | Player action | Used by families |
|---|---|---|
| dial | slider or knob, 1 to 3 values; can drive an in-world object live | tuner, function_world, accumulator, simulator |
| pick | choose one of N | truth_finder, sorter (type_match), investigator, recall |
| sort | drag items into 2 to 4 bins or Venn regions | sorter |
| order | arrange a sequence (linear or circular) | sequencer, transformer (composition) |
| place | position a marker on a line, plane, or region map | mapper, function_world, accumulator |
| link | connect pairs or edges in a graph | linker, investigator |
| build | put tokens into slots or grid cells under rules; palette of pieces | builder, balance, transformer |
| type | free text with fuzzy matching against accepted answers | recall |

Every widget must be keyboard accessible, palette-aware, and projector-legible, and must report its input in the shape the family's `grade()` expects.

## 3. Engine primitives (never exposed to the LLM)
- movement and collision
- tweens and interpolation
- trigger zones
- function plotter: y = f(x), piecewise, holes, asymptotes
- meters and gauges
- particles
- timers
- tinted 1-bit sprites (Kenney 1-Bit Pack, CC0)
- camera
- dialogue box with portraits
- audio cues
- seeded RNG
- mathjs evaluation, including `derivative` and numeric integration

## 4. Mechanic families (engine code)

Every family follows the plugin contract from the seed starter:

- `paramsSchema`: LLM-facing and strict-mode legal
- `check`: semantic validation
- `resolve`: the answer key, computed in code
- `templateVars` and `answerVars`
- `present`: seeded view
- `grade`: informative feedback
- `solutionInput`
- `authoringGuide`
- `blindSolvable`

For every family, the LLM writes only primitives. Code derives answers, shuffles, and numbers shown to the player.

**Wave 1** (implement first): truth_finder, sequencer, tuner, mapper, sorter, linker, investigator.
**Wave 2**: function_world, balance, simulator, builder, transformer, accumulator, recall.
Modes marked † are catalog-only until time allows.

### F1. `tuner`: set parameters so the computed behavior hits a target
- **Widget:** dial.
- **Modes:**
  - `oscillator`: y = A·wave(b·t + c) + d. The LLM writes wave, A, b, c, d as exact expressions, plus `ask`, which is one of period, frequency, amplitude, phase, or midline.
  - `formula`: a mathjs expression with named inputs `{name, unit, min, max}`. The LLM picks the controlled input's solution value as an exact expression, and code computes the target output shown to the player.
  - `curve`: a template (linear m,b; quadratic a,h,k; exponential a,b). The LLM gives the target parameters, and code derives the 2 to 3 checkpoints the curve must pass through.
  - `optimize`: an objective f(x) on [min, max]. Code finds the argmax or argmin numerically and checks that the objective is unimodal.
- **Grading:** tolerance scaled to range (default 3%).
- **Informative failure:** overlay the player's value against the needed one, and report direction (too long or too short).
- **Knobs:** tolerance, number of controlled parameters, time pressure.
- **Needs:** a formula from the KnowledgeMap, or a known model.
- **blindSolvable:** no (computed).

### F2. `function_world`: the world's geometry is a function; explore, then predict or locate
- **Widgets:** dial (scrub x) and place or pick (answer).
- **Function definition:** piecewise `[{expr, from, to, openLeft, openRight}]` plus point overrides `{x, y | undefined}`.
- **Modes:**
  - `limit`: ask left, right, or two-sided at a; the answer is a value or DNE.
  - `continuity`: find or fix a discontinuity.
  - `asymptote`: behavior as x → ±∞.
  - `slope`: sign, zero, steepest point, concavity, inflection.
  - `secant`: shrinking Δx toward the derivative at a.
  - `roots`: where f = 0.
  - `squeeze`: bounds converge at a.
  - `epsilon_delta`: choose δ for a given ε. †
- **How answers are computed:** limits by two-sided numeric evaluation with shrinking h, derivatives via mathjs `derivative`, roots by bracketing.
- **Informative failure:** animate the approach from both sides.
- **Needs:** functions or formulas.
- **blindSolvable:** no.

### F3. `accumulator`: area, accumulation, rate ↔ total
- **Widgets:** dial or place.
- **Modes:**
  - `riemann`: n rectangles, left, right, or midpoint.
  - `area`: choose bound b so the integral hits the target.
  - `signed`: net area above and below the axis.
  - `rate_total`: predict the accumulated total at time t.
  - `average_value`: level the reservoir.
- **Computed by:** Simpson's rule.
- **Informative failure:** shade the true region over the player's.
- **blindSolvable:** no.

### F4. `balance`: conservation and equality under operations
- **Widget:** build.
- **Modes:**
  - `equation`: the player applies operations to both sides until x is alone. The engine applies each operation, and success is verified by substitution.
  - `chem_equation`: the player sets integer coefficients. Code parses the formulas, counts atoms, and computes the minimal solution (coefficients ≤ 12).
  - `ledger`: nodes with flows, where inflow equals outflow; the player fills missing values. Covers KCL, budgets, energy, and accounting.
  - `torque`: masses at distances; balanced when Σm·d = 0.
  - `ratio`: recipe or stoichiometric ratios and limiting reagent.
- **Informative failure:** show which side or which atom is off, and by how much.
- **blindSolvable:** partly (ledger, ratio).

### F5. `transformer`: input → output machines
- **Widgets:** pick, order, or build.
- **Modes:**
  - `function_machine`: a rule as a mathjs expression or lookup table; show k input/output pairs, then ask for a new output or the rule.
  - `inverse`
  - `composition`: order the machines to reach a target. Code brute-forces the orders to prove the answer is unique.
  - `domain_filter`: which inputs are valid.
  - `encode`: lookup tables (codon table, cipher, base conversion).
  - `trace`: a tiny restricted DSL executed by code; ask for the final value or the output.
  - `matrix`: a 2×2 matrix applied to a shape.
  - `geometric`: rotate, reflect, translate, or scale a shape to match.
- **Informative failure:** run the machine on the player's choice and show the result.
- **blindSolvable:** yes for encode and function_machine.

### F6. `sequencer`: order things
- **Widget:** order.
- **Modes:**
  - `linear`: steps in correct order, plus 0 to 2 decoys.
  - `cycle`: circular, with rotation-invariant grading.
  - `timeline`: events with sourced dates; the dates are revealed after placing.
  - `rank`: order items by a sourced or computed property.
- **Informative failure:** name the first out-of-place slot and ask what must come before it.
- **blindSolvable:** yes.

### F7. `sorter`: categories, regions, hierarchies
- **Widgets:** sort or pick.
- **Modes:**
  - `bins`: 2 to 4 categories.
  - `venn`: 2 to 3 sets, including a "neither" region.
  - `hierarchy`: nesting, or a tree.
  - `type_match`: real-time version of bins. A labeled enemy or item appears and the player must answer with the right category. This is the Zombie Division mechanic.
- **Informative failure:** show the item's category and the defining feature.
- **blindSolvable:** yes.

### F8. `truth_finder`: expose the false, predict then reveal, find the error
- **Widget:** pick.
- **Modes:**
  - `mimic`: exactly one false claim, built from a misconception. This is the universal fallback.
  - `predict_reveal`: the player picks an outcome before a computed simulation or a sourced reveal.
  - `error_hunt`: a worked solution, proof, or code with exactly one wrong line.
  - `counterexample`: pick the case that breaks the rule.
- **Informative failure:** show the explanation for the chosen option.
- **blindSolvable:** yes.

### F9. `linker`: pairs, chains, networks, paths
- **Widget:** link.
- **Modes:**
  - `pairs`: 3 to 6 pairs.
  - `chain`: ordered cause → effect links.
  - `network`: edges by a stated relation.
  - `path`: a weighted graph where the player finds the shortest or valid path. Code runs Dijkstra or BFS.
- **Informative failure:** highlight the wrong link and the correct partner's clue.
- **blindSolvable:** yes (pairs, chain).

### F10. `mapper`: place on a line, plane, or map
- **Widget:** place.
- **Modes:**
  - `number_line`: linear or log scale, with coarse landmarks. The target never sits on a landmark.
  - `plane`: a point, region, or line. Covers intersections, inequality regions, unit-circle points, vector tips, phase diagrams, and epicenters.
  - `map`: place items onto a region graph defined as data.
  - `search`: find a hidden value using higher/lower probes within a probe budget (binary search).
- **Informative failure:** "you landed past X; it sits between A and B".
- **blindSolvable:** no.

### F11. `simulator`: a live system from state variables, update rules (mathjs), and a seeded RNG
- **Widgets:** dial or pick, and the player watches the system run.
- **Modes:**
  - `intervene`: keep a variable in a band for T ticks with limited actions.
  - `reach_state`: set initial parameters or rates so the state hits a target at tick T.
  - `predict`: predict the direction of the outcome before running, then watch.
  - `sample`: repeated stochastic trials; the player estimates or decides.
- **Computed by:** running the simulation deterministically.
- **Informative failure:** replay with the player's choice beside the correct one.
- **blindSolvable:** predict only.

### F12. `builder`: construct under rules checked by a validator
- **Widget:** build.
- **Modes:**
  - `molecule`: valence rules, target formula.
  - `circuit`: logic gates or resistors, target truth table or value.
  - `program`: blocks for a grid robot, run by an interpreter.
  - `sentence`: word tiles, checked against accepted sequences and agreement rules from the content.
  - `genetics`: a Punnett square.
  - `electron_config`: Aufbau, Hund, and Pauli rules.
  - `tiles`: grid filling under rules. Covers algebra tiles, area models, K-map groups, measures, and pipeline schedules.
- **Informative failure:** the validator names the violated rule.
- **blindSolvable:** partly.

### F13. `investigator`: evidence, arguments, sources, perspectives
- **Widgets:** link, pick, or dial.
- **Modes:**
  - `elimination`: a hypotheses × clues matrix. Code verifies that exactly one hypothesis survives.
  - `argument`: a claim plus evidence cards, some weak or irrelevant. Counter-evidence forces the player to qualify the claim.
  - `source_eval`: rank sources by provenance cues.
  - `perspective`: match accounts to actors and their motives.
  - `weigh`: allocate weights to causes, graded on rank order against the source.
- **Informative failure:** show which clue eliminates the player's pick.
- **blindSolvable:** yes.

### F14. `recall`: retrieval practice
- **Widgets:** type or pick.
- **Modes:**
  - `rapid`: accepted answers plus fuzzy matching; cooldowns follow spacing intervals.
  - `cloze`: fill a blank in a source sentence.
  - `memory_palace`: items placed in rooms, recalled later.
  - `listen`: an ElevenLabs TTS cue.
  - `teach_back` †: an LLM-graded explanation that earns a bonus only and never gates progress.
- **Informative failure:** show the answer with its source sentence.
- **blindSolvable:** yes.

### 4.1 Default knowledge type → family preference

| Knowledge type | Preferred families |
|---|---|
| fact | recall, truth_finder·mimic, linker·pairs |
| category | sorter, truth_finder |
| sequence | sequencer, linker·chain |
| causal | linker·chain, investigator·weigh, simulator·predict, truth_finder·predict_reveal |
| system | simulator, balance·ledger |
| quantitative | tuner, function_world, accumulator, mapper·number_line, balance |
| spatial | mapper·plane/map, transformer·geometric |
| procedure | sequencer, builder·program, balance·equation, truth_finder·error_hunt |
| argument | investigator, truth_finder·counterexample |

## 5. Genre adapters (family × genre → socket and skin)

| Family | dungeon | mystery | platformer | puzzle | strategy |
|---|---|---|---|---|---|
| tuner | door/boss: vault rings, catapult, alchemy dials | lab: calibrate the instrument; lighthouse sweep | moving_platform/gate: saw wheels, launch pads, balloon | lock/beam_board: dial locks, gear trains | policy_dial/production_line: machine settings |
| function_world | altar/boss: rune track whose floor height is f(x) | lab: sensor readings converging on a timestamp | gap: terrain is y = f(x); the missing tile | tile_board: track tiles that follow f | market: price curve over time |
| accumulator | forge: fill the reservoir to forge the key | archive: rebuild totals from rate logs | gap: fill the pit; velocity ghost | conveyor: fill tanks | production_line: output over time |
| balance | altar: alchemy scale (spilled atoms become slimes) | archive: the ledger is off by one entry | switch: seesaw bridge | lock: cancel terms, DragonBox-style | ledger: balance budgets and flows |
| transformer | forge: crafting-bench machines | lab: decode the letter or cipher | pickup/gate: power-up machine, cipher platforms | conveyor/pipe_board: route through machines | production_line: processing chain |
| sequencer | door: glyph door pressed in order | corkboard: rebuild the timeline | gap: bridge planks in order | conveyor: order the parcels | research_node: tech tree order |
| sorter | enemy: type-matched weapons; category-keyed doors | evidence: file claims into case folders | gate: only matching-category platforms are solid | goal_pad: push crates onto category pads | market: route goods to districts |
| truth_finder | chest: mimic chest | cross_exam: object to the lie | gate: the false door collapses | tile_board: remove the odd tile | event_card: advisors' claims |
| linker | enemy: chain lightning between pairs | corkboard: string the board | pickup: grapple anchors | pipe_board: Flow-style pairing | research_node: supply links |
| mapper | altar/enemy: archery range on a number line | conversation: auction bids, map pins | gap: the floor is a number line | tile_board: place tiles on an axis | market: place goods on the price line |
| simulator | enemy/boss: ecology rooms, reactor waves | lab: keep the patient stable overnight | moving_platform: population or glucose lifts | beam_board: place species so all are fed | crisis/policy_dial: run the economy or ecosystem |
| builder | forge: craft a molecule, circuit, or golem program | lab: build the compound or circuit | switch: wire the elevator; word-block bridge | tile_board: valence grid, Lightbot | production_line: lay out the factory |
| investigator | door: rooms are hypotheses | accusation/corkboard: native | gate: clues seal the doors of eliminated hypotheses | tile_board: logic grid | event_card: policy debate with evidence |
| recall | enemy: spells are flashcards, cooldowns are spacing | conversation: riddle-keeper interrogation | pickup: type the term to double-jump | tile_board: timed word tiles | research_node: quick recall boosts research |

## 6. Teaching-mechanic catalog (concept → implementation)

How to read the tables:
- One row is one catalog card.
- **Family · mode** is the engine that runs the card; the genre skin comes from section 5.
- **Player does** is the concept-specific configuration.
- **Misconception it breaks** is the wrong mental model the encounter forces the player to abandon. The debrief names the correction.
- ★ marks a flagship card, built and demoed first (section 7 gives its per-genre forms).
- The domain code in each heading is the card's `domain` field.

### 6.1 Mathematics: number & quantity (`math`)
| id | Concept | Family · mode | Player does | Misconception it breaks |
|---|---|---|---|---|
| number_line_leap ★ | Magnitude, fractions, negatives | mapper · number_line | Land on 3/8 or −2.5 with only coarse landmarks labeled | A bigger denominator means a bigger fraction |
| equivalent_landing | Equivalent fractions | mapper · number_line | Two different-looking fractions must land on the same stone | Different numerals mean different amounts |
| log_scope | Scientific notation, orders of magnitude | mapper · number_line (log) | Place 10⁻⁹ m, 10³ m, 10⁶ m on a zoomable log line | 10⁻⁹ is a large negative number |
| integer_lift | Signed-number arithmetic | mapper · number_line | Ride the elevator through basement floors: −3 − (−5) | Subtracting a negative makes a number smaller |
| gear_ratio_gate | Ratios & proportion | tuner · formula | Set gear tooth counts so the portcullis rises at the target speed | Ratios scale by adding the same amount |
| percent_shop | Percent change | tuner · formula | Apply successive markups and discounts to hit an exact price | −20% then +20% returns to the start |
| unit_pipeline | Dimensional analysis | transformer · composition | Chain conversion-factor pipes; joints connect only when units cancel | Units are labels you can drop |
| order_of_ops_forge | Order of operations | transformer · trace | Predict what the calculator machine outputs for a nested expression | Operations always go left to right |

### 6.2 Algebra & functions (`math`)
| id | Concept | Family · mode | Player does | Misconception it breaks |
|---|---|---|---|---|
| balance_chamber ★ | Solving linear equations | balance · equation | Apply the same operation to both pans until x stands alone | You can move a term across without changing its sign |
| intersection_hunt | Systems of equations | mapper · plane | Mark the one point both laser paths pass through | A solution only has to satisfy one equation |
| allowed_region | Inequalities | mapper · plane | Only tiles where y < 2x + 1 are solid; mark the safe region | Multiplying by a negative keeps the inequality direction |
| distance_field | Absolute value | mapper · number_line | Beacons light where \|x − 3\| < 2; mark the whole lit stretch | \|x\| just deletes a minus sign, so \|x\| = x |
| graph_terrain | Slope & intercept | tuner · curve | Tune m and b so the ramp meets the ledge | Slope is run over rise |
| function_factory | What a function is | transformer · function_machine | Feed inputs, watch outputs, predict the output for a new input | A function must be a formula |
| reverse_factory | Inverse functions | transformer · inverse | Run the machine backward to recover the input | f⁻¹(x) means 1/f(x) |
| machine_pipeline | Composition | transformer · composition | Order two machines so the crate exits as the target | f(g(x)) = g(f(x)) |
| input_filter | Domain & range | transformer · domain_filter | Choose which crates the √ or 1/x machine accepts without jamming | Every real number is a valid input |
| projectile_architect | Quadratics (standard form) | tuner · curve | Tune a, b, c so the arc threads the rings | c changes how wide the parabola is |
| move_the_arc | Vertex form | tuner · curve | Drag h, k, a to move the parabola onto its target | (x − 3)² shifts the graph left |
| sea_level_roots | Zeros / roots | function_world · roots | Mark every point where the terrain meets sea level | Every quadratic has two real roots |
| factor_forge | Factoring | builder · tiles | Arrange algebra tiles into a rectangle whose sides are the factors | x² + 5x + 6 = (x + 5)(x + 1) |
| replication_chamber | Exponential growth | simulator · reach_state | Set the growth factor so the colony hits the target on day n | Exponential growth is fast linear growth |
| reverse_growth | Logarithms | tuner · formula | Choose how many doublings reach the target population | A logarithm is division |
| pattern_path | Arithmetic & geometric sequences | transformer · function_machine | Jump to the stone holding the next term | Every sequence adds a constant |
| inheritance_machine | Recursive sequences | simulator · reach_state | Set a₁ and the rule so generation 5 matches | Recursive and explicit rules can't describe the same sequence |
| exponent_mimic | Exponent rules | truth_finder · mimic | Expose the chest claiming x²·x³ = x⁶ | Multiply exponents when multiplying powers |

### 6.3 Geometry (`math`)
| id | Concept | Family · mode | Player does | Misconception it breaks |
|---|---|---|---|---|
| transform_key | Rigid transformations & symmetry | transformer · geometric | Rotate, reflect, translate the key until it fits the slot | A line reflection equals a 180° rotation |
| mirror_angles | Reflection angles | tuner · formula | Set mirror angles so the beam hits the crystal | Light bounces straight back off any mirror |
| area_tiler | Area vs perimeter | builder · tiles | Tile the room, then fence it; compare both counts | More area always means more perimeter |
| pythagoras_bridge | Pythagorean theorem | tuner · formula | Cut the plank that spans the diagonal gap | The hypotenuse is a + b |
| scale_shifter | Similarity; square-cube law | tuner · formula | Grow ray: double your size, 8× your weight, too big for the gap | Doubling length doubles volume |
| congruence_stamp | Congruence criteria | sorter · bins | Sort triangle pairs into SSS / SAS / ASA / not enough info | SSA proves congruence |
| proof_ladder | Two-column proofs | sequencer · linear | Order the rungs of a proof; one decoy reason doesn't follow | If it looks true in the diagram, it's proven |
| volume_pour | Volume | tuner · formula | Fill differently shaped tanks to the same volume | The taller container holds more |
| coordinate_treasure | Distance & midpoint | mapper · plane | Mark the midpoint between two torches on the grid | The midpoint is the difference of the coordinates |

### 6.4 Trigonometry (`math`)
| id | Concept | Family · mode | Player does | Misconception it breaks |
|---|---|---|---|---|
| circular_navigator | Unit circle | mapper · plane | Walk the unit circle to where the x-shadow reads the given cos θ | sin θ is the x-coordinate |
| projection_machine | sin & cos as projections | mapper · number_line | Predict where the rotating point's shadow lands at θ | sin and cos are unrelated functions |
| phase_gate ★ | Period | tuner · oscillator (period) | Dial the period so the vault rings lock | A bigger b makes the period longer |
| pulse_matcher | Frequency | tuner · oscillator (frequency) | Match pulses per second to the beacon | Frequency and period are the same number |
| oscillation_reach | Amplitude | tuner · oscillator (amplitude) | Set the swing so the platform just touches each checkpoint | Amplitude is peak-to-trough |
| wave_alignment | Phase shift | tuner · oscillator (phase) | Slide one wave in time until the peaks align | sin(x + π/2) shifts right |
| radian_rune_line | Radian measure | mapper · number_line | Step onto 5π/6 on the unrolled circle | π radians is a full turn |
| arc_builder | Arc length s = rθ | tuner · formula | Lay rope along the rim; the angle is arc ÷ radius | An angle's radian measure depends on the circle's size |
| identity_circuits | Trig identities | truth_finder · mimic | Several routes transform the signal; expose the non-equivalent one | Identities only hold at special angles |
| trig_solve_bridge | Solving sin x = k | sequencer · linear | Lay the planks: isolate, reference angle, quadrants, all solutions | sin x = ½ has one solution |

### 6.5 Calculus: limits & continuity (`math`)
| id | Concept | Family · mode | Player does | Misconception it breaks |
|---|---|---|---|---|
| approach_target | Limit as x → a | function_world · limit | Walk toward x = a while the f(x) marker approaches its destination | A limit is the value at the point |
| two_path_convergence | Two-sided limits | function_world · limit | Approach by left and right routes; the gate opens only if both reach the same height | One side is enough |
| directional_scanner | One-sided limits | function_world · limit | Scan the machine from one side only; predict where the output heads | x → a⁻ means x is negative |
| broken_tile | Limit exists at a hole | function_world · limit | The tile at x = a is missing, but both paths converge on one spot | No f(a), no limit |
| decoy_destination ★ | Limit ≠ function value | function_world · limit | Nearby paths converge on one platform, but the tile at a teleports elsewhere | The limit always equals f(a) |
| split_gate | Jump discontinuity (DNE) | function_world · limit | Approaching from the left raises one gate half; from the right, a different height | Every function has a limit at every point |
| runaway_elevator | Infinite limits | function_world · limit | Near the forbidden floor the elevator climbs faster and never settles | An infinite limit is a very large number |
| long_horizon | Limits at infinity | function_world · asymptote | Travel far; the terrain levels toward a fixed altitude | A curve can never cross its asymptote |
| closing_walls | Squeeze theorem | function_world · squeeze | Upper and lower walls close in; predict where the trapped orb ends | The trapped function can escape between the bounds |
| precision_zone | ε-δ definition | function_world · epsilon_delta † | The target band shrinks; choose how close x must stay to a | You pick δ first, then ε |
| unbroken_track | Continuity | function_world · continuity | A cart rides the track; mark where holes, jumps, and blow-ups stop it | Continuous just means defined everywhere |
| repair_the_track | Removable discontinuity | function_world · continuity | Place the missing piece where the surrounding track says it belongs | Any discontinuity can be patched with one point |

### 6.6 Calculus: derivatives (`math`)
| id | Concept | Family · mode | Player does | Misconception it breaks |
|---|---|---|---|---|
| slope_scanner | Slope depends on position | function_world · slope | Cross curved terrain with a tangent scanner; mark the steepest spot | A curve has one slope |
| speed_snapshot | Instantaneous rate | function_world · secant | Freeze time over shorter windows to read the vehicle's speed | Instantaneous rate = average rate over the trip |
| closing_gates | Difference quotient → derivative | function_world · secant | Two checkpoints slide together while Δy/Δx updates | The secant slope is the derivative |
| momentum_direction | Sign of f′ | function_world · slope | Mark where the terrain pushes you forward vs back | f′ < 0 means f < 0 |
| zero_force_zones | Critical points | function_world · slope | Find every spot where the horizontal push vanishes | f′ = 0 always means a max or min |
| curvature_gravity | Concavity | function_world · slope | Steering bends with how the slope itself changes | Concave down means decreasing |
| gravity_flip | Inflection points | function_world · slope | Mark where the world's curvature flips | An inflection point is where f′ = 0 |
| peak_efficiency | Optimization | tuner · optimize | Tune the parameter to maximize the machine's output | The max is always at an endpoint |
| linked_machines | Related rates | tuner · formula | Set how fast the radius grows so volume rises at the target rate | Linked quantities change at the same rate |
| derivative_machine | Differentiation rules | transformer · function_machine | The machine turns f into f′; predict its output for a new f | d/dx x³ = 3x³ |

### 6.7 Calculus: integrals (`math`)
| id | Concept | Family · mode | Player does | Misconception it breaks |
|---|---|---|---|---|
| tile_the_region ★ | Riemann sums | accumulator · riemann | Place narrower and narrower blocks under the curved ceiling | Left sums always underestimate |
| fill_the_reservoir | Definite integral as area | accumulator · area | Stop the gate where the reservoir holds the target volume | Area under a curve needs a geometric formula |
| energy_ledger | Signed area | accumulator · signed | Area above the axis charges the battery; below drains it | Area below the axis counts as positive |
| resource_collector | Accumulation from a rate | accumulator · rate_total | Ride through changing production rates; predict inventory at t | Total = rate × time even when the rate changes |
| rate_total_machine | Fundamental Theorem | accumulator · rate_total | Switch between the rate gauge and the storage tank; predict each | Integrals and derivatives are unrelated |
| integration_window | Changing bounds | accumulator · area | Drag the window's edges to hit the target total | Swapping the bounds doesn't matter |
| level_the_reservoir | Average value | accumulator · average_value | Flatten uneven water into a rectangle of equal area | Average value is the average of the endpoints |
| rate_runner | Position from velocity | accumulator · rate_total | Sketch your ghost's velocity; position is the area under it | The velocity graph shows the path's shape |

### 6.8 Vectors & linear algebra (`math`)
| id | Concept | Family · mode | Player does | Misconception it breaks |
|---|---|---|---|---|
| vector_winds | Vector addition | mapper · plane | Place fans; mark where their combined push carries you | Vectors add like numbers (3 + 4 = 7) |
| component_split | Components | mapper · plane | Split thrust into x and y engines that land you on target | Components add up to the magnitude |
| transformation_grid | Matrices as transformations | transformer · matrix | Pick the 2×2 matrix that turns the rune into the door's shape | Matrix multiplication is commutative |
| determinant_press | Determinant as area scale | transformer · matrix | Predict the stamped area after the matrix press | The determinant is the sum of the entries |

### 6.9 Statistics & probability (`math`)
| id | Concept | Family · mode | Player does | Misconception it breaks |
|---|---|---|---|---|
| repeat_experiment | Variability | simulator · sample | Rerun the identical experiment; predict the spread | Same setup, same result |
| prediction_stabilizer | Law of large numbers | simulator · sample | Choose how many trials until the estimate stays in the band | After five heads, tails is due |
| long_run_casino | Expected value | simulator · sample | Pick the table with the best long-run payoff, then watch 1,000 plays | The biggest prize is the best bet |
| population_collector | Sampling bias | simulator · sample | Sample only reachable districts; explain why the estimate drifts | A bigger biased sample fixes the bias |
| capture_the_parameter | Confidence intervals | simulator · sample | Throw interval nets; predict how many catch the hidden true value | There's a 95% chance this one interval holds the value |
| spread_field | Standard deviation | sequencer · rank | Rank datasets with the same mean by spread | Same mean, same data |
| scatter_landscape | Correlation | mapper · number_line | Place each scatter plot's r on the −1…1 line | r = 0 means no relationship of any kind |
| hidden_variable_mystery | Correlation vs causation | investigator · elimination | Find the hidden third system driving both meters | Correlation proves causation |
| evidence_updater | Bayes' theorem | mapper · number_line | After the test result, set the belief meter | A 99%-accurate test means a 99% chance you're sick |
| restricted_world | Conditional probability | mapper · number_line | Irrelevant outcomes vanish once the condition is known; place P(A\|B) | P(A\|B) = P(B\|A) |
| odds_forge | Probability & counting | simulator · sample | Choose the fork with the best odds of loot | Two outcomes means 50/50 |
| mean_median_seesaw | Mean vs median | balance · torque | Add an outlier; move the fulcrum (mean) while the median marker stays put | Mean and median always move together |
| z_score_rapids | z-scores, normal distribution | mapper · number_line | Place the raft at the reading's z-score | z = 2 means twice the average |

### 6.10 Physics (`physics`)
| id | Concept | Family · mode | Player does | Misconception it breaks |
|---|---|---|---|---|
| motion_predictor | Velocity | mapper · number_line | Predict where the cart will be after Δt, then watch | Speed and velocity are the same thing |
| thrust_vehicle | Acceleration | tuner · formula | Set thrust so velocity hits the target at the checkpoint | Zero velocity means zero acceleration |
| free_fall_drop | Free fall | truth_finder · predict_reveal | In the vacuum chamber, predict whether the boulder or the feather lands first | Heavier objects fall faster |
| frictionless_arena | Newton's 1st law | truth_finder · predict_reveal | Predict the puck's path after you stop pushing | Moving things need a force to keep moving |
| formula_engine ★ | Newton's 2nd law (and any formula) | tuner · formula | Same push on different masses; set the force that hits the target acceleration | A constant force produces constant speed |
| recoil_movement | Newton's 3rd law | simulator · intervene | Move only by throwing mass the opposite way | The bigger object pushes harder |
| collision_arena | Momentum conservation | tuner · formula | Set mass or speed so the post-collision motion hits the target | Momentum is lost in collisions |
| force_time_shield | Impulse | tuner · formula | Stop the boulder with a short hard shield or a long soft one | Stopping force depends only on speed, not stopping time |
| energy_converter | Energy conservation | balance · ledger | Route energy among potential, kinetic, and spring meters | Energy gets used up |
| height_bank | Gravitational PE | tuner · formula | Choose the ledge height that banks exactly enough energy | PE depends on the path taken |
| force_path | Work | tuner · formula | Push at an angle; only the component along the path counts | Any force on a moving object does work |
| surface_strategy | Friction | tuner · formula | Pick the surface coefficient that stops the sled on the pad | Friction depends on contact area |
| lever_door | Torque | balance · torque | Place the weight at the distance that opens the lever door | Only the force matters, not where it's applied |
| balance_builder | Center of mass | balance · torque | Stack cargo so the center of mass stays over the base | Center of mass is always the geometric center |
| catapult_range | Projectile motion | tuner · formula | Set the angle to clear the wall without landing in the lava | Horizontal speed slows during flight |
| orbit_slingshot | Gravity & orbits | simulator · reach_state | Set the launch speed that reaches a stable orbit | There's no gravity in space |
| charge_navigator | Electric fields | mapper · plane | Mark where the test charge feels zero net force | Field lines are paths charges must follow |
| voltage_height_map | Electric potential | truth_finder · predict_reveal | Predict where charges roll on the voltage landscape | Voltage flows through a circuit |
| flow_network | Current | balance · ledger | Fill each branch's current so every junction balances | Current is used up by bulbs |
| flow_restrictors | Resistance, Ohm's law | tuner · formula | Choose the resistor that sets the bulb to target brightness | More resistance means more current |
| power_grid_builder | Series vs parallel | builder · circuit | Wire the town so every house gets full voltage | Adding bulbs in parallel dims all of them |
| wave_generator | v = fλ | tuner · formula | Tune the frequency so the wavelength fits the chamber | Raising frequency raises wave speed |
| resonance_breaker | Resonance | tuner · optimize | Drive the oscillator at the frequency that shatters the crystal | Pushing harder always makes bigger oscillations |
| wave_bridge | Superposition, interference | tuner · oscillator (phase) | Set the second wave's phase so the sum flattens into a path | Two waves always make a bigger wave |
| light_bender | Refraction (Snell's law) | tuner · formula | Angle the beam so it bends through the water onto the sensor | Light bends away from the normal entering water |
| gas_balloon | Ideal gas law | tuner · formula | Heat the balloon until lift reaches the ledge | Gas pressure doesn't depend on temperature |
| heat_flow_rooms | Thermal equilibrium | simulator · predict | Predict final temperatures when rooms share a wall | Cold flows into warm objects |
| half_life_vault | Radioactive decay | tuner · formula | Set the wait so exactly the target fraction remains | After two half-lives it's all gone |
| phase_diagram_pin | Phases vs pressure & temperature | mapper · plane | Place the substance on the P–T diagram to make ice, water, or steam | Water always boils at 100 °C |

### 6.11 Chemistry (`chemistry`)
| id | Concept | Family · mode | Player does | Misconception it breaks |
|---|---|---|---|---|
| atom_conservation ★ | Balancing equations | balance · chem_equation | Set coefficients until every atom token balances and the reactor starts | Change subscripts to balance |
| reaction_factory | Stoichiometry | balance · ratio | Feed reactants in the required ratio; leftovers pile up | Reactants combine 1:1 by mass |
| production_bottleneck | Limiting reagent | balance · ratio | Predict which feed runs out first and how much product ships | The reactant with less mass is limiting |
| particle_crates | The mole | tuner · formula | Pack particles into standard crates; convert grams to crates | A mole of anything weighs the same |
| dynamic_reaction_arena | Dynamic equilibrium | simulator · predict | Watch forward and reverse reactions; predict when counts stop changing | At equilibrium the reaction stops |
| disturb_the_reactor | Le Châtelier | truth_finder · predict_reveal | Predict the shift, then add reactant or change pressure | Adding product speeds the forward reaction |
| energy_barrier | Activation energy | simulator · reach_state | Heat until enough molecules clear the barrier | Exothermic reactions need no energy to start |
| alternate_route | Catalysts | truth_finder · predict_reveal | Unlock the tunnel; predict what changes and what doesn't | Catalysts change how much energy is released |
| proton_transfer | Brønsted acids & bases | linker · pairs | Link each acid to its conjugate base by passing proton tokens | Strong acid means concentrated acid |
| ph_meter | pH scale | mapper · number_line (log) | Place solutions on the pH line; 10× concentration is one step | pH 4 is twice as acidic as pH 5 |
| orbital_filling | Electron configuration | builder · electron_config | Fill orbital slots obeying Aufbau, Hund, and Pauli | Orbitals fill in number order (3d before 4s) |
| periodic_landscape | Periodic trends | sequencer · rank | Rank elements by atomic radius or electronegativity | Atoms get bigger left to right |
| escape_energy | Intermolecular forces | sequencer · rank | Rank substances by boiling point from their attractions | Boiling breaks covalent bonds |
| molecule_builder | Bonding & valence | builder · molecule | Assemble the requested molecule within valence rules | Atoms can form any number of bonds |
| titration_drip | Titration | tuner · formula | Stop the burette at the equivalence point | The equivalence point is always pH 7 |
| reaction_type_sorter | Reaction types | sorter · bins | Sort reactions into synthesis, decomposition, single/double replacement, combustion | Any reaction with O₂ is combustion |
| polarity_sorter | Molecular polarity | sorter · bins | Sort molecules polar vs nonpolar from their shape | Polar bonds always make a polar molecule |
| redox_tracker | Oxidation & reduction | linker · pairs | Link each species to whether it's oxidized or reduced | Oxidation always involves oxygen |

### 6.12 Biology (`biology`)
| id | Concept | Family · mode | Player does | Misconception it breaks |
|---|---|---|---|---|
| particle_spread | Diffusion | simulator · predict | Predict how particles spread from the crowded chamber | Particles move toward empty space on purpose |
| membrane_balance | Osmosis | simulator · predict | Predict which way water crosses and whether the cell swells or shrinks | Salt crosses the membrane instead of water |
| atp_gate | Active transport | simulator · intervene | Spend ATP to pump ions against the gradient before the budget runs out | Transport always goes down the gradient |
| membrane_router | Membrane selectivity | sorter · bins | Route molecules to simple diffusion, channel, or pump | Anything small passes freely |
| shape_docking | Enzyme specificity | linker · pairs | Dock each substrate into its matching active site | Enzymes are used up in reactions |
| dock_blocker | Competitive inhibition | simulator · predict | Decoys occupy sites; predict how much more substrate restores the rate | Inhibitors destroy enzymes |
| genome_repair | DNA base pairing | transformer · encode | Rebuild the damaged strand by complementary pairing | A pairs with G |
| rna_assembly | Transcription | transformer · encode | Read the template strand and assemble the mRNA (U for T) | mRNA is an exact copy of the template strand |
| protein_factory ★ | Translation | transformer · encode | Route codons to amino acids with the codon table to build the chain | Each nucleotide codes for one amino acid |
| chromosome_logistics | Mitosis | sequencer · linear | Duplicate and separate chromosome sets in stage order | Chromosomes duplicate during prophase |
| meiosis_shuffle | Meiosis & variation | simulator · sample | Shuffle homolog pairs; predict how many gamete types appear | Meiosis makes identical cells |
| punnett_forge | Mendelian genetics | builder · genetics | Fill the Punnett square to breed a familiar with the needed trait | Dominant traits are always the most common |
| survival_sim | Natural selection | simulator · predict | Change the environment; predict which trait spreads | Individuals evolve because they need to |
| drift_sim | Genetic drift | simulator · sample | Run tiny populations and watch alleles vanish by chance | Evolution always improves fitness |
| ecosystem_network | Food webs | linker · network | Remove a species; trace the cascade through the web | Removing a predator helps every other species |
| energy_pyramid | Energy flow (≈10% rule) | tuner · formula | Size each trophic level from the energy passed up | Energy is recycled like matter |
| feedback_controller ★ | Homeostasis | simulator · intervene | Release insulin or glucagon to keep glucose in the safe band | Hormones switch on and stay on |
| threshold_pulse | Action potentials | simulator · intervene | Stack inputs until threshold fires an all-or-none spike | Stronger stimuli make bigger action potentials |
| organelle_city | Organelle functions | linker · pairs | Assign each city service to its organelle | Plant cells don't have mitochondria |
| taxonomy_tower | Classification hierarchy | sorter · hierarchy | Nest kingdom through species into a climbable tower | Species that look alike are closest relatives |
| levels_tower | Levels of organization | sequencer · linear | Climb cell → tissue → organ → system → organism | Organs are built directly from cells |
| photosynthesis_recipe | Photosynthesis | transformer · composition | Route light, water, CO₂ through the stations to make glucose | Plants get their mass from the soil |
| respiration_forge | Cellular respiration | transformer · composition | Run glucose through glycolysis, Krebs, and the ETC to charge ATP | Plants don't do cellular respiration |
| krebs_wheel | Krebs cycle | sequencer · cycle | Rotate the wheel so each intermediate feeds the next | Glucose enters the Krebs cycle directly |
| heart_run | Blood flow | sequencer · linear | Sprint through the chambers in blood-flow order; valves are one-way gates | All arteries carry oxygen-rich blood |
| boss_anatomy | Parts & functions | linker · pairs | Strike the weak point whose function the announcer names | The right side of the heart pumps to the body |
| immune_defense | Innate vs adaptive immunity | sorter · type_match | Deploy the right defender against each invader | Antibiotics kill viruses |
| vaccine_memory | Immunological memory | simulator · predict | Predict how fast the second infection is cleared | Vaccines give you the disease |

### 6.13 Earth & space (`earth_space`)
| id | Concept | Family · mode | Player does | Misconception it breaks |
|---|---|---|---|---|
| rock_cycle_wheel | Rock cycle | sequencer · cycle | Rotate processes so each rock type becomes the next | Rocks only change in one direction |
| strata_xray | Relative dating | sequencer · rank | X-ray the cliff; order layers oldest to youngest | Layer order says nothing about age |
| plate_boundary_sorter | Plate boundaries | sorter · bins | Sort features to convergent, divergent, or transform boundaries | Earthquakes only happen at convergent boundaries |
| earthquake_triangulation | Locating epicenters | mapper · plane | Draw three distance circles; mark where they meet | One station can locate the epicenter |
| water_cycle_wheel | Water cycle | sequencer · cycle | Restart the cycle by triggering stages in order | Clouds are water vapor |
| moon_phase_orbit | Moon phases | mapper · plane | Place the Moon in its orbit to show the requested phase | Phases are Earth's shadow |
| seasons_tilt | Seasons | truth_finder · mimic | Expose the claim that summer is when Earth is closest to the Sun | Seasons come from distance to the Sun |
| greenhouse_dial | Greenhouse effect | simulator · intervene | Adjust emissions to keep temperature in the band | The greenhouse effect is the ozone hole |
| star_life | Stellar evolution | sequencer · linear | Route the star through its life stages by mass | All stars end as black holes |
| weather_fronts | Air masses & fronts | truth_finder · predict_reveal | Predict the weather as the cold front arrives | Warm air slides under cold air at a front |

### 6.14 Computer science (`cs`)
| id | Concept | Family · mode | Player does | Misconception it breaks |
|---|---|---|---|---|
| state_containers | Variables & assignment | transformer · trace | Predict each container's value after the instructions run | x = x + 1 is an impossible equation |
| branch_doors | Conditionals | transformer · trace | Predict which door the branching world opens for the current state | Both branches of an if run |
| automation_track | Loops | builder · program | Configure a repeating action instead of stepping manually | A loop checks its condition only once |
| reusable_machines | Functions | builder · program | Define a machine once and call it at several stations | Functions run when they're defined |
| nested_rooms | Recursion | transformer · trace | Each room holds a smaller copy; predict the result as base cases return | Recursion never stops |
| indexed_inventory | Arrays & indexing | transformer · trace | Fetch items by slot from a zero-indexed inventory | Indexes count from 1 in every language |
| pointer_chain | Linked lists | linker · chain | Relink next-pointers to insert a node | You can jump straight to the 5th node |
| tower_access | Stacks | sequencer · linear | Predict the pop order after pushes and pops | First in, first out |
| processing_line | Queues | sequencer · linear | Predict the service order at the processing line | The newest arrival is served first |
| branch_explorer | Tree traversal | sequencer · linear | Order the rooms visited in pre-, in-, or post-order | In-order means top to bottom |
| half_split_hunt | Binary search | mapper · search | Find the hidden number within ⌈log₂ n⌉ probes | Binary search works on unsorted data |
| ordering_conveyor | Sorting algorithms | transformer · trace | Predict the conveyor after pass k of bubble or insertion sort | Every sort does the same work |
| network_explorer | BFS vs DFS | sequencer · linear | Predict the visit order as BFS spreads and DFS dives | BFS and DFS visit in the same order |
| weighted_path_planner | Shortest paths (Dijkstra) | linker · path | Find the cheapest route across weighted bridges | Fewest edges means cheapest |
| bucket_router | Hashing | transformer · function_machine | Predict each key's bucket from h(k) = k mod m; spot collisions | Hashing sorts the keys |
| memory_warehouse | Caching & locality | transformer · trace | Predict hits and misses as requests arrive | Every memory access costs the same |
| race_switches | Race conditions | truth_finder · predict_reveal | Predict the final counter when two agents interleave | Two increments always add 2 |
| deadlock_locks | Deadlock | linker · network | Find the cycle in the wait-for graph and break it | Deadlock needs a bug in a single thread |
| state_world | Finite state machines | linker · network | Draw the transitions so the world accepts the input | A state machine remembers its whole history |
| big_o_race | Complexity | sequencer · rank | Rank runners by growth rate as n explodes | An O(n²) algorithm is always slower |
| code_golem | Algorithms | builder · program | Program the golem to build the staircase | Computers do what you meant |
| cipher_door | Binary, hex, encodings | transformer · encode | Translate the carving from binary or hex to unlock the door | Hex digits only go 0–9 |
| bug_hunter | Debugging | truth_finder · error_hunt | Strike the scroll line that causes the bug | The bug is on the line where the error shows |
| osi_elevator | Network layers | sequencer · linear | Ride a packet down and up the protocol stack | Layers can be skipped |

### 6.15 Electrical & computer engineering (`engineering`)
| id | Concept | Family · mode | Player does | Misconception it breaks |
|---|---|---|---|---|
| current_junction | KCL | balance · ledger | Balance every junction: current in = current out | Current gets used up at junctions |
| voltage_loop | KVL | balance · ledger | Make rises and drops around the loop sum to zero | Voltage is the same everywhere in series |
| network_compression | Equivalent resistance | tuner · formula | Collapse the resistor network; predict the single equivalent | Parallel resistors add up |
| capacitor_reservoir | RC charging | tuner · formula | Choose the wait so the capacitor reaches 63% (one τ) | Capacitors charge linearly |
| logic_factory ★ | Logic gates | builder · circuit | Wire gates so the output matches the target truth table | You need AND, OR, and NOT to build any circuit |
| state_explorer | Truth tables | builder · circuit | Test every input combination and fill the table | Checking a few inputs proves the circuit |
| grouping_territory | Karnaugh maps | builder · tiles | Cover the 1-cells with the fewest power-of-two rectangles | Groups can be any size |
| signal_railway | Multiplexers | transformer · trace | Set select lines so the right input track reaches the output | Select lines carry the data |
| one_bit_room | Flip-flops | transformer · trace | Predict the stored bit after each clock edge | Outputs change whenever inputs change |
| safe_sampling_window | Setup & hold time | mapper · number_line | Place the input transition outside the window around the clock edge | Any change before the edge is safe |
| instruction_factory | Pipelining | builder · tiles | Schedule instructions into stages; count total cycles | Pipelining makes each instruction faster |
| datapath_relay | Instruction execution | sequencer · linear | Route an instruction through fetch, decode, execute, memory, write-back | The PC changes only on jumps and branches |
| memory_distance | Memory hierarchy | sequencer · rank | Rank storage by latency and capacity | Bigger memory is faster |
| path_prediction | Branch prediction | simulator · sample | Guess each branch; watch the pipeline flush on a miss | Mispredictions cost nothing |

### 6.16 Health & medicine (`health`)
| id | Concept | Family · mode | Player does | Misconception it breaks |
|---|---|---|---|---|
| dosage_calculator | Dosage calculation | tuner · formula | Recompute the pharmacist's dose from weight and concentration | Every patient gets the same dose |
| reflex_arc | Reflex arc | sequencer · linear | Order receptor, sensory neuron, spinal cord, motor neuron, effector | Reflexes go through the brain first |
| antibiotic_resistance | Resistance evolution | simulator · predict | Stop treatment early; predict which bacteria survive | People become resistant to antibiotics |

### 6.17 History (`history`)
| id | Concept | Family · mode | Player does | Misconception it breaks |
|---|---|---|---|---|
| timeline_reconstruction | Chronology | sequencer · timeline | Rebuild the events in order; dates reveal after placing | Events happened in the order the textbook mentions them |
| domino_engine ★ | Cause & effect chains | linker · chain | Place causes so the chain topples through to the consequence | History is a list of unrelated events |
| causal_weighting | Competing causes | investigator · weigh | Allocate importance among causes; the explanation shifts with the weights | Every event has one cause |
| evidence_lab | Primary vs secondary sources | sorter · bins | Inspect documents and classify each one | Old means primary |
| source_seer | Source reliability | investigator · source_eval | Weigh testimony by author, timing, incentives, corroboration | Eyewitnesses are always reliable |
| perspective_switch | Historical perspective | investigator · perspective | Replay the event as different actors; match accounts to motives | People in the past thought like us |
| map_evolution | Borders & movement over time | mapper · map | Move borders, migrations, and battles to the right year | Borders have always been where they are now |
| evidence_board ★ | Inference from evidence | investigator · elimination | Pin clues; eliminate hypotheses until one explanation stands | Any evidence supports any claim |
| counterevidence_attack | Qualifying a claim | investigator · argument | Opposing evidence weakens your claim until you qualify it | A strong argument ignores counterevidence |
| context_reconstruction | Period vocabulary | recall · cloze | Infer a term's meaning from its use in the source | Terms meant then what they mean now |
| oracle_of_consequence | Decisions & consequences | truth_finder · predict_reveal | Advise the ruler, then see the documented outcome | The outcome was inevitable |
| who_said_it | Figures & ideas | linker · pairs | Match quotes and positions to historical figures | Reformers of an era all wanted the same thing |
| era_sorter | Periodization | sorter · bins | Sort artifacts and events into eras | Eras begin and end on exact dates |
| museum_palace | Remembering lists | recall · memory_palace | Tour the museum, then recall which exhibit stood in which room | Rereading is the best way to memorize |

### 6.18 Civics & government (`civics`)
| id | Concept | Family · mode | Player does | Misconception it breaks |
|---|---|---|---|---|
| branch_router | Separation of powers | sorter · bins | Route each power to the legislative, executive, or judicial branch | The president makes laws |
| bill_to_law | Legislative process | sequencer · linear | Move the bill through every stage to become law | A bill becomes law after one vote |
| checks_network | Checks and balances | linker · network | Draw which branch checks which, and how | Checks only run in one direction |
| amendment_match | Rights & amendments | linker · pairs | Match each scenario to the amendment it invokes | The First Amendment binds private companies |
| federalism_venn | Federalism | sorter · venn | Place powers in the federal, state, or shared regions | States can't make laws of their own |
| precedent_court | Judicial precedent | investigator · argument | Build the ruling from the facts and prior cases | Courts decide on personal opinion |
| electoral_math | Electoral systems | balance · ledger | Allocate electoral votes to reach the threshold | Winning the national popular vote guarantees the presidency |

### 6.19 Geography (`geography`)
| id | Concept | Family · mode | Player does | Misconception it breaks |
|---|---|---|---|---|
| map_placement | Locations & regions | mapper · map | Pin places onto the regions of the stylized map | Maps show countries at their true size |
| lat_long_navigator | Latitude & longitude | mapper · plane | Sail to the coordinates on the grid | Longitude lines are parallel |
| climate_zone_sorter | Climate zones | sorter · bins | Sort cities into climate zones from their data | Latitude alone sets climate |
| migration_flows | Push & pull factors | linker · network | Connect factors to the migrations they drove | Migration is only about money |
| population_pyramid | Demographic transition | simulator · predict | Predict the pyramid's shape a generation later | Population always grows |

### 6.20 Economics (`economics`)
| id | Concept | Family · mode | Player does | Misconception it breaks |
|---|---|---|---|---|
| living_marketplace | Supply & demand | simulator · predict | Shift supply or demand; predict the new price and quantity | Higher prices increase demand |
| price_shock | Elasticity | tuner · formula | Change the price to hit target revenue given elasticity | Raising prices always raises revenue |
| opportunity_fork | Opportunity cost | tuner · optimize | Split a fixed budget between two upgrades; name what you gave up | Free things have no cost |
| two_nation_trade | Comparative advantage | tuner · optimize | Allocate workers in two nations, then trade to beat going it alone | A country better at everything gains nothing from trade |
| purchasing_power_world | Inflation | tuner · formula | The same coins buy less each year; compute the real price | Inflation raises every price by the same percent |
| hidden_spillover | Externalities | simulator · predict | Your factory's costs land on neighbors; predict the true social cost | The market price captures every cost |
| one_more_unit | Marginal thinking | tuner · optimize | Produce until marginal benefit meets marginal cost | Decisions depend on totals, not margins |
| crowded_factory | Diminishing returns | tuner · optimize | Add workers until the next one adds less than she costs | More workers always means proportionally more output |
| gdp_sorter | GDP components | sorter · bins | Sort transactions into C, I, G, NX, or not counted | Buying a used car counts toward GDP |
| policy_levers | Fiscal vs monetary policy | sorter · bins | Assign each lever to the central bank or the legislature | The president sets interest rates |
| business_cycle_wheel | Business cycle | sequencer · cycle | Turn the wheel through expansion, peak, contraction, trough | Recessions come out of nowhere |
| money_multiplier | Money creation (textbook model) | simulator · reach_state | Set the reserve ratio so deposits expand to the target | Banks keep every deposit in the vault |

### 6.21 Personal finance (`finance`)
| id | Concept | Family · mode | Player does | Misconception it breaks |
|---|---|---|---|---|
| compound_tower | Compound interest | tuner · formula | Choose the rate or years so the tower reaches the target | Interest grows by the same amount each year |
| credit_card_trap | Minimum payments & APR | truth_finder · predict_reveal | Predict the payoff time on minimum payments, then watch | Paying the minimum clears debt quickly |
| budget_balance | Budgeting | balance · ledger | Balance income against expenses and savings goals | Budgets only need to track big purchases |
| diversification_sim | Risk & diversification | simulator · sample | Build portfolios; watch thousands of market years | Diversifying lowers returns without lowering risk |

### 6.22 Psychology (`psychology`)
| id | Concept | Family · mode | Player does | Misconception it breaks |
|---|---|---|---|---|
| conditioning_lab | Classical vs operant conditioning | sorter · bins | Sort scenarios into classical or operant and label the parts | Negative reinforcement is punishment |
| reinforcement_schedule | Reinforcement schedules | simulator · predict | Predict response persistence under fixed vs variable schedules | Rewarding every time builds the most persistent habit |
| memory_stages | Memory model | sequencer · linear | Route information from sensory to short-term to long-term memory | Memory records like a video camera |
| bias_detector | Cognitive biases | linker · pairs | Match each scenario to the bias it shows | Only other people are biased |
| experiment_designer | Experimental design | sorter · bins | Label the IV, DV, controls, and confounds | Correlational studies show causes |
| brain_regions | Brain structure & function | linker · pairs | Match functions to brain regions | We only use 10% of our brain |
| maslow_tower | Hierarchy of needs | sorter · hierarchy | Stack needs into the tower's levels | Higher needs never matter until lower ones are fully met |

### 6.23 Philosophy & logic (`philosophy`)
| id | Concept | Family · mode | Player does | Misconception it breaks |
|---|---|---|---|---|
| syllogism_gate | Validity | truth_finder · counterexample | Find the counterexample world that breaks the invalid argument | True premises and a true conclusion make an argument valid |
| fallacy_duel | Fallacies | sorter · type_match | Parry each fallacy the Sophist throws with its name | An argument with a fallacy has a false conclusion |
| argument_map | Argument structure | investigator · argument | Connect premises to the conclusion; cut the irrelevant ones | More premises make a stronger argument |
| ethics_lenses | Ethical frameworks | sorter · bins | Sort judgments into utilitarian, deontological, or virtue reasoning | Deontology judges actions by their consequences |
| truth_table_logic | Propositional logic | builder · circuit | Fill the truth table for the compound statement | "If P then Q" means "if Q then P" |

### 6.24 Literature (`literature`)
| id | Concept | Family · mode | Player does | Misconception it breaks |
|---|---|---|---|---|
| plot_arc | Plot structure | sequencer · linear | Place scenes along exposition → rising action → climax → resolution | The climax is the ending |
| character_motive | Characterization & motive | investigator · perspective | Match actions and quotes to each character's motive | Characters always say what they mean |
| device_hunter | Literary devices | sorter · type_match | Tag each passage's device as it scrolls past | Every comparison is a metaphor |
| theme_evidence | Theme | investigator · argument | Support a theme claim with passages from the text | The theme is the topic |
| unreliable_narrator | Narrative reliability | investigator · source_eval | Flag where the narrator's account conflicts with the facts | The narrator is the author |
| setting_map | Setting | mapper · map | Place key events on the story's map | Setting is just backdrop |

### 6.25 Writing & rhetoric (`writing`)
| id | Concept | Family · mode | Player does | Misconception it breaks |
|---|---|---|---|---|
| thesis_forge | Arguable thesis | truth_finder · mimic | Expose the "thesis" that's really a statement of fact | A thesis announces the topic |
| appeal_sorter | Ethos, pathos, logos | sorter · bins | Sort ad lines by rhetorical appeal | Pathos means manipulating with emotion |
| paragraph_builder | Paragraph structure | sequencer · linear | Order claim, evidence, analysis, transition | Evidence speaks for itself |
| evidence_fit | Supporting evidence | investigator · argument | Choose evidence that actually supports the claim | Any quote on the topic is evidence |
| transition_bridge | Transitions | linker · pairs | Match transitions to the relationship each signals | "However" and "therefore" are interchangeable |
| grammar_trap | Grammar & usage | truth_finder · error_hunt | Find the sentence with the error | Commas go wherever you pause |
| citation_builder | Citation format | builder · sentence | Arrange citation elements in MLA or APA order | Every style orders elements the same way |

### 6.26 World languages (`language`)
| id | Concept | Family · mode | Player does | Misconception it breaks |
|---|---|---|---|---|
| spell_syntax | Grammar & conjugation | builder · sentence | Cast spells by building correctly conjugated sentences; ElevenLabs voices them back | Word order matches English |
| rune_recall ★ | Vocabulary | recall · rapid | Type the term to fire the spell; cooldowns follow spacing | Recognizing a word means you know it |
| echo_chamber | Listening | recall · listen | Parry enemies by translating what they shout | Reading skill equals listening skill |
| context_clues | Vocabulary in context | recall · cloze | Fill the blank in a native sentence | Every word translates one-to-one |
| gender_gates | Noun gender / classes | sorter · bins | Only the matching-gender gate opens for each noun | Grammatical gender follows meaning |
| conjugation_forge | Verb conjugation | transformer · function_machine | Feed person + tense; predict the machine's verb form | Irregular verbs follow the regular pattern |
| word_order_bridge | Syntax | sequencer · linear | Lay word planks in grammatical order | Adjectives always come before nouns |
| false_friends | False cognates | truth_finder · mimic | Expose the chest whose translation is a false friend | Similar-looking words mean the same thing |
| guard_dialogue | Conversational phrases | recall · cloze | Talk past the guard by choosing natural replies | Textbook phrases are what natives say |

### 6.27 Music (`music`)
| id | Concept | Family · mode | Player does | Misconception it breaks |
|---|---|---|---|---|
| interval_echo | Intervals | recall · listen | Hear two notes; name the interval to open the door | An interval is named by its letters alone |
| rhythm_bridge | Meter & note values | builder · tiles | Fill each measure so the note values sum to the time signature | A measure can hold any number of beats |
| scale_builder | Major & minor scales | builder · tiles | Build the scale from the whole/half-step pattern | Every scale uses only white keys |
| chord_forge | Triads | builder · tiles | Stack thirds to forge the requested chord | Any three notes make a triad |
| fifths_wheel | Circle of fifths | sequencer · cycle | Rotate the wheel so each key is a fifth from the last | Keys are ordered alphabetically |
| tempo_sync | Tempo | tuner · oscillator (frequency) | Match the drum's beats per minute to the march | Tempo means loudness |

### 6.28 Art & art history (`art`)
| id | Concept | Family · mode | Player does | Misconception it breaks |
|---|---|---|---|---|
| color_mixer | Subtractive color mixing | tuner · formula | Mix paint ratios to hit the target swatch | Mixing more paint colors makes brighter colors |
| vanishing_point | Linear perspective | mapper · plane | Place the vanishing point so the corridor reads correctly | Parallel lines stay parallel in a drawing |
| movement_sorter | Art movements | sorter · bins | Sort described works into movements by their features | Movements are defined by date alone |
| gallery_timeline | Art chronology | sequencer · timeline | Hang works in chronological order | Styles replace each other cleanly |

### 6.29 Business & accounting (`business`)
| id | Concept | Family · mode | Player does | Misconception it breaks |
|---|---|---|---|---|
| accounting_equation | Accounting equation | balance · ledger | Post each transaction so assets = liabilities + equity | Revenue is the same as cash |
| break_even | Break-even analysis | tuner · formula | Set the price so the stand breaks even at expected sales | Covering variable costs means profit |
| supply_chain_flow | Supply chains | linker · network | Link suppliers, factories, and stores; find the bottleneck | A link can fail without affecting the others |
| marketing_funnel | Conversion funnel | simulator · reach_state | Tune conversion at each stage to hit the sales target | More traffic always fixes low sales |

### 6.30 Law (`law`): educational content only, never legal advice
| id | Concept | Family · mode | Player does | Misconception it breaks |
|---|---|---|---|---|
| elements_check | Elements of a claim or offense | investigator · elimination | Every element must be shown; eliminate charges that fail one | Proving most elements is enough |
| precedent_match | Precedent | linker · pairs | Match fact patterns to the holding that governs them | Every case is decided from scratch |
| contract_elements | Contract formation | truth_finder · counterexample | Find the scenario missing consideration or acceptance | Any promise is a contract |

## 7. Flagship cards: how each looks in every genre

Build these first. The first nine need only wave-1 families.

| Card | Dungeon | Mystery | Platformer | Puzzle | Strategy |
|---|---|---|---|---|---|
| mimic_chest (truth_finder · mimic, universal fallback) | Three chests; the false claim bites | One witness's story contradicts the facts; object | Three doors; the false one collapses | Remove the odd tile to free the chain | Advisors' claims; the false one tanks a stat |
| chrono_bridge (sequencer · linear) | Glyph door pressed in process order | Rebuild the night's timeline on the corkboard | Planks are steps; the wrong order leaves a gap | Order parcels on the conveyor | Order the tech tree to unlock the building |
| phase_gate ★ | Vault door of rings spinning on f(t) | Set the lighthouse sweep period to signal the ship | Saw-wheel gap faces you only at the right period | Tiles rotate every n turns; align on turn k | Sync generator cycles to avoid brownouts |
| number_line_leap ★ | Archery range: damage scales with closeness | Auction: bid the right order of magnitude | The floor is a number line; land on the value | Place tiles at their true relative positions | Price goods on the market line |
| type_matched_weapon (sorter · type_match) | Weapon modes are categories; only the right one hurts | File each claim in the right case folder before the chief arrives | Switch ammo type for each enemy | Push each crate onto its category pad | Route goods to the right districts |
| grapple_anchors (linker · pairs) | Chain lightning jumps only between matching pairs | String the corkboard | Only the anchor with the matching definition holds | Flow-style pairing without crossing lines | Connect suppliers to buyers |
| domino_engine ★ | Trigger the room's traps in causal order to hit the boss | String causes to consequences to reveal the motive | Place cause blocks so the chain hits the exit switch | Chain-reaction tiles | Policy chain: each decision triggers the next |
| evidence_board ★ | Rooms are hypotheses; clues seal their doors | Native: pin clues, eliminate suspects, accuse | Clues seal the doors of eliminated hypotheses | Einstein-style logic grid | Diagnose the failing colony |
| formula_engine ★ | Load the catapult to clear the wall, not into the lava | Recompute the pharmacist's dosage; find the fatal error | Heat the balloon until lift reaches the ledge | Set resistors so the bulb hits target brightness | Tune the plant's inputs to hit the output quota |
| decoy_destination ★ | Rune track: every path converges, the altar tile teleports | Sensor readings converge on one value; the exact timestamp reads wrong | Platforms converge on one height; the tile at a warps | Mechanical arms approach one socket; the socket itself is misplaced | Prices converge on a level, but the launch-day price spikes |
| balance_chamber ★ | Alchemy altar forges the key only when balanced | The merchant's ledger is off by one entry | Seesaw bridge levels only when both pans match | Cancel terms until x stands alone | Budget ledger must balance each turn |
| atom_conservation ★ | Leftover atoms spill out as slimes | The chemist's notebook fails a conservation check | Atom tokens must balance before the lift moves | Atom grid: balance to open the vault | Reactor inputs must conserve atoms |
| feedback_controller ★ | Keep the reactor room in range during a wave fight | Keep the patient stable through the night | Ride the glucose platform inside the safe band | Balance three meters with limited moves | Keep the colony's stability index in range |
| protein_factory ★ | Translate the mRNA carved on the door into the password | Decode the geneticist's notes | Codon platforms: step on them in reading frame | Route codon tiles to amino-acid bins | Ribosome factory line |
| logic_factory ★ | Restore the generator room | Hack the lab's door panel | Wire gates to power the elevator | Native circuit grid | Automate the factory with logic |
| cycle_wheel (sequencer · cycle) | A loop of rooms rotates one stage per clear | Restore the village's seasonal festival | Ring-shaped level; trigger stages in order | Rotate rings until the stages line up | Seasonal production cycle |
| tile_the_region ★ | Fill the vault's curved ceiling with blocks | Estimate the spill's area from survey strips | Build a block staircase under the curved ceiling | Tile pieces under the curve | Estimate harvest area for the quota |
| rune_recall ★ | Spells are flashcards; cooldowns are spacing | The riddle-keeper's rapid-fire interrogation | Type the term to trigger a double jump | Timed word tiles | Quick recall boosts research speed |

`mimic_chest`, `chrono_bridge`, `type_matched_weapon`, `grapple_anchors`, and `cycle_wheel` are generic cards, one per family·mode, usable for any concept of a matching knowledge type. Encode them in a `general` domain.

## 8. Cross-cutting systems (every genre)
- **Director weighting:** w = (core ? 2 : 1) × (6 − confidence).
  - Weak concepts appear 2 to 3 times, through different families.
  - One spaced review comes after ≥ 2 other encounters.
  - The boss is last and combines the 2 to 3 weakest concepts.
- **Misconception monsters:** enemies and NPCs voice the KnowledgeMap's misconceptions, and the player defeats them with the correction.
- **Hint familiar:** a voiced sidekick runs the 3-tier hint ladder: nudge, then method, then nearly the answer.
- **Consequence overlay:** every miss shows the player's answer against the truth, never just "wrong".
- **Spaced return and roguelite reweighting:** a missed concept returns 2 to 3 encounters later through a different card. A failed run restarts with misses first.
- **Mastery meter:** per-concept HUD fed by telemetry. First try without hints gives +0.15, a later correct answer +0.08, each miss −0.05, clamped to 0–1.
- **Law-powered abilities** (stretch): mastering a concept grants a power that is the concept (a recoil jump from Newton's 3rd law, floating from buoyancy).
- **Teach-back totem** (stretch): explain the idea to a confused NPC; LLM-graded, bonus only.
- **Wildcard mechanic** (stretch, off by default): when no card fits, a coding model writes a mechanic module against the family interface. It runs in a sandboxed iframe and falls back to mimic_chest on any error.

## 9. Design rules every generated encounter must pass
1. **Attention test:** you can't win while ignoring the concept.
2. **Transfer test:** the debrief line names the concept outright and ties it to what the player did.
3. **The model writes primitives; code derives answers.**
   - Numbers come from mathjs.
   - Shuffles come from the spec seed.
   - Text refers to computed values only through `{{placeholders}}`.
   - Answer-revealing placeholders are banned from the prompt, the first hint, and wrongFeedback.
4. **Grounded:** facts carry a page and a verbatim quote, verified in code at ingest. Topic-only games are labeled "unsourced".
5. **Misconception-targeted:** when the concept lists misconceptions, the encounter's wrong options or failure states come from them.
6. **Informative failure** and a 3-tier hint ladder on every encounter.
7. **Winnable by construction:** self-solve passes, and the level is assembled from prefab chunks.

## 10. Card schema (how to encode section 6 as data)
```ts
interface TeachingMechanic {
  id: string;                 // snake_case, unique (the table's id column, minus ★)
  name: string;               // Title Case of id
  domain: Domain;             // from the section heading
  topic: string;              // e.g. "Calculus: limits & continuity"
  concept: string;            // the Concept column
  family: FamilyId;           // e.g. "function_world"
  mode: string;               // e.g. "limit"
  playerAction: string;       // the Player does column
  misconception: string;      // the Misconception column (belief that is false)
  learningInsight: string;    // one-sentence correction (write it while encoding)
  knowledgeTypes: KnowledgeType[]; // default from family/mode (4.1), override if obvious
  keywords: string[];         // concept words + common synonyms, lowercase
  flagship: boolean;          // ★
  lockedParams?: Record<string, unknown>; // e.g. phase_gate: { ask: "period" }
  authoringNotes?: string;    // extra guidance for the challenge writer
  genreNotes?: Partial<Record<Genre, string>>; // section 7 cells for flagships
}
```
