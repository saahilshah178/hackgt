import type { TeachingMechanic } from "../contracts/library";
import { getMode } from "../mechanics/registry";

export function interactionFor(card: TeachingMechanic): string {
  return getMode(card.family, card.mode)?.widget ?? `${card.family}.${card.mode}`;
}

/** Preserve relevance while giving the director genuinely different actions to choose from. */
export function diverseCards<T extends { card: TeachingMechanic; score: number }>(ranked: readonly T[], count: number): T[] {
  const remaining = [...ranked];
  const chosen: T[] = [];
  const used = new Map<string, number>();
  while (remaining.length && chosen.length < count) {
    let best = 0;
    const score = (item: T) => item.score - 2 * (used.get(interactionFor(item.card)) ?? 0);
    for (let i = 1; i < remaining.length; i++) if (score(remaining[i]) > score(remaining[best])) best = i;
    const [item] = remaining.splice(best, 1);
    if (chosen.some(c => c.card.id === item.card.id)) continue;
    chosen.push(item);
    const action = interactionFor(item.card);
    used.set(action, (used.get(action) ?? 0) + 1);
  }
  return chosen;
}

/** Only demand variety the topic's supplied menu can actually support. */
export function varietyProblems(cards: readonly TeachingMechanic[], menu: readonly TeachingMechanic[]): string[] {
  if (cards.length < 5) return [];
  const available = new Set(menu.map(interactionFor));
  const actions = cards.map(interactionFor);
  const problems: string[] = [];
  const required = Math.min(3, available.size);
  if (new Set(actions).size < required) problems.push(`Use at least ${required} different interaction types from the menu (build, link, order, sort, place, type, etc.).`);
  if ([...available].some(action => action !== "dial" && action !== "pick") && actions.filter(action => action === "dial" || action === "pick").length > Math.floor(cards.length / 2)) {
    problems.push("At most half of encounters may use dial/pick combined; replace the rest with constructive or reasoning interactions from the menu.");
  }
  if (available.size > 1 && actions.some((action, i) => i >= 2 && action === actions[i - 1] && action === actions[i - 2])) {
    problems.push(`Do not repeat the same interaction type three times in a row. Current sequence: ${actions.join(", ")}.`);
  }
  return problems;
}
