# Deploy da AK Talent (Fase 0)

Passo a passo para colocar o **backend no Render** e o **site na Vercel**, criar o **primeiro admin** e fazer um **teste rápido em produção**.

> Regras de ouro
> - Nunca coloque senhas, chaves ou URLs de banco em arquivos do repositório. Elas vão **só** nos painéis do Render e da Vercel.
> - Nunca rode `python -m app.database.seed` em produção. Ele cria contas de teste com senhas fracas e agora se recusa a rodar fora do ambiente local.
> - Pontos marcados com **(confirme no painel)** dependem do seu plano no Render ou na Vercel e podem ter mudado. Confira antes de seguir.

---

## Ordem recomendada

1. Render: banco de dados → serviço da API → variáveis → deploy → `/health`.
2. Primeiro admin (seção C).
3. Vercel: variáveis → novo deploy.
4. Teste de 10 minutos (seção D).
5. Só então divulgue a landing.

---

## A) Render: backend (API)

### A1. Banco de dados (PostgreSQL)

1. No Render: **New → PostgreSQL**. Use a mesma região que vai usar para a API.
2. Depois de criado, guarde as duas URLs que o Render mostra:
   - **Internal Database URL**: usada pela API dentro do Render;
   - **External Database URL**: usada só quando você rodar comandos do seu computador (seção C, opção 2).
3. **(confirme no painel)** No plano gratuito, o banco do Render pode expirar depois de um período. Para receber candidatos de verdade, use um plano pago do banco.

### A2. Serviço da API

Há duas opções:

- **Blueprint (recomendado):** **New → Blueprint**, escolha este repositório. O Render lê o `render.yaml` da raiz e cria o serviço `ak-talent-api` com os comandos certos.
- **Serviço já existente ou criado à mão:** abra o serviço e confira em **Settings**:

| Campo | Valor |
|---|---|
| Root Directory | `backend` |
| Build Command | `pip install -r requirements.txt` |
| Start Command | `python -m app.database.migrate && uvicorn app.main:app --host 0.0.0.0 --port $PORT --proxy-headers --forwarded-allow-ips="*"` |
| Health Check Path | `/health` |

O Start Command faz duas coisas:
- **Atualiza o banco a cada deploy.** Num banco vazio, cria todas as tabelas; num banco existente, aplica as migrações novas. Por isso você não precisa de Shell nem de "pre-deploy command", que **(confirme no painel)** podem não existir no plano gratuito.
- **Usa o IP real de cada visitante** (`--proxy-headers`). Sem isso, o limite de tentativas (rate limiting) trataria todo mundo como uma pessoa só.

**(confirme no painel)** No plano gratuito, o serviço "dorme" quando fica sem acesso e o primeiro visitante pode esperar perto de um minuto. Com tráfego pago, prefira um plano que não durma.

### A3. Variáveis de ambiente (Environment)

Configure no serviço da API. **Só os nomes estão aqui; os valores ficam no painel.**

| Variável | O que colocar |
|---|---|
| `PYTHON_VERSION` | `3.12.10` (já vem do `render.yaml`) |
| `ENVIRONMENT` | `production` |
| `AUTO_CREATE_TABLES_ON_STARTUP` | `false` |
| `DATABASE_URL` | A **Internal Database URL** do passo A1. Se ela começar com `postgres://`, tudo bem: o sistema ajusta sozinho. |
| `JWT_SECRET_KEY` | Um segredo aleatório com **pelo menos 32 caracteres** (veja abaixo). Sem ele, a API **se recusa a subir**. |
| `BACKEND_CORS_ORIGINS` | `https://aktalent.com.br,https://www.aktalent.com.br` |
| `APPINTELLI_INTEGRATION_SECRET` | O mesmo segredo configurado do lado do AppIntelli para a integração de triagem |
| `OPENAI_API_KEY` | Opcional. Só para os assistentes de IA dos painéis de candidato e empresa. Sem ela, a IA mostra "indisponível". |
| `OPENAI_MODEL` | Opcional. Nome de um modelo válido da sua conta OpenAI (o padrão do código pode não existir na sua conta). |
| `BACKEND_CORS_ORIGIN_REGEX` | **Deixe sem valor.** Ver "Previews da Vercel" abaixo. |
| `RATE_LIMIT_ENABLED` | Não precisa criar. O padrão é ligado. |

