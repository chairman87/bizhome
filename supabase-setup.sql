-- ============================================================
-- 비즈홈: Supabase 저장소 준비 (한 번만 실행)
-- Supabase 화면 왼쪽 메뉴 "SQL Editor" > "New query" 에 전부 붙여넣고 Run
-- ============================================================

-- 1) 팀원
create table if not exists members (
  id          uuid primary key,
  name        text not null unique,
  color       text,
  sort_order  int default 0,
  role        text default 'member',   -- admin(관리자) / member(팀원)
  leave_total numeric default 15,      -- 연차 총 일수
  password    text,                    -- 로그인 비밀번호 (관리자가 볼 수 있음)
  updated_at  timestamptz default now()
);
-- 이미 만든 저장소에 비밀번호 칸만 추가할 때는 아래 한 줄만 실행
alter table members add column if not exists password text;

-- 2) 비즈홈 메뉴 (부서와 페이지. 관리자가 화면에서 편집)
create table if not exists menu (
  id         uuid primary key,
  type       text not null,             -- dept(부서) / page(페이지)
  parent     uuid,                      -- 페이지가 속한 부서 id
  name       text not null,
  icon       text,
  color      text,                      -- 부서 색 이름
  href       text,                      -- 누르면 열리는 화면 (없으면 준비 중)
  sort_order int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 3) 업무요청/보고
create table if not exists tasks (
  id           uuid primary key,
  title        text not null,                  -- 업무
  assignee     text,                           -- 담당자
  priority     text default '보통',            -- 높음 / 보통 / 낮음
  start_date   date,
  due_date     date,                           -- 마감일
  status       text not null default '요청',   -- 요청 / 진행중 / 보고완료 / 완료 / 보류
  progress     int default 0,                  -- 진행률 0~100
  memo         text,                           -- 요청 내용
  comments     jsonb default '[]',             -- 보고·댓글·변경 기록
  created_by   text,                           -- 요청자
  created_at   timestamptz default now(),
  updated_at   timestamptz default now(),
  completed_at timestamptz
);

-- 4) 연차/휴가
create table if not exists leaves (
  id         uuid primary key,
  name       text not null,                    -- 신청자
  type       text not null,                    -- 연차 / 오전 반차 / 오후 반차 / 병가 / 경조사 / 기타
  start_date date not null,
  end_date   date,
  days       numeric default 1,                -- 일수 (토·일 제외)
  reason     text,
  status     text not null default '신청',     -- 신청 / 승인 / 반려 / 취소
  decided_by text,                             -- 승인·반려한 관리자
  decided_at timestamptz,
  comments   jsonb default '[]',
  created_by text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 4-2) 업무 분장 (R&R) — 버전별로 쌓임
create table if not exists rnr (
  id             uuid primary key,
  version        int not null,                -- 1, 2, 3 ...
  title          text not null,               -- 예: 9월 업무 분장
  effective_date date,                        -- 적용일
  note           text,                        -- 변경 요약
  teams          jsonb default '[]',          -- [{name, rows:[{name, duties}]}]
  footer         text,                        -- 하단 안내문
  created_by     text,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

-- 5) 접근 권한: 링크(anon 키)를 가진 사람은 모두 읽고 쓸 수 있음 (소규모 팀 전제)
alter table members enable row level security;
alter table menu    enable row level security;
alter table tasks   enable row level security;
alter table leaves  enable row level security;
alter table rnr     enable row level security;
drop policy if exists "team_all" on members;
drop policy if exists "team_all" on menu;
drop policy if exists "team_all" on tasks;
drop policy if exists "team_all" on leaves;
drop policy if exists "team_all" on rnr;
create policy "team_all" on members for all using (true) with check (true);
create policy "team_all" on menu    for all using (true) with check (true);
create policy "team_all" on tasks   for all using (true) with check (true);
create policy "team_all" on leaves  for all using (true) with check (true);
create policy "team_all" on rnr     for all using (true) with check (true);

-- 6) 실시간 알림: 누가 바꾸면 다른 사람 화면도 바로 갱신
alter publication supabase_realtime add table members;
alter publication supabase_realtime add table menu;
alter publication supabase_realtime add table tasks;
alter publication supabase_realtime add table leaves;
alter publication supabase_realtime add table rnr;
