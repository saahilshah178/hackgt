import { notFound } from "next/navigation";
import cellFixture from "../../../../fixtures/cell-transport-dungeon.json";
import civilFixture from "../../../../fixtures/civil-rights-dungeon.json";
import trigFixture from "../../../../fixtures/trig-dungeon.json";
import { GameSpec } from "@/contracts/gamespec";
import { getMode } from "@/mechanics/registry";
import type { AidTier, ModeKey } from "@/world/types";
import type { GameKey } from "./demo";
import { PanelGallery, type GalleryGame, type GalleryQuery } from "./PanelGallery";

export const metadata = { title: "Panel gallery (dev)" };

const RAW: readonly [GameKey, unknown][] = [
  ["trig", trigFixture],
  ["cell", cellFixture],
  ["civil", civilFixture],
];

function one(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

/**
 * /dev/panel — the dev-only gallery of every panel card and control on the three showcase fixtures' views
 * (docs/design/20 §7.2 P1). Query: `game` (trig | cell | civil), `enc` (encounter id), `view` (stage | cards),
 * `full=1` (the stage alone, for screenshots), `solved=1` (the success badge), `aid` (0–2), `value` (a preset
 * scalar input or probe value), `slate=1` (the station on console_slate: WidgetControl with the existing widget). Not served in production builds.
 */
export default async function PanelGalleryPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (process.env.NODE_ENV === "production") notFound();
  const sp = await searchParams;
  const games: GalleryGame[] = RAW.map(([key, raw]) => {
    const spec = GameSpec.parse(raw);
    return {
      key,
      title: spec.title,
      specId: spec.id,
      stations: spec.encounters.map((e, i) => {
        const mode = getMode(e.familyId, e.mode);
        return {
          encounterId: e.id,
          familyId: e.familyId,
          mode: e.mode,
          modeKey: `${e.familyId}.${e.mode}` as ModeKey,
          prompt: e.prompt,
          hints: [...e.hints],
          view: mode ? (JSON.parse(JSON.stringify(mode.present(e.params, spec.seed + i))) as unknown) : null,
          params: e.params as unknown,
          solution: e.solution as unknown,
        };
      }),
    };
  });
  const game = (["trig", "cell", "civil"] as const).find((g) => g === one(sp.game)) ?? "trig";
  const aid = Number(one(sp.aid) ?? 0);
  const value = one(sp.value);
  const initial: GalleryQuery = {
    game,
    enc: one(sp.enc) ?? null,
    view: one(sp.view) === "cards" ? "cards" : "stage",
    full: one(sp.full) === "1",
    solved: one(sp.solved) === "1",
    aid: (aid === 1 || aid === 2 ? aid : 0) as AidTier,
    value: value !== undefined && Number.isFinite(Number(value)) ? Number(value) : null,
    slate: one(sp.slate) === "1",
  };
  return <PanelGallery games={games} initial={initial} />;
}
