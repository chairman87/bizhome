-- 구독관리에 사용자 칸 추가 — Supabase SQL Editor 에 붙여넣고 Run
alter table subscriptions add column if not exists users text;