**Como gerar o `JWT_SECRET_KEY`** (no seu computador, com Python instalado):

```bash
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

Copie o resultado direto para o painel do Render. Não salve em arquivo nem mande por chat. Se um dia trocar esse valor, todos os usuários precisarão entrar de novo.

### A4. Deploy e conferência

1. Faça o deploy: **Manual Deploy → Deploy latest commit**, ou deixe o deploy automático rodar.
2. Nos **Logs**, procure uma destas linhas:
   - `Banco criado do zero e marcado na versão mais recente.` (primeiro deploy, banco vazio), ou
   - `Banco atualizado (alembic upgrade head).` (deploys seguintes).
3. Se aparecer `JWT_SECRET_KEY inválido para produção`, corrija a variável (A3) e faça o deploy de novo.
4. Abra no navegador `https://SEU-SERVICO.onrender.com/health`. O esperado é:

```json
{"status":"ok","service":"AK Talent API"}
```

5. Anote a URL do serviço (`https://SEU-SERVICO.onrender.com`). Ela é o `VITE_API_BASE_URL` da Vercel. Se configurar um domínio próprio para a API (ex.: `api.aktalent.com.br`), use esse domínio.

### A5. Previews da Vercel (opção futura, hoje desligada)

Hoje a API só aceita chamadas de `aktalent.com.br` e `www.aktalent.com.br`. Os links de preview da Vercel (`ak-talents-xxxx-patriccecilios-projects.vercel.app`) **não** conseguem falar com a API de produção. Isso é intencional.

Para liberar os previews no futuro, crie no Render:

```
BACKEND_CORS_ORIGIN_REGEX = ^https://ak-talents-[a-z0-9]+-patriccecilios-projects\.vercel\.app$
```

Atenção: os previews passariam a usar o **banco de produção**. Para testes que gravam dados, o ideal é um backend e um banco separados de staging.

---

## B) Vercel: site (frontend)

As variáveis `VITE_*` são gravadas no site **no momento do build**. Depois de criar ou alterar qualquer uma delas, é preciso fazer um **novo deploy** para valer.

### B1. Variáveis

Em **Project → Settings → Environment Variables**:

| Variável | Production | Preview | Valor |
|---|---|---|---|
| `VITE_API_BASE_URL` | ✅ | ✅ | URL da API do passo A4, **sem barra no final** (ex.: `https://SEU-SERVICO.onrender.com`) |
| `VITE_APPINTELLI_WIDGET_URL` | ✅ | ✅ | `https://www.appintelli.com.br/widget.js` |
| `VITE_APPINTELLI_WIDGET_KEY` | ✅ | ✅ | A chave do widget no painel do AppIntelli |
| `VITE_WHATSAPP_URL` | ✅ | ✅ | Opcional. Formato `https://wa.me/55DDDNUMERO`. Sem ela, o aviso "Novas vagas em breve" aparece sem o botão de WhatsApp. |

Lembrete: nos previews, o site vai carregar, mas a API vai recusar as chamadas enquanto o A5 estiver desligado. Em preview, a Home mostra "Novas vagas em breve" e o `/vagas` mostra "Não conseguimos carregar as vagas agora". Isso é esperado.

### B2. Domínio

Em **Settings → Domains**, confirme que `aktalent.com.br` e `www.aktalent.com.br` apontam para este projeto. Os dois precisam ser exatamente os que estão em `BACKEND_CORS_ORIGINS`.

### B3. Novo deploy e validação

1. **Deployments → (último deploy de produção) → Redeploy**, ou publique um novo commit na branch de produção.
2. Abra `https://www.aktalent.com.br/vagas` e confira:
   - ✅ aparecem vagas **ou** "Nenhuma vaga aberta agora": a API respondeu;
   - ❌ aparece "Não conseguimos carregar as vagas agora": a API não respondeu. Confira `VITE_API_BASE_URL`, se a API está no ar (`/health`) e o `BACKEND_CORS_ORIGINS`.
3. Abra `https://www.aktalent.com.br/privacidade`. A página precisa abrir. Confira se os placeholders (`[RAZÃO SOCIAL]` etc.) já foram preenchidos.
4. Na Home, clique em **Conversar com a AK Talent**: o chat do AppIntelli precisa abrir.

---

## C) Primeiro usuário admin (sem usar o seed)

