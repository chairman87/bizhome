-- 업무 > 알람 (회사 운영 중 생기는 알람 메시지를 모으는 곳) 표 추가 — Supabase SQL Editor 에 붙여넣고 Run
-- 알람은 대표 PC 의 점검 프로그램(META-COMMENTS\health.py 등)이 넣음. 이상이 풀리면 같은 줄의 status 가 '해소'로 바뀜.
create table if not exists alarms (
  id           uuid primary key,
  source       text,                        -- 어디서 온 알람인지: 메타·인스타 / (앞으로) 매출, 결제, 구독 …
  level        text default '이상',          -- 이상 / 안내
  title        text not null,               -- 한 줄 제목
  body         text,                        -- 자세한 내용
  issue_key    text,                        -- 같은 이상을 구분하는 번호 (프로그램이 씀)
  status       text default '발생',          -- 발생 / 해소 / 안내
  resolved_at  timestamptz,                 -- 풀린 시각
  reads        jsonb default '[]',          -- 확인한 사람 이름
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);
alter table alarms enable row level security;
drop policy if exists "team_all" on alarms;
create policy "team_all" on alarms for all using (true) with check (true);
alter publication supabase_realtime add table alarms;
