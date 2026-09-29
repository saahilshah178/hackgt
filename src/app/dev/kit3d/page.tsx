import { notFound } from "next/navigation";
import { Kit3DGallery } from "./Kit3DGallery";

export const metadata = { title: "3D kit gallery (dev)" };

/**
 * /dev/kit3d: the 3D component library's gallery and visual QA surface (docs/design/60 §2.3). Query:
 * `world` (nile | alpine | lunar), `mood`, `weather`, `quality` (low | medium | high), `cam` (a named shot:
 * spawn | goal | aerial), `shot=1` (hide the overlay for screenshots), `view` (world | structures | characters), and for the
 * grids `style`, `material`, `kind`, `anim`. Not served in production builds.
 */
export default async function Kit3DPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (process.env.NODE_ENV === "production") notFound();
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  return (
    <Kit3DGallery
      world={one(sp.world) ?? "nile"}
      mood={one(sp.mood) ?? null}
      weather={one(sp.weather) ?? null}
      quality={one(sp.quality) ?? "high"}
      cam={one(sp.cam) ?? "spawn"}
      shot={one(sp.shot) === "1"}
      view={one(sp.view) ?? "world"}
      style={one(sp.style) ?? null}
      material={one(sp.material) ?? null}
      kind={one(sp.kind) ?? null}
      anim={one(sp.anim) ?? null}
    />
  );
}
