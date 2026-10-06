-- 광고 영상 리스트 콘티 파일 (2026-10-06): 상세 창의 '콘티' 칸에 파일(사진·PDF·문서) 첨부. 보관함 files/ads/ 폴더에 올라감
alter table ads add column if not exists files jsonb default '[]'::jsonb;
notify pgrst, 'reload schema';
