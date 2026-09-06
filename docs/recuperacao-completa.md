# Recuperação completa do Intent

## Material necessário antes de perder a VM

Referência: `intent-app-01`, região `us-ashburn-1`, Ubuntu 24.04 ARM64;
MVP `62e78cc040afc08e13c44e2fd943134643e05231`, tag `mvp-1.0.0`.
Este procedimento não foi executado na VM durante a etapa documental.

Guardar em local protegido fora da VM: dump PostgreSQL e checksum, data/commit
associados, chave de revelação original, configuração de ambiente, credencial
Firebase recuperável, acesso SSH/GitHub, definições dos serviços de dados,
volumes, versões/digests ARM64, rede privada e rotina/agendamento de backup.
O inventário deve incluir VCN/subnet/NSG, regras SSH, disco e montagem dos volumes.
Não guardar esse pacote no Git. O backup externo está registrado como pendente
no projeto: backup somente local não permite recuperação após perda do disco.

Os manifestos de PostgreSQL/Redis, nomes de volumes, IP da VM e configuração OCI
completa não estão no repositório. Recuperá-los do inventário protegido ou da VM
antes de um desastre; não inventar volumes ou recriar serviços sobre dados
existentes. Sem dump sobrevivente, não é possível prometer recuperação dos dados.

## Reconstruir a infraestrutura

1. Provisionar a VM substituta na região `us-ashburn-1`, Ubuntu 24.04 ARM64,
   usando a capacidade e rede aprovadas no inventário. Evitar duas VMs ativas
   gravando no mesmo ambiente durante a recuperação.
2. Restaurar acesso SSH restrito ao operador e regras de saída necessárias.
   Manter 3000, 8080, 5432 e 6379 sem entrada pública; não publicar 80/443 nesta etapa.
3. Instalar Docker Engine/Compose v2 compatíveis com ARM64 e dependências do
   script listadas em [implantação](implantacao-oracle.md). Conferir `uname -m`,
   `/etc/os-release`, `docker version` e `docker compose version`.
4. Preparar `/opt/intent/source` para `ubuntu`; recriar diretórios protegidos de
   runtime, segredos, scripts e backups. Restaurar credenciais por canal seguro,
   sem colar valores em shell, histórico, tickets ou Git.
5. Restaurar a definição da rede `intent-private` e serviços `intent-postgres`
   e `intent-redis` do inventário. Conferir versões (histórico: PostgreSQL 16 e
   Redis 7), arquitetura, volumes corretos, políticas de reinício e health checks.
   Não atualizar versões de dados durante a recuperação. Não publicar portas.
6. Restaurar `/opt/intent/.env`, o runtime com a chave original e o JSON Firebase;
   aplicar as permissões da [arquitetura](arquitetura-mvp.md). A credencial deve
   pertencer a `intent-86155`; preservar identidades e configuração desse projeto.
   Se precisar reemitir a credencial, fazê-lo pelo procedimento administrativo
   autorizado, mantendo privilégios mínimos.
7. Restaurar a rotina `/opt/intent/scripts/executar-backup-postgres.sh` e seu
   agendamento. Conferir fuso, retenção e permissões reais antes de habilitar.

O Redis está provisionado, sem integração funcional no backend inspecionado.
Restaurar sua configuração e persistência conforme inventário; não presumir que
um dump PostgreSQL contém Redis. Não executar flush para recuperar o serviço.

## Recuperar o código consolidado

Com Deploy Key de leitura já configurada para a conta operadora e diretório de
destino ainda inexistente, clonar como `ubuntu`:

```bash
git clone git@github.com:edinhogrubert/Intent.git /opt/intent/source
cd /opt/intent/source
git fetch origin main --tags
test "$(git rev-parse 'mvp-1.0.0^{commit}')" = 62e78cc040afc08e13c44e2fd943134643e05231
git switch --detach mvp-1.0.0
git status --porcelain
git rev-parse HEAD
```

Se o teste falhar, parar e investigar; não mover a tag. Em checkout existente,
seguir [fluxo Git/VM](fluxo-git-vm.md), sem sobrescrever alterações locais.
A tag é anotada; o hash do objeto tag difere do hash de seu commit.

## Restaurar e liberar

1. Manter API e frontend parados; restaurar PostgreSQL pelo procedimento de
   [backups e rollback](backups-e-rollback.md). Escolher backup compatível com o
   schema da tag; restaurar inclui o histórico `_prisma_migrations`.
2. Confirmar usuário/banco, integridade, dados e chave de revelação correspondente.
   Não iniciar a API da tag sobre um banco com migrações posteriores incompatíveis.
3. Seguir a [implantação](implantacao-oracle.md), primeiro API e depois frontend.
   O script precisa da rotina externa de backup mesmo na primeira implantação.
   Não há imagem anterior para rollback em uma VM vazia.
4. Validar migrações, saúde, isolamento de rede, proxy e fluxos funcionais. Restaurar
   PostgreSQL não restaura o Firebase; testar login real e vínculo pelo UID.
5. Validar uma revelação antiga e conferir contagens contra o registro do backup.
6. Só então liberar o acesso aos operadores/usuários. Registrar commit, dump,
   checksum, versões das imagens, data, perdas desde o backup e resultados.
7. Ensaiar novamente a geração de backup e confirmar que existe cópia recuperável
   fora do disco da VM; configurar essa cópia é uma ação operacional separada.

Código, dump, configuração e chave formam o conjunto recuperável. A tag fixa o
código; imagens base não fixadas por digest podem mudar entre builds. Para
reprodução binária, conservar as imagens/digests aprovados no inventário protegido.
