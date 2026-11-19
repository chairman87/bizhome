-- ═══════════════════════════════════════════════════════════════
--  로그인 잠그기 1/2 — 준비 (2026-11-19)
--
--  왜: 팀원 표(members)의 비밀번호 칸이 공개키만 있으면 밖에서 그대로 읽혔습니다.
--      잠긴 화면(채용·인증문자·카톡 주문·메모장)의 자물쇠가 바로 그 비밀번호라, 꺼내 보면 전부 열렸습니다.
--  그래서: 비밀번호는 암호화(bcrypt)해서 아무도 직접 못 읽는 표(member_secrets)에 두고,
--          맞는지 확인은 서버 함수(think_login)만 합니다. 맞으면 출입증(token)을 줍니다.
--          팀원 추가·삭제·관리자 지정·운영진 지정도 서버 함수가 출입증을 보고 관리자인지 확인합니다.
--
--  이 파일(1/2)은 준비만 합니다. 실행해도 예전 화면이 그대로 동작합니다.
--  새 화면을 올린 뒤 sql-login-2.sql 을 실행하면 비밀번호 칸이 사라지고 팀원 표가 잠깁니다.
--  여러 번 실행해도 됩니다. (sql-think-pin.sql 이 먼저 실행돼 있어야 함)
-- ═══════════════════════════════════════════════════════════════

create extension if not exists pgcrypto with schema extensions;

-- 1) 비밀번호 (사람마다 한 줄). pw_hash 가 비어 있으면 초기 비밀번호(1234) 상태
create table if not exists member_secrets (
  member     text primary key,               -- members.id
  pw_hash    text,
  updated_at timestamptz default now()
);
alter table member_secrets enable row level security;
revoke all on member_secrets from anon, authenticated;

-- 2) 지금 비밀번호를 암호화해서 옮김 (이미 옮긴 사람은 건너뜀). 비밀번호 칸이 아직 있을 때만
do $$ begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'members' and column_name = 'password') then
    execute $q$
      insert into member_secrets (member, pw_hash)
      select id::text, case when coalesce(password, '') in ('', '1234') then null else extensions.crypt(password, extensions.gen_salt('bf')) end
        from members
      on conflict (member) do nothing $q$;
  end if;
end $$;

-- 3) 예전 화면이 비밀번호 칸을 직접 고치면 암호화본도 따라 바뀌게 함 (2/2 에서 지움)
create or replace function bz_pw_sync() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
begin
  if tg_op = 'INSERT' or new.password is distinct from old.password then
    insert into member_secrets (member, pw_hash)
    values (new.id::text, case when coalesce(new.password, '') in ('', '1234') then null else crypt(new.password, gen_salt('bf')) end)
    on conflict (member) do update set pw_hash = excluded.pw_hash, updated_at = now();
  end if;
  return new;
end $$;
do $$ begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'members' and column_name = 'password') then
    drop trigger if exists bz_pw_sync on members;
    create trigger bz_pw_sync after insert or update on members for each row execute function bz_pw_sync();
  end if;
end $$;

-- ── 안에서만 쓰는 함수 ─────────────────────────
-- 비밀번호가 맞는지 (줄이 없거나 비어 있으면 초기 비밀번호 1234)
create or replace function bz_pw_ok(p_member text, p_pw text) returns boolean
language sql stable security definer set search_path = public, extensions as $$
  select coalesce(
    (select case when s.pw_hash is null then coalesce(p_pw, '') = '1234' else s.pw_hash = crypt(coalesce(p_pw, ''), s.pw_hash) end
       from member_secrets s where s.member = p_member),
    coalesce(p_pw, '') = '1234')
$$;
-- 아직 초기 비밀번호(1234)인지
create or replace function bz_pw_default(p_member text) returns boolean
language sql stable security definer set search_path = public as $$
  select not exists (select 1 from member_secrets where member = p_member and pw_hash is not null)
