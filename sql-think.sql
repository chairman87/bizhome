-- ═══════════════════════════════════════════════════════════════
--  파고들기 (think.html) — 개인 전용 저장소
--
--  ※ 비즈홈의 다른 표들과 다릅니다.
--     다른 표는 "team_all" 규칙(using (true))이라 키만 있으면 누구나 읽힙니다.
--     이 표는 로그인한 본인(owner = auth.uid())만 읽고 쓸 수 있습니다.
--     팀원이 주소와 공개키를 알아도 내용은 볼 수 없습니다.
--
--  Supabase 대시보드 → SQL Editor 에 붙여넣고 Run 하세요.
-- ═══════════════════════════════════════════════════════════════

-- 1) 내용 저장 (사람마다 한 줄. 앱 내용 전체가 data 에 들어갑니다)
create table if not exists think_docs (
  owner      uuid primary key references auth.users(id) on delete cascade,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now()
);

-- 2) 지난 내용 보관 (실수로 지웠을 때 되돌리기용. 앱이 한 시간에 한 번 남깁니다)
create table if not exists think_history (
  id         uuid primary key,
  owner      uuid not null references auth.users(id) on delete cascade,
  data       jsonb not null,
  created_at timestamptz default now()
);
create index if not exists think_history_owner_time on think_history (owner, created_at desc);

-- 3) 접근 제한 — 본인 것만
alter table think_docs    enable row level security;
alter table think_history enable row level security;

drop policy if exists "own_only" on think_docs;
drop policy if exists "own_only" on think_history;

create policy "own_only" on think_docs
  for all
  using (owner = auth.uid())
  with check (owner = auth.uid());

create policy "own_only" on think_history
  for all
  using (owner = auth.uid())
  with check (owner = auth.uid());

-- 4) 로그인하지 않은 사람에게는 아무 권한도 주지 않습니다
revoke all on think_docs    from anon;
revoke all on think_history from anon;
grant select, insert, update, delete on think_docs    to authenticated;
grant select, insert, update, delete on think_history to authenticated;

-- 확인용: 아래를 실행하면 두 표 모두 rowsecurity = true 여야 합니다
-- select tablename, rowsecurity from pg_tables where tablename in ('think_docs','think_history');
