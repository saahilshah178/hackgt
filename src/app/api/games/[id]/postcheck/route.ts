import { NextResponse } from "next/server";
import { z } from "zod";
import { getStorage } from "../../../../../server/storage";

/*
 * POST /api/games/[id]/postcheck: stores the post-check answers and scores pre/post against
 * spec.assessment. See instructions.md §9.
 */

const Body = z.object({ answers: z.array(z.number().int().min(0).max(3)) });

function jsonError(status: number, error: string) {
  return NextResponse.json({ error }, { status });
}

function score(answers: readonly number[], items: readonly { correctIndex: number }[]): number {
  return items.reduce((n, item, i) => n + (answers[i] === item.correctIndex ? 1 : 0), 0);
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await context.params;
  const storage = getStorage();
  const record = await storage.getGame(id);
  if (!record) return jsonError(404, `No game with id "${id}".`);

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return jsonError(400, "Expected a JSON body.");
  }
  const parsed = Body.safeParse(json);
  if (!parsed.success) return jsonError(400, parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));

  await storage.putBlob(`postcheck/${id}.json`, new TextEncoder().encode(JSON.stringify(parsed.data.answers)), "application/json");

  const pre = score(record.spec.intake.preCheckAnswers, record.spec.assessment.pre);
  const post = score(parsed.data.answers, record.spec.assessment.post);
  return NextResponse.json({ ok: true, pre, post });
}
