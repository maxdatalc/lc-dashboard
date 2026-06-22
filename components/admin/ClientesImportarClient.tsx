"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Upload, FileSpreadsheet, X, Check, Loader2, AlertCircle, ArrowLeft } from "lucide-react";
import * as XLSX from "xlsx";
import Link from "next/link";

type ClienteRow = {
  codigo_externo: string;
  razao_social: string;
  nome_fantasia: string;
  cnpj_cpf: string;
  segmento: string;
  cidade: string;
  telefone: string;
};

type ImportStatus = "idle" | "preview" | "importing" | "done" | "error";

function parseSheet(workbook: XLSX.WorkBook): ClienteRow[] {
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" }) as unknown[][];

  if (rows.length === 0) return [];

  // Detecta se a primeira linha é cabeçalho (primeira célula é texto, não número)
  const firstCell = String(rows[0][0] ?? "").trim();
  const isHeader = isNaN(Number(firstCell)) && firstCell.length > 0;
  const dataRows = isHeader ? rows.slice(1) : rows;

  return dataRows
    .filter((row) => row.some((cell) => String(cell).trim() !== ""))
    .map((row) => ({
      codigo_externo: String(row[0] ?? "").trim(),
      razao_social:   String(row[1] ?? "").trim(),
      nome_fantasia:  String(row[2] ?? "").trim(),
      cnpj_cpf:       String(row[3] ?? "").trim(),
      segmento:       String(row[4] ?? "").trim(),
      cidade:         String(row[5] ?? "").trim(),
      telefone:       String(row[6] ?? "").trim(),
    }))
    .filter((r) => r.razao_social.length > 0);
}

function contarUnicos(rows: ClienteRow[], key: keyof ClienteRow): number {
  return new Set(rows.map((r) => r[key]).filter(Boolean)).size;
}

