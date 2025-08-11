from flask import Blueprint, request, jsonify
import requests
from ..config import load_env, save_env

bp = Blueprint("auth", __name__)

@bp.get("/status")
def status():
    env = load_env()
    ok = bool(env.get("OTCS_TICKET"))
    return jsonify({"status": "ok" if ok else "none"})

@bp.post("/login")
def login():
    data = request.get_json(force=True, silent=True) or {}
    username = (data.get("username") or "").strip()
    password = (data.get("password") or "").strip()
    environment = (data.get("environment") or "").strip().rstrip("/")
    if not username or not password or not environment:
        return jsonify({"error": "Campos obrigatórios"}), 400

    url = f"{environment}/api/v1/auth"
    payload = f"username={username}&password={password}"
    headers = {"Content-Type": "application/x-www-form-urlencoded", "Cookie": "GCLB=CKuulMvno7HeERAD"}

    try:
        r = requests.post(url, headers=headers, data=payload, timeout=10)
        j = r.json() if r.headers.get("content-type","").startswith("application/json") else {}
        token = j.get("ticket")
        if not token:
            return jsonify({"error": "Credenciais inválidas"}), 401

        save_env({
            "OTCS_TICKET": token,
            "OTCS_BASE_URL": environment + "/api/v2",
            "COOKIE": headers["Cookie"],
            "payload": payload,
        })
        return jsonify({"status": "ok"})
    except Exception as e:
        return jsonify({"error": f"Falha no login: {e}"}), 500

@bp.post("/logout")
def logout():
    save_env({"OTCS_TICKET": ""})
    return jsonify({"status": "ok"})
