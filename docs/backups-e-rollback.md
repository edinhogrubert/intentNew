# Backups PostgreSQL e rollback

## Política e pré-condições

O [registro existente](../ProximasFuncionalidades.md) informa backup local diário
às 03:15, retenção de sete dias e backup externo pendente. Confirmar na VM o
agendador, seu fuso e execuções recentes. O script externo não está no Git.
Dump no mesmo disco não protege contra perda da VM. Preservar uma cópia protegida
fora dela e ensaiar restauração em ambiente isolado antes de depender do backup.

Operações abaixo são procedimentos para uma janela de manutenção, não ações
executadas nesta alteração documental. Usar sessão administrativa Bash sem
`set -x`, arquivos confiáveis e diretórios fora de `/opt/intent/source`.
Definir `POSTGRES_USER` e `POSTGRES_DB` a partir da configuração protegida.
Não colocar senha na linha de comando; os exemplos usam autenticação local do
container, que deve estar configurada. Se falhar, usar o mecanismo protegido
aprovado, sem relaxar autenticação.

## Criar e verificar um dump manual

Parar escritas da aplicação e quaisquer outros escritores antes do backup que
será pareado com a imagem anterior. Bloquear implantações concorrentes. O
`pg_dump` é consistente por snapshot, mas a janela sem escritas evita divergência
entre o ponto de rollback e o estado servido aos usuários.

```bash
set -euo pipefail
: "${POSTGRES_USER:?Defina o usuario do banco}"
: "${POSTGRES_DB:?Defina o banco}"
umask 077
docker stop intent-frontend intent-api
BACKUP_DIR=/opt/intent/backups/postgres
mkdir -p "$BACKUP_DIR"
BACKUP_FILE="$BACKUP_DIR/intent_$(date -u +%Y%m%dT%H%M%SZ).dump"
test ! -e "$BACKUP_FILE"
docker exec intent-postgres pg_dump --format=custom --no-owner --no-privileges --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" > "$BACKUP_FILE.partial"
test -s "$BACKUP_FILE.partial"
docker exec -i intent-postgres pg_restore --list < "$BACKUP_FILE.partial" > /dev/null
mv "$BACKUP_FILE.partial" "$BACKUP_FILE"
sha256sum "$BACKUP_FILE" > "$BACKUP_FILE.sha256"
sha256sum --check "$BACKUP_FILE.sha256"
```

Em VM nova sem containers de aplicação, omitir apenas a parada dos inexistentes.
Não continuar se dump/listagem/checksum falharem. Registrar commit, horário UTC,
imagens, versão PostgreSQL, contagens das tabelas e referência da chave protegida
junto ao backup, fora do Git. O dump não contém papéis globais PostgreSQL nem
Firebase, Redis ou a chave de revelação; preservar esses itens separadamente.
`pg_restore --list` só confere o catálogo; a prova é restaurar em banco isolado e
executar verificações de dados. Se esta foi apenas uma cópia de segurança,
retomar API e frontend somente após verificar a mesma versão e seu estado saudável.

## Restaurar PostgreSQL

A restauração substitui objetos e dados do banco de destino. Exige janela aprovada,
backup de segurança do estado atual e ciência de que escritas posteriores ao dump
serão perdidas. Preferir ensaio em instância isolada, com nomes e volumes distintos,
sem conexão de aplicações de produção. Não usar um dump não confiável.

1. Escolher explicitamente o dump e conferir data, checksum, commit e chave
   correspondentes. Não selecionar automaticamente o arquivo mais recente.
2. Parar API/frontend e outros escritores; manter PostgreSQL saudável.
3. Confirmar destino correto e papel com permissões de criação/remoção de objetos.
   Em servidor novo, provisionar previamente o usuário e banco do inventário.
4. Usar PostgreSQL/cliente compatíveis com a origem, inicialmente a mesma versão
   principal. Não restaurar dump de schema futuro para executar código antigo.

Com `BACKUP_FILE`, `POSTGRES_USER` e `POSTGRES_DB` definidos na sessão protegida:

