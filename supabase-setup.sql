-- ============================================================
-- 비즈홈: Supabase 저장소 준비 (한 번만 실행)
-- Supabase 화면 왼쪽 메뉴 "SQL Editor" > "New query" 에 전부 붙여넣고 Run
-- ============================================================

-- 1) 팀원
create table if not exists members (
  id          uuid primary key,
  name        text not null unique,
  color       text,
  sort_order  int default 0,
  role        text default 'member',   -- admin(관리자) / member(팀원)
  leave_total numeric default 15,      -- 연차 총 일수
  password    text,                    -- 로그인 비밀번호 (관리자가 볼 수 있음)
  hire_date   date,                    -- 입사일 (연차 자동 계산 기준)
  leave_adjust numeric default 0,      -- 연차 조정 (개근 못 한 달 -1 등)
  title       text,                    -- 직급 (주임, 대리 등)
  updated_at  timestamptz default now()
);
-- 이미 만든 저장소에 비밀번호 칸만 추가할 때는 아래 한 줄만 실행
alter table members add column if not exists password text;
alter table members add column if not exists hire_date date;
alter table members add column if not exists leave_adjust numeric default 0;
alter table members add column if not exists title text;

-- 2) 비즈홈 메뉴 (부서와 페이지. 관리자가 화면에서 편집)
create table if not exists menu (
  id         uuid primary key,
  type       text not null,             -- dept(부서) / page(페이지)
  parent     uuid,                      -- 페이지가 속한 부서 id
  name       text not null,
  icon       text,
  color      text,                      -- 부서 색 이름
  href       text,                      -- 누르면 열리는 화면 (없으면 준비 중)
  sort_order int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 3) 업무요청/보고
create table if not exists tasks (
  id           uuid primary key,
  title        text not null,                  -- 업무
  assignee     text,                           -- 담당자
  priority     text default '보통',            -- 높음 / 보통 / 낮음
  start_date   date,
  due_date     date,                           -- 마감일
  status       text not null default '요청',   -- 요청 / 진행중 / 보고완료 / 완료 / 보류
  progress     int default 0,                  -- 진행률 0~100
  memo         text,                           -- 요청 내용
  comments     jsonb default '[]',             -- 보고·댓글·변경 기록
  created_by   text,                           -- 요청자
  created_at   timestamptz default now(),
  updated_at   timestamptz default now(),
  completed_at timestamptz
);

-- 4) 연차/휴가
create table if not exists leaves (
  id         uuid primary key,
  name       text not null,                    -- 신청자
  type       text not null,                    -- 연차 / 오전 반차 / 오후 반차 / 병가 / 경조사 / 기타
  start_date date not null,
  end_date   date,
  days       numeric default 1,                -- 일수 (토·일 제외)
  reason     text,
  status     text not null default '신청',     -- 신청 / 승인 / 반려 / 취소
  decided_by text,                             -- 승인·반려한 관리자
  decided_at timestamptz,
  comments   jsonb default '[]',
  created_by text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 4-5) 프로젝트 관리 (sql-projects.sql 과 동일)
create table if not exists projects (id uuid primary key, name text not null, goal text, status text default '진행중', start_date date, target_date date, owner text, phases jsonb default '[]', checks jsonb default '[]', memo text, created_by text, created_at timestamptz default now(), updated_at timestamptz default now());
create table if not exists project_items (id uuid primary key, project_id uuid not null, phase text, title text not null, assignee text, start_date date, due_date date, status text default '예정', note text, checklist jsonb default '[]', sort_order int default 0, done_at timestamptz, created_by text, created_at timestamptz default now(), updated_by text, updated_at timestamptz default now());
alter table projects enable row level security; alter table project_items enable row level security; drop policy if exists "team_all" on projects; drop policy if exists "team_all" on project_items; create policy "team_all" on projects for all using (true) with check (true); create policy "team_all" on project_items for all using (true) with check (true); alter publication supabase_realtime add table projects; alter publication supabase_realtime add table project_items;

-- 4-4) 광고 영상 리스트 (sql-ads.sql 과 동일)
create table if not exists ads (id uuid primary key, product text not null, date date, title text not null, editor text, meta_account text, meta_budget text, tiktok text, status text default '운영중', note text, created_by text, created_at timestamptz default now(), updated_by text, updated_at timestamptz default now());
alter table ads enable row level security; drop policy if exists "team_all" on ads; create policy "team_all" on ads for all using (true) with check (true); alter publication supabase_realtime add table ads;

