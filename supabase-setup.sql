-- ============================================================
-- 팀 업무판: Supabase 저장소 준비 (한 번만 실행)
-- Supabase 화면 왼쪽 메뉴 "SQL Editor" > "New query" 에 전부 붙여넣고 Run
-- ============================================================

-- 1) 업무 표
create table if not exists tasks (
  id           uuid primary key,
  title        text not null,
  assignee     text,
  due_date     date,
  status       text not null default '대기',
  priority     text default '보통',
  memo         text,
  created_by   text,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now(),
  completed_at timestamptz
);

-- 2) 팀원 표
create table if not exists members (
  id         uuid primary key,
  name       text not null unique,
  color      text,
  sort_order int default 0
);

-- 3) 접근 권한: 링크(anon 키)를 가진 사람은 모두 읽고 쓸 수 있음 (소규모 팀 전제)
alter table tasks   enable row level security;
alter table members enable row level security;
drop policy if exists "team_all" on tasks;
drop policy if exists "team_all" on members;
create policy "team_all" on tasks   for all using (true) with check (true);
create policy "team_all" on members for all using (true) with check (true);

-- 4) 실시간 알림: 누가 바꾸면 다른 사람 화면도 바로 갱신
alter publication supabase_realtime add table tasks;
alter publication supabase_realtime add table members;
