# Deploy da AK Talent (Vercel + Neon)

Passo a passo para publicar o **site** e a **API** na Vercel, com o banco **Postgres na Neon**, criar o **primeiro admin** e fazer um **teste rápido em produção**.

> O caminho antigo pelo Render foi abandonado (os arquivos `render.yaml` e `backend/DEPLOY_RENDER.md` foram removidos; o histórico está no Git).

> Regras de ouro
> - Nunca coloque senhas, chaves ou URLs de banco em arquivos do repositório (ele é **público**). Segredos vão **só** nas variáveis da Vercel.
> - Nunca rode `python -m app.database.seed` em produção (ele se recusa a rodar fora do ambiente local).
> - Migrações **não** rodam na subida da API (serverless). Rode-as do seu computador, uma vez por mudança de banco.

---

## Visão geral

| Parte | Onde | Projeto / recurso | Pasta raiz | Região |
|---|---|---|---|---|
| Site (React/Vite) | Vercel | `ak-talents` | `frontend` | CDN global |
| API (FastAPI) | Vercel | `ak-talent-api` | `backend` | `gru1` (São Paulo), fixada em `backend/vercel.json` |
| Banco (Postgres) | Neon, pelo Vercel Marketplace | ligado ao `ak-talent-api` | — | **AWS São Paulo (`aws-sa-east-1`)** |

**A API e o banco precisam ficar na mesma região** (latência a cada consulta). Se São Paulo não estiver disponível para um dos dois, escolha a região mais próxima comum aos dois antes de criar qualquer coisa.

Push na `main` publica automaticamente os dois projetos (site e API) em produção.

---

## A) API: projeto `ak-talent-api`

### A1. Projeto e Git
1. O projeto `ak-talent-api` é ligado à pasta `backend` (CLI: `vercel link` dentro de `backend/`).
2. No painel: **ak-talent-api → Settings → Git** → conectar o repositório `PatricCecilio/ak-talents`, com **Root Directory = `backend`**.
3. **Settings → Functions → Function Region** deve mostrar **São Paulo (gru1)** (vem do `vercel.json`).

A Vercel detecta o FastAPI sozinha: `app/main.py` com `app = FastAPI(...)`, dependências do `requirements.txt`, Python 3.12 (`.python-version`).

### A2. Banco Neon (painel)
1. **Vercel → Storage / Marketplace → Neon → Install** → *Create New Neon Account* → aceite os termos.
2. **Região: São Paulo (AWS sa-east-1)**. Plano: Free para começar.
3. Conecte o banco ao projeto **`ak-talent-api`** (pelo menos o ambiente **Production**).
4. A Neon cria no projeto, entre outras, `DATABASE_URL` (com pool, para a API) e `DATABASE_URL_UNPOOLED` (direta, para migrações).

### A3. Variáveis de ambiente (Production)

| Variável | Valor | Quem configura |
|---|---|---|
| `DATABASE_URL` | criada pela Neon (com pool) | automático |
| `ENVIRONMENT` | `production` | CLI |
| `BACKEND_CORS_ORIGINS` | `https://aktalent.com.br,https://www.aktalent.com.br` | CLI |
| `TRUST_PROXY_HEADERS` | `true` (IP real do visitante para o limite de tentativas) | CLI |
| `JWT_SECRET_KEY` | segredo aleatório, gerado no seu terminal (A4) | você |
| `APPINTELLI_INTEGRATION_SECRET` | opcional; gerado no seu terminal (A4) e combinado com o AppIntelli | você |
| `OPENAI_API_KEY` / `OPENAI_MODEL` | opcional; sem elas, as telas de IA mostram "indisponível" | você |

Para ver o que já existe: `vercel env ls production --cwd backend`.

### A4. Segredos

> **O que aprendemos no primeiro deploy**
> - **Não use `... | vercel env add` para segredos.** O valor chega vazio ou o comando falha **sem mostrar erro claro**, e nada é gravado (foi o que aconteceu com o `JWT_SECRET_KEY`).
> - A CLI (`vercel env add`) cria variáveis de **Production como Sensitive por padrão**.
> - Variáveis **Sensitive não podem ser lidas de volta** (nem pelo painel, nem pela CLI, nem pela API; o `vercel env pull` traz o valor vazio). Não dá para "copiar" uma Sensitive de um ambiente para outro: é preciso ter o valor original.
> - Depois de criar qualquer variável, **confira** com `vercel env ls production` (na pasta do projeto) antes de seguir.

