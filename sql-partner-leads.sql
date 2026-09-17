-- 파트너스 컨택 후보 리스트 표 추가 — Supabase SQL Editor 에 붙여넣고 Run
create table if not exists partner_leads (
  id           uuid primary key,
  owner        text,                        -- 담당 팀원
  contact_date date,                        -- 컨택일
  method       text,                        -- 컨택방법 (DM/메일)
  quote        text,                        -- 수령 견적/협의 견적
  handle       text not null,               -- 계정명
  name         text,
  profile_url  text,
  followers    numeric default 0,
  job          text,                        -- 직업/특징
  contact      text,                        -- 연락처
  note         text,                        -- 참고
  opinion      text,                        -- 의견
  status       text default '검토중',       -- 검토중/컨택함/진행 결정/보류/리스트 제외/중복/완료
  created_by   text,
  created_at   timestamptz default now(),
  updated_by   text,
  updated_at   timestamptz default now()
);
alter table partner_leads enable row level security;
drop policy if exists "team_all" on partner_leads;
create policy "team_all" on partner_leads for all using (true) with check (true);
alter publication supabase_realtime add table partner_leads;
