import { describe, expect, it } from "vitest";

import {
  type EcommerceProductRow,
  disponibilidadeDe,
  mapearProduto,
  slugDoProduto,
} from "./catalogo-mapper";

const LOJA = "11111111-1111-1111-1111-111111111111";
const AGORA = "2026-07-11T12:00:00.000Z";

/** Linha realista, no formato que a bridge devolve (ISNULL vira ''). */
function linha(over: Partial<EcommerceProductRow> = {}): EcommerceProductRow {
  return {
    proId: 3,
    proDescricao: "FAROL PRINCIPAL DUPLO DT LE MB ATRON CARA CHATA",
    proAplicacao: "",
    proUn: "UN",
    proCodigo: "FM117LE/PL70040222",
    proVenda: 480,
    proEstoqueAtual: 1,
    grupoNome: "SISTEMA ELETRICO",
    subGrupoNome: "DIVERSOS",
    marcaNome: "ORGUS",
    proPeso: 2,
    proAltura: 15,
    proLargura: 20,
    proComprimento: 25,
    ...over,
  };
}

describe("disponibilidadeDe", () => {
  it("trata estoque zerado como indisponível", () => {
    expect(disponibilidadeDe(0)).toBe("indisponivel");
  });

  // Estoque negativo existe no ERP (acerto pendente) e não pode virar "em estoque".
  it("trata estoque negativo como indisponível", () => {
    expect(disponibilidadeDe(-5)).toBe("indisponivel");
  });

  it("trata null como indisponível", () => {
    expect(disponibilidadeDe(null)).toBe("indisponivel");
  });

  it("avisa quando está acabando", () => {
    expect(disponibilidadeDe(1)).toBe("ultimas_unidades");
    expect(disponibilidadeDe(3)).toBe("ultimas_unidades");
  });

  it("considera em estoque acima do limite", () => {
    expect(disponibilidadeDe(4)).toBe("em_estoque");
  });
});

describe("slugDoProduto", () => {
  it("gera slug legível a partir do nome", () => {
    expect(slugDoProduto("FAROL PRINCIPAL DUPLO", 7)).toBe("farol-principal-duplo-7");
  });

  it("remove acentos e pontuação", () => {
    expect(slugDoProduto("PARAFUSO 3/8 AÇO INOX", 12)).toBe("parafuso-3-8-aco-inox-12");
  });

  // Descrição duplicada no ERP é comum; sem o proId, o UNIQUE (loja_id, slug)
  // derrubaria o sync inteiro.
  it("desambigua produtos de mesmo nome pelo proId", () => {
    expect(slugDoProduto("FAROL", 1)).not.toBe(slugDoProduto("FAROL", 2));
  });

  it("sobrevive a nome só de símbolos", () => {
    expect(slugDoProduto("///", 9)).toBe("9");
  });

  it("não termina em hífen quando o nome é truncado", () => {
    const slug = slugDoProduto("A".repeat(58) + " BCDEF", 4);
    expect(slug.endsWith("-4")).toBe(true);
    expect(slug).not.toContain("--");
  });
});

describe("mapearProduto", () => {
  it("mapeia uma linha real do ERP", () => {
    expect(mapearProduto(linha(), LOJA, AGORA)).toEqual({
      loja_id: LOJA,
      external_id: 3,
      slug: "farol-principal-duplo-dt-le-mb-atron-cara-chata-3",
      nome: "FAROL PRINCIPAL DUPLO DT LE MB ATRON CARA CHATA",
      descricao: null,
      codigo: "FM117LE/PL70040222",
      preco: 480,
      unidade: "UN",
      grupo_nome: "SISTEMA ELETRICO",
      subgrupo_nome: "DIVERSOS",
      marca_nome: "ORGUS",
      disponibilidade: "ultimas_unidades",
      publicado: true,
      sincronizado_em: AGORA,
      peso_kg: 2,
      altura_cm: 15,
      largura_cm: 20,
      comprimento_cm: 25,
    });
  });

  // Os ISNULL da query devolvem '' — que não pode virar string vazia na vitrine.
  it("converte '' do ERP em null", () => {
    const p = mapearProduto(linha({ subGrupoNome: "", marcaNome: "", proCodigo: "" }), LOJA, AGORA);
    expect(p?.subgrupo_nome).toBeNull();
    expect(p?.marca_nome).toBeNull();
    expect(p?.codigo).toBeNull();
  });

  it("descarta produto sem descrição", () => {
    expect(mapearProduto(linha({ proDescricao: null }), LOJA, AGORA)).toBeNull();
    expect(mapearProduto(linha({ proDescricao: "   " }), LOJA, AGORA)).toBeNull();
  });

  // Nunca publicar produto de graça, mesmo que o ERP devolva algo estranho.
  it("descarta produto sem preço", () => {
    expect(mapearProduto(linha({ proVenda: 0 }), LOJA, AGORA)).toBeNull();
    expect(mapearProduto(linha({ proVenda: null }), LOJA, AGORA)).toBeNull();
    expect(mapearProduto(linha({ proVenda: -10 }), LOJA, AGORA)).toBeNull();
  });

  it("mapeia peso e dimensões quando presentes", () => {
    const p = mapearProduto(
      linha({ proPeso: 11, proAltura: 10, proLargura: 10, proComprimento: 10 }),
      LOJA,
      AGORA,
    );
    expect(p?.peso_kg).toBe(11);
    expect(p?.altura_cm).toBe(10);
    expect(p?.largura_cm).toBe(10);
    expect(p?.comprimento_cm).toBe(10);
  });

  it("trata peso/dimensão ausente ou zerado como null (não quebra o frete depois)", () => {
    const semDado = mapearProduto(
      linha({ proPeso: null, proAltura: 0, proLargura: null, proComprimento: 0 }),
      LOJA,
      AGORA,
    );
    expect(semDado?.peso_kg).toBeNull();
    expect(semDado?.altura_cm).toBeNull();
    expect(semDado?.largura_cm).toBeNull();
    expect(semDado?.comprimento_cm).toBeNull();
  });
});
