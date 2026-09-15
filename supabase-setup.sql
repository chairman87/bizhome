-- ============================================================
-- 비즈홈: Supabase 저장소 준비 (한 번만 실행)
-- Supabase 화면 왼쪽 메뉴 "SQL Editor" > "New query" 에 전부 붙여넣고 Run
-- ============================================================

-- 1) 팀원
create table if not exists members (
  id         uuid primary key,
  name       text not null unique,
  color      text,
  sort_order int default 0,
  updated_at timestamptz default now()
);

-- 2) 내 업무함
create table if not exists tasks (
  id           uuid primary key,
  title        text not null,          -- 업무내용
  status       text not null default '내 업무',   -- 내 업무 / 회신대기 / 회신완료 / 완료
  start_date   date,                   -- 시작일자
  due_date     date,                   -- 마감기한
  assignee     text,                   -- 담당자 (업무를 책임지는 사람)
  recipient    text,                   -- 수신자 (요청을 받는 사람)
  memo         text,                   -- 비고
  comments     jsonb default '[]',     -- 댓글·회신·기록
  created_by   text,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now(),
  completed_at timestamptz
);

-- 3) 영업 미팅 현황 (들어온 DB)
create table if not exists leads (
  id           uuid primary key,
  company      text not null,          -- 회사명
  contact      text,                   -- 상대 담당자 / 연락처
  grade        text default 'warm',    -- 관심도: hot / warm / cold
  status       text not null default '대기중',   -- 대기중 / 미팅·협의중 / 계약 / 보류 / 거절
  owner        text,                   -- 우리 쪽 담당자
  budget       numeric,                -- 예산(원)
  meeting_date date,                   -- 미팅 일자
  website      text,
  source       text,                   -- 유입 경로
  memo         text,
  comments     jsonb default '[]',
  created_by   text,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

-- 4) 접근 권한: 링크(anon 키)를 가진 사람은 모두 읽고 쓸 수 있음 (소규모 팀 전제)
alter table members enable row level security;
alter table tasks   enable row level security;
alter table leads   enable row level security;
drop policy if exists "team_all" on members;
drop policy if exists "team_all" on tasks;
drop policy if exists "team_all" on leads;
create policy "team_all" on members for all using (true) with check (true);
create policy "team_all" on tasks   for all using (true) with check (true);
create policy "team_all" on leads   for all using (true) with check (true);

-- 5) 실시간 알림: 누가 바꾸면 다른 사람 화면도 바로 갱신
alter publication supabase_realtime add table members;
alter publication supabase_realtime add table tasks;
alter publication supabase_realtime add table leads;
