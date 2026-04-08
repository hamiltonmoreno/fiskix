import {
  adminTest,
  expect,
  fiscalTest,
  hasAdminCreds,
  hasFiscalCreds,
} from "./fixtures/auth";

adminTest.describe("Authenticated Flows - Admin", () => {
  adminTest.skip(!hasAdminCreds, "Missing FISKIX_E2E_ADMIN_EMAIL/PASSWORD");

  adminTest("admin can sign in and access dashboard", async ({ adminPage }) => {
    await expect(adminPage).toHaveURL(/\/dashboard$/);
    await expect(adminPage.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  });

  adminTest("admin cannot access /mobile", async ({ adminPage }) => {
    await adminPage.goto("/mobile");
    await expect(adminPage).toHaveURL(/\/dashboard$/);
  });
});

fiscalTest.describe("Authenticated Flows - Fiscal", () => {
  fiscalTest.skip(!hasFiscalCreds, "Missing FISKIX_E2E_FISCAL_EMAIL/PASSWORD");

  fiscalTest("fiscal is redirected to mobile area after sign in", async ({ fiscalPage }) => {
    await expect(fiscalPage).toHaveURL(/\/mobile$/);
    await expect(fiscalPage.getByText("ordem(s) para hoje")).toBeVisible();
  });

  fiscalTest("fiscal is redirected from /dashboard back to /mobile", async ({ fiscalPage }) => {
    await fiscalPage.goto("/dashboard");
    await expect(fiscalPage).toHaveURL(/\/mobile$/);
  });
});
