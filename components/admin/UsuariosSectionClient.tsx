"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2, UserPlus, AlertCircle, ChevronDown, ChevronUp,
  Download, User, CheckCircle2, Shield, Building2, Trash2,
} from "lucide-react";
import { salvarUsuarioERP, salvarAcessoUsuario, removerUsuarioTenant } from "@/lib/actions/admin-lojas";
import type { UsuarioTenantCompleto, ErpMapping, TenantGroup } from "@/lib/db/admin";
import type { ErpUserItem } from "@/app/api/admin/erp-users/route";
import { AdminCard } from "@/components/admin/AdminCard";
import { AdminButton } from "@/components/admin/AdminButton";
import { AdminBadge } from "@/components/admin/AdminBadge";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";

type UserRole = "owner" | "admin" | "viewer";

interface LojaInfo {
  id: string;
  name: string;
  bridgeEnabled: boolean;
  empId: number;
}

interface Props {
  tenantId: string;
  usuarios: UsuarioTenantCompleto[];
  lojas: LojaInfo[];
  tenantFeatures: string[];
  grupos: TenantGroup[];
  killedFeatureKeys: string[];
}

const MODULES_LABEL: Record<string, string> = {
  dashboard_visao_geral: "Visão Geral",
  modulo_vendas:         "Dashboard Vendas",
  modulo_financeiro:     "Financeiro",
  modulo_produtos:       "Produtos",
  modulo_clientes:       "Clientes",
  modulo_os:             "O.S",
  modulo_relatorios:     "Comissão por Recebimento",
};

const MODULE_GROUPS: { label: string; keys: string[] }[] = [
  { label: "Dashboard",  keys: ["dashboard_visao_geral", "modulo_vendas", "modulo_financeiro", "modulo_produtos", "modulo_clientes"] },
  { label: "Módulos",    keys: ["modulo_os"] },
  { label: "Relatórios", keys: ["modulo_relatorios"] },
];

const ROLE_LABEL: Record<string, string> = {
  owner:  "Proprietário",
  admin:  "Admin",
  viewer: "Usuário",
};

const ROLE_VARIANT: Record<string, "warning" | "accent" | "neutral"> = {
  owner:  "warning",
  admin:  "accent",
  viewer: "neutral",
};

// ── Componente principal ─────────────────────────────────────────────────────

export function UsuariosSectionClient({ tenantId, usuarios, lojas, tenantFeatures, grupos, killedFeatureKeys }: Props) {
  const router = useRouter();
  const [painel, setPainel] = useState<"none" | "add-manual" | "add-erp">("none");
  const [editUserId, setEditUserId] = useState<string | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);

  const configurableModules = tenantFeatures.filter((k) => k in MODULES_LABEL);
  const bridgeLojas = lojas.filter((l) => l.bridgeEnabled);

  const fecharPainel = useCallback(() => {
    setPainel("none");
    setEditUserId(null);
  }, []);

  const refresh = useCallback(() => {
    router.refresh();
    fecharPainel();
  }, [router, fecharPainel]);

  const handleDelete = useCallback(async (userId: string) => {
    setDeletingUserId(userId);
    const result = await removerUsuarioTenant(tenantId, userId);
    setDeletingUserId(null);
    if (result.error) {
      alert(`Erro ao remover usuário: ${result.error}`);
      return;
    }
    router.refresh();
  }, [tenantId, router]);

  return (
    <div className="space-y-4">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <p className="text-sm" style={{ color: "var(--adm-text-dim)" }}>
          {usuarios.length} {usuarios.length === 1 ? "usuário vinculado" : "usuários vinculados"}
        </p>
        <div className="flex items-center gap-2">
          {painel === "none" && (
            <>
              {bridgeLojas.length > 0 && (
                <AdminButton variant="secondary" size="sm" onClick={() => setPainel("add-erp")}>
                  <Download className="h-3.5 w-3.5" />
                  Importar do ERP
                </AdminButton>
              )}
              <AdminButton size="sm" onClick={() => setPainel("add-manual")}>
                <UserPlus className="h-3.5 w-3.5" />
                Adicionar Usuário
              </AdminButton>
            </>
          )}
          {painel !== "none" && (
            <AdminButton variant="ghost" size="sm" onClick={fecharPainel}>
              Cancelar
            </AdminButton>
          )}
        </div>
      </div>

      {/* Painel de adicionar usuário manual */}
      {painel === "add-manual" && (
        <AddManualForm
          tenantId={tenantId}
          lojas={lojas}
          configurableModules={configurableModules}
          onSuccess={refresh}
          onCancel={fecharPainel}
        />
      )}

      {/* Painel de importar do ERP */}
      {painel === "add-erp" && (
        <ERPImportFlow
          tenantId={tenantId}
          bridgeLojas={bridgeLojas}
          allLojas={lojas}
          configurableModules={configurableModules}
          onSuccess={refresh}
          onCancel={fecharPainel}
        />
      )}

      {/* Tabela de usuários */}
      <AdminCard className="overflow-hidden p-0">
        {usuarios.length === 0 ? (
          <AdminEmptyState icon={User} title="Nenhum usuário vinculado a este tenant." />
        ) : (
          <div>
            {usuarios.map((u, i) => (
              <UsuarioRow
                key={u.id}
                usuario={u}
                tenantId={tenantId}
                lojas={lojas}
                configurableModules={configurableModules}
                grupos={grupos}
                killedFeatureKeys={killedFeatureKeys}
                expanded={editUserId === u.userId}
                onToggle={() => setEditUserId(editUserId === u.userId ? null : u.userId)}
                onSaved={refresh}
                onDelete={() => handleDelete(u.userId)}
                deleting={deletingUserId === u.userId}
                noBorder={i === 0}
              />
            ))}
          </div>
        )}
      </AdminCard>
    </div>
  );
}

