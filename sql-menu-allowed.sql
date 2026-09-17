-- 메뉴별 볼 수 있는 사람 목록 칸 추가 — Supabase SQL Editor 에 붙여넣고 Run
alter table menu add column if not exists allowed jsonb default '[]';
