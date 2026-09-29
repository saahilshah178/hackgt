"use client";

import { useSyncExternalStore } from "react";
import type { Genre } from "@/contracts/common";
import type { Intake } from "@/contracts/knowledge";
import { GENRE_LABELS, OFFERED_GENRES } from "@/library/genre-labels";
import type { GenreRecommendation } from "@/pipeline/personalize";

/*
 * The genre choice on the intake's last step. Genres come ranked for this learner (POST
 * /api/sources/:id/recommend: material fit, the library components mapped to their concepts, their
 * interests); "Pick for me" plays the first one. Only OFFERED_GENRES appear. The 3D open world is never auto-picked:
 * it gets its own card below the 2D genres, disabled (with the reason) where the browser has no WebGL 2.
 */

function webgl2Supported(): boolean {
  try {
    return !!document.createElement("canvas").getContext("webgl2");
  } catch {
    return false;
  }
}
const noop = () => () => {};

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
  const rest = OFFERED_GENRES.filter((g) => g !== "world3d" && !ranked.some((r) => r.genre === g));
  // null on the server render, then the real answer on the client
  const webgl = useSyncExternalStore(noop, webgl2Supported, () => null);
  const option = (g: Genre, rec: GenreRecommendation | undefined, best: boolean) => (
    <label
      key={g}
      className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-lg ${genre === g ? "border-primary bg-primary/10" : "border-border"}`}
      data-testid={`genre-${g}`}
    >
      <input type="radio" name="genre" value={g} checked={genre === g} onChange={() => onChange(g)} className="mt-1 h-5 w-5 shrink-0" />
      <span className="flex flex-col">
        <span>
          {GENRE_LABELS[g].name} <span className="text-base text-muted-foreground">· {GENRE_LABELS[g].perspective}</span>
          {best && <span className="ml-2 rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-accent-foreground">Best fit</span>}
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
      <legend className="text-2xl font-bold tracking-tight">Genre</legend>
      <div className="mt-3 flex flex-col gap-2">
        <label
          className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-lg ${genre === "auto" ? "border-primary bg-primary/10" : "border-border"}`}
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
        {ranked.filter((r) => r.genre !== "world3d").map((r, i) => option(r.genre, r, i === 0))}
        {rest.map((g) => option(g, undefined, false))}
        {OFFERED_GENRES.includes("world3d") && (
          <label
            className={`relative mt-1 flex cursor-pointer items-start gap-3 overflow-hidden rounded-xl border-2 p-3 text-lg ${genre === "world3d" ? "border-primary" : "border-border"} ${webgl === false ? "cursor-not-allowed opacity-60" : ""}`}
            style={{ background: "linear-gradient(120deg, #1f2a44 0%, #6a4a3a 48%, #d9a45b 100%)", color: "#fff8ec" }}
            data-testid="genre-world3d"
          >
            <input
              type="radio"
              name="genre"
              value="world3d"
              checked={genre === "world3d"}
              disabled={webgl === false}
              onChange={() => onChange("world3d")}
              className="mt-1 h-5 w-5 shrink-0"
            />
            <span className="flex flex-col">
              <span>
                <span className="mr-2 rounded-full bg-white/20 px-2 py-0.5 text-xs font-bold tracking-wide uppercase">New</span>
                {GENRE_LABELS.world3d.name} <span className="text-base opacity-85">· {GENRE_LABELS.world3d.perspective}</span>
              </span>
              <span className="text-base opacity-90">
                {GENRE_LABELS.world3d.blurb} The story, the characters and the world are written for your material, then checked by two reviewers before you play.
              </span>
              <span className="mt-1 text-sm opacity-80">
                {webgl === false ? "Your browser can't show 3D (WebGL 2 is off), so this option is unavailable here." : "Best on a laptop or desktop. Keyboard and mouse; no downloads."}
              </span>
            </span>
          </label>
        )}
      </div>
    </fieldset>
  );
}
