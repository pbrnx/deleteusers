# app/blueprints/jobs_bp.py
from flask import Blueprint, request, jsonify, Response, send_file, abort
import json, hashlib, time
from ..services.workers import JOBS, start_delete_job, LOG_DIR
from ..services.otcs import has_auth

bp = Blueprint("jobs", __name__)

@bp.post("/execute")
def execute():
    if not has_auth():
        return jsonify({"error": "unauthorized"}), 401

    f = request.files.get("file")
    mapping_raw = request.form.get("mapping") or "{}"

    if not f:
        return jsonify({"error": "file ausente"}), 400

    try:
        mapping = json.loads(mapping_raw)
    except Exception:
        return jsonify({"error": "mapping inválido"}), 400

    data = f.read()
    job_id = hashlib.sha1((str(time.time()) + str(len(data))).encode()).hexdigest()[:12]

    # estado inicial
    JOBS.set(job_id, {
        "job_id": job_id,
        "status": "queued",
        "progress": 0,
        "total": 0,
        "ok": 0,
        "err": 0,
        "log": []
    })

    start_delete_job(job_id, data, mapping)
    return jsonify({"jobId": job_id})

@bp.get("/jobs/<job_id>")
def job_snapshot(job_id):
    job = JOBS.get(job_id)
    if not job:
        return jsonify({"error": "not_found"}), 404
    return jsonify(job)

@bp.get("/jobs/<job_id>/log")
def job_log(job_id):
    path = LOG_DIR / f"{job_id}.log"
    # debug opcional:
    # print("[job_log] path =", path)
    if not path.exists():
        abort(404)
    return send_file(
        str(path),
        as_attachment=True,
        download_name=f"{job_id}.log",
        mimetype="text/plain"
    )

@bp.get("/jobs/<job_id>/stream")
def stream(job_id):
    def gen():
        # sugere reconexão em 10s se a conexão cair
        yield "retry: 10000\n\n"
        last = None
        while True:
            job = JOBS.get(job_id)
            if not job:
                yield "event: done\ndata: {}\n\n"
                break

            payload = json.dumps({
                "status": job.get("status"),
                "progress": job.get("progress"),
                "ok": job.get("ok", 0),
                "err": job.get("err", 0),
                "total": job.get("total", 0),
            })

            if payload != last:
                yield f"data: {payload}\n\n"
                last = payload
            else:
                # heartbeat para manter conexões/proxies vivos
                yield ": keep-alive\n\n"

            if job.get("status") in ("done", "error"):
                yield f"event: done\ndata: {payload}\n\n"
                break

            time.sleep(1.0)

    headers = {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
    }
    return Response(gen(), headers=headers)
