import os, requests
from ..config import load_env

def get_headers():
    env = load_env()
    t = env.get("OTCS_TICKET")
    if not t:
        raise RuntimeError("Sem ticket OTCS. Faça login.")
    return {"otcsTicket": t}

def delete_member(member_id: str):
    base = load_env().get("OTCS_BASE_URL")
    if not base:
        raise RuntimeError("OTCS_BASE_URL ausente")
    url = f"{base}/members/{member_id}"
    return requests.delete(url, headers=get_headers(), timeout=30)

def has_auth():
    return bool(load_env().get("OTCS_TICKET"))
