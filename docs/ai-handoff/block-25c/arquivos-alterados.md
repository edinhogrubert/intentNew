# INTENT — Bloco 25C | Arquivos Alterados e Instruções para o Codex

## Relação Exata dos Arquivos Modificados (5 Arquivos)

| Arquivo | Camada | Tipo de Modificação | Descrição |
| :--- | :--- | :--- | :--- |
| `backend/src/services/public-activity-service.ts` | Backend Service | Modificado | Suporte ao tipo de filtro `PublicActivityFilter`, otimização de consultas por categoria e garantia de ordenação e cursor. |
| `backend/src/routes/users.ts` | Backend Route | Modificado | Inclusão e validação do parâmetro `type` no schema `activityQuerySchema` e repasse para `listUserPublicActivity`. |
| `src/services/intentApi.ts` | Frontend Service | Modificado | Exportação do tipo `PublicActivityFilter` e inclusão do parâmetro `type` na query string da requisição. |
| `src/components/PublicUserActivity.tsx` | Frontend Component | Modificado | Barra visual de filtros (`role="tablist"`), gerenciamento de estados, debounce/cancelamento de requisições obsoletas, estados vazios contextuais e paginação filtrada. |
| `backend/tests/public-activity.test.ts` | Backend Test | Modificado | Adição de 8 cenários de teste automatizados cobrindo todos os filtros, paginação por cursor em streams filtrados e validação de schema. |

---

## Instruções Críticas para Aplicação no Ambiente da VM / Repositório Oficial

1. **Branch Alvo:**
   * Aplicar na branch de trabalho do Bloco 25: `feat/shareable-links` (PR oficial #26).
   * **NÃO** aplicar diretamente na branch `main`.

2. **Aplicação Cirúrgica (Sem Sobrescrever Arquivos Inteiros Cego):**
   * Em `backend/src/services/public-activity-service.ts`:
     * Importar/definir `PublicActivityFilter = 'ALL' | PublicActivityType`.
     * Adicionar o parâmetro opcional `filterType: PublicActivityFilter = 'ALL'` na assinatura de `listUserPublicActivity`.
     * Empregar o carregamento condicional dos dados com `shouldFetchIntents`, `shouldFetchSupports`, `shouldFetchReactions` e `shouldFetchComments`.
   * Em `backend/src/routes/users.ts`:
     * Adicionar `type: activityFilterSchema.optional().default('ALL')` em `activityQuerySchema`.
     * Repassar `query.type` para a chamada do serviço na rota `GET /:id/activity`.
   * Em `src/services/intentApi.ts`:
     * Adicionar `type?: PublicActivityFilter` em `listUserPublicActivity` e incluir `?type=...` na requisição quando diferente de `'ALL'`.
   * Em `src/components/PublicUserActivity.tsx`:
     * Manter todas as conexões existentes de `displayName`, `userId` e `onSelectIntent`.
     * Integrar a barra de navegação de filtros e os estados vazios contextuais.

3. **Compatibilidade e Migrations:**
   * Nenhuma alteração no Prisma Schema (`schema.prisma`) ou novas migrações SQL foram necessárias.
   * Total compatibilidade retroativa: chamadas sem o parâmetro `type` continuam recebendo `'ALL'` e o mesmo payload anterior.

4. **Fechamento do Bloco 25:**
   * Com a validação das três etapas (25A - Links Compartilháveis, 25B - Edição de Perfil Social, 25C - Filtros da Atividade Pública), o Bloco 25 atinge 100% de cobertura de escopo funcional e está pronto para revisão e merge consolidado no repositório oficial.
