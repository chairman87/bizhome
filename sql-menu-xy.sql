-- 홈 칸(폴더·판)의 자유 배치 위치 (2026-10-03 실행 완료)
alter table menu add column if not exists x int;
alter table menu add column if not exists y int;
