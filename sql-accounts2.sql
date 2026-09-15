-- 계정·구독 관리 항목 추가 — 이미 만든 저장소에 이 부분만 실행
alter table accounts add column if not exists group_name  text;              -- 구분 (식이해법연구소, 레모너리 ...)
alter table accounts add column if not exists shared_with text;              -- 공유 사용자
alter table accounts add column if not exists fee         numeric;           -- 구독료 (원)
alter table accounts add column if not exists cycle       text;              -- 월 / 년 / 없음
alter table accounts add column if not exists billing_day int;               -- 결제일 (며칠)
alter table accounts add column if not exists start_date  date;              -- 사용 시작일
alter table accounts add column if not exists end_date    date;              -- 사용 만료일
alter table accounts add column if not exists admin_only  boolean default false;   -- 관리자만 보기
