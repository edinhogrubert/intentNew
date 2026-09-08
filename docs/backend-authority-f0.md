# Etapa 13 — autoridade do backend e idempotência

## Autoridade e compatibilidade

O MVP mantém seus endpoints e envelopes: `POST /v1/intents`,
`POST /v1/intents/:id/supports` e `DELETE /v1/intents/:id/supports`.
O proprietário e o ator vêm da identidade autenticada; a conta é revalidada na
transação. O serviço valida o comando de criação e rejeita campos de autoridade
como `creatorId`, `status`, `supportCount` e `realizedAt`.

Toda Intent nasce `PUBLISHED`, sem apoios ou data de realização. Não existe
endpoint de edição de condições ativas ou liberação manual, inclusive para o
criador. Só o backend realiza ao atingir a meta. Visibilidade e proprietário são
verificados antes de decifrar. O criador também aguarda a realização. Metadados de
Intents canceladas continuam acessíveis conforme a visibilidade, sem revelação.

Novos apoios exigem criador ativo e permissão de acesso. A retirada só modifica a
participação do ator, inclusive após deixar de seguir. Contadores inconsistentes
são rejeitados. Domínio e eventos são gravados juntos; falhas revertem a transação.
Os índices únicos de apoio/evento e triggers append-only existentes são mantidos.

## Contrato Idempotency-Key

O header é opcional nos três endpoints. Sem header, o comportamento anterior é
preservado, inclusive criar outra Intent ao repetir o POST de criação.

- Chave: 1–128 caracteres ASCII, entre letras, números, ponto, `_`, `:` e `-`.
  Header vazio, malformado ou repetido com valores concatenados resulta em 400.
- Escopo único: **usuário autenticado + operação + chave**. As operações são
  `CREATE_INTENT`, `SUPPORT_INTENT:<uuid>` e `REMOVE_SUPPORT:<uuid>`. O UUID é
  normalizado para minúsculas. A chave pode ser igual em usuários, alvos e
  operações diferentes sem colisão.
- Uma chave já concluída retorna o JSON original e o mesmo status HTTP: 201 na
  criação/apoio, 200 na retirada. É um resultado histórico, não uma consulta do
  estado atual. Reenviar apoio após retirada não restaura a participação; reenviar
  retirada após novo apoio não remove a nova participação. Para uma nova ação,
  use uma chave nova.
- Na criação, reutilizar a chave com outro comando validado retorna
  `409 IDEMPOTENCY_KEY_REUSED`. Ordem dos campos e defaults normalizados não
  mudam o comando. Nos apoios/retiradas, o comando é o alvo da rota; o corpo
  continua sem efeito, como na API anterior.
- A conta precisa continuar ativa mesmo para consultar um resultado anterior.
  Replay não modifica o domínio nem revela conteúdo protegido.
- Falhas de validação/autorização/transação não são memorizadas. Uma tentativa
  que não confirmou pode ser reenviada com a mesma chave. Conflitos de
  serialização/reserva têm até três tentativas; se esgotadas, retornam
  `409 INTENT_STATE_CONFLICT`, permitindo reenvio com a mesma chave.

## Persistência e nova migração

`20260908000100_add_request_idempotency` é aditiva: cria
`idempotency_requests` com FK para o ator e índice único
`(actor_id, operation, key)`. As três migrações anteriores não são modificadas.
Não há backfill ou alteração de Intents/eventos existentes.

A reserva da chave, a mutação, os eventos e a resposta JSON pertencem à mesma
transação serializável. A restrição única coordena processos concorrentes;
colisões fazem nova tentativa com snapshot atualizado. Não existe cache em
memória como fonte de verdade. A reserva sem resposta só existe dentro da
transação: falha na resposta reverte também a reserva e os efeitos do domínio.

Não são armazenados comando nem revelação em texto na tabela. A impressão do
comando usa HMAC-SHA256 com separação de domínio e a chave de criptografia já
configurada, evitando hashes simples de conteúdo adivinhável. A resposta salva
contém apenas os dados já devolvidos pelo endpoint. Preservar a chave existente
nos backups; sua troca também afeta a comparação de reenvios anteriores.

Aplicar `npm run db:migrate` antes de executar o backend atualizado. Não remover
registros de idempotência indiscriminadamente: a garantia dura enquanto forem
preservados. Não há expiração automática nesta etapa. Um rollback de aplicação
pode manter a tabela aditiva; não excluir registros durante rollback operacional.

## Validação reproduzível

- `npm test`: 86 testes com persistência simulada, mantendo os testes anteriores.
- `TEST_DATABASE_URL=<conexão-descartável> npm run test:postgres`: 22 testes com
  PostgreSQL real, migrações, HTTP, concorrência, falha parcial, reenvio e
  regressão de acesso/seguidores. Somente o verificador externo Firebase é
  substituído. A suíte exige banco local nomeado `intent_test_*`, aplica as
  migrações e cria fixtures/triggers temporários; nunca usar banco compartilhado
  com a aplicação. Descartar o banco após a execução.
- O CI executa ambas as suítes. PostgreSQL descartável no runner com porta
  dinâmica; não há alteração dos containers ou portas de produção.
- Lint/build backend e frontend e `prisma validate` fazem parte da validação.

Gitleaks encontrou alertas preexistentes na configuração web Firebase, cofre
legado e exemplos. Não são introduzidos por esta etapa; a chave fixa legada exige
tratamento separado. Nenhum valor sensível é reproduzido nesta documentação.

Sem novas funcionalidades sociais, alterações em Firebase ou infraestrutura de
produção. Todos os ajustes permanecem no PR #4; sem merge automático.
