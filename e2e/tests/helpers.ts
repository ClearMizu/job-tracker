import { expect, type Page } from "@playwright/test";

export const PASSWORD = "correct-horse-battery-1";

// Each test gets its own account so tests stay independent and order-free.
export function uniqueEmail(): string {
  return `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

export async function signUp(page: Page, email: string) {
  await page.goto("/");
  await page.getByRole("button", { name: "Create an account" }).click();
  await page.getByLabel("Name").fill("E2E Tester");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(
    page.getByRole("heading", { name: "Applications" }),
  ).toBeVisible();
}

export async function logIn(page: Page, email: string, password = PASSWORD) {
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

export async function logOut(page: Page) {
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
}

export async function addApplication(
  page: Page,
  company: string,
  role: string,
) {
  await page.getByLabel("Company").fill(company);
  await page.getByLabel("Role", { exact: true }).fill(role);
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByText(company, { exact: true })).toBeVisible();
}
