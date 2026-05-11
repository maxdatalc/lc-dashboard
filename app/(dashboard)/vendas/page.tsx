// Placeholder do módulo Vendas — histórico e análise de vendas
import { ShoppingCart } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function VendasPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-slate-900">Vendas</h1>
      <p className="text-slate-500 text-sm mt-1">Histórico e análise de vendas</p>

      <div className="mt-16 flex flex-col items-center gap-4 text-center">
        <ShoppingCart className="h-16 w-16 text-slate-300" />
        <p className="text-slate-500 font-medium">Sincronizando histórico de vendas...</p>
        <p className="text-slate-400 text-sm">Este módulo estará disponível em breve.</p>
        <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">
          Em desenvolvimento
        </Badge>
      </div>
    </div>
  );
}
