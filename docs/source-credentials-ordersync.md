# Credencial de leitura do OrdemSync

O painel acessa o projeto OrdemSync somente pelo servidor. O navegador nunca recebe esta credencial.

## Escopo permitido

Crie uma credencial permanente limitada a leitura dos dados necessários:

- \`profiles\`: \`id,nome,plano,subscription_status,trial_ends_at,current_period_end,cancel_at_period_end,payment_provider\`
- \`organizations\`: \`id,name,plano,subscription_status,current_period_end,trial_ends_at,cancel_at_period_end,payment_provider,seats\`
- \`organization_members\`: \`organization_id,user_id,status\`
- \`pix_payments\`: \`user_id,organization_id,status,plan,amount_cents,currency,access_ends_at,paid_at\`

Não conceda escrita. Não altere tabelas, dados, políticas RLS, funções, gatilhos nem qualquer comportamento do OrdemSync.

## Configuração no painel central

Depois de criada a credencial de somente leitura, guarde os valores nos segredos das Edge Functions do projeto central \`egagpdfcyazjuzeofbbl\`:

\`\`\`powershell
supabase secrets set --project-ref egagpdfcyazjuzeofbbl ORDERSYNC_SUPABASE_URL="https://qggkcflrmusfvjqsfhsf.supabase.co"
supabase secrets set --project-ref egagpdfcyazjuzeofbbl ORDERSYNC_READONLY_KEY="<credencial-de-leitura>"
\`\`\`

Use um arquivo local ignorado pelo Git ou o painel de segredos do Supabase para fornecer a chave. Nunca cole a credencial em código, migrações SQL, variáveis \`VITE_\`, logs ou mensagens.

## Rotação

Se a credencial for exposta, revogue-a no OrdemSync, crie outra com o mesmo escopo de leitura e atualize somente o segredo \`ORDERSYNC_READONLY_KEY\` do projeto central. Não é necessário reenviar o PWA.
