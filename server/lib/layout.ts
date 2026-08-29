import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb } from "pdf-lib";

const PAGE_W = 7 * 72;
const PAGE_H = 10 * 72;
const PAGE_COUNT = 136;
const SPANISH_PROOF = "¿Niños en la recámara? ñáéíóúü ¡Observa!";

export function coverAllowed(pageCount: number | null | undefined, frozen: boolean): boolean {
  return frozen === true && typeof pageCount === "number" && pageCount > 0 && pageCount % 2 === 0;
}

export async function renderInteriorPreflight(outPath = "artifacts/interior-preflight.pdf"): Promise<{
  path: string;
  pages: number;
  fonts: string[];
}> {
  const here = dirname(fileURLToPath(import.meta.url));
  const fontsDir = join(here, "../../fonts");
  const literata = await readFile(join(fontsDir, "Literata-Regular.ttf"));
  const sourceSans = await readFile(join(fontsDir, "SourceSans3-Regular.ttf"));

  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const body = await doc.embedFont(literata, { subset: true });
  const ui = await doc.embedFont(sourceSans, { subset: true });

  for (let i = 1; i <= PAGE_COUNT; i++) {
    const page = doc.addPage([PAGE_W, PAGE_H]);
    page.drawText("La casa de San Jacinto", {
      font: ui,
      size: 11,
      x: 54,
      y: PAGE_H - 42,
      color: rgb(0.15, 0.15, 0.15),
    });
    page.drawText(`preflight · ${i} / ${PAGE_COUNT}`, {
      font: ui,
      size: 10,
      x: PAGE_W - 160,
      y: PAGE_H - 42,
      color: rgb(0.3, 0.3, 0.3),
    });
    page.drawText(SPANISH_PROOF, {
      font: body,
      size: 14,
      x: 54,
      y: PAGE_H / 2,
    });
    page.drawText(String(i), {
      font: ui,
      size: 10,
      x: PAGE_W / 2 - 10,
      y: 36,
    });
  }

  const bytes = await doc.save();
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, bytes);
  return {
    path: outPath,
    pages: doc.getPageCount(),
    fonts: [body.name, ui.name],
  };
}
