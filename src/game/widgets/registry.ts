import type { Widget } from "../../contracts/common";
import type { ComponentType } from "react";
import { Dial, supports as dialSupports } from "./Dial";
import { Order, supports as orderSupports } from "./Order";
import { Pick, supports as pickSupports } from "./Pick";
import { Place, supports as placeSupports } from "./Place";
import { Sort, supports as sortSupports } from "./Sort";
import { Link, supports as linkSupports } from "./Link";
import { Build, supports as buildSupports } from "./Build";
import { Type, supports as typeSupports } from "./Type";
import { Explain, supports as explainSupports } from "./Explain";
import { Fallback } from "./Fallback";
import type { WidgetProps } from "./Dial";

/**
 * Widget id -> component. A family mode's `view` is passed straight through; the component returns
 * whatever shape that mode's `grade()` expects via `onSubmit`.
 */
export type AnyWidgetProps = WidgetProps<unknown, unknown>;

export const WIDGET_REGISTRY: Partial<Record<Widget, ComponentType<AnyWidgetProps>>> = {
  dial: Dial as ComponentType<AnyWidgetProps>,
  pick: Pick as ComponentType<AnyWidgetProps>,
  order: Order as ComponentType<AnyWidgetProps>,
  place: Place as ComponentType<AnyWidgetProps>,
  sort: Sort as ComponentType<AnyWidgetProps>,
  link: Link as ComponentType<AnyWidgetProps>,
  build: Build as ComponentType<AnyWidgetProps>,
  type: Type as ComponentType<AnyWidgetProps>,
  explain: Explain as ComponentType<AnyWidgetProps>,
};

/** Each registered widget's `supports(view)` predicate, checked before it's ever mounted (reviewer
 * finding C1: a widget that duck-types a view shape and falls through to the wrong one crashes the play
 * page). Keyed the same as WIDGET_REGISTRY. */
const WIDGET_SUPPORTS: Partial<Record<Widget, (view: unknown) => boolean>> = {
  dial: dialSupports,
  pick: pickSupports,
  order: orderSupports,
  place: placeSupports,
  sort: sortSupports,
  link: linkSupports,
  build: buildSupports,
  type: typeSupports,
  explain: explainSupports,
};

export function getWidget(id: Widget): ComponentType<AnyWidgetProps> | undefined {
  return WIDGET_REGISTRY[id];
}

/**
 * The component GameClient should actually mount for this mode's widget id and the view it just
 * `present()`-ed. Never returns undefined and never mounts a component against a view shape it doesn't
 * recognize: an unregistered widget id, or a registered one whose `supports(view)` says no, renders the
 * visible "isn't built yet" Fallback card (with its Skip button) instead of crashing.
 */
export function widgetFor(id: Widget, view: unknown): ComponentType<AnyWidgetProps> {
  const Component = WIDGET_REGISTRY[id];
  const supports = WIDGET_SUPPORTS[id];
  if (Component && supports && supports(view)) return Component;
  return Fallback as ComponentType<AnyWidgetProps>;
}
