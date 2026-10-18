-- 마케팅 > 퍼포먼스 데이터 (브랜드별 광고비 ↔ 채널별 매출) 표 추가 — Supabase SQL Editor 에 붙여넣고 Run
-- 값은 대표 PC 의 MKT-PERF\perf_sync.py 가 매시간 두 손익 상황판(SIK-DASH·PH-DASH)의 data.json 에서 뽑아 넣음.
-- 손익(원가·수수료·영업이익·순이익)은 넣지 않음. 광고비와 매출만.
create table if not exists mkt_perf (
  id          text primary key,            -- 브랜드|날짜 (예: 레모너리|2026-10-18) 또는 브랜드|M|월 (예: 레모너리|M|2026-10)
  kind        text not null,               -- day(하루) / month(한 달)
  brand       text not null,               -- 레모너리 / 서리맥스 / 흑생마
  company     text,                        -- 식이해법 / 피에이치뷰티
  period      text not null,               -- YYYY-MM-DD 또는 YYYY-MM
  cf_s        bigint default 0,            -- 자사몰(카페24) 매출
  nv_s        bigint default 0,            -- 스마트스토어 매출
  cp_s        bigint default 0,            -- 쿠팡(판매자배송) 매출
  rg_s        bigint default 0,            -- 쿠팡 로켓그로스 매출
  sales       bigint default 0,            -- 매출 합계
  cf_o        int default 0,               -- 자사몰 주문 수
  nv_o        int default 0,               -- 스마트스토어 주문 수
  cp_o        int default 0,               -- 쿠팡 주문 수(판매자배송+로켓그로스)
  orders      int default 0,               -- 주문 수 합계
  ad          jsonb default '{}',          -- 채널별 광고비 {meta, tiktok, google, naver_cpc, coupang_ad, kakao} — 각 플랫폼이 보고한 금액(부가세 전)
  ads         bigint default 0,            -- 광고비 합계
  partial     boolean default false,       -- 아직 끝나지 않은 날/달(진행 중)
  flags       jsonb default '{}',          -- 참고 표시 {coupang_ad_tmp: 쿠팡광고비가 아직 임시값}
  src         text,                        -- 자료 출처(API 등)
  updated_at  timestamptz default now()
);
alter table mkt_perf enable row level security;
drop policy if exists "team_all" on mkt_perf;
create policy "team_all" on mkt_perf for all using (true) with check (true);
alter publication supabase_realtime add table mkt_perf;
