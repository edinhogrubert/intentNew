# Relação de Arquivos Alterados e Criados — Bloco 25B

## 1. Arquivos Modificados no Frontend

### `src/components/EditProfileModal.tsx`
* **Tipo:** Modificado
* **Descrição:** Refatoração completa do modal de edição com:
  - Preview dinâmico do avatar com indicador de loading e fallback de erro.
  - Galeria de 6 avatares predefinidos com URLs seguras.
  - Botão para remoção de foto de perfil (`avatarUrl: null`).
  - Contador de caracteres para a biografia (máx. 500 caracteres).
  - Validações instantâneas de nome (2-120 chars) e formato de URL.
  - Tratamento de acessibilidade (fechamento via `Escape`, botões acessíveis, foco).

### `src/components/PublicUserProfile.tsx`
* **Tipo:** Modificado
* **Descrição:**
  - Adição de `currentUser` e `onCurrentUserUpdated` nas props opcionais do componente.
  - Inclusão do botão "Editar perfil" quando `profile.isMe === true`.
  - Renderização do `EditProfileModal` para o próprio usuário e sincronização do perfil carregado e do usuário autenticado.

### `src/App.tsx`
* **Tipo:** Modificado
* **Descrição:**
  - Passagem de `currentUser={currentUser}` e `onCurrentUserUpdated={setCurrentUser}` para a renderização de `PublicUserProfile` na visualização `'public-profile'`.

---

## 2. Arquivos Criados nos Testes do Backend

### `backend/tests/profile-editing.test.ts`
* **Tipo:** Novo
* **Descrição:**
  - 26 testes automatizados cobrindo `updateProfileSchema`, validações de `displayName`, `bio`, `avatarUrl`, bloqueio estrito de campos protegidos (`id`, `username`, `email`, `firebaseUid`, etc.) e testes de integração HTTP do endpoint `PATCH /v1/users/me`.

---

## 3. Documentação de Handoff

* `docs/ai-handoff/bloco-25b-edicao-perfil.md` (Novo)
* `docs/ai-handoff/block-25b/reports/resumo-implementacao.md` (Novo)
* `docs/ai-handoff/block-25b/reports/validacoes.md` (Novo)
* `docs/ai-handoff/block-25b/diff/arquivos-alterados.md` (Novo)
