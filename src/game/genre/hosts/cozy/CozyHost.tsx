"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { speakerName, type BoardHostHandle, type BoardHostProps } from "../../types";
import { GUIDE_TIP } from "../../teach/lessons";
import { COZY_CSS } from "./cozy.styles";
import {
  FIRST_TRY_BONUS,
  PLAZA,
  SCENE_H,
  SCENE_W,
  TIME_LABELS,
  bloomOf,
  buy,
  buildCozyWorld,
  coinsOf,
  earnedToday,
  endDay,
  eveningDue,
  festivalReady,
  mix,
  paidFor,
  plotOf,
  recordResult,
  settle,
  solvedToday,
  startDay,
  stateOf,
  thanksFor,
  timeOfDay,
  upcomingVisitors,
  warp,
  type BuildingId,
  type CozyState,
  type CozyWorld,
  type Villager,
} from "./cozy.logic";
import {
  BuildingArt,
  Boat,
  Bunting,
  Cloud,
  FestivalLanterns,
  Firework,
  Flower,
  House,
  Lamp,
  SKIES,
  Tree,
  VillagerFace,
  cozyTokens,
  type CozyTokens,
} from "./TownArt";

/*
 * Cozy town: the strategy genre as a gentle life/management sim. No avatar: the town is a 3/4 top-down SVG
 * illustration, the progression verb is RUNNING DAYS. Each morning up to three villagers bring requests (the
 * available encounters, in a seeded order); helping one opens the challenge on the harbour desk, earns coins and
 * lights their house. After three requests (or End day) the evening summary shows what the town learned; coins buy
 * buildings that make the town bloom; the Festival Lanterns open the festival (the boss). Wrong answers cost nothing.
 * All rules live in ./cozy.logic.ts.
 */

type Props = BoardHostProps & { hostRef?: (h: BoardHostHandle | null) => void };

const FOCUSABLE = "button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex='-1'])";

