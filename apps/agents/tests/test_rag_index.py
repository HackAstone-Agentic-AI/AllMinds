import importlib

from langchain_core.embeddings import DeterministicFakeEmbedding

rag = importlib.import_module("app.agents.rag_agent")


def test_index_build_is_idempotent_and_returns_page_citations():
    embeddings = DeterministicFakeEmbedding(size=32)
    count = rag.build_index(embeddings)
    assert count > 50
    rag.build_index(embeddings)  # rebuilding must not duplicate vectors
    assert rag._open_store(embeddings)._collection.count() == count

    rag._db = None
    rag._get_db(embeddings)
    assert rag.rag_status() == "ready"
    context, sources = rag.retrieve("assessment in Grade 1")
    assert context and sources
    assert all(src["document"] == "DCAPS" and isinstance(src["page"], int) for src in sources)
    assert all("" not in src["excerpt"] for src in sources)
