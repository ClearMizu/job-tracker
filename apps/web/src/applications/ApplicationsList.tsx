import { type FormEvent, useLayoutEffect, useRef, useState } from "react";
import { playLoadIn, playStatusChange } from "../motion";
import "./applications.css";
import {
  type Application,
  STATUSES,
  type Status,
  useApplications,
} from "./useApplications";

const dateFormat = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "2-digit",
});

function isHttpUrl(value: string | null): value is string {
  if (!value) return false;
  try {
    const { protocol } = new URL(value);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

function ApplicationRow({
  application,
  onStatusChange,
  onDelete,
}: {
  application: Application;
  onStatusChange: (id: string, status: Status) => void;
  onDelete: (id: string) => void;
}) {
  const rowRef = useRef<HTMLLIElement>(null);
  const stampRef = useRef<HTMLSpanElement>(null);
  const previous = useRef(application.status);
  const [confirming, setConfirming] = useState(false);

  useLayoutEffect(() => {
    if (previous.current === application.status) return;
    previous.current = application.status;
    if (!rowRef.current || !stampRef.current) return;
    return playStatusChange(stampRef.current, rowRef.current);
  }, [application.status]);

  const { company, role, url, appliedAt, status } = application;

  return (
    <li className="row" data-row ref={rowRef}>
      <div className="row-main">
        <span className="company">
          {isHttpUrl(url) ? (
            <a href={url} target="_blank" rel="noreferrer noopener">
              {company}
            </a>
          ) : (
            company
          )}
          <svg
            className="underline"
            viewBox="0 0 120 8"
            preserveAspectRatio="none"
            aria-hidden="true"
            focusable="false"
          >
            <path
              data-underline
              d="M2 5 C 18 2, 34 7, 52 4 S 88 6, 118 3"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </span>
        <span className="role">{role}</span>
      </div>
      <div className="row-date">
        <span className="visually-hidden">Applied: </span>
        {appliedAt ? dateFormat.format(new Date(appliedAt)) : "—"}
      </div>
      <div className="status-cell">
        <span
          className="stamp"
          data-status={status}
          ref={stampRef}
          aria-hidden="true"
        >
          {status}
        </span>
        <select
          className="status-select"
          aria-label={`Status for ${company}, ${role}`}
          value={status}
          onChange={(event) =>
            onStatusChange(application.id, event.target.value as Status)
          }
        >
          {STATUSES.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>
      <div className="row-actions">
        {confirming ? (
          <>
            <button
              type="button"
              className="link link-bad"
              onClick={() => onDelete(application.id)}
            >
              Confirm delete
            </button>
            <button
              type="button"
              className="link"
              onClick={() => setConfirming(false)}
            >
              Keep
            </button>
          </>
        ) : (
          <button
            type="button"
            className="link"
            aria-label={`Delete ${company}, ${role}`}
            onClick={() => setConfirming(true)}
          >
            Delete
          </button>
        )}
      </div>
    </li>
  );
}

function AddForm({
  onCreate,
}: {
  onCreate: (input: {
    company: string;
    role: string;
    url?: string;
  }) => Promise<string | null>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const url = String(data.get("url") ?? "").trim();

    setPending(true);
    setError(null);
    const problem = await onCreate({
      company: String(data.get("company") ?? "").trim(),
      role: String(data.get("role") ?? "").trim(),
      ...(url ? { url } : {}),
    });
    setPending(false);

    if (problem) setError(problem);
    else form.reset();
  };

  return (
    <form className="add-form" onSubmit={submit}>
      <div className="field">
        <label htmlFor="add-company">Company</label>
        <input
          id="add-company"
          name="company"
          required
          maxLength={200}
          autoComplete="off"
        />
      </div>
      <div className="field">
        <label htmlFor="add-role">Role</label>
        <input
          id="add-role"
          name="role"
          required
          maxLength={200}
          autoComplete="off"
        />
      </div>
      <div className="field">
        <label htmlFor="add-url">Link (optional)</label>
        <input
          id="add-url"
          name="url"
          type="url"
          maxLength={2048}
          autoComplete="off"
          pattern="https?://.+"
        />
      </div>
      <button type="submit" className="cta" disabled={pending}>
        {pending ? "Adding…" : "Add"}
      </button>
      {error && (
        <p className="notice notice-bad add-error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}

function Skeleton() {
  return (
    <ul className="rows" aria-hidden="true">
      {[0, 1, 2, 3].map((n) => (
        <li className="row row-skeleton" key={n}>
          <span className="bar bar-wide" />
          <span className="bar bar-narrow" />
        </li>
      ))}
    </ul>
  );
}

export function ApplicationsList() {
  const [filter, setFilter] = useState<Status | null>(null);
  const [page, setPage] = useState(1);
  const { state, updateError, retry, changeStatus, create, remove } =
    useApplications(filter, page);
  const listRef = useRef<HTMLUListElement>(null);
  const played = useRef(false);

  const hasRows = state.kind === "ready" && state.items.length > 0;
  useLayoutEffect(() => {
    if (!hasRows || played.current || !listRef.current) return;
    played.current = true;
    const list = listRef.current;
    return playLoadIn(
      Array.from(list.querySelectorAll<HTMLElement>("[data-row]")),
      Array.from(list.querySelectorAll<SVGPathElement>("[data-underline]")),
    );
  }, [hasRows]);

  const selectFilter = (next: Status | null) => {
    setFilter(next);
    setPage(1);
  };

  const createAndShow = async (input: {
    company: string;
    role: string;
    url?: string;
  }) => {
    const problem = await create(input);
    if (!problem) selectFilter(null);
    return problem;
  };

  const pageCount =
    state.kind === "ready"
      ? Math.max(1, Math.ceil(state.total / state.pageSize))
      : 1;

  return (
    <section className="applications" aria-labelledby="applications-title">
      <header className="applications-head">
        <h2 id="applications-title">Applications</h2>
        <p className="count" aria-live="polite">
          {state.kind === "ready" ? `${state.total} total` : ""}
        </p>
      </header>

      <AddForm onCreate={createAndShow} />

      <fieldset className="filters">
        <legend className="visually-hidden">Filter by status</legend>
        {[null, ...STATUSES].map((option) => (
          <button
            type="button"
            key={option ?? "all"}
            className="filter"
            aria-pressed={filter === option}
            onClick={() => selectFilter(option)}
          >
            {option ?? "all"}
          </button>
        ))}
      </fieldset>

      {updateError && (
        <p className="notice notice-bad" role="alert">
          {updateError}
        </p>
      )}

      <div className="columns" aria-hidden="true">
        <span>Company / role</span>
        <span>Applied</span>
        <span>Status</span>
      </div>

      {state.kind === "loading" && (
        <div role="status">
          <span className="visually-hidden">Loading applications</span>
          <Skeleton />
        </div>
      )}

      {state.kind === "error" && (
        <div className="state" role="alert">
          <p className="state-title">
            {state.signedOut ? "You're signed out." : "Couldn't reach the API."}
          </p>
          <p className="state-hint">
            {state.signedOut
              ? "Sign in, then try again."
              : "Check that the server is running, then try again."}
          </p>
          <button type="button" className="action" onClick={retry}>
            Try again
          </button>
        </div>
      )}

      {state.kind === "ready" && state.items.length === 0 && (
        <div className="state">
          <p className="state-title">
            {filter ? `Nothing marked ${filter}.` : "No applications yet."}
          </p>
          <p className="state-hint">
            {filter
              ? "Try another status."
              : "A blank page. The first one is the hardest."}
          </p>
        </div>
      )}

      {hasRows && (
        <>
          <ul className="rows" ref={listRef}>
            {state.items.map((application) => (
              <ApplicationRow
                key={application.id}
                application={application}
                onStatusChange={changeStatus}
                onDelete={remove}
              />
            ))}
          </ul>
          {pageCount > 1 && (
            <nav className="pager" aria-label="Pages">
              <button
                type="button"
                className="action"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                Previous
              </button>
              <span>
                Page {page} of {pageCount}
              </span>
              <button
                type="button"
                className="action"
                disabled={page >= pageCount}
                onClick={() => setPage(page + 1)}
              >
                Next
              </button>
            </nav>
          )}
        </>
      )}
    </section>
  );
}
