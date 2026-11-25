/* ================== МОДЕЛЬ ==================
   Чистые функции прогноза: не читают и не пишут DOM, работают с DB.
   Отдельный слой даёт возможность автотестировать модель без браузера. */
function lambdas(hi, ai, settings){
  const H = DB.teams[hi], A = DB.teams[ai];
  // параметры калибровки берём по дивизиону домашней команды (РПЛ/ФНЛ),
  // если явные настройки не переданы
  const div = divOf(H);
  const s = settings || (DB.league && DB.league[div]) || DB.settings;
  // средняя атака берётся по дивизионам участвующих команд — так РПЛ и ФНЛ не искажают друг друга
  const divs = [...new Set([divOf(H), divOf(A)])];
  const pool = DB.teams.filter(t => divs.includes(divOf(t)));
  const L = pool.reduce((s,t)=>s+t.xgf, 0) / pool.length;
   const fh = adaptFactor(H), fa = adaptFactor(A);

  // динамическая сила (Этап 3): если включена и есть матчи — подставляем атаку/оборону
  // с учётом дом/гость и класса соперника; иначе — статичные xG из базы
  let Hatk = H.xgf, Hdef = H.xga, Aatk = A.xgf, Adef = A.xga;
  if(typeof USE_DYNAMIC !== 'undefined' && USE_DYNAMIC){
    const dH = dynXg(hi, true), dA = dynXg(ai, false);
    if(dH){ Hatk = dH.atk; Hdef = dH.def; }
    if(dA){ Aatk = dA.atk; Adef = dA.def; }
  }

  const lh = Math.max(0.05, Hatk * fh.atk * Adef * fa.def / L * s.homeBoost * H.mod);
  const la = Math.max(0.05, Aatk * fa.atk * Hdef * fh.def / L * s.awayPenalty * A.mod);
  return {lh: applySquad(lh, hi), la: applySquad(la, ai)};
}

/* ================== СИЛА СОСТАВА (Этап 4) ==================
   Сравниваем фактический состав команды (из lineup) с «усреднённой» командой той же
   формы. Фактический = сумма рейтингов игроков (PLAYER_RATINGS или POS_BASE по позиции).
   Базовый = сумма POS_BASE по тем же позициям. Коррекция ~1: если у команды звёзды —
   чуть выше 1, если слабые/неизвестные — ниже 1. Флаг USE_SQUAD включает/выключает. */
let USE_SQUAD = false;

function playerRating(teamName, playerName, posTag){
  // явный рейтинг игрока, если есть
  const byTeam = (PLAYER_RATINGS && PLAYER_RATINGS[teamName]) || {};
  if(playerName && byTeam[playerName] !== undefined) return byTeam[playerName];
  // иначе базовая шкала по позиции; для ФНЛ — заниженная POS_BASE_FNL
  const baseMap = (POS_BASE_FNL && divOf(DB.teams.find(t=>t.name===teamName)||{}) === 'fnl') ? POS_BASE_FNL : POS_BASE;
  return baseMap[posTag] !== undefined ? baseMap[posTag] : 70;
}

// коррекция состава {corr}: фактическая сила 11 / базовая сила того же формата
function squadCorrection(teamIdx){
  const t = DB.teams[teamIdx];
  const rows = parseLineup(t.lineup);
  const isFnl = divOf(t) === 'fnl';
  const baseMap = isFnl ? POS_BASE_FNL : POS_BASE;
  let actual = 0, base = 0;
  rows.forEach(r => {
    const tag = (r.label||'').toUpperCase().trim();
    // вратарей не считаем в силу атакующей коррекции (знак мало влияет) — но учитываем для баланса
    r.names.forEach(nm => {
      actual += playerRating(t.name, nm, tag);
      base += baseMap[tag] !== undefined ? baseMap[tag] : 70;
    });
  });
  if(!base) return 1;
  return actual / base;
}

