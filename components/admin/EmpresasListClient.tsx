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
              <AdminTh hideBelow="md">Lojas / Usuários</AdminTh>
              <AdminTh hideBelow="sm">Plano</AdminTh>
              <AdminTh hideBelow="md">Cadastrado em</AdminTh>
              <AdminTh />
            </AdminTableHead>
            <AdminTBody>
              {filtered.map((t, i) => (
                <AdminTr key={t.id} noBorder={i === 0}>
                  {/* Empresa — nome em destaque, slug discreto, status como dot+label */}
                  <AdminTd>
                    <div className="text-[15px] font-semibold leading-tight">{t.name}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <span className="adm-mono text-xs" style={{ color: "var(--adm-text-faint)" }}>
                        {t.slug}
                      </span>
                      <span style={{ color: "var(--adm-line-strong)" }}>·</span>
                      <AdminStatusDot active={t.isActive} />
                      {/* Resumo só no mobile — a coluna Plano fica oculta abaixo de sm */}
                      <span className="sm:hidden">
                        {t.plan === "premium" ? (
                          <AdminBadge variant="premium">★ Premium</AdminBadge>
                        ) : (
                          <AdminBadge variant="neutral">Free</AdminBadge>
                        )}
                      </span>
                    </div>
                  </AdminTd>

                  {/* Lojas / Usuários */}
                  <AdminTd hideBelow="md">
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
                  <AdminTd hideBelow="sm">
                    {t.plan === "premium" ? (
                      <AdminBadge variant="premium">★ Premium</AdminBadge>
                    ) : (
                      <AdminBadge variant="neutral">Free</AdminBadge>
                    )}
                  </AdminTd>

                  {/* Criado em */}
                  <AdminTd hideBelow="md" className="adm-mono text-xs" style={{ color: "var(--adm-text-faint)" }}>
                    {formatarData(t.createdAt)}
                  </AdminTd>

                  {/* Ações — no mobile só "Gerenciar"; Dashboard/Excluir exigem tela maior (evita cell largo demais) */}
                  <AdminTd align="right">
                    <div className="flex items-center justify-end gap-1.5 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100">
                      {isAdmin && acessarDashboard && (
                        <form action={acessarDashboard} className="hidden sm:block">
                          <input type="hidden" name="tenantId" value={t.id} />
                          <AdminButton type="submit" variant="subtle" size="sm" title={`Acessar dashboard de ${t.name}`}>
                            <LayoutDashboard className="h-3.5 w-3.5" />
                            Dashboard
                          </AdminButton>
                        </form>
                      )}

                      {isAdmin && (
                        <span className="hidden sm:inline-flex">
                          <BotaoExcluirCliente tenantId={t.id} tenantName={t.name} />
                        </span>
                      )}

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
