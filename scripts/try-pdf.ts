import { readFile } from "node:fs/promises";
import { extname, basename } from "node:path";
import type { PageRecord } from "../src/contracts/storage";
import { checkGatekeeper, runGatekeeper } from "../src/pipeline/agents/gatekeeper";
import { checkCurriculum, curriculumToKnowledgeMap, runCurriculumChunked } from "../src/pipeline/agents/curriculum";
import { chunkPages } from "../src/pipeline/agents/chunking";
import { runMatcher } from "../src/pipeline/agents/matcher";
import { extractPages } from "../src/server/ingest/pdf";
import { splitTextIntoPages } from "../src/server/ingest/text";
import { verifyKnowledgeMapQuotes } from "../src/server/ingest/quotes";
import { isMockLLM, loadLocalEnvFile } from "../src/server/env";

/*
 * `pnpm try:pdf <path>`: runs S0-S4 on a PDF (or a .md/.txt file, treated as pasted text) in the
 * current LLM_MODE, without the HTTP layer. Prints the gatekeeper verdict, how the document was cut
 * into parts for the curriculum agent, concepts by unit with knowledge types, verified/dropped
 * quotes, and the matcher's picks + wishlist per concept. Any length works: a whole textbook is read
 * in section-aligned parts (src/pipeline/agents/chunking.ts). See MEGAPROMPT §9 (P5b) and
 * instructions.md §7.
 */

async function loadPages(path: string, sourceId: string): Promise<PageRecord[]> {
  const ext = extname(path).toLowerCase();
  if (ext === ".pdf") {
    const bytes = new Uint8Array(await readFile(path));
    return extractPages(bytes, sourceId);
  }
  const text = await readFile(path, "utf8");
  return splitTextIntoPages(sourceId, text);
}

async function main() {
  loadLocalEnvFile();
  const path = process.argv[2];
  if (!path) {
    console.error("usage: pnpm try:pdf <path-to.pdf|.md|.txt>");
    process.exitCode = 1;
    return;
  }

  const sourceId = "try_pdf";
  const jobId = `try:${Date.now()}`;
  const title = basename(path).replace(/\.(pdf|md|txt)$/i, "");

  const pages = await loadPages(path, sourceId);
  const pageCount = pages.length;
  const chars = pages.reduce((n, p) => n + p.text.length, 0);
  console.log(`Loaded "${path}": ${pageCount} page(s), ${chars.toLocaleString()} characters, ${pages.filter((p) => p.lowText).length} low-text page(s).`);

  const gatekeeper = await runGatekeeper({ jobId, title, pages, pageCount });
  const gkProblems = checkGatekeeper(gatekeeper, { pageCount });

  console.log("\n=== Gatekeeper ===");
  console.log(`educational: ${gatekeeper.educational}   tooBig: ${gatekeeper.tooBig}   tooSmall: ${gatekeeper.tooSmall}   estimatedConcepts: ${gatekeeper.estimatedConcepts}`);
  if (gatekeeper.outline.length > 0) {
    console.log("outline:");
    gatekeeper.outline.forEach((o) => console.log(`  - ${o.title} (pp. ${o.pageStart}-${o.pageEnd})`));
  }
  if (gatekeeper.followUps.length > 0) {
    console.log("follow-ups:");
    gatekeeper.followUps.forEach((f) => console.log(`  - ${f}`));
  }
  if (gkProblems.length > 0) console.log(`(gatekeeper check flagged: ${gkProblems.join("; ")})`);

  if (!gatekeeper.educational) {
    console.log("\nGatekeeper says this material isn't educational; stopping here.");
    return;
  }

  const mock = isMockLLM();
  const plan = mock ? [] : chunkPages(pages, gatekeeper.outline);
  console.log("\n=== Curriculum plan ===");
  if (plan.length <= 1) {
    console.log(mock ? "mock mode: one canned reply, no chunking" : "short enough to read in one call");
  } else {
    plan.forEach((c) => console.log(`  part ${c.index + 1}/${plan.length}: pp. ${c.pageStart}-${c.pageEnd} (${c.chars.toLocaleString()} chars)${c.title ? ` "${c.title}"` : ""}`));
  }

  const { slice, parts } = await runCurriculumChunked({
    jobId,
    title,
    pages,
    pageCount,
    unsourced: false,
    outline: gatekeeper.outline,
    chunking: mock ? false : undefined,
  });
  const curProblems = checkCurriculum(slice, { pageCount, unsourced: false }).filter((p) => !p.startsWith("soft:"));
  if (curProblems.length > 0) console.log(`\n(curriculum check flagged: ${curProblems.join("; ")})`);

  let km = curriculumToKnowledgeMap(slice, sourceId, false);
  const verified = verifyKnowledgeMapQuotes(km, pages);
  km = verified.km;

  console.log(`\n=== Concepts by unit (${km.units.length} units, ${km.concepts.length} concepts, read in ${parts} part(s)) ===`);
  for (const unit of km.units) {
    console.log(`\n${unit.name} (${unit.id})`);
    for (const cid of unit.conceptIds) {
      const c = km.concepts.find((x) => x.id === cid);
      if (!c) continue;
      console.log(`  - ${c.name} [${c.knowledgeType}] (${c.importance}, difficulty ${c.difficulty})`);
    }
  }

  console.log("\n=== Quotes ===");
  console.log(`verified: ${verified.verified}   dropped: ${verified.dropped.length}`);
  verified.dropped.forEach((d) => console.log(`  DROPPED [${d.conceptId}] p.${d.page}: "${d.quote}"`));

  const matches = await runMatcher(km, { jobId });
  console.log("\n=== Matcher ===");
  for (const m of matches) {
    const c = km.concepts.find((x) => x.id === m.conceptId);
    console.log(`\n${c?.name ?? m.conceptId} (${m.conceptId})`);
    m.picks.forEach((p) =>
      console.log(
        `  pick: ${p.teachingMechanicId} (score ${p.score.toFixed(1)}) — ${p.reason}${p.targetsMisconception ? ` [targets: "${p.targetsMisconception}"]` : ""}`,
      ),
    );
    m.wishlist.forEach((w) => console.log(`  wishlist: ${w.teachingMechanicId} (score ${w.score.toFixed(1)})`));
  }
}

main().catch((err) => {
  console.error(`\n[try:pdf] failed: ${err instanceof Error ? err.message : String(err)}`);
  process.exitCode = 1;
});
