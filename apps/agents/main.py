import truststore
truststore.inject_into_ssl()

import os
import uvicorn
from dotenv import load_dotenv
from pathlib import Path

from app.api.index import app

load_dotenv(Path(__file__).resolve().parents[2] / ".env")


if __name__ == "__main__":
    port = int(os.getenv("PORT", "8000"))
    reload = os.getenv("ENVIRONMENT", "development") != "production"
    uvicorn.run("app.api.index:app", host="0.0.0.0", port=port, reload=reload)
