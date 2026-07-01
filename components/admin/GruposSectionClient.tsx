"use client";

import { useState } from "react";
import { Plus, Trash2, ChevronDown, ChevronUp, Shield, Users, Loader2, AlertCircle } from "lucide-react";
import type { TenantGroup, UsuarioTenantCompleto } from "@/lib/db/admin";
import { salvarGrupoPermissao, deletarGrupoPermissao } from "@/lib/actions/admin-lojas";

const MODULES_LABEL: Record<string, string> = {
  dashboard_visao_geral: "Visão Geral",
  modulo_vendas:         "Dashboard Vendas",
  modulo_financeiro:     "Financeiro",
  modulo_produtos:       "Produtos",
  modulo_clientes:       "Clientes",
  modulo_os:             "O.S",
  modulo_relatorios:     "Comissão por Recebimento",
};

const MODULE_GROUPS_DEF = [
  { label: "Dashboard",   keys: ["dashboard_visao_geral", "modulo_vendas", "modulo_financeiro", "modulo_produtos", "modulo_clientes"] },
  { label: "Módulos",     keys: ["modulo_os"] },
  { label: "Relatórios",  keys: ["modulo_relatorios"] },
];

interface Props {
  tenantId: string;
  grupos: TenantGroup[];
  tenantFeatures: string[];
  usuarios: UsuarioTenantCompleto[];
}

// ── Painel de um grupo ────────────────────────────────────────────────────────

