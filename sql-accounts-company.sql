-- 계정(accounts)에 사업자 칸 추가: 마케팅계정에서 식이해법연구소 / 피에이치뷰티 / 공용 을 고름
alter table accounts add column if not exists company text;

-- 제품 구분으로 알 수 있는 것은 미리 채움 (나머지는 화면에서 직접 선택)
update accounts set company = '식이해법연구소' where company is null and group_name in ('레모너리', '서리맥스');
update accounts set company = '피에이치뷰티' where company is null and (group_name = '흑생마' or (group_name = '광고 계정' and memo like '%사업자: 피에이치뷰티%'));
