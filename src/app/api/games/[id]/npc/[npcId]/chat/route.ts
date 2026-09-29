import { streamText } from "ai";
import { NextResponse } from "next/server";
import type { GameSpec } from "@/contracts/gamespec";
import { getModel, tierOptions } from "@/pipeline/models";
import { guardReply, leakCandidates, mockNpcReply, npcChatLimiter, NpcChatBody, npcChatSystem } from "@/pipeline/world3d/npc-chat";
import { getEnv } from "@/server/env";
import { isFixtureId, loadFixtureSpec } from "@/server/fixtures";
import { getGameSpecById } from "@/server/storage";

/*
 * POST /api/games/:id/npc/:npcId/chat (docs/design/60 §2.6): a short, in-character reply from a world3d character.
 * Body { messages: {role: "user" | "assistant", content}[] (≤ 12, each ≤ 500 chars, the last from the player),
 * solved: encounter ids }. Response: text/plain, the reply (buffered so the leak guard sees all of it before it is
 * sent; it is 1-3 sentences). Live mode asks the FAST tier; mock mode answers from the lessons deterministically.
 * Errors are JSON { error }: 400 bad input, 404 unknown game or npc, 429 rate-limited (per game and ip),
 * 503 when NPC_CHAT=off, 502 when the model call fails. Fixture games (`fixture-<name>`) resolve like /play does.
 */

const json = (status: number, error: string, headers?: Record<string, string>) => NextResponse.json({ error }, { status, headers });

async function loadSpec(id: string): Promise<GameSpec | null> {
  if (isFixtureId(id)) return loadFixtureSpec(id);
  return (await getGameSpecById(id)) ?? (await loadFixtureSpec(id));
}

function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip")?.trim() || "local";
}

export async function POST(request: Request, context: { params: Promise<{ id: string; npcId: string }> }): Promise<Response> {
  const { id, npcId } = await context.params;
  const env = getEnv();
  if (env.NPC_CHAT === "off") return json(503, "Talking to characters is turned off on this server.");

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return json(400, "Expected a JSON body { messages, solved }.");
  }
  const parsed = NpcChatBody.safeParse(raw);
  if (!parsed.success) return json(400, `Invalid chat request: ${parsed.error.issues[0]?.message ?? "bad input"}.`);
  const body = parsed.data;

  let spec: GameSpec | null;
  try {
    spec = await loadSpec(id);
  } catch {
    return json(500, "Could not load the game.");
  }
  if (!spec?.world3d) return json(404, `No 3D game with id "${id}".`);
  const world = spec.world3d;
  const npc = world.npcs.find((n) => n.id === npcId);
  if (!npc) return json(404, `No character "${npcId}" in this game.`);

  const limit = npcChatLimiter.hit(`${id}:${clientIp(request)}`);
  if (!limit.ok) {
    return json(429, `${npc.name} needs a breather. Try again in a few minutes.`, { "retry-after": String(Math.ceil(limit.retryAfterMs / 1000)) });
  }

  let reply: string;
  if (env.LLM_MODE === "mock") {
    reply = mockNpcReply(spec, world, npc, body.messages, body.solved);
  } else {
    try {
      const options = tierOptions("fast");
      const result = streamText({
        model: getModel("fast"),
        system: npcChatSystem(spec, world, npc, body.solved),
        messages: body.messages,
        maxOutputTokens: 220,
        ...(options ? { providerOptions: options } : {}),
      });
      reply = await result.text;
    } catch {
      return json(502, `${npc.name} is lost in thought. Try again.`);
    }
  }

  const safe = guardReply(reply, leakCandidates(spec, body.solved), npc);
  return new Response(safe, { status: 200, headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });
}
