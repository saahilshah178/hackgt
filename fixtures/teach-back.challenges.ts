import type { ChallengeSlice } from "../src/contracts/slices";

/**
 * Ready-to-use explainer.teach_back encounters for the three samples (one per sample concept), written as the
 * challenge writer would return them. `cardId` names the catalog card each sits on; `conceptId` the sample
 * KnowledgeMap concept. Each passes check() and its exemplar self-solves (tests/teach-back-fixtures.test.ts).
 * Same `{ cardId, slice }` shape as fixtures/wave*.encounters.ts, so the generic answer-leak sweep can include it.
 * No prompt / hints[0] / wrongFeedback uses an answer placeholder ({{exemplar}}, {{ideaLabels}}).
 */
export interface TeachBackChallenge {
  cardId: string;
  conceptId: string;
  slice: ChallengeSlice;
}

export const TEACH_BACK_CHALLENGES: TeachBackChallenge[] = [
  // ---------------------------------------------------------------- trig: why a bigger b shortens the period
  {
    cardId: "explain_the_why",
    conceptId: "c_period",
    slice: {
      prompt: "The apprentice at the gate is stuck. Why does a bigger b in y = sin(bx) make the period shorter? Explain it in your own words.",
      params: {
        listener: "the gate's apprentice, who only memorised the formula",
        question: "Why does a bigger b in y = sin(bx) make the period shorter?",
        ideas: [
          {
            label: "the angle one wave needs",
            keywords: ["2π", "2 π", "2pi", "2 pi", "two pi", "full cycle", "one cycle", "complete cycle", "full turn", "full rotation"],
            followUp: "But what has to happen inside the sine before the wave starts repeating?",
            exemplar: "One full cycle of the wave happens when bx runs through 2π.",
          },
          {
            label: "how quickly the inside grows",
            keywords: ["faster", "quicker", "sooner", "more quickly", "squeeze", "squish", "compress", "less distance", "smaller x"],
            followUp: "Okay, and what does a larger b do to the way bx changes as x moves along?",
            exemplar: "A bigger b makes bx grow faster, so x reaches that point sooner.",
          },
          {
            label: "the formula for the period",
            keywords: ["2π/b", "2 π/b", "2pi/b", "2 pi over b", "2π over b", "two pi over b", "divided by b", "inversely"],
            followUp: "Can you turn that into a formula for the period in terms of b?",
            exemplar: "That is why the period equals 2π/b, and dividing by a bigger number gives a shorter period.",
          },
        ],
        required: 2,
        misconceptions: [
          {
            keywords: ["stretch", "stretches out", "longer period", "period gets longer", "spreads out", "wider"],
            correction: "Wait, try b = 1 and then b = 2. Which one finishes its wave first?",
          },
        ],
        wordBank: ["2π", "faster", "full cycle", "period", "bx"],
      },
      hints: [
        "Start from what one complete wave of sin means for the angle inside it.",
        "Think of bx as a clock. With a bigger b, how fast does that clock run as x increases?",
        "Say that one cycle is when bx covers 2π, a bigger b gets there faster, so the period is 2π/b.",
      ],
      wrongFeedback: "Your apprentice is still confused. Think about the angle inside sin and how fast it grows.",
      debriefLine: "The period is 2π/b. A bigger b makes the angle bx sweep through 2π faster, so each wave is shorter. Here is a model answer. {{exemplar}}",
      sourceRef: null,
    },
  },

  // ---------------------------------------------------------------- cell transport: why a cell swells in fresh water
  {
    cardId: "explain_the_process",
    conceptId: "c_osmosis",
    slice: {
      prompt: "A new lab apprentice watched a cell swell in pond water and wants to know why. Explain it to them.",
      params: {
        listener: "a new lab apprentice who missed the lecture",
        question: "Why does a cell swell up when you put it in fresh water?",
        ideas: [
          {
            label: "where the dissolved stuff is",
            keywords: [
              "hypotonic",
              "more solute inside",
              "more solutes inside",
              "higher solute concentration inside",
              "less solute outside",
              "fewer solutes outside",
              "saltier inside",
              "more concentrated inside",
              "lower concentration outside",
              "more salt inside",
            ],
            followUp: "Is the inside of the cell the same as the pond water, or different somehow?",
            exemplar: "Fresh water is hypotonic, so there is more solute inside the cell than outside.",
          },
          {
            label: "what crosses and which way",
            keywords: ["osmosis", "water moves in", "water enters", "water flows in", "water rushes in", "water goes in", "water diffuses in", "water comes in", "takes in water"],
            followUp: "So what actually crosses the membrane, and in which direction?",
            exemplar: "Water moves in by osmosis toward the higher solute concentration.",
          },
          {
            label: "why the cell can't even it out",
            keywords: ["semipermeable", "semi permeable", "selectively permeable", "partially permeable", "solutes cannot leave", "solutes can't leave", "pressure builds", "turgor"],
            followUp: "Why doesn't the stuff inside just leak out and even things up?",
            exemplar: "The membrane is semipermeable, so the solutes cannot leave and the cell keeps swelling.",
          },
        ],
        required: 2,
        misconceptions: [
          {
            keywords: ["salt moves in", "salt enters", "salt goes in", "salt flows in", "solute moves in", "solutes move in"],
            correction: "Hmm, can the dissolved particles really get through that membrane?",
          },
          {
            keywords: ["water moves out", "water leaves", "water flows out", "loses water"],
            correction: "If the cell lost that, would it swell or shrink?",
          },
        ],
        wordBank: ["osmosis", "hypotonic", "solute", "membrane", "semipermeable", "concentration"],
      },
      hints: [
        "Compare what is dissolved inside the cell with what is dissolved in pond water.",
        "Only one thing crosses the membrane easily here. Which way does it go, and toward what?",
        "Say that fresh water is hypotonic, water moves in by osmosis, and the solutes cannot leave.",
      ],
      wrongFeedback: "The apprentice still looks puzzled. Think about what crosses the membrane and which side has more dissolved stuff.",
      debriefLine: "In a hypotonic solution water moves into the cell by osmosis, toward the higher solute concentration, so it swells. Here is a model answer. {{exemplar}}",
      sourceRef: null,
    },
  },

  // ---------------------------------------------------------------- civil rights: why the Montgomery boycott succeeded
  {
    cardId: "explain_the_cause",
    conceptId: "c_montgomery",
    slice: {
      prompt: "A young reporter thinks the Montgomery boycott won by luck. Explain why it really succeeded.",
      params: {
        listener: "a young reporter who thinks it all came down to luck",
        question: "Why did the Montgomery bus boycott succeed?",
        ideas: [
          {
            label: "how people worked together",
            keywords: [
              "organized",
              "organised",
              "organization",
              "organisation",
              "carpool",
              "car pool",
              "montgomery improvement association",
              "churches",
              "coordinated",
              "mass meetings",
            ],
            followUp: "But one person can't keep buses empty for a year. Who kept it going, and how?",
            exemplar: "Black residents organized through churches and the Montgomery Improvement Association, running carpools for over a year.",
          },
          {
            label: "what the empty buses cost",
            keywords: ["economic pressure", "economic", "financial", "lost money", "losing money", "revenue", "fares", "profits", "cost the company", "cost the city"],
            followUp: "Why would the bus company care whether people rode or walked?",
            exemplar: "Most riders were Black, so the boycott put economic pressure on the bus company as it lost fares.",
          },
          {
            label: "what the judges decided",
            keywords: ["browder v gayle", "browder", "supreme court", "court ruling", "court ruled", "unconstitutional", "lawsuit", "federal court", "court case"],
            followUp: "Did anything outside the streets of Montgomery force the city to change its rules?",
            exemplar: "Then in Browder v. Gayle the Supreme Court ruled that bus segregation was unconstitutional.",
          },
        ],
        required: 2,
        misconceptions: [
          {
            keywords: ["just tired", "only tired", "was tired", "acted alone", "on her own", "by herself", "alone"],
            correction: "Was Rosa Parks really acting on a whim, or was she part of something bigger?",
          },
        ],
        wordBank: ["carpools", "boycott", "bus company", "fares", "Supreme Court", "Browder v. Gayle", "segregation"],
      },
      hints: [
        "Think about what it took to keep thousands of people off the buses for more than a year.",
        "There was pressure from two directions. Money on the street, and a case in the courts.",
        "Say that the community organized carpools, the bus company lost fares, and Browder v. Gayle ruled bus segregation unconstitutional.",
      ],
      wrongFeedback: "The reporter isn't convinced yet. Think about who kept the boycott going and what pressure it put on the city.",
      debriefLine: "The boycott won through organization, economic pressure on the bus company, and the Browder v. Gayle ruling. Here is a model answer. {{exemplar}}",
      sourceRef: null,
    },
  },
];
