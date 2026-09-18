# INTENT — Bloco 25C | Validações e Testes

## Resumo dos Resultados
* **Linter TypeScript:** 100% aprovado (`tsc --noEmit` executado sem erros).
* **Build de Produção:** 100% aprovado (`npm run build` gerou artefatos em `dist/` sem falhas).
* **Testes Automatizados de Atividade Pública:** 12/12 testes aprovados em `backend/tests/public-activity.test.ts`.
* **Suíte Unitária Completa do Backend:** 13 arquivos de teste / 251 testes aprovados.

---

## 1. Testes Automatizados Específicos da Etapa 25C
Adicionados no arquivo `backend/tests/public-activity.test.ts`:

1. `filters activity by INTENT_CREATED correctly`
   * Verifica se a rota `/v1/users/:id/activity?type=INTENT_CREATED` retorna apenas eventos de criação de Intent.
   * Valida que consultas às tabelas de apoios, reações e comentários não são disparadas.
2. `filters activity by INTENT_SUPPORTED and INTENT_REALIZED_PARTICIPATION correctly`
   * Verifica a segregação precisa entre apoios em andamento (`INTENT_SUPPORTED`) e acontecimentos já concluídos (`INTENT_REALIZED_PARTICIPATION`).
3. `filters activity by INTENT_REACTED correctly`
   * Valida que eventos de reação retornam com metadados do tipo de reação (`reactionType: 'LOVE' | 'LIKE' | 'CELEBRATE'`).
4. `filters activity by INTENT_COMMENTED correctly`
   * Valida que eventos de comentários trazem o trecho truncado seguro (`commentSnippet`).
5. `returns empty list for filter with no matching events`
   * Valida que um filtro sem correspondência retorna array vazio e `nextCursor: null`.
6. `paginates correctly within a filtered activity stream using cursor`
   * Valida que a paginação com `limit=1` gera `nextCursor` consistente com o evento do filtro ativo e não quebra a ordenação.
7. `rejects invalid activity filter with 400`
   * Valida que valores inválidos (ex.: `?type=INVALID_FILTER`) são rejeitados pelo schema Zod com código HTTP 400.

---

## 2. Comandos de Validação

### No Laboratório (`intentNew`):
```bash
# 1. Validação de tipagem e integridade do código
npm run lint

# 2. Executar testes de atividade pública
npx vitest run backend/tests/public-activity.test.ts

# 3. Compilação de produção
npm run build
```

### No Ambiente Local / VM Oficial:
```bash
# Na branch feat/shareable-links (PR #26):

# 1. Executar testes unitários do backend
npm test -- backend/tests/public-activity.test.ts

# 2. Se houver ambiente PostgreSQL configurado para testes de integração:
npm test

# 3. Verificar tipagem e build do frontend
npm run lint
npm run build
```
