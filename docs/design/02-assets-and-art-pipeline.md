# 02 — Assets & Art Pipeline

Status: **revised 2026-09-26 (night): reconciled with `20-expedition-architecture.md` revision 3** (the
`31-critique-round2.md` amendments A2, A3, A4). Research and downloads verified; the procedural kit, rig recolour,
text-to-path and naming rules below were prototyped against the real files in `.data/asset-scratch/` in a scratch
directory (no repo writes). Feeds the art lane L5 (20 §7.2 items A1–A3), the contraption lanes' skin heroes (KA, KB,
KC) and the content lanes' landmarks and cast (C1–C3) for `fixtures/trig-dungeon.json` (The Orrery Terraces),
`fixtures/cell-transport-dungeon.json` (The Living Gate) and `fixtures/civil-rights-mystery.json` (The Archive of
Voices).

**How this document relates to 20.** 20 is the implementable source of truth for the art **contracts**: the one
naming table (20 §5.1, copied verbatim in §3.0 below), the build step order (20 §5.2), the merged `AssetManifest`
schema (20 §1.3), the character and puppet contract (20 §5.5), residency (20 §5.7) and budgets (20 §5.8). This
document holds what those contracts rest on: the verified sources (§1), the Phaser loader facts (§2), the 31 kit
generator signatures (§3a), the rig recolour map and anchor walk (§3b), the engraving details (§3e) and the measured
VRAM figures (§3f). If the two ever disagree on a key, a path, a schema field or a budget, 20 wins.

## CHANGELOG

| Date | Change | Source |
|---|---|---|
| 2026-09-26 (night) | **§3.0 is now a verbatim copy of 20 §5.1**, the one naming table (A2). 20's keys and groups win (`layer`, `ground`, `prop`, `part`, `costume`, `char`, `companion`, `npc`, `fx`, `ui`, `vista`, `doc`, `silhouette`, `kit`); this document's depth groups (`sky`/`far`/`midfar`/`mid`/`fore`/`light`) and `<ns>.char.*` overlay keys are retired; part keys are `<ns>.part.<skin>_<slot>`. This document's hero cap (40), kit location (`src/game/art/kit/`), 31 `KitName`s, two-font engraving and build steps are adopted by 20. | 31 A2 |
| 2026-09-26 (night) | **Kit names mapped** (§3a.1): 20's `panelBox` → `plate` style `junction_box`, `cabinet` → `shelving` style `filing_drawers` (both new style values), `glassTank` → the `compose` recipe `glass_tank`, `latticeTruss` → `truss lattice_mast`, `consoleLectern` → `lectern`, `mesaBand` → `ridgeBand`, `canopyBlob` → `canopy`. Named compositions live in `src/game/art/kit/recipes.ts`. | 31 A2 |
| 2026-09-26 (night) | **Art sources are per-owner fragments** (§3a.4): `art/<ns>/biome.json` keeps namespace settings only; entries live in `*.kit.json` / `*.hero.json` fragments, one owner each; every hero key also has a kit entry (its automatic fallback). Generated files are written only by `art:build` under a lock. | 31 A1, A2 |
| 2026-09-26 (night) | **One character raster path** (§3b): the recoloured vector is repacked (28 frames for protagonists, 12 for NPCs) and rendered to a **PNG atlas** in Playwright's Chromium at 2×; keys are `shared.char.<id>`; the computed anchors are mapped onto 20's `RigAnchor` names (`handF` → `hand_r`, `handB` → `hand_l`, plus `face`, `back`, `feet`); costume overlays attach through the world JSON's `CharacterLook.costume` (the `data-attach` SVG attributes are retired); the untinted `load.atlasXML` sheet stays the fallback. The SVG rig sheet and `--rig-png` are superseded. | 31 A3 |
| 2026-09-26 (night) | **Puppets are a manifest kind** (§3b.5): `kind: "puppet"` with `parts`, a `restFile` and `anims` from `<name>.anims.json` (`idle`, `talk`, `cue` + custom ids); runtime `src/game/expedition/puppets/Puppet.ts`; recipe puppets for hubs. **The Ida bust is dropped** (Ida is the `shared.char.ida` atlas + two overlays). | 31 A3 |
| 2026-09-26 (night) | **Manifest merged** into 20 §1.3's `AssetManifest` (§3d): kinds `svg`, `puppet`, `atlas`; `zone` per entry (`"all"` or a zone id); per-zone `vram` and `swapPeakMb`. The loader moves to `src/game/art/manifest-loader.ts` with `loadZone` / `unloadZone` and `assetsForZone`. | 31 A2, A4 |
| 2026-09-26 (night) | **§3f**: residency and budgets adopted by 20 (§2.11, §5.7, §5.8); the worked estimate uses the PNG atlas (5.5 MB), so trig Z1 is ≈ 91 MB; P0 hero counts are the game docs' (37 / 36 / 35). **§4's hero tables are superseded** by the game docs' §0 lists and 20 §7's lane quotas. | 31 A1, A2, A4 |
| 2026-09-26 | **§3a replaced.** The primary source is no longer "an agent hand-writes every SVG". It is now a **procedural SVG kit**: 31 seeded, token-coloured generators, each with a TypeScript signature. `art:build` emits their output as ordinary SVG files. Hand-authored SVG is capped at **≤ 40 hero files per biome**, and everything else comes from the kit. This replaces roughly 560 planned hand-authored files (the trig, cell and civil lists) with 24 / 31 / 30 hero files at P0. | critique F1, amendment 14 (the critique proposed a cap of about 60; this doc sets 40, per the demo brief) |
| 2026-09-26 | **§3b replaced.** There is now **one human rig**. It uses Kenney `toon-characters` Female adventurer frames, **recoloured at build time from `Vector/character_femaleAdventurer.svg`** with a group-scoped fill map (verified by rendering), sliced with the atlas XML and repacked into one SVG sheet. Per-frame costume anchors (head, torso, two hands, facing) are **derived from the vector rig's own `<use>` transforms** (verified on all 45 frames). Wren, the Diver and Nell are one rig in three costumes. Wren's 18-part puppet (trig A137–A154) moves to post-demo. `setTint` recolouring is dropped, because it cannot produce selective skin or hair colours. | critique §1.4 "Characters", F3, amendment 19 |
| 2026-09-26 | **Guides as SVG puppets.** Cog, Pip + an Ora bust, and Wick + an Ida bust are small puppets with at most 8 parts and 3 animations each (idle, talk, cue/react), packed per puppet by `art:build`. | amendment 19, bible §6.3 |
| 2026-09-26 | **New §3.0 naming table.** Namespaces are `orrery_terraces`, `living_gate`, `archive_of_voices` and `shared`. Keys are `ns.group.name`. Pivots are fractions. The raster factor is `k = rasterScale × min(dpr, 1.5)`, which this doc proposes rounding up to the next 0.25. Retired: `variant/`, `cell/`, `archive-city`, `trig-canyon`, `cr.*`, `cell.*`, `trig.*` and `A###` keys, px pivots, and `{scale: devicePixelRatio}`. | critique §1.4 "Asset namespaces", amendment 22 |
| 2026-09-26 | **New §3e: build-time text-to-path.** `<text data-engrave>` becomes a `<path>` using `opentype.js@2.0.0` with two OFL fonts from npm (Cinzel for caps, EB Garamond latin + greek for math). Versions and glyph coverage were checked with `npm view` and a real parse. Engraving is **only** for spec-independent text. Every dynamic or spec-derived label is DOM (`WorldLabelLayer`), and "Phaser text" is banned. The trig Warden shield equation moves to DOM. | critique §1.4 "World text", F4, amendment 21 |
| 2026-09-26 | **§3f replaced.** The size and VRAM budget is now given per game for P0 and full, with a worked VRAM estimate and a zone-residency policy. The old "~0.5–1 MB per biome" table is superseded. | brief; 20 §5.5 |
| 2026-09-26 | **New §4: P0 asset lists per game.** Each lists the hand-authored hero files (zone 1, every station, characters) and the kit generators that cover everything else, cross-referenced to the game docs' old ids. | amendment 12 (demo cut), amendment 14 (re-tag lists) |
| 2026-09-26 | §0 no longer quotes a panel width (it cites 20 §3.1). The §1 unzip layout was corrected against `unzip -l`: it adds `Parts/back.png`, both tilesheet XMLs, and the single `Vector/*.svg`. §2 adds the verified `Texture.add` signature for frame slicing. The old §6 (mentioned in the text but never written) is now written as generalization to PDF games. | self-audit |
| 2026-09-25 | First version: sourcing survey, Phaser loader findings, the agent-SVG plan, and the Kenney PNG character plan. | — |

**Folded into the other docs** (20 revision 3): 20 §5.2 no longer copies the character PNGs verbatim (the rig is
recoloured and rendered, §3b); 20 §5.3 allows `<text data-engrave>` in sources (output files still carry none); the
game docs' old asset conventions (paths, `{scale: dpr}`, px pivots, "Phaser text on blank plates", "×2 for props")
are retired by the naming table (§3.0). The one open difference, the character raster path, was settled in 20's
favour (a PNG atlas, §3b).

## 0. The bar we're aiming at, translated to what's actually buildable

