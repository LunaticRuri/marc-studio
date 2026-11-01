/* MARC 스튜디오 — 연습 채점
 * MS.Grade.grade(userRecord, exercise) → { score, total, got, items:[...], f008:[...], leader:[...] }
 * item = { tag, status:'ok'|'partial'|'miss'|'extra', expected, actual, points, max, details:[string] }
 */
window.MS = window.MS || {};
(function () {
  const G = {};
  const Mo = () => MS.Model;
  const DEFAULT_008 = {
    KORMARC: [[6, 1], [7, 4], [15, 3], [18, 4], [22, 1], [23, 1], [24, 2], [26, 2], [29, 1], [30, 1], [31, 1], [33, 1], [34, 1], [35, 3]],
    MARC21: [[6, 1], [7, 4], [15, 3], [18, 4], [22, 1], [23, 1], [24, 4], [28, 1], [29, 1], [30, 1], [31, 1], [33, 1], [34, 1], [35, 3]],
  };
  DEFAULT_008['KORMARC-AUTH'] = [[6, 1], [7, 1], [9, 1], [10, 1], [11, 1], [12, 1], [13, 1], [14, 1], [15, 1], [16, 1], [17, 1], [28, 1], [29, 1], [31, 1], [32, 1], [33, 1], [38, 1], [39, 1]];
  const DEFAULT_LEADER = [6, 7, 17, 18];
  const DEFAULT_LEADER_AUTH = [5, 6, 17, 18];
  const layoutOf = (fmt) => fmt === 'KORMARC-AUTH' ? 'AUTH' : 'BK';

  // 값 정규화: 전각→반각, 공백 정리, 통화기호 통일, 끝 구두점 완화
  G.norm = (s) => String(s == null ? '' : s).normalize('NFKC').replace(/[₩￦]/g, '₩').replace(/\s+/g, ' ').trim().replace(/\s*([:;/=,.+])\s*$/, '$1').replace(/\s+([:;/=+])$/, '$1').toLowerCase();
  G.normLoose = (s) => G.norm(s).replace(/[\s.,:;/=+\-()\[\]'"「」『』]/g, '');
  const lev = (a, b) => { if (a === b) return 0; const m = a.length, n = b.length; if (!m) return n; if (!n) return m; let prev = Array.from({ length: n + 1 }, (_, i) => i), cur = new Array(n + 1);
    for (let i = 1; i <= m; i++) { cur[0] = i; for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); [prev, cur] = [cur, prev]; } return prev[n]; };
  G.similarity = (a, b) => { a = G.norm(a); b = G.norm(b); if (!a && !b) return 1; const d = lev(a, b); return 1 - d / Math.max(a.length, b.length, 1); };

  const fieldSim = (a, b) => {
    const ta = (a.subfields || []).map(s => s.code + G.norm(s.value)).join('|'), tb = (b.subfields || []).map(s => s.code + G.norm(s.value)).join('|');
    return G.similarity(ta, tb);
  };
  const D = (fmt) => fmt === 'MARC21' ? '$' : '▼';

  // 한 필드 쌍 비교 → {points(0~1), details[]}
  G.compareField = (ans, usr, def, fmt) => {
    const d = D(fmt); const details = []; let pts = 0, max = 0;
    const indDefined = (idef) => idef !== null && idef !== undefined;
    // 지시기호 (각 1점, 미정의면 채점 제외)
    [['ind1', 1], ['ind2', 2]].forEach(([k, n]) => {
      const idef = def ? def[k] : undefined;
      if (!def || def.nameOnly || indDefined(idef)) {
        max += 1; const a = (ans[k] || ' '), u = (usr[k] || ' ');
        if (a === u) pts += 1; else details.push(`제${n}지시기호: 정답 '${a === ' ' ? '공백' : a}' / 입력 '${u === ' ' ? '공백' : u}'`);
      }
    });
    // 식별기호: 정답 각 식별기호 3점 (코드·순서 1, 값 2)
    const as = ans.subfields || [], us = (usr.subfields || []).slice();
    const used = new Set();
    as.forEach((s, i) => {
      max += 3;
      // 같은 코드 중 가장 비슷한 것
      let best = -1, bestSim = -1;
      us.forEach((u, j) => { if (used.has(j) || u.code !== s.code) return; const sim = G.similarity(s.value, u.value); if (sim > bestSim) { bestSim = sim; best = j; } });
      if (best < 0) { details.push(`${d}${s.code} 누락: 정답 '${s.value}'`); return; }
      used.add(best);
      const u = us[best];
      // 순서
      const orderOk = best === i || (as.slice(0, i).filter((x, k) => x.code === s.code).length === us.slice(0, best).filter(x => x.code === s.code).length && best >= i - 1);
      if (orderOk) pts += 1; else details.push(`${d}${s.code} 순서가 다릅니다 (정답 ${i + 1}번째, 입력 ${best + 1}번째)`);
      // 값
      if (G.norm(s.value) === G.norm(u.value)) pts += 2;
      else if (G.normLoose(s.value) === G.normLoose(u.value)) { pts += 1.5; details.push(`${d}${s.code} 구두점/띄어쓰기 차이: 정답 '${s.value}' / 입력 '${u.value}'`); }
      else if (bestSim >= 0.8) { pts += 1; details.push(`${d}${s.code} 거의 맞음: 정답 '${s.value}' / 입력 '${u.value}'`); }
      else details.push(`${d}${s.code} 값이 다릅니다: 정답 '${s.value}' / 입력 '${u.value}'`);
    });
    us.forEach((u, j) => { if (!used.has(j)) details.push(`${d}${u.code} 불필요(정답에 없음): '${u.value}'`); });
    const extra = us.filter((u, j) => !used.has(j)).length;
    pts = Math.max(0, pts - extra * 0.5);
    return { points: max ? pts / max : 1, details };
  };

  G.grade = (userRec, ex) => {
    const fmt = ex.format; const d = D(fmt);
    const ans = Mo().parseBreaker(ex.answer, fmt).record;
    const items = []; let total = 0, got = 0;
    const F = MS.FIELDS[fmt];
    const defOf = (tag) => MS.Validate.lookupDef(fmt, tag);
    const graded = (ex.graded || []).slice();
    // 리더
    const leaderPos = ex.leaderPos || (fmt === 'KORMARC-AUTH' ? DEFAULT_LEADER_AUTH : DEFAULT_LEADER); const leader = [];
    leaderPos.forEach(p => { const a = (ans.leader || '').charAt(p), u = (userRec.leader || '').charAt(p); const ok = a === u; total += 1; if (ok) got += 1; const def = MS.CODES.LEADER[fmt].find(x => x.pos === p); leader.push({ pos: p, name: def ? def.name : '', expected: a, actual: u, ok }); });
    // 008
    const f008 = [];
    if (graded.indexOf('008') >= 0) {
      const positions = ex.f008pos || DEFAULT_008[fmt]; const av = (Mo().getFirst(ans, '008') || {}).value || '', uv = (Mo().getFirst(userRec, '008') || {}).value || '';
      const w = 10 / positions.length;
      positions.forEach(([pos, len]) => { const a = av.substr(pos, len), u = uv.substr(pos, len); const ok = a === u; total += w; if (ok) got += w; const def = MS.CODES.F008[fmt][layoutOf(fmt)].find(x => x.pos === pos); f008.push({ pos, len, name: def ? def.name : '', expected: a, actual: u, ok, codes: def ? def.codes : null }); });
    }
    // 가변필드
    const usedUser = new Set();
    graded.filter(t => t !== '008').forEach(tag => {
      const af = ans.fields.filter(f => f.tag === tag); const uf = userRec.fields.map((f, i) => ({ f, i })).filter(x => x.f.tag === tag);
      const def = defOf(tag);
      af.forEach(a => {
        total += 10;
        let best = null, bestSim = -1;
        uf.forEach(x => { if (usedUser.has(x.i)) return; const sim = fieldSim(a, x.f); if (sim > bestSim) { bestSim = sim; best = x; } });
        if (!best) { items.push({ tag, status: 'miss', expected: Mo().fieldToText(a, fmt), expInd: (a.ind1 || ' ') + (a.ind2 || ' '), actual: '', points: 0, max: 10, details: ['필드가 없습니다.'] }); return; }
        usedUser.add(best.i);
        const r = G.compareField(a, best.f, def, fmt); const pts = Math.round(r.points * 10 * 10) / 10; got += pts;
        items.push({ tag, status: pts >= 9.99 ? 'ok' : pts >= 5 ? 'partial' : 'miss', expected: Mo().fieldToText(a, fmt), expInd: (a.ind1 || ' ') + (a.ind2 || ' '), actual: Mo().fieldToText(best.f, fmt), actInd: (best.f.ind1 || ' ') + (best.f.ind2 || ' '), points: pts, max: 10, details: r.details, fi: best.i });
      });
      uf.forEach(x => { if (!usedUser.has(x.i)) { usedUser.add(x.i); items.push({ tag, status: 'extra', expected: '', actual: Mo().fieldToText(x.f, fmt), actInd: (x.f.ind1 || ' ') + (x.f.ind2 || ' '), points: 0, max: 0, details: ['정답에 없는 추가 필드입니다 (감점 없음).'], fi: x.i }); } });
    });
    // 채점 대상 아닌 사용자 필드 → 참고
    userRec.fields.forEach((f, i) => { if (usedUser.has(i) || f.tag === '008' || graded.indexOf(f.tag) >= 0) return; if (/^00\d$/.test(f.tag)) return; items.push({ tag: f.tag, status: 'extra', expected: '', actual: Mo().fieldToText(f, fmt), actInd: (f.ind1 || ' ') + (f.ind2 || ' '), points: 0, max: 0, details: ['채점 대상이 아닌 필드입니다 (참고).'], fi: i }); });
    items.sort((a, b) => a.tag.localeCompare(b.tag));
    const score = total ? Math.round(got / total * 100) : 0;
    return { score, total: Math.round(total * 10) / 10, got: Math.round(got * 10) / 10, items, f008, leader, answerRecord: ans };
  };

  MS.Grade = G;
  MS.TESTS = MS.TESTS || { list: [] };
  MS.TESTS.list.push({ name: 'grade perfect answer = 100', fn() { const ex = MS.EXERCISES[0]; const rec = MS.Model.parseBreaker(ex.answer, ex.format).record; const r = G.grade(rec, ex); return r.score === 100 ? true : 'score ' + r.score + ' ' + JSON.stringify(r.items.filter(i => i.status !== 'ok').map(i => [i.tag, i.details])); } });
  MS.TESTS.list.push({ name: 'grade partial answer', fn() { const ex = MS.EXERCISES[0]; const rec = MS.Model.parseBreaker('000 00000nam a2200000 c 4500\n008 ' + MS.Model.default008('KORMARC') + '\n245 10▼a바람의 서재 /▼c김민서 지음\n260  ▼a서울:▼b(주)푸른숲출판,▼c2023', ex.format).record; const r = G.grade(rec, ex); return (r.score > 5 && r.score < 60) ? true : 'score ' + r.score; } });
  MS.TESTS.list.push({ name: 'all exercises validate cleanly (no errors)', fn() { const bad = []; MS.EXERCISES.forEach(ex => { const rec = MS.Model.parseBreaker(ex.answer, ex.format).record; const is = MS.Validate.run(rec).filter(i => i.level === 'error'); if (is.length) bad.push(ex.id + ': ' + is.map(i => i.msg).join(' | ')); }); return bad.length ? bad.join('\n') : true; } });
})();
