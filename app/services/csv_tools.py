import csv, io, re
EMAIL_RE = re.compile(r"^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$", re.I)

def parse(text: str, max_rows=5000):
    rows = list(csv.reader(io.StringIO(text)))
    return rows[: max_rows + 1]

def validate(text: str, mapping: dict):
    rows = parse(text)
    if not rows: return {"total":0, "validos":0, "invalidos":0}
    header, body = rows[0], rows[1:]
    idx = {h:i for i,h in enumerate(header)}
    def get(row, key):
        h = mapping.get(key) or ""
        if h not in idx: return ""
        i = idx[h]; return (row[i] if i < len(row) else "").strip()

    total = len(body); invalid = 0
    seen_id, seen_user = set(), set()
    for r in body:
        bad = False
        if not get(r,"username") or not get(r,"id"): bad = True
        em = get(r,"email")
        if not bad and em and not EMAIL_RE.match(em): bad = True
        vid, vuser = get(r,"id"), get(r,"username")
        if not bad and vid:
            if vid in seen_id: bad=True
            else: seen_id.add(vid)
        if not bad and vuser:
            if vuser in seen_user: bad=True
            else: seen_user.add(vuser)
        if bad: invalid += 1
    return {"total": total, "validos": total-invalid, "invalidos": invalid}
