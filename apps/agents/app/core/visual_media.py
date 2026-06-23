"""
Shared visual media helpers: YouTube search and Gemini image generation.

Both helpers return (data, diagnostic) tuples so callers can surface failures
as soft UI banners without ever blocking the text response.

Diagnostics:
  YouTube: "api_ok" | "search_fallback" | "api_error:<msg>"
  Images:  "ok" | "no_key" | "sdk_missing" | "model_not_found" |
           "billing_disabled" | "quota_exceeded" | "model_error:<msg>"
"""
import base64
import json
import logging
import os
from urllib.parse import quote_plus
from urllib.request import urlopen
from urllib.error import HTTPError, URLError

from app.core.models import IMAGE_MODEL

logger = logging.getLogger(__name__)

# ── YouTube ───────────────────────────────────────────────────────────────────

_LESSON_YOUTUBE_TEMPLATES = [
    "teaching {topic} {grade_ctx} inclusive classroom strategies",
    "{topic} visual aids {subject_ctx} neurodivergent learners lesson",
    "{grade_ctx} {subject_ctx} {topic} educational video teachers",
]

_VISUAL_YOUTUBE_TEMPLATES = [
    "{topic} visual support autism classroom",
    "{topic} for neurodivergent kids learning video",
    "{topic} early years SEND teaching resource",
]

_YOUTUBE_API_URL = "https://www.googleapis.com/youtube/v3/search"


def _youtube_api_search(queries: list[str]) -> tuple[list[dict], str]:
    """
    Call YouTube Data API v3 for each query, one video per query.
    Returns (videos, diagnostic).
    Falls back with ("api_error:<msg>") on any HTTP failure.
    """
    api_key = os.getenv("YOUTUBE_API_KEY", "").strip()
    if not api_key:
        return [], "no_key"

    videos = []
    for query in queries:
        url = (
            f"{_YOUTUBE_API_URL}?part=snippet&type=video"
            f"&safeSearch=strict&videoEmbeddable=true&maxResults=1"
            f"&q={quote_plus(query)}&key={api_key}"
        )
        try:
            with urlopen(url, timeout=6) as resp:
                data = json.loads(resp.read().decode())
            items = data.get("items", [])
            if items:
                item = items[0]
                vid_id = item["id"]["videoId"]
                title = item["snippet"]["title"]
                thumbs = item["snippet"].get("thumbnails", {})
                thumbnail = (
                    thumbs.get("medium", thumbs.get("default", {})).get("url", "")
                )
                videos.append({
                    "label": title,
                    "url": f"https://www.youtube.com/watch?v={vid_id}",
                    "thumbnail": thumbnail,
                })
        except HTTPError as exc:
            logger.warning("YouTube API HTTP error for %r: %s", query, exc)
            return [], f"api_error:HTTP {exc.code}"
        except URLError as exc:
            logger.warning("YouTube API network error for %r: %s", query, exc)
            return [], f"api_error:{exc.reason}"
        except Exception as exc:
            logger.warning("YouTube API unexpected error for %r: %s", query, exc)
            return [], f"api_error:{str(exc)[:80]}"

    return videos, "api_ok"


def _search_url_fallback(queries: list[str]) -> list[dict]:
    """YouTube search-results page links when the API is unavailable."""
    return [
        {
            "label": query,
            "url": f"https://www.youtube.com/results?search_query={quote_plus(query)}",
            "thumbnail": "",
        }
        for query in queries
    ]


def build_lesson_youtube_links(
    topic: str, subject: str = "", grade: str = ""
) -> tuple[list[dict], str]:
    """Returns (links, diagnostic)."""
    grade_ctx = f"Grade {grade}" if grade else "primary school"
    subject_ctx = subject if subject else "classroom"
    queries = [
        t.format(topic=topic, grade_ctx=grade_ctx, subject_ctx=subject_ctx)
        for t in _LESSON_YOUTUBE_TEMPLATES
    ]
    videos, diag = _youtube_api_search(queries)
    if videos:
        return videos, diag
    # Fall back to search-result URLs so the frontend always gets something
    return _search_url_fallback(queries), "search_fallback" if diag == "no_key" else diag


def build_visual_youtube_links(topic: str) -> tuple[list[dict], str]:
    """Returns (links, diagnostic)."""
    queries = [t.format(topic=topic) for t in _VISUAL_YOUTUBE_TEMPLATES]
    videos, diag = _youtube_api_search(queries)
    if videos:
        return videos, diag
    return _search_url_fallback(queries), "search_fallback" if diag == "no_key" else diag


# ── Image generation ──────────────────────────────────────────────────────────