// применить к λ: сплющиваем коррекцию к единице, чтобы не доминировала над xG
function applySquad(lambda, teamIdx){
  if(!USE_SQUAD) return lambda;
  const c = squadCorrection(teamIdx);
  // damping: sqrt, чтобы коррекция ~0.9-1.1 не выстреливала в λ
  const damped = Math.sqrt(c);
  return lambda * damped;
}

const MAXG = 10;
function poissonArr(l){
  const a = []; let p = Math.exp(-l);
  for(let k=0;k<=MAXG;k++){ a.push(p); p *= l/(k+1); }
  return a;
}
function matchProbs(lh, la, settings){
  const ph = poissonArr(lh), pa = poissonArr(la);
  const rho = (settings || DB.settings).dixonColes ?? -0.08;
  // корректирующий коэффициент Диксона–Коулза для низких счетов
  const dc = (i, j) => {
    if(i===0 && j===0) return 1 - lh*la*rho;
    if(i===0 && j===1) return 1 + lh*rho;
    if(i===1 && j===0) return 1 + la*rho;
    if(i===1 && j===1) return 1 - rho;
    return 1;
  };
  let pw=0, pd=0, pl=0, over=0, btts=0, best={p:0,h:0,a:0};
  const m = [];
  for(let i=0;i<=MAXG;i++){
    m[i] = [];
    for(let j=0;j<=MAXG;j++){
      const p = Math.max(0, ph[i]*pa[j]*dc(i,j)); m[i][j] = p;
      if(i>j) pw+=p; else if(i===j) pd+=p; else pl+=p;
      if(i+j>2.5) over+=p;
      if(i>0 && j>0) btts+=p;
      if(p>best.p) best={p,h:i,a:j};
    }
  }
  const s = pw+pd+pl;
  return {pw:pw/s, pd:pd/s, pl:pl/s, over25:over/s, btts:btts/s, best:{...best, p:best.p/s}, m, lh, la};
}

/* ================== СИМУЛЯЦИЯ (чистая логика, без рендера) ================== */
const SIM_TICK_MS = 1000;   // 1 секунда = 1 игровая минута
const SIM_MINUTES = 90;

function simNewState(){
  return {round:1, matches:[], timer:null, schedule:null, standings:{}, scorers:{}, over:false, finRound:0};
}

function simShuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function simPoissonGoals(lam) {
  const MEAN = 1.30;
  const L0 = Math.min(Math.max(lam, 0.05), 6.0);
  const L = MEAN + (L0 - MEAN) * 0.75;
  let k = 0, p = Math.exp(-L), s = p, r = Math.random();
  while (r > s && k < 5) { k++; p *= L / k; s += p; }
  return k;
}

// календарь: круговая система по дивизиону, второй круг — зеркальный
function simBuildSchedule(div){
  const idx = idxOf(div || simDiv), n = idx.length;
  let arr = simShuffle(idx);
  const first = [];
  for (let r = 0; r < n - 1; r++) {
    const pairs = [];
    for (let i = 0; i < n / 2; i++) pairs.push([arr[i], arr[n - 1 - i]]);
    first.push(pairs);
    arr = [arr[0], ...arr.slice(2), arr[1]];
  }
  return [...first, ...first.map(rs => rs.map(([h, a]) => [a, h]))];
}

// разбор состава: «Вр: ...», «Защ: ...» → подпись + массив имён
function parseLineup(lu){
  return (lu||'').split('\n').map(s=>{
    const parts = s.split(':');
    const label = (parts[0]||'').trim();
    const names = (parts[1]!==undefined ? parts[1] : s).split(',').map(x=>x.trim()).filter(Boolean);
    return {label, names};
  }).filter(r=>r.names.length);
}

function simEmptyRow(name) {
  return {name, g:0, w:0, d:0, l:0, gf:0, ga:0, pts:0};
}

function simFinalizeRound(S) {
  S.matches.forEach(m => {
    const th = S.standings[m.home] || (S.standings[m.home] = simEmptyRow(m.home));
    const ta = S.standings[m.away] || (S.standings[m.away] = simEmptyRow(m.away));
    th.g++; ta.g++;
    th.gf += m.gh; th.ga += m.ga;
    ta.gf += m.ga; ta.ga += m.gh;
    if (m.gh > m.ga) { th.w++; ta.l++; th.pts += 3; }
    else if (m.gh < m.ga) { ta.w++; th.l++; ta.pts += 3; }
    else { th.d++; ta.d++; th.pts++; ta.pts++; }
  });
}

