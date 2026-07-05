// lib/access/resolve-modules.test.ts
import { describe, it, expect } from "vitest";
import { resolveEffectiveFeatures } from "./resolve-modules";

describe("resolveEffectiveFeatures", () => {
  it("retorna undefined quando o tenant não tem nenhuma feature (fallback de plano)", () => {
    const result = resolveEffectiveFeatures({
      allTenantFeatures: [],
      isOwnerOrAdmin: false,
      groupModulos: null,
      userModulos: null,
    });
    expect(result).toBeUndefined();
  });

  it("owner ou admin global vê todas as features do tenant", () => {
    const result = resolveEffectiveFeatures({
      allTenantFeatures: ["modulo_financeiro", "modulo_produtos"],
      isOwnerOrAdmin: true,
      groupModulos: { modulo_financeiro: false },
      userModulos: { modulo_produtos: false },
    });
    expect(result).toEqual(["modulo_financeiro", "modulo_produtos"]);
  });

  it("aplica interseção tenant ∩ grupo quando o usuário pertence a um grupo", () => {
    const result = resolveEffectiveFeatures({
      allTenantFeatures: ["modulo_financeiro", "modulo_produtos", "modulo_vendas"],
      isOwnerOrAdmin: false,
      groupModulos: { modulo_financeiro: true, modulo_produtos: false },
      userModulos: null,
    });
    expect(result).toEqual(["modulo_financeiro"]);
  });

  it("aplica interseção tenant ∩ grupo ∩ usuário quando ambos existem", () => {
    const result = resolveEffectiveFeatures({
      allTenantFeatures: ["modulo_financeiro", "modulo_produtos", "modulo_vendas"],
      isOwnerOrAdmin: false,
      groupModulos: { modulo_financeiro: true, modulo_produtos: true },
      userModulos: { modulo_financeiro: true, modulo_produtos: false },
    });
    expect(result).toEqual(["modulo_financeiro"]);
  });

  it("aplica interseção tenant ∩ usuário quando não há grupo", () => {
    const result = resolveEffectiveFeatures({
      allTenantFeatures: ["modulo_financeiro", "modulo_produtos"],
      isOwnerOrAdmin: false,
      groupModulos: null,
      userModulos: { modulo_financeiro: true, modulo_produtos: false },
    });
    expect(result).toEqual(["modulo_financeiro"]);
  });

  it("sem grupo e sem restrição individual, usa o default mínimo (visão geral + vendas)", () => {
    const result = resolveEffectiveFeatures({
      allTenantFeatures: ["modulo_financeiro", "modulo_vendas", "dashboard_visao_geral"],
      isOwnerOrAdmin: false,
      groupModulos: null,
      userModulos: null,
    });
    expect(result).toEqual(["modulo_vendas", "dashboard_visao_geral"]);
  });

  it("grupo com objeto vazio ({}) é tratado como 'sem grupo', caindo no default mínimo", () => {
    const result = resolveEffectiveFeatures({
      allTenantFeatures: ["modulo_financeiro", "modulo_vendas"],
      isOwnerOrAdmin: false,
      groupModulos: {},
      userModulos: null,
    });
    expect(result).toEqual(["modulo_vendas"]);
  });
});
