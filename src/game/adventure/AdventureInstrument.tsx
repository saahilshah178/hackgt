"use client";
/* eslint-disable react-hooks/static-components -- widgetFor selects stable, module-level registered components; it never creates a component. */

import { useId, useState, type PointerEvent } from "react";
import type { Current } from "../runner/encounter-runner";
import { widgetFor } from "../widgets/registry";
import type { NumberLineView } from "../widgets/Place";
import type { OscillatorDialView } from "../widgets/Dial";
import type { SortView } from "../widgets/Sort";
import type { PickChestsView, PickWavesView } from "../widgets/Pick";
import type { RapidView } from "../widgets/Type";
import type { LinkEliminationView } from "../widgets/Link";
import type { AdventureKind } from "./campaigns";
import "./instrument.css";

export interface AdventureInstrumentProps {
  kind: AdventureKind;
  current: Current;
  onSubmit(input: unknown): void;
  onLive(value: number): void;
}

const TAU = 2 * Math.PI;
const rounded = (value: number) => Number(value.toFixed(3));
const asRecord = (value: unknown): Record<string, unknown> => value && typeof value === "object" ? value as Record<string, unknown> : {};

/** The apparatus only reads the public presentation. The runner remains the sole grader. */
export function AdventureInstrument({ kind, current, onSubmit, onLive }: AdventureInstrumentProps) {
  const { view, mode } = current;
  const record = asRecord(view);
  let instrument;
  if (kind === "observatory" && mode.id === "number_line" && "landmarks" in record) {
    instrument = <RadianRing view={view as NumberLineView} onSubmit={onSubmit} onLive={onLive} />;
  } else if (mode.id === "oscillator" && "dial" in record) {
    instrument = <WaveInstrument view={view as OscillatorDialView} onSubmit={onSubmit} onLive={onLive} />;
  } else if (kind === "cell" && ((mode.id === "bins" && "bins" in record) || (mode.id === "type_match" && "waves" in record))) {
    instrument = <MembraneRouter view={view as SortView | PickWavesView} onSubmit={onSubmit} onLive={onLive} />;
  } else if (mode.id === "mimic" && "chests" in record) {
    instrument = <ClaimPlates view={view as PickChestsView} kind={kind} onSubmit={onSubmit} onLive={onLive} />;
  } else if (kind === "archive" && mode.id === "elimination" && "clues" in record) {
    instrument = <EvidenceBoard view={view as LinkEliminationView} onSubmit={onSubmit} onLive={onLive} />;
  } else if (kind === "station" && mode.id === "rapid" && "prompts" in record) {
    instrument = <RecallConsole view={view as RapidView} onSubmit={onSubmit} onLive={onLive} />;
  } else {
    const Widget = widgetFor(mode.widget, view);
    instrument = <div className="ai-widget"><Widget view={view} onSubmit={onSubmit} onLive={onLive} /></div>;
  }

  const titles = { observatory: "Celestial calibration bench", cell: "Membrane control chamber", archive: "Evidence reconstruction desk", station: "Research workbench" };
  return <section className={`adventure-instrument ai-${kind}`} aria-label={titles[kind]} data-testid="adventure-instrument">
    <div className="ai-instrument-header"><span className="ai-status-light" aria-hidden="true" /><span>{titles[kind]}</span><span className="ai-serial">{String(current.index + 1).padStart(2, "0")} / {mode.name}</span></div>
    <div className="ai-instrument-body">
      <p className="ai-mission" data-testid="adventure-challenge">{current.encounter.prompt}</p>
      {kind === "archive" && <p className="ai-evidence-label">Historical evidence · classroom source material. The guide’s story is fictional.</p>}
      {kind === "station" && <StationLabel mode={mode.id} record={record} />}
      {instrument}
    </div>
    <div className="ai-instrument-footer"><span>Manual control</span><span>Adjust → observe → commit</span></div>
  </section>;
}

