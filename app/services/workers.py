# app/services/workers.py
import os, sys, csv, io, threading
from pathlib import Path
from .otcs import delete_member

def _writable_root() -> Path:
    if getattr(sys, "frozen", False):
        # no pacote, escreve na pasta atual (onde o exe foi iniciado)
        try: return Path(os.getcwd()).resolve()
        except Exception: return Path(".").resolve()
    # dev: raiz do pacote app
    return Path(__file__).resolve().parents[1]

LOG_DIR = _writable_root() / "data" / "logs"
LOG_DIR.mkdir(parents=True, exist_ok=True)


class Jobs:
    def __init__(self):
        self.data = {}
        self._lock = threading.Lock()
    def update(self, job_id, **patch):
        with self._lock:
            self.data[job_id].update(patch)
    def set(self, job_id, value):
        with self._lock:
            self.data[job_id] = value
    def get(self, job_id):
        with self._lock:
            return dict(self.data.get(job_id, {}))

JOBS = Jobs()

def _log_path(job_id: str) -> Path:
    return LOG_DIR / f"{job_id}.log"

def _append_log(job_id: str, line: str):
    # grava e também mantém em memória
    with JOBS._lock:
        JOBS.data[job_id]["log"].append(line)
    with _log_path(job_id).open("a", encoding="utf-8") as fh:
        fh.write(line.rstrip("\n") + "\n")

def _sniff_delimiter(text: str) -> str:
    try:
        return csv.Sniffer().sniff(text.splitlines()[0]).delimiter
    except Exception:
        head = text.splitlines()[0] if text else ""
        return ";" if head.count(";") > head.count(",") else ("\t" if head.count("\t") > 1 else ",")

def start_delete_job(job_id: str, csv_bytes: bytes, mapping: dict):
    # cria/zera o arquivo de log
    _log_path(job_id).write_text(f"JOB {job_id} iniciado\n", encoding="utf-8")
    JOBS.set(job_id, {"job_id": job_id, "status":"running","progress":0,"total":0,"ok":0,"err":0,"log":[]})
    t = threading.Thread(target=_worker, args=(job_id, csv_bytes, mapping), daemon=True)
    t.start()

def _worker(job_id, csv_bytes, mapping):
    try:
        text = csv_bytes.decode("utf-8", errors="ignore")
        delim = _sniff_delimiter(text)
        rows = list(csv.reader(io.StringIO(text), delimiter=delim))
        if not rows:
            _append_log(job_id, "Nenhuma linha no CSV.")
            JOBS.update(job_id, status="done", progress=100, total=0, ok=0, err=0)
            _append_log(job_id, "STATUS: done")
            return

        header, body = rows[0], rows[1:]
        idx = {h:i for i,h in enumerate(header)}
        def get(row, key):
            h = mapping.get(key) or ""
            if h not in idx: return ""
            i = idx[h]; return (row[i] if i < len(row) else "").strip()

        total = len(body); ok = err = 0
        for n, r in enumerate(body, 1):
            member_id = get(r, "id")
            username  = get(r, "username") or "(sem username)"
            if not member_id or not member_id.isdigit():
                _append_log(job_id, f"SKIP linha {n}: id inválido ({member_id})")
                err += 1
            else:
                resp = delete_member(member_id)
                if resp.status_code in (200, 202, 204):
                    ok += 1
                    _append_log(job_id, f"OK {username} (ID {member_id})")
                else:
                    err += 1
                    _append_log(job_id, f"ERRO {username} (ID {member_id}) -> {resp.status_code}")

            JOBS.update(job_id,
                total=total, ok=ok, err=err,
                progress=round(n*100/max(total,1), 1)
            )

        JOBS.update(job_id, status="done", progress=100)
        _append_log(job_id, f"RESUMO: total={total} ok={ok} err={err}")
        _append_log(job_id, "STATUS: done")

    except Exception as e:
        _append_log(job_id, f"EXCEPTION: {e}")
        JOBS.update(job_id, status="error")
