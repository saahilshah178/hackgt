"use client";

import { createElement, useMemo } from "react";
import { getMode } from "@/mechanics/registry";
import { widgetFor } from "@/game/widgets/registry";
import type { ControlProps } from "../types";

/**
 * WidgetControl (§3.3): every mode without a native instrument (console_slate, and any view a control rejects)
 * mounts its existing widget inside the panel. The widget gets the instrument theme through `.xp-panel .widget`
 * overrides, reports drafts through `onDraft` (the console slate mirrors it), and its own "Lock in" button stays
 * the submit (restyled as Verify), so grading paths are shared with the legacy hosts.
 */
export function WidgetControl(p: ControlProps) {
  const Widget = useMemo(() => {
    const dot = p.modeKey.indexOf(".");
    const mode = getMode(p.modeKey.slice(0, dot), p.modeKey.slice(dot + 1));
    return mode ? widgetFor(mode.widget, p.view) : null;
  }, [p.modeKey, p.view]);
  return (
    <div className="xp-slot" data-grow={2} data-card="widget" data-testid="widget-control" style={{ flexGrow: 2 }}>
      <div className="xp-card">
        <div className="xp-card-html widget" aria-describedby={p.describedBy}>
          {Widget ? (
            // widgetFor is a static registry lookup (never a new component type per render)
            createElement(Widget, {
              view: p.view,
              disabled: p.disabled,
              onSubmit: p.onSubmitInput,
              onDraft: (d) => p.onChange({ input: d.input, complete: d.complete, focus: d.focus, hover: null, settled: true, wave: null, marks: null }),
            })
          ) : (
            <p className="xp-hint">This station&apos;s instrument is not available.</p>
          )}
        </div>
      </div>
    </div>
  );
}
