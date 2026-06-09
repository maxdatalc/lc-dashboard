"use client";

import { useState, useRef, useTransition } from "react";
import {
  Upload,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  RotateCcw,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import {
  confirmarPagina,
  reverterImportacao,
  listarImportacoes,
} from "@/app/actions/admin-importacao";

type Entidade =
  | "vendas"
  | "venda_itens"
  | "venda_pagamentos"
  | "produtos"
  | "vendedores"
  | "clientes";

const ENTIDADES: { value: Entidade; label: string; arquivo: string; ordem: number }[] = [
  { value: "vendas",           label: "1. Vendas",           arquivo: "vendas.csv",           ordem: 1 },
  { value: "produtos",         label: "2. Produtos",         arquivo: "produtos.csv",         ordem: 2 },
  { value: "vendedores",       label: "3. Vendedores",       arquivo: "vendedores.csv",       ordem: 3 },
  { value: "clientes",         label: "4. Clientes",         arquivo: "clientes.csv",         ordem: 4 },
  { value: "venda_itens",      label: "5. Itens de Venda",   arquivo: "venda_itens.csv",      ordem: 5 },
  { value: "venda_pagamentos", label: "6. Pagamentos",       arquivo: "venda_pagamentos.csv", ordem: 6 },
];

interface LojaOption {
  id: string;
  name: string;
  empId?: number;
}

interface Importacao {
  id: string;
  entidade: string;
  arquivo_nome: string;
  total_linhas: number | null;
  linhas_validas: number | null;
  linhas_invalidas: number | null;
  status: string;
  erros_amostra: string[] | null;
  iniciado_em: string;
  concluido_em: string | null;
}

interface Props {
  lojas: LojaOption[];
  importacoesIniciais: Importacao[];
}

function formatarData(iso: string | null) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    pendente: { label: "Pendente", cls: "bg-slate-100 text-slate-500" },
    validando: { label: "Validando", cls: "bg-blue-100 text-blue-600" },
    validado: { label: "Validado", cls: "bg-amber-100 text-amber-700" },
    importando: { label: "Importando", cls: "bg-violet-100 text-violet-700" },
    concluido: { label: "Concluído", cls: "bg-emerald-100 text-emerald-700" },
    erro: { label: "Erro", cls: "bg-red-100 text-red-700" },
    revertido: { label: "Revertido", cls: "bg-slate-100 text-slate-500" },
  };
  const cfg = map[status] ?? { label: status, cls: "bg-slate-100 text-slate-500" };
  return (
    <span
      className={`inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-md ${cfg.cls}`}
    >
      {cfg.label}
    </span>
  );
}

