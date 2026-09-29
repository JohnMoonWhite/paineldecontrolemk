# Painel de Controle de Produtos — Especificação de Design

## Objetivo

Construir uma PWA privada para dois sócios acompanharem, em um único lugar, a saúde comercial e operacional de múltiplos produtos Supabase. O painel deve consolidar assinaturas válidas, vencimentos, pagamentos quando disponíveis, adoção do produto e alertas de operação, sem permitir escrita nos projetos-fonte.

## Decisões aprovadas

- O painel usará o projeto Supabase central `egagpdfcyazjuzeofbbl`, preservando todas as suas tabelas atuais.
- Os projetos-fonte serão acessados apenas por credenciais permanentes de menor privilégio, exclusivas para leitura.
- A sincronização ocorrerá a cada cinco minutos.
- O acesso ao painel será por e-mail, senha e segundo fator obrigatório, limitado aos dois administradores.
- Os detalhes de assinaturas armazenarão identificador externo e nome opcional; e-mails não serão centralizados.
- Dados consolidados do painel não serão misturados às tabelas existentes de contratos, clientes e assinaturas do projeto central.

## Arquitetura

```text
Projetos-fonte (somente leitura)
        │
        ▼
Conectores de origem ──► Função de sincronização central ──► Banco central
                                                              │
                                                              ▼
                                                        PWA privada
```

A função de sincronização roda no ambiente servidor do projeto central. Segredos de conexão ficam exclusivamente em segredos de função; o banco armazena somente uma referência lógica para cada segredo. Nenhuma chave de origem é enviada à PWA.

## Domínio de monitoramento

As tabelas abaixo serão novas e terão o prefixo `monitoring_` para não colidirem com o domínio já existente.

| Tabela | Responsabilidade |
| --- | --- |
| `monitoring_admins` | Lista dos dois usuários autorizados a abrir o painel. |
| `monitoring_sources` | Cadastro da origem, adaptador, referência externa, chave lógica do segredo, status e última sincronização. |
| `monitoring_sync_runs` | Histórico imutável de execuções, duração, resultado, totais e erro sanitizado. |
| `monitoring_subscription_facts` | Estado atual de uma assinatura por origem e identificador externo. Inclui nome opcional, plano, situação, vencimento, provedor, valor e data de observação. |
| `monitoring_usage_metrics` | Métricas agregadas por origem, período, chave e dimensões não identificáveis. |
| `monitoring_alerts` | Alertas atuais e seu ciclo de vida: vencimento próximo, validade inconsistente, fonte atrasada e alerta operacional. |

Os dados sensíveis não necessários — e-mail, telefone, textos brutos de webhooks, tokens, documentos e payloads completos — não serão copiados para essas tabelas.

## Adaptadores iniciais

### OrdemSync

- Assinaturas: `profiles`, `organizations` e `organization_members`.
- Pagamentos: `pix_payments`; eventos Stripe e Mercado Pago apenas como auditoria, nunca como fonte primária de estado.
- Regra: perfis com vínculo empresarial ativo não são contados como assinaturas individuais.

### Produto agro operacional

- Uso: `memberships`, `company_modules`, `pivot_device_commands`, `pivots`, `irrigation_logs`, `work_orders`, `stock_movements`, `weighings`, `purchases` e `notifications`.
- Métricas: usuários ativos, adoção por módulo, comandos enviados/confirmados/falhos, latência, pendências e última atividade.

### Produto de orçamentos

- Assinaturas: `subscriptions` e `payments`.
- Uso: `activity_logs`, `ai_usage`, `budgets`, `budget_items`, `lost_sales` e `scheduled_notifications`.

### PMS

- Assinaturas: `contas` e `assinaturas`.
- Uso futuro: membros, fazendas, gateways, telemetria, alarmes, intervenções, notificações, auditoria e saúde do sistema.

## Segurança e acesso

- Todas as novas tabelas expostas em `public` terão RLS ativada.
- Leitura no painel será permitida somente a uma sessão autenticada, presente em `monitoring_admins`, com AAL2 (segundo fator concluído).
- Escritas nas tabelas de monitoramento serão exclusivas do sincronizador de servidor.
- Não haverá `service_role` ou chave secreta no cliente.
- Cada origem terá credencial de leitura restrita às tabelas e colunas necessárias; os produtos-fonte não receberão alterações de dados ou lógica de negócio.
- A execução, os erros e o acesso administrativo serão auditáveis.

## Sincronização e consistência

1. Um agendador chama a função central a cada cinco minutos.
2. A função seleciona as fontes habilitadas e executa o adaptador correspondente.
3. Cada adaptador valida forma, tipos, campos exigidos e totais antes de publicar o novo retrato.
4. Em sucesso, a função atualiza fatos e métricas, grava uma execução concluída e atualiza a saúde da fonte.
5. Em falha, a função grava o erro sanitizado, preserva o último retrato íntegro e abre ou atualiza um alerta de fonte atrasada.
6. Uma origem sem sincronização bem-sucedida por 15 minutos entra em atenção.

O painel deve distinguir explicitamente entre status informado pela origem, validade confirmada por data, informação sem data de vencimento e dado desatualizado.

## Experiência da PWA

A tela inicial mostra, por produto:

- assinaturas válidas, em vencimento, expiradas e com dados incompletos;
- receita e pagamentos quando a origem fornecer valores confiáveis;
- usuários ativos, última atividade e adoção por recurso;
- falhas operacionais relevantes, como comandos de pivô sem confirmação;
- horário da última sincronização e estado da fonte.

As telas de detalhe permitem filtrar por produto, período, estado e identificador, sem mostrar e-mails. Alertas priorizam vencimentos próximos, registros inconsistentes e fontes desatualizadas.

## Verificação

- Testes unitários para cada normalizador com amostras representativas de cada fonte.
- Testes de integração de leitura para confirmar tabelas, campos e contagens esperadas antes de ativar uma origem.
- Teste de falha para confirmar que uma sincronização incompleta não remove o último retrato confiável.
- Testes RLS para administradores com segundo fator e para usuários não autorizados.
- Teste ponta a ponta da PWA cobrindo login, filtros, dados desatualizados e alertas.

## Fora de escopo inicial

- Escrita em qualquer projeto-fonte.
- Ações de cobrança, cancelamento ou alteração de planos pelo painel.
- Exposição de e-mails ou dados brutos de pagamento.
- Tempo real por webhook; a primeira versão usa sincronização a cada cinco minutos.
