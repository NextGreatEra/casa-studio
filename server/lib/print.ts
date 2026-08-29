import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PDFDocument, rgb, type PDFFont } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import {
  BOOK_TITLE,
  INTERIOR_PAGE_COUNT,
} from "../../shared/schema.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

export const TRIM_INCHES = { width: 7, height: 10 } as const;
export const TRIM_POINTS = {
  width: TRIM_INCHES.width * 72,
  height: TRIM_INCHES.height * 72,
} as const;

export const INTERIOR_PDF_RELATIVE =
  "artifacts/interiors/la-casa-de-san-jacinto-preflight.pdf";

export function interiorPdfPath() {
  return path.join(root, INTERIOR_PDF_RELATIVE);
}

export const FONT_FILES = {
  literataRegular: path.join(root, "fonts/Literata-Regular.ttf"),
  sourceSansRegular: path.join(root, "fonts/SourceSans3-Regular.ttf"),
} as const;

const GLYPHS = "¿Niños en la recámara? ñáéíóúü ¡Observa!";

export type FontEmbedRow = {
  role: string;
  file: string;
  name: string;
  embedded: true;
};

export type PreflightResult = {
  path: string;
  pages: number;
  trimInches: typeof TRIM_INCHES;
  even: boolean;
  fonts: FontEmbedRow[];
  fontFile2: boolean;
  note: string;
};

function registerFontkit(pdf: PDFDocument) {
  const kit = (fontkit as { default?: typeof fontkit }).default ?? fontkit;
  pdf.registerFontkit(
    kit as unknown as Parameters<PDFDocument["registerFontkit"]>[0],
  );
}

async function loadFontBytes(filePath: string) {
  try {
    return await readFile(filePath);
  } catch {
    throw new Error(
      `Missing font ${filePath}. Commit the OFL TTF into fonts/. Do not fetch.`,
    );
  }
}

export async function buildInteriorPreflightPdf(): Promise<PreflightResult> {
  const pdf = await PDFDocument.create();
  registerFontkit(pdf);

  const literataBytes = await loadFontBytes(FONT_FILES.literataRegular);
  const sourceBytes = await loadFontBytes(FONT_FILES.sourceSansRegular);

  const literata: PDFFont = await pdf.embedFont(literataBytes, { subset: true });
  const sourceSans: PDFFont = await pdf.embedFont(sourceBytes, { subset: true });

  const ink = rgb(0.11, 0.09, 0.07);
  const muted = rgb(0.42, 0.36, 0.31);

  for (let pageNumber = 1; pageNumber <= INTERIOR_PAGE_COUNT; pageNumber += 1) {
    const page = pdf.addPage([TRIM_POINTS.width, TRIM_POINTS.height]);
    const { width, height } = page.getSize();
    const margin = 54;

    page.drawText(BOOK_TITLE, {
      x: margin,
      y: height - 48,
      size: 12,
      font: sourceSans,
      color: muted,
    });
    page.drawText(`página ${pageNumber} de ${INTERIOR_PAGE_COUNT}`, {
      x: width - 170,
      y: height - 48,
      size: 11,
      font: sourceSans,
      color: muted,
    });
    page.drawText(GLYPHS, {
      x: margin,
      y: height / 2 + 18,
      size: 16,
      font: literata,
      color: ink,
    });
    page.drawText(GLYPHS, {
      x: margin,
      y: height / 2 - 18,
      size: 14,
      font: sourceSans,
      color: ink,
    });
    const footer = String(pageNumber);
    const footerWidth = sourceSans.widthOfTextAtSize(footer, 10);
    page.drawText(footer, {
      x: (width - footerWidth) / 2,
      y: 36,
      size: 10,
      font: sourceSans,
      color: muted,
    });
  }

  const bytes = await pdf.save({ useObjectStreams: false });
  const latin1 = Buffer.from(bytes).toString("latin1");
  const fontFile2 =
    latin1.includes("/FontFile2") || latin1.includes("/FontFile3");

  const outPath = interiorPdfPath();
  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(outPath, bytes);

  const fonts: FontEmbedRow[] = [
    {
      role: "body",
      file: "fonts/Literata-Regular.ttf",
      name: literata.name,
      embedded: true,
    },
    {
      role: "ui",
      file: "fonts/SourceSans3-Regular.ttf",
      name: sourceSans.name,
      embedded: true,
    },
  ];

  if (!fontFile2) {
    throw new Error(
      "Preflight PDF is missing FontFile2/FontFile3 — fonts were not embedded.",
    );
  }
  if (pdf.getPageCount() !== INTERIOR_PAGE_COUNT) {
    throw new Error(
      `Expected ${INTERIOR_PAGE_COUNT} pages, got ${pdf.getPageCount()}`,
    );
  }
  if (pdf.getPageCount() % 2 !== 0) {
    throw new Error("Interior page count must be even for KDP Print.");
  }

  return {
    path: INTERIOR_PDF_RELATIVE,
    pages: pdf.getPageCount(),
    trimInches: TRIM_INCHES,
    even: true,
    fonts,
    fontFile2: true,
    note: "KDP Print will re-check embedding with pdffonts (look for emb yes). Cover wrap is not generated here.",
  };
}

export function formatPreflightReport(result: PreflightResult) {
  const lines = [
    "Casa Studio preflight",
    `PDF: ${result.path}`,
    `Pages: ${result.pages} (even=${result.even})`,
    `Trim: ${result.trimInches.width}x${result.trimInches.height} in`,
    `PDF FontFile2/3 present: ${result.fontFile2}`,
    "Font embed status (pdf-lib):",
  ];
  for (const font of result.fonts) {
    lines.push(
      `  - ${font.role}: name=${font.name} file=${font.file} embedded=${font.embedded}`,
    );
  }
  lines.push(result.note);
  return lines.join("\n");
}
