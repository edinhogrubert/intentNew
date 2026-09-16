# Arquivos Alterados — Bloco 21

## Backend
- `backend/prisma/schema.prisma` — Contém a definição do model `Follow`.
- `backend/src/routes/users.ts` — Rotas `/v1/users/:id/follow`, `followers` e `following`.
- `backend/src/services/social-service.ts` — Lógica de negócios e gerenciamento do ciclo de vida de follow/unfollow.
- `backend/src/services/public-profile-service.ts` — Inclusão de estatísticas sociais no perfil público.
- `backend/tests/social-http.test.ts` — Cobertura de testes HTTP da funcionalidade social.

## Frontend
- `src/components/PublicUserProfile.tsx` — Interface interativa do Perfil Público com suporte a follow/unfollow e modais.
- `src/services/intentApi.ts` — Métodos cliente para requisições de follow e listagem de conexões.
- `src/types.ts` — Tipos compartilhados.
