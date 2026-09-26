# art/ — art sources (data only)

Everything the showcase games draw is built from this directory by `pnpm art:build`. Nobody edits generated files
by hand. The contracts are in `docs/design/20-expedition-architecture.md` §5. The kit catalogue (31 generators and
their parameters) is in `docs/design/02-assets-and-art-pipeline.md` §3a.2, and the code is in `src/game/art/kit/`.

## Commands

| Command | What it does |
|---|---|
| `pnpm art:build [--ns <ns>] [--kit-only]` | Builds `public/assets/expedition/<ns>/**`, `manifest.json`, `License.txt` and `src/world/asset-index/<ns>.generated.ts` while holding `.data/art-build.lock`. `--kit-only` builds every hero key from its kit entry (fallback ladder step 1). |
| `pnpm art:check` | Rebuilds in memory and byte-compares with the committed output, including PNG atlases and stale files. Must be clean before a checkpoint. |
| `pnpm art:sheet [--ns <ns>]` | Contact sheets in `.data/art-sheet/<ns>.png`. They show every entry, 3 extra seeds per kit entry (`seed + 1…3`), every atlas frame with its 7 anchors, and every puppet animation (4 sampled poses) plus the packed sheet. Read the PNG before you call art done. |
| `pnpm chars:build` | Alias for `pnpm art:build --ns shared`, which runs the character rig. |

The build prints the entries, SVG bytes (raw and gzip), VRAM per zone at dpr 1.5 and the swap peak. It **fails** when
over budget (20 §5.8): a biome's zone above 120/135/140 MB, a zone swap above 180 MB, a biome's source above 1.2 MB, or
more than 40 hero files.

## Layout and ownership (20 §5.1, §7.3)

```
art/<ns>/biome.json                           {paletteId, heroCap: 40, zones}              main
art/<ns>/zones/<zoneId>.kit.json               zone layers, ground, kit props               art lane (A2)
art/<ns>/vista/vista.kit.json                  finale compositions                          art lane (A3)
art/<ns>/parts/<skin>/parts.kit.json           a kit entry for every §4.3 slot of the skin  art lane (A2)
art/<ns>/parts/<skin>/parts.hero.json + *.svg  the skin's hero slots                        content or contraption lane
art/<ns>/landmarks/landmarks.{kit,hero}.json   hero layers, props, hubs                     that game's content lane
art/<ns>/cast/cast.{kit,hero}.json + *.svg + *.anims.json   costumes, companion and NPC puppets
art/shared/characters/{bodies,characters}.json the rig (Kenney bodies → recoloured characters)   art lane
art/shared/companions/companions.kit.json      shared.companion.guide_standin (kit stand-in companion)
```

Namespaces are `shared`, `orrery_terraces`, `living_gate` and `archive_of_voices`. A PDF-generated game uses
`gen_<gameId>`, and its `biome.json` names a biome `paletteId` to borrow. Keys are `ns.group.name[.variant]`. The groups
are `layer ground prop part costume char companion npc fx ui vista doc silhouette kit`.

## Fragments

A fragment is `{ "entries": [ … ] }`. Each entry has `key`, optional `kind` (`svg` by default, or `puppet`), optional
`zone` (`"all"` by default, or a zone id from `biome.json`), and optional `rasterScale`, `tileWidth`, `pivot`, `scroll`
and `legacyId`. It also has **exactly one source**:

