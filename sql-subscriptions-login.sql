-- 구독관리에 로그인 칸 추가 — Supabase SQL Editor 에 붙여넣고 Run
alter table subscriptions add column if not exists url text, add column if not exists login_id text, add column if not exists password text;
