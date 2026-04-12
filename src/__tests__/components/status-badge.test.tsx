import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusBadge } from "@/components/ui/status-badge";

describe("StatusBadge", () => {
  it("renderiza label correcto para Pendente", () => {
    render(<StatusBadge status="Pendente" />);
    expect(screen.getByText("Pendente")).toBeInTheDocument();
  });

  it("renderiza label correcto para Fraude_Confirmada", () => {
    render(<StatusBadge status="Fraude_Confirmada" />);
    expect(screen.getByText("Fraude Confirmada")).toBeInTheDocument();
  });

  it("renderiza label correcto para Pendente_Inspecao", () => {
    render(<StatusBadge status="Pendente_Inspecao" />);
    expect(screen.getByText("Em Inspeção")).toBeInTheDocument();
  });
});
