"use client";

import { useState } from "react";
import Link from "next/link";
import { Building2, Users, LayoutDashboard, Search } from "lucide-react";
import { BotaoExcluirCliente } from "@/components/admin/botao-excluir-cliente";
import { AdminBadge, AdminStatusDot } from "@/components/admin/AdminBadge";
import { AdminButton } from "@/components/admin/AdminButton";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import {
  AdminTable,
  AdminTableHead,
  AdminTh,
  AdminTBody,
  AdminTr,
  AdminTd,
} from "@/components/admin/AdminTable";

type Loja = { id: string; sqlEnabled: boolean; isActive: boolean; empId: number; name: string };

type Tenant = {
  id: string;
  name: string;
  slug: string;
  plan: "free" | "premium";
  lojas: Loja[];
  totalUsuarios: number;
  isActive: boolean;
  createdAt: string;
  features: string[];
};

function formatarData(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("pt-BR");
}

export function EmpresasListClient({
  tenants,
  acessarDashboard,
  isAdmin,
}: {
  tenants: Tenant[];
  acessarDashboard?: (formData: FormData) => Promise<void>;
  isAdmin: boolean;
}) {
  const [busca, setBusca] = useState("");

  const filtered = busca.trim()
    ? tenants.filter(
        (t) =>
          t.name.toLowerCase().includes(busca.toLowerCase()) ||
          t.slug.toLowerCase().includes(busca.toLowerCase())
      )
    : tenants;

  return (
    <div className="space-y-4">
      {/* Busca */}
      <div
        className="adm-rise relative"
        style={{ animationDelay: "50ms" }}
      >
        <Search
          className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2"
          style={{ color: "var(--adm-text-faint)" }}
        />
        <input
          type="text"
          placeholder="Buscar por nome ou slug…"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="adm-field adm-focusable w-full py-2.5 pl-10 pr-4 text-sm"
        />
      </div>

      {/* Tabela */}
      {filtered.length === 0 ? (
        <div
          className="adm-rise rounded-xl"
          style={{
            animationDelay: "80ms",
            background: "var(--adm-surface)",
            border: "1px solid var(--adm-line)",
          }}
        >
          <AdminEmptyState
            icon={Building2}
            title={busca ? `Nenhuma empresa encontrada para "${busca}"` : "Nenhuma empresa cadastrada"}
            description={!busca && isAdmin ? 'Clique em "+ Novo Grupo" para começar.' : undefined}
          />
        </div>
      ) : (
        <div className="adm-rise space-y-2" style={{ animationDelay: "80ms" }}>
          <AdminTable>
            <AdminTableHead>
              <AdminTh>Empresa</AdminTh>
              <AdminTh>Lojas / Usuários</AdminTh>
              <AdminTh>Plano</AdminTh>
              <AdminTh>Cadastrado em</AdminTh>
              <AdminTh />
            </AdminTableHead>
            <AdminTBody>
              {filtered.map((t, i) => (
                <AdminTr key={t.id} noBorder={i === 0}>
                  {/* Empresa — nome em destaque, slug discreto, status como dot+label */}
                  <AdminTd>
                    <div className="text-[15px] font-semibold leading-tight">{t.name}</div>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="adm-mono text-xs" style={{ color: "var(--adm-text-faint)" }}>
                        {t.slug}
                      </span>
                      <span style={{ color: "var(--adm-line-strong)" }}>·</span>
                      <AdminStatusDot active={t.isActive} />
                    </div>
                  </AdminTd>

                  {/* Lojas / Usuários */}
                  <AdminTd>
                    <div className="flex items-center gap-4">
                      <span className="flex items-center gap-1.5 text-xs" style={{ color: "var(--adm-text-dim)" }}>
                        <Building2 className="h-3.5 w-3.5" style={{ color: "var(--adm-text-faint)" }} />
                        <span className="adm-mono font-semibold" style={{ color: "var(--adm-text)" }}>
                          {t.lojas.length}
                        </span>
                      </span>
                      <span className="flex items-center gap-1.5 text-xs" style={{ color: "var(--adm-text-dim)" }}>
                        <Users className="h-3.5 w-3.5" style={{ color: "var(--adm-text-faint)" }} />
                        <span className="adm-mono font-semibold" style={{ color: "var(--adm-text)" }}>
                          {t.totalUsuarios}
                        </span>
                      </span>
                    </div>
                  </AdminTd>

                  {/* Plano */}
                  <AdminTd>
                    {t.plan === "premium" ? (
                      <AdminBadge variant="premium">★ Premium</AdminBadge>
                    ) : (
                      <AdminBadge variant="neutral">Free</AdminBadge>
                    )}
                  </AdminTd>

                  {/* Criado em */}
                  <AdminTd className="adm-mono text-xs" style={{ color: "var(--adm-text-faint)" }}>
                    {formatarData(t.createdAt)}
                  </AdminTd>

                  {/* Ações — discretas, aparecem no hover da linha */}
                  <AdminTd align="right">
                    <div className="flex items-center justify-end gap-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                      {isAdmin && acessarDashboard && (
                        <form action={acessarDashboard}>
                          <input type="hidden" name="tenantId" value={t.id} />
                          <AdminButton type="submit" variant="subtle" size="sm" title={`Acessar dashboard de ${t.name}`}>
                            <LayoutDashboard className="h-3.5 w-3.5" />
                            Dashboard
                          </AdminButton>
                        </form>
                      )}

                      {isAdmin && <BotaoExcluirCliente tenantId={t.id} tenantName={t.name} />}

                      <AdminButton href={`/admin/empresas/${t.id}`} size="sm">
                        {isAdmin ? "Gerenciar →" : "Ver detalhes →"}
                      </AdminButton>
                    </div>
                  </AdminTd>
                </AdminTr>
              ))}
            </AdminTBody>
          </AdminTable>

          {busca && (
            <p className="px-1 text-xs" style={{ color: "var(--adm-text-faint)" }}>
              {filtered.length} de {tenants.length} {tenants.length === 1 ? "empresa" : "empresas"}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
