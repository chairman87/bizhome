-- 업무(tasks)에 '내 순서' 칸 추가: 내 업무 탭에서 줄을 끌어 순서를 바꾸면 여기에 저장됨
alter table tasks add column if not exists sort_order double precision;
