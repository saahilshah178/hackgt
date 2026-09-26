/**
 * src/game/expedition/client (H2) — the Expedition game client (docs/design/20 §2.1, §2.9, §2.13, §3.4).
 * Pure modules (node-tested): machine.ts, express.ts, session.ts, interactions.ts, runner-snapshot.ts.
 * React: ExpeditionClient (the game), ExpeditionLayout (the screen), ExpeditionEntry (lazy entry from GameClient),
 * SandboxPanel, useRunner.
 */
export * from "./machine";
export * from "./express";
export * from "./session";
export * from "./interactions";
export * from "./runner-snapshot";
export { useRunner, type UseRunner } from "./useRunner";
export { ExpeditionClient, type ExpeditionClientProps } from "./ExpeditionClient";
export { ExpeditionLayout, type ExpeditionLayoutProps } from "./ExpeditionLayout";
export { SandboxPanel, type SandboxPanelProps } from "./SandboxPanel";
