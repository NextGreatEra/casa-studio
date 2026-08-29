import { useEffect, useState } from "react";
import type {
  PrintChecklistItem,
  ResearchNote,
  Stage,
  StudioPayload,
  WorkspacePayload,
} from "../../shared/types";

type Tab = "projects" | "studio" | "pipeline" | "print";
type ChatEntry = { id: number; kind: "user" | "error"; text: string };

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
  const [tab, setTab] = useState<Tab>("projects");
  const [workspace, setWorkspace] = useState<WorkspacePayload | null>(null);
  const [studio, setStudio] = useState<StudioPayload | null>(null);
  const [checklist, setChecklist] = useState<PrintChecklistItem[] | null>(null);
  const [notes, setNotes] = useState({ draft: "", art: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [researchForm, setResearchForm] = useState({
    title: "",
    body: "",
    source: "",
  });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [chat, setChat] = useState<ChatEntry[]>([]);
  const [prompt, setPrompt] = useState("");
  const [chatBusy, setChatBusy] = useState(false);
  const [nextChatId, setNextChatId] = useState(1);

  async function refresh() {
    const [ws, print, projects] = await Promise.all([
      json<WorkspacePayload>("/api/workspace"),
      json<{ items: PrintChecklistItem[] }>("/api/print-checklist"),
      json<StudioPayload>("/api/projects"),
    ]);
    setWorkspace(ws);
    setChecklist(print.items);
    setStudio(projects);
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

  if (!workspace || !studio) {
    return (
      <div className="app">
        <p className="meta">Loading studio…</p>
        {error ? <p className="error">{error}</p> : null}
      </div>
    );
  }

  const bookId = workspace.book.id;
  const research = workspace.research;

  async function saveResearch() {
    const title = researchForm.title.trim();
    const body = researchForm.body.trim();
    const source = researchForm.source.trim();
    if (!title || !body) {
      setError("Research title and body are required.");
      return;
    }
    await run(async () => {
      if (editingId != null) {
        await json(`/api/projects/${bookId}/research/${editingId}`, {
          method: "PATCH",
          body: JSON.stringify({ title, body, source }),
        });
      } else {
        await json(`/api/projects/${bookId}/research`, {
          method: "POST",
          body: JSON.stringify({ title, body, source }),
        });
      }
      setResearchForm({ title: "", body: "", source: "" });
      setEditingId(null);
    });
  }

  async function generate() {
    const text = prompt.trim();
    if (!text || chatBusy) return;
    const userId = nextChatId;
    const errorId = nextChatId + 1;
    setNextChatId((n) => n + 2);
    setChat((current) => [...current, { id: userId, kind: "user", text }]);
    setPrompt("");
    setChatBusy(true);
    setError(null);
    try {
      await json("/api/generate", {
        method: "POST",
        body: JSON.stringify({ prompt: text }),
      });
      setChat((current) => [
        ...current,
        { id: errorId, kind: "error", text: "not wired" },
      ]);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setChat((current) => [
        ...current,
        { id: errorId, kind: "error", text: message },
      ]);
    } finally {
      setChatBusy(false);
    }
  }

  return (
    <div className="app">
      <header className="masthead">
        <div>
          <div className="eyebrow">{studio.studioName}</div>
          <h1>{studio.studioName}</h1>
          <p className="lede">
            English human-in-the-loop xAI book studio. Generate is not wired.
            The first project is listed under Projects; Spanish lives in book
            artifacts, not this chrome.
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
            ["projects", "Projects"],
            ["studio", "Studio"],
            ["pipeline", "Pipeline"],
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

      {tab === "projects" ? (
        <section className="card">
          <h2>Projects</h2>
          <p className="meta">
            Active project id {studio.activeBookId}. Language, variety, and trim
            are project metadata.
          </p>
          <div className="project-list">
            {studio.projects.map((project) => (
              <article
                key={project.id}
                className={`project-card${project.id === studio.activeBookId ? " active" : ""}`}
              >
                <h3>{project.title}</h3>
                <p className="meta">
                  Language {project.language} · Variety {project.variety} · Trim{" "}
                  {project.trim} · Status {project.status}
                </p>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {tab === "studio" ? (
        <div className="studio-grid">
          <section className="card">
            <h2>Research notes</h2>
            <p className="meta">
              Saved records, not chat residue. Title and body required. Source is
              optional.
            </p>
            {research.length === 0 ? (
              <p className="empty">
                No research notes yet. Add a record to persist it.
              </p>
            ) : (
              <div className="research-list">
                {research.map((note: ResearchNote) => (
                  <article className="research-item" key={note.id}>
                    <h3>{note.title}</h3>
                    <p>{note.body}</p>
                    {note.source ? (
                      <p className="meta">Source: {note.source}</p>
                    ) : null}
                    <p className="meta">{note.createdAt}</p>
                    <div className="actions">
                      <button
                        className="ghost"
                        disabled={busy}
                        onClick={() => {
                          setEditingId(note.id);
                          setResearchForm({
                            title: note.title,
                            body: note.body,
                            source: note.source,
                          });
                        }}
                      >
                        Edit
                      </button>
                      <button
                        className="danger"
                        disabled={busy}
                        onClick={() =>
                          run(() =>
                            json(`/api/projects/${bookId}/research/${note.id}`, {
                              method: "DELETE",
                            }),
                          )
                        }
                      >
                        Delete
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
            <form
              className="research-form"
              onSubmit={(event) => {
                event.preventDefault();
                void saveResearch();
              }}
            >
              <input
                value={researchForm.title}
                onChange={(event) =>
                  setResearchForm((current) => ({
                    ...current,
                    title: event.target.value,
                  }))
                }
                placeholder="Title"
              />
              <textarea
                value={researchForm.body}
                onChange={(event) =>
                  setResearchForm((current) => ({
                    ...current,
                    body: event.target.value,
                  }))
                }
                placeholder="Body"
              />
              <input
                value={researchForm.source}
                onChange={(event) =>
                  setResearchForm((current) => ({
                    ...current,
                    source: event.target.value,
                  }))
                }
                placeholder="Source (optional)"
              />
              <div className="actions">
                <button className="primary" type="submit" disabled={busy}>
                  {editingId != null ? "Save note" : "Add note"}
                </button>
                {editingId != null ? (
                  <button
                    className="ghost"
                    type="button"
                    onClick={() => {
                      setEditingId(null);
                      setResearchForm({ title: "", body: "", source: "" });
                    }}
                  >
                    Cancel
                  </button>
                ) : null}
              </div>
            </form>
          </section>
          <section className="card">
            <h2>Chat</h2>
            <p className="meta">
              Local thread only. Chat is not saved as research. Generate is not
              wired.
            </p>
            <div className="chat-thread">
              {chat.length === 0 ? (
                <p className="empty">
                  No messages yet. Generate will return not wired.
                </p>
              ) : (
                chat.map((entry) => (
                  <div key={entry.id} className={`chat-msg ${entry.kind}`}>
                    <strong>{entry.kind === "user" ? "You" : "Error"}</strong>
                    <p>{entry.text}</p>
                  </div>
                ))
              )}
            </div>
            <textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="Prompt (not sent to a model)"
            />
            <div className="actions">
              <button
                className="primary"
                disabled={chatBusy || !prompt.trim()}
                onClick={() => void generate()}
              >
                Generate
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {tab === "pipeline" ? (
        <div className="grid pipeline-grid">
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
            <p className="meta">
              {workspace.chapters.length} chapters. Part I. No epilogue.
            </p>
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
          <section className="card">
            <h2>Draft review</h2>
            <p className="meta">
              Human gate. Approve or reject with notes. This does not call xAI.
            </p>
            <textarea
              value={notes.draft}
              onChange={(event) =>
                setNotes((current) => ({ ...current, draft: event.target.value }))
              }
              placeholder="Notes for pedagogy"
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
                        kind: "draft",
                        decision: "approve",
                        notes: notes.draft,
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
                        kind: "draft",
                        decision: "reject",
                        notes: notes.draft,
                      }),
                    }),
                  )
                }
              >
                Reject
              </button>
            </div>
          </section>
          <section className="card">
            <h2>Art review</h2>
            <p className="meta">
              Human gate. Approve or reject with notes. This does not call xAI.
            </p>
            <textarea
              value={notes.art}
              onChange={(event) =>
                setNotes((current) => ({ ...current, art: event.target.value }))
              }
              placeholder="Notes for art"
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
                        kind: "art",
                        decision: "approve",
                        notes: notes.art,
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
                        kind: "art",
                        decision: "reject",
                        notes: notes.art,
                      }),
                    }),
                  )
                }
              >
                Reject
              </button>
            </div>
          </section>
        </div>
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
