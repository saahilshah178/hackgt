/**
 * src/world/residency.ts — which asset keys one zone needs resident (docs/design/20 §5.7, A4). Pure.
 * W0 STUB with the final signature and a first implementation; A1 owns the file (+ test) and the loader that calls it
 * (src/game/art/manifest-loader.ts `loadZone`). The loader unions this with the manifest entries tagged "all" and the
 * zone, so a mis-tagged entry still loads when referenced.
 */
import type { CutsceneStep, WorldOverlay } from "../contracts/world";
import { getContraption, getSandbox, skinOf } from "./library";

/** Every asset key the zone references: its layers, ground, platforms, props, hub, interiors, ladder and ride assets;
 *  its stations' skin parts, consoles, accessories and blockers; NPCs with a state there; its plaques, collectibles and
 *  sandboxes; the assets of the cutscenes that play there; the cast. Sorted, unique. */
export function assetsForZone(world: WorldOverlay, zoneId: string): string[] {
  const keys = new Set<string>();
  const add = (k: string | null | undefined) => {
    if (k) keys.add(k);
  };
  const zone = world.zones.find((z) => z.id === zoneId);
  if (!zone) return [];

  // cast: always resident with the zone
  add(world.cast.protagonist.look.atlas);
  world.cast.protagonist.look.costume.forEach((c) => add(c.asset));
  add(world.cast.guide.companion.asset);
  add(world.cast.guide.portrait);
  world.cast.speakers.forEach((s) => add(s.portrait));
  world.cast.extras.forEach((s) => add(s.portrait));

  // the zone itself
  zone.layerSets.forEach((ls) => ls.layers.forEach((l) => add(l.asset)));
  zone.segments.forEach((sg) => add(sg.ambient.dapple));
  add(zone.ground.surface);
  add(zone.ground.underside);
  zone.platforms.forEach((p) => add(p.asset));
  zone.interiors.forEach((i) => add(i.facade));
  add(zone.hub?.asset);
  zone.links.forEach((l) => {
    if (l.kind === "ladder") add(l.asset);
    if (l.kind === "ride") add(l.vehicle);
  });

  // stations: skin parts, console, blocker, accessories
  const cutsceneIds = new Set<string>();
  if (zone.entryCutsceneId) cutsceneIds.add(zone.entryCutsceneId);
  zone.exits.forEach((x) => x.cutsceneId && cutsceneIds.add(x.cutsceneId));
  for (const st of world.stations.filter((s) => s.zoneId === zoneId)) {
    const skin = skinOf(getContraption(st.contraption) ?? { skins: [] }, st.skin);
    skin?.parts.forEach((p) => add(p.asset));
    add(st.consoleAsset ?? skin?.console);
    add(st.payoff.blocker?.asset);
    st.accessories.forEach((a) => {
      add(a.carriage);
      add(a.cone?.asset);
    });
    if (st.payoff.rideCutsceneId) cutsceneIds.add(st.payoff.rideCutsceneId);
    if (st.boss?.arenaCutsceneId) cutsceneIds.add(st.boss.arenaCutsceneId);
  }
  for (const sb of world.sandboxes.filter((s) => s.zoneId === zoneId)) {
    skinOf(getSandbox(sb.contraption) ?? { skins: [] }, sb.skin)?.parts.forEach((p) => add(p.asset));
    add(sb.reward?.cosmetic);
  }

  // dressing and side content
  for (const p of world.props.filter((x) => x.zoneId === zoneId)) {
    add(p.asset);
    p.states.forEach((s) => add(s.asset));
    add(p.touch?.litAsset);
  }
  for (const npc of world.npcs.filter((n) => n.states.some((s) => s.zoneId === zoneId))) {
    add(npc.asset);
    add(npc.look?.atlas);
    npc.look?.costume.forEach((c) => add(c.asset));
  }
  world.plaques.filter((p) => p.zoneId === zoneId).forEach((p) => add(p.asset));
  world.collectibles.filter((c) => c.zoneId === zoneId).forEach((c) => add(c.asset));
  world.triggers.filter((t) => t.zoneId === zoneId).forEach((t) => t.cutsceneId && cutsceneIds.add(t.cutsceneId));
  world.quests.forEach((q) => add(q.reward.cosmetic));

  // cutscenes that play in this zone (entry, exits, rides, arenas, triggers; intro/finale when they enter it)
  for (const c of world.cutscenes) {
    const entersHere = c.steps.some((s) => s.do === "enter_zone" && s.zoneId === zoneId);
    if (!cutsceneIds.has(c.id) && !entersHere) continue;
    c.steps.forEach((s: CutsceneStep) => {
      if (s.do === "ride") add(s.vehicle);
      if (s.do === "vista") add(s.asset);
    });
  }
  return [...keys].sort();
}
