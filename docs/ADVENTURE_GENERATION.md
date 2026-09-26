# From a source document to an authored adventure

## What this upgrade ships

The five homepage showcases have deterministic, hand-authored campaign manifests in `src/game/adventure/campaigns.ts`: six observatory encounters, eleven model-cell encounters, twelve archive encounters, six skywalk encounters, and nine research-station encounters, totaling 44. Each has a role, named fictional companion, stakes, three acts, and a finale. Every encounter has a location, objective, apparatus, companion briefing, collectible discovery note, and a specific restoration consequence. The existing civil-rights dungeon can also use the twelve-chapter archive manifest; it is not a sixth independently authored showcase.

`getAdventureCampaign(spec)` recognizes the exact stored fixture IDs and checks encounter coverage, returning a presentation snapshot in the spec's order. Unknown generated IDs and incomplete or drifted encounter sets return `null` and use the existing runtime. These authored manifests do not prove that arbitrary PDF uploads generate equally rich adventures. Their text never changes fixture parameters, source references, solutions, grading, telemetry, or assessment.

The history companion Mara Ellis is explicitly fictional. Her dialogue guides source analysis; it is not historical testimony. The archive repairs exhibit labels and explanations rather than staging civil-rights suffering as combat. The cell sanctuary is explicitly a scientific model, so its garden fiction does not imply that a real cell contains human-operated rooms.

The integrated showcase runtime uses original illustrated 2D scenes, a moving character and guide, optional field notes, a relay, an apparatus, and an exit. Keyboard movement and assisted object travel reach these props; the skywalk adds ledges, jumping, and recoverable hazards. A relay is required before opening the apparatus, a correct graded submission restores the scene and unlocks departure, and collected notes remain in the journal during the expedition. Closing the apparatus keeps its mounted input state.

The locations share subject-specific scene compositions and machine art. Chapter-specific names and restoration descriptions supply narrative detail; a shutter chamber and a crown beacon are not separately simulated machines or uniquely modeled rooms. Restoration is shown through lighting, machine status, particles, and an open exit, accompanied by the chapter's written consequence. Several modes have bespoke apparatus views (including circular angle placement, wave calibration, membrane routing, claim inspection, archive elimination, and recall); other modes use the existing widgets inside a themed workbench. This is a 2D authored presentation layer, not a 3D world or a complete physical simulation. Its map is a progress list rather than a navigable spatial map. The history account is explicitly a classroom simplification.

Campaign coverage tests in `tests/adventure-campaigns.test.ts` verify every shipped encounter, distinct substantive fields, all three acts, the history alias, generated fallback, encounter drift, ordering, and caller isolation. Runtime interaction, accessibility, artwork, and browser verification must be reported separately by the integration work; a campaign unit test does not establish their quality.

Campaign-layer validation on 2026-09-26: all 10 tests in `adventure-campaigns.test.ts` passed; ESLint passed for the campaign and its tests; project TypeScript checking passed at the time of this change. Commands used the locally installed Node entry points because `pnpm` was unavailable on PATH. These results cover authoring and type compatibility, not the future generator or browser interaction.

## Planned authoring contract

Future PDF generation needs a validated `AdventureSpec` alongside the authoritative `GameSpec`. It must be generated from an accepted knowledge map and verified source spans, not from the document title alone. The following is a proposed contract, not a currently accepted API schema:

