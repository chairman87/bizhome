-- 마케팅 > 광고 캠페인 현황(관리자용) 표 추가 — Supabase SQL Editor 에 붙여넣고 Run
-- kind='data' : 대표 PC 의 AD-STRUCTURE\build.py 가 매시간 채널별 캠페인·소재·설정을 통째로 넣음 (id 'data-tiktok' 등)
-- kind='set'  : 화면에서 직접 적는 타겟팅·오디언스·최적화 이벤트 (id 'set-<채널>-<광고그룹ID>')
create table if not exists ad_campaigns (
  id          text primary key,
  kind        text not null,              -- data / set
  data        jsonb,
  updated_by  text,
  updated_at  timestamptz default now()
);
alter table ad_campaigns enable row level security;
drop policy if exists "team_all" on ad_campaigns;
create policy "team_all" on ad_campaigns for all using (true) with check (true);
alter publication supabase_realtime add table ad_campaigns;