const SCORER_WEIGHTS = {'НАП':1.6, 'АТАКА':1.3, 'АП':1.1, 'ПЗ':0.6, 'ОП':0.35, 'ЗАЩ':0.25, 'ЦЗ':0.25};
function simPickScorer(teamIdx) {
  const t = DB.teams[teamIdx];
  if (!t || !t.lineup) return null;
  const W = SCORER_WEIGHTS;
  const rows = parseLineup(t.lineup).filter(r => !/^(ВР|Вр)/.test(r.label));
  const ws = [];
  rows.forEach(r => {
    const tag = (r.label || '').toUpperCase().replace(/[^А-Я]/g, '');
    const base = W[tag] ?? 0.6;
    r.names.forEach(n => ws.push({name: shortName(n), w: base}));
  });
  if (!ws.length) return null;
  const total = ws.reduce((s, x) => s + x.w, 0);
  let r = Math.random() * total;
  for (const x of ws) { r -= x.w; if (r <= 0) return x.name; }
  return ws[ws.length - 1].name;
}

function shortName(n){ const p = (n||'').split(' '); return p[p.length-1]; }

// пенальти: серия до 5 ударов (реализация ~76%), при равенстве — до первого промаха
function simPenalties(){
  let a = 0, b = 0;
  for (let i = 0; i < 5; i++) {
    if (Math.random() < 0.76) a++;
    if (Math.random() < 0.76) b++;
    if (i >= 4 && a !== b) return [a, b];
  }
  while (a === b) { if (Math.random() < 0.76) a++; if (Math.random() < 0.76) b++; }
  return [a, b];
}

// матч стыков: 90 минут → доп. время (λ/3) → пенальти
function relegBuildMatch(rplName, fnlName){
  const H = DB.teams.find(t => t.name === rplName);
  const A = DB.teams.find(t => t.name === fnlName);
  const hi = DB.teams.indexOf(H), ai = DB.teams.indexOf(A);
  const { lh, la } = lambdas(hi, ai);
  let gh = simPoissonGoals(lh), ga = simPoissonGoals(la);
  const ev = [];
  const mins = n => Array.from({length:n}, () => 1 + Math.floor(Math.random() * 90));
  mins(gh).forEach(mn => ev.push({min:mn, home:true,  scorer: simPickScorer(hi) || 'Гол'}));
  mins(ga).forEach(mn => ev.push({min:mn, home:false, scorer: simPickScorer(ai) || 'Гол'}));
  let et = false, pen = null;
  if (gh === ga) {
    et = true;
    const oh = Math.random() < 1 - Math.exp(-lh / 3) ? 1 : 0;
    const oa = Math.random() < 1 - Math.exp(-la / 3) ? 1 : 0;
    if (oh) ev.push({min: 91 + Math.floor(Math.random() * 30), home:true,  scorer: simPickScorer(hi) || 'Гол', et:1});
    if (oa) ev.push({min: 91 + Math.floor(Math.random() * 30), home:false, scorer: simPickScorer(ai) || 'Гол', et:1});
    gh += oh; ga += oa;
    if (gh === ga) pen = simPenalties();
  }
  ev.sort((x, y) => x.min - y.min);
  let ch = 0, ca = 0; const log = [];
  ev.forEach(g => {
    if (g.home) ch++; else ca++;
    log.push(`⚽ ${g.min}' — ${g.scorer} (${ch}:${ca})${g.et ? ' (доп. вр.)' : ''}`);
  });
  if (pen) log.push(`🥅 Серия пенальти: ${pen[0]}:${pen[1]}`);
  const rplWin = pen ? pen[0] > pen[1] : gh > ga;
  return {rplName, fnlName, gh, ga, et, pen, log, rplWin};
}