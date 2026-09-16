# Relatório de Validações — Bloco 23: Feed de Seguidos

## Suíte de Testes Automatizados

### Backend (Vitest)
Executado em: `backend/tests/`
Resultado: **10 test suites passadas / 200 testes aprovados**

#### Casos de Teste Validados:
1. `feed all e public mantêm comportamento atual`: Validação de requisição anônima e autenticada para `GET /v1/intents/feed?scope=all` e `GET /v1/intents/feed?scope=public`.
2. `feed following exige autenticação`: Retorno `401 AUTH_REQUIRED` para chamadas sem token ou com token inválido.
3. `feed following retorna Intents de usuários seguidos`: Confirmação de que apenas Intents de criadores seguidos com `status: 'ACTIVE'` são retornadas.
4. `feed following não retorna Intents privadas`: Apenas visibilidades públicas ou para seguidores são selecionadas, preservando o cofre e revelações privadas.
5. `feed following retorna vazio quando não segue ninguém`: Retorno `{ data: { items: [], nextCursor: null } }` com status `200`.
6. `feed following preserva campos sociais do card`: Retorna título, história, criador, status, contadores de apoio, metas e reações.
7. `feed following não expõe dados sensíveis`: Nenhum campo confidencial (`email`, `firebaseUid`, `passwordHash`, `revealCiphertext`, `revealIv`, `revealAuthTag`) é entregue.
8. `feed following respeita paginação`: Paginação com cursor (`nextCursor`) e limites são preservados com ordenação decrescente por `createdAt`.

### Tipagem e Linters
- `npm run lint` (`tsc --noEmit`): 0 erros.
- `npm run build` (`npx prisma generate && vite build && esbuild server.ts`): Sucesso total na compilação.
