# Auditoria completa — CatCare

Documento compartilhável do estado do produto (agosto/2026).  
Base: `main` após PR #13 + branch `fix/plan-discount-neonatal-dual-records`.

---

## 1. O que é o sistema

App familiar de cuidados com pets em **pt-BR**: Next.js App Router + Supabase Auth / Postgres / Storage.

- Família (`household`) com papéis `owner` | `caregiver` | `viewer`
- Multi-família (`active_household_id`)
- Domínios: pets, registros, neonatal, plano de saúde, compras, despesas, memórias, agenda, assistente local
- Modo demo (`src/lib/mock-data.ts`) quando não há env Supabase

### Acesso (camadas)

```
UI → proxy de sessão → assertCanEdit / assertOwner → Postgres RLS
```

Storage `pet-media` é privado; path começa com `household_id/`.

---

## 2. Linha do tempo do que foi entregue

| Entrega | Conteúdo |
|---------|----------|
| MVP / PRs #1–#4 | Auth login/cadastro; peso em kg; multi-pet; gráfico de peso; sync compras↔despesas |
| Família #5–#6 | Membros, convites, papéis, switch; transferir/sair/apagar; delete de mídia via Storage API |
| Shopping #7 | Avaliações honestas, filtro de recompra |
| UX/segurança #8 | Fuso `America/Sao_Paulo`; confirms; signup; checklist `SECURITY.md` |
| Microchip #9 | Microchip no perfil |
| Vacinas / vermífugo #11 | Calendário, alertas, tipo deworming, links tipados |
| Timeline #12 | Seleção em massa, filtros, bulk delete |
| **PR #13 (main)** | Neonatal (resumo/histórico) + módulo plano de saúde (planos, clubes, guias, templates; migrations 0019–0026) |
| **Branch de qualidade** | Desconto multi-pet correto; horário neonatal BR; até 2 tipos no registro; badges na lista; `getMyRole` fail-closed |

---

## 3. Inventário de módulos (estado atual)

| Área | Função |
|------|--------|
| Home | Dashboard, alertas, timeline |
| Pets | CRUD, microchip, castração, históricos |
| Registros | Formulário unificado; multi-pet; até 2 tipos por envio |
| Neonatal | Resumo do dia + histórico (pets &lt; 8 semanas) |
| Agenda | Lembretes |
| Plano de saúde | Planos por pet, guias/coparticipação, templates, clubes |
| Compras / Despesas | Cupom, membership, sync com gasto |
| Memórias | Galeria multi-foto |
| Assistente | Q&A local (sem LLM externo) |
| Configurações | Multi-família, papéis, convites, export JSON |

Libs principais: `roles.ts`, `households.ts`, `invites.ts`, `household-media.ts`, `records.ts` / `record-form.ts`, `neonatal-stats.ts`, `health-plan*.ts`, `petlove-health-reference.ts`, `commerce.ts`, `format.ts`.

---

## 4. Banco — migrations 0001–0026

| Faixa | Conteúdo |
|-------|----------|
| 0001–0006 | Schema inicial, commerce, memories/gallery, bootstrap household, multi-pet |
| 0007–0015 | Roster, convites, active household, ownership, storage via API, fim do orphan-delete no accept |
| 0016–0018 | Microchip, castração, tipo deworming |
| 0019–0026 | Planos de saúde, cobertura, clubes, promo, guias, notas, templates, múltiplos clubes `other` |

**Ops:** quem sobe ambiente novo precisa aplicar **até 0026** na ordem (pasta `supabase/migrations`).

---

## 5. Segurança

### O que está firme
- RLS: SELECT se membro; escrita se `can_edit_household` (owner/caregiver)
- Server Actions com `assertCanEdit` / `assertOwner` + UI `editable`
- Proxy de sessão; rotas públicas limitadas
- App só com publishable key (sem `service_role` no client)
- Storage privado; exclusão de mídia via Storage API (migration 0014)
- Convites: token forte, e-mail vinculado, RPCs SECURITY DEFINER; orphan auto-delete removido (0015)
- Fuso Brasil explícito; redirects de invite com `next` sanitizado
- **`getMyRole` fail-closed:** se a RPC falhar, retorna `null` (sem privilégio) — não assume `owner`

### Achados ainda abertos

| Prioridade | Achado | Onde |
|------------|--------|------|
| Média | Token de convite pode ir na query `?manual=` (histórico/logs) | `settings/members/actions` |
| Baixa | Senha mínima 6; signed URLs ~1h | login / pets / memories |
| Baixa | Export JSON incompleto (não inclui planos/guias/clubes novos) | `/api/export` |

---

## 6. Branch de qualidade (escopo do PR relacionado)

Correções e UX ligadas ao pacote neonatal + plano de saúde + registros:

1. Contagem correta do desconto multi-pet Petlove (ex.: Anya + Dobby → próximo = 3º)
2. Horário neonatal com calendário Brasília (sem “agora há pouco” falso)
3. Registro com até 2 tipos (ex.: xixi + cocô), inclusive zero seleção (submit bloqueado)
4. Badges de posição/desconto na **lista** de planos; hint de desconto só no **novo** plano (não na edição)
5. `getMyRole` fail-closed

**Fora deste PR (proposital):** reescrita de marketing do README / checklist de “produção pronta” — o produto ainda está em evolução; o inventário completo fica **neste** arquivo.

---

## 7. Conclusão

O CatCare já cobre um fluxo familiar amplo (cuidados + finanças leves + planos + neonatal), com defesa em profundidade. O maior salto recente foi o **PR #13**. A branch de qualidade fecha bugs e UX desse pacote sem misturar documentação de “go-live”.

### Próximos cortes sugeridos (depois do PR)
1. Evitar token de convite em `?manual=`
2. Completar `/api/export` com planos, guias e clubes
3. PWA / notificações
4. IA visual só com consentimento explícito

---

*Gerado a partir de auditoria de código + histórico git + migrations. Atualizar este arquivo quando houver novo marco (PR grande ou migration).*