function RadianRing({ view, onSubmit, onLive }: { view: NumberLineView; onSubmit(input: unknown): void; onLive(value: number): void }) {
  const [fraction, setFraction] = useState(0);
  const id = useId();
  const value = view.scale === "log" ? 10 ** (Math.log10(view.min) + fraction * (Math.log10(view.max) - Math.log10(view.min))) : view.min + fraction * (view.max - view.min);
  const update = (next: number) => {
    const f = Math.max(0, Math.min(1, next));
    setFraction(f);
    onLive(view.scale === "log" ? 10 ** (Math.log10(view.min) + f * (Math.log10(view.max) - Math.log10(view.min))) : view.min + f * (view.max - view.min));
  };
  const move = (event: PointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width * 340 - 170;
    const y = 170 - (event.clientY - rect.top) / rect.height * 340;
    const angle = (Math.atan2(y, x) + TAU) % TAU;
    // The ring is a full-turn representation of the presented number-line interval.
    update(angle / TAU);
  };
  return <div className="ai-radian-workbench">
    <div className="ai-ring-housing"><svg viewBox="0 0 340 340" className="ai-ring" role="img" aria-label="Circular scale: zero at the right, increasing counterclockwise. Drag the arm or use the slider." onPointerDown={event => { event.currentTarget.setPointerCapture(event.pointerId); move(event); }} onPointerMove={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) move(event); }}>
      <circle cx="170" cy="170" r="128" className="ai-ring-outer" /><circle cx="170" cy="170" r="112" className="ai-ring-inner" />
      {Array.from({ length: 48 }, (_, i) => { const a = i / 48 * TAU; return <line key={i} x1={170 + 116 * Math.cos(a)} y1={170 - 116 * Math.sin(a)} x2={170 + (i % 4 ? 122 : 128) * Math.cos(a)} y2={170 - (i % 4 ? 122 : 128) * Math.sin(a)} className="ai-ring-tick" />; })}
      {view.landmarks.filter(mark => mark.fraction < 0.999).map(mark => { const a = mark.fraction * TAU; return <text key={mark.fraction} x={170 + 145 * Math.cos(a)} y={170 - 145 * Math.sin(a)} textAnchor="middle" dominantBaseline="middle">{mark.label}</text>; })}
      <line x1="170" y1="170" x2={170 + 106 * Math.cos(fraction * TAU)} y2={170 - 106 * Math.sin(fraction * TAU)} className="ai-ring-arm" />
      <circle cx={170 + 106 * Math.cos(fraction * TAU)} cy={170 - 106 * Math.sin(fraction * TAU)} r="8" className="ai-ring-probe" /><circle cx="170" cy="170" r="10" className="ai-ring-hub" />
      <text x="170" y="218" textAnchor="middle" className="ai-ring-caption">ROTARY POSITION</text>
    </svg></div>
    <div className="ai-controls"><span className="ai-overline">Position the telescope arm</span><h3>Locate {view.target}</h3><p>Turn counterclockwise from the right-hand origin. Compare your arm with the engraved landmarks.</p>
      <label htmlFor={id}>Arm position <output>{rounded(value)}</output></label><input id={id} type="range" min="0" max="1" step="0.001" value={fraction} onChange={event => update(Number(event.target.value))} data-testid="number-line-slider" />
      <div className="ai-scale-labels"><span>{view.landmarks[0]?.label ?? view.min}</span><span>{view.landmarks.at(-1)?.label ?? view.max}</span></div>
      <p className="ai-control-note">The far end and origin share a bearing; the slider distinguishes them.</p>
      <button className="ai-commit" onClick={() => onSubmit({ value })} data-testid="widget-submit">Set telescope bearing</button>
    </div>
  </div>;
}

