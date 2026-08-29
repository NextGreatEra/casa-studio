import { useEffect, useState } from "react";
import type {
  PrintChecklistItem,
  Stage,
  WorkspacePayload,
} from "../../shared/types";

type Tab = "pipeline" | "draft" | "art" | "print";

async function json<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error((data as { error?: string }).error ?? response.statusText);
  }
  return data as T;
}

function statusClass(status: string) {
  if (["completed", "approved", "ready"].includes(status)) return "ready";
  if (["needs_review", "queued", "waiting"].includes(status)) return "wait";
  if (["failed", "rejected", "blocked"].includes(status)) return "blocked";
  return "";
}

export default function App() {
  const [tab, setTab] = useState<Tab>("pipeline");
  const [workspace, setWorkspace] = useState<WorkspacePayload | null>(null);
  const [checklist, setChecklist] = useState<PrintChecklistItem[] | null>(null);
  const [notes, setNotes] = useState({ draft: "", art: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const [ws, print] = await Promise.all([
      json<WorkspacePayload>("/api/workspace"),
      json<{ items: PrintChecklistItem[] }>("/api/print-checklist"),
    ]);
    setWorkspace(ws);
    setChecklist(print.items);
  }

  useEffect(() => {
    refresh().catch((err: Error) => setError(err.message));
  }, []);

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  if (!workspace) {
    return (
      <div className="app">
        <p className="meta">Loading La casa de San Jacinto…</p>
        {error ? <p className="error">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className="app">
      <header className="masthead">
        <div>
          <div className="eyebrow">Casa Studio</div>
          <h1>{workspace.book.title}</h1>
          <p className="lede">
            One-book harness. Manuscript stays in NextGreatEra/la-casa-de-san-jacinto.
            {" "}
            {workspace.chapters.length} rows · {workspace.book.language}/
            {workspace.book.variety} · trim {workspace.book.trim}. xAI is not wired.
          </p>
        </div>
        <div className="badge">
          {workspace.pageCountFrozen ? "Interior frozen" : "Interior open"} ·{" "}
          {workspace.interiorPageCount || "—"} pp
        </div>
      </header>

      <nav className="tabs">
        {(
          [
            ["pipeline", "Pipeline"],
            ["draft", "Draft review"],
            ["art", "Art review"],
            ["print", "Print"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            className={tab === id ? "active" : ""}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </nav>

      {error ? <p className="error">{error}</p> : null}

      {tab === "pipeline" ? (
        <div className="grid">
          <section className="card">
            <h2>Pipeline</h2>
            <div className="stepper">
              {workspace.stages.map((stage) => (
                <div className="step" key={stage.id}>
                  <span className={`dot ${statusClass(stage.status)}`} />
                  <div>
                    <strong>{stage.label}</strong>
                    <small>
                      {stage.status.replaceAll("_", " ")}
                      {stage.detail ? ` — ${stage.detail}` : ""}
                    </small>
                  </div>
                  <button
                    className="ghost"
                    disabled={busy || (stage.id === "cover" && !workspace.coverReady)}
                    onClick={() =>
                      run(() =>
                        json("/api/jobs", {
                          method: "POST",
                          body: JSON.stringify({ stage: stage.id as Stage }),
                        }),
                      )
                    }
                  >
                    Run
                  </button>
                </div>
              ))}
            </div>
          </section>
          <section className="card">
            <h2>Chapters</h2>
            <p className="meta">8 capítulos. Parte I — La casa. No epílogo.</p>
            <div className="chapters">
              {workspace.chapters.map((chapter) => (
                <div className="chip" key={chapter.id}>
                  <strong>{chapter.number}</strong>
                  {chapter.title}
                  <small className="meta">{chapter.status}</small>
                </div>
              ))}
            </div>
          </section>
        </div>
      ) : null}

      {tab === "draft" || tab === "art" ? (
        <section className="card">
          <h2>{tab === "draft" ? "Draft review" : "Art review"}</h2>
          <p className="meta">
            Human gate. Approve or reject with notes. This does not call xAI.
          </p>
          <textarea
            value={notes[tab]}
            onChange={(event) =>
              setNotes((current) => ({ ...current, [tab]: event.target.value }))
            }
            placeholder="Notes for pedagogy / art"
          />
          <div className="actions">
            <button
              className="primary"
              disabled={busy}
              onClick={() =>
                run(() =>
                  json("/api/reviews", {
                    method: "POST",
                    body: JSON.stringify({
                      kind: tab,
                      decision: "approve",
                      notes: notes[tab],
                    }),
                  }),
                )
              }
            >
              Approve
            </button>
            <button
              className="danger"
              disabled={busy}
              onClick={() =>
                run(() =>
                  json("/api/reviews", {
                    method: "POST",
                    body: JSON.stringify({
                      kind: tab,
                      decision: "reject",
                      notes: notes[tab],
                    }),
                  }),
                )
              }
            >
              Reject
            </button>
          </div>
        </section>
      ) : null}

      {tab === "print" ? (
        <div className="grid">
          <section className="card">
            <h2>Print checklist</h2>
            <ul className="checklist">
              {(checklist ?? []).map((item) => (
                <li key={item.id}>
                  <span className={`mark ${item.status}`}>
                    {item.status === "ready" ? "●" : item.status === "blocked" ? "✕" : "○"}
                  </span>
                  <div>
                    <strong>{item.label}</strong>
                    <div className="meta">{item.detail}</div>
                  </div>
                </li>
              ))}
            </ul>
            <div className="actions">
              <button
                className="primary"
                disabled={busy}
                onClick={() => run(() => json("/api/preflight", { method: "POST" }))}
              >
                Build Part I interior
              </button>
              {workspace.interiorAvailable ? (
                <a className="primary" href="/api/artifacts/interior" style={{ textDecoration: "none" }}>
                  Download interior PDF
                </a>
              ) : (
                <button className="ghost" disabled>
                  Interior download (no file yet)
                </button>
              )}
            </div>
            <p className="meta">
              No cover.pdf link. Cover wrap stays untouched until the even interior is frozen.
              KDP Print will re-check fonts with pdffonts.
            </p>
          </section>
          <section className="card">
            <h2>Jobs</h2>
            <div className="jobs">
              {workspace.jobs.length === 0 ? (
                <p>No jobs yet.</p>
              ) : (
                workspace.jobs.slice(0, 12).map((job) => (
                  <p key={job.id}>
                    #{job.id} {job.stage} · {job.status}
                    {job.error ? ` — ${job.error}` : ""}
                    {job.artifactPath ? ` · ${job.artifactPath}` : ""}
                  </p>
                ))
              )}
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
