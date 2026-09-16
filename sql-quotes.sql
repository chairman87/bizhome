-- 견적서 관리 표 추가 — Supabase SQL Editor 에 붙여넣고 Run
create table if not exists quotes (
  id             uuid primary key,
  supplier       text,                      -- 거래처(제조사)
  product        text not null,             -- 제품
  spec           text,                      -- 규격 (500mg × 60정)
  quote_date     date,                      -- 견적일
  qty            numeric default 0,         -- 발주량
  unit_price     numeric default 0,         -- 최종 협의 단가(원/개)
  list_price     numeric,                   -- 조정 전 원가 합계
  cost_material  numeric,                   -- 원료비
  cost_packaging numeric,                   -- 부자재비
  cost_labor     numeric,                   -- 가공비 외
  one_time       numeric,                   -- 1회성 비용(검사비 등)
  vat            boolean default true,      -- VAT 별도
  valid_until    date,                      -- 유효기간
  terms          text,                      -- 결제조건
  change         text,                      -- 변경 내용
  memo           text,
  files          jsonb default '[]',        -- 견적서 파일
  is_final       boolean default false,     -- 최종 확정
  created_by     text,
  created_at     timestamptz default now(),
  updated_by     text,
  updated_at     timestamptz default now()
);
alter table quotes enable row level security;
drop policy if exists "team_all" on quotes;
create policy "team_all" on quotes for all using (true) with check (true);
alter publication supabase_realtime add table quotes;
