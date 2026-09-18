-- 회의록 표 추가 — Supabase SQL Editor 에 붙여넣고 Run
create table if not exists meetings (
  id           uuid primary key,
  title        text not null,               -- 회의 제목
  meeting_date date,                        -- 일자
  start_time   text,                        -- 시간
  attendees    text,                        -- 참석자
  category     text,                        -- 주간회의 / 제품·생산 / 마케팅 / 경영·재무 / 기타
  summary      text,                        -- 요약 (위)
  decisions    text,                        -- 결정 사항
  details      text,                        -- 상세 내용 (아래)
  actions      jsonb default '[]',          -- 할 일 [{text, who, due, done}]
  files        jsonb default '[]',          -- 첨부 (플라우드 PDF, 녹음 파일)
  plaud_url    text,                        -- 플라우드 링크
  memo         text,
  created_by   text,
  created_at   timestamptz default now(),
  updated_by   text,
  updated_at   timestamptz default now()
);
alter table meetings enable row level security;
drop policy if exists "team_all" on meetings;
create policy "team_all" on meetings for all using (true) with check (true);
alter publication supabase_realtime add table meetings;
