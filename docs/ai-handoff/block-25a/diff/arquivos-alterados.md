# Arquivos Alterados — Bloco 25A: Links Compartilháveis

## Relação de Arquivos Criados

1. **`src/utils/shareLink.ts`**
   - Funções: `isValidUuid`, `getIntentShareUrl`, `getUserProfileShareUrl`, `parseInitialLocation`, `syncUrlLocation`, `copyToClipboard`.
   - Implementa geração de URLs limpas, extração robusta de query/path parameters e fallback de clipboard.

2. **`backend/tests/share-link.test.ts`**
   - 13 testes unitários cobrindo todos os utilitários de link e validações de segurança.

3. **`docs/ai-handoff/bloco-25a-links-compartilhaveis.md`**
4. **`docs/ai-handoff/block-25a/reports/resumo-implementacao.md`**
5. **`docs/ai-handoff/block-25a/reports/validacoes.md`**
6. **`docs/ai-handoff/block-25a/diff/arquivos-alterados.md`**

---

## Relação de Arquivos Modificados

1. **`src/App.tsx`**
   - Importa `parseInitialLocation` e `syncUrlLocation`.
   - Inicializa `initialTarget = useRef(parseInitialLocation())`.
   - Define estado inicial de `view`, `selectedIntentId` e `selectedProfileId` a partir da URL.
   - Restaura navegação desejada após conclusão da autenticação no `AuthGate`.
   - Escuta o evento `popstate` para sincronizar os botões Voltar/Avançar do navegador.
   - Adiciona função centralizada `navigateToView` para sincronizar `window.history`.

2. **`src/components/PublicUserProfile.tsx`**
   - Adiciona botão "Compartilhar" no cabeçalho do perfil público (`Share2`).
   - Dispara `copyToClipboard(getUserProfileShareUrl(userId))` com feedback visual temporário ("Link copiado!").

3. **`src/components/MvpSocialProfile.tsx`**
   - Adiciona botão "Compartilhar" no perfil social autenticado (`MvpSocialProfile`).

4. **`src/components/MvpIntentDetail.tsx`**
   - Adiciona botão "Compartilhar" na barra superior do card da Intent (`Share2`).
   - Dispara `copyToClipboard(getIntentShareUrl(intentId))` com feedback visual temporário.

5. **`src/components/MvpHomeFeed.tsx`**
   - Adiciona botão "Compartilhar" em cada card de Intent no feed inicial.
   - Trata parada de propagação do clique (`e.stopPropagation()`) para não abrir o card acidentalmente ao clicar em compartilhar.

---

## Instruções de Aplicação para o Codex
* **Método Recomendado:** Comparação cirúrgica com os arquivos existentes na branch `main` de referência oficial (`mvp-1.0.23`, commit `4cbdc3ad5b3b6e5e699123f7e0389f98c4f4da6f`).
* **Atenção:** Não sobrescrever o `src/App.tsx` por completo caso haja outras ramificações; integrar apenas as seções de manipulação de `initialTarget`, `popstate` e `navigateToView`.
