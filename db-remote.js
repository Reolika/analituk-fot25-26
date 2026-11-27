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
  const res = await fetch(
    REMOTE.url + '/rest/v1/admins?select=email&email=eq.' + encodeURIComponent(email),
    { headers: remoteHeaders(true) }
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
  const res = await fetch(REMOTE.url + '/rest/v1/matches', {
    method: 'POST',
    headers: Object.assign(remoteHeaders(true), { 'Prefer': 'return=representation' }),
    body: JSON.stringify({ home: m.home, away: m.away, gh: m.gh, ga: m.ga, round: m.round })
  });
  const data = await res.json().catch(() => ({}));
  if(!res.ok) throw new Error((data.message || data.hint || 'Запись не удалась') + ' (' + res.status + ')');
  return Array.isArray(data) ? data[0] : data;
}

async function remoteAddMatches(list){
  if(!remoteConfigured()) throw new Error('Бэкенд не настроен');
  if(!REMOTE.session) throw new Error('Требуется вход администратора');
  if(!Array.isArray(list) || !list.length) return true;
  const res = await fetch(REMOTE.url + '/rest/v1/matches', {
    method: 'POST',
    headers: Object.assign(remoteHeaders(true), { 'Prefer': 'return=minimal' }),
    body: JSON.stringify(list)
  });
  if(!res.ok){
    const data = await res.json().catch(() => ({}));
    throw new Error((data.message || data.hint || 'Пакетная запись не удалась') + ' (' + res.status + ')');
  }
  return true;
}

async function remoteDeleteMatch(id){
  if(!remoteConfigured()) throw new Error('Бэкенд не настроен');
  if(!REMOTE.session) throw new Error('Требуется вход администратора');
  const res = await fetch(REMOTE.url + '/rest/v1/matches?id=eq.' + encodeURIComponent(id), {
    method: 'DELETE',
    headers: remoteHeaders(true)
  });
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
  const res = await fetch(
    REMOTE.url + '/rest/v1/user_history?select=id,home,away,gh,ga,round&order=ts.asc,id.asc',
    { headers: remoteHeaders(true) }
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
  // 1) удалить текущие строки пользователя (RLS ограничивает только его строками)
  //    Supabase требует WHERE-условие для DELETE; id=gte.0 покрывает все строки,
  //    а RLS (user_id = auth.uid()) оставит видимыми только строки текущего пользователя.
  const del = await fetch(
    REMOTE.url + '/rest/v1/user_history?id=gte.0',
    { method: 'DELETE', headers: remoteHeaders(true) }
  );
  // 2) вставить новые (если есть)
  if(withUser.length){
    const ins = await fetch(REMOTE.url + '/rest/v1/user_history', {
      method: 'POST',
      headers: Object.assign(remoteHeaders(true), { 'Prefer': 'return=minimal' }),
      body: JSON.stringify(withUser)
    });
    if(!ins.ok){
      const data = await ins.json().catch(() => ({}));
      throw new Error((data.message || data.hint || 'Не удалось сохранить историю') + ' (' + ins.status + ')');
    }
  }
  if(del.ok || del.status === 204) return true;
  const data = await del.json().catch(() => ({}));
  throw new Error((data.message || data.hint || 'Не удалось очистить историю') + ' (' + del.status + ')');
}

async function remoteLoadMyPredictions(){
  if(!remoteSignedIn()) throw new Error('Требуется вход в аккаунт');
  const res = await fetch(
    REMOTE.url + '/rest/v1/user_predictions?select=id,home,away,probs,lh,la&order=ts.asc,id.asc',
    { headers: remoteHeaders(true) }
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
  const del = await fetch(
    REMOTE.url + '/rest/v1/user_predictions?id=gte.0',
    { method: 'DELETE', headers: remoteHeaders(true) }
  );
  if(withUser.length){
    const ins = await fetch(REMOTE.url + '/rest/v1/user_predictions', {
      method: 'POST',
      headers: Object.assign(remoteHeaders(true), { 'Prefer': 'return=minimal' }),
      body: JSON.stringify(withUser)
    });
    if(!ins.ok){
      const data = await ins.json().catch(() => ({}));
      throw new Error((data.message || data.hint || 'Не удалось сохранить прогнозы') + ' (' + ins.status + ')');
    }
  }
  if(del.ok || del.status === 204) return true;
  const data = await del.json().catch(() => ({}));
  throw new Error((data.message || data.hint || 'Не удалось очистить прогнозы') + ' (' + del.status + ')');
}

// Проверить, настроены ли личные таблицы (запрос к user_history вернёт пустой массив,
// а не ошибку, если таблица есть и RLS даёт право читать свои строки).
async function remoteCanUseProfile(){
  if(!remoteSignedIn()) return false;
  try{
    await remoteLoadMyHistory();
    return true;
  }catch(e){
    console.warn('Supabase: личные таблицы недоступны.', e);
    return false;
  }
}

remoteRestoreSession();
