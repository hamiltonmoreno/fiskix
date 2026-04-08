import { expect, test } from "@playwright/test";

test.describe("Protected Routes", () => {
  const protectedRoutes = [
    "/alertas",
    "/admin",
    "/admin/scoring",
    "/admin/importar",
    "/perfil",
    "/mobile",
  ];

  for (const path of protectedRoutes) {
    test(`redirects anonymous user from ${path} to /login`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(/\/login$/);
    });
  }
});
