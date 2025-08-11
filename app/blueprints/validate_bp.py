from flask import Blueprint, request, jsonify
import json
from ..services import csv_tools
from ..services.otcs import has_auth

bp = Blueprint("validate", __name__)

@bp.post("/validate")
def validate():
    if not has_auth():
        return jsonify({"error":"unauthorized"}), 401
    f = request.files.get("file")
    mapping = json.loads(request.form.get("mapping") or "{}")
    if not f: return jsonify({"error":"file ausente"}), 400
    text = f.stream.read().decode("utf-8", errors="ignore")
    return jsonify(csv_tools.validate(text, mapping))
