/* ================================================================
   비즈홈 공통 동작 (모든 페이지가 함께 씀)
   - 설정(CONFIG), 저장소(로컬/Supabase), 로그인, 팀원 관리, 공통 화면 조각
================================================================ */

/* ========== 설정: Supabase 연결 정보 (비어 있으면 이 브라우저에만 저장되는 임시 모드) ========== */
const CONFIG = {
  SUPABASE_URL: "https://nflznotjmdqvqtjkzsec.supabase.co",   // Supabase 프로젝트 주소
  SUPABASE_KEY: "sb_publishable_grDEdL-mRivtPAta6qNVTw_Di-opchT",   // 공개용(publishable) 키
};

/* ---------- 작은 도우미 ---------- */
const LS = {
  get(k){ try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v){ try { localStorage.setItem(k, v); } catch {} },
  del(k){ try { localStorage.removeItem(k); } catch {} },
};
const COLORS = ['#e8590c','#2f9e44','#1971c2','#9c36b5','#c2255c','#0c8599','#e67700','#5f3dc4','#087f5b','#a61e4d'];
const WEEKDAYS = ['일','월','화','수','목','금','토'];
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random()*16|0; return (c === 'x' ? r : (r&3|8)).toString(16); }));
const pad = n => String(n).padStart(2, '0');
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const todayStr = () => ymd(new Date());
const nowIso = () => new Date().toISOString();
function parseYmd(s){ if (!s) return null; const [y,m,d] = s.split('-').map(Number); return new Date(y, m-1, d); }
function dayDiff(s){ const d = parseYmd(s); if (!d) return null; return Math.round((d - parseYmd(todayStr())) / 86400000); }
const fmtDate = s => s ? s.replace(/-/g, '/') : '';
function fmtDateTime(iso){ if (!iso) return ''; const d = new Date(iso); return `${d.getFullYear()}/${pad(d.getMonth()+1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`; }
const fmtNum = n => (n == null || n === '') ? '' : Number(n).toLocaleString('ko-KR');
const fmtMoney = n => (n == null || n === '') ? '' : Number(n) >= 10000 ? `${(Number(n)/10000).toLocaleString('ko-KR', {maximumFractionDigits: 1})}만원` : `${Number(n).toLocaleString('ko-KR')}원`;

let toastTimer;
function toast(msg, err){
  const el = $('#toast'); if (!el) return;
  el.innerHTML = `<div class="toast ${err ? 'err' : ''}">${esc(msg)}</div>`;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.innerHTML = '', err ? 5000 : 2200);
}

/* 색 태그: tag('회신대기', '#fbeccc', '#9a6700') */
const tag = (text, bg, fg, pill) => `<span class="tag ${pill ? 'pill' : ''}" style="background:${bg};color:${fg}">${esc(text)}</span>`;
/* 마감일 표시: 지났으면 빨강, 오늘이면 주황 */
function dueHtml(dateStr, done){
  if (!dateStr) return '<span class="date muted">-</span>';
  const n = dayDiff(dateStr);
  let cls = '', dd = '';
  if (done) { dd = ''; }
  else if (n < 0) { cls = 'over'; dd = `${-n}일 지남`; }
  else if (n === 0) { cls = 'today'; dd = '오늘'; }
  else if (n <= 3) { cls = 'soon'; dd = `D-${n}`; }
  else { dd = `D-${n}`; }
  return `<span class="due ${cls}">${fmtDate(dateStr)}${dd ? `<span class="dd">${dd}</span>` : ''}</span>`;
}

/* ================================================================
   저장소 1: 로컬 임시 (Supabase 설정 전 시험용, 이 브라우저에만 저장)
================================================================ */
const LocalStore = {
  label: '임시 저장(이 브라우저만)',
  key: 'bizhome_local',
  mem: null,
  async init(tables, onChange){ window.addEventListener('storage', e => { if (e.key === this.key) onChange(); }); },
  _read(){ if (this.mem) return this.mem; try { return JSON.parse(LS.get(this.key) || '{}'); } catch { return {}; } },
  _write(d){ LS.set(this.key, JSON.stringify(d)); if (LS.get(this.key) == null) this.mem = d; },
  async load(table){ return this._read()[table] || []; },
  async upsert(table, row){ const d = this._read(); d[table] = d[table] || []; const i = d[table].findIndex(x => x.id === row.id); if (i >= 0) d[table][i] = row; else d[table].push(row); this._write(d); },
  async delete(table, id){ const d = this._read(); d[table] = (d[table] || []).filter(x => x.id !== id); this._write(d); },
};

