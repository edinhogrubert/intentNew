# Relatório de Validações — Bloco 21

## Testes Automatizados (Vitest)
- Suíte do Backend: `cd backend && npm test`
- Resultado: 10 arquivos passados, 198 testes passados.
- Testes específicos do Bloco 21 em `backend/tests/social-http.test.ts`: 84 testes validados.

### Cobertura de Testes para Follow:
- Seguir usuário com sucesso.
- Idempotência ao seguir 2x consecutivas.
- Deixar de seguir com sucesso.
- Idempotência ao deixar de seguir 2x consecutivas.
- Bloqueio de auto-follow (`SELF_FOLLOW_NOT_ALLOWED`).
- Retorno de 404 para usuários inexistentes ou suspensos.
- Verificação do envio de notificação `FOLLOW_RECEIVED`.
- Proteção de privacidade (não exibição de `email` ou `firebaseUid`).

## Compilação e Linter
- `compile_applet`: Compilação efetuada com sucesso sem erros TypeScript.
- `lint_applet`: `npm run lint` concluído com código 0.
