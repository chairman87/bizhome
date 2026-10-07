-- 업무(tasks)에 '본 시각' 칸 추가: 업무 탭의 빨간 숫자는 내 차례인데 아직 열어 보지 않은 업무 수.
-- 업무를 눌러 열면 여기에 {이름: 시각} 으로 남아 숫자가 사라짐 (어느 기기에서 열어도 같이 사라짐)
alter table tasks add column if not exists seen jsonb default '{}';
