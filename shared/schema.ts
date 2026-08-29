import { integer, pgTable, serial, text } from "drizzle-orm/pg-core";

export const STAGES = [
  "outline",
  "draft",
  "pedagogy_gate",
  "illustrate",
  "art_gate",
  "layout",
  "print_gate",
  "cover",
] as const;

export type Stage = (typeof STAGES)[number];

export const STAGE_LABELS: Record<Stage, string> = {
  outline: "Outline",
  draft: "Draft",
  pedagogy_gate: "Pedagogy review",
  illustrate: "Illustration",
  art_gate: "Art review",
  layout: "Layout",
  print_gate: "Print review",
  cover: "Cover",
};

export const BOOK_TITLE = "La casa de San Jacinto";
export const BOOK_LANGUAGE = "es";
export const BOOK_VARIETY = "es-MX";
export const BOOK_TRIM = "7x10";
export const CHAPTER_COUNT = 36;
export const INTERIOR_PAGE_COUNT = 136;
export const SPANISH_PROOF = "á é í ó ú ñ ü ¿ ¡";

export const books = pgTable("books", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  language: text("language").notNull().default("es"),
  variety: text("variety").notNull().default("es-MX"),
  trim: text("trim").notNull().default("7x10"),
  status: text("status").notNull().default("setup"),
});

export const chapters = pgTable("chapters", {
  id: serial("id").primaryKey(),
  bookId: integer("book_id")
    .notNull()
    .references(() => books.id),
  number: integer("number").notNull(),
  title: text("title").notNull(),
  status: text("status").notNull().default("pending"),
});

export const jobs = pgTable("jobs", {
  id: serial("id").primaryKey(),
  bookId: integer("book_id")
    .notNull()
    .references(() => books.id),
  stage: text("stage").notNull(),
  status: text("status").notNull().default("queued"),
  error: text("error"),
  artifactPath: text("artifact_path"),
});

export type Book = typeof books.$inferSelect;
export type Chapter = typeof chapters.$inferSelect;
export type Job = typeof jobs.$inferSelect;

export function seedChapterRows(bookId: number) {
  const rows: Array<{
    bookId: number;
    number: number;
    title: string;
    status: string;
  }> = [];
  for (let number = 1; number <= CHAPTER_COUNT; number += 1) {
    rows.push({
      bookId,
      number,
      title: `Capítulo ${number}`,
      status: "pending",
    });
  }
  rows.push({
    bookId,
    number: CHAPTER_COUNT + 1,
    title: "Epílogo",
    status: "pending",
  });
  return rows;
}
