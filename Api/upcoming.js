// api/upcoming.js
// يجلب المباريات القادمة من football-data.org ويتوقعها مباشرة

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

// Cache بسيط في الذاكرة (5 دقائق)
let cache = null;
let cacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000;

async function fetchUpcoming() {
  const today   = new Date();
  const dateTo  = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000);
  const from    = today.toISOString().slice(0, 10);
  const to      = dateTo.toISOString().slice(0, 10);
  const matches = [];

  for (const [code, name] of Object.entries(LEAGUES)) {
    try {
      const url = `${BASE}/competitions/${code}/matches?status=SCHEDULED&dateFrom=${from}&dateTo=${to}`;
      const res = await fetch(url, { headers: { "X-Auth-Token": API_KEY } });
      if (!res.ok) continue;
      const data = await res.json();
      for (const m of (data.matches || [])) {
        matches.push({
          date:        m.utcDate?.slice(0, 10),
          time:        m.utcDate?.slice(11, 16) + " UTC",
          league:      name,
          league_code: code,
          matchday:    m.matchday,
          home:        m.homeTeam?.name,
          away:        m.awayTeam?.name,
        });
      }
      await new Promise(r => setTimeout(r, 500));
    } catch (_) {}
  }

  return matches;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const now = Date.now();
    if (!cache || now - cacheTime > CACHE_TTL) {
      cache     = await fetchUpcoming();
      cacheTime = now;
    }

    const { stats, elo } = buildEngine(HISTORICAL_DATA);
    const sims = parseInt(req.query.sims || "500");

    const predictions = cache
      .filter(m => m.home && m.away)
      .map(m => ({
        ...m,
        prediction: predict(m.home, m.away, stats, elo, Math.min(sims, 500)),
      }));

    return res.status(200).json({
      ok: true,
      total: predictions.length,
      date_range: {
        from: new Date().toISOString().slice(0, 10),
        to:   new Date(Date.now() + 14*24*60*60*1000).toISOString().slice(0, 10),
      },
      fixtures: predictions,
      generated: new Date().toISOString(),
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
