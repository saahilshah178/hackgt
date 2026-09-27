# W1a verification report

Verifier run, 2026-09-26 (about 18:40 to 19:10 local). This run was read-only. I made no source edits: every outside diff the lanes asked for was already in the tree when I started (see §4).

## 1. Suite results

| Check | Result |
|---|---|
| `pnpm typecheck` | **0 errors** (tsc exit 0) |
| `pnpm exec vitest run` | **139 files, 1960 tests, all passed** (7.7 s) |
| `pnpm lint` | **0 errors**, 24 warnings. All 24 are unused variables in legacy files (`src/mechanics/families/**`, `src/pipeline/{llm,orchestrator}.ts`, `src/server/storage/local.ts`, legacy hosts, `tests/intake-gatekeeper.test.ts`). None are in W1 paths. |
| `pnpm build` | **green**. Every route compiles, including `/dev/expedition`, `/dev/expedition/client` and `/dev/panel`. |
| `pnpm art:check` | **green**: shared (21 files), orrery_terraces, living_gate and archive_of_voices (3 each) |
| `pnpm exec playwright test` (both projects) | **19 passed, 8 skipped, 0 failed** (1.1 min). webgl: 16 passed, 8 skipped (`expedition-keyboard.spec.ts`, still `test.skip`). dom: 3/3 passed (`expedition-client.spec.ts`). |

**Server note.** The shared server on :3100 was down (curl exit 7). Next 16 allows only one `next dev` per project directory, and a hackgt `next dev` was already running on **:3000**. I confirmed that server is in mock mode: the page shows the "Mock mode." banner, and the play page serialises `sfx:true`, so EXPEDITION_SFX is not off there. I ran every e2e and capture against :3000. I did this through throwaway configs in `test-results/w1a/`, which is gitignored: they import the root `playwright.config.ts` and override `baseURL` and `webServer`. I did not start a second server.

**Side effect.** `e2e/golden-path.spec.ts` writes its screenshots into `docs/overnight/screens/`, so this run rewrote `02-intake.png`, `03-forge.png`, `05-end-screen.png` and `06-debrief.png` there. They are tracked files; I left them modified and did not revert them, because git writes are not allowed. Main can keep them or restore them.

## 2. What renders

The screenshots and debug dumps are in `docs/design/fidelity/w1a/`: 33 PNGs plus `w1a-shots.json` and `w1a-dev-stations.json`. The viewport is 1600×900 and the WebGL runs use SwiftShader. **There were zero console errors and zero page errors on every page.** The only warnings are `[art] zone …: N referenced asset(s) have no manifest entry yet`, which is expected until the hero art lands. A1 also emits some SwiftShader "GPU stall due to ReadPixels" driver messages.

### /play/fixture-trig on WebGL (`trig-webgl-0{1..5}`)
- It boots the Expedition (`expedition-layout` and `phaser-host` are present), zone `z1_sunward`, segment `sunward_day`, 61 textures, about 65 draw objects.
- **Parallax**: 10 layers in one set, with scroll factors 0.04, 0.15×3, 0.35×2, 0.6, 1.3, 1 and 1. You can see the sky gradient, green sine-wave hills, colonnades of pillars at three depths, blue water ribbons, and a foreground band at alpha 0.7/0.25/0.12.
- **Character**: the Wren atlas is in the idle pose. A **gold disc with a cyan ring floats beside her head, and orange discs sit on her face and hand**. These are missing-asset placeholders for the companion (`orrery_terraces.companion.cog`) and the costume overlays. The same artefact is on every character in every game.
- **HUD**: the zone title "SUNWARD TERRACE" with the objective ring, "RHYTHMS 0/2", the ? and mute (N) buttons, and the cutscene SKIP. The intro has an in-world tutorial prompt, "A / D · walk to the beam pylon". The phase stays `intro` until the tutorial's `await_interact` is satisfied. That is by design, but a script that only presses Space will stall there.
- **Panel** (e1, scrub layout): the header reads "VESPER DIAL". The cards are UNIT CIRCLE, sin θ and cos θ (the cos θ card shows axes only, presumably because of `cosTier`). The θ scrubber has π ticks and a bracket readout, "0 < θ < π/2". Verify reads "ALIGN THE DIAL". World chips are live on the dial: "θ: 0 < θ < π/2", "sin θ: 0.93", "cos θ: 0.36" and the target "5π/6". **That confirms KA2's label-order fix works.** The value chip reads "0.93".
- **Dialogue bar**: the bottom band in panel material with a hex texture, the emblem, the instruction "Swing the carriage along the rail to 5π/6…" in large type, the sub-line, and the (i) hint button.
- **Defects** (screenshot `trig-webgl-05-scrub`):
  - The ? and mute HUD buttons overlap the "UNIT CIRCLE" card label.
  - The rail label "3π/2" overlaps the "cos θ: 0.36" chip.
  - Wren is cut off at the left edge in the panel framing.