```jsonc
{ "key": "orrery_terraces.layer.z1_mesa", "gen": "ridgeBand", "seed": null, "zone": "z1_sunward", "scroll": 0.15,
  "params": { "style": "butte_fluted", "height": [360, 560], "finish": { "ao": false, "rim": true, "haze": 0.4 } } }
{ "key": "orrery_terraces.part.ring_gate_wall", "file": "ring_gate_wall.svg", "zone": "z1_sunward" }        // *.hero.json
{ "key": "living_gate.prop.tank", "recipe": "glass_tank", "args": { "w": 220, "h": 320 } }
{ "key": "orrery_terraces.layer.default_far", "recipe": "default_zone", "args": { "biome": "orrery_terraces", "layer": "far" } }
{ "key": "orrery_terraces.companion.cog", "kind": "puppet", "recipe": "companion_standin", "args": {} }  // kit fallback for Cog
{ "key": "archive_of_voices.prop.record_engine", "kind": "puppet", "size": [900, 1000], "anims": "record_engine.anims.json",
  "parts": [ { "name": "drum", "from": { "file": "engine_drum.svg" }, "pivot": [0.5, 0.5], "z": 0, "rest": [450, 520] },
             { "name": "ring_a", "from": { "gen": "ringStack", "params": { "size": 600 } }, "pivot": [0.5, 0.5], "z": 1, "rest": [450, 520] } ] }
```

- **`params` are merged over the generator's `defaults`**, deeply for objects; arrays replace. You only write what
  differs.
- **Seed:** `seed ?? fnv1a32(key)`, so reordering entries changes nothing. To change a look, pick a seed from the
  contact sheet.
- **Merge rule:** a key lives in at most one `*.kit.json` and at most one `*.hero.json`. **Every hero key also needs a
  kit entry** as its automatic fallback. The hero wins unless `--kit-only` is set or the hero fails lint, in which case
  the build warns and uses the kit entry.
- **Extras:** `waterBand` also writes `<key>.b`, a transparent streak layer for offset scrolling. `gauge` `arc_meter`
  also writes `<key>.needle`.
- **Recipes** are in `src/game/art/kit/recipes.ts`: `glass_tank`, `default_zone` (per biome and layer: `sky clouds far
  midfar mid fore surface underside`) and `companion_standin`.

## Hero SVG authoring rules (20 §5.3)

- **Root:** `<svg viewBox="0 0 W H" width="W" height="H" data-pivot="fx,fy">` in world units (1 H = 170, the view is
  1080 tall). Grounded art uses pivot `0.5,1` and sits on y = H. Rotating parts are separate files with their pivot at
  the hub (`0.5,0.5`).
- **Colour:** palette tokens only, e.g. `fill="{{stone.lit}}"`. A raw `#hex` fails unless it is inside
  `<!-- raw-ok --> … <!-- /raw-ok -->`. Modifiers are `{{tok|haze:0.4}}` (toward `haze`), `{{tok|mix:other.tok:0.3}}`,
  `{{tok|dim:0.2}}` (toward `shadow`), `{{tok|light:0.2}}` (toward white) and `{{tok|alpha:0.5}}`. rgba tokens become
  `fill` + `fill-opacity`. Tokens come from `src/game/art/palettes/<ns>.ts` layered over `palettes/shared.ts`.
- **Look:** low sun from the upper left. Lit faces use `*.lit` and shadow faces use `*.shade`. Shadows are separate
  shapes in `{{shadow}}` at 30 %. Use at most 3 gradient stops per shape, and `feGaussianBlur` is the only filter. The
  darkest colour is `#2B3A44`.
- **Anchors:** `<circle id="anchor-<name>" cx cy r="0"/>`. They may sit inside transformed groups. They are exported
  to the manifest in design units and stripped from the output.
- **Text:** static, spec-independent engraving only, e.g.
  `<text data-engrave="serif" x y font-size text-anchor fill="{{tok}}">π/2</text>`. It becomes paths at build time. Use
  `caps` (Cinzel: wordmarks and Roman numerals; no π), `serif` or `serif_italic` (EB Garamond: maths). Superscript is
  `^{…}` and subscript is `_{…}` (write `sin^{-1}`). A missing glyph fails the build. The limit is 8 KB of engraving per
  asset. **Anything derived from a spec is a DOM label** (`WorldLabelLayer`).
- **Banned:** plain `<text>`, `<image>`, external `href`/`url()`, `<style>`/`class`, `<script>`, event attributes, and
  any filter primitive except `feGaussianBlur`. Files are capped at 60 KB (120 KB for `layer` assets).
