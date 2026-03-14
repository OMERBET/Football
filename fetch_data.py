#!/usr/bin/env python3
"""
fetch_data.py — جالب البيانات الحقيقية من football-data.org
=============================================================
يحمّل:
  - نتائج تاريخية (5 مواسم)
  - مباريات قادمة (الأسبوعين القادمين)

الاستخدام:
  python fetch_data.py
  python fetch_data.py --upcoming   # المباريات القادمة فقط
  python fetch_data.py --history    # التاريخية فقط
"""

import urllib.request, json, csv, time, sys, os
from datetime import datetime, timedelta
from pathlib import Path

API_KEY = "cd239636ed63404292a9faa481500265"
BASE    = "https://api.football-data.org/v4"
HEADERS = {"X-Auth-Token": API_KEY}

# ── الدوريات المتاحة في الخطة المجانية ──────────────────────────────────
LEAGUES = {
    "PL":  "Premier League",
    "PD":  "La Liga",
    "SA":  "Serie A",
    "BL1": "Bundesliga",
    "FL1": "Ligue 1",
    "DED": "Eredivisie",
    "PPL": "Primeira Liga",
    "CL":  "Champions League",
    "EC":  "European Championship",
    "WC":  "FIFA World Cup",
}

SEASONS = [2024, 2023, 2022, 2021, 2020]

OUTPUT_DIR      = Path("data")
HISTORY_FILE    = OUTPUT_DIR / "history.csv"
UPCOMING_FILE   = OUTPUT_DIR / "upcoming.json"
ALL_FILE        = OUTPUT_DIR / "all_leagues.csv"

def api_get(path: str) -> dict | None:
    url = f"{BASE}{path}"
    req = urllib.request.Request(url, headers=HEADERS)
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        if e.code == 429:
            print("  ⏳ Rate limit — انتظر 60 ثانية...")
            time.sleep(61)
            return api_get(path)
        elif e.code == 403:
            print(f"  ⚠️  غير مصرح: {path}")
            return None
        elif e.code == 404:
            return None
        else:
            print(f"  ❌ HTTP {e.code}: {path}")
            return None
    except Exception as ex:
        print(f"  ❌ خطأ: {ex}")
        return None

def fetch_history() -> list[dict]:
    OUTPUT_DIR.mkdir(exist_ok=True)
    rows = []

    print("\n📚 تحميل البيانات التاريخية...\n")
    for code, name in LEAGUES.items():
        for season in SEASONS:
            print(f"  {name:<22} {season}...", end=" ", flush=True)
            data = api_get(f"/competitions/{code}/matches?season={season}&status=FINISHED")
            if not data or "matches" not in data:
                print("⚠️  لا بيانات")
                time.sleep(1)
                continue

            matches = data["matches"]
            count = 0
            for m in matches:
                score = m.get("score", {})
                ft    = score.get("fullTime", {})
                hg    = ft.get("home")
                ag    = ft.get("away")
                if hg is None or ag is None:
                    continue
                rows.append({
                    "date":        m.get("utcDate", "")[:10],
                    "league":      name,
                    "league_code": code,
                    "season":      season,
                    "home":        m["homeTeam"]["name"],
                    "away":        m["awayTeam"]["name"],
                    "home_goals":  int(hg),
                    "away_goals":  int(ag),
                    "result":      "H" if hg > ag else "D" if hg == ag else "A",
                    "matchday":    m.get("matchday", ""),
                    "home_id":     m["homeTeam"]["id"],
                    "away_id":     m["awayTeam"]["id"],
                })
                count += 1

            print(f"✅ {count} مباراة")
            time.sleep(6)  # rate limit: 10 req/min في الخطة المجانية

    # حفظ CSV
    if rows:
        fields = ["date","league","league_code","season","home","away",
                  "home_goals","away_goals","result","matchday","home_id","away_id"]
        with open(HISTORY_FILE, "w", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=fields)
            w.writeheader()
            w.writerows(rows)
        # نسخ لـ all_leagues.csv أيضاً
        with open(ALL_FILE, "w", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=fields)
            w.writeheader()
            w.writerows(rows)
        print(f"\n✅ حُفظت {len(rows):,} مباراة تاريخية → {HISTORY_FILE}")
    else:
        print("\n⚠️  لم يتم تحميل أي بيانات تاريخية")

    return rows

def fetch_upcoming() -> list[dict]:
    OUTPUT_DIR.mkdir(exist_ok=True)
    upcoming = []

    today     = datetime.utcnow().date()
    date_from = today.isoformat()
    date_to   = (today + timedelta(days=14)).isoformat()

    print(f"\n📅 تحميل المباريات القادمة ({date_from} → {date_to})...\n")

    for code, name in LEAGUES.items():
        print(f"  {name:<22}...", end=" ", flush=True)
        data = api_get(f"/competitions/{code}/matches?status=SCHEDULED&dateFrom={date_from}&dateTo={date_to}")
        if not data or "matches" not in data:
            print("⚠️  لا مباريات")
            time.sleep(1)
            continue

        matches = data["matches"]
        count = 0
        for m in matches:
            upcoming.append({
                "date":        m.get("utcDate", "")[:10],
                "time":        m.get("utcDate", "")[11:16] + " UTC",
                "league":      name,
                "league_code": code,
                "matchday":    m.get("matchday", ""),
                "home":        m["homeTeam"]["name"],
                "away":        m["awayTeam"]["name"],
                "home_id":     m["homeTeam"]["id"],
                "away_id":     m["awayTeam"]["id"],
                "status":      m.get("status", ""),
            })
            count += 1

        print(f"✅ {count} مباراة قادمة")
        time.sleep(6)

    if upcoming:
        with open(UPCOMING_FILE, "w", encoding="utf-8") as f:
            json.dump(upcoming, f, ensure_ascii=False, indent=2)
        print(f"\n✅ حُفظت {len(upcoming)} مباراة قادمة → {UPCOMING_FILE}")

        # عرض جدول المباريات القادمة
        print("\n📋 المباريات القادمة:\n")
        print(f"{'التاريخ':<12} {'الدوري':<20} {'المباراة'}")
        print("─" * 65)
        for m in sorted(upcoming, key=lambda x: x["date"]):
            print(f"  {m['date']}  {m['league']:<20} {m['home']} vs {m['away']}")
    else:
        print("\n⚠️  لا توجد مباريات قادمة في هذه الفترة")

    return upcoming

def main():
    args = sys.argv[1:]
    print("⚽ Football Data Fetcher — football-data.org")
    print(f"   API Key: {API_KEY[:8]}...")
    print(f"   الوقت:   {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}\n")

    if "--upcoming" in args:
        fetch_upcoming()
    elif "--history" in args:
        fetch_history()
    else:
        fetch_history()
        fetch_upcoming()

    print("\n🏁 اكتمل التحميل!")
    print(f"   البيانات التاريخية : data/all_leagues.csv")
    print(f"   المباريات القادمة  : data/upcoming.json")
    print(f"\nالخطوة التالية:")
    print(f"   python server.py   ← شغّل الواجهة")

if __name__ == "__main__":
    main()