Use o comando seguro `python -m app.scripts.create_admin`:
- pede nome e e-mail;
- lê a senha duas vezes sem mostrá-la na tela (mínimo de 12 caracteres);
- mostra em qual banco vai gravar (sem mostrar a senha do banco);
- pede confirmação antes de criar.

### Opção 1: Shell do Render (se o seu plano tiver)

No serviço da API: **Shell** e então:

```bash
python -m app.scripts.create_admin
```

### Opção 2: pelo seu computador (funciona em qualquer plano)

Você precisa do Python e das dependências do backend instalados (`pip install -r backend/requirements.txt`, de preferência num ambiente virtual). No **PowerShell**:

```powershell
cd C:\Projetos\ak-talent\backend
$env:AKTALENT_ENV_FILE = ""                       # ignora o .env local
$env:DATABASE_URL = "COLE-AQUI-A-EXTERNAL-DATABASE-URL"
python -m app.scripts.create_admin
Remove-Item Env:DATABASE_URL                      # apaga a URL da sessão ao terminar
Remove-Item Env:AKTALENT_ENV_FILE
```

Confira se a linha "Banco de dados: ..." mostra o host do Render antes de confirmar com `s`.

Depois, entre em `https://www.aktalent.com.br/login` com o e-mail e a senha do admin.

> Se a API ainda não subiu nenhuma vez, as tabelas não existem. Faça primeiro o deploy do passo A4, ou rode `python -m app.database.migrate` com a mesma `DATABASE_URL`.

---

## D) Teste manual de 10 minutos em produção

Use um **celular** para a parte pública e um **computador** para o admin. Use dados claramente de teste (ex.: nome "TESTE AK").

**Preparação (computador, ~3 min)**
1. Abra `/register`, escolha **Empresa**, marque a Política de Privacidade e crie a conta `teste-empresa+data@seu-dominio`.
2. Entre com essa conta, crie uma vaga simples (ex.: "TESTE AK - Atendente").
3. Em outra janela anônima, entre como **admin** → **Vagas** → **Aprovar** a vaga de teste.

**Como candidato (celular, ~4 min)**
4. Abra `aktalent.com.br`. Confira o topo, a rolagem e a logo.
5. Toque em **Conversar com a AK Talent**: o chat abre e fecha sem cobrir a tela inteira.
6. Vá em **Vagas** → abra a vaga de teste.
7. Toque em **Candidatar-se**, preencha com dados de teste e confira que o link **Política de Privacidade** abre em outra aba. Marque o aceite e envie.
8. Confira a mensagem "Candidatura recebida com sucesso" e o início da triagem (chat AppIntelli ou perguntas na página).

**Conferência (computador, ~3 min)**
9. Admin → **Candidaturas**: a candidatura de teste aparece com nome, telefone e status da triagem.
10. Na conta da empresa de teste → **Suas vagas** → **Ver candidatos inscritos**: aparece **só** o candidato de teste.
11. Abra `https://www.aktalent.com.br/vagas/uma-vaga-que-nao-existe`: deve aparecer "Esta vaga não está mais disponível".
12. Limpeza: no admin, **Ocultar** a vaga de teste. (Ainda não existe botão para apagar empresa ou candidato de teste no painel. Anote os e-mails usados para removê-los depois.)

Se algum passo falhar, anote o passo, o horário e um print, e confira os **Logs** do serviço no Render.

---

## Checklist antes de divulgar a landing

- [ ] `/health` da API responde `ok`.
- [ ] `JWT_SECRET_KEY` forte configurado (a API não sobe sem ele).
- [ ] Vercel com `VITE_API_BASE_URL` e AppIntelli em Production, e redeploy feito.
- [ ] Primeiro admin criado com `create_admin` (nunca com o seed).
- [ ] Política de Privacidade com `[RAZÃO SOCIAL]`, `[CNPJ]`, `[E-MAIL DE CONTATO DE PRIVACIDADE]` e `[PRAZO DE RETENÇÃO]` preenchidos (arquivo `frontend/src/pages/PrivacyPage.tsx`), de preferência revisada por um advogado.
- [ ] `VITE_WHATSAPP_URL` configurada, se quiser o botão de WhatsApp no aviso de "Novas vagas em breve".
- [ ] Mensagem de boas-vindas do chat ajustada no painel do AppIntelli (hoje pode aparecer "Equipe indisponível no momento").
- [ ] Teste de 10 minutos (seção D) concluído no celular.
