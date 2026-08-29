import {
  buildInteriorPreflightPdf,
  INTERIOR_PDF_RELATIVE,
} from "./print.ts";

export function coverAllowed(
  pageCount: number | null | undefined,
  frozen: boolean,
): boolean {
  return (
    frozen === true &&
    typeof pageCount === "number" &&
    pageCount > 0 &&
    pageCount % 2 === 0
  );
}

export async function renderInteriorPreflight(
  _outPath = INTERIOR_PDF_RELATIVE,
): Promise<{
  path: string;
  pages: number;
  fonts: string[];
}> {
  const result = await buildInteriorPreflightPdf();
  return {
    path: result.path,
    pages: result.pages,
    fonts: result.fonts.map((font) => font.name),
  };
}
