window.onerror = function(msg, src, line, col){
  document.body.insertAdjacentHTML('afterbegin',
    '<div style="position:fixed;top:0;left:0;right:0;z-index:9999;background:#d7141a;color:#fff;padding:10px;font-family:monospace;font-size:13px">ОШИБКА JS, строка ' + line + ': ' + msg + '</div>');
};
const KEY = 'rpl2627_db_v17';
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const pct = p => (p*100).toFixed(1)+'%';

function validTeam(t){
  return t && typeof t.name === 'string' && typeof t.xgf === 'number' && isFinite(t.xgf)
      && typeof t.xga === 'number' && isFinite(t.xga);
}
/* divOf / idxOf — в data.js */


/* ================== БАЗА ДАННЫХ ================== */
function ensureLeague(db){
  if(!db.league || typeof db.league !== 'object') db.league = {};
  ['rpl','fnl'].forEach(div=>{
    const s = db.league[div];
    if(!s || typeof s !== 'object' || !Number.isFinite(s.homeBoost)){
      db.league[div] = { homeBoost:1.10, awayPenalty:0.95, dixonColes:-0.08 };
    }
  });
  return db;
}
function setLeagueParam(key, value){
  DB.settings[key] = value;
  if(DB.league){
    ['rpl','fnl'].forEach(div => { if(DB.league[div]) DB.league[div][key] = value; });
  }
}
function loadDB(){
  try{
    const d = JSON.parse(localStorage.getItem(KEY));
    if(d && Array.isArray(d.teams) && d.teams.length === 34 && d.teams.every(validTeam)){
      // дозаполнение отсутствующих полей из дефолта
      d.teams.forEach((t,i)=>{ if(t && typeof t === 'object'){
        const def = DEFAULT_TEAMS[i] || {};
        for(const k in def) if(!(k in t)) t[k] = def[k];
      }});
      return ensureLeague(d);
    }
    // невалидные/устаревшие данные — сбрасываем, но предупреждаем
    if(d){ window.__dbWasReset = true; console.warn('Аналитика РПЛ: сохранённая база некорректна (ожидалось 34 команды) — сброс к исходным.'); }
  }catch(e){ window.__dbWasReset = true; console.warn('Аналитика РПЛ: не удалось прочитать базу — сброс к исходным.', e); }
  return ensureLeague({teams: JSON.parse(JSON.stringify(DEFAULT_TEAMS)),
        settings:{homeBoost:1.10, awayPenalty:0.95, dixonColes:-0.08}, probs:null});
}
let DB = loadDB();
function saveDB(){ localStorage.setItem(KEY, JSON.stringify(DB)); }
function showDbResetNotice(){
  if(!window.__dbWasReset) return;
  window.__dbWasReset = false;
  const d = document.createElement('div');
  d.className = 'notice-toast';
  d.textContent = 'Сохранённая база была повреждена и сброшена к исходной.';
  document.body.appendChild(d);
  setTimeout(()=>d.remove(), 8000);
}
/* ================== ВЫДВИЖНОЕ МЕНЮ ================== */
const drawerEl = document.getElementById('drawer');
const drawerBackdrop = document.getElementById('drawerBackdrop');
function openDrawer(){
  if(!drawerEl) return;
  drawerEl.classList.add('open');
  drawerEl.setAttribute('aria-hidden','false');
  if(drawerBackdrop) drawerBackdrop.classList.add('open');
  const lb = document.getElementById('logoBtn');
  if(lb) lb.setAttribute('aria-expanded','true');
}
function closeDrawer(){
  if(!drawerEl) return;
  drawerEl.classList.remove('open');
  drawerEl.setAttribute('aria-hidden','true');
  if(drawerBackdrop) drawerBackdrop.classList.remove('open');
  const lb = document.getElementById('logoBtn');
  if(lb) lb.setAttribute('aria-expanded','false');
}
const logoBtnEl = document.getElementById('logoBtn');
if(logoBtnEl) logoBtnEl.onclick = openDrawer;
const drawerCloseBtn = document.getElementById('drawerClose');
if(drawerCloseBtn) drawerCloseBtn.onclick = closeDrawer;
if(drawerBackdrop) drawerBackdrop.onclick = closeDrawer;

const menuButtons = Array.from(document.querySelectorAll('#drawerMenu button'));
function activateTab(id){
  if(!id || !document.getElementById(id)) return;
  menuButtons.forEach(x => x.classList.toggle('active', x.dataset.tab === id));
  document.querySelectorAll('.tab').forEach(x => x.classList.toggle('active', x.id === id));
  const mainEl = document.querySelector('main');
  if(mainEl) mainEl.classList.toggle('wide', id === 'tab-round');
  if(id === 'tab-admin' && typeof renderAdmin === 'function') renderAdmin();
  refreshAll();
}
menuButtons.forEach(b => {
  b.onclick = () => { activateTab(b.dataset.tab); closeDrawer(); };
});

/* ================== АККАУНТ: ВХОД / РЕГИСТРАЦИЯ ================== */
let AUTH_IS_ADMIN = false;

function renderAccount(){
  const email = (typeof remoteUserEmail === 'function') ? remoteUserEmail() : null;
  const btn = document.getElementById('accountBtn');
  const box = document.getElementById('drawerAccount');
  const adminItem = document.getElementById('drawerAdmin');
  if(btn){
    if(email){
      const local = email.split('@')[0];
      const parts = local.split(/[._-]+/).filter(Boolean);
      const ini = (parts.length > 1 ? parts[0][0] + parts[1][0] : local.slice(0, 2)).toUpperCase();
      btn.innerHTML = `<span class="acc-avatar">${esc(ini)}</span><span class="acc-name">${esc(local)}</span>`;
      btn.title = email;
    } else {
      btn.innerHTML = '<span class="acc-name">Войти</span>';
      btn.title = 'Войти';
    }
  }
  if(box){
    if(email){
      box.innerHTML = `<div class="acc-email">${esc(email)}</div>` +
        `<div class="acc-role">${AUTH_IS_ADMIN ? 'администратор' : 'пользователь'}</div>` +
        `<button class="btn alt" id="accLogout" type="button">Выйти</button>`;
      const lo = document.getElementById('accLogout');
      if(lo) lo.onclick = async () => {
        if(typeof remoteSignOut === 'function') await remoteSignOut();
        if(typeof unlinkAccount === 'function') unlinkAccount();
        AUTH_IS_ADMIN = false;
        renderAccount();
        if(typeof renderAdmin === 'function') renderAdmin();
        renderMetrics(); renderHistory(); renderPredictions();
      };
    } else {
      box.innerHTML = `<div class="acc-guest">Гостевой режим</div>` +
        `<button class="btn" id="accLogin" type="button">Войти / Регистрация</button>`;
      const li = document.getElementById('accLogin');
      if(li) li.onclick = () => openAuth('login');
    }
  }
  if(adminItem) adminItem.hidden = !(email && AUTH_IS_ADMIN);
}

async function refreshAdminRole(){
  AUTH_IS_ADMIN = false;
  if(typeof remoteConfigured === 'function' && remoteConfigured() &&
     typeof remoteUserEmail === 'function' && remoteUserEmail() &&
     typeof remoteIsAdmin === 'function'){
    try{ AUTH_IS_ADMIN = await remoteIsAdmin(); }catch(e){ AUTH_IS_ADMIN = false; }
  }
  renderAccount();
  const adminTab = document.getElementById('tab-admin');
  if(adminTab && adminTab.classList.contains('active') && !AUTH_IS_ADMIN) activateTab('tab-calc');
  if(typeof renderAdmin === 'function') renderAdmin();
}

let authMode = 'login';
function setAuthMode(mode){
  authMode = mode === 'signup' ? 'signup' : 'login';
  const loginTab = document.querySelector('#authTabs [data-mode="login"]');
  const signupTab = document.querySelector('#authTabs [data-mode="signup"]');
  if(loginTab) loginTab.classList.toggle('active', authMode === 'login');
  if(signupTab) signupTab.classList.toggle('active', authMode === 'signup');
  const t = document.getElementById('authTitle');
  if(t) t.textContent = authMode === 'signup' ? 'Регистрация' : 'Вход';
  const p2 = document.getElementById('authPass2');
  const p2w = document.getElementById('authPass2Wrap');
  if(p2) p2.hidden = authMode !== 'signup';
  if(p2w) p2w.hidden = authMode !== 'signup';
  const submit = document.getElementById('authSubmit');
  if(submit) submit.textContent = authMode === 'signup' ? 'Зарегистрироваться' : 'Войти';
  const hint = document.getElementById('authHint');
  if(hint) hint.textContent = authMode === 'signup'
    ? 'Регистрация открыта. Права администратора выдаются отдельно — внесением email в таблицу admins.'
    : 'Войдите, чтобы открыть админку (доступна администраторам).';
  const msg = document.getElementById('authMsg');
  if(msg){ msg.textContent = ''; msg.className = 'auth-msg'; }
}
function openAuth(mode){
  setAuthMode(mode);
  const m = document.getElementById('authModal');
  if(!m) return;
  m.hidden = false;
  const em = document.getElementById('authEmail');
  if(em) setTimeout(() => em.focus(), 30);
}
function closeAuth(){
  const m = document.getElementById('authModal');
  if(m) m.hidden = true;
  const msg = document.getElementById('authMsg');
  if(msg){ msg.textContent = ''; msg.className = 'auth-msg'; }
}
async function submitAuth(){
  const email = (document.getElementById('authEmail')?.value || '').trim();
  const pass = document.getElementById('authPass')?.value || '';
  const pass2 = document.getElementById('authPass2')?.value || '';
  const msg = document.getElementById('authMsg');
  const say = (text, ok) => { if(msg){ msg.textContent = text; msg.className = 'auth-msg ' + (ok ? 'ok' : 'err'); } };
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return say('Укажите корректный email.', false);
  if(pass.length < 6) return say('Пароль должен быть не короче 6 символов.', false);
  if(authMode === 'signup' && pass !== pass2) return say('Пароли не совпадают.', false);
  if(typeof remoteConfigured === 'function' && !remoteConfigured()) return say('Бэкенд не настроен: заполните config.js.', false);
  const btn = document.getElementById('authSubmit');
  if(btn) btn.disabled = true;
  try{
    if(authMode === 'signup'){
      const r = await remoteSignUp(email, pass);
      if(r && r.signedIn){
        await refreshAdminRole();
        await linkAccountOnSignIn();
        refreshAll();
        say('Аккаунт создан, вы вошли.', true);
        setTimeout(closeAuth, 900);
      } else {
        say('Аккаунт создан. Подтвердите email по ссылке из письма, затем войдите.', true);
      }
    } else {
      await remoteSignIn(email, pass);
      await refreshAdminRole();
      await linkAccountOnSignIn();
      refreshAll();
      say('Вы вошли.', true);
      setTimeout(closeAuth, 700);
    }
  }catch(e){
    say(String(e.message || e), false);
  }finally{
    if(btn) btn.disabled = false;
  }
}

const authTabsEl = document.getElementById('authTabs');
if(authTabsEl) authTabsEl.querySelectorAll('button').forEach(b => { b.onclick = () => setAuthMode(b.dataset.mode); });
const authSubmitBtn = document.getElementById('authSubmit');
if(authSubmitBtn) authSubmitBtn.onclick = submitAuth;
const authCloseBtn = document.getElementById('authClose');
if(authCloseBtn) authCloseBtn.onclick = closeAuth;
const accountBtnEl = document.getElementById('accountBtn');
if(accountBtnEl) accountBtnEl.onclick = () => {
  const email = (typeof remoteUserEmail === 'function') ? remoteUserEmail() : null;
  if(email) openDrawer(); else openAuth('login');
};
['authPass','authPass2'].forEach(id => {
  const el = document.getElementById(id);
  if(el) el.addEventListener('keydown', e => { if(e.key === 'Enter') submitAuth(); });
});
document.addEventListener('keydown', e => {
  if(e.key === 'Escape'){ closeDrawer(); closeAuth(); }
});

