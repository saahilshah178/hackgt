import { NextResponse } from "next/server";
import { z } from "zod";
import { TelemetryEvent } from "../../../../../contracts/telemetry";
import { isFixtureId, materializeFixtureGame } from "../../../../../server/fixtures";
import { getStorage } from "../../../../../server/storage";

const Body = z.array(TelemetryEvent);

/** POST /api/games/[id]/telemetry: appends validated TelemetryEvent[] for a game. */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await context.params;
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON array of telemetry events." }, { status: 400 });
  }
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid telemetry events.", issues: parsed.error.issues }, { status: 400 });
  }
  const mismatched = parsed.data.find((e) => e.gameId !== id);
  if (mismatched) {
    return NextResponse.json({ error: `Event gameId "${mismatched.gameId}" does not match route id "${id}".` }, { status: 400 });
  }
  const storage = getStorage();
  const game = (await storage.getGame(id)) ?? (isFixtureId(id) ? await materializeFixtureGame(id) : null);
  if (!game) return NextResponse.json({ error: `No game with id "${id}".` }, { status: 404 });
  await storage.appendTelemetry(id, parsed.data);
  return NextResponse.json({ ok: true, count: parsed.data.length });
}

/** GET /api/games/[id]/telemetry: every stored TelemetryEvent for a game. */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await context.params;
  const events = await getStorage().getTelemetry(id);
  return NextResponse.json(events);
}
