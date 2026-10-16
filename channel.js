/* ================================================================
   프로젝트 채널 (projects.html 이 불러 씀)
   프로젝트 하나 = 채널 하나. 자료 카드 · 수정본 · 댓글 · 결정이 날짜순으로 쌓이는 기록 공간
   project_cards: { project_id, title, kind, memo, status, revisions:[{no, memo, files:[…], by, at}], comments:[{id,by,text,at}] }
   project_decisions: { project_id, card_id, status, body, reason, decided_at }
   — 요청서: 클로드코드/TEAM-TASKS 의 "인트라넷 프로젝트 채널 기능 요청서"(2026-10-03)
================================================================ */
const CARD_KINDS = ['제안서', '기획서', '견적서', '손익 시뮬레이션', '기타'];
const CARD_ST = { '결정 대기': ['#fef3c7', '#92400e'], '승인': ['#dcfce7', '#15803d'], '보류': ['#e9e9e7', '#5a5a55'], '반려': ['#fee2e2', '#b91c1c'], '참고 자료': ['#dbeafe', '#1d4ed8'] };
const CARD_STATUSES = Object.keys(CARD_ST);
const CARDS = () => DATA.project_cards || [];
const DECS = () => DATA.project_decisions || [];
const revsOf = c => Array.isArray(c.revisions) ? c.revisions : [];
const lastRev = c => revsOf(c)[revsOf(c).length - 1] || { no: 1, files: [] };
const cardFiles = c => lastRev(c).files || [];
const cardLastAt = c => [c.created_at, ...revsOf(c).map(r => r.at), ...(c.comments || []).map(x => x.at)].filter(Boolean).sort().pop() || '';
const cardsOf = pid => CARDS().filter(c => c.project_id === pid).sort((a, b) => String(cardLastAt(b)).localeCompare(String(cardLastAt(a))));
const projLastAt = pid => [...cardsOf(pid).map(cardLastAt), ...DECS().filter(d => d.project_id === pid).map(d => d.created_at)].filter(Boolean).sort().pop() || null;
const daysAgo = iso => iso ? Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)) : null;
const agoHtml = pid => { const d = daysAgo(projLastAt(pid)); return d == null ? '<span class="ago none">아직 기록 없음</span>' : `<span class="ago ${d >= 7 ? 'old' : ''}" title="자료 카드·수정본·댓글·결정 중 가장 최근 것 기준">마지막 기록 ${d === 0 ? '오늘' : d + '일 전'}</span>`; };
const stLabel = s => s === '참고 자료' ? '공유' : s;   // 저장 값은 예전 그대로 '참고 자료', 화면에는 '공유' (결정을 요청하지 않고 그냥 공유한 자료)
const stCard = s => tag(stLabel(s), ...(CARD_ST[s] || CARD_ST['참고 자료']), true);
const isShare = c => c.status === '참고 자료';
/* 카드의 상태 단추: 공유 자료는 딱지 없이 깔끔하게(결정은 카드를 열어서 기록), 그 밖에는 '결정 대기 ▾' 처럼 눌러서 바로 결정 */
const stBtn = c => isShare(c) ? '' : `<button type="button" class="qd" data-qd="${c.id}" title="눌러서 결정 기록 (승인·보류·반려)">${stCard(c.status)}<span class="ar">▾</span></button>`;
const isPdf = f => /pdf$/i.test(f.type || '') || /\.pdf$/i.test(f.name || '');
const fmtSize = n => n > 1048576 ? (n / 1048576).toFixed(1) + 'MB' : Math.max(1, Math.round((n || 0) / 1024)) + 'KB';
let cardFilter = '', cardQ = '';          // 자료 카드 탭: 고른 상태, 검색어
let CV = null;                            // 열어 둔 카드 보기 창 { id, rev(차수), file(몇 번째 파일) }

/* ---------- 채널 머리: 리더 · 참여 팀원 · 마지막 기록 · NAS 경로 · 고정 요약 ---------- */
function chHeadHtml(p){
  const mem = (Array.isArray(p.members) ? p.members : []).filter(n => n !== p.owner);
  return `<div class="chinfo">
    <div class="chrow"><span class="lb">리더</span>${p.owner ? who(p.owner) : '<span class="hint">미정</span>'}
      ${mem.length ? `<span class="lb" title="${esc(mem.join(', '))}">참여 ${mem.length}명</span>` : ''}
      ${p.nas_path ? `<button class="btn sm" id="nasCopy" title="${esc(p.nas_path)}">📁 NAS 경로 복사</button>` : ''}
      ${p.summary ? '' : '<button class="btn sm" id="sumEdit">📌 현재 상태 적기</button>'}${agoHtml(p.id)}</div>
    ${p.summary ? `<div class="pin"><span class="pi">📌</span><div class="pt">${linkify(p.summary)}</div><button class="btn sm" id="sumEdit" title="${esc(p.summary_by || '')} · ${p.summary_at ? fmtDateTime(p.summary_at).slice(5) : ''} 수정">수정</button></div>` : ''}
  </div>`;
}
function bindChHead(p){
  const nc = $('#nasCopy'); if (nc) nc.onclick = async () => { try { await navigator.clipboard.writeText(p.nas_path); toast('NAS 경로를 복사했습니다'); } catch { toast('복사할 수 없습니다. 경로를 직접 선택해 복사하세요', true); } };
  const se = $('#sumEdit'); if (se) se.onclick = () => {
    openModal(`${modalHead('📌 현재 상태 · 다음 할 일')}
      <div class="mb"><div class="f"><label>${esc(p.name)}</label><textarea id="sumText" style="min-height:150px" maxlength="2000" placeholder="예:\n· 브랜드명 A안 확정 (10/2)\n· 제조사 2곳 견적 비교 중 — 10/8 회의에서 결정\n· 다음: 상표 등록 가능 여부 확인 (홍주)">${esc(p.summary || '')}</textarea></div>
        <div class="hint">채널 맨 위에 항상 보입니다. 길게 쓰지 말고 지금 상태와 다음 할 일만 적어 주세요.</div></div>
      <div class="mf"><button class="btn" data-close>취소</button><button class="btn primary" id="sumSave">저장</button></div>`, { wide: true });
    $('#sumText').focus();
    $('#sumSave').onclick = async () => { const v = $('#sumText').value.trim(); closeModal(); await saveRow('projects', { ...p, summary: v || null, summary_by: me, summary_at: nowIso() }); toast('저장했습니다'); };
  };
}

/* ---------- 대화 탭 (채널 첫 화면): 메시지·자료 카드·수정본·댓글·결정이 올린 순서대로 위에서 아래로 쌓임 ----------
   맨 아래 입력칸에 글만 쓰면 메시지(project_logs), 파일을 붙이면 자료 카드(project_cards)로 올라감 */
let talkLimit = 60, talkStick = true;
function talkEvents(p){
  const ev = [];
  (DATA.project_logs || []).filter(l => l.project_id === p.id).forEach(l => ev.push({ at: l.created_at, by: l.created_by, type: 'msg', log: l }));
  cardsOf(p.id).forEach(c => {
    ev.push({ at: c.created_at, by: c.created_by, type: 'card', card: c, rev: revsOf(c)[0] });
    revsOf(c).slice(1).forEach(r => ev.push({ at: r.at, by: r.by, type: 'rev', card: c, rev: r }));
    (c.comments || []).forEach(m => ev.push({ at: m.at, by: m.by, type: 'cmt', card: c, cmt: m }));
  });
  if (typeof talkExtraEvents === 'function') talkExtraEvents(p, ev);
  return ev.filter(e => e.at).sort((a, b) => String(a.at).localeCompare(String(b.at)));
}
const cardChip = (c, r) => { const fs = (r && r.files) || cardFiles(c), img = fs.find(isImg), un = cardUnread(c) ? 'unread' : '', sub = `${r && r.no > 1 ? `${r.no}차 · ` : ''}${fs.length > 1 ? `파일 ${fs.length}개 · ` : ''}${(c.comments || []).length ? `💬 ${c.comments.length} · ` : ''}눌러서 크게 보기`;
  return img ? `<div class="mfile img ${un}" data-card="${c.id}" data-rv="${r ? r.no : ''}"><img src="${esc(img.url)}" alt="${esc(img.name)}" loading="lazy"><div class="cap"><b>${esc(c.title)}</b><span>${sub}</span>${stBtn(c)}</div></div>`
    : `<div class="cchip ${un}" data-card="${c.id}" data-rv="${r ? r.no : ''}"><span class="ic">${fs.length && isPdf(fs[0]) ? '📕' : '📄'}</span><div class="ci"><b>${esc(c.title)}</b><span>${sub}</span></div>${stBtn(c)}</div>`; };
