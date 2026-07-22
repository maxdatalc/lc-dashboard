"use client";

import { useEffect, useState } from "react";
import { ServiceOrderList } from "@/components/os/ServiceOrderList";
import { RequireLoja } from "@/components/os/RequireLoja";
import { OSHelpDialog } from "@/components/os/OSHelpDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Search, SlidersHorizontal } from "lucide-react";
import { serviceOrderService } from "@/lib/services/service-order-adapter";
import { useFiscalAuth } from "@/lib/fiscal-auth-context";
import type { OrdemServico, TipoAtendimento } from "@/lib/fiscal-types";

const STATUS_TABS = [
  { value: "todas", label: "Todas" },
  { value: "aberta", label: "Em aberto" },
  { value: "faturada", label: "Concluídas" },
  { value: "cancelada", label: "Canceladas" },
] as const;

export default function OrdensPage() {
  const { empresaAtiva, lojaAtiva, setLojaAtiva } = useFiscalAuth();

  const [ordens, setOrdens] = useState<OrdemServico[]>([]);
  const [tipos, setTipos] = useState<TipoAtendimento[]>([]);
  const [loading, setLoading] = useState(false);
  const [buscou, setBuscou] = useState(false);

  const [statusFilter, setStatusFilter] = useState("todas");
  const [osNum, setOsNum] = useState("");
  const [cliente, setCliente] = useState("");
  const [placa, setPlaca] = useState("");
  const [tipoAtend, setTipoAtend] = useState("0");
  const [marca, setMarca] = useState("");
  const [prisma, setPrisma] = useState("");
  const [dtAbertIni, setDtAbertIni] = useState("");
  const [dtAbertFim, setDtAbertFim] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  const lojaId = lojaAtiva?.id;

  useEffect(() => {
    if (!lojaId) return;
    serviceOrderService.listTipos(lojaId).then(setTipos).catch(console.error);
  }, [lojaId]);

  const buildFilters = (overrideStatus?: string) => ({
    status: overrideStatus ?? statusFilter,
    osNum: osNum ? parseInt(osNum, 10) : undefined,
    cliente: cliente.trim() || undefined,
    placa: placa.trim() || undefined,
    tipoAtend: parseInt(tipoAtend, 10) || undefined,
    marca: marca.trim() || undefined,
    prisma: prisma.trim() || undefined,
    dtAbertIni: dtAbertIni || undefined,
    dtAbertFim: dtAbertFim || undefined,
  });

  const handleSearch = async (overrideStatus?: string) => {
    if (!lojaId) return;
    setLoading(true);
    setBuscou(true);
    try {
      const data = await serviceOrderService.list(lojaId, buildFilters(overrideStatus));
      setOrdens(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusTab = (s: string) => {
    setStatusFilter(s);
    void handleSearch(s);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") void handleSearch();
  };

  const hasAdvancedFilter =
    marca.trim() || prisma.trim() || dtAbertIni || dtAbertFim;

  return (
    <RequireLoja>
      <div className="px-3 py-3 sm:px-4 md:px-5 md:py-4 space-y-4">

        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold">Ordens de Serviço</h1>
              <OSHelpDialog />
            </div>
            <p className="text-sm text-muted-foreground">
              Pesquise e gerencie as O.S com checagem fiscal.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {(empresaAtiva?.lojas?.length ?? 0) > 1 && (
              <Select value={lojaAtiva?.id ?? ""} onValueChange={setLojaAtiva}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Loja" />
                </SelectTrigger>
                <SelectContent>
                  {empresaAtiva?.lojas.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button disabled>
              <Plus className="mr-1 h-4 w-4" /> Nova O.S
            </Button>
          </div>
        </div>

        {/* Filter panel */}
        <div className="rounded-lg border bg-card p-4 space-y-3">

          {/* Status tabs */}
          <div className="flex gap-1 rounded-md border bg-muted/30 p-1">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => handleStatusTab(tab.value)}
                className={[
                  "flex-1 rounded px-3 py-1.5 text-sm font-medium transition-colors",
                  statusFilter === tab.value
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                ].join(" ")}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Primary search row */}
          <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-6">
            <Input
              placeholder="N.O.S"
              type="number"
              value={osNum}
              onChange={(e) => setOsNum(e.target.value)}
              onKeyDown={handleKeyDown}
              className="md:col-span-1"
            />
            <Input
              placeholder="Cliente"
              value={cliente}
              onChange={(e) => setCliente(e.target.value)}
              onKeyDown={handleKeyDown}
              className="md:col-span-2"
            />
            <Input
              placeholder="Placa"
              value={placa}
              onChange={(e) => setPlaca(e.target.value.toUpperCase())}
              onKeyDown={handleKeyDown}
              className="font-mono md:col-span-1"
            />
            <Select value={tipoAtend} onValueChange={setTipoAtend}>
              <SelectTrigger className="md:col-span-1">
                <SelectValue placeholder="Tipo Atendimento" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Todos os tipos</SelectItem>
                {tipos.map((t) => (
                  <SelectItem key={t.tatId} value={String(t.tatId)}>
                    {t.tatDesc}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={() => handleSearch()} disabled={loading} className="md:col-span-1">
              <Search className="mr-1.5 h-4 w-4" />
              Buscar
            </Button>
          </div>

          {/* Advanced filters toggle */}
          <button
            onClick={() => setShowAdvanced((v) => !v)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Filtros avançados
            {hasAdvancedFilter && (
              <span className="ml-1 rounded-full bg-primary px-1.5 py-0.5 text-[10px] text-primary-foreground leading-none">
                {[marca, prisma, dtAbertIni, dtAbertFim].filter(Boolean).length}
              </span>
            )}
            <span className="ml-0.5">{showAdvanced ? "▴" : "▾"}</span>
          </button>

          {showAdvanced && (
            <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-4 border-t pt-3">
              <div className="flex gap-2 items-center md:col-span-2">
                <label className="shrink-0 text-xs text-muted-foreground">Abertura</label>
                <Input
                  type="date"
                  value={dtAbertIni}
                  onChange={(e) => setDtAbertIni(e.target.value)}
                  className="text-sm"
                />
                <span className="text-xs text-muted-foreground">até</span>
                <Input
                  type="date"
                  value={dtAbertFim}
                  onChange={(e) => setDtAbertFim(e.target.value)}
                  className="text-sm"
                />
              </div>
              <Input
                placeholder="Marca"
                value={marca}
                onChange={(e) => setMarca(e.target.value)}
                onKeyDown={handleKeyDown}
              />
              <Input
                placeholder="Prisma"
                value={prisma}
                onChange={(e) => setPrisma(e.target.value)}
                onKeyDown={handleKeyDown}
              />
            </div>
          )}
        </div>

        {/* Result count */}
        {buscou && !loading && (
          <p className="text-xs text-muted-foreground">
            {ordens.length === 0
              ? "Nenhuma O.S encontrada."
              : ordens.length === 200
              ? "200 ordens (limite atingido — refine os filtros para ver mais)"
              : `${ordens.length} ${ordens.length === 1 ? "ordem" : "ordens"}`}
          </p>
        )}

        {/* Loading skeleton */}
        {loading && (
          <div className="space-y-4">
            <div className="rounded-lg border bg-card px-4 py-3 shadow-sm">
              <div className="mb-2 flex items-center gap-2">
                <div className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                <span className="text-sm font-medium">Consultando banco de dados...</span>
              </div>
              <div className="relative h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="absolute h-full w-1/3 rounded-full bg-primary"
                  style={{ animation: "consulta-slide 1.4s ease-in-out infinite" }}
                />
              </div>
            </div>
            <div className="space-y-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-12 animate-pulse rounded-md bg-muted" />
              ))}
            </div>
          </div>
        )}

        {/* Table */}
        {!loading && buscou && <ServiceOrderList ordens={ordens} />}

        {/* Initial state */}
        {!loading && !buscou && (
          <div className="flex flex-col items-center justify-center rounded-md border border-dashed bg-card py-16 text-center">
            <Search className="mb-3 h-8 w-8 text-muted-foreground/30" />
            <p className="text-sm font-medium text-muted-foreground">
              Use os filtros acima e clique em Buscar
            </p>
            <p className="mt-1 text-xs text-muted-foreground/60">
              Os resultados são limitados a 200 registros por consulta.
            </p>
          </div>
        )}
      </div>
    </RequireLoja>
  );
}
