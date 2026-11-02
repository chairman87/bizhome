-- 광고 영상 리스트: 구글·틱톡 집행 금액 칸 추가 (2026-11-02) — Supabase SQL Editor 에 붙여넣고 Run
-- 매일 10시 ADS-SYNC\ads_sync.py 가 구글애즈 광고 단위·틱톡 광고 단위 월별 지출(부가세 별도)을 2026-10 부터 적음. 예: {"2026-10": 1234567}
alter table ads add column if not exists google_spend jsonb default '{}'::jsonb;
alter table ads add column if not exists tiktok_spend jsonb default '{}'::jsonb;
notify pgrst, 'reload schema';
