-- 광고 영상 리스트 ↔ 메타 광고 관리자 자동 연결 — 이미 만든 저장소에 이 부분만 실행
-- (매일 오전 10시에 ADS-SYNC\ads_sync.py 가 메타 캠페인의 예산·켜짐/꺼짐을 읽어 ads 표에 맞춤)
alter table ads add column if not exists meta_campaign_id text;          -- 짝지은 메타 캠페인 번호
alter table ads add column if not exists meta_synced_at  timestamptz;    -- 마지막으로 메타 값이 반영된 시각
alter table ads add column if not exists meta_state       text;           -- 메타에서 실제로 켜져 있는지: 운영중 / OFF (화면의 "메타" 열, 비어 있으면 미연결)
alter table ads add column if not exists google_state     text;           -- 구글애즈에서 실제로 켜져 있는지: 운영중 / OFF (화면의 "구글 운영" 열, 비어 있으면 구글 캠페인 없음)

create table if not exists ads_sync (
  id        uuid primary key,
  synced_at timestamptz default now(),    -- 자동 반영한 시각
  summary   jsonb                         -- 그때 바뀐 점: new(새 영상) / off / on / budget(예산 변경) / lost · kept(확인 필요)
);
alter table ads_sync enable row level security;
drop policy if exists "team_all" on ads_sync;
create policy "team_all" on ads_sync for all using (true) with check (true);
alter publication supabase_realtime add table ads_sync;
