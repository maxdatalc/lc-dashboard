"use client";

// Seletor de loja na sidebar — chama Server Action ao clicar
import { useTransition } from "react";
import { Building2 } from "lucide-react";
import { selectLoja } from "@/app/actions/lojas";

type Loja = { id: string; name: string };

type Props = {
  lojas: Loja[];
  selectedLojaId: string | null;
};

export function LojaSelector({ lojas, selectedLojaId }: Props) {
  const [isPending, startTransition] = useTransition();

  return (
    <ul className="space-y-0.5">
      {lojas.map((loja) => {
        const isSelected = loja.id === selectedLojaId;

        return (
          <li key={loja.id}>
            <button
              type="button"
              disabled={isPending}
              onClick={() => startTransition(() => { selectLoja(loja.id); })}
              className={[
                "w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-sm text-left transition-colors",
                isSelected
                  ? "bg-slate-100 text-slate-900 font-medium"
                  : "text-slate-600 hover:bg-slate-50",
                isPending ? "opacity-60 cursor-not-allowed" : "",
              ].join(" ")}
            >
              <Building2 className="h-3.5 w-3.5 shrink-0 text-slate-400" />
              <span className="truncate">{loja.name}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
