"use client";
import { useCallback, useEffect, useState } from "react";
import type { Board } from "../lib/boards";
import type { Spec } from "../lib/catalog/spec";
import { WidgetPreview } from "./widget-preview";

function noteSpec(text: string): Spec {
  return { root: "board", elements: {
    board: { type: "Board", props: { title: "A little reminder" }, children: ["note"] },
    note: { type: "Note", props: { text, loud: true }, children: [] },
  } };
}
const example = noteSpec("Make room for a good idea.");

function RenderElement({ spec, id, depth = 0 }: { spec: Spec; id: string; depth?: number }) {
  const item = spec.elements[id];
  if (!item || depth > 8) return null;
  const children = item.children.map(child => <RenderElement key={child} id={child} spec={spec} depth={depth + 1} />);
  switch (item.type) {
    case "Board": return <div className="board-content">{item.props.title && <p className="widget-title">{item.props.title}</p>}{children}</div>;
    case "Row": return <div className="widget-row">{children}</div>;
    case "Note": return <p className={item.props.loud ? "widget-note loud" : "widget-note"}>{item.props.text}</p>;
    case "Stat": return <div className={`widget-stat tone-${item.props.tone}`}><p className="widget-label">{item.props.label}</p><strong>{item.props.value}</strong>{item.props.caption && <p className="widget-caption">{item.props.caption}</p>}</div>;
    case "Progress": return <div className={`widget-progress tone-${item.props.tone}`}><p className="widget-label">{item.props.label}</p><progress max={1} value={item.props.value} aria-label={item.props.label} />{item.props.caption && <p className="widget-caption">{item.props.caption}</p>}</div>;
  }
}

export function BoardWorkspace({ signedIn, signInPath }: { signedIn: boolean; signInPath: string }) {
  const [board, setBoard] = useState<Board | null>(null);
  const [loading, setLoading] = useState(signedIn);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const refresh = useCallback(async () => {
    if (!signedIn) return;
    setLoading(true); setError("");
    try {
      const response = await fetch("/boards", { cache: "no-store" });
      const data = await response.json() as { boards: Board[]; error?: string };
      if (!response.ok) throw new Error(data.error || "Could not load your canvas.");
      setBoard(data.boards[0] ?? null);
    } catch (error) { setError(error instanceof Error ? error.message : "Could not load your canvas."); }
    finally { setLoading(false); }
  }, [signedIn]);
  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    if (!signedIn) return;
    const interval = setInterval(() => { if (document.visibilityState === "visible") void refresh(); }, 30_000);
    return () => clearInterval(interval);
  }, [refresh, signedIn]);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError(""); setMessage("");
    try {
      const response = await fetch("/boards/welcome", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ spec: noteSpec(note.trim()) }) });
      const data = await response.json() as Board & { error?: string };
      if (!response.ok) throw new Error(data.error || "Could not save this board.");
      setBoard(data);
      setMessage("Saved to your phone’s canvas."); setNote("");
    } catch (error) { setError(error instanceof Error ? error.message : "Could not save this board."); }
    finally { setSaving(false); }
  }
  return <>
    <div className="section-heading"><h2>Your canvas</h2><button className="text-button" onClick={() => void refresh()} disabled={!signedIn || loading}>{loading ? "Refreshing…" : "↻ Refresh"}</button></div>
    {error && <p className="error" role="alert">{error}</p>}
    <section className="workspace-grid" aria-label="Your widget canvas">
      {board && <WidgetPreview board={board} />}
      {!board && <article className="board-card example"><div className="widget"><RenderElement spec={example} id={example.root} /><span className="example-mark">EXAMPLE</span></div><div className="board-caption"><strong>Your canvas starts here</strong><span>{loading ? "Loading your canvas…" : "Nothing saved yet"}</span></div></article>}
      <article className="compose-card"><div className="compose-heading"><span className="plus" aria-hidden="true">＋</span><h3>Leave yourself a note.</h3><p>Start small. Your agent can take it from here.</p></div>
        {signedIn ? <form onSubmit={save}>
          <label htmlFor="note">What’s on your mind?</label><textarea id="note" value={note} onChange={event => setNote(event.target.value)} placeholder="Pick up flowers on the way home." maxLength={140} required rows={3} /><div className="character-count">{note.length}/140</div>
          {board && <p className="replace-hint">This replaces what’s on your phone.</p>}
          <button className="primary-button" type="submit" disabled={saving || !note.trim()}>{saving ? "Saving…" : "Update my canvas ↗"}</button>
          <p className="save-status" role="status">{message}</p>
        </form> : <div className="signin-block"><p>Sign in to update your canvas and give your agent a place to put things.</p><a className="primary-button" href={signInPath} target="_top">Continue with ChatGPT ↗</a></div>}
      </article>
    </section>
    <section className="agent-panel"><div><p className="eyebrow">LET YOUR AGENT PUT IT HERE</p><h2>Say it. Save it. Glance at it.</h2><p>Connect the Widget Board plugin in ChatGPT or Codex, then ask:</p><blockquote>“Put a reminder to call Mom on my phone.”</blockquote>
      <button className="text-button" onClick={async () => { try { await navigator.clipboard.writeText("Use Widget Board to put a reminder to call Mom on my phone."); setCopied(true); } catch { setCopied(false); setError("Could not copy. You can select the example text above."); } }}>{copied ? "Copied ✓" : "Copy prompt ↗"}</button></div>
      <div className="connection-note"><span className="connection-icon" aria-hidden="true">▣</span><h3>Take it to your home screen.</h3><p>Open the Widget Board iPhone app and choose Continue with ChatGPT. Approve the connection, then add the Board widget. Every update goes to that same canvas.</p><a className="text-button" href="/devices">Manage connected devices ↗</a><p className="muted">iOS decides when widgets refresh. Open the app and tap Reload to request an update.</p></div>
    </section>
  </>;
}