/* ================== КАЛЬКУЛЯТОР ================== */
function fillSelect(sel, opts){
  const prev = sel.value;
  sel.innerHTML = DB.teams.map((t,i)=>`<option value="${i}">${esc(t.name)}</option>`).join('');
  sel.value = (prev !== '' && prev < DB.teams.length) ? prev : (opts?.def ?? 0);
}
function calcRun(){
  const hi = +$('#calcHome').value, ai = +$('#calcAway').value, out = $('#calcOut');
  if(hi === ai){ out.innerHTML = '<p>Выберите две разные команды.</p>'; return; }
  const H = DB.teams[hi], A = DB.teams[ai];
  const L0 = lambdas(hi, ai);
  const rawH = parseFloat($('#ovH').value), rawA = parseFloat($('#ovA').value);
  const clampL = (v, fb) => isFinite(v) ? Math.min(5, Math.max(0.01, v)) : fb;
  const oh = clampL(rawH, L0.lh), oa = clampL(rawA, L0.la);
  const wasClamped = (isFinite(rawH) && (rawH < 0.01 || rawH > 5)) || (isFinite(rawA) && (rawA < 0.01 || rawA > 5));
  const r = matchProbs(oh, oa);

  let mx = 0, mi = 0, mj = 0;
  for(let i=0;i<=5;i++) for(let j=0;j<=5;j++){
    if(r.m[i][j] > mx){ mx = r.m[i][j]; mi = i; mj = j; }
  }
    let table = '<table class="scores"><tr><th class="l">Хозяева \\ Гости</th>' +
    [0,1,2,3,4,5].map(j=>`<th>${j}</th>`).join('') + '</tr>';
  for(let i=0;i<=5;i++){
    table += `<tr><th class="l">${i}</th>`;
    for(let j=0;j<=5;j++){
      const t = mx ? r.m[i][j]/mx : 0;
      const cellCls = (i===mi&&j===mj) ? ' class="hl"' : '';
      table += `<td${cellCls} style="background:rgba(22,163,74,${(t*0.8).toFixed(2)});color:${t>0.5?'var(--on-accent)':'var(--text)'}">${pct(r.m[i][j])}</td>`;
    }
    table += '</tr>';
  }
  table += '</table>';


    out.innerHTML = `
    <h3 class="match-title">${esc(H.name)} — ${esc(A.name)}</h3>
    <button class="btn alt" id="savePredBtn">Сохранить прогноз</button>
    <div class="grid">
      <div class="info team-box" style="border-left-color:${esc(H.color||'#2a7de0')}"><img class="crest" style="width:40px;height:40px" src="${esc(H.logo)}" onerror="this.style.display='none'"><b>${esc(H.name)}</b> (дома)<br>
        Тренер: ${esc(H.coach)||'—'}<br>Схема: ${esc(H.formation)||'—'}<br>
        Тактика: ${esc(H.tactic)||'—'}</div>
      <div class="info team-box" style="border-left-color:${esc(A.color||'#2a7de0')}"><img class="crest" style="width:40px;height:40px" src="${esc(A.logo)}" onerror="this.style.display='none'"><b>${esc(A.name)}</b> (в гостях)<br>
        Тренер: ${esc(A.coach)||'—'}<br>Схема: ${esc(A.formation)||'—'}<br>
        Тактика: ${esc(A.tactic)||'—'}</div>
    </div>
    <div class="res">
      <div><div class="big">${pct(r.pw)}</div>Победа ${esc(H.name)}</div>
      <div><div class="big">${pct(r.pd)}</div>Ничья</div>
      <div><div class="big">${pct(r.pl)}</div>Победа ${esc(A.name)}</div>
    </div>
    <div class="bar">
      <div style="width:${r.pw*100}%;background:${esc(H.color||'#d7141a')}"></div>
      <div style="width:${r.pd*100}%;background:#9aa5b4"></div>
      <div style="width:${r.pl*100}%;background:${esc(A.color||'#0b1f3a')}"></div>
    </div>
    ${wasClamped ? '<p class="note" style="color:var(--amber)">Ручные λ ограничены допустимым диапазоном 0.01–5.</p>' : ''}
    <p class="note">λ хозяев: <b>${r.lh.toFixed(2)}</b> · λ гостей: <b>${r.la.toFixed(2)}</b></p>
    <div class="tiles">
      <div class="tile"><div class="t-label">Больше 2.5 гола</div><div class="t-value">${pct(r.over25)}</div></div>
      <div class="tile"><div class="t-label">Обе забьют</div><div class="t-value">${pct(r.btts)}</div></div>
      <div class="tile"><div class="t-label">Самый вероятный счёт</div><div class="t-value">${r.best.h}:${r.best.a} <small>${pct(r.best.p)}</small></div></div>
    </div>
    <h3>Матрица счетов (Пуассон)</h3>
    ${table}`;
    const sb = $('#savePredBtn');
    if(sb) sb.onclick = () => {
      addPrediction(H.name, A.name, [r.pw, r.pd, r.pl], r.lh, r.la);
      sb.textContent = 'Прогноз сохранён';
      sb.disabled = true;
      renderPredictions();
    };
}

/* ================== БАЗА КОМАНД ================== */
function loadForm(i){
  const t = DB.teams[i];
  $('#tName').value = t.name; $('#tCoach').value = t.coach; $('#tFormation').value = t.formation;
  $('#tColor').value = t.color; $('#tXgf').value = t.xgf; $('#tXga').value = t.xga;
  $('#tMod').value = t.mod; $('#tTactic').value = t.tactic; $('#tLineup').value = t.lineup;
}
function saveTeam(){
  const i = +$('#teamSel').value, t = DB.teams[i];
  const name = $('#tName').value.trim();
  const xgf = parseFloat($('#tXgf').value);
  const xga = parseFloat($('#tXga').value);
  const modRaw = $('#tMod').value.trim();
  const mod = modRaw === '' ? 1 : parseFloat(modRaw);
  const color = $('#tColor').value.trim();
  if(!name){ alert('Название команды не может быть пустым.'); return; }
  if(!(isFinite(xgf) && xgf >= 0 && xgf <= 10)){ alert('xG за: введите число от 0 до 10.'); return; }
  if(!(isFinite(xga) && xga >= 0 && xga <= 10)){ alert('xG против: введите число от 0 до 10.'); return; }
  if(!(isFinite(mod) && mod >= 0.5 && mod <= 1.5)){ alert('Модификатор состава: число от 0.5 до 1.5.'); return; }
  if(color && !/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(color)){ alert('Цвет укажите в HEX, например #1e5aa8.'); return; }
  t.name = name;
  t.coach = $('#tCoach').value.trim();
  t.formation = $('#tFormation').value.trim();
  t.color = color || t.color;
  t.xgf = xgf;
  t.xga = xga;
  t.mod = mod;
  t.tactic = $('#tTactic').value.trim();
  t.lineup = $('#tLineup').value;
  saveDB(); DB.probs = null; refreshAll();
  alert('Команда сохранена, базы пересчитаны');
}
function renderBase(){
  if(!$('#forms').options.length) $('#forms').innerHTML = Object.keys(FORMATIONS).map(f=>`<option value="${f}">`).join('');
  const sel = $('#teamSel'), prev = sel.value;
  sel.innerHTML = DB.teams.map((t,i)=>`<option value="${i}">${esc(t.name)}</option>`).join('');
  sel.value = prev !== '' ? prev : 0;
  loadForm(+sel.value);
  $('#sHome').value = DB.settings.homeBoost;
  $('#sAway').value = DB.settings.awayPenalty;
  $('#sDC').value = DB.settings.dixonColes ?? -0.08;
   $('#baseTable').innerHTML = `<table><tr>
      <th>#</th><th class="l">Команда</th><th class="l">Тренер</th><th>Схема</th>
      <th>xG за</th><th>xG против</th><th>Модификатор</th><th>Адаптация</th></tr>` +
    DB.teams.map((t,i)=>`<tr>
      <td>${i+1}</td>
      <td class="l"><img class="crest" src="${esc(t.logo)}" onerror="this.outerHTML='<span class=&quot;dot&quot; style=&quot;background:${esc(t.color)}&quot;></span>'">${esc(t.name)}</td>
      <td class="l">${esc(t.coach)||'—'}</td>
      <td>${esc(t.formation)||'—'}</td>
      <td>${t.xgf.toFixed(2)}</td><td>${t.xga.toFixed(2)}</td><td>${t.mod.toFixed(2)}</td><td>${t.adapt ? t.adapt + ' сезон' + (t.adapt > 1 ? 'а' : '') : '—'}</td>
    </tr>`).join('') + '</table>';
}

/* ================== БАЗА ВЕРОЯТНОСТЕЙ (по дивизионам) ================== */
function buildDivProbs(div){
  const idx = idxOf(div), n = idx.length, rounds = (n-1)*2, P = [];
  for(let a=0;a<n;a++){
    P[a] = [];
    for(let b=0;b<n;b++){
      if(a===b){ P[a][b] = null; continue; }
      const r = matchProbs(...Object.values(lambdas(idx[a], idx[b])));
      P[a][b] = {pw:r.pw, pd:r.pd, pl:r.pl};
    }
  }
  const summary = idx.map((ti,a)=>{
    let hw=0, hd=0, aw=0, ad=0;
    for(let b=0;b<n;b++){
      if(a===b) continue;
      hw += P[a][b].pw; hd += P[a][b].pd;
      aw += P[b][a].pl; ad += P[b][a].pd;
    }
    hw/=n-1; hd/=n-1; aw/=n-1; ad/=n-1;
    const winAvg = (hw+aw)/2;
    const xPts = 3*winAvg + (hd+ad)/2;
    return {name:DB.teams[ti].name, homeWin:hw, homeDraw:hd, awayWin:aw, awayDraw:ad,
            winAvg, xPts, season: xPts*rounds};
  });
  return {rounds, summary, matrix: P};
}
function computeProbs(){
  DB.probs = {rpl: buildDivProbs('rpl'), fnl: buildDivProbs('fnl')};
  return DB.probs;
}
function renderProbs(){
  // база должна соответствовать текущим дивизионам — иначе пересчитываем на месте
  let p = DB.probs;
  const need = {rpl: idxOf('rpl').length, fnl: idxOf('fnl').length};
  const ok = p && p.rpl && p.fnl
    && Array.isArray(p.rpl.matrix) && p.rpl.matrix.length === need.rpl
    && Array.isArray(p.fnl.matrix) && p.fnl.matrix.length === need.fnl;
  if(!ok) p = computeProbs();

  let html = '';
  [['rpl','РПЛ'],['fnl','ФНЛ']].forEach(([div, label])=>{
    const d = p[div], idx = idxOf(div);
    const sorted = d.summary.map((s,i)=>({...s,i})).sort((a,b)=>b.season-a.season);
    html += `<h3>${label} · ${d.summary.length} команд · ${d.rounds} туров</h3>` +
      `<table><tr><th>#</th><th class="l">Команда</th><th>P(победа дома)</th><th>P(ничья дома)</th>
      <th>P(победа в гостях)</th><th>Средняя P(победы)</th><th>xPts / матч</th><th>Прогноз на сезон</th></tr>` +
      sorted.map((s,k)=>`<tr>
        <td>${k+1}</td>
        <td class="l"><span class="dot" style="background:${esc(DB.teams[idx[s.i]].color)}"></span>${esc(s.name)}</td>
        <td>${pct(s.homeWin)}</td><td>${pct(s.homeDraw)}</td>
        <td>${pct(s.awayWin)}</td><td><b>${pct(s.winAvg)}</b></td>
        <td>${s.xPts.toFixed(2)}</td><td><b>${s.season.toFixed(1)}</b></td>
      </tr>`).join('') + '</table>';
  });
  $('#probTable').innerHTML = html;

  // матрица — в защитном кожухе: любая ошибка покажется прямо в карточке
  try{
    let mhtml = '';
    [['rpl','РПЛ'],['fnl','ФНЛ']].forEach(([div, label])=>{
      const d = p[div], idx = idxOf(div);
      mhtml += `<h3 style="margin-top:20px">Матрица: P(победа хозяев) — ${label}</h3>
        <table class="mx"><tr><th class="l">Дома \\ в гостях</th>` +
        idx.map(i=>{
          const nm = DB.teams[i].name;
          const sh = nm.length > 9 ? nm.slice(0, 8) + '…' : nm;
          return `<th style="font-size:10px" title="${esc(nm)}">${esc(sh)}</th>`;
        }).join('') + '</tr>';
      idx.forEach((ti,a)=>{
        const row = d.matrix[a] || [];
        mhtml += `<tr><td class="l" style="white-space:nowrap"><b>${esc(DB.teams[ti].name)}</b></td>`;
        idx.forEach((_,b)=>{
          if(a===b){ mhtml += '<td style="background:var(--surface2)">—</td>'; return; }
          const v = (row[b] && typeof row[b] === 'object') ? row[b].pw : null;
          if(v === null || !isFinite(v)){ mhtml += '<td>?</td>'; return; }
          const s = Math.min(1, v*1.6);
          mhtml += `<td style="background:rgba(215,20,26,${s.toFixed(2)});color:${s>0.5?'var(--on-accent)':'var(--text)'}">${(v*100).toFixed(0)}%</td>`;
        });
        mhtml += '</tr>';
      });
      mhtml += '</table>';
    });
    $('#probMatrix').innerHTML = mhtml;
  }catch(e){
    $('#probMatrix').innerHTML = '<p class="note" style="color:#d7141a">Ошибка матрицы: ' + esc(e.message) + ' — нажми «Пересчитать и сохранить».</p>';
  }
}

/* ================== СРАВНЕНИЕ ЛИЦОМ К ЛИЦУ ================== */
function crestImg(t, size){
  if(!t || !t.logo)
    return `<span class="dot" style="background:${t ? esc(t.color||'#8a97b5') : '#8a97b5'};width:${size-4}px;height:${size-4}px"></span>`;
  return `<img class="crest" style="width:${size}px;height:${size}px" src="${esc(t.logo)}" ` +
    `onerror="this.outerHTML='<span class=&quot;dot&quot; style=&quot;background:${esc(t.color)}&quot;></span>'">`;
}

