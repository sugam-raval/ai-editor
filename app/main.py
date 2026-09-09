import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from app.api.routes import router
from app.config import settings

# Configure logging
logging.basicConfig(
    level=getattr(logging, settings.log_level.upper(), logging.INFO),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("AI Template Editor server starting up...")
    logger.info(f"Environment: {settings.environment}")
    logger.info(f"Model: {settings.openai_model_name}")
    logger.info(f"OpenAI Key configured: {bool(settings.openai_api_key)}")
    yield
    logger.info("AI Template Editor server shutting down...")


app = FastAPI(
    title="AI Template Editor Backend",
    description=(
        "Production-grade FastAPI server for AI-driven template editing using "
        "LangGraph, LangChain tool calling, and token-optimized JSON pruning."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# Enable CORS for frontend canvas integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routes
app.include_router(router)

# Mount static directory for UI studio
app.mount("/static", StaticFiles(directory="static"), name="static")
app.mount("/tests", StaticFiles(directory="tests"), name="tests")


@app.get("/", include_in_schema=False)
async def serve_ui():
    return FileResponse("static/index.html")