function talkHtml(p){
  if (!DATA.project_cards) return cardsHtml(p);
  const all = talkEvents(p), list = all.slice(-talkLimit), comp = getComp(p.id);
  let last = '';
  const from = newFrom[p.id]; let lined = false;   // 이 채널에 들어왔을 때까지 읽은 시각 → 그 뒤에 남이 올린 첫 글 앞에 '새 글' 선
  const rows = list.map(e => {
    const day = fmtDateTime(e.at).slice(0, 10); let head = day === last ? '' : `<div class="tday"><span>${dayLabel(day.replace(/\//g, '-'))}</span></div>`; last = day;
    if (!lined && from != null && e.by !== me && String(e.at) > from) { lined = true; head += '<div class="tnew"><span>새 글</span></div>'; }
    const body = e.type === 'msg' ? `${e.log.body ? `<div class="mt">${linkify(e.log.body)}</div>` : ''}${filesHtml(e.log.files)}`
      : e.type === 'card' ? `${e.card.memo ? `<div class="mt">${linkify(e.card.memo)}</div>` : ''}${cardChip(e.card, e.rev)}`
      : e.type === 'rev' ? `<div class="mt sys">${e.rev.no}차 수정본을 올렸습니다${e.rev.memo ? ' — ' + esc(e.rev.memo) : ''}</div>${cardChip(e.card, e.rev)}`
      : e.type === 'cmt' ? `<div class="mt"><span class="re" data-card="${e.card.id}">↳ ${esc(e.card.title)}</span> ${linkify(e.cmt.text || '')}</div>`
      : (e.html || '');
    // 내가 올린 것(관리자는 전부)은 줄 오른쪽 ✕ 로 바로 삭제: 메시지 / 파일 붙은 메시지 / 맨 마지막 수정본 / 댓글 / 결정
    const mine = e.by === me || isAdmin();
    const dk = !mine ? '' : e.type === 'msg' ? 'msg|' + e.log.id : e.type === 'card' ? 'card|' + e.card.id : e.type === 'rev' && e.rev.no === lastRev(e.card).no ? 'rev|' + e.card.id + '|' + e.rev.no : e.type === 'cmt' ? 'cmt|' + e.card.id + '|' + e.cmt.id : e.type === 'dec' && e.dec ? 'dec|' + e.dec.id : '';
    const del = dk ? `<button class="mx" data-xdel="${dk}" title="삭제">✕ 삭제</button>` : '';
    return head + `<div class="msg t-${e.type}"${e.type === 'msg' ? ` data-id="${e.log.id}"` : ''}>${avatar(e.by)}<div class="mb2"><div class="mh2"><b>${esc(fullName(e.by || ''))}</b><span class="tm">${fmtDateTime(e.at).slice(11)}</span>${del}</div>${body}</div></div>`;
  }).join('');
  return `<div class="slscroll" id="tscroll"><div class="tfeed">${all.length > list.length ? `<button class="btn sm" id="talkMore">이전 기록 더 보기 (${all.length - list.length}건)</button>` : ''}
      ${rows || `<div class="slempty"><div class="big"># ${esc(p.name)}</div></div>`}</div></div>
    <div class="slcomp"><div class="talkbox composer" id="composer">
      <textarea id="cBody" rows="1" maxlength="4000" placeholder="#${esc(p.name)} 에 메시지 보내기">${esc(comp.text)}</textarea>
      ${comp.box.html}
      <div class="crow"><button type="button" class="plus" id="tkPlus" title="파일 첨부 (PDF·이미지)">＋</button><span class="hint">Enter 보내기 · Shift+Enter 줄바꿈 · 파일은 끌어다 놓거나 Ctrl+V</span><span class="sp"></span><label class="need" id="tkCard" hidden title="체크하면 회의 안건 목록에 올라갑니다. 그냥 공유만 할 때는 체크하지 않습니다"><input type="checkbox" id="tkNeed" ${comp.needDec ? 'checked' : ''}> 결정 필요</label><button type="button" class="send" id="cSend" title="보내기">➤</button></div>
    </div></div>`;
}
/* 대화 줄의 ✕ 삭제 */
async function talkDelete(key){
  const [kind, id, sub] = key.split('|'); talkStick = false;
  if (kind === 'msg') { if (confirm('이 메시지를 삭제할까요?')) await removeRow('project_logs', id); return; }
  if (kind === 'dec') { if (confirm('이 결정 기록을 삭제할까요?')) await removeRow('project_decisions', id); return; }
  const c = await freshCard(id); if (!c) return;
  if (kind === 'cmt') { if (confirm('이 댓글을 삭제할까요?')) await saveRow('project_cards', { ...c, comments: (c.comments || []).filter(m => m.id !== sub), updated_by: me }); return; }
  if (kind === 'rev') { const r = revsOf(c).find(x => String(x.no) === sub); if (!r || r.no !== lastRev(c).no || r.no < 2) return;
    if (!confirm(`${r.no}차 수정본을 삭제할까요?\n(이전 차수는 그대로 남습니다)`)) return;
    (r.files || []).forEach(f => { if (f.path) deleteFile(f.path); });
    await saveRow('project_cards', { ...c, revisions: revsOf(c).filter(x => x.no !== r.no), updated_by: me }); return; }
  if (kind === 'card') { const nf = revsOf(c).reduce((n, r) => n + (r.files || []).length, 0), nc = (c.comments || []).length, nr = revsOf(c).length;
    if (!confirm(`이 글을 삭제할까요?\n첨부 파일 ${nf}개${nr > 1 ? `, 수정본 ${nr - 1}개` : ''}${nc ? `, 댓글 ${nc}개` : ''}도 함께 지워집니다.`)) return;
    revsOf(c).forEach(r => (r.files || []).forEach(f => { if (f.path) deleteFile(f.path); }));
    if (CV && CV.id === c.id) { closeModal(); CV = null; }
    await removeRow('project_cards', c.id); }
}
async function sendTalk(p){
  const c = getComp(p.id);
  if (c.busy) { toast('파일을 올리는 중입니다. 잠시만 기다려 주세요', true); return; }
  const text = c.text.trim(), files = [...c.box.files];
  if (!text && !files.length) { $('#cBody').focus(); return; }
  delete comps[p.id]; talkStick = true;
  if (files.length) {   // 파일이 붙은 메시지 (저장은 project_cards: 수정본·댓글·결정을 달 수 있음). 이름은 첫 파일 이름
    const title = files[0].name.replace(/\.\w+$/, '') + (files.length > 1 ? ` 외 ${files.length - 1}개` : '');
    await saveRow('project_cards', { id: uid(), project_id: p.id, title, kind: null, memo: text || null, status: c.needDec ? '결정 대기' : '참고 자료', revisions: [{ no: 1, memo: '', files, by: me, at: nowIso() }], comments: [], created_by: me, created_at: nowIso(), updated_by: me });
  } else await saveRow('project_logs', { id: uid(), project_id: p.id, kind: '메모', body: text, log_date: todayStr(), files: [], comments: [], created_by: me, created_at: nowIso(), updated_by: me });
  const b = $('#cBody'); if (b) b.focus();
}
function bindTalk(p){
  if (!$('#composer')) { bindCards(p); return; }
  const c = getComp(p.id), body = $('#cBody');
  $('#tkPlus').onclick = () => { const b = document.querySelector('#cFiles [data-pick]'); if (b) b.click(); };
  bindBox(p);
  const paint = () => { const on = c.box.files.length > 0; const k = $('#tkCard'); if (!k) return; k.hidden = !on; const sb = $('#cSend'); if (sb) sb.classList.toggle('on', on || !!c.text.trim()); };
  c.paint = paint; paint();
  $('#tkNeed').onchange = () => { c.needDec = $('#tkNeed').checked; };
  const grow = () => { body.style.height = 'auto'; body.style.height = Math.min(220, body.scrollHeight) + 'px'; };
  body.oninput = () => { c.text = body.value; grow(); paint(); }; grow();
  body.onkeydown = e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && !isTouch()) { e.preventDefault(); sendTalk(p); } };   // 한글 조합 중 Enter 는 무시. 휴대폰에서는 Enter = 줄바꿈, ➤ 로 보냄
  $('#cSend').onclick = () => sendTalk(p);
  const more = $('#talkMore'); if (more) more.onclick = () => { talkLimit += 100; talkStick = false; render(); };
  document.querySelectorAll('#tscroll [data-card]').forEach(el => el.onclick = () => openCard(el.dataset.card, Number(el.dataset.rv) || undefined));
  bindQuickDec();
  document.querySelectorAll('[data-xdel]').forEach(b => b.onclick = e => { e.stopPropagation(); talkDelete(b.dataset.xdel); });
  if (typeof bindTalkExtra === 'function') bindTalkExtra(p);
}

/* ---------- 슬랙 모양 화면: 왼쪽 채널 목록 + 오른쪽 채널(머리 · 메시지/자료 카드 · 입력칸) ---------- */
let sideOpen = false;
const AGENDA = '__agenda';   // 왼쪽 목록의 '회의 안건'을 고른 상태 (cur 에 이 값이 들어감)
function slRender(p){
  if (tab !== 'cards' && tab !== 'decs' && tab !== 'plan' && tab !== 'talk') tab = 'plan';   // 채널 첫 화면은 런칭 일정
  const sc0 = $('#tscroll'), prev = sc0 ? { top: sc0.scrollTop, stick: sc0.scrollHeight - sc0.scrollTop - sc0.clientHeight < 140, tab: sc0.dataset.tab, id: sc0.dataset.pid } : null;
  const ae = document.activeElement, keep = ae && ['cBody', 'tkTitle', 'cardQ'].includes(ae.id) ? '#' + ae.id : '';
  const byName = (a, b) => String(a.name).localeCompare(String(b.name), 'ko');
  const act = P().filter(x => x.status !== '완료').sort(byName), done = P().filter(x => x.status === '완료').sort(byName);
  const item = x => { const un = unreadOf(x.id), pend = cardsOf(x.id).filter(c => c.status === '결정 대기').length, d = daysAgo(projLastAt(x.id)); return `<button class="slch ${p && x.id === p.id ? 'on' : ''} ${un ? 'unread' : ''}" data-open="${x.id}" title="${d == null ? '아직 기록 없음' : '마지막 기록 ' + (d === 0 ? '오늘' : d + '일 전')}${pend ? ' · 결정 대기 ' + pend + '건' : ''}"><span class="hash">#</span><span class="nm">${esc(x.name)}</span>${d != null && d >= 7 && x.status !== '완료' ? '<span class="stale" title="7일 넘게 기록이 없습니다">●</span>' : ''}${un ? `<span class="bd" title="안 읽은 새 글 ${un}건">${un}</span>` : pend ? `<span class="pd" title="결정 대기 ${pend}건">⏳${pend}</span>` : ''}</button>`; };
  const agenda = cur === AGENDA, pendAll = CARDS().filter(c => c.status === '결정 대기' && P().some(x => x.id === c.project_id && x.status !== '완료')).length;
  const mem = p ? (Array.isArray(p.members) ? p.members : []).filter(n => n !== p.owner) : [];
  const pend = p ? cardsOf(p.id).filter(c => c.status === '결정 대기').length : 0;
  $('#app').innerHTML = headerHtml({ icon: '🗂️', title: '프로젝트' }) + `<div class="sl ${sideOpen ? 'side-open' : ''}">
    <aside class="sls">
      <div class="slst">프로젝트 채널</div>
      <button class="slch slag ${agenda ? 'on' : ''}" data-open="${AGENDA}" title="모든 채널에서 결정을 기다리는 자료"><span class="hash">📋</span><span class="nm">회의 안건</span>${pendAll ? `<span class="bd">${pendAll}</span>` : ''}</button>
      <div class="slsec">진행 중</div>${act.map(item).join('') || '<div class="slnone">아직 채널이 없습니다</div>'}
      <button class="sladd" id="newP"><span class="hash">＋</span>채널 추가</button>
      ${done.length ? `<div class="slsec">종료</div>${done.map(item).join('')}` : ''}
    </aside>
    <section class="slm" id="logwrap">${!DATA.projects ? `<div class="slempty">프로젝트 저장 표가 아직 없습니다.</div>` : agenda ? agendaHtml() : !p ? `<div class="slempty"><div class="big">프로젝트 채널</div>프로젝트 하나의 자료와 의견, 결정이 날짜순으로 쌓이는 곳입니다.<br>왼쪽의 <b>＋ 채널 추가</b>로 첫 채널을 만들어 보세요.</div>` : `
      <div class="slh"><button class="slmenu" id="slMenu" title="채널 목록">☰</button><h2><span class="hash">#</span> ${esc(p.name)}</h2>${p.status !== '진행중' ? stP(p.status) : ''}
        <span class="ldr ${p.owner ? '' : 'none'}" title="프로젝트 리더 (⚙ 설정에서 바꿉니다)"><span class="lb">리더</span>${p.owner ? avatar(p.owner) + '<b>' + esc(fullName(p.owner)) + '</b>' : '<b>미정</b>'}</span><button class="btn sm" id="editP" title="채널 이름·리더·참여 팀원·NAS 경로">⚙ 설정</button>
        <span class="sp"></span>${mem.length ? `<span class="mm" title="참여: ${esc(mem.join(', '))}">👥 ${mem.length + (p.owner ? 1 : 0)}</span>` : ''}
        ${p.nas_path ? `<button class="btn sm" id="nasCopy" title="${esc(p.nas_path)}">📁 NAS 경로 복사</button>` : ''}</div>
      <div class="slt"><button class="sltab ${tab === 'plan' ? 'on' : ''}" data-tab="plan">🗓 런칭 일정${planOf(p.id).length ? `<span class="cn">${planOf(p.id).filter(planDone).length}/${planOf(p.id).length}</span>` : ''}</button><button class="sltab ${tab === 'talk' ? 'on' : ''}" data-tab="talk">💬 메시지${unreadOf(p.id) ? `<span class="bd" title="안 읽은 글">${unreadOf(p.id)}</span>` : ''}</button><button class="sltab ${tab === 'cards' ? 'on' : ''}" data-tab="cards">📎 파일${pend ? `<span class="bd">${pend}</span>` : ''}</button><button class="sltab ${tab === 'decs' ? 'on' : ''}" data-tab="decs">✅ 결정 로그${decsOf(p.id).length ? `<span class="cn">${decsOf(p.id).length}</span>` : ''}</button>
        <span class="sp"></span>${agoHtml(p.id)}</div>
      <div class="slpin" id="sumEdit" title="눌러서 고치기${p.summary_at ? ' · ' + esc(p.summary_by || '') + ' ' + fmtDateTime(p.summary_at).slice(5) + ' 수정' : ''}"><span class="pi">📌</span><span class="pt ${p.summary ? '' : 'none'}">${p.summary ? linkify(p.summary) : '현재 상태 · 다음 할 일을 적어 두세요 (눌러서 적기)'}</span></div>
      ${tab === 'talk' ? talkHtml(p) : `<div class="slscroll" id="tscroll"><div class="slpad">${tab === 'decs' ? decsHtml(p) : tab === 'plan' ? planHtml(p) : cardsHtml(p)}</div></div>`}`}
    </section></div>`;
  { const tot = P().filter(x => x.status !== '완료').reduce((n, x) => n + unreadOf(x.id), 0); document.title = (tot ? `(${tot}) ` : '') + '프로젝트'; }   // 브라우저 탭 제목에 안 읽은 수
  if (READS === null) loadReads();
  bindHeader(() => {}, null, m => `리더인 채널 ${P().filter(x => x.owner === m.name && x.status !== '완료').length}개`);
  slFit();
  document.querySelectorAll('.sls [data-open]').forEach(b => b.onclick = () => { Object.keys(newFrom).forEach(k => delete newFrom[k]); cur = b.dataset.open; LS.set('proj_cur', cur); tab = 'plan'; LS.set('proj_tab', tab); cardFilter = ''; cardQ = ''; talkLimit = 60; talkStick = true; sideOpen = false; if (QP) { QP = ''; history.replaceState(null, '', location.pathname); } render(); });
  const np = $('#newP'); if (np) np.onclick = () => openProject(null);
  if (agenda) { bindAgenda(); const sm = $('#slMenu'); if (sm) sm.onclick = () => { sideOpen = !sideOpen; document.querySelector('.sl').classList.toggle('side-open', sideOpen); }; if (CV && $('#cvExtra')) refreshCardSide(CV.id); return; }
  if (!p) return;
  $('#slMenu').onclick = () => { sideOpen = !sideOpen; document.querySelector('.sl').classList.toggle('side-open', sideOpen); };
  document.querySelectorAll('.sltab').forEach(b => b.onclick = () => { tab = b.dataset.tab; LS.set('proj_tab', tab); talkStick = true; render(); });
  $('#editP').onclick = () => openProject(p.id);
  bindChHead(p);
  if (QCARD && !openedCard) { openedCard = true; setTimeout(() => openCard(QCARD), 0); }
  if (tab === 'cards') bindCards(p); else if (tab === 'decs') bindDecs(p); else if (tab === 'plan') bindPlan(p); else { bindTalk(p); markChannelSeen(p); }
  if (CV && $('#cvExtra')) refreshCardSide(CV.id);   // 카드 창이 열려 있으면 댓글·결정을 최신으로
  const sc = $('#tscroll');
  if (sc) { sc.dataset.tab = tab; sc.dataset.pid = p.id;
    const same = prev && prev.tab === tab && prev.id === p.id;
    const toEnd = tab === 'talk' && (talkStick || !same || prev.stick);
    if (toEnd) { sc.scrollTop = sc.scrollHeight; sc.querySelectorAll('img').forEach(im => { if (!im.complete) im.addEventListener('load', () => { sc.scrollTop = sc.scrollHeight; }, { once: true }); }); }
    else if (same) sc.scrollTop = prev.top;
    talkStick = false; }
  const k = keep && $(keep); if (k) { k.focus(); try { k.setSelectionRange(k.value.length, k.value.length); } catch {} }
}
/* 화면 높이에 꼭 맞춤: 메시지 영역만 스크롤되고 입력칸은 항상 아래에 */
function slFit(){ const sl = document.querySelector('.sl'); if (sl) sl.style.height = Math.max(320, window.innerHeight - sl.getBoundingClientRect().top) + 'px'; }
window.addEventListener('resize', slFit);