```bash
set -euo pipefail
: "${BACKUP_FILE:?Defina o dump aprovado}"
: "${POSTGRES_USER:?Defina o usuario do banco}"
: "${POSTGRES_DB:?Defina o banco}"
test -s "$BACKUP_FILE"
sha256sum --check "$BACKUP_FILE.sha256"
docker exec -i intent-postgres pg_restore --list < "$BACKUP_FILE" > /dev/null
docker exec intent-postgres psql -X -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -c 'SELECT current_database(), current_user;'
docker exec -i intent-postgres pg_restore --clean --if-exists --single-transaction --no-owner --no-privileges --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" < "$BACKUP_FILE"
docker exec intent-postgres psql -X -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -c 'SELECT count(*) AS users FROM users; SELECT count(*) AS intents FROM intents; SELECT count(*) AS supports FROM supports; SELECT count(*) AS follows FROM follows; SELECT count(*) AS events FROM domain_events;'
docker exec intent-postgres psql -X -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -c 'SELECT migration_name, finished_at, rolled_back_at FROM _prisma_migrations ORDER BY started_at;'
```

O exemplo de contagens pressupõe dump do MVP consolidado com a tabela `follows`.
Comparar com os registros do backup. Se o checksum registra caminho antigo,
validar o hash usando o caminho recuperado e o valor original confiável.
`--clean` remove objetos presentes no dump, não garante remover objetos novos
existentes somente no destino. Para rollback entre schemas diferentes, restaurar
primeiro em banco vazio isolado, validado pelo administrador; não presumir que
este comando reverte qualquer migração. A transação evita restauração parcial:
em erro, manter a API parada e investigar, sem ignorar o código de saída.

## Rollback de versão

1. Abrir manutenção, parar escritas e registrar motivo, commit e imagens atuais.
   Fazer backup de segurança antes de substituir dados ou imagens.
2. Selecionar o conjunto anterior: código/imagens da API e frontend, dump compatível
   e runtime com a chave correspondente. Se somente o código mudou e a
   compatibilidade de schema foi comprovada, não restaurar banco desnecessariamente.
3. Para o MVP, conferir e selecionar `mvp-1.0.0` conforme
   [fluxo Git/VM](fluxo-git-vm.md). Nunca usar a antiga main arquivada ou `devin`.
4. Se houve migração incompatível, restaurar o dump anterior antes de subir a API.
   Não apagar registros de migração manualmente nem executar reset do Prisma.
5. Se as imagens anteriores foram preservadas, conferir seus IDs e definir
   `API_ROLLBACK_IMAGE` e `FRONTEND_ROLLBACK_IMAGE` com as referências aprovadas:

   ```bash
   : "${API_ROLLBACK_IMAGE:?Defina a imagem anterior da API}"
   : "${FRONTEND_ROLLBACK_IMAGE:?Defina a imagem anterior do frontend}"
   docker image inspect "$API_ROLLBACK_IMAGE" "$FRONTEND_ROLLBACK_IMAGE" --format '{{.Id}}'
   docker tag "$API_ROLLBACK_IMAGE" intent-api-api:latest
   docker tag "$FRONTEND_ROLLBACK_IMAGE" intent-frontend:local
   docker compose -f /opt/intent/source/backend/compose.yaml up -d --no-build --force-recreate
   docker compose -f /opt/intent/source/deploy/oracle/frontend.compose.yaml up -d --no-build --force-recreate
   ```

6. Sem imagens preservadas, reconstruir a tag aprovada com o banco e os segredos
   recuperados, seguindo [implantação](implantacao-oracle.md). A tag não congela
   imagens base remotas; registrar os novos IDs e repetir a validação completa.
7. Validar saúde, migrações, proxy, isolamento, login e revelações antigas antes
   de encerrar a manutenção. Se falhar, manter a API parada e preservar evidências.

O script de implantação tenta rollback da API e banco, mas não do frontend;
seus limites estão descritos em [implantação](implantacao-oracle.md). Não executar
`docker compose down -v`, `docker volume prune` ou limpeza de imagens de rollback
como parte de uma recuperação. Registrar o ponto restaurado e a perda de dados,
sem publicar conteúdo do dump ou segredos.
