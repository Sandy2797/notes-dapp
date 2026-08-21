import { useEffect, useState } from "react";
import {
  call,
  encodeAdd,
  encodeEdit,
    encodeRemove,
    list,
    } from "./thebes";

type Note = {
  id: bigint;
  title: string;
  content: string;
};

function App() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [editingId, setEditingId] = useState<bigint | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function loadNotes() {
    try {
      setLoading(true);

      const result = await list();

      setNotes(result as Note[]);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Failed to load notes"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadNotes();
  }, []);

  async function saveNote() {
    if (!title.trim() || !content.trim()) {
      setMessage("Please enter both a title and content.");
      return;
    }

    try {
      setLoading(true);
      setMessage("");

      if (editingId === null) {
        await call("add", encodeAdd(title, content));
        setMessage("Note created successfully.");
      } else {
        await call("edit", encodeEdit(editingId, title, content));
        setMessage("Note updated successfully.");
      }

      setTitle("");
      setContent("");
      setEditingId(null);

      await loadNotes();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Operation failed"
      );
    } finally {
      setLoading(false);
    }
  }

  async function deleteNote(id: bigint) {
    try {
      setLoading(true);
      setMessage("");

      await call("remove", encodeRemove(id));

      setMessage("Note deleted successfully.");
      await loadNotes();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Failed to delete note"
      );
    } finally {
      setLoading(false);
    }
  }

  function startEdit(note: Note) {
    setEditingId(note.id);
    setTitle(note.title);
    setContent(note.content);
    setMessage("");
  }

  function cancelEdit() {
    setEditingId(null);
    setTitle("");
    setContent("");
  }

  return (
    <div className="app">
      <header className="app-header">
  <div className="brand">
    <div className="brand-mark">N</div>

    <div>
      <div className="brand-name">NOTES</div>
      <p>On-chain notes powered by Thebes</p>
    </div>
  </div>

  <div className="network-status">
    <span className="status-dot" />
    <span>On-chain</span>
  </div>
</header>
      <main>
        <section className={`editor ${editingId !== null ? "is-editing" : ""}`}>
  <div className="editor-heading">
    <div className="editor-icon">
      {editingId === null ? "+" : "✎"}
    </div>

    <div>
      <h2>
        {editingId === null ? "Create a Note" : "Edit Note"}
      </h2>

      <p>
        {editingId === null
          ? "Store your thoughts securely on-chain."
          : "Update your existing on-chain note."}
      </p>
    </div>
  </div>

  <div className="field">
    <label htmlFor="note-title">Title</label>

    <input
      id="note-title"
      type="text"
      placeholder="Give your note a title..."
      value={title}
      onChange={(e) => setTitle(e.target.value)}
    />
  </div>

  <div className="field">
    <label htmlFor="note-content">Content</label>

    <textarea
      id="note-content"
      placeholder="Write something worth remembering..."
      value={content}
      onChange={(e) => setContent(e.target.value)}
      rows={7}
    />
  </div>

  <div className="buttons">
    <button className="primary-action" onClick={saveNote} disabled={loading}>
      {loading
        ? "Saving..."
        : editingId === null
        ? "Save on-chain"
        : "Save Changes"}
    </button>

    {editingId !== null && (
      <button
        className="secondary-action"
        onClick={cancelEdit}
        disabled={loading}
      >
        Cancel
      </button>
    )}
  </div>

  {message && <p className="message">{message}</p>}
</section>

        <section className="notes">
          <div className="notes-header">
            <h2>Your Notes</h2>

            <button onClick={loadNotes} disabled={loading}>
              Refresh
            </button>
          </div>

          {loading && notes.length === 0 ? (
            <p>Loading notes...</p>
          ) : notes.length === 0 ? (
            <p>No notes yet. Create your first note.</p>
          ) : (
            <div className="note-list">
              {notes.map((note) => (
                <article className="note-card" key={note.id.toString()}>
                  <h3>{note.title}</h3>
                  <p>{note.content}</p>

                  <div className="note-actions">
                    <button onClick={() => startEdit(note)}>
                      Edit
                    </button>

                    <button onClick={() => deleteNote(note.id)}>
                      Delete
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default App;
