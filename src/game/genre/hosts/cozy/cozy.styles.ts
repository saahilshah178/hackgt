/**
 * Scoped styles for the cozy host (every class is prefixed `cz-`). Animated SVG parts carry `cz-anim` so
 * prefers-reduced-motion stops them all; one-shot effects (coin float, hearts) are hidden instead.
 */
export const COZY_CSS = `
.cz-root { font-family: ui-rounded, "SF Pro Rounded", "Nunito", "Segoe UI", system-ui, sans-serif; }
.cz-root .cz-btn { transition: transform .12s ease, filter .12s ease; }
.cz-root .cz-btn:not(:disabled):hover { filter: brightness(1.08); transform: translateY(-1px); }
.cz-root :focus-visible { outline: 3px solid #1f1c14; outline-offset: 2px; box-shadow: 0 0 0 7px #ffd36b; }
@keyframes cz-bob { 0%,100% { transform: translateY(0) rotate(-2deg) } 50% { transform: translateY(-4px) rotate(2deg) } }
.cz-boat { animation: cz-bob 4.2s ease-in-out infinite; transform-box: fill-box; transform-origin: 50% 100%; }
@keyframes cz-smoke { 0% { transform: translate(0,0) scale(.5); opacity: 0 } 15% { opacity: .75 } 100% { transform: translate(10px,-38px) scale(1.9); opacity: 0 } }
.cz-smoke { animation: cz-smoke 3.6s ease-out infinite; transform-box: fill-box; transform-origin: center; opacity: 0; }
@keyframes cz-drift { from { transform: translateX(-36px) } to { transform: translateX(36px) } }
.cz-cloud { animation: cz-drift 26s ease-in-out infinite alternate; }
@keyframes cz-pop { 0% { transform: scale(.2); opacity: 0 } 60% { transform: scale(1.14); opacity: 1 } 100% { transform: scale(1) } }
.cz-pop { animation: cz-pop .7s cubic-bezier(.3,1.4,.5,1) both; transform-box: fill-box; transform-origin: 50% 100%; }
@keyframes cz-celebrate { 0% { transform: scale(1) } 30% { transform: scale(1.14,.9) } 55% { transform: scale(.95,1.08) } 100% { transform: scale(1) } }
.cz-celebrate { animation: cz-celebrate .9s ease-out; transform-box: fill-box; transform-origin: 50% 100%; }
@keyframes cz-heart { 0% { transform: translateY(0) scale(.4); opacity: 0 } 20% { opacity: 1 } 100% { transform: translateY(-44px) scale(1.15); opacity: 0 } }
.cz-heart { animation: cz-heart 1.9s ease-out both; transform-box: fill-box; transform-origin: center; }
@keyframes cz-bubble { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-4px) } }
.cz-bubble { animation: cz-bubble 2.4s ease-in-out infinite; }
@keyframes cz-float { 0% { transform: translateY(0); opacity: 0 } 15% { opacity: 1 } 100% { transform: translateY(-38px); opacity: 0 } }
.cz-float { animation: cz-float 1.9s ease-out forwards; }
@keyframes cz-wobble { 0%,100% { transform: rotate(0) } 20% { transform: rotate(-8deg) } 40% { transform: rotate(7deg) } 60% { transform: rotate(-4deg) } 80% { transform: rotate(2deg) } }
.cz-wobble { animation: cz-wobble .9s ease-in-out; }
@keyframes cz-twinkle { 0%,100% { opacity: .3 } 50% { opacity: .75 } }
.cz-twinkle { animation: cz-twinkle 2.2s ease-in-out infinite; }
@keyframes cz-firework { 0% { transform: scale(.1); opacity: 0 } 10% { opacity: 1 } 70% { opacity: .9 } 100% { transform: scale(1.1); opacity: 0 } }
.cz-firework { animation: cz-firework 2.6s ease-out infinite both; transform-box: fill-box; transform-origin: center; }
@keyframes cz-beam { 0%,100% { opacity: .15 } 50% { opacity: .4 } }
.cz-beam { animation: cz-beam 3s ease-in-out infinite; }
@keyframes cz-wave { from { transform: translateX(0) } to { transform: translateX(-40px) } }
.cz-wave { animation: cz-wave 6s ease-in-out infinite alternate; }
@keyframes cz-rise { from { opacity: 0; transform: translateY(14px) } to { opacity: 1; transform: none } }
.cz-rise { animation: cz-rise .4s ease-out both; }
@media (prefers-reduced-motion: reduce) {
  .cz-root .cz-anim, .cz-root .cz-rise, .cz-root .cz-btn { animation: none !important; transition: none !important; }
  .cz-root .cz-smoke { opacity: .45; }
  .cz-root .cz-float, .cz-root .cz-heart { display: none; }
  .cz-root .cz-firework { opacity: 1; }
}
`;
