-- ═══════════════════════════════════════════════════════════════
--  민감한 표 잠그기 2/2 — 잠그기 (2026-11-19)
--
--  sql-lock-tables-1.sql 을 실행하고, 새 화면(common.js)과 새 백업 프로그램(INTRANET-BACKUP)이 올라간 뒤에 실행합니다.
--  실행하면 아래 표들은 공개키로 읽기·넣기·고치기·지우기가 전부 안 됩니다. 1/2 의 서버 함수(lk_*)만 표를 엽니다.
--  다시 열어야 하면(급할 때만), 표 하나마다:
--      create policy "team_all" on 표이름 for all using (true) with check (true);
--      grant select, insert, update, delete on 표이름 to anon, authenticated;
--  여러 번 실행해도 됩니다.
-- ═══════════════════════════════════════════════════════════════

do $$ declare t text; p record;
begin
  foreach t in array array['payments', 'contractors', 'contractor_pays', 'subscriptions', 'quotes', 'partners'] loop
    execute format('alter table %I enable row level security', t);
    for p in select policyname from pg_policies where schemaname = 'public' and tablename = t loop
      execute format('drop policy %I on %I', p.policyname, t);
    end loop;
    execute format('revoke all on %I from anon, authenticated', t);
  end loop;
end $$;

-- 확인용: 규칙이 하나도 안 남아야 함(0)
select count(*) as policies_left from pg_policies where schemaname = 'public'
  and tablename in ('payments', 'contractors', 'contractor_pays', 'subscriptions', 'quotes', 'partners');
