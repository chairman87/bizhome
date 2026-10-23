-- ═══════════════════════════════════════════════════════════════
--  카톡 주문취소 (kakao-cancels.html) — 2026-10-23
--  카톡 주문(kakao_orders, sql-kakao-orders.sql)과 같은 잠긴 표를 쓰고 kind = '취소' 로 구분합니다.
--  대표 PC 의 KAKAO-ORDER/reader.py 가 취소·환불·반품 메시지를 모아 고객 휴대폰으로 찾은 카페24 주문 후보(candidates)와 함께 넣고,
--  직원이 주문을 골라 [즉시 취소]를 누르면(status '취소요청') KAKAO-ORDER/cancel.py 가 카페24 취소 API 로 취소합니다.
--  상태: 취소접수(새 메시지) → 취소요청(직원이 누름) → 취소중 → 취소완료 / 취소실패 / 처리안함
--  Supabase 대시보드 → SQL Editor 에 붙여넣고 Run. 여러 번 실행해도 됩니다. (sql-kakao-orders.sql · sql-kakao-orders-auto.sql 다음)
-- ═══════════════════════════════════════════════════════════════

alter table kakao_orders add column if not exists kind            text default '주문';   -- 주문 / 취소
alter table kakao_orders add column if not exists candidates      jsonb default '[]'::jsonb;   -- 카페24 주문 후보 [{order_id, date, amount, pay, paid, ship, shipped, items}]
alter table kakao_orders add column if not exists cancel_order_id text;   -- 직원이 고른 취소할 카페24 주문번호
alter table kakao_orders add column if not exists refund          jsonb default '{}'::jsonb;   -- 무통장 환불 계좌 {bank, account, holder} (카톡에서 읽음, 직원이 고칠 수 있음)

-- 대표 PC → 넣기: 취소 카드용 칸까지 받도록 다시 만듦(그 밖은 sql-kakao-orders.sql 의 ko_push 와 같음)
create or replace function ko_push(p_token text, p_rows jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare n int;
begin
  if not ko_pc_ok(p_token) then return jsonb_build_object('ok', false, 'err', 'forbidden'); end if;
  insert into kakao_orders (id, kind, brand, channel, chat_id, kakao_name, sent_at, raw_text, name, address, phone, qty, price, option_code, product_url, warn, candidates, refund, status)
  select r->>'id', coalesce(r->>'kind', '주문'), r->>'brand', r->>'channel', r->>'chat_id', r->>'kakao_name', (r->>'sent_at')::timestamptz, left(r->>'raw_text', 4000),
         left(r->>'name', 50), left(r->>'address', 300), left(r->>'phone', 30), nullif(r->>'qty', '')::int, nullif(r->>'price', '')::int,
         r->>'option_code', r->>'product_url', coalesce(r->'warn', '[]'::jsonb), coalesce(r->'candidates', '[]'::jsonb), coalesce(r->'refund', '{}'::jsonb),
         case when coalesce(r->>'kind', '주문') = '취소' then '취소접수' else '접수' end
    from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) r
  on conflict (id) do update set
    name = excluded.name, address = excluded.address, phone = excluded.phone, qty = excluded.qty, price = excluded.price,
    option_code = excluded.option_code, warn = excluded.warn, raw_text = excluded.raw_text, candidates = excluded.candidates, refund = excluded.refund
  where kakao_orders.status in ('접수', '취소접수') and not coalesce(kakao_orders.staff_edited, false);
  get diagnostics n = row_count;
  delete from kakao_orders where sent_at < now() - interval '90 days';
  return jsonb_build_object('ok', true, 'added', n);
end $$;

-- 대표 PC → 주문 후보만 새로 고침(직원이 손댄 뒤에도 후보 목록·배송 상태는 최신으로)
create or replace function ko_candidates(p_token text, p_id text, p_candidates jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not ko_pc_ok(p_token) then return jsonb_build_object('ok', false, 'err', 'forbidden'); end if;
  update kakao_orders set candidates = coalesce(p_candidates, '[]'::jsonb) where id = p_id and kind = '취소';
  return jsonb_build_object('ok', found);
end $$;

-- 직원 → 고치기: 취소용 칸(cancel_order_id·refund) 추가
create or replace function ko_update(p_token text, p_id text, p_patch jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare m uuid := think_who(p_token); nm text;
begin
  if m is null then return jsonb_build_object('ok', false, 'err', 'session'); end if;
  select name into nm from members where id::text = m::text;
  update kakao_orders set
    name        = case when p_patch ? 'name'        then left(p_patch->>'name', 50)    else name end,
    address     = case when p_patch ? 'address'     then left(p_patch->>'address', 300) else address end,
    phone       = case when p_patch ? 'phone'       then left(p_patch->>'phone', 30)   else phone end,
    qty         = case when p_patch ? 'qty'         then nullif(p_patch->>'qty', '')::int   else qty end,
    price       = case when p_patch ? 'price'       then nullif(p_patch->>'price', '')::int else price end,
    option_code = case when p_patch ? 'option_code' then p_patch->>'option_code' else option_code end,
    status      = case when p_patch ? 'status'      then p_patch->>'status'      else status end,
    order_no    = case when p_patch ? 'order_no'    then left(p_patch->>'order_no', 40) else order_no end,
    memo        = case when p_patch ? 'memo'        then left(p_patch->>'memo', 500)    else memo end,
    cancel_order_id = case when p_patch ? 'cancel_order_id' then left(p_patch->>'cancel_order_id', 40) else cancel_order_id end,
    refund      = case when p_patch ? 'refund'      then p_patch->'refund' else refund end,
    handled_by  = case when p_patch ? 'status'      then nm  else handled_by end,
    handled_at  = case when p_patch ? 'status'      then now() else handled_at end,
    staff_edited = coalesce(staff_edited, false) or p_patch ?| array['name', 'address', 'phone', 'qty', 'refund'],
    updated_at  = now()
  where id = p_id;
  if not found then return jsonb_build_object('ok', false, 'err', 'notfound'); end if;
  return jsonb_build_object('ok', true);
end $$;

-- 대표 PC → 취소할 것 가져가기(가져가며 '취소중'으로)
create or replace function ko_cancel_queue(p_token text, p_limit int default 5) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare r kakao_orders; out jsonb := '[]'::jsonb;
begin
  if not ko_pc_ok(p_token) then return jsonb_build_object('ok', false, 'err', 'forbidden'); end if;
  for r in select * from kakao_orders where kind = '취소' and status = '취소요청' and cancel_order_id is not null
            order by updated_at limit least(greatest(coalesce(p_limit, 5), 1), 20) for update skip locked loop
    update kakao_orders set status = '취소중', auto_at = now(), updated_at = now() where id = r.id;
    out := out || to_jsonb(r);
  end loop;
  return jsonb_build_object('ok', true, 'rows', out);
end $$;

-- 홈 배지: 카톡 주문은 주문만, 카톡 주문취소는 따로
create or replace function ko_count() returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int from kakao_orders
   where coalesce(kind, '주문') = '주문' and status in ('접수', '확인필요', '자동실패') and sent_at > now() - interval '14 days'
$$;
create or replace function ko_count_cancel() returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int from kakao_orders
   where kind = '취소' and status in ('취소접수', '취소실패') and sent_at > now() - interval '14 days'
$$;

grant execute on function ko_push(text, jsonb) to anon;
grant execute on function ko_candidates(text, text, jsonb) to anon;
grant execute on function ko_update(text, text, jsonb) to anon;
grant execute on function ko_cancel_queue(text, int) to anon;
grant execute on function ko_count() to anon;
grant execute on function ko_count_cancel() to anon;
