import type { Express, Request, Response } from "express";
import { access } from "node:fs/promises";
import {
  INTERIOR_PAGE_COUNT,
  STAGES,
  type Stage,
} from "../shared/schema.ts";
import { getStore } from "./db.ts";
import {
  buildWorkspaceView,
  interiorExists,
  isCoverUnlocked,
} from "./store.ts";
import {
  buildInteriorPreflightPdf,
  formatPreflightReport,
  interiorPdfPath,
} from "./lib/print.ts";
import { runXai } from "./lib/xai.ts";

function isStage(value: unknown): value is Stage {
  return typeof value === "string" && (STAGES as readonly string[]).includes(value);
}

function parseId(value: string | undefined): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

async function runStageJob(
  stage: Stage,
  bookId: number,
): Promise<{ status: string; error: string | null; artifactPath: string | null }> {
  if (stage === "layout") {
    const result = await buildInteriorPreflightPdf();
    return {
      status: "completed",
      error: null,
      artifactPath: result.path,
    };
  }
  if (stage === "print_gate") {
    const hasInterior = await interiorExists();
    if (!hasInterior) {
      return {
        status: "failed",
        error: "Print gate blocked: interior PDF does not exist yet. Run layout or preflight.",
        artifactPath: null,
      };
    }
    if (INTERIOR_PAGE_COUNT % 2 !== 0) {
      return {
        status: "failed",
        error: "Print gate blocked: interior page count is not even.",
        artifactPath: null,
      };
    }
    const store = await getStore();
    await store.updateBook(bookId, { status: "interior_frozen" });
    return {
      status: "completed",
      error: null,
      artifactPath: null,
    };
  }
  if (stage === "draft" || stage === "illustrate") {
    return {
      status: "needs_review",
      error: null,
      artifactPath: null,
    };
  }
  if (stage === "cover") {
    return {
      status: "queued",
      error: "Cover wrap is untouched in this repo. Job accepted only after freeze; no cover.pdf is generated.",
      artifactPath: null,
    };
  }
  return { status: "completed", error: null, artifactPath: null };
}

