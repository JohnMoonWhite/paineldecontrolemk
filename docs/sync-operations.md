# Operação da sincronização do OrdemSync

## O que a função faz

A Edge Function privada, `sync-ordersync`, consulta apenas os campos permitidos do OrdemSync, elimina usuários individuais que pertencem a organizações ativas e grava uma nova fotografia completa no banco central. Nenhuma falha apaga a última fotografia válida.

Ela usa o Transaction pooler com uma conexão por execução e consultas em série. Isso evita o pipelining incompatível com esse modo de pool.

## Segredos necessários no projeto central

Em **Edge Functions → Secrets**, no projeto `egagpdfcyazjuzeofbbl`, mantenha:

| Key | Finalidade |
| --- | --- |
| `ORDERSYNC_DATABASE_URL` | conexão somente leitura do OrdemSync |
| `MONITORING_SCHEDULER_KEY` | valor da chave secreta central chamada `monitoring_scheduler` |

Crie a chave `monitoring_scheduler` em **Settings → API Keys** como uma chave secreta. Copie-a diretamente para `MONITORING_SCHEDULER_KEY`; ela nunca deve ir para o navegador, Git, SQL ou conversa.

## Agendamento e botão "Atualizar agora"

A migration `monitoring_sync_dispatch` cria:

- `private.dispatch_monitoring_syncs()`: chama `sync-<código>` para cada fonte de `monitoring_sources`, enviando a chave no cabeçalho `apikey`;
- o Job `monitoring-sync-every-5-minutes` (pg_cron), que executa essa função a cada cinco minutos;
- `public.request_monitoring_sync()`: usada pelo botão "Atualizar agora". Só admins do painel com MFA (aal2) podem chamá-la; uma coleta iniciada nos últimos 20 segundos é reaproveitada.

A chave `monitoring_scheduler` fica no Vault do projeto central com o nome **`monitoring_scheduler_key`**. O nome é obrigatório:

```sql
select vault.create_secret('<chave sb_secret_...>', 'monitoring_scheduler_key');
```

Ela nunca deve ir para o navegador, Git ou conversa. Ao rotacionar a chave, atualize tanto o segredo `MONITORING_SCHEDULER_KEY` da Edge Function quanto o segredo do Vault.

## Verificação e recuperação

Uma resposta bem-sucedida informa apenas o código da fonte, quantidade de registros e duração. Confirme no painel que a fonte **OrdemSync** ficou saudável e apresenta uma execução bem-sucedida.

Se uma execução falhar, a fotografia anterior continua disponível. A fonte aparece como aviso nos primeiros 15 minutos; depois disso, como desatualizada. Para recuperar, corrija o segredo no projeto central e execute novamente o Job. Não altere tabelas, dados ou políticas do OrdemSync.
