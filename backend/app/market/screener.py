"""
Stock-idea screener — deterministic, data-only. A curated universe of liquid
NSE large-caps + ETFs is fetched from yfinance in parallel, then bucketed:
  momentum     — strong 6m AND 1y returns
  dip          — well below the 52-week high without a broken 1y trend
  diversifier  — ETFs for balance (index / gold / banking)
Every number shown comes from live market data; no LLM in this path, so
nothing can be hallucinated. Results are cached in-process for CACHE_TTL.
"""

import asyncio
import time

from app.market.service import _summarize_sync

# Liquid NSE large-caps across sectors + broad ETFs. Curated, not exhaustive.
UNIVERSE = {
    "RELIANCE.NS": "Reliance Industries",
    "TCS.NS": "TCS",
    "HDFCBANK.NS": "HDFC Bank",
    "ICICIBANK.NS": "ICICI Bank",
    "INFY.NS": "Infosys",
    "ITC.NS": "ITC",
    "LT.NS": "Larsen & Toubro",
    "BHARTIARTL.NS": "Bharti Airtel",
    "SBIN.NS": "State Bank of India",
    "HINDUNILVR.NS": "Hindustan Unilever",
    "SUNPHARMA.NS": "Sun Pharma",
    "MARUTI.NS": "Maruti Suzuki",
    "TITAN.NS": "Titan",
    "ASIANPAINT.NS": "Asian Paints",
    "BAJFINANCE.NS": "Bajaj Finance",
    "NTPC.NS": "NTPC",
    "TATASTEEL.NS": "Tata Steel",
    "KOTAKBANK.NS": "Kotak Mahindra Bank",
}
ETFS = {
    "NIFTYBEES.NS": "Nifty 50 ETF",
    "GOLDBEES.NS": "Gold ETF",
    "BANKBEES.NS": "Bank Nifty ETF",
    "JUNIORBEES.NS": "Nifty Next 50 ETF",
    "LIQUIDBEES.NS": "Liquid ETF (money market)",
}

CACHE_TTL = 30 * 60  # seconds
_cache: dict = {"at": 0.0, "rows": None}


async def _fetch_universe() -> list[dict]:
    if _cache["rows"] is not None and time.time() - _cache["at"] < CACHE_TTL:
        return _cache["rows"]
    symbols = {**UNIVERSE, **ETFS}
    results = await asyncio.gather(
        *(asyncio.to_thread(_summarize_sync, sym) for sym in symbols)
    )
    rows = []
    for sym, res in zip(symbols, results):
        if res.get("error") or res.get("last_price") is None:
            continue
        r = res["returns_pct"]
        rows.append({
            "symbol": sym.replace(".NS", ""),
            "name": symbols[sym],
            "is_etf": sym in ETFS,
            "price": res["last_price"],
            "ret_6m": r.get("6m"),
            "ret_1y": r.get("1y"),
            "off_high_pct": res["pct_below_52w_high"],
        })
    _cache.update(at=time.time(), rows=rows)
    return rows


def _note(row: dict) -> str:
    parts = []
    if row["ret_6m"] is not None:
        parts.append(f"{row['ret_6m']:+.0f}% in 6m")
    if row["ret_1y"] is not None:
        parts.append(f"{row['ret_1y']:+.0f}% in 1y")
    parts.append(f"{row['off_high_pct']:.0f}% off 52w high")
    return " · ".join(parts)


TOTAL_SLOTS = 6

HORIZON_LABEL = {"short": "<3 years", "medium": "3-7 years", "long": ">7 years"}


