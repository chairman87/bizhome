-- 운영진 그룹 (2026-11-19) — Supabase SQL Editor 에 붙여넣고 Run. 여러 번 실행해도 됩니다.
-- 팀원 표에 '운영진' 칸을 하나 둡니다. 관리자가 팀원 관리에서 [운영진 지정]으로 켜고 끕니다.
-- 메뉴의 '볼 수 있는 사람'(menu.allowed)에 '@운영진' 이 들어 있으면 운영진 전원에게 보입니다(common.js 의 OPS·allowedFor).
-- 인증문자(sql-auth-sms.sql 의 as_can)도 운영진이면 봅니다. 이 파일을 먼저 실행한 뒤 sql-auth-sms.sql 을 다시 실행하세요.
alter table members add column if not exists ops boolean default false;
