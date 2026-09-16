Estado: IMPLEMENTADO NO LABORATÓRIO
Ambiente trabalhado: intentNew
Base analisada: mvp-1.0.19 / Bloco 20
Bloco: 21 — Seguir Usuários / Rede Social Inicial
Implementação de produto realizada: SIM
Frontend alterado: SIM
Backend alterado: SIM
Backend read-only alterado: NÃO
Prisma alterado: NÃO
Migration criada: NÃO
Mock alterado: NÃO
Contrato da API alterado: SIM
PostgreSQL real detectado: SIM
Cloud SQL detectado: SIM
Banco usado para validação: Cloud SQL (PostgreSQL) / Vitest Test Environment
Migrations executadas: N/A (Estrutura de `follows` já existia no banco)
Comandos destrutivos executados: NENHUM
Estrutura follows já existia: SIM
Arquivos criados:
- docs/ai-handoff/bloco-21-seguir-usuarios.md
- docs/ai-handoff/block-21/reports/resumo-implementacao.md
- docs/ai-handoff/block-21/reports/validacoes.md
- docs/ai-handoff/block-21/diff/arquivos-alterados.md
Arquivos alterados:
- backend/prisma/schema.prisma
- backend/src/routes/users.ts
- backend/src/services/social-service.ts
- backend/src/services/public-profile-service.ts
- src/components/PublicUserProfile.tsx
- src/services/intentApi.ts
- backend/tests/social-http.test.ts
Rotas criadas/alteradas:
- POST /v1/users/:id/follow
- DELETE /v1/users/:id/follow
- GET /v1/users/:id/followers
- GET /v1/users/:id/following
- GET /v1/users/:id/profile
Serviços criados/alterados:
- backend/src/services/social-service.ts
- backend/src/services/public-profile-service.ts
Componentes alterados:
- src/components/PublicUserProfile.tsx
Dados públicos usados:
- username, displayName, bio, avatarUrl, createdAt, stats (followersCount, followingCount, publicIntentsCount)
Dados sensíveis protegidos:
- email, firebaseUid, passwordHash estritamente omitidos do payload público.
Funcionalidades implementadas:
- Ação social de Seguir / Deixar de seguir no perfil público.
- Atualização otimista e idempotência das ações de follow/unfollow.
- Exibição dos contadores de seguidores e seguindo.
- Modal para visualização das listas de seguidores e seguindo.
- Emissão de notificação `FOLLOW_RECEIVED` com chave de desduplicação.
- Bloqueio de auto-follow e respostas controladas para usuários inexistentes ou suspensos.
Testes executados:
- `cd backend && npm test` (198 testes passando em 10 suítes)
Validação visual:
- Verificada compilação TypeScript e dev server ativo.
Pendências:
- Nenhuma pendência no Bloco 21.
Riscos:
- Baixo. Não altera estrutura existente de Intents, reações ou comentários.
Recomendação para integração oficial:
- Pronto para revisão e integração no repositório principal.
Veredito: APROVADO PARA INTEGRAÇÃO OFICIAL
