// api/predict.js
import { buildEngine, predict, HISTORICAL_DATA } from "../lib/engine.js";

const { stats, elo } = buildEngine(HISTORICAL_DATA);

export default function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const body  = req.method === "POST" ? req.body : req.query;
    const home  = (body.home  || "").trim();
    const away  = (body.away  || "").trim();
    const nSims = parseInt(body.sims || "1000");

    if (!home || !away)
      return res.status(400).json({ error: "home و away مطلوبان" });
    if (home === away)
      return res.status(400).json({ error: "الفريقان يجب أن يكونا مختلفين" });

    const result = predict(home, away, stats, elo, Math.min(nSims, 1000));
    return res.status(200).json({ ok: true, data: result });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
