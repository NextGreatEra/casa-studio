import {
  clip,
  degrees,
  endPath,
  popGraphicsState,
  pushGraphicsState,
  rectangle,
  rgb,
  type PDFDocument,
  type PDFFont,
  type PDFImage,
  type PDFPage,
} from "pdf-lib";
import type { PartIChapter } from "../../shared/part-i.ts";

export const TRIM = { width: 7 * 72, height: 10 * 72 };
export const MARGIN = 0.62 * 72;

const GREEN = rgb(0.18, 0.32, 0.24);
const INK = rgb(0.11, 0.09, 0.07);
const MUTED = rgb(0.38, 0.34, 0.3);
const RUST = rgb(0.62, 0.32, 0.18);
const WHITE = rgb(1, 1, 1);
const CARD_FILL = rgb(0.985, 0.98, 0.965);
const WOOD = rgb(0.55, 0.36, 0.2);
const WOOD_DARK = rgb(0.34, 0.2, 0.1);
const WOOD_LIGHT = rgb(0.72, 0.52, 0.32);
const DROP = rgb(0.42, 0.6, 0.78);
const BUCKET = rgb(0.2, 0.42, 0.62);
const TILE = rgb(0.7, 0.38, 0.22);

const STORY_SIZE = 11;
const STORY_LEAD = 15;
const UI_SIZE = 8.5;

export type Ch1Fonts = { body: PDFFont; ui: PDFFont };

export type Ch1Rasters = {
  courtyard: PDFImage;
  puerta: PDFImage;
  gota: PDFImage;
  abueloEsposos: PDFImage;
  lola: PDFImage;
};

export type Ch1Context = {
  pdf: PDFDocument;
  fonts: Ch1Fonts;
  addPage: () => PDFPage;
  recording: boolean;
  starts: number[];
  rasters: Ch1Rasters;
};

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

function paras(block: string) {
  return block
    .split(/\n\s*\n/)
    .map((item) => item.replace(/\n/g, " ").trim())
    .filter(Boolean);
}

export function splitChapter1Story(story: string) {
  const text = story.replace(/^\?\s*\n+/, "").trim();
  const openerMark = "¡Bienvenidos a San Jacinto!";
  const spread1Mark = "—¿Ves? —dice Don Rafael—. La casa está bien.";
  const spread2Mark = "Mira a su abuelo.";
  const openerAt = text.indexOf(openerMark);
  const s1At = text.indexOf(spread1Mark);
  const s2At = text.indexOf(spread2Mark);
  if (openerAt < 0 || s1At < 0 || s2At < 0 || !(openerAt < s1At && s1At < s2At)) {
    throw new Error("Chapter 1 story marks for the 4-page card model are missing.");
  }
  return {
    opener: text.slice(0, openerAt + openerMark.length).trim(),
    spread1: text.slice(openerAt + openerMark.length, s1At + spread1Mark.length).trim(),
    spread2: text.slice(s1At + spread2Mark.length, s2At + spread2Mark.length).trim(),
    close: text.slice(s2At + spread2Mark.length).trim(),
  };
}

function folioLeft(page: PDFPage, n: number, ui: PDFFont) {
  page.drawText(String(n), {
    x: MARGIN,
    y: 28,
    size: 9,
    font: ui,
    color: MUTED,
  });
}

function continuationHeader(page: PDFPage, title: string, fonts: Ch1Fonts) {
  page.drawText(title, {
    x: MARGIN,
    y: TRIM.height - 36,
    size: 12,
    font: fonts.body,
    color: GREEN,
  });
  page.drawLine({
    start: { x: MARGIN, y: TRIM.height - 44 },
    end: { x: TRIM.width - MARGIN, y: TRIM.height - 44 },
    thickness: 0.8,
    color: GREEN,
  });
}

function column() {
  const content = TRIM.width - MARGIN * 2;
  const gutter = 14;
  const storyW = content * 0.62;
  const cardW = content - storyW - gutter;
  return {
    content,
    gutter,
    storyX: MARGIN,
    storyW,
    cardX: MARGIN + storyW + gutter,
    cardW,
  };
}

