"use client";

import { useState, useRef, useCallback } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowLeft, Camera, Upload, CheckCircle, Loader2, AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { openDB } from "idb";
import { useOnlineStatus } from "@/lib/hooks/useOnlineStatus";
import { logger } from "@/lib/observability/logger";
import type { RelatorioOffline } from "../types";

const MAX_FOTO_LONG_EDGE = 1280;
const MAX_FOTO_QUALITY = 0.8;
const GPS_TIMEOUT_MS = 10_000;

interface RelatorioProps {
  alertaId: string;
  fiscalId: string;
  nomeCliente: string;
  numeroContador: string;
}

const RESULTADOS = [
  { value: "Fraude_Confirmada", label: "Fraude Confirmada", color: "#DC2626" },
  { value: "Anomalia_Tecnica", label: "Anomalia Técnica", color: "#D97706" },
  { value: "Falso_Positivo", label: "Falso Positivo", color: "#16A34A" },
] as const;

const TIPOS_FRAUDE = [
  "Bypass",
  "Contador_adulterado",
  "Ligacao_vizinha",
  "Ima",
  "Outro",
];

async function getDB() {
  return openDB("fiskix-offline", 1, {
    upgrade(db) {
      db.createObjectStore("relatorios", { keyPath: "alerta_id" });
    },
  });
}

async function salvarOffline(relatorio: RelatorioOffline) {
  const db = await getDB();
  await db.put("relatorios", relatorio);
}

