# FinCA

AI-assisted personal finance manager for Chartered Accountants and their clients.
Track expenses and investments, import bank statements, and get AI-powered financial insights.

## Features

- **Expenses** — transactions, budgets, monthly summaries, and PDF bank-statement import (review before commit)
- **Investments** — holdings, goals, SIPs, investor profiling, and portfolio summary
- **AI advisor** — streaming chat, spending insights, and portfolio review (powered by Groq)
- **Market data** — stock/idea screener via yfinance
- **Auth** — JWT (access + refresh) and Google OAuth
- **Admin** — user management, stats, and per-endpoint rate limiting

## Tech Stack

- **Backend** — FastAPI, MongoDB (Motor), Groq LLM, yfinance
- **Frontend** — React 19, Vite, Tailwind CSS, Zustand, Recharts

## Getting Started

### Prerequisites

- Python 3.10+
- Node.js 18+
- A MongoDB database (e.g. MongoDB Atlas)

### Backend

```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env        # fill in Mongo URI, JWT secrets, and Groq key
uvicorn app.main:app --reload
```

API runs at `http://localhost:8000` — interactive docs at `http://localhost:8000/docs`.

### Frontend

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

App runs at `http://localhost:5173`.

## Environment Variables

Set these in `backend/.env` (see `.env.example` for the full list):

| Variable             | Required | Description                          |
| -------------------- | -------- | ------------------------------------ |
| `MONGO_URI`          | Yes      | MongoDB connection string            |
| `JWT_SECRET`         | Yes      | Secret for signing access tokens     |
| `JWT_REFRESH_SECRET` | Yes      | Secret for signing refresh tokens    |
| `GROQ_API_KEY`       | Yes      | API key for the AI advisor           |
| `CORS_ORIGINS`       | Yes      | Comma-separated allowed frontend URLs |
| `GOOGLE_CLIENT_ID`   | No       | Enables Google OAuth login           |
| `TELEGRAM_BOT_TOKEN` | No       | Enables the Telegram bot             |

## API Overview

All routes are prefixed with `/api/v1`:

| Group      | Purpose                                  |
| ---------- | ---------------------------------------- |
| `/auth`    | Register, login, Google OAuth, refresh   |
| `/expense` | Transactions, budgets, PDF import        |
| `/invest`  | Holdings, goals, SIPs, portfolio         |
| `/agents`  | AI chat, insights, portfolio review      |
| `/market`  | Stock/idea screener                      |
| `/admin`   | User management and stats                |

## Deployment

- **Backend** → Render (see `backend/render.yaml`)
- **Frontend** → Vercel (see `frontend/vercel.json`)

Set your environment variables and CORS origins in each platform's dashboard.

## Project Structure

```
FinCA/
├── backend/    # FastAPI app (auth, expense, invest, agents, market, admin)
└── frontend/   # React + Vite app
```
