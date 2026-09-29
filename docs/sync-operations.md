# Operação da sincronização do OrdemSync

## O que a função faz

A Edge Function privada, `sync-ordersync`, consulta apenas os campos permitidos do OrdemSync, elimina usuários individuais que pertencem a organizações ativas e grava uma nova fotografia completa no banco central. Nenhuma falha apaga a última fotografia válida.

Ela usa o Transaction pooler com uma conexão por execução e consultas em série. Isso evita o pipelining incompatível com esse modo de pool.

## Segredos necessários no projeto central

Em **Edge Functions → Secrets**, no projeto `egagpdfcyazjuzeofbbl`, mantenha:

| Key | Finalidade |
| --- | --- |
| `ORDERSYNC_DATABASE_URL` | conexão somente leitura do OrdemSync |
| `MONITORING_SCHEDULER_KEY` | valor da chave secreta central chamada `monitoring-scheduler` |

Crie a chave `monitoring-scheduler` em **Settings → API Keys** como uma chave secreta. Copie-a diretamente para `MONITORING_SCHEDULER_KEY`; ela nunca deve ir para o navegador, Git, SQL ou conversa.

## Agendamento de cinco minutos

Após publicar `sync-ordersync`, crie um Job em **Cron / Jobs** no projeto central para executá-la a cada cinco minutos. O pedido deve enviar o valor de `monitoring-scheduler` somente no cabeçalho `apikey`.

O Job não deve apontar para o OrdemSync nem carregar credenciais do projeto fonte. Ele chama somente a função central `sync-ordersync`.

## Verificação e recuperação

Uma resposta bem-sucedida informa apenas o código da fonte, quantidade de registros e duração. Confirme no painel que a fonte **OrdemSync** ficou saudável e apresenta uma execução bem-sucedida.

Se uma execução falhar, a fotografia anterior continua disponível. A fonte aparece como aviso nos primeiros 15 minutos; depois disso, como desatualizada. Para recuperar, corrija o segredo no projeto central e execute novamente o Job. Não altere tabelas, dados ou políticas do OrdemSync.
