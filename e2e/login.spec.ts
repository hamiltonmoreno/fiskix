import { expect, test } from "@playwright/test";

test.describe("Login Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
  });

  test("contains required email/password fields", async ({ page }) => {
    const email = page.getByLabel("Email");
    const password = page.getByLabel("Password");

    await expect(email).toHaveAttribute("type", "email");
    await expect(email).toHaveAttribute("required", "");
    await expect(password).toHaveAttribute("type", "password");
    await expect(password).toHaveAttribute("required", "");
  });

  test("shows brand and confidentiality footer", async ({ page }) => {
    await expect(page.getByText("Fiskix", { exact: true }).first()).toBeVisible();
    await expect(page.getByText(/CONFIDENCIAL/i)).toBeVisible();
  });
});
