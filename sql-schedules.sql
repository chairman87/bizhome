-- 연차/휴가 달력의 개인 일정 표 추가 (2026-10-13) — Supabase SQL Editor 에 붙여넣고 Run
-- 날짜를 누르면 본인 일정을 넣고, 볼 사람(viewers)을 고름. 화면은 작성자 + viewers 에 든 사람(또는 '전체')에게만 보여 줌.
create table if not exists schedules (
  id          uuid primary key,
  owner       text not null,                 -- 일정 주인(작성자 이름)
  title       text not null,                 -- 일정 제목
  start_date  date not null,
  end_date    date,
  time_text   text,                          -- 시간 (예: 14:00, 오후) — 선택
  memo        text,
  viewers     jsonb default '[]',            -- 볼 사람 이름 목록. ["전체"] 면 모두. 비어 있으면 나만
  created_by  text,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);
alter table schedules enable row level security;
drop policy if exists "team_all" on schedules;
create policy "team_all" on schedules for all using (true) with check (true);
alter publication supabase_realtime add table schedules;

-- 2026-10-13: 참석자 (실행 완료)
alter table schedules add column if not exists attendees jsonb default '[]';
