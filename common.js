/* ================================================================
   비즈홈 공통 동작 (모든 페이지가 함께 씀)
   - 설정(CONFIG), 저장소(로컬/Supabase), 로그인, 팀원 관리, 공통 화면 조각
================================================================ */

/* ========== 설정: Supabase 연결 정보 (비어 있으면 이 브라우저에만 저장되는 임시 모드) ========== */
const CONFIG = {
  SUPABASE_URL: "https://nflznotjmdqvqtjkzsec.supabase.co",   // Supabase 프로젝트 주소
  SUPABASE_KEY: "sb_publishable_grDEdL-mRivtPAta6qNVTw_Di-opchT",   // 공개용(publishable) 키
};

/* ========== 이름·부제 (로그인 화면과 홈 제목에 쓰임) ========== */
const BRAND = { name: '인트라넷', sub: '식이해법연구소 · (주)피에이치뷰티', icon: '🏢' };
/* ========== 파비콘·홈 화면 아이콘 (favicon.svg / favicon-64.png / apple-touch-icon.png) ========== */
[['icon', 'favicon.svg', 'image/svg+xml'], ['icon', 'favicon-64.png', 'image/png'], ['apple-touch-icon', 'apple-touch-icon.png', '']]
  .forEach(([rel, href, type]) => { const l = document.createElement('link'); l.rel = rel; l.href = href; if (type) l.type = type; document.head.appendChild(l); });

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
  const missing = [];
  for (const t of [...new Set([...APP.tables, 'members'])]) {
    try {
      let rows = await store.load(t);
      if (APP.normalize && t !== 'members') rows = rows.map(r => APP.normalize(t, r));
      DATA[t] = rows;
      if (t === 'members') connError = '';
    } catch (e) {
      const msg = e.message || String(e);
      if (t === 'members') connError = msg;                       // 팀원 표를 못 읽으면 진짜 연결 오류
      else if (/does not exist|not find|schema cache/i.test(msg)) { missing.push(t); DATA[t] = undefined; }   // 표가 아직 없음(설정 SQL 미실행)
      else { connError = msg; }
    }
  }
  members = DATA.members || [];
  // 설정 SQL 이 덜 실행된 경우 관리자에게 안내
  const warns = [];
  if (store === SupabaseStore && members.length && !('password' in members[0])) warns.push('비밀번호 칸이 없어 비밀번호가 저장되지 않습니다 → alter table members add column if not exists password text;');
  if (store === SupabaseStore && members.length && !('hire_date' in members[0])) warns.push('입사일 칸이 없어 연차 자동 계산이 저장되지 않습니다 → sql-hire.sql 을 Supabase SQL Editor 에서 실행하세요.');
  if (store === SupabaseStore && members.length && !('title' in members[0])) warns.push('직급 칸이 없어 직급이 저장되지 않습니다 → alter table members add column if not exists title text;');
  if (missing.length) warns.push(`저장소에 "${missing.join(', ')}" 표가 없어 이 기능이 동작하지 않습니다 → supabase-setup.sql 의 해당 부분을 Supabase SQL Editor 에서 실행하세요.`);
  schemaWarn = warns.join(' / ');
  renderApp();
}
let schemaWarn = '';
const warnHtml = () => schemaWarn ? `<div style="background:#fee2e2;color:#b91c1c;padding:8px 12px;font-size:13px;text-align:center">⚠ ${esc(schemaWarn)}</div>` : '';
function renderApp(){
  if (!me || !members.some(m => m.name === me)) { me = ''; renderLogin(); return; }
  document.body.classList.remove('login-bg');
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
/* 비밀번호: 처음은 1234. 1234인 상태로 로그인하면 바꾸는 화면이 먼저 뜸 */
const DEFAULT_PW = '1234';
const pwOf = m => m.password || DEFAULT_PW;            // 비밀번호가 비어 있으면 초기값
const mustChangePw = m => pwOf(m) === DEFAULT_PW;
const PW_RULE = '4자 이상 (초기 비밀번호 1234 는 쓸 수 없음)';
function pwProblem(pw){
  if (pw.length < 4) return '4자 이상이어야 합니다';
  if (/\s/.test(pw)) return '띄어쓰기는 쓸 수 없습니다';
  if (pw === DEFAULT_PW) return '초기 비밀번호 1234 는 쓸 수 없습니다';
  return '';
}
async function addMember(name){
  name = (name || '').trim(); if (!name) return null;
  const dup = members.find(m => m.name === name);
  if (dup) { toast('이미 있는 이름입니다', true); return dup; }
  const m = { id: uid(), name, color: COLORS[members.length % COLORS.length], sort_order: members.length, role: members.length === 0 ? 'admin' : 'member', password: DEFAULT_PW };
  await saveRow('members', m);
  return m;
}
/* verified=true: 방금 현재 비밀번호를 맞힌 사람(처음 로그인 화면)이라 아직 로그인 전이어도 허용 */
async function setPassword(id, password, { quiet = false, verified = false } = {}){
  const m = members.find(x => x.id === id); if (!m) return false;
  if (!verified && !isAdmin() && m.name !== me) { toast('본인 비밀번호만 바꿀 수 있습니다', true); return false; }
  await saveRow('members', { ...m, password });
  if (!quiet) toast(password === DEFAULT_PW ? `${m.name}님 비밀번호를 1234로 초기화했습니다` : `${m.name}님 비밀번호를 저장했습니다`);
  return true;
}
/* 비밀번호를 묻는 작은 창. 맞으면 onOk() (초기 비밀번호면 먼저 바꾸게 함) */
function askPassword(m, onOk){
  openModal(`${modalHead('비밀번호 확인')}
    <div class="mb"><div>${who(m.name)}</div>
      <div class="f"><label>비밀번호</label><input type="password" id="pwIn" autocomplete="current-password"></div>
      <div class="hint">비밀번호를 잊었으면 관리자에게 초기화를 부탁하세요.</div></div>
    <div class="mf"><button class="btn" data-close>취소</button><button class="btn primary" id="pwOk">확인</button></div>`);
  const inp = $('#pwIn'); inp.focus();
  const go = () => {
    if (inp.value !== pwOf(m)) { toast('비밀번호가 맞지 않습니다', true); inp.select(); return; }
    closeModal();
    if (mustChangePw(m)) openSetPassword(m, { force: true, after: onOk }); else onOk();
  };
  $('#pwOk').onclick = go;
  inp.onkeydown = e => { if (e.key === 'Enter') go(); };
}
/* 비밀번호 정하기/바꾸기 창. force=true 면 닫을 수 없음(처음 로그인) */
function openSetPassword(m, opts = {}){
  const force = !!opts.force;
  openModal(`${modalHead(force ? '비밀번호를 새로 정해 주세요' : m.name === me ? '내 비밀번호 바꾸기' : `${esc(m.name)}님 비밀번호 정하기`)}
    <div class="mb">
      ${force ? `<div>${who(m.name)}<div class="hint" style="margin-top:6px">처음 로그인이거나 관리자가 초기화한 상태입니다. 초기 비밀번호(1234) 대신 본인만 아는 비밀번호로 바꿔야 들어갈 수 있습니다.</div></div>` : ''}
      <div class="f"><label>새 비밀번호</label><input type="password" id="pw1" autocomplete="new-password" maxlength="30"><div class="hint" id="pwHint">${PW_RULE}</div></div>
      <div class="f"><label>한 번 더</label><input type="password" id="pw2" autocomplete="new-password" maxlength="30"></div>
      <label class="hint" style="display:flex;align-items:center;gap:4px"><input type="checkbox" id="pwShow"> 입력한 글자 보기</label>
      ${isAdmin() && !force ? '<div class="hint">관리자는 팀원 관리에서 모든 비밀번호를 볼 수 있습니다.</div>' : ''}
    </div>
    <div class="mf">${force ? '' : '<button class="btn" data-close>취소</button>'}<button class="btn primary" id="pwSave">저장</button></div>`, { locked: force });
  const p1 = $('#pw1'), p2 = $('#pw2'), hint = $('#pwHint');
  p1.focus();
  p1.oninput = () => { const pr = pwProblem(p1.value); hint.textContent = p1.value ? (pr || '사용할 수 있는 비밀번호입니다 ✓') : PW_RULE; hint.className = 'hint' + (p1.value && pr ? ' warn' : ''); };
  $('#pwShow').onchange = e => { p1.type = p2.type = e.target.checked ? 'text' : 'password'; };
  const save = async () => {
    const a = p1.value, b = p2.value;
    const pr = pwProblem(a); if (pr) { toast(pr, true); p1.focus(); return; }
    if (a !== b) { toast('두 칸이 서로 다릅니다', true); p2.focus(); return; }
    closeModal();
    const ok = await setPassword(m.id, a, { quiet: force, verified: force });
    if (ok) { if (force) toast('비밀번호를 저장했습니다. 다음부터 이 비밀번호로 들어오세요'); if (opts.after) opts.after(); }
  };
  $('#pwSave').onclick = save;
  p2.onkeydown = e => { if (e.key === 'Enter') save(); };
  p1.onkeydown = e => { if (e.key === 'Enter') p2.focus(); };
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
/* 직급: 팀원 관리에서 관리자가 넣음. 이름 뒤에 "김상우 주임"처럼 붙여 표시 */
const titleOf = name => { const m = members.find(x => x.name === name); return m && m.title ? m.title : ''; };
const fullName = name => name ? name + (titleOf(name) ? ' ' + titleOf(name) : '') : '';
const who = name => name ? `<span class="chip">${avatar(name)}${esc(fullName(name))}</span>` : '<span class="chip none">-</span>';
const memberOptions = sel => members.map(m => `<option ${sel === m.name ? 'selected' : ''}>${esc(m.name)}</option>`).join('');

let loginPick = '';   // 로그인 화면에서 고른 이름
function renderLogin(){
  const picked = members.find(m => m.name === loginPick);
  document.body.classList.add('login-bg');
  const pageName = APP.title && APP.title !== BRAND.name ? APP.title : '';
  $('#app').innerHTML = `${warnHtml()}<div class="login-wrap"><div class="login">
    <div class="logo"><img src="favicon.svg" alt="PH"></div>
    <h1>${esc(BRAND.name)}</h1>
    <div class="sub">${esc(BRAND.sub)}</div>
    ${pageName ? `<div class="page-tag">${esc(APP.icon || '')} ${esc(pageName)}</div>` : ''}
    <p class="guide">${members.length ? (picked ? `<b>${esc(picked.name)}</b>님, 비밀번호를 입력하세요` : '본인 이름을 선택하세요') : '아직 팀원이 없습니다. 첫 팀원(본인) 이름을 등록하세요'}</p>
    ${connError ? `<p class="err">저장소 연결 오류: ${esc(connError)}</p>` : ''}
    <div class="names">${members.map(m => `<button data-login="${esc(m.name)}" class="${m.name === loginPick ? 'on' : ''}"><span class="av" style="background:${m.color}">${esc(m.name.charAt(0))}</span>${esc(m.name)}${m.title ? `<span class="hint" style="font-weight:400">${esc(m.title)}</span>` : ''}</button>`).join('')}</div>
    ${picked ? `<div class="pwrow"><input type="password" id="loginPw" placeholder="비밀번호" autocomplete="current-password"><button class="btn primary" id="loginBtn">들어가기</button></div>
    <p class="hint">${mustChangePw(picked) ? '처음이면 초기 비밀번호 1234 를 넣으세요. 들어가면서 새 비밀번호를 정하게 됩니다.' : '비밀번호를 잊었으면 관리자에게 초기화를 부탁하세요.'}</p>` : ''}
    ${members.length ? (picked ? '' : '<p class="hint">이름이 없으면 관리자에게 등록을 부탁하세요.</p>') : `<div class="pwrow"><input id="newName" placeholder="이름 (예: 홍길동)" maxlength="20"><button class="btn primary" id="addNameBtn">등록하고 시작</button></div>`}
    ${connError || store !== SupabaseStore ? `<div class="foot">${esc(connError ? "저장소 연결 오류: " + connError : store.label)}</div>` : ""}
  </div></div>`;
  const inp = $('#newName'); if (inp) {
    const go = async () => { const m = await addMember(inp.value); if (m) openSetPassword(m, { force: true, after: () => login(m.name) }); };
    $('#addNameBtn').onclick = go;
    inp.onkeydown = e => { if (e.key === 'Enter') go(); };
  }
  document.querySelectorAll('[data-login]').forEach(b => b.onclick = () => { loginPick = b.dataset.login; renderLogin(); $('#loginPw').focus(); });
  const lb = $('#loginBtn'); if (lb) {
    const tryLogin = () => {
      if ($('#loginPw').value !== pwOf(picked)) { toast('비밀번호가 맞지 않습니다', true); $('#loginPw').select(); return; }
      loginPick = '';
      if (mustChangePw(picked)) openSetPassword(picked, { force: true, after: () => login(picked.name) }); else login(picked.name);
    };
    lb.onclick = tryLogin; $('#loginPw').onkeydown = e => { if (e.key === 'Enter') tryLogin(); };
  }
}
function login(name){ me = name; LS.set('bizhome_me', name); renderApp(); }
function logout(){ me = ''; LS.del('bizhome_me'); renderApp(); }

/* ---------- 모달(팝업 창) ---------- */
/* 팝업 창. 바깥을 클릭해도 닫히지 않음(입력 중 실수 방지). 취소·✕·Esc 로 닫고, 입력한 내용이 있으면 Esc 때 한 번 물어봄 */
function openModal(html, opts = {}){
  $('#modal').innerHTML = `<div class="ov" id="ov"><div class="modal ${opts.wide ? 'wide' : ''}">${html}</div></div>`;
  const snapshot = () => [...document.querySelectorAll('#modal input:not([type=hidden]), #modal textarea')].map(i => i.type === 'checkbox' ? String(i.checked) : i.value).join('');
  const initial = snapshot();
  const dirty = () => snapshot() !== initial;
  const tryClose = () => { if (!dirty() || confirm('입력한 내용이 사라집니다. 창을 닫을까요?')) closeModal(); };
  if (!opts.locked) {   // locked: Esc·✕ 로도 닫을 수 없음(처음 비밀번호 정하기)
    document.onkeydown = e => { if (e.key === 'Escape' && !(e.target && e.target.closest && e.target.closest('select'))) tryClose(); };
    document.querySelectorAll('[data-close]').forEach(b => b.onclick = tryClose);
  } else {
    document.onkeydown = null;
    document.querySelectorAll('[data-close]').forEach(b => b.remove());
  }
}
function closeModal(){ $('#modal').innerHTML = ''; document.onkeydown = null; }
const modalHead = (title, extra = '') => `<div class="mh"><h2>${title}</h2>${extra}<button class="x" data-close>✕</button></div>`;

/* ========== 파일 첨부 (Supabase Storage 'files' 보관함, sql-files.sql 로 준비) ========== */
const FILE_BUCKET = 'files';
const fileUrl = path => `${CONFIG.SUPABASE_URL}/storage/v1/object/public/${FILE_BUCKET}/${path}`;
const isImg = f => /^image\//.test(f.type || '') || /\.(png|jpe?g|gif|webp)$/i.test(f.name || '');
const fileHeaders = () => ({ apikey: CONFIG.SUPABASE_KEY, Authorization: `Bearer ${CONFIG.SUPABASE_KEY}` });
/* 큰 사진은 가로·세로 1600px 이하 JPEG 로 줄여서 올림 (400KB 이하면 그대로) */
async function shrinkImage(file){
  if (!/^image\/(png|jpeg|webp)$/.test(file.type) || file.size < 400 * 1024) return file;
  try {
    const src = URL.createObjectURL(file);
    const img = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = src; });
    const r = Math.min(1, 1600 / Math.max(img.width, img.height));
    const c = document.createElement('canvas'); c.width = Math.round(img.width * r); c.height = Math.round(img.height * r);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(src);
    const blob = await new Promise(ok => c.toBlob(ok, 'image/jpeg', 0.85));
    return blob && blob.size < file.size ? new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' }) : file;
  } catch { return file; }
}
async function uploadFile(file, folder = 'etc'){
  if (file.size > 20 * 1024 * 1024) throw new Error('20MB 이하 파일만 올릴 수 있습니다');
  const f = isImg(file) ? await shrinkImage(file) : file;
  const ext = ((f.name || '').match(/\.(\w+)$/) || [])[1] || (f.type.split('/')[1] || 'bin');
  const path = `${folder}/${todayStr().slice(0, 7)}/${uid()}.${ext.toLowerCase()}`;
  const r = await fetch(`${CONFIG.SUPABASE_URL}/storage/v1/object/${FILE_BUCKET}/${path}`, { method: 'POST', headers: { ...fileHeaders(), 'Content-Type': f.type || 'application/octet-stream', 'x-upsert': 'true' }, body: f });
  if (!r.ok) { const t = await r.text(); throw new Error(/not found|Bucket/i.test(t) ? '파일 보관함이 아직 준비되지 않았습니다 (sql-files.sql 실행 필요)' : t.slice(0, 120)); }
  const name = file.name && !/^image\.\w+$/.test(file.name) ? file.name : `캡처 ${fmtDateTime(nowIso()).slice(5)}.${ext}`;
  return { name, path, url: fileUrl(path), type: f.type, size: f.size, by: me, at: nowIso() };
}
async function deleteFile(path){ try { await fetch(`${CONFIG.SUPABASE_URL}/storage/v1/object/${FILE_BUCKET}/${path}`, { method: 'DELETE', headers: fileHeaders() }); } catch {} }