-- 4-3) 공지사항 · 공용계정 (sql-notices-accounts.sql 과 동일)
create table if not exists notices (id uuid primary key, title text not null, content text, pinned boolean default false, reads jsonb default '[]', created_by text, created_at timestamptz default now(), updated_at timestamptz default now());
create table if not exists accounts (id uuid primary key, service text not null, url text, login_id text, password text, purpose text, owner text, memo text, created_by text, created_at timestamptz default now(), updated_by text, updated_at timestamptz default now());
alter table accounts add column if not exists group_name text; alter table accounts add column if not exists shared_with text; alter table accounts add column if not exists fee numeric; alter table accounts add column if not exists cycle text; alter table accounts add column if not exists billing_day int; alter table accounts add column if not exists start_date date; alter table accounts add column if not exists end_date date; alter table accounts add column if not exists admin_only boolean default false;
alter table notices enable row level security; alter table accounts enable row level security;
drop policy if exists "team_all" on notices; drop policy if exists "team_all" on accounts;
create policy "team_all" on notices for all using (true) with check (true); create policy "team_all" on accounts for all using (true) with check (true);
alter publication supabase_realtime add table notices; alter publication supabase_realtime add table accounts;

-- 4-2) 업무 분장 (R&R) — 버전별로 쌓임
create table if not exists rnr (
  id             uuid primary key,
  version        int not null,                -- 1, 2, 3 ...
  title          text not null,               -- 예: 9월 업무 분장
  effective_date date,                        -- 적용일
  note           text,                        -- 변경 요약
  teams          jsonb default '[]',          -- [{name, rows:[{name, duties}]}]
  footer         text,                        -- 하단 안내문
  created_by     text,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

-- 5) 접근 권한: 링크(anon 키)를 가진 사람은 모두 읽고 쓸 수 있음 (소규모 팀 전제)
alter table members enable row level security;
alter table menu    enable row level security;
alter table tasks   enable row level security;
alter table leaves  enable row level security;
alter table rnr     enable row level security;
drop policy if exists "team_all" on members;
drop policy if exists "team_all" on menu;
drop policy if exists "team_all" on tasks;
drop policy if exists "team_all" on leaves;
drop policy if exists "team_all" on rnr;
create policy "team_all" on members for all using (true) with check (true);
create policy "team_all" on menu    for all using (true) with check (true);
create policy "team_all" on tasks   for all using (true) with check (true);
create policy "team_all" on leaves  for all using (true) with check (true);
create policy "team_all" on rnr     for all using (true) with check (true);

-- 6) 실시간 알림: 누가 바꾸면 다른 사람 화면도 바로 갱신
alter publication supabase_realtime add table members;
alter publication supabase_realtime add table menu;
alter publication supabase_realtime add table tasks;
alter publication supabase_realtime add table leaves;
alter publication supabase_realtime add table rnr;

-- 7) 첨부 파일 보관함 (sql-files.sql 과 동일)
insert into storage.buckets (id, name, public) values ('files', 'files', true)
  on conflict (id) do update set public = true;
drop policy if exists "team_files_select" on storage.objects;
drop policy if exists "team_files_insert" on storage.objects;
drop policy if exists "team_files_update" on storage.objects;
drop policy if exists "team_files_delete" on storage.objects;
create policy "team_files_select" on storage.objects for select using (bucket_id = 'files');
create policy "team_files_insert" on storage.objects for insert with check (bucket_id = 'files');
create policy "team_files_update" on storage.objects for update using (bucket_id = 'files');
create policy "team_files_delete" on storage.objects for delete using (bucket_id = 'files');
alter table tasks add column if not exists files jsonb default '[]';

-- 8) 결제 (sql-payments.sql 과 동일)
create table if not exists payments ( id uuid primary key, title text not null, -- 내역 date date, -- 일자 category text, -- 카테고리 (광고비, 인건비 ...) kind text default '비용', -- 비용 / 수입 amount numeric default 0, -- 금액(원) payee text, -- 받는 곳(업체·사람) account text, -- 이체할 계좌 due_date date, -- 이체 희망일 invoice boolean default false, -- 세금계산서 필요 memo text, files jsonb default '[]', -- 첨부(견적서, 이체 확인 캡처) status text default '결재대기', -- 결재대기 / 결재완료 / 이체완료 / 반려 approved_by text, approved_at timestamptz, paid_by text, paid_at timestamptz, reject_reason text, comments jsonb default '[]', created_by text, created_at timestamptz default now(), updated_at timestamptz default now() ); alter table payments enable row level security; drop policy if exists "team_all" on payments; create policy "team_all" on payments for all using (true) with check (true); alter publication supabase_realtime add table payments; 

