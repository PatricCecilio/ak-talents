# AK Talent API on Render

The full, up-to-date deploy guide (Render, Vercel, first admin and smoke test) is in
[`../DEPLOY.md`](../DEPLOY.md).

Quick reference:

- Root directory: `backend`
- Build: `pip install -r requirements.txt`
- Start: `python -m app.database.migrate && uvicorn app.main:app --host 0.0.0.0 --port $PORT --proxy-headers --forwarded-allow-ips="*"`
- Health check: `/health`
- First admin: `python -m app.scripts.create_admin` (never use the seed in production)