/* ---------- 자료 카드 탭 ---------- */
function cardsHtml(p){
  if (!DATA.project_cards) return `<div class="empty">자료 카드 저장 표가 아직 없습니다.${isAdmin() ? ' <b>sql-project-channel.sql</b> 을 Supabase SQL Editor 에서 실행하세요.' : ''}</div>`;
  const all = cardsOf(p.id);
  return `<div class="actions"><button class="btn primary" id="newCard" style="padding:9px 16px;font-size:14px">＋ 파일 올리기</button>
      <div class="lchips" style="margin:0"><button class="lchip ${cardFilter ? '' : 'on'}" data-cf="">전체<span class="n">${all.length}</span></button>${CARD_STATUSES.map(s => `<button class="lchip ${cardFilter === s ? 'on' : ''}" data-cf="${s}">${stLabel(s)}<span class="n">${all.filter(c => c.status === s).length}</span></button>`).join('')}
      <input type="search" id="cardQ" placeholder="검색 (제목, 메모, 파일 이름)" value="${esc(cardQ)}"></div></div>
    <div id="cardList">${cardListHtml(p)}</div>`;
}
function cardListHtml(p){
  const s = cardQ.trim().toLowerCase();
  const list = cardsOf(p.id).filter(c => (!cardFilter || c.status === cardFilter) && (!s || [c.title, c.memo, c.kind, c.created_by, ...revsOf(c).flatMap(r => (r.files || []).map(f => f.name))].some(v => (v || '').toLowerCase().includes(s))));
  if (!list.length) return `<div class="empty">${s || cardFilter ? '해당하는 파일이 없습니다.' : '아직 올린 파일이 없습니다.<br>대화에 붙여 올린 파일이 여기에 모입니다. 회의 때 열어 놓고 같이 볼 수 있습니다.'}</div>`;
  return `<div class="cgrid">${list.map(c => {
    const fs = cardFiles(c), img = fs.find(isImg), n = revsOf(c).length;
    return `<div class="ccard st-${c.status.replace(/\s/g, '')}" data-card="${c.id}">
      <div class="ct">${cardUnread(c) ? '<span class="nw">새 글</span>' : ''}${stBtn(c)}${n > 1 ? `<span class="rv">${n}차</span>` : ''}</div>
      <h3>${esc(c.title)}</h3>
      ${c.memo ? `<div class="cm2">${esc(c.memo)}</div>` : ''}
      <div class="thumb">${img ? `<img src="${esc(img.url)}" alt="" loading="lazy">` : fs.length ? `<span class="doc">${isPdf(fs[0]) ? '📕' : '📄'}</span>` : '<span class="doc none">첨부 없음</span>'}${fs.length ? `<span class="fn">${esc(fs[0].name)}${fs.length > 1 ? ` 외 ${fs.length - 1}개` : ''}</span>` : ''}</div>
      ${(d => d ? `<div class="cdec">✅ ${esc(d.body)}</div>` : '')(decsOf(c.project_id).find(d => d.card_id === c.id))}
      <div class="cf">${who(c.created_by)}<span>${fmtDateTime(c.created_at).slice(5)}</span><span class="sp"></span>${(c.comments || []).length ? `<span>💬 ${c.comments.length}</span>` : ''}</div>
    </div>`;
  }).join('')}</div>`;
}
function bindCards(p){
  const nb = $('#newCard'); if (nb) nb.onclick = () => openCardEdit(p, null);
  document.querySelectorAll('[data-cf]').forEach(b => b.onclick = () => { cardFilter = b.dataset.cf; render(); });
  const q = $('#cardQ'); if (q) q.oninput = () => { cardQ = q.value; $('#cardList').innerHTML = cardListHtml(p); bindCardList(p); };
  bindCardList(p);
}
function bindCardList(p){ document.querySelectorAll('[data-card]').forEach(el => el.onclick = () => openCard(el.dataset.card)); bindQuickDec(); }

