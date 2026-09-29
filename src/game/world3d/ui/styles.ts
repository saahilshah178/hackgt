/*
 * The world3d interface stylesheet, injected once by World3DClient (the repo keeps game CSS in strings next to the
 * components, like TEACH_CSS). Everything reads the theme variables from ./themes.ts. Body text is ≥ 16 px (dialogue
 * 20 px) and every interactive element has a visible focus ring, so the HUD works on a projector and by keyboard.
 */

export const W3_CSS = /* css */ `
.w3-root { position: fixed; inset: 0; overflow: hidden; background: #0b0906; color: var(--w3-chip-ink); font-family: var(--font-jakarta), ui-sans-serif, system-ui, sans-serif; user-select: none; }
.w3-root :where(button) { font: inherit; }
.w3-root :focus-visible { outline: 3px solid var(--w3-accent); outline-offset: 2px; }
.w3-layer { position: absolute; inset: 0; pointer-events: none; }
.w3-layer > * { pointer-events: auto; }
.w3-chip { background: var(--w3-chip); color: var(--w3-chip-ink); backdrop-filter: var(--w3-blur); -webkit-backdrop-filter: var(--w3-blur); border: 1px solid rgba(255,255,255,0.12); border-radius: 12px; box-shadow: 0 8px 24px rgba(0,0,0,0.25); }
.w3-kicker { font-size: 12px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--w3-accent); font-weight: 700; }
.w3-heading { font-family: var(--w3-heading); letter-spacing: 0.02em; }
.w3-fade-in { animation: w3-fade 320ms ease-out both; }
@keyframes w3-fade { from { opacity: 0; translate: 0 6px; } to { opacity: 1; translate: 0 0; } }
@media (prefers-reduced-motion: reduce) { .w3-fade-in { animation: none; } }
.w3-reduced .w3-fade-in { animation: none; }

/* ---- top bar */
.w3-topleft { position: absolute; top: 16px; left: 16px; display: flex; flex-direction: column; gap: 8px; max-width: min(360px, 34vw); }
.w3-title { padding: 10px 14px; }
.w3-title h1 { margin: 0; font-size: 20px; line-height: 1.2; font-weight: 700; }
.w3-title p { margin: 2px 0 0; font-size: 14px; opacity: 0.85; }
.w3-topright { position: absolute; top: 16px; right: 16px; display: flex; gap: 8px; }
.w3-iconbtn { display: inline-flex; align-items: center; gap: 8px; padding: 9px 12px; font-size: 15px; font-weight: 600; cursor: pointer; }
.w3-iconbtn kbd { font-family: inherit; font-size: 12px; padding: 1px 6px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.3); opacity: 0.85; }
.w3-iconbtn:hover { border-color: var(--w3-accent); }

/* ---- compass */
.w3-compass { position: absolute; top: 16px; left: 50%; transform: translateX(-50%); width: min(560px, 44vw); height: 44px; overflow: hidden; mask-image: linear-gradient(90deg, transparent, #000 14%, #000 86%, transparent); -webkit-mask-image: linear-gradient(90deg, transparent, #000 14%, #000 86%, transparent); }
.w3-compass-track { position: absolute; inset: 0; }
.w3-compass-tick { position: absolute; top: 6px; transform: translateX(-50%); font-size: 13px; font-weight: 700; color: var(--w3-chip-ink); opacity: 0.8; text-shadow: 0 1px 3px rgba(0,0,0,0.8); }
.w3-compass-tick.is-major { font-size: 16px; opacity: 1; }
.w3-compass-mark { position: absolute; top: 22px; transform: translateX(-50%); display: flex; flex-direction: column; align-items: center; font-size: 11px; font-weight: 700; color: var(--w3-accent); text-shadow: 0 1px 3px rgba(0,0,0,0.9); white-space: nowrap; }
.w3-compass-mark.is-goal { color: #ffe29a; }
.w3-compass-center { position: absolute; left: 50%; top: 0; bottom: 0; width: 2px; background: var(--w3-accent); opacity: 0.8; transform: translateX(-50%); }

/* ---- quest tracker */
.w3-tracker { position: absolute; top: 76px; right: 16px; width: min(330px, 30vw); padding: 14px 16px; display: flex; flex-direction: column; gap: 10px; }
.w3-goal-title { font-size: 17px; font-weight: 700; line-height: 1.3; margin: 2px 0 0; }
.w3-progress { height: 6px; border-radius: 99px; background: rgba(255,255,255,0.15); overflow: hidden; }
.w3-progress > span { display: block; height: 100%; background: var(--w3-accent); transition: width 600ms ease; }
.w3-leads { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.w3-lead { display: grid; grid-template-columns: 22px 1fr auto; align-items: start; gap: 8px; font-size: 15px; line-height: 1.35; }
.w3-lead-arrow { width: 22px; height: 22px; display: grid; place-items: center; color: var(--w3-accent); }
.w3-lead-dist { font-size: 13px; opacity: 0.8; font-variant-numeric: tabular-nums; }
.w3-lead.is-goal .w3-lead-arrow { color: #ffe29a; }
.w3-tracker-foot { display: flex; justify-content: space-between; font-size: 14px; opacity: 0.9; }

/* ---- minimap */
.w3-minimap { position: absolute; right: 16px; bottom: 16px; width: 188px; height: 188px; border-radius: 50%; overflow: hidden; border: 2px solid var(--w3-accent); box-shadow: 0 10px 30px rgba(0,0,0,0.35); background: #111; }
.w3-minimap canvas { width: 100%; height: 100%; display: block; }
.w3-minimap-n { position: absolute; top: 4px; left: 50%; transform: translateX(-50%); font-size: 12px; font-weight: 800; color: #fff; text-shadow: 0 1px 2px #000; }

/* ---- interaction prompt */
.w3-prompt { position: absolute; left: 50%; bottom: 120px; transform: translateX(-50%); display: flex; align-items: center; gap: 12px; padding: 10px 18px 10px 10px; font-size: 18px; font-weight: 600; }
.w3-prompt kbd { display: grid; place-items: center; width: 34px; height: 34px; border-radius: 9px; background: var(--w3-accent); color: #1a120a; font-family: inherit; font-weight: 800; font-size: 17px; box-shadow: 0 2px 0 rgba(0,0,0,0.35); }

/* ---- toasts */
.w3-toasts { position: absolute; top: 72px; left: 50%; transform: translateX(-50%); display: flex; flex-direction: column; gap: 8px; align-items: center; width: min(520px, 60vw); pointer-events: none; }
.w3-toast { padding: 12px 16px; display: grid; grid-template-columns: 40px 1fr; gap: 12px; align-items: center; width: 100%; }
.w3-toast-icon { width: 40px; height: 40px; border-radius: 10px; display: grid; place-items: center; background: color-mix(in oklab, var(--w3-accent) 30%, transparent); color: var(--w3-accent); font-size: 20px; }
.w3-toast strong { display: block; font-size: 16px; }
.w3-toast span { display: block; font-size: 15px; opacity: 0.92; line-height: 1.35; }

/* ---- controls hint */
.w3-controls { position: absolute; left: 16px; bottom: 16px; padding: 10px 14px; font-size: 14px; display: flex; flex-wrap: wrap; gap: 6px 14px; max-width: 540px; }
.w3-controls kbd { font-family: inherit; font-weight: 700; padding: 1px 6px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.35); margin-right: 4px; }

/* ---- letterbox + dialogue */
.w3-letterbox::before, .w3-letterbox::after { content: ""; position: absolute; left: 0; right: 0; height: 9vh; background: #000; z-index: 2; transition: transform 400ms ease; pointer-events: none; }
.w3-letterbox::before { top: 0; }
.w3-letterbox::after { bottom: 0; }
.w3-dialogue { position: absolute; left: 50%; bottom: calc(9vh + 18px); transform: translateX(-50%); width: min(880px, calc(100vw - 48px)); z-index: 3; background: var(--w3-panel); color: var(--w3-ink); border: 2px solid var(--w3-border); border-radius: 16px; box-shadow: 0 18px 50px rgba(0,0,0,0.45); padding: 18px 22px 16px; font-family: var(--w3-body); }
.w3-dialogue.is-side { left: 24px; transform: none; width: min(560px, calc(55vw - 48px)); }
.w3-speaker { display: flex; align-items: center; gap: 12px; margin: -34px 0 8px -4px; }
.w3-portrait { width: 52px; height: 52px; border-radius: 50%; display: grid; place-items: center; font-family: var(--w3-heading); font-weight: 700; font-size: 22px; color: #fff; border: 3px solid var(--w3-border); box-shadow: 0 4px 12px rgba(0,0,0,0.35); }
.w3-nameplate { padding: 5px 14px; border-radius: 10px; background: var(--w3-border); color: #fff; font-family: var(--w3-heading); font-weight: 700; font-size: 17px; letter-spacing: 0.03em; }
.w3-nameplate small { font-family: var(--w3-body); font-weight: 500; opacity: 0.9; margin-left: 8px; font-size: 14px; letter-spacing: 0; }
.w3-line { font-size: 21px; line-height: 1.45; min-height: 3em; margin: 0; }
.w3-line.is-narrator { font-style: italic; }
.w3-line-caret { display: inline-block; width: 0.5em; animation: w3-blink 1s steps(2) infinite; }
@keyframes w3-blink { 50% { opacity: 0; } }
.w3-choices { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 12px; }
.w3-choice { display: inline-flex; align-items: center; gap: 8px; padding: 9px 16px; border-radius: 10px; border: 2px solid var(--w3-border); background: rgba(255,255,255,0.12); color: var(--w3-ink); font-size: 17px; font-weight: 600; cursor: pointer; font-family: var(--font-jakarta), ui-sans-serif, system-ui, sans-serif; }
.w3-choice:hover { background: rgba(255,255,255,0.22); }
.w3-choice.is-primary { background: var(--w3-accent); border-color: var(--w3-accent); color: #1a120a; }
.w3-choice kbd { font-family: inherit; font-size: 12px; opacity: 0.75; }
.w3-continue { position: absolute; right: 18px; bottom: 12px; font-size: 13px; opacity: 0.7; font-family: var(--font-jakarta), ui-sans-serif, system-ui, sans-serif; }
.w3-ask { display: flex; gap: 8px; margin-top: 12px; }
.w3-ask input { flex: 1; min-width: 0; padding: 10px 12px; border-radius: 10px; border: 2px solid var(--w3-border); background: rgba(255,255,255,0.55); color: var(--w3-ink); font-size: 17px; font-family: var(--font-jakarta), ui-sans-serif, system-ui, sans-serif; user-select: text; }
.w3-ask-suggest { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
.w3-ask-suggest button { padding: 5px 10px; border-radius: 99px; border: 1px solid var(--w3-border); background: transparent; color: var(--w3-ink); font-size: 14px; cursor: pointer; font-family: var(--font-jakarta), ui-sans-serif, system-ui, sans-serif; }
.w3-thinking span { display: inline-block; width: 7px; height: 7px; margin-right: 4px; border-radius: 50%; background: currentColor; animation: w3-dot 1s infinite ease-in-out; }
.w3-thinking span:nth-child(2) { animation-delay: 0.15s; }
.w3-thinking span:nth-child(3) { animation-delay: 0.3s; }
@keyframes w3-dot { 0%, 100% { opacity: 0.25; } 50% { opacity: 1; } }

/* ---- challenge sheet (wraps the shared ChallengePanel) */
.w3-sheet { position: absolute; top: 16px; right: 16px; bottom: 16px; width: min(560px, calc(46vw)); display: flex; flex-direction: column; background: var(--w3-sheet); color: #f7f1e6; border: 2px solid var(--w3-border); border-radius: 18px; box-shadow: 0 24px 60px rgba(0,0,0,0.5); overflow: hidden; z-index: 4; }
.w3-sheet-head { padding: 16px 20px 12px; background: var(--w3-panel); color: var(--w3-ink); border-bottom: 2px solid var(--w3-border); display: flex; justify-content: space-between; align-items: start; gap: 12px; }
.w3-sheet-head h2 { margin: 4px 0 0; font-family: var(--w3-body); font-weight: 600; font-size: 21px; line-height: 1.3; }
.w3-sheet-head .w3-kicker { color: var(--w3-muted); }
.w3-sheet-body { flex: 1; overflow: auto; padding: 14px 16px 18px; user-select: text; }
.w3-sheet-body [data-testid="challenge-panel"] { border: none !important; background: transparent !important; padding: 0 !important; }
.w3-close { border: 2px solid var(--w3-border); background: transparent; color: var(--w3-ink); border-radius: 10px; padding: 6px 12px; font-weight: 700; cursor: pointer; font-size: 15px; white-space: nowrap; }
@media (max-width: 820px) { .w3-sheet { left: 12px; right: 12px; width: auto; top: 30vh; } .w3-dialogue.is-side { left: 12px; right: 12px; width: auto; } }

/* ---- full-screen overlays: intro, journal, map, pause, finale, end */
.w3-overlay { position: absolute; inset: 0; z-index: 6; display: grid; place-items: center; background: radial-gradient(ellipse at center, rgba(0,0,0,0.35), rgba(0,0,0,0.72)); }
.w3-overlay.is-clear { background: linear-gradient(180deg, rgba(0,0,0,0) 40%, rgba(0,0,0,0.65)); place-items: end center; padding-bottom: 7vh; }
.w3-overlay.is-clear.is-flying { background: linear-gradient(180deg, rgba(0,0,0,0) 62%, rgba(0,0,0,0.6)); pointer-events: none; }
.w3-lowerthird { pointer-events: auto; display: flex; align-items: end; justify-content: space-between; gap: 24px; width: min(1100px, calc(100vw - 48px)); color: #fff; text-shadow: 0 2px 12px rgba(0,0,0,0.6); }
.w3-lowerthird .w3-caption { margin: 0; font-size: 16px; letter-spacing: 0.14em; text-transform: uppercase; opacity: 0.9; }
.w3-lowerthird h1 { margin: 4px 0 0; font-family: var(--w3-heading); font-size: clamp(34px, 5vw, 60px); line-height: 1.05; }
.w3-card { background: var(--w3-panel); color: var(--w3-ink); border: 2px solid var(--w3-border); border-radius: 20px; box-shadow: 0 30px 80px rgba(0,0,0,0.55); font-family: var(--w3-body); }
.w3-intro { width: min(720px, calc(100vw - 32px)); padding: 26px 30px 24px; text-align: center; }
.w3-intro h1 { font-family: var(--w3-heading); font-size: clamp(30px, 4.2vw, 46px); line-height: 1.1; margin: 6px 0 4px; }
.w3-intro .w3-caption { font-size: 17px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--w3-muted); margin: 0; }
.w3-intro .w3-premise { font-size: 20px; line-height: 1.5; margin: 14px auto 0; max-width: 60ch; }
.w3-intro .w3-goalline { display: inline-flex; gap: 10px; align-items: center; margin-top: 14px; padding: 8px 14px; border-radius: 12px; border: 2px solid var(--w3-border); font-size: 17px; font-weight: 600; font-family: var(--font-jakarta), ui-sans-serif, system-ui, sans-serif; }
.w3-intro-actions { display: flex; justify-content: center; gap: 12px; margin-top: 20px; flex-wrap: wrap; }
.w3-cta { padding: 12px 26px; border-radius: 999px; border: none; background: var(--w3-accent); color: #1a120a; font-size: 18px; font-weight: 800; cursor: pointer; box-shadow: 0 6px 18px rgba(0,0,0,0.3); font-family: var(--font-jakarta), ui-sans-serif, system-ui, sans-serif; }
.w3-cta.is-ghost { background: transparent; color: var(--w3-ink); border: 2px solid var(--w3-border); box-shadow: none; }
.w3-keys { display: flex; justify-content: center; flex-wrap: wrap; gap: 8px 16px; margin-top: 16px; font-size: 15px; color: var(--w3-muted); font-family: var(--font-jakarta), ui-sans-serif, system-ui, sans-serif; }
.w3-keys kbd { font-family: inherit; font-weight: 700; padding: 1px 7px; border-radius: 6px; border: 1px solid var(--w3-border); color: var(--w3-ink); }
.w3-looks { display: flex; justify-content: center; gap: 10px; margin-top: 14px; }
.w3-look { width: 46px; height: 46px; border-radius: 50%; border: 3px solid transparent; cursor: pointer; }
.w3-look[aria-pressed="true"] { border-color: var(--w3-accent); box-shadow: 0 0 0 3px rgba(0,0,0,0.25); }
.w3-panel-card { width: min(860px, calc(100vw - 32px)); max-height: calc(100vh - 64px); display: flex; flex-direction: column; overflow: hidden; }
.w3-panel-card header { display: flex; justify-content: space-between; align-items: center; padding: 18px 22px; border-bottom: 2px solid var(--w3-border); }
.w3-panel-card header h2 { margin: 0; font-family: var(--w3-heading); font-size: 26px; }
.w3-panel-card .w3-panel-body { overflow: auto; padding: 18px 22px 22px; font-size: 18px; line-height: 1.5; user-select: text; }
.w3-tabs { display: flex; gap: 6px; padding: 10px 22px 0; }
.w3-tab { padding: 8px 14px; border-radius: 10px 10px 0 0; border: 2px solid var(--w3-border); border-bottom: none; background: transparent; color: var(--w3-ink); font-weight: 700; cursor: pointer; font-size: 16px; font-family: var(--font-jakarta), ui-sans-serif, system-ui, sans-serif; }
.w3-tab[aria-selected="true"] { background: var(--w3-border); color: #fff; }
.w3-entry { padding: 12px 0; border-bottom: 1px dashed color-mix(in oklab, var(--w3-border) 60%, transparent); }
.w3-entry h3 { margin: 0 0 4px; font-family: var(--w3-heading); font-size: 19px; }
.w3-entry p { margin: 0; }
.w3-entry.is-locked { opacity: 0.55; }
.w3-menu { width: min(460px, calc(100vw - 32px)); padding: 22px; display: flex; flex-direction: column; gap: 10px; }
.w3-menu h2 { margin: 0 0 6px; font-family: var(--w3-heading); font-size: 28px; text-align: center; }
.w3-menu .w3-cta { width: 100%; }
.w3-setting { display: grid; grid-template-columns: 1fr auto; gap: 10px; align-items: center; font-size: 17px; font-family: var(--font-jakarta), ui-sans-serif, system-ui, sans-serif; }
.w3-setting select, .w3-setting input[type="range"] { font-size: 16px; }
.w3-map { position: relative; width: min(84vh, calc(100vw - 32px)); aspect-ratio: 1; border-radius: 18px; overflow: hidden; border: 3px solid var(--w3-border); box-shadow: 0 30px 80px rgba(0,0,0,0.6); }
.w3-map canvas { width: 100%; height: 100%; display: block; }
.w3-map-label { position: absolute; transform: translate(-50%, -50%); font-size: 14px; font-weight: 700; color: #fff; text-shadow: 0 1px 3px #000, 0 0 8px rgba(0,0,0,0.7); white-space: nowrap; pointer-events: none; }
.w3-map-label.is-lead { color: var(--w3-accent); }
.w3-map-label.is-goal { color: #ffe29a; font-size: 16px; }

/* ---- npc name tags and barks: a DOM layer the scene positions each frame */
.w3-labels { position: absolute; inset: 0; pointer-events: none; overflow: hidden; z-index: 1; }
.w3-label { position: absolute; left: 0; top: 0; display: flex; flex-direction: column; align-items: center; gap: 6px; transform-origin: 50% 100%; will-change: transform; }
.w3-nametag.is-hidden, .w3-bark.is-hidden { opacity: 0; visibility: hidden; }
.w3-nametag { transition: opacity 250ms ease; display: flex; flex-direction: column; align-items: center; gap: 1px; padding: 4px 10px; border-radius: 10px; background: rgba(12, 9, 6, 0.62); color: #fff; white-space: nowrap; font-family: var(--font-jakarta), ui-sans-serif, system-ui, sans-serif; }
.w3-nametag-name { font-size: 15px; font-weight: 700; }
.w3-nametag-role { font-size: 12px; opacity: 0.85; }
.w3-nametag-mark { color: #ffd27a; font-size: 14px; line-height: 1; }
.w3-nametag.is-target { outline: 2px solid #ffd27a; }
.w3-bark { max-width: 260px; padding: 8px 12px; border-radius: 12px; background: rgba(255, 250, 240, 0.94); color: #2a1d10; font-size: 15px; line-height: 1.35; white-space: normal; text-align: center; box-shadow: 0 6px 16px rgba(0,0,0,0.3); font-family: var(--font-jakarta), ui-sans-serif, system-ui, sans-serif; }

/* ---- photo mode */
.w3-photobar { position: absolute; left: 50%; bottom: 24px; transform: translateX(-50%); display: flex; align-items: center; gap: 12px; padding: 8px 10px 8px 16px; font-size: 16px; font-weight: 600; }

/* ---- loading */
.w3-loading { position: absolute; inset: 0; display: grid; place-items: center; background: #0b0906; color: #f3e7cf; z-index: 10; }
.w3-loading p { font-size: 18px; margin-top: 12px; }
.w3-loading .w3-bar { width: 260px; height: 4px; border-radius: 9px; background: rgba(255,255,255,0.12); overflow: hidden; }
.w3-loading .w3-bar span { display: block; height: 100%; width: 40%; background: var(--w3-accent); animation: w3-load 1.2s infinite ease-in-out; }
@keyframes w3-load { 0% { transform: translateX(-100%); } 100% { transform: translateX(260%); } }
`;
