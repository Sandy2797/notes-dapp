import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  createNote,
  deleteNote,
  feedView,
  issueNotesScopedSession,
  ledgerSealView,
  listNotes,
  myBalance,
  shareNote,
  tip,
  tipHistoryView,
  tokenMetadataView,
  unshareNote,
  updateNote,
  type FeedNote,
  type LedgerSeal,
  type Note,
  type TipRecord,
  type TokenMetadata,
} from "./thebes";
import { useTheme } from "./useTheme";
import { useMemphis } from "@thebes/sdk";
import "./App.css";

function shortPrincipal(principal: string): string {
  if (principal.length <= 24) {
    return principal;
  }

  return `${principal.slice(0, 11)}...${principal.slice(-9)}`;
}

function formatTipTime(timestamp: bigint): string {
  try {
    const milliseconds = Number(timestamp / 1_000_000n);
    return new Date(milliseconds).toLocaleString();
  } catch {
    return timestamp.toString();
  }
}

export default function App() {
  const theme = useTheme();
  const { session, signOut } = useMemphis();

  const masterSessionToken =
    session?.session_token_hex ?? "";

  const [sessionToken, setSessionToken] = useState("");

  const [notes, setNotes] = useState<Note[]>([]);
  const [feed, setFeed] = useState<FeedNote[]>([]);
  const [history, setHistory] = useState<TipRecord[]>([]);
  const [balance, setBalance] = useState<bigint>(0n);
  const [seal, setSeal] = useState<LedgerSeal | null>(null);
  const [metadata, setMetadata] =
    useState<TokenMetadata | null>(null);

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  const [editingId, setEditingId] =
    useState<bigint | null>(null);

  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");

  const [tipAmounts, setTipAmounts] =
    useState<Record<string, string>>({});

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [deletingId, setDeletingId] =
    useState<bigint | null>(null);

  const [sharingId, setSharingId] =
    useState<bigint | null>(null);

  const [tippingId, setTippingId] =
    useState<bigint | null>(null);

  const [error, setError] =
    useState<string | null>(null);

  const [message, setMessage] =
    useState<string | null>(null);

  const sharedIds = useMemo(
    () => new Set(feed.map((item) => item.id.toString())),
    [feed]
  );

  useEffect(() => {
    let cancelled = false;

    setSessionToken("");

    if (!masterSessionToken) {
      return;
    }

    void issueNotesScopedSession(
      masterSessionToken
    )
      .then((token) => {
        if (!cancelled) {
          setSessionToken(token);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setLoading(false);
          setError(
            `Could not prepare private notes session: ${String(err)}`
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [masterSessionToken]);

  const refreshAll = useCallback(async () => {
    if (!sessionToken) {
      return;
    }

    setError(null);

    try {
      /*
       * Keep authenticated update calls sequential.
       * They use the same transport sender/nonce.
       */
      const myNotes = await listNotes(sessionToken);
      const myPoints = await myBalance(sessionToken);

      const [
        publicFeed,
        publicHistory,
        ledgerSeal,
        tokenMetadata,
      ] = await Promise.all([
        feedView(),
        tipHistoryView(),
        ledgerSealView(),
        tokenMetadataView(),
      ]);

      setNotes(myNotes);
      setBalance(myPoints);
      setFeed(publicFeed);
      setHistory(publicHistory);
      setSeal(ledgerSeal);
      setMetadata(tokenMetadata);
    } catch (err) {
      setError(
        `Could not refresh the app: ${String(err)}`
      );
    } finally {
      setLoading(false);
    }
  }, [sessionToken]);

  useEffect(() => {
    void refreshAll();
  }, [refreshAll]);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();

    const cleanTitle = title.trim();
    const cleanBody = body.trim();

    if (!cleanTitle) {
      setError("Please enter a note title.");
      return;
    }

    if (!cleanBody) {
      setError("Please enter some note content.");
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      if (!sessionToken) {
        throw new Error(
          "Memphis session is unavailable."
        );
      }

      await createNote(
        sessionToken,
        cleanTitle,
        cleanBody
      );

      setTitle("");
      setBody("");

      await refreshAll();

      setMessage("Note created successfully.");
    } catch (err) {
      setError(
        `Could not create note: ${String(err)}`
      );
    } finally {
      setSaving(false);
    }
  }

  function beginEdit(note: Note) {
    setEditingId(note.id);
    setEditTitle(note.title);
    setEditBody(note.body);

    setError(null);
    setMessage(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditTitle("");
    setEditBody("");
  }

  async function handleUpdate(noteId: bigint) {
    const cleanTitle = editTitle.trim();
    const cleanBody = editBody.trim();

    if (!cleanTitle) {
      setError("Please enter a note title.");
      return;
    }

    if (!cleanBody) {
      setError("Please enter some note content.");
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      if (!sessionToken) {
        throw new Error(
          "Memphis session is unavailable."
        );
      }

      const updated = await updateNote(
        sessionToken,
        noteId,
        cleanTitle,
        cleanBody
      );

      if (!updated) {
        throw new Error(
          "The note was not found."
        );
      }

      cancelEdit();

      await refreshAll();

      setMessage("Note updated successfully.");
    } catch (err) {
      setError(
        `Could not update note: ${String(err)}`
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(noteId: bigint) {
    const confirmed = window.confirm(
      "Are you sure you want to delete this note?"
    );

    if (!confirmed) {
      return;
    }

    setDeletingId(noteId);
    setError(null);
    setMessage(null);

    try {
      if (!sessionToken) {
        throw new Error(
          "Memphis session is unavailable."
        );
      }

      const deleted = await deleteNote(
        sessionToken,
        noteId
      );

      if (!deleted) {
        throw new Error(
          "The note was not found."
        );
      }

      if (editingId === noteId) {
        cancelEdit();
      }

      await refreshAll();

      setMessage("Note deleted successfully.");
    } catch (err) {
      setError(
        `Could not delete note: ${String(err)}`
      );
    } finally {
      setDeletingId(null);
    }
  }

  async function handleShare(
    noteId: bigint,
    currentlyShared: boolean
  ) {
    setSharingId(noteId);
    setError(null);
    setMessage(null);

    try {
      if (!sessionToken) {
        throw new Error(
          "Memphis session is unavailable."
        );
      }

      const changed = currentlyShared
        ? await unshareNote(sessionToken, noteId)
        : await shareNote(sessionToken, noteId);

      if (!changed) {
        throw new Error(
          "The note could not be found."
        );
      }

      await refreshAll();

      setMessage(
        currentlyShared
          ? "Note removed from the public feed."
          : "Note shared to the public feed."
      );
    } catch (err) {
      setError(
        `Could not ${
          currentlyShared ? "unshare" : "share"
        } note: ${String(err)}`
      );
    } finally {
      setSharingId(null);
    }
  }

  function updateTipAmount(
    noteId: bigint,
    value: string
  ) {
    setTipAmounts((current) => ({
      ...current,
      [noteId.toString()]: value,
    }));
  }

  async function handleTip(item: FeedNote) {
    const key = item.id.toString();
    const rawAmount = tipAmounts[key]?.trim() ?? "";

    if (!/^\d+$/.test(rawAmount)) {
      setError(
        "Enter a whole-number tip amount."
      );
      return;
    }

    const amount = BigInt(rawAmount);

    if (amount <= 0n) {
      setError(
        "Tip amount must be greater than zero."
      );
      return;
    }

    setTippingId(item.id);
    setError(null);
    setMessage(null);

    try {
      if (!sessionToken) {
        throw new Error(
          "Memphis session is unavailable."
        );
      }

      const result = await tip(
        sessionToken,
        item.author,
        amount
      );

      if ("err" in result) {
        throw new Error(result.err);
      }

      setTipAmounts((current) => ({
        ...current,
        [key]: "",
      }));

      await refreshAll();

      setMessage(
        `Successfully tipped ${amount.toString()} BCP.`
      );
    } catch (err) {
      const text =
        err instanceof Error
          ? err.message
          : String(err);

      setError(`Could not send tip: ${text}`);
    } finally {
      setTippingId(null);
    }
  }

  return (
    <main className="shell">
      <header>
        <div className="header-actions">
          <button
            className="logout-button"
            onClick={() => void signOut()}
            type="button"
          >
            Log out
          </button>

          <button
            className="theme-toggle"
            onClick={theme.toggle}
          aria-label={`Switch to ${
            theme.effective === "dark"
              ? "light"
              : "dark"
          } mode`}
          title={`Switch to ${
            theme.effective === "dark"
              ? "light"
              : "dark"
          } mode`}
          >
            {theme.effective === "dark" ? "☀" : "☾"}
          </button>
        </div>

        <div className="cartouche">✦</div>

        <h1>Note DApp</h1>

        <p className="strap">
          Private notes, public sharing and community
          tipping on the Thebes chain
        </p>

        <div className="balance-card">
          <span>Your balance</span>
          <strong>
            {loading ? "..." : balance.toString()} BCP
          </strong>
        </div>
      </header>

      <nav className="task-nav">
        <span>Private Notes</span>
        <span>Public Feed</span>
        <span>Points Ledger</span>
      </nav>

      <section className="panel">
        <h2>Create a note</h2>

        <form onSubmit={handleCreate}>
          <input
            type="text"
            value={title}
            onChange={(event) =>
              setTitle(event.target.value)
            }
            placeholder="Note title"
            aria-label="Note title"
            disabled={saving}
          />

          <textarea
            value={body}
            onChange={(event) =>
              setBody(event.target.value)
            }
            placeholder="Write your note..."
            aria-label="Note body"
            rows={5}
            disabled={saving}
          />

          <button
            type="submit"
            disabled={saving}
          >
            {saving
              ? "Saving..."
              : "Create Note"}
          </button>
        </form>
      </section>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      {message && (
        <p className="success" role="status">
          {message}
        </p>
      )}

      <section className="panel">
        <div className="notes-heading">
          <div>
            <h2>Your private notes</h2>

            <p>
              {notes.length}{" "}
              {notes.length === 1
                ? "note"
                : "notes"}{" "}
              on chain
            </p>
          </div>

          <button
            type="button"
            onClick={() => void refreshAll()}
            disabled={loading || saving}
          >
            Refresh
          </button>
        </div>

        {loading ? (
          <p>Loading notes...</p>
        ) : notes.length === 0 ? (
          <div className="empty-state">
            <h3>No notes yet</h3>

            <p>
              Create your first private note using
              the form above.
            </p>
          </div>
        ) : (
          <div className="notes-grid">
            {notes.map((note) => {
              const editing =
                editingId === note.id;

              const deleting =
                deletingId === note.id;

              const sharing =
                sharingId === note.id;

              const shared =
                sharedIds.has(note.id.toString());

              return (
                <article
                  className="note-card"
                  key={note.id.toString()}
                >
                  {editing ? (
                    <>
                      <input
                        type="text"
                        value={editTitle}
                        onChange={(event) =>
                          setEditTitle(
                            event.target.value
                          )
                        }
                        disabled={saving}
                        aria-label="Edit note title"
                      />

                      <textarea
                        value={editBody}
                        onChange={(event) =>
                          setEditBody(
                            event.target.value
                          )
                        }
                        disabled={saving}
                        rows={5}
                        aria-label="Edit note body"
                      />

                      <div className="note-actions">
                        <button
                          type="button"
                          onClick={() =>
                            void handleUpdate(note.id)
                          }
                          disabled={saving}
                        >
                          {saving
                            ? "Saving..."
                            : "Save"}
                        </button>

                        <button
                          type="button"
                          onClick={cancelEdit}
                          disabled={saving}
                        >
                          Cancel
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="note-card-top">
                        <div className="note-number">
                          Note #{note.id.toString()}
                        </div>

                        <span
                          className={
                            shared
                              ? "share-badge shared"
                              : "share-badge"
                          }
                        >
                          {shared
                            ? "Public"
                            : "Private"}
                        </span>
                      </div>

                      <h3>{note.title}</h3>

                      <p className="note-body">
                        {note.body}
                      </p>

                      <div className="note-actions task3-note-actions">
                        <button
                          type="button"
                          onClick={() =>
                            void handleShare(
                              note.id,
                              shared
                            )
                          }
                          disabled={
                            saving ||
                            deletingId !== null ||
                            sharingId !== null
                          }
                        >
                          {sharing
                            ? "Working..."
                            : shared
                              ? "Unshare"
                              : "Share"}
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            beginEdit(note)
                          }
                          disabled={
                            saving ||
                            deletingId !== null ||
                            sharingId !== null
                          }
                        >
                          Edit
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            void handleDelete(note.id)
                          }
                          disabled={
                            saving ||
                            deletingId !== null ||
                            sharingId !== null
                          }
                        >
                          {deleting
                            ? "Deleting..."
                            : "Delete"}
                        </button>
                      </div>
                    </>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="panel public-feed-panel">
        <div className="notes-heading">
          <div>
            <h2>Public feed</h2>
            <p>
              Shared notes from the community
            </p>
          </div>

          <span className="feed-count">
            {feed.length} shared
          </span>
        </div>

        {feed.length === 0 ? (
          <div className="empty-state">
            <h3>The feed is empty</h3>

            <p>
              Share one of your notes to make it
              visible here.
            </p>
          </div>
        ) : (
          <div className="feed-grid">
            {feed.map((item) => {
              const key = item.id.toString();

              return (
                <article
                  className="feed-card"
                  key={key}
                >
                  <div className="feed-card-header">
                    <span>
                      Shared note #{key}
                    </span>

                    <span className="public-badge">
                      Public
                    </span>
                  </div>

                  <h3>{item.title}</h3>

                  <p className="note-body">
                    {item.body}
                  </p>

                  <div className="author-box">
                    <span>Author</span>

                    <code
                      title={item.author}
                    >
                      {shortPrincipal(
                        item.author
                      )}
                    </code>
                  </div>

                  <div className="tip-box">
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={
                        tipAmounts[key] ?? ""
                      }
                      onChange={(event) =>
                        updateTipAmount(
                          item.id,
                          event.target.value
                        )
                      }
                      placeholder="BCP amount"
                      aria-label={`Tip amount for note ${key}`}
                      disabled={
                        tippingId !== null
                      }
                    />

                    <button
                      type="button"
                      onClick={() =>
                        void handleTip(item)
                      }
                      disabled={
                        tippingId !== null
                      }
                    >
                      {tippingId === item.id
                        ? "Sending..."
                        : "Tip"}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="ledger-layout">
        <div className="panel ledger-panel">
          <div className="notes-heading">
            <div>
              <h2>Tip history</h2>
              <p>
                Public BCP transfers
              </p>
            </div>
          </div>

          {history.length === 0 ? (
            <div className="empty-state compact">
              <h3>No tips yet</h3>
              <p>
                Community tips will appear here.
              </p>
            </div>
          ) : (
            <div className="history-list">
              {[...history]
                .reverse()
                .map((record, index) => (
                  <article
                    className="history-row"
                    key={`${record.timestamp.toString()}-${index}`}
                  >
                    <div>
                      <strong>
                        {record.amount.toString()} BCP
                      </strong>

                      <span>
                        {formatTipTime(
                          record.timestamp
                        )}
                      </span>
                    </div>

                    <p>
                      <code
                        title={record.from}
                      >
                        {shortPrincipal(
                          record.from
                        )}
                      </code>

                      <span>→</span>

                      <code
                        title={record.to}
                      >
                        {shortPrincipal(
                          record.to
                        )}
                      </code>
                    </p>
                  </article>
                ))}
            </div>
          )}
        </div>

        <div className="panel seal-panel">
          <h2>Bootcamp Points</h2>

          {metadata ? (
            <dl className="seal-stats token-metadata">
              <div>
                <dt>Name</dt>
                <dd>{metadata.name}</dd>
              </div>

              <div>
                <dt>Symbol</dt>
                <dd>{metadata.symbol}</dd>
              </div>

              <div>
                <dt>Decimals</dt>
                <dd>{metadata.decimals.toString()}</dd>
              </div>

              <div>
                <dt>Total supply</dt>
                <dd>
                  {metadata.totalSupply.toString()}{" "}
                  {metadata.symbol}
                </dd>
              </div>

              <div>
                <dt>Creator</dt>
                <dd>
                  <code title={metadata.creator}>
                    {shortPrincipal(metadata.creator)}
                  </code>
                </dd>
              </div>
            </dl>
          ) : (
            <p>Loading token metadata...</p>
          )}

          <h2 className="ledger-seal-title">
            Ledger seal
          </h2>

          {seal ? (
            <>
              <div className="seal-status">
                <span
                  className={
                    seal.consistent
                      ? "seal-icon good"
                      : "seal-icon bad"
                  }
                >
                  {seal.consistent
                    ? "✓"
                    : "!"}
                </span>

                <div>
                  <strong>
                    {seal.consistent
                      ? "Ledger consistent"
                      : "Ledger mismatch"}
                  </strong>

                  <p>
                    Supply invariant verification
                  </p>
                </div>
              </div>

              <dl className="seal-stats">
                <div>
                  <dt>Members</dt>
                  <dd>
                    {seal.members.toString()}
                  </dd>
                </div>

                <div>
                  <dt>Circulation</dt>
                  <dd>
                    {seal.circulation.toString()}{" "}
                    BCP
                  </dd>
                </div>

                <div>
                  <dt>Expected</dt>
                  <dd>
                    {seal.expected.toString()} BCP
                  </dd>
                </div>
              </dl>
            </>
          ) : (
            <p>Loading ledger...</p>
          )}
        </div>
      </section>

      <footer>
        Note DApp · Private Notes · Public Feed ·
        Bootcamp Points
      </footer>
    </main>
  );
}
