# Writing standard: game text and dialogue

Every word a player reads or hears follows this file. That covers text we write by hand (fixtures, world
side-cars, mock templates) and text a model writes (the pipeline appends this file to every writer agent's
system prompt, see `src/pipeline/style-guides.ts`). Hints have an extra standard of their own:
[`HINTS.md`](HINTS.md).

When this file and an older design doc disagree about wording (for example the dialogue drafts in
`docs/design/1x-game-*.md`), this file wins.

## 1. Who we write for

Our players are every age, from a 10-year-old doing homework to an adult picking a subject back up. Write so
the youngest of them can follow it on the first read, without making the oldest feel talked down to.

- **Everyday words.** Use words most people already know, the kind you'd say out loud at home or school. A
  longer or less common word is fine when most people know what it means. Swap a word only when it is stiff
  or rare (see the examples in section 5).
- **Teach the real terms, one at a time.** The subject words the lesson is about (period, amplitude, osmosis,
  boycott) are the point, so use them. The first time one appears, say what it means in plain words. Don't
  use subject words the lesson doesn't teach.
- **Don't invent jargon.** Call things what the player can see: "the wheel", "the slider", "the green line".
  A made-up name ("the pawl", "the sync thread", "the Tuning Lens") is only OK if it is printed on screen next
  to the thing, and never more than one per line.
- **Math looks like the textbook.** Write `5π/6`, `sin(2t)`, `2π ÷ 2`. When a symbol first shows up, also say
  it in words ("the 2 inside sin(2t)").

## 2. Sound like a person

Read every line out loud. If you wouldn't say it to a friend sitting next to you, rewrite it.

- **Short.** One idea per sentence. Aim for 12 words or fewer per sentence, and at most two sentences per
  line. Lines are voiced and shown in a small bar; the hard limit is 24 words and 140 characters.
- **Talk, don't narrate.** Use contractions (it's, you're, don't). Say "you". Fragments are fine ("Almost!",
  "Too far."). Mix short and longer sentences.
- **React to what just happened.** A character who sees the player miss says "Close! A bit less.", not a
  lecture. A character who sees a win sounds happy, then says what worked.
- **Say it once.** Don't repeat the same idea in two ways in one line, and don't have every line restate the
  lesson.
- **Plain story.** Lore is a light seasoning. One story detail per line at most, and never in the same
  sentence as an instruction. The whole game has one story (section 7), not a pile of set dressing.

## 3. Things that make text sound machine-written (don't do these)

These patterns are what make our text read as AI-generated. A line with any of them gets rewritten.

| Pattern | Example from our games | Say instead |
|---|---|---|
| A colon that turns a line into a lesson | "A radian is a walk, not a turn: π carries you exactly halfway round any circle." | "π takes you halfway around the circle. 2π is the whole way." |
| "Not X, but Y" / "X, not Y" slogans | "Watch how fast, not how far." | "Watch how fast they spin." |
| Fortune-cookie wisdom to end a line | "How far a thing swings says nothing about how often." | "The big swing didn't change the timing. Only the number next to t did." |
| Mirrored sentence pairs | "Reach is how far. Rhythm is how often." | "That's how far I swing. You need how often." |
| Lists of three (or four) for rhythm | "Isolate, reference angle, quadrants, both solutions." | "You did it step by step, and found both answers." |
| Stacked made-up machine parts | "The pawl found no notch to catch." | "The lock didn't catch. The wheel wasn't back at the start." |
| Poetic personification | "The Orrery felt it." "Vesper's light can find its lens." | "Look, the beam is shining up to the big machine!" |
| Em dashes and semicolons in speech | "Only quarter marks are labelled; count the small studs." | "Only the big marks have labels. Count the small bumps between them." |
| Buzzwords | delve, embark, journey, unlock (as a metaphor), realm, tapestry, testament, harness, unleash, elevate, crucial, vital, seamless, "dive in", "the key is" | Plain verbs: look, try, find, open, use |
| Empty cheer | "Great job!", "You've got this!", "Amazing work, adventurer!" | Say what they did: "Yes! That's one full turn." |
| Grand stakes in every line | "...or the canals stay dry." "...before Vesper sets." | Mention the stakes once, in the intro. |
| Formal feelings | "I am most delighted by your progress." | "Oh, nice!" |

Also avoid: rhetorical questions that answer themselves ("And what does that mean? It means..."), "Remember:",
"Note that", "Let's", "Indeed", "Behold", "Ah,", and ending lines on an exclamation every time.

## 4. What each kind of line is for

