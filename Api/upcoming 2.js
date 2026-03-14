// api/upcoming.js
// يجلب المباريات القادمة من football-data.org ويتوقعها بالبيانات التاريخية

import { buildEngine, predict, HISTORICAL_DATA } from "./engine.js";

const API_KEY = "cd239636ed63404292a9faa481500265";
const BASE    = "https://api.football-data.org/v4";

const LEAGUES = {
  PL:  "Premier League",
  PD:  "La Liga",
  SA:  "Serie A",
  BL1: "Bundesliga",
  FL1: "Ligue 1",
  DED: "Eredivisie",
  PPL: "Primeira Liga",
  CL:  "Champions League",
};

// ── خريطة أسماء الفرق: API → بياناتنا ──────────────────────────────────
const TEAM_MAP = {
  // Premier League
  "Manchester City FC":          "Man City",
  "Arsenal FC":                  "Arsenal",
  "Liverpool FC":                "Liverpool",
  "Chelsea FC":                  "Chelsea",
  "Manchester United FC":        "Man Utd",
  "Tottenham Hotspur FC":        "Tottenham",
  "Newcastle United FC":         "Newcastle",
  "Aston Villa FC":              "Aston Villa",
  "Brighton & Hove Albion FC":   "Brighton",
  "West Ham United FC":          "West Ham",
  "Wolverhampton Wanderers FC":  "Wolves",
  "Everton FC":                  "Everton",
  "Leicester City FC":           "Leicester",
  "Crystal Palace FC":           "Crystal Palace",
  "Brentford FC":                "Brentford",
  "Fulham FC":                   "Fulham",
  "Nottingham Forest FC":        "Nottingham Forest",
  "AFC Bournemouth":             "Bournemouth",
  "Ipswich Town FC":             "Ipswich",
  "Southampton FC":              "Southampton",
  // La Liga
  "FC Barcelona":                "Barcelona",
  "Real Madrid CF":              "Real Madrid",
  "Club Atlético de Madrid":     "Atletico Madrid",
  "Sevilla FC":                  "Sevilla",
  "Real Betis Balompié":         "Betis",
  "Real Sociedad de Fútbol":     "Real Sociedad",
  "Athletic Club":               "Athletic Club",
  "Villarreal CF":               "Villarreal",
  "Valencia CF":                 "Valencia",
  "Girona FC":                   "Girona",
  "Rayo Vallecano de Madrid":    "Rayo Vallecano",
  "RCD Mallorca":                "Mallorca",
  "Getafe CF":                   "Getafe",
  "CA Osasuna":                  "Osasuna",
  "UD Las Palmas":               "Las Palmas",
  "Real Valladolid CF":          "Valladolid",
  "CD Leganés":                  "Leganes",
  "RCD Espanyol de Barcelona":   "Espanyol",
  "Deportivo Alavés":            "Alaves",
  "Real Celta de Vigo":          "Celta Vigo",
  // Serie A
  "Juventus FC":                 "Juventus",
  "FC Internazionale Milano":    "Inter Milan",
  "AC Milan":                    "AC Milan",
  "SSC Napoli":                  "Napoli",
  "AS Roma":                     "Roma",
  "SS Lazio":                    "Lazio",
  "Atalanta BC":                 "Atalanta",
  "ACF Fiorentina":              "Fiorentina",
  "Bologna FC 1909":             "Bologna",
  "Torino FC":                   "Torino",
  // Bundesliga
  "FC Bayern München":           "Bayern Munich",
  "Borussia Dortmund":           "Dortmund",
  "RB Leipzig":                  "RB Leipzig",
  "Bayer 04 Leverkusen":         "Leverkusen",
  "Eintracht Frankfurt":         "Frankfurt",
  "VfB Stuttgart":               "Stuttgart",
  "VfL Wolfsburg":               "Wolfsburg",
  "SC Freiburg":                 "Freiburg",
  "FC Augsburg":                 "Augsburg",
  "1. FC Union Berlin":          "Union Berlin",
  // Ligue 1
  "Paris Saint-Germain FC":      "PSG",
  "Olympique de Marseille":      "Marseille",
  "Olympique Lyonnais":          "Lyon",
  "AS Monaco FC":                "Monaco",
  "OGC Nice":                    "Nice",
  "RC Lens":                     "Lens",
  "Stade Rennais FC 1901":       "Rennes",
  "LOSC Lille":                  "Lille",
  // Eredivisie
  "AFC Ajax":                    "Ajax",
  "PSV Eindhoven":               "PSV",
  "Feyenoord Rotterdam":         "Feyenoord",
  "AZ Alkmaar":                  "AZ Alkmaar",
  // Primeira Liga
  "FC Porto":                    "Porto",
  "SL Benfica":                  "Benfica",
  "Sporting CP":                 "Sporting CP",
  // Champions League (نفس الأسماء أعلاه)
};

