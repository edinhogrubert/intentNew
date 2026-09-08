# Autoridade do backend — F0

O MVP aceita criação pelo `POST /v1/intents` e alterações de apoio por
`POST /v1/intents/:id/supports` e `DELETE /v1/intents/:id/supports`.
Os contratos e envelopes existentes são preservados.

- O proprietário e o autor de cada apoio vêm da identidade autenticada pelo
  middleware do servidor. Campos como `creatorId`, `status`, `supportCount` e
  `realizedAt` não pertencem ao comando de criação e são rejeitados. O serviço
  também valida o comando, mesmo quando chamado sem passar pela rota.
- Toda Intent nasce `PUBLISHED`, com zero apoios e sem data de realização.
  Não existe endpoint de edição de condições ou de liberação manual, inclusive
  para o criador. A meta publicada permanece fixa.
- A realização acontece exclusivamente ao atingir a meta dentro da transação
  serializável de apoio. Falha na transição ou na gravação do evento aborta a
  operação inteira. Conflitos de serialização têm até três tentativas.
- A leitura verifica visibilidade e propriedade antes de decifrar. Visibilidades
  e estados desconhecidos são negados. `REALIZED` exige meta satisfeita e data de
  realização. O criador acessa suas Intents privadas/exclusivas, mas também
  aguarda a realização para receber o conteúdo. Conteúdo público realizado
  continua público, conforme o contrato anterior.
- Criação, apoio, retirada e realização registram eventos na mesma transação
  da alteração, com ator, payload, horário e chave de idempotência. A restrição
  única existente em `domain_events.idempotency_key` impede eventos duplicados;
  `supports(intent_id, user_id)` impede apoio duplicado. Retirar e apoiar de novo
  constitui uma nova participação, com nova identidade de evento.

## Validação e limites

Os testes exercitam rotas HTTP, autenticação com verificador substituído,
serviços reais e criptografia real. A persistência é substituída por doubles;
rollback é verificado com um double transacional. Não são testes de concorrência
ou de constraints em um PostgreSQL real. A autoridade descrita é a fronteira da
API; esta etapa não altera permissões administrativas do banco nem adiciona
triggers. Não existem rotas de alteração ou remoção dos eventos de auditoria.

Nenhuma alteração em Firebase, infraestrutura, portas ou funcionalidades sociais.
