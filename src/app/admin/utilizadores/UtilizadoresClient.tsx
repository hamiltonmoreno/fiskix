"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, UserCheck, UserX } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { UserRole } from "@/types/database";

interface Utilizador {
  id: string;
  nome_completo: string;
  role: UserRole;
  id_zona: string | null;
  ativo: boolean;
  criado_em: string;
}

const ROLES: { value: UserRole; label: string }[] = [
  { value: "admin_fiskix", label: "Admin Fiskix" },
  { value: "diretor", label: "Diretor" },
  { value: "gestor_perdas", label: "Gestor de Perdas" },
  { value: "supervisor", label: "Supervisor" },
  { value: "fiscal", label: "Fiscal" },
];

const ZONAS = [
  "Palmarejo",
  "Achada_Santo_Antonio",
  "Achada_Grande",
  "Plateau",
  "Sao_Vicente",
];

export function UtilizadoresClient({
  utilizadores: utilizadoresInicial,
}: {
  utilizadores: Utilizador[];
}) {
  const [utilizadores, setUtilizadores] = useState(utilizadoresInicial);
  const [showModal, setShowModal] = useState(false);
  const [novoUser, setNovoUser] = useState({
    email: "",
    password: "",
    nome_completo: "",
    role: "fiscal" as UserRole,
    id_zona: "",
  });
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  async function handleCriar() {
    setLoading(true);
    const { error } = await supabase.auth.admin.createUser({
      email: novoUser.email,
      password: novoUser.password,
      email_confirm: true,
      user_metadata: {
        nome_completo: novoUser.nome_completo,
        role: novoUser.role,
      },
    });

    if (error) {
      alert(`Erro: ${error.message}`);
    } else {
      setShowModal(false);
      // Recarregar lista
      const { data } = await supabase
        .from("perfis")
        .select("id, nome_completo, role, id_zona, ativo, criado_em")
        .order("criado_em", { ascending: false });
      if (data) setUtilizadores(data);
    }
    setLoading(false);
  }

  async function toggleAtivo(id: string, ativo: boolean) {
    await supabase.from("perfis").update({ ativo: !ativo }).eq("id", id);
    setUtilizadores((prev) =>
      prev.map((u) => (u.id === id ? { ...u, ativo: !ativo } : u))
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-bold text-slate-900">Utilizadores</h1>
            <p className="text-sm text-slate-400">{utilizadores.length} registados</p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-700 text-white rounded-lg text-sm font-medium hover:bg-blue-800"
          >
            <Plus className="w-4 h-4" />
            Novo Utilizador
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-6">
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">Nome</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">Role</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">Zona</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">Estado</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-slate-500">Ações</th>
              </tr>
            </thead>
            <tbody>
              {utilizadores.map((u) => (
                <tr key={u.id} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{u.nome_completo}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                      {ROLES.find((r) => r.value === u.role)?.label ?? u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs">
                    {u.id_zona?.replace(/_/g, " ") ?? "Global"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        u.ativo
                          ? "bg-green-100 text-green-700"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {u.ativo ? "Ativo" : "Inativo"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => toggleAtivo(u.id, u.ativo)}
                      className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"
                      title={u.ativo ? "Desativar" : "Ativar"}
                    >
                      {u.ativo ? (
                        <UserX className="w-4 h-4" />
                      ) : (
                        <UserCheck className="w-4 h-4" />
                      )}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>

      {/* Modal Novo Utilizador */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h2 className="font-bold text-slate-900 mb-4">Novo Utilizador</h2>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Nome completo"
                value={novoUser.nome_completo}
                onChange={(e) =>
                  setNovoUser((p) => ({ ...p, nome_completo: e.target.value }))
                }
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="email"
                placeholder="Email"
                value={novoUser.email}
                onChange={(e) =>
                  setNovoUser((p) => ({ ...p, email: e.target.value }))
                }
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="password"
                placeholder="Password temporária"
                value={novoUser.password}
                onChange={(e) =>
                  setNovoUser((p) => ({ ...p, password: e.target.value }))
                }
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <select
                value={novoUser.role}
                onChange={(e) =>
                  setNovoUser((p) => ({ ...p, role: e.target.value as UserRole }))
                }
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {ROLES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
              {novoUser.role === "fiscal" && (
                <select
                  value={novoUser.id_zona}
                  onChange={(e) =>
                    setNovoUser((p) => ({ ...p, id_zona: e.target.value }))
                  }
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Selecionar zona...</option>
                  {ZONAS.map((z) => (
                    <option key={z} value={z}>
                      {z.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 py-2.5 border border-slate-200 rounded-lg text-sm font-medium text-slate-600"
              >
                Cancelar
              </button>
              <button
                onClick={handleCriar}
                disabled={loading}
                className="flex-1 py-2.5 bg-blue-700 text-white rounded-lg text-sm font-medium hover:bg-blue-800 disabled:bg-slate-300"
              >
                {loading ? "A criar..." : "Criar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
