/* MARC 스튜디오 — 검증 엔진
 * MS.Validate.run(record, opts) → issues[]  { level:'error'|'warning'|'info', tag, fi(필드 index), pos, code, msg }
 * opts: { isbd:true(ISBD 구두점 검사), order:true(태그 순서 권고) }
 */
window.MS = window.MS || {};
(function () {
  const M = () => MS.Model;
  const V = {};

  V.isbnValid = (raw) => {
    if (!raw) return false;
    const m = String(raw).trim().match(/^[\dXx][\dXx\- ]*/); if (!m) return false;
    const s = m[0].replace(/[\s\-]/g, '').toUpperCase();
    if (s.length === 10) { let t = 0; for (let i = 0; i < 9; i++) { if (!/\d/.test(s[i])) return false; t += (10 - i) * +s[i]; } const c = s[9] === 'X' ? 10 : +s[9]; return (t + c) % 11 === 0; }
    if (s.length === 13) { if (!/^\d{13}$/.test(s)) return false; let t = 0; for (let i = 0; i < 12; i++) t += +s[i] * (i % 2 ? 3 : 1); return (10 - t % 10) % 10 === +s[12]; }
    return false;
  };
  V.isbnDigits = (raw) => { const m = String(raw || '').trim().match(/^[\dXx][\dXx\- ]*/); return m ? m[0].replace(/[\s\-]/g, '').toUpperCase() : ''; };
  V.issnValid = (raw) => {
    const s = String(raw || '').trim().replace(/-/g, '').toUpperCase().slice(0, 8); if (!/^\d{7}[\dX]$/.test(s)) return false;
    let t = 0; for (let i = 0; i < 7; i++) t += +s[i] * (8 - i); const c = s[7] === 'X' ? 10 : +s[7]; return (t + c) % 11 === 0;
  };

  // 발행지 → KORMARC 지역부호 (008/15-17 교차검증용)
  const CITY_REGION = { '서울': 'ulk', '부산': 'bnk', '대구': 'tgk', '인천': 'ick', '대전': 'tjk', '울산': 'usk', '세종': 'sjk', '파주': 'ggk', '고양': 'ggk', '성남': 'ggk', '수원': 'ggk', '용인': 'ggk', '안양': 'ggk', '부천': 'ggk', '김포': 'ggk', '화성': 'ggk', '남양주': 'ggk', '의정부': 'ggk', '춘천': 'gak', '원주': 'gak', '강릉': 'gak', '청주': 'hbk', '충주': 'hbk', '천안': 'hck', '아산': 'hck', '공주': 'hck', '전주': 'jbk', '익산': 'jbk', '군산': 'jbk', '목포': 'jnk', '순천': 'jnk', '여수': 'jnk', '포항': 'gbk', '안동': 'gbk', '경산': 'gbk', '경주': 'gbk', '구미': 'gbk', '창원': 'gnk', '김해': 'gnk', '진주': 'gnk', '제주': 'jjk', '서귀포': 'jjk' };

  const lookupDef = (format, tag) => {
    const F = MS.FIELDS[format]; if (!F) return null;
    if (F[tag]) return F[tag];
    if (/^69\d$/.test(tag) && F['69X']) return F['69X'];
    if (/^9\d\d$/.test(tag) && F['9XX']) return F['9XX'];
    if (/^59\d$/.test(tag) && F['590']) return Object.assign({}, F['590'], { name: '로컬 주기' });
    return null;
  };
  V.lookupDef = lookupDef;

  const PERSON_PUNCT = { b: [','], c: [','], d: [','], e: [','], q: [' '] };

  V.run = (rec, opts) => {
    opts = Object.assign({ isbd: true, order: true }, opts || {});
    const fmt = rec.format === 'MARC21' ? 'MARC21' : rec.format === 'KORMARC-AUTH' ? 'KORMARC-AUTH' : 'KORMARC';
    const isAuth = fmt === 'KORMARC-AUTH';
    const K = fmt !== 'MARC21';
    const D = K ? '▼' : '$';
    const issues = [];
    const add = (level, tag, fi, msg, extra) => issues.push(Object.assign({ level, tag, fi, msg }, extra || {}));
    const Mo = M();

    /* ---- 리더 ---- */
    const leader = rec.leader || '';
    if (leader.length !== 24) add('error', '000', -1, `리더 길이가 ${leader.length}자입니다 (24자 필요).`);
    let isBook = true;
    MS.CODES.LEADER[fmt].forEach(p => {
      const v = leader.substr(p.pos, p.len);
      const label = `리더/${String(p.pos).padStart(2, '0')}${p.len > 1 ? '-' + String(p.pos + p.len - 1).padStart(2, '0') : ''} ${p.name}`;
      if (p.auto) { if (!/^\d+$/.test(v)) add('info', '000', -1, `${label}: 숫자여야 하며 저장 시 자동 계산됩니다 (현재 '${v}').`, { pos: p.pos }); return; }
      if (p.fixed) { if (v !== p.fixed) add('error', '000', -1, `${label}: 고정값 '${p.fixed}'이어야 합니다 (현재 '${v}').`, { pos: p.pos }); return; }
      if (p.codes && !(v in p.codes)) add('error', '000', -1, `${label}: '${v === ' ' ? '공백' : v}'은(는) 정의되지 않은 부호입니다. 허용: ${Object.keys(p.codes).map(c => c === ' ' ? '공백' : c).join(', ')}`, { pos: p.pos });
    });
    const l06 = leader.charAt(6), l07 = leader.charAt(7);
    if (isAuth) { isBook = false; if (l06 !== 'z') add('error', '000', -1, `전거레코드의 리더/06 레코드 유형은 z(전거데이터)여야 합니다 (현재 '${l06}').`, { pos: 6 }); }
    else if (!(/[at]/.test(l06) && /[acdm]/.test(l07))) {
      isBook = false;
      add('info', '000', -1, `리더/06='${l06}', /07='${l07}' → 도서(BK) 외 자료유형입니다. 008 위치별 검증은 도서(문자자료+단행자료 등)만 지원하므로 008은 길이만 검사합니다.`);
    }

    /* ---- 008 ---- */
    const f008s = Mo.getFields(rec, '008');
    const f008 = f008s[0];
    let lang008 = '', date1 = '', dtype = '', country = '';
    if (!f008) add('error', '008', -1, '008 부호화정보필드가 없습니다 (필수).');
    else {
      const fi = rec.fields.indexOf(f008);
      const v = f008.value || '';
      if (v.length !== 40) add('error', '008', fi, `008 길이가 ${v.length}자입니다 (40자 필요). 끝의 공백이 잘렸는지 확인하세요.`);
      const layout = isAuth ? MS.CODES.F008[fmt].AUTH : (isBook ? MS.CODES.F008[fmt].BK : null);
      if (layout) {
        layout.forEach(p => {
          const s = v.substr(p.pos, p.len);
          const label = `008/${String(p.pos).padStart(2, '0')}${p.len > 1 ? '-' + String(p.pos + p.len - 1).padStart(2, '0') : ''} ${p.name}`;
          const allowed = () => Object.keys(p.codes).map(c => c === ' ' ? '공백' : c).join(' ');
          switch (p.type) {
            case 'date6': if (!/^\d{6}$/.test(s)) add('error', '008', fi, `${label}: YYMMDD 6자리 숫자여야 합니다 (현재 '${s}').`, { pos: p.pos });
              else { const mm = +s.slice(2, 4), dd = +s.slice(4, 6); if (mm < 1 || mm > 12 || dd < 1 || dd > 31) add('error', '008', fi, `${label}: 월/일이 올바르지 않습니다 ('${s}').`, { pos: p.pos }); } break;
            case 'code': if (!(s in p.codes)) add('error', '008', fi, `${label}: '${s === ' ' ? '공백' : s}'은(는) 정의되지 않은 부호입니다. 허용: ${allowed()}`, { pos: p.pos }); if (p.pos === 6) dtype = s; break;
            case 'multi': {
              const bad = [...s].filter(c => !(c in p.codes));
              if (bad.length) add('error', '008', fi, `${label}: '${bad.join('')}'은(는) 정의되지 않은 부호입니다. 허용: ${allowed()}`, { pos: p.pos });
              const t = s.replace(/ /g, ''); if (t.length && s.indexOf(t) !== 0) add('info', '008', fi, `${label}: 부호는 왼쪽부터 채우고 남는 자리는 공백으로 둡니다 ('${s}').`, { pos: p.pos });
              if (p.len > 1 && t.length > 1 && t !== [...t].sort().join('')) add('info', '008', fi, `${label}: 부호가 둘 이상이면 알파벳순으로 기술합니다 ('${t}').`, { pos: p.pos });
              break; }
            case 'year': if (!/^(\d{4}|\d{1,3}u{1,3}|u{4}|\s{4}|\|{4}|\d{3}\s|9999)$/.test(s)) add('error', '008', fi, `${label}: 4자리 연도(불명 자리는 u) 또는 공백/채움문자여야 합니다 (현재 '${s}').`, { pos: p.pos });
              if (p.pos === 7) date1 = s; break;
            case 'country': { country = s; const tbl = MS.CODES.COUNTRY[fmt];
              const key3 = s, key2 = s.slice(0, 2);
              const ok = (key3 in tbl) || (s.charAt(2) === ' ' && key2 in tbl) || /^\|\|\|$/.test(s);
              if (!ok) add(/^[a-z]{2} $|^[a-z]{3}$/.test(s) ? 'warning' : 'error', '008', fi, `${label}: '${s}'은(는) 알 수 없는 발행국 부호입니다.`, { pos: p.pos });
              if (K && s === 'ko ') add('warning', '008', fi, `${label}: KORMARC에서 국내 발행 자료는 지역부호(ulk 서울, ggk 경기도 등)를 사용합니다.`, { pos: p.pos });
              if (!K && s in MS.CODES.KOREA_REGIONS) add('error', '008', fi, `${label}: MARC21에서 대한민국은 'ko ' 입니다 (지역부호는 KORMARC 전용).`, { pos: p.pos });
              break; }
            case 'lang': lang008 = s; if (!(s in MS.CODES.LANG) && !/^[a-z]{3}$/.test(s)) add('error', '008', fi, `${label}: '${s}'은(는) 언어부호 형식(소문자 3자)이 아닙니다.`, { pos: p.pos });
              else if (!(s in MS.CODES.LANG)) add('info', '008', fi, `${label}: '${s}'은(는) 내장 언어부호표에 없습니다 (ISO 639-2 확인).`, { pos: p.pos }); break;
            case 'univ': if (!/^(  |[A-Z]{2}|\|\|)$/.test(s)) add('warning', '008', fi, `${label}: 영문 대문자 2자리 또는 공백이어야 합니다 (현재 '${s}').`, { pos: p.pos }); break;
            case 'gov': if (!/^(  |[A-Za-z0-9]{2}|\|\|)$/.test(s)) add('warning', '008', fi, `${label}: 2자리 부호 또는 공백이어야 합니다 (현재 '${s}').`, { pos: p.pos }); break;
            case 'blank': if (!/^[ |]*$/.test(s)) add('error', '008', fi, `${label}: 미정의 위치이므로 공백이어야 합니다 (현재 '${s}').`, { pos: p.pos }); break;
          }
        });
        if (isBook) {
        // 발행년유형 ↔ 발행년 정합성
        const d2 = v.substr(11, 4);
        if (dtype === 's' && d2.trim() && d2 !== '||||') add('warning', '008', fi, `008/06='s'(단일연도)이면 발행년 2(11-14)는 공백이어야 합니다 (현재 '${d2}').`, { pos: 11 });
        if (/[mqtrpik]/.test(dtype) && !d2.trim()) add('warning', '008', fi, `008/06='${dtype}'이면 발행년 2(11-14)를 기술해야 합니다.`, { pos: 11 });
        if (dtype === 'n' && !/^u{4}$/.test(date1)) add('info', '008', fi, `008/06='n'(발행년불명)이면 발행년 1은 보통 'uuuu'입니다.`, { pos: 7 });
        if (dtype === 'b' && (date1.trim() || d2.trim())) add('warning', '008', fi, `008/06='b'(기원전)이면 발행년 1·2는 공백으로 둡니다.`, { pos: 7 });
        if (dtype === 's' && !/^\d{4}$|^\d{1,3}u+$/.test(date1)) add('warning', '008', fi, `008/06='s'이면 발행년 1(07-10)에 연도를 기술해야 합니다 (현재 '${date1}').`, { pos: 7 });
        }
      }
    }

    /* ---- 가변필드 ---- */
    const counts = {}; let mainEntries = 0, headings = 0, has1XX = false, has8XX = false, has490 = false, prevTag = '000', orderWarned = false;
    const tagsPresent = new Set(rec.fields.map(f => f.tag));
    rec.fields.forEach((f, fi) => {
      const tag = f.tag || '';
      if (!/^[0-9A-Za-z]{3}$/.test(tag)) { add('error', tag, fi, `태그 '${tag}'의 형식이 잘못되었습니다 (3자리).`); return; }
      if (!/^\d{3}$/.test(tag)) add('warning', tag, fi, `태그 '${tag}'은(는) 숫자가 아닙니다 (로컬 정의 태그가 아니면 오류).`);
      if (opts.order && !orderWarned && tag < prevTag) { add('info', tag, fi, `태그가 오름차순이 아닙니다 (${prevTag} 뒤에 ${tag}). 정렬 버튼으로 정리할 수 있습니다.`); orderWarned = true; }
      prevTag = tag;
      counts[tag] = (counts[tag] || 0) + 1;
      const def = lookupDef(fmt, tag);
      const isCtl = Mo.isControl(tag);
      if (isCtl) {
        if (f.subfields) add('error', tag, fi, `${tag} 제어필드에는 지시기호·식별기호를 사용하지 않습니다.`);
        if (tag === '005' && f.value && !/^\d{14}\.\d$/.test(f.value)) add('warning', tag, fi, `005 형식은 YYYYMMDDHHMMSS.F (16자)입니다.`);
        if (tag === '001' && !String(f.value || '').trim()) add('error', tag, fi, '001 제어번호가 비어 있습니다.');
        if (def && !def.rep && counts[tag] > 1) add('error', tag, fi, `${tag}은(는) 반복할 수 없습니다.`);
        return;
      }
      if (!def) { add('warning', tag, fi, `${tag}: 정의되지 않은 태그입니다 (자관 로컬 필드가 아니라면 확인).`); }
      else {
        if (def.obsolete) add('warning', tag, fi, `${tag} ${def.name}: ${def.obsolete}`);
        if (!def.rep && counts[tag] > 1) add('error', tag, fi, `${tag} ${def.name}은(는) 반복할 수 없습니다 (${counts[tag]}번째).`);
        if (def.mainEntry) { mainEntries++; has1XX = true; if (mainEntries > 1) add('error', tag, fi, `기본표목(1XX)은 레코드에 하나만 둘 수 있습니다.`); }
        if (def.heading) { headings++; if (headings > 1) add('error', tag, fi, `전거레코드의 표목(1XX)은 하나만 둘 수 있습니다.`); }
      }
      if (/^8[013]\d$/.test(tag)) has8XX = true;
      if (tag === '490') has490 = true;
      if (f.value !== undefined && !f.subfields) { add('error', tag, fi, `${tag}은(는) 제어필드가 아니므로 지시기호와 식별기호가 필요합니다.`); return; }
      // 지시기호
      const checkInd = (n, val, idef) => {
        val = (val == null || val === '') ? ' ' : String(val);
        if (val.length !== 1) { add('error', tag, fi, `${tag} 제${n}지시기호는 1자여야 합니다 (현재 '${val}').`); return; }
        if (idef === undefined) return; // 이름만 알고 있는 필드
        if (idef === null) { if (val !== ' ') add('error', tag, fi, `${tag} 제${n}지시기호는 미정의이므로 공백이어야 합니다 (현재 '${val}').`); return; }
        if (!(val in idef.c)) add('error', tag, fi, `${tag} 제${n}지시기호 '${val === ' ' ? '공백' : val}'은(는) 정의되지 않은 값입니다. ${idef.n}: ${Object.keys(idef.c).map(c => (c === ' ' ? '공백' : c) + '=' + idef.c[c]).join(' / ')}`);
      };
      if (def && !def.anySubs) { checkInd(1, f.ind1, def.ind1); checkInd(2, f.ind2, def.ind2); }
      // 식별기호
      const subs = f.subfields || [];
      if (!subs.length) { add('error', tag, fi, `${tag}: 식별기호가 하나도 없습니다.`); return; }
      const scount = {};
      subs.forEach((s, si) => {
        const code = s.code || '';
        if (!/^[0-9a-z]$/.test(code)) { add('error', tag, fi, `${tag}: 식별기호 코드 '${code}'이(가) 잘못되었습니다 (소문자/숫자 1자).`, { si }); return; }
        scount[code] = (scount[code] || 0) + 1;
        if (!String(s.value || '').trim()) add('error', tag, fi, `${tag} ${D}${code}: 내용이 비어 있습니다.`, { si });
        if (def && def.sub && !def.anySubs) {
          const sd = def.sub[code];
          if (!sd) {
            if (def.forbiddenSubs && def.forbiddenSubs[code]) add('error', tag, fi, `${tag} ${D}${code}: ${def.forbiddenSubs[code]}`, { si });
            else if (def.obsoleteSubs && def.obsoleteSubs[code]) add('warning', tag, fi, `${tag} ${D}${code}: 폐기된 식별기호입니다 (${def.obsoleteSubs[code]}).`, { si });
            else add('error', tag, fi, `${tag} ${D}${code}: 정의되지 않은 식별기호입니다. 허용: ${Object.keys(def.sub).sort((x, y) => (/\d/.test(x) - /\d/.test(y)) || x.localeCompare(y)).map(c => D + c).join(' ')}`, { si });
          } else if (!sd.rep && scount[code] > 1) add('error', tag, fi, `${tag} ${D}${code} ${sd.name}은(는) 반복할 수 없습니다.`, { si });
        }
      });
      if (def && def.mandatorySubs) def.mandatorySubs.forEach(c => { if (!scount[c]) add('error', tag, fi, `${tag}: 필수 식별기호 ${D}${c}이(가) 없습니다.`); });
      // ISBD 구두점
      if (opts.isbd && def && (def.punct || (!isAuth && /^[1678]00$/.test(tag)))) {
        const punct = def.punct || PERSON_PUNCT;
        for (let i = 1; i < subs.length; i++) {
          const cur = subs[i], prev = subs[i - 1]; const rule = punct[cur.code];
          if (!rule || !rule.length) continue;
          const pv = String(prev.value || ''); const pvT = pv.replace(/\s+$/, '');
          const okAny = rule.some(r => pvT.endsWith(r.trim()) || pvT.endsWith(r));
          const curStarts = rule.some(r => String(cur.value || '').trimStart().startsWith(r.trim()));
          if (curStarts) add('warning', tag, fi, `${tag} ${D}${cur.code}: 구두점 '${rule[0].trim()}'은(는) 앞 식별기호(${D}${prev.code}) 끝에 붙입니다 (예: '…${rule[0]}${D}${cur.code}…').`, { si: i });
          else if (!okAny) add('warning', tag, fi, `${tag} ${D}${cur.code} 앞에는 '${rule.join("' 또는 '")}'이(가) 옵니다. ${D}${prev.code}의 끝: '…${pvT.slice(-6)}'`, { si: i });
          else { const r = rule.find(r => pvT.endsWith(r.trim())); if (r && r.startsWith(' ') && !pvT.endsWith(r) && pvT.length > r.trim().length) add('info', tag, fi, `${tag} ${D}${cur.code}: '${r.trim()}' 앞에 한 칸 띄어 씁니다 ('${r}').`, { si: i }); }
        }
      }
      /* ---- 태그별 규칙 ---- */
      if (tag === '020') {
        const a = Mo.getSub(f, 'a');
        if (a != null) { if (!V.isbnValid(a)) add('error', tag, fi, `020 ${D}a: ISBN '${V.isbnDigits(a) || a}'의 체크디지트가 맞지 않거나 형식이 잘못되었습니다 (10자리 또는 13자리, 붙임표 없이).`); else if (/-/.test(a)) add('info', tag, fi, `020 ${D}a: ISBN은 붙임표 없이 입력합니다 (출력 시 시스템이 생성).`); }
        const g = Mo.getSub(f, 'g');
        if (K) {
          if (g != null && !/^\d{5}/.test(g)) add('error', tag, fi, `020 ${D}g 부가기호는 5자리 숫자입니다 (현재 '${g}').`);
          const digits = V.isbnDigits(a || '');
          if (g == null && /^(97889|97911)/.test(digits)) add('info', tag, fi, `020: 국내 발행 ISBN(978-89/979-11)에는 ${D}g 부가기호(5자리)를 기술합니다.`);
          const c = Mo.getSub(f, 'c'); if (c != null && !/[₩￦]|원/.test(c)) add('info', tag, fi, `020 ${D}c 입수조건(가격): 통화기호를 포함합니다 (예: ￦15000).`);
        }
      }
      if (tag === '022') { const a = Mo.getSub(f, 'a'); if (a != null && !V.issnValid(a)) add('error', tag, fi, `022 ${D}a: ISSN '${a}'의 체크디지트가 맞지 않습니다.`); }
      if (tag === '245') {
        const h = Mo.getSub(f, 'h'); if (h != null && !/^\s*\[.*\]\s*[\/:;=]?\s*$/.test(h)) add('warning', tag, fi, `245 ${D}h 자료유형표시는 각괄호로 묶습니다 (예: [전자자료]).`);
        if (K) { const last = subs[subs.length - 1]; const lv = String(last.value || '').trim(); if (/[.]$/.test(lv) && !/(\b[A-Za-z]{1,4}|[가-힣]{1})\.$/.test(lv) && !/\.\.\.$/.test(lv)) add('info', tag, fi, `KORMARC 245는 약어·두문자 외에는 필드 끝에 구두점을 붙이지 않습니다 ('${lv.slice(-10)}').`); }
        else { const last = subs[subs.length - 1]; const lv = String(last.value || '').trim(); if (lv && !/[.)\]!?]$/.test(lv)) add('info', tag, fi, `MARC21(AACR2) 245는 보통 마침표로 끝납니다.`); }
      }
      if ((tag === '100' || tag === '700' || tag === '600' || tag === '800') && def && def.ind1) {
        const a = String(Mo.getSub(f, 'a') || '').trim();
        if (K && /^[가-힣]{2,5},?$/.test(a) && f.ind1 !== '1') add('info', tag, fi, `${tag}: 한국인 이름 '${a}'은(는) 성으로 시작하므로 제1지시기호 1을 사용합니다 (예: 100 1 ${D}a이청준).`);
        if (/,\s*\S/.test(a) && f.ind1 === '0') add('info', tag, fi, `${tag}: '${a}'처럼 쉼표로 성·이름을 도치한 형태는 제1지시기호 1(성으로 시작)입니다.`);
      }
      if (tag === '041') {
        const h = Mo.getSubs(f, 'h'), a = Mo.getSubs(f, 'a');
        if (f.ind1 === '1' && !h.length) add('warning', tag, fi, `041 제1지시기호 1(번역물)이면 ${D}h 원저작의 언어를 기술합니다.`);
        if (f.ind1 === '0' && h.length) add('warning', tag, fi, `041 ${D}h(원저작 언어)가 있으면 제1지시기호는 1(번역물)입니다.`);
        if (lang008 && a.length && a[0] !== lang008 && lang008.trim()) add('warning', tag, fi, `041 ${D}a 첫 언어 '${a[0]}'와 008/35-37 언어 '${lang008}'가 다릅니다.`);
        a.concat(h).forEach(c => { if (!/^[a-z]{3}$/.test(c)) add('error', tag, fi, `041: 언어부호 '${c}'은(는) 소문자 3자여야 합니다.`); });
      }
      if ((tag === '260' || (tag === '264' && f.ind2 === '1')) && isBook) {
        const c = Mo.getSub(f, 'c'); const y = c && (c.match(/\d{4}/) || [])[0];
        if (y && /^\d{4}$/.test(date1) && y !== date1) add('warning', tag, fi, `${tag} ${D}c 발행년 '${y}'와 008/07-10 발행년 1 '${date1}'이 다릅니다.`);
        const a = Mo.getSub(f, 'a');
        if (K && a && country) { const city = Object.keys(CITY_REGION).find(cty => a.indexOf(cty) >= 0); if (city && CITY_REGION[city] !== country && !(city === '광주' && country === 'ggk')) add('warning', tag, fi, `${tag} ${D}a 발행지 '${city}'의 지역부호는 '${CITY_REGION[city]}'인데 008/15-17은 '${country}'입니다.`); }
      }
      if (tag === '300') {
        const a = Mo.getSub(f, 'a'); if (a && !/\d/.test(a)) add('info', tag, fi, `300 ${D}a: 수량(면수·장수·책수)에 숫자가 없습니다 ('${a}').`);
        if (a && K && /\d\s*p\s*$/.test(a.trim())) add('info', tag, fi, `300 ${D}a: 면수 약어는 'p.' (마침표 포함) 입니다.`);
        const c = Mo.getSub(f, 'c'); if (c && !/\d+\s*(cm|mm|㎜|㎝)\.?\s*\+?\s*$/.test(c.trim())) add('warning', tag, fi, `300 ${D}c 크기는 'NN cm' 형식입니다 (현재 '${c}').`);
        if (c && /cm\.\s*\+?$/.test(c.trim())) add('info', tag, fi, `300 ${D}c: 'cm'은 기호이므로 마침표를 붙이지 않습니다.`);
      }
      if (def && def.ind2 && def.ind2.n && /주제명표|Thesaurus/.test(def.ind2.n)) {
        const s2 = Mo.getSub(f, '2');
        if (f.ind2 === '7' && s2 == null) add('error', tag, fi, `${tag} 제2지시기호 7이면 ${D}2에 주제명표/시소러스 명칭을 기술해야 합니다.`);
        if (f.ind2 !== '7' && s2 != null) add('warning', tag, fi, `${tag} ${D}2는 제2지시기호가 7일 때 사용합니다.`);
      }
      if (isAuth && def && def.w) {
        const w = Mo.getSub(f, 'w'), tbl = MS.AUTH_W[def.w.kind];
        if (w != null) {
          if (w.length > tbl.length) add('error', tag, fi, `${tag} ▼w 제어 식별기호는 최대 ${tbl.length}자리입니다 (현재 '${w}').`);
          [...w].slice(0, tbl.length).forEach((c, i) => { if (c !== '|' && !(c in tbl[i].codes)) add('error', tag, fi, `${tag} ▼w${tbl[i].name}: '${c}'은(는) 정의되지 않은 부호입니다. 허용: ${Object.keys(tbl[i].codes).map(k => k + '=' + tbl[i].codes[k]).join(', ')}`); });
          if (def.w.kind === 'ref' && /^[ri]/.test(w) && Mo.getSub(f, 'i') == null) add('warning', tag, fi, `${tag} ▼w/0 '${w.charAt(0)}'이면 ▼i에 ${w.charAt(0) === 'r' ? '관계표시(예: 필명, 본명)' : '참조어구'}를 기술합니다.`);
        } else if (def.w.kind === 'ref' && Mo.getSub(f, 'i') != null) add('info', tag, fi, `${tag} ▼i를 썼으면 보통 ▼w/0에 r(관계표시) 또는 i(참조어구)를 둡니다 (예: ▼wr▼i필명▼a…).`);
        if (tag === '377') {}
      }
      if (isAuth && tag === '377') Mo.getSubs(f, 'a').forEach(c => { if (!/^[a-z]{3}$/.test(c)) add('error', tag, fi, `377 ▼a 언어 부호 '${c}'은(는) 소문자 3자여야 합니다.`); });
      if (tag === '856') { const u = Mo.getSubs(f, 'u'); if (!u.length) add('warning', tag, fi, `856에는 보통 ${D}u URI를 기술합니다.`); u.forEach(x => { if (!/^(https?|ftp):\/\//i.test(x)) add('warning', tag, fi, `856 ${D}u '${x.slice(0, 40)}'은(는) URI 형식이 아닙니다.`); }); if (f.ind1 === '4' && u.some(x => !/^https?:/i.test(x))) add('info', tag, fi, '856 제1지시기호 4(HTTP)는 http(s) URI와 함께 사용합니다.'); }
      if (tag === '490' && f.ind1 === '1' && !/^8[013]\d$/.test('') ) { /* 8XX 검사는 아래 교차검증에서 */ }
    });

    /* ---- 교차 검증 ---- */
    const has = (t) => tagsPresent.has(t);
    if (isAuth) V.authCrossChecks(rec, add, Mo, headings, f008 ? f008.value : '');
    else {
    const f245 = Mo.getFirst(rec, '245');
    if (!f245) add('error', '245', -1, '245 표제와 책임표시사항이 없습니다 (필수).');
    else {
      const fi = rec.fields.indexOf(f245);
      if (has1XX && f245.ind1 === '0') add('warning', '245', fi, '기본표목(1XX)이 있으면 245 제1지시기호는 1(표제를 부출함)입니다.');
      if (!has1XX && f245.ind1 === '1') add('info', '245', fi, K ? '1XX 기본표목이 없으면(KCR4: 표제가 기본표목) 245 제1지시기호는 0(표제를 부출하지 않음)입니다.' : '1XX가 없으면(표제 기본표목) 245 제1지시기호는 0입니다.');
      if (!K && f245.ind1 === '2') add('error', '245', fi, 'MARC21 245 제1지시기호는 0 또는 1입니다 (2는 KORMARC 전용).');
    }
    if (isBook) {
      if (has('260') && has('264')) add('warning', '264', -1, '260과 264를 함께 사용했습니다. 보통 하나만 사용합니다 (KCR4 전통 기술은 260, RDA는 264).');
      if (!has('260') && !has('264')) add('warning', '260', -1, '발행사항(260 또는 264)이 없습니다.');
      if (!has('300')) add('warning', '300', -1, '300 형태사항이 없습니다.');
      if (!has('020')) add('info', '020', -1, '020 ISBN이 없습니다 (도서는 보통 기술).');
      if (!['050', '052', '056', '080', '082', '085', '090'].some(has)) add('info', '056', -1, K ? '분류기호(056 KDC, 082 DDC, 090 자관청구기호 등)가 없습니다.' : '분류기호(050 LCC, 082 DDC 등)가 없습니다.');
      if (!has('040')) add('info', '040', -1, '040 목록작성기관이 없습니다 (KORMARC: 필수 권장).');
    }
    const f490s = Mo.getFields(rec, '490');
    f490s.forEach(f => { const fi = rec.fields.indexOf(f);
      if (f.ind1 === '1' && !has8XX) add('warning', '490', fi, '490 제1지시기호 1(총서를 부출함)이면 800-830 총서부출표목이 있어야 합니다.');
      if (f.ind1 === '0' && has8XX) add('warning', '490', fi, '8XX 총서부출표목이 있으면 490 제1지시기호는 1입니다.'); });
    if (has8XX && !has490) add('info', '830', -1, '8XX 총서부출표목만 있고 490 총서사항이 없습니다.');
    const f008v = f008 ? f008.value : '';
    if (isBook && f008v && has('600') && f008v.charAt(34) === ' ') add('info', '008', -1, '600 개인명 주제가 있습니다. 전기 자료라면 008/34 전기 부호를 검토하세요.');
    if (isBook && f008v && K && (has('502')) && f008v.substr(24, 2).indexOf('m') < 0) add('info', '008', -1, '502 학위논문주기가 있습니다. 008/24-25 내용형식에 m(학위논문) 검토.');
    if (isBook && f008v && !K && has('502') && f008v.substr(24, 4).indexOf('m') < 0) add('info', '008', -1, '502 Dissertation note present: consider 008/24-27 code m (Theses).');
    if (isBook && f008v && has('504') && !/b/.test(K ? f008v.substr(24, 2) : f008v.substr(24, 4))) add('info', '008', -1, '504 서지주기가 있습니다. 008 내용형식 b(서지) 검토.');
    if (isBook && f008v && has('504') === false && /b/.test(K ? f008v.substr(24, 2) : f008v.substr(24, 4))) add('info', '504', -1, '008 내용형식에 b(서지)가 있으나 504 서지등주기가 없습니다.');
    if (isBook && f008v && f008v.charAt(31) === '1' && !rec.fields.some(f => /^50[04]$/.test(f.tag) && /색인|index/i.test(Mo.fieldToText(f)))) add('info', '008', -1, '008/31 색인=1 이면 500/504 주기에 색인 수록을 기술하는 것이 보통입니다.');

    }
    const order = { error: 0, warning: 1, info: 2 };
    issues.sort((a, b) => order[a.level] - order[b.level] || (a.fi - b.fi));
    return issues;
  };
  V.authCrossChecks = (rec, add, Mo, headings, v008) => {
    const heading = rec.fields.find(f => /^1\d\d$/.test(f.tag));
    if (!heading) { add('error', '100', -1, '전거레코드에는 1XX 표목이 하나 있어야 합니다 (100 개인명, 110 단체명, 130 통일표제, 150 일반주제명 등).'); return; }
    const norm = (s) => String(s || '').replace(/[\s,.]/g, '').toLowerCase();
    const hText = norm((heading.subfields || []).filter(x => /[a-z]/.test(x.code)).map(x => x.value).join(''));
    const refs = rec.fields.filter(f => /^[45]\d\d$/.test(f.tag));
    refs.forEach(f => { const t = norm((f.subfields || []).filter(x => /[a-z]/.test(x.code) && x.code !== 'i').map(x => x.value).join('')); if (t && t === hText) add('warning', f.tag, rec.fields.indexOf(f), `${f.tag}의 이름이 1XX 채택표목과 같습니다. 보라/도보라부출에는 채택형과 다른 형식을 둡니다.`); });
    refs.forEach(f => { const want = heading.tag.slice(1); if (!f.tag.endsWith(want) && /^(00|10|11|30|50|51)$/.test(want) && /^(00|10|11|30|50|51)$/.test(f.tag.slice(1)) && f.tag.charAt(0) === '4') add('info', f.tag, rec.fields.indexOf(f), `보라부출(4XX)은 보통 1XX와 같은 표목 유형입니다 (1${want} ↔ 4${want}). 다른 유형의 이형이면 그대로 두어도 됩니다.`); });
    if (!rec.fields.some(f => f.tag === '670' || f.tag === '675')) add('info', '670', -1, '670 정보원 주기가 없습니다. 첫 번째 670에는 표목을 채택한 근거 자료(정보원)를 기술합니다.');
    const kind = v008.charAt(9);
    if (kind === 'b' && refs.some(f => f.tag.charAt(0) === '4')) add('warning', '008', -1, "008/09 'b'(참조표목 레코드—보라부출 없음)인데 4XX가 있습니다. 보라부출이 있으면 'c'.");
    if (/^[bcg]$/.test(kind) && !rec.fields.some(f => /^(260|664|666)$/.test(f.tag))) add('info', '008', -1, `008/09 '${kind}'(참조표목 레코드)는 보통 260·664·666 참조주기로 채택표목을 안내합니다.`);
    if (kind === 'a' && heading.tag === '150' && v008.charAt(11) === 'n') add('info', '008', -1, '주제명 표목(150)이면 008/11 주제명표목표(예: k 국립중앙도서관 주제명표목표)를 기술합니다.');
    if (heading.tag === '100') {
      const d = Mo.getSub(heading, 'd') || ''; const f046 = Mo.getFirst(rec, '046');
      if (f046) { const b = Mo.getSub(f046, 'f'), g = Mo.getSub(f046, 'g'); const m = d.match(/(\d{4})\s*-\s*(\d{4})?/);
        if (m && b && m[1] !== b.slice(0, 4)) add('warning', '046', rec.fields.indexOf(f046), `046 ▼f 출생일 '${b}'와 100 ▼d '${d}'의 출생년이 다릅니다.`);
        if (m && g && m[2] && m[2] !== g.slice(0, 4)) add('warning', '046', rec.fields.indexOf(f046), `046 ▼g 사망일 '${g}'와 100 ▼d '${d}'의 사망년이 다릅니다.`); }
      if (v008.charAt(32) === 'n') add('info', '008', -1, "개인명 표목이면 008/32 동명이인은 a(한 사람만 사용) 또는 b(두 사람 이상)입니다.");
    } else if (v008.charAt(32) !== 'n' && v008.charAt(32) !== '|') add('info', '008', -1, "개인명이 아닌 표목이면 008/32 동명이인은 n(적용불가)입니다.");
    if (/^1[01][01]$/.test(heading.tag) === false && heading.tag !== '130' && v008.charAt(14) === 'a' && /^1(50|51|55|48)$/.test(heading.tag)) add('info', '008', -1, '주제 표목(15X)은 보통 008/14 기본표목/부출표목 사용 b(사용불가), 008/15 주제명부출표목 a(사용가능)입니다.');
  };
  V.summary = (issues) => ({ error: issues.filter(i => i.level === 'error').length, warning: issues.filter(i => i.level === 'warning').length, info: issues.filter(i => i.level === 'info').length });

  MS.Validate = V;

  MS.TESTS = MS.TESTS || { list: [] };
  MS.TESTS.list.push({ name: 'isbn/issn', fn() { return V.isbnValid('9788971803417') && V.isbnValid('0870686933') && !V.isbnValid('9788971803418') && V.issnValid('0749-470X') ? true : 'checksum'; } });
  MS.TESTS.list.push({ name: 'validate clean KORMARC record', fn() {
    const { record } = MS.Model.parseBreaker(['000 00000nam a2200000 c 4500', '008 251031s2024    ulka          000   kor  ', '020  ▼a9788971803417▼g03470:▼c￦15000', '040  ▼a011001▼c011001', '056  ▼a813.7▼26', '245 00▼a세종대왕 /▼d홍이섭 지음', '260  ▼a서울 :▼b한길사,▼c2024', '300  ▼a327 p. :▼b삽화 ;▼c23 cm', '700 1 ▼a홍이섭'].join('\n'), 'KORMARC');
    const is = V.run(record); const e = is.filter(i => i.level !== 'info'); return e.length ? e.map(i => i.msg).join(' | ') : true; } });
  MS.TESTS.list.push({ name: 'validate catches errors', fn() {
    const { record } = MS.Model.parseBreaker(['008 251031s2024    ko           000  kor  ', '020  ▼a9788971803418', '245 10▼a표제 /▼c저자', '245 10▼a둘째', '650  8▼a주제▼2nlsh'].join('\n'), 'KORMARC');
    const is = V.run(record); const msgs = is.map(i => i.msg).join(' | ');
    const want = ['체크디지트', '▼c', '반복할 수 없습니다', '지역부호', '▼2는 제2지시기호가 7'];
    const miss = want.filter(w => msgs.indexOf(w) < 0); return miss.length ? 'missing: ' + miss.join(', ') + ' :: ' + msgs : true; } });
})();
