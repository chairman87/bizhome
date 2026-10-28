-- 비즈홈 > 자동작업 (lemon803 자동작업 현황·결과·수정요청) 표 3개 — Supabase SQL Editor 에 붙여넣고 Run (한 번만. 다시 돌려도 안전)
-- 이 파일은 ROUTINE-BOARD\make_sql.py 가 routines.json 에서 만듭니다. 작업 목록은 화면(관리자)에서도 고칠 수 있습니다.

-- 1) 작업 목록 (한 줄 = 자동작업 하나)
create table if not exists routines (
  id            uuid primary key,
  key           text unique not null,        -- 작업 구분 이름(영문). 보고 프로그램(report.py)이 이 이름으로 결과를 넣음
  title         text not null,               -- 화면에 보이는 이름
  kind          text,                        -- 스케줄러 / 클로드 / 상시 / 예정
  schedule      text,                        -- 사람이 읽는 주기
  description   text,
  admin_only    boolean default false,       -- 관리자만 보기(매출·손익·자금 숫자가 드는 작업)
  expect_hours  int default 0,               -- 이 시간 안에 한 번은 돌아야 정상(0=확인 안 함)
  owner         text,                        -- 담당자 이름
  repo_path     text,                        -- lemon803 에서 수정요청 처리기가 고칠 폴더
  edit_scope    text,                        -- 그 폴더 안에서 고쳐도 되는 범위
  report        text,                        -- 결과 보고 연결 방식(cmd/skill/ps1/none)
  enabled       boolean default true,
  sort_order    int default 0,
  last_status   text,                        -- 최근 결과(성공/실패/경고) — report.py 가 복사해 둠
  last_run_at   timestamptz,
  last_summary  text,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);
alter table routines enable row level security;
drop policy if exists "team_all" on routines;
create policy "team_all" on routines for all using (true) with check (true);

-- 2) 실행 기록 (한 줄 = 한 번 실행한 결과. report.py 가 넣음)
create table if not exists routine_runs (
  id            uuid primary key,
  routine_key   text not null,
  status        text,                        -- 성공 / 실패 / 경고
  summary       text,                        -- 한두 줄 보고
  detail        text,                        -- 긴 로그(없어도 됨)
  started_at    timestamptz,
  finished_at   timestamptz default now(),
  created_at    timestamptz default now()
);
create index if not exists routine_runs_key_idx on routine_runs (routine_key, created_at desc);
alter table routine_runs enable row level security;
drop policy if exists "team_all" on routine_runs;
create policy "team_all" on routine_runs for all using (true) with check (true);

-- 3) 수정요청 (한 줄 = 요청 하나. 처리기(process_requests.py)가 상태를 바꿈)
create table if not exists routine_requests (
  id            uuid primary key,
  target        text,                        -- '인트라넷' 또는 routines.key
  target_label  text,                        -- 화면에 보일 대상 이름
  title         text,
  body          text,
  requester     text,
  status        text default '요청',          -- 요청 / 처리중 / 검토대기 / 승인 / 반영완료 / 반려 / 실패
  result        text,                        -- 클로드가 쓴 "바꾼 내용" 요약(또는 못 한 이유)
  changed_files jsonb default '[]',
  diff_stat     text,
  branch        text,                        -- 작업용 복사본 이름(req-xxxxxxxx)
  commit        text,
  error         text,
  reviewer      text,                        -- 승인/반려한 사람
  reviewed_at   timestamptz,
  review_note   text,
  comments      jsonb default '[]',          -- [{by, text, at}]
  processed_at  timestamptz,
  applied_at    timestamptz,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);
alter table routine_requests enable row level security;
drop policy if exists "team_all" on routine_requests;
create policy "team_all" on routine_requests for all using (true) with check (true);

-- 실시간 갱신(화면이 바로 바뀌게). 이미 등록돼 있으면 오류가 나므로 각 줄을 따로 실행하거나 오류는 무시
do $$ begin
  begin alter publication supabase_realtime add table routines; exception when others then null; end;
  begin alter publication supabase_realtime add table routine_runs; exception when others then null; end;
  begin alter publication supabase_realtime add table routine_requests; exception when others then null; end;
end $$;

