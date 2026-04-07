import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { LeafletMap } from "@/modules/dashboard/components/LeafletMap";
import { SubestacaoMapa } from "@/modules/dashboard/types";

// ── Mock react-leaflet ────────────────────────────────────────────────────────
vi.mock("react-leaflet", () => {
  return {
    MapContainer: ({ children }: any) => <div data-testid="map-container">{children}</div>,
    TileLayer: () => <div data-testid="tile-layer" />,
    CircleMarker: ({ children, pathOptions }: any) => (
      <div data-testid="circle-marker" data-color={pathOptions.color}>
        {children}
      </div>
    ),
    Popup: ({ children }: any) => <div data-testid="popup">{children}</div>,
  };
});

const mockSubestacoes: SubestacaoMapa[] = [
  {
    id: "sub-vermelha",
    nome: "Subestação Vermelha",
    zona_bairro: "Palmarejo",
    lat: 14.9,
    lng: -23.5,
    kwh_injetado: 50000,
    kwh_faturado: 35000, // perda = 15000
    perda_pct: 30, // >= 15 = vermelho
    alertas_criticos: 2,
  },
  {
    id: "sub-laranja",
    nome: "Subestação Laranja",
    zona_bairro: "Achada",
    lat: 14.91,
    lng: -23.51,
    kwh_injetado: 40000,
    kwh_faturado: 35000, // perda = 5000
    perda_pct: 12.5, // >= 10 = laranja (#D97706)
    alertas_criticos: 0,
  },
  {
    id: "sub-verde",
    nome: "Subestação Verde",
    zona_bairro: "Tira Chapéu",
    lat: 14.92,
    lng: -23.52,
    kwh_injetado: 30000,
    kwh_faturado: 29000,
    perda_pct: 3.3, // < 10 = verde (#16A34A)
    alertas_criticos: 0,
  },
];

describe("LeafletMap.tsx", () => {
  it("renderiza o MapContainer e os TileLayers mockados", () => {
    render(<LeafletMap subestacoes={mockSubestacoes} />);
    expect(screen.getByTestId("map-container")).toBeInTheDocument();
    expect(screen.getByTestId("tile-layer")).toBeInTheDocument();
  });

  it("renderiza CircleMarkers com a cor correta dependendo da perda_pct", () => {
    render(<LeafletMap subestacoes={mockSubestacoes} />);
    
    const markers = screen.getAllByTestId("circle-marker");
    expect(markers).toHaveLength(3);

    // Vermelha
    expect(markers[0]).toHaveAttribute("data-color", "#DC2626");
    // Laranja
    expect(markers[1]).toHaveAttribute("data-color", "#D97706");
    // Verde
    expect(markers[2]).toHaveAttribute("data-color", "#16A34A");
  });

  it("renderiza o popup com as informações da subestação", () => {
    render(<LeafletMap subestacoes={[mockSubestacoes[0]]} />); // Renderiza só a vermelha

    // Info Textual
    expect(screen.getByText("Subestação Vermelha")).toBeInTheDocument();
    expect(screen.getByText("Palmarejo")).toBeInTheDocument();
    
    // Injetados / Faturados formatados com toLocaleString("pt-CV")
    // Note: Em alguns ambientes node, toLocaleString pode usar padrão US (\u00A0 vs , ou .),
    // portanto matchers com RegExp são mais seguros.
    expect(screen.getByText(/50[.,\s]*000\s*kWh/)).toBeInTheDocument();
    expect(screen.getByText(/35[.,\s]*000\s*kWh/)).toBeInTheDocument();

    // Verificamos a % que deve mostrar fixed(1): "30.0%"
    expect(screen.getByText("30.0%")).toBeInTheDocument();

    // Verificamos alertas
    expect(screen.getByText(/2 cliente\(s\) em risco crítico/)).toBeInTheDocument();
  });
});
