"use client";
/**
 * src/game/expedition/client/DevExpeditionClient.tsx (H2) — the dev world (H1's `devWorld()`: two zones, one station
 * per control kind, a boss, a sandbox) played through the REAL client: intro → explore → panel → Verify → payoff →
 * finale → EndScreen. Served at /dev/expedition/client (dev builds only); `?renderer=dom` and `?express=1` work as on
 * /play. Dev-only: it imports the fixture JSON the dev world is built from.
 */
import { useState } from "react";
import { devWorld } from "../../hosts/expedition/__fixtures__/dev-world";
import { ExpeditionClient } from "./ExpeditionClient";

export default function DevExpeditionClient() {
  const [{ spec, world }] = useState(() => devWorld());
  return <ExpeditionClient spec={spec} world={world} sfx={false} />;
}
