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
const stCard = s => tag(s, ...(CARD_ST[s] || CARD_ST['참고 자료']), true);
const isPdf = f => /pdf$/i.test(f.type || '') || /\.pdf$/i.test(f.name || '');
const fmtSize = n => n > 1048576 ? (n / 1048576).toFixed(1) + 'MB' : Math.max(1, Math.round((n || 0) / 1024)) + 'KB';
let cardFilter = '', cardQ = '';          // 자료 카드 탭: 고른 상태, 검색어
let CV = null;                            // 열어 둔 카드 보기 창 { id, rev(차수), file(몇 번째 파일) }

/* ---------- 채널 머리: 리더 · 참여 팀원 · 마지막 기록 · NAS 경로 · 고정 요약 ---------- */
function chHeadHtml(p){
  const mem = (Array.isArray(p.members) ? p.members : []).filter(n => n !== p.owner);
  return `<div class="chinfo">
    <div class="chrow"><span class="lb">리더</span>${p.owner ? who(p.owner) : '<span class="hint">미정</span>'}
      ${mem.length ? `<span class="lb">참여</span>${mem.map(n => who(n)).join('')}` : ''}${agoHtml(p.id)}</div>
    ${p.nas_path ? `<div class="chrow nas"><span class="lb">📁 NAS</span><code id="nasPath">${esc(p.nas_path)}</code><button class="btn sm" id="nasCopy">복사</button><span class="hint">탐색기 주소창에 붙여넣으면 열립니다</span></div>` : ''}
    <div class="pin"><div class="ph">📌 현재 상태 · 다음 할 일<span class="by">${p.summary_at ? esc(p.summary_by || '') + ' · ' + fmtDateTime(p.summary_at).slice(5) + ' 수정' : ''}</span><button class="btn sm" id="sumEdit">${p.summary ? '수정' : '적기'}</button></div>
      <div class="pt ${p.summary ? '' : 'ph0'}">${p.summary ? linkify(p.summary) : '지금 어디까지 왔고 다음에 무엇을 할지 리더가 짧게 적어 두는 곳입니다. 몇 주 뒤에 열어도 여기만 보면 따라잡을 수 있게.'}</div></div>
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

/* ---------- 자료 카드 탭 ---------- */
function cardsHtml(p){
  if (!DATA.project_cards) return `<div class="empty">자료 카드 저장 표가 아직 없습니다.${isAdmin() ? ' <b>sql-project-channel.sql</b> 을 Supabase SQL Editor 에서 실행하세요.' : ''}</div>`;
  const all = cardsOf(p.id);
  return `<div class="actions"><button class="btn primary" id="newCard" style="padding:9px 16px;font-size:14px">＋ 자료 카드 올리기</button>
      <div class="lchips" style="margin:0"><button class="lchip ${cardFilter ? '' : 'on'}" data-cf="">전체<span class="n">${all.length}</span></button>${CARD_STATUSES.map(s => `<button class="lchip ${cardFilter === s ? 'on' : ''}" data-cf="${s}">${s}<span class="n">${all.filter(c => c.status === s).length}</span></button>`).join('')}
      <input type="search" id="cardQ" placeholder="검색 (제목, 메모, 파일 이름)" value="${esc(cardQ)}"></div></div>
    <div id="cardList">${cardListHtml(p)}</div>`;
}
function cardListHtml(p){
  const s = cardQ.trim().toLowerCase();
  const list = cardsOf(p.id).filter(c => (!cardFilter || c.status === cardFilter) && (!s || [c.title, c.memo, c.kind, c.created_by, ...revsOf(c).flatMap(r => (r.files || []).map(f => f.name))].some(v => (v || '').toLowerCase().includes(s))));
  if (!list.length) return `<div class="empty">${s || cardFilter ? '해당하는 자료 카드가 없습니다.' : '아직 올린 자료가 없습니다.<br>제안서·기획서·견적서 같은 자료 하나를 <b>＋ 자료 카드 올리기</b>로 올려 보세요. 결정이 필요한 자료는 <b>결정 대기</b>로 올라갑니다.'}</div>`;
  return `<div class="cgrid">${list.map(c => {
    const fs = cardFiles(c), img = fs.find(isImg), n = revsOf(c).length;
    return `<div class="ccard st-${c.status.replace(/\s/g, '')}" data-card="${c.id}">
      <div class="ct">${stCard(c.status)}<span class="kd">${esc(c.kind || '기타')}</span>${n > 1 ? `<span class="rv">${n}차</span>` : ''}</div>
      <h3>${esc(c.title)}</h3>
      ${c.memo ? `<div class="cm2">${esc(c.memo)}</div>` : ''}
      <div class="thumb">${img ? `<img src="${esc(img.url)}" alt="" loading="lazy">` : fs.length ? `<span class="doc">${isPdf(fs[0]) ? '📕' : '📄'}</span>` : '<span class="doc none">첨부 없음</span>'}${fs.length ? `<span class="fn">${esc(fs[0].name)}${fs.length > 1 ? ` 외 ${fs.length - 1}개` : ''}</span>` : ''}</div>
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
function bindCardList(p){ document.querySelectorAll('[data-card]').forEach(el => el.onclick = () => openCard(el.dataset.card)); }

/* ---------- 카드 올리기 · 수정 ---------- */
function openCardEdit(p, id){
  const c = id ? CARDS().find(x => x.id === id) : null;
  let kind = c ? c.kind : '제안서', status = c ? c.status : '결정 대기';
  const at = attachBox('kFiles', c ? cardFiles(c) : [], 'projects', { rename: true });
  openModal(`${modalHead(c ? '자료 카드 수정' : `자료 카드 올리기 — ${esc(p.name)}`)}
    <div class="mb">
      <div class="f"><label>제목 *</label><input id="kTitle" value="${esc(c ? c.title : '')}" maxlength="120" placeholder="예: 브랜드명 후보안, A제조사 견적서, 손익 시뮬레이션"></div>
      <div class="f"><label>자료 종류</label><div class="kpick">${CARD_KINDS.map(k => `<button type="button" class="lchip" data-kk="${k}">${k}</button>`).join('')}</div></div>
      <div class="f"><label>한마디 메모</label><textarea id="kMemo" maxlength="2000" style="min-height:70px" placeholder="이 자료를 볼 때 알아야 할 것. 예: 단가는 부가세 별도, 최소 수량 3천 개 기준">${esc(c ? c.memo || '' : '')}</textarea></div>
      <div class="f"><label>첨부 파일 ${c ? `(${lastRev(c).no}차)` : ''} — PDF·이미지는 화면에서 바로 보입니다. 파일 하나 50MB 까지</label>${at.html}</div>
      ${c ? '' : `<div class="f"><label>결정이 필요한 자료인가요?</label><div class="kpick"><button type="button" class="lchip" data-ks="결정 대기">결정 대기 (회의 안건에 올라감)</button><button type="button" class="lchip" data-ks="참고 자료">참고 자료 (결정 필요 없음)</button></div></div>`}
    </div>
    <div class="mf">${c && (c.created_by === me || isAdmin()) ? '<button class="btn danger left" id="kDel">카드 삭제</button>' : ''}<button class="btn" data-close>취소</button><button class="btn primary" id="kSave">${c ? '저장' : '올리기'}</button></div>`, { wide: true });
  const paint = () => { document.querySelectorAll('[data-kk]').forEach(b => b.classList.toggle('on', b.dataset.kk === kind)); document.querySelectorAll('[data-ks]').forEach(b => b.classList.toggle('on', b.dataset.ks === status)); };
  document.querySelectorAll('[data-kk]').forEach(b => b.onclick = () => { kind = b.dataset.kk; paint(); });
  document.querySelectorAll('[data-ks]').forEach(b => b.onclick = () => { status = b.dataset.ks; paint(); });
  paint(); at.bind(); $('#kTitle').focus();
  $('#kSave').onclick = async () => {
    if ($('#kFiles .up')) { toast('파일을 올리는 중입니다. 잠시만 기다려 주세요', true); return; }
    const title = $('#kTitle').value.trim(); if (!title) { $('#kTitle').focus(); toast('제목을 입력하세요', true); return; }
    const memo = $('#kMemo').value.trim() || null;
    let row;
    if (c) { const rs = revsOf(c).map((r, i, arr) => i === arr.length - 1 ? { ...r, files: [...at.files] } : r); row = { ...c, title, kind, memo, revisions: rs.length ? rs : [{ no: 1, memo: '', files: [...at.files], by: me, at: nowIso() }], updated_by: me }; }
    else row = { id: uid(), project_id: p.id, title, kind, memo, status, revisions: [{ no: 1, memo: '', files: [...at.files], by: me, at: nowIso() }], comments: [], created_by: me, created_at: nowIso(), updated_by: me };
    closeModal(); await saveRow('project_cards', row); toast(c ? '저장했습니다' : '자료 카드를 올렸습니다');
    if (c) openCard(c.id);
  };
  const del = $('#kDel'); if (del) del.onclick = async () => {
    if (!confirm(`"${c.title}" 카드를 삭제할까요?\n수정본 ${revsOf(c).length}개와 댓글 ${(c.comments || []).length}개도 함께 지워집니다.`)) return;
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
      ${c.status !== '참고 자료' && c.status !== '결정 대기' ? `<div class="hint">지금 상태는 <b>${esc(c.status)}</b>입니다. 수정본을 올리면 다시 <b>결정 대기</b>로 바뀌어 회의 안건에 올라갑니다.</div>` : ''}</div>
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
  const view = !f ? '<div class="vnone">첨부 파일이 없는 카드입니다.</div>'
    : isPdf(f) ? `<iframe src="${esc(f.url)}#view=FitH" title="${esc(f.name)}"></iframe>`
    : isImg(f) ? `<div class="vimg"><img src="${esc(f.url)}" alt="${esc(f.name)}"></div>`
    : `<div class="vnone">이 파일은 화면에서 바로 볼 수 없는 형식입니다.<br><a class="btn" href="${esc(f.url)}?download=${encodeURIComponent(f.name)}">${esc(f.name)} 내려받기</a></div>`;
  openModal(`${modalHead(`${stCard(c.status)} ${esc(c.title)}`)}
    <div class="cv">
      <div class="cvmain" id="cvMain">
        <div class="cvbar">${rs.length > 1 ? `<span class="rvs">${rs.map(x => `<button class="lchip ${x.no === r.no ? 'on' : ''}" data-rev="${x.no}" title="${esc(x.by || '')} · ${fmtDateTime(x.at)}">${x.no}차</button>`).join('')}</span>` : ''}
          <span class="fls">${fs.map((x, i) => `<button class="lchip ${i === fi ? 'on' : ''}" data-fi="${i}" title="${esc(x.name)}">${isPdf(x) ? '📕' : isImg(x) ? '🖼' : '📄'} ${esc(x.name)}</button>`).join('')}</span>
          <span class="sp"></span>${f ? `<a class="btn sm" href="${esc(f.url)}" target="_blank" rel="noopener">새 창</a><a class="btn sm" href="${esc(f.url)}?download=${encodeURIComponent(f.name)}">내려받기</a><button class="btn sm primary" id="cvFull" title="회의 때 큰 화면에 띄우기 (Esc 로 돌아옴)">⛶ 큰 화면</button>` : ''}</div>
        <div class="cvview">${view}</div>
      </div>
      <aside class="cvside">
        <div class="cvmeta">${tag(c.kind || '기타', '#f1f5f9', '#334155')} <span class="hint">${esc(p.name || '')}</span></div>
        <div class="cvby">${who(c.created_by)}<span class="hint">${fmtDateTime(c.created_at)} 올림</span></div>
        ${c.memo ? `<div class="cvmemo">${linkify(c.memo)}</div>` : ''}
        <div class="cvsec">수정본 ${rs.length > 1 ? `(${rs.length}차까지)` : ''}</div>
        ${rs.slice().reverse().map(x => `<div class="cvrev ${x.no === r.no ? 'on' : ''}" data-rev="${x.no}"><b>${x.no}차</b> <span class="hint">${esc(x.by || '')} · ${fmtDateTime(x.at).slice(5)} · 파일 ${(x.files || []).length}개</span>${x.memo ? `<div class="rm">${esc(x.memo)}</div>` : ''}</div>`).join('')}
        <button class="btn sm" id="cvRev">＋ ${rs.length + 1}차 수정본 올리기</button>
        <div id="cvExtra">${typeof cardExtraHtml === 'function' ? cardExtraHtml(c) : ''}</div>
        <div class="cvfoot"><button class="btn sm" id="cvEdit">카드 수정</button></div>
      </aside>
    </div>`, { wide: true });
  const m = document.querySelector('#modal .modal'); m.classList.add('xl');
  document.querySelectorAll('#modal [data-rev]').forEach(b => b.onclick = () => openCard(id, Number(b.dataset.rev), 0));
  document.querySelectorAll('#modal [data-fi]').forEach(b => b.onclick = () => openCard(id, r.no, Number(b.dataset.fi)));
  const full = $('#cvFull'); if (full) full.onclick = () => { const el = $('#cvMain'); (el.requestFullscreen || el.webkitRequestFullscreen || (() => {})).call(el); };
  $('#cvRev').onclick = () => openRevAdd(id);
  $('#cvEdit').onclick = () => openCardEdit(p, id);
  document.querySelectorAll('#modal [data-close]').forEach(b => b.addEventListener('click', () => { CV = null; }));
  if (typeof bindCardExtra === 'function') bindCardExtra(c);
}

/* ---------- 채널 화면에 쓰는 모양 ---------- */
document.head.insertAdjacentHTML('beforeend', `<style>
  .chinfo{border:1px solid var(--line);border-radius:10px;background:var(--bg);padding:10px 14px;margin:-2px 0 14px;display:grid;gap:8px;max-width:1200px}
  .chrow{display:flex;align-items:center;gap:6px;flex-wrap:wrap;font-size:13px}
  .chrow .lb{font-size:12px;color:var(--fg3);margin-right:2px}
  .chrow .lb:not(:first-child){margin-left:10px}
  .ago{margin-left:auto;font-size:12px;color:var(--fg2);background:var(--bg2);border-radius:999px;padding:2px 10px;white-space:nowrap}
  .ago.old{background:#fee2e2;color:#b91c1c;font-weight:600}
  .ago.none{color:var(--fg3)}
  .chrow.nas code{font-family:Consolas,"Malgun Gothic",monospace;font-size:12px;background:var(--bg2);border:1px solid var(--line);border-radius:4px;padding:2px 8px;word-break:break-all}
  .pin{border:1px solid #fde68a;background:#fffbea;border-radius:8px;padding:8px 12px}
  .pin .ph{display:flex;align-items:center;gap:8px;font-size:12px;font-weight:700;color:#92400e;margin-bottom:4px}
  .pin .ph .by{font-weight:400;color:var(--fg3);margin-left:auto}
  .pin .pt{white-space:pre-wrap;word-break:break-word;line-height:1.6;font-size:14px}
  .pin .pt.ph0{color:var(--fg3);font-size:13px}
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
  .psec{font-size:13px;font-weight:700;color:var(--fg2);margin:18px 2px 8px}
  .psec:first-of-type{margin-top:0}
  @media (max-width:900px){ .modal.xl{width:100vw;max-width:100vw;height:100vh;max-height:100vh;border-radius:0} .cv{grid-template-columns:1fr;grid-template-rows:minmax(50vh,1fr) auto;overflow:auto} .cvside{border-left:0;border-top:1px solid var(--line)} .ago{margin-left:0} }
</style>`);
