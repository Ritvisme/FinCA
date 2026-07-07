from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
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

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
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