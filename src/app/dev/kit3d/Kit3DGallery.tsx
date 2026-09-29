"use client";

import dynamic from "next/dynamic";

/* The gallery is WebGL-only: load the canvas on the client. */
const Kit3DCanvas = dynamic(() => import("./Kit3DCanvas").then((m) => m.Kit3DCanvas), {
  ssr: false,
  loading: () => <p style={{ padding: 24, fontSize: 18 }}>Loading the 3D kit…</p>,
});

export interface Kit3DGalleryProps {
  world: string;
  mood: string | null;
  weather: string | null;
  quality: string;
  cam: string;
  shot: boolean;
  /** world (default) | structures | characters */
  view: string;
  style: string | null;
  material: string | null;
  kind: string | null;
  anim: string | null;
}

export function Kit3DGallery(props: Kit3DGalleryProps) {
  return <Kit3DCanvas {...props} />;
}
