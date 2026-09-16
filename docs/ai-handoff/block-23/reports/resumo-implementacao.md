# Resumo da Implementação — Bloco 23: Feed de Seguidos

## Contexto e Objetivos
O Bloco 23 implementa e consolida o feed de seguidos para reforçar a proposta de valor do Intent: acompanhar pessoas, acontecimentos reais e ver o que a rede do usuário está fazendo acontecer, sem poluir a experiência com algoritmos de recomendação ou timelines artificiais.

## Modificações Realizadas

### 1. Backend
- **Rotas (`backend/src/routes/intents.ts`):**
  - O esquema do query parameter `feedQuerySchema` foi atualizado para aceitar `scope=all`, `scope=public` e `scope=following`.
  - Tratamento de autenticação obrigatória para `scope=following`, lançando `AUTH_REQUIRED` (401) com mensagem amigável.
- **Serviços (`backend/src/services/intent-service.ts`):**
  - Consulta `listFollowingFeed` filtra criadores com vínculo ativo em `Follow` onde `followerId = viewerId`.
  - Projeção segura de dados via `publicIntentSelection` garantindo que dados sensíveis nunca sejam transmitidos.

### 2. Frontend
- **Serviço de API (`src/services/intentApi.ts`):**
  - Tipagem `FeedScope` atualizada para `'public' | 'following' | 'all'`.
  - Função `listPublicIntents` normaliza escopo e realiza chamadas para `/v1/intents/feed`.
- **Componente de Feed (`src/components/MvpHomeFeed.tsx`):**
  - Abas estilizadas `[Todos] [Seguindo]`.
  - Tratamento de estado vazio para rede sem publicações:
    - *"Você ainda não tem acontecimentos de pessoas que segue."*
    - *"Siga perfis para acompanhar o que eles estão fazendo acontecer."*
    - Botão *"Ver todos os acontecimentos"*.
  - Tratamento de erro contextualizado com mensagem para a rede.
  - Preservação total de cards, ações de apoio, reações, contadores e navegação para perfis.
