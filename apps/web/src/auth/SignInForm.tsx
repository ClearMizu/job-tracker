import { type FormEvent, useId, useState } from "react";
import { signIn, signUp } from "./auth";
import "./auth.css";

type Mode = "sign-in" | "sign-up";

export function SignInForm({ onSignedIn }: { onSignedIn: () => void }) {
  const [mode, setMode] = useState<Mode>("sign-in");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const id = useId();
  const creating = mode === "sign-up";

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const name = String(form.get("name") ?? "").trim();

    setPending(true);
    setError(null);
    const result = creating
      ? await signUp(name, email, password)
      : await signIn(email, password);
    setPending(false);

    if (result.ok) onSignedIn();
    else setError(result.message);
  };

  return (
    <section className="auth" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`}>{creating ? "New notebook" : "Sign in"}</h2>
      <p className="auth-hint">
        {creating
          ? "An email and a password. That's the whole form."
          : "Your applications are where you left them."}
      </p>

      <form className="auth-form" onSubmit={submit}>
        {creating && (
          <div className="field">
            <label htmlFor={`${id}-name`}>Name</label>
            <input
              id={`${id}-name`}
              name="name"
              autoComplete="name"
              required
              maxLength={100}
            />
          </div>
        )}
        <div className="field">
          <label htmlFor={`${id}-email`}>Email</label>
          <input
            id={`${id}-email`}
            name="email"
            type="email"
            autoComplete="email"
            required
            maxLength={254}
          />
        </div>
        <div className="field">
          <label htmlFor={`${id}-password`}>Password</label>
          <input
            id={`${id}-password`}
            name="password"
            type="password"
            autoComplete={creating ? "new-password" : "current-password"}
            required
            minLength={8}
            maxLength={128}
          />
        </div>

        {error && (
          <p className="notice notice-bad" role="alert">
            {error}
          </p>
        )}

        <div className="auth-actions">
          <button type="submit" className="cta" disabled={pending}>
            {pending ? "Working…" : creating ? "Create account" : "Sign in"}
          </button>
          <button
            type="button"
            className="link"
            onClick={() => {
              setMode(creating ? "sign-in" : "sign-up");
              setError(null);
            }}
          >
            {creating ? "I have an account" : "Create an account"}
          </button>
        </div>
      </form>
    </section>
  );
}
