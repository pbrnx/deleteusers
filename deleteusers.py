import csv
import time
import requests

BASE_URL = "https://otcs.g115-test.opentext.cloud/cs/cs/api/v2"
TICKET = "2ee0f02e8838de919d04b440ec11899e68a19c0807b1824cf1f103b653fffa840989771140dc9e30d2ac84e4d21d6d5a97a7f4f79ae6e7c928dafa3e7de02e5f"

HEADERS = {
    "otcsTicket": TICKET
}

CSV_ENTRADA = "data/created_users.csv"  # arquivo gerado pelo script de criação

with open(CSV_ENTRADA, newline="", encoding="utf-8-sig") as f:
    reader = csv.DictReader(f)
    for row in reader:
        user_id = row["userid"].strip()
        username = row["username"].strip()
        
        if not user_id.isdigit():
            print(f"[SKIP] Linha inválida: {row}")
            continue
        
        url = f"{BASE_URL}/members/{user_id}"
        resp = requests.delete(url, headers=HEADERS)
        
        if resp.status_code in (200, 202, 204):
            print(f"[OK] {username} (ID {user_id}) deletado")
        else:
            print(f"[ERRO] {username} (ID {user_id}) -> status {resp.status_code} body={resp.text[:200]}")
        
        time.sleep(0.2)  # pequena pausa para evitar throttling

print("\nProcesso de deleção concluído.")
