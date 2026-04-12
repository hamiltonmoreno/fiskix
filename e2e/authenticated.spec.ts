import {
  adminTest,
  expect,
  fiscalTest,
  hasAdminCreds,
  hasFiscalCreds,
} from "./fixtures/auth";

adminTest.describe("Authenticated Flows - Admin", () => {
  adminTest.skip(!hasAdminCreds, "Missing FISKIX_E2E_ADMIN_EMAIL/PASSWORD");

  adminTest("admin can sign in and land on dashboard", async ({ adminPage }) => {
    await expect(adminPage).toHaveURL(/\/dashboard$/);
    await expect(adminPage.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  });

  adminTest("dashboard shows 4 KPI cards", async ({ adminPage }) => {
    await expect(adminPage.getByText("Perda Estimada")).toBeVisible();
    await expect(adminPage.getByText("Risco Crítico")).toBeVisible();
    await expect(adminPage.getByText("Ordens Pendentes")).toBeVisible();
    await expect(adminPage.getByText("Receita Recuperada")).toBeVisible();
  });

  adminTest("sidebar shows navigation links", async ({ adminPage }) => {
    await expect(adminPage.getByRole("link", { name: "Dashboard" })).toBeVisible();
    await expect(adminPage.getByRole("link", { name: "Alertas" })).toBeVisible();
    await expect(adminPage.getByRole("link", { name: "Relatórios" })).toBeVisible();
  });

  adminTest("admin can navigate to /alertas", async ({ adminPage }) => {
    await adminPage.getByRole("link", { name: "Alertas" }).first().click();
    await expect(adminPage).toHaveURL(/\/alertas$/);
    await expect(adminPage.getByRole("heading", { name: "Alertas" })).toBeVisible();
  });

  adminTest("admin can navigate to /relatorios", async ({ adminPage }) => {
    await adminPage.getByRole("link", { name: "Relatórios" }).first().click();
    await expect(adminPage).toHaveURL(/\/relatorios$/);
  });

  adminTest("admin can navigate to /admin/scoring", async ({ adminPage }) => {
    await adminPage.getByRole("link", { name: "Motor de Scoring" }).first().click();
    await expect(adminPage).toHaveURL(/\/admin\/scoring$/);
  });

  adminTest("admin cannot access /mobile", async ({ adminPage }) => {
    await adminPage.goto("/mobile");
    await expect(adminPage).toHaveURL(/\/dashboard$/);
  });
});

fiscalTest.describe("Authenticated Flows - Fiscal", () => {
  fiscalTest.skip(!hasFiscalCreds, "Missing FISKIX_E2E_FISCAL_EMAIL/PASSWORD");

  fiscalTest("fiscal is redirected to /mobile after sign in", async ({ fiscalPage }) => {
    await expect(fiscalPage).toHaveURL(/\/mobile$/);
    await expect(fiscalPage.getByText("ordem(s) para hoje")).toBeVisible();
  });

  fiscalTest("roteiro shows order count", async ({ fiscalPage }) => {
    await expect(fiscalPage.getByText(/\d+ ordem\(s\) para hoje/)).toBeVisible();
  });

  fiscalTest("fiscal is redirected from /dashboard to /mobile", async ({ fiscalPage }) => {
    await fiscalPage.goto("/dashboard");
    await expect(fiscalPage).toHaveURL(/\/mobile$/);
  });

  fiscalTest("fiscal is redirected from /alertas to /mobile", async ({ fiscalPage }) => {
    await fiscalPage.goto("/alertas");
    await expect(fiscalPage).toHaveURL(/\/mobile$/);
  });

  fiscalTest("fiscal is redirected from /admin to /mobile", async ({ fiscalPage }) => {
    await fiscalPage.goto("/admin");
    await expect(fiscalPage).toHaveURL(/\/mobile$/);
  });
});
