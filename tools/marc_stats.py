#!/usr/bin/env python3
"""MARC 레코드 묶음에서 태그·지시기호·식별기호·008 사용 빈도를 세어 src/data/usage.js 를 만든다.

입력: MARCXML(.xml, <collection>/<record>) 또는 ISO 2709(.mrc/.marc) 파일·폴더 (여러 개 가능)
출력: window.MS.USAGE[<source>] = { source, format, n, collected, tags:{tag:{recs,occ,ind,sub}}, leader:{pos:{}}, f008:{pos:{}} }

사용 예
  python3 tools/marc_stats.py .cache/nanet/records --source nanet --label 국회도서관 --format KORMARC
  python3 tools/marc_stats.py sample.mrc --source nlk --label 국립중앙도서관 --encoding euc-kr
"""
import argparse, collections, datetime, json, os, re, sys, xml.etree.ElementTree as ET

NS = '{http://www.loc.gov/MARC21/slim}'
F008_GROUPS = [(6, 7), (15, 18), (18, 22), (22, 23), (23, 24), (24, 26), (26, 28), (28, 29), (29, 30), (30, 31), (31, 32), (32, 33), (33, 34), (34, 35), (35, 38), (38, 40)]
LEADER_POS = [5, 6, 7, 8, 9, 17, 18, 19]
TOP = 12


def iter_marcxml(path):
    try:
        root = ET.parse(path).getroot()
    except ET.ParseError as e:
        print('  ! XML 오류', path, e, file=sys.stderr); return
    for rec in root.iter(NS + 'record') if root.tag.startswith(NS) else root.iter('record'):
        ns = NS if rec.tag.startswith(NS) else ''
        r = {'leader': (rec.findtext(ns + 'leader') or ''), 'fields': []}
        for cf in rec.findall(ns + 'controlfield'):
            r['fields'].append({'tag': cf.get('tag'), 'value': cf.text or ''})
        for df in rec.findall(ns + 'datafield'):
            r['fields'].append({'tag': df.get('tag'), 'ind1': df.get('ind1', ' '), 'ind2': df.get('ind2', ' '),
                                'subfields': [(sf.get('code'), sf.text or '') for sf in df.findall(ns + 'subfield')]})
        yield r


def iter_iso2709(path, encoding):
    data = open(path, 'rb').read()
    for raw in data.split(b'\x1d'):
        if len(raw) < 24: continue
        try:
            leader = raw[:24].decode('ascii', 'replace')
            base = int(raw[12:17])
        except ValueError:
            continue
        enc = 'utf-8' if (encoding == 'auto' and leader[9] == 'a') else ('euc-kr' if encoding == 'auto' else encoding)
        directory = raw[24:base - 1].decode('ascii', 'replace')
        body = raw[base:]
        r = {'leader': leader, 'fields': []}
        for i in range(0, len(directory) - 11, 12):
            tag = directory[i:i + 3]; ln = int(directory[i + 3:i + 7]); st = int(directory[i + 7:i + 12])
            fb = body[st:st + ln].rstrip(b'\x1e')
            txt = fb.decode(enc, 'replace')
            if tag < '010':
                r['fields'].append({'tag': tag, 'value': txt})
            else:
                parts = txt.split('\x1f')
                ind = (parts[0] + '  ')[:2]
                r['fields'].append({'tag': tag, 'ind1': ind[0], 'ind2': ind[1], 'subfields': [(p[:1], p[1:]) for p in parts[1:] if p]})
        yield r


def iter_records(paths, encoding):
    for p in paths:
        files = []
        if os.path.isdir(p):
            for fn in sorted(os.listdir(p)):
                files.append(os.path.join(p, fn))
        else:
            files.append(p)
        for f in files:
            low = f.lower()
            if low.endswith('.xml'): yield from iter_marcxml(f)
            elif low.endswith(('.mrc', '.marc', '.dat')): yield from iter_iso2709(f, encoding)


