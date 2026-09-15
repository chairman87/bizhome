-- 업무 분장(R&R) 표 추가 — 이미 만든 저장소에 이 부분만 실행
create table if not exists rnr (
  id             uuid primary key,
  version        int not null,
  title          text not null,
  effective_date date,
  note           text,
  teams          jsonb default '[]',
  footer         text,
  created_by     text,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);
alter table rnr enable row level security;
drop policy if exists "team_all" on rnr;
create policy "team_all" on rnr for all using (true) with check (true);
alter publication supabase_realtime add table rnr;