| Slot | Job | Length | Good example |
|---|---|---|---|
| Intro / narration | Set the scene and the goal, once | 1-2 short sentences per line, 3-4 lines total | "The big sky machine has stopped. Six locks hold it still." |
| Approach | Say what this thing is and what's wrong | 1-2 sentences | "This is the water wheel gate. It's stuck." |
| Instruction | Tell the player exactly what to do. Verb first. Name the object (the validator requires it) | 1 sentence | "Set the timer to one full turn of the wheel." |
| Tutorial | How the controls work, first time only | 1-2 sentences | "Drag the orange knob, or use the arrow keys." |
| Insight | One true thing to notice on screen. Never the answer | 1-2 sentences | "When the green wave sits right on the white one, you've got it." |
| Fail line | What happened, in plain words, plus one small nudge about that exact mistake | 1-2 sentences | "Too long. The wheel went past the start. Try less time." |
| Success | What worked, and the idea in plain words. May state the answer | 1-2 sentences | "Yes! sin(2t) spins twice as fast, so one turn takes half the time." |
| Payoff / after | A happy reaction and where to go next | 1 sentence each | "The water's flowing again! Let's go see Brasswick." |
| Boss taunts | Short, in character, tied to the mistake | Under 12 words | "Too slow! You're behind me." |
| NPC lines | A person with a problem, said simply | 1-2 sentences | "My arm keeps coming back too soon. Can you help?" |
| Prompt (challenge) | The task and what counts as winning | 1-2 sentences | "Three chests make claims about amplitude. One is lying. Find it." |
| Wrong feedback | Why that choice is wrong, in plain words | 1-2 sentences | "That one's true. Look for the claim that measures the whole swing." |
| Debrief line | Name the idea and link it to what they did | 1-2 sentences | "Amplitude is how far the wave goes from the middle. For 3sin(x), that's 3." |
| Quiz items | A clear question a student can answer in 20 seconds | 1 sentence | "What is the period of y = cos(x/3)?" |

Instructions and fail lines matter most. A player who doesn't understand the instruction can't play.

## 5. Word swaps

These are examples, not a required list. Swap a word when it is stiff or rare. If most people already know
what it means, leave it, even when a shorter word exists.

| Instead of | Write |
|---|---|
| ameliorate | make better |
| elucidate | explain |
| obfuscate | hide |
| eschew | skip |
| juxtapose | put next to |
| nomenclature | names |
| extant | still here |
| nascent | just starting |
| heretofore | until now |
| wherein | where |
| cognizant | aware |
| disseminate | spread |
| erstwhile | earlier |
| henceforth | from now on |
| imbue | fill |
| redress | set right |

## 6. Before and after

> Before: "The Tidewheel Gate. Its ring runs on y = sin(2t). It must lap once and lock, or the canals stay dry."
>
> After: "This is the water wheel gate. Its wheel spins on y = sin(2t). It's stuck."

> Before: "Set the latch timer to one full period, so the ring's notch comes home and the gate locks open."
>
> After: "Set the gate's timer to one full turn of the wheel. That's called one period."

> Before: "Speed up the wheel and every lap gets shorter: double b, and the period halves."
>
> After: "You got it! The 2 makes the wheel spin twice as fast, so each turn takes half as long."

> Before: "Mimics love a half-truth. Aim the Tuning Lens at a singer and compare its trace to the reference."
>
> After: "One of these singers is lying. Point the lens at each one and compare its wave to the white one."

## 7. The story of a game

A game is one short story the player can retell in two sentences. Fancy names and extra plots get in the way.

### Title

The title names the place or the job in 2–4 everyday words. A 10-year-old should know what it means before they
play. The subtitle, if there is one, is the goal.

| Too fancy | Write this |
|---|---|
| The Orrery Terraces / The Clockwork Crypt | The Sky Clock |
| The Living Gate / The Membrane Vault | Inside a Cell |
| The Archive of Voices / The 1965 Files | The Civil Rights Files |

Do not invent place names (Orrery, Vesper, Cell V-7, Archive of Voices). Use words the lesson already needs, or
plain words for what the player can see (clock, cell, newspaper, stairs, pump).

### One goal, one path

Write the premise as one sentence: who you are, where you are, what you need.

Then put every encounter on a path toward that goal. The order has to make sense as a story, not only as a lesson
plan.

| Game | Goal | Path |
|---|---|---|
| The Sky Clock | Get the star chart at the top | Climb. Each machine you fix opens the next path up. A guard at the top checks your timing. |
| Inside a Cell | Reach the nucleus | Start at the outer skin and walk inward. Each gate you open lets you go deeper. The last pump guards the nucleus. |
| The Civil Rights Files | Put the 1954–1965 story back together | Walk the years in order. Each stop is the next true event. The last vault asks why the voting law passed. |

Do not add a second plot (an evening star countdown, a mysterious Stillness, a storm that will throw the files out
at dawn) unless that *is* the goal. One reason to keep going is enough.

### How the lines carry the story

- **Intro:** who you are, where you are, what you need, and the first step. Three or four short lines.
- **Approach:** what this stop is, and why you can't go on until it works.
- **After / payoff:** what just opened, and where to go next. Count progress in plain words ("that's two of six",
  "we're inside the cell now", "next is 1957").
- **Boss:** the last lock on the same goal, not a new villain with a new motive.
- **Outro:** you got the thing you came for. Name it.

Zone names and title cards follow the title rule: "Lower Path", "Middle Stairs", "The Top Room". Not "Sunward
Terrace" or "The Warden's Dome".

## 8. Checklist before you ship text

- [ ] I read every line out loud, and it sounds like a person talking.
- [ ] A 10-year-old could follow every line. A word can stay if most people know what it means.
- [ ] Each subject term is explained in plain words the first time it appears.
- [ ] No made-up machine words the player can't see labelled on screen.
- [ ] No colons, em dashes or semicolons in spoken lines. No "not X, but Y" slogans. No lists of three for rhythm.
- [ ] Every sentence is 12 words or fewer where possible, and every line fits in 24 words and 140 characters.
- [ ] Instructions start with a verb and name the object.
- [ ] Fail lines talk about the exact mistake, and none of them give the answer.
- [ ] The title is 2–4 everyday words. I can say the goal in one sentence, and every stop is a step toward it.
- [ ] Hints follow [`HINTS.md`](HINTS.md).
