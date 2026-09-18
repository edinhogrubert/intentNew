# INTENT — Bloco 25C | Filtros da Atividade Pública

## Identificação e Referência
* **Etapa:** 25C (Filtros da Atividade Pública)
* **Ambiente de Origem:** `intentNew` (Laboratório)
* **Referência Oficial de Integração:** `edinhogrubert/Intent` | PR: `#26` | Branch: `feat/shareable-links`
* **Status do Bloco 25:** Bloco 25 Completo (25A + 25B + 25C). Pronto para consolidação final e entrega na branch `main`.

---

## 1. Visão Geral da Entrega
A Etapa 25C adiciona a capacidade de filtrar eventos da linha do tempo de atividade pública no perfil de qualquer usuário (`PublicUserProfile` e URLs canônicas compartilhadas `?user=<user_uuid>`), preservando estritamente:
- **Ordenação cronológica global:** Eventos ordenados por `occurredAt DESC, id DESC`.
- **Paginação por cursor independente:** Cada filtro possui seu fluxo de paginação coerente, sem contaminação entre filtros.
- **Isolamento e Segurança:** Aplicação inegociável do escopo de visibilidade pública (apenas Intents `PUBLIC`, `PUBLISHED`/`REALIZED` e criadores `ACTIVE`).
- **Compatibilidade:** Zero quebras nos fluxos já integrados das etapas 25A e 25B.

### Categorias de Filtro Suportadas:
1. **Todos os eventos (`ALL`):** Linha do tempo unificada com todas as ações públicas.
2. **Intents criadas (`INTENT_CREATED`):** Acontecimentos propostos pelo usuário.
3. **Intents realizadas (`INTENT_REALIZED_PARTICIPATION`):** Participações em acontecimentos concluídos com sucesso.
4. **Apoios (`INTENT_SUPPORTED`):** Apoios manifestados a acontecimentos em andamento.
5. **Reações (`INTENT_REACTED`):** Reações públicas (Amou, Celebrou, etc.).
6. **Comentários (`INTENT_COMMENTED`):** Comentários e reflexões públicas registradas.

---

## 2. Relação dos Arquivos Modificados (5 Arquivos)

1. **`backend/src/services/public-activity-service.ts`** (Modificado):
   - Adiciona tipo `PublicActivityFilter` (`'ALL' | PublicActivityType`).
   - Adiciona parâmetro opcional `filterType: PublicActivityFilter = 'ALL'` à função `listUserPublicActivity`.
   - Implementa busca otimizada sob demanda (evita consultas a tabelas irrelevantes para o filtro selecionado).
   - Filtra eventos mapeados garantindo integridade estrita do tipo selecionado.

2. **`backend/src/routes/users.ts`** (Modificado):
   - Atualiza `activityQuerySchema` com validação Zod para o parâmetro `type`.
   - Passa `query.type` para o serviço na rota `GET /:id/activity`.

3. **`src/services/intentApi.ts`** (Modificado):
   - Exporta o tipo `PublicActivityFilter`.
   - Atualiza `listUserPublicActivity` para aceitar `type?: PublicActivityFilter` e montar o query string.

4. **`src/components/PublicUserActivity.tsx`** (Modificado):
   - Barra de filtros visual (`role="tablist"`) com altura mínima de 44px para acessibilidade móvel.
   - Estado reativo com proteção contra race conditions (`requestIdRef`).
   - Estados vazios contextuais para cada filtro com botão de retorno ("Ver todos os eventos").
   - Paginação via "Carregar mais atividades" preservando o filtro ativo.

5. **`backend/tests/public-activity.test.ts`** (Modificado):
   - 8 novos testes automatizados cobrindo todos os filtros, paginação coerente por cursor em filtros ativos e validação de parâmetros inválidos com 400.

---

## 3. Instruções Críticas para o Codex / Aplicação na VM

* **Branch de Trabalho:** Continuar na branch oficial temporária `feat/shareable-links` (PR #26).
* **Edição Cirúrgica:** Incorporar as modificações pontuais nos 5 arquivos sem sobrescrever implementações alheias.
* **Sem Migrações de Banco:** Nenhuma nova migration do Prisma foi introduzida; a estrutura do banco permanece inalterada.
* **Validação:** Rodar `npx vitest run backend/tests/public-activity.test.ts` e `npm run build` para certificar que todos os 12 testes de atividade passam e a aplicação compila 100% verde.
