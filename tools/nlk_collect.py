#!/usr/bin/env python3
"""국립중앙도서관 소장자료 KORMARC 표본 수집기 (인증키 불필요).

1단계: 누리집 통합검색(search.do, 자료유형 도서·발행년 범위)의 결과 HTML에서 viewKey(서지 키)를 모은다.
        robots.txt 는 일반 UA 에 /NL/contents/search.do 를 허용(Googlebot 만 차단). 간격을 두고 소량만.
2단계: 「MARC 내려받기」(marcDownload.do?downData=<viewKey>,AH1)로 ISO 2709 를 받는다. 한 요청에 여러 건 가능.

사용 예
  python3 tools/nlk_collect.py --years 2015-2024 --pages 1 --target 1500
  # 국가서지 LOD 덤프(tools/lod_index.py 결과)에서 무작위 표본을 뽑아, 제어번호 검색으로 viewKey 를 찾은 뒤 내려받기
  python3 tools/nlk_collect.py --lod .cache/lod_index.tsv --sample 10000 --lod-years 2015-2024 --target 11500 --delay 3
결과: .cache/nlk/ids.txt (viewKey\t유형\t발행년), .cache/nlk/records/batch_NNNN.marc, .cache/nlk/done.txt
다음 단계: python3 tools/marc_stats.py .cache/nlk/records --source nlk --label 국립중앙도서관 --books-only
"""
import argparse, os, random, re, sys, time, urllib.parse, urllib.request

SEARCH = 'https://www.nl.go.kr/NL/contents/search.do'
MARC = 'https://www.nl.go.kr/NL/marcDownload.do'
UA = 'MARC-Studio sample collector (educational, low-rate; https://github.com/LunaticRuri/marc-studio)'
DEFAULT_TERMS = ['연구', '한국', '사회', '역사', '문학', '경제', '교육', '과학', '문화', '정치', '법', '예술', '환경', '기술', '건강', '철학', '종교', '지역', '세계', '이야기']


_FAILS = 0
def http_get(url, timeout=60):
    """차단·과부하 보호: 403/429/5xx·네트워크 오류는 30s→60s→120s→300s 후 재시도, 연속 실패 5회면 중단(재실행 시 이어짐)."""
    global _FAILS
    req = urllib.request.Request(url, headers={'User-Agent': UA, 'Accept': '*/*'})
    for i, wait in enumerate([30, 60, 120, 300, None]):
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r:
                _FAILS = 0
                return r.read()
        except Exception as e:
            code = getattr(e, 'code', None)
            if code and 400 <= code < 500 and code not in (403, 408, 429):
                raise
            _FAILS += 1
            if _FAILS >= 5:
                sys.exit('!! 연속 실패 %d회(%s) — 차단/점검 가능성. 잠시 후 같은 명령으로 재실행하면 이어서 진행됩니다.' % (_FAILS, e))
            if wait is None: raise
            print('  ~ 재시도 %d (%s) %ds 대기' % (i + 1, e, wait), file=sys.stderr); time.sleep(wait)


def search_keys(term, y1, y2, pages, lines=100, delay=2.0, category='도서'):
    """통합검색 결과 HTML → [(viewKey, 유형코드, 발행년)]. 결과 항목의 체크박스 value(||구분)에서 읽는다."""
    found = []
    for page in range(1, pages + 1):
        q = {'pageNum': page, 'pageSize': lines, 'srchTarget': 'total', 'category': category, 'kwd': term}
        if y1: q['sYear'] = y1; q['eYear'] = y2 or y1
        url = SEARCH + '?' + urllib.parse.urlencode(q)
        try:
            html = http_get(url).decode('utf-8', 'replace')
        except Exception as e:
            print('  ! 검색 오류', term, y1, page, e, file=sys.stderr); break
        vals = re.findall(r'name="cbx"[^>]*value="([^"]*)"', html)
        n = 0
        for v in vals:
            p = urllib.parse.unquote_plus(v).split('||')
            if len(p) < 8 or not p[-1].startswith('AH1_'): continue
            key = p[-1][4:]
            if not key.isdigit(): continue
            yr = next((re.sub(r'<[^>]+>', '', x)[:4] for x in p[6:12] if re.match(r'^\d{4}', re.sub(r'<[^>]+>', '', x))), '')
            found.append((key, p[0], yr)); n += 1
        print('  %s / %s-%s p%d: %d건(도서형 %d)' % (term, y1, y2, page, len(vals), n))
        if len(vals) < lines: break
        time.sleep(delay)
    return found


