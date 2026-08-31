import { useEffect, useState } from "react";
import { MemphisGate, SignOutChip, useAuth } from "@thebes/sdk";
import { call, encodeAdd, encodeEdit, encodeRemove, list, type Note } from "./thebes";
import "./App.css";

function NotesApp() {
  const { displayName, session } = useAuth();
  const [notes, setNotes] = useState<Note[]>([]);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [editingId, setEditingId] = useState<bigint | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function loadNotes() {
    try {
      setLoading(true);
      setMessage("");
      setNotes(await list());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to load notes.");
    } finally { setLoading(false); }
  }

  useEffect(() => { if (session) void loadNotes(); }, [session]);

  async function saveNote() {
    if (!title.trim() || !content.trim()) { setMessage("Please enter both a title and content."); return; }
    try {
      setLoading(true); setMessage("");
      await call(editingId === null ? "add" : "edit", editingId === null ? encodeAdd(title.trim(), content.trim()) : encodeEdit(editingId, title.trim(), content.trim()));
      setTitle(""); setContent(""); setEditingId(null);
      setMessage(editingId === null ? "Note created successfully." : "Note updated successfully.");
      await loadNotes();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Operation failed."); }
    finally { setLoading(false); }
  }

  async function deleteNote(id: bigint) {
    try { setLoading(true); setMessage(""); await call("remove", encodeRemove(id)); setMessage("Note deleted successfully."); await loadNotes(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Failed to delete note."); }
    finally { setLoading(false); }
  }

  return <div className="app">
    <header className="app-header">
      <div className="brand"><div className="brand-mark">N</div><div><div className="brand-name">NOTES</div><p>Private on-chain notes</p></div></div>
      <div className="account"><span className="status-dot" /> <span>{displayName || "Signed in"}</span><SignOutChip /></div>
    </header>
    <main>
      <section className={`editor ${editingId !== null ? "is-editing" : ""}`}>
        <div className="editor-heading"><div className="editor-icon">{editingId === null ? "+" : "✎"}</div><div><h2>{editingId === null ? "Create a Note" : "Edit Note"}</h2><p>{editingId === null ? "Store your thoughts securely on-chain." : "Update your existing note."}</p></div></div>
        <div className="field"><label htmlFor="note-title">Title</label><input id="note-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Give your note a title..." /></div>
        <div className="field"><label htmlFor="note-content">Content</label><textarea id="note-content" value={content} onChange={(e) => setContent(e.target.value)} placeholder="Write something worth remembering..." rows={7} /></div>
        <div className="buttons"><button className="primary-action" onClick={saveNote} disabled={loading}>{loading ? "Saving..." : editingId === null ? "Save on-chain" : "Save Changes"}</button>{editingId !== null && <button className="secondary-action" onClick={() => { setEditingId(null); setTitle(""); setContent(""); }} disabled={loading}>Cancel</button>}</div>
        {message && <p className="message" role="status">{message}</p>}
      </section>
      <section className="notes"><div className="notes-header"><h2>Your Notes</h2><button onClick={() => void loadNotes()} disabled={loading}>Refresh</button></div>{loading && notes.length === 0 ? <p>Loading notes...</p> : notes.length === 0 ? <p>No notes yet. Create your first note.</p> : <div className="note-list">{notes.map((note) => <article className="note-card" key={note.id.toString()}><h3>{note.title}</h3><p>{note.content}</p><div className="note-actions"><button onClick={() => { setEditingId(note.id); setTitle(note.title); setContent(note.content); }}>Edit</button><button onClick={() => void deleteNote(note.id)}>Delete</button></div></article>)}</div>}</section>
    </main>
  </div>;
}

export default function App() { return <MemphisGate appName="NOTES" tagline="Your private notes, secured by a Memphis passkey."><NotesApp /></MemphisGate>; }
