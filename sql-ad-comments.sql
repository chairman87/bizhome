-- 마케팅 > 댓글 관리 (메타 광고 댓글) 표 추가 — Supabase SQL Editor 에 붙여넣고 Run
-- 댓글은 대표 PC 의 META-COMMENTS\sync.py 가 메타에서 읽어 와 채움. 화면에서는 "요청"만 넣고, 실제 숨김·삭제는 sync.py 가 실행함.
create table if not exists ad_comments (
  id           text primary key,            -- 메타의 댓글 번호
  post_id      text,                        -- 광고 게시물 번호
  platform     text,                        -- 페이스북 / 인스타
  product      text,                        -- 레모너리 / 서리맥스 / 흑생마
  campaign     text,                        -- 캠페인(영상) 이름
  page         text,                        -- 페이지 이름
  page_id      text,
  author       text,                        -- 댓글 쓴 사람
  body         text,                        -- 댓글 내용
  posted_at    text,                        -- 댓글 단 시각 (한국 시간 YYYY-MM-DD HH:MM)
  hidden       boolean default false,       -- 메타에서 숨김 상태인지
  can_hide     boolean default true,
  likes        int default 0,
  is_reply     boolean default false,       -- 답글인지
  link         text,                        -- 댓글 바로가기
  deleted      boolean default false,       -- 삭제됨(우리가 삭제했거나 메타에서 사라짐)
  deleted_note text,
  synced_at    timestamptz,
  updated_at   timestamptz default now()
);
create table if not exists ad_comment_actions (
  id           uuid primary key,
  comment_id   text not null,
  action       text not null,               -- hide / unhide / delete
  requested_by text,
  status       text default '대기',          -- 대기 / 완료 / 실패 / 취소
  error        text,
  body         text,                        -- 요청 당시 댓글 내용 (삭제해도 기록이 남도록)
  created_at   timestamptz default now(),
  done_at      timestamptz,
  updated_at   timestamptz default now()
);
create table if not exists ad_comment_sync (
  id           text primary key,            -- 'last' 한 줄만 씀
  synced_at    timestamptz,
  summary      jsonb default '{}',          -- {total, visible, hidden, problems:[...], done:[...]}
  updated_at   timestamptz default now()
);
alter table ad_comments enable row level security;
alter table ad_comment_actions enable row level security;
alter table ad_comment_sync enable row level security;
drop policy if exists "team_all" on ad_comments;
drop policy if exists "team_all" on ad_comment_actions;
drop policy if exists "team_all" on ad_comment_sync;
create policy "team_all" on ad_comments for all using (true) with check (true);
create policy "team_all" on ad_comment_actions for all using (true) with check (true);
create policy "team_all" on ad_comment_sync for all using (true) with check (true);
alter publication supabase_realtime add table ad_comments;
alter publication supabase_realtime add table ad_comment_actions;
alter publication supabase_realtime add table ad_comment_sync;
