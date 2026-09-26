import type { ChallengeSlice } from "../src/contracts/slices";

/**
 * One realistic encounter per main-session mode that had no fixture yet (mechanics-dev overnight repair
 * pass, reviewer item "Generic leak test"), each on a real catalog card. Params are drawn from this
 * repo's own direct-mode unit tests (already known to pass `check()`), reformatted as `ChallengeSlice`s
 * per docs/overnight/wave1-modes.md's conventions. Consumed by:
 *  - tests/wave2d.test.ts (assemble + validate + autoSolve, like tests/wave2c.test.ts)
 *  - tests/answer-leak.test.ts (the generic per-mode answer-leak sweep), which also pulls params from
 *    every other fixtures/wave*.encounters.ts file for modes that already have one there.
 * No hint/prompt/wrongFeedback below uses a `{{placeholder}}`, so none of these risk leaking an answer var.
 */
export const WAVE2D: { cardId: string; slice: ChallengeSlice }[] = [
  {
    cardId: "protein_factory", // transformer.encode
    slice: {
      prompt: "Route each mRNA codon through the ribosome's codon table to build the amino acid chain.",
      params: {
        tableName: "codon table (mRNA codon → amino acid)",
        table: [
          { from: "AUG", to: "Met" },
          { from: "UUU", to: "Phe" },
          { from: "GGC", to: "Gly" },
          { from: "UAA", to: "Stop" },
          { from: "CCU", to: "Pro" },
          { from: "AAA", to: "Lys" },
        ],
        input: ["AUG", "UUU", "GGC", "UAA"],
        direction: "forward",
        tokenLabel: "codon",
        outputLabel: "amino acid",
        showTable: true,
      },
      hints: [
        "Read the codons left to right, one at a time.",
        "Each codon maps to exactly one row in the table; find that row.",
        "Work through all four codons before checking your chain.",
      ],
      wrongFeedback: "Recheck the codon at the position that's off against the table.",
      debriefLine: "The ribosome finishes the chain and releases the finished protein.",
      sourceRef: { page: 5, quote: "A group of three nucleotides, a codon, specifies one amino acid." },
    },
  },
  {
    cardId: "bucket_router", // transformer.function_machine
    slice: {
      prompt: "A machine takes a number in and applies a hidden rule. Watch it run, then predict its next output.",
      params: {
        rule: "2*x + 3",
        examples: ["1", "2", "5"],
        ask: "output",
        query: "10",
        ruleOptions: [],
        inputLabel: "input",
        outputLabel: "output",
      },
      hints: [
        "Compare each input to its output; look for a consistent pattern.",
        "Check whether the pattern is multiply-then-add or add-then-multiply.",
        "Apply the same rule to the new input.",
      ],
      wrongFeedback: "Run the rule you found on one of the known examples to check it still holds.",
      debriefLine: "The machine's rule holds for every input you tried.",
      sourceRef: null,
    },
  },
  {
    cardId: "state_containers", // transformer.trace
    slice: {
      prompt: "Trace this tiny program line by line and predict what it prints.",
      params: {
        program: ["x = 3", "y = x * 2", "x = x + 1", "print y"],
        ask: "output",
        variable: "",
        options: ["6", "8", "3"],
      },
      hints: [
        "Step through the program one line at a time, updating each variable as you go.",
        "Notice that y is computed BEFORE x changes again on the next line.",
        "print only shows what y held at that exact moment.",
      ],
      wrongFeedback: "Re-run the trace and note the value of y right when the print line executes.",
      debriefLine: "y was fixed before x changed again, so the print shows the earlier value.",
      sourceRef: null,
    },
  },
  {
    cardId: "unit_pipeline", // transformer.composition
    slice: {
      prompt: "Two machines can run in either order. Find the order that turns the input into the target.",
      params: {
        kind: "numeric",
        machines: [
          { id: "double", label: "Doubler", expr: "2*x", consumes: [], produces: [] },
          { id: "add3", label: "Add three", expr: "x + 3", consumes: [], produces: [] },
        ],
        input: "5",
        target: "16",
      },
      hints: [
        "Try running the machines on the input in each of the two possible orders.",
        "Order matters here: f(g(x)) is not always g(f(x)).",
        "Compute the result of each order and compare it to the target.",
      ],
      wrongFeedback: "Try the other order and see whether it reaches the target instead.",
      debriefLine: "Composition order matters: this pipeline only reaches the target in one order.",
      sourceRef: null,
    },
  },
  {
    cardId: "rune_recall", // recall.rapid
    slice: {
      prompt: "Translate each rune before the torch burns out.",
      params: {
        items: [
          { prompt: "el perro", answers: ["dog", "the dog"], hint: "an animal that barks" },
          { prompt: "la casa", answers: ["house", "the house", "home"], hint: "where you live" },
          { prompt: "el libro", answers: ["book", "the book"], hint: "you read it" },
        ],
        secondsPerItem: 8,
        direction: "Spanish → English",
      },
      hints: [
        "Answer quickly; small typos are forgiven.",
        "If you're stuck, picture the word's everyday use.",
        "The hint for each item describes what it does or is.",
      ],
      wrongFeedback: "Look at the item's hint and try a common English word for it.",
      debriefLine: "Every rune translated correctly before time ran out.",
      sourceRef: null,
    },
  },
  {
    cardId: "context_clues", // recall.cloze
    slice: {
      prompt: "Fill in the blank using the surrounding sentence as your clue.",
      params: {
        sentence: "Water moves toward the side with the higher ___ concentration.",
        answers: ["solute", "salt"],
        wordBank: ["water", "protein"],
        hint: "The dissolved stuff, not the liquid.",
      },
      hints: [
        "The sentence describes what water moves toward, not what water itself is.",
        "Think about what's dissolved in the water on each side.",
        "The word bank includes both plausible and implausible fillers.",
      ],
      wrongFeedback: "That filler doesn't match what the sentence is describing; reread the phrase around the blank.",
      debriefLine: "The word bank's tempting option was the solvent, not the dissolved substance.",
      sourceRef: { page: 4, quote: "Water moves toward the side with the higher solute concentration." },
    },
  },
  {
    cardId: "bug_hunter", // truth_finder.error_hunt
    slice: {
      prompt: "One line of this worked solution has a mistake. Find it.",
      params: {
        title: "Solving 2x + 3 = 11",
        lines: [
          { text: "2x + 3 = 11", isWrong: false, explanation: "The equation as given." },
          { text: "2x = 11 + 3", isWrong: true, explanation: "Moving +3 across must flip its sign: 2x = 11 − 3." },
          { text: "2x = 14", isWrong: false, explanation: "Follows from the previous line as written." },
          { text: "x = 7", isWrong: false, explanation: "Dividing both sides by 2." },
        ],
        fixedLine: "2x = 11 − 3",
      },
      hints: [
        "Check each line against the one right before it.",
        "Watch what happens to a term's sign when it crosses the equals sign.",
        "Only one line breaks that rule.",
      ],
      wrongFeedback: "That line follows correctly from the one before it; look elsewhere.",
      debriefLine: "Moving a term across the equals sign flips its sign; that step was skipped.",
      sourceRef: null,
    },
  },
  {
    cardId: "contract_elements", // truth_finder.counterexample
    slice: {
      prompt: "Here's a rule a student might over-believe. Find the case that breaks it.",
      params: {
        rule: "Every promise is a legally binding contract.",
        cases: [
          { text: "A shop agrees to sell a bike for $200 and the buyer pays", breaksRule: false, explanation: "Offer, acceptance and consideration are all present." },
          { text: "A friend promises to give you her old laptop for free", breaksRule: true, explanation: "No consideration flows back, so it is a gift promise, not a contract." },
          { text: "A freelancer agrees to build a site for $1,000", breaksRule: false, explanation: "Mutual promises with consideration on both sides." },
        ],
      },
      hints: [
        "A contract needs more than just a promise; check what each side gives up.",
        "Look for the case missing something flowing back the other way.",
        "The other two cases each have consideration on both sides.",
      ],
      wrongFeedback: "That case has consideration flowing both ways, so it satisfies the rule.",
      debriefLine: "A promise without consideration in return is a gift, not a contract.",
      sourceRef: null,
    },
  },
  {
    cardId: "gallery_timeline", // sequencer.timeline
    slice: {
      prompt: "Place these events in chronological order; one card is from another period entirely.",
      params: {
        events: [
          { text: "Voting Rights Act signed", date: "1965.6", dateLabel: "August 1965" },
          { text: "Brown v. Board decided", date: "1954", dateLabel: "May 1954" },
          { text: "March on Washington", date: "1963.65", dateLabel: "August 1963" },
          { text: "Civil Rights Act signed", date: "1964.5", dateLabel: "July 1964" },
        ],
        decoys: [{ text: "The 19th Amendment is ratified", dateLabel: "1920" }],
      },
      hints: [
        "One of the cards shown doesn't belong in this timeline at all.",
        "Set that card aside and order only the remaining four.",
        "Court decisions and legislation each carry their own year.",
      ],
      wrongFeedback: "Check whether the card you placed even belongs in this period.",
      debriefLine: "Each of these built directly on the one before it, within a decade.",
      sourceRef: null,
    },
  },
  {
    cardId: "graph_terrain", // tuner.curve
    slice: {
      prompt: "Dial in the line's slope and intercept so it passes through both checkpoints on the terrain.",
      params: {
        template: "linear",
        target: [
          { name: "m", value: "2" },
          { name: "b", value: "-1" },
        ],
        ranges: [
          { name: "m", min: -5, max: 5 },
          { name: "b", min: -5, max: 5 },
        ],
        xMin: "0",
        xMax: "6",
      },
      hints: [
        "Adjust the slope first so the line rises at the right rate.",
        "Then shift the intercept up or down until it passes through both checkpoints.",
        "Both parameters need to be set together; one alone won't line it up.",
      ],
      wrongFeedback: "One of the two checkpoints is still missed; adjust the other parameter too.",
      debriefLine: "Both the slope and the intercept had to move to hit both checkpoints.",
      sourceRef: null,
    },
  },
  {
    cardId: "opportunity_fork", // tuner.optimize
    slice: {
      prompt: "Find the staffing level that maximizes output per hour.",
      params: {
        objective: "x * (12 - x)",
        goal: "max",
        xMin: "0",
        xMax: "12",
        inputName: "workers",
        outputName: "output per hour",
      },
      hints: [
        "Try a few staffing levels across the whole range and compare output.",
        "The best level is somewhere in the middle, not at either end.",
        "Nudge your guess up or down and see whether output improves.",
      ],
      wrongFeedback: "Output can still improve; try moving your guess in the direction that raised it last time.",
      debriefLine: "Too few or too many workers both cost you output; the peak sits in between.",
      sourceRef: null,
    },
  },
  {
    cardId: "lever_door", // balance.torque
    slice: {
      prompt: "Slide the movable mass until the lever balances at the pivot.",
      params: {
        fixed: [{ mass: "4", position: "2" }],
        movable: { mass: "2" },
        pivot: "5",
        ask: "position",
        rangeMin: "0",
        rangeMax: "12",
        unit: "m",
      },
      hints: [
        "A mass on one side of the pivot twists the lever; a mass farther away twists it more.",
        "The two torques need to cancel exactly for the lever to balance.",
        "Move the mass to the side that fights the fixed mass's twist.",
      ],
      wrongFeedback: "The lever still tips; the torques on each side aren't equal yet.",
      debriefLine: "Torque is mass times distance from the pivot, and the two sides now cancel exactly.",
      sourceRef: null,
    },
  },
  {
    cardId: "reaction_factory", // balance.ratio
    slice: {
      prompt: "Given what's on the shelf, find the limiting reagent and how much product you can make.",
      params: {
        recipe: [
          { name: "propane", amount: "1", unit: "mol" },
          { name: "oxygen", amount: "5", unit: "mol" },
        ],
        available: [
          { name: "propane", amount: "2" },
          { name: "oxygen", amount: "6" },
        ],
        product: { name: "carbon dioxide", perBatch: "3", unit: "mol" },
        ask: "both",
      },
      hints: [
        "Divide what's available of each reactant by its amount in one batch of the recipe.",
        "Whichever reactant supports the FEWEST batches runs out first.",
        "Scale the product's per-batch amount by however many batches that reactant allows.",
      ],
      wrongFeedback: "Having more available doesn't mean a reactant lasts longer; compare batches, not raw amounts.",
      debriefLine: "The reactant that supports the fewest batches runs out first and caps the product.",
      sourceRef: { page: 2, quote: "The limiting reagent is the reactant that runs out first, capping how much product forms." },
    },
  },
  {
    cardId: "causal_weighting", // investigator.weigh
    slice: {
      prompt: "Rank these causes of the Voting Rights Act's passage from most to least decisive.",
      params: {
        question: "Why did the Voting Rights Act pass in 1965?",
        causes: [
          { text: "Televised violence at Selma", weight: "5", why: "Johnson introduced the bill eight days after Bloody Sunday." },
          { text: "Years of local voter-registration organizing", weight: "4", why: "SNCC and local leaders built the campaign Selma made visible." },
          { text: "King's 'I Have a Dream' speech", weight: "2", why: "Famous, but two years earlier and aimed at the 1964 bill." },
        ],
      },
      hints: [
        "Consider how close in time each cause sits to the actual legislative response.",
        "A famous event isn't automatically the most decisive one.",
        "Check what happened in the days right before the bill was introduced.",
      ],
      wrongFeedback: "That cause is well known, but check how directly and quickly it connects to the bill's introduction.",
      debriefLine: "The most decisive cause was the one closest in time to the bill's introduction.",
      sourceRef: null,
    },
  },
  {
    cardId: "source_seer", // investigator.source_eval
    slice: {
      prompt: "Rank these sources on the Selma march by how reliable each one is.",
      params: {
        question: "What happened on the Edmund Pettus Bridge?",
        sources: [
          { text: "A trooper's official report written the next day", reliability: 2, cues: "Written by a participant with an incentive to justify the force used." },
          { text: "Film footage broadcast by ABC that evening", reliability: 5, cues: "A direct recording, corroborated by many eyewitnesses." },
          { text: "A 2001 history book on the movement", reliability: 4, cues: "Secondary but synthesizes many corroborated primary sources." },
          { text: "A rumor reported in a distant newspaper a week later", reliability: 1, cues: "Second-hand, late, uncorroborated." },
        ],
      },
      hints: [
        "A direct recording usually beats a written account with something to gain or lose.",
        "A synthesis of many corroborated sources can outrank a single biased eyewitness.",
        "Late, secondhand rumors sit at the bottom.",
      ],
      wrongFeedback: "Consider who made that source and what incentive or distance from the event they had.",
      debriefLine: "Directness, corroboration, and the source's incentives all shift reliability.",
      sourceRef: null,
    },
  },
  {
    cardId: "perspective_switch", // investigator.perspective
    slice: {
      prompt: "Match each quoted account to the person whose motive it actually serves.",
      params: {
        actors: [
          { id: "governor", name: "Governor Faubus", motive: "Keep segregationist voters on his side before an election" },
          { id: "student", name: "Elizabeth Eckford", motive: "Attend the school the court said she could" },
        ],
        accounts: [
          { text: "I ordered the Guard to preserve order and prevent violence.", actorId: "governor", why: "Framing exclusion as public safety served the election motive." },
          { text: "I just wanted to go to class like everyone else.", actorId: "student", why: "The court order and her own education were the point." },
          { text: "The federal government has no business in Arkansas's schools.", actorId: "governor", why: "States' rights rhetoric appealed to his voters." },
        ],
      },
      hints: [
        "Ask what each speaker had to gain from saying this.",
        "One actor speaks about attending school; the other about controlling the situation.",
        "States' rights language served a specific political motive.",
      ],
      wrongFeedback: "That quote doesn't serve the motive of the person you assigned it to; reread their goal.",
      debriefLine: "Each quote's framing lines up with exactly one actor's underlying motive.",
      sourceRef: null,
    },
  },
  {
    cardId: "counterevidence_attack", // investigator.argument
    slice: {
      prompt: "Sort this evidence: which pieces support the claim, which counter it, and which are weak or irrelevant.",
      params: {
        claim: "Television coverage was decisive for the Civil Rights Act of 1964.",
        evidence: [
          { text: "Kennedy proposed the bill weeks after the Birmingham images aired", role: "supports", why: "Timing links the coverage to the political response." },
          { text: "Polls showed civil rights jumping to the top national issue after Birmingham", role: "supports", why: "Measured opinion shift right after the coverage." },
          { text: "Television sets were in most American homes by 1963", role: "weak", why: "Shows reach, not effect on the bill." },
          { text: "Congress had debated civil rights bills since 1957 without passing one", role: "counter", why: "Suggests factors other than coverage were needed; the claim must be qualified." },
          { text: "Birmingham's steel industry declined in the 1970s", role: "irrelevant", why: "Different decade, different topic." },
        ],
      },
      hints: [
        "Ask whether each piece shows a cause-and-effect link to the bill, or just a coincidence in time.",
        "Reach and availability aren't the same as proven effect.",
        "A fact from a different decade or industry usually doesn't bear on this claim at all.",
      ],
      wrongFeedback: "Reconsider whether that piece actually links to the bill's passage, or just describes something else.",
      debriefLine: "The strongest evidence ties the coverage directly, and quickly, to the political response.",
      sourceRef: null,
    },
  },
  {
    cardId: "federalism_venn", // sorter.venn
    slice: {
      prompt: "Place each power into federal, state, both, or neither.",
      params: {
        sets: [
          { id: "federal", label: "Federal", feature: "powers given to the national government" },
          { id: "state", label: "State", feature: "powers reserved to the states" },
        ],
        items: [
          { text: "Coin money", setIds: ["federal"], why: "Article I, Section 8." },
          { text: "Run public schools", setIds: ["state"], why: "Reserved to the states." },
          { text: "Collect taxes", setIds: ["federal", "state"], why: "Both levels tax." },
          { text: "Grant titles of nobility", setIds: [], why: "Forbidden to both." },
        ],
      },
      hints: [
        "Some powers belong to only one level of government; some belong to both.",
        "A few powers are forbidden to both levels entirely.",
        "Check the Constitution's list of powers before placing an item in only one region.",
      ],
      wrongFeedback: "That power actually belongs to both levels; check the overlapping region.",
      debriefLine: "Some powers are concurrent, exercised by both federal and state governments at once.",
      sourceRef: null,
    },
  },
  {
    cardId: "taxonomy_tower", // sorter.hierarchy
    slice: {
      prompt: "Place each classification at its correct level of the taxonomy.",
      params: {
        levels: ["Kingdom", "Phylum", "Class", "Order"],
        items: [
          { text: "Animalia", level: "Kingdom", why: "All animals." },
          { text: "Chordata", level: "Phylum", why: "Animals with a notochord." },
          { text: "Mammalia", level: "Class", why: "Chordates with hair and milk." },
          { text: "Carnivora", level: "Order", why: "A group within mammals." },
        ],
      },
      hints: [
        "Broader categories sit higher in the tower; narrower ones sit lower.",
        "A group defined by a very specific shared trait belongs lower than one defined broadly.",
        "Each level narrows down from the one above it.",
      ],
      wrongFeedback: "That classification is narrower or broader than the level you placed it at; check its defining trait.",
      debriefLine: "Each level narrows the group by one more shared, defining trait.",
      sourceRef: null,
    },
  },
  {
    cardId: "supply_chain_flow", // linker.network
    slice: {
      prompt: "Wire up the food web: draw an edge from each animal to what it eats.",
      params: {
        relation: "eats",
        directed: true,
        nodes: [
          { id: "grass", label: "Grass" },
          { id: "rabbit", label: "Rabbit" },
          { id: "fox", label: "Fox" },
        ],
        edges: [
          { from: "rabbit", to: "grass", why: "Rabbits graze." },
          { from: "fox", to: "rabbit", why: "Foxes hunt rabbits." },
        ],
      },
      hints: [
        "Each animal needs exactly one outgoing edge to what it eats.",
        "Grass doesn't eat anything else in this web.",
        "Direction matters: the arrow points from eater to eaten.",
      ],
      wrongFeedback: "Check the direction of that edge and what the animal at its tail actually eats.",
      debriefLine: "Energy flows up the chain, from producer to consumer to predator.",
      sourceRef: null,
    },
  },
  {
    cardId: "weighted_path_planner", // linker.path
    slice: {
      prompt: "Find the cheapest route from the Camp to the Keep, in hours, not just the fewest stops.",
      params: {
        nodes: [
          { id: "a", label: "Camp" },
          { id: "b", label: "Bridge" },
          { id: "c", label: "Cave" },
          { id: "d", label: "Keep" },
        ],
        edges: [
          { from: "a", to: "d", weight: "10" },
          { from: "a", to: "b", weight: "2" },
          { from: "b", to: "c", weight: "2" },
          { from: "c", to: "d", weight: "2" },
        ],
        directed: false,
        start: "a",
        goal: "d",
        ask: "shortest",
        costName: "hours",
      },
      hints: [
        "The direct route isn't always the cheapest one.",
        "Add up the hours along a few different routes before picking one.",
        "A route with more stops can still cost less overall.",
      ],
      wrongFeedback: "That route costs more hours than another path that goes through more stops.",
      debriefLine: "The route through more stops actually costs fewer hours overall.",
      sourceRef: null,
    },
  },
  {
    cardId: "half_split_hunt", // mapper.search
    slice: {
      prompt: "Find the hidden page number by guessing and narrowing the range each time.",
      params: { min: "1", max: "64", hidden: "37", maxProbes: 7, thingName: "the page" },
      hints: [
        "Guess the middle of the current range, not the edges.",
        "Each guess should cut the remaining range roughly in half.",
        "You have a limited number of guesses; use them efficiently.",
      ],
      wrongFeedback: "That guess doesn't use your remaining probes efficiently; try the middle of what's left.",
      debriefLine: "Halving the range each time finds it in the fewest possible guesses.",
      sourceRef: null,
    },
  },
  {
    cardId: "approach_target", // function_world.limit
    slice: {
      prompt: "Approach x = 2 from both sides on this curve and read off the height it's heading toward.",
      params: {
        xMin: "-1",
        xMax: "5",
        side: "both",
        overrides: [],
        pieces: [{ expr: "x^2 - 1", from: "-inf", to: "inf", openLeft: true, openRight: true }],
        a: "2",
      },
      hints: [
        "Trace the curve as x gets closer and closer to 2 from both directions.",
        "The two sides should be heading toward the same height here.",
        "The limit is the height both sides approach, whether or not a point sits exactly there.",
      ],
      wrongFeedback: "Check the height the curve approaches from BOTH directions, not just one.",
      debriefLine: "Approaching from either side, the curve heads toward the same height.",
      sourceRef: null,
    },
  },
  {
    cardId: "sea_level_roots", // function_world.roots
    slice: {
      prompt: "Mark every point where this curve crosses sea level.",
      params: {
        pieces: [{ expr: "x^2 - 4", from: "-inf", to: "inf", openLeft: true, openRight: true }],
        xMin: "-5",
        xMax: "5",
      },
      hints: [
        "A crossing happens wherever the curve's height switches from positive to negative or back.",
        "This curve crosses more than once; scan the whole visible range.",
        "A point where the curve merely touches sea level without crossing doesn't count the same way.",
      ],
      wrongFeedback: "You found where it crosses ONCE, but check the rest of the range for another crossing.",
      debriefLine: "This curve crosses sea level at two separate points.",
      sourceRef: null,
    },
  },
  {
    cardId: "long_horizon", // function_world.asymptote
    slice: {
      prompt: "Follow this curve out toward the far right and read the height it settles toward.",
      params: {
        pieces: [{ expr: "(2*x + 1)/(x - 3)", from: "-inf", to: "inf", openLeft: true, openRight: true }],
        direction: "pos_inf",
        xMin: "4",
        xMax: "40",
      },
      hints: [
        "Compare how the top and bottom of the fraction grow as x gets very large.",
        "The curve flattens out toward one specific height, not zero and not infinity.",
        "Plug in a very large x and see what height it's close to.",
      ],
      wrongFeedback: "That's not the height it settles toward; try an even larger x and compare.",
      debriefLine: "For large x, the ratio of the leading terms sets the height the curve settles toward.",
      sourceRef: null,
    },
  },
  {
    cardId: "unbroken_track", // function_world.continuity
    slice: {
      prompt: "Find every break in this track: a hole, a jump, or a point where it shoots off to infinity.",
      params: {
        pieces: [
          { expr: "x", from: "-inf", to: "1", openLeft: true, openRight: true },
          { expr: "x + 2", from: "1", to: "inf", openLeft: false, openRight: true },
        ],
        overrides: [{ x: "-1", y: null }],
        xMin: "-3",
        xMax: "4",
        ask: "find",
        a: "0",
      },
      hints: [
        "Scan the whole visible range for anywhere the track doesn't connect smoothly.",
        "A hole is a single missing point; a jump is where the two sides don't meet.",
        "There is more than one break here.",
      ],
      wrongFeedback: "One break is still unaccounted for; keep scanning the rest of the range.",
      debriefLine: "This track has a removable hole at one point and a jump at another.",
      sourceRef: null,
    },
  },
  {
    cardId: "speed_snapshot", // function_world.secant
    slice: {
      prompt: "Shrink the window around x = 3 and watch the average rate close in on the instantaneous rate.",
      params: {
        pieces: [{ expr: "x^2", from: "-inf", to: "inf", openLeft: true, openRight: true }],
        a: "3",
        windows: ["2", "1", "1/2", "1/10"],
        xMin: "0",
        xMax: "6",
        quantity: "position (m)",
      },
      hints: [
        "Each window gives an AVERAGE rate over that stretch, not the exact rate at x = 3.",
        "As the window shrinks, the average rate should be converging toward one number.",
        "The instantaneous rate is what that sequence of averages is heading toward.",
      ],
      wrongFeedback: "That's the average rate over one particular window, not what the sequence converges to.",
      debriefLine: "As the window shrinks toward zero, the average rate converges to the instantaneous rate.",
      sourceRef: null,
    },
  },
  {
    cardId: "energy_ledger", // accumulator.signed
    slice: {
      prompt: "Total the signed area under this curve from x = 0 to x = 3, counting area below the axis as negative.",
      params: { expr: "x^2 - 4", a: "0", b: "3", ask: "net" },
      hints: [
        "Part of this curve dips below the axis over this interval.",
        "Area below the axis subtracts from the total instead of adding.",
        "Add the area above the axis and subtract the area below it.",
      ],
      wrongFeedback: "That total counts every region as positive; the part below the axis should subtract instead.",
      debriefLine: "Below-axis area counts negative, so the net total is smaller than the total area alone.",
      sourceRef: null,
    },
  },
  {
    cardId: "resource_collector", // accumulator.rate_total
    slice: {
      prompt: "Ore comes in at a changing rate. Starting from 10 kg on hand, find the total after 4 hours.",
      params: { rateExpr: "4 - x/2", t0: "0", t1: "4", initial: "10", quantityName: "ore", unit: "kg" },
      hints: [
        "The rate isn't constant, so you can't just multiply one rate by the time.",
        "The change over the interval is the area under the rate curve.",
        "Add that change to the starting amount.",
      ],
      wrongFeedback: "That treats the rate as constant; it actually changes over the interval, so use the area under it.",
      debriefLine: "The total is the starting amount plus the area under the changing rate.",
      sourceRef: null,
    },
  },
  {
    cardId: "level_the_reservoir", // accumulator.average_value
    slice: {
      prompt: "If this curve's height were leveled flat over [0, 3], find that flat height.",
      params: { expr: "x^2", a: "0", b: "3" },
      hints: [
        "The average value isn't just the average of the two endpoint heights.",
        "It's the flat height whose rectangle has the same area as the curve over this interval.",
        "Find the area under the curve first, then divide by the interval's width.",
      ],
      wrongFeedback: "That's the average of the two endpoints, but the curve isn't a straight line between them.",
      debriefLine: "The average value is the area under the curve divided by the interval's width.",
      sourceRef: null,
    },
  },
  {
    cardId: "energy_barrier", // simulator.reach_state
    slice: {
      prompt: "Dial in the growth factor r so the population hits the target value at tick 5.",
      params: {
        system: {
          variables: [
            { name: "pop", initial: "100", unit: "cells", min: null, max: null },
            { name: "r", initial: "1.1", unit: "", min: null, max: null },
          ],
          rules: [{ target: "pop", expr: "pop * r" }],
          ticks: 10,
        },
        control: { variable: "r", min: "1", max: "2", step: "1/10" },
        target: { variable: "pop", value: "100 * 1.5^5", tolerance: "20" },
        atTick: 5,
      },
      hints: [
        "A higher growth factor makes the population grow faster tick by tick.",
        "Run the simulation forward to tick 5 and compare against the target.",
        "Nudge the dial up if you land below the target, down if you land above it.",
      ],
      wrongFeedback: "At tick 5 the population lands below the target; try a higher growth factor.",
      debriefLine: "A growth factor a little above 1 compounds a lot by tick 5.",
      sourceRef: null,
    },
  },
  {
    cardId: "number_line_leap", // mapper.number_line (no other fixture covers this mode)
    slice: {
      prompt: "Land on the target value using only the coarse landmarks marked on the line.",
      params: { scale: "log", min: "10^-3", max: "10^6", target: "10^3.5", landmarkStep: "3", labels: "power" },
      hints: [
        "Each labeled landmark is a power of ten, not an evenly spaced count.",
        "The target sits between two of the labeled powers; find which two.",
        "It lands roughly a third of the way between those two powers on a log scale.",
      ],
      wrongFeedback: "That's on the wrong side of one of the labeled powers; check which two landmarks bracket the target.",
      debriefLine: "On a log scale, equal spacing means equal FACTORS, not equal differences.",
      sourceRef: null,
    },
  },
  {
    cardId: "chrono_bridge", // sequencer.linear (no other fixture covers this mode)
    slice: {
      prompt: "Place these steps in the order the process actually happens; one plank doesn't belong.",
      params: { steps: ["Gather materials", "Mix the batter", "Bake at 350°F", "Cool on a rack"], decoys: ["Frost the cake"] },
      hints: [
        "One plank shown isn't part of this particular process.",
        "Some steps have to physically happen before others can even start.",
        "Set the odd plank aside and order only the ones that belong.",
      ],
      wrongFeedback: "That plank isn't part of this process, or it's in the wrong spot; check what has to come right before it.",
      debriefLine: "Each step here depends on the material state the previous step left behind.",
      sourceRef: null,
    },
  },
  {
    cardId: "phase_gate", // tuner.oscillator (no other fixture covers this mode)
    slice: {
      prompt: "Dial the wave's period so the vault's rings lock into place.",
      params: { wave: "sin", amplitude: 2, b: "pi/2", c: "pi/4", d: 1, ask: "period" },
      hints: [
        "The period is how long it takes the wave to complete one full cycle.",
        "A bigger multiplier on t inside the wave squeezes the cycle shorter, not longer.",
        "Read the coefficient in front of t and use it to find the cycle length.",
      ],
      wrongFeedback: "That period doesn't match how tightly this wave is squeezed; check the coefficient on t again.",
      debriefLine: "A larger coefficient on t compresses the wave into a shorter period.",
      sourceRef: null,
    },
  },
  {
    cardId: "mimic_chest", // truth_finder.mimic (no other fixture covers this mode)
    slice: {
      prompt: "Three chests, one lie. Point your lantern at the one making a false claim.",
      params: {
        statements: [
          { text: "Water boils at 100 °C at sea level", isTrue: true, explanation: "Standard pressure." },
          { text: "Water always boils at 100 °C", isTrue: false, explanation: "Boiling point drops with pressure." },
          { text: "Water boils at a lower temperature on a mountain", isTrue: true, explanation: "Lower pressure." },
        ],
      },
      hints: [
        "Two of these claims agree with each other; one contradicts them.",
        "Think about what changes at high altitude.",
        "Altitude changes atmospheric pressure, which shifts the boiling point.",
      ],
      wrongFeedback: "That chest's claim actually holds up; look for the one that contradicts the others.",
      debriefLine: "Boiling point isn't fixed: it shifts with pressure, so 'always' was the tell.",
      sourceRef: null,
    },
  },
];
