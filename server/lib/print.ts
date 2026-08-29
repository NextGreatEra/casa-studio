import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PDFDocument, rgb, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { BOOK_TITLE, INTERIOR_PAGE_COUNT } from "../../shared/schema.ts";
import { PART_I_CHAPTERS, type PartIChapter } from "../../shared/part-i.ts";
import { typesetChapter1, type Ch1Context } from "./chapter1.ts";

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

const MARGIN = 0.62 * 72;
const GREEN = rgb(0.18, 0.32, 0.24);
const INK = rgb(0.11, 0.09, 0.07);
const MUTED = rgb(0.38, 0.34, 0.3);
const RUST = rgb(0.62, 0.32, 0.18);
const WHITE = rgb(1, 1, 1);

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
  rastersEmbedded: boolean;
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

export const CH1_RASTERS = {
  courtyard: "art/ch1/courtyard.jpg",
  puerta: "art/ch1/puerta.jpg",
  gota: "art/ch1/gota.jpg",
  abueloEsposos: "art/ch1/abuelo-esposos.jpg",
  lola: "art/ch1/lola.jpg",
} as const;

export const MIN_RASTER_SHORT_EDGE = 900;

export type Ch1RasterKey = keyof typeof CH1_RASTERS;
export type Ch1Rasters = Record<Ch1RasterKey, PDFImage>;

