-- 광고 영상 리스트: 광고 집행 금액 칸 추가 (2026-11-02) — Supabase SQL Editor 에 붙여넣고 Run
-- 메타가 캠페인 1개에 영상(광고) 여러 개를 넣는 구조로 바뀌어 예산을 영상별로 나눌 수 없으므로,
-- 매일 10시 ADS-SYNC\ads_sync.py 가 메타 광고 단위 월별 지출(부가세 전)을 2026-10 부터 여기에 적음. 예: {"2026-10": 1234567, "2026-11": 89000}
alter table ads add column if not exists meta_spend jsonb default '{}'::jsonb;
notify pgrst, 'reload schema';
