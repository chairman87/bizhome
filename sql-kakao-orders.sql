-- ═══════════════════════════════════════════════════════════════
--  카톡 주문 (kakao-orders.html) — 잠긴 표 + 서버 함수 (2026-10-22)
--
--  대표 PC 의 KAKAO-ORDER/reader.py 가 레모너리·서리맥스·흑생마 카톡 채널에서 무통장 주문 메시지를 읽어
--  이름·주소·전화·수량으로 나눠 이 표에 넣습니다. 직원은 화면에서 확인·고친 뒤 홈페이지에 주문을 넣고 '주문 완료'로 표시합니다.
--
--  고객 이름·주소·전화가 들어 있어서 다른 표와 달리 잠가 둡니다:
--    · 규칙(policy)을 하나도 만들지 않음 = 공개키로는 읽기·쓰기 모두 막힘
--    · 대표 PC 는 전용 열쇠(PC 의 C:\Users\PC\.claude\kakao-order\token.txt)로 ko_push 만 부름. 여기에는 열쇠의 지문(sha256)만 적음
--    · 직원은 메모장과 같은 출입증(think_login → think_who, sql-think-pin.sql)으로 ko_list·ko_update 를 부름
--  90일 지난 줄은 ko_push 때 지웁니다.
--
--  Supabase 대시보드 → SQL Editor 에 붙여넣고 Run 하세요. 여러 번 실행해도 됩니다. (sql-think-pin.sql 이 먼저 실행돼 있어야 함)
-- ═══════════════════════════════════════════════════════════════

create extension if not exists pgcrypto with schema extensions;

create table if not exists kakao_orders (
  id           text primary key,              -- 카톡 메시지 번호(전화번호가 든 고객 메시지)
  brand        text not null,                 -- 레모너리 / 서리맥스 / 흑생마
  channel      text,                          -- 카톡 채널 번호 (_lGDsn 등)
  chat_id      text,                          -- 카톡 대화방 번호 (채팅방 바로 열기용)
  kakao_name   text,                          -- 카톡 대화명
  sent_at      timestamptz,                   -- 고객이 보낸 시각
  raw_text     text,                          -- 고객 메시지 원문 (앞뒤 30분 메시지를 묶은 것)
  name         text,
  address      text,
  phone        text,
  qty          int,                           -- 박스 수 (3+1 = 4, 4+2 = 6)
  price        int,                           -- 홈페이지 옵션 가격
  option_code  text,
  product_url  text,
  warn         jsonb default '[]'::jsonb,     -- 프로그램이 못 찾은 칸 등
  status       text default '접수',            -- 접수 / 주문완료 / 보류 / 주문아님
  order_no     text,                          -- 카페24 주문번호
  memo         text,
  handled_by   text,
  handled_at   timestamptz,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);
create index if not exists kakao_orders_sent on kakao_orders (sent_at desc);
alter table kakao_orders enable row level security;
revoke all on kakao_orders from anon, authenticated;

-- 대표 PC → 새 주문 넣기. 이미 있는 줄은 건드리지 않음(직원이 고친 내용 보존)
create or replace function ko_push(p_token text, p_rows jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare n int;
begin
  if encode(digest(coalesce(p_token, ''), 'sha256'), 'hex') <> '1d8132d3a5a7a38cebd327d38d57ec6d0a2dcfde3ac4bdf98fbc2c3ee1fa6679' then
    return jsonb_build_object('ok', false, 'err', 'forbidden');
  end if;
  insert into kakao_orders (id, brand, channel, chat_id, kakao_name, sent_at, raw_text, name, address, phone, qty, price, option_code, product_url, warn)
  select r->>'id', r->>'brand', r->>'channel', r->>'chat_id', r->>'kakao_name', (r->>'sent_at')::timestamptz, left(r->>'raw_text', 4000),
         left(r->>'name', 50), left(r->>'address', 300), left(r->>'phone', 30), nullif(r->>'qty', '')::int, nullif(r->>'price', '')::int,
         r->>'option_code', r->>'product_url', coalesce(r->'warn', '[]'::jsonb)
    from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) r
  on conflict (id) do nothing;
  get diagnostics n = row_count;
  delete from kakao_orders where sent_at < now() - interval '90 days';
  return jsonb_build_object('ok', true, 'added', n);
end $$;

-- 직원 → 목록 (최근 p_days 일)
create or replace function ko_list(p_token text, p_days int default 14) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare m uuid := think_who(p_token);
begin
  if m is null then return jsonb_build_object('ok', false, 'err', 'session'); end if;
  return jsonb_build_object('ok', true, 'rows', coalesce((
    select jsonb_agg(to_jsonb(k) order by k.sent_at desc) from kakao_orders k
     where k.sent_at > now() - make_interval(days => least(greatest(coalesce(p_days, 14), 1), 90))), '[]'::jsonb));
end $$;

-- 직원 → 한 줄 고치기 (고칠 수 있는 칸만)
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
    handled_by  = case when p_patch ? 'status'      then nm  else handled_by end,
    handled_at  = case when p_patch ? 'status'      then now() else handled_at end,
    updated_at  = now()
  where id = p_id;
  if not found then return jsonb_build_object('ok', false, 'err', 'notfound'); end if;
  return jsonb_build_object('ok', true);
end $$;

grant execute on function ko_push(text, jsonb) to anon;
grant execute on function ko_list(text, int) to anon;
grant execute on function ko_update(text, text, jsonb) to anon;
