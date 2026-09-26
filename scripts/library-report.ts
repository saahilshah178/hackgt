import { CARDS, validateCatalog } from "../src/library/index";
import { allModes, modeKey } from "../src/mechanics/registry";

/*
 * `pnpm library:report`: prints catalog counts by domain, by family·mode (with implemented status),
 * flagship status, and validateCatalog() errors. Exit code 1 on any validation error.
 */

const ok = (s: string) => `  ✔ ${s}`;
const bad = (s: string) => `  ✘ ${s}`;
const info = (s: string) => `  · ${s}`;

console.log(`Library report — ${CARDS.length} cards\n`);

// ---- counts by domain ----
console.log("By domain:");
const byDomain = new Map<string, number>();
for (const c of CARDS) byDomain.set(c.domain, (byDomain.get(c.domain) ?? 0) + 1);
for (const [domain, count] of [...byDomain.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(info(`${domain}: ${count}`));
}
console.log();

// ---- counts by family·mode ----
console.log("By family·mode:");
const byMode = new Map<string, number>();
for (const c of CARDS) {
  const key = modeKey(c.family, c.mode);
  byMode.set(key, (byMode.get(key) ?? 0) + 1);
}
const modes = allModes();
let implementedCardCount = 0;
let catalogOnlyCardCount = 0;
for (const m of modes) {
  const count = byMode.get(m.key) ?? 0;
  if (count === 0) continue;
  if (m.mode.implemented) implementedCardCount += count;
  else catalogOnlyCardCount += count;
  const status = m.mode.implemented ? "implemented" : "catalog-only";
  console.log(info(`${m.key}: ${count} card${count === 1 ? "" : "s"} (${status})`));
}
// modes referenced by cards but not registered at all (shouldn't happen if validateCatalog passes)
const registeredKeys = new Set(modes.map((m) => m.key));
for (const [key, count] of byMode.entries()) {
  if (!registeredKeys.has(key)) console.log(bad(`${key}: ${count} card(s) reference an UNREGISTERED mode`));
}
console.log();
console.log(`Implemented: ${implementedCardCount} cards · Catalog-only: ${catalogOnlyCardCount} cards\n`);

// ---- flagships ----
console.log("Flagships (LIBRARY §7):");
const flagships = CARDS.filter((c) => c.flagship);
for (const f of flagships.sort((a, b) => a.id.localeCompare(b.id))) {
  const key = modeKey(f.family, f.mode);
  const mode = modes.find((m) => m.key === key);
  if (mode?.mode.implemented) {
    console.log(ok(`${f.id} — playable now (${key})`));
  } else {
    console.log(bad(`${f.id} — waiting on ${key}`));
  }
}
console.log(`\n${flagships.length} flagship cards total.\n`);

// ---- validation ----
const issues = validateCatalog();
if (issues.length === 0) {
  console.log(ok("validateCatalog(): no issues"));
} else {
  console.log(bad(`validateCatalog(): ${issues.length} issue(s)`));
  for (const issue of issues) console.log(bad(`${issue.cardId}: ${issue.message}`));
}

if (issues.length > 0) process.exit(1);
