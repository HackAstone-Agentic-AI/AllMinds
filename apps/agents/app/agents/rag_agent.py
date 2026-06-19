from dotenv import load_dotenv
import os
from pathlib import Path
from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_community.vectorstores import Chroma
from langchain_core.prompts import PromptTemplate
from langchain_google_genai import ChatGoogleGenerativeAI

load_dotenv()

PDF_PATH = Path(__file__).resolve().parent / "DCAPS.pdf"

_db = None


def _get_db():
    global _db
    if _db is None:
        loader = PyPDFLoader(str(PDF_PATH))
        documents = loader.load()
        splitter = RecursiveCharacterTextSplitter(
            chunk_size=500, chunk_overlap=100, separators=["\n\n", "\n", " ", ""]
        )
        chunks = splitter.split_documents(documents)
        embeddings_model = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")
        _db = Chroma.from_documents(
            documents=chunks,
            embedding=embeddings_model,
            persist_directory="vector_db",
        )
    return _db


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


def answer_question(question: str) -> str:
    db = _get_db()
    results = db.similarity_search(question, k=3)
    context = "\n\n".join(doc.page_content for doc in results)

    prompt = PromptTemplate.from_template(PROMPT_TEMPLATE).format(
        context=context,
        question=question,
    )

    model = ChatGoogleGenerativeAI(
        model="gemini-2.5-flash",
        google_api_key=os.getenv("GEMINI_API_KEY"),
        temperature=0.5,
    )
    response = model.invoke(prompt)
    return response.content


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
        answer = answer_question(user_input)
    except Exception as exc:
        return {
            "output": f"RAG lookup failed: {exc}",
            "status": "error",
        }

    return {
        "output": answer.strip(),
        "status": "ok",
    }