function drawClippedImage(
  page: PDFPage,
  img: PDFImage,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const scale = Math.max(w / img.width, h / img.height);
  const dw = img.width * scale;
  const dh = img.height * scale;
  page.pushOperators(
    pushGraphicsState(),
    rectangle(x, y, w, h),
    clip(),
    endPath(),
  );
  page.drawImage(img, {
    x: x + (w - dw) / 2,
    y: y + (h - dh) / 2,
    width: dw,
    height: dh,
  });
  page.pushOperators(popGraphicsState());
}

function drawLabelChip(
  page: PDFPage,
  text: string,
  boxX: number,
  boxY: number,
  targetX: number,
  targetY: number,
  ui: PDFFont,
) {
  const size = 8;
  const pad = 3.5;
  const tw = ui.widthOfTextAtSize(text, size);
  const bw = tw + pad * 2;
  const bh = 11;
  page.drawLine({
    start: { x: boxX + bw / 2, y: boxY },
    end: { x: targetX, y: targetY },
    thickness: 0.6,
    color: GREEN,
  });
  page.drawEllipse({
    x: targetX,
    y: targetY,
    xScale: 1.6,
    yScale: 1.6,
    color: GREEN,
  });
  page.drawRectangle({
    x: boxX,
    y: boxY,
    width: bw,
    height: bh,
    color: WHITE,
    borderColor: GREEN,
    borderWidth: 0.7,
  });
  page.drawText(text, {
    x: boxX + pad,
    y: boxY + 2.4,
    size,
    font: ui,
    color: GREEN,
  });
}

function drawModule(
  page: PDFPage,
  x: number,
  top: number,
  width: number,
  height: number,
  title: string,
  ui: PDFFont,
) {
  const headerH = 16;
  const bottom = top - height;
  page.drawRectangle({
    x,
    y: bottom,
    width,
    height,
    color: CARD_FILL,
    borderColor: GREEN,
    borderWidth: 0.9,
  });
  page.drawRectangle({
    x,
    y: top - headerH,
    width,
    height: headerH,
    color: GREEN,
  });
  const tw = ui.widthOfTextAtSize(title, UI_SIZE);
  page.drawText(title, {
    x: x + (width - tw) / 2,
    y: top - headerH + 4.2,
    size: UI_SIZE,
    font: ui,
    color: WHITE,
  });
  return {
    x: x + 7,
    y: top - headerH - 8,
    w: width - 14,
    h: height - headerH - 14,
    bottom: bottom + 6,
  };
}

function drawNameChip(
  page: PDFPage,
  name: string,
  cx: number,
  y: number,
  fonts: Ch1Fonts,
) {
  const size = 8;
  const tw = fonts.ui.widthOfTextAtSize(name, size);
  const bw = Math.max(52, tw + 10);
  const bh = 28;
  const x = cx - bw / 2;
  page.drawRectangle({
    x,
    y,
    width: bw,
    height: bh,
    color: WHITE,
    borderColor: GREEN,
    borderWidth: 0.8,
  });
  page.drawText(name, {
    x: cx - tw / 2,
    y: y + 10,
    size,
    font: fonts.ui,
    color: GREEN,
  });
  return { x, y, w: bw, h: bh };
}

function drawRelaciones(
  page: PDFPage,
  inner: { x: number; y: number; w: number; h: number; bottom: number },
  fonts: Ch1Fonts,
  rasters: Ch1Rasters,
) {
  const imgH = inner.h * 0.55;
  const imgY = inner.y - imgH;
  drawClippedImage(page, rasters.abueloEsposos, inner.x, imgY, inner.w, imgH);
  const cx = inner.x + inner.w / 2;
  const topChip = imgY - 32;
  drawNameChip(page, "Don Rafael", cx, topChip, fonts);
  const midY = topChip - 28;
  page.drawLine({
    start: { x: cx, y: topChip },
    end: { x: cx, y: midY - 6 },
    thickness: 0.7,
    color: INK,
  });
  const abuelo = "abuelo";
  page.drawText(abuelo, {
    x: cx + 6,
    y: midY + 4,
    size: 7.5,
    font: fonts.ui,
    color: MUTED,
  });
  const pairY = inner.bottom + 18;
  const leftCx = inner.x + inner.w * 0.28;
  const rightCx = inner.x + inner.w * 0.72;
  drawNameChip(page, "Tomás", leftCx, pairY, fonts);
  drawNameChip(page, "Ana", rightCx, pairY, fonts);
  page.drawLine({
    start: { x: leftCx + 26, y: pairY + 14 },
    end: { x: rightCx - 26, y: pairY + 14 },
    thickness: 0.7,
    color: INK,
  });
  const esposos = "esposos";
  const ew = fonts.ui.widthOfTextAtSize(esposos, 7.5);
  page.drawText(esposos, {
    x: cx - ew / 2,
    y: pairY + 18,
    size: 7.5,
    font: fonts.ui,
    color: MUTED,
  });
  page.drawLine({
    start: { x: cx, y: midY - 6 },
    end: { x: leftCx, y: pairY + 28 },
    thickness: 0.7,
    color: INK,
  });
}

