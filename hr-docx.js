/* ================================================================
   인사 서류 — 워드(.docx) 파일 만들기 (2026-11-26, hr.html 이 씀)
   바깥 프로그램(라이브러리)을 쓰지 않고 이 파일만으로 워드 파일을 만듭니다(주소·연봉이 지나가는 화면이라 남의 코드를 덜 끌어옴).

   양식 글의 줄 표시:
     # 제목          → 큰 제목(가운데 · 테두리 상자)
     ## 글           → 제목 바로 아래 작은 글(가운데)
     ### 제1조(…)    → 조 제목(굵게)
     >> 글           → 가운데 정렬
     ---쪽나눔---    → 여기서 다음 쪽으로
     그 밖의 줄      → 그대로. 줄 앞의 빈칸 수만큼 들여씀
   빈칸: {이름} {주소} {연락처} {회사} … 은 fill() 이 채웁니다(모르는 이름은 그대로 둠).
================================================================ */
(function (root) {
  const won = n => Math.round(Number(n) || 0).toLocaleString('en-US');

  /* 최저임금(시간급). 해마다 8월쯤 다음 해 금액이 고시되면 여기에 한 줄 추가합니다 */
  const MINWAGE = { 2025: 10030, 2026: 10320, 2027: 10700 };
  const MAX_OT = 40, MAX_HOL = 12;   // 고정 연장 · 휴일 시간의 위쪽 끝(합쳐 월 52시간 이하 — 연봉계산서 예시와 같음)
  /* 계약 기간에 걸리는 해 가운데 가장 높은 최저임금. 끝나는 날이 없으면(정규직) 시작한 해와 그 다음 해를 봄.
     아직 고시되지 않은 해는 알고 있는 마지막 해 금액으로 봄(guess = true) */
  function minWageFor(start, end) {
    const known = Object.keys(MINWAGE).map(Number).sort((x, y) => x - y), last = known[known.length - 1];
    const y1 = Number(String(start || '').slice(0, 4)) || new Date().getFullYear(), y2 = Number(String(end || '').slice(0, 4)) || y1 + 1;
    let wage = 0, year = y1, guess = false;
    for (let y = y1; y <= Math.max(y1, y2); y++) { const v = MINWAGE[y] || MINWAGE[last]; if (!MINWAGE[y] && (end || y === y1)) guess = true; if (v > wage) { wage = v; year = MINWAGE[y] ? y : last; } }
    return { wage, year, guess };
  }

  /* 포괄임금 계산 (연봉계산서 예시와 같은 식):
     월 임금 총액 = 연 급여 ÷ 12 · 시간급 = 월 임금 총액 ÷ (209 + 연장시간×1.5 + 휴일시간×1.5)
     고정연장 = 시간급 × 연장시간 × 1.5 · 고정휴일 = 시간급 × 휴일시간 × 1.5 · 기본급 = 월 임금 총액 − 식대 − 고정연장 − 고정휴일
     고정 시간을 많이 잡을수록 시간급이 내려가므로, (기본급 + 식대) ÷ 209 가 최저임금 밑으로 내려가지 않는 선까지만 잡습니다.
     o.otH · o.holH 를 주면 그 시간으로, 안 주면 최저임금(o.minWage)에 맞춰 잡을 수 있는 가장 많은 시간(연장 먼저 40까지, 남으면 휴일 12까지)으로 계산 */
  function wageOf(annual, meal, o = {}) {
    annual = Number(annual) || 0; meal = meal == null || meal === '' ? 200000 : Number(meal) || 0;
    const minWage = Number(o.minWage) || minWageFor().wage, monthly = Math.round(annual / 12);
    const calc = (otH, holH) => { const hour = monthly / (209 + otH * 1.5 + holH * 1.5), ot = Math.round(hour * otH * 1.5), hol = Math.round(hour * holH * 1.5), base = monthly - meal - ot - hol;
      return { annual, monthly, meal, ot, hol, fixed: ot + hol, base, otH, holH, hour: (base + meal) / 209, minWage, low: base + meal < minWage * 209 }; };
    const given = v => v != null && v !== '' && !isNaN(Number(v));
    if (given(o.otH) || given(o.holH)) return { ...calc(Math.max(0, Number(o.otH) || 0), Math.max(0, Number(o.holH) || 0)), auto: false };
    let t = Math.max(0, Math.min(MAX_OT + MAX_HOL, Math.floor((monthly / minWage - 209) / 1.5))), w;
    for (;;) { w = calc(Math.min(MAX_OT, t), Math.max(0, t - MAX_OT)); if (!w.low || t === 0) break; t--; }   // 원 단위 반올림 때문에 1원 모자라면 한 시간 줄임
    return { ...w, auto: true };
  }

  /* '2026-05-04' → '2026년  5월  4일'. 비어 있으면 손으로 적을 빈칸 */
  function kDate(s) {
    if (!s) return '       년       월       일';
    const [y, m, d] = String(s).slice(0, 10).split('-').map(Number);
    return `${y}년  ${m}월  ${d}일`;
  }
  const spaced = name => { const t = String(name || '').trim(); return /^[가-힣]{2,4}$/.test(t) ? t.split('').join(' ') : t; };   // 김상우 → 김 상 우
  const fill = (body, vars) => String(body || '').replace(/\{([^{}\n]{1,20})\}/g, (m, k) => (k in vars ? String(vars[k] ?? '') : m));

  /* ---------- 워드 문서 XML ---------- */
  const x = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');
  const run = (text, o = {}) => `<w:r><w:rPr>${o.b ? '<w:b/><w:bCs/>' : ''}${o.sz ? `<w:sz w:val="${o.sz}"/><w:szCs w:val="${o.sz}"/>` : ''}</w:rPr><w:t xml:space="preserve">${x(text)}</w:t></w:r>`;
  const para = (inner, ppr = '') => `<w:p><w:pPr>${ppr}</w:pPr>${inner}</w:p>`;
  const CH = 105;   // 반각 글자 한 칸 너비(20분의 1 pt) — 줄 앞 빈칸 한 칸
  function lineXml(raw) {
    const line = raw.replace(/\t/g, '    ').replace(/\s+$/, '');
    if (!line.trim()) return para('');
    if (/^---\s*쪽나눔\s*---$/.test(line.trim())) return '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
    let m;
    if ((m = /^#\s+(.*)$/.exec(line))) return para(run(m[1], { b: true, sz: 36 }),
      '<w:pBdr><w:top w:val="single" w:sz="8" w:space="8" w:color="000000"/><w:left w:val="single" w:sz="8" w:space="4" w:color="000000"/><w:bottom w:val="single" w:sz="8" w:space="8" w:color="000000"/><w:right w:val="single" w:sz="8" w:space="4" w:color="000000"/></w:pBdr><w:spacing w:before="0" w:after="160"/><w:ind w:left="1700" w:right="1700"/><w:jc w:val="center"/>');
    if ((m = /^##\s+(.*)$/.exec(line))) return para(run(m[1]), '<w:spacing w:after="160"/><w:jc w:val="center"/>');
    if ((m = /^###\s+(.*)$/.exec(line))) return para(run(m[1], { b: true }), '<w:keepNext/><w:spacing w:before="140"/>');
    if ((m = /^>>\s*(.*)$/.exec(line))) return para(run(m[1]), '<w:jc w:val="center"/>');
    const lead = /^ */.exec(line)[0].length, text = line.slice(lead);
    const mark = /^(-|※|>|\d+\)|[①-⑮])\s+/.exec(text);   // 글머리가 있으면 둘째 줄부터 글머리 뒤에 맞춤
    const hang = mark ? [...mark[0]].reduce((n, c) => n + (c.charCodeAt(0) > 255 ? 2 : 1), 0) * CH : 0;
    return para(run(text), `<w:ind w:left="${lead * CH + hang}"${hang ? ` w:hanging="${hang}"` : ''}/>`);
  }
  function documentXml(text) {
    const body = String(text || '').replace(/\r\n?/g, '\n').split('\n').map(lineXml).join('');
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1247" w:bottom="1134" w:left="1247" w:header="567" w:footer="567" w:gutter="0"/></w:sectPr></w:body></w:document>`;
  }
  const FONT = '맑은 고딕';
  const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="${FONT}" w:eastAsia="${FONT}" w:hAnsi="${FONT}" w:cs="${FONT}"/><w:sz w:val="20"/><w:szCs w:val="20"/><w:lang w:val="en-US" w:eastAsia="ko-KR"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="0" w:line="300" w:lineRule="auto"/><w:jc w:val="left"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="a"><w:name w:val="Normal"/><w:pPr><w:wordWrap w:val="0"/><w:autoSpaceDE w:val="0"/><w:autoSpaceDN w:val="0"/></w:pPr></w:style></w:styles>`;
  const TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>`;
  const RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`;
  const DOC_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;

  /* ---------- zip 묶기 (압축 없이 담기만 함 — 워드 파일은 zip 묶음) ---------- */
  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc32 = u8 => { let c = 0xFFFFFFFF; for (let i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
  function zip(files) {
    const enc = new TextEncoder(), parts = [], central = []; let off = 0;
    const head = (sig, extra, name, crc, size) => { const b = new Uint8Array(extra + name.length), v = new DataView(b.buffer); v.setUint32(0, sig, true); return [b, v]; };
    for (const [path, content] of files) {
      const name = enc.encode(path), data = enc.encode(content), crc = crc32(data);
      const [lb, lv] = head(0x04034b50, 30, name);
      lv.setUint16(4, 20, true); lv.setUint16(6, 0x0800, true); lv.setUint16(8, 0, true); lv.setUint16(10, 0, true); lv.setUint16(12, 0x21, true);
      lv.setUint32(14, crc, true); lv.setUint32(18, data.length, true); lv.setUint32(22, data.length, true); lv.setUint16(26, name.length, true); lb.set(name, 30);
      const [cb, cv] = head(0x02014b50, 46, name);
      cv.setUint16(4, 20, true); cv.setUint16(6, 20, true); cv.setUint16(8, 0x0800, true); cv.setUint16(10, 0, true); cv.setUint16(12, 0, true); cv.setUint16(14, 0x21, true);
      cv.setUint32(16, crc, true); cv.setUint32(20, data.length, true); cv.setUint32(24, data.length, true); cv.setUint16(28, name.length, true); cv.setUint32(42, off, true); cb.set(name, 46);
      parts.push(lb, data); central.push(cb); off += lb.length + data.length;
    }
    const csize = central.reduce((n, b) => n + b.length, 0), end = new Uint8Array(22), ev = new DataView(end.buffer);
    ev.setUint32(0, 0x06054b50, true); ev.setUint16(8, files.length, true); ev.setUint16(10, files.length, true); ev.setUint32(12, csize, true); ev.setUint32(16, off, true);
    const all = [...parts, ...central, end], out = new Uint8Array(all.reduce((n, b) => n + b.length, 0)); let p = 0;
    for (const b of all) { out.set(b, p); p += b.length; }
    return out;
  }
  /* 글 → 워드 파일(Uint8Array) */
  const buildDocx = text => zip([['[Content_Types].xml', TYPES], ['_rels/.rels', RELS], ['word/document.xml', documentXml(text)], ['word/styles.xml', STYLES], ['word/_rels/document.xml.rels', DOC_RELS]]);

  const api = { MINWAGE, minWageFor, won, wageOf, kDate, spaced, fill, buildDocx };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.HRDOC = api;
})(typeof window !== 'undefined' ? window : globalThis);
