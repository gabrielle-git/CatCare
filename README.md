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
2. Execute, nesta ordem, as migrations da pasta `supabase/migrations` no SQL Editor: `0001_initial.sql`, `0002_commerce.sql`, `0003_memories.sql`, `0004_memory_gallery.sql`, `0005_household_bootstrap.sql` e `0006_entity_pets.sql`.
3. Copie `.env.example` para `.env.local`.
4. Preencha:

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
```

5. Reinicie o servidor.

Com o Supabase configurado, o app exige login e passa a salvar os dados reais protegidos por RLS.

## O que já funciona

- layout responsivo com navegação inferior no celular e sidebar no desktop;
- cadastro, edição, foto e arquivamento de vários gatos;
- pesagens com histórico e sincronização automática do peso atual;
- registro rápido de vacina, medicamento, consulta e observação;
- modo neonatal para mamada, xixi, cocô e temperatura;
- linha do tempo por gato;
- criação, repetição e conclusão de lembretes;
- Home com gatos, atividade recente, agenda e destaque neonatal;
- gastos mensais, divisão compartilhada/individual e categorias;
- compras com loja, canal, quantidade, histórico de preço e lançamento automático no gasto;
- avaliações separadas de qualidade, aceitação e custo-benefício;
- configurações com conta, família e exportação privada em JSON;
- assistente local com respostas baseadas apenas nos dados registrados;
- descrição editável do gatinho e resumo sugerido pelo perfil e histórico;
- idade cronológica, equivalência humana aproximada e fase de vida automática;
- álbum de memórias com até oito fotos, vários gatos, edição, exclusão recuperável, restauração e exclusão definitiva;
- recomendações de alimento e areia baseadas nas avaliações da própria família;
- perfis `viewer` somente leitura e bucket privado com limite de arquivo.

## Validação

```bash
npm run typecheck
npm run lint
npm run build
```

## Próximos cortes

- gráficos de evolução do peso;
- manifesto PWA, ícones e notificações;
- diário e galeria de memórias;
- convites de cuidadores por e-mail;
- integração opcional com IA visual para fotos, sempre com consentimento antes do envio.

## Design

Fundamentos: DM Sans, lavanda `#8E7DBE`, rosa chá `#E9B7C7`, creme `#F7F1E8`, menta `#BFD8C2` e grafite `#2A2230`.