/* ================================================================
   저장소 2: Supabase (팀 공유, 어디서나 접속)
================================================================ */
const SupabaseStore = {
  label: '팀 공유 저장소 연결됨',
  client: null,
  async init(tables, onChange){
    this.client = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);
    let ch = this.client.channel('bizhome-changes');
    tables.forEach(t => { ch = ch.on('postgres_changes', { event: '*', schema: 'public', table: t }, () => onChange()); });
    ch.subscribe();
    setInterval(onChange, 60000);   // 실시간이 끊겼을 때를 대비해 60초마다 새로 읽음
  },
  async load(table){
    let q = this.client.from(table).select('*');
    if (table === 'members') q = q.order('sort_order');
    const { data, error } = await q; if (error) throw error; return data;
  },
  async upsert(table, row){ const { error } = await this.client.from(table).upsert(row); if (error) throw error; },
  async delete(table, id){ const { error } = await this.client.from(table).delete().eq('id', id); if (error) throw error; },
};

const store = (CONFIG.SUPABASE_URL && CONFIG.SUPABASE_KEY && window.supabase) ? SupabaseStore : LocalStore;

/* ================================================================
   앱 뼈대: 데이터 불러오기 → 로그인 확인 → 페이지별 render() 호출
================================================================ */
const DATA = {};          // DATA.tasks, DATA.leads, DATA.members ...
let members = [];
let me = LS.get('bizhome_me') || '';
let connError = '';
let APP = { title: '', tables: [], render(){}, normalize: null };

async function boot(app){
  APP = { normalize: null, ...app };
  const tables = [...new Set([...APP.tables, 'members'])];
  try { await store.init(tables, scheduleReload); } catch (e) { connError = e.message || String(e); }
  await reload();
}
let reloadTimer;
function scheduleReload(){ clearTimeout(reloadTimer); reloadTimer = setTimeout(reload, 150); }
async function reload(){
  try {
    for (const t of [...new Set([...APP.tables, 'members'])]) {
      let rows = await store.load(t);
      if (APP.normalize && t !== 'members') rows = rows.map(r => APP.normalize(t, r));
      DATA[t] = rows;
    }
    members = DATA.members;
    connError = '';
  } catch (e) { connError = e.message || String(e); }
  renderApp();
}
function renderApp(){
  if (!me || (members.length && !members.some(m => m.name === me))) { me = ''; renderLogin(); return; }
  APP.render();
}
/* 한 줄 저장(화면 먼저 바꾸고 저장소에 씀). 실패하면 알리고 다시 읽음 */
async function saveRow(table, row){
  row.updated_at = nowIso();
  const list = DATA[table] || (DATA[table] = []);
  const i = list.findIndex(x => x.id === row.id);
  if (i >= 0) list[i] = row; else list.push(row);
  renderApp();
  try { await store.upsert(table, row); }
  catch (e) { toast('저장 실패: ' + (e.message || e), true); reload(); }
}
async function removeRow(table, id){
  DATA[table] = (DATA[table] || []).filter(x => x.id !== id);
  if (table === 'members') members = DATA.members;
  renderApp();
  try { await store.delete(table, id); }
  catch (e) { toast('삭제 실패: ' + (e.message || e), true); reload(); }
}

