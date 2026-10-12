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

> **A connection string contém a senha do banco. Ela nunca pode aparecer na tela.** Não use `Read-Host` comum (ele mostra o que você cola), não cole a string direto num comando, não tire print do terminal enquanto ela estiver na área de transferência. Se ela vazar, troque a senha na Neon (a Vercel recebe a nova sozinha) e faça um **redeploy** do `ak-talent-api`.

Use o script (pede a string **oculta**, mostra só host e banco, pede confirmação e apaga a variável no final):

```powershell
powershell -ExecutionPolicy Bypass -File C:\Projetos\ak-talent\backend\scripts\migrar-producao.ps1
```

Ou, manualmente, com a entrada oculta (`-AsSecureString`) e convertendo para texto só em memória:

```powershell
cd C:\Projetos\ak-talent\backend
$s = Read-Host "Cole a connection string DIRETA da Neon (fica oculta)" -AsSecureString
$b = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($s)
$env:DATABASE_URL = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($b)
[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($b); Remove-Variable s, b

# Confira o destino ANTES de migrar (só host e banco; deve ser a Neon, sem -pooler):
.\.venv\Scripts\python.exe -c "from sqlalchemy.engine import make_url; from app.core.config import settings; u = make_url(settings.DATABASE_URL); print('Destino:', u.host, '/', u.database)"

.\.venv\Scripts\python.exe -m app.database.migrate
Remove-Item Env:DATABASE_URL
```

A variável do terminal tem prioridade sobre o `backend/.env` local; mesmo assim, só migre se o "Destino" for a Neon.

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
| `VITE_WHATSAPP_URL` | WhatsApp comercial do botão "Quero contratar": `https://wa.me/` + 55 + DDD + número, só dígitos (ex.: `https://wa.me/5541999999999`). Sem ela, o botão abre um e-mail para contato@aktalent.com.br |
| `VITE_COMPANY_PORTAL_ENABLED` | `false` (ou ausente): a empresa não usa o sistema (seção H) |
| `VITE_APPINTELLI_SCREENING_ENABLED` | `false` (ou ausente). Só mude para `true` depois da verificação da seção F |

Domínio: `aktalent.com.br` redireciona para `www.aktalent.com.br`. Ambos estão em `BACKEND_CORS_ORIGINS`.

Validar: `https://www.aktalent.com.br/vagas` deve mostrar vagas ou "Nenhuma vaga aberta agora" (nunca "Não conseguimos carregar as vagas agora").

Previews da Vercel não falam com a API de produção (CORS fechado de propósito). Para liberar no futuro: `BACKEND_CORS_ORIGIN_REGEX=^https://ak-talents-[a-z0-9]+-patriccecilios-projects\.vercel\.app$` no `ak-talent-api` (atenção: previews passariam a usar o banco de produção).

---

## C) Primeiro admin (no SEU terminal)

Atalho (recomendado): o script `backend/scripts/criar-admin.ps1` pede a connection string, limpa aspas, `-pooler` e `channel_binding`, mostra o destino, pede confirmação, roda o `create_admin` e apaga a variável no final:

```powershell
powershell -ExecutionPolicy Bypass -File C:\Projetos\ak-talent\backend\scripts\criar-admin.ps1
```

Ou, manualmente (entrada oculta, como na A5; nunca `Read-Host` comum):

```powershell
cd C:\Projetos\ak-talent\backend
$s = Read-Host "Cole a connection string DIRETA da Neon (fica oculta)" -AsSecureString
$b = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($s)
$env:DATABASE_URL = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($b)
[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($b); Remove-Variable s, b
.\.venv\Scripts\python.exe -m app.scripts.create_admin
Remove-Item Env:DATABASE_URL
```

**Onde a equipe entra:** admin em `https://www.aktalent.com.br/equipe`; recrutadores em `https://www.aktalent.com.br/recrutamento`. Nenhuma das duas aparece em menus ou no rodapé, e nenhuma é indexada (meta `noindex` + cabeçalho `X-Robots-Tag`). Quem usa a porta do outro entra na própria área, com um aviso. Candidatos entram por `/entrar` (o "Entrar" do topo); empresas não entram (seção H).