def _allocate_slots(profile: dict, by_asset_type: dict, total_invested: float):
    """How many of the 6 slots go to equity (momentum+dip) vs diversifiers,
    plus human-readable reasons. Deterministic and explainable on purpose."""
    factors = []
    age = (profile or {}).get("age")
    horizon = (profile or {}).get("horizon")

    # Age -> equity capacity (younger = longer runway to absorb volatility)
    if age is None:
        equity = 4
    elif age < 35:
        equity = 4
        factors.append(f"Age {age} — a long runway favors equity, so most slots go to stocks")
    elif age <= 50:
        equity = 3
        factors.append(f"Age {age} — balanced split between stocks and diversifiers")
    else:
        equity = 2
        factors.append(f"Age {age} — capital stability weighted, diversifiers get more slots")

    # Horizon nudges the split
    if horizon == "long":
        equity = min(equity + 1, 5)
        factors.append(f"Investment horizon {HORIZON_LABEL['long']} — one extra equity slot")
    elif horizon == "short":
        equity = max(equity - 1, 1)
        factors.append(f"Investment horizon {HORIZON_LABEL['short']} — shifted one slot to stable diversifiers")

    # Concentration check: one asset type dominating forces diversifiers
    if total_invested > 0 and by_asset_type:
        top_type, top_val = max(by_asset_type.items(), key=lambda kv: kv[1])
        share = top_val / total_invested
        if share > 0.7 and equity > TOTAL_SLOTS - 2:
            equity = TOTAL_SLOTS - 2
            factors.append(f"Portfolio is {share:.0%} {top_type} — diversifier slots forced up to balance it")

    return equity, TOTAL_SLOTS - equity, factors


async def stock_ideas(
    owned_names: list[str] | None = None,
    profile: dict | None = None,
    by_asset_type: dict | None = None,
    total_invested: float = 0,
    surplus: float | None = None,
) -> dict:
    """Personalized bucketed ideas + an explanation of why these were picked."""
    rows = await _fetch_universe()
    owned_upper = [n.upper() for n in (owned_names or [])]

    def owned(row):
        return any(
            row["symbol"] in n or n in row["symbol"] or row["name"].upper() in n or n in row["name"].upper()
            for n in owned_upper
        )

    equity_slots, div_slots, factors = _allocate_slots(profile or {}, by_asset_type or {}, total_invested)
    n_momentum = (equity_slots + 1) // 2
    n_dips = equity_slots // 2

    stocks = [r for r in rows if not r["is_etf"]]
    etfs = [r for r in rows if r["is_etf"]]

    momentum = sorted(
        (r for r in stocks if (r["ret_6m"] or 0) >= 8 and (r["ret_1y"] or 0) >= 12),
        key=lambda r: r["ret_6m"] or 0, reverse=True,
    )[:n_momentum]
    dips = sorted(
        (r for r in stocks if r["off_high_pct"] >= 15 and (r["ret_1y"] or 0) > -10 and r not in momentum),
        key=lambda r: r["off_high_pct"], reverse=True,
    )[:n_dips]

    # Gold first among diversifiers when the portfolio has no gold exposure
    has_gold = any("GOLD" in t.upper() for t in (by_asset_type or {}))
    etfs_sorted = sorted(etfs, key=lambda r: (("GOLD" in r["symbol"]) and not has_gold, r["ret_1y"] or 0), reverse=True)
    diversifiers = etfs_sorted[:div_slots]
    if not has_gold and any("GOLD" in d["symbol"] for d in diversifiers):
        factors.append("No gold in your portfolio — Gold ETF prioritized as an equity hedge")

    if surplus is not None and surplus > 0:
        factors.append(f"Monthly surplus ≈ ₹{surplus:,.0f} after spending and SIPs — that's the deployable amount")

    def pack(row, tag):
        return {**row, "tag": tag, "note": _note(row), "owned": owned(row)}

    ideas = (
        [pack(r, "momentum") for r in momentum]
        + [pack(r, "dip") for r in dips]
        + [pack(r, "diversifier") for r in diversifiers]
    )
    return {
        "ideas": ideas,
        "personalized": bool(profile),
        "why": {
            "factors": factors,
            "criteria": {
                "momentum": "at least +8% over 6 months AND +12% over 1 year",
                "dip": "15%+ below the 52-week high with the 1-year trend not broken (> -10%)",
                "diversifier": "broad ETFs (index / gold / banking) for balance",
                "universe": f"{len(UNIVERSE)} liquid NSE large-caps + {len(ETFS)} ETFs, live market data",
            },
        },
        "as_of": None,  # filled by the router so the cache stays timestamp-free
        "disclaimer": "Data-driven screen of liquid NSE names — educational, not investment advice.",
    }
