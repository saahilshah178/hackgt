/**
 * src/game/expedition/panel — the instrument panel (docs/design/20 §3). What the client (H2) and the host need.
 *
 *   <InstrumentPanel station={panelStationOf(rs)} meta={rs.meta} view={view} context={panelContext}
 *                    aidTier hintsUsed instruction={line} initialDraft={cached} attempt={failedVerifies}
 *                    result={solved ? "success" : null} busy srText announce brief getLive
 *                    onDraft={(d) => draftRef = {...d, encounterId, modeKey, seq: ++seq}; host.bindDraft(...)}
 *                    onVerify={(input) => runner.submit(input)} onBack onBadgeDone handleRef />
 *
 * The panel owns its live state (drafts, probe, panelLive); the client keeps drafts in a ref (no re-render).
 * `handleRef` exposes applyDraftInput / setProbe / focusFirst for __GAME_DEBUG__.expedition.applySolutionDraft and
 * setProbe. Boss batches: `currentPhase(fromDraftInput(draft.input, view), phases)` tells the client which batch
 * line to speak.
 */
export { InstrumentPanel, type InstrumentPanelHandle, type InstrumentPanelProps } from "./InstrumentPanel";
export { panelStationOf, type BossPhase, type ControlDraft, type PanelDraft, type PanelLayout, type PanelStation } from "./types";
export { BriefSheet, type Brief } from "./BriefSheet";
export { BADGE_MS, SuccessBadge } from "./SuccessBadge";
export { controlKindForMode, resolveControlKind, supports as controlSupports } from "./controls/kinds";
export { currentPhase, visibleItems } from "./controls/bins.logic";
export { scalarInputOf, rangeOfProbe, SETTLE_MS } from "./controls/scrub.logic";
export { defaultPanelLive, defaultPanelStatic } from "./default-panel";
export { displayStack, recordChip, showsRecord } from "./panel-model";