O script pede a connection string oculta e mostra só o banco de destino (sem a senha): confira que é a Neon antes de confirmar com `s`. Depois pede nome, e-mail e senha (oculta, mínimo 12, digitada duas vezes). Recrutadores: pelo `/admin` ("Equipe de recrutamento") ou `python -m app.scripts.create_recruiter`.

---

## D) Limitações conhecidas em serverless

- **Rate limiting**: os contadores ficam na memória de cada instância da função. Com várias instâncias ou após a função "dormir", o limite fica mais frouxo (vale por instância). Continua barrando abuso simples. **Troca futura**: Upstash Redis (pelo Vercel Marketplace) e `storage_uri` no `Limiter` em `backend/app/core/rate_limit.py`.
- **Conexões**: a API não mantém pool próprio na Vercel (`NullPool`); o pool é o PgBouncer da Neon (`DATABASE_URL`).
- **Primeiro acesso**: depois de um tempo sem uso, a primeira requisição pode demorar alguns segundos (cold start da função e do banco Neon, que "dorme" no plano Free).

---

## E) Teste manual de 15 minutos em produção

Use dados claramente de teste ("TESTE AK"). Celular para a parte pública e para o candidato; computador para empresa e AK.

1. **Admin** (computador): `/admin` → **Nova empresa** "TESTE AK Mercado" (nome e WhatsApp) → **Nova vaga** "TESTE Operador de Caixa" para ela, status **Publicada** (salário mínimo menor que o máximo). A vaga aparece em `/vagas` na hora.
2. Em "Equipe de recrutamento", criar uma recrutadora de teste e escolhê-la como responsável na vaga (**Editar**).
3. **Candidato** (celular): `/register` → Candidato → aceitar política.
4. Ainda logado, em `/candidate`, achar a vaga e tocar **Candidatar-se**. (A candidatura precisa ser feita **logado**: pelo formulário público ela não aparece na conta, por segurança.)
5. Em `/candidate`, "Minhas candidaturas" mostra **Recebida**.
6. **Recrutadora**: entrar por `/recrutamento` (vai para `/recrutador`) → abrir o pipeline → no candidato, **Mover para… → Em triagem** e depois **→ Entrevista AK** (com observação). O candidato passa a ver **Entrevista**.
7. **Mover para… → Enviado ao cliente** (parecer obrigatório, 2 linhas). Mandar o relatório ao cliente pelo WhatsApp (fora do sistema).
8. **Recrutadora**: quando o cliente responder, **Mover para… → Cliente aprovou**, escrevendo o que ele respondeu (obrigatório).
9. **Candidato**: vê **Na etapa final**.
10. **Recrutadora**: no detalhe, o histórico mostra "Resposta do cliente: aprovou. …". **Mover para… → Contratado**.
11. **Candidato**: vê **"Parabéns, você foi selecionado(a)!"**.
12. Público: `/vagas/vaga-que-nao-existe` → "Esta vaga não está mais disponível". `/privacidade` abre.
    Numa vaga aberta, **deslogado** (celular): **Candidatar-se** rola até o formulário com o cursor no "Nome completo". Enviar → vaga sem perguntas: "Candidatura enviada!" na hora; vaga com perguntas: as perguntas aparecem na página e, depois de "Concluir candidatura", a mesma confirmação. Nenhum chat abre sozinho. Em `/recrutador`, a candidatura aparece em **Nova** (sem perguntas: "Sem perguntas de triagem").
13. **Limpeza**: `/admin` → **Desativar** a empresa e o candidato de teste (a vaga some do site; nada é apagado).

Se algo falhar: anote o passo e o horário, e veja **Vercel → ak-talent-api → Logs**.

---

## F) Chat de triagem do AppIntelli (opcional, desligado)

Hoje as perguntas da vaga são respondidas **na própria página**. Com `VITE_APPINTELLI_SCREENING_ENABLED=true`, a etapa de perguntas ganha o link "Prefere responder conversando? Abrir o chat". O chat nunca abre sozinho. Ele recebe só a referência da candidatura (sem nome, e-mail ou telefone) e precisa buscar as perguntas e devolver as respostas na nossa API:

