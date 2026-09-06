# Registro de Versão: mvp-1.0.0

*   **Data do Registro**: 2026-09-06
*   **Commit Ativo**: `62e78cc040afc08e13c44e2fd943134643e05231`

## 1. Containers e Build
*   **Frontend**: `intent-frontend:local`
    *   Dockerfile: `/deploy/oracle/frontend.Dockerfile`
    *   Config: `/deploy/oracle/frontend.compose.yaml`
*   **Backend (API)**: `intent-api` (built local)
    *   Dockerfile: `/backend/Dockerfile`
    *   Config: `/backend/compose.yaml`

## 2. Configuração e Segredos (VM)
*   **Firebase**: Credenciais de administrador montadas via volume em `/opt/intent/secrets/firebase-admin.json`.
*   **Variáveis de Ambiente**: Carregadas de `/opt/intent/runtime/backend.env`.

## 3. Persistência e Recuperação
*   **Migrações**: Gerenciadas pelo Prisma (`/backend/prisma/schema.prisma`).
*   **Backups**: O procedimento de backup e recuperação está definido nos scripts de manutenção da VM (`/deploy/oracle/08-deploy-backend.sh`).
*   **Procedimento de Recuperação**: Executar a restauração do dump Postgres via `pg_restore` conforme documentado no script de deploy, seguido de `prisma migrate deploy`.
