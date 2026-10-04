import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { ApplicationsList } from "./ApplicationsList";

const { get, patch, post, del } = vi.hoisted(() => ({
  get: vi.fn(),
  patch: vi.fn(),
  post: vi.fn(),
  del: vi.fn(),
}));

vi.mock("../api", () => ({
  api: {
    applications: Object.assign(
      (_params: { id: string }) => ({ patch, delete: del }),
      { get, post },
    ),
  },
}));

const item = (over: Partial<Record<string, unknown>> = {}) => ({
  id: "1",
  company: "Acme",
  role: "Engineer",
  url: "https://acme.test/jobs/1",
  status: "saved",
  notes: null,
  appliedAt: "2026-10-03T00:00:00.000Z",
  createdAt: "2026-10-03T00:00:00.000Z",
  updatedAt: "2026-10-03T00:00:00.000Z",
  ...over,
});

const ok = (items: unknown[], total = items.length) => ({
  data: { items, page: 1, pageSize: 20, total },
  error: null,
  status: 200,
});

beforeEach(() => {
  get.mockReset();
  patch.mockReset();
  post.mockReset();
  del.mockReset();
});

describe("ApplicationsList create and delete", () => {
  test("adding an application posts it and shows it", async () => {
    get.mockResolvedValueOnce(ok([]));
    render(<ApplicationsList />);
    await screen.findByText("No applications yet.");

    post.mockResolvedValue({ data: item(), error: null, status: 201 });
    get.mockResolvedValue(ok([item()]));
    fireEvent.change(screen.getByLabelText("Company"), {
      target: { value: "Acme" },
    });
    fireEvent.change(screen.getByLabelText("Role"), {
      target: { value: "Engineer" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    expect(await screen.findByText("Engineer")).toBeTruthy();
    expect(post).toHaveBeenCalledWith({ company: "Acme", role: "Engineer" });
  });

  test("a rejected add shows the problem", async () => {
    get.mockResolvedValue(ok([]));
    post.mockResolvedValue({ data: null, error: { status: 422 }, status: 422 });
    render(<ApplicationsList />);
    await screen.findByText("No applications yet.");

    fireEvent.change(screen.getByLabelText("Company"), {
      target: { value: "Acme" },
    });
    fireEvent.change(screen.getByLabelText("Role"), {
      target: { value: "Engineer" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    expect((await screen.findByRole("alert")).textContent).toContain(
      "Check the company",
    );
  });

  test("delete asks for confirmation, then removes the row", async () => {
    get.mockResolvedValue(ok([item()]));
    del.mockResolvedValue({ data: null, error: null, status: 204 });
    render(<ApplicationsList />);

    fireEvent.click(
      await screen.findByRole("button", { name: "Delete Acme, Engineer" }),
    );
    expect(del).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Confirm delete" }));

    await waitFor(() => expect(screen.queryByText("Acme")).toBeNull());
    expect(del).toHaveBeenCalled();
  });

  test("keeping the row cancels the delete", async () => {
    get.mockResolvedValue(ok([item()]));
    render(<ApplicationsList />);

    fireEvent.click(
      await screen.findByRole("button", { name: "Delete Acme, Engineer" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Keep" }));

    expect(del).not.toHaveBeenCalled();
    expect(screen.getByText("Acme")).toBeTruthy();
  });
});

describe("ApplicationsList", () => {
  test("shows a loading state, then the rows", async () => {
    get.mockResolvedValue(ok([item(), item({ id: "2", company: "Globex" })]));
    render(<ApplicationsList />);

    expect(screen.getByRole("status").textContent).toContain("Loading");
    expect(await screen.findByText("Globex")).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Acme" }).getAttribute("href"),
    ).toBe("https://acme.test/jobs/1");
    expect(screen.queryByRole("status")).toBeNull();
  });

  test("never links a non-http url", async () => {
    get.mockResolvedValue(ok([item({ url: "javascript:alert(1)" })]));
    render(<ApplicationsList />);

    await screen.findByText("Acme");
    expect(screen.queryByRole("link")).toBeNull();
  });

  test("shows the empty state", async () => {
    get.mockResolvedValue(ok([]));
    render(<ApplicationsList />);

    expect(await screen.findByText("No applications yet.")).toBeTruthy();
  });

  test("shows an error state and retries", async () => {
    get.mockRejectedValueOnce(new Error("network"));
    get.mockResolvedValueOnce(ok([item()]));
    render(<ApplicationsList />);

    expect(await screen.findByText("Couldn't reach the API.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Acme")).toBeTruthy();
  });

  test("tells a signed-out user apart from a network failure", async () => {
    get.mockResolvedValue({ data: null, error: { status: 401 }, status: 401 });
    render(<ApplicationsList />);

    expect(await screen.findByText("You're signed out.")).toBeTruthy();
  });

  test("filters by status through the query", async () => {
    get.mockResolvedValue(ok([item()]));
    render(<ApplicationsList />);
    await screen.findByText("Acme");

    get.mockResolvedValue(ok([]));
    fireEvent.click(screen.getByRole("button", { name: "interview" }));

    expect(await screen.findByText("Nothing marked interview.")).toBeTruthy();
    expect(get).toHaveBeenLastCalledWith({
      query: { status: "interview", page: 1 },
    });
  });

  test("changing status updates the row and calls the API", async () => {
    get.mockResolvedValue(ok([item()]));
    patch.mockResolvedValue({
      data: item({ status: "applied" }),
      error: null,
      status: 200,
    });
    render(<ApplicationsList />);

    const select = await screen.findByRole("combobox", {
      name: "Status for Acme, Engineer",
    });
    fireEvent.change(select, { target: { value: "applied" } });

    expect(patch).toHaveBeenCalledWith({ status: "applied" });
    await waitFor(() =>
      expect((select as HTMLSelectElement).value).toBe("applied"),
    );
  });

  test("a failed status change is reverted with a notice", async () => {
    get.mockResolvedValue(ok([item()]));
    patch.mockResolvedValue({
      data: null,
      error: { status: 500 },
      status: 500,
    });
    render(<ApplicationsList />);

    const select = (await screen.findByRole("combobox")) as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "offer" } });

    expect((await screen.findByRole("alert")).textContent).toContain(
      "Couldn't save",
    );
    expect(select.value).toBe("saved");
  });

  test("pages through results", async () => {
    get.mockResolvedValue({
      data: { items: [item()], page: 1, pageSize: 20, total: 45 },
      error: null,
      status: 200,
    });
    render(<ApplicationsList />);
    await screen.findByText("Page 1 of 3");

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await waitFor(() =>
      expect(get).toHaveBeenLastCalledWith({ query: { page: 2 } }),
    );
  });
});
