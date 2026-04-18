"use client";

import { useState, useMemo, Fragment } from "react";
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

const ZONAS = ["Palmarejo", "Achada_Santo_Antonio", "Achada_Grande", "Plateau", "Sao_Vicente"];
const ROLES_COM_ZONA: UserRole[] = ["fiscal", "supervisor"];

const inputClass = "w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900/50 text-gray-900 dark:text-gray-100 rounded-lg text-sm border border-gray-200 dark:border-gray-700/60 focus:outline-none focus:ring-2 focus:ring-blue-500/30 placeholder:text-gray-400";

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
  const supabase = useMemo(() => createClient(), []);

  async function handleCriar() {
    setLoading(true);
    try {
      const { error } = await supabase.auth.admin.createUser({
        email: novoUser.email,
        password: novoUser.password,
        email_confirm: true,
        user_metadata: { nome_completo: novoUser.nome_completo, role: novoUser.role },
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
    } finally {
      setLoading(false);
    }
  }

  async function handleEditar() {
    if (!editUser) return;
    setLoading(true);
    try {
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
              ? { ...u, nome_completo: editUser.nome_completo, role: editUser.role, id_zona: ROLES_COM_ZONA.includes(editUser.role) ? editUser.id_zona : null }
              : u
          )
        );
        setEditUser(null);
      }
    } finally {
      setLoading(false);
    }
  }

  async function toggleAtivo(id: string, ativo: boolean) {
    await supabase.from("perfis").update({ ativo: !ativo }).eq("id", id);
    setUtilizadores((prev) => prev.map((u) => (u.id === id ? { ...u, ativo: !ativo } : u)));
  }

  async function handleEliminar(id: string) {
    setLoadingDelete(true);
    try {
      const { error } = await supabase.auth.admin.deleteUser(id);
      if (error) {
        alert(`Erro: ${error.message}`);
      } else {
        setUtilizadores((prev) => prev.filter((u) => u.id !== id));
        setConfirmDelete(null);
      }
    } finally {
      setLoadingDelete(false);
    }
  }

  return (
  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8 w-full max-w-9xl mx-auto">
      {/* Page hero */}
      <div className="sm:flex sm:justify-between sm:items-center mb-8">
        <div className="mb-4 sm:mb-0">
          <h1 className="text-2xl md:text-3xl text-gray-800 dark:text-gray-100 font-bold">
            Utilizadores
          </h1>
          <p className="text-sm text-gray-500 mt-1 uppercase tracking-wider font-semibold">
            {utilizadores.length} registados
          </p>
        </div>
        <button
          onClick={() => { setShowModal(true); setEditUser(null); setConfirmDelete(null); }}
          className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors shadow-sm cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Novo Utilizador
        </button>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 shadow-sm rounded-xl border border-gray-200 dark:border-gray-700/60 overflow-hidden mosaic-card-hover">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left whitespace-nowrap">
            <thead className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50/50 dark:bg-gray-800/50 uppercase border-b border-gray-200 dark:border-gray-700/60">
              <tr>
                <th className="px-6 py-4 font-semibold tracking-wider">Nome</th>
                <th className="px-6 py-4 font-semibold tracking-wider">Role</th>
                <th className="px-6 py-4 font-semibold tracking-wider">Zona</th>
                <th className="px-6 py-4 font-semibold tracking-wider">Estado</th>
                <th className="px-8 py-4 font-semibold tracking-wider text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
              {utilizadores.map((u) => (
                <Fragment key={u.id}>
                  <tr className="hover:bg-gray-50 dark:hover:bg-gray-800/80 transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-semibold text-gray-900 dark:text-gray-100">{u.nome_completo}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2.5 py-1 bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20 rounded text-[11px] font-semibold uppercase">
                        {ROLES.find((r) => r.value === u.role)?.label ?? u.role}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-gray-500 dark:text-gray-400">{u.id_zona?.replace(/_/g, " ") ?? "Global"}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded text-[11px] font-semibold uppercase border ${
                        u.ativo ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20" : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700"
                      }`}>
                        {u.ativo ? "Ativo" : "Inativo"}
                      </span>
                    </td>
                    <td className="px-8 py-4">
                      <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => toggleAtivo(u.id, u.ativo)}
                        className="p-1.5 rounded-full hover:bg-surface-container-low text-on-surface-variant transition-colors cursor-pointer"
                        title={u.ativo ? "Desativar" : "Ativar"}
                      >
                        {u.ativo ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => { setEditUser(u); setShowModal(false); setConfirmDelete(null); }}
                        className="p-1.5 rounded-full hover:bg-surface-container-low text-on-surface-variant hover:text-primary transition-colors cursor-pointer"
                        title="Editar"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      {u.id !== currentUserId && (
                        <button
                          onClick={() => { setConfirmDelete(confirmDelete === u.id ? null : u.id); setShowModal(false); setEditUser(null); }}
                          className="p-1.5 rounded-full hover:bg-[#ffdad6] text-on-surface-variant hover:text-[#ba1a1a] transition-colors cursor-pointer"
                          title="Eliminar"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
                {confirmDelete === u.id && (
                  <tr className="bg-[#ffdad6]/20 border-b border-[#ffdad6]/30">
                    <td colSpan={5} className="px-8 py-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs text-[#ba1a1a]">
                          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                          <span>Eliminar <strong>{u.nome_completo}</strong>? Irreversível.</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setConfirmDelete(null)}
                            disabled={loadingDelete}
                            className="px-3 py-1.5 bg-surface-container-low text-on-surface-variant rounded-full text-xs font-bold hover:bg-surface-container disabled:opacity-50 transition-colors cursor-pointer"
                          >
                            Cancelar
                          </button>
                          <button
                            onClick={() => handleEliminar(u.id)}
                            disabled={loadingDelete}
                            className="px-3 py-1.5 bg-[#ba1a1a] hover:opacity-90 disabled:opacity-50 text-white rounded-full text-xs font-bold transition-opacity cursor-pointer"
                          >
                            {loadingDelete ? "..." : "Eliminar"}
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

      {/* Modal: Novo Utilizador */}
      {showModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-surface-container-lowest rounded-[1.5rem] shadow-xl w-full max-w-md p-6">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">Novo</p>
            <h2 className="font-bold text-gray-900 dark:text-gray-100 text-lg mb-5">Criar Utilizador</h2>
            <div className="space-y-4">
              <input type="text" placeholder="Nome completo" value={novoUser.nome_completo}
                onChange={(e) => setNovoUser((p) => ({ ...p, nome_completo: e.target.value }))}
                className={inputClass} />
              <input type="email" placeholder="Email" value={novoUser.email}
                onChange={(e) => setNovoUser((p) => ({ ...p, email: e.target.value }))}
                className={inputClass} />
              <input type="password" placeholder="Password temporária" value={novoUser.password}
                onChange={(e) => setNovoUser((p) => ({ ...p, password: e.target.value }))}
                className={inputClass} />
              <select value={novoUser.role} onChange={(e) => setNovoUser((p) => ({ ...p, role: e.target.value as UserRole }))}
                className={inputClass + " cursor-pointer"}>
                {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
              {ROLES_COM_ZONA.includes(novoUser.role) && (
                <select value={novoUser.id_zona} onChange={(e) => setNovoUser((p) => ({ ...p, id_zona: e.target.value }))}
                  className={inputClass + " cursor-pointer"}>
                  <option value="">Selecionar zona...</option>
                  {ZONAS.map((z) => <option key={z} value={z}>{z.replace(/_/g, " ")}</option>)}
                </select>
              )}
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowModal(false)}
                className="flex-1 px-4 py-2 text-sm font-semibold border border-gray-200 dark:border-gray-700/60 text-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer">
                Cancelar
              </button>
              <button onClick={handleCriar}
                disabled={loading || !novoUser.email || !novoUser.password || !novoUser.nome_completo.trim() || (ROLES_COM_ZONA.includes(novoUser.role) && !novoUser.id_zona)}
                className="flex-1 px-4 py-2 text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors shadow-sm cursor-pointer disabled:opacity-50">
                {loading ? "A criar..." : "Criar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Editar Utilizador */}
      {editUser && (
        <div className="fixed inset-0 bg-gray-900/40 dark:bg-gray-900/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4 transition-all duration-300">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700/60 w-full max-w-md p-6">
            <h2 className="font-bold text-gray-900 dark:text-gray-100 text-lg mb-5">Editar Utilizador</h2>
            <div className="space-y-4">
              <input type="text" placeholder="Nome completo" value={editUser.nome_completo}
                onChange={(e) => setEditUser((p) => p ? { ...p, nome_completo: e.target.value } : p)}
                className={inputClass} />
              <select value={editUser.role} onChange={(e) => setEditUser((p) => p ? { ...p, role: e.target.value as UserRole } : p)}
                className={inputClass + " cursor-pointer"}>
                {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
              {ROLES_COM_ZONA.includes(editUser.role) && (
                <select value={editUser.id_zona ?? ""} onChange={(e) => setEditUser((p) => p ? { ...p, id_zona: e.target.value || null } : p)}
                  className={inputClass + " cursor-pointer"}>
                  <option value="">Selecionar zona...</option>
                  {ZONAS.map((z) => <option key={z} value={z}>{z.replace(/_/g, " ")}</option>)}
                </select>
              )}
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setEditUser(null)}
                className="flex-1 px-4 py-2 text-sm font-semibold border border-gray-200 dark:border-gray-700/60 text-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer">
                Cancelar
              </button>
              <button onClick={handleEditar} disabled={loading || !editUser?.nome_completo.trim()}
                className="flex-1 px-4 py-2 text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors shadow-sm cursor-pointer disabled:opacity-50">
                {loading ? "A guardar..." : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
