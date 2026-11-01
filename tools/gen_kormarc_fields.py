#!/usr/bin/env python3
"""KORMARC 통합서지용(KS X 6006-0, 2023) 원문 페이지에서 필드 정의를 추출해
src/data/kormarc-fields2.js 를 생성한다.

사용: python3 tools/gen_kormarc_fields.py [캐시폴더]
  - 캐시폴더(기본 .cache/kormarc-pages)에 원문 HTML이 없으면 librarian.nl.go.kr 에서 내려받는다.
  - 생성된 파일은 런타임에 '이름만 등록'되었거나 없는 태그에만 적용된다(손으로 쓴 kormarc.js 정의가 우선).
"""
import re, html, json, os, sys, urllib.request

BASE = 'https://librarian.nl.go.kr/kormarc/KSX6006-0/sub/'
GROUPS = ['00X', '01X_09X', '1XX', '20X_24X', '250_28X', '3XX', '4XX', '5XX', '6XX', '70X_75X', '76X_78X', '80X_830', '841_89X', '9XX']
CONTROL = {'001', '003', '005', '006', '007', '008'}
SKIP = {'880'}  # 관련 필드와 동일(기존 정의 유지)

def fetch(url):
    with urllib.request.urlopen(url, timeout=30) as r:
        return r.read().decode('utf-8', 'replace')

def ensure_pages(cache):
    os.makedirs(cache, exist_ok=True)
    if any(f.endswith('.html') for f in os.listdir(cache)):
        return
    for g in GROUPS:
        ov = fetch(BASE + g + '_overview.html')
        for link in sorted(set(re.findall(r'href="([A-Za-z0-9_]+\.html)"', ov))):
            if 'overview' in link or 'appendix' in link: continue
            open(os.path.join(cache, link), 'w', encoding='utf-8').write(fetch(BASE + link))

def clean(t):
    t = re.sub(r'<[^>]+>', '', t); t = html.unescape(t)
    t = t.replace('［', '[').replace('］', ']').replace('}', ']').replace('　', ' ').replace('\xa0', ' ')
    return re.sub(r'\s+', ' ', t).strip()

def parse_page(tag, s):
    s = re.sub(r'<(script|style)[^>]*>.*?</\1>', '', s, flags=re.S)
    m = re.search(r'<h3>(.*?)</h3>', s, re.S); h3 = m.group(1) if m else ''
    name = clean(re.sub(r'<p[^>]*>.*?</p>', '', h3, flags=re.S).replace('<ul', '\n<ul').split('\n')[0])
    name = re.sub(r'^\S+\s+', '', name)
    name = re.sub(r'\s*\((?:[A-Za-z][^()]*)\)\s*$', '', name)  # 영문 괄호 제거
    name = re.sub(r'\s+[-–—]\s+', '—', name)
    rep = 'icon_repeat' in h3 and 'icon_norepeat' not in h3
    rec = {'tag': tag, 'name': name, 'rep': rep, 'ind': [None, None], 'sub': [], 'any': False, 'ex': []}
    top = s.split('정의와 범위')[0]
    for ul in re.findall(r'<ul class="jisi">(.*?)</ul>\s*</li>\s*</ul>', top, re.S):
        st = re.search(r'<strong[^>]*>(.*?)</strong>', ul, re.S)
        if not st: continue
        mm = re.match(r'제([12])지시기호\s*[-–—]?\s*(.*)', clean(st.group(1)))
        if not mm: continue
        idx = int(mm.group(1)) - 1; iname = mm.group(2).strip()
        codes = []
        for li in re.findall(r'<li>(.*?)</li>', ul, re.S):
            sp = re.search(r'<span[^>]*>(.*?)</span>(.*)', li, re.S)
            if not sp: continue
            code = clean(sp.group(1)); desc = clean(sp.group(2))
            code = ' ' if code == 'b/' else code
            if code in dict(codes) or len(code) != 1: continue
            codes.append((code, desc))
        if '미정의' in iname or (len(codes) == 1 and codes[0][0] == ' ' and '미정의' in codes[0][1]):
            rec['ind'][idx] = None
        else:
            rec['ind'][idx] = {'n': iname or ('주기 제어' if idx == 0 else '표출어 제어'), 'c': codes}
    for li in re.findall(r'<ul class="abcMark[^"]*">(.*?)</ul>', top, re.S):
        for item in re.findall(r'<li>(.*?)</li>', li, re.S):
            t = clean(item)
            mm = re.match(r'▾(\S+?)\s+(.*?)\s*\[?(반복불가|반복)\]?\s*(.*)$', t)
            if not mm:
                mm2 = re.match(r'▾(\S+?)\s+(.*)$', t)
                if mm2:
                    code = mm2.group(1)
                    if len(code) == 1: rec['sub'].append((code, mm2.group(2), False))
                    else: rec['any'] = True
                elif re.match(r'▾\S+\s*-\s*\S', t): rec['any'] = True
                continue
            code = mm.group(1)
            if len(code) != 1:
                rec['any'] = True; continue
            rec['sub'].append((code, mm.group(2), mm.group(3) == '반복'))
    body = clean(re.sub(r'<br\s*/?>|</p>|</li>', '\u0001', s).replace('\n', ' '))
    for seg in body.split('\u0001'):
        seg = seg.strip()
        if re.match(r'^%s\s+(\S{1,3}\s*)?▾' % re.escape(tag), seg) and seg not in rec['ex'] and len(seg) < 120:
            rec['ex'].append(seg)
    return rec

