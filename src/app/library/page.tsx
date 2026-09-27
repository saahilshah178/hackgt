import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { DOMAINS, GENRES, type Domain, type FamilyId, type Genre } from "@/contracts/common";
import { CARDS, isCardImplemented } from "@/library";
import { BOSS_SOCKET, GENRE_INFO, IMPLEMENTED_GENRES } from "@/library/genres";
import { FAMILIES, allModes, socketsFor } from "@/mechanics/registry";

type Filters = { domain?: string; family?: string; status?: string; q?: string; show?: string };

const PAGE_SIZE = 48;

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
      <h1 className="text-4xl font-bold tracking-tight">Teaching-mechanic library</h1>
      <p className="mt-3 max-w-4xl text-xl text-muted-foreground">
        Every card is a concept-specific configuration of one mechanic family. Cards are data; families are engine
        code. A card is playable as soon as its family·mode is implemented.
      </p>

      <dl className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-5" aria-label="Library counts">
        {[
          ["Cards", total],
          ["Playable now", implementedCount],
          ["Flagships", flagships.length],
          ["Families", FAMILIES.length],
          ["Modes", `${implementedModes.length} / ${modes.length}`],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-lg border border-border/60 bg-card p-4">
            <dt className="text-base text-muted-foreground">{label}</dt>
            <dd className="text-4xl font-bold">{value}</dd>
          </div>
        ))}
      </dl>

      <section className="mt-10" aria-labelledby="filters-heading">
        <h2 id="filters-heading" className="text-2xl font-semibold">
          Filter
        </h2>
        <div className="mt-3 flex flex-wrap gap-2" aria-label="Status">
          {[
            ["all", "All", undefined],
            ["implemented", "Playable now", "implemented"],
            ["planned", "Catalog only", "planned"],
          ].map(([key, label, val]) => (
            <Link
              key={key}
              href={link({ status: val as string | undefined })}
              aria-current={status === val || (!status && !val) ? "page" : undefined}
              className={`rounded-md px-4 py-2 text-lg focus-visible:outline-2 focus-visible:outline-ring ${
                status === val || (!status && !val) ? "bg-primary text-primary-foreground" : "bg-secondary"
              }`}
            >
              {label}
            </Link>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2" aria-label="Domain">
          <Link href={link({ domain: undefined })} className={`rounded-md px-3 py-1.5 text-base ${!domain ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>
            every domain
          </Link>
          {byDomain.map((d) => (
            <Link
              key={d.domain}
              href={link({ domain: d.domain })}
              aria-current={domain === d.domain ? "page" : undefined}
              className={`rounded-md px-3 py-1.5 text-base focus-visible:outline-2 focus-visible:outline-ring ${
                domain === d.domain ? "bg-primary text-primary-foreground" : "bg-secondary"
              }`}
            >
              {d.domain} <span className="opacity-70">{d.count}</span>
            </Link>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2" aria-label="Family">
          <Link href={link({ family: undefined })} className={`rounded-md px-3 py-1.5 text-base ${!family ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>
            every family
          </Link>
          {byFamily.map((fam) => (
            <Link
              key={fam.id}
              href={link({ family: fam.id })}
              aria-current={family === fam.id ? "page" : undefined}
              className={`rounded-md px-3 py-1.5 text-base focus-visible:outline-2 focus-visible:outline-ring ${
                family === fam.id ? "bg-primary text-primary-foreground" : "bg-secondary"
              }`}
            >
              {fam.name} <span className="opacity-70">{fam.count}</span>{" "}
              <span className="opacity-70">
                ({fam.implementedModes}/{fam.modeCount} modes)
              </span>
            </Link>
          ))}
        </div>
        <form className="mt-3 flex gap-2" action="/library" method="get">
          {domain && <input type="hidden" name="domain" value={domain} />}
          {family && <input type="hidden" name="family" value={family} />}
          {status && <input type="hidden" name="status" value={status} />}
          <label htmlFor="q" className="sr-only">
            Search cards
          </label>
          <input
            id="q"
            name="q"
            defaultValue={q}
            placeholder="Search concept, misconception, keyword…"
            className="h-12 w-full max-w-xl rounded-md border border-input bg-background px-4 text-lg"
          />
          <button type="submit" className="h-12 rounded-md bg-secondary px-5 text-lg">
            Search
          </button>
        </form>
      </section>

      <section className="mt-8" aria-live="polite">
        <h2 className="text-2xl font-semibold">
          {rows.length} card{rows.length === 1 ? "" : "s"}
          {rows.length > show && <span className="text-lg font-normal text-muted-foreground"> (showing {show})</span>}
        </h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rows.slice(0, show).map(({ card, implemented }) => (
            <article key={card.id} className="flex flex-col gap-2 rounded-lg border border-border/60 bg-card p-4" data-testid="library-card">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-xl font-semibold">
                  {card.flagship ? "★ " : ""}
                  {card.name}
                </h3>
                <Badge variant={implemented ? "default" : "secondary"}>{implemented ? "playable" : "catalog"}</Badge>
              </div>
              <p className="text-base text-muted-foreground">
                <code>{card.id}</code> · {card.domain} · {card.family}.{card.mode}
              </p>
              <p className="text-lg">
                <strong>Concept:</strong> {card.concept}
              </p>
              <p className="text-lg">
                <strong>Player does:</strong> {card.playerAction}
              </p>
              <p className="text-lg">
                <strong>Breaks:</strong> {card.misconception}
              </p>
              <p className="text-base text-muted-foreground">{card.learningInsight}</p>
            </article>
          ))}
        </div>
        {rows.length > show && (
          <div className="mt-6 flex justify-center">
            <Link
              href={link({ show: String(Math.min(show + PAGE_SIZE, rows.length)) })}
              className="rounded-md bg-secondary px-6 py-3 text-lg font-medium hover:opacity-90 focus-visible:outline-2 focus-visible:outline-ring"
            >
              Show {Math.min(PAGE_SIZE, rows.length - show)} more
            </Link>
          </div>
        )}
      </section>

      <section className="mt-12" aria-labelledby="matrix-heading">
        <h2 id="matrix-heading" className="text-2xl font-semibold">
          Family × genre adapters
        </h2>
        <p className="mt-2 text-lg text-muted-foreground">
          Which socket each family mounts on in each genre (LIBRARY §5). The boss socket is always allowed. All{" "}
          {IMPLEMENTED_GENRES.length} genres have a host; five of them progress without walking right.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[1400px] border-collapse text-base">
            <thead>
              <tr>
                <th className="border-b border-border p-2 text-left">Family</th>
                {GENRES.map((g: Genre) => (
                  <th key={g} className="border-b border-border p-2 text-left">
                    {GENRE_INFO[g].name}
                    <div className="text-sm font-normal text-muted-foreground">boss: {BOSS_SOCKET[g]}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {FAMILIES.map((fam) => (
                <tr key={fam.id}>
                  <th scope="row" className="border-b border-border/60 p-2 text-left align-top font-semibold">
                    {fam.name}
                  </th>
                  {GENRES.map((g: Genre) => {
                    const skin = fam.genres[g];
                    return (
                      <td key={g} className="border-b border-border/60 p-2 align-top">
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
