/* ================================================================
   카톡주문 채우기 (2026-10-22) — 즐겨찾기 단추(북마크)가 쇼핑몰(레모너리·서리맥스·흑생마, 카페24) 화면에서 불러 씀
   인트라넷 CS > 카톡 주문의 [주문하러 가기]가 상품 페이지 주소 뒤에 #ko=<주문 정보> 를 붙여 엶.
     ① 상품 페이지에서 누르면: 주문 정보를 이 쇼핑몰의 sessionStorage 에 담고, 박스 수 옵션을 골라 둠 → 직원이 [구매하기]
     ② 주문서에서 누르면: 주문자·받는 분·휴대폰·배송 메시지·무통장입금·입금자명을 채우고, 주소는 복사해 둠(주소 검색에 붙여넣기)
   결제·주문 단추는 절대 누르지 않음. 비밀번호 칸도 건드리지 않음. 채운 칸·못 채운 칸을 화면 위 띠에 보여 줌.
================================================================ */
(function () {
  const KEY = 'ko_order';
  const QTY_WORD = { 1: '1박스', 2: '2박스', 4: '3+1', 6: '4+2' };
  const decode = s => JSON.parse(decodeURIComponent(escape(atob(s))));
  let o = null;
  const m = location.hash.match(/ko=([^&]+)/);
  if (m) { try { o = decode(m[1]); sessionStorage.setItem(KEY, JSON.stringify(o)); history.replaceState(null, '', location.pathname + location.search); } catch (e) {} }
  if (!o) { try { o = JSON.parse(sessionStorage.getItem(KEY) || 'null'); } catch (e) {} }

  function bar(html, ok) {
    let b = document.getElementById('ko-fill-bar');
    if (!b) { b = document.createElement('div'); b.id = 'ko-fill-bar'; document.body.appendChild(b); }
    b.style.cssText = 'position:fixed;left:0;right:0;top:0;z-index:2147483647;padding:12px 16px;font:14px/1.6 sans-serif;color:#fff;box-shadow:0 2px 8px rgba(0,0,0,.3);background:' + (ok ? '#15803d' : '#b45309');
    b.innerHTML = html + ' <button style="margin-left:10px;padding:2px 10px;border:0;border-radius:4px;cursor:pointer">닫기</button>';
    b.querySelector('button').onclick = () => b.remove();
  }
  if (!o) { bar('카톡 주문 정보가 없습니다. 인트라넷 <b>CS › 카톡 주문</b>에서 [주문하러 가기]로 들어와 주세요.'); return; }
  const who = `<b>${o.name || '?'}</b> ${QTY_WORD[o.qty] || ''}`;

  const fire = el => ['input', 'change', 'blur'].forEach(t => el.dispatchEvent(new Event(t, { bubbles: true })));
  function set(ids, v) {
    if (v == null || v === '') return false;
    for (const id of ids) {
      const el = document.getElementById(id) || document.querySelector(`[name="${id}"]`);
      if (!el || el.type === 'password' || el.type === 'hidden') continue;
      if (el.tagName === 'SELECT') { if (![...el.options].some(op => op.value === v)) continue; }
      el.value = v; fire(el); return true;
    }
    return false;
  }

  // ① 상품 페이지: 박스 수 옵션 고르기
  const sel = document.getElementById('product_option_id1');
  if (sel) {
    const want = QTY_WORD[o.qty];
    const op = want && [...sel.options].find(x => x.text.replace(/\s/g, '').includes(want) && !(o.qty <= 2 && /\d\s*\+\s*\d/.test(x.text)));   // '2박스'가 '4+2박스'에 걸리지 않게 ('(+25,200원)'의 + 는 묶음 표시 아님)
    if (op) {
      const btn = document.querySelector(`[option_value="${op.value}"]`);   // 이 쇼핑몰들은 선택 상자가 아니라 옵션 단추(li)를 눌러야 담김
      if (btn) btn.click();
      else { sel.value = op.value; if (window.jQuery) window.jQuery(sel).trigger('change'); else fire(sel); }
      bar(`${who} — 옵션 <b>${op.text.replace(/<[^>]+>/g, '').trim().slice(0, 30)}</b> 을 골랐습니다. 금액 확인 후 <b>[구매하기]</b> → 주문서에서 이 단추를 한 번 더 누르세요.`, true);
    } else bar(`${who} — 수량에 맞는 옵션을 못 찾았습니다. 옵션을 직접 골라 주세요.`);
    return;
  }

  // ② 주문서
  const isForm = document.getElementById('rname') || document.getElementById('oname') || /orderform/.test(location.pathname);
  if (!isForm) { bar(`${who} 정보를 담았습니다. 상품 페이지나 주문서 화면에서 이 단추를 눌러 주세요.`, true); return; }
  const p = String(o.phone || '').replace(/\D/g, '');
  const p1 = p.slice(0, 3), p3 = p.slice(-4), p2 = p.slice(3, p.length - 4);
  const done = [], miss = [];
  const put = (label, ok) => (ok ? done : miss).push(label);
  if (document.getElementById('oname')) {   // 주문자 칸이 따로 있는 화면만 (레모너리 주문서는 받는 분만 받음, 2026-10-22 확인)
    put('주문자 이름', set(['oname'], o.name));
    put('주문자 휴대폰', [set(['ophone2_1'], p1), set(['ophone2_2'], p2), set(['ophone2_3'], p3)].every(Boolean));
  }
  put('받는 분 이름', set(['rname'], o.name));
  put('받는 분 휴대폰', [set(['rphone2_1'], p1), set(['rphone2_2'], p2), set(['rphone2_3'], p3)].every(Boolean));
  if (o.email) {
    const [e1, e2] = o.email.split('@'), dom = document.getElementById('oemail3');
    let ok = set(['oemail1'], e1);
    if (dom && [...dom.options].some(x => x.value === e2)) { dom.value = e2; fire(dom); const e = document.getElementById('oemail2'); if (e && e.value !== e2) { e.value = e2; fire(e); } }
    else { if (dom) { dom.value = 'etc'; fire(dom); } ok = ok && set(['oemail2'], e2); }
    put('이메일', ok);
  }
  if (o.message) {   // 메시지 선택 상자에서 '직접 입력'을 고른 뒤 글 넣기
    const ms = document.getElementById('omessage_select'), same = ms && [...ms.options].find(x => x.text.trim() === o.message);
    if (ms) { ms.value = same ? same.value : 'oMessage-input'; fire(ms); }
    put('배송 메시지', same ? true : set(['omessage'], o.message) || (() => { const t = document.getElementById('omessage'); if (t) { t.value = o.message; fire(t); } return !!t; })());
  }
  const cash = document.querySelector('input[name="addr_paymethod"][value="cash"], input[id^="addr_paymethod"][value="cash"]');
  if (cash) { cash.click(); fire(cash); }
  put('무통장입금 선택', !!cash);
  put('입금자명', set(['pname'], o.name));
  const bank = document.getElementById('bankaccount');
  if (bank && (!bank.value || bank.value === '-1')) { const first = [...bank.options].find(x => x.value && x.value !== '-1'); if (first) { bank.value = first.value; fire(bank); } }
  if (bank) put('입금 계좌', !!bank.value && bank.value !== '-1');
  try { navigator.clipboard.writeText(o.address || ''); } catch (e) {}
  bar(`${who} 채움: ${done.join(', ') || '없음'}` + (miss.length ? ` · <u>못 채움: ${miss.join(', ')}</u>` : '') +
      `<br>📋 주소가 복사돼 있습니다 → <b>주소 검색</b>에 붙여넣기(Ctrl+V) 후 상세주소 확인: ${o.address || '(주소 없음)'}` +
      `<br>비밀번호 칸(비회원)은 직접 입력하고, 금액 확인 뒤 결제는 직접 누르세요.`, !miss.length);
})();
