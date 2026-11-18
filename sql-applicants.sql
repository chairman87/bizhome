-- ═══════════════════════════════════════════════════════════════
--  채용공고 (hire.html) — 잠긴 표 + 서버 함수 (2026-11-18)
--
--  대표 PC(lemon803)의 APPLICANT-SCREEN/screen.py 가 매일 사람인(나중에 잡코리아)의 새 지원자를 읽어
--  대표가 정한 기준(APPLICANT-SCREEN/rules.py)으로 통과 / 탈락예정 / 애매 로 나눠 이 표에 넣습니다.
--  '통과'인 사람은 PC 가 사람인에서 1차 면접 단계로 옮기고 여기에 '면접'으로 표시합니다. 불합격 처리는 하지 않습니다(2026-11-18 대표 지시).
--  나머지(애매·탈락예정)는 대표가 화면에서 사유를 보고 직접 정합니다.
--
--  지원자 개인정보라 카톡 주문(sql-kakao-orders.sql)과 같은 방식으로 잠가 둡니다:
--    · 규칙(policy)을 하나도 만들지 않음 = 공개키로는 읽기·쓰기 모두 막힘
--    · 대표 PC 는 전용 열쇠(PC 의 C:\Users\PC\.claude\applicant-screen\token.txt)로 ap_push·ap_pull·ap_done 만 부름. 여기에는 열쇠의 지문(sha256)만 적음
--    · 직원은 메모장과 같은 출입증(think_login → think_who, sql-think-pin.sql)으로 ap_list·ap_update 를 부름
--  연락처(전화·이메일)·주소는 넣지 않습니다(사람인에서 봄). 지원한 지 180일 지난 줄은 ap_push 때 지웁니다.
--
--  Supabase 대시보드 → SQL Editor 에 붙여넣고 Run 하세요. 여러 번 실행해도 됩니다. (sql-think-pin.sql 이 먼저 실행돼 있어야 함)
-- ═══════════════════════════════════════════════════════════════

create extension if not exists pgcrypto with schema extensions;

create table if not exists applicants (
  id           text primary key,              -- 'saramin:지원번호'
  site         text not null,                 -- 사람인 / 잡코리아
  rec_id       text,                          -- 공고 번호
  posting      text,                          -- 공고 제목
  job          text,                          -- 마케팅 / 경영지원 / 고객지원 / '' (알 수 없음)
  name         text,
  age          int,                           -- 화면에 보여 주기만 함(자동 판정에는 쓰지 않음)
  career       text,                          -- '총 4년 8개월' / '신입'
  last_company text,
  edu          text,
  salary_wish  text,
  has_photo    boolean,
  file_resume  boolean default false,         -- 첨부 파일(PDF) 이력서라 프로그램이 못 읽음
  applied_at   date,
  link         text,                          -- 사람인 이력서 화면 주소
  result       text not null,                 -- 프로그램 판정: 통과 / 탈락예정 / 애매
  reasons      jsonb default '[]'::jsonb,     -- 탈락·애매 사유
  notes        jsonb default '[]'::jsonb,     -- 참고(영상 경험 낱말 등)
  status       text default '대기',            -- 사람 결정: 대기 / 면접 / 불합격 / 보류
  memo         text,
  decided_by   text,
  decided_at   timestamptz,
  site_done    text,                          -- PC 가 사이트에 반영한 내용: '1차 면접 이동' / '불합격 처리' / 실패 사유
  site_done_at timestamptz,
  screened_at  timestamptz default now(),
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);
create index if not exists applicants_applied on applicants (applied_at desc);
alter table applicants enable row level security;
revoke all on applicants from anon, authenticated;

create or replace function ap_pc_ok(p_token text) returns boolean
language sql immutable set search_path = public, extensions as $$
  select encode(digest(coalesce(p_token, ''), 'sha256'), 'hex') = '232ec1519714f54c9f225303872ae33a9dcf34e369c76cbebc93f5401c19b4ae'
$$;