- `GET https://ak-talent-api.vercel.app/integrations/appintelli/applications/{referencia}/screening`
- `POST https://ak-talent-api.vercel.app/integrations/appintelli/applications/{referencia}/screening/answers`
- ambos com o cabeçalho `Authorization: Bearer <APPINTELLI_INTEGRATION_SECRET>` (o mesmo valor na API e no painel do AppIntelli; sem ele, 401).

**Ligue a flag só depois de ver o AppIntelli chamando a nossa API.** Se o chat não fizer essas chamadas, o candidato conversa, mas nada chega à AK, e a candidatura fica com "Triagem não respondida".

1. Crie (ou use) uma vaga de teste **com** perguntas. Candidate-se pelo site, deslogado, com o DevTools aberto (aba **Network**). Na resposta do `POST /jobs/.../applications`, copie o `application_reference`. Não precisa responder as perguntas.
2. Confira o nosso lado (no SEU terminal; o segredo não fica no histórico):
   ```powershell
   $s = Read-Host "APPINTELLI_INTEGRATION_SECRET" -AsSecureString
   $b = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($s)
   $t = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($b)
   [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($b)
   curl.exe -s -H "Authorization: Bearer $t" https://ak-talent-api.vercel.app/integrations/appintelli/applications/REFERENCIA/screening
   Remove-Variable s, b, t
   ```
   Deve voltar JSON com a vaga e as perguntas. `401`: o segredo da API não é esse (ou não está configurado).
3. No painel do AppIntelli, teste a triagem com essa referência (ou peça ao suporte deles). Em seguida, olhe os logs:
   ```powershell
   vercel logs --project ak-talent-api --environment production --no-branch --since 30m
   ```
   O que precisa aparecer: `GET /integrations/appintelli/applications/<ref>/screening` **200** e, depois das respostas, `POST .../screening/answers` **200**. Em `/recrutador`, a candidatura mostra o resultado da triagem.
   - Nenhuma linha `/integrations/...`: o AppIntelli não está chamando a nossa API. **Não ligue a flag.**
   - `401`: segredo diferente dos dois lados. `404`: referência errada.
4. Só então: no projeto **ak-talents** (site), Production, `VITE_APPINTELLI_SCREENING_ENABLED=true` (não é segredo, pode ser tipo normal) e **redeploy**. Repita o teste pelo celular, agora tocando em "Abrir o chat", e confira os mesmos logs.
5. Para desligar: volte para `false` (ou apague a variável) e faça redeploy. As perguntas na página continuam funcionando com a flag ligada ou desligada.

---

## G) Login com Google (candidatos e empresas)

Fluxo de **ID token por redirect** (Google Identity Services, `ux_mode: 'redirect'`, em todos os navegadores — o popup travava numa aba branca no celular):

1. O botão leva a pessoa ao Google, que volta com um POST para `https://www.aktalent.com.br/auth/google/retorno/{candidato|empresa}` (com o cookie `g_csrf_token`, gravado no domínio do site).
2. O `frontend/vercel.json` repassa para `https://ak-talent-api.vercel.app/auth/google/redirect/{porta}`.
3. A API confere o CSRF (cookie = campo do formulário), a assinatura, a audience (= nosso Client ID), o emissor, a validade e o e-mail verificado.
4. A API responde 303 para `/entrar/google?codigo=…` (código de uso único, 60 s; só o hash fica no banco, tabela `login_codes`) ou `?consentimento=…` (conta nova, 15 min; a conta só é criada depois do aceite). Erros voltam para `/entrar/{porta}?erro=…`.

O JWT nunca vai na URL. **Não existe segredo de cliente** nesse fluxo — só o Client ID, que é público.

- Aparece em `/entrar/candidato`, `/entrar/empresa` e `/register`. **Nunca em `/equipe`**: a equipe entra só com e-mail e senha.
- Conta nova: o papel vem da porta (candidato ou empresa) e a pessoa aceita a Política antes de criar a conta.
- Conta existente com o mesmo e-mail: passa a entrar com o Google; a **senha antiga deixa de funcionar** e as sessões antigas caem. Contas da equipe nunca são vinculadas ("Use o acesso da equipe em /equipe.").
- No login com Google, candidaturas feitas pelo formulário público com o mesmo e-mail passam para a conta.

