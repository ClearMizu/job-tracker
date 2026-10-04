import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../api";

export const STATUSES = [
  "saved",
  "applied",
  "interview",
  "offer",
  "rejected",
] as const;
export type Status = (typeof STATUSES)[number];

export type Application = {
  id: string;
  company: string;
  role: string;
  url: string | null;
  status: Status;
  notes: string | null;
  appliedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ListState =
  | { kind: "loading" }
  | { kind: "error"; signedOut: boolean }
  | {
      kind: "ready";
      items: Application[];
      total: number;
      page: number;
      pageSize: number;
    };

export function useApplications(status: Status | null, page: number) {
  const [state, setState] = useState<ListState>({ kind: "loading" });
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const latest = useRef(0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: reloadKey re-runs the fetch on retry
  useEffect(() => {
    const request = ++latest.current;
    setState({ kind: "loading" });
    setUpdateError(null);

    (async () => {
      try {
        const res = await api.applications.get({
          query: { ...(status ? { status } : {}), page },
        });
        if (request !== latest.current) return;
        if (res.error || !res.data) {
          setState({ kind: "error", signedOut: res.status === 401 });
          return;
        }
        setState({ kind: "ready", ...res.data });
      } catch {
        if (request === latest.current) {
          setState({ kind: "error", signedOut: false });
        }
      }
    })();
  }, [status, page, reloadKey]);

  const retry = useCallback(() => setReloadKey((n) => n + 1), []);

  const changeStatus = useCallback(async (id: string, next: Status) => {
    let previous: Status | undefined;
    const patchItem = (apply: (item: Application) => Application) =>
      setState((current) =>
        current.kind === "ready"
          ? {
              ...current,
              items: current.items.map((item) =>
                item.id === id ? apply(item) : item,
              ),
            }
          : current,
      );

    setUpdateError(null);
    patchItem((item) => {
      previous = item.status;
      return { ...item, status: next };
    });

    try {
      const res = await api.applications({ id }).patch({ status: next });
      if (res.error || !res.data) throw new Error("update failed");
      const saved = res.data;
      patchItem((item) => ({ ...item, ...saved }));
    } catch {
      const revertTo = previous;
      if (revertTo) patchItem((item) => ({ ...item, status: revertTo }));
      setUpdateError("Couldn't save that change. Status put back.");
    }
  }, []);

  const create = useCallback(
    async (input: { company: string; role: string; url?: string }) => {
      try {
        const res = await api.applications.post(input);
        if (res.error || !res.data) {
          return res.status === 422
            ? "Check the company, role and link (http or https only)."
            : "Couldn't save that one.";
        }
        setReloadKey((n) => n + 1);
        return null;
      } catch {
        return "Couldn't reach the API.";
      }
    },
    [],
  );

  const remove = useCallback(async (id: string) => {
    setUpdateError(null);
    try {
      const res = await api.applications({ id }).delete();
      if (res.error) throw new Error("delete failed");
      setState((current) =>
        current.kind === "ready"
          ? {
              ...current,
              total: Math.max(0, current.total - 1),
              items: current.items.filter((item) => item.id !== id),
            }
          : current,
      );
    } catch {
      setUpdateError("Couldn't delete that. It's still here.");
    }
  }, []);

  return { state, updateError, retry, changeStatus, create, remove };
}