def _image_prompts(
    topic: str, subject: str, grade: str, context: str
) -> tuple[list[str], list[str]]:
    grade_ctx = f"Grade {grade} " if grade else ""
    subject_ctx = f"{subject} " if subject else ""
    if context == "visual":
        return (
            [
                (
                    f"Create a simple, clear classroom visual support card for the topic '{topic}'. "
                    f"Style: bold outlines, max 3 colours, white background, large icons, "
                    f"minimal text, suitable for neurodivergent learners aged 3–10. "
                    f"Classroom display format."
                ),
                (
                    f"Create a now/next board or step-by-step visual task card illustrating '{topic}'. "
                    f"Clean white background, numbered steps, simple icons, inclusive classroom style."
                ),
            ],
            [
                f"Visual Support Card: {topic}",
                f"Step-by-Step Visual: {topic}",
            ],
        )
    return (
        [
            (
                f"Create a simple, clear educational classroom display poster for teaching "
                f"'{topic}' in a {grade_ctx}{subject_ctx}lesson. "
                f"Style: bold colours (max 4), clean white background, large readable labels, "
                f"simple diagrams or icons, no photorealism. Classroom poster format."
            ),
            (
                f"Create a step-by-step visual task card for a {grade_ctx}{subject_ctx}activity "
                f"about '{topic}'. Show numbered steps with simple icons. "
                f"Clean white background, bold outlines, inclusive classroom style."
            ),
        ],
        [
            f"Concept Diagram: {topic}",
            f"Activity Task Card: {topic}",
        ],
    )


# Ordered fallback chain of current GA image models. The configured IMAGE_MODEL is
# always tried first; the rest are well-known alternatives so a single unavailable or
# deprecated model never disables image generation. Deduplicated, order preserved.
_IMAGE_MODEL_FALLBACKS = [
    "gemini-2.5-flash-image",
    "gemini-3.1-flash-image",
    "gemini-3-pro-image",
]

# Remembered for the life of the process so we don't re-probe dead models on every
# request once a working one has been found.
_working_image_model: str | None = None


def _candidate_image_models() -> list[str]:
    """IMAGE_MODEL first, then a known-good model previously discovered, then fallbacks."""
    ordered = [IMAGE_MODEL, _working_image_model, *_IMAGE_MODEL_FALLBACKS]
    seen: set[str] = set()
    result: list[str] = []
    for model in ordered:
        if model and model not in seen:
            seen.add(model)
            result.append(model)
    return result


def _classify_image_error(msg: str) -> str:
    """Map a provider exception message to a diagnostic category."""
    low = msg.lower()
    if "quota" in low or "429" in low or "resource_exhausted" in low:
        return "quota_exceeded"
    if any(k in low for k in ("permission", "billing", "403", "not enabled", "access")):
        return "billing_disabled"
    if "not found" in low or "404" in low or "unsupported" in low or "is not supported" in low:
        return "model_not_found"
    return "model_error"


def _generate_with_model(client, types, model: str, prompts, labels) -> tuple[list[dict], str]:
    """Try to generate all images with a single model. Returns (images, diagnostic)."""
    images: list[dict] = []
    for i, (prompt, label) in enumerate(zip(prompts, labels)):
        try:
            response = client.models.generate_content(
                model=model,
                contents=prompt,
                config=types.GenerateContentConfig(response_modalities=["IMAGE"]),
            )
            for part in response.candidates[0].content.parts:
                if hasattr(part, "inline_data") and part.inline_data:
                    raw = part.inline_data.data
                    img_b64 = (
                        base64.b64encode(raw).decode("utf-8")
                        if isinstance(raw, bytes)
                        else raw
                    )
                    mime = part.inline_data.mime_type or "image/png"
                    images.append({"label": label, "url": f"data:{mime};base64,{img_b64}"})
                    break
        except Exception as exc:
            category = _classify_image_error(str(exc))
            logger.warning("Image %d via %s failed (%s): %s", i + 1, model, category, exc)
            return images, category
    return images, ("ok" if images else "model_not_found")


def generate_image_aids(
    topic: str,
    subject: str = "",
    grade: str = "",
    context: str = "lesson",
) -> tuple[list[dict], str]:
    """
    Generate 1–2 educational visual aid images via Gemini image generation.

    Tries the configured IMAGE_MODEL first, then falls back through a chain of current
    GA image models until one works, caching the winner for the process lifetime.
    Returns (images, diagnostic). Never raises — text output is never blocked.
    """
    global _working_image_model

    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key:
        return [], "no_key"

    prompts, labels = _image_prompts(topic, subject, grade, context)

    try:
        from google import genai  # type: ignore[import-not-found]
        from google.genai import types  # type: ignore[import-not-found]
        client = genai.Client(api_key=api_key)
    except ImportError:
        logger.info("google-genai package not installed; image generation skipped")
        return [], "sdk_missing"
    except Exception as exc:
        logger.warning("Image generation client init failed: %s", exc)
        return [], f"model_error:{str(exc)[:120]}"

    tried: list[str] = []
    for model in _candidate_image_models():
        tried.append(model)
        images, diag = _generate_with_model(client, types, model, prompts, labels)

        if diag == "ok":
            _working_image_model = model  # remember the winner
            return images, "ok"

        # Account-level problems won't be fixed by switching models — stop now.
        if diag in ("billing_disabled", "quota_exceeded"):
            return images, diag

        # model_not_found / model_error → try the next candidate.

    return [], (
        f"model_not_found:none of the configured image models worked "
        f"({', '.join(tried)}) — set GEMINI_IMAGE_MODEL to a model enabled on your API key"
    )
