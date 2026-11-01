/* MARC 스튜디오 — 기술 형식 보기 (KCR4 / ISBD 기술문 + 표목)
 * MS.Describe.build(record) → { heading, areas:[{label,text}], notes:[{label,text}], standard:[], series:[], tracing:{subjects:[], added:[]}, callno:[] }
 * 구두점은 레코드에 이미 기록된 ISBD 구두점(앞 식별기호 끝)을 그대로 쓰고, 식별기호 사이에 빈칸 하나를 둔다.
 */
window.MS = window.MS || {};
(function () {
  const D = {};
  const Mo = () => MS.Model;
  const join = (f, codes, noCtrl) => (f.subfields || []).filter(s => (!codes || codes.indexOf(s.code) >= 0) && !(noCtrl && /[0-9]/.test(s.code))).map(s => String(s.value || '').trim()).filter(Boolean).join(' ').replace(/\s+/g, ' ').replace(/\s+([,.])(\s|$)/g, '$1$2');
  const SUBJ_SUBDIV = { v: ' -- ', x: ' -- ', y: ' -- ', z: ' -- ' };
  const subjectText = (f) => (f.subfields || []).filter(s => !/^[0-9]$/.test(s.code)).map((s, i) => (i && SUBJ_SUBDIV[s.code] ? SUBJ_SUBDIV[s.code] : (i ? ' ' : '')) + String(s.value || '').trim()).join('').replace(/\s+/g, ' ');
  const nameText = (f) => join(f, 'abcdefgjklnpqtu'.split(''));
  const K_246 = { ' ': '', '0': '부분표제', '1': '대등표제', '2': '식별표제', '3': '기타표제', '4': '표지표제', '5': '부표제지표제', '6': '권두표제', '7': '난외표제', '8': '책등표제', '9': '원표제' };
  const M_246 = { ' ': '', '0': 'Portion of title', '1': 'Parallel title', '2': 'Distinctive title', '3': 'Other title', '4': 'Cover title', '5': 'Added title page title', '6': 'Caption title', '7': 'Running title', '8': 'Spine title' };
  const NOTE_LABEL = {
    KORMARC: { '505': { '0': '내용', '1': '불완전내용', '2': '부분내용', '8': '' }, '520': { ' ': '요약', '0': '주제', '1': '평론', '2': '범위와 내용', '3': '초록', '4': '해제', '8': '' }, '586': { ' ': '수상', '8': '' }, '521': { ' ': '이용대상자', '0': '독서 수준', '1': '대상 연령', '2': '대상 학년', '3': '특수 이용대상', '4': '동기유발 수준', '8': '' }, '538': { ' ': '시스템 사항' }, '530': { ' ': '이용가능한 다른 형태' }, '533': { ' ': '복제' }, '546': { ' ': '언어' }, '502': { ' ': '', '0': '', '1': '' }, '588': { ' ': '', '0': '기술의 정보원', '1': '' } },
    MARC21: { '505': { '0': 'Contents', '1': 'Incomplete contents', '2': 'Partial contents', '8': '' }, '520': { ' ': 'Summary', '0': 'Subject', '1': 'Review', '2': 'Scope and content', '3': 'Abstract', '4': 'Content advice', '8': '' }, '586': { ' ': 'Awards', '8': '' }, '521': { ' ': 'Audience', '8': '' }, '538': { ' ': 'System requirements' }, '530': { ' ': 'Additional physical form available' }, '533': { ' ': 'Reproduction' }, '546': { ' ': 'Language' }, '502': { ' ': '' }, '588': { ' ': '', '0': 'Description based on', '1': 'Latest issue consulted' } },
  };
  const roman = (n) => ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX'][n - 1] || String(n);

  const ATTR_LABEL = { '046': '연도', '368': '기타 속성', '370': '관련 장소', '371': '주소', '372': '활동분야', '373': '관련 단체', '374': '직업', '375': '성별', '376': '가족 정보', '377': '언어', '378': '이름의 완전형', '380': '저작의 형식', '381': '구별 특성', '382': '연주수단', '386': '창작자 특성', '387': '대표표현형', '388': '창작 기간' };
  const PLACE_LABEL = { a: '출생', b: '사망', c: '국가', e: '거주/본사', f: '기타', g: '원 생산지' };
  const DATE_LABEL = { f: '출생', g: '사망', k: '시작', l: '종료', q: '설립', r: '폐업', s: '시작시기', t: '종료시기' };
  D.buildAuth = (rec) => {
    const M = Mo();
    const out = { kind: 'auth', heading: '', headingTag: '', areas: [], notes: [], standard: [], series: [], tracing: { subjects: [], added: [] }, callno: [], refs: { see: [], seeAlso: [], links: [] } };
    const h = rec.fields.find(x => /^1\d\d$/.test(x.tag));
    if (h) { out.heading = join(h, null, true); out.headingTag = h.tag; }
    const nameOf = (f) => (f.subfields || []).filter(x => /[a-z]/.test(x.code) && !/[iw]/.test(x.code)).map(x => String(x.value || '').trim()).join(' ').replace(/\s+/g, ' ');
    const wText = (f) => { const w = M.getSub(f, 'w') || ''; const i = M.getSubs(f, 'i'); const parts = []; if (w.charAt(0) === 'a') parts.push('선행표목'); if (w.charAt(0) === 'b') parts.push('후속표목'); if (w.charAt(0) === 'g') parts.push('상위어'); if (w.charAt(0) === 'h') parts.push('하위어'); if (w.charAt(0) === 't') parts.push('직속 상위기관'); if (i.length) parts.push(i.join(' ')); return parts.length ? ' [' + parts.join(', ') + ']' : ''; };
    rec.fields.forEach(f => {
      if (/^4\d\d$/.test(f.tag)) out.refs.see.push(nameOf(f) + wText(f));
      else if (/^5\d\d$/.test(f.tag)) out.refs.seeAlso.push(nameOf(f) + wText(f));
      else if (/^7\d\d$/.test(f.tag)) { const src = { '0': 'LCSH', '1': 'LC 아동', '2': 'MeSH', '3': 'NAL', '4': '정보원 미상', '7': M.getSub(f, '2') || '▼2', '8': '국립중앙도서관' }[f.ind2] || ''; out.refs.links.push(nameOf(f) + (src ? ' (' + src + ')' : '')); }
      else if (f.tag === '046') out.areas.push({ label: ATTR_LABEL[f.tag], text: (f.subfields || []).filter(x => DATE_LABEL[x.code]).map(x => DATE_LABEL[x.code] + ' ' + x.value).join(' · ') });
      else if (f.tag === '370') out.areas.push({ label: ATTR_LABEL[f.tag], text: (f.subfields || []).filter(x => PLACE_LABEL[x.code]).map(x => PLACE_LABEL[x.code] + ' ' + x.value).join(' · ') + ((M.getSub(f, 's') || M.getSub(f, 't')) ? ' (' + (M.getSub(f, 's') || '') + '-' + (M.getSub(f, 't') || '') + ')' : '') });
      else if (ATTR_LABEL[f.tag]) out.areas.push({ label: ATTR_LABEL[f.tag], text: (f.subfields || []).filter(x => /^[a-dlq]$/.test(x.code)).map(x => x.value).join(', ') + ((M.getSub(f, 's') || M.getSub(f, 't')) ? ' (' + (M.getSub(f, 's') || '') + '-' + (M.getSub(f, 't') || '') + ')' : '') + (M.getSub(f, '2') ? ' [' + M.getSub(f, '2') + ']' : '') });
      else if (f.tag === '670') out.notes.push({ label: '정보원', text: join(f, ['a', 'b']) });
      else if (f.tag === '675') out.notes.push({ label: '정보원 없음', text: join(f, ['a']) });
      else if (f.tag === '678') out.notes.push({ label: f.ind1 === '1' ? '행정연혁' : '전기', text: join(f, ['a', 'b']) });
      else if (f.tag === '665') out.notes.push({ label: '연혁', text: join(f, ['a']) });
      else if (f.tag === '663' || f.tag === '664') out.notes.push({ label: f.tag === '663' ? '복합 도보라참조' : '복합 보라참조', text: join(f, null) });
      else if (f.tag === '680') out.notes.push({ label: '이용자 주기', text: join(f, null) });
      else if (f.tag === '667') out.notes.push({ label: '업무용 주기', text: join(f, ['a']) });
      else if (f.tag === '688') out.notes.push({ label: '변천', text: join(f, ['a']) });
      else if (f.tag === '024') out.standard.push((M.getSub(f, '2') || '식별자').toUpperCase() + ' ' + (M.getSub(f, 'a') || ''));
      else if (f.tag === '012' || f.tag === '001') out.standard.push('제어번호 ' + (f.value || M.getSub(f, 'a') || ''));
    });
    return out;
  };
  D.build = (rec) => {
    if (rec.format === 'KORMARC-AUTH') return D.buildAuth(rec);
    const K = rec.format !== 'MARC21';
    const M = Mo();
    const out = { heading: '', areas: [], notes: [], standard: [], series: [], tracing: { subjects: [], added: [] }, callno: [] };
    const f = (t) => M.getFields(rec, t);
    // 표목 (1XX)
    const main = rec.fields.find(x => /^1[013][01]$/.test(x.tag));
    if (main) out.heading = nameText(main);
    // 1. 표제와 책임표시사항 (245 + 246 ind1 0/1 은 주기)
    const t245 = M.getFirst(rec, '245');
    if (t245) out.areas.push({ label: K ? '표제와 책임표시사항' : 'Title and statement of responsibility', text: join(t245, 'abcdefghknpsx'.split('')) });
    const t240 = M.getFirst(rec, '240'); if (t240) out.areas.unshift({ label: K ? '통일표제' : 'Uniform title', text: '[' + join(t240) + ']' });
    // 2. 판사항
    f('250').forEach(x => out.areas.push({ label: K ? '판사항' : 'Edition', text: join(x, ['a', 'b']) }));
    // 3. 자료(또는 자원유형)특성사항
    ['255', '256', '362'].forEach(t => f(t).forEach(x => out.areas.push({ label: K ? '자료특성사항' : 'Material specific details', text: join(x) })));
    // 4. 발행사항
    const pub = f('260').concat(f('264').filter(x => x.ind2 === '1' || x.ind2 === ' ' || x.ind2 === '0' || x.ind2 === '2' || x.ind2 === '3'));
    pub.forEach(x => out.areas.push({ label: K ? '발행사항' : 'Publication, distribution, etc.', text: join(x, 'abcefg'.split('')) }));
    f('264').filter(x => x.ind2 === '4').forEach(x => out.areas.push({ label: K ? '저작권표시연도' : 'Copyright notice date', text: join(x, ['c']) }));
    // 5. 형태사항
    f('300').forEach(x => out.areas.push({ label: K ? '형태사항' : 'Physical description', text: join(x, 'abcefg'.split('')) }));
    // 6. 총서사항
    f('490').concat(f('440')).forEach(x => out.series.push('(' + join(x, 'avxlnp'.split('')) + ')'));
    // 7. 주기사항 (5XX, 246 주기)
    f('246').forEach(x => { if (x.ind1 === '0' || x.ind1 === '1') { const lbl = (K ? K_246 : M_246)[x.ind2] || ''; const i = M.getSub(x, 'i'); out.notes.push({ label: i ? i.replace(/:\s*$/, '') : lbl, text: join(x, 'abfgnp'.split('')) }); } });
    rec.fields.filter(x => /^5\d\d$/.test(x.tag)).forEach(x => {
      const tbl = NOTE_LABEL[K ? 'KORMARC' : 'MARC21'][x.tag]; let label = '';
      if (tbl) label = tbl[x.ind1] !== undefined ? tbl[x.ind1] : (tbl[' '] || '');
      out.notes.push({ label, text: join(x, null) });
    });
    // 8. 표준번호와 입수조건
    f('020').forEach(x => { const a = M.getSub(x, 'a'), c = M.getSub(x, 'c'), g = M.getSub(x, 'g'), q = M.getSubs(x, 'q'), z = M.getSubs(x, 'z');
      let s = 'ISBN ' + (a || '').trim() + (q.length ? ' ' + q.join(' ') : '') + (g ? ' ' + g.replace(/\s*:\s*$/, '') : '') + (x.ind1 === '1' && !/세트|set/i.test(a || '') ? (K ? ' (세트)' : ' (set)') : '');
      if (c) s += ' : ' + c.trim(); if (z.length) s += (K ? ' (취소 ' : ' (invalid ') + z.join(', ') + ')';
      out.standard.push(s.replace(/\s+/g, ' ')); });
    f('022').forEach(x => out.standard.push('ISSN ' + (M.getSub(x, 'a') || '')));
    // 분류·청구기호
    [['056', 'KDC'], ['082', 'DDC'], ['050', 'LCC'], ['080', 'UDC'], ['085', K ? '기타분류' : 'Other'], ['090', K ? '자관' : 'Local'], ['052', K ? 'NLK' : 'Geog.']].forEach(([t, lbl]) => f(t).forEach(x => { const a = M.getSubs(x, 'a').join(' '), b = M.getSub(x, 'b'), c = M.getSub(x, 'c'), ed = M.getSub(x, '2'); out.callno.push(lbl + ' ' + a + (b ? ' ' + b : '') + (c ? ' ' + c : '') + (ed && /^\d+$/.test(ed) ? ' (' + (K ? '제' + ed + '판' : 'ed. ' + ed) + ')' : '')); }));
    // 표목지시 (tracing): 주제명(아라비아 숫자), 부출표목(로마 숫자)
    rec.fields.filter(x => /^6\d\d$/.test(x.tag)).forEach(x => out.tracing.subjects.push(subjectText(x)));
    if (t245 && t245.ind1 !== '0' && main) out.tracing.added.push(K ? '표제' : 'Title');
    f('246').forEach(x => { if (x.ind1 === '1' || x.ind1 === '3') out.tracing.added.push((K ? '표제: ' : 'Title: ') + join(x, 'abfgnp'.split(''))); });
    rec.fields.filter(x => /^7[0-4]\d$/.test(x.tag)).forEach(x => out.tracing.added.push(nameText(x) + (M.getSub(x, 'e') && !/e/.test('abcdefgjklnpqtu') ? '' : '')));
    rec.fields.filter(x => /^8[013]\d$/.test(x.tag)).forEach(x => out.tracing.added.push((K ? '총서: ' : 'Series: ') + join(x, 'abcdfgklnpstv'.split(''))));
    rec.fields.filter(x => x.tag === '440').forEach(x => out.tracing.added.push((K ? '총서: ' : 'Series: ') + join(x, 'anpv'.split(''))));
    rec.fields.filter(x => x.tag === '130' && !main).forEach(() => {});
    out.tracing.added = out.tracing.added.map((s, i) => roman(i + 1) + '. ' + s);
    out.tracing.subjects = out.tracing.subjects.map((s, i) => (i + 1) + '. ' + s);
    return out;
  };
  D.joinAreas = (parts) => parts.filter(Boolean).reduce((acc, t) => acc ? acc + (/[.!?]$/.test(acc) ? ' -- ' : ' . -- ') + t : t, '');
  // 일반 텍스트(복사용)
  D.toText = (rec) => {
    const b = D.build(rec); const lines = [];
    if (b.kind === 'auth') {
      lines.push((b.headingTag ? b.headingTag + ' ' : '') + b.heading);
      b.areas.forEach(a => lines.push('  ' + a.label + ': ' + a.text));
      b.refs.see.forEach(x => lines.push('  ← 보라(이형): ' + x + '  → 다음으로 검색하시오: ' + b.heading));
      b.refs.seeAlso.forEach(x => lines.push('  ↔ 도보라: ' + x));
      b.refs.links.forEach(x => lines.push('  = 연관저록: ' + x));
      b.notes.forEach(n => lines.push('  ' + n.label + ': ' + n.text));
      b.standard.forEach(x => lines.push('  ' + x));
      return lines.join('\n');
    }
    if (b.heading) lines.push(b.heading);
    const body = D.joinAreas(b.areas.map(a => a.text).concat(b.series.length ? [b.series.join(' ')] : []));
    lines.push((b.heading ? '  ' : '') + body);
    b.notes.forEach(n => lines.push('  ' + (n.label ? n.label + ': ' : '') + n.text));
    b.standard.forEach(s => lines.push('  ' + s));
    if (b.tracing.subjects.length || b.tracing.added.length) lines.push('  ' + b.tracing.subjects.concat(b.tracing.added).join(' '));
    if (b.callno.length) lines.push('  [' + b.callno.join(' / ') + ']');
    return lines.join('\n');
  };
  MS.Describe = D;
  MS.TESTS = MS.TESTS || { list: [] };
  MS.TESTS.list.push({ name: 'describe KORMARC record', fn() { const ex = MS.EXERCISES.find(e => e.id === 'k03'); const rec = MS.Model.parseBreaker(ex.answer, ex.format).record; const b = D.build(rec); const t = D.toText(rec);
    if (!/자료조직론 : 분류와 목록의 이론과 실제 \/ 이정수, 박현아 공저/.test(t)) return 'title: ' + t; if (!/\(도서관학 총서 ; 12\)/.test(t)) return 'series: ' + t; if (!/ISBN 9788954600156 93020 : ￦32000/.test(t)) return 'isbn: ' + t; if (b.tracing.added.length !== 3) return 'tracing ' + JSON.stringify(b.tracing); return true; } });
})();