### /play/fixture-trig?renderer=dom (`trig-dom-0{1..5}`)
- The DOM host (`dom-host`, `dom-layer`, `dom-player`) draws the same 10-layer parallax, 42 textures.
- The player is the flat DOM actor. The tutorial prompt "◆ E · Continue" shows.
- The panel is identical to the WebGL one: scrubber, cards, Verify and dialogue bar.
- **Defect**: the station snapshots (`snapshot-e1_radians`, `snapshot-e2_period`) render as **four generic gold/grey discs** instead of the Vesper Dial. The parts have no manifest entry, and the DOM host draws a placeholder disc for each part. KA2's baked snapshots exist as data, but they do not read as a dial.

### /play/fixture-trig?host=legacy (`trig-legacy-01`)
- The legacy dungeon renders ("The Clockwork Crypt": start, altar and door rooms, plus the mastery HUD). There is no `expedition-layout` and no `__GAME_DEBUG__.expedition`, and there are no errors. **This matches the legacy path byte for byte, as H2 claimed.**

### /play/fixture-cell-transport and /play/fixture-civil-rights-mystery (extra checks)
- **Cell** (`cell-webgl-*`): zone_a "GLYCOCALYX SHORE", 8 layers, and the GRADIENT meter at 12 %. The diver atlas has the same placeholder discs. The intro reaches `explore` on its own.
  - The e1 panel opens in the board layout with polar(d) and ΔG ion(d) graph cards, a CLAIMS card (A/B/C) and a d-probe scrubber.
  - **The station itself is the `claim_holders` placeholder**, a purple box with the debug text "claim_holders / specimen_pods".
  - **The graph y-axis ticks are stacked illegibly** ("0.8 0.6 0.4 0.2 0" and "40 30 20 10 0").
  - The HUD overlaps the "polar(d)" label.
- **Civil** (`civil-webgl-*`): s1_morgue "THE MORGUE", a dark interior with 5 layers. Nell, Ida and Otis are visible, with the "IDA" nameplate.
  - **The dialogue bar is fully exercised**: "IDA THE ARCHIVIST", with the typewriter mid-line at about 22 px or more.
  - The e1 panel (s2_courthouse): RECORD, FILE and CLAIMS cards and a YEAR scrubber ("JAN 1950").
  - **The CLAIMS card is clipped**: claim B's second line is cut and claim C is not visible at 900 px.
  - The world value chip is empty ("—").
  - The station is again the `claim_holders` placeholder ("witness_projector").
  - The HUD overlaps the "RECORD" label.