async function loadRasters(pdf: PDFDocument): Promise<Ch1Rasters> {
  const rasters = {} as Ch1Rasters;
  for (const key of Object.keys(CH1_RASTERS) as Ch1RasterKey[]) {
    const rel = CH1_RASTERS[key];
    const filePath = path.join(root, rel);
    let bytes: Buffer;
    try {
      bytes = await readFile(filePath);
    } catch {
      throw new Error(
        `Missing ${rel}. Commit the JPEG (GitHub web UI). Layout fails closed.`,
      );
    }
    const img = await pdf.embedJpg(bytes);
    const short = Math.min(img.width, img.height);
    if (short < MIN_RASTER_SHORT_EDGE) {
      throw new Error(
        `${rel} short edge ${short}px < ${MIN_RASTER_SHORT_EDGE}.`,
      );
    }
    rasters[key] = img;
  }
  return rasters;
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(test, size) > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function chapterStory(chapter: PartIChapter) {
  return chapter.story.replace(/^\?\s*\n+/, "");
}

type TypesetFonts = { body: PDFFont; ui: PDFFont };

async function typesetInterior(chapterStarts: number[] | null) {
  const pdf = await PDFDocument.create();
  registerFontkit(pdf);

  const literataBytes = await loadFontBytes(FONT_FILES.literataRegular);
  const sourceBytes = await loadFontBytes(FONT_FILES.sourceSansRegular);
  const body = await pdf.embedFont(literataBytes, { subset: true });
  const ui = await pdf.embedFont(sourceBytes, { subset: true });
  const fonts: TypesetFonts = { body, ui };
  const rasters = await loadRasters(pdf);

  const starts = chapterStarts ? [...chapterStarts] : [];
  const recording = chapterStarts === null;

  const addPage = (): PDFPage => {
    const page = pdf.addPage([TRIM_POINTS.width, TRIM_POINTS.height]);
    page.drawRectangle({
      x: 0,
      y: 0,
      width: TRIM_POINTS.width,
      height: TRIM_POINTS.height,
      color: WHITE,
    });
    return page;
  };

  const footer = (page: PDFPage) => {
    const n = String(pdf.getPageCount());
    const w = ui.widthOfTextAtSize(n, 10);
    page.drawText(n, {
      x: (TRIM_POINTS.width - w) / 2,
      y: 32,
      size: 10,
      font: ui,
      color: MUTED,
    });
  };

  const header = (page: PDFPage, title: string) => {
    if (title) {
      const w = ui.widthOfTextAtSize(title, 9);
      page.drawText(title, {
        x: (TRIM_POINTS.width - w) / 2,
        y: TRIM_POINTS.height - 36,
        size: 9,
        font: ui,
        color: MUTED,
      });
    }
    page.drawLine({
      start: { x: MARGIN, y: TRIM_POINTS.height - 44 },
      end: { x: TRIM_POINTS.width - MARGIN, y: TRIM_POINTS.height - 44 },
      thickness: 0.6,
      color: GREEN,
    });
  };

  const drawTitlePage = () => {
    const page = addPage();
    page.drawText(BOOK_TITLE, {
      x: MARGIN,
      y: TRIM_POINTS.height - 180,
      size: 28,
      font: body,
      color: GREEN,
    });
    page.drawText("Parte I · La casa", {
      x: MARGIN,
      y: TRIM_POINTS.height - 220,
      size: 16,
      font: ui,
      color: INK,
    });
    page.drawText("Capítulos 1–8", {
      x: MARGIN,
      y: TRIM_POINTS.height - 248,
      size: 12,
      font: ui,
      color: MUTED,
    });
    page.drawText("Una novela graduada en español", {
      x: MARGIN,
      y: TRIM_POINTS.height - 320,
      size: 12,
      font: body,
      color: INK,
    });
    page.drawText("Español mexicano · A1 alto", {
      x: MARGIN,
      y: TRIM_POINTS.height - 344,
      size: 11,
      font: ui,
      color: MUTED,
    });
    footer(page);
  };

  const drawComoUsar = () => {
    const page = addPage();
    header(page, "Cómo usar este libro");
    let y = TRIM_POINTS.height - 72;
    const paras = [
      "Esta historia está diseñada para aprender español mientras sigues una trama continua. El texto principal permanece en español y las ilustraciones, repeticiones y ejemplos ayudan a comprender el significado sin depender de traducciones.",
      "Cada capítulo presenta una situación nueva, recicla lenguaje anterior y concentra la atención en un solo patrón gramatical principal. La sección Observa resume ese patrón después de la historia; las Preguntas comprueban comprensión y recuperación.",
      "Lee primero por la historia. No intentes entender cada palabra. Después vuelve a las imágenes, a Observa y a las preguntas.",
      "Esta edición es la Parte I: ocho capítulos para consolidar A1 alto. Los capítulos 9–36 permanecen en el manuscrito, no en este libro.",
    ];
    const max = TRIM_POINTS.width - MARGIN * 2;
    for (const para of paras) {
      for (const line of wrap(para, body, 11.5, max)) {
        page.drawText(line, {
          x: MARGIN,
          y,
          size: 11.5,
          font: body,
          color: INK,
        });
        y -= 16;
      }
      y -= 10;
    }
    footer(page);
  };

  const drawToc = () => {
    const page = addPage();
    header(page, "Contenido");
    page.drawText("Contenido", {
      x: MARGIN,
      y: TRIM_POINTS.height - 80,
      size: 18,
      font: body,
      color: GREEN,
    });
    let y = TRIM_POINTS.height - 120;
    for (const chapter of PART_I_CHAPTERS) {
      const start = starts[chapter.number - 1];
      const left = `Capítulo ${chapter.number} — ${chapter.title}`;
      page.drawText(left, {
        x: MARGIN,
        y,
        size: 12,
        font: body,
        color: INK,
      });
      const num = start ? String(start) : "—";
      const nw = ui.widthOfTextAtSize(num, 12);
      page.drawText(num, {
        x: TRIM_POINTS.width - MARGIN - nw,
        y,
        size: 12,
        font: ui,
        color: MUTED,
      });
      y -= 22;
    }
    footer(page);
  };

  const drawPartOpener = () => {
    const page = addPage();
    page.drawText("PARTE I", {
      x: MARGIN,
      y: TRIM_POINTS.height / 2 + 24,
      size: 12,
      font: ui,
      color: MUTED,
    });
    page.drawText("La casa", {
      x: MARGIN,
      y: TRIM_POINTS.height / 2 - 8,
      size: 32,
      font: body,
      color: GREEN,
    });
    footer(page);
  };

  const flowStory = (chapter: PartIChapter) => {
    const max = TRIM_POINTS.width - MARGIN * 2;
    const paras = chapterStory(chapter).split(/\n\s*\n/);
    let page = addPage();
    if (recording) starts[chapter.number - 1] = pdf.getPageCount();
    let y = TRIM_POINTS.height - 80;
    page.drawText(`CAPÍTULO ${chapter.number}`, {
      x: MARGIN,
      y,
      size: 11,
      font: ui,
      color: RUST,
    });
    y -= 22;
    page.drawText(chapter.title, {
      x: MARGIN,
      y,
      size: 22,
      font: body,
      color: GREEN,
    });
    y -= 36;

    const newPage = () => {
      footer(page);
      page = addPage();
      header(page, chapter.title);
      y = TRIM_POINTS.height - 64;
    };

    for (const para of paras) {
      const lines = wrap(para.replace(/\n/g, " "), body, 11.5, max);
      if (y - lines.length * 16 < 56) newPage();
      for (const line of lines) {
        if (y < 56) newPage();
        page.drawText(line, {
          x: MARGIN,
          y,
          size: 11.5,
          font: body,
          color: INK,
        });
        y -= 16;
      }
      y -= 8;
    }
    footer(page);
  };

  const drawObservaPreguntas = (chapter: PartIChapter) => {
    const page = addPage();
    header(page, chapter.title);
    const max = TRIM_POINTS.width - MARGIN * 2;
    let y = TRIM_POINTS.height - 72;

    page.drawRectangle({
      x: MARGIN,
      y: y - 18,
      width: max,
      height: 22,
      color: GREEN,
    });
    page.drawText("OBSERVA", {
      x: MARGIN + 10,
      y: y - 12,
      size: 11,
      font: ui,
      color: rgb(1, 1, 1),
    });
    y -= 40;
    for (const line of chapter.observa
      .split(/\n+/)
      .map((item) => item.trim())
      .filter(Boolean)) {
      for (const wrapped of wrap(line, body, 12, max - 16)) {
        page.drawText(wrapped, {
          x: MARGIN + 8,
          y,
          size: 12,
          font: body,
          color: INK,
        });
        y -= 18;
      }
      y -= 4;
    }

    y -= 16;
    page.drawRectangle({
      x: MARGIN,
      y: y - 18,
      width: max,
      height: 22,
      color: GREEN,
    });
    page.drawText("PREGUNTAS", {
      x: MARGIN + 10,
      y: y - 12,
      size: 11,
      font: ui,
      color: rgb(1, 1, 1),
    });
    y -= 44;
    chapter.preguntas.forEach((question, index) => {
      const label = `${index + 1}. `;
      const lines = wrap(question, body, 12, max - 24);
      page.drawText(label, {
        x: MARGIN + 8,
        y,
        size: 12,
        font: ui,
        color: GREEN,
      });
      const lw = ui.widthOfTextAtSize(label, 12);
      lines.forEach((ln, lineIndex) => {
        page.drawText(ln, {
          x: MARGIN + 8 + (lineIndex === 0 ? lw : 18),
          y,
          size: 12,
          font: body,
          color: INK,
        });
        y -= 18;
      });
      y -= 6;
    });
    footer(page);
  };

  drawTitlePage();
  drawComoUsar();
  drawToc();
  drawPartOpener();
  for (const chapter of PART_I_CHAPTERS) {
    if (chapter.number === 1) {
      const ch1: Ch1Context = {
        pdf,
        fonts,
        addPage,
        recording,
        starts,
        rasters,
      };
      typesetChapter1(ch1, chapter);
    } else {
      flowStory(chapter);
      drawObservaPreguntas(chapter);
    }
  }
  if (pdf.getPageCount() % 2 !== 0) {
    const page = addPage();
    header(page, "");
    footer(page);
  }

  return { pdf, starts, fonts, rastersEmbedded: true };
}

export async function buildInteriorPreflightPdf(): Promise<PreflightResult> {
  if (PART_I_CHAPTERS.length < 8) {
    throw new Error(
      `Part I needs at least 8 chapters, got ${PART_I_CHAPTERS.length}.`,
    );
  }

  const first = await typesetInterior(null);
  const { pdf, fonts, rastersEmbedded } = await typesetInterior(first.starts);
  const bytes = await pdf.save({ useObjectStreams: false });
  const latin1 = Buffer.from(bytes).toString("latin1");
  const fontFile2 =
    latin1.includes("/FontFile2") || latin1.includes("/FontFile3");

  if (latin1.includes("Tiene agua en el pelo")) {
    throw new Error("v5 lock: do not print Tiene agua en el pelo.");
  }
  if (latin1.includes("PALABRAS DE LUGAR")) {
    throw new Error("Do not print a Palabras recap.");
  }

  const outPath = interiorPdfPath();
  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(outPath, bytes);

  const fontRows: FontEmbedRow[] = [
    {
      role: "body",
      file: "fonts/Literata-Regular.ttf",
      name: fonts.body.name,
      embedded: true,
    },
    {
      role: "ui",
      file: "fonts/SourceSans3-Regular.ttf",
      name: fonts.ui.name,
      embedded: true,
    },
  ];

  const pages = pdf.getPageCount();
  if (!fontFile2) {
    throw new Error(
      "Preflight PDF is missing FontFile2/FontFile3 — fonts were not embedded.",
    );
  }
  if (pages % 2 !== 0) {
    throw new Error("Interior page count must be even for KDP Print.");
  }
  if (pages !== INTERIOR_PAGE_COUNT) {
    throw new Error(
      `Expected ${INTERIOR_PAGE_COUNT} Part I pages, got ${pages}`,
    );
  }

  const rasterNote =
    "Ch 1 JPEGs embedded from art/ch1 (courtyard, puerta, gota, abuelo-esposos, lola). Live labels only.";

  return {
    path: INTERIOR_PDF_RELATIVE,
    pages,
    trimInches: TRIM_INCHES,
    even: true,
    fonts: fontRows,
    fontFile2: true,
    rastersEmbedded,
    note: `Part I live type (ch 1–8). Ch 1 uses the labeled-card page model (RELACIONES, LA PUERTA actor-neutral, EL TECHO Y LA GOTA, PLIP, OBSERVA, PREGUNTAS). ${rasterNote} KDP Print will re-check embedding with pdffonts (look for emb yes). Cover wrap is not generated here.`,
  };
}

export function formatPreflightReport(result: PreflightResult) {
  const lines = [
    "Casa Studio preflight — Parte I",
    `PDF: ${result.path}`,
    `Pages: ${result.pages} (even=${result.even})`,
    `Trim: ${result.trimInches.width}x${result.trimInches.height} in`,
    `PDF FontFile2/3 present: ${result.fontFile2}`,
    `Ch 1 rasters embedded: ${result.rastersEmbedded}`,
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
