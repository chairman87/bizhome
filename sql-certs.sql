-- 인사/재무 > 재직증명서 요청 표 (2026-10-14) — Supabase SQL Editor 에 붙여넣고 Run
-- 팀원이 요청 → 관리자가 입사일·직위로 표준 양식 증명서를 만들어(직인은 발급 PC 에만 저장) PDF 로 전달
create table if not exists cert_requests (
  id            uuid primary key,
  name          text not null,                -- 요청한 팀원
  company       text,                         -- 소속 회사: 식이해법연구소 / (주)피에이치뷰티
  dept          text,                         -- 소속 부서 (선택)
  birth         text,                         -- 생년월일
  address       text,                         -- 주소 (선택)
  purpose       text,                         -- 용도 (예: 은행 제출용)
  submit_to     text,                         -- 제출처
  copies        int default 1,                -- 부수
  memo          text,                         -- 요청 메모
  status        text default '요청',          -- 요청 / 발급 / 반려
  title         text,                         -- 발급 때 쓴 직위
  hire_date     date,                         -- 발급 때 쓴 입사일
  issue_no      text,                         -- 발급번호 (예: 2026-001)
  files         jsonb default '[]',           -- 발급한 PDF
  issued_by     text,
  issued_at     timestamptz,
  reject_reason text,
  downloaded_at timestamptz,                  -- 요청한 팀원이 내려받은 때
  created_by    text,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);
alter table cert_requests enable row level security;
drop policy if exists "team_all" on cert_requests;
create policy "team_all" on cert_requests for all using (true) with check (true);
alter publication supabase_realtime add table cert_requests;
