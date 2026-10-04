import { apiOrigin } from "../api";

export type AuthResult = { ok: true } | { ok: false; message: string };

async function post(path: string, body: unknown): Promise<AuthResult> {
  try {
    const res = await fetch(`${apiOrigin}/api/auth${path}`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) return { ok: true };
    if (res.status === 429) {
      return { ok: false, message: "Too many tries. Give it a minute." };
    }
    if (res.status === 401) {
      return { ok: false, message: "Wrong email or password." };
    }
    const detail = (await res.json().catch(() => null)) as {
      message?: unknown;
    } | null;
    return {
      ok: false,
      message:
        typeof detail?.message === "string" && detail.message.length < 120
          ? detail.message
          : "That didn't go through.",
    };
  } catch {
    return { ok: false, message: "Couldn't reach the API." };
  }
}

export const signIn = (email: string, password: string) =>
  post("/sign-in/email", { email, password });

export const signUp = (name: string, email: string, password: string) =>
  post("/sign-up/email", { name, email, password });

export const signOut = () => post("/sign-out", {});