function fillH2H(){
  const a = $('#h2hA').value, b = $('#h2hB').value;
  const opts = DB.teams.map((t,i)=>`<option value="${i}">${esc(t.name)}</option>`).join('');
  $('#h2hA').innerHTML = opts; $('#h2hB').innerHTML = opts;
  $('#h2hA').value = a || 0; $('#h2hB').value = b || 1;
}
/* === Синхронизация выбора команд между калькулятором и сравнением === */
function syncH2HFromCalc(){
  $('#h2hA').value = $('#calcHome').value;
  $('#h2hB').value = $('#calcAway').value;
}
function syncCalcFromH2H(){
  $('#calcHome').value = $('#h2hA').value;
  $('#calcAway').value = $('#h2hB').value;
}

/* === Разбор состава (parseLineup, shortName) — в model.js === */

/* === БИБЛИОТЕКА РАССТАНОВОК ===
   x — глубина линии: 0 свои ворота … 100 чужие (без вратаря, он всегда 5)
   ys — позиции игроков линии по ширине поля: 0 левый край … 100 правый */
const FORMATIONS = {
  '4-2-3-1': [
    {tag:'ЗАЩ', x:18, ys:[13,38,62,87]},
    {tag:'ОП',  x:36, ys:[38,62]},
    {tag:'АП',  x:56, ys:[15,50,85]},
    {tag:'НАП', x:76, ys:[50]}],
  '4-4-2': [
    {tag:'ЗАЩ', x:18, ys:[13,38,62,87]},
    {tag:'ПЗ',  x:45, ys:[12,38,62,88]},
    {tag:'НАП', x:70, ys:[38,62]}],
  '4-3-3': [
    {tag:'ЗАЩ', x:18, ys:[13,38,62,87]},
    {tag:'ПЗ',  x:42, ys:[25,50,75]},
    {tag:'НАП', x:64, ys:[15,50,85]}],
  '4-1-4-1': [
    {tag:'ЗАЩ', x:18, ys:[13,38,62,87]},
    {tag:'ОП',  x:34, ys:[50]},
    {tag:'ПЗ',  x:54, ys:[12,38,62,88]},
    {tag:'НАП', x:74, ys:[50]}],
  '4-4-1-1': [
    {tag:'ЗАЩ', x:18, ys:[13,38,62,87]},
    {tag:'ПЗ',  x:46, ys:[12,38,62,88]},
    {tag:'ДП',  x:62, ys:[50]},
    {tag:'НАП', x:76, ys:[50]}],
  '4-3-1-2': [
    {tag:'ЗАЩ', x:18, ys:[13,38,62,87]},
    {tag:'ПЗ',  x:40, ys:[22,50,78]},
    {tag:'ДП',  x:58, ys:[50]},
    {tag:'НАП', x:74, ys:[38,62]}],
  '4-2-2-2': [
    {tag:'ЗАЩ', x:18, ys:[13,38,62,87]},
    {tag:'ОП',  x:38, ys:[38,62]},
    {tag:'ДП',  x:58, ys:[38,62]},
    {tag:'НАП', x:74, ys:[38,62]}],
  '3-5-2': [
    {tag:'ЗАЩ', x:18, ys:[25,50,75]},
    {tag:'ПЗ',  x:45, ys:[10,32,50,68,90]},
    {tag:'НАП', x:72, ys:[38,62]}],
  '3-4-3': [
    {tag:'ЗАЩ', x:18, ys:[25,50,75]},
    {tag:'ПЗ',  x:42, ys:[14,38,62,86]},
    {tag:'НАП', x:66, ys:[15,50,85]}],
  '5-3-2': [
    {tag:'ЗАЩ', x:18, ys:[8,28,50,72,92]},
    {tag:'ПЗ',  x:42, ys:[26,50,74]},
    {tag:'НАП', x:70, ys:[38,62]}],
  '3-4-2-1': [
    {tag:'ЗАЩ', x:18, ys:[25,50,75]},
    {tag:'ПЗ',  x:42, ys:[14,38,62,86]},
    {tag:'АП',  x:60, ys:[30,70]},
    {tag:'НАП', x:76, ys:[50]}]
};

function lineOfPlayer(label){
  const L = (label || '').toUpperCase();
  if(/ЗАЩ|ЦЗ/.test(L)) return 'def';
  if(/НАП|ФОРВ/.test(L)) return 'fwd';
  if(/АТАК/.test(L)) return 'att';
  return 'mid';
}

/* В заявке иногда оказывается лишний игрок (12 вместо 11). Оставляем ровно
   10 полевых: лишних убираем из переполненной линии, ориентируясь на схему. */
function trimOutfield(rows, formation){
  const total = rows.reduce((s,r)=>s+r.names.length,0);
  if(total <= 10) return rows;
  const nums = String(formation||'').split('-').map(Number).filter(n => Number.isFinite(n) && n > 0);
  let defE = 0, midE = 0, attE = 0;
  if(nums.length >= 2){
    defE = nums[0];
    attE = nums[nums.length-1];
    midE = Math.max(0, 10 - defE - attE);
  }
  const items = [];
  rows.forEach((r, ri) => r.names.forEach((nm, ni) => items.push({ ri, ni, line: lineOfPlayer(r.label) })));
  const count = pred => items.filter(pred).length;
  const sumA = { def: count(x=>x.line==='def'), mid: count(x=>x.line==='mid'), att: count(x=>x.line==='fwd'||x.line==='att') };
  const sumB = { def: count(x=>x.line==='def'), mid: count(x=>x.line==='mid'||x.line==='att'), att: count(x=>x.line==='fwd') };
  const over = s => Math.max(0, s.def-defE) + Math.max(0, s.mid-midE) + Math.max(0, s.att-attE);
  const useA = over(sumA) <= over(sumB);
  const lineOf = x => useA ? (x.line==='fwd'||x.line==='att' ? 'att' : x.line) : (x.line==='att' ? 'mid' : x.line);
  const expected = { def:defE, mid:midE, att:attE };
  const seen = { def:0, mid:0, att:0 };
  const drop = new Set();
  items.forEach(x => {
    const g = lineOf(x);
    seen[g]++;
    if(nums.length >= 2 && seen[g] > expected[g]) drop.add(x.ri + ':' + x.ni);
  });
  let kept = 0;
  const out = rows.map((r, ri) => {
    const names = r.names.filter((_, ni) => !drop.has(ri + ':' + ni));
    kept += names.length;
    return { label: r.label, names };
  }).filter(r => r.names.length);
  // страховка, если схема не распознана: жёстко ограничиваем 10 полевыми
  if(kept > 10){
    let excess = kept - 10;
    for(let i = out.length - 1; i >= 0 && excess > 0; i--){
      const cut = Math.min(excess, out[i].names.length);
      out[i].names = out[i].names.slice(0, out[i].names.length - cut);
      excess -= cut;
    }
    return out.filter(r => r.names.length);
  }
  return out;
}

function pitchPlayers(t, side){
  const rows = parseLineup(t.lineup);
  if(!rows.length) return '';
  let gk = null, outRows = rows;
  if((rows[0].label||'').toUpperCase().startsWith('ВР') || rows[0].names.length===1){
    gk = rows[0].names[0]; outRows = rows.slice(1);
  }
  outRows = trimOutfield(outRows, t.formation);
  const F = FORMATIONS[(t.formation||'').trim()];
  const total = outRows.reduce((s,r)=>s+r.names.length,0);
  const flat = outRows.flatMap(r=>r.names);
  const slotCount = F ? F.reduce((s,p)=>s+p.ys.length,0) : 0;
  const exact = F && F.length===outRows.length && slotCount===total;
  const sequential = !exact && F && slotCount===flat.length && flat.length===10;

  // каждая команда занимает свою половину поля: 4%..48%
  const mapX = x => 4 + x*0.44;
  const X = x => side==='L' ? mapX(x) : 100-mapX(x);

  let html = '';
  const put = (nm, x, y, tag)=>{
    html += `<div class="plr" style="left:${X(x).toFixed(1)}%;top:${y.toFixed(1)}%" title="${esc(nm)}">`+
      `<div class="av" style="background:${esc(t.color)}">${tag}</div>${esc(shortName(nm))}</div>`;
  };
  if(gk) put(gk, 3, 50, 'ВР');

    if(exact){
    F.forEach((p,r)=> p.ys.forEach((y,i)=>{
      const nm = outRows[r].names[i];
      if(nm) put(nm, p.x, y, p.tag);
    }));
  }
 else if(sequential){
    // строки состава не совпали со схемой — заполняем слоты плана по порядку
    let k = 0;
    F.forEach(p=> p.ys.forEach(y=>{ if(flat[k]) put(flat[k++], p.x, y, p.tag); }));
  } else {
    const nL = outRows.length;
    const SPREAD = {1:0, 2:16, 3:32, 4:38, 5:40};
    outRows.forEach((row, r)=>{
      const m = row.names.length;
      const xFrac = nL>1 ? r/(nL-1) : 0.5;
      const xL = 18 + xFrac*56;
      const half = SPREAD[Math.min(m,5)] || 40;
      row.names.forEach((nm,i)=>{
        const y = m===1 ? 50 : 50 + ((i-(m-1)/2)/((m-1)/2))*half;
        put(nm, xL, y, String(r+1));
      });
    });
  }
  return html;
}


function renderH2H(){
  const hi = +$('#h2hA').value, ai = +$('#h2hB').value, out = $('#h2hOut');
  if(hi === ai){ out.innerHTML = '<p class="note">Выберите две разные команды.</p>'; return; }
  const H = DB.teams[hi], A = DB.teams[ai];
  const {lh, la} = lambdas(hi, ai);
  const r = matchProbs(lh, la);

  out.innerHTML = `
    <div style="display:flex;justify-content:center;align-items:center;gap:10px;flex-wrap:wrap">
      ${crestImg(H,32)} <b>${esc(H.name)}</b>
      <span class="note">против</span>
      <b>${esc(A.name)}</b> ${crestImg(A,32)}
    </div>
    <div class="pitch">
      <div class="box l"></div><div class="circ"></div><div class="box r"></div>
      ${pitchPlayers(H,'L')}${pitchPlayers(A,'R')}
    </div>
    <p class="note" style="text-align:center">
      ${esc(H.formation)} · ${esc(H.tactic)} &nbsp;—&nbsp; ${esc(A.formation)} · ${esc(A.tactic)}
    </p>
    <div class="res">
      <div><div class="big">${pct(r.pw)}</div>Победа ${esc(H.name)}</div>
      <div><div class="big">${pct(r.pd)}</div>Ничья</div>
      <div><div class="big">${pct(r.pl)}</div>Победа ${esc(A.name)}</div>
    </div>
    <div class="bar">
      <div style="width:${r.pw*100}%;background:${esc(H.color||'#d7141a')}"></div>
      <div style="width:${r.pd*100}%;background:#9aa5b4"></div>
      <div style="width:${r.pl*100}%;background:${esc(A.color||'#0b1f3a')}"></div>
    </div>
    <p class="note">λ хозяев: <b>${lh.toFixed(2)}</b> · λ гостей: <b>${la.toFixed(2)}</b> ·
      Больше 2.5: <b>${pct(r.over25)}</b> · Обе забьют: <b>${pct(r.btts)}</b> ·
      Вероятный счёт: <b>${r.best.h}:${r.best.a}</b></p>`;
}

/* ================== ЭКСПОРТ / ИМПОРТ / СБРОС ================== */
$('#calcBtn').onclick = () => { renderMatchInfo(null); calcRun(); };
$('#ovH').oninput = calcRun; $('#ovA').oninput = calcRun;
$('#calcHome').onchange = ()=>{ renderMatchInfo(null); calcRun(); syncH2HFromCalc(); renderH2H(); };
$('#calcAway').onchange = ()=>{ renderMatchInfo(null); calcRun(); syncH2HFromCalc(); renderH2H(); };
$('#sDC').onchange = e => {
  const v = parseFloat(e.target.value);
  if(isFinite(v)) setLeagueParam('dixonColes', v);
  DB.probs=null; saveDB(); refreshAll();
};

$('#h2hA').onchange = ()=>{ renderH2H(); syncCalcFromH2H(); calcRun(); };
$('#h2hB').onchange = ()=>{ renderH2H(); syncCalcFromH2H(); calcRun(); };
$('#teamSel').onchange = e => loadForm(+e.target.value);
$('#saveTeamBtn').onclick = saveTeam;
$('#resetBtn').onclick = ()=>{
  if(!confirm('Сбросить все данные к исходным?')) return;
        DB = ensureLeague({teams: JSON.parse(JSON.stringify(DEFAULT_TEAMS)),
          settings:{homeBoost:1.10, awayPenalty:0.95, dixonColes:-0.08}, probs:null});
  saveDB(); refreshAll();
};