**`JWT_SECRET_KEY` (recomendado: pelo painel)**
1. No seu terminal, gere o valor: `python -c "import secrets; print(secrets.token_urlsafe(48))"`.
2. **Vercel → ak-talent-api → Settings → Environment Variables → Add**: nome `JWT_SECRET_KEY`, ambiente **Production**, tipo **Sensitive/Secret**, cole o valor e salve.
3. Feche o terminal (o valor não fica em arquivo nem no repositório).

Alternativa pela CLI, sem pipe (na pasta `backend`, que está ligada ao `ak-talent-api`):

```powershell
cd C:\Projetos\ak-talent\backend
$s = python -c "import secrets; print(secrets.token_urlsafe(48), end='')"
vercel env add JWT_SECRET_KEY production --value $s --yes
Remove-Variable s
vercel env ls production    # confira que JWT_SECRET_KEY aparece
```

**`APPINTELLI_INTEGRATION_SECRET`**: o mesmo caminho (painel, tipo Sensitive/Secret, ou `--value`). Gere o valor, **guarde-o** e configure o mesmo valor no painel do AppIntelli.

**Variáveis públicas do site (`VITE_*`)** vão para dentro do JavaScript do site; não faz sentido marcá-las como Sensitive. Para criá-las como `encrypted` (legíveis no painel), use o painel sem marcar Sensitive; a CLI as criaria como Sensitive por padrão.

Depois de mudar variáveis, é preciso um **novo deploy** (ou redeploy) do projeto para valerem.

### A5. Migrações (no SEU terminal, uma vez)

Use a connection string **direta** da Neon: **console.neon.tech → (projeto) → Connect**, com **Connection pooling desligado** (o host **não** tem `-pooler`). Não tente lê-la na Vercel: lá ela é Sensitive.

```powershell
cd C:\Projetos\ak-talent\backend
$env:DATABASE_URL = Read-Host "Cole a connection string DIRETA da Neon (sem -pooler)"

# Confira o destino ANTES de migrar (deve ser o host da Neon, sem -pooler):
.\.venv\Scripts\python.exe -c "from sqlalchemy.engine import make_url; from app.core.config import settings; u = make_url(settings.DATABASE_URL); print('Destino:', u.host, '/', u.database)"

.\.venv\Scripts\python.exe -m app.database.migrate
Remove-Item Env:DATABASE_URL
```

A variável do terminal tem prioridade sobre o `backend/.env` local; mesmo assim, só migre se o "Destino" for a Neon. `Read-Host` evita que a string fique no histórico do terminal.

Banco vazio → "Banco criado do zero e marcado na versão mais recente." Banco existente → "Banco atualizado (alembic upgrade head)."

Se a senha do banco for trocada na Neon, a integração da Vercel atualizou `DATABASE_URL` e `DATABASE_URL_UNPOOLED` sozinha no nosso caso (datas das variáveis mudaram junto); confirme com um `GET /jobs` depois do próximo deploy (200 = senha certa). Para migrações, copie a string direta **nova**.

### A6. Conferir
`https://ak-talent-api.vercel.app/health` → `{"status":"ok","service":"AK Talent API"}`.

---

## B) Site: projeto `ak-talents`

Variáveis em **Production** (as `VITE_*` são gravadas no build: depois de mudar, faça **redeploy**):

| Variável | Valor |
|---|---|
| `VITE_API_BASE_URL` | `https://ak-talent-api.vercel.app` (sem barra no final) |
| `VITE_APPINTELLI_WIDGET_URL` | `https://www.appintelli.com.br/widget.js` |
| `VITE_APPINTELLI_WIDGET_KEY` | chave do widget no painel do AppIntelli |
| `VITE_WHATSAPP_URL` | opcional, `https://wa.me/55DDDNUMERO` |

Domínio: `aktalent.com.br` redireciona para `www.aktalent.com.br`. Ambos estão em `BACKEND_CORS_ORIGINS`.

Validar: `https://www.aktalent.com.br/vagas` deve mostrar vagas ou "Nenhuma vaga aberta agora" (nunca "Não conseguimos carregar as vagas agora").

