import Link from "next/link";
import { APP_NAME } from "@/config";
import { MockBanner } from "@/components/mock-banner";

/** Header + content frame shared by every page. Large type and high contrast: this runs on a projector. */
export function AppShell({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-border/60">
        <nav className={`mx-auto flex w-full items-center justify-between px-6 py-4 ${wide ? "max-w-[1400px]" : "max-w-6xl"}`} aria-label="Main">
          <Link href="/" className="text-2xl font-bold tracking-tight hover:opacity-80 focus-visible:outline-2 focus-visible:outline-ring">
            {APP_NAME}
          </Link>
          <div className="flex items-center gap-6 text-lg">
            <Link href="/library" className="hover:underline focus-visible:outline-2 focus-visible:outline-ring">
              Library
            </Link>
            <Link href="/play/fixture-trig" className="hover:underline focus-visible:outline-2 focus-visible:outline-ring">
              Demo game
            </Link>
          </div>
        </nav>
        <MockBanner />
      </header>
      <main className={`mx-auto w-full flex-1 px-6 py-8 ${wide ? "max-w-[1400px]" : "max-w-6xl"}`}>{children}</main>
    </div>
  );
}
