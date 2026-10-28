-- 비즈홈 > 자동작업 > 대화 (클로드와 대화하며 고치기) 표 2개 — Supabase SQL Editor 에 붙여넣고 Run (한 번만. 다시 돌려도 안전). 2026-10-28
-- sql-routines.sql 을 먼저 실행한 뒤에 실행합니다.

-- 1) 대화 (한 줄 = 대화 하나. 대상 하나를 두고 여러 메시지를 주고받음)
create table if not exists routine_chats (
  id              uuid primary key,
  target          text,                      -- '인트라넷' 또는 routines.key
  target_label    text,                      -- 화면에 보일 대상 이름
  title           text,                      -- 첫 메시지에서 딴 제목
  author          text,                      -- 대화를 연 사람
  status          text default '열림',        -- 열림 / 반영대기(반영 요청 올라감) / 반영완료 / 닫힘
  branch          text,                      -- lemon803 의 작업용 복사본 이름(chat-xxxxxxxx). 고친 게 쌓이는 곳
  session_id      text,                      -- lemon803 클로드의 대화 세션 번호(앞 내용을 기억하는 열쇠)
  changed_files   jsonb default '[]',        -- 복사본에 쌓인, 아직 반영 전인 바뀐 파일
  diff_stat       text,
  commits         int default 0,             -- 복사본에 저장된 수정 횟수
  request_id      uuid,                      -- 반영 요청(routine_requests) 번호
  last_message_at timestamptz,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);
alter table routine_chats enable row level security;
drop policy if exists "team_all" on routine_chats;
create policy "team_all" on routine_chats for all using (true) with check (true);

-- 2) 대화 메시지 (한 줄 = 말 한 마디. role: user=사람, claude=클로드의 답, system=안내)
create table if not exists routine_chat_messages (
  id              uuid primary key,
  chat_id         uuid not null,
  role            text,                      -- user / claude / system
  author          text,
  text            text,
  status          text default '완료',        -- 사람 메시지: 대기 → 처리중 → 완료 / 실패 (lemon803 의 chat_worker.py 가 바꿈)
  error           text,
  changed_files   jsonb default '[]',        -- 이 답에서 바뀐 파일
  started_at      timestamptz,
  finished_at     timestamptz,
  created_at      timestamptz default now()
);
create index if not exists routine_chat_messages_chat_idx on routine_chat_messages (chat_id, created_at);
alter table routine_chat_messages enable row level security;
drop policy if exists "team_all" on routine_chat_messages;
create policy "team_all" on routine_chat_messages for all using (true) with check (true);

-- 3) 수정요청 표에 "어느 대화에서 온 반영 요청인지" 칸
alter table routine_requests add column if not exists chat_id uuid;

-- 실시간 갱신
do $$ begin
  begin alter publication supabase_realtime add table routine_chats; exception when others then null; end;
  begin alter publication supabase_realtime add table routine_chat_messages; exception when others then null; end;
end $$;
