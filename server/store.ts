import { access } from "node:fs/promises";
import {
  BOOK_LANGUAGE,
  BOOK_TITLE,
  BOOK_TRIM,
  BOOK_VARIETY,
  INTERIOR_PAGE_COUNT,
  STAGE_LABELS,
  STAGES,
  seedChapterRows,
  type Book,
  type Chapter,
  type Job,
  type ResearchNote,
  type Stage,
} from "../shared/schema.ts";
import { INTERIOR_PDF_RELATIVE, interiorPdfPath } from "./lib/print.ts";

export type StudioStore = {
  getBook(): Promise<Book>;
  listBooks(): Promise<Book[]>;
  listChapters(bookId: number): Promise<Chapter[]>;
  listJobs(bookId: number): Promise<Job[]>;
  updateBook(id: number, patch: Partial<Pick<Book, "status">>): Promise<Book>;
  updateChapter(
    id: number,
    patch: Partial<Pick<Chapter, "status" | "title">>,
  ): Promise<Chapter | undefined>;
  createJob(input: {
    bookId: number;
    stage: string;
    status: string;
    error?: string | null;
    artifactPath?: string | null;
  }): Promise<Job>;
  updateJob(
    id: number,
    patch: Partial<Pick<Job, "status" | "error" | "artifactPath">>,
  ): Promise<Job | undefined>;
  listResearch(bookId: number): Promise<ResearchNote[]>;
  createResearch(input: {
    bookId: number;
    title: string;
    body: string;
    source?: string;
  }): Promise<ResearchNote>;
  updateResearch(
    id: number,
    patch: Partial<Pick<ResearchNote, "title" | "body" | "source">>,
  ): Promise<ResearchNote | undefined>;
  deleteResearch(id: number): Promise<boolean>;
};

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function createMemoryStore(): StudioStore {
  let chapterId = 1;
  let jobId = 1;
  let researchId = 1;

  const books: Book[] = [
    {
      id: 1,
      title: BOOK_TITLE,
      language: BOOK_LANGUAGE,
      variety: BOOK_VARIETY,
      trim: BOOK_TRIM,
      status: "setup",
    },
  ];

  const chapters: Chapter[] = seedChapterRows(1).map((row) => ({
    id: chapterId++,
    ...row,
  }));
  const jobs: Job[] = [];
  const researchNotes: ResearchNote[] = [];

  return {
    async getBook() {
      const seeded = books[0];
      if (!seeded) throw new Error("Seeded book missing");
      return clone(seeded);
    },
    async listBooks() {
      return clone(books);
    },
    async listChapters(bookId) {
      return clone(chapters.filter((row) => row.bookId === bookId)).sort(
        (a, b) => a.number - b.number,
      );
    },
    async listJobs(bookId) {
      return clone(jobs.filter((row) => row.bookId === bookId)).sort(
        (a, b) => b.id - a.id,
      );
    },
    async updateBook(id, patch) {
      const book = books.find((row) => row.id === id);
      if (!book) throw new Error("Book not found");
      Object.assign(book, patch);
      return clone(book);
    },
    async updateChapter(id, patch) {
      const chapter = chapters.find((row) => row.id === id);
      if (!chapter) return undefined;
      Object.assign(chapter, patch);
      return clone(chapter);
    },
    async createJob(input) {
      const job: Job = {
        id: jobId++,
        bookId: input.bookId,
        stage: input.stage,
        status: input.status,
        error: input.error ?? null,
        artifactPath: input.artifactPath ?? null,
      };
      jobs.unshift(job);
      return clone(job);
    },
    async updateJob(id, patch) {
      const job = jobs.find((row) => row.id === id);
      if (!job) return undefined;
      Object.assign(job, patch);
      return clone(job);
    },
    async listResearch(bookId) {
      return clone(researchNotes.filter((row) => row.bookId === bookId)).sort(
        (a, b) => a.id - b.id,
      );
    },
    async createResearch(input) {
      const note: ResearchNote = {
        id: researchId++,
        bookId: input.bookId,
        title: input.title,
        body: input.body,
        source: input.source ?? "",
        createdAt: new Date().toISOString(),
      };
      researchNotes.push(note);
      return clone(note);
    },
    async updateResearch(id, patch) {
      const note = researchNotes.find((row) => row.id === id);
      if (!note) return undefined;
      Object.assign(note, patch);
      return clone(note);
    },
    async deleteResearch(id) {
      const index = researchNotes.findIndex((row) => row.id === id);
      if (index === -1) return false;
      researchNotes.splice(index, 1);
      return true;
    },
  };
}

export async function interiorExists() {
  try {
    await access(interiorPdfPath());
    return true;
  } catch {
    return false;
  }
}

export function isCoverUnlocked(pageCountFrozen: boolean, pageCount: number) {
  return pageCountFrozen && pageCount > 0 && pageCount % 2 === 0;
}

export async function buildWorkspaceView(store: StudioStore) {
  const book = await store.getBook();
  const [chapters, jobs, research] = await Promise.all([
    store.listChapters(book.id),
    store.listJobs(book.id),
    store.listResearch(book.id),
  ]);

  const latestByStage = new Map<string, Job>();
  for (const job of jobs) {
    if (!latestByStage.has(job.stage)) latestByStage.set(job.stage, job);
  }

  const printGate = latestByStage.get("print_gate");
  const pageCountFrozen =
    book.status === "interior_frozen" || printGate?.status === "completed";
  const hasInterior = await interiorExists();
  const interiorPageCount = hasInterior ? INTERIOR_PAGE_COUNT : 0;
  const coverReady = isCoverUnlocked(pageCountFrozen, interiorPageCount);

  const stages = STAGES.map((stage) => {
    const job = latestByStage.get(stage);
    let detail: string | null = null;
    if (stage === "cover" && !coverReady) {
      detail = "Locked until the interior page count is even and frozen.";
    } else if (job?.error) {
      detail = job.error;
    }
    return {
      id: stage as Stage,
      label: STAGE_LABELS[stage],
      status: job?.status ?? "not_started",
      detail,
    };
  });

  return {
    book,
    chapters,
    jobs,
    stages,
    interiorPageCount,
    pageCountFrozen,
    coverReady,
    interiorAvailable: hasInterior,
    interiorPath: hasInterior ? INTERIOR_PDF_RELATIVE : null,
    research,
  };
}
