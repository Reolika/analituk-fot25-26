-- Расписание синхронизации матчей (pg_cron + pg_net).
-- Выполнить в SQL Editor. Замените aehvmcpszveuathludyl и <SERVICE_ROLE_KEY>.
--
-- Лимит Free: 100 запросов в сутки.
--   72 — live каждые 10 минут с 11:00 до 22:50 МСК (08:00–19:50 UTC)
--    6 — календарь трижды в сутки по 2 запроса (сегодня и завтра)
-- Итого 78 из 100, запас 22 на ручные проверки.

create extension if not exists pg_cron;
create extension if not exists pg_net;

do $$
begin
  perform cron.unschedule('sync-matches-live');
exception when others then null;
end $$;

do $$
begin
  perform cron.unschedule('sync-matches-day-1');
exception when others then null;
end $$;

do $$
begin
  perform cron.unschedule('sync-matches-day-2');
exception when others then null;
end $$;

do $$
begin
  perform cron.unschedule('sync-matches-day-3');
exception when others then null;
end $$;

-- Live: каждые 10 минут в игровом окне
select cron.schedule('sync-matches-live', '*/10 8-19 * * *', $$
  select net.http_post(
    url := 'https://<PROJECT>.supabase.co/functions/v1/sync-matches?mode=live',
    headers := jsonb_build_object(
      'Authorization', 'Bearer <SERVICE_ROLE_KEY>',
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 20000
  );
$$);

-- Календарь: утро (расписание дня), вечер и поздний вечер (финальные счёта)
select cron.schedule('sync-matches-day-1', '10 5 * * *', $$
  select net.http_post(
    url := 'https://<PROJECT>.supabase.co/functions/v1/sync-matches?mode=day',
    headers := jsonb_build_object('Authorization', 'Bearer <SERVICE_ROLE_KEY>', 'Content-Type', 'application/json'),
    body := '{}'::jsonb,
    timeout_milliseconds := 20000
  );
$$);

select cron.schedule('sync-matches-day-2', '40 17 * * *', $$
  select net.http_post(
    url := 'https://<PROJECT>.supabase.co/functions/v1/sync-matches?mode=day',
    headers := jsonb_build_object('Authorization', 'Bearer <SERVICE_ROLE_KEY>', 'Content-Type', 'application/json'),
    body := '{}'::jsonb,
    timeout_milliseconds := 20000
  );
$$);

select cron.schedule('sync-matches-day-3', '10 20 * * *', $$
  select net.http_post(
    url := 'https://<PROJECT>.supabase.co/functions/v1/sync-matches?mode=day',
    headers := jsonb_build_object('Authorization', 'Bearer <SERVICE_ROLE_KEY>', 'Content-Type', 'application/json'),
    body := '{}'::jsonb,
    timeout_milliseconds := 20000
  );
$$);

-- Контроль:
-- select * from public.sync_log order by started_at desc limit 20;
-- select * from public.sync_state;
