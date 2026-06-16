"use client";

import { useEffect, useRef, useState } from "react";
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
import { Loader2, Plus, Search, Trash2 } from "lucide-react";

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
  const shouldFocusFirstRef = useRef(false);

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

  // Após busca: foca o campo de qtde do primeiro resultado
  useEffect(() => {
    if (shouldFocusFirstRef.current && produtos.length > 0) {
      shouldFocusFirstRef.current = false;
      requestAnimationFrame(() => {
        const el = document.getElementById(`qty-${produtos[0].id}`) as HTMLInputElement | null;
        el?.focus();
        el?.select();
      });
    }
  }, [produtos]);

  async function triggerSearch() {
    if (!empresaId || (!descricao.trim() && !codigo.trim())) return;
    setSearching(true);
    setSearched(true);
    try {
      const results = await stockService.search(empresaId, descricao.trim(), codigo.trim());
      const qtds: Record<string, number> = {};
      for (const r of results) qtds[r.id] = 1;
      setResultQtds(qtds);
      if (results.length > 0) shouldFocusFirstRef.current = true;
      setProdutos(results);
    } catch (e) {
      console.error(e);
      setProdutos([]);
    } finally {
      setSearching(false);
    }
  }

  function focusQty(id: string) {
    const el = document.getElementById(`qty-${id}`) as HTMLInputElement | null;
    el?.focus();
    el?.select();
  }

  function handleSearchKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") void triggerSearch();
  }

  function handleQtyKeyDown(e: React.KeyboardEvent, p: Produto, idx: number) {
    if (e.key === "Enter") {
      e.preventDefault();
      document.getElementById(`add-${p.id}`)?.focus();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      const next = produtos[idx + 1];
      if (next) focusQty(next.id);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (idx === 0) {
        document.getElementById("search-codigo")?.focus();
      } else {
        focusQty(produtos[idx - 1].id);
      }
    }
  }

  function handleAddBtnKeyDown(e: React.KeyboardEvent, p: Produto) {
    if (e.key === "Backspace" || e.key === "ArrowLeft") {
      e.preventDefault();
      focusQty(p.id);
    }
  }

  function setResultQty(proId: string, raw: string) {
    const n = parseInt(raw.replace(/\D/g, ""), 10);
    setResultQtds((q) => ({ ...q, [proId]: isNaN(n) || n < 1 ? 1 : n }));
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
    // Refoca qty da mesma linha para facilitar sequência de adições
    requestAnimationFrame(() => focusQty(p.id));
  }

  function removeFromCart(proId: string) {
    setCart((prev) => prev.filter((c) => c.proId !== proId));
  }

  function setCartQty(proId: string, raw: string | number) {
    const n =
      typeof raw === "number" ? raw : parseInt(String(raw).replace(/\D/g, ""), 10);
    setCart((prev) =>
      prev.map((c) => (c.proId === proId ? { ...c, qtd: isNaN(n) || n < 1 ? 1 : n } : c)),
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

  const qtyInputCls =
    "w-12 rounded border bg-transparent px-1 py-0.5 text-center tabular-nums text-sm font-medium focus:outline-none focus:ring-1 focus:ring-primary [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl gap-0 overflow-hidden p-0">
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
              id="search-codigo"
              placeholder="Código / EAN"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              className="w-44"
              autoFocus
            />
            <Input
              placeholder="Descrição ou referência (use % para buscar no meio)"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              onKeyDown={handleSearchKeyDown}
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
                      Estoq. fiscal
                    </th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">
                      Estoq. físico
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
                  {produtos.map((p, idx) => (
                    <tr key={p.id} className="border-b last:border-b-0 hover:bg-muted/30">
                      <td className="px-3 py-2">
                        <p className="max-w-[190px] truncate font-medium">{p.nome}</p>
                        <p className="text-xs text-muted-foreground">{p.unidade}</p>
                      </td>
                      <td className="px-3 py-2 text-center font-mono text-xs text-muted-foreground">
                        #{p.id}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {(p.preco ?? 0) > 0 ? fmtBRL(p.preco ?? 0) : "—"}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        <span
                          className={
                            p.estoqueFiscal < 0 ? "font-semibold text-destructive" : ""
                          }
                        >
                          {p.estoqueFiscal}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                        {p.estoqueFisico}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <input
                          id={`qty-${p.id}`}
                          type="number"
                          min={1}
                          value={resultQtds[p.id] ?? 1}
                          onChange={(e) => setResultQty(p.id, e.target.value)}
                          onKeyDown={(e) => handleQtyKeyDown(e, p, idx)}
                          onFocus={(e) => e.target.select()}
                          className={qtyInputCls}
                        />
                      </td>
                      <td className="px-3 py-2 text-center">
                        <button
                          id={`add-${p.id}`}
                          type="button"
                          onClick={() => addToCart(p)}
                          onKeyDown={(e) => handleAddBtnKeyDown(e, p)}
                          title="Inserir no conferidor"
                          className="mx-auto flex h-7 w-7 items-center justify-center rounded bg-primary text-primary-foreground hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1"
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
                      <td className="px-3 py-2 text-center">
                        <input
                          type="number"
                          min={1}
                          value={c.qtd}
                          onChange={(e) => setCartQty(c.proId, e.target.value)}
                          onFocus={(e) => e.target.select()}
                          className={qtyInputCls}
                        />
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