function WaveInstrument({ view, onSubmit, onLive }: { view: OscillatorDialView; onSubmit(input: unknown): void; onLive(value: number): void }) {
  const [value, setValue] = useState(view.dial.min);
  const [time, setTime] = useState(0);
  const id = useId();
  const timeId = useId();
  const domain = Math.max(TAU, 4 * Math.PI / Math.abs(view.b));
  const valid = view.ask !== "period" || value > 0;
  const candidate = { ...view };
  if (view.ask === "period" && valid) candidate.b = Math.sign(view.b) * TAU / value;
  if (view.ask === "frequency") candidate.b = Math.sign(view.b) * TAU * value;
  if (view.ask === "amplitude") candidate.amplitude = value;
  if (view.ask === "phase") candidate.c = -view.b * value;
  if (view.ask === "midline") candidate.d = value;
  const low = Math.floor(Math.min(view.d - view.amplitude, candidate.d - candidate.amplitude) - 1);
  const high = Math.ceil(Math.max(view.d + view.amplitude, candidate.d + candidate.amplitude) + 1);
  const sx = (t: number) => 50 + t / domain * 480;
  const sy = (y: number) => 220 - (y - low) / (high - low) * 192;
  const signal = (wave: OscillatorDialView, t: number) => wave.amplitude * (wave.wave === "sin" ? Math.sin(wave.b * t + wave.c) : Math.cos(wave.b * t + wave.c)) + wave.d;
  const path = (wave: OscillatorDialView) => Array.from({ length: 1201 }, (_, i) => { const t = i / 1200 * domain; return `${i ? "L" : "M"}${sx(t).toFixed(2)},${sy(signal(wave, t)).toFixed(2)}`; }).join(" ");
  const update = (next: number) => { setValue(next); onLive(next); };
  return <div className="ai-wave-workbench">
    <div className="ai-equation">{view.equation}</div>
    <div className="ai-plot-legend"><span className="ai-source-swatch">Reference signal</span><span className="ai-trial-swatch">Your mechanism</span></div>
    <svg viewBox="0 0 570 270" className="ai-wave-plot" role="img" aria-label={`Wave graph, time from zero to ${rounded(domain)}; displacement from ${low} to ${high}. Solid reference and dashed trial signal.`}>
      {Array.from({ length: 5 }, (_, i) => { const y = low + i / 4 * (high - low); return <g key={`y${i}`}><line x1="50" x2="530" y1={sy(y)} y2={sy(y)} className="ai-graph-grid" /><text x="40" y={sy(y) + 4} textAnchor="end">{rounded(y)}</text></g>; })}
      {Array.from({ length: 5 }, (_, i) => { const t = i / 4 * domain; return <g key={`t${i}`}><line x1={sx(t)} x2={sx(t)} y1="28" y2="220" className="ai-graph-grid" /><text x={sx(t)} y="239" textAnchor="middle">{rounded(t)}</text></g>; })}
      {low <= 0 && high >= 0 && <line x1="50" x2="530" y1={sy(0)} y2={sy(0)} className="ai-graph-axis" />}
      <path d={path(view)} className="ai-source-path" />{valid && <path d={path(candidate)} className="ai-trial-path" />}
      <line x1={sx(time)} x2={sx(time)} y1="28" y2="220" className="ai-time-cursor" /><circle cx={sx(time)} cy={sy(signal(view, time))} r="5" className="ai-reference-point" />{valid && <circle cx={sx(time)} cy={sy(signal(candidate, time))} r="5" className="ai-trial-point" />}
      <text x="12" y="16">y</text><text x="550" y="255" textAnchor="end">t (time units)</text>
    </svg>
    <div className="ai-wave-controls"><div><label htmlFor={id}>Tune {view.askLabel} <output>{rounded(value)} {view.dial.unit}</output></label><input id={id} type="range" min={view.dial.min} max={view.dial.max} step={view.dial.step} value={value} onChange={event => update(Number(event.target.value))} data-testid="dial-slider" /><div className="ai-scale-labels"><span>{view.dial.ticks[0]?.label}</span><span>{view.dial.ticks.at(-1)?.label}</span></div></div>
      <div><label htmlFor={timeId}>Inspect time <output>{rounded(time)}</output></label><input id={timeId} type="range" min="0" max={domain} step={domain / 300} value={time} onChange={event => setTime(Number(event.target.value))} /></div></div>
    <p className="ai-control-note">Change the trial mechanism until its dashed motion follows the reference. The time probe lets you compare both signals at the same instant.{!valid && " A zero period cannot describe an oscillator; increase the dial to begin."}</p>
    <button className="ai-commit" disabled={!valid} onClick={() => onSubmit({ value })} data-testid="widget-submit">Engage synchronization relay</button>
  </div>;
}

