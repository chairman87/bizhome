-- 파트너스(인플루언서 협업) 표 추가 — Supabase SQL Editor 에 붙여넣고 Run
create table if not exists partners (
  id            uuid primary key,
  product       text,                       -- 제품 (레모너리/서리맥스/흑생마)
  assignee      text,                       -- 담당자
  handle        text not null,              -- 계정명 (인스타 아이디)
  name          text,                       -- 이름
  profile_url   text,                       -- 프로필/릴스 링크
  followers     numeric default 0,          -- 팔로워 수
  fee           numeric default 0,          -- 확정 견적(원)
  fee_note      text,                       -- 견적 메모 (3개월 등)
  delivered     boolean default false,      -- 제품 전달
  stage         int default 1,              -- 진행 단계 1~10
  next_schedule text,                       -- 다음 일정
  upload_url    text,                       -- 업로드 링크
  upload_date   date,                       -- 광고 업로드 일자
  paid          boolean default false,      -- 비용 지급 완료
  memo          text,
  files         jsonb default '[]',
  created_by    text,
  created_at    timestamptz default now(),
  updated_by    text,
  updated_at    timestamptz default now()
);
alter table partners enable row level security;
drop policy if exists "team_all" on partners;
create policy "team_all" on partners for all using (true) with check (true);
alter publication supabase_realtime add table partners;
