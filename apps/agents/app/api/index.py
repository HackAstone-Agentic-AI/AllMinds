import re
from pathlib import Path
from typing import Any, Literal, Optional
import os
import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, Header, HTTPException
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator
from app.core.router import run_multi_agent, stream_multi_agent, VALID_TOOL_HINTS
import json
from app.core.guardrails import check_input, check_structured
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
    # Load (or build) the DCAPS index in the background so the first curriculum
    # question does not pay the cold-start cost.
    if os.getenv("RAG_WARM_ON_START", "true").lower() == "true":
        from app.agents.rag_agent import warm_up
        warm_up()
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
    tool_hint: Optional[Literal["general", "lesson", "multimodal", "schedule", "visual", "analytics", "rag", "parent", "support", "ngo"]] = None
    # Structured fields for lesson planner — enables accurate YouTube / image generation
    grade: Optional[str] = Field(default=None, max_length=20)
    subject: Optional[str] = Field(default=None, max_length=100)
    topic: Optional[str] = Field(default=None, max_length=200)
    support_need: Optional[str] = Field(default=None, max_length=500)
    difficulty: Optional[str] = Field(default=None, max_length=50)
    material_type: Optional[str] = Field(default=None, max_length=50)
    # Structured field for the parent-communication agent
    communication_type: Optional[Literal["progress", "concern"]] = None
    curriculum: Optional[str] = Field(default=None, max_length=100)
    # Structured fields for learner support requests (tool_hint="support")
    request_type: Optional[Literal[
        "multi-agent-coordination", "support-planning", "assessment-adjustment",
        "progress-review", "attendance-support",
    ]] = None
    urgency: Optional[Literal["low", "medium", "high"]] = None
    request_context: dict[str, Any] = Field(default_factory=dict)

    @field_validator("request_context")
    @classmethod
    def validate_request_context(cls, v: dict[str, Any]) -> dict[str, Any]:
        # The context is embedded in a prompt, so cap its size.
        import json
        if len(json.dumps(v, default=str)) > 6000:
            raise ValueError("request_context is too large")
        return v

    @field_validator("tool_hint")
    @classmethod
    def validate_tool_hint(cls, v: Optional[str]) -> Optional[str]:
        # Cross-check against the live AGENT_MAP so a drift between this Literal
        # and AGENT_MAP raises a clear error rather than silently mis-routing.
        if v is not None and v not in VALID_TOOL_HINTS:
            raise ValueError(f"tool_hint must be one of {sorted(VALID_TOOL_HINTS)}")
        return v


# ─── Response cache ───────────────────────────────────────────────────────────
# Lesson plans, visual supports and curriculum answers for the same inputs are not
# personal, so repeats (demo topics, a teacher re-opening a plan) return instantly.
import hashlib
import threading
import time
from collections import OrderedDict

CACHEABLE_TOOLS = {"lesson", "visual", "rag", "multimodal"}
CACHE_TTL_SECONDS = int(os.getenv("RESPONSE_CACHE_TTL", str(6 * 60 * 60)))
CACHE_MAX_ENTRIES = 64
_cache: "OrderedDict[str, tuple[float, dict]]" = OrderedDict()
_cache_lock = threading.Lock()


def _cache_key(payload: "ChatRequest", message: str) -> str | None:
    if payload.tool_hint not in CACHEABLE_TOOLS or CACHE_TTL_SECONDS <= 0:
        return None
    fields = payload.model_dump(include={
        "tool_hint", "language_pref", "grade", "subject", "topic", "support_need",
        "difficulty", "material_type", "curriculum",
    })
    raw = json.dumps({"message": message.strip().lower(), **fields}, sort_keys=True, default=str)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _cache_get(key: str | None) -> dict | None:
    if key is None:
        return None
    with _cache_lock:
        hit = _cache.get(key)
        if not hit:
            return None
        stored_at, value = hit
        if time.time() - stored_at > CACHE_TTL_SECONDS:
            _cache.pop(key, None)
            return None
        _cache.move_to_end(key)
        return value


def _cache_put(key: str | None, value: dict) -> None:
    if key is None:
        return
    with _cache_lock:
        _cache[key] = (time.time(), value)
        _cache.move_to_end(key)
        while len(_cache) > CACHE_MAX_ENTRIES:
            _cache.popitem(last=False)


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
    from app.agents.rag_agent import rag_status
    return {"status": "ok", "rag_index": rag_status()}


@app.get("/languages")
async def list_languages() -> dict:
    return {"languages": language_list_for_frontend()}


