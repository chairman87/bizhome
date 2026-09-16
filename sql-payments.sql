-- 결제(지출·수입 관리) 표 추가 — Supabase SQL Editor 에 붙여넣고 Run
create table if not exists payments (
  id            uuid primary key,
  title         text not null,               -- 내역
  date          date,                        -- 일자
  category      text,                        -- 카테고리 (광고비, 인건비 ...)
  kind          text default '비용',         -- 비용 / 수입
  amount        numeric default 0,           -- 금액(원)
  payee         text,                        -- 받는 곳(업체·사람)
  account       text,                        -- 이체할 계좌
  due_date      date,                        -- 이체 희망일
  invoice       boolean default false,       -- 세금계산서 필요
  memo          text,
  files         jsonb default '[]',          -- 첨부(견적서, 이체 확인 캡처)
  status        text default '결재대기',     -- 결재대기 / 결재완료 / 이체완료 / 반려
  approved_by   text, approved_at timestamptz,
  paid_by       text, paid_at timestamptz,
  reject_reason text,
  comments      jsonb default '[]',
  created_by    text,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);
alter table payments enable row level security;
drop policy if exists "team_all" on payments;
create policy "team_all" on payments for all using (true) with check (true);
alter publication supabase_realtime add table payments;
