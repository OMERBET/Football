// lib/engine.js — Quantum-Inspired Football Prediction Engine
// يُستخدم من كل API endpoints

// ══════════════════════════════════════════════════
// Quantum Amplitude Encoding (Bloch Sphere)
// ══════════════════════════════════════════════════
export function quantumAmplitude(strength) {
  const theta = (1 - Math.max(0, Math.min(1, strength))) * (Math.PI / 2);
  return Math.cos(theta) ** 2;
}

export function quantumInterference(ah, aa) {
  const total = (ah + aa) || 1;
  const raw = [
    (ah / total) * 0.48 + 0.20,
    (1 - Math.abs(ah - aa) / total) * 0.28,
    (aa / total) * 0.48 + 0.04,
  ];
  const s = raw.reduce((a, b) => a + b, 0);
  return raw.map(x => x / s);
}

// ══════════════════════════════════════════════════
// ELO Rating
// ══════════════════════════════════════════════════
export class ELO {
  constructor() { this.ratings = {}; }
  get(t)        { return this.ratings[t] ?? 1500; }
  strength(t)   { return Math.max(0, Math.min(1, (this.get(t) - 1000) / 1000)); }
  expected(a,b) { return 1 / (1 + 10 ** ((b - a) / 400)); }
  update(home, away, result) {
    const ra = this.get(home), rb = this.get(away);
    const ea = this.expected(ra, rb);
    const sa = result === "H" ? 1 : result === "A" ? 0 : 0.5;
    this.ratings[home] = ra + 32 * (sa - ea);
    this.ratings[away] = rb + 32 * ((1 - sa) - (1 - ea));
  }
}

// ══════════════════════════════════════════════════
// Poisson + Dixon-Coles
// ══════════════════════════════════════════════════
function factorial(n) {
  let r = 1;
  for (let i = 2; i <= Math.min(n, 20); i++) r *= i;
  return r;
}
export function poisson(k, lam) {
  if (lam <= 0) return k === 0 ? 1 : 0;
  return Math.exp(-lam) * Math.pow(lam, k) / factorial(k);
}
export function dixonColes(x, y, mh, ma, rho = -0.13) {
  if (x===0&&y===0) return 1 - mh*ma*rho;
  if (x===1&&y===0) return 1 + ma*rho;
  if (x===0&&y===1) return 1 + mh*rho;
  if (x===1&&y===1) return 1 - rho;
  return 1;
}