- **Puppets:** one file in its rest pose with ≤ 8 parts. Each part is
  `<g id="part-<name>" data-pivot="x,y" data-z="n" data-box="x y w h">`, where the pivot and box are absolute viewBox
  units. If `data-box` is missing, the build measures the part in Chromium. A multi-frame part holds
  `<g id="f0">…<g id="fN">` (≤ 8 frames). Put the animations in `<name>.anims.json` beside the SVG as a list of
  `PuppetAnim`. Companions need `idle`, `talk` and `cue`; NPC puppets need `idle` and `talk`. Track semantics are in
  `src/game/expedition/puppets/anim.ts`: `keys` are absolute (`frame` keys step), and `wave` adds
  `amp·sin(2π(hz·t + phase))`.

## The character rig (20 §5.5, 02 §3b)

`art/shared/characters/bodies.json` maps each Kenney body (`female_adventurer`, `female_person`, `male_person`) to its
zip folder, plus a **group-scoped fill map**: `(symbol group regex, source hex) → role`. An unmapped pair fails the
build and lists itself. `characters.json` maps character → body, namespace (whose palette recolours it), frame set
(`protagonist` = 28 frames in 7 × 4, `npc` = 12 frames in 6 × 2) and role overrides. A role resolves to
`char.<id>.<role>` in the game palette, then `char.<role>` in shared.

The build strips Kenney's filter and recolours the parts. It repacks only the frame's own instances and bakes the
**painterly finish**: a warm key-light rim on the upper-left edges of every limb, a cool shade on the lower-right, a
soft-light key tint masked to the figure, and a soft outline glow (tokens `char.key_light`, `char.shade`,
`char.outline_glow`). It then renders at 2× in Playwright's Chromium to `public/assets/expedition/shared/char/<id>.png`
+ `.json`, and copies Kenney's untinted HD sheet as the `load.atlasXML` fallback. Anchors (`head face torso back
hand_r hand_l feet`, display units from the frame's top-left, rotation in degrees) come from the vector's own
transforms. `hand_r` is the hand painted in front. The Kenney zip stays in `.data/asset-scratch/` and is never
committed. Without it, `art:build --ns shared` keeps the committed atlases and warns.

## Runtime (for host code)

- `src/game/art/manifest-loader.ts`:
  - `fetchCatalog(["shared", biome], flagsFrom(location.search, devicePixelRatio))`
  - `loadZone(scene, catalog, world, zoneId, onProgress)` → `{keys, queued, missing, failed}`. It never rejects and
    only logs `console.warn`.
  - `unloadZone(scene, catalog, world, prevId, nextId)` runs after the transition wipe.
  - Helpers: `textureK(scene, key)`, so sprites `setScale(1 / k)`; `atlasFrame`, `isFallbackAtlas`, `anchorsOf`,
    `assetUrl`, `zoneKeys`, `keysToUnload`.
  - Puppet part frames are named `<part>#<frame>`. A layer whose `tileWidth` is narrower than its width gets frames
    `"0"`, `"1"`, ….
  - Query flags: `?lowres=1` caps dpr at 1, and `?charfallback=1` uses the untinted Kenney sheets.
- `createManifestZoneLoader(catalog)` in the same file wraps all of the above in the host's `ZoneArtLoader` shape
  (`src/game/hosts/expedition/art/zone-loader.ts`): `loadZone`, `unloadZone`, `texture`, `info`, `rig`, `resident`,
  `destroy`, plus `last.missing` for the stand-in painter.
- `src/game/expedition/puppets/Puppet.ts`: `new Puppet(scene, entry, {x, y, k: textureK(scene, entry.key)})`, then
  `play(id)`, `stop()`, `setDormant(on)`, `setFlipX`, `destroy()`. An `svg` entry plays as a one-part puppet with
  procedural `idle`, `talk` and `cue`.
- `src/world/residency.ts` `assetsForZone(world, zoneId)` is pure. It returns everything a zone references, including
  the cast, the intro (first zone) and the finale (the last station's zone).
- `src/game/art/palette.ts`: `BIOME_PALETTES[ns]`, `UI_TOKENS`, `tokenHex(ns, expr)`, `tokenNumber(ns, expr)`.
