# CatCare — guia de controle do projeto

Documento para **você** (dona do projeto) não se perder no meio de tantos pedidos e mudanças.  
Não é marketing. É o “mapa do que decidimos, por quê, e como funciona”.

**Atualizar este arquivo** quando fecharmos um marco (feature grande, decisão de produto, merge na `main`).

Última atualização: agosto/2026 · Branch de trabalho: `fix/plan-discount-neonatal-dual-records` (PR #14 aberto; 2 commits locais de demo ainda podem estar só na máquina até o push).

---

## 0. Como usar este documento

Quando sentir que “não sei mais o que pedi”:

1. Leia a **§1** (o que o app é hoje).
2. Veja a **§2** (decisões — o *porquê*).
3. Veja a **§8** (o que ainda falta — lista curta).
4. Git: commits na branch ≠ site publicado. Site oficial = o que está na **`main`** depois do merge.

Regra de ritmo (combinado): **commit** na branch com frequência; **PR** só quando valer mandar para a `main` (você sozinha no projeto — sem PR a cada micro-ajuste).

---

## 1. O que o sistema é (hoje)

App familiar de cuidados com pets, em **português**, para uso real da família + demonstração pública.

| Peça | O que é | Por que existe |
|------|---------|----------------|
| **Next.js (App Router)** | Front + Server Actions | Um só projeto web; formulários no servidor |
| **Supabase Auth** | Login / cadastro e-mail+senha | Contas reais sem inventar auth do zero |
| **Postgres + RLS** | Dados por família (`household`) | Ninguém de outra família lê seus pets |
| **Storage `pet-media`** | Fotos privadas | Path começa com `household_id/` |
| **Papéis** | `owner` / `caregiver` / `viewer` | Visitante vê; só dono/cuidador edita |
| **Multi-família** | `active_household_id` | Uma pessoa pode estar em mais de uma casa |

### Domínios (telas / dados)

Pets · Registros (peso/saúde/neonatal) · Neonatal · Agenda · Plano de saúde (Petlove etc.) · Compras/Despesas · Memórias · Assistente local · Configurações (membros, convites, export).

### Como o acesso funciona (camadas)

```
Tela → proxy (sessão ou demo) → Server Action (assertCanEdit / assertOwner) → RLS no banco
```

Se uma camada falhar, a próxima ainda deve proteger. Por isso não “desligamos RLS” para fazer o app abrir.

---

## 2. Decisões importantes — por quê + como

### 2.1 Família + papéis + convites

- **Por quê:** o app é da casa, não de um usuário isolado; avó pode ser `viewer`.
- **Como:** tabela de membros; convite por e-mail com token; aceite em `/invite/[token]`; dono gerencia papéis.
- **Decisão de segurança:** no aceite de convite **não** apagamos família “órfã” sozinhos (migration 0015) — evita apagar dados por acidente. Quem quiser apagar família faz isso em Configurações.

### 2.2 Fuso `America/Sao_Paulo`

- **Por quê:** “hoje”, “ontem”, mamada e agenda precisam bater com o calendário do Brasil, não UTC.
- **Como:** formatação e stats neonatais usam esse fuso (`format.ts`, `neonatal-stats.ts`).

### 2.3 Plano de saúde + clubes + guias (PR #13)

- **Por quê:** vocês usam Petlove Leve / clubes e precisam lembrar cobertura, mensalidade e desconto multi-pet.
- **Como:** planos por pet; templates compartilhados; guias de coparticipação; vários clubes `other`; migrations **0019–0026**.
- **Correção depois:** contagem do desconto (próximo pet = posição correta, não “1º” de novo); badges na **lista**; hint de desconto só no **cadastro novo**, não na edição (menos barulho na tela).

### 2.4 Neonatal

- **Por quê:** filhotes &lt; 8 semanas pedem mamada, xixi, cocô, temperatura, peso com frequência.
- **Como:** painel + histórico; formulário de registros com tipos neonatais; até **2 tipos** no mesmo envio (ex.: xixi + cocô) para não cadastrar duas vezes.
- **Correção:** horários relativos (“agora há pouco”) alinhados ao calendário de Brasília.

### 2.5 Assistente (“Pergunte aos seus dados”)

- **Por quê:** respostas rápidas sem inventar diagnóstico.
- **Como:** **só dados locais** da família (ou mock na demo). **Não** é ChatGPT na nuvem. IA visual de fotos fica para o futuro, **só com consentimento**.
- **Na demo:** assistente **desligado** (não envia pergunta) — evita parecer que “salvou” ou que há IA mágica sem conta.

### 2.6 Modo demonstração (decisão atual)

- **Por quê:** quem abre o site sem conta precisa **ver** o produto; login/cadastro ficam para a família real.
- **Como funciona:**
  1. Sem sessão → redirect para `/demo` → cookie httpOnly `catcare_demo`.
  2. Páginas usam `isLiveData()` → se demo, leem `mock-data.ts` (Dobby, Crystal, bebês, peso, cocô, temperatura, etc.).
  3. **Nada grava no banco.** Mutações e `/api/export` exigem login de verdade.
  4. Banner: “crie sua conta ou faça login” (sem falar “Supabase” na cara do usuário).
- **O que NÃO fizemos (de propósito):** demo interativa que “finge salvar” e some no F5. Mais trabalho e mais confusão (“eu salvei?”). Mantemos **vitrine rica + botões sem persistir de verdade**.
- **Segurança:** cookie de demo **não** vira dono; RLS + `getUser()` continuam valendo. Testado: export → 401; rotas sem cookie → `/demo`.

### 2.7 Convite sem token na URL

- **Por quê:** `?manual=https://.../invite/TOKEN` vazava o segredo em histórico, logs e prints.
- **Como:** se o e-mail não envia, guardamos o link num cookie httpOnly curto e a URL fica só `?manual=1`.

### 2.8 `getMyRole` fail-closed

- **Por quê:** se a RPC de papel falhasse, o código antigo assumia `"owner"` → risco de privilégio a mais.
- **Como:** falha → `null` (sem privilégio). Melhor bloquear edição do que abrir demais.

### 2.9 README / “produção pronta”

- **Por quê não reescrevemos agora:** o produto ainda evolui; checklist de go-live mentiria o estado.
- **Onde fica a verdade:** **este arquivo** + `SECURITY.md` (checklist técnico para quando for a vez).

### 2.10 Ritmo de Git / PR

- **Por quê:** só você mexe no código; PR a cada ajuste cansa e não agrega.
- **Como:** commits na branch; PR quando for mergear na `main` (deploy). Regra em `.cursor/rules/pr-cadence.mdc`.

### 2.11 Senha e links de foto

- **Por quê:** senha de 6 caracteres é frágil; links assinados de 1h deixam a foto “aberta” por mais tempo se alguém copiar a URL.
- **Como:** cadastro novo exige **8+** caracteres; login não força 8 (não tranca contas antigas). Fotos/memórias usam signed URL de **30 minutos** — a cada visita o servidor gera um link novo.

---

## 3. Linha do tempo (entregas)

| Entrega | O que entrou | Por que importava |
|---------|--------------|-------------------|
| MVP / #1–#4 | Auth, peso, multi-pet, gráfico, sync compra↔gasto | Base usável |
| Família #5–#6 | Membros, convites, papéis, apagar família/mídia | Casa compartilhada com segurança |
| Shopping #7 | Avaliações / recompra | Decisão de compra com histórico |
| UX/segurança #8 | Fuso BR, confirms, `SECURITY.md` | Menos erro humano + ops |
| Microchip #9 | Campo no perfil | Dado veterinário importante |
| Vacinas / vermífugo #11 | Calendário + alertas | Preventivo |
| Timeline #12 | Filtros + apagar em lote | Limpeza do histórico |
| **PR #13** | Neonatal + plano de saúde completo | Maior salto de produto |
| **Branch qualidade (+ demo)** | Bugs do pacote #13 + fail-closed + demo pública + auditoria | Fechar qualidade e entrada sem login |

---

## 4. Inventário rápido de módulos

| Área | Função na prática |
|------|-------------------|
| Home | Resumo, alertas, últimos cuidados |
| Pets | Cadastro, perfil, microchip, castração, históricos |
| Registros | Um formulário; até 2 tipos; multi-pet |
| Neonatal | Dia a dia dos filhotes |
| Agenda | Lembretes |
| Plano de saúde | Mensalidade, cobertura, clubes, guias |
| Compras / Despesas | Dinheiro + clube/cupom |
| Memórias | Fotos / marcos |
| Assistente | Perguntas sobre **dados já salvos** (conta real) |
| Configurações | Famílias, membros, convites, export |

Arquivos-chave (se precisar achar no código): `roles.ts`, `households.ts`, `invites.ts`, `demo-mode.ts`, `mock-data.ts`, `neonatal-stats.ts`, `health-plan*.ts`, `record-form.ts`, `proxy.ts`.

---

## 5. Banco — migrations 0001–0026

| Faixa | Para quê |
|-------|----------|
| 0001–0006 | Base + commerce + memórias + bootstrap da família + multi-pet |
| 0007–0015 | Membros, convites, família ativa, ownership, storage, convite sem orphan-delete |
| 0016–0018 | Microchip, castração, vermífugo |
| 0019–0026 | Planos, cobertura, clubes, promo, guias, templates, vários clubes |

Ambiente novo: rodar **até 0026** na ordem em `supabase/migrations`. Sem isso, telas novas quebram.

---

## 6. Segurança — o que está firme

- RLS por família
- Server Actions checam usuário + papel
- Só chave **publishable** no app (nunca `service_role` no client)
- Storage privado; delete via API
- Convites com token forte + e-mail amarrado
- Demo isolada do banco real
- `getMyRole` fail-closed

Detalhes ops (URLs Vercel, Resend, confirm e-mail): ver `SECURITY.md`.

---

## 7. O que está na branch agora (ainda pode não estar na `main`)

Pacote da branch `fix/plan-discount-neonatal-dual-records`:

1. Desconto multi-pet Petlove correto  
2. Horário neonatal Brasília  
3. Registro com até 2 tipos  
4. Badges / limpeza de UX do plano  
5. `getMyRole` fail-closed  
6. `AUDITORIA.md` (este guia)  
7. Demo pública `/demo` + mock rico + assistente off na demo  
8. Convite sem token na query  

**PR #14** cobre parte disso; commits novos de demo/docs podem precisar de **push** antes de um merge completo.

---

## 8. O que ainda falta (lista curta)

### Técnico / auditoria (baixa prioridade)
| Item | Status |
|------|--------|
| ~~Completar `/api/export` (planos, guias, clubes)~~ | **Feito** — inclui `health_plans`, copays, templates, guias, serviços, `benefit_memberships` |
| ~~Senha mínima &gt; 6; signed URLs mais curtas~~ | **Feito** — cadastro exige 8+ caracteres (login aceita senhas antigas); signed URLs de foto/memória = 30 min |

### Produto futuro (não é “bug”)
| Item | O que é na prática |
|------|--------------------|
| **PWA** | Ver §9 abaixo |
| Notificações da agenda | Lembrete no celular (depende de PWA ou serviço push) |
| IA visual | Ler foto com modelo externo — **só com consentimento explícito** |

### Ops (quando for publicar de verdade)
- Confirmar migrations até 0026 no projeto Supabase de produção  
- Checklist `SECURITY.md` (Site URL, redirect, Resend, confirm e-mail)  

---

## 9. PWA — o que é (em português simples)

**PWA** = *Progressive Web App*.

É o site virar algo **parecido com um app instalado**:

- “Adicionar à tela inicial” no celular  
- Ícone próprio  
- Abrir em tela cheia (sem barra do Chrome o tempo todo)  
- Em versões mais completas: funcionar um pouco offline / receber notificação  

**Não** é republicar na App Store. Continua sendo o mesmo site (Next.js), com um “manifest” + service worker.

**Por que estava na lista:** uso no celular o dia todo (mamada de madrugada, etc.) fica mais cômodo com ícone na home.  
**Por que não é urgente agora:** o app **já abre no navegador do celular**; PWA é conforto, não correção de bug. Notificações de verdade pedem mais configuração (e permissão do usuário).

Quando formos fazer: começar pelo básico (manifest + ícone + “instalar”), depois pensar em notificações.

---

## 10. Como não se perder daqui pra frente

1. Pedidos grandes → a gente atualiza **esta §2 / §8**.  
2. Commits guardam o “como”; este doc guarda o **porquê**.  
3. Se algo parecer sumido: perguntar “isso já está na `main` ou só na branch?”.  
4. Demo = olhar. Conta = salvar de verdade.

---

*Este arquivo substitui a auditoria “só inventário”. Se for enviar para outra pessoa, pode mandar este Markdown inteiro.*
