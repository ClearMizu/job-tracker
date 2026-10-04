import { expect, test } from "@playwright/test";
import { addApplication, logIn, logOut, signUp, uniqueEmail } from "./helpers";

// The API rate limits sign-up and sign-in per client (5 a minute), so the suite
// keeps the number of account creations and logins low rather than one per test.

test("sign up, log out, get refused with a wrong password, log back in", async ({
  page,
}) => {
  const email = uniqueEmail();

  await signUp(page, email);
  await expect(page.getByText(email)).toBeVisible();
  await expect(page.getByText("No applications yet.")).toBeVisible();

  await logOut(page);
  await page.reload();
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();

  await logIn(page, email, "not-the-password-1");
  await expect(page.getByRole("alert")).toHaveText("Wrong email or password.");
  await expect(
    page.getByRole("heading", { name: "Applications" }),
  ).toBeHidden();

  await logIn(page, email);
  await expect(
    page.getByRole("heading", { name: "Applications" }),
  ).toBeVisible();
  await expect(page.getByText(email)).toBeVisible();
});

test("create an application, change its status, then delete it", async ({
  page,
}) => {
  await signUp(page, uniqueEmail());

  await addApplication(page, "Acme", "Staff Engineer");
  const status = page.getByRole("combobox", {
    name: "Status for Acme, Staff Engineer",
  });
  await expect(status).toHaveValue("saved");

  await status.selectOption("interview");
  await expect(status).toHaveValue("interview");

  // The change must be saved on the server, not just shown.
  await page.reload();
  await expect(status).toHaveValue("interview");

  await page
    .getByRole("button", { name: "Delete Acme, Staff Engineer" })
    .click();
  await page.getByRole("button", { name: "Confirm delete" }).click();
  await expect(page.getByText("Acme", { exact: true })).toBeHidden();
  await expect(page.getByText("No applications yet.")).toBeVisible();

  await logOut(page);
});
