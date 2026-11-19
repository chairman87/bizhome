-- ═══════════════════════════════════════════════════════════════
--  자동작업 대화·수정요청 잠그기 1/2 — 준비 (2026-11-19)
--
--  왜: 대화(routine_chats · routine_chat_messages)와 수정요청(routine_requests) 표는 공개키만 있으면 밖에서 누구나 줄을 넣고 고칠 수 있었습니다.
--      lemon803 의 클로드는 "글쓴이 이름"이 관리자면 고친 것을 바로 반영했고, 수정요청은 상태가 '승인'이면 반영했습니다.
--      그래서 누구든 관리자 이름을 적은 글이나 '승인'된 요청을 만들어 넣으면 인트라넷 코드를 바꿀 수 있었습니다.
--  그래서: 글 쓰기·반영 요청·승인은 서버 함수만 합니다. 로그인할 때 받은 출입증(think_login → think_who)으로 사람을 확인하고,
--          글쓴이·승인한 사람은 서버가 직접 적습니다(화면이 보낸 이름은 믿지 않음).
--          lemon803 의 처리기(chat_worker.py · process_requests.py)는 PC 전용 열쇠(C:\Users\PC\.claude\routine-board\pc_key.txt)로 rt_pc_* 함수만 부릅니다.
--          여기에는 열쇠의 지문(sha256)만 적습니다.
--
--  이 파일(1/2)은 칸과 함수만 만듭니다. 실행해도 예전 화면·예전 처리기가 그대로 동작합니다.
--  새 화면과 새 처리기를 올린 뒤 sql-routines-lock-2.sql 을 실행하면 세 표가 공개키로는 읽기만 되게 잠깁니다.
--  여러 번 실행해도 됩니다. (sql-routines.sql · sql-routines-chat.sql · sql-think-pin.sql · sql-login-1.sql 이 먼저 실행돼 있어야 함)
-- ═══════════════════════════════════════════════════════════════

create extension if not exists pgcrypto with schema extensions;

-- 누가 썼는지·누가 승인했는지 (서버가 출입증을 보고 적는 칸. 이름 칸은 화면 표시용으로 그대로 둠)
alter table routine_chats         add column if not exists author_id    uuid;
alter table routine_chat_messages add column if not exists author_id    uuid;
alter table routine_requests      add column if not exists requester_id uuid;
alter table routine_requests      add column if not exists reviewer_id  uuid;

-- ── 안에서만 쓰는 함수 ─────────────────────────
create or replace function rt_pc_ok(p_key text) returns boolean
language sql immutable set search_path = public, extensions as $$
  select encode(digest(coalesce(p_key, ''), 'sha256'), 'hex') = 'a221e132076f4dd50a4a9dd28b645278cab5b157749ad776fae1cc600dc28d24'
$$;
create or replace function rt_name(m uuid) returns text
language sql stable security definer set search_path = public as $$
  select name from members where id::text = m::text
$$;
-- 관리자만 보기(🔒) 작업인데 관리자가 아닌 사람이면 true
create or replace function rt_hidden(p_target text, p_admin boolean) returns boolean
language sql stable security definer set search_path = public as $$
  select not coalesce(p_admin, false) and exists (select 1 from routines where key = p_target and admin_only is true)
$$;
-- 새로 만들 때 대상 확인: 문제없으면 null, 아니면 오류 이름. p_need_repo = 자동 수정이 되는 대상이어야 함(대화)
create or replace function rt_target_err(p_target text, p_admin boolean, p_need_repo boolean) returns text
language plpgsql stable security definer set search_path = public as $$
declare r routines;
begin
  if p_target = '인트라넷' then return null; end if;
  select * into r from routines where key = p_target;
  if r.id is null then return 'target'; end if;
  if r.admin_only is true and not coalesce(p_admin, false) then return 'denied'; end if;
  if p_need_repo and coalesce(r.repo_path, '') = '' then return 'noedit'; end if;
  return null;
end $$;
create or replace function rt_label(p_target text) returns text
language sql stable security definer set search_path = public as $$
  select case when p_target = '인트라넷' then '인트라넷' else coalesce((select title from routines where key = p_target), p_target) end
$$;
-- 내 것인지: 서버가 적은 번호가 있으면 그것으로, 잠그기 전에 만든 옛 줄(번호 없음)은 이름으로
create or replace function rt_mine(p_owner_id uuid, p_owner text, m uuid, nm text) returns boolean
language sql immutable as $$
  select case when p_owner_id is not null then p_owner_id = m else p_owner is not null and p_owner = nm end