-- 4) 처음 작업 목록 (이미 있는 key 는 건드리지 않음)
insert into routines (id, key, title, kind, schedule, description, admin_only, expect_hours, repo_path, edit_scope, report, sort_order) values
  (gen_random_uuid(), 'sales-watch', '매출 경보기 (급감 감지)', '스케줄러', '30분마다', '브랜드×채널 매출이 평소보다 -30%/-50% 급감하면 텔레그램으로 알림', true, 2, 'C:\Users\PC\Desktop\클로드코드\SALES-WATCH', 'watch.py 와 그 설정 파일. wing.py(Aside 브라우저) 는 고치지 않음', 'cmd', 10),
  (gen_random_uuid(), 'sales-report', '매출 경보기 3시간 매출 보고', '스케줄러', '09·12·15·18·21시', '브랜드×채널 매출을 3시간마다 텔레그램으로 보고', true, 4, 'C:\Users\PC\Desktop\클로드코드\SALES-WATCH', 'report.py 와 그 설정 파일', 'cmd', 20),
  (gen_random_uuid(), 'sales-brief', '매출 경보기 전날 마감 보고', '스케줄러', '매일 01:00', '전날 매출·영업이익 마감을 텔레그램으로 보고', true, 26, 'C:\Users\PC\Desktop\클로드코드\SALES-WATCH', 'brief.py 와 그 설정 파일', 'cmd', 30),
  (gen_random_uuid(), 'coupang-winner', '쿠팡 아이템위너 감시', '스케줄러', '매시 20분', '쿠팡윙에서 아이템위너를 빼앗기거나 되찾으면 텔레그램으로 알림', false, 3, 'C:\Users\PC\Desktop\클로드코드\SALES-WATCH', 'winner.py 와 그 설정 파일', 'cmd', 40),
  (gen_random_uuid(), 'ads-comment-digest', '광고·댓글 3시간 알림', '스케줄러', '09·12·15·18·21시 02분', '메타 거절·틱톡 게재 멈춤·이상 댓글을 텔레그램으로 알림 (결과 보고는 아직 연결 안 됨: 스케줄러가 파이썬을 직접 실행)', false, 0, 'C:\Users\PC\Desktop\클로드코드\META-COMMENTS', 'digest.py 와 그 설정 파일', 'none', 50),
  (gen_random_uuid(), 'meta-watcher-keep', '메타 댓글 감시 되살리기', '스케줄러', '10분마다', '댓글 감시 프로그램이 죽어 있으면 다시 켬 (너무 자주 돌아 결과 보고는 하지 않음)', false, 0, null, null, 'none', 60),
  (gen_random_uuid(), 'ads-sync', '광고 영상 리스트 자동 반영', '스케줄러', '매일 10:00', '인트라넷 광고 영상 리스트를 메타·구글애즈와 맞춤', false, 26, 'C:\Users\PC\Desktop\클로드코드\ADS-SYNC', 'ads_sync.py 와 그 설정 파일', 'cmd', 70),
  (gen_random_uuid(), 'intranet-backup', '인트라넷 자동 백업', '스케줄러', '매일 12:30', '비즈홈(Supabase) 내용과 첨부 파일을 NAS 로 백업', false, 26, 'C:\Users\PC\Desktop\클로드코드\INTRANET-BACKUP', 'backup.py', 'cmd', 80),
  (gen_random_uuid(), 'plaud-notes-save', '플라우드 개인녹음 자동저장', '스케줄러', '30분마다', '플라우드 개인 녹음을 PC 에 저장', false, 2, 'C:\Users\PC\Desktop\클로드코드\PLAUD-NOTES', 'sync.js 와 그 설정 파일', 'cmd', 90),
  (gen_random_uuid(), 'github-backup', '클로드코드 GitHub 자동 백업', '스케줄러', '매일 03:00', '클로드코드 폴더의 저장소들을 GitHub 비공개 저장소로 올림', false, 26, null, null, 'ps1', 100),
  (gen_random_uuid(), 'request-processor', '수정요청 처리기', '스케줄러', '10분마다 (처리한 게 있을 때만 기록)', '이 화면의 수정요청을 클로드가 처리하고, 승인된 것을 반영. 10분마다 GitHub 의 최신 ROUTINE-BOARD 도 받음', false, 0, 'C:\Users\PC\Desktop\클로드코드\ROUTINE-BOARD', 'process_requests.py·chat_worker.py·report.py·routines.json·auto-process.cmd·auto-chat.cmd', 'none', 110),
  (gen_random_uuid(), 'chat-worker', '대화 처리기 (클로드와 대화)', '상시', '항상 (5분마다 살아 있는지 확인)', '이 화면의 ''대화'' 탭 메시지에 클로드가 답하고 파일을 고침 (10분마다 ''살아 있음''을 남김. 1시간 넘게 없으면 늦음)', false, 1, 'C:\Users\PC\Desktop\클로드코드\ROUTINE-BOARD', 'chat_worker.py', 'self', 120),
  (gen_random_uuid(), 'sik-hourly-refresh', '식이해법 손익상황판', '클로드', '매일 00:30', '어제 매출·광고비 확정 → SIK-DASH 상황판·아티팩트 갱신', true, 26, 'C:\Users\PC\.claude\scheduled-tasks', 'sik-hourly-refresh 폴더의 SKILL.md 만', 'skill', 130),
  (gen_random_uuid(), 'ph-beauty-hourly-refresh', '피에이치뷰티 손익상황판', '클로드', '매일 00:35', '어제 매출·광고비 확정 → PH-DASH 상황판·아티팩트 갱신', true, 26, 'C:\Users\PC\.claude\scheduled-tasks', 'ph-beauty-hourly-refresh 폴더의 SKILL.md 만', 'skill', 140),
  (gen_random_uuid(), 'sik-finance-hourly-refresh', '식이해법 재무상황판(자금일보)', '클로드', '매일 07:00', '은행·카드 문자를 읽어 SIK-FINANCE 갱신', true, 26, 'C:\Users\PC\.claude\scheduled-tasks', 'sik-finance-hourly-refresh 폴더의 SKILL.md 만', 'skill', 150),
  (gen_random_uuid(), 'ph-finance-hourly-refresh', '피에이치뷰티 재무상황판(자금일보)', '클로드', '매일 07:05', '은행·카드 문자를 읽어 PH-FINANCE 갱신', true, 26, 'C:\Users\PC\.claude\scheduled-tasks', 'ph-finance-hourly-refresh 폴더의 SKILL.md 만', 'skill', 160),
  (gen_random_uuid(), 'plaud-notes-sync', '녹음_개인 요약', '클로드', '09~18시 매시', '개인 플라우드 녹음 요약 → 개인 녹음 상황판 아티팩트', false, 20, 'C:\Users\PC\.claude\scheduled-tasks', 'plaud-notes-sync 폴더의 SKILL.md 만', 'skill', 170),
  (gen_random_uuid(), 'plaud-meetings-sync', '녹음_회의 → 회의록 등록', '클로드', '09~18시 30분마다', '회의 녹음을 정리해 비즈홈 회의록에 자동 등록', false, 20, 'C:\Users\PC\.claude\scheduled-tasks', 'plaud-meetings-sync 폴더의 SKILL.md 만', 'skill', 180),
  (gen_random_uuid(), 'ads-list-meta-sync', '자동_영상리스트(클로드)', '클로드', '매일 10:00', '광고 영상 리스트를 메타·틱톡·구글애즈와 맞추고 바뀐 점 보고', false, 26, 'C:\Users\PC\.claude\scheduled-tasks', 'ads-list-meta-sync 폴더의 SKILL.md 만', 'skill', 190),
  (gen_random_uuid(), 'tiktok-scope-approval-check', '틱톡 권한 심사 확인', '클로드', '매일 10:30', '틱톡 앱 권한 심사가 끝났는지 확인 → 텔레그램', false, 26, 'C:\Users\PC\.claude\scheduled-tasks', 'tiktok-scope-approval-check 폴더의 SKILL.md 만', 'skill', 200),
  (gen_random_uuid(), 'tiktok-partial-delivery-alert', '틱톡 부분 게재 알림', '클로드', '09·12·15·18·21시 05분', '틱톡 부분 게재(검토 문제) 광고를 읽어 새로 걸린 것만 텔레그램으로 알림', false, 4, 'C:\Users\PC\.claude\scheduled-tasks', 'tiktok-partial-delivery-alert 폴더의 SKILL.md 만', 'skill', 210),
  (gen_random_uuid(), 'brand-watch-weekly', '경쟁사 브랜드 검색수(주간)', '클로드', '매주 월 09:00', '감시 회사 8곳의 브랜드·검색수를 조사해 아티팩트 갱신', false, 170, 'C:\Users\PC\.claude\scheduled-tasks', 'brand-watch-weekly 폴더의 SKILL.md 만', 'skill', 220),
  (gen_random_uuid(), 'rocket-growth-daily', '레모너리 로켓그로스 점검 보고', '클로드', '매일 08:00', '로켓그로스 입고 전후의 쿠팡 주문·매출·광고비·이익 비교 보고 (2026-10-28 기준 Bongsu PC 에서 돎)', true, 26, 'C:\Users\PC\.claude\scheduled-tasks', 'rocket-growth-daily 폴더의 SKILL.md 만', 'skill', 230),
  (gen_random_uuid(), 'meta-comment-watcher', '메타 댓글 즉시처리(상시)', '상시', '로그인하면 계속 실행', '메타·인스타 댓글을 7~12초 안에 처리, 30분마다 계정 이상 점검', false, 0, 'C:\Users\PC\Desktop\클로드코드\META-COMMENTS', 'watcher.py·comments.py 와 설정 파일', 'none', 240),
  (gen_random_uuid(), 'sik-tax-settlement', '식이해법 정산세금', '클로드', '매일 00:30 (손익상황판 작업 끝에)', '손익상황판 숫자로 종합소득세·부가세·광고비 계약 지급을 계산해 ''식이해법_정산_세금'' 아티팩트 갱신 (SIK-DASH 의 dan.py, 손익상황판 작업이 같이 돌림)', true, 26, 'C:\Users\PC\Desktop\클로드코드\SIK-DASH', 'dan.py 만 (세율·지급 완료 달·고정값은 dan.py 위쪽 상수). 다른 파일은 읽기만', 'self', 250),
  (gen_random_uuid(), 'ph-tax-settlement', '피에이치뷰티 정산세금', '클로드', '매일 00:35 (손익상황판 작업 안에서)', '회계 기준 월별 손익과 법인세 추정 → ''피에이치뷰티_정산_세금'' 아티팩트 갱신 (PH-DASH 의 corp.py, 손익상황판 작업이 같이 돌림)', true, 26, 'C:\Users\PC\Desktop\클로드코드\PH-DASH', 'corp.py 와 settings.json 의 법인세 항목만. 다른 파일은 읽기만', 'self', 260)
on conflict (key) do nothing;