function drawWoodenDoor(
  page: PDFPage,
  x: number,
  y: number,
  w: number,
  h: number,
  ajar: boolean,
) {
  page.drawRectangle({
    x: x - 3,
    y: y - 3,
    width: w + 6,
    height: h + 6,
    borderColor: WOOD_DARK,
    borderWidth: 1.4,
    color: rgb(0.86, 0.8, 0.72),
  });
  const doorX = ajar ? x - 10 : x;
  const doorW = ajar ? w * 0.62 : w;
  page.drawRectangle({
    x: doorX,
    y,
    width: doorW,
    height: h,
    color: WOOD_LIGHT,
    borderColor: WOOD_DARK,
    borderWidth: 1.1,
  });
  const inset = 5;
  const panelH = (h - inset * 3) / 2;
  page.drawRectangle({
    x: doorX + inset,
    y: y + h - inset - panelH,
    width: doorW - inset * 2 - 7,
    height: panelH,
    borderColor: WOOD_DARK,
    borderWidth: 0.7,
    color: WOOD,
  });
  page.drawRectangle({
    x: doorX + inset,
    y: y + inset,
    width: doorW - inset * 2 - 7,
    height: panelH,
    borderColor: WOOD_DARK,
    borderWidth: 0.7,
    color: WOOD,
  });
  page.drawEllipse({
    x: doorX + doorW - 8,
    y: y + h * 0.48,
    xScale: 2.2,
    yScale: 2.2,
    color: rgb(0.16, 0.12, 0.08),
  });
  if (ajar) {
    page.drawRectangle({
      x: x + doorW * 0.55,
      y,
      width: w * 0.42,
      height: h,
      color: rgb(0.22, 0.2, 0.17),
    });
  }
}

function drawCaption(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  maxW: number,
  font: PDFFont,
  size = 8,
) {
  let cursor = y;
  for (const line of wrap(text, font, size, maxW)) {
    page.drawText(line, { x, y: cursor, size, font, color: INK });
    cursor -= size + 2;
  }
  return cursor;
}

function drawLaPuerta(
  page: PDFPage,
  inner: { x: number; y: number; w: number; h: number; bottom: number },
  fonts: Ch1Fonts,
  puertaImg: PDFImage,
) {
  const doorW = Math.min(64, inner.w * 0.48);
  const doorH = 58;
  const closedX = inner.x + (inner.w - doorW) / 2;
  const closedY = inner.y - doorH - 4;
  drawClippedImage(page, puertaImg, closedX, closedY, doorW, doorH);
  let y = drawCaption(
    page,
    "La puerta no abre.",
    inner.x,
    closedY - 12,
    inner.w,
    fonts.body,
    8,
  );

  const openY = y - doorH - 10;
  drawClippedImage(page, puertaImg, closedX, openY, doorW, doorH);
  page.drawText("CRIIIC...", {
    x: closedX + doorW - 6,
    y: openY + doorH * 0.55,
    size: 13,
    font: fonts.ui,
    color: RUST,
    rotate: degrees(-18),
  });
  y = openY - 12;
  y = drawCaption(page, "un ruido", inner.x, y, inner.w, fonts.ui, 8);
  y = drawCaption(
    page,
    "La puerta hace un ruido.",
    inner.x,
    y - 2,
    inner.w,
    fonts.body,
    8,
  );
  y = drawCaption(
    page,
    "La puerta está vieja.",
    inner.x,
    y - 2,
    inner.w,
    fonts.body,
    8,
  );
  drawCaption(
    page,
    "Don Rafael: «La casa está bien».",
    inner.x,
    y - 12,
    inner.w,
    fonts.body,
    8,
  );
}

