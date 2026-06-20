import re
from pathlib import Path
from typing import Any, Optional
import os
from dotenv import load_dotenv
from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from app.core.router import run_multi_agent
from app.core.guardrails import check_input
from app.core.language import language_list_for_frontend

load_dotenv(Path(__file__).resolve().parents[4] / ".env")

app = FastAPI(title="AllMinds API", version="1.0")

allowed_origins = [
    origin.strip()
    for origin in os.getenv("ALLOWED_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(",")
    if origin.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DEV_BEARER_TOKEN = "Bearer ujenius_dev_key_2026"


class ChatRequest(BaseModel):
    message: Optional[str] = None
    user_input: Optional[str] = None
    thread_id: str = "default_user"
    learner_name: str = ""
    records: list[dict[str, Any]] = Field(default_factory=list)
    language_pref: str = "en"


def sanitize_input(text: str) -> str:
    # Legacy pass-through — PII scrubbing is now handled in guardrails.check_input
    return text


def extract_message(payload: ChatRequest) -> str:
    message = payload.message or payload.user_input or ""
    return message.strip()


def validate_token_if_present(authorization: Optional[str]) -> None:
    if authorization is None:
        return
    if authorization == DEV_BEARER_TOKEN:
        return
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid Authorization header")


@app.get("/health")
async def healthcheck() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/languages")
async def list_languages() -> dict:
    return {"languages": language_list_for_frontend()}


@app.post("/chat")
async def chat_endpoint(
    payload: ChatRequest,
    authorization: Optional[str] = Header(default=None),
):
    validate_token_if_present(authorization)
    user_message = extract_message(payload)
    if not user_message:
        raise HTTPException(status_code=422, detail="A message is required.")

    guard = check_input(user_message)
    if guard.blocked:
        raise HTTPException(status_code=400, detail=guard.reason)

    ai_response = run_multi_agent(
        user_input=guard.cleaned,
        thread_id=payload.thread_id,
        learner_name=payload.learner_name,
        records=payload.records,
        language_pref=payload.language_pref,
    )

    return {
        "status": "success",
        "input_received": guard.cleaned,
        "response": ai_response,
    }