$('#sHome').onchange = e => { setLeagueParam('homeBoost', parseFloat(e.target.value)||1.1); DB.probs=null; saveDB(); refreshAll(); };
$('#sAway').onchange = e => { setLeagueParam('awayPenalty', parseFloat(e.target.value)||0.95); DB.probs=null; saveDB(); refreshAll(); };
$('#recalcBtn').onclick = ()=>{ computeProbs(); saveDB(); renderProbs(); alert('База вероятностей пересчитана и сохранена'); };
$('#exportBtn').onclick = ()=>{ $('#io').value = JSON.stringify(DB, null, 2); };
$('#importBtn').onclick = ()=>{
  try{
    const d = JSON.parse($('#io').value);
    if(!d.teams || d.teams.length !== 34) throw new Error('Нужно ровно 34 команд');
    if(!d.teams.every(validTeam)) throw new Error('В одной из команд некорректные поля (name/xgf/xga)');
    DB = ensureLeague(d); DB.probs = null; saveDB(); refreshAll(); alert('Импорт выполнен');
  }catch(e){ alert('Ошибка импорта: '+e.message); }
};

/* ================== СИМУЛЯЦИЯ ТУРА (РПЛ и ФНЛ независимо) ==================
   Чистые функции симуляции (голы, календарь, бомбардиры, спуск) — в model.js,
   SIM_TICK_MS / SIM_MINUTES / simNewState — тоже там. Здесь — только UI-логика. */
let relegPrevReady = false;   // флаг для relegRefresh — объявлен ДО первого simNewRound()

const SIMS = {rpl: simNewState(), fnl: simNewState()};
let simDiv = 'rpl', S = SIMS.rpl;

/* иконки кнопок симуляции */
const SIM_ICON = {
  play: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4.6 3.2v9.6L12.8 8z" fill="currentColor"/></svg>',
  pause: '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="4" y="3" width="2.7" height="10" rx="1" fill="currentColor"/><rect x="9.3" y="3" width="2.7" height="10" rx="1" fill="currentColor"/></svg>',
  skip: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 3.5v9L10.2 8z" fill="currentColor"/><rect x="11" y="3.5" width="1.8" height="9" rx=".9" fill="currentColor"/></svg>',
  ff: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2.6 3.5v9L8.2 8zM8.2 3.5v9L13.8 8z" fill="currentColor"/></svg>',
  next: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 3.5v9L10.2 8z" fill="currentColor"/><path d="M11.6 3.5L14 8l-2.4 4.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  refresh: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M13 8a5 5 0 1 1-1.6-3.7M13 2.8v3.4h-3.4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>'
};
const simRounds = () => idxOf(simDiv).length - 1 ? (idxOf(simDiv).length - 1) * 2 : 30;

function simNewRound() {
  const ROUNDS = simRounds();

  // тур в процессе — возвращаемся к нему
  if (S.matches.length && !S.matches.every(m => m.done)) {
    simStopTimer();
    const st = document.getElementById('simStatus');
    st.textContent = `Тур ${S.round} из ${ROUNDS}: матч прерван — жмите «Пуск», чтобы продолжить.`;
    st.classList.remove('active');
    simRender();
    return;
  }

  // тур завершён — фиксируем в зачёт (строго один раз) и показываем итоги
  if (S.matches.length) {
    if (S.finRound !== S.round) { simFinalizeRound(S); S.finRound = S.round; }
    clearInterval(S.timer); S.timer = null;
    const play = document.getElementById('simPlay');
    play.innerHTML = SIM_ICON.play + 'Пуск'; play.disabled = false;
    document.getElementById('simSkip').disabled = true;
    document.getElementById('simNext').disabled = false;
    const st = document.getElementById('simStatus');
    st.textContent = S.round >= ROUNDS
      ? 'Последний тур завершён! Жмите «Следующий тур» — увидите чемпиона.'
      : `Тур ${S.round} завершён! Жмите «Следующий тур».`;
    st.classList.add('active');
    simRender();
    return;
  }

  if (!S.schedule) S.schedule = simBuildSchedule();

  // конец сезона дивизиона
  if (S.round > ROUNDS) {
    S.over = true;
    S.matches = [];
    simStopTimer();
    const champ = Object.values(S.standings)
      .sort((a,b) => b.pts - a.pts || (b.gf-b.ga)-(a.gf-a.ga) || b.gf-a.gf)[0];
    const st = document.getElementById('simStatus');
    st.textContent = champ
      ? `🏆 Сезон завершён! Чемпион: ${champ.name} — ${champ.pts} очков. Кнопка ниже начнёт новый сезон.`
      : 'Сезон завершён.';
    st.classList.add('active');
    const nxt = document.getElementById('simNext');
    nxt.disabled = false;
    nxt.innerHTML = SIM_ICON.refresh + 'Новый сезон';
    simRender();
    return;
  }

  const pairs = S.schedule[S.round - 1];
  S.matches = pairs.map(([hi, ai]) => {
    const { lh, la } = lambdas(hi, ai);
    const hg = [], ag = [];
    for (let k = 0; k < simPoissonGoals(lh); k++)
      hg.push({ min: 1 + Math.floor(Math.random() * 90), scorer: simPickScorer(hi) || 'Гол' });
    for (let k = 0; k < simPoissonGoals(la); k++)
      ag.push({ min: 1 + Math.floor(Math.random() * 90), scorer: simPickScorer(ai) || 'Гол' });
    hg.sort((a, b) => a.min - b.min);
    ag.sort((a, b) => a.min - b.min);
    return {
      hi, ai,
      home: DB.teams[hi].name, away: DB.teams[ai].name,
      min: 0, gh: 0, ga: 0,
      hg, ag,
      log: [], done: false
    };
  });

  simStopTimer();
  const nxt = document.getElementById('simNext');
  nxt.innerHTML = SIM_ICON.next + 'Следующий тур';
  nxt.disabled = true;
  document.getElementById('simPlay').disabled = false;
  document.getElementById('simPlay').innerHTML = SIM_ICON.play + 'Пуск';
  document.getElementById('simSkip').disabled = true;
  const st = document.getElementById('simStatus');
  st.textContent = `Тур ${S.round} из ${ROUNDS}: нажмите «Пуск».`;
  st.classList.remove('active');
  simRender();
}


function simGoal(m, isHome, scorer) {
  if (isHome) m.gh++; else m.ga++;
  S.scorers[scorer] = (S.scorers[scorer] || 0) + 1;
  m.log.unshift(`⚽ ${m.min}' — ${scorer} (${m.gh}:${m.ga})`);
  if (m.log.length > 3) m.log.pop();
  m.flash = true;
}

function simMinute(m) {
  m.min++;
  while (m.hg.length && m.hg[0].min === m.min) simGoal(m, true,  m.hg.shift().scorer);
  while (m.ag.length && m.ag[0].min === m.min) simGoal(m, false, m.ag.shift().scorer);
  if (m.min >= SIM_MINUTES) m.done = true;
}

function simTick() {
  let live = false;
  S.matches.forEach(m => { if (!m.done) { simMinute(m); live = true; } });
  simRender();
  if (!live) simStopTimer(true);
}

function simStopTimer(finished) {
  clearInterval(S.timer);
  S.timer = null;
  const play = document.getElementById('simPlay');
  play.innerHTML = SIM_ICON.play + 'Пуск';
  play.disabled = false;
  document.getElementById('simSkip').disabled = true;
  document.getElementById('simNext').disabled = true;   // тур не завершён — переход запрещён
  if (finished) {
    const ROUNDS = simRounds();
    document.getElementById('simNext').disabled = false;
    const st = document.getElementById('simStatus');
    st.textContent = S.round >= ROUNDS
      ? 'Последний тур завершён! Жмите «Следующий тур» — увидите чемпиона.'
      : 'Тур завершён! Жмите «Следующий тур».';
    st.classList.add('active');
  }
}

function simToggle() {
  const play = document.getElementById('simPlay');
  const st = document.getElementById('simStatus');
  const ROUNDS = simRounds();
  if (S.timer) {
    clearInterval(S.timer); S.timer = null;
    play.textContent = '▶ Пуск';
    document.getElementById('simSkip').disabled = true;
    st.textContent = 'Пауза.';
    st.classList.remove('active');
  } else {
    if (!S.matches.length || S.matches.every(m => m.done)) return;
    S.timer = setInterval(simTick, SIM_TICK_MS);
    play.innerHTML = SIM_ICON.pause + 'Пауза';
    document.getElementById('simSkip').disabled = false;
    st.textContent = `Тур ${S.round} из ${ROUNDS} идёт...`;
    st.classList.add('active');
  }
}

function simSkip() {
  simStopTimer(true);
  S.matches.forEach(m => { while (m.min < SIM_MINUTES) simMinute(m); });
  simRender();
}

// мгновенный дожим сезона: доигрываем текущий тур, затем разыгрываем все оставшиеся
function simFastForward() {
  if (S.over) return;
  simStopTimer();
  const ROUNDS = simRounds();

  // текущий тур — честно доигрываем минуты (голы уже разыграны)
  S.matches.forEach(m => { while (m.min < SIM_MINUTES) simMinute(m); });

  // остальные туры создаём и сразу разыгрываем
  if (!S.schedule) S.schedule = simBuildSchedule();
  while (S.round < ROUNDS) {
    if (S.finRound !== S.round) simFinalizeRound(S);  // фиксируем только неучтённый тур
    S.finRound = S.round;
    S.round++;
    S.matches = S.schedule[S.round - 1].map(([hi, ai]) => {
      const { lh, la } = lambdas(hi, ai);
      const hg = [], ag = [];
      for (let k = 0; k < simPoissonGoals(lh); k++)
        hg.push({ min: 1 + Math.floor(Math.random() * 90), scorer: simPickScorer(hi) || 'Гол' });
      for (let k = 0; k < simPoissonGoals(la); k++)
        ag.push({ min: 1 + Math.floor(Math.random() * 90), scorer: simPickScorer(ai) || 'Гол' });
      hg.sort((a, b) => a.min - b.min);
      ag.sort((a, b) => a.min - b.min);
      return { hi, ai, home: DB.teams[hi].name, away: DB.teams[ai].name,
               min: 0, gh: 0, ga: 0, hg, ag, log: [], done: false };
    });
    S.matches.forEach(m => { while (m.min < SIM_MINUTES) simMinute(m); });
  }
  if (S.finRound !== S.round) simFinalizeRound(S);    // последний тур — тоже с защитой
  S.finRound = S.round;
  S.matches = [];
  S.over = true;

  const champ = Object.values(S.standings)
    .sort((a, b) => b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf)[0];
  const st = document.getElementById('simStatus');
  st.textContent = champ
    ? `🏆 Сезон доигран мгновенно! Чемпион: ${champ.name} — ${champ.pts} очков.`
    : 'Сезон завершён.';
  st.classList.add('active');
  const nxt = document.getElementById('simNext');
  nxt.disabled = false;
  nxt.textContent = '🔄 Новый сезон';
  simRender();
}

$('#simFF').onclick = simFastForward;

function simRender() {
  relegRefresh();
  document.getElementById('simFF').disabled = S.over || !S.matches.length;
  document.getElementById('simGrid').innerHTML = S.matches.map(m => {
    const pct = Math.max(0, Math.min(100, (m.min / 90) * 100));
    const lead = m.gh > m.ga ? 'h' : (m.ga > m.gh ? 'a' : '');
    return `
    <div class="sim-match${m.done ? ' done' : ''}">
      <div class="sm-top">
        <span class="sm-min">${m.done ? 'Завершён' : m.min + "'"}</span>
        <span class="sm-progress" aria-hidden="true"><i style="width:${pct.toFixed(1)}%"></i></span>
      </div>
      <div class="sm-row">
        <span class="sm-team${lead === 'h' ? ' lead' : ''}">${crestImg(DB.teams[m.hi], 20)}<span class="sm-name">${esc(m.home)}</span></span>
        <span class="sm-score${m.flash ? ' flash' : ''}">${m.gh}:${m.ga}</span>
        <span class="sm-team away${lead === 'a' ? ' lead' : ''}"><span class="sm-name">${esc(m.away)}</span>${crestImg(DB.teams[m.ai], 20)}</span>
      </div>
      <div class="sm-log">${m.log.map(esc).join('<br>') || '&nbsp;'}</div>
    </div>`;
  }).join('');
  S.matches.forEach(m => m.flash = false);
  simRenderTable();
  simRenderScorers();
}

// таблица = сезонный зачёт этого дивизиона + текущие счета идущих матчей
function simRenderTable() {
  const T = {};
  for (const k in S.standings) T[k] = {...S.standings[k]};
  S.matches.forEach(m => {
    const th = T[m.home] || (T[m.home] = simEmptyRow(m.home));
    const ta = T[m.away] || (T[m.away] = simEmptyRow(m.away));
    th.g++; ta.g++;
    th.gf += m.gh; th.ga += m.ga;
    ta.gf += m.ga; ta.ga += m.gh;
    if (m.gh > m.ga) { th.w++; ta.l++; th.pts += 3; }
    else if (m.gh < m.ga) { ta.w++; th.l++; ta.pts += 3; }
    else { th.d++; ta.d++; th.pts++; ta.pts++; }
  });
  const rows = Object.values(T).sort((a, b) =>
    b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf || a.name.localeCompare(b.name));

  $('#simTable').innerHTML = `<table><tr>
      <th>#</th><th class="l">Команда</th><th>И</th><th>В</th><th>Н</th><th>П</th>
      <th>ЗМ</th><th>ПМ</th><th>РМ</th><th>О</th></tr>` +
    rows.map((r, i) => {
      const tt = DB.teams.find(x => x.name === r.name) || {logo:'', color:'#8a97b5'};
      const cls = i < 2 ? ' class="tbl-up"' : (i >= rows.length - 2 ? ' class="tbl-down"' : '');
      return `<tr${cls}>
        <td>${i + 1}</td>
        <td class="l">${crestImg(tt, 22)}<b>${esc(r.name)}</b></td>
        <td>${r.g}</td><td>${r.w}</td><td>${r.d}</td><td>${r.l}</td>
        <td>${r.gf}</td><td>${r.ga}</td>
        <td>${r.gf - r.ga > 0 ? '+' : ''}${r.gf - r.ga}</td>
        <td><b>${r.pts}</b></td>
      </tr>`;
    }).join('') + '</table>';
}

