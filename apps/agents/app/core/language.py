"""
South African multilingual support for the AllMinds agent system.

Covers all 11 official languages of South Africa.
"""

SA_LANGUAGES: dict[str, dict] = {
    "en": {
        "english_name": "English",
        "native_name": "English",
        "instruction": "Respond in English.",
    },
    "zu": {
        "english_name": "Zulu",
        "native_name": "isiZulu",
        "instruction": (
            "Respond in isiZulu (Zulu). Use clear, natural isiZulu throughout your entire reply. "
            "Key educational terms may be kept in English in parentheses where no established Zulu equivalent exists."
        ),
    },
    "xh": {
        "english_name": "Xhosa",
        "native_name": "isiXhosa",
        "instruction": (
            "Respond in isiXhosa (Xhosa). Use clear, natural isiXhosa throughout your entire reply. "
            "Key educational terms may be kept in English in parentheses where no established Xhosa equivalent exists."
        ),
    },
    "af": {
        "english_name": "Afrikaans",
        "native_name": "Afrikaans",
        "instruction": (
            "Respond in Afrikaans. Use clear, natural Afrikaans throughout your entire reply. "
            "Key educational terms may be kept in English in parentheses where no established Afrikaans equivalent exists."
        ),
    },
    "nso": {
        "english_name": "Sepedi",
        "native_name": "Sepedi",
        "instruction": (
            "Respond in Sepedi (Northern Sotho / Sesotho sa Leboa). Use clear, natural Sepedi throughout your entire reply. "
            "Key educational terms may be kept in English in parentheses where no established Sepedi equivalent exists."
        ),
    },
    "tn": {
        "english_name": "Setswana",
        "native_name": "Setswana",
        "instruction": (
            "Respond in Setswana (Tswana). Use clear, natural Setswana throughout your entire reply. "
            "Key educational terms may be kept in English in parentheses where no established Setswana equivalent exists."
        ),
    },
    "st": {
        "english_name": "Sesotho",
        "native_name": "Sesotho",
        "instruction": (
            "Respond in Sesotho (Southern Sotho). Use clear, natural Sesotho throughout your entire reply. "
            "Key educational terms may be kept in English in parentheses where no established Sesotho equivalent exists."
        ),
    },
    "ts": {
        "english_name": "Xitsonga",
        "native_name": "Xitsonga",
        "instruction": (
            "Respond in Xitsonga (Tsonga). Use clear, natural Xitsonga throughout your entire reply. "
            "Key educational terms may be kept in English in parentheses where no established Xitsonga equivalent exists."
        ),
    },
    "ss": {
        "english_name": "siSwati",
        "native_name": "siSwati",
        "instruction": (
            "Respond in siSwati (Swati). Use clear, natural siSwati throughout your entire reply. "
            "Key educational terms may be kept in English in parentheses where no established siSwati equivalent exists."
        ),
    },
    "ve": {
        "english_name": "Tshivenda",
        "native_name": "Tshivenda",
        "instruction": (
            "Respond in Tshivenda (Venda). Use clear, natural Tshivenda throughout your entire reply. "
            "Key educational terms may be kept in English in parentheses where no established Tshivenda equivalent exists."
        ),
    },
    "nr": {
        "english_name": "isiNdebele",
        "native_name": "isiNdebele",
        "instruction": (
            "Respond in isiNdebele (Southern Ndebele). Use clear, natural isiNdebele throughout your entire reply. "
            "Key educational terms may be kept in English in parentheses where no established isiNdebele equivalent exists."
        ),
    },
}

# Map common name strings (as stored in users.language_pref) to language codes
_NAME_TO_CODE: dict[str, str] = {}
for _code, _meta in SA_LANGUAGES.items():
    _NAME_TO_CODE[_meta["english_name"].lower()] = _code
    _NAME_TO_CODE[_meta["native_name"].lower()] = _code
    _NAME_TO_CODE[_code.lower()] = _code

# Extra aliases users or the DB might store
_NAME_TO_CODE.update({
    "zulu": "zu",
    "isizulu": "zu",
    "xhosa": "xh",
    "isixhosa": "xh",
    "northern sotho": "nso",
    "sesotho sa leboa": "nso",
    "tswana": "tn",
    "southern sotho": "st",
    "tsonga": "ts",
    "swati": "ss",
    "swazi": "ss",
    "venda": "ve",
    "ndebele": "nr",
    "southern ndebele": "nr",
    "isindebele": "nr",
})


def resolve_language_code(language_pref: str | None) -> str:
    """Return a canonical language code for the given preference string, defaulting to 'en'."""
    if not language_pref:
        return "en"
    return _NAME_TO_CODE.get(language_pref.strip().lower(), "en")


def get_language_instruction(state: dict) -> str:
    """
    Build a system-prompt suffix that tells the LLM which language to respond in.

    Reads `language_pref` from the agent state. Returns an empty string when the
    preference is English (no extra instruction needed — English is the default).
    """
    raw = state.get("language_pref", "en") or "en"
    code = resolve_language_code(raw)
    if code == "en":
        return ""
    meta = SA_LANGUAGES.get(code, SA_LANGUAGES["en"])
    return (
        f"\n\nLANGUAGE INSTRUCTION:\n"
        f"{meta['instruction']}\n"
        f"Even if the teacher writes to you in English or another language, always reply "
        f"in {meta['native_name']} ({meta['english_name']}), unless the teacher explicitly asks you to switch."
    )


def language_list_for_frontend() -> list[dict]:
    """Return a serialisable list of all SA languages for use in API responses."""
    return [
        {"code": code, "english_name": meta["english_name"], "native_name": meta["native_name"]}
        for code, meta in SA_LANGUAGES.items()
    ]
