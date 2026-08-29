#!/usr/bin/env node
/**
 * Fail closed: OFL Regulars must already be in git.
 * Do not download fonts.
 */
import { access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const required = [
  "fonts/Literata-Regular.ttf",
  "fonts/SourceSans3-Regular.ttf",
];

for (const rel of required) {
  const filePath = path.join(root, rel);
  try {
    await access(filePath);
    console.log(`fonts: have ${rel}`);
  } catch {
    throw new Error(`Missing ${rel}. Commit the OFL TTF. Do not fetch.`);
  }
}
