-- 참고 컨텐츠 영상 표 추가 — Supabase SQL Editor 에 붙여넣고 Run
create table if not exists videos (
  id          uuid primary key,
  url         text not null,                 -- 영상 주소 (유튜브·인스타·틱톡 ...)
  title       text,                          -- 제목 (자동 또는 직접 입력)
  author      text,                          -- 채널·계정 이름 (자동)
  thumb       text,                          -- 미리보기 그림 주소 (자동)
  category    text,                          -- 참고 포인트 (후킹 / 구성·흐름 / 제품 설명 / 경쟁사 / 트렌드·밈 / 기타)
  product     text default '공통',           -- 관련 제품 (공통 / 레모너리 / 서리맥스 / 흑생마)
  memo        text,                          -- 왜 참고할 만한지
  likes       jsonb default '[]',            -- 👍 추천한 사람 이름 목록
  comments    jsonb default '[]',            -- 댓글 [{id, by, text, at}]
  created_by  text,
  created_at  timestamptz default now(),
  updated_by  text,
  updated_at  timestamptz default now()
);
alter table videos enable row level security;
drop policy if exists "team_all" on videos;
create policy "team_all" on videos for all using (true) with check (true);
alter publication supabase_realtime add table videos;