/* ---------- 팀원 ---------- */
/* 관리자: 메뉴 편집, 팀원 삭제, 관리자 지정 가능. 처음 등록한 사람이 자동으로 관리자 */
const isAdmin = () => { const m = members.find(x => x.name === me); return !!(m && m.role === 'admin'); };
const admins = () => members.filter(m => m.role === 'admin');
async function addMember(name){
  name = (name || '').trim(); if (!name) return null;
  const dup = members.find(m => m.name === name);
  if (dup) { toast('이미 있는 이름입니다', true); return dup; }
  const m = { id: uid(), name, color: COLORS[members.length % COLORS.length], sort_order: members.length, role: members.length === 0 ? 'admin' : 'member' };
  await saveRow('members', m);
  return m;
}
async function setRole(id, role){
  if (!isAdmin()) { toast('관리자만 할 수 있습니다', true); return; }
  const m = members.find(x => x.id === id); if (!m) return;
  if (m.role === 'admin' && role !== 'admin' && admins().length <= 1) { toast('관리자가 최소 한 명은 있어야 합니다', true); return; }
  await saveRow('members', { ...m, role });
}
/* 예전 데이터에 관리자가 없으면 첫 팀원을 관리자로 */
async function ensureAdmin(){
  if (members.length && admins().length === 0) { const m = [...members].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))[0]; await saveRow('members', { ...m, role: 'admin' }); }
}
function memberColor(name){ const m = members.find(x => x.name === name); return m ? m.color : '#adb5bd'; }
const avatar = name => `<span class="av" style="background:${memberColor(name)}">${esc(String(name || '?').charAt(0))}</span>`;
const who = name => name ? `<span class="chip">${avatar(name)}${esc(name)}</span>` : '<span class="chip none">-</span>';
const memberOptions = sel => members.map(m => `<option ${sel === m.name ? 'selected' : ''}>${esc(m.name)}</option>`).join('');

function renderLogin(){
  $('#app').innerHTML = `<div class="login">
    <h1>${esc(APP.icon || '🏠')} ${esc(APP.title || '비즈홈')}</h1>
    <p>${members.length ? '본인 이름을 선택하세요' : '아직 팀원이 없습니다. 첫 팀원(본인) 이름을 등록하세요'}</p>
    ${connError ? `<p style="color:var(--red)">저장소 연결 오류: ${esc(connError)}</p>` : ''}
    <div class="names">${members.map(m => `<button data-login="${esc(m.name)}"><span class="dot" style="background:${m.color}"></span>${esc(m.name)}</button>`).join('')}</div>
    <div class="addrow"><input id="newName" placeholder="새 이름 (예: 홍길동)" maxlength="20"><button class="btn primary" id="addNameBtn">등록하고 시작</button></div>
    <p style="margin-top:24px;font-size:12px">${store.label}</p>
  </div>`;
  const inp = $('#newName');
  const go = async () => { const m = await addMember(inp.value); if (m) login(m.name); };
  $('#addNameBtn').onclick = go;
  inp.onkeydown = e => { if (e.key === 'Enter') go(); };
  document.querySelectorAll('[data-login]').forEach(b => b.onclick = () => login(b.dataset.login));
}
function login(name){ me = name; LS.set('bizhome_me', name); renderApp(); }
function logout(){ me = ''; LS.del('bizhome_me'); renderApp(); }

/* ---------- 모달(팝업 창) ---------- */
function openModal(html, opts = {}){
  $('#modal').innerHTML = `<div class="ov" id="ov"><div class="modal ${opts.wide ? 'wide' : ''}">${html}</div></div>`;
  $('#ov').onclick = e => { if (e.target.id === 'ov') closeModal(); };
  document.onkeydown = e => { if (e.key === 'Escape') closeModal(); };
  document.querySelectorAll('[data-close]').forEach(b => b.onclick = closeModal);
}
function closeModal(){ $('#modal').innerHTML = ''; document.onkeydown = null; }
const modalHead = (title, extra = '') => `<div class="mh"><h2>${title}</h2>${extra}<button class="x" data-close>✕</button></div>`;

/* 댓글 목록 + 입력칸 (업무·영업 공통) */
function commentsHtml(list){
  return `<div class="comments">
    <h4>댓글 · 기록 ${list.length ? `(${list.length})` : ''}</h4>
    ${list.map(c => `<div class="cm ${c.kind || ''}">${avatar(c.by)}<div class="body"><span class="by">${esc(c.by || '')}</span>${c.kind === 'reply' ? tag('회신', '#dbeafe', '#1d4ed8') + ' ' : ''}${esc(c.text)}<span class="at">${fmtDateTime(c.at)}</span></div></div>`).join('') || '<div class="hint">아직 댓글이 없습니다</div>'}
    <div class="cmadd"><textarea id="cText" placeholder="댓글을 남기면 함께 저장됩니다"></textarea><button class="btn" id="cAdd">댓글 남기기</button></div>
  </div>`;
}

