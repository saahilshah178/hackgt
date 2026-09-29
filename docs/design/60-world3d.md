# 60 · 3D open worlds (`world3d`)

_2026-09-29. A new, explicitly chosen genre: a third-person 3D open world with one clear goal on the horizon, an
LLM-written story and cast, and the learning built into the places and people of the world. The existing genres are
unchanged._

## 1. What the player gets

- **A place, not a level.** A few hundred metres of terrain (desert, forest, coast, alpine, volcanic, lunar …) with a
  physically based sky, fog, water, instanced vegetation and wildlife, and procedural architecture in the setting's style
  (an Egyptian plateau, a medieval valley, a research station on the Moon).
- **One clear goal.** The goal landmark is visible from the spawn (a pyramid, a lighthouse, a volcano's observatory) and
  always marked on the compass. The opening camera flies past the key landmarks and ends on it.
- **A story told by the people who live there.** Characters stand, work and wander; walk up and press E to talk.
  Dialogue is cinematic (camera framing, letterbox, typewriter text, voice archetype). In live mode the player can also
  ask any character a free question; the answer is in character and grounded in the student's own material.
- **Learning that is part of the story.** Each encounter becomes a *moment*: a conversation, an inscription to decode, an
  artifact to examine or sort, a device to tune, a vista to survey, a seal to open. The challenge UI opens diegetically
  (papyrus, stone, glass … per world) and is graded by the same mechanic families as every other genre. Solving a moment
  rewards the player (a key, a relic, a map fragment) and changes the world (a seal opens, a bridge lowers, a beacon lights).
- **Fun that stays on topic.** Sprinting and jumping, collectibles with true fun facts, ambient creatures to pet or
  chase, vistas that reveal the map, a photo mode. Nothing that pulls the player away from the goal for long.

## 2. Architecture

```
GameSpec (genre "world3d")          ← Director, challenge writers, narrative, assessment, tutor (unchanged S6–S9)
  └─ world3d: World3D               ← S10 World Architect (CODER tier: gpt-6-astra) → compose → checks → critics → repair
       │                                (src/pipeline/world3d/*)
       ├─ src/world3d/core   pure TS: prng, noise, biomes, moods, catalog, heightfield, composer, navgrid, checks, digest
       ├─ src/world3d/kit    three.js + React Three Fiber: the 3D component library (terrain, sky, water, vegetation,
       │                     structures, characters, wildlife, fx, post) + /dev/kit3d gallery
       └─ src/game/world3d   the game: World3DClient (runner, grading, telemetry), player, camera, interaction, quest,
                             HUD, dialogue, challenge skin, journal, pause/settings, save, audio, finale
```

Games stay **data, not generated code**: Astra writes a zod-validated `World3D` slice (strict structured output), code
composes it (snaps to terrain, flattens pads, carves rivers and paths, adds bridges, expands clusters, scatters), and the
renderer is a pure function of the result plus the seed. A bad model output can make a world plainer, never broken.

### 2.1 Contract

`src/contracts/world3d.ts` (stored) and `src/contracts/world3d-slices.ts` (LLM-facing, strict: every field required,
nullable not optional, enums for every id the model must reference). Coordinates are metres on the ground plane,
`x` east, `z` **south** (three.js), origin at the map centre, everything inside `±terrain.size/2`. Heights are derived,
never written by the model.

Key rules (enforced by `src/world3d/core/validate.ts` + `spatial-checks.ts`):

| Rule | Why |
|---|---|
| exactly one `goal` landmark; `quest.goal.landmarkId` is it; the finale moment is anchored there | one clear goal |
| one moment per encounter, anchored to exactly one npc **or** landmark | every challenge has a place |
| acts cover every encounter once; the finale is in the last act | story structure |
| every anchor, collectible and landmark is reachable on foot from the spawn | winnable |
| nothing important stands in water or on a cliff; landmarks keep their spacing | legible, walkable |
| the goal is visible from the spawn (line of sight over the heightfield) | clear goal |
| speakers are npc ids, `narrator` or `you`; npc topics are real concept ids | grounded dialogue |

### 2.2 Sockets (the family × genre adapters)

`SOCKETS.world3d = conversation, inscription, artifact, device, vista, seal, finale` (boss). Every mechanic family has a
`world3d` skin in `src/mechanics/families/*/index.ts`, so the Director plans a 3D game exactly like any other genre.

### 2.3 The 3D component library (`src/world3d/kit`)

| Module | Contents |
|---|---|
| `materials` | PBR material factory over CC0 textures (Poly Haven / ambientCG, 1k, in `public/world3d/`), triplanar terrain splat |
| `Terrain` | heightfield mesh (from `core/heightfield`), slope/height/biome splat, carved paths, wet shorelines |
| `Sky` | physically based sky + sun + moon/stars, mood rigs (`core/moods`), fog, image-based lighting |
| `Water` | ocean/lake/river surfaces with normals, reflections, depth tint, shore foam |
| `Vegetation` | instanced trees (palm, conifer, broadleaf, birch, dead), bushes, reeds, grass field with wind shader, rocks |
| `structures/*` | one builder per `StructureKind`, honouring `core/catalog` footprints, any `Material` × `ArchStyle` |
| `characters` | procedural humanoid (skin tones, outfits, headwear, held props) with idle/walk/run/talk/wave/work/sit animation |
| `wildlife` | cats, dogs, goats, camels, horses, ibises, bird flocks, butterflies, fireflies, fish |
| `fx` | dust, sand, embers, rain, snow, fireflies, the goal beacon, interaction rings, reward bursts, seal/gate animations |
| `post` | quality-tiered post stack: AO, bloom, AgX tone map, colour grade per mood, vignette, SMAA |

`/dev/kit3d` shows every component in every biome and mood. It is the visual QA surface (screenshots + vision critic).

### 2.4 The game (`src/game/world3d`)

`World3DClient` mirrors `GenreClient`: a free-order `EncounterRunner`, the same `ChallengePanel`, lessons before the first
challenge on a concept, the Field Guide (G), telemetry, mastery and the `EndScreen`. What is new is the frame:

- **Player**: third-person controller on the heightfield, WASD/arrows, mouse-drag or pointer-lock orbit camera, Shift
  sprint, Space jump, camera collision with terrain; E interacts with the nearest target in reach.
- **Quest**: the goal, the acts, and "leads" = the unlocked moments (`runner.available()`), each with its objective line.
- **HUD**: compass bar (goal + leads + npcs), quest tracker, minimap (M for the full map), interaction prompt, toasts,
  mastery chip, Field Guide and Journal (J) buttons. Everything readable at 1280×720 and on a projector.
- **Dialogue**: camera frames the speaker, letterbox, name plate, typewriter text (click/Space to skip), choices, and an
  "Ask …" box for free chat (live mode).
- **Moments**: approach lines → lesson (if the concept is new) → the challenge panel in the world's `hudTheme` →
  success lines + reward toast + the world change (`opens`) → the next leads appear on the compass.
- **Finale**: reaching the goal opens the finale moment; solving it plays the outro and a closing camera, then the debrief.
- **Pause (Esc)**: resume, settings (quality tier, mouse sensitivity, invert Y, text size, reduced motion, audio), controls.
- **Save**: solved moments, relics, position and settings persist per game in `localStorage`.
- **No WebGL**: the game falls back to the Narrative adventure host, so every world3d game is still playable.

### 2.5 Pipeline: S10 World Architect and the LLM critics

Runs in the orchestrator after the blind solver (the encounters are final) and before audio:

1. **Astra drafts** the `World3D` slice from the premise, cast, encounters (with sockets and design notes), lessons and
   concepts, the component catalog and the map size (5/10/15 min → 420/560/700 m).
2. **Code composes and checks** (referential + spatial). Failures go back to Astra as repair notes (≤ 2 rounds). Some
   problems are fixed by code instead (snap an npc to dry land, add a bridge where a path crosses a river) and recorded
   in `provenance.fixes`.
3. **Two critics review in parallel** (SMART tier, a different model from the author):
   - *Story critic*: goal clarity, coherence and stakes, character voice, learning woven into the story (not trivia
     stapled on), factual accuracy against the student's material, fun/on-topic balance, pacing, age-appropriateness.
   - *World & UI critic*: reads a code-made digest (an ASCII top-down map, sightlines, travel distances, density, text
     lengths of every HUD string) and judges navigation clarity, composition, visual coherence of biome × mood ×
     materials × style, readability of the HUD copy, travel pacing and the performance budget.
   Each returns 1–5 rubric scores, `pass`, and concrete issues. A failing critic sends its issues to Astra for one more
   round; the re-draft is re-checked by code. Scores are stored in `world3d.provenance.reviews`.
4. **Fallback**: if Astra fails outright, the deterministic composer (`src/pipeline/world3d/fallback.ts`) builds a world
   from the spec alone (biome from the domain and setting, landmarks from sockets, npcs from the cast), so a world3d job
   never fails for lack of a world. Mock mode (`LLM_MODE=mock`) always uses it.

A third, on-demand critic (`pnpm world3d:critique <game>`) renders the world headlessly, captures the opening, spawn,
a moment, dialogue and the map, and has a vision model grade the actual pixels (composition, lighting, legibility of UI).

### 2.6 NPC free chat (live mode)

`POST /api/games/:id/npc/:npcId/chat` streams a short in-character reply (FAST tier). The system prompt is the npc's
persona, the lessons and facts for its topics, and hard rules: stay in character and on the material, 1–3 sentences,
never give the answer to an unsolved challenge, steer off-topic questions back gently, age-appropriate. A leak guard
drops any reply that contains an unsolved encounter's solution text, and a per-game rate limit caps the cost. Mock mode
answers from the lessons deterministically.

## 3. The demo world: *The Scribe of the Nile* (Ancient Egypt)

Giza, c. 2560 BCE, golden hour. The Nile along the east with green banks, palms, papyrus and fishing boats; the
workers' village, a temple with obelisks, an embalmers' tent, a quarry and a Nilometer; the Great Pyramid on the
plateau, its gilded capstone waiting. The player is an apprentice scribe asked by Hemiunu, the pyramid's architect, to
restore the capstone's inscription. Concepts: the Nile's flood cycle, the social pyramid, hieroglyphs and scribes, who
built the pyramids and how (paid crews, not slaves), mummification and the afterlife, and the gods. Fun: scarab
amulets with true facts, cats to pet, felucca sails on the river, a sunset finale on the pyramid.

## 4. Quality bars

- 60 fps on a 2021 laptop at the Medium tier; the High tier adds AO, denser grass and larger shadow maps.
- Every HUD string fits at 1280×720 with 18 px minimum body text; WCAG AA contrast on every panel skin.
- Keyboard-only play works end to end; no pointer lock required; reduced motion disables camera sway and flyovers.
- Unit tests for the contract, core (determinism, reachability), composer, checks, critics' repair loop (mock models),
  fallback, the mock pipeline end to end, and chat guardrails; Playwright e2e for the demo and the intake option.
