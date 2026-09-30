# Credencial de leitura do OrdemSync

O painel acessa o projeto OrdemSync somente pelo servidor. O navegador nunca recebe esta credencial.

## Escopo permitido

Crie uma credencial permanente limitada a leitura dos dados necessários. Ela deve usar o **Transaction pooler** do Supabase, que é adequado para uma Edge Function.

- `profiles`: `id,nome,plano,subscription_status,trial_ends_at,current_period_end,cancel_at_period_end,payment_provider,stripe_subscription_id`
- `organizations`: `id,nome,plano,subscription_status,current_period_end,trial_ends_at,payment_provider,seats,stripe_subscription_id`
- `organization_members`: `org_id,user_id,status`
- `pix_payments`: `user_id,org_id,status,plan,amount_cents,access_ends_at,paid_at`
- `monitoring.stripe_subscriptions` (view): `subscription_id,status,period_end,amount_cents,currency`

### Assinaturas Stripe

O OrdemSync guarda vencimento e valor das assinaturas Stripe apenas no `payload` bruto de `stripe_events`. Para que a credencial não leia esse payload, uma view em um schema não publicado pela API expõe só o estado mais recente de cada assinatura. Troque `<usuario_leitor>` pelo usuário da URL (a parte antes de `.qggkcflrmusfvjqsfhsf`):

```sql
create schema if not exists monitoring;
revoke all on schema monitoring from public, anon, authenticated;

create or replace view monitoring.stripe_subscriptions as
select distinct on (subscription_id) subscription_id, status, period_end, amount_cents, currency
from (
  select
    payload->'data'->'object'->>'id' as subscription_id,
    payload->'data'->'object'->>'status' as status,
    to_timestamp(coalesce(
      (payload->'data'->'object'->>'current_period_end')::bigint,
      (payload->'data'->'object'->'items'->'data'->0->>'current_period_end')::bigint
    )) as period_end,
    (payload->'data'->'object'->'items'->'data'->0->'price'->>'unit_amount')::bigint as amount_cents,
    payload->'data'->'object'->>'currency' as currency,
    processed_at
  from public.stripe_events
  where type like 'customer.subscription.%'
) subscription_events
where subscription_id is not null
order by subscription_id, processed_at desc;

revoke all on monitoring.stripe_subscriptions from public, anon, authenticated;
grant usage on schema monitoring to <usuario_leitor>;
grant select on monitoring.stripe_subscriptions to <usuario_leitor>;
grant select (stripe_subscription_id) on public.profiles to <usuario_leitor>;
grant select (stripe_subscription_id) on public.organizations to <usuario_leitor>;
```

A view roda com as permissões de quem a criou, por isso o leitor não precisa de acesso a `stripe_events`.

Não conceda escrita. Não altere tabelas, dados, políticas RLS, funções, gatilhos nem qualquer comportamento do OrdemSync.

## Configuração no painel central

Depois de criada a credencial de somente leitura, guarde a URL completa como um segredo das Edge Functions do projeto central `egagpdfcyazjuzeofbbl`:

| Campo | Valor |
| --- | --- |
| Key | `ORDERSYNC_DATABASE_URL` |
| Value | a URI completa do Transaction pooler para `monitoring_ordersync_reader` |

Use o painel de segredos do Supabase. Nunca cole a credencial em código, migrações SQL, variáveis `VITE_`, logs ou mensagens. Caso a senha possua caracteres especiais, ela precisa estar codificada na URL.

## Rotação

Se a credencial for exposta, revogue-a no OrdemSync, crie outra com o mesmo escopo de leitura e atualize somente o segredo `ORDERSYNC_DATABASE_URL` do projeto central. Não é necessário reenviar o PWA.