```ts
type AdventureSpec = {
  version: "adventure.v1";
  gameSpecId: string;
  premise: { role: string; setting: string; stakes: string; finalGoal: string };
  cast: Array<{ id: string; name: string; fictional: boolean; role: string }>;
  sources: Array<{
    id: string; sourceId: string; pageStart: number; pageEnd: number;
    spanId: string; extractedTextHash: string; verifiedQuote: string;
  }>;
  acts: Array<{ id: string; goal: string; chapterIds: string[] }>;
  chapters: Array<{
    id: string; encounterId: string; conceptIds: string[]; sourceSpanIds: string[];
    location: { zoneId: string; name: string; entranceId: string; exitId: string };
    objective: string;
    machine: {
      id: string; conceptRelationship: string; modeId: string;
      inputSource: "encounter.params"; feedbackModel: string;
    };
    props: Array<{ id: string; role: "note" | "relay" | "machine" | "exit"; zoneId: string }>;
    prerequisites: string[];
    dialogue: Array<{ speakerId: string; text: string; kind: "fiction" | "evidence"; sourceSpanIds: string[] }>;
    discovery: { itemId: string; text: string; sourceSpanIds: string[] };
    transitions: Array<{
      event: string; requires: string[]; sets: Record<string, boolean>;
      visual: string; explanation: string;
    }>;
    next: Array<{ chapterId: string; requires: string[] }>;
  }>;
  zones: Array<{
    id: string; bounds: [number, number, number, number]; spawn: [number, number];
    traversable: Array<[number, number]>; safeRecovery: [number, number];
    verbs: Array<"move" | "jump" | "inspect" | "collect" | "converse" | "activate" | "manipulate" | "leave">;
  }>;
  inventory: Array<{ id: string; name: string; acquiredAt: string; usedAt: string[] }>;
  finale: { requires: string[]; text: string; visual: string; debriefGameSpecId: string };
  assets: Array<{ id: string; path: string; provenance: string; alt: string; validated: boolean }>;
};
```

All IDs are validated references, not free text interpreted as executable code. `machine.modeId` must equal the encounter's existing mode, and only presented parameters reach player-facing tools. Stored solutions remain behind the deterministic grading boundary. The generator cannot invent a grading rule, use prose as an answer checker, or declare a state restored because the player opened the apparatus.

## Concrete concept-to-world example

For a PDF passage stating that the period of `y = sin(bx)` is `2π/|b|`, preserve the exact page and extracted span. The knowledge map links that span to a period concept; the existing challenge writer creates a validated oscillator encounter with its own parameters. The adventure author then maps repetition to a shutter machine:

```json
{
  "id": "chapter-shutters",
  "encounterId": "e2_period",
  "conceptIds": ["c_period"],
  "sourceSpanIds": ["source-trig:p3:period-rule"],
  "objective": "Synchronize the shutters so a light beam passes into the lens gallery.",
  "machine": {
    "id": "shutter-rings",
    "conceptRelationship": "The inner sine coefficient controls repetition; a complete cycle returns the shutters to their initial state.",
    "modeId": "oscillator",
    "inputSource": "encounter.params",
    "feedbackModel": "Preview repeats with the player's dial; compare cycle completion without revealing the stored target."
  },
  "prerequisites": ["survey.restored"],
  "transitions": [
    {
      "event": "relay.activated",
      "requires": ["survey.restored"],
      "sets": { "shutters.powered": true },
      "visual": "Copper leads glow; the stalled rings begin their preview cycle.",
      "explanation": "The survey circuit supplies power, but calibration is still required."
    },
    {
      "event": "encounter.correct",
      "requires": ["shutters.powered"],
      "sets": { "shutters.restored": true, "lens.entranceOpen": true },
      "visual": "The rings repeat together and a beam reaches the lens gallery.",
      "explanation": "A matched cycle interval synchronizes the beam path."
    }
  ],
  "next": [{ "chapterId": "chapter-lenses", "requires": ["lens.entranceOpen"] }]
}
```

This is a fragment of a planned full contract. The renderer would also require a reachable entrance, note prop, companion position, relay, apparatus, safe recovery, and exit. The world consequence follows the studied relationship: synchronized repetition permits the light path. A generic chest opening after an unrelated question fails this requirement.

## Generation stages and provenance

1. Extract page-aware PDF text and retain source ID, page range, span ID, and content hash. Mark unreadable or incomplete pages. Treat text embedded in a PDF as source data, never as instructions to the generator.
2. Build and validate the knowledge map. Every factual learning objective must point to accepted spans; separate the source's claims from an author's inference. Flag contradictions or missing evidence before authoring a machine.
3. Select deterministic teaching modes and validate challenge parameters with the existing mode schemas. Resolve and grade through the existing pipeline. Keep source quotes and debrief references attached to their original encounters.
4. Author premise, cast, and a three-act graph around those encounters. Each machine needs an explicit concept relationship, a manipulable input, visible feedback, and a consequence that enables a subsequent action or advances the final goal.
5. Place zones and props with a constrained layout generator. Validate reachability and interaction ranges before artwork. Notes add relevant observations without directly giving away an encounter's stored solution.
6. Generate or select original assets, saving prompt/reference provenance and usage rights. Validate dimensions, contrast, loading fallback, alt descriptions, and subject consistency. Never substitute an unverified generated image for a historical source document.
7. Run structural, source, grading, interaction, and content-quality checks. Persist the accepted contract with its validation report; publish only after all required gates pass.