async def _validated_request(payload: ChatRequest, authorization: Optional[str]) -> tuple[int, str, dict]:
    """Auth + guardrails shared by /chat and /chat/stream. Returns (user_id, message, agent kwargs)."""
    user_id = await get_authenticated_user_id(authorization)
    user_message = extract_message(payload)
    if not user_message:
        raise HTTPException(status_code=422, detail="A message is required.")

    guard = check_input(user_message)
    if guard.blocked:
        raise HTTPException(status_code=400, detail=guard.reason)

    # Structured fields are embedded in prompts too, so they get the same checks.
    request_context = payload.request_context
    if request_context:
        ctx_guard = check_structured(json.dumps(request_context, ensure_ascii=False, default=str))
        if ctx_guard.blocked:
            raise HTTPException(status_code=400, detail=ctx_guard.reason)
        request_context = json.loads(ctx_guard.cleaned)
    name_guard = check_structured(payload.learner_name)
    if name_guard.blocked:
        raise HTTPException(status_code=400, detail=name_guard.reason)

    kwargs = {
        "user_input": guard.cleaned,
        "thread_id": str(user_id),
        "learner_name": name_guard.cleaned,
        "records": payload.records,
        "language_pref": payload.language_pref,
        "tool_hint": payload.tool_hint,
        "grade": payload.grade,
        "subject": payload.subject,
        "topic": payload.topic,
        "support_need": payload.support_need,
        "difficulty": payload.difficulty,
        "material_type": payload.material_type,
        "communication_type": payload.communication_type,
        "request_type": payload.request_type,
        "urgency": payload.urgency,
        "request_context": request_context,
    }
    return user_id, guard.cleaned, kwargs


def _response_body(message: str, ai_result: dict) -> dict:
    return {
        "status":            "success",
        "input_received":    message,
        "response":          ai_result["text"],
        "youtube_links":     ai_result.get("youtube_links", []),
        "image_aids":        ai_result.get("image_aids", []),
        "media_diagnostics": ai_result.get("media_diagnostics", []),
        "analytics":         ai_result.get("analytics"),
        "sources":           ai_result.get("sources", []),
        "agent":             ai_result.get("agent"),
        "matches":           ai_result.get("matches", []),
        "pending_action":    ai_result.get("pending_action"),
        "cached":            False,
    }


@app.post("/chat")
async def chat_endpoint(
    payload: ChatRequest,
    authorization: Optional[str] = Header(default=None),
):
    _, message, kwargs = await _validated_request(payload, authorization)

    cache_key = _cache_key(payload, message)
    cached = _cache_get(cache_key)
    if cached is not None:
        return {**cached, "cached": True}

    # Agents make blocking LLM calls; run them in the threadpool so one long lesson
    # plan does not stall the event loop (health checks and other users).
    ai_result = await run_in_threadpool(run_multi_agent, **kwargs)

    response = _response_body(message, ai_result)
    # Only cache real answers, never error fallbacks.
    if ai_result.get("agent") and not ai_result.get("error"):
        _cache_put(cache_key, response)
    return response


@app.post("/chat/stream")
async def chat_stream_endpoint(
    payload: ChatRequest,
    authorization: Optional[str] = Header(default=None),
):
    """Server-sent events: token events while Thandi writes, then one done event."""
    _, message, kwargs = await _validated_request(payload, authorization)

    def events():
        for event in stream_multi_agent(**kwargs):
            if event.get("type") == "done":
                body = _response_body(message, event)
                body.update({"type": "done", "replace": event.get("replace", False)})
                event = body
            yield f"data: {json.dumps(event, default=str)}\n\n"

    # StreamingResponse iterates a sync generator in a threadpool, so the event loop stays free.
    return StreamingResponse(
        events(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.get("/memory")
async def get_memory(authorization: Optional[str] = Header(default=None)):
    """Recent conversation and remembered facts, so the chat can be restored."""
    from app.core import memory_tools
    user_id = await get_authenticated_user_id(authorization)
    turns = await run_in_threadpool(memory_tools.recent_turns, str(user_id), 20)
    facts = await run_in_threadpool(memory_tools.get_user_facts, str(user_id))
    return {"turns": turns, "facts": facts}


@app.delete("/memory")
async def delete_memory(authorization: Optional[str] = Header(default=None)):
    """Erase everything Thandi remembers about this teacher."""
    from app.core import memory_tools
    user_id = await get_authenticated_user_id(authorization)
    await run_in_threadpool(memory_tools.forget_user, str(user_id))
    return {"status": "deleted"}
