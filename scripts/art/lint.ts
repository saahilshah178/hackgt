/**
 * scripts/art/lint.ts — the SVG lint (20 §5.2 step 5, §5.3). Two passes:
 * - `lintSource` on authored/generated source (before tokens): no raw `#hex` paint outside `<!-- raw-ok -->` …
 *   `<!-- /raw-ok -->` (unclosed: to the end of the file); tokens only.
 * - `lintOutput` on the file we write: well-formed; no `<text>` left (everything engraved), no `<image>`, no external
 *   href or url(), no `<style>`/`class`/`<script>`/`<foreignObject>`/event attributes; `feGaussianBlur` is the only
 *   filter primitive; ≤ 60 KB (≤ 120 KB for `layer` assets).
 */
import { xmlError } from "./svgx";

export interface LintIssue {
  rule: string;
  message: string;
}
export const MAX_BYTES = 60 * 1024;
export const MAX_LAYER_BYTES = 120 * 1024;

const RAW_HEX = /(?<!url\(|href="|href=')#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g;

/** Source lint: raw hex colours outside raw-ok regions. */
export function lintSource(svg: string): LintIssue[] {
  const issues: LintIssue[] = [];
  // blank out raw-ok regions and id references so they cannot trip the hex check
  const masked = svg
    .replace(/<!--\s*raw-ok\s*-->[\s\S]*?(<!--\s*\/raw-ok\s*-->|$)/g, (m) => " ".repeat(m.length))
    .replace(/\bid="[^"]*"/g, (m) => " ".repeat(m.length));
  const hits = masked.match(RAW_HEX);
  if (hits) issues.push({ rule: "raw-hex", message: `raw colour(s) ${[...new Set(hits)].slice(0, 5).join(", ")}: use {{palette tokens}} (or wrap in <!-- raw-ok -->)` });
  return issues;
}

/** Output lint: the rules every written SVG must pass. */
export function lintOutput(svg: string, opts: { layer?: boolean } = {}): LintIssue[] {
  const issues: LintIssue[] = [];
  const bad = (rule: string, message: string) => issues.push({ rule, message });
  const err = xmlError(svg);
  if (err) bad("xml", `not well-formed XML: ${err}`);
  if (/<text\b/.test(svg)) bad("text", "plain <text> left: use <text data-engrave> (build-time paths) or a DOM label");
  if (/<image\b/.test(svg)) bad("image", "<image> is banned");
  if (/<style\b/.test(svg) || /\sclass="/.test(svg)) bad("style", "<style>/class are banned (inline paint only)");
  if (/<script\b/.test(svg) || /<foreignObject\b/.test(svg)) bad("script", "<script>/<foreignObject> are banned");
  if (/\son[a-z]+\s*=/.test(svg)) bad("event", "event attributes are banned");
  for (const m of svg.matchAll(/\b(?:xlink:)?href\s*=\s*"([^"]*)"/g)) if (!m[1].startsWith("#")) bad("external-ref", `external href "${m[1].slice(0, 60)}"`);
  for (const m of svg.matchAll(/url\(\s*([^)]*)\)/g)) if (!m[1].trim().startsWith("#")) bad("external-ref", `external url(${m[1].slice(0, 60)})`);
  for (const m of svg.matchAll(/<(fe[A-Z][A-Za-z]*)\b/g)) if (m[1] !== "feGaussianBlur") bad("filter", `filter primitive <${m[1]}> is banned (feGaussianBlur only)`);
  if (/rgba?\(/.test(svg)) bad("rgba", "rgba() paint is banned: tokens resolve to hex + *-opacity");
  const bytes = Buffer.byteLength(svg, "utf8");
  const cap = opts.layer ? MAX_LAYER_BYTES : MAX_BYTES;
  if (bytes > cap) bad("size", `${(bytes / 1024).toFixed(1)} KB > ${cap / 1024} KB`);
  return issues;
}

export function formatIssues(issues: LintIssue[]): string {
  return issues.map((i) => `[${i.rule}] ${i.message}`).join("; ");
}
