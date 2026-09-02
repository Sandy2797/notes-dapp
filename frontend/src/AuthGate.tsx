import { FormEvent, ReactNode, useState } from "react";
import { useMemphis } from "@thebes/sdk";

type AuthGateProps = {
  children: ReactNode;
};

export default function AuthGate({ children }: AuthGateProps) {
  const { session, busy, error, signIn } = useMemphis();
  const [name, setName] = useState("");

  if (session) {
    return <>{children}</>;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    const value = name.trim();

    if (!value || busy) {
      return;
    }

    await signIn(value);
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="auth-logo">N</div>

        <div className="auth-heading">
          <span className="auth-badge">THEBES · MEMPHIS</span>

          <h1>Welcome to Notes</h1>

          <p>
            Sign in securely with a passkey to access your private notes.
          </p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label htmlFor="memphis-name">
            Memphis name
          </label>

          <div className="auth-input-wrap">
            <input
              id="memphis-name"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="yourname.thebes"
              autoComplete="username webauthn"
              spellCheck={false}
              disabled={busy}
            />
          </div>

          <button
            className="auth-button"
            type="submit"
            disabled={busy || !name.trim()}
          >
            {busy ? (
              <>
                <span className="auth-spinner" />
                Connecting to Memphis...
              </>
            ) : (
              <>
                <span className="auth-key">◆</span>
                Continue with passkey
              </>
            )}
          </button>

          {error && (
            <div className="auth-error" role="alert">
              <strong>Sign-in failed</strong>
              <span>{error}</span>
            </div>
          )}
        </form>

        <div className="auth-security">
          <span className="auth-security-icon">✓</span>

          <div>
            <strong>Passwordless authentication</strong>
            <p>Your passkey stays protected by your device.</p>
          </div>
        </div>

        <p className="auth-footer">
          Powered by <strong>Memphis</strong> on Thebes
        </p>
      </section>
    </main>
  );
}