export function registerRoutes(app: Express) {
  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.get("/api/workspace", async (_req, res) => {
    const store = await getStore();
    res.json(await buildWorkspaceView(store));
  });

  app.get("/api/projects", async (_req, res) => {
    const store = await getStore();
    const [projectRows, active] = await Promise.all([
      store.listBooks(),
      store.getBook(),
    ]);
    res.json({
      studioName: "Casa Studio",
      activeBookId: active.id,
      projects: projectRows.map((book) => ({
        id: book.id,
        title: book.title,
        language: book.language,
        variety: book.variety,
        trim: book.trim,
        status: book.status,
      })),
    });
  });

  app.get("/api/projects/:bookId/research", async (req: Request, res: Response) => {
    const bookId = parseId(req.params.bookId);
    if (bookId == null) {
      res.status(400).json({ error: "Invalid book id" });
      return;
    }
    const store = await getStore();
    res.json(await store.listResearch(bookId));
  });

  app.post("/api/projects/:bookId/research", async (req: Request, res: Response) => {
    const bookId = parseId(req.params.bookId);
    if (bookId == null) {
      res.status(400).json({ error: "Invalid book id" });
      return;
    }
    const title = typeof req.body?.title === "string" ? req.body.title.trim() : "";
    const body = typeof req.body?.body === "string" ? req.body.body.trim() : "";
    const source = typeof req.body?.source === "string" ? req.body.source.trim() : "";
    if (!title || !body) {
      res.status(400).json({ error: "title and body are required" });
      return;
    }
    const store = await getStore();
    const note = await store.createResearch({ bookId, title, body, source });
    res.status(201).json(note);
  });

  app.patch("/api/projects/:bookId/research/:id", async (req: Request, res: Response) => {
    const bookId = parseId(req.params.bookId);
    const id = parseId(req.params.id);
    if (bookId == null || id == null) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const patch: { title?: string; body?: string; source?: string } = {};
    if (typeof req.body?.title === "string") patch.title = req.body.title.trim();
    if (typeof req.body?.body === "string") patch.body = req.body.body.trim();
    if (typeof req.body?.source === "string") patch.source = req.body.source.trim();
    const store = await getStore();
    const note = await store.updateResearch(id, patch);
    if (!note || note.bookId !== bookId) {
      res.status(404).json({ error: "Research note not found" });
      return;
    }
    res.json(note);
  });

  app.delete("/api/projects/:bookId/research/:id", async (req: Request, res: Response) => {
    const bookId = parseId(req.params.bookId);
    const id = parseId(req.params.id);
    if (bookId == null || id == null) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const store = await getStore();
    const existing = (await store.listResearch(bookId)).find((row) => row.id === id);
    if (!existing) {
      res.status(404).json({ error: "Research note not found" });
      return;
    }
    await store.deleteResearch(id);
    res.status(204).end();
  });

  app.post("/api/generate", (_req, res) => {
    res.status(501).json({ error: "not wired" });
  });

  app.get("/api/print-checklist", async (_req, res) => {
    const store = await getStore();
    const workspace = await buildWorkspaceView(store);
    const draftApproved = workspace.stages.find((s) => s.id === "pedagogy_gate")?.status === "approved";
    const artApproved = workspace.stages.find((s) => s.id === "art_gate")?.status === "approved";
    const even =
      workspace.interiorPageCount > 0 && workspace.interiorPageCount % 2 === 0;

    const items = [
      {
        id: "book",
        label: "Active project",
        status: "ready" as const,
        detail: `${workspace.book.title} · ${workspace.chapters.length} chapters (Part I) · ${workspace.book.variety} · trim ${workspace.book.trim}`,
      },
      {
        id: "draft",
        label: "Draft review",
        status: draftApproved ? ("ready" as const) : ("waiting" as const),
        detail: draftApproved
          ? "Pedagogy gate approved."
          : "Approve or reject the draft with notes.",
      },
      {
        id: "art",
        label: "Art review",
        status: artApproved ? ("ready" as const) : ("waiting" as const),
        detail: artApproved
          ? "Art gate approved."
          : "Approve or reject art with notes.",
      },
      {
        id: "layout",
        label: "Interior layout file",
        status: workspace.interiorAvailable ? ("ready" as const) : ("waiting" as const),
        detail: workspace.interiorAvailable
          ? `Real file at ${workspace.interiorPath}`
          : "No interior PDF on disk yet. Run layout or preflight.",
      },
      {
        id: "page-count",
        label: "Even page count",
        status: even ? ("ready" as const) : ("waiting" as const),
        detail: even
          ? `${workspace.interiorPageCount} pages (even).`
          : "Interior page count is not available until a real PDF exists.",
      },
      {
        id: "freeze",
        label: "Page count frozen",
        status: workspace.pageCountFrozen ? ("ready" as const) : ("waiting" as const),
        detail: workspace.pageCountFrozen
          ? "Interior is frozen. Cover job may run."
          : "Complete print review to freeze the even interior.",
      },
      {
        id: "cover",
        label: "Cover wrap",
        status: "blocked" as const,
        detail: "Cover wrap is untouched. Export does not generate cover.pdf.",
      },
    ];

    res.json({
      items,
      interiorReady: workspace.interiorAvailable && even && workspace.pageCountFrozen,
      coverReady: workspace.coverReady,
    });
  });

  app.post("/api/jobs", async (req: Request, res: Response) => {
    const stage = req.body?.stage;
    if (!isStage(stage)) {
      res.status(400).json({ error: "Unknown stage" });
      return;
    }

    const store = await getStore();
    const workspace = await buildWorkspaceView(store);

    if (stage === "cover" && !workspace.coverReady) {
      res.status(400).json({
        error:
          "Cover is locked until the interior page count is even and frozen.",
      });
      return;
    }

    const queued = await store.createJob({
      bookId: workspace.book.id,
      stage,
      status: "queued",
      error: null,
      artifactPath: null,
    });

    try {
      const result = await runStageJob(stage, workspace.book.id);
      const job = await store.updateJob(queued.id, result);
      res.status(201).json(job);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const job = await store.updateJob(queued.id, {
        status: "failed",
        error: message,
      });
      res.status(500).json(job);
    }
  });

  app.post("/api/reviews", async (req: Request, res: Response) => {
    const kind = req.body?.kind;
    const decision = req.body?.decision;
    const notes = typeof req.body?.notes === "string" ? req.body.notes.trim() : "";

    if (kind !== "draft" && kind !== "art") {
      res.status(400).json({ error: "kind must be draft or art" });
      return;
    }
    if (decision !== "approve" && decision !== "reject") {
      res.status(400).json({ error: "decision must be approve or reject" });
      return;
    }

    const stage: Stage = kind === "draft" ? "pedagogy_gate" : "art_gate";
    const store = await getStore();
    const book = await store.getBook();
    const job = await store.createJob({
      bookId: book.id,
      stage,
      status: decision === "approve" ? "approved" : "rejected",
      error: notes || null,
      artifactPath: null,
    });

    if (kind === "draft") {
      const chapters = await store.listChapters(book.id);
      await Promise.all(
        chapters.map((chapter) =>
          store.updateChapter(chapter.id, {
            status: decision === "approve" ? "approved" : "rejected",
          }),
        ),
      );
    }

    res.status(201).json(job);
  });

  app.post("/api/preflight", async (_req, res) => {
    const result = await buildInteriorPreflightPdf();
    res.json({
      ...result,
      report: formatPreflightReport(result),
    });
  });

  app.post("/api/xai/probe", async (_req, res) => {
    try {
      await runXai("probe");
      res.json({ ok: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(501).json({ error: message });
    }
  });

  app.get("/api/artifacts/interior", async (_req, res) => {
    const filePath = interiorPdfPath();
    try {
      await access(filePath);
    } catch {
      res.status(404).json({
        error:
          "Interior PDF does not exist yet. Run layout or npm run preflight.",
      });
      return;
    }
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="la-casa-de-san-jacinto-preflight.pdf"',
    );
    res.sendFile(filePath);
  });
}