### G1. Google Cloud Console (uma vez)

1. https://console.cloud.google.com → seletor de projetos (topo) → **Novo projeto** → nome `AK Talent` → Criar. Confira que ele ficou selecionado.
2. **APIs e serviços → Tela de permissão OAuth** (pode aparecer como "Google Auth Platform → Branding"):
   - Tipo de usuário: **Externo**.
   - Nome do app: `AK Talent`; e-mail de suporte: o seu.
   - Logo: `ak-talent-logo-google-120.png` (120×120; gerada do ícone oficial). Opcional — com logo, o Google pode pedir verificação da marca, o que só muda a exibição da logo.
   - Página inicial: `https://www.aktalent.com.br`; Política de privacidade: `https://www.aktalent.com.br/privacidade`.
   - Domínios autorizados: `aktalent.com.br`.
   - Escopos ("Acesso a dados"): **só** `openid`, `.../auth/userinfo.email` e `.../auth/userinfo.profile` (não exigem verificação do Google).
   - Público-alvo: **Publicar aplicativo** (status "Em produção"). Em "Teste", só os e-mails de teste conseguem entrar.
3. **APIs e serviços → Credenciais → Criar credenciais → ID do cliente OAuth** (ou "Clientes → Criar cliente"):
   - Tipo: **Aplicativo da Web**; nome: `AK Talent site`.
   - **Origens JavaScript autorizadas**: `https://www.aktalent.com.br`, `https://aktalent.com.br` e `http://localhost:5173`.
   - **URIs de redirecionamento autorizados** (exatamente estas quatro):
     - `https://www.aktalent.com.br/auth/google/retorno/candidato`
     - `https://www.aktalent.com.br/auth/google/retorno/empresa`
     - `http://localhost:5173/auth/google/retorno/candidato`
     - `http://localhost:5173/auth/google/retorno/empresa`
   - Criar → copie o **ID do cliente** (`....apps.googleusercontent.com`). O "segredo do cliente" **não é usado**: não copie para lugar nenhum.

### G2. Variáveis (Production) e redeploy

O Client ID é público (vai no navegador): **não** marque como Sensitive.

| Projeto | Variável | Valor |
|---|---|---|
| `ak-talent-api` | `GOOGLE_CLIENT_ID` | o ID do cliente |
| `ak-talents` | `VITE_GOOGLE_CLIENT_ID` | o mesmo ID do cliente |

Depois de criar, **redeploy** dos dois (a `VITE_*` entra no build do site). Sem a variável, o botão some do site e `POST /auth/google` responde 503 — é assim que se desliga o recurso.

### G3. Banco

As migrações `0012_google_sign_in` (só aditiva: `email_verified_at`, `google_sub`, `sessions_valid_after`; senha passa a aceitar vazio) e `0013_login_codes` (tabela nova dos códigos de uso único do redirect) precisam estar aplicadas **antes** do deploy da API: `backend/scripts/migrar-producao.ps1` (seção A5).

A API redireciona para `FRONTEND_URL` (padrão `https://www.aktalent.com.br`); só mude essa variável se o domínio do site mudar.

### G4. Conferir

- `/entrar/candidato` e o cadastro mostram "Continuar com o Google", inclusive no celular; `/equipe` e `/recrutamento` não.
- Depois do Google, a barra de endereço passa por `/entrar/google` sem ficar com o código (a URL é limpa na hora).
- Conta Google nova pela porta de candidato → pede o aceite → cai em `/candidate`. A porta de empresa está fechada (seção H): o Google pela empresa volta para `/entrar` com o aviso.
- E-mail que já tinha conta com senha → entra pelo Google; a senha antiga passa a responder "Esta conta usa o login com Google. Toque em Entrar com Google."

---

## H) Empresa fora do sistema (a AK opera tudo)