function openMembers(counter){
  const admin = isAdmin();
  const rows = members.map(m => `<div class="mrow">${avatar(m.name)}<span class="nm">${esc(m.name)}${m.role === 'admin' ? ' ' + tag('관리자', '#fbeccc', '#9a6700') : ''}${m.name === me ? ' <span class="cnt">(나)</span>' : ''}</span><span class="cnt">${counter ? esc(counter(m)) : ''}</span>
      <button class="btn sm" data-switch="${esc(m.name)}">이 이름으로 전환</button>
      ${admin ? `<button class="btn sm" data-role="${m.id}" data-to="${m.role === 'admin' ? 'member' : 'admin'}">${m.role === 'admin' ? '관리자 해제' : '관리자 지정'}</button>
      <button class="btn sm danger" data-del="${m.id}" title="팀원 삭제">삭제</button>` : ''}</div>`).join('');
  openModal(`${modalHead('팀원 관리')}
    <div class="mb">
      <div>${rows || '<span class="hint">팀원이 없습니다</span>'}</div>
      <div class="addrow" style="justify-content:flex-start"><input id="mmName" placeholder="새 팀원 이름" maxlength="20"><button class="btn" id="mmAdd">추가</button></div>
      <div class="hint">${admin ? '관리자는 메뉴 편집, 팀원 삭제, 관리자 지정을 할 수 있습니다. 팀원을 삭제해도 그 사람 이름이 들어간 내용은 남습니다.' : '팀원 삭제와 관리자 지정은 관리자만 할 수 있습니다.'}</div>
    </div>
    <div class="mf"><button class="btn left" id="mmLogout">다른 사용자로 접속</button><button class="btn primary" data-close>닫기</button></div>`);
  $('#mmLogout').onclick = () => { closeModal(); logout(); };
  const add = async () => { const m = await addMember($('#mmName').value); if (m) openMembers(counter); };
  $('#mmAdd').onclick = add;
  $('#mmName').onkeydown = e => { if (e.key === 'Enter') add(); };
  document.querySelectorAll('[data-switch]').forEach(b => b.onclick = () => { closeModal(); login(b.dataset.switch); });
  document.querySelectorAll('[data-role]').forEach(b => b.onclick = async () => { await setRole(b.dataset.role, b.dataset.to); openMembers(counter); });
  document.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => {
    const m = members.find(x => x.id === b.dataset.del);
    if (!m) return;
    if (m.role === 'admin' && admins().length <= 1) { toast('마지막 관리자는 삭제할 수 없습니다', true); return; }
    if (confirm(`팀원 "${m.name}" 을(를) 목록에서 삭제할까요?`)) { await removeRow('members', m.id); openMembers(counter); }
  });
}

/* ---------- 상단 바 ---------- */
function headerHtml({ icon, title, tabs = [], active, newLabel, home = true, extra = '' }){
  return `<header class="top">
    ${home ? `<a class="home" href="index.html">🏠 비즈홈</a>` : ''}
    <div class="brand">${esc(icon || '')} ${esc(title)}</div>
    <nav class="tabs">${tabs.map(t => t ? `<button class="tab ${active === t.key ? 'on' : ''}" data-view="${t.key}">${esc(t.label)}${t.badge ? `<span class="badge">${t.badge}</span>` : ''}</button>` : '<span class="sep"></span>').join('')}</nav>
    <span class="conn ${connError ? 'bad' : ''}" title="${esc(connError)}">${connError ? '연결 오류' : store.label}</span>
    ${extra}
    ${newLabel ? `<button class="btn primary" id="newBtn">+ <span class="newtxt">${esc(newLabel)}</span></button>` : ''}
    <button class="me" id="meBtn" title="사용자 바꾸기 / 팀원 관리">${avatar(me)}${esc(me)}${isAdmin() ? '<span class="hint" style="font-size:10px">관리자</span>' : ''}</button>
  </header>`;
}
function bindHeader(onTab, onNew, counter){
  document.querySelectorAll('.tab').forEach(b => b.onclick = () => onTab(b.dataset.view));
  const nb = $('#newBtn'); if (nb && onNew) nb.onclick = onNew;
  $('#meBtn').onclick = () => openMembers(counter);
}