/* 첨부 목록 보기: 사진은 작게, 누르면 새 창에서 크게 */
function filesHtml(files, { edit = false, rename = false } = {}){
  files = files || []; if (!files.length && !edit) return '';
  return `<div class="files">${files.map((f, i) => `<div class="file"><a href="${esc(f.url)}" target="_blank" rel="noopener" title="${esc(f.name)}">${isImg(f) ? `<img src="${esc(f.url)}" alt="${esc(f.name)}" loading="lazy">` : '<span class="doc">📄</span>'}${rename ? '' : `<span class="nm">${esc(f.name)}</span>`}</a>${rename ? `<input class="ren" data-ren="${i}" value="${esc(f.name)}" title="파일 이름 바꾸기 (내려받을 때 이 이름으로 저장됨)" maxlength="120">` : ''}${edit ? `<button type="button" class="rm" data-rm="${i}" title="첨부 빼기">✕</button>` : ''}</div>`).join('')}</div>`;
}
const filesCount = files => (files && files.length) ? `<span class="cmt" title="첨부 ${files.length}개">📎 ${files.length}</span>` : '';

/* 첨부 입력칸: 붙여넣기(Ctrl+V)·끌어다 놓기·파일 선택 → 바로 보관함에 올림
   사용: const at = attachBox('mFiles', 기존목록, 'tasks'); 창 html 에 at.html 넣고 openModal 뒤 at.bind(); 저장할 때 at.files */