/* ---------- 카드 올리기 · 수정 ---------- */
function openCardEdit(p, id){
  const c = id ? CARDS().find(x => x.id === id) : null;
  const kind = c ? c.kind : null;
  const at = attachBox('kFiles', c ? cardFiles(c) : [], 'projects', { rename: true });
  openModal(`${modalHead(c ? '수정' : `파일 올리기 — # ${esc(p.name)}`)}
    <div class="mb">
      <div class="f"><label>제목 *</label><input id="kTitle" value="${esc(c ? c.title : '')}" maxlength="120" placeholder="예: 브랜드명 후보안, A제조사 견적서, 10월 기획서"></div>
      <div class="f"><label>한마디 메모</label><textarea id="kMemo" maxlength="2000" style="min-height:70px" placeholder="이 자료를 볼 때 알아야 할 것. 예: 단가는 부가세 별도, 최소 수량 3천 개 기준">${esc(c ? c.memo || '' : '')}</textarea></div>
      <div class="f"><label>첨부 파일 ${c ? `(${lastRev(c).no}차)` : ''} — PDF·이미지는 화면에서 바로 보입니다. 파일 하나 50MB 까지</label>${at.html}</div>
      ${c ? '' : `<label class="hint" style="display:flex;align-items:center;gap:6px;font-size:13px"><input type="checkbox" id="kNeed"> 결정이 필요한 자료입니다 (체크하면 회의 안건 목록에 올라갑니다)</label>`}
    </div>
    <div class="mf">${c && (c.created_by === me || isAdmin()) ? '<button class="btn danger left" id="kDel">삭제</button>' : ''}<button class="btn" data-close>취소</button><button class="btn primary" id="kSave">${c ? '저장' : '올리기'}</button></div>`, { wide: true });
  at.bind(); $('#kTitle').focus();
  $('#kSave').onclick = async () => {
    if ($('#kFiles .up')) { toast('파일을 올리는 중입니다. 잠시만 기다려 주세요', true); return; }
    const title = $('#kTitle').value.trim(); if (!title) { $('#kTitle').focus(); toast('제목을 입력하세요', true); return; }
    const memo = $('#kMemo').value.trim() || null;
    let row;
    if (c) { const rs = revsOf(c).map((r, i, arr) => i === arr.length - 1 ? { ...r, files: [...at.files] } : r); row = { ...c, title, kind, memo, revisions: rs.length ? rs : [{ no: 1, memo: '', files: [...at.files], by: me, at: nowIso() }], updated_by: me }; }
    else row = { id: uid(), project_id: p.id, title, kind, memo, status: $('#kNeed').checked ? '결정 대기' : '참고 자료', revisions: [{ no: 1, memo: '', files: [...at.files], by: me, at: nowIso() }], comments: [], created_by: me, created_at: nowIso(), updated_by: me };
    closeModal(); await saveRow('project_cards', row); toast(c ? '저장했습니다' : '올렸습니다');
    if (c) openCard(c.id);
  };
  const del = $('#kDel'); if (del) del.onclick = async () => {
    if (!confirm(`"${c.title}" 을(를) 삭제할까요?\n첨부 파일과 댓글 ${(c.comments || []).length}개도 함께 지워집니다.`)) return;
    closeModal(); CV = null;
    for (const r of revsOf(c)) for (const f of (r.files || [])) if (f.path) deleteFile(f.path);
    await removeRow('project_cards', c.id); toast('삭제했습니다');
  };
}
/* 수정본 올리기: 새 카드를 만들지 않고 같은 카드에 2차, 3차로 쌓음. 이전 차수는 그대로 남음 */
function openRevAdd(id){
  const c = CARDS().find(x => x.id === id); if (!c) return;
  const no = revsOf(c).length + 1, at = attachBox('rvFiles', [], 'projects', { rename: true });
  openModal(`${modalHead(`${no}차 수정본 올리기`)}
    <div class="mb"><div><b>${esc(c.title)}</b><div class="hint">이전 차수(1~${no - 1}차)는 지워지지 않고 그대로 볼 수 있습니다.</div></div>
      <div class="f"><label>무엇이 바뀌었나요?</label><textarea id="rvMemo" maxlength="1000" style="min-height:60px" placeholder="예: 단가 3,200 → 2,950원으로 조정, 최소 수량 3천 개로 변경"></textarea></div>
      <div class="f"><label>수정본 파일 *</label>${at.html}</div>
      ${c.status !== '참고 자료' && c.status !== '결정 대기' ? `<div class="hint">지금 상태는 <b>${esc(stLabel(c.status))}</b>입니다. 수정본을 올리면 다시 <b>결정 대기</b>로 바뀌어 회의 안건에 올라갑니다.</div>` : ''}</div>
    <div class="mf"><button class="btn" data-close>취소</button><button class="btn primary" id="rvSave">${no}차로 올리기</button></div>`, { wide: true });
  at.bind(); $('#rvMemo').focus();
  $('#rvSave').onclick = async () => {
    if ($('#rvFiles .up')) { toast('파일을 올리는 중입니다. 잠시만 기다려 주세요', true); return; }
    if (!at.files.length) { toast('수정본 파일을 첨부하세요', true); return; }
    const row = { ...c, status: c.status === '참고 자료' ? c.status : '결정 대기', revisions: [...revsOf(c), { no, memo: $('#rvMemo').value.trim(), files: [...at.files], by: me, at: nowIso() }], updated_by: me };
    closeModal(); await saveRow('project_cards', row); toast(`${no}차 수정본을 올렸습니다`); openCard(c.id);
  };
}

/* ---------- 카드 열어 보기: PDF·이미지를 내려받지 않고 화면에서 바로 봄 (회의 때 큰 화면에 띄우는 용도) ---------- */
function openCard(id, rev, file){
  const c = CARDS().find(x => x.id === id); if (!c) return;
  const rs = revsOf(c), r = rs.find(x => x.no === rev) || lastRev(c), fs = r.files || [], fi = Math.min(Math.max(0, file || 0), Math.max(0, fs.length - 1)), f = fs[fi];
  CV = { id, rev: r.no, file: fi };
  const p = P().find(x => x.id === c.project_id) || {};
  const view = !f ? '<div class="vnone">첨부 파일이 없습니다.</div>'
    : isPdf(f) ? (isTouch() ? `<div class="vpdf" id="pdfBox"><div class="vnone">PDF 를 불러오는 중…</div></div>` : `<iframe src="${esc(f.url)}#view=FitH" title="${esc(f.name)}"></iframe>`)
    : isImg(f) ? `<div class="vimg"><img src="${esc(f.url)}" alt="${esc(f.name)}"></div>`
    : `<div class="vnone">이 파일은 화면에서 바로 볼 수 없는 형식입니다.<br><a class="btn" href="${esc(f.url)}?download=${encodeURIComponent(f.name)}">${esc(f.name)} 내려받기</a></div>`;
  openModal(`${modalHead(`${isShare(c) ? '' : stCard(c.status)} ${esc(c.title)}`)}
    <div class="cv">
      <div class="cvmain" id="cvMain">
        <div class="cvbar">${rs.length > 1 ? `<span class="rvs">${rs.map(x => `<button class="lchip ${x.no === r.no ? 'on' : ''}" data-rev="${x.no}" title="${esc(x.by || '')} · ${fmtDateTime(x.at)}">${x.no}차</button>`).join('')}</span>` : ''}
          <span class="fls">${fs.map((x, i) => `<button class="lchip ${i === fi ? 'on' : ''}" data-fi="${i}" title="${esc(x.name)}">${isPdf(x) ? '📕' : isImg(x) ? '🖼' : '📄'} ${esc(x.name)}</button>`).join('')}</span>
          <span class="sp"></span>${f ? `<a class="btn sm" href="${esc(f.url)}" target="_blank" rel="noopener">새 창</a><a class="btn sm" href="${esc(f.url)}?download=${encodeURIComponent(f.name)}">내려받기</a><button class="btn sm primary" id="cvFull" title="회의 때 큰 화면에 띄우기 (Esc 로 돌아옴)">⛶ 큰 화면</button>` : ''}</div>
        <div class="cvview">${view}</div>
      </div>
      <aside class="cvside">
        <div class="cvmeta"><span class="hint"># ${esc(p.name || '')}</span></div>
        <div class="cvby">${who(c.created_by)}<span class="hint">${fmtDateTime(c.created_at)} 올림</span></div>
        ${c.memo ? `<div class="cvmemo">${linkify(c.memo)}</div>` : ''}
        <div id="cvExtra">${cardExtraHtml(c)}</div>
        <div class="cvsec">수정본 ${rs.length > 1 ? `(${rs.length}차까지)` : ''}</div>
        ${rs.slice().reverse().map(x => `<div class="cvrev ${x.no === r.no ? 'on' : ''}" data-rev="${x.no}"><b>${x.no}차</b> <span class="hint">${esc(x.by || '')} · ${fmtDateTime(x.at).slice(5)} · 파일 ${(x.files || []).length}개</span>${x.memo ? `<div class="rm">${esc(x.memo)}</div>` : ''}</div>`).join('')}
        <button class="btn sm" id="cvRev">＋ ${rs.length + 1}차 수정본 올리기</button>
        <div class="cvfoot"><button class="btn sm danger" id="cvDel">삭제</button><button class="btn sm" id="cvEdit">이름·메모 수정</button></div>
      </aside>
    </div>`, { wide: true });
  const m = document.querySelector('#modal .modal'); m.classList.add('xl');
  document.querySelectorAll('#modal [data-rev]').forEach(b => b.onclick = () => openCard(id, Number(b.dataset.rev), 0));
  document.querySelectorAll('#modal [data-fi]').forEach(b => b.onclick = () => openCard(id, r.no, Number(b.dataset.fi)));
  const full = $('#cvFull'); if (full) full.onclick = () => { const el = $('#cvMain'); (el.requestFullscreen || el.webkitRequestFullscreen || (() => {})).call(el); };
  $('#cvRev').onclick = () => openRevAdd(id);
  $('#cvEdit').onclick = () => openCardEdit(p, id);
  const cd = $('#cvDel'); if (cd) { if (!(c.created_by === me || isAdmin())) cd.remove(); else cd.onclick = () => talkDelete('card|' + id); }
  document.querySelectorAll('#modal [data-close]').forEach(b => b.addEventListener('click', () => { CV = null; }));
  CV.ds = ''; bindCardExtra(c); markCardSeen(c);
  if (f && isPdf(f) && isTouch()) renderPdf($('#pdfBox'), f.url);
}

/* ================= 2단계: 댓글 · 결정 기록 · 결정 로그 ================= */
const decDay = d => d.decided_at || (d.created_at || '').slice(0, 10);
const decsOf = pid => DECS().filter(d => d.project_id === pid).sort((a, b) => String(decDay(b)).localeCompare(String(decDay(a))) || String(b.created_at || '').localeCompare(String(a.created_at || '')));
const DEC_STATUSES = ['승인', '보류', '반려', '결정 대기', '참고 자료'];
/* 저장 직전에 서버의 최신 카드를 다시 읽음: 두 사람이 동시에 댓글을 달아도 서로의 댓글이 지워지지 않게 */
async function freshCard(id){
  try { if (store.client) { const { data } = await store.client.from('project_cards').select('*').eq('id', id).single(); if (data) return normalize('project_cards', data); } } catch {}
  return CARDS().find(x => x.id === id);
}
/* 카드 창 오른쪽: 결정 기록(상태 + 한 줄 + 이유)과 댓글 */
function cardExtraHtml(c){
  const ds = decsOf(c.project_id).filter(d => d.card_id === c.id), cm = c.comments || [];
  return `<div class="cvsec" style="margin-top:0;border-top:0;padding-top:0">결정 기록 <span class="hint" style="font-weight:400">(회의에서 정한 것이 있을 때만)</span></div>
    <div class="decbox">
      <div class="kpick">${DEC_STATUSES.map(st => `<button type="button" class="lchip ${c.status === st ? 'cur' : ''}" data-ds="${st}">${st === '참고 자료' ? '공유만 (결정 없음)' : st}</button>`).join('')}</div>
      <input id="dBody" maxlength="300" placeholder="결정 한 줄 (예: A안으로 확정. 상표 등록 가능 여부 확인하기)">
      <input id="dReason" maxlength="300" placeholder="이유 (선택)">
      <div class="drow2"><span class="hint">상태를 고르고 한 줄 적은 뒤 Enter</span><button class="btn sm primary" id="dSave">결정 기록</button></div>
    </div>
    ${ds.map(d => `<div class="cvdec"><div class="dh">${d.status ? stCard(d.status) : ''}<span class="hint">${fmtDate(decDay(d))} · ${esc(d.created_by || '')}</span>${d.created_by === me || isAdmin() ? `<button class="mx" data-ddel="${d.id}" title="이 결정 기록 삭제">✕</button>` : ''}</div><b>${esc(d.body)}</b>${d.reason ? `<div class="rs">이유: ${esc(d.reason)}</div>` : ''}</div>`).join('')}
    <div class="cvsec">댓글 ${cm.length ? cm.length : ''}</div>
    ${cm.map(m => `<div class="cvcm"><b>${esc(m.by || '')}</b><span class="tx">${linkify(m.text || '')}</span><span class="at">${fmtDateTime(m.at).slice(5)}</span>${m.by === me || isAdmin() ? `<button class="mx" data-cmdel="${m.id}" title="댓글 삭제">✕</button>` : ''}</div>`).join('') || '<div class="hint">회의 전에 미리 의견을 남기거나, 자리에 없던 사람이 나중에 남기는 곳입니다.</div>'}
    <input id="cmIn" maxlength="1000" placeholder="댓글 입력 후 Enter">`;
}
function bindCardExtra(c){
  const paint = () => document.querySelectorAll('[data-ds]').forEach(b => b.classList.toggle('on', b.dataset.ds === (CV && CV.ds)));
  document.querySelectorAll('[data-ds]').forEach(b => b.onclick = () => { if (CV) CV.ds = CV.ds === b.dataset.ds ? '' : b.dataset.ds; paint(); const i = $('#dBody'); if (i) i.focus(); });
  paint();
  const save = () => saveDecision(c.id);
  const sv = $('#dSave'); if (sv) sv.onclick = save;
  ['#dBody', '#dReason'].forEach(q => { const i = $(q); if (i) i.onkeydown = e => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); save(); } }; });
  const ci = $('#cmIn'); if (ci) ci.onkeydown = async e => {
    if (e.key !== 'Enter' || e.isComposing) return;   // 한글 조합 중 Enter 는 무시
    const t = ci.value.trim(); if (!t) return; ci.value = '';
    const f = await freshCard(c.id); if (!f) return;
    await saveRow('project_cards', { ...f, comments: [...(f.comments || []), { id: uid(), by: me, text: t, at: nowIso() }], updated_by: me });
    const again = $('#cmIn'); if (again) again.focus();
  };
  document.querySelectorAll('[data-cmdel]').forEach(b => b.onclick = async () => { if (!confirm('이 댓글을 삭제할까요?')) return; const f = await freshCard(c.id); if (f) await saveRow('project_cards', { ...f, comments: (f.comments || []).filter(m => m.id !== b.dataset.cmdel), updated_by: me }); });
  document.querySelectorAll('#cvExtra [data-ddel]').forEach(b => b.onclick = async () => { if (confirm('이 결정 기록을 삭제할까요?\n(자료의 상태는 그대로 둡니다)')) await removeRow('project_decisions', b.dataset.ddel); });
}
/* 결정 기록: 상태를 바꾸면서 결정 한 줄과 이유를 남김. 승인·보류·반려는 한 줄이 꼭 있어야 함 */
async function recordDecision(id, st, body, reason){
  const c = CARDS().find(x => x.id === id); if (!c) return false;
  if (!st) { toast('먼저 상태(승인·보류·반려…)를 고르세요', true); return false; }
  if (['승인', '보류', '반려'].includes(st) && !body) { toast('결정 한 줄을 적어 주세요', true); return false; }
  if (!body && st === c.status) return false;
  if (body) await saveRow('project_decisions', { id: uid(), project_id: c.project_id, card_id: c.id, status: st, body, reason: reason || null, decided_at: todayStr(), created_by: me, created_at: nowIso(), updated_by: me });
  if (st !== c.status) { const f = await freshCard(id); await saveRow('project_cards', { ...f, status: st, updated_by: me }); }
  toast(body ? '결정을 기록했습니다' : `상태를 "${stLabel(st)}"(으)로 바꿨습니다`);
  return true;
}
async function saveDecision(id){   // 카드 창 오른쪽의 결정 기록 상자
  if (!CV) return;
  const st = CV.ds, body = ($('#dBody') || {}).value.trim(), reason = ($('#dReason') || {}).value.trim();
  if (['승인', '보류', '반려'].includes(st) && !body) $('#dBody').focus();
  const bi = $('#dBody'), ri = $('#dReason'), keep = [bi.value, ri.value]; bi.value = ''; ri.value = ''; CV.ds = '';
  if (!(await recordDecision(id, st, body, reason))) { const b2 = $('#dBody'), r2 = $('#dReason'); if (b2) b2.value = keep[0]; if (r2) r2.value = keep[1]; if (CV) { CV.ds = st; document.querySelectorAll('[data-ds]').forEach(b => b.classList.toggle('on', b.dataset.ds === st)); } }
}
/* 빠른 결정: 대화나 목록에서 카드의 상태 표시(결정 대기 ▾)를 누르면 카드를 열지 않고 바로 결정을 적는 작은 창 */
function bindQuickDec(){ document.querySelectorAll('[data-qd]').forEach(b => b.onclick = e => { e.stopPropagation(); openQuickDec(b.dataset.qd); }); }
function openQuickDec(id){
  const c = CARDS().find(x => x.id === id); if (!c) return;
  let st = c.status === '결정 대기' ? '승인' : '';
  openModal(`${modalHead('결정 기록')}
    <div class="mb"><div><b>${esc(c.title)}</b> <span class="hint">지금 상태: ${esc(stLabel(c.status))}</span></div>
      <div class="f"><label>어떻게 정했나요?</label><div class="kpick qdpick">${DEC_STATUSES.map(x => `<button type="button" class="lchip" data-qs="${x}">${x === '참고 자료' ? '공유만 (결정 없음)' : x}</button>`).join('')}</div></div>
      <div class="f"><label>결정 한 줄</label><input id="qBody" maxlength="300" placeholder="예: A안으로 확정. 상표 등록 가능 여부 확인하기"></div>
      <div class="f"><label>이유 (선택)</label><input id="qReason" maxlength="300" placeholder="예: 단가가 가장 낮고 납기가 빠름"></div>
      <div class="hint">승인·보류·반려는 결정 한 줄이 필요합니다. 자료를 보면서 정하려면 <a href="#" id="qOpen">파일 열기</a></div></div>
    <div class="mf"><button class="btn" data-close>취소</button><button class="btn primary" id="qSave">기록</button></div>`);
  const paint = () => document.querySelectorAll('[data-qs]').forEach(b => b.classList.toggle('on', b.dataset.qs === st));
  document.querySelectorAll('[data-qs]').forEach(b => b.onclick = () => { st = b.dataset.qs; paint(); $('#qBody').focus(); });
  paint(); $('#qBody').focus();
  const save = async () => { const body = $('#qBody').value.trim(), reason = $('#qReason').value.trim(); if (['승인', '보류', '반려'].includes(st) && !body) { $('#qBody').focus(); toast('결정 한 줄을 적어 주세요', true); return; } if (!st) { toast('상태를 고르세요', true); return; } closeModal(); await recordDecision(id, st, body, reason); };
  $('#qSave').onclick = save;
  ['#qBody', '#qReason'].forEach(q => { $(q).onkeydown = e => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); save(); } }; });
  $('#qOpen').onclick = e => { e.preventDefault(); closeModal(); openCard(id); };
}
/* 카드 창이 열린 채로 내용이 바뀌면(내가 저장했거나 다른 사람이 올렸거나) 오른쪽만 새로 그림 — PDF 보는 화면은 건드리지 않음 */
function refreshCardSide(id){
  const c = CARDS().find(x => x.id === id), box = $('#cvExtra'); if (!box) return;
  if (!c) { closeModal(); CV = null; return; }
  const ae = document.activeElement, keepId = ae && ['dBody', 'dReason', 'cmIn'].includes(ae.id) ? ae.id : '', vals = {}; ['dBody', 'dReason', 'cmIn'].forEach(k => { const i = $('#' + k); if (i) vals[k] = i.value; });
  box.innerHTML = cardExtraHtml(c);
  Object.entries(vals).forEach(([k, v]) => { const i = $('#' + k); if (i) i.value = v; });
  bindCardExtra(c);
  const h = document.querySelector('#modal .mh h2'); if (h) h.innerHTML = `${isShare(c) ? '' : stCard(c.status)} ${esc(c.title)}`;
  if (keepId) { const i = $('#' + keepId); if (i) { i.focus(); try { i.setSelectionRange(i.value.length, i.value.length); } catch {} } }
}
/* 대화에 결정도 한 줄로 */
let talkExtraEvents = function(p, ev){
  decsOf(p.id).forEach(d => { const c = d.card_id ? CARDS().find(x => x.id === d.card_id) : null;
    ev.push({ at: d.created_at, by: d.created_by, type: 'dec', dec: d, html: `<div class="mt"><span class="dk">✅ 결정</span> ${d.status ? stCard(d.status) : ''} <b>${esc(d.body)}</b>${d.reason ? `<div class="rs">이유: ${esc(d.reason)}</div>` : ''}</div>${c ? cardChip(c) : ''}` }); });
};
/* 결정 로그 탭: 이 채널의 모든 결정이 날짜순으로. 근거가 된 카드로 바로 이동 */
let decQ = '';
function decsHtml(p){
  const s = decQ.trim().toLowerCase(), all = decsOf(p.id), list = all.filter(d => !s || [d.body, d.reason, d.created_by, (CARDS().find(c => c.id === d.card_id) || {}).title].some(v => (v || '').toLowerCase().includes(s)));
  let last = '';
  return `<div class="actions"><button class="btn primary" id="newDec" style="padding:9px 16px;font-size:14px">＋ 결정 추가</button><span class="hint">자료 없이 회의에서 정한 것도 여기에 한 줄로 남깁니다</span>
      <input type="search" id="decQ" placeholder="검색 (결정, 이유, 자료 제목)" value="${esc(decQ)}" style="margin-left:auto;border:1px solid var(--line2);border-radius:var(--radius);padding:6px 8px;min-width:220px"></div>
    <div class="declist" id="decList">${list.length ? list.map(d => { const c = d.card_id ? CARDS().find(x => x.id === d.card_id) : null, mon = decDay(d).slice(0, 7), head = mon === last ? '' : `<div class="dmon">${mon.slice(0, 4)}년 ${Number(mon.slice(5, 7))}월</div>`; last = mon;
      return head + `<div class="drow"><span class="dd">${fmtDate(decDay(d)).slice(5)}</span><div class="db"><div class="dt">${d.status ? stCard(d.status) : tag('회의 결정', '#ede9fe', '#5b21b6', true)} <b>${esc(d.body)}</b></div>${d.reason ? `<div class="rs">이유: ${esc(d.reason)}</div>` : ''}
        <div class="dm">${esc(d.created_by || '')} 기록${c ? ` · 근거 자료 <a class="dlink" data-card="${c.id}">📑 ${esc(c.title)}</a>` : d.card_id ? ' · (근거 자료가 삭제됨)' : ''}</div></div>
        ${d.created_by === me || isAdmin() ? `<button class="btn sm" data-dedit="${d.id}">수정</button>` : ''}</div>`; }).join('')
      : `<div class="empty">${s ? '해당하는 결정이 없습니다.' : '아직 기록된 결정이 없습니다.<br>파일을 열어 <b>승인·보류·반려</b>와 결정 한 줄을 적거나, <b>＋ 결정 추가</b>로 회의에서 정한 것을 남겨 보세요.'}</div>`}</div>`;
}
function bindDecs(p){
  const nb = $('#newDec'); if (nb) nb.onclick = () => openDecEdit(p, null);
  const q = $('#decQ'); if (q) q.oninput = () => { decQ = q.value; const pos = q.selectionStart; render(); const q2 = $('#decQ'); if (q2) { q2.focus(); try { q2.setSelectionRange(pos, pos); } catch {} } };
  document.querySelectorAll('#decList [data-card]').forEach(a => a.onclick = () => openCard(a.dataset.card));
  document.querySelectorAll('#decList [data-dedit]').forEach(b => b.onclick = () => openDecEdit(p, b.dataset.dedit));
}
/* 자료 없이 정한 결정 추가 · 결정 고치기 */
function openDecEdit(p, id){
  const d = id ? DECS().find(x => x.id === id) : null, c = d && d.card_id ? CARDS().find(x => x.id === d.card_id) : null;
  openModal(`${modalHead(d ? '결정 수정' : `결정 추가 — # ${esc(p.name)}`)}
    <div class="mb">${c ? `<div class="hint">근거 자료: 📑 ${esc(c.title)}</div>` : ''}
      <div class="f"><label>결정 한 줄 *</label><input id="eBody" maxlength="300" value="${esc(d ? d.body : '')}" placeholder="예: 1차 발주는 3천 개로 한다"></div>
      <div class="f"><label>이유 (선택)</label><input id="eReason" maxlength="300" value="${esc(d ? d.reason || '' : '')}" placeholder="예: 최소 수량이 3천 개라서"></div>
      <div class="f"><label>결정한 날</label><input type="date" id="eDate" value="${esc(d ? decDay(d) : todayStr())}" style="max-width:180px"></div></div>
    <div class="mf">${d ? '<button class="btn danger left" id="eDel">삭제</button>' : ''}<button class="btn" data-close>취소</button><button class="btn primary" id="eSave">${d ? '저장' : '기록'}</button></div>`, { wide: true });
  $('#eBody').focus();
  const save = async () => { const body = $('#eBody').value.trim(); if (!body) { $('#eBody').focus(); toast('결정 한 줄을 적어 주세요', true); return; }
    const row = d ? { ...d, body, reason: $('#eReason').value.trim() || null, decided_at: $('#eDate').value || todayStr(), updated_by: me } : { id: uid(), project_id: p.id, card_id: null, status: null, body, reason: $('#eReason').value.trim() || null, decided_at: $('#eDate').value || todayStr(), created_by: me, created_at: nowIso(), updated_by: me };
    closeModal(); await saveRow('project_decisions', row); toast(d ? '저장했습니다' : '결정을 기록했습니다'); };
  $('#eSave').onclick = save;
  ['#eBody', '#eReason'].forEach(q => { $(q).onkeydown = e => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); save(); } }; });
  const del = $('#eDel'); if (del) del.onclick = async () => { if (confirm('이 결정 기록을 삭제할까요?')) { closeModal(); await removeRow('project_decisions', d.id); toast('삭제했습니다'); } };
}

/* ================= 3단계: 회의 안건 목록 · 업무/업무공유 연결 ================= */
/* 회의 안건: 모든 (진행 중) 채널에서 '결정 대기'인 카드만 프로젝트별로 묶어 보여 줌. 대표가 이 화면만 보면 결정할 것을 알 수 있게 */
function agendaHtml(){
  const groups = P().filter(x => x.status !== '완료').map(x => ({ p: x, cards: cardsOf(x.id).filter(c => c.status === '결정 대기').sort((a, b) => String(cardLastAt(a)).localeCompare(String(cardLastAt(b)))) })).filter(g => g.cards.length)
    .sort((a, b) => String(cardLastAt(a.cards[0])).localeCompare(String(cardLastAt(b.cards[0]))));   // 오래 기다린 것부터
  const total = groups.reduce((n, g) => n + g.cards.length, 0);
  return `<div class="slh"><button class="slmenu" id="slMenu" title="채널 목록">☰</button><h2>📋 회의 안건</h2><span class="sp"></span><span class="hint">결정 대기 ${total}건 · 채널 ${groups.length}개</span></div>
    <div class="slt" style="padding:6px 16px"><span class="hint">모든 채널에서 결정을 기다리는 자료입니다. 누르면 자료가 열리고, <b>결정 대기 ▾</b>를 누르면 바로 결정을 적을 수 있습니다.</span></div>
    <div class="slscroll" id="tscroll"><div class="slpad">${groups.length ? groups.map(g => `<div class="agp"><div class="agh"><a class="agn" data-goto="${g.p.id}"># ${esc(g.p.name)}</a><span class="hint">${g.p.owner ? '리더 ' + esc(fullName(g.p.owner)) + ' · ' : ''}결정 대기 ${g.cards.length}건</span></div>
      ${g.cards.map(c => { const fs = cardFiles(c), img = fs.find(isImg), d = daysAgo(cardLastAt(c)), n = revsOf(c).length; return `<div class="agc" data-card="${c.id}">${img ? `<img src="${esc(img.url)}" alt="" loading="lazy">` : `<span class="ic">${fs.length && isPdf(fs[0]) ? '📕' : '📄'}</span>`}
        <div class="ai"><b>${esc(c.title)}</b>${n > 1 ? ` <span class="rv">${n}차</span>` : ''}<div class="am">${esc(c.created_by || '')} · ${d === 0 ? '오늘' : d + '일 전'} 올림${(c.comments || []).length ? ` · 💬 ${c.comments.length}` : ''}</div>${c.memo ? `<div class="at">${esc(c.memo)}</div>` : ''}</div>
        <button type="button" class="qd" data-qd="${c.id}" title="눌러서 결정 기록 (승인·보류·반려)">${stCard(c.status)}<span class="ar">▾</span></button></div>`; }).join('')}</div>`).join('')
      : `<div class="slempty"><div class="big">결정을 기다리는 자료가 없습니다 👍</div>파일을 보낼 때 <b>결정 필요</b>에 체크한 것만 여기에 프로젝트별로 모입니다.</div>`}</div></div>`;
}
function bindAgenda(){
  document.querySelectorAll('#tscroll .agc[data-card]').forEach(el => el.onclick = () => openCard(el.dataset.card));
  document.querySelectorAll('#tscroll [data-goto]').forEach(a => a.onclick = () => { cur = a.dataset.goto; LS.set('proj_cur', cur); tab = 'plan'; talkStick = true; render(); });
  bindQuickDec();
}
/* 프로젝트를 고른 업무(tasks.project_id)와 업무공유(decisions.project_id)는 그 채널의 대화에도 한 줄로 나타남 */
const _talkExtra2 = talkExtraEvents;
talkExtraEvents = function(p, ev){
  _talkExtra2(p, ev);
  (DATA.tasks || []).filter(t => t.project_id === p.id && (isAdmin() || !(t.assignee && t.assignee === t.created_by) || t.assignee === me)).forEach(t =>
    ev.push({ at: t.created_at, by: t.created_by, type: 'task', html: `<div class="mt"><span class="lk">📝 업무</span> <a href="tasks.html" title="업무 화면에서 보기"><b>${esc(t.title)}</b></a> <span class="hint">${t.assignee && t.assignee !== t.created_by ? '→ ' + esc(fullName(t.assignee)) + ' · ' : ''}${esc(t.status || '')}${t.due_date ? ' · 마감 ' + fmtDate(t.due_date).slice(5) : ''}</span></div>` }));
  (DATA.decisions || []).filter(d => d.project_id === p.id && (isAdmin() || !(Array.isArray(d.targets) && d.targets.length) || d.targets.includes(me) || d.created_by === me)).forEach(d =>
    ev.push({ at: d.created_at, by: d.created_by, type: 'share', html: `<div class="mt"><span class="lk">📣 업무공유</span> <a href="decisions.html" title="업무공유 화면에서 보기"><b>${esc(d.title)}</b></a>${d.reason ? `<div class="rs">${esc(d.reason)}</div>` : ''}</div>` }));
};

/* ================= 4단계: 안 읽음 표시 · 휴대폰 ================= */
/* 사람별 읽음 기록(project_reads: id = 이름|프로젝트id, seen = { _channel: 채널을 마지막으로 본 시각, 카드id: 그 카드를 마지막으로 연 시각 })
   내 기록만 따로 읽어 와서 들고 있음(READS). 실시간 구독 대상이 아니라서, 누가 읽을 때마다 모두의 화면이 다시 그려지는 일은 없음 */
let READS = null;            // { 프로젝트id: seen }  (null = 아직 안 읽어 옴)
const newFrom = {};          // 채널에 들어온 순간까지 읽었던 시각 (대화의 '새 글' 선 위치)
const isTouch = () => window.matchMedia && window.matchMedia('(pointer:coarse)').matches;
async function loadReads(){
  READS = {};
  if (!store.client || !me) return;
  try {
    const { data } = await store.client.from('project_reads').select('*').eq('member', me);
    (data || []).forEach(r => { READS[r.project_id] = r.seen || {}; });
    if (!(data || []).length) { const now = nowIso(); for (const x of P()) { READS[x.id] = { _channel: now }; await saveReads(x.id); } }   // 처음 쓰는 사람: 지금까지의 글은 읽은 것으로
  } catch {}
  render();
}
async function saveReads(pid){ try { if (store.client && me) await store.client.from('project_reads').upsert({ id: me + '|' + pid, member: me, project_id: pid, seen: READS[pid] || {}, updated_at: nowIso() }); } catch {} }
const seenOf = pid => (READS && READS[pid]) || {};
/* 채널의 안 읽은 글 수: 내가 마지막으로 본 뒤에 다른 사람이 올린 메시지·카드·수정본·댓글·결정 */
function unreadOf(pid){
  if (!READS) return 0;
  const p = P().find(x => x.id === pid); if (!p) return 0;
  const from = seenOf(pid)._channel || '';
  return talkEvents(p).filter(e => e.by !== me && String(e.at) > from).length;
}
/* 카드의 새 글: 내가 그 카드를 마지막으로 연 뒤(연 적 없으면 채널 기준 시각 뒤)에 다른 사람이 올린 수정본·댓글·결정이 있는가 */
function cardUnread(c){
  if (!READS) return false;
  const s = seenOf(c.project_id), from = s[c.id] || s._base || s._channel || '';
  const others = [...(c.created_by !== me ? [c.created_at] : []), ...revsOf(c).filter(r => r.by !== me).map(r => r.at), ...(c.comments || []).filter(m => m.by !== me).map(m => m.at), ...DECS().filter(d => d.card_id === c.id && d.created_by !== me).map(d => d.created_at)];
  return others.some(at => String(at) > from);
}
/* 채널의 메시지 화면을 보고 있으면 읽은 것으로 기록 (창이 가려져 있을 때는 기록하지 않음) */
function markChannelSeen(p){
  if (!READS || document.visibilityState !== 'visible') return;
  const s = seenOf(p.id);
  if (!(p.id in newFrom)) newFrom[p.id] = s._channel || '';
  if (!unreadOf(p.id) && s._channel) return;
  READS[p.id] = { ...s, _base: s._base || s._channel || nowIso(), _channel: nowIso() };
  saveReads(p.id);
  setTimeout(() => { if (cur === p.id) render(); }, 0);   // 왼쪽 숫자를 지움 ('새 글' 선은 채널을 나갈 때까지 남음)
}
function markCardSeen(c){
  if (!READS) return;
  const was = cardUnread(c);
  READS[c.project_id] = { ...seenOf(c.project_id), [c.id]: nowIso() };
  if (was) { saveReads(c.project_id); setTimeout(render, 0); }
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && typeof render === 'function' && me) render(); });   // 다른 창을 보다 돌아오면 읽음 처리
/* 휴대폰에서는 브라우저가 PDF 를 화면 안에 못 띄우는 경우가 많아, PDF.js 로 쪽마다 그림으로 그려서 보여 줌 */
let pdfjsReady = null;
function loadPdfJs(){
  if (!pdfjsReady) pdfjsReady = new Promise((ok, no) => { const sc = document.createElement('script'); sc.src = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js'; sc.onload = () => { try { window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js'; ok(window.pdfjsLib); } catch (e) { no(e); } }; sc.onerror = no; document.head.appendChild(sc); });
  return pdfjsReady;
}
async function renderPdf(box, url){
  if (!box) return;
  try {
    const lib = await loadPdfJs(), pdf = await lib.getDocument({ url }).promise;
    if (!document.body.contains(box)) return;
    box.innerHTML = '';
    const w = Math.max(280, box.clientWidth - 8), dpr = Math.min(2, window.devicePixelRatio || 1);
    for (let n = 1; n <= pdf.numPages; n++) {
      const page = await pdf.getPage(n), v0 = page.getViewport({ scale: 1 }), vp = page.getViewport({ scale: (w / v0.width) * dpr });
      const cv = document.createElement('canvas'); cv.width = vp.width; cv.height = vp.height; cv.style.width = w + 'px';
      if (!document.body.contains(box)) return;
      box.appendChild(cv);
      await page.render({ canvasContext: cv.getContext('2d'), viewport: vp }).promise;
    }
  } catch (e) { box.innerHTML = `<div class="vnone">이 화면에서 PDF 를 바로 열지 못했습니다.<br><a class="btn" href="${esc(url)}" target="_blank" rel="noopener">새 창에서 열기</a></div>`; }
}

/* ---------- 채널 화면에 쓰는 모양 ---------- */
document.head.insertAdjacentHTML('beforeend', `<style>
  .chinfo{margin:-4px 0 10px;display:grid;gap:6px;max-width:980px}
  .chrow{display:flex;align-items:center;gap:6px;flex-wrap:wrap;font-size:13px}
  .chrow .lb{font-size:12px;color:var(--fg3);margin-right:2px}
  .chrow .lb:not(:first-child){margin-left:10px}
  .ago{margin-left:auto;font-size:12px;color:var(--fg2);background:var(--bg2);border-radius:999px;padding:2px 10px;white-space:nowrap}
  .ago.old{background:#fee2e2;color:#b91c1c;font-weight:600}
  .ago.none{color:var(--fg3)}
  .pin{border:1px solid #fde68a;background:#fffbea;border-radius:8px;padding:6px 10px;display:flex;align-items:flex-start;gap:8px}
  .pin .pt{flex:1;min-width:0;white-space:pre-wrap;word-break:break-word;line-height:1.55;font-size:13px}
  .talk{max-width:980px}
  .tfeed{padding-bottom:6px}
  .tday{display:flex;align-items:center;gap:10px;margin:14px 0 6px;font-size:12px;font-weight:700;color:var(--fg2)}
  .tday::before,.tday::after{content:"";flex:1;height:1px;background:var(--line)}
  .msg{display:flex;gap:10px;padding:6px 8px;border-radius:8px}
  .msg:hover{background:var(--bg2)}
  .msg > .av{width:34px;height:34px;font-size:15px;flex:none;margin-top:2px}
  .msg .mb2{flex:1;min-width:0}
  .msg .mh2{display:flex;align-items:baseline;gap:8px;font-size:14px}
  .msg .mh2 .tm{font-size:11px;color:var(--fg3)}
  .msg .mx{margin-left:auto;border:0;background:transparent;color:var(--fg3);font-size:12px;visibility:hidden}
  .msg:hover .mx{visibility:visible}
  .msg .mt{white-space:pre-wrap;word-break:break-word;line-height:1.6;font-size:14px}
  .msg .mt.sys{color:var(--fg2);font-size:13px}
  .msg .mt .re{color:var(--blue);cursor:pointer;font-size:13px}
  .msg .files{margin-top:6px}
  .cchip{display:flex;align-items:center;gap:10px;border:1px solid var(--line2);border-radius:10px;background:var(--bg);padding:8px 12px;margin-top:6px;max-width:460px;cursor:pointer;box-shadow:0 1px 2px rgba(0,0,0,.04)}
  .cchip:hover{border-color:var(--blue);box-shadow:var(--shadow)}
  .cchip img{width:44px;height:44px;object-fit:cover;border-radius:6px;border:1px solid var(--line);flex:none}
  .cchip .ic{font-size:28px;line-height:1;flex:none}
  .cchip .ci{flex:1;min-width:0;display:flex;flex-direction:column}
  .cchip .ci b{font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .cchip .ci span{font-size:12px;color:var(--fg3)}
  .talkbox{position:sticky;bottom:8px;margin-top:10px;z-index:5}
  .talkbox textarea{min-height:40px;max-height:220px}
  .tkcard{display:flex;align-items:center;gap:8px;flex-wrap:wrap;background:#fffbea;border:1px solid #fde68a;border-radius:8px;padding:6px 10px;font-size:12px}
  .tkcard[hidden]{display:none}
  .tkcard .tl{font-weight:700;color:#92400e}
  .tkcard input{flex:1;min-width:160px;border:1px solid var(--line2);border-radius:6px;padding:4px 8px;font:inherit;font-size:13px}
  .tkcard .need{display:inline-flex;align-items:center;gap:5px;font-size:13px;cursor:pointer;white-space:nowrap;width:auto;font-weight:400;color:var(--fg)}
  .cgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:12px;max-width:1500px}
  .ccard{border:1px solid var(--line);border-radius:10px;background:var(--bg);padding:12px 14px;cursor:pointer;display:flex;flex-direction:column;gap:6px;box-shadow:0 1px 2px rgba(0,0,0,.04)}
  .ccard:hover{box-shadow:var(--shadow);border-color:var(--line2)}
  .ccard.st-결정대기{border-left:4px solid #f59e0b}
  .ccard .ct{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--fg2)}
  .ccard .ct .rv{margin-left:auto;background:var(--fg);color:#fff;border-radius:999px;padding:0 8px;font-size:11px;font-weight:600}
  .ccard h3{margin:0;font-size:15px;line-height:1.4;word-break:break-word}
  .ccard .cm2{font-size:13px;color:var(--fg2);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;white-space:pre-wrap}
  .ccard .thumb{display:flex;align-items:center;gap:8px;font-size:12px;color:var(--fg2);min-height:44px}
  .ccard .thumb img{width:64px;height:44px;object-fit:cover;border-radius:6px;border:1px solid var(--line)}
  .ccard .thumb .doc{font-size:26px;line-height:1}
  .ccard .thumb .doc.none{font-size:12px;color:var(--fg3)}
  .ccard .thumb .fn{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .ccard .cf{display:flex;align-items:center;gap:8px;font-size:12px;color:var(--fg3);margin-top:auto}
  .ccard .cf .sp{flex:1}
  .modal.xl{max-width:min(1600px,97vw);width:97vw;height:calc(100vh - 24px);max-height:calc(100vh - 24px);display:flex;flex-direction:column;overflow:hidden}
  .modal.xl .mh h2{font-size:16px;display:flex;align-items:center;gap:8px;min-width:0}
  .cv{flex:1;min-height:0;display:grid;grid-template-columns:minmax(0,1fr) 320px}
  .cvmain{display:flex;flex-direction:column;min-width:0;min-height:0;background:#525659}
  .cvbar{display:flex;align-items:center;gap:6px;flex-wrap:wrap;padding:6px 10px;background:var(--bg2);border-bottom:1px solid var(--line)}
  .cvbar .sp{flex:1}
  .cvbar .rvs,.cvbar .fls{display:flex;gap:4px;flex-wrap:wrap;min-width:0}
  .cvbar .rvs{padding-right:8px;margin-right:2px;border-right:1px solid var(--line2)}
  .cvbar .lchip{max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .cvview{flex:1;min-height:0;display:flex}
  .cvview iframe{flex:1;width:100%;height:100%;border:0;background:#fff}
  .cvview .vimg{flex:1;overflow:auto;text-align:center;background:#2b2b2b}
  .cvview .vimg img{max-width:100%;height:auto;display:block;margin:0 auto}
  .cvview .vnone{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;color:#ddd;text-align:center;line-height:1.7}
  #cvMain:fullscreen{background:#000}
  #cvMain:fullscreen .cvview .vimg img{max-height:calc(100vh - 44px);width:auto}
  .cvside{border-left:1px solid var(--line);padding:12px 14px;overflow:auto;display:flex;flex-direction:column;gap:8px;font-size:13px}
  .cvby{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
  .cvmemo{white-space:pre-wrap;word-break:break-word;line-height:1.6;background:var(--bg2);border-radius:6px;padding:8px 10px;font-size:14px}
  .cvsec{font-size:12px;font-weight:700;color:var(--fg2);margin-top:6px;padding-top:8px;border-top:1px solid var(--line)}
  .cvrev{border:1px solid var(--line);border-radius:6px;padding:6px 8px;cursor:pointer}
  .cvrev:hover{background:var(--bg2)}
  .cvrev.on{border-color:var(--blue);background:#f5f9ff}
  .cvrev .rm{margin-top:2px;white-space:pre-wrap;word-break:break-word;color:var(--fg2)}
  .cvfoot{margin-top:auto;padding-top:8px;display:flex;gap:6px;justify-content:flex-end}
  /* 슬랙 모양 */
  body:has(.sl){overflow:hidden}
  .sl{display:grid;grid-template-columns:260px minmax(0,1fr);background:#fff;font-family:Lato,"Apple SD Gothic Neo","Malgun Gothic",sans-serif}
  .sls{background:#3f0e40;color:#cfc3cf;overflow:auto;padding:0 0 16px;display:flex;flex-direction:column}
  .slst{color:#fff;font-weight:900;font-size:17px;padding:14px 16px 12px;border-bottom:1px solid #5d3d5e;margin-bottom:8px}
  .slsec{font-size:13px;color:#b9a9ba;padding:10px 16px 4px}
  .slnone{font-size:13px;color:#8d7b8e;padding:4px 16px}
  .slch,.sladd{display:flex;align-items:center;gap:8px;width:calc(100% - 16px);margin:0 8px;padding:4px 8px;border:0;border-radius:6px;background:transparent;color:#cfc3cf;font:inherit;font-size:15px;text-align:left;cursor:pointer}
  .slch:hover,.sladd:hover{background:#350d36}
  .slch.on{background:#1164a3;color:#fff}
  .slch .hash,.sladd .hash{width:16px;text-align:center;opacity:.7;flex:none}
  .slch .nm{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .slch .bd{background:#cd2553;color:#fff;border-radius:999px;font-size:11px;font-weight:700;padding:0 7px;line-height:18px}
  .slch .stale{color:#e8912d;font-size:9px}
  .sladd{opacity:.85;margin-top:2px}
  .slm{display:flex;flex-direction:column;min-width:0;min-height:0;background:#fff}
  .slm.drag .talkbox{border:2px dashed #1264a3;background:#f5f9ff}
  .slh{display:flex;align-items:center;gap:8px;padding:10px 16px 6px;flex-wrap:wrap}
  .slh h2{margin:0;font-size:18px;font-weight:900;color:#1d1c1d;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .slh h2 .hash{color:#616061;font-weight:400}
  .slh .sp,.slt .sp{flex:1}
  .ldr{display:inline-flex;align-items:center;gap:6px;background:#f4ede4;border:1px solid #e8d9c5;border-radius:999px;padding:3px 12px 3px 4px;font-size:14px;color:#1d1c1d;white-space:nowrap}
  .ldr .lb{background:#611f69;color:#fff;border-radius:999px;font-size:11px;font-weight:700;padding:2px 8px}
  .ldr .av{width:22px;height:22px;font-size:12px;border-radius:6px}
  .ldr.none{color:#9a8a8a}
  .slh .mm{font-size:13px;color:#616061;border:1px solid #ddd;border-radius:6px;padding:2px 8px}
  .slmenu{display:none;border:1px solid #ddd;background:#fff;border-radius:6px;padding:2px 8px;font-size:16px}
  .slt{display:flex;align-items:center;gap:2px;padding:0 12px;border-bottom:1px solid #e3e3e3}
  .sltab{border:0;background:transparent;padding:7px 10px 8px;font:inherit;font-size:13px;font-weight:700;color:#616061;border-bottom:2px solid transparent;margin-bottom:-1px;cursor:pointer;display:flex;align-items:center;gap:6px}
  .sltab:hover{color:#1d1c1d;background:#f8f8f8}
  .sltab.on{color:#1d1c1d;border-bottom-color:#611f69}
  .sltab .bd{background:#cd2553;color:#fff;border-radius:999px;font-size:11px;padding:0 6px;line-height:17px}
  .slt .ago{margin:0}
  .slpin{display:flex;gap:8px;align-items:flex-start;padding:6px 16px;background:#fffbea;border-bottom:1px solid #f3e7b0;font-size:13px;cursor:pointer;max-height:96px;overflow:auto}
  .slpin:hover{background:#fff6d6}
  .slpin .pt{white-space:pre-wrap;word-break:break-word;line-height:1.5}
  .slpin .pt.none{color:#9a8a5a}
  .slscroll{flex:1;min-height:0;overflow:auto}
  .slpad{padding:14px 16px}
  .slempty{padding:40px 20px;color:#616061;line-height:1.8;font-size:14px}
  .slempty .big{font-size:26px;font-weight:900;color:#1d1c1d;margin-bottom:6px}
  .sl .tfeed{padding:8px 0 10px}
  .sl .tfeed > #talkMore{margin:6px 20px}
  .sl .tday{margin:10px 0 2px;position:relative;justify-content:center}
  .sl .tday::before{position:absolute;left:0;right:0;top:50%;background:#e3e3e3}
  .sl .tday::after{display:none}
  .sl .tday span{position:relative;background:#fff;border:1px solid #e3e3e3;border-radius:24px;padding:3px 14px;font-size:13px;font-weight:700;color:#1d1c1d}
  .sl .msg{padding:6px 20px;border-radius:0;gap:10px}
  .sl .msg:hover{background:#f8f8f8}
  .sl .msg > .av{width:36px;height:36px;border-radius:6px;font-size:16px;margin-top:3px}
  .sl .msg .mh2 b{font-weight:900;font-size:15px;color:#1d1c1d}
  .sl .msg .mh2 .tm{font-size:12px;color:#616061}
  .sl .msg .mt{font-size:15px;line-height:1.47;color:#1d1c1d}
  .sl .msg .mt.sys{color:#616061;font-size:14px}
  .sl .msg .mt .re{color:#1264a3;font-size:14px}
  .sl .cchip{border:1px solid #ddd;border-radius:12px;max-width:440px;padding:10px 12px;margin-top:6px}
  .sl .cchip:hover{border-color:#1264a3;background:#f8f8f8;box-shadow:none}
  .slcomp{padding:0 20px 16px}
  .sl .talkbox{position:static;margin:0;border:1px solid #868686;border-radius:8px;padding:8px 10px 6px;box-shadow:none;gap:6px}
  .sl .talkbox:focus-within{border-color:#1d1c1d;outline:0;box-shadow:0 0 0 1px #1d1c1d}
  .sl .talkbox textarea{font-size:15px;line-height:1.47;min-height:24px;resize:none}
  .sl .talkbox .attach .row > :not(.up){display:none}
  .sl .talkbox .attach .hint.up{display:inline}
  .sl .talkbox .plus{width:28px;height:28px;border-radius:50%;border:0;background:#f0f0f0;color:#444;font-size:16px;line-height:1;cursor:pointer}
  .sl .talkbox .plus:hover{background:#e0e0e0}
  .sl .talkbox .send{width:34px;height:28px;border-radius:6px;border:0;background:#f0f0f0;color:#aaa;font-size:14px;cursor:pointer}
  .sl .talkbox .send.on{background:#007a5a;color:#fff}
  @media (max-width:820px){ .sl{grid-template-columns:minmax(0,1fr)} .sls{display:none;position:absolute;z-index:30;top:auto;bottom:0;left:0;width:270px;box-shadow:4px 0 16px rgba(0,0,0,.3)} .sl{position:relative} .sl.side-open .sls{display:flex;top:0} .slmenu{display:inline-block} .sl .msg{padding:6px 12px} .slcomp{padding:0 10px 10px} .sl .talkbox .crow .hint{display:none} }
  .sltab .cn{font-size:11px;color:#616061;font-weight:400}
  .sl .msg.t-dec{background:#f3fbf5}
  .sl .msg.t-dec:hover{background:#eaf7ee}
  .msg .dk{color:#15803d;font-weight:900}
  .msg .rs,.cvdec .rs,.drow .rs{font-size:13px;color:#616061;margin-top:2px}
  .ccard .cdec{font-size:12px;color:#15803d;background:#f3fbf5;border-radius:6px;padding:3px 8px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .decbox{border:1px solid #bbf7d0;background:#f6fef9;border-radius:8px;padding:8px;display:grid;gap:6px}
  .decbox input{border:1px solid var(--line2);border-radius:6px;padding:6px 8px;font:inherit;font-size:13px;width:100%;background:#fff}
  .decbox .lchip{padding:2px 9px;font-size:12px}
  .decbox .lchip.cur{border-color:#16a34a;color:#15803d;font-weight:700}
  .decbox .lchip.on{background:#15803d;border-color:#15803d;color:#fff}
  .decbox .drow2{display:flex;align-items:center;gap:8px;justify-content:space-between}
  .cvdec{border-left:3px solid #86efac;padding:2px 0 2px 8px;font-size:13px;line-height:1.5}
  .cvdec .dh{display:flex;align-items:center;gap:6px}
  .cvdec .mx,.cvcm .mx{margin-left:auto;border:0;background:transparent;color:var(--fg3);font-size:11px;cursor:pointer}
  .cvcm{display:flex;gap:6px;align-items:baseline;font-size:13px;line-height:1.5}
  .cvcm b{white-space:nowrap}
  .cvcm .tx{flex:1;min-width:0;white-space:pre-wrap;word-break:break-word}
  .cvcm .at{font-size:11px;color:var(--fg3);white-space:nowrap}
  #cmIn{border:1px solid var(--line2);border-radius:6px;padding:6px 8px;font:inherit;font-size:13px;width:100%}
  #cmIn:focus,.decbox input:focus{border-color:var(--blue);outline:2px solid #bfdbfe}
  #cvExtra{display:flex;flex-direction:column;gap:8px}
  .declist{max-width:980px}
  .plan{max-width:980px}
  .plsum{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:10px;font-size:14px}
  .plsum .pbar{width:160px;height:8px;background:#eee;border-radius:4px;overflow:hidden;display:inline-block;vertical-align:middle}
  .plsum .pbar i{display:block;height:100%;background:#16a34a}
  .plrow{display:flex;gap:10px;align-items:center;padding:9px 8px;border-bottom:1px solid var(--line);cursor:pointer}
  .plrow:hover{background:#f8f8f8}
  .plrow input[type=checkbox]{width:18px;height:18px;flex:none;cursor:pointer;margin:0}
  .plrow .pd{flex:none;width:76px;font-size:13px;color:#616061;font-variant-numeric:tabular-nums}
  .plrow .pdd{flex:none;width:52px;font-size:12px;font-weight:700;color:#616061}
  .plrow .pdd.over{color:#dc2626}.plrow .pdd.soon{color:#d97706}
  .plrow .pt{flex:1;min-width:0;font-size:15px;word-break:break-word}
  .plrow .pt .ph{font-size:11px;color:#6b7280;border:1px solid var(--line2);border-radius:3px;padding:0 5px;margin-right:6px;font-weight:400}
  .plrow .pt .pn{display:block;font-size:12px;color:#6b7280;margin-top:1px}
  .plrow.done .pt{color:#9ca3af;text-decoration:line-through}
  .plrow.done .pd,.plrow.done .pdd{color:#c4c4c4}
  .plrow.over .pd{color:#dc2626;font-weight:700}
  .pladd{display:flex;gap:6px;align-items:center;padding:10px 8px;background:#fafafa;border:1px dashed var(--line2);border-radius:8px;margin-top:10px;flex-wrap:wrap}
  .pladd input,.pladd select{border:1px solid var(--line2);border-radius:6px;padding:7px 8px;font-size:14px;background:#fff}
  .pladd #plTitle{flex:1;min-width:180px}
  .plan.wide{max-width:none}
  .pboard{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(210px,1fr);gap:10px;overflow-x:auto;padding-bottom:6px;align-items:start}
  .pcol{background:#f6f6f4;border:1px solid var(--line);border-radius:10px;padding:8px;min-width:0}
  .pch{display:flex;justify-content:space-between;align-items:center;padding:2px 4px 8px;font-size:14px}
  .pc{display:flex;gap:8px;align-items:flex-start;background:#fff;border:1px solid var(--line);border-radius:8px;padding:8px;margin-bottom:6px;cursor:pointer}
  .pc:hover{border-color:var(--line2);box-shadow:0 1px 3px rgba(0,0,0,.06)}
  .pc .pck{flex:none;padding-top:1px}.pc .pck input{width:16px;height:16px;margin:0;cursor:pointer}
  .pc .pcb{flex:1;min-width:0}
  .pc .pct{font-size:13.5px;line-height:1.4;word-break:keep-all;overflow-wrap:anywhere}
  .pc .pcm{font-size:11.5px;color:#6b7280;margin-top:3px}
  .pc .pcm .r{color:#dc2626;font-weight:700}.pc .pcm .o{color:#d97706;font-weight:700}.pc .pcm .nd{color:#b0b0b0}
  .pc .pcn{font-size:11.5px;color:#6b7280;margin-top:2px}
  .pc.done .pct{color:#9ca3af;text-decoration:line-through}.pc.done{background:#ececec;border-color:#e0e0e0}
  .pc.prog{background:#e0efff;border-color:#bcd8fb}
  .plrow.prog{background:#e0efff}.plrow.done{background:#f1f1f1}
  .pc.over{border-color:#fca5a5}
  .pcadd{width:100%;box-sizing:border-box;border:1px dashed var(--line2);border-radius:8px;padding:7px 8px;font-size:13px;background:transparent}
  .pcadd:focus{background:#fff;border-style:solid;outline:none}
  .pc[draggable=true]{cursor:grab}
  .pc.dragging{opacity:.4}
  .pc.dropb{box-shadow:0 -3px 0 0 #2563eb}
  .pc.dropa{box-shadow:0 3px 0 0 #2563eb}
  .pcol.dropin{outline:2px dashed #2563eb;outline-offset:-2px}
  .dmon{font-size:13px;font-weight:700;color:var(--fg2);margin:16px 2px 6px;padding-bottom:4px;border-bottom:1px solid var(--line)}
  .dmon:first-child{margin-top:0}
  .drow{display:flex;gap:12px;align-items:flex-start;padding:10px 8px;border-bottom:1px solid var(--line)}
  .drow:hover{background:#f8f8f8}
  .drow .dd{flex:none;width:44px;font-size:13px;color:#616061;font-variant-numeric:tabular-nums;padding-top:2px}
  .drow .db{flex:1;min-width:0}
  .drow .dt{font-size:15px;line-height:1.5;word-break:break-word}
  .drow .dm{font-size:12px;color:var(--fg3);margin-top:3px}
  .drow .dlink{color:#1264a3;cursor:pointer}
  .drow .dlink:hover{text-decoration:underline}
  .qd{border:1px solid transparent;background:transparent;border-radius:999px;padding:1px 4px 1px 1px;display:inline-flex;align-items:center;gap:2px;cursor:pointer;font:inherit;flex:none}
  .qd:hover{border-color:var(--line2);background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.12)}
  .qd .ar{font-size:10px;color:#616061}
  .qdpick .lchip.on{background:#15803d;border-color:#15803d;color:#fff}
  .slch.slag{margin-bottom:4px;font-weight:700;color:#fff}
  .agp{max-width:900px;margin-bottom:18px}
  .agh{display:flex;align-items:baseline;gap:10px;margin:0 2px 6px;padding-bottom:4px;border-bottom:1px solid #e3e3e3}
  .agn{font-size:16px;font-weight:900;color:#1d1c1d;cursor:pointer}
  .agn:hover{color:#1264a3;text-decoration:underline}
  .agc{display:flex;align-items:flex-start;gap:12px;border:1px solid #ddd;border-left:4px solid #f59e0b;border-radius:10px;padding:10px 12px;margin-bottom:8px;cursor:pointer;background:#fff}
  .agc:hover{border-color:#1264a3;border-left-color:#f59e0b;background:#f8f8f8}
  .agc img{width:56px;height:56px;object-fit:cover;border-radius:6px;border:1px solid var(--line);flex:none}
  .agc .ic{font-size:34px;line-height:1;flex:none;width:56px;text-align:center}
  .agc .ai{flex:1;min-width:0;font-size:15px;line-height:1.45}
  .agc .ai .rv{background:#1d1c1d;color:#fff;border-radius:999px;padding:0 8px;font-size:11px;font-weight:600}
  .agc .am{font-size:12px;color:#616061}
  .agc .at{font-size:13px;color:#454245;margin-top:2px;white-space:pre-wrap;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
  .msg .lk{font-weight:900;color:#1264a3}
  .msg .mt a{color:inherit;text-decoration:none}
  .msg .mt a:hover{text-decoration:underline}
  .slch.unread{color:#fff;font-weight:900}
  .slch .pd{font-size:11px;color:#e8c9a0;white-space:nowrap}
  .tnew{display:flex;align-items:center;margin:8px 0 2px;position:relative;justify-content:flex-end}
  .tnew::before{content:"";position:absolute;left:0;right:0;top:50%;height:1px;background:#e01e5a}
  .tnew span{position:relative;background:#fff;color:#e01e5a;font-size:12px;font-weight:900;padding:0 8px;margin-right:16px}
  .cchip.unread{border-color:#e01e5a}
  .nw{background:#e01e5a;color:#fff;font-size:10px;font-weight:700;border-radius:4px;padding:0 5px;line-height:16px}
  .cvview .vpdf{flex:1;overflow:auto;background:#525659;text-align:center;-webkit-overflow-scrolling:touch}
  .cvview .vpdf canvas{display:block;margin:4px auto;background:#fff;max-width:100%}
  @media (max-width:820px){ .cvbar .lchip{max-width:150px} .cvbar .btn.sm{padding:3px 6px} .slh{padding:8px 10px 4px} .slt{padding:0 6px;overflow-x:auto} .sltab{white-space:nowrap;padding:7px 8px 8px} .slt .ago{display:none} .slpad{padding:10px} .agc{padding:8px 10px;gap:8px} .agc img,.agc .ic{width:44px;height:44px} .drow{gap:8px} .decbox input,#cmIn,.sl .talkbox textarea{font-size:16px} }
  .sl .msg .mx{visibility:hidden;margin-left:auto;border:1px solid #ddd;background:#fff;color:#616061;font-size:11px;border-radius:6px;padding:1px 7px;cursor:pointer;white-space:nowrap}
  .sl .msg:hover .mx{visibility:visible}
  .sl .msg .mx:hover{color:#e01e5a;border-color:#e01e5a}
  @media (hover:none){ .sl .msg .mx{visibility:visible;border:0;background:transparent;color:#aaa} }
  .mfile{display:inline-block;max-width:380px;margin-top:6px;border:1px solid #ddd;border-radius:10px;overflow:hidden;cursor:pointer;background:#fff;vertical-align:top}
  .mfile:hover{border-color:#1264a3}
  .mfile.unread{border-color:#e01e5a}
  .mfile img{display:block;max-width:100%;max-height:260px;margin:0 auto;background:#f4f4f4}
  .mfile .cap{display:flex;align-items:center;gap:8px;padding:6px 10px;border-top:1px solid #eee;font-size:13px}
  .mfile .cap b{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .mfile .cap span{color:#616061;font-size:12px;white-space:nowrap;margin-right:auto}
  .sl .talkbox .need{display:inline-flex;align-items:center;gap:5px;font-size:13px;cursor:pointer;white-space:nowrap;width:auto;font-weight:400;color:#454245;border:1px solid #ddd;border-radius:6px;padding:2px 8px}
  .sl .talkbox .need[hidden]{display:none}
  .psec{font-size:13px;font-weight:700;color:var(--fg2);margin:18px 2px 8px}
  .psec:first-of-type{margin-top:0}
  @media (max-width:900px){ .modal.xl{width:100vw;max-width:100vw;height:100vh;max-height:100vh;border-radius:0} .cv{grid-template-columns:1fr;grid-template-rows:minmax(50vh,1fr) auto;overflow:auto} .cvside{border-left:0;border-top:1px solid var(--line)} .ago{margin-left:0} }
</style>`);


/* ================= 런칭 일정 탭 (2026-10-16): 신제품 런칭 단계를 한 줄씩 쌓는 로그 =================
   저장: project_items 표(예전 프로세스 화면이 쓰던 표) { project_id, phase, title, assignee, due_date, status(예정/진행중/완료/보류), note, sort_order, done_at, updated_by(완료한 사람) }
   날짜순(날짜 없는 단계는 맨 아래, 그 안에서는 넣은 순서). 체크하면 완료 + 대화에도 한 줄 남음 */
/* 신제품 런칭 기본 단계 (2026-10-16 사장님 정리본). [분야, 단계, 메모] — 분야가 열이 됨 */
const PLAN_PHASES = ['기획/SCM', '제품 디자인', '홈페이지', '물류', '재무', 'CS', '마케팅'];
const PLAN_TEMPLATE = [
  ['기획/SCM', '제품명 / 상표 검토'], ['기획/SCM', 'BOM 처방 및 견적 확정'], ['기획/SCM', '표시사항 최종본 수령'], ['기획/SCM', '샘플 테스트 및 최종 발주'],
  ['제품 디자인', '제품 패키지 디자인 확정'], ['제품 디자인', '제품 원화 파일 제작'], ['제품 디자인', '제품 목업이미지 제작'],
  ['홈페이지', '제품 상세 페이지 세부 내용 기획'], ['홈페이지', '상세페이지 디자인 완료'], ['홈페이지', '제품페이지 오픈 및 설정 (자사몰, 쿠팡, 스마트스토어)'],
  ['물류', '제품 입고 확인'], ['물류', '이벗 상품 등록 및 API 연결'],
  ['재무', '다날 서비스 센터 가입'], ['재무', '네이버페이 신청'],
  ['CS', 'CS 채널 셋팅'], ['CS', '휴대폰 번호 개통, 아톡 셋팅'],
  ['마케팅', '블로그 리뷰 셋팅', '대가를 준 리뷰는 "협찬·광고" 표기'], ['마케팅', '쿠팡 리뷰 셋팅'], ['마케팅', '자사몰 리뷰 셋팅'],
];
const planDone = x => x.status === '완료';
const planOf = pid => (DATA.project_items || []).filter(x => x.project_id === pid)
  .sort((a, b) => (a.due_date ? 0 : 1) - (b.due_date ? 0 : 1) || String(a.due_date || '').localeCompare(String(b.due_date || '')) || (a.sort_order ?? 9999) - (b.sort_order ?? 9999) || String(a.created_at || '').localeCompare(String(b.created_at || '')));
const planDays = d => d ? Math.round((new Date(d + 'T00:00:00') - new Date(todayStr() + 'T00:00:00')) / 86400000) : null;
const planDow = d => d ? '일월화수목금토'[new Date(d + 'T00:00:00').getDay()] : '';
const planDD = n => n == null ? '' : n === 0 ? 'D-day' : n > 0 ? `D-${n}` : `D+${-n}`;
let planView = LS.get('plan_view') || 'board';   // board = 분야별 열, list = 날짜순 한 줄
/* 열 순서: 기본 분야 → 그 밖에 쓰인 분야 → 분야 없음 */
/* 열: 기본 분야 순서 → 그 밖에 쓰인 분야 → 분야 없음. 단계가 하나도 없는 분야는 열을 숨김(오른쪽 열이 당겨짐). all=true 면 숨긴 기본 분야도 포함(분야 고르는 목록용) */
const planCols = (list, all) => { const extra = [...new Set(list.map(x => x.phase || '').filter(ph => ph && !PLAN_PHASES.includes(ph)))];
  const cols = [...PLAN_PHASES, ...extra, ...(list.some(x => !x.phase) ? [''] : [])];
  return all ? cols : cols.filter(ph => list.some(x => (x.phase || '') === ph)); };
function planItemHtml(x, compact){
  const n = planDays(x.due_date), over = !planDone(x) && n != null && n < 0, soon = !planDone(x) && n != null && n >= 0 && n <= 3;
  if (compact) return `<div class="pc ${planDone(x) ? 'done' : x.status === '진행중' ? 'prog' : ''} ${over ? 'over' : ''}" data-pl="${x.id}" draggable="true" title="끌어서 순서·분야 바꾸기 · 누르면 고치기">
      <label class="pck"><input type="checkbox" data-plchk="${x.id}" ${planDone(x) ? 'checked' : ''}></label>
      <div class="pcb"><div class="pct">${esc(x.title)}</div>
        <div class="pcm">${x.due_date ? `<span class="${over ? 'r' : soon ? 'o' : ''}">${fmtDate(x.due_date).slice(5)}(${planDow(x.due_date)})${planDone(x) ? '' : ' ' + planDD(n)}</span>` : '<span class="nd">날짜 미정</span>'}${x.assignee ? ` · ${esc(fullName(x.assignee))}` : ''}</div>
        ${x.note ? `<div class="pcn">${esc(x.note)}</div>` : ''}</div></div>`;
  return `<div class="plrow ${planDone(x) ? 'done' : x.status === '진행중' ? 'prog' : ''} ${over ? 'over' : ''}" data-pl="${x.id}">
      <input type="checkbox" data-plchk="${x.id}" ${planDone(x) ? 'checked' : ''} title="${planDone(x) ? '완료 취소' : '완료로 표시'}">
      <span class="pd">${x.due_date ? `${fmtDate(x.due_date).slice(5)}(${planDow(x.due_date)})` : '날짜 미정'}</span>
      <span class="pdd ${over ? 'over' : soon ? 'soon' : ''}">${planDone(x) ? '완료' : planDD(n)}</span>
      <span class="pt">${x.phase ? `<span class="ph">${esc(x.phase)}</span>` : ''}${esc(x.title)}${x.note ? `<span class="pn">${esc(x.note)}</span>` : ''}</span>
      ${x.assignee ? who(x.assignee) : ''}</div>`;
}
function planHtml(p){
  const list = planOf(p.id), done = list.filter(planDone).length, next = list.find(x => !planDone(x));
  const missing = PLAN_TEMPLATE.filter(([, t]) => !list.some(x => x.title === t)).length;
  const head = `<div class="plsum">${list.length ? `<b>${list.length}단계 중 ${done} 완료</b><span class="pbar"><i style="width:${done / list.length * 100}%"></i></span>
      ${next ? `<span>다음: <b>${esc(next.title)}</b>${next.due_date ? ` <span class="hint">(${fmtDate(next.due_date).slice(5)}, ${planDD(planDays(next.due_date))})</span>` : ''}${next.assignee ? ' · ' + esc(fullName(next.assignee)) : ''}</span>` : '<span>🎉 모든 단계 완료</span>'}` : '<b>아직 런칭 일정이 없습니다</b>'}
      <span class="sp" style="flex:1"></span>
      ${missing ? `<button class="btn sm ${list.length ? '' : 'primary'}" id="plTpl" title="기본 단계 중 아직 없는 ${missing}개를 넣습니다">＋ 기본 단계 ${list.length ? '추가' : '넣기'} (${missing})</button>` : ''}
      <button class="btn sm" id="plView">${planView === 'board' ? '☰ 날짜순 보기' : '▦ 분야별 보기'}</button></div>`;
  if (planView === 'list') return `<div class="plan">${head}${list.map(x => planItemHtml(x)).join('') || '<div class="empty">단계가 없습니다.</div>'}
    <div class="pladd"><select id="plPhase"><option value="">분야</option>${planCols(list, true).filter(Boolean).map(ph => `<option>${esc(ph)}</option>`).join('')}</select><input type="date" id="plDate" title="예정일 (비워도 됨)"><input id="plTitle" placeholder="단계 — Enter 로 추가" maxlength="120"><select id="plWho"><option value="">담당</option>${memberOptions('')}</select><button class="btn primary" id="plAdd">추가</button></div>
    <div class="hint" style="margin-top:6px">줄을 누르면 고치기·삭제 · 체크하면 완료 (대화에도 한 줄 남음)</div></div>`;
  const cols = planCols(list);
  return `<div class="plan wide">${head}
    ${cols.length ? '' : '<div class="empty">아직 런칭 일정이 없습니다.<br>위의 <b>＋ 기본 단계 넣기</b>를 누르거나, <b>☰ 날짜순 보기</b>의 입력줄에서 단계를 추가하세요.</div>'}
    <div class="pboard">${cols.map(ph => { const its = list.filter(x => (x.phase || '') === ph).sort((a, b) => (a.sort_order ?? 9999) - (b.sort_order ?? 9999) || String(a.created_at || '').localeCompare(String(b.created_at || ''))), d = its.filter(planDone).length;   // 열 안은 기본 단계 순서(넣은 순서)
      return `<div class="pcol" data-plcol="${esc(ph)}"><div class="pch"><b>${esc(ph || '분야 없음')}</b><span class="hint">${its.length ? `${d}/${its.length}` : ''}</span></div>
        ${its.map(x => planItemHtml(x, true)).join('')}
        <input class="pcadd" data-plph="${esc(ph)}" placeholder="＋ 단계 추가 (Enter)" maxlength="120"></div>`; }).join('')}</div>
    <div class="hint" style="margin-top:6px">카드를 누르면 날짜·담당·메모를 넣거나 고칩니다 · 체크하면 완료 (대화에도 한 줄 남음) · 열 안은 기본 단계 순서 · 날짜순은 ☰ 날짜순 보기</div></div>`;
}
function bindPlan(p){
  const addItem = async (title, phase, due, who) => {
    const so = Math.max(-1, ...planOf(p.id).map(x => x.sort_order ?? -1)) + 1;
    await saveRow('project_items', { id: uid(), project_id: p.id, phase: phase || null, title, assignee: who || null, start_date: null, due_date: due || null, status: '예정', note: null, checklist: [], sort_order: so, created_by: me, created_at: nowIso() });
  };
  const tpl = $('#plTpl'); if (tpl) tpl.onclick = async () => {
    const list = planOf(p.id), add = PLAN_TEMPLATE.filter(([, t]) => !list.some(x => x.title === t));
    if (!add.length || !confirm(`기본 단계 ${add.length}개를 넣을까요? (이미 있는 단계는 건너뜁니다)\n날짜·담당은 넣은 뒤 카드를 눌러 채우면 됩니다.`)) return;
    const base = Math.max(-1, ...list.map(x => x.sort_order ?? -1)) + 1;
    for (let k = 0; k < add.length; k++) { const [phase, title, note] = add[k];
      await saveRow('project_items', { id: uid(), project_id: p.id, phase, title, assignee: null, start_date: null, due_date: null, status: '예정', note: note || null, checklist: [], sort_order: base + PLAN_TEMPLATE.findIndex(t => t[1] === title), created_by: me, created_at: nowIso() }); }
    toast(`기본 단계 ${add.length}개를 넣었습니다`);
  };
  const pv = $('#plView'); if (pv) pv.onclick = () => { planView = planView === 'board' ? 'list' : 'board'; LS.set('plan_view', planView); render(); };
  const ab = $('#plAdd'); if (ab) {
    const add = async () => { const title = $('#plTitle').value.trim(); if (!title) { $('#plTitle').focus(); return; }
      const v = [$('#plPhase').value, $('#plDate').value, $('#plWho').value]; await addItem(title, ...v); toast('추가했습니다'); const t = $('#plTitle'); if (t) t.focus(); };
    ab.onclick = add; $('#plTitle').onkeydown = e => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); add(); } };
  }
  document.querySelectorAll('.pcadd').forEach(inp => inp.onkeydown = async e => {
    if (e.key !== 'Enter' || e.isComposing) return; e.preventDefault();
    const title = inp.value.trim(), ph = inp.dataset.plph; if (!title) return;
    inp.value = ''; await addItem(title, ph); toast(`${ph || '분야 없음'}에 추가했습니다`);
    const again = document.querySelector(`.pcadd[data-plph="${CSS.escape(ph)}"]`); if (again) again.focus();
  });
  document.querySelectorAll('[data-plchk]').forEach(cb => { cb.onclick = e => e.stopPropagation(); cb.onchange = async () => {
    const x = (DATA.project_items || []).find(y => y.id === cb.dataset.plchk); if (!x) return;
    await saveRow('project_items', cb.checked ? { ...x, status: '완료', done_at: nowIso(), updated_by: me } : { ...x, status: '예정', done_at: null, updated_by: me });
    toast(cb.checked ? `"${x.title}" 완료` : '완료를 취소했습니다'); }; });
  document.querySelectorAll('.pck').forEach(l => l.onclick = e => e.stopPropagation());
  document.querySelectorAll('[data-pl]').forEach(r => r.onclick = () => openPlanItem(p, r.dataset.pl));
  /* 카드 끌어서 순서 바꾸기: 카드 위쪽 절반에 놓으면 그 앞, 아래쪽 절반이면 그 뒤. 다른 열에 놓으면 그 분야로 옮김 */
  let dragId = null;
  const clear = () => document.querySelectorAll('.pc.dropb, .pc.dropa, .pcol.dropin').forEach(el => el.classList.remove('dropb', 'dropa', 'dropin'));
  document.querySelectorAll('.pc[draggable=true]').forEach(c => {
    c.ondragstart = e => { dragId = c.dataset.pl; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', dragId); setTimeout(() => c.classList.add('dragging'), 0); };
    c.ondragend = () => { dragId = null; c.classList.remove('dragging'); clear(); };
    c.ondragover = e => { if (!dragId || dragId === c.dataset.pl) return; e.preventDefault(); e.stopPropagation(); const r = c.getBoundingClientRect(); clear(); c.classList.add(e.clientY > r.top + r.height / 2 ? 'dropa' : 'dropb'); };
  });
  document.querySelectorAll('.pcol[data-plcol]').forEach(col => {
    col.ondragover = e => { if (!dragId) return; e.preventDefault(); if (!e.target.closest('.pc')) { clear(); col.classList.add('dropin'); } };
    col.ondragleave = e => { if (!col.contains(e.relatedTarget)) col.classList.remove('dropin'); };
    col.ondrop = async e => {
      if (!dragId) return; e.preventDefault();
      const id = dragId, ph = col.dataset.plcol, onCard = e.target.closest('.pc'); dragId = null;
      const after = onCard ? e.clientY > onCard.getBoundingClientRect().top + onCard.getBoundingClientRect().height / 2 : true;
      clear();
      const ids = [...col.querySelectorAll('.pc')].map(el => el.dataset.pl).filter(x => x !== id);
      let at = onCard && onCard.dataset.pl !== id ? ids.indexOf(onCard.dataset.pl) + (after ? 1 : 0) : ids.length;
      ids.splice(at, 0, id);
      const all = DATA.project_items || [], changed = [];
      ids.forEach((iid, k) => { const x = all.find(y => y.id === iid); if (!x) return; const nph = ph || null;
        if (x.sort_order !== k || (x.phase || null) !== nph) changed.push({ ...x, sort_order: k, phase: nph, updated_by: x.updated_by || me }); });
      for (const row of changed) await saveRow('project_items', row);
      const moved = all.find(y => y.id === id); if (moved && changed.some(r => r.id === id && (r.phase || '') !== (moved.phase || ''))) toast(`"${moved.title}" → ${ph || '분야 없음'}`);
    };
  });
}
function openPlanItem(p, id){
  const x = (DATA.project_items || []).find(y => y.id === id); if (!x) return;
  openModal(`${modalHead('런칭 일정 단계')}<div class="mb">
      <div class="f"><label>단계 *</label><input id="piTitle" value="${esc(x.title)}" maxlength="120"></div>
      <div class="f2"><div class="f"><label>분야 <span class="hint">(열 이름)</span></label><input id="piPhase" value="${esc(x.phase || '')}" maxlength="20" list="piPhases"><datalist id="piPhases">${planCols(planOf(p.id), true).filter(Boolean).map(ph => `<option value="${esc(ph)}">`).join('')}</datalist></div>
        <div class="f"><label>담당</label><select id="piWho"><option value="">미정</option>${memberOptions(x.assignee || '')}</select></div></div>
      <div class="f2"><div class="f"><label>예정일</label><input type="date" id="piDate" value="${esc(x.due_date || '')}"></div>
        <div class="f"><label>상태</label><select id="piSt">${['예정', '진행중', '완료', '보류'].map(v => `<option ${x.status === v ? 'selected' : ''}>${v}</option>`).join('')}</select></div></div>
      <div class="f"><label>메모 <span class="hint">(선택)</span></label><input id="piNote" value="${esc(x.note || '')}" maxlength="300"></div>
      ${x.done_at ? `<div class="hint">완료: ${esc(x.updated_by || '')} ${fmtDateTime(x.done_at)}</div>` : ''}
    </div><div class="mf"><button class="btn danger left" id="piDel">삭제</button><button class="btn" data-close>취소</button><button class="btn primary" id="piSave">저장</button></div>`);
  $('#piTitle').focus();
  ['#piTitle', '#piPhase', '#piNote'].forEach(q => { $(q).onkeydown = e => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); $('#piSave').click(); } }; });
  $('#piSave').onclick = async () => { const title = $('#piTitle').value.trim(); if (!title) { $('#piTitle').focus(); toast('단계 이름을 적어 주세요', true); return; }
    const st = $('#piSt').value;   // 창을 닫기 전에 입력값을 모두 읽어 둠 (닫은 뒤에는 칸이 없어짐)
    const row = { ...x, title, phase: $('#piPhase').value.trim() || null, assignee: $('#piWho').value || null, due_date: $('#piDate').value || null, status: st, note: $('#piNote').value.trim() || null,
      done_at: st === '완료' ? (x.done_at || nowIso()) : null, updated_by: me };
    closeModal(); await saveRow('project_items', row); toast('저장했습니다'); };
  $('#piDel').onclick = async () => { if (confirm(`"${x.title}" 단계를 지울까요?`)) { closeModal(); await removeRow('project_items', x.id); toast('지웠습니다'); } };
}
/* 완료한 단계는 대화에도 한 줄 */
const _talkExtraPlan = talkExtraEvents;
talkExtraEvents = function(p, ev){
  _talkExtraPlan(p, ev);
  (DATA.project_items || []).filter(x => x.project_id === p.id && planDone(x) && x.done_at).forEach(x =>
    ev.push({ at: x.done_at, by: x.updated_by || x.created_by, type: 'plan', html: `<div class="mt"><span class="lk">🗓 런칭 일정</span> <b>${esc(x.title)}</b> 완료${x.due_date ? ` <span class="hint">(예정 ${fmtDate(x.due_date).slice(5)})</span>` : ''}</div>` }));
};
