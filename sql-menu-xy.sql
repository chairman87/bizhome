-- 홈 칸(폴더·판)의 자유 배치 위치 (2026-10-03 실행 완료)
alter table menu add column if not exists x int;
alter table menu add column if not exists y int;

-- 홈 칸의 저장 당시 높이 (위아래로 붙여 둔 칸을 알아보는 데 씀, 2026-10-03 실행 완료)
alter table menu add column if not exists h int;
