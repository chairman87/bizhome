-- 구독관리(매월 정기 지출) 표 추가 — Supabase SQL Editor 에 붙여넣고 Run
create table if not exists subscriptions (
  id          uuid primary key,
  name        text not null,               -- 항목 (어도비, 사무실 임대료 ...)
  category    text,                        -- 구분 (소프트웨어·AI, 통신, 임대·관리비 ...)
  company     text,                        -- 식이해법연구소 / (주)피에이치뷰티 / 공통
  vendor      text,                        -- 결제처
  fee         numeric default 0,           -- 금액
  currency    text default 'KRW',          -- KRW / USD
  cycle       text default '월',           -- 월 / 년
  billing_day int,                         -- 결제일
  start_date  date,
  end_date    date,                        -- 만료·갱신일
  pay_method  text,                        -- 결제 수단 (카드 끝자리 등)
  owner       text,                        -- 담당
  account_id  uuid,                        -- 계정관리의 계정과 연결
  status      text default '이용중',       -- 이용중 / 해지
  memo        text,
  admin_only  boolean default false,
  created_by  text,
  created_at  timestamptz default now(),
  updated_by  text,
  updated_at  timestamptz default now()
);
alter table subscriptions enable row level security;
drop policy if exists "team_all" on subscriptions;
create policy "team_all" on subscriptions for all using (true) with check (true);
alter publication supabase_realtime add table subscriptions;
