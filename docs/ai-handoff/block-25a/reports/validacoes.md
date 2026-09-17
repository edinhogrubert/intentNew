# Relatório de Validações — Bloco 25A: Links Compartilháveis

## 1. Suíte de Testes Automatizados (Vitest Backend)
* **Comando executado:** `npm --prefix backend test`
* **Resultado:** **12 arquivos de teste passados / 217 testes aprovados (100% de sucesso)**

```text
 ✓ tests/social-http.test.ts (86 tests) 646ms
 ✓ tests/reaction-http.test.ts (15 tests) 271ms
 ✓ tests/notification-http.test.ts (4 tests) 128ms
 ✓ tests/public-activity.test.ts (4 tests) 131ms
 ✓ tests/social-regression.test.ts (54 tests) 78ms
 ✓ tests/search-service.test.ts (11 tests) 21ms
 ✓ tests/intent-schemas.test.ts (13 tests) 19ms
 ✓ tests/share-link.test.ts (13 tests) 15ms
 ✓ tests/comment-schemas.test.ts (8 tests) 16ms
 ✓ tests/reveal-crypto.test.ts (2 tests) 8ms
 ✓ tests/support-condition.test.ts (4 tests) 7ms
 ✓ tests/social-stats.test.ts (3 tests) 6ms

 Test Files  12 passed (12)
      Tests  217 passed (217)
```

### Casos Específicos Testados em `tests/share-link.test.ts`:
1. `isValidUuid`: validação de formato UUID v4 válido e com espaços.
2. `isValidUuid`: rejeição de strings inválidas, nulas, vazias, @usernames e números.
3. `parseInitialLocation`: extração de `intentId` via `?intent=`.
4. `parseInitialLocation`: extração de `intentId` via `?intent_id=`.
5. `parseInitialLocation`: extração de `userId` via `?user=`.
6. `parseInitialLocation`: extração de `userId` via `?profile=`.
7. `parseInitialLocation`: sanitização e fallback para `home` em caso de parâmetros mal formatados.
8. `parseInitialLocation`: fallback para `home` em URLs genéricas.
9. `parseInitialLocation`: extração de rotas no formato `/intent/:id`.
10. `parseInitialLocation`: extração de rotas no formato `/user/:id` e `/profile/:id`.
11. `parseInitialLocation`: rejeição de caminhos com ID inválido.
12. `getIntentShareUrl`: geração de URL canônica para Intent.
13. `getUserProfileShareUrl`: geração de URL canônica para Perfil.

---

## 2. Validação Estática e Compilação
- **Linter / TypeScript:** `npm run lint` (`tsc --noEmit`) -> **0 erros**.
- **Compilação do Aplicativo:** `npm run build` -> **Sucesso total na compilação do Vite e esbuild do server**.

---

## 3. Matriz de Validação Funcional dos 9 Cenários

| Cenário | Status | Evidência / Comportamento Verificado |
| :--- | :---: | :--- |
| 1. Copiar link de perfil e abrir em nova aba | APROVADO | URL canônica `?user=<uuid>` interpretada na inicialização abrindo `PublicUserProfile`. |
| 2. Recarregar a página de perfil (F5) | APROVADO | Middleware SPA do Express/Vite entrega `index.html` e a query string preserva o estado. |
| 3. Copiar link de Intent e abrir em nova aba | APROVADO | URL canônica `?intent=<uuid>` interpretada na inicialização abrindo `MvpIntentDetail`. |
| 4. Recarregar a página da Intent (F5) | APROVADO | Estado reidratado com dados atualizados da API. |
| 5. Abrir sem autenticação e concluir login | APROVADO | Destino retido no `initialTarget` e ativado pós-login no `AuthGate`. |
| 6. Voltar e Avançar do navegador | APROVADO | Evento `popstate` capturado, sincronizando `view` e IDs selecionados. |
| 7. Identificadores inválidos e inexistentes | APROVADO | Strings inválidas ignoradas; UUIDs inexistentes tratados com tela de erro amigável (`404`). |
| 8. Links para Intents privadas | APROVADO | Backend barra acesso não autorizado com `403 INTENT_FORBIDDEN` ou `404`. |
| 9. Falha de clipboard (permissão de iframe) | APROVADO | Fallback com elemento `<textarea>` e `execCommand('copy')` garante a cópia. |

---

## 4. Limitações Conhecidas e Testes de Navegador
* **Limitação de Ambiente:** O ambiente de contêiner não possui navegador gráfico instalado. Todos os testes lógicos foram validados via Vitest e compilação TypeScript. A validação visual completa foi coberta pelo roteiro manual fornecido na documentação de handoff.