function simRenderScorers() {
  const top = Object.entries(S.scorers).sort((a, b) => b[1] - a[1]).slice(0, 10);
  $('#simScorers').innerHTML = top.length
    ? `<table><tr><th>#</th><th class="l">Игрок</th><th>Голы</th></tr>` +
      top.map((s, i) => `<tr><td>${i + 1}</td><td class="l">${esc(s[0])}</td><td><b>${s[1]}</b></td></tr>`).join('') + '</table>'
    : '<p class="note">Голов пока нет.</p>';
}

$('#simPlay').onclick = simToggle;
$('#simSkip').onclick = simSkip;
$('#simNext').onclick = () => {
  if (S.matches.length && !S.matches.every(m => m.done)) return; // тур не завершён — переход запрещён
  if (S.over) {
    S.round = 1; S.standings = {}; S.scorers = {}; S.over = false; S.schedule = null; S.finRound = 0;
    document.getElementById('simNext').innerHTML = SIM_ICON.next + 'Следующий тур';
    decayAdapt();
    simNewRound();
    return;
  }
  // фиксируем завершённый тур ровно один раз, затем переходим к следующему
  if (S.matches.length && S.finRound !== S.round) { simFinalizeRound(S); S.finRound = S.round; }
  S.matches = [];
  S.round++;
  simNewRound();
};


/* ---------- ПЕРЕКЛЮЧЕНИЕ ЛИГИ В СИМУЛЯЦИИ ---------- */
const SIM_LEAGUES = {
  rpl:{ name:'РПЛ', sub:'Высший дивизион', logo:'assets/league-rpl.png' },
  fnl:{ name:'ФНЛ', sub:'Первая лига', logo:'assets/league-fnl.png' }
};

function syncSimLeague(){
  const panel = $('#leaguePanel'); if(!panel) return;
  const L = SIM_LEAGUES[simDiv] || SIM_LEAGUES.rpl;
  panel.dataset.league = simDiv;
  const img = $('#leagueBadgeImg');
  if(img){ img.src = L.logo; img.alt = L.name; }
  if($('#leagueBadgeName')) $('#leagueBadgeName').textContent = L.name;
  if($('#leagueBadgeSub')) $('#leagueBadgeSub').textContent = L.sub;
  document.querySelectorAll('#leagueMenu [data-league]').forEach(b => {
    b.setAttribute('aria-selected', b.dataset.league === simDiv ? 'true' : 'false');
  });
}

function setSimLeague(div){
  if(!SIM_LEAGUES[div] || div === simDiv) return;
  simDiv = div;
  S = SIMS[div];
  simNewRound();
  syncSimLeague();
}

const leagueBadge = $('#leagueBadge'), leagueMenu = $('#leagueMenu');
function closeLeagueMenu(){
  if(!leagueMenu) return;
  leagueMenu.hidden = true;
  if(leagueBadge) leagueBadge.setAttribute('aria-expanded', 'false');
}
if(leagueBadge && leagueMenu){
  leagueBadge.addEventListener('click', e => {
    e.stopPropagation();
    const open = leagueMenu.hidden;
    leagueMenu.hidden = !open;
    leagueBadge.setAttribute('aria-expanded', String(open));
  });
  leagueMenu.querySelectorAll('[data-league]').forEach(btn => {
    btn.addEventListener('click', () => { setSimLeague(btn.dataset.league); closeLeagueMenu(); });
  });
  document.addEventListener('click', e => {
    if(leagueMenu.hidden) return;
    if(leagueMenu.contains(e.target) || leagueBadge.contains(e.target)) return;
    closeLeagueMenu();
  });
  document.addEventListener('keydown', e => { if(e.key === 'Escape') closeLeagueMenu(); });
}

// стартовые туры обоих дивизионов
simDiv = 'rpl'; S = SIMS.rpl;
simNewRound();
syncSimLeague();

/* ================== ПЕРЕХОДНЫЕ СТЫКИ ================== */
function relegReady(){
  return SIMS.rpl.over && SIMS.fnl.over;
}
function relegSorted(div){
  return Object.values(SIMS[div].standings)
    .sort((a,b) => b.pts - a.pts || (b.gf-b.ga)-(a.gf-a.ga) || b.gf-a.gf || a.name.localeCompare(b.name));
}
// relegRefresh — с защитой от «призраков» прошлых стыков (relegPrevReady объявлен наверху секции)
function relegRefresh(){
  const wrap = document.getElementById('relegWrap');
  if(!wrap) return;
  const out = document.getElementById('relegOut');
  const btn = document.getElementById('relegBtn');
  const ready = relegReady();
  // сезоны завершены заново — результаты прошлых стыков больше не актуальны
  if(ready && !relegPrevReady && out) out.innerHTML = '';
  relegPrevReady = ready;
  // блок виден, когда пора играть стыки ИЛИ когда на экране их свежие результаты
  wrap.style.display = (ready || (out && out.innerHTML.trim() !== '')) ? 'block' : 'none';
  btn.disabled = !ready;
}

function relegRun(){
  if (!relegReady()) return;
  const rpl = relegSorted('rpl'), fnl = relegSorted('fnl');
  if (rpl.length < 16 || fnl.length < 2){
    $('#relegOut').innerHTML = '<p class="note" style="color:#d7141a">Стыки не проведены: для них нужно минимум 16 команд РПЛ и 2 команды ФНЛ.</p>';
    return;
  }
  const m1 = relegBuildMatch(rpl[14].name, fnl[1].name);
  const m2 = relegBuildMatch(rpl[15].name, fnl[0].name);

  const tag = (arr, i) => `${arr[i].name} (${arr[i].pts} очк.)`;
  const head = `<div class="info">
      Пары: <b>15-е место РПЛ — ${esc(tag(rpl,14))}</b> против <b>2-е место ФНЛ — ${esc(tag(fnl,1))}</b> ·
      <b>16-е место РПЛ — ${esc(tag(rpl,15))}</b> против <b>1-е место ФНЛ — ${esc(tag(fnl,0))}</b>
    </div>`;

  const card = m => {
    const winName = m.rplWin ? m.rplName : m.fnlName;
    const loseName = m.rplWin ? m.fnlName : m.rplName;
    const winText = m.rplWin ? 'остаётся в РПЛ' : 'выходит в РПЛ';
    return `<div class="sim-match" style="margin-top:10px">
      <div class="sm-head"><span>${crestImg(DB.teams.find(t=>t.name===m.rplName), 20)}${esc(m.rplName)} — ${esc(m.fnlName)}${crestImg(DB.teams.find(t=>t.name===m.fnlName), 20)}</span>
      <span>${m.pen ? 'Пенальти' : (m.et ? 'Доп. время' : '90 минут')}</span></div>
      <div class="sm-score">${m.gh}:${m.ga}${m.pen ? ` <span style="font-size:14px">(${m.pen[0]}:${m.pen[1]})</span>` : ''}</div>
      <div class="sm-log">${m.log.map(esc).join('<br>') || '&nbsp;'}</div>
      <div class="info" style="margin-top:8px">✅ <b>${esc(winName)}</b> — ${winText}. ⬇ <b>${esc(loseName)}</b> отправляется в ФНЛ.</div>
    </div>`;
  };

  $('#relegOut').innerHTML = head + card(m1) + card(m2);

  // применяем переходы: победитель получает РПЛ, побеждённый — ФНЛ
    decayAdapt();   // завершившийся сезон сгорает у старожилов — до расстановки адаптаций новичков
  [m1, m2].forEach(m => {
    const win  = DB.teams.find(t => t.name === (m.rplWin ? m.rplName : m.fnlName));
    const lose = DB.teams.find(t => t.name === (m.rplWin ? m.fnlName : m.rplName));
    const winWasFnl  = win.div === 'fnl';
    const loseWasRpl = lose.div === 'rpl';
    win.div = 'rpl'; lose.div = 'fnl';
    if(winWasFnl)  { win.adapt = 3; applyLeagueShift(win, 'up'); }   // новичок РПЛ
    if(loseWasRpl) { applyLeagueShift(lose, 'down'); }               // вылетевший из РПЛ
  });
  DB.probs = null; saveDB();

  // оба дивизиона стартуют новый сезон с новым составом участников
  SIMS.rpl = simNewState(); SIMS.fnl = simNewState();
  S = SIMS[simDiv];
  refreshAll();
  simNewRound();
}
$('#relegBtn').onclick = relegRun;

/* ================== ВАЛИДАЦИЯ И КАЛИБРОВКА (переключатели/история) ================== */
function toggleView(){
  if($('#useDyn')) $('#useDyn').checked = !!USE_DYNAMIC;
  if($('#useSquad')) $('#useSquad').checked = !!USE_SQUAD;
}
function fillVSel(){
  if(!$('#vHome')) return;
  fillSelect($('#vHome'));
  fillSelect($('#vAway'));
}
function renderMetrics(){
  const el = $('#vMetrics'); if(!el || typeof validationMetrics !== 'function') return;
  const m = validationMetrics();
  let html = `<p class="note">Матчей в базе: <b>${m.n}</b>${m.skipped ? ` · пропущено: ${m.skipped}` : ''}</p>`;
  if(m.n){
    html += `<div class="metric-grid">
      <div class="metric"><div class="m-label">Точность исходов</div><div class="m-value">${(m.acc*100).toFixed(1)}%</div></div>
      <div class="metric"><div class="m-label">Log-loss</div><div class="m-value">${m.logLoss.toFixed(3)}</div></div>
      <div class="metric"><div class="m-label">Brier</div><div class="m-value">${m.brier.toFixed(3)}</div></div>
      <div class="metric"><div class="m-label">Совпадений (диагональ)</div><div class="m-value">${m.conf[0][0]+m.conf[1][1]+m.conf[2][2]} / ${m.n}</div></div>
    </div>`;
    html += `<h3 style="margin-top:16px">Матрица прогноз × факт</h3>
      <table>
        <tr><th class="l">Прогноз \\ Факт</th><th>Победа хозяев</th><th>Ничья</th><th>Победа гостей</th></tr>
        <tr><td class="l"><b>Победа хозяев</b></td><td>${m.conf[0][0]}</td><td>${m.conf[0][1]}</td><td>${m.conf[0][2]}</td></tr>
        <tr><td class="l"><b>Ничья</b></td><td>${m.conf[1][0]}</td><td>${m.conf[1][1]}</td><td>${m.conf[1][2]}</td></tr>
        <tr><td class="l"><b>Победа гостей</b></td><td>${m.conf[2][0]}</td><td>${m.conf[2][1]}</td><td>${m.conf[2][2]}</td></tr>
      </table>`;
    if(m.rounds && m.rounds.length){
      html += `<h3 style="margin-top:16px">Точность по турам</h3>
        <table>
          <tr><th>Тур</th><th>Матчей</th><th>Точность</th><th>Log-loss</th></tr>` +
        m.rounds.map(r=>`<tr><td>${r.round}</td><td>${r.n}</td><td>${(r.acc*100).toFixed(0)}%</td><td>${r.logLoss.toFixed(2)}</td></tr>`).join('') +
        `</table>`;
    }
    if(m.reliability && m.reliability.length){
      html += `<h3 style="margin-top:16px">Калибровка: прогноз против факта</h3>
        <p class="note">Столбцы — интервалы прогнозной вероятности. Заливка — фактическая частота, жёлтая линия — средний прогноз. Чем ближе линия к верху заливки, тем лучше калибровка.</p>
        <div class="rel-chart">` +
        m.reliability.map(b=>{
          const pred = Math.round(b.pred*100), fact = Math.round(b.fact*100);
          return `<div class="rel-col" title="Прогноз ${pred}%, факт ${fact}%, матчей: ${b.n}">
            <div class="rel-bar"><div class="rel-fact" style="height:${fact}%"></div><div class="rel-pred" style="bottom:${pred}%"></div></div>
            <div class="rel-x">${Math.round(b.lo*100)}–${Math.round(b.hi*100)}%</div>
            <div class="rel-n">n=${b.n}</div>
          </div>`;
        }).join('') + `</div>`;
    }
  }
  el.innerHTML = html;
  renderModelCompare();
}

