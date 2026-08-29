import { boolean, integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

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

export const books = pgTable("books", {
  id: serial("id").primaryKey(),
  title: text("title").notNull().default("La casa de San Jacinto"),
  language: text("language").notNull().default("es"),
  variety: text("variety").notNull().default("es-MX"),
  trim: text("trim").notNull().default("7x10"),
  status: text("status").notNull().default("draft"),
  interiorPageCount: integer("interior_page_count"),
  interiorFrozen: boolean("interior_frozen").notNull().default(false),
});

export const chapters = pgTable("chapters", {
  id: serial("id").primaryKey(),
  bookId: integer("book_id").notNull().references(() => books.id),
  number: integer("number").notNull(),
  title: text("title").notNull(),
  status: text("status").notNull().default("placeholder"),
});

export const jobs = pgTable("jobs", {
  id: serial("id").primaryKey(),
  bookId: integer("book_id").notNull().references(() => books.id),
  stage: text("stage").notNull(),
  status: text("status").notNull().default("queued"),
  error: text("error"),
  artifactPath: text("artifact_path"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});