### /dev/expedition on WebGL and DOM (`dev-expedition-*`, `dev-station-*`)
- The WebGL dev world boots. It has 10 layers: meadow_day plus meadow_dusk at alpha 0, ready for the crossfade.
  - Vesper Dial, Ring Gate (Tidewheel Gate) and Membrane Router with cargo tokens and the eye all draw.
  - So do the Tonicity Sluices (cells, lock, wheel), the Switchboard (jack board, program sheet), the Big Board (canisters and catenary wires), the Tumbler Vault, the plaque and the NPCs (Otis, Brasswick).
  - **The KB2 and KC2 prefabs are visually verified here for the first time.**
  - `claim_holders` (e3) and `step_bridge` (e4) are still labelled placeholder boxes.
  - Textures drop from **94 to 64** on the zone swap (dev_meadow → dev_depths), which confirms H1's residency claim.
  - **Defects**: the NPC nameplate "OTIS" overlaps the interact prompt ("OTIS e the Tidewheel Gate console"). A translucent water band crosses the player's body in dev_depths.
- The DOM dev world boots: blockers, the `facade-router_hall` façade, and five snapshots, all drawn as placeholder discs.

## 3. Lane acceptance: what I checked, and what is unmet

| Lane | Verified by me | Unmet or partial |
|---|---|---|
| **V1** | Suite green. `loadWorldFor` resolves trig_demo_001, trig_platformer_001, cell_demo_001, history_mystery_001 and history_demo_001 by `sidecar_id` with **0 errors**. Warnings: trig 84 (R1×80, R11, W1, W2×2); cell 77 (R1×68, R6×2, R11, W1, W2×3, W3×2); civil 210 (R1×181, R6, W1, W2×6, W3×21). wave2_smoke_001 → null with a server warning. The C0 "probe key used twice" rule has been removed. | These are the self-reported partials: R16 does not check the cues in meta success/failure plans, and W3 skips L5 parallax. Minor: V1 says wave2 is skipped for R4, but the logged reason lists R2 issues (unknown speaker "warden"). |
| **H1** | Boots on WebGL, DOM and in the fallback, with zero errors. 5 or more layers with distinct scroll factors. Textures drop on the zone swap (94 → 64). Chips publish after the label fix. The HostEvent blocker is resolved (types.ts carries flag, sandbox_goal, cue and music, and the casts are gone). | DOM snapshots draw placeholder discs when parts have no asset. Labels do not avoid collisions (a nameplate over a prompt, a rail label over a chip). |
| **H2** | The dev-world flow passes on webgl and dom. Express passes. `?host=legacy` is the old client. play-platformer and play-mystery pass with `&host=legacy`. The client injects V1's `failLines`. | Mock-generated golden-path games still play legacy (sourceId mismatch, which needs a main decision). The `ExtraHostEvent` union is still in `ExpeditionClient.tsx`; it is now redundant. The duplicate `src/game/expedition/client/e2e/` has not been deleted. TouchPad, segment music and the SandboxPanel tray are still TODO(w1). |
| **P1** | Panel testids are present (`instrument-panel`, `widget-submit`, `panel-back`, `success-badge`, `widget-first-option`). Scrub and board layouts render. The scrubber is a role=slider. The dialogue pins show. | Nothing in the acceptance list is unmet. On legibility (the bible's projector rule), the board-layout CLAIMS card overflows at 900 px (civil e1), the graph y-ticks crowd on short cards (cell e1), and the HUD overlaps the first card label in every layout. |
| **S1** | The dialogue bar, emblem, (i) button, zone title h1, objective ring, meter, mute (N) and title card all render. Both earlier blockers are resolved: V1's `fail-line.ts` exists and is injected, and `scene/requirements.ts` re-exports `src/world/state`. | `station-dialogue.ts` still defaults to its own `defaultFailLines` (TODO(w1)). MapOverlay is not built (P2). |
| **A1** | `pnpm art:check` is clean. The asset-index test is updated. Missing assets only produce `console.warn`. | The missing-asset placeholder is **visible in play** as discs on character faces and hands and as companion stand-ins. It should render nothing, or only show under `?debug=1`. |
| **C0** | All three side-cars parse and resolve with 0 errors. Bindings match §4.1 (checked in each world.json). | The warning backlog above: R1 until the art lands, and W3×21 on civil. |
| **E1** | Two projects (webgl, dom). `helpers/expedition.ts` is present. The legacy specs are green. | `expedition-keyboard.spec.ts` is **still skipped** (8 tests). Its H1 blocker is stale: the dev world is at `/dev/expedition` and `/dev/expedition/client`, not the guessed `/play/fixture-dev-world`. `capture-scenes.ts` is now unblocked because all three worlds resolve, but I did not run it (it writes E-lane outputs). `shots.json` is still provisional. |
| **KA2** | The label bug is fixed and the chips are live on /play/fixture-trig. **/play/fixture-trig now boots the Expedition on e1 and e2 natively**, so the Gate V gap they reported is closed. | The DOM snapshots do not read as the dial and gate (placeholder discs). The hero art is empty, so everything is code-drawn stand-ins. |
| **KB2** | The Membrane Router (cargo, eye, lanes) and Tonicity Sluices (cells, lock, wheel, basins) render on /dev/expedition with plausible poses from `contraption()`. | None found. Hero art is KB4's job. |
| **KC2** | Their "cannot check visually" blocker is resolved. The Switchboard (jack board, program sheet) and Big Board (canisters, catenary wires, gauge) render on /dev/expedition dev_depths. | Hero art is KC4's job. |

## 4. Outside diffs

| Outside diff (lane) | Status |
|---|---|
| H1/H2: `src/game/hosts/types.ts` HostEvent + flag, sandbox_goal, cue, music | **Already applied.** H2's superset matches §2.10. Both hosts dropped their casts. |
| H2: `e2e/play-mystery.spec.ts`, `e2e/play-platformer.spec.ts` get `&host=legacy` | **Already applied.** Both pass. |
| H2/E3: copy dev-world.spec.ts to `e2e/expedition-client.spec.ts`, add `client` to EXPEDITION_SPEC_PATTERN | **Already applied.** The copy is byte-identical and runs on both projects. The source copy is not deleted yet (fix list). |
| A1: `tests/world-contract.test.ts` asset-index assertion | **Already applied** |
| C0: `tests/world-contract.test.ts` side-car assertions (getContraption, Zone.parse and Station.parse fixtures) | **Already applied** |
| C0: `src/world/validate-world.ts` drops the duplicate probe-key R5 rule | **Already applied**. No `probeKeys` set remains. |
| KA2: `ExpeditionScene.ts` opens the label frame before the controllers update | **Already applied**. Chips confirmed on screen. |
| S1 (optional): `scene/requirements.ts` re-exports from `src/world/state` | **Already applied** |

Main committed all of these as checkpoint `f57d701` ("W1 integration…") while this run was in progress. None of them conflict. For HostEvent, H2's version is a superset of H1's, so it was the right one to keep. **I applied nothing new, and there were no trivial fixes to make**: typecheck, tests, lint and build were all already green.

## 5. Prioritized fix list for main

| # | Severity | Owner (path) | Problem |
|---|---|---|---|
| 1 | high | KA (L6), `src/game/hosts/expedition/contraptions/prefabs/{claim_holders,step_bridge}/**` | `claim_holders` and `step_bridge` still render the purple debug placeholder with raw ids. That placeholder is the **first station of cell (e1_bilayer) and civil (e1_brown)**, plus trig e3, e4 and e5, cell e3, e4, e7 and e10, and civil e2, e4 and e9. KA3 has to land these before Gate V shots of anything but trig z1. |
| 2 | high | A1 (L5), `src/game/art/manifest-loader.ts` / `src/game/expedition/puppets/**` | Missing costume and companion assets draw visible gold and orange discs on every character's face and hand, and a stand-in disc for the companion. In a non-debug run a missing overlay should draw nothing (keep the `console.warn`). Content lanes C1–C3 supply the real assets. |
| 3 | high | E2/E3 (L10), `e2e/expedition-keyboard.spec.ts` | The F9 keyboard spec is still `test.skip` (8 tests). Point it at `/dev/expedition/client` (the dev world has a station for each control kind) and use the real testids (`instrument-panel`, `scrubber`, `widget-submit`). |
| 4 | high | P1 (L3), `src/game/expedition/panel/**` | In the board layout at 1600×900, the CLAIMS card clips (civil e1: claim B cut, claim C off-card). Scroll the card within itself, or compact the graph cards, so every option is reachable and visible. |
| 5 | medium | H1/H3 (L2), `src/game/hosts/expedition/dom/**` | DOM snapshots draw placeholder discs for parts with no manifest entry. The DOM fallback should rasterise the prefab's code-drawn stand-in, or show a single labelled silhouette per station. |
| 6 | medium | H3 (L2), `src/game/expedition/client/ExpeditionLayout.tsx` (or S1 `hud/**`) | The top-right HUD (? and mute) overlaps the panel's first card label (UNIT CIRCLE, polar(d), RECORD) in every panel layout. Move the HUD cluster left of the panel's safe rect while the panel is open. |
| 7 | medium | P1 (L3), `src/world/graph-math.ts` + graph card | Y-axis ticks collide on short cards (cell e1: "0.8/0.6/0.4/0.2", "40/30/20/10"). Choose the tick count from the card's pixel height, with at least 18 px of text per tick. |
| 8 | medium | H1/H3 (L2), `src/game/hosts/expedition/labels/**` | There is no label collision handling. An NPC nameplate covers the interact prompt ("OTIS" over "Use the Tidewheel Gate console"), and the rail label "3π/2" covers the "cos θ" chip. Give prompts priority and nudge or hide the lower-priority labels. |
| 9 | medium | A2 + C1–C3, `art/<ns>/zones/**`, `fixtures/worlds/*.world.json` layer alphas | The foreground L5 ribbons (scroll 1.3, alpha 0.7) and the translucent water bands cross the player's body (civil morgue, dev depths), so the player reads as underwater. Lower the alpha or push the ribbons below the feet line. |
| 10 | medium | main | Mock-generated golden-path specs (src_… sourceId, extra mx_* encounters) still play legacy. This needs the pipeline, V1 and content keying decision H2 flagged. |
| 11 | medium | E3 (L10), `scripts/capture-scenes.ts`, `docs/design/fidelity/shots.json` | Capture is now unblocked: all three side-cars resolve and `__GAME_DEBUG__.expedition` is ready. Run it and replace the provisional shot ids with the real station ids. |
| 12 | low | E (L10), `playwright.config.ts` | `baseURL` and `webServer` are pinned to :3100. When the shared server is down, a second `next dev` in the same directory is refused. Honour an env override (e.g. `EXPEDITION_E2E_URL`) in the root config, as the H2 sub-config already does. |
| 13 | low | H3 (L2), `src/game/expedition/client/ExpeditionClient.tsx`, `src/game/expedition/client/e2e/` | Drop the now-redundant `ExtraHostEvent` union (HostEvent carries flag, sandbox_goal, cue and music). Delete the duplicate `client/e2e/` spec and config, since `e2e/expedition-client.spec.ts` runs on both projects. |
| 14 | low | S1/F (L4), `src/game/expedition/dialogue/station-dialogue.ts` | Make V1's `failLines` the default instead of `defaultFailLines` (TODO(w1)), so there is one implementation of §2.5.4. |
| 15 | low | C1–C3 content | Validation backlog: R1 (missing asset keys; trig 80, cell 68, civil 181) clears as the art lands. Civil W3×21 (props outside their footprint or frame) and R6 on cell and civil should be triaged. |
| 16 | low | KC3 (L8), `prefabs/{oracle_ticker/skins/wire_ticker,tumbler_vault/skins/tumbler_vault}.ts` | These are still labelled boxes (TODO(w1)). Already scheduled for KC3. |
| 17 | low | V1 (L1) | The report says wave2_smoke_001 is skipped for R4, but the logged reason is R2 (unknown speaker "warden"). Align the report or the test wording. |
| 18 | low | KA / C1, trig e1 config | Trig e1's cos θ card shows axes with no curve. Confirm this is the intended `cosTier` reveal and not a missing series. |
