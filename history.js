/* ================== ИСТОРИЯ МАТЧЕЙ И ВАЛИДАЦИЯ ==================
   Этап 1: хранилище реальных результатов, метрики модели, импорт CSV.
   Чистые функции (validationMetrics, factOutcome, matchOutcome) без DOM;
   рендер UI-вкладки — через функции, вызываемые из index.html. */
const HIST_KEY = 'rpl2627_history_v1';

// именную привязку храним как «название команды», чтобы пережить перестановку списков
function loadHistory(){
  try{
    const d = JSON.parse(localStorage.getItem(HIST_KEY));
    if(d && Array.isArray(d))
      return d.filter(m => m && m.home && m.away && Number.isFinite(m.gh) && Number.isFinite(m.ga));
  }catch(e){ console.warn('Аналитика РПЛ: не удалось прочитать историю — пусто.', e); }
  return [];
}
function saveHistory(){ localStorage.setItem(HIST_KEY, JSON.stringify(HISTORY)); }
let HISTORY = loadHistory();

// фактический исход: 0 = победа хозяев, 1 = ничья, 2 = победа гостей
const factOutcome = (gh, ga) => gh > ga ? 0 : (gh < ga ? 2 : 1);

// нормализованное имя для сопоставления CSV с базой (без регистра/тире/ё)
const normName = n => String(n||'').toLowerCase().replace(/[-\s]/g,'').replace('ё','е');

// ключ для дедупликации: пара команд + тур. Одна пара играет дважды за сезон,
// и одинаковые счета в разных турах допустимы — дубль только при полном совпадении.
function matchKey(home, away, round){
  return normName(home) + '|' + normName(away) + '|' + (round === undefined ? '' : round);
}
function isDuplicate(home, away, round){
  const k = matchKey(home, away, round);
  return HISTORY.some(m => matchKey(m.home, m.away, m.round) === k);
}

// прогноз модели (λ из статичных xG), возвращает probs[0,1,2] и вероятный исход
function predictHome(hi, ai){
  const { lh, la } = lambdas(hi, ai);
  const r = matchProbs(lh, la);
  const probs = [r.pw, r.pd, r.pl];
  return { probs, outcome: probs.indexOf(Math.max(...probs)) };
}

/* ---------- ВАЛИДАЦИЯ: метрики по всем матчам истории ---------- */
function validationMetrics(){
  const map = {};
  DB.teams.forEach((t,i)=> map[normName(t.name)] = i);
  const rows = []; let skipped = 0;
  HISTORY.forEach(m => {
    const hi = map[normName(m.home)], ai = map[normName(m.away)];
    if(hi === undefined || ai === undefined || hi === ai){ skipped++; return; }
    const p = predictHome(hi, ai);
    rows.push({
      fact: factOutcome(m.gh, m.ga),
      outcome: p.outcome,
      probs: p.probs,
      round: Number.isFinite(+m.round) ? +m.round : null,
      w: p.probs[0], d: p.probs[1], l: p.probs[2]
    });
  });
  const n = rows.length;
  if(!n) return { n:0, skipped };

  // точность исхода: где предсказанный исход совпал с фактом
  const acc = rows.filter(r => r.outcome === r.fact).length / n;
  // калибровка: средний |P(фактического исхода) − 1|
  const cal = rows.reduce((s,r) => s + Math.abs(r.probs[r.fact] - 1), 0) / n;
  // матрица прогноз×факт
  const conf = [[0,0,0],[0,0,0],[0,0,0]];
  rows.forEach(r => conf[r.outcome][r.fact]++);

  // log-loss по фактическому исходу (меньше — лучше)
  const logLoss = -rows.reduce((s,r) => s + Math.log(Math.max(1e-9, r.probs[r.fact])), 0) / n;

  // Brier score по трём исходам (меньше — лучше)
  const brier = rows.reduce((s,r) => {
    const y = [0,0,0]; y[r.fact] = 1;
    return s + (r.probs[0]-y[0])**2 + (r.probs[1]-y[1])**2 + (r.probs[2]-y[2])**2;
  }, 0) / n;

  // калибровка по бинам: для каждой вероятности исхода сравниваем прогноз и факт
  const bins = Array.from({length:10}, (_,i)=>({ lo:i/10, hi:(i+1)/10, n:0, sumP:0, sumY:0 }));
  rows.forEach(r => {
    [0,1,2].forEach(k => {
      const p = Math.min(1, Math.max(0, r.probs[k]));
      const y = (r.fact === k) ? 1 : 0;
      const b = bins[Math.min(9, Math.floor(p*10))];
      b.n++; b.sumP += p; b.sumY += y;
    });
  });
  const reliability = bins.filter(b => b.n > 0).map(b => ({
    lo:b.lo, hi:b.hi, n:b.n, pred:b.sumP/b.n, fact:b.sumY/b.n
  }));

  // точность по турам (только матчи с указанным туром)
  const byRound = {};
  rows.forEach(r => {
    if(r.round === null) return;
    const b = byRound[r.round] || (byRound[r.round] = { round:r.round, n:0, hits:0, ll:0 });
    b.n++;
    if(r.outcome === r.fact) b.hits++;
    b.ll += -Math.log(Math.max(1e-9, r.probs[r.fact]));
  });
  const rounds = Object.values(byRound)
    .map(b => ({ round:b.round, n:b.n, acc:b.hits/b.n, logLoss:b.ll/b.n }))
    .sort((a,b) => a.round - b.round);

  return { n, skipped, acc, cal, conf, logLoss, brier, reliability, rounds };
}

