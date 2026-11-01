/* MARC 스튜디오 — 레코드 모델, 브레이커 텍스트 파서/직렬화, ISO 2709 읽기/쓰기
 * Record = { id, format:'KORMARC'|'MARC21', leader:string(24), fields:[Field], updatedAt }
 * Field  = { tag, value }                       // 제어필드 (001-009)
 *        | { tag, ind1, ind2, subfields:[{code,value}] }
 */
window.MS = window.MS || {};
(function () {
  const M = {};
  const DELIM_RE = /[▼▾$‡]/;            // 식별기호 구분자(입력 허용)
  const DELIM_SPLIT_RE = /(?=[▼▾$‡][0-9a-zA-Z])/;

  M.uid = () => 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  M.isControl = (tag) => /^00\d$/.test(tag);
  M.pad = (s, n, ch) => { s = String(s == null ? '' : s); ch = ch || ' '; while (s.length < n) s += ch; return s.slice(0, n); };
  M.lpad = (s, n, ch) => { s = String(s == null ? '' : s); ch = ch || '0'; while (s.length < n) s = ch + s; return s.slice(-n); };

  M.today6 = () => { const d = new Date(); return M.lpad(d.getFullYear() % 100, 2) + M.lpad(d.getMonth() + 1, 2) + M.lpad(d.getDate(), 2); };
  M.now005 = () => { const d = new Date(); return String(d.getFullYear()) + M.lpad(d.getMonth() + 1, 2) + M.lpad(d.getDate(), 2) + M.lpad(d.getHours(), 2) + M.lpad(d.getMinutes(), 2) + M.lpad(d.getSeconds(), 2) + '.0'; };

  M.isAuth = (format) => format === 'KORMARC-AUTH';
  M.defaultLeader = (format) => format === 'KORMARC-AUTH' ? '00000nz  a2200000n  4500' : format === 'KORMARC' ? '00000nam a2200000 c 4500' : '00000nam a2200000 i 4500';
  M.default008 = (format) => {
    const d = M.today6();
    if (format === 'KORMARC-AUTH') {
      //      00-05 06  07  08  09  10  11  12  13  14  15  16  17  18-27         28  29  30  31  32  33  34-37 38  39
      return d + ' ' + 'n' + ' ' + 'a' + 'z' + 'n' + 'n' + 'n' + 'a' + 'a' + 'b' + 'n' + '          ' + ' ' + 'a' + ' ' + 'a' + 'a' + 'a' + '    ' + ' ' + ' ';
    }
    if (format === 'KORMARC') {
      //      00-05  06  07-10  11-14  15-17  18-21  22 23 24-25 26-27 28 29 30 31 32 33 34 35-37 38-39
      return d + 's' + '    ' + '    ' + 'ulk' + '    ' + ' ' + ' ' + '  ' + '  ' + ' ' + '0' + '0' + '0' + ' ' + ' ' + ' ' + 'kor' + '  ';
    }
    //      00-05  06  07-10  11-14  15-17  18-21  22 23 24-27 28 29 30 31 32 33 34 35-37 38 39
    return d + 's' + '    ' + '    ' + 'ko ' + '    ' + ' ' + ' ' + '    ' + ' ' + '0' + '0' + '0' + ' ' + '0' + ' ' + 'eng' + ' ' + ' ';
  };

  M.newRecord = (format) => ({
    id: M.uid(), format: format || 'KORMARC', leader: M.defaultLeader(format || 'KORMARC'),
    fields: M.isAuth(format) ? [{ tag: '008', value: M.default008(format) }, { tag: '100', ind1: '1', ind2: ' ', subfields: [{ code: 'a', value: '' }] }] : [{ tag: '008', value: M.default008(format || 'KORMARC') }, { tag: '245', ind1: '0', ind2: '0', subfields: [{ code: 'a', value: '' }] }],
    updatedAt: new Date().toISOString(),
  });
  M.newField = (tag) => M.isControl(tag) ? { tag, value: '' } : { tag, ind1: ' ', ind2: ' ', subfields: [{ code: 'a', value: '' }] };
  M.clone = (r) => JSON.parse(JSON.stringify(r));

  M.getFields = (rec, tag) => rec.fields.filter(f => f.tag === tag);
  M.getFirst = (rec, tag) => rec.fields.find(f => f.tag === tag) || null;
  M.getSub = (field, code) => { if (!field || !field.subfields) return null; const s = field.subfields.find(x => x.code === code); return s ? s.value : null; };
  M.getSubs = (field, code) => (field && field.subfields ? field.subfields.filter(x => x.code === code).map(x => x.value) : []);
  M.recordTitle = (rec) => {
    if (M.isAuth(rec.format)) { const hf = rec.fields.find(x => /^1\d\d$/.test(x.tag)); const t = hf ? (hf.subfields || []).filter(x => /[a-z]/.test(x.code)).map(x => x.value).join(' ').trim() : ''; return t || '(표목 없음)'; }
    const f = M.getFirst(rec, '245');
    const a = M.getSub(f, 'a');
    return (a && a.replace(/\s*[\/:;=.]+\s*$/, '').trim()) || '(표제 없음)';
  };
  M.sortFields = (rec) => { rec.fields = rec.fields.slice().sort((a, b) => a.tag.localeCompare(b.tag)); return rec; };

  /* ---------- 브레이커 텍스트 ---------- */
  // 지시기호 공백 표기 정규화: '\' '#' '_' 'b/' → ' '
  const normInd = (s) => s.replace(/b\//g, ' ').replace(/[\\#_]/g, ' ');
  const normCtrl = (s) => s.replace(/b\//g, ' ').replace(/[\\#]/g, ' ');

  // 한 줄 파싱 → Field | {leader} | null
  M.parseLine = (line) => {
    line = line.replace(/\r$/, '');
    if (!line.trim()) return null;
    let m = line.match(/^=?(LDR|000|리더)\s*(.*)$/i);
    if (m) return { leader: M.pad(normCtrl(m[2]).replace(/^\s+/, ''), 24) };
    m = line.match(/^(=?)(\d{3})(.*)$/);
    if (!m) return { error: '태그를 인식할 수 없음: ' + line.slice(0, 30) };
    const marcedit = m[1] === '=';          // =245  10$a… : 태그 뒤 공백 2칸 고정
    const tag = m[2]; let rest = m[3];
    // 일반(KORMARC) 형식: 245 10▼a… : 태그 뒤 공백 1칸 고정
    const lead = marcedit ? 2 : 1;
    let stripped = rest;
    for (let i = 0; i < lead; i++) if (stripped.charAt(0) === ' ') stripped = stripped.slice(1);
    if (M.isControl(tag)) {
      let v = stripped;
      if (tag === '008' || tag === '006' || tag === '007') v = normCtrl(v);
      if (tag === '008') v = M.pad(v, 40);
      return { tag, value: v };
    }
    const dm = stripped.match(DELIM_RE);
    if (!dm) {
      const t = stripped.trim();
      return { tag, ind1: ' ', ind2: ' ', subfields: [{ code: 'a', value: t }], warn: '식별기호가 없어 ▼a로 처리' };
    }
    let pre = normInd(stripped.slice(0, dm.index));
    const data = stripped.slice(dm.index);
    // 지시기호가 3자 이상 남으면(공백이 더 들어간 경우) 뒤에서부터 정리
    if (pre.length > 2) { const t = pre.trim(); pre = t.length <= 2 ? M.pad(t, 2) : pre.slice(0, 2); }
    const ind1 = pre.charAt(0) || ' ', ind2 = pre.charAt(1) || ' ';
    const parts = data.split(DELIM_SPLIT_RE).filter(Boolean);
    const subfields = parts.map(p => ({ code: p.charAt(1), value: p.slice(2) }));
    return { tag, ind1, ind2, subfields };
  };

  // 여러 줄 → {record, problems[]}  (기존 레코드 base 가 있으면 id/format 유지)
  M.parseBreaker = (text, format, base) => {
    const rec = base ? M.clone(base) : M.newRecord(format);
    rec.format = format || rec.format;
    rec.fields = []; let leader = null; const problems = [];
    // 줄 이어짓기: 태그로 시작하지 않는 줄은 앞 줄에 붙인다
    const lines = [];
    text.split('\n').forEach(raw => {
      const l = raw.replace(/\r$/, '');
      if (/^\s*=?(\d{3}|LDR|리더)\b/i.test(l) || !lines.length) lines.push(l); else lines[lines.length - 1] += ' ' + l.trim();
    });
    lines.forEach((l, i) => {
      const r = M.parseLine(l);
      if (!r) return;
      if (r.error) { problems.push({ line: i + 1, msg: r.error }); return; }
      if (r.leader !== undefined) { leader = r.leader; return; }
      if (r.warn) problems.push({ line: i + 1, msg: r.tag + ': ' + r.warn });
      delete r.warn; rec.fields.push(r);
    });
    rec.leader = leader || rec.leader || M.defaultLeader(rec.format);
    if (!M.getFirst(rec, '008')) rec.fields.unshift({ tag: '008', value: M.default008(rec.format) });
    rec.updatedAt = new Date().toISOString();
    return { record: rec, problems };
  };

  // style: 'kormarc' (245 10▼a…, 공백=blankChar) | 'marcedit' (=245  10$a…, 공백=\)
  M.toBreaker = (rec, opts) => {
    opts = Object.assign({ style: rec.format === 'MARC21' ? 'marcedit' : 'kormarc', blank: '#', leader: true }, opts || {});
    const me = opts.style === 'marcedit';
    const delim = me ? '$' : '▼';
    const blank = me ? '\\' : (opts.blank || '#');
    const b = (c) => (c === ' ' || c === '' || c == null) ? blank : c;
    const out = [];
    if (opts.leader !== false) out.push(me ? '=LDR  ' + rec.leader : '000 ' + rec.leader);
    rec.fields.forEach(f => {
      if (M.isControl(f.tag)) { out.push(me ? '=' + f.tag + '  ' + (f.value || '').replace(/ /g, blank === '\\' ? '\\' : ' ') : f.tag + ' ' + (f.value || '')); return; }
      const subs = (f.subfields || []).map(s => delim + s.code + s.value).join('');
      out.push(me ? '=' + f.tag + '  ' + b(f.ind1) + b(f.ind2) + subs : f.tag + ' ' + b(f.ind1) + b(f.ind2) + subs);
    });
    return out.join('\n');
  };
  // 한 필드를 보기 좋게(목록 표시용)
  M.fieldToText = (f, format) => {
    const delim = format === 'MARC21' ? '$' : '▼';
    if (M.isControl(f.tag)) return f.value || '';
    return (f.subfields || []).map(s => delim + s.code + s.value).join('');
  };

  /* ---------- UTF-8 (환경 독립) ---------- */
  M.utf8Encode = (str) => {
    if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(str);
    const out = []; for (let i = 0; i < str.length; i++) {
      let c = str.codePointAt(i); if (c > 0xffff) i++;
      if (c < 0x80) out.push(c); else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
      else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
      else out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    } return Uint8Array.from(out);
  };
  M.utf8Decode = (bytes) => {
    if (typeof TextDecoder !== 'undefined') return new TextDecoder('utf-8').decode(bytes);
    let s = ''; for (let i = 0; i < bytes.length;) {
      const b = bytes[i++]; let c;
      if (b < 0x80) c = b; else if (b < 0xe0) c = ((b & 31) << 6) | (bytes[i++] & 63);
      else if (b < 0xf0) c = ((b & 15) << 12) | ((bytes[i++] & 63) << 6) | (bytes[i++] & 63);
      else { c = ((b & 7) << 18) | ((bytes[i++] & 63) << 12) | ((bytes[i++] & 63) << 6) | (bytes[i++] & 63); }
      s += String.fromCodePoint(c);
    } return s;
  };

  /* ---------- ISO 2709 ---------- */
  const FT = 0x1e, RT = 0x1d, SF = 0x1f;
  // 레코드 → Uint8Array
  M.toISO2709 = (rec) => {
    const dirParts = [], dataParts = []; let pos = 0;
    rec.fields.forEach(f => {
      let bytes;
      if (M.isControl(f.tag)) bytes = M.utf8Encode(f.value || '');
      else {
        const s = (f.ind1 || ' ').charAt(0) + (f.ind2 || ' ').charAt(0) + (f.subfields || []).map(x => String.fromCharCode(SF) + x.code + x.value).join('');
        bytes = M.utf8Encode(s);
      }
      const len = bytes.length + 1;
      dirParts.push(f.tag + M.lpad(len, 4) + M.lpad(pos, 5));
      dataParts.push(bytes); pos += len;
    });
    const directory = M.utf8Encode(dirParts.join('') + String.fromCharCode(FT));
    const base = 24 + directory.length;
    const total = base + pos + 1;
    let leader = M.pad(rec.leader || M.defaultLeader(rec.format), 24);
    leader = M.lpad(total, 5) + leader.slice(5, 9) + 'a22' + M.lpad(base, 5) + leader.slice(17, 20) + '4500';
    const out = new Uint8Array(total); let o = 0;
    const put = (arr) => { out.set(arr, o); o += arr.length; };
    put(M.utf8Encode(leader)); put(directory);
    dataParts.forEach(bp => { put(bp); out[o++] = FT; });
    out[o++] = RT;
    return out;
  };
  M.recordsToISO2709 = (recs) => {
    const parts = recs.map(M.toISO2709); const n = parts.reduce((a, p) => a + p.length, 0);
    const out = new Uint8Array(n); let o = 0; parts.forEach(p => { out.set(p, o); o += p.length; }); return out;
  };
  // Uint8Array → [Record]. encoding: 'utf-8' | 'euc-kr' | 'auto'
  M.fromISO2709 = (bytes, format, encoding) => {
    const recs = []; let start = 0;
    const decodeWith = (enc, arr) => {
      if (enc === 'utf-8') return M.utf8Decode(arr);
      if (typeof TextDecoder !== 'undefined') { try { return new TextDecoder(enc).decode(arr); } catch (e) { return M.utf8Decode(arr); } }
      return M.utf8Decode(arr);
    };
    while (start < bytes.length) {
      let end = start; while (end < bytes.length && bytes[end] !== RT) end++;
      if (end - start < 24) break;
      const rb = bytes.subarray(start, end);
      const leader = String.fromCharCode.apply(null, Array.from(rb.subarray(0, 24)));
      const base = parseInt(leader.slice(12, 17), 10);
      let enc = encoding || 'auto';
      if (enc === 'auto') enc = leader.charAt(9) === 'a' ? 'utf-8' : (format === 'KORMARC' ? 'euc-kr' : 'utf-8');
      const rec = M.newRecord(format); rec.fields = []; rec.leader = leader;
      let d = 24;
      while (d + 12 <= base - 1 && rb[d] !== FT) {
        const entry = String.fromCharCode.apply(null, Array.from(rb.subarray(d, d + 12)));
        const tag = entry.slice(0, 3), len = parseInt(entry.slice(3, 7), 10), off = parseInt(entry.slice(7, 12), 10);
        let fb = rb.subarray(base + off, base + off + len);
        if (fb.length && fb[fb.length - 1] === FT) fb = fb.subarray(0, fb.length - 1);
        if (M.isControl(tag)) rec.fields.push({ tag, value: decodeWith(enc, fb) });
        else {
          const s = decodeWith(enc, fb);
          const ind1 = s.charAt(0) || ' ', ind2 = s.charAt(1) || ' ';
          const subfields = s.slice(2).split(String.fromCharCode(SF)).filter(Boolean).map(p => ({ code: p.charAt(0), value: p.slice(1) }));
          rec.fields.push({ tag, ind1, ind2, subfields });
        }
        d += 12;
      }
      recs.push(rec); start = end + 1;
    }
    return recs;
  };

  MS.Model = M;

  /* ---------- 자체 테스트 ---------- */
  MS.TESTS = MS.TESTS || { list: [], run() { const r = []; this.list.forEach(t => { try { const m = t.fn(); r.push((m === true ? 'PASS' : 'FAIL ' + m) + ' - ' + t.name); } catch (e) { r.push('ERROR ' + e + ' - ' + t.name); } }); return r.join('\n'); } };
  MS.TESTS.list.push({ name: 'breaker parse KORMARC', fn() {
    const { record } = M.parseBreaker('000 00000nam a2200000 c 4500\n008 251031s2024    ulk           000   kor  \n020  ▼a9788971803417▼g03470:▼c￦15000\n245 10▼a세종대왕 /▼d홍이섭 지음\n260  ▼a서울 :▼b한길사,▼c2024', 'KORMARC');
    const f = M.getFirst(record, '245');
    if (f.ind1 !== '1' || f.ind2 !== '0') return 'ind ' + f.ind1 + f.ind2;
    if (M.getSub(f, 'd') !== '홍이섭 지음') return 'sub d';
    const g = M.getFirst(record, '020'); if (g.ind1 !== ' ' || M.getSub(g, 'g') !== '03470:') return '020 ' + JSON.stringify(g);
    if (M.getFirst(record, '008').value.length !== 40) return '008 len';
    return true; } });
  MS.TESTS.list.push({ name: 'breaker parse MarcEdit', fn() {
    const { record } = M.parseBreaker('=LDR  00000nam a2200000 i 4500\n=008  251031s2024\\\\\\\\ko\\\\\\\\\\\\\\\\\\\\\\000\\0\\eng\\\\\n=245  10$aTitle /$cAuthor.\n=650  \\0$aSubject.', 'MARC21');
    const f = M.getFirst(record, '650'); if (f.ind1 !== ' ' || f.ind2 !== '0') return '650 ind [' + f.ind1 + f.ind2 + ']';
    if (M.getFirst(record, '008').value.charAt(15) !== 'k') return '008 blank conv: ' + M.getFirst(record, '008').value;
    return true; } });
  MS.TESTS.list.push({ name: 'breaker round trip', fn() {
    const r = M.newRecord('KORMARC'); r.fields.push({ tag: '700', ind1: '1', ind2: ' ', subfields: [{ code: 'a', value: '김철수' }, { code: 'e', value: '옮김' }] });
    const t = M.toBreaker(r); const { record: r2 } = M.parseBreaker(t, 'KORMARC');
    return JSON.stringify(r.fields) === JSON.stringify(r2.fields) && r.leader === r2.leader ? true : t; } });
  MS.TESTS.list.push({ name: 'ISO2709 round trip (한글)', fn() {
    const r = M.newRecord('KORMARC'); r.fields.push({ tag: '245', ind1: '1', ind2: '0', subfields: [{ code: 'a', value: '한국의 도서관 :' }, { code: 'b', value: '역사와 현재 /' }, { code: 'd', value: '김영희 지음' }] });
    r.fields = r.fields.filter((f, i) => !(f.tag === '245' && i === 1));
    const bytes = M.toISO2709(r); const back = M.fromISO2709(bytes, 'KORMARC', 'utf-8');
    if (back.length !== 1) return 'count ' + back.length;
    const f = M.getFirst(back[0], '245'); if (M.getSub(f, 'd') !== '김영희 지음') return 'sub ' + JSON.stringify(f);
    if (parseInt(back[0].leader.slice(0, 5), 10) !== bytes.length) return 'len';
    return true; } });
})();
