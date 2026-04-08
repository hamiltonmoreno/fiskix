import { expect, test as base, type Page } from "@playwright/test";

type Role = "admin" | "fiscal";

type AuthFixtures = {
  adminPage: Page;
  fiscalPage: Page;
};

const adminEmail = process.env.FISKIX_E2E_ADMIN_EMAIL;
const adminPassword = process.env.FISKIX_E2E_ADMIN_PASSWORD;
const fiscalEmail = process.env.FISKIX_E2E_FISCAL_EMAIL;
const fiscalPassword = process.env.FISKIX_E2E_FISCAL_PASSWORD;

export const hasAdminCreds = Boolean(adminEmail && adminPassword);
export const hasFiscalCreds = Boolean(fiscalEmail && fiscalPassword);

function getCredentials(role: Role) {
  if (role === "admin") {
    return {
      email: adminEmail,
      password: adminPassword,
      expectedLanding: /\/dashboard$/,
      missingMessage: "Missing FISKIX_E2E_ADMIN_EMAIL/PASSWORD",
    };
  }

  return {
    email: fiscalEmail,
    password: fiscalPassword,
    expectedLanding: /\/mobile$/,
    missingMessage: "Missing FISKIX_E2E_FISCAL_EMAIL/PASSWORD",
  };
}

async function loginByUi(page: Page, role: Role) {
  const credentials = getCredentials(role);
  if (!credentials.email || !credentials.password) {
    throw new Error(credentials.missingMessage);
  }

  await page.goto("/login");
  await page.getByLabel("Email").fill(credentials.email);
  await page.getByLabel("Password").fill(credentials.password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(credentials.expectedLanding);
}

export const adminTest = base.extend<AuthFixtures>({
  adminPage: async ({ browser, baseURL }, use) => {
    const context = await browser.newContext({ baseURL });
    const page = await context.newPage();
    await loginByUi(page, "admin");
    await use(page);
    await context.close();
  },
  fiscalPage: async ({ page }, use) => {
    await use(page);
  },
});

export const fiscalTest = base.extend<AuthFixtures>({
  adminPage: async ({ page }, use) => {
    await use(page);
  },
  fiscalPage: async ({ browser, baseURL }, use) => {
    const context = await browser.newContext({ baseURL });
    const page = await context.newPage();
    await loginByUi(page, "fiscal");
    await use(page);
    await context.close();
  },
});

export { expect };