/* ---------- ИМПОРТ CSV ----------
   Строки вида:  home,away,gh,ga[,round]  или  home;away;gh;ga[;round].
   Тур опционален: если не указан, матч не считаем дублем по номеру тура.
   Заголовок первой строки пропускается, если он не парсится как матч. */
function importHistoryCSV(text){
  const map = {}; DB.teams.forEach((t,i)=> map[normName(t.name)] = i);
  const lines = String(text||'').split('\n').map(s=>s.trim()).filter(Boolean);
  let added = 0, bad = 0, dupSkipped = 0;
  lines.forEach((line, idx) => {
    const parts = line.split(/[;,]/).map(s=>s.trim());
    if(parts.length < 4) return;
    const [home, away, ghStr, gaStr, roundStr] = parts;
    const gh = Number(ghStr), ga = Number(gaStr);
    // первая строка — часто заголовок (колонки не числа) — пропускаем
    if(!Number.isFinite(gh) || !Number.isFinite(ga)) { bad++; return; }
    if(map[normName(home)] === undefined || map[normName(away)] === undefined){ bad++; return; }
    const round = roundStr !== undefined && roundStr !== '' ? Number(roundStr) : undefined;
    if(isDuplicate(home, away, round)){ dupSkipped++; return; }
    const m = { home, away, gh, ga };
    if(round !== undefined && Number.isFinite(round)) m.round = round;
    HISTORY.push(m);
    added++;
  });
  saveHistory();
  return { added, bad, skipped: bad, dupSkipped, total: HISTORY.length };
}

/* ---------- СБОРКА matches.js ИЗ CSV (с проверкой имён) ----------
   Строки: home,away,gh,ga[,round] или через ';'. Команды сверяются с базой
   по нормализованному имени; неизвестные попадают в отчёт и не публикуются. */
