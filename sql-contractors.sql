-- 외주 용역관리 표 추가 — Supabase SQL Editor 에 붙여넣고 Run
-- 1) 외주 인력
create table if not exists contractors (
  id         uuid primary key,
  name       text not null,               -- 성명
  rrn        text,                        -- 주민등록번호 (관리자만 전체 표시)
  bank       text,                        -- 이체 계좌
  phone      text,
  email      text,
  role       text,                        -- 용역내역 기본값 (인플루언서 등)
  files      jsonb default '[]',          -- 신분증·통장사본·기타 파일 [{kind, name, url, path, size}]
  memo       text,
  active     boolean default true,        -- 현재 거래 중
  created_by text,
  created_at timestamptz default now(),
  updated_by text,
  updated_at timestamptz default now()
);
-- 2) 월별 지급 내역
create table if not exists contractor_pays (
  id            uuid primary key,
  month         text not null,            -- YYYY-MM
  contractor_id uuid,
  name          text,                     -- 성명 (당시 이름)
  gross         numeric default 0,        -- 지급액
  tax           numeric default 0,        -- 소득세 3%
  local_tax     numeric default 0,        -- 지방소득세 0.3%
  net           numeric default 0,        -- 차인지급액
  service       text,                     -- 용역내역
  paid_date     date,                     -- 이체한 날
  memo          text,
  files         jsonb default '[]',
  created_by    text,
  created_at    timestamptz default now(),
  updated_by    text,
  updated_at    timestamptz default now()
);
alter table contractors enable row level security;
alter table contractor_pays enable row level security;
drop policy if exists "team_all" on contractors;
drop policy if exists "team_all" on contractor_pays;
create policy "team_all" on contractors for all using (true) with check (true);
create policy "team_all" on contractor_pays for all using (true) with check (true);
alter publication supabase_realtime add table contractors;
alter publication supabase_realtime add table contractor_pays;