function drawTechoGota(
  page: PDFPage,
  inner: { x: number; y: number; w: number; h: number; bottom: number },
  fonts: Ch1Fonts,
  gotaImg: PDFImage,
) {
  const illH = inner.h * 0.55;
  const illY = inner.y - illH;
  drawClippedImage(page, gotaImg, inner.x, illY, inner.w, illH);
  const roofY = inner.y - 8;
  const roofX = inner.x + 4;
  const dropX = inner.x + inner.w * 0.55;
  drawLabelChip(
    page,
    "el techo",
    inner.x,
    roofY - 6,
    roofX + 18,
    roofY - 10,
    fonts.ui,
  );
  drawLabelChip(
    page,
    "una gota",
    inner.x + inner.w - 52,
    illY + 8,
    dropX,
    illY + illH * 0.45,
    fonts.ui,
  );
  let y = illY - 12;
  y = drawCaption(
    page,
    "Del techo cae una gota.",
    inner.x,
    y,
    inner.w,
    fonts.body,
    8,
  );
  y = drawCaption(
    page,
    "El techo está arriba.",
    inner.x,
    y - 2,
    inner.w,
    fonts.body,
    8,
  );
  y -= 10;
  y = drawCaption(page, "el agua", inner.x, y, inner.w, fonts.ui, 8);
  y = drawCaption(page, "el pelo", inner.x, y - 1, inner.w, fonts.ui, 8);
  drawCaption(page, "Está mojado.", inner.x, y - 14, inner.w, fonts.body, 8);
}

function drawPlipCard(
  page: PDFPage,
  inner: { x: number; y: number; w: number; h: number; bottom: number },
  fonts: Ch1Fonts,
  gotaImg: PDFImage,
) {
  const plip = "PLIP";
  const pw = fonts.ui.widthOfTextAtSize(plip, 16);
  page.drawText(plip, {
    x: inner.x + (inner.w - pw) / 2,
    y: inner.y - 18,
    size: 16,
    font: fonts.ui,
    color: RUST,
  });
  const imgW = inner.w * 0.72;
  const imgH = 52;
  const imgX = inner.x + (inner.w - imgW) / 2;
  const imgY = inner.y - 18 - 8 - imgH;
  drawClippedImage(page, gotaImg, imgX, imgY, imgW, imgH);
  const bx = inner.x + inner.w * 0.28;
  const by = imgY;
  drawLabelChip(
    page,
    "una gota",
    inner.x + inner.w - 54,
    by + 8,
    imgX + imgW * 0.55,
    by + imgH * 0.55,
    fonts.ui,
  );
  let y = by - 16;
  y = drawCaption(page, "—No es nada.", inner.x, y, inner.w, fonts.body, 8);
  drawCaption(page, "—La casa está bien.", inner.x, y - 2, inner.w, fonts.body, 8);
}

function flowColumn(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  maxW: number,
  minY: number,
  body: PDFFont,
) {
  let cursor = y;
  for (const para of paras(text)) {
    const lines = wrap(para, body, STORY_SIZE, maxW);
    for (const line of lines) {
      if (cursor < minY) return cursor;
      page.drawText(line, {
        x,
        y: cursor,
        size: STORY_SIZE,
        font: body,
        color: INK,
      });
      cursor -= STORY_LEAD;
    }
    cursor -= 6;
  }
  return cursor;
}

