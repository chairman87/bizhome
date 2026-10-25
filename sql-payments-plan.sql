-- 결재 두 단계(기안결재 → 자금결제) 개편, 2026-10-25 — Supabase SQL Editor 에 붙여넣고 Run
-- 기안은 같은 payments 표에 kind='기안' 으로 저장하므로 새 표는 없습니다.
-- 자금결제 줄에 "어느 기안으로 올렸는지" 연결 칸(plan_id) 하나만 추가합니다.
-- 이 칸이 없어도 기안 올리기·승인은 되지만, 자금결제에 기안을 붙이는 것은 안 됩니다(화면 위에 빨간 안내가 뜹니다).
alter table payments add column if not exists plan_id uuid;
create index if not exists payments_plan_id_idx on payments(plan_id);
