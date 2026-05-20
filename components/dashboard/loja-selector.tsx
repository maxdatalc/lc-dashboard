"use client";

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
    <ul className="flex flex-col gap-0.5">
      {lojas.map((loja) => {
        const isSelected = loja.id === selectedLojaId;

        return (
          <li key={loja.id}>
            <button
              type="button"
              disabled={isPending}
              onClick={() => startTransition(() => { selectLoja(loja.id); })}
              className={[
                isSelected
                  ? "w-full text-left rounded-lg px-3 py-2 text-sm font-medium bg-primary/10 text-primary border border-primary/20 transition-colors"
                  : "w-full text-left rounded-lg px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors",
                isPending ? "opacity-60 cursor-not-allowed" : "",
              ].join(" ")}
            >
              <span className="flex items-center gap-2">
                <Building2 className="h-3.5 w-3.5 shrink-0 opacity-60" />
                <span className="truncate">{loja.name}</span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
