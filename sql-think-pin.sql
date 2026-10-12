-- ═══════════════════════════════════════════════════════════════
--  파고들기 (think.html) — 전용 PIN 으로 잠그기 (2026-10-12)
--
--  왜: 2026-10-12 팀원 모두 쓰게 바꾸면서 내용이 팀 공용 settings 표(think:<사람id>)에 들어갔는데,
--      그 표는 공개키만 있으면 누구나 읽힙니다. 비즈홈 비밀번호(members.password)도 같은 이유로 지켜지지 않습니다.
--  그래서: 내용은 아무도 직접 못 읽는 think_store 표에 두고(규칙 없음 = 공개키로 접근 불가),
--          파고들기 전용 PIN 이 맞을 때만 아래 서버 함수(security definer)가 꺼내 줍니다.
--          PIN 은 암호화(bcrypt)된 값만 저장. 5번 틀리면 10분 잠김.
--          PIN 이 맞으면 기기마다 출입증(token)을 주고, 다음부터는 그 출입증으로 읽고 씁니다(출입증도 해시로만 저장).
--
--  Supabase 대시보드 → SQL Editor 에 붙여넣고 Run 하세요. 여러 번 실행해도 됩니다.
--
--  PIN 을 잊은 사람 초기화 (관리자가 SQL Editor 에서):
--    update think_store set pin_hash = null, fails = 0, locked_until = null where member = '<members.id>';
--    delete from think_sessions where member = '<members.id>';
--  → 그 사람이 다음에 열면 비즈홈 비밀번호 + 새 PIN 으로 다시 정합니다. 내용은 그대로 남습니다.
-- ═══════════════════════════════════════════════════════════════

create extension if not exists pgcrypto with schema extensions;

-- 1) 내용 (사람마다 한 줄)
create table if not exists think_store (
  member       uuid primary key,              -- members.id
  pin_hash     text,                          -- PIN (bcrypt). 비어 있으면 아직 안 정함
  fails        int default 0,                 -- 연달아 틀린 횟수
  locked_until timestamptz,                   -- 이때까지 잠김
  value        jsonb not null default '{}'::jsonb,
  updated_at   timestamptz,
  updated_by   text
);
-- 2) 지난 내용 (10분에 한 번)
create table if not exists think_store_hist (
  id         uuid primary key default gen_random_uuid(),
  member     uuid not null,
  value      jsonb not null,
  created_at timestamptz default now()
);
create index if not exists think_store_hist_member on think_store_hist (member, created_at desc);
-- 3) 기기별 출입증
create table if not exists think_sessions (
  token_hash text primary key,
  member     uuid not null,
  created_at timestamptz default now(),
  last_at    timestamptz default now()
);

-- 4) 잠금: 규칙(policy)을 하나도 만들지 않으므로 공개키로는 읽기·쓰기 모두 막힘. 아래 함수로만 다룸
alter table think_store      enable row level security;
alter table think_store_hist enable row level security;
alter table think_sessions   enable row level security;
revoke all on think_store, think_store_hist, think_sessions from anon, authenticated;

-- 5) 예전 settings 줄에서 내용 옮기기 (이미 옮긴 사람은 건너뜀)
insert into think_store (member, value, updated_at, updated_by)
select substr(id, 7)::uuid, value, coalesce(updated_at, now()), updated_by
from settings where id like 'think:%' and id not like 'think_hist:%'
on conflict (member) do nothing;
insert into think_store_hist (member, value, created_at)
select split_part(id, ':', 2)::uuid, value, coalesce(updated_at, now())
from settings where id like 'think_hist:%'
  and not exists (select 1 from think_store_hist h where h.member = split_part(settings.id, ':', 2)::uuid and h.created_at = coalesce(settings.updated_at, now()));

-- ── 서버 함수 ─────────────────────────────────
-- 출입증 → 사람 (없거나 180일 넘게 안 쓴 출입증은 거절)
create or replace function think_who(p_token text) returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare v uuid;
begin
  update think_sessions set last_at = now()
   where token_hash = encode(digest(coalesce(p_token, ''), 'sha256'), 'hex') and last_at > now() - interval '180 days'
  returning member into v;
  return v;
end $$;

create or replace function think_new_session(p_member uuid) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare t text := encode(gen_random_bytes(24), 'hex');
begin
  insert into think_sessions (token_hash, member) values (encode(digest(t, 'sha256'), 'hex'), p_member);
  return t;
end $$;

-- PIN 을 정했는지 (로그인 화면에서 'PIN 입력' / '처음: PIN 정하기' 를 고르는 데만 씀)
create or replace function think_status(p_member uuid) returns jsonb
language sql security definer set search_path = public, extensions as $$
  select jsonb_build_object('has_pin', exists (select 1 from think_store where member = p_member and pin_hash is not null));
$$;

