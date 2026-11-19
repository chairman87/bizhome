-- ═══════════════════════════════════════════════════════════════
--  채용 관리 (recruit.html) — 잠긴 표 + 서버 함수 (2026-11-19)
--
--  채용 프로세스 6단계를 한눈에 보고, 채용 뒤(수습 3개월 평가 → 정규직 전환)까지 관리합니다.
--    ① 채용기술서 작성(JD · 하루 루틴 · 앞으로 배우게 될 것)  ② 업로드(잡코리아 · 사람인, 광고는 영업담당과)
--    ③ 서류 심사(합격자 면접일 조율)  ④ 면접(합격자 출근일 조율)  ⑤ 출근(계약서 · 온보딩)  ⑥ 정규직 전환(3개월 평가)
--  ①② 는 공고(recruit_posts) 한 줄, ③~⑥ 은 사람(recruit_people) 한 줄이 단계를 옮겨 다닙니다.
--
--  사람 이름·급여·평가가 들어가므로 채용공고(sql-applicants.sql)처럼 잠가 둡니다:
--    · 규칙(policy)을 하나도 만들지 않음 = 공개키로는 읽기·쓰기 모두 막힘
--    · 로그인할 때 받은 출입증(think_login → think_who)으로 아래 함수만 부름. 관리자와 운영진만(rc_can)
--  계약서 같은 파일은 넣지 않습니다(파일 보관함은 주소를 알면 열리는 공개 보관함이라서). 작성했는지 체크만 합니다.
--
--  여러 번 실행해도 됩니다. (sql-think-pin.sql · sql-login-1.sql · sql-applicants.sql 이 먼저 실행돼 있어야 함)
-- ═══════════════════════════════════════════════════════════════

create table if not exists recruit_posts (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,                 -- 공고 이름 (예: 콘텐츠 마케터)
  job         text,                          -- 마케팅 / 경영지원 / 고객지원 …
  status      text not null default '작성',   -- 작성(채용기술서 작성 중) / 업로드(올리는 중·공고 중) / 마감
  jd          text,                          -- JD (하는 일 · 자격)
  routine     text,                          -- 하루 루틴
  learn       text,                          -- 앞으로 배우게 될 것
  saramin     boolean default false,         -- 사람인에 올렸는지
  jobkorea    boolean default false,         -- 잡코리아에 올렸는지
  saramin_url text,
  jobkorea_url text,
  ad_note     text,                          -- 광고·영업담당과 주고받은 내용
  headcount   int,                           -- 모집 인원
  owner       text,                          -- 담당자
  opened_at   date,                          -- 공고 시작일
  closed_at   date,                          -- 마감일
  memo        text,
  created_by  text,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

create table if not exists recruit_people (
  id             uuid primary key default gen_random_uuid(),
  post_id        uuid,                        -- recruit_posts.id (없어도 됨)
  applicant_id   text unique,                 -- 채용공고(applicants.id)에서 넘어온 사람이면 그 번호
  name           text not null,
  job            text,
  source         text,                        -- 사람인 / 잡코리아 / 지인 추천 / 기타
  link           text,                        -- 이력서 화면 주소
  stage          text not null default '서류', -- 서류 / 면접 / 출근 / 수습 / 정규직 / 종료
  interview_at   timestamptz,                 -- 면접 일시
  interview_note text,                        -- 면접 메모
  start_date     date,                        -- 출근일(입사일)
  salary         text,                        -- 급여·조건
  checklist      jsonb default '{}'::jsonb,   -- 온보딩 체크 { "근로계약서 작성": true, … }
  eval_due       date,                        -- 3개월 평가 예정일 (출근일 + 3개월, 고칠 수 있음)
  eval_note      text,                        -- 평가 내용
  eval_result    text,                        -- 정규직 전환 / 수습 연장 / 종료
  converted_at   date,                        -- 정규직 전환일
  end_reason     text,                        -- 종료 사유 (불합격 / 입사 포기 / 수습 종료 …)
  ended_at       date,
  memo           text,
  log            jsonb default '[]'::jsonb,   -- 단계가 바뀐 기록 [{at, by, text}]
  created_by     text,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);
create index if not exists recruit_people_stage on recruit_people (stage);

alter table recruit_posts  enable row level security;
alter table recruit_people enable row level security;
revoke all on recruit_posts, recruit_people from anon, authenticated;

-- 볼 수 있는 사람: 관리자 + 운영진
create or replace function rc_can(m uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from members where id::text = m::text and (role = 'admin' or ops is true))
$$;

-- 한 줄 저장(안에서만 씀): 보낸 칸 중 허락된 칸만 고침. id 가 없거나 처음 보는 id 면 새 줄
create or replace function rc_upsert(p_table text, p_row jsonb, p_cols text[]) returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare v_id uuid := coalesce(nullif(p_row->>'id', '')::uuid, gen_random_uuid());
        r jsonb := p_row || jsonb_build_object('id', v_id, 'updated_at', now()); cols text; ex boolean;
begin
  select string_agg(quote_ident(c), ', ') into cols from unnest(p_cols || array['updated_at']) c where r ? c;
  execute format('select exists (select 1 from %I where id = $1)', p_table) into ex using v_id;
  if ex then
    execute format('update %1$I t set (%2$s) = (select %2$s from jsonb_populate_record(t, $1)) where t.id = $2', p_table, cols) using r, v_id;
  else
    execute format('insert into %1$I (id, %2$s) select id, %2$s from jsonb_populate_record(null::%1$I, $1)', p_table, cols) using r;
  end if;
  return v_id;
end $$;
revoke all on function rc_can(uuid), rc_upsert(text, jsonb, text[]) from public, anon, authenticated;

-- 읽기: 공고와 사람 전부
create or replace function rc_list(p_token text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare m uuid := think_who(p_token);
begin
  if m is null then return jsonb_build_object('ok', false, 'err', 'session'); end if;
  if not rc_can(m) then return jsonb_build_object('ok', false, 'err', 'denied'); end if;
  return jsonb_build_object('ok', true,
    'posts',  coalesce((select jsonb_agg(to_jsonb(p) order by p.created_at desc) from recruit_posts p), '[]'::jsonb),
    'people', coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at) from recruit_people x), '[]'::jsonb),
    'waiting', (select count(*) from applicants a where a.status = '면접' and a.applied_at >= current_date - 30
                  and not exists (select 1 from recruit_people x where x.applicant_id = a.id)));