export function CozyHost(props: Props) {
  const { spec, palette, progression, solved, available, activeId, lastResult, finished, hostRef } = props;
  const world = useMemo(() => buildCozyWorld(spec, progression), [spec, progression]);
  const t = useMemo(() => cozyTokens(palette), [palette]);
  const debrief = useMemo(() => new Map(spec.encounters.map((e) => [e.id, e.debriefLine])), [spec]);
  const [st, setSt] = useState<CozyState>(() => startDay(world, null, solved, available));
  const [overlay, setOverlay] = useState<"none" | "build" | "journal">("none");
  const [desk, setDesk] = useState<{ prev: string | null; celebrate: number | null }>({ prev: null, celebrate: null });

  // absorb prop changes during render (React's "adjust state when a prop changes" pattern): a new graded result
  // (bonus + the villager's reply) and board refills when newly unlocked villagers arrive
  let cur = st;
  if (lastResult && lastResult.seq !== cur.seenSeq) cur = recordResult(world, cur, lastResult, props.attemptsOn(lastResult.encounterId));
  cur = settle(world, cur, solved, available);
  if (cur !== st) setSt(cur);
  if (desk.prev !== activeId) {
    const r = cur.reaction;
    setDesk({ prev: activeId, celebrate: activeId === null && r?.correct && r.encounterId === desk.prev ? r.seq : null });
  }

  const coins = coinsOf(world, cur, solved);
  const bloom = bloomOf(world, cur, solved);
  const showFinale = finished && !activeId;
  const evening = eveningDue(cur, solved, finished) && !activeId;
  const time = showFinale ? 4 : timeOfDay(cur, solved, finished);
  const today = solvedToday(cur, solved);
  const upcoming = cur.built.includes("lighthouse") ? upcomingVisitors(progression, solved, available) : [];
  const activeVillager = activeId ? world.villagers.get(activeId) : undefined;

  // debug warp (skipTo / autoSolve) puts the target's card on the board
  const solvedRef = useRef(solved);
  useEffect(() => {
    solvedRef.current = solved;
  });
  useEffect(() => {
    if (!hostRef) return;
    hostRef({ warpTo: (id) => setSt((s) => warp(s, id, solvedRef.current)) });
    return () => hostRef(null);
  }, [hostRef]);

  // focus: into the desk when a request opens, back to the board when it closes
  const deskRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<HTMLOListElement>(null);
  const prevActive = useRef<string | null>(null);
  useEffect(() => {
    const d = deskRef.current;
    if (activeId && d && !d.contains(document.activeElement)) {
      (d.querySelector<HTMLElement>(`[data-testid="widget-root"] :is(${FOCUSABLE})`) ?? d.querySelector<HTMLElement>(FOCUSABLE))?.focus();
    }
    if (!activeId && prevActive.current && !evening && !showFinale) {
      boardRef.current?.querySelector<HTMLElement>("button[data-help]:not([disabled])")?.focus();
    }
    prevActive.current = activeId;
  }, [activeId, evening, showFinale]);

  const help = (id: string) => {
    if (!available.includes(id)) return;
    if (id === world.bossId && !festivalReady(cur)) {
      const bought = buy(world, cur, "lanterns", solved);
      if (!bought) return;
      setSt(bought);
    }
    setOverlay("none");
    props.open(id);
  };
  const onBuy = (id: BuildingId) => {
    const next = buy(world, cur, id, solved);
    if (next) setSt(next);
  };

  const r = cur.reaction;
  const rv = r ? world.villagers.get(r.encounterId) : undefined;
  const announce = r && rv ? `${rv.name} says: ${r.line}${r.correct ? ` You earned ${r.coins} coins.` : ""}` : "";
  return (
    <div className="cz-root relative flex flex-col gap-3" data-testid="cozy-host" data-day={cur.day} data-coins={coins} data-bloom={bloom.level} style={{ color: t.ink }}>
      <style>{COZY_CSS}</style>
      <p className="sr-only" aria-live="polite">
        {announce}
      </p>

      <TopBar
        t={t}
        day={cur.day}
        time={time}
        coins={coins}
        coinFloat={r?.correct && r.coins > 0 ? { key: r.seq, amount: r.coins } : null}
        bloomLevel={bloom.level}
        bloomLabel={bloom.label}
        overlay={overlay}
        setOverlay={setOverlay}
        canEndDay={!evening && !activeId && !finished && cur.phase === "day"}
        onEndDay={() => setSt(endDay(cur))}
      />

      <div className="flex flex-col gap-3 xl:flex-row">
        {/* the town, with the desk / journal / evening overlays laid over it (no layout shift) */}
        <div className="relative min-h-[600px] min-w-0 flex-1">
          <div className="absolute inset-0 overflow-hidden rounded-3xl" style={{ boxShadow: `0 0 0 4px ${mix(t.grassDeep, "#000", 0.35)}` }}>
            <TownScene t={t} world={world} st={cur} solved={solved} available={available} time={time} bloom={bloom.level} celebrate={desk.celebrate !== null ? { id: r?.encounterId ?? "", key: desk.celebrate } : null} />
            {activeId && <div className="absolute inset-0" style={{ background: "rgba(20, 24, 16, 0.38)" }} />}
          </div>

          {activeId && props.challenge && (
            <div
              ref={deskRef}
              className="cz-rise absolute inset-x-3 top-3 z-20 flex flex-col gap-3 rounded-2xl p-3 shadow-2xl"
              style={{ background: t.desk, border: `3px solid ${mix(t.wood, "#000", 0.25)}`, color: palette.css.text }}
              data-testid="cozy-desk"
            >
              {activeVillager && (
                <div className="flex flex-wrap items-center gap-3 rounded-xl px-3 py-2" style={{ background: t.card, color: t.ink }}>
                  <VillagerFace look={activeVillager.look} size={48} festival={activeVillager.isFestival} />
                  <p className="text-[21px] font-bold leading-tight">
                    {activeVillager.isFestival ? "The festival" : `${activeVillager.name}'s request`}
                    <span className="ml-2 text-[18px] font-normal" style={{ color: t.inkSoft }}>
                      {activeVillager.household}
                    </span>
                  </p>
                  <p className="ml-auto rounded-full px-3 py-1 text-[18px] font-semibold" style={{ background: mix(t.lamp, "#fff", 0.45) }}>
                    Reward {activeVillager.reward} coins
                    {props.attemptsOn(activeVillager.encounterId) === 0 && <span className="font-normal"> (+{FIRST_TRY_BONUS} first try)</span>}
                  </p>
                </div>
              )}
              {props.challenge}
            </div>
          )}

          {overlay === "journal" && !activeId && (
            <Journal world={world} st={cur} solved={solved} available={available} upcoming={upcoming} t={t} onClose={() => setOverlay("none")} spec={spec} />
          )}

          {evening && !showFinale && overlay !== "journal" && (
            <EveningCard
              world={world}
              st={cur}
              today={today}
              earned={earnedToday(world, cur, solved)}
              coins={coins}
              upcoming={upcoming}
              t={t}
              debrief={debrief}
              onNext={() => setSt(startDay(world, cur, solved, available))}
            />
          )}
        </div>

        {/* the requests board: a fixed column, three fixed-height slots */}
        <aside className="relative w-full shrink-0 xl:w-[420px] 2xl:w-[460px]" aria-label="Today's requests">
          <div className="flex h-full flex-col gap-3 rounded-3xl p-3" style={{ background: mix(t.card, t.grass, 0.18), boxShadow: `0 0 0 4px ${mix(t.grassDeep, "#000", 0.35)}` }}>
            <header className="flex min-h-[116px] flex-col gap-1 px-1">
              <h2 className="text-[24px] font-extrabold leading-tight">
                Today&apos;s requests <span className="text-[18px] font-semibold" style={{ color: t.inkSoft }}>Day {cur.day}</span>
              </h2>
              <Greeting world={world} st={cur} spec={spec} evening={evening} today={today.length} time={time} t={t} />
              {cur.day === 1 && solved.size === 0 && (
                <p className="text-[18px] font-bold leading-snug" data-testid="field-guide-tip">
                  {GUIDE_TIP}
                </p>
              )}
            </header>
            <ol
              ref={boardRef}
              className="flex flex-col gap-3"
              onKeyDown={(e: KeyboardEvent<HTMLOListElement>) => {
                if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
                const btns = [...e.currentTarget.querySelectorAll<HTMLButtonElement>("button[data-help]:not([disabled])")];
                const i = btns.indexOf(document.activeElement as HTMLButtonElement);
                if (i === -1 || btns.length === 0) return;
                e.preventDefault();
                btns[(i + (e.key === "ArrowDown" ? 1 : btns.length - 1)) % btns.length].focus();
              }}
            >
              {cur.slots.map((id, i) => (
                <li key={i}>
                  {id ? (
                    <RequestCard
                      v={world.villagers.get(id)!}
                      state={stateOf(id, solved, available)}
                      active={activeId === id}
                      reaction={r && r.encounterId === id ? r : null}
                      thanks={thanksFor(world, id)}
                      paid={paidFor(world, cur, id)}
                      lanternsNeeded={id === world.bossId && !festivalReady(cur) ? world.buildings.find((b) => b.id === "lanterns")!.price : null}
                      coins={coins}
                      t={t}
                      onHelp={() => help(id)}
                    />
                  ) : (
                    <EmptySlot t={t} dayOver={evening} />
                  )}
                </li>
              ))}
            </ol>
          </div>
          {overlay === "build" && <BuildMenu world={world} st={cur} coins={coins} t={t} onBuy={onBuy} onClose={() => setOverlay("none")} />}
        </aside>
      </div>

      {showFinale && <Finale world={world} st={cur} solved={solved} coins={coins} t={t} spec={spec} onDone={props.complete} bloom={bloom.level} />}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// top bar

function TopBar(props: {
  t: CozyTokens;
  day: number;
  time: number;
  coins: number;
  coinFloat: { key: number; amount: number } | null;
  bloomLevel: number;
  bloomLabel: string;
  overlay: "none" | "build" | "journal";
  setOverlay(o: "none" | "build" | "journal"): void;
  canEndDay: boolean;
  onEndDay(): void;
}) {
  const { t } = props;
  const pill = "flex items-center gap-2 rounded-2xl px-4 py-2";
  const btn = "cz-btn rounded-2xl px-4 py-2 text-[19px] font-bold disabled:cursor-not-allowed disabled:opacity-50";
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-3xl px-3 py-2" style={{ background: t.card, boxShadow: `0 0 0 4px ${mix(t.grassDeep, "#000", 0.35)}` }}>
      <div className={pill} style={{ background: mix(SKIES[Math.min(props.time, 4)][1], "#fff", 0.2) }}>
        <SunArc time={props.time} />
        <div className="flex flex-col leading-tight">
          <span className="text-[24px] font-extrabold" data-testid="cozy-day">
            Day {props.day}
          </span>
          <span className="text-[17px] font-semibold" style={{ color: t.inkSoft }}>
            {props.time >= 4 ? "Festival night" : TIME_LABELS[props.time]}
          </span>
        </div>
      </div>
      <div className={`${pill} relative`} style={{ background: mix(t.lamp, "#fff", 0.55) }} aria-label={`${props.coins} coins`}>
        <CoinIcon />
        <span className="text-[26px] font-extrabold tabular-nums" data-testid="cozy-coin-count">
          {props.coins}
        </span>
        <span className="text-[18px] font-semibold">coins</span>
        {props.coinFloat && (
          <span key={props.coinFloat.key} className="cz-anim cz-float pointer-events-none absolute -top-2 right-2 text-[22px] font-extrabold" style={{ color: "#8a5a00" }} aria-hidden="true">
            +{props.coinFloat.amount}
          </span>
        )}
      </div>
      <div className={pill} style={{ background: mix(t.grass, "#fff", 0.45) }} aria-label={`Town bloom: ${props.bloomLabel}, level ${props.bloomLevel} of 5`}>
        <span className="flex gap-1" aria-hidden="true">
          {[1, 2, 3, 4, 5].map((i) => (
            <BloomFlower key={i} on={i <= props.bloomLevel} />
          ))}
        </span>
        <span className="flex flex-col leading-tight">
          <span className="text-[15px] font-semibold uppercase tracking-wider" style={{ color: t.inkSoft }}>
            Town bloom
          </span>
          <span className="text-[20px] font-extrabold" data-testid="cozy-bloom">
            {props.bloomLabel}
          </span>
        </span>
      </div>
      <div className="ml-auto flex flex-wrap gap-2">
        <button
          type="button"
          className={btn}
          style={{ background: props.overlay === "journal" ? t.accentInk : mix(t.grass, "#fff", 0.3), color: props.overlay === "journal" ? "#fff" : t.ink }}
          aria-expanded={props.overlay === "journal"}
          data-testid="journal-toggle"
          onClick={() => props.setOverlay(props.overlay === "journal" ? "none" : "journal")}
        >
          Journal
        </button>
        <button
          type="button"
          className={btn}
          style={{ background: props.overlay === "build" ? t.accentInk : mix(t.grass, "#fff", 0.3), color: props.overlay === "build" ? "#fff" : t.ink }}
          aria-expanded={props.overlay === "build"}
          data-testid="build-toggle"
          onClick={() => props.setOverlay(props.overlay === "build" ? "none" : "build")}
        >
          Build
        </button>
        <button type="button" className={btn} style={{ background: "#5b4a7a", color: "#fff" }} disabled={!props.canEndDay} data-testid="end-day" onClick={props.onEndDay}>
          End day
        </button>
      </div>
    </div>
  );
}

function SunArc({ time }: { time: number }) {
  const night = time >= 3;
  const tt = Math.min(time, 3) / 3;
  const a = Math.PI * (1 - (0.12 + tt * 0.76));
  const x = 36 + Math.cos(a) * 28;
  const y = 36 - Math.sin(a) * 26;
  return (
    <svg width="72" height="44" viewBox="0 0 72 44" aria-hidden="true">
      <path d="M6 38 A30 28 0 0 1 66 38" fill="none" stroke="#2b2920" strokeOpacity="0.35" strokeWidth="2" strokeDasharray="3 4" />
      <path d="M2 38 H70" stroke="#2b2920" strokeOpacity="0.45" strokeWidth="2" />
      {night ? (
        <g transform={`translate(${time >= 4 ? 36 : x} ${time >= 4 ? 12 : y})`}>
          <circle r="8" fill="#fff3c4" stroke="#6b5a2b" strokeWidth="1.5" />
          <circle cx="4" cy="-3" r="7" fill={time >= 4 ? "#3b3466" : "#f2a27f"} />
        </g>
      ) : (
        <g transform={`translate(${x} ${y})`}>
          <circle r="11" fill="#ffd36b" opacity="0.35" />
          <circle r="7.5" fill="#ffc53d" stroke="#b07a00" strokeWidth="1.5" />
        </g>
      )}
    </svg>
  );
}

function CoinIcon() {
  return (
    <svg width="30" height="30" viewBox="-15 -15 30 30" aria-hidden="true">
      <circle r="13" fill="#ffc53d" stroke="#8a5a00" strokeWidth="2" />
      <circle r="8.5" fill="none" stroke="#b07a00" strokeWidth="1.6" />
      <path d="M-2 -5 Q 3 -7 4 -3 M-3 5 Q 3 7 4 3" stroke="#8a5a00" strokeWidth="1.8" fill="none" strokeLinecap="round" />
    </svg>
  );
}

function BloomFlower({ on }: { on: boolean }) {
  return (
    <svg width="22" height="22" viewBox="-11 -11 22 22">
      {[0, 72, 144, 216, 288].map((r) => (
        <circle
          key={r}
          cx={Math.cos((r * Math.PI) / 180) * 5}
          cy={Math.sin((r * Math.PI) / 180) * 5}
          r="4.4"
          fill={on ? "#f28ba8" : "none"}
          stroke={on ? "#9a3552" : "#6d6a5c"}
          strokeWidth="1.3"
        />
      ))}
      <circle r="3" fill={on ? "#ffd36b" : "#d8d3c2"} stroke="#6d6a5c" strokeWidth="1" />
    </svg>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// board

function Greeting({ world, st, spec, evening, today, time, t }: { world: CozyWorld; st: CozyState; spec: Props["spec"]; evening: boolean; today: number; time: number; t: CozyTokens }) {
  const host = spec.characters[0];
  const name = host ? host.name : "The mayor";
  const open = st.slots.filter((id) => id !== null).length - today;
  let line: string;
  let who = name;
  if (st.day === 1 && today === 0 && spec.narrative.intro[0]) {
    line = spec.narrative.intro[0].text;
    who = speakerName(spec, spec.narrative.intro[0].speakerId);
  } else if (evening) line = "That's everyone for today. The lamps are coming on.";
  else if (world.bossId && st.slots.includes(world.bossId)) {
    who = world.festivalHost;
    line = "The square is ready. Shall we start the festival?";
  } else if (open <= 0) line = "A quiet moment. Someone new may knock soon.";
  else line = `${["Good morning", "Lovely day", "Good afternoon"][Math.min(time, 2)]}! ${open === 1 ? "One neighbour is" : `${open} neighbours are`} hoping for your help.`;
  return (
    <p className="line-clamp-2 text-[18px] leading-snug" style={{ color: t.inkSoft }} data-testid="cozy-greeting">
      <strong style={{ color: t.ink }}>{who}:</strong> &ldquo;{line}&rdquo;
    </p>
  );
}

function RequestCard(props: {
  v: Villager;
  state: "locked" | "available" | "solved";
  active: boolean;
  reaction: CozyState["reaction"];
  thanks: string;
  paid: number;
  lanternsNeeded: number | null;
  coins: number;
  t: CozyTokens;
  onHelp(): void;
}) {
  const { v, state, active, reaction, t } = props;
  const done = state === "solved";
  const kind = reaction && !reaction.correct && !done ? reaction : null;
  const festival = v.isFestival;
  const bg = done ? mix(t.card, t.grass, 0.35) : festival ? mix(t.lamp, "#fff", 0.55) : t.card;
  const border = active ? t.accentInk : festival ? "#c98b2b" : mix(t.card, "#8a7a5a", 0.35);
  const lanternsShort = props.lanternsNeeded !== null && props.coins < props.lanternsNeeded;
  return (
    <article
      className="relative flex h-[188px] gap-3 overflow-hidden rounded-2xl p-3"
      style={{ background: bg, border: `3px solid ${border}`, boxShadow: active ? `0 0 0 3px ${mix(t.accent, "#fff", 0.3)}` : "0 3px 0 rgba(0,0,0,0.12)" }}
      data-encounter={v.encounterId}
      data-state={state}
      data-testid={`request-${v.encounterId}`}
    >
      <div className={`shrink-0 ${kind ? "cz-anim cz-wobble" : ""}`} key={kind ? kind.seq : "face"}>
        <VillagerFace look={v.look} size={64} mood={done ? "happy" : kind ? "kind" : "calm"} festival={festival} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <p className="truncate text-[18px] leading-tight">
          <strong className="text-[20px]">{v.name}</strong>
          <span style={{ color: t.inkSoft }}> · {festival ? "the festival" : v.household.replace(/^the /, "")}</span>
        </p>
        {done ? (
          <>
            <p className="mt-1 line-clamp-2 text-[19px] font-semibold italic leading-snug">&ldquo;{props.thanks}&rdquo;</p>
            <p className="mt-auto flex items-center gap-2 text-[18px] font-bold" style={{ color: t.accentInk }}>
              <CheckIcon /> Helped · +{props.paid} coins
            </p>
          </>
        ) : (
          <>
            <p className="mt-1 line-clamp-2 text-[19px] font-bold leading-snug">{v.ask}</p>
            {kind ? (
              <p className="line-clamp-1 text-[18px] italic leading-snug" style={{ color: "#7a3a2a" }}>
                &ldquo;{kind.line}&rdquo;
              </p>
            ) : (
              <p className="line-clamp-1 text-[18px] leading-snug" style={{ color: t.inkSoft }} title={v.snippet}>
                {props.lanternsNeeded !== null ? `Needs the Festival Lanterns (${props.lanternsNeeded} coins).` : v.snippet}
              </p>
            )}
            <div className="mt-auto flex items-center gap-2">
              <button
                type="button"
                data-help
                data-testid={`node-${v.encounterId}`}
                disabled={state !== "available" || lanternsShort}
                onClick={props.onHelp}
                aria-label={`${festival ? "Start the festival" : `Help ${v.name}`}: ${v.ask}`}
                className="cz-btn rounded-xl px-4 py-1 text-[19px] font-extrabold disabled:cursor-not-allowed disabled:opacity-60"
                style={{ background: festival ? "#c9602f" : t.accentInk, color: "#fff" }}
              >
                {active ? "At your desk" : festival ? (props.lanternsNeeded !== null ? `Build lanterns & begin` : "Begin the festival") : `Help ${v.name}`}
              </button>
              <span className="ml-auto flex items-center gap-1 rounded-full px-2 py-0.5 text-[18px] font-bold" style={{ background: mix(t.lamp, "#fff", 0.5) }}>
                <SmallCoin /> {v.reward}
              </span>
            </div>
          </>
        )}
      </div>
    </article>
  );
}

function EmptySlot({ t, dayOver }: { t: CozyTokens; dayOver: boolean }) {
  return (
    <div className="flex h-[188px] items-center justify-center rounded-2xl p-4 text-center text-[18px]" style={{ border: `3px dashed ${mix(t.card, "#8a7a5a", 0.45)}`, color: t.inkSoft }}>
      {dayOver ? "Everyone is home for the evening." : "No one else at the door just now."}
    </div>
  );
}

function CheckIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
      <circle cx="11" cy="11" r="10" fill="currentColor" />
      <path d="M6 11.5 L9.5 15 L16 8" stroke="#fff" strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SmallCoin() {
  return (
    <svg width="20" height="20" viewBox="-10 -10 20 20" aria-hidden="true">
      <circle r="8.5" fill="#ffc53d" stroke="#8a5a00" strokeWidth="1.6" />
      <circle r="5" fill="none" stroke="#b07a00" strokeWidth="1.2" />
    </svg>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// overlays

function BuildMenu({ world, st, coins, t, onBuy, onClose }: { world: CozyWorld; st: CozyState; coins: number; t: CozyTokens; onBuy(id: BuildingId): void; onClose(): void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
  }, []);
  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="Build menu"
      data-testid="build-menu"
      className="cz-rise absolute inset-0 z-20 flex flex-col gap-2 overflow-auto rounded-3xl p-3"
      style={{ background: t.card, boxShadow: `0 0 0 4px ${t.accentInk}` }}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          onClose();
        }
      }}
    >
      <div className="flex items-center justify-between px-1">
        <h2 className="text-[24px] font-extrabold">Build</h2>
        <button type="button" className="cz-btn rounded-xl px-3 py-1 text-[18px] font-bold" style={{ background: mix(t.grass, "#fff", 0.3) }} onClick={onClose}>
          Close
        </button>
      </div>
      <p className="px-1 text-[18px]" style={{ color: t.inkSoft }}>
        You have <strong style={{ color: t.ink }}>{coins} coins</strong>. Every building makes the town bloom.
      </p>
      <ul className="flex flex-col gap-2">
        {world.buildings.map((b) => {
          const built = st.built.includes(b.id);
          const short = b.price - coins;
          return (
            <li key={b.id} className="flex items-center gap-3 rounded-2xl p-2" style={{ background: built ? mix(t.card, t.grass, 0.35) : mix(t.card, "#e9dcc0", 0.35) }}>
              <svg width="60" height="60" viewBox="-52 -114 104 118" aria-hidden="true" className="shrink-0">
                <ellipse cx="0" cy="0" rx="46" ry="8" fill={t.grass} />
                <BuildingArt id={b.id === "lanterns" ? "cottage" : b.id} lit={built} />
                {b.id === "lanterns" && <rect x="-52" y="-114" width="104" height="118" fill={t.card} />}
                {b.id === "lanterns" && (
                  <g transform="translate(0 -20) scale(1.6)">
                    <path d="M-26 -30 Q 0 -10 26 -30" fill="none" stroke="#6b4a2b" strokeWidth="1.4" />
                    {[-18, -6, 6, 18].map((x, i) => (
                      <ellipse key={x} cx={x} cy={-18 + (i === 1 || i === 2 ? 5 : 0)} rx="4.5" ry="6" fill={["#f28b5b", "#ffd36b", "#f27a93", "#b7a0f0"][i]} stroke="#6b3a1f" />
                    ))}
                  </g>
                )}
              </svg>
              <div className="min-w-0 flex-1">
                <p className="text-[20px] font-extrabold leading-tight">{b.name}</p>
                <p className="text-[17px] leading-snug" style={{ color: t.inkSoft }}>
                  {b.perk}
                </p>
              </div>
              {built ? (
                <span className="flex items-center gap-1 text-[18px] font-bold" style={{ color: t.accentInk }}>
                  <CheckIcon /> Built
                </span>
              ) : (
                <button
                  type="button"
                  data-testid={`build-${b.id}`}
                  disabled={short > 0}
                  onClick={() => onBuy(b.id)}
                  className="cz-btn shrink-0 rounded-xl px-3 py-1.5 text-[18px] font-extrabold disabled:cursor-not-allowed disabled:opacity-60"
                  style={{ background: t.accentInk, color: "#fff" }}
                  aria-label={`Build ${b.name} for ${b.price} coins`}
                >
                  {b.price === 0 ? "Free" : `${b.price}`} <span className="font-semibold">{b.price === 0 ? "" : "coins"}</span>
                  {short > 0 && <span className="block text-[15px] font-semibold">need {short} more</span>}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Journal(props: {
  world: CozyWorld;
  st: CozyState;
  solved: ReadonlySet<string>;
  available: readonly string[];
  upcoming: string[];
  t: CozyTokens;
  spec: Props["spec"];
  onClose(): void;
}) {
  const { world, st, solved, available, upcoming, t, spec } = props;
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
  }, []);
  const library = st.built.includes("library");
  const stall = st.built.includes("stall");
  const byId = new Map(spec.encounters.map((e) => [e.id, e]));
  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="Town journal"
      data-testid="journal"
      className="cz-rise absolute inset-3 z-20 flex flex-col gap-3 overflow-auto rounded-2xl p-5"
      style={{
        background: t.card,
        boxShadow: `inset 6px 0 0 ${mix(t.card, "#e07a5f", 0.35)}`,
        border: `3px solid ${mix(t.wood, "#000", 0.1)}`,
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          props.onClose();
        }
      }}
    >
      <div className="flex items-center justify-between">
        <h2 className="text-[26px] font-extrabold">{world.townName} journal</h2>
        <button type="button" className="cz-btn rounded-xl px-3 py-1 text-[18px] font-bold" style={{ background: mix(t.grass, "#fff", 0.3) }} onClick={props.onClose}>
          Close
        </button>
      </div>
      <p className="text-[18px]" style={{ color: t.inkSoft }}>
        {solved.size} of {world.order.length} requests answered.
      </p>
      {stall && (
        <p className="text-[18px]" data-testid="journal-households">
          <strong>Market Stall tally:</strong>{" "}
          {world.households
            .map((h) => `${h.name.replace(/^the /, "")} ${h.members.filter((id) => solved.has(id)).reduce((s, id) => s + (world.villagers.get(id)?.reward ?? 0) + (st.bonuses[id] ?? 0), 0)} coins`)
            .join(" · ")}
        </p>
      )}
      <ol className="flex flex-col gap-2">
        {world.order.map((id) => {
          const v = world.villagers.get(id)!;
          const s = stateOf(id, solved, available);
          const e = byId.get(id);
          if (s === "solved")
            return (
              <li key={id} className="flex gap-3" data-state="solved">
                <VillagerFace look={v.look} size={44} mood="happy" festival={v.isFestival} />
                <div>
                  <p className="text-[18px]">
                    <strong>{v.name}</strong> <span style={{ color: t.inkSoft }}>· {v.household}</span>
                  </p>
                  <p className="text-[18px] leading-snug">{e?.debriefLine}</p>
                  {library && e?.sourceRef && (
                    <p className="text-[17px] italic leading-snug" style={{ color: t.inkSoft }}>
                      From the library, page {e.sourceRef.page}: &ldquo;{e.sourceRef.quote}&rdquo;
                    </p>
                  )}
                </div>
              </li>
            );
          if (s === "available")
            return (
              <li key={id} className="flex items-center gap-3" data-state="available">
                <VillagerFace look={v.look} size={44} festival={v.isFestival} />
                <p className="text-[18px]">
                  <strong>{v.name}</strong> is waiting at the door: {v.ask}
                </p>
              </li>
            );
          return (
            <li key={id} className="flex items-center gap-3 text-[18px]" data-state="locked" style={{ color: t.inkSoft }}>
              <span className="flex h-[44px] w-[44px] items-center justify-center rounded-full text-[22px] font-bold" style={{ border: `2px dashed ${t.inkSoft}` }} aria-hidden="true">
                ?
              </span>
              {upcoming.includes(id) ? `The lighthouse spots ${v.name} of ${v.household} on the horizon.` : v.isFestival ? "The festival waits for the whole town." : "Someone new may visit soon."}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function EveningCard(props: {
  world: CozyWorld;
  st: CozyState;
  today: string[];
  earned: number;
  coins: number;
  upcoming: string[];
  t: CozyTokens;
  debrief: ReadonlyMap<string, string>;
  onNext(): void;
}) {
  const { world, st, today, t } = props;
  const focusLater = useDelayedFocus<HTMLButtonElement>();
  const affordable = world.buildings.filter((b) => !st.built.includes(b.id) && b.price <= props.coins);
  return (
    <div className="absolute inset-0 z-10 flex items-start justify-center p-6" style={{ background: "rgba(30, 22, 50, 0.35)" }}>
      <section
        role="dialog"
        aria-label={`Evening of day ${st.day}`}
        data-testid="evening-summary"
        className="cz-rise flex max-h-full w-full max-w-[680px] flex-col gap-3 overflow-auto rounded-3xl p-6"
        style={{ background: t.card, boxShadow: "0 18px 50px rgba(0,0,0,0.35)", border: `3px solid ${mix("#6c5a96", "#000", 0.1)}` }}
      >
        <p className="text-[16px] font-bold uppercase tracking-widest" style={{ color: "#6c5a96" }}>
          Evening falls on {world.townName}
        </p>
        <h2 className="text-[30px] font-extrabold leading-tight">End of day {st.day}</h2>
        <p className="text-[20px]">
          {today.length === 0 ? "A quiet day. Tomorrow is another." : `You helped ${today.length} ${today.length === 1 ? "neighbour" : "neighbours"} and earned `}
          {today.length > 0 && <strong>{props.earned} coins</strong>}
          {today.length > 0 && "."}
        </p>
        {today.length > 0 && (
          <div>
            <h3 className="text-[20px] font-bold">What the town learned today</h3>
            <ul className="mt-1 flex flex-col gap-2">
              {today.map((id) => (
                <DebriefItem key={id} world={world} id={id} line={props.debrief.get(id) ?? ""} t={t} />
              ))}
            </ul>
          </div>
        )}
        {props.upcoming.length > 0 && (
          <p className="text-[18px]" style={{ color: t.inkSoft }}>
            The lighthouse spots tomorrow&apos;s visitors: {props.upcoming.map((id) => world.villagers.get(id)?.name).join(", ")}.
          </p>
        )}
        {st.built.includes("bakery") && (
          <p className="text-[18px]" style={{ color: t.inkSoft }}>
            The bakery is already warming its ovens for the morning.
          </p>
        )}
        {affordable.length > 0 && (
          <p className="text-[18px]" style={{ color: t.inkSoft }}>
            With {props.coins} coins you could build: {affordable.map((b) => b.name).join(", ")}.
          </p>
        )}
        <button type="button" ref={focusLater} data-testid="next-day" onClick={props.onNext} className="cz-btn self-start rounded-2xl px-6 py-3 text-[21px] font-extrabold" style={{ background: "#5b4a7a", color: "#fff" }}>
          Sleep until morning
        </button>
      </section>
    </div>
  );
}

function DebriefItem({ world, id, line, t }: { world: CozyWorld; id: string; line: string; t: CozyTokens }) {
  const v = world.villagers.get(id);
  if (!v) return null;
  return (
    <li className="flex items-start gap-3">
      <VillagerFace look={v.look} size={40} mood="happy" festival={v.isFestival} />
      <p className="text-[18px] leading-snug">
        <strong>{v.name}:</strong> <span style={{ color: t.ink }}>{line}</span>
      </p>
    </li>
  );
}

function Finale({ world, st, solved, coins, t, spec, onDone, bloom }: { world: CozyWorld; st: CozyState; solved: ReadonlySet<string>; coins: number; t: CozyTokens; spec: Props["spec"]; onDone(): void; bloom: number }) {
  const helped = world.order.filter((id) => id !== world.bossId && solved.has(id)).length;
  const focusLater = useDelayedFocus<HTMLButtonElement>();
  const lanternsState: CozyState = st.built.includes("lanterns") ? st : { ...st, built: [...st.built, "lanterns"] };
  return (
    <div className="absolute -inset-1 z-30 overflow-hidden rounded-3xl" data-testid="cozy-finale" role="dialog" aria-label={`Festival night in ${world.townName}`}>
      <TownScene t={t} world={world} st={lanternsState} solved={solved} available={[]} time={4} bloom={Math.max(bloom, 4)} celebrate={null} fireworks />
      <div className="absolute inset-0 flex items-center justify-start p-6 xl:pl-10">
        <section className="cz-rise flex max-h-full w-full max-w-[640px] flex-col gap-3 overflow-auto rounded-3xl p-6" style={{ background: "rgba(20, 18, 44, 0.94)", color: "#fff6e3", border: "3px solid #ffd36b", boxShadow: "0 0 60px rgba(255, 211, 107, 0.25)" }}>
          <p className="text-[16px] font-bold uppercase tracking-widest" style={{ color: "#ffd36b" }}>
            Festival night
          </p>
          <h2 className="text-[34px] font-extrabold leading-tight">{world.townName} is glowing</h2>
          {spec.narrative.outro.map((l, i) => (
            <p key={i} className="text-[20px] italic leading-snug">
              <strong className="not-italic" style={{ color: "#ffd36b" }}>
                {speakerName(spec, l.speakerId)}:
              </strong>{" "}
              &ldquo;{l.text}&rdquo;
            </p>
          ))}
          <h3 className="mt-2 text-[20px] font-bold">Your town</h3>
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              ["Days", String(st.day)],
              ["Coins", String(coins)],
              ["Buildings", String(st.built.length)],
              ["Neighbours helped", String(helped)],
            ].map(([k, v]) => (
              <div key={k} className="rounded-2xl p-3 text-center" style={{ background: "rgba(255, 246, 227, 0.12)" }}>
                <dt className="text-[16px] font-semibold" style={{ color: "#e9dcc0" }}>
                  {k}
                </dt>
                <dd className="text-[30px] font-extrabold">{v}</dd>
              </div>
            ))}
          </dl>
          <button type="button" ref={focusLater} data-testid="host-finale-continue" onClick={onDone} className="cz-btn mt-2 self-start rounded-2xl px-6 py-3 text-[21px] font-extrabold" style={{ background: "#ffd36b", color: t.ink }}>
            See how you did
          </button>
        </section>
      </div>
    </div>
  );
}

/**
 * Focus a card's main button a moment after it appears. Not autoFocus: the Enter that pressed the challenge's
 * Continue would otherwise land on the freshly focused button as a keypress and click straight through the card.
 */
function useDelayedFocus<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const id = window.setTimeout(() => ref.current?.focus(), 350);
    return () => window.clearTimeout(id);
  }, []);
  return ref;
}

// ---------------------------------------------------------------------------------------------------------------
// the town scene

interface Drawable {
  y: number;
  key: string;
  node: ReactNode;
}

function TownScene(props: {
  t: CozyTokens;
  world: CozyWorld;
  st: CozyState;
  solved: ReadonlySet<string>;
  available: readonly string[];
  time: number;
  bloom: number;
  celebrate: { id: string; key: number } | null;
  fireworks?: boolean;
}) {
  const { t, world, st, solved, available, time, bloom, celebrate } = props;
  const [skyTop, skyBottom] = SKIES[time];
  const night = time >= 3;
  const onBoard = new Set(st.slots.filter((s): s is string => s !== null));
  const helped = world.order.filter((id) => solved.has(id)).length;

  const drawables: Drawable[] = [];
  for (const v of world.villagers.values()) {
    if (!v.house) continue;
    const state = stateOf(v.encounterId, solved, available);
    drawables.push({
      y: v.house.y,
      key: `h-${v.encounterId}`,
      node: (
        <House
          spot={v.house}
          state={state}
          waiting={state === "available" && onBoard.has(v.encounterId)}
          look={v.look}
          encounterId={v.encounterId}
          label={`${v.name}'s house (${v.household}): ${state === "solved" ? "helped" : state === "available" ? "has a request" : "not visiting yet"}`}
          celebrateKey={celebrate && celebrate.id === v.encounterId ? celebrate.key : null}
          bloom={bloom}
        />
      ),
    });
  }
  world.plots.forEach((p) => {
    const b = st.built.filter((x) => x !== "lanterns").find((x) => plotOf(st, x) === p.index);
    drawables.push({
      y: p.y,
      key: `p-${p.index}`,
      node: (
        <g transform={`translate(${p.x} ${p.y}) scale(${p.scale})`}>
          {b ? (
            <g className="cz-anim cz-pop" key={b}>
              <BuildingArt id={b} lit={night} night={night} />
            </g>
          ) : (
            <EmptyPlot />
          )}
        </g>
      ),
    });
  });
  for (const [i, d] of world.decor.entries()) {
    if (d.minBloom > bloom) continue;
    drawables.push({
      y: d.y,
      key: `d-${i}`,
      node: (
        <g transform={`translate(${d.x} ${d.y}) scale(${d.scale})`}>
          {d.kind === "lamp" ? <Lamp lit={night} /> : d.kind === "flower" ? <Flower hue={d.hue} /> : <Tree kind={d.kind} hue={d.hue} />}
        </g>
      ),
    });
  }
  const lanterns = st.built.includes("lanterns");
  if (lanterns && !night) drawables.push({ y: PLAZA.y + 2, key: "lanterns", node: <FestivalLanterns cx={PLAZA.x} cy={PLAZA.y} rx={PLAZA.rx} glow={false} /> });
  drawables.sort((a, b) => a.y - b.y);

  const boats = BOAT_SPOTS.slice(0, Math.min(BOAT_SPOTS.length, 1 + bloom + (time >= 4 ? 1 : 0)));
  const bossState = world.bossId ? stateOf(world.bossId, solved, available) : null;

  return (
    <svg
      viewBox={`0 0 ${SCENE_W} ${SCENE_H}`}
      preserveAspectRatio="xMidYMid meet"
      overflow="visible"
      className="absolute inset-0 h-full w-full"
      role="img"
      aria-label={`${world.townName}: ${helped} of ${world.order.length} requests answered, ${st.built.length} buildings.`}
      data-testid="cozy-town"
    >
      <defs>
        <linearGradient id="cz-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={skyTop} />
          <stop offset="1" stopColor={skyBottom} />
        </linearGradient>
        <linearGradient id="cz-sea" gradientUnits="userSpaceOnUse" x1="0" y1="500" x2="0" y2="700">
          <stop offset="0" stopColor={t.sea} />
          <stop offset="1" stopColor={t.seaDeep} />
        </linearGradient>
        <radialGradient id="cz-glow">
          <stop offset="0" stopColor="#ffd36b" stopOpacity="0.75" />
          <stop offset="1" stopColor="#ffd36b" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* backgrounds run far past the viewBox: a container of any shape fills with sky above and countryside beside */}
      <rect x={-SCENE_W} y={-SCENE_H * 2} width={SCENE_W * 3} height={SCENE_H * 3} fill={skyTop} />
      <rect x={-SCENE_W} y="0" width={SCENE_W * 3} height={SCENE_H} fill="url(#cz-sky)" />
      {night &&
        STARS.map(([x, y, r], i) => <circle key={i} cx={x} cy={y} r={r} fill="#fff6e3" opacity={time >= 4 ? 0.9 : 0.5} className={i % 3 === 0 ? "cz-anim cz-twinkle" : undefined} />)}
      <SunOrMoon time={time} />
      {!night &&
        [
          [180, 70, 0],
          [620, 50, 6],
          [860, 110, 12],
        ].map(([x, y, d]) => (
          <g key={x} transform={`translate(${x} ${y})`}>
            <g className="cz-anim cz-cloud" style={{ animationDelay: `-${d}s` }}>
              <Cloud />
            </g>
          </g>
        ))}
      {props.fireworks &&
        FIREWORKS.map((f, i) => <Firework key={i} x={f[0]} y={f[1]} color={f[2]} delay={f[3]} r={f[4]} />)}

      <path d="M-1000 170 C -700 120, -400 200, -200 160 C -100 140, -40 170, 0 196 C 120 130, 260 150, 360 168 C 470 124, 620 112, 720 152 C 820 128, 930 140, 1000 150 C 1200 110, 1500 190, 2000 150 L2000 270 L-1000 270 Z" fill={t.hillFar} />
      <path d="M-1000 214 C -700 190, -300 230, 0 226 C 150 186, 300 204, 420 208 C 560 184, 700 192, 820 202 C 900 192, 960 198, 1000 202 C 1300 186, 1600 222, 2000 206 L2000 300 L-1000 300 Z" fill={t.hillNear} />
      <path d="M-1000 236 L0 236 Q 500 212 1000 236 L2000 236 L2000 490 L-1000 490 Z" fill={t.grass} />
      {/* streets, avenue and the festival square */}
      <rect x="24" y="292" width="952" height="18" rx="9" fill={t.path} />
      <rect x="16" y="388" width="968" height="20" rx="10" fill={t.path} />
      <path d="M472 360 L528 360 L540 478 L460 478 Z" fill={t.path} />
      <g data-encounter={world.bossId ?? undefined} data-state={bossState ?? undefined} data-testid="cozy-square">
        <ellipse cx={PLAZA.x} cy={PLAZA.y + 4} rx={PLAZA.rx} ry={PLAZA.ry} fill={t.stone} stroke={t.stoneDark} strokeWidth="2" />
        <ellipse cx={PLAZA.x} cy={PLAZA.y + 4} rx={PLAZA.rx - 22} ry={PLAZA.ry - 10} fill="none" stroke={t.stoneDark} strokeWidth="1.5" strokeDasharray="6 6" />
        <ellipse cx={PLAZA.x} cy={PLAZA.y + 6} rx="26" ry="10" fill="#b9d8e0" stroke={t.stoneDark} strokeWidth="3" />
        <path d={`M${PLAZA.x} ${PLAZA.y + 2} q -6 -14 0 -22 q 6 8 0 22`} fill="#d9f0f5" opacity="0.9" />
        {bossState === "available" && (
          <g transform={`translate(${PLAZA.x + 70} ${PLAZA.y + 8})`}>
            <path d="M0 0 V-46" stroke="#6b4a2b" strokeWidth="3" />
            <path d="M0 -46 L26 -40 L0 -32 Z" fill="#f28b5b" stroke="#6b3a1f" strokeWidth="1.4" className="cz-anim cz-bubble" />
          </g>
        )}
      </g>

      {bloom >= 2 && (
        <>
          <Bunting x1={150} y1={272} x2={330} y2={272} />
          <Bunting x1={670} y1={272} x2={850} y2={272} />
          <Bunting x1={150} y1={368} x2={330} y2={368} />
          <Bunting x1={670} y1={368} x2={850} y2={368} />
        </>
      )}

      {drawables.map((d) => (
        <g key={d.key}>{d.node}</g>
      ))}

      {/* the harbour: promenade, sea wall, pier, boats */}
      <rect x={-SCENE_W} y="474" width={SCENE_W * 3} height="14" fill={t.stone} />
      <rect x={-SCENE_W} y="488" width={SCENE_W * 3} height="12" fill={t.stoneDark} />
      {Array.from({ length: 76 }, (_, i) => (
        <path key={i} d={`M${i * 40 - 980} 488 V500`} stroke={mix(t.stoneDark, "#000", 0.15)} strokeWidth="1.2" />
      ))}
      <rect x={-SCENE_W} y="500" width={SCENE_W * 3} height={SCENE_H} fill="url(#cz-sea)" />
      <g className="cz-anim cz-wave" opacity="0.5">
        {Array.from({ length: 60 }, (_, i) => (
          <path key={i} d={`M${(i % 15) * 130 - 520 + (Math.floor(i / 15) % 2) * 65} ${520 + (i % 3) * 13 + Math.floor(i / 15) * 44} q 12 -6 24 0 t 24 0`} stroke="#ffffff" strokeWidth="2" fill="none" />
        ))}
      </g>
      <rect x="478" y="496" width="44" height="52" fill="#b98a5e" stroke="#6b4a2b" strokeWidth="1.5" />
      {[486, 500, 514].map((x) => (
        <path key={x} d={`M${x} 498 V546`} stroke="#8a6a44" strokeWidth="1" />
      ))}
      {boats.map((b, i) => (
        <g key={i} transform={`translate(${b[0]} ${b[1]}) scale(${b[2]})`}>
          <g className="cz-anim cz-boat" style={{ animationDelay: `-${i * 0.9}s` }}>
            <Boat color={BOAT_COLORS[i % BOAT_COLORS.length]} sail={i % 2 ? "#fff6e3" : "#ffe3c4"} />
          </g>
        </g>
      ))}

      {/* dusk / night tint, then the lights on top of it */}
      {time === 3 && <rect x={-SCENE_W} y={-SCENE_H * 2} width={SCENE_W * 3} height={SCENE_H * 4} fill="#46326e" opacity="0.22" />}
      {time >= 4 && <rect x={-SCENE_W} y={-SCENE_H * 2} width={SCENE_W * 3} height={SCENE_H * 4} fill="#0f1437" opacity="0.5" />}
      {night && (
        <g>
          {[...world.villagers.values()]
            .filter((v) => v.house && solved.has(v.encounterId))
            .map((v) => (
              <circle key={v.encounterId} cx={v.house!.x} cy={v.house!.y - 26 * v.house!.scale} r={34 * v.house!.scale} fill="url(#cz-glow)" />
            ))}
          {world.decor
            .filter((d) => d.kind === "lamp")
            .map((d, i) => (
              <circle key={i} cx={d.x} cy={d.y - 36 * d.scale} r="20" fill="url(#cz-glow)" />
            ))}
          {lanterns && <FestivalLanterns cx={PLAZA.x} cy={PLAZA.y} rx={PLAZA.rx} glow />}
        </g>
      )}
    </svg>
  );
}

function EmptyPlot() {
  return (
    <g>
      <ellipse cx="0" cy="-4" rx="36" ry="11" fill="#d9c59a" stroke="#b39a6a" strokeWidth="1.5" strokeDasharray="5 4" />
      <path d="M-18 -4 V-30" stroke="#8a5a3b" strokeWidth="3" />
      <rect x="-32" y="-44" width="28" height="18" rx="3" fill="#fff6e3" stroke="#8a5a3b" strokeWidth="2" />
      <path d="M-26 -38 H-10 M-26 -32 H-14" stroke="#8a5a3b" strokeWidth="1.6" />
    </g>
  );
}

function SunOrMoon({ time }: { time: number }) {
  if (time >= 3) {
    const [x, y] = time >= 4 ? [820, 70] : [140, 90];
    return (
      <g transform={`translate(${x} ${y})`}>
        <circle r="40" fill="#fff3c4" opacity="0.18" />
        <circle r="20" fill="#fff3c4" />
        <circle cx="8" cy="-6" r="17" fill={time >= 4 ? SKIES[4][0] : "#8a6fa8"} />
      </g>
    );
  }
  const pos = [
    [170, 118],
    [500, 62],
    [830, 104],
  ][time];
  return (
    <g transform={`translate(${pos[0]} ${pos[1]})`}>
      <circle r="52" fill="#ffe9a8" opacity="0.35" />
      <circle r="30" fill={time === 2 ? "#ffb35c" : "#ffd36b"} />
    </g>
  );
}

const BOAT_SPOTS: [number, number, number][] = [
  [380, 530, 1],
  [640, 540, 0.9],
  [180, 548, 1.05],
  [820, 526, 0.85],
  [260, 522, 0.8],
  [720, 552, 1],
  [920, 546, 0.9],
];
const BOAT_COLORS = ["#e07a5f", "#6f9fc8", "#f2cc8f", "#b58ac9", "#81b29a"];
const STARS: [number, number, number][] = Array.from({ length: 40 }, (_, i) => [(i * 137.5) % 1000, 10 + ((i * 53) % 150), 0.8 + (i % 3) * 0.5]);
const FIREWORKS: [number, number, string, number, number][] = [
  [200, 90, "#ffd36b", 0, 52],
  [420, 60, "#f27a93", 0.9, 44],
  [640, 100, "#8fd3f4", 1.6, 56],
  [860, 70, "#b7a0f0", 0.5, 40],
  [320, 150, "#ff9f6e", 2.1, 36],
];
