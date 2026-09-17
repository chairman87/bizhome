-- 비매출(샘플 발송) 표 추가 — Supabase SQL Editor 에 붙여넣고 Run
create table if not exists samples (
  id           uuid primary key,
  product      text,                        -- 제품 (레모너리/서리맥스/흑생마)
  product_name text,                        -- 주문상품명 (엑셀용)
  option_name  text,                        -- 주문상품명(옵션포함)
  qty          int default 1,               -- 수량
  recipient    text,                        -- 수령인
  phone        text,                        -- 수령인 휴대전화
  zip          text,                        -- 우편번호
  address      text,                        -- 주소
  address2     text,                        -- 상세주소
  pay_type     text,                        -- 결제구분
  pay_method   text,                        -- 결제수단
  order_date   date,                        -- 발주일
  country      text default '대한민국',      -- 배송국가
  category     text,                        -- 구분 (파트너스/체험단 ...)
  memo         text,
  sent         boolean default false,       -- 발송 완료
  sent_at      timestamptz,
  exported_at  timestamptz,                 -- 엑셀 추출한 때
  created_by   text,
  created_at   timestamptz default now(),
  updated_by   text,
  updated_at   timestamptz default now()
);
alter table samples enable row level security;
drop policy if exists "team_all" on samples;
create policy "team_all" on samples for all using (true) with check (true);
alter publication supabase_realtime add table samples;
