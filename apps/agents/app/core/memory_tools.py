# app/core/memory_tools.py
import sqlite3
from langchain_core.tools import tool

def setup_ltm_database():
    """Creates the long-term memory table if it doesn't exist."""
    conn = sqlite3.connect("thandi_memory.sqlite", check_same_thread=False)
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS long_term_memory (
            user_id TEXT,
            fact TEXT,
            UNIQUE(user_id, fact)
        )
    """)
    conn.commit()
    conn.close()

# 1. The Tool the AI will use to save facts
@tool
def save_user_fact(user_id: str, fact: str):
    """Use this tool to save important, permanent facts about the user (e.g., their name, what they are building, their preferences)."""
    conn = sqlite3.connect("thandi_memory.sqlite", check_same_thread=False)
    cursor = conn.cursor()
    cursor.execute("INSERT OR IGNORE INTO long_term_memory (user_id, fact) VALUES (?, ?)", (user_id, fact))
    conn.commit()
    conn.close()
    return f"Fact saved to long-term memory: {fact}"

# 2. The utility we use to pull facts before the AI speaks
def get_user_facts(user_id: str):
    """Retrieves all saved facts for a specific user."""
    conn = sqlite3.connect("thandi_memory.sqlite", check_same_thread=False)
    cursor = conn.cursor()
    cursor.execute("SELECT fact FROM long_term_memory WHERE user_id = ?", (user_id,))
    facts = cursor.fetchall()
    conn.close()
    return [fact[0] for fact in facts]

# Auto-run the setup when this file is imported!
setup_ltm_database()