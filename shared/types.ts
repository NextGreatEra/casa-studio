import {
  BOOK_LANGUAGE,
  BOOK_TITLE,
  BOOK_TRIM,
  BOOK_VARIETY,
  CHAPTER_COUNT,
  INTERIOR_PAGE_COUNT,
  STAGES,
  type Book,
  type Chapter,
  type Job,
  type Stage,
} from "./schema.ts";

export type {
  Book,
  Chapter,
  Job,
  Stage,
};

export {
  BOOK_LANGUAGE,
  BOOK_TITLE,
  BOOK_TRIM,
  BOOK_VARIETY,
  CHAPTER_COUNT,
  INTERIOR_PAGE_COUNT,
  STAGES,
};

export type ReviewKind = "draft" | "art";
export type ReviewDecision = "approve" | "reject";

export type PipelineStage = {
  id: Stage;
  label: string;
  status: string;
  detail: string | null;
};

export type PrintChecklistItem = {
  id: string;
  label: string;
  status: "ready" | "waiting" | "blocked";
  detail: string;
};

export type WorkspacePayload = {
  book: Book;
  chapters: Chapter[];
  jobs: Job[];
  stages: PipelineStage[];
  interiorPageCount: number;
  pageCountFrozen: boolean;
  coverReady: boolean;
  interiorAvailable: boolean;
  interiorPath: string | null;
};
