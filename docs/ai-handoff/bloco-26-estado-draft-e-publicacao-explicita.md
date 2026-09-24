# Bloco 26 — Estado DRAFT e Publicação Explícita de Intent

## 1. Visão Geral e Motivação Arquitetural

Historicamente, toda Intent nascia com o status `PUBLISHED`. Isso permitia registrar a criação (`INTENT_CREATED`) e a realização (`INTENT_REALIZED`), mas impossibilitava modelar formalmente o ciclo de preparação, revisão e publicação consciente de uma intenção.

Para resolver a tensão entre **integridade de proveniência** e **fricção de usuário**, adotou-se a estratégia:
- **Fluxo padrão de 1 clique preservado**: Ao criar pelo fluxo direto, a Intent já nasce `PUBLISHED` (`INTENT_CREATED` com `status: PUBLISHED` e `publishedAt` populado).
- **Opção explícita de Rascunho (`DRAFT`)**: Usuários podem optar por "Salvar como rascunho" no wizard.
- **Publicação Explícita**: Endpoint dedicado e idempotente `POST /v1/intents/:id/publish` para transicionar de `DRAFT` para `PUBLISHED`, registrando o evento de domínio `INTENT_PUBLISHED`.
- **Isolamento e Segurança Estrita**: Rascunhos nunca vazam em feeds, buscas ou perfis públicos e bloqueiam apoios, comentários, reações e acompanhamento.

---

## 2. Mudanças no Banco de Dados e Schema Prisma

### 2.1 Prisma Schema (`backend/prisma/schema.prisma`)
- Adição do campo `publishedAt DateTime?` no modelo `Intent`.
- Atualização da documentação do enum implícito de status para incluir `DRAFT`.

### 2.2 Migrações SQL (`backend/prisma/migrations/20260924000100_allow_draft_intents/migration.sql`)
- Adição da coluna `published_at TIMESTAMPTZ`.
- Backfill seguro para intents existentes (`UPDATE intents SET published_at = created_at WHERE status IN ('PUBLISHED', 'REALIZED');`).
- Atualização da constraint de integridade de status:
```sql
ALTER TABLE "intents" DROP CONSTRAINT IF EXISTS "intents_status_check";
ALTER TABLE "intents" ADD CONSTRAINT "intents_status_check" CHECK ("status" IN ('DRAFT', 'PUBLISHED', 'REALIZED', 'EXPIRED'));
```

---

## 3. Contratos de API e Endpoints

### 3.1 `POST /v1/intents`
Cria uma nova Intent.
- **Input (Zod)**: aceita opcionalmente `status: 'DRAFT' | 'PUBLISHED'` (default: `'PUBLISHED'`).
- **Se `DRAFT`**:
  - Salva com `status: 'DRAFT'` e `publishedAt: null`.
  - Registra evento de domínio `INTENT_CREATED` com payload `{ status: 'DRAFT' }`.
- **Se `PUBLISHED`**:
  - Salva com `status: 'PUBLISHED'` e `publishedAt: new Date()`.
  - Registra evento de domínio `INTENT_CREATED` com payload `{ status: 'PUBLISHED' }`.

### 3.2 `POST /v1/intents/:id/publish`
Publica uma Intent salva anteriormente como `DRAFT`.
- **Autenticação**: Obrigatória (`Bearer token`).
- **Autorização**: Apenas o criador da Intent pode publicá-la (HTTP 403 / 404 se não autorizado).
- **Validação de Estado**:
  - Se `status === 'DRAFT'`: transiciona para `PUBLISHED`, seta `publishedAt: new Date()`, e grava o evento de domínio `INTENT_PUBLISHED`.
  - **Idempotência de Estado**: Se a Intent já estiver `PUBLISHED`, retorna `200 OK` com os dados atuais sem erro e sem duplicar eventos.
  - Se a Intent estiver em outro estado incompatível (`REALIZED`, `EXPIRED`), retorna `HTTP 409 CONFLICT` (`INTENT_CANNOT_BE_PUBLISHED`).

---

## 4. Regras de Isolamento e Acesso

1. **Visibilidade de Rascunhos**:
   - `assertIntentViewAccess` (`intent-service.ts`): Lança `HTTP 404 INTENT_NOT_FOUND` se qualquer usuário que não seja o próprio criador tentar acessar ou buscar uma Intent em `DRAFT`.
2. **Bloqueio de Apoio**:
   - `support-service.ts`: Bloqueia tentativas de apoiar Intent em `DRAFT` com `HTTP 409 INTENT_NOT_OPEN`.
3. **Bloqueio de Comentários**:
   - `comment-service.ts`: Bloqueia comentários em Intent em `DRAFT` com `HTTP 400 INTENT_NOT_PUBLISHED`.
4. **Bloqueio de Reações**:
   - `reaction-service.ts`: Bloqueia reações em Intent em `DRAFT` com `HTTP 400 INTENT_NOT_PUBLISHED`.
5. **Bloqueio de Acompanhamento (Watch)**:
   - `intent-watch-service.ts`: Bloqueia acompanhamento em Intent em `DRAFT` com `HTTP 400 INTENT_NOT_PUBLISHED`.

---

## 5. Frontend & Experiência de Usuário

1. **`src/services/intentApi.ts`**:
   - Adicionado `status?: 'DRAFT' | 'PUBLISHED'` em `CreateSupportIntentInput`.
   - Adicionada função utilitária `publishIntent(intentId, idempotencyKey)`.
2. **`CreationWizard.tsx`**:
   - Passo 3 exibe o botão `"Salvar como rascunho"` ao lado de `"Publicar Intent"`.
   - Feedback de conclusão adaptado informando claramente se a Intent foi publicada ou mantida em rascunho privado.
3. **`MvpIntentDetail.tsx`**:
   - Tag de status de destaque (`Rascunho`).
   - Banner contextual informativo no topo para o proprietário: `"Rascunho Privado — Esta Intent está salva como rascunho e só você pode vê-la."`.
   - Botão interativo `"Publicar Intent"` que executa a transição em tempo real e atualiza o histórico e os controles da página.

---

## 6. Cobertura de Testes Automatizados

- Arquivo dedicado: `backend/tests/draft-and-publish.test.ts` (14 testes unitários e de integração HTTP).
- Validações testadas:
  - Criação direta como `PUBLISHED` (default).
  - Criação como `DRAFT`.
  - Tentativa de acesso a `DRAFT` por terceiros (retorna 404).
  - Acesso do criador a `DRAFT` (retorna 200).
  - Publicação de `DRAFT` pelo criador (emite `INTENT_PUBLISHED` e transiciona).
  - Idempotência de publicação subsequente.
  - Bloqueio de publicação por não criador (403/404).
  - Bloqueio de comentários em `DRAFT` (400).
  - Bloqueio de reações em `DRAFT` (400).
  - Bloqueio de acompanhamento em `DRAFT` (400).
  - Bloqueio de apoio em `DRAFT` (409).
- **Status da Suíte Completa**: 265 de 265 testes passando (`14 passed`).
