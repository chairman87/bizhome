-- 팀원 입사일·연차 조정 칸 추가 — 이미 만든 저장소에 이 부분만 실행
alter table members add column if not exists hire_date date;
alter table members add column if not exists leave_adjust numeric default 0;
