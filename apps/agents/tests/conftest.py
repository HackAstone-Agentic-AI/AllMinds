import os
import sys
import tempfile
from pathlib import Path

# Isolated, key-free environment for every test run.
_tmp = tempfile.mkdtemp(prefix="allminds-tests-")
os.environ["MEMORY_DB_PATH"] = str(Path(_tmp) / "memory.sqlite")
os.environ["RAG_INDEX_DIR"] = str(Path(_tmp) / "rag")
os.environ["RAG_WARM_ON_START"] = "false"
os.environ["ANONYMIZED_TELEMETRY"] = "False"
for key in ("GEMINI_API_KEY", "GROQ_API_KEY", "YOUTUBE_API_KEY"):
    os.environ.pop(key, None)

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


class FakeMessage:
    def __init__(self, content):
        self.content = content


class FakeLLM:
    """Records the messages it receives and returns a canned reply."""

    def __init__(self, reply="fake reply", chunks=None):
        self.reply = reply
        self.chunks = chunks or ["fake ", "reply"]
        self.calls = []

    def invoke(self, messages):
        self.calls.append(messages)
        return FakeMessage(self.reply)

    def stream(self, messages):
        self.calls.append(messages)
        for chunk in self.chunks:
            yield FakeMessage(chunk)
