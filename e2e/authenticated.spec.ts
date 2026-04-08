import { expect, test } from "@playwright/test";

const adminEmail = process.env.FISKIX_E2E_ADMIN_EMAIL;
const adminPassword = process.env.FISKIX_E2E_ADMIN_PASSWORD;
const fiscalEmail = process.env.FISKIX_E2E_FISCAL_EMAIL;
const fiscalPassword = process.env.FISKIX_E2E_FISCAL_PASSWORD;

async function login(page: import("@playwright/test").Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
}

test.describe("Authenticated Flows", () => {
  test("admin can sign in and access dashboard", async ({ page }) => {
    test.skip(!adminEmail || !adminPassword, "Missing FISKIX_E2E_ADMIN_EMAIL/PASSWORD");

    await login(page, adminEmail!, adminPassword!);
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  });

  test("fiscal is redirected to mobile area after sign in", async ({ page }) => {
    test.skip(!fiscalEmail || !fiscalPassword, "Missing FISKIX_E2E_FISCAL_EMAIL/PASSWORD");

    await login(page, fiscalEmail!, fiscalPassword!);
    await expect(page).toHaveURL(/\/mobile$/);
    await expect(page.getByText("ordem(s) para hoje")).toBeVisible();
  });
});
