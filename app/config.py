import os
from pathlib import Path
from dotenv import load_dotenv, set_key

ENV_PATH = Path(".env")

def load_env():
    if ENV_PATH.exists():
        load_dotenv(ENV_PATH)
    return {
        "OTCS_BASE_URL": os.getenv("OTCS_BASE_URL", ""),  # ex.: https://.../cs/cs
        "OTCS_TICKET": os.getenv("OTCS_TICKET", ""),
        "COOKIE": os.getenv("COOKIE", ""),
        "payload": os.getenv("payload", ""),  # compat com seu auth.py
    }

def save_env(kv: dict):
    if not ENV_PATH.exists():
        ENV_PATH.write_text("")
    for k, v in kv.items():
        set_key(str(ENV_PATH), k, v or "")
