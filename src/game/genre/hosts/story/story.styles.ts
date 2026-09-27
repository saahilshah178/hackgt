/*
 * Styles for the story host, scoped under .st-host. Colours come from CSS variables that StoryHost sets from
 * bookColors(palette): --st-desk, --st-paper, --st-ink, --st-accent-ink, --st-ribbon, --st-leather, ...
 */

export const SERIF = `"Iowan Old Style", "Palatino Linotype", Palatino, "Book Antiqua", Georgia, Cambria, "Times New Roman", serif`;

export const STORY_CSS = `
/* the page around a light palette (parchment) is light: keep the board client's own header readable */

.st-host {
  --st-gap: 14px;
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px 18px 0;
  border-radius: 18px;
  color: #f5f3ee;
  background:
    radial-gradient(ellipse 70% 60% at 50% 42%, color-mix(in oklab, var(--st-desk) 78%, #ffd9a0 22%) 0%, transparent 70%),
    repeating-linear-gradient(94deg, rgba(255,255,255,0.025) 0 2px, transparent 2px 11px),
    linear-gradient(180deg, var(--st-desk) 0%, var(--st-desk-edge) 100%);
  box-shadow: inset 0 0 60px rgba(0,0,0,0.45);
}

/* ---- slim header ---- */
.st-bar { display: flex; flex-wrap: wrap; align-items: center; gap: 10px 22px; min-height: 52px; }
.st-bar-chapter { display: flex; flex-direction: column; min-width: 0; flex: 1 1 280px; }
.st-bar-kicker { font-size: 16px; letter-spacing: 0.16em; text-transform: uppercase; opacity: 0.85; font-weight: 700; }
.st-bar-title { font-family: ${SERIF}; font-size: 26px; font-weight: 700; line-height: 1.15; }
.st-bar-threads { display: flex; flex-wrap: wrap; gap: 6px 14px; font-size: 16px; }
.st-bar-threads li { display: flex; align-items: center; gap: 7px; }
.st-bar-swatch { width: 12px; height: 22px; border-radius: 2px 2px 0 0; clip-path: polygon(0 0, 100% 0, 100% 100%, 50% 78%, 0 100%); box-shadow: 0 0 0 1px rgba(255,255,255,0.35) inset; }
.st-bar-count { font-size: 18px; font-variant-numeric: tabular-nums; }
.st-bar-count strong { font-size: 22px; }
.st-tab {
  display: inline-flex; align-items: center; gap: 10px;
  font-family: ${SERIF}; font-size: 19px; font-weight: 700;
  padding: 8px 16px 8px 14px; border-radius: 10px 10px 4px 4px;
  background: var(--st-paper); color: var(--st-ink);
  border-bottom: 4px solid var(--st-ribbon);
  box-shadow: 0 4px 12px rgba(0,0,0,0.35);
  transition: transform 160ms ease;
}
.st-tab:hover { transform: translateY(-2px); }
.st-tab[aria-expanded="true"] { background: var(--st-ribbon); color: #fff8ec; border-bottom-color: var(--st-paper); }
.st-tab-badge { min-width: 28px; height: 28px; padding: 0 6px; display: grid; place-items: center; border-radius: 14px; background: var(--st-ink); color: var(--st-paper); font-family: inherit; font-size: 16px; }
.st-tab[aria-expanded="true"] .st-tab-badge { background: #fff8ec; color: var(--st-ribbon); }
.st-host :focus-visible { outline: 3px solid #ffffff; outline-offset: 3px; box-shadow: 0 0 0 6px #1b1209; }

/* ---- the open book ---- */
.st-book {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1.08fr) minmax(0, 1fr);
  height: clamp(520px, calc(100vh - var(--st-top, 160px) - 74px), 1100px);
  margin-bottom: 56px;
  transition: grid-template-columns 520ms cubic-bezier(.3,.7,.2,1);
  filter: drop-shadow(0 18px 26px rgba(0,0,0,0.5));
}
.st-book::before { content: ""; position: absolute; inset: 6px -8px -8px -8px; border-radius: 18px; background: var(--st-paper-shade); z-index: -1; }
.st-book[data-open="true"] { grid-template-columns: minmax(0, 0.7fr) minmax(0, 1.45fr); }
.st-page {
  position: relative;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  color: var(--st-ink);
  font-family: ${SERIF};
  overflow: hidden;
}
.st-page-left {
  border-radius: 16px 0 0 16px;
  background:
    linear-gradient(to right, transparent 0%, transparent 86%, rgba(80,50,20,0.10) 95%, rgba(60,35,10,0.28) 100%),
    radial-gradient(ellipse at 30% 20%, rgba(255,255,255,0.35), transparent 60%),
    var(--st-paper);
  box-shadow: -3px 3px 0 -1px var(--st-paper-shade), -6px 6px 0 -2px var(--st-paper), -8px 8px 0 -2px var(--st-paper-shade);
}
.st-page-right {
  border-radius: 0 16px 16px 0;
  background:
    linear-gradient(to left, transparent 0%, transparent 88%, rgba(80,50,20,0.10) 95%, rgba(60,35,10,0.26) 100%),
    radial-gradient(ellipse at 70% 15%, rgba(255,255,255,0.35), transparent 60%),
    var(--st-paper);
  box-shadow: 3px 3px 0 -1px var(--st-paper-shade), 6px 6px 0 -2px var(--st-paper), 8px 8px 0 -2px var(--st-paper-shade);
}
.st-scroll { flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; scrollbar-width: thin; scrollbar-color: var(--st-paper-shade) transparent; }
.st-page-left .st-scroll { padding: 8px 40px 40px 46px; }
.st-page-left > .st-page-head { margin: 20px 40px 0 46px; }
.st-page-right .st-scroll { padding: 22px 36px 32px 38px; container-type: inline-size; }
.st-page-head { flex: none; display: flex; align-items: baseline; justify-content: space-between; gap: 12px; padding-bottom: 6px; margin-bottom: 14px; border-bottom: 1px solid color-mix(in oklab, var(--st-ink) 22%, transparent); }
.st-page-label { font-size: 17px; font-variant-caps: all-small-caps; letter-spacing: 0.12em; color: var(--st-ink-soft); font-weight: 700; }
.st-folio { font-size: 16px; color: var(--st-ink-soft); font-style: italic; }

/* ---- ribbons peeking out below the book: one per thread (length = progress) and the bookmark ---- */
.st-ribbons { position: absolute; left: 0; right: 0; bottom: -56px; height: 56px; pointer-events: none; z-index: -1; }
.st-ribbon { position: absolute; top: -8px; width: 20px; clip-path: polygon(0 0, 100% 0, 100% 100%, 50% 80%, 0 100%); transition: height 700ms cubic-bezier(.3,.7,.2,1); box-shadow: inset 0 0 0 1px rgba(255,255,255,0.18); }
.st-ribbon-mark { width: 30px; background: var(--st-ribbon); height: 58px; }

/* ---- the story log ---- */
.st-log { display: flex; flex-direction: column; gap: 18px; }
.st-passage { font-size: 21px; line-height: 1.62; animation: st-fade 700ms ease-out both; }
.st-passage p + p { margin-top: 10px; }
.st-line .st-speaker { font-variant-caps: all-small-caps; letter-spacing: 0.06em; font-weight: 700; color: var(--st-accent-ink); margin-right: 6px; font-size: 1.08em; }
.st-line .st-said { font-style: italic; }
.st-dropcap::first-letter { float: left; font-size: 3.5em; line-height: 0.82; padding: 7px 10px 0 0; color: var(--st-accent-ink); font-weight: 700; }
.st-chapter { text-align: center; padding-top: 14px; }
.st-chapter .st-kicker { display: block; font-size: 17px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--st-ink-soft); font-weight: 700; }
.st-chapter h3 { font-size: 34px; line-height: 1.15; font-weight: 700; margin: 4px 0 6px; }
.st-chapter .st-orn { color: var(--st-accent-ink); display: flex; justify-content: center; margin-bottom: 10px; }
.st-chapter p { text-align: left; }
.st-prologue h3 { font-size: 38px; }
.st-scene { display: flow-root; }
.st-scene .st-scene-art { float: left; margin: 2px 14px 6px 0; color: var(--st-thread, var(--st-accent-ink)); }
.st-scene .st-scene-title { font-weight: 700; color: var(--st-thread, var(--st-accent-ink)); font-size: 22px; line-height: 1.3; margin-bottom: 6px; }
.st-resolved { border-left: 4px solid var(--st-thread, var(--st-accent-ink)); padding-left: 16px; margin-left: 4px; }
.st-return, .st-stumble { font-style: italic; color: var(--st-ink-soft); }
.st-stumble { padding-left: 16px; border-left: 3px dotted color-mix(in oklab, var(--st-ink) 40%, transparent); margin-left: 4px; }
.st-epilogue { text-align: left; padding-top: 12px; border-top: 3px double color-mix(in oklab, var(--st-ink) 45%, transparent); }
.st-epilogue .st-kicker { display: block; text-align: center; font-size: 17px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--st-ink-soft); font-weight: 700; }
.st-epilogue h3 { text-align: center; font-size: 40px; font-weight: 800; margin: 2px 0 10px; }
.st-end-mark { text-align: center; color: var(--st-accent-ink); margin-top: 10px; }

/* ---- the right page: choices ---- */
.st-prompt-title { font-size: 30px; font-weight: 700; line-height: 1.2; }
.st-prompt-sub { font-size: 19px; color: var(--st-ink-soft); font-style: italic; margin: 4px 0 16px; }
.st-choices { display: flex; flex-direction: column; gap: 14px; }
.st-card {
  position: relative; width: 100%; text-align: left;
  display: grid; grid-template-columns: auto 56px minmax(0, 1fr); align-items: start; column-gap: 14px;
  padding: 14px 18px 14px 14px; border-radius: 6px 12px 12px 6px;
  background: linear-gradient(180deg, rgba(255,255,255,0.55), rgba(255,255,255,0.25));
  border: 1px solid color-mix(in oklab, var(--st-ink) 22%, transparent);
  border-left: 8px solid var(--st-thread);
  color: var(--st-ink); font-family: ${SERIF};
  box-shadow: 0 2px 0 color-mix(in oklab, var(--st-ink) 12%, transparent), 0 8px 18px rgba(60,35,10,0.12);
  transition: transform 160ms ease, box-shadow 160ms ease, background 160ms ease;
  animation: st-fade 600ms ease-out both;
  cursor: pointer;
}
.st-card:hover { transform: translateY(-2px) rotate(-0.25deg); background: rgba(255,255,255,0.7); box-shadow: 0 2px 0 color-mix(in oklab, var(--st-ink) 12%, transparent), 0 14px 24px rgba(60,35,10,0.2); }
.st-card:focus-visible { outline: 3px solid var(--st-ink); outline-offset: 3px; box-shadow: 0 0 0 7px color-mix(in oklab, var(--st-thread) 40%, transparent); }
.st-card-key { width: 32px; height: 32px; display: grid; place-items: center; border-radius: 50%; border: 2px solid var(--st-thread); color: var(--st-thread); font-weight: 800; font-size: 18px; font-family: ${SERIF}; margin-top: 4px; }
.st-card-art { color: var(--st-thread); }
.st-card-body { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.st-card-kicker { font-size: 16px; font-variant-caps: all-small-caps; letter-spacing: 0.08em; font-weight: 700; color: var(--st-thread); }
.st-card-verb { font-size: 23px; font-weight: 700; line-height: 1.25; }
.st-card-teaser { font-size: 18px; font-style: italic; color: var(--st-ink-soft); line-height: 1.4; }
.st-card[data-boss="true"] { background: linear-gradient(180deg, color-mix(in oklab, var(--st-boss) 14%, #fff), rgba(255,255,255,0.35)); }

.st-section-label { font-size: 17px; font-variant-caps: all-small-caps; letter-spacing: 0.12em; color: var(--st-ink-soft); font-weight: 700; margin: 22px 0 8px; }
.st-threads { display: flex; flex-direction: column; gap: 10px; }
.st-thread-row { display: grid; grid-template-columns: 150px minmax(0, 1fr); gap: 10px; align-items: start; }
.st-thread-row .st-thread-name { padding-top: 5px; }
.st-thread-name { display: flex; align-items: center; gap: 8px; font-size: 17px; font-weight: 700; color: var(--st-thread); font-variant-caps: all-small-caps; letter-spacing: 0.05em; line-height: 1.1; }
.st-beads { position: relative; display: flex; flex-wrap: wrap; gap: 6px 8px; }
.st-bead { position: relative; display: inline-flex; align-items: center; gap: 6px; padding: 3px 10px 3px 6px; border-radius: 999px; font-size: 16px; line-height: 1.3; border: 1.5px solid color-mix(in oklab, var(--st-thread) 55%, transparent); color: var(--st-ink); background: rgba(255,255,255,0.35); max-width: 100%; }
.st-bead-name { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.st-bead-dot { width: 14px; height: 14px; flex: none; border-radius: 50%; border: 2px solid var(--st-thread); }
.st-bead[data-state="available"] { border-color: var(--st-thread); background: color-mix(in oklab, var(--st-thread) 12%, #fff); font-weight: 700; }
.st-bead[data-state="available"] .st-bead-dot { background: var(--st-thread); box-shadow: 0 0 0 3px color-mix(in oklab, var(--st-thread) 25%, transparent); }
.st-bead[data-state="locked"] { border-style: dashed; color: var(--st-ink-soft); background: transparent; }
.st-bead[data-state="locked"] .st-bead-dot { border-style: dotted; opacity: 0.8; }
.st-bead[data-state="solved"] { background: color-mix(in oklab, var(--st-thread) 85%, #000); color: #fff8ec; border-color: transparent; }
.st-bead[data-state="solved"] .st-bead-dot { border: 0; background: none; width: auto; height: auto; }
.st-bead-check { width: 14px; height: 14px; }
.st-bead-stamp { animation: st-bead-in 700ms cubic-bezier(.2,1.6,.4,1) both; }
.st-keys { margin-top: 20px; font-size: 16px; color: var(--st-ink-soft); }
.st-keys kbd { font-family: inherit; font-size: 15px; padding: 1px 7px; border-radius: 5px; border: 1px solid color-mix(in oklab, var(--st-ink) 35%, transparent); background: rgba(255,255,255,0.5); color: var(--st-ink); }

/* ---- the right page: the challenge as a dark "insert card" ---- */
.st-insert {
  position: relative;
  display: flex; flex-direction: column; gap: 12px;
  padding: 16px 16px 18px;
  border-radius: 14px;
  color: #f5f3ee;
  background:
    radial-gradient(ellipse at 20% 0%, rgba(255,230,190,0.08), transparent 55%),
    var(--st-leather);
  box-shadow: 0 10px 26px rgba(40,22,6,0.45), inset 0 0 0 1px rgba(255,255,255,0.06);
  animation: st-insert-in 420ms cubic-bezier(.2,.8,.2,1) both;
}
.st-insert::before { content: ""; position: absolute; inset: 6px; border: 1.5px dashed rgba(255,236,205,0.22); border-radius: 10px; pointer-events: none; }
.st-insert-head { display: flex; align-items: center; gap: 14px; padding: 4px 6px 0; }
.st-insert-art { color: color-mix(in oklab, var(--st-thread) 45%, #fff3de); flex: none; }
.st-insert-kicker { font-size: 16px; letter-spacing: 0.12em; text-transform: uppercase; font-weight: 700; color: color-mix(in oklab, var(--st-thread) 40%, #ffe7c4); }
.st-insert-title { font-family: ${SERIF}; font-size: 25px; font-weight: 700; line-height: 1.2; }
.st-insert [data-testid="challenge-panel"] { font-family: var(--font-sans, system-ui), sans-serif; }
.st-stamp { position: absolute; right: 26px; top: 14px; width: 150px; height: 64px; color: #e0493a; transform: rotate(-8deg); pointer-events: none; z-index: 3; mix-blend-mode: screen; animation: st-stamp 650ms cubic-bezier(.2,1.4,.4,1) both; filter: drop-shadow(0 0 1px rgba(224,73,58,0.6)); }
@container (max-width: 780px) {
  /* ChallengePanel puts its hint ladder beside the widget from the lg viewport breakpoint: stack it in a narrow page */
  .st-insert .lg\\:flex-row { flex-direction: column; }
  .st-insert .lg\\:w-64 { width: auto; }
}

/* ---- notebook (slides over the left page) ---- */
.st-notebook {
  position: absolute; inset: 0; z-index: 4;
  display: flex; flex-direction: column;
  background:
    repeating-linear-gradient(180deg, transparent 0 33px, color-mix(in oklab, #5a7fa8 30%, transparent) 33px 34px),
    linear-gradient(90deg, transparent 0 58px, rgba(200,60,50,0.45) 58px 60px, transparent 60px),
    #fbf6e9;
  color: #22190f;
  border-radius: 16px 3px 3px 16px;
  animation: st-note-in 380ms cubic-bezier(.2,.8,.2,1) both;
  font-family: ${SERIF};
}
.st-notebook .st-scroll { padding: 22px 30px 30px 76px; }
.st-notebook h3 { font-size: 30px; font-weight: 700; line-height: 34px; }
.st-note-chapter { margin-top: 18px; }
.st-note-chapter h4 { font-size: 18px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--st-ribbon); font-weight: 700; line-height: 34px; }
.st-note-entry { font-size: 19px; line-height: 34px; }
.st-note-entry strong { font-variant-caps: all-small-caps; letter-spacing: 0.04em; margin-right: 6px; }
.st-note-empty { font-size: 18px; font-style: italic; color: #6d5a45; line-height: 34px; }
.st-note-close { position: absolute; top: 14px; right: 16px; z-index: 5; font-size: 17px; padding: 6px 14px; border-radius: 8px; border: 1.5px solid #22190f; background: #fff8ec; color: #22190f; font-family: ${SERIF}; font-weight: 700; }

/* ---- finale ---- */
.st-finale { display: flex; flex-direction: column; gap: 14px; animation: st-fade 700ms ease-out both; }
.st-masthead { text-align: center; border-top: 4px double var(--st-ink); border-bottom: 4px double var(--st-ink); padding: 8px 0 6px; }
.st-masthead-kicker { font-size: 16px; letter-spacing: 0.3em; text-transform: uppercase; font-weight: 700; color: var(--st-ink-soft); }
.st-masthead-title { font-size: 52px; line-height: 1.05; font-weight: 800; letter-spacing: 0.01em; }
.st-finale-lede { font-size: 22px; line-height: 1.5; text-align: center; font-style: italic; }
.st-finale-byline { text-align: center; font-size: 18px; font-style: italic; color: var(--st-ink-soft); }
.st-finale-chapters { display: flex; flex-direction: column; gap: 8px; margin: 6px 0; padding: 12px 0; border-top: 1px solid color-mix(in oklab, var(--st-ink) 25%, transparent); border-bottom: 1px solid color-mix(in oklab, var(--st-ink) 25%, transparent); }
.st-finale-chapters li { display: grid; grid-template-columns: 36px minmax(0, 1fr); column-gap: 12px; align-items: baseline; }
.st-finale-num { grid-row: span 2; width: 32px; height: 32px; display: grid; place-items: center; border-radius: 50%; background: var(--st-ink); color: var(--st-paper); font-weight: 700; font-size: 17px; }
.st-finale-ch { font-size: 22px; font-weight: 700; line-height: 1.2; }
.st-finale-sub { font-size: 17px; color: var(--st-ink-soft); font-style: italic; line-height: 1.35; }
.st-finale-stats { font-size: 18px; color: var(--st-ink-soft); font-style: italic; }
.st-primary { align-self: flex-start; font-family: ${SERIF}; font-size: 22px; font-weight: 700; padding: 12px 26px; border-radius: 10px; background: var(--st-ink); color: var(--st-paper); box-shadow: 0 6px 14px rgba(40,22,6,0.3); }
.st-primary:hover { background: var(--st-ribbon); color: #fff8ec; }
.st-primary:focus-visible { outline: 3px solid var(--st-ribbon); outline-offset: 3px; }

.st-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }

@keyframes st-fade { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
@keyframes st-insert-in { from { opacity: 0; transform: translateY(10px) scale(0.985); } to { opacity: 1; transform: none; } }
@keyframes st-note-in { from { opacity: 0; transform: translateX(-24px); } to { opacity: 1; transform: none; } }
@keyframes st-stamp { 0% { opacity: 0; transform: rotate(-8deg) scale(2.4); } 55% { opacity: 1; transform: rotate(-8deg) scale(0.92); } 100% { opacity: 0.95; transform: rotate(-8deg) scale(1); } }
@keyframes st-bead-in { 0% { transform: scale(1.8) rotate(-12deg); opacity: 0; } 100% { transform: none; opacity: 1; } }

@media (max-width: 1000px) {
  .st-book, .st-book[data-open="true"] { grid-template-columns: minmax(0, 1fr); height: auto; }
  .st-page { max-height: 80vh; }
  .st-page-left { border-radius: 16px 16px 3px 3px; }
  .st-page-right { border-radius: 3px 3px 16px 16px; }
  .st-thread-row { grid-template-columns: minmax(0, 1fr); }
}
@media (prefers-reduced-motion: reduce) {
  .st-host *, .st-host *::before { animation: none !important; transition: none !important; }
}
`;
