# Implantação e validação na Oracle

## Pré-condições

Destino: `intent-app-01`, `us-ashburn-1`, Ubuntu 24.04 ARM64.
Executar os comandos da aplicação em `/opt/intent/source`. Os exemplos com Docker
pressupõem operador autorizado; usar `sudo` se necessário. Não executar este
runbook durante a revisão documental. Em uma VM nova, começar pela
[recuperação completa](recuperacao-completa.md).

Antes da implantação, exigir checkout limpo no commit aprovado, Docker Engine e
Compose v2 funcionais, PostgreSQL saudável, Redis validado, rede `intent-private`,
credenciais protegidas e rotina de backup existente. A conta `ubuntu` deve poder
ler o Git e o script precisa de `docker`, `curl`, `openssl`, `python3`, `ss` e `stat`.

```bash
cd /opt/intent/source
git status --porcelain
git rev-parse HEAD
docker version
docker compose version
docker network inspect intent-private --format '{{.Internal}}'
docker inspect intent-postgres intent-redis --format '{{.Name}} {{.State.Status}} {{if .State.Health}}{{.State.Health.Status}}{{end}}'
sudo stat -c '%U:%G %a %n' /opt/intent/runtime/backend.env
sudo stat -c '%u:%g %a %n' /opt/intent/secrets/firebase-admin.json
sudo test -x /opt/intent/scripts/executar-backup-postgres.sh
```

Saída Git deve estar vazia para alterações; comparar o hash com o aprovado.
Não imprimir `.env`, tokens, JSON administrativo ou `docker inspect` completo.
Inspecionar Redis com a autenticação já configurada e esperar `PONG`; não remover
senha ou ACL para fazer o teste passar.

## Implantação existente

Antes de qualquer parada, verificar backup disponível, sua restauração ensaiada,
a chave de revelação preservada e espaço livre. Registrar IDs de imagens e o
commit anterior em registro operacional protegido. Preservar também a imagem do
frontend com um nome único antes de reconstruí-la; o script só preserva a API.

```bash
docker inspect intent-api intent-frontend --format '{{.Name}} {{.Image}}'
df -h /opt/intent
docker system df
FRONTEND_ROLLBACK_IMAGE="intent-frontend:rollback-$(date -u +%Y%m%dT%H%M%SZ)"
docker tag "$(docker inspect intent-frontend --format '{{.Image}}')" "$FRONTEND_ROLLBACK_IMAGE"
sudo bash deploy/oracle/08-deploy-backend.sh
```

Em primeira implantação, sem frontend anterior, omitir a preservação dessa imagem.
Em ambiente existente, interromper se não for possível preservá-la.

O [script existente](../deploy/oracle/08-deploy-backend.sh) valida credenciais,
gera o ambiente preservando a chave de revelação existente, constrói a imagem,
para a API, chama o backup externo e sobe a API com migrações. Faz health checks
e tenta recuperar banco/imagem em erros capturados. O script não verifica o hash
aprovado: a conferência Git acima é obrigatória.

Há limites: saídas explícitas com `exit 1` podem não acionar o trap `ERR`, não há
imagem anterior na primeira implantação e a seleção do dump usa o arquivo mais
recente por data. Confirmar que o dump pertence à janela atual, excluir execução
concorrente da rotina e verificar manualmente o estado após qualquer falha.
Não considerar o rollback automático uma garantia de recuperação.

Com a API pronta e `intent-edge` existente, implantar o frontend:

```bash
docker compose -f deploy/oracle/frontend.compose.yaml build
docker compose -f deploy/oracle/frontend.compose.yaml up -d --no-build --force-recreate
```

## Validação técnica

```bash
docker compose -f backend/compose.yaml ps
docker compose -f deploy/oracle/frontend.compose.yaml ps
docker inspect intent-api intent-frontend --format '{{.Name}} {{.State.Health.Status}}'
docker inspect intent-api intent-frontend intent-postgres intent-redis --format '{{.Name}} {{json .HostConfig.PortBindings}}'
docker network inspect intent-private --format '{{range .Containers}}{{println .Name}}{{end}}'
docker network inspect intent-edge --format '{{range .Containers}}{{println .Name}}{{end}}'
ss -lnt
curl --fail --silent --show-error http://127.0.0.1:8080/health
curl --fail --silent --show-error http://127.0.0.1:8080/health/live
curl --fail --silent --show-error http://127.0.0.1:8080/health/ready
curl --fail --silent --show-error http://127.0.0.1:3000/healthz
curl --fail --silent --show-error http://127.0.0.1:3000/api/health/ready
curl --fail --silent --show-error --output /dev/null http://127.0.0.1:3000/
curl --silent --output /dev/null --write-out '%{http_code}\n' http://127.0.0.1:3000/api/v1/users/me
docker exec intent-api ./node_modules/.bin/prisma migrate status
```

Esperar HTTP 200 nos health checks e raiz; `/health/ready` deve indicar banco OK.
A consulta a `/api/v1/users/me` sem token deve retornar 401. Migrações devem estar
aplicadas, sem falhas. API e frontend devem ficar `healthy`. Conferir bindings
somente `127.0.0.1:8080` e `127.0.0.1:3000`, inclusive ausência de exposição IPv6;
PostgreSQL e Redis sem portas publicadas. Não depender apenas de `ss`, pois o
Docker pode publicar via regras de rede sem processo escutando visível ali.

O build Docker do backend executa TypeScript e Vitest; o frontend executa
`bun run lint` e `bun run build`. Para repetir fora da VM, em checkout descartável
sem segredos e com Node 22/Bun 1.4.0:

```bash
bun install --frozen-lockfile
bun run lint
bun run build
cd backend
npm ci
npm run prisma:generate
npm run lint
npm run build
npm test
```

A raiz não possui script de testes automatizados. Sucesso de build e testes de
domínio não comprova integração, acesso Firebase ou recuperação de dados.

## Validação funcional por túnel

No computador do operador, definir `VM_SSH_DESTINO` com o destino SSH autorizado:

```bash
ssh -N -o ExitOnForwardFailure=yes -L 127.0.0.1:3000:127.0.0.1:3000 -L 127.0.0.1:8080:127.0.0.1:8080 "${VM_SSH_DESTINO:?Defina o destino SSH autorizado}"
```

Abrir `http://localhost:3000`. Usar contas de teste e registrar resultados sem
tokens, senhas ou conteúdo privado. Ensaiar primeiro em ambiente de recuperação;
na produção, os testes de escrita exigem janela e dados de teste identificados.

1. Login com Google e e-mail/senha; cancelar popup e tentar novamente; sair.
2. Sincronizar perfil, recarregar e confirmar persistência.
3. Criar Intent pública com meta pequena; verificar feed e “Minhas Intents”.
4. Outra conta apoia, retira antes da realização e apoia novamente; conferir contador.
5. Atingir a meta; conferir realização e revelação. Não permitir retirada depois.
6. Seguir/deixar de seguir; conferir perfil, listas e feed “Seguindo”.
7. Com três contas, conferir que somente seguidores acessam a Intent exclusiva;
   remover vínculo deve retirar acesso, inclusive ao abrir seu detalhe.
8. Após restauração, abrir uma revelação antiga já realizada para validar a chave.

Se qualquer teste falhar, manter a manutenção e seguir
[backups e rollback](backups-e-rollback.md). Registrar commit, imagens, horário,
checks, teste funcional, operador e resultado antes de declarar implantação válida.
