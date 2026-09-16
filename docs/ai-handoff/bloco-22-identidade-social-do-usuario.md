# Bloco 22 — Identidade Social do Usuário

## Objetivo
Evoluir o perfil público para expressar a identidade social do usuário sob dois prismas complementares:
1. **Como criador de acontecimentos:** capacidade de criar, propor e mobilizar intents públicas, colher apoios, reações e comentários, e converter intenções em realizações.
2. **Como participante de acontecimentos:** engajamento ativo apoiando, reagindo, comentando e participando de acontecimentos de outras pessoas que chegam à realização.

Além disso, apresentar uma seção dedicada de **Conexões** (Seguidores e Perfis Seguidos) e um **Resumo da Identidade Social** claro, coeso e contextual, eliminando termos genéricos e enfatizando a participação em rede.

## Métricas e Agregados

### Como Criador
- **Intents públicas:** quantidade de intents com visibilidade `PUBLIC` e status ativo/realizado.
- **Realizações:** intents públicas criadas que atingiram o status `REALIZED`.
- **Apoios recebidos:** total de apoios recebidos em intents públicas do criador.
- **Reações recebidas:** volume de reações recebidas em intents públicas.
- **Comentários recebidos:** número de comentários feitos por participantes ativos em intents públicas do criador.

### Como Participante
- **Intents apoiadas:** total de intents que o usuário atualmente apoia.
- **Reações dadas:** total de reações expressas pelo usuário em acontecimentos da rede.
- **Comentários feitos:** volume de comentários realizados pelo usuário.
- **Participações realizadas:** intents concluídas (`REALIZED`) em que o usuário participou ativamente (apoiando, comentando ou reagindo).

### Conexões
- **Seguidores:** quantidade de participantes ativos que acompanham o perfil (acesso ao modal de seguidores).
- **Seguindo:** perfis ativos acompanhados pelo usuário (acesso ao modal de seguindo).

## Vocabulário Adotado
- O termo "comunidade" foi integralmente substituído por: pessoas, participantes, rede, quem acompanha, acontecimentos, Intents.

## Arquivos Envolvidos
- `backend/src/services/public-profile-service.ts`: cálculo das novas métricas de participante em paralelo via `Promise.all` e composição de `stats`.
- `src/services/intentApi.ts`: tipagem atualizada de `ApiPublicUserProfile.stats` no frontend.
- `src/components/PublicUserProfile.tsx`: nova organização em 3 seções estruturadas (Conexões, Como criador, Como participante), cards dedicados e resumo dinâmico de identidade social.
- `backend/tests/social-http.test.ts`: testes de regressão e validação do contrato de estatísticas públicas.
