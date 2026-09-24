# Torneio de Banco de Dados

Projeto final de Banco de Dados: 8 equipes, 8 temas, mata-mata com votação da turma.

Dois aplicativos:

- **`apps/torneio`** — roda só no seu computador (projetado na sala): console estilo `psql` pra digitar/corrigir o SQL dos itens, e as telas do mata-mata.
- **`apps/alunos`** — site público onde cada equipe entra com a senha impressa, digita e testa o SQL do exercício, e envia. Você recebe tudo em `/admin`.

Os dois usam PostgreSQL de verdade no navegador ([PGlite](https://pglite.dev/)) — os erros e mensagens são os do Postgres.

## 1. Preparar

Precisa de [Node.js](https://nodejs.org/) (LTS) instalado. Funciona em Windows e Linux.

```bash
npm install
```

Depois desse passo, o app do torneio funciona **sem internet**.

## 2. App do torneio (uso em sala)

```bash
npm run torneio
```

Abre em `http://localhost:5173`. Deixe essa aba projetada.

- Uma aba por tema, com console estilo `psql` (`\dt`, `\d tabela`, `\?`, `clear`, histórico com ↑/↓).
- Selecione a **equipe que está indicando** no topo antes de cadastrar o item dela.
- **Cadastro rápido**: em vez de digitar os dois `INSERT` na mão, tem um formulário com a estrutura do comando já pronta — só preenche os valores que mudam (o nome do "pai" e o nome do item) e clica em "Cadastrar item". Ele roda os `INSERT`s de verdade (aparecem no console, igual se tivesse digitado) e já atribui à equipe ativa.
- Do lado do formulário tem uma caixinha pra **colar uma imagem** (Ctrl+V) e ajudar a identificar o item — não faz parte do banco pedido aos alunos, é só um apoio visual seu, guardado no navegador. A miniatura aparece na vaga, nos cards do confronto, no projetor e no card de campeão.
- O painel da direita mostra as 8 vagas do tema; quando as 8 estiverem preenchidas, o botão **"Iniciar mata-mata"** libera.
- Aba **Mata-mata**: sorteia o chaveamento; em cada confronto pronto, cada lado tem um contador de votos com botões **+1 voto** / **−1** (bom pra ir contando mão levantada), um botão **Vencedor** pra decidir na mão, e **"Definir vencedor pelos votos"** pra decidir pela contagem atual (empate pede escolha manual). Tem **modo projetor** em tela cheia com os mesmos controles, em fonte grande. Depois dos 8 temas terem campeão, libera a **Final geral**.
- Aba **Ranking**: soma os votos que os itens de cada equipe receberam em todos os confrontos (de todos os temas e da final geral, ganhando ou perdendo) e mostra quem "escolheu" os itens mais votados da turma.
- **Modo demonstração** (topo): preenche as vagas vazias com dados fictícios, pra você testar o chaveamento sem digitar tudo.
- **Exportar/Importar backup**: salva tudo (linhas das tabelas + estado do torneio) num `.json`. Use antes de fechar o notebook ou pra levar pra outra máquina. **As imagens coladas não vão no backup** (ficam só no navegador) — importar um backup limpa as imagens locais, pra não sobrar imagem antiga grudada num item novo que caia no mesmo id.
- **Reiniciar tudo**: apaga as linhas do banco (PGlite), o estado do torneio (equipes/chaveamentos/votos) e as imagens coladas. Fica tudo com confirmação antes, mas **sem volta** — exporte um backup antes se tiver dúvida.

Tudo fica salvo no navegador (IndexedDB para o banco e o estado, localStorage para as imagens); recarregar a página não perde nada. Se limpar os dados do navegador, perde — exporte backups com frequência.

## 3. Site dos alunos (local)

Pra testar localmente com a API funcionando de verdade (login, envio, `/admin`), use o Wrangler (emula a Cloudflare):

```bash
npm run alunos:pages
```

Isso builda o site e sobe em `http://localhost:8788` com a API, a KV e os segredos locais.

Antes de usar pela primeira vez, copie os segredos de exemplo:

```bash
cp apps/alunos/.dev.vars.example apps/alunos/.dev.vars
```

E edite `apps/alunos/.dev.vars` com:

- `SENHAS_EQUIPES`: JSON `{ "Nome da Equipe": "senha", ... }` — os nomes de equipe têm que ser exatamente os de `shared/themes.ts`, as senhas são as impressas no papel do exercício.
- `ADMIN_SENHA`: a senha que você vai usar em `/admin` (diferente das senhas de equipe).
- `TOKEN_SEGREDO`: qualquer string longa e aleatória (só precisa gerar uma vez).

`apps/alunos/.dev.vars` nunca é commitado (está no `.gitignore`).

Só pra ver a tela sem a API (design/verificação visual rápida), dá pra usar `npm run alunos` (Vite puro, mais rápido, mas login/envio não funcionam).

### Fluxo do aluno

1. Escolhe a equipe, digita a senha impressa (maiúscula/minúscula e espaços nas pontas não importam).
2. Vê só o nome da equipe, o tema e uma caixa de texto SQL — sem enunciado na tela (ele é impresso, de propósito).
3. **Testar**: roda o script num PGlite novo no navegador e mostra erro (se houver), o resultado do último `SELECT` e uma checklist ✓/✗ (sem revelar os nomes exigidos).
4. **Enviar**: manda pra você mesmo com erro. Pode reenviar — vale o último, os anteriores ficam guardados.

### `/admin`

Login com a `ADMIN_SENHA`. Mostra as 8 equipes (enviou / não enviou / com erro), o SQL de cada uma (texto puro — copiar, baixar `.sql`, "Testar aqui"), e "Baixar todos (.zip)".

## 4. Testes

```bash
npm test
```

Roda os testes de: DDL/consulta dos 8 temas, checklist do `schema-check`, autenticação (senha, limite de tentativas, token expirado, token não vaza entre equipes), varredura do build em busca de senhas esquecidas, e lógica do chaveamento.

## 5. Publicar o site dos alunos (Cloudflare Pages)

**Gratuito, sem cartão de crédito, sem conta para os alunos.** Faça isso só quando estiver pronto pra divulgar o link — nada aqui roda sozinho, você decide quando executar cada comando.

### 5.1 Criar a conta e logar o Wrangler

1. Crie uma conta grátis em [dash.cloudflare.com/sign-up](https://dash.cloudflare.com/sign-up).
2. Na raiz do projeto:
   ```bash
   npx wrangler login
   ```
   Abre o navegador pra você autorizar.

### 5.2 Criar o espaço de dados (KV)

```bash
cd apps/alunos
npx wrangler kv namespace create TORNEIO_KV
```

O comando imprime um `id`. Copie esse `id` e cole em `apps/alunos/wrangler.toml`, no lugar de `troque_pelo_id_real_da_kv_antes_de_publicar`:

```toml
[[kv_namespaces]]
binding = "TORNEIO_KV"
id = "cole_o_id_aqui"
```

### 5.3 Criar o projeto Pages

```bash
npx wrangler pages project create torneio-bd-alunos
```

Aceite o branch de produção padrão (`main`) quando perguntado.

### 5.4 Configurar as senhas (secrets)

Nunca vão para o código — ficam só na Cloudflare. Rode cada comando, cole o valor quando pedir:

```bash
npx wrangler pages secret put SENHAS_EQUIPES --project-name torneio-bd-alunos
# cole o JSON: {"Nome da Equipe":"senha", ...}

npx wrangler pages secret put ADMIN_SENHA --project-name torneio-bd-alunos
# cole a senha do /admin

npx wrangler pages secret put TOKEN_SEGREDO --project-name torneio-bd-alunos
# cole uma string longa e aleatória (pode gerar com: openssl rand -hex 32)
```

### 5.5 Build e deploy

Ainda dentro de `apps/alunos`:

```bash
npm run build
npx wrangler pages deploy dist --project-name torneio-bd-alunos
```

O comando imprime a URL final (algo como `https://torneio-bd-alunos.pages.dev`). Esse é o link que você passa pros alunos.

### 5.6 Conferir a KV no projeto publicado

Se `/api/entrar` dar erro 500 depois do deploy, é sinal de que a KV não foi vinculada automaticamente:
No painel da Cloudflare → seu projeto Pages → **Settings → Bindings → Add → KV namespace** → variável `TORNEIO_KV` → selecione o namespace criado no passo 5.2 → salve (isso já redeploya).

### 5.7 Pra publicar uma atualização depois

Sempre que mudar algo em `apps/alunos` ou em `shared/`:

```bash
cd apps/alunos
npm run build
npx wrangler pages deploy dist --project-name torneio-bd-alunos
```

### Trocar uma senha depois

Só troque o secret (o resto do sistema não depende do valor):

```bash
npx wrangler pages secret put SENHAS_EQUIPES --project-name torneio-bd-alunos
```

### Se a rede da escola bloquear o site

Alternativa simples: crie um [Google Forms](https://forms.google.com) com um campo "Equipe" (lista) e um campo de texto longo "Cole aqui o seu SQL". As respostas caem numa planilha que você acompanha em tempo real — sem precisar de servidor. É menos automático que o `/admin` (sem checklist, sem teste no navegador), mas funciona em qualquer rede.

## 6. Estrutura

```
shared/themes.ts        # temas, equipes, DDL, consultas — fonte única usada pelos 2 apps
shared/schema-check.ts  # valida o script do aluno contra o schema esperado
shared/sql-split.ts     # separa um texto em comandos SQL completos
shared/types.ts         # tipos compartilhados entre front-end e Functions do site dos alunos
apps/torneio/           # app local (Vite + TS + PGlite)
apps/alunos/            # site dos alunos (Vite + TS) + functions/ (API e /admin na Cloudflare)
.env.example            # nota: app do torneio não usa segredo nenhum; aponta pra onde eles ficam
apps/alunos/.dev.vars.example  # nomes dos segredos do site dos alunos, pra copiar e preencher
```

## 7. O que fica de fora (por enquanto)

Login de alunos individual, votação online pelos alunos, ranking histórico entre turmas, servidor para o app do torneio, e importar o SQL enviado pelos alunos direto no torneio.
