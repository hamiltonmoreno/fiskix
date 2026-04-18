import { expect, test } from "@playwright/test";

test.describe("Auth Gate", () => {
  test.describe.configure({ timeout: 60000 });

  test("redirects anonymous user from root to /login", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/login(\?|$)/, { timeout: 60000 });
  });

  test("redirects anonymous user from /dashboard to /login", async ({ page }) => {
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/login(\?|$)/, { timeout: 60000 });
  });

  test("renders login form fields and submit action", async ({ page }) => {
    await page.goto("/login");

    await expect(page.getByRole("heading", { name: "Entrar" })).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
    await expect(page.getByRole("button", { name: "Entrar na plataforma" })).toBeVisible();
  });
});