The reference screenshots (Triseum's *Variant: Limits*) are a full 3D Unreal/Unity title: real-time-lit rock
canyons, sculpted architecture, a rigged 3D character, particle beams. We are a hackathon-timeline Next.js + Phaser
4 (WebGL 2D) app. **We cannot and should not attempt 3D.** What we *can* copy faithfully, because it's about
composition and UI, not renderer:

- A **world pane** that stays visible and reacts live, plus an **instrument panel** on the right with dark-teal
  hex-grid panel chrome, stacked function graphs, an orange scrubber and readout, and a bottom dialogue bar with a
  guide emblem and an info button. The layout widths are owned by 20 §3.1 (a full-bleed canvas with a DOM overlay),
  not by this doc. All of this is achievable as an SVG/DOM overlay. It is UI, not 3D rendering. The hex-grid texture
  itself is a kit generator (§3a, `hexGridPanel`).
- A **protagonist you can see walking through a real place**, not a coloured rectangle. It is achievable as 2D
  side view: painterly parallax layers plus an animated character, in the style of Owlboy / Hyper Light Drifter /
  Bastion rather than Triseum's 3D. That gives the same *emotional* read (a world, a body in it) at 2D-art cost.
- **Contraptions that are the graph, physically.** Gate wheels whose rotation *is* `f(a)`, a beam that *is* an
  input scrubbed, orb placement that *is* a solution, rather than a quiz sitting next to a static picture. This is a
  data-binding problem (20 §2.5 `ContraptionMeta.pose` → part transforms), not an art problem. This doc only
  guarantees that every moving part is a **separate texture with a fractional pivot and named anchors**.

This document covers only the **art assets and pipeline**: where the pixels and vectors come from, how they're
generated, loaded, sized and named, and how a fourth (PDF-driven) biome gets art without a human artist (§6).

## 1. Asset sourcing — verified downloads

All packs below were downloaded for real with `curl -sSL -o` into `.data/asset-scratch/` (gitignored,
19 MB total) and opened with `unzip -l`. Every URL in this table returned HTTP 200 and a valid zip. Kenney's
real download URL is **not** `kenney.nl/assets/<slug>/download`. The site is a small SPA-ish page whose HTML
embeds a direct CDN link. This is the pattern actually observed:

```
https://kenney.nl/media/pages/assets/<slug>/<content-hash>-<unix-ts>/kenney_<slug|variant>.zip
```

To get the current link, fetch `https://kenney.nl/assets/<slug>` and run
`grep -o "https://kenney.nl/media/pages/assets/[^\"']*\.zip"`. The hash changes when Kenney updates a pack, so don't
hardcode past this doc's date.

| Pack (slug) | Working URL | License | Files | Sprite form | Notes |
|---|---|---|---|---|---|
| `toon-characters` ("Toon Characters 1") | `kenney.nl/media/pages/assets/toon-characters/4e8a6e4e53-1774770819/kenney_toon-characters.zip` | CC0 | 746 | Individual PNGs, **96×128** (also a 2× "HD" set, 192×256), a tilesheet + XML atlas at both sizes, and **one source SVG per character** | 6 characters (Male/Female adventurer, Male/Female person, Robot, Zombie), each with **45 pose PNGs** (list in §3b), 11 loose rig **Parts**, a `Tilesheet/` (sheet PNG + TexturePacker XML, 1× and HD), and `Vector/character_<name>.svg` (864×640, the whole 1× sheet as vector art). **This is our only human rig source** (§3b). |
| `platformer-characters` ("Platformer Art Deluxe" character set) | `kenney.nl/media/pages/assets/platformer-characters/b85f388c42-1677693768/kenney_platformer-characters.zip` | CC0 | 195 | Tilesheet PNG + loose `Limbs/` parts (arm, body_front/back, head, hand) | Adventurer rig, same "assemble from parts" model as toon-characters but lower fidelity. Redundant with toon-characters; keep as backup only. |
| `shape-characters` | `kenney.nl/media/pages/assets/shape-characters/c016420b08-1698339465/kenney_shape-characters.zip` | CC0 | 224 | PNG spritesheet + XML atlas + source `Vector/overview.svg` | Geometric primitive "bodies" (circle, rhombus, etc.) in swappable colours. Silhouette reference for automaton NPCs (Brasswick, Kay, Sucra); not shipped. |
| `abstract-platformer` | `kenney.nl/media/pages/assets/abstract-platformer/a8f4badcb5-1677579172/kenney_abstract-platformer.zip` | CC0 | 419 | Individual PNGs + `Spritesheet/*.png` + `.xml` (TexturePacker XML) | Blocks, buttons (pressed states), doors, gems/crystals, floating enemies. Silhouette reference for kit parameters (crystal proportions, button travel); its flat-cartoon style is not shipped. |
| `pixel-platformer` | `kenney.nl/media/pages/assets/pixel-platformer/33bb4921eb-1696667883/kenney_pixel-platformer.zip` | CC0 | 258 | Individual PNGs, no atlas | Low-res pixel-art tiles; not a style match for the painterly target, so out of scope. |
| `background-elements` ("Background Elements Redux"; the exact slug is `background-elements`, not `-redux`) | `kenney.nl/media/pages/assets/background-elements/b66a1ddec7-1677670395/kenney_background-elements.zip` | CC0 | 140 | Individual PNGs, ~190×127 avg, plus a `Flat/` flat-colour variant set | Clouds, castle silhouettes, fences. Composition reference (cloud spacing, silhouette layer count) for `cloudBand`, `skyline` and `railing` defaults. |
| `hexagon-pack` | `kenney.nl/media/pages/assets/hexagon-pack/433cdc69d6-1677662331/kenney_hexagon-pack.zip` | CC0 | 347 | Individual PNGs + `Spritesheets/*.png` (2048×2048) + XML atlas | Isometric hex tiles; wrong projection for a side view. The **hex motif** is the reference for `hexGridPanel`. |
| `ui-pack` ("UI Pack"), v2.0 | `kenney.nl/media/pages/assets/ui-pack/f651646eab-1718203990/kenney_ui-pack.zip` | CC0 | 1343 | Individual PNGs (9-slice-friendly panel and button pieces), 6 colour themes, bitmap `Font/` | Generic rounded-cartoon UI (buttons, bars, panels) with no slider, knob or dial pieces at all. **Do not use for the instrument panel**: it reads as mobile-game UI, not a sci-fi dark-teal readout. |
| `ui-pack-sci-fi` ("UI Pack: Sci-Fi / Space expansion") | `kenney.nl/media/pages/assets/ui-pack-sci-fi/b67c2acd31-1724181109/kenney_ui-pack-space-expansion.zip` | CC0 | 1144 | Individual PNGs, 5 colour themes (including Blue, the closest to our teal) | Same "no slider/dial" gap as `ui-pack`. A texture reference only (bevel style, glow-edge convention). The panel itself (hex grid, graph strip, orange scrubber, dialogue bar) has no off-the-shelf equivalent anywhere. |
| `generic-items` | `kenney.nl/media/pages/assets/generic-items/96b9087204-1677667000/kenney_generic-items.zip` | CC0 | 344 | Individual PNGs + 2 atlas files | Coins, potions, keys, gems, tools. Candidate for small pickups and side-content rewards in any biome (P2). |
| `tiny-dungeon` | `kenney.nl/media/pages/assets/tiny-dungeon/f8422efb44-1674742415/kenney_tiny-dungeon.zip` | CC0 | 145 | Individual PNGs, 16×16 | Same micro-tile style as the existing `public/assets/1bit` set already in the repo; not a fidelity upgrade. Listed only for completeness. |
| `tiny-town` | `kenney.nl/media/pages/assets/tiny-town/a415fbeb49-1735736916/kenney_tiny-town.zip` | CC0 | 143 | Individual PNGs, 16×16 | Same as above: micro-scale, the wrong fidelity tier for the civil-rights city. |

**Slugs that returned 404** and were *not* used (Kenney has renamed or retired these): `toon-characters-1` (the
correct slug is `toon-characters`), `background-elements-redux`, `ui-pack-space-expansion` (that's the file name
inside `ui-pack-sci-fi`, not the page slug), `city-characters`, `medieval-fantasy-characters`,
`sci-fi-characters`, `animal-pack-redux`, `space-shooter-redux`. If a future session needs one of these ideas,
search `kenney.nl/assets` by keyword rather than guessing the slug.

**OpenGameArt.org**: not downloaded. Every gap above has no strong CC0 spritesheet on Kenney: painterly canyon and
temple architecture, a cell/tissue interior, a 1950s–60s American city (bus depot, courthouse, archive), and *all*
the instrument-panel chrome. A systematic OpenGameArt sweep (dozens of individually licensed, inconsistently
styled uploads) is lower value than the kit (§3a) for a **coherent, re-tintable, per-biome** look. OpenGameArt
stays a fallback for a single hard-to-draw item. If it is used, verify each asset's CC0/CC-BY licence first
(OpenGameArt mixes licences per upload, unlike Kenney's blanket CC0).

### Unzip layout (verified with `unzip -l`, 2026-09-26)

```
toon-characters.zip
├── License.txt                          CC0 text, 603 bytes (dated 2026-03-29)
├── Female adventurer/
│   ├── PNG/
│   │   ├── Parts/        arm, back, body, bodyBack, hand, head, headBack, headFocus, headShock, leg, legBend (.png)
│   │   ├── Parts HD/     the same 11, 2×
│   │   ├── Poses/        character_femaleAdventurer_<pose>.png  ×45, 96×128, 8-bit colormap
│   │   └── Poses HD/     the same 45, 192×256
│   ├── Tilesheet/        character_femaleAdventurer_sheet.png (864×640) + _sheet.xml (1× SubTextures)
│   │                     character_femaleAdventurer_sheetHD.png (1728×1280) + _sheetHD.xml (exactly 2× the 1× XML)
│   └── Vector/           character_femaleAdventurer.svg   182,783 bytes, viewBox 0 0 864 640 (= the 1× sheet)
├── Male adventurer/  Female person/  Male person/  Robot/  Zombie/   (same structure; every Vector/*.svg is 864×640)

abstract-platformer.zip
├── <150 individual PNGs at root>       blockBrown.png, doorGreen.png, enemyFloating_1.png, ...
├── Spritesheet/
│   ├── spritesheet_complete.png + .xml (TexturePacker XML atlas — Phaser load.atlasXML)
│   └── spritesheet_enemies.png + .xml

hexagon-pack.zip
├── PNG/Objects/…  PNG/Terrain/…  PNG/Buildings/…   (individual PNGs)
├── Spritesheets/hexagonAll_sheet.png (2048×2048) + matching .xml
```

## 2. Phaser 4.2.1 texture loading — what's actually available

These were checked directly against `node_modules/phaser/types/phaser.d.ts` (148k lines; grepped, not recalled
from memory). The `LoaderPlugin` (`this.load` in a Scene) has all of these built into the default build:

- `load.image(key, url)` — a single PNG/JPG/WebP.
- `load.spritesheet(key, url, { frameWidth, frameHeight, ... })` — a uniform-grid sheet.
- `load.atlas(key, textureURL, atlasURL)` — a TexturePacker **JSON** atlas.
- `load.atlasXML(key, textureURL, atlasURL)` — a TexturePacker **XML** atlas. This is exactly what
  `abstract-platformer`, `hexagon-pack`, `generic-items`, `shape-characters` and `toon-characters` ship as
  `Spritesheet/*.xml` / `Tilesheet/*.xml`, so those packs load with zero re-packing. (This is the P0 emergency
  fallback for the rig; see §3b.)
- `load.multiatlas(key, jsonURL)` — a multi-page atlas (not needed at our scale).
- `load.aseprite(key, png, json)` — an Aseprite JSON export (not used).
- `load.svg(key, url, svgConfig)` (d.ts line 90412) — **rasterizes SVG to a bitmap texture at load time.**
  `svgConfig` accepts `{ width, height }` (exact target size) **or** `{ scale }` (a multiplier on the SVG's
  intrinsic size). If both are given, `scale` wins and width/height are ignored. We always pass `{width, height}`
  computed from the manifest (§3.0), never `{scale}`.
- **`Texture.add(name, sourceIndex, x, y, width, height)`** (d.ts line 135050) adds a named frame to an existing
  texture. This is how a rasterized SVG sheet (a puppet's part sheet, a multi-frame FX strip) is sliced into frames
  after `load.svg` completes: `this.textures.get(key).add(frameName, 0, x·k, y·k, w·k, h·k)`. The character rig is
  a PNG atlas loaded with `load.atlas` (§3b), so it needs no slicing.

**Caveats for SVG → Phaser texture** (confirmed from the type doc and Phaser's WebGL pipeline; verify visually per
asset on the contact sheet):
- Rasterization happens once at load time via an offscreen canvas/Image draw, and then it's a normal WebGL texture.
  The runtime cost is one decode, not per-frame SVG parsing. Budget about 5–30 ms per texture, which is why zone
  loads hide behind the zone-transition wipe (§3f).
- **No CSS.** SVGs must be self-contained: inline `fill`/`stroke`, `<linearGradient>`/`<radialGradient>` defs, and
  `feGaussianBlur` for soft glow. No external stylesheet and no `class`-based theming. **Gradients work**, since they
  are part of the SVG's own paint. Other filter primitives are banned by lint (20 §5.3). The Kenney vector's own
  filter is stripped at build (§3b).
- No re-tint via the SVG source after load. Recolour is a **build-time token substitution** (§3a, §3b). Runtime
  tint is kept only for whole-object effects (dormant desaturation via ColorMatrix, ADD glows, flashes).
- Texture size is fixed at load and there is no runtime re-rasterization for zoom, so `k` in §3.0 already includes
  the 1.5× headroom. The camera never zooms in past 1.0 on world art (20 §2.2).

## 3. Recommended art pipeline

```
art/<ns>/**/*.kit.json   (kit entries: gen + params + seed, recipes, puppet recipes) ──┐
art/<ns>/**/*.hero.json + *.svg  (≤ 40 hero files per biome, puppets + *.anims.json) ─┤   scripts/build-art.ts  (pnpm art:build [--check] [--kit-only])
art/shared/characters/*.json + the Kenney zip  (recolour role maps)  ─────────────────┤     1 collect + merge fragments   2 generate kit SVG
src/game/art/palettes/<ns>.ts  (tokens)  ──────────────────────────────────────────────┘     3 resolve {{tokens}}   4 engrave   5 lint
                                                                                              6 anchors/pivots   7 minify + write   8 puppets
                                                                                              9 rig → PNG atlas   10 manifest + index
                                                                                              11 budgets + VRAM per zone   12 report
        ▼
public/assets/expedition/<ns>/<group>/<name>.svg (+ puppet sheets and .rest.svg) + manifest.json + License.txt
public/assets/expedition/shared/char/<id>.{png,json} (+ kenney/ fallback sheets)
src/world/asset-index/<ns>.generated.ts   (key → ns, kind, size, anchors, source, zone, poses?, anims?)
```

The step order is 20 §5.2's; the details of steps 2, 4, 8 and 9 are §3a.4, §3e, §3b.5 and §3b below.

### 3.0 Naming, pivots and rasterization (the one table: a verbatim copy of 20 §5.1)

This table is copied verbatim from `20-expedition-architecture.md` §5.1, which is authoritative (31 A2). If the two
ever differ, 20 wins and this copy is refreshed. The game docs use these keys. Section references inside the
table (§1.3, §4.3, §5.5, §5.7, §7.3) point at 20.

| Concern | Rule |
|---|---|
| Namespaces | `shared` (UI, fx, emblems, the character atlases), `orrery_terraces` (trig), `living_gate` (cell), `archive_of_voices` (civil). A PDF-generated game gets `gen_<gameId>` (02 §6). All are `Id`-legal. |
| Keys | `ns.group.name[.variant]`, lower snake case, matching `AssetKey` (§1.3). Frames inside one texture are frame names, not keys (`shared.char.wren` → frame `walk3`; a puppet's parts are part names). |
| Groups | `layer` (every parallax strip L1–L6; the depth lives in `ParallaxLayer.depth`, not in the key), `ground` (surface strips and undersides), `prop` (decor, landmarks, vehicles, hubs), `part` (contraption parts, §4.3), `costume` (rig overlays), `char` (`shared.char.<id>` atlases only), `companion` (guide puppets and portrait busts), `npc` (NPC puppets), `fx` (glows, sparks, puffs, motes, cones), `ui` (icons, emblem glyph sheets, the hex panel tile), `vista` (finale compositions), `doc` (document plates and plaques), `silhouette` (sensitive-kit figures; never a real person), `kit` (generic kit stand-ins such as the default zone preset). |
| Part keys | `<ns>.part.<skin>_<slot>` (§4.3), e.g. `orrery_terraces.part.ring_gate_outer_ring`. Accessory parts keep their own names (`archive_of_voices.part.lens_carriage`, `…part.record_rail`). |
| Character keys | `shared.char.<characterId>` (kind `atlas`, §5.5); overlays `<ns>.costume.<name>`; guide puppets `<ns>.companion.<name>`; NPC puppets `<ns>.npc.<name>` (kind `puppet`). |
| Sources | `art/<ns>/biome.json` (namespace settings: `paletteId`, `heroCap: 40`, zone ids; main-owned) plus **fragments**, each owned by one lane (§7.3): `art/<ns>/**/*.kit.json` (kit entries) and `art/<ns>/**/*.hero.json` (hero entries, with their SVGs beside them). `art/shared/characters/{bodies,characters}.json` for the rig. Generators in `src/game/art/kit/*.ts`; build code in `scripts/build-art.ts` + `scripts/art/*.ts`. Where a game doc says a kit fallback is "declared in `biome.json`", it lives in the matching `*.kit.json` fragment. |
| Fragment merge | A key appears in at most one `*.kit.json` and at most one `*.hero.json`. A hero entry needs a kit entry with the same key (its fallback, ladder step 1); the hero wins unless `--kit-only` is passed or the hero file fails lint (then the build warns and uses the kit entry). Any other duplicate fails the build. |
| Output | `public/assets/expedition/<ns>/<group>/<name>.svg` (a 4th key segment → `<name>.<variant>.svg`); puppets `<name>.svg` (the packed part sheet) + `<name>.rest.svg`; atlases `public/assets/expedition/shared/char/<id>.{png,json}` + the untinted Kenney fallback in `shared/char/kenney/`; `public/assets/expedition/<ns>/manifest.json` (`AssetManifest`, §1.3); `License.txt` (Kenney CC0 + OFL notices). |
| Asset index | `src/world/asset-index/<ns>.generated.ts` per namespace `{key → {ns, kind, width, height, anchors, source, zone, poses?, anims?}}` + a static `index.ts` that merges them (validators need no fs). |
| Generated files | Written only by `pnpm art:build`, which holds `.data/art-build.lock` while it writes. They are a pure function of all sources, so any lane may run the build; nobody edits them by hand. |
| Pivot | Fractions `[fx, fy]` of the design size: grounded art `[0.5, 1]` (the default), rotating parts at the hub (usually `[0.5, 0.5]`), tileable strips `[0, 1]`, ground strips `[0, 0]` (walk line y = 0). Authors write `data-pivot="fx,fy"` on the root `<svg>`; generators return it. px pivots are retired. |
| Anchors | Named points in design units: `<circle id="anchor-<name>" r="0">` in heroes, or returned by generators; exported to the manifest and stripped from the output. Rig anchors are per frame and computed (§5.5). |
| Design size | viewBox `0 0 w h` in world units: 1 unit = 1 px of the 1080-px view, 1 H = 170 (the rig figure is 168, ±1 %). |
| Raster factor | `k = ceil4(rasterScale × min(devicePixelRatio, 1.5))`, `ceil4(x) = ceil(4x) / 4`. The loader calls `load.svg(key, url, {width: round(w·k), height: round(h·k)})` and sets `setScale(1 / k)`; `{scale}` is never used. |
| `rasterScale` defaults | L1, L2, L5 layers 0.75; cloud bands and `fx` glows 0.5; L3, `ground`, `prop` 1.0; `part`s ≤ 500 units on the long side, costumes and puppets 1.5; larger `part`s 1.0; `ui` tiles are CSS backgrounds (no VRAM). Character atlases are PNGs at 2× the Kenney 1× cell (§5.5). |
| Low-power switch | `?lowres=1` caps `min(devicePixelRatio, 1.0)`; use it if the fps capture drops below 50. |
| Hero cap | ≤ **40** hand-authored hero files per biome namespace (`heroCount`; the build fails above). One file counts once (a ≤ 8-part puppet file included). The rig and its recolours are not heroes; costume overlays are. |
| Retired | `public/assets/variant/`, `public/assets/expedition/cell/`, `archive-city` (the hyphen fails the regex), `trig-canyon`, the `cr.*`, `cell.*`, `trig.*` and `A###` ids, the depth groups `sky`/`far`/`midfar`/`mid`/`fore`/`light`, `<ns>.char.*` overlay keys, `ringgate_*` spellings, px pivots, `{scale: devicePixelRatio}`, "rasterize props ×2", a root `art/kit/`, `art/fonts/engrave.ttf`, `biome.json` entry lists. A fragment entry may carry a `legacyId` (`"A76"`, `"cr.lamp.arc"`, `"#135"`) so the game docs' old lists stay traceable. |

Notes that stay here: the raster factor rounds **up** to the next 0.25 so textures are cacheable per step and puppet
frames land on integer pixels; `0.75` for L1/L2/L5 is safe because those layers are hazed or blurred; the rig figure
is 168 units for 1 H = 170 (±1 %), measured in §3b.1.

### 3a. Procedural SVG kit (primary source for everything that is not a hero)

**Why.** The three game docs list about 560 agent-authored SVGs, for a demo tomorrow (critique F1). Most of that
volume is repetition with variation: pillars, walls, arches, crystals, tree masses, skylines, clouds, stairs,
railings, rings, plates, chains, water and lipid rows. A generator per family gives unlimited seeded variants, one
consistent shading model, one lint surface, and a direct path to PDF-generated biomes (§6). Hand-authoring is kept
for **heroes**: the objects a player remembers (gates, bosses, landmarks, costume overlays, companions).

**Hero cap.** At most **40 hand-authored SVG files per biome** (`heroCap` in `biome.json`; 20 §5.1). `art:build`
counts distinct hero files in use and fails above the cap. One file = one count. A puppet or multi-part assembly
authored in one file (≤ 8 parts, ≤ 60 KB) counts once. The P0 counts are the game docs' §0 lists: **37 (trig),
36 (cell), 35 (civil)**; 20 §7.0 splits them between the content and contraption lanes. The rig and its recolours
are not heroes, but costume overlays are.

**Location.** The generators live in **`src/game/art/kit/*.ts`**, not a root `art/kit/`. There are two reasons:
`tsconfig.json`'s `include` and `vitest.config.ts` only cover `src/**`, `scripts/**` and `tests/**`, and the
same pure functions must also run in the server-side assembler for PDF games (§6). The `art/` root keeps only
*data*: hero SVGs, `biome.json`, the `*.kit.json` / `*.hero.json` fragments (20 §5.1), puppet `*.anims.json` files and
the rig role maps. Library-code rules apply: relative imports; no `fs`, no DOM, no `Math.random`, no `Date`.

#### 3a.1 Common contract

```ts
// src/game/art/kit/types.ts
import type { z } from "zod";

/** A palette token path such as "stone.lit". Emitted as {{stone.lit}}; resolved by art:build (or resolveTokens()). */
export type Tok = string;
/** Three-tone ramp for the upper-left key light (bible §5.3). */
export interface Ramp { lit: Tok; base: Tok; shade: Tok }
/** Finish defaults (critique F2), baked into every generator's output unless disabled. */
export interface Finish {
  ao: boolean;      // AO gradient at the base: {{shadow}} at 30 % → 0 over 0.12·h (default true)
  rim: boolean;     // a 1.5 px rim-light stroke on upper-left edges in the ramp's lit token (default true)
  haze: number;     // 0..1 lerp of every fill toward {{haze}} (default 0; L1 0.4, L2 0.2)
}
export interface EngraveReq { id: string; text: string; face: "caps" | "serif" | "serif_italic"; size: number;
  x: number; y: number; anchor: "start" | "middle" | "end"; fill: Tok; rotate: number }
export interface KitResult {
  svg: string;                               // <svg viewBox="0 0 w h" width=w height=h> with {{tokens}}, no <text> except data-engrave
  w: number; h: number;                      // design size, world px (1 H = 170)
  pivot: [number, number];                   // fractions
  anchors: Record<string, [number, number]>; // design px
  tileWidth: number | null;                  // non-null ⇒ left/right edges match exactly (seamless in X)
  engrave: EngraveReq[];                     // spec-independent labels only (§3e); empty for PDF games
}
export interface KitGenerator<P> {
  name: KitName;
  schema: z.ZodType<P>;                      // validates a fragment entry's params; later the base of writerConfigSchema (§6)
  defaults: P;                               // tokens default to bible §2 names; biome palettes remap them
  generate(params: P, seed: number): KitResult;
}
export type KitName =
  | "skyWash" | "cloudBand" | "ridgeBand" | "skyline" | "canopy" | "crystalCluster" | "column" | "arch"
  | "ringStack" | "brickWall" | "ashlarWall" | "stairs" | "railing" | "awning" | "facade" | "truss" | "shelving"
  | "waterBand" | "bilayerTile" | "lipidColonnade" | "molecule" | "groundStrip" | "plate" | "linkStrip" | "gauge"
  | "lectern" | "glowSprite" | "grainTile" | "hexGridPanel" | "compose" | "scatter";
```

**Names used by 20 revision 2, mapped onto these 31** (20 §5.4 carries the same table; every `K(...)` in 20 §4.3 and
the game docs uses the right-hand column):

| Revision-2 name | Generator |
|---|---|
| `mesaBand` | `ridgeBand` style `mesa` / `butte_fluted` |
| `canopyBlob` | `canopy` |
| `lipidRow` | `lipidColonnade` |
| `window` | `facade` (its `window` params) or `plate` |
| `glassTank` | the `compose` recipe `glass_tank` = `plate` slate frame + `bilayerTile` strip_vertical window + `waterBand` pool |
| `panelBox` | `plate` style `junction_box` (new style value) |
| `cabinet` | `shelving` style `filing_drawers` (new style value) |
| `latticeTruss` | `truss` shape `lattice_mast` |
| `pipe` | `linkStrip` style `pipe` |
| `consoleLectern` | `lectern` |
| `grain` / `vignette` | `grainTile` / the runtime Vignette filter (not a generator) |

**Recipes.** Named compositions live in `src/game/art/kit/recipes.ts` as pure functions `(args) → ComposeP` (or a
puppet recipe, §3b.5): `glass_tank`, and one default zone preset per biome (the stand-in any zone renders before its
own layer set lands). A fragment entry references one as `{recipe, args, seed}`.

- **Seed.** `seed = entry.seed ?? fnv1a32(entry.key)`, so it is stable when entries are reordered. The RNG is
  `mulberry32` in `kit/rng.ts` (with helpers `range`, `jitter`, `pick`, `shuffle`); there is no npm dependency.
  The same `(params, seed)` must give byte-identical output, and `art:build --check` relies on this.
- **Ids.** Every `<linearGradient>`, `<radialGradient>`, `<pattern>`, `<clipPath>` or `<filter>` id is prefixed
  `k<hash8(key)>_`, so that `compose` can merge children without collisions.
- **Tokens with alpha.** `ui.panel` and `ui.hex` are rgba. Token resolution writes `fill="#rrggbb"` plus
  `fill-opacity="a"` (or `stop-opacity`), never `rgba()` inside SVG paint.
- **Shading model (shared).** Lit faces face the upper left. Shadows are separate multiply shapes in `{{shadow}}` at
  30 %. There are at most 3 gradient stops per shape, `feGaussianBlur` is the only filter, and the darkest colour is
  `#2B3A44` (bible, 20 §5.3). Generators get this from `kit/shade.ts` helpers (`litFace`, `aoFoot`, `rimStroke`,
  `hazeMix`); they never hand-roll colour maths.

#### 3a.2 Generator signatures

Every generator is `KitGenerator<P>` with `P` below. Every field is required in the schema (defaults come from
`defaults`), which keeps it close to strict-mode shape for §6. Output viewBox, pivot and anchors are listed after
each.

```ts
// ── Sky and atmosphere ─────────────────────────────────────────────────────────────────────────────────────
interface SkyWashP { h: number; stops: Tok[] /* 3–4, top → horizon */; at: number[] /* stop offsets 0..1 */;
  dither: number /* 0..0.05, seeded 16×16 dot pattern, not a filter */ }
//  viewBox 0 0 64 h · pivot [0,0] · tileWidth 64 · the host stretches it in X (no 1920-wide gradient textures)
interface CloudBandP { w: number; h: number; style: "lozenge" | "puff" | "fog" | "swirl"; count: number;
  lobe: [number, number] /* radius range */; fill: Tok; under: Tok | null /* lavender underside */; alpha: number;
  blur: number /* 0..8 px */ }
//  viewBox 0 0 w h · pivot [0,0] · tileWidth w (fog: null, soft edges fade to 0 for masks)

// ── Far and mid silhouettes ────────────────────────────────────────────────────────────────────────────────
interface RidgeBandP { w: number; h: number; style: "butte_fluted" | "mesa" | "dome" | "bluff" | "cell_dome"
  | "chasm_edge"; peaks: number; height: [number, number]; flutes: number; ramp: Ramp;
  rimLine: Tok | null /* double membrane rim for cell_dome */; finish: Finish }
//  viewBox 0 0 w h · ground at y = h · pivot [0,1] · tileWidth w (chasm_edge: null; anchor "lip")
interface SkylineP { w: number; h: number; blocks: number; height: [number, number];
  features: Array<"steeple" | "water_tower" | "dome_cupola" | "setback_tower" | "obelisk" | "pine_line"
  | "aqueduct" | "capitol_dome">; fill: Tok; windowTok: Tok; windowDensity: number; finish: Finish }
//  viewBox 0 0 w h · pivot [0,1] · tileWidth w · anchors "feature_<i>" at each feature's top (beam targets, antenna ring)
interface CanopyP { w: number; h: number; style: "blob_tree" | "bush" | "bead_tree" | "magnolia" | "vine_drape"
  | "frond"; lobes: [number, number]; ramp: Ramp; trunk: Tok | null; finish: Finish }
//  viewBox 0 0 w h · pivot [0.5,1] (vine_drape [0.5,0]) · anchor "sway" (the host tweens ±2° in L5 only)
interface CrystalClusterP { w: number; h: number; form: "spire" | "cluster" | "fan" | "hanging_roots" | "stud";
  shards: number; lean: number /* deg */; ramp: Ramp /* crystal.hi/base/shade */; glow: Tok | null }
//  viewBox 0 0 w h · pivot [0.5,1] (hanging_roots [0.5,0]) · anchor "tip"

// ── Architecture ───────────────────────────────────────────────────────────────────────────────────────────
interface ColumnP { w: number; h: number; style: "stone" | "cast_iron" | "pole" | "lamp_post" | "pylon";
  flutes: 0 | 3 | 5 | 7; capital: "band" | "scroll" | "lotus" | "crossarm" | "none";
  base: "plinth" | "step" | "buried"; bands: number; broken: number /* 0..0.6 of the top missing */;
  socket: boolean; ramp: Ramp; trim: Tok; inlay: Tok; finish: Finish }
//  viewBox 0 0 w h · pivot [0.5,1] · anchors "top", "socket", "band_<i>"
interface ArchP { w: number; h: number; shape: "round" | "pointed" | "flat" | "arcade"; bays: number;
  thickness: number; keystone: boolean; recess: Tok | null /* dark doorway fill */; buried: number; ramp: Ramp;
  trim: Tok; finish: Finish }
//  viewBox 0 0 w h · pivot [0.5,1] · anchors "door" (recess bottom-centre), "keystone", "bay_<i>"
interface RingSpec { r: number; width: number; tok: Tok; edge: Tok | null;
  gaps: Array<[number, number]>;                                   // broken rings (emblems), degrees
  notches: Array<{ at: number; width: number; depth: number }>;    // the doorway notch at 6 o'clock
  studs: { n: number; r: number; tok: Tok } | null; teeth: { n: number; depth: number } | null;
  grooves: { n: number; tok: Tok } | null; spokes: { n: number; width: number } | null;
  wave: { cycles: number; amp: number; tok: Tok } | null;          // engraved sine band (Tidewheel ring)
  sockets: { n: number; r: number; tok: Tok } | null; ticks: { n: number; len: number; tok: Tok } | null;
  labels: Array<{ at: number; text: string; face: "caps" | "serif"; size: number }> } // spec-independent only
interface RingStackP { size: number; ellipse: number /* 1 = circle, < 1 = tilted */; rings: RingSpec[];
  hub: { r: number; ramp: Ramp } | null; cutout: { w: number; h: number; arch: boolean } | null;
  knurl: boolean }
//  viewBox 0 0 size round(size·ellipse) · pivot [0.5,0.5] · anchors "hub", "notch_<i>", "socket_<i>", "stud_<i>", "label_<i>"
interface MasonryP { w: number; h: number; unit: [number, number]; mortar: Tok; ramp: Ramp; jitter: number;
  rounded: number /* corner radius; > 0 gives the 10.png stacked-block cliff */;
  bands: Array<{ y: number; h: number; tok: Tok }>; cap: { h: number; tok: Tok } | null;
  medallions: { every: number; y: number; r: number } | null;
  openings: Array<{ x: number; y: number; w: number; h: number; arch: boolean }>; tileable: boolean; finish: Finish }
declare const brickWall: KitGenerator<MasonryP>;   // running bond, unit default [48, 20], brick tokens
declare const ashlarWall: KitGenerator<MasonryP>;  // random-course ashlar, unit default [120, 60], stone tokens
//  viewBox 0 0 w h · pivot [0.5,1] · tileWidth w when tileable · anchors "opening_<i>", "medallion_<i>"
interface StairsP { steps: number; rise: number; tread: number; depth: number;
  style: "stone" | "spoke_ledge" | "iron" | "marble_landing" | "ladder" | "carved_wet" | "stepped_plinth";
  dir: "up_right" | "up_left" | "straight"; nosing: Tok | null; cheekWalls: boolean; ramp: Ramp; finish: Finish }
//  viewBox 0 0 steps·tread steps·rise+0.4·depth · pivot [0,1] · anchors "step_<i>" (tread top-centre; traversal links read these)
interface RailingP { w: number; h: number; style: "balustrade" | "wrought_iron" | "brass_rail" | "rope_stanchion"
  | "navy_cap_wave"; spacing: number; posts: { every: number; emblem: boolean } | null; wet: boolean; ramp: Ramp;
  cap: Tok }
//  viewBox 0 0 w h · pivot [0.5,1] · tileWidth w
interface AwningP { w: number; drop: number; stripes: [Tok, Tok]; stripeW: number;
  valance: "scallop" | "straight" | "wave"; frame: Tok; sag: number }
//  viewBox 0 0 w drop+16 · pivot [0.5,0] · anchor "sway"
interface FacadeP { w: number; h: number; style: "brick_row" | "commercial" | "storefront" | "moderne"
  | "collegiate" | "hall_ring_windows" | "kiosk"; floors: number; bays: number; ramp: Ramp; trim: Tok;
  window: { w: number; h: number; tok: Tok; arch: boolean }; door: { bay: number; recessed: boolean } | null;
  awning: AwningP | null; fireEscape: boolean; sign: { text: string; tok: Tok } | null /* wordmarks, §3e */;
  finish: Finish }
//  viewBox 0 0 w h · pivot [0.5,1] · anchors "door", "window_<floor>_<bay>" (window glows are fx sprites on these)
interface TrussP { w: number; h: number; shape: "through_arch" | "lattice_mast" | "gantry" | "cage"; bays: number;
  member: number; tok: Tok; edge: Tok; rivets: boolean; platforms: number[]; deckGaps: Array<{ x: number; w: number }> }
//  viewBox 0 0 w h · pivot [0.5,1] · anchors "top", "platform_<i>", "gap_<i>"
interface ShelvingP { w: number; h: number; style: "compact_stack" | "bookcase" | "type_case" | "rack_bays"
  | "cork_frames" | "filing_drawers" /* civil filing cabinets: stacked drawers, handles, anchor "drawer_<i>" */;
  shelves: number; bays: number; fill: Array<"box" | "film_can" | "book" | "cartridge"
  | "frame" | "empty">; endPanel: Tok | null; crank: boolean; ramp: Ramp; finish: Finish }
//  viewBox 0 0 w h · pivot [0.5,1] · anchors "bay_<i>", "crank"

// ── Water, cells, molecules ────────────────────────────────────────────────────────────────────────────────
interface WaterBandP { w: number; h: number; style: "canal" | "falls" | "flood" | "pool" | "tide" | "trench";
  deep: Tok; shallow: Tok; highlight: Tok; flecks: { tok: Tok; count: number } | null;
  debris: "paper" | "none"; waveAmp: number; waveCycles: number /* integer, so the tile wraps */ }
//  viewBox 0 0 w h · pivot [0,0] · tileWidth w (falls: tileable in Y) · emits two keys "<key>.a" / "<key>.b" for offset UV scroll
interface BilayerTileP { w: number /* multiple of pitch */; headR: number; pitch: number; tailLen: number;
  variant: "fluid" | "gel" | "hall_deck" | "ceiling" | "ring" | "strip_vertical"; ringR: number;
  gaps: number[] /* head indices removed (tank windows) */;
  tokens: { head: Tok; headLit: Tok; headShade: Tok; tail: Tok; core: Tok; frost: Tok; inlay: Tok; stud: Tok } }
//  viewBox 0 0 w 2·(2·headR+tailLen) · pivot [0,0] (ring: square, [0.5,0.5]) · tileWidth w · anchor "surface" (walk line)
interface LipidColonnadeP { w: number; h: number; swell: number /* 0 flat .. 1 hill */; rows: 1 | 2;
  saplings: number; scale: number /* 0.6 on L3 */; tokens: BilayerTileP["tokens"] & { sapling: Tok } }
//  viewBox 0 0 w h · pivot [0,1] · tileWidth w
interface MoleculeP { shape: "spheres" | "hex_ring" | "fused_rings" | "drop" | "cube" | "dot" | "cell";
  atoms: Array<{ dx: number; dy: number; r: number; tok: Tok }>; charge: "+" | "−" | null /* drawn as paths */;
  outline: Tok | null; lit: boolean; cell: { wall: Tok | null; fill: Tok; nucleus: Tok | null } | null }
//  viewBox fits the atoms + 2 px · pivot [0.5,0.5]

// ── Ground, plates, linear parts, gauges, consoles ─────────────────────────────────────────────────────────
interface GroundStripP { w: number; h: number; style: "polygon_paving" | "sidewalk" | "brick_plaza" | "marble"
  | "wood_floor" | "grate" | "causeway" | "sand" | "ledge_cap"; ramp: Ramp; lip: Tok | null;
  grassEdge: Ramp | null; wet: boolean }
//  viewBox 0 0 w h · walk line at y = 0 · pivot [0,0] · tileWidth w
interface PlateP { w: number; h: number; style: "brass_plaque" | "slate" | "paper_card" | "slide_mat" | "flip_cell"
  | "cartridge" | "raft" | "sign_blade" | "front_page" | "slab"
  | "junction_box" /* civil relay_line: a riveted box; screen: true draws its lamp */; bevel: number; rivets: 0 | 2 | 4;
  screen: boolean /* ui.card face with a cyan edge */; ramp: Ramp; face: Tok;
  engraved: { text: string; face: "caps" | "serif"; size: number } | null /* fixed wordmark only, §3e */ }
//  viewBox 0 0 w h · pivot [0.5,0.5] · anchor "label" (the DOM text box centre; WorldLabelLayer pins text here)
interface LinkStripP { len: number; axis: "x" | "y"; style: "chain" | "cable" | "pipe" | "tube_window" | "rail"
  | "ladder" | "microtubule" | "rod"; thick: number; bandEvery: number | null; band: Tok | null; ramp: Ramp }
//  viewBox along axis = len (tileable along axis) · pivot [0.5,0] (x axis: [0,0.5])
interface GaugeP { kind: "ruler_v" | "ruler_h" | "arc_meter" | "height_rod"; len: number;
  ticks: Array<{ at: number /* 0..1 */; major: boolean; label: string | null }>; ramp: Ramp; tickTok: Tok;
  backing: Tok | null; legend: string | null /* e.g. "SIGNAL" */ }
//  viewBox fits · pivot per kind · anchors "t_<i>" · arc_meter also emits "<key>.needle" (pivot [0.5,1])
interface LecternP { h: number; style: "lectern" | "kiosk" | "transit" | "microfilm"; ramp: Ramp; trim: Tok;
  screen: Tok; emblem: boolean }
//  viewBox 0 0 0.9·h h · pivot [0.5,1] · anchors "console" (interact point), "screen"

// ── FX, texture, UI ────────────────────────────────────────────────────────────────────────────────────────
interface GlowSpriteP { size: number; shape: "radial" | "shaft" | "spark4" | "puff" | "mote" | "ring_pop"
  | "cone"; core: Tok; edge: Tok; falloff: number; frames: number /* > 1 ⇒ horizontal sheet */ }
//  viewBox 0 0 size·frames size · pivot [0.5,0.5] (shaft/cone [0.5,0]) · the runtime ADD-blends everything except puff
interface GrainTileP { size: 128 | 256 | 512; style: "grain" | "dither" | "caustics" | "scanlines"
  | "leaf_dapple" | "blinds"; density: number; tok: Tok }
//  viewBox 0 0 size size · tileable in X and Y
interface HexGridPanelP { cell: number /* hex edge, default 18 */; cols: number /* even */; rows: number;
  stroke: Tok /* ui.hex */; strokeW: number; wash: { from: Tok; to: Tok; angle: number } | null }
//  viewBox 0 0 1.5·cell·cols √3·cell·rows · tileable in X and Y · written to shared/ui/ and used as a CSS background

// ── Composition (how parallax strips are built) ────────────────────────────────────────────────────────────
interface ComposeItem { gen: KitName; params: unknown; seed: number | null; x: number; y: number; scale: number;
  flip: boolean; alpha: number }
interface ComposeP { w: number; h: number; tileWidth: number | null; items: ComposeItem[]; finish: Finish }
interface ScatterP { w: number; h: number; tileWidth: number; item: { gen: KitName; params: unknown };
  count: number; variants: number /* distinct seeds */; band: [number, number] /* y of bases */;
  minGap: number; scale: [number, number]; flipChance: number; finish: Finish }
//  both: viewBox 0 0 w h · pivot [0,1]. An item crossing x = tileWidth is duplicated at x − tileWidth so the strip wraps.
//  Children's ids are re-prefixed. Their anchors are re-exported as "<i>.<anchor>".
```

#### 3a.3 Coverage map (which generator makes which asset family)

| Generator | Default tokens (bible §2; remapped per biome palette) | Trig uses | Cell uses | Civil uses |
|---|---|---|---|---|
| `skyWash` + `cloudBand` | zone sky stops (bible §2.2), `stone.lit` clouds | A01–A07 skies, fog A84, mist A110 | sky ×6, fluid swirls, bubbles #40 | Z1–Z5 skies, rain-cloud band |
| `ridgeBand` | `rock.*` | mesas A08–A10, chasm edges A106/A107, cliff edges A32/A33 | tissue domes #7, tide cliffs #8 | river bluffs (Selma) |
| `skyline` | `inlay.navy.dark` + haze | — | — | L1 city, Courier-Ledger setback tower (anchor → antenna ring), Washington obelisk and capitol |
| `canopy` | `foliage.*` | canopies A15/A16, vines on A23, L5 leaf clumps | glycan forest #13 (`bead_tree`), fronds #39 | oaks, magnolias, `cr.fg.magnolia` |
| `crystalCluster` | `crystal.*` | field A14, cliff crystals, roots A112, lens A83 (with a ring) | cholesterol studs #21–23 | — |
| `column` | `stone.*`, `gold.base`, `inlay.navy` | pillar parts A34, beam pylon A35, anchor pylon A115, pendulum pylon A127, colonnade A23 | hall pillars #15, balance pillar #89, lift frame #138 | courthouse and memorial columns, telegraph pole, lamp posts, bay lamps, walk lamps |
| `arch` | `stone.*` | aqueduct A13, ruins A17, doorway recesses | door niches | school door arch, terminal openings |
| `ringStack` | `gold.*`, `bronze.ring`, `inlay.navy` | orrery rings A12, rail A77, outer ring A86, inner disc A87, tally A90, socket A113, keystone A119, bob A130, gear platform A133, Cog emblem | gate rings #81/#82, oil-road plate #85, valve wheel #100, drum #128, sockets #129/#130, stage lamp #139, pore rings #149–#151, eye-rings #143/#144, emblems #193/#194, porthole frame #181 | Engine rings, lens, crank, clock face, selector plate/knob, handwheel, tumbler, vault socket, voice grille, rose window, relay dish, the Reel and Editor emblems |
| `brickWall` / `ashlarWall` | brick / `stone.*` | terrace wall A21, cliff walls A19/A20 (`rounded`) | basin walls #24, vault court #28 | rowhouses, schoolhouse brick, church brick, interior back walls |
| `stairs` | `stone.*` | spoke-ledges A79, step block A31, Warden plinth A126 | sluice steps #104, side stair #105 | basement iron stair, courthouse and memorial steps, rolling ladder, Engine plinth |
| `railing` | `stone.lit` + `inlay.navy` | L5 balustrade, gantry rails | hall balustrade #41 | wet iron railing, stanchions, divider rail |
| `awning` + `facade` | per biome | — | Pump Hall ring windows (P1 variant) | storefront rows, dimestore, newsstand, bus shelter, kiosks |
| `truss` | `bronze.ring`, steel | gantry truss A25 | gantry rail #124 | Selma through-arch bridge, broadcast mast, lift cage, canopy rail |
| `shelving` | wood / brass | plank cradle A114 | cartridge rack #133 | stack units, type cases, front-pages wall (`cork_frames`) |
| `waterBand` | `water.*` | canal A29, waterfalls A18/A24 | tide falls #25, trench #36, holding basin #102 | flood band, reflecting pool |
| `bilayerTile` + `lipidColonnade` | cell `lipid.*` | — | ground #29/#32/#35/#38, heads #30/#31, tank window #88, test-cell ring #94, vesicle #140, colonnade rise #20, bin cards | — |
| `molecule` | cell ion tokens | — | molecules #49–#60, cell sprites (P1 upgrade of hero #15) | — |
| `groundStrip` | `stone.*`, `sand.path`, `grass.*` | paving A26, grass edge A27, sand A28, ledge cap A30, gantry walkway A132 | causeway #37 | sidewalk, brick plaza, marble, Morgue wood floor |
| `plate` | `gold.*` / `ui.card` | slate A99, claim plaque A100, period plaque A134 | pod pedestal plate, basin plaque #101, cartridge #132, raft #97 | courthouse plaque, slide frame, walk slab, bridge plank, flip cell, program sheet, provision slip, front page, photo-withheld plate |
| `linkStrip` | `bronze.ring`, `gold.*` | chain A105, cable A111, ladder A135, pendulum arm A129 | chain #92, ATP pipe #117, microtubule #141 | record rail, tube segment, pneumatic drop, floor rail |
| `gauge` | `gold.*`, `inlay.navy` | plumb and slide rulers A80/A82 | Gradient bar frame #204 | signal meter + needle |
| `lectern` | `stone.*`, `ui.card` | the six seal consoles | console #66, kiosk #67 | (the civil console is a hero: `console_reader`) |
| `glowSprite` | `crystal.hi`, `gold.hi`, white | light shaft A93, splash A94, visor glow A122, god rays | lantern pool #46, motes #48, ATP spark #61, glows #62, pops #63, sparkles #64, puffs #65 | lamp glow, projector cone, beam glow, spark, puff, steam, window glows |
| `grainTile` | `ui.line` / white | sky dither, leaf dapple | caustics #44 | film grain, blinds shadow, scanlines |
| `hexGridPanel` | `ui.hex`, `ui.panel` → `ui.panel.hi` | panel chrome (shared) | shared | shared |
| `compose` / `scatter` | — | every L1–L5 strip, finale vista | every L1–L5 strip | every L1–L5 strip, the dawn-skyline vista |

#### 3a.4 How `art:build` emits kit SVGs

1. **Declare.** Entries live in per-owner **fragments** (20 §5.1): `art/<ns>/zones/<zoneId>.kit.json`,
   `art/<ns>/parts/<skin>/parts.kit.json`, `art/<ns>/{landmarks,cast}/*.kit.json` and the matching `*.hero.json`
   files, each parsed with the zod `ArtFragment` schema (20 §5.2 step 1). `art/<ns>/biome.json` keeps only the
   namespace settings (`paletteId`, `heroCap: 40`, zone ids). Every hero key also has a kit entry, its automatic
   fallback. An entry in `art/orrery_terraces/zones/z1_sunward.kit.json`:
   ```jsonc
   { "key": "orrery_terraces.layer.mesa_z1", "kind": "svg", "gen": "ridgeBand", "seed": null, "zone": "z1_sunward",
     "rasterScale": 0.75, "scroll": 0.15, "legacyId": "A08",
     "params": { "w": 2048, "h": 620, "style": "butte_fluted", "peaks": 5, "height": [360, 560], "flutes": 6,
                 "ramp": { "lit": "rock.light", "base": "rock.base", "shade": "rock.shade" },
                 "rimLine": null, "finish": { "ao": false, "rim": true, "haze": 0.4 } } }
   ```
2. **Generate.** `KIT[gen].schema.parse(params)` then `KIT[gen].generate(params, seed)`. An unknown `gen` or a
   schema error fails the build and names the key.
3. **Resolve tokens** from `src/game/art/palettes/<ns>.ts`, exactly as for heroes. An unknown token fails the build.
4. **Engrave** the `engrave[]` requests (§3e).
5. **Lint** with the same rules as heroes (20 §5.3): no `<text>` left, no `<image>`, no external `href`, no
   `<style>`/`class`/`<script>`, only `feGaussianBlur`, ≤ 60 KB (≤ 120 KB for layers). A generator that
   produces an over-budget file is a generator bug, and the build prints the params.
6. **Minify**: collapse whitespace and round to 1 decimal.
7. **Write** `public/assets/expedition/<ns>/<group>/<name>.svg`.
8. **Record** an `svg` entry of 20 §1.3's `ManifestEntry`: `source: "kit:<gen>"`, `seed`, `sha1`, `width`,
   `height`, `pivot`, `anchors`, `tileWidth`, `rasterScale`, `scroll`, `zone`, `legacyId`.
9. **Budgets and `--check`.** It counts hero files against `heroCap`, sums raw and gzip bytes, and computes VRAM per
   zone (`all` + that zone) and per adjacent zone pair at dpr 1.5 (§3f, 20 §5.8). It fails over budget. `--check`
   regenerates in memory and byte-compares, like `fixtures:build`; `--kit-only` builds every hero key from its kit
   entry. The whole build holds `.data/art-build.lock` while it writes, so any lane may run it.
10. **Review.** `scripts/art-contact-sheet.ts` (20 §5.3) renders every kit entry and **3 extra seeds per entry**, so
    the fidelity critic can pick a seed instead of asking for a redraw.

**Tests** (`tests/art-kit.test.ts`):
- every generator × 3 seeds gives well-formed XML (`fast-xml-parser@5.11.1`, MIT, verified), passes lint and
  stays inside its viewBox;
- `tileWidth` outputs have matching left and right edge columns (sampled path crossings at x = 0 and x = w);
- determinism: calling twice gives the same bytes;
- the `kit/` sources contain no `Math.random` or `Date`;
- anchors lie inside the viewBox.

**Finish stack** (critique F2; locked on the trig S1–S2 vertical slice before scaling):
- baked by generators: AO at bases, rim light, haze on L1/L2;
- shared overlays: `grainTile` grain at 6 % multiply on L1–L3, and leaf dapple;
- runtime: Phaser Blur on L1/L2/L5, a ColorMatrix grade per zone, ADD glow sprites, and the Vignette filter.

### 3b. One human rig (Kenney toon bodies, recoloured from vector, rendered to a PNG atlas) and the puppets

**Decision.** Every human character is **one rig**: `toon-characters` → `Female adventurer`, rendered from its
**vector source** after a build-time recolour, not from the PNGs. There are two reasons:
- `setTint` multiplies the whole sprite, so it cannot give Wren `#A8714F` skin with `#2B2A33` hair and a navy vest;
- the vector file contains the rig itself, so costume anchors can be *computed*, not hand-authored.

So Wren (trig), the Diver (cell) and Nell (civil) are **one rig in three costumes**, and "shared protagonist"
(bible §6.3) stays literally true. Ida and the other human NPCs use the same pipeline on the `Female person` /
`Male person` bodies (§3b.6). Wren's 18-part puppet (trig §3.1, A137–A154) is post-demo.

**One raster path (31 A3, 20 §5.5).** The recoloured, repacked vector is rendered to a **PNG atlas** per character,
keyed `shared.char.<id>` (manifest kind `atlas`, 20 §1.3), with per-frame anchors computed from the vector (§3b.3) and
named with 20's `RigAnchor`s. Kenney's untinted `_sheetHD.png` + `_sheetHD.xml` (loaded with `load.atlasXML`) is the
fallback. The SVG rig sheet that an earlier revision of this section loaded with `load.svg` is superseded.

#### 3b.1 Verified source files (`.data/asset-scratch/toon-characters.zip`)

| File | Facts (checked 2026-09-26) |
|---|---|
| `Female adventurer/Vector/character_femaleAdventurer.svg` | 182,783 bytes, `viewBox="0 0 864 640"` = the **1× sheet** (9 cols × 96, 5 rows × 128). `<defs>` holds the part symbols (`head_*`, `headFocus_*`, `headShock_*`, `headBack_*`, `Symbol_1_*` (hair behind), `body_*`, `bodyBack_*`, `arm_*`, `hand_*`, `leg_*`, `legBend_*`, `shadow_*`). All poses are drawn by 1,120 `<use>` instances inside `<g filter="url(#Filter_1)"><g id="poses">`. 11 flat fills + 1 radial-gradient contact shadow. |
| `Female adventurer/Tilesheet/character_femaleAdventurer_sheet.xml` | 45 `SubTexture`s at 96×128, whose coordinates match the vector's viewBox exactly (so the build slices the vector with it) |
| `…/character_femaleAdventurer_sheetHD.xml` + `_sheetHD.png` | the same 45 frames at 192×256; the sheet is 1728×1280, 243,938 bytes, 8-bit colormap. Exactly 2× the 1× XML. |
| `Female adventurer/PNG/Poses HD/character_femaleAdventurer_<pose>.png` | 45 files, 192×256, 5.6–8.3 KB each. **The fidelity reference and the P0 emergency fallback** (load with `load.atlasXML` from `_sheetHD.png` + `_sheetHD.xml`, untinted, if the recolour misbehaves on the demo machine) |
| `License.txt` | CC0; copied beside every output |

**The 45 pose names** (the same in `Poses/`, `Poses HD/` and both XMLs):
- locomotion: `idle`, `walk0`–`walk7`, `run0`–`run2`, `jump`, `fall`, `fallDown`, `duck`, `slide`;
- climbing and hanging: `climb0`, `climb1`, `hang`, `rope`;
- interaction: `interact`, `switch0`, `switch1`, `talk`, `think`, `show`, `hold`, `drag`, `shove`, `shoveBack`;
- facing and emotes: `side`, `back`, `behindBack`, `wide`, `cheer0`, `cheer1`;
- damage and combat: `hit`, `hurt`, `down`, `attack0`–`attack2`, `attackKick`, `kick`.

**The 28 frames we ship** (7 cols × 4 rows): `idle, walk0–walk7, run0–run2, jump, fall, duck, hang, climb0, climb1,
interact, switch0, switch1, talk, think, show, hold, cheer0, cheer1, back`. This covers:
- cell's `switch` hold, `duck` crouch-walk and `fall`;
- civil's `show` (holding up a document) and the `back` "respect" beat;
- climb links via `hang` and the `climb` frames;
- trig's `ride` (= `idle` locked to a platform).

There are no damage or combat frames, because failure belongs to the machine and never the player. NPC atlases ship
12 frames (§3b.6).

#### 3b.2 Recolour: a group-scoped fill map (verified by rendering)

The same hex means different things in different part groups. `#BF7958` is hair in `head_*_Layer0_1`, but eye/brow
ink in `head_*_MEMBER_3*` and the satchel strap in `body_*_1/2/4`. So the map is keyed by
**(symbol-group pattern, source hex) → role**, and a costume maps roles → tokens. The table below was produced by
walking every `<g id="…_FILL">` in `<defs>`, and then confirmed by rendering the recoloured sheet (a Wren
costume) with `@resvg/resvg-js` next to Kenney's own `sheetHD.png`.

| Symbol group (`<defs>` id pattern) | Source fill | Role |
|---|---|---|
| `head*_Layer0_0_MEMBER_{0,1,2}`, `headBack_*_{0,1,2}`, `hand_*` | `#FFD7B1` / `#E7B687` | `skin` / `skinShade` |
| `head*_Layer0_0_MEMBER_3*` (eyes, brows, mouth) | `#BF7958` / `#FFFFFF` / `#E7B687` | `ink` / `eyeWhite` / `skinShade` |
| `head*_Layer0_1`, `Symbol_1_*`, `headBack_*_3` | `#BF7958` / `#DB855C` | `hair` / `hairHi` |
| `head*_Layer0_2` | `#71A2BE` | `band` (headband; costume sets it = `hair` to remove it) |
| `body_*_0`, `bodyBack_*_2` | `#79ADCB` / `#69A1C2` / `#5A93B4` | `top` / `topMid` / `topShade` |
| `body_*_0`, `bodyBack_*_2`, `leg*_*` | `#EEA160` | `bottom` |
| `body_*_{1,2,4}` | `#BF7958` | `strap` (satchel strap, belt) |
| `body_*_3`, `bodyBack_*_1`, `hand_*` | `#F0C49A` | `skinShade` (neck, palm) |
| `bodyBack_*_{0,3,4}` | `#BF7958` | `hair` (long hair seen from behind). The probe mapped all three to hair and the back view read correctly; confirm on the contact sheet whether `_3`/`_4` is actually the strap. |
| `arm_*_0` / `arm_*_1` | `#79ADCB` + `#FFD7B1` / `#5A93B4` | `sleeve` + `skin` / `sleeveShade` |
| `leg*_*` | `#FFD7B1` / `#BF7958` | `sock` / `boots` |
| `shadow_*` | radial `#000` 30 % → 0 | kept (contact shadow) |

**Build steps** (`scripts/art/rig.ts`, about 250 lines, called by `art:build --ns shared`; 20 §5.2 step 9):
1. Read the vector from the zip (`unzip -p`; no extraction into the repo).
2. **Strip `filter="url(#Filter_1)"`** from the pose group. Verified: resvg renders it as a dark offset artefact
   on every limb, the stripped render matches Kenney's own `sheetHD.png`, and 20 §5.3 bans non-blur filters anyway.
3. Rewrite fills inside each `<defs>` group per the map, as `{{char.<id>.<role>}}` tokens, then resolve them
   from the character's game palette (`src/game/art/palettes/<ns>.ts`).
4. **Repack** the used frames (28 for a protagonist, 12 for an NPC) without re-drawing anything:
   - move `<g id="poses">` into `<defs>` as `#rig_all`;
   - emit one nested `<svg x y width="96" height="128" viewBox="<frame rect from _sheet.xml>"><use href="#rig_all"/></svg>`
     per frame (nested viewports clip to the frame).

   Verified: 28 frames give 167,730 bytes raw and **11,797 bytes gzip**, and render correctly.
5. **Compute per-frame anchors** (§3b.3).
6. **Render** the repacked sheet to PNG in Playwright's Chromium (already a devDependency) at
   `deviceScaleFactor: 2` over the 1× vector: 192 × 256 texels per frame, **1344 × 1024 for a 28-frame protagonist
   (5.5 MB VRAM)** and 1152 × 512 for a 12-frame NPC (2.4 MB). Write `public/assets/expedition/shared/char/<id>.png`
   plus the Phaser JSON hash `<id>.json` (frame names = pose names), and the manifest `atlas` entry (20 §1.3):
   `frameWidth: 192`, `frameHeight: 256`, `displayWidth: 168`, `displayHeight: 224` (1× frame × 1.75, so the 96 px
   figure is **168 units = 1 H**), `pivot: [0.5, 1]` (the feet touch y = 127/128 in every measured frame), the
   computed anchors per pose, and the fallback.
7. At runtime, `load.atlas(key, png, json)`; a sprite shows a frame at scale 0.875 (192 texels → 168 units).

**Fallback:** Kenney's untinted `character_<body>_sheetHD.png` + `_sheetHD.xml` (§3b.1), copied to
`public/assets/expedition/shared/char/kenney/` with the pose → XML SubTexture name map, loaded with `load.atlasXML`
when `?charfallback=1` is set or the atlas fails to load (a `console.warn`). `@resvg/resvg-js@2.6.2` (MPL-2.0; a
prebuilt darwin-arm64 binary installed and ran here) stays an optional devDependency for fast contact sheets only;
measured 294 KB at zoom 2 for the 28 frames, which matches the Chromium render.

**Style note.** The toon frames are three-quarter front poses with flat cel shading, not strict profiles. Keep
the backgrounds soft and painterly behind the crisper figure. This is the usual Hollow Knight / Ori layering, and
the recolour to biome tokens removes most of the "clip-art pasted on a painting" read.

#### 3b.3 Per-frame costume anchors (computed, not authored)

`rig.ts` walks the pose tree with a transform stack, composing every `matrix(…)` down to each `<use>`. It assigns
each instance to a frame cell (`floor(e/96)`, `floor(f/128)`) and records:

| Anchor | From | Meaning |
|---|---|---|
| `head [x, y, rot]` | the one `head` / `headFocus` / `headShock` / `headBack` instance | the symbol origin, which is the neck/jaw point (in `idle` the figure top is y 32 and the head origin y 74.2) |
| `torso [x, y, rot]` | the one `body` / `bodyBack` instance | the waist (y 102 in `idle`; the feet are at 127) |
| `handF`, `handB [x, y, rot]` | the two `hand` instances; **`handF` = the one painted later** | staff, lantern and held documents |
| `facing` | `front` if the frame uses `head*`/`body`; `back` if it uses `headBack`/`bodyBack` | overlay z-order (`zFront` / `zBack`) |

Verified on all 45 frames: each has exactly one head-family instance, one torso instance and two hands, except
`behindBack` (0 hands; not shipped). Sample values in 1× frame px (rot in degrees; the build multiplies by 1.75):

| Frame | head | torso | hand A / hand B (document order) |
|---|---|---|---|
| `idle` | 49.9, 74.2, 0 | 48.0, 102.0, 0 | 74.3, 107.9, 0 / 21.6, 107.9, 180 |
| `walk0` | 50.0, 72.8, 0 | 48.0, 100.3, −5 | 71.4, 95.4, −31 / 19.0, 94.3, −134 |
| `jump` | 49.3, 69.7, −7 (`headFocus`) | 48.0, 97.0, 0 | 79.7, 66.5, 30 / 15.8, 93.0, −172 |
| `interact` | 48.8, 75.2, 4 (`headFocus`) | 48.0, 102.1, 0 | 82.1, 89.8, 90 / 19.2, 102.9, −156 |
| `climb0` | 46.5, 75.0, 3 (`headBack`) | 44.9, 98.0, −6 (`bodyBack`) | 72.1, 59.4, 15 / 20.9, 75.7, 149 |

**Mapping onto 20's `RigAnchor`** (the names the world JSON and the game docs use; 20 §5.5). Offsets are in 1× frame
px in the instance's local frame; the build multiplies every value by 1.75 into display units:

| `RigAnchor` | From the walk | rot |
|---|---|---|
| `head` | the head-family instance origin | its rotation |
| `face` | `head` + R(rot)·(0, −20) (the eye line) | head rot |
| `torso` | the `body` / `bodyBack` instance origin | its rotation |
| `back` | `torso` + R(rot)·(0, −18) (between the shoulders) | torso rot |
| `hand_r` | **`handF`** (the hand painted later, in front) | its rotation |
| `hand_l` | **`handB`** (the other hand) | its rotation |
| `feet` | (torso x, 127) | 0 |

Each frame also records `facing`. The two offsets live in `ANCHOR_OFFSETS` in `scripts/art/rig.ts`; the contact sheet
draws the seven anchors on every frame.

- **Overlay rule.** A costume overlay is a hero SVG (`<ns>.costume.<name>`) authored at rot 0 against a reference
  frame, carrying only its `data-pivot="fx,fy"`. The world JSON attaches it (20 §1.3 `CharacterLook.costume`:
  `anchor`, `dx`, `dy` in the anchor's local frame, `follow`, `layer`, `hideOn`); the `data-attach`, `data-offset`,
  `data-z` and `data-hide` attributes of the previous revision are retired. Each frame the runtime sets
  `overlay.pos = anchor.xy + R(anchor.rot)·offset` and `overlay.angle = anchor.rot`; a back-facing frame swaps
  `front` and `behind`.
- **Facing left.** `flipX` mirrors both: `x → frameW − x`, `rot → −rot`.
- **Facing left** uses the display frame width, 168 units.
- **Scarf tails** (`follow: "spring"`) are a 3-segment spring chain rooted at the overlay's anchor (usually `back`;
  runtime code, not art).

#### 3b.4 Costumes: three games, one rig

The role → token values below are **proposals**. Each becomes a `char.<id>.<role>` token in `palettes/<ns>.ts` of the
character's game. The Wren row was rendered in the probe.

| Role | Wren (`shared.char.wren`) | Diver (`shared.char.diver`) | Nell (`shared.char.nell`) | Ida (`shared.char.ida`, female_person, P0 NPC) |
|---|---|---|---|---|
| `skin` / `skinShade` | `#A8714F` / `#8A5A3E` (trig §3.1) | `#C68B5E` / `#A06E48` | `#E3B38A` / `#C4946C` | `#6B4330` / `#553423` ("deep brown", civil §3.2) |
| `hair` / `hairHi` / `ink` | `#2B2A33` / `#3A3945` / `#2B2A33` | `#3A2A24` / `#5A3E32` / `#2B2A33` | `#6E4A2E` / `#8A5A3E` / `#2B2A33` | `#C9C9D1` / `#E4E4EA` / `#2B2A33` (the ink stays dark because the scoping keeps it separate) |
| `band` | = `hair` (removed) | = `hair` (the helmet covers it) | = `hair` | = `hair` |
| `top` / `topMid` / `topShade` | vest `inlay.navy` / `#22405F` / `inlay.navy.dark` | suit `stone.base` / `#E6D5B5` / `stone.shade` | mustard cardigan `#C9A13B` / `#B8912F` / `#A8842C` | teal cardigan `#2F6F73` / `#2A6468` / `#225457` |
| `sleeve` / `sleeveShade` | cream tunic `stone.base` / `stone.shade` | `stone.base` / `stone.shade` | `#C9A13B` / `#A8842C` | `#2F6F73` / `#225457` |
| `bottom` / `sock` / `boots` / `strap` | `#2F5A5E` / `#2F5A5E` / `#C69A6B` / `#8A5A3E` | `inlay.navy` / `inlay.navy` / `bronze.ring` / `gold.deep` | `inlay.navy` / `stone.base` (rolled cuff) / `#3F5857` (rubber) / `#8A5A3E` | `#3E3F74` / `#3E3F74` / `#3F3A44` / = `top` |
| Overlays (`<ns>.costume.*` hero SVGs; `RigAnchor`) | `wren_hair_bun` + gold pin (head), `wren_scarf` knot and 2 tails (back, spring, behind), `wren_staff` with astrolabe ring (hand_r), `wren_satchel` (back) | `diver_helmet` bubble 88 px (head), `diver_scarf` segment ×3 (back, spring), `probe_staff` with bulb (hand_r) | `nell_satchel` (torso), `nell_scarf` salmon (back, spring, behind) | `ida_bun_glasses` (head), `ida_cardigan` (torso); holds Wick (hand_l) in the outro |

#### 3b.5 Puppets (guides, creature and machine NPCs, animated hubs; ≤ 8 parts)

A puppet is **one hand-authored SVG, assembled in its rest pose** (easy for an agent to reason about). Each part is
a `<g id="part-<name>" data-pivot="x,y" data-box="x y w h" data-z="n">`, with pivot and box in absolute viewBox px.
A multi-frame part holds `<g id="f0">…<g id="fN">`. A hub that mixes kit parts with hero files (the civil Record
Engine: the drum and crown heroes plus kit rings) is a **recipe** instead: `{kind: "puppet", parts: [{name, from:
{gen, params, seed} | {file}, pivot, z, rest}]}` in a `*.kit.json`. `art:build` packs the parts into one sheet with
the same nested-viewport trick as the rig repack, writes `<name>.rest.svg` (the assembled rest pose, for the DOM host,
dialogue portraits and snapshots), and emits a **`puppet` manifest entry** (20 §1.3): `{parts: [{name, frames, rest,
pivot, z, box}], anims, restFile}`, `rasterScale` 1.5.

**Animations are data**, not code: `<name>.anims.json` beside the SVG, a list of 20 §1.3 `PuppetAnim`s (per-part
tracks of waves `{amp, hz, phase}` or keyframes on `rot`, `x`, `y`, `scaleX`, `scaleY`, `alpha`, `frame`), validated
at build time and copied into the manifest entry. **Companions define `idle`, `talk` and `cue`; NPC puppets `idle`
and `talk`**; custom ids are free (Brasswick `arm_short`, `arm_sync`; hubs `partial`, `restored`). The runtime is
`src/game/expedition/puppets/Puppet.ts` (about 150 lines: a Container of Images; `play`, `stop`, `setDormant`). The
companion's flight to a hint target is host code (20 §2.2); the puppet plays `cue` in place during it.

| Puppet (key) | Parts (count) | `idle` | `talk` (while its line types) | `cue` / custom |
|---|---|---|---|---|
| **Cog** `orrery_terraces.companion.cog` (0.35 H) | body, belly_gears, head (lens eyes baked in), wing_l, wing_r, feet, key, eye_glow (ADD) (8) | body bob ±5 px @ 1.6 Hz; wings ±18° in phase; gears 0.25 rev/s | eye_glow alpha 0.4 → 0.9; gears ×2; head tilt ±4° on typewriter ticks | **cue**: wings beat, eye flare while the host flies it to the hint target (600 ms), circles it at r 60 twice and perches 1.5 s. The intro **wind** is `cue` with `key` spinning 3 turns. |
| **Pip** `living_gate.companion.pip` (38 px) | hull, porthole_glow, prop (2 frames), lens_cone (ADD) (4) | bob ±4 px @ 0.8 Hz; prop flips at 12 fps (the host adds the spring follow, k 0.08) | porthole_glow `#8FE0EA` scale 1 → 1.15 at syllable rate | **cue**: lens_cone alpha 0 → 0.35 over 300 ms, held while aid tier ≥ 1 (the water lens, cell §5.2) |
| **Ora bust** `living_gate.companion.ora_bust` (220 px, inside a `ringStack` porthole frame) | torso (jumpsuit + *Halcyon* patch), head, hair_cloud, goggles, headset, eyes (2: open/blink), brows (2: grin/focus), mouth (2) (8) | breath scaleY 1 → 1.015 over 2.4 s; blink every 3–5 s | mouth frames at 8 Hz while typing | **cue** / `react`: brows `focus` on a hint or failed Verify; mouth held open (grin) on success, 0.8 s |
| **Wick** `archive_of_voices.companion.wick` (40×60) | lantern_body, flame (3 frames), wing_l, wing_r, glow (ADD) (5) | bob ±4 px @ 0.5 Hz; wings ±10° @ 3 Hz; flame at 8 fps | glow scale 1 → 1.3; wings ±16° @ 6 Hz | **cue**: flame flare at the evidence anchor (civil §5.0.5) |
| **Brasswick** `orrery_terraces.npc.brasswick` | ≤ 8 | sway | jaw / arm gesture | `arm_short` (the arm swings on a visibly too-short period), `arm_sync` (the corrected period; trig §6.5) |
| **Record Engine** `archive_of_voices.prop.record_engine` (recipe) | drum, crown, 3 rings, iris (≤ 8) | slow ring drift | — | `partial` (the rings spin), `restored` (the iris opens) |

**The Ida bust is dropped** (31 A3): Ida is the `shared.char.ida` atlas with two costume overlays (§3b.6, civil
§0.1.2), seated behind the `reading_desk` hero in S1 and in the outro frame.

Emblems in the dialogue bar (Cog's broken rings, Ora's bilayer ring, the Reel, the Editor's slug, the Gatekeeper's
notches) are `ringStack` kit output, not puppets.

#### 3b.6 Other human characters

- NPC humans use the **same code path**. Otis and Theo use the `Male person` vector; Ida, Hattie and Dolores use
  `Female person` (the same 864×640 layout and the same symbol families; `Female person` has no `headBack` and
  `Male person` has no `bodyBack`, so their back-facing frames are not shipped).
- NPC atlases pack **12 frames** (`idle, walk0, walk2, walk4, walk6, talk, think, show, interact, cheer0, duck,
  hold`; no back-facing frame) in a 6×2 sheet: 1152 × 512 texels, **2.4 MB VRAM**. `NpcState.pose` maps `work` → `interact`, `wave` →
  `cheer0` (never in the sensitive biome), `sit` → `duck`.
- **Ida and Otis are P0** (civil §0.1.1: they are on the rig in S1); Hattie, Dolores and Theo are P1. Atlases per game:
  trig 1, cell 1, civil 3 at P0; ≤ 6 per game at P1 (20 §5.8).
- Non-human NPCs are puppets under the same ≤ 8-part rule and count as heroes: Brasswick (trig, P0 `before` state)
  and the Poro statue (cell zone B landmark, static at P0) ship at P0; Lumen, Quill, Sucra, Kay and the Ferryman at
  P1.

### 3c. Parallax layer sizing

- **Design frame: 1920×1080** (20 §2.1 full-bleed canvas; the panel is a DOM overlay per 20 §3.1).
- **Layers L0–L6** (bible §5.2, game docs §2.4). Each is a kit `compose`/`scatter` strip unless §4 names a hero:
  1. **L0 sky**: a `skyWash` 64×1080 strip stretched in X (a static screen-space layer), 2 `cloudBand`s at factors
     0.02–0.05, and a star field baked into one texture (trig Z3; ≤ 140 points, critique amendment 30).
  2. **L1 far** (0.15): `ridgeBand`/`skyline` strip, 2048 wide, tileable, haze 0.4, `rasterScale` 0.75.
  3. **L2 mid-far** (0.35): `scatter` of `canopy`/`crystalCluster`/`arch`, 2048 wide, haze 0.2, `rasterScale` 0.75.
  4. **L3 mid** (0.6): `compose` of walls, colonnades, facades and landmarks, 2048 wide, `rasterScale` 1.0. Named
     landmarks are separate `prop` sprites, so they can be lit or restored independently.
  5. **L4 play** (1.0): `groundStrip`/`bilayerTile` tiles (512 wide), plus parts, consoles, characters and pickups.
  6. **L5 foreground** (1.3): `railing`/`canopy frond` strips, 2 px Blur, 70 % alpha, never over a contraption
     bounding box (the host culls any overlap).
  7. **L6 light**: `glowSprite` quads (ADD), `grainTile` overlays, and the runtime Vignette.
- Tileable layers are drawn as N images side by side, or as one TileSprite when `repeatX`, and wrapped relative to
  the camera (20 §5.7). Every layer key is in the `layer` group (`<ns>.layer.<name>`); its depth is the overlay's
  `ParallaxLayer.depth`, not the key (§3.0).
- **Interactive contraptions are never baked into a layer.** Every moving or bound part is its own `part` texture
  with a fractional pivot and anchors, so `pose()` can rotate, move or recolour it independently.

### 3d. Manifest format and loader convention

The manifest schema is **20 §1.3 `AssetManifest`** (one shape for both documents, 31 A2): entry kinds `svg`,
`puppet` and `atlas`, a `zone` per entry (`"all"` or a zone id; 31 A4), per-zone `vram` and `swapPeakMb`.

```
public/assets/expedition/<ns>/
  manifest.json                         parsed with AssetManifest (20 §1.3)
  License.txt                           CC0 (Kenney) + OFL notices for the engraving fonts
  layer/ ground/ prop/ part/ costume/ companion/ npc/ fx/ ui/ vista/ doc/ silhouette/ kit/   *.svg (+ puppet *.rest.svg)
public/assets/expedition/shared/char/<id>.png + <id>.json         character atlases (+ kenney/ fallback sheets)
```

```jsonc
{
  "namespace": "orrery_terraces", "paletteId": "orrery_terraces", "heroCap": 40, "heroCount": 37,
  "totalBytes": 1180000, "gzipBytes": 348000,
  "vram": [ { "zone": "all", "mb": 10.6 }, { "zone": "z1_sunward", "mb": 91.0 } ], "swapPeakMb": 161.0,
  "entries": [
    { "kind": "svg", "key": "orrery_terraces.layer.mesa_z1", "file": "orrery_terraces/layer/mesa_z1.svg",
      "width": 2048, "height": 620, "tileWidth": 2048, "scroll": 0.15, "rasterScale": 0.75, "pivot": [0, 1],
      "zone": "z1_sunward", "source": "kit:ridgeBand", "seed": 2915730123, "sha1": "…", "legacyId": "A08" },
    { "kind": "svg", "key": "orrery_terraces.part.ring_gate_outer_ring", "file": "orrery_terraces/part/ring_gate_outer_ring.svg",
      "width": 408, "height": 408, "rasterScale": 1.5, "pivot": [0.5, 0.5], "anchors": [ { "name": "notch_0", "x": 204, "y": 391 } ],
      "zone": "z1_sunward", "source": "hero", "sha1": "…", "legacyId": "A86" },
    { "kind": "puppet", "key": "orrery_terraces.companion.cog", "file": "orrery_terraces/companion/cog.svg",
      "restFile": "orrery_terraces/companion/cog.rest.svg", "width": 64, "height": 60, "rasterScale": 1.5,
      "zone": "all", "source": "hero", "sha1": "…",
      "parts": [ { "name": "wing_l", "frames": 1, "rest": [14, 26], "pivot": [0.9, 0.2], "z": 1, "box": [0, 0, 24, 30] } ],
      "anims": [ { "id": "idle", "loop": true, "ms": 1600,
                   "tracks": [ { "part": "wing_l", "prop": "rot", "wave": { "amp": 18, "hz": 1.6, "phase": 0 }, "keys": [] } ] } ] }
  ]
}
```

The `shared` manifest carries the atlases:

```jsonc
{ "kind": "atlas", "key": "shared.char.wren", "zone": "all", "source": "rig:female_adventurer", "sha1": "…",
  "body": "female_adventurer", "image": "shared/char/wren.png", "frames": "shared/char/wren.json",
  "frameWidth": 192, "frameHeight": 256, "displayWidth": 168, "displayHeight": 224, "pivot": [0.5, 1],
  "poses": ["idle", "walk0", "…", "back"],
  "anchors": [ { "pose": "idle", "facing": "front",
                 "points": [ { "name": "head", "x": 87.3, "y": 129.9, "rot": 0 }, { "name": "face", "x": 87.3, "y": 94.9, "rot": 0 },
                             { "name": "torso", "x": 84.0, "y": 178.5, "rot": 0 }, { "name": "back", "x": 84.0, "y": 147.0, "rot": 0 },
                             { "name": "hand_r", "x": 130.0, "y": 188.8, "rot": 0 }, { "name": "hand_l", "x": 37.8, "y": 188.8, "rot": 180 },
                             { "name": "feet", "x": 84.0, "y": 222.3, "rot": 0 } ] } ],
  "fallback": { "image": "shared/char/kenney/character_femaleAdventurer_sheetHD.png",
                "xml": "shared/char/kenney/character_femaleAdventurer_sheetHD.xml",
                "frameNames": { "idle": "<the XML SubTexture name for idle>" } } }
```

- **Loader** (`src/game/art/manifest-loader.ts`, the art lane; 20 §5.7). `loadZone(scene, world, zoneId)` loads the
  entries tagged `all` that the world references, the entries tagged `zoneId`, and every key in
  `assetsForZone(world, zoneId)` (`src/world/residency.ts`, pure): `svg` → `load.svg` with `{width, height}` at k
  (§3.0); `atlas` → `load.atlas` (fallback `load.atlasXML`); `puppet` → `load.svg` of the part sheet, then
  `Texture.add` per part frame on `filecomplete`.
- `unloadZone(scene, world, prevId, nextId)` calls `textures.remove` on every key of the previous zone that is neither
  `all` nor needed by the next zone, once the transition wipe completes (§3f residency).
- This manifest is also the **generalization point** (§6). A PDF-driven pipeline writes kit entries and a palette,
  never TypeScript.

### 3e. Build-time engraving (text-to-path) and the DOM label rule

**Rule 1: dynamic or spec-derived text is DOM.** It goes through `WorldLabelLayer` (20 decision 7, 20 §2.2),
pinned to an anchor. The layer supports `rotate` and `scale` following the anchor, for labels on swinging parts.

This includes:
- plaque and claim text, value chips, date chips, T values, cartridge labels, basin plaques (HYPO/ISO/HYPER);
- split-flap characters, teletype tape, headlines, the day counter's digits, tumbler text;
- NPC names, and anything computed from `spec`, `overlay` or runtime state.

**"Phaser text" is banned in all three game docs**, and so is text baked into bitmaps.

**Rule 2: engrave only spec-independent constants.** These are fixed conventions and fictional wordmarks that
would stay true if the fixture were regenerated. Hero sources and kit generators write
`<text data-engrave="caps|serif|serif_italic" x y font-size text-anchor fill="{{token}}">…</text>`. `art:build`
replaces it with a `<path>`, so **output files never contain `<text>`**.

- **Markup:** `^{…}` is a superscript (0.62 size, raised 0.38 em) and `_{…}` a subscript. `sin^{-1}` is how to write
  sin⁻¹, because U+207B is missing from both fonts (verified).
- **A missing glyph fails the build** and lists the code points.
- **Test:** every engraved string is listed in the manifest (`engraved[]`). `tests/art-engrave.test.ts` asserts that
  none contains an encounter answer value from `answerVarsFor()`, using the token-boundary matcher from critique
  amendment 34. This stops an engraving from quietly leaking or contradicting an answer.

| Game | Engrave (static, spec-independent) | DOM (dynamic or spec-derived) |
|---|---|---|
| Trig | rail marks "0", "π/2", "π", "3π/2" (A77, quadrant conventions); tally numerals "0 I II III IIII V" (A90); the "T" on the pendulum plate (A127) | **the Warden shield "3 sin(π/2 · t)" (A125; derived from e6 params, so it moves to a rotating DOM label)**; the span-tile numerals −3…3 (A131; they follow e6's amplitude); plaque, claim and period-plaque text; chips |
| Cell | stencil letters on fixed apparatus (none required at P0) | HYPO/ISO/HYPER and IN/OUT/NONE plates, cartridge labels, claim text, chips, the Gradient Meter value |
| Civil | "THE COURIER-LEDGER" masthead (fictional), "MAIN", "DAY", "DARKROOM", "DEPARTURES", "TERMINAL", "SIGNAL", Roman clock numerals, the selector's "A/B/C", the Editor's "E" slug, the "5-10-25¢" sign | headlines, split-flap characters, teletype tape, the day counter's digits, date chips, slide slugs, cabinet labels, tumbler text, program and provision text, photo captions |

**Implementation** (`scripts/art/engrave.ts`, build-only, about 90 lines):

```ts
export type EngraveFace = "caps" | "serif" | "serif_italic";
export interface EngraveOpts { face: EngraveFace; size: number; x: number; y: number;
  anchor: "start" | "middle" | "end"; letterSpacing: number; precision: 1 }
export function engrave(text: string, o: EngraveOpts): { d: string; width: number; missing: string[] };
// Per character: pick the first font in the face's stack with charToGlyphIndex(ch) > 0, then glyph.getPath(x, y, size),
// and advance by advanceWidth · size / unitsPerEm. Returns path data at 1-decimal precision.
```

| Package (devDependency; pinned) | `npm view` 2026-09-26 | Used for |
|---|---|---|
| `opentype.js@2.0.0` | MIT; published 2026-05-06; ships `dist/opentype.mjs`; **no bundled types**, so add a ~20-line `scripts/art/opentype.d.ts` covering `parse`, `Font.charToGlyphIndex/charToGlyph/unitsPerEm`, `Glyph.getPath/advanceWidth` and `Path.toPathData` (all exercised in the probe). It parses **WOFF, not WOFF2**, so use Fontsource's `.woff` files. `@types/opentype.js@1.3.10` targets the 1.x API and is not used. | the text-to-path pass |
| `@fontsource/cinzel@5.3.0` | OFL-1.1; `files/cinzel-latin-{400,700}-normal.woff` | `caps` face (wordmarks, stencils, Roman numerals). **It renders lowercase as small caps** (verified: "sin" → "SIN"), so it is never used for maths. It lacks π (verified: 1 missing glyph in "3 sin(π/2 · t)"). |
| `@fontsource/eb-garamond@5.3.0` | OFL-1.1; `files/eb-garamond-{latin,greek}-{400,700}-{normal,italic}.woff` | `serif` / `serif_italic` (maths: π from the greek subset, and ·, −, ×, ÷, °, ¹, ² from latin; all verified present) |
| `fast-xml-parser@5.11.1` | MIT | lint, anchor extraction, rig `<defs>` walk |
| `@resvg/resvg-js@2.6.2` | MPL-2.0 (optional) | fast contact sheets only (the rig renders in Playwright's Chromium, §3b.2) |

Measured cost: "3 sin(π/2 · t)" at 26 px is 5.1 KB of path data, and "THE COURIER-LEDGER" is 9.6 KB. The budget is
≤ 8 KB of engraving per asset, so long wordmarks go on `plate` assets at small sizes or become DOM. PDF-generated
games never engrave (§6).

### 3f. Size and VRAM budget per game (P0 vs full)

**Assumptions.**
- VRAM = Σ `round(w·k) × round(h·k) × 4` bytes over resident textures (no mipmaps), at the worst case
  **dpr ≥ 1.5**.
- **Residency policy** (adopted by 20 §5.7, 31 A4): entries tagged `all` + the current zone's set (its layers,
  decor, landmarks and station parts). On a zone transition the next zone loads behind the wipe, and the previous
  zone is removed after it (the peak holds two zones briefly).
- Byte figures are the SVG source that ships (the browser rasterizes it). Averages: kit ~8 KB raw / ~2.5 KB gzip;
  hero ~20 KB / ~6 KB; puppet ~15 KB / ~5 KB; a protagonist atlas PNG ≈ 250 KB (a PNG, so not in the SVG byte
  budget).

**Worked estimate: trig zone Z1 (S0–S2, e1 + e2), P0, dpr ≥ 1.5.**

| Item | Size × k | MB |
|---|---|---|
| L0 `skyWash` strip (rs 0.75 → k 1.25) + 2 `cloudBand`s (rs 0.5 → k 0.75) | 80×1350, 2 × 1536×180 | 2.6 |
| L1 far (2048×700, rs 0.75 → k 1.25) | 2560×875 | 9.0 |
| L2 mid-far (2048×640, k 1.25) | 2560×800 | 8.2 |
| L3 mid (2048×600, k 1.5) | 3072×900 | 11.1 |
| L4 ground, 3 tiles (512×208, k 1.5) | 3 × 768×312 | 2.9 |
| L5 fore (2048×260, k 1.25) + L6 grain and god rays | 2560×325 + small | 4.3 |
| Decor kit `prop`s, about 10 unique (avg 260×420, rs 1.0 → k 1.5) | 10 × 390×630 | 9.8 |
| Landmarks: orrery tower (520×900) + gondola (≈ 600×400), k 1.5 | 780×1350, 900×600 | 6.4 |
| e1 Vesper Dial parts: disc 560² and rail 640² at k 1.5; carriage, ledge, 2 gauges, lens at k 2.25; fog band at k 0.75 | | 11.3 |
| e2 Tidewheel parts: wall 900×760 at k 1.5; rings 408² / 340², tally, fin, pawl, skiff at k 2.25; shaft and splash at k 0.75 | | 14.6 |
| `all`: the Wren atlas (1344×1024 PNG = 5.5), Cog puppet (≈ 0.1), costume overlays (≈ 1), orbs/pins/glows/emblems (≈ 4) | | 10.6 |
| **Resident total** | | **≈ 91 MB** |

This is inside 20 §5.8's per-zone ceiling (trig ≤ 120 MB) and its 180 MB swap-pair cap, with room for the transition
overlap (≈ 91 + ≈ 70 for Z2's layers and first stations). At dpr 1 the same set is about 43 MB.

| Game | Tier | Hero SVG files (cap 40) | Kit entries | Atlases and puppets | Art shipped, raw / gzip | Peak VRAM, one zone resident (dpr ≥ 1.5) | Peak during a zone swap | Peak at dpr 1 |
|---|---|---|---|---|---|---|---|---|
| Trig | **P0** | 37 | ≈ 75 | Wren atlas (28 frames); Cog, Brasswick | ≤ 1.2 MB / ≤ 350 KB | ≤ 120 MB (Z1 ≈ 91; Z3 with the Warden ≈ 110) | ≤ 180 MB | ≤ 60 MB |
| Trig | Full | ≤ 40 | ≈ 120 | + Lumen, Quill, the automaton/mimic variants | ≤ 2.0 MB / ≤ 600 KB | ≤ 140 MB | ≤ 180 MB | ≤ 70 MB |
| Cell | **P0** | 36 | ≈ 90 | Diver atlas (28 frames); Pip, Ora bust, Poro statue | ≤ 1.2 MB / ≤ 400 KB | ≤ 135 MB (zone B: 4 stations, the biggest parts) | ≤ 180 MB | ≤ 65 MB |
| Cell | Full | ≤ 40 | ≈ 130 | + Sucra, Kay, Ferryman | ≤ 2.0 MB / ≤ 650 KB | ≤ 150 MB | ≤ 180 MB | ≤ 75 MB |
| Civil | **P0** | 35 | ≈ 95 | Nell atlas (28 frames), Ida and Otis atlases (12 frames each); Wick, the Record Engine hub | ≤ 1.2 MB / ≤ 400 KB | ≤ 140 MB (S8: vault socket and door, press-organ; set the vault socket to `rasterScale` 0.75) | ≤ 180 MB | ≤ 70 MB |
| Civil | Full | ≤ 40 | ≈ 140 | + Hattie, Dolores, Theo atlases (≤ 6 atlases) | ≤ 2.0 MB / ≤ 650 KB | ≤ 160 MB | ≤ 180 MB | ≤ 80 MB |

- These rows are 20 §5.8's budgets (adopted in revision 3): P0 ≤ 1.2 MB biome SVG source, full ≤ 2.0 MB raw /
  0.65 MB gzip.
- The JS chunk budget (≤ 200 KB gzip, 20 §5.8) is unaffected: the kit runs at build time for the showcase games.
- `art:build` prints the real figures per zone and **fails** if a zone exceeds its row, so these rows are
  enforced ceilings, not hopes.
- Everything is far under the old "< 6 MB per playable game" bar.

## 4. P0 asset lists per game (the demo cut, 2026-09-27)

> **Superseded for hero lists and ownership (31 A1, A2).** The authoritative P0 hero lists are the game docs': trig
> §0.2–§0.3 (37), cell §0.1.2–§0.1.3 (36), civil §0.1.2–§0.1.3 (35), with 20 §4.3 part keys
> (`<ns>.part.<skin>_<slot>`), `<ns>.costume.*` overlays, `shared.char.*` atlases and 20 §5.1 groups. Who draws what
> is 20 §7.0's quota table. The tables below keep the old ids and this document's earlier key spellings
> (`…far.orrery_tower`, `…part.ringgate_wall`, `…char.wren_*`, the Ida bust) **only for traceability**; the kit
> coverage bullets under each game remain the generator guidance.

**P0 art rule** (critique amendment 12):
- every station fully built;
- the intro and the finale;
- **zone 1 at full art**;
- every other zone gets kit layers plus at least one hero landmark (in practice, its stations' heroes).

"Hero" means a hand-authored file counted against the cap. Everything else is a `kit:<generator>` entry, the rig,
or DOM. The old ids from the game docs are kept in parentheses so those lists can be re-tagged (critique amendment 14).
**P1** adds side-quest NPC puppets. **P2** adds maps, secrets and extra decor variety.

**Authoring order** (the vertical-slice gate is "trig S1–S2 by midday"; 20 §7.1 gives the lanes and clock):
1. palette tokens (W0);
2. kit generators, the build, the rig and the loader (A1);
3. trig `z1_sunward` kit layers and every skin's kit stand-ins (A2);
4. trig zone-1 heroes, the Wren atlas and Cog (C1, A1);
5. the finish-stack lock at Gate V;
6. cell and civil heroes in parallel (C2, C3 and the contraption lanes' skin heroes).

### 4.1 Trig — `orrery_terraces` (zone 1 = Z1 Sunward Terrace: S0 Sunward Landing, S1 Vesper Court `e1`, S2 Tidewheel Gate `e2`)

**Hero files (24; superseded by the game doc's §0 list, see the banner above).**

| # | Key | Old id | Zone / use | Notes |
|---|---|---|---|---|
| 1 | `orrery_terraces.far.orrery_tower` | A11 | L1 on every zone; the finale vista | stepped tower + dome cap; the rings (A12) are `ringStack`; beam lines are code |
| 2 | `orrery_terraces.prop.gondola` | (S0 text) | Z1 intro | the cable-gondola platform and car; the cable is `linkStrip` |
| 3 | `orrery_terraces.part.vesper_disc` | A76 | e1 | the 3.3 H stone dial with sun and spoke slots |
| 4 | `orrery_terraces.part.vesper_carriage` | A78 | e1 | the brass shoe and emitter cup |
| 5 | `orrery_terraces.part.ringgate_wall` | A85 | e2 | the 5.png wall with grooves, doorway recess and medallions |
| 6 | `orrery_terraces.part.ringgate_fin` | A88 (A89 = `flipX`) | e2 | one file, mirrored at runtime |
| 7 | `orrery_terraces.part.ringgate_pawl` | A91 | e2 | latch pawl |
| 8 | `orrery_terraces.prop.canal_skiff` | A92 | e2 payoff | |
| 9 | `orrery_terraces.part.automaton_a` | A95 + A98 | e3, e5 | assembly: shell, faceplate halves (2 frames), bell, hat |
| 10 | `orrery_terraces.part.automaton_b` | A96 | e3, e5 | variant silhouette (A97 is P1) |
| 11 | `orrery_terraces.part.mimic_crab` | A101 + A102 | e3, e5 | assembly: shell, stalk eyes, caliper claw, leg (×6 at runtime) |
| 12 | `orrery_terraces.part.tuning_lens` | A103 | e3, e5 | the probe lens, bound per critique amendment 27 |
| 13 | `orrery_terraces.part.echo_lift_platform` | A104 | e3 payoff | the chain is `linkStrip` |
| 14 | `orrery_terraces.part.glyph_stone` | A108 | e4 | |
| 15 | `orrery_terraces.ui.span_glyphs` | A109 | e4 | 5-icon sheet |
| 16 | `orrery_terraces.part.treasury_chest` | A117 + A118 | e5 | assembly: body + lid |
| 17 | `orrery_terraces.mid.dome_interior` | A22 | Z3 landmark | ribs + unlit star band; the stars are a baked `grainTile`-style point texture |
| 18 | `orrery_terraces.part.warden` | A120, A121, A123, A124, A125 | e6 boss | ≤ 8-part assembly: torso, head, upper arm, lower arm, shield (its equation is **DOM**, §3e), visor slot; the plinth A126 is `stairs` + `column`, the glow A122 is `glowSprite` |
| 19 | `orrery_terraces.part.star_door` | A128 | e6 payoff | 2 leaves |
| 20 | `orrery_terraces.char.wren_hair_bun` | A138 | overlay: head | |
| 21 | `orrery_terraces.char.wren_scarf` | A141–A143 | overlay: torso | knot + 2 tail parts |
| 22 | `orrery_terraces.char.wren_staff` | A153 | overlay: handF | astrolabe ring spins on celebrate |
| 23 | `orrery_terraces.char.wren_satchel` | A152 | overlay: torso | |
| 24 | `orrery_terraces.companion.cog` | A155–A161 | guide | the 8-part puppet (§3b.5) |

**Kit coverage (P0).**
- **Z1 (full art)**: A01–A07 skies → `skyWash` + `cloudBand`. A08 → `ridgeBand butte_fluted`. A13 aqueduct →
  `arch arcade`. A14 → `scatter(crystalCluster)`. A15/A16 → `scatter(canopy blob_tree)`. A17 → `compose(arch
  buried, ashlarWall)`. A18 → `waterBand falls`. A19/A20 → `ashlarWall rounded` + crystals. A21 → `ashlarWall` with
  a navy band, gold cap and medallions. A23 → `compose(column ×6, canopy vine_drape)`. A26–A28, A30 →
  `groundStrip`. A29 → `waterBand canal` + `groundStrip`. A31 → `stairs`. A32/A33 → `ridgeBand chasm_edge`.
  A34/A35 → `column`. The L5 balustrade → `railing navy_cap_wave`. L6 → `glowSprite` + `grainTile leaf_dapple`.
- **e1/e2 parts**: A77 → `ringStack` + engraved marks. A79 → `stairs spoke_ledge`. A80/A82 → `gauge`. A81 →
  `ringStack`. A83 → `ringStack` + `crystalCluster`. A84 → `cloudBand fog`. A86 → `ringStack` (wave + notch). A87
  → `ringStack` (cutout). A90 → `ringStack` (teeth + engraved numerals). A93/A94 → `glowSprite`. The consoles →
  `lectern`.
- **Z2/Z3 (kit layers only)**: A09/A10 → `ridgeBand` in the Z2/Z3 palettes. A24 → `waterBand falls`. A25 →
  `truss gantry` + `ringStack` gears. Parts: A99/A100/A134 → `plate`. A105/A111/A129/A135 → `linkStrip`.
  A106/A107 → `ridgeBand chasm_edge`. A110 → `cloudBand fog`. A112 → `crystalCluster hanging_roots`. A113 →
  `ringStack` (ellipse 0.4). A114 → `shelving rack_bays`. A115/A127 → `column`. A119/A130/A133 → `ringStack`.
  A126 → `stairs stepped_plinth`. A131 → `groundStrip` + DOM numerals. A132 → `groundStrip grate` + `railing`.
- **Finale vista**: `vista.canyon_z3` = `compose(skyWash dusk, ridgeBand, orrery_tower, beam lines)` with the camera
  step from critique amendment 25.
- **P1**: A97, Brasswick, Lumen, Quill (puppets); A116 crumble; the telescope; the music box. **P2**: A136
  constellations, the Orrery Map.

### 4.2 Cell — `living_gate` (zone 1 = zone A: S1 Glycocalyx Shore, S2 Colonnade Rise `e1`, `e2`)

**Hero files (31; superseded by the game doc's §0 list, see the banner above).**

| # | Key | Old id | Zone / use | Notes |
|---|---|---|---|---|
| 1 | `living_gate.prop.halcyon` | #135 | intro, S1 | the sub |
| 2 | `living_gate.far.nucleus_dome` | #11 | L1 in every zone; the finale | pore rings light as gates restore (`ringStack` sprites on its anchors) |
| 3 | `living_gate.ground.stiff_ridge` | #33 | e1 world object | tweens to a ramp |
| 4 | `living_gate.part.pod` | #73–#76 | e1, e3, e4, e7 | assembly: pedestal, capsule, fog, crack (the plate on the pedestal is `plate`) |
| 5 | `living_gate.part.mimic_mote` | #77 | the pod kit | 2 frames |
| 6 | `living_gate.part.probe_needle` | #79 | e1 | |
| 7 | `living_gate.part.gate_socket` | #80 | e2 | the rings #81/#82 are `ringStack` |
| 8 | `living_gate.part.gate_fin` | #83 (#84 = `flipX`) | e2 | |
| 9 | `living_gate.part.carrier_rocker` | #86 | e2 payoff | |
| 10 | `living_gate.part.dye_tank` | #87 | e3 (zone B landmark) | the window #88 is `bilayerTile strip_vertical` |
| 11 | `living_gate.part.balance_beam` | #90 (+ #91 float) | e3 | the pillar #89 is `column`; the chain #92 is `linkStrip` |
| 12 | `living_gate.part.osmo_basin` | #93 | e4 | the test cell #94/#95 is `bilayerTile ring` + `molecule cell` |
| 13 | `living_gate.part.raft_lock` | #96 | e4 | the raft #97 is `plate raft` |
| 14 | `living_gate.part.label_lock` | #98 | e5, e9 | the leaf #99 is `plate`; the valve #100 is `ringStack`; the basins #102/#103 are `waterBand pool` |
| 15 | `living_gate.part.cell_sprites` | #106–#110 | e5, e9 | 5-frame sheet: RBC, plant, protoplast, generic, potato (P1: move to `molecule cell`) |
| 16 | `living_gate.part.carrier_door` | #112 | e6 | |
| 17 | `living_gate.part.gate_minis` | #114 + #115 | e6 | 2-frame sheet: glide gate, pump gate |
| 18 | `living_gate.prop.hall_facade` | #113 | zone C landmark (the Pump Hall) | |
| 19 | `living_gate.part.flume_pump` | #120 | e7 | the tanks #118/#119 are `plate slate` + `waterBand`; the trough #121 is `stairs`; the gantry #123/#124 is `truss` + `linkStrip` |
| 20 | `living_gate.part.atp_lantern` | #122 | e7, Kay's quest | |
| 21 | `living_gate.part.nak_pump` | #125–#127 | e8 | assembly: housing + 2 jaws; the drum #128 and sockets #129/#130 are `ringStack` |
| 22 | `living_gate.part.barge` | #111 | e9 | |
| 23 | `living_gate.part.dynamin_collar` | #137 | e10 | the clathrin #136 is `molecule hex_ring`; the lift #138 is `column`; the lamp #139 is `ringStack`; the vesicle #140 is `bilayerTile ring` |
| 24 | `living_gate.part.gatekeeper` | #142–#148 | e11 boss | 8-part assembly: body, eye_outer, pupil, maw_oil, maw_channel, maw_pump_upper, maw_pump_lower, atp_pipe (the three presentation waves are critique amendment 18) |
| 25 | `living_gate.char.diver_helmet` | #174 | overlay: head | |
| 26 | `living_gate.char.diver_scarf` | #175 | overlay: torso | 3-segment spring chain |
| 27 | `living_gate.char.probe_staff` | #176 | overlay: handF | the bulb is tinted cyan or orange at runtime |
| 28 | `living_gate.companion.pip` | #177, #178 | guide | 4-part puppet |
| 29 | `living_gate.companion.ora_bust` | #179, #180 | cutscenes | 8-part bust; the porthole #181 is `ringStack` |
| 30 | `living_gate.ui.stage_icons` | #201 | e8 panel | 7-icon white line-art sheet |
| 31 | `living_gate.ui.plank_icons` | #202 | e10 panel | 5-icon sheet |

**Kit coverage (P0).**
- **Zone A (full art)**: the sky #1 → `skyWash` + `cloudBand swirl`. #7/#8 → `ridgeBand cell_dome`. #13 →
  `scatter(canopy bead_tree)`. #14 → `scatter(column broken)`, desaturated. #19 → `waterBand tide` + `molecule`
  specks. #20 → `lipidColonnade`. #21–#23 → `crystalCluster stud/cluster/fan`. #29–#32, #34 → `bilayerTile`.
  #39 → `canopy frond`. #40 → `cloudBand` bubbles. #45 → `glowSprite`. #48 → `glowSprite mote`. #49–#60 →
  `molecule`. #61–#65 → `glowSprite`. #66/#67 → `lectern`. #68/#69/#71/#72 → shared or `ringStack`. #70 →
  `crystalCluster stud` in `wisp.indigo`. #85 → `ringStack`.
- **Zones B–D (kit layers)**: #9/#10/#12 → `ashlarWall` + `ringStack` windows. #15 → `column`. #18 →
  `linkStrip microtubule` arches via `compose`. #24 → `ashlarWall`. #25 → `waterBand falls`. #26 → `linkStrip
  rail` + `gauge`. #27 → `lipidColonnade` dusk palette. #28 → `ashlarWall` + `column`. #35/#38 → `bilayerTile
  hall_deck/ceiling`. #36 → `waterBand trench`. #37 → `groundStrip causeway`. #41 → `railing`. #42 → `canopy
  vine_drape` in salmon. #43 → `glowSprite`. #44 → `grainTile caustics`. #46/#47 → `glowSprite` + Vignette.
- **Parts**: #104/#105 → `stairs carved_wet`. #116 → `stairs` (wedge). #117/#148's clamps → `linkStrip pipe`.
  #131/#133 → `shelving rack_bays`. #132 → `plate cartridge` (labels are DOM). #134 → `railing` bars +
  `ringStack` medallion. #141 → `linkStrip microtubule`. #149–#151 pore → `ringStack` (8 spokes, 11 sockets, notch)
  + `gate_fin`. The emblems #193/#194 → `ringStack`. The bin cards #195–#198 → `compose(bilayerTile strip,
  ringStack, stairs)`. #199/#200 → `molecule`. The Gradient bar #204 → `gauge`.
- **Finale vista**: `compose(skyWash, ridgeBand cell_dome, nucleus_dome)`.
- **P1**: Sucra, Poro, Kay, the Ferryman (puppets); #16/#17 nerve beacon; the Plant Cell Garden. **P2**: #203 the
  Cell Chart.

### 4.3 Civil — `archive_of_voices` (zone 1 = S1 The Morgue (Z4 interior, the intro and hub) + S2 Courthouse Square `e1`, `e2`)

**Hero files (30; superseded by the game doc's §0 list, see the banner above).**

| # | Key | Old id | Zone / use | Notes |
|---|---|---|---|---|
| 1 | `archive_of_voices.part.engine_drum` | `cr.set.engine_drum` + `engine_iris_blade` | S1 Record Engine | assembly: drum + iris blade (×8 at runtime). The plinth is `stairs stepped_plinth`; the 3 rings and the lens are `ringStack` |
| 2 | `archive_of_voices.part.engine_crown` | `engine_crown_l` (`_r` = `flipX`) | S1 | |
| 3 | `archive_of_voices.part.main_breaker` | `main_breaker` + `breaker_lever` | S1 tutorial | assembly; "MAIN" engraved |
| 4 | `archive_of_voices.prop.reading_desk` | `reading_desk` | S1 | Ida's bust sits behind it |
| 5 | `archive_of_voices.prop.proof_press` | `proof_press` | S1 | Hattie's press |
| 6 | `archive_of_voices.prop.courthouse` | `courthouse` | S2 landmark | the clock → `ringStack` + engraved Roman numerals; the hands → `gauge` needle; the steps → `stairs` |
| 7 | `archive_of_voices.part.city_bus` | `city_bus` | S2, e2 | the lights → `glowSprite` |
| 8 | `archive_of_voices.part.proof_lamp` | `proof_lamp_stand` + `proof_lamp_head` | e1, e4 | assembly (pivot per civil §7.9) |
| 9 | `archive_of_voices.part.witness_lens` | `witness_lens` | e1, e4 | the slide frame → `plate slide_mat` |
| 10 | `archive_of_voices.part.lens_carriage` | `lens_carriage` | every station (Record Lens) | the rail → `linkStrip rail` |
| 11 | `archive_of_voices.prop.console_reader` | `console_reader` | every station | microfilm reader |
| 12 | `archive_of_voices.char.nell_satchel` | civil §3.1 | overlay: torso | |
| 13 | `archive_of_voices.char.nell_scarf` | civil §3.1 | overlay: torso | salmon `cr.autumn` |
| 14 | `archive_of_voices.companion.ida_bust` | civil §3.2 | S1, the outro | 7-part bust |
| 15 | `archive_of_voices.companion.wick` | civil §3.2 | guide | 5-part puppet |
| 16 | `archive_of_voices.prop.schoolhouse` | `schoolhouse` | S3 landmark | the doors → `arch` + `plate` |
| 17 | `archive_of_voices.part.teletype` | `teletype` (+ `teletype_paper`) | e3 | the tape text is DOM |
| 18 | `archive_of_voices.prop.terminal` | `terminal` | S4 landmark | "TERMINAL" engraved |
| 19 | `archive_of_voices.part.junction_box` | `junction_box` | e5 | |
| 20 | `archive_of_voices.part.counter_stool` | `counter_stool` | e4 | ×12 instances |
| 21 | `archive_of_voices.prop.church` | `church` | S5 landmark | the rose window → `ringStack` |
| 22 | `archive_of_voices.part.relay_station` | `relay_station` + `relay_dish` | e6 | assembly; the mast → `truss lattice_mast` |
| 23 | `archive_of_voices.part.switchboard` | `switchboard` | e7 | the jack lamp and plug → `ringStack` / `linkStrip` |
| 24 | `archive_of_voices.part.filing_cabinet` | `filing_cabinet` + `filing_drawer` + `feature_shutter` | e8 | assembly |
| 25 | `archive_of_voices.part.surveyor_console` | `surveyor_console` | e9 | |
| 26 | `archive_of_voices.part.streetcar` | `streetcar` | e9 payoff ride | windows empty (civil R10) |
| 27 | `archive_of_voices.part.big_board` | `big_board` | e11 | **resized to ≤ 1100 wide** (critique F8) |
| 28 | `archive_of_voices.part.canister` | `canister` + `canister_lid` | e11 | assembly |
| 29 | `archive_of_voices.part.vault_door` | `vault_door` | e12 boss | the socket, tumblers, bolt, handwheel and voice grille are `ringStack`/`plate` |
| 30 | `archive_of_voices.prop.press_organ` | `press_organ` | e12, the outro | |

**Kit coverage (P0).**
- **S1 + S2 (full art)**: the Z4 interior back wall → `brickWall` + `arch` windows + `waterBand` rain-on-glass
  streaks. L2 pipes → `linkStrip pipe` + `shelving compact_stack`. The Z1 sky → `skyWash` + `cloudBand`. L1 →
  `skyline` (the setback tower's anchor carries the `ringStack` antenna ring). L2 → `facade brick_row` +
  `canopy magnolia` + `column pole` with wires. L3 street wall → `facade storefront` + `awning`. L4 →
  `groundStrip sidewalk/brick_plaza/wood_floor`. L5 → `railing wrought_iron`, `column` (parking meter,
  lamppost), `plate` (newspaper bundle), `canopy magnolia`. L6 → `glowSprite`, `grainTile grain/blinds/scanlines`.
- **S1/S2 parts**: `basement_stair` → `stairs iron` + `railing`. `front_pages_wall` → `shelving cork_frames`.
  `front_page` → `plate front_page` with the engraved masthead (the headlines are DOM). `stack_unit`/`stack_crank`
  → `shelving compact_stack` + `ringStack`. `rolling_ladder` → `stairs ladder`. `bus_shelter` → `compose(awning,
  column, plate)`. `day_counter` → `plate` + "DAY" engraved, digits DOM. `flood_band` → `waterBand flood`.
  `walk_slab` → `plate slab`. `courthouse_plaque` → `plate`.
- **Other scenes (kit layers + the station heroes above as landmarks)**: `newsstand`/`dimestore` → `facade` +
  `awning`. `lunch_counter` → `plate` + `groundStrip`. `menu_board` → `plate`. `pendant_lamp` → `linkStrip` +
  `glowSprite`. `departure_board`/`split_flap` → `shelving` grid + `plate flip_cell` (characters DOM).
  `canopy_rail` → `truss`. `divider_rail` → `railing brass_rail`. `rolling_gate` → `railing`. `photo_withheld` →
  `plate` + `glowSprite` blur. `bandstand` → P1. `broadcast_mast`/`lift_cage` → `truss`. `memorial` →
  `compose(column ×12, ashlarWall attic)`. `memorial_steps` → `stairs marble_landing`. `reflecting_pool` →
  `waterBand pool`. `signal_meter` → `gauge arc_meter`. `pneumatic_drop`/`tube_segment`/`floor_rail` →
  `linkStrip`. `bridge` → `truss through_arch` with 4 crown `deckGaps`. `bridge_plank` → `plate` (date chips DOM).
  `bay_lamp` → `column lamp_post`. `vault_socket` → `ringStack` (rs 0.75). `voice_grille` → `ringStack`.
- **Finale vista**: dawn skyline = `compose(skyWash Z5, skyline, cloudBand)`.
- **P1**: the Ida body rig; Otis, Hattie, Dolores and Theo rigs; `pie_case`; `bandstand`; `swing_door`.
  **P2**: the darkroom secret (`darkroom_door`, negatives), the Record Line map.

## 5. Summary recommendation

1. **Generate, don't draw.** 31 seeded kit generators in `src/game/art/kit/` cover skies, silhouettes, architecture,
   water, membranes, rings, plates, linear parts, gauges, FX and the hex panel texture. `art:build` emits them as
   ordinary, linted, token-resolved SVG files with manifest entries. Hand-author **≤ 40 heroes per biome** (P0:
   37 / 36 / 35, the game docs' lists); every hero key also has a kit entry, its automatic fallback.
2. **One human rig, one raster path.** The Kenney toon bodies are recoloured from `Vector/*.svg` with a group-scoped
   fill map, repacked (28 frames for protagonists, 12 for NPCs) and rendered to a PNG atlas (`shared.char.<id>`), with
   build-computed per-frame anchors named `head`, `face`, `torso`, `back`, `hand_l`, `hand_r`, `feet`. Wren, the Diver
   and Nell are one rig in three costumes; Ida and Otis are P0 NPC atlases. The emergency fallback is the untinted
   `sheetHD.png` + `.xml` via `load.atlasXML`.
3. **Guides and creatures are small puppets.** Cog, Pip, Wick and the Ora bust (plus Brasswick and the civil Record
   Engine hub): ≤ 8 parts, a `puppet` manifest entry, named animations from `<name>.anims.json` (`idle`, `talk`,
   `cue` + custom). The Ida bust is dropped.
4. **One naming table**: 20 §5.1, copied verbatim in §3.0 (`ns.group.name`, fractional pivots,
   `k = ceil4(rasterScale × min(dpr, 1.5))`).
5. **Text.** Static engraving becomes paths at build (opentype.js 2.0.0 + Cinzel + EB Garamond). Every dynamic or
   spec-derived label is DOM.
6. **Budgets** (§3f, 20 §5.8): P0 ≤ 1.2 MB raw SVG per game and ≤ 120 / 135 / 140 MB resident VRAM per zone at
   dpr 1.5, ≤ 180 MB during a zone swap, all enforced by `art:build` with per-zone residency.
7. **Kenney's other packs** (`abstract-platformer`, `hexagon-pack`, `shape-characters`, `background-elements`) are
   **reference only**, for kit defaults and silhouettes.

## 6. Generalization to PDF-generated games

The showcase games prove the pipeline. A PDF game reuses it with **zero hand-authored files**:

1. **Biome.** The World Writer (20 §6) picks a biome preset from `src/world/biomes.ts` (20 §6.4) and a palette
   variant (the same token names, shifted hues). Each preset is a **recipe**: a list of kit entries with parameter
   *ranges*, for example a "library" preset built from `shelving`, `facade`, `arch` and `skyline`.
2. **Contraptions.** Each contraption archetype's prefab (20 §4) declares its parts as **kit entries**. For example
   `ring_gate` = wall (`ashlarWall` + `arch` recess) + outer and inner `ringStack` + fin (the shared hero from
   `shared/part/fin`), with params filled from the meta's `configSchema`. Every archetype therefore has a kit-only
   skin, and heroes are optional upgrades. The mode → archetype table the old §4 called missing lives in 20 §4.
3. **Where it runs.** Kit generators are pure TypeScript with no `fs`, so the server-side assembler (S8, 20 §6.3)
   calls them directly. It writes SVG blobs to storage (`/api/blobs/art/<gameId>/<group>/<name>.svg`), and the
   world overlay carries the manifest under namespace `gen_<gameId>`. The client loader (§3d) doesn't care whether
   entries came from `public/` or `/api/blobs/`.
4. **Characters.** PDF games reuse the committed `shared.char.*` atlases. The biome picks one of a few pre-built
   costumes (the three showcase costumes plus neutral ones), because rig recolour runs at build time and reads the
   Kenney zip. The companion is a `shared` puppet with its emblem colour from the palette.
5. **Text.** PDF games **never engrave**: `engrave[]` requests become `WorldLabelLayer` labels at the anchors. That
   keeps fonts and opentype.js out of the server path and removes any risk of engraving model-written text.
6. **Validation.** The kit `schema`s are the base for strict-mode `writerConfigSchema`s (critique amendment 13).
   Each has bounded integers and enums, with no records. Budgets and lint run on generated output exactly as in
   `art:build`, so a generated biome can't blow the VRAM cap.

## 7. Verification trail

Everything below was run in this session against the real network or filesystem. Probes ran in a scratch directory
outside the repo; nothing was installed into the repo.

```bash
# 1. Sourcing (2026-09-25; unchanged)
cd .data/asset-scratch
curl -sSL "https://kenney.nl/assets/<slug>" | grep -o 'https://kenney.nl/media/pages/assets/[^"'"'"']*\.zip'
curl -sSL -o <slug>.zip "<url-from-above>"; unzip -l <slug>.zip | head -30; unzip -p <slug>.zip License.txt

# 2. Phaser loader and frame API
grep -n "load\.\(image\|spritesheet\|atlas\|atlasXML\|multiatlas\|aseprite\|svg\)(" node_modules/phaser/types/phaser.d.ts
grep -n "svg(key: string | Phaser.Types.Loader.FileTypes.SVGFileConfig" node_modules/phaser/types/phaser.d.ts   # line 90412
grep -n "add(name: number | string, sourceIndex" node_modules/phaser/types/phaser.d.ts                              # line 135050

# 3. Rig facts (2026-09-26)
unzip -l toon-characters.zip | grep "Female adventurer"          # 11 Parts, 11 Parts HD, 45 Poses, 45 Poses HD, 4 Tilesheet, 1 Vector
file ".../Poses HD/character_femaleAdventurer_idle.png"            # 192 x 256; the 1x set is 96 x 128; sheetHD 1728 x 1280
grep -o 'fill="#[0-9A-Fa-f]\{6\}"' character_femaleAdventurer.svg | sort | uniq -c   # 11 fills
# Python: walk <defs> groups → fills per symbol group (the §3b.2 table); walk the pose tree with a matrix stack →
#   per-frame head/torso/hand transforms for all 45 frames (the §3b.3 table)
# Node + @resvg/resvg-js@2.6.2: recoloured sheet with the filter stripped (it matches Kenney's sheetHD.png; with the
#   filter: dark offset artefacts); 28-frame nested-viewport repack = 167,730 B raw / 11,797 B gzip; alpha scan
#   gives a figure height of 96 px of 128 with feet at y = 127

# 4. Packages and glyphs (2026-09-26)
npm view opentype.js version license      # 2.0.0 MIT (no bundled .d.ts)
npm view @fontsource/cinzel version license        # 5.3.0 OFL-1.1
npm view @fontsource/eb-garamond version license   # 5.3.0 OFL-1.1
npm view @resvg/resvg-js version license           # 2.6.2 MPL-2.0
npm view fast-xml-parser version license           # 5.11.1 MIT
# Node + opentype.js 2.0.0: Cinzel lacks π and renders lowercase as small caps; EB Garamond greek has π;
#   U+207B (superscript minus), ♪ and θ are missing from the latin subsets; "3 sin(π/2 · t)" at 26 px = 5.1 KB of path data
```
