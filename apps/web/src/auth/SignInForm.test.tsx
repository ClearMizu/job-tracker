import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { SignInForm } from "./SignInForm";

const { signIn, signUp } = vi.hoisted(() => ({
  signIn: vi.fn(),
  signUp: vi.fn(),
}));

vi.mock("./auth", () => ({ signIn, signUp, signOut: vi.fn() }));

beforeEach(() => {
  signIn.mockReset();
  signUp.mockReset();
});

function fill(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

describe("SignInForm", () => {
  test("signs in and reports success", async () => {
    signIn.mockResolvedValue({ ok: true });
    const onSignedIn = vi.fn();
    render(<SignInForm onSignedIn={onSignedIn} />);

    fill("Email", "ada@example.com");
    fill("Password", "correct-horse-1");
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => expect(onSignedIn).toHaveBeenCalled());
    expect(signIn).toHaveBeenCalledWith("ada@example.com", "correct-horse-1");
  });

  test("shows the failure and stays on the form", async () => {
    signIn.mockResolvedValue({
      ok: false,
      message: "Wrong email or password.",
    });
    const onSignedIn = vi.fn();
    render(<SignInForm onSignedIn={onSignedIn} />);

    fill("Email", "ada@example.com");
    fill("Password", "wrong-password-1");
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect((await screen.findByRole("alert")).textContent).toBe(
      "Wrong email or password.",
    );
    expect(onSignedIn).not.toHaveBeenCalled();
  });

  test("switches to account creation and asks for a name", async () => {
    signUp.mockResolvedValue({ ok: true });
    const onSignedIn = vi.fn();
    render(<SignInForm onSignedIn={onSignedIn} />);

    fireEvent.click(screen.getByRole("button", { name: "Create an account" }));
    fill("Name", "Ada");
    fill("Email", "ada@example.com");
    fill("Password", "correct-horse-1");
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    await waitFor(() => expect(onSignedIn).toHaveBeenCalled());
    expect(signUp).toHaveBeenCalledWith(
      "Ada",
      "ada@example.com",
      "correct-horse-1",
    );
  });
});
