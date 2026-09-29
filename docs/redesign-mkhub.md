# Revisão MKHUB — 29/09/2026

A interface passou a usar a logo fornecida, sem alterar o arquivo original, e uma paleta escura com ciano e violeta. O acesso usa uma composição de marca e formulário; o painel usa navegação lateral, indicadores, estado dos projetos, composição da carteira e tabela com busca e filtros. No celular, a navegação fica no topo e a tabela permite rolagem horizontal.

## Correções implementadas

- Reinício de cadastro MFA interrompido: remove apenas fatores TOTP não verificados com o nome usado por este painel, pela API autenticada do próprio usuário. Fatores confirmados não são removidos. Cliques simultâneos na mesma aba são bloqueados.
- QR acompanhado de chave de configuração manual e mensagens para sessão expirada, limite de tentativas, conflito e código incorreto. A chave fica apenas em memória durante o cadastro.
- Chamadas adicionais de Auth são adiadas para fora do callback de sessão. Saída de sessão limpa os dados de inscrição.
- Consulta do painel a cada cinco minutos, ao recuperar a conexão e ao voltar à aba. Falhas de consulta preservam o último retrato; perda de autorização limpa os dados em memória.
- Assinaturas são buscadas em páginas para evitar truncamento no limite padrão da API.
- Validade exige situação ativa e vencimento futuro. Falta de data, data inválida, expiração e testes são tratados separadamente.
- Origem fica desatualizada após 15 minutos sem coleta, mesmo que seu status persistido ainda seja saudável.
- Nome, idioma, ícone e cores da PWA atualizados; cabeçalhos básicos de segurança no Cloudflare Pages.

## Pendências confirmadas na revisão

- A conta de Matheus ainda tinha um fator não verificado na última consulta. A conclusão exige que ele cadastre o novo QR e confirme um código de seu autenticador.
- O banco central tinha uma origem cadastrada (OrdemSync), nenhuma assinatura coletada e uma execução com falha. A revisão da interface não resolve a conexão servidor-origem nem ativa os adaptadores agro, orçamentos e PMS.
- A atualização de cinco minutos da interface consulta o banco central; não substitui o agendamento servidor-servidor descrito em `sync-operations.md`.

Os registros fictícios usados para conferir o layout ficaram somente em uma prévia local temporária e não foram gravados no banco ou incluídos na publicação.
