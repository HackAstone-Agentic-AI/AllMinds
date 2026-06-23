"""
Shared visual media helpers used by both the lesson planner and visual support agents.
"""
import base64
import logging
import os
from urllib.parse import quote_plus

logger = logging.getLogger(__name__)


# ── YouTube link builders ─────────────────────────────────────────────────────

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


def build_lesson_youtube_links(topic: str, subject: str = "", grade: str = "") -> list[dict]:
    grade_ctx = f"Grade {grade}" if grade else "primary school"
    subject_ctx = subject if subject else "classroom"
    links = []
    for template in _LESSON_YOUTUBE_TEMPLATES:
        query = template.format(topic=topic, grade_ctx=grade_ctx, subject_ctx=subject_ctx)
        url = f"https://www.youtube.com/results?search_query={quote_plus(query)}"
        links.append({"label": query, "url": url})
    return links


def build_visual_youtube_links(topic: str) -> list[dict]:
    links = []
    for template in _VISUAL_YOUTUBE_TEMPLATES:
        query = template.format(topic=topic)
        url = f"https://www.youtube.com/results?search_query={quote_plus(query)}"
        links.append({"label": query, "url": url})
    return links


# ── Image generation ──────────────────────────────────────────────────────────

def generate_image_aids(
    topic: str,
    subject: str = "",
    grade: str = "",
    context: str = "lesson",
) -> list[dict]:
    """
    Generate 1–2 educational visual aid images via Gemini image generation.
    Returns list of {"label": str, "url": str} where url is a data URI.
    Silently returns [] on any failure so text output is never blocked.

    context: "lesson" for lesson plan aids, "visual" for visual support aids.
    """
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        return []

    grade_ctx = f"Grade {grade} " if grade else ""
    subject_ctx = f"{subject} " if subject else ""

    if context == "visual":
        prompts = [
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
        ]
        labels = [
            f"Visual Support Card: {topic}",
            f"Step-by-Step Visual: {topic}",
        ]
    else:
        prompts = [
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
        ]
        labels = [
            f"Concept Diagram: {topic}",
            f"Activity Task Card: {topic}",
        ]

    images = []
    try:
        from google import genai  # type: ignore[import-not-found]
        from google.genai import types  # type: ignore[import-not-found]

        client = genai.Client(api_key=api_key)

        for i, (prompt, label) in enumerate(zip(prompts, labels)):
            try:
                response = client.models.generate_content(
                    model="gemini-2.0-flash-preview-image-generation",
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        response_modalities=["IMAGE"],
                    ),
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
            except Exception as img_exc:
                logger.warning("Image %d generation failed: %s", i + 1, img_exc)

    except ImportError:
        logger.info("google-genai not installed; image generation skipped")
    except Exception as exc:
        logger.warning("Image generation session failed: %s", exc)

    return images