// ── Linha de usuário com painel expansível ────────────────────────────────────

function UsuarioRow({
  usuario, tenantId, lojas, configurableModules, grupos, killedFeatureKeys, expanded, onToggle, onSaved, onDelete, deleting, noBorder,
}: {
  usuario: UsuarioTenantCompleto;
  tenantId: string;
  lojas: LojaInfo[];
  configurableModules: string[];
  grupos: TenantGroup[];
  killedFeatureKeys: string[];
  expanded: boolean;
  onToggle: () => void;
  onSaved: () => void;
  onDelete: () => void;
  deleting: boolean;
  noBorder: boolean;
}) {
  const activeModules = Object.entries(usuario.settings?.modulos ?? {})
    .filter(([, v]) => v)
    .map(([k]) => k)
    .filter((k) => k in MODULES_LABEL);

  return (
    <div style={{ borderTop: noBorder ? "none" : "1px solid var(--adm-line)" }}>
      <div
        className="adm-row flex cursor-pointer items-center gap-3 px-4 py-3"
        onClick={onToggle}
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium" style={{ color: "var(--adm-text)" }}>
            {usuario.fullName || "—"}
          </p>
          <p className="truncate text-xs" style={{ color: "var(--adm-text-faint)" }}>{usuario.email || "—"}</p>
        </div>

        <span className="shrink-0">
          <AdminBadge variant={ROLE_VARIANT[usuario.role] ?? "neutral"}>
            {ROLE_LABEL[usuario.role] ?? usuario.role}
          </AdminBadge>
        </span>

        {activeModules.length > 0 ? (
          <div className="hidden shrink-0 gap-1 sm:flex">
            {activeModules.map((k) => (
              <span key={k}>
                <AdminBadge variant="accent">{MODULES_LABEL[k]}</AdminBadge>
              </span>
            ))}
          </div>
        ) : (
          <span className="hidden text-xs sm:inline" style={{ color: "var(--adm-text-faint)" }}>Sem módulos</span>
        )}

        {usuario.erpMappings.length > 0 && (
          <span className="hidden sm:inline-flex">
            <AdminBadge variant="success" dot>ERP</AdminBadge>
          </span>
        )}

        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          disabled={deleting}
          className="adm-focusable shrink-0 rounded p-1 transition-colors disabled:opacity-40"
          style={{ color: "var(--adm-text-faint)" }}
          title="Remover usuário"
        >
          {deleting
            ? <Loader2 className="h-4 w-4 animate-spin" />
            : <Trash2 className="h-4 w-4" />}
        </button>

        {expanded ? (
          <ChevronUp className="h-4 w-4 shrink-0" style={{ color: "var(--adm-text-faint)" }} />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0" style={{ color: "var(--adm-text-faint)" }} />
        )}
      </div>

      {expanded && (
        <UsuarioEditPanel
          usuario={usuario}
          tenantId={tenantId}
          lojas={lojas}
          configurableModules={configurableModules}
          grupos={grupos}
          killedFeatureKeys={killedFeatureKeys}
          onSaved={onSaved}
        />
      )}
    </div>
  );
}

