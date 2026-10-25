import importlib

from conftest import FakeLLM

ngo = importlib.import_module("app.agents.ngo_match_agent")
support = importlib.import_module("app.agents.support_agent")
general = importlib.import_module("app.agents.general_agent")

CANDIDATES = [
    {"id": 1, "name": "Action in Autism", "services": ["Autism"], "reasons": ["6 km away"]},
    {"id": 2, "name": "VelaNjabulo Foundation", "services": ["Dyslexia"], "reasons": []},
]


def test_ngo_match_parses_only_known_ids(monkeypatch):
    fake = FakeLLM('[{"id": 2, "why": "Dyslexia support"}, {"id": 99, "why": "made up"}, {"id": 2, "why": "dup"}]')
    monkeypatch.setattr(ngo, "get_llm", lambda: fake)
    result = ngo.ngo_match_agent({"input": "dyslexia", "request_context": {"candidates": CANDIDATES}})
    assert result["matches"] == [{"id": 2, "why": "Dyslexia support"}]
    assert "<candidates>" in fake.calls[0][1].content


def test_ngo_match_falls_back_without_model(monkeypatch):
    monkeypatch.setattr(ngo, "get_llm", lambda: None)
    result = ngo.ngo_match_agent({"input": "autism", "request_context": {"candidates": CANDIDATES}})
    assert result["status"] == "fallback" and [m["id"] for m in result["matches"]] == [1, 2]


def test_support_agent_builds_grounded_prompt(monkeypatch):
    fake = FakeLLM("SUMMARY ...")
    monkeypatch.setattr(support, "get_llm", lambda: fake)
    records = [{"date": f"2026-01-0{i}", "mark": 50, "behavior": {"attention": 3}} for i in range(1, 4)]
    result = support.support_agent({
        "input": "Help with reading", "request_type": "assessment-adjustment", "urgency": "high",
        "learner_name": "Learner A", "records": records, "request_context": {"strengths": ["Art"]},
    })
    prompt = fake.calls[0][1].content
    assert result["status"] == "ok" and result["analytics"]["summary"]["records"] == 3
    assert "adapting assessments" in prompt and "HIGH urgency" in prompt and "<learner_data>" in prompt


def test_general_agent_includes_memory_and_learner(monkeypatch):
    fake = FakeLLM("ok")
    monkeypatch.setattr(general, "get_llm", lambda: fake)
    general.general_agent({
        "input": "Ideas for transitions?",
        "facts": ["my class is Grade 2"],
        "history": [{"role": "user", "content": "earlier"}, {"role": "assistant", "content": "reply"}],
        "request_context": {"learner": {"grade": "Grade 2", "supportNeeds": ["Visual schedule"]}},
    })
    messages = fake.calls[0]
    assert "my class is Grade 2" in messages[0].content
    assert [m.content for m in messages[1:3]] == ["earlier", "reply"]
    assert "Visual schedule" in messages[-1].content
