"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  HelpCircle,
  ClipboardList,
  Search,
  PlusCircle,
  Warehouse,
  FileText,
  Scale,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ArrowRight,
  ArrowDown,
} from "lucide-react";

function StatusRow({
  dot,
  label,
  desc,
}: {
  dot: string;
  label: string;
  desc: string;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${dot}`} />
      <p className="text-sm">
        <span className="font-medium">{label}.</span>{" "}
        <span className="text-muted-foreground">{desc}</span>
      </p>
    </div>
  );
}

function Step({
  icon: Icon,
  title,
  desc,
}: {
  icon: React.ElementType;
  title: string;
  desc: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <p className="text-sm">
        <span className="font-medium">{title}.</span>{" "}
        <span className="text-muted-foreground">{desc}</span>
      </p>
    </div>
  );
}

function ResultRow({
  icon: Icon,
  cls,
  label,
  desc,
}: {
  icon: React.ElementType;
  cls: string;
  label: string;
  desc: string;
}) {
  return (
    <div className={`flex items-start gap-2.5 rounded-md border p-2.5 ${cls}`}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <p className="text-xs">
        <span className="font-semibold">{label}:</span> {desc}
      </p>
    </div>
  );
}

export function OSHelpDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8 shrink-0 rounded-full"
          title="Como funciona o módulo de O.S"
        >
          <HelpCircle className="h-4 w-4" />
        </Button>
      </DialogTrigger>

      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <ClipboardList className="h-5 w-5 text-primary" />
            Como funciona o módulo de O.S
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 text-sm leading-relaxed">
          {/* Visão geral */}
          <p className="text-muted-foreground">
            Aqui você consulta as Ordens de Serviço (O.S) que estão abertas na
            oficina e adiciona peças ou serviços a elas. Antes de incluir
            qualquer peça, o sistema confere automaticamente se há estoque FISCAL
            suficiente, evitando problemas na hora de emitir a nota fiscal.
          </p>

          {/* Fluxo simplificado */}
          <div className="rounded-lg border bg-card p-4">
            <h3 className="mb-3 text-sm font-semibold">Fluxo geral</h3>
            <div className="flex flex-col items-stretch gap-1.5 sm:flex-row sm:items-center sm:gap-2">
              {[
                { icon: ClipboardList, label: "O.S aberta na oficina" },
                { icon: PlusCircle, label: "Você adiciona itens aqui" },
                { icon: Scale, label: "Sistema confere o estoque" },
                { icon: FileText, label: "Loja fecha e fatura no ERP" },
              ].map((s, i, arr) => (
                <div key={s.label} className="flex flex-1 items-center gap-1.5">
                  <div className="flex flex-1 flex-col items-center gap-1.5 rounded-md bg-muted/40 px-2 py-3 text-center">
                    <s.icon className="h-4 w-4 text-primary" />
                    <span className="text-[11px] text-muted-foreground">
                      {s.label}
                    </span>
                  </div>
                  {i < arr.length - 1 && (
                    <ArrowRight className="hidden h-4 w-4 shrink-0 text-muted-foreground/50 sm:block" />
                  )}
                  {i < arr.length - 1 && (
                    <ArrowDown className="block h-4 w-4 shrink-0 self-center text-muted-foreground/50 sm:hidden" />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Status */}
          <div>
            <h3 className="mb-2.5 text-sm font-semibold">Status da O.S</h3>
            <div className="space-y-2 rounded-lg border bg-card p-4">
              <StatusRow
                dot="bg-primary"
                label="Aberta"
                desc="a O.S está em andamento na oficina. É possível adicionar peças e serviços normalmente."
              />
              <StatusRow
                dot="bg-[color:var(--success)]"
                label="Concluída"
                desc="a O.S já foi fechada e faturada no ERP. Não é mais possível adicionar itens a ela."
              />
              <StatusRow
                dot="bg-muted-foreground/40"
                label="Cancelada"
                desc="a O.S foi cancelada no ERP e não gerou faturamento."
              />
            </div>
          </div>

          {/* Como adicionar item */}
          <div>
            <h3 className="mb-2.5 text-sm font-semibold">
              Como adicionar um item na O.S
            </h3>
            <div className="space-y-3 rounded-lg border bg-card p-4">
              <Step
                icon={Search}
                title="Abra a O.S"
                desc="localize a ordem de serviço na lista e clique nela para abrir os detalhes."
              />
              <Step
                icon={PlusCircle}
                title="Escolha o item"
                desc="digite o código do produto ou pesquise pela descrição. Também é possível adicionar serviços."
              />
              <Step
                icon={Warehouse}
                title="Informe a quantidade"
                desc="o sistema mostra na hora o estoque físico e o estoque fiscal daquele produto."
              />
              <Step
                icon={CheckCircle2}
                title="Confirme"
                desc="clique em Adicionar. O item só é gravado depois da checagem automática de estoque."
              />
            </div>
          </div>

          {/* Estoque físico x fiscal */}
          <div>
            <h3 className="mb-2.5 text-sm font-semibold">
              Estoque físico e estoque fiscal
            </h3>
            <div className="space-y-3 rounded-lg border bg-card p-4">
              <p className="text-muted-foreground">
                Ao adicionar uma peça, o sistema compara dois números que nem
                sempre são iguais:
              </p>

              <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
                <div className="rounded-md border bg-muted/30 p-3">
                  <div className="mb-1.5 flex items-center gap-2">
                    <Warehouse className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">Estoque físico</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    A quantidade que realmente existe na prateleira ou no
                    depósito da loja.
                  </p>
                </div>

                <Scale className="mx-auto h-5 w-5 shrink-0 text-muted-foreground/50" />

                <div className="rounded-md border bg-muted/30 p-3">
                  <div className="mb-1.5 flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">Estoque fiscal</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    A quantidade liberada pelas notas fiscais (entradas,
                    saídas, devoluções e ajustes) para emitir uma nova nota.
                  </p>
                </div>
              </div>

              <p className="text-muted-foreground">
                Esses valores podem divergir. Exemplo: uma peça chegou
                fisicamente na loja, mas a nota fiscal de entrada ainda não
                foi lançada. Ou uma peça foi retirada da prateleira para uma
                O.S, mas a nota fiscal de saída ainda não foi emitida. Nesses
                casos, físico e fiscal ficam diferentes.
              </p>

              <p className="text-muted-foreground">
                Por isso, antes de gravar o item na O.S, o sistema mostra um
                dos três resultados abaixo:
              </p>

              <div className="space-y-2">
                <ResultRow
                  icon={CheckCircle2}
                  cls="border-[color:var(--success)]/30 bg-[color:var(--success)]/10 text-[color:var(--success)]"
                  label="Pode emitir"
                  desc="há estoque físico e fiscal suficientes. O item é adicionado normalmente."
                />
                <ResultRow
                  icon={AlertTriangle}
                  cls="border-[color:var(--warning)]/40 bg-[color:var(--warning)]/10 text-[color:oklch(0.5_0.15_70)]"
                  label="Atenção"
                  desc="há uma divergência entre físico e fiscal. O sistema pede uma confirmação antes de continuar."
                />
                <ResultRow
                  icon={XCircle}
                  cls="border-destructive/30 bg-destructive/10 text-destructive"
                  label="Bloqueado fiscalmente"
                  desc="não há estoque suficiente para garantir a nota fiscal. O item não pode ser adicionado até a situação ser corrigida no ERP."
                />
              </div>
            </div>
          </div>

          {/* Observação final */}
          <p className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
            Importante: o faturamento e a emissão da nota fiscal continuam
            sendo feitos diretamente no MaxManager. Este módulo apenas
            consulta as O.S e ajuda a adicionar itens com mais segurança,
            conferindo o estoque fiscal via calcúlos de entradas e saídas
             a partir do inventario fiscal antes de cada inclusão.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
