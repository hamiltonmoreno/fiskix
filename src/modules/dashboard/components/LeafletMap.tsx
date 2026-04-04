"use client";

import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import type { SubestacaoMapa } from "../types";
import { formatCVE } from "@/lib/utils";
import "leaflet/dist/leaflet.css";

interface LeafletMapProps {
  subestacoes: SubestacaoMapa[];
  mesAno: string;
}

function getColor(perdaPct: number): string {
  if (perdaPct >= 15) return "#DC2626";
  if (perdaPct >= 10) return "#D97706";
  return "#16A34A";
}

function getRadius(kwh: number): number {
  // Raio proporcional ao volume injetado (min 10, max 35)
  const base = Math.sqrt(kwh / 10000);
  return Math.min(35, Math.max(10, base));
}

export function LeafletMap({ subestacoes, mesAno }: LeafletMapProps) {
  // Centrar em Cabo Verde (Santiago)
  const center: [number, number] = [14.93, -23.51];

  return (
    <MapContainer
      center={center}
      zoom={12}
      style={{ height: "100%", width: "100%" }}
      scrollWheelZoom={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {subestacoes.map((sub) => {
        const color = getColor(sub.perda_pct);
        const radius = getRadius(sub.kwh_injetado);
        const perdaKwh = sub.kwh_injetado - sub.kwh_faturado;
        const tarifaEstimada = 15; // CVE/kWh estimado
        const perdaCVE = perdaKwh * tarifaEstimada;

        return (
          <CircleMarker
            key={sub.id}
            center={[sub.lat, sub.lng]}
            radius={radius}
            pathOptions={{
              color,
              fillColor: color,
              fillOpacity: 0.6,
              weight: 2,
            }}
          >
            <Popup>
              <div className="text-sm min-w-48">
                <p className="font-bold text-slate-900 mb-1">{sub.nome}</p>
                <p className="text-slate-500 text-xs mb-2">{sub.zona_bairro}</p>
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Injetado:</span>
                    <span className="font-medium">{sub.kwh_injetado.toLocaleString("pt-CV")} kWh</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Faturado:</span>
                    <span className="font-medium">{sub.kwh_faturado.toLocaleString("pt-CV")} kWh</span>
                  </div>
                  <div className="flex justify-between font-bold" style={{ color }}>
                    <span>Perda:</span>
                    <span>{sub.perda_pct.toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Perda kWh:</span>
                    <span className="font-medium">{Math.max(0, perdaKwh).toLocaleString("pt-CV")} kWh</span>
                  </div>
                  <div className="flex justify-between text-red-600">
                    <span>Perda CVE (est.):</span>
                    <span>{formatCVE(Math.max(0, perdaCVE))}</span>
                  </div>
                  {sub.alertas_criticos > 0 && (
                    <div className="mt-2 px-2 py-1 bg-red-50 rounded text-red-700 text-xs text-center">
                      ⚠️ {sub.alertas_criticos} cliente(s) em risco crítico
                    </div>
                  )}
                </div>
              </div>
            </Popup>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
