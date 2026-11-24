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

  return { n, skipped, acc, cal, conf };
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
  HISTORY = [];
  saveHistory();
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
function logLikelihoodFor(settings){
  const map = {}; DB.teams.forEach((t,i)=> map[normName(t.name)] = i);
  let sum = 0, used = 0;
  HISTORY.forEach(m => {
    const hi = map[normName(m.home)], ai = map[normName(m.away)];
    if(hi === undefined || ai === undefined || hi === ai) return;
    const { lh, la } = lambdas(hi, ai, settings);
    const r = matchProbs(lh, la, settings);
    const pFact = r[['pw','pd','pl'][factOutcome(m.gh, m.ga)]];
    sum += Math.log(Math.max(1e-9, pFact));
    used++;
  });
  return { sum, used };
}
function calibrateParams(){
  if(!DB.settings) DB.settings = { homeBoost:1.10, awayPenalty:0.95, dixonColes:-0.08 };
  const cand = calibrationCandidates();
  const base = logLikelihoodFor(DB.settings);
  if(base.used < 5) return { ok:false, used: base.used, need: 5 };

  let best = null, bestLL = -Infinity;
  cand.homeBoost.forEach(hb => cand.awayPenalty.forEach(ap => cand.dixonColes.forEach(dc => {
    const settings = { ...DB.settings, homeBoost:hb, awayPenalty:ap, dixonColes:dc };
    const { sum, used } = logLikelihoodFor(settings);
    if(used < 5) return;
    if(sum > bestLL){ bestLL = sum; best = { homeBoost:hb, awayPenalty:ap, dixonColes:dc, used, logLik:sum }; }
  })));
  if(!best) return { ok:false, used: base.used, need: 5 };

  DB.settings.homeBoost = best.homeBoost;
  DB.settings.awayPenalty = best.awayPenalty;
  DB.settings.dixonColes = best.dixonColes;

  const gainPct = base.sum !== 0
    ? Math.round(((best.logLik - base.sum) / Math.abs(base.sum)) * 1000) / 10
    : 0;
  return { ok:true, ...best, baseLogLik: base.sum, gainPct };
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