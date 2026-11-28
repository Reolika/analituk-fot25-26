// Supabase Edge Function: sync-matches
// API-Football, тариф Free: сезоны закрыты, доступны только /fixtures?date=...
// (окно «вчера-сегодня-завтра») и /fixtures?live=all.
//
// Режимы:
//   ?mode=live — идущие матчи, 1 запрос (live=all)
//   ?mode=day  — календарь на сегодня и завтра, 2 запроса
//
// Секреты: API_FOOTBALL_KEY, RPL_LEAGUE_ID (по умолчанию 235), FNL_LEAGUE_ID (236).

const API_BASE = 'https://v3.football.api-sports.io';
const QUOTA_RESERVE = 5;

type Mode = 'live' | 'day';

const LEAGUES: Record<number, string> = {
  [Number(Deno.env.get('RPL_LEAGUE_ID') || 235)]: 'rpl',
  [Number(Deno.env.get('FNL_LEAGUE_ID') || 236)]: 'fnl'
};

function supabaseEnv() {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) throw new Error('Нет SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
  return { url: url.replace(/\/+$/, ''), key };
}

async function rest(path: string, init: RequestInit = {}) {
  const { url, key } = supabaseEnv();
  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
    ...(init.headers || {})
  };
  const res = await fetch(url + '/rest/v1/' + path, { ...init, headers });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Supabase ${res.status}: ${text.slice(0, 300)}`);
  }
  return res;
}

async function apiFootball(path: string) {
  const key = Deno.env.get('API_FOOTBALL_KEY');
  if (!key) throw new Error('Не задан API_FOOTBALL_KEY');
  const res = await fetch(API_BASE + path, { headers: { 'x-apisports-key': key } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`API-Football ${res.status}: ${data?.message || 'ошибка'}`);
  const errors = data?.errors;
  const hasErrors = Array.isArray(errors) ? errors.length > 0
    : !!(errors && typeof errors === 'object' && Object.keys(errors).length);
  if (hasErrors) throw new Error('API-Football: ' + JSON.stringify(errors).slice(0, 300));
  return data;
}

async function readQuota() {
  const res = await rest('sync_state?id=eq.1&select=day,requests_used,quota_limit');
  const rows = await res.json();
  if (!Array.isArray(rows) || !rows.length) return { day: '', requests_used: 0, quota_limit: 100 };
  return rows[0];
}

async function bumpQuota(used: number, limit: number, today: string, day: string, spent: number) {
  const next = day === today ? used : 0;
  await rest('sync_state?id=eq.1', {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      day: today,
      requests_used: next + spent,
      quota_limit: limit,
      last_run: new Date().toISOString()
    })
  });
}

type TeamMap = { byId: Map<number, string>; byName: Map<string, string> };

async function loadTeams(): Promise<TeamMap> {
  const res = await rest('team_aliases?select=alias,team_name,provider_team_id');
  const rows = await res.json();
  const byId = new Map<number, string>();
  const byName = new Map<string, string>();
  if (Array.isArray(rows)) {
    for (const r of rows) {
      if (!r?.team_name) continue;
      if (r.provider_team_id) byId.set(Number(r.provider_team_id), r.team_name);
      if (r.alias) byName.set(String(r.alias).toLowerCase(), r.team_name);
    }
  }
  return { byId, byName };
}

function resolveTeam(team: any, teams: TeamMap): string | null {
  if (!team) return null;
  const id = Number(team.id);
  if (Number.isFinite(id) && teams.byId.has(id)) return teams.byId.get(id) || null;
  const name = String(team.name || '').toLowerCase();
  if (name && teams.byName.has(name)) return teams.byName.get(name) || null;
  return null;
}

function parseRound(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const m = String(raw).match(/(\d+)\s*$/);
  return m ? Number(m[1]) : null;
}

function mapStatus(short: string | null | undefined) {
  switch (String(short || '').toUpperCase()) {
    case '1H': case '2H': case 'HT': case 'ET': case 'BT': case 'P': case 'LIVE': case 'INT':
      return 'live';
    case 'FT': case 'AET': case 'PEN':
      return 'finished';
    case 'PST':
      return 'postponed';
    case 'CANC': case 'ABD': case 'AWD': case 'WO':
      return 'cancelled';
    default:
      return 'scheduled';
  }
}

function normalize(item: any, teams: TeamMap) {
  const leagueId = Number(item?.league?.id);
  const leagueCode = LEAGUES[leagueId];
  if (!leagueCode) return null;

  const home = resolveTeam(item?.teams?.home, teams);
  const away = resolveTeam(item?.teams?.away, teams);
  const status = mapStatus(item?.fixture?.status?.short);
  const elapsed = Number(item?.fixture?.status?.elapsed);

  return {
    provider: 'api-football',
    external_id: String(item?.fixture?.id ?? ''),
    league_code: leagueCode,
    season: Number(item?.league?.season) || new Date().getFullYear(),
    round: parseRound(item?.league?.round),
    kickoff_at: item?.fixture?.date || null,
    status,
    minute: status === 'live' && Number.isFinite(elapsed) ? elapsed : null,
    home,
    away,
    gh: item?.goals?.home ?? null,
    ga: item?.goals?.away ?? null,
    updated_at: new Date().toISOString()
  };
}

async function collect(mode: Mode, teams: TeamMap) {
  const raw: any[] = [];
  let requests = 0;

  if (mode === 'live') {
    const data = await apiFootball('/fixtures?live=all');
    requests += 1;
    raw.push(...(data?.response || []));
  } else {
    const now = new Date();
    const dates = [now, new Date(now.getTime() + 86400000)]
      .map(d => d.toISOString().slice(0, 10));
    for (const date of dates) {
      const data = await apiFootball(`/fixtures?date=${date}`);
      requests += 1;
      raw.push(...(data?.response || []));
    }
  }

  const seen = new Map<string, any>();
  let unmatched = 0;

  for (const item of raw) {
    const row = normalize(item, teams);
    if (!row) continue;
    if (!row.home || !row.away || !row.external_id) {
      unmatched += 1;
      continue;
    }
    seen.set(row.external_id, row);
  }

  return { rows: [...seen.values()], requests, unmatched };
}

async function upsertFixtures(rows: any[]) {
  if (!rows.length) return;
  await rest('fixtures?on_conflict=provider,external_id', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(rows)
  });
}

async function upsertFinished(rows: any[]) {
  const finished = rows.filter(r => r.status === 'finished' && r.round &&
    Number.isInteger(r.gh) && Number.isInteger(r.ga));
  if (!finished.length) return 0;
  const payload = finished.map(r => ({
    home: r.home, away: r.away, round: r.round, gh: r.gh, ga: r.ga
  }));
  await rest('matches?on_conflict=home,away,round', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(payload)
  });
  return payload.length;
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const mode: Mode = url.searchParams.get('mode') === 'day' ? 'day' : 'live';
  const started = new Date().toISOString();

  try {
    const quota = await readQuota();
    const today = new Date().toISOString().slice(0, 10);
    const used = quota.day === today ? quota.requests_used : 0;
    const limit = quota.quota_limit || 100;

    if (used >= limit - QUOTA_RESERVE) {
      return Response.json({
        ok: false, reason: 'quota', used, limit,
        message: 'Дневной лимит почти исчерпан, синк пропущен'
      }, { status: 429 });
    }

    const teams = await loadTeams();
    const { rows, requests, unmatched } = await collect(mode, teams);

    await upsertFixtures(rows);
    const finishedAdded = await upsertFinished(rows);
    await bumpQuota(used, limit, today, quota.day, requests);

    await rest('sync_log', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        started_at: started,
        finished_at: new Date().toISOString(),
        source: mode,
        ok: true,
        requests_used: requests,
        fixtures_seen: rows.length,
        fixtures_updated: rows.length,
        finished_added: finishedAdded,
        unmatched,
        message: null
      })
    });

    return Response.json({
      ok: true, mode,
      fixtures: rows.length,
      finishedAdded,
      unmatched,
      requests,
      quotaUsed: used + requests,
      quotaLimit: limit
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    try {
      await rest('sync_state?id=eq.1', {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ last_error: message })
      });
      await rest('sync_log', {
        method: 'POST',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({
          started_at: started,
          finished_at: new Date().toISOString(),
          source: mode, ok: false, message
        })
      });
    } catch (_) {
      // журнал недоступен — ошибку всё равно возвращаем
    }
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
});
