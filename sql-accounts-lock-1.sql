-- ═══════════════════════════════════════════════════════════════
--  계정 관리(accounts) 잠그기 1/2 — 서버 함수 만들기 (2026-11-19)
--
--  왜: accounts 표(서비스별 아이디·비밀번호)가 공개키만으로 밖에서 읽히고 고쳐졌습니다.
--  어떻게: 표는 잠그고(2/2), 로그인 출입증(think_login 이 준 token)을 확인하는 아래 함수로만 읽고 씁니다.
--    · acc_list   : 목록 읽기. 🔒 관리자만 보기 항목은 관리자에게만 돌려줌(예전엔 화면이 가리기만 했음)
--    · acc_save   : 추가·수정. 등록한 사람·고친 사람·시각은 서버가 적음. 직원은 🔒 항목을 고치거나 🔒 표시를 바꿀 수 없음
--    · acc_delete : 삭제(관리자만)
--    · acc_pc_dump: lemon803 의 NAS 백업(INTRANET-BACKUP)이 PC 전용 열쇠로 전체를 읽음
--  먼저 필요한 것: sql-login-1.sql(think_who · bz_is_admin), sql-routines-lock-1.sql(rt_name · rt_pc_ok)
--  이 파일만 실행해서는 아무것도 달라지지 않습니다(표는 아직 열려 있음). 여러 번 실행해도 됩니다.
-- ═══════════════════════════════════════════════════════════════

create or replace function acc_list(p_token text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare m uuid := think_who(p_token); adm boolean;
begin
  if m is null then return jsonb_build_object('ok', false, 'err', 'session'); end if;
  adm := bz_is_admin(m);
  return jsonb_build_object('ok', true, 'rows', coalesce(
    (select jsonb_agg(to_jsonb(a) order by a.created_at, a.id) from accounts a where adm or not coalesce(a.admin_only, false)), '[]'::jsonb));
end $$;

create or replace function acc_save(p_token text, p_row jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare m uuid := think_who(p_token); adm boolean; nm text; vid uuid; old accounts; r accounts;
begin
  if m is null then return jsonb_build_object('ok', false, 'err', 'session'); end if;
  adm := bz_is_admin(m); nm := rt_name(m);
  begin vid := (p_row->>'id')::uuid; exception when others then vid := null; end;
  if vid is null then return jsonb_build_object('ok', false, 'err', 'id'); end if;
  if coalesce(btrim(p_row->>'service'), '') = '' then return jsonb_build_object('ok', false, 'err', 'service'); end if;
  select * into old from accounts where id = vid;
  if found then
    if coalesce(old.admin_only, false) and not adm then return jsonb_build_object('ok', false, 'err', 'denied'); end if;
    r := jsonb_populate_record(old, p_row);          -- 화면이 안 보낸 칸은 예전 값 그대로
    r.created_by := old.created_by; r.created_at := old.created_at;
    if not adm then r.admin_only := old.admin_only; end if;
    delete from accounts where id = vid;
  else
    r := jsonb_populate_record(null::accounts, p_row);
    r.created_by := nm; r.created_at := now();
    if not adm then r.admin_only := false; end if;
  end if;
  r.id := vid; r.updated_by := nm; r.updated_at := now();
  r.admin_only := coalesce(r.admin_only, false); r.unused := coalesce(r.unused, false);
  insert into accounts select r.*;
  return jsonb_build_object('ok', true);
end $$;

create or replace function acc_delete(p_token text, p_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare m uuid := think_who(p_token);
begin
  if m is null then return jsonb_build_object('ok', false, 'err', 'session'); end if;
  if not bz_is_admin(m) then return jsonb_build_object('ok', false, 'err', 'denied'); end if;
  delete from accounts where id = p_id;
  return jsonb_build_object('ok', true);
end $$;

create or replace function acc_pc_dump(p_key text) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not rt_pc_ok(p_key) then return jsonb_build_object('ok', false, 'err', 'forbidden'); end if;
  return jsonb_build_object('ok', true, 'rows', coalesce((select jsonb_agg(to_jsonb(a) order by a.created_at, a.id) from accounts a), '[]'::jsonb));
end $$;

select proname from pg_proc where proname like 'acc\_%' order by 1;
