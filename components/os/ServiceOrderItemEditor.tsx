"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { stockService } from "@/lib/services/stock-adapter";
import type { Produto } from "@/lib/fiscal-types";
import { Loader2, Plus, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

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
  empresaId,
  onAdd,
}: {
  empresaId?: string;
  onAdd: (item: AddItemPayload) => void;
}) {
  const [entryCode, setEntryCode] = useState("");
  const [form, setForm] = useState<EntryForm>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [lookingUp, setLookingUp] = useState(false);

  const [overlayOpen, setOverlayOpen] = useState(false);
  const [overlayDesc, setOverlayDesc] = useState("");
  const [overlayCod, setOverlayCod] = useState("");
  const [overlayGrupo, setOverlayGrupo] = useState("");
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);

  const qtdRef = useRef<HTMLInputElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);
  const overlayDescRef = useRef<HTMLInputElement>(null);

  // Auto-focus overlay description field when overlay opens
  useEffect(() => {
    if (overlayOpen) {
      requestAnimationFrame(() => overlayDescRef.current?.focus());
    }
  }, [overlayOpen]);

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

  async function lookupByCode(code: string) {
    if (!empresaId || !code.trim()) return;
    setLookingUp(true);
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
        setOverlayGrupo("");
        setProdutos(results);
        setSearched(true);
        setOverlayOpen(true);
      } else {
        setFormError("Produto não encontrado para o código informado.");
      }
    } catch {
      setFormError("Erro ao consultar produto.");
    } finally {
      setLookingUp(false);
    }
  }

  async function runOverlaySearch() {
    if (!empresaId || (!overlayDesc.trim() && !overlayCod.trim())) return;
    setSearching(true);
    setSearched(true);
    try {
      const results = await stockService.search(
        empresaId,
        overlayDesc.trim(),
        overlayCod.trim(),
        overlayGrupo.trim(),
      );
      setProdutos(results);
    } catch {
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

  function closeOverlay() {
    setOverlayOpen(false);
    setProdutos([]);
    setSearched(false);
  }

  // Description field: open overlay only when typing a printable character
  function handleDescKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      setOverlayDesc(e.key);
      setOverlayCod(entryCode);
      setOverlayGrupo("");
      setProdutos([]);
      setSearched(false);
      setOverlayOpen(true);
    }
  }

  function addItem() {
    if (!form.proId) {
      setFormError("Selecione um produto primeiro.");
      return;
    }
    if (form.qtd <= 0) {
      setFormError("A quantidade deve ser maior que zero.");
      qtdRef.current?.focus();
      return;
    }
    onAdd({
      produtoId: form.proId,
      produtoNome: form.nome,
      codigo: form.codFab,
      quantidade: form.qtd,
    });
    resetForm();
  }

  const fmtBRL = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const inputBase =
    "rounded border px-2 py-1.5 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary";
  const readonlyBase =
    "rounded border px-2 py-1.5 text-sm bg-muted/30 text-muted-foreground select-none";
  const qtyInputCls =
    "rounded border bg-transparent px-1 py-1 text-center tabular-nums text-sm font-medium focus:outline-none focus:ring-1 focus:ring-primary [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";

  return (
    <>
      {/* ── Inline entry form ── */}
      <div className="rounded-lg border bg-card px-4 py-3 shadow-sm">
        {/* Labels */}
        <div className="flex gap-2 mb-1">
          <p className="w-28 text-[11px] font-medium text-muted-foreground">Cód. Interno</p>
          <p className="flex-1 text-[11px] font-medium text-muted-foreground">Descrição do Produto</p>
          <p className="w-16 text-center text-[11px] font-medium text-muted-foreground">Qtde</p>
          <p className="w-16 text-center text-[11px] font-medium text-muted-foreground">Est. Físico</p>
          <p className="w-16 text-center text-[11px] font-medium text-muted-foreground">Est. Fiscal</p>
          <p className="w-24 text-right text-[11px] font-medium text-muted-foreground">Preço UN</p>
          <p className="w-28 shrink-0" />
        </div>

        {/* Inputs */}
        <div className="flex gap-2 items-center">
          {/* Cód. Interno */}
          <div className="relative w-28 shrink-0">
            <input
              ref={codeRef}
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
                "w-full [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
              )}
            />
            {lookingUp && (
              <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 animate-spin text-muted-foreground pointer-events-none" />
            )}
          </div>

          {/* Descrição — readonly; typing opens overlay */}
          <input
            value={form.proId ? form.nome : ""}
            readOnly
            onKeyDown={handleDescKeyDown}
            placeholder="Digite para pesquisar produto…"
            className={cn(
              inputBase,
              "flex-1 cursor-text",
              !form.proId && "text-muted-foreground",
            )}
          />

          {/* Qtde */}
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
              if (e.key === "Enter") addItem();
            }}
            onFocus={(e) => e.target.select()}
            placeholder="0"
            className={cn(
              qtyInputCls,
              "w-16",
              !form.proId && "opacity-40 pointer-events-none",
            )}
          />

          {/* Est. Físico */}
          <div className={cn(readonlyBase, "w-16 text-center tabular-nums")}>
            {form.proId ? form.estoqueFisico : "—"}
          </div>

          {/* Est. Fiscal */}
          <div
            className={cn(
              readonlyBase,
              "w-16 text-center tabular-nums",
              form.proId && form.estoqueFiscal < 0 && "text-destructive font-semibold",
            )}
          >
            {form.proId ? form.estoqueFiscal : "—"}
          </div>

          {/* Preço UN */}
          <div className={cn(readonlyBase, "w-24 text-right tabular-nums")}>
            {form.proId && form.preco > 0 ? fmtBRL(form.preco) : "—"}
          </div>

          <Button
            onClick={addItem}
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

      {/* ── Search overlay (fixed, covers full viewport) ── */}
      {overlayOpen && (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-background"
          onKeyDown={(e) => e.key === "Escape" && closeOverlay()}
        >
          {/* Overlay header */}
          <div className="flex items-center justify-between border-b px-4 py-3 shrink-0">
            <h2 className="text-sm font-semibold">Pesquisa de Produto</h2>
            <button
              type="button"
              onClick={closeOverlay}
              className="rounded-sm opacity-70 hover:opacity-100 transition-opacity"
              title="Fechar (Esc)"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Search inputs */}
          <div className="flex flex-wrap gap-3 border-b px-4 py-3 shrink-0">
            <div className="space-y-1 w-36 shrink-0">
              <p className="text-[11px] font-medium text-muted-foreground">Cód. Interno</p>
              <input
                type="number"
                value={overlayCod}
                onChange={(e) => setOverlayCod(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void runOverlaySearch()}
                placeholder="ID"
                className={cn(
                  inputBase,
                  "w-full [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
                )}
              />
            </div>

            <div className="space-y-1 flex-1 min-w-[180px]">
              <p className="text-[11px] font-medium text-muted-foreground">Descrição</p>
              <input
                ref={overlayDescRef}
                value={overlayDesc}
                onChange={(e) => setOverlayDesc(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void runOverlaySearch()}
                placeholder="Pesquise pela descrição (use % para buscar no meio)"
                className={cn(inputBase, "w-full")}
              />
            </div>

            <div className="space-y-1 w-44 shrink-0">
              <p className="text-[11px] font-medium text-muted-foreground">Grupo</p>
              <input
                value={overlayGrupo}
                onChange={(e) => setOverlayGrupo(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void runOverlaySearch()}
                placeholder="Filtrar por grupo"
                className={cn(inputBase, "w-full")}
              />
            </div>

            <div className="space-y-1 flex items-end shrink-0">
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

          {/* Results table */}
          <div className="flex-1 overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 border-b bg-muted/80 backdrop-blur-sm">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Código</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Descrição</th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-muted-foreground">UN</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Estoq. Fiscal</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Estoq. Físico</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Preço</th>
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
                          <p className="text-xs text-muted-foreground">Cod Fab.: {p.codigo}</p>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-center text-muted-foreground">{p.unidade}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">
                        <span className={p.estoqueFiscal < 0 ? "font-semibold text-destructive" : ""}>
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
                  ? `${produtos.length} resultado${produtos.length !== 1 ? "s" : ""}. Clique para selecionar.`
                  : "Nenhum resultado."}
              </p>
              <Button variant="ghost" size="sm" onClick={closeOverlay}>
                Cancelar
              </Button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
