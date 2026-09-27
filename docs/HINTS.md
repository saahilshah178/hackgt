# Hint standard

Every hint in every game goes through this file: challenge hints (`ChallengeSlice.hints`, written by the
Challenge Writer or by hand in `fixtures/*.slices.ts`), station hints in world side-cars
(`station.dialogue.hints`), and hint templates in code (`src/pipeline/mock/**`, `fallbackMimic` in
`src/pipeline/generate.ts`). The pipeline appends this file to the Challenge Writer's system prompt, see
`src/pipeline/style-guides.ts`.

Hints are written in plain, everyday language, like all our text. Follow [`WRITING.md`](WRITING.md) too.

## 1. What a hint is for

A hint helps the player take **the next step on this exact problem**. The player who asks for one is stuck.
They've read the prompt already, so repeating it or reciting a definition doesn't help. A good hint
points at something in the problem they haven't noticed, or shows them how to start.

A hint never hands over the answer. The player should still have to do the last step themselves.

## 2. The three rungs

Each problem has exactly three hints. Each one gives a bit more help than the one before, and adds
something new.

| Rung | Name | What it does | Must not |
|---|---|---|---|
| 1 | Look here | Points at the one detail in this problem that matters most, usually the thing people get wrong. Uses this problem's own numbers, words or items. | Give the rule's result, or name the right choice |
| 2 | How to start | Gives the method or rule and sets it up with this problem's numbers. Shows the first step. | Do the whole calculation, or name the right choice |
| 3 | Almost there | Does everything but the last step: leaves one small sum, or narrows the choice to two, or rules out a wrong option. | State the final answer, or name the right choice |

## 3. Rules

1. **Specific to this problem.** Every hint mentions something from this problem: a number, a word from the
   prompt, an item, or a thing on screen. Paste test: if the hint would work unchanged on a different
   problem, it's too vague. Rewrite it.
2. **Adds something new.** Never repeat the prompt or an earlier hint in other words.
3. **Aims at the likely mistake.** Rung 1 or 2 should steer away from the encounter's target misconception
   (for example "the 3 in front changes how high, not how fast").
4. **Never gives the answer.** No hint contains the answer value, the correct option's text, or the
   placeholder that fills it in (`{{mimic}}`, `{{period}}`, `{{target}}` and so on). The validators check this
   on all three rungs.
5. **Plain words, short.** One or two sentences, 20 words or fewer. No new terms that the prompt didn't
   use. Say what's on screen in the words the screen uses.
6. **Helpful, not cheerful.** No hint is only encouragement or only story.

These are too vague and are never OK as hints:

- "Think about what amplitude really means."
- "Read the question carefully."
- "Remember the definition."
- "You've got this!" / "Take your time."
- "A period is how long something takes to repeat." (a definition with nothing about this problem)

## 4. By kind of problem

| Kind of problem | Rung 1: look here | Rung 2: how to start | Rung 3: almost there |
|---|---|---|---|
| Find the false claim (mimic) | Which word or number the claims disagree on | The rule to test each claim with, set up for this problem | Rule out one true claim, or point at the two claims to compare. Never quote the false one |
| Set a value (dial, slider, number line, period, formula) | The part of the problem that decides the value (the 2 inside sin(2t)) | The rule with this problem's numbers put in ("2π divided by 2") | Where it lands relative to marks on screen ("between π/2 and π, nearer π"), or the last sum to do |
| Put steps in order | What has to happen first, and why | What the step after that needs | Which two steps are easy to swap, or what the last step needs. When the prompt says one step doesn't belong, don't name it |
| Sort into groups | The feature that decides the group | Test one tricky item out loud | Point out the item that's most often put in the wrong group, and what to check about it |
| Match pairs or a chain | A clue word shared by one pair | How to tell two look-alike options apart | One wrong pairing to avoid |
| Rule out suspects (elimination) | Which clue to use first | What that clue rules out | The last two left, and the clue that splits them |
| Multiple choice | What the question is really asking | How to check an option | Rule out one or two wrong options |
| Place a date or event | A detail in the text that dates it | A nearby event it came before or after | The range it falls in (decade, or between two pins) |

## 5. Before and after (from our games)

Period of y = sin(2t) (answer: π)

| Rung | Before | After |
|---|---|---|
| 1 | "A period is how long the ring takes to come back to where it started, moving the same way." (a definition, nothing about this wheel) | "Look at the 2 inside sin(2t). It makes this wheel spin faster than plain sin(t)." |
| 2 | "For y = sin(b·t), one period lasts 2π/\|b\|. The 2 in sin(2t) is b." | "One period is 2π divided by the number next to t. Here that's 2π ÷ 2." |
| 3 | "Here b = 2, so divide 2π by 2." (the same as rung 2) | "Plain sin(t) takes 2π. Twice as fast means half of 2π." |

Find the false claim about amplitude (the false claim: "the amplitude of 3sin(x) is 6, peak to trough")

| Rung | Before | After |
|---|---|---|
| 1 | "Amplitude is measured from the midline, not across the whole swing." | "Two claims give a different amplitude for 3sin(x). They can't both be right." |
| 2 | "Peak-to-trough is twice the amplitude." | "Amplitude goes from the middle line up to the top. For 3sin(x), the top is at 3." |
| 3 | "The mimic claims: {{mimic}}" (gives the answer away) | "The claim about the period is true. Compare the other two." |

## 6. Checklist

- [ ] Three hints, each adding something new.
- [ ] Each hint names a number, word, item or on-screen thing from this problem.
- [ ] Rung 1 points at what matters. Rung 2 shows how to start. Rung 3 leaves one small step.
- [ ] No hint contains the answer, the correct choice, or an answer placeholder.
- [ ] One of the first two hints steers away from the likely mistake.
- [ ] Plain words, 20 words or fewer, sounds like a person talking.
- [ ] World station hints (`dialogue.hints`) and the encounter's own hints give the same help in the same
      order. They can be worded for the guide's voice, but they must not disagree.
