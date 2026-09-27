/*
 * Styles for the casefile host. Plain CSS in a string (like the other board hosts) so the whole host ships as one
 * lazy chunk. Every looping animation carries `cf-anim` and every one-shot effect has its own class, so
 * prefers-reduced-motion can stop the loops and shorten the one-shots to simple fades.
 */
export const CASEFILE_CSS = `
.cf-host { --cf-type: "American Typewriter", "Courier Prime", "Courier New", Courier, ui-monospace, monospace; --cf-red: #d4333f; --cf-lamp: #ffcf7a; --cf-paper: #efe6cf; --cf-ink: #1d1a14;
  display: grid; grid-template-columns: minmax(0, 1fr) clamp(560px, 37.5vw, 640px); gap: 14px; align-items: start; color: #f5f3ee; }
@media (max-width: 1100px) { .cf-host { grid-template-columns: minmax(0, 1fr); } }
.cf-main { min-width: 0; display: flex; flex-direction: column; gap: 10px; }

/* ---- location tabs */
.cf-tabbar { display: flex; align-items: stretch; gap: 8px; flex-wrap: wrap; }
.cf-tabs { display: flex; gap: 8px; flex: 1; min-width: 0; }
.cf-tab { position: relative; display: flex; flex-direction: column; align-items: flex-start; justify-content: center; gap: 1px; flex: 1 1 0; min-width: 0; max-width: 250px; padding: 6px 14px 6px 12px; border-radius: 10px 10px 4px 4px; border: 2px solid rgba(255,255,255,0.14); background: rgba(10,10,22,0.7); color: #d9d6e8; text-align: left; line-height: 1.15; }
.cf-tab:hover { background: rgba(255,255,255,0.08); }
.cf-tab[aria-selected="true"] { border-color: var(--cf-accent); background: color-mix(in oklab, var(--cf-accent) 22%, #0b0a16); color: #fff; }
.cf-tab-kicker { font-size: 14px; letter-spacing: 0.08em; text-transform: uppercase; color: #b9b4cf; font-weight: 700; }
.cf-tab[aria-selected="true"] .cf-tab-kicker { color: var(--cf-accent); }
.cf-tab-title { font-size: 17px; font-weight: 700; max-width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cf-tab-badge { position: absolute; top: -9px; right: -8px; min-width: 26px; height: 26px; padding: 0 7px; display: grid; place-items: center; border-radius: 13px; background: var(--cf-lamp); color: #231a06; font-size: 15px; font-weight: 800; box-shadow: 0 2px 8px rgba(0,0,0,0.5); }
.cf-tab-acc { flex: 0 0 auto; }
.cf-tab-acc[data-open="true"] { border-color: var(--cf-red); animation: cf-glow 1.8s ease-in-out infinite; }
.cf-tab-acc[data-open="true"] .cf-tab-kicker { color: #ff8b92; }
.cf-boardbtn { display: flex; align-items: center; gap: 8px; padding: 6px 14px; white-space: nowrap; border-radius: 10px; border: 2px solid #8a5d34; background: #3a2618; color: #ffe9c7; font-size: 18px; font-weight: 700; }
.cf-boardbtn:hover { background: #4a321f; }
.cf-boardbtn[aria-pressed="true"] { background: #8a5d34; color: #fff; }
.cf-tab:focus-visible, .cf-boardbtn:focus-visible, .cf-card:focus-visible, .cf-lead:focus-visible, .cf-btn:focus-visible, .cf-pin-card:focus-visible, .cf-accuse:focus-visible { outline: 3px solid #fff; outline-offset: 3px; }

/* ---- the scene */
.cf-stage { position: relative; width: min(100%, calc((100vh - 360px) * 2)); aspect-ratio: 2 / 1; margin: 0 auto; border-radius: 14px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.55), inset 0 0 0 2px rgba(255,255,255,0.06); background: #07070d; }
.cf-caption { position: absolute; left: 14px; top: 12px; z-index: 2; padding: 4px 12px; background: var(--cf-paper); color: var(--cf-ink); font-family: var(--cf-type); font-size: 16px; font-weight: 800; border-radius: 2px; box-shadow: 0 3px 8px rgba(0,0,0,0.5); rotate: -1.5deg; pointer-events: none; max-width: 60%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cf-caption span { font-weight: 400; }
.cf-scene-svg { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
.cf-hots { position: absolute; inset: 0; }
.cf-hot { position: absolute; padding: 0; margin: 0; border: 0; background: transparent; border-radius: 16px; cursor: zoom-in; }
.cf-hot::before { content: ""; position: absolute; left: 50%; top: 50%; width: min(120px, 90%); aspect-ratio: 1; transform: translate(-50%, -50%) scale(0.85); border-radius: 50%; border: 4px solid var(--cf-lamp); box-shadow: 0 0 0 3px rgba(0,0,0,0.55), 0 0 22px color-mix(in oklab, var(--cf-lamp) 60%, transparent); opacity: 0; transition: opacity 140ms, transform 160ms; pointer-events: none; }
.cf-hot::after { content: ""; position: absolute; left: calc(50% + min(42px, 32%)); top: calc(50% + min(42px, 32%)); width: 34px; height: 9px; border-radius: 5px; background: var(--cf-lamp); transform: rotate(45deg); transform-origin: left center; box-shadow: 0 0 0 3px rgba(0,0,0,0.55); opacity: 0; transition: opacity 140ms; pointer-events: none; }
.cf-hot:hover::before, .cf-hot:focus-visible::before { opacity: 1; transform: translate(-50%, -50%) scale(1); }
.cf-hot:hover::after, .cf-hot:focus-visible::after { opacity: 1; }
.cf-hot:focus { outline: none; }
.cf-hot:focus-visible { background: rgba(255, 207, 122, 0.08); }
.cf-hot-label { position: absolute; left: 50%; bottom: -6px; transform: translate(-50%, 100%); white-space: nowrap; padding: 4px 10px; border-radius: 8px; background: rgba(8,8,16,0.92); border: 2px solid var(--cf-lamp); color: #fff; font-size: 16px; font-weight: 700; opacity: 0; pointer-events: none; z-index: 3; }
.cf-hot:hover .cf-hot-label, .cf-hot:focus-visible .cf-hot-label { opacity: 1; }
.cf-hot[data-edge="bottom"] .cf-hot-label { bottom: auto; top: -6px; transform: translate(-50%, -100%); }
.cf-glint { position: absolute; right: 8%; top: 6%; width: 28px; height: 28px; pointer-events: none; }
.cf-glint svg { width: 100%; height: 100%; filter: drop-shadow(0 0 6px var(--cf-lamp)); }
.cf-glint-new svg { filter: drop-shadow(0 0 8px #fff); }
.cf-hot[data-searched="true"][data-pending="false"] { cursor: default; }
.cf-bubble { position: absolute; z-index: 4; max-width: 340px; padding: 10px 14px; border-radius: 12px; background: rgba(8,8,16,0.94); border: 2px solid var(--cf-lamp); font-size: 18px; line-height: 1.3; box-shadow: 0 8px 24px rgba(0,0,0,0.6); pointer-events: none; animation: cf-bubble 3.2s ease-out both; }
.cf-bubble strong { color: var(--cf-lamp); }
.cf-bubble[data-found="true"] { border-color: #fff; }
.cf-fly { position: absolute; z-index: 5; width: 92px; height: 62px; margin-left: -46px; margin-top: -31px; border-radius: 3px; background: var(--cf-paper); box-shadow: 0 6px 16px rgba(0,0,0,0.5); pointer-events: none; animation: cf-fly 950ms cubic-bezier(.45,-0.2,.6,1) both; }
.cf-fly::before { content: ""; position: absolute; inset: 12px 10px auto 10px; height: 3px; background: #6b6250; box-shadow: 0 10px 0 #6b6250, 0 20px 0 #6b6250; opacity: 0.6; }
.cf-stamp { position: absolute; left: 50%; top: 46%; z-index: 6; width: min(460px, 70%); padding: 20px 26px 22px; background: var(--cf-paper); color: var(--cf-ink); border-radius: 4px; box-shadow: 0 20px 50px rgba(0,0,0,0.7); font-family: var(--cf-type); pointer-events: none; animation: cf-stamp-card 2600ms ease-out both; }
.cf-stamp-kicker { font-size: 15px; letter-spacing: 0.2em; text-transform: uppercase; color: #6b6250; }
.cf-stamp-name { font-size: 24px; font-weight: 800; margin-top: 4px; }
.cf-stamp-mark { position: absolute; right: 16px; top: 22px; padding: 2px 12px; border: 5px solid var(--cf-red); color: var(--cf-red); border-radius: 8px; font-size: 28px; font-weight: 900; letter-spacing: 0.12em; font-family: var(--cf-type); transform: rotate(-10deg); animation: cf-stamp-slam 520ms 260ms cubic-bezier(.2,1.6,.4,1) both; mix-blend-mode: multiply; }
.cf-rainfx { position: absolute; inset: 0; pointer-events: none; }

/* ---- accusation room */
.cf-accuse-wrap { position: absolute; left: 50%; bottom: 7%; transform: translateX(-50%); display: flex; flex-direction: column; align-items: center; gap: 8px; z-index: 3; }
.cf-accuse { font-size: 26px; font-weight: 900; letter-spacing: 0.02em; padding: 14px 34px; border-radius: 14px; border: 3px solid #fff; background: var(--cf-red); color: #fff; box-shadow: 0 0 0 4px rgba(0,0,0,0.5), 0 0 40px color-mix(in oklab, var(--cf-red) 70%, transparent); animation: cf-glow 1.8s ease-in-out infinite; }
.cf-accuse:hover { filter: brightness(1.1); }
.cf-accuse-locked { font-size: 20px; padding: 10px 20px; border-radius: 12px; background: rgba(8,8,16,0.9); border: 2px dashed #8a86a0; color: #e4e1f0; text-align: center; max-width: 520px; }
.cf-nameplate { position: absolute; left: 3%; top: 5%; padding: 8px 16px; border-radius: 6px; background: rgba(8,8,16,0.9); border: 2px solid var(--cf-accent); max-width: 38%; rotate: -1deg; }
.cf-nameplate strong { display: block; font-size: 22px; }
.cf-nameplate span { font-size: 16px; color: #d6d1ea; }

/* ---- speech band */
.cf-speech { display: flex; gap: 14px; align-items: flex-start; }
.cf-speech-face { flex: none; width: 76px; height: 76px; border-radius: 50%; overflow: hidden; border: 3px solid var(--cf-lamp); background: #0b0a14; }
.cf-speech-face[data-who="suspect"] { border-color: var(--cf-accent); }
.cf-speech-body { flex: 1; min-width: 0; position: relative; padding: 10px 14px; border-radius: 12px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); }
.cf-speech-body::before { content: ""; position: absolute; left: -9px; top: 22px; border: 9px solid transparent; border-right-color: rgba(255,255,255,0.12); border-left: 0; }
.cf-speech-name { font-size: 16px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; color: var(--cf-lamp); }
.cf-speech-line { font-size: 19px; line-height: 1.4; margin-top: 2px; }
.cf-speech-line + .cf-speech-line { margin-top: 6px; }
.cf-speech[data-mood="hmm"] .cf-speech-body { animation: cf-tilt 600ms ease-in-out both; }
.cf-speech[data-mood="good"] .cf-speech-body { border-color: color-mix(in oklab, var(--cf-lamp) 60%, transparent); }
.cf-speech[data-mood="new"] .cf-speech-body { border-color: #fff; }

/* ---- inventory tray */
.cf-tray { border-radius: 14px; padding: 8px 12px 10px; background: linear-gradient(180deg, #2a1c14, #1b120c); border: 2px solid #4a3222; box-shadow: inset 0 2px 0 rgba(255,255,255,0.06); }
.cf-tray-head { display: flex; align-items: baseline; gap: 14px; min-height: 26px; }
.cf-tray-title { font-size: 16px; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; color: #ffe0b0; white-space: nowrap; }
.cf-status { font-size: 17px; color: #f1e7d6; flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cf-tray-row { display: flex; gap: 12px; overflow-x: auto; padding: 10px 4px 6px; scroll-snap-type: x proximity; min-height: 146px; align-items: flex-start; }
.cf-tray-empty { font-size: 18px; color: #d8c7ad; padding: 22px 8px; font-style: italic; }
.cf-card { position: relative; flex: none; width: 196px; height: 132px; scroll-snap-align: start; padding: 10px 12px 10px; border-radius: 3px; border: 0; background: var(--cf-paper); color: var(--cf-ink); text-align: left; font-family: var(--cf-type); box-shadow: 0 4px 10px rgba(0,0,0,0.45); transition: transform 150ms, box-shadow 150ms; cursor: grab; display: flex; flex-direction: column; gap: 4px; overflow: hidden; }
.cf-card:hover { transform: translateY(-3px) rotate(0deg) !important; box-shadow: 0 10px 18px rgba(0,0,0,0.5); }
.cf-card[aria-pressed="true"] { transform: translateY(-8px) rotate(0deg) !important; box-shadow: 0 0 0 4px var(--cf-lamp), 0 14px 24px rgba(0,0,0,0.55); }
.cf-card[data-kind="tag"] { background: #f3e2b8; }
.cf-card[data-kind="tag"]::after { content: ""; position: absolute; right: -14px; top: -14px; width: 40px; height: 40px; background: #c79a56; transform: rotate(45deg); }
.cf-card-label { font-size: 13px; letter-spacing: 0.12em; text-transform: uppercase; color: #8a2a22; font-weight: 700; font-family: ui-sans-serif, system-ui, sans-serif; }
.cf-card-tagname { font-size: 19px; font-weight: 800; line-height: 1.2; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.cf-card-sub { font-size: 15px; color: #5a5040; margin-top: auto; font-family: ui-sans-serif, system-ui, sans-serif; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cf-card-text { font-size: 16px; line-height: 1.28; display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden; }
.cf-card-pin { position: absolute; left: 50%; top: 4px; width: 12px; height: 12px; margin-left: -6px; border-radius: 50%; background: var(--cf-red); box-shadow: 0 2px 3px rgba(0,0,0,0.5); opacity: 0; }
.cf-card[aria-pressed="true"] .cf-card-pin { opacity: 1; }
.cf-card-in { animation: cf-card-in 700ms 500ms cubic-bezier(.2,1.2,.4,1) both; }
.cf-card-shake { animation: cf-shake 480ms ease-in-out both; }
.cf-card[data-drop="true"] { box-shadow: 0 0 0 4px #fff, 0 10px 20px rgba(0,0,0,0.5); }
.cf-lead { position: relative; flex: none; width: 250px; height: 128px; scroll-snap-align: start; border-radius: 8px; border: 2px solid var(--cf-red); background: linear-gradient(180deg, #3b2418, #2a1a12); color: #fff; text-align: left; padding: 10px 12px; display: flex; flex-direction: column; gap: 4px; box-shadow: 0 6px 14px rgba(0,0,0,0.5); overflow: hidden; }
.cf-lead[data-state="available"] { cursor: pointer; }
.cf-lead[data-state="available"]:hover { filter: brightness(1.15); }
.cf-lead[data-state="locked"] { border-style: dashed; border-color: #8a7a6a; }
.cf-lead-kicker { font-size: 13px; letter-spacing: 0.14em; text-transform: uppercase; color: #ff9aa0; font-weight: 800; }
.cf-lead-name { font-size: 19px; font-weight: 800; line-height: 1.2; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.cf-lead-cta { margin-top: auto; align-self: flex-start; font-size: 16px; font-weight: 800; padding: 4px 12px; border-radius: 8px; background: var(--cf-lamp); color: #231a06; }
.cf-lead[data-state="locked"] .cf-lead-cta { background: transparent; color: #e6d8c6; padding: 0; font-weight: 600; }
.cf-lead-active .cf-lead-cta { background: #fff; }
.cf-lead-papers { position: absolute; right: 8px; top: 8px; width: 64px; height: 50px; opacity: 0.9; }
.cf-lead-in { animation: cf-flip 800ms cubic-bezier(.3,1.3,.5,1) both; }
.cf-lead-in .cf-string { stroke-dasharray: 120; animation: cf-string 900ms 250ms ease-out both; }

/* ---- side column */
.cf-side { position: sticky; top: 8px; min-width: 0; max-height: calc(100vh - 96px); overflow-y: auto; padding: 12px; border-radius: 16px; background: #0a0913; border: 1px solid #231f38; display: flex; flex-direction: column; gap: 12px; }
.cf-panel { border-radius: 14px; padding: 12px 14px; background: #120f20; border: 1px solid #2c2645; }
.cf-kicker { font-size: 15px; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; color: var(--cf-accent); }
.cf-body { font-size: 18px; line-height: 1.45; }
.cf-small { font-size: 16px; color: #cfcbe0; line-height: 1.4; }
.cf-steps { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }
.cf-step { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 8px 4px; border-radius: 10px; border: 2px solid transparent; text-align: center; font-size: 16px; color: #aaa5c2; }
.cf-step svg { width: 34px; height: 34px; }
.cf-step[data-current="true"] { border-color: var(--cf-lamp); color: #fff; background: rgba(255,207,122,0.08); }
.cf-step[data-done="true"] { color: #e8e4f5; }
.cf-inspect { position: relative; padding: 14px 16px; border-radius: 4px; background: var(--cf-paper); color: var(--cf-ink); font-family: var(--cf-type); box-shadow: 0 6px 16px rgba(0,0,0,0.5); }
.cf-inspect[data-kind="tag"] { background: #f3e2b8; }
.cf-inspect-label { font-size: 14px; letter-spacing: 0.14em; text-transform: uppercase; color: #8a2a22; font-weight: 800; font-family: ui-sans-serif, system-ui, sans-serif; }
.cf-inspect-text { font-size: 20px; line-height: 1.4; margin-top: 4px; }
.cf-inspect-meta { font-size: 15px; color: #5a5040; margin-top: 8px; font-family: ui-sans-serif, system-ui, sans-serif; }
.cf-pins { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
.cf-pinmark { width: 22px; height: 22px; border-radius: 50%; border: 2px solid #5f5a78; background: #1a1730; }
.cf-pinmark[data-state="solved"] { background: var(--cf-red); border-color: #ff9aa0; }
.cf-pinmark[data-state="available"] { border-color: var(--cf-lamp); box-shadow: 0 0 8px color-mix(in oklab, var(--cf-lamp) 70%, transparent); }
.cf-pinmark[data-boss="true"] { border-radius: 4px; transform: rotate(45deg) scale(0.9); }
.cf-count { font-size: 22px; font-weight: 800; }
.cf-count strong { color: var(--cf-lamp); font-size: 28px; }
.cf-keys { font-size: 16px; color: #c9c5dc; line-height: 1.6; }
.cf-keys kbd { font-family: inherit; font-size: 15px; padding: 1px 7px; border-radius: 5px; border: 1px solid #56506e; background: #1a1730; }
.cf-challenge-head { display: flex; gap: 12px; align-items: center; }
.cf-challenge-head[data-fx="wrong"] { animation: cf-shake 480ms ease-in-out both; }
.cf-head-line { font-size: 18px; font-style: italic; color: #ffe0b0; margin-top: 2px; }
.cf-head-line strong { font-style: normal; color: var(--cf-lamp); }
.cf-challenge-name { font-size: 24px; font-weight: 800; line-height: 1.15; }
.cf-mini-clues { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.cf-mini { padding: 8px 10px; border-radius: 3px; background: var(--cf-paper); color: var(--cf-ink); font-family: var(--cf-type); font-size: 16px; line-height: 1.3; }
.cf-mini[data-kind="tag"] { background: #f3e2b8; font-weight: 800; }
.cf-mini-label { display: block; font-size: 12px; letter-spacing: 0.12em; text-transform: uppercase; color: #8a2a22; font-weight: 800; font-family: ui-sans-serif, system-ui, sans-serif; }
.cf-mini-text { display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.cf-btn { font-size: 18px; font-weight: 700; padding: 10px 18px; border-radius: 10px; background: var(--cf-lamp); color: #231a06; }
.cf-btn:hover { filter: brightness(1.08); }
.cf-btn-ghost { background: transparent; color: #f5f3ee; border: 2px solid #6d6788; }

/* ---- case board */
.cf-board { position: relative; width: min(100%, calc((100vh - 170px) * 1.6129)); aspect-ratio: 1000 / 620; margin: 0 auto; border-radius: 14px; overflow: hidden; background: #6f4a2a; box-shadow: inset 0 0 0 10px #3a2418, inset 0 0 0 12px #1f130c, 0 10px 30px rgba(0,0,0,0.55); }
.cf-board-svg { position: absolute; inset: 0; width: 100%; height: 100%; }
.cf-lane-label { position: absolute; left: 20px; transform: translateY(-50%); padding: 3px 10px; background: #f3e2b8; color: var(--cf-ink); font-family: var(--cf-type); font-size: 15px; font-weight: 800; border-radius: 2px; box-shadow: 0 3px 6px rgba(0,0,0,0.4); rotate: -2deg; z-index: 1; max-width: 240px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cf-pin-card { position: absolute; transform: translate(-50%, -50%); z-index: 2; display: flex; flex-direction: column; gap: 4px; padding: 18px 10px 10px; border-radius: 3px; border: 0; background: var(--cf-paper); color: var(--cf-ink); font-family: var(--cf-type); text-align: left; box-shadow: 0 6px 14px rgba(0,0,0,0.5); overflow: hidden; }
.cf-pin-card[data-state="locked"][data-known="false"] { background: #c9bfa6; color: #3a3428; }
.cf-pin-card[data-known="false"] .cf-pin-name { font-size: 30px; letter-spacing: 0.2em; text-align: center; color: #6b6250; }
.cf-pin-card[data-open="true"] { box-shadow: 0 0 0 4px var(--cf-lamp), 0 8px 16px rgba(0,0,0,0.5); cursor: pointer; }
.cf-pin-card[data-selected="true"] { outline: 4px solid #fff; outline-offset: 2px; }
.cf-pin-kicker { font-size: 12px; letter-spacing: 0.12em; text-transform: uppercase; color: #8a2a22; font-weight: 800; font-family: ui-sans-serif, system-ui, sans-serif; }
.cf-pin-name { font-size: 16px; font-weight: 800; line-height: 1.2; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.cf-pin-stamp { align-self: flex-start; padding: 0 6px; border: 3px solid var(--cf-red); color: var(--cf-red); border-radius: 5px; font-size: 13px; font-weight: 900; letter-spacing: 0.1em; transform: rotate(-6deg); font-family: ui-sans-serif, system-ui, sans-serif; margin-bottom: 2px; }
.cf-pin-cta { font-size: 14px; font-weight: 800; color: #7a3b00; font-family: ui-sans-serif, system-ui, sans-serif; margin-top: auto; }
.cf-pin-compact { padding: 16px 6px 6px; }
.cf-pin-compact .cf-pin-name { font-size: 14px; overflow-wrap: anywhere; }
.cf-pin-compact .cf-pin-kicker { font-size: 11px; letter-spacing: 0.04em; }
.cf-pin-boss { background: #2a0f14; color: #fff; border: 3px solid var(--cf-red); }
.cf-pin-boss .cf-pin-kicker { color: #ff9aa0; }
.cf-pin-boss[data-known="false"] { background: #2a0f14; color: #fff; }
.cf-pin-boss[data-known="false"] .cf-pin-name { color: #ff9aa0; }
.cf-pin-new { animation: cf-card-in 700ms ease-out both; }
.cf-str { fill: none; stroke: var(--cf-red); stroke-width: 3.5; stroke-linecap: round; filter: drop-shadow(0 2px 1px rgba(0,0,0,0.5)); }
.cf-str-faint { fill: none; stroke: #e8d8bf; stroke-opacity: 0.35; stroke-width: 2; stroke-dasharray: 6 8; }
.cf-str-new { stroke-dasharray: 800; animation: cf-string-long 1100ms ease-out both; }

/* ---- finale newspaper */
.cf-paper { padding: 18px 20px 20px; border-radius: 4px; background: #efe8d6; color: #17140e; box-shadow: 0 20px 50px rgba(0,0,0,0.6); rotate: -1.2deg; animation: cf-paper-in 900ms cubic-bezier(.2,1.1,.4,1) both; }
.cf-paper-mast { display: flex; justify-content: space-between; align-items: baseline; border-bottom: 3px double #17140e; padding-bottom: 6px; font-family: Georgia, "Times New Roman", serif; }
.cf-paper-name { font-size: 26px; font-weight: 900; letter-spacing: 0.04em; }
.cf-paper-date { font-size: 14px; text-transform: uppercase; letter-spacing: 0.1em; }
.cf-paper-head { font-family: Georgia, "Times New Roman", serif; font-size: 50px; font-weight: 900; line-height: 1; margin-top: 12px; letter-spacing: -0.01em; text-transform: uppercase; }
.cf-paper-sub { font-family: Georgia, "Times New Roman", serif; font-size: 24px; font-style: italic; margin-top: 6px; line-height: 1.2; }
.cf-paper-cols { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-top: 12px; border-top: 1px solid #17140e; padding-top: 10px; }
.cf-paper-cols p { font-family: Georgia, "Times New Roman", serif; font-size: 18px; line-height: 1.4; }
.cf-paper-cols p + p { margin-top: 8px; }
.cf-paper-photo { border: 2px solid #17140e; background: #1a1622; aspect-ratio: 4 / 3; overflow: hidden; }
.cf-paper-cap { font-size: 14px; font-style: italic; margin-top: 4px; font-family: Georgia, serif; }

.cf-sr { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }

/* ---- motion */
.cf-rain { transform-box: fill-box; animation: cf-rain 0.8s linear infinite; }
.cf-lightning { animation: cf-lightning 11s linear infinite; }
.cf-lamp-flicker { animation: cf-flicker 7s linear infinite; }
.cf-tick { animation: cf-tick 60s steps(60) infinite; }
.cf-blink { animation: cf-blink 1.6s ease-in-out infinite; }
.cf-drip { animation: cf-drip 1.8s ease-in infinite; }
.cf-bubble-rise { animation: cf-drip 2.4s ease-in infinite reverse; }
.cf-swing { animation: cf-swing 6s ease-in-out infinite; }
.cf-eyes { animation: cf-blink 4s ease-in-out infinite; }
.cf-glint-pulse { animation: cf-glint 2.2s ease-in-out infinite; }
@keyframes cf-rain { from { transform: translateY(0); } to { transform: translateY(50%); } }
@keyframes cf-lightning { 0%, 91%, 93.5%, 95%, 100% { opacity: 0; } 92% { opacity: 0.55; } 94.2% { opacity: 0.35; } }
@keyframes cf-flicker { 0%, 40%, 42%, 44%, 100% { opacity: 1; } 41% { opacity: 0.75; } 43% { opacity: 0.9; } }
@keyframes cf-tick { to { transform: rotate(360deg); } }
@keyframes cf-blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.25; } }
@keyframes cf-drip { 0% { transform: translateY(0); opacity: 0; } 20% { opacity: 1; } 100% { transform: translateY(26px); opacity: 0; } }
@keyframes cf-swing { 0%, 100% { transform: rotate(-1.4deg); } 50% { transform: rotate(1.4deg); } }
@keyframes cf-glint { 0%, 100% { opacity: 0.35; transform: scale(0.8) rotate(0deg); } 50% { opacity: 1; transform: scale(1.1) rotate(20deg); } }
@keyframes cf-glow { 0%, 100% { box-shadow: 0 0 0 0 rgba(212,51,63,0); } 50% { box-shadow: 0 0 18px 2px rgba(212,51,63,0.65); } }
@keyframes cf-bubble { 0% { opacity: 0; transform: translateY(8px); } 10% { opacity: 1; transform: translateY(0); } 80% { opacity: 1; } 100% { opacity: 0; } }
@keyframes cf-fly { 0% { transform: scale(0.4) rotate(-20deg); opacity: 0; } 25% { transform: scale(1.1) rotate(4deg); opacity: 1; } 100% { top: 108%; transform: scale(0.8) rotate(-6deg); opacity: 0.2; } }
@keyframes cf-card-in { from { opacity: 0; transform: translateY(40px) rotate(8deg); } to { opacity: 1; } }
@keyframes cf-shake { 0%, 100% { translate: 0 0; } 20% { translate: -8px 0; } 40% { translate: 8px 0; } 60% { translate: -5px 0; } 80% { translate: 4px 0; } }
@keyframes cf-flip { 0% { transform: perspective(600px) rotateY(90deg); opacity: 0; } 100% { transform: perspective(600px) rotateY(0deg); opacity: 1; } }
@keyframes cf-string { from { stroke-dashoffset: 120; } to { stroke-dashoffset: 0; } }
@keyframes cf-string-long { from { stroke-dashoffset: 800; } to { stroke-dashoffset: 0; } }
@keyframes cf-stamp-card { 0% { opacity: 0; transform: translate(-50%, -40%) scale(0.9); } 12% { opacity: 1; transform: translate(-50%, -50%) scale(1); } 82% { opacity: 1; transform: translate(-50%, -50%) scale(1); } 100% { opacity: 0; transform: translate(-50%, -54%) scale(0.98); } }
@keyframes cf-stamp-slam { 0% { opacity: 0; transform: rotate(-10deg) scale(2.6); } 100% { opacity: 1; transform: rotate(-10deg) scale(1); } }
@keyframes cf-tilt { 0%, 100% { rotate: 0deg; } 30% { rotate: -1.5deg; } 60% { rotate: 1deg; } }
@keyframes cf-paper-in { from { opacity: 0; transform: rotate(-14deg) scale(0.6); } to { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: reduce) {
  .cf-anim, .cf-tab-acc[data-open="true"], .cf-accuse, .cf-glint-pulse { animation: none !important; }
  .cf-lightning { opacity: 0; }
  .cf-fly { display: none; }
  .cf-card-in, .cf-lead-in, .cf-card-shake, .cf-challenge-head[data-fx="wrong"], .cf-speech[data-mood="hmm"] .cf-speech-body, .cf-pin-new, .cf-paper { animation: none !important; }
  .cf-lead-in .cf-string, .cf-str-new { animation: none !important; stroke-dasharray: none; }
  .cf-stamp-mark { animation: none; }
  .cf-card, .cf-hot::before { transition: none; }
}
`;
