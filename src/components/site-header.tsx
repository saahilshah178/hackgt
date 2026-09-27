"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { BookOpenCheck, ChevronDown, GraduationCap, Menu, Sparkles, UserRound, X } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Home", match: (p: string) => p === "/" },
  { href: "/#start", label: "New lesson", match: (p: string) => p.startsWith("/intake") || p.startsWith("/forge") },
  { href: "/#examples", label: "Examples", match: (p: string) => p.startsWith("/learn") || p.startsWith("/debrief") },
];

function AccountMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls="account-menu"
        onClick={() => setOpen((v) => !v)}
        className="flex h-10 items-center gap-2 rounded-full border border-border bg-card py-1 pr-3 pl-1 text-sm font-medium transition-colors hover:border-brand hover:bg-accent"
      >
        <span className="flex size-8 items-center justify-center rounded-full bg-brand-soft text-accent-foreground">
          <UserRound className="size-4" aria-hidden />
        </span>
        <span className="hidden lg:inline">Guest</span>
        <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", open && "rotate-180")} aria-hidden />
        <span className="sr-only">Account menu</span>
      </button>
      {open && (
        <div
          id="account-menu"
          role="menu"
          className="absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-2xl border border-border bg-popover p-2 shadow-lg shadow-sky-900/5"
        >
          <div className="px-3 py-2">
            <p className="text-sm font-semibold">Guest learner</p>
            <p className="text-xs text-muted-foreground">Progress is saved in this browser tab.</p>
          </div>
          <div className="my-1 h-px bg-border" />
          {[
            { href: "/#examples", label: "Example games", icon: BookOpenCheck },
            { href: "/#start", label: "Start a new lesson", icon: Sparkles },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
            >
              <item.icon className="size-4 text-muted-foreground" aria-hidden />
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export function SiteHeader({ appName, wide = false }: { appName: string; wide?: boolean }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setMobileOpen(false);
  }

  return (
    <div className="sticky top-0 z-40 border-b border-border/80 bg-card/85 backdrop-blur-md supports-[backdrop-filter]:bg-card/75">
      <nav aria-label="Main" className={cn("mx-auto flex h-16 w-full items-center gap-4 px-4 sm:px-6", wide ? "max-w-[1400px]" : "max-w-7xl")}>
        <Link href="/" className="flex shrink-0 items-center gap-2.5 rounded-lg">
          <span className="flex size-9 items-center justify-center rounded-xl bg-brand text-white shadow-sm shadow-sky-500/30">
            <GraduationCap className="size-5" aria-hidden />
          </span>
          <span className="text-lg font-extrabold tracking-tight">{appName}</span>
        </Link>

        <ul className="ml-4 hidden items-center gap-1 md:flex">
          {NAV.map((item) => {
            const active = item.match(pathname);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "rounded-full px-3.5 py-2 text-sm font-semibold transition-colors",
                    active ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                  )}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>

        <div className="ml-auto flex items-center gap-2">
          <AccountMenu />
          <button
            type="button"
            className="flex size-10 items-center justify-center rounded-full border border-border bg-card md:hidden"
            aria-expanded={mobileOpen}
            aria-controls="mobile-nav"
            onClick={() => setMobileOpen((v) => !v)}
          >
            {mobileOpen ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
            <span className="sr-only">{mobileOpen ? "Close menu" : "Open menu"}</span>
          </button>
        </div>
      </nav>

      {mobileOpen && (
        <div id="mobile-nav" className="border-t border-border bg-card px-4 pt-3 pb-5 md:hidden">
          <ul className="flex flex-col gap-1">
            {NAV.map((item) => {
              const active = item.match(pathname);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "block rounded-xl px-4 py-3 text-base font-semibold",
                      active ? "bg-accent text-accent-foreground" : "hover:bg-secondary",
                    )}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
