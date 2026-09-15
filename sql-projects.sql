-- 프로젝트 관리 표 추가 — 이미 만든 저장소에 이 부분만 실행
create table if not exists projects (
  id          uuid primary key,
  name        text not null,               -- 프로젝트 이름
  goal        text,                        -- 목표·설명
  status      text default '진행중',       -- 진행중 / 완료 / 보류
  start_date  date,
  target_date date,                        -- 목표일(런칭일)
  owner       text,                        -- 총괄 담당
  phases      jsonb default '[]',          -- 단계 이름 순서
  checks      jsonb default '[]',          -- 체크 사항 [{id,text,done,by,at}]
  memo        text,
  created_by  text,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);
create table if not exists project_items (
  id         uuid primary key,
  project_id uuid not null,
  phase      text,                         -- 단계
  title      text not null,                -- 할 일
  assignee   text,
  start_date date,
  due_date   date,
  status     text default '예정',          -- 예정 / 진행중 / 완료 / 보류
  note       text,
  checklist  jsonb default '[]',           -- 세부 체크리스트 [{text,done}]
  sort_order int default 0,
  done_at    timestamptz,
  created_by text,
  created_at timestamptz default now(),
  updated_by text,
  updated_at timestamptz default now()
);
alter table projects      enable row level security;
alter table project_items enable row level security;
drop policy if exists "team_all" on projects;
drop policy if exists "team_all" on project_items;
create policy "team_all" on projects      for all using (true) with check (true);
create policy "team_all" on project_items for all using (true) with check (true);
alter publication supabase_realtime add table projects;
alter publication supabase_realtime add table project_items;
