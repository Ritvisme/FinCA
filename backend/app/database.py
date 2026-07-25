import certifi
from motor.motor_asyncio import AsyncIOMotorClient
from app.config import settings

client: AsyncIOMotorClient = None
db = None


async def connect_db():
    global client, db
    client = AsyncIOMotorClient(
        settings.MONGO_URI,
        tlsCAFile=certifi.where(),
        # Fail fast when Atlas is unreachable (M0 pauses when idle) so the
        # agent's fallback answers in ~5s instead of hanging 30s per query.
        serverSelectionTimeoutMS=5000,
    )
    db = client[settings.DB_NAME]
    print(f"✅ Connected to MongoDB: {settings.DB_NAME}")
    await ensure_indexes()


async def ensure_indexes():
    """Create the indexes matching our access patterns. Every query filters by
    client_id (and sorts by date/month), so without these Mongo full-scans the
    collection. create_index is idempotent. Wrapped so a single index failure
    can never block app startup on deploy."""
    try:
        await db["users"].create_index("email")  # login looks users up by email
        await db["expense_transactions"].create_index([("client_id", 1), ("date", -1)])
        await db["expense_budgets"].create_index([("client_id", 1), ("month", -1)])
        await db["invest_holdings"].create_index([("client_id", 1), ("created_at", -1)])
        await db["invest_goals"].create_index([("client_id", 1), ("target_date", 1)])
        await db["invest_sips"].create_index([("client_id", 1), ("start_date", -1)])
        print("✅ Indexes ensured")
    except Exception as e:
        print(f"⚠️  Index creation skipped: {e}")


async def close_db():
    global client
    if client:
        client.close()
        print("🔌 MongoDB connection closed")


def get_db():
    return db
