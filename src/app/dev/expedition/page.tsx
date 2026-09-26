"use client";
/**
 * /dev/expedition (H1) — mounts the typed dev world on the Expedition host (docs/design/20 §7.2 H1): two zones, every
 * link kind, a sheer descent, one station per control kind on the stub prefabs and a puppet companion. `?renderer=dom`
 * shows the reduced DOM host; `?expeditionFail=1` forces the boot-failure fallback. Client-only (Phaser, canvas).
 */
import dynamic from "next/dynamic";

const DevHarness = dynamic(() => import("@/game/hosts/expedition/__fixtures__/DevHarness"), {
  ssr: false,
  loading: () => <p style={{ padding: 24, fontSize: 20 }}>Loading the dev expedition…</p>,
});

export default function DevExpeditionPage() {
  return <DevHarness />;
}
