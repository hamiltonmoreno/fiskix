import { expect, test } from "@playwright/test";

test.describe("Auth Gate", () => {
  test("redirects anonymous user from root to /login", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login$/);
  });

  test("redirects anonymous user from /dashboard to /login", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login$/);
  });

  test("renders login form fields and submit action", async ({ page }) => {
    await page.goto("/login");

    await expect(page.getByRole("heading", { name: "Entrar na plataforma" })).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
    await expect(page.getByRole("button", { name: "Entrar" })).toBeVisible();
  });
});