export function ClientesImportarClient() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<ClienteRow[]>([]);
  const [status, setStatus] = useState<ImportStatus>("idle");
  const [resultado, setResultado] = useState<{ inseridos: number; atualizados: number } | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const processFile = useCallback((file: File) => {
    setErro(null);
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const parsed = parseSheet(wb);
        if (parsed.length === 0) {
          setErro("Nenhum dado encontrado no arquivo. Verifique o formato.");
          setStatus("idle");
          return;
        }
        setRows(parsed);
        setStatus("preview");
      } catch {
        setErro("Não foi possível ler o arquivo. Verifique se é um XLSX ou CSV válido.");
        setStatus("idle");
      }
    };
    reader.readAsArrayBuffer(file);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleImport = async () => {
    setStatus("importing");
    setErro(null);
    try {
      const res = await fetch("/api/admin/clientes/importar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientes: rows }),
      });
      const data = (await res.json()) as { inseridos?: number; atualizados?: number; error?: string };
      if (!res.ok) {
        setErro(data.error ?? "Erro ao importar.");
        setStatus("error");
        return;
      }
      setResultado({ inseridos: data.inseridos ?? 0, atualizados: data.atualizados ?? 0 });
      setStatus("done");
    } catch {
      setErro("Erro de rede. Tente novamente.");
      setStatus("error");
    }
  };

  const resetar = () => {
    setStatus("idle");
    setRows([]);
    setFileName(null);
    setErro(null);
    setResultado(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  // ── Tela de sucesso ──────────────────────────────────────────────────────────
  if (status === "done" && resultado) {
    return (
      <div className="p-6 max-w-xl mx-auto text-center space-y-6" style={{ animation: "fadeInUp 0.3s ease-out both" }}>
        <div className="mx-auto flex items-center justify-center w-16 h-16 rounded-full bg-emerald-50 border border-emerald-200">
          <Check className="h-7 w-7 text-emerald-500" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-900">Importação concluída</h2>
          <p className="text-slate-500 mt-1.5 text-sm">
            {resultado.inseridos > 0 && (
              <span><strong className="text-slate-800">{resultado.inseridos}</strong> novo{resultado.inseridos !== 1 ? "s" : ""} inserido{resultado.inseridos !== 1 ? "s" : ""}</span>
            )}
            {resultado.inseridos > 0 && resultado.atualizados > 0 && " · "}
            {resultado.atualizados > 0 && (
              <span><strong className="text-slate-800">{resultado.atualizados}</strong> atualizado{resultado.atualizados !== 1 ? "s" : ""}</span>
            )}
          </p>
        </div>
        <div className="flex gap-3 justify-center">
          <button
            onClick={resetar}
            className="px-4 py-2 text-sm border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Nova importação
          </button>
          <button
            onClick={() => router.push("/admin/clientes")}
            className="px-4 py-2 text-sm bg-slate-900 text-white rounded-lg hover:bg-slate-700 transition-colors font-medium"
          >
            Ver clientes
          </button>
        </div>
      </div>
    );
  }

  // ── Tela de prévia ───────────────────────────────────────────────────────────
  if (status === "preview" || status === "importing" || status === "error") {
    const segmentos = contarUnicos(rows, "segmento");
    const cidades   = contarUnicos(rows, "cidade");

    return (
      <div className="p-6 space-y-5" style={{ animation: "fadeInUp 0.25s ease-out both" }}>

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={resetar} className="text-slate-400 hover:text-slate-700 transition-colors">
              <X className="h-5 w-5" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5 text-emerald-500" />
                <h2 className="text-base font-semibold text-slate-900">{fileName}</h2>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {rows.length} registros · {segmentos} segmentos · {cidades} cidades
              </p>
            </div>
          </div>

          <button
            onClick={handleImport}
            disabled={status === "importing"}
            className="inline-flex items-center gap-2 px-5 py-2 bg-slate-900 text-white text-sm font-semibold rounded-lg hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {status === "importing" ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Importando...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" />
                Importar {rows.length} clientes
              </>
            )}
          </button>
        </div>

        {/* Mapeamento de colunas */}
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Mapeamento de colunas</p>
          <div className="flex flex-wrap gap-x-6 gap-y-1.5">
            {[
              ["Col. A", "Código externo"],
              ["Col. B", "Razão Social"],
              ["Col. C", "Nome Fantasia"],
              ["Col. D", "CNPJ / CPF"],
              ["Col. E", "Segmento"],
              ["Col. F", "Cidade"],
              ["Col. G", "Telefone"],
            ].map(([col, campo]) => (
              <div key={col} className="flex items-center gap-1.5">
                <span className="font-mono text-xs bg-white border border-slate-200 px-1.5 py-0.5 rounded text-slate-500">{col}</span>
                <span className="text-xs text-slate-600">→</span>
                <span className="text-xs font-medium text-slate-700">{campo}</span>
              </div>
            ))}
          </div>
        </div>

        {erro && (
          <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {erro}
          </div>
        )}

        {/* Prévia da tabela */}
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Prévia — primeiros 10 registros
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50">
                  <th className="text-left px-3 py-2 font-semibold text-slate-500 whitespace-nowrap">Código</th>
                  <th className="text-left px-3 py-2 font-semibold text-slate-500 whitespace-nowrap">Razão Social</th>
                  <th className="text-left px-3 py-2 font-semibold text-slate-500 whitespace-nowrap">Nome Fantasia</th>
                  <th className="text-left px-3 py-2 font-semibold text-slate-500 whitespace-nowrap">CNPJ/CPF</th>
                  <th className="text-left px-3 py-2 font-semibold text-slate-500 whitespace-nowrap">Segmento</th>
                  <th className="text-left px-3 py-2 font-semibold text-slate-500 whitespace-nowrap">Cidade</th>
                  <th className="text-left px-3 py-2 font-semibold text-slate-500 whitespace-nowrap">Telefone</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {rows.slice(0, 10).map((row, i) => (
                  <tr key={i} className="hover:bg-slate-50 transition-colors">
                    <td className="px-3 py-2 font-mono text-slate-400">{row.codigo_externo || "—"}</td>
                    <td className="px-3 py-2 text-slate-700 max-w-[180px] truncate">{row.razao_social}</td>
                    <td className="px-3 py-2 text-slate-700 max-w-[160px] truncate">{row.nome_fantasia || "—"}</td>
                    <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{row.cnpj_cpf || "—"}</td>
                    <td className="px-3 py-2 text-slate-500 max-w-[140px] truncate">{row.segmento || "—"}</td>
                    <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{row.cidade || "—"}</td>
                    <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{row.telefone || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.length > 10 && (
            <div className="px-4 py-2 border-t border-slate-50 text-xs text-slate-400 text-center">
              + {rows.length - 10} registros não exibidos
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Tela inicial — drag & drop ───────────────────────────────────────────────
  return (
    <div className="p-6 max-w-2xl mx-auto space-y-5" style={{ animation: "fadeInUp 0.3s ease-out both" }}>

      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/admin/clientes" className="text-slate-400 hover:text-slate-700 transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Importar clientes</h1>
          <p className="text-sm text-slate-400 mt-0.5">Formatos aceitos: XLSX, XLS, CSV</p>
        </div>
      </div>

      {/* Drop zone */}
      <div
        onDragEnter={(e) => { e.preventDefault(); setDragging(true); }}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className="cursor-pointer rounded-2xl border-2 border-dashed flex flex-col items-center justify-center py-16 px-8 text-center transition-all duration-200 select-none"
        style={{
          borderColor: dragging ? "#0f172a" : "#cbd5e1",
          backgroundColor: dragging ? "#f8fafc" : "white",
          transform: dragging ? "scale(1.01)" : "scale(1)",
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={handleFileChange}
        />

        <div
          className="flex items-center justify-center w-16 h-16 rounded-2xl mb-5 transition-colors"
          style={{ background: dragging ? "#0f172a" : "#f1f5f9" }}
        >
          <FileSpreadsheet
            className="h-8 w-8 transition-colors"
            style={{ color: dragging ? "white" : "#64748b" }}
          />
        </div>

        <p className="text-lg font-semibold text-slate-900 mb-1">
          {dragging ? "Solte o arquivo aqui" : "Arraste o arquivo aqui"}
        </p>
        <p className="text-sm text-slate-400 mb-5">
          ou clique para selecionar do computador
        </p>

        <div
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors"
          style={{ background: dragging ? "transparent" : "#0f172a", color: dragging ? "#0f172a" : "white" }}
        >
          <Upload className="h-4 w-4" />
          Selecionar arquivo
        </div>
      </div>

      {erro && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {erro}
        </div>
      )}

      {/* Guia de formato */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Formato esperado da planilha</p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr>
                <th className="text-left py-1.5 px-2 font-semibold text-slate-400 bg-white rounded-tl">Coluna</th>
                <th className="text-left py-1.5 px-2 font-semibold text-slate-400 bg-white">Campo</th>
                <th className="text-left py-1.5 px-2 font-semibold text-slate-400 bg-white rounded-tr">Exemplo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {[
                ["A", "Código externo", "891"],
                ["B", "Razão Social",   "J. DE R. L. PARRIAO - EPP"],
                ["C", "Nome Fantasia",  "DENTAL AMAZONIA"],
                ["D", "CNPJ / CPF",     "04.340.683/0001-87"],
                ["E", "Segmento",       "HOSPITALAR / DENTAL"],
                ["F", "Cidade",         "MARABÁ"],
                ["G", "Telefone",       "(94) 9973-2262"],
              ].map(([col, campo, ex]) => (
                <tr key={col}>
                  <td className="py-1.5 px-2 font-mono text-slate-500 font-semibold">{col}</td>
                  <td className="py-1.5 px-2 text-slate-700">{campo}</td>
                  <td className="py-1.5 px-2 text-slate-400 italic">{ex}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-slate-400">
          Cabeçalho é opcional — se a planilha não tiver cabeçalho, os dados começam na primeira linha.
        </p>
      </div>
    </div>
  );
}
