import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ParseFaturaClient } from "./ParseFaturaClient";

export default async function ParseFaturaPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("perfis").select("role").eq("id", user.id).single();
  if (!profile || !["admin_fiskix", "gestor_perdas"].includes(profile.role)) {
    redirect("/dashboard");
  }

  const { data: cfgRows } = await supabase
    .from("configuracoes")
    .select("chave, valor")
    .in("chave", ["ocr_provider", "ocr_claude_api_key"]);
  const cfg: Record<string, string> = {};
  for (const r of cfgRows ?? []) cfg[r.chave] = r.valor ?? "";
  const provider = (cfg.ocr_provider || "text-paste") as "text-paste" | "claude-vision";
  const claudeReady = provider === "claude-vision" && (cfg.ocr_claude_api_key?.trim()?.length ?? 0) > 0;

  return <ParseFaturaClient provider={provider} claudeReady={claudeReady} />;
}
