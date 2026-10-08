-- 상표관리 보관함 (2026-10-08) — Supabase SQL Editor 에 붙여넣고 Run
alter table trademarks add column if not exists archived boolean default false;   -- true 면 거절·포기 등 더 안 보는 상표(📦 보관함 탭에만 보임)
