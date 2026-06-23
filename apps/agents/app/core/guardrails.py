import re
from dataclasses import dataclass

# ── Constants ─────────────────────────────────────────────────────────────────

MAX_INPUT_CHARS = 2000
MAX_OUTPUT_CHARS = 8000

# ── Result type ───────────────────────────────────────────────────────────────

@dataclass
class GuardrailResult:
    blocked: bool
    reason: str = ""
    cleaned: str = ""


# ── PII patterns ──────────────────────────────────────────────────────────────

_PII_PATTERNS: list[tuple[re.Pattern, str]] = [
    (re.compile(r"\b\d{13}\b"), "[ID REDACTED]"),
    (re.compile(r"\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b"), "[EMAIL REDACTED]"),
    (re.compile(r"\b(?:\+27|0)[6-8]\d{8}\b"), "[PHONE REDACTED]"),
    (re.compile(r"\b\d{3}[-.\s]\d{3}[-.\s]\d{4}\b"), "[PHONE REDACTED]"),
]


def scrub_pii(text: str) -> str:
    for pattern, replacement in _PII_PATTERNS:
        text = pattern.sub(replacement, text)
    return text


# ── Prompt injection detection ────────────────────────────────────────────────

_INJECTION_PATTERNS = [
    r"ignore\b.{0,30}\binstructions",
    r"disregard\b.{0,30}\binstructions",
    r"forget\b.{0,30}\binstructions",
    r"you are now\b",
    r"new persona",
    r"act as (a |an )?(?!teacher|educator|assistant|colleague)",
    r"pretend (you are|to be)",
    r"jailbreak",
    r"dan mode",
    r"developer mode",
    r"\bsystem prompt\b",
    r"reveal (your |the )?(prompt|instructions|system)",
    r"print (your |the )?(prompt|instructions|system)",
    r"output (your |the )?(prompt|instructions|system)",
    r"bypass (safety|filter|guardrail)",
    r"override (safety|filter|guardrail)",
    r"do anything now",
]

_INJECTION_RE = re.compile(
    "|".join(_INJECTION_PATTERNS),
    re.IGNORECASE,
)


def _is_injection(text: str) -> bool:
    return bool(_INJECTION_RE.search(text))


# ── Harmful content detection ─────────────────────────────────────────────────

_HARM_PATTERNS = [
    r"\bsuicid\w*\b",
    r"\bself[- ]harm\b",
    r"\bself[- ]injur\w*\b",
    r"\bcut (myself|yourself|themselves)\b",
    r"\bkill (myself|yourself|themselves|a child|a student|a kid)\b",
    r"\bhow to (hurt|harm|abuse|kill|poison)\b",
    r"\bchild (abuse|molest\w*|exploit\w*)\b",
    r"\bsexual(ly)? (abuse|exploit|assault)\b",
    r"\bcsam\b",
    r"\bweapon (instructions|how to make|build)\b",
    r"\bbomb (instructions|how to make|build)\b",
    r"\bdrug (synthesis|how to make|manufacture)\b",
    # Catch "how to make/build/… a bomb/weapon/poison/…" (object-after-verb phrasing)
    r"\bhow to (make|build|create|assemble|synthesi[sz]e|manufacture)\b.{0,30}\b(bomb|explosive|weapon|gun|firearm|poison|drug|malware|virus|ransomware)\b",
]

_HARM_RE = re.compile(
    "|".join(_HARM_PATTERNS),
    re.IGNORECASE,
)


def _is_harmful(text: str) -> bool:
    return bool(_HARM_RE.search(text))


# ── Off-topic / out-of-scope detection ───────────────────────────────────────
# Hard blocks for requests that have zero relation to education or teaching.

_OFFTOPIC_PATTERNS = [
    r"\b(stock|crypto|bitcoin|ethereum|forex|trading)\b.{0,30}\b(tip|advice|invest|price|signal)\b",
    r"\b(write|generate|create).{0,20}\b(malware|virus|ransomware|spyware|keylogger|exploit)\b",
    r"\b(hack|crack|brute.?force).{0,20}\b(account|password|system|server|database)\b",
    r"\b(fake|forged?|counterfeit).{0,20}\b(certificate|credential|id|document|passport)\b",
    r"\bwrite (me )?(a |an )?(pornograph\w+|explicit|erotic)\b",
]

_OFFTOPIC_RE = re.compile(
    "|".join(_OFFTOPIC_PATTERNS),
    re.IGNORECASE,
)


