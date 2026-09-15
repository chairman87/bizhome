-- 공지사항 · 공용계정 표 추가 — 이미 만든 저장소에 이 부분만 실행
create table if not exists notices (
  id         uuid primary key,
  title      text not null,
  content    text,
  pinned     boolean default false,       -- 목록 맨 위 고정
  reads      jsonb default '[]',          -- 읽은 사람 이름 목록
  created_by text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create table if not exists accounts (
  id         uuid primary key,
  service    text not null,               -- 서비스 이름
  url        text,                        -- 접속 주소
  login_id   text,
  password   text,
  purpose    text,                        -- 용도
  owner      text,                        -- 담당자
  memo       text,
  created_by text,
  created_at timestamptz default now(),
  updated_by text,
  updated_at timestamptz default now()
);
alter table notices  enable row level security;
alter table accounts enable row level security;
drop policy if exists "team_all" on notices;
drop policy if exists "team_all" on accounts;
create policy "team_all" on notices  for all using (true) with check (true);
create policy "team_all" on accounts for all using (true) with check (true);
alter publication supabase_realtime add table notices;
alter publication supabase_realtime add table accounts;