function attachBox(id, initial = [], folder = 'etc', { rename = false } = {}){   // rename: 파일 이름 고치기 허용
  const files = (initial || []).map(f => ({ ...f })), orig = new Set(files.map(f => f.path));   // 처음부터 있던 파일은 빼도 보관함에서 지우지 않음
  const box = { files, html: `<div class="attach" id="${id}"><div class="list"></div><div class="row"><button type="button" class="btn sm" data-pick>📎 파일 첨부</button><span class="hint">캡처한 뒤 이 창에서 <b>Ctrl+V</b> 로 붙여넣거나, 파일을 끌어다 놓아도 됩니다</span><input type="file" multiple hidden><input type="text" hidden class="cnt" value="${files.length}"></div></div>` };
  box.bind = () => {
    const el = $('#' + id); if (!el) return;
    const inp = el.querySelector('input[type=file]'), cnt = el.querySelector('.cnt');
    const draw = () => {
      el.querySelector('.list').innerHTML = filesHtml(files, { edit: true, rename }); cnt.value = String(files.length) + files.map(f => f.name).join('|');   // cnt: 창 닫을 때 "입력 중" 판단용
      el.querySelectorAll('[data-rm]').forEach(b => b.onclick = () => { const [f] = files.splice(Number(b.dataset.rm), 1); draw(); if (f && f.path && !orig.has(f.path)) deleteFile(f.path); });
      el.querySelectorAll('[data-ren]').forEach(inp => { inp.onclick = e => e.stopPropagation(); inp.onchange = () => { const v = inp.value.trim(); if (v) files[Number(inp.dataset.ren)].name = v; else inp.value = files[Number(inp.dataset.ren)].name; cnt.value = String(files.length) + files.map(f => f.name).join('|'); }; });
    };
    box.add = async list => {
      const arr = [...list].filter(Boolean); if (!arr.length) return;
      const st = document.createElement('span'); st.className = 'hint up'; st.textContent = `올리는 중… (${arr.length})`; el.querySelector('.row').appendChild(st);
      for (const f of arr) { try { files.push(await uploadFile(f, folder)); draw(); } catch (e) { toast(`올리지 못했습니다: ${e.message}`, true); } }
      st.remove();
    };
    el.querySelector('[data-pick]').onclick = () => inp.click();
    inp.onchange = () => { box.add(inp.files); inp.value = ''; };
    // 한 창에 첨부칸이 둘 이상이면(요청 내용 + 댓글) 붙여넣은 곳과 가까운 칸으로, 아니면 첫 칸으로
    const modal = el.closest('.modal') || el;
    box.zone = el.parentElement || el;
    if (!modal._attach) {
      modal._attach = [];
      const pick = t => modal._attach.find(b => b.zone.contains(t)) || modal._attach[0];
      modal.addEventListener('paste', e => { const fs = [...((e.clipboardData && e.clipboardData.files) || [])]; if (fs.length) { e.preventDefault(); pick(e.target).add(fs); } });
      modal.addEventListener('dragover', e => { e.preventDefault(); modal.classList.add('drop'); });
      modal.addEventListener('dragleave', () => modal.classList.remove('drop'));
      modal.addEventListener('drop', e => { e.preventDefault(); modal.classList.remove('drop'); pick(e.target).add((e.dataTransfer && e.dataTransfer.files) || []); });
    }
    modal._attach.push(box);
    draw();
  };
  return box;
}

