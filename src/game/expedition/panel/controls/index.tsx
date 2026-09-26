"use client";

import type { ControlKind } from "@/world/types";
import type { ControlProps } from "../types";
import { AimControl } from "./AimControl";
import { CableControl } from "./CableControl";
import { MatrixControl } from "./MatrixControl";
import { RouterControl } from "./RouterControl";
import { SlotRailControl } from "./SlotRailControl";
import { TubeControl } from "./TubeControl";
import { WaveControl } from "./WaveControl";
import { WidgetControl } from "./WidgetControl";

export { controlKindForMode, resolveControlKind, SURFACE_KIND, supports } from "./kinds";

/**
 * The control slot (§3.3 `controlFor`): the instrument control for `kind` (already resolved against the view by
 * resolveControlKind). "scrub" renders nothing here: the Scrubber lives in the panel's ruler row.
 */
export function ControlView({ kind, ...p }: ControlProps & { kind: ControlKind; shadeCounts?: boolean; initialMarks?: readonly { clueIndex: number; hypothesisId: string }[] | null }) {
  const props = { ...p, kind };
  switch (kind) {
    case "scrub":
      return null;
    case "aim":
      return <AimControl {...props} />;
    case "slots":
      return <SlotRailControl {...props} />;
    case "bins":
      return <RouterControl {...props} />;
    case "waves":
      return <WaveControl {...props} />;
    case "cables":
      return <CableControl {...props} />;
    case "tubes":
      return <TubeControl {...props} />;
    case "matrix":
      return <MatrixControl {...props} />;
    case "widget":
      return <WidgetControl {...props} />;
  }
}
