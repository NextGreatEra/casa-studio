import { integer, pgTable, serial, text } from "drizzle-orm/pg-core";
import { CHAPTER_TITLES as PART_I_CHAPTER_TITLES } from "./part-i.ts";

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
export const CHAPTER_COUNT = 8;
export const INTERIOR_PAGE_COUNT = 36;
export const CHAPTER_TITLES = PART_I_CHAPTER_TITLES;
export const SPANISH_PROOF = "á é í ó ú ñ ü ¿ ¡";

export const books = pgTable("books", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  language: text("language").notNull().default("en"),
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

export const researchNotes = pgTable("research_notes", {
  id: serial("id").primaryKey(),
  bookId: integer("book_id").notNull().references(() => books.id),
  title: text("title").notNull(),
  body: text("body").notNull(),
  source: text("source").notNull().default(""),
  createdAt: text("created_at").notNull(),
});

export type Book = typeof books.$inferSelect;
export type Chapter = typeof chapters.$inferSelect;
export type Job = typeof jobs.$inferSelect;
export type ResearchNote = typeof researchNotes.$inferSelect;

export function seedChapterRows(bookId: number) {
  return CHAPTER_TITLES.map((title, index) => ({
    bookId,
    number: index + 1,
    title,
    status: "pending",
  }));
}
