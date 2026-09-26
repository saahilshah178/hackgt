# 11 · Game Design Document: **The Living Gate** (cell transport)

> Showcase fixture: `fixtures/cell-transport-dungeon.json` (`id: cell_demo_001`, title "The Membrane Vault", 11 encounters).
> Fidelity target: Triseum *Variant: Limits* (frames `images/3.png` … `images/10.png`), as translated in
> `docs/design/01-variant-design-bible.md` (the **bible**). Runtime seams: `docs/design/00-runtime-map.md` (the **map**).
> Art pipeline: `docs/design/02-assets-and-art-pipeline.md` (the **pipeline**). Mode contracts: `docs/overnight/wave1-modes.md`.
>
> **The player-facing title is "The Living Gate".** The fixture's `title` ("The Membrane Vault") stays as it is; the
> world overlay (§9.3) carries the display title. Nothing in this document changes a fixture byte, a mode's
> `grade()`, or a contract in `src/contracts/`. Where the current widget input can't express a contraption, §5 says
> exactly what the extended *view/draft* needs, and grading always stays in the mode.

**Who implements from this doc:**
- **Artist agents:** §2 (layers, palette) and §7 (asset list, with sizes and drawing specs).
- **Engine agents:** §2.5 (scene coordinates), §5 (live bindings, pose formulas, success and failure timelines) and §5.0 (the shared contraption rules).
- **Content agents:** §3, §4 and §6 (characters, every dialogue line, lore) and §9.3 (the overlay JSON shape).

---

## 0 · At a glance

