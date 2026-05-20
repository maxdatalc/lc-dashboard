"use client";

// Tela de sincronização inicial — importa todo o histórico do ERP
// Deve ser aberta uma única vez após o cadastro do cliente

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Database, Loader2, CheckCircle, AlertCircle,
} from "lucide-react";

// ── Tipos ──────────────────────────────────────────────────────────────────

type Etapa = "idle" | "clientes" | "produtos" | "vendas" | "concluido" | "erro";

interface Stats {
  clientes: number;
  produtos: number;
  vendas: number;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function gerarMeses(): { ano: number; mes: number; label: string }[] {
  const meses = [];
  const hoje = new Date();
  for (let i = 12; i >= 0; i--) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
    meses.push({
      ano: d.getFullYear(),
      mes: d.getMonth() + 1,
      label: d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }),
    });
  }
  return meses;
}

const MESES = gerarMeses();

// ── Componente indicador de etapa ──────────────────────────────────────────

function EtapaIndicador({ etapaAtual }: { etapaAtual: Etapa }) {
  const etapas: { key: Etapa; label: string }[] = [
    { key: "clientes", label: "Clientes" },
    { key: "produtos", label: "Produtos" },
    { key: "vendas", label: "Vendas" },
  ];

  const ordemEtapas: Record<string, number> = {
    idle: 0, clientes: 1, produtos: 2, vendas: 3, concluido: 4, erro: 0,
  };

  const ordemAtual = ordemEtapas[etapaAtual] ?? 0;

  return (
    <div className="flex items-center justify-center gap-0 mt-2">
      {etapas.map((e, idx) => {
        const ordemEtapa = idx + 1;
        const concluida = ordemAtual > ordemEtapa;
        const ativa = ordemAtual === ordemEtapa;

        return (
          <div key={e.key} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                  concluida
                    ? "bg-green-500 text-white"
                    : ativa
                    ? "bg-blue-500 text-white"
                    : "bg-slate-600 text-slate-400"
                }`}
              >
                {concluida ? "✓" : idx + 1}
              </div>
              <span className={`text-xs mt-1 ${ativa ? "text-blue-400" : "text-slate-500"}`}>
                {e.label}
              </span>
            </div>
            {idx < etapas.length - 1 && (
              <div
                className={`w-16 h-0.5 mb-5 transition-colors ${
                  ordemAtual > ordemEtapa ? "bg-green-500" : "bg-slate-600"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Grid de stats ──────────────────────────────────────────────────────────

function StatsGrid({ stats }: { stats: Stats }) {
  return (
    <div className="grid grid-cols-3 gap-3 mt-6">
      {[
        { label: "Clientes", valor: stats.clientes, cor: "text-green-400" },
        { label: "Produtos", valor: stats.produtos, cor: "text-blue-400" },
        { label: "Vendas", valor: stats.vendas, cor: "text-purple-400" },
      ].map((s) => (
        <div key={s.label} className="bg-slate-700/50 rounded-xl p-4 text-center">
          <p className={`text-2xl font-bold ${s.cor}`}>
            {s.valor.toLocaleString("pt-BR")}
          </p>
          <p className="text-slate-400 text-xs mt-1">{s.label}</p>
        </div>
      ))}
    </div>
  );
}

// ── Componente principal ───────────────────────────────────────────────────

export default function SincronizacaoInicialPage() {
  const router = useRouter();
  const [etapa, setEtapa] = useState<Etapa>("idle");
  const [progresso, setProgresso] = useState(0);
  const [mensagem, setMensagem] = useState("");
  const [submensagem, setSubmensagem] = useState("");
  const [stats, setStats] = useState<Stats>({ clientes: 0, produtos: 0, vendas: 0 });
  const [erroMsg, setErroMsg] = useState("");
  const [iniciado, setIniciado] = useState(false);

  async function iniciarSyncCompleto() {
    setIniciado(true);
    setErroMsg("");

    try {
      // ── Etapa 1: Clientes (loop de chunks — suporta 130.000+ registros) ────
      setEtapa("clientes");

      let clientesOffset = 0;
      let clientesTotal = 0;
      let clientesPaginasProcessadas = 0;
      let clientesTotalPaginas = 9999;

      while (clientesPaginasProcessadas < clientesTotalPaginas) {
        setMensagem("Importando cadastro de clientes...");
        const percentClientes = clientesTotalPaginas < 9999
          ? Math.round((clientesPaginasProcessadas / clientesTotalPaginas) * 100)
          : 0;
        setSubmensagem(
          clientesTotalPaginas < 9999
            ? `${clientesTotal.toLocaleString("pt-BR")} clientes importados ` +
              `(${percentClientes}% — página ${clientesPaginasProcessadas} de ${clientesTotalPaginas})`
            : "Conectando ao ERP..."
        );

        const resp1 = await fetch("/api/sync/clientes-chunk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ offset: clientesOffset }),
        });
        const r1 = await resp1.json() as {
          success?: boolean;
          error?: string;
          sincronizados?: number;
          totalPaginas?: number;
          paginasProcessadas?: number;
          concluido?: boolean;
          proximoOffset?: number;
        };
        console.log("[sync] Clientes:", r1);

        if (!r1.success) throw new Error(r1.error ?? "Erro no chunk de clientes");

        clientesTotal += r1.sincronizados ?? 0;
        clientesTotalPaginas = r1.totalPaginas ?? clientesTotalPaginas;
        clientesPaginasProcessadas = r1.paginasProcessadas ?? clientesPaginasProcessadas;
        clientesOffset = r1.proximoOffset ?? clientesOffset;

        setStats((s) => ({ ...s, clientes: clientesTotal }));
        const progClientes = Math.round((clientesPaginasProcessadas / clientesTotalPaginas) * 15);
        setProgresso(Math.min(15, progClientes));

        if (r1.concluido === true) break;
      }

      setProgresso(15);

      // ── Etapa 2: Produtos (loop por chunks) ──────────────────────────────
      setEtapa("produtos");

      let offset = 0;
      let produtosTotal = 0;
      let paginasProcessadas = 0;
      let totalPaginas = 999;

      while (paginasProcessadas < totalPaginas) {
        setMensagem("Importando catálogo de produtos...");
        setSubmensagem(
          `Processando página ${paginasProcessadas + 1} de ~${Math.ceil(totalPaginas / 60) * 60}`
        );

        const resp2 = await fetch("/api/sync/produtos-chunk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ offset }),
        });
        const r2 = await resp2.json() as {
          success?: boolean;
          error?: string;
          sincronizados?: number;
          totalPaginas?: number;
          paginasProcessadas?: number;
          concluido?: boolean;
        };
        console.log("[sync] Produtos chunk:", r2);

        if (!r2 || !r2.success) {
          throw new Error("Erro no chunk de produtos: " + (r2?.error ?? "resposta inválida"));
        }

        produtosTotal += r2.sincronizados ?? 0;
        totalPaginas = r2.totalPaginas ?? totalPaginas;
        paginasProcessadas = r2.paginasProcessadas ?? paginasProcessadas + 60;
        offset = paginasProcessadas * 50;

        setStats((s) => ({ ...s, produtos: produtosTotal }));
        const progressoProdutos = 15 + Math.round((paginasProcessadas / totalPaginas) * 20);
        setProgresso(Math.min(35, progressoProdutos));

        if (r2.concluido === true) break;
      }

      setProgresso(35);

      // ── Etapa 3: Vendas mês a mês ─────────────────────────────────────────
      setEtapa("vendas");
      let vendasTotal = 0;

      for (let i = 0; i < MESES.length; i++) {
        const { ano, mes, label } = MESES[i];
        setMensagem(`Importando vendas — ${label}`);
        setSubmensagem(`Mês ${i + 1} de ${MESES.length}`);

        const resp3 = await fetch("/api/sync/mes-vendas", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ano, mes }),
        });
        const r3 = await resp3.json() as { vendas?: number; success?: boolean; error?: string };
        console.log("[sync] Mês:", r3);

        vendasTotal += r3.vendas ?? 0;
        setStats((s) => ({ ...s, vendas: vendasTotal }));

        const progressoVendas = 35 + Math.round(((i + 1) / MESES.length) * 60);
        setProgresso(progressoVendas);
      }

      // ── Concluído ─────────────────────────────────────────────────────────
      setEtapa("concluido");
      setProgresso(100);
      setMensagem("Sincronização concluída!");
      setSubmensagem("O dashboard está pronto para uso");
      setTimeout(() => router.push("/dashboard"), 3000);
    } catch (e) {
      setEtapa("erro");
      setErroMsg(e instanceof Error ? e.message : "Erro desconhecido");
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6">
      <div className="max-w-lg w-full bg-slate-800 rounded-2xl p-8 shadow-2xl">

        {/* Logo e badge */}
        <div className="flex items-center gap-3 mb-6">
          <span className="text-white font-bold text-xl">LC Dashboard</span>
          <span className="text-xs font-semibold bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded">
            Configuração Inicial
          </span>
        </div>

        {/* ── Estado: idle ────────────────────────────────────────────────── */}
        {etapa === "idle" && (
          <div className="text-center">
            <Database className="h-16 w-16 text-blue-400 mx-auto my-6 animate-pulse" />
            <h1 className="text-white text-2xl font-bold">Sincronização Inicial do ERP</h1>
            <p className="text-slate-400 mt-3 text-sm leading-relaxed">
              Vamos importar todo o histórico do MaxData para o dashboard.
              Este processo leva entre 20 e 40 minutos dependendo do
              volume de dados do cliente.
            </p>

            {/* Cards informativos */}
            <div className="grid grid-cols-3 gap-3 mt-6">
              {[
                { emoji: "📋", titulo: "Clientes", desc: "Cadastros completos" },
                { emoji: "📦", titulo: "Produtos", desc: "Catálogo e estoque" },
                { emoji: "💰", titulo: "Vendas", desc: "Últimos 13 meses" },
              ].map((c) => (
                <div key={c.titulo} className="bg-slate-700/50 rounded-xl p-4">
                  <div className="text-2xl mb-1">{c.emoji}</div>
                  <p className="text-white text-sm font-medium">{c.titulo}</p>
                  <p className="text-slate-400 text-xs mt-0.5">{c.desc}</p>
                </div>
              ))}
            </div>

            {/* Aviso volume */}
            <div className="mt-5 bg-slate-700/50 border border-slate-600/50 rounded-lg px-4 py-2.5">
              <p className="text-slate-400 text-xs leading-relaxed">
                Para clientes com grande volume de dados (100.000+ registros),
                recomendamos iniciar a sincronização fora do horário comercial.
              </p>
            </div>

            {/* Aviso não fechar */}
            <div className="mt-2 bg-amber-500/10 border border-amber-500/20 rounded-lg px-4 py-2.5">
              <p className="text-amber-400 text-xs">
                ⚠ Não feche esta aba durante a sincronização
              </p>
            </div>

            <button
              onClick={iniciarSyncCompleto}
              disabled={iniciado}
              className="mt-6 w-full bg-blue-600 hover:bg-blue-500 text-white rounded-xl px-8 py-4 text-lg font-semibold disabled:opacity-60 transition-colors"
            >
              Iniciar Sincronização
            </button>
          </div>
        )}

        {/* ── Estado: em progresso ─────────────────────────────────────────── */}
        {etapa !== "idle" && etapa !== "concluido" && etapa !== "erro" && (
          <div>
            <EtapaIndicador etapaAtual={etapa} />

            <p className="text-white text-xl font-semibold mt-6">{mensagem}</p>
            <p className="text-slate-400 text-sm mt-1">{submensagem}</p>

            {/* Barra de progresso */}
            <div className="mt-6">
              <div className="bg-slate-700 rounded-full h-3 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-blue-500 to-blue-400 h-3 rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${progresso}%` }}
                />
              </div>
              <p className="text-slate-400 text-xs mt-2 text-right">{progresso}% concluído</p>
            </div>

            <StatsGrid stats={stats} />

            <div className="flex justify-center mt-4">
              <Loader2 className="h-5 w-5 text-blue-400 animate-spin" />
            </div>

            <div className="mt-4 bg-amber-500/10 border border-amber-500/20 rounded-lg px-4 py-2">
              <p className="text-amber-400 text-xs text-center">
                Não feche esta aba — sincronização em andamento
              </p>
            </div>
          </div>
        )}

        {/* ── Estado: concluido ────────────────────────────────────────────── */}
        {etapa === "concluido" && (
          <div className="text-center">
            <CheckCircle className="h-16 w-16 text-green-400 mx-auto mb-4 animate-bounce" />
            <h2 className="text-white text-2xl font-bold">Sincronização Concluída!</h2>
            <StatsGrid stats={stats} />
            <p className="text-slate-400 text-sm mt-6">Redirecionando para o dashboard...</p>
          </div>
        )}

        {/* ── Estado: erro ─────────────────────────────────────────────────── */}
        {etapa === "erro" && (
          <div className="text-center">
            <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
            <h2 className="text-white text-xl font-semibold">Erro na sincronização</h2>
            <p className="text-red-400 text-sm mt-2 break-words">{erroMsg}</p>
            <StatsGrid stats={stats} />
            <button
              onClick={iniciarSyncCompleto}
              className="mt-6 w-full bg-blue-600 hover:bg-blue-500 text-white rounded-xl px-6 py-3 font-semibold transition-colors"
            >
              Tentar novamente
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
