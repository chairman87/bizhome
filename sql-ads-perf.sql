-- 광고 영상 리스트: 영상별 성과(CPA·ROAS 계산용)·나스 파일 칸 추가 (2026-11-09) — Supabase SQL Editor 에 붙여넣고 Run
-- lemon803 의 매시간 "마케팅 퍼포먼스 데이터 반영"(MKT-PERF\video_sync.py)이
--   perf = {"meta": {"2026-11-08": [광고비, 구매, 구매금액], ..., "2026-10": [달 합계]}, "tiktok": {...}, "google": {...}}  (광고비는 부가세 전, 구매는 플랫폼 추적값)
--   nas  = {"path": "\\\\192.168.0.10\\마케팅\\★ 레모너리_광고 최종본\\1106_타이틀_편집자.mp4", "mb": 135.2, "alts": [...]}
-- 를 영상 줄마다 적음. 화면의 "영상 리뷰" 탭과 제품 탭의 성과 열이 이 칸을 읽음.
alter table ads add column if not exists perf jsonb default '{}'::jsonb;
alter table ads add column if not exists nas  jsonb default '{}'::jsonb;
notify pgrst, 'reload schema';