$$;
create or replace function bz_is_admin(p_member uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from members where id::text = p_member::text and role = 'admin')
$$;
revoke all on function bz_pw_ok(text, text), bz_pw_default(text), bz_is_admin(uuid), bz_pw_sync() from public, anon, authenticated;

-- ── 들어가기 ─────────────────────────────────
-- 비밀번호가 맞으면 출입증을 줌. 5번 틀리면 10분 잠김. must_change = 아직 1234 라 새로 정해야 함
create or replace function think_login(p_member uuid, p_pin text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare r think_store;
begin
  if not exists (select 1 from members where id::text = p_member::text) then return jsonb_build_object('ok', false, 'err', 'nomember'); end if;
  insert into think_store (member) values (p_member) on conflict (member) do nothing;
  select * into r from think_store where member = p_member for update;
  if r.locked_until > now() then return jsonb_build_object('ok', false, 'err', 'locked', 'until', r.locked_until); end if;
  if not bz_pw_ok(p_member::text, p_pin) then
    update think_store set fails = case when fails + 1 >= 5 then 0 else fails + 1 end,
                           locked_until = case when fails + 1 >= 5 then now() + interval '10 minutes' else locked_until end
     where member = p_member;
    return jsonb_build_object('ok', false, 'err', 'pin', 'left', greatest(0, 4 - coalesce(r.fails, 0)));
  end if;
  update think_store set fails = 0, locked_until = null where member = p_member;
  return jsonb_build_object('ok', true, 'token', think_new_session(p_member), 'must_change', bz_pw_default(p_member::text));
end $$;

-- (안 쓰는 예전 함수지만 비밀번호 칸을 보고 있어 같이 고침)
create or replace function think_set_pin(p_member uuid, p_bizpw text, p_pin text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare r think_store;
begin
  if length(coalesce(p_pin, '')) < 6 then return jsonb_build_object('ok', false, 'err', 'short'); end if;
  if not exists (select 1 from members where id::text = p_member::text) then return jsonb_build_object('ok', false, 'err', 'nomember'); end if;
  insert into think_store (member) values (p_member) on conflict (member) do nothing;
  select * into r from think_store where member = p_member for update;
  if r.pin_hash is not null then return jsonb_build_object('ok', false, 'err', 'has_pin'); end if;
  if r.locked_until > now() then return jsonb_build_object('ok', false, 'err', 'locked', 'until', r.locked_until); end if;
  if not bz_pw_ok(p_member::text, p_bizpw) then
    update think_store set fails = case when fails + 1 >= 5 then 0 else fails + 1 end,
                           locked_until = case when fails + 1 >= 5 then now() + interval '10 minutes' else locked_until end
     where member = p_member;
    return jsonb_build_object('ok', false, 'err', 'bizpw');
  end if;
  update think_store set pin_hash = crypt(p_pin, gen_salt('bf')), fails = 0, locked_until = null where member = p_member;
  return jsonb_build_object('ok', true, 'token', think_new_session(p_member));
end $$;

-- ── 비밀번호 바꾸기 ───────────────────────────
-- 본인 것은 본인이, 남의 것은 관리자만. '1234'(초기화)는 관리자만. 바꾸면 그 사람의 다른 기기는 다시 로그인
create or replace function bz_set_pw(p_token text, p_member text, p_new text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare me uuid := think_who(p_token); adm boolean; h text;
begin
  if me is null then return jsonb_build_object('ok', false, 'err', 'session'); end if;
  if not exists (select 1 from members where id::text = p_member) then return jsonb_build_object('ok', false, 'err', 'nomember'); end if;
  adm := bz_is_admin(me);
  if me::text <> p_member and not adm then return jsonb_build_object('ok', false, 'err', 'denied'); end if;
  if coalesce(p_new, '') = '1234' then
    if not adm then return jsonb_build_object('ok', false, 'err', 'rule'); end if;
    h := null;
  elsif length(coalesce(p_new, '')) < 4 or length(p_new) > 60 or p_new ~ '\s' then
    return jsonb_build_object('ok', false, 'err', 'rule');
  else
    h := crypt(p_new, gen_salt('bf'));
  end if;
  insert into member_secrets (member, pw_hash) values (p_member, h)
  on conflict (member) do update set pw_hash = excluded.pw_hash, updated_at = now();
  delete from think_sessions where member::text = p_member and token_hash <> encode(digest(coalesce(p_token, ''), 'sha256'), 'hex');
  update think_store set fails = 0, locked_until = null where member::text = p_member;
  return jsonb_build_object('ok', true);
end $$;

-- ── 팀원 고치기 ───────────────────────────────
-- 보낸 칸만 고침(안 보낸 칸은 그대로). 관리자만. 예외 둘:
--   · 팀원이 한 명도 없는 맨 처음에는 누구나 첫 사람을 등록(그 사람이 관리자)
--   · 관리자가 아니어도 입사일이 비어 있는 사람의 입사일은 채울 수 있음(재직증명서 발급 때)
create or replace function bz_member_save(p_token text, p_row jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare me uuid; v_id text := p_row->>'id'; ex members; cols text; r jsonb := coalesce(p_row, '{}'::jsonb) - 'password';
begin
  if coalesce(v_id, '') = '' then return jsonb_build_object('ok', false, 'err', 'id'); end if;
  if not exists (select 1 from members) then
    r := r || jsonb_build_object('role', 'admin');
  else
    me := think_who(p_token);
    if me is null then return jsonb_build_object('ok', false, 'err', 'session'); end if;
    select * into ex from members where id::text = v_id;
    if not bz_is_admin(me) then
      if ex.id is null or ex.hire_date is not null or not (r ? 'hire_date') then return jsonb_build_object('ok', false, 'err', 'denied'); end if;
      r := jsonb_build_object('id', v_id, 'hire_date', r->'hire_date');
    end if;
    if ex.id is not null and ex.role = 'admin' and r ? 'role' and (r->>'role') is distinct from 'admin'
       and (select count(*) from members where role = 'admin') <= 1 then
      return jsonb_build_object('ok', false, 'err', 'lastadmin');
    end if;
  end if;
  if exists (select 1 from members where id::text = v_id) then
    select string_agg(quote_ident(column_name), ', ') into cols from information_schema.columns
     where table_schema = 'public' and table_name = 'members' and column_name not in ('id', 'password') and r ? column_name;
    if cols is not null then
      execute format('update members m set (%1$s) = (select %1$s from jsonb_populate_record(m, $1)) where m.id::text = $2', cols) using r, v_id;
    end if;
  else
    select string_agg(quote_ident(column_name), ', ') into cols from information_schema.columns
     where table_schema = 'public' and table_name = 'members' and column_name <> 'password' and r ? column_name;
    execute format('insert into members (%1$s) select %1$s from jsonb_populate_record(null::members, $1)', cols) using r;
    insert into member_secrets (member) values (v_id) on conflict (member) do nothing;
  end if;
  return jsonb_build_object('ok', true);
end $$;

create or replace function bz_member_delete(p_token text, p_id text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare me uuid := think_who(p_token);
begin
  if me is null then return jsonb_build_object('ok', false, 'err', 'session'); end if;
  if not bz_is_admin(me) then return jsonb_build_object('ok', false, 'err', 'denied'); end if;
  if exists (select 1 from members where id::text = p_id and role = 'admin') and (select count(*) from members where role = 'admin') <= 1 then
    return jsonb_build_object('ok', false, 'err', 'lastadmin');
  end if;
  delete from members where id::text = p_id;
  delete from member_secrets where member = p_id;
  delete from think_sessions where member::text = p_id;
  return jsonb_build_object('ok', true);
end $$;

grant execute on function think_login(uuid, text), think_set_pin(uuid, text, text), bz_set_pw(text, text, text),
  bz_member_save(text, jsonb), bz_member_delete(text, text) to anon, authenticated;

-- 확인용: 몇 명이 옮겨졌고, 그중 몇 명이 아직 초기 비밀번호(1234)인지
select (select count(*) from members) as members, count(*) as secrets, count(*) filter (where pw_hash is null) as still_1234 from member_secrets;