export function ImportacaoCSVSection({ lojas, importacoesIniciais }: Props) {
  const [importacoes, setImportacoes] = useState<Importacao[]>(importacoesIniciais);
  const [lojaId, setLojaId] = useState<string>("");
  const [entidade, setEntidade] = useState<Entidade>("vendas");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [resultado, setResultado] = useState<{
    importacaoId?: string;
    validas?: number;
    invalidas?: number;
    errosAmostra?: string[];
  } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [expandidoErros, setExpandidoErros] = useState(false);
  const [progresso, setProgresso] = useState<{
    atual: number;
    total: number;
    fase: string;
  } | null>(null);
  const [confirmando, setConfirmando] = useState<{
    importacaoId: string;
    pagina: number;
    totalPaginas: number;
    importados: number;
  } | null>(null);
  const [isPending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleSelecionarLoja(novoLojaId: string) {
    setLojaId(novoLojaId);
    setResultado(null);
    setErro(null);
    setArquivo(null);
    if (!novoLojaId) return;
    const historico = await listarImportacoes(novoLojaId);
    setImportacoes(historico as Importacao[]);
  }

  async function handleUpload() {
    if (!arquivo || !lojaId) return;
    setUploading(true);
    setErro(null);
    setResultado(null);
    setProgresso({ atual: 0, total: 0, fase: "Lendo arquivo..." });

    try {
      // 1. Ler CSV como texto no frontend
      const texto = await new Promise<string>((res, rej) => {
        const reader = new FileReader();
        reader.onload = () => res(reader.result as string);
        reader.onerror = () => rej(new Error("Erro ao ler arquivo"));
        reader.readAsText(arquivo, "utf-8");
      });

      const linhas = texto
        .replace(/\r\n/g, "\n")
        .replace(/\r/g, "\n")
        .split("\n")
        .filter((l) => l.trim() !== "");

      if (linhas.length < 2) {
        setErro("Arquivo CSV vazio ou sem dados");
        return;
      }

      const headers = linhas[0].split(";").map((h) => h.trim().toLowerCase().replace(/"/g, ""));
      const dataLines = linhas.slice(1);
      const totalLinhas = dataLines.length;

      setProgresso({ atual: 0, total: totalLinhas, fase: "Criando importação..." });

      // 2. Criar registro de importação
      const criarResp = await fetch("/api/admin/importar-csv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acao: "criar", lojaId, entidade, nomeArquivo: arquivo.name, totalLinhas }),
      });
      const criarData = (await criarResp.json()) as { error?: string; importacaoId?: string };
      if (!criarResp.ok || criarData.error) {
        setErro(criarData.error ?? "Erro ao criar importação");
        return;
      }
      const importacaoId = criarData.importacaoId!;

      // 3. Enviar em chunks de 1000 linhas (~100KB por request)
      const CHUNK_SIZE = 1000;
      let totalValidas = 0;
      let totalInvalidas = 0;
      const errosAmostra: string[] = [];

      for (let i = 0; i < dataLines.length; i += CHUNK_SIZE) {
        const chunkLines = dataLines.slice(i, i + CHUNK_SIZE);
        const rows = chunkLines.map((linha) => {
          const valores = linha.split(";").map((v) => v.trim().replace(/^"|"$/g, ""));
          const row: Record<string, string> = {};
          headers.forEach((h, idx) => { row[h] = valores[idx] ?? ""; });
          return row;
        });

        setProgresso({
          atual: Math.min(i + CHUNK_SIZE, totalLinhas),
          total: totalLinhas,
          fase: `Validando linhas ${i + 1}–${Math.min(i + CHUNK_SIZE, totalLinhas)}...`,
        });

        const chunkResp = await fetch("/api/admin/importar-csv", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ acao: "chunk", importacaoId, lojaId, entidade, rows, offsetInicio: i }),
        });
        const chunkData = (await chunkResp.json()) as {
          error?: string;
          validas?: number;
          invalidas?: number;
          erros?: string[];
        };

        if (!chunkResp.ok || chunkData.error) {
          setErro(chunkData.error ?? "Erro ao processar chunk");
          return;
        }

        totalValidas += chunkData.validas ?? 0;
        totalInvalidas += chunkData.invalidas ?? 0;
        if ((chunkData.erros?.length ?? 0) > 0 && errosAmostra.length < 5) {
          errosAmostra.push(...(chunkData.erros ?? []).slice(0, 5 - errosAmostra.length));
        }
      }

      // 4. Finalizar
      setProgresso({ atual: totalLinhas, total: totalLinhas, fase: "Finalizando..." });

      const finResp = await fetch("/api/admin/importar-csv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acao: "finalizar", importacaoId, totalValidas, totalInvalidas, errosAmostra }),
      });
      const finData = (await finResp.json()) as { error?: string };
      if (!finResp.ok || finData.error) {
        setErro(finData.error ?? "Erro ao finalizar");
        return;
      }

      setResultado({ importacaoId, validas: totalValidas, invalidas: totalInvalidas, errosAmostra });
      const novas = await listarImportacoes(lojaId);
      setImportacoes(novas as Importacao[]);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro de conexão");
    } finally {
      setUploading(false);
      setProgresso(null);
    }
  }

  async function handleConfirmar(importacaoId: string, totalValidas: number) {
    const totalPaginas = Math.max(1, Math.ceil(totalValidas / 1000));
    setConfirmando({ importacaoId, pagina: 0, totalPaginas, importados: 0 });
    setErro(null);

    let paginaAtual = 0;
    let totalImportados = 0;

    while (true) {
      const resultado = await confirmarPagina(importacaoId, paginaAtual);

      if (resultado.error) {
        setErro(resultado.error);
        setConfirmando(null);
        return;
      }

      totalImportados += resultado.importados;
      setConfirmando({
        importacaoId,
        pagina: paginaAtual + 1,
        totalPaginas,
        importados: totalImportados,
      });

      if (resultado.concluido) break;
      paginaAtual++;
    }

    setConfirmando(null);
    setResultado(null);
    const novas = await listarImportacoes(lojaId);
    setImportacoes(novas as Importacao[]);
  }

  function handleReverter(importacaoId: string) {
    if (!confirm("Reverter esta importação? Os dados importados serão removidos.")) return;
    startTransition(async () => {
      const r = await reverterImportacao(importacaoId);
      if (r.error) {
        setErro(r.error);
      } else {
        const novas = await listarImportacoes(lojaId);
        setImportacoes(novas as Importacao[]);
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Barra de progresso de confirmação — fixada na parte inferior */}
      {confirmando && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-white border border-slate-200 rounded-2xl shadow-2xl px-6 py-4 w-full max-w-sm">
          <div className="flex items-center gap-3 mb-3">
            <Loader2 className="w-5 h-5 text-blue-600 animate-spin shrink-0" />
            <div>
              <p className="text-sm font-semibold text-slate-900">Importando dados...</p>
              <p className="text-xs text-slate-500">
                Página {confirmando.pagina} de {confirmando.totalPaginas}
              </p>
            </div>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2 mb-2">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all duration-300"
              style={{
                width: confirmando.totalPaginas > 0
                  ? `${Math.round((confirmando.pagina / confirmando.totalPaginas) * 100)}%`
                  : "0%",
              }}
            />
          </div>
          <p className="text-xs text-slate-400 text-right">
            {confirmando.importados.toLocaleString("pt-BR")} registros importados
          </p>
        </div>
      )}
      {/* Upload */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <Upload className="w-4 h-4 text-slate-400" />
          Importar CSV
        </h3>

        {/* Seletor de loja — obrigatório antes de qualquer ação */}
        <div className="mb-5 p-4 bg-slate-50 border border-slate-200 rounded-xl">
          <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider block mb-2">
            Selecione a loja de destino
          </label>
          <p className="text-xs text-slate-500 mb-3">
            Os dados do CSV serão importados exclusivamente para a loja selecionada.
            Confirme com atenção antes de prosseguir.
          </p>
          {lojas.length === 0 ? (
            <p className="text-sm text-red-600">Esta empresa não possui lojas cadastradas.</p>
          ) : (
            <div className="space-y-2">
              {lojas.map((loja) => (
                <label
                  key={loja.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                    lojaId === loja.id
                      ? "border-blue-500 bg-blue-50"
                      : "border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50/30"
                  }`}
                >
                  <input
                    type="radio"
                    name="loja_destino"
                    value={loja.id}
                    checked={lojaId === loja.id}
                    onChange={() => handleSelecionarLoja(loja.id)}
                    className="sr-only"
                  />
                  <div
                    className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center transition-all ${
                      lojaId === loja.id ? "border-blue-500 bg-blue-500" : "border-slate-300"
                    }`}
                  >
                    {lojaId === loja.id && (
                      <div className="w-1.5 h-1.5 rounded-full bg-white" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900">{loja.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-xs text-slate-400 font-mono truncate">{loja.id}</p>
                      {loja.empId !== undefined && (
                        <span className="text-xs font-bold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded shrink-0">
                          empId: {loja.empId !== undefined ? String(loja.empId) : "—"}
                        </span>
                      )}
                    </div>
                  </div>
                  {lojaId === loja.id && (
                    <span className="text-xs font-bold text-blue-600 bg-blue-100 px-2 py-0.5 rounded-md shrink-0">
                      SELECIONADA
                    </span>
                  )}
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Campos de upload — só aparecem após selecionar loja */}
        {lojaId && (
          <>
            <div className="grid grid-cols-2 gap-4 mb-4">
              {/* Seletor de entidade */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Tipo de dados
                </label>
                <select
                  value={entidade}
                  onChange={(e) => {
                    setEntidade(e.target.value as Entidade);
                    setArquivo(null);
                    setResultado(null);
                    setErro(null);
                  }}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-white"
                >
                  {ENTIDADES.map((e) => (
                    <option key={e.value} value={e.value}>
                      {e.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-slate-400">
                  Arquivo esperado:{" "}
                  <code className="bg-slate-100 px-1 rounded">
                    {ENTIDADES.find((e) => e.value === entidade)?.arquivo}
                  </code>
                </p>
              </div>

              {/* Seletor de arquivo */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Arquivo CSV
                </label>
                <div
                  onClick={() => fileRef.current?.click()}
                  className={`w-full border-2 border-dashed rounded-lg px-3 py-2.5 text-sm cursor-pointer transition-colors ${
                    arquivo
                      ? "border-blue-400 bg-blue-50"
                      : "border-slate-200 hover:border-blue-300 hover:bg-slate-50"
                  }`}
                >
                  {arquivo ? (
                    <span className="flex items-center gap-2 text-blue-700">
                      <FileText className="w-4 h-4 shrink-0" />
                      <span className="truncate">{arquivo.name}</span>
                    </span>
                  ) : (
                    <span className="text-slate-400">Clique para selecionar...</span>
                  )}
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={(e) => {
                    setArquivo(e.target.files?.[0] ?? null);
                    setResultado(null);
                    setErro(null);
                  }}
                />
              </div>
            </div>

            {/* Resultado da validação */}
            {resultado && (
              <div
                className={`mb-4 p-3.5 rounded-lg border ${
                  (resultado.invalidas ?? 0) > 0
                    ? "bg-amber-50 border-amber-200"
                    : "bg-emerald-50 border-emerald-200"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p
                      className={`text-sm font-semibold ${
                        (resultado.invalidas ?? 0) > 0 ? "text-amber-800" : "text-emerald-800"
                      }`}
                    >
                      {(resultado.invalidas ?? 0) > 0
                        ? "Validado com erros"
                        : "Validado com sucesso"}
                    </p>
                    <p className="text-xs text-slate-600 mt-0.5">
                      {resultado.validas?.toLocaleString("pt-BR")} válidas
                      {(resultado.invalidas ?? 0) > 0 &&
                        ` · ${resultado.invalidas?.toLocaleString("pt-BR")} com erro`}
                    </p>
                  </div>
                  {resultado.importacaoId && (resultado.validas ?? 0) > 0 && (
                    <button
                      onClick={() => handleConfirmar(resultado.importacaoId!, resultado.validas ?? 0)}
                      disabled={isPending || !!confirmando}
                      className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 disabled:opacity-50 transition-colors shrink-0"
                    >
                      {isPending ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      )}
                      Confirmar importação
                    </button>
                  )}
                </div>
                {(resultado.errosAmostra?.length ?? 0) > 0 && (
                  <div className="mt-2">
                    <button
                      onClick={() => setExpandidoErros(!expandidoErros)}
                      className="text-xs text-amber-700 flex items-center gap-1"
                    >
                      {expandidoErros ? (
                        <ChevronUp className="w-3 h-3" />
                      ) : (
                        <ChevronDown className="w-3 h-3" />
                      )}
                      Ver erros ({resultado.errosAmostra?.length} amostras)
                    </button>
                    {expandidoErros && (
                      <div className="mt-2 space-y-0.5">
                        {resultado.errosAmostra?.map((e, i) => (
                          <p key={i} className="text-xs text-red-700 font-mono">
                            {e}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {erro && (
              <div className="mb-4 flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3.5 py-2.5">
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                <p className="text-xs text-red-700">{erro}</p>
              </div>
            )}

            {/* Barra de progresso */}
            {progresso && (
              <div className="mb-4 space-y-2">
                <div className="flex justify-between text-xs text-slate-500">
                  <span>{progresso.fase}</span>
                  <span>
                    {progresso.total > 0
                      ? Math.round((progresso.atual / progresso.total) * 100)
                      : 0}%
                  </span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                    style={{
                      width:
                        progresso.total > 0
                          ? `${(progresso.atual / progresso.total) * 100}%`
                          : "0%",
                    }}
                  />
                </div>
                <p className="text-xs text-slate-400">
                  {progresso.atual.toLocaleString("pt-BR")} de{" "}
                  {progresso.total.toLocaleString("pt-BR")} linhas
                </p>
              </div>
            )}

            <button
              onClick={handleUpload}
              disabled={!arquivo || uploading || !lojaId}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-slate-900 text-white rounded-lg hover:bg-slate-700 disabled:opacity-50 transition-colors"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Processando...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" /> Enviar e validar
                </>
              )}
            </button>
          </>
        )}
      </div>

      {/* Histórico de importações */}
      {importacoes.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100">
            <h3 className="text-sm font-semibold text-slate-800">Histórico de importações</h3>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Entidade
                </th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Arquivo
                </th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Linhas
                </th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Data
                </th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {importacoes.map((imp) => (
                <tr key={imp.id} className="hover:bg-slate-50/50">
                  <td className="px-4 py-3 font-medium text-slate-700 capitalize">
                    {imp.entidade.replace(/_/g, " ")}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500 font-mono truncate max-w-32">
                    {imp.arquivo_nome}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600">
                    {imp.total_linhas?.toLocaleString("pt-BR")}
                    {(imp.linhas_invalidas ?? 0) > 0 && (
                      <span className="text-red-500 ml-1">({imp.linhas_invalidas} erros)</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={imp.status} />
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {formatarData(imp.iniciado_em)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      {imp.status === "validado" && (
                        <button
                          onClick={() => handleConfirmar(imp.id, imp.linhas_validas ?? 0)}
                          disabled={isPending || !!confirmando}
                          className="text-xs text-emerald-600 hover:text-emerald-800 font-medium flex items-center gap-1 disabled:opacity-50"
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          Confirmar
                        </button>
                      )}
                      {imp.status === "concluido" && (
                        <button
                          onClick={() => handleReverter(imp.id)}
                          disabled={isPending}
                          className="text-xs text-red-500 hover:text-red-700 font-medium flex items-center gap-1 disabled:opacity-50"
                          title="Reverter importação"
                        >
                          <RotateCcw className="w-3 h-3" />
                          Reverter
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
