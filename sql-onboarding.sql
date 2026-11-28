-- 온보딩 표 (onboarding.html, 2026-11-28) — Supabase SQL Editor 에서 한 번 실행 (sql-lock-tables-1.sql 의 lk_ok 목록에 onboarding 이 들어간 뒤)
-- 신규 입사자 한 사람이 한 줄. 챙길 것(서류 · 계약서 · 장비 · 4대보험 등)을 체크해 둠. 인사 전용 화면의 "신규 체크리스트"를 옮겨 온 것
-- 인사 전용 창고(연봉이 든 곳)와는 연결하지 않음. 여기에는 이름 · 회사 · 입사일 · 체크만 둠
create table if not exists onboarding (
  id          uuid primary key,
  name        text not null,               -- 새로 온 사람 이름
  company     text,                        -- 식이해법연구소 / 피에이치뷰티
  start_date  date,                        -- 입사일
  checks      jsonb default '{}',          -- {"a1": true, ...} 체크한 항목만. 항목 목록은 onboarding.html 의 CHECKS
  created_by  text,
  created_at  timestamptz default now(),
  updated_by  text,
  updated_at  timestamptz default now()
);
-- 잠긴 표: 공개키로는 읽기·쓰기가 모두 안 되고, 로그인 출입증을 확인하는 공용 함수 lk_*(sql-lock-tables-1.sql)만 엽니다
alter table onboarding enable row level security;
drop policy if exists "team_all" on onboarding;
revoke all on onboarding from anon, authenticated;

-- 공용 함수가 이 표를 받게 함 (sql-lock-tables-1.sql 과 같은 내용)
create or replace function lk_ok(p_table text) returns boolean language sql immutable as $$
  select p_table in ('payments', 'contractors', 'contractor_pays', 'subscriptions', 'quotes', 'partners', 'job_descs', 'samples', 'partner_leads', 'onboarding')
$$;

-- 메뉴: 인사/재무 > 온보딩 (운영진과 관리자에게 보임. 메뉴 편집에서 바꿀 수 있음). 이미 있으면 넣지 않음
insert into menu (id, type, parent, name, icon, href, allowed, sort_order, created_at)
select gen_random_uuid(), 'page', d.id, '온보딩', '🧭', 'onboarding.html', '["@운영진"]'::jsonb,
       (select coalesce(max(sort_order), -1) + 1 from menu where parent = d.id), now()
  from menu d where d.type <> 'page' and d.name = '인사/재무'
   and not exists (select 1 from menu where href = 'onboarding.html');

select (select count(*) from onboarding) as people, lk_ok('onboarding') as locked_ok, (select count(*) from menu where href = 'onboarding.html') as menu_rows;
