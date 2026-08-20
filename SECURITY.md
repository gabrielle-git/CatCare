# Segurança — CatCare

Este documento descreve as decisões de segurança do app e o que configurar no Supabase/Vercel para produção.

## Modelo de acesso

- **Autenticação:** Supabase Auth (e-mail + senha).
- **Autorização:** Row Level Security (RLS) em todas as tabelas de dados; cada linha pertence a uma `household_id`.
- **Papéis:** `owner` (dono), `caregiver` (cuidador), `viewer` (visitante). Escrita sensível exige `owner` ou `caregiver` via Server Actions (`assertCanEdit`).
- **Família ativa:** `profiles.active_household_id` define qual família a sessão enxerga; RPCs usam `my_household_id()`.

## Dados e storage

- Bucket **`pet-media`** é **privado**; URLs assinadas no servidor quando necessário.
- **Excluir família** remove arquivos via **Storage API** na Server Action (`removeHouseholdMedia`), não com `DELETE` em `storage.objects` (bloqueado pelo Supabase).
- **Excluir família** exige digitar o nome na UI e só funciona se o dono for o único membro.
- **Exportação JSON** (`/api/export`) exige sessão e limita-se à família ativa do usuário.

## Convites

- Tokens de convite são UUIDs; validados no RPC `accept_household_invite`.
- Convite amarrado ao **e-mail** convidado; outra conta não aceita.
- Convites expiram; aceite idempotente se o mesmo usuário reabrir o link.
- **Não** apagamos famílias “órfãs” automaticamente ao aceitar convite (migration `0015`). Quem criou uma família vazia antes de entrar em outra deve excluí-la explicitamente em Configurações, se quiser.

## Server Actions

- Toda mutação passa por `createClient()` no servidor e checa `auth.getUser()`.
- Redirect para `/login` se não autenticado; `assertCanEdit` para visitantes.
- Nunca commitar `.env.local`, chaves Resend ou service role.

## Checklist de produção (Supabase)

Configure **uma vez** no projeto:

| Item | Onde | Recomendação |
|------|------|--------------|
| Confirm email | Authentication → Providers → Email | **Ligar** em produção; cadastro mostra mensagem para confirmar antes de entrar |
| Site URL | Authentication → URL Configuration | **Tem que ser** `https://cat-care-xi.vercel.app` (não `cat-care-v1` nem outro deploy antigo) |
| Redirect URLs | Idem | `https://cat-care-xi.vercel.app/auth/callback` e `http://localhost:3000/auth/callback` |
| RLS | Table Editor → cada tabela | Políticas ativas (via migrations) |
| Migrations | SQL Editor | Rodar `0001` … `0015` na ordem |

## Checklist Vercel / Resend

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` nas env vars da Vercel.
- `NEXT_PUBLIC_APP_URL` = URL pública do app (links de convite).
- `RESEND_API_KEY` apenas no servidor; domínio verificado no Resend para sair do `onboarding@resend.dev`.

## E-mail de confirmação (template)

Em **Authentication → Email Templates → Confirm signup**, substitua o HTML padrão por:

```html
<h2>Confirme sua conta no CatCare</h2>
<p>Olá! Para terminar o cadastro, toque no botão abaixo.</p>
<p><a href="{{ .ConfirmationURL }}">Confirmar meu e-mail</a></p>
<p>Se você não criou esta conta, ignore este e-mail.</p>
```

Assunto sugerido: `Confirme sua conta no CatCare`

O remetente `noreply@mail.app.supabase.io` só muda quando o projeto usa um SMTP próprio (Resend/domínio).

## IA (futuro)

- Respostas devem usar **dados reais** da família (compras, peso, agenda), não inventar.
- Não enviar tokens, service role ou dados de outras famílias ao provedor de IA.
- Rate limit e auditoria de prompts ficam pendentes até integrar o modelo.

## Reportar problemas

Se encontrar vazamento entre famílias, convite indevido ou falha de RLS, abra issue no repositório com passos para reproduzir — não publique IDs ou tokens reais.
