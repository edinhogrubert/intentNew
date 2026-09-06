# Deploy da Infraestrutura (Oracle Cloud)

Este documento descreve os comandos para implantar o backend e frontend na Oracle Cloud.

## Scripts de Deploy
- `/deploy/oracle/08-deploy-backend.sh`: Script principal para deploy do backend. Executa backup, parada, atualização e nova inicialização.

## Procedimento de Recuperação
1. Restaurar o dump do banco de dados utilizando `pg_restore`.
2. Executar as migrações do Prisma: `npx prisma migrate deploy`.
3. Reiniciar os serviços via Docker Compose.

## Verificação de Segurança
- `.env` files are ignored by git.
- Secrets are managed on the host VM and NOT in git.
