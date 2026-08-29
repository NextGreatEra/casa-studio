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
  type Stage,
} from "../shared/schema.ts";
import { INTERIOR_PDF_RELATIVE, interiorPdfPath } from "./lib/print.ts";

export type StudioStore = {
  getBook(): Promise<Book>;
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
};

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function createMemoryStore(): StudioStore {
  let bookId = 1;
  let chapterId = 1;
  let jobId = 1;

  const book: Book = {
    id: bookId,
    title: BOOK_TITLE,
    language: BOOK_LANGUAGE,
    variety: BOOK_VARIETY,
    trim: BOOK_TRIM,
    status: "setup",
  };

  const chapters: Chapter[] = seedChapterRows(book.id).map((row) => ({
    id: chapterId++,
    ...row,
  }));
  const jobs: Job[] = [];

  return {
    async getBook() {
      return clone(book);
    },
    async listChapters() {
      return clone(chapters).sort((a, b) => a.number - b.number);
    },
    async listJobs() {
      return clone(jobs).sort((a, b) => b.id - a.id);
    },
    async updateBook(_id, patch) {
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
  const [chapters, jobs] = await Promise.all([
    store.listChapters(book.id),
    store.listJobs(book.id),
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
  };
}
