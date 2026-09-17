# INTENT — Bloco 25B | Edição Completa do Perfil Social

## Identificação e Referência
* **Etapa:** 25B (Edição Completa do Perfil Social)
* **Ambiente de Origem:** `intentNew`
* **Referência Oficial de Integração:** `edinhogrubert/Intent` | Branch: `main` | Release: `mvp-1.0.23` | Commit: `4cbdc3ad5b3b6e5e699123f7e0389f98c4f4da6f`
* **Contexto de Integração:** Segue a etapa 25A (Links Compartilháveis - PR #26). O Bloco 25 será integrado na `main` após a conclusão de 25A, 25B e 25C.

---

## 1. Visão Geral da Entrega
A Etapa 25B aprimora a experiência de edição do perfil social para permitir que o usuário atualize seu **nome de exibição (displayName)**, **biografia (bio)** e **avatar (avatarUrl)** com consistência de ponta a ponta, segurança estrita e validações robustas:

1. **Modal de Edição Aprimorado (`EditProfileModal`):**
   - **Preview em Tempo Real:** Pré-visualização instantânea da foto de avatar informada via URL ou selecionada via presets. Tratamento resiliente de imagens quebradas ou URLs inacessíveis com fallback automático para iniciais.
   - **Galeria de Avatares Predefinidos:** Seleção rápida de avatares com estilos diversos e URLs seguras no Unsplash.
   - **Validações Client-Side em Tempo Real:**
     - Nome: Obrigatório, mínimo de 2 e máximo de 120 caracteres.
     - Bio: Opcional, máximo de 500 caracteres, com contador dinâmico de caracteres restantes.
     - Avatar: Opcional, validação estrita de URLs (apenas protocolos `http:` e `https:`, máximo de 2048 caracteres). Opção de remover foto atual (definindo como nulo).
   - **UX e Acessibilidade:** Tecla `Esc` para fechar modal, foco automático, estados de carregamento claros com desativação de botões contra duplo clique, botão "Cancelar" e mensagens de erro contextuais.

2. **Acesso e Sincronização nos Perfis:**
   - Disponível no perfil logado (`MvpSocialProfile`).
   - Disponível também na visualização do perfil público (`PublicUserProfile`) quando `profile.isMe === true`, permitindo ao usuário editar seus dados diretamente da sua página pública com sincronização imediata do estado global e dos componentes de cabeçalho.

3. **Garantia de Modelo de Dados e Segurança do Backend:**
   - O endpoint existente `PATCH /v1/users/me` e o schema `updateProfileSchema` já atendem com precisão aos requisitos.
   - Preserva a imutabilidade estrita do identificador de login e @handle (`username`), `id`, `email`, `firebaseUid`, `status` e demais campos protegidos.
   - Nenhuma alteração em migrations ou schema do Prisma foi necessária, preservando 100% da integridade da base de dados.

4. **Testes Automatizados:**
   - Nova suíte `backend/tests/profile-editing.test.ts` com 26 testes cobrindo validação de schemas, sanitização, limites de caracteres, bloqueio de campos restritos e testes de integração HTTP do endpoint `PATCH /v1/users/me`.

---

## 2. Relação dos Arquivos da Etapa 25B

1. **`src/components/EditProfileModal.tsx`** (Modificado): Modal de edição com preview de avatar, galeria de presets, contadores de caracteres, validações e feedback de carregamento.
2. **`src/components/PublicUserProfile.tsx`** (Modificado): Inclusão do botão "Editar perfil" para o próprio usuário (`profile.isMe`), integração com `EditProfileModal` e callback de atualização.
3. **`src/App.tsx`** (Modificado): Passagem de `currentUser` e `onCurrentUserUpdated` para `PublicUserProfile`.
4. **`backend/tests/profile-editing.test.ts`** (Novo): 26 testes unitários e de integração HTTP para validação do fluxo de edição de perfil social.

---

## 3. Instruções para o Codex
* **Aplicação Cirúrgica:** Aplicar as alterações nos componentes sem sobrescrever código não relacionado.
* **Isolamento de Escopo:** Não iniciar a etapa 25C (Filtros da atividade) até aprovação técnica.
