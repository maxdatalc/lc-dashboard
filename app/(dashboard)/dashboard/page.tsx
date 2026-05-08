// Página principal do dashboard — KPIs mockados, sem chamadas de API ainda
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, TrendingUp, AlertCircle, Users } from "lucide-react";
import type { DashboardKPI } from "@/types";

// Dados estáticos — serão substituídos por dados reais do ERP MaxManager
const kpiData: DashboardKPI = {
  vendas: 0,
  faturamento: 0,
  contasAVencer: 0,
  clientesAtivos: 0,
};

function formatCurrency(value: number): string {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export default function DashboardPage() {
  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-slate-500 text-sm mt-1">
          Visão geral do seu negócio
        </p>
      </div>

      {/* Cards de KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">
              Vendas do dia
            </CardTitle>
            <DollarSign className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-slate-900">
              {formatCurrency(kpiData.vendas)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">
              Faturamento do mês
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-slate-900">
              {formatCurrency(kpiData.faturamento)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">
              Contas a vencer
            </CardTitle>
            <AlertCircle className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-slate-900">
              {kpiData.contasAVencer}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">
              Clientes ativos
            </CardTitle>
            <Users className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-slate-900">
              {kpiData.clientesAtivos}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Status da conexão com ERP */}
      <div className="flex items-center gap-2 text-slate-400 text-sm">
        <span className="inline-block h-2 w-2 rounded-full bg-yellow-400 animate-pulse" />
        Conectando ao ERP...
      </div>
    </div>
  );
}
