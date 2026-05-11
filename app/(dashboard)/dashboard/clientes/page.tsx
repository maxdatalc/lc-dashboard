// Placeholder do módulo Clientes — cadastro e análise de clientes
import { Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function ClientesPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-slate-900">Clientes</h1>
      <p className="text-slate-500 text-sm mt-1">Cadastro e análise de clientes</p>

      <div className="mt-16 flex flex-col items-center gap-4 text-center">
        <Users className="h-16 w-16 text-slate-300" />
        <p className="text-slate-500 font-medium">Sincronizando base de clientes...</p>
        <p className="text-slate-400 text-sm">Este módulo estará disponível em breve.</p>
        <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">
          Em desenvolvimento
        </Badge>
      </div>
    </div>
  );
}