| | |
|---|---|
| Genre shell | Painterly 2.5D side-view expedition (the bible's `Expedition` host, replacing the dungeon host for this fixture) |
| Biome | **The Membrane Frontier**: the outer surface of cell V-7. The ground is a literal cross-section of the phospholipid bilayer, the sky is extracellular fluid, and the cytoplasm glows under your boots. After e10 the player is carried inside, and the sky becomes the amber **cytoplasm sky** |
| Protagonist | **The Diver**, crew member of the shrunken submarine *Halcyon* (shared protagonist, re-costumed with a bubble helmet and a probe-staff) |
| Guide | **Pilot Ora** (fixture character `pilot`, `cheerful_sidekick`), speaking from the *Halcyon*. Her in-world companion is **Pip**, a teardrop mini-sub drone |
| Antagonist / boss | **The Gatekeeper** (fixture character `gatekeeper`, `gruff_guard`), the oldest pump protein in the cell, squatting on the road to the nucleus |
| Purpose | The **Stillness** has frozen every transport protein, and the cell's gradients are draining toward equilibrium, which for a cell means death. Restart all 11 gates, push the **Gradient Meter** from 12 % to 100 %, and open the Nuclear Pore |
| Scenes | 8 (S1–S8) in 4 zones: Shore → Tide Basins → Pump Hall → Cytoplasm |
| Encounters | 11, in fixture order. Six use Scrub mode with an orange scrubber (e1, e3, e4, e7, e8, e10) and three use Board mode (e2, e6, e11). The two Sluice encounters (e5, e9) use a timed Scrub layout |
| Instrument cards | **Gradient cards** (concentration vs the scrubber variable), **Volume card**, **ATP card** (gold), **Membrane cross-section cards**, **Charge ledger** |
| Colour law | **white = outside** (extracellular), **green = inside** (cytoplasm), **blue = water / volume**, **gold = ATP**, **orange = your input, nowhere else** |
| Art assets | **204** files (§7.11): 182 authored SVG and 22 sourced Kenney frames |

---

## 1 · Pitch and purpose

### 1.1 Pitch (3 sentences)
*The Living Gate* is a painterly side-view expedition across the surface of a living cell. You are the Diver of the
shrunken submarine *Halcyon*, walking a landscape made of the phospholipid bilayer itself while the cytoplasm glows
through the ground beneath your boots. Every gate in this membrane is an ancient transport machine that the Stillness
has frozen. You restart each one by setting it to its true rule (which molecules it admits, which way they flow, and
what it costs) and watch the world move under your hands. Then you ride the membrane itself into the cell and outwit
the oldest pump alive to wake the nucleus.

### 1.2 What is broken and what is at stake
- **Broken.** A living cell survives *because its inside is different from its outside*: more K⁺ inside, more Na⁺
  outside, the right amount of water and fuel in the right places. Those differences are **gradients**, and transport
  proteins maintain them. The **Stillness** has seized every gate in cell V-7. Its pumps have stopped, its channels have
  locked, and a stretch of its membrane has even frozen rigid.
- **At stake.** Without working pumps the gradients slowly dissipate. This is the fixture's own boss source quote
  (e11 `sourceRef`, p. 3): *"If a cell runs out of ATP, its pumps stop and the gradients they maintain slowly
  dissipate."* When the Gradient Meter reaches 0 %, inside equals outside. **Equilibrium sounds calm, but for a cell it is
  the end.** The nucleus has sealed itself behind the Gatekeeper to wait it out.
- **What the player restores.** Each gate the player restarts re-establishes one flow and lights one **gradient
  conduit**, a glowing line running along the membrane toward the Nuclear Pore (the Variant beam network, frame 3).
  The Gradient Meter climbs from **12 % to 100 %** (the table in §6.2). The world visibly re-saturates, and the ambient
  particles separate again: coral Na⁺ motes crowd the sky and violet K⁺ motes crowd the cytoplasm below. At the end the
  Nuclear Pore's rings turn open.

### 1.3 Why the concepts are the only way through (the education *is* the mechanism)

No gate asks a question. Each gate is a machine whose working state is the concept, so knowing the concept is simply
knowing how to set the machine. A wrong idea never costs points. It makes the machine do the wrong physical thing, in
plain view.

| Enc | What is physically blocking the way | Why only the concept moves it | Traversal payoff |
|---|---|---|---|
| e1_bilayer | A **Stiff Ridge**: membrane frozen rigid (gel-phase) into a wall | The ridge thaws only when the Mimic's "rigid wall with holes" story is quarantined. Proving the membrane is fluid makes it flow | The ridge melts into a ramp; walk over it |
| e2_selectivity | The **Crossing Gate's** arch is shut | The gate cycles only when every molecule is routed by polarity and charge (oil road vs protein gate) | The arch opens and a carrier rocker tilts into a ramp up to the next terrace |
| e3_diffusion | The **Balance Lock**, a gold beam barrier weighed by the dye tank | The beam levels only at equilibrium, which random motion alone produces once the purposeful-particle lie is gone | The beam lifts like a boom barrier |
| e4_osmosis | The upper ledge is 2 H up, with a dry raft lock | Water rises into the raft lock only by osmosis toward the salted side, and salt never moves | Ride the raft up |
| e5_tonicity | A flooded **sluice trench** | It drains only when each lock's bath is labelled by solute relative to the cell | Steps emerge from the water; climb out |
| e6_facilitated | The Pump Hall's revolving **Carrier Door** | The door turns only when cargo is split by gradient direction, not by protein presence | The door carries you (and Sucra) inside |
| e7_active | A dark hall with an unpowered gantry | The lanterns ignite once the "pumps only speed up downhill flow" lie is gone | Ride the gantry lift up |
| e8_pump | The **Hall Gate** is chained to a dead Na⁺/K⁺ pump | The pump cycles only when it is wired 3 Na⁺ out, 2 K⁺ in, 1 ATP. Its crank lifts the gate | Walk under the lifted gate |
| e9_osmosis_review | A barge sits in a low canal | The lock fills only when every cell's water direction is called right | The barge rises to the Endocytosis Pit |
| e10_bulk | No channel is big enough for the *Halcyon* | The membrane must swallow you: touch → fold → pinch → carry, in order | **You are the cargo**: ride the vesicle into the cell |
| e11_boss | The **Gatekeeper** sits in front of the Nuclear Pore | His three maws accept only cargo sorted by direction and polarity | He turns aside; the pore opens; the finale |

---

## 2 · World and biome

### 2.1 The biome concept: the membrane is the ground

The side-view camera looks at a **cross-section of the membrane**. The walkable surface is the top of the outer leaflet: a
rolling cobbled road of round cream **lipid heads**. Below it, the band shows each phospholipid as a tiny pillar with
**twin gold tails**, the bible's "membrane colonnade" read sideways. At the band's centre a navy inlay line (the
**oil seam**, the hydrophobic core) runs the length of the world, and the inner leaflet mirrors the outer one beneath it.
Below the band, the warm amber cytoplasm glows, with the silhouette of the nucleus far away: **the destination is always
in view, under your feet.**

- **Sky (zones A–C):** extracellular fluid, called "the Tide": pale aqua to cream, with drifting solute motes and
  sun-caustics.
- **Big architecture:** transport proteins drawn as the bible's "ancient tech", with cream stone bodies, gold trim,
  navy inlay bands, concentric rings, and gates *set into the ground band* that span the bilayer from above to below.
- **Zone D (after e10):** the player is inside. The camera now shows the membrane as a luminous **ceiling** band at the top
  of the frame, and the sky becomes the **cytoplasm sky** (coral-amber), with organelles as distant domes and cliffs.

**Screen composition at 1920×1080 (zones A–C):**

| Band | y range (px) | Content |
|---|---|---|
| Sky + far layers | 0 – 713 | L0–L3 parallax |
| Walk line (top of the heads) | **y = 713** (0.66 H_screen) | player feet, consoles, contraption bases |
| Bilayer band | 713 – 921 (208 px) | outer heads 44 px · outer tails 56 px · oil seam 8 px · inner tails 56 px · inner heads 44 px |
| Cytoplasm glimpse | 921 – 1080 | amber gradient, parallax 0.35 organelle silhouettes, K⁺ motes |

The protagonist's height **1 H = 173 px** (16 % of the screen), about 4 lipid heads tall. Scale ladder (bible §5.1):
console 0.7 H, pod 1.1 H, Crossing Gate 2.2 H, Carrier Door 2.4 H, Na⁺/K⁺ pump 3.5 H, Gatekeeper 6 H, Nuclear Pore
5.5 H (it bleeds off the top of the frame).

**Scientific stylization notes** (these go on the credits/lore screen so teachers aren't surprised):
- Lipid heads are drawn about 4× larger relative to the protagonist than true scale.
- **Cholesterol** is drawn as teal crystal studs among the heads. Real cholesterol is not crystalline in membranes; the
  shape is stylized, but its position (wedged between lipids) is right.
- The Gatekeeper is a fictional pump. Real nuclear pores are different gates, and Ora says so in line `s7_walk3`.

### 2.2 Palette: the bible palette adapted to the cell

The UI palette is the bible's §2.3, **unchanged**. The world tokens below re-map the bible's §2.1 to biology. The rule
holds: there is no pure black. The darkest world colours are the Pump Hall ceiling `#3E3240` and the seam shadow `#22385A`,
both above the checklist floor `#1E2A33`. Orange never appears on a world surface except on bound values.

| Token | Hex | Bible source | Used for |
|---|---|---|---|
| `lipid.head.lit` | `#FBF1DE` | stone.lit | lit upper-left of each head |
| `lipid.head` | `#F2E3C6` | stone.base | head body |
| `lipid.head.shade` | `#D9C3A0` | stone.shade | head underside, contact shade |
| `lipid.tail.hi` | `#F6D27A` | gold.hi | tail highlight stripe |
| `lipid.tail` | `#D9A441` | gold.base | tail body |
| `lipid.tail.deep` | `#A8782E` | gold.deep | tail shadow side |
| `oil.seam` | `#27466A` | inlay.navy | the hydrophobic midline, inlay bands on proteins |
| `oil.seam.dark` | `#22385A` | inlay.navy.dark, lifted | seam shadow (lifted from the bible's `#1B3150` so no world pixel is darker than the checklist's `#1E2A33`) |
| `protein.stone` | `#F2E3C6` / `#D9C3A0` | stone | transport-protein bodies |
| `protein.ring` | `#6E4A2E` | bronze.ring | pore rings, node rings, sockets |
| `gel.frost` | `#DCE8EA` | new | frozen (gel-phase) heads, desaturated plus a frost rim |
| `glycan.blue` / hi | `#5A95D6` / `#8CC0EE` | foliage.blue | sugar-chain trees (glycocalyx) |
| `glycan.salmon` / hi | `#E48C5E` / `#F4AE80` | foliage.salmon | sugar-chain trees, warm variety |
| `glycan.rust` | `#C4643C` | foliage.rust | bead tufts |
| `cholesterol` hi/base/shade | `#C9F3FF` / `#6ED2F2` / `#2E8FC0` | crystal.* | cholesterol studs among the heads |
| `tide.shallow` | `#8FE0EA` | water.shallow | basin water highlights |
| `tide.deep` | `#4CB6D0` | water.deep | basin water body |
| `cyto.glow` | `#F6C48E` | new | cytoplasm glimpse under the band |
| `cyto.deep` | `#D98A6A` | new | cytoplasm shadow, organelle silhouettes |
| `mito.coral` | `#E7836F` | new | mitochondria domes (zone D) |
| `atp.gold` | `#F6D27A` core `#FFF6D8` | gold.hi | ATP sparks, energy cards, lit gold rails |
| `wisp.indigo` | `#6A6CF0` | wisp.indigo | insight shards (collectibles only) |

**Molecule colours** (fixed across the world and the panel tokens, so a glyph is recognisable everywhere):

| Molecule | Colour | Glyph |
|---|---|---|
| O₂ | `#8CC0EE` sky blue | two fused circles |
| CO₂ | `#A9C3BF` grey-teal | three fused circles, dark centre |
| Na⁺ | `#EE8A9A` coral pink | sphere with a white "+" |
| K⁺ | `#9C82E0` violet | larger sphere with a white "+" |
| Cl⁻ | `#7FD6B0` mint | sphere with a white "−" |
| H⁺ (proton) | `#F7F0A0` pale yellow | tiny sphere with a "+" |
| Glucose | `#F6E3B4` cream, `#D9A441` outline | hexagon ring with a tail bead |
| Steroid hormone | `#E6B85C` amber | four fused rings (3 hexagons and a pentagon) |
| Water | `#4F92E6` (= `fn.h` blue) | teardrop droplet |
| Dye | `#D46BA8` magenta-rose | soft dot |
| Salt | `#FFFFFF` @ 85 % | small cube, lit top face |
| ATP | `#F6D27A` with a white core | four-point spark |

> **Deviation from bible §7.2, recorded on purpose.** The bible puts the ATP gauge in `ui.accent` orange. Orange is
> reserved for player input (bible §2.3 rules), and ATP is spent by the machine, not chosen by the player. So ATP is
> **gold** everywhere: in the world (gold rails glow when ATP flows) and in the panel (the ATP card has a gold tab and
> gold curve). That also gives "ancient tech gold trim" a meaning in this biome: **gold is energy.**

### 2.3 Parallax layers (per zone)

Layer factors follow bible §5.2. Every layer is tileable horizontally, in 2048-px segments with seamless edges.

| Layer | Factor | Zone A: Shore (S1–S2) | Zone B: Tide Basins (S3–S4) | Zone C: Pump Hall (S5–S6) | Zone D: Cytoplasm (S7–S8) |
|---|---|---|---|---|---|
| **L0 Sky** | 0.0 | 4-stop gradient `#CFE9EC` → `#DCEFEA` → `#EAF2E6` → `#F4EEDF`, soft lighter cloud bands of fluid swirl at 8 % white | `#BFE3E6` → `#D7EBE2` → `#EFE3D0` → `#F2D9C2` (afternoon peach haze) | S5 interior: vault ceiling gradient `#3E3240` → `#5A4146` → `#7A5646`, gold light pooling from below. S6 exterior pit-dusk: `#A9C9D6` → `#C7C6D4` → `#E6C9C2` → `#F2D2B8` | S7 cytoplasm: `#E9A98E` → `#F0BC98` → `#F3C7A2` → `#FAE3C2`. S8 nuclear vault: `#7E6AB8` → `#A488D0` → `#C9A0DE` → `#F2B8D4` |
| **L1 Far** | 0.15 | **Tissue horizon**: neighbouring cells as huge pale rounded domes (`#B9D6D3` at 60 % haze toward sky), with collagen **fibre cables** crossing the sky as thin white-cyan lines (the Variant beam lines, frame 6) | **Tide cliffs**: rounded stacked-dome cliffs `#A9CFCB`, glycan groves as blurred blobs, collagen cables | Interior: a great **ribbed vault wall** with three ring windows (concentric bronze rings, glass `#F6C48E` glow) | **Organelle skyline**: nucleus dome (right, huge, `#C98BB0` with ring pores), a stacked Golgi of curved cream plates, capsule mitochondria (`mito.coral`) with navy cristae stripes, and ER ribbon cliffs |
| **L2 Mid-far** | 0.35 | **Glycan forest** silhouettes: sugar-chain trees (a trunk of stacked beads, branching into hexagon-bead crowns) in `glycan.blue` and `glycan.salmon`, two-tone lit/shade, 20 % haze | **Dormant channel towers**: ruined protein towers, desaturated, with dark ring tops | Hall pillars (cream, navy capitals) and the far **Nerve Beacon** tower (a stylized neuron: a star-shaped soma with a long axon cable) | **Cytoskeleton arches**: microtubule aqueducts (cream tubes with navy ring bands) arching across |
| **L3 Mid** | 0.6 | **Colonnade Rise**: the membrane swelling into a hill (the bilayer band curving up), **cholesterol studs** (teal crystal wedges) poking up between the heads, glycan saplings | Basin walls (cream stone, gold rims), waterfalls of tide water (two scrolling bands) | Gold ATP rails, pipes and gauge-dials on the hall walls | Vesicle traffic (small bubbles drifting along rails), a ribosome cluster (bead pairs) |
| **L4 Play** | 1.0 | ground: bilayer road; contraptions; consoles; NPCs; player | same + basins / sluice trench | hall deck (the bilayer road inlaid with navy bands) | microtubule causeway (the floor) + the membrane ceiling band at y 0–120 |
| **L5 Fore** | 1.3 | glycan fronds and floating sugar beads, 2 px blur, 70 % alpha, darker `#4F8F85` | bubbles strip, reed-like glycan fronds | hall balustrade (cream posts, navy rail cap, round emblem post) | fine actin filaments (thin salmon lines), drifting vesicles |
| **L6 Light** | 1.0 | water **caustics** overlay (multiply-blue 20 % plus add-white 12 %), slow drift. **God rays** from the upper left | caustics + god rays, warmer | gold **lantern pools** (additive radial) that turn on as the hall re-powers | warm motes; soft vignette `#D98A6A` at 25 % |

### 2.4 Time of day, weather, particles, ambient motion

- **Time of day** = **tide-light**, a progression of colour temperature (bible §5.3): Shore is bright morning, Basins
  afternoon, the Pump Hall lantern-lit, the Pit dusk, the Cytoplasm warm amber, and the Nuclear Vault violet
  finale. The colour shift is the progress bar you feel.
- **Weather** = currents. Every 20–40 s a soft **tide current** passes: L5 fronds lean +6° for 2 s, motes streak, and
  glycan trees sway ±3°. After e10, inside, the weather is **cytoplasmic streaming**: slow conveyor drift of motes
  along the rails.
- **The ambient particle system *is* the Gradient Meter.** With gradient G ∈ [0, 1]:
  - motes above the ground: Na⁺ `n = round(30·(1 + 0.8·G))`, K⁺ `round(30·(1 − 0.8·G))`;
  - motes in the cytoplasm glimpse: the same counts with Na⁺ and K⁺ swapped;
  - mote random-walk step σ = `1.2 + 1.8·G` px/frame, alpha `0.35 + 0.5·G`.
  At the start (G = 0.12) the two sides look almost the same and the motes are dim and sluggish. At the end they are
  crowded, bright and restless.
- **Ambient motion** (always on, cheap): lipid heads jitter ±1.5 px at 2 Hz with per-head phase, which is the membrane's
  fluidity made visible (except on the Stiff Ridge, which is dead still). Pip bobs ±6 px at 0.5 Hz. Dormant gates don't
  move. Restored gates idle-rotate their rings at 4°/s. Conduits pulse (alpha 0.6 → 1.0 at 0.8 Hz), with a light packet
  running along them every 3 s toward the Nuclear Pore.
- **Dormancy.** Every unsolved contraption is desaturated −40 % (ColorMatrix) with no glow. Solving it re-saturates it
  over 600 ms. That is bible checklist item 6.

### 2.5 Scenes (8), in order

World units are px at 1080p. The x ranges are cumulative, so the engine can lay the scenes out as one long strip, or as
separate scene chunks joined by fades (only at S6→S7, the vesicle descent). **Every contraption physically blocks the
path until solved** (this fixes map D7).

| Scene | Zone | World x | Encounters (console x) | Vertical move built by a puzzle |
|---|---|---|---|---|
| S1 Glycocalyx Shore | A | 0 – 3200 | none (intro) | a jump tutorial over glycan roots |
| S2 The Colonnade Rise | A | 3200 – 7400 | e1_bilayer (4300), e2_selectivity (6300) | e1 ridge → ramp; e2 carrier rocker → +1 H terrace |
| S3 The Dye Flats | B | 7400 – 11800 | e3_diffusion (8500), e4_osmosis (10500) | e4 raft rides up +2 H |
| S4 The Tonicity Sluices & Threshold Yard | B | 11800 – 15800 | e5_tonicity (12600), e6_facilitated (14900) | e5 drained steps +1.5 H; e6 the door carries you |
| S5 The Pump Hall | C (interior) | 15800 – 20000 | e7_active (16700), e8_pump (18700) | e7 gantry lift +2 H; e8 hall gate lifts |
| S6 The Return Sluice & Endocytosis Pit | C (exterior dusk) | 20000 – 23600 | e9_osmosis_review (20800), e10_bulk (22900) | e9 barge +2 H; e10 vesicle descends −4 H into the cell |
| S7 The Vault Road | D | 23600 – 26200 | none (traversal, lore) | microtubule causeway climb (moving rail platforms) |
| S8 The Nuclear Vault | D | 26200 – 29200 | e11_boss (27400) | the pore opens; walk in (finale) |

#### S1 · Glycocalyx Shore (intro, zone A)
- **What the player sees.** The *Halcyon* (a brass-and-cream teardrop submarine with a round porthole, 2.2 H long) sits
  docked on a mooring of sugar-chain roots at the far left. The ground is the bilayer road. **Glycan trees** (2–4 H,
  blue and salmon, their crowns made of hexagon sugar beads) line the path. Far off to the right, the **Colonnade Rise**
  swells up. Beneath the ground, the cytoplasm glows, and the nucleus silhouette sits on the far lower right. Three
  **dark conduits** run along the seam line toward it. Motes drift dimly.
- **Contraptions.** None. There is one dormant **seal node** at x 2900 (a bronze ring with a grey glass core). Pressing E
  on it opens the **Cell Chart** map for the first time (§6.4).
- **NPCs.** Ora, on comms and in the dialogue bar. Pip detaches from the sub (a small cutscene), and the intro plays here
  (§4.2).
- **Side content.** Lore plaque **P1 "The Two Faces"** at x 1400, on a cream post. It sits up a small glycan-root ledge
  (a jump tutorial).
- **Exit.** The path slopes up to S2.

#### S2 · The Colonnade Rise (zone A)
- **What the player sees.** The bilayer road rises into a hill, with cholesterol studs glinting teal between the heads.
  At x 4600 the road is blocked by the **Stiff Ridge**, a 1.4 H hump of membrane frozen into a hex-packed, frosted, dead
  still block (`gel.frost`, no jitter). Beside it, three **Specimen Pods** stand on pedestals with the console. Past
  the ridge is the **Crossing Yard**. There, the **Crossing Gate** (a channel protein, its arch 2.2 H above ground and
  its ring body continuing down through the bilayer band) spans the path. The **Oil Road**, a patch of bare heads ringed
  by a navy inlay circle, sits to its left. Molecules drift above in the tide.
- **Contraptions.** e1 **Specimen Pods at the Stiff Ridge** (§5.1), then e2 **Membrane Router at the Crossing Gate** (§5.2).
- **NPCs.** **Sucra** (glucose courier) is at the Crossing Yard, knocking on the heads. She is escorted through the
  Crossing Gate after e2, and reappears in S4.
- **Side content.** Lore plaque **P2 "Why Oil Says No"** hides behind the Crossing Gate, on a cholesterol-stud ledge
  that is reachable only after the carrier-ramp payoff.
- **Exit.** The carrier-rocker ramp climbs to the upper terrace (+1 H), and a gentle slope leads down into zone B.

#### S3 · The Dye Flats (zone B)
- **What the player sees.** Flat basin country. At x 8900 the **Dye Tank**, a long glass tank (4.5 H × 1.8 H) split by a
  membrane window, sits in a basin. The **Balance Lock**, a gold beam on a cream pillar, is chained to floats in each
  chamber and lies across the path like a boom barrier. Past it is the **Osmometer Basin**: a glass basin holding the
  round **Test Cell** in a salt bath, next to the dry **Raft Lock** shaft (3 H tall), with a raft at its floor and the
  upper ledge above.
- **Contraptions.** e3 **Specimen Pods + Dye Tank / Balance Lock** (§5.3), then e4 **Specimen Pods + Osmometer Basin / Raft
  Lock** (§5.4).
- **NPCs.** None. This is the "science bench" zone, and Ora is at her most talkative here.
- **Side content.** Lore plaque **P3 "The Jittering Grains"** sits on the upper ledge, reached by the raft.
- **Exit.** The upper ledge leads to S4.

#### S4 · The Tonicity Sluices & Threshold Yard (zone B)
- **What the player sees.** The path drops into a **flooded sluice trench** (1.5 H deep). A canal runs across the scene
  with one **Label Lock** (a lock chamber with a big bronze valve wheel above it) and three **holding basins** labelled
  HYPO / ISO / HYPER on cream plaques, plus an unlabelled **Eddy**. **Poro**, the aquaporin keeper (an hourglass-waisted
  stone statue with sleepy eye-glyphs), stands at the lock. At the far end (x 14,500–15,800) is the **Threshold Yard**:
  the Pump Hall's great revolving **Carrier Door** (2.4 H), flanked by the **Glide Gate** at the foot of a downhill ramp
  and the small gold **Pump Gate** atop an uphill ramp.
- **Contraptions.** e5 **Tonicity Sluices** (§5.5), then e6 **Threshold Router / Carrier Door** (§5.6).
- **NPCs.** Poro (lore: water channels). Sucra returns at the Threshold Yard and rides the Carrier Door with the
  player.
- **Side content.** The **secret: the Plant Cell Garden** (§6.5). It is an upper-left alcove, reachable only by the side
  stair that the drained trench reveals, and holds an insight shard.
- **Exit.** The Carrier Door turns and carries the player into S5.

#### S5 · The Pump Hall (zone C, interior)
- **What the player sees.** A long vaulted interior inside a giant protein complex. It is dark except for dormant gold
  rails, with ribbed walls, ring windows, and the far **Nerve Beacon** visible through the windows. The **Uphill
  Flume** (e7) sits on the lower floor: a **Low Tank** on the left and a **High Tank** on the right, 1.2 H higher, with a
  pump between them and a leak channel. Twelve dark **ATP lanterns** line the walls, and a **gantry lift** waits on gold
  rails. On the upper **pump deck** (+2 H) stands the **Na⁺/K⁺ pump**, 3.5 H tall, spanning the deck floor. Its cable
  sockets have been pulled, and its crank is chained to the **Hall Gate**.
- **Contraptions.** e7 **Specimen Pods + Uphill Flume** (§5.7), then e8 **Pump Rewiring** (§5.8).
- **NPCs.** **Kay**, the K⁺ lamplighter, with the lantern micro-quest (§6.3).
- **Side content.** Three hidden dark lanterns (Kay's quest). Lore plaque **P4 "The Lopsided Engine"** is on the pump
  deck.
- **Exit.** Under the lifted Hall Gate and out to S6.

#### S6 · The Return Sluice & Endocytosis Pit (zone C, exterior dusk)
- **What the player sees.** Back outside at dusk: the sky is pink-grey and the conduits glow brighter against it. There
  is a low canal with the **Barge Lock** and the second **Label Lock**. On the upper level sits the **Endocytosis Pit**,
  a shallow dimple in the membrane ringed by a lattice of cream-and-gold **clathrin triskelions**, with a gold
  **dynamin collar** hanging above it from a cream gantry. The *Halcyon* descends from the sky and settles into the pit.
  The **Clathrin Ferryman** stands at the Lift's frame.
- **Contraptions.** e9 **Return Sluice** (§5.9), then e10 **Endocytosis Lift** (§5.10).
- **NPCs.** The Ferryman.
- **Side content.** Lore plaque **P5 "Doors Made of Door"** stands at the pit rim.
- **Exit.** **The vesicle carries the player down through the membrane into the cell** (the camera descends 4 H and the
  sky crossfades to the cytoplasm sky).

#### S7 · The Vault Road (zone D)
- **What the player sees.** Inside the cell. The membrane is now a luminous ceiling band (heads pointing down), with the
  conduits the player lit shining *through* it from above. The **cytoplasm sky** is amber and coral. Mitochondria domes,
  Golgi stacks and ER cliffs sit in parallax, and the **nucleus** is huge on the right. The floor is a **microtubule
  causeway** of cream tubes with navy bands, plus **moving rail platforms** (vesicles on tracks) that carry the player
  up 2 H across a gap. It is a short, beautiful traversal with no puzzle.
- **NPCs.** Sucra waves from a passing vesicle ("Carried! Politely!").
- **Side content.** An optional high rail leads to a view point where the camera pans across the whole organelle
  skyline (the "wow" frame for the demo).
- **Exit.** The Nuclear Vault courtyard.

#### S8 · The Nuclear Vault (zone D, finale)
- **What the player sees.** A cream stone courtyard under a violet sky. The **Nuclear Pore** (5.5 H) is the hub gate
  (Variant frame 3): an eight-spoked outer ring, a counter-rotating inner ring and a central plug, with 11 conduit
  sockets around its rim, lit or dark according to the gates restored. In front of it sits **the Gatekeeper** (6 H),
  with three maws at chest height, a great eye-ring, and a gold ATP pipe running up its back. Cargo floats in an eddy
  before him.
- **Contraptions.** e11 **The Gatekeeper** (§5.11), then the finale (§4.5).
- **NPCs.** The Gatekeeper. Ora is on comms.
- **Exit.** Walk into the pore, then EndScreen.

---

## 3 · Characters

### 3.1 Protagonist: the Diver
- **Who.** The *Halcyon*'s diver. The Diver is the only crew member who leaves the sub, and never speaks (the player's
  voice). The display name is set by the overlay (`protagonist.name`, default "Diver"). The protagonist is **shared
  across all three showcase games** (bible §6.3) and re-costumed per biome.
- **Base art (v1, per pipeline §3b).** Kenney `toon-characters` **Female adventurer** frames (`character_femaleAdventurer_*.png`,
  96×128, HD 192×256). Use the HD set at scale 0.9, which makes 1 H = 173 px. Tint `0xFFF4E6` (a warm lift toward the
  painterly backgrounds).
- **Biome costume (SVG overlays that follow a head/back anchor per frame, with anchors in the manifest):**
  - **Bubble helmet**: a clear sphere, 88 px, fill `#C9F3FF` @ 22 %, a lit rim arc `#FFFFFF` @ 70 % at the upper left,
    a gold `#D9A441` neck ring 6 px, and a small navy `#27466A` air-valve nub on the back.
  - **Tide scarf**: an aqua `#4CB6D0` scarf with a `#8FE0EA` stripe, trailing 3 segments that lag behind the motion
    (a spring chain, so the silhouette reads as moving, as in frame 5).
  - **Probe-staff**: a 1.1 H cream staff with a gold ferrule and a glass bulb at its tip. The bulb glows `#6ED2F2`
    while a panel is open, and turns orange `#E2892C` only while the player is dragging the scrubber (it is literally
    their input).
- **Animation set (frame names from the pack):**

| Anim | Frames | Rate | Notes |
|---|---|---|---|
| idle | `idle` + a breathing tween (scaleY 1.0 ↔ 1.02, 2.4 s) | — | the scarf drifts |
| walk | `walk0`…`walk7` | 12 fps | speed 260 px/s |
| run | `run0`…`run2` | 14 fps | with Shift, 400 px/s |
| jump | `jump` (up), `fall` (down) | — | jump height 1.1 H |
| climb | `climb0`, `climb1` | 8 fps | on stairs and steps that puzzles create |
| interact | `interact` → `switch0` → `switch1` | 10 fps, holds on `switch1` | at consoles; the staff bulb lights |
| talk / think | `talk`, `think` | — | when an NPC line addresses the player, or on the hint button |
| celebrate | `cheer0`, `cheer1` ×2 | 8 fps | on every success, 0.8 s, then idle |
| ride | `idle` locked to a platform (raft, gantry, barge, vesicle, door) | — | feet snap to the platform's top |
| hurt (never used) | — | — | **no damage in this game**: failure is the machine's, never the Diver's |

### 3.2 Guide: Pilot Ora (+ Pip)
- **Fixture id.** `pilot`, role "the submarine's guide", voice archetype **`cheerful_sidekick`**.
- **Look (for the intro, the outro and the comms-porthole portrait).** Early twenties, brown skin, a cloud of dark curls
  held back by a brass headset, round aviator goggles pushed up, and an aqua `#4CB6D0` jumpsuit with cream piping and a
  gold `#D9A441` *Halcyon* patch (a teardrop sub in a ring). She is drawn in a round **porthole frame** (a bronze ring
  with 8 rivets) that appears at the dialogue bar's left during cutscenes. In gameplay only her **emblem** shows.
- **Personality.** Quick, warm, nautical slang ("hull", "aye", "steady"), and a joke per scene at most. She never
  lectures longer than two lines, she believes the player can do it, and she frames escalation ("Biggest machine on
  this membrane").
- **Voice.** Sentences of 5–15 words. Instruction lines are imperative and name the world object. Insight lines are one
  declarative truth. She never says "correct", "wrong", "question" or "answer".
- **Emblem (dialogue bar, 64 px).** A dark `#0B1F27` disc and three concentric rings in `#E8F6F8` (the outer ring whole,
  the middle ring broken at 2 and 7 o'clock, the inner ring broken at 11 o'clock, like bible §3.9). Between the outer
  and middle rings sits a **ring of 16 small dots with twin tick-tails pointing inward**, which reads as a circular
  bilayer (a cell). The emblem pulses in `#8FE0EA` when she speaks.
- **Pip (in-world companion).** A teardrop mini-sub drone, 38 px long, cream hull, gold ring around a round glass
  porthole (`#6ED2F2` glow), a tiny navy propeller. It floats at the player's shoulder (offset −40, −150; spring follow
  k = 0.08) and pulses when Ora speaks. It has two jobs:
  1. **Water lens (hint 1 in router and boss encounters).** Pip emits a cone of light that reveals **hydration
     shells** (§5.2).
  2. **Scanner.** At lore plaques, Pip projects the plaque's text into the dialogue bar.

### 3.3 The Gatekeeper (boss)
- **Fixture id.** `gatekeeper`, role "an ancient pump protein guarding the last vault", voice **`gruff_guard`**.
- **Look.** A colossal pump protein, 6 H, seated on the road. The body is cream stone with navy inlay bands and gold
  phosphate studs (round gold bosses) along the shoulders. At chest height are **three maws**: the Oil Maw (left, lined
  with lipid heads), the Channel Maw (centre, a bronze selectivity ring that can spin) and the Pump Maw (right, gold
  phosphate "teeth" and an ATP intake pipe that climbs his back). He has **one great eye-ring**: concentric broken rings
  like Ora's emblem but bronze and gold, with a slowly turning pupil-ring. He is a machine, not a person or an animal.
- **Voice.** Short, heavy sentences, and "Hrrm." He is fair: he never mocks, only states.
- **Emblem (when he speaks).** A bronze `#6E4A2E` disc, three gold rings and three small notches at the bottom (the maws).

### 3.4 Minor NPCs (4)

| NPC | Where | Look | Voice | Micro-quest / lore |
|---|---|---|---|---|
| **Sucra**, glucose courier | S2, S4, S7 | a walking **hexagon ring** (cream `#F6E3B4`, gold outline) on two short legs, carrying a satchel with a tag; 0.6 H | `nervous_scholar` (polite, fussy, over-precise) | **Escort.** She can't cross the bilayer ("they simply won't let a glucose through"). After e2 she rides the Crossing Gate. At e6 she rides the Carrier Door with the player. Lore: polar molecules need proteins, and a carrier is a door, not an engine |
| **Poro**, aquaporin keeper | S4 | an **hourglass-waisted stone statue** (1.6 H) with two sleepy eye-glyphs and a single-file groove down its waist; water droplets trickle through it continuously | `wise_mentor` (slow, "Mm.") | Lore: water crosses in single file through channels like him, billions per second. Gives the player plaque text P3b (bonus debrief line) |
| **Kay**, K⁺ lamplighter | S5 | a **violet sphere** (0.5 H) with a white "+" badge, stubby arms, carrying a long cream lamp pole with a gold hook | `gruff_guard` (grumbly, but proud of the pump) | **Lantern quest.** Find 3 dark ATP lanterns on side ledges in the Pump Hall and touch each with the probe-staff. Reward: insight shard plus his "secret" line (nerve cells spend a large share of their ATP on the pump) |
| **The Clathrin Ferryman** | S6 | a **triskelion** (three curved cream-and-gold legs from a hub, 1.2 H) that walks by rolling on its legs; a small gold dynamin ring hangs from its hub like a lantern | `narrator` (formal, measured) | Operates the Endocytosis Lift. Lore: exocytosis is the same trip in reverse |

---

## 4 · Story arc and dialogue

### 4.1 Structure

| Act | Scenes | Encounters | Role (fixture) | Gradient Meter after |
|---|---|---|---|---|
| **Prologue: Shrink** | S1 | none | — | 12 % |
| **Act I: The Wall That Flows** (the membrane) | S2 | e1_bilayer, e2_selectivity | teach, teach | 26 % |
| **Act II: The Tide Always Goes Somewhere** (passive transport) | S3, S4 | e3_diffusion, e4_osmosis, e5_tonicity, e6_facilitated | teach ×4 | 56 % |
| **Act III: Paying to Climb** (active transport) | S5 | e7_active, e8_pump | teach, teach | 78 % |
| **Crossing** (review + bulk) | S6 | e9_osmosis_review, e10_bulk | **review**, teach | 90 % |
| **Finale: The Gatekeeper** | S7, S8 | e11_boss | **boss** (c_active_transport + c_facilitated) | 100 % |

Teach → review → boss maps exactly onto the fixture's roles: e9 reviews osmosis (e4/e5) under a new framing, and e11
combines the two weakest concepts in the intake (passive, confidence 2, and active, confidence 2).

### 4.2 Intro cutscene (S1), with camera beats

The dialogue bar is shown full-width in cutscenes, with Ora's porthole portrait at its left edge.

| Beat | Camera / action |
|---|---|
| C1 | Black → a fade-in on the **cytoplasm glimpse**: amber, with slow motes. Pull up through the bilayer band (the heads pass the camera) into the Tide sky. Title card "THE LIVING GATE" in cream serif caps, letter-spaced, over a thin white ring |
| C2 | A wide shot of the Shore. The *Halcyon* finishes its shrink (scale tween 3 → 1 with a ring ripple, 800 ms) and settles onto the glycan mooring |
| C3 | The hatch opens and the Diver steps out (walk2 → idle). Pip pops out after them with a two-tone chirp |
| C4 | The camera pans right along the dark conduits to the Colonnade Rise, then dips below the band to the nucleus glow |
| C5 | Back to the Diver. The HUD fades in (objective ring, GATES 0/11, GRADIENT 12 %) and control is handed over |

### 4.3 Dialogue (every line)

Rules:
- Each line is ≤ 140 characters (checked by script; the longest is noted in §4.4).
- Speaker ids match the fixture (`pilot`, `gatekeeper`), plus overlay NPC ids (`sucra`, `poro`, `kay`, `ferryman`) and
  `narrator` (caption only, no emblem).
- `instr` lines show in the bar while the panel is open. `insight` lines replace `instr` after success (bible §3.9).
- The hint ladder `h1`–`h3` is opened with the **i** button. It is the guide-voiced version of the fixture's `hints[]`
  with identical meaning, and `h3` stays the fixture's bottom-out.
- `fail` plays over the mode's own `grade()` feedback (which appears as the second line in the bar). It **never names
  the answer.**

#### Prologue (S1)
| id | speaker | line |
|---|---|---|
| in01 | narrator | Cell V-7, deep in living tissue. Its gates have gone still, and its gradients are draining away. |
| in02 | pilot | Hull's holding at seven nanometres, all hands dry. Welcome to the outside of a living cell, Diver. |
| in03 | pilot | Shrink complete. That wall ahead is the membrane. Nothing gets through it without a reason. |
| in04 | pilot | Bad news first: the Stillness hit this cell. Pumps stopped, gates locked, gradients flattening out. |
| in05 | pilot | When inside matches outside, a cell goes quiet for good. Equilibrium sounds calm. For a cell, it's the end. |
| in06 | pilot | Good news: every gate here is a machine, and machines restart. Set each one to its true rule and it runs. |
| in07 | pilot | What crosses, how, and at what cost. Get those right at every gate and we reach the nucleus. |
| in08 | pilot | I'll hold the Halcyon's helm. Pip goes with you. Pip, say hello. ...Pip says hello. |
| in09 | pilot | Gradient Meter reads twelve percent. Let's make it a hundred. A and D to walk, Space to jump, E at consoles. |
| s1_walk1 | pilot | Those branching trees are the glycocalyx: sugar chains on the cell's surface. Think of them as its name tag. |
| s1_walk2 | pilot | The ground under you is the membrane itself. Round heads on top, oily tails underneath. Mind your step. |
| s1_node | pilot | A seal node, dark as a cave. Every gate you restart lights a conduit to one of these. That's our map. |

> `in03` is the fixture's `narrative.intro[0]`, verbatim. The overlay supplies the rest of the sequence around it,
> and the spec text stays unchanged.

#### Act I: e1_bilayer · Specimen Pods at the Stiff Ridge (S2)
| id | speaker | line |
|---|---|---|
| e1_approach | pilot | The Stillness froze this stretch of membrane solid. Three specimen pods here, and one of them holds a Mimic. |
| e1_instr | pilot | Push the probe into the membrane and watch it. Then quarantine the pod whose claim the membrane disproves. |
| e1_h1 | pilot | Forget the textbook diagram for a second. What is this ground made of? Watch the heads while you push. |
| e1_h2 | pilot | Lipids with oily tails make a layer that flows around the probe and closes behind it. That's no wall. |
| e1_h3 | pilot | The Mimic's claim: "The membrane is a rigid wall with fixed holes in it." |
| e1_fail | pilot | That pod's claim held up against the real membrane. Push again, and watch which claim the heads keep breaking. |
| e1_success | pilot | Mimic quarantined! And look at the ridge. It's melting back into a path. |
| e1_insight | pilot | A membrane is not a wall. It's a film that flows, and only proteins give it doors. |

#### Act I: e2_selectivity · Membrane Router at the Crossing Gate (S2)
| id | speaker | line |
|---|---|---|
| sucra_1 | sucra | Pardon! Excuse me! I've knocked on these heads for an hour. They simply will not let a glucose through. |
| e2_approach | pilot | Watch the small ones. Small doesn't mean welcome. |
| e2_instr | pilot | Route each molecule: straight through the bilayer on the Oil Road, or through the Crossing Gate's ring. |
| e2_h1 | pilot | Size is a clue, not the rule. Pip's water lens is on. See which molecules carry a shell of water? |
| e2_h2 | pilot | Ask if it's polar or charged. The oily core between the heads turns away anything with a charge. |
| e2_h3 | pilot | Na+ is smaller than O2 and still can't cross alone. Charge beats size, every time. |
| e2_fail | pilot | The road refused one. Check its charge and polarity before its size, then reroute it. |
| e2_success | pilot | Every molecule took the right road! The Crossing Gate is spinning up. |
| e2_insight | pilot | The bilayer asks every visitor one question: are you oily enough to dissolve in me? |
| sucra_2 | sucra | A carrier! It takes me in, turns around, lets me out. No shoving, no fuel. Marvellous. |
| zB_arrive | pilot | The Tide Basins. Everything here is about water, and water always has somewhere it wants to be. |

#### Act II: e3_diffusion · Specimen Pods at the Dye Tank (S3)
| id | speaker | line |
|---|---|---|
| e3_approach | pilot | The Balance Lock only opens when both sides of this tank are even. Right now the dye is piled on the left. |
| e3_instr | pilot | Set the dye load and watch the tank. Then quarantine the pod whose story about the dye is a lie. |
| e3_h1 | pilot | Follow the tracer, the one with the white ring. Does it know where the crowd is? |
| e3_h2 | pilot | Each particle wanders at random. More start on the crowded side, so more happen to cross from there. |
| e3_h3 | pilot | The Mimic's claim: "The dye particles head for the empty side on purpose." |
| e3_fail | pilot | That pod's story matched the tank. Watch the tracer's trail for a while before you choose again. |
| e3_success | pilot | Mimic quarantined. The tank's evening out, and the Balance Lock is levelling off. |
| e3_insight | pilot | No particle has a plan. Diffusion is just what a crowd of random steps adds up to. |

#### Act II: e4_osmosis · Specimen Pods at the Osmometer Basin (S3)
| id | speaker | line |
|---|---|---|
| e4_approach | pilot | A test cell in a salt bath, and a raft stuck at the bottom of a dry lock. Something here has to move. What? |
| e4_instr | pilot | Salt the bath and watch the test cell. Then quarantine the pod that gets the moving part wrong. |
| e4_h1 | pilot | Two things could cross: the water or the dissolved salt. Which one can actually get through a bilayer? |
| e4_h2 | pilot | Osmosis is water moving toward the side with more solute. Watch where the blue droplets go. |
| e4_h3 | pilot | The Mimic's claim: "Salt rushes into the cell until both sides match." |
| e4_fail | pilot | That pod was honest. Crank the salt up and down, and watch what the white salt cubes actually do. |
| e4_success | pilot | Quarantined! Now I'm salting the raft lock. Water will follow the salt in and float you up. Step aboard! |
| e4_insight | pilot | Salt stays where it is. Water goes where the solute is, and it'll lift a raft to get there. |

#### Act II: e5_tonicity · Tonicity Sluices (S4)
| id | speaker | line |
|---|---|---|
| poro_1 | poro | Mm. Visitors. I am Poro. Water passes through my waist in single file, and nothing else. Now, the sluices. |
| e5_approach | pilot | Cells are drifting down the sluice canal. Each lock needs a label before its cell passes. Quick hands, Diver. |
| e5_instr | pilot | Label each lock's bath before its cell drifts past: hypotonic, isotonic, or hypertonic. |
| e5_h1 | pilot | The label describes the bath around the cell, not the cell itself. |
| e5_h2 | pilot | Hyper means more solute outside, so water leaves. Hypo means less solute outside, so water comes in. |
| e5_h3 | pilot | A swelling cell means water came in, so its bath had less solute than the cell. |
| e5_timeout | pilot | That cell drifted past without a label. It counts as a miss, so keep one eye on the lock timer. |
| e5_fail | pilot | One lock's label doesn't fit its bath. Compare the dots inside that cell with the dots around it. |
| e5_success | pilot | The sluice is draining! See the steps coming up out of the water? That's our way up. |
| e5_insight | pilot | Tonicity always compares the bath with the cell. Hyper outside, water leaves. Hypo outside, water arrives. |
| poro_2 | poro | Mm. Well sorted. The water will remember you. Take my ledger; it is heavy with droplets. |

#### Act II: e6_facilitated · Threshold Router at the Carrier Door (S4)
| id | speaker | line |
|---|---|---|
| e6_approach | pilot | The Pump Hall doors. More cargo waiting, and two gates: the Glide Gate, and the Pump Gate that burns ATP. |
| e6_instr | pilot | Route each cargo: passive, down its slope for free, or active, uphill through the pump at a cost. |
| e6_h1 | pilot | Ignore whether a protein is involved. Look at the slope under each cargo. Which way does it have to go? |
| e6_h2 | pilot | Downhill is always passive, protein or not. A carrier is a door, not an engine. |
| e6_h3 | pilot | Only the cargo heading toward the more crowded side costs ATP. |
| e6_fail | pilot | One cargo is at the wrong gate. Check its slope: is it rolling down, or being pushed up? |
| e6_success | pilot | Threshold open! The Carrier Door is turning. Sucra, hop on! |
| e6_insight | pilot | A protein can open a door without paying a thing. Energy is only spent when the cargo climbs. |
| sucra_3 | sucra | Told you. A carrier is a door, not an engine. I am going to write that on something. |
| zC_arrive | pilot | The Pump Hall. Those gold rails used to carry ATP to every pump in the wall. Dark as a hold in here. |

#### Act III: e7_active · Specimen Pods at the Uphill Flume (S5)
| id | speaker | line |
|---|---|---|
| kay_1 | kay | Oi. Mind the lanterns. Kay, K-plus, lamplighter. Nothing's been lit since the pumps went quiet. |
| e7_approach | pilot | Two tanks, one high and one low, and a pump between them. Three pods argue about what that pump does. |
| e7_instr | pilot | Feed the pump ATP and watch the tanks. Then quarantine the pod that has pumps backwards. |
| e7_h1 | pilot | Why would a cell ever spend ATP just to move something? Try the feed at zero and watch the tanks. |
| e7_h2 | pilot | If everything only ran downhill, nobody would ever need to pay for it. |
| e7_h3 | pilot | The Mimic's claim: "Transport always runs down the gradient, so pumps just speed it up." |
| e7_fail | pilot | That pod told the truth. Take the feed to zero, then up again. Which way does the gap between the tanks go? |
| e7_success | pilot | Quarantined, and the lanterns are catching! The gantry has power. Up you go. |
| e7_insight | pilot | A pump is a climber. It carries cargo uphill, from low to high, and ATP pays for every step. |

#### Act III: e8_pump · Pump Rewiring (S5)
| id | speaker | line |
|---|---|---|
| e8_approach | pilot | There it is: the sodium-potassium pump. Biggest machine on this membrane, and someone pulled its cables. |
| e8_instr | pilot | Rewire the pump: link each socket to its value cartridge. Step the stage dial to test a cycle. |
| e8_h1 | pilot | The counts aren't equal. That lopsidedness is the whole point of this machine. |
| e8_h2 | pilot | More positive charge leaves than comes in each cycle. Which ion leaves, and how many? |
| e8_h3 | pilot | Three sodium out, two potassium in, one ATP. |
| e8_fail | pilot | The pump jammed at one stage. Find the socket whose cable won't hold and rethink that link. |
| e8_success | pilot | It's cycling! Three out, two in, one spark of ATP, again and again. The Hall Gate is lifting. |
| e8_insight | pilot | Three out and two in leaves the inside a little negative. That lopsided pump is why nerves can fire. |
| kay_2 | kay | Three out, two in. Lopsided, I always said. Lopsided's what keeps the lights on. |
| kay_quest | kay | Three lanterns in here are still dark. Touch 'em with that probe of yours and I'll tell you a secret. |
| kay_reward | kay | Secret is, a nerve cell spends a big share of all its ATP just running pumps like that one. Worth every spark. |

#### Crossing: e9_osmosis_review · Return Sluice (S6)
| id | speaker | line |
|---|---|---|
| e9_approach | pilot | Review time, and a barge to catch. Four cells coming down the Return Sluice. Which way does their water go? |
| e9_instr | pilot | For each lock, set the water flow before the cell drifts past: in, out, or no net movement. |
| e9_h1 | pilot | Compare the solute dots inside and outside each cell. |
| e9_h2 | pilot | Water goes toward the side with more solute. |
| e9_h3 | pilot | Equal solute on both sides means no net movement at all. |
| e9_fail | pilot | One flow call was off. The salt doesn't move, so ask which side the water is heading toward. |
| e9_success | pilot | Every call right. The locks are filling, and the barge is rising to the Endocytosis Pit. |
| e9_insight | pilot | You never have to watch the salt. Find where the solute is crowded, and the water's already on its way. |

#### Crossing: e10_bulk · Endocytosis Lift (S6)
| id | speaker | line |
|---|---|---|
| ferry_1 | ferryman | Passage inward is by vesicle only. The membrane will carry you, if you tell it how. In order. |
| e10_approach | pilot | No channel in this cell is big enough for the Halcyon. So the membrane is going to swallow us. On purpose. |
| e10_instr | pilot | Set the four stage plates in the order that brings us into the cell. One plate doesn't belong. |
| e10_h1 | pilot | Something too big for any protein channel has to be wrapped up. |
| e10_h2 | pilot | The membrane does the wrapping first, then closes the pocket. |
| e10_h3 | pilot | Start at the moment of contact and end with the vesicle moving. |
| e10_fail | pilot | The Lift stalled partway. Scrub through your plates and find the step that can't happen yet. |
| ferry_hold | ferryman | Hold. The membrane cannot do that yet. |
| e10_success | pilot | We're folding in... pinching off... and we're in! Welcome to the cytoplasm, Diver. |
| e10_insight | pilot | Big cargo can't pass through a door, so the membrane becomes the door. Folding and pinching both cost ATP. |
| ferry_2 | ferryman | Outward is the same voyage, reversed. A vesicle meets the membrane, joins it, and opens to the world. |

#### Finale: the Vault Road and the Gatekeeper (S7–S8)
| id | speaker | line |
|---|---|---|
| s7_walk1 | pilot | Look up, Diver. That's the membrane from the inside. And the glowing domes? Organelles. The big one is the nucleus. |
| s7_walk2 | pilot | Every conduit you lit is feeding the Nuclear Pore. It needs one last push, and I think I know who's in the way. |
| s7_walk3 | pilot | Real nuclear pores are their own kind of gate. This old pump just parked itself on the road when the Stillness hit. |
| sucra_4 | sucra | Carried! Politely! By a vesicle! I am having the most educational day. |
| gk_1 | gatekeeper | I have pumped for a billion years. Show me you know what costs energy. |
| gk_2 | gatekeeper | Three maws. Oil, Channel, Pump. Feed each cargo to the right one. Waste my ATP and the vault stays shut. |
| e11_instr | pilot | Sort every cargo into a maw: simple diffusion, facilitated diffusion, or active transport. |
| e11_h1 | pilot | Two questions per cargo. Is it going down its gradient or up? Can it dissolve through lipid on its own? |
| e11_h2 | pilot | Uphill is always active. Downhill with a protein is facilitated. |
| e11_h3 | pilot | Only small nonpolar molecules cross alone. |
| e11_fail | gatekeeper | Hrrm. That one came back up. Direction first. Then ask whether it can pass through oil. |
| e11_success | gatekeeper | Sorted true. Pass, molecule-wise crew. |
| e11_insight | pilot | Two questions sort every crossing: which way is it going, and can it pass through oil? ATP answers only the first. |
| gk_3 | gatekeeper | The pore turns. Go. And tell the nucleus the pumps are running again. |

#### Outro (the finale phase, S8)
| id | speaker | line |
|---|---|---|
| out01 | pilot | The nucleus! You got the whole crew through by knowing what crosses, how, and at what cost. |
| out02 | pilot | Gradient Meter: one hundred percent. Inside and outside are different again. That difference is what alive means. |
| out03 | pilot | Oxygen through the oil, glucose on a carrier, water through Poro, sodium uphill for ATP. You rebuilt a cell's rules. |
| out04 | sucra | For the record: I was carried, politely, by a protein. Carried! |
| out05 | kay | Lanterns lit. Pumps thumping. Don't let anyone tell you lopsided is a flaw. |
| out06 | pilot | Bring Pip home, Diver. And, er... the cell next door is looking a little still, too. |

#### Lore plaques (Pip scans; §6.1)
| id | speaker | line |
|---|---|---|
| p1 | narrator | THE TWO FACES. Each lipid has a head that loves water and two tails that flee it. Tails hide inside; heads face out. |
| p2 | narrator | WHY OIL SAYS NO. A charge wants water around it. The bilayer's oily core has none, so ions are turned away. |
| p3 | narrator | THE JITTERING GRAINS. In 1827 Robert Brown saw tiny grains from pollen jitter in water. Nothing pushed them but water. |
| p3b | poro | Mm. My kind lets water through in single file, billions of molecules each second. Only water. I am very strict. |
| p4 | narrator | THE LOPSIDED ENGINE. Three Na+ out, two K+ in, one ATP. More plus leaves than enters, so the inside turns negative. |
| p5 | narrator | DOORS MADE OF DOOR. Cells swallow large cargo by folding membrane around it. Exocytosis runs the same trip outward. |
| secret | pilot | A plant cell in fresh water, and it isn't bursting. Its wall pushes back. That's turgor. Plants like it firm. |

### 4.4 Line count and length check
- **134 lines** (§4.3 tables): 12 prologue, 8 + 11 in Act I, 8 + 8 + 11 + 10 in Act II, 9 + 11 in Act III, 8 + 11 in
  the Crossing, 14 in the finale, 6 in the outro, 7 lore. The requirement was at least 80.
- **Every line is ≤ 140 characters.** This is script-checked; the longest is 118 characters (`p3`). A content agent that
  edits a line must re-run the check. The one-liner is in §9.4.

### 4.5 Beats outside dialogue (engine hooks)
- **Approach** lines play when the player enters the contraption's trigger zone (the console x ± 500 px), once.
- **The instruction** shows when the panel opens. **Insight** replaces it on success, and stays through the payoff.
- **After-beats** play after the success animation (sucra_2 after e2, sucra_3 after e6, poro_2 after e5, kay_2 after
  e8, ferry_2 after e10, gk_3 after e11). They require map fix **D1**: capture the cleared encounter before `submit`.
- **Finale.** e11 success → gk_3 → the pore opens → out01…out06 while the player walks into the pore → EndScreen. This
  requires map fix **D2**: a `finale` phase before EndScreen.
- **Fixture beats are honoured verbatim.** They are `e2_approach` (the fixture beat for e2 before), `gk_1` (e11 before)
  and `e11_success` (e11 after).

---

## 5 · Contraptions (one per encounter)

### 5.0 Shared rules for every contraption in this game

**R1 · The five-part grammar** (bible §4): console → control → live link → verify → payoff. Each block below fills all
five.

**R2 · Claim renders vs verdicts (the leak rule).** The live link continuously renders **what the player's current
input claims**, through the physics of the world: a molecule floats to the lane you chose, a bath fills to the density
your label implies, a pump loads the ion count you wired, a ghost overlay shows what a pod's claim predicts. The player
has to interpret the render; that is the learning. **Verdicts** (bounce vs pass, jam vs cycle, fate vs no fate) are
held back until **Verify**. When they do play, they reveal **exactly what `grade()` feedback reveals and no more**: the
first miss in `grade()`'s own order, and nothing about the other items. A contraption must never show a count of correct
items, a per-item tick, or a capacity that implies the answer (for example, no "3 slots" on a bin).

**R3 · The draft protocol (extension; no grading change).** Today only `tuner.*` and `mapper.number_line` emit
`onLive(number)` (map §1.5). Every contraption here needs the **partial input**. Adopt the map's recommendation:

```ts
// widget / panel component (engine-dev)
onDraft?: (draft: Partial<ModeInput>) => void;          // fired on every change, same shape as the mode's Input
// host handle (engine-dev)
HostHandle.setDraft(encounterId: string, draft: unknown): void;
HostHandle.setLiveValue(value: number | undefined): void; // kept: drives the exploration scrubber (R4)
```

| Mode | Draft shape (a partial of the mode's `Input`) | Emitted when |
|---|---|---|
| truth_finder.mimic | `{ statementIndex?: number }` (the **original** index, from `view.chests[k].statementIndex`) | on focus/select of a claim tile |
| sorter.bins | `{ assignments: { itemKey, binId }[] }` (the current partial map) | on every drop / keypress |
| sorter.type_match | `{ answers: { waveIndex, categoryId }[], waveIndex: number, secondsLeft: number, hover?: categoryId }` | on every tick, hover and commit |
| linker.pairs | `{ links: { leftKey, rightKey }[] }` | on every link / unlink |
| sequencer.linear | `{ keys: (string \| null)[] }` (one entry per slot, `null` = empty) | on every plank placement |

**R4 · Exploration scrubbers.** Several contraptions add an **ungraded** orange scrubber (probe depth, dye load, bath
salt, ATP feed, pump stage, Lift playback). It is contraption state, not mode input. It flows over the existing
`setLiveValue(number)`, its range and units come from the world overlay, and it never reaches `grade()`. This is how a
mode with no numeric input (mimic, pairs, linear) still gets Variant's "one orange input drives the world" feel
(checklist item 21).

**R5 · First-miss ordering.** The failure animation must highlight the same item that `grade()` names. **Extension
(mechanics-dev):** export a pure `firstMiss(params, input)` from each mode file, and have `grade()` call it too, so
there is one code path. The orders are as `grade()` works today:
- mimic: the picked `statementIndex`.
- bins: first any unplaced item ("Place all N items"), otherwise the first wrong key in `i0, i1, …` order (`bins.ts:104-114`).
- type_match: the first wave index whose answer is missing or wrong (`type_match.ts:94-101`).
- pairs: first any unlinked left, otherwise the first wrong key in `l0, l1, …` order (`pairs.ts:89-99`).
- linear: an unfilled slot, then any decoy present, then the first wrong slot (`linear.ts:82-91`).

**R6 · Easing and chips.**
- World objects lerp toward their target at `α = 0.25` per frame (about 0.3 s, bible §3.5), unless a physical time
  constant is given below.
- **World chips** use the format `"<symbol>: <value> <unit>"`, for example `C_L: 4.1 mM`, `V: 74%`, `ATP: 7/s`,
  `d: 2.4 nm`, with a pointer triangle to the driven part. They lag like the part they label.
- **Panel chips** ride the card's left edge at the current value's y (bible §3.5).

**R7 · Pure pose functions.** Each contraption's maths lives in `src/game/contraptions/<id>/model.ts` as pure functions
`pose(draft, scrub, simState) → PartTransforms` and `step(simState, dt, scrub) → simState`, seeded with
`spec.seed ^ hash(encounter.id)`, so Vitest (node env, `*.test.ts`) can check them and a scrub back-and-forth replays
deterministically. The same `pose()` drives the live preview, the success timeline (with a solved draft) and the skip
state.

**R8 · World state follows progress, not `celebrate`** (map D3). On load, `skipTo` or `autoSolve`, each contraption
whose encounter index < `runner.currentIndex` renders its **end pose** (opened, drained, lifted) with no animation.
`celebrate(mode)` only plays the timeline.

**R9 · Layout modes** (bible §3.1): **Scrub** (world 60 / panel 40) for e1, e3, e4, e7, e8, e10. **Sluice** is Scrub
proportions with valve buttons instead of a scrubber, for e5 and e9. **Board** (world 45 / panel 55) is for e2, e6 and
e11. On open, the camera tweens so the contraption is centred in the world area (280 ms, ease-out cubic), and the panel
slides in from the right. **The back arrow** closes the panel without grading, keeps the draft, and lets the contraption
settle back to its dormant pose.

**R10 · Keyboard.**
- Scrubber: ←/→ step, Shift ×10, Home/End.
- Claim tiles, valves and bins: keys 1–3.
- Tokens: Tab, Enter to pick, arrows between targets, Enter to drop.
- Verify: Enter when focused.
- Hints: **i** or H.
- Phaser global key capture is disabled while a panel is open (map D4).

### 5.P · Kit: **Specimen Pods** (used by all four `truth_finder.mimic` encounters: e1, e3, e4, e7)

- **In-world object.** Three pods on a low stone dais beside the console.
  - Each pod is 1.1 H tall: a cream pedestal with a navy band and a gold rim, a glass capsule (`#C9F3FF` @ 30 %) in a
    bronze collar, and a swirl of dormant specimen haze inside.
  - A small round **letter plate** (A/B/C) sits on the pedestal. **Letters follow display order** (`view.chests`
    order), never statement order.
  - A **probe emitter** (bible pedestal emitter: a coiled cream stem with a cyan orb) is mounted on the console and aims
    a beam at the chosen pod.
- **Reference apparatus.** Each encounter adds its own **reference apparatus** (the real phenomenon, running live) next
  to the pods. That is what the ghosts are compared against.
- **Control (graded).** A **Claim card** in the panel (label tab "claims"): three claim tiles in display order
  (letter + full text). Select one with click or keys 1–3. Draft `{ statementIndex }`.
- **Live link.** On select:
  - The beam swings to that pod: emitter angle = `atan2(pod.y − e.y, pod.x − e.x)`, eased 0.2. The beam uses the bible
    §6.2 3-line recipe.
  - The pod glows (`crystal.base` halo 30 %).
  - The pod projects its **claim ghost** onto the reference apparatus: a white-cyan hologram overlay at 45 % alpha with
    1 px scanline shimmer at 12 Hz. The ghost is **the claim's prediction rendered faithfully**, per the per-encounter
    `ghost` table below.
  - The real apparatus keeps running underneath, so the player compares prediction with reality.
- **Verify.** Button **"QUARANTINE POD"** (enabled once a pod is selected) → `grade({ statementIndex })`: correct iff
  `statementIndex === mimicIndex` (`mimic.ts:83-93`).
- **Shared success (900 ms), then the scene payoff.**

| t (ms) | What happens |
|---|---|
| 0 | The chosen pod's glass fogs white 0 → 0.8 (250 ms). sfx `pod_fog` |
| 250 | A crack line draws across the glass (150 ms). sfx `pod_crack` |
| 400 | The **Mimic Mote** (a jelly blob that imitates the claim's object) squeezes out, shivers ±4 px for 3 cycles, then dissolves into 12 bubbles. sfx `mote_pop` |
| 400 | The two honest pods hum, their rings rotating 30° with a teal glow |
| 900 | The badge **"MIMIC QUARANTINED"** shows in the panel; the scene payoff begins |

- **Shared failure (non-punitive, 1.2 s).** The picked pod is honest:
  1. Its ghost snaps into perfect register with the real apparatus (alpha 45 → 80 %, then fades over 1.2 s). The
     alignment itself says "this claim matches reality".
  2. The pod chimes once and the beam retracts.
  3. The bar shows the `eN_fail` line, then `grade()` feedback ("That chest was honest: …").
  Nothing else is revealed.
- **Noun note (optional extension, mechanics-dev).** `mimic.ts` feedback says "chest". A `noun` template var ("pod")
  would make the text match the world. Until then the panel shows the feedback verbatim.

---

### 5.1 · e1_bilayer · `truth_finder.mimic` · **Specimen Pods at the Stiff Ridge** (S2, console x 4300, Scrub)

- **In-world object.**
  - The three pods, and the **Probe Well**: a 400 px stretch of healthy bilayer in front of the console with the
    **probe needle** above it (a cream-and-gold piston, 1.4 H, ending in a fine gold tip).
  - An **Na⁺ ion** (with its hydration shell) sits on the needle's tip.
  - Behind them is the **Stiff Ridge** (gel-phase membrane, 1.4 H hump, blocking the road).
- **Graded control.** The claim tiles. Statements, in original index order:
  - s0 "double layer of phospholipids" (true)
  - s1 "rigid wall with fixed holes" (**mimic**, index 1)
  - s2 "interior nonpolar, blocks most ions" (true)
- **Exploration scrubber (R4).** The input tab is **"d"**, "probe depth", range **0 – 5 nm**, step 0.1, with ruler
  labels 0, 1, 2, 3, 4, 5. The ruler background tints the regions: head zones 0–1 and 4–5 in `lipid.head` at 15 %, and
  the core 1–4 in `oil.seam` at 20 %.
- **LIVE BINDING** (px/nm = 208 / 5 = **41.6**; y_s = 713):

| Source | Target | Formula |
|---|---|---|
| d | needle tip y | `tipY = y_s + 41.6·d` (eased 0.25) |
| d | head *i* lateral push (fluid parting) | `Δx_i = sgn(x_i − x_n)·22·min(d,1)·exp(−(x_i − x_n)²/(2·36²))`, `Δy_i = −4·min(d,1)·exp(…)`. The heads pile up around the needle and **reseal** behind it as d decreases (lerp 0.25) |
| d | tail *i* bend | `θ_i = 0.4·Δx_i/22` rad |
| d | Na⁺ ion y | rides the tip while `d ≤ 0.9`. For `d > 0.9` it is held at the head/tail boundary (`y_s + 37 px`), its shell compressed 20 %, and it springs back to the surface (k = 0.2) with a small ripple each time the tip passes 0.9 nm: **the ion cannot enter the oily core** |
| time | head jitter (fluidity) | ±1.5 px at 2 Hz on every healthy head, **0** on the Stiff Ridge |
| draft.statementIndex | beam + ghost | per the **ghost table** |
| d, ion | world chips | `d: 2.4 nm` on the needle; `ΔG: 36` on the ion |

| Ghost (by original index) | What it renders | Versus reality |
|---|---|---|
| s0 double layer | an outline of two rows of heads and tails, exactly over the band | matches, and flows with it |
| s1 **rigid wall with holes** | a rigid grey-white slab with evenly spaced round holes, drawn over the band | **stays rigid while the real heads part and reseal through it**; its holes line up with nothing. The misconception, made visible |
| s2 nonpolar core blocks ions | the core band shaded "no charge" and a ghost ion bouncing off the head/tail boundary | matches the real ion's bounce |

- **Panel (Scrub, 40 %).**
  - Card **f** (white), **"polar(d)"**: a polarity profile `P(d) = σ(8·(1−d)) + σ(8·(d−4))` (σ = logistic), high at the
    heads and ~0 in the core. y ticks 0, 0.5, 1. Chip "polar 0.04".
  - Card **g** (green), **"ΔG ion(d)"**: `ΔG(d) = 40·(1 − P(d))` in kJ/mol (card caption "illustrative scale"). y ticks
    0, 20, 40. Chip "ΔG 38".
  - Card **claims**: the three claim tiles.
  - The scrubber and the tab "d" with readout "2.4 nm".
  - Verify **QUARANTINE POD**.
- **Verify.** `mimic.grade`, correct iff `statementIndex = 1`.
- **Success payoff (after the shared 900 ms; total ≈ 2.4 s).**
  - The probe retracts.
  - The Stiff Ridge **thaws**: a wave runs left → right over 900 ms, and each frozen head's hex-packed pose tweens into
    the fluid row, with the frost rim fading and jitter resuming.
  - The ridge height tweens from 1.4 H to a 0.3 H gentle ramp (ease-in-out).
  - Saturation −40 % → 0 %.
  - Conduit 1 lights and sends a light packet toward the horizon. sfx `ridge_thaw`, `conduit_on`.
  - The Gradient Meter goes 12 → 18 %. The player walks over the ramp.
- **Failure.** Shared (§5.P). The Stiff Ridge shivers once (±2 px, 200 ms).
- **Visible misconception.** "The membrane is a solid wall with holes": the s1 ghost slab stays rigid while the real
  membrane flows through it, and the Stiff Ridge itself is what "rigid" looks like (broken, blocking, lifeless).
- **Insight line.** `e1_insight`.
- **Extensions.** Mimic draft (R3), the exploration scrubber (R4), and the overlay `ghost` ids `{0: "bilayer_outline",
  1: "rigid_holed_slab", 2: "core_blocks_ion"}`.

---

### 5.2 · e2_selectivity · `sorter.bins` · **Membrane Router at the Crossing Gate** (S2, console x 6300, Board)

- **In-world object.** The **Crossing Yard**, which has two lanes.
  - **The Oil Road** (bin `diffuses`, "Crosses the bilayer alone") is a 300 px stretch of bare heads ringed by a navy
    inlay circle plate.
  - **The Crossing Gate** (bin `protein`, "Needs a transport protein") is a channel protein. Its arch stands 2.2 H above
    ground and its ring body continues down through the bilayer band. It has an **outer ring** and an **inner
    selectivity ring** with 6 notches, and gold keystone fins that split to open the arch.
  - Six molecules drift in the tide above the yard.
  - Sucra paces by the Oil Road.
- **Graded control.** Sort tokens into two **bin cards**. Draft `{ assignments }`. Items (keys by original index):
  - i0 O₂ → diffuses
  - i1 CO₂ → diffuses
  - i2 Na⁺ → protein
  - i3 glucose → protein
  - i4 steroid → diffuses
  - i5 Cl⁻ → protein
- **LIVE BINDING.**

| Source | Target | Formula |
|---|---|---|
| unassigned item *k* (display order) | drift in the tide | `x = X_yard − 450 + 150·k + 20·sin(0.6t + k)`, `y = y_s − 300 + 16·sin(0.9t + 2k)` |
| assigned to bin *b*, queue position *q* of *n_b* | queue above the lane mouth | `x = X_lane[b] + 56·(q − (n_b − 1)/2)`, `y = y_s − 90`, eased 0.25. X_lane: Oil Road centre, gate ring centre |
| panel focus on a token | world highlight | a white ring (r = 1.3× the molecule) + a name chip on that molecule |
| n_b | lane chips | `OIL ROAD: 3`, `GATE: 2`: **counts only, no capacity** (R2) |
| hint level ≥ 1 | **Pip's water lens** | a cone from Pip. Every polar or charged molecule shows a **hydration shell**: 6–8 blue `#4F92E6` droplets orbiting at 1.4× its radius, 0.3 rev/s. Nonpolar molecules show none |
| any drop | gate "listening" | the gate's inner ring turns 10° toward the newest queued molecule (a claim render, not a verdict) |

- **Panel (Board, 55 %).**
  - **Palette column** (bible §3.6): six molecule tokens (orb style, the molecule glyph inside, its name below).
  - Two stacked **bin cards**, drawn as membrane cross-section art (§7.7):
    - **"OIL ROAD · crosses the bilayer alone"**: a bare bilayer strip with a dotted path straight through.
    - **"CROSSING GATE · needs a transport protein"**: a strip with a channel.
  - Tokens snap into a row inside the card.
  - A **selectivity reference** strip under the cards: a mini legend of the glyph notation (+/− = charge, the droplet
    ring = polar shell, shown only after hint 1).
  - Verify **"ROUTE CARGO"** (enabled when all 6 are placed).
- **Verify.** `bins.grade`: all placed, and each `binId` matches.
- **Success (≈ 2.2 s).**

| t (ms) | What happens |
|---|---|
| 0 | Badge **"CARGO ROUTED"** |
| 0–600 | Oil Road molecules sink through the heads: the heads part (the same Gaussian as e1), the molecule wobbles through the tails and emerges into the cytoplasm glimpse below with a soft green flash. sfx `slip` |
| 300–1100 | Gate molecules pass one by one: the inner ring rotates 60° per molecule and a flash shows in the pore. The glucose rides a carrier pocket and **Sucra hops in with it** |
| 1100–2000 | The gate's keystone fins split ±28° and the arch doors part. A light shaft spills out. Conduit 2 lights. sfx `gate_open` |
| 2000 | Beyond the arch, the **carrier rocker** (a big cream see-saw protein) tilts 22° and becomes a ramp to the +1 H terrace. Gradient 18 → 26 % |

- **Failure (R2 + R5).** All molecules hold. **Only the first miss** acts:
  - If a polar or charged molecule was on the Oil Road, it drops, **bounces off the heads** (the heads flash
    `lipid.head.lit`, ripple, sfx `boing_soft`) and drifts back to the tide.
  - If a nonpolar molecule was at the gate, the selectivity ring flashes its notches, **refuses it** (a 1-notch rotation
    back) and it drifts back.
  - The panel keeps every placement. The bar shows `e2_fail`, then `grade()` feedback (which names that item's bin and
    its feature).
- **Visible misconception.** "Anything small passes freely": Na⁺ (drawn smaller than O₂) visibly bounces off the Oil
  Road on failure, and its hydration shell (hint 1) explains why.
- **Insight line.** `e2_insight`.
- **Extensions.** Bins draft (R3), and overlay per item `{glyph, polar, charged}` (for the lens) plus per bin
  `{laneId}`.

---

### 5.3 · e3_diffusion · `truth_finder.mimic` · **Specimen Pods at the Dye Tank / Balance Lock** (S3, console x 8500, Scrub)

- **In-world object.** The pods, the **Dye Tank** and the **Balance Lock**.
  - **Dye Tank:** a glass tank 780×310 px in a cream frame with gold corners. It has two chambers split by a
    **membrane window**, a vertical bilayer strip with 5 pore gaps.
  - **Balance Lock:** a gold beam, 5 H long, on a cream pivot pillar that crosses the road as a boom barrier. Its ends
    hang by chains to floats in each chamber.
- **Graded control.** The claim tiles:
  - s0 random motion (true)
  - s1 "head for the empty side on purpose" (**mimic**, index 1)
  - s2 net high → low (true)
- **Exploration scrubber.** Tab **"a"**, "dye load", **0 – 10 mM**, step 0.5, labels 0–10.
- **Simulation (seeded, R7).**
  - A change of *a* reloads the left chamber with `N = round(10·a)` dye particles (max 100). The right chamber empties
    and t resets to 0.
  - Each particle random-walks: dt = 1/30 s, Gaussian step σ = 5 px, reflecting walls.
  - At the window a particle passes with p = 0.3 per contact.
  - Concentrations: `C_L = N_L/10`, `C_R = N_R/10` (mM).
  - Measured net flux: `J = (crossings L→R − crossings R→L) / 2 s` over a sliding 2 s window.
  - **Tracer:** particle #0 has a white ring and a 60-point fading trail (it visibly doubles back toward the crowd).
- **LIVE BINDING.**

| Source | Target | Formula |
|---|---|---|
| a | left chamber refill | `N = round(10a)` |
| sim | Balance beam tilt | `θ = clamp(2.2°·(C_L − C_R), −18°, 18°)`, eased 0.2. Chains follow the beam ends |
| sim | floats | the float in each chamber sinks ∝ C (`Δy = 6 px · C`) |
| sim | world chips | `C_L: 4.1 mM`, `C_R: 0.9 mM`, `J: +1.8/s` (arrow on the window, length `12 px · |J|`), `tracer` |
| draft.statementIndex | ghost | the ghost table |

| Ghost | Render | Versus reality |
|---|---|---|
| s0 random, bumping | jitter trails on 6 ghost particles, same statistics | matches |
| s1 **on purpose** | ghost particles **march in straight lines** in formation from left to right, with arrowheads, and **all stop** once the right side fills | contradicts: the real particles jitter, the tracer wanders back left, and at equilibrium the real particles keep moving |
| s2 net high → low | one big ghost arrow sized by the predicted `J₀ = 0.35·(C_L − C_R)` | matches the measured J chip in sign and magnitude |

- **Panel (Scrub).** All cards share the x-axis *a* (0–10 mM), so the scrubber line crosses all three.
  - Card **f** (white) **"C_L start = a"**: the line y = a; chip "5.0 mM".
  - Card **g** (green) **"C_eq = a/2"**: the line y = a/2; chip "2.5 mM".
  - Card **h** (blue) **"J₀ = 0.35·a"** (unit "/s"); chip "1.8/s".
  - **Live dots** on the scrubber line: on card f a white dot slides from *a* down toward *a/2* as C_L(t) falls, and on
    card g a green dot rises from 0 to *a/2*. The lines are the start and the destination; the dots are now.
  - The claims card sits under the stack. Verify **QUARANTINE POD**.
- **Verify.** `mimic.grade`, correct iff `statementIndex = 1`.
- **Success payoff (≈ 2.5 s).**
  - The shared pod sequence plays.
  - The window **dilates** (p → 1) and the sim runs at 3× until `|C_L − C_R| < 0.2`, capped at 1.2 s.
  - The beam levels to 0°, the latch clicks (sfx `latch`), and the beam lifts 85° like a boom barrier (500 ms).
  - Conduit 3 lights; gradient 26 → 32 %.
  - **If a = 0 at success** (no dye), the lock also opens: Ora ad-libs "Empty and even counts too."
- **Failure.** Shared. The tracer's trail flashes white for 1 s ("look here").
- **Visible misconception.** "Particles move toward empty space on purpose": the s1 formation ghost against the
  wandering tracer, and the ghost stops at equilibrium while the real dye never does.
- **Insight line.** `e3_insight`.
- **Extensions.** Mimic draft, the scrubber, ghost ids `{0: "random_walk", 1: "purposeful_march", 2: "net_flux_arrow"}`,
  and sim params `{p: 0.3, sigma: 5}` in the overlay.

---

### 5.4 · e4_osmosis · `truth_finder.mimic` · **Specimen Pods at the Osmometer Basin / Raft Lock** (S3, console x 10500, Scrub)

- **In-world object.** The pods, the **Osmometer Basin** and the **Raft Lock**.
  - **Osmometer Basin:** a glass basin (620×300 px) holding the **Test Cell**. The cell is 1.6 H across, with a membrane
    ring of tiny heads, peach cytoplasm, a nucleus dot, and **inside salt fixed at 2 %** (4 white cubes inside) in a bath
    of salt water.
  - **Raft Lock:** a 3 H shaft next to the basin, separated from it by a **membrane window**. It is dry, with a cream raft
    on its floor at road level, and the upper ledge sits 2 H above.
- **Graded control.** The claim tiles:
  - s0 water leaves toward the saltier side (true)
  - s1 "salt rushes in until both match" (**mimic**, index 1)
  - s2 the cell shrinks (true)
- **Exploration scrubber.** Tab **"s"**, "bath salt", **0 – 10 %**, step 0.1, labels 0–10. The scenario banner on the
  claims card reads "Claims are about a SALTY bath (s > 2 %)". Ghosts project only when `s > 2.5`. Below that the pods
  dim and read "outside the claim's scenario", which is itself a lesson in conditions.
- **LIVE BINDING** (C_in = 2 %, b = 0.3 osmotically inactive fraction):

| Source | Target | Formula |
|---|---|---|
| s | cell volume | `V/V₀ = b + (1 − b)·C_in / max(s, 0.3)`, clamp [0.55, 1.6]; radius `r = r₀·√(V/V₀)`; eased 0.12 (osmosis looks deliberate, ≤ 0.4 s) |
| V | cell surface | V < 0.8: **crenation**, a scalloped outline with amplitude `6·(0.8 − V)/0.25` px, 14 lobes. V > 1.3: a strained highlight ring and a faint `#FFFFFF` stretch sheen |
| s | water droplets | droplets cross the cell membrane at `w = 6·(s − C_in)` per s. Positive → outward (arrows out), negative → inward. `fn.h` blue |
| s | salt cubes outside | count `8·s` (max 80), random walk, **reflect off the cell membrane with a tiny spark** (they never cross) |
| s, V | world chips | `salt: 6.0%` on the bath, `V: 74%` on the cell, `water: out` beside the droplet stream |
| draft.statementIndex | ghost | the table below |

| Ghost | Render | Versus reality |
|---|---|---|
| s0 water leaves toward the salt | blue ghost arrows pointing out of the cell | matches for s > 2 |
| s1 **salt rushes in** | ghost salt cubes **streaming into** the cell, and a ghost inside-salt level rising to meet the bath | contradicts: the real cubes bounce off every time, and the inside stays at 4 cubes |
| s2 cell shrinks | a smaller ghost outline | matches the eased real radius |

- **Panel (Scrub).** Shared x = s (0–10 %).
  - Card **f** (white) **"salt outside = s"**: the line; chip "6.0%".
  - Card **g** (green) **"salt inside = 2%"**: a flat line; chip "2.0%". A small white tick marks s = 2 on both cards:
    the isotonic crossing.
  - Card **h** (blue) **"V/V₀(s)"**: the decreasing curve; chip "0.74".
  - The claims card and Verify **QUARANTINE POD**.
- **Verify.** `mimic.grade`, correct iff `statementIndex = 1`.
- **Success payoff (≈ 2.4 s, the player rides).**
  - The shared pod sequence plays, then Ora line `e4_success` and a prompt: "Step aboard". The raft glows. The payoff
    waits for the player to step on it, at most 6 s; after that Pip tows them on automatically.
  - Salt cubes pour into the Raft Lock (40 cubes, 400 ms).
  - Blue droplets stream from the basin through the membrane window **toward the salt** (osmosis, 1.6 s).
  - The lock's water level rises 0 → 2 H and the raft (with the player locked to it) floats up to the ledge.
  - Conduit 4 lights; gradient 32 → 40 %.
- **Failure.** Shared, and three bath cubes flash as they bounce.
- **Visible misconception.** "Salt crosses instead of water": every salt cube bounces, and the s1 ghost streams them
  in.
- **Insight line.** `e4_insight`.
- **Extensions.** Mimic draft, the scrubber, ghost ids `{0: "water_out_arrows", 1: "salt_inflow", 2: "shrink_outline"}`,
  and overlay `{cIn: 2, b: 0.3, scenarioMin: 2.5}`.

---

### 5.5 · e5_tonicity · `sorter.type_match` · **Tonicity Sluices** (S4, console x 12600, Sluice layout)

- **In-world object.** The **sluice trench**, flooded 1.5 H deep.
  - A canal crosses it with one **Label Lock**: a stone chamber with gates at both ends and a big bronze **valve
    wheel** above, three spokes each ending in a plaque.
  - Downstream are three **holding basins** with plaques HYPO / ISO / HYPER, and the **Eddy**, an unlabelled swirl
    basin for timeouts.
  - Cells drift in from the left canal mouth.
- **Graded control.** Three **valve buttons** (Hypotonic / Isotonic / Hypertonic; keys 1–3), **one wave at a time**,
  `secondsPerWave = 8`. Draft `{answers, waveIndex, secondsLeft, hover}`.
- **Waves.** The overlay gives the visual parameters for each wave; the text is the view's.

| wave | text (view) | overlay visual | fate (stated in the text, so animated live) |
|---|---|---|---|
| w0 | RBC in pure water, swelling | `cell: rbc`, inside dots 10, outside dots 0 | swell `ΔV = +0.45` |
| w1 | cell in seawater, shrivelling | `cell: generic`, inside 10, outside 30 | shrink `ΔV = −0.30`, crenate |
| w2 | cell in a matching solution, unchanged | `cell: generic`, inside 10, outside 10 | steady |
| w3 | plant cell in salty soil water, losing turgor | `cell: plant`, inside 10, outside 28 | **plasmolysis**: the protoplast pulls away from the rigid wall, inner `ΔV = −0.3` |
| w4 | cell in a dilute drink, about to burst | `cell: generic`, inside 10, outside 2 | swell `ΔV = +0.55`, a strain ring |

- **LIVE BINDING.**

| Source | Target | Formula |
|---|---|---|
| secondsLeft (T = 8) | cell position | `x = X_in + (1 − secondsLeft/T)·(X_out − X_in)`, continuous (interpolate between ticks) |
| wave time | cell volume (stated fate) | `V(t) = 1 + ΔV·(1 − secondsLeft/T)` |
| hover / focus of a valve c | lock bath (claim render) | the lock bath's solute dot density `ρ_out = ρ_in·k_c`, with `k = {hypo: 0.25, iso: 1.0, hyper: 2.5}` (dots fade in and out over 200 ms). The valve wheel rotates to −60°, 0° or +60° |
| hover c | gradient card bars | f bar = the claimed outside level, g bar = the overlay's inside level. **No water arrows on hover** (arrows would do the reasoning; R2) |
| commit c | lock | the plaque for c slides down onto the cell's tag, the downstream gate opens, and the cell floats into basin c |
| timeout | lock | the cell drifts into the **Eddy** (it spins slowly); `e5_timeout` plays once per encounter |

- **Panel (Sluice layout, 40 %).**
  - A **wave queue strip** at the top: 5 cell tokens (the current one highlighted; answered ones carry their chosen tag).
  - Card **f** (white) **"solute outside"**: a bar gauge (the claim).
  - Card **g** (green) **"solute inside"**: a bar gauge (given).
  - Card **h** (blue) **"volume V(t)"**: a sparkline over the wave's 8 s, with a thin **white** timer line sweeping (not
    orange: the timer is not input).
  - A **timer ring** around the valve cluster.
  - Three big valve buttons.
  - After the last wave, **Verify "DRAIN THE SLUICE"** enables.
- **Verify.** `type_match.grade({answers})`: every wave answered and correct, where a missing (timed-out) answer counts
  wrong.
- **Success (≈ 2.2 s).**
  - Badge **"SLUICE DRAINED"**.
  - The basin gates open and each cell drifts out, completing its fate.
  - The trench water drains (level −1.5 H over 1.4 s, with a whirlpool at the drain grate).
  - This reveals **carved steps** on the far wall and a **side stair** to the secret alcove (§6.5).
  - Poro opens his eyes fully (`poro_2`). Conduit 5; gradient 40 → 48 %. The player climbs.
- **Failure.** The **first missed wave's** cell floats back into the Label Lock, and its tag blinks. `e5_fail` plays,
  then `grade()` feedback (which names that wave's category and why, so the world may now show that cell's correct bath
  density). Retry replays the waves **with previous answers preselected** (Enter confirms), so a retry is 5 quick
  keypresses, not 40 s of waiting.
- **Visible misconception.** "Hypertonic means more water": on hover, HYPER floods the lock with **more solute dots, not
  more water**, and the f bar towers over the g bar.
- **Insight line.** `e5_insight`.
- **Extensions.**
  - The type_match draft.
  - A panel variant with a **Verify step** instead of auto-submit on the last wave. `WavesPick` auto-submits today
    (`Pick.tsx:430-434`). The panel gathers the answers and submits on Verify, and `grade()` is unchanged.
  - Preselected answers on retry.
  - Overlay per wave `{cell, inDots, outDots, fate: "swell"|"shrink"|"steady"|"plasmolysis"|"strain", showFate: true}`.

---

### 5.6 · e6_facilitated · `sorter.bins` · **Threshold Router at the Carrier Door** (S4, console x 14900, Board)

- **In-world object.** The **Threshold Yard**.
  - The Pump Hall's **Carrier Door**: a revolving cream drum 2.4 H tall with one cargo pocket and gold hinge rings,
    set into the hall's façade (navy bands, three ring windows).
  - To its left, the **Glide Gate** (bin `passive`): a cluster of a channel ring and a small carrier rocker at the foot
    of a **downhill ramp**.
  - To its right, the **Pump Gate** (bin `active`): a compact gold-trimmed pump with an **ATP pipe** at the top of an
    **uphill ramp**.
  - Five cargo items float, each over its own little **gradient ramp** (a stone wedge; the dense-dot end is the
    crowded side).
- **Graded control.** Sort five cards into two bin cards. Items:
  - i0 glucose via carrier, high → low (passive)
  - i1 water via aquaporin (passive)
  - i2 Na⁺ pumped out, against (active)
  - i3 K⁺ leaking out via channel, high → low (passive)
  - i4 H⁺ into an acidic compartment (active)
- **LIVE BINDING.**

| Source | Target | Formula |
|---|---|---|
| item overlay `{from, to}` | gradient ramp under the cargo | the wedge slope `m = (C_to − C_from)/10`, drawn 120 px wide, rising where the cargo goes toward more crowding. It shows the text's stated direction (the concept visualised, not the answer) |
| assignment → bin | cargo position | glides to its gate's queue (the same queue formula as e2) |
| n_active | ATP card (claim render) | the reserve of 10 gold cells; `n_active` cells hatched as "would spend" |
| n_active | Pump Gate intake glow | alpha `0.2 + 0.15·n_active` |
| focus | cargo highlight | a white ring + a chip with the cargo's short name |

- **Panel (Board).**
  - The palette column holds 5 cargo cards (a mini ramp icon + text).
  - Bin cards:
    - **"GLIDE GATE · passive, no ATP"** (art: a channel + carrier in a strip, with a downhill arrow).
    - **"PUMP GATE · active, costs ATP"** (art: a pump with a gold spark, with an uphill arrow).
  - An **ATP card** (gold tab "ATP"): 10 cells, a projected-spend hatch, chip "−2".
  - Verify **"OPEN THE THRESHOLD"**.
- **Verify.** `bins.grade`.
- **Success (≈ 2.5 s).**
  - Badge **"THRESHOLD OPEN"**.
  - The passive cargo slides **down** its ramp through the Glide Gate: water beads through the channel in single file,
    K⁺ through the channel, and glucose rides the carrier rocker (a 180° rock) **with no spark**.
  - The active cargo is lifted **up** its ramp by the pump, each with a gold ATP spark. The ATP card actually spends 2
    cells.
  - The **Carrier Door** revolves 180° with the player and Sucra in its pocket (the ride), delivering them into S5.
  - Conduit 6; gradient 48 → 56 %; `sucra_3`.
- **Failure.** Only the first miss acts (R5):
  - A passive cargo in the Pump Gate: the pump fires an ATP spark that **fizzles**, and the cargo rolls away down its
    own ramp. Energy is wasted on something that would have gone downhill anyway.
  - An active cargo in the Glide Gate: it creeps up its ramp, stalls, and **slides back**.
  - `e6_fail`, then `grade()` feedback.
- **Visible misconception.** "A protein means energy": the glucose carrier and the aquaporin visibly move cargo **with
  zero sparks**, and the ATP card only drains for uphill cargo.
- **Insight line.** `e6_insight`.
- **Extensions.** Bins draft, and overlay per item `{glyph, from, to, vehicle: "carrier"|"channel"|"pump"}` (vehicle
  used only in the success animation).

---

### 5.7 · e7_active · `truth_finder.mimic` · **Specimen Pods at the Uphill Flume** (S5, console x 16700, Scrub)

- **In-world object.** The pods, and the **Uphill Flume**.
  - **Low Tank:** left, on the floor.
  - **High Tank:** right, raised 1.2 H on a cream plinth.
  - Between them a gold-trimmed **pump** with an **ATP feed pipe** from the ceiling rail, plus a **leak channel** (a
    passive return trough from high to low).
  - Na⁺ motes fill both tanks. Twelve dark **ATP lanterns** line the walls, and the **gantry lift** waits on gold rails.
- **Graded control.** The claim tiles:
  - s0 against the gradient (true)
  - s1 costs ATP (true)
  - s2 "always downhill, pumps just speed it up" (**mimic**, index 2)
- **Exploration scrubber.** Tab **"r"**, "ATP feed", **0 – 10 ATP/s**, step 0.5.
- **Model.** `ΔC_ss(r) = 0.96·r` mM (clamp 9.6), `C_high,ss = 5 + ΔC/2`, `C_low,ss = 5 − ΔC/2`. Tanks relax toward
  the steady state with τ = 1.2 s. The pump moves `0.8·r` motes/s uphill, each with a gold spark. The leak returns
  `0.35·(C_high − C_low)` motes/s down the trough. **At r = 0 the gap collapses**: this is the Stillness, shown in
  miniature.
- **LIVE BINDING.**

| Source | Target | Formula |
|---|---|---|
| r | pump piston | stroke frequency `0.4·r` Hz, a gold spark per stroke |
| r | ATP pipe | glow alpha `0.15 + 0.08·r`, with light packets flowing down the pipe at speed ∝ r |
| sim | tank fills | mote counts `= 8·C`, fill-level lines + chips `C_high: 8.6 mM`, `C_low: 1.4 mM` |
| r | chip | `ATP: 7/s` on the pipe |
| draft | ghost | the table below |

| Ghost | Render | Versus reality |
|---|---|---|
| s0 against the gradient | a ghost arrow low → high through the pump | matches when r > 0 |
| s1 costs ATP | ghost gold sparks at the pump, one per stroke | matches |
| s2 **pumps speed up downhill** | ghost motes **pushed from High to Low** faster as r rises, and a **ghost curve** on card f that **falls** with r | contradicts: the real High Tank climbs with r, and the real curve rises |

- **Panel (Scrub).** Shared x = r (0–10 ATP/s).
  - Card **f** (white) **"C_high(r)"**: rising, y 0–10 mM.
  - Card **g** (green) **"C_low(r)"**: falling.
  - Card **ATP** (gold, in the h position) **"ATP spent/s = r"**: a gold line.
  - Chips, the claims card, and Verify **QUARANTINE POD**.
- **Verify.** `mimic.grade`, correct iff `statementIndex = 2`.
- **Success payoff (≈ 2.4 s).**
  - The shared pod sequence plays.
  - The 12 **lanterns ignite** in sequence (80 ms apart, gold additive pools on the walls, `L6` lantern light on), and
    the hall re-saturates.
  - The gold rails light, and the **gantry lift** powers: its platform rises 2 H to the pump deck with the player
    aboard (1.2 s).
  - Conduit 7; gradient 56 → 64 %. Kay cheers.
- **Failure.** Shared, and the flume stutters once (the pump piston skips a stroke).
- **Visible misconception.** "Transport always goes down the gradient": set r = 0 and the gradient collapses. Only
  paying ATP holds cargo uphill.
- **Insight line.** `e7_insight`.
- **Extensions.** Mimic draft, the scrubber, and ghost ids `{0: "uphill_arrow", 1: "atp_sparks", 2: "downhill_boost"}`.

---

### 5.8 · e8_pump · `linker.pairs` · **Pump Rewiring** (S5 pump deck, console x 18700, Scrub layout with a link board)

- **In-world object.** **The Na⁺/K⁺ pump**, 3.5 H, spanning the deck's bilayer floor from above ground to below.
  - An **outer housing** (cream stone, navy bands, gold rim) with an **upper jaw** (opens outward to the extracellular
    side) and a **lower jaw** (opens to the cytoplasm).
  - An **inner drum** (rotates in 60° steps) carrying **Na⁺ sockets** (coral) and **K⁺ sockets** (violet).
  - An **ATP port** (gold), fed by a rail pipe.
  - A **control plinth** at left with **4 cable sockets** (the lefts), and a **cartridge rack** at right with **5 value
    cartridges** (the rights + decoy, in display order).
  - The pump's crank is chained to the **Hall Gate**.
  - The **Nerve Beacon** (a neuron-shaped tower in L2, seen through the ring window) is dark.
- **Graded control.** Link each socket to a cartridge (click a socket then a cartridge; keys: ↑/↓ to choose a socket,
  1–5 for a cartridge). Draft `{links}`. The pairs:
  - l0 Na⁺ per cycle → r0 "3, out of the cell"
  - l1 K⁺ per cycle → r1 "2, into the cell"
  - l2 energy → r2 "1 ATP"
  - l3 dependents → r3 "Nerve and muscle cells"
  - Decoy x0 "2, out of the cell".
- **Exploration scrubber.** Tab **"k"**, "pump stage", **0 – 6**, integer steps. Ruler labels:

| k | Stage |
|---|---|
| 0 | rest |
| 1 | bind Na⁺ |
| 2 | ATP |
| 3 | flip out |
| 4 | swap |
| 5 | drop P |
| 6 | flip in |

- **Cartridge semantics** (overlay, by right key): r0 `{ion:"Na", n:3, dir:"out"}`, r1 `{ion:"K", n:2, dir:"in"}`,
  r2 `{atp:1}`, r3 `{beacon:"Nerve and muscle cells"}`, x0 `{n:2, dir:"out"}`. A cartridge linked to a socket of
  another kind (for example "1 ATP" into the Na⁺ socket) loads nothing: the socket shows a dim "?" glyph. That is a
  physical non-fit, not a verdict.
- **LIVE BINDING — `pose(k, links)`.**

| Source | Target | Formula |
|---|---|---|
| k | drum angle | `φ = 60°·k`, eased 0.2 |
| k | conformation | inward-open for k ∈ {0,1,2,6}: the lower jaw opens 35°. Outward-open for k ∈ {3,4,5}: the upper jaw opens 35° |
| link(l0) = `{n, dir}` | Na⁺ sockets | `n` sockets visible on the drum. At k ≥ 1, n Na⁺ ions snap in from the cytoplasm side. At k = 4 they release toward `dir` (up = out, down = in) |
| link(l1) = `{n, dir}` | K⁺ sockets | `n` sockets. At k = 4, n K⁺ bind from the `dir`-opposite side; at k = 6 they release toward `dir` |
| link(l2) = `{atp}` | ATP port | at k = 2, `atp` gold sparks enter the port (1 spark = a bright flash; "?" if not an ATP cartridge) |
| link(l3) | Nerve Beacon | its plaque shows the linked cartridge's text. At k = 6 the beacon pulses with brightness ∝ net charge moved |
| links | **Charge ledger** | `q = n_Na,out − n_K,in` (signed by the linked directions). A needle "inside − / +" leans `−30°·clamp(q, −1, 1)` |
| cable | visuals | each link draws a gold-cored cable from socket to cartridge (a catenary sag of 40 px); the focused socket glows |

- **Panel (Scrub proportions, with a link board in place of the upper card).**
  - A **link board card** (tab "wiring"): 4 sockets on the left in fixed order, 5 cartridges on the right in display
    order, and the cables drawn between them.
  - A **cross-section card** (tab "pump"): the pump schematic at stage k, with ions per the links.
  - A **charge-ledger card**: a white bar "Na⁺ out", a green bar "K⁺ in", and a net chip "q = +1".
  - The stage scrubber (orange) and Verify **"RUN ONE CYCLE"** (enabled when all 4 sockets are linked).
- **Verify.** `pairs.grade({links})`: each lN ↔ rN.
- **Success (≈ 2.4 s).**
  - Badge **"PUMP CYCLING"**.
  - Two full automatic cycles (k 0 → 6 at 170 ms per stage, ×2). Each cycle: 3 coral Na⁺ jet up into the tide, 2 violet
    K⁺ are drawn down into the cytoplasm, and one gold spark.
  - The ledger ticks q = +1 per cycle, and the crank lifts the **Hall Gate** 0.5 H per cycle (then the gate locks
    open).
  - The **Nerve Beacon fires**: a light pulse races along its axon cable across L2 (an action-potential visual).
  - Conduit 8; gradient 64 → 78 % (the biggest jump: this machine *is* the gradient). `kay_2`.
- **Failure.** Stage-by-stage run (170 ms per stage) that **jams at the first wrong link's stage** (R5, key order l0 → l3):
  - l0 wrong → jams at k = 1: the drum loads the wrong count and grinds (a 3 px shake, sfx `clunk`).
  - l1 wrong → jams at k = 4.
  - l2 wrong → k = 2: the spark misfires.
  - l3 wrong → the cycle completes but the Beacon's plaque flickers and stays dark.
  - Other sockets show nothing extra. `e8_fail`, then `grade()` feedback (it quotes the clue `why`).
- **Visible misconception.** "Equal numbers each way": wire the decoy "2, out" into Na⁺ and the ledger reads **q = 0**,
  the needle stays upright, and at k = 6 the Beacon barely glows. A balanced pump builds no charge difference.
- **Insight line.** `e8_insight`.
- **Extensions.** Pairs draft, the stage scrubber, overlay cartridge semantics (by right key) and per-left
  `{stage, socketKind}`.

---

### 5.9 · e9_osmosis_review · `sorter.type_match` · **Return Sluice / Barge Lock** (S6, console x 20800, Sluice layout)

- **In-world object.** The same kit as §5.5, re-skinned at dusk.
  - A **Label Lock** whose valve plaques read IN / OUT / NONE.
  - Three holding basins.
  - The **Barge Lock**: a low canal with a cream barge on which the player stands during the encounter. The console is
    on the barge.
- **Graded control.** Three valves (Water moves in / Water moves out / No net movement), 4 waves, 8 s each.
- **Waves.** Here **the fate is not stated in the text**, so `showFate: false`: the fate is a verdict and waits for
  Verify (R2).

| wave | text | overlay visual |
|---|---|---|
| w0 | 2 % inside, 10 % bath | `cell: generic`, inDots 8, outDots 40 |
| w1 | 2 % inside, distilled water | `cell: generic`, inDots 8, outDots 0 |
| w2 | 0.9 % in 0.9 % saline | `cell: rbc`, inDots 4, outDots 4 |
| w3 | potato cells in sugar syrup | `cell: plant` (a potato-cell skin: starch granules as cream ovals), inDots 10, outDots 45 (sugar hexagons instead of cubes) |

- **LIVE BINDING.** Cell position vs time is the same as e5; volume stays at 1 (fate hidden).
  - Solute dots inside and outside are drawn from the overlay, since the text states them.
  - **Hovering a valve draws ghost water arrows for that claim** (in: inward arrows; out: outward; none: arrows both
    ways, equal and balanced). This renders the claim. Judging it against the dot densities is the reasoning.
  - The gradient cards show f = outside bar and g = inside bar (from the overlay), and h = a "claimed flow" arrow gauge.
- **Panel.** As §5.5. Verify **"FILL THE LOCK"**.
- **Verify.** `type_match.grade`.
- **Success (≈ 2.3 s).**
  - Badge **"LOCK FILLED"**.
  - All four cells animate their true fates at once in their basins: w0 shrinks, w1 swells, w2 steady, and w3's
    potato protoplast pulls from its wall.
  - The Barge Lock fills +2 H, lifting the barge to the Endocytosis Pit ledge. Conduit 9; gradient 78 → 84 %.
- **Failure.** The first missed wave's cell returns to the lock. After `grade()` feedback names its category, the world
  may animate that one cell's true fate (the same information). Retry with answers preselected.
- **Visible misconception.** "Salt crosses instead of water": the salt dots stay perfectly put through every animation,
  and only blue droplets cross.
- **Insight line.** `e9_insight`.
- **Extensions.** As §5.5, with `showFate: false` per wave.

---

### 5.10 · e10_bulk · `sequencer.linear` · **Endocytosis Lift** (S6, console x 22900, Scrub layout with a plank rail)

- **In-world object.** The **Endocytosis Pit**.
  - A 700 px membrane dimple ringed by a **clathrin lattice**: hexagon/pentagon cage cells made of cream triskelions
    with gold joints, lying flat and dormant.
  - A gold **dynamin collar** (a coiled ring) hangs from a cream gantry above the pit's centre.
  - The ***Halcyon*** rests in the pit, with **the Diver aboard** (after the approach line, the player walks into the
    sub; the camera keeps the sub centred).
  - Four **stage lamps** (round bronze-framed plates) sit on the Lift frame beside the Ferryman.
- **Graded control.** Place plates into 4 slots from 5 shuffled planks. Draft `{keys}`. The steps:
  - s0 touch
  - s1 fold inward
  - s2 pinch off
  - s3 vesicle carries
  - d0 (decoy) "dissolves through the bilayer on its own"
- **Exploration scrubber.** Tab **"k"**, "playback", **0 – 4**, continuous, labels 0–4. It plays **the player's own
  sequence** through the membrane physics.
- **Stage physics (pure, cumulative, R7).** State `S = {depth D, wrap ω, neck n, detached, travel, bounced}` starts
  flat: `{0, 0°, 1, false, 0, false}`. `S_k = apply(step in slot k, S_{k−1})`:

| Step | Requires | Effect if the requirement is met | Effect if it isn't (the visible trap) |
|---|---|---|---|
| s0 touch | — | the sub settles, `Dy = −0.05 H`, receptor glyphs on the heads light cyan | — |
| s1 fold | touched | `D → 1.3 H`, `ω → 300°`, `n → 0.6`, the clathrin lattice curves into a basket | without contact, the membrane dimples slightly (D 0.2 H) and relaxes: nothing to fold around |
| s2 pinch | `ω ≥ 270°` | `n → 0`, `detached = true`, a gold spark at the dynamin collar, the vesicle closes around the sub | **an empty micro-vesicle** (0.3 H) pinches off the flat membrane and floats away, and the sub stays outside |
| s3 carry | detached | `travel → 1`: the vesicle rides a microtubule rail down 4 H into the cytoplasm | the rail lights, but nothing is on it |
| d0 dissolve | — | the sub presses into the heads, compressing them 20 %, and **springs back** 0.2 H (`bounced`) | — |

  The pose at a fractional k blends `S_⌊k⌋ → S_⌈k⌉` (ease-in-out). Empty slots are skipped.
- **LIVE BINDING.**
  - k → the full pose above (membrane path points, lattice curvature, collar radius, sub y).
  - Each filled slot lights its **stage lamp** with that plank's icon.
  - World chips: `stage: 2.4` on the collar and `depth: 1.1 H` on the pit.
  - The ATP card ticks a gold cell each time a fold or pinch pose is **entered** (claim render of cost).
- **Panel (Scrub proportions).**
  - A **plank palette** (5 plates, icon + text).
  - A **stage rail** of 4 slots connected by dot-ended trace lines.
  - A **cross-section card** mirroring the pose schematically.
  - An **ATP card** (gold).
  - The playback scrubber (orange) and Verify **"LAUNCH THE LIFT"** (enabled when 4 slots are filled).
- **Verify.** `linear.grade({keys})`: no decoy, and the order is s0, s1, s2, s3.
- **Success (≈ 2.4 s, then the descent).**
  - Badge **"VESICLE LAUNCHED"**. Automatic playback 0 → 4 (0.5 s per stage) with the correct physics.
  - The camera follows the vesicle down 4 H through the bilayer band (the heads close over it) while the sky
    **crossfades** from pit-dusk to the **cytoplasm sky** (1.5 s).
  - The vesicle docks on the Vault Road, **uncoats** (clathrin cells drift off as sparkles) and pops open. The player
    steps out, and Pip follows.
  - Conduit 10 lights **in the ceiling band above**; gradient 84 → 90 %. Scene change S6 → S7 (the only fade: 200 ms
    white bloom at dock).
- **Failure.**
  - A decoy present → playback runs to the decoy's slot, the sub bounces off the heads, the Ferryman says `ferry_hold`,
    then `grade()` feedback ("isn't part of this process").
  - An order error → playback runs to the first wrong slot, and the trap in the table plays (an empty micro-vesicle, a
    rail with nothing on it), then `grade()` feedback ("Slot k is out of place…").
  - The slots keep their plates.
- **Visible misconception.** "Vesicle transport is passive": the ATP card ticks at fold and pinch, and the dynamin
  spark is gold (energy colour).
- **Insight line.** `e10_insight`.
- **Extensions.** Linear draft (slot array with nulls), the playback scrubber, and overlay per step key `{stageId,
  icon}`.

---

### 5.11 · e11_boss · `sorter.bins` · **The Gatekeeper** (S8, console x 27400, Board)

- **In-world object.** The **Gatekeeper** (6 H) and his three maws:
  - **Oil Maw** (bin `simple`), lined with lipid heads.
  - **Channel Maw** (bin `facilitated`), with a bronze selectivity ring.
  - **Pump Maw** (bin `active`), with gold teeth and an ATP pipe up his back.

  His **eye-ring** tracks the action. Behind him is the **Nuclear Pore** (5.5 H): an 8-spoke outer ring, an inner ring
  and a plug, with 11 conduit sockets around its rim (10 lit by now, the 11th dark). Seven cargo items float in the
  eddy, each over a gradient ramp. The console is a cream kiosk with a round emblem panel (frame 10's kiosk).
- **Graded control.** Sort 7 cards into 3 bin cards. Items:
  - i0 O₂ into a cell that has used up its oxygen (simple)
  - i1 glucose via carrier, high → low (facilitated)
  - i2 Na⁺ pumped against (active)
  - i3 water via aquaporin (facilitated)
  - i4 CO₂ leaving (simple)
  - i5 K⁺ pumped into a cell with lots of K⁺ (active)
  - i6 Cl⁻ via channel, high → low (facilitated)
- **LIVE BINDING.**

| Source | Target | Formula |
|---|---|---|
| assignment | cargo | floats to the maw's queue in front of his chest (the queue formula, `y = y_s − 1.8 H`) |
| focus on a token | eye-ring | the pupil-ring rotates to face that cargo: `angle = atan2(c.y − eye.y, c.x − eye.x)`, eased 0.15 |
| focus on a bin | maw | that maw opens 12° (the jaw plates part) and glows faintly |
| n_active | ATP card + back pipe | projected spend hatched on 12 gold cells; the pipe glow `0.2 + 0.1·n_active` |
| hint ≥ 1 | Pip's water lens | hydration shells, as in e2 |
| item overlay `{from, to}` | gradient ramps | as in e6 |

- **Panel (Board).**
  - The palette column (7 cargo cards).
  - Three bin cards with cross-section art:
    - **"OIL MAW · simple diffusion"** (a bare bilayer, downhill).
    - **"CHANNEL MAW · facilitated diffusion"** (a channel, downhill, no spark).
    - **"PUMP MAW · active transport"** (a pump, uphill, gold spark).
  - An **ATP card** (reserve 12).
  - Verify **"OPEN THE VAULT"**.
  - When the Gatekeeper speaks, **his emblem replaces Ora's** in the dialogue bar.
- **Verify.** `bins.grade`.
- **Success (≈ 2.5 s, then the finale phase).**

| t (ms) | What happens |
|---|---|
| 0 | Badge **"VAULT OPEN"**; `e11_success` (the Gatekeeper) |
| 0–1400 | Each maw swallows its cargo in turn (200 ms apart): Oil Maw cargo **dissolve** through its head lining; Channel Maw cargo **spin** through the ring (no spark); Pump Maw cargo are pushed **up** the ramp with a gold spark (the ATP card spends 2) |
| 1400 | The eye-ring turns gold. The Gatekeeper **rotates aside** 90° on his base (a 600 ms ground-shake, 3 px), turning his profile to open the road |
| 2000 | Three beams from his maws + conduit 11 light the last rim socket. **All 11 conduits converge** on the pore |
| 2500 | → **finale phase** (map D2): the pore's outer ring rotates +90°, the inner ring −135°, the plug retracts, and white-gold light floods out (additive quad, 1.2 s). `gk_3`, then `out01`–`out06` play while the player walks in. Gradient 90 → 100 %; the world re-saturates to full and the ambient motes separate vividly. Fade to EndScreen |

- **Failure.** The first mis-sorted cargo (R5) is **spat back** out of its maw with a puff of bubbles, and the
  Gatekeeper rumbles (a 4 px, 200 ms camera shake: gentle). `e11_fail` (his line), then `grade()` feedback (it names
  the correct category and feature for that one item).
- **Visible misconception.** "Transport always goes down the gradient": Pump Maw cargo visibly climbs its ramp, paying
  a gold spark per climb, and nothing in the other two maws ever sparks.
- **Insight line.** `e11_insight`.
- **Extensions.** Bins draft, overlay per item `{glyph, from, to, polar, charged}`, the `finale` phase (D2), and
  after-beat capture (D1).

---

## 6 · Side content and purpose systems

### 6.1 Lore plaques (5 + a bonus): teach in context
Plaques are cream stone posts (0.8 H) with a round navy emblem plate. Pip scans a plaque when the player presses E
nearby. The text types into the dialogue bar (the `narrator` caption style) and is logged in the **Logbook** (the
Cell Chart's second tab). Each plaque found adds its bonus line to the debrief (a "What you found" list).

| id | Scene / spot | Access | Teaches (in context) |
|---|---|---|---|
| P1 The Two Faces | S1, x 1400, on a glycan-root ledge | jump tutorial | amphipathic lipids, which explains the ground under your feet |
| P2 Why Oil Says No | S2, on a ledge behind the Crossing Gate | only after the e2 carrier-ramp payoff | why charge is blocked (the e2 rule, deepened after the fact) |
| P3 The Jittering Grains | S3 upper ledge | reached by the e4 raft | Brownian motion as the engine of diffusion (history + concept) |
| P3b Poro's Ledger | S4, given by Poro after e5 | automatic | aquaporins: single-file water, only water |
| P4 The Lopsided Engine | S5 pump deck | after the e7 gantry | 3 : 2 : 1 and the negative interior (reinforces e8) |
| P5 Doors Made of Door | S6 pit rim | before e10 | endocytosis/exocytosis symmetry (primes e10) |

### 6.2 Objective HUD (top-left), the Gradient Meter and the zone ring
- **Objective ring** (bible §3.10). A 55 px double ring (white @ 60 %) that **fills clockwise per restored gate in the
  current zone**: zone A 2 arcs, B 4, C 4 (e7–e10), D 1. On zone change it empties and re-segments with a 400 ms
  sweep.
- **Beside the ring** (24 px caps, white):
  - `GATES 3/11`.
  - `GRADIENT 32%`, drawn as a thin **bilayer bar**: two rows of tiny heads whose white (outside) and green (inside)
    fills pull apart as G rises.
- **Gradient progression** (G is also the ambient-mote driver, §2.4):

| after | e1 | e2 | e3 | e4 | e5 | e6 | e7 | e8 | e9 | e10 | e11 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| G % | 18 | 26 | 32 | 40 | 48 | 56 | 64 | 78 | 84 | 90 | 100 |

- **Seal nodes.** Each zone has one visible hub node (S1 node → the Crossing Gate, the Sluice Tower, the Pump crank, the
  Nuclear Pore). Conduit packets flow into them, so progress is visible in the world as well as in the HUD.

### 6.3 Micro-quests
- **Kay's Lanterns (S5).** Three dark ATP lanterns sit on side ledges:
  1. behind the Low Tank (a crouch-walk under a pipe);
  2. atop the gantry rails (jump from the risen platform);
  3. on the pump deck's back railing.
  Touching each with the probe-staff lights it (a gold pool, chime). All three → `kay_reward` + **insight shard 2**.
  Optional; never blocks.
- **Escort Sucra (S2 → S4 → S7).** No fail state. She rides the Crossing Gate (e2 payoff), rides the Carrier Door with
  you (e6 payoff), and appears on a passing vesicle in S7. Her three lines tell the "carrier is a door" story that
  e6 and e11 test.

### 6.4 Map: **the Cell Chart** (key M, or click the objective ring)
- Opens as a **Board-mode panel** over the world (the world stays visible at 45 %, per the bible).
- **The chart is a cross-section of cell V-7 drawn as concentric rings**:
  - the membrane ring (a dotted bilayer);
  - the cytoplasm fill;
  - the nucleus ring with 8 pore notches.
- The route **S1 → S8** is a dotted trace from the outer shore along the membrane arc to the pit, then inward to the
  nucleus.
- Each gate is a small ring icon on the route: hollow when dormant, filled teal when restored. The current position is
  a white map pin.
- The **Logbook** tab lists the plaques found, and the **Shards** tab has 3 slots.
- Keyboard: ←/→ for the tabs, Esc to close.

### 6.5 The secret: **the Plant Cell Garden** (S4)
- **Access.** When the e5 sluice drains, a narrow side stair appears on the trench's left wall. It leads to a hidden
  alcove behind a glycan curtain (the L5 fronds part as you walk in).
- **Inside.** A small pool of fresh water holding a big **turgid plant cell** (a rigid green-cream wall, a swollen
  protoplast pressed against it, a central vacuole as a blue bubble). The player can scrub the pool's salt with a small
  lectern: the protoplast shrinks away from the wall above about 2 % (plasmolysis), and at 0 % it swells, **but the wall
  holds**.
- **Reward.** `secret` line + **insight shard 1**, and a bonus debrief line: "Plant cells like a hypotonic world: the
  wall turns swelling into firmness."
- **Why it's here.** It deepens tonicity (the one concept that appears twice) and pays off the "about to burst" wave
  with its counterpart.

### 6.6 Insight shards (3; `wisp.indigo` collectibles)
1. The Plant Cell Garden (secret).
2. Kay's Lanterns.
3. The S7 high-rail viewpoint (a moving-platform detour).

Each shard floats (±6 px bob, an indigo additive halo, sparkles). The Cell Chart shows `SHARDS n/3`. Each shard adds
one insight line to the debrief. They have no gameplay effect: purpose without pressure.

---

## 7 · Art asset list

**Conventions.**
- All paths live under `public/assets/expedition/cell/` (pipeline §3d), and every entry below is one file and one
  manifest key `cell.<id>`.
- Sizes are the **rasterized size at 1080p** (`load.svg(key, path, {width, height})`; use scale 2 on hi-dpi).
- SVGs use palette tokens only (§2.2) and **no `<text>`** (convert glyph text to paths, per the map §4). World labels
  that change (chips, plaque letters, cartridge labels) are Phaser text on blank plates.
- Colours are tokens from §2.2 unless a hex is given.
- **Pivot** means the rotation hub, as a fraction of width/height, recorded in the manifest.
- "Tileable" means seamless left/right edges.

### 7.1 L0 Sky (factor 0.0)
| # | id | size | description |
|---|---|---|---|
| 1 | `cell.sky.shore` | 2400×1080 | A 4-stop vertical gradient `#CFE9EC` → `#DCEFEA` (35 %) → `#EAF2E6` (70 %) → `#F4EEDF`. Three soft horizontal "fluid swirl" bands: blurred white ellipses @ 8 %, 1600×120, at y 180/340/470, offset x. A sun-glow radial at (300, 120), r 380, white 30 % → 0. 1 px noise dither @ 3 % |
| 2 | `cell.sky.basins` | 2400×1080 | `#BFE3E6` → `#D7EBE2` → `#EFE3D0` → `#F2D9C2`. The same swirl bands but warmer (`#FBEFE0` @ 10 %). Sun-glow at (1800, 160), peach |
| 3 | `cell.sky.hall` | 2400×1080 | Interior: `#3E3240` → `#5A4146` → `#7A5646`. Six faint cream rib arcs (stroke 18 px, `#F2E3C6` @ 10 %) spanning the width like a vault ceiling. A warm floor-glow band at the bottom 20 %, `#F6C48E` @ 25 % |
| 4 | `cell.sky.pit` | 2400×1080 | Dusk: `#A9C9D6` → `#C7C6D4` → `#E6C9C2` → `#F2D2B8`. Two long salmon cloud-swirls `#F4AE80` @ 18 % at the horizon |
| 5 | `cell.sky.cytoplasm` | 2400×1080 | `#E9A98E` → `#F0BC98` → `#F3C7A2` → `#FAE3C2`. Large soft coral blobs `#E7836F` @ 10 % (streaming currents), plus a warm bloom near the right where the nucleus sits |
| 6 | `cell.sky.vault` | 2400×1080 | `#7E6AB8` → `#A488D0` → `#C9A0DE` → `#F2B8D4`. Scattered 2–4 px specks `#FFFFFF` @ 30 % (nucleoplasm glints). Violet haze at the bottom |

### 7.2 L1 Far (factor 0.15)
| # | id | size | description |
|---|---|---|---|
| 7 | `cell.far.tissue` | 2048×700, tileable | **Neighbour cells**: three overlapping huge ellipse domes (w 900 / 1200 / 1400) in `#B9D6D3`, each with a double rim line (2 px `#D6E8E4`, 6 px gap: a membrane seen far off), lit upper-left `#CFE4E0`, 40 % haze to sky. **Collagen cables**: 4 thin lines, 2 px `#E8F6F8` @ 55 %, crossing at shallow diagonals with small node dots (r 4) at the ends |
| 8 | `cell.far.tidecliffs` | 2048×700, tileable | Rounded stacked-dome cliffs `#A9CFCB` / shade `#8DB7B3`, glycan groves as blurred blobs `#8CC0EE` @ 35 % and `#F4AE80` @ 30 %, two collagen cables |
| 9 | `cell.far.hallwall` | 2048×760, tileable | A ribbed interior wall `#4E3C44`, vertical ribs every 256 px (cream `#D9C3A0` @ 35 %, 24 px wide). One **ring window** per tile (a concentric bronze double ring `#6E4A2E` of r 150/120, glass fill `#F6C48E` @ 40 %) |
| 10 | `cell.far.organelles` | 2048×760, tileable | A **Golgi stack**: 5 curved cream plates (`#F2E3C6`, each 300×30, bowed). Two **mitochondria**: capsules 360×150 in `mito.coral` with a lighter rim and 5 navy wavy cristae stripes. An **ER ribbon cliff**: folded ribbon layers `#E9B9A0` with bead dots (ribosomes) `#B89C78`. 30 % haze to the sky |
| 11 | `cell.far.nucleus_dome` | 1400×900 | The landmark, non-tiling. A huge dome `#C98BB0`, lit upper-left `#E2B3CC`, a double rim line (the envelope). 7 visible **pore rings** (bronze r 28 with a glowing centre `#F6D27A`, which lights up as gates restore: an additive overlay per ring) |
| 12 | `cell.far.envelope` | 2048×900, tileable | The S8 back wall: the nuclear envelope as a double cream wall with navy seam lines and pore niches every 512 px (a shallow ring relief) |

### 7.3 L2 Mid-far (factor 0.35)
| # | id | size | description |
|---|---|---|---|
| 13 | `cell.midfar.glycan_forest` | 2048×600, tileable | Silhouettes of 7 **sugar-chain trees**: trunks of stacked beads (circles r 10–14), branching 2–3 times, crowns of hexagon beads (r 16–22) clustered. Alternating `glycan.blue` and `glycan.salmon`, two-tone (lit left +15 % lightness), 20 % haze |
| 14 | `cell.midfar.dormant_towers` | 2048×620, tileable | 3 ruined channel-protein towers (cream bodies with navy bands, broken ring crowns, dark cores `#3F5857`), desaturated −40 %, 20 % haze |
| 15 | `cell.midfar.hall_pillars` | 2048×800, tileable | Hall pillars (cream shafts 90 px, lit left strip, navy capital bands ×2, gold trim), 3 per tile, and gold rail brackets between them |
| 16 | `cell.midfar.nerve_beacon` | 600×700 | A stylized **neuron tower**: a star-shaped soma (cream, 5 dendrite spurs with gold tips) on a cream plinth, with a long **axon cable** (navy with cream myelin beads) running off-right to the tile edge. There is a separate glow overlay (#17) |
| 17 | `cell.midfar.nerve_beacon_glow` | 600×700 | An additive overlay for the beacon: a soma halo `#F6D27A` → 0 and a 12 px bright line along the axon (animated by UV scroll / mask) |
| 18 | `cell.midfar.cytoskeleton` | 2048×700, tileable | Microtubule **aqueduct arches**: cream tubes (30 px) with navy ring bands every 40 px, arching tile-to-tile, and small vesicle bubbles on some |
| 19 | `cell.midfar.cyto_glimpse` | 2048×160, tileable | The amber band below the bilayer (zones A–C): a `cyto.glow` → `cyto.deep` vertical gradient, with faint organelle silhouettes (a mitochondrion capsule and Golgi arcs) @ 25 % and violet K⁺ specks |

### 7.4 L3 Mid (factor 0.6)
| # | id | size | description |
|---|---|---|---|
| 20 | `cell.mid.colonnade_rise` | 2048×520, tileable | A **membrane hill**: the bilayer band (§7.5 style, scaled 0.6) bending up into a broad swell, glycan saplings on top, soft AO at the base |
| 21 | `cell.mid.cholesterol_a` | 60×140 | A cholesterol stud: a tall 3-facet crystal wedge (`cholesterol` hi/base/shade), base buried in heads |
| 22 | `cell.mid.cholesterol_b` | 110×90 | A cluster of 3 short wedges |
| 23 | `cell.mid.cholesterol_c` | 150×70 | A fan of 4 low shards |
| 24 | `cell.mid.basin_walls` | 2048×500, tileable | Cream stone basin walls with gold rims, navy inlay bands and round drain rings (bronze) |
| 25 | `cell.mid.tide_falls` | 256×600, tileable vertically | Two waterfall bands `tide.shallow` / `tide.deep`, with foam dashes. UV-scrolled in engine |
| 26 | `cell.mid.hall_rails` | 2048×600, tileable | Gold ATP rails (3 horizontal, 10 px, `gold.base` with `gold.hi` top edge), pipe elbows, and small round gauge-dials (a navy face, cream needle) |
| 27 | `cell.mid.pit_rim` | 2048×400, tileable | Rolling membrane rim, clathrin-cell patterns faint on the ground, dusk colouring |
| 28 | `cell.mid.vault_court` | 2048×600, tileable | Cream courtyard walls with navy bands, round emblem posts (bible frame 10 kiosk motif), and violet-tinted shadows |

### 7.5 L4 Ground and play-layer terrain (factor 1.0)
| # | id | size | description |
|---|---|---|---|
| 29 | `cell.ground.bilayer` | 512×208, tileable | **The signature tile.** Top row: 11.6 heads per tile (r 22, `lipid.head` body, `lipid.head.lit` upper-left crescent, `lipid.head.shade` underside, 1 px `#D9C3A0` contact shadow). Each head drops **two tails** (8 px wide, 56 px long, `lipid.tail` with a `lipid.tail.hi` left stripe; one tail has a slight kink at 60 %). The **oil seam**: an 8 px `oil.seam` band with a 1 px `#4A6A8A` highlight. The mirrored inner leaflet has tails up and heads down, with the inner heads 10 % darker. Heads are separate sprites in engine (for jitter/parting); this tile is the static fallback + LOD |
| 30 | `cell.ground.head` | 44×44 | A single lipid head sprite (for animated rows). The same shading as #29 |
| 31 | `cell.ground.tailpair` | 22×60 | A single tail-pair sprite, pivot (0.5, 0) |
| 32 | `cell.ground.bilayer_gel` | 512×208, tileable | The frozen variant: heads **hex-packed** (tighter, r 20), tails dead straight, the whole tile `gel.frost` with white frost rims on the top edges, desaturated. Used for the Stiff Ridge body |
| 33 | `cell.ground.stiff_ridge` | 760×300 | The ridge hump: a gel-bilayer mass bulging 1.4 H with ice-like facets on the top, frost sparkles, and a shadowed cavity at its foot. It tweens to a ramp (engine mask + the #29 rows) |
| 34 | `cell.ground.slope` | 512×320 | A 12° up-slope transition of the bilayer (the rows follow a curve) |
| 35 | `cell.ground.hall_deck` | 512×208, tileable | The bilayer with a navy inlay stripe inset on the heads' top and gold studs every 128 px (the hall floor) |
| 36 | `cell.ground.trench` | 512×360, tileable | Sluice trench: cream stone walls, a gold rim, a tide-water line mark, and a floor of wet stone `#B89C78` with blue caustic spots |
| 37 | `cell.ground.causeway` | 512×160, tileable | The microtubule causeway (zone D floor): 3 bundled cream tubes with navy bands, gold clamps every 256 px |
| 38 | `cell.ground.ceiling_band` | 512×208, tileable | The membrane seen from inside (zone D ceiling): #29 flipped, inner leaflet facing down, with a soft white-cyan glow from above (the conduits shining through), `#E8F6F8` @ 25 % |

### 7.6 L5 Foreground (factor 1.3) and L6 Light
| # | id | size | description |
|---|---|---|---|
| 39 | `cell.fore.glycan_fronds` | 2048×260, tileable | Dark foreground fronds `#4F8F85` / `#3F6E8C`: bead-chain stalks with hexagon tips. Rendered with 2 px blur + 70 % alpha in engine. Tall clumps only at tile edges (never over a contraption) |
| 40 | `cell.fore.bubbles` | 2048×300, tileable | A few large soft bubbles (r 20–60, white rim 2 px @ 60 %, fill 5 %) |
| 41 | `cell.fore.hall_balustrade` | 1024×220, tileable | Cream balusters, a navy rail cap, one square post with a round emblem (bible frame 3) |
| 42 | `cell.fore.actin` | 2048×300, tileable | Thin salmon filament lines `#E48C5E` @ 60 % (zone D), gently curving |
| 43 | `cell.fore.vesicles` | 256×96 | Sprite strip: 3 drifting vesicles (r 18/28/42), cream rim with an inner `cyto.glow` fill |
| 44 | `cell.light.caustics` | 1024×1024, tileable | Water caustic web (white lines on transparent), used add @ 12 % + multiply-blue @ 20 % |
| 45 | `cell.light.godrays` | 1920×1080 | 5 diagonal soft rays from the upper left, white → 0, add @ 15 % |
| 46 | `cell.light.lantern_pool` | 512×512 | A radial gold pool `#F6D27A` → 0 for lanterns and ATP light, add |
| 47 | `cell.light.vignette_warm` | 1920×1080 | A soft vignette `#D98A6A` @ 25 % at the corners (zone D) |
| 48 | `cell.fx.mote` | 32×32 | A soft round mote (white core → 0), tinted per ion in engine |

### 7.7 Molecules and FX glyphs
| # | id | size | description |
|---|---|---|---|
| 49 | `cell.mol.o2` | 56×36 | Two fused circles `#8CC0EE` with a lit rim and a 1 px darker outline `#5A95D6` |
| 50 | `cell.mol.co2` | 76×32 | Three fused circles, outer `#A9C3BF`, centre `#5F7B7A` |
| 51 | `cell.mol.na` | 36×36 | A sphere `#EE8A9A` with a lit crescent, and a white "+" path 12 px |
| 52 | `cell.mol.k` | 44×44 | A sphere `#9C82E0` with a white "+" |
| 53 | `cell.mol.cl` | 42×42 | A sphere `#7FD6B0` with a white "−" |
| 54 | `cell.mol.h` | 22×22 | A tiny sphere `#F7F0A0` with a "+" |
| 55 | `cell.mol.glucose` | 64×58 | A hexagon ring (stroke 6, `#D9A441`) filled `#F6E3B4`, with a single tail bead top-right |
| 56 | `cell.mol.steroid` | 96×60 | Four fused rings (3 hexagons + a pentagon) `#E6B85C` fill, darker outline |
| 57 | `cell.mol.water` | 18×24 | A teardrop `#4F92E6` with a white highlight |
| 58 | `cell.mol.dye` | 14×14 | A soft dot `#D46BA8` |
| 59 | `cell.mol.salt` | 16×16 | A cube in 3/4 view: white top, `#E8F6F8` side, `#C9DDE2` side |
| 60 | `cell.mol.sugar` | 18×16 | A small hexagon `#F6E3B4` (syrup solute) |
| 61 | `cell.fx.atp_spark` | 48×48 | A four-point spark `#F6D27A`, white core, thin rays. Used additively |
| 62 | `cell.fx.glow_soft` | 256×256 | A generic radial glow (white → 0), tinted in engine |
| 63 | `cell.fx.bubble_pop` | 64×64 | A 4-frame strip: a bubble ring expanding and fading (for the mote dissolve, spit-back) |
| 64 | `cell.fx.frost_sparkle` | 24×24 | A 4-point white sparkle for the gel ridge |
| 65 | `cell.fx.dust_puff` | 96×64 | A soft cream puff (for the lock/latch and the Gatekeeper's ground shake) |

### 7.8 Props (shared and per contraption)
| # | id | size | description |
|---|---|---|---|
| 66 | `cell.prop.console` | 120×125 (0.7 H) | A lectern (bible frame 5): cream body, gold rim, a slanted **slate** face (`#0F2A33`, lit cyan edge `#6ED2F2` @ 60 %) showing a tiny cross-section icon, and a navy band at its foot |
| 67 | `cell.prop.kiosk` | 180×200 | The boss console: a cream kiosk with a round emblem panel (concentric rings) and navy trim (bible frame 10) |
| 68 | `cell.prop.map_pin` | 70×96 | A teardrop pin: `#0F2A33` fill, 3 px white stroke, a white chevron below, and a centre plate for engine text |
| 69 | `cell.prop.plaque_post` | 70×140 | A lore post: cream, a round navy plate with a gold ring, a small cap |
| 70 | `cell.prop.wisp_shard` | 48×48 | An insight shard: an indigo `#6A6CF0` faceted diamond with a white core (halo via #62) |
| 71 | `cell.prop.seal_node` | 120×120 | A hub node: a bronze double ring with a glass core (dormant `#8FA6A0`). The lit state = the core `#C9F3FF` + the #62 halo |
| 72 | `cell.prop.interact_glyph` | 56×56 | A diamond with inner vertical lines (bible frame 4), white @ 80 % |
| 73 | `cell.prop.pod_pedestal` | 150×80 | Pod base: cream, navy band, gold rim, round letter plate (blank) on its front |
| 74 | `cell.prop.pod_capsule` | 120×150 | A glass capsule (`#C9F3FF` @ 30 %, white rim highlight left), bronze collar at the base, faint haze swirl inside |
| 75 | `cell.prop.pod_fog` | 120×150 | A white fog fill (for quarantine), soft edges |
| 76 | `cell.prop.pod_crack` | 120×150 | Crack lines (white 2 px, branching), drawn on reveal via mask |
| 77 | `cell.prop.mimic_mote` | 160×60 | A 2-frame strip: a translucent jelly blob `#E8F6F8` @ 70 % with two dot "eyes", squished / stretched |
| 78 | `cell.prop.probe_emitter` | 60×150 | A pedestal emitter (bible frame 9): a coiled cream stem, a gold base ring, a cyan orb on top (pivot 0.5, 0.1) |
| 79 | `cell.prop.probe_needle` | 60×240 | e1: a cream-and-gold piston with a thin gold tip, pivot at the top |
| 80 | `cell.prop.gate_socket` | 520×620 | e2 Crossing Gate body: a cream arch 2.2 H above ground, whose ring body continues down through the bilayer band (a tube with navy bands). Dark interior mask where the doors open |
| 81 | `cell.prop.gate_ring_outer` | 380×380 | e2: a cream ring with a gold rim and 8 navy grooves (pivot centre) |
| 82 | `cell.prop.gate_ring_inner` | 260×260 | e2: a bronze selectivity ring with 6 notches (pivot centre) |
| 83 | `cell.prop.gate_fin_left` | 90×300 | e2: the left gold keystone fin half (bible frame 3's split fin) |
| 84 | `cell.prop.gate_fin_right` | 90×300 | e2: the right half, mirrored |
| 85 | `cell.prop.oil_road_plate` | 320×60 | e2: an elliptical navy inlay ring set in the heads, with 3 gold studs |
| 86 | `cell.prop.carrier_rocker` | 560×200 | e2 payoff: a cream see-saw protein with a navy band and a cradle pocket (pivot centre bottom) |
| 87 | `cell.prop.dye_tank` | 780×310 | e3: a glass tank in a cream frame with gold corners, a slight blue tint, highlight streaks |
| 88 | `cell.prop.tank_window` | 40×300 | e3: a vertical bilayer strip (mini heads and tails) with 5 gaps |
| 89 | `cell.prop.balance_pillar` | 140×420 | e3: a cream pivot pillar, navy capital, gold hub (the beam's pivot at 0.5, 0.08) |
| 90 | `cell.prop.balance_beam` | 860×60 | e3: a gold beam with navy inlay and hooks at the ends (pivot centre) |
| 91 | `cell.prop.balance_float` | 70×90 | e3: a cream float bulb with a bronze hook |
| 92 | `cell.prop.chain` | 16×32, tileable vertically | a bronze chain link pair |
| 93 | `cell.prop.osmo_basin` | 620×300 | e4: a glass basin in a cream stone frame, a membrane window on its right wall |
| 94 | `cell.prop.test_cell_ring` | 280×280 | e4: a ring of tiny heads (a circular bilayer) with a subtle gold inner line (scaled live) |
| 95 | `cell.prop.test_cell_fill` | 280×280 | e4: peach cytoplasm `#F6C48E` @ 80 %, a nucleus dot `#C98BB0`, 3 organelle specks (scaled live) |
| 96 | `cell.prop.raft_lock` | 300×520 | e4: a stone shaft, a glass front, a gold rim, a water-level line guide, and a membrane window on the left |
| 97 | `cell.prop.raft` | 240×50 | e4: a cream raft with gold edging and two bronze cleats |
| 98 | `cell.prop.label_lock` | 420×300 | e5/e9: a lock chamber with stone walls and bronze gates at both ends (the gate leaves are separate: #99) |
| 99 | `cell.prop.lock_gate_leaf` | 40×220 | a bronze gate leaf (pivot at the top hinge) |
| 100 | `cell.prop.valve_wheel` | 220×220 | a bronze wheel, 3 spokes each ending in a small blank plaque (pivot centre) |
| 101 | `cell.prop.basin_plaque` | 160×50 | a cream plaque with a gold border (blank; engine text HYPO/ISO/HYPER, IN/OUT/NONE) |
| 102 | `cell.prop.holding_basin` | 300×160 | a stone basin with a water surface (the water rendered in engine) |
| 103 | `cell.prop.eddy` | 300×160 | the basin with a spiral swirl pattern (rotated slowly) |
| 104 | `cell.prop.sluice_steps` | 360×260 | e5 payoff: carved cream steps with navy step-edges, wet sheen |
| 105 | `cell.prop.side_stair` | 200×300 | e5: the narrow stair to the secret, half hidden by fronds |
| 106 | `cell.prop.cell_rbc` | 160×90 | a red blood cell in 3/4 view: a biconcave disc `#E77A7A`, a lighter rim `#F4A3A0`, a darker dimple centre. No nucleus |
| 107 | `cell.prop.cell_plant` | 170×170 | a plant cell: a rigid rounded-square wall `#9ED6A0`/`#6FB78A` (6 px), a protoplast inside (peach, a separate layer #108), a blue vacuole bubble |
| 108 | `cell.prop.cell_protoplast` | 150×150 | the plant protoplast layer (scaled for plasmolysis) |
| 109 | `cell.prop.cell_generic` | 160×160 | a round cell: a bilayer ring (mini heads), peach fill, a nucleus dot, 3 dots of solute |
| 110 | `cell.prop.cell_potato` | 170×170 | a plant-cell variant with 5 cream starch ovals inside |
| 111 | `cell.prop.barge` | 360×80 | e9: a cream barge with a gold rail and the console bolted mid-deck |
| 112 | `cell.prop.carrier_door` | 420×415 | e6: a revolving cream drum (2.4 H), one deep cargo pocket, gold hinge rings, navy bands (pivot centre) |
| 113 | `cell.prop.hall_facade` | 1200×700 | e6: the Pump Hall façade: cream stone, a navy band frieze, three ring windows, the door niche |
| 114 | `cell.prop.glide_gate` | 300×260 | e6: a channel ring + a small carrier rocker at the foot of a ramp |
| 115 | `cell.prop.pump_gate` | 260×300 | e6: a compact pump: a cream body, gold trim, an ATP intake port on top |
| 116 | `cell.prop.gradient_ramp` | 120×40 | e6/e11: a stone wedge (slope set by scaleY and flip), dense dots at the high end |
| 117 | `cell.prop.atp_pipe` | 40×128, tileable vertically | a gold pipe with a navy band every 64 px |
| 118 | `cell.prop.flume_tank_low` | 300×260 | e7: a glass tank in a cream frame with a fill-line groove |
| 119 | `cell.prop.flume_tank_high` | 300×260 | e7: the same tank on a 1.2 H plinth with navy trim |
| 120 | `cell.prop.flume_pump` | 200×260 | e7: a pump body with a piston (the piston a separate child in the same SVG group id `piston`), gold feed port |
| 121 | `cell.prop.leak_trough` | 400×80 | e7: a sloped stone trough, high → low |
| 122 | `cell.prop.atp_lantern` | 60×110 | a bronze lantern cage with a dark glass core (lit = #46 pool + the core tinted `#FFF6D8`) |
| 123 | `cell.prop.gantry_platform` | 360×60 | e7: a cream platform with a gold edge and rail clamps |
| 124 | `cell.prop.gantry_rail` | 40×128, tileable vertically | a gold rail with navy ties |
| 125 | `cell.prop.nak_housing` | 600×620 | e8: the Na⁺/K⁺ pump outer housing (3.5 H): cream stone, 2 navy bands, a gold rim, a circular drum bay, jaw slots top and bottom, an ATP port on the right shoulder |
| 126 | `cell.prop.nak_jaw_upper` | 300×120 | e8: the upper jaw plate (pivot at the left hinge) |
| 127 | `cell.prop.nak_jaw_lower` | 300×120 | e8: the lower jaw plate (pivot at the left hinge) |
| 128 | `cell.prop.nak_drum` | 320×320 | e8: the inner drum: a cream disc, a gold rim, 6 radial socket bays (pivot centre) |
| 129 | `cell.prop.socket_na` | 40×40 | e8: a coral-rimmed socket cup |
| 130 | `cell.prop.socket_k` | 46×46 | e8: a violet-rimmed socket cup |
| 131 | `cell.prop.cable_plinth` | 160×240 | e8: a control plinth with 4 round cable sockets (bronze rings) |
| 132 | `cell.prop.cartridge` | 110×60 | e8: a blank value cartridge (a cream body, gold contacts, a label window for engine text) |
| 133 | `cell.prop.cartridge_rack` | 220×360 | e8: a rack with 5 bays |
| 134 | `cell.prop.hall_gate` | 500×520 | e8: a portcullis-like gate (cream bars with navy bands, gold ring medallion), lifted by a chain |
| 135 | `cell.prop.halcyon` | 380×170 | the *Halcyon*: a brass-and-cream teardrop submarine, a round porthole (gold ring, cyan glass), a navy stripe, a small tail fin and propeller, 4 rivets per panel |
| 136 | `cell.prop.clathrin_cell` | 64×56 | e10: one lattice cell (a hexagon of 3 triskelion legs, cream with gold joints). Tiled along the curve in engine |
| 137 | `cell.prop.dynamin_collar` | 180×70 | e10: a coiled gold ring (a helix wrap) that tightens (scaleX) |
| 138 | `cell.prop.lift_frame` | 220×520 | e10: a cream gantry with a navy band and 4 round stage-lamp bays |
| 139 | `cell.prop.stage_lamp` | 90×90 | e10: a bronze-framed round plate (a blank face for the plank icon) |
| 140 | `cell.prop.vesicle_shell` | 420×420 | e10: a vesicle: a circular bilayer ring (mini heads outward and inward) with a translucent fill |
| 141 | `cell.prop.microtubule_rail` | 256×40, tileable | e10/S7: a single microtubule tube with navy bands |
| 142 | `cell.prop.gk_body` | 900×1040 | e11: the **Gatekeeper** (6 H): a massive seated cream-stone protein body, navy inlay bands, gold phosphate bosses on the shoulders, three maw openings at chest height (dark interiors), and a back ridge where the ATP pipe mounts. Soft violet shadows |
| 143 | `cell.prop.gk_eye_outer` | 260×260 | e11: the eye-ring's outer concentric broken rings (bronze + gold) |
| 144 | `cell.prop.gk_eye_pupil` | 140×140 | e11: the inner pupil-ring (rotates; a gold notch marks its facing) |
| 145 | `cell.prop.gk_maw_oil` | 220×180 | e11: the Oil Maw lining (a ring of lipid heads around the opening) |
| 146 | `cell.prop.gk_maw_channel` | 180×180 | e11: a bronze selectivity ring with 6 notches (pivot centre) |
| 147 | `cell.prop.gk_maw_pump` | 220×180 | e11: gold phosphate "teeth" plates around the opening (upper and lower plates in groups for opening) |
| 148 | `cell.prop.gk_atp_pipe` | 80×700 | e11: a thick gold pipe with navy clamps up the back |
| 149 | `cell.prop.pore_outer` | 960×960 | S8 hub gate outer ring: cream, a gold rim, **8 spokes** (the nuclear pore complex's eightfold symmetry), 11 conduit sockets around the rim (bronze cups), and a gold fin at the top that splits (bible frame 3). Pivot centre |
| 150 | `cell.prop.pore_inner` | 620×620 | the inner ring: navy grooves, gold notch (counter-rotates) |
| 151 | `cell.prop.pore_plug` | 300×300 | the central plug: a cream disc with concentric rings (retracts on open) |

### 7.9 Characters
| # | id | size | description |
|---|---|---|---|
| 152–173 | `cell.char.diver.<frame>` ×22 | 192×256 (HD, scale 0.9) | **Kenney toon-characters Female adventurer** frames, tinted `0xFFF4E6`: `idle, walk0–walk7, run0–run2, jump, fall, climb0, climb1, interact, switch0, switch1, talk, think, cheer0, cheer1` (22). CC0; path `.data/asset-scratch/toon-characters.zip` → copy the HD PNGs |
| 174 | `cell.char.diver_helmet` | 88×88 | A clear bubble helmet overlay (§3.1), anchored to the head point per frame |
| 175 | `cell.char.diver_scarf` | 40×18 | One scarf segment (aqua with a stripe). 3 instances in a spring chain |
| 176 | `cell.char.probe_staff` | 24×190 | A cream staff, gold ferrule, glass bulb (the bulb is tinted in engine: cyan / orange) |
| 177 | `cell.char.pip_hull` | 38×26 | Pip: a cream teardrop mini-sub, gold porthole ring, cyan glass |
| 178 | `cell.char.pip_prop` | 12×12 | A 2-frame propeller blur strip |
| 179 | `cell.char.ora_portrait` | 220×220 | Ora in the comms porthole (§3.2): head and shoulders, headset, goggles up, aqua jumpsuit, **grinning** |
| 180 | `cell.char.ora_portrait_focus` | 220×220 | The same pose, **focused** (brows in, tongue-in-cheek concentration) |
| 181 | `cell.char.porthole_frame` | 240×240 | A bronze ring with 8 rivets and a glass glare arc (frames the portraits) |
| 182 | `cell.char.sucra_idle` | 100×104 | Sucra: a hexagon-ring body (cream, gold outline), two short legs, a satchel with a tag, round eye dots in the ring's centre |
| 183 | `cell.char.sucra_walk0` | 100×104 | walk frame A |
| 184 | `cell.char.sucra_walk1` | 100×104 | walk frame B |
| 185 | `cell.char.sucra_talk` | 100×104 | talk (one leg lifted, satchel swinging) |
| 186 | `cell.char.poro` | 180×280 | Poro: an hourglass-waisted stone statue (cream with navy bands, a single-file groove down the waist), two eye-glyph slots |
| 187 | `cell.char.poro_eyes` | 80×24 | A 2-frame strip: eyes half-closed (sleepy) / open (glowing `#8FE0EA`) |
| 188 | `cell.char.kay_idle` | 90×170 | Kay: a violet sphere body with a white "+" badge, stubby arms, holding a cream lamp pole with a gold hook |
| 189 | `cell.char.kay_raise` | 90×170 | Kay raising the lamp pole |
| 190 | `cell.char.kay_cheer` | 90×170 | Kay with arms up, the pole overhead |
| 191 | `cell.char.ferryman_0` | 210×210 | The Ferryman: a triskelion of three curved cream legs with gold joints, a hub with a hanging small gold ring. Roll frame A |
| 192 | `cell.char.ferryman_1` | 210×210 | Roll frame B (rotated 40°, legs flexed) |

### 7.10 UI (biome-specific; the shared panel kit is listed in the shared UI doc, not here)
| # | id | size | description |
|---|---|---|---|
| 193 | `cell.ui.emblem_ora` | 64×64 | Ora's emblem (§3.2): a dark disc, 3 broken rings, a ring of 16 dots with inward twin ticks |
| 194 | `cell.ui.emblem_gatekeeper` | 64×64 | A bronze disc, 3 gold rings, 3 notches at the bottom |
| 195 | `cell.ui.bin_bilayer` | 240×90 | Bin-card art: a bare bilayer strip with a dotted straight-through path (e2 Oil Road, e11 Oil Maw) |
| 196 | `cell.ui.bin_channel` | 240×90 | A bilayer strip with a channel ring and a dotted path through it (e2 gate, e11 Channel Maw) |
| 197 | `cell.ui.bin_carrier` | 240×90 | A strip with a carrier rocker and a downhill arrow (e6 Glide Gate) |
| 198 | `cell.ui.bin_pump` | 240×90 | A strip with a pump, a gold spark and an uphill arrow (e6 Pump Gate, e11 Pump Maw) |
| 199 | `cell.ui.icon_charge` | 32×32 | A "±" legend glyph |
| 200 | `cell.ui.icon_shell` | 32×32 | A hydration-shell legend glyph (a dot inside a ring of droplets) |
| 201 | `cell.ui.stage_icons` | 7×(48×48) strip | e8 stage icons: rest, bind Na⁺, ATP, flip out, swap, drop P, flip in (white line art) |
| 202 | `cell.ui.plank_icons` | 5×(48×48) strip | e10 plank icons: touch, fold, pinch, carry, dissolve (white line art) |
| 203 | `cell.ui.cell_chart` | 900×900 | The map (§6.4): concentric cell rings (a dotted bilayer ring, cytoplasm fill `#F6C48E` @ 20 %, a nucleus ring with 8 notches), a dotted route trace, and 11 gate-icon bays. Panel-card style (`ui.card` fill, `ui.line` strokes) |
| 204 | `cell.ui.gradient_bar` | 220×24 | The HUD gradient bar frame: two rows of 12 tiny heads (fills driven by G) |

### 7.11 Count
**204 files in total**:

| Group | Files |
|---|---|
| L0 sky | 6 |
| L1 far | 6 |
| L2 mid-far | 7 |
| L3 mid | 9 |
| L4 ground | 10 |
| L5/L6 | 10 |
| Molecules/FX | 17 |
| Props | 86 |
| Characters | 41 (22 of them Kenney frames, sourced, not drawn) |
| UI | 12 |

The artist agents author **182**. The budget is under 1 MB of SVG plus about 300 KB of PNG (pipeline §3e).

---

## 8 · Fidelity mapping (bible §9 checklist, 36 items; ★ = mandatory)

| # | Item | How *The Living Gate* satisfies it |
|---|---|---|
| 1 ★ | Painterly parallax, ≥ 5 layers | L0 sky, L1 far (tissue/organelles), L2 mid-far (glycan forest / beacon / cytoskeleton), L3 mid (colonnade rise, rails), L4 play (bilayer road), L5 fore (fronds, balustrade), L6 light (caustics, rays). There are 7 depths, at factors 0 / 0.15 / 0.35 / 0.6 / 1.0 / 1.3 (§2.3) |
| 2 ★ | No 1-bit tiles | Everything is from §7. The Kenney 1-bit tilesheet is not loaded by the Expedition host |
| 3 | Sky gradient ≥ 3 stops per biome table | Six 4-stop skies (§7.1), one per zone sub-mood |
| 4 | Architecture vocabulary | Every play screen has rings (gates, pore, drum, pods), gold trim (= ATP), navy inlay (the oil seam runs through every frame), and pillars (the lipid colonnade itself) |
| 5 | Soft coloured light, no pure black | The darkest world token is `oil.seam.dark` `#22385A` (lifted from the bible's navy shadow to stay above `#1E2A33`). Shadows are `#6E7F9A` @ 30 % multiply, blurred 6–8 px, falling right from the upper-left key light |
| 6 | Glow = live; dormant desaturated | Unsolved contraptions are at −40 % ColorMatrix with no glow; solved ones re-saturate over 600 ms (§2.4). The Pump Hall is dark until e7 |
| 7 | Foreground framing ≥ 50 % of frames | L5 fronds, bubbles, balustrade and actin on every scene, kept to tile edges and away from contraptions |
| 8 | Biome identity from a thumbnail | The cream-and-gold **bilayer band across the lower third**, with an aqua sky or amber cytoplasm, is unmistakable next to terraces (trig) and the archive city (history) |
| 9 ★ | Articulated protagonist, 14–18 % height, walk/idle/interact | The Diver at 173 px = 16 %: 8-frame walk, idle breath, interact → switch frames, plus helmet, scarf and staff overlays (§3.1) |
| 10 | Scale ladder: hub ≥ 4 H, consoles ≈ 0.7 H | The Nuclear Pore is 5.5 H, the Gatekeeper 6 H, the pump 3.5 H, and consoles 0.7 H (§2.1) |
| 11 ★ | Guide emblem in the bar + a companion near the player | Ora's emblem (§3.2, #193) in every dialogue bar; **Pip** floats at the shoulder and pulses when she speaks |
| 12 | Objective ring shows restoration | The zone ring fills per gate, plus `GATES n/11` and the GRADIENT bar (§6.2) |
| 13 | Instruction + insight per encounter, in world terms | Every encounter has `instr` naming the object ("Route each molecule… Crossing Gate") and `insight` stated as a world truth (§4.3) |
| 14 | Sensitivity (history only) | n/a. The stylization notes in §2.1 cover scientific honesty instead |
| 15 ★ | World ≥ 45 % visible, undimmed | Scrub layout 60 %, Sluice layout 60 %, Board 45 % (§5.0 R9). There is no dim except the finale flood |
| 16 | Panel material | The shared panel kit: `ui.panel` + blur + hex grid (bible §3.2) |
| 17 | Circuit-trace terminals ≥ 3 | The panel rail, the dialogue divider "• • ◉", the Verify flank lines, and the e10 stage rail's dot-ended connectors |
| 18 ★ | Graph/gauge cards, bordered, tabbed, ticks + grid | Gradient cards (f/g/h) in e1, e3, e4 and e7 with labelled ticks and a major/minor grid. Bar-gauge cards in e5/e9. Cross-section cards in e8/e10. The ATP card is gold |
| 19 | Axis units | nm (e1), mM (e3, e7), % salt (e4), ATP/s (e7), stage (e8, e10), seconds (e5/e9 sparklines) |
| 20 | Function colours consistent | **white = outside, green = inside, blue = water/volume, gold = ATP**, in the panel and in world chips (§0 colour law) |
| 21 ★ | Orange scrubber through all cards, tab + readout | e1 "d", e3 "a", e4 "s", e7 "r" (continuous, shared x across 3 cards), e8 "k", e10 "k" (§5.0 R4) |
| 22 | Value chips on the card edge with units | "2.4 nm", "5.0 mM", "0.74", "C_high 8.6 mM" (§5.x panels) |
| 23 | Back arrow | Every panel (R9); closes without grading and keeps the draft |
| 24 | Verify named for the machine, disabled until complete | QUARANTINE POD, ROUTE CARGO, DRAIN THE SLUICE, OPEN THE THRESHOLD, RUN ONE CYCLE, FILL THE LOCK, LAUNCH THE LIFT, OPEN THE VAULT |
| 25 | Success badge with brackets | MIMIC QUARANTINED, CARGO ROUTED, SLUICE DRAINED, THRESHOLD OPEN, PUMP CYCLING, LOCK FILLED, VESICLE LAUNCHED, VAULT OPEN |
| 26 | Board tokens from a palette, snapping, keyboard-operable | Molecule and cargo tokens (e2, e6, e11), cartridges (e8) and plates (e10) come from palette columns. Keyboard per R10 |
| 27 ★ | Bar anatomy: emblem, i, text | Emblem (Ora or the Gatekeeper), the **i** button opens `h1`–`h3`, and the text types on at 45 chars/s |
| 28 | Sentence style ≤ 2 lines | All 134 lines ≤ 140 chars (§4.4) |
| 29 | Legibility ≥ 28 px, contrast ≥ 7:1 | White on `ui.panel` (≈ 8.9:1); 30 px at 1920 w |
| 30 ★ | Live reaction with ≥ 3 intermediate poses | Needle and head parting (e1); molecules gliding to lanes (e2); dye sim + beam tilt (e3); the cell swelling and shrinking (e4); the cell drifting and the bath filling (e5/e9); the ATP hatch + intake glow (e6); tanks and piston (e7); drum, jaws and ions (e8); membrane fold playback (e10); eye-ring and maws (e11) |
| 31 | World chips on driven parts; pins on targets | Chips per R6 on every driven part. Pins: a numbered pin over each dormant gate on approach, "isotonic" on the e4 basin at s = 2, and a pin on the Nuclear Pore socket in S8 |
| 32 | Eased physicality, lag ≤ 0.4 s | α = 0.25/frame default; osmosis 0.12 (≈ 0.4 s); tank τ = 1.2 s is the *simulation* (the fill lines ease on top) |
| 33 | Partial feedback near/far, no answer | The beam tilt shows how uneven (e3); cell volume vs isotonic (e4); the ledger q (e8); lanes' counts; first-miss-only verdicts (R2, R5) |
| 34 ★ | In-world success animation 1.2–2.5 s with sound hook | Every block in §5 has a timeline of 2.2–2.5 s plus sfx ids (`pod_crack`, `gate_open`, `latch`, `ridge_thaw`, `conduit_on`, …) |
| 35 ★ | Payoff is traversal | Ramp (e1), arch + rocker ramp (e2), boom lifts (e3), **raft ride** (e4), steps emerge (e5), **door carries you** (e6), **gantry ride** (e7), gate lifts (e8), **barge rises** (e9), **the vesicle carries you into the cell** (e10), pore opens (e11) |
| 36 | Visible misconception | Every §5 block has a "Visible misconception" line tied to the fixture's `targetMisconception` |

**Self-score (design intent): 36/36**, with item 14 not applicable (counted as a pass). An implementation is then scored from screenshots by the Wave 4 critics.

---

## 9 · Generalization notes

### 9.1 Reusable contraptions (any game using that `familyId.mode`)

| Contraption kit | Mode | Reusable because | Skin slots the World Writer fills |
|---|---|---|---|
| **Specimen Pods** + ghost overlay | `truth_finder.mimic` | Any three claims about any phenomenon: the pods, beam, quarantine and failure sequence are generic, and only the **reference apparatus** and **ghost ids** vary | pod noun, reference-apparatus id (from a sim-kit enum), `ghost[statementIndex]` ids, scrubber `{symbol, label, min, max, step, unit}` |
| **Router Lanes** (+ the Gatekeeper-maws skin) | `sorter.bins` | 2–4 lanes with queues, first-miss bounce, count chips. Works for any category sort (the bible's "Router Lanes / Filing Cabinets") | lane nouns and art ids, per-item glyph and property flags, per-item bounce style, optional energy card |
| **Sluice Waves** | `sorter.type_match` | Timed waves through one lock into category basins, hover renders the claim, Verify at the end | per-wave visual params, `showFate`, category basin plaques, claim-render presets per category |
| **Stepped Machine** (link board + stage scrubber) | `linker.pairs` | Sockets ↔ cartridges with a stage scrubber and a first-wrong-stage jam | the machine noun, stage names/icons, per-left `{stage, socketKind}`, per-right semantic values, a ledger-card formula id |
| **Stage Lift** (plank rail + playback scrubber + cumulative physics) | `sequencer.linear` | Any process: steps map to stage poses; wrong order meets physics preconditions | per-step `{stageId, requires, effect}` from a stage-pose library, decoy pose |

The **biology sim kit** (pure `model.ts`) is reusable across any biology PDF that touches gradients:
- `DiffusionTank` (e3);
- `OsmoticCell` (e4; also the secret);
- `PumpFlume` (e7);
- `Bilayer` (e1; the ground itself);
- `MembraneFold` (e10).

A World Writer picks them by id. They are keyed by concept type, not by this fixture.

### 9.2 What is subject-specific (hand-written here, written by the pipeline later)
- **Biome kit** `living_cell`: all of §7.1–§7.6 and the molecule glyphs. This is hand-built art, chosen by id.
- **Story overlay**: title, premise framing (the Stillness, the Gradient Meter), zone names, NPC roster, and every line
  in §4.3.
- **Per-encounter bindings**: which sim kit, which ghost ids, scrubber ranges and units, per-item visuals, the
  semantic values for cartridges, and the fate presets.
- **Purpose meter**: the name ("GRADIENT"), the start value and increments (§6.2).

### 9.3 World overlay shape (proposal for the architect; `src/contracts/world.ts`, side-car per map §3.3)

This is written strict-mode legal: every field is required, with `.nullable()` instead of `.optional()`, and there is
no `z.record`. So the same shape can later be produced by an LLM "World Writer".

```ts
WorldOverlay = {
  specId: string, sourceId: string, genre: string,            // lookup keys (map §3.3)
  displayTitle: string, biomeId: "living_cell" | …,            // enum of biome kits
  protagonist: { name: string, costumeId: string },
  guide: { characterId: string, companionId: string, emblemId: string },
  purpose: { meterLabel: string, start: number, perEncounter: { encounterId: string, value: number }[] },
  npcs: { id: string, name: string, voiceArchetype: VoiceArchetype, spriteSet: string, sceneId: string }[],
  scenes: { id: string, name: string, zone: string, skyId: string, xStart: number, xEnd: number,
            encounterIds: string[], loreIds: string[] }[],
  lines: { id: string, speakerId: string, text: string,       // ≤ 140 chars (code-checked)
           cue: "intro"|"walk"|"approach"|"instr"|"hint1"|"hint2"|"hint3"|"fail"|"success"|"insight"|"after"|"outro"|"lore",
           encounterId: string | null, sceneId: string | null }[],
  contraptions: {
    encounterId: string,
    kitId: "specimen_pods" | "router_lanes" | "sluice_waves" | "stepped_machine" | "stage_lift" | …,  // dynamic enum filtered by mode
    layout: "scrub" | "board" | "sluice" | "vault",
    verifyLabel: string, successBadge: string,
    scrub: { symbol: string, label: string, min: number, max: number, step: number, unit: string } | null,
    simId: string | null,                                     // biology sim kit id
    ghosts: { statementIndex: number, ghostId: string }[],    // mimic only, else []
    items: { key: string, glyph: string, flags: string[], from: number | null, to: number | null }[],   // bins
    waves: { waveIndex: number, cell: string, inDots: number, outDots: number, fate: string, showFate: boolean }[], // type_match
    rights: { key: string, semantic: string }[],              // pairs: e.g. "Na:3:out", "atp:1", "beacon"
    steps: { key: string, stageId: string }[],                // linear
  }[],
}
```

**Example (e4, abridged):**

```json
{ "encounterId": "e4_osmosis", "kitId": "specimen_pods", "layout": "scrub",
  "verifyLabel": "QUARANTINE POD", "successBadge": "MIMIC QUARANTINED",
  "scrub": { "symbol": "s", "label": "bath salt", "min": 0, "max": 10, "step": 0.1, "unit": "%" },
  "simId": "osmotic_cell:cIn=2,b=0.3,scenarioMin=2.5",
  "ghosts": [ {"statementIndex":0,"ghostId":"water_out_arrows"}, {"statementIndex":1,"ghostId":"salt_inflow"},
              {"statementIndex":2,"ghostId":"shrink_outline"} ],
  "items": [], "waves": [], "rights": [], "steps": [] }
```

**Validation rules (code, not the model):**
- Every `encounterId` exists in the spec.
- `kitId` supports that encounter's `familyId.mode`.
- `ghosts` cover every `statementIndex`.
- `items` keys equal the mode's item keys.
- `waves` count equals `view.waves.length`.
- `rights` keys equal the pairs mode's right keys plus decoys.
- `steps` keys equal the linear keys.
- Every line is ≤ 140 characters.
- No `lines[].text` for `instr`/`hint1`/`fail` may contain an answer var (reuse the placeholder ban from instructions §4).

**The ghost-id honesty check:** the ghost for the mimic statement must be a "false-claim render" id, and all the others
must be "true-claim render" ids, where each sim kit tags its ghosts. Code checks this against `solution.mimicIndex`, so
a World Writer can't accidentally make the true claim look false.

### 9.4 Checks the content agent must run
- Every dialogue line is ≤ 140 characters:
  `python3 -c "import re,sys;s=open('docs/design/11-game-cell-transport.md').read();s=s[s.index('### 4.3'):s.index('### 4.4')];print([r for r in s.splitlines() if r.startswith('| ') and len(r.split('|')[3].strip())>140])"`
  should print `[]`.
- **Asset count:** `grep -cE '^\| [0-9]+(–[0-9]+)? \| \`cell\.' docs/design/11-game-cell-transport.md` should print
  183 rows (204 files, since one row holds 22 frames).
- **No fixture, mode or contract changes in this doc.** Every extension listed in §5 is a *view/draft/panel* change
  (engine-dev) or a pure helper export (mechanics-dev: `firstMiss`, the optional `noun` var). `grade()` stays the
  single source of truth.

### 9.5 Extension summary (for the implementation plan)
| # | Change | Owner | Needed by |
|---|---|---|---|
| X1 | `onDraft` on the widgets/panels + `HostHandle.setDraft` (R3) | engine-dev | all 11 |
| X2 | exploration scrubber over `setLiveValue` with overlay ranges (R4) | engine-dev | e1, e3, e4, e7, e8, e10 |
| X3 | `firstMiss(params, input)` exported per mode, used by `grade()` (R5) | mechanics-dev | e2, e5, e6, e8, e9, e10, e11 |
| X4 | Sluice panel: Verify after the last wave + preselected retry | engine-dev | e5, e9 |
| X5 | After-beat capture (D1) + `finale` phase (D2) + progress-derived world state (D3) | engine-dev | e11, all after-beats |
| X6 | `disableGlobalCapture()` while a panel is open (D4); memoized view (D5) | engine-dev | all |
| X7 | `WorldOverlay` side-car contract + loader (§9.3) | **architect** | all |
| X8 | Optional `noun` template var for mimic feedback | mechanics-dev | e1, e3, e4, e7 |