export function RelatorioInspecao({
  alertaId,
  fiscalId,
  nomeCliente,
  numeroContador,
}: RelatorioProps) {
  const [resultado, setResultado] = useState<typeof RESULTADOS[number]["value"] | "">("");
  const [tipoFraude, setTipoFraude] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);
  const [fotoBlob, setFotoBlob] = useState<Blob | null>(null);
  const [gps, setGps] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [camAtiva, setCamAtiva] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [sucesso, setSucesso] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "error" | "info"; message: string } | null>(null);
  const [confirmGpsMissing, setConfirmGpsMissing] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const router = useRouter();
  const supabase = createClient();
  const online = useOnlineStatus();

  const iniciarCamera = useCallback(async () => {
    try {
      setGpsError(null);
      setFeedback(null);
      // Obter GPS antes da câmara
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setGps({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          setGpsError(null);
        },
        (err) => {
          // Surface GPS denial / timeout to the fiscal so they don't submit
          // a relatório with no coordinates thinking it's geolocated.
          const reason = err.code === err.PERMISSION_DENIED
            ? "Permissão de GPS negada — sem coordenadas a foto não serve como prova."
            : err.code === err.TIMEOUT
            ? "Tempo esgotado a obter GPS — tente novamente em local com melhor sinal."
            : "Não foi possível obter o GPS.";
          setGpsError(reason);
        },
        { enableHighAccuracy: true, timeout: GPS_TIMEOUT_MS },
      );

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: 1280, height: 720 },
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCamAtiva(true);
    } catch (err) {
      logger({ module: "RelatorioInspecao" }).warn("camera_access_failed", {
        error: err instanceof Error ? err.message : String(err),
      });
      setFeedback({ type: "error", message: "Não foi possível aceder à câmara. Verifique as permissões." });
    }
  }, []);

  const tirarFoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;

    // Downscale long edge to MAX_FOTO_LONG_EDGE so a modern phone (1920×1080
    // sensor) doesn't produce 1–2 MB JPEGs that blow IndexedDB quota when
    // multiple offline reports stack up.
    const srcW = video.videoWidth;
    const srcH = video.videoHeight;
    const longEdge = Math.max(srcW, srcH);
    const scale = longEdge > MAX_FOTO_LONG_EDGE ? MAX_FOTO_LONG_EDGE / longEdge : 1;
    canvas.width = Math.round(srcW * scale);
    canvas.height = Math.round(srcH * scale);

    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Marca d'água: GPS + timestamp
    const agora = new Date().toLocaleString("pt-CV");
    const gpsText = gps
      ? `GPS: ${gps.lat.toFixed(6)}, ${gps.lng.toFixed(6)}`
      : "GPS: indisponível";

    ctx.font = "bold 18px monospace";
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(8, canvas.height - 70, canvas.width - 16, 60);
    ctx.fillStyle = "#FFFFFF";
    ctx.fillText(gpsText, 16, canvas.height - 46);
    ctx.fillText(agora, 16, canvas.height - 18);

    // Também adicionar o número do contador
    ctx.font = "14px monospace";
    ctx.fillStyle = "#FFFFFF";
    ctx.fillText(`Fiskix · ${numeroContador}`, canvas.width - 220, canvas.height - 18);

    canvas.toBlob(
      (blob) => {
        if (blob) {
          setFotoBlob(blob);
          setFotoUrl(canvas.toDataURL("image/jpeg", MAX_FOTO_QUALITY));
        }
      },
      "image/jpeg",
      MAX_FOTO_QUALITY,
    );

    // Parar câmara
    streamRef.current?.getTracks().forEach((t) => t.stop());
    setCamAtiva(false);
  }, [gps, numeroContador]);

  async function handleSubmit() {
    if (!resultado) {
      setFeedback({ type: "error", message: "Selecione o resultado da inspeção." });
      return;
    }
    setFeedback(null);

    // If we have a photo but no GPS, ask the fiscal to confirm before submitting.
    // Inline modal (setConfirmGpsMissing) em vez de window.confirm — funciona em
    // PWA (window.confirm pode ser bloqueado/inconsistente no standalone display).
    if (fotoBlob && !gps) {
      setConfirmGpsMissing(true);
      return;
    }

    await doSubmit();
  }

  async function doSubmit() {
    setConfirmGpsMissing(false);
    setSubmitting(true);

    const relatorioData: RelatorioOffline = {
      alerta_id: alertaId,
      resultado: resultado as RelatorioOffline["resultado"],
      tipo_fraude: tipoFraude || undefined,
      observacoes: observacoes || undefined,
      foto_data_url: fotoUrl ?? undefined,
      foto_lat: gps?.lat,
      foto_lng: gps?.lng,
      timestamp: Date.now(),
    };

    if (!online) {
      // Guardar offline
      await salvarOffline(relatorioData);
      setFeedback({ type: "info", message: "Sem ligação. Relatório guardado localmente para sincronização." });
      setSucesso(true);
      setSubmitting(false);
      return;
    }

    try {
      let foto_url: string | null = null;

      // Upload da foto
      if (fotoBlob) {
        const nomeArq = `${fiscalId}/${alertaId}_${Date.now()}.jpg`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("inspecoes")
          .upload(nomeArq, fotoBlob, {
            contentType: "image/jpeg",
            upsert: false,
          });

        if (!uploadError && uploadData) {
          const { data: urlData } = supabase.storage
            .from("inspecoes")
            .getPublicUrl(nomeArq);
          foto_url = urlData.publicUrl;
        }
      }

      // Inserir relatório
      const { error: relError } = await supabase
        .from("relatorios_inspecao")
        .insert({
          id_alerta: alertaId,
          id_fiscal: fiscalId,
          resultado: resultado as "Fraude_Confirmada" | "Anomalia_Tecnica" | "Falso_Positivo",
          tipo_fraude: (tipoFraude || null) as "Bypass" | "Contador_adulterado" | "Ligacao_vizinha" | "Ima" | "Outro" | null,
          foto_url,
          foto_lat: gps?.lat ?? null,
          foto_lng: gps?.lng ?? null,
          observacoes: observacoes || null,
        });

      if (relError) throw relError;

      // Atualizar status do alerta
      await supabase
        .from("alertas_fraude")
        .update({
          status: "Inspecionado",
          resultado: resultado as "Fraude_Confirmada" | "Anomalia_Tecnica" | "Falso_Positivo",
        })
        .eq("id", alertaId);

      setSucesso(true);
    } catch (err) {
      logger({ module: "RelatorioInspecao" }).warn("submit_online_failed_fallback_offline", {
        error: err instanceof Error ? err.message : String(err),
      });
      // Fallback offline — keep the photo data URL so syncPendingReports can
      // re-upload it later (otherwise the legal evidence would be lost).
      await salvarOffline(relatorioData);
      setFeedback({ type: "info", message: "Falha de rede. Relatório guardado localmente para sincronização." });
      setSucesso(true);
    }

    setSubmitting(false);
  }

  if (sucesso) {
    return (
      <div
        className="mobile-app min-h-screen flex flex-col items-center justify-center p-8 text-center"
      >
        <div className="bg-white rounded-2xl p-8 w-full max-w-sm">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-900 mb-2">
            Relatório Submetido
          </h2>
          <p className="text-slate-600 text-sm mb-6">
            {online
              ? "Sincronizado com sucesso."
              : "Guardado localmente. Será sincronizado quando houver ligação."}
          </p>
          <button
            onClick={() => router.push("/mobile")}
            className="w-full py-4 bg-blue-700 text-white rounded-2xl font-semibold"
            style={{ minHeight: "56px" }}
          >
            Voltar ao Roteiro
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="mobile-app min-h-screen pb-8"
    >
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-slate-200 dark:border-gray-700/60 px-4 py-3 sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            aria-label="Voltar"
            className="p-2 rounded-xl bg-slate-100"
          >
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </button>
          <div>
            <p className="font-semibold text-slate-900">Relatório de Inspeção</p>
            <p className="text-xs text-slate-500">{nomeCliente}</p>
          </div>
        </div>
      </header>

      <div className="p-4 space-y-4">
        <div aria-live="polite" role="status">
          {feedback && (
            <div
              className={`rounded-xl border px-3 py-2 text-sm ${
                feedback.type === "error"
                  ? "bg-red-50 border-red-200 text-red-700"
                  : "bg-blue-50 border-blue-200 text-blue-700"
              }`}
            >
              {feedback.message}
            </div>
          )}
        </div>

        {/* Resultado */}
        <div className="bg-white rounded-2xl p-5">
          <p className="font-semibold text-slate-700 mb-3">Resultado da Inspeção *</p>
          <div className="space-y-2">
            {RESULTADOS.map((r) => (
              <label
                key={r.value}
                className={`flex items-center gap-3 p-3.5 rounded-xl border-2 cursor-pointer transition-colors ${
                  resultado === r.value
                    ? "border-current bg-opacity-10"
                    : "border-slate-200"
                }`}
                style={{
                  borderColor: resultado === r.value ? r.color : undefined,
                  backgroundColor: resultado === r.value ? r.color + "15" : undefined,
                }}
              >
                <input
                  type="radio"
                  name="resultado"
                  value={r.value}
                  checked={resultado === r.value}
                  onChange={(e) => setResultado(e.target.value as typeof resultado)}
                  className="sr-only"
                />
                <div
                  className="w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0"
                  style={{
                    borderColor: r.color,
                    backgroundColor: resultado === r.value ? r.color : "transparent",
                  }}
                >
                  {resultado === r.value && (
                    <div className="w-2 h-2 rounded-full bg-white" />
                  )}
                </div>
                <span
                  className="font-medium text-base"
                  style={{ color: resultado === r.value ? r.color : "#0F172A" }}
                >
                  {r.label}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Tipo de fraude (apenas se Fraude Confirmada) */}
        {resultado === "Fraude_Confirmada" && (
          <div className="bg-white rounded-2xl p-5">
            <p className="font-semibold text-slate-700 mb-3">Tipo de Fraude</p>
            <select
              value={tipoFraude}
              onChange={(e) => setTipoFraude(e.target.value)}
              className="w-full px-4 py-3.5 border border-slate-200 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Selecionar tipo...</option>
              {TIPOS_FRAUDE.map((t) => (
                <option key={t} value={t}>
                  {t.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Câmara / Foto */}
        <div className="bg-white rounded-2xl p-5">
          <p className="font-semibold text-slate-700 mb-3">
            Foto com GPS{" "}
            <span className="text-slate-400 font-normal text-sm">(prova jurídica)</span>
          </p>

          {!camAtiva && !fotoUrl && (
            <button
              onClick={iniciarCamera}
              className="w-full py-12 border-2 border-dashed border-slate-300 rounded-xl flex flex-col items-center gap-3 text-slate-400 hover:border-blue-400 hover:text-blue-500 transition-colors"
            >
              <Camera className="w-10 h-10" />
              <span className="text-sm font-medium">Tirar Foto</span>
            </button>
          )}

          {camAtiva && (
            <div className="space-y-3">
              <video
                ref={videoRef}
                className="w-full rounded-xl bg-black"
                autoPlay
                playsInline
                muted
              />
              <button
                onClick={tirarFoto}
                className="w-full py-4 bg-blue-700 text-white rounded-xl font-semibold text-base flex items-center justify-center gap-2"
                style={{ minHeight: "56px" }}
              >
                <Camera className="w-5 h-5" />
                Capturar Foto
              </button>
            </div>
          )}

          {gpsError && (
            <div className="mb-3 flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-amber-700 text-xs">{gpsError}</p>
            </div>
          )}

          {fotoUrl && (
            <div className="space-y-3">
              <Image
                src={fotoUrl}
                alt="Foto da inspeção"
                width={1280}
                height={720}
                unoptimized
                className="w-full h-auto rounded-xl"
              />
              {gps ? (
                <p className="text-xs text-slate-400 text-center">
                  GPS: {gps.lat.toFixed(6)}, {gps.lng.toFixed(6)}
                </p>
              ) : (
                <p className="text-xs text-amber-600 text-center font-medium">
                  ⚠ Foto sem GPS — pode não servir como prova
                </p>
              )}
              <button
                onClick={() => {
                  setFotoUrl(null);
                  setFotoBlob(null);
                }}
                className="w-full py-2.5 border border-slate-200 rounded-xl text-slate-500 text-sm"
              >
                Tirar Nova Foto
              </button>
            </div>
          )}

          <canvas ref={canvasRef} className="hidden" />
        </div>

        {/* Observações */}
        <div className="bg-white rounded-2xl p-5">
          <p className="font-semibold text-slate-700 mb-3">Observações</p>
          <textarea
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            placeholder="Descreva o que encontrou no local..."
            rows={4}
            className="w-full px-4 py-3 border border-slate-200 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>

        {/* Confirmação de foto sem GPS */}
        {confirmGpsMissing && (
          <div className="bg-amber-50 border border-amber-300 rounded-2xl p-5">
            <div className="flex items-start gap-3 mb-4">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-amber-800 text-sm font-medium">
                A foto não tem coordenadas GPS. Sem GPS pode não ser válida como prova jurídica.
                Deseja submeter mesmo assim?
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmGpsMissing(false)}
                className="flex-1 py-3 border border-slate-200 rounded-xl text-slate-700 font-semibold text-sm bg-white"
              >
                Cancelar
              </button>
              <button
                onClick={doSubmit}
                className="flex-1 py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-semibold text-sm transition-colors"
              >
                Submeter sem GPS
              </button>
            </div>
          </div>
        )}

        {/* Botão Sincronizar */}
        <button
          onClick={handleSubmit}
          disabled={submitting || !resultado || confirmGpsMissing}
          className="w-full py-5 bg-blue-700 hover:bg-blue-800 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-2xl font-bold text-base flex items-center justify-center gap-3 transition-colors"
          style={{ minHeight: "64px" }}
        >
          {submitting ? (
            <>
              <Loader2 className="w-6 h-6 animate-spin" />
              A sincronizar...
            </>
          ) : (
            <>
              <Upload className="w-6 h-6" />
              Sincronizar Relatório
            </>
          )}
        </button>

        {!online && (
          <p className="text-center text-amber-600 text-sm">
            Sem ligação — será guardado e sincronizado depois
          </p>
        )}
      </div>
    </div>
  );
}
