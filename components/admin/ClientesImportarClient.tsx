"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Upload, FileSpreadsheet, X, Check, Loader2, AlertCircle, ArrowLeft } from "lucide-react";
import * as XLSX from "xlsx";
import Link from "next/link";
import { AdminCard } from "@/components/admin/AdminCard";
import { AdminButton } from "@/components/admin/AdminButton";
import {
  AdminTable,
  AdminTableHead,
  AdminTh,
  AdminTBody,
  AdminTr,
  AdminTd,
} from "@/components/admin/AdminTable";

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

function ErrorBanner({ text }: { text: string }) {
  return (
    <div
      className="flex items-center gap-2 rounded-lg px-4 py-3 text-sm"
      style={{ background: "var(--adm-alert-soft)", border: "1px solid var(--adm-alert)", color: "var(--adm-alert)" }}
    >
      <AlertCircle className="h-4 w-4 shrink-0" />
      {text}
    </div>
  );
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
      <div className="adm-rise mx-auto max-w-xl space-y-6 p-6 text-center">
        <div
          className="mx-auto flex h-16 w-16 items-center justify-center rounded-full"
          style={{ background: "var(--adm-signal-soft)", border: "1px solid var(--adm-signal)" }}
        >
          <Check className="h-7 w-7" style={{ color: "var(--adm-signal)" }} />
        </div>
        <div>
          <h2 className="text-xl font-bold" style={{ color: "var(--adm-text)" }}>Importação concluída</h2>
          <p className="mt-1.5 text-sm" style={{ color: "var(--adm-text-dim)" }}>
            {resultado.inseridos > 0 && (
              <span><strong style={{ color: "var(--adm-text)" }}>{resultado.inseridos}</strong> novo{resultado.inseridos !== 1 ? "s" : ""} inserido{resultado.inseridos !== 1 ? "s" : ""}</span>
            )}
            {resultado.inseridos > 0 && resultado.atualizados > 0 && " · "}
            {resultado.atualizados > 0 && (
              <span><strong style={{ color: "var(--adm-text)" }}>{resultado.atualizados}</strong> atualizado{resultado.atualizados !== 1 ? "s" : ""}</span>
            )}
          </p>
        </div>
        <div className="flex justify-center gap-3">
          <AdminButton variant="secondary" onClick={resetar}>
            Nova importação
          </AdminButton>
          <AdminButton onClick={() => router.push("/admin/clientes")}>
            Ver clientes
          </AdminButton>
        </div>
      </div>
    );
  }

  // ── Tela de prévia ───────────────────────────────────────────────────────────
  if (status === "preview" || status === "importing" || status === "error") {
    const segmentos = contarUnicos(rows, "segmento");
    const cidades   = contarUnicos(rows, "cidade");

    return (
      <div className="adm-rise space-y-5 p-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={resetar} className="adm-focusable rounded transition-colors" style={{ color: "var(--adm-text-faint)" }}>
              <X className="h-5 w-5" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5" style={{ color: "var(--adm-signal)" }} />
                <h2 className="text-base font-semibold" style={{ color: "var(--adm-text)" }}>{fileName}</h2>
              </div>
              <p className="mt-0.5 text-xs" style={{ color: "var(--adm-text-faint)" }}>
                {rows.length} registros · {segmentos} segmentos · {cidades} cidades
              </p>
            </div>
          </div>

          <AdminButton onClick={handleImport} disabled={status === "importing"}>
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
          </AdminButton>
        </div>

        {/* Mapeamento de colunas */}
        <div className="rounded-xl px-4 py-3" style={{ background: "var(--adm-surface-2)", border: "1px solid var(--adm-line)" }}>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--adm-text-faint)" }}>Mapeamento de colunas</p>
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
                <span
                  className="adm-mono rounded px-1.5 py-0.5 text-xs"
                  style={{ background: "var(--adm-surface)", border: "1px solid var(--adm-line-strong)", color: "var(--adm-text-dim)" }}
                >
                  {col}
                </span>
                <span className="text-xs" style={{ color: "var(--adm-text-dim)" }}>→</span>
                <span className="text-xs font-medium" style={{ color: "var(--adm-text)" }}>{campo}</span>
              </div>
            ))}
          </div>
        </div>

        {erro && <ErrorBanner text={erro} />}

        {/* Prévia da tabela */}
        <div>
          <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--adm-text-faint)" }}>
            Prévia — primeiros 10 registros
          </p>
          <AdminTable>
            <AdminTableHead>
              <AdminTh>Código</AdminTh>
              <AdminTh>Razão Social</AdminTh>
              <AdminTh hideBelow="sm">Nome Fantasia</AdminTh>
              <AdminTh hideBelow="sm">CNPJ/CPF</AdminTh>
              <AdminTh hideBelow="md">Segmento</AdminTh>
              <AdminTh hideBelow="md">Cidade</AdminTh>
              <AdminTh hideBelow="md">Telefone</AdminTh>
            </AdminTableHead>
            <AdminTBody>
              {rows.slice(0, 10).map((row, i) => (
                <AdminTr key={i} noBorder={i === 0}>
                  <AdminTd className="adm-mono text-xs" style={{ color: "var(--adm-text-faint)" }}>{row.codigo_externo || "—"}</AdminTd>
                  <AdminTd className="max-w-[180px] truncate text-xs">{row.razao_social}</AdminTd>
                  <AdminTd hideBelow="sm" className="max-w-[160px] truncate text-xs" style={{ color: "var(--adm-text-dim)" }}>{row.nome_fantasia || "—"}</AdminTd>
                  <AdminTd hideBelow="sm" className="adm-mono whitespace-nowrap text-xs" style={{ color: "var(--adm-text-dim)" }}>{row.cnpj_cpf || "—"}</AdminTd>
                  <AdminTd hideBelow="md" className="max-w-[140px] truncate text-xs" style={{ color: "var(--adm-text-dim)" }}>{row.segmento || "—"}</AdminTd>
                  <AdminTd hideBelow="md" className="whitespace-nowrap text-xs" style={{ color: "var(--adm-text-dim)" }}>{row.cidade || "—"}</AdminTd>
                  <AdminTd hideBelow="md" className="whitespace-nowrap text-xs" style={{ color: "var(--adm-text-dim)" }}>{row.telefone || "—"}</AdminTd>
                </AdminTr>
              ))}
            </AdminTBody>
          </AdminTable>
          {rows.length > 10 && (
            <p className="mt-2 text-center text-xs" style={{ color: "var(--adm-text-faint)" }}>
              + {rows.length - 10} registros não exibidos
            </p>
          )}
        </div>
      </div>
    );
  }

  // ── Tela inicial — drag & drop ───────────────────────────────────────────────
  return (
    <div className="adm-rise mx-auto max-w-2xl space-y-5 p-6">

      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/admin/clientes" className="adm-focusable rounded transition-colors" style={{ color: "var(--adm-text-faint)" }}>
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-xl font-bold" style={{ color: "var(--adm-text)" }}>Importar clientes</h1>
          <p className="mt-0.5 text-sm" style={{ color: "var(--adm-text-faint)" }}>Formatos aceitos: XLSX, XLS, CSV</p>
        </div>
      </div>

      {/* Drop zone */}
      <div
        onDragEnter={(e) => { e.preventDefault(); setDragging(true); }}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className="flex select-none flex-col items-center justify-center rounded-2xl border-2 border-dashed px-8 py-16 text-center transition-all duration-200"
        style={{
          cursor: "pointer",
          borderColor: dragging ? "var(--adm-accent)" : "var(--adm-line-strong)",
          backgroundColor: dragging ? "var(--adm-accent-soft)" : "var(--adm-surface)",
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
          className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl transition-colors"
          style={{ background: dragging ? "var(--adm-accent)" : "var(--adm-surface-2)" }}
        >
          <FileSpreadsheet
            className="h-8 w-8 transition-colors"
            style={{ color: dragging ? "#04121a" : "var(--adm-text-faint)" }}
          />
        </div>

        <p className="mb-1 text-lg font-semibold" style={{ color: "var(--adm-text)" }}>
          {dragging ? "Solte o arquivo aqui" : "Arraste o arquivo aqui"}
        </p>
        <p className="mb-5 text-sm" style={{ color: "var(--adm-text-faint)" }}>
          ou clique para selecionar do computador
        </p>

        <div
          className="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold transition-colors"
          style={{
            background: dragging ? "transparent" : "var(--adm-accent)",
            color: dragging ? "var(--adm-accent)" : "#04121a",
          }}
        >
          <Upload className="h-4 w-4" />
          Selecionar arquivo
        </div>
      </div>

      {erro && <ErrorBanner text={erro} />}

      {/* Guia de formato */}
      <AdminCard className="space-y-3 p-4">
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--adm-text-faint)" }}>Formato esperado da planilha</p>
        <AdminTable>
          <AdminTableHead>
            <AdminTh>Coluna</AdminTh>
            <AdminTh>Campo</AdminTh>
            <AdminTh hideBelow="sm">Exemplo</AdminTh>
          </AdminTableHead>
          <AdminTBody>
            {[
              ["A", "Código externo", "891"],
              ["B", "Razão Social",   "J. DE R. L. PARRIAO - EPP"],
              ["C", "Nome Fantasia",  "DENTAL AMAZONIA"],
              ["D", "CNPJ / CPF",     "04.340.683/0001-87"],
              ["E", "Segmento",       "HOSPITALAR / DENTAL"],
              ["F", "Cidade",         "MARABÁ"],
              ["G", "Telefone",       "(94) 9973-2262"],
            ].map(([col, campo, ex], i) => (
              <AdminTr key={col} noBorder={i === 0}>
                <AdminTd className="adm-mono text-xs font-semibold" style={{ color: "var(--adm-text-dim)" }}>{col}</AdminTd>
                <AdminTd className="text-xs">{campo}</AdminTd>
                <AdminTd hideBelow="sm" className="text-xs italic" style={{ color: "var(--adm-text-faint)" }}>{ex}</AdminTd>
              </AdminTr>
            ))}
          </AdminTBody>
        </AdminTable>
        <p className="text-xs" style={{ color: "var(--adm-text-faint)" }}>
          Cabeçalho é opcional — se a planilha não tiver cabeçalho, os dados começam na primeira linha.
        </p>
      </AdminCard>
    </div>
  );
}