function mapTeam(apiName) {
  return TEAM_MAP[apiName] || apiName;
}

// ── Cache ────────────────────────────────────────────────────────────────
let cache = null, cacheTime = 0;
const CACHE_TTL = 10 * 60 * 1000; // 10 دقائق

async function fetchUpcoming() {
  const today  = new Date();
  const dateTo = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000);
  const from   = today.toISOString().slice(0, 10);
  const to     = dateTo.toISOString().slice(0, 10);
  const all    = [];

  for (const [code, name] of Object.entries(LEAGUES)) {
    try {
      const url = `${BASE}/competitions/${code}/matches?status=SCHEDULED&dateFrom=${from}&dateTo=${to}`;
      const res = await fetch(url, {
        headers: { "X-Auth-Token": API_KEY },
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) continue;
      const data = await res.json();
      for (const m of (data.matches || [])) {
        const homeRaw = m.homeTeam?.name || "";
        const awayRaw = m.awayTeam?.name || "";
        all.push({
          date:        m.utcDate?.slice(0, 10),
          time:        m.utcDate?.slice(11, 16) + " UTC",
          league:      name,
          league_code: code,
          matchday:    m.matchday,
          home_raw:    homeRaw,
          away_raw:    awayRaw,
          home:        mapTeam(homeRaw),
          away:        mapTeam(awayRaw),
        });
      }
      await new Promise(r => setTimeout(r, 400));
    } catch (_) {}
  }
  return all;
}

// ── Handler ───────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin",  "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    // بناء المحرك من البيانات التاريخية
    const { stats, elo } = buildEngine(HISTORICAL_DATA);

    // جلب المباريات القادمة مع cache
    const now = Date.now();
    if (!cache || now - cacheTime > CACHE_TTL) {
      cache     = await fetchUpcoming();
      cacheTime = now;
    }

    const sims = Math.min(parseInt(req.query.sims || "500"), 500);

    // توقع كل مباراة قادمة بناءً على البيانات التاريخية
    const fixtures = cache
      .filter(m => m.home && m.away)
      .map(m => {
        const pred = predict(m.home, m.away, stats, elo, sims);
        return {
          date:        m.date,
          time:        m.time,
          league:      m.league,
          league_code: m.league_code,
          matchday:    m.matchday,
          home:        m.home,
          away:        m.away,
          home_raw:    m.home_raw,
          away_raw:    m.away_raw,
          // التوقع
          probabilities:  pred.probabilities,
          expected_goals: pred.expected_goals,
          team_strength:  pred.team_strength,
          monte_carlo:    pred.monte_carlo,
          best_prediction:pred.best_prediction,
          confidence:     pred.confidence,
        };
      })
      .sort((a, b) => a.date?.localeCompare(b.date));

    // تجميع حسب الدوري
    const byLeague = {};
    fixtures.forEach(f => {
      if (!byLeague[f.league]) byLeague[f.league] = [];
      byLeague[f.league].push(f);
    });

    return res.status(200).json({
      ok:         true,
      total:      fixtures.length,
      date_range: {
        from: new Date().toISOString().slice(0, 10),
        to:   new Date(Date.now() + 14*24*60*60*1000).toISOString().slice(0, 10),
      },
      by_league:  byLeague,
      fixtures,
      generated:  new Date().toISOString(),
      model:      "Trained on historical data → Predicting upcoming fixtures",
    });

  } catch (err) {
    return res.status(500).json({ error: err.message, stack: err.stack });
  }
}
