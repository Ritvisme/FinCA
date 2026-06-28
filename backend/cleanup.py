"""
Cleanup utility for FinCA's MongoDB.

Usage (run from backend/ with the venv active):
    python cleanup.py stats                          # show counts per collection
    python cleanup.py list-users                     # list all users with IDs
    python cleanup.py wipe-user <email>              # delete a user + ALL their data
    python cleanup.py clear <collection>             # empty a single collection
    python cleanup.py nuke                           # wipe EVERYTHING (asks twice)
"""

import asyncio
import sys
from motor.motor_asyncio import AsyncIOMotorClient
import certifi
from app.config import settings

COLLECTIONS = [
    "users",
    "expense_transactions",
    "expense_budgets",
    "invest_holdings",
    "invest_goals",
    "invest_sips",
]

USER_OWNED = [c for c in COLLECTIONS if c != "users"]


async def get_db():
    client = AsyncIOMotorClient(settings.MONGO_URI, tlsCAFile=certifi.where())
    return client[settings.DB_NAME], client


async def stats():
    db, client = await get_db()
    print(f"\nDatabase: {settings.DB_NAME}\n" + "-" * 40)
    for c in COLLECTIONS:
        count = await db[c].count_documents({})
        print(f"  {c:<25} {count:>6}")
    print()
    client.close()


async def list_users():
    db, client = await get_db()
    users = await db["users"].find({}, {"password_hash": 0}).sort("created_at", 1).to_list(length=500)
    print(f"\n{len(users)} users:\n" + "-" * 80)
    for u in users:
        print(f"  {u['_id']}  {u.get('email','?'):<35} role={u.get('role','client')}  name={u.get('name','—')}")
    print()
    client.close()


async def wipe_user(email: str):
    db, client = await get_db()
    user = await db["users"].find_one({"email": email})
    if not user:
        print(f"No user with email {email}")
        client.close()
        return
    user_id = user["_id"]
    print(f"\nAbout to delete user {email} ({user_id}) and ALL their data.")
    if input("Type 'yes' to confirm: ").strip() != "yes":
        print("Aborted.")
        client.close()
        return
    total = 0
    for c in USER_OWNED:
        r = await db[c].delete_many({"client_id": user_id})
        if r.deleted_count:
            print(f"  removed {r.deleted_count} from {c}")
            total += r.deleted_count
    await db["users"].delete_one({"_id": user_id})
    print(f"\nDeleted user + {total} owned documents.")
    client.close()


async def clear(collection: str):
    if collection not in COLLECTIONS:
        print(f"Unknown collection: {collection}. Choose from: {', '.join(COLLECTIONS)}")
        return
    db, client = await get_db()
    count = await db[collection].count_documents({})
    print(f"\nAbout to delete ALL {count} documents in '{collection}'.")
    if input("Type 'yes' to confirm: ").strip() != "yes":
        print("Aborted.")
        client.close()
        return
    r = await db[collection].delete_many({})
    print(f"Deleted {r.deleted_count} documents.")
    client.close()


async def nuke():
    db, client = await get_db()
    print("\n!! This will WIPE ALL DATA in every FinCA collection. !!")
    if input("Type the database name to confirm: ").strip() != settings.DB_NAME:
        print("Aborted.")
        client.close()
        return
    if input("Type 'I am sure' to proceed: ").strip() != "I am sure":
        print("Aborted.")
        client.close()
        return
    for c in COLLECTIONS:
        r = await db[c].delete_many({})
        print(f"  cleared {c}: {r.deleted_count}")
    print("\nAll clear.")
    client.close()


def main():
    args = sys.argv[1:]
    if not args:
        print(__doc__)
        return
    cmd = args[0]
    if cmd == "stats":
        asyncio.run(stats())
    elif cmd == "list-users":
        asyncio.run(list_users())
    elif cmd == "wipe-user" and len(args) == 2:
        asyncio.run(wipe_user(args[1]))
    elif cmd == "clear" and len(args) == 2:
        asyncio.run(clear(args[1]))
    elif cmd == "nuke":
        asyncio.run(nuke())
    else:
        print(__doc__)


if __name__ == "__main__":
    main()
