/**
 * Testes do AlertasBulkBar — toolbar de acções em massa em /alertas
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AlertasBulkBar } from "@/app/alertas/_components/AlertasBulkBar";

describe("AlertasBulkBar", () => {
  it("não renderiza quando 0 selecionados", () => {
    const { container } = render(
      <AlertasBulkBar
        selectedCount={0}
        smsEligibleCount={0}
        ordemEligibleCount={0}
        busy={false}
        onClear={() => {}}
        onBulkSMS={() => {}}
        onBulkOrdem={() => {}}
        onBulkExport={() => {}}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it("mostra contagem de selecionados em singular", () => {
    render(
      <AlertasBulkBar
        selectedCount={1}
        smsEligibleCount={1}
        ordemEligibleCount={1}
        busy={false}
        onClear={() => {}}
        onBulkSMS={() => {}}
        onBulkOrdem={() => {}}
        onBulkExport={() => {}}
      />
    );
    expect(screen.getByText("1 selecionado")).toBeInTheDocument();
  });

  it("mostra contagem em plural", () => {
    render(
      <AlertasBulkBar
        selectedCount={5}
        smsEligibleCount={3}
        ordemEligibleCount={5}
        busy={false}
        onClear={() => {}}
        onBulkSMS={() => {}}
        onBulkOrdem={() => {}}
        onBulkExport={() => {}}
      />
    );
    expect(screen.getByText("5 selecionados")).toBeInTheDocument();
    expect(screen.getByText(/SMS \(3\)/)).toBeInTheDocument();
    expect(screen.getByText(/Ordem \(5\)/)).toBeInTheDocument();
  });

  it("desabilita SMS quando smsEligibleCount=0", () => {
    render(
      <AlertasBulkBar
        selectedCount={5}
        smsEligibleCount={0}
        ordemEligibleCount={5}
        busy={false}
        onClear={() => {}}
        onBulkSMS={() => {}}
        onBulkOrdem={() => {}}
        onBulkExport={() => {}}
      />
    );
    const smsBtn = screen.getByText(/SMS \(0\)/).closest("button");
    expect(smsBtn).toBeDisabled();
  });

  it("desabilita todos os botões de acção quando busy=true", () => {
    render(
      <AlertasBulkBar
        selectedCount={3}
        smsEligibleCount={3}
        ordemEligibleCount={3}
        busy={true}
        onClear={() => {}}
        onBulkSMS={() => {}}
        onBulkOrdem={() => {}}
        onBulkExport={() => {}}
      />
    );
    expect(screen.getByText(/SMS \(3\)/).closest("button")).toBeDisabled();
    expect(screen.getByText(/Ordem \(3\)/).closest("button")).toBeDisabled();
    expect(screen.getByText("Exportar").closest("button")).toBeDisabled();
  });

  it("invoca callbacks ao clicar nos botões", () => {
    const onClear = vi.fn();
    const onBulkSMS = vi.fn();
    const onBulkOrdem = vi.fn();
    const onBulkExport = vi.fn();
    render(
      <AlertasBulkBar
        selectedCount={2}
        smsEligibleCount={2}
        ordemEligibleCount={2}
        busy={false}
        onClear={onClear}
        onBulkSMS={onBulkSMS}
        onBulkOrdem={onBulkOrdem}
        onBulkExport={onBulkExport}
      />
    );
    fireEvent.click(screen.getByText(/SMS \(2\)/));
    fireEvent.click(screen.getByText(/Ordem \(2\)/));
    fireEvent.click(screen.getByText("Exportar"));
    fireEvent.click(screen.getByText("Limpar"));
    expect(onBulkSMS).toHaveBeenCalledOnce();
    expect(onBulkOrdem).toHaveBeenCalledOnce();
    expect(onBulkExport).toHaveBeenCalledOnce();
    expect(onClear).toHaveBeenCalledOnce();
  });
});
