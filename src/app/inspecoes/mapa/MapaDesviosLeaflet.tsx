"use client";

import { useEffect, useRef } from "react";
import type { InspecaoPonto } from "./MapaInspecoesClient";

interface Props {
  pontos: InspecaoPonto[];
  limiarMetros: number;
}

export default function MapaDesviosLeaflet({ pontos, limiarMetros }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<unknown>(null);

  useEffect(() => {
    if (!containerRef.current || pontos.length === 0) return;

    let cancelled = false;

    import("leaflet").then((L) => {
      if (cancelled || !containerRef.current) return;

      // Cleanup existing map
      if (mapRef.current) {
        (mapRef.current as { remove: () => void }).remove();
        mapRef.current = null;
      }

      const map = L.map(containerRef.current!).setView(
        [pontos[0].cliente_lat, pontos[0].cliente_lng],
        12
      );
      mapRef.current = map;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors",
        maxZoom: 19,
      }).addTo(map);

      const clienteIcon = L.divIcon({ className: "", html: '<div style="width:10px;height:10px;border-radius:50%;background:#3b82f6;border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.3)"></div>', iconSize: [10, 10], iconAnchor: [5, 5] });
      const fotoOkIcon = L.divIcon({ className: "", html: '<div style="width:10px;height:10px;border-radius:50%;background:#10b981;border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.3)"></div>', iconSize: [10, 10], iconAnchor: [5, 5] });
      const fotoSuspIcon = L.divIcon({ className: "", html: '<div style="width:12px;height:12px;border-radius:50%;background:#ef4444;border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.3)"></div>', iconSize: [12, 12], iconAnchor: [6, 6] });

      for (const p of pontos) {
        const isSuspeito = p.distancia_m > limiarMetros;
        const popupContent = `<div style="font-size:12px;min-width:160px"><b>${p.nome_titular}</b><br/><code style="font-size:10px">${p.numero_contador}</code><br/>Fiscal: ${p.nome_fiscal}<br/>Resultado: ${p.resultado.replace(/_/g, " ")}<br/>Desvio: <b style="color:${isSuspeito ? "#ef4444" : "#10b981"}">${p.distancia_m}m</b></div>`;

        L.marker([p.cliente_lat, p.cliente_lng], { icon: clienteIcon })
          .addTo(map)
          .bindPopup(popupContent);

        L.marker([p.foto_lat, p.foto_lng], { icon: isSuspeito ? fotoSuspIcon : fotoOkIcon })
          .addTo(map)
          .bindPopup(popupContent);

        L.polyline(
          [[p.cliente_lat, p.cliente_lng], [p.foto_lat, p.foto_lng]],
          { color: isSuspeito ? "#ef4444" : "#10b981", weight: 1.5, opacity: 0.6, dashArray: isSuspeito ? "4 4" : undefined }
        ).addTo(map);
      }

      if (pontos.length > 1) {
        const bounds = L.latLngBounds(pontos.flatMap((p) => [[p.cliente_lat, p.cliente_lng], [p.foto_lat, p.foto_lng]] as [number, number][]));
        map.fitBounds(bounds, { padding: [30, 30] });
      }
    });

    return () => {
      cancelled = true;
      if (mapRef.current) {
        (mapRef.current as { remove: () => void }).remove();
        mapRef.current = null;
      }
    };
  }, [pontos, limiarMetros]);

  if (pontos.length === 0) {
    return (
      <div className="h-[480px] flex flex-col items-center justify-center text-slate-400 dark:text-gray-500">
        <p className="text-sm">Nenhuma inspeção com GPS para os filtros selecionados.</p>
      </div>
    );
  }

  return (
    <div className="relative">
      <div ref={containerRef} className="h-[480px] z-0" />
      <div className="absolute bottom-4 left-4 bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700/60 px-3 py-2 text-xs space-y-1 z-[400]">
        <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" /> Morada registada</div>
        <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" /> Foto (OK)</div>
        <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-red-500 inline-block" /> Foto (suspeito)</div>
      </div>
    </div>
  );
}
