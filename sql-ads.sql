-- 광고 영상 리스트 표 추가 — 이미 만든 저장소에 이 부분만 실행
create table if not exists ads (
  id           uuid primary key,
  product      text not null,              -- 레모너리 / 서리맥스 / 흑생마
  date         date,                       -- 게재일
  title        text not null,              -- 영상 타이틀
  editor       text,                       -- 편집자
  meta_account text,                       -- 메타 계정 (Diet Beauty 등)
  meta_budget  text,                       -- 메타 예산: 숫자 또는 OFF
  tiktok       text,                       -- 틱톡 (리타겟2, 1, 3 등)
  status       text default '운영중',      -- 운영중 / OFF / 삭제·수정필요
  note         text,                       -- 질병 예방/치료 오인 사유 · 수정 콘티
  created_by   text,
  created_at   timestamptz default now(),
  updated_by   text,
  updated_at   timestamptz default now()
);
alter table ads enable row level security;
drop policy if exists "team_all" on ads;
create policy "team_all" on ads for all using (true) with check (true);
alter publication supabase_realtime add table ads;
