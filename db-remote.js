/* ================== УДАЛЁННАЯ БАЗА (Supabase) ==================
   Чтение общих матчей — всем посетителям; добавление и удаление — только
   администратору, чей email внесён в public.admins (проверяется RLS).
   Без настроек в config.js работает локальный режим. */

const REMOTE = {
  url: (typeof SUPABASE_URL !== 'undefined' && SUPABASE_URL ? SUPABASE_URL : '').replace(/\/+$/, ''),
  key: (typeof SUPABASE_ANON_KEY !== 'undefined' ? SUPABASE_ANON_KEY : ''),
  session: null
};
const REMOTE_SESSION_KEY = 'rpl2627_supabase_session';

function remoteConfigured(){ return !!(REMOTE.url && REMOTE.key); }

function remoteRestoreSession(){
  try{
    const s = JSON.parse(localStorage.getItem(REMOTE_SESSION_KEY) || 'null');
    if(s && s.access_token) REMOTE.session = s;
  }catch(e){ /* игнорируем битую сессию */ }
}
function remoteSaveSession(s){
  REMOTE.session = s || null;
  if(s) localStorage.setItem(REMOTE_SESSION_KEY, JSON.stringify(s));
  else localStorage.removeItem(REMOTE_SESSION_KEY);
}
function remoteUserEmail(){
  return (REMOTE.session && REMOTE.session.user && REMOTE.session.user.email) || null;
}

