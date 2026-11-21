# Dashboard Executivo · arquitetura

Páginas: `../dashboard.html` (tela) + esta pasta. Sem build; JavaScript puro, mesmo padrão do restante do site.

| Arquivo | Papel |
|---|---|
| `data-demo.js` | Fonte de dados **fictícia** (determinística). Expõe `window.DashboardData = { mode, label, load() }` |
| `metrics.js` | Períodos, comparação com o período anterior e todos os cálculos (funções puras) |
| `ui.js` | Formatação pt-BR, etiqueta de variação, dica flutuante, painel de detalhes + CSV |
| `charts.js` | Gráficos em SVG/HTML (linha, rosca, colunas, barras, funil) |
| `app.js` | Estado dos filtros (salvos no navegador), renderização das seções, clique → detalhamento |
| `dashboard.css` | Visual (paleta Pátio) e responsividade |
| `../auth-guard.js` | Proteção de página reutilizável (`PatioGuard.start`) para todos os módulos futuros |

## Ligar ao banco (Supabase)

Crie `data-supabase.js` com a mesma interface de `data-demo.js` (`load()` devolvendo uma Promise do objeto abaixo) e troque o `<script>` em `dashboard.html`. Nada mais muda.

```
{ today:'AAAA-MM-DD', units:[{id,nome}], sellers:[{id,nome,unitId}], unitById, sellerById, origins:[nomes], banks:[nomes],
  vehicles:[{id,unitId,marca,modelo,ano,placa,canal:'showroom|atacado',propriedade:'proprio|consignado',custo,preparo,anuncio,
             entrada,saida|null,saidaTipo:'venda|devolucao'|null,precoVenda,temAnuncio,servicoPendente,recebimentoPendente}],
  sales:[{id,data,vehicleId,sellerId,unitId,marca,modelo,ano,placa,precoVenda,custo,preparo,lucro,financiado,banco,valorFinanciado,retornoPct,retornoValor}],
  leads:[{id,unitId,sellerId,origem,dLead,dAg,dVis,dNeg,dVenda,saleId,aberta}],
  avaliacoes:[{id,data,unitId,marca,modelo,ano,valor,status:'aprovada|reprovada|pendente'}] }
```
Tabelas correspondentes: `units, sellers, vehicles, sales, leads, appraisals`, todas com RLS por loja. Para volumes grandes, mova os cálculos de `metrics.js` para funções SQL/views e mantenha o mesmo formato de saída.

## Novos módulos
Crie `modulo.html`, inclua `auth-guard.js` e chame `PatioGuard.start({ onReady })`; adicione o link no menu lateral.
