#!/usr/bin/env node
/** OFL TTFs must already be in fonts/. No network fetch. */
import { access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const required = ["Literata-Regular.ttf", "SourceSans3-Regular.ttf"];

for (const name of required) {
  const dest = path.join(root, "fonts", name);
  try {
    await access(dest);
    console.log("fonts: have", name);
  } catch {
    throw new Error(
      `Missing fonts/${name}. Commit the OFL TTF into git. This script does not download fonts.`,
    );
  }
}
