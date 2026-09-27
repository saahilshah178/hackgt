"use client";

import type { Genre } from "@/contracts/common";
import type { Intake } from "@/contracts/knowledge";
import { GENRE_LABELS, OFFERED_GENRES } from "@/library/genre-labels";
import type { GenreRecommendation } from "@/pipeline/personalize";

/*
 * The genre choice on the intake's last step. Genres come ranked for this learner (POST
 * /api/sources/:id/recommend: material fit, the library components mapped to their concepts, their
 * interests); "Pick for me" plays the first one. Only OFFERED_GENRES appear.
 */

export function GenrePicker({
  genre,
  onChange,
  recommendations,
}: {
  genre: Intake["genre"];
  onChange: (g: Intake["genre"]) => void;
  /** null while loading */
  recommendations: GenreRecommendation[] | null;
}) {
  const ranked = recommendations ?? [];
  const top = ranked[0];
  const rest = OFFERED_GENRES.filter((g) => !ranked.some((r) => r.genre === g));
  const option = (g: Genre, rec: GenreRecommendation | undefined, best: boolean) => (
    <label
      key={g}
      className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 text-lg ${genre === g ? "border-primary bg-primary/10" : "border-border"}`}
      data-testid={`genre-${g}`}
    >
      <input type="radio" name="genre" value={g} checked={genre === g} onChange={() => onChange(g)} className="mt-1 h-5 w-5 shrink-0" />
      <span className="flex flex-col">
        <span>
          {GENRE_LABELS[g].name} <span className="text-base text-muted-foreground">· {GENRE_LABELS[g].perspective}</span>
          {best && <span className="ml-2 rounded bg-primary/20 px-2 py-0.5 text-sm font-medium">Best fit</span>}
        </span>
        <span className="text-base text-muted-foreground">{GENRE_LABELS[g].blurb}</span>
        {rec && best && rec.reasons.length > 0 && (
          <ul className="mt-1 list-disc pl-5 text-base" data-testid="genre-reasons">
            {rec.reasons.slice(0, 3).map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        )}
      </span>
    </label>
  );

  return (
    <fieldset className="md:col-span-1">
      <legend className="text-2xl font-semibold">Genre</legend>
      <div className="mt-3 flex flex-col gap-2">
        <label
          className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 text-lg ${genre === "auto" ? "border-primary bg-primary/10" : "border-border"}`}
          data-testid="genre-auto"
        >
          <input type="radio" name="genre" value="auto" checked={genre === "auto"} onChange={() => onChange("auto")} className="mt-1 h-5 w-5 shrink-0" />
          <span className="flex flex-col">
            <span>Pick for me</span>
            <span className="text-base text-muted-foreground" aria-live="polite">
              {recommendations === null ? "Matching your concepts to game mechanics…" : top ? `You'll get the ${GENRE_LABELS[top.genre].name.toLowerCase()}.` : ""}
            </span>
          </span>
        </label>
        {ranked.map((r, i) => option(r.genre, r, i === 0))}
        {rest.map((g) => option(g, undefined, false))}
      </div>
    </fieldset>
  );
}