// ── Painel de edição de usuário ───────────────────────────────────────────────

function UsuarioEditPanel({
  usuario, tenantId, lojas, configurableModules, grupos, killedFeatureKeys, onSaved,
}: {
  usuario: UsuarioTenantCompleto;
  tenantId: string;
  lojas: LojaInfo[];
  configurableModules: string[];
  grupos: TenantGroup[];
  killedFeatureKeys: string[];
  onSaved: () => void;
}) {
  const currentModulos = usuario.settings?.modulos ?? {};
  const currentLojaIds = usuario.settings?.lojaIds ?? [];
  const currentGroupId = usuario.settings?.groupId ?? null;

  const [groupId, setGroupId] = useState<string | null>(currentGroupId);
  const [modulos, setModulos] = useState<Record<string, boolean>>(
    Object.fromEntries(configurableModules.map((k) => [k, currentModulos[k] ?? false]))
  );
  const [lojaIds, setLojaIds] = useState<string[]>(currentLojaIds);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const toggleModulo = (key: string) =>
    setModulos((prev) => ({ ...prev, [key]: !prev[key] }));

  const toggleLoja = (id: string) =>
    setLojaIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );

  const handleSave = async () => {
    setLoading(true);
    setErro(null);
    const result = await salvarAcessoUsuario(tenantId, usuario.userId, { lojaIds, modulos, groupId });
    setLoading(false);
    if (result.error) { setErro(result.error); return; }
    onSaved();
  };

  return (
    <div className="space-y-4 px-4 py-4" style={{ borderTop: "1px solid var(--adm-line)", background: "var(--adm-surface-2)" }}>
      {erro && <ErrorBanner text={erro} />}

      {/* Grupo */}
      {grupos.length > 0 && (
        <div>
          <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--adm-text-faint)" }}>
            <Shield className="h-3.5 w-3.5" /> Grupo de permissão
          </p>
          <select
            value={groupId ?? ""}
            onChange={(e) => setGroupId(e.target.value || null)}
            className="adm-field adm-focusable w-full px-3 py-2 text-sm sm:w-auto"
          >
            <option value="">Nenhum (configuração individual)</option>
            {grupos.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
          {groupId && (
            <p className="mt-1 text-xs" style={{ color: "var(--adm-text-faint)" }}>
              O usuário herda os módulos do grupo. Os checkboxes abaixo restringem individualmente.
            </p>
          )}
        </div>
      )}

      {/* Módulos agrupados */}
      {configurableModules.length === 0 ? (
        <p className="text-xs" style={{ color: "var(--adm-text-faint)" }}>Nenhum módulo habilitado no tenant.</p>
      ) : (
        <div className="space-y-3">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--adm-text-faint)" }}>
            <Shield className="h-3.5 w-3.5" /> {groupId ? "Restrições individuais (sobre o grupo)" : "Módulos"}
          </p>
          {MODULE_GROUPS.map((group) => {
            const groupMods = group.keys.filter((k) => configurableModules.includes(k));
            if (groupMods.length === 0) return null;
            return (
              <div key={group.label}>
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--adm-text-faint)" }}>
                  {group.label}
                </p>
                <div className="flex flex-wrap gap-2">
                  {groupMods.map((k) => {
                    const killedGlobally = killedFeatureKeys.includes(k);
                    return (
                      <label
                        key={k}
                        className="flex items-center gap-1.5"
                        style={{ cursor: killedGlobally ? "not-allowed" : "pointer", opacity: killedGlobally ? 0.6 : 1 }}
                        title={killedGlobally ? "Desativado globalmente — reative em Módulos" : undefined}
                      >
                        <input
                          type="checkbox"
                          checked={modulos[k] ?? false}
                          onChange={() => toggleModulo(k)}
                          disabled={killedGlobally}
                          className="adm-focusable rounded"
                          style={{ accentColor: "var(--adm-accent)" }}
                        />
                        <span className="text-sm" style={{ color: "var(--adm-text)" }}>{MODULES_LABEL[k] ?? k}</span>
                        {killedGlobally && <AdminBadge variant="danger">Global</AdminBadge>}
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Lojas com acesso */}
      <div>
        <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--adm-text-faint)" }}>
          <Building2 className="h-3.5 w-3.5" /> Lojas visíveis{" "}
          <span className="font-normal normal-case tracking-normal" style={{ color: "var(--adm-text-faint)" }}>
            (vazio = todas)
          </span>
        </p>
        <div className="flex flex-wrap gap-2">
          {lojas.map((l) => (
            <label key={l.id} className="flex cursor-pointer items-center gap-1.5">
              <input
                type="checkbox"
                checked={lojaIds.includes(l.id)}
                onChange={() => toggleLoja(l.id)}
                className="adm-focusable rounded"
                style={{ accentColor: "var(--adm-accent)" }}
              />
              <span className="text-sm" style={{ color: "var(--adm-text)" }}>{l.name}</span>
            </label>
          ))}
        </div>
      </div>

      {/* ERP mappings (leitura) */}
      {usuario.erpMappings.length > 0 && (
        <div>
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--adm-text-faint)" }}>
            <CheckCircle2 className="h-3.5 w-3.5" /> Vínculo ERP
          </p>
          <div className="space-y-1">
            {usuario.erpMappings.map((m) => (
              <ERPMappingBadge key={m.lojaId} mapping={m} />
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-end gap-2 pt-2" style={{ borderTop: "1px solid var(--adm-line)" }}>
        <AdminButton size="sm" onClick={handleSave} disabled={loading}>
          {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {loading ? "Salvando..." : "Salvar acesso"}
        </AdminButton>
      </div>
    </div>
  );
}

function ERPMappingBadge({ mapping }: { mapping: ErpMapping }) {
  return (
    <div
      className="flex items-center gap-2 rounded px-2.5 py-1.5 text-xs"
      style={{ background: "var(--adm-surface)", border: "1px solid var(--adm-line)" }}
    >
      <span className="font-medium" style={{ color: "var(--adm-text)" }}>{mapping.lojaNome}</span>
      <span style={{ color: "var(--adm-text-faint)" }}>·</span>
      <span style={{ color: "var(--adm-text-dim)" }}>{mapping.cliNome}</span>
      <span style={{ color: "var(--adm-text-faint)" }}>·</span>
      <span className="adm-mono" style={{ color: "var(--adm-text-faint)" }}>#{mapping.cliId}</span>
      {mapping.tiposBloqueados.length > 0 && (
        <>
          <span style={{ color: "var(--adm-text-faint)" }}>·</span>
          <span style={{ color: "var(--adm-warn)" }}>
            {mapping.tiposBloqueados.length} tipo(s) bloqueado(s)
          </span>
        </>
      )}
    </div>
  );
}

// ── Formulário manual ─────────────────────────────────────────────────────────

function AddManualForm({
  tenantId, lojas, configurableModules, onSuccess, onCancel,
}: {
  tenantId: string;
  lojas: LojaInfo[];
  configurableModules: string[];
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [form, setForm] = useState({
    email: "", nomeCompleto: "", senha: "", papel: "viewer" as UserRole,
  });
  const [modulos, setModulos] = useState<Record<string, boolean>>(
    Object.fromEntries(configurableModules.map((k) => [k, false]))
  );
  const [lojaIds, setLojaIds] = useState<string[]>([]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErro(null);
    const result = await salvarUsuarioERP(tenantId, {
      ...form,
      cliId: null, cliNome: "",
      lojaIds, modulos, tiposBloqueados: [],
    });
    setLoading(false);
    if (result.error) { setErro(result.error); return; }
    onSuccess();
  };

  return (
    <form onSubmit={handleSubmit}>
    <AdminCard className="space-y-4 p-5">
      <h3 className="text-sm font-semibold" style={{ color: "var(--adm-text)" }}>Novo Usuário</h3>

      {erro && <ErrorBanner text={erro} />}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Email *">
          <input type="email" required value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            className={inputCls} />
        </Field>
        <Field label="Nome completo *">
          <input type="text" required value={form.nomeCompleto}
            onChange={(e) => setForm((f) => ({ ...f, nomeCompleto: e.target.value }))}
            className={inputCls} />
        </Field>
        <Field label="Senha provisória *">
          <input type="password" required minLength={8} value={form.senha}
            onChange={(e) => setForm((f) => ({ ...f, senha: e.target.value }))}
            placeholder="Mínimo 8 caracteres" className={inputCls} />
        </Field>
        <Field label="Papel">
          <select value={form.papel}
            onChange={(e) => setForm((f) => ({ ...f, papel: e.target.value as UserRole }))}
            className={inputCls}>
            <option value="viewer">Usuário</option>
            <option value="owner">Proprietário</option>
          </select>
        </Field>
      </div>

      <ModulosField modules={configurableModules} value={modulos} onChange={setModulos} />
      <LojasField lojas={lojas} value={lojaIds} onChange={setLojaIds} />

      <FormActions loading={loading} onCancel={onCancel} labelSave="Criar Usuário" />
    </AdminCard>
    </form>
  );
}

// ── Importação do ERP ─────────────────────────────────────────────────────────

type ERPStep = "select-user" | "confirm";

function ERPImportFlow({
  tenantId, bridgeLojas, allLojas, configurableModules, onSuccess, onCancel,
}: {
  tenantId: string;
  bridgeLojas: LojaInfo[];
  allLojas: LojaInfo[];
  configurableModules: string[];
  onSuccess: () => void;
  onCancel: () => void;
}) {
  // Sempre usa a primeira loja com Bridge — usuários são globais no ERP
  const lojaId = bridgeLojas[0]?.id ?? "";
  const [step, setStep] = useState<ERPStep>("select-user");
  const [erpUsers, setErpUsers] = useState<ErpUserItem[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [erroUsers, setErroUsers] = useState<string | null>(null);
  const [selected, setSelected] = useState<ErpUserItem | null>(null);

  // Busca automática ao montar
  useEffect(() => {
    if (!lojaId) return;
    setLoadingUsers(true);
    setErroUsers(null);
    fetch(`/api/admin/erp-users?lojaId=${lojaId}`)
      .then((res) => res.json() as Promise<{ users?: ErpUserItem[]; erro?: string }>)
      .then((data) => {
        if (data.erro) throw new Error(data.erro);
        setErpUsers(data.users ?? []);
      })
      .catch((e) => setErroUsers(e instanceof Error ? e.message : "Erro ao buscar usuários ERP"))
      .finally(() => setLoadingUsers(false));
  }, [lojaId]);

  if (step === "select-user") {
    return (
      <AdminCard className="space-y-4 p-5">
        <h3 className="text-sm font-semibold" style={{ color: "var(--adm-text)" }}>Selecionar Usuário ERP</h3>

        {loadingUsers && (
          <div className="flex items-center gap-2 text-sm" style={{ color: "var(--adm-text-dim)" }}>
            <Loader2 className="h-4 w-4 animate-spin" /> Buscando usuários...
          </div>
        )}

        {erroUsers && <ErrorBanner text={erroUsers} />}

        {!loadingUsers && erpUsers.length === 0 && !erroUsers && (
          <p className="text-sm" style={{ color: "var(--adm-text-faint)" }}>
            Nenhum usuário com <code className="text-xs">cliUsuarioUsaSistema = 1</code> encontrado.
          </p>
        )}

        {erpUsers.length > 0 && (
          <div className="max-h-72 overflow-y-auto rounded-lg" style={{ border: "1px solid var(--adm-line)" }}>
            {erpUsers.map((u, i) => (
              <button
                key={u.cliId}
                onClick={() => { setSelected(u); setStep("confirm"); }}
                className="adm-row flex w-full items-center gap-3 px-4 py-3 text-left transition-colors"
                style={{ borderTop: i === 0 ? "none" : "1px solid var(--adm-line)" }}
              >
                <User className="h-4 w-4 shrink-0" style={{ color: "var(--adm-text-faint)" }} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium" style={{ color: "var(--adm-text)" }}>{u.cliNome}</p>
                  <p className="text-xs" style={{ color: "var(--adm-text-faint)" }}>
                    {u.cliEmail || "Sem email"}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <AdminButton variant="ghost" size="sm" onClick={onCancel}>Cancelar</AdminButton>
        </div>
      </AdminCard>
    );
  }

  // step === "confirm"
  return (
    <ERPConfirmForm
      tenantId={tenantId}
      erpUser={selected!}
      allLojas={allLojas}
      configurableModules={configurableModules}
      onSuccess={onSuccess}
      onBack={() => setStep("select-user")}
      onCancel={onCancel}
    />
  );
}

function ERPConfirmForm({
  tenantId, erpUser, allLojas, configurableModules, onSuccess, onBack, onCancel,
}: {
  tenantId: string;
  erpUser: ErpUserItem;
  allLojas: LojaInfo[];
  configurableModules: string[];
  onSuccess: () => void;
  onBack: () => void;
  onCancel: () => void;
}) {
  const [email, setEmail] = useState(erpUser.cliEmail || "");
  const [nomeCompleto, setNomeCompleto] = useState(erpUser.cliNome);
  const [senha, setSenha] = useState("");
  const [papel, setPapel] = useState<UserRole>("viewer");
  const [modulos, setModulos] = useState<Record<string, boolean>>(
    Object.fromEntries(configurableModules.map((k) => [k, false]))
  );
  // Auto-seleciona as lojas cujo empId corresponde ao empId padrão do usuário no ERP.
  // Fallback para todas as lojas se não houver match (garante que loja_usuarios_erp sempre é criado).
  const autoLojas = allLojas
    .filter((l) => erpUser.cliUsuEmpIdPadrao != null && l.empId === Number(erpUser.cliUsuEmpIdPadrao))
    .map((l) => l.id);
  const [lojaIds, setLojaIds] = useState<string[]>(
    autoLojas.length > 0 ? autoLojas : allLojas.map((l) => l.id),
  );
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErro(null);
    const result = await salvarUsuarioERP(tenantId, {
      email, nomeCompleto, senha, papel,
      cliId: Number(erpUser.cliId), cliNome: erpUser.cliNome,
      lojaIds, modulos, tiposBloqueados: [],
    });
    setLoading(false);
    if (result.error) { setErro(result.error); return; }
    onSuccess();
  };

  return (
    <form onSubmit={handleSubmit}>
    <AdminCard className="space-y-4 p-5">
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="text-sm font-semibold" style={{ color: "var(--adm-text)" }}>Confirmar usuário ERP</h3>
        <AdminBadge variant="success">cliId {erpUser.cliId}</AdminBadge>
        {erpUser.cliUsuEmpIdPadrao != null && (
          <AdminBadge variant="accent">empId {erpUser.cliUsuEmpIdPadrao}</AdminBadge>
        )}
      </div>

      {erro && <ErrorBanner text={erro} />}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Email *">
          <input type="email" required value={email}
            onChange={(e) => setEmail(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Nome completo">
          <input type="text" value={nomeCompleto}
            onChange={(e) => setNomeCompleto(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Senha *">
          <input type="password" required minLength={8} value={senha}
            onChange={(e) => setSenha(e.target.value)}
            placeholder="Mínimo 8 caracteres" className={inputCls} />
        </Field>
        <Field label="Papel">
          <select value={papel}
            onChange={(e) => setPapel(e.target.value as UserRole)} className={inputCls}>
            <option value="viewer">Usuário</option>
            <option value="owner">Proprietário</option>
          </select>
        </Field>
      </div>

      <ModulosField modules={configurableModules} value={modulos} onChange={setModulos} />
      <LojasField lojas={allLojas} value={lojaIds} onChange={setLojaIds} />

      <div className="flex items-center justify-between pt-2" style={{ borderTop: "1px solid var(--adm-line)" }}>
        <AdminButton type="button" variant="ghost" size="sm" onClick={onBack}>
          ← Voltar
        </AdminButton>
        <FormActions loading={loading} onCancel={onCancel} labelSave="Salvar usuário" />
      </div>
    </AdminCard>
    </form>
  );
}

// ── Helpers de UI ─────────────────────────────────────────────────────────────

const inputCls = "adm-field adm-focusable w-full px-3 py-2 text-sm";

function ErrorBanner({ text }: { text: string }) {
  return (
    <div
      className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs"
      style={{ background: "var(--adm-alert-soft)", border: "1px solid var(--adm-alert)", color: "var(--adm-alert)" }}
    >
      <AlertCircle className="h-4 w-4 shrink-0" /> {text}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium" style={{ color: "var(--adm-text-dim)" }}>{label}</label>
      {children}
    </div>
  );
}

function ModulosField({
  modules, value, onChange,
}: {
  modules: string[];
  value: Record<string, boolean>;
  onChange: (v: Record<string, boolean>) => void;
}) {
  if (modules.length === 0) return null;

  return (
    <div className="space-y-3">
      <p className="flex items-center gap-1.5 text-xs font-medium" style={{ color: "var(--adm-text-dim)" }}>
        <Shield className="h-3.5 w-3.5" /> Módulos com acesso
      </p>
      {MODULE_GROUPS.map((group) => {
        const groupModules = group.keys.filter((k) => modules.includes(k));
        if (groupModules.length === 0) return null;
        return (
          <div key={group.label}>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--adm-text-faint)" }}>
              {group.label}
            </p>
            <div className="flex flex-wrap gap-3">
              {groupModules.map((k) => (
                <label key={k} className="flex cursor-pointer items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={value[k] ?? false}
                    onChange={() => onChange({ ...value, [k]: !value[k] })}
                    className="adm-focusable rounded"
                    style={{ accentColor: "var(--adm-accent)" }}
                  />
                  <span className="text-sm" style={{ color: "var(--adm-text)" }}>{MODULES_LABEL[k] ?? k}</span>
                </label>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function LojasField({
  lojas, value, onChange,
}: {
  lojas: LojaInfo[];
  value: string[];
  onChange: (v: string[]) => void;
}) {
  if (lojas.length <= 1) return null;
  const toggle = (id: string) =>
    onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  return (
    <div>
      <p className="mb-1 flex items-center gap-1.5 text-xs font-medium" style={{ color: "var(--adm-text-dim)" }}>
        <Building2 className="h-3.5 w-3.5" /> Lojas visíveis{" "}
        <span className="font-normal" style={{ color: "var(--adm-text-faint)" }}>(vazio = todas)</span>
      </p>
      <div className="flex flex-wrap gap-3">
        {lojas.map((l) => (
          <label key={l.id} className="flex cursor-pointer items-center gap-1.5">
            <input
              type="checkbox"
              checked={value.includes(l.id)}
              onChange={() => toggle(l.id)}
              className="adm-focusable rounded"
              style={{ accentColor: "var(--adm-accent)" }}
            />
            <span className="text-sm" style={{ color: "var(--adm-text)" }}>{l.name}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

function FormActions({
  loading, onCancel, labelSave,
}: {
  loading: boolean;
  onCancel: () => void;
  labelSave: string;
}) {
  return (
    <div className="flex justify-end gap-3">
      <AdminButton type="button" variant="ghost" size="sm" onClick={onCancel}>
        Cancelar
      </AdminButton>
      <AdminButton type="submit" size="sm" disabled={loading}>
        {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        {loading ? "Salvando..." : labelSave}
      </AdminButton>
    </div>
  );
}
