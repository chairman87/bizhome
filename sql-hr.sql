-- ═══════════════════════════════════════════════════════════════
--  인사 서류 (hr.html) — 잠긴 표 + 서버 함수 (2026-11-26)
--
--  직원의 이름 · 주소 · 연락처를 넣으면 채용계약서(수습) · 채용계약서(정규) · 비밀유지서약서가
--  워드(.docx) 파일로 나오고, 누구에게 어떤 서류를 만들었는지 · 서명을 받았는지를 한 화면에서 관리합니다.
--    hr_companies : 회사(사업체명 · 주소 · 근무장소 · 대표자) — 서류의 사업주 칸
--    hr_templates : 서류 양식(수습 / 정규 / 비밀유지). {이름} 같은 빈칸이 들어 있는 글
--    hr_people    : 직원(이름 · 주소 · 연락처 · 입사일 · 연봉 …)
--    hr_docs      : 만든 서류(그때 채워진 글 전체를 보관 → 언제든 같은 워드 파일을 다시 받음)
--
--  주소 · 연락처 · 연봉이 들어가므로 채용 관리(sql-recruit.sql)처럼 잠가 둡니다:
--    · 규칙(policy)을 하나도 만들지 않음 = 공개키로는 읽기·쓰기 모두 막힘
--    · 로그인할 때 받은 출입증(think_login → think_who)으로 아래 함수만 부름. 관리자만(hr_can)
--  워드 파일 자체는 저장소에 올리지 않습니다(파일 보관함은 주소를 알면 열리는 공개 보관함). 글만 보관하고 받을 때마다 새로 만듭니다.
--  이 저장소는 공개라 양식 글과 회사 주소는 여기 적지 않습니다(맥북 클로드코드/백업/인사서류-양식-20261126.sql 로 따로 넣음).
--
--  여러 번 실행해도 됩니다. (sql-login-1.sql · sql-recruit.sql 이 먼저 실행돼 있어야 함 — think_who · rc_upsert 를 씀)
-- ═══════════════════════════════════════════════════════════════

