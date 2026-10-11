-- 상표 점검 로봇 표 추가 — Supabase SQL Editor 에 붙여넣고 Run (2026-10-11)
-- tm_checks: 점검 요청 한 줄 = 상표 이름 하나. 인트라넷(tmcheck.html)이나 텔레그램("상표 29류 흑비담")에서 넣고,
--            대표 PC 의 TM-CHECK\watcher.py 가 '대기' 줄을 집어 키프리스·네이버·구글을 읽은 뒤 result(점수·걱정되는 점·근거)를 채운다
create table if not exists tm_checks (
  id           uuid primary key,
  name         text not null,              -- 점검할 상표명 (예: 흑비담)
  alias        text,                       -- 영문·다른 표기 (예: HEUKBIDAM)
  classes      text,                       -- 상품류 (예: 29,05)
  goods        text,                       -- 지정상품 메모 (예: 흑염소 진액, 비타민)
  memo         text,                       -- 요청할 때 적은 메모
  requested_by text,                       -- 요청한 사람 이름
  via          text default 'web',         -- web(인트라넷) / telegram
  tg_chat      text,                       -- 텔레그램으로 요청했으면 그 대화창 번호 (결과를 거기로 보냄)
  status       text default '대기',        -- 대기 / 진행중 / 완료 / 실패
  score        integer,                    -- 등록 가능성 점수 0~100
  risk         integer,                    -- 침해 위험 점수 0~100
  summary      text,                       -- 짧은 결과 글 (텔레그램에 보낸 것과 같음)
  result       jsonb,                      -- 전체 결과 (걱정되는 점, 키프리스·네이버·구글 근거)
  error        text,                       -- 실패했을 때 이유
  seen         boolean default false,      -- 요청한 사람이 결과를 열어 봤는지 (홈 배지용)
  started_at   timestamptz,
  finished_at  timestamptz,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);
alter table tm_checks enable row level security;
drop policy if exists "team_all" on tm_checks;
create policy "team_all" on tm_checks for all using (true) with check (true);
alter publication supabase_realtime add table tm_checks;

-- 로봇이 켜져 있다는 신호 (id='watch', 1분마다 synced_at 갱신) — 화면 위에 🟢/🔴 표시용
create table if not exists tm_check_sync (
  id         text primary key,
  synced_at  timestamptz,
  summary    jsonb default '{}',
  updated_at timestamptz default now()
);
alter table tm_check_sync enable row level security;
drop policy if exists "team_all" on tm_check_sync;
create policy "team_all" on tm_check_sync for all using (true) with check (true);
alter publication supabase_realtime add table tm_check_sync;
