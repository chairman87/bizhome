-- 업무공유(결정사항 표 decisions)에 링크·첨부 칸 추가 — Supabase SQL Editor 에 붙여넣고 Run
alter table decisions add column if not exists link text;                 -- 관련 링크 (인터넷 주소)
alter table decisions add column if not exists files jsonb default '[]';  -- 첨부 사진·파일 [{name,url,type,size}]
