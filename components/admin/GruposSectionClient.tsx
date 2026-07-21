"use client";

import { useState } from "react";
import { Plus, Trash2, ChevronDown, ChevronUp, Shield, Users, Loader2, AlertCircle } from "lucide-react";
import type { TenantGroup, UsuarioTenantCompleto } from "@/lib/db/admin";
import { salvarGrupoPermissao, deletarGrupoPermissao } from "@/lib/actions/admin-lojas";
import { AdminCard } from "@/components/admin/AdminCard";
import { AdminButton } from "@/components/admin/AdminButton";
import { AdminBadge } from "@/components/admin/AdminBadge";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";

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
        <div
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs"
          style={{ background: "var(--adm-alert-soft)", border: "1px solid var(--adm-alert)", color: "var(--adm-alert)" }}
        >
          <AlertCircle className="h-4 w-4 shrink-0" /> {erro}
        </div>
      )}

      {/* Nome */}
      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--adm-text-faint)" }}>
          Nome do grupo
        </label>
        <input
          type="text"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Ex: Vendedores, Gerentes, Suporte..."
          className="adm-field adm-focusable w-full px-3 py-2 text-sm sm:w-72"
        />
      </div>

      {/* Módulos */}
      {configurableModules.length > 0 && (
        <div className="space-y-3">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--adm-text-faint)" }}>
            <Shield className="h-3.5 w-3.5" /> Acesso aos módulos
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {MODULE_GROUPS_DEF.map((grp) => {
              const mods = grp.keys.filter((k) => configurableModules.includes(k));
              if (!mods.length) return null;
              return (
                <div key={grp.label} className="rounded-lg p-3" style={{ border: "1px solid var(--adm-line)", background: "var(--adm-surface-2)" }}>
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--adm-text-faint)" }}>
                    {grp.label}
                  </p>
                  <div className="space-y-1.5">
                    {mods.map((k) => (
                      <label key={k} className="flex cursor-pointer items-center gap-2">
                        <input
                          type="checkbox"
                          checked={modulos[k] ?? false}
                          onChange={() => toggle(k)}
                          className="adm-focusable rounded"
                          style={{ accentColor: "var(--adm-accent)" }}
                        />
                        <span className="text-sm transition-colors" style={{ color: "var(--adm-text)" }}>
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
          <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--adm-text-faint)" }}>
            <Users className="h-3.5 w-3.5" /> Usuários neste grupo
          </p>
          <div className="flex flex-wrap gap-1.5">
            {membros.map((m, i) => (
              <AdminBadge key={i} variant="accent">{m || "Usuário"}</AdminBadge>
            ))}
          </div>
        </div>
      )}

      {/* Ações */}
      <div className="flex flex-wrap items-center gap-2 pt-1" style={{ borderTop: "1px solid var(--adm-line)" }}>
        <AdminButton onClick={handleSave} disabled={saving} size="sm">
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          {isNew ? "Criar grupo" : "Salvar alterações"}
        </AdminButton>
        {!isNew && onDeleted && (
          <AdminButton variant="danger" size="sm" onClick={handleDelete} disabled={deleting}>
            {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            Excluir grupo
          </AdminButton>
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
      <AdminCard className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold" style={{ color: "var(--adm-text)" }}>Grupos de Permissão</h3>
            <p className="mt-0.5 text-xs" style={{ color: "var(--adm-text-faint)" }}>
              Defina grupos com conjuntos de módulos. Atribua usuários a um grupo para herdar suas permissões.
              Dentro de cada usuário você pode restringir individualmente.
            </p>
          </div>
          <AdminButton size="sm" className="shrink-0" onClick={() => setExpandedId(expandedId === "new" ? null : "new")}>
            <Plus className="h-3.5 w-3.5" />
            Criar grupo
          </AdminButton>
        </div>
      </AdminCard>

      {/* Formulário novo grupo */}
      {expandedId === "new" && (
        <AdminCard className="p-5" style={{ borderColor: "var(--adm-accent)", background: "var(--adm-accent-soft)" }}>
          <p className="mb-4 text-sm font-semibold" style={{ color: "var(--adm-text)" }}>Novo grupo</p>
          <GrupoPanel
            tenantId={tenantId}
            grupo={null}
            tenantFeatures={tenantFeatures}
            membros={[]}
            onSaved={handleSaved}
          />
        </AdminCard>
      )}

      {/* Lista de grupos existentes */}
      {grupos.length === 0 && expandedId !== "new" ? (
        <AdminCard>
          <AdminEmptyState
            icon={Shield}
            title="Nenhum grupo criado ainda"
            description="Crie grupos para controlar o acesso por departamento ou função."
          />
        </AdminCard>
      ) : (
        <div className="space-y-2">
          {grupos.map((grupo) => {
            const isExpanded = expandedId === grupo.id;
            const membros = usersByGroup.get(grupo.id) ?? [];
            const modulosAtivos = Object.entries(grupo.modulos)
              .filter(([, v]) => v === true)
              .map(([k]) => MODULES_LABEL[k] ?? k);

            return (
              <AdminCard key={grupo.id} className="overflow-hidden p-0">
                {/* Cabeçalho do grupo */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : grupo.id)}
                  className="adm-row flex w-full items-center justify-between gap-3 px-5 py-3.5 text-left transition-colors"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <Shield className="h-4 w-4 shrink-0" style={{ color: "var(--adm-accent)" }} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold" style={{ color: "var(--adm-text)" }}>{grupo.name}</p>
                      <p className="truncate text-xs" style={{ color: "var(--adm-text-faint)" }}>
                        {modulosAtivos.length > 0
                          ? modulosAtivos.join(" · ")
                          : "Nenhum módulo habilitado"}
                        {membros.length > 0 && (
                          <span className="ml-2" style={{ color: "var(--adm-accent)" }}>
                            · {membros.length} usuário{membros.length !== 1 ? "s" : ""}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  {isExpanded
                    ? <ChevronUp className="h-4 w-4 shrink-0" style={{ color: "var(--adm-text-faint)" }} />
                    : <ChevronDown className="h-4 w-4 shrink-0" style={{ color: "var(--adm-text-faint)" }} />}
                </button>

                {/* Painel expandido */}
                {isExpanded && (
                  <div className="px-5 py-4" style={{ borderTop: "1px solid var(--adm-line)", background: "var(--adm-surface-2)" }}>
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
              </AdminCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
