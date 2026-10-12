-- 상표 점검 결과 아래 질의응답 표 (2026-10-12) — Supabase SQL Editor 에 붙여넣고 Run
-- 한 줄 = 질문 하나. 인트라넷(tmcheck.html)에서 넣고, 대표 PC 의 TM-CHECK\watcher.py 가 '대기' 줄을 집어 그 점검 자료를 바탕으로 AI 변리사 답을 채운다
create table if not exists tm_check_qa (
  id          uuid primary key,
  check_id    uuid not null,              -- tm_checks.id (어느 점검 결과에 대한 질문인지)
  question    text not null,
  answer      text,
  asked_by    text,
  status      text default '대기',        -- 대기 / 진행중 / 완료 / 실패
  error       text,
  answered_at timestamptz,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);
alter table tm_check_qa enable row level security;
create policy "team_all" on tm_check_qa for all using (true) with check (true);
alter publication supabase_realtime add table tm_check_qa;
