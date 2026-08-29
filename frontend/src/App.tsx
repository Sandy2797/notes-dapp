import { useEffect, useState } from "react";
import { useMemphis } from "@thebes/sdk";
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

function SignInScreen() {
  const { signIn, busy, error } = useMemphis();
  const [name, setName] = useState("");
  const [mode, setMode] = useState<"signin" | "register">("signin");
  const [registerBusy, setRegisterBusy] = useState(false);
  const [registerError, setRegisterError] = useState("");

  const isBusy = busy || registerBusy;

  async function handleAuth() {
    const trimmedName = name.trim();

    if (!trimmedName || isBusy) {
      return;
    }

    setRegisterError("");

    try {
      if (mode === "register") {
        setRegisterBusy(true);

        const passkey = (
          window as unknown as {
            MemphisPasskey?: {
              register: (name: string) => Promise<unknown>;
            };
          }
        ).MemphisPasskey;

        if (!passkey) {
          throw new Error("Passkey service is not available.");
        }

        await passkey.register(trimmedName);

        // register() saves the Memphis session in localStorage.
        // Reload so useMemphis loads the new session.
        window.location.reload();
      } else {
        await signIn(trimmedName);
      }
    } catch (e) {
      if (mode === "register") {
        setRegisterError(
          e instanceof Error
            ? e.message
            : "Failed to create passkey."
        );
      }
    } finally {
      setRegisterBusy(false);
    }
  }

  function switchMode() {
    setRegisterError("");

    setMode((current) =>
      current === "signin" ? "register" : "signin"
    );
  }

  const displayedError =
    mode === "register"
      ? registerError
      : error;

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">N</div>

        <div className="auth-brand">NOTES</div>

        <h1>Private Notes</h1>

        <p className="auth-description">
          {mode === "signin"
            ? "Sign in with your passkey to access your private notes."
            : "Create a passkey to securely access your private notes."}
        </p>

        <div className="auth-field">
          <label htmlFor="auth-name">Your name</label>

          <input
            id="auth-name"
            type="text"
            placeholder="Enter your name..."
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setRegisterError("");
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleAuth();
              }
            }}
            disabled={isBusy}
            autoFocus
          />
        </div>

        <button
          className="auth-button"
          onClick={handleAuth}
          disabled={isBusy || !name.trim()}
        >
          {isBusy
            ? mode === "signin"
              ? "Signing in..."
              : "Creating passkey..."
            : mode === "signin"
              ? "Sign in with passkey"
              : "Create passkey"}
        </button>

        <button
          type="button"
          className="auth-switch"
          onClick={switchMode}
          disabled={isBusy}
        >
          {mode === "signin"
            ? "New here? Create a passkey"
            : "Already have an identity? Sign in"}
        </button>

        {displayedError && (
          <p className="auth-error">
            {displayedError}
          </p>
        )}

        <p className="auth-note">
          A passkey is your identity — no password required.
        </p>
      </div>
    </div>
  );
}

function NotesApp() {
  const { displayName, signOut, busy: authBusy } = useMemphis();

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

  async function handleSignOut() {
    await signOut();
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

        <div className="header-actions">
          <div className="network-status">
            <span className="status-dot" />
            <span>On-chain</span>
          </div>

          <div className="user-status">
            <span className="user-name">
              {displayName || "Signed in"}
            </span>

            <button
              className="sign-out-button"
              onClick={handleSignOut}
              disabled={authBusy}
            >
              {authBusy ? "Signing out..." : "Sign out"}
            </button>
          </div>
        </div>
      </header>

      <main>
        <section
          className={`editor ${editingId !== null ? "is-editing" : ""}`}
        >
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
            <button
              className="primary-action"
              onClick={saveNote}
              disabled={loading}
            >
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
            <p>No notes yet. Create your first private note.</p>
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

function App() {
  const { signedIn } = useMemphis();

  if (!signedIn) {
    return <SignInScreen />;
  }

  return <NotesApp />;
}

export default App;