$$;
revoke all on function rt_pc_ok(text), rt_name(uuid), rt_hidden(text, boolean), rt_target_err(text, boolean, boolean), rt_label(text), rt_mine(uuid, text, uuid, text)
  from public, anon, authenticated;

-- ═══ 화면(로그인한 사람)이 부르는 함수 ═══════════════════════

-- 대화에 글 보내기. 대화(p_chat)가 아직 없으면 먼저 만듦(p_target · p_title). p_text 가 비어 있으면 대화만 만듦
create or replace function rt_chat_send(p_token text, p_chat uuid, p_target text, p_title text, p_text text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare m uuid := think_who(p_token); nm text; adm boolean; c routine_chats; e text; t timestamptz := now();
        txt text := left(trim(coalesce(p_text, '')), 20000);
begin
  if m is null then return jsonb_build_object('ok', false, 'err', 'session'); end if;
  if p_chat is null then return jsonb_build_object('ok', false, 'err', 'id'); end if;
  nm := rt_name(m); adm := bz_is_admin(m);
  select * into c from routine_chats where id = p_chat for update;
  if c.id is null then
    e := rt_target_err(p_target, adm, true);
    if e is not null then return jsonb_build_object('ok', false, 'err', e); end if;
    if coalesce(trim(p_title), '') = '' then return jsonb_build_object('ok', false, 'err', 'title'); end if;
    insert into routine_chats (id, target, target_label, title, author, author_id, status, changed_files, commits, last_message_at, created_at, updated_at)
    values (p_chat, p_target, rt_label(p_target), left(trim(p_title), 120), nm, m, '열림', '[]'::jsonb, 0, t, t, t)
    returning * into c;
  else
    if not (adm or rt_mine(c.author_id, c.author, m, nm)) or rt_hidden(c.target, adm) then return jsonb_build_object('ok', false, 'err', 'denied'); end if;
    if c.status = '닫힘' then return jsonb_build_object('ok', false, 'err', 'closed'); end if;
  end if;
  if txt <> '' then
    insert into routine_chat_messages (id, chat_id, role, author, author_id, text, status, created_at)
    values (gen_random_uuid(), c.id, 'user', nm, m, txt, '대기', t);
    update routine_chats set last_message_at = t, updated_at = t, status = case when status = '반영완료' then '열림' else status end
     where id = c.id returning * into c;
  end if;
  return jsonb_build_object('ok', true, 'chat', to_jsonb(c));
end $$;

-- 대화 닫기 (본인·관리자)
create or replace function rt_chat_close(p_token text, p_chat uuid) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare m uuid := think_who(p_token); nm text; c routine_chats;
begin
  if m is null then return jsonb_build_object('ok', false, 'err', 'session'); end if;
  nm := rt_name(m);
  select * into c from routine_chats where id = p_chat for update;
  if c.id is null then return jsonb_build_object('ok', false, 'err', 'notfound'); end if;
  if not (bz_is_admin(m) or rt_mine(c.author_id, c.author, m, nm)) then return jsonb_build_object('ok', false, 'err', 'denied'); end if;
  update routine_chats set status = '닫힘', updated_at = now() where id = p_chat;
  return jsonb_build_object('ok', true);
end $$;

-- 대화 삭제 (관리자만). 메시지도 같이 지움
create or replace function rt_chat_delete(p_token text, p_chat uuid) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare m uuid := think_who(p_token);
begin
  if m is null then return jsonb_build_object('ok', false, 'err', 'session'); end if;
  if not bz_is_admin(m) then return jsonb_build_object('ok', false, 'err', 'denied'); end if;
  delete from routine_chat_messages where chat_id = p_chat;
  delete from routine_chats where id = p_chat;
  return jsonb_build_object('ok', true);
end $$;

-- 대화에서 고친 것 반영: 관리자가 누르면 바로 '승인', 직원이 누르면 '검토대기'(관리자 승인 필요).
-- 복사본 이름·바뀐 파일은 화면이 보낸 값이 아니라 대화 줄(lemon803 이 적어 둔 것)에서 가져옴
create or replace function rt_chat_apply(p_token text, p_chat uuid) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare m uuid := think_who(p_token); nm text; adm boolean; c routine_chats; rid uuid := gen_random_uuid(); t timestamptz := now(); ans text;
begin
  if m is null then return jsonb_build_object('ok', false, 'err', 'session'); end if;
  nm := rt_name(m); adm := bz_is_admin(m);
  select * into c from routine_chats where id = p_chat for update;
  if c.id is null then return jsonb_build_object('ok', false, 'err', 'notfound'); end if;
  if not (adm or rt_mine(c.author_id, c.author, m, nm)) or rt_hidden(c.target, adm) then return jsonb_build_object('ok', false, 'err', 'denied'); end if;
  if c.status in ('반영대기', '닫힘') then return jsonb_build_object('ok', false, 'err', 'state'); end if;
  if c.branch is null or jsonb_array_length(coalesce(c.changed_files, '[]'::jsonb)) = 0 then return jsonb_build_object('ok', false, 'err', 'nochange'); end if;
  select text into ans from routine_chat_messages where chat_id = c.id and role = 'claude' order by created_at desc limit 1;
  insert into routine_requests (id, target, target_label, title, body, requester, requester_id, status, reviewer, reviewer_id, reviewed_at,
                                result, changed_files, diff_stat, branch, chat_id, comments, created_at, updated_at)
  values (rid, c.target, c.target_label, c.title, '💬 대화에서 고친 내용 (' || coalesce(c.commits, 0) || '번 고침). 과정은 대화 보기.', nm, m,
          case when adm then '승인' else '검토대기' end, case when adm then nm end, case when adm then m end, case when adm then t end,
          coalesce(ans, ''), c.changed_files, c.diff_stat, c.branch, c.id, '[]'::jsonb, t, t);
  update routine_chats set status = '반영대기', request_id = rid, last_message_at = t, updated_at = t where id = c.id;
  insert into routine_chat_messages (id, chat_id, role, author, text, status, finished_at, created_at)
  values (gen_random_uuid(), c.id, 'system', '안내',
          case when adm then nm || '님이 반영을 눌렀습니다. lemon803 이 10분 안에 합칩니다.' else nm || '님이 반영을 요청했습니다. 관리자 승인을 기다립니다.' end, '완료', t, t);
  return jsonb_build_object('ok', true, 'request_id', rid, 'approved', adm);
end $$;

-- 수정요청 올리기 (글로). 항상 '요청' 상태로 시작
create or replace function rt_req_new(p_token text, p_id uuid, p_target text, p_title text, p_body text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare m uuid := think_who(p_token); adm boolean; e text; t timestamptz := now();
begin
  if m is null then return jsonb_build_object('ok', false, 'err', 'session'); end if;
  adm := bz_is_admin(m);
  e := rt_target_err(p_target, adm, false);
  if e is not null then return jsonb_build_object('ok', false, 'err', e); end if;
  if coalesce(trim(p_title), '') = '' or coalesce(trim(p_body), '') = '' then return jsonb_build_object('ok', false, 'err', 'title'); end if;
  insert into routine_requests (id, target, target_label, title, body, requester, requester_id, status, comments, changed_files, created_at, updated_at)
  values (coalesce(p_id, gen_random_uuid()), p_target, rt_label(p_target), left(trim(p_title), 200), left(trim(p_body), 20000), rt_name(m), m, '요청', '[]'::jsonb, '[]'::jsonb, t, t);
  return jsonb_build_object('ok', true);
end $$;

-- 수정요청 지우기: 관리자는 아무거나, 요청한 사람은 아직 '요청' 상태일 때만(취소)
create or replace function rt_req_remove(p_token text, p_id uuid) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare m uuid := think_who(p_token); q routine_requests;
begin
  if m is null then return jsonb_build_object('ok', false, 'err', 'session'); end if;
  select * into q from routine_requests where id = p_id for update;
  if q.id is null then return jsonb_build_object('ok', false, 'err', 'notfound'); end if;
  if not bz_is_admin(m) then
    if not rt_mine(q.requester_id, q.requester, m, rt_name(m)) then return jsonb_build_object('ok', false, 'err', 'denied'); end if;
    if q.status <> '요청' then return jsonb_build_object('ok', false, 'err', 'state'); end if;
  end if;
  delete from routine_requests where id = p_id;
  return jsonb_build_object('ok', true);
end $$;

-- 승인·반려 (관리자만). 승인: '검토대기'이거나, 복사본이 남아 있는 '실패'(반영 다시 시도). 반려: '검토대기'만
create or replace function rt_req_review(p_token text, p_id uuid, p_action text, p_note text default null) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare m uuid := think_who(p_token); q routine_requests; t timestamptz := now();
begin
  if m is null then return jsonb_build_object('ok', false, 'err', 'session'); end if;
  if not bz_is_admin(m) then return jsonb_build_object('ok', false, 'err', 'denied'); end if;
  select * into q from routine_requests where id = p_id for update;
  if q.id is null then return jsonb_build_object('ok', false, 'err', 'notfound'); end if;
  if p_action = '승인' then
    if not (q.status = '검토대기' or (q.status = '실패' and q.branch is not null)) then return jsonb_build_object('ok', false, 'err', 'state'); end if;
    update routine_requests set status = '승인', reviewer = rt_name(m), reviewer_id = m, reviewed_at = t, error = null, updated_at = t where id = p_id;
  elsif p_action = '반려' then
    if q.status <> '검토대기' then return jsonb_build_object('ok', false, 'err', 'state'); end if;
    update routine_requests set status = '반려', reviewer = rt_name(m), reviewer_id = m, reviewed_at = t, review_note = nullif(left(trim(coalesce(p_note, '')), 2000), ''), updated_at = t where id = p_id;
  else
    return jsonb_build_object('ok', false, 'err', 'action');
  end if;
  return jsonb_build_object('ok', true);
end $$;

-- 수정요청에 댓글
create or replace function rt_req_comment(p_token text, p_id uuid, p_text text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare m uuid := think_who(p_token); q routine_requests;
begin
  if m is null then return jsonb_build_object('ok', false, 'err', 'session'); end if;
  if coalesce(trim(p_text), '') = '' then return jsonb_build_object('ok', false, 'err', 'title'); end if;
  select * into q from routine_requests where id = p_id for update;
  if q.id is null then return jsonb_build_object('ok', false, 'err', 'notfound'); end if;
  if rt_hidden(q.target, bz_is_admin(m)) then return jsonb_build_object('ok', false, 'err', 'denied'); end if;
  update routine_requests set comments = coalesce(comments, '[]'::jsonb) || jsonb_build_array(jsonb_build_object('by', rt_name(m), 'text', left(trim(p_text), 4000), 'at', now())), updated_at = now()
   where id = p_id;
  return jsonb_build_object('ok', true);
end $$;

-- ═══ lemon803 의 처리기(PC 전용 열쇠)가 부르는 함수 ═══════════

-- 답을 기다리는 사람 메시지(오래된 것부터 10개) + 그 대화 + 글쓴이가 지금 관리자인지(admin) + 그 사람이 오늘 보낸 메시지 수(today)
-- admin 은 서버가 적어 둔 author_id 로만 판단합니다. 이름은 보지 않습니다.
create or replace function rt_pc_msgs(p_key text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not rt_pc_ok(p_key) then return jsonb_build_object('ok', false, 'err', 'forbidden'); end if;
  return jsonb_build_object('ok', true, 'rows', coalesce((
    select jsonb_agg(s.x order by s.created_at) from (
      select g.created_at, to_jsonb(g) || jsonb_build_object(
               'chat', (select to_jsonb(c) from routine_chats c where c.id = g.chat_id),
               'admin', g.author_id is not null and bz_is_admin(g.author_id),
               'today', (select count(*) from routine_chat_messages d where d.role = 'user' and d.author_id = g.author_id
                           and d.created_at >= (date_trunc('day', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul'))) as x
        from routine_chat_messages g where g.role = 'user' and g.status = '대기' order by g.created_at limit 10) s), '[]'::jsonb));
end $$;

-- 처리할 수정요청. review_ok = 승인·반려한 사람이 서버가 확인한 관리자인지
create or replace function rt_pc_reqs(p_key text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not rt_pc_ok(p_key) then return jsonb_build_object('ok', false, 'err', 'forbidden'); end if;
  return jsonb_build_object('ok', true, 'rows', coalesce((
    select jsonb_agg(to_jsonb(q) || jsonb_build_object('review_ok', q.reviewer_id is not null and bz_is_admin(q.reviewer_id)) order by q.created_at)
      from routine_requests q where q.status in ('요청', '승인', '반려', '검토대기')), '[]'::jsonb));
end $$;

-- 한 대화의 최근 메시지 (세션을 잃었을 때 요약용)
create or replace function rt_pc_history(p_key text, p_chat uuid, p_limit int default 12) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not rt_pc_ok(p_key) then return jsonb_build_object('ok', false, 'err', 'forbidden'); end if;
  return jsonb_build_object('ok', true, 'rows', coalesce((
    select jsonb_agg(jsonb_build_object('role', s.role, 'author', s.author, 'text', s.text) order by s.created_at) from (
      select role, author, text, created_at from routine_chat_messages
       where chat_id = p_chat and role in ('user', 'claude') and status = '완료' order by created_at desc limit least(greatest(coalesce(p_limit, 12), 1), 50)) s), '[]'::jsonb));
end $$;

-- 처리 상태 적기: 표마다 정해진 칸만. 수정요청을 '승인'·'반려'로 바꾸는 것은 PC 도 못 함(사람이 화면에서만)
create or replace function rt_pc_patch(p_key text, p_table text, p_id uuid, p_fields jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare allowed text[]; cols text; f jsonb := coalesce(p_fields, '{}'::jsonb); n int;
begin
  if not rt_pc_ok(p_key) then return jsonb_build_object('ok', false, 'err', 'forbidden'); end if;
  if p_table = 'routine_chat_messages' then allowed := array['status', 'error', 'started_at', 'finished_at'];
  elsif p_table = 'routine_chats' then allowed := array['status', 'branch', 'session_id', 'changed_files', 'diff_stat', 'commits', 'last_message_at', 'updated_at']; f := f || jsonb_build_object('updated_at', now());
  elsif p_table = 'routine_requests' then
    allowed := array['status', 'result', 'changed_files', 'diff_stat', 'branch', 'commit', 'error', 'processed_at', 'applied_at', 'updated_at']; f := f || jsonb_build_object('updated_at', now());
    if f->>'status' in ('승인', '반려') then return jsonb_build_object('ok', false, 'err', 'status'); end if;
  else return jsonb_build_object('ok', false, 'err', 'table');
  end if;
  select string_agg(quote_ident(c), ', ') into cols from unnest(allowed) c where f ? c;
  if cols is null then return jsonb_build_object('ok', false, 'err', 'fields'); end if;
  execute format('update %1$I t set (%2$s) = (select %2$s from jsonb_populate_record(t, $1)) where t.id = $2', p_table, cols) using f, p_id;
  get diagnostics n = row_count;
  return jsonb_build_object('ok', true, 'found', n > 0);
end $$;

-- 대화에 클로드의 답(claude)이나 안내(system) 남기기. 사람 글(user)은 못 넣음
create or replace function rt_pc_say(p_key text, p_chat uuid, p_role text, p_text text, p_files jsonb default '[]'::jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare t timestamptz := now();
begin
  if not rt_pc_ok(p_key) then return jsonb_build_object('ok', false, 'err', 'forbidden'); end if;
  if p_role not in ('claude', 'system') then return jsonb_build_object('ok', false, 'err', 'role'); end if;
  if not exists (select 1 from routine_chats where id = p_chat) then return jsonb_build_object('ok', false, 'err', 'notfound'); end if;
  insert into routine_chat_messages (id, chat_id, role, author, text, status, changed_files, finished_at, created_at)
  values (gen_random_uuid(), p_chat, p_role, case when p_role = 'claude' then '클로드' else '안내' end, p_text, '완료', coalesce(p_files, '[]'::jsonb), t, t);
  update routine_chats set last_message_at = t, updated_at = t where id = p_chat;
  return jsonb_build_object('ok', true);
end $$;

revoke all on function rt_chat_send(text, uuid, text, text, text), rt_chat_close(text, uuid), rt_chat_delete(text, uuid), rt_chat_apply(text, uuid),
  rt_req_new(text, uuid, text, text, text), rt_req_remove(text, uuid), rt_req_review(text, uuid, text, text), rt_req_comment(text, uuid, text),
  rt_pc_msgs(text), rt_pc_reqs(text), rt_pc_history(text, uuid, int), rt_pc_patch(text, text, uuid, jsonb), rt_pc_say(text, uuid, text, text, jsonb) from public;
grant execute on function rt_chat_send(text, uuid, text, text, text), rt_chat_close(text, uuid), rt_chat_delete(text, uuid), rt_chat_apply(text, uuid),
  rt_req_new(text, uuid, text, text, text), rt_req_remove(text, uuid), rt_req_review(text, uuid, text, text), rt_req_comment(text, uuid, text),
  rt_pc_msgs(text), rt_pc_reqs(text), rt_pc_history(text, uuid, int), rt_pc_patch(text, text, uuid, jsonb), rt_pc_say(text, uuid, text, text, jsonb) to anon, authenticated;

-- 확인용
select (select count(*) from routine_chats) as chats, (select count(*) from routine_chat_messages) as messages, (select count(*) from routine_requests) as requests;