Fictional dialogue may explain navigation, stakes, or a sourced concept in paraphrase. Dialogue labeled `evidence` requires a verified span; a generated quotation attributed to a real person must fail validation unless it is an exact verified source excerpt. History sources require provenance visible to the player, and primary/secondary classification must preserve the document's context. Where the source has no adequate evidence, the system must omit the claim or request better source material rather than fill the gap with confident fiction.

## Verbs and causal progression

Each chapter must support movement, inspection, collection, conversation, activation, manipulation, and departure where appropriate. Platforming adds jumping with a reachable alternative or safe recovery; no mandatory timed reading or limited-life lockout. Inspection explains a prop, collection adds a persistent journal item, conversation supplies contextual guidance, activation powers a visible relay, manipulation previews a relationship, and submission calls the existing grader. Closing the apparatus preserves its input and chapter state.

World state must distinguish `powered`, `noteCollected`, `attempted`, `restored`, and `exitOpen`. An incorrect attempt changes feedback and optionally a harmless preview, never permanently consumes a required item. Only an accepted grading result triggers the restoration transition. Departure requires a reachable open exit and transfers the documented restored state into the next chapter. If collecting a note is a prerequisite, the note cannot be behind the exit that requires it.

Validate the graph from an explicit start state to the finale. Every required inventory item has a reachable producer before its consumer; every gate has an attainable condition; each chapter can recover after a wrong attempt or hazard; each nonterminal location has a supported departure. Prevent circular prerequisites such as a relay requiring the restored machine while the machine requires that relay. Branches must converge or have separately satisfiable finale conditions. The finale summarizes actual restoration flags and passes through to the existing learning debrief.

## Quality gates and evaluation

Structural gates require complete encounter coverage, unique IDs, valid source and asset references, compatible machine modes, reachable locations, satisfiable prerequisites, and bounded content lengths. Grading gates require equivalent behavior to the underlying GameSpec, no stored-answer leakage in the player view, no author-generated correctness rules, and recoverable incorrect attempts. Source gates require verified factual spans, accurate quotations, clearly marked fiction, and no unsupported causal claims.

Human review scores each of the following from 0 (absent), 1 (weak), to 2 (clear and effective): inhabited setting and stakes; player role and companion continuity; concept-to-machine fit; useful verbs beyond answering; specific visible consequences; act-to-act causal continuity; source fidelity; accessible interaction; and satisfying finale. Every category needs 2 for a showcase-quality claim. A beautiful background cannot compensate for an unrelated instrument or unsupported history.

Browser validation must follow human-input paths through move, inspect, collect, converse, activate, open/close, incorrect submit, correct submit, leave, next chapter, and finale. Test all routes, touch layout, keyboard use, focus recovery, and reduced motion. Inspect screenshots of each subject's scene and apparatus. Debug autoSolve is useful for deterministic regression; it does not establish understandable controls, source fidelity, visual quality, or enjoyable play.

## Fallback and honest delivery

If extraction or factual validation fails, stop the affected authoring stage and explain the missing source evidence. If a concept lacks a suitable physical mapping, retain its validated existing encounter in the standard host instead of dressing it in arbitrary machinery. If layout, assets, or graph checks fail, fall back to the established generated-game runtime with its sources, hints, assessment, and debrief intact. Do not partially activate a broken campaign.

The delivery record must name the accepted spec version, validated source spans, tests actually run, visual review completed, known limitations, and whether the result is a hand-authored showcase or generated adventure. The current campaign layer is the former. The full PDF-to-AdventureSpec workflow above remains planned work until its schema, generator, validators, and evaluated runtime are implemented.