function buildMatchesFromCSV(text){
  const map = {}; DB.teams.forEach(t => map[normName(t.name)] = t.name);
  const lines = String(text || '').split('\n').map(s => s.trim()).filter(Boolean);
  const items = []; const unknown = new Set(); const seen = new Set();
  let bad = 0, dup = 0;
  lines.forEach(line => {
    const parts = line.split(/[;,]/).map(s => s.trim());
    if(parts.length < 4){ bad++; return; }
    const [h, a, ghS, gaS, roundS] = parts;
    const H = map[normName(h)], A = map[normName(a)];
    if(!H || !A){ if(h && !H) unknown.add(h); if(a && !A) unknown.add(a); return; }
    const gh = Number(ghS), ga = Number(gaS);
    if(!Number.isInteger(gh) || !Number.isInteger(ga) || gh < 0 || ga < 0){ bad++; return; }
    const round = roundS !== undefined && roundS !== '' && Number.isFinite(+roundS) ? +roundS : 1;
    const key = normName(H) + '|' + normName(A) + '|' + round;
    if(seen.has(key)){ dup++; return; }
    seen.add(key);
    items.push({ home:H, away:A, gh, ga, round });
  });
  return { items, unknown:[...unknown], bad, dup };
}

/* ---------- ДОБАВЛЕНИЕ / СБРОС ---------- */
function addHistoryMatch(home, away, gh, ga, round){
  if(isDuplicate(home, away, round))
    return { ok:false, msg: round ? `Матч ${home}–${away} в туре ${round} уже есть в истории.` : `Матч ${home}–${away} уже есть в истории.` };
  const m = { home, away, gh:+gh, ga:+ga };
  if(round !== undefined && round !== '' && Number.isFinite(+round)) m.round = +round;
  HISTORY.push(m);
  saveHistory();
  return { ok:true, msg:'Матч добавлен.' };
}
function clearHistory(){
  // «Очистить» убирает только личные матчи; общая база (matches.js) остаётся
  if(typeof HISTORY !== 'undefined'){
    HISTORY = HISTORY.filter(m => m && m.shared);
  } else {
    HISTORY = [];
  }
  saveHistory();
}

/* ---------- ОБЩАЯ БАЗА МАТЧЕЙ (matches.js) ----------
   Матчи из файла matches.js видны всем посетителям. При загрузке они добавляются
   в историю с флагом shared:true; дубликаты по (дом, гость, тур) не добавляются. */
function mergeSharedMatches(){
  if(typeof SHARED_MATCHES === 'undefined' || !Array.isArray(SHARED_MATCHES)) return 0;
  let added = 0;
  SHARED_MATCHES.forEach(m => {
    if(!m || !m.home || !m.away) return;
    if(!Number.isFinite(+m.gh) || !Number.isFinite(+m.ga)) return;
    const round = Number.isFinite(+m.round) ? +m.round : 1;
    if(isDuplicate(m.home, m.away, round)) return;
    HISTORY.push({ home:m.home, away:m.away, gh:+m.gh, ga:+m.ga, round, shared:true });
    added++;
  });
  if(added) saveHistory();
  return added;
}

/* ---------- ИСТОРИЯ ПРОГНОЗОВ ----------
   Пользователь сохраняет прогноз до матча; когда результат появляется в истории,
   прогноз автоматически сверяется с фактом (исход, Brier, log-loss). */
const PRED_KEY = 'rpl2627_predictions_v1';
function loadPredictions(){
  try{
    const d = JSON.parse(localStorage.getItem(PRED_KEY));
    if(Array.isArray(d)) return d.filter(p => p && p.home && p.away && Array.isArray(p.probs) && p.probs.length === 3);
  }catch(e){ console.warn('Аналитика РПЛ: не удалось прочитать прогнозы.', e); }
  return [];
}
function savePredictions(){ localStorage.setItem(PRED_KEY, JSON.stringify(PREDICTIONS)); }
let PREDICTIONS = loadPredictions();

function addPrediction(home, away, probs, lh, la){
  const key = normName(home) + '|' + normName(away);
  PREDICTIONS = PREDICTIONS.filter(p => (normName(p.home)+'|'+normName(p.away)) !== key);
  PREDICTIONS.push({
    home, away,
    probs: [+probs[0], +probs[1], +probs[2]],
    lh: Number.isFinite(+lh) ? +lh : null,
    la: Number.isFinite(+la) ? +la : null,
    ts: Date.now()
  });
  savePredictions();
  return PREDICTIONS.length;
}
function clearPredictions(){ PREDICTIONS = []; savePredictions(); }

