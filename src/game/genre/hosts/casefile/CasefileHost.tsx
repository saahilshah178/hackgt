"use client";

import { useEffect, useId, useMemo, useRef, useState, type CSSProperties, type DragEvent, type KeyboardEvent, type ReactNode } from "react";
import { speakerName, type BoardHostHandle, type BoardHostProps } from "../../types";
import { CaseBoard } from "./CaseBoard";
import { CASEFILE_CSS } from "./casefile.styles";
import {
  buildCasefile,
  clip,
  cluesLeftIn,
  combine,
  correctLine,
  effectiveFound,
  effectiveLeads,
  falseLeadsLine,
  listText,
  looseClues,
  luminance,
  mixHex,
  missingRequirements,
  newlyRevealedLocation,
  revealedClueIds,
  searchHotspot,
  shortConcept,
  wrongLine,
  SCENE_H,
  SCENE_W,
  type Clue,
  type Hotspot,
} from "./casefile.logic";
import { AccusationRoom, SceneRoom, inkFor, pctBox } from "./SceneArt";
import { Face, StepIcon } from "./glyphs";

/*
 * CasefileHost: the mystery genre as a point-and-click investigation. No avatar and no walking: the player SEARCHES
 * illustrated rooms (one per progression track) for clue cards, COMBINES two clues (a case file and the evidence that
 * belongs to it) into a LEAD, CRACKS the lead (the encounter's challenge, in the right-hand column) to earn a
 * DEDUCTION on the case board, and finally makes the ACCUSATION (the boss). All rules live in ./casefile.logic.ts.
 */

type Props = BoardHostProps & { hostRef?: (h: BoardHostHandle | null) => void };

type Line = { speakerId: string; text: string };
type Mood = "neutral" | "good" | "hmm" | "new";
interface Speech {
  lines: Line[];
  mood: Mood;
  key: number;
}
type Inspect = { kind: "clue"; id: string } | { kind: "card"; id: string } | null;

const FOCUSABLE = "button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex='-1'])";

function isTypingTarget(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null;
  if (!el || !el.tagName) return false;
  return /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.isContentEditable;
}

