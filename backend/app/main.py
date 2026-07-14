from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from app.config import settings
from app.rate_limit import limiter
from app.database import connect_db, close_db
from app.auth.routes import router as auth_router
from app.expense.router import router as expense_router
from app.invest.router import router as invest_router
from app.admin.router import router as admin_router
from app.agents.router import router as agents_router
from app.market.router import router as market_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_db()
    yield
    await close_db()


app = FastAPI(
    title="FinCA API",
    description="Personal Finance Manager for CA and clients",
    version="1.0.0",
    lifespan=lifespan,
)

# Rate limiter — protects the LLM (Groq) and market endpoints from abuse/cost.
# Per-endpoint limits are applied with @limiter.limit(...) in the routers.
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix="/api/v1")
app.include_router(expense_router, prefix="/api/v1")
app.include_router(invest_router, prefix="/api/v1")
app.include_router(admin_router, prefix="/api/v1")
app.include_router(agents_router, prefix="/api/v1")
app.include_router(market_router, prefix="/api/v1")


@app.get("/")
async def root():
    return {"message": "FinCA API is running"}


@app.get("/health")
async def health():
    return {"status": "ok"}