-- 회사 서류함 표 추가 — Supabase SQL Editor 에 붙여넣고 Run
create table if not exists docs (
  id          uuid primary key,
  company     text,                         -- 식이해법연구소 / (주)피에이치뷰티 / 공통
  doc_type    text,                         -- 종류 (사업자등록증, 통장 사본 ...)
  title       text not null,
  files       jsonb default '[]',           -- 첨부 파일 목록
  issued_date date,                         -- 발급일
  expire_date date,                         -- 유효기간
  memo        text,
  admin_only  boolean default false,        -- 관리자만 보기
  created_by  text,
  created_at  timestamptz default now(),
  updated_by  text,
  updated_at  timestamptz default now()
);
alter table docs enable row level security;
drop policy if exists "team_all" on docs;
create policy "team_all" on docs for all using (true) with check (true);
alter publication supabase_realtime add table docs;
