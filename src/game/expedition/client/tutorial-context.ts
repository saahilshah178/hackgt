"use client";
/**
 * Whether the trig how-to-play card is up. While it is, loading placeholders stay hidden (the card replaces them), the
 * host is frozen, and the intro waits for it to close.
 */
import { createContext, useContext } from "react";

export interface TutorialGate {
  open: boolean;
  close: () => void;
}

export const TutorialContext = createContext<TutorialGate>({ open: false, close: () => {} });

export const useTutorial = (): TutorialGate => useContext(TutorialContext);
