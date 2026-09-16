-- 광고 영상 리스트에 구글(O/X) 칸 추가 — Supabase SQL Editor 에 붙여넣고 Run
alter table ads add column if not exists google boolean default false;
