/*
 * Styles for the teaching layer (LessonCard, LessonBody, FieldGuide, the review link), scoped under .tg-* and injected
 * once by GenreClient. Palette-aware through --tg-accent (set from palette.css.accent on the board client): the accent
 * only ever decorates (borders, ribbons, markers); text is always dark ink on paper or light ink on the dark drawer, so
 * every palette keeps projector contrast.
 */

const SERIF = `"Iowan Old Style", "Palatino Linotype", Palatino, "Book Antiqua", Georgia, Cambria, "Times New Roman", serif`;
const MONO = `ui-monospace, SFMono-Regular, Menlo, Consolas, "Courier New", monospace`;

export const TEACH_CSS = `
/* ---- shared body (card on paper, entry in the dark drawer) ---- */
.tg-body { display: flex; flex-direction: column; gap: 14px; color: var(--tg-ink); }
.tg-big { font-size: 22px; font-weight: 700; line-height: 1.35; }
.tg-expl { font-size: 19px; line-height: 1.5; }
.tg-label { font-size: 15px; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; color: var(--tg-soft); margin-bottom: 6px; }
.tg-points { display: flex; flex-direction: column; gap: 8px; padding: 0; margin: 0; list-style: none; }
.tg-points li { position: relative; padding-left: 26px; font-size: 19px; line-height: 1.45; }
.tg-points li::before { content: ""; position: absolute; left: 4px; top: 0.55em; width: 10px; height: 10px; border-radius: 2px; transform: rotate(45deg); background: var(--tg-mark); }
.tg-cite { display: inline-block; margin-left: 8px; padding: 0 7px; border-radius: 6px; font-size: 15px; font-weight: 700; white-space: nowrap; vertical-align: 2px; border: 1.5px solid var(--tg-rule); color: var(--tg-soft); }
.tg-quote { display: block; margin-top: 4px; padding-left: 12px; border-left: 3px solid var(--tg-rule); font-size: 17px; font-style: italic; color: var(--tg-soft); }
.tg-formula { display: flex; flex-direction: column; gap: 4px; padding: 10px 14px; border-radius: 10px; background: var(--tg-well); border: 2px solid var(--tg-rule); }
.tg-formula .tg-label { margin-bottom: 0; }
.tg-math { font-family: ${SERIF}; font-size: 28px; font-weight: 600; line-height: 1.25; letter-spacing: 0.01em; overflow-wrap: anywhere; }
.tg-example p { font-size: 19px; line-height: 1.5; white-space: pre-line; }
.tg-example { padding: 10px 14px; border-radius: 10px; background: var(--tg-well); }
.tg-watch { padding: 10px 14px; border-radius: 10px; border: 2px dashed var(--tg-warn-rule); background: var(--tg-warn-bg); }
.tg-watch p { font-size: 19px; line-height: 1.45; display: flex; gap: 10px; align-items: baseline; }
.tg-watch p + p { margin-top: 6px; }
.tg-watch .tg-x, .tg-watch .tg-ok { flex: none; font-weight: 900; width: 1.1em; text-align: center; }
.tg-watch .tg-x { color: var(--tg-bad); }
.tg-watch .tg-ok { color: var(--tg-good); }
.tg-watch .tg-mistake { text-decoration: line-through; text-decoration-thickness: 2px; text-decoration-color: color-mix(in oklab, var(--tg-bad) 70%, transparent); }
@container tg (min-width: 760px) {
  .tg-body[data-wide="true"] { display: grid; grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr); column-gap: 26px; align-items: start; }
  .tg-body[data-wide="true"] > .tg-col { display: flex; flex-direction: column; gap: 14px; }
}
.tg-col { display: contents; }

/* ---- the lesson card (paper, dark ink) ---- */
.tg-card {
  container: tg / inline-size;
  --tg-ink: #251a10; --tg-soft: #5b4a36; --tg-rule: rgba(60,40,20,0.35); --tg-well: rgba(255,255,255,0.55);
  --tg-mark: color-mix(in oklab, var(--tg-accent, #8a5a2b) 65%, #2a1d12);
  --tg-warn-rule: #b7791f; --tg-warn-bg: rgba(255,214,120,0.28); --tg-bad: #a4221a; --tg-good: #1f6e2a;
  position: relative; display: flex; flex-direction: column; gap: 16px;
  padding: 18px 20px 20px; border-radius: 14px; color: var(--tg-ink);
  background: #f7f0df;
  box-shadow: 0 10px 24px rgba(0,0,0,0.35);
  animation: tg-in 360ms cubic-bezier(.2,.8,.2,1) both;
}
.tg-head { display: flex; gap: 14px; align-items: flex-start; }
.tg-avatar { flex: none; width: 58px; height: 58px; border-radius: 50%; display: grid; place-items: center; font-size: 28px; font-weight: 800; color: #fff8ec; background: #3a2a1a; box-shadow: 0 0 0 4px var(--tg-accent, #8a5a2b), 0 0 0 6px rgba(0,0,0,0.25); }
.tg-kicker { font-size: 15px; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; color: var(--tg-soft); }
.tg-title { font-size: 27px; font-weight: 800; line-height: 1.15; margin-top: 2px; }
.tg-byline { font-size: 18px; font-style: italic; color: var(--tg-soft); margin-top: 4px; }
.tg-signoff { font-size: 19px; font-style: italic; text-align: right; color: var(--tg-soft); }
.tg-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; padding-top: 4px; }
.tg-go { display: inline-flex; align-items: center; gap: 10px; padding: 10px 22px; border-radius: 10px; font-size: 20px; font-weight: 800; color: #fffaf0; background: #2a1d12; box-shadow: 0 0 0 3px var(--tg-accent, #8a5a2b); }
.tg-go:hover { filter: brightness(1.2); }
.tg-go kbd, .tg-guide kbd, .tg-guide-btn kbd { font-family: inherit; font-size: 14px; font-weight: 700; padding: 1px 7px; border-radius: 5px; border: 1.5px solid currentColor; opacity: 0.85; }
.tg-leave { padding: 9px 16px; border-radius: 10px; font-size: 18px; font-weight: 600; color: var(--tg-ink); border: 2px solid var(--tg-rule); background: transparent; }
.tg-leave:hover { background: rgba(0,0,0,0.06); }
.tg-later { flex-basis: 100%; font-size: 16px; color: var(--tg-soft); }
.tg-card :focus-visible { outline: 3px solid #1a4fd6; outline-offset: 3px; }

/* looks: one per host genre */
.tg-card[data-look="sign"] {
  background:
    repeating-linear-gradient(0deg, rgba(120,80,40,0.07) 0 2px, transparent 2px 9px),
    linear-gradient(180deg, #f1dfb8, #e8d1a2);
  border: 5px solid #6b4a2b; border-radius: 8px;
  box-shadow: 0 10px 24px rgba(0,0,0,0.4), inset 0 0 0 2px rgba(255,240,210,0.5);
}
.tg-card[data-look="sign"]::before, .tg-card[data-look="sign"]::after { content: ""; position: absolute; top: 8px; width: 10px; height: 10px; border-radius: 50%; background: radial-gradient(circle at 35% 35%, #d9d2c3, #5d5446); }
.tg-card[data-look="sign"]::before { left: 8px; }
.tg-card[data-look="sign"]::after { right: 8px; }
.tg-card[data-look="note"] {
  background:
    linear-gradient(90deg, transparent 0 34px, rgba(214,90,90,0.35) 34px 36px, transparent 36px),
    repeating-linear-gradient(180deg, transparent 0 31px, rgba(90,120,170,0.18) 31px 32px),
    #fffaf0;
  padding-left: 48px;
  border-top: 8px solid var(--tg-accent, #8a5a2b);
}
.tg-card[data-look="casefile"] {
  background: linear-gradient(180deg, #f5e6bf, #efdcae);
  border-radius: 4px 14px 14px 14px;
  margin-top: 16px;
}
.tg-card[data-look="casefile"]::before { content: ""; position: absolute; left: 0; top: -16px; width: 170px; height: 18px; border-radius: 8px 8px 0 0; background: #f5e6bf; }
.tg-card[data-look="casefile"] .tg-title, .tg-card[data-look="casefile"] .tg-kicker { font-family: ${MONO}; }
.tg-card[data-look="casefile"] .tg-avatar { border-radius: 8px; }
.tg-card[data-look="letter"] {
  font-family: ${SERIF};
  background: radial-gradient(ellipse at 30% 10%, rgba(255,255,255,0.6), transparent 60%), #f6ecd6;
  border: 1px solid rgba(90,60,20,0.25);
}
.tg-card[data-look="letter"] .tg-big { font-size: 23px; }
.tg-card[data-look="letter"] .tg-avatar { background: #7a2e1f; }

/* ---- inline help under a wrong answer (dark result box, light ink) ---- */
.tg-inline-watch { display: flex; flex-direction: column; gap: 4px; padding: 10px 14px; border-radius: 10px; background: rgba(0,0,0,0.35); border-left: 5px solid #ffcc66; font-size: 18px; line-height: 1.45; }
.tg-inline-watch strong { color: #ffe3a3; }
.tg-review { align-self: flex-start; display: inline-flex; align-items: center; gap: 8px; font-size: 18px; font-weight: 700; text-decoration: underline; text-underline-offset: 4px; text-decoration-thickness: 2px; color: inherit; background: none; padding: 2px 0; }
.tg-review:hover { text-decoration-thickness: 3px; }

/* ---- the header button ---- */
.tg-guide-btn { display: inline-flex; align-items: center; gap: 8px; }

/* ---- the Field Guide drawer (native modal dialog) ---- */
.tg-guide {
  --tg-ink: #f5f3ee; --tg-soft: #cdc6b8; --tg-rule: rgba(255,255,255,0.28); --tg-well: rgba(255,255,255,0.06);
  --tg-mark: color-mix(in oklab, var(--tg-accent, #ffb84d) 70%, #ffffff);
  --tg-warn-rule: #ffcc66; --tg-warn-bg: rgba(255,204,102,0.08); --tg-bad: #ff8a80; --tg-good: #9be39f;
  position: fixed; inset: 0 0 0 auto; margin: 0; padding: 0;
  width: min(760px, 100vw); max-width: 100vw; height: 100dvh; max-height: 100dvh;
  border: none; border-left: 5px solid var(--tg-accent, #ffb84d);
  background: #14161c; color: var(--tg-ink);
  overflow-y: auto; overscroll-behavior: contain;
  box-shadow: -20px 0 50px rgba(0,0,0,0.55);
}
.tg-guide[open] { animation: tg-drawer 280ms cubic-bezier(.2,.8,.2,1) both; }
.tg-guide::backdrop { background: rgba(0,0,0,0.55); }
.tg-guide :focus-visible { outline: 3px solid #ffffff; outline-offset: 3px; }
.tg-guide-head { position: sticky; top: 0; z-index: 2; display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; padding: 20px 24px 14px; background: #14161c; border-bottom: 1px solid rgba(255,255,255,0.12); }
.tg-guide-title { font-size: 30px; font-weight: 800; line-height: 1.1; display: flex; align-items: center; gap: 12px; }
.tg-guide-sub { font-size: 18px; color: var(--tg-soft); margin-top: 4px; }
.tg-guide-count { font-size: 17px; margin-top: 6px; }
.tg-guide-close { flex: none; padding: 8px 16px; border-radius: 10px; font-size: 18px; font-weight: 700; border: 2px solid rgba(255,255,255,0.45); }
.tg-guide-close:hover { background: rgba(255,255,255,0.08); }
.tg-jump { display: flex; flex-wrap: wrap; gap: 8px; padding: 14px 24px 0; }
.tg-jump-btn { padding: 4px 12px; border-radius: 999px; font-size: 16px; font-weight: 600; border: 1.5px solid rgba(255,255,255,0.3); color: var(--tg-ink); }
.tg-jump-btn[data-state="learned"] { border-color: #66bb6a; }
.tg-jump-btn:hover { background: rgba(255,255,255,0.08); }
.tg-guide-list { display: flex; flex-direction: column; gap: 16px; padding: 18px 24px 40px; list-style: none; margin: 0; }
.tg-entry { container: tg / inline-size; padding: 16px 18px 18px; border-radius: 14px; background: #1d2029; border: 2px solid rgba(255,255,255,0.08); scroll-margin-top: 160px; }
.tg-entry[data-current="true"] { border-color: var(--tg-accent, #ffb84d); box-shadow: 0 0 0 3px color-mix(in oklab, var(--tg-accent, #ffb84d) 35%, transparent); }
.tg-entry-head { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; margin-bottom: 12px; }
.tg-entry-name { font-size: 25px; font-weight: 800; line-height: 1.2; flex: 1 1 260px; }
.tg-entry-name:focus { outline: none; }
.tg-entry-name:focus-visible { outline: 3px solid #ffffff; outline-offset: 4px; border-radius: 4px; }
.tg-tag { display: inline-flex; align-items: center; gap: 6px; padding: 2px 10px; border-radius: 999px; font-size: 15px; font-weight: 800; letter-spacing: 0.04em; white-space: nowrap; }
.tg-tag[data-kind="learned"] { background: #2e7d32; color: #ffffff; }
.tg-tag[data-kind="new"] { border: 1.5px dashed rgba(255,255,255,0.45); color: #d9d3c7; }
.tg-tag[data-kind="now"] { background: color-mix(in oklab, var(--tg-accent, #ffb84d) 40%, #14161c); color: #ffffff; border: 1.5px solid var(--tg-accent, #ffb84d); }
.tg-entry-by { margin-top: 12px; font-size: 16px; color: var(--tg-soft); font-style: italic; }

@keyframes tg-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
@keyframes tg-drawer { from { transform: translateX(40px); opacity: 0.4; } to { transform: none; opacity: 1; } }
@media (prefers-reduced-motion: reduce) {
  .tg-card, .tg-guide[open] { animation: none !important; }
}
`;