-- 처음 PIN 정하기: 아직 PIN 이 없을 때만, 비즈홈 비밀번호가 맞아야 함
create or replace function think_set_pin(p_member uuid, p_bizpw text, p_pin text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare r think_store; pw text;
begin
  if length(coalesce(p_pin, '')) < 6 then return jsonb_build_object('ok', false, 'err', 'short'); end if;
  select password into pw from members where id::text = p_member::text;
  if not found then return jsonb_build_object('ok', false, 'err', 'nomember'); end if;
  insert into think_store (member) values (p_member) on conflict (member) do nothing;
  select * into r from think_store where member = p_member for update;
  if r.pin_hash is not null then return jsonb_build_object('ok', false, 'err', 'has_pin'); end if;
  if r.locked_until > now() then return jsonb_build_object('ok', false, 'err', 'locked', 'until', r.locked_until); end if;
  if coalesce(p_bizpw, '') <> coalesce(nullif(pw, ''), '1234') then
    update think_store set fails = case when fails + 1 >= 5 then 0 else fails + 1 end,
                           locked_until = case when fails + 1 >= 5 then now() + interval '10 minutes' else locked_until end
     where member = p_member;
    return jsonb_build_object('ok', false, 'err', 'bizpw');
  end if;
  update think_store set pin_hash = crypt(p_pin, gen_salt('bf')), fails = 0, locked_until = null where member = p_member;
  return jsonb_build_object('ok', true, 'token', think_new_session(p_member));
end $$;

-- PIN 으로 들어가기
create or replace function think_login(p_member uuid, p_pin text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare r think_store;
begin
  select * into r from think_store where member = p_member for update;
  if not found or r.pin_hash is null then return jsonb_build_object('ok', false, 'err', 'no_pin'); end if;
  if r.locked_until > now() then return jsonb_build_object('ok', false, 'err', 'locked', 'until', r.locked_until); end if;
  if r.pin_hash <> crypt(coalesce(p_pin, ''), r.pin_hash) then
    update think_store set fails = case when fails + 1 >= 5 then 0 else fails + 1 end,
                           locked_until = case when fails + 1 >= 5 then now() + interval '10 minutes' else locked_until end
     where member = p_member;
    return jsonb_build_object('ok', false, 'err', 'pin', 'left', greatest(0, 4 - r.fails));
  end if;
  update think_store set fails = 0, locked_until = null where member = p_member;
  return jsonb_build_object('ok', true, 'token', think_new_session(p_member));
end $$;

-- PIN 바꾸기 (들어와 있는 상태에서 지금 PIN 확인 후)
create or replace function think_change_pin(p_token text, p_old text, p_new text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare m uuid := think_who(p_token); r think_store;
begin
  if m is null then return jsonb_build_object('ok', false, 'err', 'session'); end if;
  if length(coalesce(p_new, '')) < 6 then return jsonb_build_object('ok', false, 'err', 'short'); end if;
  select * into r from think_store where member = m;
  if r.pin_hash <> crypt(coalesce(p_old, ''), r.pin_hash) then return jsonb_build_object('ok', false, 'err', 'pin'); end if;
  update think_store set pin_hash = crypt(p_new, gen_salt('bf')) where member = m;
  delete from think_sessions where member = m and token_hash <> encode(digest(p_token, 'sha256'), 'hex');   -- 다른 기기는 다시 PIN 입력
  return jsonb_build_object('ok', true);
end $$;

create or replace function think_logout(p_token text) returns void
language sql security definer set search_path = public, extensions as $$
  delete from think_sessions where token_hash = encode(digest(coalesce(p_token, ''), 'sha256'), 'hex');
$$;

-- 내용 읽기 (p_full=false 면 고친 시각만)
create or replace function think_load(p_token text, p_full boolean default true) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare m uuid := think_who(p_token); r think_store;
begin
  if m is null then return jsonb_build_object('ok', false, 'err', 'session'); end if;
  select * into r from think_store where member = m;
  return jsonb_build_object('ok', true, 'updated_at', r.updated_at, 'value', case when p_full then r.value end);
end $$;

-- 내용 저장: 서버의 고친 시각이 p_expect 와 같을 때만 (그 사이 다른 창이 저장했으면 conflict → 앱이 합쳐서 다시 보냄)
create or replace function think_save(p_token text, p_value jsonb, p_expect timestamptz, p_by text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare m uuid := think_who(p_token); st timestamptz;
begin
  if m is null then return jsonb_build_object('ok', false, 'err', 'session'); end if;
  update think_store set value = coalesce(p_value, '{}'::jsonb), updated_at = clock_timestamp(), updated_by = p_by
   where member = m and updated_at is not distinct from p_expect
  returning updated_at into st;
  if st is null then return jsonb_build_object('ok', true, 'conflict', true); end if;
  return jsonb_build_object('ok', true, 'updated_at', st);
end $$;

-- 지난 내용 남기기
create or replace function think_hist_add(p_token text, p_value jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare m uuid := think_who(p_token);
begin
  if m is null then return jsonb_build_object('ok', false, 'err', 'session'); end if;
  insert into think_store_hist (member, value) values (m, p_value);
  return jsonb_build_object('ok', true);
end $$;

revoke all on function think_who(text), think_new_session(uuid) from public, anon, authenticated;
grant execute on function think_status(uuid), think_set_pin(uuid, text, text), think_login(uuid, text), think_change_pin(text, text, text),
  think_logout(text), think_load(text, boolean), think_save(text, jsonb, timestamptz, text), think_hist_add(text, jsonb) to anon, authenticated;

-- 확인용: select member, pin_hash is not null as has_pin, updated_at, length(value::text) from think_store;
