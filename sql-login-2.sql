-- ═══════════════════════════════════════════════════════════════
--  로그인 잠그기 2/2 — 잠그기 (2026-11-19)
--
--  sql-login-1.sql 을 실행하고 새 화면(common.js)을 올린 뒤에 실행합니다.
--    · 팀원 표의 비밀번호 칸을 없앱니다(암호화본은 member_secrets 에 있음). 되돌릴 수 없습니다.
--    · 팀원 표는 공개키로 읽기만 됩니다. 고치기·추가·삭제는 서버 함수(bz_member_save 등)로만.
--    · 예전에 받은 출입증을 모두 지웁니다 → 모두 한 번 다시 로그인.
--  여러 번 실행해도 됩니다.
-- ═══════════════════════════════════════════════════════════════

drop trigger if exists bz_pw_sync on members;
drop function if exists bz_pw_sync();
alter table members drop column if exists password;

drop policy if exists "team_all" on members;
drop policy if exists "team_read" on members;
create policy "team_read" on members for select using (true);
revoke insert, update, delete, truncate on members from anon, authenticated;

delete from think_sessions;

-- 확인용: 비밀번호 칸이 없어졌는지(0 이어야 함), 공개키에 남은 권한(SELECT 만 있어야 함)
select (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'members' and column_name = 'password') as password_column,
       (select string_agg(distinct privilege_type, ', ') from information_schema.role_table_grants where table_schema = 'public' and table_name = 'members' and grantee = 'anon') as anon_can;
