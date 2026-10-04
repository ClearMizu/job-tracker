import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";
import { App } from "./App";

const { me, signOut } = vi.hoisted(() => ({ me: vi.fn(), signOut: vi.fn() }));

vi.mock("./api", () => ({
  apiOrigin: "http://localhost:3000",
  api: {
    me: { get: me },
    applications: Object.assign(() => ({ patch: vi.fn() }), {
      get: vi.fn(() =>
        Promise.resolve({
          data: { items: [], page: 1, pageSize: 20, total: 0 },
          error: null,
          status: 200,
        }),
      ),
    }),
  },
}));

vi.mock("./auth/auth", () => ({
  signOut,
  signIn: vi.fn(),
  signUp: vi.fn(),
}));

beforeEach(() => {
  me.mockReset();
  signOut.mockReset();
});

test("signed in: shows the heading, the user and the list", async () => {
  me.mockResolvedValue({
    data: { id: "1", email: "ada@example.com", name: "Ada" },
    error: null,
    status: 200,
  });
  render(<App />);

  expect(screen.getByRole("heading", { name: "Job Tracker" })).toBeTruthy();
  expect(await screen.findByText("No applications yet.")).toBeTruthy();
  expect(screen.getByText("ada@example.com")).toBeTruthy();
});

test("signed out: shows the sign-in form instead of the list", async () => {
  me.mockResolvedValue({ data: null, error: { status: 401 }, status: 401 });
  render(<App />);

  expect(await screen.findByRole("button", { name: "Sign in" })).toBeTruthy();
  expect(screen.queryByText("No applications yet.")).toBeNull();
});

test("signing out returns to the sign-in form", async () => {
  me.mockResolvedValue({
    data: { id: "1", email: "ada@example.com", name: "Ada" },
    error: null,
    status: 200,
  });
  signOut.mockResolvedValue({ ok: true });
  render(<App />);

  fireEvent.click(await screen.findByRole("button", { name: "Sign out" }));

  await waitFor(() => expect(signOut).toHaveBeenCalled());
  expect(await screen.findByRole("button", { name: "Sign in" })).toBeTruthy();
});

test("an unreachable API offers a retry", async () => {
  me.mockRejectedValueOnce(new Error("network"));
  me.mockResolvedValueOnce({
    data: { id: "1", email: "ada@example.com", name: "Ada" },
    error: null,
    status: 200,
  });
  render(<App />);

  fireEvent.click(await screen.findByRole("button", { name: "Try again" }));
  expect(await screen.findByText("ada@example.com")).toBeTruthy();
});