function evaluatePredictions(){
  const rows = [];
  PREDICTIONS.forEach(p => {
    const key = normName(p.home) + '|' + normName(p.away);
    const m = HISTORY.find(h => (normName(h.home)+'|'+normName(h.away)) === key);
    const pred = p.probs.indexOf(Math.max(...p.probs));
    if(!m){
      rows.push({ home:p.home, away:p.away, probs:p.probs, pred, fact:null, hit:null, pFact:null, brier:null });
      return;
    }
    const fact = factOutcome(m.gh, m.ga);
    const y = [0,0,0]; y[fact] = 1;
    const brier = (p.probs[0]-y[0])**2 + (p.probs[1]-y[1])**2 + (p.probs[2]-y[2])**2;
    rows.push({
      home:p.home, away:p.away, probs:p.probs, pred, fact,
      gh:m.gh, ga:m.ga, hit: pred === fact,
      pFact: p.probs[fact], brier
    });
  });
  const done = rows.filter(r => r.fact !== null);
  const n = done.length;
  const hits = done.filter(r => r.hit).length;
  return {
    rows, n, hits,
    acc: n ? hits / n : 0,
    brier: n ? done.reduce((s,r)=>s+r.brier, 0) / n : 0,
    logLoss: n ? -done.reduce((s,r)=>s+Math.log(Math.max(1e-9, r.pFact)),0)/n : 0,
    pending: rows.length - n
  };
}

/* ---------- КАЛИБРОВКА (Этап 2) ----------
   Перебор по сетке трёх параметров, максимизация суммы log(P(фактического исхода))
   по всем матчам истории с известными командами. Ничего не пишет в DB — только возвращает
   кандидата. Применяют отдельной функцией, если пользователь согласен.
   Минимум матчей: 5, иначе вернёт null. */
function calibrationCandidates(){
  return {
    homeBoost:   [1.00, 1.05, 1.10, 1.15, 1.20, 1.25, 1.30],
    awayPenalty: [0.80, 0.85, 0.90, 0.95, 1.00],
    dixonColes:  [-0.20, -0.15, -0.10, -0.05, 0.00]
  };
}
function leagueSettings(div){
  if(!DB.league) DB.league = {};
  if(!DB.league[div] || !Number.isFinite(DB.league[div].homeBoost)){
    DB.league[div] = { ...(DB.settings || { homeBoost:1.10, awayPenalty:0.95, dixonColes:-0.08 }) };
  }
  return DB.league[div];
}
function logLikelihoodFor(settings, div){
  const map = {}; DB.teams.forEach((t,i)=> map[normName(t.name)] = i);
  let sum = 0, used = 0;
  HISTORY.forEach(m => {
    const hi = map[normName(m.home)], ai = map[normName(m.away)];
    if(hi === undefined || ai === undefined || hi === ai) return;
    if(div && divOf(DB.teams[hi]) !== div) return;
    const { lh, la } = lambdas(hi, ai, settings);
    const r = matchProbs(lh, la, settings);
    const pFact = r[['pw','pd','pl'][factOutcome(m.gh, m.ga)]];
    sum += Math.log(Math.max(1e-9, pFact));
    used++;
  });
  return { sum, used };
}
function calibrateDivision(div){
  if(!DB.settings) DB.settings = { homeBoost:1.10, awayPenalty:0.95, dixonColes:-0.08 };
  const start = leagueSettings(div);
  const base = logLikelihoodFor(start, div);
  if(base.used < 5) return { ok:false, div, used: base.used, need: 5 };

  const cand = calibrationCandidates();
  let best = null, bestLL = -Infinity;
  cand.homeBoost.forEach(hb => cand.awayPenalty.forEach(ap => cand.dixonColes.forEach(dc => {
    const settings = { ...start, homeBoost:hb, awayPenalty:ap, dixonColes:dc };
    const { sum, used } = logLikelihoodFor(settings, div);
    if(used < 5) return;
    if(sum > bestLL){ bestLL = sum; best = { homeBoost:hb, awayPenalty:ap, dixonColes:dc, used, logLik:sum }; }
  })));
  if(!best) return { ok:false, div, used: base.used, need: 5 };

  DB.league[div] = { homeBoost:best.homeBoost, awayPenalty:best.awayPenalty, dixonColes:best.dixonColes };
  const gainPct = base.sum !== 0
    ? Math.round(((best.logLik - base.sum) / Math.abs(base.sum)) * 1000) / 10
    : 0;
  return { ok:true, div, ...best, baseLogLik: base.sum, gainPct };
}
function calibrateParams(){
  const rpl = calibrateDivision('rpl');
  const fnl = calibrateDivision('fnl');
  return { ok: rpl.ok || fnl.ok, rpl, fnl };
}

