-- 결정사항 표 추가 — Supabase SQL Editor 에 붙여넣고 Run
create table if not exists decisions (
  id          uuid primary key,
  title       text not null,               -- 결정 한 줄
  reason      text,                        -- 이유·배경
  topic       text,                        -- 관련: 회사 공통 / 레모너리 / 서리맥스 / 흑생마 …
  decided_at  date,                        -- 결정일
  targets     jsonb default '[]',          -- 대상 팀원 이름들 (비어 있으면 전체)
  reads       jsonb default '[]',          -- "확인했습니다"를 누른 사람 이름들
  created_by  text,
  created_at  timestamptz default now(),
  updated_by  text,
  updated_at  timestamptz default now()
);
alter table decisions enable row level security;
drop policy if exists "team_all" on decisions;
create policy "team_all" on decisions for all using (true) with check (true);
alter publication supabase_realtime add table decisions;