export function CasefileHost(props: Props) {
  const { spec, palette, progression, solved, available, activeId, lastResult, finished } = props;
  const cf = useMemo(() => buildCasefile(spec, progression), [spec, progression]);
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");

  const partnerId = cf.partnerId;
  const [loc, setLoc] = useState(0);
  const [view, setView] = useState<"scene" | "board">("scene");
  const [found, setFound] = useState<ReadonlySet<string>>(() => new Set());
  const [formed, setFormed] = useState<ReadonlySet<string>>(() => new Set());
  const [searched, setSearched] = useState<ReadonlySet<string>>(() => new Set());
  const [selected, setSelected] = useState<string | null>(null);
  const [inspect, setInspect] = useState<Inspect>(null);
  const [mismatches, setMismatches] = useState(0);
  const [status, setStatus] = useState("");
  const [speech, setSpeech] = useState<Speech>(() => ({ lines: spec.narrative.intro.slice(0, 2), mood: "neutral", key: 0 }));
  const [bubble, setBubble] = useState<{ hotspotId: string; text: ReactNode; found: boolean; key: number } | null>(null);
  const [flying, setFlying] = useState<{ box: Hotspot["box"]; n: number; key: number } | null>(null);
  const [fresh, setFresh] = useState<ReadonlySet<string>>(() => new Set());
  const [justFormed, setJustFormed] = useState<string | null>(null);
  const [shake, setShake] = useState<{ ids: string[]; key: number } | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [dropOn, setDropOn] = useState<string | null>(null);
  const [stamp, setStamp] = useState<{ id: string; seq: number } | null>(null);
  const [headFx, setHeadFx] = useState<{ kind: "wrong"; seq: number } | null>(null);
  const [handledSeq, setHandledSeq] = useState(() => lastResult?.seq ?? 0);
  const [newStrings, setNewStrings] = useState<ReadonlySet<string>>(() => new Set());
  const counter = useRef(1);
  const nextKey = () => ++counter.current;

  const revealed = revealedClueIds(cf, progression, solved);
  const [revealedSeen, setRevealedSeen] = useState<ReadonlySet<string>>(() => revealed);

  const conceptName = (id: string) => spec.concepts.find((c) => c.id === id)?.name ?? id;
  const encounterById = useMemo(() => new Map(spec.encounters.map((e) => [e.id, e])), [spec.encounters]);
  const nameOf = (id: string) => (encounterById.get(id)?.conceptIds ?? [id]).map(conceptName).join(" + ");
  const suspectName = cf.suspectId ? speakerName(spec, cf.suspectId) : "the culprit";

  // ---- react to grading (keyed on seq) and to newly revealed clues, during render (no effect round-trip)
  if (lastResult && lastResult.seq !== handledSeq) {
    setHandledSeq(lastResult.seq);
    setStatus("");
    const id = lastResult.encounterId;
    if (lastResult.correct) {
      setStamp({ id, seq: lastResult.seq });
      setNewStrings(new Set(cf.edges.filter((e) => e.to === id || e.from === id).map((e) => `${e.from}>${e.to}`)));
      const after = props.peek(id)?.after ?? [];
      const lines: Line[] = after.length > 0 ? after.slice(0, 2) : [{ speakerId: partnerId, text: correctLine(lastResult.seq, shortConcept(nameOf(id), 40)) }];
      if (cf.bossId && id !== cf.bossId && available.includes(cf.bossId)) lines.push({ speakerId: partnerId, text: `That's every lead. Time to face ${suspectName} in the accusation room.` });
      setSpeech((sp) => ({ lines, mood: "good", key: sp.key + 1 }));
    } else {
      setHeadFx({ kind: "wrong", seq: lastResult.seq });
      setSpeech((sp) => ({ lines: [{ speakerId: partnerId, text: wrongLine(lastResult.seq) }], mood: "hmm", key: sp.key + 1 }));
    }
  }
  if (revealed.size !== revealedSeen.size) {
    const at = newlyRevealedLocation(cf, revealedSeen, revealed);
    setRevealedSeen(revealed);
    if (at >= 0 && !finished) {
      const where = cf.locations[at];
      const text = `Something new turned up at the ${where.title.toLowerCase()}.`;
      setSpeech((s) => ({ lines: [...(s.mood === "good" ? s.lines.slice(0, 1) : []), { speakerId: partnerId, text }], mood: s.mood === "good" ? "good" : "new", key: s.key + 1 }));
    }
  }

  // ---- derived state
  const availableSet = new Set(available);
  const foundEff = effectiveFound(cf, found, solved, activeId);
  const leads = effectiveLeads(formed, solved, activeId);
  const loose = looseClues(cf, foundEff, leads);
  const openLeads = spec.encounters.filter((e) => leads.has(e.id) && !solved.has(e.id) && e.id !== cf.bossId).map((e) => e.id);
  const bossReady = cf.bossId !== null && availableSet.has(cf.bossId);
  const location = cf.locations[Math.min(loc, cf.locations.length - 1)];
  const ink = useMemo(() => inkFor(palette, location.shade), [palette, location.shade]);
  const deductions = spec.encounters.filter((e) => solved.has(e.id)).length;
  const showFinale = finished && !activeId;
  const stepNow = bossReady ? 3 : openLeads.some((id) => availableSet.has(id)) ? 2 : loose.length >= 2 ? 1 : 0;

  // ---- one-shot effects expire, so switching rooms or views never replays them
  useExpire(stamp, 2800, () => setStamp(null));
  useExpire(flying, 1000, () => setFlying(null));
  useExpire(bubble, 3300, () => setBubble(null));
  useExpire(shake, 600, () => setShake(null));
  useExpire(justFormed, 1400, () => setJustFormed(null));
  useExpire(fresh.size > 0 ? fresh : null, 1600, () => setFresh(new Set()));
  useExpire(newStrings.size > 0 ? newStrings : null, 1600, () => setNewStrings(new Set()));

  // ---- debug warp: jump to the encounter's room
  const hostRef = props.hostRef;
  useEffect(() => {
    hostRef?.({
      warpTo: (id) => {
        if (!id) return;
        const at = cf.locationOf.get(id);
        if (at !== undefined) setLoc(at);
        setView("scene");
      },
    });
    return () => hostRef?.(null);
  }, [hostRef, cf]);

  // ---- focus: into the widget when a lead opens; back to the room when it closes; onto the finale button at the end
  const sideRef = useRef<HTMLElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  const prevActive = useRef<string | null>(null);
  useEffect(() => {
    const prev = prevActive.current;
    prevActive.current = activeId;
    const side = sideRef.current;
    if (activeId && activeId !== prev && side) {
      const target = side.querySelector<HTMLElement>(`[data-testid="widget-root"] :is(${FOCUSABLE})`) ?? side.querySelector<HTMLElement>(`[data-testid="challenge-panel"] :is(${FOCUSABLE})`);
      target?.focus({ preventScroll: true });
    } else if (!activeId && prev) {
      if (finished) side?.querySelector<HTMLElement>('[data-testid="host-finale-continue"]')?.focus({ preventScroll: true });
      else tabsRef.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.focus({ preventScroll: true });
    }
  }, [activeId, finished]);

  // ---- actions
  const say = (lines: Line[], mood: Mood = "neutral") => setSpeech((s) => ({ lines, mood, key: s.key + 1 }));
  const partnerSays = (text: string, mood: Mood = "neutral") => say([{ speakerId: partnerId, text }], mood);

  const goTo = (i: number) => {
    setLoc(i);
    setView("scene");
    setBubble(null);
    setStatus("");
  };

  const search = (h: Hotspot) => {
    const got = searchHotspot(cf, h.id, revealed, foundEff);
    setSearched((s) => new Set([...s, h.id]));
    if (got.length === 0) {
      setBubble({ hotspotId: h.id, text: h.flavour, found: false, key: nextKey() });
      setStatus(`${h.label}: ${h.flavour}`);
      return;
    }
    setFound((s) => new Set([...s, ...got]));
    setFresh(new Set(got));
    setFlying({ box: h.box, n: got.length, key: nextKey() });
    const names = got.map((c) => clueTitle(cf.clueById.get(c)!));
    setBubble({
      hotspotId: h.id,
      text: (
        <>
          <strong>Found {got.length === 1 ? "a clue" : `${got.length} clues`}:</strong> {names.join("; ")}
        </>
      ),
      found: true,
      key: nextKey(),
    });
    setStatus(`Found in the ${h.label.toLowerCase()}: ${names.join("; ")}. It's in your clue tray.`);
    if (loose.length < 2 && loose.length + got.length >= 2 && formed.size === 0 && solved.size === 0) partnerSays("A few pieces now. See which of them belong together.");
  };

  const tryCombine = (a: string, b: string) => {
    if (activeId) {
      setStatus("Finish the open lead first (or leave it), then combine more clues.");
      return;
    }
    const r = combine(cf, progression, a, b, available, solved);
    setSelected(null);
    setDropOn(null);
    switch (r.kind) {
      case "same":
        return;
      case "lead": {
        setFormed((s) => new Set([...s, r.encounterId]));
        setJustFormed(r.encounterId);
        setInspect(null);
        partnerSays(`That's a lead: ${shortConcept(nameOf(r.encounterId), 40)}. Let's crack it.`, "good");
        setStatus(`Lead formed: ${nameOf(r.encounterId)}.`);
        props.open(r.encounterId);
        return;
      }
      case "blocked": {
        setFormed((s) => new Set([...s, r.encounterId]));
        setJustFormed(r.encounterId);
        const need = listText(r.missing.map(nameOf));
        partnerSays(`These fit together, but first you need to crack: ${need}.`, "neutral");
        setStatus(`Lead pinned: ${nameOf(r.encounterId)}. It opens once you crack ${need}.`);
        return;
      }
      case "solved":
        partnerSays("We already cracked that one. It's on the case board.");
        return;
      case "same_kind":
        setShake({ ids: [a, b], key: nextKey() });
        partnerSays(r.clueKind === "tag" ? "Two case files won't make a lead. Pair a file with the evidence that belongs in it." : "Two pieces of evidence, no idea to hold them. Pair one with the case file it belongs to.", "hmm");
        return;
      case "mismatch":
        setShake({ ids: [a, b], key: nextKey() });
        setMismatches((n) => n + 1);
        partnerSays("These don't connect. Read the evidence again: which idea is it really about?", "hmm");
        return;
    }
  };

  const pickClue = (id: string) => {
    setInspect({ kind: "clue", id });
    if (selected === null) {
      setSelected(id);
      const c = cf.clueById.get(id)!;
      setStatus(`Selected ${clueTitle(c)}. Now pick the clue it belongs with.`);
    } else if (selected === id) {
      setSelected(null);
      setStatus("");
    } else tryCombine(selected, id);
  };

  const openLead = (id: string) => {
    if (availableSet.has(id)) props.open(id);
  };

  const onSceneKey = (e: KeyboardEvent<HTMLElement>) => {
    if (isTypingTarget(e.target)) return;
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      const n = cf.locations.length;
      const next = (loc + (e.key === "ArrowRight" ? 1 : n - 1)) % n;
      goTo(next);
      requestAnimationFrame(() => tabsRef.current?.querySelectorAll<HTMLElement>('[role="tab"]')[next]?.focus());
    }
  };

  const onTrayKey = (e: KeyboardEvent<HTMLElement>) => {
    if (isTypingTarget(e.target)) return;
    if (e.key === "Escape" && selected) {
      e.stopPropagation();
      setSelected(null);
      setStatus("Selection cleared.");
    }
  };

  const onDrop = (target: string) => (e: DragEvent) => {
    e.preventDefault();
    const from = e.dataTransfer.getData("text/plain") || dragging;
    setDragging(null);
    setDropOn(null);
    if (from && from !== target) tryCombine(from, target);
  };

  // ---- pieces
  // the UI is always a dark noir desk, so a dark palette accent (parchment's brown) is lifted until it reads on it
  const uiAccent = luminance(palette.css.accent) < 0.2 ? mixHex(palette.css.accent, "#ffffff", 0.5) : palette.css.accent;
  const cssVars = { "--cf-accent": uiAccent } as CSSProperties;
  const activeEncounter = activeId ? encounterById.get(activeId) : undefined;
  const isBossActive = activeId !== null && activeId === cf.bossId;

  const tabs = (
    <div className="cf-tabbar">
      <div className="cf-tabs" role="tablist" aria-label="Locations" ref={tabsRef} onKeyDown={onSceneKey}>
        {cf.locations.map((l) => {
          const selectedTab = view === "scene" && l.index === location.index;
          const left = l.kind === "scene" ? cluesLeftIn(cf, l.index, revealed, foundEff) : 0;
          const isAcc = l.kind === "accusation";
          const accSolved = isAcc && cf.bossId !== null && solved.has(cf.bossId);
          return (
            <button
              key={l.id}
              type="button"
              role="tab"
              aria-selected={selectedTab}
              tabIndex={selectedTab || (view === "board" && l.index === location.index) ? 0 : -1}
              className={`cf-tab${isAcc ? " cf-tab-acc" : ""}`}
              data-open={isAcc && bossReady ? "true" : "false"}
              data-testid={`casefile-tab-${l.index}`}
              onClick={() => goTo(l.index)}
              aria-label={`${isAcc ? "Accusation room" : `Scene ${l.index + 1}: ${l.name}`}${left > 0 ? `, ${left} clue${left === 1 ? "" : "s"} still hidden here` : ""}${isAcc ? (accSolved ? ", case closed" : bossReady ? ", open: make your accusation" : ", locked") : ""}`}
            >
              <span className="cf-tab-kicker">{isAcc ? (accSolved ? "Case closed" : bossReady ? "Open now" : "Locked") : `Scene ${l.index + 1}`}</span>
              <span className="cf-tab-title">{isAcc ? "The accusation" : l.title}</span>
              {left > 0 && (
                <span className="cf-tab-badge" aria-hidden>
                  {left}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <button type="button" className="cf-boardbtn" aria-pressed={view === "board"} data-testid="case-board-toggle" onClick={() => setView((v) => (v === "board" ? "scene" : "board"))}>
        <svg viewBox="0 0 24 24" width={24} height={24} aria-hidden>
          <rect x="2" y="3" width="20" height="16" rx="2" fill="#8a5d34" stroke="#ffe9c7" strokeWidth="1.6" />
          <rect x="5" y="6" width="5" height="4" fill="#efe6cf" />
          <rect x="14" y="11" width="5" height="4" fill="#efe6cf" />
          <path d="M7.5 7 L16.5 12" stroke="#d4333f" strokeWidth="1.6" />
        </svg>
        Case board
        <span className="cf-small" style={{ color: "#ffe9c7" }}>
          {deductions}/{spec.encounters.length}
        </span>
      </button>
    </div>
  );

  const scene =
    location.kind === "accusation" ? (
      <div className="cf-stage" onKeyDown={onSceneKey} data-testid="casefile-accusation" data-state={cf.bossId ? (solved.has(cf.bossId) ? "solved" : bossReady ? "available" : "locked") : undefined}>
        <AccusationRoom ink={ink} uid={uid} unlocked={bossReady || (cf.bossId !== null && solved.has(cf.bossId))} solved={cf.bossId !== null && solved.has(cf.bossId)} />
        <div className="cf-nameplate">
          <strong>{suspectName}</strong>
          <span>{clip(spec.characters.find((c) => c.id === cf.suspectId)?.role ?? "Every thread leads here.", 90)}</span>
        </div>
        <div className="cf-accuse-wrap">
          {cf.bossId && solved.has(cf.bossId) ? (
            <p className="cf-accuse-locked">Case closed. {suspectName} has nothing left to say.</p>
          ) : bossReady ? (
            <button type="button" className="cf-accuse" data-testid={`node-${cf.bossId}`} data-state="available" onClick={() => openLead(cf.bossId!)} disabled={activeId === cf.bossId}>
              Make your accusation
            </button>
          ) : (
            <p className="cf-accuse-locked" data-state="locked">
              Crack {cf.bossId ? missingRequirements(progression, cf.bossId, solved).length : 0} more lead{cf.bossId && missingRequirements(progression, cf.bossId, solved).length === 1 ? "" : "s"} before you can accuse {suspectName}.
            </p>
          )}
        </div>
        {stamp && <Stamp key={`stamp-${stamp.seq}`} name={nameOf(stamp.id)} line={encounterById.get(stamp.id)?.debriefLine ?? ""} boss={stamp.id === cf.bossId} />}
      </div>
    ) : (
      <div className="cf-stage" data-testid="casefile-scene" data-location={location.index} onKeyDown={onSceneKey}>
        <SceneRoom location={location} ink={ink} uid={`${uid}-${location.index}`} />
        <p className="cf-caption" aria-hidden>
          {location.place} <span>· {location.title}</span>
        </p>
        <div className="cf-hots" role="group" aria-label={`${location.name}. Tab to a prop and press Enter to search it; left and right arrows change the room.`}>
          {location.hotspots.map((h) => {
            const pending = searchHotspot(cf, h.id, revealed, foundEff).length > 0;
            const wasSearched = searched.has(h.id);
            const glint = !wasSearched || pending;
            return (
              <button
                key={h.id}
                type="button"
                className="cf-hot"
                style={pctBox(h.box)}
                data-testid={`hotspot-${h.id}`}
                data-searched={wasSearched ? "true" : "false"}
                data-pending={pending ? "true" : "false"}
                data-edge={h.box.y + h.box.h > SCENE_H - 70 ? "bottom" : "top"}
                aria-label={`Search the ${h.label.toLowerCase()}${wasSearched ? (pending ? ": something new is here" : ": searched") : ""}`}
                onClick={() => search(h)}
              >
                <span className="cf-hot-label">{h.label}</span>
                {glint && (
                  <span className={`cf-glint${wasSearched ? " cf-glint-new" : ""}`} aria-hidden>
                    <svg viewBox="-12 -12 24 24" className="cf-glint-pulse">
                      <path d="M0 -11 L2.4 -2.4 L11 0 L2.4 2.4 L0 11 L-2.4 2.4 L-11 0 L-2.4 -2.4 Z" fill={wasSearched ? "#ffffff" : "#ffcf7a"} />
                    </svg>
                  </span>
                )}
              </button>
            );
          })}
        </div>
        {bubble && location.hotspots.some((h) => h.id === bubble.hotspotId) && <SearchBubble key={`bubble-${bubble.key}`} box={location.hotspots.find((h) => h.id === bubble.hotspotId)!.box} found={bubble.found} text={bubble.text} />}
        {flying && <div key={`fly-${flying.key}`} className="cf-fly" style={{ left: `${((flying.box.x + flying.box.w / 2) / SCENE_W) * 100}%`, top: `${((flying.box.y + flying.box.h / 2) / SCENE_H) * 100}%` }} aria-hidden />}
        {stamp && <Stamp key={`stamp-${stamp.seq}`} name={nameOf(stamp.id)} line={encounterById.get(stamp.id)?.debriefLine ?? ""} boss={stamp.id === cf.bossId} />}
      </div>
    );

  const tray = (
    <section className="cf-tray" aria-label="Clue tray" data-testid="casefile-tray" onKeyDown={onTrayKey}>
      <div className="cf-tray-head">
        <span className="cf-tray-title">Clues in hand · {loose.length}</span>
        <span className="cf-status" role="status" aria-live="polite" data-testid="casefile-status">
          {status || (location.kind === "accusation" ? (bossReady ? `Face ${suspectName}: make your accusation.` : "The accusation room opens once every lead is cracked.") : loose.length >= 2 ? "Select one clue, then the clue it belongs with (or drag one onto the other)." : loose.length === 1 ? "One clue so far. Search for the piece it belongs with." : "Search the room: every prop with a glint might hide something.")}
        </span>
      </div>
      <div className="cf-tray-row">
        {openLeads.map((id) => {
          const isOpen = availableSet.has(id);
          const need = missingRequirements(progression, id, solved).map(nameOf);
          const isActive = activeId === id;
          return (
            <button
              key={`lead-${id}`}
              type="button"
              className={`cf-lead${justFormed === id ? " cf-lead-in" : ""}${isActive ? " cf-lead-active" : ""}`}
              data-testid={isOpen ? `node-${id}` : `lead-${id}`}
              data-state={isOpen ? "available" : "locked"}
              aria-disabled={!isOpen}
              aria-label={isOpen ? `Lead: ${nameOf(id)}. Crack it.` : `Lead: ${nameOf(id)}. Opens after you crack ${listText(need)}.`}
              onClick={() => (isActive ? sideRef.current?.querySelector<HTMLElement>(`[data-testid="challenge-panel"] :is(${FOCUSABLE})`)?.focus() : isOpen ? openLead(id) : setStatus(`That lead opens after you crack ${listText(need)}.`))}
            >
              <svg className="cf-lead-papers" viewBox="0 0 64 50" aria-hidden>
                <rect x="2" y="6" width="30" height="38" fill="#f3e2b8" transform="rotate(-8 17 25)" />
                <rect x="32" y="4" width="30" height="38" fill="#efe6cf" transform="rotate(6 47 23)" />
                <path className="cf-string" d="M14 10 Q32 34 48 8" stroke="#d4333f" strokeWidth="2.5" fill="none" />
                <circle cx="14" cy="10" r="3" fill="#d4333f" />
                <circle cx="48" cy="8" r="3" fill="#d4333f" />
              </svg>
              <span className="cf-lead-kicker">{isActive ? "Cracking…" : isOpen ? "Lead" : "Pinned lead"}</span>
              <span className="cf-lead-name" style={{ paddingRight: 60 }}>
                {nameOf(id)}
              </span>
              <span className="cf-lead-cta">{isOpen ? (isActive ? "Open in the casebook" : "Crack the lead") : `Needs: ${clip(listText(need.map((n) => shortConcept(n, 24))), 40)}`}</span>
            </button>
          );
        })}
        {loose.map((c) => (
          <ClueCard
            key={c.id}
            clue={c}
            selected={selected === c.id}
            fresh={fresh.has(c.id)}
            shake={shake?.ids.includes(c.id) ? shake.key : null}
            dropTarget={dropOn === c.id}
            onPick={() => pickClue(c.id)}
            onFocus={() => setInspect({ kind: "clue", id: c.id })}
            onDragStart={(e) => {
              e.dataTransfer.setData("text/plain", c.id);
              e.dataTransfer.effectAllowed = "link";
              setDragging(c.id);
              setSelected(null);
            }}
            onDragEnd={() => {
              setDragging(null);
              setDropOn(null);
            }}
            onDragOver={(e) => {
              if (!dragging || dragging === c.id) return;
              e.preventDefault();
              if (dropOn !== c.id) setDropOn(c.id);
            }}
            onDragLeave={() => dropOn === c.id && setDropOn(null)}
            onDrop={onDrop(c.id)}
          />
        ))}
        {loose.length === 0 && openLeads.length === 0 && <p className="cf-tray-empty">{finished || cf.clues.every((c) => foundEff.has(c.id)) ? "Every clue you found is filed on the case board." : location.kind === "accusation" ? "No clues in hand. The scenes still hide a few." : "No clues in hand yet. Search the room above."}</p>}
      </div>
    </section>
  );

  const board = (
    <CaseBoard
      spec={spec}
      cf={cf}
      progression={progression}
      solved={solved}
      available={availableSet}
      leads={leads}
      activeId={activeId}
      finished={finished}
      newStrings={newStrings}
      selected={inspect?.kind === "card" ? inspect.id : null}
      nameOf={nameOf}
      onInspect={(id) => setInspect({ kind: "card", id })}
      onOpen={openLead}
    />
  );

  // ---- right-hand column
  let side: ReactNode;
  if (activeId) {
    const pair = cf.cluesOf.get(activeId);
    side = (
      <div className="flex flex-col gap-3">
        <div className="cf-challenge-head" data-fx={headFx && lastResult?.encounterId === activeId && !lastResult.correct ? "wrong" : undefined} key={headFx?.seq ?? 0}>
          <div className="cf-speech-face" data-who={isBossActive ? "suspect" : "partner"} style={{ width: 60, height: 60 }}>
            <Face who={isBossActive ? "suspect" : "partner"} accent={palette.css.accent} />
          </div>
          <div>
            <p className="cf-kicker">{isBossActive ? `The accusation · ${suspectName}` : "Crack the lead"}</p>
            <p className="cf-challenge-name">{activeEncounter ? nameOf(activeEncounter.id) : ""}</p>
            {lastResult && lastResult.encounterId === activeId && !lastResult.correct && speech.mood === "hmm" && (
              <p className="cf-head-line" data-testid="casefile-hmm">
                <strong>{speakerName(spec, partnerId)}:</strong> &ldquo;{speech.lines[0]?.text}&rdquo;
              </p>
            )}
          </div>
        </div>
        {pair && (
          <div className="cf-mini-clues" aria-label="The clues behind this lead">
            {pair.map((cid) => {
              const c = cf.clueById.get(cid)!;
              return (
                <div key={cid} className="cf-mini" data-kind={c.kind}>
                  <span className="cf-mini-label">{c.label}</span>
                  <span className="cf-mini-text">{c.text}</span>
                </div>
              );
            })}
          </div>
        )}
        {props.challenge}
      </div>
    );
  } else if (showFinale) {
    side = <Finale spec={spec} place={cf.place} deductions={deductions} mismatches={mismatches} suspectName={suspectName} complete={props.complete} accent={palette.css.accent} />;
  } else {
    side = (
      <>
        <SpeechBand speech={speech} spec={spec} partnerId={partnerId} suspectId={cf.suspectId} accent={palette.css.accent} />
        <InspectPanel spec={spec} cf={cf} inspect={inspect} solved={solved} leads={leads} available={availableSet} nameOf={nameOf} progression={progression} />
        <div className="cf-panel">
          <p className="cf-kicker">How to investigate</p>
          <ol className="cf-steps" style={{ marginTop: 8, gridTemplateColumns: `repeat(${cf.bossId ? 4 : 3}, 1fr)` }}>
            {(cf.bossId ? ["Search", "Combine", "Crack", "Accuse"] : ["Search", "Combine", "Crack"]).map((label, i) => (
              <li key={label} className="cf-step" data-current={stepNow === i ? "true" : "false"} data-done={stepNow > i ? "true" : "false"}>
                <StepIcon step={i} />
                <span>{label}</span>
              </li>
            ))}
          </ol>
          <p className="cf-small" style={{ marginTop: 8 }}>
            {stepNow === 0
              ? "Search the props with a glint. Clues slide into your tray."
              : stepNow === 1
                ? "Match a case file with the evidence that belongs to it: that pair is a lead."
                : stepNow === 2
                  ? "A lead is ready. Select it in the tray to crack it."
                  : `Every lead is cracked. Go to the accusation room and face ${suspectName}.`}
          </p>
        </div>
        <div className="cf-panel">
          <p className="cf-count" data-testid="casefile-deductions">
            Deductions <strong>{deductions}</strong> / {spec.encounters.length}
          </p>
          <div className="cf-pins" aria-label="Case progress">
            {spec.encounters.map((e) => {
              const st = solved.has(e.id) ? "solved" : availableSet.has(e.id) ? "available" : "locked";
              return <span key={e.id} className="cf-pinmark" data-state={st} data-boss={e.id === cf.bossId ? "true" : "false"} role="img" aria-label={`${leads.has(e.id) || solved.has(e.id) ? nameOf(e.id) : "Unknown lead"}: ${st === "solved" ? "deduced" : st === "available" ? "open" : "locked"}`} />;
            })}
          </div>
          {mismatches > 0 && <p className="cf-small" style={{ marginTop: 8 }}>False leads ruled out: {mismatches}</p>}
        </div>
        <p className="cf-keys">
          <kbd>Tab</kbd> to a prop, <kbd>Enter</kbd> to search · <kbd>←</kbd>/<kbd>→</kbd> change room · select two clues to combine · <kbd>Esc</kbd> clears a selection
        </p>
      </>
    );
  }

  return (
    <div data-testid="casefile-host" className="cf-host" style={cssVars} data-view={view} data-finished={finished ? "true" : "false"}>
      <style>{CASEFILE_CSS}</style>
      <div className="cf-main">
        {tabs}
        {view === "board" || showFinale ? (
          <div role="region" aria-label="Case board">
            {board}
          </div>
        ) : (
          <>
            {scene}
            {tray}
          </>
        )}
      </div>
      <aside ref={sideRef} className="cf-side" aria-label={activeId ? "Casebook: the open lead" : "Casebook"}>
        {side}
      </aside>
    </div>
  );
}

/** Calls `clear` `ms` after `value` last changed to something non-null. */
function useExpire(value: unknown, ms: number, clear: () => void) {
  const clearRef = useRef(clear);
  useEffect(() => {
    clearRef.current = clear;
  });
  useEffect(() => {
    if (value === null || value === undefined) return;
    const t = window.setTimeout(() => clearRef.current(), ms);
    return () => window.clearTimeout(t);
  }, [value, ms]);
}

function clueTitle(c: Clue): string {
  return c.kind === "tag" ? `${c.label}: ${c.text}` : `${c.label} ("${clip(c.text, 48)}")`;
}

// ---------------------------------------------------------------------------------------------------------------

function SearchBubble({ box, found, text }: { box: Hotspot["box"]; found: boolean; text: ReactNode }) {
  const cx = ((box.x + box.w / 2) / SCENE_W) * 100;
  const below = box.y < 120;
  const top = below ? ((box.y + box.h) / SCENE_H) * 100 : (box.y / SCENE_H) * 100;
  const alignLeft = cx < 22;
  const alignRight = cx > 78;
  const tx = alignLeft ? "0%" : alignRight ? "-100%" : "-50%";
  return (
    <div className="cf-bubble" data-found={found ? "true" : "false"} role="presentation" style={{ left: `${alignLeft ? (box.x / SCENE_W) * 100 : alignRight ? ((box.x + box.w) / SCENE_W) * 100 : cx}%`, top: `${top}%`, transform: `translate(${tx}, ${below ? "10px" : "calc(-100% - 10px)"})` }}>
      {text}
    </div>
  );
}

function Stamp({ name, line, boss }: { name: string; line: string; boss: boolean }) {
  return (
    <div className="cf-stamp" aria-hidden>
      <p className="cf-stamp-kicker">{boss ? "The accusation" : "Deduction"}</p>
      <p className="cf-stamp-name" style={{ paddingRight: 170 }}>
        {name}
      </p>
      {line && (
        <p style={{ fontSize: 16, marginTop: 8, lineHeight: 1.35 }} className="cf-card-text">
          {line}
        </p>
      )}
      <span className="cf-stamp-mark">{boss ? "GUILTY" : "DEDUCED"}</span>
    </div>
  );
}

function ClueCard(props: {
  clue: Clue;
  selected: boolean;
  fresh: boolean;
  shake: number | null;
  dropTarget: boolean;
  onPick(): void;
  onFocus(): void;
  onDragStart(e: DragEvent): void;
  onDragEnd(): void;
  onDragOver(e: DragEvent): void;
  onDragLeave(): void;
  onDrop(e: DragEvent): void;
}) {
  const { clue: c } = props;
  return (
    <button
      key={props.shake ?? 0}
      type="button"
      draggable
      className={`cf-card${props.fresh ? " cf-card-in" : ""}${props.shake !== null ? " cf-card-shake" : ""}`}
      style={{ transform: `rotate(${c.tilt}deg)` }}
      data-testid={`clue-${c.id}`}
      data-kind={c.kind}
      data-encounter={c.encounterId}
      data-drop={props.dropTarget ? "true" : "false"}
      aria-pressed={props.selected}
      aria-label={`${c.label}: ${c.text}${c.sub ? `. ${c.sub}` : ""}`}
      onClick={props.onPick}
      onFocus={props.onFocus}
      onMouseEnter={props.onFocus}
      onDragStart={props.onDragStart}
      onDragEnd={props.onDragEnd}
      onDragOver={props.onDragOver}
      onDragLeave={props.onDragLeave}
      onDrop={props.onDrop}
    >
      <span className="cf-card-pin" aria-hidden />
      <span className="cf-card-label">{c.label}</span>
      {c.kind === "tag" ? (
        <>
          <span className="cf-card-tagname">{c.text}</span>
          <span className="cf-card-sub">&#8627; {c.sub}</span>
        </>
      ) : (
        <span className="cf-card-text">{c.text}</span>
      )}
    </button>
  );
}

function SpeechBand({ speech, spec, partnerId, suspectId, accent }: { speech: Speech; spec: Props["spec"]; partnerId: string; suspectId: string | null; accent: string }) {
  const first = speech.lines[0];
  const who = first && suspectId && first.speakerId === suspectId ? "suspect" : "partner";
  const role = spec.characters.find((c) => c.id === (first?.speakerId ?? partnerId))?.role;
  return (
    <div className="cf-speech" data-mood={speech.mood} key={speech.key} data-testid="casefile-speech">
      <div className="cf-speech-face" data-who={who}>
        <Face who={who} accent={accent} />
      </div>
      <div className="cf-speech-body" role="status" aria-live="polite">
        {speech.lines.map((l, i) => (
          <div key={i}>
            {(i === 0 || l.speakerId !== speech.lines[i - 1].speakerId) && <p className="cf-speech-name">{speakerName(spec, l.speakerId)}</p>}
            <p className="cf-speech-line">&ldquo;{l.text}&rdquo;</p>
          </div>
        ))}
        {speech.key === 0 && role && <p className="cf-small" style={{ marginTop: 6 }}>{clip(role, 90)}</p>}
      </div>
    </div>
  );
}

function InspectPanel(props: {
  spec: Props["spec"];
  cf: ReturnType<typeof buildCasefile>;
  inspect: Inspect;
  solved: ReadonlySet<string>;
  leads: ReadonlySet<string>;
  available: ReadonlySet<string>;
  nameOf(id: string): string;
  progression: Props["progression"];
}) {
  const { cf, inspect } = props;
  if (!inspect) return null;
  if (inspect.kind === "clue") {
    const c = cf.clueById.get(inspect.id);
    if (!c) return null;
    const where = cf.locations[c.locationIndex];
    const prop = where?.hotspots.find((h) => h.id === c.hotspotId);
    return (
      <div className="cf-inspect" data-kind={c.kind} data-testid="casefile-inspect">
        <p className="cf-inspect-label">{c.label}</p>
        <p className="cf-inspect-text" style={c.kind === "tag" ? { fontWeight: 800, fontSize: 24 } : undefined}>
          {c.text}
        </p>
        {c.sub && <p className="cf-inspect-meta">{c.sub}</p>}
        <p className="cf-inspect-meta">
          Found: {where?.title}
          {prop ? `, ${prop.label.toLowerCase()}` : ""}
        </p>
      </div>
    );
  }
  const id = inspect.id;
  const e = props.spec.encounters.find((x) => x.id === id);
  if (!e) return null;
  const known = props.leads.has(id) || props.solved.has(id);
  const need = missingRequirements(props.progression, id, props.solved).map(props.nameOf);
  return (
    <div className="cf-inspect" data-kind="evidence" data-testid="casefile-inspect">
      <p className="cf-inspect-label">{props.solved.has(id) ? "Deduction" : known ? "Open lead" : "Unknown lead"}</p>
      <p className="cf-inspect-text" style={{ fontWeight: 800 }}>
        {known ? props.nameOf(id) : "???"}
      </p>
      {props.solved.has(id) ? (
        <p className="cf-inspect-meta" style={{ fontSize: 18, color: "#1d1a14" }}>
          {e.debriefLine}
        </p>
      ) : id === cf.bossId ? (
        <p className="cf-inspect-meta">{props.available.has(id) ? "Everything points one way. Make your accusation." : `The accusation waits on ${need.length} more lead${need.length === 1 ? "" : "s"}.`}</p>
      ) : known ? (
        <p className="cf-inspect-meta">{props.available.has(id) ? "Ready to crack." : `Opens after: ${listText(need)}.`}</p>
      ) : (
        <p className="cf-inspect-meta">Its clues are hidden in {cf.locations[cf.locationOf.get(id) ?? 0]?.title ?? "a scene"}. Find both and combine them.</p>
      )}
    </div>
  );
}

function Finale(props: { spec: Props["spec"]; place: string; deductions: number; mismatches: number; suspectName: string; complete(): void; accent: string }) {
  const { spec } = props;
  const outro = spec.narrative.outro;
  const lead = outro[0];
  return (
    <div className="flex flex-col gap-4" data-testid="casefile-finale">
      <article className="cf-paper" aria-label="Case closed">
        <header className="cf-paper-mast">
          <span className="cf-paper-name">{props.place.replace(/^The /, "The ")} Gazette</span>
          <span className="cf-paper-date">Late edition</span>
        </header>
        <h2 className="cf-paper-head">Case closed</h2>
        <p className="cf-paper-sub">{spec.title}</p>
        <div className="cf-paper-cols">
          <div>
            {lead && (
              <p>
                &ldquo;{lead.text}&rdquo; said {speakerName(spec, lead.speakerId)}, as the last thread went up on the board.
              </p>
            )}
            {outro.slice(1, 3).map((l, i) => (
              <p key={i}>
                {speakerName(spec, l.speakerId)}: &ldquo;{l.text}&rdquo;
              </p>
            ))}
            <p>
              {props.deductions} deduction{props.deductions === 1 ? "" : "s"} went on the record. {falseLeadsLine(props.mismatches)}
            </p>
          </div>
          <div>
            <div className="cf-paper-photo" aria-hidden>
              <svg viewBox="0 0 120 90" width="100%" height="100%">
                <rect width="120" height="90" fill="#15121c" />
                <polygon points="54,0 66,0 110,90 10,90" fill="#ffcf7a" opacity="0.18" />
                <circle cx="60" cy="6" r="4" fill="#ffcf7a" />
                <path d="M34 90 C36 64 46 58 60 58 C74 58 84 64 86 90 Z" fill="#050508" />
                <ellipse cx="60" cy="46" rx="11" ry="13" fill="#050508" />
                <ellipse cx="60" cy="36" rx="20" ry="4" fill="#050508" />
                <path d="M49 36 Q50 22 60 23 Q70 22 71 36 Z" fill="#050508" />
                <rect x="72" y="62" width="40" height="16" fill="none" stroke="#d4333f" strokeWidth="2.5" transform="rotate(-10 92 70)" />
                <text x="92" y="74" fontSize="9" fontWeight="900" fill="#d4333f" textAnchor="middle" transform="rotate(-10 92 70)">
                  CLOSED
                </text>
              </svg>
            </div>
            <p className="cf-paper-cap">{props.suspectName}, after the accusation.</p>
          </div>
        </div>
      </article>
      <button type="button" className="cf-btn self-start" style={{ fontSize: 22, padding: "12px 24px" }} data-testid="host-finale-continue" onClick={props.complete} autoFocus>
        Read the full report
      </button>
    </div>
  );
}
