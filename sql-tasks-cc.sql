-- 업무 참조 인원 (2026-10-06): 담당자 외에 함께 봐야 할 사람들. 이름 목록(JSON 배열)으로 저장
alter table tasks add column if not exists cc jsonb default '[]'::jsonb;
notify pgrst, 'reload schema';
