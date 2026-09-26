import type { Widget } from "../../contracts/common";
import type { ComponentType } from "react";
import { Dial } from "./Dial";
import { Order } from "./Order";
import { Pick } from "./Pick";
import { Place } from "./Place";
import { Sort } from "./Sort";
import { Link } from "./Link";
import { Build } from "./Build";
import { Type } from "./Type";
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
};

export function getWidget(id: Widget): ComponentType<AnyWidgetProps> | undefined {
  return WIDGET_REGISTRY[id];
}
