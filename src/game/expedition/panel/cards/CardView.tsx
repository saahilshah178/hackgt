"use client";

import type { CardModel } from "@/world/types";
import type { LiveChip } from "../types";
import { BarsCard } from "./BarsCard";
import { CauseGraphCard } from "./CauseGraphCard";
import { ClaimsCard } from "./ClaimsCard";
import { DocumentCard } from "./DocumentCard";
import { EnergyCellsCard } from "./EnergyCellsCard";
import { GraphCard } from "./GraphCard";
import { LinkBoardCard } from "./LinkBoardCard";
import { MatrixCard } from "./MatrixCard";
import { SchematicCard } from "./SchematicCard";
import { SlotRailCard } from "./SlotRailCard";
import { TimelineCard } from "./TimelineCard";
import { UnitCircleCard } from "./UnitCircleCard";

/** How much of the stack a card kind takes (flex-grow): info cards 1, board surfaces 2, strips 0 (natural). */
export function growOf(card: CardModel): 0 | 1 | 2 {
  switch (card.kind) {
    case "energy_cells":
      return 0;
    case "claims":
    case "slot_rail":
    case "link_board":
    case "matrix":
    case "cause_graph":
      return 2;
    default:
      return 1;
  }
}

/** A display (non-interactive) card of any kind. Control surfaces are drawn by their controls instead. */
export function CardView({ card, chips = [], cursor = null }: { card: CardModel; chips?: readonly LiveChip[]; cursor?: number | null }) {
  switch (card.kind) {
    case "graph":
      return <GraphCard model={card} chips={chips} />;
    case "timeline":
      return <TimelineCard model={card} chips={chips} cursor={cursor} />;
    case "unit_circle":
      return <UnitCircleCard model={card} chips={chips} />;
    case "bars":
      return <BarsCard model={card} />;
    case "schematic":
      return <SchematicCard model={card} />;
    case "link_board":
      return <LinkBoardCard model={card} grow={1} />;
    case "claims":
      return <ClaimsCard model={card} grow={1} />;
    case "slot_rail":
      return <SlotRailCard model={card} grow={1} />;
    case "matrix":
      return <MatrixCard model={card} grow={1} />;
    case "energy_cells":
      return <EnergyCellsCard model={card} />;
    case "document":
      return <DocumentCard model={card} />;
    case "cause_graph":
      return <CauseGraphCard model={card} grow={1} />;
  }
}
