# Etapa 13 — autoridade do backend (F0)

O MVP aceita criação pelo `POST /v1/intents` e alterações de apoio por
`POST /v1/intents/:id/supports` e `DELETE /v1/intents/:id/supports`.
Os contratos e envelopes existentes são preservados.

- O proprietário e o autor de cada apoio vêm da identidade autenticada pelo
  middleware do servidor. Campos como `creatorId`, `status`, `supportCount` e
  `realizedAt` não pertencem ao comando de criação e são rejeitados. O serviço
  também valida o comando, mesmo quando chamado sem passar pela rota.
  Criação e alterações revalidam a conta ativa dentro da transação. Novos apoios
  também exigem que o criador esteja ativo.
- Toda Intent nasce `PUBLISHED`, com zero apoios e sem data de realização.
  Não existe endpoint de edição de condições ou de liberação manual, inclusive
  para o criador. A meta publicada permanece fixa.
- A realização acontece exclusivamente ao atingir a meta dentro da transação
  serializável de apoio. Falha na transição ou na gravação do evento aborta a
  operação inteira. Conflitos de serialização têm até três tentativas. Contadores
  inválidos ou estado publicado já realizado são rejeitados antes de alterar
  apoios; a retirada não mascara um contador zero quando existe um apoio.
- A leitura verifica visibilidade e propriedade antes de decifrar. Visibilidades
  e estados desconhecidos são negados. `REALIZED` exige meta satisfeita e data de
  realização. O criador acessa suas Intents privadas/exclusivas, mas também
  aguarda a realização para receber o conteúdo. Conteúdo público realizado
  continua público, conforme o contrato anterior. Metadados de Intents canceladas
  continuam acessíveis conforme a visibilidade, sempre sem revelação.
- Criação, apoio, retirada e realização registram eventos na mesma transação
  da alteração, com ator, payload, horário e chave de idempotência. A restrição
  única existente em `domain_events.idempotency_key` impede eventos duplicados;
  `supports(intent_id, user_id)` impede apoio duplicado. Retirar e apoiar de novo
  constitui uma nova participação, com nova identidade de evento. A retirada usa
  somente o apoio do ator autenticado e continua permitida após deixar de seguir.
  Colisões na auditoria abortam a transação e não são rotuladas como apoio duplicado.
  As migrações existentes já impedem UPDATE/DELETE em eventos por triggers.

## Validação e limites

Os testes exercitam rotas HTTP, autenticação com verificador substituído,
serviços reais e criptografia real. A persistência é substituída por doubles;
rollback é verificado com um double transacional. Não são testes de concorrência
ou de constraints em um PostgreSQL real. A autoridade descrita é a fronteira da
API; esta etapa não altera permissões administrativas do banco nem adiciona
triggers. Não existem rotas de alteração ou remoção dos eventos de auditoria.

Nenhuma alteração em Firebase, infraestrutura, portas ou funcionalidades sociais.


## Verificações desta entrega

- Suíte backend: 86 testes de domínio, HTTP e regressão de seguidores/apoios.
- Lint TypeScript e builds do backend e frontend; geração do Prisma Client.
- `prisma validate`: schema válido. Os três arquivos de migração permanecem
  idênticos à base do PR: fundação, categoria e seguidores. Revisados os índices
  únicos de apoio/evento, chaves estrangeiras e triggers append-only. Não há nova
  migração; deploy/status contra banco real não foi executado nesta validação.
- Gitleaks 8.30.1: varredura dos arquivos versionados e do histórico disponível.
  Alertas preexistentes incluem configuração web Firebase, chave fixa do cofre
  legado (`src/utils/cryptoVault.ts` e cópia em `archive/intentV1`) e conteúdo de
  exemplo. Nenhum desses valores é introduzido por este PR. A chave fixa legada
  merece tratamento separado: esta etapa não muda o cofre antigo nem o Firebase.
  A varredura dos arquivos alterados neste PR não encontrou segredos.

A revisão deve distinguir os testes com persistência simulada de validação em
PostgreSQL real. Este PR fica restrito à Etapa 13; sem merge automático.
