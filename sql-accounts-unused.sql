-- 계정(accounts)에 '사용안함' 칸 추가: 안 쓰는 계정을 지우지 않고 '사용안함' 탭으로 빼 둠 (2026-10-03 실행 완료)
alter table accounts add column if not exists unused boolean default false;
