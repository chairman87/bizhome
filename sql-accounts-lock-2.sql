-- ═══════════════════════════════════════════════════════════════
--  계정 관리(accounts) 잠그기 2/2 — 잠그기 (2026-11-19)
--
--  sql-accounts-lock-1.sql 을 실행하고, 새 화면(common.js)과 새 백업 프로그램(INTRANET-BACKUP)이 올라간 뒤에 실행합니다.
--  실행하면 accounts 표는 공개키로 읽기·넣기·고치기·지우기가 전부 안 됩니다. 1/2 의 서버 함수(acc_*)만 표를 엽니다.
--  다시 열어야 하면(급할 때만): create policy "team_all" on accounts for all using (true) with check (true);
--                              grant select, insert, update, delete on accounts to anon, authenticated;
--  여러 번 실행해도 됩니다.
-- ═══════════════════════════════════════════════════════════════

alter table accounts enable row level security;
do $$ declare p record;
begin
  for p in select policyname from pg_policies where schemaname = 'public' and tablename = 'accounts' loop
    execute format('drop policy %I on accounts', p.policyname);
  end loop;
end $$;
revoke all on accounts from anon, authenticated;

-- 확인용: 규칙이 하나도 안 남아야 함(0)
select count(*) as policies_left from pg_policies where schemaname = 'public' and tablename = 'accounts';
