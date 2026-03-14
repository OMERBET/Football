// api/leagues.js
import { HISTORICAL_DATA, LEAGUES_META } from "../lib/engine.js";

export default function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.status(200).end();

  const leagueMap = {};
  for (const m of HISTORICAL_DATA) {
    if (!leagueMap[m.league]) leagueMap[m.league] = new Set();
    leagueMap[m.league].add(m.home);
    leagueMap[m.league].add(m.away);
  }

  const leagues = Object.entries(leagueMap).map(([name, teams]) => ({
    name,
    teams: [...teams].sort(),
    team_count: teams.size,
    match_count: HISTORICAL_DATA.filter(m => m.league === name).length,
    ...( LEAGUES_META[name] || {} ),
  })).sort((a,b) => (a.tier||9)-(b.tier||9) || b.match_count-a.match_count);

  return res.status(200).json({ ok: true, total: leagues.length, leagues });
}
