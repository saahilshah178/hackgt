/**
 * The Clockwork Crypt dungeon (spec trig_demo_001, /play/fixture-trig) opens on its how-to-play card instead of a
 * loading screen. `?debug` and `?express` (automation) skip it. The side-scroller does not. Plain module: the play
 * page (a Server Component) decides, so SSR already renders it.
 */
export const TRIG_TUTORIAL_SPEC_ID = "trig_demo_001";

type SearchParams = Record<string, string | string[] | undefined>;

function flag(params: SearchParams, name: string): boolean {
  const raw = params[name];
  const v = Array.isArray(raw) ? raw[0] : raw;
  return v === "1" || v === "true";
}

export function wantsTrigTutorial(specId: string, params: SearchParams): boolean {
  return specId === TRIG_TUTORIAL_SPEC_ID && !flag(params, "debug") && !flag(params, "express");
}
