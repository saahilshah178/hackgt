import Link from "next/link";
import { GraduationCap } from "lucide-react";
import { APP_NAME, APP_TAGLINE } from "@/config";
import { MockBanner } from "@/components/mock-banner";
import { SiteHeader } from "@/components/site-header";
import { cn } from "@/lib/utils";

/** Header + content frame shared by every page except the game itself. */
export function AppShell({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
  const width = wide ? "max-w-[1400px]" : "max-w-7xl";
  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#main"
        className="sr-only z-50 rounded-full bg-primary px-4 py-2 font-semibold text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>
      <header>
        <SiteHeader appName={APP_NAME} wide={wide} />
        <MockBanner />
      </header>
      <main id="main" className={cn("mx-auto w-full flex-1 px-4 py-8 sm:px-6 sm:py-10", width)}>
        {children}
      </main>
      <footer className="border-t border-border bg-card">
        <div className={cn("mx-auto flex w-full flex-col gap-6 px-4 py-10 sm:px-6 md:flex-row md:items-start md:justify-between", width)}>
          <div className="max-w-sm">
            <Link href="/" className="inline-flex items-center gap-2 font-extrabold">
              <span className="flex size-7 items-center justify-center rounded-lg bg-brand text-white">
                <GraduationCap className="size-4" aria-hidden />
              </span>
              {APP_NAME}
            </Link>
            <p className="mt-2 text-sm text-muted-foreground">{APP_TAGLINE}</p>
          </div>
          <nav aria-label="Footer" className="grid grid-cols-2 gap-x-12 gap-y-2 text-sm">
            <Link href="/#examples" className="text-muted-foreground hover:text-primary">
              Example games
            </Link>
            <Link href="/library" className="text-muted-foreground hover:text-primary">
              Library
            </Link>
            <Link href="/#start" className="text-muted-foreground hover:text-primary">
              New lesson
            </Link>
            <Link href="/#how" className="text-muted-foreground hover:text-primary">
              How it works
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
