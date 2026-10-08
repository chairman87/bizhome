-- 상표관리 표에 '비고' 칸 추가 (2026-10-08) — Supabase SQL Editor 에 붙여넣고 Run
alter table trademarks add column if not exists note text;   -- 표에 바로 보이는 짧은 메모(더블클릭으로 적음)
