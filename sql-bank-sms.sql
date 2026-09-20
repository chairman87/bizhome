-- 은행 입출금 문자 보관함 — Supabase SQL Editor 에 붙여넣고 Run
-- 대표 아이폰의 단축어 자동화가 은행 문자를 bank_sms_in() 으로 보냄. 잔액이 들어 있어서 다른 표와 달리 잠가 둠:
-- 정책(policy)을 하나도 만들지 않아 인트라넷 공개 키로는 표를 직접 읽거나 쓸 수 없고,
-- 아래 두 함수에 맞는 열쇠(token)를 줘야만 넣기·읽기가 됨. 열쇠 값은 이 파일에 적지 않음(대표 PC 에만 보관).
create table if not exists bank_sms (
  id           bigint generated always as identity primary key,
  received_at  timestamptz not null default now(),   -- 문자가 도착한 시각
  sender       text,                                  -- 보낸 번호
  body         text not null                          -- 문자 원문 (금액·잔액은 읽을 때 뽑아냄)
);
alter table bank_sms enable row level security;

create table if not exists app_secrets (
  name   text primary key,                            -- bank_sms_in / bank_sms_read
  value  text not null
);
alter table app_secrets enable row level security;

-- 넣기: 아이폰 단축어가 부름
create or replace function bank_sms_in(p_token text, p_body text, p_sender text default null)
returns text language plpgsql security definer set search_path = public as $$
begin
  if p_token is null or p_token <> (select value from app_secrets where name = 'bank_sms_in') then
    raise exception 'forbidden';
  end if;
  if coalesce(trim(p_body), '') = '' then return 'empty'; end if;
  insert into bank_sms(sender, body) values (left(p_sender, 100), left(p_body, 2000));
  return 'ok';
end $$;

-- 읽기: 대표 PC 의 상황판 프로그램이 부름
create or replace function bank_sms_list(p_token text, p_limit int default 200)
returns setof bank_sms language plpgsql security definer set search_path = public as $$
begin
  if p_token is null or p_token <> (select value from app_secrets where name = 'bank_sms_read') then
    raise exception 'forbidden';
  end if;
  return query select * from bank_sms order by received_at desc limit least(greatest(p_limit, 1), 1000);
end $$;

grant execute on function bank_sms_in(text, text, text) to anon;
grant execute on function bank_sms_list(text, int) to anon;
