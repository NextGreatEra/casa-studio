#!/usr/bin/env node
/**
 * Materialize OFL TTF files onto disk so pdf-lib can embed them.
 * Regular cuts may already be in git. Extra weights download if missing.
 */
import { mkdir, writeFile, access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fontsDir = path.join(root, "fonts");

const REQUIRED = [
  {
    dest: "Literata-Regular.ttf",
    urls: [
      "https://cdn.jsdelivr.net/fontsource/fonts/literata@5.3.0/latin-400-normal.ttf",
      "https://cdn.jsdelivr.net/fontsource/fonts/literata@5.2.5/latin-400-normal.ttf",
    ],
  },
  {
    dest: "SourceSans3-Regular.ttf",
    urls: [
      "https://raw.githubusercontent.com/adobe-fonts/source-sans/release/TTF/SourceSans3-Regular.ttf",
      "https://cdn.jsdelivr.net/fontsource/fonts/source-sans-3@5.2.5/latin-400-normal.ttf",
    ],
  },
];

const OPTIONAL = [
  {
    dest: "Literata-Bold.ttf",
    urls: [
      "https://cdn.jsdelivr.net/fontsource/fonts/literata@5.2.5/latin-700-normal.ttf",
    ],
  },
  {
    dest: "SourceSans3-Semibold.ttf",
    urls: [
      "https://raw.githubusercontent.com/adobe-fonts/source-sans/release/TTF/SourceSans3-Semibold.ttf",
      "https://cdn.jsdelivr.net/fontsource/fonts/source-sans-3@5.2.5/latin-600-normal.ttf",
    ],
  },
];

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function download(urls, destPath) {
  let lastError = null;
  for (const url of urls) {
    try {
      const response = await fetch(url, { redirect: "follow" });
      if (!response.ok) {
        lastError = new Error(`${url} -> ${response.status}`);
        continue;
      }
      const buffer = Buffer.from(await response.arrayBuffer());
      if (buffer.byteLength < 10_000) {
        lastError = new Error(`${url} too small (${buffer.byteLength} bytes)`);
        continue;
      }
      await writeFile(destPath, buffer);
      console.log(`fonts: wrote ${path.basename(destPath)} (${buffer.byteLength} bytes)`);
      return;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError ?? new Error(`Failed to download ${destPath}`);
}

await mkdir(fontsDir, { recursive: true });

for (const file of REQUIRED) {
  const destPath = path.join(fontsDir, file.dest);
  if (await exists(destPath)) {
    console.log(`fonts: keep existing ${file.dest}`);
    continue;
  }
  await download(file.urls, destPath);
}

for (const file of OPTIONAL) {
  const destPath = path.join(fontsDir, file.dest);
  if (await exists(destPath)) {
    console.log(`fonts: keep existing ${file.dest}`);
    continue;
  }
  try {
    await download(file.urls, destPath);
  } catch (error) {
    console.warn(`fonts: optional ${file.dest} skipped`, error);
  }
}