/* ================== ДИНАМИЧЕСКАЯ СИЛА (Этап 3) ==================
   Вместо статичных xG из базы — сила атаки/обороны каждой команды по её реальным
   матчам из истории, с учётом дом/гость и класса соперника. Окно — последние N матчей.
   Принцип: атака команды = её голы, нормированные на оборону соперников; оборона — наоборот.
   Поправочные коэффициенты дом/гость выводятся из той же истории. */

const DYN_WINDOW = 5;       // последние 5 матчей команды
let USE_DYNAMIC = false;    // переключатель: статичные xG (по умолчанию) или динамика

// голы/строение из истории по конкретной команде
function histMatchesFor(teamName, windowLen){
  const nm = normName(teamName);
  return HISTORY.filter(m => normName(m.home)===nm || normName(m.away)===nm).slice(-(windowLen||DYN_WINDOW));
}

// грубые коэффициенты: насколько в среднем забивают/пропускают дома vs гостей
function dynHomeFactors(){
  let home=0, away=0, n=0;
  const map = {}; DB.teams.forEach((t,i)=> map[normName(t.name)] = i);
  HISTORY.forEach(m => {
    if(map[normName(m.home)]===undefined || map[normName(m.away)]===undefined) return;
    home += m.gh; away += m.ga; n++;
  });
  const avg = (home+away)/(2*n);
  return { homeGF: avg ? home/n/avg : 1, awayGA: avg ? away/n/avg : 1 };
}

// динамическая сила: {atk, def} для команды в масштабе «голов за матч» (~1–2, как xG).
// Дом/гость — поправкой к средним; класс соперника уже учтён в формуле λ (умножение на xga соперника),
// поэтому отдельная нормировка не добавляет информации, а только ломает масштаб.
function dynStrength(teamIdx, isHome, windowLen){
  const t = DB.teams[teamIdx];
  const ms = histMatchesFor(t.name, windowLen);
  if(!ms.length) return null;   // нет матчей — отступить к статике
  let gf=0, ga=0, n=0;
  ms.forEach(m => {
    const iAmHome = normName(m.home)===normName(t.name);
    gf += Math.max(0, iAmHome ? m.gh : m.ga);
    ga += Math.max(0, iAmHome ? m.ga : m.gh);
    n++;
  });
  const f = dynHomeFactors();
  const gfPer = (gf/n) * (isHome ? f.homeGF : 1/f.homeGF);
  const gaPer = (ga/n) * (isHome ? 1/f.homeGF : 1);
  return { atk: gfPer, def: gaPer, n };
}

// получить xG команды: либо статику из базы, либо динамику (если матчей достаточно)
function dynXg(teamIdx, isHome, windowLen){
  if(USE_DYNAMIC){
    const s = dynStrength(teamIdx, isHome, windowLen);
    if(s && s.n >= 1) return s;
  }
  return null;   // статика обрабатывается в lambdas
}