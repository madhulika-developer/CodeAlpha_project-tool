import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from backend.database import engine, Base, SessionLocal
from backend.seed_data import seed_database
from backend.routes import (
    auth_routes,
    project_routes,
    column_routes,
    task_routes,
    comment_routes,
    notification_routes,
    ws_routes
)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: create tables and seed demo data
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        seed_database(db)
    finally:
        db.close()
    yield

app = FastAPI(
    title="SyncFlow - Collaborative Project Management",
    description="Full-stack collaborative project management system with real-time WebSockets",
    version="1.0.0",
    lifespan=lifespan
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API Routers
app.include_router(auth_routes.router)
app.include_router(project_routes.router)
app.include_router(column_routes.router)
app.include_router(task_routes.router)
app.include_router(comment_routes.router)
app.include_router(notification_routes.router)
app.include_router(ws_routes.router)

# Frontend static files
frontend_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend")

if os.path.exists(frontend_dir):
    app.mount("/static", StaticFiles(directory=frontend_dir), name="static")

    @app.get("/")
    async def serve_index():
        return FileResponse(os.path.join(frontend_dir, "index.html"))

    @app.get("/favicon.ico")
    async def favicon():
        return FileResponse(os.path.join(frontend_dir, "index.html"))
