-- ═══════════════════════════════════════════════════════════════
--  카톡 주문 자동 등록 (2026-10-22) — sql-kakao-orders.sql 다음에 실행
--
--  대표 PC 의 KAKAO-ORDER/order.py 가 홈페이지에 비회원 주문을 넣을 때 쓰는 서버 함수.
--  상태 흐름: 접수 → (직원 [자동 주문] 또는 칸이 다 찬 주문은 자동) 자동주문 → 주문중 → 주문완료 / 자동실패 / 확인필요
--    · ko_queue  : PC 가 넣을 주문을 가져가며 '주문중'으로 바꿈(두 번 넣지 않게). 같은 브랜드·같은 전화로 3일 안에
--                  이미 주문완료·주문중인 줄이 있으면 넣지 않고 '확인필요'로 돌림
--    · ko_result : PC 가 결과(주문번호 또는 실패 이유)를 적음
--  Supabase 대시보드 → SQL Editor 에 붙여넣고 Run. 여러 번 실행해도 됩니다.
-- ═══════════════════════════════════════════════════════════════

alter table kakao_orders add column if not exists auto_log  text;          -- 자동 주문 기록(실패 이유·시험 모드 결과)
alter table kakao_orders add column if not exists auto_at   timestamptz;   -- 자동 주문을 시도한 때

create or replace function ko_pc_ok(p_token text) returns boolean
language sql immutable security definer set search_path = public, extensions as $$
  select encode(digest(coalesce(p_token, ''), 'sha256'), 'hex') = '1d8132d3a5a7a38cebd327d38d57ec6d0a2dcfde3ac4bdf98fbc2c3ee1fa6679'
$$;

-- PC → 넣을 주문 가져가기. p_clean = true 면 ⚠ 없는 '접수' 줄도 함께(칸이 다 찬 주문은 직원 확인 없이 자동)
create or replace function ko_queue(p_token text, p_clean boolean default false, p_limit int default 5) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare r kakao_orders; out jsonb := '[]'::jsonb;
begin
  if not ko_pc_ok(p_token) then return jsonb_build_object('ok', false, 'err', 'forbidden'); end if;
  for r in select * from kakao_orders
            where (status = '자동주문' or (p_clean and status = '접수' and coalesce(jsonb_array_length(warn), 0) = 0))
              and sent_at > now() - interval '7 days'
            order by sent_at limit least(greatest(coalesce(p_limit, 5), 1), 20)
            for update skip locked loop
    if exists (select 1 from kakao_orders k where k.id <> r.id and k.brand = r.brand and k.phone = r.phone
                 and k.status in ('주문완료', '주문중') and k.sent_at > r.sent_at - interval '3 days') then
      update kakao_orders set status = '확인필요', auto_log = '같은 전화로 3일 안에 이미 주문이 있어 자동으로 넣지 않음(중복 확인)', updated_at = now() where id = r.id;
      continue;
    end if;
    update kakao_orders set status = '주문중', auto_at = now(), updated_at = now() where id = r.id;
    out := out || to_jsonb(r);
  end loop;
  return jsonb_build_object('ok', true, 'rows', out);
end $$;

-- PC → 결과 적기. p_status: 주문완료 / 자동실패 / 접수(시험 모드로 끝나 원래대로)
create or replace function ko_result(p_token text, p_id text, p_status text, p_order_no text default null, p_log text default null) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not ko_pc_ok(p_token) then return jsonb_build_object('ok', false, 'err', 'forbidden'); end if;
  update kakao_orders set status = p_status,
         order_no = coalesce(nullif(p_order_no, ''), order_no),
         auto_log = left(p_log, 1000),
         handled_by = case when p_status = '주문완료' then '자동 주문' else handled_by end,
         handled_at = case when p_status = '주문완료' then now() else handled_at end,
         updated_at = now()
   where id = p_id;
  return jsonb_build_object('ok', found);
end $$;

grant execute on function ko_queue(text, boolean, int) to anon;
grant execute on function ko_result(text, text, text, text, text) to anon;
