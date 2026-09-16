# Resumo da Implementação — Bloco 21: Seguir Usuários / Rede Social Inicial

## Visão Geral
O Bloco 21 introduz a primeira camada real de conexão social no Intent. O perfil público dos usuários agora exibe contadores de seguidores e perfis seguidos, permite seguir e deixar de seguir com idempotência, e permite explorar a lista de conexões sociais por modal.

## Detalhes Backend
1. **Model do Prisma**: A tabela `follows` (`Follow`) já estava presente no `schema.prisma` com índice único composto em `(followerId, followingId)`. Nenhuma migration foi necessária.
2. **Rotas da API**:
   - `POST /v1/users/:id/follow` — Registra a conexão entre o `viewer` e o `target`. Emite evento e notificação do tipo `FOLLOW_RECEIVED`.
   - `DELETE /v1/users/:id/follow` — Remove a conexão social.
   - `GET /v1/users/:id/followers` — Lista os seguidores com suporte a paginação por cursor.
   - `GET /v1/users/:id/following` — Lista quem o perfil segue.
3. **Serviço**: `backend/src/services/social-service.ts` gerencia o ciclo de vida das conexões, garantindo que o usuário não possa seguir a si mesmo e que tentativas duplicadas de follow sejam tratadas com idempotência (`skipDuplicates: true`).

## Detalhes Frontend
1. **Componente de Perfil Público**: `src/components/PublicUserProfile.tsx` integrado com os métodos `followUser`, `unfollowUser`, `listProfileFollowers` e `listProfileFollowing`.
2. **UX de Conexão**:
   - Botão "Seguir" / "Seguindo" / "Deixar de seguir" com feedback visual ao passar o mouse.
   - Atualização otimista com reversão automática em caso de erro.
   - Modais interativos para navegação nos seguidores/seguindo.
