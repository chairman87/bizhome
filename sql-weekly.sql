-- 주간 업무 리스트 (2026-11-20) — Supabase SQL Editor 에 붙여넣고 Run. 여러 번 실행해도 됩니다.
-- weekly_plans: 한 사람이 한 주에 한 줄. items = 그 주에 할 업무를 한 줄씩 적은 목록 ["…", "…"]
-- 적는 사람 명단은 settings 표 id='weekly' → value={people:[이름…]} (화면의 ⚙ 에서 관리자가 바꿈. 없으면 화면의 기본 명단)
create table if not exists weekly_plans (
  id          uuid primary key,
  week_start  date not null,               -- 그 주의 월요일
  author      text not null,               -- 담당자 이름
  items       jsonb default '[]',          -- 업무 내용, 한 줄에 하나
  created_by  text,
  created_at  timestamptz default now(),
  updated_by  text,
  updated_at  timestamptz default now()
);
alter table weekly_plans enable row level security;
drop policy if exists "team_all" on weekly_plans;
create policy "team_all" on weekly_plans for all using (true) with check (true);
do $$ begin
  alter publication supabase_realtime add table weekly_plans;   -- 남이 적은 내용이 바로 보이도록
exception when duplicate_object then null; end $$;