function MembraneRouter({ view, onSubmit, onLive }: { view: SortView | PickWavesView; onSubmit(input: unknown): void; onLive(value: number): void }) {
  const waves = "waves" in view;
  const ports = waves ? view.categories : view.bins;
  const packets = waves ? view.waves.map(wave => ({ key: String(wave.waveIndex), text: wave.text })) : view.items;
  const [selected, setSelected] = useState(packets[0]?.key ?? "");
  const [routes, setRoutes] = useState<Record<string, string>>({});
  const route = (port: string) => {
    const next = { ...routes, [selected]: port };
    setRoutes(next);
    onLive(Object.keys(next).length / packets.length);
    setSelected(packets.find(packet => !(packet.key in next))?.key ?? selected);
  };
  const complete = packets.every(packet => routes[packet.key]);
  return <div className="ai-membrane-workbench">
    <p className="ai-control-note">{waves ? "Inspect each specimen’s conditions, then send it to the matching analysis tray. You can revise any route before recording your analysis." : "Select a specimen, then open its matching route. You can re-route any specimen before activating the membrane. Take the time you need."}</p>
    <div className="ai-specimen-rack" role="group" aria-label="Specimens to route">{packets.map((packet, index) => <button key={packet.key} className={`ai-specimen ${selected === packet.key ? "is-selected" : ""}`} aria-pressed={selected === packet.key} onClick={() => setSelected(packet.key)}><span className="ai-particle" aria-hidden="true">{index + 1}</span><span>{packet.text}<small>{routes[packet.key] ? `Routed: ${ports.find(port => port.id === routes[packet.key])?.label}` : "Awaiting route"}</small></span></button>)}</div>
    <div className="ai-membrane" aria-hidden="true"><span>EXTERIOR</span><div className="ai-bilayer">{Array.from({ length: 22 }, (_, i) => <i key={i} />)}</div><span>INTERIOR</span></div>
    <div className="ai-transport-ports" role="group" aria-label={waves ? "Condition analysis trays" : "Transport routes"}>{ports.map((port, index) => <button key={port.id} onClick={() => route(port.id)} className="ai-port" disabled={!selected}><span className={`ai-channel ${waves ? "is-analysis" : /protein|channel|carrier|pump/i.test(port.label) ? "is-protein" : "is-direct"}`} aria-hidden="true">{index + 1}</span><strong>{port.label}</strong><small>{packets.filter(packet => routes[packet.key] === port.id).length} specimens staged</small></button>)}</div>
    <div className="ai-route-status"><output aria-live="polite">{Object.keys(routes).length} / {packets.length} specimens routed</output><button className="ai-commit" disabled={!complete} data-testid="widget-submit" onClick={() => onSubmit(waves ? { answers: view.waves.map(wave => ({ waveIndex: wave.waveIndex, categoryId: routes[String(wave.waveIndex)] })) } : { assignments: view.items.map(item => ({ itemKey: item.key, binId: routes[item.key] })) })}>{waves ? "Record condition analysis" : "Activate transport routes"}</button></div>
  </div>;
}

function ClaimPlates({ view, kind, onSubmit, onLive }: { view: PickChestsView; kind: AdventureKind; onSubmit(input: unknown): void; onLive(value: number): void }) {
  const [selected, setSelected] = useState<number | null>(null);
  return <div className="ai-claim-workbench"><p className="ai-control-note">{kind === "archive" ? "Inspect the candidate accounts. Exactly one claim is false. Mark that misleading account, then flag it for correction." : "Inspect each calibration plate. Exactly one claim is false. Mark the faulty plate, then remove it from the mechanism."}</p>
    <div className="ai-claim-plates">{view.chests.map((claim, i) => <button key={claim.statementIndex} className={`ai-claim-plate ${selected === claim.statementIndex ? "is-selected" : ""}`} aria-pressed={selected === claim.statementIndex} onClick={() => { setSelected(claim.statementIndex); onLive((i + 1) / view.chests.length); }}><span className="ai-document-number">{kind === "archive" ? "ACCOUNT" : "PLATE"} {String(i + 1).padStart(2, "0")}</span><span>{claim.text}</span><small>{selected === claim.statementIndex ? "Marked for verification" : "Inspect and mark"}</small></button>)}</div>
    <button className="ai-commit" data-testid="widget-submit" disabled={selected === null} onClick={() => onSubmit({ statementIndex: selected })}>{kind === "archive" ? "Flag misleading account" : "Remove faulty calibration plate"}</button>
  </div>;
}

function RecallConsole({ view, onSubmit, onLive }: { view: RapidView; onSubmit(input: unknown): void; onLive(value: number): void }) {
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const prompts = view.order.map(index => view.prompts.find(prompt => prompt.itemIndex === index)).filter(prompt => !!prompt);
  return <div className="ai-recall-console"><p className="ai-control-note">Restore the research catalogue. Every terminal can be revised before transmission; there is no countdown.</p>{prompts.map((prompt, i) => <label className="ai-recall-terminal" key={prompt.itemIndex}><span><small>TERMINAL {i + 1} · {view.direction}</small>{prompt.prompt}</span><input aria-label={`Answer for ${prompt.prompt}`} value={answers[prompt.itemIndex] ?? ""} onChange={event => { const next = { ...answers, [prompt.itemIndex]: event.target.value }; setAnswers(next); onLive(Object.values(next).filter(text => text.trim()).length / prompts.length); }} /></label>)}<button className="ai-commit" data-testid="widget-submit" disabled={prompts.some(prompt => !answers[prompt.itemIndex]?.trim())} onClick={() => onSubmit({ answers: prompts.map(prompt => ({ itemIndex: prompt.itemIndex, text: answers[prompt.itemIndex] })) })}>Transmit restored catalogue</button></div>;
}

