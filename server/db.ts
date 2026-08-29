import { drizzle } from "drizzle-orm/node-postgres";
import { eq, desc, asc } from "drizzle-orm";
import pg from "pg";
import {
  BOOK_LANGUAGE,
  BOOK_TITLE,
  BOOK_TRIM,
  BOOK_VARIETY,
  books,
  chapters,
  jobs,
  researchNotes,
  seedChapterRows,
} from "../shared/schema.ts";
import { createMemoryStore, type StudioStore } from "./store.ts";

const databaseUrl = process.env.DATABASE_URL;

async function createPostgresStore(): Promise<StudioStore> {
  const pool = new pg.Pool({ connectionString: databaseUrl });
  const db = drizzle(pool);

  async function ensureBook() {
    const existing = await db.select().from(books).limit(1);
    if (existing[0]) return existing[0];

    const inserted = await db
      .insert(books)
      .values({
        title: BOOK_TITLE,
        language: BOOK_LANGUAGE,
        variety: BOOK_VARIETY,
        trim: BOOK_TRIM,
        status: "setup",
      })
      .returning();
    const book = inserted[0];
    if (!book) throw new Error("Failed to seed book");
    await db.insert(chapters).values(seedChapterRows(book.id));
    return book;
  }

  await ensureBook();

  return {
    async getBook() {
      return ensureBook();
    },
    async listBooks() {
      return db.select().from(books).orderBy(asc(books.id));
    },
    async listChapters(bookId) {
      return db
        .select()
        .from(chapters)
        .where(eq(chapters.bookId, bookId))
        .orderBy(asc(chapters.number));
    },
    async listJobs(bookId) {
      return db
        .select()
        .from(jobs)
        .where(eq(jobs.bookId, bookId))
        .orderBy(desc(jobs.id));
    },
    async updateBook(id, patch) {
      const updated = await db
        .update(books)
        .set(patch)
        .where(eq(books.id, id))
        .returning();
      const book = updated[0];
      if (!book) throw new Error("Book not found");
      return book;
    },
    async updateChapter(id, patch) {
      const updated = await db
        .update(chapters)
        .set(patch)
        .where(eq(chapters.id, id))
        .returning();
      return updated[0];
    },
    async createJob(input) {
      const inserted = await db.insert(jobs).values(input).returning();
      const job = inserted[0];
      if (!job) throw new Error("Failed to create job");
      return job;
    },
    async updateJob(id, patch) {
      const updated = await db
        .update(jobs)
        .set(patch)
        .where(eq(jobs.id, id))
        .returning();
      return updated[0];
    },
    async listResearch(bookId) {
      return db
        .select()
        .from(researchNotes)
        .where(eq(researchNotes.bookId, bookId))
        .orderBy(asc(researchNotes.id));
    },
    async createResearch(input) {
      const inserted = await db
        .insert(researchNotes)
        .values({
          bookId: input.bookId,
          title: input.title,
          body: input.body,
          source: input.source ?? "",
          createdAt: new Date().toISOString(),
        })
        .returning();
      const note = inserted[0];
      if (!note) throw new Error("Failed to create research note");
      return note;
    },
    async updateResearch(id, patch) {
      const updated = await db
        .update(researchNotes)
        .set(patch)
        .where(eq(researchNotes.id, id))
        .returning();
      return updated[0];
    },
    async deleteResearch(id) {
      const deleted = await db
        .delete(researchNotes)
        .where(eq(researchNotes.id, id))
        .returning();
      return Boolean(deleted[0]);
    },
  };
}

let storePromise: Promise<StudioStore> | undefined;

export function getStore(): Promise<StudioStore> {
  if (!storePromise) {
    storePromise = databaseUrl
      ? createPostgresStore().catch((error) => {
          console.warn(
            "DATABASE_URL set but Postgres failed; falling back to memory store.",
            error,
          );
          return createMemoryStore();
        })
      : Promise.resolve(createMemoryStore());
  }
  return storePromise;
}
