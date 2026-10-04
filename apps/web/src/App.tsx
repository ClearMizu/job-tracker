import { useCallback, useEffect, useState } from "react";
import { api } from "./api";
import { ApplicationsList } from "./applications/ApplicationsList";
import { signOut } from "./auth/auth";
import { SignInForm } from "./auth/SignInForm";

type Session =
  | { kind: "loading" }
  | { kind: "signedOut" }
  | { kind: "signedIn"; email: string }
  | { kind: "error" };

function useSession() {
  const [session, setSession] = useState<Session>({ kind: "loading" });
  const [reloadKey, setReloadKey] = useState(0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: reloadKey re-checks the session
  useEffect(() => {
    let current = true;
    (async () => {
      try {
        const res = await api.me.get();
        if (!current) return;
        if (res.data) setSession({ kind: "signedIn", email: res.data.email });
        else if (res.status === 401) setSession({ kind: "signedOut" });
        else setSession({ kind: "error" });
      } catch {
        if (current) setSession({ kind: "error" });
      }
    })();
    return () => {
      current = false;
    };
  }, [reloadKey]);

  const refresh = useCallback(() => {
    setSession({ kind: "loading" });
    setReloadKey((n) => n + 1);
  }, []);

  return { session, refresh, setSession };
}

export function App() {
  const { session, refresh, setSession } = useSession();

  const leave = async () => {
    await signOut();
    setSession({ kind: "signedOut" });
  };

  return (
    <main>
      <div className="session-bar">
        <h1>Job Tracker</h1>
        {session.kind === "signedIn" && (
          <p className="session-who">
            <span>{session.email}</span>
            <button type="button" className="link" onClick={leave}>
              Sign out
            </button>
          </p>
        )}
      </div>

      {session.kind === "loading" && (
        <p role="status" className="visually-hidden">
          Checking your session
        </p>
      )}
      {session.kind === "signedOut" && <SignInForm onSignedIn={refresh} />}
      {session.kind === "signedIn" && <ApplicationsList key={session.email} />}
      {session.kind === "error" && (
        <div className="state" role="alert">
          <p className="state-title">Couldn't reach the API.</p>
          <p className="state-hint">
            Check that the server is running, then try again.
          </p>
          <button type="button" className="action" onClick={refresh}>
            Try again
          </button>
        </div>
      )}
    </main>
  );
}