def js(s):
    return json.dumps(s, ensure_ascii=False)

def ind_js(i):
    if i is None: return 'U'
    return '{ n: %s, c: { %s } }' % (js(i['n']), ', '.join('%s: %s' % (js(c), js(d)) for c, d in i['c']))

def main():
    cache = sys.argv[1] if len(sys.argv) > 1 else '.cache/kormarc-pages'
    ensure_pages(cache)
    out = []
    for fn in sorted(os.listdir(cache)):
        if not fn.endswith('.html'): continue
        tag = re.sub(r'.*_([0-9X]+)\.html', r'\1', fn)
        if tag in CONTROL or tag in SKIP: continue
        rec = parse_page(tag, open(os.path.join(cache, fn), encoding='utf-8', errors='replace').read())
        if not rec['sub'] and not rec['any']: continue
        subs = '|'.join('%s=%s%s' % (c, n.replace('|', '/').replace('=', '＝'), '*' if r else '') for c, n, r in rec['sub'])
        extra = []
        if rec['any']: extra.append('anySubs: true')
        if rec['ex']:
            exs = [e.replace('b/', ' ').replace('▾', '▼') for e in rec['ex'][:2]]
            extra.append('note: %s' % js('예: ' + ' / '.join(exs)))
        out.append("  G(%s, %s, %s, %s, %s, %s%s);" % (js(tag), js(rec['name']), 'true' if rec['rep'] else 'false', ind_js(rec['ind'][0]), ind_js(rec['ind'][1]), js(subs), (', { ' + ', '.join(extra) + ' }') if extra else ''))
    header = """/* MARC 스튜디오 — KORMARC 통합서지용 필드 정의(2): 원문 자동 추출분
 * 생성: python3 tools/gen_kormarc_fields.py  (원문: https://librarian.nl.go.kr/kormarc/KSX6006-0/, KS X 6006-0 2023 개정판)
 * 적용 규칙: kormarc.js 에 손으로 쓴 상세 정의가 있는 태그는 그대로 두고, 이름만 등록된 태그와 빠진 태그만 채운다.
 * 식별기호 ▼6·▼8은 원문 목록에 있는 경우에만 포함한다(noCtrl).
 */
window.MS = window.MS || {};
(function () {
  const H = MS.FIELD_HELPERS, F = MS.FIELDS.KORMARC, M = MS.FIELDS.MARC21, U = null;
  const G = (tag, name, rep, ind1, ind2, subs, extra) => {
    if (F[tag] && !F[tag].nameOnly) return;
    F[tag] = H.def(name, rep, ind1, ind2, subs, Object.assign({ noCtrl: true, src: '확인', kormarcOnly: !M[tag], gen: true }, extra || {}));
  };
"""
    footer = "})();\n"
    open('src/data/kormarc-fields2.js', 'w', encoding='utf-8').write(header + '\n'.join(out) + '\n' + footer)
    print('generated', len(out), 'tags')

if __name__ == '__main__':
    main()
