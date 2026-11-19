-- ═══════════════════════════════════════════════════════════════
--  자동작업 대화·수정요청 잠그기 2/2 — 잠그기 (2026-11-19)
--
--  sql-routines-lock-1.sql 을 실행하고, 새 화면(routines.html)과 새 처리기(ROUTINE-BOARD)가 올라간 뒤에 실행합니다.
--  실행하면 대화·메시지·수정요청 세 표는 공개키로 "읽기만" 됩니다. 넣기·고치기·지우기는 1/2 의 서버 함수(rt_*)만 할 수 있습니다.
--    · 화면: 로그인 출입증으로 rt_chat_* · rt_req_* 를 부름 (글쓴이·승인한 사람은 서버가 적음)
--    · lemon803: PC 전용 열쇠로 rt_pc_* 를 부름
--  읽기를 열어 둔 이유: 화면의 실시간 갱신이 이 표들을 직접 보고 있고, 자동작업 목록·실행 기록(routines · routine_runs)도 원래 공개키로 읽히는 표라서입니다.
--  (🔒 관리자만 보기 작업을 직원 화면에서 숨기는 것은 예전처럼 화면이 합니다. 서버 함수도 직원이 🔒 작업에 글·요청을 못 올리게 막습니다.)
--  여러 번 실행해도 됩니다.
-- ═══════════════════════════════════════════════════════════════

do $$ declare t text;
begin
  foreach t in array array['routine_chats', 'routine_chat_messages', 'routine_requests'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "team_all" on %I', t);
    execute format('drop policy if exists "read_all" on %I', t);
    execute format('create policy "read_all" on %I for select using (true)', t);
    execute format('revoke insert, update, delete, truncate on %I from anon, authenticated', t);
  end loop;
end $$;

-- 확인용: 세 표에 남은 규칙(read_all / SELECT 만 보여야 함)
select tablename, policyname, cmd from pg_policies where tablename in ('routine_chats', 'routine_chat_messages', 'routine_requests') order by 1;
