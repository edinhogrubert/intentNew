# Fluxo entre GitHub e VM

## Fonte e branches

Repositório: `edinhogrubert/Intent`. A base consolidada é a `main` no commit
`62e78cc040afc08e13c44e2fd943134643e05231`, tag anotada `mvp-1.0.0`.
Esta etapa altera somente cinco documentos na branch
`docs/operacao-recuperacao-mvp`, criada da `main` atual consultada no GitHub.
Não usar `devin`, não trabalhar diretamente na `main` e não fazer merge automático.

GitHub guarda código e migrações; a VM guarda configuração, credenciais, dados e
imagens. Um `git pull` não implanta containers nem restaura banco. O checkout na
VM pode ficar em detached HEAD no commit aprovado; registrar essa escolha.
A Deploy Key da VM deve ser somente leitura. Alterações saem do ambiente de
trabalho, são revisadas e só então promovidas para implantação.

## Conferir e alinhar a VM

Executar como proprietário do checkout, com acesso Git já configurado:

```bash
cd /opt/intent/source
git status --porcelain
git branch --show-current
git remote get-url origin
git fetch origin main --tags
git rev-parse HEAD
git rev-parse origin/main
git ls-remote origin refs/heads/main
git log --oneline --left-right HEAD...origin/main
```

O remoto deve identificar `edinhogrubert/Intent`, sem token embutido. Se houver
alterações locais, parar e revisá-las em ambiente seguro; não executar reset,
clean ou push forçado. Se houver commits exclusivos da VM, preservar e revisar
antes de alinhar. Não enviar configurações da VM ao GitHub para resolver divergência.

Para implantar uma main aprovada, definir `APPROVED_COMMIT` com o hash completo
revisado e somente prosseguir se a referência consultada corresponder a ele:

```bash
: "${APPROVED_COMMIT:?Defina o commit aprovado}"
test -z "$(git status --porcelain)"
test "$(git rev-parse origin/main)" = "$APPROVED_COMMIT"
git switch --detach "$APPROVED_COMMIT"
test "$(git rev-parse HEAD)" = "$APPROVED_COMMIT"
```

Se qualquer teste falhar, não executar os comandos seguintes. O checkout por
hash evita acompanhar alterações remotas que ocorram depois da aprovação.
Executar [implantação e validação](implantacao-oracle.md) apenas quando a mudança
exigir reconstruir a aplicação. Esta etapa exclusivamente documental não exige
reiniciar containers, aplicar migrações ou mudar configurações da VM.
Para provar a versão em execução, registrar também os IDs das imagens e os
resultados de implantação: o HEAD sozinho não identifica um container já criado.

## Selecionar o MVP para recuperação

```bash
cd /opt/intent/source
git fetch origin main --tags
test -z "$(git status --porcelain)"
test "$(git cat-file -t refs/tags/mvp-1.0.0)" = tag
test "$(git rev-parse 'mvp-1.0.0^{commit}')" = 62e78cc040afc08e13c44e2fd943134643e05231
git switch --detach mvp-1.0.0
git rev-parse HEAD
git ls-remote --tags origin mvp-1.0.0 'mvp-1.0.0^{}'
```

Executar de forma sequencial e interromper em qualquer falha. O objeto anotado
registrado é `c1ba305d9c7bf8474f88defb3429f8aa1e756cb1`; a linha com `^{}` deve
apontar ao commit consolidado. Não recriar ou mover a tag em caso de divergência.
Selecionar código não reverte migrações: continuar com
[backups e rollback](backups-e-rollback.md) ou
[recuperação completa](recuperacao-completa.md).

## O que nunca versionar

- `.env` reais, ambiente runtime, senhas PostgreSQL e URLs com credenciais.
- JSON Firebase Admin, chaves privadas SSH, Deploy Keys, tokens GitHub/Firebase,
  cookies de sessão e credenciais de nuvem.
- `REVEAL_ENCRYPTION_KEY`, dumps, cópias de volumes, dados pessoais e backups de Redis.
- Logs, HAR, capturas ou saídas de diagnóstico com autenticação ou dados privados.
- Pacotes de recuperação que incluam qualquer um desses elementos.

Manter modelos apenas com placeholders. O `.gitignore` atual ignora `.env*`, mas
não cobre automaticamente todos os dumps, JSON e chaves: revisar os caminhos e
o diff antes de adicionar arquivos. Não usar `git add .` na VM. Não publicar
`docker compose config` ou `docker inspect` completos, que podem revelar ambiente.
Se um segredo entrar no Git, removê-lo do último arquivo não basta: interromper
publicação, revogar/rotacionar pelo procedimento autorizado e tratar o histórico.

## Revisão desta etapa

Validar os cinco Markdown, os links relativos, espaços e escopo do diff; procurar
segredos e revisar manualmente exemplos. Não copiar valores de arquivos protegidos.
Usar adição explícita dos cinco caminhos e commit com a mensagem:
`docs: registrar operação e recuperação do MVP`.

Mostrar `git diff --stat`, resultados da validação e hash do commit antes de
qualquer decisão de merge. Publicação da branch e revisão podem ocorrer em etapa
posterior; não enviar `main`, não mover `mvp-1.0.0` e não fazer merge automático.
