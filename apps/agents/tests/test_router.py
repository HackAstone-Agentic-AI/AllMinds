from app.core import router


def _install(monkeypatch, decision="general", reply="ok"):
    seen = {}

    def fake_agent(state):
        seen["state"] = state
        return {"output": reply, "status": "ok"}

    monkeypatch.setitem(router.AGENT_MAP, decision, fake_agent)
    monkeypatch.setattr(router, "general_agent", fake_agent)
    monkeypatch.setattr(router, "supervisor_agent", lambda state: {"decision": decision})
    return seen


def test_tool_hint_skips_supervisor_and_memory(monkeypatch):
    seen = _install(monkeypatch, "visual")
    monkeypatch.setattr(router, "supervisor_agent", lambda state: (_ for _ in ()).throw(AssertionError("called")))
    result = router.run_multi_agent("make a now/next board", "u-hint", tool_hint="visual")
    assert result["agent"] == "visual" and "history" not in seen["state"]


def test_chat_uses_and_saves_memory(monkeypatch):
    seen = _install(monkeypatch, "general", reply="Try a visual timer.")
    router.run_multi_agent("remember that my class is Grade 2", "u-mem")
    router.run_multi_agent("first question", "u-mem")
    router.run_multi_agent("follow up", "u-mem")
    assert seen["state"]["facts"] == ["my class is Grade 2"]
    # "remember ..." turns are kept too, so the restored chat shows the whole conversation.
    assert [t["content"] for t in seen["state"]["history"]] == [
        "remember that my class is Grade 2",
        "Got it. I'll remember: my class is Grade 2.",
        "first question",
        "Try a visual timer.",
    ]


def test_error_replies_are_not_remembered(monkeypatch):
    monkeypatch.setattr(router, "supervisor_agent", lambda state: {"decision": "general"})
    monkeypatch.setattr(router, "general_agent", lambda state: {"output": "GEMINI_API_KEY is missing.", "status": "error"})
    monkeypatch.setitem(router.AGENT_MAP, "general", router.general_agent)
    result = router.run_multi_agent("hello", "u-err")
    assert result["error"] is True
    from app.core import memory_tools
    assert memory_tools.recent_turns("u-err") == []


def test_structured_fields_reach_agents(monkeypatch):
    seen = _install(monkeypatch, "support")
    router.run_multi_agent("goal", "u-sup", tool_hint="support", request_type="progress-review",
                           urgency="high", request_context={"strengths": ["Art"]})
    assert seen["state"]["request_type"] == "progress-review"
    assert seen["state"]["request_context"] == {"strengths": ["Art"]}


def test_stream_emits_tokens_then_done(monkeypatch):
    monkeypatch.setattr(router, "supervisor_agent", lambda state: {"decision": "general"})
    monkeypatch.setattr(router, "general_llm_available", lambda: True)
    monkeypatch.setattr(router, "stream_general_agent", lambda state: iter(["Hel", "lo"]))
    events = list(router.stream_multi_agent("hi", "u-stream"))
    assert [e["type"] for e in events] == ["token", "token", "done"]
    assert events[-1]["text"] == "Hello" and events[-1]["replace"] is False


def test_stream_replaces_text_that_fails_output_guardrail(monkeypatch):
    monkeypatch.setattr(router, "supervisor_agent", lambda state: {"decision": "general"})
    monkeypatch.setattr(router, "general_llm_available", lambda: True)
    monkeypatch.setattr(router, "stream_general_agent", lambda state: iter(["GEMINI_API_KEY=abc123secret"]))
    done = list(router.stream_multi_agent("hi", "u-stream2"))[-1]
    assert done["replace"] is True and "abc123secret" not in done["text"]


def test_calendar_request_returns_confirmable_proposal(monkeypatch):
    monkeypatch.setattr(router, "supervisor_agent", lambda state: {"decision": "schedule"})
    result = router.run_multi_agent("schedule Grade 3 maths on Friday at 9am", "7")
    assert result["pending_action"]["title"] == "Grade 3 maths"
    assert result["pending_action"]["start_time"] == "09:00"
