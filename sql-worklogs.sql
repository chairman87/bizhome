-- 업무일지 표 + 설정 표 추가 — Supabase SQL Editor 에 붙여넣고 Run
-- worklogs: 한 사람이 하루에 한 장씩 쓰는 업무일지
create table if not exists worklogs (
  id          uuid primary key,
  log_date    date not null,               -- 일지 날짜
  author      text not null,               -- 쓴 사람 이름
  done        text,                        -- 오늘 한 일
  plan        text,                        -- 내일 할 일 · 특이사항
  files       jsonb default '[]',          -- 첨부 [{name,url,path,type}]
  reads       jsonb default '[]',          -- "확인했습니다"를 누른 사람 이름들
  comments    jsonb default '[]',          -- [{by,text,at}]
  created_by  text,
  created_at  timestamptz default now(),
  updated_by  text,
  updated_at  timestamptz default now()
);
alter table worklogs enable row level security;
drop policy if exists "team_all" on worklogs;
create policy "team_all" on worklogs for all using (true) with check (true);
alter publication supabase_realtime add table worklogs;

-- settings: 화면별 설정을 한 줄씩 저장 (id='worklog' → value={writers:[이름…], readers:[이름…]})
create table if not exists settings (
  id          text primary key,
  value       jsonb default '{}',
  updated_by  text,
  updated_at  timestamptz default now()
);
alter table settings enable row level security;
drop policy if exists "team_all" on settings;
create policy "team_all" on settings for all using (true) with check (true);
alter publication supabase_realtime add table settings;
