# 50 · Board genres: variety of perspective and progression

_2026-09-26. Responds to feedback that every game was "walk right, hit an obstacle, answer a slider or a multiple-choice
question". Everything stays pure 2D._

## Genres

| Genre id | Shown as | Perspective | How you progress | Host |
|---|---|---|---|---|
| `puzzle` | Logic board | grid, no avatar | rotate conduit tiles so power reaches a sealed tile; a seal opens only when powered | `src/game/genre/hosts/puzzle` |
| `strategy` | Cozy management sim | town view, no avatar | villagers' requests day by day; coins build the town; festival finale; no fail state | `hosts/cozy` |
| `mystery` | Point-and-click investigation | illustrated scenes + inventory | search props for clues, combine two clues into a lead, crack it, accuse | `hosts/casefile` |
| `explorer` | Top-down explorer | bird's-eye maze with an avatar token | walk wings in any order; stations open gates; sentries patrol; fog of war | `hosts/explorer` |
| `story` | Narrative adventure | text + choices | pick a thread (choice card), explain to characters, branch; ending by first-try rate | `hosts/story` |
| `dungeon`, `platformer` | side view | walk right | legacy hosts `src/game/hosts` (and the Expedition when a world side-car resolves) | |

`BOARD_GENRES` in `src/library/genres.ts` routes a spec to `GenreClient` (`src/game/genre/GenreClient.tsx`); `?host=legacy`
still reaches the old hosts. `AUTO_GENRES` excludes only the platformer, and `GENRE_WEIGHTS` gives every knowledge type a
non-side-scroller home (sequence/procedure/quantitative → puzzle, system/category → strategy, causal → mystery,
spatial → explorer, argument → story, fact → dungeon).

## Non-linear progression

`src/game/runner/progression.ts` derives a braided unlock graph from the spec in code: 2–3 parallel tracks (one per unit,
or alternating), each sequential; cross-links for teach-before-practice; review after its two predecessors; boss after
everything. `EncounterRunner` gains `order: "free"` (`available()`, `focus(id)`, per-encounter attempts/hints), so
several encounters are open at once and the host decides how the player chooses among them. Hosts get the graph,
`solved`, `available`, `open(id)` and a ready-made `ChallengePanel` (`src/game/genre/types.ts`).

## Interaction variety

- New family `explainer.teach_back` (widget `explain`): the player explains a concept in their own words; a deterministic
  rubric (key ideas with synonyms, negation-aware, misconception detection) grades it and the listener asks a follow-up
  for the missing idea. Seven catalog cards (`teach_back` universal plus per-domain) — always on the Director's menu.
- Director prompt: vary widgets; multiple choice + sliders at most a third of encounters when alternatives exist; use an
  explain card for the weakest causal/process concept. The menu shows each card's widget.
- Showcase fixtures (`fixtures/board-showcase.slices.ts`) swap multiple-choice encounters for matching, ordering,
  cause-effect chains, fill-the-blank and teach-back.

## Tests

`src/game/runner/progression.test.ts`, `tests/board-genres.test.ts` (3 topics × 5 board genres through the mock
pipeline, played to the end in free order), per-host `*.logic.test.ts`, explainer rubric/mode/widget tests, and
`e2e/play-board.spec.ts`.
