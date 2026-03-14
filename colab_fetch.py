import requests, json, csv, time
from datetime import datetime, timedelta
from pathlib import Path

API_KEY = "cd239636ed63404292a9faa481500265"
BASE    = "https://api.football-data.org/v4"
HEADERS = {"X-Auth-Token": API_KEY}

LEAGUES = {
    "PL":  "Premier League",
    "PD":  "La Liga",
    "SA":  "Serie A",
    "BL1": "Bundesliga",
    "FL1": "Ligue 1",
    "DED": "Eredivisie",
    "PPL": "Primeira Liga",
    "CL":  "Champions League",
}

SEASONS = [2024, 2023, 2022, 2021, 2020]

Path("data").mkdir(exist_ok=True)

def api_get(path):
    try:
        r = requests.get(f"{BASE}{path}", headers=HEADERS, timeout=15)
        if r.status_code == 429:
            print("  ⏳ Rate limit — انتظر 60 ثانية...")
            time.sleep(61)
            return api_get(path)
        if r.status_code in (403, 404):
            return None
        r.raise_for_status()
        return r.json()
    except Exception as e:
        print(f"  ❌ {e}")
        return None

# ── تحميل التاريخية ──
rows = []
print("📚 تحميل البيانات التاريخية...\n")

for code, name in LEAGUES.items():
    for season in SEASONS:
        print(f"  {name} {season}...", end=" ", flush=True)
        data = api_get(f"/competitions/{code}/matches?season={season}&status=FINISHED")
        if not data:
            print("⚠️")
            time.sleep(2)
            continue
        count = 0
        for m in data.get("matches", []):
            ft = m.get("score", {}).get("fullTime", {})
            hg, ag = ft.get("home"), ft.get("away")
            if hg is None or ag is None:
                continue
            rows.append({
                "date": m.get("utcDate","")[:10],
                "league": name, "league_code": code, "season": season,
                "home": m["homeTeam"]["name"], "away": m["awayTeam"]["name"],
                "home_goals": int(hg), "away_goals": int(ag),
                "result": "H" if hg>ag else "D" if hg==ag else "A",
                "matchday": m.get("matchday",""),
            })
            count += 1
        print(f"✅ {count}")
        time.sleep(7)  # rate limit مجاني: 10 req/min

# ── تحميل القادمة ──
upcoming = []
today    = datetime.utcnow().date()
date_to  = (today + timedelta(days=14)).isoformat()
print(f"\n📅 المباريات القادمة حتى {date_to}...\n")

for code, name in LEAGUES.items():
    print(f"  {name}...", end=" ", flush=True)
    data = api_get(f"/competitions/{code}/matches?status=SCHEDULED&dateFrom={today}&dateTo={date_to}")
    if not data:
        print("⚠️")
        time.sleep(2)
        continue
    count = 0
    for m in data.get("matches", []):
        upcoming.append({
            "date": m.get("utcDate","")[:10],
            "time": m.get("utcDate","")[11:16]+" UTC",
            "league": name, "league_code": code,
            "matchday": m.get("matchday",""),
            "home": m["homeTeam"]["name"],
            "away": m["awayTeam"]["name"],
        })
        count += 1
    print(f"✅ {count}")
    time.sleep(7)

# ── حفظ الملفات ──
fields = ["date","league","league_code","season","home","away","home_goals","away_goals","result","matchday"]
with open("data/all_leagues.csv","w",newline="",encoding="utf-8") as f:
    w = csv.DictWriter(f, fieldnames=fields)
    w.writeheader()
    w.writerows(rows)

with open("data/upcoming.json","w",encoding="utf-8") as f:
    json.dump(upcoming, f, ensure_ascii=False, indent=2)

print(f"\n✅ تم الحفظ!")
print(f"   البيانات التاريخية : {len(rows):,} مباراة → data/all_leagues.csv")
print(f"   المباريات القادمة  : {len(upcoming)} مباراة → data/upcoming.json")

# ── تحميل الملفات من Colab ──
from google.colab import files
files.download("data/all_leagues.csv")
files.download("data/upcoming.json")
