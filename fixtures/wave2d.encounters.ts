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
      prompt: "Turn each mRNA codon, a group of three letters, into its amino acid. Use the codon table.",
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
        "The first codon is AUG. Find it in the table's left column.",
        "Each codon matches one row. The amino acid in that row goes into the chain.",
        "Do UUU, then GGC, then UAA the same way. Keep them in that order.",
      ],
      wrongFeedback: "Look up the codon that's off in the table again.",
      debriefLine: "The ribosome finished the chain. Each codon added one amino acid until UAA said stop.",
      sourceRef: { page: 5, quote: "A group of three nucleotides, a codon, specifies one amino acid." },
    },
  },
  {
    cardId: "bucket_router", // transformer.function_machine
    slice: {
      prompt: "This machine does the same thing to every number. Watch it, then predict what it gives for 10.",
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
        "Look at 1 → 5 and 2 → 7. One more going in gives two more coming out.",
        "So the machine doubles first. Double 1 is 2, so what gets you from 2 to 5?",
        "Check double-then-add-3 on 5 → 13. Then use it on 10.",
      ],
      wrongFeedback: "Try your rule on one of the examples first. It has to work on all of them.",
      debriefLine: "The rule was double it, then add 3. It works on every number you tried.",
      sourceRef: null,
    },
  },
  {
    cardId: "state_containers", // transformer.trace
    slice: {
      prompt: "Trace this short program one line at a time. What does it print?",
      params: {
        program: ["x = 3", "y = x * 2", "x = x + 1", "print y"],
        ask: "output",
        variable: "",
        options: ["6", "8", "3"],
      },
      hints: [
        "y gets its value on line 2, before x changes. Note what x is at that moment.",
        "Line 3 changes x to 4. Ask whether that changes y too.",
        "Changing x later doesn't go back and change y. So what did y hold after line 2?",
      ],
      wrongFeedback: "Check y when the print line runs. Line 3 changed x, but it never touched y.",
      debriefLine: "y was set before x changed, so it kept its old value.",
      sourceRef: null,
    },
  },
  {
    cardId: "unit_pipeline", // transformer.composition
    slice: {
      prompt: "Two machines can run in either order. Find the order that turns 5 into 16.",
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
        "There are only two orders to try. Doubler first, or Add three first.",
        "Work out one order at a time. Start with 5 and run it through both machines.",
        "Doubler first gives 5 × 2 + 3 = 13. That misses 16.",
      ],
      wrongFeedback: "That order doesn't reach 16. Try the other one.",
      debriefLine: "Order matters here. Only one order turns 5 into 16.",
      sourceRef: null,
    },
  },
  {
    cardId: "rune_recall", // recall.rapid
    slice: {
      prompt: "Translate each Spanish word before the torch burns out.",
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
        "\"El\" and \"la\" both just mean \"the\". Focus on the word after them.",
        "Use the clue under each word. \"You read it\" points to something with pages.",
        "Type one plain English word for each. Small typos are OK.",
      ],
      wrongFeedback: "Read that word's clue and try a common English word for it.",
      debriefLine: "You translated every Spanish word before time ran out.",
      sourceRef: null,
    },
  },
  {
    cardId: "context_clues", // recall.cloze
    slice: {
      prompt: "Fill in the blank. Use the rest of the sentence as your clue.",
      params: {
        sentence: "Water moves toward the side with the higher ___ concentration.",
        answers: ["solute", "salt"],
        wordBank: ["water", "protein"],
        hint: "It's the stuff dissolved in the water.",
      },
      hints: [
        "The blank comes right before \"concentration\". It's something there's more of on one side.",
        "Water moves toward the side with more stuff dissolved in it. Which word names that stuff?",
        "It can't be water, because water is what's moving. Protein is too specific.",
      ],
      wrongFeedback: "That word doesn't fit. The blank is what the water moves toward.",
      debriefLine: "Water moves toward the side with more solute. That's called osmosis.",
      sourceRef: { page: 4, quote: "Water moves toward the side with the higher solute concentration." },
    },
  },
  {
    cardId: "bug_hunter", // truth_finder.error_hunt
    slice: {
      prompt: "One line of this worked answer has a mistake. Find it.",
      params: {
        title: "Solving 2x + 3 = 11",
        lines: [
          { text: "2x + 3 = 11", isWrong: false, explanation: "The equation as given." },
          { text: "2x = 11 + 3", isWrong: true, explanation: "Moving + 3 across should make it − 3. It should read 2x = 11 − 3." },
          { text: "2x = 14", isWrong: false, explanation: "Follows from the line before, as written." },
          { text: "x = 7", isWrong: false, explanation: "Both sides divided by 2." },
        ],
        fixedLine: "2x = 11 − 3",
      },
      hints: [
        "The first line is just the question. So the mistake is in one of the other three.",
        "Moving a number across the = sign flips its sign. Check each line where that happens.",
        "The last line just divides 14 by 2, and that's done right. Compare the other two.",
      ],
      wrongFeedback: "That line follows from the one before it. Look somewhere else.",
      debriefLine: "Moving a number across the = sign flips its sign. That step got it wrong.",
      sourceRef: null,
    },
  },
  {
    cardId: "contract_elements", // truth_finder.counterexample
    slice: {
      prompt: "Here's a rule people often believe. Find the case that breaks it.",
      params: {
        rule: "Every promise is a legally binding contract.",
        cases: [
          { text: "A shop agrees to sell a bike for $200 and the buyer pays", breaksRule: false, explanation: "Each side gives something, so it's a real contract." },
          { text: "A friend promises to give you her old laptop for free", breaksRule: true, explanation: "She gets nothing back, so it's a gift promise. It isn't a contract." },
          { text: "A freelancer agrees to build a site for $1,000", breaksRule: false, explanation: "Both sides promise to give something." },
        ],
      },
      hints: [
        "A contract needs each side to give something. That's called consideration.",
        "For each case, ask what the second person gives back.",
        "In the bike sale, each side gives something. Compare the other two cases.",
      ],
      wrongFeedback: "In that case both sides give something. So it fits the rule.",
      debriefLine: "A promise where nothing comes back is a gift. It isn't a contract.",
      sourceRef: null,
    },
  },
  {
    cardId: "gallery_timeline", // sequencer.timeline
    slice: {
      prompt: "Put these events in order by date. One card is from a different time.",
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
        "Look at the years on the cards. Most of them are from the 1950s and 1960s.",
        "Set aside the card that's decades away from the rest. Then order the other four.",
        "The Civil Rights Act and the Voting Rights Act are easy to swap. Check their years.",
      ],
      wrongFeedback: "Check if that card even belongs in this time period.",
      debriefLine: "These four events happened in just over ten years. Each one built on the last.",
      sourceRef: null,
    },
  },
  {
    cardId: "graph_terrain", // tuner.curve
    slice: {
      prompt: "Set the line's slope (how steep it is) and intercept (where it starts) so it hits both checkpoints.",
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
        "Look at how much the checkpoints rise from one to the other. That sets the slope.",
        "Slope is rise over run. Divide the height change by the sideways change between checkpoints.",
        "Once the steepness matches, slide the intercept until the line touches both checkpoints.",
      ],
      wrongFeedback: "One checkpoint is still missed. Adjust the other setting too.",
      debriefLine: "You set {{targets}}. It took both the slope and the intercept to hit both checkpoints.",
      sourceRef: null,
    },
  },
  {
    cardId: "opportunity_fork", // tuner.optimize
    slice: {
      prompt: "Find the number of workers that gives the most output per hour.",
      params: {
        objective: "x * (12 - x)",
        goal: "max",
        xMin: "0",
        xMax: "12",
        inputName: "workers",
        outputName: "output per hour",
      },
      hints: [
        "Output is workers × (12 − workers). At 0 or 12 workers, the output is 0.",
        "Try 3 workers and then 9 workers. They give the same output.",
        "Equal outputs at 3 and 9 mean the peak sits between them, right in the middle.",
      ],
      wrongFeedback: "Output can still go up. Move your guess the way that raised it last time.",
      debriefLine: "Too few or too many workers both lose output. The peak was at {{best}}.",
      sourceRef: null,
    },
  },
  {
    cardId: "lever_door", // balance.torque
    slice: {
      prompt: "Slide the movable weight until the lever balances on the pivot.",
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
        "The fixed mass of 4 sits at 2 m. The pivot is at 5 m, so it's 3 m to the left.",
        "Each side's twist is mass times distance from the pivot. The fixed side makes 4 × 3 = 12.",
        "Your mass is 2, so it needs 12 ÷ 2 m of distance. Put it on the right side of the pivot.",
      ],
      wrongFeedback: "The lever still tips. The twist on each side isn't equal yet.",
      debriefLine: "Twist is mass times distance from the pivot. At {{answer}} {{unit}}, both sides match.",
      sourceRef: null,
    },
  },
  {
    cardId: "reaction_factory", // balance.ratio
    slice: {
      prompt: "Use what's on the shelf. Find which reactant runs out first, and how much product you can make.",
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
        "Each batch needs 5 mol of oxygen but only 1 mol of propane.",
        "Divide each amount on the shelf by what one batch needs. Propane gives 2 ÷ 1 batches.",
        "Oxygen gives 6 ÷ 5 batches. The smaller count is how many batches you can make.",
      ],
      wrongFeedback: "Having more of it doesn't mean it lasts longer. Compare how many batches each one makes.",
      debriefLine: "The {{limiting}} ran out first. That caps the {{productName}} at {{product}} {{unit}}.",
      sourceRef: { page: 2, quote: "The limiting reagent is the reactant that runs out first, capping how much product forms." },
    },
  },
  {
    cardId: "causal_weighting", // investigator.weigh
    slice: {
      prompt: "Rank these causes of the Voting Rights Act from most to least important.",
      params: {
        question: "Why did the Voting Rights Act pass in 1965?",
        causes: [
          { text: "Televised violence at Selma", weight: "5", why: "Johnson sent in the bill eight days after Bloody Sunday." },
          { text: "Years of local voter-registration organizing", weight: "4", why: "SNCC and local leaders built the campaign that Selma made visible." },
          { text: "King's 'I Have a Dream' speech", weight: "2", why: "Famous, but it came two years earlier and was about the 1964 bill." },
        ],
      },
      hints: [
        "Look at when each cause happened. The act passed in 1965.",
        "Ask how directly each cause led to the bill. Closer in time usually means more direct.",
        "The \"I Have a Dream\" speech was in 1963, about the 1964 bill. So it ranks low.",
      ],
      wrongFeedback: "That cause is well known. Check how quickly and directly it led to the bill.",
      debriefLine: "The top cause was {{top}}. It came just days before the bill.",
      sourceRef: null,
    },
  },
  {
    cardId: "source_seer", // investigator.source_eval
    slice: {
      prompt: "Rank these sources about the Selma march by how much you can trust them.",
      params: {
        question: "What happened on the Edmund Pettus Bridge?",
        sources: [
          { text: "A trooper's official report written the next day", reliability: 2, cues: "Written by someone who used force and wanted to defend it." },
          { text: "Film footage broadcast by ABC that evening", reliability: 5, cues: "A direct recording that many eyewitnesses back up." },
          { text: "A 2001 history book on the movement", reliability: 4, cues: "Written later, but it pulls together many checked sources." },
          { text: "A rumor reported in a distant newspaper a week later", reliability: 1, cues: "A secondhand story from a week later that nobody backs up." },
        ],
      },
      hints: [
        "Ask who made each source, and what they wanted people to believe.",
        "A trooper who used force might want it to look OK. That makes his report less trustworthy.",
        "The rumor from a week later goes at the bottom. Now compare the film and the book.",
      ],
      wrongFeedback: "Look at who made that source, and how close they were to what happened.",
      debriefLine: "You can trust a source more when it saw things directly and others back it up.",
      sourceRef: null,
    },
  },
  {
    cardId: "perspective_switch", // investigator.perspective
    slice: {
      prompt: "Match each quote to the person whose goal it helps.",
      params: {
        actors: [
          { id: "governor", name: "Governor Faubus", motive: "Keep segregationist voters on his side before an election" },
          { id: "student", name: "Elizabeth Eckford", motive: "Attend the school the court said she could" },
        ],
        accounts: [
          { text: "I ordered the Guard to preserve order and prevent violence.", actorId: "governor", why: "Calling it public safety helped him keep voters happy." },
          { text: "I just wanted to go to class like everyone else.", actorId: "student", why: "Going to school was her whole goal." },
          { text: "The federal government has no business in Arkansas's schools.", actorId: "governor", why: "Talk of states' rights appealed to his voters." },
        ],
      },
      hints: [
        "Look at each person's goal. Faubus needed voters, and Eckford wanted to get into school.",
        "Ask who gains if people believe each quote. Start with the one about going to class.",
        "The quote about the federal government sounds like a politician talking to voters.",
      ],
      wrongFeedback: "That quote doesn't help that person's goal. Check what they wanted again.",
      debriefLine: "Each quote lines up with one person's goal.",
      sourceRef: null,
    },
  },
  {
    cardId: "counterevidence_attack", // investigator.argument
    slice: {
      prompt: "Sort each piece of evidence. Does it support the claim, argue against it, or is it weak or off topic?",
      params: {
        claim: "Television coverage was decisive for the Civil Rights Act of 1964.",
        evidence: [
          { text: "Kennedy proposed the bill weeks after the Birmingham images aired", role: "supports", why: "The timing links the coverage to the bill." },
          { text: "Polls showed civil rights jumping to the top national issue after Birmingham", role: "supports", why: "Opinion shifted right after the coverage." },
          { text: "Television sets were in most American homes by 1963", role: "weak", why: "It shows people could watch. It doesn't show an effect on the bill." },
          { text: "Congress had debated civil rights bills since 1957 without passing one", role: "counter", why: "Other things were needed too, so the claim needs softening." },
          { text: "Birmingham's steel industry declined in the 1970s", role: "irrelevant", why: "It's a different decade and a different topic." },
        ],
      },
      hints: [
        "Look for timing. Kennedy's bill came weeks after the Birmingham pictures aired.",
        "Owning a TV shows people could watch. It doesn't show the bill passed because of it.",
        "The steel industry fact is from the 1970s. It has nothing to do with this claim.",
      ],
      wrongFeedback: "Check if that piece really connects to the bill. It might be about something else.",
      debriefLine: "The strongest evidence ties the TV coverage directly and quickly to the new law.",
      sourceRef: null,
    },
  },
  {
    cardId: "federalism_venn", // sorter.venn
    slice: {
      prompt: "Put each power under federal (the national government), state, both, or neither.",
      params: {
        sets: [
          { id: "federal", label: "Federal", feature: "powers given to the national government" },
          { id: "state", label: "State", feature: "powers kept by the states" },
        ],
        items: [
          { text: "Coin money", setIds: ["federal"], why: "Article I, Section 8." },
          { text: "Run public schools", setIds: ["state"], why: "Kept by the states." },
          { text: "Collect taxes", setIds: ["federal", "state"], why: "Both levels tax." },
          { text: "Grant titles of nobility", setIds: [], why: "Banned for both." },
        ],
      },
      hints: [
        "One power here is banned for both levels. The Constitution forbids it.",
        "Some powers are shared. Ask whether both the states and the national government do it.",
        "Collecting taxes is the tricky one. Check whether states tax people too.",
      ],
      wrongFeedback: "That power is in the wrong place. Check if it belongs to one level, both, or neither.",
      debriefLine: "Some powers are shared. Both the federal and state governments use them.",
      sourceRef: null,
    },
  },
  {
    cardId: "taxonomy_tower", // sorter.hierarchy
    slice: {
      prompt: "Put each group at the right level of the classification tower.",
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
        "Kingdom is the biggest group, at the top. Order is the smallest one here.",
        "Ask which group holds the others. Every mammal is a chordate, but many chordates aren't mammals.",
        "Carnivora and Mammalia are easy to swap. Carnivora is one group inside the mammals.",
      ],
      wrongFeedback: "That group is too big or too small for that level. Check what it includes.",
      debriefLine: "Each level down is a smaller group that shares one more feature.",
      sourceRef: null,
    },
  },
  {
    cardId: "supply_chain_flow", // linker.network
    slice: {
      prompt: "Build the food web. Draw an arrow from each animal to what it eats.",
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
        "Grass doesn't eat anything here. So no arrow starts at the grass.",
        "Each arrow starts at the eater and points at its food.",
        "The rabbit and the fox each need one arrow. Ask what a rabbit munches on.",
      ],
      wrongFeedback: "Check which way that arrow points. It should go from the eater to its food.",
      debriefLine: "Energy moves up the chain, from the grass to the rabbit to the fox.",
      sourceRef: null,
    },
  },
  {
    cardId: "weighted_path_planner", // linker.path
    slice: {
      prompt: "Find the route from Camp to Keep that takes the fewest hours.",
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
        "The direct road from Camp to Keep takes 10 hours. That's a lot for one road.",
        "A route with more stops can still be quicker. Look at the hours on each road.",
        "The way through Bridge and Cave has three roads of 2 hours each. Compare that to 10.",
      ],
      wrongFeedback: "That route takes more hours than another one with more stops.",
      debriefLine: "The route with more stops took fewer hours, just {{bestCost}} {{costName}}.",
      sourceRef: null,
    },
  },
  {
    cardId: "half_split_hunt", // mapper.search
    slice: {
      prompt: "Find the hidden page number. After each guess, you'll learn if it's higher or lower.",
      params: { min: "1", max: "64", hidden: "37", maxProbes: 7, thingName: "the page" },
      hints: [
        "The page is somewhere from 1 to 64. Start with a guess near the middle.",
        "A first guess of about 32 cuts the pages in half. Keep halving what's left.",
        "You get 7 guesses. Halving 64 six times gets you down to one page.",
      ],
      wrongFeedback: "That guess leaves too many pages. Try the middle of what's left.",
      debriefLine: "Splitting the range in half each time finds it in the fewest guesses.",
      sourceRef: null,
    },
  },
  {
    cardId: "approach_target", // function_world.limit
    slice: {
      prompt: "Move toward x = 2 from both sides on this curve. Read the height it's heading for.",
      params: {
        xMin: "-1",
        xMax: "5",
        side: "both",
        overrides: [],
        pieces: [{ expr: "x^2 - 1", from: "-inf", to: "inf", openLeft: true, openRight: true }],
        a: "2",
      },
      hints: [
        "This curve is y = x² − 1. Trace it as x gets close to 2.",
        "Try x = 1.9 and x = 2.1. Work out x² − 1 for each one.",
        "Those heights are about 2.6 and 3.4. The height both sides head for is between them.",
      ],
      wrongFeedback: "Check the height from both sides, the left and the right.",
      debriefLine: "From either side, the curve heads to the same height, {{limit}}. That's the limit.",
      sourceRef: null,
    },
  },
  {
    cardId: "sea_level_roots", // function_world.roots
    slice: {
      prompt: "Mark every spot where this curve crosses sea level, the line y = 0.",
      params: {
        pieces: [{ expr: "x^2 - 4", from: "-inf", to: "inf", openLeft: true, openRight: true }],
        xMin: "-5",
        xMax: "5",
      },
      hints: [
        "The curve is y = x² − 4. It dips below sea level in the middle.",
        "It crosses where x² − 4 = 0. So look for x values where x² is 4.",
        "There's a crossing on each side of 0. A negative number squared is positive too.",
      ],
      wrongFeedback: "You found one crossing. Check the rest of the curve for another.",
      debriefLine: "This curve crosses sea level at {{roots}}.",
      sourceRef: null,
    },
  },
  {
    cardId: "long_horizon", // function_world.asymptote
    slice: {
      prompt: "Follow this curve far to the right. Read the height it settles toward.",
      params: {
        pieces: [{ expr: "(2*x + 1)/(x - 3)", from: "-inf", to: "inf", openLeft: true, openRight: true }],
        direction: "pos_inf",
        xMin: "4",
        xMax: "40",
      },
      hints: [
        "The curve is (2x + 1) ÷ (x − 3). Look at the 2x on top and the x on the bottom.",
        "Try a big number like x = 1000. Work out the top and the bottom.",
        "For huge x, the + 1 and − 3 hardly matter. Simplify 2x ÷ x.",
      ],
      wrongFeedback: "That's not where it settles. Try an even bigger x and compare.",
      debriefLine: "For big x, only the 2x and the x matter. So the curve settles at {{limit}}.",
      sourceRef: null,
    },
  },
  {
    cardId: "unbroken_track", // function_world.continuity
    slice: {
      prompt: "Find every break in this track, like a hole or a jump.",
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
        "The track switches formula at x = 1. Look closely there.",
        "A hole is one missing point. A jump is where the two sides don't meet.",
        "That's not the only break. Check the track to the left of 0 too.",
      ],
      wrongFeedback: "One break is still missing. Keep scanning the rest of the track.",
      debriefLine: "This track has a hole at one point and a jump at another.",
      sourceRef: null,
    },
  },
  {
    cardId: "speed_snapshot", // function_world.secant
    slice: {
      prompt: "Shrink the window around x = 3. Watch the average rate close in on the rate right at 3.",
      params: {
        pieces: [{ expr: "x^2", from: "-inf", to: "inf", openLeft: true, openRight: true }],
        a: "3",
        windows: ["2", "1", "1/2", "1/10"],
        xMin: "0",
        xMax: "6",
        quantity: "position (m)",
      },
      hints: [
        "Each window gives the average rate over a stretch. That's different from the rate exactly at 3.",
        "Write down the average rate for each window as it shrinks, from 2 down to 1/10.",
        "The averages get closer to one number as the window gets tiny. Guess where they're headed.",
      ],
      wrongFeedback: "That's the average for one window. Look at where the numbers are heading.",
      debriefLine: "As the window shrinks, the average rate closes in on {{derivative}}. That's the rate right at x = {{a}}.",
      sourceRef: null,
    },
  },
  {
    cardId: "energy_ledger", // accumulator.signed
    slice: {
      prompt: "Add up the signed area under this curve from x = 0 to x = 3. Area below the axis counts as negative.",
      params: { expr: "x^2 - 4", a: "0", b: "3", ask: "net" },
      hints: [
        "y = x² − 4 is below the axis until x = 2. After that, it's above.",
        "Area below the axis takes away from the total. Area above adds to it.",
        "The net area from 0 to 3 is 3³ ÷ 3 − 4 × 3. Work that out.",
      ],
      wrongFeedback: "You counted every part as positive. The part below the axis should subtract.",
      debriefLine: "Area below the axis counts as negative. So the net total was {{net}}.",
      sourceRef: null,
    },
  },
  {
    cardId: "resource_collector", // accumulator.rate_total
    slice: {
      prompt: "Ore comes in at a changing rate, and you start with 10 kg. Find the total after 4 hours.",
      params: { rateExpr: "4 - x/2", t0: "0", t1: "4", initial: "10", quantityName: "ore", unit: "kg" },
      hints: [
        "The rate is 4 − x/2 kg per hour. It starts at 4 and drops to 2.",
        "The ore you gain is the area under the rate line from 0 to 4 hours.",
        "That area is a trapezoid with an average height of 3. Add its area to the 10 you started with.",
      ],
      wrongFeedback: "You treated the rate as steady. It drops over time, so use the area under it.",
      debriefLine: "The total is what you started with plus the area under the rate. That's {{total}} {{unit}}.",
      sourceRef: null,
    },
  },
  {
    cardId: "level_the_reservoir", // accumulator.average_value
    slice: {
      prompt: "Find the flat height that has the same area as this curve from 0 to 3.",
      params: { expr: "x^2", a: "0", b: "3" },
      hints: [
        "It isn't the average of the end heights, 0 and 9. The curve isn't a straight line.",
        "Find the area under x² from 0 to 3 first. It's 3³ ÷ 3.",
        "Now spread that area evenly over the width of 3. Divide it by 3.",
      ],
      wrongFeedback: "That's the average of the two end heights. The curve bends, so use the area instead.",
      debriefLine: "The average height is the area divided by the width. Here that's {{average}}.",
      sourceRef: null,
    },
  },
  {
    cardId: "energy_barrier", // simulator.reach_state
    slice: {
      prompt: "Set the growth factor r, the number the population is multiplied by each tick. Hit the target at tick 5.",
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
        "The population starts at 100 and gets multiplied by r every tick.",
        "By tick 5, it's 100 × r × r × r × r × r. Compare that to the target.",
        "r = 1.1 barely grows it. Try bigger values and run to tick 5 each time.",
      ],
      wrongFeedback: "At tick 5 the population is off target. Try a different growth factor.",
      debriefLine: "A growth factor of {{control}} gets there by tick 5. Small factors add up fast.",
      sourceRef: null,
    },
  },
  {
    cardId: "number_line_leap", // mapper.number_line (no other fixture covers this mode)
    slice: {
      prompt: "Land on the target value. Only a few marks on the line have labels.",
      params: { scale: "log", min: "10^-3", max: "10^6", target: "10^3.5", landmarkStep: "3", labels: "power" },
      hints: [
        "Each labeled mark is 1,000 times the one before. The line is spaced by powers of ten.",
        "On this line, you move by the power. The target 10^3.5 has a power of 3.5.",
        "A power of 3.5 is half a step past 3. That's one-sixth of the gap after the 10^3 mark.",
      ],
      wrongFeedback: "That's on the wrong side of a labeled mark. Check which two marks the target sits between.",
      debriefLine: "On a log scale, each equal step multiplies by the same amount. {{target}} sits between {{between}}.",
      sourceRef: null,
    },
  },
  {
    cardId: "chrono_bridge", // sequencer.linear (no other fixture covers this mode)
    slice: {
      prompt: "Put these baking steps in the order they happen. One plank doesn't belong.",
      params: { steps: ["Gather materials", "Mix the batter", "Bake at 350°F", "Cool on a rack"], decoys: ["Frost the cake"] },
      hints: [
        "Look for the step you need before you can mix anything.",
        "The batter has to bake before it can cool.",
        "Frosting is a real cake step, but this recipe stops after cooling. Leave that plank out.",
      ],
      wrongFeedback: "Check what has to happen right before that step. Or maybe it doesn't belong at all.",
      debriefLine: "Each step needs what the step before it made.",
      sourceRef: null,
    },
  },
  {
    cardId: "phase_gate", // tuner.oscillator (no other fixture covers this mode)
    slice: {
      prompt: "Set the wave's period so the vault's rings lock. The period is how long one full wave takes.",
      params: { wave: "sin", amplitude: 2, b: "pi/2", c: "pi/4", d: 1, ask: "period" },
      hints: [
        "Only the π/2 next to t sets the timing. The 2 in front changes the height.",
        "One period is 2π divided by the number next to t. Here that's 2π ÷ (π/2).",
        "Dividing by π/2 is the same as multiplying by 2/π. The π's cancel out.",
      ],
      wrongFeedback: "That period doesn't fit this wave. Check the number next to t again.",
      debriefLine: "The period is {{period}}. A bigger number next to t makes the wave repeat faster.",
      sourceRef: null,
    },
  },
  {
    cardId: "mimic_chest", // truth_finder.mimic (no other fixture covers this mode)
    slice: {
      prompt: "Three chests, one lie. Point your lantern at the chest making a false claim.",
      params: {
        statements: [
          { text: "Water boils at 100 °C at sea level", isTrue: true, explanation: "That's at normal air pressure." },
          { text: "Water always boils at 100 °C", isTrue: false, explanation: "Boiling point drops when air pressure drops." },
          { text: "Water boils at a lower temperature on a mountain", isTrue: true, explanation: "The air pressure is lower up there." },
        ],
      },
      hints: [
        "The claims disagree about whether water's boiling point can change.",
        "Air pressure is lower up a mountain. Lower pressure lets water boil at a lower temperature.",
        "The claim about sea level is true. Compare the other two.",
      ],
      wrongFeedback: "That chest's claim is true. Look for the one that goes against the others.",
      debriefLine: "Boiling point changes with air pressure. So \"always\" made that claim false.",
      sourceRef: null,
    },
  },
];
