-- 마케팅 > 퍼포먼스 데이터 > 캠페인 보기 표 추가 — Supabase SQL Editor 에 붙여넣고 Run
-- 값은 대표 PC 의 MKT-PERF\camp_sync.py 가 매시간 메타·구글애즈·틱톡 API 에서 캠페인별로 읽어 넣음 (최근 60일만 보관).
create table if not exists mkt_perf_camp (
  id           text primary key,            -- 플랫폼|캠페인번호|날짜
  brand        text not null,               -- 레모너리 / 서리맥스 / 흑생마
  company      text,
  platform     text not null,               -- meta / google / tiktok
  campaign_id  text not null,
  name         text,                        -- 캠페인 이름
  date         text not null,               -- YYYY-MM-DD
  spend        bigint default 0,            -- 광고비 (플랫폼 보고, 부가세 전)
  conv         numeric default 0,           -- 플랫폼이 추적한 구매 수
  value        bigint default 0,            -- 플랫폼이 추적한 구매 금액 (결제금액)
  status       text,                        -- 켜짐 / 꺼짐 (지금 상태)
  budget       bigint default 0,            -- 지금 일예산
  updated_at   timestamptz default now()
);
create index if not exists mkt_perf_camp_brand_date on mkt_perf_camp (brand, date);
alter table mkt_perf_camp enable row level security;
drop policy if exists "team_all" on mkt_perf_camp;
create policy "team_all" on mkt_perf_camp for all using (true) with check (true);
