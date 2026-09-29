# Credencial de leitura do OrdemSync

O painel acessa o projeto OrdemSync somente pelo servidor. O navegador nunca recebe esta credencial.

## Escopo permitido

Crie uma credencial permanente limitada a leitura dos dados necessários. Ela deve usar o **Transaction pooler** do Supabase, que é adequado para uma Edge Function.

- `profiles`: `id,nome,plano,subscription_status,trial_ends_at,current_period_end,cancel_at_period_end,payment_provider`
- `organizations`: `id,nome,plano,subscription_status,current_period_end,trial_ends_at,payment_provider,seats`
- `organization_members`: `org_id,user_id,status`
- `pix_payments`: `user_id,org_id,status,plan,amount_cents,access_ends_at,paid_at`

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
