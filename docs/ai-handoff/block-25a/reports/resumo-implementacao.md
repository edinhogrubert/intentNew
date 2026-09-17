# Resumo da Implementação — Bloco 25A: Links Compartilháveis

## Contexto e Objetivos
A Etapa 25A estabelece o mecanismo estável e seguro de compartilhamento de recursos no Intent OS, permitindo que usuários gerem e acessem links diretos para Perfis Públicos e Intents, com suporte a histórico de navegação (`popstate`), persistência de destino durante a autenticação e proteção contra vazamento de recursos privados.

## Decisões Técnicas e Arquitetura

### 1. Formato de URLs Canônicas
* **Perfil de Usuário:** `?user=<user_uuid>` (com suporte a fallback de leitura para `?user_id=`, `?userId=`, `?profile=` e paths `/user/:id` / `/profile/:id`).
* **Detalhe de Intent:** `?intent=<intent_uuid>` (com suporte a fallback de leitura para `?intent_id=`, `?intentId=` e path `/intent/:id`).
* **Identificadores Imutáveis:** Utilização exclusiva de UUIDs v4 existentes na base, dispensando `@username` para evitar problemas com renomeações futuras.

### 2. Ciclo de Vida e Navegação no Frontend (`App.tsx`)
* **Captura Inicial:** Na montagem do componente raiz, `useRef(parseInitialLocation())` analisa a URL atual.
* **Autenticação Resiliente:** Se o usuário não estiver autenticado, o destino é retido e ativado imediatamente após o login bem-sucedido no `AuthGate`.
* **Sincronização Bidirecional:** A função `navigateToView` atualiza o estado React e a URL do navegador via `window.history.pushState` / `replaceState`.
* **Histórico do Navegador:** Listener de `popstate` garante que os botões "Voltar" e "Avançar" do navegador alterem a visualização sem recarregar a aplicação.

### 3. Cópia Resiliente para Área de Transferência
* `copyToClipboard(text)` tenta primeiramente a API moderna `navigator.clipboard.writeText(text)`.
* Em caso de bloqueio ou permissão restrita (como em iframes ou navegadores antigos), aciona automaticamente o fallback baseado em criação efêmera de `<textarea>` e `document.execCommand('copy')`.

### 4. Segurança de Acesso
* Nenhuma verificação de autorização foi relaxada ou transferida para o cliente.
* Requisições de detalhe para `GET /v1/intents/:id` continuam sendo filtradas no backend por `assertIntentViewAccess()`. Intents privadas ou visíveis apenas para seguidores retornam `403 INTENT_FORBIDDEN` ou `404 INTENT_NOT_FOUND` se o solicitante não possuir acesso.
* O cofre de segredos criptografados (`secret`) permanece protegido até que a condição de revelação seja atingida.

---

## Relação dos Arquivos Criados e Alterados

### Arquivos Criados
1. `src/utils/shareLink.ts`: Utilitários de manipulação de links, parsing, validação de UUID e cópia para clipboard.
2. `backend/tests/share-link.test.ts`: 13 testes unitários cobrindo parsing de URL, sanitização e geração de links.

### Arquivos Modificados
3. `src/App.tsx`: Gerenciamento de rotas, inicialização com base na URL e sincronização com o histórico.
4. `src/components/PublicUserProfile.tsx`: Botão de compartilhamento no perfil público.
5. `src/components/MvpSocialProfile.tsx`: Botão de compartilhamento no perfil autenticado.
6. `src/components/MvpIntentDetail.tsx`: Botão de compartilhamento no cabeçalho do detalhe da Intent.
7. `src/components/MvpHomeFeed.tsx`: Botão de compartilhamento nos cards do feed.

---

## Instruções Precisas para o Codex Reproduzir a Funcionalidade

1. **Copiar o arquivo `src/utils/shareLink.ts`** para a mesma localização.
2. **Copiar o arquivo de testes `backend/tests/share-link.test.ts`** para `backend/tests/`.
3. **No `src/App.tsx`:**
   - Importar `parseInitialLocation` e `syncUrlLocation` de `./utils/shareLink`.
   - Capturar `initialTarget` com `useRef(parseInitialLocation())`.
   - Inicializar `view`, `selectedIntentId` e `selectedProfileId` avaliando `initialTarget.current`.
   - No `useEffect` de autenticação (`syncAuthenticatedUser`) e no callback `onAuthenticated`, verificar `initialTarget.current` para redirecionar diretamente ao recurso compartilhado.
   - Adicionar o listener do evento `popstate` para sincronizar a navegação pelo navegador.
   - Implementar `navigateToView(newView, targetId)` para manter `window.history` sincronizado.
4. **Nos componentes (`PublicUserProfile`, `MvpSocialProfile`, `MvpIntentDetail`, `MvpHomeFeed`):**
   - Importar o ícone `Share2` de `lucide-react` e os utilitários de `../utils/shareLink`.
   - Adicionar o botão "Compartilhar" com estado local `copySuccess` / `copied` para fornecer feedback visual de "Link copiado!".
5. **Executar a suíte de testes:** `npm --prefix backend test` e validar TypeScript com `npm run lint`.
