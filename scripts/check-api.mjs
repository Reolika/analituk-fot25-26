// Проверка ключа API-Football на бесплатном тарифе.
// Запуск: node scripts/check-api.mjs
// Ключ берётся из переменной API_FOOTBALL_KEY или из supabase/api-key.txt.
//
// Важно: Free-план не отдаёт данные по season, поэтому проверяем то,
// чем реально пользуется синк — запросы по дате и live=all.

import { readFile } from 'node:fs/promises';

const API = 'https://v3.football.api-sports.io';
const LEAGUES = { 235: 'РПЛ', 236: 'ФНЛ' };

async function readKey() {
  if (process.env.API_FOOTBALL_KEY) return process.env.API_FOOTBALL_KEY.trim();
  try {
    const raw = await readFile(new URL('../supabase/api-key.txt', import.meta.url), 'utf8');
    return raw.trim();
  } catch {
    return '';
  }
}

async function call(key, path, attempt = 1) {
  try {
    const res = await fetch(API + path, { headers: { 'x-apisports-key': key } });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, errors: data?.errors ?? null, results: data?.results ?? null, response: data?.response ?? null };
  } catch (e) {
    if (attempt < 2) {
      await new Promise(r => setTimeout(r, 800));
      return call(key, path, attempt + 1);
    }
    return { status: 0, errors: String(e?.message || e), results: null, response: null };
  }
}

const key = await readKey();
if (!key) {
  console.error('Нет ключа: задайте API_FOOTBALL_KEY или положите ключ в supabase/api-key.txt');
  process.exit(1);
}

const today = new Date().toISOString().slice(0, 10);

const status = await call(key, '/status');
console.log('Ключ:', JSON.stringify({
  status: status.status,
  errors: status.errors,
  plan: status.response?.subscription?.plan ?? null,
  active: status.response?.subscription?.active ?? null
}));

const teams = await call(key, '/teams?country=Russia');
console.log('Команд России доступно:', Array.isArray(teams.response) ? teams.response.length : teams.results);

const day = await call(key, `/fixtures?date=${today}`);
const ours = (day.response || []).filter(f => LEAGUES[f.league?.id]);
console.log(`Матчи на ${today}: всего ${day.results ?? 0}, РПЛ/ФНЛ ${ours.length}`);
for (const f of ours) {
  console.log(' -', LEAGUES[f.league.id], f.league?.round, '|',
    f.teams?.home?.name, '-', f.teams?.away?.name,
    '|', f.fixture?.status?.short, '|', f.goals?.home, ':', f.goals?.away,
    '|', f.fixture?.date);
}

const live = await call(key, '/fixtures?live=all');
const liveOurs = (live.response || []).filter(f => LEAGUES[f.league?.id]);
console.log('live=all:', live.results ?? 0, 'матчей, из них РПЛ/ФНЛ:', liveOurs.length);

console.log('\nЕсли ошибок нет — ключ рабочий, синк сможет забирать данные по дате и live.');