function EvidenceBoard({ view, onSubmit, onLive }: { view: LinkEliminationView; onSubmit(input: unknown): void; onLive(value: number): void }) {
  const [pinned, setPinned] = useState<number[]>([]);
  const [excluded, setExcluded] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  return <div className="ai-evidence-board"><p className="ai-control-note">Pin the clues you will use. Cross out explanations that conflict with them, then select the account your evidence supports. Pins and exclusions record your reasoning; the finding is graded.</p>
    <h3>{view.question}</h3><div className="ai-evidence-clues" role="group" aria-label="Evidence clues to pin">{view.clues.map(clue => <button key={clue.index} className={`ai-evidence-clue ${pinned.includes(clue.index) ? "is-pinned" : ""}`} aria-pressed={pinned.includes(clue.index)} onClick={() => { const next = pinned.includes(clue.index) ? pinned.filter(index => index !== clue.index) : [...pinned, clue.index]; setPinned(next); onLive(next.length / view.clues.length); }}><span>{pinned.includes(clue.index) ? "PINNED" : "PIN CLUE"} {clue.index + 1}</span>{clue.text}</button>)}</div>
    <div className="ai-hypotheses" role="group" aria-label="Explanations">{view.hypotheses.map(hypothesis => <div key={hypothesis.id} className={excluded.includes(hypothesis.id) ? "is-excluded" : ""}><button className={selected === hypothesis.id ? "is-selected" : ""} aria-pressed={selected === hypothesis.id} disabled={excluded.includes(hypothesis.id)} onClick={() => setSelected(hypothesis.id)}>{hypothesis.text}</button><button className="ai-cross-out" aria-label={`${excluded.includes(hypothesis.id) ? "Restore" : "Cross out"} explanation: ${hypothesis.text}`} onClick={() => { setExcluded(previous => previous.includes(hypothesis.id) ? previous.filter(id => id !== hypothesis.id) : [...previous, hypothesis.id]); if (selected === hypothesis.id) setSelected(null); }}>{excluded.includes(hypothesis.id) ? "Restore" : "Cross out"}</button></div>)}</div>
    <button className="ai-commit" disabled={selected === null} onClick={() => onSubmit({ hypothesisId: selected })} data-testid="widget-submit">File evidence-supported finding</button>
  </div>;
}

function StationLabel({ mode, record }: { mode: string; record: Record<string, unknown> }) {
  const labels: Record<string, [string, string]> = {
    slope: ["Terrain scanner", "Read the landscape’s rate of change and map the safe route."],
    equation: ["Equilibrium engine", "Apply the same operation to both sides to preserve balance."],
    chem_equation: ["Reaction chamber", "Adjust coefficients while keeping each element’s atom count conserved."],
    ledger: ["Resource flow network", "Restore the missing flows through the station."],
    encode: ["Signal encoder", "Use the supplied translation table to reconstruct the transmission."],
    function_machine: ["Black box analyzer", "Compare the input and output readings before choosing a rule or prediction."],
    trace: ["Program diagnostic console", "Follow the instructions in order; track how the variable changes."],
    rapid: ["Research catalogue", "Reconnect each term to its meaning."],
    cloze: ["Archive recovery terminal", "Reconstruct the missing part of the transmission."],
  };
  const [title, description] = labels[mode] ?? ["Experimental module", "Manipulate the controls and record your observation."];
  const [line, setLine] = useState(-1);
  const program = Array.isArray(record.program) ? record.program as string[] : [];
  return <div className="ai-station-module"><span className="ai-overline">{title}</span><p>{description}</p>{mode === "trace" && program.length > 0 && <div className="ai-program-inspector"><ol>{program.map((instruction, i) => <li key={i} className={line === i ? "is-current" : ""}>{instruction}</li>)}</ol><button onClick={() => setLine(previous => previous >= program.length - 1 ? -1 : previous + 1)}>{line >= program.length - 1 ? "Reset instruction probe" : "Step instruction probe"}</button><small>Manual probe highlights execution order. Determine the values yourself.</small></div>}</div>;
}