Previews da Vercel não falam com a API de produção (CORS fechado de propósito). Para liberar no futuro: `BACKEND_CORS_ORIGIN_REGEX=^https://ak-talents-[a-z0-9]+-patriccecilios-projects\.vercel\.app$` no `ak-talent-api` (atenção: previews passariam a usar o banco de produção).

---

## C) Primeiro admin (no SEU terminal)

```powershell
cd C:\Projetos\ak-talent\backend
$env:DATABASE_URL = Read-Host "Cole a connection string DIRETA da Neon"
.\.venv\Scripts\python.exe -m app.scripts.create_admin
Remove-Item Env:DATABASE_URL
```

O script mostra o banco de destino (sem a senha): confira que é a Neon antes de confirmar com `s`. Depois pede nome, e-mail e senha (oculta, mínimo 12, digitada duas vezes). Recrutadores: pelo `/admin` ("Equipe de recrutamento") ou `python -m app.scripts.create_recruiter`.

---

## D) Limitações conhecidas em serverless

- **Rate limiting**: os contadores ficam na memória de cada instância da função. Com várias instâncias ou após a função "dormir", o limite fica mais frouxo (vale por instância). Continua barrando abuso simples. **Troca futura**: Upstash Redis (pelo Vercel Marketplace) e `storage_uri` no `Limiter` em `backend/app/core/rate_limit.py`.
- **Conexões**: a API não mantém pool próprio na Vercel (`NullPool`); o pool é o PgBouncer da Neon (`DATABASE_URL`).
- **Primeiro acesso**: depois de um tempo sem uso, a primeira requisição pode demorar alguns segundos (cold start da função e do banco Neon, que "dorme" no plano Free).

---

## E) Teste manual de 15 minutos em produção

Use dados claramente de teste ("TESTE AK"). Celular para a parte pública e para o candidato; computador para empresa e AK.

1. **Empresa** (computador): `/register` → Empresa → aceitar política → criar a vaga "TESTE Operador de Caixa" (salário mínimo menor que o máximo).
2. **Admin**: `/admin` → **Aprovar** a vaga. Em "Equipe de recrutamento", criar uma recrutadora de teste.
3. **Candidato** (celular): `/register` → Candidato → aceitar política.
4. Ainda logado, em `/candidate`, achar a vaga e tocar **Candidatar-se**. (A candidatura precisa ser feita **logado**: pelo formulário público ela não aparece na conta, por segurança.)
5. Em `/candidate`, "Minhas candidaturas" mostra **Recebida**.
6. **Recrutadora**: entrar (vai para `/recrutador`) → definir-se responsável → abrir o pipeline → no candidato, **Mover para… → Em triagem** e depois **→ Entrevista com a AK** (com observação). O candidato passa a ver **Entrevista**.
7. **Mover para… → Finalista** (parecer obrigatório, 2 linhas).
8. **Empresa**: `/company` → "Finalistas para aprovar (1)", com parecer e **sem** telefone → **Aprovar para entrevista** → o contato aparece em "Aprovados".
9. **Candidato**: vê **Na etapa final**.
10. **Recrutadora**: no detalhe, o histórico mostra "Aprovado pelo cliente (empresa)". **Mover para… → Contratado**.
11. **Candidato**: vê **"Parabéns, você foi selecionado(a)!"**.
12. Público: `/vagas/vaga-que-nao-existe` → "Esta vaga não está mais disponível". `/privacidade` abre.
13. **Limpeza**: `/admin` → **Desativar** a empresa e o candidato de teste (a vaga some do site; nada é apagado).

Se algo falhar: anote o passo e o horário, e veja **Vercel → ak-talent-api → Logs**.

---

## Checklist antes de divulgar

- [ ] `/health` da API responde `ok` e a região da função é `gru1`; banco Neon em São Paulo.
- [ ] `JWT_SECRET_KEY` forte (a API não sobe sem ele).
- [ ] Migrações aplicadas (A5) e primeiro admin criado (C).
- [ ] Site com `VITE_API_BASE_URL` e AppIntelli em Production, redeploy feito; `/vagas` sem erro.
- [ ] Política de Privacidade com `[RAZÃO SOCIAL]`, `[CNPJ]`, `[E-MAIL DE CONTATO DE PRIVACIDADE]` e `[PRAZO DE RETENÇÃO]` preenchidos.
- [ ] Mensagem de boas-vindas do chat ajustada no painel do AppIntelli.
- [ ] Teste de 15 minutos (E) concluído.
