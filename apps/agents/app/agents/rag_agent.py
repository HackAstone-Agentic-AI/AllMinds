import hashlib
import logging
import os
import re
import sys
import threading
from pathlib import Path

from dotenv import load_dotenv
from langchain_core.prompts import PromptTemplate
from langchain_google_genai import ChatGoogleGenerativeAI
from app.core.models import STANDARD_MODEL

load_dotenv()
# Chroma's anonymous telemetry is noisy in logs and not wanted for school data.
os.environ.setdefault("ANONYMIZED_TELEMETRY", "False")

logger = logging.getLogger(__name__)

PDF_PATH = Path(__file__).resolve().parent / "DCAPS.pdf"
# Outside the source tree so it can be built once (e.g. at deploy time) and reused.
INDEX_DIR = Path(os.getenv("RAG_INDEX_DIR", Path(__file__).resolve().parents[2] / "vector_db" / "dcaps"))
COLLECTION_NAME = "dcaps"
EMBEDDING_MODEL = os.getenv("RAG_EMBEDDING_MODEL", "all-MiniLM-L6-v2")
TOP_K = 3

_db = None
_lock = threading.Lock()
_status = "cold"  # cold | warming | ready | error


def _default_embeddings():
    from langchain_huggingface import HuggingFaceEmbeddings
    return HuggingFaceEmbeddings(model_name=EMBEDDING_MODEL)


def _load_chunks():
    from langchain_community.document_loaders import PyPDFLoader
    from langchain_text_splitters import RecursiveCharacterTextSplitter

    documents = PyPDFLoader(str(PDF_PATH)).load()
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=500, chunk_overlap=100, separators=["\n\n", "\n", " ", ""]
    )
    chunks = splitter.split_documents(documents)
    for index, chunk in enumerate(chunks):
        chunk.metadata["chunk"] = index
    return chunks


def _chunk_id(chunk) -> str:
    # Deterministic ids make re-indexing an upsert, so restarts never duplicate vectors.
    key = f"{chunk.metadata.get('page')}:{chunk.metadata.get('chunk')}:{chunk.page_content}"
    return hashlib.sha1(key.encode("utf-8")).hexdigest()


def _open_store(embeddings):
    from langchain_community.vectorstores import Chroma

    INDEX_DIR.mkdir(parents=True, exist_ok=True)
    return Chroma(
        collection_name=COLLECTION_NAME,
        embedding_function=embeddings,
        persist_directory=str(INDEX_DIR),
    )


def build_index(embeddings=None) -> int:
    """Create or refresh the persisted DCAPS index. Safe to run repeatedly."""
    store = _open_store(embeddings or _default_embeddings())
    chunks = _load_chunks()
    ids = [_chunk_id(chunk) for chunk in chunks]
    if store._collection.count() == len(chunks) and store._collection.get(ids=ids[:1])["ids"]:
        logger.info("RAG index already up to date (%d chunks)", len(chunks))
        return len(chunks)
    store.add_documents(chunks, ids=ids)
    logger.info("RAG index built with %d chunks at %s", len(chunks), INDEX_DIR)
    return len(chunks)


def _get_db(embeddings=None):
    global _db, _status
    with _lock:
        if _db is None:
            _status = "warming"
            try:
                embeddings = embeddings or _default_embeddings()
                store = _open_store(embeddings)
                if store._collection.count() == 0:
                    # First run without a prebuilt index: build it now (slow, once).
                    build_index(embeddings)
                _db = store
                _status = "ready"
            except Exception:
                _status = "error"
                raise
    return _db


def warm_up() -> None:
    """Load (or build) the index in the background so the first question is fast."""
    def _run():
        try:
            _get_db()
        except Exception as exc:
            logger.warning("RAG warm-up failed: %s", exc)

    threading.Thread(target=_run, name="rag-warm-up", daemon=True).start()


def rag_status() -> str:
    return _status


PROMPT_TEMPLATE = """
You are an assistant that answers questions based on the following context:
Use only the information provided in the context to answer the question.
Do not make anything up or include external information.
Context: {context}
Question: {question}
Answer:
"""

FALLBACK_RESPONSE = (
    "It looks like your message came through empty. "
    "Ask me anything about the DCAPS document and I'll do my best to help."
)


def retrieve(question: str) -> tuple[str, list[dict]]:
    """Top-k chunks joined as context, plus page citations for the UI."""
    results = _get_db().similarity_search(question, k=TOP_K)
    context = "\n\n".join(doc.page_content for doc in results)
    sources = []
    seen_pages = set()
    for doc in results:
        page = doc.metadata.get("page")
        page_number = int(page) + 1 if isinstance(page, (int, float)) else None
        if page_number in seen_pages:
            continue
        seen_pages.add(page_number)
        sources.append({
            "document": "DCAPS",
            "page": page_number,
            # Drop PDF private-use glyphs (bullet icons) before showing the excerpt.
            "excerpt": " ".join(re.sub(r"[\ue000-\uf8ff]", " ", doc.page_content).split())[:160],
        })
    return context, sources


def answer_question(question: str) -> tuple[str, list[dict]]:
    context, sources = retrieve(question)

    prompt = PromptTemplate.from_template(PROMPT_TEMPLATE).format(
        context=context,
        question=question,
    )

    model = ChatGoogleGenerativeAI(
        model=STANDARD_MODEL,
        google_api_key=os.getenv("GEMINI_API_KEY"),
        temperature=0.5,
        timeout=60,
        max_retries=2,
    )
    response = model.invoke(prompt)
    return response.content, sources


def rag_agent(state: dict) -> dict:
    user_input = state.get("input", "").strip()

    if not user_input:
        return {
            "output": FALLBACK_RESPONSE,
            "status": "no_input",
        }

    if not os.getenv("GEMINI_API_KEY"):
        return {
            "output": "GEMINI_API_KEY is missing. Add it to your environment before running chat requests.",
            "status": "error",
        }

    try:
        answer, sources = answer_question(user_input)
    except Exception as exc:
        logger.exception("RAG lookup failed: %s", exc)
        return {
            "output": "The curriculum lookup failed. Please try again in a moment.",
            "status": "error",
        }

    return {
        "output": answer.strip(),
        "sources": sources,
        "status": "ok",
    }


if __name__ == "__main__":
    # Build the index ahead of time, e.g. in the deploy build step:
    #   python -m app.agents.rag_agent build
    if len(sys.argv) > 1 and sys.argv[1] == "build":
        logging.basicConfig(level=logging.INFO)
        print(f"Indexed {build_index()} chunks into {INDEX_DIR}")
    else:
        print("Usage: python -m app.agents.rag_agent build")
