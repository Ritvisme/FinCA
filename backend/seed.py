"""
Seed realistic test data for a given user.
Usage:  python seed.py <client_id>
"""

import asyncio
import sys
from datetime import date

from app.database import connect_db, close_db
from app.expense.service import create_transaction, create_or_update_budget
from app.invest.service import create_sip, create_goal


MONTH = date.today().strftime("%Y-%m")


async def seed(client_id: str):
    print(f"Seeding for {client_id} in {MONTH}...\n")

    # 1. Budget — gives the agent something to evaluate against
    await create_or_update_budget(
        client_id=client_id,
        month=MONTH,
        income=80000,
        allocations={
            "Food": 8000,
            "Transport": 3000,
            "Entertainment": 4000,
            "Utilities": 6000,
            "Shopping": 5000,
            "Healthcare": 2000,
        },
    )
    print("  budget set: income ₹80,000 with 6 category limits")

    # 2. Transactions across categories — including one overspend pattern
    txns = [
        ("Food", 450, "Swiggy", "Late-night biryani", f"{MONTH}-02"),
        ("Food", 1200, "Empire", "Dinner with Priya", f"{MONTH}-05"),
        ("Food", 380, "Starbucks", "Coffee", f"{MONTH}-07"),
        ("Food", 2400, "BigBasket", "Groceries", f"{MONTH}-08"),
        ("Food", 1850, "Zomato", "Office lunches", f"{MONTH}-12"),
        ("Food", 720, "Swiggy", "Late-night biryani", f"{MONTH}-14"),
        ("Food", 2300, "BigBasket", "Groceries", f"{MONTH}-15"),
        # Food is now ~₹9,300 — over the ₹8,000 budget (intentional, so agent has a story)

        ("Transport", 380, "Uber", "Airport drop", f"{MONTH}-03"),
        ("Transport", 220, "Rapido", None, f"{MONTH}-09"),

        ("Utilities", 5800, "Landlord", "Rent", f"{MONTH}-01"),

        ("Entertainment", 800, "BookMyShow", "Movie tickets", f"{MONTH}-06"),
        ("Entertainment", 1500, "Spotify+Netflix", "Subscriptions", f"{MONTH}-01"),

        ("Shopping", 4200, "Amazon", "New headphones", f"{MONTH}-10"),
        ("Shopping", 1800, "Myntra", "T-shirts", f"{MONTH}-13"),
        # Shopping ₹6,000 — also over ₹5,000

        ("Healthcare", 350, "Pharmacy", "Cold meds", f"{MONTH}-11"),
    ]
    for cat, amt, merchant, desc, dt in txns:
        await create_transaction(
            client_id=client_id, amount=amt, category=cat,
            merchant=merchant, description=desc, txn_date=dt, source="seed",
        )
    print(f"  {len(txns)} transactions added")

    # 3. One active SIP — gives the agent investment context
    await create_sip(
        client_id=client_id, name="Nifty 50 Index",
        amount=5000, frequency=30, start_date=f"{MONTH}-01",
    )
    print("  1 active SIP: ₹5,000/mo into Nifty 50 Index")

    # 4. One savings goal — agent can comment on pace
    await create_goal(
        client_id=client_id, name="Emergency Fund",
        target_amount=300000, target_date="2027-12-01", current_amount=45000,
    )
    print("  1 goal: Emergency Fund (₹45k / ₹3L by Dec 2027)")

    print("\nDone — ready to run the insights agent.")


async def main():
    if len(sys.argv) != 2:
        print(__doc__)
        return
    await connect_db()
    try:
        await seed(sys.argv[1])
    finally:
        await close_db()


asyncio.run(main())
