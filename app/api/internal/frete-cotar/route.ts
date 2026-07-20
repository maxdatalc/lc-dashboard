/**
 * POST /api/internal/frete-cotar
 *
 * Cotação de frete real (Melhor Envio) para o checkout do lc-storefront
 * (fase 3). Server-to-server, mesmo padrão de autenticação do stock-check —
 * a credencial da Melhor Envio nunca sai deste projeto.
 *
 * Conta central única (não por loja): decisão da fase 3, porque o painel de
 * "cada loja conecta sua própria conta Melhor Envio" é trabalho da Fase 6
 * (painel admin), que ainda não existe. `getMelhorEnvioToken` já recebe
 * `lojaId` para trocar para conta-por-loja depois sem mudar quem chama.
 *
 * Formato de request/response conforme a documentação pública da Melhor
 * Envio consultada em 2026-07-20
 * (https://docs.melhorenvio.com.br/reference/calculo-de-fretes-por-produtos).
 * A doc não expõe um exemplo completo da resposta 200 — o parsing abaixo
 * (campo `error` por serviço, `custom_price`/`custom_delivery_time` com
 * fallback para `price`/`delivery_time`) é o formato publicamente conhecido
 * desta API. RECONCILIAR contra uma chamada real de sandbox (Step de
 * verificação manual desta task, com o token do usuário) antes de produção.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const TIMEOUT_MS = 15_000;

const schema = z.object({
  loja_id: z.string().uuid(),
  cep_origem: z.string().regex(/^\d{8}$/),
  cep_destino: z.string().regex(/^\d{8}$/),
  itens: z
    .array(
      z.object({
        external_id: z.number().int().positive(),
        peso_kg: z.number().positive(),
        altura_cm: z.number().positive(),
        largura_cm: z.number().positive(),
        comprimento_cm: z.number().positive(),
        quantidade: z.number().int().positive(),
        valor: z.number().positive(),
      }),
    )
    .min(1)
    .max(100),
});

interface MelhorEnvioServico {
  name?: string;
  price?: string;
  custom_price?: string;
  delivery_time?: number;
  custom_delivery_time?: number;
  company?: { name?: string };
  error?: string;
}

function getMelhorEnvioToken(_lojaId: string): string | null {
  // _lojaId reservado para a Fase 6 (conta por loja) — hoje sempre a conta central.
  return process.env.MELHOR_ENVIO_TOKEN ?? null;
}

function baseUrlMelhorEnvio(): string {
  return process.env.MELHOR_ENVIO_BASE_URL ?? "https://sandbox.melhorenvio.com.br";
}

export async function POST(req: NextRequest) {
  const segredo = process.env.INTERNAL_API_SECRET;
  const authHeader = req.headers.get("authorization") ?? "";

  if (!segredo || authHeader !== `Bearer ${segredo}`) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
  }

  const { loja_id, cep_origem, cep_destino, itens } = parsed.data;

  const token = getMelhorEnvioToken(loja_id);
  if (!token) {
    return NextResponse.json({ error: "frete_nao_configurado" }, { status: 503 });
  }

  const corpo = {
    from: { postal_code: cep_origem },
    to: { postal_code: cep_destino },
    products: itens.map((item) => ({
      id: String(item.external_id),
      width: item.largura_cm,
      height: item.altura_cm,
      length: item.comprimento_cm,
      weight: item.peso_kg,
      insurance_value: item.valor,
      quantity: item.quantidade,
    })),
    options: { receipt: false, own_hand: false },
  };

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);

  let servicos: MelhorEnvioServico[];
  try {
    const res = await fetch(`${baseUrlMelhorEnvio()}/api/v2/me/shipment/calculate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        // Obrigatório pela Melhor Envio: nome da aplicação + e-mail de contato.
        "User-Agent": "lc-storefront (suporte@lcgestor.com.br)",
      },
      body: JSON.stringify(corpo),
      signal: ctrl.signal,
    });

    if (!res.ok) {
      const texto = await res.text().catch(() => "");
      console.error(`[frete-cotar] Melhor Envio HTTP ${res.status}: ${texto.slice(0, 300)}`);
      return NextResponse.json({ error: "frete_indisponivel" }, { status: 503 });
    }

    servicos = (await res.json()) as MelhorEnvioServico[];
  } catch (err) {
    const mensagem = err instanceof Error ? err.message : String(err);
    console.error(`[frete-cotar] falha para a loja ${loja_id}: ${mensagem}`);
    return NextResponse.json({ error: "frete_indisponivel" }, { status: 503 });
  } finally {
    clearTimeout(timer);
  }

  const opcoes = servicos
    .filter((s) => !s.error)
    .map((s) => ({
      servico: s.name ?? "Frete",
      transportadora: s.company?.name ?? "",
      prazo_dias: s.custom_delivery_time ?? s.delivery_time ?? 0,
      valor: Number(s.custom_price ?? s.price ?? 0),
    }))
    .filter((o) => o.valor > 0);

  if (opcoes.length === 0) {
    return NextResponse.json({ error: "frete_indisponivel" }, { status: 503 });
  }

  return NextResponse.json({ loja_id, opcoes });
}
