"use client";
/** Client boundary for /dev/expedition/client: Phaser is WebGL-only, so the client loads with `ssr: false`. */
import dynamic from "next/dynamic";

const DevExpeditionClient = dynamic(() => import("@/game/expedition/client/DevExpeditionClient"), {
  ssr: false,
  loading: () => <p style={{ padding: 24, fontSize: 20 }}>Loading the dev expedition…</p>,
});

export function Loader() {
  return <DevExpeditionClient />;
}