-- 대표 PC → 새로 읽은 지원자 넣기. 이미 있는 줄은 사람이 아직 결정하지 않은 '대기' 줄만 새 판정으로 바꿈(사람 결정 보존)
create or replace function ap_push(p_token text, p_rows jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare n int;
begin
  if not ap_pc_ok(p_token) then return jsonb_build_object('ok', false, 'err', 'forbidden'); end if;
  insert into applicants (id, site, rec_id, posting, job, name, age, career, last_company, edu, salary_wish, has_photo, file_resume, applied_at, link, result, reasons, notes,
                          status, decided_by, decided_at, site_done, site_done_at)
  select r->>'id', r->>'site', r->>'rec_id', left(r->>'posting', 200), r->>'job', left(r->>'name', 50), nullif(r->>'age', '')::int,
         left(r->>'career', 60), left(r->>'last_company', 100), left(r->>'edu', 100), left(r->>'salary_wish', 80),
         (r->>'has_photo')::boolean, coalesce((r->>'file_resume')::boolean, false), nullif(r->>'applied_at', '')::date, r->>'link',
         r->>'result', coalesce(r->'reasons', '[]'::jsonb), coalesce(r->'notes', '[]'::jsonb),
         -- PC 가 통과자를 사람인 1차 면접 단계로 옮겼으면 status='면접'·site_done 을 함께 보냄 (2026-11-18)
         case when r->>'status' = '면접' then '면접' else '대기' end, case when r->>'status' = '면접' then '자동' end, case when r->>'status' = '면접' then now() end,
         left(r->>'site_done', 200), case when r ? 'site_done' then now() end
    from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) r
  on conflict (id) do update set
    job = excluded.job, age = excluded.age, career = excluded.career, last_company = excluded.last_company, edu = excluded.edu,
    salary_wish = excluded.salary_wish, has_photo = excluded.has_photo, file_resume = excluded.file_resume,
    result = excluded.result, reasons = excluded.reasons, notes = excluded.notes, screened_at = now(), updated_at = now()
  where applicants.status = '대기';
  get diagnostics n = row_count;
  delete from applicants where applied_at < current_date - 180;
  return jsonb_build_object('ok', true, 'added', n);
end $$;

-- 대표 PC → 이미 본 지원번호(다시 읽지 않으려고)와, 사람이 결정했지만 아직 사이트에 반영하지 않은 줄
create or replace function ap_pull(p_token text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not ap_pc_ok(p_token) then return jsonb_build_object('ok', false, 'err', 'forbidden'); end if;
  return jsonb_build_object('ok', true,
    'seen', coalesce((select jsonb_agg(id) from applicants), '[]'::jsonb),
    'todo', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'rec_id', rec_id, 'name', name, 'status', status))
                        from applicants where status in ('면접', '불합격') and site_done is null), '[]'::jsonb));
end $$;

-- 대표 PC → 사이트에 반영한 결과 적기
create or replace function ap_done(p_token text, p_id text, p_text text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not ap_pc_ok(p_token) then return jsonb_build_object('ok', false, 'err', 'forbidden'); end if;
  update applicants set site_done = left(p_text, 200), site_done_at = now(), updated_at = now() where id = p_id;
  return jsonb_build_object('ok', found);
end $$;

-- 직원 → 목록 (지원한 지 p_days 일 이내)
create or replace function ap_list(p_token text, p_days int default 30) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare m uuid := think_who(p_token);
begin
  if m is null then return jsonb_build_object('ok', false, 'err', 'session'); end if;
  return jsonb_build_object('ok', true, 'rows', coalesce((
    select jsonb_agg(to_jsonb(a) order by a.applied_at desc, a.created_at desc) from applicants a
     where a.applied_at >= current_date - least(greatest(coalesce(p_days, 30), 1), 180)), '[]'::jsonb));
end $$;

-- 직원 → 결정·메모 (고칠 수 있는 칸만). 결정을 바꾸면 사이트 반영 표시를 지워 PC 가 다시 반영하게 함
create or replace function ap_update(p_token text, p_id text, p_patch jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare m uuid := think_who(p_token); nm text;
begin
  if m is null then return jsonb_build_object('ok', false, 'err', 'session'); end if;
  if p_patch ? 'status' and not (p_patch->>'status' in ('대기', '면접', '불합격', '보류')) then return jsonb_build_object('ok', false, 'err', 'status'); end if;
  select name into nm from members where id::text = m::text;
  update applicants set
    status     = case when p_patch ? 'status' then p_patch->>'status' else status end,
    memo       = case when p_patch ? 'memo'   then left(p_patch->>'memo', 500) else memo end,
    decided_by = case when p_patch ? 'status' then nm    else decided_by end,
    decided_at = case when p_patch ? 'status' then now() else decided_at end,
    site_done  = case when p_patch ? 'status' then null  else site_done end,
    site_done_at = case when p_patch ? 'status' then null else site_done_at end,
    updated_at = now()
  where id = p_id;
  if not found then return jsonb_build_object('ok', false, 'err', 'notfound'); end if;
  return jsonb_build_object('ok', true);
end $$;

grant execute on function ap_push(text, jsonb) to anon;
grant execute on function ap_pull(text) to anon;
grant execute on function ap_done(text, text, text) to anon;
grant execute on function ap_list(text, int) to anon;
grant execute on function ap_update(text, text, jsonb) to anon;
