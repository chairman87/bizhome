-- 프로젝트 기록(자료·견적·결정) 표 추가 — Supabase SQL Editor 에 붙여넣고 Run
create table if not exists project_logs (
  id          uuid primary key,
  project_id  uuid not null,               -- 어느 프로젝트의 기록인지
  kind        text default '자료',         -- 견적 / 자료 / 결정 / 메모
  body        text,                        -- 한 줄 설명
  log_date    date,                        -- 날짜 (받은 날. 예전 자료는 그 날짜로)
  files       jsonb default '[]',          -- 첨부 [{name,url,path,type,size}]
  comments    jsonb default '[]',          -- 댓글 [{id,by,text,at}]
  created_by  text,
  created_at  timestamptz default now(),
  updated_by  text,
  updated_at  timestamptz default now()
);
alter table project_logs enable row level security;
drop policy if exists "team_all" on project_logs;
create policy "team_all" on project_logs for all using (true) with check (true);
alter publication supabase_realtime add table project_logs;