// exp из JWT — на случай, если сервер не прислал expires_at
function remoteTokenExp(token){
  try{
    const p = JSON.parse(atob(String(token || '').split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return Number.isFinite(+p.exp) ? +p.exp : 0;
  }catch(e){ return 0; }
}
// токен пора обновлять (запас 30 секунд, чтобы не ловить 401 на границе)
function remoteAccessExpired(){
  const s = REMOTE.session;
  if(!s || !s.access_token) return true;
  const exp = Number.isFinite(+s.expires_at) && +s.expires_at ? +s.expires_at : remoteTokenExp(s.access_token);
  return !exp || (Date.now() / 1000) > exp - 30;
}
// access_token живёт час; без обновления по refresh_token все запросы получают 401
async function remoteRefreshSession(){
  const s = REMOTE.session;
  if(!remoteConfigured() || !s || !s.refresh_token) return false;
  try{
    const res = await fetch(REMOTE.url + '/auth/v1/token?grant_type=refresh_token', {
      method: 'POST',
      headers: { 'apikey': REMOTE.key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: s.refresh_token })
    });
    const data = await res.json().catch(() => ({}));
    if(!res.ok || !data.access_token) return false;
    const next = Object.assign({}, s, data);
    if(!next.user && s.user) next.user = s.user;
    remoteSaveSession(next);
    return true;
  }catch(e){
    return false;
  }
}
// сессия больше не годится: чистим её и возвращаем интерфейс в гостевой режим
function remoteDropSession(){
  remoteSaveSession(null);
  if(typeof unlinkAccount === 'function') unlinkAccount();
  if(typeof refreshAdminRole === 'function'){ try{ refreshAdminRole(); }catch(e){} }
  else if(typeof renderAccount === 'function'){ try{ renderAccount(); }catch(e){} }
}
// Авторизованный запрос: обновляет истёкший токен и один раз повторяет запрос при 401.
// build() возвращает параметры fetch, поэтому заголовки собираются заново — уже с новым токеном.
async function remoteAuthFetch(url, build){
  if(!REMOTE.session) return fetch(url, build());
  if(remoteAccessExpired()) await remoteRefreshSession();
  let res = await fetch(url, build());
  if(res.status === 401 && REMOTE.session && REMOTE.session.refresh_token){
    if(await remoteRefreshSession()) res = await fetch(url, build());
  }
  if(res.status === 401) remoteDropSession();
  return res;
}

function remoteHeaders(withAuth){
  const h = { 'apikey': REMOTE.key, 'Content-Type': 'application/json' };
  if(withAuth && REMOTE.session && REMOTE.session.access_token){
    h['Authorization'] = 'Bearer ' + REMOTE.session.access_token;
  }
  return h;
}

async function remoteSignIn(email, password){
  if(!remoteConfigured()) throw new Error('Бэкенд не настроен');
  const res = await fetch(REMOTE.url + '/auth/v1/token?grant_type=password', {
    method: 'POST',
    headers: { 'apikey': REMOTE.key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const data = await res.json().catch(() => ({}));
  if(!res.ok) throw new Error(data.error_description || data.msg || ('Не удалось войти (' + res.status + ')'));
  remoteSaveSession(data);
  return remoteUserEmail();
}

async function remoteSignUp(email, password){
  if(!remoteConfigured()) throw new Error('Бэкенд не настроен');
  const res = await fetch(REMOTE.url + '/auth/v1/signup', {
    method: 'POST',
    headers: { 'apikey': REMOTE.key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const data = await res.json().catch(() => ({}));
  if(!res.ok){
    const msg = data.msg || data.error_description || data.message || data.error || ('Регистрация не удалась (' + res.status + ')');
    throw new Error(msg);
  }
  if(data && data.access_token){
    remoteSaveSession(data);
    return { signedIn: true, email: remoteUserEmail() };
  }
  return { signedIn: false, email: email };
}

async function remoteSignOut(){
  remoteSaveSession(null);
}

async function remoteIsAdmin(){
  if(!remoteConfigured() || !REMOTE.session) return false;
  const email = remoteUserEmail();
  if(!email) return false;
  const res = await remoteAuthFetch(
    REMOTE.url + '/rest/v1/admins?select=email&email=eq.' + encodeURIComponent(email),
    () => ({ headers: remoteHeaders(true) })
  );
  if(!res.ok) return false;
  const rows = await res.json().catch(() => []);
  return Array.isArray(rows) && rows.length > 0;
}

async function remoteLoadMatches(){
  if(!remoteConfigured()) throw new Error('Бэкенд не настроен');
  const res = await fetch(
    REMOTE.url + '/rest/v1/matches?select=id,home,away,gh,ga,round&order=created_at.asc',
    { headers: remoteHeaders(false) }
  );
  if(!res.ok) throw new Error('Чтение не удалось: ' + res.status);
  return res.json();
}

async function remoteAddMatch(m){
  if(!remoteConfigured()) throw new Error('Бэкенд не настроен');
  if(!REMOTE.session) throw new Error('Требуется вход администратора');
  const res = await remoteAuthFetch(REMOTE.url + '/rest/v1/matches', () => ({
    method: 'POST',
    headers: Object.assign(remoteHeaders(true), { 'Prefer': 'return=representation' }),
    body: JSON.stringify({ home: m.home, away: m.away, gh: m.gh, ga: m.ga, round: m.round })
  }));
  const data = await res.json().catch(() => ({}));
  if(!res.ok) throw new Error((data.message || data.hint || 'Запись не удалась') + ' (' + res.status + ')');
  return Array.isArray(data) ? data[0] : data;
}

async function remoteAddMatches(list){
  if(!remoteConfigured()) throw new Error('Бэкенд не настроен');
  if(!REMOTE.session) throw new Error('Требуется вход администратора');
  if(!Array.isArray(list) || !list.length) return true;
  const res = await remoteAuthFetch(REMOTE.url + '/rest/v1/matches', () => ({
    method: 'POST',
    headers: Object.assign(remoteHeaders(true), { 'Prefer': 'return=minimal' }),
    body: JSON.stringify(list)
  }));
  if(!res.ok){
    const data = await res.json().catch(() => ({}));
    throw new Error((data.message || data.hint || 'Пакетная запись не удалась') + ' (' + res.status + ')');
  }
  return true;
}

async function remoteDeleteMatch(id){
  if(!remoteConfigured()) throw new Error('Бэкенд не настроен');
  if(!REMOTE.session) throw new Error('Требуется вход администратора');
  const res = await remoteAuthFetch(REMOTE.url + '/rest/v1/matches?id=eq.' + encodeURIComponent(id), () => ({
    method: 'DELETE',
    headers: remoteHeaders(true)
  }));
  if(!res.ok){
    let text = '';
    try{ text = await res.text(); }catch(e){}
    throw new Error('Удаление не удалось (' + res.status + ') ' + text);
  }
  return true;
}

async function remoteMergeMatches(){
  if(!remoteConfigured()) return { ok:false, reason:'not-configured' };
  try{
    const rows = await remoteLoadMatches();
    let added = 0;
    rows.forEach(r => {
      if(!r || !r.home || !r.away) return;
      if(isDuplicate(r.home, r.away, r.round)) return;
      HISTORY.push({
        home: r.home, away: r.away,
        gh: +r.gh, ga: +r.ga, round: +r.round,
        shared: true, remoteId: r.id
      });
      added++;
    });
    if(added) saveHistory();
    return { ok:true, added, total: rows.length };
  }catch(e){
    console.warn('Supabase: не удалось загрузить общие матчи.', e);
    return { ok:false, reason:'error', error:String(e) };
  }
}

/* ================== ЛИЧНЫЕ ДАННЫЕ (история и прогнозы по аккаунту) ==================
   Таблицы: public.user_history (личные матчи) и public.user_predictions (прогнозы).
   Каждая строка привязана к auth.uid() вошедшего пользователя; запись возможна только
   под авторизованной сессией (RLS это гарантирует). Имена команд храним как текст,
   как и в общей базе. */

function remoteSignedIn(){
  return remoteConfigured() && !!(REMOTE.session && REMOTE.session.access_token);
}

// уникальный ключ прогноза: пара команд
function remotePredKey(home, away){
  return String(home||'').trim().toLowerCase() + '|' + String(away||'').trim().toLowerCase();
}

async function remoteLoadMyHistory(){
  if(!remoteSignedIn()) throw new Error('Требуется вход в аккаунт');
  const res = await remoteAuthFetch(
    REMOTE.url + '/rest/v1/user_history?select=id,home,away,gh,ga,round&order=ts.asc,id.asc',
    () => ({ headers: remoteHeaders(true) })
  );
  if(!res.ok) throw new Error('Не удалось загрузить историю аккаунта: ' + res.status);
  return res.json();
}

// Заменяет личную историю пользователя в облаке списком (перезапись всех строк пользователя).
async function remoteReplaceMyHistory(items){
  if(!remoteSignedIn()) throw new Error('Требуется вход в аккаунт');
  const withUser = (Array.isArray(items) ? items : []).map(m => ({
    home: m.home, away: m.away, gh: +m.gh, ga: +m.ga, round: +m.round
  }));
  // 1) удалить текущие строки пользователя (RLS оставляет видимыми только его строки).
  //    Supabase требует WHERE-условие для DELETE; id=gte.0 покрывает все строки.
  const del = await remoteAuthFetch(
    REMOTE.url + '/rest/v1/user_history?id=gte.0',
    () => ({ method: 'DELETE', headers: remoteHeaders(true) })
  );
  if(!del.ok && del.status !== 204){
    const data = await del.json().catch(() => ({}));
    throw new Error((data.message || data.hint || 'Не удалось очистить историю') + ' (' + del.status + ')');
  }
  // 2) вставить новые (если есть) — только после успешной очистки, чтобы не плодить дубли
  if(withUser.length){
    const ins = await remoteAuthFetch(REMOTE.url + '/rest/v1/user_history', () => ({
      method: 'POST',
      headers: Object.assign(remoteHeaders(true), { 'Prefer': 'return=minimal' }),
      body: JSON.stringify(withUser)
    }));
    if(!ins.ok){
      const data = await ins.json().catch(() => ({}));
      throw new Error((data.message || data.hint || 'Не удалось сохранить историю') + ' (' + ins.status + ')');
    }
  }
  return true;
}

async function remoteLoadMyPredictions(){
  if(!remoteSignedIn()) throw new Error('Требуется вход в аккаунт');
  const res = await remoteAuthFetch(
    REMOTE.url + '/rest/v1/user_predictions?select=id,home,away,probs,lh,la&order=ts.asc,id.asc',
    () => ({ headers: remoteHeaders(true) })
  );
  if(!res.ok) throw new Error('Не удалось загрузить прогнозы аккаунта: ' + res.status);
  return res.json();
}

// Заменяет прогнозы пользователя в облаке списком (перезапись всех прогнозов пользователя).
async function remoteReplaceMyPredictions(items){
  if(!remoteSignedIn()) throw new Error('Требуется вход в аккаунт');
  const withUser = (Array.isArray(items) ? items : []).map(p => ({
    home: p.home, away: p.away,
    probs: JSON.stringify([+p.probs[0], +p.probs[1], +p.probs[2]]),
    lh: Number.isFinite(+p.lh) ? +p.lh : null,
    la: Number.isFinite(+p.la) ? +p.la : null
  }));
  const del = await remoteAuthFetch(
    REMOTE.url + '/rest/v1/user_predictions?id=gte.0',
    () => ({ method: 'DELETE', headers: remoteHeaders(true) })
  );
  if(!del.ok && del.status !== 204){
    const data = await del.json().catch(() => ({}));
    throw new Error((data.message || data.hint || 'Не удалось очистить прогнозы') + ' (' + del.status + ')');
  }
  if(withUser.length){
    const ins = await remoteAuthFetch(REMOTE.url + '/rest/v1/user_predictions', () => ({
      method: 'POST',
      headers: Object.assign(remoteHeaders(true), { 'Prefer': 'return=minimal' }),
      body: JSON.stringify(withUser)
    }));
    if(!ins.ok){
      const data = await ins.json().catch(() => ({}));
      throw new Error((data.message || data.hint || 'Не удалось сохранить прогнозы') + ' (' + ins.status + ')');
    }
  }
  return true;
}

remoteRestoreSession();
