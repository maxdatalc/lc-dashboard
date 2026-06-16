"use client";

import { useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { stockService } from "@/lib/services/stock-adapter";
import type { Produto } from "@/lib/fiscal-types";
import { Loader2, Maximize2, Minimize2, Plus, Search, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

type CartItem = {
  proId: string;
  nome: string;
  codFab: string;
  qtd: number;
  preco: number;
  estoqueFiscal: number;
  estoqueFisico: number;
  unidade: string;
};

type EntryForm = {
  proId: string;
  nome: string;
  codFab: string;
  qtd: number;
  estoqueFisico: number;
  estoqueFiscal: number;
  preco: number;
  unidade: string;
};

const EMPTY_FORM: EntryForm = {
  proId: "",
  nome: "",
  codFab: "",
  qtd: 0,
  estoqueFisico: 0,
  estoqueFiscal: 0,
  preco: 0,
  unidade: "",
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
  const [entryCode, setEntryCode] = useState("");
  const [form, setForm] = useState<EntryForm>(EMPTY_FORM);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Overlay search
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [overlayDesc, setOverlayDesc] = useState("");
  const [overlayCod, setOverlayCod] = useState("");
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);

  const qtdRef = useRef<HTMLInputElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setEntryCode("");
      setForm(EMPTY_FORM);
      setCart([]);
      setFormError(null);
      setIsFullscreen(false);
      setOverlayOpen(false);
      setOverlayDesc("");
      setOverlayCod("");
      setProdutos([]);
      setSearched(false);
    }
  }, [open]);

  function fillForm(p: Produto) {
    setEntryCode(p.id);
    setForm({
      proId: p.id,
      nome: p.nome,
      codFab: p.codigo,
      qtd: 0,
      estoqueFisico: p.estoqueFisico,
      estoqueFiscal: p.estoqueFiscal,
      preco: p.preco ?? 0,
      unidade: p.unidade,
    });
    setFormError(null);
  }

  function resetForm() {
    setEntryCode("");
    setForm(EMPTY_FORM);
    setFormError(null);
    requestAnimationFrame(() => codeRef.current?.focus());
  }

  // Lookup by proId typed in the code field
  async function lookupByCode(code: string) {
    if (!empresaId || !code.trim()) return;
    setSearching(true);
    try {
      const results = await stockService.search(empresaId, "", code.trim());
      if (results.length === 1) {
        fillForm(results[0]);
        requestAnimationFrame(() => {
          qtdRef.current?.focus();
          qtdRef.current?.select();
        });
      } else if (results.length > 1) {
        setOverlayCod(code.trim());
        setOverlayDesc("");
        setProdutos(results);
        setSearched(true);
        setOverlayOpen(true);
      } else {
        setFormError("Produto não encontrado.");
      }
    } catch (e) {
      console.error(e);
      setFormError("Erro ao consultar produto.");
    } finally {
      setSearching(false);
    }
  }

  // Overlay search execution
  async function runOverlaySearch() {
    if (!empresaId || (!overlayDesc.trim() && !overlayCod.trim())) return;
    setSearching(true);
    setSearched(true);
    try {
      const results = await stockService.search(
        empresaId,
        overlayDesc.trim(),
        overlayCod.trim(),
      );
      setProdutos(results);
    } catch (e) {
      console.error(e);
      setProdutos([]);
    } finally {
      setSearching(false);
    }
  }

  function selectFromOverlay(p: Produto) {
    fillForm(p);
    setOverlayOpen(false);
    requestAnimationFrame(() => {
      qtdRef.current?.focus();
      qtdRef.current?.select();
    });
  }

  function openOverlay() {
    setOverlayDesc(form.nome);
    setOverlayCod(entryCode);
    setOverlayOpen(true);
  }

  function addToCart() {
    if (!form.proId) {
      setFormError("Selecione um produto primeiro.");
      return;
    }
    if (form.qtd <= 0) {
      setFormError("A quantidade deve ser maior que zero.");
      qtdRef.current?.focus();
      return;
    }
    setCart((prev) => {
      const idx = prev.findIndex((c) => c.proId === form.proId);
      if (idx >= 0) {
        return prev.map((c, i) =>
          i === idx ? { ...c, qtd: c.qtd + form.qtd } : c,
        );
      }
      return [
        ...prev,
        {
          proId: form.proId,
          nome: form.nome,
          codFab: form.codFab,
          qtd: form.qtd,
          preco: form.preco,
          estoqueFiscal: form.estoqueFiscal,
          estoqueFisico: form.estoqueFisico,
          unidade: form.unidade,
        },
      ];
    });
    resetForm();
  }

  function removeFromCart(proId: string) {
    setCart((prev) => prev.filter((c) => c.proId !== proId));
  }

  function setCartQty(proId: string, raw: string) {
    const n = parseInt(raw.replace(/\D/g, ""), 10);
    setCart((prev) =>
      prev.map((c) =>
        c.proId === proId ? { ...c, qtd: isNaN(n) || n < 1 ? 1 : n } : c,
      ),
    );
  }

  function handleSubmit() {
    if (cart.length === 0) return;
    onAdd(
      cart.map((c) => ({
        produtoId: c.proId,
        produtoNome: c.nome,
        codigo: c.codFab,
        quantidade: c.qtd,
      })),
    );
    onOpenChange(false);
  }

  const fmtBRL = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const cartTotal = cart.reduce((acc, c) => acc + c.qtd * c.preco, 0);

  const inputBase =
    "rounded border px-2 py-1.5 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary";
  const readonlyBase =
    "rounded border px-2 py-1.5 text-sm bg-muted/30 text-muted-foreground select-none";
  const qtyInputCls =
    "w-14 rounded border bg-transparent px-1 py-0.5 text-center tabular-nums text-sm font-medium focus:outline-none focus:ring-1 focus:ring-primary [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "gap-0 overflow-hidden p-0 flex flex-col",
          isFullscreen
            ? "!fixed !inset-0 !max-w-none !w-screen !h-screen !translate-x-0 !translate-y-0 !rounded-none"
            : "max-w-5xl h-[88vh]",
        )}
      >
        {/* Fullscreen toggle — sits left of the default X button */}
        <button
          type="button"
          onClick={() => setIsFullscreen((v) => !v)}
          title={isFullscreen ? "Restaurar tamanho" : "Tela cheia"}
          className="absolute right-10 top-4 z-10 rounded-sm opacity-70 hover:opacity-100 text-foreground transition-opacity"
        >
          {isFullscreen ? (
            <Minimize2 className="h-4 w-4" />
          ) : (
            <Maximize2 className="h-4 w-4" />
          )}
        </button>

        <DialogHeader className="sr-only">
          <DialogTitle>Adicionar itens à O.S</DialogTitle>
        </DialogHeader>

        {/* Panel header */}
        <div className="flex items-center gap-2.5 border-b px-4 py-3 shrink-0">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
            1
          </span>
          <h2 className="text-sm font-semibold">Pesquisar e inserir produto</h2>
        </div>

        {/* Entry form */}
        <div className="border-b px-4 py-3 shrink-0">
          {/* Labels */}
          <div className="flex gap-2 mb-1">
            <p className="w-28 text-[11px] font-medium text-muted-foreground">Cód. Interno</p>
            <p className="flex-1 text-[11px] font-medium text-muted-foreground">Descrição do Produto</p>
            <p className="w-36 text-[11px] font-medium text-muted-foreground">Cód. Fabricante</p>
            <p className="w-16 text-center text-[11px] font-medium text-muted-foreground">Qtde</p>
            <p className="w-16 text-center text-[11px] font-medium text-muted-foreground">Est. Físico</p>
            <p className="w-16 text-center text-[11px] font-medium text-muted-foreground">Est. Fiscal</p>
            <p className="w-24 text-right text-[11px] font-medium text-muted-foreground">Preço UN</p>
            <p className="w-28" />
          </div>
          {/* Inputs */}
          <div className="flex gap-2 items-center">
            <input
              ref={codeRef}
              id="entry-codigo"
              type="number"
              min={1}
              value={entryCode}
              onChange={(e) => {
                setEntryCode(e.target.value);
                if (form.proId) setForm(EMPTY_FORM);
                setFormError(null);
              }}
              onKeyDown={(e) => {
                if ((e.key === "Enter" || e.key === "Tab") && entryCode.trim()) {
                  e.preventDefault();
                  void lookupByCode(entryCode);
                }
              }}
              onFocus={(e) => e.target.select()}
              placeholder="ID interno"
              autoFocus
              className={cn(
                inputBase,
                "w-28 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
              )}
            />

            <div className="relative flex-1">
              <input
                value={form.nome}
                readOnly
                onClick={openOverlay}
                onFocus={openOverlay}
                placeholder="Clique para pesquisar produto…"
                className={cn(inputBase, "w-full cursor-pointer")}
              />
              {searching && (
                <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-muted-foreground" />
              )}
            </div>

            <input
              value={form.codFab}
              readOnly
              placeholder="—"
              className={cn(readonlyBase, "w-36")}
            />

            <input
              ref={qtdRef}
              type="number"
              min={0}
              value={form.qtd === 0 ? "" : form.qtd}
              onChange={(e) => {
                const n = parseInt(e.target.value, 10);
                setForm((f) => ({ ...f, qtd: isNaN(n) || n < 0 ? 0 : n }));
                setFormError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") addToCart();
              }}
              onFocus={(e) => e.target.select()}
              placeholder="0"
              className={cn(
                qtyInputCls,
                "w-16 border",
                !form.proId && "opacity-40 pointer-events-none",
              )}
            />

            <div className={cn(readonlyBase, "w-16 text-center tabular-nums")}>
              {form.proId ? form.estoqueFisico : "—"}
            </div>

            <div
              className={cn(
                readonlyBase,
                "w-16 text-center tabular-nums",
                form.proId && form.estoqueFiscal < 0 && "text-destructive font-semibold",
              )}
            >
              {form.proId ? form.estoqueFiscal : "—"}
            </div>

            <div className={cn(readonlyBase, "w-24 text-right tabular-nums")}>
              {form.proId && form.preco > 0 ? fmtBRL(form.preco) : "—"}
            </div>

            <Button
              onClick={addToCart}
              disabled={!form.proId || form.qtd <= 0}
              className="w-28 shrink-0"
            >
              <Plus className="h-4 w-4 mr-1" />
              Adicionar
            </Button>
          </div>

          {formError && (
            <p className="mt-1.5 text-xs text-destructive">{formError}</p>
          )}
        </div>

        {/* Grid única */}
        <div className="flex-1 overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 border-b bg-muted/80 backdrop-blur-sm">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                  Produto
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
                  Unid.
                </th>
                <th className="px-3 py-2 text-center text-xs font-medium text-muted-foreground">
                  Qtde
                </th>
                <th className="w-8 px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {cart.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="py-10 text-center text-sm text-muted-foreground"
                  >
                    Nenhum item adicionado. Preencha o formulário acima e clique em Adicionar.
                  </td>
                </tr>
              ) : (
                cart.map((c) => (
                  <tr key={c.proId} className="border-b last:border-b-0 hover:bg-muted/20">
                    <td className="px-3 py-2">
                      <p className="font-medium">{c.nome}</p>
                      <p className="text-xs text-muted-foreground">
                        Cod.&nbsp;{c.proId}
                        {c.codFab ? `  Cod Fab.: ${c.codFab}` : ""}
                      </p>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {c.preco > 0 ? fmtBRL(c.preco) : "—"}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      <span
                        className={
                          c.estoqueFiscal < 0 ? "font-semibold text-destructive" : ""
                        }
                      >
                        {c.estoqueFiscal}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                      {c.estoqueFisico}
                    </td>
                    <td className="px-3 py-2 text-center text-muted-foreground">
                      {c.unidade}
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
                    <td className="px-3 py-2 text-center">
                      <button
                        type="button"
                        onClick={() => removeFromCart(c.proId)}
                        className="text-muted-foreground transition-colors hover:text-destructive"
                        title="Remover item"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t px-4 py-3 shrink-0">
          <p className="text-sm text-muted-foreground">
            {cart.length > 0 && (
              <>
                {cart.length} {cart.length === 1 ? "item" : "itens"} •{" "}
                Total:{" "}
                <span className="font-semibold text-foreground">{fmtBRL(cartTotal)}</span>
              </>
            )}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button disabled={cart.length === 0} onClick={handleSubmit}>
              Adicionar{cart.length > 0 ? ` ${cart.length} ` : " "}
              {cart.length === 1 ? "item" : "itens"} na O.S
            </Button>
          </div>
        </div>

        {/* ── Overlay de pesquisa ── */}
        {overlayOpen && (
          <div className="absolute inset-0 z-20 flex flex-col bg-background">
            {/* Overlay header */}
            <div className="flex items-center justify-between border-b px-4 py-3 shrink-0">
              <h2 className="text-sm font-semibold">Pesquisa de Produto</h2>
              <button
                type="button"
                onClick={() => setOverlayOpen(false)}
                className="rounded-sm opacity-70 hover:opacity-100 transition-opacity"
                title="Fechar pesquisa"
              >
                <span className="text-xs text-muted-foreground">Esc</span>
              </button>
            </div>

            {/* Overlay inputs */}
            <div className="flex gap-3 border-b px-4 py-3 shrink-0">
              <div className="space-y-1 w-36">
                <p className="text-[11px] font-medium text-muted-foreground">Cód. Interno</p>
                <input
                  type="number"
                  value={overlayCod}
                  onChange={(e) => setOverlayCod(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && void runOverlaySearch()}
                  placeholder="ID"
                  autoFocus
                  className={cn(
                    inputBase,
                    "w-full [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
                  )}
                />
              </div>
              <div className="space-y-1 flex-1">
                <p className="text-[11px] font-medium text-muted-foreground">Descrição</p>
                <input
                  value={overlayDesc}
                  onChange={(e) => setOverlayDesc(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && void runOverlaySearch()}
                  placeholder="Pesquise pela descrição (use % para buscar no meio)"
                  className={cn(inputBase, "w-full")}
                />
              </div>
              <div className="space-y-1 flex items-end">
                <Button
                  onClick={() => void runOverlaySearch()}
                  disabled={searching || (!overlayDesc.trim() && !overlayCod.trim())}
                >
                  {searching ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            {/* Overlay results */}
            <div className="flex-1 overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 border-b bg-muted/80 backdrop-blur-sm">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                      Código
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                      Descrição
                    </th>
                    <th className="px-3 py-2 text-center text-xs font-medium text-muted-foreground">
                      UN
                    </th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">
                      Estoq. Fiscal
                    </th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">
                      Estoq. Físico
                    </th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">
                      Preço
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {searching ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center">
                        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Buscando e calculando estoque fiscal…
                        </div>
                      </td>
                    </tr>
                  ) : !searched ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-sm text-muted-foreground">
                        Preencha ao menos um campo e pressione{" "}
                        <kbd className="rounded border px-1 font-mono text-xs">Enter</kbd>.
                      </td>
                    </tr>
                  ) : produtos.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-sm text-muted-foreground">
                        Nenhum produto encontrado.
                      </td>
                    </tr>
                  ) : (
                    produtos.map((p) => (
                      <tr
                        key={p.id}
                        onClick={() => selectFromOverlay(p)}
                        className="border-b last:border-b-0 cursor-pointer hover:bg-primary/5"
                      >
                        <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">
                          #{p.id}
                        </td>
                        <td className="px-3 py-2.5">
                          <p className="font-medium text-primary">{p.nome}</p>
                          {p.codigo && (
                            <p className="text-xs text-muted-foreground">
                              Cod Fab.: {p.codigo}
                            </p>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-center text-muted-foreground">
                          {p.unidade}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums">
                          <span
                            className={
                              p.estoqueFiscal < 0 ? "font-semibold text-destructive" : ""
                            }
                          >
                            {p.estoqueFiscal}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                          {p.estoqueFisico}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums">
                          {(p.preco ?? 0) > 0 ? fmtBRL(p.preco ?? 0) : "—"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Overlay footer */}
            {searched && !searching && (
              <div className="border-t px-4 py-2 shrink-0 flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  {produtos.length > 0
                    ? `Mostrando ${produtos.length} resultado${produtos.length !== 1 ? "s" : ""}. Clique para selecionar.`
                    : "Nenhum resultado."}
                </p>
                <Button variant="ghost" size="sm" onClick={() => setOverlayOpen(false)}>
                  Cancelar
                </Button>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