// ══════════════════════════════════════════════════
// Monte Carlo
// ══════════════════════════════════════════════════
function gauss(mu, sig) {
  let u = 0, v = 0;
  while (!u) u = Math.random();
  while (!v) v = Math.random();
  return mu + sig * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
function randPoisson(lam) {
  const ws = Array.from({length:9}, (_,k) => poisson(k, lam));
  const s = ws.reduce((a,b)=>a+b,0);
  let r = Math.random()*s, cum = 0;
  for (let k=0; k<9; k++) { cum+=ws[k]; if (r<=cum) return k; }
  return 0;
}
export function monteCarlo(mh, ma, n = 1000) {
  let rH=0,rD=0,rA=0,ghT=0,gaT=0,hcT=0,acT=0,hkT=0,akT=0;
  const scores = {};
  for (let i=0; i<n; i++) {
    const hg=randPoisson(mh), ag=randPoisson(ma);
    ghT+=hg; gaT+=ag;
    const ix = Math.abs(hg-ag)*0.15+0.85;
    hcT+=Math.max(0,Math.round(gauss(1.8*ix,.6)));
    acT+=Math.max(0,Math.round(gauss(1.9*ix,.7)));
    hkT+=Math.max(0,Math.round(gauss(4.5+hg*.4,1.2)));
    akT+=Math.max(0,Math.round(gauss(4.2+ag*.4,1.2)));
    const key=`${hg}-${ag}`;
    scores[key] = (scores[key]||0)+1;
    if (hg>ag) rH++; else if (hg===ag) rD++; else rA++;
  }
  const topScores = Object.entries(scores)
    .sort((a,b)=>b[1]-a[1]).slice(0,5)
    .map(([s,c])=>({score:s, pct:+(c/n*100).toFixed(1)}));
  return {
    home_win_pct:    +(rH/n*100).toFixed(1),
    draw_pct:        +(rD/n*100).toFixed(1),
    away_win_pct:    +(rA/n*100).toFixed(1),
    exp_home_goals:  +(ghT/n).toFixed(2),
    exp_away_goals:  +(gaT/n).toFixed(2),
    exp_total_goals: +((ghT+gaT)/n).toFixed(2),
    exp_home_cards:  +(hcT/n).toFixed(2),
    exp_away_cards:  +(acT/n).toFixed(2),
    exp_home_corners:+(hkT/n).toFixed(2),
    exp_away_corners:+(akT/n).toFixed(2),
    top_scores: topScores,
    simulations: n,
  };
}

// ══════════════════════════════════════════════════
// Team Stats Store
// ══════════════════════════════════════════════════
export class TeamStats {
  constructor() {
    this.ha={}; this.hd={}; this.aa={}; this.ad={};
    this.results={};
  }
  _ensure(t) {
    if (!this.ha[t]) { this.ha[t]=[]; this.hd[t]=[]; this.aa[t]=[]; this.ad[t]=[]; this.results[t]=[]; }
  }
  add(home, away, hg, ag) {
    this._ensure(home); this._ensure(away);
    this.ha[home].push(hg); this.hd[home].push(ag);
    this.aa[away].push(ag); this.ad[away].push(hg);
    this.results[home].push(hg>ag?"W":hg===ag?"D":"L");
    this.results[away].push(ag>hg?"W":ag===hg?"D":"L");
  }
  avg(arr)     { const a=arr.slice(-38); return a.length ? a.reduce((x,y)=>x+y,0)/a.length : 1.2; }
  atk(t,home)  { const d=home?this.ha[t]:this.aa[t]; return ((d?.length?this.avg(d):1.2))/1.35; }
  def_(t,home) { const d=home?this.hd[t]:this.ad[t]; return ((d?.length?this.avg(d):1.2))/1.35; }
  mu(home,away){
    const mh=Math.max(.3,Math.min(5, this.atk(home,true)*this.def_(away,false)*1.35*1.10));
    const ma=Math.max(.3,Math.min(5, this.atk(away,false)*this.def_(home,true)*1.35));
    return [+mh.toFixed(3), +ma.toFixed(3)];
  }
  form(t,n=5){
    const r=(this.results[t]||[]).slice(-n);
    if (!r.length) return 0.5;
    return r.reduce((a,x)=>a+(x==="W"?3:x==="D"?1:0),0)/(r.length*3);
  }
  teams(){ return [...new Set([...Object.keys(this.ha),...Object.keys(this.aa)])].sort(); }
  summary(t){
    const r=this.results[t]||[];
    const w=r.filter(x=>x==="W").length, d=r.filter(x=>x==="D").length, l=r.filter(x=>x==="L").length;
    const gf=[...this.ha[t]||[],...this.aa[t]||[]].reduce((a,b)=>a+b,0);
    const ga=[...this.hd[t]||[],...this.ad[t]||[]].reduce((a,b)=>a+b,0);
    return {played:r.length, wins:w, draws:d, losses:l, points:w*3+d, gf, ga, gd:gf-ga};
  }
}

// ══════════════════════════════════════════════════
// Main predict function
// ══════════════════════════════════════════════════
export function predict(home, away, stats, elo, nSims=1000) {
  const [mh,ma] = stats.mu(home, away);
  const sh=elo.strength(home), sa=elo.strength(away);
  const fh=stats.form(home),   fa=stats.form(away);
  const aH=quantumAmplitude(.6*sh+.4*fh);
  const aA=quantumAmplitude(.6*sa+.4*fa);
  const [qH,qD,qA]=quantumInterference(aH,aA);

  let pH=0,pD=0,pA=0,eH=0,eA=0;
  for (let i=0;i<9;i++) for (let j=0;j<9;j++) {
    const p=Math.max(0, poisson(i,mh)*poisson(j,ma)*dixonColes(i,j,mh,ma));
    eH+=i*p; eA+=j*p;
    if (i>j) pH+=p; else if (i===j) pD+=p; else pA+=p;
  }
  const ps=pH+pD+pA||1; pH/=ps; pD/=ps; pA/=ps;

  let fH=.6*pH+.4*qH, fD=.6*pD+.4*qD, fA=.6*pA+.4*qA;
  const fs=fH+fD+fA; fH/=fs; fD/=fs; fA/=fs;

  const mc=monteCarlo(mh,ma,nSims);
  const best=fH>=fD&&fH>=fA?"home":fD>=fA?"draw":"away";

  return {
    home, away,
    probabilities:  { home_win:+(fH*100).toFixed(1), draw:+(fD*100).toFixed(1), away_win:+(fA*100).toFixed(1) },
    expected_goals: { home:+eH.toFixed(2), away:+eA.toFixed(2), total:+(eH+eA).toFixed(2) },
    team_strength:  {
      home_elo:+(elo.get(home)).toFixed(0), away_elo:+(elo.get(away)).toFixed(0),
      home_form:+(fh*100).toFixed(1),       away_form:+(fa*100).toFixed(1),
      home_amplitude:+aH.toFixed(4),        away_amplitude:+aA.toFixed(4),
    },
    monte_carlo:     mc,
    best_prediction: best,
    confidence:      +(Math.max(fH,fD,fA)*100).toFixed(1),
    quantum_used:    true,
    model:           "Quantum-Poisson-ELO Hybrid v2.0",
    timestamp:       new Date().toISOString(),
  };
}

// ══════════════════════════════════════════════════
// Historical data (built-in, 25 leagues)
// ══════════════════════════════════════════════════
export const HISTORICAL_DATA = [
  // ─── Premier League ───
  {home:"Man City",away:"Arsenal",hg:1,ag:0,league:"Premier League"},
  {home:"Liverpool",away:"Chelsea",hg:2,ag:0,league:"Premier League"},
  {home:"Man Utd",away:"Tottenham",hg:1,ag:1,league:"Premier League"},
  {home:"Arsenal",away:"Liverpool",hg:0,ag:3,league:"Premier League"},
  {home:"Chelsea",away:"Man City",hg:1,ag:3,league:"Premier League"},
  {home:"Tottenham",away:"Man Utd",hg:3,ag:1,league:"Premier League"},
  {home:"Leicester",away:"Everton",hg:2,ag:1,league:"Premier League"},
  {home:"West Ham",away:"Newcastle",hg:3,ag:2,league:"Premier League"},
  {home:"Aston Villa",away:"Brighton",hg:1,ag:0,league:"Premier League"},
  {home:"Man City",away:"Liverpool",hg:2,ag:2,league:"Premier League"},
  {home:"Chelsea",away:"Tottenham",hg:2,ag:0,league:"Premier League"},
  {home:"Arsenal",away:"Man Utd",hg:3,ag:2,league:"Premier League"},
  {home:"Liverpool",away:"Man City",hg:1,ag:0,league:"Premier League"},
  {home:"Man City",away:"Chelsea",hg:4,ag:0,league:"Premier League"},
  {home:"Arsenal",away:"Tottenham",hg:2,ag:0,league:"Premier League"},
  {home:"Liverpool",away:"Man Utd",hg:7,ag:0,league:"Premier League"},
  {home:"Man City",away:"Arsenal",hg:2,ag:2,league:"Premier League"},
  {home:"Liverpool",away:"Tottenham",hg:4,ag:0,league:"Premier League"},
  {home:"Chelsea",away:"Man Utd",hg:3,ag:1,league:"Premier League"},
  {home:"Arsenal",away:"Man City",hg:1,ag:0,league:"Premier League"},
  {home:"Newcastle",away:"Everton",hg:4,ag:1,league:"Premier League"},
  {home:"Aston Villa",away:"West Ham",hg:1,ag:0,league:"Premier League"},
  {home:"Brighton",away:"Wolves",hg:3,ag:1,league:"Premier League"},
  // ─── La Liga ───
  {home:"Barcelona",away:"Real Madrid",hg:2,ag:1,league:"La Liga"},
  {home:"Real Madrid",away:"Atletico Madrid",hg:2,ag:0,league:"La Liga"},
  {home:"Atletico Madrid",away:"Barcelona",hg:1,ag:0,league:"La Liga"},
  {home:"Sevilla",away:"Valencia",hg:2,ag:1,league:"La Liga"},
  {home:"Real Sociedad",away:"Athletic Club",hg:1,ag:1,league:"La Liga"},
  {home:"Villarreal",away:"Betis",hg:2,ag:2,league:"La Liga"},
  {home:"Barcelona",away:"Atletico Madrid",hg:3,ag:1,league:"La Liga"},
  {home:"Real Madrid",away:"Barcelona",hg:3,ag:2,league:"La Liga"},
  {home:"Atletico Madrid",away:"Real Madrid",hg:1,ag:1,league:"La Liga"},
  {home:"Barcelona",away:"Sevilla",hg:4,ag:0,league:"La Liga"},
  {home:"Real Madrid",away:"Villarreal",hg:2,ag:1,league:"La Liga"},
  {home:"Girona",away:"Barcelona",hg:4,ag:2,league:"La Liga"},
  // ─── Serie A ───
  {home:"Juventus",away:"Inter Milan",hg:1,ag:2,league:"Serie A"},
  {home:"AC Milan",away:"Napoli",hg:2,ag:1,league:"Serie A"},
  {home:"Inter Milan",away:"AC Milan",hg:3,ag:2,league:"Serie A"},
  {home:"Napoli",away:"Juventus",hg:1,ag:1,league:"Serie A"},
  {home:"Roma",away:"Lazio",hg:2,ag:0,league:"Serie A"},
  {home:"Lazio",away:"Roma",hg:0,ag:1,league:"Serie A"},
  {home:"Atalanta",away:"Inter Milan",hg:2,ag:2,league:"Serie A"},
  {home:"Fiorentina",away:"AC Milan",hg:1,ag:1,league:"Serie A"},
  {home:"Juventus",away:"Roma",hg:1,ag:0,league:"Serie A"},
  {home:"Inter Milan",away:"Napoli",hg:2,ag:0,league:"Serie A"},
  {home:"Napoli",away:"AC Milan",hg:4,ag:0,league:"Serie A"},
  // ─── Bundesliga ───
  {home:"Bayern Munich",away:"Dortmund",hg:3,ag:1,league:"Bundesliga"},
  {home:"Dortmund",away:"Bayern Munich",hg:2,ag:3,league:"Bundesliga"},
  {home:"RB Leipzig",away:"Bayern Munich",hg:1,ag:3,league:"Bundesliga"},
  {home:"Leverkusen",away:"Dortmund",hg:2,ag:0,league:"Bundesliga"},
  {home:"Frankfurt",away:"RB Leipzig",hg:1,ag:2,league:"Bundesliga"},
  {home:"Wolfsburg",away:"Bayern Munich",hg:2,ag:2,league:"Bundesliga"},
  {home:"Bayern Munich",away:"RB Leipzig",hg:4,ag:1,league:"Bundesliga"},
  {home:"Dortmund",away:"Leverkusen",hg:1,ag:2,league:"Bundesliga"},
  {home:"Leverkusen",away:"Bayern Munich",hg:3,ag:0,league:"Bundesliga"},
  {home:"Stuttgart",away:"Dortmund",hg:2,ag:1,league:"Bundesliga"},
  // ─── Ligue 1 ───
  {home:"PSG",away:"Marseille",hg:3,ag:0,league:"Ligue 1"},
  {home:"Marseille",away:"PSG",hg:0,ag:2,league:"Ligue 1"},
  {home:"Lyon",away:"PSG",hg:1,ag:2,league:"Ligue 1"},
  {home:"Monaco",away:"Marseille",hg:2,ag:1,league:"Ligue 1"},
  {home:"Nice",away:"Lyon",hg:1,ag:0,league:"Ligue 1"},
  {home:"PSG",away:"Lyon",hg:4,ag:1,league:"Ligue 1"},
  {home:"Lens",away:"Marseille",hg:1,ag:1,league:"Ligue 1"},
  {home:"Monaco",away:"PSG",hg:1,ag:3,league:"Ligue 1"},
  // ─── Eredivisie ───
  {home:"Ajax",away:"PSV",hg:2,ag:2,league:"Eredivisie"},
  {home:"PSV",away:"Ajax",hg:3,ag:1,league:"Eredivisie"},
  {home:"Feyenoord",away:"Ajax",hg:2,ag:0,league:"Eredivisie"},
  {home:"Ajax",away:"Feyenoord",hg:1,ag:1,league:"Eredivisie"},
  {home:"AZ Alkmaar",away:"PSV",hg:1,ag:2,league:"Eredivisie"},
  // ─── Primeira Liga ───
  {home:"Porto",away:"Benfica",hg:1,ag:2,league:"Primeira Liga"},
  {home:"Benfica",away:"Sporting CP",hg:3,ag:1,league:"Primeira Liga"},
  {home:"Sporting CP",away:"Porto",hg:2,ag:1,league:"Primeira Liga"},
  {home:"Benfica",away:"Porto",hg:2,ag:0,league:"Primeira Liga"},
  // ─── Süper Lig ───
  {home:"Galatasaray",away:"Fenerbahce",hg:2,ag:1,league:"Süper Lig"},
  {home:"Fenerbahce",away:"Besiktas",hg:3,ag:1,league:"Süper Lig"},
  {home:"Besiktas",away:"Galatasaray",hg:0,ag:2,league:"Süper Lig"},
  {home:"Trabzonspor",away:"Fenerbahce",hg:1,ag:2,league:"Süper Lig"},
  // ─── Scottish Premiership ───
  {home:"Celtic",away:"Rangers",hg:2,ag:1,league:"Scottish Prem"},
  {home:"Rangers",away:"Celtic",hg:1,ag:1,league:"Scottish Prem"},
  {home:"Hearts",away:"Hibernian",hg:2,ag:0,league:"Scottish Prem"},
  // ─── MLS ───
  {home:"LA Galaxy",away:"LAFC",hg:2,ag:1,league:"MLS"},
  {home:"Inter Miami",away:"NY City FC",hg:3,ag:1,league:"MLS"},
  {home:"Seattle Sounders",away:"Portland Timbers",hg:2,ag:0,league:"MLS"},
  // ─── Brasileirão ───
  {home:"Flamengo",away:"Palmeiras",hg:2,ag:1,league:"Brasileirão"},
  {home:"Palmeiras",away:"Corinthians",hg:3,ag:0,league:"Brasileirão"},
  {home:"Fluminense",away:"Vasco",hg:2,ag:1,league:"Brasileirão"},
  {home:"Santos",away:"São Paulo",hg:1,ag:2,league:"Brasileirão"},
  // ─── Primera División Argentina ───
  {home:"Boca Juniors",away:"River Plate",hg:1,ag:2,league:"Primera División"},
  {home:"River Plate",away:"San Lorenzo",hg:3,ag:0,league:"Primera División"},
  {home:"Racing Club",away:"Boca Juniors",hg:2,ag:1,league:"Primera División"},
  // ─── Liga MX ───
  {home:"America",away:"Chivas",hg:2,ag:1,league:"Liga MX"},
  {home:"Cruz Azul",away:"Pumas",hg:1,ag:0,league:"Liga MX"},
  {home:"Tigres",away:"Monterrey",hg:2,ag:2,league:"Liga MX"},
  // ─── J1 League ───
  {home:"Urawa Reds",away:"Gamba Osaka",hg:2,ag:0,league:"J1 League"},
  {home:"Vissel Kobe",away:"Yokohama Marinos",hg:1,ag:1,league:"J1 League"},
  {home:"Kashima Antlers",away:"Urawa Reds",hg:2,ag:1,league:"J1 League"},
  // ─── Championship ───
  {home:"Leeds",away:"Leicester",hg:1,ag:2,league:"Championship"},
  {home:"Sunderland",away:"Norwich",hg:2,ag:1,league:"Championship"},
  {home:"Middlesbrough",away:"Sheffield Wed",hg:1,ag:1,league:"Championship"},
  // ─── Pro League Belgium ───
  {home:"Club Brugge",away:"Anderlecht",hg:2,ag:1,league:"Pro League"},
  {home:"Anderlecht",away:"Gent",hg:1,ag:0,league:"Pro League"},
  {home:"Standard",away:"Club Brugge",hg:0,ag:3,league:"Pro League"},
  // ─── 2. Bundesliga ───
  {home:"Hamburger SV",away:"Schalke",hg:2,ag:1,league:"2. Bundesliga"},
  {home:"Fortuna Düsseldorf",away:"Hamburger SV",hg:1,ag:2,league:"2. Bundesliga"},
];

export const LEAGUES_META = {
  "Premier League":   {country:"إنجلترا",  flag:"🏴󠁧󠁢󠁥󠁮󠁧󠁿", tier:1},
  "La Liga":          {country:"إسبانيا",  flag:"🇪🇸", tier:1},
  "Serie A":          {country:"إيطاليا",  flag:"🇮🇹", tier:1},
  "Bundesliga":       {country:"ألمانيا",  flag:"🇩🇪", tier:1},
  "Ligue 1":          {country:"فرنسا",    flag:"🇫🇷", tier:1},
  "Eredivisie":       {country:"هولندا",   flag:"🇳🇱", tier:1},
  "Primeira Liga":    {country:"البرتغال", flag:"🇵🇹", tier:1},
  "Süper Lig":        {country:"تركيا",   flag:"🇹🇷", tier:1},
  "Scottish Prem":    {country:"اسكتلندا", flag:"🏴󠁧󠁢󠁳󠁣󠁴󠁿", tier:1},
  "Pro League":       {country:"بلجيكا",   flag:"🇧🇪", tier:1},
  "MLS":              {country:"أمريكا",   flag:"🇺🇸", tier:1},
  "Brasileirão":      {country:"البرازيل", flag:"🇧🇷", tier:1},
  "Primera División": {country:"الأرجنتين",flag:"🇦🇷", tier:1},
  "Liga MX":          {country:"المكسيك",  flag:"🇲🇽", tier:1},
  "J1 League":        {country:"اليابان",  flag:"🇯🇵", tier:1},
  "Championship":     {country:"إنجلترا",  flag:"🏴󠁧󠁢󠁥󠁮󠁧󠁿", tier:2},
  "2. Bundesliga":    {country:"ألمانيا",  flag:"🇩🇪", tier:2},
};

// بناء الـ stats و elo من البيانات
export function buildEngine(matches) {
  const stats = new TeamStats();
  const elo   = new ELO();
  for (const m of matches) {
    stats.add(m.home, m.away, m.hg, m.ag);
    elo.update(m.home, m.away, m.hg>m.ag?"H":m.hg===m.ag?"D":"A");
  }
  return { stats, elo };
}
