-- 업무 매뉴얼 표 추가 — Supabase SQL Editor 에 붙여넣고 Run
create table if not exists manuals (
  id          uuid primary key,
  title       text not null,               -- 매뉴얼 제목 (예: 쿠팡 주문 취소 처리)
  category    text,                        -- 분류 (예: 주문·CS, 물류, 마케팅 …)
  content     text,                        -- 본문 (순서대로 적은 절차)
  link        text,                        -- 참고 링크
  files       jsonb default '[]',          -- 첨부 [{name,url,path,size,type}]
  targets     jsonb default '[]',          -- 볼 수 있는 담당자 이름들 (비어 있으면 전체)
  sort_order  int default 0,
  created_by  text,
  created_at  timestamptz default now(),
  updated_by  text,
  updated_at  timestamptz default now()
);
alter table manuals enable row level security;
drop policy if exists "team_all" on manuals;
create policy "team_all" on manuals for all using (true) with check (true);
alter publication supabase_realtime add table manuals;
