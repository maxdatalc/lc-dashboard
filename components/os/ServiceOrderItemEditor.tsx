"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { stockService } from "@/lib/services/stock-adapter";
import type { Produto } from "@/lib/fiscal-types";
import { Loader2, Minus, Plus, Search, Trash2 } from "lucide-react";

type CartItem = {
  proId: string;
  nome: string;
  codigo: string;
  qtd: number;
  preco: number;
  estoqueFiscal: number;
  estoqueFisico: number;
  unidade: string;
};

export type AddItemPayload = {
  produtoId: string;
  produtoNome: string;
  codigo: string;
  quantidade: number;
};

export function ServiceOrderItemEditor({
  open,
  onOpenChange,
  empresaId,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  empresaId?: string;
  onAdd: (items: AddItemPayload[]) => void;
}) {
  const [descricao, setDescricao] = useState("");
  const [codigo, setCodigo] = useState("");
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [resultQtds, setResultQtds] = useState<Record<string, number>>({});
  const [cart, setCart] = useState<CartItem[]>([]);

  useEffect(() => {
    if (!open) {
      setDescricao("");
      setCodigo("");
      setProdutos([]);
      setSearched(false);
      setResultQtds({});
      setCart([]);
    }
  }, [open]);

  async function triggerSearch() {
    if (!empresaId || (!descricao.trim() && !codigo.trim())) return;
    setSearching(true);
    setSearched(true);
    try {
      const results = await stockService.search(empresaId, descricao.trim(), codigo.trim());
      setProdutos(results);
      const qtds: Record<string, number> = {};
      for (const r of results) qtds[r.id] = 1;
      setResultQtds(qtds);
    } catch (e) {
      console.error(e);
      setProdutos([]);
    } finally {
      setSearching(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") void triggerSearch();
  }

  function addToCart(p: Produto) {
    const qty = resultQtds[p.id] ?? 1;
    setCart((prev) => {
      const idx = prev.findIndex((c) => c.proId === p.id);
      if (idx >= 0) {
        return prev.map((c, i) => (i === idx ? { ...c, qtd: c.qtd + qty } : c));
      }
      return [
        ...prev,
        {
          proId: p.id,
          nome: p.nome,
          codigo: p.codigo,
          qtd: qty,
          preco: p.preco ?? 0,
          estoqueFiscal: p.estoqueFiscal,
          estoqueFisico: p.estoqueFisico,
          unidade: p.unidade,
        },
      ];
    });
  }

  function removeFromCart(proId: string) {
    setCart((prev) => prev.filter((c) => c.proId !== proId));
  }

  function updateCartQty(proId: string, delta: number) {
    setCart((prev) =>
      prev.map((c) => (c.proId === proId ? { ...c, qtd: Math.max(1, c.qtd + delta) } : c)),
    );
  }

  const cartTotal = cart.reduce((acc, c) => acc + c.qtd * c.preco, 0);

  function handleSubmit() {
    if (cart.length === 0) return;
    onAdd(
      cart.map((c) => ({
        produtoId: c.proId,
        produtoNome: c.nome,
        codigo: c.codigo,
        quantidade: c.qtd,
      })),
    );
    onOpenChange(false);
  }

  const fmtBRL = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl gap-0 p-0 overflow-hidden">
        <DialogHeader className="sr-only">
          <DialogTitle>Adicionar itens à O.S</DialogTitle>
        </DialogHeader>

        {/* ① Pesquisar e inserir produto */}
        <div className="border-b p-5">
          <div className="mb-4 flex items-center gap-2.5">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
              1
            </span>
            <h2 className="text-sm font-semibold">Pesquisar e inserir produto</h2>
          </div>

          <div className="mb-3 flex gap-2">
            <Input
              placeholder="Código / EAN"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-44"
              autoFocus
            />
            <Input
              placeholder="Descrição ou referência (use % para buscar no meio)"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1"
            />
            <Button
              onClick={() => void triggerSearch()}
              disabled={searching || (!descricao.trim() && !codigo.trim())}
              className="shrink-0"
            >
              {searching ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
            </Button>
          </div>

          <div className="max-h-56 overflow-y-auto rounded-md border">
            {searching ? (
              <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Buscando e calculando estoque fiscal…
              </div>
            ) : !searched ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Preencha ao menos um campo e pressione{" "}
                <kbd className="rounded border px-1 font-mono text-xs">Enter</kbd>.
              </p>
            ) : produtos.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Nenhum produto encontrado.
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead className="sticky top-0 border-b bg-muted/80 backdrop-blur-sm">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                      Produto
                    </th>
                    <th className="px-3 py-2 text-center text-xs font-medium text-muted-foreground">
                      Código
                    </th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">
                      Preço unit.
                    </th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">
                      Estoque fiscal / físico
                    </th>
                    <th className="px-3 py-2 text-center text-xs font-medium text-muted-foreground">
                      Qtde
                    </th>
                    <th className="px-3 py-2 text-center text-xs font-medium text-muted-foreground">
                      Ação
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {produtos.map((p) => (
                    <tr key={p.id} className="border-b last:border-b-0 hover:bg-muted/30">
                      <td className="px-3 py-2">
                        <p className="max-w-[220px] truncate font-medium">{p.nome}</p>
                        <p className="text-xs text-muted-foreground">{p.unidade}</p>
                      </td>
                      <td className="px-3 py-2 text-center font-mono text-xs text-muted-foreground">
                        #{p.id}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-sm">
                        {(p.preco ?? 0) > 0 ? fmtBRL(p.preco ?? 0) : "—"}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-sm">
                        <span
                          className={
                            p.estoqueFiscal < 0 ? "font-semibold text-destructive" : ""
                          }
                        >
                          {p.estoqueFiscal}
                        </span>
                        <span className="text-muted-foreground"> / {p.estoqueFisico}</span>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() =>
                              setResultQtds((q) => ({
                                ...q,
                                [p.id]: Math.max(1, (q[p.id] ?? 1) - 1),
                              }))
                            }
                            className="flex h-6 w-6 items-center justify-center rounded border hover:bg-muted"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="w-7 text-center tabular-nums text-sm font-medium">
                            {resultQtds[p.id] ?? 1}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setResultQtds((q) => ({
                                ...q,
                                [p.id]: (q[p.id] ?? 1) + 1,
                              }))
                            }
                            className="flex h-6 w-6 items-center justify-center rounded border hover:bg-muted"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <button
                          type="button"
                          onClick={() => addToCart(p)}
                          title="Inserir no conferidor"
                          className="mx-auto flex h-7 w-7 items-center justify-center rounded bg-primary text-primary-foreground hover:bg-primary/90"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* ② Conferidor de itens */}
        <div className="p-5">
          <div className="mb-4 flex items-center gap-2.5">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
              2
            </span>
            <h2 className="text-sm font-semibold">Conferidor de itens</h2>
            {cart.length > 0 && (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                {cart.length}
              </span>
            )}
          </div>

          <div className="mb-4 rounded-md border">
            {cart.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Nenhum item adicionado ao conferidor ainda.
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/50">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                      Produto
                    </th>
                    <th className="px-3 py-2 text-center text-xs font-medium text-muted-foreground">
                      Código
                    </th>
                    <th className="px-3 py-2 text-center text-xs font-medium text-muted-foreground">
                      Quantidade
                    </th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">
                      Preço unit.
                    </th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">
                      Total
                    </th>
                    <th className="w-8 px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {cart.map((c) => (
                    <tr key={c.proId} className="border-b last:border-b-0">
                      <td className="px-3 py-2">
                        <p className="max-w-[200px] truncate font-medium">{c.nome}</p>
                        <p className="text-xs text-muted-foreground">{c.unidade}</p>
                      </td>
                      <td className="px-3 py-2 text-center font-mono text-xs text-muted-foreground">
                        #{c.proId}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => updateCartQty(c.proId, -1)}
                            className="flex h-6 w-6 items-center justify-center rounded border hover:bg-muted"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="w-7 text-center tabular-nums text-sm font-medium">
                            {c.qtd}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateCartQty(c.proId, 1)}
                            className="flex h-6 w-6 items-center justify-center rounded border hover:bg-muted"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {c.preco > 0 ? fmtBRL(c.preco) : "—"}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums font-semibold">
                        {c.preco > 0 ? fmtBRL(c.qtd * c.preco) : "—"}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <button
                          type="button"
                          onClick={() => removeFromCart(c.proId)}
                          className="text-muted-foreground transition-colors hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                {cartTotal > 0 && (
                  <tfoot className="border-t bg-muted/30">
                    <tr>
                      <td
                        colSpan={4}
                        className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                      >
                        Total
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums font-bold">
                        {fmtBRL(cartTotal)}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                )}
              </table>
            )}
          </div>

          <div className="flex items-center justify-between">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button disabled={cart.length === 0} onClick={handleSubmit}>
              Adicionar {cart.length > 0 ? `${cart.length} ` : ""}
              {cart.length === 1 ? "item" : "itens"} na O.S
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
