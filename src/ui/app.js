/* MARC 스튜디오 — 화면 (편집기 / 연습 / 태그 사전 / 설정)
 * 의존: MS.CODES, MS.FIELDS, MS.EXERCISES, MS.Model, MS.Validate, MS.Grade
 */
(function () {
  const Mo = MS.Model, V = MS.Validate, G = MS.Grade;
  const KEY = 'marcstudio.v1';
  const FORMATS = ['KORMARC', 'MARC21', 'KORMARC-AUTH'];
  const FORMAT_LABEL = { KORMARC: 'KORMARC', MARC21: 'MARC21', 'KORMARC-AUTH': 'KORMARC 전거' };
  const isAuthFmt = (f) => f === 'KORMARC-AUTH';

  /* ---------- 유틸 ---------- */
  const $ = (sel, root) => (root || document).querySelector(sel);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  function h(tag, props, ...kids) {
    const e = document.createElement(tag);
    if (props) Object.keys(props).forEach(k => {
      const v = props[k];
      if (k === 'class') e.className = v; else if (k === 'text') e.textContent = v; else if (k === 'html') e.innerHTML = v;
      else if (k === 'value' || k === 'checked' || k === 'selected') e[k] = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else if (k === 'style') e.style.cssText = v;
      else if (v !== false && v != null) e.setAttribute(k, v === true ? '' : v);
    });
    kids.flat().forEach(k => { if (k == null || k === false) return; e.appendChild(typeof k === 'string' ? document.createTextNode(k) : k); });
    return e;
  }
  const fmtTime = (iso) => { if (!iso) return ''; const d = new Date(iso); if (isNaN(d)) return iso.slice(0, 16); const p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`; };
  const blankShow = (c) => (c === ' ' || c === '' || c == null) ? '#' : c;
  let toastTimer; const toast = (msg) => { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2200); };
  const download = (name, data, type) => { const blob = data instanceof Blob ? data : new Blob([data], { type: type || 'text/plain;charset=utf-8' }); const a = h('a', { href: URL.createObjectURL(blob), download: name }); document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); };
  const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  const delimOf = (fmt) => fmt === 'MARC21' ? '$' : '▼';
  const fmtBadge = (fmt) => h('span', { class: 'badge ' + (fmt === 'MARC21' ? 'm' : isAuthFmt(fmt) ? 'a' : 'k'), text: isAuthFmt(fmt) ? '전거' : fmt });
  const fieldDef = (fmt, tag) => V.lookupDef(fmt, tag);
  const subKeys = (sub) => Object.keys(sub).sort((a, b) => (/\d/.test(a) - /\d/.test(b)) || a.localeCompare(b));
  const fieldName = (fmt, tag) => { const d = fieldDef(fmt, tag); return d ? d.name : ''; };

  /* ---------- 상태 ---------- */
  const DEFAULT_STATE = () => ({ records: [], currentId: null, tab: 'editor', refFormat: 'KORMARC', refTag: '245',
    settings: { textStyle: 'auto', blank: '#', isbd: true, order: true, encoding: 'auto', theme: 'auto' },
    practice: { progress: {}, custom: [], drafts: {}, currentId: null, filterFormat: 'ALL' } });
  let S = DEFAULT_STATE();
  try { const raw = localStorage.getItem(KEY); if (raw) { const o = JSON.parse(raw); S = Object.assign(DEFAULT_STATE(), o); S.settings = Object.assign(DEFAULT_STATE().settings, o.settings || {}); S.practice = Object.assign(DEFAULT_STATE().practice, o.practice || {}); } } catch (e) { console.warn('state load failed', e); }
  const save = debounce(() => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { toast('저장 실패: 브라우저 저장공간을 확인하세요'); } }, 300);
  const applyTheme = () => { const t = S.settings.theme || 'auto'; if (t === 'auto') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', t); };

  const currentRecord = () => S.records.find(r => r.id === S.currentId) || null;
  const touch = (rec) => { rec.updatedAt = new Date().toISOString(); save(); };

  /* ---------- 식별기호 텍스트 ↔ subfields ---------- */
  const parseSubText = (text) => {
    text = String(text || '');
    const m = text.match(/[▼▾$‡]/);
    if (!m) return text.trim() ? [{ code: 'a', value: text }] : [];
    const pre = text.slice(0, m.index); const parts = text.slice(m.index).split(/(?=[▼▾$‡][0-9a-zA-Z])/).filter(Boolean);
    const subs = parts.map(p => ({ code: p.charAt(1).toLowerCase(), value: p.slice(2) }));
    if (pre.trim()) subs.unshift({ code: 'a', value: pre });
    return subs;
  };
  const subText = (f, fmt) => Mo.fieldToText(f, fmt);

  /* ---------- 편집기 컴포넌트 ---------- */
  function Editor(rec, opts) {
    opts = Object.assign({ onChange: () => {}, validate: true }, opts || {});
    const E = { rec, opts, root: h('div', { class: 'editor' }), issues: [], textMode: false, collapsed: { leader: true, f008: false } };
    const fmt = () => E.rec.format;
    const change = () => { touch(E.rec); opts.onChange(E.rec); E.runValidate(); E.renderDescDebounced(); };

    /* 리더 패널 */
    E.renderLeader = () => {
      const p = E.leaderPanel; p.innerHTML = '';
      const defs = MS.CODES.LEADER[fmt()];
      const grid = h('div', { class: 'posgrid' });
      defs.forEach(d => {
        const val = E.rec.leader.substr(d.pos, d.len);
        const label = h('label', { title: d.name + (d.desc ? ' — ' + d.desc : '') }, h('b', { text: String(d.pos).padStart(2, '0') + (d.len > 1 ? '-' + String(d.pos + d.len - 1).padStart(2, '0') : '') }), d.name);
        let ctl;
        if (d.auto || d.fixed) ctl = h('input', { class: 'txt', value: val, readonly: true, title: d.auto ? '저장(내보내기) 시 자동 계산' : '고정값' });
        else {
          ctl = h('select', { class: 'sel', onchange: (ev) => { E.setLeader(d.pos, ev.target.value); } });
          Object.keys(d.codes).forEach(c => ctl.appendChild(h('option', { value: c, selected: c === val }, (c === ' ' ? '#' : c) + ' — ' + d.codes[c])));
          if (!(val in d.codes)) ctl.insertBefore(h('option', { value: val, selected: true }, (val || '?') + ' — (정의되지 않음)'), ctl.firstChild);
        }
        grid.appendChild(h('div', { class: 'pos' }, label, ctl));
      });
      p.appendChild(grid);
      const raw = h('input', { class: 'txt', value: E.rec.leader, maxlength: 24, spellcheck: false, onchange: (ev) => { E.rec.leader = Mo.pad(ev.target.value.replace(/[\\#_]/g, ' '), 24); E.renderLeader(); E.render008(); change(); } });
      p.appendChild(h('div', { class: 'rawline' }, h('span', { class: 'small muted', text: '리더 전체' }), raw));
      p.appendChild(h('div', { class: 'ruler', text: '        0         1         2   \n        012345678901234567890123' }));
    };
    E.setLeader = (pos, val) => { const l = E.rec.leader; E.rec.leader = l.slice(0, pos) + val + l.slice(pos + val.length); E.renderLeader(); E.render008(); change(); };

    /* 008 패널 */
    const isBook = () => /[at]/.test(E.rec.leader.charAt(6)) && /[acdm]/.test(E.rec.leader.charAt(7));
    const layout008 = () => isAuthFmt(fmt()) ? MS.CODES.F008[fmt()].AUTH : (isBook() ? MS.CODES.F008[fmt()].BK : null);
    E.get008 = () => { let f = Mo.getFirst(E.rec, '008'); if (!f) { f = { tag: '008', value: Mo.default008(fmt()) }; E.rec.fields.unshift(f); } f.value = Mo.pad(f.value, 40); return f; };
    E.set008 = (pos, val, len) => { const f = E.get008(); val = Mo.pad(val, len); f.value = f.value.slice(0, pos) + val + f.value.slice(pos + len); E.render008(); E.renderFields(); change(); };
    E.render008 = () => {
      const p = E.f008Panel; p.innerHTML = '';
      const f = E.get008(); const v = f.value;
      const lay = layout008();
      if (!lay) p.appendChild(h('p', { class: 'hint', text: '리더/06·/07 이 도서(문자자료 + 단행자료 등)가 아니므로 위치별 입력은 제공하지 않습니다. 아래에서 직접 편집하세요.' }));
      else {
        const grid = h('div', { class: 'posgrid' });
        lay.forEach(d => {
          const val = v.substr(d.pos, d.len);
          const label = h('label', { title: d.name + (d.desc ? ' — ' + d.desc : '') }, h('b', { text: String(d.pos).padStart(2, '0') + (d.len > 1 ? '-' + String(d.pos + d.len - 1).padStart(2, '0') : '') }), d.name);
          let ctl;
          if (d.type === 'blank') ctl = h('input', { class: 'txt', value: val, readonly: true, title: '미정의 위치(공백)' });
          else if (d.type === 'code') {
            ctl = h('select', { class: 'sel', onchange: (ev) => E.set008(d.pos, ev.target.value, 1) });
            Object.keys(d.codes).forEach(c => ctl.appendChild(h('option', { value: c, selected: c === val }, (c === ' ' ? '#' : c) + ' — ' + d.codes[c])));
            if (!(val in d.codes)) ctl.insertBefore(h('option', { value: val, selected: true }, (val.trim() || '?') + ' — (정의되지 않음)'), ctl.firstChild);
          } else {
            const listId = 'dl-' + d.pos + '-' + Math.random().toString(36).slice(2, 6);
            let title = d.desc || '';
            if (d.type === 'multi') title += '\n' + Object.keys(d.codes).map(c => (c === ' ' ? '#' : c) + '=' + d.codes[c]).join(', ');
            ctl = h('input', { class: 'txt', value: val, maxlength: d.len, spellcheck: false, list: (d.type === 'country' || d.type === 'lang' || d.type === 'univ') ? listId : null, title: title.trim(), placeholder: d.type === 'year' ? 'yyyy' : '',
              onchange: (ev) => E.set008(d.pos, ev.target.value, d.len) });
            if (d.type === 'country') { const dl = h('datalist', { id: listId }); const tbl = MS.CODES.COUNTRY[fmt()]; Object.keys(tbl).forEach(c => dl.appendChild(h('option', { value: Mo.pad(c, 3) }, tbl[c]))); p.appendChild(dl); }
            if (d.type === 'lang') { const dl = h('datalist', { id: listId }); Object.keys(MS.CODES.LANG).forEach(c => dl.appendChild(h('option', { value: c }, MS.CODES.LANG[c]))); p.appendChild(dl); }
            if (d.type === 'univ') { const dl = h('datalist', { id: listId }); Object.keys(MS.CODES.UNIV).forEach(c => dl.appendChild(h('option', { value: c }, MS.CODES.UNIV[c]))); p.appendChild(dl); }
          }
          grid.appendChild(h('div', { class: 'pos' }, label, ctl));
        });
        p.appendChild(grid);
      }
      const raw = h('input', { class: 'txt', value: v, maxlength: 40, spellcheck: false, onchange: (ev) => { f.value = Mo.pad(ev.target.value.replace(/[\\#_]/g, ' '), 40); E.render008(); E.renderFields(); change(); } });
      p.appendChild(h('div', { class: 'rawline' }, h('span', { class: 'small muted', text: '008 전체' }), raw));
      p.appendChild(h('div', { class: 'ruler', text: '         0         1         2         3         \n         0123456789012345678901234567890123456789' }));
    };

    /* 필드 목록 */
    E.renderFields = () => {
      const c = E.fieldsBox; c.innerHTML = '';
      const d = delimOf(fmt());
      const dlId = 'tags-' + fmt();
      if (!document.getElementById(dlId)) { const dl = h('datalist', { id: dlId }); Object.keys(MS.FIELDS[fmt()]).filter(t => /^\d{3}$/.test(t)).sort().forEach(t => dl.appendChild(h('option', { value: t }, MS.FIELDS[fmt()][t].name))); document.body.appendChild(dl); }
      const issueByFi = {}; E.issues.forEach(i => { if (i.fi >= 0) { issueByFi[i.fi] = issueByFi[i.fi] || []; issueByFi[i.fi].push(i.level); } });
      E.rec.fields.forEach((f, fi) => {
        if (f.tag === '008') return; // 008은 전용 패널
        const row = h('div', { class: 'frow', 'data-fi': fi });
        const lv = issueByFi[fi] || []; if (lv.includes('error')) row.classList.add('has-err'); else if (lv.includes('warning')) row.classList.add('has-warn');
        const tagIn = h('input', { class: 'txt tag', value: f.tag, maxlength: 3, list: dlId, spellcheck: false, onfocus: () => E.focusRow(row, f.tag),
          onchange: (ev) => { const t = ev.target.value.trim(); if (!/^[0-9A-Za-z]{3}$/.test(t)) { ev.target.value = f.tag; return; }
            const wasCtl = Mo.isControl(f.tag), isCtl = Mo.isControl(t);
            f.tag = t; if (wasCtl !== isCtl) { if (isCtl) { f.value = (f.subfields || []).map(s => s.value).join(' '); delete f.subfields; delete f.ind1; delete f.ind2; } else { f.subfields = [{ code: 'a', value: f.value || '' }]; f.ind1 = ' '; f.ind2 = ' '; delete f.value; } }
            E.renderFields(); E.showHelp(t); change(); } });
        row.appendChild(tagIn);
        if (Mo.isControl(f.tag)) {
          const vin = h('input', { class: 'txt sub', value: f.value || '', spellcheck: false, style: 'grid-column: 2 / 5', onfocus: () => E.focusRow(row, f.tag), oninput: (ev) => { f.value = ev.target.value; change(); } });
          row.appendChild(vin);
        } else {
          const mkInd = (k) => h('input', { class: 'txt ind', value: blankShow(f[k]), maxlength: 1, spellcheck: false, onfocus: () => E.focusRow(row, f.tag),
            oninput: (ev) => { let v = ev.target.value; if (v === '' || v === '#' || v === '\\' || v === '_') v = ' '; f[k] = v; change(); },
            onblur: (ev) => { ev.target.value = blankShow(f[k]); } });
          row.appendChild(mkInd('ind1')); row.appendChild(mkInd('ind2'));
          const sub = h('input', { class: 'txt sub', value: subText(f, fmt()), spellcheck: false, placeholder: d + 'a …', onfocus: () => E.focusRow(row, f.tag),
            oninput: (ev) => {
              let v = ev.target.value;
              if (fmt() === 'KORMARC' && /\$(?=[0-9a-zA-Z])/.test(v)) { const pos = ev.target.selectionStart; v = v.replace(/\$(?=[0-9a-zA-Z])/g, '▼'); ev.target.value = v; ev.target.setSelectionRange(pos, pos); }
              else if (fmt() === 'MARC21' && /[▼▾](?=[0-9a-zA-Z])/.test(v)) { const pos = ev.target.selectionStart; v = v.replace(/[▼▾](?=[0-9a-zA-Z])/g, '$'); ev.target.value = v; ev.target.setSelectionRange(pos, pos); }
              f.subfields = parseSubText(v); change(); },
            onkeydown: (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); E.addFieldAfter(fi); } } });
          row.appendChild(sub);
        }
        const ops = h('div', { class: 'ops' },
          h('button', { class: 'btn sm icon', title: '위로', onclick: () => E.move(fi, -1) }, '↑'),
          h('button', { class: 'btn sm icon', title: '아래로', onclick: () => E.move(fi, 1) }, '↓'),
          h('button', { class: 'btn sm icon', title: '아래에 필드 추가 (Enter)', onclick: () => E.addFieldAfter(fi) }, '+'),
          h('button', { class: 'btn sm icon danger', title: '삭제', onclick: () => { E.rec.fields.splice(fi, 1); E.renderFields(); change(); } }, '✕'));
        row.appendChild(ops);
        const def = fieldDef(fmt(), f.tag);
        row.appendChild(h('div', { class: 'fname', text: def ? def.name + (def.obsolete ? ' (사용중지)' : '') : (f.tag ? '정의되지 않은 태그' : '') }));
        c.appendChild(row);
      });
      const addTag = h('input', { class: 'txt tag mono', placeholder: '태그', maxlength: 3, list: dlId, style: 'width:70px', onkeydown: (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); addBtn.click(); } } });
      const addBtn = h('button', { class: 'btn', onclick: () => { const t = addTag.value.trim(); if (!/^[0-9A-Za-z]{3}$/.test(t)) { toast('태그 3자리를 입력하세요'); return; } E.addField(t); addTag.value = ''; } }, '+ 필드 추가');
      c.appendChild(h('div', { class: 'addrow' }, addTag, addBtn, h('span', { class: 'hint', text: `식별기호는 ${d}a 처럼 입력합니다. 지시기호 공백은 # 로 표시됩니다. 필드 입력 중 Enter 로 다음 필드를 추가합니다.` })));
    };
    E.focusRow = (row, tag) => { E.fieldsBox.querySelectorAll('.frow.focus').forEach(r => r.classList.remove('focus')); row.classList.add('focus'); E.showHelp(tag); };
    E.move = (fi, dir) => { const j = fi + dir; if (j < 0 || j >= E.rec.fields.length) return; const a = E.rec.fields; [a[fi], a[j]] = [a[j], a[fi]]; E.renderFields(); change(); };
    E.addField = (tag) => { const f = Mo.newField(tag); E.rec.fields.push(f); E.renderFields(); change(); E.focusNew(E.rec.fields.length - 1); };
    E.addFieldAfter = (fi) => { const f = Mo.newField(E.rec.fields[fi] ? E.rec.fields[fi].tag : '500'); E.rec.fields.splice(fi + 1, 0, f); E.renderFields(); change(); E.focusNew(fi + 1); };
    E.focusNew = (fi) => { const row = E.fieldsBox.querySelector(`.frow[data-fi="${fi}"]`); if (row) { const t = row.querySelector('.tag'); t && t.focus(); t && t.select(); } };
    E.sort = () => { Mo.sortFields(E.rec); E.renderFields(); change(); toast('태그 순서로 정렬했습니다'); };

    /* 텍스트 보기 */
    E.renderText = () => {
      const box = E.textBox; box.innerHTML = '';
      const ta = h('textarea', { class: 'ta', spellcheck: false, value: Mo.toBreaker(E.rec, { style: textStyleFor(fmt()), blank: S.settings.blank }) });
      box.appendChild(ta);
      box.appendChild(h('div', { class: 'toolbar', style: 'margin-top:8px' },
        h('button', { class: 'btn primary', onclick: () => { const r = Mo.parseBreaker(ta.value, fmt(), E.rec); E.rec.leader = r.record.leader; E.rec.fields = r.record.fields; if (r.problems.length) toast(r.problems.map(p => p.line + '행: ' + p.msg).join(' / ')); E.renderLeader(); E.render008(); E.renderFields(); change(); E.renderDesc(); toast('텍스트를 필드에 적용했습니다'); } }, '텍스트 → 필드 적용'),
        h('button', { class: 'btn', onclick: () => { ta.value = Mo.toBreaker(E.rec, { style: textStyleFor(fmt()), blank: S.settings.blank }); } }, '필드 → 텍스트 다시 읽기'),
        h('button', { class: 'btn', onclick: () => { navigator.clipboard && navigator.clipboard.writeText(ta.value).then(() => toast('복사했습니다')); } }, '복사'),
        h('span', { class: 'hint', text: '형식: 태그 지시기호 ' + delimOf(fmt()) + 'a… (MarcEdit 식 =245  10$a… 도 인식). 공백 지시기호는 #, \\, _ 또는 b/ 로 표기.' })));
    };

    /* 검증 */
    E.runValidate = debounce(() => { if (!opts.validate) return; E.issues = V.run(E.rec, { isbd: S.settings.isbd, order: S.settings.order }); E.renderIssues(); E.markRows(); }, 250);
    E.markRows = () => { const by = {}; E.issues.forEach(i => { if (i.fi >= 0) { by[i.fi] = by[i.fi] || []; by[i.fi].push(i.level); } }); E.fieldsBox.querySelectorAll('.frow').forEach(r => { const fi = +r.dataset.fi; const lv = by[fi] || []; r.classList.toggle('has-err', lv.includes('error')); r.classList.toggle('has-warn', !lv.includes('error') && lv.includes('warning')); }); };
    E.renderIssues = () => {
      const box = E.issueBox; if (!box) return; box.innerHTML = '';
      const s = V.summary(E.issues);
      box.appendChild(h('div', { class: 'sumline' }, h('span', { class: 'badge err', text: '오류 ' + s.error }), h('span', { class: 'badge warn', text: '경고 ' + s.warning }), h('span', { class: 'badge info', text: '참고 ' + s.info }), h('span', { class: 'spacer' }), h('button', { class: 'btn sm', onclick: () => { E.issues = V.run(E.rec, { isbd: S.settings.isbd, order: S.settings.order }); E.renderIssues(); E.markRows(); toast('검증했습니다'); } }, '다시 검증')));
      if (!E.issues.length) { box.appendChild(h('div', { class: 'empty', text: '문제가 발견되지 않았습니다 ✓' })); return; }
      const ul = h('ul', { class: 'issues' });
      E.issues.forEach(i => ul.appendChild(h('li', { class: i.level, onclick: () => E.jumpTo(i) }, h('span', { class: 'tag', text: i.tag }), i.msg)));
      box.appendChild(ul);
    };
    E.jumpTo = (i) => {
      if (i.tag === '000') { E.toggle('leader', false); E.leaderPanel.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
      if (i.tag === '008') { E.toggle('f008', false); E.f008Panel.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
      if (E.textMode) E.setTextMode(false);
      const row = E.fieldsBox.querySelector(`.frow[data-fi="${i.fi}"]`);
      if (row) { row.scrollIntoView({ behavior: 'smooth', block: 'center' }); row.classList.remove('flash'); void row.offsetWidth; row.classList.add('flash'); const inp = row.querySelector('.sub') || row.querySelector('.tag'); inp && inp.focus(); E.showHelp(i.tag); }
    };

    /* 도움말 */
    E.showHelp = (tag) => { if (E.helpBox) renderHelpInto(E.helpBox, fmt(), tag); };

    /* 패널 토글 */
    E.toggle = (key, force) => { const p = key === 'leader' ? E.leaderWrap : E.f008Wrap; const col = force === undefined ? !E.collapsed[key] : force; E.collapsed[key] = col; p.classList.toggle('collapsed', col); const b = p.querySelector('.tgl'); if (b) b.textContent = col ? '▸' : '▾'; };
    E.setTextMode = (on) => { E.textMode = on; E.textBox.style.display = on ? '' : 'none'; E.fieldsBox.style.display = on ? 'none' : ''; E.modeBtn.textContent = on ? '필드 편집으로' : '텍스트로 보기'; if (on) E.renderText(); else E.renderFields(); };

    /* 조립 */
    E.leaderPanel = h('div', { class: 'pb' }); E.f008Panel = h('div', { class: 'pb' });
    E.leaderWrap = h('div', { class: 'panel' + (E.collapsed.leader ? ' collapsed' : '') }, h('div', { class: 'ph' }, h('button', { class: 'tgl', onclick: () => E.toggle('leader') }, E.collapsed.leader ? '▸' : '▾'), '리더 (000)', h('span', { class: 'spacer' }), h('span', { class: 'small muted', text: '길이·기본번지는 자동 계산' })), E.leaderPanel);
    E.f008Wrap = h('div', { class: 'panel' + (E.collapsed.f008 ? ' collapsed' : '') }, h('div', { class: 'ph' }, h('button', { class: 'tgl', onclick: () => E.toggle('f008') }, E.collapsed.f008 ? '▸' : '▾'), '008 부호화정보필드', h('span', { class: 'spacer' }), h('button', { class: 'btn sm', onclick: () => renderHelpInto(E.helpBox, fmt(), '008') }, '설명')), E.f008Panel);
    E.fieldsBox = h('div', { class: 'fields' }); E.textBox = h('div', { style: 'display:none' });
    E.modeBtn = h('button', { class: 'btn', onclick: () => E.setTextMode(!E.textMode) }, '텍스트로 보기');
    E.fieldsWrap = h('div', { class: 'panel' }, h('div', { class: 'ph' }, '가변필드', h('span', { class: 'spacer' }), h('button', { class: 'btn sm', onclick: E.sort }, '태그순 정렬'), E.modeBtn), h('div', { class: 'pb' }, E.fieldsBox, E.textBox));
    E.descBox = h('div', { class: 'pb' });
    E.collapsed.desc = !!opts.descCollapsed;
    E.descWrap = h('div', { class: 'panel' + (E.collapsed.desc ? ' collapsed' : '') }, h('div', { class: 'ph' }, h('button', { class: 'tgl', onclick: () => { E.collapsed.desc = !E.collapsed.desc; E.descWrap.classList.toggle('collapsed', E.collapsed.desc); E.descWrap.querySelector('.tgl').textContent = E.collapsed.desc ? '▸' : '▾'; if (!E.collapsed.desc) E.renderDesc(); } }, E.collapsed.desc ? '▸' : '▾'), '기술 형식 보기', h('span', { class: 'small muted', text: 'KCR4 / ISBD 기술문과 표목지시' }), h('span', { class: 'spacer' }), h('button', { class: 'btn sm', onclick: () => { navigator.clipboard && navigator.clipboard.writeText(MS.Describe.toText(E.rec)).then(() => toast('기술문을 복사했습니다')); } }, '복사')), E.descBox);
    E.renderDesc = () => {
      if (E.collapsed.desc) return; const b = MS.Describe.build(E.rec); const box = E.descBox; box.innerHTML = '';
      const card = h('div', { class: 'desc' });
      if (b.kind === 'auth') {
        card.appendChild(h('div', { class: 'hd' }, h('span', { class: 'mono muted small', text: b.headingTag + '  ' }), b.heading || '(1XX 표목을 입력하면 표시됩니다)'));
        b.areas.forEach(a => card.appendChild(h('div', { class: 'nt' }, h('span', { class: 'muted', text: a.label + ': ' }), a.text)));
        b.refs.see.forEach(x => card.appendChild(h('div', { class: 'nt' }, h('span', { class: 'muted', text: '보라(이형) ' }), x, h('span', { class: 'muted', text: '  → 다음으로 검색하시오: ' + b.heading }))));
        b.refs.seeAlso.forEach(x => card.appendChild(h('div', { class: 'nt' }, h('span', { class: 'muted', text: '도보라 ' }), x, h('span', { class: 'muted', text: '  ↔ 다음으로도 검색하시오' }))));
        b.refs.links.forEach(x => card.appendChild(h('div', { class: 'nt' }, h('span', { class: 'muted', text: '연관저록 ' }), x)));
        b.notes.forEach(n => card.appendChild(h('div', { class: 'nt' }, h('span', { class: 'muted', text: n.label + ': ' }), n.text)));
        b.standard.forEach(x => card.appendChild(h('div', { class: 'nt', text: x })));
        box.appendChild(card);
        box.appendChild(h('div', { class: 'hint', text: '전거레코드 보기: 채택표목(1XX) · 식별 속성(046·3XX) · 보라부출(4XX: 이형 → 채택표목) · 도보라부출(5XX: 채택표목 ↔ 채택표목, ▼w/▼i 관계) · 연관저록(7XX) · 주기(670 정보원 등).' }));
        return;
      }
      if (b.callno.length) card.appendChild(h('div', { class: 'cn' }, ...b.callno.map(c => h('div', { text: c }))));
      if (b.heading) card.appendChild(h('div', { class: 'hd', text: b.heading }));
      const body = MS.Describe.joinAreas(b.areas.map(a => a.text).concat(b.series.length ? [b.series.join(' ')] : []));
      card.appendChild(h('div', { class: 'body', text: body || '(245 표제와 책임표시사항을 입력하면 기술문이 나타납니다)' }));
      b.notes.forEach(n => card.appendChild(h('div', { class: 'nt', text: (n.label ? n.label + ': ' : '') + n.text })));
      b.standard.forEach(x => card.appendChild(h('div', { class: 'nt', text: x })));
      if (b.tracing.subjects.length || b.tracing.added.length) card.appendChild(h('div', { class: 'tr', text: b.tracing.subjects.concat(b.tracing.added).join('   ') }));
      box.appendChild(card);
      const legend = h('div', { class: 'hint', text: '기술 영역은 " . -- "로, 식별기호 사이는 빈칸 하나로 이었습니다. 구두점은 레코드에 기록된 ISBD 구두점을 그대로 씁니다. 표목지시: 아라비아 숫자 = 주제명(6XX), 로마 숫자 = 부출표목(7XX·총서·표제).' });
      box.appendChild(legend);
    };
    E.root.append(E.leaderWrap, E.f008Wrap, E.fieldsWrap, E.descWrap);
    E.renderDescDebounced = debounce(() => E.renderDesc(), 300);
    E.renderLeader(); E.render008(); E.renderFields(); E.renderDesc();
    E.mount = (container, issueBox, helpBox) => { container.innerHTML = ''; container.appendChild(E.root); E.issueBox = issueBox; E.helpBox = helpBox; E.runValidate(); if (helpBox) E.showHelp('245'); };
    return E;
  }
  const textStyleFor = (fmt) => S.settings.textStyle === 'auto' ? (fmt === 'MARC21' ? 'marcedit' : 'kormarc') : S.settings.textStyle;

  /* ---------- 실무 사용률 (src/data/usage.js, tools/marc_stats.py) ---------- */
  const usageSets = (fmt) => Object.keys(MS.USAGE || {}).map(k => MS.USAGE[k]).filter(u => u && u.format === fmt && u.n);
  const pct = (a, b) => b ? ((100 * a / b) < 10 ? (100 * a / b).toFixed(1) : Math.round(100 * a / b)) + '%' : '-';
  const usagePct = (fmt, tag) => { const us = usageSets(fmt); if (!us.length) return null; const box = h('span', { class: 'upct' }); us.forEach((u, i) => { const e = u.tags[tag]; if (i) box.appendChild(document.createTextNode(' · ')); box.appendChild(h('span', { title: u.source + ' 표본 ' + u.n.toLocaleString() + '건 중 출현률', text: e ? pct(e.recs, u.n) : '0%' })); }); return box; };
  const sortTags = (fmt, ts) => { const us = usageSets(fmt); if (S.refSort !== 'usage' || !us.length) return ts.sort(); const score = (t) => us.reduce((acc, u) => acc + ((u.tags[t] || {}).recs || 0) / u.n, 0) / us.length; return ts.sort((a, b) => (score(b) - score(a)) || a.localeCompare(b)); };
  function appendUsage(wrap, fmt, tag) {
    usageSets(fmt).forEach(u => {
      const box = h('div', { class: 'usage' });
      box.appendChild(h('div', { class: 'sec', text: '실무 사용률 — ' + u.source + ' 표본 ' + u.n.toLocaleString() + '건 (' + u.collected + ')' }));
      if (tag === '000' || tag === 'LDR' || tag === '008') {
        const dist = tag === '008' ? u.f008 : u.leader; const t = h('table', { class: 'utbl' });
        Object.keys(dist || {}).sort((a, b) => parseInt(a) - parseInt(b)).forEach(p => { const tot = Object.values(dist[p]).reduce((x, y) => x + y, 0); t.appendChild(h('tr', {}, h('td', { class: 'c', text: p }), h('td', {}, ...Object.keys(dist[p]).map(v => h('span', { class: 'uv' }, h('b', { class: 'mono', text: v.replace(/ /g, '␣') }), ' ' + pct(dist[p][v], tot)))))); });
        box.appendChild(h('div', { class: 'small muted', text: tag === '008' ? '자리별 값 분포 (도서 외 자료유형이 섞여 있으면 의미가 다를 수 있음)' : '리더 자리별 값 분포' })); box.appendChild(t); wrap.appendChild(box); return;
      }
      const e = u.tags[tag];
      if (!e) { box.appendChild(h('p', { class: 'small muted', style: 'margin:4px 0', text: '표본에 이 태그가 없습니다 (출현률 0%).' })); wrap.appendChild(box); return; }
      box.appendChild(h('p', { class: 'small', style: 'margin:4px 0' }, h('b', { text: pct(e.recs, u.n) }), ' 의 레코드에 있음 (' + e.recs.toLocaleString() + '건, ' + e.occ.toLocaleString() + '회, 있는 레코드당 평균 ' + (e.occ / e.recs).toFixed(2) + '회)'));
      if (e.ind) { const tot = Object.values(e.ind).reduce((x, y) => x + y, 0); box.appendChild(h('p', { class: 'small', style: 'margin:4px 0' }, '지시기호: ', ...Object.keys(e.ind).map(k => h('span', { class: 'uv' }, h('b', { class: 'mono', text: k.replace(/ /g, '#') }), ' ' + pct(e.ind[k], tot))))); }
      if (e.sub) {
        const t = h('table', { class: 'utbl' });
        Object.keys(e.sub).forEach(c => { const rc = e.sub[c][0], oc = e.sub[c][1]; t.appendChild(h('tr', {}, h('td', { class: 'c mono', text: delimOf(fmt) + c }), h('td', {}, h('span', { class: 'ubar', style: 'width:' + Math.max(2, Math.round(120 * rc / e.occ)) + 'px' }), ' ' + pct(rc, e.occ) + (oc > rc ? ' (있을 때 평균 ' + (oc / rc).toFixed(1) + '개)' : '')))); });
        box.appendChild(h('div', { class: 'small muted', style: 'margin-top:4px', text: '식별기호 사용률 (이 태그가 나온 ' + e.occ.toLocaleString() + '회 기준)' })); box.appendChild(t);
      }
      wrap.appendChild(box);
    });
  }

  /* ---------- 도움말 렌더 ---------- */
  function renderHelpInto(box, fmt, tag) {
    if (!box) return; box.innerHTML = ''; const d = delimOf(fmt);
    const wrap = h('div', { class: 'help' });
    if (tag === '000' || tag === 'LDR') { wrap.appendChild(h('h3', { text: '리더 (Leader)' })); wrap.appendChild(codeTable(MS.CODES.LEADER[fmt])); appendUsage(wrap, fmt, '000'); box.appendChild(wrap); return; }
    if (tag === '008') { const auth = isAuthFmt(fmt); wrap.appendChild(h('h3', { text: auth ? '008 부호화정보필드 — 전거통제용' : '008 부호화정보필드 — 도서(BK)' })); wrap.appendChild(h('p', { class: 'small muted', text: auth ? 'KORMARC 전거통제용 2023 개정판 기준. 09 레코드 종류(a 채택표목 …), 10 목록기술규칙, 11 주제명표목표, 14-16 표목사용, 32 동명이인, 33 채택표목 수준이 핵심.' : fmt === 'KORMARC' ? 'KORMARC 2023 개정판 기준. 24-25 내용형식(2자리), 26-27 한국대학부호, 28 수정레코드, 32 목록정보원, 38-39 한국정부기관부호는 MARC21과 다릅니다.' : 'MARC 21 Books 008.' })); wrap.appendChild(codeTable(auth ? MS.CODES.F008[fmt].AUTH : MS.CODES.F008[fmt].BK)); appendUsage(wrap, fmt, '008'); box.appendChild(wrap); return; }
    const def = fieldDef(fmt, tag);
    if (!def) { wrap.appendChild(h('h3', { text: tag + ' — 정의되지 않은 태그' })); wrap.appendChild(h('p', { class: 'small muted', text: '내장 정의에 없는 태그입니다. 자관 로컬 필드라면 그대로 사용할 수 있습니다.' })); box.appendChild(wrap); return; }
    wrap.appendChild(h('h3', {}, h('span', { class: 'mono', text: tag + ' ' }), def.name, ' ', h('span', { class: 'badge', text: def.rep ? '반복' : '반복불가' }), ' ', (def.src || fmt === 'MARC21') ? h('span', { class: 'badge ' + (def.src === '확인' ? 'ok' : ''), title: def.src === '확인' ? (fmt === 'MARC21' ? '미국의회도서관 MARC 21 원문으로 확인한 정의' : '국립중앙도서관 KORMARC 원문으로 확인한 정의') : (fmt === 'MARC21' ? 'LC 원문 미대조(기억에 의존한 정의)' : 'MARC21 정의를 준용(KORMARC 원문 세부 미확인)'), text: def.src === '확인' ? (fmt === 'MARC21' ? 'LC 원문 확인' : '원문 확인') : (fmt === 'MARC21' ? 'LC 미대조' : 'MARC21 준용') }) : null, def.kormarcOnly ? h('span', { class: 'badge k', text: 'KORMARC 전용' }) : null, def.local ? h('span', { class: 'badge', text: '로컬' }) : null));
    appendUsage(wrap, fmt, tag);
    if (def.obsolete) wrap.appendChild(h('p', { class: 'small', style: 'color:var(--warn)', text: '⚠ ' + def.obsolete }));
    if (def.control) { wrap.appendChild(h('p', { class: 'small muted', text: '제어필드: 지시기호와 식별기호를 사용하지 않습니다.' })); if (def.patternDesc) wrap.appendChild(h('p', { class: 'small', text: '형식: ' + def.patternDesc })); box.appendChild(wrap); return; }
    if (def.nameOnly) { wrap.appendChild(h('p', { class: 'small muted', text: '이 필드는 이름만 등록되어 있어 지시기호·식별기호 상세 검증을 하지 않습니다.' })); box.appendChild(wrap); return; }
    const indTbl = h('table');
    [['제1지시기호', def.ind1], ['제2지시기호', def.ind2]].forEach(([nm, idef]) => {
      if (idef === undefined) return;
      if (idef === null) { indTbl.appendChild(h('tr', {}, h('td', { class: 'c', text: nm }), h('td', { text: '미정의 (공백)' }))); return; }
      const codes = Object.keys(idef.c).map(c => h('div', {}, h('b', { class: 'mono', text: c === ' ' ? '#' : c }), ' ' + idef.c[c]));
      indTbl.appendChild(h('tr', {}, h('td', { class: 'c', text: nm }), h('td', {}, h('div', { class: 'small muted', text: idef.n }), ...codes)));
    });
    if (def.anySubs) wrap.appendChild(h('p', { class: 'small muted', text: def.note || '' }));
    else { wrap.appendChild(h('div', { class: 'sec', text: '지시기호' })); wrap.appendChild(indTbl); }
    if (def.sub && !def.anySubs) {
      wrap.appendChild(h('div', { class: 'sec', text: '식별기호' }));
      const st = h('table');
      subKeys(def.sub).forEach(c => { const sd = def.sub[c]; const pm = def.punct && def.punct[c] && def.punct[c].length ? ' (앞: ' + def.punct[c].map(p => "'" + p + "'").join(' 또는 ') + ')' : ''; st.appendChild(h('tr', {}, h('td', { class: 'c', text: d + c }), h('td', {}, sd.name + pm), h('td', { class: 'small muted', text: sd.rep ? 'R' : 'NR' }))); });
      wrap.appendChild(st);
      if (def.mandatorySubs) wrap.appendChild(h('p', { class: 'small muted', text: '필수: ' + def.mandatorySubs.map(c => d + c).join(', ') }));
      if (def.forbiddenSubs) Object.keys(def.forbiddenSubs).forEach(c => wrap.appendChild(h('p', { class: 'small', style: 'color:var(--err)', text: d + c + ': ' + def.forbiddenSubs[c] })));
    }
    if (def.note) wrap.appendChild(h('div', { class: 'note', text: def.note }));
    if (def.w && MS.AUTH_W) { wrap.appendChild(h('div', { class: 'sec', text: '▼w 제어 식별기호 (자리별)' })); MS.AUTH_W[def.w.kind].forEach(pos => wrap.appendChild(h('div', { class: 'small' }, h('b', { text: pos.name + ': ' }), Object.keys(pos.codes).map(c => c + '=' + pos.codes[c]).join(', ')))); }
    box.appendChild(wrap);
  }
  function codeTable(defs) {
    const t = h('table');
    defs.forEach(d => {
      const range = String(d.pos).padStart(2, '0') + (d.len > 1 ? '-' + String(d.pos + d.len - 1).padStart(2, '0') : '');
      let body;
      if (d.codes) body = h('div', {}, ...Object.keys(d.codes).map(c => h('div', {}, h('b', { class: 'mono', text: c === ' ' ? '#' : c }), ' ' + d.codes[c])));
      else body = h('span', { class: 'muted', text: d.fixed ? '고정값 ' + d.fixed : (d.desc || (d.type === 'year' ? '4자리 연도 (불명 자리는 u)' : d.type === 'country' ? '발행국 부호' : d.type === 'lang' ? '언어부호 (kor, eng …)' : '')) });
      t.appendChild(h('tr', {}, h('td', { class: 'c', text: range }), h('td', {}, h('div', { text: d.name }), body)));
    });
    return t;
  }

  /* ---------- 레코드 가져오기/내보내기 ---------- */
  const splitBreakerRecords = (text) => {
    const recs = []; let cur = [];
    const flush = () => { if (cur.some(l => l.trim())) recs.push(cur.join('\n')); cur = []; };
    text.split(/\r?\n/).forEach(l => { if (!l.trim()) { flush(); return; } if (/^\s*=?(LDR|000|리더)\b/i.test(l) && cur.some(x => x.trim())) flush(); cur.push(l); });
    flush(); return recs;
  };
  function importFile(file, format, onDone) {
    const name = file.name.toLowerCase();
    if (name.endsWith('.mrc') || name.endsWith('.marc') || name.endsWith('.iso')) {
      file.arrayBuffer().then(buf => { const recs = Mo.fromISO2709(new Uint8Array(buf), format, S.settings.encoding); onDone(recs); });
    } else if (name.endsWith('.json')) {
      file.text().then(t => { try { const o = JSON.parse(t); if (o && o.records) { onDone(o.records.map(r => Object.assign(r, { id: Mo.uid() })), o); } else if (Array.isArray(o)) onDone(o.map(r => Object.assign(r, { id: Mo.uid() }))); else toast('알 수 없는 JSON 형식'); } catch (e) { toast('JSON 해석 실패'); } });
    } else {
      file.text().then(t => { const recs = splitBreakerRecords(t).map(chunk => Mo.parseBreaker(chunk, format).record); onDone(recs); });
    }
  }

  /* ---------- 상단/탭 ---------- */
  const app = $('#app');
  function renderShell() {
    app.innerHTML = '';
    const tabs = [['editor', '편집기'], ['practice', '연습'], ['reference', '태그 사전'], ['settings', '설정 · 도움말']];
    const nav = h('nav', { class: 'tabs' }, ...tabs.map(([k, label]) => h('button', { class: S.tab === k ? 'active' : '', onclick: () => { S.tab = k; save(); renderShell(); } }, label)));
    app.appendChild(h('header', { class: 'top' }, h('h1', {}, 'MARC 스튜디오', h('small', { text: 'KORMARC · MARC21 입력 · 검증 · 연습' })), nav, h('span', { class: 'spacer' }), h('span', { class: 'small muted', text: '브라우저에 자동 저장' })));
    const main = h('main'); app.appendChild(main);
    ({ editor: renderEditorTab, practice: renderPracticeTab, reference: renderReferenceTab, settings: renderSettingsTab }[S.tab] || renderEditorTab)(main);
  }

  /* ---------- 편집기 탭 ---------- */
  let ED = null;
  function renderEditorTab(main) {
    const left = h('div', { class: 'col-left' }), center = h('div', { class: 'col-center' }), right = h('div', { class: 'col-right' });
    main.appendChild(h('div', { class: 'layout' }, left, center, right));
    const issueBox = h('div', { class: 'pb' }), helpBox = h('div', { class: 'pb' });
    right.append(h('div', { class: 'panel' }, h('div', { class: 'ph' }, '검증 결과'), issueBox), h('div', { class: 'panel' }, h('div', { class: 'ph' }, '필드 도움말', h('span', { class: 'spacer' }), h('span', { class: 'small muted', text: '필드를 클릭하면 표시' })), helpBox));
    const renderList = () => {
      left.innerHTML = '';
      const newBtns = h('div', { class: 'toolbar', style: 'padding:8px 10px; border-bottom:1px solid var(--line)' },
        h('button', { class: 'btn primary sm', onclick: () => newRecord('KORMARC') }, '+ KORMARC'), h('button', { class: 'btn sm', onclick: () => newRecord('MARC21') }, '+ MARC21'), h('button', { class: 'btn sm', title: 'KORMARC 전거통제용 레코드', onclick: () => newRecord('KORMARC-AUTH') }, '+ 전거'),
        h('label', { class: 'btn sm', title: '텍스트(.txt/.mrk), ISO 2709(.mrc), 백업(.json)' }, '가져오기', h('input', { type: 'file', accept: '.txt,.mrk,.mrc,.marc,.iso,.json', style: 'display:none', multiple: true, onchange: (ev) => { const files = Array.from(ev.target.files); if (!files.length) return; const fmt = prompt('가져올 레코드의 형식을 입력하세요 (KORMARC / MARC21 / 전거). .json 백업은 무관.', 'KORMARC'); if (fmt === null) return; const F = /21/.test(fmt) ? 'MARC21' : /전거|auth/i.test(fmt) ? 'KORMARC-AUTH' : 'KORMARC'; let n = 0; files.forEach(f => importFile(f, F, (recs) => { recs.forEach(r => { r.format = r.format || F; r.id = r.id || Mo.uid(); S.records.unshift(r); n++; }); S.currentId = S.records[0] && S.records[0].id; save(); renderList(); openCurrent(); toast(n + '건 가져왔습니다'); })); ev.target.value = ''; } })));
      left.appendChild(h('div', { class: 'panel' }, newBtns, (() => {
        if (!S.records.length) return h('div', { class: 'empty', text: '레코드가 없습니다. 위 버튼으로 새 레코드를 만드세요.' });
        const ul = h('ul', { class: 'reclist' });
        S.records.slice().sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '')).forEach(r => ul.appendChild(h('li', { class: r.id === S.currentId ? 'active' : '', onclick: () => { S.currentId = r.id; save(); renderList(); openCurrent(); } }, h('div', { class: 't', text: Mo.recordTitle(r) }), h('div', { class: 's' }, fmtBadge(r.format), h('span', { text: fmtTime(r.updatedAt) })))));
        return ul;
      })()));
    };
    const newRecord = (fmt) => { const r = Mo.newRecord(fmt); S.records.unshift(r); S.currentId = r.id; save(); renderList(); openCurrent(); };
    const openCurrent = () => {
      center.innerHTML = '';
      const rec = currentRecord();
      if (!rec) { center.appendChild(h('div', { class: 'panel' }, h('div', { class: 'empty', text: '왼쪽에서 레코드를 선택하거나 새로 만드세요.' }))); issueBox.innerHTML = ''; helpBox.innerHTML = ''; return; }
      const titleEl = h('span', { class: 'mono', style: 'font-weight:600', text: Mo.recordTitle(rec) });
      const tb = h('div', { class: 'panel' }, h('div', { class: 'ph' }, fmtBadge(rec.format), titleEl, h('span', { class: 'spacer' }),
        h('button', { class: 'btn sm', onclick: () => { const r = Mo.clone(rec); r.id = Mo.uid(); r.updatedAt = new Date().toISOString(); S.records.unshift(r); S.currentId = r.id; save(); renderList(); openCurrent(); toast('복제했습니다'); } }, '복제'),
        h('button', { class: 'btn sm', onclick: () => { const other = rec.format === 'KORMARC' ? 'MARC21' : rec.format === 'MARC21' ? 'KORMARC-AUTH' : 'KORMARC'; if (!confirm(`형식 표시를 ${FORMAT_LABEL[other]}로 바꿉니다. 필드 내용은 자동 변환되지 않으며 검증 기준만 바뀝니다. 계속할까요?`)) return; rec.format = other; touch(rec); renderList(); openCurrent(); } }, '형식 전환'),
        h('button', { class: 'btn sm', onclick: () => download(safeName(Mo.recordTitle(rec)) + '.txt', Mo.toBreaker(rec, { style: textStyleFor(rec.format), blank: S.settings.blank })) }, '텍스트 저장'),
        h('button', { class: 'btn sm', onclick: () => download(safeName(Mo.recordTitle(rec)) + '.mrc', new Blob([Mo.toISO2709(rec)], { type: 'application/marc' })) }, '.mrc 저장'),
        h('button', { class: 'btn sm danger', onclick: () => { if (!confirm('이 레코드를 삭제할까요?')) return; S.records = S.records.filter(r => r.id !== rec.id); S.currentId = S.records[0] ? S.records[0].id : null; save(); renderList(); openCurrent(); } }, '삭제')));
      center.appendChild(tb);
      const edBox = h('div'); center.appendChild(edBox);
      ED = Editor(rec, { onChange: (r) => { titleEl.textContent = Mo.recordTitle(r); renderListDebounced(); } });
      ED.mount(edBox, issueBox, helpBox);
    };
    const renderListDebounced = debounce(renderList, 800);
    renderList(); openCurrent();
  }
  const safeName = (s) => (s || 'record').replace(/[\\/:*?"<>|]+/g, '_').slice(0, 60);

  /* ---------- 연습 탭 ---------- */
  const allExercises = () => MS.EXERCISES.concat(S.practice.custom || []);
  function renderPracticeTab(main) {
    const left = h('div', { class: 'col-left' }), center = h('div', { class: 'col-center' }), right = h('div', { class: 'col-right' });
    main.appendChild(h('div', { class: 'layout' }, left, center, right));
    const renderList = () => {
      left.innerHTML = '';
      const sel = h('select', { class: 'sel', onchange: (ev) => { S.practice.filterFormat = ev.target.value; save(); renderList(); } }, ...[['ALL', '전체'], ['KORMARC', 'KORMARC 서지'], ['MARC21', 'MARC21'], ['KORMARC-AUTH', 'KORMARC 전거']].map(([v, t]) => h('option', { value: v, selected: S.practice.filterFormat === v }, t)));
      const ul = h('ul', { class: 'exlist' });
      allExercises().filter(e => S.practice.filterFormat === 'ALL' || e.format === S.practice.filterFormat).forEach(e => {
        const pr = S.practice.progress[e.id];
        ul.appendChild(h('li', { class: e.id === S.practice.currentId ? 'active' : '', onclick: () => { S.practice.currentId = e.id; save(); renderList(); openEx(); } },
          h('div', { class: 't', text: e.title }), h('div', { class: 's' }, fmtBadge(e.format), h('span', { class: 'levels', title: '난이도 ' + e.level }, ...[1, 2, 3].map(n => h('i', { class: n <= e.level ? 'on' : '' }))), pr ? h('span', { class: 'badge ' + (pr.best >= 90 ? 'ok' : pr.best >= 60 ? 'warn' : 'err'), text: '최고 ' + pr.best + '점' }) : null, e.custom ? h('span', { class: 'badge', text: '내 문제' }) : null, e.group ? h('span', { class: 'badge', text: e.group }) : null)));
      });
      left.appendChild(h('div', { class: 'panel' }, h('div', { class: 'toolbar', style: 'padding:8px 10px;border-bottom:1px solid var(--line)' }, sel, h('span', { class: 'spacer' }), h('button', { class: 'btn sm', onclick: () => openCustomDialog(null, () => { renderList(); }) }, '+ 문제 추가')), ul));
    };
    const openEx = () => {
      center.innerHTML = ''; right.innerHTML = '';
      const ex = allExercises().find(e => e.id === S.practice.currentId);
      if (!ex) { center.appendChild(h('div', { class: 'panel' }, h('div', { class: 'empty', text: '왼쪽에서 문제를 선택하세요. 표제면·판권지 정보를 보고 레코드를 작성한 뒤 채점합니다.' }))); return; }
      const draft = S.practice.drafts[ex.id] || (S.practice.drafts[ex.id] = Object.assign(Mo.newRecord(ex.format), { id: 'draft-' + ex.id }));
      draft.format = ex.format;
      // 문제 설명
      const cards = Object.keys(ex.source || {}).map(k => h('div', { class: 'card' + (/[▼$]/.test(ex.source[k]) && /^\d{3} /m.test(ex.source[k]) ? ' marc' : '') }, h('h4', { text: k }), h('pre', { text: ex.source[k] })));
      const hintBox = h('div', { class: 'small', style: 'margin-top:8px' }); let hintN = 0;
      const head = h('div', { class: 'panel' }, h('div', { class: 'ph' }, fmtBadge(ex.format), ex.title, h('span', { class: 'levels', style: 'margin-left:6px' }, ...[1, 2, 3].map(n => h('i', { class: n <= ex.level ? 'on' : '' }))), h('span', { class: 'spacer' }),
        ex.custom ? h('button', { class: 'btn sm', onclick: () => openCustomDialog(ex, () => { renderList(); openEx(); }) }, '문제 편집') : null,
        h('button', { class: 'btn sm', onclick: () => { if (hintN >= (ex.hints || []).length) { toast('힌트를 모두 보았습니다'); return; } hintBox.appendChild(h('div', { text: '💡 ' + ex.hints[hintN++] })); } }, '힌트'),
        h('button', { class: 'btn sm', onclick: () => showAnswer(ex) }, '정답 보기'),
        h('button', { class: 'btn sm danger', onclick: () => { if (!confirm('작성 중인 레코드를 지우고 처음부터 시작할까요?')) return; S.practice.drafts[ex.id] = Object.assign(Mo.newRecord(ex.format), { id: 'draft-' + ex.id }); save(); openEx(); } }, '초기화')),
        h('div', { class: 'pb' }, h('div', { class: 'src' }, ...cards), h('p', { class: 'hint', text: '채점 대상: ' + (ex.graded || []).join(', ') + (ex.graded && ex.graded.includes('008') ? (isAuthFmt(ex.format) ? '  (008은 주요 위치만, 리더는 05·06·17·18)' : '  (008은 주요 위치만, 리더는 06·07·17·18)') : '') }), hintBox));
      center.appendChild(head);
      const edBox = h('div'); center.appendChild(edBox);
      const issueBox = h('div', { class: 'pb' }), helpBox = h('div', { class: 'pb' }), resultBox = h('div', { class: 'pb' });
      right.append(h('div', { class: 'panel' }, h('div', { class: 'ph' }, '채점 결과', h('span', { class: 'spacer' }), h('button', { class: 'btn primary sm', onclick: () => grade() }, '채점하기')), resultBox),
        h('div', { class: 'panel' }, h('div', { class: 'ph' }, '형식 검증'), issueBox), h('div', { class: 'panel' }, h('div', { class: 'ph' }, '필드 도움말'), helpBox));
      resultBox.appendChild(h('div', { class: 'empty', text: '레코드를 작성한 뒤 「채점하기」를 누르세요.' }));
      const ed = Editor(draft, { onChange: () => save(), descCollapsed: true });
      ed.mount(edBox, issueBox, helpBox);
      const grade = () => {
        const r = G.grade(draft, ex);
        const pr = S.practice.progress[ex.id] || { best: 0, attempts: 0 }; pr.attempts++; pr.best = Math.max(pr.best, r.score); pr.last = new Date().toISOString(); S.practice.progress[ex.id] = pr; save(); renderList();
        resultBox.innerHTML = '';
        resultBox.appendChild(h('div', { style: 'display:flex;align-items:baseline;gap:10px' }, h('span', { class: 'score ' + (r.score >= 90 ? 'good' : r.score >= 60 ? 'mid' : 'bad'), text: r.score + '점' }), h('span', { class: 'small muted', text: `(${r.got} / ${r.total}) · ${pr.attempts}회 시도 · 최고 ${pr.best}점` })));
        const tbl = h('table', { class: 'gradetbl' }, h('tr', {}, h('th', { text: '태그' }), h('th', { text: '정답 / 입력' })));
        const d = delimOf(ex.format);
        r.items.forEach(it => {
          const mark = { ok: '○', partial: '△', miss: '×', extra: '·' }[it.status];
          const cell = h('td', {});
          if (it.expected) cell.appendChild(h('div', { class: 'm' }, h('span', { class: 'muted', text: '정답 ' }), blankShow(it.expInd[0]) + blankShow(it.expInd[1]) + ' ' + it.expected));
          if (it.actual) cell.appendChild(h('div', { class: 'm' }, h('span', { class: 'muted', text: '입력 ' }), (it.actInd ? blankShow(it.actInd[0]) + blankShow(it.actInd[1]) + ' ' : '') + it.actual));
          if (it.details && it.details.length) cell.appendChild(h('ul', {}, ...it.details.map(x => h('li', { text: x }))));
          tbl.appendChild(h('tr', { class: it.status, onclick: () => { if (it.fi >= 0) ed.jumpTo({ tag: it.tag, fi: it.fi }); } }, h('td', {}, h('b', { text: mark + ' ' + it.tag }), h('div', { class: 'small muted', text: it.max ? it.points + '/' + it.max : '' })), cell));
        });
        resultBox.appendChild(tbl);
        if (r.f008.length) {
          resultBox.appendChild(h('div', { class: 'sec small muted', style: 'margin-top:10px;font-weight:600', text: '008 위치별' }));
          const t8 = h('table', { class: 'gradetbl' });
          r.f008.forEach(p => t8.appendChild(h('tr', { class: p.ok ? 'ok' : 'miss' }, h('td', {}, h('b', { text: (p.ok ? '○ ' : '× ') + String(p.pos).padStart(2, '0') + (p.len > 1 ? '-' + String(p.pos + p.len - 1).padStart(2, '0') : '') })), h('td', {}, h('div', { text: p.name }), h('div', { class: 'm' }, `정답 '${p.expected.replace(/ /g, '#')}'` + (p.ok ? '' : `  입력 '${(p.actual || '').replace(/ /g, '#')}'`) + (p.codes && p.codes[p.expected] ? ' — ' + p.codes[p.expected] : ''))))));
          resultBox.appendChild(t8);
        }
        if (r.leader.length) {
          const tl = h('table', { class: 'gradetbl' });
          r.leader.forEach(p => tl.appendChild(h('tr', { class: p.ok ? 'ok' : 'miss' }, h('td', {}, h('b', { text: (p.ok ? '○ ' : '× ') + '리더/' + String(p.pos).padStart(2, '0') })), h('td', {}, h('div', { text: p.name }), h('div', { class: 'm', text: `정답 '${blankShow(p.expected)}'` + (p.ok ? '' : `  입력 '${blankShow(p.actual)}'`) })))));
          resultBox.appendChild(h('div', { class: 'sec small muted', style: 'margin-top:10px;font-weight:600', text: '리더' })); resultBox.appendChild(tl);
        }
        if (ex.explanation) resultBox.appendChild(h('div', { class: 'note', style: 'font-family:var(--sans);white-space:pre-wrap;margin-top:10px;background:var(--panel2);border-radius:6px;padding:8px 10px;font-size:13px' }, h('b', { text: '해설  ' }), ex.explanation));
        resultBox.appendChild(h('div', { class: 'toolbar', style: 'margin-top:8px' }, h('button', { class: 'btn sm', onclick: () => showAnswer(ex) }, '정답 전체 보기'), h('button', { class: 'btn sm', onclick: () => { const rec = Mo.parseBreaker(ex.answer, ex.format).record; rec.id = Mo.uid(); S.records.unshift(rec); save(); toast('정답 레코드를 편집기에 복사했습니다'); } }, '정답을 편집기로 복사')));
      };
    };
    const showAnswer = (ex) => {
      const dlg = h('dialog', {}, h('h3', { style: 'margin-top:0', text: '정답 레코드 — ' + ex.title }), h('textarea', { class: 'ta', readonly: true, value: ex.answer, style: 'min-height:300px' }), h('p', { class: 'small', style: 'white-space:pre-wrap', text: ex.explanation || '' }), h('div', { class: 'toolbar' }, h('button', { class: 'btn', onclick: () => dlg.close() }, '닫기')));
      document.body.appendChild(dlg); dlg.showModal(); dlg.addEventListener('close', () => dlg.remove());
    };
    renderList(); openEx();
  }
  // 사용자 정의 문제 추가/편집
  function openCustomDialog(ex, onSaved) {
    const isNew = !ex; ex = ex || { id: 'c' + Date.now().toString(36), custom: true, format: 'KORMARC', level: 2, title: '', source: { 표제면: '', 판권지: '', 형태: '', 기타: '' }, answer: '', graded: [], hints: [], explanation: '' };
    const f = {};
    const inp = (k, v, props) => (f[k] = h('input', Object.assign({ class: 'txt', value: v || '' }, props || {})));
    const ta = (k, v, props) => (f[k] = h('textarea', Object.assign({ class: 'ta', style: 'min-height:70px;font-family:var(--sans);white-space:pre-wrap', value: v || '' }, props || {})));
    const fmtSel = f.format = h('select', { class: 'sel' }, ...FORMATS.map(x => h('option', { value: x, selected: ex.format === x }, FORMAT_LABEL[x])));
    const lvSel = f.level = h('select', { class: 'sel' }, ...[1, 2, 3].map(x => h('option', { value: x, selected: ex.level === x }, '난이도 ' + x)));
    const dlg = h('dialog', {}, h('h3', { style: 'margin-top:0', text: isNew ? '연습문제 추가' : '연습문제 편집' }),
      h('div', { class: 'form' },
        h('label', { text: '제목' }), inp('title', ex.title), h('label', { text: '형식 / 난이도' }), h('div', { class: 'toolbar' }, fmtSel, lvSel),
        h('label', { text: '표제면 정보' }), ta('표제면', ex.source.표제면), h('label', { text: '판권지 정보' }), ta('판권지', ex.source.판권지), h('label', { text: '형태 정보' }), ta('형태', ex.source.형태), h('label', { text: '기타 조건' }), ta('기타', ex.source.기타),
        h('label', { text: '정답 레코드 (브레이커 텍스트)' }), ta('answer', ex.answer, { style: 'min-height:160px', placeholder: '000 00000nam a2200000 c 4500\n008 …\n245 00▼a표제 /▼d저자' }),
        h('label', { text: '채점 태그 (쉼표 구분, 비우면 정답의 모든 태그)' }), inp('graded', (ex.graded || []).join(', ')),
        h('label', { text: '힌트 (한 줄에 하나)' }), ta('hints', (ex.hints || []).join('\n')), h('label', { text: '해설' }), ta('explanation', ex.explanation)),
      h('div', { class: 'toolbar', style: 'margin-top:12px' },
        h('button', { class: 'btn primary', onclick: () => {
          const ans = f.answer.value.trim(); if (!f.title.value.trim() || !ans) { toast('제목과 정답 레코드는 필수입니다'); return; }
          const rec = Mo.parseBreaker(ans, fmtSel.value).record;
          const g = f.graded.value.split(/[,\s]+/).filter(Boolean); const graded = g.length ? g : Array.from(new Set(rec.fields.map(x => x.tag))).filter(t => !/^00[1-7]$/.test(t)).sort();
          const obj = { id: ex.id, custom: true, format: fmtSel.value, level: +lvSel.value, title: f.title.value.trim(), source: { 표제면: f.표제면.value, 판권지: f.판권지.value, 형태: f.형태.value, 기타: f.기타.value }, answer: Mo.toBreaker(rec, { style: 'kormarc', blank: ' ' }).replace(/^000 /m, '000 '), graded, hints: f.hints.value.split('\n').map(s => s.trim()).filter(Boolean), explanation: f.explanation.value };
          // 정답 텍스트는 공백 지시기호를 공백으로 저장(파서가 고정폭으로 읽음)
          obj.answer = Mo.toBreaker(rec, { style: 'kormarc', blank: ' ' });
          const i = S.practice.custom.findIndex(x => x.id === ex.id); if (i >= 0) S.practice.custom[i] = obj; else S.practice.custom.push(obj);
          S.practice.currentId = obj.id; save(); dlg.close(); onSaved && onSaved(); toast('저장했습니다'); } }, '저장'),
        isNew ? null : h('button', { class: 'btn danger', onclick: () => { if (!confirm('이 문제를 삭제할까요?')) return; S.practice.custom = S.practice.custom.filter(x => x.id !== ex.id); delete S.practice.drafts[ex.id]; if (S.practice.currentId === ex.id) S.practice.currentId = null; save(); dlg.close(); onSaved && onSaved(); } }, '삭제'),
        h('button', { class: 'btn', onclick: () => dlg.close() }, '취소')));
    document.body.appendChild(dlg); dlg.showModal(); dlg.addEventListener('close', () => dlg.remove());
  }

  /* ---------- 태그 사전 탭 ---------- */
  function renderReferenceTab(main) {
    const left = h('div', { class: 'col-left' }), center = h('div', { class: 'col-center' }), right = h('div', { class: 'col-right' });
    main.appendChild(h('div', { class: 'layout' }, left, center, right));
    const detail = h('div', { class: 'pb' });
    center.appendChild(h('div', { class: 'panel' }, h('div', { class: 'ph' }, '정의'), detail));
    const q = h('input', { class: 'txt', placeholder: '태그 또는 이름 검색', style: 'width:100%', oninput: () => renderList() });
    const fsel = h('select', { class: 'sel', onchange: (ev) => { S.refFormat = ev.target.value; if (!MS.FIELDS[S.refFormat][S.refTag] && S.refTag !== '000' && S.refTag !== '008') S.refTag = isAuthFmt(S.refFormat) ? '100' : '245'; save(); renderList(); show(S.refTag); renderRight(); } }, ...FORMATS.map(x => h('option', { value: x, selected: S.refFormat === x }, FORMAT_LABEL[x])));
    const ssel = h('select', { class: 'sel', title: '목록 정렬', onchange: (ev) => { S.refSort = ev.target.value; save(); renderList(); } }, h('option', { value: 'tag', selected: S.refSort !== 'usage' }, '태그 순서'), h('option', { value: 'usage', selected: S.refSort === 'usage' }, '실무 사용률 순' + (usageSets(S.refFormat).length > 1 ? ' (출처 평균)' : '')));
    const list = h('ul', { class: 'reflist' });
    left.appendChild(h('div', { class: 'panel' }, h('div', { style: 'padding:8px 10px;border-bottom:1px solid var(--line);display:flex;flex-direction:column;gap:6px' }, fsel, q, ssel), list));
    const show = (tag) => { S.refTag = tag; save(); renderHelpInto(detail, S.refFormat, tag); list.querySelectorAll('li').forEach(li => li.classList.toggle('active', li.dataset.tag === tag)); };
    const renderList = () => {
      list.innerHTML = ''; const F = MS.FIELDS[S.refFormat]; const qq = q.value.trim().toLowerCase();
      const entries = [['000', '리더'], ['008', isAuthFmt(S.refFormat) ? '008 부호화정보필드(전거)' : '008 부호화정보필드(도서)']].concat(sortTags(S.refFormat, Object.keys(F).filter(t => t !== '008')).map(t => [t, F[t].name]));
      entries.filter(([t, n]) => !qq || t.includes(qq) || n.toLowerCase().includes(qq)).forEach(([t, n]) => { const d = F[t]; list.appendChild(h('li', { 'data-tag': t, class: t === S.refTag ? 'active' : '', onclick: () => show(t) }, h('span', { class: 'tag', text: t }), h('span', { text: n }), d && d.kormarcOnly ? h('span', { class: 'badge k', text: 'K' }) : null, usagePct(S.refFormat, t))); });
    };
    const renderRight = () => {
      right.innerHTML = '';
      if (isAuthFmt(S.refFormat)) {
        const wrap = h('div', { class: 'pb' });
        [['ref', '4XX 보라부출 · 5XX 도보라부출의 ▼w'], ['link', '7XX 연관저록의 ▼w']].forEach(([k, title]) => {
          wrap.appendChild(h('div', { class: 'sec', style: 'font-weight:600;margin:6px 0 4px', text: title }));
          MS.AUTH_W[k].forEach(pos => { const t = h('table', { class: 'codetbl' }); Object.keys(pos.codes).forEach(c => t.appendChild(h('tr', {}, h('td', { class: 'c', text: c }), h('td', { text: pos.codes[c] })))); wrap.appendChild(h('div', { class: 'small muted', text: pos.name })); wrap.appendChild(t); });
        });
        right.appendChild(h('div', { class: 'panel' }, h('div', { class: 'ph' }, '▼w 제어 식별기호 부호표'), wrap));
        right.appendChild(h('div', { class: 'panel' }, h('div', { class: 'ph' }, '전거레코드 종류 (008/09)'), h('div', { class: 'pb small' }, codeTable(MS.CODES.F008['KORMARC-AUTH'].AUTH.filter(d => d.pos === 9)))));
        right.appendChild(h('div', { class: 'panel' }, h('div', { class: 'ph' }, '출처'), h('div', { class: 'pb small' }, h('p', { style: 'margin:0' }, 'KORMARC 전거통제용 2023 개정판(KS X 6006-4) 국립중앙도서관 공개 원문 ', h('a', { href: 'https://librarian.nl.go.kr/kormarc/KSX6006-4/', target: '_blank', text: 'librarian.nl.go.kr/kormarc/KSX6006-4' })))));
        return;
      }
      const diff = h('table', { class: 'difftbl' }, h('tr', {}, h('th', { text: '항목' }), h('th', { text: 'KORMARC' }), h('th', { text: 'MARC21' })));
      MS.DIFFS.forEach(r => diff.appendChild(h('tr', {}, h('td', { text: r.area }), h('td', {}, r.k, r.note ? h('div', { class: 'small muted', text: r.note }) : null), h('td', { text: r.m }))));
      right.appendChild(h('div', { class: 'panel' }, h('div', { class: 'ph' }, 'KORMARC ↔ MARC21 주요 차이'), h('div', { class: 'pb' }, diff)));
      usageSets(S.refFormat).forEach(u => right.appendChild(h('div', { class: 'panel' }, h('div', { class: 'ph' }, '실무 사용률 표본'), h('div', { class: 'pb small' }, h('p', { style: 'margin:0' }, u.source + ' 소장자료 ' + u.n.toLocaleString() + '건 (' + u.collected + ' 수집). ' + (u.note ? u.note + ' ' : '') + '태그 사전 각 항목과 목록의 백분율은 이 표본에서 그 태그가 나타난 레코드 비율입니다. 빈도는 참고용이며 규정상 필수 여부와는 다릅니다.')))));
      right.appendChild(h('div', { class: 'panel' }, h('div', { class: 'ph' }, '출처'), h('div', { class: 'pb small' }, h('p', { style: 'margin:0 0 6px' }, 'KORMARC: 국립중앙도서관 「한국문헌자동화목록형식—통합서지용」 2023 개정판(KS X 6006-0) 공개 원문 ', h('a', { href: 'https://librarian.nl.go.kr/kormarc/KSX6006-0/', target: '_blank', text: 'librarian.nl.go.kr/kormarc' })), h('p', { style: 'margin:0' }, 'MARC 21: Library of Congress, MARC 21 Format for Bibliographic Data ', h('a', { href: 'https://www.loc.gov/marc/bibliographic/', target: '_blank', text: 'loc.gov/marc/bibliographic' })), h('p', { class: 'muted', style: 'margin:6px 0 0', text: '「원문 확인」 표시가 없는 KORMARC 필드는 MARC21 정의를 준용한 것이므로 세부 식별기호는 원문으로 확인하세요.' }))));
    };
    renderList(); show(S.refTag || (isAuthFmt(S.refFormat) ? '100' : '245')); renderRight();
  }

  /* ---------- 설정 탭 ---------- */
  function renderSettingsTab(main) {
    const st = S.settings;
    const row = (label, ctl, hint) => [h('label', { text: label }), h('div', {}, ctl, hint ? h('div', { class: 'hint', text: hint }) : null)];
    const sel = (key, options, onchange) => h('select', { class: 'sel', onchange: (ev) => { st[key] = ev.target.value; save(); onchange && onchange(); } }, ...options.map(([v, t]) => h('option', { value: v, selected: String(st[key]) === v }, t)));
    const chk = (key, label) => h('label', { style: 'display:flex;gap:6px;align-items:center' }, h('input', { type: 'checkbox', checked: !!st[key], onchange: (ev) => { st[key] = ev.target.checked; save(); } }), label);
    const form = h('div', { class: 'form' },
      ...row('텍스트 내보내기 형식', sel('textStyle', [['auto', '자동 (KORMARC → 245 10▼a…, MARC21 → =245  10$a…)'], ['kormarc', 'KORMARC 식 (245 10▼a…)'], ['marcedit', 'MarcEdit 식 (=245  10$a…)']])),
      ...row('공백 지시기호 표시', sel('blank', [['#', '# (MARC 문서 관례)'], ['\\', '\\ (MarcEdit)'], ['_', '_ (밑줄)'], [' ', '공백 그대로']]), 'KORMARC 식 텍스트에서 공백 지시기호를 어떻게 표시할지. 가져올 때는 모두 인식합니다.'),
      ...row('검증 옵션', h('div', { class: 'toolbar' }, chk('isbd', 'ISBD 구두점 검사 (경고)'), chk('order', '태그 오름차순 권고 (참고)'))),
      ...row('.mrc 가져오기 문자부호', sel('encoding', [['auto', '자동 (리더/09 = a 이면 UTF-8, 아니면 KORMARC은 EUC-KR)'], ['utf-8', 'UTF-8'], ['euc-kr', 'EUC-KR (KS X 1001)']]), '내보내기는 항상 UTF-8 (리더/09 = a).'),
      ...row('화면 테마', sel('theme', [['auto', '시스템 설정 따름'], ['light', '밝게'], ['dark', '어둡게']], applyTheme)),
      ...row('백업', h('div', { class: 'toolbar' },
        h('button', { class: 'btn', onclick: () => download('MARC-Studio-backup-' + new Date().toISOString().slice(0, 10) + '.json', JSON.stringify({ app: 'MARC Studio', version: 1, exported: new Date().toISOString(), records: S.records, practice: S.practice, settings: S.settings }, null, 1), 'application/json') }, '전체 백업 (JSON)'),
        h('label', { class: 'btn' }, '백업 복원', h('input', { type: 'file', accept: '.json', style: 'display:none', onchange: (ev) => { const f = ev.target.files[0]; if (!f) return; f.text().then(t => { try { const o = JSON.parse(t); if (!o.records) throw 0; if (!confirm(`레코드 ${o.records.length}건과 연습 진행 상태를 현재 데이터에 합칠까요? (기존 데이터는 유지)`)) return; o.records.forEach(r => { if (!S.records.find(x => x.id === r.id)) S.records.push(r); }); if (o.practice) { Object.assign(S.practice.progress, o.practice.progress || {}); (o.practice.custom || []).forEach(c => { if (!S.practice.custom.find(x => x.id === c.id)) S.practice.custom.push(c); }); } save(); toast('복원했습니다'); renderShell(); } catch (e) { toast('백업 파일을 읽을 수 없습니다'); } }); } })),
        h('button', { class: 'btn', onclick: () => download('MARC-Studio-records.mrc', new Blob([Mo.recordsToISO2709(S.records)], { type: 'application/marc' })) }, '모든 레코드 .mrc'),
        h('button', { class: 'btn', onclick: () => download('MARC-Studio-records.txt', S.records.map(r => Mo.toBreaker(r, { style: textStyleFor(r.format), blank: st.blank })).join('\n\n')) }, '모든 레코드 텍스트')), '데이터는 이 브라우저의 localStorage에만 저장됩니다. 다른 컴퓨터/브라우저로 옮기거나 캐시 삭제에 대비해 주기적으로 백업하세요.'),
      ...row('초기화', h('button', { class: 'btn danger', onclick: () => { if (!confirm('모든 레코드, 연습 진행 상태, 설정을 삭제합니다. 계속할까요?')) return; if (!confirm('정말 삭제할까요? 되돌릴 수 없습니다.')) return; localStorage.removeItem(KEY); S = DEFAULT_STATE(); applyTheme(); renderShell(); } }, '모든 데이터 삭제')));
    main.appendChild(h('div', { class: 'panel' }, h('div', { class: 'ph' }, '설정'), h('div', { class: 'pb' }, form)));
    const help = h('div', { class: 'pb', style: 'max-width:860px;line-height:1.7' },
      h('h3', { style: 'margin:0 0 6px;font-size:14px', text: '사용법' }),
      h('ol', { style: 'margin:0 0 10px 18px;padding:0' },
        h('li', {}, h('b', { text: '편집기' }), ': 「+ KORMARC」/「+ MARC21」로 새 레코드를 만듭니다. 리더·008은 위치별 선택 상자로, 가변필드는 ', h('code', { text: '245 10 ▼a표제 /▼d저자' }), ' 처럼 한 줄에 입력합니다. 식별기호 구분자는 KORMARC에서 ▼, MARC21에서 $ 이며 $ 를 치면 ▼ 로 자동 변환됩니다. 오른쪽 「검증 결과」는 입력하는 동안 자동 갱신되고 항목을 클릭하면 해당 필드로 이동합니다.'),
        h('li', {}, h('b', { text: '텍스트로 보기' }), ': 레코드 전체를 브레이커 텍스트로 보고 붙여넣어 편집할 수 있습니다. 「텍스트 → 필드 적용」으로 반영합니다.'),
        h('li', {}, h('b', { text: '가져오기/내보내기' }), ': 텍스트(.txt/.mrk), ISO 2709(.mrc), JSON 백업을 가져올 수 있고, 레코드별 또는 전체를 텍스트·.mrc로 저장합니다.'),
        h('li', {}, h('b', { text: '연습' }), ': 문제의 표제면·판권지 정보를 보고 레코드를 작성한 뒤 「채점하기」를 누르면 필드별 ○△×, 008 위치별 비교, 해설이 표시됩니다. 작성 중인 답은 자동 저장되어 나중에 이어서 할 수 있습니다. 「+ 문제 추가」로 교재의 예제를 직접 문제로 등록할 수 있습니다.'),
        h('li', {}, h('b', { text: '태그 사전' }), ': 형식별 태그 정의(지시기호·식별기호·구두점)와 KORMARC ↔ MARC21 차이표.'),
        h('li', {}, h('b', { text: '전거(KORMARC 전거통제용)' }), ': 「+ 전거」로 전거레코드를 만듭니다. 리더/06 z, 008은 전거용 배치(09 레코드 종류 등)로 바뀌고, 1XX 표목·4XX 보라·5XX 도보라·7XX 연관저록·3XX 속성·670 정보원을 검증합니다. ▼w 제어 식별기호는 자리별로 검사하며 태그 사전에 부호표가 있습니다. 연습 탭의 「전거」 문제는 인물·단체 정보 또는 서지레코드 2건을 보고 전거레코드를 작성합니다.')),
      h('h3', { style: 'margin:10px 0 6px;font-size:14px', text: '검증 수준' }),
      h('p', { style: 'margin:0 0 10px' }, h('span', { class: 'badge err', text: '오류' }), ' 형식 규정 위반(정의되지 않은 지시기호·식별기호, 반복 불가 위반, 길이·체크디지트 오류 등). ', h('span', { class: 'badge warn', text: '경고' }), ' 대개 잘못되었지만 예외가 있을 수 있는 것(ISBD 구두점, 008과 260 연도 불일치 등). ', h('span', { class: 'badge info', text: '참고' }), ' 권장 사항·확인 요청.'),
      h('h3', { style: 'margin:10px 0 6px;font-size:14px', text: '기준 자료' }),
      h('p', { style: 'margin:0', text: 'KORMARC는 국립중앙도서관이 공개한 통합서지용 2023 개정판(KS X 6006-0) 원문을, MARC21은 미국의회도서관 MARC 21 Bibliographic을 기준으로 했습니다. 도서(단행본) 자료에 맞춰 008 위치별 검증을 제공하며, 다른 자료유형은 리더·가변필드만 검증합니다. 연습문제의 도서 정보는 학습용으로 만든 가공의 자료입니다.' }));
    main.appendChild(h('div', { class: 'panel', style: 'margin-top:10px' }, h('div', { class: 'ph' }, '도움말'), help));
  }

  /* ---------- 시작 ---------- */
  applyTheme();
  if (!S.records.length && !localStorage.getItem(KEY)) {
    // 첫 실행: 예시 레코드 하나
    const ex = MS.EXERCISES[0]; const r = Mo.parseBreaker(ex.answer, ex.format).record; r.id = Mo.uid(); S.records.push(r); S.currentId = r.id; save();
  }
  renderShell();
})();
