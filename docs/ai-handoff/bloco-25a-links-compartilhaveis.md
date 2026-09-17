# INTENT — Bloco 25A | Links Compartilháveis (Perfil e Intent)

## Identificação e Referência
* **Etapa:** 25A (Links Compartilháveis)
* **Ambiente de Origem:** `intentNew`
* **Referência Oficial de Integração:** `edinhogrubert/Intent` | Branch: `main` | Release: `mvp-1.0.23` | Commit: `4cbdc3ad5b3b6e5e699123f7e0389f98c4f4da6f`
* **Destino de Handoff:** Repositório de transferência `edinhogrubert/intentNew` (não realizar merge ou deploy no repositório oficial).

---

## 1. Visão Geral da Entrega
A Etapa 25A adiciona a capacidade de compartilhamento direto e navegação via URLs canônicas/compartilháveis para:
1. **Perfis de Usuários Públicos:** Acesso direto via `?user=<user_uuid>`.
2. **Detalhes de Intents:** Acesso direto via `?intent=<intent_uuid>`.

A solução inclui:
- Geração de URLs seguras com identificadores imutáveis existentes (UUIDs v4).
- Leitura e roteamento inicial antes e depois do login (`AuthGate`).
- Sincronização contínua com `window.history` sem disparo de recarregamento e suporte aos botões Voltar/Avançar do navegador (`popstate`).
- Botões de compartilhamento com feedback visual e mecanismo de cópia resiliente com fallback para iframes.
- Preservação estrita de todas as regras de segurança e autorização do backend.

---

## 2. Relação dos 7 Arquivos de Código da Etapa 25A

1. **`src/utils/shareLink.ts`** (Novo): Módulo utilitário de validação de UUID, parsing de parâmetros de busca/caminho, geração de links compartilháveis e cópia para área de transferência com fallback.
2. **`backend/tests/share-link.test.ts`** (Novo): Suíte de testes unitários cobrindo 13 cenários de validação de UUID, rotas, query params e integridade de URLs.
3. **`src/App.tsx`** (Modificado): Inicialização de tela com base em `parseInitialLocation()`, preservação da intenção no fluxo de autenticação e escuta do evento `popstate`.
4. **`src/components/PublicUserProfile.tsx`** (Modificado): Botão "Compartilhar" no perfil público com chamada para `getUserProfileShareUrl` e feedback visual.
5. **`src/components/MvpSocialProfile.tsx`** (Modificado): Botão "Compartilhar" no perfil autenticado.
6. **`src/components/MvpIntentDetail.tsx`** (Modificado): Botão "Compartilhar" na barra superior do card de Intent.
7. **`src/components/MvpHomeFeed.tsx`** (Modificado): Botão "Compartilhar" nos cards de Intent do feed inicial.

---

## 3. Instruções Críticas para o Codex
* **Comparar e Adaptar:** O Codex deve comparar os diffs e adaptar as alterações cirurgicamente nos arquivos oficiais, **nunca sobrescrevendo arquivos inteiros de forma cega**.
* **Segurança:** Não modificar as verificações de controle de acesso do backend (`assertIntentViewAccess` e `getPublicUserProfile`). Toda a autorização continua sendo estritamente validada no servidor.
* **Isolamento de Escopo:** Não iniciar a Etapa 25B (Edição de Perfil).
