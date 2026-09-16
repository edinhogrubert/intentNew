# Arquivos Alterados — Bloco 23: Feed de Seguidos

## Arquivos Modificados

1. **`backend/src/routes/intents.ts`**
   - Atualizado `feedQuerySchema` para incluir `'all'` no enum de escopos aceitos (`['public', 'following', 'all']`).
   - Roteamento garantido para `listFollowingFeed` (quando `scope === 'following'`) e `listPublicFeed` (quando `scope === 'public'` ou `'all'`).

2. **`src/services/intentApi.ts`**
   - Atualizado tipo `FeedScope` para `'public' | 'following' | 'all'`.
   - Função `listPublicIntents` normalizada para passar os parâmetros corretos à API.

3. **`src/components/MvpHomeFeed.tsx`**
   - Atualizado o seletor de abas na Home para `[Todos] [Seguindo]`.
   - Ajustado o estado vazio para o feed de seguidos com mensagem orientativa e botão para explorar o feed geral.
   - Ajustado o tratamento de erros para feedbacks amigáveis de rede.

4. **`backend/tests/social-http.test.ts`**
   - Adicionados testes para `scope=all`, paginação no feed de seguidos, proteção de dados sensíveis e ordenação.

## Arquivos Criados

1. **`docs/ai-handoff/bloco-23-feed-de-seguidos.md`**
2. **`docs/ai-handoff/block-23/reports/resumo-implementacao.md`**
3. **`docs/ai-handoff/block-23/reports/validacoes.md`**
4. **`docs/ai-handoff/block-23/diff/arquivos-alterados.md`**