create table if not exists hr_companies (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,                 -- 사업체명 (예: 식이해법연구소)
  addr       text,                          -- 사업체 주소 (서명 칸)
  work_addr  text,                          -- 근무장소 (제3조)
  ceo        text,                          -- 대표자 (서명 칸에 찍히는 그대로. 예: 홍 길 동)
  sort       int default 0,
  created_by text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 도장(2026-11-26): 'data:image/png;base64,…' 글로 보관. 파일 보관함은 공개라 쓰지 않음
alter table hr_companies add column if not exists seal text;

create table if not exists hr_templates (
  kind       text primary key,              -- 수습 / 정규 / 비밀유지 / 사직
  title      text not null,                 -- 화면에 보이는 이름 (예: 채용계약서(수습))
  body       text not null,                 -- 양식 글. {이름} {주소} {연락처} … 가 채워짐
  updated_by text,
  updated_at timestamptz default now()
);

create table if not exists hr_people (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid,                          -- hr_companies.id
  name        text not null,
  address     text,
  phone       text,
  job_desc    text,                          -- 업무내용 (제5조)
  start_date  date,                          -- 입사일(수습 시작일)
  end_date    date,                          -- 수습 종료일 (비우면 입사일 + 3개월 - 1일)
  salary_year bigint,                        -- 연 급여(원)
  meal        int default 200000,            -- 식대(원)
  status      text not null default '수습',   -- 수습 / 정규 / 퇴사
  memo        text,
  created_by  text,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- 고정 연장 · 휴일 시간(2026-11-26): 비어 있으면 최저임금에 맞춰 자동으로 잡고, 직접 넣으면 그 시간으로 계산
alter table hr_people add column if not exists ot_hours int;
alter table hr_people add column if not exists hol_hours int;

create table if not exists hr_docs (
  id         uuid primary key default gen_random_uuid(),
  person_id  uuid not null references hr_people(id) on delete cascade,
  kind       text not null,                  -- 수습 / 정규 / 비밀유지
  title      text,                           -- 서류 이름 (만들 때의 양식 이름)
  file_name  text,                           -- 받을 때 파일 이름
  body       text not null,                  -- 채워진 글 전체 (양식을 나중에 고쳐도 이 서류는 그대로)
  doc_date   date,                           -- 작성일(서류에 찍힌 날짜)
  signed     boolean default false,          -- 서명 받음
  signed_at  date,
  memo       text,
  created_by text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists hr_docs_person on hr_docs (person_id);

alter table hr_companies enable row level security;
alter table hr_templates enable row level security;
alter table hr_people    enable row level security;
alter table hr_docs      enable row level security;
revoke all on hr_companies, hr_templates, hr_people, hr_docs from anon, authenticated;

-- 볼 수 있는 사람: 관리자만
create or replace function hr_can(m uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from members where id::text = m::text and role = 'admin')
$$;
revoke all on function hr_can(uuid) from public, anon, authenticated;

-- 읽기: 전부
create or replace function hr_list(p_token text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare m uuid := think_who(p_token);
begin
  if m is null then return jsonb_build_object('ok', false, 'err', 'session'); end if;
  if not hr_can(m) then return jsonb_build_object('ok', false, 'err', 'denied'); end if;
  return jsonb_build_object('ok', true,
    'companies', coalesce((select jsonb_agg(to_jsonb(c) order by c.sort, c.created_at) from hr_companies c), '[]'::jsonb),
    'templates', coalesce((select jsonb_agg(to_jsonb(t) order by t.kind) from hr_templates t), '[]'::jsonb),
    'people',    coalesce((select jsonb_agg(to_jsonb(p) order by p.created_at desc) from hr_people p), '[]'::jsonb),
    'docs',      coalesce((select jsonb_agg(to_jsonb(d) order by d.created_at) from hr_docs d), '[]'::jsonb));
end $$;

-- 한 줄 저장: 회사 · 직원 · 서류. 보낸 칸 중 허락된 칸만 고침. 만든 사람은 서버가 적음
create or replace function hr_save(p_token text, p_table text, p_row jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare m uuid := think_who(p_token); nm text; r jsonb := coalesce(p_row, '{}'::jsonb) - 'created_by' - 'created_at';
        cols text[]; isnew boolean; v_id uuid; out_row jsonb;
begin
  if m is null then return jsonb_build_object('ok', false, 'err', 'session'); end if;
  if not hr_can(m) then return jsonb_build_object('ok', false, 'err', 'denied'); end if;
  if p_table = 'hr_people' then
    cols := array['company_id', 'name', 'address', 'phone', 'job_desc', 'start_date', 'end_date', 'salary_year', 'meal', 'ot_hours', 'hol_hours', 'status', 'memo'];
    if r ? 'status' and not (r->>'status' in ('수습', '정규', '퇴사')) then return jsonb_build_object('ok', false, 'err', 'status'); end if;
  elsif p_table = 'hr_docs' then
    cols := array['person_id', 'kind', 'title', 'file_name', 'body', 'doc_date', 'signed', 'signed_at', 'memo'];
    if r ? 'kind' and not (r->>'kind' in ('수습', '정규', '비밀유지', '사직')) then return jsonb_build_object('ok', false, 'err', 'kind'); end if;
  elsif p_table = 'hr_companies' then
    cols := array['name', 'addr', 'work_addr', 'ceo', 'sort', 'seal'];
    if r ? 'seal' and r->>'seal' is not null and (r->>'seal' not like 'data:image/png;base64,%' or length(r->>'seal') > 700000) then return jsonb_build_object('ok', false, 'err', 'seal'); end if;
  else
    return jsonb_build_object('ok', false, 'err', 'table');
  end if;
  if nullif(r->>'id', '') is null then isnew := true;
  else execute format('select not exists (select 1 from %I where id = $1)', p_table) into isnew using (r->>'id')::uuid; end if;
  if isnew then
    if p_table in ('hr_people', 'hr_companies') and coalesce(trim(r->>'name'), '') = '' then return jsonb_build_object('ok', false, 'err', 'name'); end if;
    if p_table = 'hr_docs' and (nullif(r->>'person_id', '') is null or nullif(r->>'kind', '') is null or coalesce(trim(r->>'body'), '') = '') then return jsonb_build_object('ok', false, 'err', 'doc'); end if;
    select name into nm from members where id::text = m::text;
    r := r || jsonb_build_object('created_by', nm); cols := cols || array['created_by'];
  end if;
  v_id := rc_upsert(p_table, r, cols);
  execute format('select to_jsonb(t) from %I t where t.id = $1', p_table) into out_row using v_id;
  return jsonb_build_object('ok', true, 'row', out_row);
end $$;

-- 한 줄 삭제. 직원을 지우면 그 사람의 서류도 같이 지워짐. 직원이 딸린 회사는 못 지움
create or replace function hr_delete(p_token text, p_table text, p_id uuid) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare m uuid := think_who(p_token);
begin
  if m is null then return jsonb_build_object('ok', false, 'err', 'session'); end if;
  if not hr_can(m) then return jsonb_build_object('ok', false, 'err', 'denied'); end if;
  if p_table = 'hr_people' then delete from hr_people where id = p_id;
  elsif p_table = 'hr_docs' then delete from hr_docs where id = p_id;
  elsif p_table = 'hr_companies' then
    if exists (select 1 from hr_people where company_id = p_id) then return jsonb_build_object('ok', false, 'err', 'haspeople'); end if;
    delete from hr_companies where id = p_id;
  else return jsonb_build_object('ok', false, 'err', 'table');
  end if;
  return jsonb_build_object('ok', true);
end $$;

-- 양식 저장 (수습 / 정규 / 비밀유지)
create or replace function hr_template_save(p_token text, p_kind text, p_title text, p_body text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare m uuid := think_who(p_token); nm text;
begin
  if m is null then return jsonb_build_object('ok', false, 'err', 'session'); end if;
  if not hr_can(m) then return jsonb_build_object('ok', false, 'err', 'denied'); end if;
  if not (p_kind in ('수습', '정규', '비밀유지', '사직')) then return jsonb_build_object('ok', false, 'err', 'kind'); end if;
  if coalesce(trim(p_body), '') = '' then return jsonb_build_object('ok', false, 'err', 'body'); end if;
  select name into nm from members where id::text = m::text;
  insert into hr_templates (kind, title, body, updated_by, updated_at) values (p_kind, coalesce(nullif(trim(p_title), ''), p_kind), p_body, nm, now())
  on conflict (kind) do update set title = excluded.title, body = excluded.body, updated_by = excluded.updated_by, updated_at = now();
  return jsonb_build_object('ok', true, 'row', (select to_jsonb(t) from hr_templates t where t.kind = p_kind));
end $$;

grant execute on function hr_list(text), hr_save(text, text, jsonb), hr_delete(text, text, uuid), hr_template_save(text, text, text, text) to anon, authenticated;

-- 확인용
select (select count(*) from hr_companies) as companies, (select count(*) from hr_templates) as templates,
       (select count(*) from hr_people) as people, (select count(*) from hr_docs) as docs;
