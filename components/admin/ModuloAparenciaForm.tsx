"use client";

import { useState, useTransition } from "react";
import { BarChart, Bar, ResponsiveContainer, XAxis } from "recharts";
import { salvarAparenciaModulo } from "@/lib/actions/admin-modulos";

const PREVIEW_DATA = [
  { name: "Jan", valor: 40 },
  { name: "Fev", valor: 65 },
  { name: "Mar", valor: 50 },
  { name: "Abr", valor: 80 },
];

type PricingModel = "incluso_free" | "incluso_premium" | "avulso";

export function ModuloAparenciaForm({
  featureKey,
  initialAccentColor,
  initialPricingModel,
  initialPrecoAvulso,
}: {
  featureKey: string;
  initialAccentColor: string;
  initialPricingModel: PricingModel;
  initialPrecoAvulso: number | null;
}) {
  const [accentColor, setAccentColor] = useState(initialAccentColor);
  const [pricingModel, setPricingModel] = useState<PricingModel>(initialPricingModel);
  const [precoAvulso, setPrecoAvulso] = useState(initialPrecoAvulso?.toString() ?? "");
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  function handleSubmit(formData: FormData) {
    setSaved(false);
    startTransition(async () => {
      await salvarAparenciaModulo(featureKey, formData);
      setSaved(true);
    });
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <form action={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--adm-text)" }}>
            Cor de destaque
          </label>
          <input
            type="color"
            name="accent_color"
            value={accentColor}
            onChange={(e) => setAccentColor(e.target.value)}
            className="h-10 w-20 rounded cursor-pointer"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--adm-text)" }}>
            Modelo comercial
          </label>
          <select
            name="pricing_model"
            value={pricingModel}
            onChange={(e) => setPricingModel(e.target.value as PricingModel)}
            className="w-full rounded-lg px-3 py-2 text-sm"
            style={{
              background: "var(--adm-surface-2)",
              color: "var(--adm-text)",
              border: "1px solid var(--adm-line-strong)",
            }}
          >
            <option value="incluso_free">Incluso no Free</option>
            <option value="incluso_premium">Incluso no Premium</option>
            <option value="avulso">Vendido à parte</option>
          </select>
        </div>

        {pricingModel === "avulso" && (
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--adm-text)" }}>
              Preço avulso (R$)
            </label>
            <input
              type="number"
              name="preco_avulso"
              step="0.01"
              min="0"
              value={precoAvulso}
              onChange={(e) => setPrecoAvulso(e.target.value)}
              className="w-full rounded-lg px-3 py-2 text-sm"
              style={{
                background: "var(--adm-surface-2)",
                color: "var(--adm-text)",
                border: "1px solid var(--adm-line-strong)",
              }}
            />
          </div>
        )}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={isPending}
            className="rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50"
            style={{ background: "var(--adm-accent)", color: "#04121a" }}
          >
            {isPending ? "Salvando..." : "Salvar"}
          </button>
          {saved && !isPending && (
            <span className="text-xs" style={{ color: "var(--adm-text-dim)" }}>
              Salvo.
            </span>
          )}
        </div>
      </form>

      <div
        className="rounded-xl p-5"
        style={{ background: "var(--adm-surface)", border: "1px solid var(--adm-line)" }}
      >
        <p
          className="text-xs font-semibold uppercase tracking-wider mb-3"
          style={{ color: "var(--adm-text-faint)" }}
        >
          Preview
        </p>
        <div
          className="rounded-lg p-4 mb-4"
          style={{ background: "var(--adm-surface-2)", borderLeft: `3px solid ${accentColor}` }}
        >
          <p className="text-sm font-semibold" style={{ color: "var(--adm-text)" }}>
            Card de exemplo
          </p>
          <p className="text-xs mt-1" style={{ color: "var(--adm-text-dim)" }}>
            Assim fica o destaque deste módulo para o cliente.
          </p>
        </div>
        <div style={{ height: 160 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={PREVIEW_DATA}>
              <XAxis dataKey="name" tick={{ fill: "var(--adm-text-dim)", fontSize: 11 }} />
              <Bar dataKey="valor" fill={accentColor} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
