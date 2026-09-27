import type { BlueprintSlice } from "../src/contracts/slices";
import type { Slices } from "../src/pipeline/assemble";
import { getCard } from "../src/library";
import { trigSlices } from "./trig.slices";

/*
 * The trig showcase re-skinned as a Platformer (LIBRARY §5, platformer column; MEGAPROMPT P10.2):
 * same knowledge map, intake, challenges, narrative and assessment; only the genre and the sockets
 * change. This is the Platformer host's smoke fixture, mirroring how fixtures/civil-rights-mystery
 * .slices.ts re-skins the civil-rights showcase for Mystery.
 *
 * The socket for each encounter has to be one the encounter's *family* actually supports in the
 * platformer genre (src/mechanics/families/<family>/index.ts `genres.platformer`), which
 * `validateGameSpec` enforces. That family -> socket table happens to line up with the plain-English
 * mapping in the brief (gate -> gate, chest/mimic -> pickup, lever/console -> switch, bridge -> gap,
 * boss -> boss, anything else -> moving_platform) for the families that actually appear here:
 * mimic_chest ("chest"/mimic in the dungeon fixture) is a truth_finder card, and truth_finder's only
 * platformer socket is "gate" (three doors, the one with the false claim collapses), not "pickup" --
 * so it maps there instead, and every other family below is chosen the same way, off its own
 * `genres.platformer.sockets` list, so the assembled spec always validates.
 */
const PLATFORMER_SOCKET: Record<string, string> = {
  mapper: "gap", // radian_rune_line: "the floor is a number line; land on the value"
  tuner: "moving_platform", // phase_gate: saw-wheel gap only opens at the right period
  truth_finder: "gate", // mimic_chest: three doors, the false-claim one collapses
  sequencer: "gap", // trig_solve_bridge: bridge planks in order, wrong order leaves a gap
};

export const trigPlatformerBlueprint: BlueprintSlice = {
  ...trigSlices.blueprint,
  genre: "platformer",
  title: "The Clockwork Run",
  theme: {
    ...trigSlices.blueprint.theme,
    setting: "A crumbling clockwork gantry racing along the observatory's outer rim",
  },
  premise:
    "The astronomer's star chart is bolted to a gantry that only lowers for someone who can read its rhythms. Run the length of it, clearing every gear and gate, and tune the last one to reach it.",
  encounters: trigSlices.blueprint.encounters.map((e) => {
    if (e.role === "boss") return { ...e, socket: "boss" };
    const card = getCard(e.teachingMechanicId)!;
    return { ...e, socket: PLATFORMER_SOCKET[card.family] ?? "moving_platform" };
  }),
};

/** The dungeon teaches in its prompts. This reskin keeps the original quiz wording. */
const PLATFORMER_PROMPT: Record<string, string> = {
  e1_radians: "The altar's rune line runs from 0 to 2π. Step onto {{target}}.",
  e2_period: "The vault door's rings spin on {{equation}}. Set the dial to one full period so the rings lock.",
  e3_amplitude: "Three chests, three claims about amplitude. One is a mimic. Point your lantern at the lie.",
  e4_solve: "The glyph door opens only if its planks show how to solve 2sin(x) = 1 on [0, 2π). One plank doesn't belong.",
  e5_period_review: "The treasury's chests remember the vault door. One of them is lying about periods.",
  e6_boss: "The Warden's shield spins on {{equation}}. Match its period to break through, and don't let the big swing fool you.",
};

export const trigPlatformerSlices: Slices = {
  ...trigSlices,
  id: "trig_platformer_001",
  createdAt: "2026-09-26T04:15:00.000Z",
  intake: { ...trigSlices.intake, genre: "platformer" },
  challenges: Object.fromEntries(
    Object.entries(trigSlices.challenges).map(([id, challenge]) => [id, { ...challenge, prompt: PLATFORMER_PROMPT[id] ?? challenge.prompt }]),
  ),
  blueprint: trigPlatformerBlueprint,
};
