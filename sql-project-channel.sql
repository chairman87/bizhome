-- 프로젝트 채널: 프로젝트(=채널)에 칸 추가 + 자료 카드·결정·읽음 표 (2026-10-03 실행)
-- 기존 표는 칸만 추가하고, 있던 자료는 건드리지 않음
alter table projects add column if not exists members jsonb default '[]';      -- 참여 팀원 이름들
alter table projects add column if not exists nas_path text;                   -- NAS 폴더 경로 (글자로만 보여 주고 복사)
alter table projects add column if not exists summary text;                    -- 맨 위 고정 요약 (현재 상태·다음 할 일)
alter table projects add column if not exists summary_by text;
alter table projects add column if not exists summary_at timestamptz;

create table if not exists project_cards (
  id          uuid primary key,
  project_id  uuid not null,
  title       text not null,                 -- 자료 제목
  kind        text default '기타',           -- 제안서 / 기획서 / 견적서 / 손익 시뮬레이션 / 기타
  memo        text,                          -- 작성자의 한마디
  status      text default '결정 대기',      -- 결정 대기 / 승인 / 보류 / 반려 / 참고 자료
  revisions   jsonb default '[]',            -- 수정본 [{no, memo, files:[…], by, at}]  (1차 = 처음 올린 것)
  comments    jsonb default '[]',            -- 댓글 [{id, by, text, at}]
  created_by  text,
  created_at  timestamptz default now(),
  updated_by  text,
  updated_at  timestamptz default now()
);
create table if not exists project_decisions (
  id          uuid primary key,
  project_id  uuid not null,
  card_id     uuid,                          -- 근거가 된 자료 카드 (자료 없이 정한 결정이면 비어 있음)
  status      text,                          -- 이 결정으로 카드가 바뀐 상태 (승인 / 보류 / 반려 …)
  body        text not null,                 -- 결정 한 줄
  reason      text,                          -- 이유
  decided_at  date,
  created_by  text,
  created_at  timestamptz default now(),
  updated_by  text,
  updated_at  timestamptz default now()
);
create table if not exists project_reads (
  id          text primary key,              -- 이름|프로젝트id
  member      text not null,
  project_id  uuid not null,
  seen        jsonb default '{}',            -- {카드id: 마지막으로 본 시각, _channel: 채널을 마지막으로 본 시각}
  updated_at  timestamptz default now()
);
alter table tasks     add column if not exists project_id uuid;                -- 업무에 프로젝트 선택 (선택 안 해도 됨)
alter table decisions add column if not exists project_id uuid;                -- 업무공유에 프로젝트 선택

alter table project_cards     enable row level security;
alter table project_decisions enable row level security;
alter table project_reads     enable row level security;
create policy "team_all" on project_cards     for all using (true) with check (true);
create policy "team_all" on project_decisions for all using (true) with check (true);
create policy "team_all" on project_reads     for all using (true) with check (true);
alter publication supabase_realtime add table project_cards;
alter publication supabase_realtime add table project_decisions;
alter publication supabase_realtime add table project_reads;
