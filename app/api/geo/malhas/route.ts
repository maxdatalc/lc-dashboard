import { NextResponse } from "next/server";

// Proxy das malhas do IBGE. O CSP do app só permite connect-src 'self', então
// o browser não pode chamar o IBGE direto — buscamos aqui no servidor e
// devolvemos com cache agressivo (as malhas são estáticas).

const BASE = "https://servicodados.ibge.gov.br/api";
const GEOJSON = "formato=application/vnd.geo+json&qualidade=minima";

// Código IBGE de 2 dígitos por UF (evita depender de import do client bundle).
const UF_CODE: Record<string, string> = {
  RO: "11", AC: "12", AM: "13", RR: "14", PA: "15", AP: "16", TO: "17",
  MA: "21", PI: "22", CE: "23", RN: "24", PB: "25", PE: "26", AL: "27",
  SE: "28", BA: "29", MG: "31", ES: "32", RJ: "33", SP: "35", PR: "41",
  SC: "42", RS: "43", MS: "50", MT: "51", GO: "52", DF: "53",
};

const CACHE = "public, max-age=86400, s-maxage=604800, stale-while-revalidate=604800";

async function ibge<T>(url: string): Promise<T> {
  const res = await fetch(url, { next: { revalidate: 604800 } });
  if (!res.ok) throw new Error(`IBGE ${res.status}`);
  return res.json();
}

export async function GET(req: Request) {
  const uf = new URL(req.url).searchParams.get("uf");

  try {
    if (!uf) {
      const malha = await ibge(`${BASE}/v3/malhas/paises/BR?${GEOJSON}&intrarregiao=UF`);
      return NextResponse.json(malha, { headers: { "Cache-Control": CACHE } });
    }

    const code = UF_CODE[uf.toUpperCase()];
    if (!code) return NextResponse.json({ error: "UF inválida" }, { status: 400 });

    const [malha, lista] = await Promise.all([
      ibge(`${BASE}/v3/malhas/estados/${code}?${GEOJSON}&intrarregiao=municipio`),
      ibge<{ id: number; nome: string }[]>(`${BASE}/v1/localidades/estados/${code}/municipios?orderBy=nome`),
    ]);

    const nomes: Record<string, string> = {};
    for (const m of lista) nomes[String(m.id)] = m.nome;

    return NextResponse.json({ malha, nomes }, { headers: { "Cache-Control": CACHE } });
  } catch {
    return NextResponse.json({ error: "IBGE indisponível" }, { status: 502 });
  }
}
