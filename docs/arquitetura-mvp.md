# Arquitetura operacional do MVP

## Referência e alcance

Base conferida no GitHub em 2026-09-06: `main` no commit
`62e78cc040afc08e13c44e2fd943134643e05231`, marcado pela tag anotada `mvp-1.0.0`.
VM informada: `intent-app-01`, região `us-ashburn-1`, Ubuntu 24.04 ARM64.
Esta documentação descreve o código e os dados confirmados; não representa uma
nova inspeção nem um teste executado na VM.

## Componentes e tráfego

| Componente | Função | Rede e acesso |
| --- | --- | --- |
| `intent-frontend` | React 19, TypeScript e Vite; arquivos estáticos servidos por Nginx | `intent-edge`; host `127.0.0.1:3000` → container `8080` |
| `intent-api` | Node.js 22, Express, validação Zod e Prisma | `intent-edge` e `intent-private`; host `127.0.0.1:8080` → container `8080` |
| `intent-postgres` | Persistência de usuários, Intents, apoios, vínculos e eventos | Rede privada; API usa `intent-postgres:5432`; sem publicação pública |
| `intent-redis` | Serviço de infraestrutura provisionado | Rede privada; não há cliente Redis no backend atual |
| Firebase Authentication | Login e validação da identidade | Serviço externo, projeto `intent-86155` |

O navegador acessa o frontend por túnel SSH. As chamadas relativas `/api/`
passam pelo Nginx, que remove esse prefixo e encaminha para `intent-api:8080`.
A API acessa PostgreSQL pelo DNS Docker e verifica tokens com Firebase Admin.
O frontend não acessa o banco diretamente. O Firebase SDK ainda exporta Firestore
para compatibilidade, mas o fluxo ativo de Intents usa API/PostgreSQL.

A rede `intent-edge` é uma bridge criada pelo Compose da API e utilizada como
externa pelo frontend. `intent-private` precisa existir antes da API; seu
provisionamento não está neste repositório. Confirmar na VM seu atributo
`Internal`, participantes e ausência de portas de dados publicadas. O nome
“private” sozinho não garante isolamento. A API precisa de saída para o Firebase.
Não abrir 3000, 8080, PostgreSQL ou Redis no firewall/NSG da Oracle.

## Persistência, migrações e criptografia

O [schema Prisma](../backend/prisma/schema.prisma) define `users`, `intents`,
`supports`, `follows` e `domain_events`. As migrações versionadas são a inicial,
a categoria da Intent e os vínculos sociais, na ordem dos diretórios em
[prisma/migrations](../backend/prisma/migrations).
O [entrypoint](../backend/docker-entrypoint.sh) executa `prisma migrate deploy`
antes de iniciar a API, com até 12 tentativas. Reiniciar uma imagem pode aplicar
migrações pendentes: preservar banco e versão antes de subir a API.
Não usar `migrate dev`, `migrate reset` ou `db push` em produção.

A revelação usa AES-256-GCM. O dump contém o conteúdo cifrado, mas não substitui
`REVEAL_ENCRYPTION_KEY`: conservar a mesma chave de 32 bytes em Base64 junto ao
material protegido de recuperação. Uma chave nova não abre revelações antigas.
Firebase Authentication mantém as identidades fora do PostgreSQL; restaurar o
banco não restaura contas Firebase excluídas nem configurações de autenticação.

## Credenciais e arquivos externos

| Caminho na VM | Uso e proteção |
| --- | --- |
| `/opt/intent/source` | Checkout Git, sem segredos |
| `/opt/intent/.env` | Credenciais PostgreSQL; acesso restrito ao administrador |
| `/opt/intent/runtime/backend.env` | Ambiente da API e chave de revelação; `root:docker`, modo `0640` |
| `/opt/intent/secrets/firebase-admin.json` | Conta de serviço; `root:10001`, modo `0440`, arquivo real, sem symlink |
| `/run/secrets/firebase-admin.json` | Montagem somente leitura dentro da API |
| `/opt/intent/backups/postgres` | Dumps locais, fora do checkout |
| `/opt/intent/scripts/executar-backup-postgres.sh` | Rotina externa requerida pelo script de implantação |

O script valida o projeto da credencial sem imprimir seu conteúdo. A API usa
`GOOGLE_APPLICATION_CREDENTIALS` e Firebase Admin; preservar o projeto e a conta
mínima existentes. O JSON de configuração web do Firebase contém identificadores
públicos e não equivale a uma chave administrativa; não copiar seu conteúdo para
os runbooks nem colocar segredos em variáveis incluídas no bundle do navegador.

## Fontes e continuidade

Fontes executáveis: [Compose da API](../backend/compose.yaml),
[Compose do frontend](../deploy/oracle/frontend.compose.yaml),
[Nginx](../deploy/oracle/frontend.nginx.conf) e
[cliente da API](../src/services/intentApi.ts).
O [estado histórico](../ProximasFuncionalidades.md) registra PostgreSQL 16,
Redis 7 e backup diário às 03:15 com retenção de sete dias. Conferir versões,
fuso e agendamento na VM: não há manifestos dos serviços de dados no Git.
O README antigo do backend descreve uma fatia anterior e não cobre a integração
social atual. `archive/intentV1/` é somente histórico, nunca fonte de rollback.

Próximos procedimentos: [implantação](implantacao-oracle.md),
[recuperação completa](recuperacao-completa.md),
[backups e rollback](backups-e-rollback.md) e [fluxo Git/VM](fluxo-git-vm.md).
