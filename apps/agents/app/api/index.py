import re
from pathlib import Path
from typing import Any, Literal, Optional
import os
import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator
from app.core.router import run_multi_agent, VALID_TOOL_HINTS
from app.core.guardrails import check_input
from app.core.language import language_list_for_frontend

load_dotenv(Path(__file__).resolve().parents[4] / ".env")

import logging as _logging
_startup_logger = _logging.getLogger("allminds.startup")

app = FastAPI(title="AllMinds API", version="1.0")


@app.on_event("startup")
async def _startup_health_check() -> None:
    """Log which optional services are configured so failures are visible at boot."""
    from app.core.models import STANDARD_MODEL, PRO_MODEL, IMAGE_MODEL
    checks = {
        "GEMINI_API_KEY":       bool(os.getenv("GEMINI_API_KEY")),
        "GROQ_API_KEY":         bool(os.getenv("GROQ_API_KEY")),
        "YOUTUBE_API_KEY":      bool(os.getenv("YOUTUBE_API_KEY")),
        "STANDARD_MODEL":       STANDARD_MODEL,
        "PRO_MODEL":            PRO_MODEL,
        "IMAGE_MODEL":          IMAGE_MODEL,
        "BACKEND_API_URL":      bool(os.getenv("BACKEND_API_URL")),
    }
    for key, value in checks.items():
        if isinstance(value, bool):
            status = "OK" if value else "MISSING"
            level = _startup_logger.info if value else _startup_logger.warning
            level("[startup] %-25s %s", key, status)
        else:
            _startup_logger.info("[startup] %-25s %s", key, value)

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

class ChatRequest(BaseModel):
    message: Optional[str] = Field(default=None, max_length=4000)
    user_input: Optional[str] = Field(default=None, max_length=4000)
    thread_id: Optional[str] = None
    learner_name: str = Field(default="", max_length=100)
    records: list[dict[str, Any]] = Field(default_factory=list, max_length=100)
    language_pref: str = Field(default="en", min_length=2, max_length=10)
    tool_hint: Optional[Literal["general", "lesson", "multimodal", "schedule", "visual", "analytics", "rag", "parent"]] = None
    # Structured fields for lesson planner — enables accurate YouTube / image generation
    grade: Optional[str] = Field(default=None, max_length=20)
    subject: Optional[str] = Field(default=None, max_length=100)
    topic: Optional[str] = Field(default=None, max_length=200)
    support_need: Optional[str] = Field(default=None, max_length=500)
    difficulty: Optional[str] = Field(default=None, max_length=50)
    material_type: Optional[str] = Field(default=None, max_length=50)
    # Structured field for the parent-communication agent
    communication_type: Optional[Literal["progress", "concern"]] = None

    @field_validator("tool_hint")
    @classmethod
    def validate_tool_hint(cls, v: Optional[str]) -> Optional[str]:
        # Cross-check against the live AGENT_MAP so a drift between this Literal
        # and AGENT_MAP raises a clear error rather than silently mis-routing.
        if v is not None and v not in VALID_TOOL_HINTS:
            raise ValueError(f"tool_hint must be one of {sorted(VALID_TOOL_HINTS)}")
        return v


def sanitize_input(text: str) -> str:
    # Legacy pass-through — PII scrubbing is now handled in guardrails.check_input
    return text


def extract_message(payload: ChatRequest) -> str:
    message = payload.message or payload.user_input or ""
    return message.strip()


async def get_authenticated_user_id(authorization: Optional[str]) -> int:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authentication is required.")

    backend_api_url = os.getenv("BACKEND_API_URL", "").rstrip("/")
    if not backend_api_url:
        raise HTTPException(status_code=503, detail="Authentication service is not configured.")

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(
                f"{backend_api_url}/auth/profile",
                headers={"Authorization": authorization},
            )
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=503, detail="Authentication service is unavailable.") from exc

    if response.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid or expired session.")

    try:
        user_id = int(response.json()["id"])
    except (KeyError, TypeError, ValueError) as exc:
        raise HTTPException(status_code=502, detail="Authentication service returned an invalid profile.") from exc

    return user_id


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
    user_id = await get_authenticated_user_id(authorization)
    user_message = extract_message(payload)
    if not user_message:
        raise HTTPException(status_code=422, detail="A message is required.")

    guard = check_input(user_message)
    if guard.blocked:
        raise HTTPException(status_code=400, detail=guard.reason)

    ai_result = run_multi_agent(
        user_input=guard.cleaned,
        thread_id=str(user_id),
        learner_name=payload.learner_name,
        records=payload.records,
        language_pref=payload.language_pref,
        tool_hint=payload.tool_hint,
        grade=payload.grade,
        subject=payload.subject,
        topic=payload.topic,
        support_need=payload.support_need,
        difficulty=payload.difficulty,
        material_type=payload.material_type,
        communication_type=payload.communication_type,
    )

    return {
        "status":            "success",
        "input_received":    guard.cleaned,
        "response":          ai_result["text"],
        "youtube_links":     ai_result.get("youtube_links", []),
        "image_aids":        ai_result.get("image_aids", []),
        "media_diagnostics": ai_result.get("media_diagnostics", []),
    }
