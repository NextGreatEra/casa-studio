import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildInteriorPreflightPdf,
  formatPreflightReport,
} from "../server/lib/print.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const copyFonts = path.join(root, "scripts/copy-fonts.mjs");

const copied = spawnSync(process.execPath, [copyFonts], {
  cwd: root,
  stdio: "inherit",
});
if (copied.status !== 0) {
  process.exit(copied.status ?? 1);
}

const result = await buildInteriorPreflightPdf();
console.log(formatPreflightReport(result));
