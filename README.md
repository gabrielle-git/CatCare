# CatCare — versão Codex

Aplicação mobile-first para acompanhar vários gatos da família, com histórico de saúde, agenda, finanças, compras, avaliações de produtos e cuidados neonatais.

Esta versão foi criada em uma pasta separada para não compartilhar código, cache ou servidor com a implementação que roda na porta 3000.

## Rodar localmente

```bash
npm ci
npm run dev:codex
```

Abra [http://localhost:3100](http://localhost:3100). Sem `.env.local`, o app abre em modo de demonstração com quatro gatos e registros fictícios.

## Conectar o Supabase

1. Crie um projeto no Supabase.
2. Execute, nesta ordem, **todas** as migrations da pasta `supabase/migrations` no SQL Editor — de `0001_initial.sql` até `0026_benefit_memberships_multi_other.sql` (inclui família/convites, vacinas/vermífugo, planos de saúde, guias e clubes).
3. Copie `.env.example` para `.env.local`.
4. Preencha:

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
```

5. Reinicie o servidor.

Com o Supabase configurado, o app exige login e passa a salvar os dados reais protegidos por RLS.

Detalhes de produção e checklist: veja [`SECURITY.md`](SECURITY.md).

## O que já funciona

- layout responsivo com navegação inferior no celular e sidebar no desktop;
- cadastro, edição, foto e arquivamento de vários pets;
- pesagens com histórico, gráfico e sincronização automática do peso atual;
- registro rápido (até 2 tipos por vez), vacina, vermífugo, medicamento, consulta e observação;
- modo neonatal para mamada, xixi, cocô e temperatura, com resumo do dia;
- calendários preventivos de vacina e vermífugo com alertas;
- linha do tempo com filtros e exclusão em lote;
- plano de saúde por pet, tabelas de coparticipação, templates compartilhados e clubes/assinaturas;
- criação, repetição e conclusão de lembretes;
- Home com pets, atividade recente, agenda e destaque neonatal;
- gastos mensais e categorias; compras com cupom/desconto e lançamento automático no gasto;
- avaliações de qualidade, aceitação e custo-benefício;
- configurações com conta, multi-família, papéis, convites e exportação privada em JSON;
- assistente local com respostas baseadas apenas nos dados registrados;
- idade cronológica, equivalência humana aproximada e fase de vida automática;
- álbum de memórias com até oito fotos, vários pets, edição, exclusão recuperável e definitiva;
- recomendações de alimento e areia baseadas nas avaliações da própria família;
- perfis `viewer` somente leitura e bucket privado com limite de arquivo.

## Validação

```bash
npm run typecheck
npm run lint
npm run build
```

## Próximos cortes

- manifesto PWA, ícones e notificações;
- integração opcional com IA visual para fotos, sempre com consentimento antes do envio;
- completar exportação JSON com planos de saúde, guias e clubes.

## Design

Fundamentos: DM Sans, lavanda `#8E7DBE`, rosa chá `#E9B7C7`, creme `#F7F1E8`, menta `#BFD8C2` e grafite `#2A2230`.
