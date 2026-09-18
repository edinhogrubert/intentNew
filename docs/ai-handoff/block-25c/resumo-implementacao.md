# INTENT — Bloco 25C | Resumo da Implementação

## Identificação
* **Etapa:** 25C — Filtros da Atividade Pública
* **Ambiente de Origem:** `intentNew` (Laboratório)
* **Repositório Oficial:** `edinhogrubert/Intent`
* **Branch Oficial Temporária:** `feat/shareable-links` (PR #26)
* **Status do Bloco 25:** Com a conclusão de 25C, as três etapas planejadas (25A + 25B + 25C) estão finalizadas e prontas para entrega unificada na branch `main`.

---

## 1. Objetivo da Etapa 25C
Permitir aos usuários filtrar os eventos na linha do tempo de atividade pública de qualquer perfil (na visualização `PublicUserProfile` e links canônicos `?user=<id>`), sem perder:
1. A ordenação cronológica decrescente rigorosa (`occurredAt DESC, id DESC`).
2. A consistência da paginação por cursor (`nextCursor`).
3. O isolamento de dados entre filtros (não misturar cursores de tipos distintos).
4. As regras de visibilidade pública e privacidade existentes (Intents apenas `PUBLIC`, `PUBLISHED` ou `REALIZED`, de criadores `ACTIVE`).
5. A integridade das etapas 25A (links compartilháveis) e 25B (edição de perfil social).

---

## 2. Decisões Arquiteturais e Técnicas

### Backend (`backend/src/services/public-activity-service.ts` e `backend/src/routes/users.ts`)
* **Parâmetro `type` Seguro e Opcional:**
  * O endpoint `GET /v1/users/:id/activity` agora aceita o parâmetro opcional `type`.
  * Valores aceitos: `'ALL' | 'INTENT_CREATED' | 'INTENT_SUPPORTED' | 'INTENT_REACTED' | 'INTENT_COMMENTED' | 'INTENT_REALIZED_PARTICIPATION'`.
  * Valor padrão: `'ALL'` (retrocompatibilidade 100% garantida com chamadas legadas).
* **Otimização de Consultas de Banco:**
  * Quando um filtro específico é passado (ex: `INTENT_CREATED`), o serviço evita consultas desnecessárias às outras tabelas (`support`, `intentReaction`, `intentComment`).
  * Apoios (`INTENT_SUPPORTED`) filtram Intents em andamento (`status: 'PUBLISHED'`), enquanto realizações (`INTENT_REALIZED_PARTICIPATION`) filtram apenas Intents concluídas (`status: 'REALIZED'`).
* **Coerência da Paginação por Cursor:**
  * O cursor continua sendo codificado em Base64URL no formato `${occurredAt}|${id}`.
  * Como a consulta filtrada busca apenas itens correspondentes ao tipo selecionado, o `nextCursor` retornado pelo backend aponta deterministicamente para o último evento do filtro ativo.
  * Validação com Zod rejeita filtros inválidos com status HTTP `400 Bad Request`.

### Frontend API Client (`src/services/intentApi.ts`)
* Exportado o tipo `PublicActivityFilter`.
* Função `listUserPublicActivity(userId, cursor, limit, type)` inclui o parâmetro `type` na query string apenas quando especificado e diferente de `'ALL'`.

### Interface do Usuário (`src/components/PublicUserActivity.tsx`)
* **Barra de Filtros Visuais (`role="tablist"`):**
  * Chips táteis responsivos com ícones semânticos (`Layers`, `Sparkles`, `CheckCircle2`, `Heart`, `ThumbsUp`, `MessageSquare`).
  * Rótulos adaptativos (com versão curta para telas móveis compactas).
  * Altura mínima de 44px (`min-h-[44px]`) atendendo às diretrizes de acessibilidade e alvos de toque em dispositivos móveis.
  * Estilo ativo de alto contraste em azul profundo institucional (`#000666`), com sombra sutil e contraste WCAG AA.
* **Ciclo de Troca de Filtro Resiliente (Anti-Race Condition):**
  * Ao trocar o filtro, a lista anterior é zerada, o `nextCursor` é resetado e o estado de carregamento é exibido.
  * O uso de `requestIdRef` garante que respostas atrasadas de requisições anteriores descartadas nunca sobrescrevam a seleção ativa.
* **Estados Vazios Contextuais:**
  * Mensagens e ícones personalizados para cada filtro quando não houver registros.
  * Botão de ação rápida "Ver todos os eventos" para redefinir a visualização com um clique.
* **Paginação por Filtro:**
  * O botão "Carregar mais atividades" preserva o filtro ativo, passando-o junto ao `nextCursor`.