def resolve_lod(cn, delay):
    """제어번호(KMO…)로 통합검색 → 결과가 정확히 1건이면 그 viewKey, 아니면 None."""
    url = SEARCH + '?' + urllib.parse.urlencode({'pageNum': 1, 'pageSize': 10, 'srchTarget': 'total', 'kwd': cn})
    html = http_get(url).decode('utf-8', 'replace')
    keys = sorted(set(re.findall(r'AH1_(\d+)', html)))
    return keys[0] if len(keys) == 1 else None


def lod_sample(index_path, n, years, prefixes, seed):
    y1, y2 = [int(x) for x in years.split('-')] if years else (0, 9999)
    pool = []
    for line in open(index_path, encoding='utf-8'):
        p = line.rstrip('\n').split('\t')
        if len(p) < 4 or p[3] != 'dt_gm' or p[0][:3] not in prefixes: continue
        if not p[1].isdigit() or not (y1 <= int(p[1]) <= y2): continue
        pool.append((p[0], p[1]))
    random.Random(seed).shuffle(pool)
    print('LOD 모집단 %d건 (dt_gm, %s, %s) → 표본 %d건' % (len(pool), years or '전체 연도', ','.join(prefixes), min(n, len(pool))))
    return pool[:n]


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--years', default='', help='발행년도 범위 예 2015-2024 (연도별로 나눠 수집)')
    ap.add_argument('--terms', help='검색어 목록 파일(한 줄 하나). 기본 내장 20개')
    ap.add_argument('--pages', type=int, default=1, help='검색어·연도별 가져올 페이지 수(100건/페이지)')
    ap.add_argument('--target', type=int, default=500, help='MARC을 내려받을 표본 크기(무작위)')
    ap.add_argument('--batch', type=int, default=20, help='MARC 요청 1회당 건수')
    ap.add_argument('--out', default='.cache/nlk')
    ap.add_argument('--delay', type=float, default=2.0, help='요청 간격(초)')
    ap.add_argument('--seed', type=int, default=20261102)
    ap.add_argument('--skip-search', action='store_true', help='ids.txt 가 이미 있으면 검색 생략')
    ap.add_argument('--lod', help='tools/lod_index.py 가 만든 TSV. 주면 키워드 검색 대신 LOD 무작위 표본의 제어번호를 viewKey 로 해석')
    ap.add_argument('--sample', type=int, default=10000, help='--lod 표본 크기')
    ap.add_argument('--lod-years', default='2015-2024', help='--lod 발행년 범위')
    ap.add_argument('--lod-prefix', default='KMO,WMO,JMO,CMO', help='--lod 제어번호 접두(단행본: KMO 국내, WMO 서양, JMO 일본, CMO 중국)')
    a = ap.parse_args()

    rec_dir = os.path.join(a.out, 'records'); os.makedirs(rec_dir, exist_ok=True)
    ids_path = os.path.join(a.out, 'ids.txt'); done_path = os.path.join(a.out, 'done.txt')
    ids = {}
    if os.path.exists(ids_path):
        for line in open(ids_path, encoding='utf-8'):
            p = line.rstrip('\n').split('\t')
            if p[0]: ids[p[0]] = (p[1:] + ['', ''])[:2]
    if a.lod:
        samp_path = os.path.join(a.out, 'lod_sample.tsv'); map_path = os.path.join(a.out, 'lod_map.tsv')
        if os.path.exists(samp_path):
            sample = [tuple(l.rstrip('\n').split('\t')) for l in open(samp_path, encoding='utf-8') if l.strip()]
        else:
            sample = lod_sample(a.lod, a.sample, a.lod_years, a.lod_prefix.split(','), a.seed)
            with open(samp_path, 'w', encoding='utf-8') as f:
                for cn, yr in sample: f.write('%s\t%s\n' % (cn, yr))
        mp = {}
        if os.path.exists(map_path):
            for l in open(map_path, encoding='utf-8'):
                p = l.rstrip('\n').split('\t')
                if len(p) >= 2: mp[p[0]] = p[1]
        todo = [(cn, yr) for cn, yr in sample if cn not in mp]
        n_done = len(open(done_path, encoding='utf-8').read().split()) if os.path.exists(done_path) else 0
        resolved = sum(1 for v in mp.values() if v != '-')
        need = max(0, a.target - n_done)  # 내려받기 목표까지 필요한 viewKey 수만큼만 해석
        print('viewKey 해석: 표본 %d건 중 이미 %d건(해석됨 %d), 필요 %d건, 이번에 최대 %d건 (간격 %.1f초)' % (len(sample), len(mp), resolved, need, len(todo), a.delay))
        miss = 0
        for i, (cn, yr) in enumerate(todo, 1):
            if resolved >= need: print('  필요한 만큼 해석됨(%d건) — 중단' % resolved); break
            try:
                key = resolve_lod(cn, a.delay)
            except SystemExit:
                raise
            except Exception as e:
                print('  ! 해석 실패', cn, e, file=sys.stderr); time.sleep(a.delay); continue
            mp[cn] = key or '-'
            if key: resolved += 1
            else: miss += 1
            with open(map_path, 'a', encoding='utf-8') as f: f.write('%s\t%s\t%s\n' % (cn, key or '-', yr))
            if i % 50 == 0: print('  …%d/%d (미해석 %d)' % (i, len(todo), miss))
            time.sleep(a.delay + random.random() * a.delay * 0.5)
        for cn, yr in sample:
            k = mp.get(cn)
            if k and k != '-': ids.setdefault(k, ['lod', yr])
        with open(ids_path, 'w', encoding='utf-8') as f:
            for k, (typ, yr) in sorted(ids.items()): f.write('%s\t%s\t%s\n' % (k, typ, yr))
        print('viewKey %d건 → %s' % (len(ids), ids_path))
    elif not (a.skip_search and ids):
        terms = [t.strip() for t in open(a.terms, encoding='utf-8') if t.strip()] if a.terms else DEFAULT_TERMS
        years = [(None, None)]
        if a.years:
            y1, y2 = [int(x) for x in a.years.split('-')]
            years = [(y, y) for y in range(y1, y2 + 1)]
        for (y1, y2) in years:
            for term in terms:
                for key, typ, yr in search_keys(term, y1, y2, a.pages, delay=a.delay):
                    ids.setdefault(key, [typ, yr or (str(y1) if y1 else '')])
                time.sleep(a.delay)
        with open(ids_path, 'w', encoding='utf-8') as f:
            for k, (typ, yr) in sorted(ids.items()): f.write('%s\t%s\t%s\n' % (k, typ, yr))
        print('viewKey %d건 → %s' % (len(ids), ids_path))

    done = set(open(done_path, encoding='utf-8').read().split()) if os.path.exists(done_path) else set()
    todo = [k for k in ids if k not in done]
    random.Random(a.seed).shuffle(todo)
    todo = todo[:max(0, a.target - len(done & set(ids)))]
    print('MARC 내려받기: 이미 %d건, 이번에 %d건 (%d건씩, 간격 %.1f초)' % (len(done & set(ids)), len(todo), a.batch, a.delay))
    existing = [fn for fn in os.listdir(rec_dir) if fn.startswith('batch_')]
    seq = max([int(fn[6:10]) for fn in existing] + [0])
    ok = 0
    for i in range(0, len(todo), a.batch):
        chunk = todo[i:i + a.batch]
        url = MARC + '?' + '&'.join('downData=%s,AH1' % k for k in chunk)
        try:
            raw = http_get(url)
        except Exception as e:
            print('  ! 실패', chunk[0], '…', e, file=sys.stderr); time.sleep(a.delay); continue
        recs = [r for r in raw.split(b'\x1d') if len(r) > 24]
        if not recs:
            print('  ! 레코드 없음:', chunk[:3], file=sys.stderr); time.sleep(a.delay); continue
        seq += 1
        open(os.path.join(rec_dir, 'batch_%04d.marc' % seq), 'wb').write(raw)
        with open(done_path, 'a', encoding='utf-8') as f: f.write('\n'.join(chunk) + '\n')
        ok += len(recs)
        if len(recs) != len(chunk): print('  ? 요청 %d건, 수신 %d건' % (len(chunk), len(recs)))
        print('  …%d/%d (레코드 %d)' % (min(i + a.batch, len(todo)), len(todo), ok))
        time.sleep(a.delay)
    print('완료: 이번 %d건, 누적 viewKey %d건 → %s' % (ok, len(done) + len(todo), rec_dir))


if __name__ == '__main__':
    main()
