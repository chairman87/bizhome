-- 이달의 목표 표 (홈 화면 업무공유 아래) — 2026-10-03 실행 완료
create table if not exists goals (
  id uuid primary key,
  month text not null unique,           -- 'YYYY-MM'
  items jsonb default '[]',            -- [{text, done}]
  note text,                           -- 덧붙이는 말
  created_by text,
  created_at timestamptz default now(),
  updated_by text,
  updated_at timestamptz default now()
);
alter table goals enable row level security;
drop policy if exists "team_all" on goals;
create policy "team_all" on goals for all using (true) with check (true);
alter publication supabase_realtime add table goals;
