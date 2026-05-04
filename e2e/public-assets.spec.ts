import { expect, test } from "@playwright/test";

test.describe("Public Assets", () => {
  test("serves manifest with expected mobile scope", async ({ request }) => {
    const response = await request.get("/manifest.json");
    expect(response.ok()).toBeTruthy();

    const manifest = await response.json();
    expect(manifest.name).toBe("Fiskix Fiscal");
    expect(manifest.start_url).toBe("/mobile");
    expect(manifest.scope).toBe("/mobile");
    expect(Array.isArray(manifest.icons)).toBeTruthy();
  });

  test("serves service worker file", async ({ request }) => {
    const response = await request.get("/sw.js");
    expect(response.ok()).toBeTruthy();

    const sw = await response.text();
    expect(sw).toContain("self.addEventListener");
  });
});
