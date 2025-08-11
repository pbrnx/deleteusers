import csv
import time
from datetime import datetime
import requests
from urllib.parse import urlencode

BASE_URL = "https://otcs.g115-test.opentext.cloud/cs/cs/api/v2"
TICKET = "2ee0f02e8838de919d04b440ec11899e68a19c0807b1824cf1f103b653fffa840989771140dc9e30d2ac84e4d21d6d5a97a7f4f79ae6e7c928dafa3e7de02e5f"

HEADERS = {
    "Content-Type": "application/x-www-form-urlencoded",
    "otcsTicket": TICKET
}

CSV_ENTRADA = "data/users.csv"       # CSV de entrada: name,business_email
CSV_SAIDA = "data/created_users.csv"    # CSV de saída: userid,username

resultados = []

with open(CSV_ENTRADA, newline="", encoding="utf-8-sig") as f:
    reader = csv.DictReader(f)
    for row in reader:
        name = row["name"].strip()
        email = row["business_email"].strip()
        group_id = row.get("group_id", "2001")
        
        username = f"{name}"
        
        payload = {
            "type": 0,
            "name": username,
            "new_user": "",
            "group_id": group_id,
            "business_email": email,
            "privilege_login": "true",
            "privilege_public_access": "true"
        }
        
        resp = requests.post(f"{BASE_URL}/members", headers=HEADERS, data=urlencode(payload))
        
        try:
            user_id = resp.json()["results"]["data"]["properties"]["id"]
            print(f"[OK] {username} -> id {user_id}")
            resultados.append({
                "userid": user_id,
                "username": username
            })
        except Exception:
            print(f"[ERRO] {username} -> status {resp.status_code} body={resp.text[:200]}")
        
        time.sleep(0.2)  # pequena pausa para evitar throttling

# grava saída
with open(CSV_SAIDA, "w", newline="", encoding="utf-8") as f:
    writer = csv.DictWriter(f, fieldnames=["userid", "username"])
    writer.writeheader()
    writer.writerows(resultados)

print(f"\nConcluído. {len(resultados)} usuários criados. Resultado salvo em {CSV_SAIDA}")
