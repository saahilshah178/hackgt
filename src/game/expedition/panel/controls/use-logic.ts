"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";

/**
 * Control state held in a ref (so rapid events never read a stale value) mirrored into React state for rendering.
 * `apply(fn)` computes the next state, renders it and hands it to `emit` synchronously: controls emit drafts from
 * the user's own actions only, never from mount effects (an untouched station keeps the idle pose).
 */
export function useLogicState<S>(init: () => S, emit: (s: S) => void): [S, (fn: (s: S) => S) => void, (s: S) => void] {
  const [state, setState] = useState<S>(init);
  const ref = useRef<S>(state);
  const emitRef = useRef(emit);
  useLayoutEffect(() => {
    emitRef.current = emit;
  });
  const apply = useCallback((fn: (s: S) => S) => {
    const next = fn(ref.current);
    if (Object.is(next, ref.current)) return;
    ref.current = next;
    setState(next);
    emitRef.current(next);
  }, []);
  /** replace without emitting (restores) */
  const reset = useCallback((s: S) => {
    ref.current = s;
    setState(s);
  }, []);
  return [state, apply, reset];
}
