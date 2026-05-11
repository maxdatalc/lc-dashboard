// Placeholder do módulo Financeiro — contas a receber e inadimplência
import { Landmark } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function FinanceiroPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-slate-900">Financeiro</h1>
      <p className="text-slate-500 text-sm mt-1">Contas a receber e inadimplência</p>

      <div className="mt-16 flex flex-col items-center gap-4 text-center">
        <Landmark className="h-16 w-16 text-slate-300" />
        <p className="text-slate-500 font-medium">Sincronizando dados financeiros...</p>
        <p className="text-slate-400 text-sm">Este módulo estará disponível em breve.</p>
        <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">
          Em desenvolvimento
        </Badge>
      </div>
    </div>
  );
}
