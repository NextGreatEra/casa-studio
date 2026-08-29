import { mkdir, access, writeFile, stat } from "node:fs/promises";

const fonts = [
  {
    name: "Literata-Regular.ttf",
    urls: [
      "https://github.com/google/fonts/raw/main/ofl/literata/Literata%5Bopsz%2Cwght%5D.ttf",
      "https://cdn.jsdelivr.net/fontsource/fonts/literata@5.2.5/latin-ext-400-normal.ttf",
    ],
  },
  {
    name: "SourceSans3-Regular.ttf",
    urls: [
      "https://github.com/adobe-fonts/source-sans/raw/release/TTF/SourceSans3-Regular.ttf",
      "https://cdn.jsdelivr.net/fontsource/fonts/source-sans-3@5.2.8/latin-ext-400-normal.ttf",
    ],
  },
];

await mkdir("fonts", { recursive: true });

for (const font of fonts) {
  const dest = `fonts/${font.name}`;
  try {
    await access(dest);
    const s = await stat(dest);
    if (s.size > 10000) {
      console.log("have", dest, s.size);
      continue;
    }
  } catch {}
  let lastErr;
  for (const url of font.urls) {
    try {
      console.log("fetch", url);
      const res = await fetch(url, { redirect: "follow" });
      if (!res.ok) throw new Error(`${res.status} ${url}`);
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 10000) throw new Error(`too small ${buf.length} from ${url}`);
      await writeFile(dest, buf);
      console.log("wrote", dest, buf.length);
      lastErr = null;
      break;
    } catch (err) {
      lastErr = err;
    }
  }
  if (lastErr) throw lastErr;
}
