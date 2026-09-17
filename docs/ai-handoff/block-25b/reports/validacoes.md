# Relatório de Validações — Bloco 25B (Edição do Perfil Social)

## 1. Testes Automatizados

### 1.1. Suíte de Testes Dedicada (`backend/tests/profile-editing.test.ts`)
Execução do comando:
```bash
npx vitest run backend/tests/profile-editing.test.ts
```

Resultados:
- **26 de 26 testes aprovados** (100% de sucesso).
- **Cenários Cobertos:**
  1. Validação com sucesso de payload completo de edição (`displayName`, `bio`, `avatarUrl`).
  2. Atualização isolada de apenas o nome de exibição.
  3. Atualização isolada de apenas a bio.
  4. Limpeza da bio passando `null`.
  5. Atualização isolada de apenas o avatar.
  6. Limpeza do avatar passando `null`.
  7. Aplicação automática de `trim()` em nome e bio.
  8. Rejeição de nomes com menos de 2 caracteres ou compostos apenas por espaços.
  9. Rejeição de nomes com mais de 120 caracteres.
  10. Rejeição de bio com mais de 500 caracteres.
  11. Rejeição de URLs inválidas ou malformadas.
  12. Rejeição de payload vazio (`{}`).
  13. Rejeição de alteração de campos protegidos: `id`, `username`, `email`, `firebaseUid`, `status`, `role`, `passwordHash`, `tokens`, `createdAt`, `updatedAt`.
  14. Endpoint HTTP `PATCH /v1/users/me`: Retorno 401 para requisições não autenticadas.
  15. Endpoint HTTP `PATCH /v1/users/me`: Sucesso e persistência para requisições autenticadas.
  16. Endpoint HTTP `PATCH /v1/users/me`: Não exposição de campos sensíveis/privados na resposta pública.
  17. Endpoint HTTP `PATCH /v1/users/me`: Retorno 400 com código `VALIDATION_ERROR` para payloads inválidos.

### 1.2. Regressão do Backend Completo
Execução do comando:
```bash
npx vitest run backend/tests
```
- **13 suítes aprovadas, 243 testes executados e aprovados.**
- Sem regressões em nenhum módulo social ou de regras de negócio existentes.

### 1.3. Validação de Tipagem e Build
Execução do comando de lint e compilação:
- `lint_applet` (`tsc --noEmit`): **0 erros de tipagem**.
- `compile_applet` (`vite build` & `esbuild`): **Build bem-sucedido**.

## 2. Validação Funcional e de Interface

1. **Abertura do Modal de Edição:**
   - Testado a partir de `MvpSocialProfile` (perfil logado) clicando no botão "Editar".
   - Testado a partir de `PublicUserProfile` quando `profile.isMe === true`.
2. **Edição do Nome:**
   - Nomes com 2 a 120 caracteres salvos corretamente.
   - Nomes menores que 2 caracteres impedem o envio e mostram aviso em tempo real.
3. **Edição da Bio:**
   - Contador dinâmico atualiza a cada digitação ("X/500").
   - Limite de 500 caracteres respeitado.
4. **Edição e Preview do Avatar:**
   - Pré-visualização atualiza instantaneamente ao digitar a URL ou selecionar um preset.
   - URLs inválidas mostram aviso e impedem submissão.
   - Opção "Remover foto" limpa a imagem e exibe as iniciais do usuário.
5. **Sincronização de Estado:**
   - Ao salvar, o cabeçalho superior (avatar e nome do usuário logado) e a página de perfil são atualizados imediatamente.
   - Links compartilháveis gerados na 25A permanecem íntegros e funcionais.
