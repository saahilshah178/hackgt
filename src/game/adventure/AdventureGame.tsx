"use client";
/* eslint-disable react-hooks/refs -- EncounterRunner is an imperative model; revision updates follow every mutation. */
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, BookOpen, Compass, Lightbulb, Map, Volume2, VolumeX, X, Sparkles, Check, Backpack } from "lucide-react";
import type { GameSpec } from "@/contracts/gamespec";
import { EncounterRunner } from "../runner/encounter-runner";
import { installGameDebug } from "../debug";
import { EndScreen } from "../systems/EndScreen";
import { AdventureScene } from "./AdventureScene";
import { AdventureInstrument } from "./AdventureInstrument";
import type { AdventureCampaign } from "./campaigns";
import "./adventure.css";

type Panel = "intro" | "mission" | "instrument" | "dialogue" | "journal" | "map" | "finale";

export function AdventureGame({ spec, campaign }: { spec: GameSpec; campaign: AdventureCampaign }) {
  const runnerRef = useRef<EncounterRunner | null>(null);
  if (!runnerRef.current) runnerRef.current = new EncounterRunner(spec);
  const runner = runnerRef.current;
  const [chapterIndex, setChapterIndex] = useState(0);
  const [panel, setPanel] = useState<Panel>("intro");
  const [restored, setRestored] = useState(false);
  const [relay, setRelay] = useState(false);
  const [notes, setNotes] = useState<string[]>([]);
  const [liveValue, setLiveValue] = useState(0);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [end, setEnd] = useState(false);
  const [sound, setSound] = useState(false);
  const [notice, setNotice] = useState("");
  const audioRef = useRef<AudioContext | null>(null);
  const currentRef = useRef(runner.current()!);
  const current = currentRef.current;
  const chapter = campaign.chapters[chapterIndex];
  const act = Math.min(3, Math.floor(chapterIndex / campaign.chapters.length * 3) + 1);
  const progress = (chapterIndex + (restored ? 1 : 0)) / campaign.chapters.length;

  const chime = useCallback((success: boolean) => {
    if (!sound || !audioRef.current) return;
    const ctx = audioRef.current;
    if (ctx.state === "suspended") void ctx.resume();
    [0, 1, 2].forEach((n) => {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = (success ? 330 : 180) * [1, 1.25, 1.5][n];
      gain.gain.setValueAtTime(0, ctx.currentTime + n * .1);
      gain.gain.linearRampToValueAtTime(.055, ctx.currentTime + n * .1 + .02);
      gain.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + n * .1 + .5);
      oscillator.connect(gain); gain.connect(ctx.destination);
      oscillator.start(ctx.currentTime + n * .1); oscillator.stop(ctx.currentTime + n * .1 + .55);
    });
  }, [sound]);

  useEffect(() => () => { void audioRef.current?.close(); }, []);
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 4500);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => installGameDebug({
    state: () => ({ finished: runner.finished, index: runner.current()?.index ?? spec.encounters.length, encounterId: runner.current()?.encounter.id ?? null, mastery: runner.mastery() }),
    skipTo: (id) => {
      runner.skipTo(id); currentRef.current = runner.current()!;
      setChapterIndex(runner.current()!.index); setRestored(false); setRelay(false); setPanel("mission"); setFeedback(null); setHint(null); setHintsUsed(0);
    },
    autoSolve: () => {
      if (runner.finished) return;
      runner.autoSolve();
      if (runner.finished) setEnd(true);
      else { currentRef.current = runner.current()!; setChapterIndex(runner.current()!.index); setRestored(false); setRelay(false); setPanel("mission"); }
    },
    events: () => runner.telemetry(), mastery: () => runner.mastery(),
  }), [runner, spec.encounters.length]);

  const interact = (target: "apparatus" | "companion" | "exit") => {
    if (panel === "intro" || panel === "finale") return;
    if (target === "companion") { setPanel("dialogue"); return; }
    if (target === "apparatus") {
      if (restored) { setNotice(chapter.consequence); return; }
      if (!relay) { setNotice(campaign.kind === "archive" ? "Switch on the desk lamp before examining the documents." : "Activate the nearby relay to power this instrument."); return; }
      setPanel("instrument"); return;
    }
    if (!restored) { setNotice("The route is not ready. Complete the mission at the apparatus first."); return; }
    if (runner.finished) { setPanel("finale"); return; }
    currentRef.current = runner.current()!;
    setChapterIndex(runner.current()!.index); setRestored(false); setRelay(false); setFeedback(null); setHint(null); setHintsUsed(0); setLiveValue(0); setPanel("mission");
  };

  const submit = (input: unknown) => {
    if (restored) return;
    const result = runner.submit(input);
    setFeedback(result.feedback);
    chime(result.correct);
    if (result.correct) { setRestored(true); setPanel("mission"); setNotice(chapter.consequence); }
  };

  if (end) {
    const debrief = runner.debrief();
    return <div className={`adventure adventure--${campaign.kind}`}><EndScreen gameId={spec.id} title={campaign.title} outro={[{ speakerId: "guide", text: campaign.finale }]} mastery={debrief.mastery} lines={debrief.lines} telemetry={runner.telemetry()} /><div className="adventure-end-links"><Link href="/">Choose another expedition</Link><button onClick={() => window.location.reload()}>Play again</button></div></div>;
  }

  return <main className={`adventure adventure--${campaign.kind}`} data-testid="adventure-game">
    <header className="adventure-topbar">
      <Link href="/" className="adventure-back" aria-label="Back to showcase"><ArrowLeft size={17} /><span>QUEST FORGE</span></Link>
      <div className="adventure-title"><small>{campaign.subtitle}</small><h1>{campaign.title}</h1></div>
      <div className="adventure-tools">
        <button aria-label="Open field journal" aria-pressed={panel === "journal"} onClick={() => setPanel(panel === "journal" ? "mission" : "journal")} disabled={panel === "intro"}><BookOpen size={18} /><span>Journal</span></button>
        <button aria-label="Open expedition map" aria-pressed={panel === "map"} onClick={() => setPanel(panel === "map" ? "mission" : "map")} disabled={panel === "intro"}><Map size={18} /><span>Map</span></button>
        <button aria-label={sound ? "Mute sound" : "Enable sound"} aria-pressed={sound} onClick={() => { if (!audioRef.current) audioRef.current = new AudioContext(); setSound(!sound); }}>{sound ? <Volume2 size={18} /> : <VolumeX size={18} />}</button>
      </div>
    </header>

    <div className="adventure-layout">
      <section className="adventure-world" aria-label="Exploration world">
        <div className="adventure-location"><span className="adventure-kicker">ACT {String(act).padStart(2, "0")} / {campaign.kind === "archive" ? "THE RECONSTRUCTION" : "THE RESTORATION"}</span><h2>{chapter.name.replace(/^Act (?:I|II|III) · /, "")}</h2><span className="adventure-location-number">{String(chapterIndex + 1).padStart(2, "0")} <i>/ {String(campaign.chapters.length).padStart(2, "0")}</i></span></div>
        <AdventureScene key={`${campaign.id}-${chapterIndex}`} kind={campaign.kind} chapterIndex={chapterIndex} platformer={spec.genre === "platformer"} restored={restored} disabled={panel === "intro" || panel === "instrument" || panel === "finale"} collected={notes.includes(chapter.id)} relayActive={relay} liveValue={liveValue}
          onCollect={() => { setNotes((previous) => previous.includes(chapter.id) ? previous : [...previous, chapter.id]); setNotice(`Field note recovered: ${chapter.discovery}`); chime(true); }}
          onRelay={() => { setRelay(true); setNotice(campaign.kind === "archive" ? "Desk lamp on. The documents are ready to examine." : "Power restored. The apparatus is ready to use."); chime(true); }} onInteract={interact} />
        <div className="adventure-world-bottom"><span><Compass size={15} /> {restored ? "Route unlocked · proceed to the exit" : relay ? "Apparatus online · investigate the mechanism" : campaign.kind === "archive" ? "Explore the archive · turn on the desk lamp" : "Explore the site · activate the relay"}</span><span><Backpack size={15} /> {notes.length} field notes</span></div>
        {notice && <div className="adventure-toast" role="status">{notice}</div>}
      </section>

      <aside className="adventure-console" aria-label="Mission and apparatus">
        <div className="adventure-console-top"><span><span className="adventure-status-light" /> {panel === "instrument" ? "APPARATUS LINK" : "EXPEDITION LOG"}</span><span>{restored ? "RESTORED" : "LIVE"}</span></div>
        {panel !== "intro" && panel !== "mission" && panel !== "finale" && <button className="adventure-close" onClick={() => setPanel("mission")} aria-label="Return to exploration"><X size={17} /> Return to exploration</button>}

        {panel === "intro" && <div className="adventure-panel adventure-intro"><span className="adventure-kicker">YOUR EXPEDITION BEGINS</span><h2>{campaign.role}</h2><p>{campaign.intro}</p><div className="adventure-guide"><div className="adventure-portrait">{campaign.companion.slice(0, 1)}</div><div><strong>{campaign.companion}</strong><small>{campaign.companionRole}</small></div></div><blockquote>“{chapter.briefing}”</blockquote><button className="adventure-primary" onClick={() => setPanel("mission")}>Begin expedition <ArrowRight size={17} /></button><p className="adventure-fine">Explore with WASD / arrows, or click the ground. Use E near an object. {spec.genre === "platformer" ? "Space to jump. " : ""}Object buttons also support touch and keyboard.</p></div>}

        {(panel === "mission" || panel === "dialogue") && <div className="adventure-panel">
          <span className="adventure-kicker">{restored ? "MISSION COMPLETE" : "CURRENT OBJECTIVE"}</span><h2>{restored ? "A way forward." : chapter.apparatus}</h2><p>{restored ? chapter.consequence : chapter.objective}</p>
          <div className="adventure-guide"><div className="adventure-portrait">{campaign.companion.slice(0, 1)}</div><div><strong>{campaign.companion}</strong><small>{campaign.companionRole}</small></div></div><blockquote>“{panel === "dialogue" && notes.includes(chapter.id) ? chapter.discovery : chapter.briefing}”</blockquote>
          {panel === "dialogue" ? <><button className="adventure-secondary" onClick={() => setNotice(chapter.objective)}>What needs to happen here?</button><button className="adventure-secondary" onClick={() => { setHint(current.encounter.hints[0]); setNotice(current.encounter.hints[0]); }}>Help me understand this apparatus</button><button className="adventure-primary" onClick={() => setPanel("mission")}>Back to the expedition <ArrowRight size={17} /></button></> : <>
            <ol className="adventure-checklist"><li className={relay ? "done" : ""}>{relay ? <Check size={15} /> : <span>1</span>}{campaign.kind === "archive" ? "Illuminate the evidence desk" : "Activate the site relay"}</li><li className={restored ? "done" : ""}>{restored ? <Check size={15} /> : <span>2</span>}{chapter.apparatus}</li><li><span>3</span>{chapterIndex === campaign.chapters.length - 1 ? "Complete the expedition" : "Reach the next location"}</li></ol>
            <p className="adventure-fine">{restored ? "The exit in the world is now open. Reach it to continue." : "Select an object in the world to approach it, then interact. Explore for optional field notes and talk to your companion."}</p>
          </>}
        </div>}

        <div className="adventure-panel adventure-instrument-panel" hidden={panel !== "instrument"}>
          <span className="adventure-kicker">{chapter.apparatus}</span><p className="adventure-instrument-prompt" data-testid="encounter-prompt">{chapter.objective}</p>
          <div data-testid="widget-root"><AdventureInstrument key={current.encounter.id} kind={campaign.kind} current={current} onSubmit={submit} onLive={setLiveValue} /></div>
          {feedback && !restored && <p className="adventure-feedback" role="status">{feedback}</p>}
          <button className="adventure-hint" disabled={hintsUsed >= current.encounter.hints.length} onClick={() => { const nextHint = runner.hint(); if (nextHint) setHint(nextHint); setHintsUsed(runner.hintsUsedOnCurrent); }}><Lightbulb size={15} /> Ask {campaign.companion} for a clue <span>{hintsUsed}/3</span></button>
          {hint && <p className="adventure-hint-text" role="status">{hint}</p>}
        </div>

        {panel === "journal" && <div className="adventure-panel"><span className="adventure-kicker">FIELD JOURNAL</span><h2>Things worth keeping.</h2><p>Recovered notes connect your discoveries to the workings of this world.</p>{notes.length === 0 && <p className="adventure-empty">Look for the glowing field note in each location. They are optional discoveries, and stay here for the entire expedition.</p>}{campaign.chapters.filter(c => notes.includes(c.id)).map(c => <article className="adventure-journal-entry" key={c.id}><h3>{c.name}</h3><p>{c.discovery}</p></article>)}<h3 className="adventure-subheading">Concepts in your expedition</h3>{spec.concepts.map(c => <p className="adventure-concept" key={c.id}>{c.name}</p>)}</div>}
        {panel === "map" && <div className="adventure-panel"><span className="adventure-kicker">EXPEDITION MAP</span><h2>A world to put back together.</h2><ol className="adventure-map">{campaign.chapters.map((c, i) => <li key={c.id} className={i === chapterIndex ? "current" : i < chapterIndex ? "complete" : ""}><span>{i < chapterIndex ? <Check size={15} /> : String(i + 1).padStart(2, "0")}</span><div><strong>{c.name}</strong><small>{i < chapterIndex ? "Restored" : i === chapterIndex ? "You are here" : "Uncharted"}</small></div></li>)}</ol></div>}
        {panel === "finale" && <div className="adventure-panel adventure-intro"><Sparkles className="adventure-finale-icon" size={42} /><span className="adventure-kicker">EXPEDITION COMPLETE</span><h2>{campaign.kind === "archive" ? "The record lives on." : "The world is waking up."}</h2><p>{campaign.finale}</p><div className="adventure-result"><strong>{campaign.chapters.length}</strong><span>locations restored</span><strong>{notes.length}/{campaign.chapters.length}</strong><span>field notes recovered</span></div><button className="adventure-primary" onClick={() => setEnd(true)}>Review your expedition <ArrowRight size={17} /></button></div>}
        <footer className="adventure-progress"><div><span>EXPEDITION PROGRESS</span><strong>{Math.round(progress * 100)}%</strong></div><div className="adventure-progress-track"><span style={{ width: `${progress * 100}%` }} /></div></footer>
      </aside>
    </div>
    <footer className="adventure-footer"><span>DISCOVER • EXPERIMENT • RESTORE</span><span>{spec.genre === "platformer" ? "WASD / arrows · Space jump · E interact" : "WASD / arrows · Click to travel · E interact"}</span><span>Original 2D expeditions</span></footer>
  </main>;
}
