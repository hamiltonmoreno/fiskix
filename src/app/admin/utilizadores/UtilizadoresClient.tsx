"use client";

import { useState, Fragment } from "react";
import { Plus, UserCheck, UserX, Pencil, Trash2, AlertTriangle } from "lucide-react";
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

const ROLES_COM_ZONA: UserRole[] = ["fiscal", "supervisor"];

export function UtilizadoresClient({
  utilizadores: utilizadoresInicial,
  currentUserId,
}: {
  utilizadores: Utilizador[];
  currentUserId: string;
}) {
  const [utilizadores, setUtilizadores] = useState(utilizadoresInicial);
  const [showModal, setShowModal] = useState(false);
  const [editUser, setEditUser] = useState<Utilizador | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [novoUser, setNovoUser] = useState({
    email: "",
    password: "",
    nome_completo: "",
    role: "fiscal" as UserRole,
    id_zona: "",
  });
  const [loading, setLoading] = useState(false);
  const [loadingDelete, setLoadingDelete] = useState(false);
  const supabase = createClient();

  // ── Criar ──────────────────────────────────────────────────────────────────
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
      setNovoUser({ email: "", password: "", nome_completo: "", role: "fiscal", id_zona: "" });
      const { data } = await supabase
        .from("perfis")
        .select("id, nome_completo, role, id_zona, ativo, criado_em")
        .order("criado_em", { ascending: false });
      if (data) setUtilizadores(data);
    }
    setLoading(false);
  }

  // ── Editar ─────────────────────────────────────────────────────────────────
  async function handleEditar() {
    if (!editUser) return;
    setLoading(true);

    const { error } = await supabase
      .from("perfis")
      .update({
        nome_completo: editUser.nome_completo,
        role: editUser.role,
        id_zona: ROLES_COM_ZONA.includes(editUser.role) ? editUser.id_zona : null,
      })
      .eq("id", editUser.id);

    if (error) {
      alert(`Erro: ${error.message}`);
    } else {
      setUtilizadores((prev) =>
        prev.map((u) =>
          u.id === editUser.id
            ? {
                ...u,
                nome_completo: editUser.nome_completo,
                role: editUser.role,
                id_zona: ROLES_COM_ZONA.includes(editUser.role) ? editUser.id_zona : null,
              }
            : u
        )
      );
      setEditUser(null);
    }
    setLoading(false);
  }

  // ── Toggle Ativo ───────────────────────────────────────────────────────────
  async function toggleAtivo(id: string, ativo: boolean) {
    await supabase.from("perfis").update({ ativo: !ativo }).eq("id", id);
    setUtilizadores((prev) =>
      prev.map((u) => (u.id === id ? { ...u, ativo: !ativo } : u))
    );
  }

  // ── Eliminar ───────────────────────────────────────────────────────────────
  async function handleEliminar(id: string) {
    setLoadingDelete(true);
    const { error } = await supabase.auth.admin.deleteUser(id);

    if (error) {
      alert(`Erro: ${error.message}`);
    } else {
      setUtilizadores((prev) => prev.filter((u) => u.id !== id));
      setConfirmDelete(null);
    }
    setLoadingDelete(false);
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
            onClick={() => { setShowModal(true); setEditUser(null); setConfirmDelete(null); }}
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
                <Fragment key={u.id}>
                  <tr className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">{u.nome_completo}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                        {ROLES.find((r) => r.value === u.role)?.label ?? u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">
                      {u.id_zona?.replace(/_/g, " ") ?? "Acesso Global"}
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
                      <div className="flex items-center justify-end gap-1">
                        {/* Toggle ativo */}
                        <button
                          onClick={() => toggleAtivo(u.id, u.ativo)}
                          className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                          title={u.ativo ? "Desativar" : "Ativar"}
                        >
                          {u.ativo ? (
                            <UserX className="w-4 h-4" />
                          ) : (
                            <UserCheck className="w-4 h-4" />
                          )}
                        </button>
                        {/* Editar */}
                        <button
                          onClick={() => { setEditUser(u); setShowModal(false); setConfirmDelete(null); }}
                          className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-blue-600 transition-colors"
                          title="Editar"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        {/* Eliminar — não mostrar para si próprio */}
                        {u.id !== currentUserId && (
                          <button
                            onClick={() => { setConfirmDelete(confirmDelete === u.id ? null : u.id); setShowModal(false); setEditUser(null); }}
                            className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
                            title="Eliminar"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {/* Confirmação inline de eliminação */}
                  {confirmDelete === u.id && (
                    <tr className="bg-red-50 border-b border-red-100">
                      <td colSpan={5} className="px-4 py-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-sm text-red-700">
                            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                            <span>
                              Eliminar <strong>{u.nome_completo}</strong>? Esta ação é irreversível.
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setConfirmDelete(null)}
                              disabled={loadingDelete}
                              className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-medium text-slate-600 hover:bg-white disabled:opacity-50 transition-colors"
                            >
                              Cancelar
                            </button>
                            <button
                              onClick={() => handleEliminar(u.id)}
                              disabled={loadingDelete}
                              className="px-3 py-1.5 bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white rounded-lg text-xs font-medium transition-colors"
                            >
                              {loadingDelete ? "A eliminar..." : "Confirmar"}
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </main>

      {/* Modal: Novo Utilizador */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h2 className="font-bold text-slate-900 mb-4">Novo Utilizador</h2>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Nome completo"
                value={novoUser.nome_completo}
                onChange={(e) => setNovoUser((p) => ({ ...p, nome_completo: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="email"
                placeholder="Email"
                value={novoUser.email}
                onChange={(e) => setNovoUser((p) => ({ ...p, email: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="password"
                placeholder="Password temporária"
                value={novoUser.password}
                onChange={(e) => setNovoUser((p) => ({ ...p, password: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <select
                value={novoUser.role}
                onChange={(e) => setNovoUser((p) => ({ ...p, role: e.target.value as UserRole }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {ROLES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
              {ROLES_COM_ZONA.includes(novoUser.role) && (
                <select
                  value={novoUser.id_zona}
                  onChange={(e) => setNovoUser((p) => ({ ...p, id_zona: e.target.value }))}
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
                disabled={
                  loading ||
                  !novoUser.email ||
                  !novoUser.password ||
                  !novoUser.nome_completo.trim() ||
                  (ROLES_COM_ZONA.includes(novoUser.role) && !novoUser.id_zona)
                }
                className="flex-1 py-2.5 bg-blue-700 text-white rounded-lg text-sm font-medium hover:bg-blue-800 disabled:bg-slate-300"
              >
                {loading ? "A criar..." : "Criar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Editar Utilizador */}
      {editUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h2 className="font-bold text-slate-900 mb-4">Editar Utilizador</h2>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Nome completo"
                value={editUser.nome_completo}
                onChange={(e) => setEditUser((p) => p ? { ...p, nome_completo: e.target.value } : p)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <select
                value={editUser.role}
                onChange={(e) => setEditUser((p) => p ? { ...p, role: e.target.value as UserRole } : p)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {ROLES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
              {ROLES_COM_ZONA.includes(editUser.role) && (
                <select
                  value={editUser.id_zona ?? ""}
                  onChange={(e) => setEditUser((p) => p ? { ...p, id_zona: e.target.value || null } : p)}
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
                onClick={() => setEditUser(null)}
                className="flex-1 py-2.5 border border-slate-200 rounded-lg text-sm font-medium text-slate-600"
              >
                Cancelar
              </button>
              <button
                onClick={handleEditar}
                disabled={loading || !editUser?.nome_completo.trim()}
                className="flex-1 py-2.5 bg-blue-700 text-white rounded-lg text-sm font-medium hover:bg-blue-800 disabled:bg-slate-300"
              >
                {loading ? "A guardar..." : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
