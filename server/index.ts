import express from "express";
import { mkdir, readFile, stat } from "node:fs/promises";
import { coverAllowed, renderInteriorPreflight } from "./lib/layout.ts";
import { getXaiClient } from "./lib/xai.ts";
import { STAGES, type Stage } from "../shared/schema.ts";

type Job = {
  id: number;
  bookId: number;
  stage: Stage;
  status: string;
  error: string | null;
  artifactPath: string | null;
  notes: string | null;
};

const book = {
  id: 1,
  title: "La casa de San Jacinto",
  language: "es",
  variety: "es-MX",
  trim: "7x10",
  status: "layout",
  interiorPageCount: 136,
  interiorFrozen: false,
};

const jobs: Job[] = [];
let nextJob = 1;

const app = express();
app.use(express.json());

app.get("/api/workspace", (_req, res) => {
  res.json({ book, stages: STAGES, jobs });
});

app.post("/api/jobs", async (req, res) => {
  const stage = req.body?.stage as Stage;
  if (!STAGES.includes(stage)) {
    res.status(400).json({ error: "unknown stage" });
    return;
  }
  if (stage === "cover" && !coverAllowed(book.interiorPageCount, book.interiorFrozen)) {
    const job: Job = {
      id: nextJob++,
      bookId: book.id,
      stage,
      status: "rejected",
      error: "cover blocked: interior page count must be even and frozen",
      artifactPath: null,
      notes: req.body?.notes ?? null,
    };
    jobs.unshift(job);
    res.status(409).json(job);
    return;
  }
  const job: Job = {
    id: nextJob++,
    bookId: book.id,
    stage,
    status: "running",
    error: null,
    artifactPath: null,
    notes: req.body?.notes ?? null,
  };
  jobs.unshift(job);
  if (stage === "layout" || stage === "print_gate") {
    try {
      await mkdir("artifacts", { recursive: true });
      const result = await renderInteriorPreflight("artifacts/interior-preflight.pdf");
      job.status = "done";
      job.artifactPath = result.path;
      book.interiorPageCount = result.pages;
    } catch (err) {
      job.status = "error";
      job.error = err instanceof Error ? err.message : String(err);
    }
  } else {
    job.status = "queued";
  }
  res.json(job);
});

app.post("/api/review", (req, res) => {
  const { kind, decision, notes } = req.body ?? {};
  if (!["draft", "art"].includes(kind) || !["approve", "reject"].includes(decision)) {
    res.status(400).json({ error: "draft|art plus approve|reject" });
    return;
  }
  const job: Job = {
    id: nextJob++,
    bookId: book.id,
    stage: kind === "draft" ? "pedagogy_gate" : "art_gate",
    status: decision === "approve" ? "approved" : "rejected",
    error: null,
    artifactPath: null,
    notes: notes ?? null,
  };
  jobs.unshift(job);
  res.json(job);
});

app.post("/api/print/freeze", (req, res) => {
  book.interiorFrozen = Boolean(req.body?.frozen);
  res.json(book);
});

app.get("/api/xai/status", (_req, res) => {
  try {
    getXaiClient();
    res.json({ wired: true });
  } catch (err) {
    res.json({ wired: false, error: err instanceof Error ? err.message : String(err) });
  }
});

app.get("/api/interior.pdf", async (_req, res) => {
  const path = "artifacts/interior-preflight.pdf";
  try {
    await stat(path);
    const buf = await readFile(path);
    res.setHeader("content-type", "application/pdf");
    res.send(buf);
  } catch {
    res.status(404).json({ error: "interior.pdf not generated yet; run layout or npm run preflight" });
  }
});

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => {
  console.log(`casa-studio api on :${port}`);
});
