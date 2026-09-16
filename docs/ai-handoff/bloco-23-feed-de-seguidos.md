# Handoff: Bloco 23 — Feed de Seguidos

## Resumo Executivo
Implementação e consolidação do **Feed de Seguidos** para a rede social de acontecimentos Intent, permitindo alternar de maneira clara e fluida entre o feed global de acontecimentos públicos (**Todos**) e o feed das pessoas que o usuário acompanha (**Seguindo**).

---

## 1. Inspeção Obrigatória
- **Endpoint atual do feed:** `GET /v1/intents/feed?scope=public` e `GET /v1/intents/feed?scope=following` (com suporte retrocompatível a `scope=all`).
- **Filtro de seguidos já existia:** SIM, implementado na camada de serviço `listFollowingFeed` e roteado em `/feed`.
- **Alteração em Prisma necessária:** NÃO.
- **Migration criada:** NÃO. A tabela `follows` (`Follow`) e os índices existentes foram 100% reaproveitados.
- **Estrutura de visibilidade:** O feed de seguidos retorna exclusivamente Intents públicas/de seguidores de criadores ativos seguidos pelo usuário autenticado, nunca expondo Intents privadas nem dados sensíveis.

---

## 2. Contrato da API
```http
GET /v1/intents/feed?scope=all&cursor={uuid}&limit={number}
GET /v1/intents/feed?scope=public&cursor={uuid}&limit={number}
GET /v1/intents/feed?scope=following&cursor={uuid}&limit={number}
```

### Regras de Negócio e Segurança:
1. `scope=all` ou `scope=public`:
   - Mantém comportamento público existente.
   - Permite leitura anônima ou autenticada.
   - Retorna apenas Intents públicas de criadores ativos.
2. `scope=following`:
   - Exige usuário autenticado (`AUTH_REQUIRED` 401 se ausente ou inválido).
   - Retorna apenas Intents públicas/para seguidores de criadores que o visualizador segue (`Follow.followerId = viewer.id`).
   - Se o usuário não segue ninguém ou se nenhum seguido publicou Intents, retorna `{ items: [], nextCursor: null }` com HTTP 200.
   - Preserva projeção social segura (`publicIntentSelection`), omitindo segredos e credenciais (`email`, `firebaseUid`, `passwordHash`, `revealCiphertext`, `revealIv`, `revealAuthTag`).
   - Paginação baseada em cursor preservada.

---

## 3. Frontend (UI/UX)
- **Alternância de Feed na Home (`MvpHomeFeed.tsx`):**
  - Seletor de abas: `[Todos] [Seguindo]`.
  - Aba "Todos" selecionada por padrão ao abrir a home.
  - Ao clicar em "Seguindo", busca os acontecimentos de pessoas seguidas via `listPublicIntents('following')`.
  - Exibe indicador de loading durante a alternância.
  - Estado vazio contextualizado:
    - Título: *"Você ainda não tem acontecimentos de pessoas que segue."*
    - Descrição: *"Siga perfis para acompanhar o que eles estão fazendo acontecer."*
    - Botão de ação: *"Ver todos os acontecimentos"* (alterna diretamente para a aba Todos).
  - Estado de erro com mensagem amigável: *"Não foi possível carregar os acontecimentos da sua rede agora."*
  - Todos os cards mantêm suporte a reações, apoios coletivos, metas e cliques para abrir o Intent ou o perfil social do criador.

---

## 4. Testes e Validações
- 10 suítes de testes unitários e de integração HTTP executadas com Vitest.
- 200 testes passando com 100% de sucesso.
- `tsc --noEmit` (lint) executado sem erros.
- Build de produção validado com `npm run build`.
