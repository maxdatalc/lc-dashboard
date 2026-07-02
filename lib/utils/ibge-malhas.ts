// Malhas geográficas oficiais do IBGE (gratuito, sem chave de API).
// Estados: 1 fetch no mount. Municípios: fetch sob demanda por UF, com cache
// em memória — navegar entre estados não refaz requisições.

export interface GeoFeature {
  type: "Feature";
  properties: { codarea: string };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  geometry: any;
}
export interface GeoFC {
  type: "FeatureCollection";
  features: GeoFeature[];
}

export const UF_INFO: Record<string, { code: string; nome: string }> = {
  RO: { code: "11", nome: "Rondônia" },
  AC: { code: "12", nome: "Acre" },
  AM: { code: "13", nome: "Amazonas" },
  RR: { code: "14", nome: "Roraima" },
  PA: { code: "15", nome: "Pará" },
  AP: { code: "16", nome: "Amapá" },
  TO: { code: "17", nome: "Tocantins" },
  MA: { code: "21", nome: "Maranhão" },
  PI: { code: "22", nome: "Piauí" },
  CE: { code: "23", nome: "Ceará" },
  RN: { code: "24", nome: "Rio Grande do Norte" },
  PB: { code: "25", nome: "Paraíba" },
  PE: { code: "26", nome: "Pernambuco" },
  AL: { code: "27", nome: "Alagoas" },
  SE: { code: "28", nome: "Sergipe" },
  BA: { code: "29", nome: "Bahia" },
  MG: { code: "31", nome: "Minas Gerais" },
  ES: { code: "32", nome: "Espírito Santo" },
  RJ: { code: "33", nome: "Rio de Janeiro" },
  SP: { code: "35", nome: "São Paulo" },
  PR: { code: "41", nome: "Paraná" },
  SC: { code: "42", nome: "Santa Catarina" },
  RS: { code: "43", nome: "Rio Grande do Sul" },
  MS: { code: "50", nome: "Mato Grosso do Sul" },
  MT: { code: "51", nome: "Mato Grosso" },
  GO: { code: "52", nome: "Goiás" },
  DF: { code: "53", nome: "Distrito Federal" },
};

export const CODE_TO_UF: Record<string, string> = Object.fromEntries(
  Object.entries(UF_INFO).map(([sigla, v]) => [v.code, sigla])
);

/** Normaliza nomes p/ casar cidade do ERP com município do IBGE. */
export function normNome(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/['’`´]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const BASE = "https://servicodados.ibge.gov.br/api";
const GEOJSON = "formato=application/vnd.geo+json&qualidade=minima";

let cacheEstados: GeoFC | null = null;
const cacheMunicipios = new Map<string, { malha: GeoFC; nomes: Record<string, string> }>();

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`IBGE ${res.status}: ${url}`);
  return res.json();
}

/** Polígonos dos 27 estados (codarea = código UF de 2 dígitos). */
export async function fetchMalhaEstados(): Promise<GeoFC> {
  if (cacheEstados) return cacheEstados;
  cacheEstados = await getJson<GeoFC>(`${BASE}/v3/malhas/paises/BR?${GEOJSON}&intrarregiao=UF`);
  return cacheEstados;
}

/** Polígonos dos municípios de uma UF + mapa codarea → nome oficial. */
export async function fetchMalhaMunicipios(sigla: string): Promise<{ malha: GeoFC; nomes: Record<string, string> }> {
  const hit = cacheMunicipios.get(sigla);
  if (hit) return hit;
  const info = UF_INFO[sigla];
  if (!info) throw new Error(`UF desconhecida: ${sigla}`);

  const [malha, lista] = await Promise.all([
    getJson<GeoFC>(`${BASE}/v3/malhas/estados/${info.code}?${GEOJSON}&intrarregiao=municipio`),
    getJson<{ id: number; nome: string }[]>(`${BASE}/v1/localidades/estados/${info.code}/municipios?orderBy=nome`),
  ]);

  const nomes: Record<string, string> = {};
  for (const m of lista) nomes[String(m.id)] = m.nome;

  const entry = { malha, nomes };
  cacheMunicipios.set(sigla, entry);
  return entry;
}
