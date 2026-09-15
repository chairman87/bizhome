-- 팀원 직급 칸 추가 — 이미 만든 저장소에 이 한 줄만 실행
alter table members add column if not exists title text;
