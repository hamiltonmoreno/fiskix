/**
 * Tests for safeRedirect (src/lib/auth/safe-redirect.ts).
 *
 * The function gates the `next` query parameter accepted by the OAuth
 * callback route. Any regression here is a critical open-redirect bug.
 */
import { describe, it, expect } from "vitest";
import { safeRedirect } from "@/lib/auth/safe-redirect";

const FALLBACK = "/dashboard";

describe("safeRedirect", () => {
  describe("allows safe same-origin paths", () => {
    it.each([
      "/dashboard",
      "/admin/utilizadores",
      "/perfil",
      "/balanco",
      "/relatorios?tab=executivo",
      "/dashboard#alertas",
      "/a",
    ])("returns %s unchanged", (input) => {
      expect(safeRedirect(input)).toBe(input);
    });
  });

  describe("blocks protocol-relative URLs", () => {
    it.each([
      "//evil.com",
      "//evil.com/dashboard",
      "//attacker.example.com/path?next=/dashboard",
      "///evil.com",
    ])("rewrites %s to fallback", (input) => {
      expect(safeRedirect(input)).toBe(FALLBACK);
    });
  });

  describe("blocks backslash-tricked URLs", () => {
    // Some browsers normalise `\` to `/` before resolution, so `/\evil.com`
    // can become `//evil.com` and trigger an open redirect.
    it.each([
      "/\\evil.com",
      "/\\\\evil.com",
      "/\\example.com/path",
    ])("rewrites %s to fallback", (input) => {
      expect(safeRedirect(input)).toBe(FALLBACK);
    });
  });

  describe("blocks absolute URLs and non-path schemes", () => {
    it.each([
      "http://evil.com",
      "https://evil.com/dashboard",
      "javascript:alert(1)",
      "data:text/html,<script>alert(1)</script>",
      "ftp://evil.com",
      "vbscript:msgbox(1)",
    ])("rewrites %s to fallback", (input) => {
      expect(safeRedirect(input)).toBe(FALLBACK);
    });
  });

  describe("blocks malformed or relative inputs", () => {
    it.each([
      "",
      " ",
      "dashboard",
      "../admin",
      "./perfil",
      "?next=/dashboard",
      "#fragment",
    ])("rewrites %s to fallback", (input) => {
      expect(safeRedirect(input)).toBe(FALLBACK);
    });
  });

  describe("hardening against non-string inputs", () => {
    it("returns fallback for non-string values", () => {
      // The route handler always passes a string, but defence in depth costs nothing.
      expect(safeRedirect(undefined as unknown as string)).toBe(FALLBACK);
      expect(safeRedirect(null as unknown as string)).toBe(FALLBACK);
      expect(safeRedirect(123 as unknown as string)).toBe(FALLBACK);
    });
  });
});
