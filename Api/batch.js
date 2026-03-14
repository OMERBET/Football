// api/batch.js
import { buildEngine, predict, HISTORICAL_DATA } from "../lib/engine.js";

const { stats, elo } = buildEngine(HISTORICAL_DATA);

export default function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")
    return res.status(405).json({ error: "POST فقط" });

  try {
    const { fixtures, sims = 500 } = req.body;
    if (!Array.isArray(fixtures) || !fixtures.length)
      return res.status(400).json({ error: "fixtures مطلوب (array)" });
    if (fixtures.length > 100)
      return res.status(400).json({ error: "الحد الأقصى 100 مباراة لكل طلب" });

    const n = Math.min(parseInt(sims), 500);
    const results = fixtures.map(f => {
      if (!f.home || !f.away || f.home === f.away)
        return { error: "بيانات غير صحيحة", fixture: f };
      return predict(f.home.trim(), f.away.trim(), stats, elo, n);
    });

    return res.status(200).json({
      ok: true,
      total: results.length,
      sims_per_match: n,
      predictions: results,
      generated: new Date().toISOString(),
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
