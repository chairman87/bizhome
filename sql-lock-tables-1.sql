-- ═══════════════════════════════════════════════════════════════
--  민감한 표 잠그기 1/2 — 공용 서버 함수 만들기 (2026-11-19)
--
--  대상: 결제(payments) · 외주(contractors · contractor_pays) · 구독(subscriptions) · 견적(quotes) · 파트너스(partners)
--        + 비매출 샘플 발송(samples) · 파트너스 접촉 목록(partner_leads) — 바깥 사람의 이름 · 주소 · 연락처라 2026-11-26 추가
--        + 온보딩(onboarding) — 신규 입사자 이름 · 입사일이라 2026-11-28 추가
--  기준(사장님 결정): "로그인한 직원은 예전처럼 보고 쓰고, 밖에서 공개키만으로는 못 하게".
--  표는 2/2 에서 잠그고, 로그인 출입증(think_login 이 준 token)을 확인하는 아래 함수로만 읽고 씁니다.
--    · lk_list(출입증, 표)        : 목록. 🔒 관리자만 보기(admin_only) 칸이 있는 표는 그 줄을 관리자에게만 돌려줌
--    · lk_save(출입증, 표, 줄)    : 추가·수정(보낸 칸만 바뀜 = 예전 저장과 같음). 직원은 🔒 줄을 고치거나 🔒 표시를 바꿀 수 없음
--    · lk_delete(출입증, 표, id)  : 삭제. 직원은 🔒 줄을 못 지움
--    · lk_pc_dump(PC 열쇠, 표)    : lemon803 의 NAS 백업 · 파트너스 분석이 전체를 읽음
--  표를 더 잠그려면: 아래 lk_ok 의 목록에 표 이름을 넣고, common.js 의 LOCKED 에 한 줄, 2/2 의 목록에 추가.
--  먼저 필요한 것: sql-login-1.sql(think_who · bz_is_admin), sql-routines-lock-1.sql(rt_pc_ok)
--  이 파일만 실행해서는 아무것도 달라지지 않습니다. 여러 번 실행해도 됩니다.
-- ═══════════════════════════════════════════════════════════════

-- 이 함수들로 다룰 수 있는 표(여기 없는 이름은 전부 거절)
create or replace function lk_ok(p_table text) returns boolean language sql immutable as $$
  select p_table in ('payments', 'contractors', 'contractor_pays', 'subscriptions', 'quotes', 'partners', 'job_descs', 'samples', 'partner_leads', 'onboarding')
$$;

create or replace function lk_list(p_token text, p_table text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare m uuid := think_who(p_token); rows jsonb;
begin
  if m is null then return jsonb_build_object('ok', false, 'err', 'session'); end if;
  if not lk_ok(p_table) then return jsonb_build_object('ok', false, 'err', 'table'); end if;
  execute format('select coalesce(jsonb_agg(j), ''[]''::jsonb) from (select to_jsonb(t) as j from %I t) s where $1 or not coalesce((j->>''admin_only'')::boolean, false)', p_table)
    into rows using bz_is_admin(m);
  return jsonb_build_object('ok', true, 'rows', rows);
end $$;

create or replace function lk_save(p_token text, p_table text, p_row jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare m uuid := think_who(p_token); adm boolean; vid uuid; old jsonb; r jsonb := p_row; cols text;
begin
  if m is null then return jsonb_build_object('ok', false, 'err', 'session'); end if;
  if not lk_ok(p_table) then return jsonb_build_object('ok', false, 'err', 'table'); end if;
  adm := bz_is_admin(m);
  begin vid := (p_row->>'id')::uuid; exception when others then vid := null; end;
  if vid is null then return jsonb_build_object('ok', false, 'err', 'id'); end if;
  execute format('select to_jsonb(t) from %I t where id = $1', p_table) into old using vid;
  if not adm then
    if coalesce((old->>'admin_only')::boolean, false) then return jsonb_build_object('ok', false, 'err', 'denied'); end if;
    if r ? 'admin_only' then r := r || jsonb_build_object('admin_only', false); end if;   -- 직원은 🔒 를 걸 수 없음(화면에도 그 칸이 관리자에게만 보임)
  end if;
  -- 보낸 칸 가운데 실제로 있는 칸만 씀. 있던 줄이면 그 칸만 고치고, 새 줄이면 넣음(안 보낸 칸은 표의 기본값)
  select string_agg(quote_ident(column_name), ', ') filter (where old is null or column_name <> 'id')
    into cols from information_schema.columns where table_schema = 'public' and table_name = p_table and r ? column_name;
  if old is null then
    execute format('insert into %1$I (%2$s) select %2$s from jsonb_populate_record(null::%1$I, $1)', p_table, cols) using r;
  elsif cols is not null then
    execute format('update %1$I set (%2$s) = (select %2$s from jsonb_populate_record(null::%1$I, $1)) where id = $2', p_table, cols) using r, vid;
  end if;
  return jsonb_build_object('ok', true);
end $$;

create or replace function lk_delete(p_token text, p_table text, p_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare m uuid := think_who(p_token); old jsonb;
begin
  if m is null then return jsonb_build_object('ok', false, 'err', 'session'); end if;
  if not lk_ok(p_table) then return jsonb_build_object('ok', false, 'err', 'table'); end if;
  execute format('select to_jsonb(t) from %I t where id = $1', p_table) into old using p_id;
  if coalesce((old->>'admin_only')::boolean, false) and not bz_is_admin(m) then return jsonb_build_object('ok', false, 'err', 'denied'); end if;
  execute format('delete from %I where id = $1', p_table) using p_id;
  return jsonb_build_object('ok', true);
end $$;

create or replace function lk_pc_dump(p_key text, p_table text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare rows jsonb;
begin
  if not rt_pc_ok(p_key) then return jsonb_build_object('ok', false, 'err', 'forbidden'); end if;
  if not lk_ok(p_table) then return jsonb_build_object('ok', false, 'err', 'table'); end if;
  execute format('select coalesce(jsonb_agg(to_jsonb(t)), ''[]''::jsonb) from %I t', p_table) into rows;
  return jsonb_build_object('ok', true, 'rows', rows);
end $$;

select proname from pg_proc where proname like 'lk\_%' order by 1;
