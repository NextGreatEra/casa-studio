import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PDFDocument, rgb, type PDFFont } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import {
  BOOK_TITLE,
  INTERIOR_PAGE_COUNT,
  SPANISH_PROOF,
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
  literataBold: path.join(root, "fonts/Literata-Bold.ttf"),
  sourceSansRegular: path.join(root, "fonts/SourceSans3-Regular.ttf"),
  sourceSansSemibold: path.join(root, "fonts/SourceSans3-Semibold.ttf"),
} as const;

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
      `Missing font ${filePath}. Run scripts/copy-fonts.mjs so TTF files land in fonts/.`,
    );
  }
}

async function embedWithFallback(
  pdf: PDFDocument,
  preferredPath: string,
  fallback: PDFFont,
  fallbackBytes: Buffer,
): Promise<PDFFont> {
  try {
    const bytes = await readFile(preferredPath);
    return await pdf.embedFont(bytes, { subset: true });
  } catch {
    return fallbackBytes === undefined
      ? fallback
      : fallback;
  }
}

export async function buildInteriorPreflightPdf(): Promise<PreflightResult> {
  const pdf = await PDFDocument.create();
  registerFontkit(pdf);

  const literataBytes = await loadFontBytes(FONT_FILES.literataRegular);
  const sourceBytes = await loadFontBytes(FONT_FILES.sourceSansRegular);

  const literata = await pdf.embedFont(literataBytes, { subset: true });
  const sourceSans = await pdf.embedFont(sourceBytes, { subset: true });
  const literataBold = await embedWithFallback(
    pdf,
    FONT_FILES.literataBold,
    literata,
    literataBytes,
  );
  const sourceSemibold = await embedWithFallback(
    pdf,
    FONT_FILES.sourceSansSemibold,
    sourceSans,
    sourceBytes,
  );

  const ink = rgb(0.11, 0.09, 0.07);
  const muted = rgb(0.42, 0.36, 0.31);
  const rule = rgb(0.72, 0.64, 0.52);

  for (let pageNumber = 1; pageNumber <= INTERIOR_PAGE_COUNT; pageNumber += 1) {
    const page = pdf.addPage([TRIM_POINTS.width, TRIM_POINTS.height]);
    const { width, height } = page.getSize();
    const margin = 54;

    page.drawText(BOOK_TITLE, {
      x: margin,
      y: height - 42,
      size: 10,
      font: sourceSans,
      color: muted,
    });
    page.drawLine({
      start: { x: margin, y: height - 50 },
      end: { x: width - margin, y: height - 50 },
      thickness: 0.4,
      color: rule,
    });

    if (pageNumber === 1) {
      page.drawText("Preflight proof", {
        x: margin,
        y: height - 120,
        size: 11,
        font: sourceSemibold,
        color: muted,
      });
      page.drawText(BOOK_TITLE, {
        x: margin,
        y: height - 168,
        size: 22,
        font: literataBold,
        color: ink,
      });
      page.drawText("7 x 10 in · 136 pages · even · fonts embedded", {
        x: margin,
        y: height - 196,
        size: 11,
        font: sourceSans,
        color: muted,
      });
      page.drawText(
        "Numbered blank pages for KDP Print preflight. Not a manuscript dump.",
        {
          x: margin,
          y: height - 248,
          size: 12,
          font: literata,
          color: ink,
        },
      );
      page.drawText(`Spanish glyphs: ${SPANISH_PROOF}`, {
        x: margin,
        y: height - 280,
        size: 12,
        font: literata,
        color: ink,
      });
      page.drawText("Cover wrap is untouched. This file is interior only.", {
        x: margin,
        y: height - 312,
        size: 11,
        font: sourceSans,
        color: muted,
      });
    }

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

  const bytes = await pdf.save();
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
      role: "body-emphasis",
      file: literataBold === literata ? "fonts/Literata-Regular.ttf" : "fonts/Literata-Bold.ttf",
      name: literataBold.name,
      embedded: true,
    },
    {
      role: "ui",
      file: "fonts/SourceSans3-Regular.ttf",
      name: sourceSans.name,
      embedded: true,
    },
    {
      role: "ui-emphasis",
      file: sourceSemibold === sourceSans ? "fonts/SourceSans3-Regular.ttf" : "fonts/SourceSans3-Semibold.ttf",
      name: sourceSemibold.name,
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