end $$;

-- 공고 저장
create or replace function rc_post_save(p_token text, p_row jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare m uuid := think_who(p_token); nm text; r jsonb := coalesce(p_row, '{}'::jsonb); isnew boolean; v_id uuid;
begin
  if m is null then return jsonb_build_object('ok', false, 'err', 'session'); end if;
  if not rc_can(m) then return jsonb_build_object('ok', false, 'err', 'denied'); end if;
  isnew := nullif(r->>'id', '') is null or not exists (select 1 from recruit_posts where id = (r->>'id')::uuid);
  if isnew and coalesce(trim(r->>'title'), '') = '' then return jsonb_build_object('ok', false, 'err', 'title'); end if;
  if r ? 'status' and not (r->>'status' in ('작성', '업로드', '마감')) then return jsonb_build_object('ok', false, 'err', 'status'); end if;
  if isnew then select name into nm from members where id::text = m::text; r := r || jsonb_build_object('created_by', nm); end if;
  v_id := rc_upsert('recruit_posts', r, array['title', 'job', 'status', 'jd', 'routine', 'learn', 'saramin', 'jobkorea', 'saramin_url', 'jobkorea_url',
                                              'ad_note', 'headcount', 'owner', 'opened_at', 'closed_at', 'memo'] || case when isnew then array['created_by'] else array[]::text[] end);
  return jsonb_build_object('ok', true, 'row', (select to_jsonb(p) from recruit_posts p where p.id = v_id));
end $$;

-- 공고 삭제 (딸린 사람이 없을 때만)
create or replace function rc_post_delete(p_token text, p_id uuid) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare m uuid := think_who(p_token);
begin
  if m is null then return jsonb_build_object('ok', false, 'err', 'session'); end if;
  if not rc_can(m) then return jsonb_build_object('ok', false, 'err', 'denied'); end if;
  if exists (select 1 from recruit_people where post_id = p_id) then return jsonb_build_object('ok', false, 'err', 'haspeople'); end if;
  delete from recruit_posts where id = p_id;
  return jsonb_build_object('ok', true);
end $$;

-- 사람 저장. 단계가 바뀌면 기록(log)에 남김. 출근일을 넣으면 3개월 평가 예정일을 자동으로 잡음(따로 보내면 그 값)
create or replace function rc_person_save(p_token text, p_row jsonb, p_note text default null) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare m uuid := think_who(p_token); nm text; r jsonb := coalesce(p_row, '{}'::jsonb) - 'log' - 'applicant_id'; isnew boolean; v_id uuid; old_stage text; new_stage text; txt text;
begin
  if m is null then return jsonb_build_object('ok', false, 'err', 'session'); end if;
  if not rc_can(m) then return jsonb_build_object('ok', false, 'err', 'denied'); end if;
  select name into nm from members where id::text = m::text;
  isnew := nullif(r->>'id', '') is null or not exists (select 1 from recruit_people where id = (r->>'id')::uuid);
  if isnew and coalesce(trim(r->>'name'), '') = '' then return jsonb_build_object('ok', false, 'err', 'name'); end if;
  if r ? 'stage' and not (r->>'stage' in ('서류', '면접', '출근', '수습', '정규직', '종료')) then return jsonb_build_object('ok', false, 'err', 'stage'); end if;
  if not isnew then select stage into old_stage from recruit_people where id = (r->>'id')::uuid; end if;
  if r ? 'start_date' and not (r ? 'eval_due') and nullif(r->>'start_date', '') is not null then
    r := r || jsonb_build_object('eval_due', ((r->>'start_date')::date + interval '3 months')::date);
  end if;
  if isnew then r := r || jsonb_build_object('created_by', nm); end if;
  v_id := rc_upsert('recruit_people', r, array['post_id', 'name', 'job', 'source', 'link', 'stage', 'interview_at', 'interview_note', 'start_date', 'salary', 'checklist',
                                               'eval_due', 'eval_note', 'eval_result', 'converted_at', 'end_reason', 'ended_at', 'memo'] || case when isnew then array['created_by'] else array[]::text[] end);
  select stage into new_stage from recruit_people where id = v_id;
  txt := case when isnew then '등록 (' || new_stage || ')' when new_stage is distinct from old_stage then old_stage || ' → ' || new_stage end;
  if coalesce(trim(p_note), '') <> '' then txt := coalesce(txt || ' · ', '') || left(trim(p_note), 300); end if;
  if txt is not null then
    update recruit_people set log = coalesce(log, '[]'::jsonb) || jsonb_build_array(jsonb_build_object('at', now(), 'by', nm, 'text', txt)) where id = v_id;
  end if;
  return jsonb_build_object('ok', true, 'row', (select to_jsonb(x) from recruit_people x where x.id = v_id));
end $$;

-- 사람 삭제 (잘못 넣은 줄 지우기용. 채용공고에서 넘어온 사람은 다시 가져오지 않도록 '종료'로 두는 것을 권함)
create or replace function rc_person_delete(p_token text, p_id uuid) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare m uuid := think_who(p_token);
begin
  if m is null then return jsonb_build_object('ok', false, 'err', 'session'); end if;
  if not rc_can(m) then return jsonb_build_object('ok', false, 'err', 'denied'); end if;
  delete from recruit_people where id = p_id;
  return jsonb_build_object('ok', true);
end $$;

-- 채용공고 화면에서 '면접'으로 표시된 사람(최근 30일 지원) 가져오기 → 서류 심사 칸(면접일 조율 대상)
create or replace function rc_import(p_token text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare m uuid := think_who(p_token); n int;
begin
  if m is null then return jsonb_build_object('ok', false, 'err', 'session'); end if;
  if not rc_can(m) then return jsonb_build_object('ok', false, 'err', 'denied'); end if;
  insert into recruit_people (applicant_id, name, job, source, link, stage, created_by, log)
  select a.id, coalesce(nullif(a.name, ''), '(이름 없음)'), nullif(a.job, ''), a.site, a.link, '서류', '채용공고',
         jsonb_build_array(jsonb_build_object('at', now(), 'by', '채용공고', 'text', '서류 통과(면접 대상) → 가져옴'))
    from applicants a
   where a.status = '면접' and a.applied_at >= current_date - 30
  on conflict (applicant_id) do nothing;
  get diagnostics n = row_count;
  return jsonb_build_object('ok', true, 'added', n);
end $$;

grant execute on function rc_list(text), rc_post_save(text, jsonb), rc_post_delete(text, uuid), rc_person_save(text, jsonb, text),
  rc_person_delete(text, uuid), rc_import(text) to anon, authenticated;

-- 확인용
select (select count(*) from recruit_posts) as posts, (select count(*) from recruit_people) as people;
