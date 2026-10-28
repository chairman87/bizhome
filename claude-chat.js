/* ================================================================
   🤖 클로드 대화 창 (2026-10-28) — 인트라넷 어느 화면에서든 오른쪽 위 "🤖 클로드" 단추(관리자만)로 띄움.
   "업무 화면에 마감일 지난 건 빨간색으로", "재고 관리 화면 새로 만들어 줘"처럼 말하면 lemon803 의 클로드(chat_worker.py)가
   인트라넷 파일을 고치고, 관리자 대화는 바로 반영(1~2분 뒤 phb.kr)됩니다. 표: routine_chats / routine_chat_messages (대상 '인트라넷').
   자동작업 화면(routines.html)의 대화 탭과 같은 표를 쓰므로 거기서도 같은 대화가 보입니다.
   common.js 의 headerHtml 이 단추를 그리고, 누르면 이 파일을 그때 불러 ClaudeChat.open() 을 부릅니다.
================================================================ */
window.ClaudeChat = (() => {
  const TARGET = '인트라넷';
  const CS = { 반영대기: ['#ffedd5', '#9a3412'], 반영완료: ['#dcfce7', '#15803d'], 닫힘: ['#f3f4f6', '#4b5563'] };
  const csTag = s => s && s !== '열림' ? tag(s, ...(CS[s] || ['#f3f4f6', '#4b5563'])) : '';
  let chat = null, MSGS = [], draft = '', ch = null, poll = null, loading = false;
  const rel = iso => { if (!iso) return ''; const m = Math.round((Date.now() - new Date(iso)) / 60000); if (m < 1) return '방금'; if (m < 60) return `${m}분 전`; if (m < 48 * 60) return `${Math.round(m / 60)}시간 전`; return `${Math.round(m / 1440)}일 전`; };
  const pending = () => MSGS.some(m => m.role === 'user' && ['대기', '처리중'].includes(m.status));
  const isOpen = () => !!$('#ccModal');
  const pageName = () => { const t = (document.querySelector('.brand.page') || {}).textContent || document.title || ''; return `${t.trim()} (${location.pathname.split('/').pop() || 'index.html'})`; };

  function css(){
    if ($('#ccStyle')) return;
    const s = document.createElement('style'); s.id = 'ccStyle';
    s.textContent = `
      .ccpane{display:flex;flex-direction:column;min-height:60vh}
      .cchead{padding:0 0 10px;border-bottom:1px solid var(--line);display:flex;gap:8px;align-items:center;flex-wrap:wrap}
      .cchead .t{font-weight:600;flex:1;min-width:120px}
      .ccthread{flex:1;overflow:auto;padding:14px 2px;display:flex;flex-direction:column;gap:10px;max-height:60vh}
      .ccb{max-width:80%;padding:9px 12px;border-radius:12px;font-size:14px;line-height:1.65;white-space:pre-wrap;word-break:break-word}
      .ccb.user{align-self:flex-end;background:#dbeafe;color:#1e3a8a;border-bottom-right-radius:3px}
      .ccb.claude{align-self:flex-start;background:var(--bg2);border:1px solid var(--line);border-bottom-left-radius:3px}
      .ccb.system{align-self:center;background:transparent;color:var(--fg3);font-size:12.5px;text-align:center;max-width:92%}
      .ccb.wait{align-self:flex-start;background:transparent;color:var(--fg3);font-size:13px}
      .ccb .meta{font-size:11px;color:var(--fg3);margin-top:4px}
      .ccb .files{font-size:11.5px;color:var(--fg2);margin-top:5px}
      .cccomp{border-top:1px solid var(--line);padding:10px 0 0;display:flex;gap:8px;align-items:flex-end}
      .cccomp textarea{flex:1;min-height:46px;max-height:180px;resize:vertical}`;
    document.head.appendChild(s);
  }
  async function loadChat(){
    if (!store.client) return;
    const { data } = await store.client.from('routine_chats').select('*').eq('target', TARGET).eq('author', me).neq('status', '닫힘').order('last_message_at', { ascending: false }).limit(1);
    chat = (data && data[0]) ? { ...data[0], changed_files: Array.isArray(data[0].changed_files) ? data[0].changed_files : [] } : null;
    if (chat) { const { data: ms } = await store.client.from('routine_chat_messages').select('*').eq('chat_id', chat.id).order('created_at'); MSGS = (ms || []).map(m => ({ ...m, changed_files: Array.isArray(m.changed_files) ? m.changed_files : [] })); }
    else MSGS = [];
  }
  function watch(){
    if (ch) { try { store.client.removeChannel(ch); } catch (e) {} ch = null; }
    clearInterval(poll); poll = null;
    if (!store.client || !chat) return;
    const id = chat.id;
    ch = store.client.channel('cc-' + id).on('postgres_changes', { event: '*', schema: 'public', table: 'routine_chat_messages', filter: 'chat_id=eq.' + id }, () => refresh()).subscribe();
    poll = setInterval(() => { if (document.visibilityState === 'visible' && isOpen() && pending()) refresh(); }, 8000);
  }
  async function refresh(){ if (!isOpen()) return; await loadChat(); paint(); }

  function html(){
    const bubbles = MSGS.map(m => {
      if (m.role === 'user') return `<div class="ccb user">${esc(m.text || '')}<div class="meta" style="text-align:right">${esc(m.author || '')} · ${fmtDateTime(m.created_at).slice(5)}${m.status === '실패' ? ' · <span style="color:var(--red)">답 못 받음</span>' : m.status === '처리중' ? ' · 클로드가 보는 중' : m.status === '대기' ? ' · 기다리는 중' : ''}</div></div>`;
      if (m.role === 'claude') return `<div class="ccb claude">${esc(m.text || '')}${m.changed_files.length ? `<div class="files">✏ 고친 파일: ${m.changed_files.map(esc).join(', ')}</div>` : ''}<div class="meta">클로드 · ${fmtDateTime(m.created_at).slice(5)}</div></div>`;
      return `<div class="ccb system">${esc(m.text || '')}</div>`;
    }).join('');
    const closed = chat && chat.status === '닫힘';
    return `<div class="ccpane">
      <div class="cchead"><span class="t">인트라넷 화면 만들기·고치기</span>${chat ? csTag(chat.status) : ''}${chat ? `<span class="hint">${rel(chat.last_message_at || chat.created_at)}${chat.commits ? ` · ${chat.commits}번 고침` : ''}</span>` : ''}
        ${chat && chat.status === '반영대기' && chat.request_id ? `<a class="btn sm" href="routines.html?open=${chat.request_id}">반영 요청 보기</a>` : ''}
        ${chat ? '<button class="btn sm" id="ccNew" title="이 대화를 닫고 다음부터 새로 시작">대화 새로 시작</button>' : ''}
        <a class="btn sm" href="routines.html" title="자동작업 화면의 대화 탭에서 전체 목록">전체 대화</a></div>
      <div class="ccthread" id="ccThread">${bubbles || `<div class="hint">예) "업무 화면의 받은 업무 탭에서 마감일 지난 건 제목을 빨간색으로 보여 줘"<br>예) "재고 관리 화면을 새로 만들어 줘. 품목·수량·입고일을 적고 수량이 10 아래면 노란색으로"<br>예) "회의록 화면은 지금 어떻게 되어 있어?"<br><br>lemon803 의 클로드가 30초~2분 안에 답합니다. 고치라고 한 것은 바로 반영되고 1~2분 뒤 phb.kr 에 보입니다. 새 화면을 만들었으면 홈 > 메뉴 편집에서 메뉴에 넣어 주세요.</div>`}${pending() ? '<div class="ccb wait">⏳ 클로드가 보고 있습니다… (보통 30초~2분. lemon803 이 꺼져 있으면 켜질 때까지 기다립니다)</div>' : ''}</div>
      ${closed ? '' : `<div class="cccomp"><textarea id="ccText" placeholder="${chat && chat.status === '반영대기' ? '반영 요청이 처리된 뒤에 답합니다.' : '무엇을 만들거나 고칠까요? (Ctrl+Enter 보내기)'}">${esc(draft)}</textarea><button class="btn primary" id="ccSend">보내기</button></div>
      <div class="hint" style="padding-top:6px">지금 보고 있는 화면(${esc(pageName())})을 첫 메시지에 같이 알려 줍니다. 고치라고 한 것은 바로 반영됩니다.</div>`}
    </div>`;
  }
  function paint(){
    const box = $('#ccModal'); if (!box) return;
    const ta = $('#ccText'), focused = ta && document.activeElement === ta;
    box.innerHTML = html(); bind();
    if (focused) { const t2 = $('#ccText'); if (t2) { t2.focus(); t2.selectionStart = t2.selectionEnd = t2.value.length; } }
  }
  function bind(){
    const on = (sel, fn) => { const el = $(sel); if (el) el.onclick = fn; };
    on('#ccSend', send); on('#ccNew', renew);
    const ta = $('#ccText'); if (ta) { ta.oninput = () => { draft = ta.value; }; ta.onkeydown = e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); send(); } }; }
    const th = $('#ccThread'); if (th) th.scrollTop = th.scrollHeight;
  }
  async function send(){
    const ta = $('#ccText'); if (!ta) return;
    let text = ta.value.trim(); if (!text) return;
    if (!store.client) { toast('저장소에 연결돼 있지 않아 보낼 수 없습니다', true); return; }
    const now = nowIso();
    if (!chat) {
      text = `(지금 보고 있는 화면: ${pageName()})\n${text}`;
      chat = { id: uid(), target: TARGET, target_label: '인트라넷', title: ta.value.trim().split('\n')[0].slice(0, 60), author: me, status: '열림', changed_files: [], commits: 0, last_message_at: now, created_at: now, updated_at: now };
      const { error } = await store.client.from('routine_chats').upsert(chat);
      if (error) { toast('대화 만들기 실패: ' + error.message, true); chat = null; return; }
      watch();
    }
    const row = { id: uid(), chat_id: chat.id, role: 'user', author: me, text, status: '대기', created_at: now };
    draft = ''; MSGS.push(row); paint();
    const { error } = await store.client.from('routine_chat_messages').insert(row);
    if (error) { toast('보내기 실패: ' + error.message, true); MSGS = MSGS.filter(m => m.id !== row.id); draft = text; paint(); return; }
    await store.client.from('routine_chats').update({ last_message_at: now, updated_at: now, status: chat.status === '반영완료' ? '열림' : chat.status }).eq('id', chat.id);
  }
  async function renew(){
    if (!chat || !confirm('이 대화를 닫고 다음부터 새로 시작할까요? (기록은 자동작업 > 대화 탭에 남습니다)')) return;
    await store.client.from('routine_chats').update({ status: '닫힘', updated_at: nowIso() }).eq('id', chat.id);
    chat = null; MSGS = []; draft = ''; watch(); paint(); toast('다음 메시지부터 새 대화입니다');
  }
  async function open(){
    if (loading) return; loading = true;
    try {
      css();
      if (!isAdmin()) { toast('관리자만 쓸 수 있습니다', true); return; }
      await loadChat();
      openModal(`${modalHead('🤖 클로드와 인트라넷 만들기·고치기')}<div class="mb" id="ccModal">${html()}</div>`, { cls: 'xl' });
      bind(); watch();
      const ta = $('#ccText'); if (ta) ta.focus();
    } finally { loading = false; }
  }
  return { open };
})();