A empresa cliente não usa mais a plataforma. A AK cadastra a empresa, abre e opera as vagas e envia o resultado pelo WhatsApp. O portal antigo da empresa continua no código, desligado por flag. Nenhum dado foi apagado.

- **Flags:** `COMPANY_PORTAL_ENABLED` (API) e `VITE_COMPANY_PORTAL_ENABLED` (site). Padrão: desligadas, sem precisar criar variável. Desligadas, não há cadastro nem login de empresa (senha ou Google), sessões de empresa já abertas são recusadas e `/entrar/empresa` e `/company` levam a `/entrar` com o aviso. Para religar o portal, crie as duas como `true` e faça redeploy dos dois projetos.
- **"Quero contratar"** (em `/entrar` e no cadastro): abre `VITE_WHATSAPP_URL` com uma mensagem pronta; sem a variável, abre um e-mail.
- **Banco:** a migração `0014_internal_companies` precisa estar aplicada **antes** do deploy da API (`backend/scripts/migrar-producao.ps1`, seção A5). Ela deixa `companies.user_id` opcional, cria `cnpj`, `contact_email`, `notes` e `is_active` (copiado da conta de cada empresa) e converte as vagas `pending` → `draft` (Rascunho) e `hidden` → `closed` (Encerrada).
- **Admin (`/admin`):** empresas (nova, editar, desativar) e vagas (nova, editar, Publicar, Encerrar) com recrutador e status. A vaga criada pela AK não passa por aprovação.
- **Pipeline:** Nova → Em triagem → Entrevista AK → Enviado ao cliente (parecer obrigatório) → Aprovado pelo cliente → Contratado; saídas Reprovado e Desistiu. A resposta do cliente é registrada pela recrutadora, com observação obrigatória, no histórico. As candidaturas existentes mantêm as etapas e o histórico.

### H0. Painel novo (/painel), migração 0015

O painel novo da equipe é construído ao lado do atual (`/admin` e `/recrutador` continuam funcionando até a troca final). A migração `0015_panel_data` precisa estar aplicada **antes** do deploy da API que traz `/panel/*` (`backend/scripts/migrar-producao.ps1`, seção A5). Ela só acrescenta: tipo das anotações (os pareceres e as respostas do cliente já registrados viram anotações "Parecer" e "Retorno do cliente"), datas de publicação e encerramento das vagas, origem e autorização do candidato cadastrado à mão, marca de dados excluídos e a tabela `data_deletion_log` (quem excluiu dados de candidato e quando, sem os dados).

### H1. Conferir

- `/entrar`: "Sou candidato" e "Quero contratar"; `/entrar/empresa` volta para `/entrar` com o aviso.
- Login de uma conta antiga de empresa: aviso "O acesso de empresas foi encerrado…" e nenhuma sessão.
- `/recrutamento` com uma recrutadora → `/recrutador`; com o admin → `/admin` (com aviso).
- `/admin`: criar uma empresa de teste e uma vaga **Publicada** → ela aparece em `/vagas`. Depois, **Desativar** a empresa (a vaga some do site).

---

## Checklist antes de divulgar

- [ ] `/health` da API responde `ok` e a região da função é `gru1`; banco Neon em São Paulo.
- [ ] `JWT_SECRET_KEY` forte (a API não sobe sem ele).
- [ ] Migrações aplicadas (A5) e primeiro admin criado (C).
- [ ] Site com `VITE_API_BASE_URL` e AppIntelli em Production, redeploy feito; `/vagas` sem erro.
- [x] Política de Privacidade preenchida (razão social, CNPJ, e-mail de contato, prazos de retenção, login com Google e relatório enviado pela AK ao cliente; versão 2026-10-12).
- [ ] `VITE_WHATSAPP_URL` com o WhatsApp comercial (botão "Quero contratar").
- [ ] Mensagem de boas-vindas do chat ajustada no painel do AppIntelli.
- [ ] `VITE_APPINTELLI_SCREENING_ENABLED` desligada, a não ser que a verificação F tenha mostrado as chamadas `/integrations/appintelli/...` com 200.
- [ ] Teste de 15 minutos (E) concluído.
