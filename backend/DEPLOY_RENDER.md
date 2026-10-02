# AK Talent API on Render

This backend is a FastAPI service intended to run as a Render Web Service.

## Runtime

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

## Schema

Alembic is the production source of truth for database schema changes.

Before the first production deploy, run migrations against the production database from `backend/`:

```bash
alembic upgrade head
```

Do not rely on SQLAlchemy `create_all` in production. Set:

```env
ENVIRONMENT=production
AUTO_CREATE_TABLES_ON_STARTUP=false
```

Local development may keep the default `AUTO_CREATE_TABLES_ON_STARTUP=true`.

## Required production environment

Use real values in Render environment variables, not in the repository:

```env
ENVIRONMENT=production
DATABASE_URL=
JWT_SECRET_KEY=
BACKEND_CORS_ORIGINS=https://www.aktalent.com.br
AUTO_CREATE_TABLES_ON_STARTUP=false
```

Optional or feature-specific:

```env
OPENAI_API_KEY=
OPENAI_MODEL=
APPINTELLI_INTEGRATION_SECRET=
```