/* 댓글 목록 + 입력칸 (업무·영업 공통) */
function commentsHtml(list){
  return `<div class="comments">
    <h4>댓글 · 기록 ${list.length ? `(${list.length})` : ''}</h4>
    ${list.map(c => `<div class="cm ${c.kind || ''}">${avatar(c.by)}<div class="body"><span class="by">${esc(c.by || '')}</span>${c.kind === 'reply' ? tag('회신', '#dbeafe', '#1d4ed8') + ' ' : ''}${esc(c.text)}<span class="at">${fmtDateTime(c.at)}</span></div></div>`).join('') || '<div class="hint">아직 댓글이 없습니다</div>'}
    <div class="cmadd"><textarea id="cText" placeholder="댓글을 남기면 함께 저장됩니다"></textarea><button class="btn" id="cAdd">댓글 남기기</button></div>
  </div>`;
}

let showPw = false;   // 관리자 화면에서 비밀번호 보이기 상태
function openMembers(counter){
  const admin = isAdmin();
  const rows = members.map(m => `<div class="mrow">${avatar(m.name)}<span class="nm">${esc(m.name)}${!admin && m.title ? ' <span class="cnt">' + esc(m.title) + '</span>' : ''}${m.role === 'admin' ? ' ' + tag('관리자', '#fbeccc', '#9a6700') : ''}${m.name === me ? ' <span class="cnt">(나)</span>' : ''}</span>
      ${admin ? `<input value="${esc(m.title || '')}" data-title="${m.id}" placeholder="직급" maxlength="20" style="width:80px;border:1px solid var(--line2);border-radius:4px;padding:3px 6px;font-size:13px" title="직급 (예: 주임, 대리, 과장)">` : ''}
      ${admin ? `<span class="cnt" style="min-width:110px;font-family:monospace" title="비밀번호">${mustChangePw(m) ? '<span style="color:var(--orange)">1234 (초기)</span>' : (showPw ? esc(pwOf(m)) : '••••••')}</span>` : ''}
      <span class="cnt">${counter ? esc(counter(m)) : ''}</span>
      ${m.name === me ? `<button class="btn sm" data-pw="${m.id}">내 비밀번호 바꾸기</button>` : ''}
      ${admin && m.name !== me ? `<button class="btn sm" data-reset="${m.id}" ${mustChangePw(m) ? 'disabled' : ''} title="1234로 되돌리기">초기화</button>` : ''}
      ${admin && m.name !== me ? `<button class="btn sm" data-role="${m.id}" data-to="${m.role === 'admin' ? 'member' : 'admin'}">${m.role === 'admin' ? '관리자 해제' : '관리자 지정'}</button>
      <button class="btn sm danger" data-del="${m.id}" title="팀원 삭제">삭제</button>` : ''}</div>`).join('');
  openModal(`${modalHead('팀원 관리', admin ? `<button class="btn sm" id="mmShowPw">${showPw ? '🙈 비밀번호 가리기' : '👁 비밀번호 보기'}</button>` : '')}
    <div class="mb">
      <div>${rows || '<span class="hint">팀원이 없습니다</span>'}</div>
      ${admin ? `<div class="addrow" style="justify-content:flex-start"><input id="mmName" placeholder="새 팀원 이름" maxlength="20"><button class="btn" id="mmAdd">추가</button><span class="hint">새 팀원은 비밀번호 1234로 시작합니다</span></div>` : ''}
      <div class="hint">${admin ? '"1234 (초기)"인 사람은 아직 로그인해서 비밀번호를 바꾸지 않은 사람입니다. 잊어버린 팀원은 <b>초기화</b>로 1234로 되돌려 주세요. 팀원을 삭제해도 그 사람 이름이 들어간 내용은 남습니다.' : '비밀번호를 잊었으면 관리자에게 초기화를 부탁하세요. 팀원 추가·삭제와 관리자 지정은 관리자만 할 수 있습니다.'}</div>
    </div>
    <div class="mf"><button class="btn left" id="mmLogout">로그아웃</button><button class="btn primary" data-close>닫기</button></div>`, { wide: admin });
  $('#mmLogout').onclick = () => { closeModal(); logout(); };
  const sp = $('#mmShowPw'); if (sp) sp.onclick = () => { showPw = !showPw; openMembers(counter); };
  const ma = $('#mmAdd'); if (ma) {
    const add = async () => { const m = await addMember($('#mmName').value); if (m) openMembers(counter); };
    ma.onclick = add;
    $('#mmName').onkeydown = e => { if (e.key === 'Enter') add(); };
  }
  document.querySelectorAll('[data-pw]').forEach(b => b.onclick = () => { const m = members.find(x => x.id === b.dataset.pw); closeModal(); openSetPassword(m, { after: () => openMembers(counter) }); });
  document.querySelectorAll('[data-reset]').forEach(b => b.onclick = async () => { const m = members.find(x => x.id === b.dataset.reset); if (m && confirm(`${m.name}님 비밀번호를 1234로 초기화할까요?\n다음 로그인 때 새 비밀번호를 정하게 됩니다.`)) { await setPassword(m.id, DEFAULT_PW); openMembers(counter); } });
  document.querySelectorAll('[data-role]').forEach(b => b.onclick = async () => { await setRole(b.dataset.role, b.dataset.to); openMembers(counter); });
  document.querySelectorAll('[data-title]').forEach(inp => inp.onchange = async () => { const m = members.find(x => x.id === inp.dataset.title); if (!m) return; await saveRow('members', { ...m, title: inp.value.trim() || null }); toast(`${m.name}님 직급: ${inp.value.trim() || '없음'}`); });
  document.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => {
    const m = members.find(x => x.id === b.dataset.del);
    if (!m) return;
    if (m.role === 'admin' && admins().length <= 1) { toast('마지막 관리자는 삭제할 수 없습니다', true); return; }
    if (confirm(`팀원 "${m.name}" 을(를) 목록에서 삭제할까요?`)) { await removeRow('members', m.id); openMembers(counter); }
  });
}

/* ---------- 상단 바 ---------- */
function headerHtml({ icon, title, tabs = [], active, newLabel, home = true, extra = '' }){
  return `${isAdmin() ? warnHtml() : ''}<header class="top">
    ${home ? `<a class="home" href="index.html">🏠 ${esc(BRAND.name)}</a>` : ''}
    <div class="brand">${esc(icon || '')} ${esc(title)}</div>
    <nav class="tabs">${tabs.map(t => t ? `<button class="tab ${active === t.key ? 'on' : ''}" data-view="${t.key}">${esc(t.label)}${t.badge ? `<span class="badge">${t.badge}</span>` : ''}</button>` : '<span class="sep"></span>').join('')}</nav>
    ${connError ? `<span class="conn bad" title="${esc(connError)}">연결 오류</span>` : store !== SupabaseStore ? `<span class="conn">${esc(store.label)}</span>` : ''}
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
      ${evs.slice(0, 8).map(t => `<div class="ev ${opts.cls ? opts.cls(t) : ''}" data-id="${t.id}" title="${esc(opts.label(t))}">${opts.label(t)}</div>`).join('')}
      ${evs.length > 8 ? `<div class="ev plus">+${evs.length - 8}</div>` : ''}
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
