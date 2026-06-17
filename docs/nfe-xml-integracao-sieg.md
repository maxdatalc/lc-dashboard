# NF-e XML — Armazenamento no MaxManager e Integração SIEG

## Contexto

Levantamento realizado em 2026-06-16 para subsidiar a futura implementação do módulo de integração com a plataforma **SIEG** no dashboard LC.

---

## Onde os XMLs ficam armazenados

### Tabela: `nf` (SQL Server — MaxManager)

O XML completo da NF-e autorizada é armazenado diretamente na tabela `nf`, na coluna:

| Coluna | Tipo | Conteúdo |
|---|---|---|
| **`nfNFeXMLDestinatarioBase64Zip`** | `VARCHAR(MAX)` | XML completo da NF-e — formato `Base64(zlib(XML UTF-8))` |
| `nfNFeXMLCancelamento` | `VARCHAR(MAX)` | XML do evento de cancelamento (quando houver) |
| `nfNFeXMLDestinatario` | `VARCHAR(MAX)` | XML em texto puro — **não utilizado** (sempre vazio nesta empresa) |
| `nfCCeXML` / `nfCCeXMLAssinado` | `VARCHAR(MAX)` | XML da Carta de Correção eletrônica (quando houver) |
| `nfCFeXML` | `VARCHAR(MAX)` | XML de CF-e SAT — não utilizado nesta empresa |

### Encoding da coluna principal

```
nfNFeXMLDestinatarioBase64Zip = Base64( zlib.compress( XML_UTF-8 ) )
```

Para decodificar:

```python
import base64, zlib
xml = zlib.decompress(base64.b64decode(coluna)).decode("utf-8")
```

```javascript
const xml = require("zlib").inflateSync(Buffer.from(coluna, "base64")).toString("utf-8");
```

---

## Estrutura do XML

O documento retornado é um **nfeProc versão 4.00** (padrão SEFAZ nacional), que contém:

```xml
<nfeProc versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe">
  <NFe>
    <infNFe Id="NFe..." versao="4.00">
      <ide>     <!-- identificação: série, número, data, natureza da operação -->
      <emit>    <!-- dados do emitente: CNPJ, razão social, endereço, IE -->
      <dest>    <!-- dados do destinatário: CNPJ/CPF, nome, endereço -->
      <det>     <!-- itens: código, EAN, descrição, NCM, CFOP, qtd, valor, impostos -->
      <total>   <!-- totais: BC ICMS, vICMS, vST, vProd, vNF -->
      <transp>  <!-- transporte -->
      <pag>     <!-- formas de pagamento -->
      <infAdic> <!-- informações adicionais / complementares -->
    </infNFe>
    <Signature> <!-- assinatura digital RSA + certificado A1 embutido (X509) -->
  </NFe>
  <protNFe>   <!-- protocolo de autorização da SEFAZ -->
    <infProt>
      <chNFe>   <!-- chave de acesso 44 dígitos -->
      <nProt>   <!-- número do protocolo -->
      <cStat>   <!-- 100 = Autorizado -->
      <xMotivo> <!-- "Autorizado o uso da NF-e" -->
    </infProt>
  </protNFe>
</nfeProc>
```

O XML já contém a assinatura digital e o certificado A1 embutido — é o arquivo completo aceito por qualquer plataforma fiscal (SIEG, Arquivei, Contmatic, etc.).

---

## Query para exportação

```sql
SELECT
  nfId,
  nfIdNFe                          AS chave_acesso,        -- 44 dígitos
  nfDataEmissao,
  nfTipoNf,                                                -- 'S' saída / 'E' entrada
  nfCliNome                        AS destinatario,
  nfVlrTotalNota                   AS valor_total,
  nfNFeXMLDestinatarioBase64Zip    AS xml_base64_zlib,
  nfNFeXMLCancelamento             AS xml_cancelamento      -- NULL se não cancelada
FROM nf
WHERE empId           = @empId
  AND nfNfeAutorizado = 1
  AND nfTipoNfSped    = '55'        -- apenas NF-e (exclui NF papel tipo 01)
ORDER BY nfDataEmissao DESC;
```

### Filtros úteis

```sql
-- Apenas saídas autorizadas do mês atual
AND nfTipoNf      = 'S'
AND nfDataEmissao >= DATEADD(MONTH, DATEDIFF(MONTH, 0, GETDATE()), 0)

-- Por chave de acesso específica
AND nfIdNFe = '28260533903814000195550010000070361436518989'

-- Notas canceladas (XML cancelamento preenchido)
AND LEN(ISNULL(nfNFeXMLCancelamento, '')) > 0
```

---

## Campos-chave para integração com SIEG

| Campo SQL | Descrição | Exemplo |
|---|---|---|
| `nfIdNFe` | Chave de acesso (44 dígitos) | `28260533903814000195...` |
| `nfNFeXMLDestinatarioBase64Zip` | XML completo (encode zlib+base64) | — |
| `nfNfeAutorizado` | `1` = autorizada pela SEFAZ | `1` |
| `nfTipoNfSped` | `'55'` = NF-e, `'65'` = NFC-e, `'01'` = NF papel | `'55'` |
| `nfTipoNf` | `'S'` = saída, `'E'` = entrada | `'S'` |
| `nfDataEmissao` | Data/hora de emissão | `2026-05-14T09:19:16` |
| `nfNFeXMLCancelamento` | XML do cancelamento se houver | `NULL` ou XML |
| `empId` | ID da empresa no MaxManager | `2` |

---

## Volume atual (empId = 2)

- **622 NF-e autorizadas** com XML disponível na coluna `nfNFeXMLDestinatarioBase64Zip`
- **0 notas** com XML em texto puro (`nfNFeXMLDestinatario` vazio em 100% dos casos)
- Certificado digital: A1, emitido por AC SAFEWEB RFB v5, válido até 2026-07-04

---

## Observações para o módulo SIEG

1. **Nunca expor o XML no cliente** — a decodificação deve ocorrer em server action ou API route, seguindo o padrão de segurança do projeto (igual ao Bridge SQL).
2. **NF papel (nfTipoNfSped = '01') não tem XML válido** — filtrar sempre `nfTipoNfSped = '55'` ou `'65'`.
3. A SIEG aceita o arquivo `.xml` diretamente — basta decodificar o Base64+zlib e enviar o conteúdo UTF-8.
4. Para cancelamentos, verificar também `nfNFeXMLCancelamento` e enviar junto quando preenchido.
5. O campo `nfIdNFe` é a chave primária fiscal — usar para deduplicação na plataforma SIEG.