/* ---------- СРАВНЕНИЕ МОДЕЛЕЙ И ГРАФИКИ ---------- */
// метрики с временно включёнными функциями модели (флаги восстанавливаются)
function metricsWith(dyn, squad){
  const d = USE_DYNAMIC, s = USE_SQUAD;
  USE_DYNAMIC = !!dyn; USE_SQUAD = !!squad;
  const m = validationMetrics();
  USE_DYNAMIC = d; USE_SQUAD = s;
  return m;
}

function svgRoundAccuracy(rounds){
  if(!rounds || rounds.length < 2) return '<p class="note">Нужно минимум два тура с результатами.</p>';
  const W=560, H=200, L=38, R=12, T=14, B=26;
  const X = i => L + i*(W-L-R)/(rounds.length-1);
  const Y = v => T + (1-v)*(H-T-B);
  const avg = rounds.reduce((s,r)=>s+r.acc,0)/rounds.length;
  const grid = [0,0.25,0.5,0.75,1].map(v =>
    `<line x1="${L}" y1="${Y(v).toFixed(1)}" x2="${W-R}" y2="${Y(v).toFixed(1)}" stroke="currentColor" stroke-opacity=".12"/>` +
    `<text x="${L-6}" y="${(Y(v)+4).toFixed(1)}" text-anchor="end" font-size="10" fill="currentColor" fill-opacity=".6">${Math.round(v*100)}%</text>`).join('');
  const pts = rounds.map((r,i)=>`${X(i).toFixed(1)},${Y(r.acc).toFixed(1)}`).join(' ');
  const dots = rounds.map((r,i)=>`<circle cx="${X(i).toFixed(1)}" cy="${Y(r.acc).toFixed(1)}" r="3" fill="#2a7de0"><title>Тур ${r.round}: ${(r.acc*100).toFixed(0)}%, матчей ${r.n}</title></circle>`).join('');
  const step = Math.max(1, Math.ceil(rounds.length/6));
  const labels = rounds.map((r,i)=> (i===0 || i===rounds.length-1 || i%step===0)
    ? `<text x="${X(i).toFixed(1)}" y="${H-8}" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity=".6">${r.round}</text>` : '').join('');
  return `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="Точность по турам">${grid}` +
    `<line x1="${L}" y1="${Y(avg).toFixed(1)}" x2="${W-R}" y2="${Y(avg).toFixed(1)}" stroke="#18a85e" stroke-width="1.5" stroke-dasharray="5 4"/>` +
    `<polyline points="${pts}" fill="none" stroke="#2a7de0" stroke-width="2"/>${dots}${labels}</svg>` +
    `<p class="note">Средняя точность ${(avg*100).toFixed(1)}%, туры ${rounds[0].round}–${rounds[rounds.length-1].round}. Пунктир — среднее по всем турам.</p>`;
}

function svgReliability(rel){
  if(!rel || rel.length < 2) return '<p class="note">Мало данных для графика калибровки.</p>';
  const bins = rel.slice().sort((a,b) => a.lo - b.lo);
  const W = 560, rowH = 26, L = 68, R = 78, T = 42, B = 22;
  const H = T + bins.length * rowH + B;
  const X = v => L + v * (W - L - R);
  const grid = [0,0.25,0.5,0.75,1].map(v =>
    `<line x1="${X(v).toFixed(1)}" y1="${T-6}" x2="${X(v).toFixed(1)}" y2="${H-B+4}" stroke="currentColor" stroke-opacity=".07"/>` +
    `<text x="${X(v).toFixed(1)}" y="${H-8}" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity=".6">${Math.round(v*100)}%</text>`).join('');
  const rows = bins.map((b,i) => {
    const y = T + i * rowH + rowH / 2;
    const gap = (b.fact - b.pred) * 100;
    const col = Math.abs(gap) > 10 ? '#d7141a' : '#16a34a';
    const sign = gap > 0 ? '+' : '';
    return `<g><title>Прогноз ${Math.round(b.pred*100)}%, факт ${Math.round(b.fact*100)}%, матчей ${b.n}</title>` +
      `<text x="${L-10}" y="${(y+4).toFixed(1)}" text-anchor="end" font-size="10" fill="currentColor" fill-opacity=".65">${Math.round(b.lo*100)}–${Math.round(b.hi*100)}%</text>` +
      `<line x1="${L}" y1="${y.toFixed(1)}" x2="${W-R}" y2="${y.toFixed(1)}" stroke="currentColor" stroke-opacity=".1"/>` +
      `<line x1="${X(b.pred).toFixed(1)}" y1="${y.toFixed(1)}" x2="${X(b.fact).toFixed(1)}" y2="${y.toFixed(1)}" stroke="${col}" stroke-width="2" stroke-opacity=".45"/>` +
      `<circle cx="${X(b.pred).toFixed(1)}" cy="${y.toFixed(1)}" r="4" fill="#e8a400"/>` +
      `<circle cx="${X(b.fact).toFixed(1)}" cy="${y.toFixed(1)}" r="4" fill="#16a34a"/>` +
      `<text x="${W-R+10}" y="${(y+4).toFixed(1)}" font-size="10" fill="${col}" fill-opacity=".9">${sign}${Math.round(gap)} пп</text>` +
      `</g>`;
  }).join('');
  const legend = `<g font-size="10" fill="currentColor" fill-opacity=".7">` +
    `<circle cx="${L+4}" cy="14" r="4" fill="#e8a400"/><text x="${L+12}" y="17">прогноз</text>` +
    `<circle cx="${L+74}" cy="14" r="4" fill="#16a34a"/><text x="${L+82}" y="17">факт</text>` +
    `<text x="${W-R+10}" y="17">Δ, п.п.</text></g>`;
  return `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="Калибровка вероятностей">${legend}${grid}${rows}</svg>` +
    `<p class="note">Каждая строка — интервал прогнозной вероятности: жёлтая точка — средний прогноз, зелёная — фактическая частота. Красная связка — расхождение больше 10 п.п.</p>`;
}

function renderCharts(m){
  const el = $('#charts'); if(!el) return;
  if(!m || !m.n){ el.innerHTML = '<p class="note">Добавьте матчи в историю — графики появятся.</p>'; return; }
  el.innerHTML = '<h3>Точность исхода по турам</h3>' + svgRoundAccuracy(m.rounds) +
    '<h3 style="margin-top:20px">Калибровка вероятностей</h3>' + svgReliability(m.reliability);
}

function renderModelCompare(){
  const el = $('#modelCompare');
  if(!el || typeof validationMetrics !== 'function') return;
  const variants = [
    ['Базовая', metricsWith(false,false)],
    ['+ динамический xG', metricsWith(true,false)],
    ['+ сила состава', metricsWith(false,true)],
    ['+ динамика и состав', metricsWith(true,true)]
  ];
  const base = variants[0][1];
  if(!base || !base.n){ el.innerHTML = '<p class="note">Нужны матчи с известными результатами.</p>'; renderCharts(base); return; }
  let best = variants[0];
  variants.forEach(v => { if(v[1].n && v[1].logLoss < best[1].logLoss) best = v; });
  el.innerHTML = '<table>' +
    '<tr><th class="l">Модель</th><th>Матчей</th><th>Точность</th><th>Log-loss</th><th>Brier</th></tr>' +
    variants.map(([name,m]) => `<tr><td class="l">${name}${m === best[1] ? ' ★' : ''}</td><td>${m.n || 0}</td>` +
      `<td>${m.n ? (m.acc*100).toFixed(1)+'%' : '—'}</td><td>${m.n ? m.logLoss.toFixed(3) : '—'}</td><td>${m.n ? m.brier.toFixed(3) : '—'}</td></tr>`).join('') +
    '</table><p class="note">★ — лучший log-loss на вашей истории матчей. Все варианты считаются по одной и той же базе.</p>';
  renderCharts(base);
}
function renderCalibNow(){
  const el = $('#vCalibNow'); if(!el) return;
  const s = d => (DB.league && DB.league[d]) || DB.settings || {};
  const f = x => Number.isFinite(x) ? x.toFixed(2) : '—';
  const line = (title, d) => {
    const v = s(d);
    return `${title}: дом ×${f(v.homeBoost)}, гость ×${f(v.awayPenalty)}, ρ=${f(v.dixonColes)}`;
  };
  el.innerHTML = `<p class="note">Текущие параметры — ${line('РПЛ','rpl')}; ${line('ФНЛ','fnl')}.</p>`;
}
function renderPredictions(){
  const el = $('#vPreds'); if(!el) return;
  if(typeof PREDICTIONS === 'undefined' || !PREDICTIONS.length){
    el.innerHTML = '<p class="note">Прогнозов пока нет. Сохраните прогноз в калькуляторе.</p>';
    return;
  }
  const ev = evaluatePredictions();
  const names = ['П1','X','П2'];
  let html = `<p class="note">Всего прогнозов: <b>${ev.rows.length}</b> · сверено: <b>${ev.n}</b> · ждут результата: <b>${ev.pending}</b>` +
    (ev.n ? ` · точность: <b>${(ev.acc*100).toFixed(1)}%</b> · Brier: <b>${ev.brier.toFixed(3)}</b> · log-loss: <b>${ev.logLoss.toFixed(3)}</b>` : '') + '</p>';
  html += '<table><tr><th class="l">Матч</th><th>Прогноз</th><th>Факт</th><th>Итог</th><th>Brier</th></tr>';
  html += ev.rows.slice().reverse().map(r => {
    const pr = `${names[r.pred]} (${Math.round(r.probs[r.pred]*100)}%)`;
    const fact = r.fact === null ? '—' : `${names[r.fact]} ${r.gh}:${r.ga}`;
    const res = r.fact === null ? 'ждём' : (r.hit ? '✅' : '❌');
    const br = r.brier === null ? '—' : r.brier.toFixed(2);
    return `<tr><td class="l">${esc(r.home)} — ${esc(r.away)}</td><td>${pr}</td><td>${fact}</td><td>${res}</td><td>${br}</td></tr>`;
  }).join('');
  html += '</table>';
  el.innerHTML = html;
}
function fillAdminSelects(){
  if(!$('#aHome')) return;
  fillSelect($('#aHome'));
  fillSelect($('#aAway'));
}
function adminStatus(text, ok){
  const el = $('#adminStatus'); if(!el) return;
  el.innerHTML = `<p class="note"${ok ? ' style="color:var(--green)"' : ''}>${text}</p>`;
}
async function renderAdmin(){
  if(!$('#adminStatus')) return;
  const configured = remoteConfigured();
  const email = remoteUserEmail();
  const isAdmin = !!(email && AUTH_IS_ADMIN);
  const loginCard = $('#adminLoginCard'), addCard = $('#adminAddCard'), bulkCard = $('#adminBulkCard');
  if(loginCard) loginCard.style.display = configured ? '' : 'none';
  if(addCard) addCard.style.display = (configured && isAdmin) ? '' : 'none';
  if(bulkCard) bulkCard.style.display = (configured && isAdmin) ? '' : 'none';
  if(!configured){
    adminStatus('Бэкенд не настроен: заполните SUPABASE_URL и SUPABASE_ANON_KEY в config.js. Пока работает локальный режим (localStorage).');
  } else if(!email){
    adminStatus('Бэкенд подключён. Войдите через меню аккаунта, чтобы управлять общей базой.');
  } else if(!isAdmin){
    adminStatus('Вы вошли как ' + esc(email) + ', но права администратора не выданы. Добавьте email в таблицу admins.', false);
  } else {
    adminStatus('Вы вошли как ' + esc(email) + ' (администратор).', true);
  }
  const list = $('#adminList');
  if(!list) return;
  if(!configured){ list.innerHTML = '<p class="note">Облачные матчи недоступны.</p>'; return; }
  list.innerHTML = '<p class="note">Загрузка…</p>';
  try{
    const rows = await remoteLoadMatches();
    if(!rows.length){ list.innerHTML = '<p class="note">В облаке пока нет матчей.</p>'; return; }
    list.innerHTML = '<table><tr><th>ID</th><th class="l">Матч</th><th>Счёт</th><th>Тур</th><th></th></tr>' +
      rows.map(r => `<tr><td>${r.id}</td><td class="l">${esc(r.home)} — ${esc(r.away)}</td><td>${r.gh}:${r.ga}</td><td>${r.round}</td><td>${isAdmin ? `<button class="btn danger" data-del="${r.id}">Удалить</button>` : ''}</td></tr>`).join('') +
      '</table>';
    list.querySelectorAll('[data-del]').forEach(btn => {
      btn.onclick = async () => {
        if(!confirm('Удалить матч из общей базы?')) return;
        try{
          await remoteDeleteMatch(btn.dataset.del);
          await remoteMergeMatches();
          renderMetrics(); renderHistory(); renderPredictions();
          await renderAdmin();
        }catch(e){ alert(String(e.message || e)); }
      };
    });
  }catch(e){
    list.innerHTML = '<p class="note">Не удалось загрузить: ' + esc(String(e.message || e)) + '</p>';
  }
}
function bindAdmin(){
  if($('#adminOpenAuth')) $('#adminOpenAuth').onclick = () => openAuth('login');
  if($('#adminLogout')) $('#adminLogout').onclick = async () => {
    await remoteSignOut();
    AUTH_IS_ADMIN = false;
    renderAccount();
    await renderAdmin();
  };
  if($('#adminAdd')) $('#adminAdd').onclick = async () => {
    const h = +$('#aHome').value, a = +$('#aAway').value;
    const gh = +$('#aGh').value, ga = +$('#aGa').value, r = +$('#aRound').value;
    if(h === a) return alert('Команды должны различаться');
    if(!(Number.isInteger(gh) && gh >= 0 && gh <= 20 && Number.isInteger(ga) && ga >= 0 && ga <= 20)) return alert('Голы — целые числа от 0 до 20');
    if(!(Number.isInteger(r) && r >= 1)) return alert('Тур — целое число от 1');
    try{
      await remoteAddMatch({ home: DB.teams[h].name, away: DB.teams[a].name, gh, ga, round: r });
      await remoteMergeMatches();
      renderMetrics(); renderHistory(); renderPredictions();
      await renderAdmin();
    }catch(e){ alert('Не добавлено: ' + (e.message || e)); }
  };
  if($('#adminRefresh')) $('#adminRefresh').onclick = async () => {
    await remoteMergeMatches();
    renderMetrics(); renderHistory(); renderPredictions();
    await renderAdmin();
  };
  if($('#adminBulkAdd')) $('#adminBulkAdd').onclick = async () => {
    const out = $('#adminBulkOut');
    const raw = ($('#aBulk').value || '').trim();
    if(!raw){ if(out) out.textContent = 'Вставьте строки для импорта.'; return; }
    const names = new Set(DB.teams.map(t => t.name));
    const rows = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const items = [], bad = [], unknown = new Set();
    rows.forEach(line => {
      const p = line.split(/[;\t,]+/).map(s => s.trim());
      if(p.length < 5){ bad.push(line); return; }
      const h = p[0], a = p[1], gh = Number(p[2]), ga = Number(p[3]), r = Number(p[4]);
      if(!names.has(h)) unknown.add(h);
      if(!names.has(a)) unknown.add(a);
      if(!(Number.isInteger(gh) && gh >= 0 && gh <= 20 && Number.isInteger(ga) && ga >= 0 && ga <= 20 && Number.isInteger(r) && r >= 1)){ bad.push(line); return; }
      if(h === a){ bad.push(line); return; }
      items.push({ home: h, away: a, gh, ga, round: r });
    });
    if(out) out.textContent = 'Проверяю базу…';
    try{
      const existing = await remoteLoadMatches();
      const seen = new Set(existing.map(m => m.home + '|' + m.away + '|' + m.round));
      const fresh = [];
      let skipped = 0;
      items.forEach(m => {
        const k = m.home + '|' + m.away + '|' + m.round;
        if(seen.has(k)){ skipped++; return; }
        seen.add(k);
        fresh.push(m);
      });
      if(fresh.length) await remoteAddMatches(fresh);
      await remoteMergeMatches();
      renderMetrics(); renderHistory(); renderPredictions();
      await renderAdmin();
      if(out){
        out.textContent = 'Добавлено: ' + fresh.length + '. Пропущено дублей: ' + skipped + '. Ошибочных строк: ' + bad.length +
          (unknown.size ? '. Неизвестные команды: ' + [...unknown].join(', ') : '');
      }
      if(fresh.length) $('#aBulk').value = '';
    }catch(e){
      if(out) out.textContent = 'Ошибка импорта: ' + (e.message || e);
    }
  };
  const adminNav = document.querySelector('#drawerMenu button[data-tab="tab-admin"]');
  if(adminNav) adminNav.addEventListener('click', () => { renderAdmin(); });
}
function renderHistory(){
  const el = $('#vList');
  if(!el){ renderRound(); return; }
  if(typeof HISTORY === 'undefined' || !HISTORY.length){
    el.innerHTML = '<p class="note">Пока нет внесённых матчей.</p>';
    renderRound();
    return;
  }
  const shared = HISTORY.filter(m=>m && m.shared).length;
  const local = HISTORY.length - shared;
  const head = '<tr><th>#</th><th class="l">Дома</th><th class="l">Гости</th><th>Счёт</th><th>Тур</th><th>Источник</th></tr>';
  const rows = HISTORY.slice().reverse().map((m,i)=>{
    const badge = m && m.shared
      ? '<span class="src-badge src-shared">общий</span>'
      : '<span class="src-badge src-local">мой</span>';
    return `<tr><td>${HISTORY.length-i}</td><td class="l">${esc(m.home)}</td><td class="l">${esc(m.away)}</td><td>${m.gh}:${m.ga}</td><td>${m.round ?? '-'}</td><td>${badge}</td></tr>`;
  }).join('');
  el.innerHTML = `<p class="note">Всего матчей: <b>${HISTORY.length}</b> · общих: <b>${shared}</b> · моих: <b>${local}</b></p><table>${head}${rows}</table>`;
  renderRound();
}