-- 9) 회사 서류함 (sql-docs.sql 과 동일)
create table if not exists docs ( id          uuid primary key, company     text,                         -- 식이해법연구소 / (주)피에이치뷰티 / 공통 doc_type    text,                         -- 종류 (사업자등록증, 통장 사본 ...) title       text not null, files       jsonb default '[]',           -- 첨부 파일 목록 issued_date date,                         -- 발급일 expire_date date,                         -- 유효기간 memo        text, admin_only  boolean default false,        -- 관리자만 보기 created_by  text, created_at  timestamptz default now(), updated_by  text, updated_at  timestamptz default now() ); alter table docs enable row level security; drop policy if exists "team_all" on docs; create policy "team_all" on docs for all using (true) with check (true); alter publication supabase_realtime add table docs;

-- 10) 외주 용역관리 (sql-contractors.sql 과 동일)
create table if not exists contractors ( id         uuid primary key, name       text not null,               -- 성명 rrn        text,                        -- 주민등록번호 (관리자만 전체 표시) bank       text,                        -- 이체 계좌 phone      text, email      text, role       text,                        -- 용역내역 기본값 (인플루언서 등) files      jsonb default '[]',          -- 신분증·통장사본·기타 파일 [{kind, name, url, path, size}] memo       text, active     boolean default true,        -- 현재 거래 중 created_by text, created_at timestamptz default now(), updated_by text, updated_at timestamptz default now() ); create table if not exists contractor_pays ( id            uuid primary key, month         text not null,            -- YYYY-MM contractor_id uuid, name          text,                     -- 성명 (당시 이름) gross         numeric default 0,        -- 지급액 tax           numeric default 0,        -- 소득세 3% local_tax     numeric default 0,        -- 지방소득세 0.3% net           numeric default 0,        -- 차인지급액 service       text,                     -- 용역내역 paid_date     date,                     -- 이체한 날 memo          text, files         jsonb default '[]', created_by    text, created_at    timestamptz default now(), updated_by    text, updated_at    timestamptz default now() ); alter table contractors enable row level security; alter table contractor_pays enable row level security; drop policy if exists "team_all" on contractors; drop policy if exists "team_all" on contractor_pays; create policy "team_all" on contractors for all using (true) with check (true); create policy "team_all" on contractor_pays for all using (true) with check (true); alter publication supabase_realtime add table contractors; alter publication supabase_realtime add table contractor_pays;

-- 11) 견적서 관리 (sql-quotes.sql 과 동일)
create table if not exists quotes ( id             uuid primary key, supplier       text,                      -- 거래처(제조사) product        text not null,             -- 제품 spec           text,                      -- 규격 (500mg × 60정) quote_date     date,                      -- 견적일 qty            numeric default 0,         -- 발주량 unit_price     numeric default 0,         -- 최종 협의 단가(원/개) list_price     numeric,                   -- 조정 전 원가 합계 cost_material  numeric,                   -- 원료비 cost_packaging numeric,                   -- 부자재비 cost_labor     numeric,                   -- 가공비 외 one_time       numeric,                   -- 1회성 비용(검사비 등) vat            boolean default true,      -- VAT 별도 valid_until    date,                      -- 유효기간 terms          text,                      -- 결제조건 change         text,                      -- 변경 내용 memo           text, files          jsonb default '[]',        -- 견적서 파일 is_final       boolean default false,     -- 최종 확정 created_by     text, created_at     timestamptz default now(), updated_by     text, updated_at     timestamptz default now() ); alter table quotes enable row level security; drop policy if exists "team_all" on quotes; create policy "team_all" on quotes for all using (true) with check (true); alter publication supabase_realtime add table quotes;