def top(counter, n=TOP):
    return dict(counter.most_common(n))


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('inputs', nargs='+')
    ap.add_argument('--source', required=True, help='키 (예: nanet, nlk)')
    ap.add_argument('--label', default='', help='표시 이름 (예: 국회도서관)')
    ap.add_argument('--format', default='KORMARC', choices=['KORMARC', 'MARC21'])
    ap.add_argument('--encoding', default='auto', help='ISO 2709 문자부호: auto|utf-8|euc-kr')
    ap.add_argument('--books-only', action='store_true', help='리더/06=a, /07=m (도서)만 집계')
    ap.add_argument('--out', default='src/data/usage.js')
    ap.add_argument('--note', default='')
    a = ap.parse_args()

    n = 0; skipped = 0
    tag_recs = collections.Counter(); tag_occ = collections.Counter()
    ind = collections.defaultdict(collections.Counter)         # tag -> 'xy' -> count (occurrence)
    sub_recs = collections.defaultdict(collections.Counter)    # tag -> code -> occurrences having code
    sub_occ = collections.defaultdict(collections.Counter)     # tag -> code -> total subfield count
    leader = collections.defaultdict(collections.Counter)
    f008 = collections.defaultdict(collections.Counter)
    for r in iter_records(a.inputs, a.encoding):
        ld = r['leader']
        if a.books_only and not (len(ld) > 7 and ld[6] == 'a' and ld[7] == 'm'):
            skipped += 1; continue
        n += 1
        for p in LEADER_POS:
            if len(ld) > p: leader[str(p)][ld[p]] += 1
        seen = set()
        for f in r['fields']:
            t = f['tag']
            tag_occ[t] += 1
            if t not in seen: seen.add(t); tag_recs[t] += 1
            if 'value' in f:
                if t == '008' and len(f['value']) >= 40:
                    v = f['value']
                    for (s, e) in F008_GROUPS: f008['%d-%d' % (s, e - 1) if e - s > 1 else str(s)][v[s:e]] += 1
                continue
            ind[t][(f.get('ind1') or ' ') + (f.get('ind2') or ' ')] += 1
            codes = set()
            for (c, _v) in f['subfields']:
                sub_occ[t][c] += 1; codes.add(c)
            for c in codes: sub_recs[t][c] += 1
    if not n: sys.exit('레코드가 없습니다.')

    tags = {}
    for t in sorted(tag_recs):
        e = {'recs': tag_recs[t], 'occ': tag_occ[t]}
        if t in ind: e['ind'] = top(ind[t])
        if t in sub_occ:
            e['sub'] = {c: [sub_recs[t][c], sub_occ[t][c]] for c in sorted(sub_occ[t], key=lambda c: (-sub_recs[t][c], c))}
        tags[t] = e
    out = {'source': a.label or a.source, 'format': a.format, 'n': n, 'skipped': skipped,
           'collected': datetime.date.today().isoformat(), 'note': a.note,
           'tags': tags, 'leader': {p: top(c) for p, c in leader.items()}, 'f008': {p: top(c) for p, c in f008.items()}}
    existing = ''
    if os.path.exists(a.out):
        existing = open(a.out, encoding='utf-8').read()
        existing = re.sub(r"MS\.USAGE\['%s'\] = .*?;\n" % re.escape(a.source), '', existing, flags=re.S)
    if 'window.MS' not in existing:
        existing = "/* MARC 스튜디오 — 실무 사용 빈도 (tools/marc_stats.py 생성). 값: recs=해당 태그가 있는 레코드 수, occ=출현 횟수, sub[code]=[태그 출현 중 그 식별기호가 있는 횟수, 식별기호 총 개수] */\nwindow.MS = window.MS || {}; MS.USAGE = MS.USAGE || {};\n"
    existing += "MS.USAGE['%s'] = %s;\n" % (a.source, json.dumps(out, ensure_ascii=False, separators=(',', ':')))
    open(a.out, 'w', encoding='utf-8').write(existing)
    print('레코드 %d건(제외 %d) → %s  태그 %d종' % (n, skipped, a.out, len(tags)))
    for t, e in sorted(tags.items(), key=lambda x: -x[1]['recs'])[:15]:
        print('  %s %5.1f%%  (%d건, %d회)' % (t, 100.0 * e['recs'] / n, e['recs'], e['occ']))


if __name__ == '__main__':
    main()
