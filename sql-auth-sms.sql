-- ═══════════════════════════════════════════════════════════════
--  인증문자 (authsms.html) — 잠긴 표 + 서버 함수 (2026-11-19)
--
--  사무실 아이폰 2대(식이해법 · 피에이치뷰티 정산/세금용)에 오는 인증 문자를
--  아이폰 단축어 자동화가 as_in() 으로 보냅니다. 핸드폰을 찾으러 가지 않고 인트라넷에서 번호를 봅니다.
--
--  인증번호는 정산·세금 계정의 2차 인증이라 은행 문자(sql-bank-sms.sql)·채용공고(sql-applicants.sql)처럼 잠가 둡니다:
--    · 규칙(policy)을 하나도 만들지 않음 = 공개키로는 읽기·쓰기 모두 막힘
--    · 아이폰은 전용 열쇠로 as_in 만 부름. 여기에는 열쇠의 지문(sha256)만 적음(열쇠는 맥북 ~/.claude/auth-sms/token.txt)
--    · 읽기는 메모장과 같은 출입증(think_login → think_who, sql-think-pin.sql)으로, 관리자와 관리자가 지정한 사람만
--  본문에 '인증'이 있고 숫자가 있는 문자만 받습니다. 받은 지 24시간 지난 줄은 다음 문자가 올 때 지웁니다.
--
--  Supabase 대시보드 → SQL Editor 에 붙여넣고 Run 하세요. 여러 번 실행해도 됩니다. (sql-think-pin.sql 이 먼저 실행돼 있어야 함)
-- ═══════════════════════════════════════════════════════════════

create extension if not exists pgcrypto with schema extensions;

create table if not exists auth_sms (
  id           bigint generated always as identity primary key,
  received_at  timestamptz not null default now(),   -- 문자가 도착한 시각
  phone        text,                                  -- 어느 핸드폰: 식이해법 / 피에이치뷰티
  sender       text,                                  -- 보낸 번호(단축어가 보내 주면)
  body         text not null                          -- 문자 원문 (인증번호는 화면에서 뽑아냄)
);
create index if not exists auth_sms_received on auth_sms (received_at desc);
alter table auth_sms enable row level security;
revoke all on auth_sms from anon, authenticated;

-- 볼 수 있는 사람(관리자는 여기 없어도 항상 봄)
create table if not exists auth_sms_viewers (
  member  text primary key                            -- members.id
);
alter table auth_sms_viewers enable row level security;
revoke all on auth_sms_viewers from anon, authenticated;

create or replace function as_phone_ok(p_token text) returns boolean
language sql immutable set search_path = public, extensions as $$
  select encode(digest(coalesce(p_token, ''), 'sha256'), 'hex') = '28905085bb9587dfc09a7885bbe43532b225111e2d69dab7e71e2c6a4d974275'
$$;

-- 넣기: 아이폰 단축어가 부름. '인증' + 숫자가 있는 문자만 받고 나머지는 버림
create or replace function as_in(p_token text, p_body text, p_phone text default null, p_sender text default null)
returns text language plpgsql security definer set search_path = public, extensions as $$
begin
  if not as_phone_ok(p_token) then raise exception 'forbidden'; end if;
  if coalesce(trim(p_body), '') = '' then return 'empty'; end if;
  if position('인증' in p_body) = 0 or p_body !~ '[0-9]' then return 'skip'; end if;
  delete from auth_sms where received_at < now() - interval '24 hours';
  insert into auth_sms(phone, sender, body) values (left(p_phone, 30), left(p_sender, 100), left(p_body, 1000));
  return 'ok';
end $$;

create or replace function as_can(m uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from members where id::text = m::text and role = 'admin')
      or exists (select 1 from auth_sms_viewers where member = m::text)
$$;
revoke all on function as_can(uuid) from public, anon, authenticated;

-- 읽기: 최근 24시간. 관리자에게는 볼 수 있는 사람 목록도 함께 줌
create or replace function as_list(p_token text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare m uuid := think_who(p_token); adm boolean;
begin
  if m is null then return jsonb_build_object('ok', false, 'err', 'session'); end if;
  if not as_can(m) then return jsonb_build_object('ok', false, 'err', 'denied'); end if;
  adm := exists (select 1 from members where id::text = m::text and role = 'admin');
  return jsonb_build_object('ok', true, 'now', now(), 'admin', adm,
    'rows', coalesce((select jsonb_agg(to_jsonb(a) order by a.received_at desc) from auth_sms a
                       where a.received_at > now() - interval '24 hours'), '[]'::jsonb),
    'viewers', case when adm then coalesce((select jsonb_agg(member) from auth_sms_viewers), '[]'::jsonb) else '[]'::jsonb end);
end $$;

-- 관리자 → 볼 수 있는 사람 정하기 (members.id 목록으로 통째로 바꿈)
create or replace function as_viewers_set(p_token text, p_members jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare m uuid := think_who(p_token);
begin
  if m is null then return jsonb_build_object('ok', false, 'err', 'session'); end if;
  if not exists (select 1 from members where id::text = m::text and role = 'admin') then return jsonb_build_object('ok', false, 'err', 'admin'); end if;
  delete from auth_sms_viewers where true;   -- Supabase 는 조건 없는 delete 를 막음
  insert into auth_sms_viewers(member)
  select distinct v from jsonb_array_elements_text(coalesce(p_members, '[]'::jsonb)) v
   where exists (select 1 from members where id::text = v);
  return jsonb_build_object('ok', true);
end $$;

grant execute on function as_in(text, text, text, text) to anon;
grant execute on function as_list(text) to anon;
grant execute on function as_viewers_set(text, jsonb) to anon;
