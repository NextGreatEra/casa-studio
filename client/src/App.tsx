import { useEffect, useState } from "react";

type Job = { id: number; stage: string; status: string; error: string | null; notes: string | null; artifactPath: string | null };
type Workspace = {
  book: { title: string; trim: string; variety: string; interiorPageCount: number | null; interiorFrozen: boolean };
  stages: string[];
  jobs: Job[];
};

export default function App() {
  const [ws, setWs] = useState<Workspace | null>(null);
  const [notes, setNotes] = useState("");

  async function reload() {
    const res = await fetch("/api/workspace");
    setWs(await res.json());
  }
  useEffect(() => { reload(); }, []);

  async function run(stage: string) {
    await fetch("/api/jobs", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ stage, notes }) });
    await reload();
  }
  async function review(kind: "draft" | "art", decision: "approve" | "reject") {
    await fetch("/api/review", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind, decision, notes }) });
    await reload();
  }

  if (!ws) return <main>Cargando…</main>;
  return (
    <main>
      <h1>{ws.book.title}</h1>
      <p>{ws.book.variety} · trim {ws.book.trim} · {ws.book.interiorPageCount ?? "?"} pp · {ws.book.interiorFrozen ? "frozen" : "not frozen"}</p>
      <div className="stepper">
        {ws.stages.map((s) => <span key={s}>{s}</span>)}
      </div>
      <div className="card">
        <h2>Jobs</h2>
        {ws.stages.map((s) => <button key={s} onClick={() => run(s)}>{s}</button>)}
        <p>Cover refuses until interior is even and frozen.</p>
      </div>
      <div className="card">
        <h2>Review</h2>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} style={{ width: "100%" }} />
        <div>
          <button onClick={() => review("draft", "approve")}>approve draft</button>
          <button onClick={() => review("draft", "reject")}>reject draft</button>
          <button onClick={() => review("art", "approve")}>approve art</button>
          <button onClick={() => review("art", "reject")}>reject art</button>
        </div>
      </div>
      <div className="card">
        <h2>Print checklist</h2>
        <ul>
          <li>Trim 7×10</li>
          <li>Even page count (136)</li>
          <li>Fonts embedded (no Helvetica / Times)</li>
          <li>Wrap untouched — no cover.pdf in this PR</li>
        </ul>
        <a href="/api/interior.pdf">Download interior.pdf</a>
      </div>
      <div className="card">
        <h2>Recent jobs</h2>
        <ul>
          {ws.jobs.slice(0, 12).map((j) => (
            <li key={j.id}>{j.stage} · {j.status}{j.error ? ` · ${j.error}` : ""}{j.notes ? ` · ${j.notes}` : ""}</li>
          ))}
        </ul>
      </div>
    </main>
  );
}
