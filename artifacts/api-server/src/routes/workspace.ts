import { Router, type IRouter } from "express";
import { and, asc, desc, eq } from "drizzle-orm";
import {
  CreateJobBody,
  CreateJobResponse,
  GetPrintChecklistResponse,
  GetWorkspaceResponse,
  UpdateChapterBody,
  UpdateChapterParams,
  UpdateChapterResponse,
} from "@workspace/api-zod";
import { booksTable, chaptersTable, db, jobsTable } from "@workspace/db";

const router: IRouter = Router();

const stageOrder = [
  "outline",
  "draft",
  "pedagogy_gate",
  "illustrate",
  "art_gate",
  "layout",
  "print_gate",
  "cover",
] as const;

const stageLabels: Record<(typeof stageOrder)[number], string> = {
  outline: "Outline",
  draft: "Draft",
  pedagogy_gate: "Pedagogy review",
  illustrate: "Illustration",
  art_gate: "Art review",
  layout: "Layout",
  print_gate: "Print review",
  cover: "Cover",
};

async function ensureWorkspace() {
  const [existing] = await db
    .select()
    .from(booksTable)
    .where(eq(booksTable.title, "La casa de San Jacinto"))
    .limit(1);

  if (existing) return existing;

  const [book] = await db
    .insert(booksTable)
    .values({
      title: "La casa de San Jacinto",
      language: "es",
      variety: "es-MX",
      trim: "7x10",
      status: "setup",
    })
    .returning();

  if (!book) throw new Error("Failed to initialize workspace");

  await db.insert(chaptersTable).values(
    Array.from({ length: 8 }, (_, index) => ({
      bookId: book.id,
      number: index + 1,
      title: `Chapter ${index + 1}`,
      status: "placeholder",
    })),
  );

  return book;
}

function serializeJob(job: typeof jobsTable.$inferSelect) {
  return {
    ...job,
    createdAt: job.createdAt.toISOString(),
  };
}

async function buildWorkspace() {
  const book = await ensureWorkspace();
  const [chapters, jobs] = await Promise.all([
    db
      .select()
      .from(chaptersTable)
      .where(eq(chaptersTable.bookId, book.id))
      .orderBy(asc(chaptersTable.number)),
    db
      .select()
      .from(jobsTable)
      .where(eq(jobsTable.bookId, book.id))
      .orderBy(desc(jobsTable.createdAt)),
  ]);

  const latestByStage = new Map<string, (typeof jobs)[number]>();
  for (const job of jobs) {
    if (!latestByStage.has(job.stage)) latestByStage.set(job.stage, job);
  }

  const coverReady =
    book.pageCountFrozen &&
    book.interiorPageCount > 0 &&
    book.interiorPageCount % 2 === 0;

  return {
    book,
    chapters,
    jobs: jobs.map(serializeJob),
    stages: stageOrder.map((stage) => {
      const job = latestByStage.get(stage);
      return {
        id: stage,
        label: stageLabels[stage],
        status: job?.status ?? "not_started",
        detail:
          stage === "cover" && !coverReady
            ? "Locked until the interior page count is even and frozen."
            : null,
      };
    }),
    interiorPageCount: book.interiorPageCount,
    pageCountFrozen: book.pageCountFrozen,
    coverReady,
  };
}

router.get("/workspace", async (_req, res): Promise<void> => {
  res.json(GetWorkspaceResponse.parse(await buildWorkspace()));
});

router.post("/jobs", async (req, res): Promise<void> => {
  const parsed = CreateJobBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [book] = await db
    .select()
    .from(booksTable)
    .where(eq(booksTable.id, parsed.data.bookId))
    .limit(1);

  if (!book) {
    res.status(400).json({ error: "Book not found" });
    return;
  }

  if (
    parsed.data.stage === "cover" &&
    (!book.pageCountFrozen ||
      book.interiorPageCount <= 0 ||
      book.interiorPageCount % 2 !== 0)
  ) {
    res.status(400).json({
      error:
        "Cover is locked until the interior page count is even and frozen.",
    });
    return;
  }

  const [job] = await db
    .insert(jobsTable)
    .values({
      bookId: parsed.data.bookId,
      stage: parsed.data.stage,
      status: "queued",
      error: null,
      artifactPath: null,
    })
    .returning();

  if (!job) throw new Error("Failed to create job");
  res.status(201).json(CreateJobResponse.parse(serializeJob(job)));
});

router.patch("/chapters/:chapterId", async (req, res): Promise<void> => {
  const params = UpdateChapterParams.safeParse(req.params);
  const body = UpdateChapterBody.safeParse(req.body);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const [chapter] = await db
    .update(chaptersTable)
    .set(body.data)
    .where(eq(chaptersTable.id, params.data.chapterId))
    .returning();

  if (!chapter) {
    res.status(404).json({ error: "Chapter not found" });
    return;
  }

  res.json(UpdateChapterResponse.parse(chapter));
});

router.get("/print-checklist", async (_req, res): Promise<void> => {
  const workspace = await buildWorkspace();
  const allChaptersApproved = workspace.chapters.every(
    (chapter) => chapter.status === "approved",
  );
  const hasLayoutJob = workspace.jobs.some(
    (job) => job.stage === "layout" && job.status !== "failed",
  );
  const evenPageCount =
    workspace.interiorPageCount > 0 &&
    workspace.interiorPageCount % 2 === 0;

  const items = [
    {
      id: "chapters",
      label: "Chapter reviews",
      status: allChaptersApproved ? "ready" : "waiting",
      detail: allChaptersApproved
        ? "All eight chapters are approved."
        : "Approve all eight chapter placeholders after review.",
    },
    {
      id: "layout",
      label: "Interior layout",
      status: hasLayoutJob ? "queued" : "waiting",
      detail: hasLayoutJob
        ? "A layout job has been queued."
        : "Queue layout after editorial and art review.",
    },
    {
      id: "page-count",
      label: "Even page count",
      status: evenPageCount ? "ready" : "waiting",
      detail: evenPageCount
        ? `${workspace.interiorPageCount} pages.`
        : "Interior page count is not available yet.",
    },
    {
      id: "freeze",
      label: "Page count frozen",
      status: workspace.pageCountFrozen ? "ready" : "waiting",
      detail: workspace.pageCountFrozen
        ? "The interior page count is frozen."
        : "Freeze the final interior before cover production.",
    },
  ];

  res.json(
    GetPrintChecklistResponse.parse({
      items,
      interiorReady: allChaptersApproved && hasLayoutJob && evenPageCount,
      coverReady: workspace.coverReady,
    }),
  );
});

router.get("/artifacts/:file", async (req, res): Promise<void> => {
  const file = Array.isArray(req.params.file)
    ? req.params.file[0]
    : req.params.file;
  if (file !== "interior.pdf" && file !== "cover.pdf") {
    res.status(404).json({ error: "Artifact not found" });
    return;
  }
  res.status(404).json({ error: `${file} does not exist yet` });
});

export default router;