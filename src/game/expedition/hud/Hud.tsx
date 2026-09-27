"use client";
/**
 * Hud (bible §3.10, docs/design/20 §2.6): the DOM layer over the world.
 *   top-left: <h1> zone title, ObjectiveRing, the objective line (4 s on zone entry and on J), MeterBar, counters
 *   top-right: key legend button (H / ?), mute toggle (N)
 *   overlays: KeyLegend card
 * Hotkeys (window keydown, ignoring typing targets): H/? legend, N mute, J journal + objective line, M map
 * (explore only, when the story has one), Esc closes the legend.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import type { Collectible, Story } from "../../../contracts/world";
import type { AudioBus } from "../audio/bus";
import styles from "./hud.module.css";
import { hudHotkey } from "./key-legend";
import { KeyLegend } from "./KeyLegend";
import { MeterBar } from "./MeterBar";
import { MuteToggle } from "./MuteToggle";
import { ObjectiveRing } from "./ObjectiveRing";
import { collectibleCounters, countersText, meterValue as meterValueOf, objectiveLine, zoneProgress } from "./objective";

export interface HudProps {
  story: Story;
  zone: { id: string; name: string } | null;
  stations: readonly { encounterId: string; zoneId: string }[];
  solvedIds: readonly string[];
  bus: AudioBus | null;
  collectibles?: readonly Pick<Collectible, "id" | "kind">[];
  collected?: ReadonlySet<string>;
  /** override the meter value (default: from story.meter and solvedIds) */
  meterValue?: number | null;
  /** explore: every hotkey; panel/cutscene: H, N and Esc only */
  mode?: "explore" | "panel" | "cutscene";
  onOpenMap?: () => void;
  onToggleJournal?: () => void;
  /** listen for the HUD hotkeys on window (default true) */
  hotkeys?: boolean;
}

export function Hud({
  story,
  zone,
  stations,
  solvedIds,
  bus,
  collectibles = [],
  collected,
  meterValue,
  mode = "explore",
  onOpenMap,
  onToggleJournal,
  hotkeys = true,
}: HudProps) {
  const [legendOpen, setLegendOpen] = useState(false);
  const [objectivePing, setObjectivePing] = useState(0);
  const legendOpenRef = useRef(false);
  useEffect(() => {
    legendOpenRef.current = legendOpen;
  }, [legendOpen]);

  const progress = useMemo(() => zoneProgress(stations, zone?.id ?? null, solvedIds), [stations, zone, solvedIds]);
  const meterVal = meterValue !== undefined ? meterValue : meterValueOf(story.meter, solvedIds);
  const counters = useMemo(() => collectibleCounters(collectibles, collected ?? new Set()), [collectibles, collected]);
  const anyCollected = counters.some((c) => c.have > 0);
  const openMap = story.map && onOpenMap ? onOpenMap : undefined;

  useEffect(() => {
    if (!hotkeys || typeof window === "undefined") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.repeat) return;
      const t = e.target instanceof Element ? e.target : null;
      const action = hudHotkey({
        key: e.key,
        ctrlKey: e.ctrlKey,
        metaKey: e.metaKey,
        altKey: e.altKey,
        targetTag: t?.tagName ?? null,
        targetRole: t?.getAttribute("role") ?? null,
      });
      if (!action) return;
      switch (action) {
        case "legend":
          setLegendOpen((o) => !o);
          break;
        case "mute":
          bus?.toggleMute();
          break;
        case "journal":
          if (mode !== "explore") return;
          setObjectivePing((n) => n + 1);
          onToggleJournal?.();
          break;
        case "map":
          if (mode !== "explore" || !openMap) return;
          openMap();
          break;
        case "close":
          if (!legendOpenRef.current) return; // Esc belongs to the panel / cutscene otherwise
          setLegendOpen(false);
          break;
      }
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hotkeys, bus, mode, onToggleJournal, openMap]);

  return (
    <>
      <div className={styles.hud} data-testid="hud" data-mode={mode}>
        <div className={styles.row}>
          <ObjectiveRing story={story} progress={progress} zoneId={zone?.id ?? null} onOpenMap={openMap} />
          <h1 className={styles.zoneTitle} data-testid="zone-title">
            {zone?.name ?? story.objective}
          </h1>
        </div>
        <p key={`${zone?.id ?? "-"}:${objectivePing}`} className={styles.objLine} data-testid="objective-text" aria-hidden="true">
          {objectiveLine(story, progress)}
        </p>
        {story.meter && meterVal !== null && story.meter.drives.includes("hud_bar") && <MeterBar meter={story.meter} value={meterVal} />}
        {anyCollected && (
          <p key={countersText(counters)} className={styles.counters} data-testid="counters" role="status">
            {countersText(counters)}
          </p>
        )}
      </div>
      <div className={styles.controls}>
        <button
          type="button"
          className={styles.iconButton}
          data-testid="key-legend-button"
          aria-label="Keys"
          aria-keyshortcuts="H ?"
          aria-expanded={legendOpen}
          onClick={() => setLegendOpen((o) => !o)}
        >
          ?
        </button>
        <MuteToggle bus={bus} />
      </div>
      <KeyLegend open={legendOpen} onClose={() => setLegendOpen(false)} />
    </>
  );
}