/* ---------- 달력(월 단위) ---------- */
/* items: 표시할 목록, opts: { date(item) → 'YYYY-MM-DD', label(item) → 글자, cls(item) → 'done'|'over'|'' , hint } */
function calendarHtml(cal, items, opts){
  const first = new Date(cal.y, cal.m, 1);
  const start = new Date(cal.y, cal.m, 1 - first.getDay());
  const today = todayStr();
  const byDay = {};
  items.forEach(t => { const k = opts.date(t); if (k) (byDay[k] = byDay[k] || []).push(t); });
  let cells = '';
  for (let i = 0; i < 42; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    if (i === 35 && d.getMonth() !== cal.m) break;
    const key = ymd(d), evs = byDay[key] || [];
    const wd = d.getDay();
    cells += `<div class="day ${d.getMonth() !== cal.m ? 'out' : ''} ${key === today ? 'today' : ''}" data-day="${key}">
      <div class="dn ${wd === 0 ? 'sun' : wd === 6 ? 'sat' : ''}"><b>${d.getDate()}</b></div>
      ${evs.slice(0, 4).map(t => `<div class="ev ${opts.cls ? opts.cls(t) : ''}" data-id="${t.id}" title="${esc(opts.label(t))}">${opts.label(t)}</div>`).join('')}
      ${evs.length > 4 ? `<div class="ev plus">+${evs.length - 4}</div>` : ''}
    </div>`;
  }
  return `<div class="calhead">
      <button class="btn sm" id="calPrev">‹</button><h2>${cal.y}년 ${cal.m + 1}월</h2>
      <button class="btn sm" id="calNext">›</button><button class="btn sm" id="calToday">오늘</button>
      ${opts.hint ? `<span class="count">${esc(opts.hint)}</span>` : ''}
    </div>
    <div class="cal">${WEEKDAYS.map(w => `<div class="wd">${w}</div>`).join('')}${cells}</div>`;
}
function bindCalendar(cal, rerender, onDay, onItem){
  const prev = $('#calPrev'); if (!prev) return;
  prev.onclick = () => { cal.m--; if (cal.m < 0) { cal.m = 11; cal.y--; } rerender(); };
  $('#calNext').onclick = () => { cal.m++; if (cal.m > 11) { cal.m = 0; cal.y++; } rerender(); };
  $('#calToday').onclick = () => { const d = new Date(); cal.y = d.getFullYear(); cal.m = d.getMonth(); rerender(); };
  document.querySelectorAll('.cal .day').forEach(d => d.onclick = e => { const ev = e.target.closest('.ev[data-id]'); if (ev) onItem(ev.dataset.id); else onDay(d.dataset.day); });
}

/* ---------- 정렬 (표 제목 클릭) ---------- */
function sortBy(list, sort, rank = {}){
  const k = sort.key, dir = sort.dir === 'asc' ? 1 : -1;
  return [...list].sort((a, b) => {
    let x = a[k], y = b[k];
    if (rank[k]) { x = rank[k](x); y = rank[k](y); }
    const ex = x == null || x === '', ey = y == null || y === '';
    if (ex && ey) return 0; if (ex) return 1; if (ey) return -1;
    if (x < y) return -dir; if (x > y) return dir;
    return (a.created_at || '') < (b.created_at || '') ? 1 : -1;
  });
}
const sortArrow = (sort, k) => sort.key === k ? `<span class="arrow">${sort.dir === 'asc' ? '▲' : '▼'}</span>` : '';
function bindSort(sort, rerender, defaultDir = {}){
  document.querySelectorAll('th[data-sort]').forEach(th => th.onclick = () => {
    const k = th.dataset.sort;
    if (sort.key === k) sort.dir = sort.dir === 'asc' ? 'desc' : 'asc'; else { sort.key = k; sort.dir = defaultDir[k] || 'desc'; }
    rerender();
  });
}
