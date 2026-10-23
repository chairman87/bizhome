-- 견적서 관리: 유형 칸 추가 (2026-10-23) — Supabase SQL Editor 에 붙여넣고 Run
alter table quotes add column if not exists category text;   -- SCM / 물류 / 마케팅
update quotes set category = 'SCM' where category is null;   -- 지금까지 견적(비에스바이오 제조 견적)은 모두 SCM
