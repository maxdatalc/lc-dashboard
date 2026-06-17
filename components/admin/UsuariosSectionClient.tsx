"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2, UserPlus, AlertCircle, ChevronDown, ChevronUp,
  Download, User, CheckCircle2, Shield, Building2,
} from "lucide-react";
import { salvarUsuarioERP, salvarAcessoUsuario } from "@/lib/actions/admin-lojas";
import type { UsuarioTenantCompleto, ErpMapping } from "@/lib/db/admin";
import type { ErpUserItem } from "@/app/api/admin/erp-users/route";

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
}

const MODULES_LABEL: Record<string, string> = {
  dashboard_visao_geral: "Dashboard",
  modulo_os:            "O.S",
  modulo_financeiro:    "Financeiro",
  modulo_produtos:      "Produtos",
};

const ROLE_LABEL: Record<string, string> = {
  owner:  "Proprietário",
  admin:  "Admin",
  viewer: "Viewer",
};

const ROLE_CLS: Record<string, string> = {
  owner:  "bg-amber-100 text-amber-700",
  admin:  "bg-purple-100 text-purple-700",
  viewer: "bg-slate-100 text-slate-600",
};

// ── Componente principal ─────────────────────────────────────────────────────

export function UsuariosSectionClient({ tenantId, usuarios, lojas, tenantFeatures }: Props) {
  const router = useRouter();
  const [painel, setPainel] = useState<"none" | "add-manual" | "add-erp">("none");
  const [editUserId, setEditUserId] = useState<string | null>(null);

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

  return (
    <div className="space-y-4">
      {/* Cabeçalho */}
      <div className="flex justify-between items-center">
        <p className="text-sm text-slate-600">
          {usuarios.length} {usuarios.length === 1 ? "usuário vinculado" : "usuários vinculados"}
        </p>
        <div className="flex items-center gap-2">
          {painel === "none" && (
            <>
              {bridgeLojas.length > 0 && (
                <button
                  onClick={() => setPainel("add-erp")}
                  className="inline-flex items-center gap-1.5 text-sm border border-slate-300 text-slate-600 px-3 py-1.5 rounded-md hover:bg-slate-50 transition-colors"
                >
                  <Download className="h-3.5 w-3.5" />
                  Importar do ERP
                </button>
              )}
              <button
                onClick={() => setPainel("add-manual")}
                className="inline-flex items-center gap-1.5 text-sm bg-slate-900 text-white px-3 py-1.5 rounded-md hover:bg-slate-700 transition-colors"
              >
                <UserPlus className="h-3.5 w-3.5" />
                Adicionar Usuário
              </button>
            </>
          )}
          {painel !== "none" && (
            <button
              onClick={fecharPainel}
              className="text-sm text-slate-500 hover:text-slate-700 px-3 py-1.5 transition-colors"
            >
              Cancelar
            </button>
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
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        {usuarios.length === 0 ? (
          <div className="py-10 text-center text-sm text-slate-400">
            Nenhum usuário vinculado a este tenant.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {usuarios.map((u) => (
              <UsuarioRow
                key={u.id}
                usuario={u}
                tenantId={tenantId}
                lojas={lojas}
                configurableModules={configurableModules}
                expanded={editUserId === u.userId}
                onToggle={() => setEditUserId(editUserId === u.userId ? null : u.userId)}
                onSaved={refresh}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Linha de usuário com painel expansível ────────────────────────────────────

function UsuarioRow({
  usuario, tenantId, lojas, configurableModules, expanded, onToggle, onSaved,
}: {
  usuario: UsuarioTenantCompleto;
  tenantId: string;
  lojas: LojaInfo[];
  configurableModules: string[];
  expanded: boolean;
  onToggle: () => void;
  onSaved: () => void;
}) {
  const activeModules = Object.entries(usuario.settings?.modulos ?? {})
    .filter(([, v]) => v)
    .map(([k]) => k)
    .filter((k) => k in MODULES_LABEL);

  return (
    <div>
      <div
        className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 cursor-pointer"
        onClick={onToggle}
      >
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-900 truncate">
            {usuario.fullName || "—"}
          </p>
          <p className="text-xs text-slate-500 truncate">{usuario.email || "—"}</p>
        </div>

        <span className={`shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_CLS[usuario.role] ?? ROLE_CLS.viewer}`}>
          {ROLE_LABEL[usuario.role] ?? usuario.role}
        </span>

        {activeModules.length > 0 ? (
          <div className="hidden sm:flex gap-1 shrink-0">
            {activeModules.map((k) => (
              <span key={k} className="inline-flex items-center rounded px-1.5 py-0.5 text-xs bg-blue-50 text-blue-700 border border-blue-100">
                {MODULES_LABEL[k]}
              </span>
            ))}
          </div>
        ) : (
          <span className="hidden sm:inline text-xs text-slate-400">Sem módulos</span>
        )}

        {usuario.erpMappings.length > 0 && (
          <span className="hidden sm:inline-flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded px-1.5 py-0.5">
            <CheckCircle2 className="h-3 w-3" /> ERP
          </span>
        )}

        {expanded ? (
          <ChevronUp className="h-4 w-4 text-slate-400 shrink-0" />
        ) : (
          <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
        )}
      </div>

      {expanded && (
        <UsuarioEditPanel
          usuario={usuario}
          tenantId={tenantId}
          lojas={lojas}
          configurableModules={configurableModules}
          onSaved={onSaved}
        />
      )}
    </div>
  );
}

// ── Painel de edição de usuário ───────────────────────────────────────────────

function UsuarioEditPanel({
  usuario, tenantId, lojas, configurableModules, onSaved,
}: {
  usuario: UsuarioTenantCompleto;
  tenantId: string;
  lojas: LojaInfo[];
  configurableModules: string[];
  onSaved: () => void;
}) {
  const currentModulos = usuario.settings?.modulos ?? {};
  const currentLojaIds = usuario.settings?.lojaIds ?? [];

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
    const result = await salvarAcessoUsuario(tenantId, usuario.userId, { lojaIds, modulos });
    setLoading(false);
    if (result.error) { setErro(result.error); return; }
    onSaved();
  };

  return (
    <div className="border-t border-slate-100 bg-slate-50 px-4 py-4 space-y-4">
      {erro && (
        <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
          <AlertCircle className="h-4 w-4 shrink-0" /> {erro}
        </div>
      )}

      {/* Módulos */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2 flex items-center gap-1.5">
          <Shield className="h-3.5 w-3.5" /> Módulos
        </p>
        {configurableModules.length === 0 ? (
          <p className="text-xs text-slate-400">Nenhum módulo habilitado no tenant.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {configurableModules.map((k) => (
              <label key={k} className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={modulos[k] ?? false}
                  onChange={() => toggleModulo(k)}
                  className="rounded border-slate-300 text-slate-800"
                />
                <span className="text-sm text-slate-700">{MODULES_LABEL[k] ?? k}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Lojas com acesso */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2 flex items-center gap-1.5">
          <Building2 className="h-3.5 w-3.5" /> Lojas visíveis{" "}
          <span className="font-normal normal-case tracking-normal text-slate-400">
            (vazio = todas)
          </span>
        </p>
        <div className="flex flex-wrap gap-2">
          {lojas.map((l) => (
            <label key={l.id} className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={lojaIds.includes(l.id)}
                onChange={() => toggleLoja(l.id)}
                className="rounded border-slate-300 text-slate-800"
              />
              <span className="text-sm text-slate-700">{l.name}</span>
            </label>
          ))}
        </div>
      </div>

      {/* ERP mappings (leitura) */}
      {usuario.erpMappings.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2 flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5" /> Vínculo ERP
          </p>
          <div className="space-y-1">
            {usuario.erpMappings.map((m) => (
              <ERPMappingBadge key={m.lojaId} mapping={m} />
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
        <button
          onClick={handleSave}
          disabled={loading}
          className="inline-flex items-center gap-2 bg-slate-900 text-white px-4 py-1.5 rounded-md text-sm hover:bg-slate-700 disabled:opacity-60 transition-colors"
        >
          {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {loading ? "Salvando..." : "Salvar acesso"}
        </button>
      </div>
    </div>
  );
}

function ERPMappingBadge({ mapping }: { mapping: ErpMapping }) {
  return (
    <div className="flex items-center gap-2 text-xs bg-white border border-slate-200 rounded px-2.5 py-1.5">
      <span className="font-medium text-slate-700">{mapping.lojaNome}</span>
      <span className="text-slate-400">·</span>
      <span className="text-slate-600">{mapping.cliNome}</span>
      <span className="text-slate-400">·</span>
      <span className="font-mono text-slate-400">#{mapping.cliId}</span>
      {mapping.tiposBloqueados.length > 0 && (
        <>
          <span className="text-slate-400">·</span>
          <span className="text-amber-600">
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
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
      <h3 className="text-sm font-semibold text-slate-800">Novo Usuário</h3>

      {erro && (
        <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
          <AlertCircle className="h-4 w-4 shrink-0" /> {erro}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
            <option value="viewer">Visualizador</option>
            <option value="admin">Administrador</option>
            <option value="owner">Proprietário</option>
          </select>
        </Field>
      </div>

      <ModulosField modules={configurableModules} value={modulos} onChange={setModulos} />
      <LojasField lojas={lojas} value={lojaIds} onChange={setLojaIds} />

      <FormActions loading={loading} onCancel={onCancel} labelSave="Criar Usuário" />
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
      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
        <h3 className="text-sm font-semibold text-slate-800">Selecionar Usuário ERP</h3>

        {loadingUsers && (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Buscando usuários...
          </div>
        )}

        {erroUsers && (
          <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
            <AlertCircle className="h-4 w-4 shrink-0" /> {erroUsers}
          </div>
        )}

        {!loadingUsers && erpUsers.length === 0 && !erroUsers && (
          <p className="text-sm text-slate-400">
            Nenhum usuário com <code className="text-xs">cliUsuarioUsaSistema = 1</code> encontrado.
          </p>
        )}

        {erpUsers.length > 0 && (
          <div className="divide-y divide-slate-100 rounded-lg border border-slate-200 overflow-hidden max-h-72 overflow-y-auto">
            {erpUsers.map((u) => (
              <button
                key={u.cliId}
                onClick={() => { setSelected(u); setStep("confirm"); }}
                className="w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors flex items-center gap-3"
              >
                <User className="h-4 w-4 text-slate-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">{u.cliNome}</p>
                  <p className="text-xs text-slate-500">
                    {u.cliEmail || "Sem email"}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <button onClick={onCancel} className="text-sm text-slate-500 hover:text-slate-700">Cancelar</button>
        </div>
      </div>
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
  // Auto-seleciona as lojas cujo empId corresponde ao empId padrão do usuário no ERP
  const autoLojas = allLojas
    .filter((l) => erpUser.cliUsuEmpIdPadrao != null && l.empId === erpUser.cliUsuEmpIdPadrao)
    .map((l) => l.id);
  const [lojaIds, setLojaIds] = useState<string[]>(autoLojas);
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
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <h3 className="text-sm font-semibold text-slate-800">Confirmar usuário ERP</h3>
        <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-100 rounded px-2 py-0.5 font-mono">
          cliId {erpUser.cliId}
        </span>
        {erpUser.cliUsuEmpIdPadrao != null && (
          <span className="text-xs bg-blue-50 text-blue-700 border border-blue-100 rounded px-2 py-0.5 font-mono">
            empId {erpUser.cliUsuEmpIdPadrao}
          </span>
        )}
      </div>

      {erro && (
        <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
          <AlertCircle className="h-4 w-4 shrink-0" /> {erro}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
            <option value="viewer">Visualizador</option>
            <option value="admin">Administrador</option>
            <option value="owner">Proprietário</option>
          </select>
        </Field>
      </div>

      <ModulosField modules={configurableModules} value={modulos} onChange={setModulos} />
      <LojasField lojas={allLojas} value={lojaIds} onChange={setLojaIds} />

      <div className="flex justify-between items-center pt-2 border-t border-slate-100">
        <button type="button" onClick={onBack} className="text-sm text-slate-500 hover:text-slate-700">
          ← Voltar
        </button>
        <FormActions loading={loading} onCancel={onCancel} labelSave="Salvar usuário" />
      </div>
    </form>
  );
}

// ── Helpers de UI ─────────────────────────────────────────────────────────────

const inputCls =
  "w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
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
    <div>
      <p className="text-xs font-medium text-slate-600 mb-2 flex items-center gap-1.5">
        <Shield className="h-3.5 w-3.5" /> Módulos com acesso
      </p>
      <div className="flex flex-wrap gap-3">
        {modules.map((k) => (
          <label key={k} className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={value[k] ?? false}
              onChange={() => onChange({ ...value, [k]: !value[k] })}
              className="rounded border-slate-300 text-slate-800"
            />
            <span className="text-sm text-slate-700">{MODULES_LABEL[k] ?? k}</span>
          </label>
        ))}
      </div>
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
      <p className="text-xs font-medium text-slate-600 mb-1 flex items-center gap-1.5">
        <Building2 className="h-3.5 w-3.5" /> Lojas visíveis{" "}
        <span className="font-normal text-slate-400">(vazio = todas)</span>
      </p>
      <div className="flex flex-wrap gap-3">
        {lojas.map((l) => (
          <label key={l.id} className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={value.includes(l.id)}
              onChange={() => toggle(l.id)}
              className="rounded border-slate-300 text-slate-800"
            />
            <span className="text-sm text-slate-700">{l.name}</span>
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
      <button
        type="button"
        onClick={onCancel}
        className="text-sm text-slate-500 hover:text-slate-700 px-4 py-2 transition-colors"
      >
        Cancelar
      </button>
      <button
        type="submit"
        disabled={loading}
        className="inline-flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-lg text-sm hover:bg-slate-700 disabled:opacity-60 transition-colors"
      >
        {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        {loading ? "Salvando..." : labelSave}
      </button>
    </div>
  );
}
