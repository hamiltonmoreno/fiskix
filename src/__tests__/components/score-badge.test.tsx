import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ScoreBadge } from "@/components/ui/score-badge";

describe("ScoreBadge", () => {
  it("mostra CRÍTICO e classe vermelha para score >= 75", () => {
    render(<ScoreBadge score={91} />);
    expect(screen.getByText("CRÍTICO")).toBeInTheDocument();
    const badge = screen.getByText("CRÍTICO").closest("span")!;
    expect(badge.className).toContain("red");
  });

  it("mostra MÉDIO e classe amarela para score entre 50 e 74", () => {
    render(<ScoreBadge score={68} />);
    expect(screen.getByText("MÉDIO")).toBeInTheDocument();
    const badge = screen.getByText("MÉDIO").closest("span")!;
    expect(badge.className).toContain("amber");
  });

  it("mostra o número do score quando showScore=true", () => {
    render(<ScoreBadge score={91} showScore />);
    expect(screen.getByText("91")).toBeInTheDocument();
    expect(screen.getByText("CRÍTICO")).toBeInTheDocument();
  });
});