function drawOpener(ctx: Ch1Context, chapter: PartIChapter, opener: string) {
  const page = ctx.addPage();
  if (ctx.recording) ctx.starts[0] = ctx.pdf.getPageCount();
  const { body, ui } = ctx.fonts;
  let y = TRIM.height - 56;
  page.drawText("CAPÍTULO 1", {
    x: MARGIN,
    y,
    size: 11,
    font: ui,
    color: RUST,
  });
  y -= 26;
  page.drawText(chapter.title, {
    x: MARGIN,
    y,
    size: 26,
    font: body,
    color: GREEN,
  });
  y -= 16;
  const artW = TRIM.width - MARGIN * 2;
  const artH = 210;
  const artY = y - artH;
  page.drawRectangle({
    x: MARGIN,
    y: artY,
    width: artW,
    height: artH,
    color: rgb(0.93, 0.91, 0.86),
    borderColor: GREEN,
    borderWidth: 0.6,
  });
  drawClippedImage(
    page,
    ctx.rasters.courtyard,
    MARGIN + 1,
    artY + 1,
    artW - 2,
    artH - 2,
  );
  drawLabelChip(
    page,
    "la maleta",
    MARGIN + 10,
    artY + 12,
    MARGIN + 48,
    artY + 40,
    ui,
  );
  drawLabelChip(
    page,
    "Lola",
    MARGIN + artW - 48,
    artY + 12,
    MARGIN + artW * 0.48,
    artY + 36,
    ui,
  );
  y = artY - 18;
  flowColumn(page, opener, MARGIN, y, artW, 48, body);
  folioLeft(page, ctx.pdf.getPageCount(), ui);
}

function drawSpread(
  ctx: Ch1Context,
  title: string,
  story: string,
  topCard: string,
  bottomCard: string,
) {
  const page = ctx.addPage();
  const { body, ui } = ctx.fonts;
  continuationHeader(page, title, ctx.fonts);
  const col = column();
  const top = TRIM.height - 58;
  const bottom = 48;
  const stackH = top - bottom;
  const gap = 10;
  const cardH = (stackH - gap) / 2;
  flowColumn(page, story, col.storyX, top, col.storyW, bottom, body);
  const a = drawModule(page, col.cardX, top, col.cardW, cardH, topCard, ui);
  const b = drawModule(
    page,
    col.cardX,
    top - cardH - gap,
    col.cardW,
    cardH,
    bottomCard,
    ui,
  );
  if (topCard === "RELACIONES") drawRelaciones(page, a, ctx.fonts, ctx.rasters);
  if (topCard === "EL TECHO Y LA GOTA") drawTechoGota(page, a, ctx.fonts, ctx.rasters.gota);
  if (bottomCard === "LA PUERTA") drawLaPuerta(page, b, ctx.fonts, ctx.rasters.puerta);
  if (bottomCard === "PLIP") drawPlipCard(page, b, ctx.fonts, ctx.rasters.gota);
  folioLeft(page, ctx.pdf.getPageCount(), ui);
}

function drawArrowForm(
  page: PDFPage,
  x: number,
  y: number,
  left: string,
  right: string,
  font: PDFFont,
) {
  page.drawText(left, { x, y, size: 11, font, color: INK });
  const lw = font.widthOfTextAtSize(left + " ", 11);
  const ax = x + lw;
  page.drawLine({
    start: { x: ax, y: y + 4 },
    end: { x: ax + 16, y: y + 4 },
    thickness: 0.9,
    color: GREEN,
  });
  page.drawLine({
    start: { x: ax + 16, y: y + 4 },
    end: { x: ax + 12, y: y + 7 },
    thickness: 0.9,
    color: GREEN,
  });
  page.drawLine({
    start: { x: ax + 16, y: y + 4 },
    end: { x: ax + 12, y: y + 1 },
    thickness: 0.9,
    color: GREEN,
  });
  page.drawText(right, {
    x: ax + 20,
    y,
    size: 11,
    font,
    color: GREEN,
  });
}

function drawRich(
  page: PDFPage,
  x: number,
  y: number,
  parts: { t: string; c: ReturnType<typeof rgb> }[],
  font: PDFFont,
  size: number,
) {
  let cx = x;
  for (const part of parts) {
    page.drawText(part.t, { x: cx, y, size, font, color: part.c });
    cx += font.widthOfTextAtSize(part.t, size);
  }
}

