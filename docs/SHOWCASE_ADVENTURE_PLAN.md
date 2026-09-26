# Showcase adventure upgrade

## Target and reference reading

The supplied Variant: Limits images establish a quality target: a detailed inhabited environment, a readable protagonist, physical machines, contextual dialogue, and a scientific instrument that changes the world. We will create original 2D art and stories, not reuse Triseum assets. A prettier corridor with an unrelated quiz does not meet the target.

## Inventory and scope

All five homepage demos are included: trig dungeon (6 encounters), cell transport (11), civil rights mystery (12), trig platformer (6), and multidisciplinary proving ground (9). Existing fixture grading, source references, telemetry, and debrief remain authoritative. Generated games retain the existing runtime until the richer authoring contract is validated; this prevents implying arbitrary PDFs already produce authored adventures.

## Detailed implementation plan

1. **World and campaign authoring.** Add a typed, deterministic presentation layer keyed by known fixture IDs. Every encounter gets a location name, a mission, an apparatus, a companion line, a collectible field note, and a specific restored-world consequence. Group locations into three acts. Use fictional guides for history and clearly separate their dialogue from historical evidence. Build campaign manifests from shipped encounter IDs and validate complete coverage.
2. **Original art direction.** Produce illustrated environment plates for a turquoise/gold astronomical ruin, luminous biological sanctuary, amber archival newsroom, and violet/copper research station. Compose these with independently animated character silhouettes, machinery, moving particles, layered foregrounds, light shafts, and subject-specific interactive objects. Use responsive framing and reduced-motion support. Document image prompts and provenance.
3. **Playable exploration.** Build a shared 2D scene with actual two-axis navigation for adventure locations; jumping, ledges, and moving hazards for the platformer. Support keyboard and click/touch travel. Give the player a nearby-interact action, a companion, recoverable field notes, a relay to activate, safe hazard recovery, and an exit that opens only after restoring the apparatus. No lives-based lockouts or mandatory timed reading.
4. **Diegetic instruments.** Keep the scene visible beside its apparatus. Render trig as an interactive circular/oscillation instrument with immediate motion feedback; biology as membrane sorting/transport with visible particles; history as a document reconstruction desk with evidence; mixed subjects as distinct scientific station tools. All submissions still go through EncounterRunner and existing mode grading. Wrong attempts offer mechanical feedback and retain the current stage; correct attempts animate the world and allow physical departure.
5. **Adventure shell and progression.** A cinematic introduction establishes role and stakes. Persistent objective, act/location, inventory, journal, companion conversation, map, sound toggle, and controls replace the utilitarian host. Have exploration, apparatus, consequence, and departure states. Let players close apparatus and explore without losing progress. End with a world restoration scene and existing learning debrief. Debug autoSolve remains for grading regression but is not gameplay evidence.
6. **Showcase discovery.** Put original illustrated previews and action-focused story descriptions on every homepage demo. Keep existing play URLs working and generated games on their current host.
7. **Verification.** Typecheck, lint, fixture/mechanic tests, production build, and browser tests. Test human-input paths: movement, interaction, collect, dialogue, open/close apparatus, incorrect and correct submission, unlocked exit, next chapter, and finale. Test all five routes, representative bespoke instruments, mobile layout, keyboard accessibility, and reduced motion. Save screenshots for each subject and inspect them visually. Do not claim debug autoSolve proves fun or visual quality.
8. **PDF generation specification.** Document a future AdventureSpec: premise/stakes, cast, act graph, spatial zones, verbs, source-grounded concept-to-machine mapping, props, inventory prerequisites, dialogue, feedback, visual state transitions, finale, and validated assets. Explain deterministic grading boundaries, minimum content requirements, graph reachability, fallback strategy, and evaluation rubric.

## Shared implementation interfaces

Files live under `src/game/adventure/`. `campaigns.ts` exports `AdventureKind = 'observatory' | 'cell' | 'archive' | 'station'`, `AdventureChapter` (id, name, objective, apparatus, briefing, discovery, consequence), `AdventureCampaign` (id, kind, title, subtitle, role, companion, companionRole, intro, finale, chapters), and `getAdventureCampaign(spec): AdventureCampaign | null`.

`AdventureScene.tsx` exports props `{ kind, chapterIndex, platformer, restored, disabled, collected: boolean, relayActive: boolean, liveValue: number, onCollect(), onRelay(), onInteract(target: 'apparatus' | 'companion' | 'exit') }`. It handles movement and nearby interaction, and exposes clear accessible object buttons. CSS is isolated in `scene.css`. Background paths: `/assets/adventure/{observatory,cell,archive,station}.png`.

`AdventureInstrument.tsx` accepts `{ kind, current: Current, onSubmit(input: unknown), onLive(value: number) }`. It uses only presented parameters for player-facing information and delegates grading to the parent. CSS is isolated in `instrument.css`. The parent keys the instrument by encounter ID.

Root owns `AdventureGame.tsx`, `adventure.css`, integration, original environment plates, homepage, and end-to-end validation. Work is delegated after this plan to cheaper coding agents with disjoint file ownership. Stage commits: plan; campaign/scene/instrument implementation; visual integration and verified gameplay; regression fixes and generation documentation. Stage only named project files, never local caches or environment files.

## Acceptance rubric

- Every showcase has an illustrated environment and an identifiable character, NPC, props, depth, lighting, and motion.
- Each encounter changes a machine and the world; it has a reason in the mission.
- Players do more than walk: inspect, collect, converse, activate, manipulate, traverse, and leave.
- All five demos are completable; mistakes and hazards are recoverable.
- History remains evidence-based and does not turn civil-rights suffering into combat or fictional historical quotes.
- Touch and keyboard users can complete the campaign; mobile UI remains readable.
- Documentation distinguishes what is shipped from future generation work and records actual test results.
