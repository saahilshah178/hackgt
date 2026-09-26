/**
 * src/game/expedition/panel/types.ts — the instrument panel's public types (docs/design/20 §3). P1 (L3).
 *
 * The client (H2) builds a PanelStation from a ResolvedStation with `panelStationOf`, passes the view, the meta, the
 * PanelContext (A6) and callbacks to <InstrumentPanel>, and receives PanelDrafts (§3.4) it stamps with
 * encounterId/modeKey/seq before calling host.bindDraft.
 */
import type { CardOverride, LayoutMode, ProbeSpec } from "@/contracts/world";
import type { CardModel, ControlKind, Draft, ModeKey, PanelLive, ResolvedStation } from "@/world/types";

export type PanelLayout = LayoutMode | "sandbox";

/** What the panel emits on every change; the client adds encounterId, modeKey and seq (§3.4). */
export type PanelDraft = Pick<Draft, "input" | "complete" | "focus" | "hover" | "probe" | "settled" | "wave" | "marks">;

/** What a control reports: everything but the probe channel (the panel owns the probe scrubber). */
export type ControlDraft = Omit<PanelDraft, "probe">;

export interface BossPhase {
  id: string;
  itemKeys: readonly string[];
}

/** The station facts the panel needs: a narrow, serialisable slice of ResolvedStation. */
export interface PanelStation {
  encounterId: string;
  modeKey: ModeKey;
  layout: PanelLayout;
  skinId: string;
  objectNoun: string;
  /** machine-named Verify label ("LOCK THE RINGS") and success badge ("RINGS LOCKED") */
  verifyLabel: string;
  successBadge: string;
  /** the orange input tab: `panel.inputSymbol` ?? the meta's input symbol ?? the probe symbol */
  inputSymbol: string | null;
  cardOverrides: readonly CardOverride[];
  /** boss phases (board modes): item-key batches revealed in order (§1.3 BossStaging.phases) */
  bossPhases: readonly BossPhase[];
  /** meta.configSchema.parse(station.config) */
  config: unknown;
  /** meta.probe(config, view) */
  probe: ProbeSpec | null;
}

/** ResolvedStation → PanelStation (H2 calls this once per open station). */
export function panelStationOf(rs: ResolvedStation, opts: { sandbox?: boolean } = {}): PanelStation {
  return {
    encounterId: rs.encounterId,
    modeKey: rs.modeKey,
    layout: opts.sandbox ? "sandbox" : rs.layout,
    skinId: rs.skin,
    objectNoun: rs.objectNoun,
    verifyLabel: rs.panel.verifyLabel,
    successBadge: rs.panel.successBadge,
    inputSymbol: rs.panel.inputSymbol,
    cardOverrides: rs.panel.cards,
    bossPhases: rs.boss?.phases.map((p) => ({ id: p.id, itemKeys: p.itemKeys })) ?? [],
    config: rs.parsedConfig,
    probe: rs.probe,
  };
}

/** A card in display order: RECORD (panel-owned, metaSlot null) first when present, then the meta's cards. */
export interface DisplayCard {
  displaySlot: number;
  /** meta-relative slot (PanelStatic / PanelLive / CardOverride numbering); null for the panel-owned RECORD card */
  metaSlot: number | null;
  card: CardModel;
}

export type LiveChip = PanelLive["chips"][number];
export type LiveHighlight = PanelLive["highlights"][number];

/** Props every instrument control receives (§3.3). */
export interface ControlProps {
  modeKey: ModeKey;
  kind: ControlKind;
  view: unknown;
  /** cached draft input to restore (fromDraftInput), or null for the untouched state */
  initialInput: unknown;
  /** the meta's card of this control's surface kind, when it supplies one (titles, glyphs, headings) */
  surface: CardModel | null;
  highlights: readonly LiveHighlight[];
  phases: readonly BossPhase[];
  /** failed Verifies so far on this station (WaveControl replays with the previous answers preselected) */
  attempt: number;
  disabled: boolean;
  /** id of the pinned instruction line (aria-describedby) */
  describedBy: string;
  verifyLabel: string;
  onChange: (d: ControlDraft) => void;
  /** WidgetControl: the wrapped widget's own submit ("Lock in", restyled as Verify) */
  onSubmitInput: (input: unknown) => void;
}
