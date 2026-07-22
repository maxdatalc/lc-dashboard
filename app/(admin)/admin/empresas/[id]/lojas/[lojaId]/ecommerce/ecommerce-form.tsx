"use client";

import { useFormState, useFormStatus } from "react-dom";
import { useState } from "react";
import Link from "next/link";
import { Loader2, CheckCircle2 } from "lucide-react";
import { AdminCard } from "@/components/admin/AdminCard";
import { AdminButton } from "@/components/admin/AdminButton";

interface VitrineConfig {
  slug: string;
  nomePublico: string;
  ativo: boolean;
  logoUrl: string;
  corPrimaria: string;
  whatsapp: string;
}

interface Props {
  action: (
    prevState: { erro: string | null; sucesso?: boolean },
    formData: FormData,
  ) => Promise<{ erro: string | null; sucesso?: boolean }>;
  vitrine: VitrineConfig;
  tenantId: string;
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <AdminButton type="submit" disabled={pending}>
      {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
      {pending ? "Salvando..." : "Salvar configuração"}
    </AdminButton>
  );
}

export default function EcommerceForm({ action, vitrine, tenantId }: Props) {
  const [state, formAction] = useFormState(action, { erro: null });
  const [slug, setSlug] = useState(vitrine.slug);
  const [ativo, setAtivo] = useState(vitrine.ativo);

  return (
    <form action={formAction}>
      <AdminCard className="space-y-5 p-6">
        {state.erro && (
          <div className="rounded-lg px-3 py-2" style={{ background: "var(--adm-alert-soft)", border: "1px solid var(--adm-alert)" }}>
            <p className="adm-mono text-xs" style={{ color: "var(--adm-alert)" }}>{state.erro}</p>
          </div>
        )}

        {state.sucesso && (
          <div className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ background: "var(--adm-signal-soft)", border: "1px solid var(--adm-signal)" }}>
            <CheckCircle2 className="h-4 w-4 flex-shrink-0" style={{ color: "var(--adm-signal)" }} />
            <p className="text-xs font-medium" style={{ color: "var(--adm-signal)" }}>Configuração salva com sucesso.</p>
          </div>
        )}

        <div>
          <label className="mb-1 block text-xs font-medium" style={{ color: "var(--adm-text-dim)" }}>
            Nome público da loja
          </label>
          <input
            type="text"
            name="nomePublico"
            defaultValue={vitrine.nomePublico}
            className="adm-field adm-focusable w-full px-3.5 py-2.5 text-sm"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium" style={{ color: "var(--adm-text-dim)" }}>
            Subdomínio (slug)
          </label>
          <input
            type="text"
            name="slug"
            value={slug}
            onChange={(e) => setSlug(e.target.value.toLowerCase())}
            placeholder="minhaloja"
            className="adm-field adm-focusable adm-mono w-full px-3.5 py-2.5 text-sm"
          />
          <p className="mt-0.5 text-xs" style={{ color: "var(--adm-text-faint)" }}>
            A vitrine fica em <span className="adm-mono">{slug || "minhaloja"}.suamarca.com.br</span>. Só letras
            minúsculas, números e hífen — não dá pra mudar depois sem quebrar links já compartilhados.
          </p>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium" style={{ color: "var(--adm-text-dim)" }}>
            Logo (URL) <span className="font-normal" style={{ color: "var(--adm-text-faint)" }}>(opcional)</span>
          </label>
          <input
            type="text"
            name="logoUrl"
            defaultValue={vitrine.logoUrl}
            placeholder="https://..."
            className="adm-field adm-focusable w-full px-3.5 py-2.5 text-sm"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: "var(--adm-text-dim)" }}>
              Cor primária <span className="font-normal" style={{ color: "var(--adm-text-faint)" }}>(opcional)</span>
            </label>
            <input
              type="text"
              name="corPrimaria"
              defaultValue={vitrine.corPrimaria}
              placeholder="#0ea5e9"
              className="adm-field adm-focusable adm-mono w-full px-3.5 py-2.5 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: "var(--adm-text-dim)" }}>
              WhatsApp <span className="font-normal" style={{ color: "var(--adm-text-faint)" }}>(opcional)</span>
            </label>
            <input
              type="text"
              name="whatsapp"
              defaultValue={vitrine.whatsapp}
              placeholder="5579999999999"
              className="adm-field adm-focusable adm-mono w-full px-3.5 py-2.5 text-sm"
            />
          </div>
        </div>

        <div className="flex items-center justify-between rounded-lg px-4 py-3" style={{ border: "1px solid var(--adm-line-strong)" }}>
          <div>
            <p className="text-sm font-medium" style={{ color: "var(--adm-text)" }}>Vitrine ativa</p>
            <p className="mt-0.5 text-xs" style={{ color: "var(--adm-text-faint)" }}>
              Quando desativado, a loja fica invisível para clientes finais mesmo com produtos sincronizados.
            </p>
          </div>
          <label className="adm-focusable relative inline-flex cursor-pointer items-center rounded-full">
            <input
              type="checkbox"
              name="ativo"
              checked={ativo}
              onChange={(e) => setAtivo(e.target.checked)}
              className="peer sr-only"
            />
            <div
              className="relative h-5 w-10 rounded-full transition-colors"
              style={{ background: ativo ? "var(--adm-accent)" : "var(--adm-line-strong)" }}
            >
              <span
                className="absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform"
                style={{ transform: ativo ? "translateX(1.25rem)" : "translateX(0.125rem)" }}
              />
            </div>
          </label>
        </div>

        <div className="flex justify-end gap-3 pt-2" style={{ borderTop: "1px solid var(--adm-line)" }}>
          <Link
            href={`/admin/empresas/${tenantId}?aba=features`}
            className="adm-focusable rounded px-4 py-2 text-sm transition-colors"
            style={{ color: "var(--adm-text-dim)" }}
          >
            Cancelar
          </Link>
          <SubmitButton />
        </div>
      </AdminCard>
    </form>
  );
}
