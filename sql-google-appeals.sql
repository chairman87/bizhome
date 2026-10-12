-- 구글 이의신청내역 관리 표 — Supabase SQL Editor 에 붙여넣고 Run
create table if not exists google_appeals (
  id          uuid primary key,
  product     text not null,                 -- 서리맥스 / 흑생마
  ad_id       uuid,                          -- 광고 영상 리스트(ads)의 영상과 연결 (없어도 됨)
  title       text not null,                 -- 거절된 영상 이름
  url         text,                          -- 영상 주소 (유튜브 등, 선택)
  rejected_on date,                          -- 구글에서 거절된 날
  reason      text,                          -- 거절 사유 (건강 및 의약품 ...)
  status      text default '거절됨',          -- 거절됨 / 검토중 / 승인됨 / 다시 거절 / 포기
  appeals     jsonb default '[]',            -- 이의신청 기록 [{id, at(일시), by, note}]
  memo        text,
  created_by  text,
  created_at  timestamptz default now(),
  updated_by  text,
  updated_at  timestamptz default now()
);
alter table google_appeals enable row level security;
drop policy if exists "team_all" on google_appeals;
create policy "team_all" on google_appeals for all using (true) with check (true);
alter publication supabase_realtime add table google_appeals;
