-- 견적서 관리: 회사 칸 추가 (2026-10-23) — Supabase SQL Editor 에 붙여넣고 Run
alter table quotes add column if not exists company text;   -- 식이해법연구소 / (주)피에이치뷰티
update quotes set company = case when product = '흑생마' then '(주)피에이치뷰티' else '식이해법연구소' end where company is null;
