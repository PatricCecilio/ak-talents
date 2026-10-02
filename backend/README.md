# AK Talent Backend

FastAPI backend for AK Talent recruitment MVP.

## Stack

- FastAPI
- PostgreSQL
- SQLAlchemy
- JWT authentication

## Setup

From `ak-talent/backend`:

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
```

Configure `OPENAI_API_KEY` in `.env` to enable Career AI and Recruiter AI.
`OPENAI_MODEL` can be changed without code edits.

## Environment

Default local `.env`:

```env
ENVIRONMENT="development"
DATABASE_URL="postgresql+psycopg2://aktalent:aktalent@localhost:5432/aktalent"
AUTO_CREATE_TABLES_ON_STARTUP=true
JWT_SECRET_KEY="change-this-secret-in-production"
BACKEND_CORS_ORIGINS="http://localhost:5173,http://127.0.0.1:5173"
OPENAI_API_KEY=""
OPENAI_MODEL="gpt-5.5"
```

## PostgreSQL

From `ak-talent`, start PostgreSQL:

```bash
docker compose up -d postgres
```

## Reset development database

From `ak-talent/backend`:

```bash
python -m app.database.reset_db
```

This command refuses to run unless `DATABASE_URL` points to `localhost`, `127.0.0.1`, or SQLite.

## Seed

From `ak-talent/backend`:

```bash
python -m app.database.seed
```

The seed is idempotent and can be run multiple times without duplicating users, profiles, jobs, or applications.

Test accounts:

```text
Admin: admin@aktalent.com / admin123
Empresa: empresa@teste.com / empresa123
Candidato: candidato@teste.com / candidato123
```

The seeded company and seeded job are already `approved`.

## Run backend

From `ak-talent/backend`:

```bash
uvicorn app.main:app --reload
```

API docs:

```text
http://127.0.0.1:8000/docs
```

## Database migrations

Alembic is the schema authority for production databases:

```bash
alembic upgrade head
```

`Base.metadata.create_all(bind=engine)` is still available for local startup by default, but it is disabled whenever `ENVIRONMENT="production"` or `AUTO_CREATE_TABLES_ON_STARTUP=false`.

## Render preparation

Use the backend directory as the service root.

Build command:

```bash
pip install -r requirements.txt
```

Start command:

```bash
uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

Health check path:

```text
/health
```

Required environment variables should be configured in Render without committing real values:

```env
ENVIRONMENT="production"
AUTO_CREATE_TABLES_ON_STARTUP=false
DATABASE_URL="replace-with-render-postgres-url"
JWT_SECRET_KEY="replace-with-secure-secret"
BACKEND_CORS_ORIGINS="replace-with-frontend-origin"
OPENAI_API_KEY="replace-if-ai-features-are-enabled"
APPINTELLI_INTEGRATION_SECRET="replace-with-secure-shared-secret"
```

Run migrations against the production database as a separate release/setup step:

```bash
alembic upgrade head
```

## Run frontend

From `ak-talent/frontend`:

```bash
npm.cmd install
npm.cmd run dev
```

Frontend URL:

```text
http://127.0.0.1:5173
```

## Local validation flow

1. Start PostgreSQL with Docker Compose.
2. Run `python -m app.database.reset_db`.
3. Run `python -m app.database.seed`.
4. Start backend with `uvicorn app.main:app --reload`.
5. Start frontend with `npm.cmd run dev`.
6. Login as admin and open `/admin`.
7. Approve pending companies and pending jobs created during manual testing.
8. Login as empresa and create a new job.
9. Login as admin again and approve the new job.
10. Login as candidato, view the approved job, and apply.
11. Login as empresa and use "Ver candidatos compatíveis" on the approved job.
