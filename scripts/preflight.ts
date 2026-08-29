import { coverAllowed, renderInteriorPreflight } from "../server/lib/layout.ts";

if (coverAllowed(135, true)) {
  throw new Error("cover must refuse odd page counts");
}
if (coverAllowed(136, false)) {
  throw new Error("cover must refuse unfrozen interiors");
}
if (!coverAllowed(136, true)) {
  throw new Error("cover should allow even frozen interiors");
}

const result = await renderInteriorPreflight("artifacts/interior-preflight.pdf");
if (result.pages !== 136) {
  throw new Error(`expected 136 pages, got ${result.pages}`);
}
const names = result.fonts.join(", ");
if (/Helvetica|Times/i.test(names)) {
  throw new Error(`standard fonts leaked: ${names}`);
}
if (result.fonts.length < 2) {
  throw new Error(`expected embedded Literata + Source Sans 3, got ${names}`);
}
console.log(JSON.stringify({ ok: true, ...result, coverBlockedUntilEvenFrozen: true }, null, 2));
