-- 상표관리 표 추가 — Supabase SQL Editor 에 붙여넣고 Run (2026-10-08)
-- 한 줄 = 상표 하나(나라별로 따로). 등록증·청구서 같은 파일은 Storage 'files' 보관함 trademarks/ 폴더에 올라가고 files 칸에 목록이 남음
create table if not exists trademarks (
  id          uuid primary key,
  company     text,                         -- 식이해법연구소 / (주)피에이치뷰티
  name        text not null,                -- 상표명 (예: lemonery, 흑생마)
  region      text default '한국',          -- 나라·지역 (한국, 마드리드 국제출원, 대만 ...)
  status      text default '출원',          -- 출원 / 공고 / 등록 / 거절 / 포기·소멸
  priority    boolean default false,        -- 우선심사 신청 여부
  app_no      text,                         -- 출원번호 (40-2026-0096011)
  app_date    date,                         -- 출원일
  pub_date    date,                         -- 출원공고일
  reg_no      text,                         -- 등록번호 (40-2538634)
  reg_date    date,                         -- 등록일
  expire_date date,                         -- 존속기간 만료일 (등록일 + 10년)
  classes     text,                         -- 상품류 (제29류)
  goods       text,                         -- 지정상품
  owner       text,                         -- 권리자 명의
  agent       text,                         -- 대리인(특허사무소)
  fee_total   integer,                      -- 지금까지 든 비용 합계(원)
  fee_note    text,                         -- 비용 내역 (여러 줄)
  history     text,                         -- 진행 이력 (출원 → 공고 → 등록, 양도 등)
  next_action text,                         -- 다음에 할 일
  next_date   date,                         -- 그 기한
  memo        text,
  files       jsonb default '[]',           -- 첨부 파일 목록 (등록증, 등록원부, 청구서 ...)
  admin_only  boolean default false,        -- 관리자만 보기
  created_by  text,
  created_at  timestamptz default now(),
  updated_by  text,
  updated_at  timestamptz default now()
);
alter table trademarks enable row level security;
drop policy if exists "team_all" on trademarks;
create policy "team_all" on trademarks for all using (true) with check (true);
alter publication supabase_realtime add table trademarks;
