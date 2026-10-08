-- 파트너스 후보(partner_leads) 상태 이름 개편 (2026-10-08). Supabase SQL 편집기에서 한 번 실행.
-- 화면(partners.html)은 예전 이름을 자동으로 새 이름으로 바꿔 보여주므로, 이 명령은 저장된 값까지 정리하는 용도입니다.
--   검토중 → 검토대기 / 컨택함 → 컨택/답변대기 / 진행 결정 → 계약중 / 보류·리스트 제외·중복 → 컨택/진행불가 / 완료 → 진행완료
update partner_leads set status = case status
  when '검토중' then '검토대기'
  when '컨택함' then '컨택/답변대기'
  when '진행 결정' then '계약중'
  when '보류' then '컨택/진행불가'
  when '리스트 제외' then '컨택/진행불가'
  when '중복' then '컨택/진행불가'
  when '완료' then '진행완료'
  else status end
where status in ('검토중', '컨택함', '진행 결정', '보류', '리스트 제외', '중복', '완료');

-- 확인: 상태별 건수
select status, count(*) from partner_leads group by status order by 2 desc;
