"""
Central registry of Gemini model IDs used across the agent system.

Defaults are pinned to the current stable GA Gemini 2.5 family — the generation that
replaced the Gemini 2.0 models that Google shut down on 2026-06-01. Every value is
overridable via an environment variable, so models can be upgraded (for example to the
newer 3.x family: gemini-3.5-flash / gemini-3.1-flash-lite / gemini-3.1-flash-image)
without any code change.

Tiers
-----
FAST_MODEL     Cheapest / lowest latency. High-frequency, lightweight tasks.
STANDARD_MODEL Balanced quality and latency. Default for most generation agents.
PRO_MODEL      Strongest reasoning. Long, complex, multi-section generation.
IMAGE_MODEL    Native image generation ("Nano Banana" family).

Reference (verified 2026-06): https://ai.google.dev/gemini-api/docs/models
"""
import os

FAST_MODEL     = os.getenv("GEMINI_FAST_MODEL", "gemini-2.5-flash-lite")
STANDARD_MODEL = os.getenv("GEMINI_STANDARD_MODEL", "gemini-2.5-flash")
PRO_MODEL      = os.getenv("GEMINI_PRO_MODEL", "gemini-2.5-pro")
IMAGE_MODEL    = os.getenv("GEMINI_IMAGE_MODEL", "gemini-2.5-flash-image")
