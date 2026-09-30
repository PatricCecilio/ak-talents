from fastapi import APIRouter

from app.api.routes import admin, ai, applications, auth, candidates, companies, integrations, jobs, public

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(jobs.router, prefix="/jobs", tags=["jobs"])
api_router.include_router(applications.router, prefix="/applications", tags=["applications"])
api_router.include_router(ai.router, prefix="/ai", tags=["ai"])
api_router.include_router(candidates.router, prefix="/candidates", tags=["candidates"])
api_router.include_router(companies.router, prefix="/companies", tags=["companies"])
api_router.include_router(admin.router, prefix="/admin", tags=["admin"])
api_router.include_router(public.router, prefix="/public", tags=["public"])
api_router.include_router(integrations.router, prefix="/integrations", tags=["integrations"])