function drawClose(
  ctx: Ch1Context,
  chapter: PartIChapter,
  close: string,
) {
  const page = ctx.addPage();
  const { body, ui } = ctx.fonts;
  continuationHeader(page, chapter.title, ctx.fonts);
  const col = column();
  let y = TRIM.height - 58;
  y = flowColumn(page, close, col.storyX, y, col.storyW, 430, body);
  const plip = "PLIP";
  const pw = ui.widthOfTextAtSize(plip, 18);
  page.drawText(plip, {
    x: col.cardX + (col.cardW - pw) / 2,
    y: TRIM.height - 90,
    size: 18,
    font: ui,
    color: RUST,
  });
  page.drawRectangle({
    x: col.cardX,
    y: TRIM.height - 210,
    width: col.cardW,
    height: 96,
    color: rgb(0.93, 0.91, 0.86),
    borderColor: GREEN,
    borderWidth: 0.6,
  });

  const content = TRIM.width - MARGIN * 2;
  let boxTop = 410;
  const observaH = 132;
  const obs = drawModule(page, MARGIN, boxTop, content, observaH, "OBSERVA", ui);
  const mid = obs.x + obs.w * 0.52;
  page.drawLine({
    start: { x: mid, y: obs.y + 4 },
    end: { x: mid, y: obs.bottom + 4 },
    thickness: 0.5,
    color: rgb(0.75, 0.78, 0.74),
  });
  let ly = obs.y - 4;
  const left = obs.x;
  drawRich(page, left, ly, [{ t: "Soy", c: GREEN }, { t: " Tomás.", c: INK }], body, 11);
  ly -= 16;
  drawRich(
    page,
    left,
    ly,
    [
      { t: "Ana ", c: INK },
      { t: "es", c: GREEN },
      { t: " mi esposa.", c: INK },
    ],
    body,
    11,
  );
  ly -= 16;
  drawRich(
    page,
    left,
    ly,
    [
      { t: "Don Rafael ", c: INK },
      { t: "es", c: GREEN },
      { t: " mi abuelo.", c: INK },
    ],
    body,
    11,
  );
  ly -= 20;
  drawArrowForm(page, left, ly, "yo", "soy", body);
  ly -= 16;
  drawArrowForm(page, left, ly, "él / ella", "es", body);
  const gen = wrap(
    "Usamos ser para decir quién es una persona.",
    body,
    11,
    obs.w * 0.44,
  );
  let ry = obs.y - 8;
  for (const line of gen) {
    page.drawText(line, {
      x: mid + 8,
      y: ry,
      size: 11,
      font: body,
      color: INK,
    });
    ry -= 15;
  }

  boxTop = boxTop - observaH - 12;
  const pregH = boxTop - 44;
  const preg = drawModule(page, MARGIN, boxTop, content, pregH, "PREGUNTAS", ui);
  const qW = preg.w * 0.68;
  let qy = preg.y - 2;
  chapter.preguntas.forEach((question, index) => {
    const label = `${index + 1}. `;
    const lw = ui.widthOfTextAtSize(label, 11);
    page.drawText(label, {
      x: preg.x,
      y: qy,
      size: 11,
      font: ui,
      color: GREEN,
    });
    const lines = wrap(question, body, 11, qW - lw);
    lines.forEach((ln, lineIndex) => {
      page.drawText(ln, {
        x: preg.x + (lineIndex === 0 ? lw : 16),
        y: qy,
        size: 11,
        font: body,
        color: INK,
      });
      qy -= 15;
    });
    qy -= 6;
  });
  const slotW = preg.w * 0.26;
  const slotX = preg.x + preg.w - slotW;
  const slotH = (preg.h - 16) / 3;
  const slotImgs = [ctx.rasters.puerta, ctx.rasters.gota, ctx.rasters.lola];
  for (let i = 0; i < 3; i += 1) {
    const sx = slotX;
    const sy = preg.bottom + 4 + (2 - i) * (slotH + 4);
    page.drawRectangle({
      x: sx,
      y: sy,
      width: slotW,
      height: slotH,
      color: rgb(0.93, 0.91, 0.86),
      borderColor: GREEN,
      borderWidth: 0.5,
    });
    drawClippedImage(page, slotImgs[i], sx + 1, sy + 1, slotW - 2, slotH - 2);
  }
  folioLeft(page, ctx.pdf.getPageCount(), ui);
}

export function typesetChapter1(ctx: Ch1Context, chapter: PartIChapter) {
  const beats = splitChapter1Story(chapter.story);
  drawOpener(ctx, chapter, beats.opener);
  drawSpread(ctx, chapter.title, beats.spread1, "RELACIONES", "LA PUERTA");
  drawSpread(ctx, chapter.title, beats.spread2, "EL TECHO Y LA GOTA", "PLIP");
  drawClose(ctx, chapter, beats.close);
}