-- 12) 구독관리 (sql-subscriptions.sql 과 동일)
create table if not exists subscriptions ( id          uuid primary key, name        text not null,               -- 항목 (어도비, 사무실 임대료 ...) category    text,                        -- 구분 (소프트웨어·AI, 통신, 임대·관리비 ...) company     text,                        -- 식이해법연구소 / (주)피에이치뷰티 / 공통 vendor      text,                        -- 결제처 fee         numeric default 0,           -- 금액 currency    text default 'KRW',          -- KRW / USD cycle       text default '월',           -- 월 / 년 billing_day int,                         -- 결제일 start_date  date, end_date    date,                        -- 만료·갱신일 pay_method  text,                        -- 결제 수단 (카드 끝자리 등) owner       text,                        -- 담당 account_id  uuid,                        -- 계정관리의 계정과 연결 status      text default '이용중',       -- 이용중 / 해지 memo        text, admin_only  boolean default false, created_by  text, created_at  timestamptz default now(), updated_by  text, updated_at  timestamptz default now() ); alter table subscriptions enable row level security; drop policy if exists "team_all" on subscriptions; create policy "team_all" on subscriptions for all using (true) with check (true); alter publication supabase_realtime add table subscriptions;

-- 13) 광고 영상 구글 칸 (sql-ads-google.sql 과 동일)
alter table ads add column if not exists google boolean default false;

-- 14) 구독관리 사용자 칸 (sql-subscriptions-users.sql 과 동일)
alter table subscriptions add column if not exists users text;

-- 15) 구독관리 로그인 칸 (sql-subscriptions-login.sql 과 동일)
alter table subscriptions add column if not exists url text, add column if not exists login_id text, add column if not exists password text;

-- 16) 파트너스 (sql-partners.sql 과 동일)
create table if not exists partners ( id            uuid primary key, product       text,                       -- 제품 (레모너리/서리맥스/흑생마) assignee      text,                       -- 담당자 handle        text not null,              -- 계정명 (인스타 아이디) name          text,                       -- 이름 profile_url   text,                       -- 프로필/릴스 링크 followers     numeric default 0,          -- 팔로워 수 fee           numeric default 0,          -- 확정 견적(원) fee_note      text,                       -- 견적 메모 (3개월 등) delivered     boolean default false,      -- 제품 전달 stage         int default 1,              -- 진행 단계 1~10 next_schedule text,                       -- 다음 일정 upload_url    text,                       -- 업로드 링크 upload_date   date,                       -- 광고 업로드 일자 paid          boolean default false,      -- 비용 지급 완료 memo          text, files         jsonb default '[]', created_by    text, created_at    timestamptz default now(), updated_by    text, updated_at    timestamptz default now() ); alter table partners enable row level security; drop policy if exists "team_all" on partners; create policy "team_all" on partners for all using (true) with check (true); alter publication supabase_realtime add table partners;

-- 17) 파트너스 컨택 후보 (sql-partner-leads.sql 과 동일)
create table if not exists partner_leads ( id           uuid primary key, owner        text,                        -- 담당 팀원 contact_date date,                        -- 컨택일 method       text,                        -- 컨택방법 (DM/메일) quote        text,                        -- 수령 견적/협의 견적 handle       text not null,               -- 계정명 name         text, profile_url  text, followers    numeric default 0, job          text,                        -- 직업/특징 contact      text,                        -- 연락처 note         text,                        -- 참고 opinion      text,                        -- 의견 status       text default '검토중',       -- 검토중/컨택함/진행 결정/보류/리스트 제외/중복/완료 created_by   text, created_at   timestamptz default now(), updated_by   text, updated_at   timestamptz default now() ); alter table partner_leads enable row level security; drop policy if exists "team_all" on partner_leads; create policy "team_all" on partner_leads for all using (true) with check (true); alter publication supabase_realtime add table partner_leads;

-- 18) 비매출 (sql-samples.sql 과 동일)
create table if not exists samples ( id           uuid primary key, product      text,                        -- 제품 (레모너리/서리맥스/흑생마) product_name text,                        -- 주문상품명 (엑셀용) option_name  text,                        -- 주문상품명(옵션포함) qty          int default 1,               -- 수량 recipient    text,                        -- 수령인 phone        text,                        -- 수령인 휴대전화 zip          text,                        -- 우편번호 address      text,                        -- 주소 address2     text,                        -- 상세주소 pay_type     text,                        -- 결제구분 pay_method   text,                        -- 결제수단 order_date   date,                        -- 발주일 country      text default '대한민국',      -- 배송국가 category     text,                        -- 구분 (파트너스/체험단 ...) memo         text, sent         boolean default false,       -- 발송 완료 sent_at      timestamptz, exported_at  timestamptz,                 -- 엑셀 추출한 때 created_by   text, created_at   timestamptz default now(), updated_by   text, updated_at   timestamptz default now() ); alter table samples enable row level security; drop policy if exists "team_all" on samples; create policy "team_all" on samples for all using (true) with check (true); alter publication supabase_realtime add table samples;
