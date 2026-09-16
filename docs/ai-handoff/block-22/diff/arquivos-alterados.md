# Arquivos Alterados — Bloco 22

## Arquivos Criados
- `docs/ai-handoff/bloco-22-identidade-social-do-usuario.md`
- `docs/ai-handoff/block-22/reports/resumo-implementacao.md`
- `docs/ai-handoff/block-22/reports/validacoes.md`
- `docs/ai-handoff/block-22/diff/arquivos-alterados.md`

## Arquivos Modificados
1. `backend/src/services/public-profile-service.ts`
   - Adicionada a busca em paralelo no `Promise.all` de: `supportedIntentsCount`, `reactionsGivenCount`, `commentsGivenCount`, `realizedParticipationsCount`.
   - Adicionados os respectivos campos no objeto `stats`.

2. `src/services/intentApi.ts`
   - Atualizada a interface `ApiPublicUserProfile['stats']` para incluir as novas métricas de participante.

3. `src/components/PublicUserProfile.tsx`
   - Seção Conexões (Seguidores e Seguindo em cards interativos com abertura de modais).
   - Seção Como criador (5 cards: Intents públicas, Realizações, Apoios recebidos, Reações recebidas, Comentários recebidos).
   - Seção Como participante (4 cards: Intents apoiadas, Reações dadas, Comentários feitos, Participações realizadas).
   - Card de resumo da Identidade Social com cálculos proporcionais e vocabulário sem o termo "comunidade".

4. `backend/tests/social-http.test.ts`
   - Atualizados os mocks padrão em `beforeEach` para cobrir contagens de suporte, reação e comentários de participante.
   - Atualizada a asserção do endpoint `/profile` validando a presença e valores das novas métricas.
