"use client";

import { useEffect, useState } from "react";
import { ServiceOrderList } from "@/components/os/ServiceOrderList";
import { RequireLoja } from "@/components/os/RequireLoja";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus } from "lucide-react";
import { serviceOrderService } from "@/lib/services/service-order-adapter";
import { useFiscalAuth } from "@/lib/fiscal-auth-context";
import type { OrdemServico } from "@/lib/fiscal-types";

export default function OrdensPage() {
  const { empresas, empresaAtiva, lojaAtiva, setEmpresaAtiva, setLojaAtiva } = useFiscalAuth();
  const [ordens, setOrdens] = useState<OrdemServico[]>([]);
  const [loading, setLoading] = useState(true);
  const [cliente, setCliente] = useState("");
  const [placa, setPlaca] = useState("");
  const [status, setStatus] = useState<string>("todas");

  useEffect(() => {
    if (!lojaAtiva) return;
    setLoading(true);
    serviceOrderService
      .list(lojaAtiva.id)
      .then(setOrdens)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [lojaAtiva?.id]);

  const filtradas = ordens.filter(
    (o) =>
      (cliente ? o.cliente.toLowerCase().includes(cliente.toLowerCase()) : true) &&
      (placa ? o.placa.toLowerCase().includes(placa.toLowerCase()) : true) &&
      (status !== "todas" ? o.status === status : true),
  );

  return (
    <RequireLoja>
      <div className="px-3 py-3 sm:px-4 md:px-5 md:py-4 space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Ordens de Serviço</h1>
            <p className="text-sm text-muted-foreground">
              Gerencie O.S e adicione itens com checagem fiscal.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {empresas.length > 1 && (
              <Select
                value={empresaAtiva?.id ?? ""}
                onValueChange={(id) => setEmpresaAtiva(id)}
              >
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Empresa" />
                </SelectTrigger>
                <SelectContent>
                  {empresas.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.nome_fantasia}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {(empresaAtiva?.lojas?.length ?? 0) > 1 && (
              <Select
                value={lojaAtiva?.id ?? ""}
                onValueChange={(id) => setLojaAtiva(id)}
              >
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
            <Button>
              <Plus className="mr-1 h-4 w-4" /> Nova O.S
            </Button>
          </div>
        </div>

        <div className="grid gap-3 rounded-lg border bg-card p-4 md:grid-cols-4">
          <Input
            placeholder="Cliente"
            value={cliente}
            onChange={(e) => setCliente(e.target.value)}
          />
          <Input
            placeholder="Placa"
            value={placa}
            onChange={(e) => setPlaca(e.target.value)}
          />
          <div />
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger>
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todos os status</SelectItem>
              <SelectItem value="aberta">Aberta</SelectItem>
              <SelectItem value="faturada">Faturada</SelectItem>
              <SelectItem value="cancelada">Cancelada</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {loading ? (
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
              {Array.from({ length: 7 }).map((_, i) => (
                <div key={i} className="h-12 animate-pulse rounded-md bg-muted" />
              ))}
            </div>
          </div>
        ) : (
          <>
            {ordens.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {filtradas.length === ordens.length
                  ? `${ordens.length} ordens`
                  : `${filtradas.length} de ${ordens.length} ordens`}
              </p>
            )}
            <ServiceOrderList ordens={filtradas} />
          </>
        )}
      </div>
    </RequireLoja>
  );
}