/* ================== ТУРЫ ================== */
let roundDiv = 'rpl';
let roundNum = null;
let FIXTURES = [];
let FIXTURES_AT = null;
let FIXTURES_OFF = false;
let roundTouched = false;

async function loadFixtures(){
  if(FIXTURES_OFF) return FIXTURES;
  if(typeof remoteLoadFixtures !== 'function') return FIXTURES;
  if(typeof remoteConfigured === 'function' && !remoteConfigured()) return FIXTURES;
  try{
    const rows = await remoteLoadFixtures();
    if(rows === null){
      FIXTURES_OFF = true;
      FIXTURES = [];
      FIXTURES_AT = null;
      return FIXTURES;
    }
    FIXTURES = rows;
    FIXTURES_AT = rows.length ? new Date() : null;
  }catch(e){
    // сеть подвела — оставляем прошлые данные и повторим позже
  }
  return FIXTURES;
}

function roundTeamIdx(name){ return DB.teams.findIndex(t => t.name === name); }

function roundSet(div){
  const idx = new Set(idxOf(div));
  const rounds = new Set();
  HISTORY.forEach(m => {
    const hi = roundTeamIdx(m.home), ai = roundTeamIdx(m.away);
    if(hi < 0 || ai < 0 || !idx.has(hi) || !idx.has(ai)) return;
    if(Number.isFinite(+m.round)) rounds.add(+m.round);
  });
  (typeof FIXTURES !== 'undefined' && FIXTURES ? FIXTURES : []).forEach(f => {
    if(f && f.league_code === div && Number.isFinite(+f.round)) rounds.add(+f.round);
  });
  return [...rounds].sort((a,b) => a - b);
}

function likelyScore(lh, la){
  const ph = poissonArr(lh), pa = poissonArr(la);
  let best = {gh:0, ga:0, p:0};
  for(let h = 0; h < ph.length; h++){
    for(let a = 0; a < pa.length; a++){
      const v = ph[h] * pa[a];
      if(v > best.p) best = {gh:h, ga:a, p:v};
    }
  }
  return best;
}

function renderRound(){
  const listEl = $('#roundList'); if(!listEl) return;
  const rounds = roundSet(roundDiv);
  const sel = $('#roundSel');
  if(sel){
    sel.innerHTML = rounds.length ? rounds.map(r => `<option value="${r}">Тур ${r}</option>`).join('') : '<option>—</option>';
    sel.disabled = !rounds.length;
  }
  if(!rounds.length){
    roundNum = null;
    if($('#roundSummary')) $('#roundSummary').innerHTML = '<span>В истории пока нет матчей этой лиги.</span>';
    listEl.innerHTML = '';
    if($('#roundPrev')) $('#roundPrev').disabled = true;
    if($('#roundNext')) $('#roundNext').disabled = true;
    return;
  }
  if(roundNum === null || !rounds.includes(roundNum) ||
     (!roundTouched && typeof FIXTURES !== 'undefined' && FIXTURES && FIXTURES.length)){
    const fxRounds = (typeof FIXTURES !== 'undefined' && FIXTURES ? FIXTURES : [])
      .filter(f => f && f.league_code === roundDiv && rounds.includes(+f.round))
      .map(f => +f.round);
    roundNum = fxRounds.length ? Math.max(...fxRounds) : rounds[rounds.length - 1];
  }
  if(sel) sel.value = String(roundNum);

  const idx = new Set(idxOf(roundDiv));
  const matches = HISTORY.filter(m => {
    const hi = roundTeamIdx(m.home), ai = roundTeamIdx(m.away);
    return hi >= 0 && ai >= 0 && idx.has(hi) && idx.has(ai) && +m.round === roundNum;
  });

  const fxKey = (a, b) => `${String(a).toLowerCase()}|${String(b).toLowerCase()}`;
  const knownKeys = new Set(matches.map(m => fxKey(m.home, m.away)));
  const extra = (FIXTURES || []).filter(f =>
    f.league_code === roundDiv && +f.round === roundNum && f.status !== 'finished' &&
    !knownKeys.has(fxKey(f.home, f.away)) &&
    roundTeamIdx(f.home) >= 0 && roundTeamIdx(f.away) >= 0);

  const extraCards = extra.map(f => {
    const hi = roundTeamIdx(f.home), ai = roundTeamIdx(f.away);
    const H = DB.teams[hi], A = DB.teams[ai];
    const live = f.status === 'live';
    const time = f.kickoff_at
      ? new Date(f.kickoff_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
      : '';
    const score = (live && f.gh !== null && f.gh !== undefined) ? `${f.gh}:${f.ga}` : '—';
    const {lh, la} = lambdas(hi, ai);
    const p = matchProbs(lh, la);
    const exp = likelyScore(lh, la);
    return `<div class="rm-card" role="button" tabindex="0" data-home="${hi}" data-away="${ai}" data-round="${roundNum}" title="Открыть в калькуляторе">
      <div class="rm-top">
        <span class="rm-side">${crestImg(H,18)}<b>${esc(f.home)}</b></span>
        <span class="rm-score">${score}</span>
        <span class="rm-side away"><b>${esc(f.away)}</b>${crestImg(A,18)}</span>
      </div>
      <div class="rm-mid">
        <div class="rm-bar">
          <span style="width:${(p.pw*100).toFixed(1)}%;background:${esc(H.color||'#d7141a')}"></span>
          <span style="width:${(p.pd*100).toFixed(1)}%;background:#9aa5b4"></span>
          <span style="width:${(p.pl*100).toFixed(1)}%;background:${esc(A.color||'#0b1f3a')}"></span>
        </div>
        <span class="rm-exp">ожид. ${exp.gh}:${exp.ga}</span>
        <span class="rm-probs">${(p.pw*100).toFixed(0)} · ${(p.pd*100).toFixed(0)} · ${(p.pl*100).toFixed(0)}</span>
        <span class="rm-res ${live ? 'live' : 'soon'}">${live ? 'идёт' : time}</span>
      </div>
    </div>`;
  }).join('');

  let hits = 0, exact = 0;
  const cards = matches.map(m => {
    const hi = roundTeamIdx(m.home), ai = roundTeamIdx(m.away);
    const H = DB.teams[hi], A = DB.teams[ai];
    const {lh, la} = lambdas(hi, ai);
    const p = matchProbs(lh, la);
    const probs = [p.pw, p.pd, p.pl];
    const pred = probs.indexOf(Math.max(...probs));
    const fact = m.gh > m.ga ? 0 : (m.gh < m.ga ? 2 : 1);
    const hit = pred === fact;
    if(hit) hits++;
    const exp = likelyScore(lh, la);
    const exactHit = exp.gh === m.gh && exp.ga === m.ga;
    if(exactHit) exact++;
    const expPct = (exp.p * 100).toFixed(0);
    return `<div class="rm-card" role="button" tabindex="0" data-home="${hi}" data-away="${ai}" data-round="${roundNum}" title="Открыть в калькуляторе">
      <div class="rm-top">
        <span class="rm-side">${crestImg(H,18)}<b>${esc(m.home)}</b></span>
        <span class="rm-score">${m.gh}:${m.ga}</span>
        <span class="rm-side away"><b>${esc(m.away)}</b>${crestImg(A,18)}</span>
      </div>
      <div class="rm-mid">
        <div class="rm-bar">
          <span style="width:${(probs[0]*100).toFixed(1)}%;background:${esc(H.color||'#d7141a')}"></span>
          <span style="width:${(probs[1]*100).toFixed(1)}%;background:#9aa5b4"></span>
          <span style="width:${(probs[2]*100).toFixed(1)}%;background:${esc(A.color||'#0b1f3a')}"></span>
        </div>
        <span class="rm-exp${exactHit ? ' exact' : ''}" title="Модель: ${expPct}% на этот счёт">ожид. ${exp.gh}:${exp.ga}</span>
        <span class="rm-probs">${(probs[0]*100).toFixed(0)} · ${(probs[1]*100).toFixed(0)} · ${(probs[2]*100).toFixed(0)}</span>
        <span class="rm-res ${hit ? 'ok' : 'bad'}">${hit ? '✓' : '✗'}</span>
      </div>
    </div>`;
  }).join('');

  const acc = matches.length ? Math.round(hits / matches.length * 100) : 0;
  const stamp = FIXTURES_AT
    ? `<span class="round-live">онлайн · задержка до 10 мин · обновлено ${FIXTURES_AT.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</span>`
    : '';
  if($('#roundSummary')) $('#roundSummary').innerHTML =
    `<span>Тур <b>${roundNum}</b></span><span>Матчей <b>${matches.length}</b></span>` +
    `<span>Исход угадан <b>${hits}</b> (${acc}%)</span>` +
    `<span>Счёт точно <b>${exact}</b></span>` + stamp;

  listEl.className = 'rm-grid';
  listEl.innerHTML = extraCards + cards;
  listEl.querySelectorAll('.rm-card').forEach(el => {
    el.addEventListener('click', () => openMatchCard(el));
    el.addEventListener('keydown', e => {
      if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); openMatchCard(el); }
    });
  });

  const i = rounds.indexOf(roundNum);
  if($('#roundPrev')) $('#roundPrev').disabled = i <= 0;
  if($('#roundNext')) $('#roundNext').disabled = i >= rounds.length - 1;
}

