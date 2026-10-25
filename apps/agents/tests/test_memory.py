from app.core import memory_tools


def test_remember_command_parsing():
    assert memory_tools.parse_remember_command("remember that my class is Grade 2") == "my class is Grade 2"
    assert memory_tools.parse_remember_command("Please remember: I teach in Soweto") == "I teach in Soweto"
    assert memory_tools.parse_remember_command("what do you remember?") is None


def test_turns_are_capped_scrubbed_and_forgettable():
    user = "mem-user"
    for i in range(15):
        memory_tools.append_turns(user, f"question {i} 0821234567", f"answer {i}")
    turns = memory_tools.recent_turns(user, limit=50)
    assert len(turns) == memory_tools.MAX_TURNS_KEPT
    assert "[PHONE REDACTED]" in turns[-2]["content"]
    memory_tools.remember_fact(user, "my class is Grade 2.")
    assert memory_tools.get_user_facts(user) == ["my class is Grade 2"]
    memory_tools.forget_user(user)
    assert memory_tools.recent_turns(user) == [] and memory_tools.get_user_facts(user) == []
