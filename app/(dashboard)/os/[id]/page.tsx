"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { RequireLoja } from "@/components/os/RequireLoja";
import { ServiceOrderItemEditor } from "@/components/os/ServiceOrderItemEditor";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { serviceOrderService } from "@/lib/services/service-order-adapter";
import { useFiscalAuth } from "@/lib/fiscal-auth-context";
import type { OrdemServico } from "@/lib/fiscal-types";

const statusLabel: Record<OrdemServico["status"], { label: string; cls: string }> = {
  aberta: { label: "Aberta", cls: "bg-primary/10 text-primary border-primary/20" },
  em_andamento: {
    label: "Em andamento",
    cls: "bg-[color:var(--warning)]/15 text-[color:oklch(0.5_0.15_70)] border-[color:var(--warning)]/30",
  },
  faturada: {
    label: "Faturada",
    cls: "bg-[color:var(--success)]/15 text-[color:var(--success)] border-[color:var(--success)]/30",
  },
  cancelada: { label: "Cancelada", cls: "bg-muted text-muted-foreground border-border" },
};

export default function OSDetailPage() {
  return (
    <RequireLoja>
      <OSDetailContent />
    </RequireLoja>
  );
}

function OSDetailContent() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { lojaAtiva } = useFiscalAuth();
  const [os, setOs] = useState<OrdemServico | null>(null);
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  const [pendingItems, setPendingItems] = useState<Array<{
    tempId: string;
    produtoId: string; produtoNome: string; descricao: string;
    codigo: string; quantidade: number; precoUnitario: number;
  }>>([]);
  const [savingPendentes, setSavingPendentes] = useState(false);
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null);

  useEffect(() => {
    if (!lojaAtiva) return;
    setLoading(true);
    serviceOrderService
      .get(id, lojaAtiva.id)
      .then((r) => {
        setOs(r);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id, lojaAtiva?.id, reload]);

  if (loading) {
    return (
      <div className="px-3 py-3 sm:px-4 md:px-5 md:py-4 space-y-4">
        <div className="rounded-lg border bg-card px-4 py-3 shadow-sm">
          <div className="mb-2 flex items-center gap-2">
            <div className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <span className="text-sm font-medium">Consultando O.S...</span>
          </div>
          <div className="relative h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="absolute h-full w-1/3 rounded-full bg-primary"
              style={{ animation: "consulta-slide 1.4s ease-in-out infinite" }}
            />
          </div>
        </div>
        <div className="space-y-3">
          <div className="h-8 w-64 animate-pulse rounded bg-muted" />
          <div className="h-4 w-96 animate-pulse rounded bg-muted" />
          <div className="h-40 w-full animate-pulse rounded bg-muted" />
        </div>
      </div>
    );
  }

  if (!os) {
    return (
      <div className="px-3 py-3 sm:px-4 md:px-5 md:py-4 space-y-4">
        <Button variant="ghost" size="sm" onClick={() => router.back()} className="-ml-3">
          <ChevronLeft className="mr-1 h-4 w-4" /> Voltar
        </Button>
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-sm font-medium">Ordem de serviço não encontrada</p>
            <p className="mt-1 text-xs text-muted-foreground">
              O.S #{id} não existe nesta loja ou foi excluída.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const addPending = (item: { produtoId: string; produtoNome: string; descricao: string; codigo: string; quantidade: number; precoUnitario: number }) => {
    setPendingItems((prev) => [...prev, { ...item, tempId: Math.random().toString(36).slice(2) }]);
  };

  const removePending = (tempId: string) => {
    setPendingItems((prev) => prev.filter((p) => p.tempId !== tempId));
  };

  const deleteItem = async (itemId: string) => {
    if (!lojaAtiva || !os || deletingItemId) return;
    setDeletingItemId(itemId);
    try {
      await serviceOrderService.removeItem(lojaAtiva.id, os.id, itemId);
      toast.success("Item removido da O.S.");
      setReload((x) => x + 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao remover item.");
    } finally {
      setDeletingItemId(null);
    }
  };

  const salvarPendentes = async () => {
    if (!lojaAtiva || !os || pendingItems.length === 0) return;
    setSavingPendentes(true);
    try {
      for (const item of pendingItems) {
        const r = await serviceOrderService.addItem({
          loja_id: lojaAtiva.id,
          os_id: os.id,
          produto_id: item.produtoId,
          descricao: item.descricao,
          quantidade: item.quantidade,
          valor_unitario: item.precoUnitario,
          tipo_atend_id: os.tipoAtendId,
          forcar_sem_fiscal: true,
        });
        if (!r.ok && !r.excedeu_fiscal) {
          toast.error(r.alerta ?? "Erro ao salvar item.");
          return;
        }
      }
      toast.success(`${pendingItems.length} item(s) adicionado(s) à O.S.`);
      setPendingItems([]);
      setReload((x) => x + 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao salvar itens.");
    } finally {
      setSavingPendentes(false);
    }
  };

  const s = statusLabel[os.status] ?? statusLabel.aberta;
  const produtos = os.itens.filter((it) => it.tipo !== "S");
  const servicos = os.itens.filter((it) => it.tipo === "S");
  const totalProdutos = produtos.reduce((acc, it) => acc + (it.total ?? 0), 0);
  const totalServicos = servicos.reduce((acc, it) => acc + (it.total ?? 0), 0);

  return (
    <div className="px-3 py-3 sm:px-4 md:px-5 md:py-4 space-y-6">
      <Button variant="ghost" size="sm" onClick={() => router.back()} className="-ml-3">
        <ChevronLeft className="mr-1 h-4 w-4" /> Voltar
      </Button>

      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold">O.S {os.numero}</h1>
            <Badge variant="outline" className={s.cls}>
              {s.label}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Cliente <span className="font-medium text-foreground">{os.cliente}</span>
            {os.placa && (
              <>
                {" "}• Placa <span className="font-mono text-foreground">{os.placa}</span>
              </>
            )}
            {(os.equipamento || os.marca) && (
              <>
                {" "}•{" "}
                <span className="text-foreground">
                  {[os.marca, os.equipamento].filter(Boolean).join(" ")}
                </span>
              </>
            )}
            {" "}• {new Date(os.data).toLocaleDateString("pt-BR")}
          </p>
        </div>
      </div>

      {(os.defeito || os.obs || os.laudoTec || os.equipamento || os.marca) && (
        <Card>
          <CardContent className="grid gap-4 pt-4 sm:grid-cols-2 lg:grid-cols-4">
            {(os.equipamento || os.marca) && (
              <div>
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Equipamento
                </p>
                <p className="text-sm font-medium">
                  {[os.marca, os.equipamento].filter(Boolean).join(" — ")}
                </p>
              </div>
            )}
            {os.defeito && (
              <div>
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Defeito reclamado
                </p>
                <p className="text-sm">{os.defeito}</p>
              </div>
            )}
            {os.laudoTec && (
              <div>
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Laudo técnico
                </p>
                <p className="text-sm">{os.laudoTec}</p>
              </div>
            )}
            {os.obs && (
              <div className="sm:col-span-2 lg:col-span-1">
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Observações
                </p>
                <p className="max-h-24 overflow-y-auto whitespace-pre-wrap text-sm text-muted-foreground">
                  {os.obs}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <ServiceOrderItemEditor
        empresaId={lojaAtiva?.id}
        onAdd={addPending}
      />

      {/* Itens pendentes de salvar */}
      {pendingItems.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base text-amber-800">
              Itens a salvar ({pendingItems.length})
            </CardTitle>
            <Button
              onClick={salvarPendentes}
              disabled={savingPendentes}
              size="sm"
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              {savingPendentes
                ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvando...</>
                : `Salvar ${pendingItems.length} item(s)`}
            </Button>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto / Serviço</TableHead>
                  <TableHead className="w-24 text-right">Qtde</TableHead>
                  <TableHead className="w-32 text-right">Preço unit.</TableHead>
                  <TableHead className="w-32 text-right">Total</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingItems.map((it) => (
                  <TableRow key={it.tempId} className="bg-amber-50">
                    <TableCell>
                      <p className="text-sm font-medium">{it.descricao || it.produtoNome}</p>
                      {it.codigo && <p className="text-xs text-muted-foreground font-mono">{it.codigo}</p>}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{it.quantidade}</TableCell>
                    <TableCell className="text-right tabular-nums text-sm">
                      {it.precoUnitario.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-sm font-medium">
                      {(it.quantidade * it.precoUnitario).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </TableCell>
                    <TableCell>
                      <button onClick={() => removePending(it.tempId)} className="text-muted-foreground hover:text-destructive transition-colors">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Produtos */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Produtos</CardTitle>
          {produtos.length > 0 && (
            <span className="text-sm text-muted-foreground">
              {produtos.length} {produtos.length === 1 ? "item" : "itens"}
              {totalProdutos > 0 && (
                <>
                  {" "}•{" "}
                  <span className="font-medium text-foreground">
                    {totalProdutos.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </span>
                </>
              )}
            </span>
          )}
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-28">Código</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead className="w-16 text-right">Un</TableHead>
                <TableHead className="w-24 text-right">Qtde</TableHead>
                <TableHead className="w-32 text-right">Preço unit.</TableHead>
                <TableHead className="w-32 text-right">Total</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {produtos.map((it) => (
                <TableRow key={it.id}>
                  <TableCell className="font-mono text-sm">{it.produtoId}</TableCell>
                  <TableCell>{it.produtoNome}</TableCell>
                  <TableCell className="text-right text-sm text-muted-foreground">
                    {it.unidade ?? "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{it.quantidade}</TableCell>
                  <TableCell className="text-right tabular-nums text-sm">
                    {it.precoUnitario != null
                      ? it.precoUnitario.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                      : "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-sm font-medium">
                    {it.total != null
                      ? it.total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                      : "—"}
                  </TableCell>
                  <TableCell>
                    <button
                      onClick={() => deleteItem(it.id)}
                      disabled={!!deletingItemId}
                      className="text-muted-foreground hover:text-red-500 transition-colors disabled:opacity-40"
                    >
                      {deletingItemId === it.id
                        ? <Loader2 className="h-4 w-4 animate-spin" />
                        : <Trash2 className="h-4 w-4" />}
                    </button>
                  </TableCell>
                </TableRow>
              ))}
              {produtos.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-6 text-center text-sm text-muted-foreground">
                    Nenhum produto adicionado.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Serviços */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Serviços</CardTitle>
          {servicos.length > 0 && (
            <span className="text-sm text-muted-foreground">
              {servicos.length} {servicos.length === 1 ? "item" : "itens"}
              {totalServicos > 0 && (
                <>
                  {" "}•{" "}
                  <span className="font-medium text-foreground">
                    {totalServicos.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </span>
                </>
              )}
            </span>
          )}
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Serviço</TableHead>
                <TableHead className="w-24 text-right">Qtde</TableHead>
                <TableHead className="w-32 text-right">Preço unit.</TableHead>
                <TableHead className="w-32 text-right">Total</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {servicos.map((it) => (
                <TableRow key={it.id}>
                  <TableCell>{it.produtoNome}</TableCell>
                  <TableCell className="text-right tabular-nums">{it.quantidade}</TableCell>
                  <TableCell className="text-right tabular-nums text-sm">
                    {it.precoUnitario != null
                      ? it.precoUnitario.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                      : "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-sm font-medium">
                    {it.total != null
                      ? it.total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                      : "—"}
                  </TableCell>
                  <TableCell>
                    <button
                      onClick={() => deleteItem(it.id)}
                      disabled={!!deletingItemId}
                      className="text-muted-foreground hover:text-red-500 transition-colors disabled:opacity-40"
                    >
                      {deletingItemId === it.id
                        ? <Loader2 className="h-4 w-4 animate-spin" />
                        : <Trash2 className="h-4 w-4" />}
                    </button>
                  </TableCell>
                </TableRow>
              ))}
              {servicos.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-6 text-center text-sm text-muted-foreground">
                    Nenhum serviço registrado.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

    </div>
  );
}
