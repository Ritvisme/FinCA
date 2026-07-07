"""
Market data via yfinance (free, no auth). Sync yfinance calls are pushed to a
thread so they don't block the event loop. NSE symbols get a ".NS" suffix
automatically ("RELIANCE" -> "RELIANCE.NS"); indices (^NSEI) and pairs
(USDINR=X) pass through untouched.
"""

import asyncio

import yfinance as yf

# Benchmarks that give the agent market context for suggestion questions.
BENCHMARKS = {
    "^NSEI": "Nifty 50",
    "GOLDBEES.NS": "Gold ETF (GoldBeES)",
    "USDINR=X": "USD/INR",
}


def _normalize(symbol: str) -> str:
    s = symbol.strip().upper()
    if s.startswith("^") or "=" in s or "." in s:
        return s
    return f"{s}.NS"


def _summarize_sync(symbol: str) -> dict:
    t = yf.Ticker(symbol)
    hist = t.history(period="1y")
    if hist.empty:
        return {"symbol": symbol, "error": "no data — check the ticker symbol"}

    # yfinance can return NaN rows (holidays / partial sessions) — NaN is
    # invalid JSON and would poison the tool payload sent to the model.
    closes = hist["Close"].dropna()
    if closes.empty:
        return {"symbol": symbol, "error": "no usable price data"}
    last = float(closes.iloc[-1])

    def ret(days: int):
        if len(closes) <= days:
            return None
        past = float(closes.iloc[-days - 1])
        return round((last - past) / past * 100, 1)

    high, low = float(closes.max()), float(closes.min())
    return {
        "symbol": symbol,
        "last_price": round(last, 2),
        "returns_pct": {"1m": ret(21), "6m": ret(126), "1y": ret(len(closes) - 1)},
        "52w_high": round(high, 2),
        "52w_low": round(low, 2),
        "pct_below_52w_high": round((high - last) / high * 100, 1),
    }


async def summarize_symbol(symbol: str) -> dict:
    return await asyncio.to_thread(_summarize_sync, _normalize(symbol))


async def market_overview() -> dict:
    results = await asyncio.gather(
        *(asyncio.to_thread(_summarize_sync, sym) for sym in BENCHMARKS)
    )
    return {BENCHMARKS[sym]: res for sym, res in zip(BENCHMARKS, results)}
