import json
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.auth.middleware import get_current_user
from app.agents.chat import run_chat_stream
from app.agents.insights import generate_insights
from app.agents.portfolio_review import generate_portfolio_review

router = APIRouter(prefix="/agents", tags=["Agents"])


class ChatRequest(BaseModel):
    message: str
    history: list[dict] = []


@router.post("/chat/stream")
async def chat_stream(body: ChatRequest, user=Depends(get_current_user)):
    async def gen():
        async for event in run_chat_stream(user["_id"], body.message, body.history):
            yield f"data: {json.dumps(event)}\n\n"
        yield 'data: {"type": "done"}\n\n'
    return StreamingResponse(gen(), media_type="text/event-stream")


@router.get("/insights")
async def insights(month: str, user=Depends(get_current_user)):
    return await generate_insights(user["_id"], month)


@router.get("/portfolio-review")
async def portfolio_review(user=Depends(get_current_user)):
    return await generate_portfolio_review(user["_id"])
