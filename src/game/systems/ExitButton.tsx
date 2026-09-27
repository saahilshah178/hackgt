"use client";

import { useState, type CSSProperties } from "react";
import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const EXIT_LABEL = "Exit game and return to the home page";
const EXIT_CLASS =
  "inline-flex h-10 shrink-0 items-center gap-2 rounded-lg border px-3 text-base font-semibold hover:opacity-80 focus-visible:outline-2 focus-visible:outline-current";
/** currentColor-based so the button reads on any palette background as well as on themed pages. */
const EXIT_STYLE: CSSProperties = {
  fontSize: 16,
  background: "color-mix(in oklab, currentColor 10%, transparent)",
  borderColor: "color-mix(in oklab, currentColor 30%, transparent)",
};

export interface ExitButtonProps {
  className?: string;
  style?: CSSProperties;
  /**
   * When true (mid-run), clicking opens a confirmation dialog before leaving, because exiting discards
   * the run's progress. When false (end screen, error page) the button is a plain link home.
   */
  confirm?: boolean;
  /** Fires as the confirmation dialog opens and closes, so a host can pause the world while it is up. */
  onConfirmOpenChange?: (open: boolean) => void;
}

/**
 * Top-left "Exit" control shown on every game screen (legacy and Expedition play, the end screen and the
 * "can't be played" page), so a player can always get back to the home page (PDF upload + showcase games)
 * without the browser's back button.
 */
export function ExitButton({ className = "", style, confirm = false, onConfirmOpenChange }: ExitButtonProps) {
  const [open, setOpenState] = useState(false);
  const setOpen = (next: boolean) => {
    setOpenState(next);
    onConfirmOpenChange?.(next);
  };
  const merged = style ? { ...EXIT_STYLE, ...style } : EXIT_STYLE;

  if (!confirm) {
    return (
      <Link href="/" aria-label={EXIT_LABEL} data-testid="exit-game" className={`${EXIT_CLASS} ${className}`} style={merged}>
        <ArrowLeftIcon className="size-5" aria-hidden />
        Exit
      </Link>
    );
  }

  return (
    <>
      <button
        type="button"
        aria-label={EXIT_LABEL}
        aria-haspopup="dialog"
        data-testid="exit-game"
        className={`${EXIT_CLASS} ${className}`}
        style={merged}
        onClick={() => setOpen(true)}
      >
        <ArrowLeftIcon className="size-5" aria-hidden />
        Exit
      </button>

      <Dialog open={open} onOpenChange={(next) => setOpen(next)}>
        <DialogContent showCloseButton={false} data-testid="exit-confirm">
          <DialogHeader>
            <DialogTitle className="text-xl" style={{ fontSize: 20 }}>
              Exit this game?
            </DialogTitle>
            <DialogDescription className="text-base" style={{ fontSize: 16 }}>
              Your progress in this run will be lost. You&apos;ll go back to the home page with the upload panel and the showcase games.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" size="lg" className="h-11 px-5 text-base" style={{ fontSize: 16 }} onClick={() => setOpen(false)} data-testid="exit-cancel">
              Keep playing
            </Button>
            <Link href="/" className={buttonVariants({ size: "lg", className: "h-11 px-5 text-base" })} style={{ fontSize: 16 }} data-testid="exit-confirm-link">
              Exit game
            </Link>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