function GrupoPanel({
  tenantId,
  grupo,
  tenantFeatures,
  membros,
  onSaved,
  onDeleted,
}: {
  tenantId: string;
  grupo: TenantGroup | null; // null = criação
  tenantFeatures: string[];
  membros: string[];
  onSaved: (id: string, name: string, modulos: Record<string, boolean>) => void;
  onDeleted?: (id: string) => void;
}) {
  const isNew = grupo === null;
  const configurableModules = tenantFeatures.filter((k) => k in MODULES_LABEL);

  const [nome, setNome] = useState(grupo?.name ?? "");
  const [modulos, setModulos] = useState<Record<string, boolean>>(
    Object.fromEntries(configurableModules.map((k) => [k, grupo?.modulos[k] ?? false]))
  );
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const toggle = (k: string) => setModulos((p) => ({ ...p, [k]: !p[k] }));

  const handleSave = async () => {
    if (!nome.trim()) { setErro("Nome do grupo é obrigatório."); return; }
    setSaving(true); setErro(null);
    const result = await salvarGrupoPermissao(tenantId, grupo?.id ?? null, nome.trim(), modulos);
    setSaving(false);
    if (result.error) { setErro(result.error); return; }
    onSaved(result.id ?? grupo!.id, nome.trim(), modulos);
  };

  const handleDelete = async () => {
    if (!grupo) return;
    if (!confirm(`Excluir grupo "${grupo.name}"? Usuários vinculados perderão o grupo.`)) return;
    setDeleting(true); setErro(null);
    const result = await deletarGrupoPermissao(tenantId, grupo.id);
    setDeleting(false);
    if (result.error) { setErro(result.error); return; }
    onDeleted?.(grupo.id);
  };

  return (
    <div className="space-y-4">
      {erro && (
        <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          <AlertCircle className="h-4 w-4 shrink-0" /> {erro}
        </div>
      )}

      {/* Nome */}
      <div>
        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">
          Nome do grupo
        </label>
        <input
          type="text"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Ex: Vendedores, Gerentes, Suporte..."
          className="w-full sm:w-72 text-sm border border-slate-200 rounded-lg px-3 py-2 text-slate-800 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all"
        />
      </div>

      {/* Módulos */}
      {configurableModules.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
            <Shield className="h-3.5 w-3.5" /> Acesso aos módulos
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {MODULE_GROUPS_DEF.map((grp) => {
              const mods = grp.keys.filter((k) => configurableModules.includes(k));
              if (!mods.length) return null;
              return (
                <div key={grp.label} className="rounded-lg border border-slate-100 bg-slate-50/60 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
                    {grp.label}
                  </p>
                  <div className="space-y-1.5">
                    {mods.map((k) => (
                      <label key={k} className="flex items-center gap-2 cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={modulos[k] ?? false}
                          onChange={() => toggle(k)}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-slate-700 group-hover:text-slate-900 transition-colors">
                          {MODULES_LABEL[k]}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Membros (só exibe em grupos existentes) */}
      {!isNew && membros.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
            <Users className="h-3.5 w-3.5" /> Usuários neste grupo
          </p>
          <div className="flex flex-wrap gap-1.5">
            {membros.map((m, i) => (
              <span key={i} className="text-xs bg-blue-50 text-blue-700 border border-blue-100 rounded-full px-2.5 py-1 font-medium">
                {m || "Usuário"}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Ações */}
      <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-slate-100">
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-slate-900 text-white hover:bg-slate-700 transition-all disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          {isNew ? "Criar grupo" : "Salvar alterações"}
        </button>
        {!isNew && onDeleted && (
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg text-red-600 hover:bg-red-50 border border-transparent hover:border-red-200 transition-all disabled:opacity-50"
          >
            {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            Excluir grupo
          </button>
        )}
      </div>
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

export function GruposSectionClient({ tenantId, grupos: initialGrupos, tenantFeatures, usuarios }: Props) {
  const [grupos, setGrupos] = useState<TenantGroup[]>(initialGrupos);
  const [expandedId, setExpandedId] = useState<string | "new" | null>(null);

  // Mapeia membros por groupId
  const usersByGroup = new Map<string, string[]>();
  for (const u of usuarios) {
    const gid = u.settings?.groupId;
    if (gid) {
      const list = usersByGroup.get(gid) ?? [];
      list.push(u.fullName || u.email);
      usersByGroup.set(gid, list);
    }
  }

  const handleSaved = (id: string, name: string, modulos: Record<string, boolean>) => {
    setGrupos((prev) => {
      const exists = prev.find((g) => g.id === id);
      if (exists) return prev.map((g) => g.id === id ? { ...g, name, modulos } : g);
      return [...prev, { id, tenantId, name, modulos }].sort((a, b) => a.name.localeCompare(b.name));
    });
    setExpandedId(null);
  };

  const handleDeleted = (id: string) => {
    setGrupos((prev) => prev.filter((g) => g.id !== id));
    setExpandedId(null);
  };

  return (
    <div className="space-y-4">

      {/* Cabeçalho */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Grupos de Permissão</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Defina grupos com conjuntos de módulos. Atribua usuários a um grupo para herdar suas permissões.
              Dentro de cada usuário você pode restringir individualmente.
            </p>
          </div>
          <button
            onClick={() => setExpandedId(expandedId === "new" ? null : "new")}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-all shrink-0"
          >
            <Plus className="h-3.5 w-3.5" />
            Criar grupo
          </button>
        </div>
      </div>

      {/* Formulário novo grupo */}
      {expandedId === "new" && (
        <div className="rounded-xl border border-blue-200 bg-blue-50/30 p-5">
          <p className="text-sm font-semibold text-slate-800 mb-4">Novo grupo</p>
          <GrupoPanel
            tenantId={tenantId}
            grupo={null}
            tenantFeatures={tenantFeatures}
            membros={[]}
            onSaved={handleSaved}
          />
        </div>
      )}

      {/* Lista de grupos existentes */}
      {grupos.length === 0 && expandedId !== "new" ? (
        <div className="rounded-xl border border-dashed border-slate-200 py-12 text-center">
          <Shield className="h-8 w-8 text-slate-200 mx-auto mb-2" />
          <p className="text-sm font-medium text-slate-500">Nenhum grupo criado ainda</p>
          <p className="text-xs text-slate-400 mt-1">
            Crie grupos para controlar o acesso por departamento ou função.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {grupos.map((grupo) => {
            const isExpanded = expandedId === grupo.id;
            const membros = usersByGroup.get(grupo.id) ?? [];
            const modulosAtivos = Object.entries(grupo.modulos)
              .filter(([, v]) => v === true)
              .map(([k]) => MODULES_LABEL[k] ?? k);

            return (
              <div
                key={grupo.id}
                className="rounded-xl border border-slate-200 bg-white overflow-hidden"
              >
                {/* Cabeçalho do grupo */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : grupo.id)}
                  className="w-full flex items-center justify-between gap-3 px-5 py-3.5 text-left hover:bg-slate-50/60 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Shield className="h-4 w-4 text-blue-500 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">{grupo.name}</p>
                      <p className="text-xs text-slate-400 truncate">
                        {modulosAtivos.length > 0
                          ? modulosAtivos.join(" · ")
                          : "Nenhum módulo habilitado"}
                        {membros.length > 0 && (
                          <span className="ml-2 text-blue-500">· {membros.length} usuário{membros.length !== 1 ? "s" : ""}</span>
                        )}
                      </p>
                    </div>
                  </div>
                  {isExpanded
                    ? <ChevronUp className="h-4 w-4 text-slate-400 shrink-0" />
                    : <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />}
                </button>

                {/* Painel expandido */}
                {isExpanded && (
                  <div className="border-t border-slate-100 bg-slate-50/40 px-5 py-4">
                    <GrupoPanel
                      tenantId={tenantId}
                      grupo={grupo}
                      tenantFeatures={tenantFeatures}
                      membros={membros}
                      onSaved={handleSaved}
                      onDeleted={handleDeleted}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