function openMatchCard(el){
  const hi = +el.dataset.home, ai = +el.dataset.away, rnd = +el.dataset.round;
  const m = HISTORY.find(x => +x.round === rnd &&
    roundTeamIdx(x.home) === hi && roundTeamIdx(x.away) === ai);
  activateTab('tab-calc');
  if($('#calcHome')) $('#calcHome').value = String(hi);
  if($('#calcAway')) $('#calcAway').value = String(ai);
  if($('#ovH')) $('#ovH').value = '';
  if($('#ovA')) $('#ovA').value = '';
  calcRun();
  if(typeof syncH2HFromCalc === 'function'){ syncH2HFromCalc(); renderH2H(); }
  renderMatchInfo(m, hi, ai);
  window.scrollTo({top:0, behavior:'smooth'});
}

function renderMatchInfo(m, hi, ai){
  const box = $('#calcMatch'); if(!box) return;
  if(!m){ box.style.display = 'none'; box.innerHTML = ''; return; }
  const H = DB.teams[hi], A = DB.teams[ai];
  const {lh, la} = lambdas(hi, ai);
  const p = matchProbs(lh, la);
  const probs = [p.pw, p.pd, p.pl];
  const pred = probs.indexOf(Math.max(...probs));
  const fact = m.gh > m.ga ? 0 : (m.gh < m.ga ? 2 : 1);
  const hit = pred === fact;
  const exp = likelyScore(lh, la);
  const exact = exp.gh === m.gh && exp.ga === m.ga;
  box.style.display = '';
  box.innerHTML = `
    <h2>Прошедший матч · тур ${m.round}</h2>
    <div class="match-res">
      <span class="mr-team">${crestImg(H,28)}${esc(m.home)}</span>
      <span class="mr-score">${m.gh}:${m.ga}</span>
      <span class="mr-team">${esc(m.away)}${crestImg(A,28)}</span>
    </div>
    <div class="tiles">
      <div class="tile"><div class="t-label">Ожидаемый счёт</div><div class="t-value">${exp.gh}:${exp.ga} <small>${(exp.p*100).toFixed(0)}%</small></div></div>
      <div class="tile"><div class="t-label">Исход по модели</div><div class="t-value">${['П1','Х','П2'][pred]} <small>${(probs[pred]*100).toFixed(0)}%</small></div></div>
      <div class="tile"><div class="t-label">Счёт угадан</div><div class="t-value ${exact ? 'ok' : 'no'}">${exact ? 'да' : 'нет'}</div></div>
      <div class="tile"><div class="t-label">Исход угадан</div><div class="t-value ${hit ? 'ok' : 'no'}">${hit ? 'да' : 'нет'}</div></div>
    </div>
    <p class="note">Это фактический результат матча; расчёт ниже — по текущим настройкам базы.</p>
    <button class="btn alt" id="backToRounds" type="button">← Ко всем турам</button>`;
  const back = $('#backToRounds');
  if(back) back.onclick = () => activateTab('tab-round');
}

function stepRound(dir){  const rounds = roundSet(roundDiv);
  const i = rounds.indexOf(roundNum);
  const next = rounds[Math.max(0, Math.min(rounds.length - 1, i + dir))];
  if(next !== undefined && next !== roundNum){ roundNum = next; renderRound(); }
}

if($('#roundLeague')){
  document.querySelectorAll('#roundLeague button').forEach(b => {
    b.addEventListener('click', () => {
      roundDiv = b.dataset.league;
      roundNum = null;
      roundTouched = false;
      document.querySelectorAll('#roundLeague button').forEach(x => x.classList.toggle('active', x === b));
      renderRound();
    });
  });
}
if($('#roundSel')) $('#roundSel').addEventListener('change', e => { roundNum = +e.target.value; roundTouched = true; renderRound(); });
if($('#roundPrev')) $('#roundPrev').addEventListener('click', () => stepRound(-1));
if($('#roundNext')) $('#roundNext').addEventListener('click', () => stepRound(1));
if($('#toRounds')) $('#toRounds').addEventListener('click', () => activateTab('tab-round'));

if(typeof remoteConfigured === 'function' && remoteConfigured()){
  loadFixtures().then(() => {
    if(document.querySelector('.tab.active')?.id === 'tab-round') renderRound();
  });
  setInterval(async () => {
    if(FIXTURES_OFF) return;
    if(document.querySelector('.tab.active')?.id !== 'tab-round') return;
    await loadFixtures();
    renderRound();
  }, 60000);
}
function bindValidation(){
  if($('#vAdd')) $('#vAdd').onclick = () => {
    const h = +$('#vHome').value, a = +$('#vAway').value;
    const ghRaw = $('#vGh').value.trim(), gaRaw = $('#vGa').value.trim(), rRaw = $('#vRound').value.trim();
    const gh = +ghRaw, ga = +gaRaw, r = +rRaw;
    if(!(DB.teams[h] && DB.teams[a])){ alert('Выберите команды из базы.'); return; }
    if(h === a){ alert('Домашняя и гостевая команды должны различаться.'); return; }
    if(!(ghRaw !== '' && Number.isInteger(gh) && gh >= 0 && gh <= 20)){ alert('Голы хозяев: целое число от 0 до 20.'); return; }
    if(!(gaRaw !== '' && Number.isInteger(ga) && ga >= 0 && ga <= 20)){ alert('Голы гостей: целое число от 0 до 20.'); return; }
    if(!(rRaw !== '' && Number.isInteger(r) && r >= 1)){ alert('Укажите тур — целое число от 1.'); return; }
    const res = addHistoryMatch(DB.teams[h].name, DB.teams[a].name, gh, ga, r);
    saveHistory(); renderMetrics(); renderHistory();
    if(res && res.ok === false) alert(res.msg || 'Матч не добавлен.');
  };
  if($('#vImport')) $('#vImport').onclick = () => {
    const csv = $('#vCsv'); csv.style.display = csv.style.display==='none' ? 'block' : 'none';
    csv.focus();
  };
  if($('#vCsv')) $('#vCsv').onchange = () => {
    const res = importHistoryCSV($('#vCsv').value);
    $('#vCsv').value=''; $('#vCsv').style.display='none';
    const parts = ['добавлено: ' + res.added];
    if(res.dupSkipped) parts.push('дублей пропущено: ' + res.dupSkipped);
    if(res.bad) parts.push('строк с ошибкой: ' + res.bad);
    alert('Импорт CSV — ' + parts.join(', ') + '. Всего матчей: ' + res.total + '.');
    renderMetrics(); renderHistory();
  };
  if($('#vClear')) $('#vClear').onclick = () => {
    if(confirm('Очистить всю историю матчей?')){ clearHistory(); saveHistory(); renderMetrics(); renderHistory(); }
  };
  if($('#vPredsClear')) $('#vPredsClear').onclick = () => {
    if(confirm('Очистить сохранённые прогнозы?')){ clearPredictions(); renderPredictions(); }
  };
  if($('#vCalibrate')) $('#vCalibrate').onclick = () => {
    const out = $('#vCalibOut');
    const res = calibrateParams();
    const line = (r, title) => {
      if(!r) return '';
      if(r.ok) return `<p class="note" style="color:var(--green)">✅ ${title}: дом ×${r.homeBoost.toFixed(2)}, гость ×${r.awayPenalty.toFixed(2)}, ρ=${r.dixonColes.toFixed(2)}. Матчей: ${r.used}. Правдоподобие: ${r.gainPct>=0?'+':''}${r.gainPct}%.</p>`;
      return `<p class="note">${title}: мало матчей (${r.used || 0} из 5).</p>`;
    };
    out.innerHTML = line(res.rpl, 'РПЛ') + line(res.fnl, 'ФНЛ');
    if(res.ok){ saveDB(); refreshAll(); }
  };
  if($('#useDyn')) $('#useDyn').onchange = e => { USE_DYNAMIC = e.target.checked; refreshAll(); };
  if($('#useSquad')) $('#useSquad').onchange = e => { USE_SQUAD = e.target.checked; refreshAll(); };
}
bindValidation(); fillVSel(); toggleView(); renderMetrics(); renderHistory(); bindAdmin(); fillAdminSelects();
renderAccount(); refreshAdminRole();

/* ================== СВОРАЧИВАНИЕ КАРТОЧЕК ================== */
const collapseAllBtn = document.getElementById('collapseAllBtn');
function allToggleCards(){
  return Array.from(document.querySelectorAll('.tab .card.has-toggle'));
}
function setCardCollapsed(card, collapsed){
  card.classList.toggle('collapsed', !!collapsed);
  const btn = card.querySelector(':scope > .card-toggle');
  if(btn){
    btn.textContent = collapsed ? '▸' : '▾';
    btn.setAttribute('aria-expanded', String(!collapsed));
  }
}
function updateCollapseAllLabel(){
  if(!collapseAllBtn) return;
  const cards = allToggleCards();
  const all = cards.length > 0 && cards.every(c => c.classList.contains('collapsed'));
  collapseAllBtn.textContent = all ? 'Развернуть всё' : 'Свернуть всё';
}
function initCollapsibles(){
  document.querySelectorAll('.tab .card').forEach(card => {
    if(card.classList.contains('has-toggle')) return;
    const head = card.querySelector(':scope > h2, :scope > h3');
    if(!head) return;
    card.classList.add('has-toggle');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'card-toggle';
    btn.textContent = '▾';
    btn.setAttribute('aria-expanded', 'true');
    btn.setAttribute('aria-label', 'Свернуть или развернуть блок');
    btn.onclick = e => {
      e.stopPropagation();
      const next = !card.classList.contains('collapsed');
      setCardCollapsed(card, next);
      updateCollapseAllLabel();
    };
    card.appendChild(btn);
  });
  updateCollapseAllLabel();
}
if(collapseAllBtn) collapseAllBtn.onclick = () => {
  const cards = allToggleCards();
  const all = cards.length > 0 && cards.every(c => c.classList.contains('collapsed'));
  cards.forEach(c => setCardCollapsed(c, !all));
  updateCollapseAllLabel();
};
initCollapsibles();

/* ================== ОБНОВЛЕНИЕ ВСЕГО ================== */
function refreshAll(){
  fillSelect($('#calcHome'), {def:0});
  fillSelect($('#calcAway'), {def:1});
  calcRun();
  renderBase();
  fillH2H();
  renderH2H();
  syncH2HFromCalc();
  computeProbs(); saveDB(); renderProbs();
fillVSel(); toggleView(); renderMetrics(); renderHistory(); renderCalibNow(); renderPredictions(); fillAdminSelects();
}
refreshAll();
showDbResetNotice();
remoteMergeMatches().then(r => {
  if(r && r.ok && r.added){
    renderMetrics(); renderHistory(); renderPredictions();
  }
  if(typeof renderAdmin === 'function') renderAdmin();
});
// Восстановленная сессия: локальные данные уже связаны с аккаунтом.
// Подтягиваем свежие личные данные из облака, чтобы изменения с другого
// устройства появились и здесь.
(function(){
  if(typeof remoteSignedIn === 'function' && remoteSignedIn() &&
     typeof linkAccountOnSignIn === 'function'){
    linkAccountOnSignIn().then(() => {
      if(typeof refreshAll === 'function') refreshAll();
    }).catch(()=>{});
  }
})();

/* ================== ТЕМА: светлая / тёмная ================== */
(function(){
  const THEME_KEY = 'rpl_theme';
  const root = document.documentElement;
  const btn = document.getElementById('themeToggle');
  const SUN_ICON = '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="3.2" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M8 1.2v2M8 12.8v2M1.2 8h2M12.8 8h2M3.2 3.2l1.4 1.4M11.4 11.4l1.4 1.4M12.8 3.2l-1.4 1.4M4.6 11.4l-1.4 1.4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>';
  const MOON_ICON = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M13 9.6A5.4 5.4 0 1 1 6.4 3a4.6 4.6 0 0 0 6.6 6.6z" fill="currentColor"/></svg>';
  function apply(t){
    root.setAttribute('data-theme', t);
    if(btn) btn.innerHTML = t === 'light' ? SUN_ICON : MOON_ICON;
  }
  apply(localStorage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark');
  if(btn) btn.onclick = () => {
    const next = root.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    localStorage.setItem(THEME_KEY, next);
    apply(next);
  };
})();
