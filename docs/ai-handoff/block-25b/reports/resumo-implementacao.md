# Resumo da Implementação — Bloco 25B (Edição do Perfil Social)

## 1. Contexto e Motivação
A etapa 25B tem como foco fornecer ao usuário uma interface completa, segura e agradável para edição do seu perfil social no Intent OS, permitindo alterar **nome de exibição**, **biografia** e **foto de perfil (avatar)** sem comprometer a identidade imutável (`username`) ou expor campos restritos.

## 2. Decisões Técnicas

### 2.1. Backend e API
- **Endpoint Utilizado:** `PATCH /v1/users/me` já implementado em `backend/src/routes/users.ts`.
- **Validação de Schema:** `updateProfileSchema` em `backend/src/domain/intent-schemas.ts` utiliza validação estrita com Zod (`displayName`: 2-120 chars com trim; `bio`: até 500 chars ou null; `avatarUrl`: URL válida até 2048 chars ou null).
- **Segurança:** O endpoint exige token de autenticação ativo (`requireAuthenticatedUser`), impede a modificação de `username`, `email`, `role`, `status` ou `firebaseUid`, e retorna apenas a projeção pública segura do usuário (`toPublicUserRepresentation`).
- **Nenhuma migration necessária:** A tabela `User` do Prisma já possui os campos necessários (`displayName`, `bio`, `avatarUrl`), garantindo total compatibilidade reversa.

### 2.2. Frontend e Interface
- **`EditProfileModal.tsx`:**
  - Adicionado componente de pré-visualização de avatar em tempo real com indicador de carregamento e detecção de erro na imagem (com fallback para as iniciais).
  - Incluída galeria de avatares predefinidos com 6 opções de imagens para facilitar a escolha rápida.
  - Adicionado botão de remoção de avatar (limpeza de imagem para voltar às iniciais).
  - Contador dinâmico de caracteres na bio (ex.: "450/500").
  - Validação em tempo real no cliente antes do envio da requisição.
  - Fechamento seguro via tecla `Escape` ou clique no botão Cancelar / Fechar.
- **`PublicUserProfile.tsx`:**
  - Quando o perfil sendo visualizado é do próprio usuário logado (`profile.isMe === true`), agora é exibido o botão "Editar perfil" junto à indicação "Seu Perfil".
  - Ao salvar no modal, tanto o estado local de `PublicUserProfile` quanto o estado global de `currentUser` em `App.tsx` são imediatamente atualizados, refletindo as alterações no cabeçalho e na tela sem necessidade de recarregar a página.

## 3. Dependências e Tecnologias
- **Icons:** `lucide-react` (Pencil, Image, User, Check, X, LoaderCircle, AlertCircle, RefreshCw, etc.).
- **HTTP Client:** `src/services/intentApi.ts` (`updateUserProfile`).
- **Frameworks:** React 19, TypeScript, Tailwind CSS, Vitest.

## 4. Arquivos Envolvidos
- `src/components/EditProfileModal.tsx`
- `src/components/PublicUserProfile.tsx`
- `src/App.tsx`
- `backend/tests/profile-editing.test.ts`
