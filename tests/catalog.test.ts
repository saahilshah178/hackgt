import { describe, expect, it } from "vitest";
import { CARDS, getCard, validateCatalog } from "../src/library/index";

/** Every ★ card from LIBRARY §6/§7 (the 13 flagships; the five §7 "generic" cards are not ★). */
const STARRED_FLAGSHIPS = [
  "number_line_leap",
  "phase_gate",
  "balance_chamber",
  "decoy_destination",
  "tile_the_region",
  "formula_engine",
  "atom_conservation",
  "protein_factory",
  "feedback_controller",
  "logic_factory",
  "domino_engine",
  "evidence_board",
  "rune_recall",
];

// spot-check ≥ 25 ids spread across domains
const SPOT_CHECK_IDS = [
  "number_line_leap", "balance_chamber", "circular_navigator", "decoy_destination",
  "slope_scanner", "tile_the_region", "vector_winds", "z_score_rapids",
  "formula_engine", "wave_bridge", "atom_conservation", "redox_tracker",
  "photosynthesis_recipe", "vaccine_memory", "rock_cycle_wheel", "weather_fronts",
  "state_containers", "osi_elevator", "logic_factory", "path_prediction",
  "dosage_calculator", "domino_engine", "museum_palace", "branch_router",
  "map_placement", "living_marketplace", "compound_tower", "maslow_tower",
  "syllogism_gate", "plot_arc", "thesis_forge", "rune_recall", "tempo_sync",
  "vanishing_point", "accounting_equation", "elements_check",
  "mimic_chest", "chrono_bridge", "type_matched_weapon", "grapple_anchors", "cycle_wheel",
];

describe("catalog validity (LIBRARY §6/§7 → src/library/catalog/*.ts)", () => {
  it("validates with zero issues", () => {
    expect(validateCatalog()).toEqual([]);
  });

  it("has ~316 cards (LIBRARY header count)", () => {
    expect(CARDS.length).toBeGreaterThanOrEqual(300);
  });

  it("every ★ flagship in LIBRARY §7 exists and is marked flagship: true", () => {
    for (const id of STARRED_FLAGSHIPS) {
      const card = getCard(id);
      expect(card, `missing flagship card ${id}`).toBeDefined();
      expect(card!.flagship, `${id} should be flagship: true`).toBe(true);
    }
    expect(STARRED_FLAGSHIPS.length).toBe(13);
  });

  it("spot-checks at least 25 ids across domains", () => {
    expect(SPOT_CHECK_IDS.length).toBeGreaterThanOrEqual(25);
    for (const id of SPOT_CHECK_IDS) {
      expect(getCard(id), `missing card ${id}`).toBeDefined();
    }
    const domains = new Set(SPOT_CHECK_IDS.map((id) => getCard(id)!.domain));
    expect(domains.size).toBeGreaterThanOrEqual(10);
  });

  it("every card has at least 3 keywords, a non-empty learningInsight, and one knowledge type", () => {
    for (const c of CARDS) {
      expect(c.keywords.length, c.id).toBeGreaterThanOrEqual(3);
      expect(c.learningInsight.length, c.id).toBeGreaterThan(10);
      expect(c.knowledgeTypes.length, c.id).toBeGreaterThanOrEqual(1);
    }
  });
});
