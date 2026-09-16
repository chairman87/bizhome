-- 첨부 파일(캡처 이미지 등) 보관함 준비 — Supabase SQL Editor 에 붙여넣고 Run
-- 1) 'files' 보관함(Storage bucket) 만들기. 링크를 아는 사람은 누구나 볼 수 있음(공개)
insert into storage.buckets (id, name, public) values ('files', 'files', true)
  on conflict (id) do update set public = true;
-- 2) 팀 누구나 올리고 지울 수 있게 (소규모 팀 전제)
drop policy if exists "team_files_select" on storage.objects;
drop policy if exists "team_files_insert" on storage.objects;
drop policy if exists "team_files_update" on storage.objects;
drop policy if exists "team_files_delete" on storage.objects;
create policy "team_files_select" on storage.objects for select using (bucket_id = 'files');
create policy "team_files_insert" on storage.objects for insert with check (bucket_id = 'files');
create policy "team_files_update" on storage.objects for update using (bucket_id = 'files');
create policy "team_files_delete" on storage.objects for delete using (bucket_id = 'files');
-- 3) 업무 표에 첨부 목록 칸 추가
alter table tasks add column if not exists files jsonb default '[]';
