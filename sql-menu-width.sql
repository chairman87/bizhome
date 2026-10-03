-- 홈 칸(폴더·판)의 가로 길이. 판(공지사항·업무공유·이달의 목표)은 menu 표에 type='board', href='board:notices|decisions|goals' 줄로 등록됨 (2026-10-03 실행 완료)
alter table menu add column if not exists width int;
