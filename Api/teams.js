// api/teams.js
import { buildEngine, HISTORICAL_DATA } from "../lib/engine.js";

const { stats, elo } = buildEngine(HISTORICAL_DATA);

export default function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.status(200).end();

  const league = req.query.league || null;

  const matches = league
    ? HISTORICAL_DATA.filter(m => m.league === league)
    : HISTORICAL_DATA;

  const teamSet = new Set();
  matches.forEach(m => { teamSet.add(m.home); teamSet.add(m.away); });

  const teams = [...teamSet].sort().map(t => {
    const s = stats.summary(t);
    return {
      name: t,
      elo: Math.round(elo.get(t)),
      form: +(stats.form(t)*100).toFixed(1),
      ...s,
    };
  }).sort((a,b) => b.elo - a.elo);

  return res.status(200).json({ ok: true, total: teams.length, teams });
}