def _is_offtopic_abuse(text: str) -> bool:
    return bool(_OFFTOPIC_RE.search(text))


# ── Topic safety gate (for media: YouTube search & image generation) ──────────

def is_topic_safe(text: str) -> bool:
    """
    Defence-in-depth gate for the media paths. Returns True only when a topic is safe
    to turn into a web (YouTube) search query or an image-generation prompt.

    Reuses the same injection / harmful / off-topic-abuse detection as check_input, so
    an unsafe or out-of-scope topic is never sent to an external search or image model
    even if it somehow reaches these helpers without going through check_input first.
    """
    if not text or not text.strip():
        return False
    return not (_is_injection(text) or _is_harmful(text) or _is_offtopic_abuse(text))


# ── Output sanitisation ───────────────────────────────────────────────────────

_OUTPUT_SENSITIVE_RE = re.compile(
    r"(?:GROQ_API_KEY|GEMINI_API_KEY|GOOGLE_OAUTH)\s*=\s*\S+"
    r"|Bearer\s+\S+"
    r"|sk-[A-Za-z0-9]{20,}",
    re.IGNORECASE,
)

# Harmful CONTENT / INSTRUCTIONS that must never be displayed, even if a model produces
# them. Deliberately narrow and instruction-focused — it must NOT trip on legitimate
# safeguarding language (e.g. advising a teacher on signs of self-harm is allowed).
_OUTPUT_HARM_PATTERNS = [
    r"\bhow to (make|build|create|synthesize|manufacture|assemble)\b.{0,40}\b(bomb|explosive|weapon|gun|poison|malware|virus|ransomware|drug)\b",
    r"\bstep[- ]by[- ]step\b.{0,40}\b(bomb|explosive|weapon|poison|malware|ransomware|hack(ing)?)\b",
    r"\b(csam|child sexual abuse material)\b",
    r"\bsexual(ly)? (abuse|exploit|assault)(ing)? (a )?(child|minor|kid)\b",
    r"\b(pornograph\w+|explicit sexual|erotic) (story|content|scene|description)\b",
]
_OUTPUT_HARM_RE = re.compile("|".join(_OUTPUT_HARM_PATTERNS), re.IGNORECASE)

SAFE_REFUSAL_MESSAGE = (
    "I'm sorry, but I can't help with that. This assistant is here to support teachers "
    "working with neurodivergent learners — please ask me something within that scope."
)


def _is_harmful_output(text: str) -> bool:
    return bool(_OUTPUT_HARM_RE.search(text))


def sanitize_output(text: str) -> str:
    text = _OUTPUT_SENSITIVE_RE.sub("[REDACTED]", text)
    if len(text) > MAX_OUTPUT_CHARS:
        text = text[:MAX_OUTPUT_CHARS] + "\n\n[Response truncated]"
    return text


# ── Public API ────────────────────────────────────────────────────────────────

def check_input(text: str) -> GuardrailResult:
    """
    Run all input guardrails. Returns a GuardrailResult with:
      - blocked=True  if the message must not be processed
      - cleaned        the PII-scrubbed version to use instead of raw input
    """
    if not text or not text.strip():
        return GuardrailResult(blocked=True, reason="empty_input")

    if len(text) > MAX_INPUT_CHARS:
        return GuardrailResult(
            blocked=True,
            reason=f"Input exceeds {MAX_INPUT_CHARS} characters. Please shorten your message.",
        )

    if _is_injection(text):
        return GuardrailResult(
            blocked=True,
            reason="This message contains content that looks like a prompt injection attempt and cannot be processed.",
        )

    if _is_harmful(text):
        return GuardrailResult(
            blocked=True,
            reason=(
                "This message contains content that falls outside what this assistant can safely help with. "
                "If a child or adult is in immediate danger, please contact emergency services or a qualified professional."
            ),
        )

    if _is_offtopic_abuse(text):
        return GuardrailResult(
            blocked=True,
            reason="This assistant is designed to support teachers working with neurodivergent learners and cannot help with that request.",
        )

    cleaned = scrub_pii(text)
    return GuardrailResult(blocked=False, cleaned=cleaned)


def check_output(text: str) -> str:
    """
    Sanitise agent output before returning it to the caller.
    Blocks harmful content outright, redacts secrets, and truncates over-long output.
    Never raises — always returns a string.
    """
    if not text:
        return ""
    if _is_harmful_output(text):
        return SAFE_REFUSAL_MESSAGE
    return sanitize_output(text)
