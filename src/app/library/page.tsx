import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { Filter, Layers, Lightbulb, PlayCircle, Puzzle, Search, Shapes, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { LibrarySpot } from "@/components/illustrations";
import { DOMAINS, GENRES, type Domain, type FamilyId, type Genre } from "@/contracts/common";
import { CARDS, isCardImplemented } from "@/library";
import { BOSS_SOCKET, GENRE_INFO, IMPLEMENTED_GENRES } from "@/library/genres";
import { FAMILIES, allModes, socketsFor } from "@/mechanics/registry";

type Filters = { domain?: string; family?: string; status?: string; q?: string; show?: string };

const PAGE_SIZE = 48;

function chip(active: boolean): string {
  return `rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
    active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:border-brand hover:bg-accent"
  }`;
}

/**
 * /library: the catalog browser. Judges should see the size of the library here: every teaching-mechanic card,
 * filterable by domain, family and implemented status, with counts, plus the family × genre adapter matrix.
 * Server-rendered from the in-repo catalog; filters are plain links so it works without JS and by keyboard.
 */
export default async function LibraryPage({ searchParams }: { searchParams: Promise<Filters> }) {
  const f = await searchParams;
  const domain = DOMAINS.includes(f.domain as Domain) ? (f.domain as Domain) : undefined;
  const family = FAMILIES.some((x) => x.id === f.family) ? (f.family as FamilyId) : undefined;
  const status = f.status === "implemented" || f.status === "planned" ? f.status : undefined;
  const q = (f.q ?? "").trim().toLowerCase();
  const show = Math.max(PAGE_SIZE, Math.min(Number(f.show) || PAGE_SIZE, CARDS.length));

  const withStatus = CARDS.map((card) => ({ card, implemented: isCardImplemented(card) }));
  const rows = withStatus.filter(
    ({ card, implemented }) =>
      (!domain || card.domain === domain) &&
      (!family || card.family === family) &&
      (!status || (status === "implemented") === implemented) &&
      (!q || [card.id, card.name, card.concept, card.misconception, card.topic, ...card.keywords].join(" ").toLowerCase().includes(q)),
  );

  const total = CARDS.length;
  const implementedCount = withStatus.filter((r) => r.implemented).length;
  const flagships = CARDS.filter((c) => c.flagship);
  const modes = allModes();
  const implementedModes = modes.filter((m) => m.mode.implemented);
  const byDomain = DOMAINS.map((d) => ({ domain: d, count: CARDS.filter((c) => c.domain === d).length })).filter((x) => x.count > 0);
  const byFamily = FAMILIES.map((fam) => ({
    id: fam.id,
    name: fam.name,
    count: CARDS.filter((c) => c.family === fam.id).length,
    implementedModes: Object.values(fam.modes).filter((m) => m.implemented).length,
    modeCount: Object.keys(fam.modes).length,
  }));

  const link = (over: Partial<Filters>) => {
    // Changing a filter always resets pagination to the first page unless the caller passes `show` itself
    // (the "show more" link below does exactly that).
    const next = { domain, family, status, q, ...over } as Record<string, string | undefined>;
    const qs = Object.entries(next)
      .filter(([, v]) => v)
      .map(([k, v]) => `${k}=${encodeURIComponent(v!)}`)
      .join("&");
    return `/library${qs ? `?${qs}` : ""}`;
  };

  return (
    <AppShell wide>
      <div className="flex flex-col-reverse items-start gap-6 rounded-3xl bg-gradient-to-br from-accent via-card to-card p-6 ring-1 ring-border sm:flex-row sm:items-center sm:p-10">
        <div className="flex-1">
          <p className="text-sm font-semibold tracking-wide text-primary uppercase">Library</p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight sm:text-4xl">Teaching-mechanic library</h1>
          <p className="mt-3 max-w-3xl text-lg leading-relaxed text-muted-foreground">
            Every card is a concept-specific configuration of one mechanic family. Cards are data; families are engine
            code. A card is playable as soon as its family·mode is implemented.
          </p>
        </div>
        <LibrarySpot className="w-28 shrink-0 sm:w-40" />
      </div>

      <dl className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5" aria-label="Library counts">
        {(
          [
            ["Cards", total, Layers],
            ["Playable now", implementedCount, PlayCircle],
            ["Flagships", flagships.length, Star],
            ["Families", FAMILIES.length, Shapes],
            ["Modes", `${implementedModes.length} / ${modes.length}`, Puzzle],
          ] as const
        ).map(([label, value, Icon]) => (
          <div key={label} className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-accent-foreground">
              <Icon className="size-5" aria-hidden />
            </span>
            <div>
              <dt className="text-sm text-muted-foreground">{label}</dt>
              <dd className="text-2xl font-extrabold tabular-nums">{value}</dd>
            </div>
          </div>
        ))}
      </dl>

      <section className="mt-10 rounded-3xl border border-border bg-card p-5 sm:p-6" aria-labelledby="filters-heading">
        <h2 id="filters-heading" className="flex items-center gap-2 text-lg font-bold">
          <Filter className="size-5 text-primary" aria-hidden />
          Filter
        </h2>
        <form className="mt-4 flex flex-col gap-2 sm:flex-row" action="/library" method="get" role="search">
          {domain && <input type="hidden" name="domain" value={domain} />}
          {family && <input type="hidden" name="family" value={family} />}
          {status && <input type="hidden" name="status" value={status} />}
          <label htmlFor="q" className="sr-only">
            Search cards
          </label>
          <div className="relative w-full max-w-xl">
            <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <input
              id="q"
              name="q"
              defaultValue={q}
              placeholder="Search concept, misconception, keyword…"
              className="h-12 w-full rounded-full border border-input bg-card pr-4 pl-12 text-base focus:border-ring focus:outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
            />
          </div>
          <button type="submit" className="h-12 rounded-full bg-primary px-6 text-base font-semibold text-primary-foreground transition hover:bg-primary/90">
            Search
          </button>
        </form>
        <p className="mt-5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Status</p>
        <div className="mt-2 flex flex-wrap gap-2" aria-label="Status">
          {[
            ["all", "All", undefined],
            ["implemented", "Playable now", "implemented"],
            ["planned", "Catalog only", "planned"],
          ].map(([key, label, val]) => (
            <Link
              key={key}
              href={link({ status: val as string | undefined })}
              aria-current={status === val || (!status && !val) ? "page" : undefined}
              className={chip(status === val || (!status && !val))}
            >
              {label}
            </Link>
          ))}
        </div>
        <p className="mt-5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Subject</p>
        <div className="mt-2 flex flex-wrap gap-2" aria-label="Domain">
          <Link href={link({ domain: undefined })} className={chip(!domain)}>
            every domain
          </Link>
          {byDomain.map((d) => (
            <Link key={d.domain} href={link({ domain: d.domain })} aria-current={domain === d.domain ? "page" : undefined} className={chip(domain === d.domain)}>
              {d.domain} <span className="opacity-70">{d.count}</span>
            </Link>
          ))}
        </div>
        <p className="mt-5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Mechanic family</p>
        <div className="mt-2 flex flex-wrap gap-2" aria-label="Family">
          <Link href={link({ family: undefined })} className={chip(!family)}>
            every family
          </Link>
          {byFamily.map((fam) => (
            <Link key={fam.id} href={link({ family: fam.id })} aria-current={family === fam.id ? "page" : undefined} className={chip(family === fam.id)}>
              {fam.name} <span className="opacity-70">{fam.count}</span>{" "}
              <span className="opacity-70">
                ({fam.implementedModes}/{fam.modeCount} modes)
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-10" aria-live="polite">
        <h2 className="text-2xl font-bold tracking-tight">
          {rows.length} card{rows.length === 1 ? "" : "s"}
          {rows.length > show && <span className="text-base font-normal text-muted-foreground"> (showing {show})</span>}
        </h2>
        {rows.length === 0 && (
          <div className="mt-6 flex flex-col items-center gap-3 rounded-3xl border border-dashed border-border p-10 text-center">
            <LibrarySpot className="w-28" />
            <p className="text-lg font-semibold">No cards match those filters</p>
            <Link href="/library" className="font-semibold text-primary hover:underline">
              Clear all filters
            </Link>
          </div>
        )}
        <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {rows.slice(0, show).map(({ card, implemented }) => (
            <article
              key={card.id}
              className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 transition hover:border-brand hover:shadow-lg hover:shadow-sky-900/5"
              data-testid="library-card"
            >
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-lg leading-snug font-bold">
                  {card.flagship && <Star className="mr-1.5 inline size-4 -translate-y-0.5 fill-amber-400 text-amber-400" aria-label="Flagship" />}
                  {card.name}
                </h3>
                <Badge
                  variant={implemented ? "default" : "secondary"}
                  className={implemented ? "h-6 bg-success-soft px-2.5 text-success" : "h-6 px-2.5 text-muted-foreground"}
                >
                  {implemented ? "playable" : "catalog"}
                </Badge>
              </div>
              <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                <code className="rounded-md bg-secondary px-1.5 py-0.5">{card.id}</code>
                <span className="rounded-full bg-accent px-2 py-0.5 font-medium text-accent-foreground">{card.domain}</span>
                <span>
                  {card.family}.{card.mode}
                </span>
              </p>
              <dl className="flex flex-col gap-2 text-sm leading-relaxed">
                <div>
                  <dt className="font-semibold">Concept</dt>
                  <dd className="text-muted-foreground">{card.concept}</dd>
                </div>
                <div>
                  <dt className="font-semibold">Player does</dt>
                  <dd className="text-muted-foreground">{card.playerAction}</dd>
                </div>
                <div>
                  <dt className="font-semibold">Breaks the misconception</dt>
                  <dd className="text-muted-foreground">{card.misconception}</dd>
                </div>
              </dl>
              <p className="mt-auto flex gap-2 rounded-xl bg-brand-soft/70 p-3 text-sm leading-relaxed text-accent-foreground">
                <Lightbulb className="mt-0.5 size-4 shrink-0" aria-hidden />
                {card.learningInsight}
              </p>
            </article>
          ))}
        </div>
        {rows.length > show && (
          <div className="mt-8 flex justify-center">
            <Link
              href={link({ show: String(Math.min(show + PAGE_SIZE, rows.length)) })}
              className="rounded-full border border-border bg-card px-6 py-3 text-base font-semibold transition hover:border-brand hover:bg-accent"
            >
              Show {Math.min(PAGE_SIZE, rows.length - show)} more
            </Link>
          </div>
        )}
      </section>

      <section className="mt-14" aria-labelledby="matrix-heading">
        <h2 id="matrix-heading" className="text-2xl font-bold tracking-tight">
          Family × genre adapters
        </h2>
        <p className="mt-2 max-w-4xl text-base text-muted-foreground">
          Which socket each family mounts on in each genre (LIBRARY §5). The boss socket is always allowed. Hosts built
          tonight: {IMPLEMENTED_GENRES.join(", ")}.
        </p>
        <div className="mt-5 overflow-x-auto rounded-2xl border border-border bg-card">
          <table className="w-full min-w-[900px] border-collapse text-sm">
            <thead className="bg-secondary/70">
              <tr>
                <th className="border-b border-border p-3 text-left">Family</th>
                {GENRES.map((g: Genre) => (
                  <th key={g} className="border-b border-border p-3 text-left">
                    {GENRE_INFO[g].name}
                    <div className="text-sm font-normal text-muted-foreground">boss: {BOSS_SOCKET[g]}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {FAMILIES.map((fam) => (
                <tr key={fam.id}>
                  <th scope="row" className="border-b border-border/60 p-3 text-left align-top font-semibold">
                    {fam.name}
                  </th>
                  {GENRES.map((g: Genre) => {
                    const skin = fam.genres[g];
                    return (
                      <td key={g} className="border-b border-border/60 p-3 align-top">
                        {skin ? (
                          <>
                            <div className="font-medium">{socketsFor(fam.id, g, BOSS_SOCKET[g]).join(" / ")}</div>
                            <div className="text-sm text-muted-foreground">{skin.skin}</div>
                          </>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </AppShell>
  );
}
