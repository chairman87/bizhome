-- 업무기술서 표 (jobs.html, 2026-11-24) — Supabase SQL Editor 에서 한 번 실행 (sql-lock-tables-1.sql 의 lk_ok 목록에 job_descs 가 들어간 뒤)
-- 직무 하나가 한 줄. 사람이 바뀌어도 그 자리의 일·걸리는 시간·소통 상대가 남게 하려는 표
create table if not exists job_descs (
  id            uuid primary key,
  title         text not null,               -- 직무명 (예: 물류지원)
  dept          text,                        -- 부서
  holder        text,                        -- 지금 담당자 이름
  backup        text,                        -- 대신 할 수 있는 사람
  status        text default '재직',          -- 재직 / 인수인계 중 / 채용 중 / 공석
  summary       text,                        -- 한 줄 설명
  duties        jsonb default '[]',          -- [{name,cycle,hours(주당),level,how,tools,with,caution}]
  contacts      jsonb default '[]',          -- [{org,who,about,freq}]
  requirements  text,                        -- 채용 요건
  onboarding    text,                        -- 인수인계 순서
  note          text,
  verified_by   text,                        -- 내용을 확인한 담당자
  verified_at   timestamptz,
  sort_order    int default 0,
  created_by    text,
  created_at    timestamptz default now(),
  updated_by    text,
  updated_at    timestamptz default now()
);
-- 잠긴 표: 공개키로는 읽기·쓰기가 모두 안 되고, 로그인 출입증을 확인하는 공용 함수 lk_*(sql-lock-tables-1.sql)만 엽니다
alter table job_descs enable row level security;
drop policy if exists "team_all" on job_descs;
revoke all on job_descs from anon, authenticated;
-- 내용(직무별 초안)은 이 저장소가 공개라 여기 넣지 않습니다. 화면에서 적거나 SQL Editor 에서 직접 넣습니다.

