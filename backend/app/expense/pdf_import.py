"""
Bank-statement PDF import: pdfplumber pulls the raw rows out of the PDF, then
the LLM normalizes them into transactions — bank formats vary too much for
regex alone, and the model also assigns each row a spending category.
Flow: /expense/import/preview (parse, no writes) -> user reviews in the UI
      -> /expense/import/commit (writes selected rows, source="pdf_import").
"""

import io
import json

import pdfplumber
from openai import AsyncOpenAI

from app.config import settings

_client = AsyncOpenAI(base_url="https://api.groq.com/openai/v1", api_key=settings.GROQ_API_KEY)
MODEL = "llama-3.3-70b-versatile"

CATEGORIES = ["Food", "Transport", "Entertainment", "Utilities", "Healthcare",
              "Education", "Shopping", "Subscriptions", "Other"]

# Statements can run long; cap what one LLM call sees.
MAX_CHARS = 9000

NORMALIZE_PROMPT = f"""You convert raw bank-statement rows into structured transactions.

Rules:
- Output STRICT JSON: {{"transactions": [{{"date": "YYYY-MM-DD", "merchant": "...", "amount": 123.45, "type": "debit" | "credit", "category": "..."}}]}}
- Convert every date to YYYY-MM-DD (statements may use DD/MM/YYYY or DD-MM-YY — Indian statements are day-first).
- amount is always a POSITIVE number; "type" says whether money left (debit) or arrived (credit).
- category must be one of: {", ".join(CATEGORIES)}. Pick by merchant (SWIGGY/ZOMATO -> Food, UBER/IRCTC -> Transport, NETFLIX -> Subscriptions...). Credits are category "Other".
- merchant: short human name, cleaned of UPI/NEFT reference noise.
- Skip rows that are not transactions (headers, opening/closing balance, page footers, totals).
- If a row is ambiguous, skip it rather than guessing amounts.
"""


def extract_rows(pdf_bytes: bytes) -> str:
    """All text rows from the PDF, tables flattened with | separators."""
    lines: list[str] = []
    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        for page in pdf.pages:
            tables = page.extract_tables()
            if tables:
                for table in tables:
                    for row in table:
                        cells = [str(c).strip() for c in row if c not in (None, "")]
                        if cells:
                            lines.append(" | ".join(cells))
            else:
                text = page.extract_text() or ""
                lines.extend(l.strip() for l in text.splitlines() if l.strip())
    return "\n".join(lines)


async def normalize_rows(raw_text: str) -> list[dict]:
    """LLM pass: raw statement rows -> clean transaction dicts."""
    if not raw_text.strip():
        return []
    resp = await _client.chat.completions.create(
        model=MODEL,
        messages=[
            {"role": "system", "content": NORMALIZE_PROMPT},
            {"role": "user", "content": raw_text[:MAX_CHARS]},
        ],
        response_format={"type": "json_object"},
        temperature=0.1,
    )
    try:
        data = json.loads(resp.choices[0].message.content)
    except json.JSONDecodeError:
        return []
    out = []
    for t in data.get("transactions", []):
        try:
            out.append({
                "date": str(t["date"])[:10],
                "merchant": str(t.get("merchant") or "Unknown")[:60],
                "amount": abs(float(t["amount"])),
                "type": "credit" if t.get("type") == "credit" else "debit",
                "category": t.get("category") if t.get("category") in CATEGORIES else "Other",
            })
        except (KeyError, TypeError, ValueError):
            continue  # drop malformed rows instead of failing the whole import
    return out


async def parse_statement(pdf_bytes: bytes) -> dict:
    raw = extract_rows(pdf_bytes)
    txns = await normalize_rows(raw)
    debits = [t for t in txns if t["type"] == "debit"]
    credits = [t for t in txns if t["type"] == "credit"]
    return {
        "transactions": txns,
        "summary": {
            "rows_parsed": len(txns),
            "debits": len(debits),
            "credits": len(credits),
            "total_debit_amount": round(sum(t["amount"] for t in debits), 2),
        },
    }
